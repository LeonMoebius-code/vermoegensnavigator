import { AdvisoryCase, enforceCaseDepotValue, normalizeImportedCase } from "./case-model";
import { sanitizeOptionalHolding } from "./depot-validation";

export const CASE_STORAGE_KEY = "vermoegensnavigator-cases-v2";
export const RECOVERY_PREFIX = `${CASE_STORAGE_KEY}-recovery-`;
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
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
  original: string | null;
  recoveryNeeded: boolean;
  malformed: boolean;
};

export function readCaseStore(original: string | null): CaseStoreRead {
  const result: CaseStoreRead = { cases: [], protectedEntries: [], original, recoveryNeeded: false, malformed: false };
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
      if (Array.isArray(entry.depot) && entry.depot.some((holding: object) =>
        JSON.stringify(sanitizeOptionalHolding(holding)) !== JSON.stringify(holding))) result.recoveryNeeded = true;
    } catch {
      result.protectedEntries.push(entry);
      result.recoveryNeeded = true;
    }
  }
  return result;
}

/** Re-read on every write, preserving un-loadable cases and a byte-exact original backup. */
export function writeCaseStore(storage: StorageAccess, cases: AdvisoryCase[]) {
  const original = storage.getItem(CASE_STORAGE_KEY);
  const loaded = readCaseStore(original);
  if (loaded.malformed) throw new Error("Der lokale Fallbestand ist beschädigt. Originaldaten zuerst zur Wiederherstellung sichern. Der Bestand wurde nicht überschrieben.");
  const protectedIds = new Set(loaded.protectedEntries.map((entry) => (entry as { id?: unknown } | null)?.id));
  if (cases.some((item) => protectedIds.has(item.id))) throw new Error("Ein beschädigter Originalfall mit derselben ID ist geschützt.");
  const normalized = cases.map(enforceCaseDepotValue);
  const serialized = JSON.stringify([...normalized, ...loaded.protectedEntries]);
  if (loaded.recoveryNeeded && original !== null) {
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
