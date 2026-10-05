import type { AssetClass } from "../assets/contracts";
import type { BondSource } from "../bonds/contracts";

/** CSV and optional persisted holding fields. No raw cell content is retained. */
export type ValidationCode = "missing" | "invalid-number" | "ambiguous-number" | "out-of-range" | "invalid-date";

export type ImportIssue = { field: string; code: ValidationCode };

export type DepotHolding = {
  id: string;
  depotId: string;
  productId?: string;
  name: string;
  value: number;
  assetClass: AssetClass;
  region: string;
  risk: number;
  plannedSale: number;
  note: string;
  wkn?: string;
  segment?: string;
  investmentMedium?: string;
  securityType?: string;
  rawCountry?: string;
  currency?: string;
  industry?: string;
  certificateClass?: string;
  importIssues?: ImportIssue[];
  bondSource?: BondSource;
  excludeFromBondAggregates?: boolean;
  coupon?: number;
  maturity?: string;
  nominalOrUnits?: number;
  lastPurchaseDate?: string;
  averageEntryPrice?: number;
  purchaseCosts?: number;
  currentPrice?: number;
  gainLossPercent?: number;
  gainLossAmount?: number;
  accruedInterest?: number;
  sourceDepotShare?: number;
  averageEntryFx?: number;
  fxRate?: number;
  valuationStart?: string;
  valuationEnd?: string;
  holdingAtValuationStart?: number;
  holdingAtValuationEnd?: number;
  /** Compatibility with depot positions saved before V0.13. */
  sourceType?: string;
  classificationStatus?: "mapped" | "matched" | "unresolved";
};

export type DepotAccount = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ParsedDepotHolding = Omit<DepotHolding, "depotId">;
