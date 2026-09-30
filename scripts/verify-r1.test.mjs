import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { assertSame, buildHash, cleanOutput, json, root, site, validate, writeJson } from './release-artifact.mjs';
import { validateEvidence, validateRun } from './prepare-pages-rollback.mjs';

// Operate on disposable copies only: never rebuild or mutate the CP0B-tested site.
const source = json(resolve(site, 'build-info.json')).sourceSha;
function fixture(t) {
  const directory = mkdtempSync(resolve(tmpdir(), 'vn-r1-'));
  t.after(() => {
    assert.ok(directory.startsWith(resolve(tmpdir(), 'vn-r1-')));
    rmSync(directory, { recursive: true, force: true });
  });
  cpSync(site, resolve(directory, 'website'), { recursive: true });
  return { directory, website: resolve(directory, 'website') };
}
test('content/cache hashes and complete manifests ignore absolute paths', t => {
  const { website } = fixture(t);
  assert.equal(buildHash(site), buildHash(website));
  assertSame(validate(site, source), validate(website, source));
  writeFileSync(resolve(website, 'styles.css'), 'changed');
  assert.notEqual(buildHash(site), buildHash(website));
  assert.throws(() => validate(website, source), /Cache hash/);
});
test('clean output removes stale nested files and invalidates old seal', t => {
  const { directory } = fixture(t);
  mkdirSync(resolve(directory, '.pages-dist/stale'), { recursive: true });
  writeFileSync(resolve(directory, '.pages-dist/stale/secret.txt'), 'stale');
  writeJson(resolve(directory, 'outputs/r1-build-manifest.json'), { old: true });
  cleanOutput(directory);
  assert.ok(existsSync(resolve(directory, '.pages-dist')));
  assert.ok(!existsSync(resolve(directory, '.pages-dist/stale')));
  assert.ok(!existsSync(resolve(directory, 'outputs/r1-build-manifest.json')));
  assert.ok(existsSync(resolve(directory, 'website/index.html')));
});
for (const extra of ['package.json', '.env', '.git/config', 'docs/readme.md', 'tests/test.js', 'node_modules/pkg/index.js', 'branding/unexpected.png']) {
  test(`reject unexpected artifact content: ${extra}`, t => {
    const { website } = fixture(t);
    const path = resolve(website, extra);
    mkdirSync(resolve(path, '..'), { recursive: true });
    writeFileSync(path, 'unexpected');
    assert.throws(() => validate(website, source), /Unexpected/);
  });
}
test('reject missing core file, mismatched source and invalid provenance', t => {
  const { website } = fixture(t);
  assert.throws(() => validate(website, '0'.repeat(40)), /source mismatch/);
  const info = json(resolve(website, 'build-info.json'));
  writeJson(resolve(website, 'build-info.json'), { ...info, token: 'unexpected' });
  assert.throws(() => validate(website, source), /provenance fields/);
  writeFileSync(resolve(website, 'build-info.json'), '{');
  assert.throws(() => validate(website, source), SyntaxError);
  rmSync(resolve(website, 'index.html'));
  assert.throws(() => validate(website, source), /Incomplete/);
});
test('reject credential signatures in otherwise allowed content', t => {
  const { website } = fixture(t);
  writeFileSync(resolve(website, 'app.js'), '-----BEGIN PRIVATE KEY-----');
  assert.throws(() => validate(website, source), /Credential/);
});
test('reject directory symlinks in artifact and at build output', t => {
  const { directory, website } = fixture(t);
  rmSync(resolve(website, 'branding'), { recursive: true });
  symlinkSync(resolve(site, 'branding'), resolve(website, 'branding'), 'junction');
  assert.throws(() => validate(website, source), /Symlink/);
  symlinkSync(website, resolve(directory, '.pages-dist'), 'junction');
  assert.throws(() => cleanOutput(directory), /Symlink/);
  assert.ok(existsSync(resolve(website, 'index.html')));
});
test('post-CP0B byte mutation is detected even if site remains structurally valid', t => {
  const { website } = fixture(t);
  const before = validate(website, source);
  writeFileSync(resolve(website, 'favicon.svg'), '<svg/>');
  assert.throws(() => assertSame(validate(website, source), before), /Artifact changed/);
});
test('rollback trusts only successful original manual main release runs', () => {
  const repository = 'owner/repo';
  const run = { id: 123, repository: { full_name: repository }, head_repository: { full_name: repository },
    path: '.github/workflows/release-pages.yml', event: 'workflow_dispatch', head_branch: 'main',
    status: 'completed', conclusion: 'success', run_attempt: 1, head_sha: source };
  validateRun(run, repository, '123');
  for (const bad of [{ conclusion: 'failure' }, { head_branch: 'feature' }, { event: 'pull_request' },
    { path: '.github/workflows/ci.yml' }, { run_attempt: 2 }, { repository: { full_name: 'foreign/repo' } }]) {
    assert.throws(() => validateRun({ ...run, ...bad }, repository, '123'));
  }
});
test('rollback verifies historical provenance, gate, SHA and checksum without a build', t => {
  const { website } = fixture(t);
  const info = json(resolve(website, 'build-info.json'));
  writeJson(resolve(website, 'build-info.json'), { ...info, workflow: 'Release GitHub Pages', runId: '123', runAttempt: '1' });
  const manifest = validate(website, source);
  const selection = { repository: 'owner/repo', runId: '123', sourceSha: source };
  const evidence = { schemaVersion: 1, kind: 'r1-release', gate: 'npm run verify', gateResult: 'success',
    repository: selection.repository, runId: '123', runAttempt: '1', sourceSha: source, ...manifest };
  validateEvidence(evidence, selection, website);
  for (const bad of [{ gateResult: 'failure' }, { sourceSha: '0'.repeat(40) }, { runId: '124' }, { checksum: '0'.repeat(64) }]) {
    assert.throws(() => validateEvidence({ ...evidence, ...bad }, selection, website));
  }
});
test('canonical gate still has one build followed by unchanged CP0B entry', () => {
  const pkg = json(resolve(root, 'package.json'));
  assert.equal(pkg.scripts.test, 'npm run verify');
  assert.equal((pkg.scripts.verify.match(/npm run build(?: |$)/g) || []).length, 1);
  assert.ok(pkg.scripts.verify.endsWith('npm run build && npm run test:browser'));
  assert.equal(pkg.scripts['test:browser'], 'playwright test');
  assert.ok(readFileSync(resolve(root, 'playwright.config.ts'), 'utf8').includes('/vermoegensnavigator/'));
});
