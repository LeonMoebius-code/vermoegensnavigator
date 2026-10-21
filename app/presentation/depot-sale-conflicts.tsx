import type { DepotAccount, DepotHolding } from "../domain/depot/contracts";
import { depotSaleConflicts } from "../domain/depot/sale-validation";

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function DepotSaleConflicts({ depot, accounts }: { depot: DepotHolding[]; accounts: DepotAccount[] }) {
  const conflicts = depotSaleConflicts(depot);
  if (!conflicts.length) return null;
  return <section className="depot-sale-conflicts csv-error" role="alert">
    <strong>Unbereinigter Entwurf – Verkaufskonflikt</strong>
    <p>Speichern, Versionieren, JSON, Excel und PDF/Druck sind bis zur aktiven Korrektur gesperrt.
      Die begrenzte Simulation der Verkäufe löst diesen Konflikt nicht.</p>
    <ul>{conflicts.map(holding => <li key={holding.id}>
      <strong>{accounts.find(account => account.id === holding.depotId)?.name}: {holding.name || "Unbenannte Position"}</strong>
      {" – Marktwert "}{euro.format(holding.value)}{" / geplanter Verkauf "}{euro.format(holding.plannedSale)}.
      {" Verkauf bewusst auf höchstens den Marktwert reduzieren oder den Marktwert sachlich zutreffend korrigieren (Ausgangslage oder Depotcheck)."}
    </li>)}</ul>
    <p>Alle angezeigten Planungen und Transaktionen sind bis dahin vorläufige Entwurfswerte.</p>
  </section>;
}
