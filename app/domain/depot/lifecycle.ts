import type { DepotHolding, DepotAccount, ParsedDepotHolding } from "./contracts";
import type { AdvisoryData } from "../advisory/contracts";
import type { AdvisoryCase } from "../case/contracts";
import {
  replacementHoldingIdMap,
  reconcileDepotHoldingSelections,
  holdingIdentityConflict,
} from "./identity";
import { uid, iso } from "../case/runtime";

export function nextDepotName(accounts: DepotAccount[]) {
  const used = new Set(accounts.map((account) => account.name.trim()));
  let index = 1;
  while (used.has(`Depot ${index}`)) index += 1;
  return `Depot ${index}`;
}

export function initialReplacementDepotId(
  accounts: DepotAccount[],
  requestedDepotId?: string,
) {
  return requestedDepotId && accounts.some((account) => account.id === requestedDepotId)
    ? requestedDepotId
    : accounts[0]?.id || "";
}

export const holdingsForDepot = (depot: DepotHolding[], depotId: string) =>
  depot.filter((holding) => holding.depotId === depotId);

export const depotMarketValue = (depot: DepotHolding[], depotId: string) =>
  holdingsForDepot(depot, depotId).reduce(
    (sum, holding) => sum + Math.max(0, Number(holding.value) || 0),
    0,
  );

type DepotLifecycleState = Pick<
  AdvisoryCase,
  "advisory" | "depotAccounts" | "depot" | "plans"
>;

export function physicalDepotValue(depot: DepotHolding[]) {
  let total = 0;
  for (const holding of depot) {
    if (!Number.isFinite(holding.value) || holding.value < 0)
      throw new Error("Ungültiger Marktwert. Der bisherige Bestand bleibt erhalten.");
    total += holding.value;
  }
  if (!Number.isFinite(total)) throw new Error("Der Depotgesamtwert ist nicht endlich.");
  return total;
}

export function withDepotValue(advisory: AdvisoryData, depot: DepotHolding[]): AdvisoryData {
  return depot.length ? { ...advisory, depotValue: physicalDepotValue(depot), hasDepot: true } : advisory;
}

/** Every active-case mutation passes here before React publishes the next state. */
export function enforceCaseDepotValue<T extends Pick<AdvisoryCase, "advisory" | "depot">>(item: T): T {
  const advisory = withDepotValue(item.advisory, item.depot);
  return advisory === item.advisory ? item : { ...item, advisory };
}

export function setCaseDepot<T extends DepotLifecycleState>(state: T, depot: DepotHolding[]): T {
  return { ...state, depot,
    advisory: withDepotValue(state.depot.length && !depot.length ? { ...state.advisory, depotValue: 0 } : state.advisory, depot),
    plans: reconcileDepotHoldingSelections(state.plans, state.depot, depot),
  };
}

function importedHoldings(state: DepotLifecycleState, depotId: string, parsed: ParsedDepotHolding[]) {
  physicalDepotValue(parsed.map((holding) => ({ ...holding, depotId })));
  const oldById = new Map(state.depot.map((holding) => [holding.id, holding]));
  const reserved = new Set(state.depot.map((holding) => holding.id));
  parsed.forEach((holding) => reserved.add(holding.id));
  const used = new Set<string>();
  const idCounts = new Map<string, number>();
  parsed.forEach((holding) => idCounts.set(holding.id, (idCounts.get(holding.id) || 0) + 1));
  return parsed.map((raw) => {
    let id = raw.id;
    const holding = { ...raw, depotId };
    const old = oldById.get(id);
    if (!id || idCounts.get(id)! > 1 || used.has(id) || (old && holdingIdentityConflict(old, holding))) {
      do { id = uid("holding"); } while (reserved.has(id) || used.has(id));
    }
    used.add(id);
    return { ...holding, id };
  });
}

export function addDepotAccount(
  state: DepotLifecycleState,
  parsed: ParsedDepotHolding[],
  requestedName?: string,
): DepotLifecycleState {
  const now = iso();
  const account: DepotAccount = {
    id: uid("depot"),
    name: requestedName?.trim() || nextDepotName(state.depotAccounts),
    createdAt: now,
    updatedAt: now,
  };
  const imported = importedHoldings(state, account.id, parsed);
  const depot = [...state.depot, ...imported];
  const firstConcreteDepot = state.depot.length === 0 && imported.length > 0;
  const plans = state.plans.map((plan) =>
    firstConcreteDepot && !plan.depotModeSelectionInitialized
      ? { ...plan, depotMode: "afterSales" as const }
      : plan,
  );
  return {
    advisory: withDepotValue(state.advisory, depot),
    depotAccounts: [...state.depotAccounts, account],
    depot,
    plans,
  };
}

export function replaceDepotAccount(
  state: DepotLifecycleState,
  depotId: string,
  parsed: ParsedDepotHolding[],
): DepotLifecycleState {
  if (!state.depotAccounts.some((account) => account.id === depotId)) return state;
  const previous = holdingsForDepot(state.depot, depotId);
  const imported = importedHoldings(state, depotId, parsed);
  // Preserve original identities for matching: repairing conflicts/duplicates is
  // only a storage concern and must never manufacture fresh matching evidence.
  const matchingHoldings = imported.map((holding, index) => ({ ...holding, id: parsed[index].id || holding.id }));
  const finalIds = new Map(matchingHoldings.map((holding, index) => [holding.id, imported[index].id]));
  const replacementMap = new Map([...replacementHoldingIdMap(state.depot, matchingHoldings)]
    .map(([oldId, sourceId]) => [oldId, finalIds.get(sourceId)!]));
  const previousByNextId = new Map(
    [...replacementMap].map(([previousId, nextId]) => [nextId, previousId]),
  );
  const previousById = new Map(previous.map((holding) => [holding.id, holding]));
  const reconciled = imported.map((holding) => {
    const match = previousById.get(previousByNextId.get(holding.id) || "");
    return match
      ? { ...holding, plannedSale: Math.max(0, Math.min(match.plannedSale, holding.value)), excludeFromBondAggregates: match.excludeFromBondAggregates === true }
      : { ...holding, plannedSale: 0, excludeFromBondAggregates: false };
  });
  const depot = [
    ...state.depot.filter((holding) => holding.depotId !== depotId),
    ...reconciled,
  ];
  const firstConcreteDepot = state.depot.length === 0 && reconciled.length > 0;
  const plans = reconcileDepotHoldingSelections(
    state.plans,
    state.depot,
    depot,
    depotId,
    replacementMap,
  ).map((plan) =>
    firstConcreteDepot && !plan.depotModeSelectionInitialized
      ? { ...plan, depotMode: "afterSales" as const }
      : plan,
  );
  return {
    advisory: withDepotValue(state.depot.length && !depot.length ? { ...state.advisory, depotValue: 0 } : state.advisory, depot),
    depotAccounts: state.depotAccounts.map((account) =>
      account.id === depotId ? { ...account, updatedAt: iso() } : account,
    ),
    depot,
    plans,
  };
}

export function buildMultiDepotExportData(
  depotAccounts: DepotAccount[],
  depot: DepotHolding[],
) {
  return {
    overview: depotAccounts.map((account) => {
      const positions = holdingsForDepot(depot, account.id);
      const valuationDates = Array.from(
        new Set(
          positions.flatMap((holding) =>
            holding.valuationEnd ? [holding.valuationEnd] : [],
          ),
        ),
      ).sort();
      return {
        depotId: account.id,
        depotName: account.name,
        marketValue: depotMarketValue(depot, account.id),
        positionCount: positions.length,
        valuationDate:
          valuationDates.length === 1
            ? valuationDates[0]
            : valuationDates.length > 1
              ? "unterschiedliche Bewertungsstichtage"
              : "",
      };
    }),
    holdings: depot.map((holding) => ({
      ...holding,
      depotName:
        depotAccounts.find((account) => account.id === holding.depotId)?.name || "",
    })),
    totalMarketValue: depot.reduce(
      (sum, holding) => sum + Math.max(0, Number(holding.value) || 0),
      0,
    ),
  };
}

export function deleteDepotAccount(
  state: DepotLifecycleState,
  depotId: string,
): DepotLifecycleState {
  const depot = state.depot.filter((holding) => holding.depotId !== depotId);
  const validIds = new Set(depot.map((holding) => holding.id));
  return {
    advisory: withDepotValue(state.depot.length && !depot.length ? { ...state.advisory, depotValue: 0 } : state.advisory, depot),
    depotAccounts: state.depotAccounts.filter((account) => account.id !== depotId),
    depot,
    plans: state.plans.map((plan) => ({
      ...plan,
      depotHoldingIds: plan.depotHoldingIds.filter((id) => validIds.has(id)),
    })),
  };
}

export function renameDepotAccount(
  accounts: DepotAccount[],
  depotId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (!trimmed) return accounts;
  return accounts.map((account) =>
    account.id === depotId ? { ...account, name: trimmed, updatedAt: iso() } : account,
  );
}
