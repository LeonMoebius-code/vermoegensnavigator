import { jsonHash } from "../../domain/case/recovery-hash";
import { AvdError, requireAvd } from "../../domain/retirement/avd-data";
import { monthIndex, valuationMonths, type Timeline } from "../../domain/retirement/premium-calendar";
import type { Cashflow, Evidence, FundingPerspective } from "../../domain/retirement/premium-contract";
import { claimId, claimVersion, type Claim, type FundingRegister, type Hypothesis } from "../../domain/retirement/premium-funding";
import { DEFAULT_INFLATION } from "../../domain/retirement/premium-price";
import type { PremiumDraft } from "../../domain/retirement/premium-session";
import { CUSTOMER_RETURN, parseCustomerTotalReturn, type CurveRequest } from "../../domain/retirement/premium-series";
import { customerGrant, customerPayments, type CustomerPlan } from "./customer-plan-adapter";
import { parseEuroCents } from "./direct-grant-adapter";

export type SelectedFunding = { readonly basis: string; readonly caseId: string; readonly bookingMonth: string;
  readonly register: FundingRegister };

function fundingBasis(plan: CustomerPlan) {
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
  const version = crypto.randomUUID(), caseContract = `${caseId}:planned-contract`;
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
  readonly inflation: number; readonly compareWithout: boolean };

export function buildPremiumDraft(plan: CustomerPlan, caseId: string, caseRevision: string, terms: PremiumTerms,
  selection: SelectedFunding | null, dates?: Timeline): PremiumDraft {
  const start = plan.capital.start, end = plan.capital.end, selected = matchingFunding(plan, selection);
  const activeFunding = selected?.caseId === caseId ? selected.register : null;
  const timeline = dates ?? { valuationStart: start, valuationEnd: end, contributions: { kind: "regular", first: start, last: end },
    finalFundingYear: activeFunding?.hypothesis?.lastYear ?? null, payoutStart: null };
  const first = timeline.contributions.kind === "regular" ? timeline.contributions.first : timeline.valuationStart;
  const last = timeline.contributions.kind === "regular" ? timeline.contributions.last : timeline.valuationEnd;
  const months = valuationMonths(timeline);
  const shared = customerPayments({ ...plan,
    contribution: timeline.contributions.kind === "regular" ? plan.contribution : undefined,
    capital: { ...plan.capital, start: first, end: last,
      monthly: timeline.contributions.kind === "regular" ? plan.capital.monthly : "0" } });
  requireAvd(shared.status === "valid", "OWN_PAYMENT_INVALID", shared.status === "invalid_input" ? shared.field : "payments");
  const initial = parseEuroCents(plan.capital.initial);
  requireAvd(initial !== null, "OPENING_INVALID", "initial");
  const paymentEvidence: Evidence = { class: "S", source: "A2-savings-plan", version: jsonHash([start, end, shared, plan.capital.oneOffMonth]) };
  const own: Cashflow[] = [];
  const append = (month: string, cents: number, kind: Cashflow["kind"], id: string) => {
    own.push({ month, cents, kind, id, contractId: null, amountEvidence: paymentEvidence });
  };
  for (const month of months) if (timeline.contributions.kind === "regular" && month >= first && month <= last) {
    append(month, shared.monthly, "regular", `regular:${month}`);
  }
  if (timeline.contributions.kind === "regular" && shared.remainder > 0) append(shared.remainderMonth, shared.remainder, "regular", "first-year-remainder");
  if (plan.capital.oneOffEnabled) {
    const cents = parseEuroCents(plan.capital.oneOff);
    requireAvd(cents !== null, "OWN_PAYMENT_INVALID", "oneOff");
    append(plan.capital.oneOffMonth, cents, "special", "one-off");
  }
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
    if (terms.compareWithout && activeFunding) add("NEUTRAL", "OHNE_ZULAGEN", offset);
    if (plan.capital.referenceEnabled) add("ETF_BRUTTO", "OHNE_ZULAGEN", offset);
  }
  const inflation = terms.inflation === DEFAULT_INFLATION.bps ? DEFAULT_INFLATION : { bps: terms.inflation,
    evidence: { class: "S" as const, source: "A4-price", version: jsonHash([terms.inflation]) } };
  return { caseRevision, savings: { caseId, timeline, openingCents: initial, openingVersion: jsonHash(initial), own,
    funding: activeFunding, profiles: [] }, curves, price: { mode: "automatic" }, inflation };
}
