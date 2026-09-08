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

console.log("Depotcheck-3B-Analyseengine: 32 Prüfungen erfolgreich.");
