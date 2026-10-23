import { needCalendarDate, needCalendarParts, NEED_CALENDAR_ERROR } from "./calendar";
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

/** Nearest whole month; a half month rounds up (Math.round for nonnegative years).
 * This is the established planning granularity, not a day-count convention. */
function relativeNeedMonths(years: number) {
  return Math.max(0, Math.round(years * 12));
}

/** An explicit calendar date leads. Relative durations retain the reference day,
 * clamped to the last day of the target month (e.g. Jan 31 -> Feb 28/29).
 * The application's callers supply the fixed case createdAt, never reload time. */
export function targetDateForNeed(
  need: AdvisoryData["needs"][number],
  referenceDate: Date | string = new Date(),
): string {
  const target = needCalendarDate(need, referenceDate);
  if (!target) throw new Error(NEED_CALENDAR_ERROR);
  return target;
}

export function monthsUntilNeed(
  need: AdvisoryData["needs"][number],
  referenceDate: Date | string = new Date(),
): number {
  targetDateForNeed(need, referenceDate);
  const due = typeof need.dueDate === "string" ? needCalendarParts(need.dueDate) : null;
  if (due) {
    const reference = needCalendarParts(referenceDate);
    if (!reference) throw new Error("Ungültiges festes Fallreferenzdatum.");
    // Existing month-based horizon: days within a calendar month do not add a month.
    return Math.max(0, (due.year - reference.year) * 12 + due.month - reference.month);
  }
  return relativeNeedMonths(need.years);
}

export function targetYearForNeed(
  need: AdvisoryData["needs"][number],
  referenceDate: Date | string = new Date(),
) {
  return needCalendarParts(targetDateForNeed(need, referenceDate))!.year;
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
    const targetDates = needs
      .map((need) => targetDateForNeed(need, referenceDate))
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
      earliestDueDate: targetDates[0],
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
  referenceDate: Date | string = new Date(),
): Record<BucketId, number> {
  const targets = Object.fromEntries(
    maturityBuckets.map((bucket) => [bucket.id, 0]),
  ) as Record<BucketId, number>;
  targets.reserve = data.reserve;
  for (const need of data.needs)
    targets[bucketForMonths(monthsUntilNeed(need, referenceDate))] += need.amount;
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
