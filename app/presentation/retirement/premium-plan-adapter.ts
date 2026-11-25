import { jsonHash } from "../../domain/case/recovery-hash";
import { AvdError, requireAvd } from "../../domain/retirement/avd-data";
import { monthIndex, valuationMonths, type Timeline } from "../../domain/retirement/premium-calendar";
import { newPremiumIdentity, type Cashflow, type Evidence, type FundingPerspective } from "../../domain/retirement/premium-contract";
import { claimId, claimVersion, type Claim, type FundingRegister, type Hypothesis } from "../../domain/retirement/premium-funding";
import { DEFAULT_INFLATION } from "../../domain/retirement/premium-price";
import type { PremiumDraft } from "../../domain/retirement/premium-session";
import { CUSTOMER_RETURN, parseCustomerTotalReturn, type CurveRequest } from "../../domain/retirement/premium-series";
import { customerGrant, customerPayments, editCustomerCapital, type CustomerPlan } from "./customer-plan-adapter";
import { fundingRegisterForCase } from "../../domain/retirement/premium-funding-input";
import type { BoundFundingEvidence } from "./premium-funding-evidence-panel";
import { productCurves, type ProductDraft } from "./premium-product-configuration";
import { parseEuroCents } from "./direct-grant-adapter";
import { resolvePremiumTimeline, type TimelineDraft } from "./premium-timeline";

export type SelectedFunding = { readonly basis: string; readonly caseId: string; readonly bookingMonth: string;
  readonly register: FundingRegister };

export function fundingBasis(plan: CustomerPlan) {
  return jsonHash({ start: plan.capital.start, end: plan.capital.end, evidence: plan.evidence, birthYear: plan.birthYear,
    funding: plan.funding, children: plan.children, cashflows: customerPayments(plan) });
}
export const matchingFunding = (plan: CustomerPlan, selected: SelectedFunding | null) =>
  selected && selected.basis === fundingBasis(plan) ? selected : null;

export function selectScenarioFunding(plan: CustomerPlan, caseId: string, bookingMonth: string): SelectedFunding | null {
  const trial = customerGrant(plan);
  if (trial.status !== "calculated") return null;
  const { result, input } = trial;
  try { monthIndex(bookingMonth); }
  catch (error) { if (error instanceof AvdError) return null; throw error; }
  if (Number(bookingMonth.slice(0, 4)) < input.contributionYear) return null;
  const version = newPremiumIdentity(), caseContract = `${caseId}:planned-contract`;
  const evidence = { class: "S" as const, source: input.ruleContext, version };
  const claims: Claim[] = [], events: Hypothesis[] = [];
  const add = (component: "base" | "child", childId: string | null, cents: number) => {
    const part = { id: `${component}:${childId ?? caseId}`, evidence, cents, contractId: caseContract,
      allocationVersion: version, allocationId: `${caseContract}:${childId ?? "base"}` };
    const claim: Claim = { key: { personId: caseId, year: input.contributionYear, component, childId, bonusLifetimeKey: null },
      claimRevision: version, regimeVersion: input.ruleContext,
      sourceVersion: result.ruleContext?.calculationVersion ?? input.ruleContext, amount: { cents, evidence }, eligibility: evidence,
      parts: [part], supersedes: null, reconciliationGroup: null };
    claims.push(claim);
    events.push({ id: `${version}:${part.id}`, month: bookingMonth, kind: "grant", cents, contractId: part.contractId,
      amountEvidence: evidence, claim: claimId(claim.key), claimVersion: claimVersion(claim), partId: part.id,
      allocationId: part.allocationId, allocationVersion: version, hypothesisVersion: version, scheduleRevision: version,
      confirmedBookingIds: [] });
  };
  add("base", null, result.baseGrantCents);
  for (const child of result.childGrants) add("child", child.childId, child.grantCents);
  return { basis: fundingBasis(plan), caseId, bookingMonth, register: {
    registerVersion: version, claims, activeClaimVersions: claims.map(claimVersion), booked: [], opening: null, disjointSettlements: [],
    hypothesis: { version, scheduleRevision: version, firstYear: input.contributionYear, lastYear: input.contributionYear, events },
  } };
}

export const DEFAULT_PREMIUM_TERMS = Object.freeze({ totalReturn: CUSTOMER_RETURN.defaultText, valueBasis: "nominal" as const,
  inflation: DEFAULT_INFLATION.bps, compareWithout: false });
export type PremiumTerms = { readonly totalReturn: string; readonly valueBasis: "nominal" | "real";
  readonly inflation: number; readonly inflationText?: string; readonly priceMonth?: string; readonly compareWithout: boolean };

/** Resolve the active payment plan without overwriting the stored regular draft. */
export function effectivePaymentPlan(plan: CustomerPlan, timeline: Timeline): CustomerPlan {
  valuationMonths(timeline);
  const horizon = timeline.contributions;
  if (horizon.kind === "regular") return editCustomerCapital(plan, {
    ...plan.capital, start: horizon.first, end: horizon.last,
  });
  return { ...plan, contribution: undefined, capital: { ...plan.capital,
    start: timeline.valuationStart, end: timeline.valuationEnd, monthly: "0" } };
}

/** A2 and A4 share the same date validation and effective payment arithmetic. */
export function timedPaymentBasis(plan: CustomerPlan, timing: TimelineDraft) {
  try {
    const timeline = resolvePremiumTimeline(plan, timing, null);
    const effective = effectivePaymentPlan(plan, timeline);
    return { timeline, effective, payments: customerPayments(effective), issue: null };
  } catch (error) {
    if (!(error instanceof AvdError)) throw error;
    const draft = customerPayments(plan);
    const issue = error.code === "END_OVERRIDE_CONFLICT" || error.code === "END_MONTH_OPEN"
      ? "Der letzte Sparmonat ist offen. Bitte klären Sie Spar-Endalter und Endmonat."
      : draft.status === "invalid_input" ? draft.message : "Der Zahlungs- oder Bewertungszeitraum ist offen. Bitte prüfen Sie die Termine.";
    return { timeline: null, effective: null, payments: draft.status === "invalid_input" ? draft :
      { status: "invalid_input" as const, field: "end" as const, message: issue }, issue };
  }
}

export function currentBoundFunding(plan: CustomerPlan, timeline: Timeline | null, bound: BoundFundingEvidence | null) {
  return Boolean(timeline && timeline.contributions.kind === "regular" && bound
    && customerPayments(effectivePaymentPlan(plan, timeline)).status === "valid"
    && bound.basis === fundingBasis(effectivePaymentPlan(plan, timeline)) && bound.opening === plan.capital.initial);
}

export function effectiveOwnPayments(plan: CustomerPlan, timeline: Timeline, bound: BoundFundingEvidence | null) {
  const effective = effectivePaymentPlan(plan, timeline);
  const shared = customerPayments(effective);
  requireAvd(shared.status === "valid", "OWN_PAYMENT_INVALID", shared.status === "invalid_input" ? shared.field : "payments");
  const months = valuationMonths(timeline);
  const paymentEvidence: Evidence = { class: "S", source: "A2-savings-plan", version: jsonHash([plan.capital.start, plan.capital.end, shared, plan.capital.oneOffMonth]) };
  const own: Cashflow[] = [];
  const append = (month: string, cents: number, kind: Cashflow["kind"], id: string) => {
    own.push({ month, cents, kind, id, contractId: null, amountEvidence: paymentEvidence });
  };
  const horizon = timeline.contributions;
  for (const month of months) if (horizon.kind === "regular" && month >= horizon.first && month <= horizon.last) {
    append(month, shared.monthly, "regular", `regular:${month}`);
  }
  if (horizon.kind === "regular" && shared.remainder > 0) append(shared.remainderMonth, shared.remainder, "regular", "first-year-remainder");
  if (plan.capital.oneOffEnabled) {
    const cents = parseEuroCents(plan.capital.oneOff);
    requireAvd(cents !== null, "OWN_PAYMENT_INVALID", "oneOff");
    append(plan.capital.oneOffMonth, cents, "special", "one-off");
  }
  if (bound?.data.ownPayments && currentBoundFunding(plan, timeline, bound)) {
    const period = new Set(months);
    return bound.data.ownPayments.filter(payment => period.has(payment.month));
  }
  // A dossier bound to the same draft remains the own-payment source in
  // holdings mode, but only dated special payments are active.
  if (horizon.kind === "holdings_only" && bound?.data.ownPayments
    && (bound.basis === fundingBasis(plan) || bound.holdingsBasis === fundingBasis(effective))
    && bound.opening === plan.capital.initial) {
    const period = new Set(months);
    return bound.data.ownPayments.filter(payment => period.has(payment.month)
      && payment.kind === "special");
  }
  return own;
}

export function buildPremiumDraft(plan: CustomerPlan, caseId: string, caseRevision: string, terms: PremiumTerms,
  selection: SelectedFunding | null, dates?: Timeline, bound: BoundFundingEvidence | null = null, product: ProductDraft | null = null): PremiumDraft {
  const start = plan.capital.start, end = plan.capital.end;
  const preliminary: Timeline = dates ?? { valuationStart: start, valuationEnd: end,
    contributions: { kind: "regular", first: start, last: end }, finalFundingYear: null, payoutStart: null };
  const effective = effectivePaymentPlan(plan, preliminary);
  const selected = preliminary.contributions.kind === "regular" ? matchingFunding(effective, selection) : null;
  const evidenceCurrent = currentBoundFunding(plan, preliminary, bound);
  const activeFunding = bound ? fundingRegisterForCase(bound.data, evidenceCurrent, bound.opening === plan.capital.initial)
    : selected?.caseId === caseId ? selected.register : null;
  const timeline = { ...preliminary, finalFundingYear: dates ? preliminary.finalFundingYear : activeFunding?.hypothesis?.lastYear ?? null };
  const own = effectiveOwnPayments(plan, timeline, bound);
  const initial = parseEuroCents(plan.capital.initial);
  requireAvd(initial !== null, "OPENING_INVALID", "initial");
  const rate = parseCustomerTotalReturn(terms.totalReturn);
  const marketVersion = jsonHash([rate, CUSTOMER_RETURN.offsetsBps]);
  const evidence = { class: "S" as const, source: "A4-total-return", version: marketVersion };
  const curves: CurveRequest[] = [];
  const add = (mode: "NEUTRAL" | "ETF_BRUTTO", perspective: FundingPerspective, offset: number) => {
    curves.push({ id: `${mode}:${perspective}:${offset}`, valueBasis: terms.valueBasis, scenarioVersion: marketVersion,
      returnEvidence: evidence, contractId: null, perspective, model: { mode, annualBps: rate + offset } });
  };
  for (const offset of CUSTOMER_RETURN.offsetsBps) {
    add("NEUTRAL", activeFunding ? "BEDINGT_KOMBINIERT" : "OHNE_ZULAGEN", offset);
    if (activeFunding?.booked.length) add("NEUTRAL", "NUR_BELEGTE_HISTORIE", offset);
    if (activeFunding && (terms.compareWithout || !activeFunding.hypothesis)) add("NEUTRAL", "OHNE_ZULAGEN", offset);
    if (plan.capital.referenceEnabled) add("ETF_BRUTTO", "OHNE_ZULAGEN", offset);
  }
  const configured = product ? productCurves(product, timeline, caseId, { valueBasis: terms.valueBasis,
    perspective: activeFunding ? "BEDINGT_KOMBINIERT" : "OHNE_ZULAGEN", scenarioVersion: marketVersion, returnEvidence: evidence }, rate) : null;
  if (configured) curves.push(...configured.curves);
  let inflationBps = terms.inflation;
  if (terms.valueBasis === "real" && terms.inflationText !== undefined) {
    requireAvd(/^-?\d{1,6}(?:[.,]\d{1,2})?$/.test(terms.inflationText), "INFLATION_OPEN", "price.inflation");
    const [whole, decimal = ""] = terms.inflationText.replace("-", "").split(/[.,]/);
    inflationBps = (Number(whole) * 100 + Number(decimal.padEnd(2, "0"))) * (terms.inflationText.startsWith("-") ? -1 : 1);
    requireAvd(inflationBps > -10000, "INFLATION_OPEN", "price.inflation");
  }
  const inflation = inflationBps === DEFAULT_INFLATION.bps ? DEFAULT_INFLATION : { bps: inflationBps,
    evidence: { class: "S" as const, source: "A4-price", version: jsonHash([inflationBps]) } };
  const price = terms.valueBasis === "real" && terms.priceMonth ? {
    mode: "manual" as const, month: terms.priceMonth, evidence: { class: "S" as const, source: "Gewählter Preisbezugsmonat", version: jsonHash(terms.priceMonth) },
  } : { mode: "automatic" as const };
  return { caseRevision, savings: { caseId, timeline, openingCents: initial, openingVersion: jsonHash(initial), own,
    funding: activeFunding, profiles: configured?.profiles ?? [] }, curves, price, inflation };
}
