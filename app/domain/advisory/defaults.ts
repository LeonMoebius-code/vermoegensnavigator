import type { AdvisoryData } from "./contracts";
import type { RiskAssessmentV2 } from "../risk/contracts";

export const emptyRiskAssessmentV2 = (): RiskAssessmentV2 => ({
  scenario: null,
  willingness: {
    lossReaction: null,
    temporaryLoss: null,
    riskReturnPriority: null,
  },
  capacity: {
    goalImpact: null,
    capitalDependence: null,
    lossBuffer: null,
  },
});

export const emptyAdvisory: AdvisoryData = {
  caseName: "",
  scope: null,
  legalForm: "GmbH",
  liquidAssets: 0,
  depotValue: 0,
  otherAssets: 0,
  reserve: 0,
  hasDepot: false,
  needs: [],
  goal: "Ausgewogenes Verhältnis",
  horizon: 8,
  risk: 3,
  riskSelectionSource: "default",
  riskAssessmentV2: emptyRiskAssessmentV2(),
  experience: "Grundkenntnisse",
  priorities: ["Werterhalt", "Flexibilität"],
  modules: ["maturity", "market"],
  notes: "",
};
