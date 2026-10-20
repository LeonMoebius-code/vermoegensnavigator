import { validCapitalPotRecovery } from "./recovery-contract";
import { uid, iso, clone } from "./runtime";
import { validCaseFinancialInputs } from "./financial-validation";
import { legacyCapitalProtection } from "./legacy-capital-protection";
import { validCurrentPlanGraph } from "../planning/plan-identity";
import { legacyPhasedInstallments } from "../planning/installment-validation";
import { withDepotValue } from "../depot/lifecycle";
import {
  allocationBucketAmounts,
  allocationCapitalPotAmounts,
  allocationAmountInCapitalPot,
  reconcilePlanCapitalPots,
} from "../planning/allocations";
import { capitalPots, maturityBuckets } from "../planning/capital-pots";
import { advisors, defaultAdvisorId } from "../../data/advisors";
import { blankVvFilters } from "../vv/defaults";
import { sanitizeOptionalHolding } from "../../depot-validation";
import { normalizeBondHolding } from "../../bond-source";
import { emptyRiskAssessmentV2 } from "../advisory/defaults";
import { completeRiskAssessment, triangleRiskScore } from "../risk/orientation";
import type { AdvisoryCase } from "./contracts";
import type { AdvisoryData } from "../advisory/contracts";
import type {
  BucketId,
  CapitalPotId,
  CapitalPot,
  PlannerAllocation,
  StructurePlan,
  InvestmentFrequency,
  SavingsTargetRef,
  InvestmentPlan,
} from "../planning/contracts";
import type {
  LegacyRiskAssessment,
  RiskAssessmentV2,
  RiskLevel,
  RiskSelectionSource,
} from "../risk/contracts";

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
        installments: sourceSchemaVersion >= 10
          ? entry.installments! : legacyPhasedInstallments(entry.installments)!,
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
    const installments = legacyPhasedInstallments(entry.installments)!;
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
    // Missing/blank legacy names keep their default; present invalid types do
    // not become names and must be rejected before the existing trim operation.
    if (item.depotAccounts.some((account) =>
      account.name !== undefined && typeof account.name !== "string")) return null;
  }
  if (item.capitalPotRecovery !== undefined && !validCapitalPotRecovery(item.capitalPotRecovery)) return null;
  const sourceSchemaVersion = Number(item.schemaVersion) || 0;
  if (sourceSchemaVersion > 11) return null;
  if (!validCaseFinancialInputs(item, sourceSchemaVersion)) return null;
  if (sourceSchemaVersion >= 10 && !validCurrentPlanGraph(item)) return null;
  if (sourceSchemaVersion < 10 && legacyCapitalProtection(item) !== "safe") return null;
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
  return validCaseFinancialInputs(normalized) && validCurrentPlanGraph(normalized) ? normalized : null;
}
