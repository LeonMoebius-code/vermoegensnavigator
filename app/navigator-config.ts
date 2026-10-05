export type { Scope, Need, AdvisoryData } from "./domain/advisory/contracts";
export type { RiskLevel, LegacyRiskAssessment, RiskAssessment, RiskSelectionSource, RiskScenario, RiskAssessmentV2 } from "./domain/risk/contracts";
export { emptyRiskAssessmentV2, emptyAdvisory } from "./domain/advisory/defaults";
export { modules, scenarios, priorityOptions } from "./data/advisory-content";
export { euro, percent } from "./presentation/formatters";
