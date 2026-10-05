import type { VvFilters } from "./contracts";

export const blankVvFilters = (amount = 0): VvFilters => ({
  sustainable: "Keine Präferenz",
  currency: "Keine Präferenz",
  region: "Keine Präferenz",
  metals: "Keine Präferenz",
  amount,
  targetFunds: "Keine Präferenz",
  equityBand: "Keine Präferenz",
  individual: "Keine Präferenz",
  billingCountry: "Keine Präferenz",
  custody: "Keine Präferenz",
  maxRisk: 4,
});
