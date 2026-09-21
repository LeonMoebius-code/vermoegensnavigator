import type { DepotAnalysisPosition } from "./depot-analysis";
import { BondUnits, SourceQuality, sourceFieldValid, validBondSource } from "./bond-source";
import { annualAccruedCheck, couponAccruedDiagnostic, CouponFrequency, civilDay, datedBondDuration, solveBondYield } from "./bond-math";
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
  if (!sameCurrency && u.reportingCurrency && !positive(input.fxRate)) return missing("missing-required-fx");
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

export const BOND_MODEL_NOTICE = "Indikative Modellrenditen: jährliche, halbjährliche und vierteljährliche Kuponkalender werden geprüft. Rückzahlung 100 % angenommen. Frequenz nur rechnerisch abgeleitet oder ausdrücklich angenommen, nie vertraglich bestätigt. Keine ausfallbereinigte Rendite.";
export const BOND_PROFILE_NOTICE = "agree21-Strukturübersicht v2 (bestätigtes 29-Spalten-Profil): EUR-Berichtswährung fachlich vom Nutzer bestätigt. Prozentkurs, Nominal in Wertpapierwährung, Dirty-Marktwert und absolute Stückzinsen in EUR sowie FX als Wertpapierwährung je EUR empirisch durch CSV, Screenshot und Gegenrechnungen gestützt. Keine Herstellerbestätigung. Rundungspräzision unbekannt.";
export const LEGACY_BOND_PROFILE_NOTICE = "Strukturübersicht v1: unbestätigte Profilannahmen, Berichtswährung und FX-/Stückzinskonvention unbekannt. Keine gesicherte EUR-Gesamtbasis.";

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
    "unsupported-cashflows": "Zahlungsstruktur für reguläre Kuponmodelle ungeeignet",
    "special-payment-conditions": "Hinweis auf Sonderbedingungen oder Zahlungsstörung",
    "structure-origin-changed": "Strukturdaten stimmen nicht mit der Importherkunft überein",
    "matured": "Fälligkeit erreicht oder überschritten",
    "ex-coupon-unclear": "Negative Stückzinsen oder ungeklärte Cum-/Ex-Kupon-Lage",
    "annual-model-contradiction": "Stückzinsen widersprechen dem Jahreskuponmodell",
    "coupon-model-contradiction": "Keines der drei Kuponmodelle passt zum Stückzins",
    "coupon-model-ambiguous": "Mehrere Kuponmodelle passen, keine eindeutige Rendite",
    "invalid-accrued": "Ungültiger Stückzins, Modellprüfung nicht verlässlich",
    "missing-required-fx": "Erforderlicher Devisenkurs zur Wertpapierwährung fehlt",
    "no-stable-solution": "Keine numerisch stabile Renditelösung",
    "missing-dirty-position-value": "Dirty-Positionswert in bekannter Währung fehlt",
    "position-amount-changed": "Positionsbetrag verändert; absolute Sensitivität ohne konsistente Mengenbasis nicht berechenbar",
    "plan-quantity-unknown": "PLAN-Mengenbasis für diese Struktur nicht proportional ableitbar",
    "no-direct-bond": "Keine direkte Anleihe",
  };
  return code ? labels[code] || "Kennzahl nicht berechenbar" : undefined;
}

export const frequencyLabel = (f: CouponFrequency) => f === 1 ? "jährlich" : f === 2 ? "halbjährlich" : "vierteljährlich";
/** Candidates are fixed before observing AI. No minimum-residual winner. */
export function calculateBondModel(price: ReturnType<typeof resolveBondPrice>, valuation: string, maturity: string, coupon: number) {
  const candidates = ([1, 2, 4] as const).map((frequency) => {
    const diagnostic = couponAccruedDiagnostic(valuation, maturity, coupon, frequency, price.accruedPer100, price.accruedQuantizationPer100);
    const flows = diagnostic.calendar?.cashflows.filter((cf) => cf.amount > 0) || [];
    const solved = price.dirty.value !== null ? solveBondYield(price.dirty.value, flows) : null;
    const duration = solved && datedBondDuration(price.dirty.value!, flows, solved.value);
    return { frequency, ...diagnostic, ytm: solved && duration ? solved.value : null, residual: solved?.residual ?? null,
      macaulay: duration?.macaulay ?? null, modified: duration?.modified ?? null };
  });
  const matches = candidates.filter((c) => c.compatible);
  const testable = candidates.every((c) => c.testable);
  const frequencyIndependent = coupon === 0 && (!testable || matches.length === 3);
  const modelStatus = frequencyIndependent ? "frequency-independent" : !testable ? "assumed-annual" : matches.length === 1 ? "identified" : matches.length > 1 ? "ambiguous" : "inconsistent";
  const selected = modelStatus === "identified" ? matches[0] : modelStatus === "assumed-annual" || frequencyIndependent ? candidates[0] : matches.find((c) => c.frequency === 1);
  let ytm = price.dirty.value === null ? price.dirty : modelStatus === "inconsistent" ? fail("model-inconsistent", "coupon-model-contradiction") :
    !selected ? fail("model-inconsistent", "coupon-model-ambiguous") : selected.ytm === null ? fail("invalid-data", "no-stable-solution") : ok(selected.ytm);
  if (price.accruedPer100 !== null && price.accruedPer100 < 0) ytm = fail("model-inconsistent", "ex-coupon-unclear");
  const macaulay = ytm.value !== null && selected?.macaulay !== null && selected?.macaulay !== undefined ? ok(selected.macaulay) : ytm;
  const modified = ytm.value !== null && selected?.modified !== null && selected?.modified !== undefined ? ok(selected.modified) : ytm;
  const dv01 = modified.value !== null && price.localDirtyValue !== null && price.currency ? ok(price.localDirtyValue * modified.value * .0001) : modified.value === null ? modified : fail("missing-data", "missing-dirty-position-value");
  const modelLabel = modelStatus === "identified" ? `${frequencyLabel(selected!.frequency)} rechnerisch abgeleitet, nicht vertraglich bestätigt` : modelStatus === "ambiguous" ?
    `Mehrdeutig: ${matches.map((c) => frequencyLabel(c.frequency)).join(", ")}.${selected ? " Angezeigte Rendite: Jahresmodellannahme." : " Keine eindeutige Modellrendite."} Nicht in Rendite-/Duration-/DV01-Aggregaten.` :
    modelStatus === "assumed-annual" ? "Jahresmodellannahme, Kuponmodell nicht prüfbar (Stückzins fehlt oder Einheiten unklar)" : modelStatus === "frequency-independent" ? "Expliziter Nullkupon, Zahlungsplan frequenzunabhängig" : "Kein passendes Kuponmodell";
  return { ytm, macaulay, modified, dv01, candidates, modelStatus, modelLabel,
    selectedFrequency: modelStatus === "identified" ? selected!.frequency : null,
    aggregateEligible: ytm.value !== null && modelStatus !== "ambiguous",
    annualCheck: annualAccruedCheck(valuation, maturity, coupon, price.accruedPer100, price.accruedQuantizationPer100), residual: selected?.residual ?? null };
}

/** Code-supplied, documented convention; never accepted from saved customer data or UI.
 * CP3 fixtures supply their explicit synthetic contract here. Production uses the versioned importer profile. */
export type BondSourceConvention = {
  evidence: string;
  units: BondUnits;
  accruedQuantizationPer100: number | null;
};

export function analyzeBondV2(position: DepotAnalysisPosition, fallbackDate = new Date(), convention?: BondSourceConvention) {
  const source = validBondSource(position.bondSource, position);
  const warnings = [BOND_MODEL_NOTICE];
  const sourceEvidence = convention?.evidence || (source?.profileVersion === 2 ? BOND_PROFILE_NOTICE : LEGACY_BOND_PROFILE_NOTICE);
  if (source) warnings.push(sourceEvidence);
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
  const units = source && (convention?.units || source.units);
  // Only the confirmed v2 signature provides EUR without a synthetic test contract.
  const price = resolveBondPrice({ nominal: field("nominalOrUnits"), clean, accrued: field("accruedInterest"), market: field("value"), fxRate: field("fxRate"),
    bondCurrency: sourceFieldValid(source, "currency") ? position.currency?.trim().toUpperCase() : undefined,
    valuationDate: sourceFieldValid(source, "valuationEnd") ? valuation : undefined,
    units: units || { clean: "unknown", nominal: "unknown", accrued: "unknown", accruedCurrency: "unknown", market: "unknown", reportingCurrency: null, fx: "unknown" },
    quality: source && convention ? "documented" : source?.quality || "unknown", accruedQuantizationPer100: convention?.accruedQuantizationPer100 ?? source?.accruedQuantizationPer100 ?? null });
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
  else if (source?.fields.accruedInterest.status === "invalid") ytm = fail("invalid-data", "invalid-accrued");
  else ytm = price.dirty;
  let macaulay: BondMetric = ytm, modified: BondMetric = ytm;
  let annualCheck: ReturnType<typeof annualAccruedCheck> = "not-testable";
  let residual: number | null = null;
  let model: ReturnType<typeof calculateBondModel> | null = null;
  if (ytm.value !== null && valuation && maturity && coupon !== undefined) {
    model = calculateBondModel(price, valuation, maturity, coupon);
    ({ ytm, macaulay, modified, annualCheck, residual } = model);
    warnings.push(model.modelLabel);
    warnings.push(price.accruedQuantizationPer100 === null ? "Stückzinsprüfung: vorläufiges diagnostisches Grundband 0,05 pro 100, Herstellerpräzision unbekannt" : "Stückzinsprüfung: Band max(0,05, zweifache nachgewiesene Quantisierung)");
  }
  if (ytm.value === null) { macaulay = ytm; modified = ytm; }
  if (annualCheck === "not-testable") warnings.push("Kuponmodell nicht prüfbar");
  if (remainingYears.value !== null && remainingYears.value > 0 && remainingYears.value <= 31 / 365) warnings.push("rundungssensitiv: Kurzläufer, stark vom Preis und angenommenen Kuponmodell abhängig");
  const dv01 = source?.fields.value.status === "invalid" ? fail("invalid-data", "position-amount-changed") : modified.value !== null && price.localDirtyValue !== null && price.currency
    ? ok(price.localDirtyValue * modified.value * 0.0001) : modified.value === null ? modified : fail("missing-data", "missing-dirty-position-value");
  return { remainingYears, currentYield: running, ytm, macaulay, modified, dv01, dv01Currency: price.currency,
    model, aggregateEligible: model?.aggregateEligible === true, dirtyPrice: price.dirty, annualCheck, residual, warnings, valuationDate: valuation || null,
    excludeFromBondAggregates: position.excludeFromBondAggregates === true, sourceQuality: source?.quality || "unknown",
    reportingCurrency: units?.reportingCurrency || null,
    reportingValueCurrency: sourceFieldValid(source, "value") && (convention?.evidence || source?.profileVersion === 2) && /^[A-Z]{3}$/.test(units?.reportingCurrency || "") ? units!.reportingCurrency : null,
    reportingComparable: Boolean(sourceFieldValid(source, "value") && (convention?.evidence || source?.profileVersion === 2) && units?.reportingCurrency === "EUR"),
    sourceEvidence };
}
