import { useId } from "react";
import { euro } from "./direct-grant-adapter";
import { centsInput, conditionalBaseGrant, contributionTargets, customerPayments, setContributionGoal, type ChangeCustomerPlan, type CustomerPlan } from "./customer-plan-adapter";

/** All amounts belong to CustomerPlan. No second payment state in this component. */
export function ContributionOptimizer({ plan, change, childGoalAvailable = false }: { plan: CustomerPlan; change: ChangeCustomerPlan; childGoalAvailable?: boolean }) {
  const id = useId(), payments = customerPayments(plan);
  const annualGoal = plan.contribution?.annual ?? (payments.status === "valid" ? centsInput(payments.total) : "");
  const individual = plan.contribution?.kind !== "target";
  // With no family answer yet, the catalogue value is a general savings
  // orientation. An explicitly absent or unresolved child case moves it out
  // of the personal target group until the component evidence is available.
  const showChildTarget = childGoalAvailable || plan.children === "unknown";
  const error = payments.status === "invalid_input" && payments.field === "annual" ? payments : null;
  const targets = contributionTargets.filter(target => showChildTarget || target.cents !== 30000);
  return <div className="retirement-optimizer" data-testid="contribution-optimizer">
    <div className="avd-target-heading">
      <h3>Beitragsziele im ersten Jahr</h3>
      <p className="retirement-state" data-testid="contribution-mode">{individual ? "Individuell" : "Jahresziel gewählt"}</p>
    </div>
    <div className="retirement-contribution-targets" role="group" aria-label="Beitragsziele">
      {targets.map(target => {
        const selected = !individual && plan.contribution?.annual === centsInput(target.cents);
        return <button type="button" key={target.cents} aria-pressed={selected}
          onClick={() => change(current => setContributionGoal(current, centsInput(target.cents), "target"))}>
          <span className="avd-target-caption"><strong>{target.title}</strong>
            <span className="avd-target-amount"><span className="avd-visually-compact">Jahresziel: </span>{euro(target.cents)}</span></span>
          <span className="avd-target-effect">{target.cents === 30000 && !childGoalAvailable
            ? "Der persönliche Kinderzulagenanspruch ist offen." : target.note}</span>
        </button>;
      })}
    </div>
    <div className="avd-annual-target">
      <label htmlFor={`${id}-annual`}>Jahresziel für das erste Kalenderjahr in Euro</label>
      <input id={`${id}-annual`} data-testid="customer-annual-input" inputMode="decimal" value={annualGoal}
        aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : `${id}-annual-help`}
        onChange={e => { const annual = e.target.value; change(current => setContributionGoal(current, annual, "annual")); }} />
      <small id={`${id}-annual-help`}>Das Jahresziel enthält Ihre eigene Einmalzahlung. Daraus ergibt sich die Monatsrate.</small>
    </div>
    {error && <p id={`${id}-error`} role="alert">{error.message}</p>}
    {payments.status === "valid" && <div className="avd-contribution-explanation" role="status" data-testid="contribution-explanation">
      <p data-testid="planned-annual-contribution"><strong>Tatsächlich geplanter Jahresbeitrag: {euro(payments.total)}</strong></p>
      {(payments.firstOneOff > 0 || payments.remainder > 0) && <p>{payments.months} Monatsraten à {euro(payments.monthly)} + {euro(payments.firstOneOff)} eigene Einmalzahlung{payments.remainder > 0 ? ` + ${euro(payments.remainder)} Centausgleich im Monat ${payments.remainderMonth}` : ""} = {euro(payments.total)} im ersten Kalenderjahr.</p>}
      {payments.goal !== null && payments.firstOneOff > payments.goal && <p>Die Einmalzahlung überschreitet Ihr Jahresziel bereits um {euro(payments.firstOneOff - payments.goal)}. Die Einmalzahlung von {euro(payments.firstOneOff)} bleibt erhalten. Die Monatsrate beträgt {euro(payments.monthly)}. Der tatsächlich geplante Jahresbeitrag liegt höher als das Ziel.</p>}
      {payments.total < 12000 && <p>Zum Jahresmindestbeitrag von 120,00 € fehlen {euro(12000 - payments.total)}. Im regulären direkten Standardfall entstehen darunter keine Grund- oder Kinderzulagen. Alternative: insgesamt {euro(Math.ceil(Math.max(0, 12000 - payments.firstOneOff) / payments.months))} je verbleibendem Monat oder zusätzlich {euro(12000 - payments.total)} einmalig in diesem Kalenderjahr.</p>}
      {payments.total > 684000 && <p>Über 6.840,00 € im ersten Jahr: rechtliche und Anbietergrenzen gesondert prüfen. Keine Förderzahl und keine automatische Kappung.</p>}
    </div>}
    {payments.status === "invalid_input" && payments.field !== "annual" && <p role="status">{payments.message}</p>}
    <details className="avd-target-context"><summary>Grundlage der Förderziele</summary>
      <p>Die Förderziele setzen eine unmittelbare Berechtigung im neuen Förderregime und einen zulässigen Vertrag voraus. Geprüfte Regelstände sind 2027 und 2028.</p>
      <p>Jahresziel und Centausgleich gelten für das erste Kalenderjahr. Die Monatsrate läuft bis zum Sparende weiter. Eine direkte Änderung der Monatsrate aktiviert „Individuell“.</p>
      <dl className="avd-target-examples">{targets.map(target => {
        const selected = !individual && plan.contribution?.annual === centsInput(target.cents);
        // Only the selected goal uses the actual plan, including its one-off payment.
        const assumed = selected ? conditionalBaseGrant(plan) : conditionalBaseGrant({ ...plan,
          contribution: { kind: "target", annual: centsInput(target.cents) }, capital: { ...plan.capital, oneOffEnabled: false } });
        const needed = payments.status === "valid" ? Math.max(0, target.cents - payments.firstOneOff) : null;
        return <div key={target.cents}>
          <dt>{target.title}</dt>
          <dd>{selected ? "Für Ihren tatsächlichen Zahlungsplan · bedingter Standardfall"
            : `Orientierungsbeispiel bei exakt ${euro(target.cents)} Jahresbeitrag · kein individueller Förderanspruch`}</dd>
          {selected && payments.status === "valid" && <dd>Tatsächlich geplanter Jahresbeitrag: {euro(payments.total)}</dd>}
          <dd>{needed === null || payments.status !== "valid" ? "Zeitraum und Einmalzahlung prüfen"
            : `${euro(Math.floor(needed / payments.months))} je Restmonat${needed % payments.months ? ` + ${euro(needed % payments.months)} Centausgleich` : ""}`}</dd>
          <dd>{assumed.status === "calculated" ? `Mögliche Grundzulage · bedingt: ${euro(assumed.result.baseGrantCents)}` : "Grundzulage: Voraussetzungen gesondert prüfen"}</dd>
          {target.cents === 30000 && !childGoalAvailable && <dd>Der persönliche Kinderzulagenanspruch ist offen.</dd>}
        </div>;
      })}</dl>
    </details>
    {!showChildTarget && <details className="avd-target-context"><summary>Fachlicher Gesamtkatalog der Beitragsziele</summary>
      <p>300,00 € Jahresziel für eine mögliche volle Kinderzulage. Der persönliche Anspruch hängt von Kindergeld, Person und Förderjahr ab.</p>
    </details>}
  </div>;
}
