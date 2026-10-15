import { duplicateStructurePlan } from "./plan-identity";
import type { ModelPortfolio } from "../catalog/contracts";
import { managedPortfolios } from "../../data/managed-portfolios";
import {
  allocationCapitalPotAmounts,
  allocationAmountInCapitalPot,
  legacyBucketAmountsForCapitalPots,
} from "./allocations";
import type {
  CapitalPot,
  CapitalPotId,
  PlannerAllocation,
  StructurePlan,
} from "./contracts";

export type ModelPortfolioAction = "new" | "supplement" | "replace";

/** Same whole-euro allocation as the existing model application. */
export function modelPortfolioHoldingAmount(amount: number, weight: number) {
  return Math.round((amount * weight) / 100);
}

/** Only the three explicitly approved Private Select model strategies. */
export function modelPortfolioMinimumInvestments(model: ModelPortfolio, amount: number) {
  if (!Number.isFinite(amount) || amount < 0) return [];
  return model.holdings.flatMap((holding) => {
    if (!["ps-defensiv", "ps-ausgewogen", "ps-offensiv"].includes(holding.productId)) return [];
    const strategy = managedPortfolios.find((entry) => entry.id === holding.productId);
    if (!strategy) return [];
    const investment = modelPortfolioHoldingAmount(amount, holding.weight);
    return [{ productId: strategy.id, name: strategy.name, weight: holding.weight,
      amount: investment, minimum: strategy.minimum,
      shortfall: Math.max(0, strategy.minimum - investment) }];
  });
}

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
