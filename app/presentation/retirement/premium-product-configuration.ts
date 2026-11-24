import { jsonHash } from "../../domain/case/recovery-hash";
import { requireAvd } from "../../domain/retirement/avd-data";
import { modelIssue } from "../../domain/retirement/premium-contract";
import type { ModelCatalog } from "../../domain/retirement/model-catalog";
import type { CurveRequest } from "../../domain/retirement/premium-series";
import { monthIndex, type Timeline } from "../../domain/retirement/premium-calendar";
import type { ProductVersion } from "../../domain/retirement/premium-contract";
import type { AllocationProfile, CashflowOrder, MonthlyReturnPath, ProductId, StressEvent } from "../../domain/retirement/premium-portfolio";
import { guaranteeFor, type CostChoice } from "../../domain/retirement/premium-products";
import type { Preference } from "../../domain/retirement/premium-evidence";
import type { ChannelRights } from "../../domain/retirement/premium-session";
import type { Ref } from "../../domain/retirement/identity-contract";

type ProfileTemplate = Omit<AllocationProfile, "caseId" | "profileVersion" | "profileId">;

export interface PremiumProductPath {
  readonly selection: ProductId;
  readonly product: ProductVersion;
  readonly contractId?: string;
  readonly costM1: CostChoice;
  readonly costM2: CostChoice;
  readonly returns: MonthlyReturnPath;
  readonly options: readonly { readonly label: string; readonly profile: ProfileTemplate }[];
  readonly cashflowOrders: readonly CashflowOrder[];
  readonly facts?: readonly {
    readonly criterion: "no_contribution_guarantee" | "contribution_guarantee" | "value_protection_only" | "fund_plan" | "life_annuity";
    readonly established: boolean;
    readonly date: string;
    readonly source: Ref<"source">;
  }[];
}

/** Supplied by a trusted host. The public static entry supplies no catalogue or export rights. */
export interface PremiumWorkspace {
  readonly catalog: unknown;
  readonly scope: "internal" | "public";
  readonly rights: ChannelRights;
  readonly paths: readonly PremiumProductPath[];
}

export interface WeightChange {
  readonly month: string;
  readonly action: "CASHFLOW_ONLY" | "HOLDINGS_SWITCH" | "END_REBALANCE_ONLY";
  readonly weights: readonly string[];
}

export interface ProductConfiguration {
  readonly option: number;
  readonly version: string;
  readonly opening: readonly string[];
  readonly target: readonly string[];
  readonly inflows: readonly string[];
  readonly changes: readonly WeightChange[];
  readonly stressMonth: string;
  readonly stressLoss: string;
}

export const productPathKey = (path: PremiumProductPath) => jsonHash([path.product.product, path.product.tariff]);

export function selectProductOption(path: PremiumProductPath, option: number): ProductConfiguration {
  const template = path.options[option].profile;
  const start = template.windows[0];
  const percent = (values: readonly number[]) => values.map(value => String(value / 100));
  return { option, version: jsonHash([productPathKey(path), option]), opening: percent(template.openingWeightsBps),
    target: percent(start?.targetWeightsBps ?? []), inflows: percent(start?.cashflowWeightsBps ?? []),
    changes: [], stressMonth: "", stressLoss: "" };
}

function parseWeights(values: readonly string[], count: number) {
  const weights = values.map(value => {
    requireAvd(/^\d{1,3}(?:[.,]\d{1,2})?$/.test(value), "INVALID_WEIGHTS", "profile");
    const [whole, cents = ""] = value.split(/[.,]/);
    return Number(whole) * 100 + Number(cents.padEnd(2, "0"));
  });
  requireAvd(weights.length === count && weights.every(value => value <= 10000)
    && weights.reduce((sum, weight) => sum + weight, 0) === 10000, "INVALID_WEIGHTS", "profile");
  return weights;
}

export function parseStressLoss(input: string): number {
  const text = input.trim().replace(/^−/, "-").replace(/\s*%$/, "");
  requireAvd(/^-(?:\d{1,2}(?:[.,]\d{1,2})?|100(?:[.,]0{1,2})?)$/.test(text), "STRESS_LOSS_INVALID", "stress.loss");
  const [whole, fraction = ""] = text.slice(1).split(/[.,]/);
  const loss = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  requireAvd(loss > 0 && loss <= 10000, "STRESS_LOSS_INVALID", "stress.loss");
  return loss;
}

export function profileForProduct(path: PremiumProductPath, input: ProductConfiguration, caseId: string, timeline: Timeline) {
  const template = path.options[input.option]?.profile;
  requireAvd(template && template.windows.length, "PRODUCT_PROFILE_OPEN", "profile");
  const id = jsonHash([caseId, productPathKey(path)]);
  const version = jsonHash([input.version, template.option, template.option === "basis_lifecycle" ? timeline.payoutStart : null]);
  const evidence = { class: "S", source: "Modellentscheidung zur Anlageaufteilung", version } as const;
  const count = template.positions.length;
  const initial = template.windows[0];
  const openingWeightsBps = parseWeights(input.opening, count);
  const windows = [{ ...initial, fromMonth: timeline.valuationStart, evidence,
    targetWeightsBps: parseWeights(input.target, count), cashflowWeightsBps: parseWeights(input.inflows, count) }, ...template.windows.slice(1)];
  const endActions = [...template.endActions];
  const dated = [...input.changes].sort((left, right) => left.month.localeCompare(right.month));
  requireAvd(!dated.some(c => c.action !== "END_REBALANCE_ONLY")
    || template.option !== "basis_lifecycle" && template.windows.length === 1,
  "PROFILE_DATED_CHANGE_OPEN", "profile");
  for (const [index, change] of dated.entries()) {
    monthIndex(change.month);
    requireAvd(change.month >= timeline.valuationStart && change.month <= timeline.valuationEnd, "PROFILE_CHANGE_MONTH_OPEN", "profile");
    const weightsBps = parseWeights(change.weights, count);
    const orderId = jsonHash([id, index, change.month, change.action]);
    if (change.action === "END_REBALANCE_ONLY") {
      endActions.push({ actionId: orderId, externalId: orderId, month: change.month,
        weightsBps, evidence, overrideOf: null, revision: version });
    } else {
      const previous = windows.at(-1)!;
      requireAvd(change.month > previous.fromMonth && previous.toMonthExclusive === null, "PROFILE_DATED_CHANGE_CONFLICT", "profile");
      windows[windows.length - 1] = { ...previous, toMonthExclusive: change.month };
      windows.push({ id: orderId, fromMonth: change.month, toMonthExclusive: null, evidence,
        targetWeightsBps: change.action === "HOLDINGS_SWITCH" ? weightsBps : previous.targetWeightsBps,
        cashflowWeightsBps: weightsBps, openingAction: change.action });
    }
  }
  return { ...template, caseId, product: path.product, profileId: id, profileVersion: version,
    openingWeightsBps, windows, endActions, optionEvidence: evidence } satisfies AllocationProfile;
}

export function stressForProduct(profile: AllocationProfile, input: ProductConfiguration, timeline: Timeline): StressEvent | null {
  if (!input.stressMonth && !input.stressLoss) return null;
  monthIndex(input.stressMonth);
  requireAvd(input.stressMonth >= timeline.valuationStart && input.stressMonth <= timeline.valuationEnd, "STRESS_MONTH_OPEN", "stress");
  const lossBps = parseStressLoss(input.stressLoss);
  const id = jsonHash([profile.profileId, input.stressMonth, lossBps]);
  return { id, month: input.stressMonth, lossBps, evidence: { class: "S", source: "Gewählter Aktienverlust", version: id } };
}

export type Configurations = Readonly<Record<string, ProductConfiguration>>;

export interface ProductDraft {
  readonly paths: readonly PremiumProductPath[];
  readonly configurations: Configurations;
  readonly catalog: ModelCatalog;
}

export function productCurves(context: ProductDraft, timeline: Timeline, caseId: string,
  basis: Pick<CurveRequest, "valueBasis" | "perspective" | "returnEvidence" | "scenarioVersion">, annualBps: number) {
  const profiles: AllocationProfile[] = [];
  const curves: CurveRequest[] = [];
  for (const path of context.paths) {
    const key = productPathKey(path), configuration = context.configurations[key];
    const tariff = context.catalog.get(path.product.tariff, "product curves");
    const common = { ...basis, contractId: path.contractId ?? null };
    curves.push({ ...common, id: key + ":M1", label: "M1 · " + tariff.data.name,
      model: { mode: "M1", product: path.product, cost: path.costM1, annualBps } });
    const market = { mode: "M2" as const, product: path.product, returns: path.returns,
      cost: path.costM2, cashflowOrders: path.cashflowOrders };
    let profile: AllocationProfile | null = null;
    let profileIssue;
    if (configuration) {
      try {
        profile = profileForProduct(path, configuration, caseId, timeline);
        profiles.push(profile);
      } catch (error) { profileIssue = modelIssue(error); }
    }
    curves.push({ ...common, id: key + ":M2", label: "M2 · " + tariff.data.name, ...(profileIssue ? { blocked: profileIssue } : {}),
      model: { ...market, stress: null } });
    if (profile && configuration && (configuration.stressLoss || configuration.stressMonth)) {
      let stress = null;
      let stressIssue;
      try { stress = stressForProduct(profile, configuration, timeline); }
      catch (error) { stressIssue = modelIssue(error); }
      curves.push({ ...common, id: key + ":M2:stress", label: "M2 mit Stress · " + tariff.data.name,
        ...(stressIssue ? { blocked: stressIssue } : {}), model: { ...market, stress } });
    }
  }
  return { profiles, curves };
}

export function tariffFeature(path: PremiumProductPath, catalog: ModelCatalog, preference: Preference) {
  const makeEvidence = (ref: NonNullable<PremiumProductPath["facts"]>[number]["source"]) => {
    const source = catalog.get(ref, "preference source");
    return source.data.authority === "manufacturer_final" ? { class: "B" as const, source: source.id, version: source.hash } : null;
  };
  const date = preference.stichtag;
  const tariff = catalog.get(path.product.tariff, "preference tariff");
  const facts = (criterion: NonNullable<PremiumProductPath["facts"]>[number]["criterion"]) => {
    const matches = path.facts?.filter(fact => fact.criterion === criterion && fact.date === date) ?? [];
    const [fact] = matches;
    if (matches.length !== 1 || !fact) return null;
    const evidence = makeEvidence(fact.source);
    return evidence ? { value: fact.established, evidence } : null;
  };
  if (!date || date < tariff.validFrom || tariff.validTo !== null && date > tariff.validTo) return null;
  if (preference.criterion === "both_payouts_same_tariff") {
    const fund = facts("fund_plan"), annuity = facts("life_annuity");
    if (fund?.value === false) return fund;
    if (annuity?.value === false) return annuity;
    if (!fund || !annuity || !tariff.data.payouts.includes("fund_plan") || !tariff.data.payouts.includes("life_annuity")) return null;
    return { value: true, evidence: { class: "B" as const, source: fund.evidence.source + " + " + annuity.evidence.source,
      version: jsonHash([fund.evidence.version, annuity.evidence.version]) } };
  }
  if (preference.criterion === "fund_selection") return null;
  const guarantee = guaranteeFor(catalog, path.product);
  if (guarantee.kind === "none" || guarantee.kind === "open") {
    const negative = facts("no_contribution_guarantee");
    return negative?.value === true ? { ...negative, value: preference.criterion === "exclude_guarantee" } : null;
  }
  if (guarantee.kind === "value_protection_target") {
    const only = facts("value_protection_only");
    return only?.value === true ? { ...only, value: preference.criterion === "exclude_guarantee" } : null;
  }
  const maturity = facts("contribution_guarantee");
  if (maturity?.value !== true || guarantee.basis !== "own_and_grants"
    || !guarantee.evidence || typeof guarantee.rate !== "number") return null;
  return { value: preference.criterion === "exclude_guarantee" ? false : guarantee.rate >= .8,
    evidence: guarantee.evidence };
}
