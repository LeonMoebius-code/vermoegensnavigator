import { test, expect } from "@playwright/test";
import { assertSuccessor, parseAvdCase, caseRef } from "../../app/domain/retirement/avd-case";
import { catalogRef, keyOf, planComparison, validateCaseCatalog, verifyComparison } from "../../app/domain/retirement/avd-comparison";
import { MODEL_VERSIONS, reference } from "../../app/domain/retirement/identity-contract";
import { record } from "./avd-catalog-fixture";
import { candidate, fixture, manualBlockFixture, mutable, nextCase, nextCatalog, productCostCatalog, seal, unsupportedBlocks } from "./avd-p2-fixture";

test("AVD-P2 A: immutable independent case with explicit O/null versus numerical zero", () => {
  const { input, catalog } = fixture();
  const draft = mutable(input);
  draft.payments[0].amount = { class: "O", value: null, reason: "Synthetic unknown" };
  draft.payments[1].amount = { class: "A", value: 0, reason: "Synthetic zero" };
  const candidate = seal(draft);
  const valid = validateCaseCatalog(candidate, catalog);
  expect(Object.isFrozen(valid.payments[0].amount)).toBe(true);
  expect(valid.payments.map(event => event.amount.value)).toEqual([null, 0]);
  candidate.payments[0].amount.value = 0;
  expect(valid.payments[0].amount.value).toBe(null);
  expect(() => parseAvdCase(seal(candidate))).toThrow(/amount_openness/);
});

const invalidCases = [
  ["unknown fields", (c: ReturnType<typeof mutable<ReturnType<typeof fixture>["input"]>>) => Object.assign(c, { extra: 1 }), /unknown_or_missing_field/],
  ["incomplete record", c => Reflect.deleteProperty(c, "people"), /unknown_or_missing_field/],
  ["previous draft version", c => Object.assign(c, { format: "avd.case.v1" }), /unknown_value/],
  ["duplicate identities", c => c.people.push(c.people[0]), /duplicate_identity/],
  ["wrong contract holder reference", c => { c.contracts[0].person_id = "absent"; }, /contract_holder/],
  ["wrong child reference", c => { c.evidence[0].child_id = "partner"; }, /subject_child/],
  ["wrong person and contract relation", c => { c.grants[0].person_id = "partner"; }, /subject_contract/],
  ["wrong grant year", c => { c.grants[0].year = 2027; }, /funding_regime/],
  ["product premise as personal confirmation", c => { c.evidence[0].status = "bestaetigt"; c.evidence[0].proof_id = null; }, /evidence_missing_proof/],
  ["funding evidence mismatch", c => { c.grants[0].treatment = "confirmed"; }, /grant_evidence/],
  ["tampered first predecessor", c => { c.previous_hash = c.hash; }, /invalid_predecessor/]
] as const satisfies ReadonlyArray<readonly [string, (input: ReturnType<typeof mutable<ReturnType<typeof fixture>["input"]>>) => unknown, RegExp]>;

for (const [label, edit, error] of invalidCases) {
  test("AVD-P2 A rejects " + label, () => {
    const draft = mutable(fixture().input);
    edit(draft);
    expect(() => parseAvdCase(seal(draft))).toThrow(error);
  });
}

test("AVD-P2 A: hashes, strict dates, accessor rejection and resource bounds", () => {
  const { input } = fixture();
  expect(() => parseAvdCase({ ...input, as_of: "2026-11-16" })).toThrow(/content_hash_mismatch/);
  expect(() => parseAvdCase(seal({ ...input, as_of: "2026-02-30" }))).toThrow(/invalid_date/);
  let used = false;
  const accessor = Object.defineProperty({ ...input }, "mode", { get() { used = true; return input.mode; }, enumerable: true });
  expect(() => parseAvdCase(accessor)).toThrow(/invalid_property/);
  expect(used).toBe(false);
  expect(() => parseAvdCase({ ...input, memo: "x".repeat(10000) })).toThrow(/invalid_text/);
  expect(() => parseAvdCase({ ...input, memo: "\uD800" })).toThrow(/invalid_text/);
});

test("AVD-P2 A: direct predecessor and route transition clear previous entitlement", () => {
  const { input } = fixture();
  const wrongParent = nextCase(input, c => { c.previous_hash = "a".repeat(64); });
  expect(() => assertSuccessor(input, wrongParent)).toThrow(/revision_conflict/);
  const badRoute = nextCase(input, c => {
    c.route = "B";
    c.evidence.forEach(entry => { entry.route = "B"; });
  });
  expect(() => assertSuccessor(input, parseAvdCase(badRoute))).toThrow(/route_evidence_reset/);
  const validRoute = nextCase(input, c => { c.route = "B"; c.evidence = []; c.grants = []; c.funding_pools = []; });
  assertSuccessor(input, parseAvdCase(validRoute));
  expect(validRoute.people).toEqual(input.people);
  expect(validRoute.contracts).toEqual(input.contracts);
});

test("AVD-P2 B: complete comparison has 12 stable keys and two distinct grant treatments", () => {
  const { input, catalog } = fixture();
  const result = verifyComparison(input, catalog, candidate(input, catalog));
  expect(result.comparison.subresults).toHaveLength(12);
  expect(result.result_capability).toEqual({ status: "fully_numeric", numeric: 12, blocked: 0 });
  const keys = result.comparison.subresults.map(item => keyOf(item.key));
  expect(new Set(keys).size).toBe(12);
  for (const path of ["path-1", "path-2"]) for (const scenario of ["low", "middle", "high"]) {
    for (const funding_variant of ["without_unconfirmed", "with_conditional"] as const) {
      expect(keys).toContain(keyOf({ path_id: path, scenario_id: scenario, funding_variant }));
    }
  }
  expect(result.plan.entries.map(item => item.snapshot.grants.length)).toEqual(Array.from({length: 12}, (_, i) => i % 2));
});

test("AVD-P2 B: reject missing, excess, duplicate and unexpected keys despite new hashes", () => {
  const { input, catalog } = fixture();
  const full = candidate(input, catalog);
  const alter = (edit: (draft: ReturnType<typeof mutable<typeof full>>) => void) => {
    const draft = mutable(full); edit(draft); return seal(draft);
  };
  const reject = (invalid: unknown, issue: RegExp) => expect(() => verifyComparison(input, catalog, invalid)).toThrow(issue);
  reject(alter(c => { c.subresults.pop(); }), /incomplete_comparison/);
  reject(alter(c => { c.subresults[1].key = c.subresults[0].key; }), /duplicate_identity/);
  reject(alter(c => {
    const extra = mutable(c.subresults[0]);
    extra.key.path_id = "other";
    extra.subresult_id = "extra";
    extra.calculation.calculation_id = "extra";
    c.subresults.push(extra);
  }), /incomplete_comparison/);
  reject(alter(c => { c.subresults[0].key = { ...c.subresults[0].key, path_id: "other" }; }), /unexpected_subresult/);
});

test("AVD-P2 B: case, model, cost, funding and technical abort cannot masquerade as current", () => {
  const { input, catalog } = fixture();
  const full = candidate(input, catalog);
  const wrongCase = mutable(full);
  wrongCase.subresults[0].calculation.origin.case.case_revision = 2;
  wrongCase.subresults[0].calculation = seal(wrongCase.subresults[0].calculation);
  expect(() => verifyComparison(input, catalog, seal(wrongCase))).toThrow(/calculation_origin/);
  const wrongFunding = mutable(full);
  wrongFunding.subresults[0].calculation.result = { status: "bedingt_berechnet", capital_cents: 1 };
  wrongFunding.subresults[0].calculation = seal(wrongFunding.subresults[0].calculation);
  expect(() => verifyComparison(input, catalog, seal(wrongFunding))).toThrow(/result_funding_variant/);
  const technical = mutable(full);
  Object.assign(technical.subresults[0].calculation.result, { status: "aborted" });
  expect(() => verifyComparison(input, catalog, seal(technical))).toThrow(/unknown_value/);
  const wrongModel = nextCase(input, c => { c.paths[0].model_version = MODEL_VERSIONS.M2; });
  expect(() => planComparison(wrongModel, catalog)).toThrow(/model_version/);
  const wrongCost = nextCase(input, c => { c.paths[0].savings_cost = c.paths[1].savings_cost; });
  expect(() => planComparison(wrongCost, catalog)).toThrow(/cost_scope/);
  const wrongCostModel = nextCase(input, c => {
    c.paths[0].savings_cost = reference(record(catalog, "synthetic-k1-m2-1", "cost"));
  });
  expect(() => planComparison(wrongCostModel, catalog)).toThrow(/cost_model_mismatch/);
});

test("AVD-P2 R84-N2: reject one or twelve invented blocks even with freshly sealed hashes", () => {
  const { input, catalog } = fixture();
  const base = candidate(input, catalog);
  for (const legacy of [true, false]) for (const count of [1, 12]) {
    expect(() => verifyComparison(input, catalog, unsupportedBlocks(base, count, legacy))).toThrow(/block_proof_mismatch/);
  }
  const oldNumeric = seal({ ...base, subresults: base.subresults.map(item => ({
    ...item, calculation: seal({ ...item.calculation, format: "avd.calculation.v2", result: item.calculation.result })
  })) });
  expect(verifyComparison(input, catalog, oldNumeric).result_capability.status).toBe("fully_numeric");
});

test("AVD-P2 R84-N2: verified manual block yields exactly one blocked result, without a capital number", () => {
  const { input, catalog } = manualBlockFixture();
  const mixed = candidate(input, catalog);
  const verified = verifyComparison(input, catalog, mixed);
  expect(verified.comparison.subresults[0].calculation.result).toEqual({
    status: "nicht_berechenbar", block: { code: "manual_decision", reference_id: "decision-1" }, explanation: null
  });
  expect(verified.result_capability).toEqual({ status: "partially_numeric", numeric: 11, blocked: 1 });
  const contradictory = mutable(mixed);
  const calc = contradictory.subresults[0].calculation;
  Object.assign(calc.result, { capital_cents: 1 });
  contradictory.subresults[0].calculation = seal(calc);
  expect(() => verifyComparison(input, catalog, seal(contradictory))).toThrow(/unknown_or_missing_field/);
});

test("AVD-P2 R84-N2: twelve open returns verify in a working case and closing them withdraws the blocks", () => {
  const { input, catalog } = fixture();
  const open = mutable(input);
  open.mode = "working";
  open.scenarios.forEach(scenario => { scenario.annual_return_bps = null; });
  const working = seal(open);
  const blocked = candidate(working, catalog);
  expect(verifyComparison(working, catalog, blocked).result_capability)
    .toEqual({ status: "documented_blocks", numeric: 0, blocked: 12 });
  const wrong = mutable(blocked);
  const calc = wrong.subresults[0].calculation;
  if (!("block" in calc.result)) throw Error("Fixture proof missing");
  calc.result.block.reference_id = "high";
  wrong.subresults[0].calculation = seal(calc);
  expect(() => verifyComparison(working, catalog, seal(wrong))).toThrow(/block_proof_mismatch/);

  const settled = nextCase(working, draft => { draft.scenarios[0].annual_return_bps = 0; });
  expect(() => verifyComparison(settled, catalog, blocked)).toThrow(/dependency_manifest_mismatch/);
  expect(() => verifyComparison(settled, catalog, candidate(settled, catalog))).toThrow(/real_calculation_unavailable/);
});

test("AVD-P2 R84-N2: manual decision needs matching evidence, scope and a current basis", () => {
  const { input, catalog } = manualBlockFixture();
  const verified = candidate(input, catalog);
  const invalid = mutable(input);
  const decision = invalid.blocking_decisions[0];
  for (const evidenceId of ["missing", "proof-1", "proof-2"]) {
    decision.evidence_id = evidenceId;
    expect(() => verifyComparison(seal(invalid), catalog, verified)).toThrow(/blocking_decision_evidence/);
  }
  decision.evidence_id = input.blocking_decisions[0].evidence_id;
  decision.proof_id = "invented";
  expect(() => verifyComparison(seal(invalid), catalog, verified)).toThrow(/blocking_decision_evidence/);

  const wrongScope = mutable(input);
  wrongScope.blocking_decisions[0].key.path_id = "path-2";
  expect(() => verifyComparison(seal(wrongScope), catalog, verified)).toThrow(/blocking_decision_evidence/);
  const revised = nextCase(input, draft => { draft.evidence[2].proof_id = "new-evidence-revision"; });
  expect(() => verifyComparison(revised, catalog, verified)).toThrow(/blocking_decision_evidence/);
  const changedBasis = nextCase(input, draft => { draft.scenarios[0].annual_return_bps = 1; });
  expect(() => verifyComparison(changedBasis, catalog, verified)).toThrow(/blocking_decision_basis/);
  const withdrawn = nextCase(input, draft => {
    if (draft.format === "avd.case.v3") draft.blocking_decisions = [];
  });
  const replacement = candidate(withdrawn, catalog, { previous: verified });
  expect(verifyComparison(withdrawn, catalog, replacement).result_capability.status).toBe("fully_numeric");
  expect(verifyComparison(input, catalog, verified).result_capability.status).toBe("partially_numeric");
});

test("AVD-P2 B: exact dependencies permit reuse of unaffected product only", () => {
  const { input, catalog } = fixture();
  const first = candidate(input, catalog);
  const newer = productCostCatalog(catalog);
  const updated = nextCase(input, c => {
    c.catalog = catalogRef(newer);
    c.paths[0].savings_cost = newer.current.find(ref => ref.kind === "cost" && ref.id === "synthetic-k1-m1-1")! as typeof c.paths[0]["savings_cost"];
  });
  const next = candidate(updated, newer, { previous: first, reuse: "path-2" });
  const validated = verifyComparison(updated, newer, next).comparison;
  expect(validated.subresults[6].calculation).toEqual(first.subresults[6].calculation);
  expect(validated.subresults[6].subresult_id).not.toBe(first.subresults[6].subresult_id);
  expect(validated.subresults[0].calculation.origin.case).toEqual(caseRef(updated));
  expect(() => verifyComparison(updated, newer, candidate(updated, newer, { previous: first, reuse: "path-1" })))
    .toThrow(/calculation_binding/);
});

test("AVD-P2 B: changed independent rule source is bound to both paths", () => {
  const { input, catalog } = fixture(true);
  const original = candidate(input, catalog);
  const changed = nextCatalog(catalog, true);
  const latest = changed.current.find(ref => ref.id === "synthetic-independent-rule-source")!;
  const rebound = nextCase(input, c => {
    c.catalog = catalogRef(changed);
    const sources = [latest as typeof c.sources[number]];
    c.sources = sources;
    for (const row of [...c.regimes, ...c.evidence, ...c.riester, ...c.scenarios]) row.sources = sources;
  });
  expect(() => verifyComparison(rebound, changed, original)).toThrow(/dependency_manifest_mismatch/);
  expect(() => verifyComparison(rebound, changed, candidate(rebound, changed, { previous: original, reuse: "path-2" })))
    .toThrow(/calculation_binding/);
});

const changeInputs = [
  ["legal revision", c => { c.regimes[0].version = "rule-v2"; c.funding_pools[0].regime_version = "rule-v2"; }, 12],
  ["contribution year", c => {
    c.regimes[0].year = 2027; c.funding_pools[0].year = 2027;
    c.evidence.forEach(item => { item.year = 2027; }); c.grants.forEach(item => { item.year = 2027; });
  }, 12],
  ["partner", c => { c.people[1].born_on = "1980-05-01"; }, 12],
  ["child", c => { c.people[2].born_on = "2014-01-01"; }, 12],
  ["contract start in shared pool", c => { c.contracts[0].starts_on = "2026-11-02"; }, 12],
  ["monthly payment in shared pool", c => { c.payments[0].amount.value = 10001; }, 12],
  ["extra payment in shared pool", c => { c.payments.push({ ...c.payments[0], id: "extra", kind: "extra", cadence: "once" }); }, 12],
  ["extra payment outside pool year", c => {
    c.payments.push({ ...c.payments[0], id: "future-extra", on: "2027-01-02", kind: "extra", cadence: "once" });
  }, 6],
  ["shared assignment split", c => { c.grants[0].amount.value = 11000; c.grants[1].amount.value = 6500; }, 12],
  ["shared child assignment even when path omits child", c => {
    c.people.push({ id: "another-child", role: "child", born_on: "2016-02-02" });
    c.funding_pools[0].claims[0].child_id = "another-child";
    for (const item of [...c.grants, ...c.evidence]) item.child_id = "another-child";
  }, 12],
  ["market scenario", c => { c.scenarios[0].annual_return_bps = 1; }, 4],
  ["Riester balance and strategy", c => { c.riester[0].balance.value = 500; c.riester[0].strategy = "pause"; }, 12],
  ["payout assumptions", c => { c.paths[0].payout = {
    starts_on: "2060-01-01", ends_on: null, monthly_amount: { class: "O", value: null, reason: "Synthetic open" },
    annuity_factor: null, rent_offer: null
  }; }, 6]
] as const satisfies ReadonlyArray<readonly [string, Parameters<typeof nextCase>[1], number]>;

for (const [label, change, count] of changeInputs) {
  test("AVD-P2 B: dependency impact of " + label, () => {
    const { input, catalog } = fixture();
    const before = planComparison(input, catalog);
    const after = planComparison(nextCase(input, change), catalog);
    expect(after.entries.filter((entry, i) => entry.dependency_hash !== before.entries[i].dependency_hash)).toHaveLength(count);
  });
}

test("AVD-P2 B: exact product, fund allocation, model and cost mode change the selected path", () => {
  const { input, catalog } = fixture();
  const before = planComparison(input, catalog);
  const edits: Parameters<typeof nextCase>[1][] = [
    c => {
      c.paths[0].product = reference(record(catalog, "synthetic-product-3", "product"));
      c.paths[0].tariff = reference(record(catalog, "synthetic-tariff-3", "tariff"));
      c.paths[0].savings_cost = reference(record(catalog, "synthetic-k1-m1-3", "cost"));
      c.paths[0].payout_cost = reference(record(catalog, "synthetic-payout-3", "cost"));
    },
    c => {
      c.paths[0].allocation[0].basis_points = 7000;
      c.paths[0].allocation.push({ fund: reference(record(catalog, "synthetic-fund-2", "fund")), basis_points: 3000 });
    },
    c => {
      c.paths[0].model = "M2";
      c.paths[0].model_version = MODEL_VERSIONS.M2;
      c.paths[0].savings_cost = reference(record(catalog, "synthetic-k1-m2-1", "cost"));
    },
    c => { c.paths[0].savings_cost = reference(record(catalog, "synthetic-k2", "cost")); }
  ];
  for (const edit of edits) {
    const after = planComparison(nextCase(input, edit), catalog);
    expect(after.entries.filter((item, i) => item.dependency_hash !== before.entries[i].dependency_hash)).toHaveLength(6);
  }
});

test("R84-N1: identical person and year cannot carry conflicting regimes across contracts", () => {
  const c = mutable(fixture().input);
  c.regimes.push({ ...c.regimes[0], id: "other-2026", version: "different" });
  c.funding_pools.push({ ...c.funding_pools[0], id: "duplicate-pool", regime_id: "other-2026",
    regime_version: "different", contract_ids: ["contract-2"], claims: [] });
  c.funding_pools[0].contract_ids = ["contract-1"];
  c.evidence[1].pool_id = c.grants[1].pool_id = "duplicate-pool";
  c.evidence[1].regime_id = c.grants[1].regime_id = "other-2026";
  expect(() => parseAvdCase(seal(c))).toThrow(/duplicate_identity: \$\.funding_pools/);
  c.funding_pools.pop();
  c.funding_pools[0].contract_ids.push("contract-2");
  c.evidence[1].pool_id = c.grants[1].pool_id = c.funding_pools[0].id;
  expect(() => parseAvdCase(seal(c))).toThrow(/funding_pool_scope/);
});

for (const component of ["base", "starter_bonus", "child"] as const) {
  test("R84-N1: one nominal " + component + " supports splits and rejects two full awards", () => {
    const c = mutable(fixture().input);
    const claim = c.funding_pools[0].claims[0];
    claim.component = component;
    if (component !== "child") {
      claim.child_id = null;
      for (const item of [...c.evidence, ...c.grants]) item.child_id = null;
    }
    expect(parseAvdCase(seal(c)).grants.map(item => item.amount.value)).toEqual([10000, 7500]);
    const duplicate = mutable(c);
    duplicate.funding_pools[0].claims.push({ ...claim, id: "another-full-claim" });
    expect(() => parseAvdCase(seal(duplicate))).toThrow(/duplicate_identity/);
    for (const grant of c.grants) grant.amount.value = 17500;
    expect(() => parseAvdCase(seal(c))).toThrow(/grant_overallocation/);
  });
}

test("R84-N1: open assignments do not invent payment and incomplete closed assignments fail", () => {
  const c = mutable(fixture().input);
  const claim = c.funding_pools[0].claims[0];
  c.grants.pop();
  expect(() => parseAvdCase(seal(c))).toThrow(/grant_incomplete_allocation/);
  claim.allocation = "open";
  expect(() => parseAvdCase(seal(c))).toThrow(/open_grant_assignment/);
  c.evidence[0].status = "ungeklaert";
  c.grants[0].treatment = "unresolved";
  c.grants[0].amount = { class: "O", value: null, reason: "Synthetic allocation is open" };
  expect(parseAvdCase(seal(c)).grants[0].amount.value).toBeNull();
  const { catalog } = fixture();
  expect(planComparison(seal(c), catalog).entries.every(entry => entry.snapshot.grants.length === 0)).toBe(true);
});

test("R84-N1: person/year isolation, child uniqueness and indirect assignment limit", () => {
  const c = mutable(fixture().input);
  const shared = c.funding_pools[0];
  c.regimes.push({ ...c.regimes[0], id: "independent-2027", year: 2027 });
  c.funding_pools.push({ ...shared, id: "applicant-2027", year: 2027, regime_id: "independent-2027", claims: [] });
  c.funding_pools.push({ ...shared, id: "partner-2026", person_id: "partner", contract_ids: [], claims: [] });
  expect(parseAvdCase(seal(c)).funding_pools).toHaveLength(3);
  c.funding_pools[2].claims.push({ ...shared.claims[0], allocation: "open" });
  expect(() => parseAvdCase(seal(c))).toThrow(/duplicate_identity: \$\.funding_pools.children/);
  c.funding_pools[2].claims = [];
  shared.eligibility = "indirect";
  expect(() => parseAvdCase(seal(c))).toThrow(/funding_direct_pool/);
  shared.direct_pool_id = "partner-2026";
  expect(() => parseAvdCase(seal(c))).toThrow(/grant_contract_limit/);
  c.grants.pop();
  c.grants[0].amount.value = 17500;
  expect(parseAvdCase(seal(c)).grants).toHaveLength(1);
});

test("R84-N1: dependent contributions invalidate both paths, but a later one-time payment preserves B", () => {
  const { input, catalog } = fixture();
  const original = candidate(input, catalog);
  const shared = nextCase(input, c => { c.payments[0].amount.value = 12000; });
  expect(() => verifyComparison(shared, catalog, candidate(shared, catalog, { previous: original, reuse: "path-2" })))
    .toThrow(/calculation_binding/);
  const independent = nextCase(input, c => {
    c.payments.push({ ...c.payments[0], id: "later-payment", on: "2027-01-01", cadence: "once", kind: "extra" });
  });
  const accepted = verifyComparison(independent, catalog, candidate(independent, catalog, { previous: original, reuse: "path-2" }));
  expect(accepted.comparison.subresults[6].calculation).toEqual(original.subresults[6].calculation);
});
