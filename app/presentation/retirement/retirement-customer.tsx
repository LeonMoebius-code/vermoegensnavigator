import { useId, useRef, useState } from "react";
import { childCard } from "../../domain/retirement/premium-evidence";
import { directGrantRuleContext } from "../../domain/retirement/direct-grant-rules";
import { changeYear, euro, parseEuroCents, type GrantDraft } from "./direct-grant-adapter";
import { conditionalBaseGrant, customerGrant, customerPayments, editCustomerCapital, editMonthlyContribution, paymentYear, type ChangeCustomerPlan, type CustomerPlan } from "./customer-plan-adapter";
import { DEFAULT_TIMELINE_DRAFT, resolvePremiumTimeline, type TimelineDraft } from "./premium-timeline";
import { PremiumTimelinePanel } from "./premium-timeline-panel";
import { ContributionOptimizer } from "./contribution-optimizer";
import { deriveFunding, claimVersion } from "../../domain/retirement/premium-funding";
import { fundingRegisterForCase } from "../../domain/retirement/premium-funding-input";
import { fundingBasis } from "./premium-plan-adapter";
import type { BoundFundingEvidence } from "./premium-funding-evidence-panel";
import type { CapitalDraft } from "./projection-adapter";

export function RetirementCustomer({ plan, change, back, next, fundingSelection = null, chooseFunding, timing = DEFAULT_TIMELINE_DRAFT, changeTiming, advisor = false, onAdvisor, boundFunding }: {
  plan: CustomerPlan; change: ChangeCustomerPlan; back: () => void; next: () => boolean;
  fundingSelection?: string | null; chooseFunding?: (month: string | null) => boolean;
  timing?: TimelineDraft; changeTiming?: (value: TimelineDraft) => void;
  advisor?: boolean; onAdvisor?: () => void; boundFunding?: BoundFundingEvidence | null;
}) {
  const prefix = useId(), form = useRef<HTMLFormElement>(null);
  const [modelBooking, setModelBooking] = useState<string | null>(fundingSelection);
  const [bookingError, setBookingError] = useState(false);
  const id = (key: string) => `${prefix}-${key}`;
  const update = <K extends keyof CapitalDraft>(key: K, value: CapitalDraft[K]) => change(current => {
    const capital = { ...current.capital, [key]: value };
    return key === "monthly" ? editMonthlyContribution(current, capital) : editCustomerCapital(current, capital);
  });
  const samePersonYear = (current: CustomerPlan) => current.birthYear === plan.birthYear
    && current.evidence.year === plan.evidence.year
    && paymentYear(current.capital.start) === String(plan.evidence.year);
  const evidence = <K extends keyof GrantDraft>(key: K, value: GrantDraft[K]) => change(current => {
    if (current.evidence[key] === value) return current;
    if (key === "contributionConfirmed" && value === true && (!samePersonYear(current) || current.evidence !== plan.evidence)) return current;
    // A positive legal assessment only applies to the rendered person and year.
    if ((key === "entitlement" && value === "direct_confirmed" || key === "regime" && value === "new_confirmed"
      || key === "contract" && value === "single_eligible_confirmed")
      && !samePersonYear(current)) return current;
    const next = { ...current.evidence, [key]: value };
    if (key === "entitlement" || key === "regime" || key === "contract") next.contributionConfirmed = false;
    if (key === "regime" || key === "contract") {
      next.childrenStatus = "unconfirmed";
      next.children = next.children.map(c => ({ ...c, status: "assignment_unconfirmed" }));
    }
    return { ...current, evidence: next };
  });
  const updateFunding = (funding: CustomerPlan["funding"]) => change(current => funding === current.funding
    ? current : { ...current, funding, evidence: changeYear(current.evidence, current.evidence.year) });
  const updateChildren = (children: CustomerPlan["children"]) => change(current => children === current.children ? current : {
    ...current, children, evidence: { ...current.evidence, childrenStatus: "unconfirmed",
      children: current.evidence.children.map(c => ({ ...c, status: "assignment_unconfirmed" })) },
  });
  const confirmNoChildren = (checked: boolean) => change(current => {
    if (current.children !== "no" || checked && (!samePersonYear(current) || current.evidence !== plan.evidence)) return current;
    return { ...current, evidence: { ...current.evidence, childrenStatus: checked ? "none_confirmed" : "unconfirmed", children: [] } };
  });
  const sameChildContext = (current: CustomerPlan) => current.children === plan.children
    && samePersonYear(current) && current.funding === plan.funding
    && current.evidence.entitlement === plan.evidence.entitlement
    && current.evidence.regime === plan.evidence.regime && current.evidence.contract === plan.evidence.contract;
  const updateChild = (id: string, status: GrantDraft["children"][number]["status"]) => change(current => {
    const child = current.evidence.children.find(c => c.id === id);
    if (current.children !== "yes" || !child || child.status === status) return current;
    if (status === "eligible_assigned_confirmed" && (!sameChildContext(current)
      || child.status !== plan.evidence.children.find(c => c.id === id)?.status)) return current;
    return { ...current, evidence: { ...current.evidence, childrenStatus: "assigned_confirmed",
      children: current.evidence.children.map(c => c.id === id ? { ...c, status } : c) } };
  });
  const removeChild = (id: string) => change(current => ({ ...current, evidence: {
    ...current.evidence, children: current.evidence.children.filter(c => c.id !== id),
  } }));
  const addChild = () => {
    const id = crypto.randomUUID();
    change(current => current.children !== "yes" ? current : {
      ...current, evidence: { ...current.evidence, childrenStatus: "assigned_confirmed",
        children: [...current.evidence.children, { id, status: "assignment_unconfirmed" }] },
    });
  };
  const payments = customerPayments(plan);
  let endOpen = false;
  if (timing.mode === "end_age") {
    try { resolvePremiumTimeline(plan, timing, null); }
    catch (error) {
      if (!(error instanceof Error) || error.name !== "AvdError") throw error;
      endOpen = true;
    }
  }
  const endIssue = { status: "review_required" as const, message: "Der letzte Sparmonat ist offen. Bitte klären Sie Spar-Endalter und Endmonat." };
  const grant = endOpen ? endIssue : customerGrant(plan);
  const possible = endOpen ? endIssue : conditionalBaseGrant(plan);
  const year = plan.capital.start.slice(0, 4);
  const importedCurrent = Boolean(boundFunding && boundFunding.basis === fundingBasis(plan)
    && boundFunding.opening === plan.capital.initial && timing.mode !== "holdings_only");
  const fiscalYear = /^\d{4}$/.test(year) && year >= "0100";
  const funding = boundFunding && fiscalYear && deriveFunding(
    fundingRegisterForCase(boundFunding.data, importedCurrent, boundFunding.opening === plan.capital.initial),
    { from: year + "-01", through: year + "-12", lastFundingYear: null },
  );
  const historical = funding ? funding.perspectives.NUR_BELEGTE_HISTORIE : null;
  const combined = funding ? funding.perspectives.BEDINGT_KOMBINIERT : null;
  const sum = (payments: readonly { cents: number }[]) => {
    const total = payments.reduce((result, event) => result + BigInt(event.cents), 0n);
    const amount = Number(total);
    return Number.isSafeInteger(amount) ? euro(amount) : "Offen";
  };
  const claims = new Map(boundFunding?.data.register.claims.map(claim => [claimVersion(claim), claim]));
  const components = { base: "Grundzulage", child: "Kinderzulage", bonus: "Berufseinsteigerbonus · einmalig" } as const;
  const availableChild = plan.evidence.children.some(child => {
    const terms = { class: "S" as const, source: "A2-conditional-child", version: year };
    return childCard({ caseId: "guided-case", personId: "primary", childId: child.id, year: Number(year),
      childBenefit: plan.children === "yes" && child.status === "eligible_assigned_confirmed" ? { value: true, evidence: terms } : null,
      assignment: child.status === "eligible_assigned_confirmed" ? { value: { personId: "primary", contractId: "planned" }, evidence: terms } : null,
      contractPath: plan.evidence.contract === "single_eligible_confirmed" && plan.evidence.regime === "new_confirmed" ? { value: true, evidence: terms } : null,
      contributionPath: grant.status === "calculated" ? { value: true, evidence: terms } : null,
      inputRevision: year }).status === "S";
  });
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
    <div className="retirement-stage avd-contribution-layout">
      <div className="retirement-stage-main">
        <section className="panel retirement-customer-inputs" aria-labelledby={id("inputs")}>
          <h2 id={id("inputs")}>Wie möchten Sie einzahlen?</h2>
          <form ref={form} className="retirement-form" noValidate onSubmit={e => {
            e.preventDefault();
            if (!next()) requestAnimationFrame(() => {
              const invalid = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
              if (!invalid) return;
              for (let parent = invalid.parentElement; parent && parent !== form.current; parent = parent.parentElement)
                if (parent instanceof HTMLDetailsElement) parent.open = true;
              invalid.focus();
            });
          }}>
            <div className="retirement-capital-grid">
              {text("start", "Ab wann möchten Sie sparen?", true)}
              {timing.mode === "dated" ? text("end", "Bis wann möchten Sie sparen?", true)
                : <div><strong>Letzter regulärer Sparmonat</strong><p>{timing.mode === "holdings_only" ? "Bestandsprojektion" : endOpen ? "Offen" : plan.capital.end}</p></div>}
            </div>
            <div className="avd-contribution-rate">
              {text("monthly", "Wie viel möchten Sie monatlich einzahlen?")}
              <input type="range" aria-label="Monatsrate einstellen" min={0} max={Math.max(570, (parseEuroCents(plan.capital.monthly) ?? 0) / 100)}
                step={5} value={(parseEuroCents(plan.capital.monthly) ?? 0) / 100}
                aria-valuetext={payments.status === "valid" ? euro(payments.monthly) : "Offen"}
                onChange={e => update("monthly", e.target.value)} />
              <p className="retirement-year-equivalent" data-testid="customer-annual">{payments.status === "valid" && !endOpen
                ? <><strong>{euro(payments.total)}</strong> Eigenbeitrag {year} · {payments.months} Monatsraten</>
                : "Der Jahresbeitrag erscheint, sobald Betrag und Zeitraum vollständig sind."}</p>
            </div>
            {changeTiming && <PremiumTimelinePanel plan={plan} draft={timing} change={changeTiming} />}
            <details><summary>Eigene Einmalzahlung ergänzen</summary>
              <p>Die Zahlung fließt im gewählten Monat zu. Für das erste Jahresziel zählt sie nur im selben Kalenderjahr.</p>
              <label className="retirement-checkbox"><input id={id("oneOffEnabled")} type="checkbox" checked={plan.capital.oneOffEnabled}
                onChange={e => update("oneOffEnabled", e.target.checked)} />Zusätzliche eigene Einmalzahlung einplanen</label>
              {plan.capital.oneOffEnabled && <div className="retirement-capital-grid">{text("oneOff", "Einmalzahlung in Euro")}{text("oneOffMonth", "Monat der Einmalzahlung", true)}
                <button type="button" className="secondary" onClick={() => update("oneOffEnabled", false)}>Einmalzahlung verwerfen</button></div>}
            </details>
            <ContributionOptimizer plan={plan} change={change} childGoalAvailable={availableChild} />
            <div className="retirement-action-row">
              <button className="secondary" type="button" onClick={back}>Zurück zu meinen Voraussetzungen</button>
              <button className="primary" type="submit">Weiter zum Produktvergleich</button>
            </div>
          </form>
        </section>
    <details className="retirement-customer-details" open={!advisor && onAdvisor ? false : undefined}>
      <summary onClick={e => {
        if (!advisor && onAdvisor) {
          e.preventDefault();
          const details = e.currentTarget.parentElement as HTMLDetailsElement;
          onAdvisor();
          requestAnimationFrame(() => { details.open = true; });
        }
      }}>Beraterprüfung: Förderung und Sonderfälle</summary>
      <div className="retirement-form"><p>Diese Angaben dokumentieren eine gesonderte fachliche Prüfung. Beruf, Familienstand und Geburtsjahr ersetzen keine Prüfung von Berechtigung, Vertrag und Kinderzuordnung. Beitragsjahr {year}.</p>
          <label htmlFor={id("funding")}>Wurde Ihre Förderberechtigung bereits geklärt?</label>
          <select id={id("funding")} value={plan.funding} onChange={e => updateFunding(e.target.value as CustomerPlan["funding"])}>
            <option value="open">Noch nicht</option><option value="checked">Ja – gesonderte Prüfung erforderlich</option><option value="special">Unklarer Sonderfall</option>
          </select>
          <label htmlFor={id("children")}>Gibt es Kinder, für die eine Kinderzulage infrage kommt?</label>
          <select id={id("children")} value={plan.children} onChange={e => updateChildren(e.target.value as CustomerPlan["children"])}>
            <option value="unknown">Unklar</option><option value="no">Nein</option><option value="yes">Ja</option>
          </select>
          {plan.children === "yes" && <p>Förderfähigkeit und Zuordnung klären wir für jedes Kind in der Beraterprüfung. Der Sparverlauf bleibt unabhängig davon nutzbar.</p>}
        {legalSelect("entitlement", "Geprüfte unmittelbare Berechtigung", [["unconfirmed", "Noch zu prüfen"], ["direct_confirmed", "Für Person und Jahr fachlich bestätigt"], ["indirect", "Mittelbare Berechtigung"], ["ineligible", "Nicht berechtigt"]])}
        {legalSelect("regime", "Geprüfte Förderregelung", [["unconfirmed", "Noch zu prüfen"], ["new_confirmed", "Neues Regime einschließlich etwaigem Wechsel fachlich bestätigt"], ["old", "Altes Riester-Regime"]])}
        {legalSelect("contract", "Geprüfte Vertragszuordnung", [["unconfirmed", "Noch zu prüfen"], ["single_eligible_confirmed", "Genau ein zulässiger Vertrag fachlich bestätigt"], ["multiple", "Mehrere Verträge"], ["transition_unconfirmed", "Übergang offen"]])}
        {plan.children === "no" ? <label className="retirement-checkbox"><input type="checkbox" checked={plan.evidence.childrenStatus === "none_confirmed"}
          onChange={e => confirmNoChildren(e.target.checked)} />Für Person und Jahr geprüft: keine einzubeziehenden Kinder</label> : plan.children === "yes" ? <fieldset><legend>Kinder einzeln prüfen</legend>
          {plan.evidence.children.map((child, i) => <div className="retirement-child" key={child.id}><label htmlFor={id(child.id)}>Kind {i + 1}: Förderfähigkeit und Zuordnung</label>
            <select id={id(child.id)} value={child.status} onChange={e => updateChild(child.id, e.target.value as typeof child.status)}>
              <option value="assignment_unconfirmed">Noch zu prüfen</option><option value="eligible_assigned_confirmed">Für Person und Jahr fachlich bestätigt</option><option value="conflicting_assignment">Widersprüchliche Zuordnung</option><option value="eligibility_unconfirmed">Förderfähigkeit offen</option>
            </select><button onClick={() => removeChild(child.id)}>Kind {i + 1} entfernen</button>
          </div>)}
          <button onClick={addChild}>Kind zur Prüfung hinzufügen</button>
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
        <p className="avd-kicker">Förderwirkung · {year || "Beitragsjahr offen"}</p>
        <h2>Ihr erstes Beitragsjahr</h2>
        <dl className="retirement-funding-totals">
          <div><dt>Monatlicher Eigenbeitrag</dt><dd>{payments.status === "valid" && !endOpen && timing.mode !== "holdings_only" ? euro(payments.monthly) : "Offen"}</dd></div>
          <div><dt>Eigener Jahresbeitrag · {year}</dt><dd>{payments.status === "valid" && !endOpen ? euro(payments.total) : "Eingabe prüfen"}</dd></div>
          <div><dt>Zulagen im Vertrag</dt><dd>{boundFunding ? "Siehe Förderbuchungen" : grant.status === "calculated" ? <><span data-testid="total-grant">{euro(grant.result.totalGrantCents)}</span> <small>modelliert</small></> : "Offen"}</dd></div>
          <div><dt>Möglicher Steuervorteil außerhalb des Vertrags</dt><dd>Gesondert prüfen</dd></div>
        </dl>
        {boundFunding && <>
          {!importedCurrent && <p className="avd-open" role="status">Die Förderprüfung ist veraltet. Belegte Buchungen bleiben erhalten.</p>}
          {historical && <dl className="retirement-funding-totals">
            <div><dt>Belegte Buchungen im Kalenderjahr</dt><dd>{historical.issues.length ? "Offen" : historical.payments.length ? sum(historical.payments) : "Keine Buchungen im Zeitraum"}</dd></div>
            <div><dt>Vertragszulagen einschließlich gewählter Annahmen</dt><dd>{combined && combined.issues.length === 0 ? sum(combined.payments) + " · modelliert" : "Offen"}</dd></div>
          </dl>}
          {combined && combined.issues.length > 0 && <p className="avd-open" role="status">Der vollständige Förderzufluss bleibt offen. Prüfen Sie Anspruch, Vertragszuordnung und mögliche Rückbuchungen.</p>}
          {importedCurrent && <ul className="avd-funding-components">{boundFunding.data.people.filter(person => String(person.year) === year).flatMap(person =>
            person.claims.map((claim, i) => <li key={claimVersion(claim) + i}><strong>{components[claim.key.component]}</strong>
              <span>{claim.amount ? euro(claim.amount.cents) + (claim.amount.evidence.class === "B" ? " · belegt" : " · bedingt") : "Offen"}</span>
              <small>Personenbezogener Anspruch · {person.personId}</small></li>))}</ul>}
          {historical && historical.payments.length > 0 && <details className="avd-disclosure"><summary>Belegter Anteil nach Buchungsmonat</summary>
            <ul>{historical.payments.map(event => {
              const claim = "claimVersion" in event ? claims.get(String(event.claimVersion)) : undefined;
              return <li key={event.id}>{event.month} · {claim ? components[claim.key.component] : "Zulage"} · {event.contractId ?? "Vertrag offen"} · {euro(event.cents)}</li>;
            })}</ul>
          </details>}
        </>}
        {!boundFunding && (grant.status === "calculated" ? <div data-testid="grant-result">
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
          <dl className="retirement-funding-totals"><div><dt>Berufseinsteigerbonus · einmalig</dt><dd>Gesondert prüfen</dd></div></dl>
          <p>Die Zulagenbeträge beruhen auf dem geprüften Förderfall. Die Auszahlung setzt eine gesondert erfasste Buchung voraus.</p>
          {chooseFunding && <>
          <label htmlFor={id("model-booking")}>Angenommener Buchungsmonat der Förderung</label>
          <input id={id("model-booking")} type="month" value={modelBooking ?? `${Number(year) + 1}-06`}
            aria-invalid={bookingError} onChange={event => {
              setModelBooking(event.target.value); setBookingError(false);
              if (fundingSelection) chooseFunding(null);
            }} />
          <button type="button" className="secondary" disabled={timing.mode === "holdings_only"} onClick={() => setBookingError(!chooseFunding(modelBooking ?? `${Number(year) + 1}-06`))}>
            Förderannahme im Kapitalmodell verwenden
          </button>
          {fundingSelection && <button type="button" className="secondary" onClick={() => chooseFunding(null)}>Förderannahme abwählen</button>}
          {bookingError && <p role="alert">Bitte einen Buchungsmonat ab dem Beitragsjahr wählen.</p>}
          {fundingSelection && <p role="status">A4 übernimmt die gewählte Förderannahme.</p>}
          </>}
        </div> : <>
          <p className="retirement-state" data-testid="customer-grant-status">Gemeinsam prüfen</p>
          {possible.status === "calculated" && payments.status === "valid" ? <div data-testid="conditional-funding">
            <h3>Förderung · bedingtes Beispiel</h3>
            <p>Bei unmittelbarer Berechtigung, neuem Förderregime und einem zulässigen Vertrag wären <strong data-testid="conditional-base-grant">{euro(possible.result.baseGrantCents)}</strong> Grundzulage möglich.</p>
            <p>Kinderzulagen und Einmalbonus werden gesondert geprüft. Das Kapitalmodell übernimmt dieses bedingte Szenario nicht automatisch.</p>
          </div> : <p data-testid="conditional-funding-status">{possible.status === "calculated" ? "Bitte prüfen Sie zuerst Ihren Zahlungsplan." : possible.message}</p>}
        </>)}
        {availableChild && <p data-testid="premium-child-card">Kinderzulage: Beitragsziel 300 € je zugeordnetem Kind im Modelljahr {year}. Die Annahme ist bedingt.</p>}
        {plan.children === "yes" && !availableChild && <p>Kinderzulage prüfen. Förderjahr, Kindergeld und die Zuordnung zum Vertrag müssen zusammenpassen.</p>}
        <p>Für die Kapitalentwicklung zählen Zulagen erst als separat erfasstes Ereignis mit Förderjahr, Betrag und Buchungsmonat.</p>
      </section>
    </div>
  </div>;
}
