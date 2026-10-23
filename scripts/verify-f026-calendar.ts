import assert from "node:assert/strict";
import { caseSnapshot, normalizeImportedCase, capitalPots, targetDateForNeed, targetYearForNeed, monthsUntilNeed } from "../app/case-model";
import { needCalendarDate, needCalendarParts, addLocalMonthsClamped } from "../app/domain/planning/calendar";
import { validCaseFinancialInputs } from "../app/domain/case/financial-validation";
import { legacyCapitalProtection } from "../app/domain/case/legacy-capital-protection";
import { diagnoseCapitalRecovery } from "../app/domain/case/capital-recovery-diagnosis";
import { previewNeedTermChange, commitNeedTermChange } from "../app/need-term-change";
import { CASE_STORAGE_KEY, RECOVERY_PREFIX, readCaseStore, saveCaseToStore, insertCaseIntoStore, writeCaseStore, recoveryBackups } from "../app/case-storage";
import { f026Variants, f026Case } from "./f026-fixtures";
import { controlCase, historyOwner } from "./f021-fixtures";
import { f012Case } from "./f012-fixtures";
import { germanDate } from "../app/presentation/formatters";

class Store {
  values = new Map<string, string>(); failBackup = false; corruptBackup = false;
  get length() { return this.values.size; } key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string, v: string) { if (this.failBackup && k.startsWith(RECOVERY_PREFIX)) throw Error("synthetic quota");
    this.values.set(k, this.corruptBackup && k.startsWith(RECOVERY_PREFIX) ? "incomplete" : v); }
}
let groups = 0;
function test(name: string, run: () => void) { run(); groups++; console.log(`PASS F026 ${name}`); }
test("actual result determines domain; all normals, boundaries and explicit precedence", () => {
  for (const v of f026Variants) {
    const c = f026Case(v), before = structuredClone(c), n = c.advisory.needs[0];
    assert.equal(needCalendarDate(n, c.createdAt), v.date, v.tag);
    assert.equal(validCaseFinancialInputs(c), v.date !== null, v.tag);
    assert.equal(!!normalizeImportedCase(c, false), v.date !== null, v.tag);
    if (v.date) {
      assert.equal(targetDateForNeed(n, c.createdAt), v.date); assert.equal(targetYearForNeed(n, c.createdAt), Number(v.date.slice(0, 4)));
      assert.ok(capitalPots(c.advisory, 200000, c.createdAt).some(p => p.id === `year-${Number(v.date.slice(0, 4))}`));
      assert.doesNotThrow(() => germanDate(v.date!)); assert.ok(Number.isFinite(monthsUntilNeed(n, c.createdAt)));
      const diagnosis = diagnoseCapitalRecovery(c, "UTC");
      assert.equal(diagnosis.needs[0].currentDate, v.date);
      assert.deepEqual(diagnosis.findings.filter(f => f.category === "D"), [], v.tag);
    } else for (const compute of [() => targetDateForNeed(n, c.createdAt), () => targetYearForNeed(n, c.createdAt),
      () => monthsUntilNeed(n, c.createdAt), () => capitalPots(c.advisory, 200000, c.createdAt)]) assert.throws(compute, /0100.*9999/);
    assert.deepEqual(c, before);
  }
});
test("two five-digit target years reject instead of collapsing; adjacent valid years stay separate", () => {
  const c = controlCase(); c.advisory.needs = [7974, 7975].map((years, id) => ({ id, purpose: "SYNTHETISCH", years, amount: 10000 }));
  assert.throws(() => capitalPots(c.advisory, 200000, c.createdAt)); assert.equal(normalizeImportedCase(c, false), null);
  c.advisory.needs = [7972, 7973].map((years, id) => ({ id, purpose: "SYNTHETISCH", years, amount: 10000 }));
  assert.deepEqual(capitalPots(c.advisory, 200000, c.createdAt).filter(p => p.kind === "year").map(p => p.id), ["year-9998", "year-9999"]);
});
test("shared arithmetic preserves schedules, clamping and recorded dates; malformed results return null", () => {
  for (const [ref, months, expected] of [["2028-01-31", 1, "2028-02-29"], ["2026-01-31", 1.99, "2026-02-28"],
    ["2028-03-31", -1, "2028-02-29"], ["0100-01-31", 0, "0100-01-31"],
    ["2026-12-31T23:30:00-10:00", 1, "2027-01-31"], ["9999-12-31", 1, "10000-01-31"]] as const)
    assert.equal(addLocalMonthsClamped(ref, months), expected);
  for (const months of [Infinity, NaN, 1e308, Number.MAX_SAFE_INTEGER]) assert.equal(addLocalMonthsClamped("2026-01-01", months), null);
  assert.equal(addLocalMonthsClamped("2026-01-01", 3284817), null);
  assert.equal(needCalendarParts(new Date("+010000-01-01T12:00:00Z")), null);
  assert.equal(needCalendarParts("2026-01-01junk"), null);
});
test("all P1 mutation forms enforce result validity without altering originals or neighbors", () => {
  for (const v of f026Variants) for (const op of [saveCaseToStore, insertCaseIntoStore, (s: Store, c: ReturnType<typeof f026Case>) => writeCaseStore(s, [c, controlCase("neighbor")])]) {
    const c = f026Case(v), before = structuredClone(c), s = new Store(); insertCaseIntoStore(s, controlCase("neighbor")); const original = [...s.values];
    if (v.date) { op(s, c); const entries = readCaseStore(s.getItem(CASE_STORAGE_KEY)); assert.equal(entries.cases.length, 2);
      assert.deepEqual(entries.cases.find(x => x.id === c.id)!.advisory, normalizeImportedCase(c, false)!.advisory);
      assert.deepEqual(entries.cases.find(x => x.id === c.id)!.advisory.needs, c.advisory.needs); }
    else { assert.throws(() => op(s, c)); assert.deepEqual([...s.values], original); }
    assert.deepEqual(c, before);
  }
});
test("damaged raw entries retain exact original backup, reuse and failed-backup protection", () => {
  for (const v of f026Variants.filter(v => v.date === null)) {
    const c = f026Case(v), neighbor = controlCase("neighbor"), bytes = JSON.stringify([c, neighbor], null, 2), s = new Store();
    s.setItem(CASE_STORAGE_KEY, bytes); assert.deepEqual(readCaseStore(bytes).protectedEntries, [c]);
    for (const mode of ["quota", "readback"]) { const f = new Store(); f.setItem(CASE_STORAGE_KEY, bytes); f.failBackup = mode === "quota"; f.corruptBackup = mode === "readback";
      assert.throws(() => saveCaseToStore(f, neighbor)); assert.equal(f.getItem(CASE_STORAGE_KEY), bytes); }
    saveCaseToStore(s, neighbor); assert.equal(recoveryBackups(s).length, 1); assert.equal(recoveryBackups(s)[0].original, bytes);
    saveCaseToStore(s, neighbor); assert.equal(recoveryBackups(s).length, 1);
    assert.deepEqual(JSON.parse(s.getItem(CASE_STORAGE_KEY)!).find((x: { id: string }) => x.id === c.id), c);
  }
});
test("opaque historical snapshots survive load/copy; actual restore normalization and H5 protect invalid sources", () => {
  for (const v of f026Variants) {
    const c = f026Case(v), owner = historyOwner(c), before = structuredClone(c), imported = normalizeImportedCase(owner)!;
    assert.notEqual(imported.id, owner.id); assert.deepEqual(imported.versions, owner.versions);
    const s = new Store(); insertCaseIntoStore(s, owner); assert.deepEqual(readCaseStore(s.getItem(CASE_STORAGE_KEY)).cases[0].versions, owner.versions);
    assert.equal(!!normalizeImportedCase({ ...caseSnapshot(c), versions: owner.versions }, false), v.date !== null);
    if (!v.date) {
      const d = diagnoseCapitalRecovery(c, "UTC"); assert.equal(d.repairable, false); assert.ok(d.findings.some(f => f.category === "D"));
      for (let schema = 0; schema <= 9; schema++) { const old = { ...c, schemaVersion: schema };
        assert.equal(legacyCapitalProtection(old), "invalid-data"); assert.equal(normalizeImportedCase(old, false), null); }
    }
    assert.deepEqual(c, before);
  }
});
test("F012 invalid input cannot reach reconciliation or reuse a valid confirmation", () => {
  const c = f012Case(), before = structuredClone(c), request = { caseId: c.id, needId: 701, mode: "years" as const, value: 2.5 };
  const valid = previewNeedTermChange(c, request); assert.ok(valid.losses.length);
  for (const value of [7974, 7975, 1e6, 1e308, Number.MAX_VALUE]) {
    const r = { ...request, value }; assert.throws(() => previewNeedTermChange(c, r), /0100.*9999/);
    assert.equal(commitNeedTermChange(c, r, valid.key), c); assert.deepEqual(c, before);
  }
  for (const years of [100, 200]) { const next = previewNeedTermChange(c, { ...request, value: years }); assert.equal(next.afterYear, 2026 + years); }
});
console.log(`F026 calendar domain: ${groups} groups passed; ${f026Variants.length} variants; no business duration cap.`);
