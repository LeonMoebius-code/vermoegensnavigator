import { annual, bondCase, multiCase } from "../../scripts/cp0a2-fixtures";
import { finalCsv, finalRow } from "../../scripts/bond-final-fixtures";

// Small UI-ready derivatives of the existing synthetic references; no suite imports.
export const depotA = "Synthetisches Depot A";
export const depotB = "Synthetisches Depot B";
export function depotCsv(depot: "A" | "B", replacement = false) {
  const stock = finalRow({ Bezeichnung: `Synthetische Aktie ${depot}`, WKN: "ZZCP01",
    Wertpapiertyp: "Aktie", Land: "DE", Zinssatz: "", Endfälligkeit: "", Stückzinsen: "",
    Bewertungsende: "01.01.2026", Kurs: 100, "Stück/Nominal": 100,
    "Kurswert incl. Stückzinsen": depot === "A" ? 10000 : replacement ? 8000 : 6000 });
  return finalCsv(depot === "A" ? [stock] : [stock, { ...stock,
    Bezeichnung: "Synthetischer Mischfonds", WKN: "ZZCP02", Wertpapiertyp: "Mischfonds",
    "Kurswert incl. Stückzinsen": 4000 }]);
}

export function planningCase() {
  const item = multiCase();
  item.advisory.caseName = "CP0B Planung Original";
  item.advisory.scope = "private";
  item.currentStep = 2;
  item.advisory.liquidAssets = 10000;
  item.plans.forEach((plan) => { plan.total = 10000; });
  item.plans[0].name = "Synthetische Kaufvariante";
  // Explicit current-schema capital-pot assignment makes the existing synthetic buy editable.
  Object.assign(item.plans[0].allocations[0], {
    capitalPotId: "strategic", capitalPotAmounts: { strategic: 3000 }, allocationMode: "single",
  });
  item.plans[1].name = "Synthetische Variante ohne Kauf";
  return item;
}

export function outputCase() {
  const item = bondCase(annual());
  item.advisory.caseName = "CP0B Bond / =1+1";
  item.advisory.scope = "private";
  item.currentStep = 2;
  return item;
}
