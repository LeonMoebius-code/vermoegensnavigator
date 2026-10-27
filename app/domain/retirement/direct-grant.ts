import type { DirectGrantInput, DirectGrantIssueCode, DirectGrantResult, DirectGrantRuleContext } from "./direct-grant-contract";
import { directGrantRuleContext } from "./direct-grant-rules";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function keysAllowed(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Reflect.ownKeys(value).every(key => typeof key === "string" && keys.includes(key))
    && Object.values(Object.getOwnPropertyDescriptors(value)).every(d => "value" in d);
}
function member(value: unknown, choices: readonly string[]): boolean {
  return typeof value === "string" && choices.includes(value);
}
function context(ruleContext: DirectGrantRuleContext | null) {
  return {
    ruleContext,
    bonus: { status: "not_calculated_requires_review" as const, includedInTotal: false as const },
    notice: "Jahresbezogene Modellrechnung; keine individuelle Förderzusage. Einmalbonus gesondert prüfen." as const,
  };
}
function stopped(status: "review_required" | "unsupported" | "invalid_input", code: DirectGrantIssueCode,
  message: string, rules: DirectGrantRuleContext | null = null): DirectGrantResult {
  return { ...context(rules), status, issue: { code, message } };
}

/** Runtime boundary accepts untrusted plain data; no coercion, inference or mutation. */
export function calculateDirectGrant(input: unknown): DirectGrantResult {
  if (!record(input) || !keysAllowed(input, ["contributionYear", "ruleContext", "entitlement", "regime",
    "eligibleOwnContributionCents", "eligibleContractContext", "children", "pendingEvidence"])) {
    return stopped("invalid_input", "invalid_shape", "Einzelpersonen-Eingabe mit ausschließlich bekannten Datenfeldern erforderlich.");
  }
  if (!Number.isSafeInteger(input.contributionYear) || (input.contributionYear as number) < 100 || (input.contributionYear as number) > 9999) {
    return stopped("invalid_input", "invalid_year", "Kalenderjahr 0100–9999 als sichere Ganzzahl erforderlich.");
  }
  if (!member(input.ruleContext, ["estg-2027-v1", "estg-2028-v1"])
    || !member(input.entitlement, ["direct_confirmed", "unconfirmed", "indirect", "ineligible"])
    || !member(input.regime, ["new_confirmed", "old", "unconfirmed"])
    || !member(input.eligibleContractContext, ["single_eligible_confirmed", "multiple", "transition_unconfirmed", "unconfirmed"])
    || !Array.isArray(input.children)
    || (input.pendingEvidence !== undefined && (!Array.isArray(input.pendingEvidence)
      || !Array.from(input.pendingEvidence).every(x => member(x, ["entitlement", "regime", "contract", "children", "bonus"]))))) {
    return stopped("invalid_input", "invalid_shape", "Vollständige typisierte Statusangaben und Kinderliste erforderlich.");
  }
  const rules = directGrantRuleContext(input.ruleContext as DirectGrantInput["ruleContext"]);
  if (!Number.isSafeInteger(input.eligibleOwnContributionCents) || (input.eligibleOwnContributionCents as number) < 0
    || Object.is(input.eligibleOwnContributionCents, -0)) {
    return stopped("invalid_input", "invalid_contribution", "Nichtnegative sichere Ganzzahl in Jahres-Cent erforderlich; keine Zahlenkorrektur.", rules);
  }
  const ids = new Set<string>();
  for (const child of input.children) {
    if (!record(child) || !keysAllowed(child, ["id", "contributionYear", "status"])
      || typeof child.id !== "string" || child.id.trim() !== child.id || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(child.id)
      || !Number.isSafeInteger(child.contributionYear) || (child.contributionYear as number) < 100 || (child.contributionYear as number) > 9999
      || !member(child.status, ["eligible_assigned_confirmed", "eligibility_unconfirmed", "assignment_unconfirmed", "conflicting_assignment"])) {
      return stopped("invalid_input", "invalid_child", "Kind benötigt lesbare technische ID, Kalenderjahr und ausdrücklichen Prüfstatus.", rules);
    }
    if (ids.has(child.id)) return stopped("invalid_input", "duplicate_child_id", "Doppelte Kind-ID; keine automatische Zusammenfassung oder Doppelzählung.", rules);
    ids.add(child.id);
  }
  const data = input as unknown as DirectGrantInput;
  if (data.contributionYear < 2027) return stopped("unsupported", "year_before_new_regime", "Förderjahre vor 2027 sind nicht Bestandteil dieses Kerns.", rules);
  if (data.contributionYear > 2028) return stopped("review_required", "year_not_approved", "Für dieses Beitragsjahr ist kein Regelstand freigegeben.", rules);
  if (data.contributionYear !== rules.contributionYear) return stopped("review_required", "rule_year_mismatch", "Regelstand und Beitragsjahr stimmen nicht überein.", rules);
  if (data.entitlement === "unconfirmed") return stopped("review_required", "entitlement_unconfirmed", "Unmittelbare gesetzliche Berechtigung muss vorgelagert bestätigt werden.", rules);
  if (data.entitlement !== "direct_confirmed") return stopped("unsupported", "entitlement_out_of_scope", "Nur eine unmittelbar berechtigte Person wird unterstützt.", rules);
  if (data.regime === "old") return stopped("unsupported", "old_regime", "Alte Riester-Förderung ist nicht implementiert.", rules);
  if (data.regime !== "new_confirmed") return stopped("review_required", "regime_unconfirmed", "Neues Förderregime einschließlich etwaigem wirksamem Wechsel muss bestätigt sein.", rules);
  if (data.eligibleContractContext === "multiple") return stopped("unsupported", "multiple_contracts", "Mehrvertragszuordnung und Partnerberechnung sind nicht implementiert.", rules);
  if (data.eligibleContractContext !== "single_eligible_confirmed") return stopped("review_required", "contract_unconfirmed", "Genau ein zulässiger Vertrag einschließlich Übergangszuordnung muss bestätigt sein.", rules);
  if (data.children.some(child => child.contributionYear !== data.contributionYear || child.status !== "eligible_assigned_confirmed")) {
    return stopped("review_required", "child_confirmation_required", "Jedes Kind muss dieser Person im zutreffenden Beitragsjahr rechtswirksam zugeordnet und förderfähig sein.", rules);
  }
  if (data.pendingEvidence?.some(item => item !== "bonus")) return stopped("review_required", "pending_evidence", "Ein erforderlicher Berechtigungs-, Regime-, Vertrags- oder Kindernachweis ist noch offen.", rules);

  const cents = data.eligibleOwnContributionCents;
  // Numerator is bounded by 216000. Integer quarter-cents avoid binary rounding.
  const numerator = cents < 12000 ? 0 : 2 * Math.min(cents, 36000) + Math.min(Math.max(cents - 36000, 0), 144000);
  if (numerator % 4 !== 0) {
    return { ...context(rules), status: "review_required",
      issue: { code: "rounding_convention_required", message: "Grundzulage enthält Centbruchteil; endgültige Cent-/ZfA-Konvention ist nicht freigegeben." },
      openRounding: { component: "baseGrant", unit: "cent", numerator, denominator: 4 } };
  }
  const baseGrantCents = numerator / 4;
  const childCents = cents < 12000 ? 0 : Math.min(cents, 30000);
  const childGrants = data.children.map(child => ({ childId: child.id, grantCents: childCents }));
  const childrenGrantCents = childCents * childGrants.length;
  return { ...context(rules), status: "calculated", scope: "confirmed_direct_single_contract_standard",
    contributionYear: rules.contributionYear, baseGrantCents, childGrants, childrenGrantCents,
    totalGrantCents: baseGrantCents + childrenGrantCents, roundingStatus: "exact_integer_cents" };
}
