import { addDepotAccount, createCase, createPlan, ParsedDepotHolding } from "../app/case-model";
import { finalCsv, finalRow, SyntheticRow } from "./bond-final-fixtures";
import { parseDepotCsv } from "../app/depot-csv";

// Entirely invented inputs. No customer data, anonymized positions, or real WKNs.
export const AS_OF = "2026-01-01T12:00:00.000Z";
export const now = () => new Date(AS_OF);
export function emptyCase() {
  const c = createCase();
  c.createdAt = c.updatedAt = AS_OF; // createdAt is also a planning reference date.
  c.advisory.caseName = "cp0a2-synthetic";
  for (const p of c.plans) p.createdAt = p.updatedAt = AS_OF;
  return c;
}
export const holding = (id: string, value: number, extra: Partial<ParsedDepotHolding> = {}): ParsedDepotHolding => ({
  id, name: `Synthetisch ${id}`, value, assetClass: "Substanzwerte", region: "Deutschland",
  risk: 3, plannedSale: 0, note: "", classificationStatus: "mapped", securityType: "Aktie",
  currency: "EUR", valuationEnd: "2026-01-01", ...extra,
});
export function multiCase() {
  let c = emptyCase();
  c = { ...c, ...addDepotAccount(c, [holding("synthetic-a", 10000, { wkn: "ZZCP01", plannedSale: 2500 })], "Synthetisches Depot A") };
  c = { ...c, ...addDepotAccount(c, [holding("synthetic-b", 6000, { wkn: "ZZCP01", plannedSale: 6000 }),
    holding("synthetic-fund", 4000, { securityType: "Mischfonds", classificationStatus: "unresolved" })], "Synthetisches Depot B") };
  const active = c.plans[0];
  active.preferred = false;
  active.depotMode = "afterSales";
  active.depotHoldingIds = c.depot.map((h) => h.id);
  active.allocations = [{ id: "synthetic-allocation", productId: "synthetic-unknown-product", productName: "Synthetischer Kauf",
    bucketId: "year10plus", amount: 3000, solutionId: "synthetic-solution", source: "product" }];
  const preferred = createPlan("Synthetische bevorzugte Variante", 0);
  preferred.createdAt = preferred.updatedAt = AS_OF;
  preferred.depotMode = "retain";
  preferred.depotHoldingIds = [c.depot[0].id];
  c.plans.push(preferred);
  return c;
}
export function bondCase(row: SyntheticRow) {
  const c = emptyCase();
  return { ...c, ...addDepotAccount(c,
    parseDepotCsv(new TextEncoder().encode(finalCsv([row])).buffer).rows, "Synthetisches Bonddepot") };
}
// Existing independent Decimal70 short-bond fixture; no solver-generated expectations.
export const annual = () => finalRow({ Bezeichnung: "=1+1", WKN: "ZZCPA1" });
export const ambiguous = () => finalRow({ WKN: "ZZCPA2", Bewertungsende: "01.01.2026", Stückzinsen: 0,
  Kurs: 100, "Kurswert incl. Stückzinsen": 10000 });
export const stub = () => finalRow({ Bezeichnung: "Synthetic short first annual", WKN: "ZZCPA3",
  Bewertungsanfang: "01.01.1999", Bewertungsende: "18.09.2026", Endfälligkeit: "27.01.2032",
  Zinssatz: 4.125, "Stück/Nominal": 2000, Kurs: 98.25, "Kurswert incl. Stückzinsen": 1990.77, Stückzinsen: 25.77 });
export const blocked = () => finalRow({ WKN: "ZZCPA4", Wertpapiertyp: "Doppelwährungsanleihe" });
