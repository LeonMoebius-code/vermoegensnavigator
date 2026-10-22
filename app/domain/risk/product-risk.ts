import { houseProducts } from "../../data/house-products";
import { managedPortfolios } from "../../data/managed-portfolios";
import type { PlannerAllocation, StructurePlan } from "../planning/contracts";
import type { RiskLevel } from "./contracts";

type RiskEntry = { id: string; name: string; risk: number };
type RiskCatalogs = { products: readonly RiskEntry[]; portfolios: readonly RiskEntry[] };
const catalogs: RiskCatalogs = { products: houseProducts, portfolios: managedPortfolios };

/** Read-only projection of current allocations; never persist risk copies or warning flags. */
export function allocationProductRisk(allocation: PlannerAllocation, customerRisk: RiskLevel, data = catalogs) {
  const candidates = (allocation.source === "vv" ? data.portfolios
    : allocation.source === "product" ? data.products
      : allocation.source === "model" ? [...data.products, ...data.portfolios] : [])
    .filter(entry => entry.id === allocation.productId);
  const entry = candidates.length === 1 ? candidates[0] : undefined;
  const productRisk = entry && Number.isInteger(entry.risk) && entry.risk >= 1 && entry.risk <= 5
    ? entry.risk : null;
  return {
    allocationId: allocation.id, productId: allocation.productId,
    productName: entry?.name || allocation.productName, source: allocation.source,
    amount: allocation.amount, customerRisk, productRisk,
    status: productRisk === null ? "unknown" as const
      : productRisk > customerRisk ? "conflict" as const : "clear" as const,
  };
}

export type ProductRiskCheck = ReturnType<typeof allocationProductRisk>;
export const PRODUCT_RISK_SCOPE = "Dieser Vergleich ist keine Geeignetheitsfreigabe. Mindesthorizont, Kenntnisse und Erfahrung sowie Kapitaltopf-Zuordnung sind gesondert zu prüfen.";

export function productRiskMessage(check: ProductRiskCheck): string {
  return check.status === "unknown"
    ? `Produktrisikoklasse nicht eindeutig aus dem aktuellen Katalog bestimmbar; Vergleich mit der verwendeten Kundenrisikostufe ${check.customerRisk} nicht möglich. Produktklassifizierung prüfen.`
    : check.status === "conflict"
      ? `Produktrisikoklasse ${check.productRisk} liegt über der verwendeten Kundenrisikostufe ${check.customerRisk}. Risikokonflikt fachlich prüfen.`
      : `Produktrisikoklasse ${check.productRisk} liegt nicht über der verwendeten Kundenrisikostufe ${check.customerRisk}. Nur dieser RK-Vergleich ist unauffällig.`;
}

export const planProductRisks = (plan: StructurePlan, customerRisk: RiskLevel) =>
  plan.allocations.map(allocation => allocationProductRisk(allocation, customerRisk));
