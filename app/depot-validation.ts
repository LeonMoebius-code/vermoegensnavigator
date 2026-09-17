/** CSV and optional persisted holding fields. No raw cell content is retained. */
export type ValidationCode = "missing" | "invalid-number" | "ambiguous-number" | "out-of-range" | "invalid-date";
export type ImportIssue = { field: string; code: ValidationCode };

export function importIssueLabel(issue: { field: string; code: string }) {
  const fields: Record<string, string> = {
    coupon: "Kupon", nominalOrUnits: "Stück/Nominal", currentPrice: "Kurs",
    averageEntryPrice: "Einstandskurs", purchaseCosts: "Kaufkosten",
    gainLossPercent: "Kursgewinn/-verlust in %", gainLossAmount: "Kursgewinn/-verlust",
    accruedInterest: "Stückzinsen", sourceDepotShare: "Depotanteil", fxRate: "Devisenkurs",
    averageEntryFx: "Einstandsdevisenkurs", holdingAtValuationStart: "Anfangsbestand",
    holdingAtValuationEnd: "Endbestand", maturity: "Endfälligkeit", lastPurchaseDate: "Kaufdatum",
    valuationStart: "Bewertungsanfang", valuationEnd: "Bewertungsende", risk: "Risikoklasse",
  };
  const reasons: Record<string, string> = {
    missing: "fehlt", "invalid-number": "ungültige Zahl", "ambiguous-number": "mehrdeutige Zahlenschreibweise",
    "out-of-range": "Wert außerhalb des zulässigen Bereichs", "invalid-date": "ungültiges Kalenderdatum",
  };
  return `${fields[issue.field] || "Optionales Feld"}: ${reasons[issue.code] || "ungültiger Wert"}`;
}

export function strictNumber(raw: string, unit?: "euro" | "percent"):
  { value: number; code?: never } | { value?: never; code: ValidationCode } {
  let text = raw.trim();
  if (!text) return { code: "missing" };
  if (unit === "euro") text = text.replace(/\s*€$/, "").trim();
  if (unit === "percent") text = text.replace(/\s*%$/, "").trim();
  // A single dot with three trailing digits is ambiguous without a decimal comma.
  if (/^[+-]?\d{1,3}\.\d{3}$/.test(text)) return { code: "ambiguous-number" };
  let normalized: string;
  if (/^[+-]?\d+(?:,\d+)?$/.test(text)) normalized = text.replace(",", ".");
  else if (/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(text) || /^[+-]?\d{1,3}(?:\.\d{3}){2,}$/.test(text))
    normalized = text.replace(/\./g, "").replace(",", ".");
  else if (/^[+-]?\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:,\d+)?$/.test(text))
    normalized = text.replace(/[ \u00a0\u202f]/g, "").replace(",", ".");
  else if (/^[+-]?\d+\.\d+$/.test(text)) normalized = text;
  else return { code: "invalid-number" };
  const value = Number(normalized);
  return Number.isFinite(value) ? { value } : { code: "invalid-number" };
}

export function calendarDate(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!de && !iso) return undefined;
  const [year, month, day] = de ? [+de[3], +de[2], +de[1]] : [+iso![1], +iso![2], +iso![3]];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return undefined;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const optionalNumberRules = {
  coupon: { min: 0, unit: "percent" },
  nominalOrUnits: { min: 0 }, averageEntryPrice: { min: 0 }, purchaseCosts: { min: 0 },
  currentPrice: { min: 0 }, gainLossPercent: { unit: "percent" }, gainLossAmount: {},
  accruedInterest: { min: 0 }, sourceDepotShare: { min: 0, max: 100, unit: "percent" },
  averageEntryFx: { positive: true }, fxRate: { positive: true },
  holdingAtValuationStart: { min: 0 }, holdingAtValuationEnd: { min: 0 },
} satisfies Record<string, { min?: number; max?: number; positive?: boolean; unit?: "percent" }>;
export type OptionalNumberField = keyof typeof optionalNumberRules;
export const optionalDateFields = ["maturity", "lastPurchaseDate", "valuationStart", "valuationEnd"] as const;
export const optionalTextFields = ["wkn", "productId", "segment", "investmentMedium", "securityType", "sourceType", "rawCountry", "currency", "industry", "certificateClass"] as const;

export function numberInRange(field: OptionalNumberField, value: number) {
  const rule: { min?: number; max?: number; positive?: boolean; unit?: "percent" } = optionalNumberRules[field];
  return Number.isFinite(value) && (rule.min === undefined || value >= rule.min) &&
    (rule.max === undefined || value <= rule.max) && (!rule.positive || value > 0);
}

export function sanitizeOptionalHolding<T extends object>(holding: T): T {
  const result = { ...holding } as Record<string, unknown>;
  const issues: ImportIssue[] = Array.isArray(result.importIssues)
    ? result.importIssues.filter((issue): issue is ImportIssue => Boolean(issue &&
      [...Object.keys(optionalNumberRules), ...optionalDateFields].includes(issue.field) &&
      ["missing", "invalid-number", "ambiguous-number", "out-of-range", "invalid-date"].includes(issue.code)))
      .map(({ field, code }) => ({ field, code })) : [];
  for (const field of Object.keys(optionalNumberRules) as OptionalNumberField[]) {
    const value = result[field];
    if (value === undefined || value === null) { delete result[field]; continue; }
    if (typeof value !== "number" || !numberInRange(field, value)) {
      delete result[field];
      issues.push({ field, code: "invalid-number" });
    }
  }
  for (const field of optionalDateFields) {
    if (result[field] === undefined || result[field] === null || result[field] === "") { delete result[field]; continue; }
    const value = calendarDate(result[field]);
    if (!value) issues.push({ field, code: "invalid-date" });
    result[field] = value;
  }
  for (const field of optionalTextFields) if (result[field] !== undefined && typeof result[field] !== "string") delete result[field];
  if (issues.length) result.importIssues = issues;
  else delete result.importIssues;
  return result as T;
}
