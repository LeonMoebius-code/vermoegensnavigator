import { controlCase } from "./f021-fixtures";

// Invented, unbound cases isolate calendar validity from existing P3 year bindings.
export const f026Variants = [
  ...[0, 1, 30, 50, 100, 200].map(years => ({ tag: `normal-${years}`, years, reference: "2026-10-15T12:00:00.000Z", date: `${2026 + years}-10-15` })),
  { tag: "last-9999", years: 95678 / 12, reference: "2026-10-31T12:00:00.000Z", date: "9999-12-31" },
  { tag: "first-10000", years: 95679 / 12, reference: "2026-10-31T12:00:00.000Z", date: null },
  { tag: "second-five-digit-year", years: 7975, reference: "2026-10-31T12:00:00.000Z", date: null },
  { tag: "finite-extreme", years: Number.MAX_SAFE_INTEGER, reference: "2026-10-15", date: null },
  { tag: "month-overflow", years: 1e308, reference: "2026-10-15", date: null },
  { tag: "date-overflow", years: 1e6, reference: "2026-10-15", date: null },
  { tag: "lower-0100", years: 0, reference: "0100-01-31", date: "0100-01-31" },
  { tag: "lower-leap", years: 1, reference: "0104-02-29", date: "0105-02-28" },
  { tag: "reference-below-domain", years: 1, reference: "0099-12-31", date: null },
  { tag: "reference-above-domain", years: 0, reference: "+010000-01-01T12:00:00Z", date: null },
  { tag: "invalid-reference", years: 1, reference: "2026-02-30", date: null },
  { tag: "late-reference-valid", years: 0, reference: "9999-12-31", date: "9999-12-31" },
  { tag: "late-reference-invalid", years: 1 / 12, reference: "9999-12-31", date: null },
  { tag: "round-below-half", years: 0.04, reference: "9999-12-31", date: "9999-12-31" },
  { tag: "round-above-half", years: 0.05, reference: "9999-12-31", date: null },
  { tag: "explicit-priority", years: 1e308, dueDate: "2028-02-29", reference: "2026-10-15", date: "2028-02-29" },
  { tag: "explicit-last", years: 1e308, dueDate: "9999-12-31", reference: "2026-10-15", date: "9999-12-31" },
  { tag: "explicit-invalid-reference", years: 1, dueDate: "2028-02-29", reference: "not-a-date", date: null },
] as const;
export type F026Variant = (typeof f026Variants)[number];
export function f026Case(v: F026Variant) {
  const c = controlCase(`f026-${v.tag}`); c.createdAt = v.reference;
  c.advisory.needs = [{ id: 701, purpose: "SYNTHETISCH F026 Bedarf", amount: 10000, years: v.years,
    ...("dueDate" in v ? { dueDate: v.dueDate } : {}) }];
  return c;
}
