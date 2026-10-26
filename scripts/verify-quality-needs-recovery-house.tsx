import assert from "node:assert/strict";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as XLSX from "xlsx";
import { targetDateForNeed, targetYearForNeed, monthsUntilNeed, capitalPots, bucketTargets,
  phasedEntryScheduleValidation, capitalPotDeadline, normalizeImportedCase, caseSnapshot } from "../app/case-model";
import { CASE_STORAGE_KEY, readCaseStore, recoveryBackups, saveCaseToStore, removeCaseFromStore } from "../app/case-storage";
import { caseStoreNotice } from "../app/presentation/case-store-notice";
import { ExportCenter, NeedsStep } from "../app/page";
import { qualityNeedsCase, qualityOptionalCase, qualityProtectedCase } from "./quality-fixtures";

const reference = "2026-10-15T23:30:00.000Z";
const need = (years: number, dueDate?: string) => ({ id: 1, purpose: "Synthetisch", amount: 10000, years, ...(dueDate ? { dueDate } : {}) });
for (const [date, years, expected, months] of [
  [reference, 1.49, "2028-04-15", 18], [reference, 1.5, "2028-04-15", 18],
  ["2026-01-31", 1 / 12, "2026-02-28", 1], ["2028-01-31", 1 / 12, "2028-02-29", 1],
  ["2028-02-29", 1, "2029-02-28", 12], ["2026-12-31", 1 / 12, "2027-01-31", 1],
  ["2026-01-31", 2 / 12, "2026-03-31", 2], [reference, 0, "2026-10-15", 0],
  [reference, 0.49 / 12, "2026-10-15", 0], [reference, 0.5 / 12, "2026-11-15", 1],
] as const) {
  assert.equal(monthsUntilNeed(need(years), date), months);
  assert.equal(targetDateForNeed(need(years), date), expected);
  assert.equal(targetYearForNeed(need(years), date), Number(expected.slice(0, 4)));
}
const priorZone = process.env.TZ;
try {
  for (const zone of ["UTC", "Europe/Berlin", "America/Los_Angeles", "Pacific/Auckland"]) {
    process.env.TZ = zone;
    assert.equal(targetDateForNeed(need(1.5), reference), "2028-04-15", zone);
    assert.equal(monthsUntilNeed(need(9, "2027-01-01"), "2026-10-31T23:30:00.000Z"), 3, zone);
  }
} finally { if (priorZone === undefined) delete process.env.TZ; else process.env.TZ = priorZone; }
assert.equal(targetDateForNeed(need(9, "2027-01-03"), reference), "2027-01-03");
assert.equal(monthsUntilNeed(need(9, "2027-01-03"), reference), 3);
assert.equal(monthsUntilNeed(need(9, "2020-01-03"), reference), 0);
assert.equal(targetYearForNeed(need(9, "2020-01-03"), reference), 2020);
assert.throws(() => targetDateForNeed(need(1), "invalid-reference"));
console.log("PASS Zeitrechnung: Monatsrundung, 1,49/1,50, Monatsenden, Februar, Schaltjahre, Jahreswechsel, explizite Termine und feste Kalenderbasis in vier Zeitzonen");

const c = qualityNeedsCase(), originalCase = JSON.stringify(c);
const pots = capitalPots(c.advisory, c.plans[0].total, c.createdAt);
assert.deepEqual(pots.map(p => [p.id, p.total]), [["year-2028", 35000], ["strategic", 125000]]);
assert.equal(pots[0].minMonths, 18);
assert.equal(pots[0].earliestDueDate, "2028-04-01");
assert.equal(capitalPotDeadline(pots[0], c.createdAt), "2028-04-01");
// A later explicit date must not hide an earlier derived deadline in the same year.
const mixed = capitalPots({ ...c.advisory, needs: [need(1.5), { ...need(9, "2028-12-31"), id: 2 }] }, 160000, c.createdAt)[0];
assert.equal(capitalPotDeadline(mixed, c.createdAt), "2028-04-15");
assert.equal(phasedEntryScheduleValidation({ startDate: "2028-03-15", installments: 2, frequency: "monthly" }, mixed, c.createdAt).valid, true);
assert.equal(phasedEntryScheduleValidation({ startDate: "2028-03-16", installments: 2, frequency: "monthly" }, mixed, c.createdAt).valid, false);
assert.equal(bucketTargets(c.advisory, 160000, c.createdAt).year3, 35000);
const renderedNeeds = renderToStaticMarkup(<NeedsStep data={c.advisory} referenceDate={c.createdAt} update={() => {}} addNeed={() => {}} updateNeed={() => {}} removeNeed={() => {}} applyTerm={() => {}} />);
assert.equal((renderedNeeds.match(/15.04.2028/g) || []).length, 2);
assert.ok(renderedNeeds.includes('placeholder="Konkreter Termin ist führend" value=""'));
assert.ok(!renderedNeeds.includes('value="9"'));
assert.equal(JSON.stringify(c), originalCase);
console.log("PASS Bedarfskonsistenz: gemeinsamer Kapitaltopf, frühester gemischter Termin, Umsetzungsgrenze, Laufzeitband und UI ohne veraltete gültige Jahreseingabe");

class Store {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string, v: string) { this.values.set(k, v); }
  key(i: number) { return [...this.values.keys()][i] ?? null; }
}
for (const fixture of [c, qualityOptionalCase()]) {
  const raw = JSON.stringify([fixture], null, 2), loaded = readCaseStore(raw), s = new Store();
  s.setItem(CASE_STORAGE_KEY, raw);
  assert.equal(loaded.cases.length, 1); assert.equal(loaded.protectedEntries.length, 0);
  assert.deepEqual(loaded.cases[0].advisory.needs, fixture.advisory.needs);
  assert.deepEqual(loaded.cases[0].versions, fixture.versions);
  assert.deepEqual(loaded.cases[0].plans, fixture.plans);
  if (fixture.id === c.id) assert.equal(caseStoreNotice(loaded), null);
  else {
    assert.equal(loaded.optionalData.positions, 2);
    assert.equal(caseStoreNotice(loaded), null);
    assert.equal(loaded.recoveryNeeded, true);
    const notice = caseStoreNotice(loaded, true)!;
    assert.equal(notice.severity, "info");
    assert.ok(notice.text.includes("2 Positionen")); assert.ok(notice.text.includes("Datumsangaben"));
    assert.ok(!notice.text.includes("0 beschädigte")); assert.ok(!notice.text.includes("VERTRAULICHER-TESTWERT"));
    assert.deepEqual(loaded.recoveryEntries, [fixture]);
  }
  saveCaseToStore(s, loaded.cases[0]);
  const reopened = readCaseStore(s.getItem(CASE_STORAGE_KEY));
  assert.equal(reopened.recoveryNeeded, false);
  assert.deepEqual(reopened.cases[0].advisory.needs, fixture.advisory.needs);
  assert.deepEqual(reopened.cases[0].versions, fixture.versions);
  assert.deepEqual(reopened.cases[0].plans, fixture.plans);
  if (fixture.id !== c.id) assert.equal(recoveryBackups(s)[0].original, raw);
}
for (const entries of [[qualityProtectedCase(), c], [qualityProtectedCase(), qualityOptionalCase(), c]]) {
  const raw = JSON.stringify(entries, null, 2), loaded = readCaseStore(raw), notice = caseStoreNotice(loaded)!;
  assert.equal(notice.severity, "error"); assert.ok(notice.text.includes("1 beschädigter oder inkonsistenter Fall"));
  assert.equal(notice.text.includes("2 Positionen"), entries.length === 3);
  const s = new Store(); s.setItem(CASE_STORAGE_KEY, raw);
  saveCaseToStore(s, c); saveCaseToStore(s, { ...c, status: "In Prüfung" });
  assert.equal(recoveryBackups(s).length, 1); assert.equal(recoveryBackups(s)[0].original, raw);
  assert.deepEqual(readCaseStore(s.getItem(CASE_STORAGE_KEY)).protectedEntries, [entries[0]]);
  const before = [...s.values];
  assert.throws(() => removeCaseFromStore(s, entries[0].id)); assert.deepEqual([...s.values], before);
}
for (const raw of ["{broken", '{"not":"an array"}']) {
  const s = new Store(); s.setItem(CASE_STORAGE_KEY, raw);
  assert.equal(caseStoreNotice(readCaseStore(raw))!.severity, "error");
  assert.ok(caseStoreNotice(readCaseStore(raw))!.text.includes("Speichern ist zum Schutz des Bestands gesperrt"));
  assert.throws(() => saveCaseToStore(s, c)); assert.equal(s.getItem(CASE_STORAGE_KEY), raw);
}
// No historical reassignment/migration: a now-invalid former year reference
// remains protected by the unmodified P3 graph boundary, with all original bytes.
const legacy = qualityNeedsCase("old-year-reference");
legacy.advisory.needs = [need(1.49)];
legacy.plans[0].allocations = [{ id: "old-year-allocation", productId: "synthetic", productName: "Synthetisch", source: "product", solutionId: "mixed",
  amount: 10000, bucketId: "year3", capitalPotId: "year-2027", capitalPotAmounts: { "year-2027": 10000 } }];
const legacyRaw = JSON.stringify([legacy, c], null, 2), legacyRead = readCaseStore(legacyRaw), legacyStore = new Store();
assert.equal(normalizeImportedCase(legacy, false), null);
assert.deepEqual(legacyRead.protectedEntries, [legacy]);
legacyStore.setItem(CASE_STORAGE_KEY, legacyRaw); saveCaseToStore(legacyStore, c);
assert.equal(recoveryBackups(legacyStore)[0].original, legacyRaw);
assert.deepEqual(readCaseStore(legacyStore.getItem(CASE_STORAGE_KEY)).protectedEntries, [legacy]);
console.log("PASS Recovery: getrennte Hinweise, genaue Positionsanzahl, feste Feldkategorien, keine Originalwerte, Nachbarfälle, unveränderte Backups/Schreibsperren und geschützte alte Jahresbezüge");

XLSX.set_fs(fs);
function exportButton(node: ReactNode): (() => void) | undefined {
  if (Array.isArray(node)) return node.map(exportButton).find(Boolean);
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return undefined;
  return node.type === "button" && renderToStaticMarkup(node).includes("Excel-Arbeitsmappe") ? node.props.onClick : exportButton(node.props.children);
}
const cwd = process.cwd(), dir = fs.mkdtempSync(join(tmpdir(), "vn-quality-needs-"));
try {
  process.chdir(dir);
  const view = ExportCenter({ item: c, preferredPlan: c.plans[0], setItem: () => {}, saveCase: () => {}, exportJson: () => {}, importJson: () => {} });
  exportButton(view)!();
  const file = fs.readdirSync(dir).find(f => f.endsWith(".xlsx"))!;
  const workbook = XLSX.read(fs.readFileSync(file), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<{ Termin: string; Zieljahr: number; Monate: number }>(workbook.Sheets.Kapitalbedarfe);
  assert.deepEqual(rows.map(r => [r.Termin, r.Monate, r.Zieljahr]), [["2028-04-15", 18, 2028], ["2028-04-15", 18, 2028], ["2028-04-01", 18, 2028]]);
  const print = renderToStaticMarkup(view);
  assert.ok(print.includes("15.04.2028 · berechnet (18 Monate)"));
  assert.ok(print.includes("01.04.2028")); assert.ok(!print.includes("in 9 Jahren"));
  const imported = normalizeImportedCase(JSON.parse(JSON.stringify({ case: c })), false)!;
  assert.equal(imported.schemaVersion, 11); assert.deepEqual(caseSnapshot({ ...imported, updatedAt: c.updatedAt }), caseSnapshot(c));
  assert.deepEqual(imported.versions, c.versions);
  assert.equal(JSON.stringify(c), originalCase);
} finally { process.chdir(cwd); fs.rmSync(dir, { recursive: true }); }
console.log("PASS Ausgaben: echtes XLSX, Drucktermine, Schema11/JSON, unveränderte relative Eingaben, Historien und Fallidentitäten");
