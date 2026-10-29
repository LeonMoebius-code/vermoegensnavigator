/** AP-04b presentation only. All financial calculations remain in frozen AP-03a. */
import { projectRetirement, compareRetirement } from "../../domain/retirement/projection";
import { PROJECTION_VERSIONS, type BoundProjection, type Costs, type Issue, type IssueCode,
  type ProjectionSpec, type Response, type Source } from "../../domain/retirement/projection-contract";
import { parseEuroCents } from "./direct-grant-adapter";

export interface CapitalDraft {
  start: string; end: string; initial: string; monthly: string; equity: string;
  scenarios: { equity: string; bond: string }[];
  stressEnabled: boolean; stressMonth: string; stressPercent: string;
  oneOffEnabled: boolean; oneOffMonth: string; oneOff: string;
  costMode: "gross_unknown" | "explicit"; costPercent: string; costConfirmed: boolean;
  coverage: "none_assumed" | "unknown"; openYears: string;
  grantEnabled: boolean; grantYear: string; grantAmount: string; grantMonth: string; grantConfirmed: boolean;
  referenceEnabled: boolean; referenceEquity: string;
  referenceCostMode: "gross_unknown" | "explicit"; referenceCostPercent: string; referenceCostConfirmed: boolean;
  output: "auto" | "detailed" | "compact"; confirmed: boolean;
}
export type CapitalField = keyof CapitalDraft | `scenarios.${number}.${"equity" | "bond"}` | "form";
export const scenarioNames = ["Defensivere Marktannahme", "Mittlere Marktannahme", "Höhere Marktannahme"] as const;
export const emptyCapitalDraft = (): CapitalDraft => ({
  start: "2027-01", end: "2056-12", initial: "0", monthly: "100", equity: "60",
  scenarios: [{ equity: "3", bond: "1" }, { equity: "6", bond: "2" }, { equity: "8", bond: "3" }],
  stressEnabled: false, stressMonth: "", stressPercent: "-30",
  oneOffEnabled: false, oneOffMonth: "", oneOff: "",
  costMode: "gross_unknown", costPercent: "0", costConfirmed: false,
  coverage: "none_assumed", openYears: "2027",
  grantEnabled: false, grantYear: "2027", grantAmount: "", grantMonth: "", grantConfirmed: false,
  referenceEnabled: false, referenceEquity: "100", referenceCostMode: "gross_unknown", referenceCostPercent: "0", referenceCostConfirmed: false,
  output: "auto", confirmed: false,
});
export type CapitalError = { status: "invalid_input"; field: CapitalField; message: string };
export type CapitalRequests = { status: "ready"; mode: "single" | "comparison"; requests: readonly string[] };
export type CapitalRun = CapitalError | { status: "responses"; mode: "single" | "comparison";
  requests: readonly string[]; responses: readonly Response[] };
class InputError extends Error {
  constructor(readonly field: CapitalField, message: string) { super(message); }
}
const fail = (field: CapitalField, message: string): never => { throw new InputError(field, message); };
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const ascii = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
// Only our parsed, closed UI shape and newly constructed request objects reach this serializer.
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const v = value as Record<string, unknown>;
  return `{${Object.keys(v).sort(ascii).map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
}
function readDraft(input: unknown): CapitalDraft {
  if (typeof input !== "string" || input.length > 65536) return fail("form", "Ungültiger oder zu großer Eingabesnapshot.");
  let value: unknown;
  try { value = JSON.parse(input); } catch { return fail("form", "Ungültiger JSON-Eingabesnapshot."); }
  const seed = emptyCapitalDraft(), keys = Object.keys(seed);
  if (!record(value) || Object.keys(value).length !== keys.length || Object.keys(value).some(k => !Object.hasOwn(seed, k)))
    return fail("form", "Unbekannte, fehlende oder fremde Eingabefelder.");
  for (const key of keys as (keyof CapitalDraft)[]) {
    if (key === "scenarios") continue;
    const v = value[key];
    if (typeof v !== typeof seed[key] || typeof v === "string" && v.length > (key === "openYears" ? 50000 : 128))
      return fail(key, "Ungültiger Feldtyp oder zu lange Eingabe.");
  }
  if (!Array.isArray(value.scenarios) || value.scenarios.length !== 3) return fail("form", "Genau drei Marktszenarien sind erforderlich.");
  for (const [i, scenario] of value.scenarios.entries()) {
    if (!record(scenario) || Object.keys(scenario).length !== 2 || !Object.hasOwn(scenario, "equity") || !Object.hasOwn(scenario, "bond"))
      return fail("form", "Ungültiges Szenarioformat.");
    for (const k of ["equity", "bond"] as const) if (typeof scenario[k] !== "string" || scenario[k].length > 128)
      return fail(`scenarios.${i}.${k}`, "Rendite als eindeutige Dezimaleingabe erforderlich.");
  }
  // UI snapshots originate in JSON.stringify. Duplicate keys and alternate JSON
  // spellings are rejected rather than silently repaired by JSON.parse.
  if (JSON.stringify(value) !== input) return fail("form", "Mehrdeutiger oder nicht eindeutiger JSON-Eingabesnapshot.");
  return value as unknown as CapitalDraft;
}
function month(value: string, field: CapitalField): string {
  if (!/^[0-9]{4}-(?:0[1-9]|1[0-2])$/.test(value) || value.slice(0, 4) < "0100")
    return fail(field, "Monat als YYYY-MM innerhalb 0100-01 bis 9999-12 eingeben.");
  return value;
}
function year(value: string, field: CapitalField): number {
  if (!/^[0-9]{4}$/.test(value) || value < "0100") return fail(field, "Vierstelliges Förderjahr innerhalb 0100 bis 9999 eingeben.");
  return Number(value); // At most four decimal digits, already bounded and exact.
}
function amount(value: string, field: CapitalField): number {
  const cents = parseEuroCents(value);
  return cents === null ? fail(field, "Eurobetrag mit Komma und höchstens zwei Nachkommastellen eingeben. Leer ist keine Null; keine Rundung.") : cents;
}
const S = 10n ** 36n;
function percent(value: string, field: CapitalField, low: bigint, high: bigint): string {
  const m = /^(-?)(0|[1-9][0-9]*)(?:[.,]([0-9]+))?$/.exec(value.trim());
  if (!m) return fail(field, "Prozentzahl ohne Exponenten oder Tausendertrennzeichen eingeben.");
  const fraction = (m[3] ?? "").replace(/0+$/, "");
  if (fraction.length > 34) return fail(field, "Zu viele Nachkommastellen für eine exakte Prozentumrechnung; keine Rundung.");
  const n = BigInt(m[2] + fraction) * 10n ** BigInt(34 - fraction.length) * (m[1] ? -1n : 1n);
  if (m[1] && n === 0n || n < low || n > high) return fail(field, "Prozentwert außerhalb der zulässigen Modellgrenzen.");
  const v = n < 0n ? -n : n, decimals = String(v % S).padStart(36, "0").replace(/0+$/, "");
  return `${n < 0n ? "-" : ""}${v / S}${decimals ? "." + decimals : ""}`;
}
const known = <T>(value: T): { state: "known"; value: T } => ({ state: "known", value });
function costs(mode: string, value: string, confirmed: boolean, field: CapitalField): Costs {
  if (mode === "gross_unknown") return { mode: "gross_only", costKnowledge: "unknown" };
  if (mode !== "explicit") return fail(field, "Kostenbasis ausdrücklich auswählen.");
  if (!confirmed) return { mode: "gross_plus_explicit_costs", coverage: "unknown", annualRates: [], fixedFees: [] };
  return { mode: "gross_plus_explicit_costs", coverage: "complete", fixedFees: [],
    // Start month is assigned below; this remains the contract's effective annual
    // balance reduction, never an imported manufacturer effective-cost quote.
    annualRates: [{ fromMonth: "", effectiveAnnualReduction: known(percent(value, field, 0n, S)) }] };
}
function bind(parameters: ProjectionSpec): BoundProjection {
  const paths = ["/period", "/initial", "/rebalancing", "/grantCoverage", "/stress", "/costs"];
  for (const key of ["contributionSchedule", "oneOffContributions", "grantEvents", "marketSchedule", "allocationSchedule"] as const)
    parameters[key].forEach((_, i) => paths.push(`/${key}/${i}`));
  if (parameters.costs.mode === "gross_plus_explicit_costs") {
    parameters.costs.annualRates.forEach((_, i) => paths.push(`/costs/annualRates/${i}`));
    parameters.costs.fixedFees.forEach((_, i) => paths.push(`/costs/fixedFees/${i}`));
  }
  return { parameters, bindings: paths.sort(ascii).map(path => ({ path, sourceIds: ["ui-assumption"] })) };
}
export function buildCapitalRequests(inputJson: unknown): CapitalError | CapitalRequests {
  try {
    const d = readDraft(inputJson), start = month(d.start, "start"), end = month(d.end, "end");
    if (end < start) return fail("end", "Endmonat muss mindestens der Startmonat sein.");
    const initial = amount(d.initial, "initial"), monthly = amount(d.monthly, "monthly"), equity = percent(d.equity, "equity", 0n, S);
    if (!["auto", "compact", "detailed"].includes(d.output)) return fail("output", "Gültigen Ausgabemodus auswählen.");
    if (d.coverage !== "none_assumed" && d.coverage !== "unknown") return fail("coverage", "Zulagenabdeckung ausdrücklich auswählen.");
    const years = d.coverage === "unknown" ? d.openYears.split(",").map(x => year(x.trim(), "openYears")) : [];
    if (years.some((y, i) => i > 0 && y <= years[i - 1])) return fail("openYears", "Offene Förderjahre eindeutig und aufsteigend eingeben.");
    const oneOff = d.oneOffEnabled ? [{ eventId: "own-once", month: month(d.oneOffMonth, "oneOffMonth"), cents: amount(d.oneOff, "oneOff") }] : [];
    if (oneOff.some(x => x.month < start || x.month > end)) return fail("oneOffMonth", "Einmalbeitrag muss innerhalb des Modellzeitraums liegen.");
    const stress = d.stressEnabled ? { month: month(d.stressMonth, "stressMonth"), equityShock: known(percent(d.stressPercent, "stressPercent", -S, 0n)) } : null;
    if (stress && (stress.month < start || stress.month > end)) return fail("stressMonth", "Stressmonat muss innerhalb des Modellzeitraums liegen.");
    const grantEvents: ProjectionSpec["grantEvents"] = d.grantEnabled ? [{ eventId: "grant-once",
      grantKey: { personId: "model-person", contractId: "model-contract", contributionYear: year(d.grantYear, "grantYear"), component: "aggregate", childId: null },
      cents: amount(d.grantAmount, "grantAmount"), amountBasis: "hypothetical_amount", externalRule: null, sourceBookingRef: null,
      booking: { basis: "hypothetical_month_end", month: month(d.grantMonth, "grantMonth"), referenceDate: null } }] : [];
    if (d.grantEnabled && !d.grantConfirmed) return fail("grantConfirmed", "Jahr, Betrag und Buchungsmonat als einmalige, rein hypothetische Zulagenannahme bestätigen.");
    if (grantEvents.some(g => g.booking.month < start)) return fail("grantMonth", "Keine rückwärtige Buchung vor dem Modellstart; den Zeitraum ausdrücklich anpassen.");
    if (d.grantEnabled && d.grantMonth.slice(0, 4) < d.grantYear) return fail("grantMonth", "Der hypothetische Zulagenmonat darf nicht vor dem angegebenen Förderjahr liegen.");
    const mainCosts = costs(d.costMode, d.costPercent, d.costConfirmed, "costPercent");
    const referenceCosts = d.referenceEnabled ? costs(d.referenceCostMode, d.referenceCostPercent, d.referenceCostConfirmed, "referenceCostPercent") : null;
    const referenceEquity = d.referenceEnabled ? percent(d.referenceEquity, "referenceEquity", 0n, S) : "0";
    const markets = d.scenarios.map((s, i) => ({ equityAnnualReturn: known(percent(s.equity, `scenarios.${i}.equity`, -S, 1000000n * S)),
      bondAnnualReturn: known(percent(s.bond, `scenarios.${i}.bond`, -S, 1000000n * S)), fromMonth: start }));
    if (!d.confirmed) return fail("confirmed", "Die sichtbaren neutralen Modellannahmen für diesen Snapshot bewusst bestätigen.");
    const withStart = (c: Costs): Costs => c.mode === "gross_plus_explicit_costs"
      ? { ...c, annualRates: c.annualRates.map(r => ({ ...r, fromMonth: start })) } : c;
    const projection = (i: number, reference: boolean): BoundProjection => bind({
      projectionId: `${reference ? "reference" : "model"}-${"abc"[i]}`, instrument: reference ? "unfunded_reference" : "retirement_model",
      period: { startMonth: start, endMonth: end }, initial: { balanceCents: known(initial), valuationMonth: start, position: "immediately_before_start" },
      rebalancing: "monthly_target_weight", contributionSchedule: [{ fromMonth: start, monthlyCents: known(monthly) }],
      oneOffContributions: oneOff.map(x => ({ ...x })), grantCoverage: { mode: reference ? "none_assumed" : d.coverage, unresolvedContributionYears: reference ? [] : years },
      grantEvents: reference ? [] : grantEvents, marketSchedule: [markets[i]], allocationSchedule: [{ fromMonth: start, equityWeight: known(reference ? referenceEquity : equity) }],
      stress, costs: withStart(reference ? referenceCosts! : mainCosts),
    });
    const sources: Source[] = [{ sourceId: "ui-assumption", kind: "model_assumption", quality: "hypothetical",
      reference: "AP04b explicit hypothetical UI snapshot; not product data, external grant evidence or actual booking",
      version: "ap04b-ui-v1", contentHash: null, checkedOn: null, effectiveFromMonth: null, effectiveToMonth: null }];
    const common = { versions: { ...PROJECTION_VERSIONS }, output: { mode: d.output }, sources };
    return d.referenceEnabled ? { status: "ready", mode: "comparison", requests: [canonical({ ...common, kind: "comparison",
      scenarios: [0, 1, 2].map(i => ({ scenarioId: "abc"[i], retirement: projection(i, false), reference: projection(i, true) })) })] }
      : { status: "ready", mode: "single", requests: [0, 1, 2].map(i => canonical({ ...common, kind: "projection", projection: projection(i, false) })) };
  } catch (error) {
    if (error instanceof InputError) return { status: "invalid_input", field: error.field, message: error.message };
    throw error;
  }
}
export function calculateCapital(inputJson: unknown): CapitalRun {
  const built = buildCapitalRequests(inputJson);
  if (built.status !== "ready") return built;
  return { status: "responses", mode: built.mode, requests: built.requests,
    responses: built.requests.map(raw => built.mode === "comparison" ? compareRetirement(raw) : projectRetirement(raw)) };
}
const messages: Record<IssueCode, string> = {
  invalid_type: "Ungültiger Eingabetyp.", invalid_unicode: "Ungültige Textzeichen.", input_bytes_limit: "Eingabe überschreitet die Ressourcengrenze.",
  input_depth_limit: "Zu tief verschachtelte Eingabe.", invalid_json: "Ungültiger JSON-Text.", invalid_shape: "Unvollständige oder fremde Felder.",
  invalid_value: "Ein Wert liegt außerhalb der Modellgrenzen.", invalid_calendar: "Ungültiger Kalenderzeitraum.", invalid_order: "Ungültige Zeit- oder Quellenreihenfolge.",
  duplicate_identity: "Doppelte Ereignisidentität.", inconsistent_input: "Widersprüchliche Annahmen.", dangling_source: "Quellenverknüpfung fehlt.",
  wrong_operation: "Unpassende Modellanfrage.", noncanonical_json: "Nicht eindeutige JSON-Schreibweise.", entry_limit: "Zu viele Eingabeelemente.",
  version_not_supported: "Rechenversion wird nicht unterstützt.", detail_rows_limit: "Zu viele Detailzeilen: automatisch oder kompakt wählen.",
  evidence_required: "Eine benötigte Quelle ist noch nicht hinreichend bestätigt.", input_fact_unknown: "Eine erforderliche Modellangabe ist unklar.",
  annual_total_loss_timing_required: "Jahresverlust von 100 % benötigt einen datierten Verlustpfad; einen ausdrücklichen Stress prüfen.",
  cost_rate_total_loss_timing_required: "Kostenminderung von 100 % benötigt eine gesonderte zeitliche Klärung.",
  cost_source_unknown: "Kosten noch nicht belastbar; kein bestätigter Nachkostenwert.", effective_cost_not_balance_fee: "Effektivkosten sind kein ungeprüfter Bestandskostensatz.",
  cost_type_not_supported: "Kostenart wird von diesem Modell nicht unterstützt.", work_limit: "Definierte Rechenarbeitsgrenze erreicht; kein verkürztes Ergebnis.",
  insufficient_fee_basis: "Der modellierte Bestand reicht vor Einzahlung nicht für die Gebühren.", numeric_domain_exceeded: "Ein Betrag überschreitet die sichere Rechengrenze.",
  precision_ambiguous: "Das Rechenintervall erlaubt keinen eindeutigen Centwert.", allowance_coverage_unknown: "Weitere Zulagen sind offen; der vollständige Endwert ist nicht belastbar.",
  basis_mismatch: "Keine vergleichbare Eigenbeitrags- oder Kostenbasis; keine vollständige Differenz.", included_cost_amount_unknown: "Enthaltene Kosten sind nicht einzeln bestimmbar.",
  output_bytes_limit: "Ausgabe überschreitet die Ressourcengrenze; Ergebnis vollständig verworfen.",
};
export const issueMessage = (issue: Issue): string => `${messages[issue.code]}${issue.month ? ` Monat: ${issue.month}.` : ""}`;
