import type { AdvisoryData } from "../advisory/contracts";
import type {
  BucketId,
  CapitalPotId,
  CapitalPot,
  PlannerAllocation,
  StructurePlan,
  SavingsGoal,
  InvestmentPlan,
} from "./contracts";
import { capitalPots } from "./capital-pots";

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
