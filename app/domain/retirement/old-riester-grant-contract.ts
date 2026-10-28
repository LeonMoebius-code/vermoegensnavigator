/** AP-01b: every confirmation refers to one person and the selected year/regime. */
export type OldRiesterRuleId = "alt-2026-checked-20261028"
  | "alt-bestand-2027-checked-20261028" | "alt-bestand-2028-checked-20261028";
export type EvidenceTopic = "entitlement" | "regime" | "contract" | "income" | "partner"
  | "bonus" | "children" | "contribution" | "correction";
export interface OldRiesterGrantInput {
  readonly contributionYear: number;
  /** Unknown IDs are never interpreted as the latest rule. */
  readonly ruleContext: string;
  readonly entitlement: "direct_old_confirmed" | "unconfirmed" | "conflicting" | "timeline_unconfirmed" | "indirect" | "ineligible";
  readonly regime: "old_2026_confirmed" | "old_protected_confirmed" | "unconfirmed" | "conflicting" | "new_confirmed";
  /** Includes ownership, eligibility and all relevant dormant/transferred/ended contracts. */
  readonly contract: "single_private_eligible_confirmed" | "unconfirmed" | "conflicting" | "transition_unconfirmed"
    | "multiple" | "multiple_and_new_regime" | "housing" | "occupational" | "ineligible";
  readonly incomeBasis: "simple_domestic_prior_rv_confirmed" | "unconfirmed" | "conflicting" | "special";
  readonly priorYearIncomeCents: number | null;
  readonly incomeYear: number;
  readonly partner: "none_relevant_confirmed" | "direct_independent_confirmed" | "unconfirmed" | "conflicting"
    | "indirect_included" | "indirect_new_direct_old";
  /** No date-of-birth inference. Caller verifies age cutoff or first-claim/consumption history. */
  readonly bonus: "age_excluded_confirmed" | "history_no_current_confirmed" | "unconfirmed" | "conflicting" | "current_year_confirmed";
  readonly childrenStatus: "complete_confirmed" | "unconfirmed" | "conflicting";
  readonly children: readonly OldRiesterChild[];
  readonly eligibleOwnContributionCents: number | null;
  readonly contributionQuality: "actual_confirmed" | "planned_confirmed" | "unconfirmed" | "conflicting" | "ineligible";
  readonly evidenceQuality: "confirmed" | "unconfirmed" | "conflicting";
  readonly pendingEvidence: readonly EvidenceTopic[];
  readonly correction: "none_confirmed" | "unconfirmed" | "conflicting" | "retrospective";
}
export interface OldRiesterChild {
  readonly id: string;
  readonly birthYear: number;
  readonly contributionYear: number;
  readonly ruleContext: string;
  readonly assignment: "eligible_assigned_confirmed" | "eligibility_unconfirmed" | "assignment_unconfirmed" | "conflicting_assignment";
}
export interface OldRiesterRuleContext {
  readonly id: OldRiesterRuleId;
  readonly contributionYear: 2026 | 2027 | 2028;
  readonly calculationVersion: "ap01b-v1";
  readonly checkedOn: "2026-10-28";
  readonly childEntitlementPeriod: "first";
  readonly childParentAssignment: "old_until_2027" | "neutral_from_2028";
  readonly sources: readonly string[];
}
export type OldRiesterIssueCode = "invalid_shape" | "invalid_year" | "invalid_income" | "invalid_contribution"
  | "invalid_child" | "duplicate_child" | "year_not_approved" | "rule_year_mismatch" | "rule_context_required"
  | "entitlement_unconfirmed" | "entitlement_timeline_required" | "regime_unconfirmed" | "contract_unconfirmed"
  | "income_required" | "income_year_mismatch" | "partner_confirmation_required" | "bonus_history_required"
  | "child_assignment_required" | "contribution_required" | "evidence_required" | "pending_evidence" | "correction_required"
  | "entitlement_out_of_scope" | "new_regime" | "multiple_contracts" | "multiple_contracts_and_regime_transition"
  | "contract_out_of_scope" | "special_income_basis" | "indirect_partner" | "indirect_new_direct_old"
  | "bonus_year" | "ineligible_contribution" | "retrospective_correction" | "rounding_convention_required";
interface ResultContext {
  readonly ruleContext: OldRiesterRuleContext | null;
  readonly notice: "Jahresbezogene Modellrechnung; keine individuelle Förderzusage.";
}
export type OldRiesterGrantResult = ResultContext & (
  | {
      readonly status: "calculated";
      readonly scope: "confirmed_direct_old_bonus_free_single_contract";
      readonly contributionYear: 2026 | 2027 | 2028;
      readonly contributionQuality: "actual_confirmed" | "planned_confirmed";
      readonly evidenceQuality: "caller_confirmed";
      readonly bonus: { readonly status: "no_current_bonus_confirmed"; readonly includedInTotal: false };
      readonly minimumOwnContributionCents: number;
      readonly fulfillment: {
        readonly status: "full" | "reduced" | "zero";
        /** Exact capped ratio, dimensionless; no floating-point money or quotient. */
        readonly numerator: number;
        readonly denominator: number;
      };
      readonly baseGrantCents: number;
      readonly childGrants: readonly { readonly childId: string; readonly grantCents: number }[];
      readonly childrenGrantCents: number;
      readonly totalGrantCents: number;
      readonly roundingStatus: "full_or_zero_exact" | "component_cent_agreement";
    }
  | {
      readonly status: "invalid_input" | "review_required" | "unsupported";
      readonly issue: { readonly code: OldRiesterIssueCode; readonly message: string };
    }
);
