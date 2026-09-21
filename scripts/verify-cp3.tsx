import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement, isValidElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as XLSX from "xlsx";
import { parseDepotCsv } from "../app/depot-csv";
import { structureOverviewSource } from "../app/bond-source";
import { BondSourceConvention } from "../app/bond-v2";
import { buildBondAnalysisData, buildBondIstExportData } from "../app/bond-analysis-data";
import { BondAnalysisView } from "../app/bond-analysis-view";
import { buildDepotAnalysisPositions, bondPortfolioAnalysis, productTypeAnalysis } from "../app/depot-analysis";
import { addDepotAccount, AdvisoryCase, caseSnapshot, createCase, deleteDepotAccount, DepotHolding, normalizeImportedCase, renameDepotAccount, replaceDepotAccount, setCaseDepot } from "../app/case-model";
import { CASE_STORAGE_KEY, readCaseStore, writeCaseStore } from "../app/case-storage";
import { ExportCenter } from "../app/page";

let count = 0;
const test = (label: string, run: () => void) => { run(); count++; console.log(`PASS CP3 ${label}`); };
const close = (actual: number | null | undefined, expected: number, tolerance = 1e-8) => assert.ok(actual !== null && actual !== undefined && Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const header = "Bezeichnung;Wertpapiertyp;Anlagemedium;Anlagesegment;Währung;Zinssatz;Endfälligkeit;Stück/Nominal;Kurs;Kurswert incl. Stückzinsen;Stückzinsen;Devisenkurs;Bewertungsende";
const csv = (rows: string[]): DepotHolding[] => parseDepotCsv(new TextEncoder().encode([header, ...rows].join("\n")).buffer).rows.map((h) => ({ ...h, depotId: "synthetic" }));
// This is the explicit contract of THIS synthetic generator, not evidence about
// the bank's structure overview. Production never passes this convention.
const synthetic: BondSourceConvention = {
  evidence: "Synthetischer CP3-Quellenvertrag: scripts/verify-cp3.tsx; Prozent-Clean, Face Value in Bondwährung, absolute AI in Bondwährung, Dirty-Gesamtwert EUR, FX EUR je Bondwährung; AI-Quantisierung 0,0001 pro100.",
  units: { clean: "percent-of-par", nominal: "face-in-bond-currency", accrued: "absolute", accruedCurrency: "bond", market: "dirty-absolute", reportingCurrency: "EUR", fx: "reporting-per-bond" },
  accruedQuantizationPer100: .0001,
};
const contract = () => synthetic;
function holding(extra: Partial<DepotHolding> = {}): DepotHolding {
  const raw = csv(["Synthetic;Festverzinsliche;;;EUR;5;01.01.2027;10000;100;10000;;1;01.01.2026"])[0];
  const h = { ...raw, ...extra };
  return { ...h, bondSource: structureOverviewSource(h) };
}
const plan = createCase().plans[0];
const now = new Date(2026, 0, 1);
const data = (depot: DepotHolding[], state: "ist" | "plan" = "ist", conventions: Parameters<typeof bondPortfolioAnalysis>[2] = contract) => buildBondAnalysisData(depot, plan, state, [], now, conventions);
const analyze = (depot: DepotHolding[], state: "ist" | "plan" = "ist") => data(depot, state).analysis;
// Missing AI deliberately exercises the disclosed annual assumption with the same independent one-year constants.
// AI=0 at a shared coupon date is now ambiguous and is covered by test:bond-final.
const matrix = () => csv(Array.from({ length: 178 }, (_, i) => `Synthetic ${i};${i >= 100 ? "Aktien" : i >= 80 && i < 90 ? "Floater" : "Festverzinsliche"};;;EUR;${i >= 90 && i < 100 ? "n/a" : i >= 80 && i < 90 ? 4 : 5};01.01.2027;10000;100;10000;;1;01.01.2026`));

test("178 CSV positions: independent full portfolio constants and exclusions", () => {
  const depot = matrix(), a = analyze(depot);
  close(depot.reduce((s, h) => s + h.value, 0), 1780000); close(a.directValueEUR, 1000000);
  close(a.averageModeledYtm, .05); close(a.ytmCoverage, .8); close(a.averageCurrentYield, .04888888888888889); close(a.currentYieldCoverage, .9);
  close(a.portfolioModified, .9523809523809524); close(a.portfolioDv01, 76.19047619047619);
  close(a.scenarios[0].effect, 7619.047619047619); close(a.scenarios[3].effect, -7619.047619047619);
  assert.equal(a.coverages.ytm.includedAndCalculable.count, 80); assert.equal(a.coverages.ytm.notCalculable.count, 20);
  close(a.maturityCoverage, 1); close(a.ladderCoverage, 1); close(a.ladder[0].nominal, 1000000);
  const excluded = depot.map((h, i) => ({ ...h, excludeFromBondAggregates: i < 5 }));
  const b = analyze(excluded);
  close(b.ytmCoverage, .75); close(b.currentYieldCoverage, .85); close(b.portfolioDv01, 71.42857142857143); close(b.averageModeledYtm, .05);
  close(b.directValue, 1000000); close(b.ladder[0].nominal, 1000000); close(b.ladder[0].excludedNominal, 50000); close(b.ladder[0].excludedMarketValue, 50000);
  close(b.rows[0].ytm, .05); assert.equal(b.rows[0].metrics.ytm.status, "calculable"); assert.equal(b.inclusion(b.rows[0], "ytm"), "manuallyExcluded");
  assert.deepEqual(productTypeAnalysis(buildDepotAnalysisPositions(depot, plan, "ist")), productTypeAnalysis(buildDepotAnalysisPositions(excluded, plan, "ist")));
  // Independent one-payment repricing, not a production pricing helper.
  const pv = (y: number) => 840000 / (1 + y);
  close((pv(.0499) - pv(.0501)) / 2, a.portfolioDv01!, .00001);
  const production = buildBondIstExportData(depot, plan, [], now).analysis;
  assert.equal(production.rows.filter((r) => r.ytm !== null).length, 80);
  for (const c of Object.values(production.coverages)) assert.equal(c.value, null);
  assert.equal(production.maturityCoverage, null); assert.equal(production.ladderCoverage, null);
  assert.equal(production.portfolioDv01, null); assert.equal(production.averageModeledYtm, null); assert.equal(production.averageCurrentYield, null);
  assert.ok(production.scenarios.every((s) => s.effect === null)); close(production.directValue, 1000000);
});

test("disjoint 70/20/10 coverage, excluded incomplete data and independent metrics", () => {
  const a = analyze([holding({ value: 70000, nominalOrUnits: 70000 }), holding({ value: 20000, nominalOrUnits: 20000, coupon: undefined, excludeFromBondAggregates: true }), holding({ coupon: undefined })]);
  close(a.ytmCoverage, .7); close(a.averageModeledYtm, .05);
  assert.deepEqual(a.coverages.ytm.manuallyExcluded, { count: 1, valueEUR: 20000 });
  assert.deepEqual(a.coverages.ytm.notCalculable, { count: 1, valueEUR: 10000 });
  close(a.coverages.ytm.includedAndCalculable.valueEUR, 70000);
  close(a.ladderCoverage, 1);
  const b = analyze([holding({ maturity: undefined }), holding({ nominalOrUnits: undefined }), holding({ currency: undefined }), holding({ securityType: "Floater" })]);
  close(b.currentYieldCoverage, 1); close(b.ytmCoverage, 0); close(b.averageCurrentYield, .05);
  close(b.maturityCoverage, .75); close(b.ladderCoverage, .25); assert.equal(b.ladder.length, 1);
  assert.equal(b.portfolioModified, null); assert.equal(b.portfolioDv01, null);
  const empty = analyze([]); assert.equal(empty.coverages.ytm.status, "not-applicable"); assert.equal(empty.ytmCoverage, null);
  const invalid = analyze([holding({ coupon: undefined })]); close(invalid.ytmCoverage, 0); assert.equal(invalid.portfolioDv01, null);
  assert.ok(invalid.scenarios.every((s) => s.effect === null));
  const zeroCoupon = analyze([holding({ coupon: 0 })]); close(zeroCoupon.averageCurrentYield, 0); close(zeroCoupon.currentYieldCoverage, 1); close(zeroCoupon.averageModeledYtm, 0);
});

test("PLAN 25/50/100 percent: scaled nominal, absolute AI and DV01; immutable IST", () => {
  // Two percent accrued is consistent with ACT/365F at 146 elapsed days.
  const h = holding({ value: 20000, nominalOrUnits: 20000, accruedInterest: 400, currentPrice: 98, valuationEnd: "2026-05-27" });
  const before = JSON.stringify(h), ist = analyze([h]).rows[0];
  assert.notEqual(ist.ytm, null);
  for (const [sale, nominal, ai, ratio] of [[5000,15000,300,.75], [10000,10000,200,.5]] as const) {
    const r = analyze([{ ...h, plannedSale: sale }], "plan").rows[0];
    close(r.position.nominalOrUnits, nominal); close(r.position.accruedInterest, ai); close(r.position.value, nominal);
    close(r.metrics.dirtyPrice.value, 100); close(r.ytm, ist.ytm!); close(r.modified, ist.modified!); close(r.dv01, ist.dv01! * ratio);
    close(analyze([{ ...h, plannedSale: sale }], "plan").ladder[0].nominal, nominal);
  }
  assert.equal(JSON.stringify(h), before);
  for (const sale of [20000, 30000]) { const a = analyze([{ ...h, plannedSale: sale }], "plan"); assert.equal(a.directCount, 0); assert.equal(a.ytmCoverage, null); assert.equal(a.ladder.length, 0); }
  close(analyze([{ ...h, plannedSale: -100 }], "plan").rows[0].position.value, 20000);
  const special = analyze([holding({ securityType: "Callable Anleihe", plannedSale: 5000 })], "plan");
  assert.equal(special.rows[0].position.nominalOrUnits, undefined); assert.equal(special.rows[0].position.quantityScale, null); assert.equal(special.ladder.length, 0);
  assert.equal(special.rows[0].dv01, null);
  for (const depotMode of ["none", "compare", "retain", "afterSales"] as const) {
    const a = buildBondAnalysisData([{ ...h, plannedSale: 5000 }], { ...plan, depotMode }, "plan", [], now, contract);
    close(a.analysis.ladder[0].nominal, 15000);
  }
});

test("zero market values, overdue holdings, currencies and excluded ladder remain physical", () => {
  const depot = [holding({ id: "eur", value: 50000, nominalOrUnits: 50000 }),
    holding({ id: "usd", value: 45000, nominalOrUnits: 50000, currency: "USD", fxRate: .9, excludeFromBondAggregates: true }),
    holding({ id: "zero", value: 0, nominalOrUnits: 7000, currentPrice: 0, maturity: "2025-01-01" })];
  for (const state of ["ist", "plan"] as const) {
    const a = analyze(depot, state);
    assert.equal(a.directCount, 3); assert.equal(a.zeroValueCount, 1); close(a.directValue, 95000);
    assert.deepEqual(a.ladder.map((l) => [l.currency, l.year, l.nominal]), [["EUR", 2025, 7000], ["EUR", 2027, 50000], ["USD", 2027, 50000]]);
    assert.equal(a.ladder[0].overdue, true); close(a.ladder[0].zeroValueNominal, 7000); close(a.ladder[2].excludedNominal, 50000);
    close(a.ladderCoverage, 1); close(a.ytmCoverage, 50000 / 95000);
    assert.equal(a.rows[2].ytm, null);
  }
  const zero = analyze([depot[2]], "plan"); assert.equal(zero.ytmCoverage, null); assert.equal(zero.portfolioDv01, null); assert.equal(zero.directCount, 1);
  assert.equal(buildDepotAnalysisPositions([depot[2]], plan, "ist").length, 0, "general depot distributions retain previous zero filtering");
  const usd = analyze([{ ...depot[1], excludeFromBondAggregates: false }]);
  close(usd.rows[0].dv01, 4.761904761904762); close(usd.portfolioDv01, 4.285714285714286);
  assert.equal(usd.rows[0].metrics.dv01Currency, "USD");
});

test("known EUR subset, unknown denominator, dates, purchase gaps and metamorphic splits", () => {
  const a = holding({ id: "known" }), unknown = holding({ id: "unknown" });
  const partial = data([a, unknown], "ist", (p) => p.id === "known" ? synthetic : undefined).analysis;
  close(partial.averageModeledYtm, .05); close(partial.portfolioDv01, .9523809523809524); close(partial.knownValueEUR, 10000);
  assert.equal(partial.ytmCoverage, null); assert.equal(partial.coverages.ytm.notCalculable.valueEUR, null);
  assert.equal(partial.unknownReportingCount, 1);
  const full = analyze([holding({ value: 20000, nominalOrUnits: 20000 })]);
  const split = analyze([holding(), holding()]); close(split.averageModeledYtm, full.averageModeledYtm!); close(split.portfolioDv01, full.portfolioDv01!);
  const withBad = analyze([holding(), holding({ coupon: undefined })]); close(withBad.ytmValue, 10000); close(withBad.ytmCoverage, .5); close(withBad.averageModeledYtm, .05);
  const dates = analyze([a, holding({ valuationEnd: "2025-12-31" })]); assert.equal(dates.mixedValuationDates, true); assert.deepEqual(dates.valuationDates, ["2025-12-31", "2026-01-01"]);
  const missingDate = analyze([holding({ valuationEnd: undefined })]); assert.equal(missingDate.rows[0].ytm, null); assert.ok(missingDate.rows[0].metrics.warnings.some((w) => w.includes("Fallback")));
  const purchase = { ...buildDepotAnalysisPositions([a], plan, "ist")[0], id: "purchase", source: "planned-purchase" as const, bondSource: undefined, nominalOrUnits: undefined, coupon: undefined, maturity: undefined, valuationEnd: undefined };
  const p = bondPortfolioAnalysis([purchase], now, contract); assert.equal(p.rows[0].ytm, null); assert.equal(p.ladder.length, 0);
  // Evidence drift cannot be laundered by the synthetic convention.
  const drift = analyze([{ ...a, value: 5000 }]); assert.equal(drift.directValueEUR, null); assert.equal(drift.portfolioDv01, null);
});

test("holding-specific exclusion, save/load JSON snapshot, rename replace delete", () => {
  let item = createCase(); item = { ...item, ...addDepotAccount(item, [holding({ id: "a", wkn: "SYN001", excludeFromBondAggregates: true, plannedSale: 2500 })], "Depot A") };
  item = { ...item, ...addDepotAccount(item, [holding({ id: "b", wkn: "SYN001" })], "Depot B") };
  const values = new Map<string, string>(); const storage = { get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null, getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
  writeCaseStore(storage, [item]);
  for (const loaded of [readCaseStore(storage.getItem(CASE_STORAGE_KEY)).cases[0], normalizeImportedCase(JSON.parse(JSON.stringify(item)))!, normalizeImportedCase(caseSnapshot(item), false)!]) {
    assert.equal(loaded.depot[0].excludeFromBondAggregates, true); assert.equal(loaded.depot[1].excludeFromBondAggregates, false);
    close(analyze(loaded.depot).ytmCoverage, .5); close(analyze(loaded.depot, "plan").ytmCoverage, 10000 / 17500);
    assert.deepEqual(buildBondIstExportData(loaded.depot, loaded.plans[0], loaded.depotAccounts, now).exportRows, buildBondIstExportData(item.depot, item.plans[0], item.depotAccounts, now).exportRows);
  }
  assert.doesNotMatch(JSON.stringify(caseSnapshot(item)), /"(bondBase|quantityScale|ytm|modified|dv01)":/);
  const id = item.depotAccounts[0].id;
  const renamed = { ...item, depotAccounts: renameDepotAccount(item.depotAccounts, id, "Neu") }; assert.equal(renamed.depot[0].excludeFromBondAggregates, true);
  const same = replaceDepotAccount(item, id, [holding({ id: "next", wkn: "SYN001", coupon: 6 })]);
  const replaced = same.depot.find((h) => h.depotId === id)!;
  assert.equal(replaced.excludeFromBondAggregates, true); close(replaced.plannedSale, 2500); assert.equal(replaced.bondSource!.fields.coupon.value, 6);
  item.plans[0].depotHoldingIds = ["a", "b"];
  const other = replaceDepotAccount(item, id, [holding({ id: "a", wkn: "OTHER1" })]);
  assert.equal(other.depot.find((h) => h.depotId === id)!.excludeFromBondAggregates, false);
  assert.equal(other.depot.find((h) => h.depotId === id)!.plannedSale, 0); assert.deepEqual(other.plans[0].depotHoldingIds, ["b"]);
  assert.equal(other.depot.find((h) => h.id === "b")!.excludeFromBondAggregates, false);
  const ambiguous = replaceDepotAccount(item, id, [holding({ id: "c", wkn: "SYN001" }), holding({ id: "d", wkn: "SYN001" })]);
  assert.ok(ambiguous.depot.filter((h) => h.depotId === id).every((h) => h.excludeFromBondAggregates === false && h.plannedSale === 0));
  assert.equal(deleteDepotAccount(item, id).depot.length, 1);
  close(item.advisory.depotValue, 20000);
});

test("all excluded, foreign reporting subset and numerical overflow are not false zeros", () => {
  const all = analyze([holding({ excludeFromBondAggregates: true })]);
  for (const coverage of Object.values(all.coverages)) { close(coverage.value, 0); assert.equal(coverage.manuallyExcluded.count, 1); assert.equal(coverage.notCalculable.count, 0); }
  assert.equal(all.portfolioDv01, null); assert.equal(all.averageModeledYtm, null); close(all.ladderCoverage, 1); close(all.rows[0].ytm, .05);
  const usd = data([holding({ currency: "USD" })], "ist", () => ({ ...synthetic, units: { ...synthetic.units, reportingCurrency: "USD" } })).analysis;
  assert.deepEqual(usd.reportingAmounts, [{ currency: "USD", value: 10000, count: 1 }]);
  assert.equal(usd.portfolioDv01, null); assert.equal(usd.ytmCoverage, null); close(usd.rows[0].dv01, .9523809523809524);
  const huge = analyze([holding({ value: 1e308, nominalOrUnits: 1e308 }), holding({ value: 1e308, nominalOrUnits: 1e308 })]);
  assert.equal(huge.directValueEUR, null); assert.equal(huge.coverages.currentYield.status, "invalid-value-basis");
  assert.equal(huge.currentYieldCoverage, null); assert.equal(huge.currentYieldValue, null); assert.equal(huge.averageCurrentYield, null);
  assert.equal(huge.knownValueEUR, null); assert.equal(huge.ladder[0].nominal, null); assert.equal(huge.reportingAmounts[0].value, null);
});

function findInput(node: ReactNode): ((event: { target: { checked: boolean } }) => void) | undefined {
  if (Array.isArray(node)) return node.map(findInput).find(Boolean);
  if (!isValidElement<{ children?: ReactNode; type?: string; onChange?: (e: { target: { checked: boolean } }) => void }>(node)) return undefined;
  if (node.type === "input" && node.props.type === "checkbox") return node.props.onChange;
  return findInput(node.props.children);
}
test("rendered UI ordering, single overview duration, checkbox event and model reasons", () => {
  let depot = [holding({ id: "ui" }), holding({ coupon: undefined })];
  const view = BondAnalysisView({ data: data(depot), onInclusionChange: (id, included) => { depot = depot.map((h) => h.id === id ? { ...h, excludeFromBondAggregates: !included } : h); } });
  const html = renderToStaticMarkup(view);
  assert.ok(html.indexOf("Zinsszenarien") < html.indexOf("Fälligkeitsleiter nach")); assert.ok(html.indexOf("Fälligkeitsleiter nach") < html.indexOf("Direkte Rentenpositionen"));
  assert.equal((html.match(/<span>Modified Duration<\/span>/g) || []).length, 1);
  assert.match(html, /Kupon fehlt oder ist ungültig/); assert.match(html, /halbjährliche und vierteljährliche Kuponkalender/); assert.match(html, /type="checkbox" checked=""/);
  findInput(view)!({ target: { checked: false } }); assert.equal(depot[0].excludeFromBondAggregates, true); close(analyze(depot).ytmCoverage, 0); close(analyze(depot).rows[0].ytm, .05);
});

const noop = () => {};
function findButton(node: ReactNode): (() => void) | undefined {
  if (Array.isArray(node)) return node.map(findButton).find(Boolean);
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return undefined;
  return node.type === "button" && renderToStaticMarkup(node).includes("Excel") ? node.props.onClick : findButton(node.props.children);
}
test("actual IST workbook and print HTML include zero values, currencies, reasons, exclusion", () => {
  let item: AdvisoryCase = createCase();
  item.advisory.caseName = "cp3-synthetic";
  item = { ...item, ...addDepotAccount(item, [holding({ name: "=1+1", id: "export", value: 0, currentPrice: 0, currency: "USD", excludeFromBondAggregates: true })], "Synthetic USD") };
  const originalDir = process.cwd(), dir = mkdtempSync(join(tmpdir(), "vn-cp3-"));
  try {
    process.chdir(dir);
    for (const allZero of [true, false]) {
      if (!allZero) item = setCaseDepot(item, [...item.depot, { ...holding({ id: "sale", name: "IST trotz Vollverkauf", plannedSale: 10000 }), depotId: item.depotAccounts[0].id }]);
      const view = ExportCenter({ item, preferredPlan: item.plans[0], setItem: noop, saveCase: noop, exportJson: noop, importJson: noop });
      const html = renderToStaticMarkup(view);
      assert.match(html, /IST \(physischer Bestand\)/); assert.match(html, /Nicht in aggregierten Rentenkennzahlen/); assert.match(html, /USD/); assert.match(html, /EUR-Abdeckung nicht ermittelbar/);
      assert.match(html, /Marktwert 0/); assert.match(html, /Modified Duration/); assert.match(html, /Zinsszenarien/); assert.match(html, /Fälligkeitsleiter/);
      if (!allZero) assert.match(html, /IST trotz Vollverkauf/);
      findButton(view)!();
      const workbook = XLSX.read(readFileSync("cp3-synthetic.xlsx"), { type: "buffer" });
      const sheet = workbook.Sheets["Zins & Laufzeiten"]; assert.ok(sheet);
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
      assert.equal(rows[0][0], "Zins & Laufzeiten – IST (physischer Bestand)");
      assert.equal(rows.find((r) => r[0] === "Portfolio-DV01")![1], "nicht berechenbar");
      assert.ok(rows.some((r) => r.includes("=1+1") && r.includes("Nicht in aggregierten Rentenkennzahlen")));
      assert.ok(Object.values(sheet).some((c: any) => c.v === "=1+1" && c.t === "s" && !c.f));
      if (!allZero) assert.ok(rows.some((r) => r.includes("IST trotz Vollverkauf")));
      for (const c of Object.values(sheet) as any[]) assert.ok(!c.f, "imported text must not become a formula");
    }
  } finally { process.chdir(originalDir); rmSync(dir, { recursive: true }); }
});
console.log(`CP3: ${count} independent regression groups passed.`);
