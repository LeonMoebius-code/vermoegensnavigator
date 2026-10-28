import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { projectRetirement, compareRetirement } from "../../app/domain/retirement/projection";
import { ProjectionBudget, ProjectionStop, enforceOutputBytes, SCALE, point, checkedCent } from "../../app/domain/retirement/projection-decimal";
import * as C from "../../app/domain/retirement/projection-contract";

// Fixtures encode the frozen contract. Expected money below is fixed or independently
// counted; no production function generates an expected projection value.
type Mutable<T> = T extends readonly (infer U)[] ? Mutable<U>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
type Fixture = Mutable<C.ProjectionRequest>;
type Spec = Mutable<C.ProjectionSpec>;
type Grant = Mutable<C.GrantEvent>;
const k = <T>(value: T): { state: "known"; value: T } => ({ state: "known", value });
const J1 = "0.126825030131969720661201", J2 = "0.268241794562545318301696", J10 = "2.138428376721";
const JM1 = "-0.113615128283870719341199", J50 = "128.746337890625", C1 = "0.113615128283870719341199";
function clone<T>(v: T): Mutable<T> { return JSON.parse(JSON.stringify(v)) as Mutable<T>; }
function canonical(v: unknown): string {
  return JSON.stringify(v, (_, x: unknown) => x && typeof x === "object" && !Array.isArray(x)
    ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : x);
}
function source(id: string, kind: C.Source["kind"] = "model_assumption"): Mutable<C.Source> {
  return { sourceId: id, kind, quality: kind === "model_assumption" ? "hypothetical" : "confirmed", reference: "Q11: synthetic fixture only", version: "synthetic-v1", contentHash: null, checkedOn: null, effectiveFromMonth: null, effectiveToMonth: null };
}
function base(start = "2027-01", end = "2027-12"): Fixture {
  return { kind: "projection", versions: clone(C.PROJECTION_VERSIONS), output: { mode: "auto" }, sources: [], projection: { bindings: [], parameters: {
    projectionId: "synthetic-projection", instrument: "retirement_model", period: { startMonth: start, endMonth: end },
    initial: { balanceCents: k(0), valuationMonth: start, position: "immediately_before_start" }, rebalancing: "monthly_target_weight",
    contributionSchedule: [{ fromMonth: start, monthlyCents: k(10000) }], oneOffContributions: [], grantCoverage: { mode: "none_assumed", unresolvedContributionYears: [] }, grantEvents: [],
    marketSchedule: [{ fromMonth: start, equityAnnualReturn: k("0"), bondAnnualReturn: k("0") }], allocationSchedule: [{ fromMonth: start, equityWeight: k("1") }], stress: null,
    costs: { mode: "gross_plus_explicit_costs", coverage: "complete", annualRates: [{ fromMonth: start, effectiveAnnualReduction: k("0") }], fixedFees: [] },
  } } };
}
const p = (r: Fixture) => r.projection.parameters;
function gross(r: Fixture): Mutable<C.GrossCosts> {
  const costs = p(r).costs;
  if (costs.mode !== "gross_plus_explicit_costs") throw new Error("fixture mode");
  return costs;
}
function cash(r: Fixture, balance: number, monthly = 0) { p(r).initial.balanceCents = k(balance); p(r).contributionSchedule[0].monthlyCents = k(monthly); }
function rates(r: Fixture, equity: string, bond = "0") { p(r).marketSchedule[0].equityAnnualReturn = k(equity); p(r).marketSchedule[0].bondAnnualReturn = k(bond); }
function quote(r: Fixture, q: string) { p(r).allocationSchedule[0].equityWeight = k(q); }
function crash(r: Fixture, shock = "-0.3", month = p(r).period.startMonth) { p(r).stress = { month, equityShock: k(shock) }; }
function grant(id: string, cents: number, month: string, year = 2027, actual = false, day = month + "-31"): Grant {
  return { eventId: id, grantKey: { personId: "person", contractId: "contract", contributionYear: year, component: "base", childId: null }, cents,
    amountBasis: actual ? "actual_booking_confirmed" : "hypothetical_amount", externalRule: null, sourceBookingRef: actual ? "booking-" + id : null,
    booking: { basis: actual ? "actual_date_confirmed" : "hypothetical_month_end", month, referenceDate: actual ? day : null } };
}
function prepareBound(bound: Mutable<C.BoundProjection>, pool: Map<string, Mutable<C.Source>>) {
  const spec = bound.parameters, paths = ["/period", "/initial", "/rebalancing", "/grantCoverage", "/stress", "/costs"];
  for (const key of ["contributionSchedule", "oneOffContributions", "grantEvents", "marketSchedule", "allocationSchedule"] as const) spec[key].forEach((_, i) => paths.push(`/${key}/${i}`));
  if (spec.costs.mode === "gross_plus_explicit_costs") { spec.costs.annualRates.forEach((_, i) => paths.push(`/costs/annualRates/${i}`)); spec.costs.fixedFees.forEach((_, i) => paths.push(`/costs/fixedFees/${i}`)); }
  bound.bindings = paths.sort().map(path => {
    let ids = ["assumption"];
    if (/^\/grantEvents\/\d+$/.test(path)) {
      const g = spec.grantEvents[Number(path.split("/").at(-1))];
      if (g.amountBasis === "actual_booking_confirmed") { const id = "evidence-" + g.eventId; pool.set(id, source(id, "booking_evidence")); ids = [id]; }
      if (g.amountBasis === "external_rule_result") { const id = "rule-" + g.eventId; pool.set(id, source(id, "external_rule_result")); ids.push(id); }
      if (g.booking.basis === "pib_may15_month_end_illustration") { pool.set("official", source("official", "official_rule")); ids.push("official"); }
    }
    return { path, sourceIds: ids.sort() };
  });
}
function ready(r: Fixture): Fixture {
  const f = clone(r), pool = new Map([["assumption", source("assumption")]]);
  prepareBound(f.projection, pool); f.sources = [...pool.values()].sort((a, b) => a.sourceId < b.sourceId ? -1 : 1); return f;
}
function run(r: Fixture): C.Response { return projectRetirement(canonical(ready(r))); }
function result(r: Fixture): C.ProjectionResult {
  const out = run(r); expect(["calculated", "partial", "review_required"]).toContain(out.status); expect(out.projectionResults).toHaveLength(1); return out.projectionResults[0];
}
function cents(m: C.MoneyMetric): number { if (!("displayCents" in m)) throw new Error("Expected value, got " + JSON.stringify(m)); return m.displayCents; }
const end = (r: Fixture) => cents(result(r).summary.completeEndBalance);
function error(r: Fixture, code: C.IssueCode, status = "review_required") { const z = run(r); expect(z.status).toBe(status); expect(z.primaryIssue?.code).toBe(code); return z; }
function detailed(r: C.ProjectionResult): readonly C.MonthRow[] { expect(r.ledger?.mode).toBe("detailed"); return r.ledger?.mode === "detailed" ? r.ledger.rows : []; }
function comparisonFixture(r = base(), referenceEdit?: (x: Spec) => void): Mutable<C.ComparisonRequest> {
  const pool = new Map([["assumption", source("assumption")]]);
  const scenarios = ["a", "b", "c"].map(scenarioId => {
    const retirement = clone(r.projection), reference = clone(r.projection);
    retirement.parameters.projectionId = "retirement-" + scenarioId;
    reference.parameters.projectionId = "reference-" + scenarioId; reference.parameters.instrument = "unfunded_reference";
    reference.parameters.grantEvents = []; reference.parameters.grantCoverage = { mode: "none_assumed", unresolvedContributionYears: [] };
    referenceEdit?.(reference.parameters);
    prepareBound(retirement, pool); prepareBound(reference, pool);
    return { scenarioId, retirement, reference };
  });
  return { kind: "comparison", versions: clone(C.PROJECTION_VERSIONS), output: clone(r.output), sources: [...pool.values()].sort((a, b) => a.sourceId < b.sourceId ? -1 : 1), scenarios };
}

test("AP03a F01: 12 exact zero-return contributions", () => {
  const z = result(base()); expect(cents(z.summary.completeEndBalance)).toBe(120000);
  expect(cents(z.summary.totals.totalOwn)).toBe(120000); expect(detailed(z).map(x => cents(x.closingBalance))).toEqual([10000,20000,30000,40000,50000,60000,70000,80000,90000,100000,110000,120000]);
});
test("AP03a F02: October has exactly three contributions", () => { expect(end(base("2027-10"))).toBe(30000); });
test("AP03a F03: dated one-off and contribution change", () => {
  const r = base("2027-10"); p(r).contributionSchedule.push({ fromMonth: "2027-11", monthlyCents: k(20000) }); p(r).oneOffContributions.push({ eventId: "one", month: "2027-11", cents: 50000 });
  expect(detailed(result(r)).map(x => cents(x.closingBalance))).toEqual([10000,80000,100000]);
});
test("AP03a F04: end-of-month monomials", () => { const r = base("2027-10"); rates(r, J1); expect(end(r)).toBe(30301); });
test("AP03a F05: annual 12 percent is not 1 percent monthly", () => { const r = base(); cash(r, 100000); rates(r, "0.12"); expect(end(r)).toBe(112000); expect(end(r)).not.toBe(112683); });
test("AP03a F06: negative geometric year", () => { const r = base(); cash(r, 100000); rates(r, JM1); expect(end(r)).toBe(88638); });
test("AP03a F07: annual total loss needs timing", () => { const r = base(); cash(r, 100000); rates(r, "-1"); error(r, "annual_total_loss_timing_required"); });
test("AP03a F08: actual May, hypothetical June, unknown coverage preserve grants", () => {
  const a = base("2028-01", "2028-12"); cash(a, 0); rates(a, J1); p(a).grantCoverage.mode = "complete_events"; p(a).grantEvents = [grant("z",12000,"2028-05",2027,true)];
  expect(end(a)).toBe(12866); const b = clone(a); p(b).grantEvents = [grant("z",12000,"2028-06")]; expect(end(b)).toBe(12738);
  p(b).grantCoverage.mode = "none_assumed"; expect(end(b)).toBe(12738);
  p(a).grantCoverage = { mode:"unknown", unresolvedContributionYears:[2028] }; const partial = result(a);
  expect(partial.status).toBe("partial"); expect(cents(partial.summary.specifiedEndBalance)).toBe(12866); expect(cents(partial.summary.totals.specifiedAllowances)).toBe(12000); expect(partial.summary.completeEndBalance.status).toBe("review_required");
});
test("AP03a F09: no pull-forward of after-end grants", () => { const r = base(); cash(r,0); p(r).grantEvents=[grant("z",12000,"2028-06")]; const z=result(r); expect(cents(z.summary.completeEndBalance)).toBe(0); expect(z.excludedEvents.map(x=>x.cents)).toEqual([12000]); expect(cents(z.summary.totals.specifiedAllowances)).toBe(0); });
test("AP03a F10: one known grant in all three coverage modes, never repeated", () => {
  const r=base("2027-01","2028-12"); cash(r,0); p(r).grantEvents=[grant("z",12000,"2027-12",2026,true)];
  for(const mode of ["none_assumed","complete_events"] as const){p(r).grantCoverage.mode=mode;expect(end(r)).toBe(12000);}
  p(r).grantCoverage={mode:"unknown",unresolvedContributionYears:[2027,2028]};const z=result(r);expect(z.status).toBe("partial");expect(cents(z.summary.specifiedEndBalance)).toBe(12000);expect(z.summary.completeEndBalance.status).toBe("review_required");
});
test("AP03a F11: actual midmonth date retains monthly abstraction",()=>{const r=base("2028-01","2028-12");cash(r,0);rates(r,J1);p(r).grantEvents=[grant("z",12000,"2028-05",2027,true,"2028-05-15")];expect(end(r)).toBe(12866);});
test("AP03a F12: effective annual balance reduction",()=>{const r=base();cash(r,1000000);gross(r).annualRates[0].effectiveAnnualReduction=k("0.01");const z=result(r);expect(cents(z.summary.completeEndBalance)).toBe(990000);expect(cents(z.summary.totals.totalCostAmount)).toBe(10000);});
test("AP03a F13: net return, no invented euro-cost amount",()=>{const r=base();cash(r,1000000);rates(r,"-0.01","-0.01");p(r).costs={mode:"net_return",coverage:"all_costs_included"};const z=result(r);expect(cents(z.summary.completeEndBalance)).toBe(990000);expect(z.summary.totals.totalCostAmount.status).toBe("review_required");expect(cents(z.summary.totals.deductionInThisCalculation)).toBe(0);});
test("AP03a F14: costs after returns and before deposits",()=>{const r=base("2027-01","2027-01");cash(r,100000,10000);rates(r,J10);gross(r).annualRates[0].effectiveAnnualReduction=k(C1);expect(end(r)).toBe(118900);});
test("AP03a F15: funded fixed fee and insufficient fee basis",()=>{const r=base("2027-01","2027-01");cash(r,100000,10000);gross(r).fixedFees=[{eventId:"fee",month:"2027-01",cents:500,sourceBookingRef:null}];expect(end(r)).toBe(109500);cash(r,0,10000);error(r,"insufficient_fee_basis");});
test("AP03a F16: effective costs are not a balance fee",()=>{const r=base();cash(r,1000000);gross(r).coverage="effective_cost_only";gross(r).annualRates=[];error(r,"effective_cost_not_balance_fee");p(r).costs={mode:"gross_only",costKnowledge:"unknown"};const z=result(r);expect(cents(z.summary.beforeCostEndBalance)).toBe(1000000);expect(z.summary.afterCostEndBalance.status).toBe("review_required");});
test("AP03a F17: unknown cost is not zero",()=>{const r=base();cash(r,1000000);gross(r).coverage="unknown";gross(r).annualRates=[];error(r,"cost_source_unknown");p(r).costs={mode:"gross_only",costKnowledge:"not_assessed"};expect(end(r)).toBe(1000000);expect(result(r).summary.totals.totalCostAmount.status).toBe("review_required");});
test("AP03a F18: crash touches 100/50/0 percent stock, never new deposits",()=>{for(const [q,w]of [["1",80000],["0.5",95000],["0",110000]] as const){const r=base("2027-01","2027-01");cash(r,100000,10000);quote(r,q);crash(r);expect(end(r)).toBe(w);}});
test("AP03a F19: stress on post-return equity",()=>{const r=base("2027-01","2027-01");cash(r,100000,10000);rates(r,J10);quote(r,"0.5");crash(r);const z=result(r);expect(cents(z.summary.completeEndBalance)).toBe(98500);expect(cents(z.summary.totals.stressLoss)).toBe(16500);});
test("AP03a F20: one-month crash and explicit later return",()=>{const r=base("2027-01","2027-02");cash(r,100000,10000);p(r).marketSchedule.push({fromMonth:"2027-02",equityAnnualReturn:k(J10),bondAnnualReturn:k("0")});crash(r);expect(detailed(result(r)).map(x=>cents(x.closingBalance))).toEqual([80000,98000]);});
test("AP03a F21: dated total equity loss retains later contribution",()=>{const r=base("2027-01","2027-01");cash(r,100000,10000);crash(r,"-1");expect(end(r)).toBe(10000);});
test("AP03a F22: monthly rebalancing is not buy-and-hold",()=>{const r=base("2027-01","2027-02");cash(r,100000);rates(r,J10);quote(r,"0.5");expect(end(r)).toBe(110250);});
test("AP03a F23: component roots before monthly weighting",()=>{const r=base();cash(r,100000);rates(r,"0.12");quote(r,"0.5");expect(end(r)).toBe(105844);});
test("AP03a F24: allocation changes only from selected month",()=>{const r=base("2027-01","2027-02");cash(r,100000);rates(r,J1,J2);p(r).allocationSchedule.push({fromMonth:"2027-02",equityWeight:k("0")});expect(end(r)).toBe(103020);});
test("AP03a F25: same own contributions, subsidy only in retirement model",()=>{const r=base("2027-10");p(r).grantEvents=[grant("z",12000,"2027-12")];const z=compareRetirement(canonical(comparisonFixture(r)));expect(z.status).toBe("calculated");expect(z.projectionResults.map(x=>cents(x.summary.completeEndBalance))).toEqual([42000,30000,42000,30000,42000,30000]);expect(z.comparisonResults.map(x=>cents(x.completeDifference))).toEqual([12000,12000,12000]);});
test("AP03a F26: identical neutral paths have identical balances",()=>{const z=compareRetirement(canonical(comparisonFixture(base("2027-10"))));expect(z.projectionResults.map(x=>cents(x.summary.completeEndBalance))).toEqual([30000,30000,30000,30000,30000,30000]);});
test("AP03a F27: no monthly cent rounding",()=>{const r=base("2027-01","2027-02");cash(r,1);rates(r,J50);const z=result(r);expect(cents(z.summary.completeEndBalance)).toBe(2);expect("interval"in z.summary.completeEndBalance&&z.summary.completeEndBalance.interval.lowerEuro).toBe("0.0225");});
test("AP03a F28: exact half-cent half-even and explicit display residual",()=>{const r=base("2027-01","2027-01");cash(r,1);rates(r,"-0.999755859375");expect(end(r)).toBe(0);rates(r,J50);const z=result(r);expect(cents(z.summary.completeEndBalance)).toBe(2);expect(cents(z.summary.displayRoundingResidual)).toBe(1);});
test("AP03a F29: no reinterpretation of external subcent",()=>{const r=ready(base());p(r).grantEvents=[grant("z",6000.5,"2027-12")];const out=projectRetirement(canonical(r));expect(out.status).toBe("invalid_input");expect(out.primaryIssue?.code).toBe("invalid_value");const u=base();p(u).grantCoverage={mode:"unknown",unresolvedContributionYears:[2027]};expect(result(u).summary.completeEndBalance.status).toBe("review_required");});
test("AP03a F30: actual booking replaces, never adds to same grant key",()=>{const r=base("2027-01","2027-01");cash(r,0);p(r).grantEvents=[grant("a",12000,"2027-01"),grant("b",12000,"2027-01",2027,true)];error(r,"duplicate_identity","invalid_input");p(r).grantEvents.shift();expect(end(r)).toBe(12000);});
test("AP03a F31: near total loss retains positive internal amount",()=>{const r=base();cash(r,100000);rates(r,"-0.999999");const z=result(r);expect(cents(z.summary.completeEndBalance)).toBe(0);if("interval"in z.summary.completeEndBalance){expect(Number(z.summary.completeEndBalance.interval.lowerEuro)).toBeGreaterThan(0);expect(Number(z.summary.completeEndBalance.interval.lowerEuro)).toBeLessThanOrEqual(0.001);expect(Number(z.summary.completeEndBalance.interval.upperEuro)).toBeGreaterThanOrEqual(0.001);}});
test("AP03a F32: extreme valid annual return, no plausibility clamp",()=>{const r=base();cash(r,100000);rates(r,"100");expect(end(r)).toBe(10100000);});
test("AP03a F33: exact safe-cent maximum and controlled overflow",()=>{const r=base("2027-01","2027-01");cash(r,Number.MAX_SAFE_INTEGER);expect(end(r)).toBe(Number.MAX_SAFE_INTEGER);p(r).contributionSchedule[0].monthlyCents=k(1);error(r,"numeric_domain_exceeded");});
test("AP03a F34: independently balanced mixed month",()=>{const r=base("2027-01","2027-01");cash(r,100000,10000);rates(r,J1,J1);quote(r,"0.5");crash(r);p(r).oneOffContributions=[{eventId:"one",month:"2027-01",cents:5000}];p(r).grantEvents=[grant("z",2000,"2027-01",2026,true)];gross(r).annualRates[0].effectiveAnnualReduction=k(C1);gross(r).fixedFees=[{eventId:"fee",month:"2027-01",cents:500,sourceBookingRef:null}];const z=result(r);expect(cents(z.summary.completeEndBalance)).toBe(101492);expect("interval"in z.summary.completeEndBalance&&z.summary.completeEndBalance.interval.lowerEuro).toBe("1014.915");expect(z.summary.balanceCheck?.status).toBe("interval_consistent");});
test("AP03a F35: prospective cost change",()=>{const r=base("2027-01","2027-02");cash(r,100000);quote(r,"0");gross(r).annualRates.push({fromMonth:"2027-02",effectiveAnnualReduction:k(C1)});expect(end(r)).toBe(99000);});
test("AP03a F36: first and last partial calendar years",()=>{expect(end(base("2027-12","2028-02"))).toBe(30000);});
test("AP03a F37: full calendar zero path uses 120 compact blocks",()=>{const r=base("0100-01","9999-12");cash(r,0);const z=result(r);expect(z.period.monthCount).toBe(118800);expect(cents(z.summary.completeEndBalance)).toBe(0);expect(z.ledger?.mode).toBe("compact");if(z.ledger?.mode==="compact"){expect(z.ledger.blocks).toHaveLength(120);expect(z.ledger.blockSizeMonths).toBe(990);}});
test("AP03a F38: exactly 1200 detail rows",()=>{const r=base("0100-01","0199-12");cash(r,0);expect(detailed(result(r))).toHaveLength(1200);});
test("AP03a F39: 1201 months are not a calendar error",()=>{const r=base("0100-01","0200-01");cash(r,0);const z=result(r);expect(z.ledger?.mode).toBe("compact");if(z.ledger?.mode==="compact"){expect(z.ledger.blockSizeMonths).toBe(11);expect(z.ledger.blocks).toHaveLength(110);expect(z.ledger.blocks.at(-1)?.monthCount).toBe(2);}});
test("AP03a F40: detailed and compact have identical summaries",()=>{const r=base();cash(r,100000,1000);rates(r,J1);const a=result(r);r.output.mode="compact";const b=result(r);expect(b.summary).toEqual(a.summary);});
test("AP03a F41: full calendar one-cent contributions",()=>{const r=base("0100-01","9999-12");cash(r,0,1);const z=result(r);expect(cents(z.summary.completeEndBalance)).toBe(118800);expect(cents(z.summary.totals.totalOwn)).toBe(118800);if(z.ledger?.mode==="compact")expect(z.ledger.blocks.map(x=>cents(x.totals.totalOwn))).toEqual(Array(120).fill(990));else throw new Error("compact expected");});
test("AP03a F42: six full calendars, 712800 month steps",()=>{const r=base("0100-01","9999-12");cash(r,0);const z=compareRetirement(canonical(comparisonFixture(r)));expect(z.status).toBe("calculated");expect(z.projectionResults).toHaveLength(6);expect(z.projectionResults.reduce((n,x)=>n+x.period.monthCount,0)).toBe(712800);expect(z.projectionResults.map(x=>cents(x.summary.completeEndBalance))).toEqual([0,0,0,0,0,0]);expect(z.comparisonResults.map(x=>cents(x.completeDifference))).toEqual([0,0,0]);});
test("AP03a F43: explicit PIB May15 reference is monthly hypothetical",()=>{const r=base("2028-01","2028-12");cash(r,0);rates(r,J1);const g=grant("z",12000,"2028-05");g.booking.basis="pib_may15_month_end_illustration";g.booking.referenceDate="2028-05-15";p(r).grantEvents=[g];expect(end(r)).toBe(12866);});
test("AP03a F44: explicitly add 80, never repeat 120",()=>{const r=base("2027-01","2028-12");cash(r,0);p(r).grantEvents=[grant("a",12000,"2027-12",2026,true),grant("b",8000,"2028-05",2027)];expect(end(r)).toBe(20000);});

test("AP03a N01: strict cents, finite and no coercion",()=>{for(const value of [-1,0.5,"100",null]){const r=ready(base());(p(r).initial.balanceCents as unknown as {value:unknown}).value=value;const raw=canonical(r);const z=projectRetirement(raw);expect(z.status).toBe("invalid_input");}expect(projectRetirement(canonical(ready(base())).replace('"value":0','"value":-0')).primaryIssue?.code).toBe("invalid_value");for(const v of [NaN,Infinity])expect(projectRetirement(v as unknown as string).primaryIssue?.code).toBe("invalid_type");});
test("AP03a N02: calendar bounds, ordering, no daily coercion",()=>{for(const start of ["0099-01","10000-01","2027-00","2027-13","2027-10-28"]){const r=base();p(r).period.startMonth=start;expect(run(r).status).toBe("invalid_input");}const r=base("2027-12","2027-11");expect(run(r).primaryIssue?.code).toBe("invalid_calendar");});
test("AP03a N03: overlarge inputs and annual rate",()=>{const r=base();cash(r,9007199254740992);expect(run(r).primaryIssue?.code).toBe("invalid_value");cash(r,0);rates(r,"1000000.0001");expect(run(r).primaryIssue?.code).toBe("invalid_value");});
test("AP03a N04: financial domains",()=>{for(const val of ["-1.01","1000001","1e3","-0"]){const r=base();rates(r,val);expect(run(r).status).toBe("invalid_input");}for(const val of ["-0.01","1.01"]){const r=base();quote(r,val);expect(run(r).status).toBe("invalid_input");}for(const val of ["-1.01","0.01"]){const r=base();crash(r,val);expect(run(r).status).toBe("invalid_input");}});
test("AP03a N05: absent required structure differs from unknown fact",()=>{const r=ready(base());delete(p(r) as unknown as Record<string,unknown>).allocationSchedule;expect(projectRetirement(canonical(r)).primaryIssue?.code).toBe("invalid_shape");const u=base();p(u).initial.balanceCents={state:"unknown",reason:"missing"};const z=error(u,"input_fact_unknown");expect(z.projectionResults[0].summary.totals.totalOwn.status).not.toBe("review_required");});
test("AP03a N06: no last-write-wins schedule or event identity",()=>{const r=base();p(r).contributionSchedule.push(clone(p(r).contributionSchedule[0]));expect(run(r).status).toBe("invalid_input");const e=base();p(e).oneOffContributions=[{eventId:"x",month:"2027-01",cents:1},{eventId:"x",month:"2027-02",cents:2}];expect(run(e).primaryIssue?.code).toBe("duplicate_identity");});
test("AP03a N07: out-of-window own flow and stress",()=>{for(const month of ["2026-12","2028-01"]){const r=base();p(r).oneOffContributions=[{eventId:"one",month,cents:100}];expect(run(r).status).toBe("invalid_input");const c=base();crash(c,"-0.3",month);expect(run(c).status).toBe("invalid_input");}});
test("AP03a N08: net mode rejects any explicit cost payload",()=>{const r=ready(base());p(r).costs={mode:"net_return",coverage:"all_costs_included"};(p(r).costs as unknown as Record<string,unknown>).annualRates=[];expect(projectRetirement(canonical(r)).primaryIssue?.code).toBe("invalid_shape");});
test("AP03a N09: cannot finance early fee from late contribution",()=>{const r=base("2027-01","2027-01");cash(r,100,10000);gross(r).fixedFees=[{eventId:"fee",month:"2027-01",cents:200,sourceBookingRef:null}];const z=error(r,"insufficient_fee_basis");expect(z.projectionResults[0].ledger).toBeNull();});
test("AP03a N10: zero getter/proxy calls at primitive boundary",()=>{let calls=0;const target={get x(){calls++;throw new Error("getter");}};const prox=new Proxy({}, {get(){calls++;throw new Error("get");},ownKeys(){calls++;throw new Error("keys");},getPrototypeOf(){calls++;throw new Error("proto");},getOwnPropertyDescriptor(){calls++;throw new Error("descriptor");}});for(const x of [target,prox,new String("{}"),()=>0,null]){const z=projectRetirement(x as unknown as string);expect(z.primaryIssue?.code).toBe("invalid_type");expect(z.requestHash).toBeNull();}expect(calls).toBe(0);});
test("AP03a N11: unknown fields, proto, noncanonical whitespace",()=>{const r=ready(base());const data=JSON.parse(canonical(r)) as Record<string,unknown>;data.extra=1;expect(projectRetirement(canonical(data)).primaryIssue?.code).toBe("invalid_shape");const raw=canonical(r);expect(projectRetirement(" "+raw).primaryIssue?.code).toBe("noncanonical_json");expect(projectRetirement(raw.replace('"initial":{','"initial":{"__proto__":null,')).primaryIssue?.code).toBe("invalid_shape");});
test("AP03a N12: entry resources controlled before computation",()=>{const r=base();p(r).oneOffContributions=Array.from({length:10001},(_,i)=>({eventId:"e"+String(i).padStart(5,"0"),month:"2027-01",cents:0}));const z=run(r);expect(z.status).toBe("resource_error");expect(z.primaryIssue?.code).toBe("entry_limit");expect(z.projectionResults).toEqual([]);});
test("AP03a N13: a root interval straddles an exact half-cent boundary",()=>{const r=base("2027-01","2027-01");cash(r,100);rates(r,"0.061677811864499568789707617431640626");error(r,"precision_ambiguous");});
test("AP03a N14: safe inputs, unsafe resulting balance",()=>{const r=base("2027-01","2027-01");cash(r,Number.MAX_SAFE_INTEGER,1);const z=error(r,"numeric_domain_exceeded");expect(z.projectionResults[0].summary.completeEndBalance.status).toBe("review_required");});
test("AP03a N15: comparison basis mismatch never destroys valid projections",()=>{const r=comparisonFixture(base(),spec=>{spec.contributionSchedule[0].monthlyCents=k(10100);});const z=compareRetirement(canonical(r));expect(z.status).toBe("partial");expect(z.comparisonResults.every(x=>x.primaryIssue?.code==="basis_mismatch")).toBe(true);expect(z.projectionResults.every(x=>x.status==="calculated")).toBe(true);});
test("AP03a N16: versions, absent mandatory source metadata, missing binding",()=>{const r=ready(base());r.versions.modelVersion="other-v1";expect(projectRetirement(canonical(r)).primaryIssue?.code).toBe("version_not_supported");const s=ready(base());delete(s.sources[0]as unknown as Record<string,unknown>).version;expect(projectRetirement(canonical(s)).primaryIssue?.code).toBe("invalid_shape");const b=ready(base());b.projection.bindings=b.projection.bindings.filter(x=>x.path!=="/initial");const z=projectRetirement(canonical(b));expect(z.primaryIssue?.code).toBe("evidence_required");});
test("AP03a N17: total cost reduction and unsupported costing are review",()=>{const r=base();gross(r).annualRates[0].effectiveAnnualReduction=k("1");error(r,"cost_rate_total_loss_timing_required");gross(r).annualRates[0].effectiveAnnualReduction=k("0");gross(r).coverage="unsupported_type";error(r,"cost_type_not_supported");});
test("AP03a N18: none_assumed cannot also leave open years",()=>{const r=base();p(r).grantEvents=[grant("z",12000,"2027-12")];p(r).grantCoverage.unresolvedContributionYears=[2028];expect(run(r).primaryIssue?.code).toBe("inconsistent_input");});
test("AP03a N19: unknown requires a concrete unresolved year",()=>{const r=base();p(r).grantCoverage.mode="unknown";expect(run(r).primaryIssue?.code).toBe("inconsistent_input");});
test("AP03a N20: detailed1201 gives resource, auto succeeds",()=>{const r=base("0100-01","0200-01");cash(r,0);r.output.mode="detailed";error(r,"detail_rows_limit","resource_error");r.output.mode="auto";expect(run(r).status).toBe("calculated");});
test("AP03a N21: full calendar detail failure does not shorten horizon",()=>{const r=base("0100-01","9999-12");cash(r,0);r.output.mode="detailed";const z=error(r,"detail_rows_limit","resource_error");expect(z.projectionResults).toEqual([]);});
test("AP03a N22: exact inclusive input byte boundary",()=>{const z=projectRetirement(" ".repeat(16777217));expect(z.status).toBe("resource_error");expect(z.primaryIssue?.code).toBe("input_bytes_limit");expect(z.requestHash).toBeNull();expect(projectRetirement(" ".repeat(16777216)).primaryIssue?.code).toBe("invalid_json");});
test("AP03a N23: bounded JSON depth",()=>{expect(projectRetirement("[".repeat(17)+"0"+"]".repeat(17)).primaryIssue?.code).toBe("input_depth_limit");expect(projectRetirement("[".repeat(16)+"0"+"]".repeat(16)).primaryIssue?.code).toBe("invalid_shape");});
test("AP03a N24: duplicated keys and exponent spellings never normalized",()=>{const raw=canonical(ready(base()));const dup=raw.replace('"balanceCents":{','"balanceCents":{"state":"known","value":999},"balanceCents":{');expect(projectRetirement(dup).primaryIssue?.code).toBe("noncanonical_json");const exp=raw.replace('"value":10000','"value":1e4');expect(projectRetirement(exp).primaryIssue?.code).toBe("noncanonical_json");});
test("AP03a N25: missing versus dangling source binding",()=>{const r=ready(base());r.projection.bindings=r.projection.bindings.filter(x=>x.path!=="/initial");expect(projectRetirement(canonical(r)).primaryIssue?.code).toBe("evidence_required");const d=ready(base());d.projection.bindings[0].sourceIds=["not-present"];expect(projectRetirement(canonical(d)).primaryIssue?.code).toBe("dangling_source");});
test("AP03a N26: blocked metric structurally has no invented amount",()=>{const r=base();p(r).grantCoverage={mode:"unknown",unresolvedContributionYears:[2027]};const m=result(r).summary.completeEndBalance;expect(Object.keys(m).sort()).toEqual(["issue","status"]);});
test("AP03a N27: no PIB May date repair",()=>{for(const [month,day]of [["2028-06","2028-05-15"],["2028-05","2028-05-31"]]){const r=base("2028-01","2028-12");const g=grant("z",12000,month);g.booking.basis="pib_may15_month_end_illustration";g.booking.referenceDate=day;p(r).grantEvents=[g];expect(run(r).primaryIssue?.code).toBe("inconsistent_input");}});
test("AP03a N28: actual booking status requires actual date and reference",()=>{const r=base();const g=grant("z",12000,"2027-12",2027,true);g.sourceBookingRef=null;p(r).grantEvents=[g];expect(run(r).primaryIssue?.code).toBe("inconsistent_input");});
test("AP03a N29: unknown version retains canonical request hash only",()=>{const r=ready(base());r.versions.modelVersion="other-v2";const raw=canonical(r),z=projectRetirement(raw);expect(z.status).toBe("review_required");expect(z.requestHash).toBe("sha256:"+createHash("sha256").update(raw).digest("hex"));expect(z.sourceManifest).toEqual([]);expect(z.projectionResults).toEqual([]);});
test("AP03a N30: before/after costs cannot produce a fair difference",()=>{const c=comparisonFixture();c.scenarios.forEach(x=>{x.reference.parameters.costs={mode:"gross_only",costKnowledge:"unknown"};});const pool=new Map([["assumption",source("assumption")]]);c.scenarios.forEach(x=>{prepareBound(x.retirement,pool);prepareBound(x.reference,pool);});c.sources=[...pool.values()];const z=compareRetirement(canonical(c));expect(z.comparisonResults.every(x=>x.primaryIssue?.code==="basis_mismatch")).toBe(true);expect(z.projectionResults.every(x=>x.status==="calculated")).toBe(true);});
test("AP03a N31: fixed internal tick and output-size guards, real work stop",()=>{
  const budget=new ProjectionBudget();for(let i=0;i<1000000;i++)budget.tick("");expect(budget.count()).toBe(1000000);expect(()=>budget.tick("")).toThrow(ProjectionStop);
  expect(()=>enforceOutputBytes(33554432)).not.toThrow();expect(()=>enforceOutputBytes(33554433)).toThrow("output_bytes_limit");
  const r=base("0100-01","9999-12");cash(r,0);p(r).marketSchedule=Array.from({length:5000},(_,i)=>{
    const n=1200+i,fromMonth=String(Math.floor(n/12)).padStart(4,"0")+"-"+String(n%12+1).padStart(2,"0");
    const decimal=(v:number)=>"0."+String(v).padStart(6,"0").replace(/0+$/,"");
    return {fromMonth,equityAnnualReturn:k(decimal(i+1)),bondAnnualReturn:k(decimal(i+5001))};
  });
  const z=run(r);expect(z.status).toBe("resource_error");expect(z.primaryIssue?.code).toBe("work_limit");expect(z.projectionResults).toEqual([]);
});

test("AP03a integrity: V1 editorial identity, canonical example, deterministic responses",async()=>{
  const doc=await readFile("docs/AP03a_Neutraler_Projektionsvertrag.md","utf8");expect(createHash("sha256").update(doc).digest("hex")).toBe("234b4dae0a1a01e32b4a6ed3ce54ddd4fabbfea459d4c55a284d1a4380032fc9");
  const raw=doc.match(/```json\n([^\n]+)\n```/)?.[1];expect(raw).toBeTruthy();const z=projectRetirement(raw!);
  expect(z.requestHash).toBe("sha256:c420902072b639a90a26579e626ed0b603df5cba0ec9628b3718908672cdba01");expect(z.status).toBe("calculated");
  expect(JSON.stringify(z)).toBe(canonical(z));expect(projectRetirement(raw!)).toEqual(z);
  const input=canonical(ready(base()));for(let i=0;i<4;i++)expect(projectRetirement(input)).toEqual(projectRetirement(input));expect(input).toBe(canonical(JSON.parse(input)));
});
test("AP03a stability: every returned month and total balance includes zero",()=>{
  const r=base("2027-10","2028-12");cash(r,123456,4321);rates(r,J1,JM1);quote(r,"0.5");crash(r,"-0.3","2028-03");
  const z=result(r);for(const row of detailed(z)){expect(row.balanceCheck.status).toBe("interval_consistent");expect(Number(row.balanceCheck.residualInterval.lowerEuro)).toBeLessThanOrEqual(0);expect(Number(row.balanceCheck.residualInterval.upperEuro)).toBeGreaterThanOrEqual(0);}expect(z.summary.balanceCheck?.status).toBe("interval_consistent");
});
test("AP03a primitive arithmetic: no unapproved model rounding of money inputs",()=>{
  expect(checkedCent(point(SCALE/200n),"")).toBe(0);expect(checkedCent(point(3n*SCALE/200n),"")).toBe(2);
  expect(checkedCent(point(-3n*SCALE/200n),"")).toBe(-2);
});
test("AP03a precision scope: hidden post-return sleeve needs bounds, not an invented cent",()=>{
  const r=base("2027-01","2027-01");cash(r,1);quote(r,"0.5");rates(r,"0.000000000000000000000000000000000001",J50);
  expect(end(r)).toBe(1);
});
test("AP03a source readiness: unconfirmed actual grant never becomes zero",()=>{
  const r=base();p(r).grantEvents=[grant("z",12000,"2027-12",2027,true)];const raw=ready(r);
  raw.sources.find(x=>x.kind==="booking_evidence")!.quality="unconfirmed";
  const z=projectRetirement(canonical(raw));expect(z.status).toBe("review_required");
  expect(z.projectionResults[0].summary.totals.specifiedAllowances.status).toBe("review_required");
  expect(cents(z.projectionResults[0].summary.totals.totalOwn)).toBe(120000);
});
test("AP03a unused sleeve still requires a complete market fact",()=>{
  const r=base();p(r).marketSchedule[0].bondAnnualReturn={state:"unknown",reason:"unconfirmed"};
  error(r,"input_fact_unknown");
});
test("AP03a comparison matches dated money, not event IDs or redundant schedule rows",()=>{
  const c=comparisonFixture();for(const x of c.scenarios)x.reference.parameters.contributionSchedule.push({fromMonth:"2027-06",monthlyCents:k(10000)});
  const pool=new Map([["assumption",source("assumption")]]);c.scenarios.forEach(x=>{prepareBound(x.retirement,pool);prepareBound(x.reference,pool);});c.sources=[...pool.values()];
  const z=compareRetirement(canonical(c));expect(z.status).toBe("calculated");expect(z.comparisonResults.map(x=>cents(x.completeDifference))).toEqual([0,0,0]);
});
