import { DepotHolding } from "./case-model";
import { AssetClass, assetClasses, houseProducts } from "./investment-data";
import { depotRegionForCountry } from "./depot-country-codes";

export type DepotCsvFormat = "navigator" | "structure-overview";

export type DepotCsvResult = {
  format: DepotCsvFormat;
  rows: DepotHolding[];
  unresolved: number;
  ignoredPersonalColumns: boolean;
};

const uid = () =>
  `holding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function parseGermanNumber(value: string): number {
  const cleaned = String(value || "")
    .trim()
    .replace(/\s/g, "")
    .replace(/€/g, "");
  if (!cleaned) return 0;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const number = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ";" && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
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

function optionalNumber(row: string[], index: number) {
  const raw = valueAt(row, index).trim();
  return raw ? parseGermanNumber(raw) : undefined;
}

function normalizedDate(value: string) {
  const raw = value.trim();
  const match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return match
    ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
    : raw || undefined;
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

  if (isNavigator) {
    const name = column(headers, "Name");
    const amount = column(headers, "Wert");
    const asset = column(headers, "Anlageklasse");
    const region = column(headers, "Region");
    const risk = column(headers, "RK", "Risikoklasse");
    const note = column(headers, "Notiz");
    const parsed = rows.slice(1).map((row) => {
      const rawClass = valueAt(row, asset) as AssetClass;
      const recognized = assetClasses.includes(rawClass);
      return {
        id: uid(),
        name: valueAt(row, name),
        value: parseGermanNumber(valueAt(row, amount)),
        assetClass: recognized ? rawClass : "Geldwerte",
        region: valueAt(row, region) || "Weltweit",
        risk: parseGermanNumber(valueAt(row, risk)),
        plannedSale: 0,
        note: valueAt(row, note),
        classificationStatus: recognized ? "mapped" : "unresolved",
      } satisfies DepotHolding;
    }).filter((row) => row.name || row.value > 0);
    return {
      format: "navigator",
      rows: parsed,
      unresolved: parsed.filter((row) => row.classificationStatus === "unresolved").length,
      ignoredPersonalColumns: false,
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
  const parsed = rows.slice(1).map((row) => {
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
    return {
      id: uid(),
      productId: matched?.id,
      name: valueAt(row, name),
      value: parseGermanNumber(valueAt(row, amount)),
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
      coupon: optionalNumber(row, coupon),
      maturity: normalizedDate(valueAt(row, maturity)),
      nominalOrUnits: optionalNumber(row, nominalOrUnits),
      lastPurchaseDate: normalizedDate(valueAt(row, lastPurchaseDate)),
      averageEntryPrice: optionalNumber(row, averageEntryPrice),
      purchaseCosts: optionalNumber(row, purchaseCosts),
      currentPrice: optionalNumber(row, currentPrice),
      gainLossPercent: optionalNumber(row, gainLossPercent),
      gainLossAmount: optionalNumber(row, gainLossAmount),
      accruedInterest: optionalNumber(row, accruedInterest),
      sourceDepotShare: optionalNumber(row, sourceDepotShare),
      averageEntryFx: optionalNumber(row, averageEntryFx),
      fxRate: optionalNumber(row, fxRate),
      valuationStart: normalizedDate(valueAt(row, valuationStart)),
      valuationEnd: normalizedDate(valueAt(row, valuationEnd)),
      holdingAtValuationStart: optionalNumber(row, holdingAtValuationStart),
      holdingAtValuationEnd: optionalNumber(row, holdingAtValuationEnd),
      classificationStatus,
    } satisfies DepotHolding;
  }).filter((row) => row.name || row.value > 0);
  return {
    format: "structure-overview",
    rows: parsed,
    unresolved: parsed.filter((row) => row.classificationStatus === "unresolved").length,
    ignoredPersonalColumns:
      column(headers, "Depot-Nr.") >= 0 || column(headers, "Depotinhaber") >= 0,
  };
}
