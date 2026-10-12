import type { DepotHolding } from "./contracts";
import type { StructurePlan } from "../planning/contracts";

const normalizedHoldingWkn = (holding: DepotHolding) =>
  String(holding.wkn || "").trim().toUpperCase();

const normalizedHoldingProductId = (holding: DepotHolding) =>
  String(holding.productId || "").trim();

const conservativeHoldingFallback = (holding: DepotHolding) => {
  const name = holding.name.trim().toLocaleLowerCase("de-DE");
  if (!name) return "";
  return `${name}::${String(holding.securityType || holding.sourceType || "")
    .trim()
    .toLocaleLowerCase("de-DE")}`;
};

export const holdingIdentityConflict = (previous: DepotHolding, next: DepotHolding) =>
  previous.depotId !== next.depotId ||
  [normalizedHoldingWkn, normalizedHoldingProductId].some((key) => key(previous) && key(next) && key(previous) !== key(next));

/**
 * Builds the single, globally one-to-one mapping used for every consequence of
 * a depot replacement. Each stage only sees holdings that were not claimed by
 * a higher-priority identity.
 */
export function replacementHoldingIdMap(
  previousDepot: DepotHolding[],
  nextDepot: DepotHolding[],
) {
  const matches = new Map<string, string>();
  const uniqueIds = (holdings: DepotHolding[]) => {
    const counts = new Map<string, number>();
    holdings.forEach((holding) => counts.set(holding.id, (counts.get(holding.id) || 0) + 1));
    return new Map(holdings.filter((holding) => holding.id && counts.get(holding.id) === 1)
      .map((holding) => [holding.id, holding]));
  };
  const availablePrevious = uniqueIds(previousDepot);
  const availableNext = uniqueIds(nextDepot);
  const excludedPrevious = previousDepot.filter((holding) => !availablePrevious.has(holding.id));
  const excludedNext = nextDepot.filter((holding) => !availableNext.has(holding.id));

  const claim = (previous: DepotHolding, next: DepotHolding) => {
    matches.set(previous.id, next.id);
    availablePrevious.delete(previous.id);
    availableNext.delete(next.id);
  };

  for (const previous of [...availablePrevious.values()]) {
    const next = availableNext.get(previous.id);
    if (!next) continue;
    if (!holdingIdentityConflict(previous, next)) claim(previous, next);
    else {
      // A contradicted explicit identity must not be reinterpreted by weaker stages.
      availablePrevious.delete(previous.id);
      availableNext.delete(next.id);
      excludedPrevious.push(previous);
      excludedNext.push(next);
    }
  }

  const ambiguousPrevious = new Set<string>();
  const ambiguousNext = new Set<string>();
  const claimUniqueBy = (keyFor: (holding: DepotHolding) => string) => {
    const previousByKey = new Map<string, DepotHolding[]>();
    const nextByKey = new Map<string, DepotHolding[]>();
    for (const holding of availablePrevious.values()) {
      const key = keyFor(holding);
      if (key && !ambiguousPrevious.has(holding.id)) previousByKey.set(`${holding.depotId}::${key}`, [...(previousByKey.get(`${holding.depotId}::${key}`) || []), holding]);
    }
    for (const holding of availableNext.values()) {
      const key = keyFor(holding);
      if (key && !ambiguousNext.has(holding.id)) nextByKey.set(`${holding.depotId}::${key}`, [...(nextByKey.get(`${holding.depotId}::${key}`) || []), holding]);
    }
    // Invalid IDs cannot be claimed, but their securities still make weaker
    // identities ambiguous. Dropping them would manufacture a unique WKN.
    for (const [excluded, byKey] of [[excludedPrevious, previousByKey], [excludedNext, nextByKey]] as const) {
      for (const holding of excluded) {
        const key = keyFor(holding);
        if (key) byKey.set(`${holding.depotId}::${key}`, [...(byKey.get(`${holding.depotId}::${key}`) || []), holding]);
      }
    }
    for (const key of new Set([...previousByKey.keys(), ...nextByKey.keys()])) {
      const previousCandidates = previousByKey.get(key) || [];
      const nextCandidates = nextByKey.get(key) || [];
      if (previousCandidates.length > 1 || nextCandidates.length > 1 ||
        previousCandidates.some((holding) => !availablePrevious.has(holding.id)) ||
        nextCandidates.some((holding) => !availableNext.has(holding.id))) {
        previousCandidates.forEach((holding) => ambiguousPrevious.add(holding.id));
        nextCandidates.forEach((holding) => ambiguousNext.add(holding.id));
      } else if (previousCandidates.length === 1 && nextCandidates.length === 1 &&
        !holdingIdentityConflict(previousCandidates[0], nextCandidates[0]))
        claim(previousCandidates[0], nextCandidates[0]);
    }
  };

  claimUniqueBy(normalizedHoldingWkn);
  claimUniqueBy(normalizedHoldingProductId);
  claimUniqueBy(conservativeHoldingFallback);
  return matches;
}

export function reconcileDepotHoldingSelections(
  plans: StructurePlan[],
  previousDepot: DepotHolding[],
  nextDepot: DepotHolding[],
  replacementDepotId?: string,
  replacementMap?: ReadonlyMap<string, string>,
) {
  const nextIds = new Set(nextDepot.map((holding) => holding.id));
  const previousById = new Map(
    previousDepot.map((holding) => [holding.id, holding]),
  );
  const finalReplacementMap = replacementDepotId
    ? replacementMap || replacementHoldingIdMap(
        previousDepot.filter((holding) => holding.depotId === replacementDepotId),
        nextDepot.filter((holding) => holding.depotId === replacementDepotId),
      )
    : undefined;
  return plans.map((plan) => {
    const mappedIds = plan.depotHoldingIds.flatMap((id) => {
      const previous = previousById.get(id);
      if (previous && replacementDepotId && previous.depotId === replacementDepotId) {
        const matchId = finalReplacementMap?.get(previous.id);
        return matchId && nextIds.has(matchId) ? [matchId] : [];
      }
      return previous && nextIds.has(id) ? [id] : [];
    });
    return {
      ...plan,
      depotHoldingIds: Array.from(new Set(mappedIds)),
    };
  });
}
