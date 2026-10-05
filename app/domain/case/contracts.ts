import type { AdvisoryData, AdvisorId, ModuleState, CustomerChecklistItem } from "../advisory/contracts";
import type { StructurePlan, SavingsGoal } from "../planning/contracts";
import type { DepotHolding, DepotAccount } from "../depot/contracts";
import type { VvFilters } from "../vv/contracts";

export type AdvisoryCase = {
  schemaVersion: 11;
  id: string;
  status: "Entwurf" | "In Prüfung" | "Abgeschlossen";
  advisorId: AdvisorId;
  advisory: AdvisoryData;
  plans: StructurePlan[];
  activePlanId: string;
  depot: DepotHolding[];
  depotAccounts: DepotAccount[];
  moduleStates: Record<string, ModuleState>;
  customerChecklist: CustomerChecklistItem[];
  savingsGoals: SavingsGoal[];
  vvFilters: VvFilters;
  selectedVvIds: string[];
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  versions: CaseVersion[];
};

export type CaseSnapshot = Omit<AdvisoryCase, "versions">;

export type CaseVersion = {
  id: string;
  label: string;
  createdAt: string;
  snapshot: CaseSnapshot;
};
