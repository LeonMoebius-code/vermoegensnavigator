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

export type MetricStatus = "calculable" | "missing-data" | "invalid-data" | "unsupported-structure" | "model-inconsistent" | "legacy-unverified" | "not-applicable";

export type BondMetric = { value: number | null; status: MetricStatus; reasonCode?: string };

export type BondPriceInput = {
  nominal?: number; clean?: number; accrued?: number; market?: number; fxRate?: number;
  bondCurrency?: string; valuationDate?: string; priceDate?: string; accruedDate?: string; fxDate?: string;
  units: BondUnits; quality: SourceQuality; accruedQuantizationPer100: number | null;
};

/** Code-supplied, documented convention; never accepted from saved customer data or UI.
 * CP3 fixtures supply their explicit synthetic contract here. Production uses the versioned importer profile. */
export type BondSourceConvention = {
  evidence: string;
  units: BondUnits;
  accruedQuantizationPer100: number | null;
};
