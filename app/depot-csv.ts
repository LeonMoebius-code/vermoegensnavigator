import { DepotHolding } from "./case-model";
import { AssetClass, assetClasses, houseProducts } from "./investment-data";

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

function mapRegion(country: string) {
  const normalized = country.trim().toUpperCase();
  if (normalized === "D" || normalized === "DE") return "Deutschland";
  if (["USA", "US"].includes(normalized)) return "USA";
  if (["CH"].includes(normalized)) return "Schweiz";
  if (["JP", "CN", "HK", "SG"].includes(normalized)) return "Asien";
  if (normalized) return "Europa";
  return "Weltweit";
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
  const type = column(headers, "Wertpapiertyp", "Anlagemedium");
  const country = column(headers, "Land");
  const currency = column(headers, "Währung");
  const maturity = column(headers, "Endfälligkeit");
  const wkn = column(headers, "WKN");
  const parsed = rows.slice(1).map((row) => {
    const wknValue = valueAt(row, wkn).trim();
    const matched = houseProducts.find(
      (product) => product.wkn.toUpperCase() === wknValue.toUpperCase(),
    );
    const mapped = mapAssetClass(valueAt(row, segment), valueAt(row, type));
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
      region: matched?.region || mapRegion(valueAt(row, country)),
      risk: matched?.risk || 0,
      plannedSale: 0,
      note: classificationStatus === "unresolved" ? "Anlageklasse fachlich prüfen" : "",
      wkn: wknValue,
      currency: valueAt(row, currency),
      maturity: valueAt(row, maturity),
      sourceType: valueAt(row, type),
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
