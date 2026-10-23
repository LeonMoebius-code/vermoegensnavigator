import { createCase } from "../app/case-model";
export function p2ReleaseCase(id = "p2-release") {
  const c = createCase(); c.id = id; c.currentStep = 2; c.createdAt = c.updatedAt = "2026-10-23T12:00:00.000Z";
  Object.assign(c.advisory, { caseName: `SYNTHETISCH ${id}`, liquidAssets: 100000, reserve: 0,
    needs: [{ id: 701, purpose: "SYNTHETISCH Bedarf", amount: 50000, years: 3 }] });
  const p = c.plans[0]; p.id = `${id}-plan`; p.name = "Plan A"; p.total = 40000;
  p.depotSelectionInitialized = false; p.depotModeSelectionInitialized = false;
p.capitalMode = "manual"; p.preferred = true; p.depotMode = "retain";
  p.createdAt = p.updatedAt = c.createdAt; p.allocations = []; p.investmentPlans = []; p.depotHoldingIds = [];
  c.activePlanId = p.id;
  return c;
}
