import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, appendFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = 'LeonMoebius-code/vermoegensnavigator';
const workflowPath = '.github/workflows/ci.yml';
const shaPattern = /^[0-9a-f]{40}$/;
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function sha(value, label) {
  requireValue(typeof value === 'string' && shaPattern.test(value), `Missing or invalid ${label}`);
  return value;
}
function positive(value, label) {
  requireValue(/^[1-9][0-9]*$/.test(String(value ?? '')), `Missing or invalid ${label}`);
  return String(value);
}

// Read real objects, not shallow revision walks, replacement objects or shell text.
export function inspectCheckout(cwd) {
  const git = (...args) => execFileSync('git', args, {
    cwd, encoding: 'utf8', env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const checkout = sha(git('rev-parse', '--verify', 'HEAD^{commit}'), 'checkout');
  const headers = git('cat-file', 'commit', checkout).split('\n\n', 1)[0].split('\n');
  const trees = headers.filter(line => line.startsWith('tree '));
  requireValue(trees.length === 1, 'Invalid commit tree structure');
  const tree = sha(trees[0].slice(5), 'tree');
  requireValue(git('cat-file', '-t', tree) === 'tree', 'Tree object missing');
  const parents = headers.filter(line => line.startsWith('parent ')).map(line => sha(line.slice(7), 'parent'));
  for (const parent of parents) requireValue(git('cat-file', '-t', parent) === 'commit', 'Parent object missing');
  return { checkout, tree, parents };
}

export function verifyIdentity(env, event, actual) {
  requireValue(env.GITHUB_ACTIONS === 'true', 'GitHub Actions context required');
  requireValue(env.GITHUB_REPOSITORY === repository && event.repository?.full_name === repository, 'Unexpected repository');
  requireValue(env.GITHUB_WORKFLOW === 'Feature CI' && env.GITHUB_JOB === 'verify', 'Unexpected workflow or job');
  requireValue(env.GITHUB_WORKFLOW_REF === `${repository}/${workflowPath}@${env.GITHUB_REF}`, 'Unexpected workflow ref');
  const workflowSha = sha(env.GITHUB_WORKFLOW_SHA, 'workflow SHA');
  const runId = positive(env.GITHUB_RUN_ID, 'run ID');
  const attempt = positive(env.GITHUB_RUN_ATTEMPT, 'run attempt');
  const expected = sha(env.GITHUB_SHA, 'expected commit');
  requireValue(actual.checkout === expected, 'Checkout does not match expected commit');
  let classification;
  let pr = null;
  let featureHead = null;
  let base = null;
  if (env.GITHUB_EVENT_NAME === 'push') {
    requireValue(/^refs\/heads\/work\/.+/.test(env.GITHUB_REF ?? ''), 'Unexpected push ref');
    requireValue(event.ref === env.GITHUB_REF && event.deleted === false, 'Unexpected push event');
    requireValue(sha(event.after, 'push after') === expected, 'Push event SHA mismatch');
    classification = 'regular_push';
  } else if (env.GITHUB_EVENT_NAME === 'pull_request') {
    const pull = event.pull_request;
    pr = positive(event.number, 'PR number');
    requireValue(positive(pull?.number, 'payload PR number') === pr, 'PR number mismatch');
    requireValue(['opened', 'synchronize', 'reopened'].includes(event.action) && pull.state === 'open', 'Unexpected PR event');
    requireValue(env.GITHUB_REF === `refs/pull/${pr}/merge`, 'Expected synthetic merge ref');
    requireValue(pull.base?.repo?.full_name === repository && pull.base.ref === 'main' && env.GITHUB_BASE_REF === 'main', 'Unexpected PR base');
    requireValue(typeof pull.head?.ref === 'string' && pull.head.ref.length > 0 && env.GITHUB_HEAD_REF === pull.head.ref, 'Unexpected PR head ref');
    base = sha(pull.base.sha, 'base SHA');
    featureHead = sha(pull.head.sha, 'feature head SHA');
    requireValue(actual.parents.length === 2 && actual.parents[0] !== actual.parents[1], 'Expected two distinct merge parents');
    requireValue(actual.parents[0] === base, 'First merge parent is not expected base');
    requireValue(actual.parents[1] === featureHead, 'Second merge parent is not expected head');
    requireValue(expected !== featureHead && expected !== base, 'Expected synthetic merge, not feature head or base');
    classification = 'regular_pull_request';
  } else if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    requireValue(/^refs\/heads\/.+/.test(env.GITHUB_REF ?? ''), 'Manual check supports branch refs only');
    requireValue(event.ref === env.GITHUB_REF || `refs/heads/${event.ref}` === env.GITHUB_REF, 'Manual event ref mismatch');
    classification = 'manual_limited';
  } else {
    throw new Error('Unsupported event type');
  }
  return {
    schema_version: 1, repository,
    workflow: { name: env.GITHUB_WORKFLOW, path: workflowPath, ref: env.GITHUB_WORKFLOW_REF, sha: workflowSha, job: env.GITHUB_JOB },
    event: { name: env.GITHUB_EVENT_NAME, action: event.action ?? null, ref: env.GITHUB_REF, classification },
    run: { id: runId, attempt, url: `https://github.com/${repository}/actions/runs/${runId}/attempts/${attempt}` },
    pr_number: pr, expected_commit: expected, actual_checkout: actual.checkout,
    feature_head: featureHead, base, parents: actual.parents, tree: actual.tree,
    identity_check: 'passed', regular_evidence: classification !== 'manual_limited',
  };
}

export function run(env = process.env, cwd = process.cwd()) {
  requireValue(env.RUNNER_TEMP && env.GITHUB_STEP_SUMMARY, 'Evidence paths required');
  const directory = join(env.RUNNER_TEMP, 'ci-checkout-identity');
  mkdirSync(directory, { recursive: true });
  const output = join(directory, 'identity.json');
  const temporary = `${output}.tmp`;
  // Never let an old passing file survive a failed check or failed write.
  rmSync(output, { force: true });
  rmSync(temporary, { force: true });
  try {
    const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
    const evidence = verifyIdentity(env, event, inspectCheckout(cwd));
    writeFileSync(temporary, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
    appendFileSync(env.GITHUB_STEP_SUMMARY, [
      '## Checkout identity', '',
      `Identity check: **passed** (${evidence.event.classification}).`,
      'This confirms checkout identity only. Full CI success and artifact availability must be checked separately.', '',
      `Run: ${evidence.run.url}`, `Event: ${evidence.event.name}, PR: ${evidence.pr_number ?? 'none'}`,
      `Expected / actual: \`${evidence.expected_commit}\` / \`${evidence.actual_checkout}\``,
      `Parents: ${evidence.parents.map(parent => `\`${parent}\``).join(', ') || 'none'}`,
      `Tree: \`${evidence.tree}\``, `Schema: ${evidence.schema_version}`, '',
    ].join('\n'));
    renameSync(temporary, output);
    return evidence;
  } catch (error) {
    rmSync(output, { force: true });
    rmSync(temporary, { force: true });
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(); } catch (error) {
    console.error(`CI checkout identity failed: ${error.message}`);
    process.exitCode = 1;
  }
}
