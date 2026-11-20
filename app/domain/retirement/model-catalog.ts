import { requireAvd } from "./avd-data";
import type { ValidatedCatalog } from "./catalog-contract";
import { publicCatalog } from "./catalog-validation";
import { MODEL_VERSIONS, reference, refKey, type Kind, type Ref } from "./identity-contract";
import type { ModelPath } from "./model-input";
import { catalogRatio } from "./model-decimal";

type RecordOf<K extends Kind> = Extract<ValidatedCatalog["records"][number], { kind: K }>;
const sameRef = (a: Ref, b: Ref) => refKey(a) === refKey(b) && a.hash === b.hash;

export function modelCatalog(input: unknown) {
  const released = publicCatalog(input, "display");
  // Avoid returning a denied catalog's metadata or reference IDs in a public error.
  requireAvd(released.ok, released.ok ? "" : released.issue.code, "$.catalog");
  const catalog = released.value;
  const current = new Set(catalog.current.map(refKey));
  const records = new Map(catalog.records.map(record => [refKey(record), record]));
  function get<K extends Kind>(ref: Ref<K>, at: string) {
    const record = records.get(refKey(ref));
    requireAvd(record && current.has(refKey(ref)) && sameRef(record, ref), "catalog_reference_not_current", at);
    return record as RecordOf<K>;
  }
  return { catalog, get };
}

export type ModelCatalog = ReturnType<typeof modelCatalog>;

export function resolvePath(catalog: ModelCatalog, path: ModelPath, model: "M1" | "M2", at: string) {
  const product = catalog.get(path.product_ref, at + ".product_ref");
  const tariff = catalog.get(path.tariff_ref, at + ".tariff_ref");
  requireAvd(sameRef(tariff.data.product, path.product_ref), "tariff_scope", at + ".tariff_ref");
  requireAvd(product.data.capabilities.some(item =>
    item.model === model && item.version === MODEL_VERSIONS[model] && item.status === "available"),
  "model_blocked", at + ".product_ref");
  return tariff;
}

export function resolveCost(catalog: ModelCatalog, path: ModelPath, model: "M1" | "M2", at: string) {
  requireAvd(path.cost_refs.length + Number(path.scenario_cost_ref !== null) <= 1,
    "conflicting_cost_modes", at + ".cost_refs");

  const costRef = path.cost_refs[0];
  let parameterRef = path.scenario_cost_ref;
  let costSources: readonly Ref<"source">[] = [];
  if (costRef) {
    const { data, citations } = catalog.get(costRef, at + ".cost_refs.0");
    requireAvd(data.phase === "savings", "cost_phase_mismatch", at + ".cost_refs.0");
    requireAvd(sameRef(data.product, path.product_ref) && sameRef(data.tariff, path.tariff_ref),
      "cost_scope", at + ".cost_refs.0");
    requireAvd(data.mode === "K1", "unsupported_cost_mode", at + ".cost_refs.0");
    requireAvd(data.model === model && data.modelVersion === MODEL_VERSIONS[model],
      "cost_model_mismatch", at + ".cost_refs.0");
    parameterRef = data.parameter;
    costSources = citations.map(item => item.source);
  }

  requireAvd(parameterRef, "cost_open", at + ".cost_refs");
  const parameterAt = costRef ? at + ".cost_refs.0" : at + ".scenario_cost_ref";
  const record = catalog.get(parameterRef, parameterAt);
  const data = record.data;
  requireAvd(data.purpose === "general" && data.unit === "annual_ratio" && data.phase === "savings"
    && (costRef
      ? (data.productId === null || data.productId === path.product_ref.id)
        && (data.tariffId === null || data.tariffId === path.tariff_ref.id)
      : data.productId === path.product_ref.id && data.tariffId === path.tariff_ref.id),
  "cost_parameter_scope", parameterAt);
  requireAvd(data.models.some(item => item.model === model && item.version === MODEL_VERSIONS[model]),
    "cost_model_mismatch", parameterAt);
  requireAvd(data.value.class !== "O" && data.approval === "approved", "cost_open", parameterAt);
  requireAvd((costRef ? data.value.class === "A" : data.value.class === "S")
    && typeof data.value.value === "number", "cost_parameter_class", parameterAt);
  const sources = record.citations.map(item => item.source);
  if (!costRef) {
    requireAvd(sources.some(source => catalog.get(source, parameterAt).data.authority === "scenario"),
      "scenario_cost_source_required", parameterAt);
  }
  return {
    ratio: catalogRatio(data.value.value, parameterAt),
    metadata: {
      cost_ref: costRef ?? null, parameter_ref: reference(record),
      source_refs: [...new Map([...costSources, ...sources].map(source => [refKey(source), source])).values()],
      class: costRef ? "A" as const : "S" as const, annual_ratio: data.value.value,
    },
  };
}
