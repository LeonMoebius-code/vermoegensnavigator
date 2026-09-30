import assert from "node:assert/strict";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createCase, createPlan, caseSnapshot, duplicateStructurePlan, normalizeImportedCase,
  getActiveStructurePlan, getPreferredStructurePlan, setActiveStructurePlan,
  setPreferredStructurePlan, appendStructurePlan, deleteStructurePlan,
  type AdvisoryCase, type StructurePlan,
} from "../app/case-model";
import { CASE_STORAGE_KEY, readCaseStore, recoveryBackups, writeCaseStore,
  saveCaseToStore, insertCaseIntoStore } from "../app/case-storage";
import { ExportCenter } from "../app/page";

const AS_OF = "2026-01-01T12:00:00.000Z";
// Invented fixture with explicit identities/references, independent of copy helpers.
function fixture(id = "p3-case"): AdvisoryCase {
  const item = createCase();
  Object.assign(item, { id, createdAt: AS_OF, updatedAt: AS_OF, activePlanId: "p3-b" });
  Object.assign(item.advisory, { caseName: "Synthetischer P3-Fall", liquidAssets: 50_000, reserve: 0,
    needs: [{ id: 41, purpose: "Synthetischer Bedarf", amount: 10_000, years: 4, dueDate: "2030-01-01" }] });
  item.depotAccounts = [{ id: "p3-depot", name: "Synthetisches Depot", createdAt: AS_OF, updatedAt: AS_OF }];
  item.depot = [{ id: "p3-holding", depotId: "p3-depot", name: "Synthetische Position", value: 1000,
    plannedSale: 0, assetClass: "Substanzwerte", region: "Weltweit", risk: 3, note: "", classificationStatus: "mapped" }];
  item.savingsGoals = [{ id: "p3-goal", name: "Synthetisches Ziel", targetAmount: 5000 }];
  item.plans = ["a", "b", "c"].map((suffix): StructurePlan => ({
    id: `p3-${suffix}`, name: `Synthetischer Plan ${suffix}`, total: 50_000, capitalMode: "manual",
    preferred: suffix === "a", notes: "", depotMode: "retain", depotHoldingIds: ["p3-holding"],
    depotSelectionInitialized: true, depotModeSelectionInitialized: true, createdAt: AS_OF, updatedAt: AS_OF,
    allocations: [{ id: `p3-allocation-${suffix}`, productId: "synthetic-product", productName: "Synthetisches Produkt",
      source: "product", solutionId: "synthetic-solution", amount: 30_000, bucketId: "year10plus",
      allocationMode: "manual", capitalPotId: "strategic", capitalPotAmounts: { strategic: 30_000 } }],
    investmentPlans: [
      { id: `p3-phased-${suffix}`, type: "phased", allocationId: `p3-allocation-${suffix}`, capitalPotId: "strategic",
        stagedMode: "amount", stagedValue: 12_000, installments: 4, frequency: "monthly", startDate: "2026-10-01", note: "" },
      { id: `p3-saving-${suffix}`, type: "savings", name: "Synthetisches Sparen", productId: "synthetic-product",
        productName: "Synthetisches Produkt", contributionAmount: 100, frequency: "monthly", startDate: "2026-10-01",
        targetRef: suffix === "a" ? { kind: "need", id: 41 } : { kind: "savingsGoal", id: "p3-goal" }, note: "" },
    ],
  }));
  const snapshot = caseSnapshot(item);
  snapshot.id = "p3-historical-case";
  item.versions = [{ id: "p3-version", label: "Synthetischer Zwischenstand", createdAt: AS_OF, snapshot }];
  return item;
}
class Store {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
let groups = 0;
function test(name: string, run: () => void) { run(); groups++; console.log(`PASS P3 ${name}`); }
function reject(mutate: (item: AdvisoryCase) => void) {
  for (const schemaVersion of [10, 11]) {
    const item = fixture(); Reflect.set(item, "schemaVersion", schemaVersion); mutate(item);
    const before = JSON.stringify(item);
    assert.equal(normalizeImportedCase(item, false), null);
    assert.equal(normalizeImportedCase({ case: item }), null);
    assert.equal(JSON.stringify(item), before, "Rejected source is untouched");
  }
}
function reload(item: AdvisoryCase) {
  const store = new Store(); writeCaseStore(store, [item]);
  const loaded = readCaseStore(store.getItem(CASE_STORAGE_KEY));
  assert.equal(loaded.recoveryNeeded, false); assert.equal(loaded.cases.length, 1);
  return loaded.cases[0];
}
test("current schema 10/11 preserve complete graph, current identity and historical snapshot IDs", () => {
  for (const schemaVersion of [10, 11]) for (const preferred of [true, false]) {
    const source = fixture(); Reflect.set(source, "schemaVersion", schemaVersion); source.plans[0].preferred = preferred;
    const before = JSON.stringify(source);
    for (const regenerateId of [false, true]) {
      const loaded = normalizeImportedCase({ case: source }, regenerateId); assert.ok(loaded);
      assert.equal(loaded.schemaVersion, 11); assert.deepEqual(loaded.plans, source.plans);
      assert.equal(loaded.activePlanId, "p3-b"); assert.deepEqual(loaded.versions, source.versions);
      assert.equal(loaded.versions[0].snapshot.id, "p3-historical-case");
      assert.equal(loaded.id === source.id, !regenerateId);
      assert.equal(getPreferredStructurePlan(loaded.plans)?.id, preferred ? "p3-a" : undefined);
      assert.deepEqual(reload(loaded).plans, source.plans);
    }
    assert.equal(JSON.stringify(source), before);
  }
});
test("empty plans rejected", () => reject((c) => { c.plans = []; }));
test("plan identity missing, blank or non-string rejected", () => {
  for (const id of [undefined, "", "  ", 17, null]) reject((c) => { Reflect.set(c.plans[0], "id", id); });
});
test("duplicate plan identities rejected", () => reject((c) => { c.plans[1].id = c.plans[0].id; }));
test("missing, empty, non-string or dangling active identity rejected", () => {
  for (const id of [undefined, "", 17, null, "missing-plan"]) reject((c) => { Reflect.set(c, "activePlanId", id); });
});
test("multiple preferred plans rejected", () => reject((c) => { c.plans[1].preferred = true; }));
test("allocation identities required and unique within plan", () => {
  for (const id of [undefined, "", " ", 17, null]) reject((c) => { Reflect.set(c.plans[0].allocations[0], "id", id); });
  reject((c) => { c.plans[0].allocations.push(structuredClone(c.plans[0].allocations[0])); });
});
test("allocation identities unique CASE-WIDE, even without phased entries", () => reject((c) => {
  c.plans.forEach((p) => { p.investmentPlans = []; }); c.plans[1].allocations[0].id = c.plans[0].allocations[0].id;
}));
test("investment identities required and unique within plan", () => {
  for (const id of [undefined, "", " ", 17, null]) reject((c) => { Reflect.set(c.plans[0].investmentPlans[0], "id", id); });
  reject((c) => { c.plans[0].investmentPlans.push(structuredClone(c.plans[0].investmentPlans[0])); });
});
test("investment identities unique CASE-WIDE across types", () => reject((c) => {
  c.plans[1].investmentPlans[1].id = c.plans[0].investmentPlans[0].id;
}));
test("phased dangling and cross-plan allocation rejected", () => {
  for (const id of ["missing-allocation", "p3-allocation-b"]) reject((c) => {
    const entry = c.plans[0].investmentPlans[0]; assert.equal(entry.type, "phased"); entry.allocationId = id;
  });
});
test("phased pot must exist and pair must cover a positive amount", () => {
  reject((c) => { Reflect.set(c.plans[0].investmentPlans[0], "capitalPotId", "missing-pot"); });
  reject((c) => { c.plans[0].allocations[0].capitalPotAmounts = { strategic: 0 }; c.plans[0].allocations[0].amount = 0; });
});
test("allocation current pot and persisted map keys never disappear on load", () => {
  reject((c) => { Reflect.set(c.plans[0].allocations[0], "capitalPotId", "missing-pot"); });
  reject((c) => { Reflect.set(c.plans[0].allocations[0].capitalPotAmounts!, 'missing-pot', 100); });
});
test("plan holding selection rejects dangling, empty, non-string and duplicate references", () => {
  for (const ids of [["missing-holding"], [""], [17], ["p3-holding", "p3-holding"]])
    reject((c) => { Reflect.set(c.plans[0], "depotHoldingIds", ids); });
});
test("savings targets reject missing need, goal, wrong identity type and unknown kind", () => {
  for (const targetRef of [{ kind: "need", id: 99 }, { kind: "need", id: "41" },
    { kind: "savingsGoal", id: "missing-goal" }, { kind: "savingsGoal", id: 41 }, { kind: "unknown", id: "p3-goal" }, null])
    reject((c) => { Reflect.set(c.plans[0].investmentPlans[1], "targetRef", targetRef); });
});
test("version identities required, unique and never rekeyed", () => {
  for (const id of [undefined, "", " ", 17, null]) reject((c) => { Reflect.set(c.versions[0], "id", id); });
  reject((c) => { c.versions.push(structuredClone(c.versions[0])); });
});
test("historical snapshot graph is opaque during normal load", () => {
  const c = fixture(); c.versions[0].snapshot.activePlanId = "historical-dangling-plan";
  c.versions[0].snapshot.plans[1].id = c.versions[0].snapshot.plans[0].id;
  const before = JSON.stringify(c), loaded = normalizeImportedCase(c, false); assert.ok(loaded);
  assert.deepEqual(loaded.versions, c.versions); assert.equal(JSON.stringify(c), before);
});
test("corrupt current graph protected beside healthy neighbors with byte-exact reusable recovery", () => {
  const bad = fixture("p3-protected"), healthy = fixture("p3-neighbor"); bad.activePlanId = "missing-plan";
  const raw = JSON.stringify([bad, healthy], null, 2), store = new Store(); store.setItem(CASE_STORAGE_KEY, raw);
  const loaded = readCaseStore(raw); assert.deepEqual(loaded.protectedEntries, [bad]);
  assert.equal(loaded.malformed, false);
  assert.deepEqual(loaded.recoveryEntries, [bad]); assert.equal(loaded.recoveryNeeded, true);
  assert.deepEqual(loaded.cases.map((c) => c.id), [healthy.id]);
  for (const status of ["In Prüfung", "Abgeschlossen"] as const) {
    saveCaseToStore(store, { ...healthy, status });
    assert.equal(recoveryBackups(store).length, 1); assert.equal(recoveryBackups(store)[0].original, raw);
    assert.deepEqual(readCaseStore(store.getItem(CASE_STORAGE_KEY)).protectedEntries, [bad]);
  }
});
test("save, insert and full write reject before store or recovery mutation", () => {
  const corruptions: Array<(c: AdvisoryCase) => void> = [
    (c) => { c.plans[1].id = c.plans[0].id; },
    (c) => { c.activePlanId = "missing-plan"; },
    (c) => { c.plans[1].preferred = true; },
    (c) => { c.plans[1].allocations[0].id = c.plans[0].allocations[0].id; },
    (c) => { Reflect.set(c.plans[0].investmentPlans[0], "allocationId", "missing-allocation"); },
    (c) => { Reflect.set(c.plans[0].allocations[0], "capitalPotId", "missing-pot"); },
  ];
  for (const recovery of [false, true]) for (const corrupt of corruptions) {
    const store = new Store(), healthy = fixture("p3-healthy"), protectedCase = fixture("p3-protected");
    protectedCase.activePlanId = "missing-plan";
    store.setItem(CASE_STORAGE_KEY, JSON.stringify(recovery ? [healthy, protectedCase] : [healthy], null, 2));
    const before = [...store.values], bad = fixture("p3-new"); corrupt(bad);
    for (const operation of [saveCaseToStore, insertCaseIntoStore]) {
      assert.throws(() => operation(store, bad)); assert.deepEqual([...store.values], before);
    }
    assert.throws(() => saveCaseToStore(store, { ...bad, id: healthy.id }));
    assert.throws(() => writeCaseStore(store, [healthy, bad])); assert.deepEqual([...store.values], before);
  }
});
test("legacy schema 0-9 documented migrations remain loadable", () => {
  for (let schemaVersion = 0; schemaVersion <= 9; schemaVersion++) {
    const source = fixture(); Reflect.set(source, "schemaVersion", schemaVersion);
    const before = JSON.stringify(source), loaded = normalizeImportedCase(source, false); assert.ok(loaded, `schema ${schemaVersion}`);
    assert.equal(loaded.schemaVersion, 11); assert.equal(loaded.activePlanId, source.activePlanId);
    assert.deepEqual(loaded.versions, source.versions); assert.equal(JSON.stringify(source), before);
  }
});
test("legacy schema 6 retain-empty and invalid pots follow documented cleanup", () => {
  const c = fixture(); Reflect.set(c, "schemaVersion", 6); c.plans[0].depotHoldingIds = [];
  const invalid = { ...c.plans[0].allocations[0], id: "legacy-bad-pot" };
  Reflect.set(invalid, "capitalPotId", "old-invalid"); Reflect.set(invalid, "capitalPotAmounts", { "old-invalid": 1 });
  c.plans[0].allocations.push(invalid);
  const loaded = normalizeImportedCase(c, false); assert.ok(loaded);
  assert.deepEqual(loaded.plans[0].depotHoldingIds, ["p3-holding"]);
  assert.ok(!loaded.plans[0].allocations.some((a) => a.id === "legacy-bad-pot"));
});
test("legacy schema 7 phased product conversion and ambiguous removal; savings amount conversion", () => {
  const c = fixture(); Reflect.set(c, "schemaVersion", 7);
  Reflect.set(c.plans[0], "investmentPlans", [
    { id: "legacy-phased", type: "phased", productId: "synthetic-product", capitalPotId: "strategic",
      installmentAmount: 1000, installments: 4, frequency: "monthly" },
    { id: "legacy-saving", type: "savings", productId: "synthetic-product", installmentAmount: 123, frequency: "monthly" },
  ]);
  const loaded = normalizeImportedCase(c, false); assert.ok(loaded);
  assert.equal(loaded.plans[0].investmentPlans[0].type, "phased");
  assert.equal(Reflect.get(loaded.plans[0].investmentPlans[0], "allocationId"), "p3-allocation-a");
  assert.equal(Reflect.get(loaded.plans[0].investmentPlans[0], "stagedValue"), 4000);
  assert.equal(Reflect.get(loaded.plans[0].investmentPlans[1], "contributionAmount"), 123);
  c.plans[0].allocations.push({ ...c.plans[0].allocations[0], id: "legacy-ambiguous" });
  assert.equal(normalizeImportedCase(c, false)?.plans[0].investmentPlans.some((i) => i.type === "phased"), false);
});
test("legacy schema 8 risk migration and schema 9 single-depot assignment preserved", () => {
  const risk = fixture(); Reflect.set(risk, "schemaVersion", 8); risk.advisory.risk = 4;
  assert.equal(normalizeImportedCase(risk, false)?.advisory.riskSelectionSource, "legacy");
  const depot = fixture(); Reflect.set(depot, "schemaVersion", 9); depot.depotAccounts = [];
  Reflect.deleteProperty(depot.depot[0], "depotId"); const loaded = normalizeImportedCase(depot, false); assert.ok(loaded);
  assert.equal(loaded.depotAccounts.length, 1); assert.equal(loaded.depot[0].depotId, loaded.depotAccounts[0].id);
});
test("active and preferred selection independent, immutable and stable on save/reload", () => {
  const c = fixture(), before = JSON.stringify(c);
  const opened = setActiveStructurePlan(c, "p3-c"); assert.equal(opened.activePlanId, "p3-c");
  assert.equal(getPreferredStructurePlan(opened.plans)?.id, "p3-a");
  const preferred = setPreferredStructurePlan(opened, "p3-b"); assert.equal(preferred.activePlanId, "p3-c");
  assert.deepEqual(preferred.plans.filter((p) => p.preferred).map((p) => p.id), ["p3-b"]);
  assert.equal(reload(preferred).activePlanId, "p3-c");
  assert.equal(setActiveStructurePlan(c, "missing"), c); assert.equal(setPreferredStructurePlan(c, "missing"), c);
  assert.equal(JSON.stringify(c), before);
});
test("create, copy and model variants activate without inheriting preference", () => {
  const c = fixture();
  const newPlan = createPlan("Synthetischer neuer Plan", 50_000); assert.equal(newPlan.preferred, false);
  const copy = duplicateStructurePlan(c.plans[0], "Synthetische Kopie");
  const model = { ...createPlan("Synthetisches Modell", 50_000), modelId: "synthetic-model", preferred: true };
  for (const plan of [newPlan, copy, model]) {
    const appended = appendStructurePlan(c, plan); assert.equal(appended.activePlanId, plan.id);
    assert.equal(appended.plans.at(-1)?.preferred, false); assert.equal(getPreferredStructurePlan(appended.plans)?.id, "p3-a");
    assert.ok(normalizeImportedCase(appended, false)); assert.deepEqual(appended.plans.slice(0, 3), c.plans);
  }
});
test("deletion preserves non-active choice, next/previous neighbor and zero preference", () => {
  const c = fixture(), before = JSON.stringify(c);
  assert.equal(deleteStructurePlan(c, "missing"), c);
  const nonActive = deleteStructurePlan(c, "p3-a"); assert.equal(nonActive.activePlanId, "p3-b");
  assert.equal(getPreferredStructurePlan(reload(nonActive).plans), undefined);
  const middle = deleteStructurePlan(c, "p3-b"); assert.equal(middle.activePlanId, "p3-c");
  assert.equal(getPreferredStructurePlan(middle.plans)?.id, "p3-a");
  const last = deleteStructurePlan(setActiveStructurePlan(c, "p3-c"), "p3-c"); assert.equal(last.activePlanId, "p3-b");
  const sole = { ...nonActive, plans: [nonActive.plans[0]] }; assert.equal(deleteStructurePlan(sole, "p3-b"), sole);
  assert.equal(JSON.stringify(c), before);
  assert.throws(() => getActiveStructurePlan({ ...c, activePlanId: "missing" }));
});
function button(node: ReactNode, label: string): { onClick?: () => void; disabled?: boolean } | undefined {
  if (Array.isArray(node)) return node.map((n) => button(n, label)).find(Boolean);
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void; disabled?: boolean }>(node)) return undefined;
  if (node.type === "button" && renderToStaticMarkup(node).includes(label)) return node.props;
  return button(node.props.children, label);
}
function view(item: AdvisoryCase, setItem: (item: AdvisoryCase) => void = () => {}) {
  return ExportCenter({ item, preferredPlan: getPreferredStructurePlan(item.plans),
    setItem: (next) => setItem(typeof next === "function" ? next(item) : next),
    saveCase: () => {}, exportJson: () => {}, importJson: () => {} });
}
test("no preferred target: visible hint, no fallback print, JSON/import/version controls usable", () => {
  const c = fixture(); c.plans.forEach((p) => { p.preferred = false; });
  const node = view(c), markup = renderToStaticMarkup(node);
  assert.ok(markup.includes("Keine bevorzugte Zielvariante gewählt")); assert.ok(!markup.includes("print-document"));
  for (const label of ["Kundenübersicht", "Interne Arbeitsunterlage", "Excel-Arbeitsmappe"]) assert.equal(button(node, label)?.disabled, true);
  for (const label of ["Vollständige Sicherung", "JSON importieren", "Version speichern", "Wiederherstellen"]) assert.ok(button(node, label)?.onClick);
});
test("actual Restore handler accepts valid snapshot preserving current case/history", () => {
  const c = fixture(), before = JSON.stringify(c), history = structuredClone(c.versions); let restored: AdvisoryCase | undefined;
  const oldWindow = globalThis.window; Object.assign(globalThis, { window: { confirm: () => true } });
  try {
    button(view(c, (next) => { restored = next; }), "Wiederherstellen")!.onClick!(); assert.ok(restored);
    assert.equal(restored.id, c.id); assert.deepEqual(restored.versions, history);
    assert.deepEqual(restored.plans, c.versions[0].snapshot.plans); assert.equal(restored.activePlanId, "p3-b");
    assert.equal(JSON.stringify(c), before);
  } finally { Object.assign(globalThis, { window: oldWindow }); }
});
test("actual Restore handler rejects corrupt snapshot, leaves current state/history/store intact", () => {
  for (const corrupt of [
    (c: AdvisoryCase) => { c.versions[0].snapshot.activePlanId = "missing-plan"; },
    (c: AdvisoryCase) => { c.versions[0].snapshot.plans[1].id = c.versions[0].snapshot.plans[0].id; },
    (c: AdvisoryCase) => { c.versions[0].snapshot.plans[1].preferred = true; },
    (c: AdvisoryCase) => { Reflect.set(c.versions[0].snapshot.plans[0].investmentPlans[0], "allocationId", "missing-allocation"); },
  ]) {
  const c = fixture(); corrupt(c);
  const store = new Store(); writeCaseStore(store, [c]); const bytes = [...store.values], before = JSON.stringify(c); let changes = 0;
  const oldWindow = globalThis.window; Object.assign(globalThis, { window: { confirm: () => true } });
  try { button(view(c, () => { changes++; }), "Wiederherstellen")!.onClick!(); }
  finally { Object.assign(globalThis, { window: oldWindow }); }
  assert.equal(changes, 0); assert.equal(JSON.stringify(c), before); assert.deepEqual([...store.values], bytes);
  }
});
console.log(`P3 plan-integrity contract: ${groups} groups passed; current strict graph, legacy migrations, P1 recovery, independent selections and actual Restore handler. Schema remains 11.`);
