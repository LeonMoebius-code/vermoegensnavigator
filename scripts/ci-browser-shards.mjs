import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { assertSame, json, sealPath, sha256, site, validate, writeJson } from './release-artifact.mjs';

export const shards = [1, 2, 3, 4];
export const digest = value => sha256(JSON.stringify(value));
const bindingKeys = ['schema', 'inventory', 'plan', 'build'];

function sorted(cases) {
  assert.ok(Array.isArray(cases) && cases.length > 0, 'Empty browser inventory');
  const ids = new Set();
  for (const test of cases) {
    assert.ok(typeof test.id === 'string' && test.id && !ids.has(test.id), 'Invalid or duplicate browser identity');
    assert.ok(typeof test.project === 'string' && test.project && /^tests\/browser\//.test(test.file) &&
      Array.isArray(test.title) && test.title.length > 0 && test.title.every(title => typeof title === 'string'),
    'Browser identity must name its project, file and title path');
    assert.equal(test.expected, 'passed', 'Only tests expected to pass may enter the inventory');
    ids.add(test.id);
  }
  return [...cases].sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

export function partition(cases, shardCases) {
  const all = sorted(cases);
  assert.equal(shardCases.length, shards.length, 'Wrong number of browser partitions');
  const partitions = shardCases.map(sorted);
  assert.deepEqual(sorted(partitions.flat()), all, 'Browser partitions must cover the exact inventory');
  return { cases: all, shardIds: partitions.map(tests => tests.map(test => test.id)) };
}

export function validateReport(expected, report) {
  assert.equal(report.status, 'passed', 'Playwright did not complete successfully');
  const cases = sorted(expected);
  assert.deepEqual(sorted(report.cases), cases, 'Playwright selected unexpected tests');
  assert.ok(Array.isArray(report.results), 'Missing browser results');
  const passed = report.results.map(result => {
    assert.equal(result.expected, 'passed', 'Unexpected browser test expectation');
    assert.equal(result.status, 'passed', 'Browser test did not pass');
    return result.id;
  }).sort((a, b) => a.localeCompare(b, 'en'));
  assert.deepEqual(passed, cases.map(test => test.id), 'Browser results did not pass the expected cases exactly once');
  return passed;
}

function discover(directory, shard) {
  const report = join(directory, 'inventory-' + (shard ?? 'full') + '.json');
  execFileSync('node_modules/.bin/playwright', [
    'test', '--list', '--reporter=./scripts/ci-browser-reporter.cjs',
    ...(shard ? ['--shard=' + shard + '/' + shards.length] : []),
  ], { env: { ...process.env, CI_BROWSER_REPORT: report }, stdio: 'inherit' });
  const discovery = json(report);
  assert.equal(discovery.status, 'passed', 'Browser discovery failed');
  assert.deepEqual(discovery.results, [], 'Inventory must come from discovery only');
  return discovery.cases;
}

function validateBuild(location, identity) {
  const build = validate(location, identity.actual_checkout);
  const { workflow, runId, runAttempt } = build.provenance;
  assert.equal(workflow, identity.workflow.name, 'Wrong build workflow');
  assert.equal(runId, identity.run.id, 'Wrong build run');
  assert.equal(runAttempt, identity.run.attempt, 'Wrong build attempt');
  return build;
}

function bindingFor(plan) {
  return {
    schema: 1, inventory: digest(plan.inventory.cases), plan: digest(plan), build: plan.build,
  };
}

export function prepareBuild(identity, directory) {
  const build = validateBuild(site, identity);
  assertSame(build, json(sealPath));
  const discovery = join(directory, 'discovery');
  mkdirSync(discovery, { recursive: true });
  const inventory = partition(discover(discovery), shards.map(shard => discover(discovery, shard)));
  const plan = { identity, build: build.checksum, inventory };
  const artifact = join(directory, 'build');
  cpSync(site, join(artifact, 'site'), { recursive: true, errorOnExist: true, force: false });
  writeJson(join(artifact, 'plan.json'), plan);
  for (const shard of shards) {
    const ids = inventory.shardIds[shard - 1];
    console.log('Browser shard ' + shard + ': ' + ids.length + ' cases');
  }
  return plan;
}

export function readPlan(directory, expectedBuildIdentity, binding, location = join(directory, 'site')) {
  const plan = json(join(directory, 'plan.json'));
  assert.deepEqual(plan.identity, expectedBuildIdentity, 'Build produced by another checkout or run');
  assert.deepEqual(Object.keys(binding).sort(), [...bindingKeys].sort(), 'Invalid build receipt');
  assert.deepEqual(bindingFor(plan), binding, 'Wrong build or browser plan digest');
  const casesById = new Map(plan.inventory.cases.map(item => [item.id, item]));
  assert.deepEqual(partition(plan.inventory.cases, plan.inventory.shardIds.map(ids =>
    ids.map(id => {
      assert.ok(casesById.has(id), 'Shard references a foreign browser test');
      return casesById.get(id);
    }))), plan.inventory, 'Invalid browser plan');
  assert.equal(validateBuild(location, expectedBuildIdentity).checksum, binding.build, 'Artifact bytes changed');
  return plan;
}

export function buildBinding(directory, identity) {
  const plan = json(join(directory, 'plan.json'));
  const binding = bindingFor(plan);
  readPlan(directory, identity, binding);
  return binding;
}

export function useBuild(directory, identity, binding) {
  const plan = readPlan(directory, identity, binding);
  mkdirSync(site); // Refuse a pre-existing site, even an empty one.
  renameSync(join(directory, 'site'), site);
  return plan;
}
