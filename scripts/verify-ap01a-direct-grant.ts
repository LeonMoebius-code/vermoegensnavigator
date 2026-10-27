import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateDirectGrant } from "../app/domain/retirement/direct-grant";
import type { DirectGrantInput } from "../app/domain/retirement/direct-grant-contract";

interface Vector {
  id: string; synthetic: boolean; input: Record<string, unknown>; runtimeContribution?: string;
  expected: { status: string; code?: string; baseGrantCents?: number; childrenGrantCents?: number; totalGrantCents?: number; numerator?: number };
}
const fixture = JSON.parse(readFileSync("tests/fixtures/ap01a-direct-grant.synthetic.json", "utf8")) as { synthetic: boolean; vectors: Vector[] };
assert.equal(fixture.synthetic, true);
const runtimeValues: Record<string, unknown> = { NaN, Infinity, "-Infinity": -Infinity, negativeZero: -0, undefined, bigint: 12000n };
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") { for (const v of Object.values(value)) deepFreeze(v); Object.freeze(value); }
  return value;
}
assert.equal(new Set(fixture.vectors.map(v => v.id)).size, fixture.vectors.length);
for (const v of fixture.vectors) {
  assert.equal(v.synthetic, true, v.id);
  const input = structuredClone(v.input);
  if (v.runtimeContribution) {
    assert.ok(Object.hasOwn(runtimeValues, v.runtimeContribution));
    input.eligibleOwnContributionCents = runtimeValues[v.runtimeContribution];
  }
  const before = structuredClone(input);
  deepFreeze(input);
  const result = calculateDirectGrant(input);
  assert.equal(result.status, v.expected.status, v.id);
  assert.deepEqual(input, before, `${v.id}: input unchanged`);
  assert.deepEqual(calculateDirectGrant(input), result, `${v.id}: deterministic`);
  assert.deepEqual(result.bonus, { status: "not_calculated_requires_review", includedInTotal: false });
  if (result.status === "calculated") {
    assert.equal(result.baseGrantCents, v.expected.baseGrantCents, v.id);
    assert.equal(result.childrenGrantCents, v.expected.childrenGrantCents, v.id);
    assert.equal(result.totalGrantCents, v.expected.totalGrantCents, v.id);
    assert.equal(result.roundingStatus, "exact_integer_cents");
    assert.equal(result.contributionYear, input.contributionYear);
    assert.equal(result.ruleContext?.contributionYear, input.contributionYear);
    assert.equal(result.ruleContext?.childAssignmentEffectiveFrom, `${input.contributionYear}-01-01`);
    assert.ok(result.ruleContext?.sources.some(s => s.endsWith(`0085_${input.contributionYear}_01_01.html`)));
    const children = input.children as { id: string }[];
    assert.deepEqual(result.childGrants.map(c => c.childId), children.map(c => c.id));
    assert.equal(result.childrenGrantCents, result.childGrants.reduce((sum, c) => sum + c.grantCents, 0));
    for (const c of result.childGrants) assert.equal(c.grantCents, children.length ? v.expected.childrenGrantCents! / children.length : 0);
    for (const x of [result.baseGrantCents, result.childrenGrantCents, result.totalGrantCents]) assert.ok(Number.isSafeInteger(x) && x >= 0);
  } else {
    assert.equal(result.issue.code, v.expected.code, v.id);
    assert.ok(result.issue.message.length > 0);
    for (const key of ["baseGrantCents", "childGrants", "childrenGrantCents", "totalGrantCents"]) assert.ok(!(key in result), `${v.id}: no numerical substitute`);
    if (v.expected.numerator !== undefined) assert.deepEqual(result.openRounding,
      { component: "baseGrant", unit: "cent", numerator: v.expected.numerator, denominator: 4 });
    else assert.equal(result.openRounding, undefined);
  }
  console.log(`PASS AP01a ${v.id}`);
}

const standard: DirectGrantInput = {
  contributionYear: 2027, ruleContext: "estg-2027-v1", entitlement: "direct_confirmed", regime: "new_confirmed",
  eligibleOwnContributionCents: 12000, eligibleContractContext: "single_eligible_confirmed", children: [],
};
// Synthetic executable properties must be rejected without invoking them.
let arrayStructureCases = 0;
function invalidArrayStructure(input: unknown, label: string) {
  const result = calculateDirectGrant(input);
  assert.equal(result.status, "invalid_input", label);
  assert.ok(result.issue.code === "invalid_shape" || result.issue.code === "invalid_child", label);
  for (const key of ["baseGrantCents", "childGrants", "childrenGrantCents", "totalGrantCents"]) assert.ok(!(key in result), label);
  arrayStructureCases++;
  console.log(`PASS AP01a array structure ${label}`);
}
for (const field of ["children", "pendingEvidence"] as const) {
  const validElement = field === "children"
    ? { id: "SYNTHETIC-ARRAY-CHILD", contributionYear: 2027, status: "eligible_assigned_confirmed" } : "bonus";
  for (const key of ["0", "extra", "some", "map", Symbol.iterator]) for (const throws of [true, false]) {
    let calls = 0;
    const array: unknown[] = [];
    Object.defineProperty(array, key, { configurable: true, get() {
      calls++;
      if (throws) throw Error("SYNTHETIC_ARRAY_GETTER_MUST_NOT_RUN");
      return validElement;
    } });
    const descriptors = Object.getOwnPropertyDescriptors(array);
    const label = `${field} own getter ${String(key)} ${throws ? "throwing" : "nonthrowing"}`;
    invalidArrayStructure({ ...standard, [field]: array }, label);
    assert.equal(calls, 0, `${label}: getter not invoked`);
    assert.deepEqual(Object.getOwnPropertyDescriptors(array), descriptors, `${label}: input unchanged`);
  }
  let inheritedCalls = 0;
  const inherited: unknown[] = new Array(1);
  Object.setPrototypeOf(inherited, Object.create(Array.prototype, { "0": { get() { inheritedCalls++; return validElement; } } }));
  invalidArrayStructure({ ...standard, [field]: inherited }, `${field} inherited getter`);
  assert.equal(inheritedCalls, 0);
  const setterOnly: unknown[] = [];
  Object.defineProperty(setterOnly, "0", { set() { throw Error("SYNTHETIC_SETTER_MUST_NOT_RUN"); } });
  invalidArrayStructure({ ...standard, [field]: setterOnly }, `${field} setter-only element`);
  // Structural inspection can itself throw, e.g. on revoked or trapping proxies.
  for (const trap of ["getPrototypeOf", "ownKeys", "getOwnPropertyDescriptor"] as const) {
    const proxy = new Proxy([], { [trap]() { throw Error("SYNTHETIC_ARRAY_STRUCTURE_TRAP"); } });
    invalidArrayStructure({ ...standard, [field]: proxy }, `${field} throwing ${trap}`);
  }
  const revoked = Proxy.revocable([], {}); revoked.revoke();
  invalidArrayStructure({ ...standard, [field]: revoked.proxy }, `${field} revoked proxy`);
  // Data properties must not replace traversal methods or iterator execution.
  for (const key of ["some", "map", Symbol.iterator]) {
    let calls = 0;
    const array: unknown[] = [];
    Object.defineProperty(array, key, { value() { calls++; throw Error("SYNTHETIC_TRAVERSAL_MUST_NOT_RUN"); } });
    invalidArrayStructure({ ...standard, [field]: array }, `${field} own ${String(key)} method`);
    assert.equal(calls, 0);
  }
}
for (const trap of ["getPrototypeOf", "ownKeys", "getOwnPropertyDescriptor", "get"] as const) {
  invalidArrayStructure(new Proxy({ ...standard }, { [trap]() { throw Error("SYNTHETIC_ROOT_STRUCTURE_TRAP"); } }), `root throwing ${trap}`);
}
const revokedRoot = Proxy.revocable({}, {}); revokedRoot.revoke();
invalidArrayStructure(revokedRoot.proxy, "root revoked proxy");
const throwingChild = new Proxy({}, { ownKeys() { throw Error("SYNTHETIC_CHILD_STRUCTURE_TRAP"); } });
invalidArrayStructure({ ...standard, children: [throwingChild] }, "child throwing structural inspection");
console.log(`AP01a array validation: ${arrayStructureCases} synthetic regression cases passed; accessors and overridden traversal never executed.`);
// A full cent sweep independently uses rational BigInt slopes. No rounded oracles.
for (let cents = 0; cents <= 180004; cents++) {
  const q = cents < 12000 ? 0n : cents <= 36000 ? BigInt(cents) * 2n : 72000n + BigInt(Math.min(cents, 180000) - 36000);
  const result = calculateDirectGrant({ ...standard, eligibleOwnContributionCents: cents });
  if (q % 4n) { assert.equal(result.status, "review_required"); assert.equal(result.issue.code, "rounding_convention_required"); }
  else { assert.equal(result.status, "calculated"); if (result.status === "calculated") assert.equal(result.baseGrantCents, Number(q / 4n)); }
}
// Structurally malformed objects never fall through; no inferred defaults.
for (const value of [null, undefined, [], true, "selbstständig", 12000, {}, new Date(0),
  ...Object.keys(standard).map(key => Object.fromEntries(Object.entries(standard).filter(([k]) => k !== key))),
  { ...standard, children: [null] }, { ...standard, children: new Array(1) },
  { ...standard, pendingEvidence: new Array(1) },
  { ...standard, children: [{ id: "SYNTHETIC-1", contributionYear: NaN, status: "eligible_assigned_confirmed" }] },
  { ...standard, [Symbol("SYNTHETIC")]: true },
  Object.defineProperty({ ...standard }, "regime", { get() { throw Error("getter must not run"); } }),
]) assert.equal(calculateDirectGrant(value).status, "invalid_input");

const before = calculateDirectGrant(standard);
if (before.status === "calculated") {
  // Results are detached from inputs and future metadata; test mutation only.
  (before.ruleContext!.sources as string[]).push("SYNTHETIC-MUTATION");
  assert.ok(!calculateDirectGrant(standard).ruleContext?.sources.includes("SYNTHETIC-MUTATION"));
}
const oldNow = Date.now, oldRandom = Math.random;
try {
  Date.now = () => { throw Error("clock access forbidden"); };
  Math.random = () => { throw Error("random access forbidden"); };
  assert.equal(calculateDirectGrant(standard).status, "calculated");
} finally { Date.now = oldNow; Math.random = oldRandom; }
for (const path of ["direct-grant.ts", "direct-grant-rules.ts", "direct-grant-contract.ts"]) {
  const code = readFileSync(`app/domain/retirement/${path}`, "utf8");
  assert.doesNotMatch(code, /Date\.now|Math\.random|\bwindow\b|\bdocument\b|localStorage|sessionStorage|toFixed|Math\.round/);
}
console.log(`AP01a: ${fixture.vectors.length} synthetic vectors, 180005 cent sweep cases, malformed-input, purity and isolation checks passed.`);
