import type { AdvisoryData } from "../advisory/contracts";
import type { StructurePlan } from "./contracts";
import { allocationCapitalPotAmounts } from "./allocations";
import { capitalPots } from "./capital-pots";
import { phasedEntryAmounts } from "./investment-plans";

export type NeedTermLoss = {
  kind: "allocation" | "phased" | "binding";
  planId: string;
  planName: string;
  allocationId: string;
  productName: string;
  pot: string;
  lost: number;
  remaining: number;
  entryId?: string;
  installments?: number;
  frequency?: string;
  startDate?: string;
  note?: string;
};

/** Compare the actual reconciliation output, never infer losses from a changed year.
 * No mutation, rounding, transfers or second reconciliation policy. */
export function needTermLosses(
  advisory: AdvisoryData,
  before: StructurePlan[],
  after: StructurePlan[],
  referenceDate: string,
): NeedTermLoss[] {
  const losses: NeedTermLoss[] = [];
  for (const plan of before) {
    const next = after.find((candidate) => candidate.id === plan.id);
    if (!next) throw new Error("Planvariante kann nicht zuverlässig verglichen werden.");
    const pots = capitalPots(advisory, plan.total, referenceDate);
    const potLabel = (id: string) => {
      const pot = pots.find((candidate) => candidate.id === id);
      if (!pot) throw new Error(`Kapitaltopf ${id} ist nicht eindeutig auflösbar. Bitte den Fall prüfen.`);
      return pot.kind === "year" ? `Zieljahr ${pot.year}` : pot.label;
    };
    for (const allocation of plan.allocations) {
      const kept = next.allocations.find((candidate) => candidate.id === allocation.id);
      const previous = allocationCapitalPotAmounts(allocation);
      const remaining = kept ? allocationCapitalPotAmounts(kept) : {};
      let coveredLoss = 0;
      const removedZeroBindings = new Set<string>();
      const push = (pot: string, lost: number, kind: "allocation" | "binding" = "allocation") => {
        losses.push({ kind, planId: plan.id, planName: plan.name,
          allocationId: allocation.id, productName: allocation.productName, pot, lost,
          remaining: kept?.amount ?? 0 });
      };
      for (const [potId, amount] of Object.entries(previous)) {
        const lost = (amount ?? 0) - (remaining[potId as keyof typeof remaining] ?? 0);
        if (lost > 0) { coveredLoss += lost; push(potLabel(potId), lost); }
        // Presence, not the numeric difference, carries explicit zero-binding information.
        // Inspect stored maps so missing/empty-map fallbacks do not invent new losses.
        if (amount === 0 && Object.hasOwn(allocation.capitalPotAmounts ?? {}, potId) &&
          !Object.hasOwn(kept?.capitalPotAmounts ?? {}, potId)) {
          removedZeroBindings.add(potId);
          push(potLabel(potId), 0, "binding");
        }
      }
      const unassignedLoss = allocation.amount - (kept?.amount ?? 0) - coveredLoss;
      if (unassignedLoss > 0) push("Nicht zugeordneter Anteil derselben Produktzuordnung", unassignedLoss);
      // Even a zero-valued explicit binding must not disappear unannounced.
      if (allocation.capitalPotId && !kept?.capitalPotId && coveredLoss === 0 && unassignedLoss <= 0 &&
        !removedZeroBindings.has(allocation.capitalPotId))
        push(potLabel(allocation.capitalPotId), 0, "binding");
    }
    for (const entry of plan.investmentPlans || []) {
      if (entry.type !== "phased") continue;
      const kept = next.investmentPlans.find((candidate) => candidate.id === entry.id && candidate.type === "phased");
      const oldAmount = phasedEntryAmounts(plan, entry).stagedAmount;
      const newAmount = kept?.type === "phased" ? phasedEntryAmounts(next, kept).stagedAmount : 0;
      if (!kept || newAmount < oldAmount) {
        const allocation = plan.allocations.find((candidate) => candidate.id === entry.allocationId);
        if (!allocation) throw new Error(`Einstiegsplan ${entry.id}: Produktzuordnung fehlt. Änderung kann nicht bestätigt werden.`);
        losses.push({ kind: "phased", planId: plan.id, planName: plan.name,
          allocationId: allocation.id, productName: allocation.productName, pot: potLabel(entry.capitalPotId),
          lost: oldAmount - newAmount, remaining: newAmount, entryId: entry.id,
          installments: entry.installments, frequency: entry.frequency, startDate: entry.startDate, note: entry.note });
      }
    }
  }
  if (losses.some((loss) => !loss.planName.trim() || !loss.productName.trim() ||
    !Number.isFinite(loss.lost) || !Number.isFinite(loss.remaining)))
    throw new Error("Betroffene Pläne, Produkte oder Beträge sind nicht vollständig bestimmbar. Bitte den Fall prüfen.");
  return losses;
}
