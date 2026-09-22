// Entirely synthetic 29-column agree21-shaped data, including ignored personal slots.
// The header is independently spelled out, not imported from production detection.
export const finalHeaders = ["Depot-Nr.", "Depotinhaber", "Bewertungsanfang", "Bewertungsende", "Anlagesegment", "Anlagemedium", "Wertpapiertyp", "Land", "Währung", "Branche", "Zertifikateklasse", "Bezeichnung", "Zinssatz", "Endfälligkeit", "WKN", "Stück/Nominal", "letztes Kaufdatum", "Durchschnittl. Einstandskurs", "Kaufkosten", "Kurs", "Kursgewinn/-verlust seit Kauf in %", "Kursgewinn/-verlust seit Kauf", "Kurswert incl. Stückzinsen", "Depotanteil in %", "Stückzinsen", "Durchschnittl. Einstandsdevisenkurs", "Devisenkurs", "Bestand per (Bewertungsanfang)", "Bestand per (Bewertungsende)"];
export type SyntheticRow = Record<string, string | number>;
export const shortReferences = [
  // Python Decimal70: (100+6/f)/(1.05)^(5/365), AI=(6/f)*(periodDays-5)/periodDays.
  { frequency: 1, dirty: 105.92917767817603, ai: 5.917808219178082 },
  { frequency: 2, dirty: 102.93118208351067, ai: 2.9184782608695654 },
  { frequency: 4, dirty: 101.43218428617799, ai: 1.4184782608695652 },
];
export const finalRow = (extra: SyntheticRow = {}): SyntheticRow => ({
  Depotinhaber: "SYNTHETIC-PRIVATE-SLOT", "Depot-Nr.": "SYNTHETIC-DEPOT-SLOT",
  Bezeichnung: "Synthetic annual", WKN: "ZZ0001", Wertpapiertyp: "Festverzinsliche", Währung: "EUR",
  Zinssatz: 6, Endfälligkeit: "01.01.2027", "Stück/Nominal": 10000,
  Kurs: shortReferences[0].dirty - shortReferences[0].ai,
  "Kurswert incl. Stückzinsen": shortReferences[0].dirty * 100,
  Stückzinsen: shortReferences[0].ai * 100, Devisenkurs: "", Bewertungsende: "27.12.2026", ...extra,
});
export const finalCsv = (rows: SyntheticRow[]) => [finalHeaders.join(";"), ...rows.map((r) => finalHeaders.map((h) => typeof r[h] === "number" ? String(r[h]).replace(".", ",") : r[h] ?? "").join(";"))].join("\n");
export const finalMatrix = () => [
  ...shortReferences.map((r) => finalRow({ Bezeichnung: `Synthetic frequency ${r.frequency}`, WKN: `ZZ000${r.frequency}`, Kurs: r.dirty-r.ai, "Kurswert incl. Stückzinsen": r.dirty*100, Stückzinsen: r.ai*100 })),
  finalRow({ Bezeichnung: "Synthetic ambiguous", WKN: "ZZ0010", Bewertungsende: "01.01.2026", Stückzinsen: 0, Kurs: 100, "Kurswert incl. Stückzinsen": 10000 }),
  finalRow({ Bezeichnung: "Synthetic inconsistent", WKN: "ZZ0011", Stückzinsen: 900, Kurs: 91, "Kurswert incl. Stückzinsen": 10000 }),
  finalRow({ Bezeichnung: "Synthetic missing AI", WKN: "ZZ0012", Bewertungsende: "01.01.2026", Stückzinsen: "", Kurs: 100, "Kurswert incl. Stückzinsen": 10000 }),
  finalRow({ Bezeichnung: "Synthetic FX missing", WKN: "ZZ0013", Währung: "USD" }),
  finalRow({ Bezeichnung: "Synthetic dual currency", WKN: "ZZ0014", Wertpapiertyp: "Doppelwährungsanleihe" }),
];
