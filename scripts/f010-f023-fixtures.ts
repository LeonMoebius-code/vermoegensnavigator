import { controlCase } from "./f021-fixtures";
import type { AdvisoryCase, DepotHolding } from "../app/case-model";
export function classificationCase(id = "f010-f023"): AdvisoryCase {
  const c = controlCase(id);
  c.currentStep = 1;
  c.advisory.liquidAssets = 0; c.advisory.depotValue = 10000; c.advisory.hasDepot = true;
  c.depotAccounts = [{ id: "classification-depot-A", name: "Synthetisches Depot A", createdAt: c.createdAt, updatedAt: c.createdAt }];
  c.depot = [{ id: "classification-holding-A", depotId: c.depotAccounts[0].id, name: "Synthetische ungeklärte Position", wkn: "ZZCL01", value: 10000,
    plannedSale: 0, risk: 0, assetClass: "Geldwerte", classificationStatus: "unresolved", region: "Weltweit", note: "F010/F023" }];
  Object.assign(c.plans[0], { total: 0, depotMode: "retain", depotHoldingIds: [c.depot[0].id], depotSelectionInitialized: true, depotModeSelectionInitialized: true });
  return c;
}
export function invalidClassification(value: unknown = "Krypto", schema = 11): AdvisoryCase {
  const c = classificationCase(`f023-${schema}`); Reflect.set(c, "schemaVersion", schema);
  c.depot[0].classificationStatus = "mapped"; Reflect.set(c.depot[0], "assetClass", value);
  return c;
}
export function classifiedHolding(c: AdvisoryCase, changes: Partial<DepotHolding> = {}): DepotHolding {
  return { ...c.depot[0], classificationStatus: "mapped", assetClass: "Substanzwerte", ...changes };
}
