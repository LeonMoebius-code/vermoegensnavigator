import assert from "node:assert/strict";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as XLSX from "xlsx";
import { assetClasses, houseProducts } from "../app/investment-data";
import { buildIstWealthStructure, buildPlanWealthStructure, depotPlanAssetAmounts,
  getActiveStructurePlan, getPreferredStructurePlan, type StructurePlan } from "../app/case-model";
import { ExportCenter, WealthHouse } from "../app/page";
import { multiCase } from "./cp0a2-fixtures";

XLSX.set_fs(fs);
const euro = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const percent = (n: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n * 100);
const item = multiCase();
item.advisory.liquidAssets = 7000;
const known = houseProducts.find((p) => p.id === "urak-konservativ")!;
const active = item.plans[0];
active.total = 5000;
active.depotHoldingIds = [item.depot[0].id, item.depot[2].id];
active.allocations = [
  { ...active.allocations[0], id: "known-new", productId: known.id, productName: known.name, amount: 3000 },
  { ...active.allocations[0], id: "unknown-new", amount: 1000 },
];
const preferred = item.plans[1];
preferred.total = 100000;
preferred.allocations = [{ ...active.allocations[0], id: "preferred-new", amount: 80000 }];
preferred.investmentPlans = [{ id: "synthetic-savings", type: "savings", name: "Synthetischer Sparplan",
  productId: known.id, productName: known.name, contributionAmount: 120, frequency: "monthly",
  startDate: "2026-10-15", note: "" }];
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
freeze(item);
const before = JSON.stringify(item);
const ist = buildIstWealthStructure(item.depot, item.advisory.liquidAssets);
assert.deepEqual(ist, { amounts: { Liquidität: 7000, Geldwerte: 0, Substanzwerte: 16000,
  "Alternative Anlagen": 0, Sachwerte: 0 }, unresolved: 4000, total: 27000 });
for (const [mode, retainedKnown, retainedUnknown] of [
  ["none", 0, 0], ["compare", 0, 0], ["retain", 10000, 4000], ["afterSales", 7500, 4000],
] as const) {
  const plan = freeze({ ...active, depotMode: mode });
  const result = buildPlanWealthStructure(item.depot, plan);
  assert.deepEqual(result, { amounts: { Liquidität: 1000, Geldwerte: 1950,
    Substanzwerte: 1050 + retainedKnown, "Alternative Anlagen": 0, Sachwerte: 0 },
    unresolved: 1000 + retainedUnknown, total: 5000 + retainedKnown + retainedUnknown });
  assert.deepEqual(buildIstWealthStructure(item.depot, item.advisory.liquidAssets), ist, `IST independent of ${mode}`);
  assert.equal(result.total, Object.values(result.amounts).reduce((a, b) => a + b, 0) + result.unresolved);
  const sameSelection = { ...item, plans: [freeze({ ...plan, preferred: true })], activePlanId: plan.id };
  assert.deepEqual(buildPlanWealthStructure(item.depot, getActiveStructurePlan(sameSelection)),
    buildPlanWealthStructure(item.depot, getPreferredStructurePlan(sameSelection.plans)!), "identical PLAN/ZIELPLAN core");
  console.log(`PASS D1 mode ${mode}: full IST, mode-aware PLAN, same PLAN/ZIELPLAN core`);
}
assert.notDeepEqual(buildPlanWealthStructure(item.depot, getActiveStructurePlan(item)),
  buildPlanWealthStructure(item.depot, getPreferredStructurePlan(item.plans)!));
const target = buildPlanWealthStructure(item.depot, preferred);
assert.equal(target.amounts.Liquidität, 20000);
assert.equal(target.total, 110000);
const retainExample = buildPlanWealthStructure(item.depot, { ...active, depotMode: "retain",
  depotHoldingIds: [item.depot[0].id], allocations: [active.allocations[0]] });
assert.equal(retainExample.total, 15000);
assert.equal(retainExample.amounts.Liquidität, 2000);
assert.equal(buildPlanWealthStructure(item.depot, { ...active, total: 2000, depotMode: "none" }).total, 4000, "overallocated remainder clamps to zero");
assert.equal(buildPlanWealthStructure([], { ...active, total: 0, allocations: [] }).total, 0);
assert.equal(depotPlanAssetAmounts(item.depot, preferred).total, 91500, "separate physical after-sales context unchanged");

function find(node: ReactNode, predicate: (type: unknown, html: string) => boolean): ReactNode | undefined {
  if (Array.isArray(node)) return node.map((n) => find(n, predicate)).find((n) => n !== undefined);
  if (!isValidElement<{ children?: ReactNode }>(node)) return undefined;
  if (predicate(node.type, renderToStaticMarkup(node))) return node;
  return find(node.props.children, predicate);
}
function exportView(c: typeof item, p: StructurePlan | undefined) {
  return ExportCenter({ item: c, preferredPlan: p, setItem: () => {}, saveCase: () => {}, exportJson: () => {}, importJson: () => {} });
}
const cwd = process.cwd(), dir = fs.mkdtempSync(join(tmpdir(), "vn-d1-"));
try {
  process.chdir(dir);
  for (const mode of ["none", "compare", "retain", "afterSales"] as const) {
    const p = freeze({ ...preferred, depotMode: mode });
    const c = freeze({ ...item, plans: [active, p] });
    const expected = buildPlanWealthStructure(c.depot, p);
    const view = exportView(c, p);
    const button = find(view, (type, html) => type === "button" && html.includes("Excel-Arbeitsmappe"));
    assert.ok(isValidElement<{ onClick: () => void }>(button));
    button.props.onClick();
    const wb = XLSX.read(fs.readFileSync("cp0a2-synthetic.xlsx"), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<{ Anlageklasse: string; Betrag: number; Anteil: number }>(wb.Sheets.Vermögensstruktur);
    assert.equal(rows.length, assetClasses.length + 1);
    for (const name of [...assetClasses, "Nicht durchgeschaut"] as const) {
      const value = name === "Nicht durchgeschaut" ? expected.unresolved : expected.amounts[name];
      const row = rows.find((r) => r.Anlageklasse === name)!;
      assert.equal(row.Betrag, value, `${mode} XLSX ${name}`);
      assert.equal(row.Anteil, expected.total ? value / expected.total : 0, `${mode} full denominator`);
    }
    assert.equal(rows.reduce((sum, r) => sum + r.Betrag, 0), expected.total);
    assert.ok(Math.abs(rows.reduce((sum, r) => sum + r.Anteil, 0) - 1) < 1e-12);
    const print = find(view, (type, html) => type === "section" && html.includes("<h2>Vermögensstruktur der bevorzugten Planung</h2>"));
    const html = renderToStaticMarkup(print);
    for (const name of assetClasses) {
      assert.ok(html.includes(`<span>${name}</span><span>${euro(expected.amounts[name])}</span><b>${percent(expected.amounts[name] / expected.total)} %</b>`), `${mode} print ${name}`);
    }
    assert.ok(html.includes(`<span>Nicht durchgeschaut</span><span>${euro(expected.unresolved)}</span>`));
    const compact = renderToStaticMarkup(<WealthHouse plan={active} plans={c.plans} depot={c.depot} compact />);
    assert.ok(compact.includes(`<strong>${euro(expected.total)}</strong>`), `${mode} compact result uses preferred`);
    const activeHtml = renderToStaticMarkup(<WealthHouse plan={active} plans={c.plans} depot={c.depot} />);
    assert.ok(activeHtml.includes(`<strong>${euro(buildPlanWealthStructure(c.depot, active).total)}</strong>`));
    const products = XLSX.utils.sheet_to_json<{ Produkt_ID: string; Betrag: number }>(wb.Sheets[p.name.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, "-").replace(/-+/g, "-").slice(0, 31)]);
    assert.equal(products.length, p.allocations.length, "no retained holding fabricated as new purchase");
    assert.equal(products[0].Produkt_ID, p.allocations[0].productId);
    assert.equal(products[0].Betrag, 80000);
    const implementation = XLSX.utils.sheet_to_json<{ Plan: string; Art: string; Sparrate: number }>(wb.Sheets.Investitionspläne);
    assert.equal(implementation.length, 1);
    assert.equal(implementation[0].Plan, p.name);
    assert.equal(implementation[0].Art, "Sparplan");
    assert.equal(implementation[0].Sparrate, 120);
    const overview = renderToStaticMarkup(find(view, (type, h) => type === "section" && h.includes("<h2>Umsetzungsübersicht</h2>")));
    assert.ok(overview.includes("Synthetischer Sparplan"));
    assert.ok(overview.includes(euro(120)));
    assert.ok(!overview.includes(item.depot[0].name));
    const solutions = renderToStaticMarkup(find(view, (type, h) => type === "section" && h.includes("<h2>Lösungsbausteine der bevorzugten Planung</h2>")));
    assert.ok(solutions.includes(p.allocations[0].productName));
    assert.ok(!solutions.includes(item.depot[0].name));
    console.log(`PASS D1 export ${mode}: actual XLSX amounts/shares, shared print section, compact result, new products separate`);
  }
  const historical = multiCase();
  const expected = buildPlanWealthStructure(historical.depot, historical.plans[1]);
  assert.equal(expected.total, 10000);
  const view = exportView(historical, historical.plans[1]);
  const button = find(view, (type, html) => type === "button" && html.includes("Excel-Arbeitsmappe"));
  assert.ok(isValidElement<{ onClick: () => void }>(button)); button.props.onClick();
  const wb = XLSX.read(fs.readFileSync("cp0a2-synthetic.xlsx"), { type: "buffer" });
  assert.equal(XLSX.utils.sheet_to_json<{ Betrag: number }>(wb.Sheets.Vermögensstruktur).reduce((sum, r) => sum + r.Betrag, 0), 10000);
  console.log("PASS D1 general-export-scope: multiCase target/export exactly 10000, not 0 or 11500");
} finally { process.chdir(cwd); fs.rmSync(dir, { recursive: true }); }
const noPreferred = { ...item, plans: item.plans.map((p) => ({ ...p, preferred: false })) };
assert.equal(getPreferredStructurePlan(noPreferred.plans), undefined);
const noPreferredPlan = renderToStaticMarkup(<WealthHouse plan={active} plans={noPreferred.plans} depot={item.depot} />);
assert.ok(noPreferredPlan.includes(`<strong>${euro(buildPlanWealthStructure(item.depot, active).total)}</strong>`), "PLAN remains usable without preferred");
const noTarget = renderToStaticMarkup(<WealthHouse plan={active} plans={noPreferred.plans} depot={item.depot} compact />);
assert.ok(noTarget.includes("Keine bevorzugte Zielvariante"));
const noExport = renderToStaticMarkup(exportView(noPreferred, undefined));
assert.ok(!noExport.includes('class="print-document"'));
assert.equal((noExport.match(/<button disabled=""/g) || []).length, 3);
assert.equal(JSON.stringify(item), before, "frozen case/plans/holdings/allocations unchanged through projections, UI and export");
console.log("D1 view contract: all synthetic domain/UI/XLSX/print checks passed; no preferred fallback; no mutation; schema unchanged.");
