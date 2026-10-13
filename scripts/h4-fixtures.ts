import { createCase, type AdvisoryCase, type PhasedEntryPlan } from "../app/case-model";

/** Deterministic, entirely synthetic two-pot case, shared by H4 and CP0B. */
export function h4Case(id = "h4-current"): AdvisoryCase {
  const c = createCase();
  Object.assign(c, { id, createdAt: "2026-01-01T12:00:00.000Z", updatedAt: "2026-01-01T12:00:00.000Z" });
  Object.assign(c.advisory, { caseName: "CP0B H4 Raten", scope: "private", liquidAssets: 100000,
    reserve: 0, needs: [{ id: 1, purpose: "Synthetischer Bedarf", amount: 30000, years: 4, dueDate: "2030-01-31" }] });
  const p = c.plans[0];
  Object.assign(p, { id: "h4-plan", name: "Synthetischer H4-Plan", total: 100000, capitalMode: "manual",
    createdAt: c.createdAt, updatedAt: c.updatedAt, depotMode: "none", depotHoldingIds: [], depotSelectionInitialized: false, depotModeSelectionInitialized: false });
  p.allocations = ["strategic", "year-2030"].map((pot, i) => ({ id: `h4-allocation-${i}`,
    productId: `h4-synthetic-${i}`, productName: `Synthetisches H4-Produkt ${i + 1}`, solutionId: "synthetic",
    source: "product", bucketId: i ? "year5" : "year10plus", amount: i ? 30000 : 70000,
    capitalPotId: pot as PhasedEntryPlan["capitalPotId"], capitalPotAmounts: { [pot]: i ? 30000 : 70000 }, allocationMode: "single" }));
  p.investmentPlans = p.allocations.map((a, i) => ({ id: `h4-phased-${i}`, type: "phased", allocationId: a.id,
    capitalPotId: a.capitalPotId!, stagedMode: "amount", stagedValue: i ? 6000 : 100, installments: i ? 6 : 3,
    frequency: "monthly", startDate: "2026-01-31", note: "" }));
  c.activePlanId = p.id; c.currentStep = 2;
  return c;
}
