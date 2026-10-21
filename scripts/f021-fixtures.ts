import { createCase, caseSnapshot, normalizeImportedCase, type AdvisoryCase } from "../app/case-model";

export const F021_DATE = "2026-10-15T12:00:00.000Z";
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
export function controlCase(id = "f021-control"): AdvisoryCase {
  const c = createCase();
  Object.assign(c, { id, createdAt: F021_DATE, updatedAt: F021_DATE, currentStep: 3 });
  Object.assign(c.advisory, { caseName: `SYNTHETISCH ${id}`, scope: "private", liquidAssets: 200000,
    reserve: 0, needs: [], horizon: 20, risk: 1, riskSelectionSource: "manual" });
  Object.assign(c.plans[0], { id: `${id}-plan`, total: 200000, createdAt: F021_DATE, updatedAt: F021_DATE,
    preferred: true, depotSelectionInitialized: false, depotModeSelectionInitialized: false, allocations: [], investmentPlans: [] });
  c.activePlanId = c.plans[0].id; c.vvFilters.amount = 200000;
  return c;
}
export const variants = [
  { tag: "1.49", value: 1.49, valid: true }, { tag: "0", value: 0, valid: true },
  { tag: "null", value: null, valid: false }, { tag: "false", value: false, valid: false },
  { tag: "string-2", value: "2", valid: false }, { tag: "negative", value: -1, valid: false },
  { tag: "missing", value: undefined, valid: false },
] as const;
export type YearsVariant = (typeof variants)[number];
export function needBase(group: "A" | "B"): AdvisoryCase {
  const c = controlCase(`f021-${group}`);
  c.advisory.needs = [{ id: 701, purpose: "Synthetischer Bedarf 10000", amount: 10000, years: 1.49 }];
  if (group === "A") c.plans[0].allocations = [{ id: "f021-bound-2028", productId: "unifavorit-renten", productName: "Synthetischer gebundener Bedarf",
    source: "product", solutionId: "mixed", amount: 10000, bucketId: "year3", bucketAmounts: { year3: 10000 },
    capitalPotId: "year-2028", capitalPotAmounts: { "year-2028": 10000 }, allocationMode: "single" }];
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
  const c = controlCase("f021-history-owner");
  c.versions = [{ id: "f021-snapshot", label: "Synthetischer Laufzeitsnapshot", createdAt: F021_DATE, snapshot: caseSnapshot(snapshot) }];
  return c;
}
export const accepted = (group: "A" | "B", v: YearsVariant) => v.valid && !(group === "A" && v.value === 0);
