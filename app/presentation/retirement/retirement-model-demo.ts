import { sha256 } from "../../domain/case/recovery-hash";
import type { Catalog, CatalogRecord, DataByKind } from "../../domain/retirement/catalog-contract";
import { MODEL_VERSIONS, reference, revisionHash, type Kind, type Ref } from "../../domain/retirement/identity-contract";
import { type M1Input, type M2Input, type ModelPayment } from "../../domain/retirement/model-input";
import { calculateM1, calculateM2, MODEL_CORE_FORMAT } from "../../domain/retirement/savings-model";

const edition = "ux2.demo.v1";
const asOf = "2026-11-20";
const models = [{ model: "M1", version: MODEL_VERSIONS.M1 }, { model: "M2", version: MODEL_VERSIONS.M2 }] as const;
export const demoExamples = {
  year: "12 Monate · drei Marktszenarien",
  control: "Ein Monat · Einfluss der Kostenformel",
  crash: "Ein Monat · Aktienrückgang und neue Rate",
  rebalance: "Zwölf Monate · jährliches Rebalancing",
} as const;
export type DemoExample = keyof typeof demoExamples;
export type ProductModel = "M1" | "M2";
export const demoProductName = (index: number) => `Demotarif ${index + 1}`;

function demoCatalog(zeroCost: boolean) {
  const catalogId = zeroCost ? "ux2-demo-catalog-zero" : "ux2-demo-catalog";
  const records: CatalogRecord[] = [];
  function add<K extends Kind>(kind: K, id: string, data: DataByKind[K], citations: CatalogRecord["citations"] = []): Ref<K> {
    const record = {
      kind, id, data, citations, revision: 1, hash: "", previous: null, validFrom: asOf, validTo: null,
      changedOn: asOf, reviewedOn: asOf, changedBy: edition,
      publication: { state: "released", channels: ["source", "display"], approval: {
        authority: "UX2 Demonstrationsdatensatz", record: edition, approvedOn: asOf,
      } },
    } as CatalogRecord<K>;
    const sealed = { ...record, hash: revisionHash(record) };
    records.push(sealed as CatalogRecord);
    return reference({ kind, id, revision: sealed.revision, hash: sealed.hash });
  }
  const source = add("source", "ux2-demo-scenarios", {
    title: "Frei gesetzte Demonstrationsannahmen", documentVersion: edition, documentHash: sha256(edition),
    authority: "scenario", issuedOn: asOf, purpose: "parameter",
  });
  const citations = [{ source, locator: "Synthetische Demonstrationsannahmen" }];
  const paths = [zeroCost ? 0 : .02, .01, .025, .03, .04, .05].map((cost, index) => {
    const id = `ux2-demo-${index + 1}`;
    const status = { state: "open" as const, reason: "Künstliche Demonstrationsidentität", evidence: null };
    const product = add("product", `${id}-product`, {
      name: `Demoprodukt ${index + 1}`, manufacturerId: "ux2-demo", features: [], manufacturer: status, bank: status,
      guarantee: { kind: "none" }, capabilities: [...models, { model: "M3", version: MODEL_VERSIONS.M3 } as const].map(({ model, version }) => ({
        model, version, status: model === "M3" ? "blocked" : "available", reason: "Ausschließlich synthetisch",
        requirements: { investment: [], costs: [], guarantee: [], payout: [], referenceCases: [] },
      })),
    }, citations);
    const tariff = add("tariff", `${id}-tariff`, {
      product, name: demoProductName(index), manufacturerCode: null, accessRules: [], fundOptions: [],
      portfolios: [], payouts: ["fund_plan"], annuityFactor: null, manufacturer: status, bank: status,
    }, citations);
    const parameter = add("parameter", `${id}-cost${zeroCost && index === 0 ? "-zero" : ""}`, {
      name: "Hypothetische jährliche Demokosten", purpose: "general", productId: product.id,
      tariffId: tariff.id, phase: "savings", unit: "annual_ratio", models: [...models], approval: "approved",
      value: { class: "S", value: cost, reason: "Frei gesetzter Demonstrationswert" }, overridePolicy: "scenario",
    }, citations);
    return { id, product_ref: product, tariff_ref: tariff, cost_refs: [], scenario_cost_ref: parameter };
  });
  const draft: Catalog = {
    format: "avd.catalog.v1", id: catalogId, revision: 1, previousHash: null, hash: "", origin: "synthetic",
    asOf, records, current: records.map(reference),
  };
  return { catalog: { ...draft, hash: revisionHash(draft) }, source, paths };
}

const payment = (month: string, cents: number): ModelPayment =>
  ({ id: `ux2-demo-payment-${month}`, date: `${month}-01`, cents, kind: "contribution", grant: null });

export function savingsDemoInputs(example: DemoExample, index: number) {
  const control = example === "control", crash = example === "crash", rebalance = example === "rebalance";
  const { catalog, source, paths } = demoCatalog(crash || rebalance);
  const { id, revision, hash } = catalog;
  const months = control || crash ? 1 : 12;
  const common = {
    format: MODEL_CORE_FORMAT, catalog_ref: { id, revision, hash }, as_of: asOf, catalog,
    subject: null, opening_cents: crash || rebalance ? 100_000 : 1_000_000,
    start_month: "2027-01", months,
    payments: control ? [] : crash ? [payment("2027-01", 10_000)] : rebalance ? [payment("2027-12", 12_400)]
      : Array.from({ length: 12 }, (_, i) => payment(`2027-${String(i + 1).padStart(2, "0")}`, 10_000)),
  };
  const market = { class: "S", source_ref: source, reason: demoExamples[example], basis: "gross" } as const;
  const equity = control ? [1000, 1000, 1000] : crash ? [0, 0, 0] : rebalance ? [2100, 2100, 2100] : [200, 600, 900];
  const bond = control || crash || rebalance ? [0, 0, 0] : [100, 250, 400];
  const assets = (i: number) => ({ equity: equity[i], bond: bond[i], cash: 0, commodity: 0, secured_assets: 0 });
  const inputsM1: M1Input = {
    ...common, model_version: MODEL_VERSIONS.M1,
    market: { ...market, rates_bps: { cautious: equity[0], medium: equity[1], opportunity: equity[2] } },
    paths,
  };
  const inputsM2: M2Input = {
    ...common, model_version: MODEL_VERSIONS.M2,
    market: { ...market, rates_bps: { cautious: assets(0), medium: assets(1), opportunity: assets(2) },
      crash: crash ? { month: "2027-01", equity_loss_bps: -3000 } : null },
    paths: [{ ...paths[index], profile: {
      kind: "pro",
      positions: control ? [{ asset_class: "equity", fund_ref: null, annual_rate_bps: null }] : [
        { asset_class: "equity", fund_ref: null, annual_rate_bps: null },
        { asset_class: "bond", fund_ref: null, annual_rate_bps: null },
      ],
      opening_weights_bps: null, target_weights_bps: control ? [10_000] : [6000, 4000],
      changes: [], comfort_ref: null, rebalancing: "annual",
    } }],
  };
  return { inputsM1, inputsM2, equity, bond };
}

export function computeSavingsDemo(mode: ProductModel, example: DemoExample, index: number) {
  const { inputsM1, inputsM2, equity, bond } = savingsDemoInputs(example, index);
  const snapshot = mode === "M1" ? calculateM1(JSON.stringify(inputsM1)) : calculateM2(JSON.stringify(inputsM2));
  const path = snapshot.ok ? snapshot.paths[mode === "M1" ? index : 0] : null;
  const rows = path?.result;
  const series = !rows ? [] : (Array.isArray(rows) ? rows : rows.scenarios).map(scenario => {
    let ownCents = 0;
    return scenario.months.map(row => ({
      month: row.month, cents: "net_cents" in row ? row.net_cents : row.closing_cents,
      ownCents: ownCents += row.inflow_cents,
    }));
  });
  return { snapshot, path, series, equity, bond, opening: inputsM1.opening_cents,
    gross: rows && Array.isArray(rows) ? rows.map(scenario => scenario.months.at(-1)?.gross_cents) : null,
    detail: rows && !Array.isArray(rows) ? rows.scenarios[1].months : null };
}
