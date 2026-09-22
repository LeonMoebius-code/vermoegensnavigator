import assert from "node:assert/strict";
import "./verify-asset-classification";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isValidElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as XLSX from "xlsx";
import * as fs from "node:fs";
import { cp4Header, cp4MatrixCsv, cp4SecondCsv, cp4ConflictCsv, cp4InvalidCsv } from "./cp4-fixtures";
import { parseDepotCsv } from "../app/depot-csv";
import { addDepotAccount, AdvisoryCase, caseSnapshot, createCase, deleteDepotAccount, duplicateStructurePlan, normalizeImportedCase, replaceDepotAccount, setCaseDepot } from "../app/case-model";
import { CASE_STORAGE_KEY, readCaseStore, writeCaseStore } from "../app/case-storage";
import { buildBondAnalysisData } from "../app/bond-analysis-data";
import { ExportCenter } from "../app/page";
import { classifyDepotProduct } from "../app/depot-analysis";

XLSX.set_fs(fs);

const csv = (s: string) => parseDepotCsv(new TextEncoder().encode(s).buffer).rows;
let groups = 0;
const test = (name: string, run: () => void) => { run(); groups++; console.log(`PASS CP4 ${name}`); };
const noop = () => {};
function sample() {
  let c = createCase();
  c.advisory.caseName = "cp4-synthetic";
  c = { ...c, ...addDepotAccount(c, csv(cp4MatrixCsv), "Synthetic A") };
  c = { ...c, ...addDepotAccount(c, csv(cp4SecondCsv), "Synthetic B") };
  return c;
}
const analysis = (c: AdvisoryCase, state: "ist" | "plan" = "ist") => buildBondAnalysisData(c.depot, c.plans[0], state, c.depotAccounts, new Date(2026, 0, 1)).analysis;
function button(node: ReactNode, label: string): (() => void) | undefined {
  if (Array.isArray(node)) return node.map((n) => button(n, label)).find(Boolean);
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return undefined;
  return node.type === "button" && renderToStaticMarkup(node).includes(label) ? node.props.onClick : button(node.props.children, label);
}
const view = (c: AdvisoryCase, setItem: (c: any) => void = noop) => ExportCenter({ item: c, preferredPlan: c.plans[0], setItem, saveCase: noop, exportJson: noop, importJson: noop });

test("explicit reverse-convertible and mixed-fund labels cannot become standard bonds", () => {
  for (const source of [
    { securityType: "Aktienanleihe" },
    { securityType: "Festverzinsliche", name: "Synthetische Aktienanleihe" },
    { securityType: "Festverzinsliche", investmentMedium: "Aktienanleihen" },
  ]) {
    const classification = classifyDepotProduct(source);
    assert.equal(classification.main, "Strukturierte Produkte");
    assert.equal(classification.direct, false);
    const row = csv(`${cp4Header}\n${source.name || "Synthetic"};SYN001;${source.securityType};${source.investmentMedium || ""};;EUR;5;01.01.2027;10000;100;10000;0;1;01.01.2026`)[0];
    let c = createCase();
    c = { ...c, ...addDepotAccount(c, [row], "Synthetic classification") };
    assert.equal(c.advisory.depotValue, 10000, "classification must retain physical market value");
    assert.equal(analysis(c).directCount, 0, "no standard YTM or fixed nominal repayment for reverse convertibles");
  }
  for (const source of [
    { securityType: "Festverzinsliche", investmentMedium: "Mischfonds" },
    { securityType: "Aktien", investmentMedium: "Mischfonds" },
    { securityType: "Fonds", segment: "Multi-Asset Bonds" },
  ]) {
    assert.equal(classifyDepotProduct(source).main, "Mischfonds / Multi-Asset");
    assert.equal(classifyDepotProduct(source).direct, false);
  }
});

test("two-depot CSV / selection / PLAN / storage / JSON / safe replacement / deletion", () => {
  let c = sample();
  assert.equal(c.depot.length, 180); assert.equal(c.advisory.depotValue, 1790000);
  const [a, b] = c.depotAccounts;
  const first = c.depot[0], other = c.depot.find((h) => h.depotId === b.id)!;
  assert.equal(first.wkn, other.wkn); assert.notEqual(first.id, other.id);
  c.plans[0].depotHoldingIds = [first.id, other.id];
  c = setCaseDepot(c, c.depot.map((h) => h.id === first.id ? { ...h, plannedSale: 2500, excludeFromBondAggregates: true } : h));
  const p = analysis(c, "plan");
  assert.equal(p.rows.find((r) => r.position.id === first.id)!.position.nominalOrUnits, 7500);
  assert.equal(p.rows.find((r) => r.position.id === other.id)!.position.nominalOrUnits, 10000);
  assert.equal(p.zeroValueCount, 1); assert.equal(c.advisory.depotValue, 1790000);
  assert.equal(p.portfolioDv01, null); assert.equal(p.ytmCoverage, null);
  assert.deepEqual(analysis(c).ladder.map((l) => [l.currency, l.year, l.nominal]), [["EUR", 2025, 7000], ["EUR", 2027, 1000000], ["USD", 2027, 10000]]);
  const copy = duplicateStructurePlan(c.plans[0], "CP4 plan copy");
  assert.notEqual(copy.id, c.plans[0].id); assert.deepEqual(copy.depotHoldingIds, c.plans[0].depotHoldingIds);
  c.plans.push(copy);
  const storage = new Map<string, string>();
  const adapter = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); }, key: (i: number) => [...storage.keys()][i] ?? null, get length() { return storage.size; } };
  c.advisory.depotValue = 1;
  writeCaseStore(adapter, [c]);
  c = readCaseStore(storage.get(CASE_STORAGE_KEY)!).cases[0];
  assert.equal(c.advisory.depotValue, 1790000); assert.equal(c.schemaVersion, 11);
  const imported = normalizeImportedCase(JSON.parse(JSON.stringify({ case: c })))!;
  assert.notEqual(imported.id, c.id); assert.deepEqual(imported.depot, c.depot);
  assert.equal(imported.plans.length, 2);
  const before = JSON.stringify(c);
  assert.throws(() => csv(cp4InvalidCsv)); assert.equal(JSON.stringify(c), before);
  c = { ...c, ...replaceDepotAccount(c, a.id, csv(cp4MatrixCsv)) };
  assert.equal(c.depot.find((h) => h.depotId === a.id && h.wkn === "T00000")!.plannedSale, 2500);
  assert.equal(c.depot.find((h) => h.depotId === a.id && h.wkn === "T00000")!.excludeFromBondAggregates, true);
  c = setCaseDepot(c, c.depot.map((h) => h.id === other.id ? { ...h, plannedSale: 5000, excludeFromBondAggregates: true } : h));
  c = { ...c, ...replaceDepotAccount(c, b.id, csv(cp4ConflictCsv)) };
  const conflict = c.depot.find((h) => h.depotId === b.id && h.wkn === "OTHER0")!;
  assert.equal(conflict.plannedSale, 0); assert.equal(conflict.excludeFromBondAggregates, false);
  for (const plan of c.plans) { assert.ok(!plan.depotHoldingIds.includes(other.id)); assert.ok(!plan.depotHoldingIds.includes(conflict.id)); }
  c = { ...c, ...deleteDepotAccount(c, b.id) };
  assert.equal(c.depot.length, 178); assert.equal(c.advisory.depotValue, 1780000);
  assert.equal(c.depot[0].excludeFromBondAggregates, true);
});

test("all old schema entry points, field provenance, immutable history and actual restore button", () => {
  const c = sample();
  for (const schemaVersion of [undefined, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const legacy: any = structuredClone(c);
    legacy.schemaVersion = schemaVersion;
    delete legacy.depotAccounts;
    delete legacy.depot[0].bondSource;
    delete legacy.depot[0].excludeFromBondAggregates;
    legacy.depot[0].legacyOptionalBondField = { retained: "synthetic" };
    legacy.versions = [];
    const snapshot = structuredClone(legacy);
    legacy.versions = [{ id: "old", label: "old", createdAt: c.createdAt, snapshot }];
    const raw = JSON.stringify(legacy);
    const migrated = normalizeImportedCase(legacy, false)!;
    assert.equal(migrated.schemaVersion, 11); assert.equal(migrated.depot.length, 180);
    assert.equal(migrated.advisory.depotValue, 1790000);
    assert.equal(migrated.depot[0].excludeFromBondAggregates, false);
    assert.deepEqual((migrated.depot[0] as any).legacyOptionalBondField, { retained: "synthetic" });
    assert.equal(analysis(migrated).rows[0].metrics.ytm.status, "legacy-unverified");
    assert.notEqual(analysis(migrated).rows[1].ytm, null, "verified neighboring field must survive migration");
    assert.equal(JSON.stringify(migrated.versions[0].snapshot), JSON.stringify(snapshot));
    assert.equal(JSON.stringify(legacy), raw);
  }
  const future = { ...c, schemaVersion: 12 };
  const futureRaw = JSON.stringify(future);
  assert.equal(normalizeImportedCase(future), null); assert.equal(JSON.stringify(future), futureRaw);
  c.depot[0].excludeFromBondAggregates = true;
  const old: any = caseSnapshot(c); old.schemaVersion = 10; old.advisory.depotValue = 1;
  c.versions = [{ id: "restore", label: "CP4 snapshot", createdAt: c.createdAt, snapshot: old }];
  const originalHistory = JSON.stringify(c.versions);
  let restored: AdvisoryCase | undefined;
  const previous = (globalThis as any).window;
  try {
    (globalThis as any).window = { confirm: () => true };
    button(view(c, (v) => { restored = v; }), "Wiederherstellen")!();
    assert.ok(restored); assert.equal(restored.schemaVersion, 11); assert.equal(restored.advisory.depotValue, 1790000);
    assert.equal(restored.depot[0].excludeFromBondAggregates, true);
    assert.equal(JSON.stringify(restored.versions), originalHistory);
    assert.equal(caseSnapshot(restored).schemaVersion, 11);
  } finally { (globalThis as any).window = previous; }
});

test("real 180-position XLSX, HTML, customer/internal print dispatch and injection strings", () => {
  let c = sample();
  const attacks = ['=1+1', '+SUM(1,1)', '-1+2', '@SUM(1,1)', '<img src=x onerror=alert(1)>'];
  c = setCaseDepot(c, c.depot.map((h, i) => i < attacks.length ? { ...h, name: attacks[i], note: attacks[(i + 1) % attacks.length], plannedSale: 10000, excludeFromBondAggregates: true } : h));
  const originalDir = process.cwd(), dir = mkdtempSync(join(tmpdir(), "vn-cp4-"));
  const previousWindow = (globalThis as any).window, previousDocument = (globalThis as any).document;
  try {
    process.chdir(dir);
    const rendered = view(c);
    const html = renderToStaticMarkup(rendered);
    writeFileSync("print.html", html);
    assert.match(html, /IST \(physischer Bestand\)/); assert.match(html, /CP4 Zero overdue/);
    assert.match(html, /CP4 Synthetic 099/); assert.match(html, /Synthetic A/); assert.match(html, /Synthetic B/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/); assert.doesNotMatch(html, /<img src=x/);
    button(rendered, "Excel-Arbeitsmappe")!();
    const wb = XLSX.read(readFileSync("cp4-synthetic.xlsx"), { type: "buffer" });
    const bond = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Zins & Laufzeiten"], { header: 1, defval: "" });
    assert.equal(bond[0][0], "Zins & Laufzeiten – IST (physischer Bestand)");
    assert.equal(bond.find((r) => r[0] === "Portfolio-DV01")![1], "nicht berechenbar");
    assert.ok(bond.some((r) => r.includes("CP4 Zero overdue")));
    assert.equal(bond.filter((r) => r[0] === "Synthetic A" || r[0] === "Synthetic B").length, 102);
    for (const attack of attacks) assert.ok(bond.some((r) => r.includes(attack)));
    const fall = XLSX.utils.sheet_to_json<any[]>(wb.Sheets.Fall, { header: 1 });
    assert.equal(fall.find((r) => r[0] === "Depotwert")![1], 1790000);
    for (const sheet of Object.values(wb.Sheets)) for (const cell of Object.values(sheet) as any[]) {
      assert.ok(!cell.f, "no imported name/note becomes an executable formula");
      if (attacks.includes(cell.v)) assert.equal(cell.t, "s");
    }
    const modes: string[] = [];
    const dataset: Record<string, string> = {};
    (globalThis as any).document = { body: { dataset } };
    (globalThis as any).window = { setTimeout: (f: () => void) => f(), print: () => { modes.push(dataset.printMode); } };
    button(rendered, "Kundenübersicht")!(); button(rendered, "Interne Arbeitsunterlage")!();
    assert.deepEqual(modes, ["customer", "internal"]); assert.equal(dataset.printMode, undefined);
  } finally {
    (globalThis as any).window = previousWindow; (globalThis as any).document = previousDocument;
    process.chdir(originalDir); rmSync(dir, { recursive: true });
  }
});

console.log(`CP4: ${groups} end-to-end regression groups passed; synthetic data only.`);
