import type { AdvisoryData } from "../advisory/contracts";
import type { BucketId, CapitalPot } from "./contracts";

export const maturityBuckets = [
  {
    id: "reserve",
    label: "Reserve",
    range: "jederzeit verfügbar",
    minMonths: 0,
    maxMonths: 0,
  },
  {
    id: "year1",
    label: "Bis 1 Jahr",
    range: "bis 12 Monate",
    minMonths: 1,
    maxMonths: 12,
  },
  {
    id: "year3",
    label: "1–3 Jahre",
    range: "über 12 bis 36 Monate",
    minMonths: 13,
    maxMonths: 36,
  },
  {
    id: "year5",
    label: "3–5 Jahre",
    range: "über 36 bis 60 Monate",
    minMonths: 37,
    maxMonths: 60,
  },
  {
    id: "year10",
    label: "5–10 Jahre",
    range: "über 60 bis 120 Monate",
    minMonths: 61,
    maxMonths: 120,
  },
  {
    id: "year10plus",
    label: "Strategisches Kapital",
    range: "über 120 Monate / ohne festen Bedarf",
    minMonths: 121,
    maxMonths: 600,
  },
] as const;

// Contract and runtime literals must describe the same set in both directions.
type SameUnion<A, B> =
  [Exclude<A, B>, Exclude<B, A>] extends [never, never] ? true : false;
type Assert<T extends true> = T;
type _BucketIdContractMatchesRuntime =
  Assert<SameUnion<BucketId, (typeof maturityBuckets)[number]["id"]>>;

export function monthsUntilNeed(
  need: AdvisoryData["needs"][number],
  referenceDate: Date | string = new Date(),
): number {
  const dueDate = (need as AdvisoryData["needs"][number] & { dueDate?: string })
    .dueDate;
  if (dueDate) {
    const due = new Date(`${dueDate}T12:00:00`);
    if (!Number.isNaN(due.getTime())) {
      const now =
        referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
      return Math.max(
        0,
        (due.getFullYear() - now.getFullYear()) * 12 +
          due.getMonth() -
          now.getMonth(),
      );
    }
  }
  return Math.max(0, Math.round(need.years * 12));
}

function referenceYear(referenceDate: Date | string) {
  const date =
    referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
}

export function targetYearForNeed(
  need: AdvisoryData["needs"][number],
  referenceDate: Date | string = new Date(),
) {
  if (need.dueDate) {
    const year = Number(need.dueDate.slice(0, 4));
    if (Number.isFinite(year) && year > 1900) return year;
  }
  return referenceYear(referenceDate) + Math.max(0, Math.round(need.years));
}

export function capitalPots(
  data: AdvisoryData,
  total: number,
  referenceDate: Date | string = new Date(),
): CapitalPot[] {
  const pots: CapitalPot[] = [];
  if (data.reserve > 0)
    pots.push({
      id: "reserve",
      kind: "reserve",
      label: "Liquiditätsreserve",
      range: "jederzeit verfügbar",
      total: data.reserve,
      needs: [],
      minMonths: 0,
      legacyBucketId: "reserve",
    });

  const needsByYear = new Map<number, AdvisoryData["needs"]>();
  for (const need of data.needs) {
    if (need.amount <= 0) continue;
    const year = targetYearForNeed(need, referenceDate);
    needsByYear.set(year, [...(needsByYear.get(year) || []), need]);
  }
  for (const [year, needs] of [...needsByYear.entries()].sort(
    ([left], [right]) => left - right,
  )) {
    const exactDates = needs
      .map((need) => need.dueDate)
      .filter((date): date is string => Boolean(date))
      .sort();
    const minMonths = Math.min(
      ...needs.map((need) => monthsUntilNeed(need, referenceDate)),
    );
    pots.push({
      id: `year-${year}`,
      kind: "year",
      label: String(year),
      range: `${needs.length} ${needs.length === 1 ? "Kapitalbedarf" : "Kapitalbedarfe"}`,
      total: needs.reduce((sum, need) => sum + need.amount, 0),
      year,
      needs,
      earliestDueDate: exactDates[0],
      minMonths,
      legacyBucketId: bucketForMonths(minMonths),
    });
  }

  const strategic = strategicAmount(data, total);
  if (strategic > 0)
    pots.push({
      id: "strategic",
      kind: "strategic",
      label: "Strategisch verfügbares Kapital",
      range: "kein konkreter Bedarf / langfristig verfügbar",
      total: strategic,
      needs: [],
      minMonths: 600,
      legacyBucketId: "year10plus",
    });
  return pots;
}

export function planningShortfall(data: AdvisoryData, total: number) {
  const fixed =
    data.reserve + data.needs.reduce((sum, need) => sum + need.amount, 0);
  return Math.max(0, fixed - total);
}

export function bucketForMonths(months: number): BucketId {
  if (months <= 12) return "year1";
  if (months <= 36) return "year3";
  if (months <= 60) return "year5";
  if (months <= 120) return "year10";
  return "year10plus";
}

export function bucketTargets(
  data: AdvisoryData,
  total: number,
): Record<BucketId, number> {
  const targets = Object.fromEntries(
    maturityBuckets.map((bucket) => [bucket.id, 0]),
  ) as Record<BucketId, number>;
  targets.reserve = data.reserve;
  for (const need of data.needs)
    targets[bucketForMonths(monthsUntilNeed(need))] += need.amount;
  const fixed =
    data.reserve + data.needs.reduce((sum, need) => sum + need.amount, 0);
  targets.year10plus += Math.max(0, total - fixed);
  return targets;
}

export function strategicAmount(data: AdvisoryData, total: number) {
  return Math.max(
    0,
    total -
      data.reserve -
      data.needs.reduce((sum, need) => sum + need.amount, 0),
  );
}
