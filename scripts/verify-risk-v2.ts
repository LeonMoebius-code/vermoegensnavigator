import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCase, normalizeImportedCase } from "../app/case-model";
import {
  emptyAdvisory,
  emptyRiskAssessmentV2,
  RiskAssessmentV2,
} from "../app/navigator-config";
import {
  applyCompletedRiskAssessment,
  behaviorRiskScore,
  completeRiskAssessment,
  limitingCapacityFactors,
  lossCapacityScore,
  recommendedRiskScore,
  riskConflictLevel,
  riskProfiles,
  riskSelectionDeviation,
  riskWillingnessScore,
  triangleRiskScore,
  triangleWeightsFromPoint,
  willingnessConsistencyGap,
} from "../app/risk-orientation";

const closeTo = (actual: number, expected: number, tolerance = 0.001) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);

const completeAssessment = (overrides: Partial<RiskAssessmentV2> = {}): RiskAssessmentV2 => ({
  ...emptyRiskAssessmentV2(),
  triangle: { security: 0, liquidity: 0.5, returnChance: 0.5, score: 3.5 },
  scenario: "C",
  willingness: { lossReaction: 3, temporaryLoss: 3, riskReturnPriority: 3 },
  capacity: { goalImpact: 3, capitalDependence: 3, lossBuffer: 3 },
  ...overrides,
});

assert.equal(triangleRiskScore({ security: 1, liquidity: 0, returnChance: 0 }), 1);
assert.equal(triangleRiskScore({ security: 0, liquidity: 0, returnChance: 1 }), 5);
closeTo(triangleRiskScore({ security: 1 / 3, liquidity: 1 / 3, returnChance: 1 / 3 }), 8 / 3);

const vertices = {
  security: { x: 20, y: 180 },
  liquidity: { x: 180, y: 180 },
  returnChance: { x: 100, y: 20 },
};
assert.deepEqual(triangleWeightsFromPoint(vertices.security, vertices), {
  security: 1,
  liquidity: 0,
  returnChance: 0,
});
const middle = triangleWeightsFromPoint({ x: 100, y: 126.6666667 }, vertices);
assert.ok(middle);
closeTo(middle.security, 1 / 3);
closeTo(middle.liquidity, 1 / 3);
closeTo(middle.returnChance, 1 / 3);
assert.equal(triangleWeightsFromPoint({ x: 0, y: 0 }, vertices), null);

assert.equal(behaviorRiskScore(completeAssessment().willingness), 3);
assert.equal(riskWillingnessScore({
  ...completeAssessment(),
  triangle: { security: 0.5, liquidity: 0, returnChance: 0.5, score: 3 },
}), 3);
assert.equal(riskWillingnessScore({
  ...completeAssessment(),
  triangle: { security: 0, liquidity: 0, returnChance: 1, score: 5 },
  scenario: "D",
  willingness: { lossReaction: 5, temporaryLoss: 5, riskReturnPriority: 5 },
}), 5);

const weakestLink = { goalImpact: 5 as const, capitalDependence: 2 as const, lossBuffer: 5 as const };
assert.equal(lossCapacityScore(weakestLink), 2);
assert.deepEqual(limitingCapacityFactors(weakestLink), ["capitalDependence"]);
assert.equal(recommendedRiskScore(5, 2), 2);
assert.equal(riskConflictLevel(4, 3), "notice");
assert.equal(riskConflictLevel(5, 2), "warning");
assert.equal(riskConflictLevel(2, 3), "none");

const inconsistent = completeAssessment({
  triangle: { security: 1, liquidity: 0, returnChance: 0, score: 1 },
  scenario: "D",
  willingness: { lossReaction: 5, temporaryLoss: 5, riskReturnPriority: 5 },
});
assert.ok((willingnessConsistencyGap(inconsistent) || 0) >= 2);

const capped = completeRiskAssessment({
  ...completeAssessment(),
  triangle: { security: 0, liquidity: 0, returnChance: 1, score: 5 },
  scenario: "D",
  willingness: { lossReaction: 5, temporaryLoss: 5, riskReturnPriority: 5 },
  capacity: weakestLink,
}, "2026-09-09T10:00:00.000Z");
assert.equal(capped.riskWillingness, 5);
assert.equal(capped.lossCapacity, 2);
assert.equal(capped.recommendedRisk, 2);
assert.equal(capped.completedAt, "2026-09-09T10:00:00.000Z");

const automatic = applyCompletedRiskAssessment(3, "default", completeAssessment());
assert.equal(automatic.risk, 3);
assert.equal(automatic.source, "assessment");
const manual = applyCompletedRiskAssessment(4, "manual", completeAssessment());
assert.equal(manual.risk, 4);
assert.equal(manual.source, "manual");
const legacySelection = applyCompletedRiskAssessment(4, "legacy", completeAssessment());
assert.equal(legacySelection.risk, 4);
assert.equal(legacySelection.source, "legacy");
const reassessed = applyCompletedRiskAssessment(4, "assessment", completeAssessment());
assert.equal(reassessed.risk, 3);
assert.equal(reassessed.source, "assessment");
assert.equal(riskSelectionDeviation(4, completeRiskAssessment(completeAssessment())), "notice");
assert.equal(riskSelectionDeviation(5, capped), "warning");

const created = createCase({ ...emptyAdvisory, horizon: 3, experience: "Keine / geringe Kenntnisse" });
assert.equal(created.schemaVersion, 9);
assert.equal(created.advisory.riskSelectionSource, "default");
assert.equal(created.advisory.riskAssessmentV2.scenario, null);

const legacyCase = structuredClone(created) as unknown as Record<string, unknown>;
legacyCase.schemaVersion = 8;
const legacyAdvisory = legacyCase.advisory as Record<string, unknown>;
legacyAdvisory.risk = 4;
delete legacyAdvisory.riskSelectionSource;
delete legacyAdvisory.riskAssessmentV2;
legacyAdvisory.riskAssessment = {
  lossReaction: 4,
  temporaryLoss: 3,
  financialCapacity: 2,
};
const oldSnapshot = structuredClone(legacyCase);
(legacyCase.versions as unknown[]) = [{ id: "v1", label: "Alt", createdAt: "2026-01-01", snapshot: oldSnapshot }];
const migrated = normalizeImportedCase(legacyCase, false);
assert.ok(migrated);
assert.equal(migrated.schemaVersion, 9);
assert.equal(migrated.advisory.risk, 4);
assert.equal(migrated.advisory.riskSelectionSource, "legacy");
assert.equal(migrated.advisory.riskAssessmentV2.willingness.lossReaction, 4);
assert.equal(migrated.advisory.riskAssessmentV2.willingness.temporaryLoss, 3);
assert.equal(migrated.advisory.riskAssessmentV2.capacity.goalImpact, 2);
assert.equal(migrated.advisory.riskAssessmentV2.scenario, null);
assert.equal(migrated.advisory.riskAssessmentV2.recommendedRisk, undefined);
assert.equal((migrated.versions[0].snapshot as unknown as { schemaVersion: number }).schemaVersion, 8);

const horizonA = riskWillingnessScore(completeAssessment());
const horizonB = riskWillingnessScore(completeAssessment());
assert.equal(horizonA, horizonB, "Horizont und Erfahrung sind keine Eingaben der V2-Engine");

assert.deepEqual(
  Object.values(riskProfiles).map(({ title, downside, upside }) => ({ title, downside, upside })),
  [
    { title: "Konservativ", downside: -3, upside: 7 },
    { title: "Risikoscheu", downside: -7, upside: 12 },
    { title: "Risikobereit", downside: -12, upside: 20 },
    { title: "Spekulativ", downside: -18, upside: 28 },
    { title: "Hoch spekulativ", downside: -35, upside: 55 },
  ],
);

const pageSource = readFileSync("app/page.tsx", "utf8");
assert.match(pageSource, /Risikoorientierung ermitteln/);
assert.match(pageSource, /Magisches Dreieck/);
assert.match(pageSource, /Gewählte Risikoorientierung/);
assert.match(pageSource, /Ermittelter Orientierungsrahmen/);
assert.match(pageSource, /Wird je Kapitaltopf geprüft/);
assert.doesNotMatch(pageSource, /Manuell festlegen/);
for (const profile of Object.values(riskProfiles)) assert.match(pageSource + JSON.stringify(riskProfiles), new RegExp(profile.title));

console.log("Risiko V2: Modell, Engine und Migration erfolgreich geprüft.");
