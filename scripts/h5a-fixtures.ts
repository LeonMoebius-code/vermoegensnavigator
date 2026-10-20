import { createCase, type AdvisoryCase } from "../app/case-model";

/** Synthetic X04 source: recorded reference precedes PR40, never customer data. */
export function h5aLegacyCase(id = "h5a-legacy", partial = false): AdvisoryCase {
  const c = createCase();
  Object.assign(c, { id, createdAt: "2026-10-15T12:00:00.000Z", updatedAt: "2026-10-15T12:00:00.000Z", currentStep: 3 });
  Reflect.set(c, "schemaVersion", 9);
  Object.assign(c.advisory, { caseName: "Synthetischer H5a-Altfall", scope: "private", liquidAssets: 50000,
    depotValue: 0, otherAssets: 0, reserve: 0,
    needs: [{ id: 101, purpose: "Synthetischer Bedarf", amount: 10000, years: 1.49 }] });
  const p = c.plans[0];
  Object.assign(p, { id: "h5a-plan", total: 50000, capitalMode: "manual", createdAt: c.createdAt, updatedAt: c.updatedAt,
    depotMode: "none", depotHoldingIds: [], depotSelectionInitialized: false, depotModeSelectionInitialized: false });
  p.allocations = [{ id: "h5a-allocation", productId: "synthetic-product", productName: "Synthetisches Produkt",
    source: "product", solutionId: "mixed", amount: 10000, bucketId: "year3",
    bucketAmounts: partial ? { year3: 6000, year10plus: 4000 } : { year3: 10000 },
    capitalPotId: "year-2027", capitalPotAmounts: partial ? { "year-2027": 6000, strategic: 4000 } : { "year-2027": 10000 } }];
  p.investmentPlans = [{ id: "h5a-phased", type: "phased", allocationId: "h5a-allocation", capitalPotId: "year-2027",
    stagedMode: "amount", stagedValue: 6000, installments: 6, frequency: "monthly", startDate: "2026-11-01", note: "Original erhalten" }];
  c.activePlanId = p.id;
  return c;
}

export function h5aHealthyCase(id = "h5a-neighbor"): AdvisoryCase {
  const c = h5aLegacyCase(id);
  c.schemaVersion = 11;
  c.advisory.caseName = "Synthetischer H5a-Nachbar";
  c.plans[0].allocations[0].capitalPotId = "year-2028";
  c.plans[0].allocations[0].capitalPotAmounts = { "year-2028": 10000 };
  const e = c.plans[0].investmentPlans[0];
  if (e.type === "phased") e.capitalPotId = "year-2028";
  return c;
}
