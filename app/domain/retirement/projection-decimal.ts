/** V1.0 decimal36: outward intervals, integer root comparisons, model half-even. */
import { PROJECTION_LIMITS, type Issue, type IssueCode, type Month } from "./projection-contract";

export const SCALE = 10n ** 36n;
export const MAX_CENTS = 9007199254740991n;
const CENT = SCALE / 100n;
const MAX_EURO = MAX_CENTS * CENT;
export interface DecimalInterval { readonly lo: bigint; readonly hi: bigint }
export const ZERO: DecimalInterval = Object.freeze({ lo: 0n, hi: 0n });
export const ONE: DecimalInterval = Object.freeze({ lo: SCALE, hi: SCALE });
export const point = (n: bigint): DecimalInterval => ({ lo: n, hi: n });
export const fromCents = (n: number): DecimalInterval => point(BigInt(n) * CENT);

export function decimalInteger(s: string): bigint {
  const negative = s.startsWith("-");
  const [whole, fraction = ""] = (negative ? s.slice(1) : s).split(".");
  const n = BigInt(whole) * SCALE + BigInt((fraction + "0".repeat(36)).slice(0, 36));
  return negative ? -n : n;
}
export function decimalString(n: bigint): string {
  if (n === 0n) return "0";
  const magnitude = n < 0n ? -n : n;
  const whole = magnitude / SCALE;
  const fraction = String(magnitude % SCALE).padStart(36, "0").replace(/0+$/, "");
  return `${n < 0n ? "-" : ""}${whole}${fraction ? "." + fraction : ""}`;
}
export const plus = (a: DecimalInterval, b: DecimalInterval): DecimalInterval =>
  ({ lo: a.lo + b.lo, hi: a.hi + b.hi });
export const minus = (a: DecimalInterval, b: DecimalInterval): DecimalInterval =>
  ({ lo: a.lo - b.hi, hi: a.hi - b.lo });
function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  return q - (a < 0n && a % b !== 0n ? 1n : 0n);
}
function ceilDiv(a: bigint, b: bigint): bigint { return -floorDiv(-a, b); }
export function times(a: DecimalInterval, b: DecimalInterval): DecimalInterval {
  if (a.lo === 0n && a.hi === 0n || b.lo === 0n && b.hi === 0n) return ZERO;
  if (a.lo === SCALE && a.hi === SCALE) return b;
  if (b.lo === SCALE && b.hi === SCALE) return a;
  const products = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi];
  let low = products[0], high = products[0];
  for (const p of products) { if (p < low) low = p; if (p > high) high = p; }
  return { lo: floorDiv(low, SCALE), hi: ceilDiv(high, SCALE) };
}

export class ProjectionStop extends Error {
  readonly issue: Issue;
  constructor(code: IssueCode, path: string, month: Month | null = null) {
    super(code); this.name = "ProjectionStop"; this.issue = { code, path, month };
  }
}
export class ProjectionBudget {
  private used = 0;
  tick(path: string, month: Month | null = null): void {
    if (this.used === PROJECTION_LIMITS.ticks) throw new ProjectionStop("work_limit", path, month);
    this.used++;
  }
  /** Diagnostic count; no caller-controlled resource override. */
  count(): number { return this.used; }
}

/** Internal transport guard; no public Request option can change the limit. */
export function enforceOutputBytes(byteLength: number): void {
  if (byteLength > PROJECTION_LIMITS.outputBytes) throw new ProjectionStop("output_bytes_limit", "");
}

export function rootFactor(q: bigint, budget: ProjectionBudget, path: string): DecimalInterval {
  if (q === SCALE) return ONE;
  // Compare m^12 * SCALE to q * SCALE^12, cancelling one exact SCALE.
  const target = q * SCALE ** 11n;
  let lo = 0n, hi = 4n * SCALE;
  while (hi - lo > 1n) {
    const m = (lo + hi) / 2n;
    budget.tick(path);
    const p = m ** 12n;
    if (p === target) return point(m);
    if (p < target) lo = m; else hi = m;
  }
  return { lo, hi };
}
function roundCent(n: bigint): bigint {
  const negative = n < 0n;
  const v = negative ? -n : n;
  const quotient = v / CENT, remainder = v % CENT;
  const rounded = quotient + (2n * remainder > CENT || 2n * remainder === CENT && quotient % 2n === 1n ? 1n : 0n);
  return negative ? -rounded : rounded;
}
export function checkedDomain(a: DecimalInterval, path: string, month: Month | null = null): void {
  if (a.lo < -MAX_EURO || a.hi > MAX_EURO) throw new ProjectionStop("numeric_domain_exceeded", path, month);
}
export function checkedCent(a: DecimalInterval, path: string, month: Month | null = null): number {
  checkedDomain(a, path, month);
  const lo = roundCent(a.lo), hi = roundCent(a.hi);
  if (lo !== hi) throw new ProjectionStop("precision_ambiguous", path, month);
  return Number(lo);
}
export function serializedInterval(a: DecimalInterval) {
  return { lowerEuro: decimalString(a.lo), upperEuro: decimalString(a.hi) };
}
