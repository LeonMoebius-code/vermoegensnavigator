import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { AmountInput, MAX_AMOUNT_CENTS, formatAmountInput, parseAmountDraft } from "../app/presentation/amount-input";
import { SituationStep } from "../app/page";
import { createCase, updateCaseAdvisory, setCaseDepot, capitalPots, strategicAmount,
  annualSavingsContribution, reconcilePlanCapitalPots } from "../app/case-model";
import { buildDepotAnalysisPositions } from "../app/depot-analysis";
import { readCaseStore } from "../app/case-storage";

let checks = 0;
function test(name: string, run: () => void) { run(); checks++; console.log(`PASS H1 ${name}`); }
function amount(raw: string) {
  const parsed = parseAmountDraft(raw);
  assert.equal(parsed.status, "valid", raw);
  if (parsed.status !== "valid") throw new Error(raw);
  return parsed.value;
}
test("strict German amounts including zeros, grouped euros and cents", () => {
  for (const [raw, expected] of [
    ["0", 0], ["0,00", 0], ["0,01", .01], ["1", 1], ["1,5", 1.5], ["1,50", 1.5],
    ["1000", 1000], ["1.000", 1000], ["1000,50", 1000.5], ["1.000,00", 1000],
    ["1.000,50", 1000.5], ["1.000,5", 1000.5], ["12.345,67", 12345.67],
    ["1.234.567,89", 1234567.89], ["  1.000,50  ", 1000.5], ["12.345,67 €", 12345.67],
    ["1.000,50\u00a0€", 1000.5], ["0001,01", 1.01],
  ] as const) assert.equal(amount(raw), expected, raw);
});
test("reject signs, US decimals, malformed grouping, text, exponent and excess precision", () => {
  for (const raw of ["-100", "+100", "−100", "(100)", "1.000,500", "0,001", "1.2", "1.23.456",
    "1000.50", "1,000.50", "1..000", "1234.567", "1.00", "abc", "12abc34", "1e6", "NaN",
    "Infinity", "1 000,50", "1\u00a0000,50", "€", "€ 100", "100€€", "100 EUR", "1,2,3", ",50"])
    assert.equal(parseAmountDraft(raw).status, "invalid", raw);
});
test("empty and trailing decimal delimiter remain incomplete", () => {
  for (const raw of ["", "  "]) assert.deepEqual(parseAmountDraft(raw), { status: "incomplete", empty: true });
  for (const raw of ["1,", "1.000,", "0,"]) assert.deepEqual(parseAmountDraft(raw), { status: "incomplete", empty: false });
});
test("safe range, exact cent interpretation and overflow rejection", () => {
  assert.ok(MAX_AMOUNT_CENTS < BigInt(Number.MAX_SAFE_INTEGER));
  const max = `${MAX_AMOUNT_CENTS / 100n},${MAX_AMOUNT_CENTS % 100n}`;
  assert.equal(amount(max).toFixed(2), "70368744177663.99");
  for (let cents = MAX_AMOUNT_CENTS - 100n; cents <= MAX_AMOUNT_CENTS; cents++) {
    const raw = `${cents / 100n},${String(cents % 100n).padStart(2, "0")}`;
    assert.equal(amount(raw).toFixed(2).replace(".", ","), raw);
  }
  for (const raw of ["70.368.744.177.664", "9007199254740991,00", "9".repeat(400)])
    assert.equal(parseAmountDraft(raw).status, "invalid");
});
test("all cent fractions and existing integer display survive another edit", () => {
  for (let cents = 0; cents < 100; cents++) {
    const value = amount(`1000,${String(cents).padStart(2, "0")}`);
    assert.equal(amount(formatAmountInput(value)), value);
  }
  assert.equal(formatAmountInput(10000), "10.000");
  assert.equal(formatAmountInput(1000.5), "1.000,5");
  assert.equal(formatAmountInput(0), "");
  assert.equal(formatAmountInput(10592.917767817604), "10.592,917767817604");
});
test("production React component markup: cents, decimal keyboard, readonly and disabled", () => {
  const c = createCase(); c.advisory.liquidAssets = amount("1.000,50");
  const html = renderToStaticMarkup(<SituationStep data={c.advisory} depot={[]} depotAccounts={[]}
    update={() => {}} setDepot={() => {}} applyDepotImport={() => {}} setView={() => {}} />);
  assert.match(html, /inputMode="decimal"[^>]*value="1\.000,5"/);
  for (const state of ["readOnly", "disabled"] as const) {
    const field = renderToStaticMarkup(<AmountInput identity="synthetic" value={1000.5} onValueChange={() => assert.fail()}
      {...{ [state]: true }} />);
    assert.match(field, new RegExp(`${state}=""`, "i"));
    assert.match(field, /value="1\.000,5"/);
  }
});
test("liquidity, reserve and need cents flow through actual capital-pot calculation", () => {
  let c = createCase(); c.createdAt = "2026-01-01T12:00:00.000Z";
  c = updateCaseAdvisory(c, "liquidAssets", amount("100.000,50"));
  c = updateCaseAdvisory(c, "reserve", amount("5.000,25"));
  assert.equal(strategicAmount(c.advisory, c.advisory.liquidAssets), 95000.25);
  c = updateCaseAdvisory(c, "needs", [{ id: 1, purpose: "Synthetischer Bedarf", amount: amount("1.000,50"), years: 1, dueDate: "2027-01-01" }]);
  const pots = capitalPots(c.advisory, c.advisory.liquidAssets, c.createdAt);
  assert.equal(pots.find(p => p.id === "reserve")!.total, 5000.25);
  assert.equal(pots.find(p => p.kind === "year")!.total, 1000.5);
  assert.equal(pots.find(p => p.id === "strategic")!.total, 93999.75);
});
test("allocation coverage, savings, depot value and bounded sale keep cents", () => {
  let c = createCase(); c = updateCaseAdvisory(c, "liquidAssets", amount("100.000,50"));
  const plan = c.plans[0];
  plan.allocations = [{ id: "h1-buy", productId: "synthetic", productName: "Synthetischer Kauf", source: "product",
    solutionId: "mixed", bucketId: "year10plus", capitalPotId: "strategic", allocationMode: "single",
    amount: amount("1.000,50"), capitalPotAmounts: { strategic: amount("1.000,50") } }];
  const reconciled = reconcilePlanCapitalPots(c.advisory, plan, c.createdAt, c.savingsGoals);
  assert.equal(reconciled.allocations[0].amount, 1000.5);
  assert.equal(reconciled.allocations[0].capitalPotAmounts!.strategic, 1000.5);
  const saving = { id: "h1-savings", type: "savings" as const, productId: "synthetic", productName: "Synthetisches Sparen",
    contributionAmount: amount("100,25"), frequency: "monthly" as const, startDate: "2026-11-01", note: "" };
  assert.equal(annualSavingsContribution(saving), 1203);
  c.depotAccounts = [{ id: "h1-depot", name: "Synthetisches Depot", createdAt: c.createdAt, updatedAt: c.createdAt }];
  c = { ...c, ...setCaseDepot(c, [{ id: "h1-holding", depotId: "h1-depot", name: "Synthetische Position",
    value: amount("2.000,75"), plannedSale: Math.min(amount("2.000,75"), amount("1.000,50")),
    assetClass: "Substanzwerte", region: "Weltweit", risk: 3, note: "", classificationStatus: "mapped" }]) };
  assert.equal(c.advisory.depotValue, 2000.75);
  const position = buildDepotAnalysisPositions(c.depot, c.plans[0], "plan").find(p => p.source === "holding");
  assert.equal(position!.value, 1000.25);
  assert.equal(Math.min(c.depot[0].value, amount("9.999,99")), 2000.75);
  const loaded = readCaseStore(JSON.stringify([c]));
  assert.equal(loaded.cases[0].advisory.liquidAssets, 100000.5);
  assert.equal(loaded.cases[0].advisory.depotValue, 2000.75);
  assert.equal(loaded.cases[0].depot[0].plannedSale, 1000.5);
});
test("canonical gate includes H1 once, one build and the three existing browser lifecycles", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal((pkg.scripts.verify.match(/npm run test:h1-amount-inputs/g) ?? []).length, 1);
  assert.equal((pkg.scripts.verify.match(/npm run build\b/g) ?? []).length, 1);
  assert.ok(pkg.scripts.verify.endsWith("npm run test:browser"));
  const page = readFileSync("app/page.tsx", "utf8");
  assert.doesNotMatch(page, /\bparseAmount\s*[=(]/);
  const browser = readFileSync("tests/browser/cp0b.spec.ts", "utf8");
  assert.equal((browser.match(/\btest\("/g) ?? []).length, 3);
});
console.log(`H1: ${checks} regression groups passed; actual React input events run in CP0B.`);
