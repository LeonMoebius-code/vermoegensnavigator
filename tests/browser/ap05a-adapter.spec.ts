import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixtures = JSON.parse(readFileSync(new URL("../fixtures/ap01b-old-riester.synthetic.json", import.meta.url), "utf8")) as { cases: { id: string; input: OldRiesterGrantInput; expected: { status: string; code: string } }[] };
import { calculateOldRiesterGrant } from "../../app/domain/retirement/old-riester-grant";
import { calculateDirectGrant } from "../../app/domain/retirement/direct-grant";
import { changeOldMode, changeOldYear, emptyOldDraft, emptyNewScenario, oldRuleId, previewComparison, previewOldGrant,
  type OldDraft } from "../../app/presentation/retirement/old-riester-adapter";
import { euro } from "../../app/presentation/retirement/direct-grant-adapter";
import type { OldRiesterGrantInput } from "../../app/domain/retirement/old-riester-grant-contract";

// Converts only synthetic fixture data, not a production import/confirmation path.
function fromFixture(input: unknown): OldDraft {
  const c = input as OldRiesterGrantInput;
  const text = (n: number | null) => n === null ? "" : n < 0 ? "-0,01" : Number.isSafeInteger(n) ? euro(n).replace(" €", "") : "0,001";
  return { ...emptyOldDraft(), year: c.contributionYear, entitlement: c.entitlement, regime: c.regime, contract: c.contract,
    incomeBasis: c.incomeBasis, income: text(c.priorYearIncomeCents), incomeYear: String(c.incomeYear), partner: c.partner, bonus: c.bonus,
    childrenStatus: c.childrenStatus === "complete_confirmed" ? c.children.length ? "list_confirmed" : "none_confirmed" : c.childrenStatus,
    children: c.children.map(k => ({ ...k, birthYear: String(k.birthYear) })), annual: text(c.eligibleOwnContributionCents),
    quality: c.contributionQuality === "actual_confirmed" ? "actual" : c.contributionQuality === "planned_confirmed" ? "planned" : c.contributionQuality,
    contributionConfirmed: c.contributionQuality !== "unconfirmed", evidenceQuality: c.pendingEvidence.length ? "unconfirmed" : c.evidenceQuality,
    correction: c.correction, newScenario: emptyNewScenario(c.contributionYear) };
}
function confirmed() { return fromFixture(fixtures.cases[0].input); }
function newConfirmed(d: OldDraft, count = 0): OldDraft {
  return { ...d, comparisonConfirmed: true, newScenario: { year: d.year, entitlement: "direct_confirmed", regime: "new_confirmed", contract: "single_eligible_confirmed",
    scenarioConfirmed: true, transitionConfirmed: true, contributionConfirmed: true, childrenStatus: count ? "list_confirmed" : "none_confirmed",
    children: Array.from({ length: count }, (_, i) => ({ id: `new-synthetic-${i}`, contributionYear: d.year, status: "eligible_assigned_confirmed" as const })) } };
}
function noMoney(result: unknown) {
  for (const field of ["minimumOwnContributionCents", "fulfillment", "baseGrantCents", "totalGrantCents", "annualCents", "result"])
    expect(result).not.toHaveProperty(field);
}
for (const c of fixtures.cases) test(`B05 AP01b ${c.id}: explicit adapter versus original domain`, () => {
  const direct = calculateOldRiesterGrant(c.input), draft = fromFixture(c.input), before = structuredClone(draft), actual = previewOldGrant(draft);
  expect(actual.status).toBe(direct.status);
  if (actual.status === "calculated") expect(actual.result).toEqual(direct);
  else { noMoney(actual); if (c.expected.status !== "invalid_input") expect(actual.message).toContain(c.expected.code); }
  expect(draft).toEqual(before);
  expect(previewOldGrant(draft)).toEqual(actual);
});

test("B05-04/05/15/27: explicit years, all time confirmations revoked", () => {
  expect([2026, 2027, 2028].map(oldRuleId)).toEqual(["alt-2026-checked-20261028", "alt-bestand-2027-checked-20261028", "alt-bestand-2028-checked-20261028"]);
  for (const year of [2026, 2027, 2028]) {
    const d = newConfirmed(confirmed()), changed = changeOldYear(d, year);
    for (const key of ["entitlement", "regime", "contract", "incomeBasis", "partner", "bonus", "childrenStatus", "quality", "evidenceQuality", "correction"] as const) expect(changed[key]).toBe("unconfirmed");
    expect(changed.incomeYear).toBe(""); expect(changed.contributionConfirmed).toBe(false);
    expect(changed.newScenario).toEqual(emptyNewScenario(year)); expect(changed.comparisonConfirmed).toBe(false);
    const valid = { ...confirmed(), year, incomeYear: String(year - 1), regime: year === 2026 ? "old_2026_confirmed" as const : "old_protected_confirmed" as const };
    const p = previewOldGrant(valid); expect(p.status).toBe("calculated"); if (p.status === "calculated") expect(p.input.ruleContext).toBe(oldRuleId(year));
  }
  for (const year of [2025, 2029]) { const p = previewOldGrant({ ...confirmed(), year }); expect(p.status).toBe("review_required"); noMoney(p); }
  const mismatch = confirmed(); mismatch.childrenStatus = "list_confirmed"; mismatch.children = [{ id: "child-x", birthYear: "2007", contributionYear: 2027, ruleContext: "foreign", assignment: "eligible_assigned_confirmed" }];
  expect(previewOldGrant(mismatch).status).toBe("review_required");
});

test("B05-03/06/07/08/21: exact parser, explicit zero and contribution modes", () => {
  expect(previewOldGrant(emptyOldDraft()).status).not.toBe("calculated");
  for (const field of ["income", "annual"] as const) for (const value of ["-1", "1e3", "120,001", "90071992547410", "1.23", "1,000.00", "NaN"]) {
    const p = previewOldGrant({ ...confirmed(), [field]: value }); expect(p.status).toBe("invalid_input"); noMoney(p);
  }
  expect(previewOldGrant({ ...confirmed(), income: "" }).status).toBe("review_required");
  expect(previewOldGrant({ ...confirmed(), income: "0,00" }).status).toBe("calculated");
  const cents = previewOldGrant({ ...confirmed(), annual: "120,01" }); expect(cents.status).toBe("calculated"); if (cents.status === "calculated") expect(cents.input.eligibleOwnContributionCents).toBe(12001);
  const october = { ...confirmed(), mode: "monthly" as const, monthly: "120", startMonth: "10", months: "3", quality: "planned" as const };
  const p = previewOldGrant(october); expect(p.status).toBe("calculated"); if (p.status === "calculated") expect(p.annualCents).toBe(36000);
  expect(previewOldGrant({ ...october, months: "12" }).status).toBe("invalid_input");
  const mode = changeOldMode(newConfirmed(confirmed()), "monthly"); expect(mode.annual).toBe(""); expect(mode.contributionConfirmed).toBe(false); expect(mode.newScenario.contributionConfirmed).toBe(false);
  expect(previewOldGrant({ ...confirmed(), incomeYear: "2027" }).status).toBe("review_required");
});

test("B05-25/26/28/30: complete six-row comparison, identical cents, no bonuses", () => {
  const f = fixtures.cases.find(c => c.id === "V01-2-060")!;
  for (const [amount, total] of [[60, 0], [120, 300], [300, 750], [350, 775], [360, 780], [1800, 1140]]) {
    const d = newConfirmed({ ...fromFixture(f.input), income: "20.000", annual: String(amount) }, 2), p = previewComparison(d);
    expect(p.old.status).toBe("calculated"); expect(p.newer.status).toBe("calculated"); expect(p.deltaCents).toBe(total * 100 - 77500);
    if (p.old.status !== "calculated" || p.newer.status !== "calculated") throw new Error("fixture");
    expect(p.old.result.totalGrantCents).toBe(77500); expect(p.newer.result.totalGrantCents).toBe(total * 100);
    expect(p.old.input.eligibleOwnContributionCents).toBe(p.newer.input.eligibleOwnContributionCents);
    expect(p.newer.result).toEqual(calculateDirectGrant(p.newer.input));
    expect(p.old.result.bonus.includedInTotal).toBe(false); expect(p.newer.result.bonus.includedInTotal).toBe(false);
  }
  const capped = previewComparison(newConfirmed({ ...confirmed(), annual: "6.840,01" }));
  expect(capped.old.status).toBe("calculated"); expect(capped.newer.status).toBe("review_required"); expect(capped).not.toHaveProperty("deltaCents");
});

test("B05-23/24/27/28: scenario gates independent, complete basis required", () => {
  let d = newConfirmed(confirmed(), 1);
  for (const patch of [{ scenarioConfirmed: false }, { transitionConfirmed: false }, { contributionConfirmed: false }, { entitlement: "unconfirmed" }, { regime: "unconfirmed" }, { contract: "transition_unconfirmed" }, { childrenStatus: "unconfirmed" }]) {
    const p = previewComparison({ ...d, newScenario: { ...d.newScenario, ...patch } });
    expect(p.old.status).toBe("calculated"); expect(p.newer.status).toBe("review_required"); noMoney(p.newer); expect(p).not.toHaveProperty("deltaCents");
  }
  d = { ...d, year: 2028, regime: "old_protected_confirmed", incomeYear: "2027" };
  expect(previewComparison(d).newer.status).toBe("review_required");
  d = newConfirmed(d, 1); d.newScenario.children = [{ id: "new-c", contributionYear: 2028, status: "conflicting_assignment" }];
  expect(previewComparison(d).newer.status).toBe("review_required");
  expect(previewComparison({ ...confirmed(), year: 2026, regime: "old_2026_confirmed", incomeYear: "2025" }).newer.status).toBe("unsupported");
  expect(previewComparison({ ...newConfirmed(confirmed()), comparisonConfirmed: false })).not.toHaveProperty("deltaCents");
});

test("B05 defensive data chain: getters/arrays/proxies/types never create confirmations", () => {
  let calls = 0;
  const bad: unknown[] = [null, false, 1, [], "draft", { ...confirmed(), quality: true }, { ...confirmed(), newScenario: null }];
  const top = confirmed(); Object.defineProperty(top, "income", { get() { calls++; return "0"; } }); bad.push(top);
  const child = { id: "c", birthYear: "2010", contributionYear: 2027, ruleContext: oldRuleId(2027), assignment: "eligible_assigned_confirmed" };
  for (const target of ["old", "new"] as const) {
    for (const kind of ["getter", "own-map", "iterator", "sparse", "subclass"] as const) {
      const a: unknown[] = [target === "old" ? child : { id: "n", contributionYear: 2027, status: "eligible_assigned_confirmed" }];
      if (kind === "getter") Object.defineProperty(a, "0", { get() { calls++; return child; } });
      if (kind === "own-map") Object.defineProperty(a, "map", { value() { calls++; return []; } });
      if (kind === "iterator") Object.defineProperty(a, Symbol.iterator, { get() { calls++; return [][Symbol.iterator]; } });
      if (kind === "sparse") delete a[0];
      if (kind === "subclass") Object.setPrototypeOf(a, Object.create(Array.prototype));
      bad.push(target === "old" ? { ...confirmed(), children: a } : { ...confirmed(), newScenario: { ...emptyNewScenario(2027), children: a } });
    }
  }
  const revoked = Proxy.revocable({}, {}); revoked.revoke(); bad.push(revoked.proxy);
  for (const value of bad) { const p = previewComparison(value); expect(p.old.status).toBe("invalid_input"); expect(p.newer.status).toBe("invalid_input"); noMoney(p.old); noMoney(p.newer); expect(p).not.toHaveProperty("deltaCents"); }
  expect(calls).toBe(0);
  const frozen = Object.freeze(confirmed()); expect(previewOldGrant(frozen).status).toBe("calculated");
});

test("B05 generated 252 snapshots: exact adapter/domain parity and independent new core", () => {
  for (const year of [2026, 2027, 2028]) for (const income of [0, 612500, 3500000, 8000000]) for (const own of [0, 1, 3, 6, 5999, 12001, 180000]) for (const count of [0, 1, 2]) {
    const d = confirmed(); d.year = year; d.incomeYear = String(year - 1); d.income = euro(income).replace(" €", ""); d.annual = euro(own).replace(" €", ""); d.regime = year === 2026 ? "old_2026_confirmed" : "old_protected_confirmed";
    d.childrenStatus = count ? "list_confirmed" : "none_confirmed"; d.children = Array.from({ length: count }, (_, i) => ({ id: `generated-${i}`, birthYear: i ? "2008" : "2007", contributionYear: year, ruleContext: oldRuleId(year), assignment: "eligible_assigned_confirmed" as const }));
    const p = previewComparison(newConfirmed(d, count));
    const domainInput: OldRiesterGrantInput = { contributionYear: year, ruleContext: oldRuleId(year), entitlement: "direct_old_confirmed", regime: d.regime, contract: "single_private_eligible_confirmed", incomeBasis: "simple_domestic_prior_rv_confirmed", priorYearIncomeCents: income, incomeYear: year - 1, partner: "none_relevant_confirmed", bonus: "history_no_current_confirmed", childrenStatus: "complete_confirmed", children: d.children.map(c => ({ ...c, birthYear: Number(c.birthYear) })), eligibleOwnContributionCents: own, contributionQuality: "actual_confirmed", evidenceQuality: "confirmed", pendingEvidence: [], correction: "none_confirmed" };
    const direct = calculateOldRiesterGrant(domainInput); expect(p.old.status).toBe(direct.status);
    if (p.old.status === "calculated") expect(p.old.result).toEqual(direct); else noMoney(p.old);
    if (p.newer.status === "calculated") expect(p.newer.result).toEqual(calculateDirectGrant(p.newer.input)); else expect(p).not.toHaveProperty("deltaCents");
  }
});
