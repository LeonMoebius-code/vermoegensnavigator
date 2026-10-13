import type {
  StructurePlan,
  PhasedEntryPlan,
  SavingsPlan,
  CapitalPot,
  InvestmentFrequency,
} from "./contracts";
import { allocationAmountInCapitalPot } from "./allocations";
import { validPhasedInstallments } from "./installment-validation";

const toCents = (amount: number) => Math.round((Number(amount) || 0) * 100);

export type PhasedEntryAmounts = {
  targetAmount: number;
  stagedAmount: number;
  immediateAmount: number;
  installmentAmounts: number[];
  installmentAmount: number;
  lastInstallmentAmount: number;
  invalid: boolean;
  hasRoundingAdjustment: boolean;
};

export function phasedEntryAmounts(
  plan: StructurePlan,
  entry: PhasedEntryPlan,
): PhasedEntryAmounts {
  if (!validPhasedInstallments(entry.installments)) return {
    targetAmount: 0,
    stagedAmount: 0,
    immediateAmount: 0,
    installmentAmounts: [],
    installmentAmount: 0,
    lastInstallmentAmount: 0,
    invalid: true,
    hasRoundingAdjustment: false,
  };
  const allocation = plan.allocations.find(
    (candidate) => candidate.id === entry.allocationId,
  );
  const targetCents = toCents(
    allocation
      ? allocationAmountInCapitalPot(allocation, entry.capitalPotId)
      : 0,
  );
  const stagedCents =
    entry.stagedMode === "percent"
      ? Math.round(targetCents * (Number(entry.stagedValue) || 0) / 100)
      : toCents(entry.stagedValue);
  const installments = entry.installments;
  const invalid =
    targetCents <= 0 ||
    stagedCents <= 0 ||
    installments < 1 ||
    (entry.stagedMode === "percent" &&
      (entry.stagedValue < 0 || entry.stagedValue > 100)) ||
    (entry.stagedMode === "amount" && stagedCents > targetCents);
  const baseCents = installments > 0 ? Math.floor(stagedCents / installments) : 0;
  const remainder = installments > 0 ? stagedCents - baseCents * installments : 0;
  const installmentCents = Array.from({ length: installments }, (_, index) =>
    index === installments - 1 ? baseCents + remainder : baseCents,
  );
  return {
    targetAmount: targetCents / 100,
    stagedAmount: stagedCents / 100,
    immediateAmount: Math.max(0, targetCents - stagedCents) / 100,
    installmentAmounts: installmentCents.map((amount) => amount / 100),
    installmentAmount: baseCents / 100,
    lastInstallmentAmount:
      (installmentCents[installmentCents.length - 1] || 0) / 100,
    invalid,
    hasRoundingAdjustment: remainder > 0,
  };
}

const localDateParts = (value: Date | string) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    };
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(year, month - 1, day, 12);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) return null;
  return { year, month, day };
};

const localDateString = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function addLocalMonthsClamped(value: Date | string, months: number) {
  const parts = localDateParts(value);
  if (!parts || !Number.isFinite(months)) return null;
  const target = new Date(parts.year, parts.month - 1 + Math.trunc(months), 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  return localDateString(
    target.getFullYear(),
    target.getMonth() + 1,
    Math.min(parts.day, lastDay),
  );
}

const frequencyMonths: Record<InvestmentFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export function phasedEntryLastDate(entry: Pick<PhasedEntryPlan, "startDate" | "installments" | "frequency">) {
  if (!validPhasedInstallments(entry.installments)) return null;
  const installments = entry.installments;
  return addLocalMonthsClamped(
    entry.startDate,
    (installments - 1) * frequencyMonths[entry.frequency],
  );
}

export function capitalPotDeadline(
  pot: CapitalPot,
  referenceDate: Date | string = new Date(),
) {
  if (pot.kind !== "year") return null;
  if (pot.earliestDueDate && localDateParts(pot.earliestDueDate))
    return pot.earliestDueDate.slice(0, 10);
  return addLocalMonthsClamped(referenceDate, pot.minMonths);
}

export type PhasedEntryScheduleValidation = {
  valid: boolean;
  lastDate: string | null;
  deadline: string | null;
};

export function phasedEntryScheduleValidation(
  entry: Pick<PhasedEntryPlan, "startDate" | "installments" | "frequency">,
  pot: CapitalPot,
  referenceDate: Date | string = new Date(),
): PhasedEntryScheduleValidation {
  const lastDate = phasedEntryLastDate(entry);
  const deadline = capitalPotDeadline(pot, referenceDate);
  return {
    lastDate,
    deadline,
    valid: Boolean(lastDate) && (!deadline || lastDate! <= deadline),
  };
}

export function defaultPhasedEntryInstallments(
  pot: CapitalPot,
  startDate: string,
  referenceDate: Date | string = new Date(),
  preferred = 12,
) {
  // An invalid external preference falls back to the normal proposal, never a
  // truncated/clamped interpretation of an actual entry's installment count.
  const maximum = validPhasedInstallments(preferred) ? preferred : 12;
  for (let installments = maximum; installments >= 1; installments -= 1) {
    if (phasedEntryScheduleValidation(
      { startDate, installments, frequency: "monthly" },
      pot,
      referenceDate,
    ).valid) return installments;
  }
  return 1;
}

export type PhasedEntryDraftKind = "installments" | "percent" | "amount";
export function parsePhasedEntryNumericDraft(raw: string, kind: PhasedEntryDraftKind) {
  const trimmed = raw.trim();
  if (!trimmed) return { status: "empty" as const };
  if (kind === "installments") {
    if (!/^\d+$/.test(trimmed)) return { status: "invalid" as const };
    const value = Number(trimmed);
    return validPhasedInstallments(value)
      ? { status: "valid" as const, value }
      : { status: "invalid" as const };
  }
  const normalized = trimmed.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return { status: "invalid" as const };
  const value = Number(normalized);
  const valid = Number.isFinite(value) && (
    kind === "percent"
        ? value >= 0 && value <= 100
        : value >= 0
  );
  return valid ? { status: "valid" as const, value } : { status: "invalid" as const };
}

export function nextImplementationDate(
  referenceDate: Date | string = new Date(),
) {
  let date: Date;
  if (typeof referenceDate === "string") {
    const match = referenceDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    date = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(referenceDate);
  } else {
    date = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate(),
    );
  }
  if (Number.isNaN(date.getTime())) date = new Date();
  if (date.getDate() < 15) date.setDate(15);
  else {
    date.setMonth(date.getMonth() + 1, 1);
  }
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function annualSavingsContribution(entry: SavingsPlan) {
  const multiplier: Record<InvestmentFrequency, number> = {
    monthly: 12,
    quarterly: 4,
    semiannual: 2,
    annual: 1,
  };
  return Math.max(0, Number(entry.contributionAmount) || 0) * multiplier[entry.frequency];
}
