import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectCheckout, verifyIdentity } from './verify-ci-checkout-identity.mjs';
import { mandatorySteps, assertSteps, receiptFor, assertGate, assertCurrentRefs, run } from './verify-ci-integration.mjs';

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'ci-integration-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main'); git('config', 'user.name', 'Synthetic CI'); git('config', 'user.email', 'ci@example.invalid');
  writeFileSync(join(cwd, 'base'), 'base'); git('add', '.'); git('commit', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  git('switch', '-c', 'work/test'); writeFileSync(join(cwd, 'feature'), 'feature'); git('add', '.'); git('commit', '-m', 'head');
  const head = git('rev-parse', 'HEAD');
  const merge = git('commit-tree', git('rev-parse', 'HEAD^{tree}'), '-p', base, '-p', head, '-m', 'synthetic merge');
  git('checkout', '--detach', merge);
  git('update-ref', 'refs/pull/9/head', head); git('update-ref', 'refs/pull/9/merge', merge); git('remote', 'add', 'origin', cwd);
  const temp = join(cwd, 'temp'); mkdirSync(join(temp, 'ci-checkout-identity'), { recursive: true });
  const repository = 'LeonMoebius-code/vermoegensnavigator';
  const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: repository, GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_WORKFLOW: 'Feature CI', GITHUB_JOB: 'verify', GITHUB_WORKFLOW_SHA: merge,
    GITHUB_WORKFLOW_REF: `${repository}/.github/workflows/ci.yml@refs/pull/9/merge`,
    GITHUB_REF: 'refs/pull/9/merge', GITHUB_SHA: merge, GITHUB_BASE_REF: 'main', GITHUB_HEAD_REF: 'work/test',
    GITHUB_RUN_ID: '234', GITHUB_RUN_ATTEMPT: '1', GITHUB_EVENT_PATH: join(temp, 'event.json'),
    RUNNER_TEMP: temp, GITHUB_OUTPUT: join(temp, 'output'), GITHUB_STEP_SUMMARY: join(temp, 'summary') };
  const event = { repository: { full_name: repository }, action: 'synchronize', number: 9,
    pull_request: { number: 9, state: 'open', base: { sha: base, ref: 'main', repo: { full_name: repository } }, head: { sha: head, ref: 'work/test' } } };
  writeFileSync(env.GITHUB_EVENT_PATH, JSON.stringify(event));
  const identity = verifyIdentity(env, event, inspectCheckout(cwd));
  writeFileSync(join(temp, 'ci-checkout-identity/identity.json'), JSON.stringify(identity));
  const steps = Object.fromEntries(mandatorySteps.map(name => [name, { outcome: 'success', conclusion: 'success' }]));
  env.CI_STEP_RESULTS = JSON.stringify(steps);
  const refs = { 'refs/heads/main': base, 'refs/pull/9/head': head, 'refs/pull/9/merge': merge };
  return { cwd, git, env, steps, refs, identity };
}

test('complete and required gate bind real merge, live refs, run and attempt', t => {
  const f = fixture(t);
  const receipt = run('complete', f.env, f.cwd);
  assert.equal(readFileSync(f.env.GITHUB_OUTPUT, 'utf8'), `receipt=${JSON.stringify(receipt)}\n`);
  assert.deepEqual(run('gate', { ...f.env, GITHUB_JOB: 'integration', CI_VERIFY_RESULT: 'success', CI_VERIFY_RECEIPT: JSON.stringify(receipt) }, f.cwd), receipt);
});
for (const state of ['failure', 'skipped', 'cancelled', 'neutral', '', undefined]) {
  test(`required gate rejects upstream result ${state}`, t => {
    const f = fixture(t); assert.throws(() => assertGate(state, receiptFor(f.identity), f.identity));
  });
}
for (const step of mandatorySteps) {
  test(`mandatory ${step} cannot skip, fail, disappear or mask failure`, t => {
    const f = fixture(t);
    for (const state of ['failure', 'skipped', 'cancelled', 'neutral', undefined]) {
      const steps = structuredClone(f.steps); steps[step] = { outcome: state, conclusion: 'success' };
      assert.throws(() => assertSteps(steps));
      delete steps[step]; assert.throws(() => assertSteps(steps));
    }
  });
}
for (const key of ['merge', 'head', 'base', 'tree', 'run_id', 'run_attempt', 'complete', 'schema_version']) {
  test(`receipt rejects stale or changed ${key}`, t => {
    const f = fixture(t); const receipt = receiptFor(f.identity); receipt[key] = 'wrong';
    assert.throws(() => assertGate('success', receipt, f.identity));
  });
}
test('success without receipt and development evidence cannot release integration', t => {
  const f = fixture(t); assert.throws(() => assertGate('success', null, f.identity));
  assert.throws(() => receiptFor({ ...f.identity, validation_scope: 'development' }));
  assert.throws(() => receiptFor({ ...f.identity, event: { classification: 'regular_push' } }));
});
for (const ref of ['refs/heads/main', 'refs/pull/9/head', 'refs/pull/9/merge']) {
  test(`changed or missing ${ref} blocks the full gate`, t => {
    const f = fixture(t);
    assert.throws(() => assertCurrentRefs(f.identity, { ...f.refs, [ref]: 'f'.repeat(40) }));
    const missing = { ...f.refs }; delete missing[ref]; assert.throws(() => assertCurrentRefs(f.identity, missing));
    f.git('update-ref', ref, ref.endsWith('/head') ? f.identity.base : f.identity.feature_head);
    assert.throws(() => run('complete', f.env, f.cwd), /changed or missing/);
  });
}
test('gate process exits nonzero for a skipped full job', t => {
  const f = fixture(t);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./verify-ci-integration.mjs', import.meta.url)), 'gate'], {
    cwd: f.cwd, env: { ...process.env, ...f.env, GITHUB_JOB: 'integration', CI_VERIFY_RESULT: 'skipped' },
  });
  assert.notEqual(result.status, 0);
});
test('workflows keep the required context exclusive, unconditional and fail closed', () => {
  const full = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const fast = readFileSync(new URL('../.github/workflows/development-ci.yml', import.meta.url), 'utf8');
  assert.match(full, /on:\n  pull_request:\n    branches:\n      - main\n/);
  assert.doesNotMatch(full, /^  (push|workflow_dispatch|pull_request_target):/m);
  assert.doesNotMatch(full, /paths:|paths-ignore:|continue-on-error:|\[skip ci\]/);
  assert.match(full, /name: Tests, Typecheck, Build und Browser\n    if: \$\{\{ always\(\) \}\}\n    needs: verify/);
  for (const id of mandatorySteps) assert.ok(full.includes(`id: ${id}\n`));
  assert.match(full, /CI_STEP_RESULTS: \$\{\{ toJSON\(steps\) \}\}/);
  assert.match(full, /CI_VERIFY_RESULT: \$\{\{ needs.verify.result \}\}/);
  assert.match(full, /CI_VERIFY_RECEIPT: \$\{\{ needs.verify.outputs.receipt \}\}/);
  assert.ok(full.includes('node scripts/verify-ci-integration.mjs complete'));
  assert.ok(full.includes('node scripts/verify-ci-integration.mjs gate'));
  assert.match(fast, /on:\n  push:\n    branches:\n      - "work\/\*\*"/);
  assert.doesNotMatch(fast, /Tests, Typecheck, Build und Browser|pull_request:|playwright install|verify-release-artifact|verify-r1.test/);
  assert.ok(fast.includes('npm run verify:development'));
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  for (const command of ['npm run typecheck', 'npm run test:h2-financial-data', 'npm run test:p1-case-store', 'npm run test:ap01a-direct-grant', 'npm run test:ap01b-old-riester']) assert.ok(pkg.scripts['verify:development'].includes(command));
  assert.doesNotMatch(pkg.scripts['verify:development'], /npm run (build|test:browser|verify)(?:\s|$)/);
});
