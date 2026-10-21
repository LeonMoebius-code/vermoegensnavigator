import type { RiskLevel } from "../../app/navigator-config";
import { createCase, caseSnapshot, normalizeImportedCase, type AdvisoryCase } from "../../app/case-model";
import { finalCsv, finalRow } from "../../scripts/bond-final-fixtures";
export const AUDIT_DATE = "2026-10-15T12:00:00.000Z";
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
export function auditCase(id = "audit-control"): AdvisoryCase {
  const c = createCase();
  Object.assign(c, { id, createdAt: AUDIT_DATE, updatedAt: AUDIT_DATE, currentStep: 3 });
  Object.assign(c.advisory, { caseName: `AUDIT SYNTHETISCH ${id}`, scope: "private", liquidAssets: 200000,
    reserve: 0, needs: [], horizon: 20, risk: 1, riskSelectionSource: "manual" });
  Object.assign(c.plans[0], { id: `${id}-plan`, total: 200000, createdAt: AUDIT_DATE, updatedAt: AUDIT_DATE,
    preferred: true, allocations: [], investmentPlans: [] });
  c.activePlanId = c.plans[0].id; c.vvFilters.amount = 200000;
  return c;
}
export function saleCase(): AdvisoryCase {
  const c = auditCase("f020");
  c.depotAccounts = ["A", "B"].map(s => ({ id: `audit-depot-${s}`, name: `AUDIT Depot ${s}`, createdAt: AUDIT_DATE, updatedAt: AUDIT_DATE }));
  c.depot = ["A", "B"].map((s, i) => ({ id: `audit-holding-${s}`, depotId: `audit-depot-${s}`,
    name: `AUDIT Position ${s}`, value: i ? 6000 : 10000, plannedSale: 0, risk: 3,
    assetClass: "Substanzwerte", region: "Deutschland", note: "Synthetisch", wkn: i ? "ZZAF02" : "ZZAF01",
    classificationStatus: "mapped", securityType: "Aktie", currency: "EUR", valuationEnd: "2026-10-15" }));
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
export const variants = [
  { tag: "1.49", value: 1.49, valid: true }, { tag: "0", value: 0, valid: true },
  { tag: "null", value: null, valid: false }, { tag: "false", value: false, valid: false },
  { tag: "string-2", value: "2", valid: false }, { tag: "negative", value: -1, valid: false },
  { tag: "missing", value: undefined, valid: false },
] as const;
export type YearsVariant = (typeof variants)[number];
export function needBase(group: "A" | "B"): AdvisoryCase {
  const c = auditCase(`f021-${group}`);
  c.advisory.needs = [{ id: 701, purpose: "AUDIT Bedarf 10000", amount: 10000, years: 1.49 }];
  if (group === "A") c.plans[0].allocations = [{ id: "audit-bound-2028", productId: "unifavorit-renten", productName: "AUDIT gebundener Bedarf",
    source: "product", solutionId: "mixed", amount: 10000, bucketId: "year3", bucketAmounts: { year3: 10000 },
    capitalPotId: "year-2028", capitalPotAmounts: { "year-2028": 10000 }, allocationMode: "single" }];
  // A and B are independently valid controls. Mutations below never remap a reference.
  if (!normalizeImportedCase(c, false)) throw new Error(`Invalid synthetic control ${group}`);
  return c;
}
export function needVariant(group: "A" | "B", variant: YearsVariant): AdvisoryCase {
  const c = clone(needBase(group));
  if (variant.value === undefined) Reflect.deleteProperty(c.advisory.needs[0], "years");
  else Reflect.set(c.advisory.needs[0], "years", variant.value);
  const before = clone(needBase(group)), after = clone(c);
  Reflect.deleteProperty(before.advisory.needs[0], "years"); Reflect.deleteProperty(after.advisory.needs[0], "years");
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Fixture changed more than years");
  return c;
}
export function historyOwner(snapshot: AdvisoryCase) {
  const c = auditCase("f021-history-owner");
  c.versions = [{ id: "audit-snapshot", label: "AUDIT Laufzeitsnapshot", createdAt: AUDIT_DATE, snapshot: caseSnapshot(snapshot) }];
  return c;
}
export function riskCase(risk: RiskLevel = 1) {
  const c = auditCase("f017"); c.advisory.risk = risk; c.advisory.riskSelectionSource = "default";
  c.advisory.needs = [{ id: 702, purpose: "AUDIT langer zweiter Topf", amount: 20000, years: 15 }];
  return c;
}
