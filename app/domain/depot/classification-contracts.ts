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
