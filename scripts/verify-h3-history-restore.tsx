import assert from "node:assert/strict";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createCase, createPlan, caseSnapshot, normalizeImportedCase, getPreferredStructurePlan,
  buildIstWealthStructure, buildPlanWealthStructure, type AdvisoryCase } from "../app/case-model";
import { CASE_STORAGE_KEY, readCaseStore, recoveryBackups, insertCaseIntoStore, saveCaseToStore } from "../app/case-storage";
import { ExportCenter } from "../app/page";

const LABEL = "Version ohne gültige Bezeichnung";
const PREVIEW = "Historische Vorschau nicht verfügbar";
const FAILURE = "Diese historische Version kann aufgrund beschädigter Daten nicht wiederhergestellt werden. Der aktuelle Arbeitsstand bleibt unverändert.";
const AS_OF = "2026-01-01T12:00:00.000Z";
function fixture(id = "h3-current"): AdvisoryCase {
  const c = createCase();
  Object.assign(c, { id, createdAt: AS_OF, updatedAt: AS_OF });
  Object.assign(c.advisory, { caseName: "Synthetischer H3-Fall", liquidAssets: 10000, reserve: 100 });
  c.depotAccounts = [{ id: "h3-account", name: "Synthetisches Depot", createdAt: AS_OF, updatedAt: AS_OF }];
  c.plans = [createPlan("Synthetisch bevorzugt", 10000), createPlan("Synthetisch aktiv", 5000)];
  c.plans.forEach(p => Object.assign(p, { capitalMode: "manual", depotSelectionInitialized: false, depotModeSelectionInitialized: false }));
  c.plans[0].preferred = true; c.plans[1].preferred = false; c.activePlanId = c.plans[1].id;
  c.savingsGoals = [{ id: "h3-goal", name: "Synthetisches Ziel", targetAmount: 1000 }];
  const snapshot = caseSnapshot(c); snapshot.id = "h3-original-snapshot-id";
  c.versions = [{ id: "h3-version", label: "Synthetischer Zwischenstand", createdAt: AS_OF, snapshot }];
  return c;
}
class Store {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string, v: string) { this.values.set(k, v); }
}
type Props = { children?: ReactNode; onClick?: () => void };
function buttons(node: ReactNode): (() => void)[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement<Props>(node)) return [];
  if (node.type === "button" && renderToStaticMarkup(node).includes("Wiederherstellen")) return [node.props.onClick!];
  return buttons(node.props.children);
}
function view(c: AdvisoryCase, apply: (next: AdvisoryCase) => void = () => {}) {
  return ExportCenter({ item: c, preferredPlan: getPreferredStructurePlan(c.plans),
    setItem: (next) => apply(typeof next === "function" ? next(c) : next),
    saveCase: () => { throw new Error("Restore must not save"); }, exportJson: () => {}, importJson: () => {} });
}
function restore(c: AdvisoryCase, confirm = true, index = 0) {
  const alerts: string[] = [], confirms: string[] = []; let next: AdvisoryCase | undefined;
  const previous = globalThis.window;
  Object.assign(globalThis, { window: {
    confirm: (message: string) => { confirms.push(message); return confirm; },
    alert: (message: string) => { alerts.push(message); },
  } });
  try { buttons(view(c, value => { next = value; }))[index](); }
  finally { Object.assign(globalThis, { window: previous }); }
  return { next, alerts, confirms };
}
let groups = 0, renderCases = 0, rejected = 0;
function test(name: string, run: () => void) { run(); groups++; console.log(`PASS H3 ${name}`); }
const corruptSnapshots: [string, (c: AdvisoryCase) => void][] = [
  ["missing", c => Reflect.deleteProperty(c.versions[0], "snapshot")],
  ...[null, 42, "bad", true, []].map(v => ["snapshot=" + JSON.stringify(v), (c: AdvisoryCase) => { Reflect.set(c.versions[0], "snapshot", v); }] as [string, (c: AdvisoryCase) => void]),
  ["missing plans", c => Reflect.deleteProperty(c.versions[0].snapshot, "plans")],
  ...[null, {}, "bad", [null], [1], [false], ["bad"], [[]],
    [{ name: "Plan", preferred: "true" }], [{ name: {}, preferred: true }],
    [{ name: 42, preferred: true }], [{ name: "", preferred: true }],
    [{ name: "Plan" }], [{ name: "A", preferred: true }, { name: "B", preferred: true }],
  ].map(v => ["plans=" + JSON.stringify(v), (c: AdvisoryCase) => { Reflect.set(c.versions[0].snapshot, "plans", v); }] as [string, (c: AdvisoryCase) => void]),
];
test("productive ExportCenter renders valid exact labels and independent preferred metadata", () => {
  const c = fixture(); c.versions[0].label = "  Unverändert <Version>  "; const before = structuredClone(c);
  const html = renderToStaticMarkup(view(c));
  assert.ok(html.includes("  Unverändert &lt;Version&gt;  ")); assert.ok(html.includes("2 Planungen · bevorzugt: Synthetisch bevorzugt"));
  assert.deepEqual(c, before); renderCases++;
});
test("object/array/number/null/absent/empty labels use safe text without modifying valid snapshots", () => {
  for (const label of [{ bad: true }, [], ["bad"], 42, true, null, undefined, "", "   "]) {
    const c = fixture(); Reflect.set(c.versions[0], "label", label); const before = structuredClone(c);
    assert.ok(renderToStaticMarkup(view(c)).includes(LABEL));
    const r = restore(c); assert.ok(r.next); assert.equal(r.alerts.length, 0);
    assert.equal(r.confirms[0], `${LABEL} als aktuellen Arbeitsstand wiederherstellen?`);
    assert.deepEqual(r.next.versions, c.versions); assert.deepEqual(c, before); renderCases++;
  }
});
test("missing/primitive snapshots, malformed plan lists and metadata render fallback without invented counts", () => {
  for (const [name, damage] of corruptSnapshots) {
    const c = fixture(); damage(c); const before = structuredClone(c), html = renderToStaticMarkup(view(c));
    assert.ok(html.includes(PREVIEW), name); assert.ok(!html.includes("Planungen · bevorzugt:"), name);
    assert.equal(buttons(view(c)).length, 1); assert.deepEqual(c, before); renderCases++;
  }
});
test("empty plans and absent preferred selection have truthful shallow metadata", () => {
  for (const empty of [true, false]) {
    const c = fixture(); if (empty) c.versions[0].snapshot.plans = [];
    else c.versions[0].snapshot.plans.forEach(p => { p.preferred = false; });
    const before = structuredClone(c), html = renderToStaticMarkup(view(c));
    assert.ok(html.includes(`${empty ? 0 : 2} Planungen · bevorzugt: –`)); assert.deepEqual(c, before); renderCases++;
  }
});
test("valid actual Restore preserves outer ID, full history, graph, selections and calculations without saving", () => {
  const c = fixture(), s = new Store(); insertCaseIntoStore(s, c); const storeBefore = [...s.values];
  c.advisory.caseName = "Aktueller abweichender Stand"; c.status = "Abgeschlossen";
  const before = structuredClone(c), start = Date.now(), r = restore(c); assert.ok(r.next);
  assert.equal(r.next.id, c.id); assert.deepEqual(r.next.versions, c.versions);
  assert.deepEqual(r.next.plans, c.versions[0].snapshot.plans); assert.equal(r.next.activePlanId, c.plans[1].id);
  assert.equal(getPreferredStructurePlan(r.next.plans)?.id, c.plans[0].id); assert.equal(r.next.status, "Entwurf");
  assert.equal(r.next.advisory.caseName, "Synthetischer H3-Fall");
  assert.ok(Date.parse(r.next.updatedAt) >= start && Date.parse(r.next.updatedAt) <= Date.now());
  assert.deepEqual(buildIstWealthStructure(r.next.depot, r.next.advisory.liquidAssets), buildIstWealthStructure(c.depot, c.advisory.liquidAssets));
  r.next.plans.forEach((p, i) => assert.deepEqual(buildPlanWealthStructure(r.next!.depot, p), buildPlanWealthStructure(c.depot, c.plans[i])));
  assert.deepEqual(c, before); assert.deepEqual([...s.values], storeBefore); assert.deepEqual(r.alerts, []);
});
const restoreDamage: [string, (c: AdvisoryCase) => void][] = [
  ...corruptSnapshots,
  ["empty plans", c => { c.versions[0].snapshot.plans = []; }],
  ["missing active", c => { c.versions[0].snapshot.activePlanId = "missing"; }],
  ["duplicate plan IDs", c => { c.versions[0].snapshot.plans[1].id = c.plans[0].id; }],
  ["contradictory preferred", c => { c.versions[0].snapshot.plans[1].preferred = true; }],
  ["numeric account name", c => { Reflect.set(c.versions[0].snapshot.depotAccounts[0], "name", 123); }],
  ["H2 financial string", c => { Reflect.set(c.versions[0].snapshot.advisory, "reserve", "100"); }],
  ...[null, 42, "bad", [], {}, { id: "goal" }, { id: "goal", targetAmount: "100" }].map(v =>
    ["H2 goal=" + JSON.stringify(v), (c: AdvisoryCase) => { Reflect.set(c.versions[0].snapshot, "savingsGoals", [v]); }] as [string, (c: AdvisoryCase) => void]),
];
test("all actual invalid Restore handlers reject with exact public message and no source/store/recovery mutation", () => {
  for (const [name, damage] of restoreDamage) {
    const c = fixture(); damage(c); const s = new Store(); insertCaseIntoStore(s, c);
    const before = structuredClone(c), bytes = [...s.values], r = restore(c);
    assert.equal(r.next, undefined, name); assert.deepEqual(r.alerts, [FAILURE], name);
    assert.deepEqual(c, before); assert.deepEqual([...s.values], bytes); rejected++;
  }
});
test("genuine normalization exception caught by productive event handler, raw data not disclosed", () => {
  const c = fixture(); Reflect.set(c.versions[0].snapshot.advisory, "caseName", 123n);
  const before = structuredClone(c); assert.throws(() => normalizeImportedCase(c.versions[0].snapshot, false), /BigInt/);
  const r = restore(c); assert.equal(r.next, undefined); assert.deepEqual(r.alerts, [FAILURE]); assert.deepEqual(c, before);
});
test("cancel occurs before even broken normalization and makes no alert, timestamp, history or store change", () => {
  const c = fixture(); Reflect.set(c.versions[0].snapshot.advisory, "caseName", 123n);
  const before = structuredClone(c), r = restore(c, false);
  assert.equal(r.next, undefined); assert.deepEqual(r.alerts, []); assert.deepEqual(c, before);
});
test("JSON import/insert/reload/render/failed Restore/save retains opaque originals and healthy neighbor", () => {
  const c = fixture(); const good = structuredClone(c.versions[0]);
  c.versions.push({ ...structuredClone(good), id: "h3-bad" }, { ...structuredClone(good), id: "h3-label" });
  Reflect.set(c.versions[1], "snapshot", null); Reflect.set(c.versions[2], "label", { bad: true });
  const history = structuredClone(c.versions), imported = normalizeImportedCase(JSON.parse(JSON.stringify({ case: c }))); assert.ok(imported);
  assert.notEqual(imported.id, c.id); assert.deepEqual(imported.versions, history);
  const s = new Store(); insertCaseIntoStore(s, fixture("neighbor")); insertCaseIntoStore(s, imported);
  const loaded = readCaseStore(s.getItem(CASE_STORAGE_KEY)); assert.equal(loaded.recoveryNeeded, false);
  const current = loaded.cases.find(v => v.id === imported.id)!; const before = structuredClone(current), bytes = [...s.values];
  assert.equal(buttons(view(current)).length, 3); const html = renderToStaticMarkup(view(current));
  assert.ok(html.includes(LABEL) && html.includes(PREVIEW) && html.includes("Synthetischer Zwischenstand"));
  assert.deepEqual(restore(current, true, 1).alerts, [FAILURE]); assert.deepEqual(current, before); assert.deepEqual([...s.values], bytes);
  const goodRestore = restore(current, true, 2); assert.ok(goodRestore.next);
  assert.equal(goodRestore.next.id, imported.id); assert.deepEqual(goodRestore.next.versions, history);
  assert.deepEqual([...s.values], bytes); saveCaseToStore(s, goodRestore.next);
  const reopened = readCaseStore(s.getItem(CASE_STORAGE_KEY)); assert.equal(reopened.recoveryNeeded, false);
  assert.equal(reopened.cases.length, 2); assert.deepEqual(reopened.cases.find(v => v.id === imported.id)!.versions, history);
  assert.equal(recoveryBackups(s).length, 0);
});
test("account type failures reject import without exceptions; strings and legacy absent/blank defaults preserved", () => {
  for (const schema of [7, 10, 11]) {
    for (const name of [123, null, [], {}, true]) {
      const c = fixture(); Reflect.set(c, "schemaVersion", schema); Reflect.set(c.depotAccounts[0], "name", name);
      const before = structuredClone(c); assert.equal(normalizeImportedCase(c, false), null); assert.deepEqual(c, before);
    }
    for (const [name, expected] of [["Synthetisches Depot", "Synthetisches Depot"], ["  Depot  ", "Depot"], ["", "Depot 1"], ["   ", "Depot 1"], [undefined, "Depot 1"]]) {
      const c = fixture(); Reflect.set(c, "schemaVersion", schema); Reflect.set(c.depotAccounts[0], "name", name);
      const n = normalizeImportedCase(c, false); assert.ok(n); assert.equal(n.depotAccounts[0].name, expected);
    }
  }
});
test("P1 protects invalid current account originals with full reusable backup and healthy neighbors", () => {
  const damaged = fixture("damaged"); Reflect.set(damaged.depotAccounts[0], "name", 123);
  const neighbor = fixture("neighbor"); Reflect.set(neighbor.versions[0], "snapshot", null);
  const original = JSON.stringify([damaged, neighbor], null, 2), s = new Store(); s.setItem(CASE_STORAGE_KEY, original);
  const loaded = readCaseStore(original); assert.equal(loaded.recoveryNeeded, true);
  assert.deepEqual(loaded.protectedEntries, [damaged]); assert.deepEqual(loaded.cases.map(c => c.id), ["neighbor"]);
  saveCaseToStore(s, { ...loaded.cases[0], status: "In Prüfung" });
  assert.equal(recoveryBackups(s)[0].original, original); assert.equal(recoveryBackups(s).length, 1);
  saveCaseToStore(s, { ...loaded.cases[0], status: "Abgeschlossen" });
  assert.equal(recoveryBackups(s).length, 1); assert.equal(recoveryBackups(s)[0].original, original);
  assert.deepEqual(readCaseStore(s.getItem(CASE_STORAGE_KEY)).protectedEntries, [damaged]);
  const bytes = [...s.values];
  assert.deepEqual(restore(loaded.cases[0]).alerts, [FAILURE]); assert.deepEqual([...s.values], bytes);
  assert.throws(() => insertCaseIntoStore(s, damaged)); assert.deepEqual([...s.values], bytes);
});
console.log(`H3 history/restore: ${groups} groups passed; ${renderCases} productive render variants; ${rejected} controlled Restore rejections; genuine exception, opaque JSON history and P1 verified.`);
