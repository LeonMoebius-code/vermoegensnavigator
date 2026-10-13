/** Technical resource limit for phased entries, independent of pot deadlines. */
export const MAX_PHASED_INSTALLMENTS = 1200;

export function validPhasedInstallments(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    value >= 1 && value <= MAX_PHASED_INSTALLMENTS;
}

/** Pre-schema-10 conversion only: retain the missing-field default and numeric
 * strings, but never truncate, clamp or repair an explicitly damaged value. */
export function legacyPhasedInstallments(value: unknown): number | null {
  if (value === undefined) return 1;
  const converted = typeof value === "string" && value.trim() !== ""
    ? Number(value) : value;
  return validPhasedInstallments(converted) ? converted : null;
}
