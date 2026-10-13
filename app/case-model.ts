export { normalizeImportedCase } from "./domain/case/normalization";

export {
  positiveStrategicPot,
  validModelPortfolioTarget,
  strategicAllocatedAmount,
  modelPortfolioDefaultAmount,
  supplementPlanWithModelPortfolio,
  replaceStrategicPlanAllocations,
  createModelPortfolioVariant,
} from "./domain/planning/model-portfolio-operations";
export type { ModelPortfolioAction } from "./domain/planning/model-portfolio-operations";

import { uid, iso, clone } from "./domain/case/runtime";
import { createPlan } from "./domain/planning/plan-identity";
export {
  createPlan,
  duplicateStructurePlan,
  nextPlanCopyName,
  getActiveStructurePlan,
  getPreferredStructurePlan,
  setActiveStructurePlan,
  setPreferredStructurePlan,
  appendStructurePlan,
  deleteStructurePlan,
} from "./domain/planning/plan-identity";
import { withDepotValue, enforceCaseDepotValue } from "./domain/depot/lifecycle";
export {
  nextDepotName,
  initialReplacementDepotId,
  holdingsForDepot,
  depotMarketValue,
  physicalDepotValue,
  withDepotValue,
  enforceCaseDepotValue,
  setCaseDepot,
  addDepotAccount,
  replaceDepotAccount,
  buildMultiDepotExportData,
  deleteDepotAccount,
  renameDepotAccount,
} from "./domain/depot/lifecycle";
export {
  replacementHoldingIdMap,
  reconcileDepotHoldingSelections,
} from "./domain/depot/identity";
import { reconcileCasePlans } from "./domain/planning/allocations";
export {
  allocationBucketAmounts,
  allocationAmountInBucket,
  allocationCoverageTotal,
  allocationCapitalPotAmounts,
  allocationAmountInCapitalPot,
  allocationCapitalCoverageTotal,
  legacyBucketAmountsForCapitalPots,
  capitalPotRemovalImpact,
  reconcilePlanCapitalPots,
  reconcileCasePlans,
} from "./domain/planning/allocations";
export type { CapitalPotRemovalImpact } from "./domain/planning/allocations";
export {
  phasedEntryAmounts,
  addLocalMonthsClamped,
  phasedEntryLastDate,
  capitalPotDeadline,
  phasedEntryScheduleValidation,
  defaultPhasedEntryInstallments,
  parsePhasedEntryNumericDraft,
  nextImplementationDate,
  annualSavingsContribution,
} from "./domain/planning/investment-plans";
export type {
  PhasedEntryAmounts,
  PhasedEntryScheduleValidation,
  PhasedEntryDraftKind,
} from "./domain/planning/investment-plans";
export {
  maturityBuckets,
  monthsUntilNeed,
  targetYearForNeed,
  capitalPots,
  planningShortfall,
  bucketForMonths,
  bucketTargets,
  strategicAmount,
} from "./domain/planning/capital-pots";
export {
  productAssetMix,
  planAssetAmounts,
  depotAssetAmounts,
  plannerPlanHoldingValue,
  buildIstWealthStructure,
  buildPlanWealthStructure,
  depotPlanAssetAmounts,
} from "./domain/wealth-structure/projection";
export type { WealthStructureSnapshot } from "./domain/wealth-structure/projection";
import { advisors, defaultAdvisorId } from "./data/advisors";
export { advisors, defaultAdvisorId };
export { customerChecklistCategories } from "./data/advisory-content";
export type {
  BucketId,
  CapitalPotId,
  CapitalPot,
  PlannerAllocation,
  StructurePlan,
  InvestmentFrequency,
  SavingsTargetRef,
  PhasedEntryPlan,
  SavingsPlan,
  InvestmentPlan,
  SavingsGoal,
} from "./domain/planning/contracts";
export type { DepotHolding, DepotAccount, ParsedDepotHolding } from "./domain/depot/contracts";
import type { AdvisorId } from "./domain/advisory/contracts";
export type {
  AdvisorId,
  ModuleStatus,
  ModuleState,
  CustomerChecklistCategory,
  CustomerChecklistItem,
} from "./domain/advisory/contracts";
import type { AdvisoryCase, CaseSnapshot } from "./domain/case/contracts";
export type { AdvisoryCase, CaseSnapshot, CaseVersion } from "./domain/case/contracts";
export type { VvFilters } from "./domain/vv/contracts";
import { blankVvFilters } from "./domain/vv/defaults";
export { blankVvFilters } from "./domain/vv/defaults";

import type { AdvisoryData } from "./domain/advisory/contracts";
import { emptyAdvisory } from "./domain/advisory/defaults";
import { dataSources } from "./data/investment-data-sources";

export function createCase(
  advisory: AdvisoryData = emptyAdvisory,
  advisorId: AdvisorId = defaultAdvisorId,
): AdvisoryCase {
  const now = iso();
  const data = clone(advisory);
  const initialTotal = data.liquidAssets;
  const plan = createPlan("Plan A – Ausgangsstruktur", initialTotal);
  // Initial case choice is explicit; later variants never inherit preference.
  plan.preferred = true;
  return {
    schemaVersion: 11,
    id: uid("fall"),
    status: "Entwurf",
    advisorId,
    advisory: data,
    plans: [plan],
    activePlanId: plan.id,
    depot: [],
    depotAccounts: [],
    moduleStates: {},
    customerChecklist: [],
    savingsGoals: [],
    vvFilters: blankVvFilters(initialTotal),
    selectedVvIds: [],
    currentStep: data.scope ? 2 : 1,
    createdAt: now,
    updatedAt: now,
    versions: [],
  };
}

export function caseSnapshot(item: AdvisoryCase): CaseSnapshot {
  const snapshot = clone(enforceCaseDepotValue(item)) as Partial<AdvisoryCase>;
  delete snapshot.versions;
  return snapshot as CaseSnapshot;
}

export function updateCaseAdvisory<K extends keyof AdvisoryData>(current: AdvisoryCase, key: K, value: AdvisoryData[K]): AdvisoryCase {
  const advisory = withDepotValue({ ...current.advisory, [key]: value }, current.depot);
  const liquidAssets = advisory.liquidAssets;
  const plans = current.plans.map((plan) => key === "liquidAssets" && plan.capitalMode === "linked"
    ? { ...plan, total: liquidAssets, updatedAt: iso() } : plan);
  return { ...current, advisory,
    plans: reconcileCasePlans(advisory, plans, current.createdAt, current.savingsGoals),
    vvFilters: { ...current.vvFilters, amount: current.vvFilters.amount === current.advisory.liquidAssets ? liquidAssets : current.vvFilters.amount },
  };
}

export function dataState() {
  return Object.fromEntries(
    dataSources.map((source) => [source.title, source.date]),
  );
}
