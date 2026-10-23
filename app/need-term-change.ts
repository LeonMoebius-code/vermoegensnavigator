import { updateCaseAdvisory, type AdvisoryCase } from "./case-model";
import { localDateParts } from "./domain/planning/calendar";
import { targetDateForNeed, targetYearForNeed } from "./domain/planning/capital-pots";
import { needTermLosses } from "./domain/planning/need-term-impact";

export type NeedTermRequest = { caseId: string; needId: number } &
  ({ mode: "date"; value: string } | { mode: "years"; value: number });

/** Run the production update with the current case, including reference date,
 * savings goals, per-plan totals and all plan variants. Preserve unused years
 * when an explicit date is entered (F-021 date priority). */
export function previewNeedTermChange(current: AdvisoryCase, request: NeedTermRequest) {
  if (current.id !== request.caseId) throw new Error("Der Beratungsfall hat gewechselt.");
  const need = current.advisory.needs.find((candidate) => candidate.id === request.needId);
  if (!need) throw new Error("Der Kapitalbedarf ist nicht mehr vorhanden.");
  if (request.mode === "date" ? !/^\d{4}-\d{2}-\d{2}$/.test(request.value) || !localDateParts(request.value)
    : typeof request.value !== "number" || !Number.isFinite(request.value) || request.value < 0)
    throw new Error("Bitte einen vollständigen gültigen Termin oder eine endliche, nicht negative Laufzeit eingeben.");
  const changed = request.mode === "date" ? { ...need, dueDate: request.value }
    : { ...need, years: request.value, dueDate: "" };
  const beforeDate = targetDateForNeed(need, current.createdAt);
  const afterDate = targetDateForNeed(changed, current.createdAt);
  if (!localDateParts(afterDate)) throw new Error("Der rechnerische Termin ist ungültig.");
  const unchanged = changed.dueDate === need.dueDate && Object.is(changed.years, need.years);
  const next = unchanged ? current : updateCaseAdvisory(current, "needs",
    current.advisory.needs.map((candidate) => candidate.id === need.id ? changed : candidate));
  const losses = unchanged ? [] : needTermLosses(current.advisory, current.plans, next.plans, current.createdAt);
  const review = { caseId: current.id, needId: need.id, purpose: need.purpose,
    beforeDate, afterDate, beforeYear: targetYearForNeed(need, current.createdAt),
    afterYear: targetYearForNeed(changed, current.createdAt), losses };
  return { next, unchanged, ...review, key: JSON.stringify(review) };
}

/** Atomic compare-and-apply. A queued React update may see a newer case than
 * the event handler: that newer state is always authoritative. */
export function commitNeedTermChange(current: AdvisoryCase, request: NeedTermRequest, reviewedKey: string): AdvisoryCase {
  try {
    const preview = previewNeedTermChange(current, request);
    return preview.key === reviewedKey ? preview.next : current;
  } catch { return current; }
}
