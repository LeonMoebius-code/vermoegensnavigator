import type { Model, Ref } from "./identity-contract";

export type CostComponent = "fund_ter" | "acquisition" | "administration" | "custody" | "transaction" | "payout";
export type Phase = "savings" | "payout";
type Scope = { product: Ref<"product">; tariff: Ref<"tariff">; phase: Phase };
export type Charge = {
  component: CostComponent;
  type: "fixed" | "rate";
  parameter: Ref<"parameter">;
  basis: "balance" | "contribution" | "payment" | "contract";
  timing: {
    frequency: "once" | "monthly" | "annual";
    at: "before_return" | "after_return_before_payment" | "month_end";
    from: string;
    until: string | null;
  };
};
export type CostData = Scope & (
  | {
      phase: "savings"; mode: "K1"; model: "M1" | "M2"; modelVersion: string;
      convention: "M1_additive_v1" | "M2_balance_factor_v1";
      parameter: Ref<"parameter">;
      basis: "effective_yield_reduction";
      notIndividualOffer: true;
      components: CostComponent[];
    }
  | {
      mode: "K2"; tariffEvidence: Ref<"source">;
      coverage: "complete" | "incomplete";
      status: "verified" | "blocked";
      reason: string;
      components: CostComponent[];
      charges: Charge[];
    }
  | { phase: "payout"; mode: "open"; reason: string }
  | { phase: "payout"; mode: "before_payout_costs"; label: "scenario_before_payout_costs" }
  | {
      phase: "payout"; mode: "monthly_fixed_eur"; parameter: Ref<"parameter">;
      convention: "capped_at_available_balance_v1"; components: CostComponent[];
    }
  | {
      phase: "payout"; mode: "annual_balance_ratio"; parameter: Ref<"parameter">;
      convention: "payout_balance_factor_v1"; components: CostComponent[];
    }
);
export type CostSelection = {
  product: Ref<"product">;
  tariff: Ref<"tariff">;
  model: Model;
  modelVersion: string;
  costs: Ref<"cost">[];
  /** Already deducted components must carry their own phase. */
  returns: { basis: "gross" | "net"; deducted: { phase: Phase; component: CostComponent }[] };
};
