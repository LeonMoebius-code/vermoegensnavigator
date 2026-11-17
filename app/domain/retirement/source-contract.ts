import type { Ref } from "./identity-contract";

export type ParameterClass = "B" | "A" | "S" | "O";
/** Separate axes for later consumers. A catalog property proves no personal entitlement. */
export type EvidenceStatus = "bestaetigt" | "bedingt" | "ungeklaert" | "nicht_erfuellt";
export type ResultStatus = "aktuell_berechnet" | "bedingt_berechnet" | "nicht_berechenbar" | "veraltet" | "historisch_fixiert";
export type Channel = "source" | "asset" | "display" | "export";
export type Publication =
  | { state: "internal" }
  | { state: "released"; channels: Channel[]; approval: { authority: string; record: string; approvedOn: string } };
export type Citation = { source: Ref<"source">; locator: string };
export type SourceData = {
  title: string;
  documentVersion: string;
  documentHash: string;
  issuedOn: string;
  authority: "legislation" | "manufacturer_final" | "manufacturer_provisional" | "project" | "scenario";
  purpose: "property" | "parameter" | "cost_schedule" | "algorithm" | "reference_cases" | "publication";
};
export type ParameterValue =
  | { class: "B" | "A" | "S"; value: number | string; reason: string }
  | { class: "O"; value: null; reason: string };
