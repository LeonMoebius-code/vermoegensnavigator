/** UX-03: one planned cashflow source; no grant or capital formula. */
import type { ProjectionResult, MoneyMetric } from "../../domain/retirement/projection-contract";
import { annualContribution, changeYear, emptyGrantDraft, parseEuroCents, previewGrant, type GrantDraft, type Preview } from "./direct-grant-adapter";
import { calculateCapital, emptyCapitalDraft, type CapitalDraft, type CapitalRun } from "./projection-adapter";

export interface CustomerPlan {
  /** Annual intent only. Actual payments are derived once by customerPayments. */
  contribution?: { kind: "annual" | "target"; annual: string };
  birthYear: string;
  funding: "open" | "checked" | "special";
  children: "unknown" | "no" | "yes";
  capital: CapitalDraft;
  evidence: GrantDraft;
}
export const emptyCustomerPlan = (): CustomerPlan => ({ birthYear: "", funding: "open", children: "unknown",
  capital: emptyCapitalDraft(), evidence: emptyGrantDraft() });
export type PlanError = { status: "invalid_input"; field: "annual" | "birthYear" | "start" | "end" | "monthly" | "oneOff" | "oneOffMonth"; message: string };
const validMonth = (v: string) => /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(v) && v.slice(0, 4) >= "0100";
export const contributionTargets = [
  { cents: 12000, title: "Förder-Mindestbeitrag", note: "Jahresminimum im direkten Standardfall" },
  { cents: 30000, title: "Kinderzulage voll", note: "Nur je tatsächlich förderfähigem und zugeordnetem Kind" },
  { cents: 36000, title: "Erste Grundförderstufe voll", note: "Erste Grundförderstufe ausgeschöpft" },
  { cents: 180000, title: "Höchste Grundzulage", note: "Darüber wächst die Grundzulage nicht weiter" },
  { cents: 684000, title: "Höchster neuer Jahresbeitrag", note: "Je einschlägigem Neuvertrag, keine zusätzliche Grundzulage" },
] as const;
export const centsInput = (cents: number) => `${BigInt(cents) / 100n},${String(BigInt(cents) % 100n).padStart(2, "0")}`;
/** Payment arithmetic only, no legal or grant assumptions. Annual targets refer
 * to the first calendar year. Monthly payments continue, the cent remainder does not. */
export function customerPayments(plan: CustomerPlan) {
  const c = plan.capital;
  if (!validMonth(c.start)) return { status: "invalid_input" as const, field: "start" as const, message: "Bitte einen gültigen Startmonat eingeben." };
  if (!validMonth(c.end) || c.end < c.start) return { status: "invalid_input" as const, field: "end" as const, message: "Das Modellziel muss im Startmonat oder danach liegen." };
  const lastMonth = c.end.slice(0, 4) === c.start.slice(0, 4) ? c.end : `${c.start.slice(0, 4)}-12`;
  const months = Number(lastMonth.slice(5)) - Number(c.start.slice(5)) + 1;
  if (c.oneOffEnabled && (!validMonth(c.oneOffMonth) || c.oneOffMonth < c.start || c.oneOffMonth > c.end))
    return { status: "invalid_input" as const, field: "oneOffMonth" as const, message: "Die Einmalzahlung muss innerhalb der Modelllaufzeit liegen." };
  const oneOff = c.oneOffEnabled ? parseEuroCents(c.oneOff) : 0;
  if (oneOff === null) return { status: "invalid_input" as const, field: "oneOff" as const, message: "Bitte einen nichtnegativen Eurobetrag mit höchstens zwei Nachkommastellen eingeben." };
  const firstOneOff = c.oneOffEnabled && c.oneOffMonth.slice(0, 4) === c.start.slice(0, 4) ? oneOff : 0;
  const goal = plan.contribution ? parseEuroCents(plan.contribution.annual) : null;
  if (plan.contribution && goal === null) return { status: "invalid_input" as const, field: "annual" as const, message: "Bitte einen nichtnegativen Jahresbetrag mit höchstens zwei Nachkommastellen eingeben." };
  const monthly = plan.contribution ? Number(BigInt(Math.max(0, goal! - firstOneOff)) / BigInt(months)) : parseEuroCents(c.monthly);
  if (monthly === null) return { status: "invalid_input" as const, field: "monthly" as const, message: "Bitte einen nichtnegativen Eurobetrag mit höchstens zwei Nachkommastellen eingeben." };
  const remainder = plan.contribution ? Math.max(0, goal! - firstOneOff) % months : 0;
  const total = BigInt(monthly) * BigInt(months) + BigInt(firstOneOff) + BigInt(remainder);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) return { status: "invalid_input" as const, field: "monthly" as const, message: "Jahressumme überschreitet die sichere Ganzzahl-Centgrenze." };
  return { status: "valid" as const, months, monthly, firstOneOff, remainder, remainderMonth: lastMonth, total: Number(total), goal };
}
export function setContributionGoal(plan: CustomerPlan, annual: string, kind: "annual" | "target"): CustomerPlan {
  if (plan.contribution?.kind === kind && plan.contribution.annual === annual) return plan;
  // Annual intent and monthly display are updated together, never local UI state.
  return editCustomerCapital(plan, plan.capital, { kind, annual });
}
export function conditionalBaseGrant(plan: CustomerPlan): Preview | PlanError {
  const d = plannedGrantDraft(plan);
  if ("status" in d) return d;
  // A separate explicitly conditional standard-case calculation. Never write its
  // assumed evidence back to the plan or use it in a projection.
  if (d.entitlement === "ineligible" || d.entitlement === "indirect" || d.regime === "old" || d.contract === "multiple"
    || plan.funding === "special") return { status: "review_required", message: "Diese Konstellation benötigt eine gesonderte Prüfung. Kein direktes Standardszenario." };
  return previewGrant({ ...d, entitlement: "direct_confirmed", regime: "new_confirmed", contract: "single_eligible_confirmed",
    childrenStatus: "none_confirmed", children: [], contributionConfirmed: true });
}
export function plannedGrantDraft(plan: CustomerPlan): GrantDraft | PlanError {
  const c = plan.capital;
  if (!validMonth(c.start)) return { status: "invalid_input", field: "start", message: "Bitte einen gültigen Startmonat eingeben." };
  if (!validMonth(c.end) || c.end < c.start) return { status: "invalid_input", field: "end", message: "Das Modellziel muss im Startmonat oder danach liegen." };
  if (plan.birthYear && (!/^[0-9]{4}$/.test(plan.birthYear) || plan.birthYear < "0100" || plan.birthYear > c.start.slice(0, 4)))
    return { status: "invalid_input", field: "birthYear", message: "Bitte ein vierstelliges Geburtsjahr bis zum Sparbeginn eingeben oder das Feld offenlassen." };
  if (c.oneOffEnabled && (!validMonth(c.oneOffMonth) || c.oneOffMonth < c.start || c.oneOffMonth > c.end))
    return { status: "invalid_input", field: "oneOffMonth", message: "Die Einmalzahlung muss innerhalb der Modelllaufzeit liegen." };
  const payments = customerPayments(plan);
  if (payments.status !== "valid") return payments;
  const year = Number(c.start.slice(0, 4));
  const evidence = plan.evidence.year === year ? plan.evidence : changeYear(plan.evidence, year);
  const d: GrantDraft = { ...evidence, year, mode: "monthly", monthly: centsInput(payments.monthly), annual: "",
    startMonth: String(Number(c.start.slice(5))), months: String(payments.months),
    hasOneOff: payments.firstOneOff + payments.remainder > 0, oneOff: centsInput(payments.firstOneOff + payments.remainder), quality: "planned" };
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
export function editCustomerCapital(plan: CustomerPlan, capital: CapitalDraft,
  contribution: CustomerPlan["contribution"] = capital.monthly !== plan.capital.monthly ? undefined : plan.contribution): CustomerPlan {
  if (JSON.stringify([plan.capital, plan.contribution]) === JSON.stringify([capital, contribution])) return plan;
  const candidate = { ...plan, capital, contribution };
  const payments = customerPayments(candidate);
  if (contribution && payments.status === "valid") capital = { ...capital, monthly: centsInput(payments.monthly) };
  const yearChanged = capital.start.slice(0, 4) !== plan.capital.start.slice(0, 4);
  const ownSnapshot = (p: CustomerPlan) => {
    const d = plannedGrantDraft(p);
    return "status" in d ? null : JSON.stringify([d.monthly, d.startMonth, d.months, d.hasOneOff, d.hasOneOff ? d.oneOff : ""]);
  };
  const before = ownSnapshot(plan), after = ownSnapshot({ ...plan, capital, contribution });
  const paymentsChanged = before === null || after === null || before !== after;
  const prior = plan.capital;
  const sameGrant = capital.start === prior.start && capital.end === prior.end && capital.grantEnabled === prior.grantEnabled
    && capital.grantYear === prior.grantYear && capital.grantMonth === prior.grantMonth && capital.grantAmount === prior.grantAmount;
  const sameCosts = capital.costMode === prior.costMode && capital.costPercent === prior.costPercent;
  const sameReferenceCosts = capital.referenceEnabled === prior.referenceEnabled && capital.referenceCostMode === prior.referenceCostMode
    && capital.referenceCostPercent === prior.referenceCostPercent;
  return { ...plan, contribution, capital: { ...capital, confirmed: false, grantConfirmed: sameGrant && capital.grantConfirmed,
    costConfirmed: sameCosts && capital.costConfirmed, referenceCostConfirmed: sameReferenceCosts && capital.referenceCostConfirmed },
    evidence: yearChanged ? changeYear(plan.evidence, Number(capital.start.slice(0, 4)))
      : paymentsChanged ? { ...plan.evidence, contributionConfirmed: false } : plan.evidence };
}
export function runCustomerCapital(plan: CustomerPlan): CapitalRun | PlanError {
  const d = plannedGrantDraft(plan);
  if ("status" in d) return d;
  const payments = customerPayments(plan);
  if (payments.status !== "valid") return payments;
  return calculateCapital(JSON.stringify({ ...plan.capital, monthly: centsInput(payments.monthly) }),
    payments.remainder ? { month: payments.remainderMonth, cents: payments.remainder } : undefined);
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
