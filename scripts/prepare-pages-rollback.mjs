import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateHistoricalArtifact } from './historical-release-artifact.mjs';

const json = path => JSON.parse(readFileSync(path, 'utf8'));
function requireThat(condition, message) { if (!condition) throw new Error(message); }
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

export function validateRun(run, repository, runId) {
  requireThat(String(run.id) === runId && run.repository?.full_name === repository && run.head_repository?.full_name === repository, 'Foreign run');
  requireThat(run.path === '.github/workflows/release-pages.yml' && run.event === 'workflow_dispatch' && run.head_branch === 'main', 'Not a manual R1 main release');
  requireThat(run.status === 'completed' && run.conclusion === 'success' && run.run_attempt === 1, 'Only successful, first-attempt R1 releases are eligible');
  requireThat(/^[a-f0-9]{40}$/.test(run.head_sha), 'Invalid historical source SHA');
}
export function validateEvidence(evidence, selection, directory) {
  requireThat(evidence.schemaVersion === 1 && evidence.kind === 'r1-release' && evidence.gate === 'npm run verify' && evidence.gateResult === 'success', 'Missing successful R1 gate');
  requireThat(evidence.repository === selection.repository && evidence.runId === selection.runId && evidence.runAttempt === '1' && evidence.sourceSha === selection.sourceSha, 'Historical identity mismatch');
  return validateHistoricalArtifact(directory, evidence, selection);
}
async function select() {
  const runId = process.env.ROLLBACK_RUN_ID;
  const repository = process.env.GITHUB_REPOSITORY;
  requireThat(/^[1-9][0-9]*$/.test(runId), 'Provide a numeric R1 release run ID');
  requireThat(process.env.GITHUB_REF === 'refs/heads/main' && process.env.GITHUB_EVENT_NAME === 'workflow_dispatch', 'Manual main rollback only');
  async function api(path) {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    requireThat(response.ok, `GitHub API failed: ${response.status}`);
    return response.json();
  }
  const run = await api(`actions/runs/${runId}`);
  validateRun(run, repository, runId);
  const result = await api(`actions/runs/${runId}/artifacts?per_page=100`);
  requireThat(result.total_count <= 100, 'Ambiguous artifact inventory');
  const ids = {};
  for (const kind of ['site', 'evidence']) {
    const matches = result.artifacts.filter(a => a.name === `r1-${kind}-${runId}-1`);
    requireThat(matches.length === 1 && !matches[0].expired && new Date(matches[0].expires_at) > new Date(), `Missing/expired ${kind}`);
    const artifact = matches[0];
    requireThat(artifact.workflow_run?.id === Number(runId) && artifact.workflow_run?.head_sha === run.head_sha, 'Artifact run mismatch');
    ids[kind] = String(artifact.id);
    requireThat(/^[1-9][0-9]*$/.test(ids[kind]), 'Invalid artifact ID');
    appendFileSync(process.env.GITHUB_OUTPUT, `${kind}_id=${ids[kind]}\n`);
  }
  writeJson('outputs/r1-rollback-selection.json', { repository, runId, sourceSha: run.head_sha, artifactIds: ids });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'select') await select();
  else if (process.argv[2] === 'verify') {
    const selection = json('outputs/r1-rollback-selection.json');
    const manifest = validateEvidence(json('outputs/rollback-evidence/evidence.json'), selection, 'outputs/rollback-site');
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## R1 rollback candidate\n\nOriginal successful run: ${selection.runId}\n\nSource: \`${selection.sourceSha}\`\n\nSHA-256: \`${manifest.checksum}\`\n\nNo dependencies installed; no product build or historical code executed.\n`);
    console.log(`Stored R1 artifact verified: ${manifest.checksum}`);
  } else throw new Error('Unknown rollback command');
}
