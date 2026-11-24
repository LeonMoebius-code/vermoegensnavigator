import { requireAvd, stamp } from "./avd-data";
import { applyFactor, basisPoints, monthlyFactor } from "./model-decimal";
import { SCALE } from "./projection-decimal";
import { monthIndex } from "./premium-calendar";
import type { Evidence } from "./premium-contract";

export const BERLIN_CALENDAR = Object.freeze({ timeZone: "Europe/Berlin", version: "berlin-v1" });
export const DEFAULT_INFLATION = Object.freeze({ bps: 200, evidence: { class: "S" as const, source: "project-default", version: "inflation-2pct-v1" } });
export interface ProjectCalendar { readonly timeZone: string; readonly version: string }
export type PriceSelection = { readonly mode: "automatic" } | {
  readonly mode: "manual"; readonly month: string; readonly evidence: Evidence & { readonly class: "S" };
};
export interface Inflation { readonly bps: number; readonly evidence: Evidence & { readonly class: "S" } }
export type PriceReservation = {
  readonly referenceMonth: string;
  readonly calendar: ProjectCalendar | null;
  readonly manualEvidence: (Evidence & { readonly class: "S" }) | null;
  readonly reservedAt: string;
  readonly inflation: Inflation;
};

/** The reservation timestamp identifies the original result; only its price month affects valuation. */
export function priceComparisonBasis(price: PriceReservation | null) {
  if (!price) return null;
  const { reservedAt: _reservedAt, ...basis } = price;
  return basis;
}

export function reservePrice(selection: PriceSelection, calendar: ProjectCalendar, reservedAt: string, inflation: Inflation): PriceReservation {
  stamp(reservedAt, "reservedAt");
  requireAvd(inflation.evidence.class === "S" && inflation.evidence.version && Number.isSafeInteger(inflation.bps)
    && inflation.bps > -10000, "INFLATION_OPEN", "price.inflation");
  if (selection.mode === "manual") {
    monthIndex(selection.month);
    requireAvd(selection.evidence.class === "S" && selection.evidence.version, "MANUAL_PRICE_OPEN", "price.selection");
    return { referenceMonth: selection.month, calendar: null, manualEvidence: selection.evidence, reservedAt, inflation };
  }
  requireAvd(Boolean(calendar.version && calendar.timeZone), "PROJECT_CALENDAR_OPEN", "price.calendar");
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", { timeZone: calendar.timeZone, calendar: "gregory",
      numberingSystem: "latn", month: "2-digit", year: "numeric" }).formatToParts(new Date(reservedAt));
  } catch {
    requireAvd(false, "INVALID_PROJECT_CALENDAR", "price.calendar");
  }
  const referenceMonth = `${parts.find(p => p.type === "year")!.value.padStart(4, "0")}-${parts.find(p => p.type === "month")!.value}`;
  monthIndex(referenceMonth);
  return { referenceMonth, calendar, manualEvidence: null, reservedAt, inflation };
}

const factorPower = (base: bigint, exponent: number): bigint => {
  let factor = SCALE;
  for (; exponent > 0; exponent = Math.floor(exponent / 2), base = applyFactor(base, base))
    if (exponent % 2 === 1) factor = applyFactor(factor, base);
  return factor;
};

export function deflatorFor(price: PriceReservation) {
  const monthly = monthlyFactor(SCALE + basisPoints(price.inflation.bps), "price.inflation");
  const reference = monthIndex(price.referenceMonth);
  return (value: bigint, month: string) => {
    const offset = monthIndex(month) - reference;
    const factor = factorPower(monthly, Math.abs(offset));
    const abs = value < 0n ? -value : value;
    requireAvd(factor > 0n, "PRICE_FACTOR_OUT_OF_RANGE", "price.inflation");
    const amount = offset < 0 ? applyFactor(abs, factor) : (abs * SCALE + factor / 2n) / factor;
    return value < 0n ? -amount : amount;
  };
}
