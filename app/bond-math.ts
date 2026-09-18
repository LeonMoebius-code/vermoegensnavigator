import { calendarDate } from "./depot-validation";

export type BondCashflow = { time: number; amount: number; date?: string };
export const civilDay = (date: string) => calendarDate(date) ? Date.parse(`${calendarDate(date)}T00:00:00Z`) / 86400000 : NaN;

/** Every date is derived from the original maturity, including the EOM rule. */
export function annualBondCalendar(valuation: string, maturity: string, coupon: number) {
  valuation = calendarDate(valuation) || "";
  maturity = calendarDate(maturity) || "";
  const start = civilDay(valuation), end = civilDay(maturity);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isFinite(coupon) || coupon < 0) return null;
  const [year, month, day] = maturity.split("-").map(Number);
  const daysInMonth = (y: number) => new Date(`${String(y).padStart(4, "0")}-${String(month).padStart(2, "0")}-01T00:00:00Z`);
  const monthEnd = (y: number) => { const date = daysInMonth(y); date.setUTCMonth(month); date.setUTCDate(0); return date.getUTCDate(); };
  const eom = day === monthEnd(year);
  const cashflows: BondCashflow[] = [];
  for (let offset = 0; offset <= year - 1; offset++) {
    const y = year - offset;
    const d = eom ? monthEnd(y) : Math.min(day, monthEnd(y));
    // A valid February 29 is always EOM. Non-EOM clamping is deterministic.
    const date = `${String(y).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const at = civilDay(date);
    if (at <= start) {
      cashflows.reverse();
      return { cashflows, previousCoupon: date, nextCoupon: cashflows[0]?.date || maturity };
    }
    const amount = coupon + (offset === 0 ? 100 : 0);
    // Keep zero-coupon calendar dates out of the positive cashflow solver.
    cashflows.push({ date, time: (at - start) / 365, amount });
  }
  return null;
}

function validFlows(flows: BondCashflow[]) {
  return flows.length > 0 && flows.every((cf) => Number.isFinite(cf.time) && cf.time > 0 && Number.isFinite(cf.amount) && cf.amount > 0);
}
export function bondPresentValue(flows: BondCashflow[], yieldRate: number): number | null {
  if (!validFlows(flows) || !Number.isFinite(yieldRate) || yieldRate <= -1) return null;
  const price = flows.reduce((sum, cf) => sum + cf.amount * Math.exp(-cf.time * Math.log1p(yieldRate)), 0);
  return Number.isFinite(price) ? price : null;
}

/** Bisect log(1+y): monotonic, finite domain, no economic yield cutoff. */
export function solveBondYield(price: number, flows: BondCashflow[]) {
  if (!(price > 0) || !Number.isFinite(price) || !validFlows(flows)) return null;
  const logPv = (x: number) => {
    const terms = flows.map((cf) => Math.log(cf.amount) - cf.time * x);
    const max = Math.max(...terms);
    return max + Math.log(terms.reduce((sum, term) => sum + Math.exp(term - max), 0));
  };
  const target = Math.log(price);
  const minX = Math.log(Number.EPSILON / 2), maxX = Math.log(Number.MAX_VALUE);
  let low = -1, high = 1;
  for (let n = 0; n < 16 && logPv(low) < target && low > minX; n++) low = Math.max(minX, low * 2);
  for (let n = 0; n < 16 && logPv(high) > target && high < maxX; n++) high = Math.min(maxX, high * 2);
  if (logPv(low) < target || logPv(high) > target) return null;
  for (let iteration = 1; iteration <= 200; iteration++) {
    const mid = (low + high) / 2;
    const y = Math.expm1(mid);
    const pv = bondPresentValue(flows, y);
    if (pv !== null && Math.abs(pv - price) <= Math.max(1e-8, 1e-10 * price) && high - low <= 1e-12 * Math.max(1, Math.abs(mid)))
      return { value: y, residual: pv - price, iterations: iteration };
    if (logPv(mid) > target) low = mid; else high = mid;
  }
  return null;
}

export function datedBondDuration(price: number, flows: BondCashflow[], y: number) {
  const pv = bondPresentValue(flows, y);
  if (pv === null || !(price > 0) || Math.abs(pv - price) > Math.max(1e-8, 1e-10 * price)) return null;
  const macaulay = flows.reduce((sum, cf) => sum + cf.time * cf.amount * Math.exp(-cf.time * Math.log1p(y)), 0) / price;
  const modified = macaulay / (1 + y);
  return Number.isFinite(modified) && Number.isFinite(macaulay) ? { macaulay, modified } : null;
}

export function annualAccruedCheck(valuation: string, maturity: string, coupon: number, ai: number | null, quantization: number | null) {
  if (ai !== null && !Number.isFinite(ai)) return "not-testable" as const;
  if (ai !== null && ai < 0) return "ex-coupon-unclear" as const;
  if (ai !== null && ai > 0 && annualBondCalendar(valuation, maturity, coupon)?.previousCoupon === valuation) return "ex-coupon-unclear" as const;
  if (ai === null || quantization === null || !Number.isFinite(quantization) || quantization < 0) return "not-testable" as const;
  const calendar = annualBondCalendar(valuation, maturity, coupon);
  if (!calendar) return "not-testable" as const;
  const elapsed = civilDay(valuation) - civilDay(calendar.previousCoupon);
  const period = civilDay(calendar.nextCoupon) - civilDay(calendar.previousCoupon);
  const [y1, m1, d1] = calendar.previousCoupon.split("-").map(Number);
  const [y2, m2, d2] = valuation.split("-").map(Number);
  const days360 = 360 * (y2 - y1) + 30 * (m2 - m1) + Math.min(d2, 30) - Math.min(d1, 30);
  const expected = [coupon * elapsed / period, coupon * elapsed / 365, coupon * days360 / 360];
  const band = Math.max(0.05, 2 * quantization);
  if (expected.every((value) => Math.abs(ai - value) > band)) return elapsed === 0 ? "ex-coupon-unclear" as const : "annual-model-contradiction" as const;
  return "compatible" as const;
}
