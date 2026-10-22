import type { DepotHolding } from "./contracts";

/** Current sale trust boundary: inspect original values without conversion or repair. */
export function validDepotSale(value: unknown, plannedSale: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 &&
    typeof plannedSale === "number" && Number.isFinite(plannedSale) &&
    plannedSale >= 0 && plannedSale <= value;
}

export const depotSaleConflicts = (depot: DepotHolding[]) =>
  depot.filter((holding) => !validDepotSale(holding.value, holding.plannedSale));
