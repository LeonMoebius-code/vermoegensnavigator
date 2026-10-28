import { calculateDirectGrant } from "../../domain/retirement/direct-grant";
import type { DirectGrantChild, DirectGrantInput, DirectGrantResult } from "../../domain/retirement/direct-grant-contract";

/** Presentation-only, never an AdvisoryCase or a persisted retirement identity. */
export interface GrantDraft {
  year: number;
  entitlement: DirectGrantInput["entitlement"];
  regime: DirectGrantInput["regime"];
  contract: DirectGrantInput["eligibleContractContext"];
  childrenStatus: "unconfirmed" | "none_confirmed" | "assigned_confirmed" | "conflicting";
  children: readonly { id: string; status: DirectGrantChild["status"] }[];
  mode: "annual" | "monthly";
  annual: string;
  monthly: string;
  startMonth: string;
  months: string;
  hasOneOff: boolean;
  oneOff: string;
  quality: "unconfirmed" | "planned" | "actual";
  contributionConfirmed: boolean;
}
export const emptyGrantDraft = (): GrantDraft => ({ year: 2027, entitlement: "unconfirmed",
  regime: "unconfirmed", contract: "unconfirmed", childrenStatus: "unconfirmed", children: [],
  mode: "annual", annual: "", monthly: "", startMonth: "", months: "", hasOneOff: false,
  oneOff: "", quality: "unconfirmed", contributionConfirmed: false });
export type DraftField = keyof GrantDraft;
export type Contribution = { status: "valid"; cents: number; terms: readonly number[] }
  | { status: "invalid_input"; field: DraftField; message: string };
export type Preview = { status: "calculated"; result: Extract<DirectGrantResult, { status: "calculated" }>;
  annualCents: number; input: DirectGrantInput }
  | { status: "review_required" | "unsupported" | "invalid_input"; field?: DraftField;
      message: string; domain?: DirectGrantResult };

/** Decimal strings -> BigInt cents -> checked safe integer. No floating money conversion. */
export function parseEuroCents(raw: string): number | null {
  if (typeof raw !== "string" || raw.length > 128) return null;
  const text = raw.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) return null;
  const [euros, fraction = ""] = text.split(",");
  const cents = BigInt(euros.replace(/\./g, "")) * 100n + BigInt(fraction.padEnd(2, "0"));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}
export function euro(cents: number): string {
  const value = BigInt(cents);
  return `${(value / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${(value % 100n).toString().padStart(2, "0")} €`;
}
export function annualContribution(draft: GrantDraft): Contribution {
  const invalid = (field: DraftField, message: string): Contribution => ({ status: "invalid_input", field, message });
  const amountError = "Nichtnegativen Eurobetrag mit höchstens zwei Nachkommastellen eingeben, z. B. 120,01. Leer ist keine Null; keine Rundung.";
  if (draft.mode === "annual") {
    const cents = parseEuroCents(draft.annual);
    return cents === null ? invalid("annual", amountError) : { status: "valid", cents, terms: [cents] };
  }
  const monthly = parseEuroCents(draft.monthly);
  if (monthly === null) return invalid("monthly", amountError);
  if (!/^(?:[1-9]|1[0-2])$/.test(draft.startMonth)) return invalid("startMonth", "Startmonat im Beitragsjahr ausdrücklich auswählen.");
  if (!/^(?:[1-9]|1[0-2])$/.test(draft.months) || Number(draft.months) > 13 - Number(draft.startMonth))
    return invalid("months", "Beitragswirksame Monatsanzahl innerhalb des gewählten Kalenderjahrs auswählen; Oktober erlaubt höchstens drei Raten.");
  const oneOff = draft.hasOneOff ? parseEuroCents(draft.oneOff) : 0;
  if (oneOff === null) return invalid("oneOff", amountError);
  const total = BigInt(monthly) * BigInt(draft.months) + BigInt(oneOff);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) return invalid("monthly", "Jahressumme überschreitet die sichere Ganzzahl-Centgrenze.");
  return { status: "valid", cents: Number(total), terms: [monthly, Number(draft.months), oneOff] };
}
export function changeYear(draft: GrantDraft, year: number): GrantDraft {
  return { ...draft, year, entitlement: "unconfirmed", regime: "unconfirmed", contract: "unconfirmed",
    childrenStatus: "unconfirmed", children: draft.children.map(c => ({ ...c, status: "assignment_unconfirmed" })),
    quality: "unconfirmed", contributionConfirmed: false };
}
export function changeMode(draft: GrantDraft, mode: GrantDraft["mode"]): GrantDraft {
  return { ...draft, mode, annual: "", monthly: "", startMonth: "", months: "", hasOneOff: false,
    oneOff: "", contributionConfirmed: false };
}
/** No grant formula here. Unconfirmed child lists never reach the domain as []. */
export function previewGrant(draft: GrantDraft): Preview {
  const stop = (status: "review_required" | "unsupported" | "invalid_input", field: DraftField, message: string): Preview => ({ status, field, message });
  if (draft.year !== 2027 && draft.year !== 2028) return stop(draft.year < 2027 ? "unsupported" : "review_required", "year", "Nur 2027 und 2028 besitzen einen geprüften neuen Regelstand.");
  if (draft.entitlement === "unconfirmed") return stop("review_required", "entitlement", "Unmittelbare Berechtigung für diese Person und dieses Beitragsjahr vorgelagert bestätigen.");
  if (draft.regime === "unconfirmed") return stop("review_required", "regime", "Neues Förderregime einschließlich eines etwaigen wirksamen Wechsels bestätigen.");
  if (draft.contract === "unconfirmed" || draft.contract === "transition_unconfirmed") return stop("review_required", "contract", "Genau einen zulässigen förderfähigen Vertrag und die Übergangszuordnung bestätigen.");
  if (draft.childrenStatus === "unconfirmed" || draft.childrenStatus === "conflicting") return stop("review_required", "childrenStatus", "Vollständige Kinderzuordnung für diese Person und dieses Beitragsjahr fachlich klären und bestätigen.");
  if ((draft.childrenStatus === "none_confirmed" && draft.children.length !== 0)
    || (draft.childrenStatus === "assigned_confirmed" && draft.children.length === 0))
    return stop("review_required", "childrenStatus", "Kinderentscheidung und Kinderliste widersprechen sich; bitte korrigieren.");
  if (draft.children.some(c => c.status !== "eligible_assigned_confirmed")) return stop("review_required", "children", "Förderfähigkeit und Zuordnung jedes Kindes für das gewählte Jahr ausdrücklich bestätigen.");
  const contribution = annualContribution(draft);
  if (contribution.status !== "valid") return contribution;
  if (contribution.cents > 684000) return stop("review_required", draft.mode === "annual" ? "annual" : "monthly", "Jahreseigenbeitrag über 6.840 €: außerhalb des geprüften UI-Standards. Rechtliche und Anbietergrenzen gesondert prüfen; keine Kappung oder Förderzahl.");
  if (draft.quality === "unconfirmed" || !draft.contributionConfirmed) return stop("review_required", "contributionConfirmed", "Geplanten oder tatsächlich gezahlten förderfähigen Jahres-Eigenbeitrag ausdrücklich bestätigen; keine Zulagen, Erträge oder Überträge einbeziehen.");
  const input: DirectGrantInput = { contributionYear: draft.year,
    ruleContext: draft.year === 2027 ? "estg-2027-v1" : "estg-2028-v1",
    entitlement: draft.entitlement, regime: draft.regime, eligibleContractContext: draft.contract,
    eligibleOwnContributionCents: contribution.cents,
    children: draft.children.map(c => ({ ...c, contributionYear: draft.year })), pendingEvidence: ["bonus"] };
  const result = calculateDirectGrant(input);
  return result.status === "calculated" ? { status: "calculated", result, input, annualCents: contribution.cents }
    : { status: result.status, message: result.issue.message, domain: result };
}
