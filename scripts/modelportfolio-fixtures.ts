import { createCase, type PlannerAllocation } from "../app/case-model";

export function modelPortfolioCase() {
  const item = createCase();
  Object.assign(item.advisory, { caseName: "Synthetische Modellportfolio-Durchschau", scope: "private",
    liquidAssets: 160000, reserve: 0, needs: [] });
  item.currentStep = 2;
  item.plans[0].total = 160000;
  item.plans[0].depotSelectionInitialized = false;
  item.plans[0].depotModeSelectionInitialized = false;
  item.plans[0].allocations = [modelAllocation("existing", "uniglobal", "Bestehender Aktienfonds", 40000)];
  return item;
}

export function modelAllocation(id: string, productId: string, productName: string, amount: number): PlannerAllocation {
  return { id, productId, productName, amount, bucketId: "year10plus", solutionId: "mixed", source: "product",
    capitalPotId: "strategic", capitalPotAmounts: { strategic: amount }, bucketAmounts: { year10plus: amount }, allocationMode: "single" };
}
