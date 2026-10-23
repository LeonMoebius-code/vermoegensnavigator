import assert from "node:assert/strict";
import { normalizeImportedCase, updateCaseAdvisory, caseSnapshot } from "../app/case-model";
import { previewNeedTermChange as preview, commitNeedTermChange as commit, type NeedTermRequest } from "../app/need-term-change";
import { readCaseStore, saveCaseToStore, CASE_STORAGE_KEY } from "../app/case-storage";
import { f012Case } from "./f012-fixtures";
import { h5bCase } from "./h5b-fixtures";
import { qualityProtectedCase } from "./quality-fixtures";
import { diagnoseCapitalRecovery } from "../app/domain/case/capital-recovery-diagnosis";
let groups = 0;
function test(name: string, run: () => void) { run(); groups++; console.log(`PASS F012 ${name}`); }
const request = (c = f012Case(), value = "2029-04-15"): NeedTermRequest => ({ caseId: c.id, needId: 701, mode: "date", value });

test("preview is pure, reproducible and exactly matches the production update for every plan", () => {
  const c = f012Case(), before = structuredClone(c), p = preview(c, request(c));
  assert.deepEqual(c, before); assert.deepEqual(preview(c, request(c)), p);
  assert.deepEqual(p.next, updateCaseAdvisory(c, "needs", c.advisory.needs.map(n => n.id === 701 ? { ...n, dueDate: "2029-04-15" } : n)));
  assert.deepEqual(c.versions, before.versions); assert.equal(p.losses.length, 5);
});
test("full and partial losses identify every plan/product/pot and exact remaining amount", () => {
  const p = preview(f012Case(), request());
  assert.deepEqual(p.losses.filter(x => x.kind === "allocation").map(x => [x.planName, x.productName, x.pot, x.lost, x.remaining]), [
    ["Plan Alpha", "Produkt Voll", "Zieljahr 2028", 8000, 0],
    ["Plan Alpha", "Produkt Geteilt", "Zieljahr 2028", 6000.25, 3999.75],
    ["Plan Beta", "Produkt Beta", "Zieljahr 2028", 5000, 0],
  ]);
  assert.deepEqual(p.next.plans[0].allocations[0].capitalPotAmounts, { "year-2030": 3999.75 });
  assert.deepEqual(p.next.plans[0].investmentPlans, f012Case().plans[0].investmentPlans.filter(x => x.id === "einstieg-rest"));
});
test("all removed phased plans retain plan/product, rates, frequency and start in preview", () => {
  const losses = preview(f012Case(), request()).losses.filter(x => x.kind === "phased");
  assert.deepEqual(losses.map(x => [x.planName, x.productName, x.entryId, x.lost, x.installments, x.frequency, x.startDate]), [
    ["Plan Alpha", "Produkt Voll", "einstieg-voll", 4000, 4, "monthly", "2026-11-01"],
    ["Plan Beta", "Produkt Beta", "einstieg-beta", 2500, 4, "monthly", "2026-11-01"],
  ]);
});
test("same-year changes and exact identical input have no planning loss", () => {
  const c = f012Case(), p = preview(c, request(c, "2028-05-20"));
  assert.deepEqual(p.losses, []); assert.deepEqual(p.next.plans, c.plans);
  assert.equal(preview(c, request(c, "2028-04-15")).next, c);
});
test("other need in old year retains all bindings; free pots require no confirmation", () => {
  const c = f012Case(); c.advisory.needs.push({ ...c.advisory.needs[0], id: 703 });
  assert.deepEqual(preview(c, request(c)).losses, []);
  assert.deepEqual(preview(c, request(c)).next.plans, c.plans);
  c.plans.forEach(p => { p.allocations = []; p.investmentPlans = []; });
  assert.deepEqual(preview(c, request(c)).losses, []);
});
test("relative years and calendar date precedence use fixed createdAt and preserve unused years", () => {
  const c = f012Case();
  const relative = preview(c, { ...request(c), mode: "years", value: 1.49 });
  assert.equal(relative.afterDate, "2028-04-15"); assert.equal(relative.next.advisory.needs[0].dueDate, "");
  assert.deepEqual(relative.losses, []); assert.deepEqual(relative.next.plans, c.plans);
  assert.equal(preview(c, { ...request(c), mode: "years", value: 0 }).afterDate, "2026-10-15");
  assert.equal(preview(c, request(c, "2028-02-29")).next.advisory.needs[0].years, 1.49);
  Reflect.set(c.advisory.needs[0], "years", "unused-malformed");
  assert.equal(preview(c, request(c, "2028-02-29")).next.advisory.needs[0].years, "unused-malformed");
});
test("invalid, incomplete, nonfinite input rejects before reconciliation without mutation", () => {
  const c = f012Case(), original = structuredClone(c);
  for (const value of ["", "2028-0", "2028-02-30", "2028-01-01junk"]) assert.throws(() => preview(c, request(c, value)));
  for (const value of [NaN, Infinity, -Infinity, -1, null, false, "2", ""]) {
    assert.throws(() => preview(c, { ...request(c), mode: "years", value } as NeedTermRequest));
    assert.equal(commit(c, { ...request(c), mode: "years", value } as NeedTermRequest, "unreviewed"), c);
  }
  assert.deepEqual(c, original);
});
test("only reviewed consequences commit; new losses, plans and revised labels invalidate approval", () => {
  const c = f012Case(), r = request(c), p = preview(c, r);
  assert.equal(commit(c, r, "unreviewed"), c); assert.deepEqual(commit(c, r, p.key), p.next);
  for (const mutate of [
    (n: typeof c) => { n.plans[0].allocations[0].amount += 100; n.plans[0].allocations[0].capitalPotAmounts!["year-2028"]! += 100; },
    (n: typeof c) => { n.plans.push({ ...structuredClone(n.plans[1]), id: "new-plan", name: "New plan" }); },
    (n: typeof c) => { n.plans[1].name = "Renamed plan"; },
    (n: typeof c) => { n.plans[0].investmentPlans[0].note = "Changed execution"; },
  ]) { const n = structuredClone(c); mutate(n); assert.equal(commit(n, r, p.key), n); assert.notEqual(preview(n, r).key, p.key); }
});
test("unrelated latest fields survive atomic application; case switch/removal fails closed", () => {
  const c = f012Case(), r = request(c), p = preview(c, r);
  const newer = { ...c, status: "In Prüfung" as const };
  assert.equal(commit(newer, r, p.key).status, "In Prüfung");
  const other = { ...c, id: "other" }; assert.equal(commit(other, r, p.key), other);
  const removed = { ...c, advisory: { ...c.advisory, needs: [] } }; assert.equal(commit(removed, r, p.key), removed);
});
test("no reassignment, unassigned loss and indirectly removed entries are also reported", () => {
  const c = f012Case(); c.plans[0].allocations[0].amount = 9000;
  const p = preview(c, request(c));
  assert.ok(p.losses.some(x => x.pot.startsWith("Nicht zugeordnet") && x.lost === 1000));
  assert.ok(p.next.plans.every(plan => plan.allocations.every(a => !a.capitalPotAmounts?.["year-2029"] && !a.capitalPotAmounts?.strategic)));
  // Actual reconciliation removes an entry with no remaining referenced allocation.
  c.plans[0].investmentPlans[0] = { ...c.plans[0].investmentPlans[0], capitalPotId: "year-2030" } as typeof c.plans[0]["investmentPlans"][number];
  assert.ok(preview(c, request(c)).losses.some(x => x.entryId === "einstieg-voll"));
});
test("incomplete loss metadata blocks instead of hiding impact", () => {
  const c = f012Case(); c.plans[1].allocations[0].productName = "";
  assert.throws(() => preview(c, request(c)), /nicht vollständig/);
});
test("JSON/save/reopen/plan switch keep reviewed state and schema11; original history survives", () => {
  const c = f012Case(), p = preview(c, request(c)), next = commit(c, request(c), p.key);
  class Store { values = new Map<string,string>(); get length() { return this.values.size; } key(i:number) { return [...this.values.keys()][i] ?? null; }
    getItem(k:string) { return this.values.get(k) ?? null; } setItem(k:string,v:string) { this.values.set(k,v); } }
  const store = new Store(); saveCaseToStore(store, next);
  assert.ok(store.getItem(CASE_STORAGE_KEY)); const loaded = readCaseStore(store.getItem(CASE_STORAGE_KEY)).cases[0];
  assert.deepEqual(loaded.plans, next.plans); assert.equal(loaded.schemaVersion, 11);
  const imported = normalizeImportedCase(JSON.parse(JSON.stringify({ case: next })), false)!;
  assert.deepEqual(imported.plans, next.plans); assert.deepEqual(imported.versions, c.versions);
  assert.deepEqual(caseSnapshot({ ...next, activePlanId: next.plans[1].id }).plans, next.plans);
  assert.deepEqual(next.savingsGoals, c.savingsGoals);
});
test("H3/H5 protected original cannot become editable through term proposal", () => {
  const protectedCase = qualityProtectedCase(), original = structuredClone(protectedCase);
  assert.equal(normalizeImportedCase(protectedCase, false), null);
  assert.deepEqual(protectedCase, original);
  const historical = h5bCase(), historicalBefore = structuredClone(historical);
  assert.equal(normalizeImportedCase(historical, false), null);
  assert.ok(diagnoseCapitalRecovery(historical, "UTC").findings.length > 0);
  assert.throws(() => preview(historical, { caseId: historical.id, needId: historical.advisory.needs[0].id, mode: "date", value: "2029-04-15" }), /Kapitaltopf/);
  assert.deepEqual(historical, historicalBefore);
});
console.log(`F012 ${groups} test groups passed`);
