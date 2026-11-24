import { jsonHash } from "../case/recovery-hash";
import type { Evidence } from "./premium-contract";

/** Independent facts from A1, A2 and A3. UI selections cannot manufacture B. */
export type Evidenced<T> = { readonly value: T; readonly evidence: Evidence } | null;
export interface ChildEligibility {
  readonly caseId: string;
  readonly personId: string;
  readonly childId: string | null;
  readonly year: number;
  readonly childBenefit: Evidenced<boolean>;
  readonly assignment: Evidenced<{ readonly personId: string; readonly contractId: string }>;
  readonly contractPath: Evidenced<boolean>;
  readonly contributionPath: Evidenced<boolean>;
  readonly inputRevision: string;
}
export function childCard(item: ChildEligibility) {
  const { childId, childBenefit, assignment, contractPath, contributionPath, personId } = item;
  if (childBenefit?.value === false && childBenefit.evidence.class === "B") return { status: "not_relevant" as const };
  if (!childId || !childBenefit?.value || !assignment?.value.contractId || assignment.value.personId !== personId
    || !contractPath?.value || !contributionPath?.value) return { status: "O" as const, issue: !childId ? "child" : !childBenefit?.value
      ? "childBenefit" : !assignment?.value.contractId || assignment.value.personId !== personId ? "assignment" : !contractPath?.value ? "contractPath" : "contributionPath" };
  const evidence = [childBenefit.evidence, assignment.evidence, contractPath.evidence, contributionPath.evidence];
  if (evidence.some(item => !item.version || !item.source || item.class === "A")) return { status: "O" as const, issue: "evidence" };
  return { status: evidence.every(i => i.class === "B") ? "B" as const : "S" as const,
    childId, year: item.year, assignment: assignment.value, version: jsonHash(item) };
}

export interface Preference {
  readonly id: string;
  readonly criterion: "exclude_guarantee" | "minimum_guarantee" | "both_payouts_same_tariff" | "fund_selection";
  readonly answer: "none_required" | "compare" | "explicit_requirement";
  readonly hardness: "soft" | "explicit_hard" | "revoked";
  readonly revision: string;
  readonly stichtag: string;
  readonly requirementBasis: string;
  readonly requiredScope: string;
}
export interface FeatureCheck {
  readonly preferenceId: string;
  readonly preferenceRevision: string;
  readonly tariffId: string;
  readonly productId: string;
  readonly tariffVersion: string;
  readonly comparisonRevision: string;
  readonly stichtag: string;
  readonly requirementBasis: string;
  readonly requiredScope: string;
  readonly feature: Evidenced<boolean>;
  readonly bankChannel: "available" | "blocked" | "open" | "announced";
}
export function assessPreference(preference: Preference, check: FeatureCheck, activeTariff: string) {
  const base = { profileId: preference.id, productId: check.productId, tariffId: check.tariffId, bankChannel: check.bankChannel };
  if (preference.answer !== "explicit_requirement" || preference.hardness !== "explicit_hard")
    return { ...base, status: "orientation" as const };
  if (preference.id !== check.preferenceId || preference.revision !== check.preferenceRevision || activeTariff !== check.tariffVersion
    || preference.stichtag !== check.stichtag || preference.requirementBasis !== check.requirementBasis
    || preference.requiredScope !== check.requiredScope || check.feature?.evidence.class !== "B"
    || !check.feature.evidence.version || !check.feature.evidence.source) return { ...base, status: "O" as const };
  return { ...base, status: check.feature.value ? "B_MATCH" as const : "B_MISMATCH" as const,
    comparisonRevision: check.comparisonRevision, source: check.feature.evidence };
}
