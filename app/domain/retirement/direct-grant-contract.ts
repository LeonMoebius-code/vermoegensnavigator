/** AP-01a: confirmations refer only to this person and contributionYear. */
export type DirectGrantRuleId = "estg-2027-v1" | "estg-2028-v1";

export interface DirectGrantInput {
  readonly contributionYear: number;
  readonly ruleContext: DirectGrantRuleId;
  readonly entitlement: "direct_confirmed" | "unconfirmed" | "indirect" | "ineligible";
  readonly regime: "new_confirmed" | "old" | "unconfirmed";
  readonly eligibleOwnContributionCents: number;
  /** Includes eligibility, single-person scope and confirmed transition, if any. */
  readonly eligibleContractContext: "single_eligible_confirmed" | "multiple" | "transition_unconfirmed" | "unconfirmed";
  /** [] explicitly confirms no children to include, never unknown assignment. */
  readonly children: readonly DirectGrantChild[];
  readonly pendingEvidence?: readonly ("entitlement" | "regime" | "contract" | "children" | "bonus")[];
}

export interface DirectGrantChild {
  /** Opaque technical ID, no names, dates of birth or contract data. */
  readonly id: string;
  readonly contributionYear: number;
  readonly status: "eligible_assigned_confirmed" | "eligibility_unconfirmed" | "assignment_unconfirmed" | "conflicting_assignment";
}

export interface DirectGrantRuleContext {
  readonly id: DirectGrantRuleId;
  readonly contributionYear: 2027 | 2028;
  readonly calculationVersion: "ap01a-v1";
  readonly checkedOn: "2026-10-27";
  readonly baseAndMinimumEffectiveFrom: "2027-01-01";
  readonly childAssignmentEffectiveFrom: "2027-01-01" | "2028-01-01";
  readonly sources: readonly string[];
}

export type DirectGrantIssueCode =
  | "invalid_shape" | "invalid_year" | "invalid_contribution" | "invalid_child" | "duplicate_child_id"
  | "year_before_new_regime" | "year_not_approved" | "rule_year_mismatch"
  | "entitlement_unconfirmed" | "entitlement_out_of_scope" | "regime_unconfirmed" | "old_regime"
  | "multiple_contracts" | "contract_unconfirmed" | "child_confirmation_required" | "pending_evidence"
  | "rounding_convention_required";

interface ResultContext {
  readonly ruleContext: DirectGrantRuleContext | null;
  readonly bonus: { readonly status: "not_calculated_requires_review"; readonly includedInTotal: false };
  readonly notice: "Jahresbezogene Modellrechnung; keine individuelle Förderzusage. Einmalbonus gesondert prüfen.";
}

export type DirectGrantResult = ResultContext & (
  | {
      readonly status: "calculated";
      readonly scope: "confirmed_direct_single_contract_standard";
      readonly contributionYear: 2027 | 2028;
      readonly baseGrantCents: number;
      readonly childGrants: readonly { readonly childId: string; readonly grantCents: number }[];
      readonly childrenGrantCents: number;
      readonly totalGrantCents: number;
      readonly roundingStatus: "exact_integer_cents";
    }
  | {
      readonly status: "review_required" | "unsupported" | "invalid_input";
      readonly issue: { readonly code: DirectGrantIssueCode; readonly message: string };
      /** Exact mathematical intermediate only, never a payable grant amount. */
      readonly openRounding?: { readonly component: "baseGrant"; readonly unit: "cent"; readonly numerator: number; readonly denominator: 4 };
    }
);
