import {
  RiskAssessmentV2,
  RiskLevel,
  RiskScenario,
  RiskSelectionSource,
} from "./navigator-config";

export type TriangleWeights = {
  security: number;
  liquidity: number;
  returnChance: number;
};

export const riskProfiles: Record<
  RiskLevel,
  { title: string; short: string; text: string; downside: number; upside: number }
> = {
  1: { title: "Konservativ", short: "Stabilität im Vordergrund", text: "Geringe Schwankungen und Kapitalerhalt stehen im Vordergrund.", downside: -3, upside: 7 },
  2: { title: "Risikoscheu", short: "Begrenzte Schwankungen", text: "Moderate Chancen werden bei begrenzten Schwankungen genutzt.", downside: -7, upside: 12 },
  3: { title: "Risikobereit", short: "Chancen und Risiken ausgewogen", text: "Spürbare Schwankungen werden für bessere Renditechancen akzeptiert.", downside: -12, upside: 20 },
  4: { title: "Spekulativ", short: "Renditechancen im Fokus", text: "Hohe Schwankungen und mögliche Kapitalverluste werden bewusst akzeptiert.", downside: -18, upside: 28 },
  5: { title: "Hoch spekulativ", short: "Sehr hohe Risikobereitschaft", text: "Sehr hohe Chancen stehen trotz erheblicher bis sehr hoher Verlustrisiken im Vordergrund.", downside: -35, upside: 55 },
};

export const riskScenarioScores: Record<RiskScenario, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const asRiskLevel = (value: number): RiskLevel =>
  clamp(Math.round(value), 1, 5) as RiskLevel;

export function triangleRiskScore(weights: TriangleWeights): number {
  return clamp(
    weights.security + 2 * weights.liquidity + 5 * weights.returnChance,
    1,
    5,
  );
}

export function triangleWeightsFromPoint(
  point: { x: number; y: number },
  vertices: {
    security: { x: number; y: number };
    liquidity: { x: number; y: number };
    returnChance: { x: number; y: number };
  },
): TriangleWeights | null {
  const { security: a, liquidity: b, returnChance: c } = vertices;
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(denominator) < Number.EPSILON) return null;
  const security =
    ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) /
    denominator;
  const liquidity =
    ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) /
    denominator;
  const returnChance = 1 - security - liquidity;
  if (Math.min(security, liquidity, returnChance) < -0.0001) return null;
  const total = security + liquidity + returnChance;
  return {
    security: clamp(security / total, 0, 1),
    liquidity: clamp(liquidity / total, 0, 1),
    returnChance: clamp(returnChance / total, 0, 1),
  };
}

export function behaviorRiskScore(
  willingness: RiskAssessmentV2["willingness"],
): number | null {
  const values = [
    willingness.lossReaction,
    willingness.temporaryLoss,
    willingness.riskReturnPriority,
  ];
  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((sum, value) => sum + Number(value), 0) / values.length;
}

export function riskWillingnessScore(
  assessment: RiskAssessmentV2,
): RiskLevel | null {
  if (!assessment.triangle || !assessment.scenario) return null;
  const behavior = behaviorRiskScore(assessment.willingness);
  if (behavior === null) return null;
  return asRiskLevel(
    0.25 * assessment.triangle.score +
      0.25 * riskScenarioScores[assessment.scenario] +
      0.5 * behavior,
  );
}

export function willingnessConsistencyGap(
  assessment: RiskAssessmentV2,
): number | null {
  if (!assessment.triangle || !assessment.scenario) return null;
  const behavior = behaviorRiskScore(assessment.willingness);
  if (behavior === null) return null;
  const values = [
    assessment.triangle.score,
    riskScenarioScores[assessment.scenario],
    behavior,
  ];
  return Math.max(...values) - Math.min(...values);
}

export function lossCapacityScore(
  capacity: RiskAssessmentV2["capacity"],
): RiskLevel | null {
  const values = [capacity.goalImpact, capacity.capitalDependence, capacity.lossBuffer];
  if (values.some((value) => value === null)) return null;
  return Math.min(...values.map(Number)) as RiskLevel;
}

export function limitingCapacityFactors(
  capacity: RiskAssessmentV2["capacity"],
): Array<keyof RiskAssessmentV2["capacity"]> {
  const score = lossCapacityScore(capacity);
  if (!score) return [];
  return (Object.keys(capacity) as Array<keyof typeof capacity>).filter(
    (key) => capacity[key] === score,
  );
}

export function recommendedRiskScore(
  riskWillingness: RiskLevel | null,
  lossCapacity: RiskLevel | null,
): RiskLevel | null {
  if (!riskWillingness || !lossCapacity) return null;
  return Math.min(riskWillingness, lossCapacity) as RiskLevel;
}

export type RiskConflictLevel = "none" | "notice" | "warning";

export function riskConflictLevel(
  riskWillingness: RiskLevel | null,
  lossCapacity: RiskLevel | null,
): RiskConflictLevel {
  if (!riskWillingness || !lossCapacity || riskWillingness <= lossCapacity) return "none";
  return riskWillingness >= lossCapacity + 2 ? "warning" : "notice";
}

export function completeRiskAssessment(
  assessment: RiskAssessmentV2,
  completedAt = new Date().toISOString(),
): RiskAssessmentV2 {
  const riskWillingness = riskWillingnessScore(assessment);
  const lossCapacity = lossCapacityScore(assessment.capacity);
  const recommendedRisk = recommendedRiskScore(riskWillingness, lossCapacity);
  if (!riskWillingness || !lossCapacity || !recommendedRisk) {
    const { riskWillingness: _w, lossCapacity: _c, recommendedRisk: _r, completedAt: _at, ...open } = assessment;
    return open;
  }
  return { ...assessment, riskWillingness, lossCapacity, recommendedRisk, completedAt };
}

export function applyCompletedRiskAssessment(
  currentRisk: RiskLevel,
  source: RiskSelectionSource,
  assessment: RiskAssessmentV2,
): { risk: RiskLevel; source: RiskSelectionSource; assessment: RiskAssessmentV2 } {
  const completed = completeRiskAssessment(assessment);
  if (!completed.recommendedRisk) return { risk: currentRisk, source, assessment: completed };
  if (source === "default" || source === "assessment") {
    return { risk: completed.recommendedRisk, source: "assessment", assessment: completed };
  }
  return { risk: currentRisk, source, assessment: completed };
}

export function riskSelectionDeviation(
  selected: RiskLevel,
  assessment: RiskAssessmentV2,
): RiskConflictLevel {
  if (!assessment.recommendedRisk || selected <= assessment.recommendedRisk) return "none";
  if (assessment.lossCapacity && selected >= assessment.lossCapacity + 2) return "warning";
  return "notice";
}
