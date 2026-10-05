import type { AssetClass, AssetMix } from "../assets/contracts";
import { assetClasses } from "../assets/contracts";
import type { DepotHolding } from "../depot/contracts";
import type { StructurePlan } from "../planning/contracts";
import { houseProducts } from "../../data/house-products";
import { managedPortfolios } from "../../data/managed-portfolios";

export function productAssetMix(productId: string): AssetMix | null {
  return (
    houseProducts.find((item) => item.id === productId)?.assetMix ??
    managedPortfolios.find((item) => item.id === productId)?.assetMix ??
    null
  );
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

/** Complete, read-only wealth structure, including unresolved exposure. */
export type WealthStructureSnapshot = {
  amounts: Record<AssetClass, number>;
  unresolved: number;
  total: number;
};

/** IST is independent of every planning choice and planned transaction. */
export function buildIstWealthStructure(
  depot: DepotHolding[],
  currentLiquidity: number,
): WealthStructureSnapshot {
  const actual = depotAssetAmounts(depot);
  return {
    amounts: { ...actual.amounts, Liquidität: actual.amounts.Liquidität + currentLiquidity },
    unresolved: actual.unresolved,
    total: actual.total + currentLiquidity,
  };
}

/** PLAN and ZIELPLAN differ only in the plan supplied by the caller. */
export function buildPlanWealthStructure(
  depot: DepotHolding[],
  plan: StructurePlan,
): WealthStructureSnapshot {
  const retained = depotAssetAmounts(depot, (holding) => plannerPlanHoldingValue(plan, holding));
  const purchases = planAssetAmounts(plan);
  const unallocated = Math.max(0, plan.total - purchases.total);
  const amounts = Object.fromEntries(assetClasses.map((name) => [
    name,
    retained.amounts[name] + purchases.amounts[name] + (name === "Liquidität" ? unallocated : 0),
  ])) as Record<AssetClass, number>;
  return {
    amounts,
    unresolved: retained.unresolved + purchases.unresolved,
    total: retained.total + purchases.total + unallocated,
  };
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
