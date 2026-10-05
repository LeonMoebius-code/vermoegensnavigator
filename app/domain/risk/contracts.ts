export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export type LegacyRiskAssessment = {
  lossReaction: RiskLevel | null;
  temporaryLoss: RiskLevel | null;
  financialCapacity: RiskLevel | null;
};

/** @deprecated Nur noch als Migrationsbrücke für Schema-8-Fälle. */
export type RiskAssessment = LegacyRiskAssessment;

export type RiskSelectionSource = "default" | "manual" | "assessment" | "legacy";

export type RiskScenario = "A" | "B" | "C" | "D";

export type RiskAssessmentV2 = {
  triangle?: {
    security: number;
    liquidity: number;
    returnChance: number;
    score: number;
  };
  scenario: RiskScenario | null;
  willingness: {
    lossReaction: RiskLevel | null;
    temporaryLoss: RiskLevel | null;
    riskReturnPriority: RiskLevel | null;
  };
  capacity: {
    goalImpact: RiskLevel | null;
    capitalDependence: RiskLevel | null;
    lossBuffer: RiskLevel | null;
  };
  riskWillingness?: RiskLevel;
  lossCapacity?: RiskLevel;
  recommendedRisk?: RiskLevel;
  completedAt?: string;
};
