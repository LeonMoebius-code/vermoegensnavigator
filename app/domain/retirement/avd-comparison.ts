import { jsonHash } from "../case/recovery-hash";
import { applyCaseOverride, parseCatalog, publicCatalog, validateCostSelection } from "./catalog-validation";
import { MODEL_VERSIONS, refKey, revisionHash, type Checked, type Kind, type Ref } from "./identity-contract";
import type { ValidatedCatalog } from "./catalog-contract";
import type { Channel } from "./source-contract";
import { caseIdentity, caseRef, caseReferences, catalogIdentity, fundingVariant, parseAvdCase, pathReferences,
  sameData, type AvdCase, type AvdPath, type AvdScenario, type CatalogIdentity, type FundingVariant } from "./avd-case";
import { amountCents, copyAvd, day, description, digest, id, kind, list, nullable, oneOf, requireAvd, revision,
  shape, stamp, unique, type Rule } from "./avd-data";

function checked<T>(result: Checked<T>) {
  requireAvd(result.ok, result.ok ? "" : result.issue.code, result.ok ? "" : result.issue.path);
  return result.value;
}
export function readCatalog(input: unknown): ValidatedCatalog {
  return checked(parseCatalog(input));
}
export const catalogRef = (catalog: ValidatedCatalog): CatalogIdentity =>
  ({ id: catalog.id, revision: catalog.revision, hash: catalog.hash });

type CurrentCatalog = {
  value: ValidatedCatalog;
  get<K extends Kind>(reference: Ref<K>, kind: K): Extract<ValidatedCatalog["records"][number], {kind: K}>;
  closure(roots: readonly Ref[]): Ref[];
};
const referenceShape = shape({ kind, id, revision, hash: digest });
function isRef(value: Record<string, unknown>): value is Record<string, unknown> & Ref {
  return Object.keys(value).length === 4 && "kind" in value && "id" in value && "revision" in value && "hash" in value;
}
function references(input: unknown): Ref[] {
  const found: Ref[] = [];
  function collect(value: unknown) {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (isRef(record)) found.push(referenceShape(record, "$.catalog.reference"));
    else Object.values(record).forEach(collect);
  }
  collect(input);
  return found;
}

function currentCatalog(value: ValidatedCatalog): CurrentCatalog {
  const records = new Map(value.records.map(record => [refKey(record), record]));
  const active = new Set(value.current.map(refKey));
  function get<K extends Kind>(ref: Ref<K>, expected: K) {
    const record = records.get(refKey(ref));
    requireAvd(record && record.hash === ref.hash && record.kind === expected && active.has(refKey(ref)),
      "catalog_reference_not_current", ref.id);
    return record as Extract<ValidatedCatalog["records"][number], {kind: K}>;
  }
  function closure(roots: readonly Ref[]) {
    const visited = new Map<string, Ref>();
    const queue = [...roots];
    for (let i = 0; i < queue.length; i++) {
      const ref = queue[i];
      const key = refKey(ref);
      // Match the exact hash even when the same kind/id/revision was visited.
      const record = get(ref, ref.kind);
      if (visited.has(key)) continue;
      requireAvd(visited.size < 1000, "dependency_limit", "$.catalog");
      visited.set(key, ref);
      queue.push(...references(record.data), ...record.citations.map(item => item.source));
    }
    return Array.from(visited).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, ref]) => ref);
  }
  return { value, get, closure };
}

function assertCaseCatalog(value: AvdCase, catalog: CurrentCatalog) {
  requireAvd(sameData(value.catalog, catalogRef(catalog.value)) && value.as_of === catalog.value.asOf,
    "catalog_snapshot_mismatch", "$.catalog");
  requireAvd(value.mode !== "synthetic_fixture" || catalog.value.origin === "synthetic",
    "synthetic_catalog_required", "$.catalog");
  for (const ref of caseReferences(value)) catalog.get(ref, ref.kind);
}

function pathContext(value: AvdCase, path: AvdPath, catalog: CurrentCatalog) {
  requireAvd(path.model_version === MODEL_VERSIONS[path.model], "model_version", path.id);
  const product = catalog.get(path.product, "product").data;
  const tariff = catalog.get(path.tariff, "tariff").data;
  const savings = catalog.get(path.savings_cost, "cost").data;
  const payout = catalog.get(path.payout_cost, "cost").data;
  requireAvd(sameData(tariff.product, path.product)
    && path.allocation.every(item => tariff.fundOptions.some(ref => sameData(ref, item.fund))), "tariff_scope", path.id);
  if (path.portfolio) {
    const portfolio = catalog.get(path.portfolio, "portfolio").data;
    requireAvd(tariff.portfolios.some(item => sameData(item, path.portfolio))
      && path.allocation.length === portfolio.weights.length
      && path.allocation.every(item => portfolio.weights.some(weight =>
        weight.basisPoints === item.basis_points && sameData(weight.fund, item.fund))), "portfolio_scope", path.id);
  } else requireAvd(path.allocation.every(item => item.basis_points % 1000 === 0), "individual_weight_step", path.id);
  requireAvd(savings.phase === "savings" && (savings.mode === "K1" || savings.mode === "K2")
    && payout.phase === "payout" && [savings, payout].every(cost =>
      sameData(cost.product, path.product) && sameData(cost.tariff, path.tariff)), "cost_scope", path.id);
  requireAvd(savings.mode !== "K1" || (savings.model === path.model && savings.modelVersion === path.model_version),
    "cost_model_mismatch", path.id);
  requireAvd(path.payout !== null || payout.mode === "before_payout_costs", "payout_scope", path.id);
  requireAvd(!path.payout?.annuity_factor || sameData(path.payout.annuity_factor, tariff.annuityFactor),
    "annuity_scope", path.id);
  requireAvd(!path.payout?.rent_offer || path.payout.rent_offer.on <= value.as_of, "future_offer", path.id);
  const rootRefs = pathReferences({ ...path, overrides: [] });
  const closure = catalog.closure([...rootRefs, ...value.assumptions]);
  for (const override of path.overrides) {
    const parameter = catalog.get(override.base, "parameter").data;
    requireAvd(closure.some(ref => sameData(ref, override.base))
      && (parameter.productId === null || parameter.productId === path.product.id)
      && (parameter.tariffId === null || parameter.tariffId === path.tariff.id),
    "override_dependency_scope", path.id);
    checked(applyCaseOverride(catalog.value, override));
  }
  const available = product.capabilities.some(item =>
    item.model === path.model && item.version === path.model_version && item.status === "available");
  return { savings, payout, rootRefs, available };
}

/** A draft can contain open inputs. A plan needs an explicit, nonempty Cartesian product. */
export function validateCaseCatalog(caseInput: unknown, catalogInput: unknown): AvdCase {
  const value = parseAvdCase(caseInput);
  const catalog = currentCatalog(readCatalog(catalogInput));
  assertCaseCatalog(value, catalog);
  for (const path of value.paths) pathContext(value, path, catalog);
  return value;
}

const keyShape = shape({ path_id: id, scenario_id: id, funding_variant: fundingVariant });
export type SubresultKey = ReturnType<typeof keyShape>;
export const keyOf = (key: SubresultKey) => JSON.stringify([key.path_id, key.scenario_id, key.funding_variant]);

function dependencies(value: AvdCase, path: AvdPath, scenario: AvdScenario, funding: FundingVariant, roots: readonly Ref[],
  catalog: CurrentCatalog) {
  const subject = (item: {contract_id: string; child_id: string | null}) =>
    path.contracts.includes(item.contract_id) && (item.child_id === null || path.children.includes(item.child_id));
  const people = value.people.filter(item => path.people.includes(item.id) || path.children.includes(item.id));
  const contracts = value.contracts.filter(item => path.contracts.includes(item.id));
  const evidence = value.evidence.filter(subject);
  const payments = value.payments.filter(subject);
  const riester = value.riester.filter(item => path.contracts.includes(item.contract_id));
  const grants = value.grants.filter(item => subject(item) && (item.treatment === "confirmed" ||
    (funding === "with_conditional" && item.treatment === "conditional")));
  const catalog_refs = catalog.closure([...roots, ...value.assumptions, ...value.sources,
    ...scenario.assumptions, ...scenario.sources, ...value.regimes.flatMap(item => item.sources),
    ...evidence.flatMap(item => item.sources), ...riester.flatMap(item => [...item.parameters, ...item.sources])]);
  return { case_id: value.case_id, mode: value.mode, as_of: value.as_of, route: value.route,
    people, contracts, evidence, payments, riester, grants, regimes: value.regimes,
    assumptions: value.assumptions, sources: value.sources, path, scenario, funding, catalog_refs };
}

function planFor(value: AvdCase, catalog: CurrentCatalog) {
  assertCaseCatalog(value, catalog);
  requireAvd(value.paths.length && value.scenarios.length && value.funding_variants.length, "empty_comparison", "$");
  const entries = [];
  for (const path of value.paths) {
    const { savings, payout, rootRefs, available } = pathContext(value, path, catalog);
    const costChecks = new Map<string, ReturnType<typeof validateCostSelection>>();
    for (const scenario of value.scenarios) {
      unique(scenario.returns.deducted.map(item => item.phase + ":" + item.component), scenario.id);
      requireAvd((scenario.returns.basis === "gross") === (scenario.returns.deducted.length === 0),
        "return_basis_mismatch", scenario.id);
      const returnKey = jsonHash(scenario.returns);
      let selection = costChecks.get(returnKey);
      if (!selection) {
        selection = validateCostSelection(catalog.value, {
          product: path.product, tariff: path.tariff, model: path.model, modelVersion: path.model_version,
          costs: [path.savings_cost, path.payout_cost], returns: scenario.returns
        });
        costChecks.set(returnKey, selection);
      }
      const blocked = !available || [savings, payout].some(cost => cost.mode === "K2" && cost.status === "blocked")
        || payout.mode === "open";
      if (!selection.ok) {
        requireAvd(blocked && ["model_blocked", "K2_blocked", "payout_costs_open"].includes(selection.issue.code),
          selection.issue.code, selection.issue.path);
      }
      for (const funding of value.funding_variants) {
        const key = { path_id: path.id, scenario_id: scenario.id, funding_variant: funding };
        const snapshot = dependencies(value, path, scenario, funding, rootRefs, catalog);
        const dependency_hash = jsonHash({ format: "avd.dependencies.v1", snapshot, key,
          savings_mode: savings.mode, payout_mode: payout.mode });
        const modes = { savings: savings.mode, payout: payout.mode };
        const hasConditionalGrant = snapshot.grants.some(item => item.treatment === "conditional");
        entries.push({ key, dependency_hash, snapshot, modes, blocked: !selection.ok ||
          scenario.annual_return_bps === null || snapshot.payments.some(item => item.amount.class === "O") ||
          (funding === "with_conditional" && !hasConditionalGrant) });
      }
    }
  }
  const dependency_manifest = {
    format: "avd.dependencies.v1" as const, case: caseRef(value), catalog: catalogRef(catalog.value),
    entries: entries.map(({ key, dependency_hash }) => ({ key, dependency_hash }))
  };
  return { dependency_manifest, entries };
}

export function planComparison(caseInput: unknown, catalogInput: unknown) {
  return planFor(parseAvdCase(caseInput), currentCatalog(readCatalog(catalogInput)));
}
export type ComparisonPlan = ReturnType<typeof planComparison>;

const calculationOrigin = shape({
  case: caseIdentity, comparison_revision: revision, subresult_id: id, calculated_at: stamp
});
const blockedResult = shape({ status: oneOf("nicht_berechenbar"), reason: description });
const numericResult = shape({ status: oneOf("aktuell_berechnet", "bedingt_berechnet"), capital_cents: amountCents });
const resultRule: Rule<ReturnType<typeof blockedResult> | ReturnType<typeof numericResult>> = (input, at) =>
  (input as { status?: unknown } | null)?.status === "nicht_berechenbar"
    ? blockedResult(input, at) : numericResult(input, at);
const calculationShape = shape({
  format: oneOf("avd.calculation.v1"), calculation_id: id, hash: digest, dependency_hash: digest,
  key: keyShape, as_of: day,
  origin: calculationOrigin, result: resultRule
});
const entryShape = shape({
  subresult_id: id, key: keyShape, calculation: calculationShape
});
const manifestShape = shape({
  format: oneOf("avd.dependencies.v1"), case: caseIdentity, catalog: catalogIdentity,
  entries: list(shape({ key: keyShape, dependency_hash: digest }), 96, 1)
});
const comparisonShape = shape({
  format: oneOf("avd.comparison.v1"), comparison_revision: revision, previous_hash: nullable(digest), hash: digest,
  recorded_at: stamp, dependency_manifest: manifestShape, subresults: list(entryShape, 96, 1)
});
export type Calculation = ReturnType<typeof calculationShape>;
export type Comparison = ReturnType<typeof comparisonShape>;
export const comparisonIdentity = shape({ comparison_revision: revision, hash: digest });
export type ComparisonIdentity = ReturnType<typeof comparisonIdentity>;
export const comparisonRef = (comparison: Comparison): ComparisonIdentity =>
  ({ comparison_revision: comparison.comparison_revision, hash: comparison.hash });
/** Reserved for the later output producer. An eligibility check allocates no export ID. */
export type ExportIdentity = Readonly<{ export_id: string }>;

export function parseComparison(input: unknown): Comparison {
  const value = comparisonShape(copyAvd(input), "$");
  requireAvd(revisionHash(value) === value.hash, "content_hash_mismatch", "$.comparison");
  requireAvd((value.comparison_revision === 1) === (value.previous_hash === null), "invalid_predecessor", "$.comparison");
  unique(value.subresults.map(item => item.subresult_id), "$.subresults");
  unique(value.subresults.map(item => keyOf(item.key)), "$.subresults.keys");
  unique(value.subresults.map(item => item.calculation.calculation_id), "$.calculations");
  return value;
}

export function parseCalculation(input: unknown): Calculation {
  const value = calculationShape(copyAvd(input), "$.calculation");
  requireAvd(revisionHash(value) === value.hash, "content_hash_mismatch", "$.calculation");
  return value;
}

/** Historical and current verification both use the exact supplied case and catalog snapshots. */
export function verifyComparison(caseInput: unknown, catalogInput: unknown, candidate: unknown) {
  const value = parseAvdCase(caseInput);
  const catalog = currentCatalog(readCatalog(catalogInput));
  const plan = planFor(value, catalog);
  const comparison = parseComparison(candidate);
  requireAvd(sameData(comparison.dependency_manifest, plan.dependency_manifest),
    "dependency_manifest_mismatch", "$.dependency_manifest");
  const expected = new Map(plan.entries.map(entry => [keyOf(entry.key), entry]));
  requireAvd(comparison.subresults.length === expected.size, "incomplete_comparison", "$.subresults");
  requireAvd(comparison.recorded_at >= value.metadata.changed_at, "comparison_time", "$.recorded_at");
  for (const item of comparison.subresults) {
    const calculation = item.calculation;
    const entry = expected.get(keyOf(item.key));
    requireAvd(entry && sameData(calculation.key, item.key), "unexpected_subresult", item.subresult_id);
    requireAvd(calculation.hash === revisionHash(calculation) && calculation.dependency_hash === entry.dependency_hash &&
      calculation.as_of === value.as_of, "calculation_binding", item.subresult_id);
    requireAvd(calculation.origin.case.case_id === value.case_id
      && calculation.origin.case.case_revision <= value.case_revision
      && calculation.origin.comparison_revision <= comparison.comparison_revision
      && calculation.origin.calculated_at <= comparison.recorded_at, "calculation_origin", item.subresult_id);
    if (calculation.origin.comparison_revision === comparison.comparison_revision) {
      requireAvd(sameData(calculation.origin.case, caseRef(value)) && calculation.origin.subresult_id === item.subresult_id
        && calculation.origin.calculated_at >= value.metadata.changed_at, "calculation_origin", item.subresult_id);
    }
    if (calculation.result.status !== "nicht_berechenbar") {
      requireAvd(value.mode === "synthetic_fixture" && !entry.blocked, "real_calculation_unavailable", item.subresult_id);
      requireAvd(calculation.result.status === (item.key.funding_variant === "with_conditional" ? "bedingt_berechnet" : "aktuell_berechnet"),
        "result_funding_variant", item.subresult_id);
    }
  }
  return { comparison, plan };
}

export function assertCatalogPublication(catalog: ValidatedCatalog, channel: Channel) {
  checked(publicCatalog(catalog, channel));
}
