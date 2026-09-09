import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  annualSavingsContribution,
  addLocalMonthsClamped,
  capitalPotDeadline,
  capitalPots,
  createCase,
  defaultPhasedEntryInstallments,
  duplicateStructurePlan,
  nextImplementationDate,
  nextPlanCopyName,
  normalizeImportedCase,
  parsePhasedEntryNumericDraft,
  phasedEntryAmounts,
  phasedEntryLastDate,
  phasedEntryScheduleValidation,
  plannerIstHoldingValue,
  plannerPlanHoldingValue,
  planningShortfall,
  reconcilePlanCapitalPots,
  type PhasedEntryPlan,
  type PlannerAllocation,
  type SavingsPlan,
} from "../app/case-model";

const base = createCase();
base.advisory.liquidAssets = 150_000;
base.advisory.scope = "private";
const allocation: PlannerAllocation = {
  id: "allocation-a",
  productId: "zinsfix-index",
  productName: "ZinsFix Index",
  bucketId: "year10plus",
  amount: 150_000,
  solutionId: "mixed",
  source: "product",
  allocationMode: "manual",
  capitalPotId: "strategic",
  capitalPotAmounts: { strategic: 100_000, "year-2034": 50_000 },
};
base.advisory.needs = [
  { id: 1, purpose: "Bedarf", amount: 50_000, years: 8, dueDate: "2034-09-01" },
];
base.plans[0].total = 150_000;
base.plans[0].allocations = [allocation];

const percentEntry: PhasedEntryPlan = {
  id: "entry-percent",
  type: "phased",
  allocationId: allocation.id,
  capitalPotId: "strategic",
  stagedMode: "percent",
  stagedValue: 60,
  installments: 6,
  frequency: "monthly",
  startDate: "2026-09-15",
  note: "",
};
let amounts = phasedEntryAmounts(base.plans[0], percentEntry);
assert.equal(amounts.targetAmount, 100_000);
assert.equal(amounts.stagedAmount, 60_000);
assert.equal(amounts.immediateAmount, 40_000);
assert.deepEqual(amounts.installmentAmounts, Array(6).fill(10_000));

base.plans[0].allocations[0].capitalPotAmounts = { strategic: 150_000 };
base.plans[0].allocations[0].amount = 150_000;
amounts = phasedEntryAmounts(base.plans[0], percentEntry);
assert.equal(amounts.stagedAmount, 90_000);
assert.equal(amounts.immediateAmount, 60_000);

const amountEntry: PhasedEntryPlan = {
  ...percentEntry,
  id: "entry-amount",
  stagedMode: "amount",
  stagedValue: 60_000,
};
amounts = phasedEntryAmounts(base.plans[0], amountEntry);
assert.equal(amounts.stagedAmount, 60_000);
assert.equal(amounts.immediateAmount, 90_000);
base.plans[0].allocations[0].capitalPotAmounts = { strategic: 50_000 };
amounts = phasedEntryAmounts(base.plans[0], amountEntry);
assert.equal(amounts.stagedAmount, 60_000);
assert.equal(amounts.invalid, true);

const rounded = phasedEntryAmounts(base.plans[0], {
  ...amountEntry,
  stagedValue: 100,
  installments: 3,
});
assert.equal(rounded.installmentAmounts.reduce((sum, value) => sum + value, 0), 100);
assert.deepEqual(rounded.installmentAmounts, [33.33, 33.33, 33.34]);
assert.equal(rounded.hasRoundingAdjustment, true);

assert.equal(nextImplementationDate("2026-09-07"), "2026-09-15");
assert.equal(nextImplementationDate("2026-09-20"), "2026-10-01");

assert.equal(phasedEntryLastDate({ startDate: "2026-09-15", installments: 12, frequency: "monthly" }), "2027-08-15");
assert.equal(phasedEntryLastDate({ startDate: "2026-09-15", installments: 4, frequency: "quarterly" }), "2027-06-15");
assert.equal(phasedEntryLastDate({ startDate: "2026-09-15", installments: 3, frequency: "semiannual" }), "2027-09-15");
assert.equal(phasedEntryLastDate({ startDate: "2026-09-15", installments: 2, frequency: "annual" }), "2027-09-15");
assert.equal(addLocalMonthsClamped("2027-01-31", 1), "2027-02-28");
assert.equal(addLocalMonthsClamped("2028-01-31", 1), "2028-02-29");

const exactDeadlinePot = capitalPots({ ...base.advisory, needs: [{ id: 2, purpose: "Termin", amount: 1, years: 1, dueDate: "2027-08-15" }] }, 1, "2026-09-01")[0];
assert.equal(capitalPotDeadline(exactDeadlinePot, "2026-09-01"), "2027-08-15");
assert.equal(phasedEntryScheduleValidation({ startDate: "2026-09-15", installments: 12, frequency: "monthly" }, exactDeadlinePot, "2026-09-01").valid, true);
assert.equal(phasedEntryScheduleValidation({ startDate: "2026-09-15", installments: 13, frequency: "monthly" }, exactDeadlinePot, "2026-09-01").valid, false);
assert.equal(phasedEntryScheduleValidation({ startDate: "2027-08-15", installments: 1, frequency: "monthly" }, exactDeadlinePot, "2026-09-01").valid, true);
const narrowPot = capitalPots({ ...base.advisory, needs: [{ id: 3, purpose: "Nah", amount: 1, years: 1, dueDate: "2027-02-01" }] }, 1, "2026-09-01")[0];
assert.equal(defaultPhasedEntryInstallments(narrowPot, "2026-09-15", "2026-09-01"), 5);
const strategicPot = capitalPots({ ...base.advisory, needs: [] }, 100, "2026-09-01")[0];
assert.equal(capitalPotDeadline(strategicPot, "2026-09-01"), null);
assert.equal(defaultPhasedEntryInstallments(strategicPot, "2026-09-15", "2026-09-01"), 12);
const relativeDeadlinePot = capitalPots({ ...base.advisory, needs: [{ id: 4, purpose: "Relativ", amount: 1, years: 2 }] }, 1, "2026-09-01")[0];
assert.equal(capitalPotDeadline(relativeDeadlinePot, "2026-09-01"), "2028-09-01");

assert.deepEqual(parsePhasedEntryNumericDraft("", "installments"), { status: "empty" });
assert.deepEqual(parsePhasedEntryNumericDraft("6", "installments"), { status: "valid", value: 6 });
assert.equal(parsePhasedEntryNumericDraft("0", "installments").status, "invalid");
assert.deepEqual(parsePhasedEntryNumericDraft("60,5", "percent"), { status: "valid", value: 60.5 });
assert.deepEqual(parsePhasedEntryNumericDraft("60.000", "amount"), { status: "valid", value: 60_000 });

assert.equal(nextPlanCopyName("Plan A – Ausgangsstruktur", ["Plan A – Ausgangsstruktur"]), "Plan A – Ausgangsstruktur – Kopie");
assert.equal(nextPlanCopyName("Plan A – Ausgangsstruktur", ["Plan A – Ausgangsstruktur", "Plan A – Ausgangsstruktur – Kopie"]), "Plan A – Ausgangsstruktur – Kopie 2");
assert.equal(nextPlanCopyName("Plan A – Ausgangsstruktur – Kopie 2", ["Plan A – Ausgangsstruktur", "Plan A – Ausgangsstruktur – Kopie", "Plan A – Ausgangsstruktur – Kopie 2"]), "Plan A – Ausgangsstruktur – Kopie 3");

const savings: SavingsPlan = {
  id: "savings-a",
  type: "savings",
  productId: "uniglobal",
  productName: "UniGlobal",
  contributionAmount: 500,
  frequency: "monthly",
  startDate: "2026-10-01",
  targetRef: { kind: "need", id: 1 },
  note: "",
};
assert.equal(annualSavingsContribution(savings), 6_000);

const capitalBeforeGoal = capitalPots(base.advisory, base.plans[0].total, "2026-09-07");
const planAmountBeforeGoal = base.plans[0].total;
const shortfallBeforeGoal = planningShortfall(base.advisory, base.plans[0].total);
base.savingsGoals = [{
  id: "goal-study",
  name: "Studium Kind",
  targetAmount: 100_000,
  targetYear: 2038,
}];
assert.equal(base.plans[0].total, planAmountBeforeGoal);
assert.deepEqual(capitalPots(base.advisory, base.plans[0].total, "2026-09-07"), capitalBeforeGoal);
assert.equal(planningShortfall(base.advisory, base.plans[0].total), shortfallBeforeGoal);

base.plans[0].allocations[0].amount = 150_000;
base.plans[0].allocations[0].capitalPotAmounts = {
  strategic: 100_000,
  "year-2034": 50_000,
};
const yearEntry: PhasedEntryPlan = {
  ...amountEntry,
  id: "entry-year",
  capitalPotId: "year-2034",
};
base.plans[0].investmentPlans = [yearEntry, savings];
const duplicate = duplicateStructurePlan(base.plans[0]);
assert.notEqual(duplicate.allocations[0].id, allocation.id);
assert.notEqual(duplicate.investmentPlans[0].id, yearEntry.id);
assert.equal(duplicate.investmentPlans[0].type, "phased");
if (duplicate.investmentPlans[0].type === "phased") {
  assert.equal(duplicate.investmentPlans[0].allocationId, duplicate.allocations[0].id);
}
assert.notEqual(duplicate.investmentPlans[1].id, savings.id);

const twoPairPlan = {
  ...base.plans[0],
  investmentPlans: [
    percentEntry,
    { ...percentEntry, id: "entry-second-pot", capitalPotId: "year-2034" as const, stagedValue: 40 },
  ],
};
const reconciledPairs = reconcilePlanCapitalPots(
  base.advisory,
  twoPairPlan,
  "2026-09-07",
  base.savingsGoals,
);
assert.equal(reconciledPairs.investmentPlans.length, 2);
const pairAmounts = reconciledPairs.investmentPlans
  .filter((entry) => entry.type === "phased")
  .map((entry) => phasedEntryAmounts(reconciledPairs, entry).stagedAmount)
  .sort((a, b) => a - b);
assert.deepEqual(pairAmounts, [20_000, 60_000]);

const reconciled = reconcilePlanCapitalPots(
  { ...base.advisory, needs: [] },
  base.plans[0],
  "2026-09-07",
  [],
);
assert.equal(reconciled.investmentPlans.some((entry) => entry.type === "phased"), false);
assert.equal(reconciled.allocations[0].amount, 100_000);
assert.deepEqual(reconciled.allocations[0].capitalPotAmounts, { strategic: 100_000 });
const reconciledSavings = reconciled.investmentPlans.find((entry) => entry.type === "savings");
assert.ok(reconciledSavings && reconciledSavings.type === "savings");
assert.equal(reconciledSavings.targetRef, undefined);

const allocationDeleted = reconcilePlanCapitalPots(
  base.advisory,
  { ...base.plans[0], allocations: [] },
  "2026-09-07",
  base.savingsGoals,
);
assert.equal(allocationDeleted.investmentPlans.some((entry) => entry.type === "phased"), false);
assert.equal(allocationDeleted.investmentPlans.some((entry) => entry.type === "savings"), true);

const holding = {
  id: "holding-a",
  name: "Bestand",
  value: 100_000,
  assetClass: "Substanzwerte" as const,
  region: "Weltweit",
  risk: 3,
  plannedSale: 25_000,
  note: "",
};
const depotPlan = { ...base.plans[0], depotHoldingIds: [holding.id] };
assert.equal(plannerIstHoldingValue({ ...depotPlan, depotMode: "none" }, holding), 0);
assert.equal(plannerIstHoldingValue({ ...depotPlan, depotMode: "compare" }, holding), 100_000);
assert.equal(plannerPlanHoldingValue({ ...depotPlan, depotMode: "compare" }, holding), 0);
assert.equal(plannerPlanHoldingValue({ ...depotPlan, depotMode: "retain" }, holding), 100_000);
assert.equal(plannerPlanHoldingValue({ ...depotPlan, depotMode: "afterSales" }, holding), 75_000);

const migrationBase = createCase();
migrationBase.advisory.scope = "private";
migrationBase.advisory.liquidAssets = 100_000;
migrationBase.plans[0].total = 100_000;
migrationBase.plans[0].allocations = [{
  ...allocation,
  id: "legacy-allocation",
  amount: 100_000,
  allocationMode: "single",
  capitalPotAmounts: { strategic: 100_000 },
}];
const legacy = JSON.parse(JSON.stringify(migrationBase));
legacy.schemaVersion = 7;
legacy.savingsGoals = undefined;
legacy.plans[0].investmentPlans = [
  {
    id: "legacy-saving",
    name: "Sparen",
    type: "savings",
    productId: "uniglobal",
    productName: "UniGlobal",
    bucketId: "year10plus",
    capitalPotId: "strategic",
    installmentAmount: 500,
    installments: 10_000_000,
    frequency: "monthly",
    startDate: "2026-10-01",
    note: "",
  },
  {
    id: "legacy-phased",
    type: "phased",
    productId: "zinsfix-index",
    productName: "ZinsFix Index",
    bucketId: "year10plus",
    capitalPotId: "strategic",
    installmentAmount: 10_000,
    installments: 6,
    frequency: "monthly",
    startDate: "2026-09-15",
    note: "",
  },
];
const migrated = normalizeImportedCase(legacy, false);
assert.ok(migrated);
assert.equal(migrated.schemaVersion, 9);
assert.deepEqual(migrated.savingsGoals, []);
const migratedSaving = migrated.plans[0].investmentPlans.find((entry) => entry.type === "savings");
assert.ok(migratedSaving && migratedSaving.type === "savings");
assert.equal(migratedSaving.contributionAmount, 500);
assert.equal("installments" in migratedSaving, false);
const migratedPhased = migrated.plans[0].investmentPlans.find((entry) => entry.type === "phased");
assert.ok(migratedPhased && migratedPhased.type === "phased");
assert.equal(migratedPhased.allocationId, "legacy-allocation");
assert.equal(migratedPhased.stagedValue, 60_000);

legacy.plans[0].allocations.push({
  ...legacy.plans[0].allocations[0],
  id: "legacy-allocation-duplicate",
});
const ambiguous = normalizeImportedCase(legacy, false);
assert.ok(ambiguous);
assert.equal(ambiguous.plans[0].investmentPlans.some((entry) => entry.type === "phased"), false);

const schemaSix = JSON.parse(JSON.stringify(legacy));
schemaSix.schemaVersion = 6;
schemaSix.plans[0].depotMode = "retain";
schemaSix.plans[0].depotHoldingIds = [];
const migratedSchemaSix = normalizeImportedCase(schemaSix, false);
assert.ok(migratedSchemaSix);
assert.equal(migratedSchemaSix.schemaVersion, 9);
assert.equal(migratedSchemaSix.plans[0].depotSelectionInitialized, true);

const plannerSource = readFileSync("app/page.tsx", "utf8");
assert.match(plannerSource, /entryDrafts\[pairKey\]\?\.installments/);
assert.match(plannerSource, /Letzte Rate/);
assert.match(plannerSource, /Sparziel: \$\{goal\.name\}/);
assert.match(plannerSource, /Sie reservieren kein heute vorhandenes Kapital und erzeugen keinen Kapitaltopf/);

console.log("4B model verification passed");
