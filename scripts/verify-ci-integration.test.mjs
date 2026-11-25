import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectCheckout, verifyIdentity } from './verify-ci-checkout-identity.mjs';
import { requiredSteps, coreCommands, assertSteps, assertNeeds, assertJobResults, assertShardReceipts, assertCurrentRefs, run } from './verify-ci-integration.mjs';
import { partition, shards, validateReport } from './ci-browser-shards.mjs';

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
    GITHUB_WORKFLOW: 'Feature CI', GITHUB_JOB: 'core', GITHUB_WORKFLOW_SHA: merge,
    GITHUB_WORKFLOW_REF: `${repository}/.github/workflows/ci.yml@refs/pull/9/merge`,
    GITHUB_REF: 'refs/pull/9/merge', GITHUB_SHA: merge, GITHUB_BASE_REF: 'main', GITHUB_HEAD_REF: 'work/test',
    GITHUB_RUN_ID: '234', GITHUB_RUN_ATTEMPT: '1', GITHUB_EVENT_PATH: join(temp, 'event.json'),
    RUNNER_TEMP: temp, GITHUB_OUTPUT: join(temp, 'output'), GITHUB_STEP_SUMMARY: join(temp, 'summary') };
  const event = { repository: { full_name: repository }, action: 'synchronize', number: 9,
    pull_request: { number: 9, state: 'open', base: { sha: base, ref: 'main', repo: { full_name: repository } }, head: { sha: head, ref: 'work/test' } } };
  writeFileSync(env.GITHUB_EVENT_PATH, JSON.stringify(event));
  const identity = verifyIdentity(env, event, inspectCheckout(cwd));
  writeFileSync(join(temp, 'ci-checkout-identity/identity.json'), JSON.stringify(identity));
  const steps = passingSteps('core');
  env.GOV05_STEP_RESULTS = JSON.stringify(steps);
  const refs = { 'refs/heads/main': base, 'refs/pull/9/head': head, 'refs/pull/9/merge': merge };
  return { cwd, git, env, steps, refs, identity };
}

function passingSteps(role) {
  return Object.fromEntries(Object.keys(requiredSteps[role]).map(id => [id, { outcome: 'success', conclusion: 'success' }]));
}

const allSuccessful = Object.fromEntries(['build', 'core', 'browser'].map(job => [job, { result: 'success' }]));

function browserFixture(identity) {
  const cases = shards.map(shard => ({
    id: 'chromium-case-' + shard, project: 'chromium', file: 'tests/browser/case.spec.ts',
    title: ['parameter group', 'age ' + shard], expected: 'passed',
  }));
  const inventory = partition(cases, cases.map(item => [item]));
  const binding = { schema: 1, inventory: 'inventory digest', plan: 'plan digest', build: 'build digest' };
  const receipts = shards.map(shard => ({
    schema: 1, identity: { ...identity, workflow: { ...identity.workflow, job: 'browser' } },
    steps: passingSteps('browser'), binding, shard, total: shards.length, passed: inventory.shardIds[shard - 1],
  }));
  return { cases, inventory, binding, receipts };
}

test('the core receipt proves real checkout, required steps and current remote refs', async t => {
  const f = fixture(t);
  const receipt = await run('receipt', f.env, f.cwd);
  assert.deepEqual(receipt, { schema: 1, identity: f.identity, steps: f.steps });
  assert.equal(readFileSync(f.env.GITHUB_OUTPUT, 'utf8'), 'receipt=' + JSON.stringify(receipt) + '\n');
  writeFileSync(join(f.env.RUNNER_TEMP, 'ci-checkout-identity/identity.json'), '{}');
  await assert.rejects(run('receipt', f.env, f.cwd), /Original checkout evidence changed/);
});

test('failed, skipped, missing, neutral and cancelled jobs cannot release the gate', () => {
  assert.doesNotThrow(() => assertNeeds(allSuccessful));
  for (const job of Object.keys(allSuccessful)) {
    for (const state of ['failure', 'skipped', 'cancelled', 'neutral', '', undefined]) {
      assert.throws(() => assertNeeds({ ...allSuccessful, [job]: { result: state } }), /Mandatory job/);
    }
    assert.throws(() => assertNeeds({ ...allSuccessful, [job]: undefined }), /Mandatory job/);
  }
});

test('every required step rejects missing, masked and non-successful results', () => {
  for (const role of Object.keys(requiredSteps)) {
    assert.deepEqual(assertSteps(role, passingSteps(role)), passingSteps(role));
    for (const step of Object.keys(requiredSteps[role])) {
      for (const state of ['failure', 'skipped', 'cancelled', 'neutral', undefined]) {
        assert.throws(() => assertSteps(role, { ...passingSteps(role), [step]: { outcome: state, conclusion: 'success' } }), /did not succeed/);
        assert.throws(() => assertSteps(role, { ...passingSteps(role), [step]: { outcome: 'success', conclusion: state } }), /conclusion/);
      }
      const missing = passingSteps(role);
      delete missing[step];
      assert.throws(() => assertSteps(role, missing), /did not succeed/);
    }
  }
});

test('separate actual Actions jobs and steps are required for all four shards in the same attempt', t => {
  const { identity } = fixture(t);
  const jobs = [
    ['build', 'Build, Browserinventar und R1'], ['core', 'Fachtests und Typecheck'],
    ...shards.map(shard => ['browser', 'Browser-Shard ' + shard + '/4']),
  ].map(([role, name], i) => ({
    id: i + 1, name, run_id: Number(identity.run.id), run_attempt: Number(identity.run.attempt),
    workflow_name: 'Feature CI', head_sha: identity.feature_head, status: 'completed', conclusion: 'success',
    steps: [...Object.values(requiredSteps[role]), 'Pflichtschritte und Identität bestätigen',
      ...(role === 'browser' ? ['Browsernachweis bereitstellen'] : [])]
      .map(step => ({ name: step, status: 'completed', conclusion: 'success' })),
  }));
  assert.doesNotThrow(() => assertJobResults(jobs, identity));
  const mutations = [
    job => { job.run_id++; }, job => { job.run_attempt++; },
    job => { job.head_sha = identity.base; }, job => { job.status = 'queued'; },
    ...['failure', 'skipped', 'cancelled', 'neutral'].map(status => job => { job.conclusion = status; }),
    job => { job.steps.pop(); }, job => { job.steps[0].conclusion = 'skipped'; },
    job => { job.steps[0].status = 'queued'; }, job => { job.name = jobs[0].name; },
    job => { job.id = jobs[0].id; },
  ];
  for (const mutate of mutations) {
    const wrong = structuredClone(jobs);
    mutate(wrong.at(-1));
    assert.throws(() => assertJobResults(wrong, identity));
  }
  assert.throws(() => assertJobResults(jobs.slice(1), identity), /Missing or duplicate/);
});

test('the discovery inventory and actual Playwright results match exact parameterized identities', t => {
  const { cases } = browserFixture(fixture(t).identity);
  const split = cases.map(item => [item]);
  assert.throws(() => partition(cases, [[cases[0]], [cases[0]], ...split.slice(2)]), /duplicate/);
  assert.throws(() => partition(cases, split.slice(1)), /number/);
  assert.throws(() => partition(cases, [...split.slice(0, 3), []]), /Empty/);
  const report = { status: 'passed', cases, results: cases.map(item => ({ id: item.id, expected: 'passed', status: 'passed' })) };
  assert.deepEqual(validateReport(cases, report), cases.map(item => item.id));
  const changes = [
    r => { r.status = 'interrupted'; }, r => { r.results = undefined; },
    r => { r.results.pop(); }, r => { r.results.push(r.results[0]); },
    r => { r.results[0].id = 'foreign'; }, r => { r.results[0].expected = 'failed'; },
    ...['skipped', 'timedOut', 'failed', 'interrupted'].map(status => r => { r.results[0].status = status; }),
    r => { r.cases[0].file = 'tests/browser/other.spec.ts'; },
    r => { r.cases[0].project = 'foreign'; }, r => { r.cases[0].title = ['wrong parameter']; },
    r => { r.cases[0].expected = 'skipped'; },
  ];
  for (const mutate of changes) {
    const wrong = structuredClone(report); mutate(wrong);
    assert.throws(() => validateReport(cases, wrong));
  }
});

test('gate verifies all four receipts, shard assignment, successful cases and bound identities', t => {
  const { identity } = fixture(t);
  const { inventory, binding, receipts } = browserFixture(identity);
  assert.deepEqual(assertShardReceipts(receipts, identity, binding, inventory), [1, 1, 1, 1]);
  for (const bad of [[], receipts.slice(1), [...receipts.slice(1), receipts.at(-1)]]) {
    assert.throws(() => assertShardReceipts(bad, identity, binding, inventory));
  }
  const changes = [
    r => { r.shard = 5; }, r => { r.total = 3; }, r => { r.schema = 2; },
    r => { r.binding.build = 'wrong build'; }, r => { r.binding.inventory = 'foreign plan'; },
    r => { r.identity.run.id = '999'; }, r => { r.identity.run.attempt = '2'; },
    r => { r.identity.tree = 'f'.repeat(40); }, r => { r.identity.actual_checkout = identity.base; },
    r => { r.passed = []; }, r => { r.passed.push(r.passed[0]); },
    r => { r.passed = receipts[1].passed; }, r => { r.steps.browser.outcome = 'failure'; },
  ];
  for (const mutate of changes) {
    const wrong = structuredClone(receipts); mutate(wrong[0]);
    assert.throws(() => assertShardReceipts(wrong, identity, binding, inventory));
  }
});

for (const ref of ['refs/heads/main', 'refs/pull/9/head', 'refs/pull/9/merge']) {
  test('changed or missing ' + ref + ' blocks the full gate', async t => {
    const f = fixture(t);
    assert.throws(() => assertCurrentRefs(f.identity, { ...f.refs, [ref]: 'f'.repeat(40) }));
    const missing = { ...f.refs }; delete missing[ref]; assert.throws(() => assertCurrentRefs(f.identity, missing));
    f.git('update-ref', ref, ref.endsWith('/head') ? f.identity.base : f.identity.feature_head);
    await assert.rejects(run('receipt', f.env, f.cwd), /changed or missing/);
  });
}

test('gate process exits nonzero for a skipped job or a non-PR event', t => {
  const f = fixture(t);
  const script = fileURLToPath(new URL('./verify-ci-integration.mjs', import.meta.url));
  const env = { ...process.env, ...f.env, GITHUB_JOB: 'integration', GOV05_NEEDS: JSON.stringify({ ...allSuccessful, browser: { result: 'skipped' } }) };
  const result = spawnSync(process.execPath, [script, 'needs'], { cwd: f.cwd, env });
  assert.equal(result.status, 1);
  assert.match(result.stderr.toString(), /Mandatory job did not succeed/);
  const push = spawnSync(process.execPath, [script, 'gate'], { cwd: f.cwd, env: { ...env, GITHUB_EVENT_NAME: 'push' } });
  assert.equal(push.status, 1);
  assert.match(push.stderr.toString(), /Only regular PR CI/);
});

test('conditional updates in a synthetic repository bind absence and exact prior head', t => {
  const { git, identity } = fixture(t);
  const ref = 'refs/heads/work/transport';
  const { base, feature_head: head } = identity;
  const noHead = '0'.repeat(40);
  const originalTree = git('rev-parse', head + '^{tree}');
  const remote = git('commit-tree', originalTree, '-p', base, '-m', 'alternate commit metadata');
  assert.notEqual(remote, head);
  assert.equal(git('rev-parse', remote + '^{tree}'), originalTree);
  assert.equal(git('rev-parse', remote + '^'), git('rev-parse', head + '^'));
  git('merge-base', '--is-ancestor', base, remote);
  git('update-ref', ref, remote, noHead);
  assert.throws(() => git('update-ref', ref, head, noHead));
  const next = git('commit-tree', originalTree, '-p', remote, '-m', 'correction');
  git('merge-base', '--is-ancestor', remote, next);
  git('update-ref', ref, next, remote);
  assert.throws(() => git('update-ref', ref, remote, head));
  assert.equal(git('rev-parse', ref), next);
});

test('workflows keep the required context exclusive, unconditional and fail closed', () => {
  const workflow = name => readFileSync(new URL('../.github/workflows/' + name + '.yml', import.meta.url), 'utf8');
  const full = workflow('ci');
  const fast = workflow('development-ci');
  const context = 'Tests, Typecheck, Build und Browser';
  assert.equal(full.split(context).length, 2);
  assert.match(full, /on:\n  pull_request:\n    branches:\n      - main\n/);
  assert.doesNotMatch(full, /^  (push|workflow_dispatch|pull_request_target):/m);
  assert.doesNotMatch(full, /paths:|paths-ignore:|continue-on-error:|\[skip ci\]/);
  assert.match(full, /name: Tests, Typecheck, Build und Browser\n    if: \$\{\{ always\(\) \}\}\n    needs: \[build, core, browser\]/);
  for (const [role, steps] of Object.entries(requiredSteps)) {
    const job = full.split('\n  ' + role + ':\n')[1].split(/\n  \w+:\n/)[0];
    for (const [id, name] of Object.entries(steps)) assert.ok(job.includes('name: ' + name + '\n        id: ' + id + '\n'));
    assert.match(job, /GOV05_STEP_RESULTS: \$\{\{ toJSON\(steps\) \}\}/);
    assert.match(job, /node scripts\/verify-ci-integration\.mjs receipt/);
  }
  assert.match(full, /shard: \[1, 2, 3, 4\]/);
  assert.match(full, /GOV05_NEEDS: \$\{\{ toJSON\(needs\) \}\}/);
  assert.match(full, /node scripts\/verify-ci-integration\.mjs gate/);
  assert.equal((full.match(/run: npm run build\n/g) ?? []).length, 1);
  assert.match(full, /test:browser -- --shard=/);
  assert.match(fast, /on:\n  push:\n    branches:\n      - "work\/\*\*"/);
  assert.doesNotMatch(fast, /Tests, Typecheck, Build und Browser|pull_request:|playwright install|verify-release-artifact|verify-r1.test/);
  for (const name of ['release-pages', 'rollback-pages']) {
    assert.ok(!workflow(name).includes(context));
    assert.match(workflow(name), /on:\n  workflow_dispatch:/);
  }
  assert.match(workflow('release-pages'), /run: npm run verify\n/);
  assert.ok(fast.includes('npm run verify:development'));
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  for (const command of ['npm run typecheck', 'npm run test:h2-financial-data', 'npm run test:p1-case-store', 'npm run test:ap01a-direct-grant', 'npm run test:ap01b-old-riester']) assert.ok(pkg.scripts['verify:development'].includes(command));
  assert.doesNotMatch(pkg.scripts['verify:development'], /npm run (build|test:browser|verify)(?:\s|$)/);
  assert.match(full, /run: node scripts\/verify-ci-integration\.mjs core/);
  const core = coreCommands(pkg.scripts.verify);
  assert.deepEqual(core.map(name => 'npm run ' + name), pkg.scripts.verify.split(' && ').slice(0, -2));
  assert.equal(core.at(-1), 'typecheck');
  assert.throws(() => coreCommands('npm run typecheck && npm run test:browser'));
  assert.throws(() => coreCommands('npm run typecheck && echo bypass && npm run build && npm run test:browser'));
});
