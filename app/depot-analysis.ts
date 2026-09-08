import { DepotHolding, StructurePlan } from "./case-model";
import { depotCountryName } from "./depot-country-codes";
import { houseProducts, managedPortfolios } from "./investment-data";

export type AnalysisState = "ist" | "plan";
export type ProductMainCategory =
  | "Renten"
  | "Aktien"
  | "Mischfonds / Multi-Asset"
  | "Strukturierte Produkte"
  | "Immobilien / Sachwerte"
  | "Alternative Anlagen"
  | "Liquidität"
  | "Nicht zugeordnet";

export type ProductClassification = {
  main: ProductMainCategory;
  sub: string;
  direct: boolean;
  bondKind?: "fixed" | "floater" | "step-up" | "other";
  confidence: "source" | "derived" | "unknown";
};

export type DepotAnalysisPosition = Omit<DepotHolding, "id" | "value"> & {
  id: string;
  source: "holding" | "planned-purchase";
  value: number;
  classification: ProductClassification;
};

export type DistributionItem = { label: string; value: number; share: number };

const unknownClassification = (): ProductClassification => ({
  main: "Nicht zugeordnet",
  sub: "Nicht zugeordnet",
  direct: false,
  confidence: "unknown",
});

const normalized = (value?: string) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ");

const includesAny = (text: string, terms: string[]) =>
  terms.some((term) => text.includes(term));

function classifyText(text: string, confidence: "source" | "derived"):
  ProductClassification | null {
  if (text === "geldmarkt")
    return { main: "Renten", sub: "Geldmarktfonds", direct: false, confidence };
  const isFund = includesAny(text, ["fonds", "fund", "etf", "sicav"]);
  if (isFund && includesAny(text, ["geldmarkt", "money market"]))
    return { main: "Renten", sub: "Geldmarktfonds", direct: false, confidence };
  if (isFund && includesAny(text, ["renten", "anleihe", "bond", "credit"]))
    return { main: "Renten", sub: "Rentenfonds", direct: false, confidence };
  if (isFund && text.includes("festverzins"))
    return { main: "Renten", sub: "Rentenfonds", direct: false, confidence };
  if (isFund && includesAny(text, ["aktien", "equity", "share"]))
    return { main: "Aktien", sub: "Aktienfonds / Aktien-ETF", direct: false, confidence };
  if (includesAny(text, ["mischfonds", "multi-asset", "multi asset", "balanced fund"]))
    return { main: "Mischfonds / Multi-Asset", sub: "Mischfonds / Multi-Asset", direct: false, confidence };
  if (includesAny(text, ["vermögensverwaltung", "vermoegensverwaltung"]))
    return { main: "Mischfonds / Multi-Asset", sub: "Vermögensverwaltung", direct: false, confidence };
  if (isFund && includesAny(text, ["immobil", "real estate"]))
    return { main: "Immobilien / Sachwerte", sub: "Immobilienfonds", direct: false, confidence };
  if (includesAny(text, ["zertifikat", "certificate", "strukturiert"]))
    return { main: "Strukturierte Produkte", sub: "Zertifikate / strukturierte Produkte", direct: false, confidence };
  if (includesAny(text, ["rohstoff", "edelmetall", "commodity", "gold", "silber"]))
    return { main: "Alternative Anlagen", sub: "Rohstoffe / Edelmetalle", direct: true, confidence };
  if (includesAny(text, ["alternative anlage", "alternative investment"]))
    return { main: "Alternative Anlagen", sub: "Sonstige Alternative Anlagen", direct: false, confidence };
  if (includesAny(text, ["tagesgeld", "termingeld", "kontoguthaben", "sparkonto", "girokonto"]))
    return { main: "Liquidität", sub: "Kontoguthaben / Tagesgeld / Termingeld", direct: true, confidence };
  if (includesAny(text, ["floater", "floating", "variabel", "variabel verzinslich", "variabelverzinslich"]))
    return { main: "Renten", sub: "Floater", direct: true, bondKind: "floater", confidence };
  if (includesAny(text, ["stufenzins", "step-up", "step up"]))
    return { main: "Renten", sub: "Stufenzinsanleihen", direct: true, bondKind: "step-up", confidence };
  if (!isFund && text.includes("festverzins"))
    return { main: "Renten", sub: "Festverzinsliche Anleihen", direct: true, bondKind: "fixed", confidence };
  if (!isFund && includesAny(text, ["schuldverschreibung", "anleihe", "bond", "rentenwert", "obligation"]))
    return { main: "Renten", sub: "Festverzinsliche Anleihen", direct: true, bondKind: "fixed", confidence };
  if (!isFund && includesAny(text, ["aktie", "equity", "share"]))
    return { main: "Aktien", sub: "Einzelaktien", direct: true, confidence };
  if (includesAny(text, ["immobil", "real estate"]))
    return { main: "Immobilien / Sachwerte", sub: "Sonstige Sachwertprodukte", direct: !isFund, confidence };
  return null;
}

export function classifyDepotProduct(
  source: Partial<DepotHolding> & { productId?: string },
): ProductClassification {
  for (const value of [source.securityType, source.investmentMedium, source.segment]) {
    const result = classifyText(normalized(value), "source");
    if (result) return result;
  }
  const product = source.productId
    ? houseProducts.find((entry) => entry.id === source.productId)
    : undefined;
  if (product) {
    const result = classifyText(normalized(product.category), "derived");
    if (result) return result;
  }
  if (source.productId && managedPortfolios.some((entry) => entry.id === source.productId))
    return { main: "Mischfonds / Multi-Asset", sub: "Vermögensverwaltung", direct: false, confidence: "derived" };
  const fallback = normalized(source.assetClass);
  if (fallback === "liquidität")
    return { main: "Liquidität", sub: "Sonstige Liquidität", direct: false, confidence: "derived" };
  if (fallback === "alternative anlagen")
    return { main: "Alternative Anlagen", sub: "Sonstige Alternative Anlagen", direct: false, confidence: "derived" };
  if (fallback === "sachwerte")
    return { main: "Immobilien / Sachwerte", sub: "Sonstige Sachwertprodukte", direct: false, confidence: "derived" };
  return unknownClassification();
}

export function buildDepotAnalysisPositions(
  depot: DepotHolding[],
  plan: StructurePlan,
  state: AnalysisState,
): DepotAnalysisPosition[] {
  const holdings = depot
    .map((holding) => ({
      ...holding,
      id: holding.id,
      source: "holding" as const,
      value: state === "ist" ? Math.max(0, holding.value) : Math.max(0, holding.value - holding.plannedSale),
      classification: classifyDepotProduct(holding),
    }))
    .filter((position) => position.value > 0);
  if (state === "ist") return holdings;
  const purchases = plan.allocations
    .filter((allocation) => allocation.amount > 0)
    .map((allocation): DepotAnalysisPosition => {
      const product = houseProducts.find((entry) => entry.id === allocation.productId);
      const managed = managedPortfolios.find((entry) => entry.id === allocation.productId);
      const source = {
        productId: allocation.productId,
        assetClass: undefined,
        securityType: product?.category || (managed ? "Vermögensverwaltung" : undefined),
      };
      return {
        id: `purchase-${allocation.id}`,
        source: "planned-purchase",
        productId: allocation.productId,
        name: allocation.productName,
        value: allocation.amount,
        assetClass: "Geldwerte",
        region: product?.region || managed?.region || "Nicht zugeordnet",
        risk: product?.risk || managed?.risk || 1,
        plannedSale: 0,
        note: "",
        wkn: product?.wkn,
        securityType: source.securityType,
        classification: classifyDepotProduct(source),
      };
    });
  return [...holdings, ...purchases];
}

export function analysisCoverage(coveredValue: number, relevantValue: number) {
  return relevantValue > 0 ? Math.max(0, Math.min(1, coveredValue / relevantValue)) : 0;
}

export function distribution(
  positions: DepotAnalysisPosition[],
  labelFor: (position: DepotAnalysisPosition) => string,
): DistributionItem[] {
  const total = positions.reduce((sum, position) => sum + position.value, 0);
  const values = new Map<string, number>();
  for (const position of positions) {
    const label = labelFor(position) || "Nicht zugeordnet";
    values.set(label, (values.get(label) || 0) + position.value);
  }
  return [...values.entries()]
    .map(([label, value]) => ({ label, value, share: total ? value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

export function concentrationMetrics(positions: DepotAnalysisPosition[]) {
  const sorted = [...positions].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, position) => sum + position.value, 0);
  const share = (count: number) => total
    ? sorted.slice(0, count).reduce((sum, position) => sum + position.value, 0) / total
    : 0;
  return { total, count: sorted.length, largest: sorted[0], top3: share(3), top5: share(5), positions: sorted };
}

export function productTypeAnalysis(positions: DepotAnalysisPosition[]) {
  const total = positions.reduce((sum, position) => sum + position.value, 0);
  const covered = positions.filter((position) => position.classification.main !== "Nicht zugeordnet")
    .reduce((sum, position) => sum + position.value, 0);
  const main = distribution(positions, (position) => position.classification.main);
  const sub = new Map<ProductMainCategory, DistributionItem[]>();
  for (const item of main) {
    const scoped = positions.filter((position) => position.classification.main === item.label);
    sub.set(item.label as ProductMainCategory, distribution(scoped, (position) => position.classification.sub));
  }
  return { total, coverage: analysisCoverage(covered, total), main, sub };
}

export function industryAnalysis(positions: DepotAnalysisPosition[], view: "equities" | "total") {
  const equities = positions.filter((position) => position.classification.main === "Aktien" && position.classification.direct);
  const relevant = view === "equities" ? equities : positions;
  const knownEquityValue = equities.filter((position) => normalized(position.industry)).reduce((sum, position) => sum + position.value, 0);
  return {
    distribution: distribution(relevant, (position) => {
      if (position.classification.main === "Aktien" && position.classification.direct)
        return normalized(position.industry) ? String(position.industry).trim() : "Nicht zugeordnet";
      return "Nicht branchenbezogen / ohne Lookthrough";
    }),
    equityValue: equities.reduce((sum, position) => sum + position.value, 0),
    coverage: analysisCoverage(knownEquityValue, equities.reduce((sum, position) => sum + position.value, 0)),
  };
}

export function countryAnalysis(positions: DepotAnalysisPosition[], view: "direct" | "total") {
  const relevant = view === "direct"
    ? positions.filter((position) => position.classification.direct && ["Aktien", "Renten"].includes(position.classification.main))
    : positions;
  const covered = relevant.filter((position) => depotCountryName(position.rawCountry) !== "Nicht zugeordnet")
    .reduce((sum, position) => sum + position.value, 0);
  const total = relevant.reduce((sum, position) => sum + position.value, 0);
  return { distribution: distribution(relevant, (position) => depotCountryName(position.rawCountry)), coverage: analysisCoverage(covered, total), total };
}

export function currencyAnalysis(positions: DepotAnalysisPosition[]) {
  const total = positions.reduce((sum, position) => sum + position.value, 0);
  const covered = positions.filter((position) => normalized(position.currency)).reduce((sum, position) => sum + position.value, 0);
  return {
    distribution: distribution(positions, (position) => normalized(position.currency) ? String(position.currency).trim().toUpperCase() : "Nicht zugeordnet"),
    coverage: analysisCoverage(covered, total),
    total,
  };
}

const localDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) || date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3]) ? null : date;
};

export function valuationDateFor(positions: DepotAnalysisPosition[], fallback = new Date()) {
  const counts = new Map<string, number>();
  for (const position of positions) if (position.valuationEnd && localDate(position.valuationEnd))
    counts.set(position.valuationEnd, (counts.get(position.valuationEnd) || 0) + 1);
  const selected = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0];
  return selected ? localDate(selected)! : new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12);
}

export function remainingMaturityYears(valuationDate: Date, maturity?: string): number | null {
  const end = maturity ? localDate(maturity) : null;
  if (!end) return null;
  return Math.max(0, (end.getTime() - valuationDate.getTime()) / 86400000 / 365.25);
}

const plausiblePrice = (price?: number) => Number.isFinite(price) && Number(price) > 0 && Number(price) <= 500;
const plausibleCoupon = (coupon?: number) => Number.isFinite(coupon) && Number(coupon) >= 0 && Number(coupon) <= 100;

export function currentYield(coupon?: number, currentPrice?: number): number | null {
  return plausibleCoupon(coupon) && plausiblePrice(currentPrice) ? Number(coupon) / Number(currentPrice) : null;
}

export type ModeledCashflow = { time: number; amount: number };
export function modeledBondCashflows(coupon: number, remainingYears: number): ModeledCashflow[] {
  if (!plausibleCoupon(coupon) || remainingYears <= 0) return [];
  const count = Math.max(1, Math.ceil(remainingYears));
  const first = remainingYears - (count - 1);
  return Array.from({ length: count }, (_, index) => ({
    time: first + index,
    amount: coupon + (index === count - 1 ? 100 : 0),
  }));
}

const modeledPrice = (cashflows: ModeledCashflow[], yieldRate: number) =>
  cashflows.reduce((sum, cashflow) => sum + cashflow.amount / Math.pow(1 + yieldRate, cashflow.time), 0);

export function solveModeledYtm(currentPrice: number, coupon: number, remainingYears: number): number | null {
  if (!plausiblePrice(currentPrice)) return null;
  const cashflows = modeledBondCashflows(coupon, remainingYears);
  if (!cashflows.length) return null;
  let low = -0.95;
  let high = 10;
  if (modeledPrice(cashflows, low) < currentPrice || modeledPrice(cashflows, high) > currentPrice) return null;
  for (let index = 0; index < 160; index += 1) {
    const mid = (low + high) / 2;
    if (modeledPrice(cashflows, mid) > currentPrice) low = mid;
    else high = mid;
  }
  const result = (low + high) / 2;
  return Number.isFinite(result) ? result : null;
}

export function bondDurationMetrics(currentPrice: number, coupon: number, remainingYears: number, ytm?: number | null) {
  const yieldRate = ytm ?? solveModeledYtm(currentPrice, coupon, remainingYears);
  if (yieldRate === null || yieldRate <= -1) return null;
  const cashflows = modeledBondCashflows(coupon, remainingYears);
  const price = modeledPrice(cashflows, yieldRate);
  if (!price) return null;
  const macaulay = cashflows.reduce((sum, cashflow) =>
    sum + cashflow.time * cashflow.amount / Math.pow(1 + yieldRate, cashflow.time), 0) / price;
  return { macaulay, modified: macaulay / (1 + yieldRate), ytm: yieldRate };
}

export const bondDv01 = (marketValue: number, modifiedDuration: number) =>
  Math.max(0, marketValue) * Math.max(0, modifiedDuration) * 0.0001;

export const interestScenarioEffect = (marketValue: number, modifiedDuration: number, deltaYield: number) =>
  -Math.max(0, marketValue) * Math.max(0, modifiedDuration) * deltaYield;

export type BondPositionAnalysis = {
  position: DepotAnalysisPosition;
  remainingYears: number | null;
  currentYield: number | null;
  ytm: number | null;
  macaulay: number | null;
  modified: number | null;
  dv01: number | null;
  exclusionReason?: string;
};

export function bondPortfolioAnalysis(positions: DepotAnalysisPosition[], fallbackDate = new Date()) {
  const valuationDate = valuationDateFor(positions, fallbackDate);
  const renten = positions.filter((position) => position.classification.main === "Renten");
  const direct = renten.filter((position) => position.classification.direct);
  const rows: BondPositionAnalysis[] = renten.map((position) => {
    const remaining = remainingMaturityYears(valuationDate, position.maturity);
    const running = position.classification.direct ? currentYield(position.coupon, position.currentPrice) : null;
    let reason: string | undefined;
    if (!position.classification.direct) reason = "Keine Einzeltitel-Cashflows";
    else if (position.classification.bondKind === "floater") reason = "Variable Verzinsung";
    else if (position.classification.bondKind === "step-up") reason = "Zukünftige Couponstaffel fehlt";
    else if (position.classification.bondKind !== "fixed") reason = "Tilgungsstruktur nicht eindeutig";
    else if (remaining === null) reason = "Fälligkeit fehlt oder ist ungültig";
    else if (remaining <= 0) reason = "Fällig / Daten prüfen";
    else if (!plausibleCoupon(position.coupon)) reason = "Coupon fehlt oder ist unplausibel";
    else if (!plausiblePrice(position.currentPrice)) reason = "Aktueller Kurs fehlt oder ist unplausibel";
    const ytm = reason ? null : solveModeledYtm(Number(position.currentPrice), Number(position.coupon), remaining!);
    if (!reason && ytm === null) reason = "Keine stabile Modelllösung";
    const duration = ytm === null ? null : bondDurationMetrics(Number(position.currentPrice), Number(position.coupon), remaining!, ytm);
    return {
      position,
      remainingYears: remaining,
      currentYield: running,
      ytm,
      macaulay: duration?.macaulay ?? null,
      modified: duration?.modified ?? null,
      dv01: duration ? bondDv01(position.value, duration.modified) : null,
      exclusionReason: reason,
    };
  });
  const directValue = direct.reduce((sum, position) => sum + position.value, 0);
  const maturityValue = rows.filter((row) => row.position.classification.direct && row.remainingYears !== null && row.remainingYears > 0)
    .reduce((sum, row) => sum + row.position.value, 0);
  const calculable = rows.filter((row) => row.modified !== null);
  const calculableValue = calculable.reduce((sum, row) => sum + row.position.value, 0);
  const portfolioModified = calculableValue
    ? calculable.reduce((sum, row) => sum + row.position.value * Number(row.modified), 0) / calculableValue
    : null;
  const ladderMap = new Map<number, { year: number; nominal: number; marketValue: number; count: number }>();
  for (const row of rows) {
    const date = row.position.maturity ? localDate(row.position.maturity) : null;
    if (!row.position.classification.direct || !date || row.remainingYears === null || row.remainingYears <= 0 || !Number.isFinite(row.position.nominalOrUnits) || Number(row.position.nominalOrUnits) < 0) continue;
    const year = date.getFullYear();
    const item = ladderMap.get(year) || { year, nominal: 0, marketValue: 0, count: 0 };
    item.nominal += Number(row.position.nominalOrUnits);
    item.marketValue += row.position.value;
    item.count += 1;
    ladderMap.set(year, item);
  }
  return {
    valuationDate,
    rows,
    directValue,
    totalRentenValue: renten.reduce((sum, position) => sum + position.value, 0),
    maturityCoverage: analysisCoverage(maturityValue, directValue),
    calculableCoverage: analysisCoverage(calculableValue, directValue),
    calculableValue,
    portfolioModified,
    portfolioDv01: calculable.reduce((sum, row) => sum + Number(row.dv01), 0),
    ladder: [...ladderMap.values()].sort((a, b) => a.year - b.year),
    scenarios: [-0.01, -0.005, 0.005, 0.01].map((deltaYield) => ({
      deltaYield,
      effect: calculable.reduce((sum, row) => sum + interestScenarioEffect(row.position.value, Number(row.modified), deltaYield), 0),
    })),
  };
}

export function entryResultAnalysis(depot: DepotHolding[]) {
  const total = depot.reduce((sum, position) => sum + Math.max(0, position.value), 0);
  const rows = depot.filter((position) => Number.isFinite(position.gainLossAmount) || Number.isFinite(position.gainLossPercent));
  const coveredValue = rows.reduce((sum, position) => sum + Math.max(0, position.value), 0);
  const withPercent = rows.filter((position) => Number.isFinite(position.gainLossPercent));
  const sortedPercent = [...withPercent].sort((a, b) => Number(b.gainLossPercent) - Number(a.gainLossPercent));
  return {
    rows,
    total,
    coveredValue,
    coverage: analysisCoverage(coveredValue, total),
    gainLossAmount: rows.reduce((sum, position) => sum + (Number.isFinite(position.gainLossAmount) ? Number(position.gainLossAmount) : 0), 0),
    winners: withPercent.filter((position) => Number(position.gainLossPercent) > 0).length,
    losers: withPercent.filter((position) => Number(position.gainLossPercent) < 0).length,
    best: sortedPercent[0],
    worst: sortedPercent.at(-1),
  };
}
