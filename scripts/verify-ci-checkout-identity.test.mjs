import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectCheckout, verifyIdentity, run } from './verify-ci-checkout-identity.mjs';

const script = fileURLToPath(new URL('./verify-ci-checkout-identity.mjs', import.meta.url));
const repository = 'LeonMoebius-code/vermoegensnavigator';
const other = 'f'.repeat(40);
// Real synthetic Git objects, including a genuine two-parent merge.
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'ci-identity-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Synthetic CI test');
  git('config', 'user.email', 'ci-test@example.invalid');
  writeFileSync(join(directory, 'base.txt'), 'synthetic base\n');
  git('add', '.'); git('commit', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  git('switch', '-c', 'work/test');
  writeFileSync(join(directory, 'feature.txt'), 'synthetic feature\n');
  git('add', '.'); git('commit', '-m', 'feature');
  const head = git('rev-parse', 'HEAD');
  git('switch', 'main'); git('merge', '--no-ff', 'work/test', '-m', 'synthetic PR merge');
  const merge = git('rev-parse', 'HEAD');
  const temp = join(directory, 'runner-temp'); mkdirSync(temp);
  const env = {
    GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: repository, GITHUB_WORKFLOW: 'Feature CI', GITHUB_JOB: 'verify',
    GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', GITHUB_WORKFLOW_SHA: merge,
    GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF: 'refs/pull/76/merge', GITHUB_SHA: merge,
    GITHUB_BASE_REF: 'main', GITHUB_HEAD_REF: 'work/test', RUNNER_TEMP: temp,
    GITHUB_EVENT_PATH: join(temp, 'event.json'), GITHUB_STEP_SUMMARY: join(temp, 'summary.md'),
  };
  env.GITHUB_WORKFLOW_REF = `${repository}/.github/workflows/ci.yml@${env.GITHUB_REF}`;
  const event = {
    repository: { full_name: repository }, action: 'synchronize', number: 76,
    pull_request: { number: 76, state: 'open', base: { sha: base, ref: 'main', repo: { full_name: repository } }, head: { sha: head, ref: 'work/test' } },
  };
  return { directory, git, base, head, merge, env, event };
}
function push(f) {
  f.git('checkout', '--detach', f.head);
  Object.assign(f.env, { GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/work/test', GITHUB_SHA: f.head });
  f.env.GITHUB_WORKFLOW_REF = `${repository}/.github/workflows/ci.yml@${f.env.GITHUB_REF}`;
  f.event = { repository: { full_name: repository }, ref: f.env.GITHUB_REF, after: f.head, deleted: false };
}
function check(f) { return verifyIdentity(f.env, f.event, inspectCheckout(f.directory)); }

test('valid push accepts actual commit, parent and tree', t => {
  const f = fixture(t); push(f);
  const result = check(f);
  assert.equal(result.actual_checkout, f.head);
  assert.deepEqual(result.parents, [f.base]);
  assert.equal(result.tree, f.git('rev-parse', 'HEAD^{tree}'));
  assert.equal(result.event.classification, 'regular_push');
});
test('development push binds its own workflow, job and limited scope', t => {
  const f = fixture(t); push(f);
  Object.assign(f.env, { GITHUB_WORKFLOW: 'Development CI', GITHUB_JOB: 'fast' });
  f.env.GITHUB_WORKFLOW_REF = `${repository}/.github/workflows/development-ci.yml@${f.env.GITHUB_REF}`;
  const result = check(f);
  assert.equal(result.validation_scope, 'development');
  assert.equal(result.workflow.path, '.github/workflows/development-ci.yml');
  assert.equal(result.event.classification, 'regular_push');
});
test('development workflow cannot provide PR evidence', t => {
  const f = fixture(t);
  Object.assign(f.env, { GITHUB_WORKFLOW: 'Development CI', GITHUB_JOB: 'fast' });
  assert.throws(() => check(f), /pushes only/);
});
test('development workflow with full workflow ref fails', t => {
  const f = fixture(t); push(f);
  Object.assign(f.env, { GITHUB_WORKFLOW: 'Development CI', GITHUB_JOB: 'fast' });
  assert.throws(() => check(f), /workflow ref/);
});
test('push SHA mismatch fails', t => { const f = fixture(t); push(f); f.env.GITHUB_SHA = other; assert.throws(() => check(f), /Checkout/); });
test('push payload SHA mismatch fails', t => { const f = fixture(t); push(f); f.event.after = other; assert.throws(() => check(f), /Push event SHA/); });
test('push outside work branches fails', t => { const f = fixture(t); push(f); f.env.GITHUB_REF = 'refs/heads/main'; f.env.GITHUB_WORKFLOW_REF = `${repository}/.github/workflows/ci.yml@${f.env.GITHUB_REF}`; assert.throws(() => check(f), /push ref/); });
test('valid PR verifies synthetic merge and ordered parents', t => {
  const f = fixture(t); const result = check(f);
  assert.equal(result.actual_checkout, f.merge); assert.equal(result.expected_commit, f.merge);
  assert.equal(result.base, f.base); assert.equal(result.feature_head, f.head);
  assert.deepEqual(result.parents, [f.base, f.head]);
  assert.equal(result.tree, f.git('rev-parse', 'HEAD^{tree}'));
  assert.equal(result.pr_number, '76'); assert.equal(result.regular_evidence, true);
});
test('wrong base fails', t => { const f = fixture(t); f.event.pull_request.base.sha = other; assert.throws(() => check(f), /First merge parent/); });
test('wrong head fails', t => { const f = fixture(t); f.event.pull_request.head.sha = other; assert.throws(() => check(f), /Second merge parent/); });
test('reversed parents fail', t => { const f = fixture(t); [f.event.pull_request.base.sha, f.event.pull_request.head.sha] = [f.head, f.base]; assert.throws(() => check(f), /First merge parent/); });
test('feature checkout cannot serve as PR merge', t => { const f = fixture(t); f.git('checkout', '--detach', f.head); f.env.GITHUB_SHA = f.head; assert.throws(() => check(f), /two distinct/); });
test('root checkout cannot serve as PR merge', t => { const f = fixture(t); f.git('checkout', '--detach', f.base); f.env.GITHUB_SHA = f.base; assert.throws(() => check(f), /two distinct/); });
test('octopus structure fails', t => {
  const f = fixture(t); const tree = f.git('rev-parse', 'HEAD^{tree}');
  const root = f.git('commit-tree', tree, '-m', 'third synthetic parent');
  const octopus = f.git('commit-tree', tree, '-p', f.base, '-p', f.head, '-p', root, '-m', 'three parents');
  f.git('checkout', '--detach', octopus); f.env.GITHUB_SHA = octopus;
  assert.throws(() => check(f), /two distinct/);
});
for (const field of ['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_WORKFLOW_SHA', 'GITHUB_WORKFLOW_REF']) {
  test(`missing ${field} fails`, t => { const f = fixture(t); delete f.env[field]; assert.throws(() => check(f)); });
}
for (const field of ['base', 'head']) {
  test(`missing PR ${field} identity fails`, t => { const f = fixture(t); delete f.event.pull_request[field].sha; assert.throws(() => check(f), /Missing or invalid/); });
}
test('abbreviated SHA fails', t => { const f = fixture(t); f.event.pull_request.head.sha = f.head.slice(0, 7); assert.throws(() => check(f), /invalid/); });
test('wrong PR number/ref fails', t => { const f = fixture(t); f.event.number = 77; assert.throws(() => check(f), /PR number mismatch/); });
test('wrong repository fails', t => { const f = fixture(t); f.event.repository.full_name = 'other/repo'; assert.throws(() => check(f), /repository/); });
test('wrong PR base branch fails', t => { const f = fixture(t); f.event.pull_request.base.ref = 'other'; assert.throws(() => check(f), /PR base/); });
test('unsupported event fails rather than passing as regular evidence', t => { const f = fixture(t); f.env.GITHUB_EVENT_NAME = 'pull_request_target'; assert.throws(() => check(f), /Unsupported/); });
test('manual dispatch is explicitly limited and nonregular', t => {
  const f = fixture(t); f.env.GITHUB_EVENT_NAME = 'workflow_dispatch'; f.env.GITHUB_REF = 'refs/heads/main';
  f.env.GITHUB_WORKFLOW_REF = `${repository}/.github/workflows/ci.yml@${f.env.GITHUB_REF}`;
  f.event = { repository: { full_name: repository }, ref: 'main' };
  const result = check(f); assert.equal(result.regular_evidence, false); assert.equal(result.event.classification, 'manual_limited');
});
test('git replacement cannot hide real parent structure', t => {
  const f = fixture(t); f.git('replace', f.merge, f.head);
  assert.deepEqual(inspectCheckout(f.directory).parents, [f.base, f.head]);
  assert.equal(check(f).actual_checkout, f.merge);
});
test('JSON and summary contain real checked values and run binding', t => {
  const f = fixture(t); writeFileSync(f.env.GITHUB_EVENT_PATH, JSON.stringify(f.event));
  const result = run(f.env, f.directory);
  assert.deepEqual(JSON.parse(readFileSync(join(f.env.RUNNER_TEMP, 'ci-checkout-identity/identity.json'))), result);
  assert.equal(result.schema_version, 1); assert.equal(result.identity_check, 'passed');
  assert.equal(result.run.id, '123'); assert.equal(result.run.attempt, '2');
  assert.ok(readFileSync(f.env.GITHUB_STEP_SUMMARY, 'utf8').includes(f.merge));
});
test('failed check exits nonzero and removes stale passing evidence', t => {
  const f = fixture(t); writeFileSync(f.env.GITHUB_EVENT_PATH, JSON.stringify(f.event)); run(f.env, f.directory);
  const execution = spawnSync(process.execPath, [script], { cwd: f.directory, env: { ...process.env, ...f.env, GITHUB_SHA: other } });
  assert.notEqual(execution.status, 0);
  assert.equal(existsSync(join(f.env.RUNNER_TEMP, 'ci-checkout-identity/identity.json')), false);
});
test('summary write failure cannot leave passing JSON', t => {
  const f = fixture(t); writeFileSync(f.env.GITHUB_EVENT_PATH, JSON.stringify(f.event)); run(f.env, f.directory);
  f.env.GITHUB_STEP_SUMMARY = f.directory;
  assert.throws(() => run(f.env, f.directory));
  assert.equal(existsSync(join(f.env.RUNNER_TEMP, 'ci-checkout-identity/identity.json')), false);
});
test('JSON write failure fails closed', t => {
  const f = fixture(t); writeFileSync(f.env.GITHUB_EVENT_PATH, JSON.stringify(f.event));
  mkdirSync(join(f.env.RUNNER_TEMP, 'ci-checkout-identity')); mkdirSync(join(f.env.RUNNER_TEMP, 'ci-checkout-identity/identity.json.tmp'));
  assert.throws(() => run(f.env, f.directory));
  assert.equal(existsSync(join(f.env.RUNNER_TEMP, 'ci-checkout-identity/identity.json')), false);
});
test('existing mandatory workflow gates and checkout security remain intact', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  for (const command of ['npm ci', 'npx --no-install playwright install --with-deps chromium', 'node scripts/verify-ci-integration.mjs core', 'npm run build', 'npm run test:browser -- --shard=', 'node scripts/verify-release-artifact.mjs "$GITHUB_SHA"', 'node --test scripts/verify-r1.test.mjs', 'git fetch origin main --no-tags', 'git diff --check origin/main...HEAD']) assert.ok(workflow.includes(command), command);
  assert.ok(workflow.includes('fetch-depth: 0\n          persist-credentials: false'));
  assert.ok(workflow.includes('permissions:\n  contents: read'));
  assert.ok(workflow.includes('if-no-files-found: error'));
  assert.ok(workflow.includes('node --test scripts/verify-ci-checkout-identity.test.mjs'));
  assert.ok(workflow.includes('node scripts/verify-ci-checkout-identity.mjs'));
  assert.ok(!workflow.includes('continue-on-error:'));
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  for (const gate of ['npm run typecheck', 'npm run build', 'npm run test:browser']) assert.ok(pkg.scripts.verify.includes(gate));
});

test('each parallel job proves the real PR merge and rejects push and manual events', t => {
  const f = fixture(t);
  for (const job of ['build', 'core', 'browser', 'integration']) {
    const env = { ...f.env, GITHUB_JOB: job };
    const actual = inspectCheckout(f.directory);
    assert.equal(verifyIdentity(env, f.event, actual).workflow.job, job);
    for (const event of ['push', 'workflow_dispatch']) {
      assert.throws(() => verifyIdentity({ ...env, GITHUB_EVENT_NAME: event }, f.event, actual), /regular pull requests/);
    }
  }
});
