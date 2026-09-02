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
  createdAt: string;
  updatedAt: string;
};

export type InvestmentPlan = {
  id: string;
  name: string;
  type: "savings" | "phased";
  productId: string;
  productName: string;
  bucketId: BucketId;
  capitalPotId?: CapitalPotId;
  installmentAmount: number;
  installments: number;
  frequency: "monthly" | "quarterly" | "semiannual" | "annual";
  startDate: string;
  note: string;
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
  currency?: string;
  maturity?: string;
  sourceType?: string;
  classificationStatus?: "mapped" | "matched" | "unresolved";
};

export type VvFilters = {
  sustainable: "Keine Präferenz" | "Ja" | "Nein";
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
  schemaVersion: 6;
  id: string;
  status: "Entwurf" | "In Prüfung" | "Abgeschlossen";
  advisorId: AdvisorId;
  advisory: AdvisoryData;
  plans: StructurePlan[];
  activePlanId: string;
  depot: DepotHolding[];
  moduleStates: Record<string, ModuleState>;
  customerChecklist: CustomerChecklistItem[];
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

export function createCase(
  advisory: AdvisoryData = emptyAdvisory,
  advisorId: AdvisorId = defaultAdvisorId,
): AdvisoryCase {
  const now = iso();
  const data = clone(advisory);
  const initialTotal = data.liquidAssets;
  const plan = createPlan("Plan A – Ausgangsstruktur", initialTotal);
  return {
    schemaVersion: 6,
    id: uid("fall"),
    status: "Entwurf",
    advisorId,
    advisory: data,
    plans: [plan],
    activePlanId: plan.id,
    depot: [],
    moduleStates: {},
    customerChecklist: [],
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

export function dataState() {
  return Object.fromEntries(
    dataSources.map((source) => [source.title, source.date]),
  );
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
  const normalized = clone(item) as AdvisoryCase;
  normalized.schemaVersion = 6;
  if (regenerateId) normalized.id = uid("fall-import");
  normalized.updatedAt = iso();
  normalized.versions = Array.isArray(normalized.versions)
    ? normalized.versions
    : [];
  normalized.depot = Array.isArray(normalized.depot) ? normalized.depot : [];
  normalized.moduleStates = normalized.moduleStates || {};
  normalized.customerChecklist = Array.isArray(normalized.customerChecklist)
    ? normalized.customerChecklist
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
    const firstPotId = pots[0]?.id;
    return {
      ...plan,
      total,
      capitalMode:
        plan.capitalMode ||
        (plan.total === normalized.advisory.liquidAssets ||
        (plan.total === 250000 && (!plan.allocations || plan.allocations.length === 0))
          ? "linked"
          : "manual"),
      depotMode: plan.depotMode || "none",
      depotHoldingIds: Array.isArray(plan.depotHoldingIds)
        ? plan.depotHoldingIds
        : [],
      investmentPlans: Array.isArray(plan.investmentPlans)
        ? plan.investmentPlans.map((entry) => ({
            ...entry,
            capitalPotId:
              entry.capitalPotId ||
              pots.find((pot) => pot.legacyBucketId === entry.bucketId)?.id ||
              firstPotId,
          }))
        : [],
      allocations,
    };
  });
  return normalized;
}
