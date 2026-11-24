import { jsonHash } from "../case/recovery-hash";
import { requireAvd } from "./avd-data";
import { publicCatalog } from "./catalog-validation";
import { MODEL_VERSIONS, type Ref } from "./identity-contract";
import { modelCatalog, resolveCost, resolvePath, type ModelCatalog } from "./model-catalog";
import { basisPoints, euros, monthlyFactor } from "./model-decimal";
import { SCALE } from "./projection-decimal";
import type { AllocationProfile, PortfolioCosts, ProductId } from "./premium-portfolio";
import type { Evidence, ProductVersion } from "./premium-contract";
import type { Channel } from "./source-contract";

export const WORKING_PRODUCT_IDS: readonly ProductId[] = Object.freeze(["basis", "pro", "garantie", "ruv-standard", "ruv-individuell", "ruv-garantie-80"]);
const identical = (a: Ref, b: Ref) => a.kind === b.kind && a.id === b.id && a.hash === b.hash && a.revision === b.revision;
export type CostChoice =
  | { readonly mode: "K1"; readonly cost: Ref<"cost"> | null; readonly scenario: Ref<"parameter"> | null }
  | { readonly mode: "K2"; readonly cost: Ref<"cost">; readonly scheduleVersion: string;
    readonly charges: readonly { readonly month: string; readonly cents: number; readonly allocationBps: readonly number[];
      readonly costComponent: string; readonly evidence: Evidence & { readonly class: "B" } }[] }
  | { readonly mode: "O" };

export function costsFor(catalog: ModelCatalog, mode: "M1" | "M2", id: ProductVersion, choice: CostChoice) {
  const at = "product.costs";
  const path = { id: id.product.id, product_ref: id.product, tariff_ref: id.tariff, cost_refs: [], scenario_cost_ref: null };
  resolvePath(catalog, path, mode, at);
  requireAvd(choice.mode !== "O", "COST_OPEN", at);
  if (choice.mode === "K1") {
    requireAvd(!("charges" in choice), "CONFLICTING_COST_MODES", at);
    if (catalog.catalog.origin === "working") requireAvd(
      WORKING_PRODUCT_IDS.some(product => product === id.product.id) && choice.cost !== null && choice.scenario === null,
      "WORKING_K1_REQUIRED", at);
    const cost = resolveCost(catalog, { ...path, cost_refs: choice.cost ? [choice.cost] : [], scenario_cost_ref: choice.scenario }, mode, at);
    return { mode: "K1" as const, ratio: cost.ratio, evidence: { class: cost.metadata.class,
      source: cost.metadata.parameter_ref.id, version: cost.metadata.parameter_ref.hash } };
  }
  requireAvd(mode === "M2", "UNSUPPORTED_M1_K2", at);
  requireAvd(!("scenario" in choice), "CONFLICTING_COST_MODES", at);
  const record = catalog.get(choice.cost, at);
  const terms = record.data;
  requireAvd(terms.mode === "K2" && terms.phase === "savings" && terms.status === "verified" && terms.coverage === "complete"
    && identical(terms.product, id.product) && identical(terms.tariff, id.tariff)
    && Boolean(choice.scheduleVersion) && terms.charges.every(entry => entry.timing.at === "after_return_before_payment"),
  "K2_COST_MECHANICS_OPEN", at);
  // K2 is applicable only for a complete, evidenced monthly debit schedule.
  // The approved catalogue supplies the fee mechanism, the schedule supplies
  // the calculated or booked debits and their actual allocation to positions.
  const byMonth = new Map<string, typeof choice.charges[number][]>();
  for (const entry of choice.charges) {
    const artifact = terms.charges.find(item => item.component === entry.costComponent
      && item.timing.from.slice(0, 7) <= entry.month && (item.timing.until === null || entry.month <= item.timing.until.slice(0, 7)));
    requireAvd(artifact && entry.evidence.class === "B" && entry.evidence.version && Number.isSafeInteger(entry.cents) && entry.cents >= 0,
      "K2_COST_EVENT_OPEN", at);
    const records = byMonth.get(entry.month) ?? [];
    requireAvd(!records.some(r => r.costComponent === entry.costComponent), "K2_COST_EVENT_COLLISION", at);
    byMonth.set(entry.month, [...records, entry]);
  }
  const chargeSchedule: PortfolioCosts = { mode: "K2", charges: (month, balance, currentContributions) => {
    const records = byMonth.get(month) ?? [];
    const due = terms.charges.filter(charge => {
      const start = charge.timing.from.slice(0, 7), end = charge.timing.until?.slice(0, 7);
      return month >= start && (!end || month <= end) && (charge.timing.frequency === "monthly"
        || charge.timing.frequency === "once" && month === start
        || charge.timing.frequency === "annual" && month.slice(5) === start.slice(5));
    });
    requireAvd(due.length === records.length, "K2_COST_SCHEDULE_OPEN", at);
    return due.map(charge => {
      const entry = records.find(item => item.costComponent === charge.component);
      requireAvd(entry, "K2_COST_SCHEDULE_OPEN", at);
      const parameter = catalog.get(charge.parameter, at).data;
      requireAvd(parameter.value.class === "B" && typeof parameter.value.value === "number", "K2_COST_BASIS_OPEN", at);
      if (charge.type === "fixed") {
        const cents = Number((parameter.value.value * 100).toFixed(8));
        requireAvd(Number.isSafeInteger(cents) && entry.cents === cents, "K2_COST_AMOUNT_CONFLICT", at);
      } else {
        const base = charge.basis === "balance" ? balance : charge.basis === "contribution" ? currentContributions : null;
        const ratio = parameter.value.value * 10000;
        requireAvd(base !== null && Number.isInteger(ratio), "K2_COST_BASIS_OPEN", at);
        const cent = SCALE / 100n;
        const expected = (base * basisPoints(ratio) + SCALE * cent / 2n) / (SCALE * cent);
        requireAvd(expected === BigInt(entry.cents), "K2_COST_AMOUNT_CONFLICT", at);
      }
      return { amount: euros(entry.cents), allocationBps: entry.allocationBps };
    });
  } };
  return { mode: "K2" as const, chargeSchedule, evidence: { class: "B" as const, source: record.id, version: jsonHash([record.hash, choice.scheduleVersion]) } };
}

export function validateAllocation(catalog: ModelCatalog, profile: AllocationProfile, product: ProductVersion, caseId: string) {
  const at = "profile";
  requireAvd(caseId === profile.caseId && profile.profileId && profile.profileVersion && profile.optionEvidence.version
    && product && identical(profile.product.product, product.product) && identical(profile.product.tariff, product.tariff),
  "PROFILE_SCOPE_OPEN", at);
  const tariff = resolvePath(catalog, { id: product.product.id, product_ref: product.product, tariff_ref: product.tariff,
    cost_refs: [], scenario_cost_ref: null }, "M2", at);
  if (catalog.catalog.origin === "working") {
    requireAvd(profile.model === product.product.id && profile.model !== "synthetic_reference", "PRODUCT_PROFILE_SCOPE", at);
  }
  const fundOptions = tariff.data.fundOptions;
  const positions = profile.positions;
  for (const position of positions) {
    if (position.fund) {
      const fund = catalog.get(position.fund, at);
      requireAvd(fundOptions.some(option => identical(option, position.fund!)) && fund.data.assetClass === position.assetClass,
        "TARIFF_FUND_SCOPE", at);
    }
  }
  requireAvd(new Set(positions.filter(p => p.fund).map(p => p.fund!.id)).size === positions.filter(p => p.fund).length,
    "TARIFF_FUND_DUPLICATE", at);
  const profileClass = profile.optionEvidence.class;
  switch (profile.model) {
    case "basis":
      requireAvd(["free", "basis_lifecycle"].includes(profile.option) && profileClass === "S", "BASIS_LIFECYCLE_OPEN", at);
      break;
    case "pro":
      requireAvd((profile.option === "pro_equity" && positions.every(p => p.assetClass === "equity")
        || profile.option === "stabilization_proxy") && profileClass === "S", "PRO_STABILIZATION_OPEN", at);
      break;
    case "garantie":
      requireAvd(profile.option === "guarantee_proxy" && profileClass === "S", "GUARANTEE_PROXY_OPEN", at);
      break;
    case "ruv-standard":
      requireAvd(profile.option === "free" && profileClass === "S" && positions.length === 2
        && (positions.every(p => p.fund) && fundOptions.length === 2 || positions.every(p => p.fund === null))
        && positions.some(p => p.assetClass === "equity") && positions.some(p => p.assetClass === "bond"),
      "STANDARD_TWO_FUNDS_OPEN", at);
      break;
    case "ruv-individuell": {
      requireAvd(fundOptions.length === 11 && positions.every(p => p.fund), "INDIVIDUAL_OPTIONS_OPEN", at);
      if (profile.option === "comfort") {
        const comfort = profile.comfort && catalog.get(profile.comfort, at);
        requireAvd(comfort && tariff.data.portfolios.some(ref => identical(ref, comfort)) && comfort.data.mode === "comfort"
          && comfort.data.weights.length === positions.length && profile.windows.length > 0, "COMFORT_OPTIONS_OPEN", at);
        const weights = positions.map(position => comfort.data.weights.find(item => identical(item.fund, position.fund!))?.basisPoints);
        requireAvd(profile.windows[0].targetWeightsBps.every((value, index) => value === weights[index])
          && profile.windows[0].cashflowWeightsBps.every((value, index) => value === weights[index]), "COMFORT_WEIGHTS_MISMATCH", at);
      } else {
        const first = profile.windows[0];
        requireAvd(profile.option === "free" && !profile.comfort && first
          && [...first.targetWeightsBps, ...first.cashflowWeightsBps].every(weight => weight % 1000 === 0),
        "INDIVIDUAL_APPLICATION_WEIGHT_STEP", at);
      }
      break;
    }
    case "ruv-garantie-80": {
      const secured = positions.findIndex(p => p.assetClass === "secured_assets");
      requireAvd(profile.option === "inflow_proxy" && profileClass === "S" && secured >= 0
        && positions.filter(p => p.assetClass === "secured_assets").length === 1
        && positions.some(p => p.fund) && positions.every((p, i) => i === secured || p.fund)
        && !profile.annualRebalance && profile.windows.every(window => window.openingAction === "CASHFLOW_ONLY"
          && window.cashflowWeightsBps[secured] === 8000), "GUARANTEE_INFLOW_PROXY_OPEN", at);
      break;
    }
    case "synthetic_reference":
      requireAvd(catalog.catalog.origin === "synthetic" && profileClass === "S", "SYNTHETIC_PROFILE_SCOPE", at);
  }
  return { ...profile, hash: jsonHash(profile) };
}

export function portfolioCostFactor(ratio: bigint): PortfolioCosts {
  return { mode: "K1", monthlyFactor: monthlyFactor(SCALE - ratio, "costs.ratio") };
}

/** The public product cannot carry working data while ORG-O01 is open. */
export function productChannelAllowed(catalog: ModelCatalog, channel: Channel) {
  return catalog.catalog.origin === "synthetic" && publicCatalog(catalog.catalog, channel).ok;
}

export function guaranteeFor(catalog: ModelCatalog, product: ProductVersion) {
  const record = catalog.get(product.product, "product.guarantee");
  const guarantee = record.data.guarantee;
  if (guarantee.kind === "none" || guarantee.kind === "open") return guarantee;
  const rate = catalog.get(guarantee.rate, "product.guarantee.rate");
  const value = rate.data.value;
  return { kind: guarantee.kind, basis: guarantee.basis, appliesAt: guarantee.appliesAt,
    referenceDate: guarantee.referenceDate, rate: value.class === "B" ? value.value : null,
    evidence: value.class === "B" ? { class: "B" as const, source: guarantee.evidence.id, version: guarantee.evidence.hash } : null,
    tariff: product.tariff };
}
