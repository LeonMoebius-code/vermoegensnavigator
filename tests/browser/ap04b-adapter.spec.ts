import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { buildCapitalRequests, calculateCapital, emptyCapitalDraft, issueMessage, type CapitalDraft } from "../../app/presentation/retirement/projection-adapter";
import { PROJECTION_VERSIONS, type MoneyMetric, type ProjectionResult } from "../../app/domain/retirement/projection-contract";

const raw = (d: CapitalDraft) => JSON.stringify(d);
function zero(start = "2027-01", end = "2027-12"): CapitalDraft {
  return { ...emptyCapitalDraft(), start, end, initial: "0", monthly: "100", equity: "100", confirmed: true,
    scenarios: Array.from({ length: 3 }, () => ({ equity: "0", bond: "0" })) };
}
function run(d: CapitalDraft) {
  const r = calculateCapital(raw(d)); expect(r.status).toBe("responses");
  if (r.status !== "responses") throw new Error(JSON.stringify(r)); return r;
}
function models(d: CapitalDraft): readonly ProjectionResult[] { return run(d).responses.flatMap(r => r.projectionResults); }
function cents(m: MoneyMetric): number { if (!("displayCents" in m)) throw new Error(JSON.stringify(m)); return m.displayCents; }
const ends = (d: CapitalDraft) => models(d).map(m => cents(m.summary.completeEndBalance));
function invalid(d: CapitalDraft, field: string) { const r = buildCapitalRequests(raw(d)); expect(r.status).toBe("invalid_input"); if (r.status === "invalid_input") expect(r.field).toBe(field); }
const canonical = (v: unknown): string => JSON.stringify(v, (_, x: unknown) => x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : x);

test("A4A-01: fixed independent zero, January and October cashflow oracles", () => {
  const d = zero(); d.monthly = "0"; expect(ends(d)).toEqual([0,0,0]);
  expect(ends(zero())).toEqual([120000,120000,120000]);
  expect(ends(zero("2027-10"))).toEqual([30000,30000,30000]);
});
for (const [shock, expected] of [["-20",[110000,108000,106000]],["-30",[100000,97000,94000]],["-40",[90000,86000,82000]]] as const)
  for (const [i, month] of ["2027-01","2027-02","2027-03"].entries()) test(`A4A-02: independent ${shock}% equity stress in ${month}`, () => {
    const d = zero("2027-01","2027-03"); d.initial="1000";d.stressEnabled=true;d.stressMonth=month;d.stressPercent=shock;
    expect(ends(d)).toEqual(Array(3).fill(expected[i]));
    d.equity="0";expect(ends(d)).toEqual([130000,130000,130000]);
  });
test("A4A-03: 50 percent equity loses only its sleeve; deposits follow stress", () => {
  const d=zero("2027-01","2027-03");d.initial="1000";d.equity="50";d.stressEnabled=true;d.stressMonth="2027-01";d.stressPercent="-30";
  expect(ends(d)).toEqual([115000,115000,115000]);
});
test("A4A-04: one-off own payment is dated and identical in the reference", () => {
  const d=zero("2027-01","2027-03");d.oneOffEnabled=true;d.oneOff="500";d.oneOffMonth="2027-02";
  expect(ends(d)).toEqual([80000,80000,80000]);d.referenceEnabled=true;d.referenceEquity="100";
  const r=run(d);expect(r.mode).toBe("comparison");expect(r.responses).toHaveLength(1);
  expect(r.responses[0].projectionResults.map(p=>cents(p.summary.totals.totalOwn))).toEqual(Array(6).fill(80000));
  expect(r.responses[0].comparisonResults.map(c=>cents(c.completeDifference))).toEqual([0,0,0]);
});
test("A4A-05: distinct annual equity and bond oracles, no mixed-rate shortcut", () => {
  const d=emptyCapitalDraft();d.initial="1000";d.monthly="0";d.end="2027-12";d.equity="100";d.confirmed=true;
  expect(ends(d)).toEqual([103000,106000,108000]);d.equity="0";expect(ends(d)).toEqual([101000,102000,103000]);
});
test("A4A-06: unknown costs are not euro zero; confirmed complete reduction has fixed independent oracle", () => {
  const d=zero();d.initial="1000";d.monthly="0";
  const before=models(d)[0];expect(cents(before.summary.completeEndBalance)).toBe(100000);
  expect(before.valueBasis).toBe("before_costs");expect(before.summary.totals.totalCostAmount.status).toBe("review_required");
  expect("displayCents" in before.summary.totals.totalCostAmount).toBe(false);
  d.costMode="explicit";d.costPercent="11,3615128283870719341199";d.costConfirmed=true;
  // c=1-0.99^12, independently fixed; 1000*0.99^12 = 886.384871716129280658801.
  expect(ends(d)).toEqual([88638,88638,88638]);expect(cents(models(d)[0].summary.totals.totalCostAmount)).toBe(11362);
  d.costConfirmed=false;const blocked=models(d)[0];expect(blocked.status).toBe("review_required");
  expect(blocked.primaryIssue?.code).toBe("cost_source_unknown");expect(cents(blocked.summary.totals.totalOwn)).toBe(0);
});
test("A4A-07: manual grant once, no auto-years and no grant in reference", () => {
  const d=zero("2027-01","2028-12");d.grantEnabled=true;d.grantAmount="180";d.grantMonth="2028-05";d.grantConfirmed=true;d.referenceEnabled=true;
  const r=run(d).responses[0];expect(r.status).toBe("calculated");
  expect(r.projectionResults.map(m=>cents(m.summary.completeEndBalance))).toEqual([258000,240000,258000,240000,258000,240000]);
  expect(r.projectionResults.map(m=>cents(m.summary.totals.specifiedAllowances))).toEqual([18000,0,18000,0,18000,0]);
  expect(r.comparisonResults.map(c=>cents(c.completeDifference))).toEqual([18000,18000,18000]);
  const built=buildCapitalRequests(raw(d));if(built.status!=="ready")throw new Error("fixture");const req=JSON.parse(built.requests[0]);
  expect(req.scenarios.every((s: {retirement:{parameters:{grantEvents:unknown[]}};reference:{parameters:{grantEvents:unknown[];grantCoverage:{mode:string}}}})=>s.retirement.parameters.grantEvents.length===1&&s.reference.parameters.grantEvents.length===0&&s.reference.parameters.grantCoverage.mode==="none_assumed")).toBe(true);
  expect(req.scenarios[0].retirement.parameters.grantEvents[0].amountBasis).toBe("hypothetical_amount");
  expect(req.scenarios[0].retirement.parameters.grantEvents[0].externalRule).toBeNull();
});
test("A4A-08: unknown coverage preserves specified grant and blocks complete difference", () => {
  const d=zero("2027-01","2028-12");d.grantEnabled=true;d.grantAmount="180";d.grantMonth="2028-05";d.grantConfirmed=true;
  d.coverage="unknown";d.openYears="2028";d.referenceEnabled=true;
  const r=run(d).responses[0];expect(r.status).toBe("partial");const m=r.projectionResults[0];
  expect(cents(m.summary.specifiedEndBalance)).toBe(258000);expect(m.summary.completeEndBalance.status).toBe("review_required");
  expect(r.comparisonResults.every(c=>c.status==="partial"&&c.completeDifference.status==="review_required")).toBe(true);
});
test("A4A-09: no retrospective/invented grant date, explicit after-end exclusion", () => {
  const d=zero();d.grantEnabled=true;d.grantAmount="180";d.grantConfirmed=true;d.grantMonth="";invalid(d,"grantMonth");
  d.grantMonth="2026-12";invalid(d,"grantMonth");d.grantMonth="2027-12";d.grantYear="2028";invalid(d,"grantMonth");
  d.grantYear="2027";d.grantMonth="2028-06";const m=models(d)[0];expect(cents(m.summary.completeEndBalance)).toBe(120000);expect(m.excludedEvents.map(e=>e.cents)).toEqual([18000]);
});
test("A4A-10: source manifest, all required binding pointers and canonical text", () => {
  const d=zero();d.oneOffEnabled=true;d.oneOff="1";d.oneOffMonth="2027-02";d.costMode="explicit";d.costConfirmed=true;
  const r=buildCapitalRequests(raw(d));expect(r.status).toBe("ready");if(r.status!=="ready")throw new Error("fixture");
  expect(r.requests).toHaveLength(3);
  for(const text of r.requests){const j=JSON.parse(text);expect(text).toBe(canonical(j));expect(j.versions).toEqual(PROJECTION_VERSIONS);
    expect(j.sources).toEqual([{sourceId:"ui-assumption",kind:"model_assumption",quality:"hypothetical",reference:expect.any(String),version:"ap04b-ui-v1",contentHash:null,checkedOn:null,effectiveFromMonth:null,effectiveToMonth:null}]);
    expect(j.projection.bindings.map((b:{path:string})=>b.path)).toEqual(["/allocationSchedule/0","/contributionSchedule/0","/costs","/costs/annualRates/0","/grantCoverage","/initial","/marketSchedule/0","/oneOffContributions/0","/period","/rebalancing","/stress"]);
    expect(j.projection.bindings.every((b:{sourceIds:string[]})=>JSON.stringify(b.sourceIds)==='["ui-assumption"]')).toBe(true);
  }
  expect(calculateCapital(raw(d))).toEqual(calculateCapital(raw(d)));expect(raw(d)).toBe(JSON.stringify(d));
});
test("A4A-11: exact safe cents and invalid money formats, no coercion or rounding", () => {
  const d=zero("2027-01","2027-01");d.monthly="0";d.initial="90.071.992.547.409,91";expect(ends(d)).toEqual(Array(3).fill(9007199254740991));
  for(const value of ["", "-1", "+1", "1e3", "1,001", "1.23", "NaN", "Infinity", "90071992547409,92"]){d.initial=value;invalid(d,"initial");}
  const x=JSON.parse(raw(zero()));x.initial=100;expect(buildCapitalRequests(JSON.stringify(x)).status).toBe("invalid_input");
});
test("A4A-12: exact percent conversion and financial/calendar domain rejection", () => {
  for(const [key,value] of [["equity","100.01"],["equity","-1"],["equity","1e2"],["start","0099-12"],["start","2027-01-01"],["end","10000-01"],["end","2026-12"]] as const){const d=zero();d[key]=value;invalid(d,key);}
  const d=zero();d.scenarios[0].equity="-101";invalid(d,"scenarios.0.equity");d.scenarios[0].equity="-100";expect(run(d).responses[0].primaryIssue?.code).toBe("annual_total_loss_timing_required");
  const x=zero();x.stressEnabled=true;x.stressMonth="2027-02";x.stressPercent="-100";expect(ends(x)).toEqual([110000,110000,110000]);
  x.stressPercent="-100,01";invalid(x,"stressPercent");x.stressPercent="-30";x.stressMonth="2028-01";invalid(x,"stressMonth");
  x.stressEnabled=false;x.equity="0,00000000000000000000000000000000001";invalid(x,"equity");
});
test("A4A-13: primitive JSON boundary has zero foreign-object getter/proxy calls", () => {
  let calls=0;const obj={get x(){calls++;throw new Error("getter");}},proxy=new Proxy({}, {get(){calls++;throw new Error("get");},ownKeys(){calls++;throw new Error("keys");}});
  for(const x of [obj,proxy,null,new String("{}"),123,()=>0])expect(buildCapitalRequests(x).status).toBe("invalid_input");
  expect(calls).toBe(0);
  for(const text of ["{", "[]", "null", "{}",' '+raw(zero()),raw(zero()).replace('"initial":"0"','"initial":"1","initial":"0"')])expect(buildCapitalRequests(text).status).toBe("invalid_input");
  const x=JSON.parse(raw(zero()));x.product="arbitrary";expect(buildCapitalRequests(JSON.stringify(x)).status).toBe("invalid_input");
});
test("A4A-14: confirmations and explicit open years, no hidden A2 source", () => {
  const d=zero();d.confirmed=false;invalid(d,"confirmed");d.confirmed=true;d.coverage="unknown";
  for(const years of ["", "2028,2027", "2027,2027", "0099"]){d.openYears=years;invalid(d,"openYears");}
  d.coverage="none_assumed";d.grantEnabled=true;d.grantAmount="180";d.grantMonth="2028-05";invalid(d,"grantConfirmed");
});
test("A4A-15: incompatible cost stages block only comparison, no fabricated delta", () => {
  const d=zero();d.costMode="explicit";d.costPercent="0";d.costConfirmed=true;d.referenceEnabled=true;
  const r=run(d).responses[0];expect(r.status).toBe("partial");expect(r.projectionResults.every(m=>m.status==="calculated")).toBe(true);
  expect(r.comparisonResults.every(c=>c.primaryIssue?.code==="basis_mismatch"&&c.completeDifference.status==="review_required")).toBe(true);
});
test("A4A-16: full calendar compact oracle and controlled detail stop", () => {
  const d=zero("0100-01","9999-12");d.monthly="0,01";
  const result=models(d);expect(result.map(m=>m.period.monthCount)).toEqual([118800,118800,118800]);
  expect(result.map(m=>cents(m.summary.completeEndBalance))).toEqual([118800,118800,118800]);expect(result.every(m=>m.ledger?.mode==="compact")).toBe(true);
  d.output="detailed";const stopped=run(d);expect(stopped.responses.every(r=>r.status==="resource_error"&&r.primaryIssue?.code==="detail_rows_limit"&&r.projectionResults.length===0)).toBe(true);
});
test("A4A-17: dated and undated contract issues translated without reprioritization", () => {
  expect(issueMessage({code:"precision_ambiguous",month:"2027-01",path:"/projection/parameters"})).toContain("2027-01");
  expect(issueMessage({code:"cost_source_unknown",month:null,path:"/projection/parameters/costs"})).toContain("Kosten noch nicht belastbar");
});
test("A4A-18: frozen AP03a contract identity remains unchanged", async () => {
  expect(createHash("sha256").update(await readFile("docs/AP03a_Neutraler_Projektionsvertrag.md")).digest("hex")).toBe("c1546f4dcecc6b7172c8f9404d46ddb9bc32a740fab9a26bfabec7f84f01a9d2");
});
