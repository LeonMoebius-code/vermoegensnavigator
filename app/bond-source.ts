import { calendarDate } from "./depot-validation";

export type SourceQuality = "documented" | "empirically-supported" | "profile-assumption" | "unknown";
export type BondUnits = {
  clean: "percent-of-par" | "unknown";
  nominal: "face-in-bond-currency" | "unknown";
  accrued: "absolute" | "per100" | "unknown";
  accruedCurrency: "bond" | "reporting" | "unknown";
  market: "dirty-absolute" | "unknown";
  reportingCurrency: string | null;
  fx: "reporting-per-bond" | "bond-per-reporting" | "unknown";
};
export const bondSourceFields = ["coupon", "currentPrice", "nominalOrUnits", "accruedInterest", "fxRate", "value", "valuationEnd", "maturity", "currency", "securityType", "investmentMedium", "segment", "certificateClass", "name", "sourceType"] as const;
type SourceField = typeof bondSourceFields[number];
type Evidence = { value: string | number | null; status: "valid" | "missing" | "invalid" };
export type BondSource = {
  profileId: "structure-overview";
  profileVersion: 1 | 2;
  parserVersion: 2;
  quality: "profile-assumption" | "empirically-supported";
  reportingEvidence?: "user-confirmed-format-convention";
  units: BondUnits;
  fields: Record<SourceField, Evidence>;
  // Decimal places in a CSV are not proof of the source's rounding accuracy.
  accruedQuantizationPer100: null;
  dateKind: "report-date";
};
export const structureOverviewUnits: BondUnits = {
  clean: "percent-of-par", nominal: "face-in-bond-currency", accrued: "absolute",
  accruedCurrency: "unknown", market: "dirty-absolute", reportingCurrency: null, fx: "unknown",
};
export const agree21Units: BondUnits = { ...structureOverviewUnits,
  accruedCurrency: "reporting", reportingCurrency: "EUR", fx: "bond-per-reporting" };
// Full supported signature. Personal columns are never retained or inspected.
export const agree21ValueHeaders = ["Bezeichnung", "WKN", "Wertpapiertyp", "Anlagemedium", "Anlagesegment", "Land", "Währung", "Branche", "Zertifikateklasse", "Zinssatz", "Endfälligkeit", "Stück/Nominal", "letztes Kaufdatum", "Durchschnittl. Einstandskurs", "Kaufkosten", "Kurs", "Kurswert incl. Stückzinsen", "Kursgewinn/-verlust seit Kauf in %", "Kursgewinn/-verlust seit Kauf", "Depotanteil in %", "Stückzinsen", "Durchschnittl. Einstandsdevisenkurs", "Devisenkurs", "Bewertungsanfang", "Bewertungsende", "Bestand per (Bewertungsanfang)", "Bestand per (Bewertungsende)"];
export function isAgree21Profile(headers: string[]) {
  const normalize = (s: string) => s.trim().toLocaleLowerCase("de-DE").replace(/\s+/g, "");
  const keys = headers.map(normalize);
  return keys.length === 29 && new Set(keys).size === 29 && [...agree21ValueHeaders, "Depot-Nr.", "Depotinhaber"].every((h) => keys.includes(normalize(h)));
}
type SourceHolding = Partial<Record<SourceField, string | number>> & { importIssues?: { field: string; code: string }[] };

/** The only production adapter. No customer cells or personal columns are retained. */
export function structureOverviewSource(holding: SourceHolding, profileVersion: 1 | 2 = 1): BondSource {
  const fields = {} as BondSource["fields"];
  for (const key of bondSourceFields) {
    const value = holding[key];
    const invalid = holding.importIssues?.some((issue) => issue.field === key);
    fields[key] = { value: value ?? null, status: invalid ? "invalid" : value === undefined || value === "" ? "missing" : "valid" };
  }
  return { profileId: "structure-overview", profileVersion, parserVersion: 2, quality: profileVersion === 2 ? "empirically-supported" : "profile-assumption",
    ...(profileVersion === 2 ? { reportingEvidence: "user-confirmed-format-convention" as const } : {}),
    units: { ...(profileVersion === 2 ? agree21Units : structureOverviewUnits) }, fields, accruedQuantizationPer100: null, dateKind: "report-date" };
}

/** Recheck saved evidence against current values; never promote old parsed numbers. */
export function validBondSource(raw: unknown, holding: SourceHolding): BondSource | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as BondSource;
  if (source.profileId !== "structure-overview" || ![1, 2].includes(source.profileVersion) || source.parserVersion !== 2 ||
      source.quality !== (source.profileVersion === 2 ? "empirically-supported" : "profile-assumption") ||
      (source.profileVersion === 2 && source.reportingEvidence !== "user-confirmed-format-convention") || source.dateKind !== "report-date" || !source.fields ||
      !source.units || Object.keys(structureOverviewUnits).some((key) => source.units[key as keyof BondUnits] !== (source.profileVersion === 2 ? agree21Units : structureOverviewUnits)[key as keyof BondUnits]) ||
      source.accruedQuantizationPer100 !== null) return undefined;
  const result = structureOverviewSource(holding, source.profileVersion);
  for (const key of bondSourceFields) {
    const evidence = source.fields[key];
    if (!evidence || !["valid", "missing", "invalid"].includes(evidence.status)) return undefined;
    if (evidence.value !== (holding[key] ?? null)) {
      result.fields[key] = { value: holding[key] ?? null, status: "invalid" };
    } else if (evidence.status !== result.fields[key].status) {
      result.fields[key].status = "invalid";
    }
  }
  return result;
}

export function normalizeBondHolding<T extends SourceHolding & { bondSource?: BondSource; excludeFromBondAggregates?: boolean }>(holding: T): T {
  return { ...holding, bondSource: validBondSource(holding.bondSource, holding), excludeFromBondAggregates: holding.excludeFromBondAggregates === true };
}

export function sourceFieldValid(source: BondSource | undefined, field: SourceField) {
  const evidence = source?.fields[field];
  if (evidence?.status !== "valid") return false;
  if (["valuationEnd", "maturity"].includes(field)) return Boolean(calendarDate(evidence.value));
  return typeof evidence.value !== "number" || Number.isFinite(evidence.value);
}
