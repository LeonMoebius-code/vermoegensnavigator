import assert from "node:assert/strict";
import {
  bondDurationMetrics,
  bondDv01,
  bondPortfolioAnalysis,
  buildDepotAnalysisPositions,
  classifyDepotProduct,
  concentrationMetrics,
  countryAnalysis,
  currencyAnalysis,
  entryResultAnalysis,
  industryAnalysis,
  productTypeAnalysis,
  solveModeledYtm,
} from "../app/depot-analysis";
import { DepotHolding, StructurePlan } from "../app/case-model";

const close = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≉ ${expected}`);

const parYtm = solveModeledYtm(100, 5, 5);
assert.notEqual(parYtm, null);
close(parYtm!, 0.05, 1e-8);
const duration = bondDurationMetrics(100, 5, 5, parYtm);
assert.ok(duration && duration.macaulay < 5 && duration.modified > 0);
assert.ok(bondDv01(100000, duration!.modified) > 0);
assert.ok(solveModeledYtm(95, 3, 5)! > 0.03);
assert.ok(solveModeledYtm(105, 5, 5)! < 0.05);

const holding = (id: string, value: number, extra: Partial<DepotHolding> = {}): DepotHolding => ({
  id, name: id, value, assetClass: "Geldwerte", region: "Nicht zugeordnet", risk: 2, plannedSale: 0, note: "", ...extra,
});
const plan: StructurePlan = {
  id: "plan", name: "Plan", total: 100, capitalMode: "manual", preferred: true, notes: "", depotMode: "none",
  depotHoldingIds: [], createdAt: "2026-01-01", updatedAt: "2026-01-01", investmentPlans: [
    { id: "phase", type: "phased", allocationId: "buy", capitalPotId: "strategic", stagedMode: "percent", stagedValue: 50, installments: 4, frequency: "monthly", startDate: "2026-01-15", note: "" },
    { id: "save", type: "savings", productId: "uniglobal", productName: "UniGlobal", contributionAmount: 500, frequency: "monthly", startDate: "2026-01-15", note: "" },
  ],
  allocations: [{ id: "buy", productId: "uniglobal", productName: "UniGlobal", bucketId: "year10plus", amount: 100, solutionId: "global-equity", source: "product", capitalPotId: "strategic" }],
};

const depot = [
  holding("equity", 50, { securityType: "Aktie", industry: "Technologie", rawCountry: "DE", currency: "EUR", gainLossAmount: 5, gainLossPercent: 10 }),
  holding("bond", 30, { securityType: "Anleihe", coupon: 5, currentPrice: 100, maturity: "2031-01-01", nominalOrUnits: 30000, valuationEnd: "2026-01-01", rawCountry: "US", currency: "USD", gainLossAmount: -2, gainLossPercent: -5, plannedSale: 10 }),
  holding("floater", 10, { securityType: "Floater", coupon: 4, currentPrice: 100, maturity: "2030-01-01", nominalOrUnits: 10000, valuationEnd: "2026-01-01" }),
  holding("step", 5, { securityType: "Stufenzinsanleihe", coupon: 3, currentPrice: 99, maturity: "2029-01-01", nominalOrUnits: 5000, valuationEnd: "2026-01-01" }),
  holding("fund", 3, { securityType: "Rentenfonds" }),
  holding("unknown", 2),
];

assert.equal(classifyDepotProduct({ securityType: "Floater" }).bondKind, "floater");
assert.equal(classifyDepotProduct({ securityType: "Stufenzinsanleihe" }).bondKind, "step-up");
assert.equal(classifyDepotProduct({ securityType: "Rentenfonds" }).direct, false);
assert.deepEqual(classifyDepotProduct({ securityType: "Festverzinsliche" }), {
  main: "Renten", sub: "Festverzinsliche Anleihen", direct: true, bondKind: "fixed", confidence: "source",
});
assert.equal(classifyDepotProduct({ securityType: "Rentenfonds Festverzinsliche" }).direct, false);
assert.equal(classifyDepotProduct({ name: "Aktie im Namen" }).main, "Nicht zugeordnet");
const ist = buildDepotAnalysisPositions(depot, plan, "ist");
const planned = buildDepotAnalysisPositions(depot, plan, "plan");
assert.equal(ist.reduce((sum, item) => sum + item.value, 0), 100);
assert.equal(planned.reduce((sum, item) => sum + item.value, 0), 190); // Verkauf 10, Kauf genau einmal 100.
const concentration = concentrationMetrics(ist);
close(concentration.top3, 0.9);
close(concentration.top5, 0.98);
const industries = industryAnalysis(ist, "equities");
assert.equal(industries.distribution[0].label, "Technologie");
close(industries.coverage, 1);
assert.ok(countryAnalysis(ist, "direct").distribution.some((entry) => entry.label === "Deutschland"));
assert.ok(currencyAnalysis(ist).distribution.some((entry) => entry.label === "Nicht zugeordnet"));
const bonds = bondPortfolioAnalysis(ist, new Date(2026, 0, 1));
assert.equal(bonds.rows.find((row) => row.position.id === "bond")?.ytm !== null, true);
assert.equal(bonds.rows.find((row) => row.position.id === "floater")?.ytm, null);
assert.equal(bonds.rows.find((row) => row.position.id === "step")?.modified, null);
assert.equal(bonds.rows.find((row) => row.position.id === "fund")?.ytm, null);
assert.ok(bonds.ladder.length > 0 && bonds.portfolioDv01 > 0);
const results = entryResultAnalysis(depot);
assert.equal(results.gainLossAmount, 3);
assert.equal(results.winners, 1);
assert.equal(results.losers, 1);
close(results.coverage, 0.8);

const referenceDepot = [
  holding("Aktie A", 32_000, { securityType: "Aktien", rawCountry: "DE" }),
  holding("Aktie B", 31_000, { securityType: "Aktien", rawCountry: "US" }),
  holding("Aktie C", 33_389.60, { securityType: "Aktien", rawCountry: "CH" }),
  holding("Festzins 2031", 35_645.26, { securityType: "Festverzinsliche", nominalOrUnits: 40_000, coupon: 1.25, maturity: "2031-09-03", currentPrice: 87.87, valuationEnd: "2026-09-01", rawCountry: "DE" }),
  holding("Festzins 2036", 49_580.16, { securityType: "Festverzinsliche", nominalOrUnits: 50_000, coupon: 4, maturity: "2036-07-22", currentPrice: 98.711, valuationEnd: "2026-09-01", rawCountry: "DE" }),
  holding("Festzins 2032", 51_745.58, { securityType: "Festverzinsliche", nominalOrUnits: 50_000, coupon: 4.125, maturity: "2032-09-27", currentPrice: 99.66, valuationEnd: "2026-09-01", rawCountry: "DE" }),
  holding("Festzins 2040", 58_877.18, { securityType: "Festverzinsliche", nominalOrUnits: 60_000, coupon: 4, maturity: "2040-01-16", currentPrice: 95.63, valuationEnd: "2026-09-01", rawCountry: "DE" }),
  holding("Festzins 2033", 24_744.25, { securityType: "Festverzinsliche", nominalOrUnits: 20_000, coupon: 7.75, maturity: "2033-01-24", currentPrice: 119.05, valuationEnd: "2026-09-01", rawCountry: "IT" }),
  holding("Floater", 67_607.53, { securityType: "Floater", coupon: 3.5, currentPrice: 100, valuationEnd: "2026-09-01", rawCountry: "DE" }),
  holding("Stufenzins", 3_492.58, { securityType: "Stufenzinsanleihen", nominalOrUnits: 5_000, coupon: 3, maturity: "2041-01-15", currentPrice: 69.5, valuationEnd: "2026-09-01", rawCountry: "DE" }),
  holding("Rentenfonds", 35_870.40, { securityType: "Rentenfonds", rawCountry: "LU" }),
];
const referencePositions = buildDepotAnalysisPositions(referenceDepot, { ...plan, allocations: [], investmentPlans: [] }, "ist");
const referenceTypes = productTypeAnalysis(referencePositions);
close(referenceTypes.total, 423_952.54, 0.01);
close(referenceTypes.coverage, 1);
const rentenShare = referenceTypes.main.find((item) => item.label === "Renten")?.share;
const equityShare = referenceTypes.main.find((item) => item.label === "Aktien")?.share;
close(rentenShare!, 327_562.94 / 423_952.54, 0.0001);
close(equityShare!, 96_389.60 / 423_952.54, 0.0001);
assert.equal(referenceTypes.main.some((item) => item.label === "Nicht zugeordnet"), false);
const rentenSubs = referenceTypes.sub.get("Renten")!;
close(rentenSubs.find((item) => item.label === "Festverzinsliche Anleihen")!.value, 220_592.43, 0.01);
const referenceBonds = bondPortfolioAnalysis(referencePositions, new Date(2026, 8, 1));
close(referenceBonds.directValue, 291_692.54, 0.01);
close(referenceBonds.maturityCoverage, 224_085.01 / 291_692.54, 0.0001);
close(referenceBonds.calculableCoverage, 220_592.43 / 291_692.54, 0.0001);
assert.deepEqual(referenceBonds.ladder.map((item) => [item.year, item.nominal]), [[2031, 40_000], [2032, 50_000], [2033, 20_000], [2036, 50_000], [2040, 60_000], [2041, 5_000]]);
assert.ok(referenceBonds.portfolioModified && referenceBonds.portfolioModified > 6 && referenceBonds.portfolioModified < 8);
assert.ok(referenceBonds.portfolioDv01 > 140 && referenceBonds.portfolioDv01 < 165);
assert.ok(referenceBonds.scenarios.every((scenario) => scenario.effect !== 0));
assert.equal(referenceBonds.rows.find((row) => row.position.name === "Floater")?.ytm, null);
assert.equal(referenceBonds.rows.find((row) => row.position.name === "Stufenzins")?.modified, null);
assert.equal(referenceBonds.rows.find((row) => row.position.name === "Rentenfonds")?.ytm, null);
close(countryAnalysis(referencePositions, "direct").total, 291_692.54 + 96_389.60, 0.01);

console.log(
  "Depotcheck-3B-Analyseengine inklusive realitätsnahem Bond-Regressionstest erfolgreich:",
  `Produktarten-Coverage ${(referenceTypes.coverage * 100).toFixed(1)} %,`,
  `YTM-/Duration-Coverage ${(referenceBonds.calculableCoverage * 100).toFixed(1)} %,`,
  `Modified Duration ${referenceBonds.portfolioModified?.toFixed(2)},`,
  `DV01 ${referenceBonds.portfolioDv01.toFixed(2)} €.`,
);
