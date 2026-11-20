import { useId } from "react";
import { euro } from "./direct-grant-adapter";
import { centsInput, conditionalBaseGrant, contributionTargets, customerPayments, setContributionGoal, type ChangeCustomerPlan, type CustomerPlan } from "./customer-plan-adapter";

/** All amounts belong to CustomerPlan. No second payment state in this component. */
export function ContributionOptimizer({ plan, change }: { plan: CustomerPlan; change: ChangeCustomerPlan }) {
  const id = useId(), payments = customerPayments(plan);
  const annualGoal = plan.contribution?.annual ?? (payments.status === "valid" ? centsInput(payments.total) : "");
  const individual = plan.contribution?.kind !== "target";
  const error = payments.status === "invalid_input" && payments.field === "annual" ? payments : null;
  return <div className="retirement-optimizer" data-testid="contribution-optimizer">
    <h3>Wählen Sie Ihr Jahresziel</h3>
    <p>Für eine unmittelbar berechtigte Person im neuen Förderregime mit einem zulässigen Vertrag. Die Ziele sind keine Förderzusage. Geprüfte Regelstände: 2027 und 2028.</p>
    <div className="retirement-contribution-targets" role="group" aria-label="Beitragsziele">
      {contributionTargets.map(target => {
        const selected = !individual && plan.contribution?.annual === centsInput(target.cents);
        // The active card uses the same actual plan as the funding overview.
        // Other cards are explicitly separate examples at the exact target amount.
        const assumed = selected ? conditionalBaseGrant(plan) : conditionalBaseGrant({ ...plan,
          contribution: { kind: "target", annual: centsInput(target.cents) }, capital: { ...plan.capital, oneOffEnabled: false } });
        const needed = payments.status === "valid" ? Math.max(0, target.cents - payments.firstOneOff) : null;
        return <button type="button" key={target.cents} aria-pressed={selected}
          onClick={() => change(current => setContributionGoal(current, centsInput(target.cents), "target"))}>
          <strong>{target.title}</strong><span>Jahresziel: {euro(target.cents)}</span>
          {selected && payments.status === "valid" && <small>Tatsächlich geplanter Jahresbeitrag: {euro(payments.total)}</small>}
          <small>{needed === null || payments.status !== "valid" ? "Zeitraum und Einmalzahlung prüfen" : `${euro(Math.floor(needed / payments.months))} je Restmonat${needed % payments.months ? ` + ${euro(needed % payments.months)} Centausgleich` : ""}`}</small>
          <small>{selected ? "Für Ihren tatsächlichen Zahlungsplan · bedingter Standardfall" : `Orientierungsbeispiel bei exakt ${euro(target.cents)} Jahresbeitrag · kein individueller Förderanspruch`}</small>
          <small>{assumed.status === "calculated" ? `Mögliche Grundzulage · bedingt: ${euro(assumed.result.baseGrantCents)}` : "Grundzulage: Voraussetzungen gesondert prüfen"}</small>
          <small>{target.note}</small>
        </button>;
      })}
    </div>
    <p className="retirement-state" data-testid="contribution-mode">{individual ? "Individuell" : "Jahresziel gewählt"}</p>
    <label htmlFor={`${id}-annual`}>Jahresziel für das erste Kalenderjahr in Euro</label>
    <input id={`${id}-annual`} data-testid="customer-annual-input" inputMode="decimal" value={annualGoal}
      aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : `${id}-annual-help`}
      onChange={e => { const annual = e.target.value; change(current => setContributionGoal(current, annual, "annual")); }} />
    <small id={`${id}-annual-help`}>Zielbetrag einschließlich der eigenen Einmalzahlung in diesem Jahr. Daraus wird Ihre Monatsrate ermittelt. Der tatsächlich geplante Jahresbeitrag kann bei einer höheren Einmalzahlung über dem Ziel liegen und wird gesondert angezeigt. Eine direkte Änderung der Monatsrate aktiviert „Individuell“.</small>
    {error && <p id={`${id}-error`} role="alert">{error.message}</p>}
    {payments.status === "valid" && <div role="status" data-testid="contribution-explanation">
      <p data-testid="planned-annual-contribution"><strong>Tatsächlich geplanter Jahresbeitrag: {euro(payments.total)}</strong></p>
      <p>{payments.months} Monatsraten à {euro(payments.monthly)} + {euro(payments.firstOneOff)} eigene Einmalzahlung{payments.remainder > 0 ? ` + ${euro(payments.remainder)} Centausgleich im Monat ${payments.remainderMonth}` : ""} = {euro(payments.total)} im ersten Kalenderjahr.</p>
      {plan.contribution && <p>Die Monatsrate läuft bis zum gewählten Modellziel weiter. Das Jahresziel und der Centausgleich gelten nur für das erste Kalenderjahr.</p>}
      {payments.goal !== null && payments.firstOneOff > payments.goal && <p>Die Einmalzahlung überschreitet Ihr Jahresziel bereits um {euro(payments.firstOneOff - payments.goal)}. Die Einmalzahlung von {euro(payments.firstOneOff)} bleibt erhalten. Die Monatsrate beträgt {euro(payments.monthly)}. Der tatsächlich geplante Jahresbeitrag liegt höher als das Ziel.</p>}
      {payments.total < 12000 && <p>Zum Jahresmindestbeitrag von 120,00 € fehlen {euro(12000 - payments.total)}. Im regulären direkten Standardfall entstehen darunter keine Grund- oder Kinderzulagen. Alternative: insgesamt {euro(Math.ceil(Math.max(0, 12000 - payments.firstOneOff) / payments.months))} je verbleibendem Monat oder zusätzlich {euro(12000 - payments.total)} einmalig in diesem Kalenderjahr.</p>}
      {payments.total > 684000 && <p>Über 6.840,00 € im ersten Jahr: rechtliche und Anbietergrenzen gesondert prüfen. Keine Förderzahl und keine automatische Kappung.</p>}
    </div>}
    {payments.status === "invalid_input" && payments.field !== "annual" && <p role="status">{payments.message}</p>}
  </div>;
}
