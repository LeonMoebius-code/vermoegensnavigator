import { useId, useRef } from "react";
import { directGrantRuleContext } from "../../domain/retirement/direct-grant-rules";
import { changeYear, euro, type GrantDraft } from "./direct-grant-adapter";
import { conditionalBaseGrant, customerGrant, customerPayments, editCustomerCapital, type CustomerPlan } from "./customer-plan-adapter";
import { ContributionOptimizer } from "./contribution-optimizer";
import type { CapitalDraft } from "./projection-adapter";

export function RetirementCustomer({ plan, change, back, next }: {
  plan: CustomerPlan; change: (p: CustomerPlan) => void; back: () => void; next: () => void;
}) {
  const prefix = useId(), form = useRef<HTMLFormElement>(null);
  const id = (key: string) => `${prefix}-${key}`;
  const edit = change;
  const update = <K extends keyof CapitalDraft>(key: K, value: CapitalDraft[K]) => {
    const manualRate = key === "monthly" && plan.contribution !== undefined;
    const source = manualRate ? { ...plan, contribution: undefined, evidence: { ...plan.evidence, contributionConfirmed: false } } : plan;
    change(editCustomerCapital(source, { ...plan.capital, [key]: value }));
  };
  const evidence = <K extends keyof GrantDraft>(key: K, value: GrantDraft[K]) => {
    if (plan.evidence[key] === value) return;
    const next = { ...plan.evidence, [key]: value };
    if (key === "entitlement" || key === "regime" || key === "contract") next.contributionConfirmed = false;
    if (key === "regime" || key === "contract") {
      next.childrenStatus = "unconfirmed";
      next.children = next.children.map(c => ({ ...c, status: "assignment_unconfirmed" }));
    }
    change({ ...plan, evidence: next });
  };
  const grant = customerGrant(plan), possible = conditionalBaseGrant(plan), payments = customerPayments(plan);
  const year = plan.capital.start.slice(0, 4);
  const rules = year === "2027" || year === "2028" ? directGrantRuleContext(year === "2027" ? "estg-2027-v1" : "estg-2028-v1") : null;
  const text = (key: "monthly" | "start" | "end" | "oneOff" | "oneOffMonth", label: string, month = false) => {
    const error = payments.status === "invalid_input" && payments.field === key ? payments.message : null;
    return <div className="retirement-capital-field">
      <label htmlFor={id(key)}>{label}</label>
      <input id={id(key)} type={month ? "month" : "text"} inputMode={month ? undefined : "decimal"} value={plan.capital[key]}
        onChange={e => update(key, e.target.value)} aria-invalid={!!error} aria-describedby={error ? id(`${key}-error`) : undefined} />
      {error && <small id={id(`${key}-error`)} className="retirement-field-error">{error}</small>}
    </div>;
  };
  const legalSelect = <K extends keyof GrantDraft>(key: K, label: string, choices: readonly (readonly [string, string])[]) => <div className="retirement-capital-field">
    <label htmlFor={id(`evidence-${key}`)}>{label}</label><select id={id(`evidence-${key}`)} value={String(plan.evidence[key])}
      onChange={e => evidence(key, e.target.value as GrantDraft[K])}>{choices.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
  </div>;

  return <div className="retirement-customer" data-testid="customer-retirement">
    <div className="retirement-stage">
      <div className="retirement-stage-main">
        <section className="panel retirement-customer-inputs" aria-labelledby={id("inputs")}>
          <h2 id={id("inputs")}>Wie möchten Sie einzahlen?</h2>
          <form ref={form} className="retirement-form" noValidate onSubmit={e => {
            e.preventDefault();
            if (payments.status === "valid") next();
            else form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
          }}>
            <div className="retirement-capital-grid">
              {text("start", "Ab wann möchten Sie sparen?", true)}
              {text("end", "Bis wann möchten Sie sparen?", true)}
            </div>
            <ContributionOptimizer plan={plan} change={change} />
            {text("monthly", "Wie viel möchten Sie monatlich einzahlen?")}
            <p className="retirement-year-equivalent" data-testid="customer-annual">{payments.status === "valid"
              ? <><strong>{euro(payments.total)}</strong> Eigenbeitrag {year} · {payments.months} Monatsraten</>
              : "Der Jahresbeitrag erscheint, sobald Betrag und Zeitraum vollständig sind."}</p>
            <details><summary>Eigene Einmalzahlung ergänzen</summary>
              <p>Die Zahlung fließt im gewählten Monat zu. Für das erste Jahresziel zählt sie nur im selben Kalenderjahr.</p>
              <label className="retirement-checkbox"><input id={id("oneOffEnabled")} type="checkbox" checked={plan.capital.oneOffEnabled}
                onChange={e => update("oneOffEnabled", e.target.checked)} />Zusätzliche eigene Einmalzahlung einplanen</label>
              {plan.capital.oneOffEnabled && <div className="retirement-capital-grid">{text("oneOff", "Einmalzahlung in Euro")}{text("oneOffMonth", "Monat der Einmalzahlung", true)}</div>}
            </details>
            <div className="retirement-action-row">
              <button className="secondary" type="button" onClick={back}>Zurück zu meinen Voraussetzungen</button>
              <button className="primary" type="submit">Weiter zum Produktvergleich</button>
            </div>
          </form>
        </section>
    <details className="retirement-customer-details"><summary>Beraterprüfung: Förderung und Sonderfälle</summary>
      <div className="retirement-form"><p>Diese Angaben dokumentieren eine gesonderte fachliche Prüfung. Beruf, Familienstand und Geburtsjahr ersetzen keine Prüfung von Berechtigung, Vertrag und Kinderzuordnung. Beitragsjahr {year}.</p>
          <label htmlFor={id("funding")}>Wurde Ihre Förderberechtigung bereits geklärt?</label>
          <select id={id("funding")} value={plan.funding} onChange={e => edit({ ...plan, funding: e.target.value as CustomerPlan["funding"], evidence: changeYear(plan.evidence, plan.evidence.year) })}>
            <option value="open">Noch nicht</option><option value="checked">Ja – gesonderte Prüfung erforderlich</option><option value="special">Unklarer Sonderfall</option>
          </select>
          <label htmlFor={id("children")}>Gibt es Kinder, für die eine Kinderzulage infrage kommt?</label>
          <select id={id("children")} value={plan.children} onChange={e => edit({ ...plan, children: e.target.value as CustomerPlan["children"], evidence: { ...plan.evidence, childrenStatus: "unconfirmed", children: plan.evidence.children.map(c => ({ ...c, status: "assignment_unconfirmed" })) } })}>
            <option value="unknown">Unklar</option><option value="no">Nein</option><option value="yes">Ja</option>
          </select>
          {plan.children === "yes" && <p>Förderfähigkeit und Zuordnung klären wir für jedes Kind in der Beraterprüfung. Der Sparverlauf bleibt unabhängig davon nutzbar.</p>}
        {legalSelect("entitlement", "Geprüfte unmittelbare Berechtigung", [["unconfirmed", "Noch zu prüfen"], ["direct_confirmed", "Für Person und Jahr fachlich bestätigt"], ["indirect", "Mittelbare Berechtigung"], ["ineligible", "Nicht berechtigt"]])}
        {legalSelect("regime", "Geprüfte Förderregelung", [["unconfirmed", "Noch zu prüfen"], ["new_confirmed", "Neues Regime einschließlich etwaigem Wechsel fachlich bestätigt"], ["old", "Altes Riester-Regime"]])}
        {legalSelect("contract", "Geprüfte Vertragszuordnung", [["unconfirmed", "Noch zu prüfen"], ["single_eligible_confirmed", "Genau ein zulässiger Vertrag fachlich bestätigt"], ["multiple", "Mehrere Verträge"], ["transition_unconfirmed", "Übergang offen"]])}
        {plan.children === "no" ? <label className="retirement-checkbox"><input type="checkbox" checked={plan.evidence.childrenStatus === "none_confirmed"}
          onChange={e => edit({ ...plan, evidence: { ...plan.evidence, childrenStatus: e.target.checked ? "none_confirmed" : "unconfirmed", children: [] } })} />Für Person und Jahr geprüft: keine einzubeziehenden Kinder</label> : plan.children === "yes" ? <fieldset><legend>Kinder einzeln prüfen</legend>
          {plan.evidence.children.map((child, i) => <div className="retirement-child" key={child.id}><label htmlFor={id(child.id)}>Kind {i + 1}: Förderfähigkeit und Zuordnung</label>
            <select id={id(child.id)} value={child.status} onChange={e => edit({ ...plan, evidence: { ...plan.evidence, childrenStatus: "assigned_confirmed", children: plan.evidence.children.map(c => c.id === child.id ? { ...c, status: e.target.value as typeof c.status } : c) } })}>
              <option value="assignment_unconfirmed">Noch zu prüfen</option><option value="eligible_assigned_confirmed">Für Person und Jahr fachlich bestätigt</option><option value="conflicting_assignment">Widersprüchliche Zuordnung</option><option value="eligibility_unconfirmed">Förderfähigkeit offen</option>
            </select><button onClick={() => evidence("children", plan.evidence.children.filter(c => c.id !== child.id))}>Kind {i + 1} entfernen</button>
          </div>)}
          <button onClick={() => edit({ ...plan, evidence: { ...plan.evidence, childrenStatus: "assigned_confirmed", children: [...plan.evidence.children, { id: crypto.randomUUID(), status: "assignment_unconfirmed" }] } })}>Kind zur Prüfung hinzufügen</button>
        </fieldset> : <p>Die Kinderfrage ist noch offen. Es wird keine kinderlose Förderkonstellation angenommen.</p>}
        <label className="retirement-checkbox"><input type="checkbox" checked={plan.evidence.contributionConfirmed} onChange={e => evidence("contributionConfirmed", e.target.checked)} />Den geplanten Jahres-Eigenbeitrag für Person, Vertrag und Jahr fachlich als förderfähig geprüft</label>
        {grant.status !== "calculated" && <p data-testid="grant-review-message">Prüfhinweis: {grant.status === "unsupported" ? "Derzeit nicht unterstützt. " : "Fachlich prüfen. "}{grant.message}</p>}
      </div>
    </details>
    <details className="retirement-help"><summary>Regelstand und Quellen</summary>
      {rules ? <><p>Beitragsjahr {rules.contributionYear} · {rules.id} · geprüft am {rules.checkedOn} · {rules.calculationVersion}</p>
        <ul>{rules.sources.map(source => <li key={source}><a href={source} target="_blank" rel="noreferrer">{source}</a></li>)}</ul></> : <p>Für dieses Jahr liegt hier kein geprüfter Förderregelstand vor.</p>}
    </details>
      </div>
      <section className="panel retirement-funding-card retirement-stage-summary" aria-label="Ihre Förderung im Überblick" aria-live="polite">
        <h2>Ihr erstes Beitragsjahr</h2>
        <dl className="retirement-funding-totals">
          <div><dt>Eigener Jahresbeitrag · {year}</dt><dd>{payments.status === "valid" ? euro(payments.total) : "Eingabe prüfen"}</dd></div>
          <div><dt>Zulagen im Vertrag</dt><dd>{grant.status === "calculated" ? <span data-testid="total-grant">{euro(grant.result.totalGrantCents)}</span> : "Offen"}</dd></div>
          <div><dt>Möglicher Steuervorteil außerhalb des Vertrags</dt><dd>Gesondert prüfen</dd></div>
        </dl>
        {grant.status === "calculated" ? <div data-testid="grant-result">
          {grant.annualCents + grant.result.totalGrantCents > 0 && <div
            className="retirement-funding-bar" role="img"
            aria-label={`Finanzierung: ${euro(grant.annualCents)} Eigenbeitrag und ${euro(grant.result.totalGrantCents)} modellierte Zulagen`}>
            <span style={{ width: `${100 * grant.annualCents / (grant.annualCents + grant.result.totalGrantCents)}%` }} />
          </div>}
          <p className="retirement-state">Geprüfte Eingaben · regelbasiert modelliert</p>
          <dl className="retirement-funding-totals">
            <div><dt>Grundzulage</dt><dd data-testid="customer-base-grant">{euro(grant.result.baseGrantCents)}</dd></div>
            {grant.result.childGrants.map((child, i) => <div key={child.childId}><dt>Kinderzulage Kind {i + 1}</dt><dd data-testid="child-grant">{euro(child.grantCents)}</dd></div>)}
            <div><dt>Summe Kinderzulagen</dt><dd>{euro(grant.result.childrenGrantCents)}</dd></div>
            <div><dt>Eigenbeitrag und modellierte Zulagen</dt><dd data-testid="total-inflow">{euro(grant.annualCents + grant.result.totalGrantCents)}</dd></div>
          </dl>
          <p>Die Modellrechnung enthält keinen Einmalbonus und keine Buchungszusage.</p>
        </div> : <>
          <p className="retirement-state" data-testid="customer-grant-status">Gemeinsam prüfen</p>
          {possible.status === "calculated" && payments.status === "valid" ? <div data-testid="conditional-funding">
            <h3>Förderung · bedingtes Beispiel</h3>
            <p>Bei unmittelbarer Berechtigung, neuem Förderregime und einem zulässigen Vertrag wären <strong data-testid="conditional-base-grant">{euro(possible.result.baseGrantCents)}</strong> Grundzulage möglich.</p>
            <p>Kinderzulagen und Einmalbonus werden gesondert geprüft. Das Kapitalmodell übernimmt dieses bedingte Szenario nicht automatisch.</p>
          </div> : <p data-testid="conditional-funding-status">{possible.status === "calculated" ? "Bitte prüfen Sie zuerst Ihren Zahlungsplan." : possible.message}</p>}
        </>}
        <p>Für die Kapitalentwicklung zählen Zulagen erst als separat erfasstes Ereignis mit Förderjahr, Betrag und Buchungsmonat.</p>
      </section>
    </div>
  </div>;
}
