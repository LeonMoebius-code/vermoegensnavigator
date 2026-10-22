import { caseSnapshot, normalizeImportedCase, type AdvisoryCase } from "../app/case-model";
import type { PlannerAllocation, PhasedEntryPlan } from "../app/domain/planning/contracts";
import { controlCase, clone } from "./f021-fixtures";

export function f012Case(): AdvisoryCase {
  const c = controlCase("f012-case");
  c.advisory.caseName = "SYNTHETISCH F012 Terminänderung";
  c.advisory.needs = [
    { id: 701, purpose: "Maschine", amount: 30000, years: 1.49, dueDate: "2028-04-15" },
    { id: 702, purpose: "Immobilie", amount: 30000, years: 4, dueDate: "2030-10-15" },
  ];
  const allocation = (id: string, productName: string, amount: number, amounts: PlannerAllocation["capitalPotAmounts"]): PlannerAllocation => ({
    id, productId: "unifavorit-renten", productName, amount, source: "product", solutionId: "mixed",
    bucketId: "year3", capitalPotId: "year-2028", capitalPotAmounts: amounts,
    bucketAmounts: { ...(amounts?.["year-2028"] ? { year3: amounts["year-2028"] } : {}), ...(amounts?.["year-2030"] ? { year5: amounts["year-2030"] } : {}) },
  });
  const entry = (id: string, allocationId: string, capitalPotId: PhasedEntryPlan["capitalPotId"]): PhasedEntryPlan => ({
    id, type: "phased", allocationId, capitalPotId, stagedMode: "percent", stagedValue: 50,
    installments: 4, frequency: "monthly", startDate: "2026-11-01", note: "Synthetischer Einstieg", });
  Object.assign(c.plans[0], { id: "f012-plan-a", name: "Plan Alpha", allocations: [
    allocation("voll", "Produkt Voll", 8000, { "year-2028": 8000 }),
    allocation("geteilt", "Produkt Geteilt", 10000, { "year-2028": 6000.25, "year-2030": 3999.75 }),
  ], investmentPlans: [entry("einstieg-voll", "voll", "year-2028"), entry("einstieg-rest", "geteilt", "year-2030")] });
  const b = clone(c.plans[0]);
  Object.assign(b, { id: "f012-plan-b", name: "Plan Beta", preferred: false,
    allocations: [allocation("beta", "Produkt Beta", 5000, { "year-2028": 5000 })],
    investmentPlans: [entry("einstieg-beta", "beta", "year-2028")] });
  c.plans.push(b); c.activePlanId = c.plans[0].id;
  c.savingsGoals = [{ id: "savings-unchanged", name: "Unverändertes Sparziel", targetAmount: 3000 }];
  c.versions = [{ id: "f012-history", label: "Vor Terminänderung", createdAt: c.createdAt, snapshot: caseSnapshot(c) }];
  if (!normalizeImportedCase(c, false)) throw new Error("F012 fixture violates current case contracts");
  return c;
}
