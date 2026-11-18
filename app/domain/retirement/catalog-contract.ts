import type { DeepReadonly, Kind, Model, Period, Ref } from "./identity-contract";
import type { Citation, ParameterValue, Publication, SourceData } from "./source-contract";
import type { CostData } from "./cost-contract";

export type Availability = {
  state: "announced" | "available" | "blocked" | "open";
  reason: string;
  evidence: Ref<"source"> | null;
};
export type Guarantee =
  | { kind: "none" }
  | { kind: "open"; reason: string }
  | {
      kind: "contribution_guarantee" | "value_protection_target";
      rate: Ref<"parameter">;
      basis: "own_and_grants" | "own_grants_and_extra" | "dated_value";
      appliesAt: "contract_maturity";
      referenceDate: string | null;
      evidence: Ref<"source">;
    };
export type Capability = {
  model: Model;
  version: string;
  status: "available" | "blocked";
  reason: string;
  requirements: {
    investment: Ref<"source">[];
    costs: Ref<"source">[];
    guarantee: Ref<"source">[];
    payout: Ref<"source">[];
    referenceCases: Ref<"source">[];
  };
};
export type ProductData = {
  name: string;
  manufacturerId: string;
  features: Ref<"parameter">[];
  manufacturer: Availability;
  bank: Availability;
  guarantee: Guarantee;
  capabilities: Capability[];
};
export type TariffData = {
  product: Ref<"product">;
  name: string;
  manufacturerCode: string | null;
  accessRules: Ref<"parameter">[];
  fundOptions: Ref<"fund">[];
  portfolios: Ref<"portfolio">[];
  payouts: ("fund_plan" | "life_annuity")[];
  annuityFactor: Ref<"parameter"> | null;
  manufacturer: Availability;
  bank: Availability;
};
export type FundData = {
  name: string;
  isin: string | null;
  assetClass: "equity" | "bond" | "cash" | "commodity" | "secured_assets";
  informationalTer: Ref<"parameter"> | null;
  manufacturer: Availability;
};
export type PortfolioData = {
  name: string;
  mode: "comfort" | "individual";
  weights: { fund: Ref<"fund">; basisPoints: number }[];
};
export type ParameterData = {
  name: string;
  /** Explicit use; a generic EUR amount is never an annuity factor. */
  purpose: "general" | "annuity_factor";
  productId: string | null;
  tariffId: string | null;
  phase: "savings" | "payout" | null;
  unit: "annual_ratio" | "ratio" | "eur" | "years" | "months" | "date";
  value: ParameterValue;
  models: { model: Model; version: string }[];
  approval: "approved" | "proposed" | "open";
  overridePolicy: "scenario" | "forbidden";
};
export type DataByKind = {
  source: SourceData; product: ProductData; tariff: TariffData; fund: FundData;
  portfolio: PortfolioData; parameter: ParameterData; cost: CostData;
};
export type CatalogRecord<K extends Kind = Kind> = K extends Kind ? Ref<K> & Period & {
  previous: Ref<K> | null;
  reviewedOn: string;
  changedOn: string;
  changedBy: string;
  publication: Publication;
  citations: Citation[];
  data: DataByKind[K];
} : never;
/** Retained objects + explicit current membership. No implicit latest-version lookup. */
export type Catalog = {
  format: "avd.catalog.v1";
  id: string;
  revision: number;
  previousHash: string | null;
  hash: string;
  origin: "synthetic" | "working";
  asOf: string;
  records: CatalogRecord[];
  current: Ref[];
};
export type ValidatedCatalog = DeepReadonly<Catalog>;
export type CaseOverride = {
  format: "avd.override.v1";
  id: string;
  caseId: string;
  base: Ref<"parameter">;
  value: { class: "S"; value: number | string; reason: string };
  recordedOn: string;
};
