import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function requireThat(condition, message) { if (!condition) throw new Error(message); }
function assertSame(actual, expected) {
  requireThat(JSON.stringify(actual) === JSON.stringify(expected), 'Artifact changed since build/CP0B or stored evidence');
}

const algorithm = 'sha256-canonical-file-manifest-v1';
const maxFileBytes = 10 * 1024 * 1024;
const maxTotalBytes = 100 * 1024 * 1024;
const maxEntries = 1000;

function safePath(path) {
  requireThat(typeof path === 'string' && path.length > 0 && path.length <= 240, 'Unsafe historical path');
  const parts = path.split('/');
  requireThat(parts.length <= 16 && parts.every(part =>
    /^[A-Za-z0-9_.-]+$/.test(part) && !/^\.+$/.test(part) && !part.endsWith('.') &&
    !/^(?:\.git|\.github)$/i.test(part) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)),
  `Unsafe historical path: ${path}`);
}

// Frozen supported historical contract. Future candidate-schema changes belong in
// release-artifact.mjs; add explicit historical versions here, never replace v1.
function validateProvenanceV1(info, selection) {
  requireThat(info && info.schemaVersion === 1, 'Unsupported historical provenance schema');
  requireThat(Object.keys(info).sort().join(',') === ['schemaVersion', 'sourceSha', 'builtAt', 'workflow',
    'runId', 'runAttempt', 'node', 'npm', 'tools', 'lockfileSha256'].sort().join(','), 'Invalid historical provenance fields');
  requireThat(info.sourceSha === selection.sourceSha && info.workflow === 'Release GitHub Pages' &&
    info.runId === selection.runId && info.runAttempt === '1', 'Historical provenance identity mismatch');
  requireThat(typeof info.builtAt === 'string' && new Date(info.builtAt).toISOString() === info.builtAt, 'Invalid historical build date');
  requireThat(/^[a-f0-9]{64}$/.test(info.lockfileSha256), 'Invalid historical lockfile hash');
  requireThat(/^v\d+\.\d+\.\d+$/.test(info.node) && /^\d+\.\d+\.\d+$/.test(info.npm), 'Invalid historical runtime versions');
  requireThat(info.tools && Object.keys(info.tools).sort().join(',') === 'esbuild,playwright,typescript' &&
    Object.values(info.tools).every(v => /^\d+\.\d+\.\d+$/.test(v)), 'Invalid historical tool versions');
}

// Only call after binding evidence to a trusted successful original release run.
// Read and hash saved bytes; never build, execute or modify the historical site.
export function validateHistoricalArtifact(directory, evidence, selection) {
  requireThat(/^[a-f0-9]{40}$/.test(selection.sourceSha) && /^[1-9][0-9]*$/.test(selection.runId), 'Invalid historical identity');
  requireThat(evidence.algorithm === algorithm && /^[a-f0-9]{64}$/.test(evidence.checksum), 'Unsupported historical manifest/checksum');
  requireThat(Array.isArray(evidence.files) && evidence.files.length > 0 && evidence.files.length <= maxEntries, 'Invalid historical file manifest');
  let previous = '';
  let expectedBytes = 0;
  const directories = new Set();
  for (const file of evidence.files) {
    requireThat(file && Object.keys(file).sort().join(',') === 'bytes,path,sha256', 'Invalid historical manifest entry');
    safePath(file.path);
    requireThat(file.path > previous, 'Historical manifest must be sorted and unique');
    previous = file.path;
    requireThat(Number.isSafeInteger(file.bytes) && file.bytes >= 0 && file.bytes <= maxFileBytes &&
      /^[a-f0-9]{64}$/.test(file.sha256), 'Invalid historical file size/hash');
    expectedBytes += file.bytes;
    const parts = file.path.split('/');
    for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join('/'));
  }
  requireThat(expectedBytes <= maxTotalBytes, 'Oversized historical website');
  const rootStat = lstatSync(directory);
  requireThat(rootStat.isDirectory() && !rootStat.isSymbolicLink(), 'Invalid historical artifact root');
  const found = [];
  let entries = 0;
  let totalBytes = 0;
  let provenance;
  function walk(relative = '') {
    for (const entry of readdirSync(resolve(directory, relative))) {
      requireThat(++entries <= maxEntries, 'Too many historical entries');
      const name = relative ? `${relative}/${entry}` : entry;
      safePath(name);
      const path = resolve(directory, name);
      const stat = lstatSync(path);
      requireThat(!stat.isSymbolicLink(), `Historical symlink forbidden: ${name}`);
      if (stat.isDirectory()) {
        requireThat(directories.has(name), `Unexpected historical directory: ${name}`);
        walk(name);
      } else {
        requireThat(stat.isFile() && stat.nlink === 1, `Historical nonregular file/hardlink: ${name}`);
        totalBytes += stat.size;
        requireThat(stat.size <= maxFileBytes && totalBytes <= maxTotalBytes, `Oversized historical file/website: ${name}`);
        const body = readFileSync(path);
        requireThat(!/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16})/.test(body.toString('utf8')), `Credential signature: ${name}`);
        found.push({ path: name, bytes: body.length, sha256: sha256(body) });
        if (name === 'build-info.json') provenance = JSON.parse(body.toString('utf8'));
      }
    }
  }
  walk();
  found.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  validateProvenanceV1(provenance, selection);
  const manifest = { algorithm, checksum: sha256(JSON.stringify(found)), files: found, provenance };
  assertSame(manifest, { algorithm: evidence.algorithm, checksum: evidence.checksum, files: evidence.files, provenance: evidence.provenance });
  return manifest;
}
