import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBinding, prepareBuild, readPlan, shards, useBuild, validateReport } from './ci-browser-shards.mjs';
import { json, site, writeJson } from './release-artifact.mjs';
import { inspectCheckout, verifyIdentity } from './verify-ci-checkout-identity.mjs';

const common = {
  checkout: 'Repository auschecken',
  identity: 'Checkout-Identität verpflichtend prüfen',
  node: 'Node.js einrichten',
  dependencies: 'Abhängigkeiten installieren',
};
const receiptName = 'Pflichtschritte und Identität bestätigen';
export const requiredSteps = {
  build: {
    ...common,
    evidence: 'Checkout-Identitätsnachweis bereitstellen',
    build: 'Kanonischen Pages-Build erstellen',
    r1: 'R1-Artefaktvalidierung',
    r1_tests: 'R1-Operationalregressionen',
    inventory: 'Browserinventar und Build für Shards vorbereiten',
    upload: 'Geprüften Build und Browserplan bereitstellen',
  },
  core: {
    ...common,
    ci_regressions: 'CI-Sicherheitsregressionen',
    verify_core: 'Vollständige Fachtests und Typecheck',
    diff: 'Diff auf Whitespace-Fehler prüfen',
  },
  browser: {
    ...common,
    download: 'Build dieses PR-Versuchs laden',
    build_check: 'Build und Browserplan prüfen',
    chromium: 'Playwright Chromium vorbereiten',
    browser: 'Browser-Shard ausführen',
    build_after: 'Buildbytes nach Browserprüfung bestätigen',
  },
};
const shardUpload = 'Browsernachweis bereitstellen';
const jobName = {
  build: 'Build, Browserinventar und R1',
  core: 'Fachtests und Typecheck',
  browser: shard => 'Browser-Shard ' + shard + '/4',
};

export function assertSteps(role, steps) {
  return Object.fromEntries(Object.keys(requiredSteps[role]).map(id => {
    const { outcome, conclusion } = steps[id] ?? {};
    assert.equal(outcome, 'success', 'Mandatory step did not succeed: ' + id);
    assert.equal(conclusion, 'success', 'Mandatory step conclusion is not success: ' + id);
    return [id, { outcome, conclusion }];
  }));
}

function jobIdentity(identity, role) {
  return { ...identity, workflow: { ...identity.workflow, job: role } };
}

function assertReceipt(receipt, identity, role) {
  assert.equal(receipt?.schema, 1, 'Missing or invalid job receipt: ' + role);
  assert.deepEqual(receipt.identity, jobIdentity(identity, role), 'Wrong job checkout, role or run/attempt: ' + role);
  assert.deepEqual(receipt.steps, assertSteps(role, receipt.steps), 'Unexpected mandatory step set: ' + role);
}

export function coreCommands(verify) {
  const commands = verify.split(' && ').map(command => {
    const match = /^npm run ([a-z0-9:-]+)$/.exec(command);
    assert.ok(match, 'Unexpected command in canonical npm verify');
    return match[1];
  });
  assert.deepEqual(commands.slice(-2), ['build', 'test:browser'], 'Canonical verify must finish with the build and browser suite');
  const core = commands.slice(0, -2);
  assert.ok(core.length && core.includes('typecheck') && !core.includes('build') && !core.includes('test:browser'),
    'Invalid canonical core gate');
  return core;
}

export function assertNeeds(needs) {
  for (const job of ['build', 'core', 'browser']) {
    assert.equal(needs[job]?.result, 'success', 'Mandatory job did not succeed: ' + job);
  }
}

export function assertJobResults(jobs, identity) {
  const expected = [
    ['build', jobName.build], ['core', jobName.core],
    ...shards.map(shard => ['browser', jobName.browser(shard)]),
  ];
  assert.ok(Array.isArray(jobs), 'Missing Actions job data');
  const ids = new Set();
  for (const [role, name] of expected) {
    const matching = jobs.filter(job => job.name === name);
    assert.equal(matching.length, 1, 'Missing or duplicate Actions job: ' + name);
    const [job] = matching;
    assert.ok(Number.isSafeInteger(job.id) && job.id > 0 && !ids.has(job.id), 'Missing or duplicate Actions job ID');
    ids.add(job.id);
    assert.equal(String(job.run_id), identity.run.id, 'Actions job from another run');
    assert.equal(String(job.run_attempt), identity.run.attempt, 'Actions job from another attempt');
    assert.equal(job.workflow_name, identity.workflow.name, 'Actions job from another workflow');
    // Actions REST describes the PR head; the receipt separately proves the actual synthetic merge.
    assert.equal(job.head_sha, identity.feature_head, 'Actions job from another PR head');
    assert.equal(job.status, 'completed', 'Actions job did not finish: ' + name);
    assert.equal(job.conclusion, 'success', 'Actions job did not succeed: ' + name);
    const steps = [...Object.values(requiredSteps[role]), receiptName];
    if (role === 'browser') steps.push(shardUpload);
    for (const step of steps) {
      const matches = job.steps?.filter(item => item.name === step) ?? [];
      assert.equal(matches.length, 1, 'Missing or duplicate Actions step: ' + name + ' / ' + step);
      assert.equal(matches[0].status, 'completed', 'Actions step did not finish: ' + step);
      assert.equal(matches[0].conclusion, 'success', 'Actions step did not succeed: ' + step);
    }
  }
}

export function assertShardReceipts(receipts, identity, binding, inventory) {
  assert.equal(receipts.length, shards.length, 'Wrong number of browser receipts');
  const seen = new Set();
  for (const receipt of receipts) {
    assertReceipt(receipt, identity, 'browser');
    assert.ok(shards.includes(receipt.shard) && !seen.has(receipt.shard), 'Unexpected or duplicate browser shard');
    seen.add(receipt.shard);
    assert.equal(receipt.total, shards.length, 'Wrong browser shard total');
    assert.deepEqual(receipt.binding, binding, 'Browser receipt from another build or plan');
    assert.deepEqual(receipt.passed, inventory.shardIds[receipt.shard - 1], 'Missing, duplicate or foreign browser result');
  }
  return inventory.shardIds.map(ids => ids.length);
}

export function assertCurrentRefs(identity, refs) {
  for (const [ref, expected] of [
    ['refs/heads/main', identity.base],
    ['refs/pull/' + identity.pr_number + '/head', identity.feature_head],
    ['refs/pull/' + identity.pr_number + '/merge', identity.actual_checkout],
  ]) {
    assert.equal(refs[ref], expected, 'Integration identity changed or missing: ' + ref);
  }
}

function checkCurrentRefs(identity, cwd) {
  const lines = execFileSync('git', ['ls-remote', '--refs', 'origin', 'refs/heads/main',
    'refs/pull/' + identity.pr_number + '/head', 'refs/pull/' + identity.pr_number + '/merge'], {
    cwd, encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim().split('\n');
  const refs = {};
  for (const line of lines) {
    const [sha, ref] = line.split(/\s+/);
    assert.match(sha, /^[0-9a-f]{40}$/, 'Invalid remote SHA');
    assert.ok(ref && !Object.hasOwn(refs, ref), 'Missing or duplicate remote ref');
    refs[ref] = sha;
  }
  assertCurrentRefs(identity, refs);
}

export function currentIdentity(env, cwd) {
  assert.equal(env.GITHUB_EVENT_NAME, 'pull_request', 'Only regular PR CI can release the required check');
  assert.ok(['build', 'core', 'browser', 'integration'].includes(env.GITHUB_JOB), 'Unexpected integration job');
  const identity = verifyIdentity(env, json(env.GITHUB_EVENT_PATH), inspectCheckout(cwd));
  assert.equal(identity.event.classification, 'regular_pull_request', 'Regular PR evidence required');
  return identity;
}

function assertBuildReceipt(receipt, identity) {
  assertReceipt(receipt, identity, 'build');
  return receipt.binding;
}

async function actionsJobs(identity, env) {
  const url = 'https://api.github.com/repos/' + identity.repository + '/actions/runs/' +
    identity.run.id + '/attempts/' + identity.run.attempt + '/jobs?per_page=100';
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + env.GOV05_ACTIONS_TOKEN, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(30_000),
  });
  assert.ok(response.ok, 'Could not read current Actions attempt jobs: HTTP ' + response.status);
  const data = await response.json();
  assert.equal(data.jobs.length, data.total_count, 'Incomplete Actions job data');
  return data.jobs;
}

function readShardReceipts(directory, identity) {
  const prefix = 'gov05-shard-' + identity.run.id + '-' + identity.run.attempt + '-';
  const names = shards.map(shard => prefix + shard);
  assert.deepEqual(readdirSync(directory).sort(), names, 'Missing, duplicate or foreign browser receipt artifact');
  return names.map((name, i) => {
    const path = join(directory, name);
    assert.deepEqual(readdirSync(path), ['receipt.json'], 'Unexpected browser artifact contents');
    const receipt = json(join(path, 'receipt.json'));
    assert.equal(receipt.shard, shards[i], 'Receipt was published under the wrong shard name');
    return receipt;
  });
}

export async function run(mode, env = process.env, cwd = process.cwd()) {
  const identity = currentIdentity(env, cwd);
  const role = identity.workflow.job;
  const directory = join(env.RUNNER_TEMP, 'gov05');
  const buildDirectory = join(directory, 'build');
  const browserReport = join(directory, 'browser.json');
  if (mode === 'needs') {
    assert.equal(role, 'integration', 'Unexpected job for gate preflight');
    assertNeeds(JSON.parse(env.GOV05_NEEDS));
    return;
  }
  if (mode === 'gate') {
    assert.equal(role, 'integration', 'Unexpected job for final gate');
    const needs = JSON.parse(env.GOV05_NEEDS);
    assertNeeds(needs);
    assertJobResults(await actionsJobs(identity, env), identity);
    const buildReceipt = JSON.parse(needs.build.outputs.receipt || 'null');
    const binding = assertBuildReceipt(buildReceipt, identity);
    assertReceipt(JSON.parse(needs.core.outputs.receipt || 'null'), identity, 'core');
    const plan = readPlan(buildDirectory, buildReceipt.identity, binding);
    const counts = assertShardReceipts(readShardReceipts(join(directory, 'shards'), identity), identity, binding, plan.inventory);
    checkCurrentRefs(identity, cwd);
    const result = { complete: true, identity, ...binding, shard_counts: counts };
    appendFileSync(env.GITHUB_STEP_SUMMARY, '\nFull PR gate passed. All browser cases passed exactly once.\n\n```json\n' +
      JSON.stringify(result, null, 2) + '\n```\n');
    console.log('Full PR gate passed: browser cases by shard ' + counts.join(', '));
    return result;
  }

  assert.deepEqual(json(join(env.RUNNER_TEMP, 'ci-checkout-identity/identity.json')), identity, 'Original checkout evidence changed');
  if (mode === 'core') {
    assert.equal(role, 'core', 'Unexpected job for core verification');
    for (const command of coreCommands(json(join(cwd, 'package.json')).scripts.verify)) {
      execFileSync('npm', ['run', command], { cwd, env, stdio: 'inherit' });
    }
    return;
  }
  if (mode === 'prepare') {
    assert.equal(role, 'build', 'Unexpected job for build preparation');
    return prepareBuild(identity, directory);
  }
  if (role === 'browser' && ['use-build', 'check-build', 'receipt'].includes(mode)) {
    const buildReceipt = JSON.parse(env.GOV05_BUILD_RECEIPT || 'null');
    const binding = assertBuildReceipt(buildReceipt, identity);
    if (mode === 'use-build') return useBuild(buildDirectory, buildReceipt.identity, binding);
    const plan = readPlan(buildDirectory, buildReceipt.identity, binding, site);
    if (mode === 'check-build') return plan;
    const shard = Number(env.GOV05_SHARD);
    assert.ok(shards.includes(shard) && env.GOV05_SHARD === String(shard), 'Unexpected shard number');
    const ids = new Set(plan.inventory.shardIds[shard - 1]);
    const passed = validateReport(plan.inventory.cases.filter(test => ids.has(test.id)), json(browserReport));
    const steps = assertSteps(role, JSON.parse(env.GOV05_STEP_RESULTS));
    checkCurrentRefs(identity, cwd);
    const receipt = { schema: 1, identity, steps, binding, shard, total: shards.length, passed };
    writeJson(join(directory, 'receipt.json'), receipt);
    return receipt;
  }

  assert.ok(mode === 'receipt' && ['build', 'core'].includes(role), 'Unexpected job or integration check mode');
  const steps = assertSteps(role, JSON.parse(env.GOV05_STEP_RESULTS));
  checkCurrentRefs(identity, cwd);
  const receipt = { schema: 1, identity, steps };
  if (role === 'build') receipt.binding = buildBinding(buildDirectory, identity);
  appendFileSync(env.GITHUB_OUTPUT, 'receipt=' + JSON.stringify(receipt) + '\n');
  return receipt;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv[2]).catch(error => {
    console.error('CI integration check failed: ' + error.message);
    process.exitCode = 1;
  });
}
