import { useState } from "react";
import { historicalReport, type DocumentChannel } from "../../domain/retirement/premium-document";
import type { createPremiumSession, Snapshot } from "../../domain/retirement/premium-session";

export function PremiumDocumentControls({ session, snapshot, caseId }: {
  session: ReturnType<typeof createPremiumSession>; snapshot: Snapshot | null; caseId: string;
}) {
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState<DocumentChannel | null>(null);
  function download(id: string) {
    const entry = session.readDocument(id, caseId);
    if (!entry) { setMessage("Die Ausgabe ist für diesen Kanal nicht verfügbar."); return; }
    const { channel, createdAt, comparisonRevision } = entry.info;
    const blob = new Blob([entry.bytes as Uint8Array<ArrayBuffer>], { type: channel === "pdf" ? "application/pdf" : "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "AVD-" + createdAt.slice(0, 10) + "-" + comparisonRevision.slice(0, 8) + "." + channel;
      anchor.click();
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  async function create(channel: DocumentChannel) {
    if (session.current() !== snapshot) return;
    const ticket = session.reserveOperation(channel);
    if (!ticket) { setMessage("Für eine Ausgabe ist ein vollständiger fixierter Vergleich mit Kanalrecht erforderlich."); return; }
    setCreating(channel);
    try {
      const report = await session.commitDocument(ticket);
      if (report) {
        download(report.id);
        setMessage(channel.toUpperCase() + " wurde für die fixierte Vergleichsrevision erzeugt.");
      } else setMessage("Der Beratungsstand oder das Kanalrecht hat sich geändert. Es wurde keine Datei erzeugt.");
    } catch {
      setMessage("Die Datei konnte nicht erzeugt werden.");
    } finally { setCreating(null); }
  }
  const complete = snapshot?.complete && snapshot.status !== "live_preview";
  const archives = session.archiveForCase(caseId);
  return <section aria-label="Berichtsausgabe">
    <button type="button" disabled={!complete || !session.canDocument("pdf") || creating !== null} onClick={() => void create("pdf")}>Fixierten Vergleich als PDF ausgeben</button>
    <button type="button" disabled={!complete || !session.canDocument("csv") || creating !== null} onClick={() => void create("csv")}>Fixierten Vergleich als CSV ausgeben</button>
    {message && <p role="status">{message}</p>}
    {archives.length > 0 && <details><summary>Historische Ausgaben dieser Sitzung</summary>
      <ul>{archives.map(report => <li key={report.id}>
        <button type="button" onClick={() => download(report.id)}>{report.channel.toUpperCase()} · {historicalReport} · {report.createdAt} · {report.comparisonRevision.slice(0, 8)}</button>
      </li>)}</ul>
    </details>}
  </section>;
}
