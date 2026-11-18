import { canonicalJson } from "../case/recovery-hash";
import { revisionHash, type Ref } from "./identity-contract";
import {
  amountCents, avdRef, copyAvd, day, description, digest, id, integer, list, nullable,
  oneOf, requireAvd, revision, shape, stamp, unique, type Rule
} from "./avd-data";

const taggedAmount = shape({ class: oneOf("B", "A", "S", "O"), value: nullable(amountCents), reason: description });
const amount: Rule<ReturnType<typeof taggedAmount>> = (input, at) => {
  const value = taggedAmount(input, at);
  requireAvd((value.class === "O") === (value.value === null), "amount_openness", at);
  return value;
};
const route = oneOf("A", "B");
const year = integer(100, 9999);
const phase = oneOf("savings", "payout");
const evidenceStatus = oneOf("bestaetigt", "bedingt", "ungeklaert", "nicht_erfuellt");
export const fundingVariant = oneOf("without_unconfirmed", "with_conditional");
const model = oneOf("M1", "M2", "M3");
const component = oneOf("fund_ter", "acquisition", "administration", "custody", "transaction", "payout");
const sources = list(avdRef("source"), 48);
const parameters = list(avdRef("parameter"), 48);
export const catalogIdentity = shape({ id, revision, hash: digest });
export const caseIdentity = shape({ case_id: id, case_revision: revision, hash: digest });
const comparisonOrigin = shape({ kind: oneOf("copy", "restore"), case: caseIdentity });
const subject = { person_id: id, contract_id: id, child_id: nullable(id) };
const legalContext = { year, regime_id: id };
const scenarioValue: Rule<number | string> = (input, at) => {
  if (typeof input === "string") return day(input, at);
  requireAvd(typeof input === "number" && Number.isFinite(input), "invalid_assumption", at);
  return input;
};
const override = shape({
  format: oneOf("avd.override.v1"), id, caseId: id, base: avdRef("parameter"),
  value: shape({ class: oneOf("S"), value: scenarioValue, reason: description }), recordedOn: day
});
const scenario = shape({
  id, version: id, annual_return_bps: nullable(integer(-10000, 100000)),
  returns: shape({ basis: oneOf("gross", "net"), deducted: list(shape({ phase, component }), 12) }),
  assumptions: parameters, sources
});
const path = shape({
  id, product: avdRef("product"), tariff: avdRef("tariff"), model, model_version: id,
  savings_cost: avdRef("cost"), payout_cost: avdRef("cost"),
  people: list(id, 32, 1), children: list(id, 30), contracts: list(id, 24, 1),
  portfolio: nullable(avdRef("portfolio")),
  allocation: list(shape({ fund: avdRef("fund"), basis_points: integer(1, 10000) }), 24, 1),
  parameters, sources, overrides: list(override, 48),
  payout: nullable(shape({
    starts_on: nullable(day), ends_on: nullable(day), monthly_amount: amount,
    annuity_factor: nullable(avdRef("parameter")),
    rent_offer: nullable(shape({ source: avdRef("source"), on: day, monthly_amount: amount }))
  }))
});
const caseShape = shape({
  format: oneOf("avd.case.v1"), case_id: id, case_revision: revision, hash: digest,
  previous_hash: nullable(digest), origin: nullable(comparisonOrigin), catalog: catalogIdentity,
  mode: oneOf("working", "synthetic_fixture"), as_of: day, route,
  metadata: shape({ created_at: stamp, changed_at: stamp, changed_by: id, change_id: id }),
  advisory_case: nullable(shape({ id })),
  people: list(shape({ id, role: oneOf("applicant", "partner", "child"), born_on: nullable(day) }), 32, 1),
  contracts: list(shape({ id, person_id: id, kind: oneOf("avd", "riester"), starts_on: nullable(day) }), 24),
  regimes: list(shape({ id, year, version: id, sources: list(avdRef("source"), 8, 1) }), 60),
  evidence: list(shape({
    id, ...subject, ...legalContext, route, axis: oneOf("person", "contract", "law"), status: evidenceStatus,
    checked_on: day, proof_id: nullable(id), sources
  }), 400),
  payments: list(shape({
    id, ...subject, on: day, until: nullable(day), cadence: oneOf("once", "monthly"),
    kind: oneOf("regular", "extra", "payout"), amount
  }), 500),
  grants: list(shape({
    id, ...subject, ...legalContext, on: day, treatment: oneOf("confirmed", "conditional", "unresolved"),
    evidence_id: id, amount
  }), 500),
  riester: list(shape({
    contract_id: id, as_of: day, balance: amount, strategy: oneOf("continue", "pause", "transfer", "terminate_4a", "terminate_4b", "unresolved"),
    parameters, sources
  }), 24),
  assumptions: parameters,
  sources,
  scenarios: list(scenario, 6),
  funding_variants: list(fundingVariant, 2),
  paths: list(path, 8)
});

export type AvdCase = ReturnType<typeof caseShape>;
export type CaseIdentity = ReturnType<typeof caseIdentity>;
export type CatalogIdentity = ReturnType<typeof catalogIdentity>;
export type FundingVariant = ReturnType<typeof fundingVariant>;
export type AvdPath = ReturnType<typeof path>;
export type AvdScenario = ReturnType<typeof scenario>;
export const caseRef = (value: AvdCase): CaseIdentity =>
  ({ case_id: value.case_id, case_revision: value.case_revision, hash: value.hash });

export function sameData(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

export function parseAvdCase(input: unknown): AvdCase {
  const value = caseShape(copyAvd(input), "$");
  requireAvd(revisionHash(value) === value.hash, "content_hash_mismatch", "$");
  requireAvd((value.case_revision === 1) === (value.previous_hash === null), "invalid_predecessor", "$.previous_hash");
  requireAvd(value.metadata.created_at <= value.metadata.changed_at, "time_order", "$.metadata");
  if (value.origin?.kind === "copy") {
    requireAvd(value.case_revision === 1 && value.origin.case.case_id !== value.case_id, "copy_origin", "$.origin");
  }
  if (value.origin?.kind === "restore") {
    requireAvd(value.origin.case.case_id === value.case_id && value.origin.case.case_revision < value.case_revision,
      "restore_origin", "$.origin");
  }
  const people = new Map(value.people.map(person => [person.id, person]));
  const contracts = new Map(value.contracts.map(contract => [contract.id, contract]));
  const regimes = new Map(value.regimes.map(regime => [regime.id, regime]));
  const evidence = new Map(value.evidence.map(entry => [entry.id, entry]));
  for (const values of [value.people, value.contracts, value.regimes, value.evidence, value.payments, value.grants, value.scenarios, value.paths]) {
    unique(values.map(item => item.id), "$.identities");
  }
  unique(value.funding_variants, "$.funding_variants");
  unique(value.riester.map(item => item.contract_id), "$.riester");
  requireAvd(value.people.filter(person => person.role === "applicant").length === 1
    && value.people.filter(person => person.role === "partner").length <= 1, "personal_roles", "$.people");
  for (const person of value.people) requireAvd(!person.born_on || person.born_on <= value.as_of, "future_birth", person.id);
  for (const contract of value.contracts) {
    const person = people.get(contract.person_id);
    requireAvd(person && person.role !== "child", "contract_holder", contract.id);
  }
  function checkSubject(item: { person_id: string; contract_id: string; child_id: string | null }, at: string) {
    requireAvd(contracts.get(item.contract_id)?.person_id === item.person_id, "subject_contract", at);
    requireAvd(item.child_id === null || people.get(item.child_id)?.role === "child", "subject_child", at);
  }
  function checkRegime(item: { year: number; regime_id: string }, at: string) {
    requireAvd(regimes.get(item.regime_id)?.year === item.year, "funding_regime", at);
  }
  for (const entry of value.evidence) {
    checkSubject(entry, entry.id);
    checkRegime(entry, entry.id);
    requireAvd(entry.route === value.route && entry.checked_on <= value.as_of, "evidence_context", entry.id);
    requireAvd(entry.status === "ungeklaert" || entry.proof_id !== null, "evidence_missing_proof", entry.id);
  }
  for (const payment of value.payments) {
    checkSubject(payment, payment.id);
    requireAvd(payment.cadence === "once" ? payment.until === null : payment.until === null || payment.on <= payment.until,
      "payment_period", payment.id);
  }
  for (const grant of value.grants) {
    checkSubject(grant, grant.id);
    checkRegime(grant, grant.id);
    const proof = evidence.get(grant.evidence_id);
    requireAvd(proof && proof.person_id === grant.person_id && proof.contract_id === grant.contract_id
      && proof.child_id === grant.child_id && proof.year === grant.year && proof.regime_id === grant.regime_id,
      "grant_scope", grant.id);
    const treatment = { confirmed: "bestaetigt", conditional: "bedingt", unresolved: "ungeklaert" } as const;
    requireAvd(proof.status === treatment[grant.treatment]
      && (grant.treatment === "confirmed" ? grant.amount.class === "B" :
        grant.treatment === "conditional" ? grant.amount.class === "S" : grant.amount.class === "O"),
    "grant_evidence", grant.id);
  }
  for (const item of value.riester) {
    requireAvd(contracts.get(item.contract_id)?.kind === "riester" && item.as_of <= value.as_of, "riester_context", item.contract_id);
  }
  for (const entry of value.paths) {
    for (const ids of [entry.people, entry.children, entry.contracts, entry.overrides.map(item => item.id)]) unique(ids, entry.id);
    unique(entry.overrides.map(item => item.base.id), entry.id);
    requireAvd(entry.people.every(person => people.has(person) && people.get(person)?.role !== "child")
      && entry.children.every(child => people.get(child)?.role === "child"), "path_people", entry.id);
    requireAvd(entry.contracts.every(contract => {
      const holder = contracts.get(contract)?.person_id;
      return holder !== undefined && entry.people.includes(holder);
    }), "path_contracts", entry.id);
    unique(entry.allocation.map(item => item.fund.id), entry.id);
    requireAvd(entry.allocation.reduce((sum, item) => sum + item.basis_points, 0) === 10000, "allocation_total", entry.id);
    requireAvd(!entry.payout?.starts_on || !entry.payout.ends_on || entry.payout.starts_on <= entry.payout.ends_on,
      "payout_period", entry.id);
    requireAvd(entry.overrides.every(item => item.caseId === value.case_id && item.recordedOn === value.as_of), "override_scope", entry.id);
  }
  return value;
}

export function assertSuccessor(current: AvdCase, next: AvdCase) {
  requireAvd(next.case_id === current.case_id && next.case_revision === current.case_revision + 1
    && next.previous_hash === current.hash, "revision_conflict", "$.case_revision");
  requireAvd(next.metadata.created_at === current.metadata.created_at
    && next.metadata.changed_at >= current.metadata.changed_at
    && next.metadata.change_id !== current.metadata.change_id && next.mode === current.mode, "revision_metadata", "$.metadata");
  if (next.route !== current.route && next.origin?.kind !== "restore") {
    requireAvd(next.evidence.every(entry => entry.status === "ungeklaert" && entry.proof_id === null)
      && next.grants.every(entry => entry.treatment === "unresolved"), "route_evidence_reset", "$.evidence");
  }
}

type Change = Pick<AvdCase["metadata"], "changed_at" | "changed_by" | "change_id">;
function seal(draft: Omit<AvdCase, "hash">): AvdCase {
  return parseAvdCase({ ...draft, hash: revisionHash(draft) });
}

/** The source must already have been resolved and validated by the caller. */
export function originateCase(source: AvdCase, current: AvdCase | null, newId: string, change: Change): AvdCase {
  const next = seal({
    ...source,
    case_id: newId,
    case_revision: current ? current.case_revision + 1 : 1,
    previous_hash: current?.hash ?? null,
    origin: { kind: current ? "restore" : "copy", case: caseRef(source) },
    metadata: { ...change, created_at: current?.metadata.created_at ?? change.changed_at },
    paths: source.paths.map(entry => ({ ...entry, overrides: entry.overrides.map(item => ({ ...item, caseId: newId })) }))
  });
  if (current) assertSuccessor(current, next);
  return next;
}

/** Enumerate direct P1 references used by the case. P1 resolves the transitive graph. */
export function caseReferences(value: AvdCase): readonly Ref[] {
  return [
    ...value.sources, ...value.assumptions,
    ...value.regimes.flatMap(entry => entry.sources), ...value.evidence.flatMap(entry => entry.sources),
    ...value.riester.flatMap(entry => [...entry.sources, ...entry.parameters]),
    ...value.scenarios.flatMap(entry => [...entry.sources, ...entry.assumptions]),
    ...value.paths.flatMap(pathReferences)
  ];
}
export function pathReferences(entry: AvdPath): readonly Ref[] {
  return [entry.product, entry.tariff, entry.savings_cost, entry.payout_cost,
    ...(entry.portfolio ? [entry.portfolio] : []),
    ...entry.allocation.map(item => item.fund), ...entry.parameters, ...entry.sources,
    ...entry.overrides.map(item => item.base),
    ...(entry.payout?.annuity_factor ? [entry.payout.annuity_factor] : []),
    ...(entry.payout?.rent_offer ? [entry.payout.rent_offer.source] : [])];
}
