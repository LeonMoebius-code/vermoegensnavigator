import assert from "node:assert/strict";
import "./verify-cp1-review";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement, isValidElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as XLSX from "xlsx";
import {
  AdvisoryCase, CapitalPot, DepotHolding, ParsedDepotHolding, PlannerAllocation,
  addDepotAccount, buildMultiDepotExportData, capitalPots, caseSnapshot, createCase,
  createModelPortfolioVariant, deleteDepotAccount, duplicateStructurePlan, enforceCaseDepotValue,
  normalizeImportedCase, reconcileDepotHoldingSelections, renameDepotAccount, replacementHoldingIdMap,
  replaceDepotAccount, replaceStrategicPlanAllocations, setCaseDepot, supplementPlanWithModelPortfolio,
  updateCaseAdvisory,
} from "../app/case-model";
import { CASE_STORAGE_KEY, RECOVERY_PREFIX, readCaseStore, writeCaseStore, recoveryBackups } from "../app/case-storage";
import { parseDepotCsv, parseGermanNumber } from "../app/depot-csv";
import { calendarDate } from "../app/depot-validation";
import { bondPortfolioAnalysis, buildDepotAnalysisPositions, classifyDepotProduct } from "../app/depot-analysis";
import { ExportCenter, SituationStep } from "../app/page";

const noop = () => {};
const holding = (id: string, value: number, extra: Partial<ParsedDepotHolding> = {}): ParsedDepotHolding => ({
  id, value, name: "Synthetische Position", assetClass: "Geldwerte", region: "Weltweit", risk: 2,
  plannedSale: 0, note: "", securityType: "Festverzinsliche", ...extra,
});
const makeCase = () => {
  const item = createCase();
  item.id = "synthetic-cp1";
  item.advisory.caseName = "cp1-synthetic";
  return { ...item, ...addDepotAccount(item, [holding("a", 40_000), holding("b", 60_000)], "Synthetisches Depot") };
};
class MemoryStorage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
const csv = (text: string) => parseDepotCsv(new TextEncoder().encode(text).buffer);

// A: mutations, persistence, snapshots, copy, imports and the rendered input.
let item = makeCase();
item.advisory.depotValue = 1;
const liquid = item.advisory.liquidAssets;
const potsBefore = JSON.stringify(capitalPots(item.advisory, item.plans[0].total, item.createdAt));
for (const amount of [0, 1]) {
  item = updateCaseAdvisory(item, "depotValue", amount);
  item = updateCaseAdvisory(item, "hasDepot", false);
  assert.equal(item.advisory.depotValue, 100_000);
  assert.equal(item.advisory.hasDepot, true);
}
assert.equal(item.advisory.liquidAssets, liquid);
assert.equal(JSON.stringify(capitalPots(item.advisory, item.plans[0].total, item.createdAt)), potsBefore);
const changed = setCaseDepot(item, item.depot.map((row) => row.id === "a" ? { ...row, value: 41_000 } : row));
assert.equal(changed.advisory.depotValue, 101_000);
assert.equal(item.advisory.depotValue, 100_000);
assert.equal(setCaseDepot(item, []).advisory.depotValue, 0);
const manual = updateCaseAdvisory(createCase(), "depotValue", 1);
assert.equal(manual.advisory.depotValue, 1);
assert.equal(addDepotAccount(manual, [], "Leer").advisory.depotValue, 1);
assert.equal(deleteDepotAccount(item, item.depotAccounts[0].id).advisory.depotValue, 0);
const stale = { ...item, advisory: { ...item.advisory, depotValue: 1 } };
const snapshot = caseSnapshot(stale);
assert.equal(snapshot.advisory.depotValue, 100_000);
const snapshotOriginal = JSON.stringify(snapshot);
assert.equal(normalizeImportedCase(snapshot, false)!.advisory.depotValue, 100_000);
assert.equal(JSON.stringify(snapshot), snapshotOriginal, "restore does not mutate a historical snapshot");
const copy = normalizeImportedCase(JSON.parse(JSON.stringify(stale)))!;
assert.notEqual(copy.id, item.id);
assert.equal(copy.advisory.depotValue, 100_000);
assert.deepEqual(duplicateStructurePlan(item.plans[0]).depotHoldingIds, item.plans[0].depotHoldingIds);
const storage = new MemoryStorage();
writeCaseStore(storage, [stale]);
assert.equal(JSON.parse(storage.getItem(CASE_STORAGE_KEY)!)[0].advisory.depotValue, 100_000);
assert.equal(readCaseStore(storage.getItem(CASE_STORAGE_KEY)).cases[0].advisory.depotValue, 100_000);
assert.equal(buildMultiDepotExportData(item.depotAccounts, item.depot).totalMarketValue, 100_000);
const situation = (data: AdvisoryCase) => renderToStaticMarkup(createElement(SituationStep, {
  data: data.advisory, depot: data.depot, depotAccounts: data.depotAccounts,
  update: noop, setDepot: noop, applyDepotImport: noop, setView: noop,
}));
const depotInput = (html: string) => html.match(/<span>Wertpapierdepot<\/span><div>(<input[^>]+>)/)![1];
assert.match(depotInput(situation(stale)), /readOnly=""/i);
assert.match(depotInput(situation(stale)), /value="100\.000"/);
assert.doesNotMatch(depotInput(situation(manual)), /readOnly/i);
assert.match(depotInput(situation(manual)), /value="1"/);

// Execute the real Excel button and inspect the produced workbook, plus print markup.
function findButton(node: ReactNode, label: string): (() => void) | undefined {
  if (Array.isArray(node)) return node.map((child) => findButton(child, label)).find(Boolean);
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return undefined;
  if (node.type === "button" && renderToStaticMarkup(node).includes(label)) return node.props.onClick;
  return findButton(node.props.children, label);
}
const exportView = ExportCenter({ item: stale, preferredPlan: stale.plans[0], setItem: noop, saveCase: noop, exportJson: noop, importJson: noop });
const printed = renderToStaticMarkup(exportView);
assert.match(printed, /<span>Depot<\/span><strong>100\.000(?:<!-- -->)?(?:\s|&nbsp;|&#xA0;)*€<\/strong>/i);
const excelButton = findButton(exportView, "Excel");
assert.ok(excelButton);
const previousDir = process.cwd();
const exportDir = mkdtempSync(join(tmpdir(), "vn-cp1-"));
try {
  process.chdir(exportDir);
  excelButton();
  const workbook = XLSX.read(readFileSync("cp1-synthetic.xlsx"), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Fall, { header: 1 });
  assert.equal(rows.find((row) => row[0] === "Depotwert")?.[1], 100_000);
} finally { process.chdir(previousDir); rmSync(exportDir, { recursive: true }); }

// B: inspect both the map and final plans/sales. Other depots must remain byte-identical.
let identity = makeCase();
identity.depot[0] = { ...identity.depot[0], wkn: "AAAAAA", plannedSale: 30_000 };
identity.depot[1] = { ...identity.depot[1], wkn: "CCCCCC", name: "Andere Position" };
identity = { ...identity, ...addDepotAccount(identity, [holding("foreign", 12_000, { wkn: "AAAAAA", plannedSale: 2_000 })], "Fremddepot") };
const target = identity.depotAccounts[0].id;
identity.plans[0].depotHoldingIds = ["a", "foreign"];
const foreignBefore = JSON.stringify(identity.depot.find((row) => row.id === "foreign"));
for (const incomingId of ["a", "new"]) {
  const parsed = [holding(incomingId, 20_000, { wkn: "BBBBBB", plannedSale: 9_000 })];
  assert.equal(replacementHoldingIdMap([identity.depot[0]], parsed.map((row) => ({ ...row, depotId: target }))).size, 0);
  const next = replaceDepotAccount(identity, target, parsed);
  assert.deepEqual(next.plans[0].depotHoldingIds, ["foreign"]);
  assert.equal(next.depot.find((row) => row.depotId === target)!.plannedSale, 0);
  assert.notEqual(next.depot.find((row) => row.depotId === target)!.id, "a");
  assert.equal(JSON.stringify(next.depot.find((row) => row.id === "foreign")), foreignBefore);
}
const duplicateIncoming = replaceDepotAccount(identity, target, [holding("a", 1000, { wkn: "AAAAAA" }), holding("a", 2000, { wkn: "AAAAAA" })]);
assert.equal(new Set(duplicateIncoming.depot.map((row) => row.id)).size, duplicateIncoming.depot.length);
assert.deepEqual(duplicateIncoming.plans[0].depotHoldingIds, ["foreign"]);
assert.ok(duplicateIncoming.depot.filter((row) => row.depotId === target).every((row) => row.plannedSale === 0));
const missingId = replaceDepotAccount(identity, target, [holding("", 1000, { wkn: "AAAAAA" })]);
assert.ok(missingId.depot.find((row) => row.depotId === target)!.id);
assert.equal(missingId.depot.find((row) => row.depotId === target)!.plannedSale, 1000);
const sameIdConflict = { ...identity.depot[0], wkn: "BBBBBB" };
assert.deepEqual(reconcileDepotHoldingSelections(identity.plans, identity.depot, [sameIdConflict, identity.depot[2]], target)[0].depotHoldingIds, ["foreign"]);
const legitimate = replaceDepotAccount(identity, target, [holding("new", 15_000, { wkn: "AAAAAA", name: "Umbenannt" })]);
assert.equal(legitimate.depot.find((row) => row.id === "new")!.plannedSale, 15_000);
assert.deepEqual(legitimate.plans[0].depotHoldingIds, ["new", "foreign"]);
const h = (id: string, extra: Partial<DepotHolding> = {}): DepotHolding => ({ ...holding(id, 1_000), depotId: "d", ...extra });
assert.equal(replacementHoldingIdMap([h("a")], [h("b")]).get("a"), "b", "unambiguous name/type fallback without strong identifiers");
assert.equal(replacementHoldingIdMap([h("a", { productId: "p", wkn: "A" })], [h("b", { productId: "p", wkn: "B" })]).size, 0);
assert.equal(replacementHoldingIdMap([h("a", { productId: "p" })], [h("b", { productId: "q" })]).size, 0);
assert.equal(replacementHoldingIdMap([h("a", { wkn: "A" })], [h("b", { wkn: "A", depotId: "other" })]).size, 0);
const ambiguousOld = [h("a", { wkn: "A", name: "Eins" }), h("b", { wkn: "A", name: "Zwei" })];
const ambiguousNew = [h("c", { wkn: "A", name: "Eins" }), h("d", { wkn: "A", name: "Zwei" })];
assert.equal(replacementHoldingIdMap(ambiguousOld, ambiguousNew).size, 0, "names may not break WKN ambiguity");
assert.equal(replacementHoldingIdMap([h("a", { wkn: "A" })], ambiguousNew).size, 0);
const ordered = [h("a", { wkn: "A" }), h("b", { wkn: "B" })];
assert.deepEqual([...replacementHoldingIdMap(ordered, [h("d", { wkn: "B" }), h("c", { wkn: "A" })])], [["a", "c"], ["b", "d"]]);
const collision = replaceDepotAccount(identity, target, [holding("foreign", 1_000, { wkn: "BBBBBB" })]);
assert.equal(collision.depot.filter((row) => row.id === "foreign").length, 1);
assert.equal(JSON.stringify(collision.depot.find((row) => row.id === "foreign")), foreignBefore);
const renamed = renameDepotAccount(identity.depotAccounts, target, "Neuer Depotname");
assert.equal(renamed[0].id, target);
assert.deepEqual(deleteDepotAccount(identity, target).plans[0].depotHoldingIds, ["foreign"]);

// C: table-driven negative examples, atomic replacement and both formats.
const invalidNumbers = ["n/a", "5abc", "1e3", "NaN", "Infinity", "-Infinity", "–", "-", "1,2,3", "1,234.56", "1.234", "1 2", "9".repeat(400)];
for (const raw of invalidNumbers) {
  assert.throws(() => parseGermanNumber(raw), raw);
  const before = JSON.stringify(identity);
  assert.throws(() => replaceDepotAccount(identity, target, csv(`Name;Wert;Anlageklasse\nSynthetisch;${raw};Geldwerte`).rows));
  assert.equal(JSON.stringify(identity), before);
  assert.throws(() => csv(`Bezeichnung;Kurswert incl. Stückzinsen\nSynthetisch;${raw}`));
  const optional = csv(`Bezeichnung;Kurswert incl. Stückzinsen;Zinssatz\nSynthetisch;1000;${raw}`);
  assert.equal(optional.rows[0].coupon, undefined);
  assert.equal(optional.warnings[0].field, "coupon");
  assert.ok(optional.rows[0].importIssues?.length);
}
for (const raw of ["", "-1", "-0,01"]) assert.throws(() => csv(`Name;Wert\nSynthetisch;${raw}`));
for (const value of [NaN, Infinity, -1]) {
  const before = JSON.stringify(identity);
  assert.throws(() => replaceDepotAccount(identity, target, [holding("invalid", value)]));
  assert.equal(JSON.stringify(identity), before);
}
assert.equal(csv("Name;Wert;Anlageklasse\nSynthetisch;1.234,56 €;Geldwerte").rows[0].value, 1234.56);
assert.equal(csv("Name;Wert;Anlageklasse\nSynthetisch;1234.56;Geldwerte").rows[0].value, 1234.56);
assert.equal(csv("Name;Wert;Anlageklasse\nSynthetisch;1 234,56;Geldwerte").rows[0].value, 1234.56);
assert.equal(csv("Name;Wert\nSynthetisch;0").rows[0].value, 0);
assert.throws(() => csv('Name;Wert\n"nicht geschlossen;100'));
assert.equal(calendarDate("29.02.2024"), "2024-02-29");
assert.equal(calendarDate("2000-02-29"), "2000-02-29");
for (const raw of ["31.02.2026", "29.02.2025", "29.02.1900", "2026-04-31", "00.12.2026", "2026-13-01", "2026-09-17T00:00:00Z"]) {
  assert.equal(calendarDate(raw), undefined);
  const parsed = csv(`Bezeichnung;Kurswert incl. Stückzinsen;Endfälligkeit;Bewertungsende\nSynthetisch;1000;${raw};${raw}`);
  assert.equal(parsed.rows[0].maturity, undefined);
  assert.equal(parsed.rows[0].valuationEnd, undefined);
  assert.equal(parsed.warnings.length, 2);
}
const validBond = csv("Bezeichnung;Kurswert incl. Stückzinsen;Wertpapiertyp;Zinssatz;Kurs;Stück/Nominal;Endfälligkeit;Bewertungsende;Depotinhaber;Unerwartete Personenspalte\nSynthetisch;1000;Festverzinsliche;0;100;1000;29.02.2028;17.09.2026;SYNTHETIC-PRIVATE;SYNTHETIC-PRIVATE");
assert.equal(validBond.rows[0].coupon, 0);
assert.equal(classifyDepotProduct({ securityType: "Festverzinsliche", name: "Gold Funding" }).bondKind, "fixed");
assert.equal(classifyDepotProduct({ securityType: "Festverzinsliche", name: "Synthetischer Callable Bond" }).bondKind, "other");
assert.equal(csv("Bezeichnung;Kurswert incl. Stückzinsen;Kursgewinn/-verlust seit Kauf\nSynthetisch;1000;-25,50").rows[0].gainLossAmount, -25.5);
assert.equal(csv("Bezeichnung;Kurswert incl. Stückzinsen;Zinssatz\nSynthetisch;1000;").rows[0].coupon, undefined);
const zeroState = addDepotAccount(createCase(), validBond.rows);
assert.equal(normalizeImportedCase({ ...createCase(), ...zeroState })!.depot[0].coupon, 0);
assert.equal(validBond.rows[0].maturity, "2028-02-29");
assert.equal(validBond.ignoredPersonalColumns, true);
assert.ok(!JSON.stringify(validBond).includes("SYNTHETIC-PRIVATE"));
for (const [field, source] of [["coupon", "Zinssatz"], ["currentPrice", "Kurs"], ["nominalOrUnits", "Stück/Nominal"], ["fxRate", "Devisenkurs"]]) {
  const parsed = csv(`Bezeichnung;Kurswert incl. Stückzinsen;${source}\nSynthetisch;1000;-1`);
  assert.equal((parsed.rows[0] as unknown as Record<string, unknown>)[field], undefined);
  assert.equal(parsed.warnings[0].code, "out-of-range");
}
for (const field of ["investmentMedium", "segment", "securityType"] as const) {
  assert.equal(classifyDepotProduct({ securityType: "Festverzinsliche", [field]: "Rentenfonds" }).direct, false);
}
for (const special of ["Floater", "Step-up", "Callable", "Convertible", "Zertifikat", "Hybrid"]) {
  const parsed = csv(`Bezeichnung;Kurswert incl. Stückzinsen;Wertpapiertyp;Anlagemedium;Zinssatz;Kurs;Endfälligkeit;Bewertungsende\nSynthetisch;1000;Festverzinsliche;${special};5;100;17.09.2031;17.09.2026`);
  const state = addDepotAccount(createCase(), parsed.rows);
  const analysis = bondPortfolioAnalysis(buildDepotAnalysisPositions(state.depot, state.plans[0], "ist"));
  assert.ok(analysis.rows.every((row) => row.ytm === null), special);
}

// D: all three actions, manual positive amount, bad/missing references, no mutation.
const basePlan = item.plans[0];
const strategy: CapitalPot = { id: "strategic", kind: "strategic", label: "Strategisch", range: "", total: 1_000, needs: [], minMonths: 120, legacyBucketId: "year10plus" };
const allocation: PlannerAllocation = { id: "model", productId: "synthetic", productName: "Synthetisch", bucketId: "year10plus", amount: 500, solutionId: "mixed", source: "model", capitalPotId: "strategic", capitalPotAmounts: { strategic: 500 } };
const actions = [
  (pots: CapitalPot[], rows: PlannerAllocation[]) => supplementPlanWithModelPortfolio(basePlan, rows, pots),
  (pots: CapitalPot[], rows: PlannerAllocation[]) => replaceStrategicPlanAllocations(basePlan, rows, pots),
  (pots: CapitalPot[], rows: PlannerAllocation[]) => createModelPortfolioVariant(basePlan, rows, pots, "Variante"),
];
const bound = createCase();
bound.advisory.reserve = 500;
bound.advisory.needs = [{ id: 1, purpose: "Synthetischer Bedarf", amount: 500, years: 1 }];
const boundPots = capitalPots(bound.advisory, 1000);
for (const pots of [[], boundPots, [strategy, strategy], [{ ...strategy, total: 0 }], [{ ...strategy, total: -1 }], [{ ...strategy, total: Infinity }], [{ ...strategy, total: NaN }], [{ ...strategy, kind: "reserve" as const }]]) {
  for (const action of actions) assert.equal(action(pots, [allocation]), basePlan, "blocked before any mutation or variant creation");
}
for (const wrong of [
  { ...allocation, capitalPotId: undefined }, { ...allocation, capitalPotId: "reserve" as const },
  { ...allocation, capitalPotAmounts: { reserve: 500 } }, { ...allocation, capitalPotAmounts: undefined },
  { ...allocation, capitalPotAmounts: { strategic: 500, reserve: 1 } },
  ...[NaN, Infinity, -1].map((amount) => ({ ...allocation, amount, capitalPotAmounts: { strategic: amount } })),
]) for (const action of actions) assert.equal(action([strategy], [wrong]), basePlan);
for (const action of actions) assert.notEqual(action([strategy], [allocation]), basePlan);

// E: one corrupt case cannot erase a healthy neighbor, even on later saves.
const bad = { ...createCase(), id: "corrupt", plans: [null] };
const original = JSON.stringify([bad, stale]);
storage.setItem(CASE_STORAGE_KEY, original);
const loaded = readCaseStore(original);
assert.equal(loaded.cases.length, 1);
assert.equal(loaded.cases[0].id, stale.id);
assert.deepEqual(loaded.protectedEntries, [bad]);
assert.equal(storage.getItem(CASE_STORAGE_KEY), original);
writeCaseStore(storage, loaded.cases);
assert.deepEqual(JSON.parse(storage.getItem(CASE_STORAGE_KEY)!).find((row: { id: string }) => row.id === "corrupt"), bad);
assert.ok([...storage.values].some(([key, value]) => key.startsWith(RECOVERY_PREFIX) && value === original));
writeCaseStore(storage, []);
assert.deepEqual(JSON.parse(storage.getItem(CASE_STORAGE_KEY)!), [bad], "deleting healthy cases preserves the corrupt original");
const malformed = '{"truncated":';
storage.setItem(CASE_STORAGE_KEY, malformed);
assert.equal(readCaseStore(malformed).malformed, true);
assert.throws(() => writeCaseStore(storage, [item]));
assert.equal(storage.getItem(CASE_STORAGE_KEY), malformed);
const optionalCorrupt = JSON.parse(JSON.stringify(item));
optionalCorrupt.depot[0].coupon = { unexpected: true };
optionalCorrupt.depot[0].maturity = ["bad"];
optionalCorrupt.depot[0].securityType = { bad: true };
storage.setItem(CASE_STORAGE_KEY, JSON.stringify([optionalCorrupt]));
const optionalOriginal = storage.getItem(CASE_STORAGE_KEY)!;
const recovered = readCaseStore(optionalOriginal);
assert.equal(recovered.cases.length, 1);
assert.equal(recovered.cases[0].depot[0].coupon, undefined);
assert.equal(recovered.cases[0].depot[0].maturity, undefined);
assert.equal(recovered.cases[0].depot[0].securityType, undefined);
writeCaseStore(storage, recovered.cases);
assert.ok([...storage.values].some(([key, value]) => key.startsWith(RECOVERY_PREFIX) && value === optionalOriginal));
assert.ok(recoveryBackups(storage).some((backup) => backup.original === optionalOriginal), "original remains discoverable after a reload");
const reloaded = readCaseStore(storage.getItem(CASE_STORAGE_KEY));
assert.equal(reloaded.cases.length, 1);
assert.equal(reloaded.cases[0].depot[0].coupon, undefined);
assert.ok(reloaded.cases[0].depot[0].importIssues?.length);
const future = { ...item, id: "future", schemaVersion: 11 };
const mixed = readCaseStore(JSON.stringify([future, item]));
assert.deepEqual(mixed.protectedEntries, [future]);
assert.equal(mixed.cases.length, 1);
storage.setItem(CASE_STORAGE_KEY, original);
const failingStorage = { length: 0, key: () => null, getItem: (key: string) => storage.getItem(key), setItem: () => { throw new Error("quota"); } };
assert.throws(() => writeCaseStore(failingStorage, [item]));
assert.equal(storage.getItem(CASE_STORAGE_KEY), original, "backup failure must abort the main write");
assert.equal(enforceCaseDepotValue(manual).advisory.depotValue, 1);

console.log("CP1: A–E bestanden, inklusive gerenderter UI, tatsächlichem Excel-Export, Replacement-Endzuständen und Speicherfehlern. Ausschließlich synthetische Fixtures.");
