import type { CaseStoreRead } from "../case-storage";
import { legacyCapitalProtection } from "../domain/case/legacy-capital-protection";

export function historicalCapitalProtectionMessage(value: unknown): string | null {
  let reason;
  try { reason = legacyCapitalProtection(value); }
  catch { return null; } // Keep H3's controlled rejection even for invalid runtime metadata.
  return reason === "historical-bindings" || reason === "ambiguous-legacy"
    ? "Historische Kapitalbindungen müssen vor einer Konvertierung fachlich geprüft werden, damit Zuordnungen, Beträge und Einstiegspläne erhalten bleiben. Die Originaldaten bleiben erhalten. Der aktuelle Arbeitsstand bleibt unverändert."
    : null;
}

/** Presentation only; recoveryNeeded and all write/backup guards remain authoritative. */
export function caseStoreNotice(loaded: CaseStoreRead, includeOptional = false): { severity: "info" | "error"; text: string } | null {
  if (!loaded.recoveryNeeded) return null;
  if (loaded.malformed) return { severity: "error", text: "Der lokale Fallbestand konnte nicht gelesen werden. Die Originaldaten bleiben unverändert. Speichern ist zum Schutz des Bestands gesperrt. Laden Sie den Originalbestand zur Wiederherstellung herunter." };
  if (!includeOptional && !loaded.protectedEntries.length && loaded.optionalData.positions > 0) return null;
  const messages: string[] = [];
  const protectedCount = loaded.protectedEntries.length;
  const legacyCount = loaded.protectedEntries.filter(entry => {
    const reason = legacyCapitalProtection(entry);
    return reason === "historical-bindings" || reason === "ambiguous-legacy";
  }).length;
  if (legacyCount) messages.push(`${legacyCount} ${legacyCount === 1 ? "historischer Fall ist geschützt" : "historische Fälle sind geschützt"}: Kapitalbindungen müssen fachlich geprüft werden, da ihre Konvertierung Zuordnungen, Beträge oder Einstiegspläne verlieren könnte. Die Originaldaten bleiben erhalten; dies ist kein Nachweis beschädigter Originaldaten.`);
  const otherCount = protectedCount - legacyCount;
  if (otherCount) messages.push(`${otherCount} ${otherCount === 1 ? "beschädigter oder inkonsistenter Fall ist geschützt" : "beschädigte oder inkonsistente Fälle sind geschützt"}.`);
  if (protectedCount) messages.push("Lesbare Fälle bleiben verfügbar. Geschützte Fälle werden nicht zur Bearbeitung freigegeben.");
  const { positions, categories } = loaded.optionalData;
  if (positions) messages.push(`Optionale Daten in ${positions} ${positions === 1 ? "Position wurden" : "Positionen wurden"} nicht ausgewertet oder als Prüfhinweise bereinigt. Die betroffenen Fälle bleiben lesbar. Betroffene Kategorien: ${categories.join(", ")}.`);
  messages.push("Die unveränderten Originaldaten bleiben zur Wiederherstellung verfügbar und werden vor einer Änderung des Bestands gesichert.");
  return { severity: protectedCount ? "error" : "info", text: messages.join(" ") };
}
