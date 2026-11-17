import { test, expect } from "@playwright/test";
import { annualContribution } from "../../app/presentation/retirement/direct-grant-adapter";
import { conditionalBaseGrant, customerGrant, customerPayments, editCustomerCapital, emptyCustomerPlan, plannedGrantDraft, runCustomerCapital, setContributionGoal, type CustomerPlan } from "../../app/presentation/retirement/customer-plan-adapter";
import { buildCapitalRequests } from "../../app/presentation/retirement/projection-adapter";

function plan(): CustomerPlan {
  const p = emptyCustomerPlan();
  p.capital = { ...p.capital, start: "2027-10", end: "2027-12", monthly: "10", equity: "100", scenarios: [0, 1, 2].map(() => ({ equity: "0", bond: "0" })) };
  return p;
}
function own(p: CustomerPlan) {
  const d = plannedGrantDraft(p); if ("status" in d) throw new Error(d.message);
  const a = annualContribution(d); if (a.status !== "valid") throw new Error(a.message);
  return a.cents;
}
function assertProjection(p: CustomerPlan, total: number, finalMonth: string) {
  const run = runCustomerCapital(p); expect(run.status).toBe("responses");
  if (run.status !== "responses") throw new Error("missing model");
  for (const result of run.responses.flatMap(r => r.projectionResults)) {
    expect(result.status).toBe("calculated");
    expect(result.summary.totals.totalOwn).toHaveProperty("displayCents", total);
    expect(result.summary.specifiedEndBalance).toHaveProperty("displayCents", total);
    if (result.ledger?.mode !== "detailed") throw new Error("detailed ledger required");
    expect(result.ledger.rows.at(-1)?.month).toBe(finalMonth);
  }
  return run;
}

// Independent fixed expectations from V0.5.2 A2 and the AP01a golden matrix.
for (const [annual, rate, base] of [["120", "40,00", 6000], ["300", "100,00", 15000], ["360", "120,00", 18000], ["1800", "600,00", 54000], ["6840", "2280,00", 54000]] as const)
  test(`UX2 October target ${annual}: independent payment and grant oracle`, () => {
    const p = setContributionGoal(plan(), annual, "target");
    expect(p.capital.monthly).toBe(rate); expect(own(p)).toBe(Number(annual) * 100);
    expect(conditionalBaseGrant(p)).toMatchObject({ status: "calculated", result: { baseGrantCents: base } });
    expect(customerGrant(p).status).toBe("review_required");
    expect(p.evidence.entitlement).toBe("unconfirmed"); expect(p.evidence.contributionConfirmed).toBe(false);
    assertProjection(p, Number(annual) * 100, "2027-12");
  });

for (const [monthly, annual, base] of [["10", 3000, 0], ["39,99", 11997, 0], ["40", 12000, 6000]] as const)
  test(`UX2 October ${monthly}: minimum is annual, not monthly`, () => {
    const p = plan(); p.capital.monthly = monthly;
    expect(own(p)).toBe(annual); expect(conditionalBaseGrant(p)).toMatchObject({ status: "calculated", result: { baseGrantCents: base } });
    assertProjection(p, annual, "2027-12");
  });

test("UX2 annual cents, explicit one-off and remainder share projection/reference cashflows", () => {
  let p = plan(); p.capital.end = "2028-03"; p.capital.oneOffEnabled = true; p.capital.oneOff = "90"; p.capital.oneOffMonth = "2027-11";
  p = setContributionGoal(p, "120,01", "annual");
  expect(p.capital.monthly).toBe("10,00"); expect(customerPayments(p)).toMatchObject({ total: 12001, remainder: 1, remainderMonth: "2027-12" });
  expect(own(p)).toBe(12001);
  expect(conditionalBaseGrant(p)).toMatchObject({ status: "review_required", domain: { issue: { code: "rounding_convention_required" } } });
  // 6 monthly payments 10 €, explicit November 90 €, one December cent.
  assertProjection(p, 15001, "2028-03");
  p.capital.referenceEnabled = true;
  const r = assertProjection(p, 15001, "2028-03");
  for (const s of JSON.parse(r.requests[0]).scenarios) {
    expect(s.retirement.parameters.oneOffContributions).toEqual(s.reference.parameters.oneOffContributions);
    expect(s.retirement.parameters.contributionSchedule).toEqual(s.reference.parameters.contributionSchedule);
    expect(s.retirement.parameters.oneOffContributions).toEqual([
      { eventId: "own-once", month: "2027-11", cents: 9000 },
      { eventId: "own-annual-remainder", month: "2027-12", cents: 1 },
    ]);
    expect(s.retirement.parameters.grantEvents).toEqual([]);
  }
});

test("UX2 start/end/one-off edits reallocate target, yearly evidence revoked, original immutable", () => {
  let p = setContributionGoal(plan(), "120", "target");
  p.evidence.contributionConfirmed = true;
  const original = JSON.stringify(p);
  const next = editCustomerCapital(p, { ...p.capital, start: "2027-11" });
  expect(next.capital.monthly).toBe("60,00"); expect(own(next)).toBe(12000); expect(next.evidence.contributionConfirmed).toBe(false);
  expect(JSON.stringify(p)).toBe(original);
  const withOnce = editCustomerCapital(next, { ...next.capital, oneOffEnabled: true, oneOff: "90", oneOffMonth: "2027-12" });
  expect(withOnce.capital.monthly).toBe("15,00"); expect(own(withOnce)).toBe(12000);
  const futureOnce = editCustomerCapital(withOnce, { ...withOnce.capital, end: "2028-01", oneOffMonth: "2028-01" });
  expect(futureOnce.capital.monthly).toBe("60,00"); expect(own(futureOnce)).toBe(12000); assertProjection(futureOnce, 27000, "2028-01");
  const nextYear = editCustomerCapital(p, { ...p.capital, start: "2028-01", end: "2028-12" });
  expect(nextYear.capital.monthly).toBe("10,00"); expect(nextYear.evidence.entitlement).toBe("unconfirmed");
  const manual = editCustomerCapital(p, { ...p.capital, monthly: "45" });
  expect(manual.contribution).toBeUndefined(); expect(own(manual)).toBe(13500);
});

test("UX2 one-off above target is preserved, never negative monthly or hidden cap", () => {
  const p = plan(); p.capital.oneOffEnabled = true; p.capital.oneOff = "200"; p.capital.oneOffMonth = "2027-12";
  const next = setContributionGoal(p, "120", "target");
  expect(next.capital.monthly).toBe("0,00"); expect(own(next)).toBe(20000); assertProjection(next, 20000, "2027-12");
});

for (const [annual, expected] of [["", "invalid_input"], ["-1", "invalid_input"], ["1e3", "invalid_input"], ["120,001", "invalid_input"], ["6840,01", "review_required"], ["90071992547409,92", "invalid_input"]] as const)
  test(`UX2 annual ${annual}: rejects invalid/unsupported with no grant fallback`, () => {
    const p = setContributionGoal(plan(), annual, "annual");
    expect(conditionalBaseGrant(p).status).toBe(expected);
    if (expected === "invalid_input") expect(runCustomerCapital(p).status).toBe("invalid_input");
  });

test("UX2 out-of-scope legal cases never become a direct scenario", () => {
  for (const status of ["indirect", "ineligible"] as const) { const p = plan(); p.evidence.entitlement = status; expect(conditionalBaseGrant(p).status).toBe("review_required"); }
  for (const year of [2026, 2029]) { const p = plan(); p.capital.start = `${year}-10`; p.capital.end = `${year}-12`; expect(conditionalBaseGrant(p).status).not.toBe("calculated"); }
  const p = plan(); p.evidence.regime = "old"; expect(conditionalBaseGrant(p).status).toBe("review_required");
});

test("UX2 confirmed grants survive market edits, annual edits revoke contribution only", () => {
  let p = setContributionGoal(plan(), "120", "target");
  p.funding = "checked"; p.children = "no";
  p.evidence = { ...p.evidence, entitlement: "direct_confirmed", regime: "new_confirmed", contract: "single_eligible_confirmed", childrenStatus: "none_confirmed", contributionConfirmed: true };
  expect(customerGrant(p)).toMatchObject({ status: "calculated", result: { baseGrantCents: 6000 } });
  const market = editCustomerCapital(p, { ...p.capital, equity: "50" });
  expect(customerGrant(market).status).toBe("calculated");
  p = setContributionGoal(p, "360", "annual");
  expect(p.evidence.entitlement).toBe("direct_confirmed"); expect(p.evidence.contributionConfirmed).toBe(false); expect(customerGrant(p).status).toBe("review_required");
});

test("UX2 adjustment boundary rejects wrong month, fractional or excessive cents", () => {
  const p = plan();
  for (const adjustment of [{ month: "2027-09", cents: 1 }, { month: "2027-12", cents: 12 }, { month: "2027-12", cents: 0.1 }, { month: "2027-12", cents: -1 }])
    expect(buildCapitalRequests(JSON.stringify(p.capital), adjustment).status).toBe("invalid_input");
});

for (const [start, months] of [["2027-01", 12], ["2027-02", 11], ["2027-12", 1]] as const)
  test(`UX2 target 6840 at ${start}: exact first-year cap and cent remainder`, () => {
    const p = plan(); p.capital.start = start;
    const next = setContributionGoal(p, "6840", "target");
    expect(customerPayments(next)).toMatchObject({ months, total: 684000 });
    assertProjection(next, 684000, "2027-12");
  });

test("UX2 identical target is a no-op and cannot withdraw reviewed evidence", () => {
  const p = setContributionGoal(plan(), "120", "target"); p.evidence.contributionConfirmed = true;
  expect(setContributionGoal(p, "120", "target")).toBe(p);
  expect(setContributionGoal(p, "120", "annual").evidence.contributionConfirmed).toBe(true);
});
