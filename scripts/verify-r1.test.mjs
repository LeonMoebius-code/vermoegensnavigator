import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertSame, buildHash, cleanOutput, json, root, sha256, site, validate, writeJson } from './release-artifact.mjs';
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

function historicalFixture(t) {
  const copy = fixture(t);
  const info = json(resolve(copy.website, 'build-info.json'));
  writeJson(resolve(copy.website, 'build-info.json'), { ...info, workflow: 'Release GitHub Pages', runId: '123', runAttempt: '1' });
  const selection = { repository: 'owner/repo', runId: '123', sourceSha: source };
  const evidence = { schemaVersion: 1, kind: 'r1-release', gate: 'npm run verify', gateResult: 'success',
    ...selection, runAttempt: '1', ...validate(copy.website, source) };
  return { ...copy, selection, evidence };
}

// Independently record fixture bytes, including adversarial content, so safety
// tests cannot pass merely because the file is absent from the saved manifest.
function recordFile(evidence, website, path) {
  const body = readFileSync(resolve(website, path));
  evidence.files = evidence.files.filter(file => file.path !== path);
  evidence.files.push({ path, bytes: body.length, sha256: sha256(body) });
  evidence.files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  evidence.checksum = sha256(JSON.stringify(evidence.files));
}

test('historical release survives later added/removed assets and evolved candidate provenance', async t => {
  const { directory, website, selection, evidence } = historicalFixture(t);
  const saved = JSON.stringify(evidence);
  // Simulate a later production validator, without mutating the real contract.
  const validatorPath = resolve(directory, 'future-release-artifact.mjs');
  const currentCode = readFileSync(resolve(root, 'scripts/release-artifact.mjs'), 'utf8');
  const futureCode = currentCode.replace("'favicon.svg', 'index.html'", "'new.css', 'index.html'")
    .replace("'schemaVersion','sourceSha'", "'releaseFormat','schemaVersion','sourceSha'");
  assert.notEqual(futureCode, currentCode);
  writeFileSync(validatorPath, futureCode);
  const future = await import(pathToFileURL(validatorPath).href);
  assert.throws(() => future.validate(website, source), /Unexpected|Incomplete/);
  assert.deepEqual(validateEvidence(evidence, selection, website).files, evidence.files);

  const futureSite = resolve(directory, 'future-site');
  cpSync(website, futureSite, { recursive: true });
  rmSync(resolve(futureSite, 'favicon.svg'));
  writeFileSync(resolve(futureSite, 'new.css'), 'body {}');
  assert.throws(() => future.validate(futureSite, source), /provenance fields/);
  writeJson(resolve(futureSite, 'build-info.json'), { ...evidence.provenance, releaseFormat: 'next' });
  future.validate(futureSite, source);
  assert.throws(() => validate(futureSite, source), /Unexpected/);
  assertSame(validateEvidence(evidence, selection, website), validate(website, source));
  assert.equal(JSON.stringify(evidence), saved);
});

test('historical rollback validates v1 without the current release module', async t => {
  const { directory, website, selection, evidence } = historicalFixture(t);
  const isolated = resolve(directory, 'isolated-rollback');
  mkdirSync(isolated);
  for (const name of ['historical-release-artifact.mjs', 'prepare-pages-rollback.mjs']) {
    const original = resolve(root, 'scripts', name);
    assert.doesNotMatch(readFileSync(original, 'utf8'), /(?:from\s*|import\s*\()\s*['"][^'"]*\/release-artifact\.mjs['"]/);
    cpSync(original, resolve(isolated, name));
  }
  assert.ok(!existsSync(resolve(isolated, 'release-artifact.mjs')));
  const rollback = await import(pathToFileURL(resolve(isolated, 'prepare-pages-rollback.mjs')).href);
  assert.deepEqual(rollback.validateEvidence(evidence, selection, website).files, evidence.files);
});

test('historical file layout is defined by evidence, including former nested assets', t => {
  const { website, selection, evidence } = historicalFixture(t);
  rmSync(resolve(website, 'favicon.svg'));
  evidence.files = evidence.files.filter(file => file.path !== 'favicon.svg');
  mkdirSync(resolve(website, 'assets/old'), { recursive: true });
  writeFileSync(resolve(website, 'assets/old/icon.svg'), '<svg/>');
  recordFile(evidence, website, 'assets/old/icon.svg');
  assert.throws(() => validate(website, source), /Unexpected/);
  assert.deepEqual(validateEvidence(evidence, selection, website).files, evidence.files);
});

test('historical manifest rejects changed sizes, hashes, ordering and duplicate paths', t => {
  const { website, selection, evidence } = historicalFixture(t);
  for (const change of [files => { files[0].bytes++; }, files => { files[0].sha256 = '0'.repeat(64); },
    files => files.reverse(), files => files.push(files[0])]) {
    const tampered = structuredClone(evidence);
    change(tampered.files);
    tampered.checksum = sha256(JSON.stringify(tampered.files));
    assert.throws(() => validateEvidence(tampered, selection, website));
  }
});

for (const mutation of ['changed', 'missing', 'additional']) {
  test(`historical manifest rejects ${mutation} file`, t => {
    const { website, selection, evidence } = historicalFixture(t);
    if (mutation === 'changed') writeFileSync(resolve(website, 'favicon.svg'), '<svg/>');
    if (mutation === 'missing') rmSync(resolve(website, 'favicon.svg'));
    if (mutation === 'additional') writeFileSync(resolve(website, 'new.css'), 'body {}');
    assert.throws(() => validateEvidence(evidence, selection, website), /Artifact changed/);
  });
}

for (const [field, value] of Object.entries({ schemaVersion: 2, kind: 'r1-rollback', gate: 'npm test', gateResult: 'failure',
  repository: 'foreign/repo', runId: '124', runAttempt: '2', sourceSha: '0'.repeat(40),
  algorithm: 'unknown', checksum: '0'.repeat(64), provenance: {} })) {
  test(`historical evidence rejects manipulated ${field}`, t => {
    const { website, selection, evidence } = historicalFixture(t);
    assert.throws(() => validateEvidence({ ...evidence, [field]: value }, selection, website));
  });
}

for (const [field, value] of Object.entries({ schemaVersion: 2, sourceSha: '0'.repeat(40), workflow: 'Feature CI',
  runId: '124', runAttempt: '2', lockfileSha256: 'invalid', unexpected: true })) {
  test(`historical provenance rejects ${field} even with matching manifest/evidence`, t => {
    const { website, selection, evidence } = historicalFixture(t);
    evidence.provenance = { ...evidence.provenance, [field]: value };
    writeJson(resolve(website, 'build-info.json'), evidence.provenance);
    recordFile(evidence, website, 'build-info.json');
    assert.throws(() => validateEvidence(evidence, selection, website), /historical|Historical/);
  });
}

for (const path of ['../outside', '/absolute', 'a//b', 'a/./b', 'a/../b', 'C:/outside', 'a\\b', '.git/config', '.github/workflows/run.yml', 'nested/.GiT/config']) {
  test(`historical evidence cannot authorize unsafe path: ${path}`, t => {
    const { website, selection, evidence } = historicalFixture(t);
    evidence.files = [{ path, bytes: 1, sha256: '0'.repeat(64) }];
    assert.throws(() => validateEvidence(evidence, selection, website), /Unsafe historical path/);
  });
}

test('historical traversal rejects forbidden directories independently of evidence', t => {
  const { website, selection, evidence } = historicalFixture(t);
  mkdirSync(resolve(website, '.github'));
  assert.throws(() => validateEvidence(evidence, selection, website), /Unsafe historical path/);
});

test('historical traversal rejects symlinks, root symlinks and hardlinks', t => {
  const { directory, website, selection, evidence } = historicalFixture(t);
  symlinkSync(website, resolve(directory, 'linked-site'), 'junction');
  assert.throws(() => validateEvidence(evidence, selection, resolve(directory, 'linked-site')), /artifact root/);
  rmSync(resolve(website, 'branding'), { recursive: true });
  symlinkSync(resolve(site, 'branding'), resolve(website, 'branding'), 'junction');
  assert.throws(() => validateEvidence(evidence, selection, website), /symlink/);
  rmSync(resolve(website, 'branding'));
  cpSync(resolve(site, 'branding'), resolve(website, 'branding'), { recursive: true });
  linkSync(resolve(website, 'favicon.svg'), resolve(directory, 'hardlink.svg'));
  assert.throws(() => validateEvidence(evidence, selection, website), /hardlink/);
});

test('historical safety rejects credential signatures even when evidence records them', t => {
  const { website, selection, evidence } = historicalFixture(t);
  writeFileSync(resolve(website, 'favicon.svg'), '-----BEGIN PRIVATE KEY-----');
  recordFile(evidence, website, 'favicon.svg');
  assert.throws(() => validateEvidence(evidence, selection, website), /Credential signature/);
});

test('historical traversal and manifest enforce size and entry limits', t => {
  const { website, selection, evidence } = historicalFixture(t);
  truncateSync(resolve(website, 'favicon.svg'), 10 * 1024 * 1024 + 1);
  assert.throws(() => validateEvidence(evidence, selection, website), /Oversized/);
  const oversized = structuredClone(evidence);
  oversized.files[0].bytes = 10 * 1024 * 1024 + 1;
  assert.throws(() => validateEvidence(oversized, selection, website), /size\/hash/);
  oversized.files = Array.from({ length: 11 }, (_, i) => ({ path: `file-${String(i).padStart(2, '0')}`, bytes: 10 * 1024 * 1024, sha256: '0'.repeat(64) }));
  assert.throws(() => validateEvidence(oversized, selection, website), /Oversized historical website/);
  oversized.files = Array(1001).fill(evidence.files[0]);
  assert.throws(() => validateEvidence(oversized, selection, website), /file manifest/);
});
test('canonical gate still has one build followed by unchanged CP0B entry', () => {
  const pkg = json(resolve(root, 'package.json'));
  assert.equal(pkg.scripts.test, 'npm run verify');
  assert.equal((pkg.scripts.verify.match(/npm run build(?: |$)/g) || []).length, 1);
  assert.ok(pkg.scripts.verify.endsWith('npm run build && npm run test:browser'));
  assert.equal(pkg.scripts['test:browser'], 'playwright test');
  assert.ok(readFileSync(resolve(root, 'playwright.config.ts'), 'utf8').includes('/vermoegensnavigator/'));
});
