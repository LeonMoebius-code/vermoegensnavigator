import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isValidElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as XLSX from "xlsx";
import * as fs from "node:fs";
import { parseDepotCsv } from "../app/depot-csv";
import { addDepotAccount, createCase, depotAssetAmounts, depotPlanAssetAmounts, normalizeImportedCase, plannerPlanHoldingValue } from "../app/case-model";
import { buildDepotAnalysisPositions, classifyDepotProduct } from "../app/depot-analysis";
import { houseProducts } from "../app/investment-data";
import { ExportCenter, WealthHouse } from "../app/page";

XLSX.set_fs(fs);

const known = houseProducts.find((p) => p.id === "urak-konservativ")!;
const header = "Bezeichnung;WKN;Anlagesegment;Anlagemedium;Wertpapiertyp;Zertifikateklasse;Kurswert incl. Stückzinsen";
const parse = (lines: string[]) => parseDepotCsv(new TextEncoder().encode([header, ...lines].join("\n")).buffer);
const unknownLines = [
  "Synthetic Mixed;SYN001;Aktien;Mischfonds;Fonds;;10000",
  "Synthetic Multi;SYN002;Aktien;Multi-Asset;Fonds;;10000",
  "Synthetic Reverse;SYN003;Aktien;;Aktienanleihe;;10000",
  "Synthetic Reverse Medium;SYN004;Aktien;Aktienanleihen;Festverzinsliche;;10000",
  "Synthetic Certificate;SYN005;Aktien;;Zertifikat;Aktienanleihe;10000",
  "Synthetic Aktienanleihe;SYN006;Renten;;Festverzinsliche;;10000",
];
const knownLine = `Synthetic Known;${known.wkn};Aktien;Mischfonds;Fonds;;10000`;
const imported = parse([...unknownLines, knownLine]);
let item = createCase();
item.advisory.caseName = "asset-classification-synthetic";
item = { ...item, ...addDepotAccount(item, imported.rows, "Synthetic") };
item.depot.forEach((h) => { h.plannedSale = 2000; });
const plan = item.plans[0];
plan.depotMode = "afterSales";
plan.total = 0;
plan.allocations = [];
const ist = depotAssetAmounts(item.depot);
const afterSales = depotPlanAssetAmounts(item.depot, plan);
const istHtml = renderToStaticMarkup(<WealthHouse depot={item.depot} plan={plan} context="depot" />);
const planHtml = renderToStaticMarkup(<WealthHouse depot={item.depot} plan={plan} />);
console.log("Synthetic economic outcomes:", JSON.stringify({ ist, afterSales }));

// Product kind, agree21 segment and economic exposure are separate facts.
assert.deepEqual(item.depot.map((h) => classifyDepotProduct(h).main), [
  "Mischfonds / Multi-Asset", "Mischfonds / Multi-Asset",
  "Strukturierte Produkte", "Strukturierte Produkte", "Strukturierte Produkte", "Strukturierte Produkte",
  "Mischfonds / Multi-Asset",
]);
assert.equal(item.advisory.depotValue, 70000);
assert.equal(ist.amounts.Substanzwerte, 3500, "only the documented 35% mix contributes equity; no guessed look-through");
assert.equal(ist.amounts.Geldwerte, 6500);
assert.equal(ist.unresolved, 60000);
assert.equal(ist.total, 70000);
assert.equal(imported.unresolved, 6);
for (const h of item.depot.slice(0, 6)) {
  assert.equal(h.classificationStatus, "unresolved");
  assert.equal(depotAssetAmounts([h]).unresolved, h.value);
  assert.equal(depotAssetAmounts([h]).amounts.Substanzwerte, 0);
}
assert.equal(item.depot[6].classificationStatus, "matched");
assert.equal(item.depot[6].productId, known.id);
assert.equal(item.depot[6].assetClass, "Geldwerte", "representative class follows known mix, not the broad source segment");
assert.equal(afterSales.amounts.Substanzwerte, 2800);
assert.equal(afterSales.amounts.Geldwerte, 5200);
assert.equal(afterSales.unresolved, 48000);
assert.equal(afterSales.total, 56000);
assert.deepEqual(depotAssetAmounts(item.depot, (h) => plannerPlanHoldingValue(plan, h)), afterSales);
for (const state of ["ist", "plan"] as const) {
  const positions = buildDepotAnalysisPositions(item.depot, plan, state);
  assert.equal(positions.length, 7);
  assert.ok(positions.every((p) => !p.classification.direct));
  assert.equal(positions.reduce((sum, p) => sum + p.value, 0), state === "ist" ? 70000 : 56000);
}
const euro = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
function pillar(html: string, label: string, amount: number) {
  const section = html.split(`aria-label="${label} öffnen"`)[1]?.split("</button>")[0];
  assert.ok(section?.includes(`<footer>${euro(amount)}</footer>`), `${label}: ${amount}`);
}
pillar(istHtml, "Substanzwerte", 3500);
pillar(istHtml, "Geldwerte", 6500);
pillar(planHtml, "Substanzwerte", 2800);
assert.ok(istHtml.includes(`${euro(60000)} noch ungeklärt`));
assert.ok(planHtml.includes(`${euro(48000)} noch ungeklärt`));
assert.ok(planHtml.includes(`<strong>${euro(56000)}</strong>`), "planner total retains unresolved physical holdings");
assert.ok(planHtml.split('class="unresolved-row"')[1]?.includes(euro(48000)), "planner table includes unresolved retained holdings");

// Existing unambiguous classes, WKN/product mappings and explicit Navigator assignments survive.
for (const [label, asset] of [["Aktien", "Substanzwerte"], ["Aktienfonds", "Substanzwerte"],
  ["Festverzinsliche", "Geldwerte"], ["Floater", "Geldwerte"], ["Stufenzinsanleihe", "Geldwerte"],
  ["Rentenfonds", "Geldwerte"], ["Geldmarkt", "Geldwerte"], ["Tagesgeld", "Liquidität"],
  ["Immobilienfonds", "Sachwerte"], ["Gold", "Alternative Anlagen"]]) {
  const row = parse([`Synthetic;CTRL01;${label};;${label};;1000`]).rows[0];
  const c = createCase();
  const holdings = addDepotAccount(c, [row], "Control").depot;
  assert.equal(row.assetClass, asset);
  assert.equal(depotAssetAmounts(holdings).amounts[asset as keyof typeof ist.amounts], 1000);
}
for (const product of houseProducts.filter((p) => p.assetMix)) {
  const row = parse([`Synthetic;${product.wkn};Aktien;;;;10000`]).rows[0];
  assert.equal(row.productId, product.id);
  const amounts = depotAssetAmounts(addDepotAccount(createCase(), [row], "Mix control").depot);
  for (const [asset, quota] of Object.entries(product.assetMix!))
    assert.equal(amounts.amounts[asset as keyof typeof amounts.amounts], quota * 100);
}
const navigator = parseDepotCsv(new TextEncoder().encode("Name;Wert;Anlageklasse\nSynthetic Mischfonds;1000;Sachwerte").buffer);
assert.equal(navigator.rows[0].assetClass, "Sachwerte");
assert.equal(navigator.rows[0].classificationStatus, "mapped");
assert.deepEqual(normalizeImportedCase(JSON.parse(JSON.stringify({ case: item })))!.depot, JSON.parse(JSON.stringify(item.depot)));
plan.depotMode = "retain";
plan.depotHoldingIds = [item.depot[0].id, item.depot[6].id];
const retained = depotAssetAmounts(item.depot, (h) => plannerPlanHoldingValue(plan, h));
assert.equal(retained.total, 20000);
assert.equal(retained.unresolved, 10000);
assert.equal(retained.amounts.Substanzwerte, 3500);
plan.depotMode = "afterSales";
plan.total = 10000;
plan.allocations = [{ id: "buy-known", productId: known.id, productName: known.name,
  bucketId: "year10plus", amount: 10000, solutionId: known.solutionId, source: "product" }];
const purchased = depotPlanAssetAmounts(item.depot, plan);
assert.equal(purchased.total, 66000);
assert.equal(purchased.unresolved, 48000);
assert.equal(purchased.amounts.Substanzwerte, 6300);
assert.equal(purchased.amounts.Geldwerte, 11700);

function button(node: ReactNode, label: string): (() => void) | undefined {
  if (Array.isArray(node)) return node.map((n) => button(n, label)).find(Boolean);
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return undefined;
  return node.type === "button" && renderToStaticMarkup(node).includes(label) ? node.props.onClick : button(node.props.children, label);
}
const originalDir = process.cwd(), dir = mkdtempSync(join(tmpdir(), "vn-classification-"));
try {
  process.chdir(dir);
  const noop = () => {};
  const view = ExportCenter({ item, preferredPlan: plan, setItem: noop, saveCase: noop, exportJson: noop, importJson: noop });
  button(view, "Excel-Arbeitsmappe")!();
  const wb = XLSX.read(readFileSync("asset-classification-synthetic.xlsx"), { type: "buffer" });
  const depot = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets.Depot);
  assert.equal(depot.length, 7);
  for (const row of depot.slice(0, 6)) {
    assert.equal(row.Anlageklasse, "Nicht durchgeschaut");
    assert.equal(row.Zuordnungsstatus, "unresolved");
    assert.equal(row.Wert, 10000);
  }
  assert.equal(depot[0].Anlagesegment, "Aktien");
  assert.equal(depot[0].Anlagemedium, "Mischfonds");
  assert.equal(depot[2].Wertpapiertyp, "Aktienanleihe");
  assert.equal(depot[6].Anlageklasse, "Geldwerte: 65,0 % · Substanzwerte: 35,0 %");
  assert.ok(!wb.Sheets["Zins & Laufzeiten"], "no fictitious standard bonds");
  // This export section has always described new allocations only, not retained holdings.
  const structure = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets["Vermögensstruktur"]);
  assert.equal(structure.find((r) => r.Anlageklasse === "Substanzwerte")!.Betrag, 3500);
  assert.equal(structure.find((r) => r.Anlageklasse === "Geldwerte")!.Betrag, 6500);
  assert.equal(structure.find((r) => r.Anlageklasse === "Nicht durchgeschaut")!.Betrag, 0);
  const printHtml = renderToStaticMarkup(view);
  assert.ok(printHtml.includes("Vermögensstruktur der bevorzugten Planung"));
  assert.ok(printHtml.includes(`<b>${euro(3500)}</b>`));
  assert.ok(printHtml.includes(`<b>${euro(6500)}</b>`));
} finally {
  process.chdir(originalDir);
  rmSync(dir, { recursive: true });
}
console.log("Economic classification: CSV → IST/PLAN house render, product analysis, known mixes, JSON and actual XLSX passed.");
