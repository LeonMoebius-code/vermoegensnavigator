import type { OldRiesterGrantInput, OldRiesterGrantResult, OldRiesterIssueCode, OldRiesterRuleContext } from "./old-riester-grant-contract";
import { oldRiesterRuleContext } from "./old-riester-grant-rules";

const statuses = {
  entitlement: ["direct_old_confirmed", "unconfirmed", "conflicting", "timeline_unconfirmed", "indirect", "ineligible"],
  regime: ["old_2026_confirmed", "old_protected_confirmed", "unconfirmed", "conflicting", "new_confirmed"],
  contract: ["single_private_eligible_confirmed", "unconfirmed", "conflicting", "transition_unconfirmed", "multiple", "multiple_and_new_regime", "housing", "occupational", "ineligible"],
  incomeBasis: ["simple_domestic_prior_rv_confirmed", "unconfirmed", "conflicting", "special"],
  partner: ["none_relevant_confirmed", "direct_independent_confirmed", "unconfirmed", "conflicting", "indirect_included", "indirect_new_direct_old"],
  bonus: ["age_excluded_confirmed", "history_no_current_confirmed", "unconfirmed", "conflicting", "current_year_confirmed"],
  childrenStatus: ["complete_confirmed", "unconfirmed", "conflicting"],
  contributionQuality: ["actual_confirmed", "planned_confirmed", "unconfirmed", "conflicting", "ineligible"],
  evidenceQuality: ["confirmed", "unconfirmed", "conflicting"],
  correction: ["none_confirmed", "unconfirmed", "conflicting", "retrospective"],
} as const;
const topics = ["entitlement", "regime", "contract", "income", "partner", "bonus", "children", "contribution", "correction"] as const;
const childStatuses = ["eligible_assigned_confirmed", "eligibility_unconfirmed", "assignment_unconfirmed", "conflicting_assignment"];

/** Snapshot data descriptors, never input getters/methods. Throwing structure probes are caught by API. */
function dataRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value as object);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.length !== keys.length) return null;
  const result: Record<string, unknown> = Object.create(null);
  for (const key of ownKeys) {
    if (typeof key !== "string" || !keys.includes(key) || !("value" in descriptors[key])) return null;
    result[key] = descriptors[key].value;
  }
  return result;
}
function dataArray(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value as object);
  const length = descriptors.length;
  if (!length || !("value" in length) || typeof length.value !== "number" || !Number.isSafeInteger(length.value) || length.value < 0) return null;
  const ownKeys = Reflect.ownKeys(descriptors);
  // Dense arrays only. Reject own iterators, accessors, methods, symbols and extra fields.
  if (ownKeys.length !== length.value + 1) return null;
  const copy: unknown[] = [];
  for (const key of ownKeys) {
    if (typeof key !== "string" || !("value" in descriptors[key])) return null;
    if (key === "length") continue;
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= length.value || String(index) !== key) return null;
    copy[index] = descriptors[key].value;
  }
  return copy;
}
function member(value: unknown, choices: readonly string[]): boolean {
  return typeof value === "string" && choices.includes(value);
}
function cents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}
function year(value: unknown): value is number {
  return cents(value) && value >= 100 && value <= 9999;
}
const notice = "Jahresbezogene Modellrechnung; keine individuelle Förderzusage." as const;
function stopped(status: "invalid_input" | "review_required" | "unsupported", code: OldRiesterIssueCode,
  message: string, ruleContext: OldRiesterRuleContext | null = null): OldRiesterGrantResult {
  return { status, issue: { code, message }, ruleContext, notice };
}

/** All required rounding is nearest-integer; exact ties have no authorized direction. */
function unambiguousNearest(n: bigint, d: bigint): bigint | null {
  const remainder = n % d;
  if (2n * remainder === d) return null;
  return n / d + (2n * remainder > d ? 1n : 0n);
}

export function calculateOldRiesterGrant(input: unknown): OldRiesterGrantResult {
  try { return checked(input); }
  catch { return stopped("invalid_input", "invalid_shape", "Eingabe konnte nicht sicher als einfache Daten geprüft werden."); }
}
function checked(input: unknown): OldRiesterGrantResult {
  const raw = dataRecord(input, [...Object.keys(statuses), "contributionYear", "ruleContext", "priorYearIncomeCents",
    "incomeYear", "children", "eligibleOwnContributionCents", "pendingEvidence"]);
  if (!raw) return stopped("invalid_input", "invalid_shape", "Vollständige Einzelpersonenstruktur mit bekannten Datenfeldern erforderlich.");
  if (!year(raw.contributionYear) || !year(raw.incomeYear))
    return stopped("invalid_input", "invalid_year", "Kalenderjahre 0100–9999 als sichere Ganzzahlen erforderlich.");
  for (const key of Object.keys(statuses) as (keyof typeof statuses)[]) {
    if (!member(raw[key], statuses[key])) return stopped("invalid_input", "invalid_shape", "Typisierter Nachweisstatus erforderlich.");
  }
  if (typeof raw.ruleContext !== "string") return stopped("invalid_input", "invalid_shape", "Explizite Regel-ID als Zeichenkette erforderlich.");
  const rules = oldRiesterRuleContext(raw.ruleContext);
  if (raw.priorYearIncomeCents !== null && !cents(raw.priorYearIncomeCents))
    return stopped("invalid_input", "invalid_income", "Einnahmen benötigen nichtnegative sichere Ganzzahl-Cents oder ausdrücklich unbekannt.", rules);
  if (raw.eligibleOwnContributionCents !== null && !cents(raw.eligibleOwnContributionCents))
    return stopped("invalid_input", "invalid_contribution", "Eigenbeitrag benötigt nichtnegative sichere Ganzzahl-Cents oder ausdrücklich unbekannt.", rules);
  const children = dataArray(raw.children);
  const pending = dataArray(raw.pendingEvidence);
  if (!children || !pending || !pending.every(topic => member(topic, topics)))
    return stopped("invalid_input", "invalid_shape", "Dichte reine Kinder- und Nachweislisten erforderlich.", rules);
  const checkedChildren = [];
  const ids = new Set<string>();
  for (const child of children) {
    const c = dataRecord(child, ["id", "birthYear", "contributionYear", "ruleContext", "assignment"]);
    if (!c || typeof c.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(c.id)
      || !year(c.birthYear) || !year(c.contributionYear) || c.birthYear > c.contributionYear
      || typeof c.ruleContext !== "string" || !member(c.assignment, childStatuses))
      return stopped("invalid_input", "invalid_child", "Kind benötigt opake ID, gültige Jahresangaben und expliziten Zuordnungsstatus.", rules);
    if (ids.has(c.id)) return stopped("invalid_input", "duplicate_child", "Doppelte technische Kind-ID.", rules);
    ids.add(c.id);
    checkedChildren.push(c);
  }
  const data = { ...raw, children: checkedChildren, pendingEvidence: pending } as unknown as OldRiesterGrantInput;
  // AP-00 priority: structure -> ALL unresolved facts -> confirmed scope exclusions -> arithmetic.
  const review = (code: OldRiesterIssueCode, message: string) => stopped("review_required", code, message, rules);
  const unsupported = (code: OldRiesterIssueCode, message: string) => stopped("unsupported", code, message, rules);
  if (![2026, 2027, 2028].includes(data.contributionYear)) return review("year_not_approved", "Für dieses Jahr ist kein Altregelstand geprüft.");
  if (!rules) return review("rule_context_required", "Geprüfter expliziter Altregelstand erforderlich.");
  if (rules.contributionYear !== data.contributionYear) return review("rule_year_mismatch", "Regelstand und Beitragsjahr stimmen nicht überein.");
  if (data.entitlement === "timeline_unconfirmed") return review("entitlement_timeline_required", "Berechtigungsverlauf im Beitragsjahr fachlich klären.");
  if (["unconfirmed", "conflicting"].includes(data.entitlement)) return review("entitlement_unconfirmed", "Unmittelbare alte Berechtigung rechtlich bestätigen.");
  if (["unconfirmed", "conflicting"].includes(data.regime)
    || (data.regime === "old_2026_confirmed" && data.contributionYear !== 2026)
    || (data.regime === "old_protected_confirmed" && data.contributionYear === 2026))
    return review("regime_unconfirmed", "Jahresbezogenes Altregime einschließlich Bestand und Wechsel klären.");
  if (["unconfirmed", "conflicting", "transition_unconfirmed"].includes(data.contract)) return review("contract_unconfirmed", "Eigentum, Förderfähigkeit und sämtliche relevanten Verträge klären.");
  if (["unconfirmed", "conflicting"].includes(data.incomeBasis) || data.priorYearIncomeCents === null)
    return review("income_required", "Einfache maßgebliche Vorjahres-RV-Basis einschließlich bestätigter Null nachweisen.");
  if (data.incomeYear !== data.contributionYear - 1) return review("income_year_mismatch", "Bemessungsgrundlage muss dem Vorjahr zugeordnet sein.");
  if (["unconfirmed", "conflicting"].includes(data.partner)) return review("partner_confirmation_required", "Partnerstatus und unabhängige Zuordnung klären.");
  if (["unconfirmed", "conflicting"].includes(data.bonus)) return review("bonus_history_required", "Altersausschluss oder bestätigte Erstanspruchs-/Verbrauchshistorie erforderlich.");
  if (data.childrenStatus !== "complete_confirmed" || data.children.some(c => c.contributionYear !== data.contributionYear
    || c.ruleContext !== data.ruleContext || c.assignment !== "eligible_assigned_confirmed"))
    return review("child_assignment_required", "Vollständige Kinderliste und Kindergeld-/Personenzuordnung für Jahr und Regime bestätigen.");
  if (data.contributionQuality === "unconfirmed" || data.contributionQuality === "conflicting" || data.eligibleOwnContributionCents === null)
    return review("contribution_required", "Förderfähigen Jahres-Eigenbeitrag tatsächlich oder geplant bestätigen.");
  if (data.evidenceQuality !== "confirmed") return review("evidence_required", "Offene oder widersprüchliche Nachweise fachlich klären.");
  if (data.pendingEvidence.length) return review("pending_evidence", "Mindestens eine erforderliche Tatsache ist noch offen.");
  if (["unconfirmed", "conflicting"].includes(data.correction)) return review("correction_required", "Etwaigen rückwirkenden Korrekturkontext klären.");
  if (data.entitlement !== "direct_old_confirmed") return unsupported("entitlement_out_of_scope", "Nur unmittelbar nach altem Recht Berechtigte sind im Umfang.");
  if (data.contract === "multiple_and_new_regime") return unsupported("multiple_contracts_and_regime_transition", "Mehrverträge mit Regimewechsel benötigen eigene Fachprüfung.");
  if (data.contract === "multiple") return unsupported("multiple_contracts", "Vertragsauswahl und Zulagenverteilung sind außerhalb des Kerns.");
  if (data.regime === "new_confirmed") return unsupported("new_regime", "Neuförderung ist außerhalb des Alt-Riester-Kerns.");
  if (data.contract !== "single_private_eligible_confirmed") return unsupported("contract_out_of_scope", "Nur ein bestätigter förderfähiger privater Ansparvertrag ist unterstützt.");
  if (data.incomeBasis === "special") return unsupported("special_income_basis", "Sonder-/Mischbemessung benötigt gesonderte Fachprüfung.");
  if (data.partner === "indirect_new_direct_old") return unsupported("indirect_new_direct_old", "Gekoppelter Alt-/Neupartnerfall ist außerhalb dieses Kerns.");
  if (data.partner === "indirect_included") return unsupported("indirect_partner", "Mittelbar berechtigte Partner benötigen eine eigene gemeinsame Fachrechnung.");
  if (data.bonus === "current_year_confirmed") return unsupported("bonus_year", "Erstmaliges Altbonusjahr verändert den Mindestbeitrag und ist ausgeschlossen.");
  if (data.contributionQuality === "ineligible") return unsupported("ineligible_contribution", "Nicht förderfähige Beiträge sind außerhalb dieser Modellrechnung.");
  if (data.correction === "retrospective") return unsupported("retrospective_correction", "Keine rückwirkende Wiederberechnung bereits abgeschlossener Zulagen.");

  const maxima = [17500n, ...data.children.map(c => c.birthYear < 2008 ? 18500n : 30000n)];
  const totalMaximum = maxima.reduce((sum, v) => sum + v, 0n);
  const incomeEuros = BigInt(data.priorYearIncomeCents) / 100n;
  const fourPercentCents = incomeEuros * 4n;
  const cappedCents = fourPercentCents < 210000n ? fourPercentCents : 210000n;
  const remainder = cappedCents - totalMaximum;
  // Negative division truncation cannot affect the positive statutory floor.
  const minimum = remainder < 6000n ? 6000n : remainder / 100n * 100n;
  const own = BigInt(data.eligibleOwnContributionCents);
  const paid = own > minimum ? minimum : own;
  let components: bigint[];
  if (paid === 0n || paid === minimum) components = maxima.map(v => paid === 0n ? 0n : v);
  else {
    const a = unambiguousNearest(paid * 1000000000n, minimum);
    const b = unambiguousNearest(paid * 100000000000n, minimum);
    if (a === null || b === null) return review("rounding_convention_required", "Exakter Halbwert beim Faktor; amtliche Rundungskonvention fachlich klären.");
    components = [];
    for (const maximum of maxima) {
      const ac = unambiguousNearest(maximum * a, 1000000000n);
      const bc = unambiguousNearest(maximum * b, 100000000000n);
      if (ac === null || bc === null || ac !== bc)
        return review("rounding_convention_required", "Teilzulage mit Halbcent oder divergierender Faktor-/Prozentlesart; Fachklärung erforderlich.");
      components.push(ac);
    }
  }
  const childGrants = data.children.map((child, i) => ({ childId: child.id, grantCents: Number(components[i + 1]) }));
  const childrenSum = components.slice(1).reduce((sum, v) => sum + v, 0n);
  return { status: "calculated", scope: "confirmed_direct_old_bonus_free_single_contract", ruleContext: rules, notice,
    contributionYear: rules.contributionYear, contributionQuality: data.contributionQuality, evidenceQuality: "caller_confirmed",
    bonus: { status: "no_current_bonus_confirmed", includedInTotal: false },
    minimumOwnContributionCents: Number(minimum),
    fulfillment: { status: paid === minimum ? "full" : paid === 0n ? "zero" : "reduced", numerator: Number(paid), denominator: Number(minimum) },
    baseGrantCents: Number(components[0]), childGrants, childrenGrantCents: Number(childrenSum),
    totalGrantCents: Number(components[0] + childrenSum),
    roundingStatus: paid === 0n || paid === minimum ? "full_or_zero_exact" : "component_cent_agreement" };
}
