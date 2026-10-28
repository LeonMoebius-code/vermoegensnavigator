import { calculateOldRiesterGrant } from "../../domain/retirement/old-riester-grant";
import { calculateDirectGrant } from "../../domain/retirement/direct-grant";
import type { OldRiesterGrantInput, OldRiesterGrantResult, OldRiesterChild } from "../../domain/retirement/old-riester-grant-contract";
import type { DirectGrantInput, DirectGrantResult } from "../../domain/retirement/direct-grant-contract";
import { annualContribution, emptyGrantDraft, parseEuroCents, type GrantDraft } from "./direct-grant-adapter";

type ContributionFields = Pick<GrantDraft, "mode" | "annual" | "monthly" | "startMonth" | "months" | "hasOneOff" | "oneOff" | "contributionConfirmed">;
type ChildChoice = "unconfirmed" | "none_confirmed" | "list_confirmed" | "conflicting";
export interface OldChildDraft {
  id: string; birthYear: string; contributionYear: number; ruleContext: string; assignment: OldRiesterChild["assignment"];
}
export interface NewScenario {
  year: number;
  entitlement: DirectGrantInput["entitlement"];
  regime: DirectGrantInput["regime"];
  contract: DirectGrantInput["eligibleContractContext"];
  childrenStatus: ChildChoice;
  children: readonly DirectGrantInput["children"][number][];
  scenarioConfirmed: boolean;
  transitionConfirmed: boolean;
  contributionConfirmed: boolean;
}
export interface OldDraft extends ContributionFields {
  year: number;
  entitlement: OldRiesterGrantInput["entitlement"];
  regime: OldRiesterGrantInput["regime"];
  contract: OldRiesterGrantInput["contract"];
  incomeBasis: OldRiesterGrantInput["incomeBasis"];
  income: string; incomeYear: string;
  partner: OldRiesterGrantInput["partner"];
  bonus: OldRiesterGrantInput["bonus"];
  childrenStatus: ChildChoice;
  children: readonly OldChildDraft[];
  quality: GrantDraft["quality"] | "conflicting" | "ineligible";
  evidenceQuality: OldRiesterGrantInput["evidenceQuality"];
  correction: OldRiesterGrantInput["correction"];
  newScenario: NewScenario;
  comparisonConfirmed: boolean;
}
export type OldField = keyof OldDraft;
type Stop = { status: "invalid_input" | "review_required" | "unsupported"; message: string; field?: OldField };
export type OldPreview = Stop | { status: "calculated"; result: Extract<OldRiesterGrantResult, { status: "calculated" }>; input: OldRiesterGrantInput; annualCents: number };
export type NewPreview = Stop | { status: "calculated"; result: Extract<DirectGrantResult, { status: "calculated" }>; input: DirectGrantInput; annualCents: number };
export interface Comparison { old: OldPreview; newer: NewPreview; deltaCents?: number }
export function oldRuleId(year: number): string {
  return year === 2026 ? "alt-2026-checked-20261028" : year === 2027 ? "alt-bestand-2027-checked-20261028"
    : year === 2028 ? "alt-bestand-2028-checked-20261028" : "";
}
export const emptyNewScenario = (year: number): NewScenario => ({ year, entitlement: "unconfirmed", regime: "unconfirmed", contract: "unconfirmed",
  childrenStatus: "unconfirmed", children: [], scenarioConfirmed: false, transitionConfirmed: false, contributionConfirmed: false });
export const emptyOldDraft = (): OldDraft => {
  const a = emptyGrantDraft();
  return { year: 2027, entitlement: "unconfirmed", regime: "unconfirmed", contract: "unconfirmed", incomeBasis: "unconfirmed",
    income: "", incomeYear: "", partner: "unconfirmed", bonus: "unconfirmed", childrenStatus: "unconfirmed", children: [],
    mode: a.mode, annual: "", monthly: "", startMonth: "", months: "", hasOneOff: false, oneOff: "", quality: "unconfirmed",
    contributionConfirmed: false, evidenceQuality: "unconfirmed", correction: "unconfirmed", newScenario: emptyNewScenario(2027), comparisonConfirmed: false };
};
export function changeOldYear(draft: OldDraft, year: number): OldDraft {
  return { ...draft, year, entitlement: "unconfirmed", regime: "unconfirmed", contract: "unconfirmed", incomeBasis: "unconfirmed", incomeYear: "",
    partner: "unconfirmed", bonus: "unconfirmed", childrenStatus: "unconfirmed",
    children: draft.children.map(c => ({ ...c, contributionYear: year, ruleContext: oldRuleId(year), assignment: "assignment_unconfirmed" })),
    quality: "unconfirmed", contributionConfirmed: false, evidenceQuality: "unconfirmed", correction: "unconfirmed",
    newScenario: emptyNewScenario(year), comparisonConfirmed: false };
}
export function changeOldMode(draft: OldDraft, mode: OldDraft["mode"]): OldDraft {
  return { ...draft, mode, annual: "", monthly: "", startMonth: "", months: "", hasOneOff: false, oneOff: "", contributionConfirmed: false,
    evidenceQuality: "unconfirmed", newScenario: { ...draft.newScenario, contributionConfirmed: false }, comparisonConfirmed: false };
}

/** Copy data descriptors before reading any caller value or traversing an array.
 * No getters, own iterators, sparse/subclass arrays or implicit coercion. */
function plainSnapshot(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0)) return value;
  if (typeof value !== "object") throw new Error("data required");
  const array = Array.isArray(value);
  const proto = Object.getPrototypeOf(value);
  if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new Error("plain data required");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(k => typeof k !== "string" || !("value" in descriptors[k]))) throw new Error("data descriptors required");
  if (array) {
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) throw new Error("dense array required");
    const copy = [];
    for (let i = 0; i < length; i++) {
      if (!descriptors[String(i)]) throw new Error("dense array required");
      copy.push(plainSnapshot(descriptors[String(i)].value));
    }
    return copy;
  }
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of keys as string[]) copy[key] = plainSnapshot(descriptors[key].value);
  return copy;
}
function exactKeys(data: object, keys: readonly string[]): boolean {
  return Object.keys(data).length === keys.length && keys.every(k => Object.hasOwn(data, k));
}
function checkedDraft(input: unknown): OldDraft {
  const d = plainSnapshot(input) as OldDraft;
  const template = emptyOldDraft();
  if (!d || Array.isArray(d) || !exactKeys(d, Object.keys(template))) throw new Error("draft shape");
  for (const key of Object.keys(template) as OldField[]) {
    if (key !== "children" && key !== "newScenario" && typeof d[key] !== typeof template[key]) throw new Error("draft types");
  }
  if (!["annual", "monthly"].includes(d.mode) || !["unconfirmed", "planned", "actual", "conflicting", "ineligible"].includes(d.quality)
    || !["unconfirmed", "none_confirmed", "list_confirmed", "conflicting"].includes(d.childrenStatus) || !Array.isArray(d.children)) throw new Error("draft values");
  for (const c of d.children) if (!c || !exactKeys(c, ["id", "birthYear", "contributionYear", "ruleContext", "assignment"])
    || typeof c.id !== "string" || typeof c.birthYear !== "string" || typeof c.contributionYear !== "number"
    || typeof c.ruleContext !== "string" || typeof c.assignment !== "string") throw new Error("child shape");
  const n = d.newScenario;
  if (!n || Array.isArray(n) || !exactKeys(n, Object.keys(emptyNewScenario(d.year))) || !Array.isArray(n.children)) throw new Error("scenario shape");
  for (const key of Object.keys(emptyNewScenario(d.year)) as (keyof NewScenario)[])
    if (key !== "children" && typeof n[key] !== typeof emptyNewScenario(d.year)[key]) throw new Error("scenario types");
  if (!["unconfirmed", "none_confirmed", "list_confirmed", "conflicting"].includes(n.childrenStatus)) throw new Error("scenario children");
  for (const c of n.children) if (!c || !exactKeys(c, ["id", "contributionYear", "status"]) || typeof c.id !== "string"
    || typeof c.contributionYear !== "number" || typeof c.status !== "string") throw new Error("scenario child shape");
  return d;
}
const stop = (status: Stop["status"], message: string, field?: OldField): Stop => ({ status, message, field });
const malformed = () => stop("invalid_input", "Vollständige einfache Eingabedaten erforderlich; Datentypen und Kinderliste korrigieren.");
function contribution(d: OldDraft) {
  // Reuse exactly the AP04a parser and safe monthly arithmetic, without its new-law cap.
  return annualContribution({ ...emptyGrantDraft(), mode: d.mode, annual: d.annual, monthly: d.monthly,
    startMonth: d.startMonth, months: d.months, hasOneOff: d.hasOneOff, oneOff: d.oneOff });
}
export function oldContribution(d: OldDraft) { return contribution(d); }
function oldChecked(d: OldDraft): OldPreview {
  const income = d.income === "" ? null : parseEuroCents(d.income);
  if (d.income !== "" && income === null) return stop("invalid_input", "RV-Vorjahresbetrag exakt in Euro eingeben; leer ist unbekannt, 0,00 ist möglich.", "income");
  const own = contribution(d);
  if (own.status !== "valid") return stop("invalid_input", own.message, own.field as OldField);
  if (!/^\d{4}$/.test(d.incomeYear)) return stop("review_required", "Das konkrete RV-Bemessungsjahr t−1 ausdrücklich auswählen und nachweisen.", "incomeYear");
  const children: OldRiesterChild[] = [];
  for (const c of d.children) {
    if (!/^\d{4}$/.test(c.birthYear)) return stop("invalid_input", "Geburtsjahr jedes Kindes als vierstelliges Kalenderjahr eingeben.", "children");
    children.push({ id: c.id, birthYear: Number(c.birthYear), contributionYear: c.contributionYear, ruleContext: c.ruleContext, assignment: c.assignment });
  }
  if (d.childrenStatus === "none_confirmed" && children.length || d.childrenStatus === "list_confirmed" && !children.length)
    return stop("review_required", "Vollständige Kinderentscheidung und Liste müssen übereinstimmen.", "childrenStatus");
  const input: OldRiesterGrantInput = {
    contributionYear: d.year, ruleContext: oldRuleId(d.year), entitlement: d.entitlement, regime: d.regime, contract: d.contract,
    incomeBasis: d.incomeBasis, priorYearIncomeCents: income, incomeYear: Number(d.incomeYear), partner: d.partner, bonus: d.bonus,
    childrenStatus: d.childrenStatus === "none_confirmed" || d.childrenStatus === "list_confirmed" ? "complete_confirmed" : d.childrenStatus,
    children, eligibleOwnContributionCents: own.cents,
    contributionQuality: !d.contributionConfirmed ? "unconfirmed" : d.quality === "actual" ? "actual_confirmed" : d.quality === "planned" ? "planned_confirmed" : d.quality,
    evidenceQuality: d.evidenceQuality, pendingEvidence: [], correction: d.correction,
  };
  const result = calculateOldRiesterGrant(input);
  return result.status === "calculated" ? { status: "calculated", result, input, annualCents: own.cents }
    : stop(result.status, `${result.issue.message} (${result.issue.code})`);
}
export function previewOldGrant(input: unknown): OldPreview {
  try { return oldChecked(checkedDraft(input)); } catch { return malformed(); }
}
function newChecked(d: OldDraft): NewPreview {
  if (d.year === 2026) return stop("unsupported", "Für 2026 ist kein neues Fördermodell unterstützt.");
  if (d.year !== 2027 && d.year !== 2028) return stop("review_required", "Neues Fördermodell nur für 2027/2028 geprüft.");
  const n = d.newScenario;
  if (n.year !== d.year || !n.scenarioConfirmed || !n.transitionConfirmed)
    return stop("review_required", "Neue hypothetische Standardkonstellation und Übergangsannahme für dieses Jahr separat fachlich prüfen und bestätigen.", "newScenario");
  if (n.childrenStatus === "unconfirmed" || n.childrenStatus === "conflicting"
    || n.childrenStatus === "none_confirmed" && n.children.length || n.childrenStatus === "list_confirmed" && !n.children.length)
    return stop("review_required", "Vollständige neue Kinderzuordnung nach eigenem Jahresrecht separat bestätigen.", "newScenario");
  const own = contribution(d);
  if (own.status !== "valid") return stop("invalid_input", own.message, own.field as OldField);
  if (own.cents > 684000) return stop("review_required", "Neuer Jahresbeitrag über 6.840 €: außerhalb des geprüften UI-Standards; keine Kappung.");
  if (!n.contributionConfirmed) return stop("review_required", "Denselben förderfähigen Jahres-Eigenbeitrag für die neue Szenariokonstellation bestätigen.", "newScenario");
  const input: DirectGrantInput = { contributionYear: d.year, ruleContext: d.year === 2027 ? "estg-2027-v1" : "estg-2028-v1",
    entitlement: n.entitlement, regime: n.regime, eligibleContractContext: n.contract, children: n.children,
    eligibleOwnContributionCents: own.cents, pendingEvidence: ["bonus"] };
  const result = calculateDirectGrant(input);
  return result.status === "calculated" ? { status: "calculated", result, input, annualCents: own.cents }
    : stop(result.status, `${result.issue.message} (${result.issue.code})`);
}
export function previewComparison(input: unknown): Comparison {
  try {
    const d = checkedDraft(input), old = oldChecked(d), newer = newChecked(d);
    return { old, newer, ...(d.comparisonConfirmed && old.status === "calculated" && newer.status === "calculated"
      && old.annualCents === newer.annualCents ? { deltaCents: newer.result.totalGrantCents - old.result.totalGrantCents } : {}) };
  } catch { return { old: malformed(), newer: malformed() }; }
}
