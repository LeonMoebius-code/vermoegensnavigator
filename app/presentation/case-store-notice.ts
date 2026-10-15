import type { CaseStoreRead } from "../case-storage";

/** Presentation only; recoveryNeeded and all write/backup guards remain authoritative. */
export function caseStoreNotice(loaded: CaseStoreRead): { severity: "info" | "error"; text: string } | null {
  if (!loaded.recoveryNeeded) return null;
  if (loaded.malformed) return { severity: "error", text: "Der lokale Fallbestand konnte nicht gelesen werden. Die Originaldaten bleiben unverändert. Speichern ist zum Schutz des Bestands gesperrt. Laden Sie den Originalbestand zur Wiederherstellung herunter." };
  const messages: string[] = [];
  const protectedCount = loaded.protectedEntries.length;
  if (protectedCount) messages.push(`${protectedCount} ${protectedCount === 1 ? "beschädigter oder inkonsistenter Fall ist geschützt" : "beschädigte oder inkonsistente Fälle sind geschützt"}. Lesbare Fälle bleiben verfügbar. Geschützte Fälle werden nicht zur Bearbeitung freigegeben.`);
  const { positions, categories } = loaded.optionalData;
  if (positions) messages.push(`Optionale Daten in ${positions} ${positions === 1 ? "Position wurden" : "Positionen wurden"} nicht ausgewertet oder als Prüfhinweise bereinigt. Die betroffenen Fälle bleiben lesbar. Betroffene Kategorien: ${categories.join(", ")}.`);
  messages.push("Die unveränderten Originaldaten bleiben zur Wiederherstellung verfügbar und werden vor einer Änderung des Bestands gesichert.");
  return { severity: protectedCount ? "error" : "info", text: messages.join(" ") };
}
