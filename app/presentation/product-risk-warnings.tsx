import type { AdvisoryData } from "../domain/advisory/contracts";
import type { StructurePlan } from "../domain/planning/contracts";
import { capitalPots } from "../domain/planning/capital-pots";
import { allocationCapitalPotAmounts } from "../domain/planning/allocations";
import { allocationProductRisk, PRODUCT_RISK_SCOPE, productRiskMessage, type ProductRiskCheck } from "../domain/risk/product-risk";

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function ProductRiskNotice({ check }: { check: ProductRiskCheck }) {
  if (check.status === "clear") return null;
  return <small className="product-risk-notice" role="note" data-risk-status={check.status}>
    <strong>{check.productName}: </strong>{productRiskMessage(check)}
    {check.amount === 0 && " Vorschau ohne Kaufbetrag."}
  </small>;
}

/** Includes every pot of each explicitly supplied plan, including hidden selections. */
export function ProductRiskWarnings({ plans, advisory, createdAt }: {
  plans: StructurePlan[]; advisory: AdvisoryData; createdAt: string;
}) {
  const rows = plans.flatMap(plan => {
    const pots = capitalPots(advisory, plan.total, createdAt);
    return plan.allocations.flatMap(allocation => {
      const check = allocationProductRisk(allocation, advisory.risk);
      if (check.status === "clear") return [];
      const bindings = Object.entries(allocationCapitalPotAmounts(allocation))
        .filter(([, amount]) => Number(amount) > 0)
        .map(([id, amount]) => `${pots.find(pot => pot.id === id)?.label || id} (${id}): ${euro.format(amount!)}`);
      return [{ plan, allocation, check, bindings }];
    });
  });
  if (!rows.length) return null;
  return <section className="product-risk-warnings" aria-label="Produktbezogene Risikoprüfung">
    <h3>Produktbezogene Risikoprüfung</h3>
    <ul>{rows.map(({ plan, allocation, check, bindings }) => <li key={`${plan.id}:${allocation.id}`}>
      <b>{plan.name} · {bindings.join(" · ") || allocation.capitalPotId || "ohne Kapitaltopfbindung"}</b>
      <ProductRiskNotice check={check} />
    </li>)}</ul>
    <p>{PRODUCT_RISK_SCOPE}</p>
  </section>;
}
