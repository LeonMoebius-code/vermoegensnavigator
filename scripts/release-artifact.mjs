import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const site = resolve(root, '.pages-dist');
export const sealPath = resolve(root, 'outputs/r1-build-manifest.json');
export const files = ['.nojekyll', '404.html', 'app.js', 'branding/private-banking-logo-cropped.png',
  'branding/private-banking-logo.png', 'branding/volksbank-pur-logo.png', 'build-info.json',
  'favicon.svg', 'index.html', 'og.png', 'styles.css'].sort();
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const json = path => JSON.parse(readFileSync(path, 'utf8'));
export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}
export function requireThat(condition, message) { if (!condition) throw new Error(message); }
export function buildHash(directory) {
  // Hash only file contents, with unambiguous fixed-size digest boundaries.
  return sha256(['app.js', 'styles.css'].map(name => sha256(readFileSync(resolve(directory, name)))).join('')).slice(0, 12);
}
export function cleanOutput(projectRoot = root) {
  const buildRoot = resolve(projectRoot);
  const buildSite = resolve(buildRoot, '.pages-dist');
  // Fixed, project-local target; refuse redirected directories before recursive removal.
  requireThat(dirname(buildSite) === buildRoot && buildSite !== buildRoot, 'Unsafe build directory');
  if (existsSync(buildSite)) requireThat(!lstatSync(buildSite).isSymbolicLink(), 'Symlink build directory');
  rmSync(buildSite, { recursive: true, force: true });
  rmSync(resolve(buildRoot, 'outputs/r1-build-manifest.json'), { force: true });
  mkdirSync(buildSite);
}
export function validate(directory, expectedSha) {
  requireThat(/^[a-f0-9]{40}$/.test(expectedSha), 'Expected source SHA must be explicit');
  requireThat(lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink(), 'Invalid artifact root');
  const found = [];
  function walk(relative = '') {
    for (const entry of readdirSync(resolve(directory, relative))) {
      const name = relative ? `${relative}/${entry}` : entry;
      const stat = lstatSync(resolve(directory, name));
      requireThat(!stat.isSymbolicLink(), `Symlink forbidden: ${name}`);
      if (stat.isDirectory()) {
        requireThat(name === 'branding', `Unexpected directory: ${name}`);
        walk(name);
      } else {
        requireThat(stat.isFile() && stat.nlink === 1 && files.includes(name), `Unexpected file/link: ${name}`);
        requireThat(stat.size <= 10 * 1024 * 1024, `Oversized file: ${name}`);
        const body = readFileSync(resolve(directory, name));
        requireThat(!/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16})/.test(body.toString('utf8')), `Credential signature: ${name}`);
        requireThat(name === '.nojekyll' ? body.length === 0 : body.length > 0, `Invalid empty file: ${name}`);
        found.push({ path: name, bytes: body.length, sha256: sha256(body) });
      }
    }
  }
  walk();
  found.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  requireThat(JSON.stringify(found.map(x => x.path)) === JSON.stringify(files), 'Incomplete website');
  const info = json(resolve(directory, 'build-info.json'));
  requireThat(Object.keys(info).sort().join(',') === ['schemaVersion','sourceSha','builtAt','workflow','runId','runAttempt','node','npm','tools','lockfileSha256'].sort().join(','), 'Invalid provenance fields');
  requireThat(info.schemaVersion === 1 && info.sourceSha === expectedSha, 'Provenance source mismatch');
  requireThat(typeof info.builtAt === 'string' && new Date(info.builtAt).toISOString() === info.builtAt, 'Invalid build date');
  requireThat(/^[a-f0-9]{64}$/.test(info.lockfileSha256), 'Invalid lockfile hash');
  requireThat(/^v\d+\.\d+\.\d+$/.test(info.node) && /^\d+\.\d+\.\d+$/.test(info.npm), 'Invalid runtime versions');
  requireThat(info.workflow === 'local' || info.workflow === 'Release GitHub Pages' || info.workflow === 'Feature CI', 'Unexpected build workflow');
  requireThat(/^\d+$/.test(info.runId) && /^\d+$/.test(info.runAttempt), 'Invalid run identity');
  requireThat(Object.keys(info.tools).sort().join(',') === 'esbuild,playwright,typescript' && Object.values(info.tools).every(v => /^\d+\.\d+\.\d+$/.test(v)), 'Invalid tool versions');
  const hash = buildHash(directory);
  const html = readFileSync(resolve(directory, 'index.html'), 'utf8');
  requireThat(html.includes(`app.js?v=${hash}`) && html.includes(`styles.css?v=${hash}`), 'Cache hash mismatch');
  requireThat(readFileSync(resolve(directory, '404.html'), 'utf8') === html, '404 mismatch');
  return { algorithm: 'sha256-canonical-file-manifest-v1', checksum: sha256(JSON.stringify(found)), files: found, provenance: info };
}
export function assertSame(actual, expected) {
  requireThat(JSON.stringify(actual) === JSON.stringify(expected), 'Artifact changed since build/CP0B or stored evidence');
}
function provenance() {
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (process.env.GITHUB_SHA) requireThat(sourceSha === process.env.GITHUB_SHA, 'Checkout differs from workflow SHA');
  const npmVersion = process.env.npm_config_user_agent?.match(/^npm\/(\d+\.\d+\.\d+)/)?.[1];
  requireThat(npmVersion, 'Invoke build through npm');
  writeJson(resolve(site, 'build-info.json'), {
    schemaVersion: 1, sourceSha, builtAt: new Date().toISOString(),
    workflow: process.env.GITHUB_WORKFLOW || 'local', runId: process.env.GITHUB_RUN_ID || '0',
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || '0', node: process.version, npm: npmVersion,
    tools: Object.fromEntries([['esbuild', 'esbuild'], ['playwright', '@playwright/test'], ['typescript', 'typescript']]
      .map(([key, name]) => [key, json(resolve(root, 'node_modules', name, 'package.json')).version])),
    lockfileSha256: sha256(readFileSync(resolve(root, 'package-lock.json'))),
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (command === 'clean') cleanOutput();
  else if (command === 'build-hash') console.log(buildHash(site));
  else if (command === 'provenance') provenance();
  else if (command === 'seal') writeJson(sealPath, validate(site, json(resolve(site, 'build-info.json')).sourceSha));
  else throw new Error('Unknown release-artifact command');
}
