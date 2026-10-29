/** AP-03a V1.0. Public input is primitive canonical JSON, never foreign objects. */
export type Id = string;
export type SourceRef = string;
export type Hash = string;
export type Year = number;
export type Month = string;
export type Date = string;
export type Cents = number;
export type SignedCents = number;
export type UInt = number;
export type Decimal = string;
export type Rate = Decimal;
export type Weight = Decimal;
export type Shock = Decimal;
export type CostRate = Decimal;
export type Pointer = string;
export type Fact<T> = {readonly state:"known";readonly value:T}
  | {readonly state:"unknown";readonly reason:"missing"|"unconfirmed"|"conflicting"|"unsupported"};
export interface Versions {
 readonly modelVersion:Id; readonly inputContractVersion:Id;
 readonly numericConventionVersion:Id; readonly resultContractVersion:Id;
}
export const PROJECTION_VERSIONS: Versions = Object.freeze({
 modelVersion:"ap03a-model-v1.0",inputContractVersion:"ap03a-input-v1.0",
 numericConventionVersion:"ap03a-decimal36-v1.0",resultContractVersion:"ap03a-result-v1.0"
});
export const PROJECTION_LIMITS = Object.freeze({
 inputBytes:16777216, depth:16, entries:10000, sources:10000, bindings:30000,
 detailRows:1200, blocks:120, ticks:1000000, outputBytes:33554432
});
export const ISSUE_ORDER = [
 "invalid_type","invalid_unicode","input_bytes_limit",
 "input_depth_limit","invalid_json","invalid_shape","invalid_value","invalid_calendar","invalid_order",
 "duplicate_identity","inconsistent_input","dangling_source","wrong_operation","noncanonical_json","entry_limit",
 "version_not_supported","detail_rows_limit","evidence_required","input_fact_unknown",
 "annual_total_loss_timing_required","cost_rate_total_loss_timing_required","cost_source_unknown",
 "effective_cost_not_balance_fee","cost_type_not_supported","work_limit","insufficient_fee_basis",
 "numeric_domain_exceeded","precision_ambiguous","allowance_coverage_unknown","basis_mismatch",
 "included_cost_amount_unknown","output_bytes_limit"
] as const;
export type IssueCode = typeof ISSUE_ORDER[number];

export type Source = {
  readonly sourceId: Id,
  readonly kind: "official_rule" | "booking_evidence" | "contract_evidence"
      | "external_rule_result" | "model_assumption" | "technical_contract",
  readonly quality: "confirmed" | "hypothetical" | "unconfirmed" | "conflicting",
  readonly reference: SourceRef,
  readonly version: Id,
  readonly contentHash: Hash | null,
  readonly checkedOn: Date | null,
  readonly effectiveFromMonth: Month | null,
  readonly effectiveToMonth: Month | null
};
export type Binding = {readonly path: Pointer, readonly sourceIds: readonly Id[]};
export type BoundProjection = {readonly parameters: ProjectionSpec, readonly bindings: readonly Binding[]}
;
export type ProjectionRequest = {
  readonly kind: "projection",
  readonly versions: Versions,
  readonly output: OutputRequest,
  readonly sources: readonly Source[],
  readonly projection: BoundProjection
};
export type ComparisonRequest = {
  readonly kind: "comparison",
  readonly versions: Versions,
  readonly output: OutputRequest,
  readonly sources: readonly Source[],
  readonly scenarios: [Scenario, Scenario, Scenario]
};
export type Scenario = {readonly scenarioId:Id, readonly retirement:BoundProjection, readonly reference:BoundProjection};
export type OutputRequest = {readonly mode:"auto" | "detailed" | "compact"}
;
export type ProjectionSpec = {
  readonly projectionId: Id,
  readonly instrument: "retirement_model" | "unfunded_reference",
  readonly period: {readonly startMonth:Month, readonly endMonth:Month},
  readonly initial: {
    readonly balanceCents:Fact<Cents>,
    readonly valuationMonth:Month,
    readonly position:"immediately_before_start"
  },
  readonly rebalancing:"monthly_target_weight",
  readonly contributionSchedule: readonly ContributionChange[],
  readonly oneOffContributions: readonly OwnEvent[],
  readonly grantCoverage: GrantCoverage,
  readonly grantEvents: readonly GrantEvent[],
  readonly marketSchedule: readonly MarketChange[],
  readonly allocationSchedule: readonly AllocationChange[],
  readonly stress: StressEvent | null,
  readonly costs: Costs
};
export type ContributionChange = {readonly fromMonth:Month, readonly monthlyCents:Fact<Cents>};
export type OwnEvent = {readonly eventId:Id, readonly month:Month, readonly cents:Cents};
export type MarketChange = {
  readonly fromMonth:Month,
  readonly equityAnnualReturn:Fact<Rate>,
  readonly bondAnnualReturn:Fact<Rate>
};
export type AllocationChange = {readonly fromMonth:Month, readonly equityWeight:Fact<Weight>};
export type StressEvent = {readonly month:Month, readonly equityShock:Fact<Shock>};
export type GrantCoverage = {
  readonly mode:"complete_events" | "none_assumed" | "unknown",
  readonly unresolvedContributionYears:readonly Year[]
};
export type GrantKey = {
  readonly personId:Id,
  readonly contractId:Id,
  readonly contributionYear:Year,
  readonly component:"base" | "child" | "bonus" | "aggregate",
  readonly childId:Id | null
};
export type ExternalRule = {readonly ruleId:Id, readonly ruleVersion:Id, readonly resultStatus:"calculated"};
export type GrantEvent = {
  readonly eventId:Id,
  readonly grantKey:GrantKey,
  readonly cents:Cents,
  readonly amountBasis:"actual_booking_confirmed" | "external_rule_result" | "hypothetical_amount",
  readonly externalRule:ExternalRule | null,
  readonly sourceBookingRef:Id | null,
  readonly booking:{
    readonly basis:"actual_date_confirmed" | "hypothetical_month_end"
         | "pib_may15_month_end_illustration",
    readonly month:Month,
    readonly referenceDate:Date | null
  }
};
export type Costs = GrossCosts | NetCosts | GrossOnlyCosts;
export type GrossCosts = {
  readonly mode:"gross_plus_explicit_costs",
  readonly coverage:"complete" | "unknown" | "effective_cost_only" | "unsupported_type",
  readonly annualRates:readonly CostChange[],
  readonly fixedFees:readonly FeeEvent[]
};
export type CostChange = {readonly fromMonth:Month, readonly effectiveAnnualReduction:Fact<CostRate>};
export type FeeEvent = {readonly eventId:Id, readonly month:Month, readonly cents:Cents, readonly sourceBookingRef:Id | null};
export type NetCosts = {
  readonly mode:"net_return",
  readonly coverage:"all_costs_included" | "unconfirmed"
};
export type GrossOnlyCosts = {readonly mode:"gross_only", readonly costKnowledge:"not_assessed" | "unknown"}
;
export type Issue = {readonly code:IssueCode, readonly path:Pointer, readonly month:Month | null};
export type Interval = {readonly lowerEuro:Decimal, readonly upperEuro:Decimal};
export type FactorInterval = {readonly lower:Decimal, readonly upper:Decimal};
export type MoneyValue = {
  readonly status:"regelbasiert" | "bestaetigte_eingabe" | "modelliert_unter_annahmen",
  readonly interval:Interval,
  readonly displayCents:SignedCents
};
export type MoneyBlocked = {readonly status:"review_required", readonly issue:Issue};
export type MoneyNA = {readonly status:"not_applicable", readonly reason:"not_computed_in_selected_cost_mode"};
export type MoneyMetric = MoneyValue | MoneyBlocked | MoneyNA
;
export type FlowTotals = {
  readonly regularOwn:MoneyMetric,
  readonly oneOffOwn:MoneyMetric,
  readonly totalOwn:MoneyMetric,
  readonly specifiedAllowances:MoneyMetric,
  readonly marketResult:MoneyMetric,
  readonly stressLoss:MoneyMetric,
  readonly explicitRunningCosts:MoneyMetric,
  readonly explicitFixedCosts:MoneyMetric,
  readonly totalCostAmount:MoneyMetric,
  readonly deductionInThisCalculation:MoneyMetric
};
export type BalanceCheck = {readonly identity:"opening_plus_flows",readonly residualInterval:Interval,readonly status:"interval_consistent"};
export type Summary = {
  readonly initialBalance:MoneyMetric,
  readonly totals:FlowTotals,
  readonly completeAllowanceInflow:MoneyMetric,
  readonly specifiedEndBalance:MoneyMetric,
  readonly completeEndBalance:MoneyMetric,
  readonly beforeCostEndBalance:MoneyMetric,
  readonly afterCostEndBalance:MoneyMetric,
  readonly displayRoundingResidual:MoneyMetric,
  readonly balanceCheck:BalanceCheck | null
};
export type MonthRow = {
  readonly month:Month,
  readonly index:UInt,
  readonly openingBalance:MoneyMetric,
  readonly equityWeight:Decimal,
  readonly bondWeight:Decimal,
  readonly equityOpening:MoneyMetric,
  readonly bondOpening:MoneyMetric,
  readonly equityFactor:FactorInterval,
  readonly bondFactor:FactorInterval,
  readonly stressApplied:boolean,
  readonly stressedEquityBasis:MoneyMetric,
  readonly totals:FlowTotals,
  readonly closingBalance:MoneyMetric,
  readonly displayRoundingResidual:MoneyMetric,
  readonly balanceCheck:BalanceCheck,
  readonly appliedSourcePaths:readonly Pointer[],
  readonly ownEventIds:readonly Id[],
  readonly grantEventIds:readonly Id[],
  readonly feeEventIds:readonly Id[]
};
export type BlockRow = {
  readonly startMonth:Month,
  readonly endMonth:Month,
  readonly monthCount:UInt,
  readonly openingBalance:MoneyMetric,
  readonly closingBalance:MoneyMetric,
  readonly totals:FlowTotals,
  readonly displayRoundingResidual:MoneyMetric,
  readonly balanceCheck:BalanceCheck,
  readonly appliedSourcePaths:readonly Pointer[],
  readonly ownEventIds:readonly Id[],
  readonly grantEventIds:readonly Id[],
  readonly feeEventIds:readonly Id[]
};
export type ExcludedEvent = {
  readonly eventType:"grant" | "fixed_fee",
  readonly eventId:Id,
  readonly month:Month,
  readonly cents:Cents,
  readonly reason:"after_end_not_booked"
};
export type ProjectionResult = {
  readonly projectionId:Id,
  readonly instrument:"retirement_model" | "unfunded_reference",
  readonly status:"calculated" | "partial" | "review_required",
  readonly period:{readonly startMonth:Month,readonly endMonth:Month,readonly monthCount:UInt},
  readonly valueBasis:"before_costs" | "after_explicit_costs" | "after_included_costs",
  readonly returnBasis:"gross_before_costs" | "net_of_included_costs",
  readonly allowanceCoverage:"complete_events" | "none_assumed" | "unknown",
  readonly unresolvedContributionYears:readonly Year[],
  readonly summary:Summary,
  readonly ledger:DetailedLedger | CompactLedger | null,
  readonly excludedEvents:readonly ExcludedEvent[],
  readonly primaryIssue:Issue | null
};
export type DetailedLedger = {readonly mode:"detailed",readonly rows:readonly MonthRow[]};
export type CompactLedger = {readonly mode:"compact",readonly blockSizeMonths:UInt,readonly blocks:readonly BlockRow[]};
export type ScenarioComparison = {
  readonly scenarioId:Id,
  readonly retirementProjectionId:Id,
  readonly referenceProjectionId:Id,
  readonly status:"calculated" | "partial" | "review_required",
  readonly basis:"same_own_cashflows",
  readonly completeDifference:MoneyMetric,
  readonly specifiedDifference:MoneyMetric,
  readonly primaryIssue:Issue | null
};
export type SourceManifestItem = {readonly sourceId:Id,readonly version:Id,readonly contentHash:Hash | null};
export type Response = {
  readonly operation:"projection" | "comparison" | null,
  readonly status:"calculated" | "partial" | "review_required" | "invalid_input" | "resource_error",
  readonly supportedVersions:Versions,
  readonly requestedVersions:Versions | null,
  readonly requestHash:Hash | null,
  readonly sourceManifest:readonly SourceManifestItem[],
  readonly projectionResults:readonly ProjectionResult[],
  readonly comparisonResults:readonly ScenarioComparison[],
  readonly primaryIssue:Issue | null
};
