import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectCheckout, verifyIdentity } from './verify-ci-checkout-identity.mjs';

export const mandatorySteps = ['identity', 'evidence', 'ci_regressions', 'dependencies', 'chromium', 'full_verify', 'r1', 'diff'];

export function assertSteps(steps) {
  for (const name of mandatorySteps) {
    assert.equal(steps[name]?.outcome, 'success', `Mandatory step did not succeed: ${name}`);
    assert.equal(steps[name]?.conclusion, 'success', `Mandatory step conclusion is not success: ${name}`);
  }
}

export function receiptFor(identity) {
  assert.equal(identity.event.classification, 'regular_pull_request', 'Full PR evidence required');
  assert.equal(identity.validation_scope, 'full', 'Full validation scope required');
  return {
    schema_version: 1, complete: true, run_id: identity.run.id, run_attempt: identity.run.attempt,
    merge: identity.actual_checkout, base: identity.base, head: identity.feature_head, tree: identity.tree,
  };
}

export function assertGate(result, receipt, identity) {
  assert.equal(result, 'success', 'Full verification job must succeed, never skip');
  assert.deepEqual(receipt, receiptFor(identity), 'Missing, stale or mismatched full verification receipt');
}

export function assertCurrentRefs(identity, refs) {
  for (const [ref, expected] of [
    ['refs/heads/main', identity.base],
    [`refs/pull/${identity.pr_number}/head`, identity.feature_head],
    [`refs/pull/${identity.pr_number}/merge`, identity.actual_checkout],
  ]) {
    assert.equal(refs[ref], expected, `Integration identity changed or missing: ${ref}`);
  }
}

export function run(mode, env = process.env, cwd = process.cwd()) {
  assert.ok(['complete', 'gate'].includes(mode), 'Unknown integration check mode');
  assert.equal(env.GITHUB_EVENT_NAME, 'pull_request', 'Only PR CI can release the required check');
  assert.equal(env.GITHUB_JOB, mode === 'complete' ? 'verify' : 'integration', 'Unexpected integration job');
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  // Both jobs must inspect the same real synthetic merge, never just run.head_sha.
  const identity = verifyIdentity({ ...env, GITHUB_JOB: 'verify' }, event, inspectCheckout(cwd));
  if (mode === 'complete') {
    assertSteps(JSON.parse(env.CI_STEP_RESULTS));
    const saved = JSON.parse(readFileSync(join(env.RUNNER_TEMP, 'ci-checkout-identity/identity.json'), 'utf8'));
    assert.deepEqual(saved, identity, 'Original checkout evidence changed');
  } else {
    assertGate(env.CI_VERIFY_RESULT, JSON.parse(env.CI_VERIFY_RECEIPT || 'null'), identity);
  }
  const lines = execFileSync('git', ['ls-remote', '--refs', 'origin', 'refs/heads/main',
    `refs/pull/${identity.pr_number}/head`, `refs/pull/${identity.pr_number}/merge`], {
    cwd, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim().split('\n');
  const refs = {};
  for (const line of lines) {
    const [sha, ref] = line.split(/\s+/);
    assert.match(sha, /^[0-9a-f]{40}$/, 'Invalid remote SHA');
    assert.ok(ref && !Object.hasOwn(refs, ref), 'Missing or duplicate remote ref');
    refs[ref] = sha;
  }
  assertCurrentRefs(identity, refs);
  const receipt = receiptFor(identity);
  if (mode === 'complete') appendFileSync(env.GITHUB_OUTPUT, `receipt=${JSON.stringify(receipt)}\n`);
  appendFileSync(env.GITHUB_STEP_SUMMARY, `\nFull PR ${mode}: **passed**. Current main, PR head and synthetic merge match checkout evidence.\n\n\`\`\`json\n${JSON.stringify(receipt, null, 2)}\n\`\`\`\n`);
  return receipt;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(process.argv[2]); } catch (error) {
    console.error(`CI integration check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
