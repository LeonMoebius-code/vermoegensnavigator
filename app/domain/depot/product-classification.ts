import type { ProductMainCategory, ProductClassification } from "./classification-contracts";
export type { ProductMainCategory, ProductClassification } from "./classification-contracts";
import type { DepotHolding } from "./contracts";

import { houseProducts } from "../../data/house-products";
import { managedPortfolios } from "../../data/managed-portfolios";

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
