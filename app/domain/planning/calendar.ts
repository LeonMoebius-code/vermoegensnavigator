/** Calendar-only arithmetic shared by needs and implementation schedules.
 * ISO strings use their recorded calendar date, independent of the browser zone. */
export const localDateParts = (value: Date | string) => {
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
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function addLocalMonthsClamped(value: Date | string, months: number) {
  const parts = localDateParts(value);
  if (!parts || !Number.isSafeInteger(Math.trunc(months))) return null;
  const target = new Date(parts.year, parts.month - 1 + Math.trunc(months), 1, 12);
  if (!Number.isFinite(target.getTime())) return null;
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  if (!Number.isFinite(lastDay)) return null;
  return localDateString(
    target.getFullYear(),
    target.getMonth() + 1,
    Math.min(parts.day, lastDay),
  );
}

/** F-026 need calendar domain. Keep the shared parser/schedule semantics separate. */
export const needCalendarParts = (value: unknown) => {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  if (typeof value === "string" && (!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value) ||
    !Number.isFinite(Date.parse(value)))) return null;
  const parts = localDateParts(value);
  return parts && parts.year >= 100 && parts.year <= 9999 ? parts : null;
};

export const NEED_CALENDAR_ERROR = "Bitte einen gültigen Bedarfstermin zwischen 0100 und 9999 wählen. Die Laufzeit muss vom festen Fallreferenzdatum aus innerhalb dieses Kalenderbereichs liegen.";

/** Validate untouched inputs and the actual rounded result; never cap a duration.
 * A recognized explicit date leads, so unused years need not be valid. */
export function needCalendarDate(
  need: { years?: unknown; dueDate?: unknown },
  referenceDate: unknown,
): string | null {
  if (!needCalendarParts(referenceDate)) return null;
  if (typeof need.dueDate === "string" && needCalendarParts(need.dueDate))
    return need.dueDate.slice(0, 10);
  if (typeof need.years !== "number" || !Number.isFinite(need.years) || need.years < 0)
    return null;
  const months = Math.round(need.years * 12);
  if (!Number.isSafeInteger(months)) return null;
  const date = addLocalMonthsClamped(referenceDate as Date | string, months);
  return date && needCalendarParts(date) ? date : null;
}
