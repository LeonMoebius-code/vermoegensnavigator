import { analyzeBondV2, BondSourceConvention, bondReasonLabel } from "./bond-v2";
import { calendarDate } from "./depot-validation";
import { sourceFieldValid, validBondSource } from "./bond-source";
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

export type DepotAnalysisPosition = Omit<DepotHolding, "id" | "value" | "depotId"> & {
  id: string;
  depotId?: string;
  source: "holding" | "planned-purchase";
  value: number;
  classification: ProductClassification;
  bondBase?: DepotAnalysisPosition;
  quantityScale?: number | null;
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
  // An explicit multi-asset label takes precedence over broad equity/bond segments.
  if (includesAny(text, ["mischfonds", "multi-asset", "multi asset", "balanced fund", "lebenszyklus", "lifecycle", "life cycle", "hybridfonds", "hybrid funds", "wertgesichert", "wertsicherung", "capital protection fund"]))
    return { main: "Mischfonds / Multi-Asset", sub: "Mischfonds / Multi-Asset", direct: false, confidence };
  if (isFund && includesAny(text, ["rohstoff", "commodity", "commodities", "edelmetall"]))
    return { main: "Alternative Anlagen", sub: "Rohstofffonds", direct: false, confidence };
  if (isFund && includesAny(text, ["geldmarkt", "money market"]))
    return { main: "Renten", sub: "Geldmarktfonds", direct: false, confidence };
  if (isFund && includesAny(text, ["renten", "anleihe", "bond", "credit"]))
    return { main: "Renten", sub: "Rentenfonds", direct: false, confidence };
  if (isFund && text.includes("festverzins"))
    return { main: "Renten", sub: "Rentenfonds", direct: false, confidence };
  if (isFund && includesAny(text, ["aktien", "equity", "share"]))
    return { main: "Aktien", sub: "Aktienfonds / Aktien-ETF", direct: false, confidence };
  if (includesAny(text, ["vermögensverwaltung", "vermoegensverwaltung"]))
    return { main: "Mischfonds / Multi-Asset", sub: "Vermögensverwaltung", direct: false, confidence };
  if (isFund && includesAny(text, ["immobil", "real estate"]))
    return { main: "Immobilien / Sachwerte", sub: "Immobilienfonds", direct: false, confidence };
  if (includesAny(text, ["zertifikat", "certificate", "strukturiert", "aktienanleihe"]))
    return { main: "Strukturierte Produkte", sub: "Zertifikate / strukturierte Produkte", direct: false, confidence };
  if (includesAny(text, ["rohstoff", "edelmetall", "commodity", "gold", "silber"]))
    return { main: "Alternative Anlagen", sub: "Rohstoffe / Edelmetalle", direct: true, confidence };
  if (includesAny(text, ["alternative anlage", "alternative investment"]))
    return { main: "Alternative Anlagen", sub: "Sonstige Alternative Anlagen", direct: false, confidence };
  if (includesAny(text, ["tagesgeld", "termingeld", "kontoguthaben", "sparkonto", "girokonto"]))
    return { main: "Liquidität", sub: "Kontoguthaben / Tagesgeld / Termingeld", direct: true, confidence };
  if (!isFund && includesAny(text, ["doppelwährung", "doppelwaehrung", "dual currency", "dual-currency"]))
    return { main: "Renten", sub: "Doppelwährungsanleihe", direct: true, bondKind: "other", confidence };
  if (includesAny(text, ["floater", "floating", "variabel", "variabel verzinslich", "variabelverzinslich"]))
    return { main: "Renten", sub: "Floater", direct: true, bondKind: "floater", confidence };
  if (includesAny(text, ["stufenzins", "step-up", "step up"]))
    return { main: "Renten", sub: "Stufenzinsanleihen", direct: true, bondKind: "step-up", confidence };
  if (!isFund && includesAny(text, ["callable", "convertible", "wandelanleihe", "kündbar", "kuendbar", "perpetual", "nachrang", "hybrid", "stripped"]))
    return { main: "Renten", sub: "Sonstige Anleihestruktur", direct: true, bondKind: "other", confidence };
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
  const sourceText = [source.securityType, source.sourceType, source.investmentMedium, source.segment, source.certificateClass].map(normalized).filter(Boolean).join(" ");
  const specialFundName = /lebenszyklus|lifecycle|life cycle|hybridfonds|wertgesichert|wertsicherung|rohstofffonds/i.test(source.name || "") ? normalized(source.name) : "";
  const classification = classifyText(`${sourceText} ${specialFundName}`.trim(), "source");
  if (classification) {
    // Names can veto standard-bond eligibility, never invent contractual terms.
    if (classification.bondKind === "fixed") {
      const name = normalized(source.name);
      if (/\b(doppelwährung\w*|doppelwaehrung\w*|dual[- ]currency|floater|floating|step-up|step up|stufenzins\w*|callable|convertible|wandelanleihe\w*|kündbar\w*|kuendbar\w*|perpetual|nachrang\w*|hybrid\w*|stripped|zertifikat\w*|certificate\w*|aktienanleihe\w*)\b/.test(name)) {
        const restricted = classifyText(`${name} ${sourceText}`, "source");
        if (restricted?.main === "Strukturierte Produkte") return restricted;
        if (restricted?.bondKind && restricted.bondKind !== "fixed") return restricted;
        return { main: "Renten", sub: "Sonstige Anleihestruktur", direct: true, bondKind: "other", confidence: "source" };
      }
    }
    return classification;
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
  physicalBonds = false,
): DepotAnalysisPosition[] {
  const holdings = depot
    .map((holding): DepotAnalysisPosition => {
      const base: DepotAnalysisPosition = {
        ...holding,
        id: holding.id,
        source: "holding" as const,
        value: Math.max(0, holding.value),
        classification: classifyDepotProduct(holding),
      };
      if (state === "ist") return base;
      const sale = Number.isFinite(holding.plannedSale) ? Math.max(0, holding.plannedSale) : 0;
      const value = Math.max(0, base.value - sale);
      const scale = base.value > 0 ? value / base.value : 1;
      const source = validBondSource(base.bondSource, base);
      const linear = ["fixed", "floater", "step-up"].includes(base.classification.bondKind || "") &&
        source?.units.nominal === "face-in-bond-currency" && sourceFieldValid(source, "nominalOrUnits");
      const quantityScale = scale === 1 ? 1 : linear ? scale : null;
      const scaled = (n?: number) => quantityScale !== null && Number.isFinite(n) ? Number(n) * quantityScale : undefined;
      return { ...base, value, bondBase: base, quantityScale,
        nominalOrUnits: scaled(base.nominalOrUnits),
        accruedInterest: source?.units.accrued === "per100" ? base.accruedInterest : scaled(base.accruedInterest),
      };
    })
    .filter((position) => position.value > 0 || (physicalBonds && position.classification.main === "Renten" &&
      position.classification.direct && (position.bondBase?.value ?? position.value) === 0));
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
  const values = new Map<string, DepotAnalysisPosition>();
  for (const position of positions) {
    const key = economicSecurityKey(position);
    const current = values.get(key);
    values.set(
      key,
      current ? { ...current, value: current.value + position.value } : { ...position },
    );
  }
  const sorted = [...values.values()].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, position) => sum + position.value, 0);
  const share = (count: number) => total
    ? sorted.slice(0, count).reduce((sum, position) => sum + position.value, 0) / total
    : 0;
  return { total, count: sorted.length, largest: sorted[0], top3: share(3), top5: share(5), positions: sorted };
}

export function economicSecurityKey(
  position: Pick<DepotAnalysisPosition, "id" | "wkn" | "productId">,
) {
  const wkn = String(position.wkn || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  if (wkn) return `wkn:${wkn}`;
  if (position.productId) return `product:${position.productId}`;
  return `position:${position.id}`;
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
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return Number.isNaN(date.getTime()) || date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3]) ? null : date;
};

export function valuationDateFor(positions: DepotAnalysisPosition[], fallback = new Date()) {
  const counts = new Map<string, number>();
  for (const position of positions) if (position.valuationEnd && localDate(position.valuationEnd))
    counts.set(position.valuationEnd, (counts.get(position.valuationEnd) || 0) + 1);
  const selected = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0];
  return selected
    ? localDate(selected)!
    : new Date(Date.UTC(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12));
}

export function valuationDatesFor(positions: DepotAnalysisPosition[]) {
  return Array.from(
    new Set(
      positions.flatMap((position) =>
        position.valuationEnd && localDate(position.valuationEnd)
          ? [position.valuationEnd]
          : [],
      ),
    ),
  ).sort();
}

export function hasMixedValuationDates(positions: DepotAnalysisPosition[]) {
  return valuationDatesFor(positions).length > 1;
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
  metrics: ReturnType<typeof analyzeBondV2>;
};

export type BondMetricKey = "ytm" | "currentYield" | "modified" | "dv01";
export type BondInclusion = "includedAndCalculable" | "manuallyExcluded" | "notCalculable";
export type BondCoverage = {
  value: number | null;
  status: "available" | "not-applicable" | "unknown-reporting-currency" | "invalid-value-basis";
  basisEUR: number | null;
  includedAndCalculable: { count: number; valueEUR: number | null };
  manuallyExcluded: { count: number; valueEUR: number | null };
  notCalculable: { count: number; valueEUR: number | null };
};
export type BondLadderItem = {
  year: number; currency: string; overdue: boolean; nominal: number | null; marketValue: number | null; count: number;
  excludedCount: number; excludedNominal: number | null; excludedMarketValue: number | null;
  zeroValueCount: number; zeroValueNominal: number | null;
};
const finiteBondSum = (a: number | null, b: number) => a !== null && Number.isFinite(a + b) ? a + b : null;

export function bondPortfolioAnalysis(positions: DepotAnalysisPosition[], fallbackDate = new Date(),
  conventionFor?: (position: DepotAnalysisPosition) => BondSourceConvention | undefined) {
  const valuationDate = valuationDateFor(positions, fallbackDate);
  const renten = positions.filter((p) => p.classification.main === "Renten");
  const rows: BondPositionAnalysis[] = renten.map((position) => {
    const base = position.bondBase || position;
    const metrics = analyzeBondV2(base, fallbackDate, conventionFor?.(base));
    if (position.bondBase) {
      metrics.excludeFromBondAggregates = position.excludeFromBondAggregates === true;
      if (position.quantityScale === null) metrics.dv01 = { value: null, status: "missing-data", reasonCode: "plan-quantity-unknown" };
      else if (metrics.dv01.value !== null) metrics.dv01 = { ...metrics.dv01, value: metrics.dv01.value * (position.quantityScale ?? 1) };
    }
    return { position, metrics, remainingYears: metrics.remainingYears.value, currentYield: metrics.currentYield.value,
      ytm: metrics.ytm.value, macaulay: metrics.macaulay.value, modified: metrics.modified.value,
      dv01: metrics.dv01.value, exclusionReason: bondReasonLabel(metrics.ytm.reasonCode) };
  });
  const directRows = rows.filter((r) => r.position.classification.direct);
  const directValue = directRows.reduce((sum, r) => sum + r.position.value, 0); // raw depot total; NOT an asserted EUR value
  const comparable = (r: BondPositionAnalysis) => r.metrics.reportingComparable;
  const reportingComparable = directRows.length > 0 && directRows.every(comparable);
  const known = directRows.filter(comparable);
  const knownValueEUR = known.reduce<number | null>((sum, r) => finiteBondSum(sum, r.position.value), 0);
  const reportingAmounts = new Map<string, { currency: string; value: number | null; count: number }>();
  for (const r of directRows) {
    const currency = r.metrics.reportingValueCurrency;
    if (!currency) continue;
    const group = reportingAmounts.get(currency) || { currency, value: 0, count: 0 };
    group.value = finiteBondSum(group.value, r.position.value); group.count++;
    reportingAmounts.set(currency, group);
  }
  const valueEUR = (subset: BondPositionAnalysis[]) => {
    const value = subset.every(comparable) ? subset.reduce((sum, r) => sum + r.position.value, 0) : null;
    return value !== null && Number.isFinite(value) ? value : null;
  };
  const included = (r: BondPositionAnalysis, key: BondMetricKey) => comparable(r) && r.position.value > 0 && r[key] !== null &&
    (key === "currentYield" || r.metrics.aggregateEligible) && (key !== "dv01" || r.modified !== null);
  const inclusion = (r: BondPositionAnalysis, key: BondMetricKey): BondInclusion => r.position.excludeFromBondAggregates ? "manuallyExcluded" :
    included(r, key) ? "includedAndCalculable" : "notCalculable";
  const coverage = (predicate: (r: BondPositionAnalysis) => boolean, exclusions: boolean): BondCoverage => {
    const groups = { includedAndCalculable: [] as BondPositionAnalysis[], manuallyExcluded: [] as BondPositionAnalysis[], notCalculable: [] as BondPositionAnalysis[] };
    for (const r of directRows) groups[exclusions && r.position.excludeFromBondAggregates ? "manuallyExcluded" : comparable(r) && predicate(r) ? "includedAndCalculable" : "notCalculable"].push(r);
    const basisEUR = groups.includedAndCalculable.reduce((sum, r) => sum + r.position.value, 0);
    const status = !directRows.length ? "not-applicable" : !reportingComparable ? "unknown-reporting-currency" : !Number.isFinite(directValue) || !Number.isFinite(basisEUR) ? "invalid-value-basis" : directValue <= 0 ? "not-applicable" : "available";
    return { value: status === "available" ? basisEUR / directValue : null, status, basisEUR: Number.isFinite(basisEUR) ? basisEUR : null,
      includedAndCalculable: { count: groups.includedAndCalculable.length, valueEUR: valueEUR(groups.includedAndCalculable) },
      manuallyExcluded: { count: groups.manuallyExcluded.length, valueEUR: valueEUR(groups.manuallyExcluded) },
      notCalculable: { count: groups.notCalculable.length, valueEUR: valueEUR(groups.notCalculable) } };
  };
  const keys: BondMetricKey[] = ["ytm", "currentYield", "modified", "dv01"];
  const coverages = Object.fromEntries(keys.map((key) => [key, coverage((r) => included(r, key), true)])) as Record<BondMetricKey, BondCoverage>;
  const subset = (key: BondMetricKey) => directRows.filter((r) => inclusion(r, key) === "includedAndCalculable");
  const average = (key: BondMetricKey) => {
    const selected = subset(key), basis = coverages[key].basisEUR;
    const result = basis !== null && basis > 0 ? selected.reduce((sum, r) => sum + (r.position.value / basis) * r[key]!, 0) : null;
    return result !== null && Number.isFinite(result) ? result : null;
  };
  const dated = (r: BondPositionAnalysis) => Boolean(calendarDate(r.position.maturity));
  const nominal = (r: BondPositionAnalysis) => {
    const base = r.position.bondBase || r.position, source = validBondSource(base.bondSource, base);
    return Number.isFinite(r.position.nominalOrUnits) && Number(r.position.nominalOrUnits) > 0 &&
      /^[A-Z]{3}$/.test(r.position.currency || "") && r.position.quantityScale !== null &&
      (!source || (sourceFieldValid(source, "nominalOrUnits") && sourceFieldValid(source, "currency")));
  };
  const maturity = coverage(dated, false), ladderCoverage = coverage((r) => dated(r) && nominal(r), false);
  const ladderMap = new Map<string, BondLadderItem>();
  for (const r of directRows) {
    if (!dated(r) || !nominal(r)) continue;
    const year = Number(r.position.maturity!.slice(0, 4)), currency = r.position.currency!;
    const overdue = r.remainingYears === 0;
    const key = [year, currency, overdue].join("/");
    const item: BondLadderItem = ladderMap.get(key) || { year, currency, overdue, nominal: 0, marketValue: 0, count: 0,
      excludedCount: 0, excludedNominal: 0, excludedMarketValue: 0, zeroValueCount: 0, zeroValueNominal: 0 };
    item.nominal = finiteBondSum(item.nominal, r.position.nominalOrUnits!); item.count++;
    item.marketValue = comparable(r) ? finiteBondSum(item.marketValue, r.position.value) : null;
    if (r.position.excludeFromBondAggregates) {
      item.excludedCount++; item.excludedNominal = finiteBondSum(item.excludedNominal, r.position.nominalOrUnits!);
      item.excludedMarketValue = comparable(r) ? finiteBondSum(item.excludedMarketValue, r.position.value) : null;
    }
    if (r.position.value === 0) { item.zeroValueCount++; item.zeroValueNominal = finiteBondSum(item.zeroValueNominal, r.position.nominalOrUnits!); }
    ladderMap.set(key, item);
  }
  const dv01Rows = subset("dv01");
  // Reporting DV01 uses the same V2 duration and the documented dirty EUR value.
  const dv01Sum = dv01Rows.length ? dv01Rows.reduce((sum, r) => sum + bondDv01(r.position.value, r.modified!), 0) : null;
  const portfolioDv01 = dv01Sum !== null && Number.isFinite(dv01Sum) ? dv01Sum : null;
  return { valuationDate, valuationDates: valuationDatesFor(positions), mixedValuationDates: hasMixedValuationDates(positions),
    rows, directValue, directCount: directRows.length, reportingComparable, knownValueEUR,
    unknownReportingCount: directRows.length - known.length, directValueEUR: reportingComparable && Number.isFinite(directValue) ? directValue : null,
    reportingAmounts: [...reportingAmounts.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    totalRentenValue: renten.reduce((sum, p) => sum + p.value, 0), coverages, maturity, nominalLadder: ladderCoverage,
    maturityCoverage: maturity.value, ladderCoverage: ladderCoverage.value,
    calculableCoverage: coverages.modified.value, ytmCoverage: coverages.ytm.value, currentYieldCoverage: coverages.currentYield.value,
    ytmValue: coverages.ytm.basisEUR, currentYieldValue: coverages.currentYield.basisEUR, calculableValue: coverages.modified.basisEUR,
    averageModeledYtm: average("ytm"), averageCurrentYield: average("currentYield"), portfolioModified: average("modified"), portfolioDv01,
    excludedCount: directRows.filter((r) => r.position.excludeFromBondAggregates).length,
    excludedValueEUR: valueEUR(directRows.filter((r) => r.position.excludeFromBondAggregates)),
    zeroValueCount: directRows.filter((r) => r.position.value === 0).length,
    inclusion, ladder: [...ladderMap.values()].sort((a, b) => a.currency.localeCompare(b.currency) || a.year - b.year || Number(b.overdue) - Number(a.overdue)),
    scenarios: [-0.01, -0.005, 0.005, 0.01].map((deltaYield) => {
      const effect = portfolioDv01 === null ? null : -portfolioDv01 * deltaYield / 0.0001;
      return { deltaYield, effect: effect !== null && Number.isFinite(effect) ? effect : null };
    }),
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
