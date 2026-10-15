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

