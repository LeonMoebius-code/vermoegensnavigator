import { test, expect } from "@playwright/test";
import { annualContribution, previewGrant } from "../../app/presentation/retirement/direct-grant-adapter";
import { customerGrant, editCustomerCapital, emptyCustomerPlan, ledgerPoints, plannedGrantDraft, runCustomerCapital } from "../../app/presentation/retirement/customer-plan-adapter";
import type { ProjectionResult } from "../../app/domain/retirement/projection-contract";

function zero() { const p = emptyCustomerPlan(); p.capital = { ...p.capital, start: "2027-10", end: "2027-12", equity: "100", scenarios: [0, 1, 2].map(() => ({ equity: "0", bond: "0" })) }; return p; }
function results(p = zero()) { const r = runCustomerCapital(p); expect(r.status).toBe("responses"); if (r.status !== "responses") throw new Error("model response missing"); return r.responses.flatMap(x => x.projectionResults); }

for (const [start, end, first, total] of [["2027-01", "2027-12", 120000, 120000], ["2027-10", "2027-12", 30000, 30000],
  ["2027-10", "2028-03", 30000, 60000], ["2027-10", "2027-10", 10000, 10000]] as const) test(`UX03 bridge ${start}–${end}: independent month counts`, () => {
  const p = zero(); p.capital.start = start; p.capital.end = end;
  const d = plannedGrantDraft(p); if ("status" in d) throw new Error(d.message);
  expect(annualContribution(d)).toMatchObject({ status: "valid", cents: first });
  for (const model of results(p)) {
    expect(model.summary.totals.totalOwn).toHaveProperty("displayCents", total);
    expect(model.summary.specifiedEndBalance).toHaveProperty("displayCents", total);
  }
});

for (const [month, first] of [["2027-11", 80000], ["2028-01", 30000]] as const) test(`UX03 one-off ${month}: first-year and full-plan consistency`, () => {
  const p = zero(); p.capital.end = "2028-03"; p.capital.oneOffEnabled = true; p.capital.oneOffMonth = month; p.capital.oneOff = "500";
  const d = plannedGrantDraft(p); if ("status" in d) throw new Error(d.message);
  expect(annualContribution(d)).toMatchObject({ cents: first });
  for (const m of results(p)) { expect(m.summary.totals.totalOwn).toHaveProperty("displayCents", 110000); expect(ledgerPoints(m).at(-1)?.ownCents).toBe(110000); }
});

test("UX03 customer answers are never legal evidence; unknown children stay open", () => {
  const p = zero(); p.funding = "checked"; p.children = "no";
  expect(customerGrant(p).status).toBe("review_required");
  p.evidence = { ...p.evidence, entitlement: "direct_confirmed", regime: "new_confirmed", contract: "single_eligible_confirmed", contributionConfirmed: true, childrenStatus: "none_confirmed" };
  expect(customerGrant(p).status).toBe("calculated");
  p.children = "unknown"; expect(customerGrant(p).status).toBe("review_required");
  p.children = "yes"; expect(customerGrant(p).status).toBe("review_required");
  p.evidence.childrenStatus = "assigned_confirmed"; p.evidence.children = [{ id: "synthetic-child", status: "assignment_unconfirmed" }];
  expect(customerGrant(p).status).toBe("review_required");
  p.evidence.children = [{ id: "synthetic-child", status: "eligible_assigned_confirmed" }];
  const d = plannedGrantDraft(p); if ("status" in d) throw new Error(d.message);
  expect(customerGrant(p)).toEqual(previewGrant(d));
  p.funding = "special"; expect(customerGrant(p).status).toBe("review_required");
});

test("UX03 payment change revokes contribution; person/year evidence never survives year change", () => {
  const p = zero(); p.evidence = { ...p.evidence, entitlement: "direct_confirmed", regime: "new_confirmed", contract: "single_eligible_confirmed", contributionConfirmed: true,
    childrenStatus: "assigned_confirmed", children: [{ id: "synthetic-child", status: "eligible_assigned_confirmed" }] };
  const same = editCustomerCapital(p, { ...p.capital, monthly: "200" });
  expect(same.evidence.contributionConfirmed).toBe(false); expect(same.evidence.entitlement).toBe("direct_confirmed");
  const marketOnly = editCustomerCapital(p, { ...p.capital, equity: "50" });
  expect(marketOnly.evidence.contributionConfirmed).toBe(true);
  const next = editCustomerCapital(p, { ...p.capital, start: "2028-01", end: "2028-12" });
  expect(next.evidence.entitlement).toBe("unconfirmed"); expect(next.evidence.children[0]).toEqual({ id: "synthetic-child", status: "assignment_unconfirmed" });
  expect(p.evidence.children[0].status).toBe("eligible_assigned_confirmed");
});

for (const [key, value] of [["monthly", ""], ["monthly", "-1"], ["monthly", "1e3"], ["monthly", "0,001"], ["start", "2027-00"], ["end", "2027-09"]] as const)
  test(`UX03 invalid ${key}=${value}: no stale or substitute numbers`, () => {
    const p = zero(); p.capital[key] = value; expect(runCustomerCapital(p).status).toBe("invalid_input");
  });

test("UX03 no grants inferred or repeated, immutable input, no legal flags modified", () => {
  const p = zero(), before = JSON.stringify(p), run = runCustomerCapital(p);
  expect(JSON.stringify(p)).toBe(before); expect(p.evidence.entitlement).toBe("unconfirmed"); expect(p.capital.confirmed).toBe(false);
  expect(run.status).toBe("responses"); if (run.status !== "responses") return;
  for (const raw of run.requests) { const r = JSON.parse(raw); expect(r.projection.parameters.grantEvents).toEqual([]); expect(r.sources[0].quality).toBe("hypothetical"); }
});

for (const output of ["detailed", "compact"] as const) test(`UX03 ${output}: every plotted point equals the original ledger`, () => {
  const p = zero(); p.capital.output = output;
  for (const m of results(p)) {
    const points = ledgerPoints(m); expect(points.at(-1)).toEqual({ month: "2027-12", cents: 30000, ownCents: 30000 });
    const rows = m.ledger?.mode === "detailed" ? m.ledger.rows.map(r => [r.month, r.closingBalance]) : m.ledger?.blocks.map(b => [b.endMonth, b.closingBalance]);
    expect(points.map(p => [p.month, p.cents])).toEqual(rows?.map(([month, metric]) => [month, (metric as { displayCents: number }).displayCents]));
    expect(ledgerPoints({ ...m, status: "review_required" })).toEqual([]);
  }
});

test("UX03 partial trajectories keep specified balances; full grant-inclusive metric blocked", () => {
  const p = zero(); p.capital.coverage = "unknown";
  for (const m of results(p)) { expect(m.status).toBe("partial"); expect(m.summary.completeEndBalance.status).toBe("review_required"); expect(ledgerPoints(m)).toHaveLength(3); }
});

test("UX03 reference reuses the identical cashflow schedule and dates", () => {
  const p = zero(); p.capital.referenceEnabled = true;
  const run = runCustomerCapital(p); if (run.status !== "responses") throw new Error("comparison missing");
  expect(run.mode).toBe("comparison");
  for (const s of JSON.parse(run.requests[0]).scenarios) { expect(s.retirement.parameters.contributionSchedule).toEqual(s.reference.parameters.contributionSchedule); expect(s.retirement.parameters.period).toEqual(s.reference.parameters.period); }
  expect(run.responses[0].projectionResults).toHaveLength(6);
});

test("UX03 missing cost evidence blocks trajectory; no silent zero cost", () => {
  const p = zero(); p.capital.costMode = "explicit"; p.capital.costPercent = "1";
  for (const m of results(p)) { expect(m.status).toBe("review_required"); expect(ledgerPoints(m)).toEqual([]); }
});

test("UX03 broken ledger metric never becomes a zero-valued plot point", () => {
  const m = results()[0]; if (m.ledger?.mode !== "detailed") throw new Error("detailed expected");
  const broken: ProjectionResult = { ...m, ledger: { mode: "detailed", rows: m.ledger.rows.map((r, i) => i ? r : { ...r, closingBalance: { status: "review_required", issue: { code: "precision_ambiguous", path: "", month: r.month } } }) } };
  expect(ledgerPoints(broken)).toEqual([]);
});
