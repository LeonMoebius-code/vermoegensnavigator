import { jsonHash } from "../case/recovery-hash";
import { requireAvd } from "./avd-data";
import { advanceSavingsMonth, basisPoints, euros, monthlyFactor, outputCents, signedOutputCents } from "./model-decimal";
import { SCALE } from "./projection-decimal";
import { valuationMonths, type Timeline } from "./premium-calendar";
import { deflatorFor, priceComparisonBasis, type PriceReservation } from "./premium-price";
import { modelIssue, open, type Cashflow, type Evidence, type FundingPerspective, type Open, type Outcome, type ProductVersion } from "./premium-contract";
import { deriveFunding, type FundingRegister } from "./premium-funding";
import { portfolioRows, type AllocationProfile, type CashflowOrder, type MonthlyReturnPath, type StressEvent } from "./premium-portfolio";
import { costsFor, guaranteeFor, portfolioCostFactor, validateAllocation, type CostChoice } from "./premium-products";
import type { ModelCatalog } from "./model-catalog";

export const CUSTOMER_RETURN = Object.freeze({ defaultText: "6,00", minBps: -1000, maxBps: 1500,
  sliderStepBps: 50, offsetsBps: Object.freeze([-300, 0, 300]) });

export function parseCustomerTotalReturn(text: string) {
  requireAvd(typeof text === "string" && /^-?\d{1,2}(?:[.,]\d{1,2})?$/.test(text), "TOTAL_RETURN_INVALID", "totalReturn");
  const [whole, fraction = ""] = text.replace("-", "").split(/[.,]/);
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  const signed = text.startsWith("-") && bps !== 0 ? -bps : bps;
  requireAvd(signed >= CUSTOMER_RETURN.minBps && signed <= CUSTOMER_RETURN.maxBps, "TOTAL_RETURN_RANGE", "totalReturn");
  return signed;
}

export type CurveMode =
  | { readonly mode: "NEUTRAL" | "ETF_BRUTTO"; readonly annualBps: number }
  | { readonly mode: "M1"; readonly annualBps: number; readonly product: ProductVersion; readonly cost: CostChoice }
  | { readonly mode: "M2"; readonly returns: MonthlyReturnPath; readonly product: ProductVersion; readonly cost: CostChoice;
    readonly stress: StressEvent | null; readonly cashflowOrders: readonly CashflowOrder[] };
export interface CurveRequest {
  readonly id: string;
  readonly scenarioVersion: string;
  readonly returnEvidence: Evidence & { readonly class: "S" };
  readonly perspective: FundingPerspective;
  readonly contractId: string | null;
  readonly valueBasis: "nominal" | "real";
  readonly model: CurveMode;
  readonly label?: string;
  readonly blocked?: Open;
}
export interface SavingsInputs {
  readonly caseId: string;
  readonly timeline: Timeline;
  readonly openingCents: number;
  readonly openingVersion: string;
  readonly own: readonly Cashflow[];
  readonly funding: FundingRegister | null;
  readonly profiles: readonly AllocationProfile[];
}

function paymentBasis(inputs: SavingsInputs, months: readonly string[], perspective: FundingPerspective, contractId: string | null) {
  const { own, timeline } = inputs;
  const { contributions } = timeline;
  const period = new Set(months);
  const ids = new Set<string>();
  for (const event of own) {
    requireAvd((event.kind === "regular" || event.kind === "special" || event.kind === "tax_reinvestment")
      && Boolean(event.id) && !ids.has(event.id) && period.has(event.month)
      && Number.isSafeInteger(event.cents) && event.cents >= 0 && event.amountEvidence.version, "OWN_PAYMENT_INVALID", event.id);
    if (event.kind === "regular") requireAvd(contributions.kind === "regular" && event.month >= contributions.first
      && event.month <= contributions.last, "REGULAR_PAYMENT_OUTSIDE_PLAN", event.id);
    ids.add(event.id);
  }
  let funding = null;
  if (perspective !== "OHNE_ZULAGEN" && inputs.funding) funding = deriveFunding(inputs.funding, {
    from: timeline.valuationStart, through: timeline.valuationEnd, lastFundingYear: timeline.finalFundingYear,
  });
  const side = funding?.perspectives[perspective];
  const fundingIssues = side?.issues ?? (perspective === "OHNE_ZULAGEN" ? [] : [open("FUNDING_SELECTION_OPEN", "funding")]);
  const scope = (payment: Cashflow) => (!contractId || payment.contractId === contractId) && !ids.has(payment.id);
  const grants = side?.payments.filter(scope) ?? [];
  requireAvd(!side?.payments.some(payment => ids.has(payment.id)), "PAYMENT_IDENTITY_CLASH", "funding");
  const ownScoped = own.filter(payment => !contractId || payment.contractId === null || payment.contractId === contractId);
  const hasReinvestment = ownScoped.some(payment => payment.kind === "tax_reinvestment");
  const all = [...ownScoped, ...grants];
  const byMonth = new Map<string, Cashflow[]>();
  for (const event of all) {
    const group = byMonth.get(event.month);
    if (group) group.push(event);
    else byMonth.set(event.month, [event]);
  }
  return { byMonth, ownScoped, grants, fundingIssues, hasReinvestment,
    dependency: jsonHash({ perspective, eventIds: all.map(item => item.id), own: ownScoped, funding: side ?? null }) };
}

function singleRateRows(months: readonly string[], opening: bigint, annualBps: number,
  cost: bigint, payments: ReadonlyMap<string, readonly Cashflow[]>) {
  requireAvd(Number.isSafeInteger(annualBps), "TOTAL_RETURN_INVALID", "totalReturn");
  const annual = SCALE + basisPoints(annualBps);
  const factor = monthlyFactor(annual - cost, "totalReturn"), grossFactor = monthlyFactor(annual, "totalReturn");
  let capital = opening, gross = opening;
  let blocked: Open | null = null;
  return months.map(month => {
    if (blocked) return { month, outcome: blocked } as const;
    const paid = (payments.get(month) ?? []).reduce((value, event) => value + euros(event.cents), 0n);
    capital = advanceSavingsMonth(capital, factor, paid);
    gross = advanceSavingsMonth(gross, grossFactor, paid);
    if (capital < 0n || gross < 0n) {
      blocked = open("UNTERDECKUNG", "cashflow", month);
      return { month, outcome: blocked } as const;
    }
    return { month, outcome: { status: "computed", total: capital, gross } } as const;
  });
}

export function calculateCurve(inputs: SavingsInputs, curve: CurveRequest, price: PriceReservation | null, catalog: ModelCatalog | null) {
  try {
    const { model } = curve;
    if (curve.blocked) return curve.blocked;
    if ((model.mode === "NEUTRAL" || model.mode === "ETF_BRUTTO") && ("stress" in model || "cost" in model))
      return open("MODE_COST_OR_STRESS_OPEN", "model");
    if (model.mode === "M1" && "stress" in model) return open("M1_STRESS_OPEN", "model");
    const months = valuationMonths(inputs.timeline);
    requireAvd(Number.isSafeInteger(inputs.openingCents) && inputs.openingCents >= 0 && inputs.openingVersion,
      "OPENING_INVALID", "openingCents");
    const opening = euros(inputs.openingCents);
    requireAvd(curve.returnEvidence.class === "S" && curve.returnEvidence.version && curve.scenarioVersion,
      "SCENARIO_OPEN", "scenarioVersion");
    requireAvd(curve.valueBasis !== "real" || price, "PRICE_OPEN", "price");
    if (model.mode === "ETF_BRUTTO") requireAvd(curve.perspective === "OHNE_ZULAGEN", "ETF_REFERENCE_UNFUNDED", "funding");
    const { byMonth, ownScoped, grants, fundingIssues, hasReinvestment, dependency } = paymentBasis(inputs, months, curve.perspective, curve.contractId);
    let profileIdentity: { id: string; version: string; hash: string; anchor: Timeline["payoutStart"] } | null = null;
    let productGuarantee: ReturnType<typeof guaranteeFor> | null = null;
    let costEvidence: Evidence | null = null;
    let costMode: "K1" | "K2" | "gross" = "gross";
    let portfolio: ReturnType<typeof portfolioRows> | null = null;
    let scalar: ReturnType<typeof singleRateRows> | null = null;
    if (model.mode === "NEUTRAL" || model.mode === "ETF_BRUTTO") {
      scalar = singleRateRows(months, opening, model.annualBps, 0n, byMonth);
    } else if (model.mode === "M1") {
      requireAvd(catalog, "PRODUCT_CATALOG_OPEN", "catalog");
      const cost = costsFor(catalog, "M1", model.product, model.cost);
      requireAvd(cost.mode === "K1", "UNSUPPORTED_M1_K2", "cost");
      costMode = cost.mode;
      costEvidence = cost.evidence;
      scalar = singleRateRows(months, opening, model.annualBps, cost.ratio, byMonth);
      productGuarantee = guaranteeFor(catalog, model.product);
    } else if (model.mode === "M2") {
      requireAvd(catalog, "PRODUCT_CATALOG_OPEN", "catalog");
      const configuration = inputs.profiles.filter(item => item.product.product.hash === model.product.product.hash
        && item.product.tariff.hash === model.product.tariff.hash);
      requireAvd(configuration.length === 1, "PRODUCT_PROFILE_OPEN", "profiles");
      const profile = validateAllocation(catalog, configuration[0], model.product, inputs.caseId);
      const anchor = profile.option === "basis_lifecycle" ? inputs.timeline.payoutStart : null;
      profileIdentity = { id: profile.profileId, version: anchor ? jsonHash([profile.profileVersion, anchor]) : profile.profileVersion,
        hash: anchor ? jsonHash([profile.hash, anchor]) : profile.hash, anchor };
      const cost = costsFor(catalog, "M2", model.product, model.cost);
      costMode = cost.mode;
      costEvidence = cost.evidence;
      productGuarantee = guaranteeFor(catalog, model.product);
      portfolio = portfolioRows({ months, timeline: inputs.timeline, opening, profile, returns: model.returns,
        stress: model.stress, costs: cost.mode === "K1" ? portfolioCostFactor(cost.ratio) : cost.chargeSchedule,
        payments: byMonth, cashflowOrders: model.cashflowOrders });
    }
    const deflate = curve.valueBasis === "real" ? deflatorFor(price!) : (value: bigint) => value;
    let ownCumulative = 0n, grantCumulative = 0n;
    const rows = months.map((month, index) => {
      const cashflows = byMonth.get(month) ?? [];
      for (const event of cashflows) {
        const amount = deflate(euros(event.cents), month);
        if (event.kind === "grant") grantCumulative += amount;
        else ownCumulative += amount;
      }
      const allocation = portfolio?.[index].outcome;
      const numeric = allocation ?? scalar?.[index].outcome;
      requireAvd(numeric, "MODEL_MODE_OPEN", "model.mode");
      const ownCents = signedOutputCents(ownCumulative, month), grantCents = signedOutputCents(grantCumulative, month);
      if (numeric.status === "O") return { month, balance: numeric, ownCents, grantCents } as const;
      const value = deflate(numeric.total, month);
      const gross = "gross" in numeric ? deflate(numeric.gross, month) : null;
      const portfolioState = allocation?.status === "computed" ? {
        positionCents: allocation.positionCents, actualWeights: allocation.actualWeights, stress: allocation.stress,
        profileWindowId: allocation.profileWindowId, targetWeightsBps: allocation.targetWeightsBps,
        cashflowWeightsBps: allocation.cashflowWeightsBps, endAction: allocation.endAction, bookedCostCents: allocation.bookedCostCents,
      } : null;
      return { month, balance: { status: "computed", cents: outputCents(value, month) }, ownCents, grantCents,
        grossCents: gross === null ? null : outputCents(gross, month),
        K1EndDifferenceCents: model.mode === "M1" && gross !== null ? signedOutputCents(gross - value, month) : null,
        portfolio: portfolioState } as const;
    });
    const specifiedEnd = rows.at(-1)!.balance;
    const end = fundingIssues.at(0) ?? specifiedEnd;
    const stressComparisonBasis = model.mode === "M2" ? jsonHash([inputs.caseId, inputs.timeline, inputs.openingVersion,
      inputs.openingCents, dependency, profileIdentity, model.product, model.cost, costEvidence, model.returns,
      model.cashflowOrders, curve.contractId, curve.scenarioVersion, curve.returnEvidence, curve.valueBasis,
      curve.valueBasis === "real" ? priceComparisonBasis(price) : null, catalog?.catalog.hash ?? null]) : null;
    const result = { stressComparisonBasis, stressEventId: model.mode === "M2" ? model.stress?.id ?? null : null, modelMode: model.mode, marketBasis: model.mode === "M2" ? jsonHash(model.returns) : model.annualBps, costMode, costEvidence, curveId: curve.id, label: curve.label ?? null, valueBasis: curve.valueBasis, profileIdentity,
      returnEvidence: curve.returnEvidence, scenarioVersion: curve.scenarioVersion, fundingPerspective: curve.perspective,
      price: curve.valueBasis === "real" ? price : null, openingCents: inputs.openingCents, paymentDependency: dependency,
      ownPaymentHash: jsonHash(ownScoped), ownPaymentEvents: ownScoped, grantEvents: grants, fundingIssues, productGuarantee,
      comparableOwnPayments: !hasReinvestment, rows,
      complete: end.status === "computed", end, specifiedEnd };
    return { status: "computed", evidence: curve.returnEvidence, value: result } as const satisfies Outcome<typeof result>;
  } catch (error) {
    return modelIssue(error);
  }
}

export function compareOwnBasis(left: ReturnType<typeof calculateCurve>, right: ReturnType<typeof calculateCurve>) {
  if (left.status === "O" || right.status === "O") return open("CURVE_OPEN", "comparison");
  const a = left.value, b = right.value;
  const amounts = (curve: typeof a) => curve.ownPaymentEvents.map(item => [item.month, item.cents]).sort();
  if (a.valueBasis !== b.valueBasis || jsonHash(a.price) !== jsonHash(b.price)
    || a.openingCents !== b.openingCents || a.costMode !== b.costMode || a.modelMode === "M2" || b.modelMode === "M2"
    || !a.comparableOwnPayments || !b.comparableOwnPayments || jsonHash(amounts(a)) !== jsonHash(amounts(b))
    || a.rows.length !== b.rows.length || a.rows[0]?.month !== b.rows[0]?.month
    || a.scenarioVersion !== b.scenarioVersion || a.marketBasis !== b.marketBasis) return open("PAYMENT_OR_MARKET_BASIS_DIFFERS", "comparison");
  if (!a.complete || !b.complete || a.end.status !== "computed" || b.end.status !== "computed") return open("CURVE_INCOMPLETE", "comparison");
  return { status: "computed", evidence: a.returnEvidence, value: a.end.cents - b.end.cents } as const;
}

export function calculateStressPair(inputs: SavingsInputs, stressed: CurveRequest, price: PriceReservation | null, catalog: ModelCatalog | null) {
  requireAvd(stressed.model.mode === "M2" && stressed.model.stress, "M2_STRESS_PROFILE_REQUIRED", "stress");
  const unstressed = { ...stressed, model: { ...stressed.model, stress: null } };
  const base = calculateCurve(inputs, unstressed, price, catalog);
  const stress = calculateCurve(inputs, stressed, price, catalog);
  return { base, stress, endDifferenceCents: stressEndDifference(base, stress), stressEventId: stressed.model.stress.id };
}

type CurveResult = ReturnType<typeof calculateCurve>;

export function stressEndDifference(base: CurveResult | undefined, stress: CurveResult) {
  if (base?.status !== "computed" || stress.status !== "computed") return null;
  const a = base.value, b = stress.value;
  if (!a.stressComparisonBasis || a.stressComparisonBasis !== b.stressComparisonBasis
    || a.stressEventId || !b.stressEventId || !a.complete || !b.complete
    || a.end.status !== "computed" || b.end.status !== "computed") return null;
  return a.end.cents - b.end.cents;
}

export function productStressDifference(results: readonly { readonly result: CurveResult }[], stress: CurveResult) {
  if (stress.status !== "computed" || !stress.value.stressEventId || !requiresStressComparison(stress.value.curveId)) return null;
  const baseId = stress.value.curveId.slice(0, -":stress".length);
  const [baseline, ...duplicates] = results.filter(item => item.result.status === "computed" && item.result.value.curveId === baseId);
  return duplicates.length === 0 ? stressEndDifference(baseline?.result, stress) : null;
}

export const requiresStressComparison = (curveId: string) => curveId.endsWith(":M2:stress");
