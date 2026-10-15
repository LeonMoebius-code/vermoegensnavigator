import { addDepotAccount, caseSnapshot, createCase, type AdvisoryCase } from "../app/case-model";

/** Entirely synthetic; fixed recorded calendar date for all relative needs. */
export function qualityNeedsCase(id = "quality-needs"): AdvisoryCase {
  const c = createCase();
  Object.assign(c, { id, createdAt: "2026-10-15T23:30:00.000Z", updatedAt: "2026-10-15T23:30:00.000Z", currentStep: 3 });
  Object.assign(c.advisory, { caseName: "Synthetische Zeitrechnung", scope: "private", liquidAssets: 160000, reserve: 0,
    needs: [{ id: 1, purpose: "Relativ 1,49", amount: 10000, years: 1.49 },
      { id: 2, purpose: "Relativ 1,50", amount: 20000, years: 1.5 },
      { id: 3, purpose: "Konkreter Termin", amount: 5000, years: 9, dueDate: "2028-04-01" }] });
  Object.assign(c.plans[0], { total: 160000, depotSelectionInitialized: false, depotModeSelectionInitialized: false, createdAt: c.createdAt, updatedAt: c.updatedAt });
  c.versions = [{ id: "quality-history", label: "Unveränderte Historie", createdAt: c.createdAt, snapshot: caseSnapshot(c) }];
  return c;
}

export function qualityOptionalCase(id = "quality-optional"): AdvisoryCase {
  let c = qualityNeedsCase(id);
  c.advisory.caseName = "Synthetische optionale Daten";
  c = { ...c, ...addDepotAccount(c, [
    { id: "synthetic-optional-a", name: "Synthetische Position A", value: 1000, plannedSale: 0,
      assetClass: "Geldwerte", region: "Deutschland", risk: 2, note: "", coupon: 2, maturity: "2030-01-01" },
    { id: "synthetic-optional-b", name: "Synthetische Position B", value: 2000, plannedSale: 0,
      assetClass: "Substanzwerte", region: "Deutschland", risk: 3, note: "", currency: "EUR" },
  ], "Synthetisches Depot") };
  Reflect.set(c.depot[0], "coupon", "VERTRAULICHER-TESTWERT");
  Reflect.set(c.depot[0], "maturity", "2027-02-29");
  Reflect.set(c.depot[1], "currency", { synthetic: true });
  return c;
}

export function qualityProtectedCase(): AdvisoryCase {
  const c = qualityNeedsCase("quality-protected");
  c.advisory.caseName = "Synthetischer geschützter Fall";
  Reflect.set(c.advisory, "liquidAssets", "INVALID-SYNTHETIC");
  return c;
}
