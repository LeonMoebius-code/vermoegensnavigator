import { requireAvd } from "./avd-data";
import { PREMIUM_MODEL, PREMIUM_RULES } from "./premium-contract";
import type { Snapshot } from "./premium-session";
import { productStressDifference } from "./premium-series";

export type DocumentChannel = "pdf" | "csv";
export const historicalReport = "Historischer Bericht – nicht aktueller Beratungsstand";

function amount(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const value = BigInt(Math.abs(cents));
  return sign + (value / 100n) + "," + (value % 100n).toString().padStart(2, "0");
}

function documentRows(snapshot: Snapshot, createdAt: string): string[][] {
  requireAvd(snapshot.complete && snapshot.status !== "live_preview", "DOCUMENT_REVISION_OPEN", "document");
  const rows: string[][] = [
    [historicalReport],
    ["Erstellt (UTC)", createdAt],
    ["Fall", snapshot.revision.caseId, "Fallrevision", snapshot.revision.caseRevision],
    ["Eingaberevision", snapshot.revision.inputRevision],
    ["Vergleichsrevision", snapshot.comparisonRevision, "Stand (UTC)", snapshot.reservedAt],
    ["Vergleichsfingerabdruck", snapshot.fingerprint],
    ["Fachregel", PREMIUM_RULES, "Modell", PREMIUM_MODEL, "Status", "Fixierter, bedingter Modellvergleich"],
  ];
  for (const sub of snapshot.subresults) {
    const { result } = sub;
    requireAvd(result.status === "computed" && result.value.complete, "DOCUMENT_SUBRESULT_OPEN", "document");
    const curve = result.value;
    rows.push([], ["Teilresultat", sub.subresultId, curve.label ?? curve.curveId, "Fingerabdruck", sub.fingerprint],
      ["Modus", curve.modelMode, "Förderperspektive", curve.fundingPerspective],
      ["Szenario", curve.scenarioVersion, result.evidence.class, result.evidence.source, result.evidence.version],
      ["Wertbasis", curve.valueBasis, "Anfangskapital EUR", amount(curve.openingCents)]);
    if (sub.original) rows.push(["Übernommenes Original", sub.original.subresultId, sub.original.comparisonRevision,
      sub.original.fingerprint, sub.original.reason]);
    if (curve.costEvidence) rows.push(["Kosten", curve.costMode, curve.costEvidence.class, curve.costEvidence.source, curve.costEvidence.version]);
    if (curve.profileIdentity) rows.push(["Anlageprofil", curve.profileIdentity.id, curve.profileIdentity.version, curve.profileIdentity.hash]);
    if (curve.price) rows.push(["Preisreferenz", curve.price.referenceMonth, "Preisreservierung (UTC)", curve.price.reservedAt]);
    const stressRow = curve.rows.find(row => "portfolio" in row && row.portfolio?.stress);
    const stress = stressRow?.portfolio?.stress;
    const difference = productStressDifference(snapshot.subresults, result);
    if (stress) rows.push(["Stressmonat", stressRow.month, "Aktienexponierung EUR", amount(stress.exposedCents), "Unmittelbarer Verlust EUR", amount(stress.lossCents)]);
    if (difference !== null) rows.push(["Endwertdifferenz ohne Stress minus mit Stress EUR", amount(difference)]);
    rows.push(["Monat", "Kapital EUR", "Eigene Zahlungen kumuliert EUR", "Förderung kumuliert EUR"]);
    for (const row of curve.rows) {
      requireAvd(row.balance.status === "computed", "DOCUMENT_ROW_OPEN", row.month);
      rows.push([row.month, amount(row.balance.cents), amount(row.ownCents), amount(row.grantCents)]);
    }
    if (curve.grantEvents.length) rows.push(["Förderereignis", "Vertrag", "Buchungsmonat", "Belegklasse", "Quelle", "Version", "EUR"]);
    for (const event of curve.grantEvents) rows.push([event.id, event.contractId ?? "", event.month,
      event.amountEvidence.class, event.amountEvidence.source, event.amountEvidence.version, amount(event.cents)]);
  }
  return rows;
}

function csvField(value: string) {
  // Quoting does not prevent spreadsheet formulas. Numeric money cells are
  // known fixed-format amounts and remain numeric on import.
  const numeric = /^-?\d+(?:,\d{2})?$/.test(value);
  const dangerous = /^[\s\uFEFF]*[=+@-]/u.test(value) || /^[\t\r\n]/u.test(value);
  const safe = !numeric && dangerous ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export async function renderPremiumDocument(channel: DocumentChannel, snapshot: Snapshot, createdAt: string) {
  const rows = documentRows(snapshot, createdAt);
  if (channel === "csv") return new TextEncoder().encode("\ufeff" + rows.map(row => row.map(csvField).join(";")).join("\r\n") + "\r\n");
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const document = await PDFDocument.create();
  document.setTitle(historicalReport);
  document.setSubject(snapshot.comparisonRevision);
  document.setCreationDate(new Date(createdAt));
  document.setModificationDate(new Date(createdAt));
  const font = await document.embedFont(StandardFonts.Helvetica);
  const allowed = new Set(font.getCharacterSet());
  const printable = (value: string) => Array.from(value.replace(/[\t\r\n]/gu, " "), c => allowed.has(c.codePointAt(0)!) ? c : "?").join("");
  const width = 595, height = 842, margin = 42, size = 9;
  let page = document.addPage([width, height]);
  let y = height - margin;
  const draw = (line: string) => {
    if (y < margin + 12) { page = document.addPage([width, height]); y = height - margin; }
    if (line) page.drawText(line, { x: margin, y, size, font });
    y -= 12;
  };
  for (const row of rows) {
    const text = printable(row.join("   |   "));
    let line = "";
    for (const char of text) {
      if (font.widthOfTextAtSize(line + char, size) > width - 2 * margin) {
        draw(line);
        line = "";
      }
      line += char;
    }
    draw(line);
  }
  return document.save({ useObjectStreams: false });
}
