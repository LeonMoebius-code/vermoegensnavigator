import { validCaseFinancialInputs } from "./financial-validation";
import { capitalPots, maturityBuckets } from "../planning/capital-pots";
import { localDateParts } from "../planning/calendar";
import { legacyPhasedInstallments } from "../planning/installment-validation";
import type { AdvisoryData } from "../advisory/contracts";

export type LegacyCapitalProtection = "safe" | "historical-bindings" | "ambiguous-legacy" | "invalid-data";
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const identity = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** Read-only inventory BEFORE cloning, legacy field conversion or reconciliation.
 * This proves only that capital bindings can survive the documented conversion;
 * it grants no exception to H2/P2/P3/H4 or any current calendar rule. Historical
 * snapshots are intentionally opaque. No old year or advisor intent is guessed. */
export function legacyCapitalProtection(value: unknown): LegacyCapitalProtection {
  if (!record(value)) return "invalid-data";
  const item = value.case ?? value;
  if (!record(item)) return "invalid-data";
  const schema = Number(item.schemaVersion) || 0;
  if (schema > 11 || !validCaseFinancialInputs(item, schema)) return "invalid-data";
  if (schema >= 10) return "safe"; // Existing current graph trust boundary remains authoritative.
  const advisory = item.advisory as unknown as AdvisoryData;
  if (!Array.isArray(item.plans)) return "invalid-data";
  const buckets = new Set<string>(maturityBuckets.map(b => b.id));
  const planIds = new Set<unknown>();
  for (const plan of item.plans) {
    if (!record(plan) || !identity(plan.id) || planIds.has(plan.id)) return "invalid-data";
    planIds.add(plan.id);
  }
  if (!planIds.has(item.activePlanId)) return "invalid-data";
  for (const plan of item.plans as Record<string, unknown>[]) {
    const allocations = (plan.allocations ?? []) as Record<string, unknown>[];
    const entries = (plan.investmentPlans ?? []) as Record<string, unknown>[];
    // A binding must not be interpreted against a moving "today" fallback.
    if ((allocations.length || entries.length) &&
      (typeof item.createdAt !== "string" || !localDateParts(item.createdAt))) return "ambiguous-legacy";
    let pots;
    try { pots = capitalPots(advisory, plan.total as number, item.createdAt as string); }
    catch { return "ambiguous-legacy"; }
    const potIds = new Set<string>(pots.map(p => p.id));
    const bindings = new Map<unknown, Map<string, number>>();
    for (const a of allocations) {
      if (!identity(a.id) || bindings.has(a.id)) return "invalid-data";
      const amount = a.amount as number;
      const rawMap = a.capitalPotAmounts as Record<string, number> | undefined;
      // Inspect BOTH representations, including zero-valued dangling keys.
      const refs = [...Object.keys(rawMap ?? {}), ...(a.capitalPotId === undefined ? [] : [a.capitalPotId])];
      if (refs.some(id => typeof id !== "string")) return "invalid-data";
      if (refs.some(id => !potIds.has(id as string)))
        return refs.some(id => typeof id === "string" && /^year-\d{4}$/.test(id) && !potIds.has(id))
          ? "historical-bindings" : "invalid-data";
      // The old migrator treats zero-only current mappings as bucket input.
      // Do not let that reinterpret an explicitly stored binding (even at zero).
      if (refs.length && !(rawMap && Object.values(rawMap).some(n => n > 0)) &&
        (amount === 0 || (rawMap && Object.keys(rawMap).length > 0))) return "ambiguous-legacy";
      const mapped = new Map<string, number>();
      if (rawMap && Object.values(rawMap).some(n => n > 0)) {
        for (const [id, n] of Object.entries(rawMap)) if (n > 0) mapped.set(id, n);
        if (a.capitalPotId !== undefined && !mapped.has(a.capitalPotId as string)) return "ambiguous-legacy";
      } else if (a.capitalPotId !== undefined && amount > 0) {
        // A zero-only map must not silently become a positive single binding.
        mapped.set(a.capitalPotId as string, amount);
      } else {
        // Genuine pre-capital-pot bucket format: only unique destinations are
        // lossless. Ambiguous amounts must stay in the protected original.
        const bucketMap = a.bucketAmounts as Record<string, number | string> | undefined;
        const old = bucketMap && Object.values(bucketMap).some(n => Number(n) > 0)
          ? Object.entries(bucketMap).map(([id, n]) => [id, Number(n)] as const)
          : a.bucketId === undefined ? [] : [[a.bucketId as string, amount] as const];
        if (Number(a.capitalPotReviewAmount) > 0) return "ambiguous-legacy";
        for (const [id, n] of old) {
          if (!buckets.has(id)) return "ambiguous-legacy";
          if (n <= 0) continue;
          const targets = pots.filter(p => p.legacyBucketId === id);
          if (targets.length !== 1) return "ambiguous-legacy";
          const target = targets[0].id;
          mapped.set(target, (mapped.get(target) ?? 0) + n);
        }
        if (amount > 0 && !mapped.size && !rawMap) return "ambiguous-legacy";
      }
      const coverage = [...mapped.values()].reduce((sum, n) => sum + n, 0);
      // Detect inflation as well as truncation, without changing precision.
      if (!Number.isFinite(coverage) || coverage > amount ||
        (coverage > 0 && coverage + Math.max(0, amount - coverage) !== amount)) return "ambiguous-legacy";
      bindings.set(a.id, mapped);
    }
    for (const e of entries) {
      if (e.type === "savings") {
        // A stored target must not be silently stripped by either migration.
        if (e.targetRef !== undefined) {
          const t = e.targetRef;
          if (schema < 8) return "ambiguous-legacy";
          if (!record(t) || (t.kind === "need"
            ? advisory.needs.filter(n => n.id === t.id).length !== 1
            : t.kind === "savingsGoal" && Array.isArray(item.savingsGoals)
              ? item.savingsGoals.filter(g => record(g) && g.id === t.id).length !== 1 : true)) return "invalid-data";
        }
        continue;
      }
      if (e.type !== "phased") return "invalid-data";
      if (e.capitalPotId !== undefined && !potIds.has(e.capitalPotId as string))
        return typeof e.capitalPotId === "string" && /^year-\d{4}$/.test(e.capitalPotId)
          ? "historical-bindings" : "invalid-data";
      if (schema >= 8) {
        if (!identity(e.allocationId) || !identity(e.capitalPotId) ||
          !(bindings.get(e.allocationId)?.get(e.capitalPotId)! > 0)) return "invalid-data";
        if (!(Number(e.stagedValue) > 0)) return "ambiguous-legacy"; // Reconciliation would drop the entry.
      } else {
        const candidates = e.capitalPotId ? pots.filter(p => p.id === e.capitalPotId)
          : e.bucketId ? pots.filter(p => p.legacyBucketId === e.bucketId) : pots.length === 1 ? pots : [];
        if (candidates.length !== 1 || !identity(e.productId)) return "ambiguous-legacy";
        const matches = allocations.filter(a => a.productId === e.productId &&
          (bindings.get(a.id)?.get(candidates[0].id) ?? 0) > 0);
        const staged = Number(e.installmentAmount) * legacyPhasedInstallments(e.installments)!;
        if (matches.length !== 1 || !(staged > 0) || !Number.isFinite(staged)) return "ambiguous-legacy";
      }
    }
  }
  return "safe";
}
