/** UX-03: one planned cashflow source; no grant or capital formula. */
import type { ProjectionResult, MoneyMetric } from "../../domain/retirement/projection-contract";
import { annualContribution, changeYear, emptyGrantDraft, previewGrant, type GrantDraft, type Preview } from "./direct-grant-adapter";
import { calculateCapital, emptyCapitalDraft, type CapitalDraft, type CapitalRun } from "./projection-adapter";

export interface CustomerPlan {
  birthYear: string;
  funding: "open" | "checked" | "special";
  children: "unknown" | "no" | "yes";
  capital: CapitalDraft;
  evidence: GrantDraft;
}
export const emptyCustomerPlan = (): CustomerPlan => ({ birthYear: "", funding: "open", children: "unknown",
  capital: emptyCapitalDraft(), evidence: emptyGrantDraft() });
export type PlanError = { status: "invalid_input"; field: "birthYear" | "start" | "end" | "monthly" | "oneOff" | "oneOffMonth"; message: string };
const validMonth = (v: string) => /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(v) && v.slice(0, 4) >= "0100";
export function plannedGrantDraft(plan: CustomerPlan): GrantDraft | PlanError {
  const c = plan.capital;
  if (!validMonth(c.start)) return { status: "invalid_input", field: "start", message: "Bitte einen gültigen Startmonat eingeben." };
  if (!validMonth(c.end) || c.end < c.start) return { status: "invalid_input", field: "end", message: "Das Modellziel muss im Startmonat oder danach liegen." };
  if (plan.birthYear && (!/^[0-9]{4}$/.test(plan.birthYear) || plan.birthYear < "0100" || plan.birthYear > c.start.slice(0, 4)))
    return { status: "invalid_input", field: "birthYear", message: "Bitte ein vierstelliges Geburtsjahr bis zum Sparbeginn eingeben oder das Feld offenlassen." };
  if (c.oneOffEnabled && (!validMonth(c.oneOffMonth) || c.oneOffMonth < c.start || c.oneOffMonth > c.end))
    return { status: "invalid_input", field: "oneOffMonth", message: "Die Einmalzahlung muss innerhalb der Modelllaufzeit liegen." };
  const year = Number(c.start.slice(0, 4));
  const last = c.end.slice(0, 4) === c.start.slice(0, 4) ? Number(c.end.slice(5)) : 12;
  const evidence = plan.evidence.year === year ? plan.evidence : changeYear(plan.evidence, year);
  const d: GrantDraft = { ...evidence, year, mode: "monthly", monthly: c.monthly, annual: "",
    startMonth: String(Number(c.start.slice(5))), months: String(last - Number(c.start.slice(5)) + 1),
    hasOneOff: c.oneOffEnabled && c.oneOffMonth.slice(0, 4) === c.start.slice(0, 4), oneOff: c.oneOff, quality: "planned" };
  const amount = annualContribution(d);
  if (amount.status !== "valid") return { ...amount, field: amount.field === "oneOff" ? "oneOff" : "monthly",
    message: "Bitte einen nichtnegativen Eurobetrag mit höchstens zwei Nachkommastellen eingeben." };
  return d;
}
export function customerGrant(plan: CustomerPlan): Preview | PlanError {
  const d = plannedGrantDraft(plan);
  if ("status" in d) return d;
  if (plan.funding !== "checked") return { status: "review_required", message: "Ob die Förderung in Ihrem Fall möglich ist, prüfen wir gemeinsam." };
  if (plan.children === "unknown" || plan.children === "no" && d.childrenStatus !== "none_confirmed"
    || plan.children === "yes" && d.childrenStatus !== "assigned_confirmed")
    return { status: "review_required", message: "Für die Kinderzulage klären wir noch die Förderfähigkeit und Zuordnung." };
  return previewGrant(d);
}
/** Any payment edit invalidates evidence of the contribution; a year/person edit all legal evidence. */
export function editCustomerCapital(plan: CustomerPlan, capital: CapitalDraft): CustomerPlan {
  const yearChanged = capital.start.slice(0, 4) !== plan.capital.start.slice(0, 4);
  const ownSnapshot = (p: CustomerPlan) => {
    const d = plannedGrantDraft(p);
    return "status" in d ? null : JSON.stringify([d.monthly, d.startMonth, d.months, d.hasOneOff, d.hasOneOff ? d.oneOff : ""]);
  };
  const before = ownSnapshot(plan), after = ownSnapshot({ ...plan, capital });
  const paymentsChanged = before === null || after === null || before !== after;
  return { ...plan, capital: { ...capital, confirmed: false, grantConfirmed: false, costConfirmed: false, referenceCostConfirmed: false },
    evidence: yearChanged ? changeYear(plan.evidence, Number(capital.start.slice(0, 4)))
      : paymentsChanged ? { ...plan.evidence, contributionConfirmed: false } : plan.evidence };
}
export function runCustomerCapital(plan: CustomerPlan): CapitalRun | PlanError {
  const d = plannedGrantDraft(plan);
  if ("status" in d) return d;
  // The calculation action accepts visible hypothetical model inputs only. It never
  // sets cost/grant evidence or changes any legal status passed to the grant domain.
  return calculateCapital(JSON.stringify({ ...plan.capital, confirmed: true }));
}
export interface LedgerPoint { month: string; cents: number; ownCents: number }
export const metricCents = (v: MoneyMetric): number | null => "displayCents" in v ? v.displayCents : null;
export function ledgerPoints(model: ProjectionResult): LedgerPoint[] {
  if (model.status === "review_required" || !model.ledger) return [];
  let own = 0n;
  const rows = model.ledger.mode === "detailed" ? model.ledger.rows.map(r => ({ month: r.month, balance: r.closingBalance, own: r.totals.totalOwn }))
    : model.ledger.blocks.map(r => ({ month: r.endMonth, balance: r.closingBalance, own: r.totals.totalOwn }));
  const result: LedgerPoint[] = [];
  for (const r of rows) {
    const cents = metricCents(r.balance), inflow = metricCents(r.own);
    if (cents === null || inflow === null) return []; // Never bridge a blocked gap with fabricated values.
    own += BigInt(inflow);
    if (own > BigInt(Number.MAX_SAFE_INTEGER) || own < BigInt(Number.MIN_SAFE_INTEGER)) return [];
    result.push({ month: r.month, cents, ownCents: Number(own) });
  }
  return result;
}
