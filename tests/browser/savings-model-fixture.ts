import type { Catalog, CatalogRecord } from "../../app/domain/retirement/catalog-contract";
import { MODEL_VERSIONS, reference, refKey, revisionHash, type Kind } from "../../app/domain/retirement/identity-contract";
import type { M1Input, M2Input, ModelPayment } from "../../app/domain/retirement/model-input";
import { MODEL_CORE_FORMAT } from "../../app/domain/retirement/savings-model";
import { record, reseal, syntheticCatalog } from "./avd-catalog-fixture";
import { mutable } from "./avd-p2-fixture";

const testCosts = [0.02, 0.027, 0.037, 0.041, 0.051, 0.062];
const approval = { authority: "Artificial fixture", record: "Synthetic test only", approvedOn: "2026-11-17" };

export function modelFixture(costs: readonly (number | null)[] = testCosts) {
  const catalog = syntheticCatalog();
  const scenario: CatalogRecord<"source"> = {
    ...structuredClone(record(catalog, "synthetic-source", "source")),
    id: "synthetic-model-scenario",
    data: {
      ...record(catalog, "synthetic-source", "source").data,
      title: "Artificial scenario assumptions",
      authority: "scenario",
    },
  };
  catalog.records.push(scenario);
  for (const [index, fallback] of testCosts.entries()) {
    const value = index < costs.length ? costs[index] : fallback;
    const parameter: CatalogRecord<"parameter"> = {
      ...structuredClone(record(catalog, "synthetic-cost-" + (index + 1), "parameter")),
      id: "synthetic-scenario-cost-" + (index + 1),
      citations: [{ source: reference(scenario), locator: "Artificial scenario inputs" }],
    };
    parameter.data.value = value === null
      ? { class: "O", value: null, reason: "Artificial pending input" }
      : { class: "S", value, reason: "Artificial editable annual cost" };
    parameter.data.approval = value === null ? "open" : "approved";
    catalog.records.push(parameter);
  }
  for (const entry of catalog.records) {
    entry.publication = { state: "released", channels: ["source", "asset", "display", "export"], approval };
  }
  catalog.current = catalog.records.map(reference);
  return reseal(catalog);
}

export function currentRef<K extends Kind>(catalog: Catalog, kind: K, id: string) {
  const ref = catalog.current.find(entry => entry.kind === kind && entry.id === id);
  if (!ref) throw new Error("Missing fixture reference " + id);
  return reference({ ...ref, kind });
}

const marketSource = (catalog: Catalog) => ({
  class: "S" as const,
  source_ref: currentRef(catalog, "source", "synthetic-model-scenario"),
  reason: "Artificial market assumptions",
  basis: "gross" as const,
});

function common(catalog: Catalog) {
  const { id, revision, hash } = catalog;
  return {
    format: MODEL_CORE_FORMAT, catalog_ref: { id, revision, hash }, as_of: catalog.asOf, catalog,
    subject: { person_id: "synthetic-person", contract_id: "synthetic-contract-basis" },
    opening_cents: 1_000_000, start_month: "2027-01", months: 1,
    payments: [] as ModelPayment[],
  };
}

function path(catalog: Catalog, index: number) {
  return {
    id: "path-" + index,
    product_ref: currentRef(catalog, "product", "synthetic-product-" + index),
    tariff_ref: currentRef(catalog, "tariff", "synthetic-tariff-" + index),
    cost_refs: [],
    scenario_cost_ref: currentRef(catalog, "parameter", "synthetic-scenario-cost-" + index),
  };
}

export function m1Fixture(catalog = modelFixture()) {
  return mutable<M1Input>({
    ...common(catalog), model_version: MODEL_VERSIONS.M1,
    market: { ...marketSource(catalog), rates_bps: { cautious: 1000, medium: 1000, opportunity: 1000 } },
    paths: Array.from({ length: 6 }, (_, index) => path(catalog, index + 1)),
  });
}

export function assetRates(equity = 0) {
  return { equity, bond: 0, cash: 0, commodity: 0, secured_assets: 0 };
}

export function m2Fixture(equity = 1000, catalog = modelFixture()) {
  return mutable<M2Input>({
    ...common(catalog), model_version: MODEL_VERSIONS.M2,
    market: { ...marketSource(catalog), rates_bps: {
      cautious: assetRates(equity), medium: assetRates(equity), opportunity: assetRates(equity),
    }, crash: null },
    paths: [{ ...path(catalog, 1), profile: {
      kind: "pro", positions: [{ asset_class: "equity", fund_ref: null, annual_rate_bps: null }],
      opening_weights_bps: null, target_weights_bps: [10_000], changes: [], comfort_ref: null, rebalancing: "annual",
    } }],
  });
}

export function balancedFixture(equity = 0) {
  const input = m2Fixture(equity, modelFixture([0]));
  input.opening_cents = 100_000;
  const profile = input.paths[0].profile!;
  profile.positions.push({ asset_class: "bond", fund_ref: null, annual_rate_bps: null });
  profile.target_weights_bps = [6000, 4000];
  return input;
}

export const payment = (date: string, cents = 10_000): ModelPayment =>
  ({ id: date, date, cents, kind: "contribution", grant: null });

export function revisedCost(catalog: Catalog, value: number) {
  const next = structuredClone(catalog);
  const prior = record(next, "synthetic-scenario-cost-1", "parameter");
  const revised = { ...prior, revision: 2, previous: reference(prior),
    data: { ...prior.data, value: { class: "S" as const, value, reason: "Artificial revised scenario" } } };
  Object.assign(revised, { hash: revisionHash(revised) });
  next.records.push(revised);
  next.current = next.current.map(ref => refKey(ref) === refKey(prior) ? reference(revised) : ref);
  next.revision += 1;
  next.previousHash = catalog.hash;
  next.hash = revisionHash(next);
  return next;
}
