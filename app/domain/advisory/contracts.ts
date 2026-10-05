import type { LegacyRiskAssessment, RiskAssessmentV2, RiskLevel, RiskSelectionSource } from "../risk/contracts";

export type Scope = "private" | "business" | "combined";

export type Need = {
  id: number;
  purpose: string;
  amount: number;
  years: number;
  dueDate?: string;
};

export type AdvisoryData = {
  caseName: string;
  scope: Scope | null;
  legalForm: string;
  liquidAssets: number;
  depotValue: number;
  otherAssets: number;
  reserve: number;
  hasDepot: boolean;
  needs: Need[];
  goal: string;
  horizon: number;
  risk: RiskLevel;
  riskSelectionSource: RiskSelectionSource;
  riskAssessmentV2: RiskAssessmentV2;
  /** Nur für die verlustfreie Migration historischer Fälle. */
  riskAssessment?: LegacyRiskAssessment;
  experience: string;
  priorities: string[];
  modules: string[];
  notes: string;
};

export type AdvisorId = "leon-moebius" | "jochen-walz" | "david-gerhardt" | "michael-friedrich" | "corinna-roehl" | "emanuel-bock";

export type ModuleStatus = "not_started" | "in_progress" | "complete";

export type ModuleState = {
  status: ModuleStatus;
  currentSlide: number;
  checklist: Record<string, boolean>;
  notes: string;
  updatedAt: string;
};

export type CustomerChecklistCategory = "Unterlage mitbringen" | "Antrag oder Formular" | "Externe Klärung" | "Sonstiger nächster Schritt";

export type CustomerChecklistItem = {
  id: string;
  text: string;
  category: CustomerChecklistCategory;
  done: boolean;
  source: "general" | "module";
  moduleId?: string;
  slideIndex?: number;
  createdAt: string;
};
