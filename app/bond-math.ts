import { calendarDate } from "./depot-validation";

export type BondCashflow = { time: number; amount: number; date?: string };
export const civilDay = (date: string) => calendarDate(date) ? Date.parse(`${calendarDate(date)}T00:00:00Z`) / 86400000 : NaN;

export type CouponFrequency = 1 | 2 | 4;
const monthEndDay = (year: number, month: number) => {
  const date = new Date(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01T00:00:00Z`);
  date.setUTCMonth(month); date.setUTCDate(0); return date.getUTCDate();
};
const anchoredDate = (anchorDate: string, monthsBefore: number) => {
  const [year, month, day] = anchorDate.split("-").map(Number);
  const eom = day === monthEndDay(year, month);
  const index = year * 12 + month - 1 - monthsBefore, y = Math.floor(index / 12), m = index % 12 + 1;
  const d = eom ? monthEndDay(y, m) : Math.min(day, monthEndDay(y, m));
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
const accruedBand = (quantization: number | null) => Math.max(.05,
  quantization !== null && Number.isFinite(quantization) && quantization >= 0 ? 2 * quantization : 0);
/** Always derive from original maturity, never iterate a clamped date. */
export function bondCouponCalendar(valuation: string, maturity: string, coupon: number, frequency: CouponFrequency) {
  valuation = calendarDate(valuation) || "";
  maturity = calendarDate(maturity) || "";
  const start = civilDay(valuation), end = civilDay(maturity);
  if (![1, 2, 4].includes(frequency) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isFinite(coupon) || coupon < 0) return null;
  const [year, month] = maturity.split("-").map(Number);
  const anchor = year * 12 + month - 1;
  const cashflows: BondCashflow[] = [];
  for (let offset = 0; anchor - offset * (12 / frequency) >= 12; offset++) {
    const date = anchoredDate(maturity, offset * (12 / frequency));
    const at = civilDay(date);
    if (at <= start) return { cashflows: cashflows.reverse(), previousCoupon: date, nextCoupon: cashflows[0]?.date || maturity };
    cashflows.push({ date, time: (at - start) / 365, amount: coupon / frequency + (offset === 0 ? 100 : 0) });
  }
  return null;
}
export const annualBondCalendar = (valuation: string, maturity: string, coupon: number) => bondCouponCalendar(valuation, maturity, coupon, 1);

export function couponAccruedDiagnostic(valuation: string, maturity: string, coupon: number, frequency: CouponFrequency, ai: number | null, quantization: number | null) {
  const calendar = bondCouponCalendar(valuation, maturity, coupon, frequency);
  const band = accruedBand(quantization);
  if (!calendar || ai === null || !Number.isFinite(ai)) return { calendar, band, compatible: false, testable: false, variants: [] };
  const elapsed = civilDay(valuation) - civilDay(calendar.previousCoupon);
  const period = civilDay(calendar.nextCoupon) - civilDay(calendar.previousCoupon);
  const [y1, m1, d1] = calendar.previousCoupon.split("-").map(Number);
  const [y2, m2, d2] = valuation.split("-").map(Number);
  const days360 = 360 * (y2 - y1) + 30 * (m2 - m1) + Math.min(d2, 30) - Math.min(d1, 30);
  const variants = [
    { dayCount: "ACT/ACT coupon-period", expected: coupon / frequency * elapsed / period },
    { dayCount: "ACT/365F", expected: coupon * elapsed / 365 },
    { dayCount: "30E/360", expected: coupon * days360 / 360 },
  ].map((v) => ({ ...v, deviation: ai - v.expected, compatible: ai >= 0 && !(elapsed === 0 && ai > 0) && Math.abs(ai - v.expected) <= band }));
  return { calendar, band, testable: true, compatible: variants.some((v) => v.compatible), variants };
}

/**
 * Conservative CSV-only convention for an annual bond with a short first coupon period.
 * The inferred start is a model date, never a reconstructed contractual issue/interest date.
 * It must be a whole-month maturity anchor 1..11 months before the first regular annual
 * coupon and uniquely match ACT/365F accrued interest within the unchanged diagnostic band.
 */
export function shortFirstAnnualCouponDiagnostic(valuation: string, maturity: string, coupon: number, ai: number | null, quantization: number | null) {
  const regular = bondCouponCalendar(valuation, maturity, coupon, 1);
  const band = accruedBand(quantization);
  if (!regular || ai === null || !Number.isFinite(ai) || !(coupon > 0) || ai < 0)
    return { calendar: null, band, compatible: false, testable: ai !== null && Number.isFinite(ai), variants: [] as Array<{ months: number; start: string; expected: number; deviation: number; compatible: boolean }> };
  const firstCoupon = regular.nextCoupon;
  const valuationDay = civilDay(valuation), firstCouponDay = civilDay(firstCoupon);
  const variants = Array.from({ length: 11 }, (_, index) => {
    const months = index + 1, start = anchoredDate(firstCoupon, months), startDay = civilDay(start);
    const expected = coupon * (valuationDay - startDay) / 365;
    const shortened = startDay < valuationDay && valuationDay < firstCouponDay && firstCouponDay - startDay < 365;
    return { months, start, expected, deviation: ai - expected, compatible: shortened && Math.abs(ai - expected) <= band };
  });
  const matches = variants.filter((variant) => variant.compatible);
  if (matches.length !== 1) return { calendar: null, band, compatible: false, testable: true, variants };
  const stubStart = matches[0].start;
  const firstCouponAmount = coupon * (firstCouponDay - civilDay(stubStart)) / 365;
  if (!(firstCouponAmount > 0 && firstCouponAmount < coupon)) return { calendar: null, band, compatible: false, testable: true, variants };
  const cashflows = regular.cashflows.map((flow, index) => index === 0
    ? { ...flow, amount: firstCouponAmount + (flow.date === maturity ? 100 : 0) }
    : flow);
  return { calendar: { cashflows, previousCoupon: stubStart, nextCoupon: firstCoupon }, band, compatible: true, testable: true,
    variants, stubStart, firstCoupon, firstCouponAmount, dayCount: "ACT/365F" as const };
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
  if (ai === null || (quantization !== null && (!Number.isFinite(quantization) || quantization < 0))) return "not-testable" as const;
  const calendar = annualBondCalendar(valuation, maturity, coupon);
  if (!calendar) return "not-testable" as const;
  const elapsed = civilDay(valuation) - civilDay(calendar.previousCoupon);
  const period = civilDay(calendar.nextCoupon) - civilDay(calendar.previousCoupon);
  const [y1, m1, d1] = calendar.previousCoupon.split("-").map(Number);
  const [y2, m2, d2] = valuation.split("-").map(Number);
  const days360 = 360 * (y2 - y1) + 30 * (m2 - m1) + Math.min(d2, 30) - Math.min(d1, 30);
  const expected = [coupon * elapsed / period, coupon * elapsed / 365, coupon * days360 / 360];
  const band = accruedBand(quantization);
  if (expected.every((value) => Math.abs(ai - value) > band)) return elapsed === 0 ? "ex-coupon-unclear" as const : "annual-model-contradiction" as const;
  return "compatible" as const;
}
