import {
  allocationBucketAmounts,
  allocationCapitalPotAmounts,
  allocationAmountInCapitalPot,
  legacyBucketAmountsForCapitalPots,
  reconcilePlanCapitalPots,
  reconcileCasePlans,
} from "./domain/planning/allocations";
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
import { capitalPots, maturityBuckets } from "./domain/planning/capital-pots";
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
import type {
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
import type { DepotHolding, DepotAccount, ParsedDepotHolding } from "./domain/depot/contracts";
export type { DepotHolding, DepotAccount, ParsedDepotHolding } from "./domain/depot/contracts";
import type {
  AdvisorId,
  ModuleStatus,
  ModuleState,
  CustomerChecklistCategory,
  CustomerChecklistItem,
} from "./domain/advisory/contracts";
export type {
  AdvisorId,
  ModuleStatus,
  ModuleState,
  CustomerChecklistCategory,
  CustomerChecklistItem,
} from "./domain/advisory/contracts";
import type { AdvisoryCase, CaseSnapshot, CaseVersion } from "./domain/case/contracts";
export type { AdvisoryCase, CaseSnapshot, CaseVersion } from "./domain/case/contracts";
import type { VvFilters } from "./domain/vv/contracts";
export type { VvFilters } from "./domain/vv/contracts";
import { blankVvFilters } from "./domain/vv/defaults";
export { blankVvFilters } from "./domain/vv/defaults";

import { sanitizeOptionalHolding } from "./depot-validation";
import { normalizeBondHolding } from "./bond-source";
import type { AdvisoryData } from "./domain/advisory/contracts";
import { emptyAdvisory, emptyRiskAssessmentV2 } from "./domain/advisory/defaults";
import type { LegacyRiskAssessment, RiskAssessmentV2, RiskLevel, RiskSelectionSource } from "./domain/risk/contracts";
import { completeRiskAssessment, triangleRiskScore } from "./domain/risk/orientation";
import { dataSources } from "./data/investment-data-sources";

const uid = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const iso = () => new Date().toISOString();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createPlan(name: string, total: number): StructurePlan {
  const now = iso();
  return {
    id: uid("plan"),
    name,
    total,
    capitalMode: "linked",
    allocations: [],
    investmentPlans: [],
    preferred: false,
    notes: "",
    depotMode: "none",
    depotHoldingIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateStructurePlan(
  plan: StructurePlan,
  name = `${plan.name} – Kopie`,
): StructurePlan {
  const now = iso();
  const allocationIds = new Map<string, string>();
  const allocations = plan.allocations.map((allocation) => {
    const id = uid("allocation");
    allocationIds.set(allocation.id, id);
    return { ...clone(allocation), id };
  });
  const investmentPlans = plan.investmentPlans.flatMap<InvestmentPlan>((entry) => {
    if (entry.type === "savings")
      return [{ ...clone(entry), id: uid("investment") }];
    const allocationId = allocationIds.get(entry.allocationId);
    return allocationId
      ? [{ ...clone(entry), id: uid("investment"), allocationId }]
      : [];
  });
  return {
    ...clone(plan),
    id: uid("plan"),
    name,
    preferred: false,
    allocations,
    investmentPlans,
    createdAt: now,
    updatedAt: now,
  };
}

export function nextPlanCopyName(sourceName: string, existingNames: string[]) {
  const baseName = sourceName.replace(/(?:\s+–\s+Kopie(?:\s+\d+)?)+$/i, "").trim();
  const used = new Set(existingNames.map((name) => name.trim()));
  const first = `${baseName} – Kopie`;
  if (!used.has(first)) return first;
  let index = 2;
  while (used.has(`${baseName} – Kopie ${index}`)) index += 1;
  return `${baseName} – Kopie ${index}`;
}

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

export function getActiveStructurePlan(item: Pick<AdvisoryCase, "plans" | "activePlanId">): StructurePlan {
  const matches = item.plans.filter((plan) => plan.id === item.activePlanId);
  if (!validIdentity(item.activePlanId) || matches.length !== 1)
    throw new Error("Die aktive Planvariante ist ungültig. Es wird keine Ersatzvariante gewählt.");
  return matches[0];
}

export function getPreferredStructurePlan(plans: StructurePlan[]): StructurePlan | undefined {
  const preferred = plans.filter((plan) => plan.preferred);
  if (preferred.length > 1) throw new Error("Mehrere bevorzugte Planvarianten sind ungültig.");
  return preferred[0];
}

export function setActiveStructurePlan(item: AdvisoryCase, id: string): AdvisoryCase {
  getActiveStructurePlan(item);
  if (!validIdentity(id) || item.plans.filter((plan) => plan.id === id).length !== 1) return item;
  return { ...item, activePlanId: id };
}

export function setPreferredStructurePlan(item: AdvisoryCase, id: string): AdvisoryCase {
  if (!validIdentity(id) || item.plans.filter((plan) => plan.id === id).length !== 1) return item;
  return { ...item, plans: item.plans.map((plan) => ({ ...plan, preferred: plan.id === id })) };
}

/** Append only a valid independent variant; make it active without selecting a target. */
export function appendStructurePlan(item: AdvisoryCase, plan: StructurePlan): AdvisoryCase {
  const next = { ...item, plans: [...item.plans, { ...plan, preferred: false }], activePlanId: plan.id };
  return validCurrentPlanGraph(next) ? next : item;
}

export function deleteStructurePlan(item: AdvisoryCase, id: string): AdvisoryCase {
  getActiveStructurePlan(item);
  const index = item.plans.findIndex((plan) => plan.id === id);
  if (index < 0 || item.plans.length === 1) return item;
  const successor = item.plans[index + 1] ?? item.plans[index - 1];
  return { ...item, plans: item.plans.filter((plan) => plan.id !== id),
    activePlanId: item.activePlanId === id ? successor.id : item.activePlanId };
}

const toCents = (amount: number) => Math.round((Number(amount) || 0) * 100);

export type PhasedEntryAmounts = {
  targetAmount: number;
  stagedAmount: number;
  immediateAmount: number;
  installmentAmounts: number[];
  installmentAmount: number;
  lastInstallmentAmount: number;
  invalid: boolean;
  hasRoundingAdjustment: boolean;
};

export function phasedEntryAmounts(
  plan: StructurePlan,
  entry: PhasedEntryPlan,
): PhasedEntryAmounts {
  const allocation = plan.allocations.find(
    (candidate) => candidate.id === entry.allocationId,
  );
  const targetCents = toCents(
    allocation
      ? allocationAmountInCapitalPot(allocation, entry.capitalPotId)
      : 0,
  );
  const stagedCents =
    entry.stagedMode === "percent"
      ? Math.round(targetCents * (Number(entry.stagedValue) || 0) / 100)
      : toCents(entry.stagedValue);
  const installments = Math.max(0, Math.trunc(Number(entry.installments) || 0));
  const invalid =
    targetCents <= 0 ||
    stagedCents <= 0 ||
    installments < 1 ||
    (entry.stagedMode === "percent" &&
      (entry.stagedValue < 0 || entry.stagedValue > 100)) ||
    (entry.stagedMode === "amount" && stagedCents > targetCents);
  const baseCents = installments > 0 ? Math.floor(stagedCents / installments) : 0;
  const remainder = installments > 0 ? stagedCents - baseCents * installments : 0;
  const installmentCents = Array.from({ length: installments }, (_, index) =>
    index === installments - 1 ? baseCents + remainder : baseCents,
  );
  return {
    targetAmount: targetCents / 100,
    stagedAmount: stagedCents / 100,
    immediateAmount: Math.max(0, targetCents - stagedCents) / 100,
    installmentAmounts: installmentCents.map((amount) => amount / 100),
    installmentAmount: baseCents / 100,
    lastInstallmentAmount:
      (installmentCents[installmentCents.length - 1] || 0) / 100,
    invalid,
    hasRoundingAdjustment: remainder > 0,
  };
}

const localDateParts = (value: Date | string) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    };
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(year, month - 1, day, 12);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) return null;
  return { year, month, day };
};

const localDateString = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function addLocalMonthsClamped(value: Date | string, months: number) {
  const parts = localDateParts(value);
  if (!parts || !Number.isFinite(months)) return null;
  const target = new Date(parts.year, parts.month - 1 + Math.trunc(months), 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  return localDateString(
    target.getFullYear(),
    target.getMonth() + 1,
    Math.min(parts.day, lastDay),
  );
}

const frequencyMonths: Record<InvestmentFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export function phasedEntryLastDate(entry: Pick<PhasedEntryPlan, "startDate" | "installments" | "frequency">) {
  const installments = Math.trunc(Number(entry.installments));
  if (installments < 1) return null;
  return addLocalMonthsClamped(
    entry.startDate,
    (installments - 1) * frequencyMonths[entry.frequency],
  );
}

export function capitalPotDeadline(
  pot: CapitalPot,
  referenceDate: Date | string = new Date(),
) {
  if (pot.kind !== "year") return null;
  if (pot.earliestDueDate && localDateParts(pot.earliestDueDate))
    return pot.earliestDueDate.slice(0, 10);
  return addLocalMonthsClamped(referenceDate, pot.minMonths);
}

export type PhasedEntryScheduleValidation = {
  valid: boolean;
  lastDate: string | null;
  deadline: string | null;
};

export function phasedEntryScheduleValidation(
  entry: Pick<PhasedEntryPlan, "startDate" | "installments" | "frequency">,
  pot: CapitalPot,
  referenceDate: Date | string = new Date(),
): PhasedEntryScheduleValidation {
  const lastDate = phasedEntryLastDate(entry);
  const deadline = capitalPotDeadline(pot, referenceDate);
  return {
    lastDate,
    deadline,
    valid: Boolean(lastDate) && (!deadline || lastDate! <= deadline),
  };
}

export function defaultPhasedEntryInstallments(
  pot: CapitalPot,
  startDate: string,
  referenceDate: Date | string = new Date(),
  preferred = 12,
) {
  const maximum = Math.max(1, Math.trunc(preferred));
  for (let installments = maximum; installments >= 1; installments -= 1) {
    if (phasedEntryScheduleValidation(
      { startDate, installments, frequency: "monthly" },
      pot,
      referenceDate,
    ).valid) return installments;
  }
  return 1;
}

export type PhasedEntryDraftKind = "installments" | "percent" | "amount";
export function parsePhasedEntryNumericDraft(raw: string, kind: PhasedEntryDraftKind) {
  const trimmed = raw.trim();
  if (!trimmed) return { status: "empty" as const };
  const normalized = trimmed.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return { status: "invalid" as const };
  const value = Number(normalized);
  const valid = Number.isFinite(value) && (
    kind === "installments"
      ? Number.isInteger(value) && value >= 1
      : kind === "percent"
        ? value >= 0 && value <= 100
        : value >= 0
  );
  return valid ? { status: "valid" as const, value } : { status: "invalid" as const };
}

export function nextImplementationDate(
  referenceDate: Date | string = new Date(),
) {
  let date: Date;
  if (typeof referenceDate === "string") {
    const match = referenceDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    date = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(referenceDate);
  } else {
    date = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate(),
    );
  }
  if (Number.isNaN(date.getTime())) date = new Date();
  if (date.getDate() < 15) date.setDate(15);
  else {
    date.setMonth(date.getMonth() + 1, 1);
  }
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function annualSavingsContribution(entry: SavingsPlan) {
  const multiplier: Record<InvestmentFrequency, number> = {
    monthly: 12,
    quarterly: 4,
    semiannual: 2,
    annual: 1,
  };
  return Math.max(0, Number(entry.contributionAmount) || 0) * multiplier[entry.frequency];
}

export type ModelPortfolioAction = "new" | "supplement" | "replace";

export function positiveStrategicPot(pots: CapitalPot[]) {
  const candidates = pots.filter((pot) => pot.id === "strategic");
  const pot = candidates.length === 1 ? candidates[0] : undefined;
  return pot?.kind === "strategic" && Number.isFinite(pot.total) && pot.total > 0 ? pot : undefined;
}

export function validModelPortfolioTarget(pots: CapitalPot[], allocations: PlannerAllocation[]) {
  if (!positiveStrategicPot(pots)) return false;
  return allocations.every((allocation) =>
    allocation.capitalPotId === "strategic" && Number.isFinite(allocation.amount) && allocation.amount >= 0 &&
    allocation.capitalPotAmounts?.strategic === allocation.amount &&
    Object.entries(allocation.capitalPotAmounts).every(([id, amount]) => id === "strategic" || amount === 0),
  );
}

export function strategicAllocatedAmount(plan: StructurePlan) {
  return plan.allocations.reduce(
    (sum, allocation) =>
      sum + Math.max(0, allocationAmountInCapitalPot(allocation, "strategic")),
    0,
  );
}

export function modelPortfolioDefaultAmount(
  action: ModelPortfolioAction,
  plan: StructurePlan,
  pots: CapitalPot[],
) {
  const strategicTotal =
    positiveStrategicPot(pots)?.total || 0;
  return action === "supplement"
    ? Math.max(0, strategicTotal - strategicAllocatedAmount(plan))
    : Math.max(0, strategicTotal);
}

export function supplementPlanWithModelPortfolio(
  plan: StructurePlan,
  modelAllocations: PlannerAllocation[],
  pots: CapitalPot[],
) {
  if (!validModelPortfolioTarget(pots, modelAllocations)) return plan;
  return {
    ...plan,
    allocations: [
      ...plan.allocations,
      ...modelAllocations.filter((allocation) => allocation.amount > 0),
    ],
  };
}

export function replaceStrategicPlanAllocations(
  plan: StructurePlan,
  modelAllocations: PlannerAllocation[],
  pots: CapitalPot[],
) {
  if (!validModelPortfolioTarget(pots, modelAllocations)) return plan;
  const allocations = plan.allocations.flatMap<PlannerAllocation>((allocation) => {
    const amounts = allocationCapitalPotAmounts(allocation);
    const strategic = Math.max(0, Number(amounts.strategic) || 0);
    if (strategic <= 0) return [{ ...allocation }];
    const retainedAmounts = Object.fromEntries(
      Object.entries(amounts).filter(
        ([id, amount]) => id !== "strategic" && Number(amount) > 0,
      ),
    ) as Partial<Record<CapitalPotId, number>>;
    const retainedIds = Object.keys(retainedAmounts) as CapitalPotId[];
    if (retainedIds.length === 0) return [];
    const retainedCoverage = Object.values(retainedAmounts).reduce<number>(
      (sum, amount) => sum + Math.max(0, Number(amount) || 0),
      0,
    );
    const originalCoverage = Object.values(amounts).reduce<number>(
      (sum, amount) => sum + Math.max(0, Number(amount) || 0),
      0,
    );
    const unassigned = Math.max(0, allocation.amount - originalCoverage);
    const capitalPotId = retainedAmounts[allocation.capitalPotId || "strategic"]
      ? allocation.capitalPotId
      : retainedIds[0];
    return [{
      ...allocation,
      amount: retainedCoverage + unassigned,
      capitalPotId,
      capitalPotAmounts: retainedAmounts,
      bucketId:
        pots.find((pot) => pot.id === capitalPotId)?.legacyBucketId ||
        allocation.bucketId,
      bucketAmounts: legacyBucketAmountsForCapitalPots(pots, retainedAmounts),
    }];
  });
  const allocationById = new Map(
    allocations.map((allocation) => [allocation.id, allocation]),
  );
  const investmentPlans = plan.investmentPlans.filter((entry) => {
    if (entry.type === "savings") return true;
    const allocation = allocationById.get(entry.allocationId);
    return Boolean(
      allocation &&
      entry.capitalPotId !== "strategic" &&
      allocationAmountInCapitalPot(allocation, entry.capitalPotId) > 0,
    );
  });
  return {
    ...plan,
    allocations: [
      ...allocations,
      ...modelAllocations.filter((allocation) => allocation.amount > 0),
    ],
    investmentPlans,
  };
}

export function createModelPortfolioVariant(
  plan: StructurePlan,
  modelAllocations: PlannerAllocation[],
  pots: CapitalPot[],
  name: string,
) {
  if (!validModelPortfolioTarget(pots, modelAllocations)) return plan;
  return replaceStrategicPlanAllocations(
    duplicateStructurePlan(plan, name),
    modelAllocations,
    pots,
  );
}

const normalizedHoldingWkn = (holding: DepotHolding) =>
  String(holding.wkn || "").trim().toUpperCase();

const normalizedHoldingProductId = (holding: DepotHolding) =>
  String(holding.productId || "").trim();

const conservativeHoldingFallback = (holding: DepotHolding) => {
  const name = holding.name.trim().toLocaleLowerCase("de-DE");
  if (!name) return "";
  return `${name}::${String(holding.securityType || holding.sourceType || "")
    .trim()
    .toLocaleLowerCase("de-DE")}`;
};

const holdingIdentityConflict = (previous: DepotHolding, next: DepotHolding) =>
  previous.depotId !== next.depotId ||
  [normalizedHoldingWkn, normalizedHoldingProductId].some((key) => key(previous) && key(next) && key(previous) !== key(next));

/**
 * Builds the single, globally one-to-one mapping used for every consequence of
 * a depot replacement. Each stage only sees holdings that were not claimed by
 * a higher-priority identity.
 */
export function replacementHoldingIdMap(
  previousDepot: DepotHolding[],
  nextDepot: DepotHolding[],
) {
  const matches = new Map<string, string>();
  const uniqueIds = (holdings: DepotHolding[]) => {
    const counts = new Map<string, number>();
    holdings.forEach((holding) => counts.set(holding.id, (counts.get(holding.id) || 0) + 1));
    return new Map(holdings.filter((holding) => holding.id && counts.get(holding.id) === 1)
      .map((holding) => [holding.id, holding]));
  };
  const availablePrevious = uniqueIds(previousDepot);
  const availableNext = uniqueIds(nextDepot);
  const excludedPrevious = previousDepot.filter((holding) => !availablePrevious.has(holding.id));
  const excludedNext = nextDepot.filter((holding) => !availableNext.has(holding.id));

  const claim = (previous: DepotHolding, next: DepotHolding) => {
    matches.set(previous.id, next.id);
    availablePrevious.delete(previous.id);
    availableNext.delete(next.id);
  };

  for (const previous of [...availablePrevious.values()]) {
    const next = availableNext.get(previous.id);
    if (!next) continue;
    if (!holdingIdentityConflict(previous, next)) claim(previous, next);
    else {
      // A contradicted explicit identity must not be reinterpreted by weaker stages.
      availablePrevious.delete(previous.id);
      availableNext.delete(next.id);
      excludedPrevious.push(previous);
      excludedNext.push(next);
    }
  }

  const ambiguousPrevious = new Set<string>();
  const ambiguousNext = new Set<string>();
  const claimUniqueBy = (keyFor: (holding: DepotHolding) => string) => {
    const previousByKey = new Map<string, DepotHolding[]>();
    const nextByKey = new Map<string, DepotHolding[]>();
    for (const holding of availablePrevious.values()) {
      const key = keyFor(holding);
      if (key && !ambiguousPrevious.has(holding.id)) previousByKey.set(`${holding.depotId}::${key}`, [...(previousByKey.get(`${holding.depotId}::${key}`) || []), holding]);
    }
    for (const holding of availableNext.values()) {
      const key = keyFor(holding);
      if (key && !ambiguousNext.has(holding.id)) nextByKey.set(`${holding.depotId}::${key}`, [...(nextByKey.get(`${holding.depotId}::${key}`) || []), holding]);
    }
    // Invalid IDs cannot be claimed, but their securities still make weaker
    // identities ambiguous. Dropping them would manufacture a unique WKN.
    for (const [excluded, byKey] of [[excludedPrevious, previousByKey], [excludedNext, nextByKey]] as const) {
      for (const holding of excluded) {
        const key = keyFor(holding);
        if (key) byKey.set(`${holding.depotId}::${key}`, [...(byKey.get(`${holding.depotId}::${key}`) || []), holding]);
      }
    }
    for (const key of new Set([...previousByKey.keys(), ...nextByKey.keys()])) {
      const previousCandidates = previousByKey.get(key) || [];
      const nextCandidates = nextByKey.get(key) || [];
      if (previousCandidates.length > 1 || nextCandidates.length > 1 ||
        previousCandidates.some((holding) => !availablePrevious.has(holding.id)) ||
        nextCandidates.some((holding) => !availableNext.has(holding.id))) {
        previousCandidates.forEach((holding) => ambiguousPrevious.add(holding.id));
        nextCandidates.forEach((holding) => ambiguousNext.add(holding.id));
      } else if (previousCandidates.length === 1 && nextCandidates.length === 1 &&
        !holdingIdentityConflict(previousCandidates[0], nextCandidates[0]))
        claim(previousCandidates[0], nextCandidates[0]);
    }
  };

  claimUniqueBy(normalizedHoldingWkn);
  claimUniqueBy(normalizedHoldingProductId);
  claimUniqueBy(conservativeHoldingFallback);
  return matches;
}

export function reconcileDepotHoldingSelections(
  plans: StructurePlan[],
  previousDepot: DepotHolding[],
  nextDepot: DepotHolding[],
  replacementDepotId?: string,
  replacementMap?: ReadonlyMap<string, string>,
) {
  const nextIds = new Set(nextDepot.map((holding) => holding.id));
  const previousById = new Map(
    previousDepot.map((holding) => [holding.id, holding]),
  );
  const finalReplacementMap = replacementDepotId
    ? replacementMap || replacementHoldingIdMap(
        previousDepot.filter((holding) => holding.depotId === replacementDepotId),
        nextDepot.filter((holding) => holding.depotId === replacementDepotId),
      )
    : undefined;
  return plans.map((plan) => {
    const mappedIds = plan.depotHoldingIds.flatMap((id) => {
      const previous = previousById.get(id);
      if (previous && replacementDepotId && previous.depotId === replacementDepotId) {
        const matchId = finalReplacementMap?.get(previous.id);
        return matchId && nextIds.has(matchId) ? [matchId] : [];
      }
      return previous && nextIds.has(id) ? [id] : [];
    });
    return {
      ...plan,
      depotHoldingIds: Array.from(new Set(mappedIds)),
    };
  });
}

export function nextDepotName(accounts: DepotAccount[]) {
  const used = new Set(accounts.map((account) => account.name.trim()));
  let index = 1;
  while (used.has(`Depot ${index}`)) index += 1;
  return `Depot ${index}`;
}

export function initialReplacementDepotId(
  accounts: DepotAccount[],
  requestedDepotId?: string,
) {
  return requestedDepotId && accounts.some((account) => account.id === requestedDepotId)
    ? requestedDepotId
    : accounts[0]?.id || "";
}

export const holdingsForDepot = (depot: DepotHolding[], depotId: string) =>
  depot.filter((holding) => holding.depotId === depotId);

export const depotMarketValue = (depot: DepotHolding[], depotId: string) =>
  holdingsForDepot(depot, depotId).reduce(
    (sum, holding) => sum + Math.max(0, Number(holding.value) || 0),
    0,
  );

type DepotLifecycleState = Pick<
  AdvisoryCase,
  "advisory" | "depotAccounts" | "depot" | "plans"
>;

export function physicalDepotValue(depot: DepotHolding[]) {
  let total = 0;
  for (const holding of depot) {
    if (!Number.isFinite(holding.value) || holding.value < 0)
      throw new Error("Ungültiger Marktwert. Der bisherige Bestand bleibt erhalten.");
    total += holding.value;
  }
  if (!Number.isFinite(total)) throw new Error("Der Depotgesamtwert ist nicht endlich.");
  return total;
}

export function withDepotValue(advisory: AdvisoryData, depot: DepotHolding[]): AdvisoryData {
  return depot.length ? { ...advisory, depotValue: physicalDepotValue(depot), hasDepot: true } : advisory;
}

/** Every active-case mutation passes here before React publishes the next state. */
export function enforceCaseDepotValue<T extends Pick<AdvisoryCase, "advisory" | "depot">>(item: T): T {
  const advisory = withDepotValue(item.advisory, item.depot);
  return advisory === item.advisory ? item : { ...item, advisory };
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

export function setCaseDepot<T extends DepotLifecycleState>(state: T, depot: DepotHolding[]): T {
  return { ...state, depot,
    advisory: withDepotValue(state.depot.length && !depot.length ? { ...state.advisory, depotValue: 0 } : state.advisory, depot),
    plans: reconcileDepotHoldingSelections(state.plans, state.depot, depot),
  };
}

function importedHoldings(state: DepotLifecycleState, depotId: string, parsed: ParsedDepotHolding[]) {
  physicalDepotValue(parsed.map((holding) => ({ ...holding, depotId })));
  const oldById = new Map(state.depot.map((holding) => [holding.id, holding]));
  const reserved = new Set(state.depot.map((holding) => holding.id));
  parsed.forEach((holding) => reserved.add(holding.id));
  const used = new Set<string>();
  const idCounts = new Map<string, number>();
  parsed.forEach((holding) => idCounts.set(holding.id, (idCounts.get(holding.id) || 0) + 1));
  return parsed.map((raw) => {
    let id = raw.id;
    const holding = { ...raw, depotId };
    const old = oldById.get(id);
    if (!id || idCounts.get(id)! > 1 || used.has(id) || (old && holdingIdentityConflict(old, holding))) {
      do { id = uid("holding"); } while (reserved.has(id) || used.has(id));
    }
    used.add(id);
    return { ...holding, id };
  });
}

export function addDepotAccount(
  state: DepotLifecycleState,
  parsed: ParsedDepotHolding[],
  requestedName?: string,
): DepotLifecycleState {
  const now = iso();
  const account: DepotAccount = {
    id: uid("depot"),
    name: requestedName?.trim() || nextDepotName(state.depotAccounts),
    createdAt: now,
    updatedAt: now,
  };
  const imported = importedHoldings(state, account.id, parsed);
  const depot = [...state.depot, ...imported];
  const firstConcreteDepot = state.depot.length === 0 && imported.length > 0;
  const plans = state.plans.map((plan) =>
    firstConcreteDepot && !plan.depotModeSelectionInitialized
      ? { ...plan, depotMode: "afterSales" as const }
      : plan,
  );
  return {
    advisory: withDepotValue(state.advisory, depot),
    depotAccounts: [...state.depotAccounts, account],
    depot,
    plans,
  };
}

export function replaceDepotAccount(
  state: DepotLifecycleState,
  depotId: string,
  parsed: ParsedDepotHolding[],
): DepotLifecycleState {
  if (!state.depotAccounts.some((account) => account.id === depotId)) return state;
  const previous = holdingsForDepot(state.depot, depotId);
  const imported = importedHoldings(state, depotId, parsed);
  // Preserve original identities for matching: repairing conflicts/duplicates is
  // only a storage concern and must never manufacture fresh matching evidence.
  const matchingHoldings = imported.map((holding, index) => ({ ...holding, id: parsed[index].id || holding.id }));
  const finalIds = new Map(matchingHoldings.map((holding, index) => [holding.id, imported[index].id]));
  const replacementMap = new Map([...replacementHoldingIdMap(state.depot, matchingHoldings)]
    .map(([oldId, sourceId]) => [oldId, finalIds.get(sourceId)!]));
  const previousByNextId = new Map(
    [...replacementMap].map(([previousId, nextId]) => [nextId, previousId]),
  );
  const previousById = new Map(previous.map((holding) => [holding.id, holding]));
  const reconciled = imported.map((holding) => {
    const match = previousById.get(previousByNextId.get(holding.id) || "");
    return match
      ? { ...holding, plannedSale: Math.max(0, Math.min(match.plannedSale, holding.value)), excludeFromBondAggregates: match.excludeFromBondAggregates === true }
      : { ...holding, plannedSale: 0, excludeFromBondAggregates: false };
  });
  const depot = [
    ...state.depot.filter((holding) => holding.depotId !== depotId),
    ...reconciled,
  ];
  const firstConcreteDepot = state.depot.length === 0 && reconciled.length > 0;
  const plans = reconcileDepotHoldingSelections(
    state.plans,
    state.depot,
    depot,
    depotId,
    replacementMap,
  ).map((plan) =>
    firstConcreteDepot && !plan.depotModeSelectionInitialized
      ? { ...plan, depotMode: "afterSales" as const }
      : plan,
  );
  return {
    advisory: withDepotValue(state.depot.length && !depot.length ? { ...state.advisory, depotValue: 0 } : state.advisory, depot),
    depotAccounts: state.depotAccounts.map((account) =>
      account.id === depotId ? { ...account, updatedAt: iso() } : account,
    ),
    depot,
    plans,
  };
}

export function buildMultiDepotExportData(
  depotAccounts: DepotAccount[],
  depot: DepotHolding[],
) {
  return {
    overview: depotAccounts.map((account) => {
      const positions = holdingsForDepot(depot, account.id);
      const valuationDates = Array.from(
        new Set(
          positions.flatMap((holding) =>
            holding.valuationEnd ? [holding.valuationEnd] : [],
          ),
        ),
      ).sort();
      return {
        depotId: account.id,
        depotName: account.name,
        marketValue: depotMarketValue(depot, account.id),
        positionCount: positions.length,
        valuationDate:
          valuationDates.length === 1
            ? valuationDates[0]
            : valuationDates.length > 1
              ? "unterschiedliche Bewertungsstichtage"
              : "",
      };
    }),
    holdings: depot.map((holding) => ({
      ...holding,
      depotName:
        depotAccounts.find((account) => account.id === holding.depotId)?.name || "",
    })),
    totalMarketValue: depot.reduce(
      (sum, holding) => sum + Math.max(0, Number(holding.value) || 0),
      0,
    ),
  };
}

export function deleteDepotAccount(
  state: DepotLifecycleState,
  depotId: string,
): DepotLifecycleState {
  const depot = state.depot.filter((holding) => holding.depotId !== depotId);
  const validIds = new Set(depot.map((holding) => holding.id));
  return {
    advisory: withDepotValue(state.depot.length && !depot.length ? { ...state.advisory, depotValue: 0 } : state.advisory, depot),
    depotAccounts: state.depotAccounts.filter((account) => account.id !== depotId),
    depot,
    plans: state.plans.map((plan) => ({
      ...plan,
      depotHoldingIds: plan.depotHoldingIds.filter((id) => validIds.has(id)),
    })),
  };
}

export function renameDepotAccount(
  accounts: DepotAccount[],
  depotId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (!trimmed) return accounts;
  return accounts.map((account) =>
    account.id === depotId ? { ...account, name: trimmed, updatedAt: iso() } : account,
  );
}

export function dataState() {
  return Object.fromEntries(
    dataSources.map((source) => [source.title, source.date]),
  );
}

type LegacyInvestmentPlan = {
  id?: string;
  name?: string;
  type?: string;
  productId?: string;
  productName?: string;
  bucketId?: BucketId;
  capitalPotId?: CapitalPotId;
  installmentAmount?: number;
  installments?: number;
  frequency?: InvestmentFrequency;
  startDate?: string;
  note?: string;
  allocationId?: string;
  stagedMode?: "percent" | "amount";
  stagedValue?: number;
  contributionAmount?: number;
  targetRef?: SavingsTargetRef;
};

const normalizedFrequency = (value?: string): InvestmentFrequency =>
  value === "quarterly" || value === "semiannual" || value === "annual"
    ? value
    : "monthly";

function normalizeInvestmentPlans(
  rawEntries: unknown,
  allocations: PlannerAllocation[],
  pots: CapitalPot[],
  sourceSchemaVersion: number,
): InvestmentPlan[] {
  if (!Array.isArray(rawEntries)) return [];
  return rawEntries.flatMap<InvestmentPlan>((rawEntry) => {
    if (!rawEntry || typeof rawEntry !== "object") return [];
    const entry = rawEntry as LegacyInvestmentPlan;
    if (entry.type === "savings") {
      const targetRef =
        sourceSchemaVersion >= 8 &&
        entry.targetRef &&
        (entry.targetRef.kind === "need" ||
          entry.targetRef.kind === "savingsGoal")
          ? entry.targetRef
          : undefined;
      return [{
        id: entry.id || uid("investment"),
        type: "savings" as const,
        name: entry.name || undefined,
        productId: entry.productId || "",
        productName: entry.productName || "",
        contributionAmount: Math.max(
          0,
          Number(
            sourceSchemaVersion >= 8
              ? entry.contributionAmount
              : entry.installmentAmount,
          ) || 0,
        ),
        frequency: normalizedFrequency(entry.frequency),
        startDate: entry.startDate || "",
        targetRef,
        note: entry.note || "",
      }];
    }
    if (entry.type !== "phased") return [];
    if (sourceSchemaVersion >= 8) {
      if (!entry.allocationId || !entry.capitalPotId) return [];
      return [{
        id: entry.id || uid("investment"),
        type: "phased" as const,
        allocationId: entry.allocationId,
        capitalPotId: entry.capitalPotId,
        stagedMode: entry.stagedMode === "percent" ? "percent" as const : "amount" as const,
        stagedValue: Math.max(0, Number(entry.stagedValue) || 0),
        installments: Math.max(1, Math.trunc(Number(entry.installments) || 1)),
        frequency: normalizedFrequency(entry.frequency),
        startDate: entry.startDate || "",
        note: entry.note || "",
      }];
    }
    const legacyPotId =
      entry.capitalPotId ||
      (entry.bucketId
        ? (() => {
            const candidates = pots.filter(
              (pot) => pot.legacyBucketId === entry.bucketId,
            );
            return candidates.length === 1 ? candidates[0].id : undefined;
          })()
        : undefined) ||
      (pots.length === 1 ? pots[0].id : undefined);
    if (!legacyPotId || !entry.productId) return [];
    const candidates = allocations.filter(
      (allocation) =>
        allocation.productId === entry.productId &&
        allocationAmountInCapitalPot(allocation, legacyPotId) > 0,
    );
    if (candidates.length !== 1) return [];
    const installments = Math.max(1, Math.trunc(Number(entry.installments) || 1));
    const stagedValue =
      Math.max(0, Number(entry.installmentAmount) || 0) * installments;
    if (stagedValue <= 0) return [];
    return [{
      id: entry.id || uid("investment"),
      type: "phased" as const,
      allocationId: candidates[0].id,
      capitalPotId: legacyPotId,
      stagedMode: "amount" as const,
      stagedValue,
      installments,
      frequency: normalizedFrequency(entry.frequency),
      startDate: entry.startDate || "",
      note: entry.note || "",
    }];
  });
}

const normalizedRiskLevel = (value: unknown): RiskLevel | null => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 5
    ? (numeric as RiskLevel)
    : null;
};

function normalizeRiskAssessmentV2(value: unknown): RiskAssessmentV2 {
  const empty = emptyRiskAssessmentV2();
  if (!value || typeof value !== "object") return empty;
  const source = value as Partial<RiskAssessmentV2>;
  const triangle = source.triangle;
  let normalizedTriangle: RiskAssessmentV2["triangle"];
  if (triangle) {
    const weights = {
      security: Number(triangle.security),
      liquidity: Number(triangle.liquidity),
      returnChance: Number(triangle.returnChance),
    };
    const total = weights.security + weights.liquidity + weights.returnChance;
    if (
      Object.values(weights).every((entry) => Number.isFinite(entry) && entry >= 0) &&
      total > 0
    ) {
      const normalizedWeights = {
        security: weights.security / total,
        liquidity: weights.liquidity / total,
        returnChance: weights.returnChance / total,
      };
      normalizedTriangle = {
        ...normalizedWeights,
        score: triangleRiskScore(normalizedWeights),
      };
    }
  }
  const assessment: RiskAssessmentV2 = {
    triangle: normalizedTriangle,
    scenario:
      source.scenario === "A" ||
      source.scenario === "B" ||
      source.scenario === "C" ||
      source.scenario === "D"
        ? source.scenario
        : null,
    willingness: {
      lossReaction: normalizedRiskLevel(source.willingness?.lossReaction),
      temporaryLoss: normalizedRiskLevel(source.willingness?.temporaryLoss),
      riskReturnPriority: normalizedRiskLevel(source.willingness?.riskReturnPriority),
    },
    capacity: {
      goalImpact: normalizedRiskLevel(source.capacity?.goalImpact),
      capitalDependence: normalizedRiskLevel(source.capacity?.capitalDependence),
      lossBuffer: normalizedRiskLevel(source.capacity?.lossBuffer),
    },
  };
  const completed = completeRiskAssessment(assessment, source.completedAt);
  return completed.recommendedRisk ? completed : assessment;
}

function migrateRiskAssessment(
  advisory: AdvisoryData,
  sourceSchemaVersion: number,
): AdvisoryData {
  const legacy = advisory.riskAssessment as LegacyRiskAssessment | undefined;
  const source = advisory.riskSelectionSource as RiskSelectionSource | undefined;
  const risk = normalizedRiskLevel(advisory.risk) || 3;
  if (sourceSchemaVersion < 9) {
    return {
      ...advisory,
      risk,
      riskSelectionSource: "legacy",
      riskAssessmentV2: {
        ...emptyRiskAssessmentV2(),
        willingness: {
          lossReaction: normalizedRiskLevel(legacy?.lossReaction),
          temporaryLoss: normalizedRiskLevel(legacy?.temporaryLoss),
          riskReturnPriority: null,
        },
        capacity: {
          goalImpact: normalizedRiskLevel(legacy?.financialCapacity),
          capitalDependence: null,
          lossBuffer: null,
        },
      },
    };
  }
  return {
    ...advisory,
    risk,
    riskSelectionSource:
      source === "default" || source === "manual" || source === "assessment" || source === "legacy"
        ? source
        : "legacy",
    riskAssessmentV2: normalizeRiskAssessmentV2(advisory.riskAssessmentV2),
  };
}

const validIdentity = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/** Validate the current persisted graph BEFORE any lossy legacy reconciliation.
 * Historical snapshot contents are deliberately opaque until actual restore. */
function validCurrentPlanGraph(item: Partial<AdvisoryCase>): boolean {
  const uniqueIds = (entries: { id: string }[]) => entries.every((entry) =>
    entry && validIdentity(entry.id)) && new Set(entries.map((entry) => entry.id)).size === entries.length;
  if (!Array.isArray(item.plans) || !item.plans.length || !uniqueIds(item.plans) ||
    !validIdentity(item.activePlanId) || item.plans.filter((plan) => plan.id === item.activePlanId).length !== 1 ||
    item.plans.some((plan) => typeof plan.preferred !== "boolean") ||
    item.plans.filter((plan) => plan.preferred).length > 1 ||
    !Array.isArray(item.advisory?.needs) ||
    (item.versions !== undefined && (!Array.isArray(item.versions) || !uniqueIds(item.versions)))) return false;
  const holdingIds = new Set((item.depot ?? []).map((holding) => holding?.id));
  const allocationIds = new Set<string>();
  const investmentIds = new Set<string>();
  for (const plan of item.plans) {
    if (!Array.isArray(plan.allocations) || !Array.isArray(plan.investmentPlans) ||
      !Array.isArray(plan.depotHoldingIds) || !uniqueIds(plan.allocations) || !uniqueIds(plan.investmentPlans) ||
      plan.depotHoldingIds.some((id) => !validIdentity(id) || !holdingIds.has(id)) ||
      new Set(plan.depotHoldingIds).size !== plan.depotHoldingIds.length) return false;
    const potIds = new Set<string>(capitalPots(item.advisory, plan.total, item.createdAt).map((pot) => pot.id));
    for (const allocation of plan.allocations) {
      if (allocationIds.has(allocation.id)) return false;
      allocationIds.add(allocation.id);
      if (allocation.capitalPotId !== undefined && !potIds.has(allocation.capitalPotId)) return false;
      if (allocation.capitalPotAmounts !== undefined &&
        (!allocation.capitalPotAmounts || typeof allocation.capitalPotAmounts !== "object" ||
          Array.isArray(allocation.capitalPotAmounts) ||
          Object.keys(allocation.capitalPotAmounts).some((id) => !potIds.has(id)))) return false;
    }
    for (const entry of plan.investmentPlans) {
      if (investmentIds.has(entry.id)) return false;
      investmentIds.add(entry.id);
      if (entry.type === "phased") {
        // Allocation identity is plan-local even though IDs are unique case-wide.
        const allocation = plan.allocations.find((candidate) => candidate.id === entry.allocationId);
        if (!allocation || !potIds.has(entry.capitalPotId) ||
          allocationAmountInCapitalPot(allocation, entry.capitalPotId) <= 0) return false;
      } else if (entry.type === "savings") {
        if (entry.targetRef !== undefined) {
          const target = entry.targetRef;
          if (!target || (target.kind === "need"
            ? typeof target.id !== "number" || !Number.isFinite(target.id) ||
              item.advisory.needs.filter((need) => need?.id === target.id).length !== 1
            : target.kind === "savingsGoal"
              ? !validIdentity(target.id) || (item.savingsGoals ?? []).filter((goal) => goal?.id === target.id).length !== 1
              : true)) return false;
        }
      } else return false;
    }
  }
  return true;
}

export function normalizeImportedCase(
  value: unknown,
  regenerateId = true,
): AdvisoryCase | null {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as { case?: unknown }).case ?? value;
  if (!candidate || typeof candidate !== "object") return null;
  const item = candidate as Partial<AdvisoryCase>;
  if (!item.advisory || typeof item.advisory !== "object" || Array.isArray(item.advisory) ||
    !Array.isArray(item.plans) || !item.plans.length) return null;
  // Missing legacy collections may migrate; malformed present collections may
  // contain recoverable data and must not silently become empty arrays.
  for (const field of ["depot", "depotAccounts", "versions", "savingsGoals"] as const)
    if (item[field] !== undefined && !Array.isArray(item[field])) return null;
  if (item.depotAccounts) {
    const ids = item.depotAccounts.map((account) => account?.id);
    if (ids.some((id) => typeof id !== "string" || !id) || new Set(ids).size !== ids.length) return null;
  }
  const sourceSchemaVersion = Number(item.schemaVersion) || 0;
  if (sourceSchemaVersion > 11) return null;
  if (sourceSchemaVersion >= 10 && !validCurrentPlanGraph(item)) return null;
  const normalized = clone(item) as AdvisoryCase;
  normalized.schemaVersion = 11;
  if (regenerateId) normalized.id = uid("fall-import");
  normalized.updatedAt = iso();
  normalized.versions = Array.isArray(normalized.versions)
    ? normalized.versions
    : [];
  normalized.depotAccounts = Array.isArray(normalized.depotAccounts)
    ? normalized.depotAccounts
        .filter((account) => account && typeof account === "object")
        .map((account, index) => ({
          id: account.id || uid("depot"),
          name: account.name?.trim() || `Depot ${index + 1}`,
          createdAt: account.createdAt || normalized.createdAt || iso(),
          updatedAt: account.updatedAt || normalized.updatedAt || iso(),
        }))
    : [];
  const rawDepot = Array.isArray(normalized.depot) ? normalized.depot : [];
  // Reject structural corruption, but recover optional analysis data per holding.
  if (rawDepot.some((holding) => !holding || typeof holding !== "object" ||
    typeof holding.id !== "string" || !holding.id || typeof holding.name !== "string" ||
    !Number.isFinite(holding.value) || holding.value < 0) ||
    new Set(rawDepot.map((holding) => holding.id)).size !== rawDepot.length) return null;
  let legacyMigrationDepotId: string | undefined;
  if (sourceSchemaVersion < 10 && rawDepot.length > 0 && normalized.depotAccounts.length === 0) {
    const migratedAt = normalized.createdAt || iso();
    legacyMigrationDepotId = uid("depot");
    normalized.depotAccounts = [{
      id: legacyMigrationDepotId,
      name: "Depot 1",
      createdAt: migratedAt,
      updatedAt: normalized.updatedAt || migratedAt,
    }];
  }
  const validDepotIds = new Set(normalized.depotAccounts.map((account) => account.id));
  // Only a newly created pre-multi-depot migration target justifies assignment.
  // Current or already assigned legacy holdings must never guess another depot.
  if (!legacyMigrationDepotId && rawDepot.some((holding) =>
    typeof holding.depotId !== "string" || !holding.depotId || !validDepotIds.has(holding.depotId))) return null;
  normalized.depot = rawDepot
    .map((holding) => ({
        ...normalizeBondHolding(sanitizeOptionalHolding(holding)),
        depotId:
          typeof holding.depotId === "string" && validDepotIds.has(holding.depotId)
            ? holding.depotId
            : legacyMigrationDepotId!,
        value: Math.max(0, Number(holding.value) || 0),
        plannedSale: Math.min(
          Math.max(0, Number(holding.value) || 0),
          Math.max(0, Number(holding.plannedSale) || 0),
        ),
        risk: Number(holding.risk) || 0,
        note: holding.note || "",
        region: holding.region || "Nicht zugeordnet",
        securityType: typeof holding.securityType === "string" ? holding.securityType : typeof holding.sourceType === "string" ? holding.sourceType : undefined,
        classificationStatus:
          holding.classificationStatus || "mapped",
      }));
  if (normalized.depot.length > 0)
    normalized.advisory = withDepotValue(normalized.advisory, normalized.depot);
  normalized.moduleStates = normalized.moduleStates || {};
  normalized.customerChecklist = Array.isArray(normalized.customerChecklist)
    ? normalized.customerChecklist
    : [];
  normalized.savingsGoals = Array.isArray(normalized.savingsGoals)
    ? normalized.savingsGoals.map((goal) => ({
        id: goal.id || uid("savings-goal"),
        name: goal.name || "Sparziel",
        targetAmount: Math.max(0, Number(goal.targetAmount) || 0),
        targetYear: goal.targetYear
          ? Math.trunc(Number(goal.targetYear))
          : undefined,
        targetDate: goal.targetDate || undefined,
        note: goal.note || undefined,
      }))
    : [];
  normalized.advisorId = advisors.some(
    (advisor) => advisor.id === normalized.advisorId,
  )
    ? normalized.advisorId
    : defaultAdvisorId;
  normalized.selectedVvIds = Array.isArray(normalized.selectedVvIds)
    ? normalized.selectedVvIds
    : [];
  normalized.vvFilters = {
    ...blankVvFilters(normalized.advisory.liquidAssets),
    ...(normalized.vvFilters || {}),
    sustainable:
      normalized.vvFilters?.sustainable === "Ja" ? "Ja" : "Keine Präferenz",
  };
  normalized.advisory = migrateRiskAssessment(
    normalized.advisory,
    sourceSchemaVersion,
  );
  normalized.plans = normalized.plans.map((plan) => {
    const total =
      !plan.capitalMode &&
      plan.total === 250000 &&
      normalized.advisory.liquidAssets !== 250000 &&
      (!plan.allocations || plan.allocations.length === 0)
        ? normalized.advisory.liquidAssets
        : plan.total;
    const pots = capitalPots(
      normalized.advisory,
      total,
      normalized.createdAt,
    );
    const allocations = sourceSchemaVersion >= 10 ? plan.allocations : (plan.allocations || []).map((allocation) => {
      const existingPotAmounts = allocationCapitalPotAmounts(allocation);
      if (Object.values(existingPotAmounts).some((amount) => Number(amount) > 0))
        return {
          allocationMode: allocation.allocationMode || "single",
          ...allocation,
          capitalPotAmounts: existingPotAmounts,
        };

      const migratedAmounts: Partial<Record<CapitalPotId, number>> = {};
      let reviewAmount = 0;
      const reviewLabels: string[] = [];
      for (const [bucketId, rawAmount] of Object.entries(
        allocationBucketAmounts(allocation),
      )) {
        const amount = Number(rawAmount) || 0;
        if (amount <= 0) continue;
        const candidates = pots.filter(
          (pot) => pot.legacyBucketId === (bucketId as BucketId),
        );
        if (candidates.length === 1) {
          const target = candidates[0].id;
          migratedAmounts[target] =
            (Number(migratedAmounts[target]) || 0) + amount;
        } else {
          reviewAmount += amount;
          reviewLabels.push(
            maturityBuckets.find((bucket) => bucket.id === bucketId)?.label ||
              bucketId,
          );
        }
      }
      const migratedIds = Object.keys(migratedAmounts) as CapitalPotId[];
      const fallbackCandidate = pots.filter(
        (pot) => pot.legacyBucketId === allocation.bucketId,
      );
      const capitalPotId =
        migratedIds[0] ||
        (fallbackCandidate.length === 1 ? fallbackCandidate[0].id : undefined);
      return {
        allocationMode: allocation.allocationMode || "single",
        ...allocation,
        capitalPotId,
        capitalPotAmounts: migratedAmounts,
        capitalPotReviewAmount: reviewAmount || undefined,
        capitalPotReviewNote: reviewAmount
          ? `Alte Zuordnung ${Array.from(new Set(reviewLabels)).join(", ")} ist nicht eindeutig. Zuordnung prüfen.`
          : undefined,
      };
    });
    const depotHoldingIds = sourceSchemaVersion >= 10 ? plan.depotHoldingIds : Array.isArray(plan.depotHoldingIds)
      ? plan.depotHoldingIds.filter((id) =>
          normalized.depot.some((holding) => holding.id === id),
        )
      : [];
    const migratedRetainSelection =
      sourceSchemaVersion < 7 &&
      plan.depotMode === "retain" &&
      depotHoldingIds.length === 0
        ? normalized.depot.map((holding) => holding.id)
        : depotHoldingIds;
    const normalizedPlan: StructurePlan = {
      ...plan,
      total,
      capitalMode:
        plan.capitalMode ||
        (plan.total === normalized.advisory.liquidAssets ||
        (plan.total === 250000 && (!plan.allocations || plan.allocations.length === 0))
          ? "linked"
          : "manual"),
      depotMode: plan.depotMode || "none",
      depotHoldingIds: migratedRetainSelection,
      depotSelectionInitialized:
        Boolean(plan.depotSelectionInitialized) ||
        (sourceSchemaVersion < 7 && plan.depotMode === "retain"),
      depotModeSelectionInitialized:
        typeof plan.depotModeSelectionInitialized === "boolean"
          ? plan.depotModeSelectionInitialized
          : sourceSchemaVersion < 10
            ? normalized.depot.length > 0 || Boolean(plan.depotMode && plan.depotMode !== "none")
            : false,
      investmentPlans: sourceSchemaVersion >= 10 ? plan.investmentPlans : normalizeInvestmentPlans(
        plan.investmentPlans,
        allocations,
        pots,
        sourceSchemaVersion,
      ),
      allocations,
    };
    return sourceSchemaVersion >= 10 ? normalizedPlan : reconcilePlanCapitalPots(
      normalized.advisory,
      normalizedPlan,
      normalized.createdAt,
      normalized.savingsGoals,
    );
  });
  // Existing historical migrations may resolve old relations; ambiguous identities
  // without a documented migration must still never become a current live case.
  return validCurrentPlanGraph(normalized) ? normalized : null;
}
