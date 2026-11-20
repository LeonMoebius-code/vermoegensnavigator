import {
  amountCents, avdRef, day, description, digest, id, integer, list, nullable, oneOf, revision, shape,
  type Rule, requireAvd,
} from "./avd-data";

import { MODEL_VERSIONS } from "./identity-contract";

export const MODEL_CORE_FORMAT = "avd.savings-model.v1" as const;
export const ASSET_CLASSES = ["equity", "bond", "cash", "commodity", "secured_assets"] as const;
export type AssetClass = typeof ASSET_CLASSES[number];
export const SCENARIOS = ["cautious", "medium", "opportunity"] as const;
const MAX_MODEL_MONTHS = 1200;

/** Editable S assumptions, in annual basis points. */
export const MODEL_M2_START_RATES = Object.freeze({
  cautious: Object.freeze({ equity: 200, bond: 100, cash: 100, commodity: -200, secured_assets: 100 }),
  medium: Object.freeze({ equity: 600, bond: 250, cash: 200, commodity: 300, secured_assets: 250 }),
  opportunity: Object.freeze({ equity: 900, bond: 400, cash: 300, commodity: 700, secured_assets: 350 }),
});

const asset = oneOf(...ASSET_CLASSES);
const month: Rule<string> = (value, at) => {
  requireAvd(typeof value === "string" && /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(value)
    && value >= "0100-01", "invalid_month", at);
  return value;
};
const annualRate = nullable(integer(-10_000, 100_000));
const assetRates = shape({
  equity: annualRate, bond: annualRate, cash: annualRate, commodity: annualRate, secured_assets: annualRate,
});
const market = {
  class: oneOf("S"), source_ref: avdRef("source"), reason: description,
};
const common = {
  format: oneOf(MODEL_CORE_FORMAT),
  catalog_ref: shape({ id, revision, hash: digest }),
  as_of: day,
  subject: nullable(shape({ person_id: id, contract_id: id })),
  start_month: month,
  months: integer(1, MAX_MODEL_MONTHS),
  opening_cents: amountCents,
  payments: list(shape({
    id, date: day, cents: amountCents,
    kind: oneOf("contribution", "special_payment", "grant"),
    grant: nullable(shape({ funding_year: integer(100, 9999), entitlement_id: id })),
  }), 4000),
};
const path = {
  id, product_ref: avdRef("product"), tariff_ref: avdRef("tariff"),
  cost_refs: list(avdRef("cost"), 2),
  scenario_cost_ref: nullable(avdRef("parameter")),
};
const weight = list(integer(0, 10_000), 16, 1);
const position = shape({
  asset_class: asset, fund_ref: nullable(avdRef("fund")),
  annual_rate_bps: nullable(shape({ cautious: annualRate, medium: annualRate, opportunity: annualRate })),
});
const profile = shape({
  kind: oneOf("basis", "pro", "garantie", "ruv-standard", "ruv-individuell", "ruv-garantie-80"),
  positions: list(position, 16, 1),
  target_weights_bps: weight,
  opening_weights_bps: nullable(weight),
  changes: list(shape({ month, weights_bps: weight }), 120),
  comfort_ref: nullable(avdRef("portfolio")),
  rebalancing: nullable(oneOf("annual", "none")),
});
const isCatalogInput: Rule<unknown> = value => value;

export const m1Input = shape({
  ...common,
  model_version: oneOf(MODEL_VERSIONS.M1),
  market: shape({
    ...market, basis: oneOf("gross", "net"),
    rates_bps: shape({ cautious: annualRate, medium: annualRate, opportunity: annualRate }),
  }),
  paths: list(shape(path), 6, 6),
  catalog: isCatalogInput,
});
export const m2Input = shape({
  ...common,
  model_version: oneOf(MODEL_VERSIONS.M2),
  market: shape({
    ...market, basis: oneOf("gross", "net"),
    rates_bps: shape({ cautious: assetRates, medium: assetRates, opportunity: assetRates }),
    crash: nullable(shape({ month, equity_loss_bps: integer(-10_000, 0) })),
  }),
  paths: list(shape({ ...path, profile: nullable(profile) }), 6, 1),
  catalog: isCatalogInput,
});

export type M1Input = ReturnType<typeof m1Input>;
export type M2Input = ReturnType<typeof m2Input>;
export type ModelPath = M1Input["paths"][number];
export type ModelPayment = M1Input["payments"][number];
export type Scenario = typeof SCENARIOS[number];

export function modelMonths(start: string, count: number) {
  const first = Number(start.slice(0, 4)) * 12 + Number(start.slice(5)) - 1;
  requireAvd(first + count <= 10_000 * 12, "calendar_overflow", "$.months");
  return Array.from({ length: count }, (_, index) => {
    const offset = first + index;
    return String(Math.floor(offset / 12)).padStart(4, "0") + "-" + String(offset % 12 + 1).padStart(2, "0");
  });
}
