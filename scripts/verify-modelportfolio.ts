import assert from "node:assert/strict";
import {
  allocationAmountInCapitalPot,
  capitalPots,
  createCase,
  createModelPortfolioVariant,
  modelPortfolioDefaultAmount,
  PlannerAllocation,
  replaceStrategicPlanAllocations,
  StructurePlan,
  supplementPlanWithModelPortfolio,
} from "../app/case-model";

let assertions = 0;
const equal = (actual: unknown, expected: unknown, message: string) => {
  assertions += 1;
  assert.equal(actual, expected, message);
};
const check = (condition: unknown, message: string) => {
  assertions += 1;
  assert.ok(condition, message);
};

const item = createCase();
item.advisory = {
  ...item.advisory,
  liquidAssets: 1_100_000,
  reserve: 240_000,
  needs: [
    { id: 1, purpose: "Bedarf 2029", amount: 300_000, years: 3, dueDate: "2029-09-16" },
    { id: 2, purpose: "Bedarf 2034", amount: 200_000, years: 8, dueDate: "2034-09-16" },
  ],
};
const pots = capitalPots(item.advisory, 1_100_000, "2026-09-16");
const reservePot = pots.find((pot) => pot.id === "reserve")!;
const yearPot = pots.find((pot) => pot.id === "year-2029")!;
const strategicPot = pots.find((pot) => pot.id === "strategic")!;

const allocation = (
  id: string,
  amount: number,
  pot: typeof reservePot,
): PlannerAllocation => ({
  id,
  productId: `product-${id}`,
  productName: `Produkt ${id}`,
  bucketId: pot.legacyBucketId,
  amount,
  solutionId: "funds",
  source: "product",
  allocationMode: "single",
  capitalPotId: pot.id,
  capitalPotAmounts: { [pot.id]: amount },
  bucketAmounts: { [pot.legacyBucketId]: amount },
});

const basePlan: StructurePlan = {
  ...item.plans[0],
  total: 1_100_000,
  allocations: [
    allocation("reserve", 100_000, reservePot),
    allocation("year", 50_000, yearPot),
    allocation("strategic", 210_000, strategicPot),
  ],
  investmentPlans: [
    {
      id: "phase-reserve",
      type: "phased",
      allocationId: "reserve",
      capitalPotId: reservePot.id,
      stagedMode: "percent",
      stagedValue: 50,
      installments: 2,
      frequency: "monthly",
      startDate: "2026-10-01",
      note: "",
    },
    {
      id: "phase-year",
      type: "phased",
      allocationId: "year",
      capitalPotId: yearPot.id,
      stagedMode: "percent",
      stagedValue: 50,
      installments: 2,
      frequency: "monthly",
      startDate: "2026-10-01",
      note: "",
    },
    {
      id: "phase-strategic",
      type: "phased",
      allocationId: "strategic",
      capitalPotId: strategicPot.id,
      stagedMode: "percent",
      stagedValue: 50,
      installments: 2,
      frequency: "monthly",
      startDate: "2026-10-01",
      note: "",
    },
  ],
};

const modelAllocations = (amount: number): PlannerAllocation[] => [
  {
    ...allocation("model-a", Math.round(amount * 0.6), strategicPot),
    source: "model",
    modelId: "rb3",
  },
  {
    ...allocation("model-b", amount - Math.round(amount * 0.6), strategicPot),
    source: "model",
    modelId: "rb3",
  },
];

equal(
  modelPortfolioDefaultAmount("supplement", basePlan, pots),
  150_000,
  "1: Ergänzen verwendet den strategischen Restbetrag 360.000 - 210.000",
);
const supplemented = supplementPlanWithModelPortfolio(
  basePlan,
  modelAllocations(150_000),
  pots,
);
equal(
  supplemented.allocations.slice(0, 3).map((entry) => entry.id).join(","),
  "reserve,year,strategic",
  "2: Ergänzen erhält alle bestehenden Allokationen",
);
equal(
  supplemented.allocations.slice(3).reduce((sum, entry) => sum + entry.amount, 0),
  150_000,
  "2: Ergänzen legt ausschließlich den gewählten Betrag an",
);

const overAllocatedPlan = {
  ...basePlan,
  allocations: [
    ...basePlan.allocations.slice(0, 2),
    allocation("strategic-over", 400_000, strategicPot),
  ],
};
equal(
  modelPortfolioDefaultAmount("supplement", overAllocatedPlan, pots),
  0,
  "3: negativer strategischer Restbetrag wird auf null begrenzt",
);
equal(
  supplementPlanWithModelPortfolio(overAllocatedPlan, modelAllocations(0), pots).allocations.length,
  overAllocatedPlan.allocations.length,
  "3: Nullbetrag erzeugt keine sinnlosen Modellallokationen",
);
equal(
  supplementPlanWithModelPortfolio(basePlan, modelAllocations(500_000), pots)
    .allocations.slice(3).reduce((sum, entry) => sum + entry.amount, 0),
  500_000,
  "4: bewusst gewählte Überplanung wird nicht still umgerechnet",
);

const replaced = replaceStrategicPlanAllocations(
  basePlan,
  modelAllocations(360_000),
  pots,
);
check(
  !replaced.allocations.some((entry) => entry.id === "strategic"),
  "5: Ersetzen entfernt die alte strategische Allokation",
);
check(
  replaced.allocations.some((entry) => entry.id === "reserve"),
  "6: Reserve-Allokation bleibt erhalten",
);
check(
  replaced.allocations.some((entry) => entry.id === "year"),
  "7: Jahres-/Bedarfstopf-Allokation bleibt erhalten",
);
equal(
  replaced.investmentPlans
    .filter((entry) => entry.type === "phased")
    .map((entry) => entry.id)
    .sort()
    .join(","),
  "phase-reserve,phase-year",
  "8/9: gültige nicht-strategische Umsetzungsbezüge bleiben, tote strategische verschwinden",
);
check(
  replaced.investmentPlans.every(
    (entry) =>
      entry.type === "savings" ||
      replaced.allocations.some(
        (candidate) =>
          candidate.id === entry.allocationId &&
          allocationAmountInCapitalPot(candidate, entry.capitalPotId) > 0,
      ),
  ),
  "9: Ersetzen hinterlässt keine tote allocationId-Referenz",
);

const originalSnapshot = JSON.stringify(basePlan);
const variant = createModelPortfolioVariant(
  basePlan,
  modelAllocations(360_000),
  pots,
  "RB 3 – strategische Variante",
);
equal(JSON.stringify(basePlan), originalSnapshot, "10: Erzeugen der Variante verändert den Ursprungsplan nicht");
variant.allocations[0].amount += 1;
equal(JSON.stringify(basePlan), originalSnapshot, "10: spätere Variantenbearbeitung verändert den Ursprungsplan nicht");
const variantReserve = variant.allocations.find((entry) => entry.productId === "product-reserve")!;
const variantYear = variant.allocations.find((entry) => entry.productId === "product-year")!;
check(
  variantReserve.amount === 100_001 && variantYear.amount === 50_000,
  "11: nicht-strategische Planung wird vollständig in die Variante übernommen",
);
check(
  variantReserve.id !== "reserve" && variantYear.id !== "year",
  "12: Variantenallokationen erhalten neue IDs",
);
const originalAllocationIds = new Set(basePlan.allocations.map((entry) => entry.id));
check(
  variant.investmentPlans.every(
    (entry) =>
      entry.type === "savings" ||
      (!originalAllocationIds.has(entry.allocationId) &&
        variant.allocations.some((allocation) => allocation.id === entry.allocationId)),
  ),
  "12: Umsetzungsreferenzen sind auf neue Varianten-IDs remappt",
);

console.log(`Modellportfolio-Regressionsprüfung erfolgreich: ${assertions} Assertions.`);
