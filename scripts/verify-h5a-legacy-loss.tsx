import assert from "node:assert/strict";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeImportedCase, caseSnapshot, getPreferredStructurePlan, type AdvisoryCase } from "../app/case-model";
import { CASE_STORAGE_KEY as KEY, RECOVERY_PREFIX, readCaseStore, recoveryBackups, saveCaseToStore,
  insertCaseIntoStore, writeCaseStore, removeCaseFromStore } from "../app/case-storage";
import { legacyCapitalProtection } from "../app/domain/case/legacy-capital-protection";
import { caseStoreNotice } from "../app/presentation/case-store-notice";
import { ExportCenter } from "../app/page";
import { h5aLegacyCase, h5aHealthyCase } from "./h5a-fixtures";

class Store {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string, v: string) { this.values.set(k, v); }
}
let groups = 0, failures = 0;
function test(name: string, run: () => void) {
  try { run(); groups++; console.log(`PASS H5a ${name}`); }
  catch (error) { failures++; console.error(`FAIL H5a ${name}: ${error instanceof Error ? error.message : error}`); }
}
test("X04 raw input is unchanged, complete allocation and phased loss must reject normalization", () => {
  const c = h5aLegacyCase(), before = structuredClone(c), n = normalizeImportedCase(c, false);
  assert.deepEqual(c, before);
  console.log("X04 observation", JSON.stringify({ normalized: !!n, allocations: n?.plans[0].allocations.length,
    phased: n?.plans[0].investmentPlans.length, originalAmount: c.plans[0].allocations[0].amount }));
  assert.equal(n, null, "a successful status after losing 10000 EUR and a phased entry is forbidden");
});
test("X04 partial allocation must reject instead of shrinking 10000 to 4000 EUR", () => {
  const c = h5aLegacyCase("h5a-partial", true), before = structuredClone(c), n = normalizeImportedCase(c, false);
  assert.deepEqual(c, before);
  console.log("X04 partial observation", JSON.stringify({ normalized: !!n, amount: n?.plans[0].allocations[0]?.amount }));
  assert.equal(n, null);
});
test("X04 read-only load identifies recovery and preserves complete original", () => {
  const c = h5aLegacyCase(), neighbor = h5aHealthyCase(), raw = JSON.stringify([c, neighbor], null, 2), s = new Store();
  s.setItem(KEY, raw); const before = [...s.values], loaded = readCaseStore(raw);
  assert.deepEqual([...s.values], before);
  console.log("X04 recovery observation", JSON.stringify({ recoveryNeeded: loaded.recoveryNeeded, protected: loaded.protectedEntries.length }));
  assert.equal(loaded.recoveryNeeded, true); assert.equal(loaded.malformed, false);
  assert.deepEqual(loaded.protectedEntries, [c]); assert.deepEqual(loaded.recoveryEntries, [c]);
  assert.deepEqual(loaded.cases.map(x => x.id), [neighbor.id]);
});
test("X04 actual neighbor save preserves raw legacy object and byte-exact P1 original backup", () => {
  const c = h5aLegacyCase(), neighbor = h5aHealthyCase(), raw = JSON.stringify([c, neighbor], null, 2), s = new Store();
  s.setItem(KEY, raw); s.setItem("synthetic-unrelated", "keep");
  saveCaseToStore(s, { ...neighbor, status: "In Prüfung" });
  const persisted = JSON.parse(s.getItem(KEY)!);
  console.log("X04 save observation", JSON.stringify({ backups: recoveryBackups(s).length,
    legacySchema: persisted.find((x: AdvisoryCase) => x.id === c.id)?.schemaVersion,
    legacyAllocations: persisted.find((x: AdvisoryCase) => x.id === c.id)?.plans[0].allocations.length }));
  assert.deepEqual(persisted.find((x: AdvisoryCase) => x.id === c.id), c);
  assert.equal(recoveryBackups(s).length, 1); assert.equal(recoveryBackups(s)[0].original, raw);
  assert.equal(s.getItem("synthetic-unrelated"), "keep");
  assert.equal(readCaseStore(s.getItem(KEY)).cases[0].status, "In Prüfung");
});
test("X04 JSON import and wrapped import cannot bypass protection", () => {
  const c = h5aLegacyCase(), raw = JSON.stringify({ case: c });
  assert.equal(normalizeImportedCase(JSON.parse(raw)), null);
  assert.equal(normalizeImportedCase(JSON.parse(JSON.stringify(c))), null);
  assert.equal(JSON.stringify({ case: c }), raw);
});
function restoreButtons(n: ReactNode): (() => void)[] {
  if (Array.isArray(n)) return n.flatMap(restoreButtons);
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(n)) return [];
  if (n.type === "button" && renderToStaticMarkup(n).includes("Wiederherstellen")) return [n.props.onClick!];
  return restoreButtons(n.props.children);
}
test("X04 actual historical Restore rejects with no live, history or store mutation", () => {
  const c = h5aHealthyCase(), legacy = h5aLegacyCase();
  c.versions = [{ id: "h5a-version", label: "Synthetische Altversion", createdAt: c.createdAt, snapshot: caseSnapshot(legacy) }];
  const before = structuredClone(c), s = new Store(); s.setItem(KEY, JSON.stringify([c])); const bytes = [...s.values];
  let applied = false; const alerts: string[] = [], previous = globalThis.window;
  Object.assign(globalThis, { window: { confirm: () => true, alert: (message: string) => alerts.push(message) } });
  try {
    const view = ExportCenter({ item: c, preferredPlan: getPreferredStructurePlan(c.plans), setItem: () => { applied = true; },
      saveCase: () => { throw Error("Restore must not save"); }, exportJson: () => {}, importJson: () => {} });
    restoreButtons(view)[0]();
  } finally { Object.assign(globalThis, { window: previous }); }
  assert.equal(applied, false); assert.equal(alerts.length, 1);
  assert.deepEqual(c, before); assert.deepEqual([...s.values], bytes);
});
test("X04 backup failure blocks neighbor save before primary mutation", () => {
  const raw = JSON.stringify([h5aLegacyCase(), h5aHealthyCase()], null, 2), s = new Store(); s.setItem(KEY, raw);
  const set = s.setItem.bind(s); s.setItem = (k, v) => { if (k.startsWith(RECOVERY_PREFIX)) throw Error("synthetic quota"); set(k, v); };
  assert.throws(() => saveCaseToStore(s, h5aHealthyCase())); assert.equal(s.getItem(KEY), raw);
});
test("schema 0..9 synthetic current bindings are protected; 8/9 actual representation includes phased entries", () => {
  for (let schema = 0; schema < 10; schema++) for (const partial of [false, true]) {
    const c = h5aLegacyCase("synthetic-schema", partial); Reflect.set(c, "schemaVersion", schema);
    // Current capital-pot fields under 0..7 test accepted synthetic combinations,
    // NOT a claim that these historical versions emitted this representation.
    if (schema < 8) c.plans[0].investmentPlans = [];
    const before = structuredClone(c);
    assert.equal(legacyCapitalProtection(c), "historical-bindings");
    assert.equal(normalizeImportedCase(c, false), null); assert.deepEqual(c, before);
  }
});
test("both scalar and map references are inventoried, including zero keys and inactive plans", () => {
  for (const mode of ["scalar-only", "map-only", "zero-key", "inactive"] as const) {
    const c = h5aHealthyCase(); Reflect.set(c, "schemaVersion", 9); c.plans[0].investmentPlans = [];
    const a = c.plans[0].allocations[0];
    if (mode === "scalar-only") { a.capitalPotId = "year-2027"; }
    if (mode === "map-only") { a.capitalPotAmounts = { "year-2027": 10000 }; delete a.capitalPotId; }
    if (mode === "zero-key") a.capitalPotAmounts!["year-2027"] = 0;
    if (mode === "inactive") { const old = h5aLegacyCase().plans[0]; old.id = "inactive"; old.preferred = false;
      old.allocations[0].id = "inactive-a"; old.investmentPlans = []; c.plans.push(old); }
    assert.equal(normalizeImportedCase(c, false), null, mode);
  }
});
test("genuine bucket-only allocations migrate uniquely in every schema 0..9 without amount or ID loss", () => {
  for (let schema = 0; schema < 10; schema++) {
    const c = h5aLegacyCase(); Reflect.set(c, "schemaVersion", schema); c.plans[0].investmentPlans = [];
    const a = c.plans[0].allocations[0]; delete a.capitalPotId; delete a.capitalPotAmounts;
    const before = structuredClone(c), n = normalizeImportedCase(c, false); assert.ok(n);
    assert.equal(legacyCapitalProtection(c), "safe"); assert.equal(n.plans[0].allocations[0].id, a.id);
    assert.equal(n.plans[0].allocations[0].amount, 10000);
    assert.deepEqual(n.plans[0].allocations[0].capitalPotAmounts, { "year-2028": 10000 }); assert.deepEqual(c, before);
  }
});
test("documented pre-8 product/installment phased migration retains entry and amount", () => {
  for (let schema = 0; schema < 8; schema++) {
    const c = h5aLegacyCase(); Reflect.set(c, "schemaVersion", schema);
    const a = c.plans[0].allocations[0]; delete a.capitalPotId; delete a.capitalPotAmounts;
    Reflect.set(c.plans[0], "investmentPlans", [{ id: "genuine-phased", type: "phased", productId: a.productId,
      bucketId: "year3", installmentAmount: "1000.125", installments: "6", frequency: "monthly", startDate: "2026-11-01" }]);
    const before = structuredClone(c), n = normalizeImportedCase(c, false); assert.ok(n);
    const e = n.plans[0].investmentPlans[0]; assert.ok(e.type === "phased");
    assert.equal(e.id, "genuine-phased"); assert.equal(e.allocationId, a.id); assert.equal(e.capitalPotId, "year-2028");
    assert.equal(e.stagedValue, 6000.75); assert.equal(e.installments, 6); assert.deepEqual(c, before);
  }
});
test("ambiguous buckets, duplicate product matches and hybrid pre-8 entries stay protected", () => {
  for (const mode of ["buckets", "products", "hybrid"] as const) {
    const c = h5aLegacyCase(); Reflect.set(c, "schemaVersion", 7);
    const a = c.plans[0].allocations[0]; delete a.capitalPotId; delete a.capitalPotAmounts;
    if (mode === "hybrid") { // Modern-only phased shape is not an old product-based format.
      Reflect.set(c.plans[0].investmentPlans[0], "capitalPotId", "year-2028");
    } else {
      Reflect.set(c.plans[0], "investmentPlans", [{ id: "old-entry", type: "phased", productId: a.productId,
        bucketId: "year3", installmentAmount: 1000, installments: 6 }]);
      if (mode === "products") c.plans[0].allocations.push({ ...a, id: "second-match" });
      else c.advisory.needs.push({ id: 102, purpose: "Weiterer Bedarf", amount: 1000, years: 2, dueDate: "2027-12-31" });
    }
    const before = structuredClone(c); assert.equal(legacyCapitalProtection(c), "ambiguous-legacy");
    assert.equal(normalizeImportedCase(c), null); assert.deepEqual(c, before);
  }
});
test("lossless partial/unassigned/high precision and review values survive; inflation is blocked", () => {
  const c = h5aHealthyCase(); Reflect.set(c, "schemaVersion", 9); c.plans[0].investmentPlans = [];
  const a = c.plans[0].allocations[0]; a.amount = 10000.123456789; a.capitalPotAmounts = { "year-2028": 6000.123456789 };
  a.capitalPotReviewAmount = 100;
  const before = structuredClone(c), n = normalizeImportedCase(c, false); assert.ok(n);
  assert.equal(n.plans[0].allocations[0].amount, a.amount);
  assert.deepEqual(n.plans[0].allocations[0].capitalPotAmounts, a.capitalPotAmounts);
  assert.equal(n.plans[0].allocations[0].capitalPotReviewAmount, 100); assert.deepEqual(c, before);
  a.capitalPotAmounts = { "year-2028": 20000 };
  assert.equal(normalizeImportedCase(c, false), null);
});
test("zero-only explicit bindings, zero phased entries and lost savings targets cannot disappear in legacy conversion", () => {
  for (const kind of ["zero-map", "zero-allocation", "zero-phased", "savings-target"] as const) {
    const c = h5aHealthyCase(); Reflect.set(c, "schemaVersion", kind === "savings-target" ? 7 : 9);
    const a = c.plans[0].allocations[0];
    if (kind === "zero-map") { delete a.capitalPotId; a.capitalPotAmounts = { "year-2028": 0 }; c.plans[0].investmentPlans = []; }
    if (kind === "zero-allocation") { a.amount = 0; a.capitalPotAmounts = {}; c.plans[0].investmentPlans = []; }
    if (kind === "zero-phased") Reflect.set(c.plans[0].investmentPlans[0], "stagedValue", 0);
    if (kind === "savings-target") Reflect.set(c.plans[0], "investmentPlans", [{ id: "old-saving", type: "savings", installmentAmount: 100,
      productId: "synthetic", targetRef: { kind: "need", id: 101 } }]);
    const before = structuredClone(c); assert.equal(normalizeImportedCase(c, false), null, kind); assert.deepEqual(c, before);
  }
});
test("independent H2/P2/P3/H4 corruption is never repaired by the legacy guard", () => {
  for (const damage of [(c: AdvisoryCase) => { c.advisory.reserve = -1; },
    (c: AdvisoryCase) => { c.plans.push(structuredClone(c.plans[0])); },
    (c: AdvisoryCase) => { Reflect.set(c.plans[0].investmentPlans[0], "installments", 1201); },
    (c: AdvisoryCase) => { c.depotAccounts = [{ id: "depot", name: "Synthetisch", createdAt: c.createdAt, updatedAt: c.updatedAt }];
      c.depot = [{ id: "holding", depotId: "absent", name: "Synthetisch", value: 100, plannedSale: 0 } as AdvisoryCase["depot"][number]]; },
  ]) {
    const c = h5aHealthyCase(); Reflect.set(c, "schemaVersion", 9); damage(c); const before = structuredClone(c);
    assert.equal(normalizeImportedCase(c, false), null); assert.deepEqual(c, before);
  }
});
test("schemas 10/11 keep existing graph boundaries and valid zero phased drafts", () => {
  for (const schema of [10, 11]) {
    const c = h5aLegacyCase(); Reflect.set(c, "schemaVersion", schema); assert.equal(normalizeImportedCase(c, false), null);
    const good = h5aHealthyCase(); Reflect.set(good, "schemaVersion", schema);
    Reflect.set(good.plans[0].investmentPlans[0], "stagedValue", 0);
    const n = normalizeImportedCase(good, false); assert.ok(n); assert.deepEqual(n.plans, good.plans);
  }
});
test("P1 all mutators protect IDs and reject dangerous candidates with zero writes", () => {
  const legacy = h5aLegacyCase(), raw = JSON.stringify([legacy, h5aHealthyCase()], null, 2), s = new Store(); s.setItem(KEY, raw);
  const before = [...s.values];
  for (const run of [() => saveCaseToStore(s, h5aHealthyCase(legacy.id)), () => insertCaseIntoStore(s, h5aHealthyCase(legacy.id)),
    () => removeCaseFromStore(s, legacy.id), () => writeCaseStore(s, [h5aHealthyCase(legacy.id)]),
    () => insertCaseIntoStore(s, h5aLegacyCase("new-danger")), () => saveCaseToStore(s, h5aLegacyCase("new-danger")),
    () => writeCaseStore(s, [h5aLegacyCase("new-danger")])]) {
    assert.throws(run); assert.deepEqual([...s.values], before);
  }
});
test("P1 verified backup reuse, incomplete backup, readback and main-write failure", () => {
  for (const mode of ["reuse", "incomplete", "readback", "main"] as const) {
    const c = h5aLegacyCase(), raw = JSON.stringify([c, h5aHealthyCase()], null, 2), s = new Store(); s.setItem(KEY, raw);
    if (mode === "reuse") s.setItem(RECOVERY_PREFIX + "existing", raw);
    if (mode === "incomplete") s.setItem(RECOVERY_PREFIX + "existing", JSON.stringify([h5aHealthyCase()]));
    const set = s.setItem.bind(s);
    if (mode === "readback") s.setItem = (k, v) => set(k, k.startsWith(RECOVERY_PREFIX) ? "synthetic-corrupt" : v);
    if (mode === "main") s.setItem = (k, v) => { if (k === KEY) throw Error("synthetic main quota"); set(k, v); };
    if (mode === "readback" || mode === "main") {
      assert.throws(() => saveCaseToStore(s, h5aHealthyCase())); assert.equal(s.getItem(KEY), raw);
    } else {
      saveCaseToStore(s, h5aHealthyCase()); assert.deepEqual(readCaseStore(s.getItem(KEY)).protectedEntries, [c]);
      assert.equal(recoveryBackups(s).length, mode === "reuse" ? 1 : 2);
    }
    if (mode !== "readback") assert.ok(recoveryBackups(s).some(b => b.original === raw));
  }
});
test("fresh neighbors, duplicate recovery multiplicity and all historical snapshots remain intact", () => {
  const bad = h5aLegacyCase(), a = h5aHealthyCase("a"), b = h5aHealthyCase("b"), s = new Store();
  a.versions = [{ id: "opaque", label: "Synthetisch", createdAt: a.createdAt, snapshot: caseSnapshot(bad) }];
  const raw = JSON.stringify([a, bad, bad, b], null, 2); s.setItem(KEY, raw);
  const stale = readCaseStore(raw).cases[0]; s.setItem(KEY, JSON.stringify([a, bad, bad, b, h5aHealthyCase("new-neighbor")], null, 2));
  const currentOriginal = s.getItem(KEY)!; saveCaseToStore(s, { ...stale, status: "In Prüfung" });
  assert.deepEqual(readCaseStore(s.getItem(KEY)).cases.map(c => c.id), ["a", "b", "new-neighbor"]);
  assert.deepEqual(readCaseStore(s.getItem(KEY)).protectedEntries, [bad, bad]);
  assert.deepEqual(readCaseStore(s.getItem(KEY)).cases[0].versions, a.versions);
  assert.equal(recoveryBackups(s)[0].original, currentOriginal);
});
test("recovery distinguishes historical protection from corruption without disclosing data", () => {
  const legacy = h5aLegacyCase(); legacy.advisory.caseName = "PRIVATE-DO-NOT-DISCLOSE";
  const note = caseStoreNotice(readCaseStore(JSON.stringify([legacy])))!;
  assert.match(note.text, /historischer Fall ist geschützt/); assert.match(note.text, /fachlich geprüft/);
  assert.ok(!note.text.includes("1 beschädigter")); assert.ok(!note.text.includes(legacy.advisory.caseName));
  const invalid = h5aHealthyCase("damaged"); invalid.advisory.reserve = -1;
  const mixed = caseStoreNotice(readCaseStore(JSON.stringify([legacy, invalid])))!;
  assert.match(mixed.text, /1 historischer Fall/); assert.match(mixed.text, /1 beschädigter oder inkonsistenter Fall/);
});
console.log(`H5a legacy protection: ${groups} groups passed, ${failures} failed.`);
if (failures) process.exitCode = 1;
