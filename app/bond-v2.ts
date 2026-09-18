import type { DepotAnalysisPosition } from "./depot-analysis";
import { BondUnits, SourceQuality, sourceFieldValid, validBondSource } from "./bond-source";
import { annualAccruedCheck, annualBondCalendar, civilDay, datedBondDuration, solveBondYield } from "./bond-math";
import { calendarDate } from "./depot-validation";

export type MetricStatus = "calculable" | "missing-data" | "invalid-data" | "unsupported-structure" | "model-inconsistent" | "legacy-unverified" | "not-applicable";
export type BondMetric = { value: number | null; status: MetricStatus; reasonCode?: string };
const ok = (value: number): BondMetric => Number.isFinite(value) ? { value, status: "calculable" } : fail("invalid-data", "non-finite-result");
const fail = (status: MetricStatus, reasonCode: string): BondMetric => ({ value: null, status, reasonCode });
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const nonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const invariant = (values: number[]) => values.length > 0 && values.every((n) => Number.isFinite(n) && Math.abs(n - values[0]) <= 64 * Number.EPSILON * Math.max(1, Math.abs(n)));

export type BondPriceInput = {
  nominal?: number; clean?: number; accrued?: number; market?: number; fxRate?: number;
  bondCurrency?: string; valuationDate?: string; priceDate?: string; accruedDate?: string; fxDate?: string;
  units: BondUnits; quality: SourceQuality; accruedQuantizationPer100: number | null;
};

/** Explicit unit contract; no residual-based profile selection or currency guessing. */
export function resolveBondPrice(input: BondPriceInput) {
  const missing = (reason: string, status: MetricStatus = "missing-data") => ({
    dirty: fail(status, reason), accruedPer100: null as number | null,
    localDirtyValue: null as number | null, currency: input.bondCurrency || null,
    quality: input.quality, accruedQuantizationPer100: input.accruedQuantizationPer100,
  });
  if (!calendarDate(input.valuationDate)) return missing("missing-valuation-date");
  if ([input.priceDate, input.accruedDate, input.fxDate].some((date) => date !== undefined && calendarDate(date) !== input.valuationDate))
    return missing("valuation-date-conflict", "model-inconsistent");
  if (input.accrued !== undefined && (!Number.isFinite(input.accrued) || input.accrued < 0)) return missing("ex-coupon-unclear", "model-inconsistent");
  const u = input.units;
  if (!input.bondCurrency || !/^[A-Z]{3}$/.test(input.bondCurrency)) return missing("unknown-bond-currency");
  // Unknown reporting currency may be bond currency or a foreign currency. The
  // latter cannot be resolved without an explicit FX direction and denomination.
  const sameCurrency = u.reportingCurrency === input.bondCurrency;
  const fxCandidates = sameCurrency ? [1] : positive(input.fxRate)
    ? u.fx === "reporting-per-bond" ? [input.fxRate] : u.fx === "bond-per-reporting" ? [1 / input.fxRate] : [input.fxRate, 1 / input.fxRate]
    : [];
  if (sameCurrency && input.fxRate !== undefined && input.fxRate !== 1) return missing("currency-fx-conflict", "model-inconsistent");
  if (u.reportingCurrency === null && fxCandidates.length) fxCandidates.push(1);
  const nominal = u.nominal === "face-in-bond-currency" && positive(input.nominal) ? input.nominal : null;
  const clean = u.clean === "percent-of-par" && nonnegative(input.clean) ? input.clean : null;
  const aiValues: number[] = [];
  if (input.accrued !== undefined && nonnegative(input.accrued) && u.accrued !== "unknown") {
    const scale = u.accrued === "per100" ? 1 : nominal ? 100 / nominal : null;
    if (scale !== null) {
      const base = input.accrued * scale;
      if (u.accruedCurrency !== "reporting") aiValues.push(base);
      if (u.accruedCurrency !== "bond") {
        if (!fxCandidates.length && base !== 0) return missing("ambiguous-accrued-currency");
        aiValues.push(...(base === 0 ? [0] : fxCandidates.map((f) => base / f)));
      }
    }
  }
  const ai = invariant(aiValues) ? aiValues[0] : null;
  const dirtyValues = u.market === "dirty-absolute" && nonnegative(input.market) && nominal
    ? fxCandidates.map((f) => 100 * input.market! / (f * nominal)) : [];
  // A missing FX never turns a possibly foreign absolute market value into par.
  const dirtyMarket = invariant(dirtyValues) ? dirtyValues[0] : null;
  if (dirtyValues.length && dirtyMarket === null) return missing("ambiguous-price-currency");
  if (aiValues.length && ai === null) return missing("ambiguous-accrued-currency");
  const cleanAi = clean !== null && ai !== null ? clean + ai : null;
  if (dirtyMarket !== null && cleanAi !== null) {
    const priceTolerance = Math.max(0.02, 0.001 * dirtyMarket);
    const marketMismatch = fxCandidates.some((f) => Math.abs(f * nominal! * cleanAi / 100 - input.market!) > Math.max(1, 0.001 * input.market!));
    if (Math.abs(dirtyMarket - cleanAi) > priceTolerance || marketMismatch) return missing("price-path-conflict", "model-inconsistent");
  }
  const dirty = dirtyMarket ?? cleanAi;
  if (!positive(dirty)) return missing(!nominal ? "missing-nominal-or-independent-price" : "unknown-dirty-price");
  const localDirtyValue = nominal ? nominal * dirty / 100 : null;
  return { dirty: ok(dirty), accruedPer100: ai, localDirtyValue: localDirtyValue !== null && Number.isFinite(localDirtyValue) ? localDirtyValue : null,
    currency: input.bondCurrency, quality: input.quality, accruedQuantizationPer100: input.accruedQuantizationPer100 };
}

export const BOND_MODEL_NOTICE = "Jährliche Kuponzahlung und Rückzahlung 100 % angenommen; tatsächliche Kuponfrequenz/-termine und Sonderbedingungen fehlen in der CSV. Indikative, nicht ausfallbereinigte Modellrendite.";
export const BOND_PROFILE_NOTICE = "Quellprofil Strukturübersicht v1: Prozentkurs und Nominal sind Profilannahmen. Stückzinswährung, FX-Richtung und Berichtswährung sind nicht belegt. Keine gesicherte EUR-Gesamtbasis.";

export function bondReasonLabel(code?: string) {
  const labels: Record<string, string> = {
    "coupon-origin-unverified": "Kuponherkunft aus Altdaten nicht prüfbar",
    "invalid-or-missing-coupon": "Kupon fehlt oder ist ungültig",
    "invalid-or-missing-clean": "Clean-Kurs fehlt oder ist ungültig",
    "missing-maturity": "Fälligkeit fehlt oder ist ungültig",
    "missing-valuation-date": "Bewertungsstichtag fehlt oder ist ungültig",
    "valuation-date-conflict": "Abweichende Preis-, Stückzins- oder FX-Stichtage",
    "unknown-bond-currency": "Nominalwährung nicht bekannt",
    "ambiguous-accrued-currency": "Stückzinswährung nicht eindeutig",
    "ambiguous-price-currency": "Dirty-Preis wegen ungeklärter Währung oder FX-Richtung nicht eindeutig",
    "currency-fx-conflict": "Währung und Devisenkurs widersprechen sich",
    "price-path-conflict": "Dirty-Gesamtwert und Clean plus Stückzinsen widersprechen sich",
    "missing-nominal-or-independent-price": "Nominal oder unabhängiger Preis je 100 fehlt",
    "unknown-dirty-price": "Keine eindeutige positive Dirty-Preisbasis",
    "unsupported-cashflows": "Zahlungsstruktur für das Jahresmodell ungeeignet",
    "special-payment-conditions": "Hinweis auf Sonderbedingungen oder Zahlungsstörung",
    "structure-origin-changed": "Strukturdaten stimmen nicht mit der Importherkunft überein",
    "matured": "Fälligkeit erreicht oder überschritten",
    "ex-coupon-unclear": "Negative Stückzinsen oder ungeklärte Cum-/Ex-Kupon-Lage",
    "annual-model-contradiction": "Stückzinsen widersprechen dem Jahreskuponmodell",
    "no-stable-solution": "Keine numerisch stabile Renditelösung",
    "missing-dirty-position-value": "Dirty-Positionswert in bekannter Währung fehlt",
    "position-amount-changed": "Positionsbetrag verändert; absolute Sensitivität ohne konsistente Mengenbasis nicht berechenbar",
    "no-direct-bond": "Keine direkte Anleihe",
  };
  return code ? labels[code] || "Kennzahl nicht berechenbar" : undefined;
}

/** One model path, also usable with independently documented synthetic units. */
export function calculateBondModel(price: ReturnType<typeof resolveBondPrice>, valuation: string, maturity: string, coupon: number) {
  const annualCheck = annualAccruedCheck(valuation, maturity, coupon, price.accruedPer100, price.accruedQuantizationPer100);
  let ytm = price.dirty;
  let macaulay: BondMetric = ytm, modified: BondMetric = ytm;
  let residual: number | null = null;
  if (annualCheck === "annual-model-contradiction" || annualCheck === "ex-coupon-unclear") ytm = fail("model-inconsistent", annualCheck);
  else if (ytm.value !== null) {
    const calendar = annualBondCalendar(valuation, maturity, coupon);
    const flows = calendar?.cashflows.filter((cf) => cf.amount > 0) || [];
    const solved = solveBondYield(price.dirty.value!, flows);
    const duration = solved && datedBondDuration(price.dirty.value!, flows, solved.value);
    ytm = solved && duration ? ok(solved.value) : fail("invalid-data", "no-stable-solution");
    residual = solved?.residual ?? null;
    macaulay = duration ? ok(duration.macaulay) : ytm;
    modified = duration ? ok(duration.modified) : ytm;
  }
  if (ytm.value === null) { macaulay = ytm; modified = ytm; }
  const dv01 = modified.value !== null && price.localDirtyValue !== null && price.currency
    ? ok(price.localDirtyValue * modified.value * 0.0001) : modified.value === null ? modified : fail("missing-data", "missing-dirty-position-value");
  return { ytm, macaulay, modified, dv01, annualCheck, residual };
}

export function analyzeBondV2(position: DepotAnalysisPosition, fallbackDate = new Date()) {
  const source = validBondSource(position.bondSource, position);
  const warnings = [BOND_MODEL_NOTICE];
  if (source) warnings.push(BOND_PROFILE_NOTICE);
  const valuation = calendarDate(position.valuationEnd);
  const fallback = `${fallbackDate.getFullYear()}-${String(fallbackDate.getMonth() + 1).padStart(2, "0")}-${String(fallbackDate.getDate()).padStart(2, "0")}`;
  const maturity = calendarDate(position.maturity);
  const remainingYears = maturity ? ok(Math.max(0, (civilDay(maturity) - civilDay(valuation || fallback)) / 365)) : fail("missing-data", "missing-maturity");
  if (!valuation) warnings.push("Heute-Fallback ausschließlich für Restlaufzeit");
  const field = (key: "coupon" | "currentPrice" | "nominalOrUnits" | "accruedInterest" | "fxRate" | "value") => sourceFieldValid(source, key) ? position[key] : undefined;
  const coupon = field("coupon"), clean = field("currentPrice");
  const couponFailure = !source ? fail("legacy-unverified", "coupon-origin-unverified") : fail(source.fields.coupon.status === "invalid" ? "invalid-data" : "missing-data", "invalid-or-missing-coupon");
  const running = !position.classification.direct ? fail("not-applicable", "no-direct-bond") : !nonnegative(coupon) ? couponFailure
    : !positive(clean) ? fail("missing-data", "invalid-or-missing-clean") : ok(coupon / clean);
  const units = source?.units;
  // EUR is NOT assigned as reporting currency: FX=1 only establishes an
  // invariant local price across the explicitly retained interpretations.
  const price = resolveBondPrice({ nominal: field("nominalOrUnits"), clean, accrued: field("accruedInterest"), market: field("value"), fxRate: field("fxRate"),
    bondCurrency: sourceFieldValid(source, "currency") ? position.currency?.trim().toUpperCase() : undefined,
    valuationDate: sourceFieldValid(source, "valuationEnd") ? valuation : undefined,
    units: units || { clean: "unknown", nominal: "unknown", accrued: "unknown", accruedCurrency: "unknown", market: "unknown", reportingCurrency: null, fx: "unknown" },
    quality: source?.quality || "unknown", accruedQuantizationPer100: source?.accruedQuantizationPer100 ?? null });
  let ytm: BondMetric;
  const sourceText = [position.name, position.securityType, position.sourceType, position.segment, position.investmentMedium, position.certificateClass].join(" ");
  if (!position.classification.direct || position.classification.bondKind !== "fixed") ytm = fail("unsupported-structure", "unsupported-cashflows");
  else if (source && ["name", "securityType", "sourceType", "investmentMedium", "segment", "certificateClass"].some((field) => source.fields[field as keyof typeof source.fields].status === "invalid")) ytm = fail("invalid-data", "structure-origin-changed");
  else if (/ausfall|default|zahlungsgestört|zahlungsverzug|payment delay|ex[- ]coupon|flat|gross|inflation|index.link|amortis|sink|puttable/i.test(sourceText)) ytm = fail("unsupported-structure", "special-payment-conditions");
  else if (!nonnegative(coupon)) ytm = couponFailure;
  else if (!sourceFieldValid(source, "maturity") || !maturity) ytm = fail("missing-data", "missing-maturity");
  else if (!sourceFieldValid(source, "valuationEnd") || !valuation) ytm = fail("missing-data", "missing-valuation-date");
  else if ((remainingYears.value ?? 0) <= 0) ytm = fail("not-applicable", "matured");
  else if (position.importIssues?.some((i) => i.field === "accruedInterest" && i.code === "out-of-range")) ytm = fail("model-inconsistent", "ex-coupon-unclear");
  else ytm = price.dirty;
  let macaulay: BondMetric = ytm, modified: BondMetric = ytm;
  let annualCheck: ReturnType<typeof annualAccruedCheck> = "not-testable";
  let residual: number | null = null;
  if (ytm.value !== null && valuation && maturity && coupon !== undefined) {
    ({ ytm, macaulay, modified, annualCheck, residual } = calculateBondModel(price, valuation, maturity, coupon));
  }
  if (ytm.value === null) { macaulay = ytm; modified = ytm; }
  if (annualCheck === "not-testable") warnings.push("Kuponmodell nicht prüfbar");
  if (remainingYears.value !== null && remainingYears.value > 0 && remainingYears.value <= 31 / 365) warnings.push("rundungssensitiv: Kurzläufer, stark vom Preis und angenommenen Kuponmodell abhängig");
  const dv01 = source?.fields.value.status === "invalid" ? fail("invalid-data", "position-amount-changed") : modified.value !== null && price.localDirtyValue !== null && price.currency
    ? ok(price.localDirtyValue * modified.value * 0.0001) : modified.value === null ? modified : fail("missing-data", "missing-dirty-position-value");
  return { remainingYears, currentYield: running, ytm, macaulay, modified, dv01, dv01Currency: price.currency,
    dirtyPrice: price.dirty, annualCheck, residual, warnings, valuationDate: valuation || null,
    excludeFromBondAggregates: position.excludeFromBondAggregates === true, sourceQuality: source?.quality || "unknown",
    // This adapter has no independently documented common reporting currency.
    reportingCurrency: null, reportingComparable: false };
}
