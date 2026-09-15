import assert from "node:assert/strict";
import {
  addDepotAccount,
  createCase,
  deleteDepotAccount,
  depotAssetAmounts,
  depotMarketValue,
  normalizeImportedCase,
  ParsedDepotHolding,
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

const emptyMigrated = normalizeImportedCase({ ...legacy, schemaVersion: 9, depotAccounts: undefined, depot: [] }, false)!;
equal(emptyMigrated.depotAccounts.length, 0, "B: kein künstliches leeres Depot");

let state = createCase();
state = { ...state, ...addDepotAccount(state, [holding("a", "Allianz", 50_000, { wkn: "840400", industry: "Versicherung", currency: "EUR", rawCountry: "DE", securityType: "Aktie" })], "Altbestand") };
equal(state.plans[0].depotMode, "afterSales", "Default: erster Import aktiviert afterSales");
state = { ...state, ...addDepotAccount(state, [holding("b", "Allianz", 30_000, { wkn: "840400", industry: "Versicherung", currency: "EUR", rawCountry: "DE", securityType: "Aktie" })], "Volksbank pur") };
equal(state.depotAccounts.length, 2, "C: zwei DepotAccounts");
equal(state.depot.length, 2, "C/U: physische Holdings bleiben getrennt");
equal(state.advisory.depotValue, 80_000, "C: Gesamtdepotwert");

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
state = { ...state, ...replaceDepotAccount(state, firstDepot, [holding("e", "Allianz", 15_000, { wkn: "840400" })]) };
equal(state.depot.find((entry) => entry.id === "e")?.plannedSale, 15_000, "K: Verkauf wird gekappt");
check(!state.depot.some((entry) => entry.id === "d"), "L: verschwundene Position entfällt");
check(!state.plans[0].depotHoldingIds.includes("d"), "L: keine tote Referenz");

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
const planConcentration = concentrationMetrics(buildDepotAnalysisPositions([purchaseHolding], purchaseCase.plans[0], "plan"));
equal(planConcentration.largest?.value, 100_000, "R: Bestand und depotunabhängiger Neukauf aggregieren");
check(!buildDepotAnalysisPositions([purchaseHolding], purchaseCase.plans[0], "plan").find((entry) => entry.source === "planned-purchase")?.depotId, "R: Neukauf erhält keine depotId");
equal(depotMarketValue(analysisCase.depot, analysisCase.depotAccounts[0].id), 40_000, "V: Depotexportwert nachvollziehbar");
equal(analysisCase.depotAccounts.map((entry) => entry.name).join(","), "Depot 1,Depot 2", "V: beide Exportnamen vorhanden");

console.log(`Multi-Depot-Regressionsprüfung erfolgreich: ${assertions} Assertions (A–V).`);
