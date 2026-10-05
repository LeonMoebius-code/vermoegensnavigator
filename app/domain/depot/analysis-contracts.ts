import type { DepotHolding } from "./contracts";
import type { ProductClassification } from "./classification-contracts";

export type AnalysisState = "ist" | "plan";

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
