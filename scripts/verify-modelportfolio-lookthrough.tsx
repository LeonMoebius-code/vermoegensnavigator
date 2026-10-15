import assert from "node:assert/strict";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as XLSX from "xlsx";
import { assetClasses, modelPortfolios } from "../app/investment-data";
import { buildIstWealthStructure, buildPlanWealthStructure, normalizeImportedCase, caseSnapshot } from "../app/case-model";
import { readCaseStore, writeCaseStore, CASE_STORAGE_KEY } from "../app/case-storage";
import { ModelPortfolioMinimumNotice } from "../app/presentation/model-portfolio-amount";
import { ExportCenter, WealthHouse } from "../app/page";
import { multiCase } from "./cp0a2-fixtures";
import { modelAllocation, modelPortfolioCase } from "./modelportfolio-fixtures";

XLSX.set_fs(fs);
const euro = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const item = modelPortfolioCase(), model = modelPortfolios[1], plan = item.plans[0];
plan.allocations = model.holdings.map((h, i) => ({ ...modelAllocation(`rb3-${i}`, h.productId, h.name, 1600 * h.weight), source: "model", modelId: model.id }));
const expected = { Liquidität: 0, Geldwerte: 72000, Substanzwerte: 64000, "Alternative Anlagen": 24000, Sachwerte: 0 };
assert.deepEqual(buildPlanWealthStructure([], plan), { amounts: expected, total: 160000, unresolved: 0 });
assert.deepEqual(buildIstWealthStructure([], 160000), { amounts: { ...expected, Liquidität: 160000, Geldwerte: 0, Substanzwerte: 0, "Alternative Anlagen": 0 }, total: 160000, unresolved: 0 });
const unknownDepot = multiCase().depot[2];
for (const mode of ["none", "compare", "retain", "afterSales"] as const) {
  const selected = { ...plan, depotMode: mode, depotHoldingIds: [unknownDepot.id] };
  const result = buildPlanWealthStructure([unknownDepot], selected);
  const retained = mode === "retain" || mode === "afterSales" ? unknownDepot.value : 0;
  assert.deepEqual(result.amounts, expected);
  assert.equal(result.unresolved, retained);
  assert.equal(result.total, 160000 + retained);
  const withUnknown = buildPlanWealthStructure([], { ...selected, allocations: [...selected.allocations,
    modelAllocation("unknown", "still-unknown", "Ungeklärtes Produkt", 1234)] });
  assert.deepEqual(withUnknown.amounts, expected);
  assert.equal(withUnknown.unresolved, 1234);
  assert.equal(withUnknown.total, 161234, "no artificial normalization");
}
const html = renderToStaticMarkup(<WealthHouse plan={plan} depot={[]} />);
for (const asset of assetClasses) {
  const pillar = html.split(`aria-label="${asset} öffnen"`)[1]?.split("</button>")[0];
  assert.ok(pillar?.includes(`<footer>${euro(expected[asset])}</footer>`), asset);
}
assert.ok(!html.includes("noch ungeklärt"));
for (const portfolio of modelPortfolios) {
  for (const [amount, shortfall] of [[160000, 45000], [250000, 0], [300000, 0]]) {
    const notice = renderToStaticMarkup(<ModelPortfolioMinimumNotice model={portfolio} amount={amount} />);
    assert.ok(notice.includes(euro(125000)));
    assert.equal(notice.includes('role="status"'), shortfall > 0);
    assert.ok(notice.includes(shortfall ? euro(shortfall) : "Mindestanlage erfüllt"));
  }
}
const snapshot = caseSnapshot(item);
item.versions = [{ id: "model-history", label: "Vor Prüfung", createdAt: item.createdAt, snapshot }];
const storage = new Map<string, string>();
const adapter = { getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); }, key: (i: number) => [...storage.keys()][i] ?? null,
  get length() { return storage.size; } };
writeCaseStore(adapter, [item]);
const saved = readCaseStore(storage.get(CASE_STORAGE_KEY)!).cases[0];
const imported = normalizeImportedCase(JSON.parse(JSON.stringify({ case: saved })))!;
assert.equal(imported.schemaVersion, 11);
assert.deepEqual(imported.plans, item.plans);
assert.deepEqual(imported.versions, item.versions);
assert.deepEqual(buildPlanWealthStructure(imported.depot, imported.plans[0]).amounts, expected);
function button(node: ReactNode): (() => void) | undefined {
  if (Array.isArray(node)) return node.map(button).find(Boolean);
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return undefined;
  return node.type === "button" && renderToStaticMarkup(node).includes("Excel-Arbeitsmappe") ? node.props.onClick : button(node.props.children);
}
const cwd = process.cwd(), dir = fs.mkdtempSync(join(tmpdir(), "vn-model-lookthrough-"));
try {
  process.chdir(dir);
  const view = ExportCenter({ item, preferredPlan: plan, setItem: () => {}, saveCase: () => {}, exportJson: () => {}, importJson: () => {} });
  button(view)!();
  const file = fs.readdirSync(dir).find(f => f.endsWith(".xlsx"))!;
  const workbook = XLSX.read(fs.readFileSync(file), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<{ Anlageklasse: string; Betrag: number; Anteil: number }>(workbook.Sheets.Vermögensstruktur);
  for (const asset of assetClasses) assert.deepEqual(rows.find(r => r.Anlageklasse === asset), {
    Anlageklasse: asset, Betrag: expected[asset], Anteil: expected[asset] / 160000,
  });
  assert.equal(rows.find(r => r.Anlageklasse === "Nicht durchgeschaut")!.Betrag, 0);
  assert.equal(rows.reduce((sum, r) => sum + r.Betrag, 0), 160000);
  const print = renderToStaticMarkup(view);
  for (const amount of [72000, 64000, 24000]) assert.ok(print.includes(`<b>${euro(amount)}</b>`));
} finally { process.chdir(cwd); fs.rmSync(dir, { recursive: true }); }
console.log("PASS Modellportfolio-Durchschau: RB3 160k, alle Depotmodi, unbekannte Produkte/Positionen, Mindestanlage, Haus, echtes XLSX, Druck, Schema11, JSON, Historie und Fallpersistenz");
