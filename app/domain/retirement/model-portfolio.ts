import { requireAvd, unique } from "./avd-data";
import type { ModelCatalog } from "./model-catalog";
import { applyFactor, basisPoints, monthlyFactor, outputCents, splitBalance, sumBalances } from "./model-decimal";
import type { M2Input, Scenario } from "./model-input";
import type { TariffData } from "./catalog-contract";
import type { DeepReadonly } from "./identity-contract";
import { SCALE } from "./projection-decimal";

function checkWeights(weights: readonly number[], size: number, at: string) {
  requireAvd(weights.length === size && weights.reduce((sum, item) => sum + item, 0) === 10_000,
    "invalid_weights_total", at);
}

export function preparePortfolio(
  catalog: ModelCatalog, path: M2Input["paths"][number],
  tariff: DeepReadonly<TariffData>,
  months: readonly string[], at: string,
) {
  const profile = path.profile;
  const field = at + ".profile";
  requireAvd(profile, "portfolio_open", field);
  requireAvd(catalog.catalog.origin === "synthetic" || path.product_ref.id === profile.kind, "profile_scope", field + ".kind");
  requireAvd(profile.rebalancing !== null, "rebalancing_open", field + ".rebalancing");

  const { positions, target_weights_bps: targets, opening_weights_bps: opening, changes } = profile;
  checkWeights(targets, positions.length, field + ".target_weights_bps");
  if (opening) checkWeights(opening, positions.length, field + ".opening_weights_bps");
  unique(positions.map(position => position.fund_ref ? "fund:" + position.fund_ref.id : position.asset_class),
    field + ".positions");
  for (const [index, position] of positions.entries()) {
    const positionAt = field + ".positions." + index;
    if (position.fund_ref) {
      const fund = catalog.get(position.fund_ref, positionAt + ".fund_ref");
      requireAvd(tariff.fundOptions.some(ref => ref.hash === fund.hash), "tariff_fund_scope", positionAt + ".fund_ref");
      requireAvd(fund.data.assetClass === position.asset_class, "fund_asset_class", positionAt + ".asset_class");
    } else {
      requireAvd(!position.annual_rate_bps, "asset_class_assumption_required", positionAt + ".annual_rate_bps");
    }
  }

  const changesByMonth = new Map<string, readonly number[]>();
  for (const [index, change] of changes.entries()) {
    const changeAt = field + ".changes." + index;
    requireAvd(change.month > months[0] && change.month <= months[months.length - 1], "weight_change_out_of_period", changeAt + ".month");
    requireAvd(!changesByMonth.has(change.month), "duplicate_identity", changeAt + ".month");
    checkWeights(change.weights_bps, positions.length, changeAt + ".weights_bps");
    changesByMonth.set(change.month, change.weights_bps);
  }

  if (profile.kind === "ruv-individuell") {
    requireAvd(positions.every(position => position.fund_ref), "individual_funds_required", field + ".positions");
    if (profile.comfort_ref) {
      const comfort = catalog.get(profile.comfort_ref, field + ".comfort_ref");
      requireAvd(tariff.portfolios.some(ref => ref.hash === comfort.hash) && comfort.data.mode === "comfort",
        "comfort_scope", field + ".comfort_ref");
      requireAvd(catalog.catalog.origin === "synthetic" || comfort.citations.some(citation => {
        const authority = catalog.get(citation.source, field + ".comfort_ref").data.authority;
        return authority === "manufacturer_final" || authority === "manufacturer_provisional";
      }), "comfort_source_required", field + ".comfort_ref");
      requireAvd(comfort.data.weights.length === positions.length && positions.every((position, index) =>
        comfort.data.weights.some(weight => weight.fund.hash === position.fund_ref?.hash && weight.basisPoints === targets[index])),
      "comfort_weights_mismatch", field + ".target_weights_bps");
      requireAvd(changes.length === 0, "comfort_weight_change", field + ".changes");
    } else {
      requireAvd([targets, ...changesByMonth.values()].every(weights => weights.every(weight => weight % 1000 === 0)),
        "individual_weight_step", field + ".target_weights_bps");
    }
  } else {
    requireAvd(!profile.comfort_ref, "comfort_scope", field + ".comfort_ref");
  }

  if (profile.kind === "ruv-standard") {
    requireAvd(positions.length === 2 && positions.every(position => !position.fund_ref)
      && positions.some(position => position.asset_class === "equity")
      && positions.some(position => position.asset_class === "bond"),
    "standard_two_asset_classes_required", field + ".positions");
  }
  if (profile.kind === "ruv-garantie-80") {
    requireAvd(positions.some(position => position.asset_class === "secured_assets")
      && positions.some(position => position.asset_class !== "secured_assets"), "inflow_proxy_assets", field + ".positions");
    requireAvd(profile.rebalancing === "none" && changes.length === 0, "inflow_proxy_reallocation", field);
  }
  return { profile, changesByMonth, rebalancing: profile.rebalancing };
}

export function portfolioSeries(
  prepared: ReturnType<typeof preparePortfolio>, market: M2Input["market"], scenario: Scenario,
  months: readonly string[], openingCents: bigint, inflows: readonly bigint[], costFactor: bigint, at: string,
) {
  const { profile, changesByMonth, rebalancing } = prepared;
  const { positions, opening_weights_bps: opening } = profile;
  requireAvd(profile.kind !== "ruv-garantie-80" || openingCents === 0n || opening,
    "inflow_proxy_opening_weights_required", at + ".profile.opening_weights_bps");
  let weights = profile.target_weights_bps;
  let balances = splitBalance(openingCents, opening ?? weights);
  const heldInModel = (index: number) => weights[index] > 0 || (opening?.[index] ?? 0) > 0
    || [...changesByMonth.values()].some(change => change[index] > 0);
  const factors = positions.map((position, index) => {
    if (!heldInModel(index)) return SCALE;
    const custom = position.annual_rate_bps;
    const rate = custom ? custom[scenario] : market.rates_bps[scenario][position.asset_class];
    const rateAt = custom
      ? at + ".profile.positions." + index + ".annual_rate_bps." + scenario
      : "$.market.rates_bps." + scenario + "." + position.asset_class;
    requireAvd(rate !== null, "scenario_return_open", rateAt);
    return monthlyFactor(SCALE + basisPoints(rate), rateAt);
  });
  const crash = market.crash;
  return months.map((month, index) => {
    const change = changesByMonth.get(month);
    if (change) {
      weights = change;
      balances = splitBalance(sumBalances(balances), weights);
    }
    balances = balances.map((balance, i) => applyFactor(balance, factors[i]));
    if (crash?.month === month) {
      const equityFactor = SCALE + basisPoints(crash.equity_loss_bps);
      balances = balances.map((balance, i) =>
        positions[i].asset_class === "equity" ? applyFactor(balance, equityFactor) : balance);
    }
    const beforeCost = sumBalances(balances);
    balances = balances.map(balance => applyFactor(balance, costFactor));
    const cost = beforeCost - sumBalances(balances);

    const added = splitBalance(inflows[index], weights);
    balances = balances.map((balance, i) => balance + added[i]);
    const closing = sumBalances(balances);
    const rebalanced = rebalancing === "annual" && (index + 1) % 12 === 0;
    if (rebalanced) balances = splitBalance(closing, weights);
    const monthPath = at + ".months." + month;
    return {
      month, inflow_cents: outputCents(inflows[index], monthPath), cost_cents: outputCents(cost, monthPath),
      closing_cents: outputCents(closing, monthPath), weights_changed: change !== undefined, rebalanced,
      positions: balances.map(balance => outputCents(balance, monthPath)),
    };
  });
}
