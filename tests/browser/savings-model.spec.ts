import { expect, test } from "@playwright/test";
import { createCase } from "../../app/case-model";
import { appendCatalogRevision } from "../../app/domain/retirement/catalog-validation";
import { calculateM1, calculateM2, MODEL_M2_START_RATES } from "../../app/domain/retirement/savings-model";
import { record, reseal } from "./avd-catalog-fixture";
import {
  balancedFixture, currentRef, m1Fixture, m2Fixture, modelFixture, payment, revisedCost,
} from "./savings-model-fixture";

function m1(input: ReturnType<typeof m1Fixture>) {
  const result = calculateM1(JSON.stringify(input));
  if (!result.ok) throw new Error(JSON.stringify(result.issue));
  return result;
}

function m2(input: ReturnType<typeof m2Fixture>) {
  const result = calculateM2(JSON.stringify(input));
  if (!result.ok) throw new Error(JSON.stringify(result.issue));
  return result;
}

function zeroM1() {
  const input = m1Fixture(modelFixture([0]));
  input.opening_cents = 0;
  input.market.rates_bps = { cautious: 0, medium: 0, opportunity: 0 };
  return input;
}

test("C01: a 100 EUR month-end contribution earns zero in the payment month", () => {
  const input = zeroM1();
  input.payments.push(payment("2027-01-03"));
  expect(m1(input).paths[0].result?.[0].months).toEqual([
    { month: "2027-01", inflow_cents: 10_000, gross_cents: 10_000, net_cents: 10_000 },
  ]);
  input.market.rates_bps.cautious = 4000;
  expect(m1(input).paths[0].result?.[0].months[0].net_cents).toBe(10_000);
  const invested = m2Fixture(4000);
  invested.opening_cents = 0;
  invested.payments.push(payment("2027-01-03"));
  expect(m2(invested).paths[0].result?.scenarios[0].months[0]).toMatchObject({ cost_cents: 0, closing_cents: 10_000 });
});

test("C02: three dated 100 EUR payments have an exact 300 EUR closing balance", () => {
  const input = zeroM1();
  input.months = 3;
  input.payments.push(...["2027-01-03", "2027-02-17", "2027-03-31"].map(date => payment(date)));
  expect(m1(input).paths[0].result?.[0].months.map(row => row.net_cents)).toEqual([10_000, 20_000, 30_000]);
});

test("C03: M1 annual difference in percentage points gives 10,064.34 EUR", () => {
  const output = m1(m1Fixture());
  expect(output.paths[0]).toMatchObject({ model_version: "avd.m1.v1", cost_convention: "M1_additive_v1" });
  expect(output.paths[0].result?.[0].months[0]).toMatchObject({ gross_cents: 1_007_974, net_cents: 1_006_434 });
});

test("C04: M2 multiplicative cost gives 10,062.79 EUR", () => {
  const output = m2(m2Fixture());
  expect(output.paths[0]).toMatchObject({ model_version: "avd.m2.v1", cost_convention: "M2_balance_factor_v1" });
  expect(output.paths[0].result?.scenarios[0].months[0]).toMatchObject({ closing_cents: 1_006_279 });
});

test("C05: nonpositive annual M1 factor is a controlled path failure", () => {
  const input = m1Fixture();
  input.market.rates_bps.cautious = -10_000;
  expect(m1(input).paths[0]).toMatchObject({
    status: "nicht_berechenbar", result: null, issue: { code: "invalid_annual_factor", path: "$.market.rates_bps.cautious" },
  });
});

test("C06: P1 rejects k = 1 and negative costs before M2 can consume them", () => {
  for (const cost of [1, -0.02]) {
    const output = calculateM2(JSON.stringify(m2Fixture(1000, modelFixture([cost]))));
    expect(output).toEqual({ ok: false, issue: { code: cost === 1 ? "invalid_ratio" : "invalid_parameter_value", path: "$.catalog" } });
  }
});

test("C07: 60/40 crash affects only pre-existing shares and leaves 920 EUR", () => {
  const input = balancedFixture();
  input.payments.push(payment("2027-01-01"));
  input.market.crash = { month: "2027-01", equity_loss_bps: -3000 };
  expect(m2(input).paths[0].result?.scenarios[0].months[0]).toMatchObject({
    positions: [48_000, 44_000], cost_cents: 0, closing_cents: 92_000,
  });
});

test("C08: eleven months of drift have no hidden rebalancing", () => {
  const input = balancedFixture(2100);
  input.months = 11;
  const rows = m2(input).paths[0].result?.scenarios[0].months;
  expect(rows?.every(row => !row.rebalanced)).toBe(true);
  expect(rows?.[10].positions).toEqual([71_456, 40_000]);
});

test("C09: twelfth-month rebalance follows month-end payment and preserves the total", () => {
  const input = balancedFixture(2100);
  input.months = 12;
  input.payments.push(payment("2027-12-13", 12_400));
  const row = m2(input).paths[0].result?.scenarios[0].months[11];
  expect(row).toMatchObject({ rebalanced: true, closing_cents: 125_000, positions: [75_000, 50_000] });
  input.paths[0].profile!.rebalancing = "none";
  expect(m2(input).paths[0].result?.scenarios[0].months[11]).toMatchObject({
    rebalanced: false, closing_cents: 125_000, positions: [80_040, 44_960],
  });
});

test("C10: explicit monthly lifecycle change moves holdings before return and crash", () => {
  const input = balancedFixture(2100);
  input.months = 2;
  const first = m2(input).paths[0].result?.scenarios[0].months[0];
  input.paths[0].profile!.kind = "basis";
  input.paths[0].profile!.changes = [{ month: "2027-02", weights_bps: [3000, 7000] }];
  input.market.crash = { month: "2027-02", equity_loss_bps: -3000 };
  const rows = m2(input).paths[0].result?.scenarios[0].months;
  expect(rows?.[0]).toEqual(first);
  expect(rows?.[1]).toMatchObject({ weights_changed: true, closing_cents: 92_214, positions: [21_541, 70_672] });
});

test("C11: six artificial costs, separate identities, same gross comparison basis", () => {
  const output = m1(m1Fixture());
  expect(output.complete).toBe(true);
  expect(output.paths.map(path => path.product_ref.id)).toEqual(Array.from({ length: 6 }, (_, i) => "synthetic-product-" + (i + 1)));
  expect(output.paths.map(path => path.result?.[0].months[0].net_cents)).toEqual([
    1_006_434, 1_005_889, 1_005_104, 1_004_789, 1_003_994, 1_003_113,
  ]);
  expect(output.paths.every(path => path.cost?.class === "S" && path.result?.[0].months[0].gross_cents === 1_007_974)).toBe(true);
});

test("C12: missing or open cost prevents a complete six-way comparison", () => {
  const input = m1Fixture(modelFixture([null, 0, 0, 0, 0, 0]));
  for (const mode of ["open", "missing"]) {
    if (mode === "missing") input.paths[0].scenario_cost_ref = null;
    const output = m1(input);
    expect(output).toMatchObject({ complete: false, status: "nicht_berechenbar" });
    expect(output.paths[0]).toMatchObject({ result: null, issue: { code: "cost_open" } });
    expect(output.paths.slice(1).every(path => path.result !== null)).toBe(true);
  }
});

test("C13: a return already including costs cannot be charged again", () => {
  const inputs = [m1Fixture(), m2Fixture()];
  for (const input of inputs) {
    input.market.basis = "net";
    const run = input.model_version === "avd.m1.v1" ? calculateM1 : calculateM2;
    expect(run(JSON.stringify(input))).toEqual({ ok: false, issue: { code: "gross_returns_required", path: "$.market.basis" } });
  }
});

test("C14: active K1 and K2 costs in the same savings path are rejected", () => {
  const catalog = modelFixture();
  const input = m1Fixture(catalog);
  input.paths[0].scenario_cost_ref = null;
  input.paths[0].cost_refs = [
    currentRef(catalog, "cost", "synthetic-k1-m1-1"), currentRef(catalog, "cost", "synthetic-k2"),
  ];
  expect(m1(input).paths[0].issue).toEqual({ code: "conflicting_cost_modes", path: "$.paths.0.cost_refs" });
  input.paths[0].cost_refs.shift();
  expect(m1(input).paths[0].issue?.code).toBe("unsupported_cost_mode");
});

test("C15: fractional ten-percent steps in an individual ETF selection are rejected", () => {
  const input = m2Fixture();
  const catalog = modelFixture();
  const profile = input.paths[0].profile!;
  profile.kind = "ruv-individuell";
  profile.positions = [1, 2].map(index => ({
    asset_class: "equity", fund_ref: currentRef(catalog, "fund", "synthetic-fund-" + index), annual_rate_bps: null,
  }));
  profile.target_weights_bps = [3500, 6500];
  expect(m2(input).paths[0].issue?.code).toBe("individual_weight_step");
  profile.target_weights_bps = [3000, 7000];
  expect(m2(input).complete).toBe(true);
});

test("C16: a referenced comfort portfolio preserves its exact non-ten-percent weights", () => {
  const catalog = modelFixture();
  const input = m2Fixture(0, catalog);
  const profile = input.paths[0].profile!;
  const comfort = record(catalog, "synthetic-comfort", "portfolio");
  profile.kind = "ruv-individuell";
  profile.comfort_ref = currentRef(catalog, "portfolio", comfort.id);
  profile.positions = comfort.data.weights.map(weight => ({
    asset_class: record(catalog, weight.fund.id, "fund").data.assetClass, fund_ref: weight.fund, annual_rate_bps: null,
  }));
  profile.target_weights_bps = comfort.data.weights.map(weight => weight.basisPoints);
  input.opening_cents = 0;
  input.payments.push(payment("2027-01-01"));
  const output = m2(input).paths[0].result;
  expect(output?.profile.target_weights_bps).toEqual([3100, 1700, 700, 500, 2900, 1100]);
  expect(output?.scenarios[0].months[0].positions).toEqual([3100, 1700, 700, 500, 2900, 1100]);
});

test("C17: missing standard weights block the affected portfolio only", () => {
  const input = m2Fixture();
  input.paths.push({ ...input.paths[0], id: "artificial-standard", profile: null });
  const output = m2(input);
  expect(output.complete).toBe(false);
  expect(output.paths[0].result).not.toBeNull();
  expect(output.paths[1].issue).toEqual({ code: "portfolio_open", path: "$.paths.1.profile" });
  input.paths[1].profile = { ...input.paths[0].profile!, kind: "ruv-standard" };
  expect(m2(input).paths[1].issue?.code).toBe("standard_two_asset_classes_required");
});

test("C18: a guarantee inflow proxy never rebalances holdings to a guaranteed split", () => {
  const input = balancedFixture();
  const profile = input.paths[0].profile!;
  profile.kind = "ruv-garantie-80";
  profile.positions[1].asset_class = "secured_assets";
  profile.opening_weights_bps = [7000, 3000];
  profile.target_weights_bps = [2000, 8000];
  profile.rebalancing = "none";
  input.months = 12;
  input.market.crash = { month: "2027-01", equity_loss_bps: -3000 };
  input.payments.push(payment("2027-01-01"));
  const rows = m2(input).paths[0].result?.scenarios[0].months;
  expect(rows?.[0]).toMatchObject({ closing_cents: 89_000, positions: [51_000, 38_000] });
  expect(rows?.[11]).toMatchObject({ closing_cents: 89_000, positions: [51_000, 38_000], rebalanced: false });
  profile.rebalancing = "annual";
  expect(m2(input).paths[0].issue?.code).toBe("inflow_proxy_reallocation");
});

test("C19: a 2027 hypothetical grant enters cash flow in June 2028", () => {
  const input = zeroM1();
  input.start_month = "2028-05";
  input.months = 3;
  input.subject = null;
  input.payments.push({ ...payment("2028-06-16", 123), kind: "grant", grant: { funding_year: 2027, entitlement_id: "synthetic-grant" } });
  const output = m1(input);
  expect(output.payments[0]).toMatchObject({ class: "S", grant: { funding_year: 2027 }, booking_month: "2028-06" });
  expect(output.paths[0].result?.[0].months.map(row => row.net_cents)).toEqual([0, 123, 123]);
});

test("C20: the 2026 grant remains in 2026", () => {
  const input = zeroM1();
  input.start_month = "2026-12";
  input.months = 2;
  input.payments.push({ ...payment("2026-12-31", 111), kind: "grant", grant: { funding_year: 2026, entitlement_id: "synthetic-grant" } });
  const output = m1(input);
  expect(output.payments[0].grant?.funding_year).toBe(2026);
  expect(output.paths[0].result?.[0].months.map(row => row.inflow_cents)).toEqual([111, 0]);
});

test("C21: the equity crash happens once, after return and before the inflow", () => {
  const input = balancedFixture(2100);
  input.months = 3;
  input.payments.push(payment("2027-01-01"));
  input.market.crash = { month: "2027-01", equity_loss_bps: -3000 };
  const root = 1.21 ** (1 / 12);
  const expected = [
    600 * root * 0.7 + 60,
    (600 * root * 0.7 + 60) * root,
    (600 * root * 0.7 + 60) * root ** 2,
  ].map(equity => Math.round((440 + equity) * 100));
  expect(m2(input).paths[0].result?.scenarios[0].months.map(row => row.closing_cents)).toEqual(expected);
});

test("C22: a genuine P1 cost revision rejects a superseded ref and changes the snapshot", () => {
  const catalog = modelFixture();
  const next = revisedCost(catalog, 0.032);
  expect(appendCatalogRevision(catalog, next).ok).toBe(true);
  const oldInput = m1Fixture(catalog);
  const old = m1(oldInput);
  const current = m1Fixture(next);
  current.paths[0].scenario_cost_ref = oldInput.paths[0].scenario_cost_ref;
  const stale = m1(current);
  expect(stale.paths[0].issue?.code).toBe("catalog_reference_not_current");
  expect(stale.snapshot_hash).not.toBe(old.snapshot_hash);
  expect(stale.case_ref).toBeNull();
  expect(stale.comparison_ref).toBeNull();
});

test("C23: catalog hash, product, tariff and cost phase resolve exactly", () => {
  const catalog = modelFixture();
  const input = m1Fixture(catalog);
  const incorrect = "a".repeat(64);
  expect(calculateM1(JSON.stringify({ ...input, catalog_ref: { ...input.catalog_ref, hash: incorrect } }))).toMatchObject({
    ok: false, issue: { code: "catalog_snapshot_mismatch", path: "$.catalog_ref" },
  });
  expect(calculateM1(JSON.stringify({ ...input, catalog: { ...catalog, hash: incorrect } }))).toMatchObject({
    ok: false, issue: { code: "content_hash_mismatch", path: "$.catalog" },
  });
  const path = input.paths[0];
  const product = { ...path.product_ref };
  path.product_ref.hash = incorrect;
  expect(m1(input).paths[0].issue?.path).toBe("$.paths.0.product_ref");
  path.product_ref = product;
  const tariff = path.tariff_ref;
  path.tariff_ref = input.paths[1].tariff_ref;
  expect(m1(input).paths[0].issue?.code).toBe("tariff_scope");
  path.tariff_ref = tariff;
  path.scenario_cost_ref = null;
  path.cost_refs = [currentRef(catalog, "cost", "synthetic-payout-1")];
  expect(m1(input).paths[0].issue?.code).toBe("cost_phase_mismatch");
  path.cost_refs = [currentRef(catalog, "cost", "synthetic-k1-m2-1")];
  expect(m1(input).paths[0].issue?.code).toBe("cost_model_mismatch");
  path.cost_refs = [currentRef(catalog, "cost", "synthetic-k1-m1-1")];
  expect(m1(input).paths[0].cost?.class).toBe("A");
});

test("C24: wrong or M3 versions are rejected at the version field", () => {
  for (const version of ["avd.m2.v1", "avd.m3.v1", "avd.m1.v2"]) {
    expect(calculateM1(JSON.stringify({ ...m1Fixture(), model_version: version }))).toMatchObject({
      ok: false, issue: { path: "$.model_version" },
    });
  }
  expect(calculateM2(JSON.stringify(m1Fixture()))).toMatchObject({ ok: false, issue: { path: "$.model_version" } });
});

test("C25: an O cost remains open while a distinct explicit zero S cost calculates", () => {
  const output = m1(m1Fixture(modelFixture([null, 0, 0, 0, 0, 0])));
  expect(output.paths[0]).toMatchObject({ status: "nicht_berechenbar", result: null, cost: null, cost_class: "O" });
  expect(output.paths[1]).toMatchObject({ status: "bedingt_berechnet", cost: { class: "S", annual_ratio: 0 } });
});

test("C26: one changed cost changes only that path hash and invalidates the joint snapshot", () => {
  const catalog = modelFixture();
  const before = m1(m1Fixture(catalog));
  const afterInput = m1Fixture(revisedCost(catalog, 0.003));
  const after = m1(afterInput);
  expect(after.complete).toBe(true);
  expect(after.snapshot_hash).not.toBe(before.snapshot_hash);
  expect(after.paths[0].dependency_hash).not.toBe(before.paths[0].dependency_hash);
  expect(after.paths.slice(1)).toEqual(before.paths.slice(1));
  afterInput.subject!.person_id = "other-synthetic-person";
  expect(m1(afterInput).paths.every((path, index) => path.dependency_hash !== after.paths[index].dependency_hash)).toBe(true);
});

test("C27: total equity crash wipes prior holdings but leaves the 100 EUR inflow", () => {
  const input = m2Fixture(0, modelFixture([0]));
  input.opening_cents = 100_000;
  input.payments.push(payment("2027-01-27"));
  input.market.crash = { month: "2027-01", equity_loss_bps: -10_000 };
  expect(m2(input).paths[0].result?.scenarios[0].months[0]).toMatchObject({ closing_cents: 10_000, positions: [10_000] });
});

test("C28: malformed calendar, cents, duplicate IDs, foreign fields and executable objects", () => {
  const input = zeroM1();
  const json = JSON.stringify(input);
  for (const [value, code, path] of [
    [{ ...input, start_month: "2027-13" }, "invalid_month", "$.start_month"],
    [{ ...input, start_month: "9999-12", months: 2 }, "calendar_overflow", "$.months"],
    [{ ...input, payments: [payment("2027-01-01", -1)] }, "invalid_integer", "$.payments.0.cents"],
    [{ ...input, payments: [payment("2027-01-01"), payment("2027-01-01")] }, "duplicate_identity", "$.payments.1.id"],
    [{ ...input, counterfeit: 1 }, "unknown_or_missing_field", "$"],
  ] as const) {
    expect(calculateM1(JSON.stringify(value))).toEqual({ ok: false, issue: { code, path } });
  }
  for (const number of ["-0", "1e400"]) {
    expect(calculateM1(json.replace('"opening_cents":0', '"opening_cents":' + number))).toEqual({
      ok: false, issue: { code: "invalid_number", path: "$.opening_cents" },
    });
  }
  expect(calculateM1(json.replace('"opening_cents":0', '"opening_cents":NaN'))).toMatchObject({ issue: { code: "invalid_json" } });
  const inherited = Object.create({ ...input });
  let called = false;
  const getter = Object.defineProperty(input, "opening_cents", { get() { called = true; return 0; } });
  const proxy = new Proxy(input, { ownKeys() { called = true; throw new Error("trap"); } });
  for (const object of [getter, proxy, inherited]) {
    expect(calculateM1(object)).toMatchObject({ issue: { code: "json_text_required" } });
  }
  expect(called).toBe(false);
});

test("C29: P1 blocks all public output when a cost's A parameter is internal", () => {
  const catalog = modelFixture();
  record(catalog, "synthetic-cost-1", "parameter").publication = { state: "internal" };
  catalog.origin = "working";
  reseal(catalog);
  const result = calculateM1(JSON.stringify(m1Fixture(catalog)));
  expect(result).toEqual({ ok: false, issue: { code: "publication_blocked", path: "$.catalog" } });
  expect(JSON.stringify(result)).not.toContain("synthetic-cost-1");
});

test("C30: general case creation stays on schema 11", () => {
  expect(createCase().schemaVersion).toBe(11);
});

test("Three full 1200-month scenarios are deterministic and use five independent asset rates", () => {
  const input = m2Fixture(0, modelFixture([0]));
  input.months = 1200;
  input.market.rates_bps = structuredClone(MODEL_M2_START_RATES);
  const profile = input.paths[0].profile!;
  profile.positions = (["equity", "bond", "cash", "commodity", "secured_assets"] as const)
    .map(asset_class => ({ asset_class, fund_ref: null, annual_rate_bps: null }));
  profile.target_weights_bps = [2000, 2000, 2000, 2000, 2000];
  input.opening_cents = 100_000;
  input.payments.push(payment("2027-01-06", 1), { ...payment("2027-01-31", 2), kind: "special_payment" });
  const output = m2(input);
  expect(m2(input)).toEqual(output);
  for (const { scenario, months } of output.paths[0].result!.scenarios) {
    expect(months).toHaveLength(1200);
    expect(months[0].inflow_cents).toBe(3);
    expect(months.at(-1)?.month).toBe("2126-12");
    const rates = Object.values(input.market.rates_bps[scenario]);
    const growth = rates.reduce<number>((total, rate) => total + (1 + rate! / 10_000) / 5, 0);
    const firstYearContribution = rates.reduce<number>((total, rate) => total + (1 + rate! / 10_000) ** (11 / 12) / 5, 0);
    expect(months.at(-1)?.closing_cents).toBe(Math.round((100_000 * growth + 3 * firstYearContribution) * growth ** 99));
  }
});

test("M1 runs three distinct nominal scenarios on the same cent-exact basis", () => {
  const input = zeroM1();
  input.months = 240;
  input.opening_cents = 100_000;
  input.market.rates_bps = { cautious: -200, medium: 0, opportunity: 600 };
  const output = m1(input);
  for (const { scenario, months } of output.paths[0].result!) {
    expect(months).toHaveLength(240);
    const rate = input.market.rates_bps[scenario]!;
    expect(months.at(-1)).toMatchObject({
      month: "2046-12", net_cents: Math.round(100_000 * (1 + rate / 10_000) ** 20),
    });
  }
});

test("Half-cent output rounds up and does not round working balances each month", () => {
  const input = m2Fixture(0, modelFixture([0]));
  input.opening_cents = 1;
  input.market.crash = { month: "2027-01", equity_loss_bps: -5000 };
  expect(m2(input).paths[0].result?.scenarios[0].months[0].closing_cents).toBe(1);
  const savings = zeroM1();
  savings.opening_cents = 100;
  savings.months = 12;
  savings.market.rates_bps.cautious = 50;
  expect(m1(savings).paths[0].result?.[0].months[11].net_cents).toBe(101);
});
