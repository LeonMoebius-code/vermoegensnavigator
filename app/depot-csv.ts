import { calendarDate, strictNumber, numberInRange, optionalNumberRules, OptionalNumberField, ImportIssue } from "./depot-validation";
import { ParsedDepotHolding } from "./case-model";
import { AssetClass, assetClasses, houseProducts } from "./investment-data";
import { depotRegionForCountry } from "./depot-country-codes";
import { structureOverviewSource } from "./bond-source";

export type DepotCsvFormat = "navigator" | "structure-overview";

export type DepotCsvResult = {
  format: DepotCsvFormat;
  rows: ParsedDepotHolding[];
  unresolved: number;
  ignoredPersonalColumns: boolean;
  warnings: { row: number; field: string; code: string }[];
};

const uid = () =>
  `holding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Strict CSV number conversion. Invalid values are never converted to zero. */
export function parseGermanNumber(value: string): number {
  const result = strictNumber(value, "euro");
  if (result.value === undefined) throw new Error(`Ungültige Zahl (${result.code}).`);
  return result.value;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      if (quoted) { quoted = false; closedQuote = true; }
      else {
        if (cell.trim() || closedQuote) throw new Error("Ungültige Anführungszeichen in der CSV. Import abgebrochen.");
        quoted = true;
      }
    }
    else if (char === ";" && !quoted) {
      row.push(cell.trim());
      cell = "";
      closedQuote = false;
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      closedQuote = false;
    } else {
      if (closedQuote && !/\s/.test(char)) throw new Error("Ungültige Zeichen nach einem CSV-Textfeld. Import abgebrochen.");
      cell += char;
    }
  }
  if (quoted) throw new Error("Die CSV enthält ein nicht geschlossenes Anführungszeichen.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function headerScore(text: string) {
  return ["Bezeichnung", "Währung", "Stück", "Anlageklasse", "Notiz"].filter(
    (word) => text.includes(word),
  ).length;
}

function decode(buffer: ArrayBuffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  const win = new TextDecoder("windows-1252").decode(buffer);
  return headerScore(win) > headerScore(utf8) ? win : utf8;
}

function column(headers: string[], ...names: string[]) {
  return headers.findIndex((header) =>
    names.some((name) => header.trim().toLowerCase() === name.toLowerCase()),
  );
}

function valueAt(row: string[], index: number) {
  return index >= 0 ? row[index] || "" : "";
}

function requiredMarketValue(row: string[], index: number, rowNumber: number) {
  const result = strictNumber(valueAt(row, index), "euro");
  if (result.value === undefined || result.value < 0)
    throw new Error(`Zeile ${rowNumber}: Marktwert fehlt oder ist ungültig. Import abgebrochen, bisheriger Bestand unverändert.`);
  return result.value;
}

function optionalNumber(row: string[], index: number, field: OptionalNumberField, issues: ImportIssue[]) {
  const raw = valueAt(row, index).trim();
  if (!raw) return undefined;
  const rule: { min?: number; max?: number; positive?: boolean; unit?: "percent" } = optionalNumberRules[field];
  const result = strictNumber(raw, rule.unit);
  const code = result.value === undefined ? result.code : numberInRange(field, result.value) ? undefined : "out-of-range";
  if (code) { issues.push({ field, code }); return undefined; }
  return result.value;
}

function normalizedDate(raw: string, field: string, issues: ImportIssue[]) {
  if (!raw.trim()) return undefined;
  const value = calendarDate(raw);
  if (!value) issues.push({ field, code: "invalid-date" });
  return value;
}

function mapAssetClass(segment: string, type: string): AssetClass | null {
  const source = `${segment} ${type}`.toLowerCase();
  if (/liquid|tagesgeld|termingeld|kontoguthaben/.test(source))
    return "Liquidität";
  if (/aktien|equity/.test(source)) return "Substanzwerte";
  if (/renten|anleihe|floater|festverzins|geldmarkt|stufenzins/.test(source))
    return "Geldwerte";
  if (/immobil|real estate/.test(source)) return "Sachwerte";
  if (/rohstoff|edelmetall|gold|alternative/.test(source))
    return "Alternative Anlagen";
  return null;
}

export function parseDepotCsv(buffer: ArrayBuffer): DepotCsvResult {
  const rows = parseCsv(decode(buffer));
  if (rows.length < 2) throw new Error("Die CSV enthält keine Positionen.");
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, ""));
  const isStructure = column(headers, "Kurswert incl. Stückzinsen") >= 0;
  const isNavigator =
    column(headers, "Name") >= 0 && column(headers, "Wert") >= 0;
  if (!isStructure && !isNavigator)
    throw new Error(
      "Das Dateiformat wurde nicht erkannt. Erwartet wird die Navigator-Vorlage oder eine Strukturübersicht.",
    );

  const warnings: DepotCsvResult["warnings"] = [];
  if (isNavigator) {
    const name = column(headers, "Name");
    const amount = column(headers, "Wert");
    const asset = column(headers, "Anlageklasse");
    const region = column(headers, "Region");
    const risk = column(headers, "RK", "Risikoklasse");
    const note = column(headers, "Notiz");
    const parsed = rows.slice(1).map((row, index) => {
      const rawClass = valueAt(row, asset) as AssetClass;
      const recognized = assetClasses.includes(rawClass);
      const parsedRisk = strictNumber(valueAt(row, risk));
      const riskValue = parsedRisk.value;
      const validRisk = riskValue !== undefined && Number.isInteger(riskValue) && riskValue >= 0 && riskValue <= 5;
      if (valueAt(row, risk) && !validRisk) warnings.push({ row: index + 2, field: "risk", code: parsedRisk.code || "out-of-range" });
      return {
        id: uid(),
        name: valueAt(row, name),
        value: requiredMarketValue(row, amount, index + 2),
        assetClass: recognized ? rawClass : "Geldwerte",
        region: valueAt(row, region) || "Weltweit",
        risk: validRisk ? riskValue : 0,
        plannedSale: 0,
        note: valueAt(row, note),
        classificationStatus: recognized ? "mapped" : "unresolved",
      } satisfies ParsedDepotHolding;
    });
    if (!Number.isFinite(parsed.reduce((sum, row) => sum + row.value, 0))) throw new Error("Ungültiger Depotgesamtwert.");
    return {
      format: "navigator",
      rows: parsed,
      unresolved: parsed.filter((row) => row.classificationStatus === "unresolved").length,
      ignoredPersonalColumns: false,
      warnings,
    };
  }

  const name = column(headers, "Bezeichnung");
  const amount = column(headers, "Kurswert incl. Stückzinsen");
  const segment = column(headers, "Anlagesegment");
  const investmentMedium = column(headers, "Anlagemedium");
  const securityType = column(headers, "Wertpapiertyp");
  const country = column(headers, "Land");
  const currency = column(headers, "Währung");
  const industry = column(headers, "Branche");
  const certificateClass = column(headers, "Zertifikateklasse");
  const coupon = column(headers, "Zinssatz");
  const maturity = column(headers, "Endfälligkeit");
  const wkn = column(headers, "WKN");
  const nominalOrUnits = column(headers, "Stück/Nominal", "Stück / Nominal");
  const lastPurchaseDate = column(headers, "letztes Kaufdatum");
  const averageEntryPrice = column(headers, "Durchschnittl. Einstandskurs");
  const purchaseCosts = column(headers, "Kaufkosten");
  const currentPrice = column(headers, "Kurs");
  const gainLossPercent = column(headers, "Kursgewinn/-verlust seit Kauf in %");
  const gainLossAmount = column(headers, "Kursgewinn/-verlust seit Kauf");
  const sourceDepotShare = column(headers, "Depotanteil in %");
  const accruedInterest = column(headers, "Stückzinsen");
  const averageEntryFx = column(headers, "Durchschnittl. Einstandsdevisenkurs");
  const fxRate = column(headers, "Devisenkurs");
  const valuationStart = column(headers, "Bewertungsanfang");
  const valuationEnd = column(headers, "Bewertungsende");
  const holdingAtValuationStart = column(headers, "Bestand per (Bewertungsanfang)");
  const holdingAtValuationEnd = column(headers, "Bestand per (Bewertungsende)");
  const parsed = rows.slice(1).map((row, index) => {
    const issues: ImportIssue[] = [];
    const wknValue = valueAt(row, wkn).trim();
    const matched = wknValue
      ? houseProducts.find(
          (product) => product.wkn.toUpperCase() === wknValue.toUpperCase(),
        )
      : undefined;
    const segmentValue = valueAt(row, segment);
    const mediumValue = valueAt(row, investmentMedium);
    const securityTypeValue = valueAt(row, securityType);
    const mapped = mapAssetClass(
      segmentValue,
      `${mediumValue} ${securityTypeValue}`,
    );
    const matchedClass = matched?.assetMix
      ? (Object.entries(matched.assetMix).sort((a, b) => b[1] - a[1])[0]?.[0] as AssetClass)
      : null;
    const assetClass = mapped || matchedClass || "Geldwerte";
    const classificationStatus = mapped ? "mapped" : matchedClass ? "matched" : "unresolved";
    const parsedHolding = {
      id: uid(),
      productId: matched?.id,
      name: valueAt(row, name),
      value: requiredMarketValue(row, amount, index + 2),
      assetClass,
      region: matched?.region || depotRegionForCountry(valueAt(row, country)),
      risk: matched?.risk || 0,
      plannedSale: 0,
      note: classificationStatus === "unresolved" ? "Anlageklasse fachlich prüfen" : "",
      wkn: wknValue,
      segment: segmentValue,
      investmentMedium: mediumValue,
      securityType: securityTypeValue,
      rawCountry: valueAt(row, country).trim(),
      currency: valueAt(row, currency),
      industry: valueAt(row, industry),
      certificateClass: valueAt(row, certificateClass),
      coupon: optionalNumber(row, coupon, "coupon", issues),
      maturity: normalizedDate(valueAt(row, maturity), "maturity", issues),
      nominalOrUnits: optionalNumber(row, nominalOrUnits, "nominalOrUnits", issues),
      lastPurchaseDate: normalizedDate(valueAt(row, lastPurchaseDate), "lastPurchaseDate", issues),
      averageEntryPrice: optionalNumber(row, averageEntryPrice, "averageEntryPrice", issues),
      purchaseCosts: optionalNumber(row, purchaseCosts, "purchaseCosts", issues),
      currentPrice: optionalNumber(row, currentPrice, "currentPrice", issues),
      gainLossPercent: optionalNumber(row, gainLossPercent, "gainLossPercent", issues),
      gainLossAmount: optionalNumber(row, gainLossAmount, "gainLossAmount", issues),
      accruedInterest: optionalNumber(row, accruedInterest, "accruedInterest", issues),
      sourceDepotShare: optionalNumber(row, sourceDepotShare, "sourceDepotShare", issues),
      averageEntryFx: optionalNumber(row, averageEntryFx, "averageEntryFx", issues),
      fxRate: optionalNumber(row, fxRate, "fxRate", issues),
      valuationStart: normalizedDate(valueAt(row, valuationStart), "valuationStart", issues),
      valuationEnd: normalizedDate(valueAt(row, valuationEnd), "valuationEnd", issues),
      holdingAtValuationStart: optionalNumber(row, holdingAtValuationStart, "holdingAtValuationStart", issues),
      holdingAtValuationEnd: optionalNumber(row, holdingAtValuationEnd, "holdingAtValuationEnd", issues),
      classificationStatus,
      importIssues: issues.length ? issues : undefined,
    } satisfies ParsedDepotHolding;
    warnings.push(...issues.map((issue) => ({ row: index + 2, ...issue })));
    return { ...parsedHolding, bondSource: structureOverviewSource(parsedHolding), excludeFromBondAggregates: false };
  });
  if (!Number.isFinite(parsed.reduce((sum, row) => sum + row.value, 0))) throw new Error("Ungültiger Depotgesamtwert.");
  return {
    format: "structure-overview",
    warnings,
    rows: parsed,
    unresolved: parsed.filter((row) => row.classificationStatus === "unresolved").length,
    ignoredPersonalColumns:
      column(headers, "Depot-Nr.") >= 0 || column(headers, "Depotinhaber") >= 0,
  };
}
