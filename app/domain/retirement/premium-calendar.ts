import { jsonHash } from "../case/recovery-hash";
import { requireAvd } from "./avd-data";
import { modelMonths } from "./model-input";

export function monthIndex(value: string): number {
  requireAvd(typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
    && value >= "0100-01", "INVALID_MONTH", "month");
  return Number(value.slice(0, 4)) * 12 + Number(value.slice(5)) - 1;
}

export function shiftMonth(value: string, offset: number): string {
  const index = monthIndex(value) + offset;
  requireAvd(Number.isInteger(index) && index >= 1200 && index < 120000, "MONTH_OUT_OF_RANGE", "month");
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String(index % 12 + 1).padStart(2, "0")}`;
}

export interface EndAgeBasis {
  readonly birthYear: number;
  readonly birthMonth: number | null;
  readonly birthMonthEvidence: "B" | "S" | "O";
  readonly sourceVersion: string;
  readonly endAge: number;
}
export interface EndMonthOverride {
  readonly month: string;
  readonly basis: string;
  readonly version: string;
}

export function regularEnd(basis: EndAgeBasis, override: EndMonthOverride | null) {
  const { birthYear, birthMonth, birthMonthEvidence, sourceVersion, endAge } = basis;
  requireAvd(Number.isInteger(birthYear) && birthYear >= 100 && birthYear <= 9999 && Number.isInteger(endAge)
    && endAge > 0 && birthYear + endAge <= 9999 && Boolean(sourceVersion), "INVALID_END_AGE_BASIS", "endAge");
  requireAvd(birthMonth === null ? birthMonthEvidence === "O" : Number.isInteger(birthMonth)
    && birthMonth >= 1 && birthMonth <= 12 && (birthMonthEvidence === "B" || birthMonthEvidence === "S"),
  "INVALID_BIRTH_MONTH", "birthMonth");
  const year = birthYear + endAge;
  const derived = birthMonth === null ? null : shiftMonth(`${String(year).padStart(4, "0")}-${String(birthMonth).padStart(2, "0")}`, -1);
  const key = jsonHash({ birthYear, birthMonth, birthMonthEvidence, sourceVersion, endAge });
  if (override !== null) {
    monthIndex(override.month);
    requireAvd(Boolean(override.version), "OVERRIDE_VERSION_REQUIRED", "override");
    return override.basis === key
      ? { status: "direkt_übersteuert" as const, month: override.month, evidence: "S" as const, derived, basis: key, year }
      : { status: "Konflikt_ungelöst" as const, month: null, evidence: "O" as const, derived, previous: override.month, basis: key, year };
  }
  return derived === null
    ? { status: "offen" as const, month: null, evidence: "O" as const, derived, basis: key, year }
    : { status: "abgeleitet" as const, month: derived, evidence: birthMonthEvidence, derived, basis: key, year };
}

export function overrideRegularEnd(basis: EndAgeBasis, selectedMonth: string, version: string): EndMonthOverride {
  monthIndex(selectedMonth);
  requireAvd(Boolean(version), "OVERRIDE_VERSION_REQUIRED", "override");
  return Object.freeze({ month: selectedMonth, basis: regularEnd(basis, null).basis, version });
}

export type ContributionHorizon =
  | { readonly kind: "regular"; readonly first: string; readonly last: string }
  | { readonly kind: "holdings_only" };
export interface Timeline {
  readonly valuationStart: string;
  readonly valuationEnd: string;
  readonly contributions: ContributionHorizon;
  readonly finalFundingYear: number | null;
  readonly payoutStart: { readonly month: string; readonly evidence: "S"; readonly version: string } | null;
}
export function valuationMonths(timeline: Timeline) {
  const { valuationStart, valuationEnd, contributions, finalFundingYear, payoutStart } = timeline;
  const count = monthIndex(valuationEnd) - monthIndex(valuationStart) + 1;
  requireAvd(count > 0 && count <= 1200, "INVALID_VALUATION_WINDOW", "valuationEnd");
  const months = modelMonths(valuationStart, count);
  if (contributions.kind === "regular") {
    const first = monthIndex(contributions.first);
    const last = monthIndex(contributions.last);
    requireAvd(first <= last, "EMPTY_REGULAR_PLAN", "contributions.last");
    requireAvd(first >= monthIndex(valuationStart) && last <= monthIndex(valuationEnd),
      "CONTRIBUTIONS_OUTSIDE_VALUATION", "contributions");
  }
  requireAvd(finalFundingYear === null || Number.isInteger(finalFundingYear)
    && finalFundingYear >= 100 && finalFundingYear <= 9999, "INVALID_FUNDING_YEAR", "finalFundingYear");
  if (payoutStart) {
    monthIndex(payoutStart.month);
    requireAvd(payoutStart.evidence === "S" && Boolean(payoutStart.version), "PAYOUT_ANCHOR_OPEN", "payoutStart");
  }
  return months;
}
