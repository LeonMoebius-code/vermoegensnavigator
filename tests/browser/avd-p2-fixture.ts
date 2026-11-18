import { caseRef, type AvdCase } from "../../app/domain/retirement/avd-case";
import { catalogRef, keyOf, planComparison, type Comparison, type Calculation } from "../../app/domain/retirement/avd-comparison";
import { reference, revisionHash, MODEL_VERSIONS } from "../../app/domain/retirement/identity-contract";
import type { Catalog, CatalogRecord } from "../../app/domain/retirement/catalog-contract";
import { record, reseal, syntheticCatalog } from "./avd-catalog-fixture";

export const TIME = "2026-11-17T12:00:00.000Z";
export const LATER = "2026-11-17T12:01:00.000Z";
export const LATEST = "2026-11-17T12:02:00.000Z";
type Mutable<T> = T extends object ? { -readonly [P in keyof T]: Mutable<T[P]> } : T;
export function mutable<T>(value: T): Mutable<T> { return structuredClone(value) as Mutable<T>; }
export function seal<T extends object>(value: T): T & {hash: string} { return { ...value, hash: revisionHash(value) }; }
const declared = (value: number) => ({ class: "A" as const, value, reason: "Synthetic assumption" });
const conditional = (value: number) => ({ class: "S" as const, value, reason: "Synthetic condition explicitly assumed" });
const subject = { person_id: "applicant", contract_id: "contract-1", child_id: "child" };
const law = { year: 2026, regime_id: "law-2026" };

export function fixture(addSharedSource = false) {
  const catalog = syntheticCatalog();
  if (addSharedSource) {
    const extra = structuredClone(record(catalog, "synthetic-source", "source"));
    (extra as {id: string}).id = "synthetic-independent-rule-source";
    catalog.records.push(extra);
    catalog.current.push(reference(extra));
    reseal(catalog);
  }
  const source = reference(record(catalog, addSharedSource ? "synthetic-independent-rule-source" : "synthetic-source", "source"));
  const value: Omit<AvdCase, "hash"> = {
    format: "avd.case.v1", case_id: "artificial-case", case_revision: 1, previous_hash: null, origin: null,
    catalog: catalogRef(catalog), mode: "synthetic_fixture", as_of: catalog.asOf, route: "A",
    metadata: { created_at: TIME, changed_at: TIME, changed_by: "artificial-agent", change_id: "change-1" },
    advisory_case: { id: "general-case-link-only" },
    people: [
      { id: "applicant", role: "applicant", born_on: "1980-01-01" },
      { id: "partner", role: "partner", born_on: null },
      { id: "child", role: "child", born_on: "2015-01-01" }
    ],
    contracts: [
      ...[1, 2].map(n => ({ id: "contract-" + n, person_id: "applicant", kind: "avd" as const, starts_on: "2026-11-01" })),
      { id: "existing-riester", person_id: "applicant", kind: "riester", starts_on: "2010-01-01" }
    ],
    regimes: [{ id: law.regime_id, year: law.year, version: "rule-v1", sources: [source] }],
    payments: [1, 2].map(n => ({ id: "pay-" + n, person_id: "applicant", contract_id: "contract-" + n,
      child_id: null, on: "2026-11-01", amount: declared(10000), cadence: "monthly", until: null, kind: "regular" })),
    evidence: [1, 2].map(n => ({ ...subject, contract_id: "contract-" + n, ...law, id: "proof-" + n,
      route: "A", axis: "person", status: "bedingt", checked_on: catalog.asOf, proof_id: "declaration-" + n, sources: [source] })),
    grants: [1, 2].map(n => ({ ...subject, contract_id: "contract-" + n, ...law, id: "grant-" + n,
      on: "2027-05-01", treatment: "conditional", amount: conditional(17500), evidence_id: "proof-" + n })),
    riester: [{ contract_id: "existing-riester", as_of: catalog.asOf, balance: declared(12345), strategy: "continue",
      parameters: [], sources: [source] }],
    assumptions: [], sources: [source], funding_variants: ["without_unconfirmed", "with_conditional"],
    scenarios: ["low", "middle", "high"].map((id, i) => ({ id, version: "scenario-v1", annual_return_bps: i * 300,
      returns: { basis: "gross", deducted: [] }, assumptions: [], sources: [source] })),
    paths: [1, 2].map(n => ({
      id: "path-" + n, product: reference(record(catalog, "synthetic-product-" + n, "product")),
      tariff: reference(record(catalog, "synthetic-tariff-" + n, "tariff")), model: "M1", model_version: MODEL_VERSIONS.M1,
      savings_cost: reference(record(catalog, "synthetic-k1-m1-" + n, "cost")),
      payout_cost: reference(record(catalog, "synthetic-payout-" + n, "cost")),
      people: ["applicant", "partner"], children: ["child"], contracts: ["contract-" + n, "existing-riester"],
      portfolio: null, allocation: [{ fund: reference(record(catalog, "synthetic-fund-1", "fund")), basis_points: 10000 }],
      parameters: [], sources: [], overrides: [], payout: null
    }))
  };
  return { catalog, input: seal(value) };
}

export function nextCase(input: AvdCase, edit: (draft: Mutable<AvdCase>) => void = () => {}, at = LATER): AvdCase {
  const candidate = mutable(input);
  candidate.case_revision++;
  candidate.previous_hash = input.hash;
  candidate.origin = null;
  candidate.metadata.changed_at = at;
  candidate.metadata.change_id = "change-" + candidate.case_revision;
  edit(candidate);
  return seal(candidate);
}

export function nextCatalog(input: Catalog, updateSource = false): Catalog {
  const next = structuredClone(input);
  next.revision++;
  next.previousHash = input.hash;
  if (updateSource) {
    const prior = record(next, "synthetic-independent-rule-source", "source");
    const source = structuredClone(prior);
    (source as {revision: number}).revision++;
    source.previous = reference(prior);
    source.data.documentVersion = "test.v2";
    source.data.documentHash = revisionHash({ version: "synthetic-revised-source" });
    next.records.push(source);
    next.current = next.current.map(ref => ref.id === prior.id && ref.kind === "source" ? reference(source) : ref);
  }
  return reseal(next);
}

/** Artificial records exercising export approval without producing capital values. */
export function exportBoundaryFixture(released: boolean) {
  const { catalog, input } = fixture();
  catalog.origin = "working";
  if (released) for (const record of catalog.records) {
    record.publication = {
      state: "released", channels: ["export"],
      approval: { authority: "synthetic", record: "artificial-approval", approvedOn: catalog.asOf }
    };
  }
  reseal(catalog);
  const working = mutable(input);
  working.mode = "working";
  working.catalog = catalogRef(catalog);
  // Publication metadata changes the record hashes. Rebind all references.
  function rebind(value: unknown): void {
    if (Array.isArray(value)) { value.forEach(rebind); return; }
    if (value === null || typeof value !== "object") return;
    const row = value as Record<string, unknown>;
    if ("kind" in row && "hash" in row && "id" in row && "revision" in row) {
      const target = catalog.current.find(ref => ref.kind === row.kind && ref.id === row.id && ref.revision === row.revision);
      if (!target) throw Error("Fixture reference missing");
      row.hash = target.hash;
    } else Object.values(row).forEach(rebind);
  }
  rebind(working);
  return { input: seal(working), catalog };
}

export function productCostCatalog(input: Catalog): Catalog {
  const next = nextCatalog(input);
  const old = record(next, "synthetic-k1-m1-1", "cost");
  const cost = structuredClone(old);
  (cost as {revision: number}).revision++;
  cost.previous = reference(old);
  const prior = record(next, "synthetic-cost-1", "parameter");
  if (cost.data.mode !== "K1") throw Error("Fixture");
  const parameter = structuredClone(prior);
  (parameter as {revision: number}).revision++;
  parameter.previous = reference(prior);
  parameter.data.value = { class: "A", value: 0.025, reason: "Artificial adjusted cost" };
  cost.data.parameter = reference(parameter);
  // M2 still needs the old value historically. Replace the active M2 cost revision too.
  const oldM2 = record(next, "synthetic-k1-m2-1", "cost");
  const m2 = structuredClone(oldM2);
  (m2 as {revision: number}).revision++;
  m2.previous = reference(oldM2);
  if (m2.data.mode !== "K1") throw Error("Fixture");
  m2.data.parameter = reference(parameter);
  const revised: CatalogRecord[] = [parameter, cost, m2];
  next.records.push(...revised);
  next.current = next.current.map(ref => {
    const replacement = revised.find(item => item.kind === ref.kind && item.id === ref.id);
    return replacement ? reference(replacement) : ref;
  });
  return reseal(next);
}

export function candidate(input: AvdCase, catalog: Catalog, options: {
  previous?: Comparison; reuse?: string; blocked?: boolean; run?: string; at?: string
} = {}): Comparison {
  const plan = planComparison(input, catalog);
  const comparison_revision = (options.previous?.comparison_revision ?? 0) + 1;
  const recorded_at = options.at ?? input.metadata.changed_at;
  const subresults = plan.entries.map((entry, i) => {
    const subresult_id = "sub-" + comparison_revision + "-" + i;
    const from = options.reuse === entry.key.path_id
      ? options.previous?.subresults.find(row => keyOf(row.key) === keyOf(entry.key)) : undefined;
    const result: Calculation["result"] = options.blocked ? { status: "nicht_berechenbar", reason: "Synthetic missing evidence" } :
      { status: entry.key.funding_variant === "with_conditional" ? "bedingt_berechnet" : "aktuell_berechnet",
        capital_cents: 100000 + i };
    const calculation: Calculation = from?.calculation ?? seal({
      format: "avd.calculation.v1" as const, calculation_id: "calc-" + (options.run ?? comparison_revision) + "-" + i,
      key: entry.key, dependency_hash: entry.dependency_hash, as_of: input.as_of, result,
      origin: { case: caseRef(input), subresult_id, comparison_revision, calculated_at: recorded_at }
    });
    return { key: entry.key, subresult_id, calculation };
  });
  return seal({
    format: "avd.comparison.v1", comparison_revision, previous_hash: options.previous?.hash ?? null,
    recorded_at, dependency_manifest: plan.dependency_manifest, subresults
  });
}
