import { DepotAccount, DepotHolding, StructurePlan } from "./case-model";
import { AnalysisState, BondCoverage, BondMetricKey, BondPositionAnalysis, bondPortfolioAnalysis, buildDepotAnalysisPositions } from "./depot-analysis";
import { validBondSource } from "./bond-source";
import { BOND_MODEL_NOTICE, BondMetric, bondReasonLabel, frequencyLabel } from "./bond-v2";

const decimal = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const oneDecimal = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const bondNumber = (n: number | null, suffix = "") => n === null || !Number.isFinite(n) ? "nicht berechenbar" : `${n > 0 && n < .01 ? "< 0,01" : decimal.format(n)}${suffix}`;
export const bondCoverageLabel = (c: BondCoverage) => c.status === "not-applicable" ? "nicht anwendbar" : c.status === "invalid-value-basis" ? "Wertbasis numerisch nicht darstellbar" : c.value === null ? "EUR-Abdeckung nicht ermittelbar" : `${decimal.format(c.value * 100)} %`;
export const bondMetricLabel = (m: BondMetric, suffix: string, factor = 1) => m.value === null ? `– (${bondReasonLabel(m.reasonCode) || "nicht berechenbar"})` : bondNumber(m.value * factor, suffix);
export const BOND_CONVENTION_NOTICE = "Kalender: jährlicher/halbjährlicher/vierteljährlicher Fälligkeitsanker mit Monatsendregel; effektive Jahresrendite, ACT/365F. Ø YTM ist ein Marktwertdurchschnitt, keine Portfolio-IRR. Coverage ist Datenabdeckung, keine Bestätigung der Vertragsbedingungen.";
export const BOND_SCENARIO_NOTICE = "Lineare Verschiebung der modellierten Bondrenditen. Kein Kredit-, Ausfall-, Spread-, FX- oder Konvexitätsmodell; keine Prognose der risikofreien Zinskurve.";
export const BOND_EXPORT_SCOPE_NOTICE = "Druck und Excel enthalten stets den IST-Bestand – unabhängig von der aktuell angezeigten IST-/PLAN-Sicht.";
export const bondMetricNames: Record<BondMetricKey, string> = { ytm: "Indikative Rendite bis Fälligkeit", currentYield: "Laufende Verzinsung", modified: "Modified Duration", dv01: "Portfolio-DV01" };

const accruedConvention = (row: BondPositionAnalysis) => {
  const base = row.position.bondBase || row.position;
  const source = validBondSource(base.bondSource, base);
  return source?.units.accruedCurrency === "reporting" && source.units.reportingCurrency === "EUR"
    ? "EUR-Berichtswährung" : "Währungskonvention ungeklärt";
};

const compactStatus = (row: BondPositionAnalysis) => {
  if (row.position.excludeFromBondAggregates) return "Bewusst nicht berücksichtigt";
  const code = row.metrics.ytm.reasonCode;
  if (code === "missing-required-fx") return "Wechselkurs fehlt";
  if (["price-path-conflict", "coupon-model-contradiction", "annual-model-contradiction", "invalid-accrued", "ex-coupon-unclear"].includes(code || "")) return "Stückzins- oder Preisangaben widersprüchlich";
  if (["unsupported-cashflows", "special-payment-conditions"].includes(code || "")) return "Zahlungsstruktur nicht ausreichend bekannt";
  if (code === "coupon-model-ambiguous" || row.metrics.model?.modelStatus === "ambiguous") return "Kuponmodell nicht eindeutig; nicht im Renditeüberblick";
  if (row.metrics.model?.modelStatus === "assumed-annual") return "Berechenbar mit ungeprüfter Jahresmodellannahme";
  if (row.metrics.ytm.value !== null) return row.metrics.model?.modelStatus === "identified"
    ? "Berechenbar; Kuponfrequenz rechnerisch abgeleitet" : "Berechenbar";
  return bondReasonLabel(code) || "Nicht berechenbar";
};

const coverageSentence = (label: string, coverage: BondCoverage, directCount: number) => {
  const count = coverage.includedAndCalculable.count;
  const universe = `${directCount} ${directCount === 1 ? "Anleihe" : "Anleihen"}`;
  if (coverage.value === null) return `${label}: ${count} von ${universe}; wertbezogene EUR-Abdeckung nicht ermittelbar.`;
  if (!count) return `${label}: ${directCount === 1 ? "für die Anleihe nicht" : `für keine der ${universe}`} berechenbar (0,0 % des direkten Rentenwerts).`;
  return `${label}: ${count} von ${universe} und ${oneDecimal.format(coverage.value * 100)} % des direkten Rentenwerts.`;
};

/** Shared analysis/presentation data. Only the V2 core computes bond metrics. */
export function buildBondAnalysisData(depot: DepotHolding[], plan: StructurePlan, state: AnalysisState,
  accounts: DepotAccount[] = [], fallbackDate = new Date(), conventionFor?: Parameters<typeof bondPortfolioAnalysis>[2]) {
  const analysis = bondPortfolioAnalysis(buildDepotAnalysisPositions(depot, plan, state, true), fallbackDate, conventionFor);
  const rows = analysis.rows.filter((r) => r.position.classification.direct);
  const title = `Zins & Laufzeiten – ${state.toUpperCase()} (physischer ${state === "ist" ? "Bestand" : "Restbestand"})`;
  const basisNotice = analysis.reportingComparable ? "Gemeinsame EUR-Berichtswährung gemäß angegebenem Quellenvertrag." :
    `EUR-Gesamtbasis nicht belegt; ${analysis.unknownReportingCount} Positionen ohne belegbaren EUR-Wert. Bekannter EUR-Teilbestand: ${bondNumber(analysis.knownValueEUR, " EUR")}.`;
  const exclusionNotice = `Kennzahlen für berechenbaren und gewählten Teilbestand; ${analysis.excludedCount} Positionen bewusst nicht berücksichtigt (${bondNumber(analysis.excludedValueEUR, " EUR")}).`;
  const dateNotice = `${analysis.mixedValuationDates ? "Gemischte Bewertungsstichtage" : "Bewertungsstichtage"}: ${analysis.valuationDates.join(", ") || "fehlen"}. ${rows.some((r) => !r.metrics.valuationDate) ? "Heute-Fallback ausschließlich für Restlaufzeit." : "Keine Aktualisierung der Kurse auf heute."}`;
  const modelNotice = `Modellstatus: ${rows.filter((r) => r.metrics.model?.modelStatus === "identified").length} rechnerisch identifiziert, ${rows.filter((r) => r.metrics.model?.modelStatus === "ambiguous").length} mehrdeutig (keine Renditeaggregate), ${rows.filter((r) => r.metrics.model?.modelStatus === "assumed-annual").length} ungeprüfte Jahresmodellannahmen. Annahmen können im berechenbaren gewählten Teilbestand enthalten sein.`;
  const notices = [BOND_MODEL_NOTICE, BOND_CONVENTION_NOTICE, basisNotice, exclusionNotice, dateNotice,
    "Laufende Verzinsung: momentane Kupon-Kurs-Relation, bei Floater und Stufenzins nur eine Momentaufnahme; keine Gesamtrendite.",
    modelNotice,
    ...new Set(rows.map((r) => r.metrics.sourceEvidence)),
    ...analysis.reportingAmounts.map((g) => `Belegter Marktwert-Teilbestand ${g.currency}: ${bondNumber(g.value, ` ${g.currency}`)} in ${g.count} Positionen; keine Addition verschiedener Berichtswährungen.`)];
  const summary = ([
    ["ytm", analysis.averageModeledYtm, " %", 100], ["currentYield", analysis.averageCurrentYield, " %", 100],
    ["modified", analysis.portfolioModified, " Jahre", 1], ["dv01", analysis.portfolioDv01, " EUR", 1],
  ] as const).map(([key, value, suffix, factor]) => ({ key, label: bondMetricNames[key],
    value: bondNumber(value === null ? null : value * factor, suffix), coverage: analysis.coverages[key],
    coverageText: coverageSentence(bondMetricNames[key], analysis.coverages[key], analysis.directCount) }));
  const primarySummary = summary.filter((s) => s.key === "ytm" || s.key === "currentYield");
  const riskSummary = summary.filter((s) => s.key === "modified" || s.key === "dv01");
  const customerNotices = [
    analysis.mixedValuationDates ? `Die Positionen haben unterschiedliche Bewertungsstichtage (${analysis.valuationDates.join(", ")}).` : "",
    !analysis.reportingComparable ? basisNotice : "",
    rows.some((r) => r.metrics.model?.modelStatus === "assumed-annual") ? "Mindestens eine ausgewiesene Positionsrendite beruht auf einer ungeprüften Jahresmodellannahme." : "",
    rows.some((r) => r.metrics.model?.modelStatus === "ambiguous") ? "Bei mindestens einer Position ist das Kuponmodell nicht eindeutig; sie fließt nicht in den Renditeüberblick ein." : "",
    rows.some((r) => r.metrics.ytm.value === null) ? "Für einzelne Positionen fehlen Angaben oder die Zahlungsstruktur ist für eine belastbare Modellrendite nicht ausreichend bekannt." : "",
    analysis.excludedCount ? `${analysis.excludedCount} Position${analysis.excludedCount === 1 ? " wurde" : "en wurden"} bewusst aus den aggregierten Rentenkennzahlen ausgeklammert.` : "",
  ].filter(Boolean);
  const coverageHeaders = ["Kennzahl", "EUR-Coverage", "Aggregatbasis EUR", "Gültig einbezogen: Anzahl / EUR", "Bewusst ausgeschlossen: Anzahl / EUR", "Sonst nicht berechenbar: Anzahl / EUR"];
  const coverageRows = summary.map((s) => [s.label, bondCoverageLabel(s.coverage), bondNumber(s.coverage.basisEUR, " EUR"),
    ...(["includedAndCalculable", "manuallyExcluded", "notCalculable"] as const).map((key) => `${s.coverage[key].count} / ${bondNumber(s.coverage[key].valueEUR, " EUR")}`)]);
  const ladderHeaders = ["Fälligkeitsjahr", "Nominalwährung", "Status", "Nominal", "Anzahl", "Marktwert EUR", "AUS: Anzahl / Nominal / EUR", "Nullmarktwert: Anzahl / Nominal"];
  const ladderRows = analysis.ladder.map((l) => [String(l.year), l.currency, l.overdue ? "Fälligkeit erreicht / überschritten" : "ausstehend",
    bondNumber(l.nominal, ` ${l.currency}`), String(l.count), bondNumber(l.marketValue, " EUR"),
    `${l.excludedCount} / ${bondNumber(l.excludedNominal, ` ${l.currency}`)} / ${bondNumber(l.excludedMarketValue, " EUR")}`,
    `${l.zeroValueCount} / ${bondNumber(l.zeroValueNominal, ` ${l.currency}`)}`]);
  const customerLadderHeaders = ["Fälligkeitsjahr", "Währung", "Nominal", "Positionen", "Status"];
  const customerLadderRows = analysis.ladder.map((l) => [String(l.year), l.currency, bondNumber(l.nominal, ` ${l.currency}`), String(l.count), l.overdue ? "Fälligkeit erreicht / überschritten" : "ausstehend"]);
  const accruedLabels = new Set(rows.map(accruedConvention));
  const accruedHeader = accruedLabels.size === 1 && accruedLabels.has("EUR-Berichtswährung") ? "Stückzinsen (EUR-Berichtswährung)" : "Stückzinsen (profilabhängige Währung)";
  const positionHeaders = ["Depot", "Position", "Einbeziehung", "Nominal", accruedHeader, "Stichtag / Fälligkeit", "Restlaufzeit", "Laufende Verzinsung", "Indikative YTM", "Macaulay", "Modified", "DV01 (lokal)", "Datenstatus / Hinweise"];
  const positionRows = rows.map((r) => [accounts.find((a) => a.id === r.position.depotId)?.name || "Ohne Depotzuordnung", r.position.name,
    r.position.excludeFromBondAggregates ? "Nicht in aggregierten Rentenkennzahlen" : "Einbezogen, soweit berechenbar",
    bondNumber(r.position.nominalOrUnits ?? null, ` ${r.position.currency || "Währung unbekannt"}`), `${bondNumber(r.position.accruedInterest ?? null)} (${accruedConvention(r)})`,
    `${r.metrics.valuationDate || "fehlt"} / ${r.position.maturity || "fehlt"}`,
    r.remainingYears === 0 ? "Fälligkeit erreicht / überschritten" : bondNumber(r.remainingYears, " Jahre"),
    bondMetricLabel(r.metrics.currentYield, " %", 100), `${bondMetricLabel(r.metrics.ytm, " %", 100)}${r.metrics.ytm.value !== null && ["ambiguous", "assumed-annual"].includes(r.metrics.model?.modelStatus || "") ? " (Jahresmodellannahme)" : ""}`,
    bondMetricLabel(r.metrics.macaulay, " Jahre"), bondMetricLabel(r.metrics.modified, " Jahre"),
    bondMetricLabel(r.metrics.dv01, ` ${r.metrics.dv01Currency || "Währung unbekannt"}`),
    [r.position.classification.sub, r.metrics.model?.modelLabel || "Kuponmodell nicht berechenbar",
      ...(r.metrics.model?.candidates || []).filter((c) => c.compatible).map((c) => `${frequencyLabel(c.frequency)}: ${bondNumber(c.ytm === null ? null : c.ytm * 100, " %")} (Modellalternative), Stückzinsband ${c.band} pro100, ${c.variants.map((v) => `${v.dayCount}: erwartet ${bondNumber(v.expected)}, ${v.compatible ? "passt" : "passt nicht"}`).join(" / ")}`),
      r.position.value === 0 ? "Marktwert 0; Nominal bleibt separat sichtbar" : "", r.position.quantityScale === null ? "PLAN-Mengenbasis nicht berechenbar" : "",
      ...(["ytm", "currentYield", "modified", "dv01"] as const).map((key) => `${bondMetricNames[key]}: ${r.metrics[key].status}${r.metrics[key].reasonCode ? ` (${bondReasonLabel(r.metrics[key].reasonCode)})` : ""}`),
      ...r.metrics.warnings.filter((w) => w.includes("rundungssensitiv") || w.includes("nicht prüfbar") || w.includes("Fallback") || w.includes("Grundband"))].filter(Boolean).join(" · ")]);
  const customerPositionHeaders = ["Depot", "Wertpapier", "Marktwert", "Fälligkeit", "Indikative Rendite", "Fachlicher Status"];
  const customerPositionRows = rows.map((r) => [
    accounts.find((a) => a.id === r.position.depotId)?.name || "Ohne Depotzuordnung", r.position.name,
    r.metrics.reportingValueCurrency ? bondNumber(r.position.value, ` ${r.metrics.reportingValueCurrency}`) : `${bondNumber(r.position.value)} (Währung ungeklärt)`,
    r.position.maturity || "nicht bekannt",
    r.metrics.ytm.value === null ? "–" : `${bondNumber(r.metrics.ytm.value * 100, " %")}${["ambiguous", "assumed-annual"].includes(r.metrics.model?.modelStatus || "") ? " (Jahresmodellannahme)" : ""}`,
    compactStatus(r),
  ]);
  const ladderNotice = `Datum-Coverage: ${bondCoverageLabel(analysis.maturity)}; Nominalleiter-Coverage: ${bondCoverageLabel(analysis.nominalLadder)}. ${analysis.zeroValueCount} Nullmarktwertpositionen. Nominale getrennt nach Währung; keine Rückzahlungsgarantie. Nominalbasis aus dem Quellenprofil, keine bestätigten Vertragszahlungen.`;
  const customerLadderNotice = `Nominale werden getrennt nach Währung gezeigt. Die Übersicht ist für ${analysis.nominalLadder.includedAndCalculable.count} von ${analysis.directCount} ${analysis.directCount === 1 ? "Anleihe" : "Anleihen"} verfügbar${analysis.nominalLadder.value === null ? "; wertbezogene EUR-Abdeckung nicht ermittelbar" : ` (${oneDecimal.format(analysis.nominalLadder.value * 100)} % des direkten Rentenwerts)`}.`;
  const scenarioRows = analysis.scenarios.map((s) => [`Bondrendite ${s.deltaYield > 0 ? "+" : ""}${decimal.format(s.deltaYield * 100)} %-Pkt.`, bondNumber(s.effect, " EUR")]);
  const exportRows: string[][] = [["Zins & Laufzeiten – IST (physischer Bestand)"], [BOND_EXPORT_SCOPE_NOTICE], [], ["Überblick"],
    ["Kennzahl", "Ergebnis", "Datenabdeckung"], ...summary.map((s) => [s.label, s.value, s.coverageText]),
    [], ["Wichtige Hinweise"], ...(customerNotices.length ? customerNotices.map((n) => [n]) : [["Keine wesentlichen zusätzlichen Einschränkungen."]]),
    [], ["Fälligkeitsübersicht"], [customerLadderNotice], customerLadderHeaders,
    ...(customerLadderRows.length ? customerLadderRows : [["keine belastbare Nominaldarstellung"]]),
    [], ["Positionen"], customerPositionHeaders, ...customerPositionRows];
  const technicalExportRows: string[][] = [["Technische Nachweise – Zins & Laufzeiten – IST"], ...notices.map((n) => [n]),
    ["Physische direkte Rentenpositionen", String(analysis.directCount)], ["Direkter Rentenwert EUR", bondNumber(analysis.directValueEUR, " EUR")],
    coverageHeaders, ...coverageRows, ["Zinsszenarien"], [BOND_SCENARIO_NOTICE], ...scenarioRows,
    ["Fälligkeitsleiter"], [ladderNotice], ladderHeaders, ...(ladderRows.length ? ladderRows : [["keine belastbare Nominaldarstellung"]]),
    positionHeaders, ...positionRows];
  return { title, analysis, rows, notices, customerNotices, summary, primarySummary, riskSummary, coverageHeaders, coverageRows,
    ladderHeaders, ladderRows, customerLadderHeaders, customerLadderRows, ladderNotice, customerLadderNotice,
    positionHeaders, positionRows, customerPositionHeaders, customerPositionRows, scenarioRows, exportRows, technicalExportRows };
}

/** Export deliberately fixes IST regardless of the selected/preferred plan. */
export function buildBondIstExportData(depot: DepotHolding[], plan: StructurePlan, accounts: DepotAccount[] = [], fallbackDate = new Date()) {
  return buildBondAnalysisData(depot, plan, "ist", accounts, fallbackDate);
}
