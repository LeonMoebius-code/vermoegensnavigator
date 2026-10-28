import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateOldRiesterGrant } from "../app/domain/retirement/old-riester-grant";
import type { OldRiesterGrantInput, OldRiesterGrantResult } from "../app/domain/retirement/old-riester-grant-contract";
import { calculateDirectGrant } from "../app/domain/retirement/direct-grant";

type Expected = { status: string; code?: string; minimumOwnContributionCents?: number; baseGrantCents?: number;
  childGrantCents?: number[]; childrenGrantCents?: number; totalGrantCents?: number };
type Fixture = { id: string; mappingNote: string; input: OldRiesterGrantInput; expected: Expected };
const fixture = JSON.parse(readFileSync("tests/fixtures/ap01b-old-riester.synthetic.json", "utf8")) as { cases: Fixture[] };
const clone = <T>(data: T): T => structuredClone(data);
const standard = clone(fixture.cases.find(c => c.id === "G15")!.input);
let checks = 0;
const amountKeys = ["minimumOwnContributionCents", "fulfillment", "baseGrantCents", "childGrants", "childrenGrantCents", "totalGrantCents"];
function noAmounts(result: OldRiesterGrantResult): void {
  for (const key of amountKeys) assert(!Object.hasOwn(result, key), `stopped result contains ${key}`);
}
function match(result: OldRiesterGrantResult, expected: Expected, id: string): void {
  assert.equal(result.status, expected.status, id);
  assert.equal(result.notice, "Jahresbezogene Modellrechnung; keine individuelle Förderzusage.");
  if (result.status === "calculated") {
    assert.equal(result.minimumOwnContributionCents, expected.minimumOwnContributionCents, id);
    assert.equal(result.baseGrantCents, expected.baseGrantCents, id);
    assert.deepEqual(result.childGrants.map(c => c.grantCents), expected.childGrantCents, id);
    assert.equal(result.childrenGrantCents, expected.childrenGrantCents, id);
    assert.equal(result.totalGrantCents, expected.totalGrantCents, id);
    assert.equal(result.baseGrantCents + result.childGrants.reduce((sum, c) => sum + c.grantCents, 0), result.totalGrantCents);
    assert.equal(result.ruleContext?.calculationVersion, "ap01b-v1");
    assert.equal(result.ruleContext?.checkedOn, "2026-10-28");
    assert(result.ruleContext!.sources.length >= 5);
    assert.equal(result.bonus.includedInTotal, false);
  } else { assert.equal(result.issue.code, expected.code, id); noAmounts(result); }
  checks++;
}
function expectStop(input: unknown, status: "invalid_input" | "review_required" | "unsupported", code?: string): void {
  const r = calculateOldRiesterGrant(input);
  assert.equal(r.status, status);
  if (code) assert.equal(r.issue.code, code);
  noAmounts(r); checks++;
}
function freezeDeep(value: unknown): void {
  if (value && typeof value === "object") {
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) if ("value" in descriptor) freezeDeep(descriptor.value);
    Object.freeze(value);
  }
}
const requiredIDs = [...Array.from({ length: 17 }, (_, i) => `G${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 29 }, (_, i) => `N${String(i + 1).padStart(2, "0")}`)];
assert.deepEqual(fixture.cases.filter(c => /^[GN]\d\d$/.test(c.id)).map(c => c.id), requiredIDs);
assert.equal(new Set(fixture.cases.map(c => c.id)).size, fixture.cases.length);
assert.deepEqual(fixture.cases.filter(c => c.id.startsWith("V01-")).map(c => c.id),
  ["V01-1-U", "V01-1-N", "V01-1-B", "V01-2-060", "V01-2-120", "V01-2-360", "V01-3-U", "V01-3-N", "V01-4-060", "V01-4-120"]);
for (const c of fixture.cases) {
  assert(c.mappingNote.length > 10);
  const before = JSON.stringify(c.input);
  freezeDeep(c.input);
  const actual = calculateOldRiesterGrant(c.input);
  match(actual, c.expected, c.id);
  assert.equal(JSON.stringify(c.input), before);
  assert.deepEqual(calculateOldRiesterGrant(c.input), actual);
  if (actual.status === "calculated") {
    assert.deepEqual(actual.childGrants.map(x => x.childId), c.input.children.map(x => x.id));
    assert.equal(actual.contributionQuality, c.input.contributionQuality);
  }
  console.log(JSON.stringify({ id: c.id, expected: c.expected, actual }));
}
const reduced = calculateOldRiesterGrant(fixture.cases.find(c => c.id === "G07")!.input);
assert(reduced.status === "calculated" && reduced.fulfillment.status === "reduced");

// Independent oracle: decimal long division and digit carry, no production rounding helpers.
// Factor A uses nine quote digits. Percentage's nine decimals equal eleven quote digits.
function decimal(numerator: bigint, denominator: bigint, places: number): bigint | null {
  let rem = numerator % denominator;
  const digits: number[] = [];
  for (let i = 0; i < places; i++) {
    rem *= 10n; digits.push(Number(rem / denominator)); rem %= denominator;
  }
  if (rem !== 0n) {
    const next = rem * 10n / denominator;
    const tail = rem * 10n % denominator;
    if (next === 5n && tail === 0n) return null;
    if (next >= 5n) {
      let index = digits.length - 1;
      while (index >= 0 && digits[index] === 9) { digits[index] = 0; index--; }
      if (index < 0) return (numerator / denominator + 1n) * 10n ** BigInt(places);
      digits[index]++;
    }
  }
  return BigInt(String(numerator / denominator) + digits.join(""));
}
function oracle(y: number, e: number, years: readonly number[]): Expected {
  const max = [17500, ...years.map(y => y <= 2007 ? 18500 : 30000)];
  const budget = 4n * (BigInt(y) / 100n);
  const rest = (budget > 210000n ? 210000n : budget) - BigInt(max.reduce((a, b) => a + b, 0));
  // Binary-search whole-euro contribution lattice, independently of productive floor formula.
  let lo = 60, hi = 1925;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (BigInt(mid * 100) <= rest) lo = mid; else hi = mid - 1;
  }
  const minimum = lo * 100;
  const output: number[] = [];
  if (e === 0 || e >= minimum) output.push(...max.map(v => e === 0 ? 0 : v));
  else {
    const factors = [decimal(BigInt(e), BigInt(minimum), 9), decimal(BigInt(e), BigInt(minimum), 11)];
    if (factors.some(f => f === null)) return { status: "review_required", code: "rounding_convention_required" };
    for (const maximum of max) {
      const results = factors.map((factor, i) => decimal(BigInt(maximum) * factor!, 10n ** BigInt(i === 0 ? 9 : 11), 0));
      if (results.some(r => r === null) || results[0] !== results[1])
        return { status: "review_required", code: "rounding_convention_required" };
      output.push(Number(results[0]));
    }
  }
  return { status: "calculated", minimumOwnContributionCents: minimum, baseGrantCents: output[0],
    childGrantCents: output.slice(1), childrenGrantCents: output.slice(1).reduce((a, b) => a + b, 0),
    totalGrantCents: output.reduce((a, b) => a + b, 0) };
}
const mkChildren = (years: readonly number[], contributionYear = 2027, ruleContext = standard.ruleContext) =>
  years.map((birthYear, i) => ({ id: `synthetic-${i}`, birthYear, contributionYear, ruleContext, assignment: "eligible_assigned_confirmed" as const }));
let sweepCount = 0, sweepCalculated = 0, sweepReview = 0;
const counterexamples: unknown[] = [];
function compare(y: number, e: number, births: readonly number[]): void {
  const expected = oracle(y, e, births);
  const actual = calculateOldRiesterGrant({ ...standard, priorYearIncomeCents: y, eligibleOwnContributionCents: e, children: mkChildren(births) });
  match(actual, expected, `oracle Y=${y} E=${e} children=${births.join(",")}`);
  sweepCount++;
  if (actual.status === "calculated") {
    sweepCalculated++;
    assert(Number.isSafeInteger(actual.totalGrantCents));
    assert(actual.totalGrantCents >= 0 && actual.totalGrantCents <= 17500 + births.reduce((s, y) => s + (y < 2008 ? 18500 : 30000), 0));
    assert.equal(actual.fulfillment.numerator, Math.min(e, actual.minimumOwnContributionCents));
  } else { sweepReview++; if (counterexamples.length < 8) counterexamples.push({ y, e, births, code: actual.issue.code }); }
}
const fullSweeps: [number, number[], number][] = [
  [0, [], 6001], [1800000, [2010, 2014], 6001], [612500, [], 7001],
  [3500000, [], 122501], [3500000, [2007, 2008], 74001], [8000000, [], 192501],
];
for (const [y, births, upper] of fullSweeps) for (let e = 0; e <= upper; e++) compare(y, e, births);
const incomes = [0, 1, 99, 100, 499999, 500000, 587499, 587500, 587599, 587600, 612500,
  1799999, 1800000, 1937499, 1937500, 3500000, 3500099, 3501900,
  5249999, 5250000, 5250099, 8000000, Number.MAX_SAFE_INTEGER];
for (const y of incomes) for (const births of [[], [2007], [2008], [2007, 2008], [2010, 2014, 2027]]) {
  const m = oracle(y, Number.MAX_SAFE_INTEGER, births).minimumOwnContributionCents!;
  for (const e of [0, 1, 3, 6, 3000, 5999, 6000, 6001, m - 1, m, m + 1, Number.MAX_SAFE_INTEGER]) compare(y, e, births);
}
// Wide income sweep across floor, statutory cap and child-dependent floor transitions.
for (let y = 5800; y <= 53000; y += 17) for (const births of [[], [2007, 2008]]) {
  for (const e of [1, 3, 6, 2999, 5999, 36000]) compare(y * 100 + 99, e, births);
}
console.log(JSON.stringify({ oracle: "independent decimal digit carry + whole-euro lattice search", fullSweeps,
  incomeGrid: incomes, count: sweepCount, calculated: sweepCalculated, review: sweepReview, disagreements: 0,
  roundingCounterexamples: counterexamples }));

// Explicit factor tie: M=1280 euros, E=1 cent => quote9 halfway (0.0000078125).
expectStop({ ...standard, priorYearIncomeCents: 3637500, eligibleOwnContributionCents: 1 }, "review_required", "rounding_convention_required");
// M=1024 euros: factor A is not halfway, but percentage-factor B is halfway.
expectStop({ ...standard, priorYearIncomeCents: 2997500, eligibleOwnContributionCents: 1 }, "review_required", "rounding_convention_required");
// Every year/rule pairing and old/new year context, including 2028's mixed paragraph regime.
const contexts = ["alt-2026-checked-20261028", "alt-bestand-2027-checked-20261028", "alt-bestand-2028-checked-20261028"];
for (const y of [2026, 2027, 2028]) for (const [index, ruleContext] of contexts.entries()) {
  const data = { ...standard, contributionYear: y, incomeYear: y - 1, ruleContext, regime: y === 2026 ? "old_2026_confirmed" : "old_protected_confirmed" };
  if (y !== 2026 + index) expectStop(data, "review_required", "rule_year_mismatch");
  else {
    const r = calculateOldRiesterGrant({ ...data, children: mkChildren([2007, 2008], y, ruleContext) });
    assert(r.status === "calculated");
    assert.equal(r.ruleContext?.childEntitlementPeriod, "first");
    assert.equal(r.ruleContext?.childParentAssignment, y === 2028 ? "neutral_from_2028" : "old_until_2027");
    assert.equal(r.totalGrantCents, 32109); checks++;
  }
}
for (const y of [2025, 2029, 9999]) expectStop({ ...standard, contributionYear: y, incomeYear: y - 1 }, "review_required", "year_not_approved");
expectStop({ ...standard, ruleContext: "future-rule" }, "review_required", "rule_context_required");
expectStop({ ...standard, regime: "old_2026_confirmed" }, "review_required", "regime_unconfirmed");
expectStop({ ...standard, incomeYear: 2027 }, "review_required", "income_year_mismatch");
expectStop({ ...standard, partner: "direct_independent_confirmed", bonus: "unconfirmed" }, "review_required", "bonus_history_required");
const independentPartner = calculateOldRiesterGrant({ ...standard, partner: "direct_independent_confirmed" });
assert(independentPartner.status === "calculated" && independentPartner.totalGrantCents === 5143); checks++;
// New regime with confirmed assignment: N14 extension only as boundary, never new allowance in AP-01b.
expectStop({ ...standard, contributionYear: 2028, incomeYear: 2027, ruleContext: contexts[2], regime: "new_confirmed",
  children: mkChildren([2010], 2028, contexts[2]) }, "unsupported", "new_regime");

// Open facts individually at E=0 and alongside a confirmed exclusion must block before exclusion.
const openFields = ["entitlement", "regime", "contract", "incomeBasis", "partner", "bonus", "childrenStatus",
  "contributionQuality", "evidenceQuality", "correction"];
for (const key of openFields) for (const status of ["unconfirmed", "conflicting"]) {
  expectStop({ ...standard, [key]: status, eligibleOwnContributionCents: 0 }, "review_required");
  expectStop({ ...standard, contract: "multiple", [key]: status }, "review_required");
}
for (const topic of ["entitlement", "regime", "contract", "income", "partner", "bonus", "children", "contribution", "correction"])
  expectStop({ ...standard, contract: "multiple", pendingEvidence: [topic] }, "review_required", "pending_evidence");
const outside = { entitlement: ["indirect", "ineligible"], regime: ["new_confirmed"],
  contract: ["multiple", "multiple_and_new_regime", "housing", "occupational", "ineligible"],
  incomeBasis: ["special"], partner: ["indirect_included", "indirect_new_direct_old"], bonus: ["current_year_confirmed"],
  contributionQuality: ["ineligible"], correction: ["retrospective"] };
for (const [key, values] of Object.entries(outside)) for (const value of values) {
  expectStop({ ...standard, [key]: value, eligibleOwnContributionCents: 0 }, "unsupported");
  expectStop({ ...standard, [key]: value, evidenceQuality: "conflicting" }, "review_required");
  expectStop({ ...standard, [key]: value, eligibleOwnContributionCents: -1 }, "invalid_input");
}
expectStop({ ...standard, eligibleOwnContributionCents: null }, "review_required", "contribution_required");
for (const assignment of ["eligibility_unconfirmed", "assignment_unconfirmed", "conflicting_assignment"]) {
  expectStop({ ...standard, children: [{ ...mkChildren([2010])[0], assignment }] }, "review_required", "child_assignment_required");
}
for (const patch of [{ contributionYear: 2028 }, { ruleContext: contexts[2] }])
  expectStop({ ...standard, children: [{ ...mkChildren([2010])[0], ...patch }] }, "review_required", "child_assignment_required");

// AP-01a is imported for boundary regression only; no changed code, rules, fixtures or helpers.
const direct = { contributionYear: 2027, ruleContext: "estg-2027-v1", entitlement: "direct_confirmed", regime: "new_confirmed",
  eligibleOwnContributionCents: 11999, eligibleContractContext: "single_eligible_confirmed",
  children: [{ id: "synthetic-new", contributionYear: 2027, status: "eligible_assigned_confirmed" }] };
const n22 = calculateDirectGrant(direct); assert(n22.status === "calculated" && n22.totalGrantCents === 0);
const n23 = calculateDirectGrant({ ...direct, eligibleOwnContributionCents: 12001 });
assert(n23.status === "review_required" && n23.issue.code === "rounding_convention_required"); checks += 2;

// Hostile runtime values. No coercion or own getter execution, no uncaught exception.
const badMoney: unknown[] = [NaN, Infinity, -Infinity, -0, undefined, 1n, "0", true, false, 0.1, -1, Number.MAX_SAFE_INTEGER + 1, {}, []];
for (const key of ["eligibleOwnContributionCents", "priorYearIncomeCents"]) for (const value of badMoney)
  expectStop({ ...standard, [key]: value }, "invalid_input");
for (const value of badMoney.concat([0, 99, 10000, null])) for (const key of ["contributionYear", "incomeYear"])
  expectStop({ ...standard, [key]: value }, "invalid_input");
for (const key of Object.keys(standard)) {
  const missing = { ...standard } as Record<string, unknown>; delete missing[key];
  expectStop(missing, "invalid_input", "invalid_shape");
}
for (const value of [null, undefined, [], 1, "x", true, new Date(), new Map(), Object.create({ inherited: true })])
  expectStop(value, "invalid_input", "invalid_shape");
for (const key of openFields) expectStop({ ...standard, [key]: "invented-confirmation" }, "invalid_input");
expectStop({ ...standard, extra: "do-not-echo" }, "invalid_input", "invalid_shape");
expectStop({ ...standard, [Symbol("extra")]: true }, "invalid_input", "invalid_shape");
expectStop({ ...standard, pendingEvidence: ["invented"] }, "invalid_input", "invalid_shape");
for (const patch of [
  { id: "" }, { id: " name " }, { id: "x\n" }, { id: "x".repeat(129) }, { id: 1 },
  { birthYear: 2028 }, { birthYear: 2007.5 }, { birthYear: -0 }, { birthYear: undefined },
  { contributionYear: 0 }, { assignment: "confirmed" }, { ruleContext: undefined }, { extra: true },
]) expectStop({ ...standard, children: [{ ...mkChildren([2010])[0], ...patch }] }, "invalid_input");
let getters = 0;
for (const key of Object.keys(standard)) for (const mode of ["get", "set"]) {
  const data = clone(standard);
  Object.defineProperty(data, key, mode === "get" ? { get() { getters++; return null; } } : { set() { getters++; } });
  expectStop(data, "invalid_input", "invalid_shape");
}
for (const key of ["children", "pendingEvidence"]) {
  for (const mode of ["get", "set"]) {
    const array: unknown[] = [key === "children" ? mkChildren([2010])[0] : "bonus"];
    Object.defineProperty(array, "0", mode === "get" ? { get() { getters++; return null; } } : { set() { getters++; } });
    expectStop({ ...standard, [key]: array }, "invalid_input", "invalid_shape");
  }
  for (const method of ["map", "some", "every", "forEach", "values", "entries", Symbol.iterator]) {
    const array = [] as unknown[]; Object.defineProperty(array, method, { value() { throw Error("must not invoke"); } });
    expectStop({ ...standard, [key]: array }, "invalid_input", "invalid_shape");
  }
  const sparse = new Array(2); expectStop({ ...standard, [key]: sparse }, "invalid_input", "invalid_shape");
  const extra = Object.assign([], { extra: 1 }); expectStop({ ...standard, [key]: extra }, "invalid_input", "invalid_shape");
  const unusual: unknown[] = []; Object.setPrototypeOf(unusual, null); expectStop({ ...standard, [key]: unusual }, "invalid_input", "invalid_shape");
}
for (const key of Object.keys(mkChildren([2010])[0])) {
  const child = mkChildren([2010])[0]; Object.defineProperty(child, key, { get() { getters++; return "do-not-echo"; } });
  expectStop({ ...standard, children: [child] }, "invalid_input", "invalid_child");
}
assert.equal(getters, 0);
const revoked = Proxy.revocable({}, {}); revoked.revoke();
for (const input of [revoked.proxy, new Proxy({}, { getPrototypeOf() { throw Error("private"); } }),
  new Proxy({}, { ownKeys() { throw Error("private"); } })]) expectStop(input, "invalid_input", "invalid_shape");
for (const key of ["children", "pendingEvidence"]) {
  const revokedArray = Proxy.revocable([], {}); revokedArray.revoke();
  expectStop({ ...standard, [key]: revokedArray.proxy }, "invalid_input", "invalid_shape");
  expectStop({ ...standard, [key]: new Proxy([], { ownKeys() { throw Error("private"); } }) }, "invalid_input", "invalid_shape");
}
expectStop({ ...standard, children: [new Proxy(mkChildren([2010])[0], { getOwnPropertyDescriptor() { throw Error("private"); } })] }, "invalid_input", "invalid_shape");
// Input [[Get]] traps are never used; reflection can itself execute traps (no stronger guarantee).
const noGet = new Proxy(standard, { get() { throw Error("must not read own input properties"); } });
assert.deepEqual(calculateOldRiesterGrant(noGet), calculateOldRiesterGrant(standard)); checks++;
const nullProto = Object.assign(Object.create(null), clone(standard));
assert.deepEqual(calculateOldRiesterGrant(nullProto), calculateOldRiesterGrant(standard)); checks++;
console.log(JSON.stringify({ runtimeChecks: "completed", ownAccessorsExecuted: getters, totalAssertionsGroups: checks, skipped: 0 }));
