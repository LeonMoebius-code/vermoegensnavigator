// Artificial data only. No inference about the real bank export contract.
export const cp4Header = "Bezeichnung;WKN;Wertpapiertyp;Anlagemedium;Anlagesegment;Währung;Zinssatz;Endfälligkeit;Stück/Nominal;Kurs;Kurswert incl. Stückzinsen;Stückzinsen;Devisenkurs;Bewertungsende";
export const cp4MatrixCsv = [cp4Header, ...Array.from({ length: 178 }, (_, i) =>
  `CP4 Synthetic ${String(i).padStart(3, "0")};T${String(i).padStart(5, "0")};${i >= 100 ? "Aktien" : i >= 80 && i < 90 ? "Floater" : "Festverzinsliche"};;;EUR;${i >= 90 && i < 100 ? "n/a" : i >= 80 && i < 90 ? 4 : 5};01.01.2027;10000;100;10000;0;1;01.01.2026`
)].join("\n");
export const cp4SecondCsv = [cp4Header,
  "CP4 Synthetic 000;T00000;Festverzinsliche;;;USD;5;01.01.2027;10000;100;10000;0;1;01.01.2026",
  "CP4 Zero overdue;ZERO00;Festverzinsliche;;;EUR;5;01.01.2025;7000;0;0;0;1;01.01.2026",
].join("\n");
export const cp4ConflictCsv = cp4SecondCsv.replace("T00000", "OTHER0");
export const cp4InvalidCsv = cp4SecondCsv.replace(";10000;0;1;", ";invalid;0;1;");
