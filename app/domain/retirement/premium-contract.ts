import { AvdError } from "./avd-data";
import type { ParameterClass } from "./source-contract";
import type { Ref } from "./identity-contract";

export const PREMIUM_MODEL = "avd.premium-model.v1";
export const PREMIUM_RULES = "FE-01-D4/2026-11-24";

/** Opaque, non-reused identifiers also work in embedded browser contexts. */
export function newPremiumIdentity(): string {
  const crypto = globalThis.crypto;
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const buffer = crypto.getRandomValues(new Uint8Array(16));
  buffer[6] = (buffer[6] & 0x0f) | 0x40;
  buffer[8] = (buffer[8] & 0x3f) | 0x80;
  const hex = Array.from(buffer, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}


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
