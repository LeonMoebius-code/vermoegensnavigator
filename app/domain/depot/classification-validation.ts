import { isAssetClass } from "../assets/contracts";

/** Unresolved source data may retain its original class for explicit clarification.
 * Missing status keeps the existing mapped default. No mutation or legacy repair. */
export function validDepotClassifications(depot: unknown): boolean {
  return depot === undefined || (Array.isArray(depot) && depot.every((holding) =>
    holding && typeof holding === "object" &&
    (holding.classificationStatus === "unresolved" || isAssetClass(holding.assetClass))));
}

export const CLASSIFICATION_ERROR = "Ungültige Anlageklasse bei einer als geklärt geführten Depotposition. Zulässig sind Liquidität, Geldwerte, Substanzwerte, Alternative Anlagen und Sachwerte. Vorgang abgebrochen; Originaldaten bleiben erhalten.";

/** Used only for current import/restore inputs. Historical migrations stay separate. */
export function currentClassificationError(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as { case?: unknown }).case ?? value;
  if (!candidate || typeof candidate !== "object") return null;
  const item = candidate as { schemaVersion?: unknown; depot?: unknown };
  return Number(item.schemaVersion) >= 10 && !validDepotClassifications(item.depot)
    ? CLASSIFICATION_ERROR : null;
}
