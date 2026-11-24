import { jsonHash } from "../../domain/case/recovery-hash";
import { requireAvd } from "../../domain/retirement/avd-data";
import { monthIndex, regularEnd, type EndAgeBasis, type EndMonthOverride, type Timeline } from "../../domain/retirement/premium-calendar";
import type { CustomerPlan } from "./customer-plan-adapter";

export interface TimelineDraft {
  readonly mode: "dated" | "end_age" | "holdings_only";
  readonly endAge: string;
  readonly birthMonth: string;
  readonly override: EndMonthOverride | null;
  readonly valuationEnd: string;
  readonly payoutMonth: string;
}
export const DEFAULT_TIMELINE_DRAFT: TimelineDraft = Object.freeze({ mode: "dated", endAge: "67", birthMonth: "",
  override: null, valuationEnd: "", payoutMonth: "" });

export function endAgeBasis(plan: CustomerPlan, draft: TimelineDraft): EndAgeBasis {
  return { birthYear: Number(plan.birthYear), birthMonth: draft.birthMonth ? Number(draft.birthMonth) : null,
    birthMonthEvidence: draft.birthMonth ? "S" : "O", endAge: Number(draft.endAge),
    sourceVersion: jsonHash([plan.birthYear, draft.birthMonth]) };
}
export function resolvePremiumTimeline(plan: CustomerPlan, draft: TimelineDraft, finalFundingYear: number | null): Timeline {
  const start = plan.capital.start;
  let last = plan.capital.end;
  if (draft.mode === "end_age") {
    const end = regularEnd(endAgeBasis(plan, draft), draft.override);
    requireAvd(end.status !== "Konflikt_ungelöst", "END_OVERRIDE_CONFLICT", "endAge");
    requireAvd(end.month, "END_MONTH_OPEN", "endAge");
    last = end.month;
  }
  const valuationEnd = draft.valuationEnd || last;
  monthIndex(start);
  monthIndex(valuationEnd);
  if (draft.payoutMonth) monthIndex(draft.payoutMonth);
  return { valuationStart: start, valuationEnd,
    contributions: draft.mode === "holdings_only" ? { kind: "holdings_only" } : { kind: "regular", first: start, last },
    finalFundingYear, payoutStart: draft.payoutMonth ? { month: draft.payoutMonth, evidence: "S", version: jsonHash(draft.payoutMonth) } : null };
}
