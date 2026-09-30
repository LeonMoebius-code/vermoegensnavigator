import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertSame, json, requireThat, root, sealPath, site, validate, writeJson } from './release-artifact.mjs';

const expectedSha = process.env.EXPECTED_SOURCE_SHA || process.argv[2];
const manifest = validate(site, expectedSha);
assertSame(manifest, json(sealPath));
if (process.env.R1_RELEASE === 'true') {
  requireThat(process.env.GITHUB_REF === 'refs/heads/main' && process.env.GITHUB_EVENT_NAME === 'workflow_dispatch', 'Manual main release only');
  requireThat(process.env.GITHUB_RUN_ATTEMPT === '1', 'Use a new dispatch, never rebuild a prepared run');
  requireThat(manifest.provenance.workflow === 'Release GitHub Pages' && manifest.provenance.runId === process.env.GITHUB_RUN_ID && manifest.provenance.runAttempt === '1', 'Release run identity mismatch');
  const evidence = { schemaVersion: 1, kind: 'r1-release', sourceSha: expectedSha,
    gate: 'npm run verify', gateResult: 'success', repository: process.env.GITHUB_REPOSITORY,
    runId: process.env.GITHUB_RUN_ID, runAttempt: '1',
    runUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    ...manifest };
  writeJson(resolve(root, 'outputs/r1-release/evidence.json'), evidence);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## R1 release candidate\n\nSource: \`${expectedSha}\`\n\nGate: npm run verify — success (one build, CP0B 3/3)\n\nSHA-256: \`${manifest.checksum}\`\n\nRun: ${evidence.runUrl}, attempt 1\n\nReview r1-evidence-${evidence.runId}-1 and r1-site-${evidence.runId}-1 before approving github-pages.\n`);
}
console.log(`R1 artifact verified, unchanged since build/CP0B: ${manifest.checksum}`);
