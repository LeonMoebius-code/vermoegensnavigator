export type VvFilters = {
  sustainable: "Keine Präferenz" | "Ja";
  currency: "Keine Präferenz" | "EUR" | "CHF";
  region: string;
  metals: "Keine Präferenz" | "Ja" | "Nein" | "Individuell";
  amount: number;
  targetFunds: "Keine Präferenz" | "Ja" | "Nein";
  equityBand: "Keine Präferenz" | "Unter 50%" | "Über 50%" | "Individuell";
  individual: "Keine Präferenz" | "Ja" | "Nein";
  billingCountry: "Keine Präferenz" | "Deutschland" | "Schweiz";
  custody: string;
  maxRisk: number;
};
