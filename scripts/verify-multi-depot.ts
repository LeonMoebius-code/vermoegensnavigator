import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addDepotAccount,
  buildMultiDepotExportData,
  createCase,
  deleteDepotAccount,
  depotAssetAmounts,
  normalizeImportedCase,
  ParsedDepotHolding,
  initialReplacementDepotId,
  renameDepotAccount,
  replaceDepotAccount,
} from "../app/case-model";
import {
  bondPortfolioAnalysis,
  buildDepotAnalysisPositions,
  concentrationMetrics,
  countryAnalysis,
  currencyAnalysis,
  economicSecurityKey,
  hasMixedValuationDates,
  industryAnalysis,
  entryResultAnalysis,
  productTypeAnalysis,
} from "../app/depot-analysis";
import { houseProducts } from "../app/investment-data";

let assertions = 0;
const check = (condition: unknown, message: string) => {
  assertions += 1;
  assert.ok(condition, message);
};
const equal = (actual: unknown, expected: unknown, message: string) => {
  assertions += 1;
  assert.equal(actual, expected, message);
};

const holding = (
  id: string,
  name: string,
  value: number,
  extra: Partial<ParsedDepotHolding> = {},
): ParsedDepotHolding => ({
  id,
  name,
  value,
  assetClass: "Substanzwerte",
  region: "Deutschland",
  risk: 3,
  plannedSale: 0,
  note: "",
  classificationStatus: "mapped",
  ...extra,
});

const legacy = createCase();
const legacyPlan = {
  ...legacy.plans[0],
  depotMode: "retain" as const,
  depotHoldingIds: ["old-a", "old-b", "old-c"],
};
const migrated = normalizeImportedCase({
  ...legacy,
  schemaVersion: 9,
  depotAccounts: undefined,
  depot: [
    holding("old-a", "Allianz", 50_000, { plannedSale: 20_000, wkn: "840400" }),
    holding("old-b", "BASF", 20_000, { wkn: "BASF11" }),
    holding("old-c", "SAP", 30_000, { wkn: "716460" }),
  ],
  plans: [legacyPlan],
}, false)!;
equal(migrated.schemaVersion, 10, "A: Schema 9 wird zu 10");
equal(migrated.depotAccounts.length, 1, "A: genau ein migriertes Depot");
equal(migrated.depotAccounts[0].name, "Depot 1", "A: Standardname");
check(migrated.depot.every((entry) => entry.depotId === migrated.depotAccounts[0].id), "A: alle Holdings zugeordnet");
equal(migrated.depot.map((entry) => entry.id).join(","), "old-a,old-b,old-c", "A: Holding-IDs bleiben");
equal(migrated.depot[0].plannedSale, 20_000, "A: Verkauf bleibt");
equal(migrated.plans[0].depotHoldingIds.join(","), "old-a,old-b,old-c", "A: Planreferenzen bleiben");
const normalizedDepotValue = normalizeImportedCase({
  ...legacy,
  schemaVersion: 10,
  advisory: { ...legacy.advisory, hasDepot: true, depotValue: 1 },
  depotAccounts: [{ id: "depot-normalized", name: "Depot", createdAt: legacy.createdAt, updatedAt: legacy.updatedAt }],
  depot: [{ ...holding("normalized", "Position", 100_000), depotId: "depot-normalized" }],
}, false)!;
equal(normalizedDepotValue.advisory.depotValue, 100_000, "Finding 4: konkrete Holdings sind die einzige Depotwert-Wahrheit");

const emptyMigrated = normalizeImportedCase({ ...legacy, schemaVersion: 9, depotAccounts: undefined, depot: [] }, false)!;
equal(emptyMigrated.depotAccounts.length, 0, "B: kein künstliches leeres Depot");

let state = createCase();
state = { ...state, ...addDepotAccount(state, [holding("a", "Allianz", 50_000, { wkn: "840400", industry: "Versicherung", currency: "EUR", rawCountry: "DE", securityType: "Aktie" })], "Altbestand") };
equal(state.plans[0].depotMode, "afterSales", "Default: erster Import aktiviert afterSales");
state = { ...state, ...addDepotAccount(state, [holding("b", "Allianz", 30_000, { wkn: "840400", industry: "Versicherung", currency: "EUR", rawCountry: "DE", securityType: "Aktie" })], "Volksbank pur") };
equal(state.depotAccounts.length, 2, "C: zwei DepotAccounts");
equal(state.depot.length, 2, "C/U: physische Holdings bleiben getrennt");
equal(state.advisory.depotValue, 80_000, "C: Gesamtdepotwert");
equal(initialReplacementDepotId(state.depotAccounts, state.depotAccounts[1].id), state.depotAccounts[1].id, "Finding 2: geklicktes zweites Depot wird vorausgewählt");

const concentration = concentrationMetrics(buildDepotAnalysisPositions(state.depot, state.plans[0], "ist"));
equal(concentration.count, 1, "D: identische WKN wirtschaftlich aggregiert");
equal(concentration.largest?.value, 80_000, "D: Allianz gesamt 80.000");
equal(concentration.top3, 1, "D: Top-Kennzahlen verwenden Aggregat");
const productIdentity = economicSecurityKey({ id: "x", productId: "same", wkn: undefined });
equal(productIdentity, economicSecurityKey({ id: "y", productId: "same", wkn: undefined }), "E: productId aggregiert");
check(economicSecurityKey({ id: "x", wkn: undefined, productId: undefined }) !== economicSecurityKey({ id: "y", wkn: undefined, productId: undefined }), "F: Namen erzeugen keine Identität");

const firstDepot = state.depotAccounts[0].id;
const secondDepot = state.depotAccounts[1].id;
state.plans[0] = { ...state.plans[0], depotMode: "retain", depotHoldingIds: ["a"] };
state.depot[0].plannedSale = 20_000;
state = { ...state, ...replaceDepotAccount(state, firstDepot, [
  holding("c", "Allianz", 52_000, { wkn: "840400" }),
  holding("d", "Siemens", 25_000, { wkn: "723610" }),
]) };
equal(state.depot.filter((entry) => entry.depotId === firstDepot).map((entry) => entry.name).join(","), "Allianz,Siemens", "G: Zieldepot ersetzt");
equal(state.depot.find((entry) => entry.depotId === secondDepot)?.id, "b", "G/H: anderes Depot unverändert");
equal(state.plans[0].depotHoldingIds.join(","), "c", "H/I: Referenz nur im Zieldepot reconciliert");
equal(state.depot.find((entry) => entry.id === "c")?.plannedSale, 20_000, "J: geplanter Verkauf bleibt");
state.plans[0] = { ...state.plans[0], depotHoldingIds: ["c", "d"] };
state = { ...state, ...replaceDepotAccount(state, firstDepot, [holding("e", "Allianz", 15_000, { wkn: "840400" })]) };
equal(state.depot.find((entry) => entry.id === "e")?.plannedSale, 15_000, "K: Verkauf wird gekappt");
check(!state.depot.some((entry) => entry.id === "d"), "L: verschwundene Position entfällt");
check(!state.plans[0].depotHoldingIds.includes("d"), "L: keine tote Referenz");

let collisionCase = createCase();
collisionCase = { ...collisionCase, ...addDepotAccount(collisionCase, [
  holding("old-a", "Name X", 10_000, { plannedSale: 1_000, securityType: "Aktie" }),
  holding("old-b", "Andere Position", 20_000, { plannedSale: 7_000, wkn: "WKN-Y", securityType: "Aktie" }),
], "Kollisionsdepot") };
const collisionDepotId = collisionCase.depotAccounts[0].id;
collisionCase.plans[0] = {
  ...collisionCase.plans[0],
  depotMode: "retain",
  depotHoldingIds: ["old-a", "old-b"],
};
collisionCase = { ...collisionCase, ...replaceDepotAccount(collisionCase, collisionDepotId, [
  holding("new-shared", "Name X", 25_000, { wkn: "WKN-Y", securityType: "Aktie" }),
]) };
equal(collisionCase.depot[0].plannedSale, 7_000, "Finding 1: WKN-Match gewinnt vor Namensfallback");
equal(collisionCase.plans[0].depotHoldingIds.join(","), "new-shared", "Finding 1: finale 1:1-Tabelle remappt Planreferenzen ohne Dublette");

let replacementFirstImport = createCase();
replacementFirstImport = { ...replacementFirstImport, ...addDepotAccount(replacementFirstImport, [], "Leeres Depot") };
replacementFirstImport = { ...replacementFirstImport, ...replaceDepotAccount(
  replacementFirstImport,
  replacementFirstImport.depotAccounts[0].id,
  [holding("first-concrete", "Erstbestand", 12_000)],
) };
equal(replacementFirstImport.plans[0].depotMode, "afterSales", "Finding 5: erster konkreter Replacement-Import setzt afterSales");
let consciouslySelected = createCase();
consciouslySelected = { ...consciouslySelected, ...addDepotAccount(consciouslySelected, [], "Leeres Depot") };
consciouslySelected.plans[0] = {
  ...consciouslySelected.plans[0],
  depotMode: "compare",
  depotModeSelectionInitialized: true,
};
consciouslySelected = { ...consciouslySelected, ...replaceDepotAccount(
  consciouslySelected,
  consciouslySelected.depotAccounts[0].id,
  [holding("first-conscious", "Erstbestand", 12_000)],
) };
equal(consciouslySelected.plans[0].depotMode, "compare", "Finding 5: bewusster Depotmodus bleibt erhalten");

const idsBeforeRename = state.depot.map((entry) => entry.id).join(",");
const renamed = renameDepotAccount(state.depotAccounts, secondDepot, "Fremdbank");
equal(renamed.find((entry) => entry.id === secondDepot)?.name, "Fremdbank", "N: Umbenennung");
equal(state.depot.map((entry) => entry.id).join(","), idsBeforeRename, "N: Holding-IDs unverändert");
state = { ...state, depotAccounts: renamed };
state = { ...state, ...deleteDepotAccount(state, firstDepot) };
equal(state.depotAccounts.length, 1, "M: DepotAccount gelöscht");
equal(state.depot.length, 1, "M: anderes Depot bleibt");
equal(state.advisory.depotValue, 30_000, "M: Gesamtwert neu berechnet");
equal(state.plans[0].depotHoldingIds.length, 0, "M: tote Planreferenzen entfernt");

let analysisCase = createCase();
analysisCase = { ...analysisCase, ...addDepotAccount(analysisCase, [
  holding("eq", "Aktie", 40_000, { securityType: "Aktie", industry: "Industrie", rawCountry: "DE", currency: "EUR" }),
], "Depot 1") };
analysisCase = { ...analysisCase, ...addDepotAccount(analysisCase, [
  holding("bond", "Anleihe", 60_000, { assetClass: "Geldwerte", securityType: "Festverzinsliche", rawCountry: "US", currency: "USD", coupon: 5, currentPrice: 100, maturity: "2031-09-01", nominalOrUnits: 60_000, valuationEnd: "2026-09-12" }),
], "Depot 2") };
analysisCase.depot[0].valuationEnd = "2026-09-01";
const positions = buildDepotAnalysisPositions(analysisCase.depot, analysisCase.plans[0], "ist");
equal(productTypeAnalysis(positions).total, 100_000, "O: Produktarten über alle Depots");
equal(industryAnalysis(positions, "total").distribution.reduce((sum, entry) => sum + entry.value, 0), 100_000, "O: Branchen-Nenner vollständig");
equal(countryAnalysis(positions, "total").total, 100_000, "O: Länder über alle Depots");
equal(currencyAnalysis(positions).total, 100_000, "O: Währungen über alle Depots");
equal(depotAssetAmounts(analysisCase.depot).total, 100_000, "P: Vermögenshaus aggregiert");

analysisCase.depot[0].plannedSale = 10_000;
const planPositions = buildDepotAnalysisPositions(analysisCase.depot, analysisCase.plans[0], "plan");
equal(planPositions.find((entry) => entry.id === "eq")?.value, 30_000, "Q: Verkauf nur konkrete Holding");
equal(planPositions.find((entry) => entry.id === "bond")?.value, 60_000, "Q: anderes Depot unverändert");
check(hasMixedValuationDates(positions), "S: gemischte Stichtage erkannt");
const bonds = bondPortfolioAnalysis(positions);
const bondRow = bonds.rows.find((row) => row.position.id === "bond")!;
check(bondRow.remainingYears !== null && bondRow.remainingYears > 4.9 && bondRow.remainingYears < 5.1, "T: positionsbezogener Bond-Stichtag");
check(bondRow.ytm !== null && Math.abs(bondRow.ytm - 0.05) < 0.002, "T: YTM plausibel");
const datedBondCase = createCase();
const datedBondPositions = buildDepotAnalysisPositions([
  { ...holding("bond-date-a", "Bond A", 40_000, { assetClass: "Geldwerte", securityType: "Festverzinsliche", coupon: 5, currentPrice: 100, maturity: "2031-01-01", nominalOrUnits: 40_000, valuationEnd: "2026-01-01" }), depotId: "date-depot-a" },
  { ...holding("bond-date-b", "Bond B", 60_000, { assetClass: "Geldwerte", securityType: "Festverzinsliche", coupon: 5, currentPrice: 100, maturity: "2032-01-01", nominalOrUnits: 60_000, valuationEnd: "2027-01-01" }), depotId: "date-depot-b" },
], datedBondCase.plans[0], "ist");
const datedBonds = bondPortfolioAnalysis(datedBondPositions, new Date(2026, 0, 1));
for (const row of datedBonds.rows)
  check(row.remainingYears !== null && row.remainingYears > 4.99 && row.remainingYears < 5.01, `T: ${row.position.name} verwendet eigenen Stichtag`);
const purchaseProduct = houseProducts.find((product) => Boolean(product.wkn))!;
const purchaseCase = createCase();
purchaseCase.plans[0].allocations = [{
  id: "buy", productId: purchaseProduct.id, productName: purchaseProduct.name,
  bucketId: "10_plus", amount: 20_000, solutionId: "funds", source: "product",
}];
const purchaseHolding = {
  ...holding("existing", purchaseProduct.name, 80_000, { productId: purchaseProduct.id, wkn: purchaseProduct.wkn }),
  depotId: "depot-existing",
};
const secondPurchaseHolding = { ...purchaseHolding, id: "existing-second", depotId: "depot-existing-second", value: 30_000, plannedSale: 10_000 };
purchaseHolding.value = 50_000;
const planConcentrationAfterChange = concentrationMetrics(
  buildDepotAnalysisPositions([purchaseHolding, secondPurchaseHolding], purchaseCase.plans[0], "plan"),
);
equal(planConcentrationAfterChange.largest?.value, 90_000, "Q/R: PLAN aggregiert gleiche Security nach positionsbezogenem Verkauf und Neukauf");
check(!buildDepotAnalysisPositions([purchaseHolding, secondPurchaseHolding], purchaseCase.plans[0], "plan").find((entry) => entry.source === "planned-purchase")?.depotId, "R: Neukauf erhält keine depotId");

const separateEntryRows = entryResultAnalysis([
  { ...holding("entry-a", "Gleiche Aktie", 10_000, { wkn: "SAME", averageEntryPrice: 80, gainLossAmount: 2_000, gainLossPercent: 25 }), depotId: "entry-depot-a" },
  { ...holding("entry-b", "Gleiche Aktie", 15_000, { wkn: "SAME", averageEntryPrice: 120, gainLossAmount: -1_500, gainLossPercent: -10 }), depotId: "entry-depot-b" },
]);
equal(separateEntryRows.rows.length, 2, "U: physisch getrennte Einstandszeilen bleiben getrennt");
equal(separateEntryRows.rows.map((row) => row.averageEntryPrice).join(","), "80,120", "U: unterschiedliche Einstandsdaten bleiben erhalten");

const exportData = buildMultiDepotExportData(analysisCase.depotAccounts, analysisCase.depot);
equal(exportData.overview.length, 2, "V: tatsächlicher Exportpfad enthält beide Depots");
equal(exportData.overview.reduce((sum, entry) => sum + entry.marketValue, 0), 100_000, "V: Export-Depotwerte sind korrekt");
equal(exportData.totalMarketValue, 100_000, "V: Export-Gesamtdepot ist korrekt");
check(exportData.holdings.every((entry) => Boolean(entry.depotName)), "V: Exportpositionen besitzen nachvollziehbare Depotzuordnung");

const pageSource = readFileSync("app/page.tsx", "utf8");
const globalInputMount = pageSource.indexOf("{csvImport.input}", pageSource.indexOf("function DepotOptimizer"));
const positionsBranch = pageSource.indexOf('{section === "positions"', pageSource.indexOf("function DepotOptimizer"));
check(globalInputMount > 0 && globalInputMount < positionsBranch, "Finding 3: File-Input ist außerhalb des Positions-Tabs gemountet");
check(pageSource.indexOf("{csvImport.preview}", pageSource.indexOf("function DepotOptimizer")) < positionsBranch, "Finding 3: Importvorschau ist in allen Depotcheck-Tabs verfügbar");

console.log(`Multi-Depot-Regressionsprüfung erfolgreich: ${assertions} Assertions (A–V).`);
