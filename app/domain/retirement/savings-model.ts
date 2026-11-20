import { jsonHash } from "../case/recovery-hash";
import { AvdError, copyAvd, requireAvd, unique } from "./avd-data";
import { modelCatalog, resolveCost, resolvePath, type ModelCatalog } from "./model-catalog";
import { applyFactor, basisPoints, euros, monthlyFactor, outputCents } from "./model-decimal";
import {
  m1Input, m2Input, modelMonths, SCENARIOS, type M1Input, type M2Input, type ModelPath,
} from "./model-input";
import { preparePortfolio, portfolioSeries } from "./model-portfolio";
import { SCALE } from "./projection-decimal";
import { MODEL_VERSIONS } from "./identity-contract";
import type { ResultStatus } from "./source-contract";

export { MODEL_CORE_FORMAT, MODEL_M2_START_RATES } from "./model-input";

type Issue = { code: string; path: string };

function parseJson(input: unknown) {
  requireAvd(typeof input === "string", "json_text_required", "$");
  requireAvd(input.length <= 2_000_000, "input_limit", "$");
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new AvdError("invalid_json", "$");
  }
  return copyAvd(parsed);
}

function prepare(request: M1Input | M2Input) {
  const catalog = modelCatalog(request.catalog);
  const { id, revision, hash, asOf } = catalog.catalog;
  requireAvd(request.catalog_ref.id === id && request.catalog_ref.revision === revision
    && request.catalog_ref.hash === hash && request.as_of === asOf, "catalog_snapshot_mismatch", "$.catalog_ref");
  requireAvd(catalog.get(request.market.source_ref, "$.market.source_ref").data.authority === "scenario",
    "market_scenario_source_required", "$.market.source_ref");
  requireAvd(request.market.basis === "gross", "gross_returns_required", "$.market.basis");
  unique(request.paths.map(path => path.id), "$.paths");
  if (request.model_version === MODEL_VERSIONS.M1) unique(request.paths.map(path => path.product_ref.id), "$.paths");

  const months = modelMonths(request.start_month, request.months);
  const monthIndex = new Map(months.map((month, i) => [month, i]));
  const cents = months.map(() => 0n);
  const paymentIds = new Set<string>();
  const entitlements = new Set<string>();
  const payments = request.payments.map((payment, index) => {
    const path = "$.payments." + index;
    requireAvd(!paymentIds.has(payment.id), "duplicate_identity", path + ".id");
    paymentIds.add(payment.id);
    const bookedMonth = payment.date.slice(0, 7);
    const month = monthIndex.get(bookedMonth);
    requireAvd(month !== undefined, "payment_out_of_period", path + ".date");
    if (payment.kind === "grant") {
      requireAvd(payment.grant, "grant_provenance_required", path + ".grant");
      requireAvd(payment.grant.funding_year <= Number(bookedMonth.slice(0, 4)),
        "funding_year_after_booking", path + ".grant.funding_year");
      const key = JSON.stringify([payment.grant.funding_year, payment.grant.entitlement_id]);
      requireAvd(!entitlements.has(key), "duplicate_entitlement", path + ".grant.entitlement_id");
      entitlements.add(key);
    } else {
      requireAvd(!payment.grant, "grant_provenance_unexpected", path + ".grant");
    }
    cents[month] += BigInt(payment.cents);
    requireAvd(cents[month] <= BigInt(Number.MAX_SAFE_INTEGER), "inflow_out_of_range", path + ".cents");
    return { ...payment, booking_month: bookedMonth, class: "S" as const };
  });
  if ("crash" in request.market && request.market.crash) {
    requireAvd(monthIndex.has(request.market.crash.month), "crash_out_of_period", "$.market.crash.month");
  }

  const payment_hash = jsonHash({ subject: request.subject, payments });
  const scenario_hash = jsonHash(request.market);
  const basis = {
    model_version: request.model_version, as_of: request.as_of,
    opening_cents: request.opening_cents, start_month: request.start_month,
    end_month: months[months.length - 1], payment_hash, scenario_hash,
  };
  return {
    catalog, basis, payments, months, inflows: cents.map(euros),
    opening: euros(request.opening_cents),
  };
}

function issueOf(error: unknown): Issue {
  if (error instanceof AvdError) return { code: error.code, path: error.at };
  throw error;
}

function runPath<P extends ModelPath, T>(
  path: P, index: number, prepared: ReturnType<typeof prepare>, model: "M1" | "M2",
  calculate: (path: P, indexPath: string, catalog: ModelCatalog, tariff: ReturnType<typeof resolvePath>, ratio: bigint) => T,
) {
  const at = "$.paths." + index;
  const basis = prepared.basis;
  const metadata = {
    path_id: path.id, product_ref: path.product_ref, tariff_ref: path.tariff_ref,
    model_mode: model, model_version: basis.model_version,
    savings_cost_mode: "K1" as const,
    cost_convention: model === "M1" ? "M1_additive_v1" as const : "M2_balance_factor_v1" as const,
    cost_ref: path.cost_refs.length === 1 ? path.cost_refs[0] : null,
    scenario_cost_ref: path.scenario_cost_ref,
    dependency_hash: jsonHash({ format: "avd.savings-dependency.v1", basis, path }),
  };
  let cost: ReturnType<typeof resolveCost>["metadata"] | null = null;
  try {
    const tariff = resolvePath(prepared.catalog, path, model, at);
    const resolvedCost = resolveCost(prepared.catalog, path, model, at);
    cost = resolvedCost.metadata;
    return {
      ...metadata, status: "bedingt_berechnet" as const, cost, cost_class: cost.class,
      result: calculate(path, at, prepared.catalog, tariff, resolvedCost.ratio), issue: null,
    };
  } catch (error) {
    return {
      ...metadata, status: "nicht_berechenbar" as const,
      cost, cost_class: cost?.class ?? "O" as const, result: null, issue: issueOf(error),
    };
  }
}

function snapshot<T extends { dependency_hash: string; status: ResultStatus }>(
  request: M1Input | M2Input, prepared: ReturnType<typeof prepare>, paths: T[],
) {
  const complete = paths.every(path => path.status === "bedingt_berechnet");
  const snapshot_hash = jsonHash({
    format: "avd.savings-snapshot.v1", catalog_ref: request.catalog_ref,
    paths: paths.map(path => path.dependency_hash),
  });
  return {
    ok: true as const, complete, snapshot_hash,
    status: complete ? "bedingt_berechnet" as const : "nicht_berechenbar" as const,
    catalog_ref: request.catalog_ref, case_ref: null, comparison_ref: null,
    ...prepared.basis,
    subject: request.subject, assumption_refs: [request.market.source_ref],
    assumption_class: "S" as const, market: request.market, payments: prepared.payments,
    period_convention: "calendar_month_month_end_inflow_v1" as const,
    valuation: "nominal_eur_cents" as const,
    paths,
  };
}

function m1Series(request: M1Input, prepared: ReturnType<typeof prepare>, cost: bigint) {
  return SCENARIOS.map(scenario => {
    const at = "$.market.rates_bps." + scenario;
    const rate = request.market.rates_bps[scenario];
    requireAvd(rate !== null, "scenario_return_open", at);
    const annualGross = SCALE + basisPoints(rate);
    const netFactor = monthlyFactor(annualGross - cost, at);
    const grossFactor = monthlyFactor(annualGross, at);
    let gross = prepared.opening;
    let net = prepared.opening;
    return {
      scenario, gross_annual_rate_bps: rate,
      months: prepared.months.map((month, index) => {
        const inflow = prepared.inflows[index];
        gross = applyFactor(gross, grossFactor) + inflow;
        net = applyFactor(net, netFactor) + inflow;
        const monthAt = "$.months." + month;
        return {
          month, inflow_cents: outputCents(inflow, monthAt),
          gross_cents: outputCents(gross, monthAt), net_cents: outputCents(net, monthAt),
        };
      }),
    };
  });
}

/** Six K1 benchmarks on a single shared payment, period and scenario basis. */
export function calculateM1(inputJson: unknown) {
  try {
    const request = m1Input(parseJson(inputJson), "$");
    const prepared = prepare(request);
    const paths = request.paths.map((path, index) =>
      runPath(path, index, prepared, "M1", (_path, _at, _catalog, _tariff, ratio) => m1Series(request, prepared, ratio)));
    return snapshot(request, prepared, paths);
  } catch (error) {
    return { ok: false as const, issue: issueOf(error) };
  }
}

/** A set of independent K1 model portfolios with full monthly time series. */
export function calculateM2(inputJson: unknown) {
  try {
    const request = m2Input(parseJson(inputJson), "$");
    const prepared = prepare(request);
    const paths = request.paths.map((path, index) =>
      runPath(path, index, prepared, "M2", (modelPath, at, catalog, tariff, ratio) => {
        const portfolio = preparePortfolio(catalog, modelPath, tariff.data, prepared.months, at);
        const costFactor = monthlyFactor(SCALE - ratio, at + ".cost");
        return {
          profile: portfolio.profile, rebalancing: portfolio.rebalancing,
          scenarios: SCENARIOS.map(scenario => ({
            scenario,
            months: portfolioSeries(portfolio, request.market, scenario, prepared.months,
              prepared.opening, prepared.inflows, costFactor, at),
          })),
        };
      }));
    return snapshot(request, prepared, paths);
  } catch (error) {
    return { ok: false as const, issue: issueOf(error) };
  }
}
