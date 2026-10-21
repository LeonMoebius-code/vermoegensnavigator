import { localDateParts } from "../planning/calendar";
import { validPhasedInstallments, legacyPhasedInstallments } from "../planning/installment-validation";

/** Financial and phased-count trust boundary. Optional depot/Bond metadata and historical
 * version snapshots keep their separate validation/migration contracts. */
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const finiteNonnegativeAmount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

// Only fields already explicitly converted by the pre-schema-10 migrator may
// accept legacy strings/defaults. Present corrupt values are never zeroed here.
const migratableAmount = (value: unknown): boolean =>
  value === undefined || finiteNonnegativeAmount(value) ||
  (typeof value === "string" && value.trim() !== "" &&
    finiteNonnegativeAmount(Number(value)));

const optionalAmount = (value: unknown) =>
  value === undefined || finiteNonnegativeAmount(value);

function amountMapping(value: unknown, legacyBuckets = false): boolean {
  return value === undefined || (record(value) && Object.values(value).every(
    (amount) => legacyBuckets
      ? amount !== undefined && migratableAmount(amount)
      : finiteNonnegativeAmount(amount),
  ));
}

/** Validate untouched inputs before graph calculations, depot-value derivation
 * or JSON cloning can hide the original error. No rounding, mutation or repair.
 * sourceSchemaVersion selects only documented legacy conversion boundaries. */
export function validCaseFinancialInputs(value: unknown, sourceSchemaVersion = 11): boolean {
  if (!record(value) || !record(value.advisory) || !Array.isArray(value.plans)) return false;
  const current = sourceSchemaVersion >= 10;
  const advisory = value.advisory;
  if (![advisory.liquidAssets, advisory.depotValue, advisory.otherAssets, advisory.reserve]
    .every(finiteNonnegativeAmount) || !Array.isArray(advisory.needs) ||
    advisory.needs.some((need) => !record(need) || !finiteNonnegativeAmount(need.amount) ||
      // Match the calendar's existing explicit-date priority. Only a duration
      // actually used for relative calculation is mandatory; never coerce it.
      (!(typeof need.dueDate === "string" && localDateParts(need.dueDate)) &&
        !finiteNonnegativeAmount(need.years)))) return false;

  if (value.depot !== undefined && (!Array.isArray(value.depot) || value.depot.some((holding) =>
    !record(holding) || !finiteNonnegativeAmount(holding.value) ||
    !(current ? finiteNonnegativeAmount(holding.plannedSale) : migratableAmount(holding.plannedSale))))) return false;
  if (value.savingsGoals !== undefined && (!Array.isArray(value.savingsGoals) ||
    value.savingsGoals.some((goal) => !record(goal) ||
      !(current ? finiteNonnegativeAmount(goal.targetAmount) : migratableAmount(goal.targetAmount))))) return false;
  if (value.vvFilters !== undefined && (!record(value.vvFilters) || !optionalAmount(value.vvFilters.amount))) return false;

  for (const plan of value.plans) {
    if (!record(plan) || !finiteNonnegativeAmount(plan.total) || !optionalAmount(plan.modelAmount)) return false;
    // Missing old collections are an existing migration, malformed present ones
    // are not a license to silently discard financial entries.
    if (plan.allocations === undefined ? current : !Array.isArray(plan.allocations)) return false;
    for (const allocation of (plan.allocations ?? []) as unknown[]) {
      if (!record(allocation) || !finiteNonnegativeAmount(allocation.amount) ||
        !optionalAmount(allocation.capitalPotReviewAmount) ||
        !amountMapping(allocation.capitalPotAmounts) ||
        !amountMapping(allocation.bucketAmounts, !current)) return false;
    }
    if (plan.investmentPlans === undefined ? current : !Array.isArray(plan.investmentPlans)) return false;
    for (const entry of (plan.investmentPlans ?? []) as unknown[]) {
      if (!record(entry)) return false;
      if (entry.type === "savings") {
        const amount = current || sourceSchemaVersion >= 8 ? entry.contributionAmount : entry.installmentAmount;
        if (!(current ? finiteNonnegativeAmount(amount) : migratableAmount(amount))) return false;
      } else if (entry.type === "phased") {
        if (current ? !validPhasedInstallments(entry.installments)
          : legacyPhasedInstallments(entry.installments) === null) return false;
        const amount = current || sourceSchemaVersion >= 8 ? entry.stagedValue : entry.installmentAmount;
        if (!(current ? finiteNonnegativeAmount(amount) : migratableAmount(amount))) return false;
        if ((current || sourceSchemaVersion >= 8) && entry.stagedMode === "percent" && Number(amount) > 100) return false;
      }
    }
  }
  return true;
}
