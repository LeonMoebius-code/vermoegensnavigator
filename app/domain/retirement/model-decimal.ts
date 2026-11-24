import { requireAvd } from "./avd-data";
import { MAX_CENTS, ProjectionBudget, rootFactor, SCALE } from "./projection-decimal";

const CENT = SCALE / 100n;
const OUTPUT_UNIT = 10n ** 18n;
const BASIS_POINTS = 10_000n;

export const euros = (cents: number | bigint) => BigInt(cents) * CENT;
export const basisPoints = (value: number) => BigInt(value) * (SCALE / BASIS_POINTS);
const round = (value: bigint, unit: bigint) => (value + unit / 2n) / unit;
export const applyFactor = (value: bigint, factor: bigint) => round(value * factor, SCALE);

export function monthlyFactor(annual: bigint, at: string) {
  requireAvd(annual > 0n, "invalid_annual_factor", at);
  // rootFactor encloses the root to one decimal36 unit. Choose its upper endpoint
  // deterministically. Both endpoints coincide for exactly representable roots.
  return rootFactor(annual, new ProjectionBudget(), at).hi;
}

export function outputCents(value: bigint, at: string) {
  requireAvd(value >= 0n && value <= MAX_CENTS * CENT, "balance_out_of_range", at);
  // Limit output conversion to 18 decimal places in EUR to suppress residual
  // decimal36 root noise at exact half-cent ties. The working balance is untouched.
  return Number(round(round(value, OUTPUT_UNIT) * OUTPUT_UNIT, CENT));
}

/** Signed model cashflows use the same fixed-point and half-up output contract. */
export function signedOutputCents(value: bigint, at: string) {
  return value < 0n ? -outputCents(-value, at) || 0 : outputCents(value, at);
}

/** Apply a monthly growth factor before one or more month-end cashflows. */
export function advanceSavingsMonth(balance: bigint, factor: bigint, monthEndCashflow: bigint) {
  return applyFactor(balance, factor) + monthEndCashflow;
}

export function splitBalance(value: bigint, weights: readonly number[]) {
  // Carry the fixed-point remainder through the cumulative targets. Shares
  // are nonnegative and sum to the original balance even for tiny amounts.
  let allocated = 0n;
  let cumulative = 0n;
  return weights.map(weight => {
    cumulative += BigInt(weight);
    const target = round(value * cumulative, BASIS_POINTS);
    const share = target - allocated;
    allocated = target;
    return share;
  });
}

export function sumBalances(values: readonly bigint[]) {
  return values.reduce((total, value) => total + value, 0n);
}

export function catalogRatio(value: number, at: string) {
  requireAvd(value >= 0 && value < 1, "invalid_cost_ratio", at);
  // P1 ratios are JSON numbers. Convert their canonical decimal representation
  // without multiplying via IEEE-754 before entering the fixed-point model.
  const [digits, exponent = "0"] = String(value).split("e");
  const [whole, fractional = ""] = digits.split(".");
  const precision = 36 + Number(exponent) - fractional.length;
  requireAvd(precision >= 0, "cost_precision_exceeded", at);
  return BigInt(whole + fractional) * 10n ** BigInt(precision);
}
