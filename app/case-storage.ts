import { jsonHash } from "./domain/case/recovery-hash";
import type { AdvisoryCase } from "./domain/case/contracts";
import { validCaseFinancialInputs } from "./domain/case/financial-validation";
import { enforceCaseDepotValue, normalizeImportedCase } from "./case-model";
import { sanitizeOptionalHolding } from "./depot-validation";
import { validBondSource } from "./bond-source";

export const CASE_STORAGE_KEY = "vermoegensnavigator-cases-v2";
export const RECOVERY_PREFIX = `${CASE_STORAGE_KEY}-recovery-`;
type StorageAccess = Pick<Storage, "getItem" | "setItem" | "key" | "length">;
export function recoveryBackups(storage: Pick<Storage, "getItem" | "key" | "length">) {
  const backups: { key: string; original: string }[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(RECOVERY_PREFIX)) continue;
    const original = storage.getItem(key);
    if (original !== null) backups.push({ key, original });
  }
  return backups.sort((a, b) => b.key.localeCompare(a.key));
}
export type CaseStoreRead = {
  cases: AdvisoryCase[];
  protectedEntries: unknown[];
  recoveryEntries: unknown[];
  original: string | null;
  recoveryNeeded: boolean;
  malformed: boolean;
  optionalData: { positions: number; categories: string[] };
};

function optionalFieldCategory(field: string) {
  if (["maturity", "lastPurchaseDate", "valuationStart", "valuationEnd"].includes(field)) return "Datumsangaben";
  if (["coupon", "nominalOrUnits", "averageEntryPrice", "purchaseCosts", "currentPrice", "gainLossPercent", "gainLossAmount", "accruedInterest", "sourceDepotShare", "averageEntryFx", "fxRate", "holdingAtValuationStart", "holdingAtValuationEnd"].includes(field)) return "Kurs-, Zins-, Bestands- und Devisenangaben";
  if (field === "importIssues") return "Import-Prüfhinweise";
  return "Optionale Klassifikationsangaben";
}

export function readCaseStore(original: string | null): CaseStoreRead {
  const result: CaseStoreRead = { cases: [], protectedEntries: [], recoveryEntries: [], original, recoveryNeeded: false, malformed: false, optionalData: { positions: 0, categories: [] } };
  if (original === null) return result;
  let entries: unknown;
  try { entries = JSON.parse(original); } catch { result.malformed = result.recoveryNeeded = true; return result; }
  if (!Array.isArray(entries)) { result.malformed = result.recoveryNeeded = true; return result; }
  const counts = new Map<unknown, number>();
  for (const entry of entries) {
    const id = entry?.id;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  for (const entry of entries) {
    try {
      if (typeof entry?.id !== "string" || !entry.id || counts.get(entry.id)! > 1) throw new Error("invalid-id");
      const normalized = normalizeImportedCase(entry, false);
      if (!normalized || !normalized.plans.length) throw new Error("invalid-case");
      result.cases.push(normalized);
      let optionalChanged = false;
      if (Array.isArray(entry.depot)) for (const holding of entry.depot as AdvisoryCase["depot"]) {
        const sanitized = sanitizeOptionalHolding(holding);
        const sourceChanged = holding.bondSource !== undefined &&
          JSON.stringify(validBondSource(holding.bondSource, holding)) !== JSON.stringify(holding.bondSource);
        // Identical recovery predicate to P1/H2: diagnostics never decide protection.
        if (JSON.stringify(sanitized) !== JSON.stringify(holding) || sourceChanged) {
          optionalChanged = true;
          result.optionalData.positions += 1;
          const categories = new Set(result.optionalData.categories);
          for (const key of new Set([...Object.keys(holding), ...Object.keys(sanitized)])) {
            if (JSON.stringify(holding[key as keyof typeof holding]) === JSON.stringify(sanitized[key as keyof typeof sanitized])) continue;
            categories.add(optionalFieldCategory(key));
          }
          if (sourceChanged) categories.add("Anleihe-Quellnachweise");
          result.optionalData.categories = [...categories].sort();
        }
      }
      if (optionalChanged) {
        result.recoveryNeeded = true;
        result.recoveryEntries.push(entry);
      }
    } catch {
      result.protectedEntries.push(entry);
      result.recoveryEntries.push(entry);
      result.recoveryNeeded = true;
    }
  }
  return result;
}

/** Explicit full replacement of healthy cases; protected originals remain.
 * Do not use a UI list snapshot here: normal actions use the operations below. */
export function writeCaseStore(storage: StorageAccess, cases: AdvisoryCase[]) {
  return mutateCaseStore(storage, () => cases);
}

/** Replace this healthy ID in place, or prepend a new case to the current store.
 * Same-ID writes remain last-write-wins; localStorage is not a cross-tab transaction. */
export function saveCaseToStore(storage: StorageAccess, item: AdvisoryCase) {
  return mutateCaseStore(storage, ({ cases }) => cases.some((current) => current.id === item.id)
    ? cases.map((current) => current.id === item.id ? item : current)
    : [item, ...cases]);
}

/** Insert an independent case (notably a P4 import); never overwrite an existing ID. */
export type UnchangedCopySource = { id: string; entryHash: string };

/** Optional H5b copy-source guard: preserve this freshly read source entry
 * exactly, including its technical timestamp. No caller-supplied raw object,
 * replacement, same-ID repair or validation exception is accepted. */
export function insertCaseIntoStore(storage: StorageAccess, item: AdvisoryCase, unchangedSource?: UnchangedCopySource) {
  if (unchangedSource && item.id === unchangedSource.id)
    throw new Error("Eine unabhängige Fallkopie benötigt eine neue äußere Fall-ID.");
  return mutateCaseStore(storage, ({ cases }) => {
    if (cases.some((current) => current.id === item.id))
      throw new Error("Ein Fall mit derselben ID ist bereits gespeichert. Import wurde abgebrochen.");
    return [item, ...cases];
  }, unchangedSource);
}

/** Remove only this healthy ID; missing IDs are safe, protected originals are not deleted. */
export function removeCaseFromStore(storage: StorageAccess, id: string) {
  return mutateCaseStore(storage, ({ cases, protectedEntries }) => {
    if (typeof id !== "string" || !id) throw new Error("Löschen erfordert eine gültige Fall-ID.");
    if (protectedEntries.some((entry) => (entry as { id?: unknown } | null)?.id === id))
      throw new Error("Ein Originalfall mit derselben ID ist geschützt.");
    return cases.filter((current) => current.id !== id);
  });
}

// Read once immediately before selecting the mutation; share validation and recovery.
function mutateCaseStore(storage: StorageAccess, select: (loaded: CaseStoreRead) => AdvisoryCase[], unchangedSource?: UnchangedCopySource) {
  const original = storage.getItem(CASE_STORAGE_KEY);
  const loaded = readCaseStore(original);
  if (loaded.malformed) throw new Error("Der lokale Fallbestand ist beschädigt. Originaldaten zuerst zur Wiederherstellung sichern. Der Bestand wurde nicht überschrieben.");
  let originalSource: unknown;
  if (unchangedSource) {
    if (typeof unchangedSource.id !== "string" || !unchangedSource.id ||
      typeof unchangedSource.entryHash !== "string" || !/^[a-f0-9]{64}$/.test(unchangedSource.entryHash) ||
      Object.keys(unchangedSource).some((key) => key !== "id" && key !== "entryHash"))
      throw new Error("Ungültiger Originalerhalt für die unabhängige Fallkopie.");
    const matches = (original === null ? [] : JSON.parse(original) as unknown[])
      .filter((entry) => (entry as { id?: unknown } | null)?.id === unchangedSource.id);
    if (matches.length !== 1 || jsonHash(matches[0]) !== unchangedSource.entryHash)
      throw new Error("Der unverändert zu erhaltende Quellfall fehlt, ist mehrdeutig oder wurde verändert.");
    originalSource = matches[0];
  }
  const cases = select(loaded);
  const protectedIds = new Set(loaded.protectedEntries.map((entry) => (entry as { id?: unknown } | null)?.id));
  if (cases.some((item) => typeof item.id !== "string" || !item.id) || new Set(cases.map((item) => item.id)).size !== cases.length)
    throw new Error("Fälle mit fehlenden oder doppelten IDs können nicht gespeichert werden.");
  if (cases.some((item) => protectedIds.has(item.id))) throw new Error("Ein Originalfall mit derselben ID ist geschützt.");
  // Inspect original Runtime values before derived depot values can mask damage.
  if (cases.some((item) => !validCaseFinancialInputs(item)))
    throw new Error("Ungültige Finanzbeträge, Bedarfslaufzeiten, Ratenzahlen oder Depotverkäufe über dem Marktwert können nicht gespeichert werden. Der Bestand bleibt erhalten.");
  const normalized = cases.map(enforceCaseDepotValue);
  if (normalized.some((item) => !normalizeImportedCase(item, false))) throw new Error("Ein beschädigter Fall kann nicht gespeichert werden. Der Bestand bleibt erhalten.");
  // Validation above remains complete. Only the already-existing source record
  // is serialized from the freshly read original; the new candidate is ordinary P1.
  const serialized = JSON.stringify([...normalized.map((entry) =>
    unchangedSource && entry.id === unchangedSource.id ? originalSource : entry), ...loaded.protectedEntries]);
  // Reuse a verified original containing every still-damaged entry (including
  // duplicate multiplicity). Healthy-case edits do not require endless backups.
  const alreadyBackedUp = loaded.recoveryNeeded && recoveryBackups(storage).some((backup) => {
    try {
      const entries: unknown = JSON.parse(backup.original);
      if (!Array.isArray(entries)) return false;
      const available = entries.map((entry) => JSON.stringify(entry));
      return loaded.recoveryEntries.every((entry) => {
        const index = available.indexOf(JSON.stringify(entry));
        if (index < 0) return false;
        available.splice(index, 1);
        return true;
      });
    } catch { return false; }
  });
  if (loaded.recoveryNeeded && original !== null && !alreadyBackedUp) {
    const base = `${RECOVERY_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let key = base;
    let suffix = 0;
    while (storage.getItem(key) !== null) key = `${base}-${++suffix}`;
    storage.setItem(key, original);
    if (storage.getItem(key) !== original) throw new Error("Originaldaten konnten nicht gesichert werden. Speichern abgebrochen.");
  }
  storage.setItem(CASE_STORAGE_KEY, serialized);
  return normalized;
}
