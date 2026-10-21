import { controlCase, F021_DATE } from "./f021-fixtures";
import { finalCsv, finalRow } from "./bond-final-fixtures";

// F-020 data translated from audit PR #43; no F-017 diagnostic assertions.
export function saleCase() {
  const c = controlCase("f020");
  c.depotAccounts = ["A", "B"].map(s => ({ id: `audit-depot-${s}`, name: `AUDIT Depot ${s}`, createdAt: F021_DATE, updatedAt: F021_DATE }));
  c.depot = ["A", "B"].map((s, i) => ({ id: `audit-holding-${s}`, depotId: `audit-depot-${s}`,
    name: `AUDIT Position ${s}`, value: i ? 6000 : 10000, plannedSale: i ? 0 : 8000, risk: 3,
    assetClass: "Substanzwerte" as const, region: "Deutschland", note: "Synthetisch", wkn: i ? "ZZAF02" : "ZZAF01",
    excludeFromBondAggregates: false, classificationStatus: "mapped" as const, securityType: "Aktie", currency: "EUR", valuationEnd: "2026-10-15" }));
  c.advisory.hasDepot = true; c.advisory.depotValue = 16000;
  c.plans[0].depotMode = "afterSales"; c.plans[0].depotHoldingIds = c.depot.map(h => h.id);
  c.plans[0].depotSelectionInitialized = true; c.plans[0].depotModeSelectionInitialized = true;
  return c;
}
export function replacementCsv() {
  return finalCsv([finalRow({ Bezeichnung: "AUDIT Position A", WKN: "ZZAF01", Wertpapiertyp: "Aktie", Land: "DE",
    Zinssatz: "", Endfälligkeit: "", Stückzinsen: "", Bewertungsende: "15.10.2026", Kurs: 100,
    "Stück/Nominal": 50, "Kurswert incl. Stückzinsen": 5000 })]);
}
