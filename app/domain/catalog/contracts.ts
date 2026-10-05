import type { AssetMix } from "../assets/contracts";
import type { RiskLevel } from "../risk/contracts";

export type SolutionType = {
  id: string;
  name: string;
  yieldLow: number;
  yieldHigh: number;
  minMonths: number;
  risk: string;
  liquidity: string;
  note: string;
};

export type HouseProduct = {
  id: string;
  name: string;
  wkn: string;
  category: string;
  risk: number;
  horizon: string;
  region: string;
  sustainable: boolean;
  role: "Core" | "Satellit";
  solutionId: string;
  assetMix: AssetMix | null;
};

export type ModelPortfolio = {
  id: "rb2" | "rb3" | "rb4";
  name: string;
  risk: RiskLevel;
  mix: Record<string, number>;
  holdings: Array<{ productId: string; name: string; weight: number }>;
};

export type ManagedPortfolio = {
  id: string;
  name: string;
  sustainable: boolean;
  currency: "EUR" | "CHF";
  region: string;
  metals: "Ja" | "Nein" | "Individuell";
  targetFunds: boolean;
  individual: boolean;
  risk: number;
  minimum: number;
  custody: string;
  horizon: string;
  mix: string;
  costs: string;
  billingCountry: "Deutschland" | "Schweiz";
  equityBand: "Unter 50%" | "Über 50%" | "Individuell";
  assetMix: AssetMix | null;
  onHouseView: boolean;
  sourceLabel?: string;
};
