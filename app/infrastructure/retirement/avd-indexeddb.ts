import { appendCatalogRevision } from "../../domain/retirement/catalog-validation";
import type { ValidatedCatalog } from "../../domain/retirement/catalog-contract";
import { assertSuccessor, caseIdentity, caseRef, catalogIdentity, originateCase, parseAvdCase, sameData,
  type AvdCase, type CaseIdentity, type CatalogIdentity } from "../../domain/retirement/avd-case";
import { assertCatalogPublication, catalogRef, comparisonIdentity, comparisonRef, hasLegacyDecisionBinding, parseCalculation, parseComparison,
  readCatalog, validateCaseCatalog, verifyComparison,
  type Calculation, type Comparison, type ComparisonIdentity, type ResultCapability } from "../../domain/retirement/avd-comparison";
import { AvdError, copyAvd, id, nullable, oneOf, requireAvd, shape, stamp } from "../../domain/retirement/avd-data";

export const AVD_DATABASE = "vermoegensnavigator-avd";
const DATABASE_VERSION = 1;
const STORES = ["catalogs", "catalog_heads", "cases", "case_heads", "comparisons", "calculations"] as const;
type StoreName = typeof STORES[number];
const headShape = shape({ case: caseIdentity, comparison: nullable(comparisonIdentity) });
const changeShape = shape({ changed_at: stamp, changed_by: id, change_id: id });
const exportPurpose = oneOf("capital_projection", "documented_blocks");
type Head = ReturnType<typeof headShape>;

export type CurrentComparison =
  | { status: "missing"; case: CaseIdentity }
  | { status: "veraltet"; case: CaseIdentity; comparison: ComparisonIdentity }
  | { status: "current"; completeness: "complete"; result_capability: ResultCapability;
      case: CaseIdentity; comparison: Comparison };
export type HistoricalComparison = {
  comparison: Comparison; input: AvdCase; catalog: ValidatedCatalog;
} & (
  | { status: "historisch_fixiert"; completeness: "complete"; result_capability: ResultCapability }
  | { status: "historisch_unverifiziert" }
);

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    // The default IndexedDB error action aborts the transaction.
    value.onerror = () => reject(value.error);
  });
}

function storageError(error: unknown): AvdError {
  if (error instanceof AvdError) return error;
  return new AvdError("indexeddb_transaction_failed", error instanceof DOMException ? error.name : "$");
}

export async function openAvdStore(factory?: IDBFactory | null): Promise<AvdStore> {
  let indexed: IDBFactory | undefined | null;
  try { indexed = factory === undefined ? globalThis.indexedDB : factory; }
  catch { throw new AvdError("indexeddb_unavailable", "$"); }
  requireAvd(indexed, "indexeddb_unavailable", "$");
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    let opening: IDBOpenDBRequest;
    try { opening = indexed.open(AVD_DATABASE, DATABASE_VERSION); }
    catch { reject(new AvdError("indexeddb_unavailable", "$")); return; }
    let blocked = false;
    opening.onupgradeneeded = event => {
      if (blocked || event.oldVersion !== 0) { opening.transaction?.abort(); return; }
      for (const store of STORES) opening.result.createObjectStore(store);
    };
    opening.onblocked = () => { blocked = true; reject(new AvdError("indexeddb_blocked", "$")); };
    opening.onerror = () => reject(new AvdError("indexeddb_open_failed", opening.error?.name ?? "$"));
    opening.onsuccess = () => {
      if (blocked) { opening.result.close(); return; }
      const database = opening.result;
      if (database.objectStoreNames.length !== STORES.length
        || STORES.some(name => !database.objectStoreNames.contains(name))) {
        database.close();
        reject(new AvdError("indexeddb_unknown_schema", "$"));
        return;
      }
      resolve(database);
    };
  });
  db.onversionchange = () => db.close();
  return new AvdStore(db);
}

class Transaction {
  constructor(private readonly tx: IDBTransaction) {}
  get(store: StoreName, key: IDBValidKey): Promise<unknown> {
    return request(this.tx.objectStore(store).get(key));
  }
  async add(store: StoreName, key: IDBValidKey, value: object): Promise<void> {
    await request(this.tx.objectStore(store).add(value, key));
  }
  async put(store: "case_heads" | "catalog_heads", key: string, value: object): Promise<void> {
    await request(this.tx.objectStore(store).put(value, key));
  }
}

async function catalogSnapshot(tx: Transaction, identity: CatalogIdentity) {
  const catalog = readCatalog(await tx.get("catalogs", [identity.id, identity.revision]));
  requireAvd(sameData(catalogRef(catalog), identity), "stored_catalog_binding", identity.id);
  return catalog;
}
async function catalogHead(tx: Transaction, key: string) {
  const stored = await tx.get("catalog_heads", key);
  if (stored === undefined) return null;
  const pointer = catalogIdentity(copyAvd(stored), "$.catalog_head");
  requireAvd(pointer.id === key, "stored_catalog_binding", key);
  return pointer;
}

async function caseHead(tx: Transaction, key: string): Promise<Head> {
  const data = await tx.get("case_heads", key);
  requireAvd(data !== undefined, "case_missing", key);
  const head = headShape(copyAvd(data), "$.case_head");
  requireAvd(head.case.case_id === key, "stored_case_binding", key);
  return head;
}
async function readInput(tx: Transaction, identity: CaseIdentity) {
  const raw = await tx.get("cases", [identity.case_id, identity.case_revision]);
  requireAvd(raw !== undefined, "case_revision_missing", identity.case_id);
  const input = parseAvdCase(raw);
  requireAvd(sameData(caseRef(input), identity), "stored_case_binding", identity.case_id);
  if (input.case_revision > 1) {
    const previous = parseAvdCase(await tx.get("cases", [identity.case_id, identity.case_revision - 1]));
    assertSuccessor(previous, input);
  }
  const catalog = await catalogSnapshot(tx, input.catalog);
  return { input: validateCaseCatalog(input, catalog), catalog };
}
async function caseAtHead(tx: Transaction, expected: CaseIdentity) {
  const head = await caseHead(tx, expected.case_id);
  requireAvd(sameData(expected, head.case), "case_conflict", expected.case_id);
  return { head, ...await readInput(tx, head.case) };
}

async function readComparisonRecord(tx: Transaction, caseId: string, pointer: ComparisonIdentity) {
  const row = await tx.get("comparisons", [caseId, pointer.comparison_revision]);
  requireAvd(row !== undefined, "comparison_missing", caseId);
  const value = parseComparison(row);
  requireAvd(value.dependency_manifest.case.case_id === caseId && sameData(comparisonRef(value), pointer),
    "stored_comparison_binding", caseId);
  return value;
}
async function checkComparisonPredecessor(tx: Transaction, caseId: string, value: Comparison) {
  if (value.previous_hash === null) return;
  const previous = await readComparisonRecord(tx, caseId,
    { comparison_revision: value.comparison_revision - 1, hash: value.previous_hash });
  requireAvd(previous.recorded_at <= value.recorded_at, "comparison_time", caseId);
}

async function ledger(tx: Transaction, caseId: string, comparison: Comparison, publishing: boolean) {
  const additions: Calculation[] = [];
  const origins = new Map<number, Comparison>();
  for (const item of comparison.subresults) {
    const calculation = item.calculation;
    const origin = calculation.origin;
    const stored = await tx.get("calculations", [caseId, calculation.calculation_id]);
    const isNew = origin.comparison_revision === comparison.comparison_revision;
    if (publishing && isNew) {
      requireAvd(stored === undefined, "calculation_id_conflict", calculation.calculation_id);
      additions.push(calculation);
      continue;
    }
    requireAvd(stored !== undefined && sameData(parseCalculation(stored), calculation),
      "calculation_original_missing_or_changed", calculation.calculation_id);
    if (isNew) continue;
    let original = origins.get(origin.comparison_revision);
    if (!original) {
      original = parseComparison(await tx.get("comparisons", [caseId, origin.comparison_revision]));
      requireAvd(original.comparison_revision === origin.comparison_revision
        && sameData(original.dependency_manifest.case, origin.case), "calculation_origin", calculation.calculation_id);
      origins.set(origin.comparison_revision, original);
    }
    requireAvd(original.subresults.some(entry =>
      entry.subresult_id === origin.subresult_id && sameData(entry.calculation, calculation)),
    "calculation_origin", calculation.calculation_id);
  }
  return additions;
}

async function verifyStoredComparison(tx: Transaction, comparison: Comparison, input: AvdCase, catalog: ValidatedCatalog) {
  await checkComparisonPredecessor(tx, input.case_id, comparison);
  const result = verifyComparison(input, catalog, comparison);
  await ledger(tx, input.case_id, result.comparison, false);
  return result;
}

class AvdStore {
  constructor(private readonly db: IDBDatabase) {}
  close() { this.db.close(); }

  private async run<T>(mode: IDBTransactionMode, work: (tx: Transaction) => Promise<T>): Promise<T> {
    let tx: IDBTransaction;
    try { tx = this.db.transaction([...STORES], mode); }
    catch (error) { throw storageError(error); }
    const finished = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(new AvdError("indexeddb_transaction_aborted", tx.error?.name ?? "$"));
    });
    void finished.catch(() => {});
    try {
      const result = await work(new Transaction(tx));
      await finished;
      return result;
    } catch (error) {
      try { tx.abort(); } catch { /* Already ended, for example after a request error. */ }
      await finished.catch(() => {});
      throw storageError(error);
    }
  }

  /** The shared authority per catalog lineage. Advancing it invalidates older cases and comparisons. */
  registerCatalog(input: unknown, expectedInput: unknown): Promise<CatalogIdentity> {
    const next = readCatalog(input);
    const expected = nullable(catalogIdentity)(copyAvd(expectedInput), "$.expected_catalog");
    const ref = catalogRef(next);
    return this.run("readwrite", async tx => {
      requireAvd(sameData(await catalogHead(tx, next.id), expected), "catalog_conflict", next.id);
      if (expected) {
        const old = await catalogSnapshot(tx, expected);
        const append = appendCatalogRevision(old, next);
        requireAvd(append.ok, append.ok ? "" : append.issue.code, "$.catalog");
      } else requireAvd(next.revision === 1, "catalog_predecessor_missing", next.id);
      await tx.add("catalogs", [next.id, next.revision], next);
      await tx.put("catalog_heads", next.id, ref);
      return ref;
    });
  }

  createCase(input: unknown): Promise<AvdCase> {
    const value = parseAvdCase(input);
    requireAvd(value.case_revision === 1 && value.origin === null, "invalid_case_creation", value.case_id);
    return this.run("readwrite", async tx => {
      requireAvd(await tx.get("case_heads", value.case_id) === undefined, "case_id_conflict", value.case_id);
      requireAvd(sameData(await catalogHead(tx, value.catalog.id), value.catalog), "catalog_conflict", value.catalog.id);
      const catalog = await catalogSnapshot(tx, value.catalog);
      const validated = validateCaseCatalog(value, catalog);
      await tx.add("cases", [value.case_id, 1], validated);
      await tx.put("case_heads", value.case_id, { case: caseRef(validated), comparison: null });
      return validated;
    });
  }

  readCase(caseId: string): Promise<AvdCase> {
    const key = id(caseId, "$.case_id");
    return this.run("readonly", async tx => (await readInput(tx, (await caseHead(tx, key)).case)).input);
  }

  readCaseRevision(identity: CaseIdentity): Promise<AvdCase> {
    const ref = caseIdentity(copyAvd(identity), "$.case");
    return this.run("readonly", async tx => (await readInput(tx, ref)).input);
  }

  appendCase(expectedInput: CaseIdentity, candidate: unknown): Promise<AvdCase> {
    const expected = caseIdentity(copyAvd(expectedInput), "$.expected_case");
    const next = parseAvdCase(candidate);
    requireAvd(next.origin === null, "reserved_copy_restore_origin", next.case_id);
    return this.run("readwrite", async tx => {
      const { head, input } = await caseAtHead(tx, expected);
      assertSuccessor(input, next);
      requireAvd(sameData(await catalogHead(tx, next.catalog.id), next.catalog), "catalog_conflict", next.catalog.id);
      const catalog = await catalogSnapshot(tx, next.catalog);
      const validated = validateCaseCatalog(next, catalog);
      await tx.add("cases", [next.case_id, next.case_revision], validated);
      await tx.put("case_heads", next.case_id, { case: caseRef(validated), comparison: head.comparison });
      return validated;
    });
  }

  copyCase(sourceInput: CaseIdentity, targetId: string, changeInput: unknown): Promise<AvdCase> {
    const source = caseIdentity(copyAvd(sourceInput), "$.source");
    const key = id(targetId, "$.target");
    const change = changeShape(copyAvd(changeInput), "$.change");
    return this.run("readwrite", async tx => {
      requireAvd(await tx.get("case_heads", key) === undefined, "case_id_conflict", key);
      const { input, catalog } = await readInput(tx, source);
      const copy = validateCaseCatalog(originateCase(input, null, key, change), catalog);
      await tx.add("cases", [key, 1], copy);
      await tx.put("case_heads", key, { case: caseRef(copy), comparison: null });
      return copy;
    });
  }

  restoreCase(expectedInput: CaseIdentity, sourceInput: CaseIdentity, changeInput: unknown): Promise<AvdCase> {
    const expected = caseIdentity(copyAvd(expectedInput), "$.expected_case");
    const source = caseIdentity(copyAvd(sourceInput), "$.source");
    const change = changeShape(copyAvd(changeInput), "$.change");
    requireAvd(source.case_id === expected.case_id && source.case_revision < expected.case_revision,
      "restore_origin", source.case_id);
    return this.run("readwrite", async tx => {
      const { head, input: current } = await caseAtHead(tx, expected);
      const { input, catalog } = await readInput(tx, source);
      const restored = validateCaseCatalog(originateCase(input, current, expected.case_id, change), catalog);
      await tx.add("cases", [restored.case_id, restored.case_revision], restored);
      await tx.put("case_heads", restored.case_id, { case: caseRef(restored), comparison: head.comparison });
      return restored;
    });
  }

  checkCandidate(input: unknown, expectedCase: CaseIdentity, expectedComparison: ComparisonIdentity | null) {
    return this.candidate("readonly", input, expectedCase, expectedComparison);
  }

  publishComparison(input: unknown, expectedCase: CaseIdentity, expectedComparison: ComparisonIdentity | null) {
    return this.candidate("readwrite", input, expectedCase, expectedComparison);
  }

  private candidate(mode: "readonly" | "readwrite", input: unknown, caseInput: CaseIdentity,
    comparisonInput: ComparisonIdentity | null): Promise<Comparison> {
    const candidate = parseComparison(input);
    const expected = caseIdentity(copyAvd(caseInput), "$.expected_case");
    const previous = nullable(comparisonIdentity)(copyAvd(comparisonInput), "$.expected_comparison");
    return this.run(mode, async tx => {
      const { head, input: working, catalog } = await caseAtHead(tx, expected);
      requireAvd(sameData(head.comparison, previous) && candidate.comparison_revision === (previous?.comparison_revision ?? 0) + 1
        && candidate.previous_hash === (previous?.hash ?? null), "comparison_conflict", expected.case_id);
      requireAvd(sameData(await catalogHead(tx, working.catalog.id), working.catalog), "catalog_conflict", working.catalog.id);
      const { comparison } = verifyComparison(working, catalog, candidate);
      await checkComparisonPredecessor(tx, working.case_id, comparison);
      const additions = await ledger(tx, working.case_id, comparison, true);
      if (mode === "readwrite") {
        for (const calculation of additions) {
          await tx.add("calculations", [working.case_id, calculation.calculation_id], calculation);
        }
        await tx.add("comparisons", [working.case_id, comparison.comparison_revision], comparison);
        await tx.put("case_heads", working.case_id, { case: head.case, comparison: comparisonRef(comparison) });
      }
      return comparison;
    });
  }

  private async currentComparison(tx: Transaction, key: string): Promise<CurrentComparison> {
    const head = await caseHead(tx, key);
    const { input, catalog } = await readInput(tx, head.case);
    if (!head.comparison) return { status: "missing", case: head.case };
    const comparison = await readComparisonRecord(tx, key, head.comparison);
    const authority = await catalogHead(tx, input.catalog.id);
    if (!sameData(comparison.dependency_manifest.case, head.case) || !sameData(authority, input.catalog)
      || hasLegacyDecisionBinding(input, comparison)) {
      return { status: "veraltet", case: head.case, comparison: head.comparison };
    }
    const verified = await verifyStoredComparison(tx, comparison, input, catalog);
    return { status: "current", completeness: "complete", result_capability: verified.result_capability,
      case: head.case, comparison: verified.comparison };
  }

  readCurrentComparison(caseId: string): Promise<CurrentComparison> {
    const key = id(caseId, "$.case_id");
    return this.run("readonly", tx => this.currentComparison(tx, key));
  }

  readHistoricalComparison(caseId: string, ref: ComparisonIdentity): Promise<HistoricalComparison> {
    const key = id(caseId, "$.case_id");
    const pointer = comparisonIdentity(copyAvd(ref), "$.comparison");
    return this.run("readonly", async tx => {
      const comparison = await readComparisonRecord(tx, key, pointer);
      const { input, catalog } = await readInput(tx, comparison.dependency_manifest.case);
      if (hasLegacyDecisionBinding(input, comparison)) {
        requireAvd(sameData(comparison.dependency_manifest.catalog, catalogRef(catalog)),
          "dependency_manifest_mismatch", "$.dependency_manifest");
        await checkComparisonPredecessor(tx, caseId, comparison);
        await ledger(tx, caseId, comparison, false);
        return { status: "historisch_unverifiziert", input, catalog, comparison };
      }
      const verified = await verifyStoredComparison(tx, comparison, input, catalog);
      return { status: "historisch_fixiert", completeness: "complete", result_capability: verified.result_capability,
        input, catalog, comparison: verified.comparison };
    });
  }

  /** Eligibility at the read transaction. The future producer must recheck before actual output. */
  checkExport(caseInput: CaseIdentity, comparisonInput: ComparisonIdentity, dirty: boolean,
    requestedPurpose: ReturnType<typeof exportPurpose>) {
    requireAvd(dirty === false, "unsaved_changes", "$.case");
    const purpose = exportPurpose(requestedPurpose, "$.export_purpose");
    const expected = caseIdentity(copyAvd(caseInput), "$.expected_case");
    const pointer = comparisonIdentity(copyAvd(comparisonInput), "$.expected_comparison");
    return this.run("readonly", async tx => {
      const current = await this.currentComparison(tx, expected.case_id);
      requireAvd(current.status === "current" && sameData(current.case, expected)
        && sameData(comparisonRef(current.comparison), pointer), "export_not_current", expected.case_id);
      const { input, catalog } = await readInput(tx, expected);
      requireAvd(input.mode === "working" && catalog.origin === "working", "synthetic_export_forbidden", input.case_id);
      assertCatalogPublication(catalog, "export");
      requireAvd(purpose === "capital_projection" ? current.result_capability.status === "fully_numeric"
        : current.result_capability.blocked > 0, "export_result_not_eligible", input.case_id);
      return { purpose, result_capability: current.result_capability,
        case: expected, comparison: pointer, catalog: input.catalog };
    });
  }
}
