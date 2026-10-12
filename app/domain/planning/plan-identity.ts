import { uid, iso, clone } from "../case/runtime";
import { capitalPots } from "./capital-pots";
import { allocationAmountInCapitalPot } from "./allocations";
import type { StructurePlan, InvestmentPlan } from "./contracts";
import type { AdvisoryCase } from "../case/contracts";

export function createPlan(name: string, total: number): StructurePlan {
  const now = iso();
  return {
    id: uid("plan"),
    name,
    total,
    capitalMode: "linked",
    allocations: [],
    investmentPlans: [],
    preferred: false,
    notes: "",
    depotMode: "none",
    depotHoldingIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateStructurePlan(
  plan: StructurePlan,
  name = `${plan.name} – Kopie`,
): StructurePlan {
  const now = iso();
  const allocationIds = new Map<string, string>();
  const allocations = plan.allocations.map((allocation) => {
    const id = uid("allocation");
    allocationIds.set(allocation.id, id);
    return { ...clone(allocation), id };
  });
  const investmentPlans = plan.investmentPlans.flatMap<InvestmentPlan>((entry) => {
    if (entry.type === "savings")
      return [{ ...clone(entry), id: uid("investment") }];
    const allocationId = allocationIds.get(entry.allocationId);
    return allocationId
      ? [{ ...clone(entry), id: uid("investment"), allocationId }]
      : [];
  });
  return {
    ...clone(plan),
    id: uid("plan"),
    name,
    preferred: false,
    allocations,
    investmentPlans,
    createdAt: now,
    updatedAt: now,
  };
}

export function nextPlanCopyName(sourceName: string, existingNames: string[]) {
  const baseName = sourceName.replace(/(?:\s+–\s+Kopie(?:\s+\d+)?)+$/i, "").trim();
  const used = new Set(existingNames.map((name) => name.trim()));
  const first = `${baseName} – Kopie`;
  if (!used.has(first)) return first;
  let index = 2;
  while (used.has(`${baseName} – Kopie ${index}`)) index += 1;
  return `${baseName} – Kopie ${index}`;
}

export function getActiveStructurePlan(item: Pick<AdvisoryCase, "plans" | "activePlanId">): StructurePlan {
  const matches = item.plans.filter((plan) => plan.id === item.activePlanId);
  if (!validIdentity(item.activePlanId) || matches.length !== 1)
    throw new Error("Die aktive Planvariante ist ungültig. Es wird keine Ersatzvariante gewählt.");
  return matches[0];
}

export function getPreferredStructurePlan(plans: StructurePlan[]): StructurePlan | undefined {
  const preferred = plans.filter((plan) => plan.preferred);
  if (preferred.length > 1) throw new Error("Mehrere bevorzugte Planvarianten sind ungültig.");
  return preferred[0];
}

export function setActiveStructurePlan(item: AdvisoryCase, id: string): AdvisoryCase {
  getActiveStructurePlan(item);
  if (!validIdentity(id) || item.plans.filter((plan) => plan.id === id).length !== 1) return item;
  return { ...item, activePlanId: id };
}

export function setPreferredStructurePlan(item: AdvisoryCase, id: string): AdvisoryCase {
  if (!validIdentity(id) || item.plans.filter((plan) => plan.id === id).length !== 1) return item;
  return { ...item, plans: item.plans.map((plan) => ({ ...plan, preferred: plan.id === id })) };
}

/** Append only a valid independent variant; make it active without selecting a target. */
export function appendStructurePlan(item: AdvisoryCase, plan: StructurePlan): AdvisoryCase {
  const next = { ...item, plans: [...item.plans, { ...plan, preferred: false }], activePlanId: plan.id };
  return validCurrentPlanGraph(next) ? next : item;
}

export function deleteStructurePlan(item: AdvisoryCase, id: string): AdvisoryCase {
  getActiveStructurePlan(item);
  const index = item.plans.findIndex((plan) => plan.id === id);
  if (index < 0 || item.plans.length === 1) return item;
  const successor = item.plans[index + 1] ?? item.plans[index - 1];
  return { ...item, plans: item.plans.filter((plan) => plan.id !== id),
    activePlanId: item.activePlanId === id ? successor.id : item.activePlanId };
}

const validIdentity = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/** Validate the current persisted graph BEFORE any lossy legacy reconciliation.
 * Historical snapshot contents are deliberately opaque until actual restore. */
export function validCurrentPlanGraph(item: Partial<AdvisoryCase>): boolean {
  const uniqueIds = (entries: { id: string }[]) => entries.every((entry) =>
    entry && validIdentity(entry.id)) && new Set(entries.map((entry) => entry.id)).size === entries.length;
  if (!Array.isArray(item.plans) || !item.plans.length || !uniqueIds(item.plans) ||
    !validIdentity(item.activePlanId) || item.plans.filter((plan) => plan.id === item.activePlanId).length !== 1 ||
    item.plans.some((plan) => typeof plan.preferred !== "boolean") ||
    item.plans.filter((plan) => plan.preferred).length > 1 ||
    !Array.isArray(item.advisory?.needs) ||
    (item.versions !== undefined && (!Array.isArray(item.versions) || !uniqueIds(item.versions)))) return false;
  const holdingIds = new Set((item.depot ?? []).map((holding) => holding?.id));
  const allocationIds = new Set<string>();
  const investmentIds = new Set<string>();
  for (const plan of item.plans) {
    if (!Array.isArray(plan.allocations) || !Array.isArray(plan.investmentPlans) ||
      !Array.isArray(plan.depotHoldingIds) || !uniqueIds(plan.allocations) || !uniqueIds(plan.investmentPlans) ||
      plan.depotHoldingIds.some((id) => !validIdentity(id) || !holdingIds.has(id)) ||
      new Set(plan.depotHoldingIds).size !== plan.depotHoldingIds.length) return false;
    const potIds = new Set<string>(capitalPots(item.advisory, plan.total, item.createdAt).map((pot) => pot.id));
    for (const allocation of plan.allocations) {
      if (allocationIds.has(allocation.id)) return false;
      allocationIds.add(allocation.id);
      if (allocation.capitalPotId !== undefined && !potIds.has(allocation.capitalPotId)) return false;
      if (allocation.capitalPotAmounts !== undefined &&
        (!allocation.capitalPotAmounts || typeof allocation.capitalPotAmounts !== "object" ||
          Array.isArray(allocation.capitalPotAmounts) ||
          Object.keys(allocation.capitalPotAmounts).some((id) => !potIds.has(id)))) return false;
    }
    for (const entry of plan.investmentPlans) {
      if (investmentIds.has(entry.id)) return false;
      investmentIds.add(entry.id);
      if (entry.type === "phased") {
        // Allocation identity is plan-local even though IDs are unique case-wide.
        const allocation = plan.allocations.find((candidate) => candidate.id === entry.allocationId);
        if (!allocation || !potIds.has(entry.capitalPotId) ||
          allocationAmountInCapitalPot(allocation, entry.capitalPotId) <= 0) return false;
      } else if (entry.type === "savings") {
        if (entry.targetRef !== undefined) {
          const target = entry.targetRef;
          if (!target || (target.kind === "need"
            ? typeof target.id !== "number" || !Number.isFinite(target.id) ||
              item.advisory.needs.filter((need) => need?.id === target.id).length !== 1
            : target.kind === "savingsGoal"
              ? !validIdentity(target.id) || (item.savingsGoals ?? []).filter((goal) => goal?.id === target.id).length !== 1
              : true)) return false;
        }
      } else return false;
    }
  }
  return true;
}
