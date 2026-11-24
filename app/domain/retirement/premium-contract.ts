import { AvdError } from "./avd-data";
import type { ParameterClass } from "./source-contract";
import type { Ref } from "./identity-contract";

export const PREMIUM_MODEL = "avd.premium-model.v1";
export const PREMIUM_RULES = "FE-01-D4/2026-11-24";

export type Evidence = Readonly<{ class: Exclude<ParameterClass, "O">; source: string; version: string }>;
export type DateWindow = Readonly<{ fromMonth: string; toMonthExclusive: string | null }>;
export type FundingPerspective = "OHNE_ZULAGEN" | "NUR_BELEGTE_HISTORIE" | "BEDINGT_KOMBINIERT";
export type ModelMode = "NEUTRAL" | "M1" | "M2" | "ETF_BRUTTO";
export type Open = Readonly<{ status: "O"; reason: string; path: string; month?: string }>;
export type Computed<T> = Readonly<{ status: "computed"; evidence: Evidence; value: T }>;
export type Outcome<T> = Computed<T> | Open;
export const open = (reason: string, path: string, month?: string): Open =>
  Object.freeze(month ? { status: "O", reason, path, month } : { status: "O", reason, path });

export function modelIssue(error: unknown, month?: string): Open {
  if (error instanceof AvdError) return open(error.code, error.at, month);
  throw error;
}

export interface ProductVersion {
  readonly product: Ref<"product">;
  readonly tariff: Ref<"tariff">;
}
export interface Cashflow {
  readonly id: string;
  readonly month: string;
  readonly kind: "regular" | "special" | "grant" | "tax_reinvestment";
  readonly cents: number;
  readonly contractId: string | null;
  readonly amountEvidence: Evidence;
  readonly allocation?: {
    readonly kind: "weights";
    readonly weightsBps: readonly number[];
    readonly evidence: Evidence;
  } | {
    readonly kind: "pro_rata";
    readonly evidence: Evidence & { readonly class: "S" };
  };
}
