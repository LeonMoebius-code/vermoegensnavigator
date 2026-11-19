import { jsonHash } from "../case/recovery-hash";
import { applyCaseOverride, parseCatalog, publicCatalog, validateCostSelection } from "./catalog-validation";
import { MODEL_VERSIONS, refKey, revisionHash, type Checked, type Kind, type Ref } from "./identity-contract";
import type { ValidatedCatalog } from "./catalog-contract";
import type { Channel } from "./source-contract";
import { caseIdentity, caseRef, caseReferences, catalogIdentity, decisionInputHash, parseAvdCase, pathReferences, subresultKey,
  sameData, type AvdCase, type AvdPath, type AvdScenario, type BlockingDecision, type CatalogIdentity, type FundingVariant } from "./avd-case";
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
  return { savings, payout, rootRefs, available, accessRules: tariff.accessRules };
}

/** A draft can contain open inputs. A plan needs an explicit, nonempty Cartesian product. */
export function validateCaseCatalog(caseInput: unknown, catalogInput: unknown): AvdCase {
  const value = parseAvdCase(caseInput);
  const catalog = currentCatalog(readCatalog(catalogInput));
  assertCaseCatalog(value, catalog);
  for (const path of value.paths) pathContext(value, path, catalog);
  return value;
}

export type SubresultKey = ReturnType<typeof subresultKey>;
export const keyOf = (key: SubresultKey) => JSON.stringify([key.path_id, key.scenario_id, key.funding_variant]);

function dependencies(value: AvdCase, path: AvdPath, scenario: AvdScenario, funding: FundingVariant, roots: readonly Ref[],
  catalog: CurrentCatalog) {
  const subject = (item: {contract_id: string; child_id: string | null}) =>
    path.contracts.includes(item.contract_id) && (item.child_id === null || path.children.includes(item.child_id));
  const pathPools = value.funding_pools.filter(pool => pool.contract_ids.some(contract => path.contracts.includes(contract)));
  const poolIds = new Set(pathPools.flatMap(pool => pool.direct_pool_id === null ? [pool.id] : [pool.id, pool.direct_pool_id]));
  const pools = value.funding_pools.filter(pool => poolIds.has(pool.id));
  const poolPeople = new Set(pools.map(pool => pool.person_id));
  const claimChildren = new Set(pools.flatMap(pool => pool.claims.map(item => item.child_id)));
  const funding_pools = pools.map(pool => {
    const year = String(pool.year).padStart(4, "0");
    return {
      pool,
      contracts: value.contracts.filter(item => pool.contract_ids.includes(item.id)),
      contributions: value.payments.filter(item => item.kind !== "payout" && pool.contract_ids.includes(item.contract_id)
        && item.on <= year + "-12-31"
        && (item.cadence === "once" ? item.on >= year + "-01-01"
          : item.until === null || item.until >= year + "-01-01")),
      // Even excluded conditional grants affect the identity of the shared allocation.
      assignments: value.grants.filter(item => item.pool_id === pool.id)
    };
  });
  const people = value.people.filter(item => path.people.includes(item.id)
    || path.children.includes(item.id) || poolPeople.has(item.id) || claimChildren.has(item.id));
  const contracts = value.contracts.filter(item => path.contracts.includes(item.id));
  const evidence = value.evidence.filter(item => poolIds.has(item.pool_id));
  const payments = value.payments.filter(subject);
  const riester = value.riester.filter(item => path.contracts.includes(item.contract_id));
  const grants = value.grants.filter(item => path.contracts.includes(item.contract_id) && (item.treatment === "confirmed" ||
    (funding === "with_conditional" && item.treatment === "conditional")));
  const regimes = value.regimes.filter(regime => pools.some(pool => pool.regime_id === regime.id));
  const catalog_refs = catalog.closure([...roots, ...value.assumptions, ...value.sources,
    ...scenario.assumptions, ...scenario.sources, ...regimes.flatMap(item => item.sources),
    ...evidence.flatMap(item => item.sources), ...riester.flatMap(item => [...item.parameters, ...item.sources])]);
  return { case_id: value.case_id, mode: value.mode, as_of: value.as_of, route: value.route,
    people, contracts, evidence, payments, riester, grants, regimes, funding_pools,
    assumptions: value.assumptions, sources: value.sources, path, scenario, funding, catalog_refs };
}

const blockProof = shape({
  code: oneOf("model_blocked", "K2_blocked", "payout_costs_open", "scenario_return_open",
    "payment_open", "funding_contribution_open", "conditional_grant_missing", "synthetic_requirement_unmet", "manual_decision"),
  reference_id: id
});
type BlockProof = ReturnType<typeof blockProof>;

/** The public P1 contract has no evaluable manufacturer access rules. This
 * synthetic rule exercises the binding without making an external claim. */
function syntheticReturnRequirement(snapshot: ReturnType<typeof dependencies>, accessRules: readonly Ref<"parameter">[],
  catalog: CurrentCatalog) {
  if (snapshot.mode !== "synthetic_fixture") return null;
  const { path, scenario, funding } = snapshot;
  const ref = accessRules.find(item => item.id === path.tariff.id + "-synthetic-return-floor-" + funding);
  if (!ref) return null;
  const record = catalog.get(ref, "parameter");
  const data = record.data;
  const contracts = snapshot.contracts.filter(contract => contract.kind === "avd");
  if (contracts.length !== 1 || data.productId !== path.product.id || data.tariffId !== path.tariff.id
    || !data.models.some(model => model.model === path.model && model.version === path.model_version)) return null;
  requireAvd(data.phase === "savings" && data.unit === "annual_ratio" && data.approval === "approved"
    && data.overridePolicy === "forbidden" && data.value.class === "A" && typeof data.value.value === "number"
    && record.citations.length > 0, "invalid_synthetic_requirement", ref.id);
  const floorBps = Math.round(data.value.value * 10_000);
  const status = scenario.annual_return_bps === null ? "ungeklaert"
    : scenario.annual_return_bps < floorBps ? "nicht_erfuellt" : "bestaetigt";
  return { ref, status, citations: record.citations, contract: contracts[0] };
}

function checkManualBlock(decision: BlockingDecision, requirement: ReturnType<typeof syntheticReturnRequirement>,
  inputHash: string | null, basisHash: string, asOf: string) {
  const evidence = decision.evidence;
  requireAvd(requirement && sameData(requirement.ref, evidence.requirement)
    && requirement.citations.some(item => sameData(item.source, evidence.source))
    && requirement.contract.id === evidence.contract_id && requirement.contract.person_id === evidence.person_id,
    "blocking_decision_requirement", decision.id);
  requireAvd(requirement.status === evidence.status && evidence.checked_on === asOf && decision.decided_on === asOf
    && jsonHash(evidence) === decision.evidence_hash, "blocking_decision_evidence", decision.id);
  requireAvd(decision.input_hash === inputHash && decision.basis_hash === basisHash,
    "blocking_decision_basis", decision.id);
}

function planFor(value: AvdCase, catalog: CurrentCatalog) {
  assertCaseCatalog(value, catalog);
  requireAvd(value.paths.length && value.scenarios.length && value.funding_variants.length, "empty_comparison", "$");
  const entries = [];
  const inputHash = value.format === "avd.case.v4" ? decisionInputHash(value) : null;
  const decisions = new Map(value.format === "avd.case.v4"
    ? value.blocking_decisions.map(decision => [keyOf(decision.key), decision]) : []);
  for (const path of value.paths) {
    const { savings, payout, rootRefs, available, accessRules } = pathContext(value, path, catalog);
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
      const costBlocks: BlockProof[] = [];
      if (!selection.ok) {
        const { code, path: issuePath } = selection.issue;
        requireAvd(blocked && (code === "model_blocked" || code === "K2_blocked" || code === "payout_costs_open"),
          code, issuePath);
        const reference_id = code === "model_blocked" ? path.product.id
          : code === "K2_blocked" && savings.mode === "K2" && savings.status === "blocked"
            ? path.savings_cost.id : path.payout_cost.id;
        costBlocks.push({ code, reference_id });
      }
      for (const funding of value.funding_variants) {
        const key = { path_id: path.id, scenario_id: scenario.id, funding_variant: funding };
        const snapshot = dependencies(value, path, scenario, funding, rootRefs, catalog);
        const basis_hash = jsonHash({ format: "avd.dependencies.v2", snapshot, key,
          savings_mode: savings.mode, payout_mode: payout.mode });
        const modes = { savings: savings.mode, payout: payout.mode };
        const blockers = [...costBlocks];
        if (scenario.annual_return_bps === null) blockers.push({ code: "scenario_return_open", reference_id: scenario.id });
        for (const payment of snapshot.payments) {
          if (payment.amount.class === "O") blockers.push({ code: "payment_open", reference_id: payment.id });
        }
        const openContributions = new Set(snapshot.funding_pools.flatMap(item => item.contributions)
          .filter(payment => payment.amount.class === "O").map(payment => payment.id));
        for (const reference_id of openContributions) blockers.push({ code: "funding_contribution_open", reference_id });
        if (funding === "with_conditional" && !snapshot.grants.some(item => item.treatment === "conditional")) {
          blockers.push({ code: "conditional_grant_missing", reference_id: path.id });
        }
        const decision = decisions.get(keyOf(key));
        const requirement = syntheticReturnRequirement(snapshot, accessRules, catalog);
        if (requirement?.status === "nicht_erfuellt") {
          blockers.push({ code: "synthetic_requirement_unmet", reference_id: requirement.ref.id });
        }
        if (decision) {
          checkManualBlock(decision, requirement, inputHash, basis_hash, value.as_of);
          blockers.unshift({ code: "manual_decision", reference_id: decision.id });
        }
        const dependency_hash = decision ? jsonHash({ basis_hash, decision }) : basis_hash;
        entries.push({ key, dependency_hash, basis_hash, snapshot, modes, blockers });
      }
    }
  }
  const dependency_manifest = {
    format: "avd.dependencies.v2" as const, case: caseRef(value), catalog: catalogRef(catalog.value),
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
const blockedResult = shape({
  status: oneOf("nicht_berechenbar"), block: blockProof, explanation: nullable(description)
});
// Read the legacy structure to keep original IDs and predecessor references. It cannot certify a block.
const legacyBlockedResult = shape({ status: oneOf("nicht_berechenbar"), reason: description });
const numericResult = shape({ status: oneOf("aktuell_berechnet", "bedingt_berechnet"), capital_cents: amountCents });
function resultRule<T>(blocked: Rule<T>): Rule<T | ReturnType<typeof numericResult>> {
  return (input, at) => (input as { status?: unknown } | null)?.status === "nicht_berechenbar"
    ? blocked(input, at) : numericResult(input, at);
}
const calculationFields = {
  calculation_id: id, hash: digest, dependency_hash: digest, key: subresultKey, as_of: day, origin: calculationOrigin
};
const calculationV2 = shape({ ...calculationFields, format: oneOf("avd.calculation.v2"), result: resultRule(legacyBlockedResult) });
const calculationV3 = shape({ ...calculationFields, format: oneOf("avd.calculation.v3"), result: resultRule(blockedResult) });
type CalculationRecord = ReturnType<typeof calculationV2> | ReturnType<typeof calculationV3>;
const calculationShape: Rule<CalculationRecord> = (input, at) =>
  (input as { format?: unknown } | null)?.format === "avd.calculation.v3" ? calculationV3(input, at) : calculationV2(input, at);
const entryShape = shape({
  subresult_id: id, key: subresultKey, calculation: calculationShape
});
const manifestShape = shape({
  format: oneOf("avd.dependencies.v2"), case: caseIdentity, catalog: catalogIdentity,
  entries: list(shape({ key: subresultKey, dependency_hash: digest }), 96, 1)
});
const comparisonShape = shape({
  format: oneOf("avd.comparison.v2"), comparison_revision: revision, previous_hash: nullable(digest), hash: digest,
  recorded_at: stamp, dependency_manifest: manifestShape, subresults: list(entryShape, 96, 1)
});
export type Calculation = ReturnType<typeof calculationShape>;
export type Comparison = ReturnType<typeof comparisonShape>;
export type ResultCapability = Readonly<{
  status: "fully_numeric" | "partially_numeric" | "documented_blocks";
  numeric: number;
  blocked: number;
}>;

/** Derive this only from a validated, complete comparison. */
function comparisonResultCapability(comparison: Comparison): ResultCapability {
  const blocked = comparison.subresults.filter(item => item.calculation.result.status === "nicht_berechenbar").length;
  const numeric = comparison.subresults.length - blocked;
  return { status: blocked === 0 ? "fully_numeric" : numeric === 0 ? "documented_blocks" : "partially_numeric",
    numeric, blocked };
}
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

/** Recognize prior persisted decision bindings for archival reading only. */
export function hasLegacyDecisionBinding(input: AvdCase, comparison: Comparison): boolean {
  if (input.format !== "avd.case.v3") return false;
  const bindings = new Map(comparison.dependency_manifest.entries.map(item => [keyOf(item.key), item.dependency_hash]));
  return input.blocking_decisions.some(decision =>
    bindings.get(keyOf(decision.key)) === jsonHash({ basis_hash: decision.basis_hash, decision }));
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
    if (calculation.result.status === "nicht_berechenbar") {
      const proof = "block" in calculation.result ? calculation.result.block : null;
      requireAvd(proof && entry.blockers.some(item => sameData(item, proof)), "block_proof_mismatch", item.subresult_id);
    } else {
      requireAvd(value.mode === "synthetic_fixture" && entry.blockers.length === 0, "real_calculation_unavailable", item.subresult_id);
      requireAvd(calculation.result.status === (item.key.funding_variant === "with_conditional" ? "bedingt_berechnet" : "aktuell_berechnet"),
        "result_funding_variant", item.subresult_id);
    }
  }
  return { comparison, plan, result_capability: comparisonResultCapability(comparison) };
}

export function assertCatalogPublication(catalog: ValidatedCatalog, channel: Channel) {
  checked(publicCatalog(catalog, channel));
}
