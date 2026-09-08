import { AdvisoryData, emptyAdvisory } from "./navigator-config";
import {
  AssetClass,
  AssetMix,
  assetClasses,
  dataSources,
  houseProducts,
  managedPortfolios,
} from "./investment-data";

export const maturityBuckets = [
  {
    id: "reserve",
    label: "Reserve",
    range: "jederzeit verfügbar",
    minMonths: 0,
    maxMonths: 0,
  },
  {
    id: "year1",
    label: "Bis 1 Jahr",
    range: "bis 12 Monate",
    minMonths: 1,
    maxMonths: 12,
  },
  {
    id: "year3",
    label: "1–3 Jahre",
    range: "über 12 bis 36 Monate",
    minMonths: 13,
    maxMonths: 36,
  },
  {
    id: "year5",
    label: "3–5 Jahre",
    range: "über 36 bis 60 Monate",
    minMonths: 37,
    maxMonths: 60,
  },
  {
    id: "year10",
    label: "5–10 Jahre",
    range: "über 60 bis 120 Monate",
    minMonths: 61,
    maxMonths: 120,
  },
  {
    id: "year10plus",
    label: "Strategisches Kapital",
    range: "über 120 Monate / ohne festen Bedarf",
    minMonths: 121,
    maxMonths: 600,
  },
] as const;

export type BucketId = (typeof maturityBuckets)[number]["id"];

export type CapitalPotId = "reserve" | "strategic" | `year-${number}`;

export type CapitalPot = {
  id: CapitalPotId;
  kind: "reserve" | "year" | "strategic";
  label: string;
  range: string;
  total: number;
  year?: number;
  needs: AdvisoryData["needs"];
  earliestDueDate?: string;
  minMonths: number;
  legacyBucketId: BucketId;
};

export type PlannerAllocation = {
  id: string;
  productId: string;
  productName: string;
  bucketId: BucketId;
  amount: number;
  solutionId: string;
  source: "product" | "model" | "vv";
  modelId?: string;
  allocationMode?: "single" | "overflow" | "manual";
  bucketAmounts?: Partial<Record<BucketId, number>>;
  capitalPotId?: CapitalPotId;
  capitalPotAmounts?: Partial<Record<CapitalPotId, number>>;
  capitalPotReviewAmount?: number;
  capitalPotReviewNote?: string;
};

export type StructurePlan = {
  id: string;
  name: string;
  total: number;
  capitalMode: "linked" | "manual";
  allocations: PlannerAllocation[];
  investmentPlans: InvestmentPlan[];
  preferred: boolean;
  notes: string;
  modelId?: string;
  modelAmount?: number;
  depotMode: "none" | "compare" | "retain" | "afterSales";
  depotHoldingIds: string[];
  depotSelectionInitialized?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InvestmentFrequency =
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual";

export type SavingsTargetRef =
  | { kind: "savingsGoal"; id: string }
  | { kind: "need"; id: AdvisoryData["needs"][number]["id"] };

export type PhasedEntryPlan = {
  id: string;
  type: "phased";
  allocationId: string;
  capitalPotId: CapitalPotId;
  stagedMode: "percent" | "amount";
  stagedValue: number;
  installments: number;
  frequency: InvestmentFrequency;
  startDate: string;
  note: string;
};

export type SavingsPlan = {
  id: string;
  type: "savings";
  name?: string;
  productId: string;
  productName: string;
  contributionAmount: number;
  frequency: InvestmentFrequency;
  startDate: string;
  targetRef?: SavingsTargetRef;
  note: string;
};

export type InvestmentPlan = PhasedEntryPlan | SavingsPlan;

export type SavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  targetYear?: number;
  targetDate?: string;
  note?: string;
};

export type DepotHolding = {
  id: string;
  productId?: string;
  name: string;
  value: number;
  assetClass: AssetClass;
  region: string;
  risk: number;
  plannedSale: number;
  note: string;
  wkn?: string;
  segment?: string;
  investmentMedium?: string;
  securityType?: string;
  rawCountry?: string;
  currency?: string;
  industry?: string;
  certificateClass?: string;
  coupon?: number;
  maturity?: string;
  nominalOrUnits?: number;
  lastPurchaseDate?: string;
  averageEntryPrice?: number;
  purchaseCosts?: number;
  currentPrice?: number;
  gainLossPercent?: number;
  gainLossAmount?: number;
  accruedInterest?: number;
  sourceDepotShare?: number;
  averageEntryFx?: number;
  fxRate?: number;
  valuationStart?: string;
  valuationEnd?: string;
  holdingAtValuationStart?: number;
  holdingAtValuationEnd?: number;
  /** Compatibility with depot positions saved before V0.13. */
  sourceType?: string;
  classificationStatus?: "mapped" | "matched" | "unresolved";
};

export type VvFilters = {
  sustainable: "Keine Präferenz" | "Ja";
  currency: "Keine Präferenz" | "EUR" | "CHF";
  region: string;
  metals: "Keine Präferenz" | "Ja" | "Nein" | "Individuell";
  amount: number;
  targetFunds: "Keine Präferenz" | "Ja" | "Nein";
  equityBand: "Keine Präferenz" | "Unter 50%" | "Über 50%" | "Individuell";
  individual: "Keine Präferenz" | "Ja" | "Nein";
  billingCountry: "Keine Präferenz" | "Deutschland" | "Schweiz";
  custody: string;
  maxRisk: number;
};

export type CaseSnapshot = Omit<AdvisoryCase, "versions">;
export type CaseVersion = {
  id: string;
  label: string;
  createdAt: string;
  snapshot: CaseSnapshot;
};

export type ModuleStatus = "not_started" | "in_progress" | "complete";

export type ModuleState = {
  status: ModuleStatus;
  currentSlide: number;
  checklist: Record<string, boolean>;
  notes: string;
  updatedAt: string;
};

export const advisors = [
  {
    id: "leon-moebius",
    initials: "LM",
    name: "Leon Möbius",
    title: "Spezialist Vermögensmanagement",
  },
  {
    id: "jochen-walz",
    initials: "JW",
    name: "Jochen Walz",
    title: "Spezialist Vermögensmanagement",
  },
  {
    id: "david-gerhardt",
    initials: "DG",
    name: "David Gerhardt",
    title: "Spezialist Vermögensmanagement",
  },
  {
    id: "michael-friedrich",
    initials: "MF",
    name: "Michael Friedrich",
    title: "Spezialist Vermögensmanagement",
  },
  {
    id: "corinna-roehl",
    initials: "CR",
    name: "Corinna Röhl",
    title: "Spezialistin Vermögensmanagement",
  },
  {
    id: "emanuel-bock",
    initials: "EB",
    name: "Emanuel Bock",
    title: "Spezialist Vermögensmanagement",
  },
] as const;

export type AdvisorId = (typeof advisors)[number]["id"];
export const defaultAdvisorId: AdvisorId = "leon-moebius";

export const customerChecklistCategories = [
  "Unterlage mitbringen",
  "Antrag oder Formular",
  "Externe Klärung",
  "Sonstiger nächster Schritt",
] as const;

export type CustomerChecklistCategory =
  (typeof customerChecklistCategories)[number];

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

export type AdvisoryCase = {
  schemaVersion: 8;
  id: string;
  status: "Entwurf" | "In Prüfung" | "Abgeschlossen";
  advisorId: AdvisorId;
  advisory: AdvisoryData;
  plans: StructurePlan[];
  activePlanId: string;
  depot: DepotHolding[];
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

export const blankVvFilters = (amount = 0): VvFilters => ({
  sustainable: "Keine Präferenz",
  currency: "Keine Präferenz",
  region: "Keine Präferenz",
  metals: "Keine Präferenz",
  amount,
  targetFunds: "Keine Präferenz",
  equityBand: "Keine Präferenz",
  individual: "Keine Präferenz",
  billingCountry: "Keine Präferenz",
  custody: "Keine Präferenz",
  maxRisk: 4,
});

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
    preferred: true,
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
  return {
    schemaVersion: 8,
    id: uid("fall"),
    status: "Entwurf",
    advisorId,
    advisory: data,
    plans: [plan],
    activePlanId: plan.id,
    depot: [],
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
  const snapshot = clone(item) as Partial<AdvisoryCase>;
  delete snapshot.versions;
  return snapshot as CaseSnapshot;
}

export function monthsUntilNeed(
  need: AdvisoryData["needs"][number],
  referenceDate: Date | string = new Date(),
): number {
  const dueDate = (need as AdvisoryData["needs"][number] & { dueDate?: string })
    .dueDate;
  if (dueDate) {
    const due = new Date(`${dueDate}T12:00:00`);
    if (!Number.isNaN(due.getTime())) {
      const now =
        referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
      return Math.max(
        0,
        (due.getFullYear() - now.getFullYear()) * 12 +
          due.getMonth() -
          now.getMonth(),
      );
    }
  }
  return Math.max(0, Math.round(need.years * 12));
}

function referenceYear(referenceDate: Date | string) {
  const date =
    referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
}

export function targetYearForNeed(
  need: AdvisoryData["needs"][number],
  referenceDate: Date | string = new Date(),
) {
  if (need.dueDate) {
    const year = Number(need.dueDate.slice(0, 4));
    if (Number.isFinite(year) && year > 1900) return year;
  }
  return referenceYear(referenceDate) + Math.max(0, Math.round(need.years));
}

export function capitalPots(
  data: AdvisoryData,
  total: number,
  referenceDate: Date | string = new Date(),
): CapitalPot[] {
  const pots: CapitalPot[] = [];
  if (data.reserve > 0)
    pots.push({
      id: "reserve",
      kind: "reserve",
      label: "Liquiditätsreserve",
      range: "jederzeit verfügbar",
      total: data.reserve,
      needs: [],
      minMonths: 0,
      legacyBucketId: "reserve",
    });

  const needsByYear = new Map<number, AdvisoryData["needs"]>();
  for (const need of data.needs) {
    if (need.amount <= 0) continue;
    const year = targetYearForNeed(need, referenceDate);
    needsByYear.set(year, [...(needsByYear.get(year) || []), need]);
  }
  for (const [year, needs] of [...needsByYear.entries()].sort(
    ([left], [right]) => left - right,
  )) {
    const exactDates = needs
      .map((need) => need.dueDate)
      .filter((date): date is string => Boolean(date))
      .sort();
    const minMonths = Math.min(
      ...needs.map((need) => monthsUntilNeed(need, referenceDate)),
    );
    pots.push({
      id: `year-${year}`,
      kind: "year",
      label: String(year),
      range: `${needs.length} ${needs.length === 1 ? "Kapitalbedarf" : "Kapitalbedarfe"}`,
      total: needs.reduce((sum, need) => sum + need.amount, 0),
      year,
      needs,
      earliestDueDate: exactDates[0],
      minMonths,
      legacyBucketId: bucketForMonths(minMonths),
    });
  }

  const strategic = strategicAmount(data, total);
  if (strategic > 0)
    pots.push({
      id: "strategic",
      kind: "strategic",
      label: "Strategisch verfügbares Kapital",
      range: "kein konkreter Bedarf / langfristig verfügbar",
      total: strategic,
      needs: [],
      minMonths: 600,
      legacyBucketId: "year10plus",
    });
  return pots;
}

export function planningShortfall(data: AdvisoryData, total: number) {
  const fixed =
    data.reserve + data.needs.reduce((sum, need) => sum + need.amount, 0);
  return Math.max(0, fixed - total);
}

export function bucketForMonths(months: number): BucketId {
  if (months <= 12) return "year1";
  if (months <= 36) return "year3";
  if (months <= 60) return "year5";
  if (months <= 120) return "year10";
  return "year10plus";
}

export function bucketTargets(
  data: AdvisoryData,
  total: number,
): Record<BucketId, number> {
  const targets = Object.fromEntries(
    maturityBuckets.map((bucket) => [bucket.id, 0]),
  ) as Record<BucketId, number>;
  targets.reserve = data.reserve;
  for (const need of data.needs)
    targets[bucketForMonths(monthsUntilNeed(need))] += need.amount;
  const fixed =
    data.reserve + data.needs.reduce((sum, need) => sum + need.amount, 0);
  targets.year10plus += Math.max(0, total - fixed);
  return targets;
}

export function strategicAmount(data: AdvisoryData, total: number) {
  return Math.max(
    0,
    total -
      data.reserve -
      data.needs.reduce((sum, need) => sum + need.amount, 0),
  );
}

export function productAssetMix(productId: string): AssetMix | null {
  return (
    houseProducts.find((item) => item.id === productId)?.assetMix ??
    managedPortfolios.find((item) => item.id === productId)?.assetMix ??
    null
  );
}

export function allocationBucketAmounts(
  allocation: PlannerAllocation,
): Partial<Record<BucketId, number>> {
  if (
    allocation.bucketAmounts &&
    Object.values(allocation.bucketAmounts).some((value) => Number(value) > 0)
  )
    return allocation.bucketAmounts;
  return { [allocation.bucketId]: allocation.amount };
}

export function allocationAmountInBucket(
  allocation: PlannerAllocation,
  bucketId: BucketId,
): number {
  return Number(allocationBucketAmounts(allocation)[bucketId]) || 0;
}

export function allocationCoverageTotal(allocation: PlannerAllocation): number {
  return Object.values(allocationBucketAmounts(allocation)).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );
}

export function allocationCapitalPotAmounts(
  allocation: PlannerAllocation,
): Partial<Record<CapitalPotId, number>> {
  if (
    allocation.capitalPotAmounts &&
    Object.values(allocation.capitalPotAmounts).some(
      (value) => Number(value) > 0,
    )
  )
    return allocation.capitalPotAmounts;
  return allocation.capitalPotId
    ? { [allocation.capitalPotId]: allocation.amount }
    : {};
}

export function allocationAmountInCapitalPot(
  allocation: PlannerAllocation,
  capitalPotId: CapitalPotId,
) {
  return Number(allocationCapitalPotAmounts(allocation)[capitalPotId]) || 0;
}

export function allocationCapitalCoverageTotal(allocation: PlannerAllocation) {
  return Object.values(allocationCapitalPotAmounts(allocation)).reduce<number>(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );
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

export function legacyBucketAmountsForCapitalPots(
  pots: CapitalPot[],
  amounts: Partial<Record<CapitalPotId, number>>,
) {
  const result: Partial<Record<BucketId, number>> = {};
  for (const pot of pots) {
    const amount = Number(amounts[pot.id]) || 0;
    if (amount <= 0) continue;
    result[pot.legacyBucketId] =
      (Number(result[pot.legacyBucketId]) || 0) + amount;
  }
  return result;
}

export type CapitalPotRemovalImpact = {
  removedPotIds: CapitalPotId[];
  allocationCount: number;
  allocationAmount: number;
  investmentPlanCount: number;
};

export function capitalPotRemovalImpact(
  before: AdvisoryData,
  after: AdvisoryData,
  plans: StructurePlan[],
  referenceDate: Date | string = new Date(),
): CapitalPotRemovalImpact {
  const removedPotIds = Array.from(
    new Set(
      plans.flatMap((plan) => {
        const beforeIds = new Set(
          capitalPots(before, plan.total, referenceDate).map((pot) => pot.id),
        );
        const afterIds = new Set(
          capitalPots(after, plan.total, referenceDate).map((pot) => pot.id),
        );
        return [...beforeIds].filter((id) => !afterIds.has(id));
      }),
    ),
  );
  const removed = new Set(removedPotIds);
  let allocationCount = 0;
  let allocationAmount = 0;
  let investmentPlanCount = 0;
  for (const plan of plans) {
    for (const allocation of plan.allocations) {
      const affected = Object.entries(allocationCapitalPotAmounts(allocation))
        .filter(([id, amount]) => removed.has(id as CapitalPotId) && Number(amount) > 0)
        .reduce((sum, [, amount]) => sum + (Number(amount) || 0), 0);
      if (affected > 0) {
        allocationCount += 1;
        allocationAmount += affected;
      }
    }
    investmentPlanCount += (plan.investmentPlans || []).filter(
      (entry) =>
        entry.type === "phased" && removed.has(entry.capitalPotId),
    ).length;
  }
  return {
    removedPotIds,
    allocationCount,
    allocationAmount,
    investmentPlanCount,
  };
}

export function reconcilePlanCapitalPots(
  advisory: AdvisoryData,
  plan: StructurePlan,
  referenceDate: Date | string = new Date(),
  savingsGoals?: SavingsGoal[],
): StructurePlan {
  const pots = capitalPots(advisory, plan.total, referenceDate);
  const validIds = new Set(pots.map((pot) => pot.id));
  const allocations = plan.allocations.flatMap((allocation) => {
    const previousAmounts = allocationCapitalPotAmounts(allocation);
    const hadMappedAmounts = Object.values(previousAmounts).some(
      (amount) => Number(amount) > 0,
    );
    if (!hadMappedAmounts)
      return [{
        ...allocation,
        capitalPotId:
          allocation.capitalPotId && validIds.has(allocation.capitalPotId)
            ? allocation.capitalPotId
            : undefined,
        capitalPotAmounts: {},
        bucketAmounts: {},
      }];

    const previousCoverage = Object.values(previousAmounts).reduce<number>(
      (sum, amount) => sum + Math.max(0, Number(amount) || 0),
      0,
    );
    const validAmounts = Object.fromEntries(
      Object.entries(previousAmounts).filter(
        ([id, amount]) =>
          validIds.has(id as CapitalPotId) && Number(amount) > 0,
      ),
    ) as Partial<Record<CapitalPotId, number>>;
    const validCoverage = Object.values(validAmounts).reduce<number>(
      (sum, amount) => sum + (Number(amount) || 0),
      0,
    );
    if (validCoverage <= 0) return [];

    const unassignedBefore = Math.max(0, allocation.amount - previousCoverage);
    const amount = validCoverage + unassignedBefore;
    const validPotIds = Object.keys(validAmounts) as CapitalPotId[];
    const capitalPotId =
      allocation.capitalPotId && validAmounts[allocation.capitalPotId]
        ? allocation.capitalPotId
        : validPotIds[0];
    return [{
      ...allocation,
      amount,
      capitalPotId,
      capitalPotAmounts: validAmounts,
      bucketId:
        pots.find((pot) => pot.id === capitalPotId)?.legacyBucketId ||
        allocation.bucketId,
      bucketAmounts: legacyBucketAmountsForCapitalPots(pots, validAmounts),
    }];
  });
  const allocationById = new Map(
    allocations.map((allocation) => [allocation.id, allocation]),
  );
  const needIds = new Set(advisory.needs.map((need) => need.id));
  const savingsGoalIds = savingsGoals
    ? new Set(savingsGoals.map((goal) => goal.id))
    : undefined;
  const investmentPlans = (plan.investmentPlans || []).flatMap<InvestmentPlan>((entry) => {
    if (entry.type === "phased") {
      const allocation = allocationById.get(entry.allocationId);
      return allocation &&
        validIds.has(entry.capitalPotId) &&
        allocationAmountInCapitalPot(allocation, entry.capitalPotId) > 0 &&
        Number(entry.stagedValue) > 0 &&
        Number.isInteger(entry.installments) &&
        entry.installments > 0
        ? [entry]
        : [];
    }
    if (!entry.targetRef) return [entry];
    const targetExists =
      entry.targetRef.kind === "need"
        ? needIds.has(entry.targetRef.id)
        : savingsGoalIds
          ? savingsGoalIds.has(entry.targetRef.id)
          : true;
    return targetExists ? [entry] : [{ ...entry, targetRef: undefined }];
  });
  return {
    ...plan,
    allocations,
    investmentPlans,
  };
}

export function reconcileCasePlans(
  advisory: AdvisoryData,
  plans: StructurePlan[],
  referenceDate: Date | string = new Date(),
  savingsGoals?: SavingsGoal[],
) {
  return plans.map((plan) =>
    reconcilePlanCapitalPots(advisory, plan, referenceDate, savingsGoals),
  );
}

const normalizedHoldingWkn = (holding: DepotHolding) =>
  (holding.wkn || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

function uniqueHoldingMatch(
  holding: DepotHolding,
  nextDepot: DepotHolding[],
) {
  const wkn = normalizedHoldingWkn(holding);
  const candidates = wkn
    ? nextDepot.filter((entry) => normalizedHoldingWkn(entry) === wkn)
    : holding.productId
      ? nextDepot.filter((entry) => entry.productId === holding.productId)
      : nextDepot.filter(
          (entry) =>
            entry.name.trim().toLocaleLowerCase("de-DE") ===
              holding.name.trim().toLocaleLowerCase("de-DE") &&
            (entry.securityType || "") === (holding.securityType || ""),
        );
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function reconcileDepotHoldingSelections(
  plans: StructurePlan[],
  previousDepot: DepotHolding[],
  nextDepot: DepotHolding[],
  mode: "replace" | "append" = "replace",
) {
  const nextIds = new Set(nextDepot.map((holding) => holding.id));
  const previousById = new Map(
    previousDepot.map((holding) => [holding.id, holding]),
  );
  return plans.map((plan) => {
    const mappedIds = plan.depotHoldingIds.flatMap((id) => {
      if (nextIds.has(id)) return [id];
      if (mode === "append") return [];
      const previous = previousById.get(id);
      const match = previous && uniqueHoldingMatch(previous, nextDepot);
      return match ? [match.id] : [];
    });
    return {
      ...plan,
      depotHoldingIds: Array.from(new Set(mappedIds)),
    };
  });
}

export function planAssetAmounts(plan: StructurePlan) {
  const amounts = Object.fromEntries(
    assetClasses.map((name) => [name, 0]),
  ) as Record<AssetClass, number>;
  let unresolved = 0;
  for (const allocation of plan.allocations) {
    const assetMix = productAssetMix(allocation.productId);
    if (!assetMix) {
      unresolved += allocation.amount;
      continue;
    }
    for (const name of assetClasses)
      amounts[name] += (allocation.amount * assetMix[name]) / 100;
  }
  return {
    amounts,
    unresolved,
    total: plan.allocations.reduce((sum, item) => sum + item.amount, 0),
  };
}

export function depotAssetAmounts(
  depot: DepotHolding[],
  valueFor: (holding: DepotHolding) => number = (holding) => holding.value,
) {
  const amounts = Object.fromEntries(
    assetClasses.map((name) => [name, 0]),
  ) as Record<AssetClass, number>;
  let unresolved = 0;
  let total = 0;
  for (const holding of depot) {
    const value = Math.max(0, Number(valueFor(holding)) || 0);
    total += value;
    const assetMix = holding.productId
      ? productAssetMix(holding.productId)
      : null;
    if (assetMix) {
      for (const name of assetClasses)
        amounts[name] += (value * assetMix[name]) / 100;
    } else if (holding.classificationStatus !== "unresolved") {
      amounts[holding.assetClass] += value;
    } else {
      unresolved += value;
    }
  }
  return { amounts, unresolved, total };
}

export function plannerIstHoldingValue(
  plan: StructurePlan,
  holding: DepotHolding,
) {
  return plan.depotMode === "none" ? 0 : Math.max(0, holding.value);
}

export function plannerPlanHoldingValue(
  plan: StructurePlan,
  holding: DepotHolding,
) {
  if (plan.depotMode === "afterSales")
    return Math.max(0, holding.value - holding.plannedSale);
  if (
    plan.depotMode === "retain" &&
    plan.depotHoldingIds.includes(holding.id)
  )
    return Math.max(0, holding.value);
  return 0;
}

export function depotPlanAssetAmounts(
  depot: DepotHolding[],
  plan: StructurePlan,
) {
  const retained = depotAssetAmounts(
    depot,
    (holding) => Math.max(0, holding.value - holding.plannedSale),
  );
  const purchases = planAssetAmounts(plan);
  const amounts = Object.fromEntries(
    assetClasses.map((name) => [
      name,
      retained.amounts[name] + purchases.amounts[name],
    ]),
  ) as Record<AssetClass, number>;
  return {
    amounts,
    unresolved: retained.unresolved + purchases.unresolved,
    total: retained.total + purchases.total,
  };
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

export function normalizeImportedCase(
  value: unknown,
  regenerateId = true,
): AdvisoryCase | null {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as { case?: unknown }).case ?? value;
  if (!candidate || typeof candidate !== "object") return null;
  const item = candidate as Partial<AdvisoryCase>;
  if (!item.advisory || !Array.isArray(item.plans)) return null;
  const sourceSchemaVersion = Number(item.schemaVersion) || 0;
  const normalized = clone(item) as AdvisoryCase;
  normalized.schemaVersion = 8;
  if (regenerateId) normalized.id = uid("fall-import");
  normalized.updatedAt = iso();
  normalized.versions = Array.isArray(normalized.versions)
    ? normalized.versions
    : [];
  normalized.depot = Array.isArray(normalized.depot)
    ? normalized.depot.map((holding) => ({
        ...holding,
        value: Math.max(0, Number(holding.value) || 0),
        plannedSale: Math.min(
          Math.max(0, Number(holding.value) || 0),
          Math.max(0, Number(holding.plannedSale) || 0),
        ),
        risk: Number(holding.risk) || 0,
        note: holding.note || "",
        region: holding.region || "Nicht zugeordnet",
        securityType: holding.securityType || holding.sourceType,
        classificationStatus:
          holding.classificationStatus || "mapped",
      }))
    : [];
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
  normalized.advisory.riskAssessment = normalized.advisory.riskAssessment || {
    lossReaction: null,
    temporaryLoss: null,
    financialCapacity: null,
  };
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
    const allocations = (plan.allocations || []).map((allocation) => {
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
    const depotHoldingIds = Array.isArray(plan.depotHoldingIds)
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
      investmentPlans: normalizeInvestmentPlans(
        plan.investmentPlans,
        allocations,
        pots,
        sourceSchemaVersion,
      ),
      allocations,
    };
    return reconcilePlanCapitalPots(
      normalized.advisory,
      normalizedPlan,
      normalized.createdAt,
      normalized.savingsGoals,
    );
  });
  return normalized;
}
