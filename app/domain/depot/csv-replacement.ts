import type { AdvisoryCase } from "../case/contracts";
import type { ParsedDepotHolding } from "./contracts";
import { replacementHoldingIdMap } from "./identity";

/** CSV-specific preflight before applying any state. Deliberate depot deletion
 * and the established pure lifecycle matching contract remain separate. */
export function assertCsvReplacementReferences(
  state: Pick<AdvisoryCase, "depot" | "plans">,
  depotId: string,
  rows: ParsedDepotHolding[],
) {
  const previous = state.depot.filter(h => h.depotId === depotId);
  const map = replacementHoldingIdMap(previous, rows.map(h => ({ ...h, depotId })));
  const selected = new Set(state.plans.flatMap(p => p.depotHoldingIds));
  if (previous.some(h => (h.plannedSale > 0 || selected.has(h.id) || h.excludeFromBondAggregates === true) && !map.has(h.id)))
    throw new Error("CSV-Ersetzen abgebrochen: Bestehende Verkaufs- oder Planbezüge sind nicht eindeutig zuordenbar. Der bisherige Fall bleibt unverändert. Bitte Identitäten und Zeichencodierung der Quelldatei prüfen.");
}
