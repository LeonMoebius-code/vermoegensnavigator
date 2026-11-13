import { useId, useRef, useState, type ReactNode } from "react";
import { annualContribution, changeYear, euro, type GrantDraft } from "./direct-grant-adapter";
import { customerGrant, editCustomerCapital, metricCents, plannedGrantDraft, runCustomerCapital, type CustomerPlan } from "./customer-plan-adapter";
import { issueMessage, type CapitalDraft } from "./projection-adapter";
import { projectionEuro, RetirementProjection } from "./retirement-projection";
import { RetirementChart, customerScenarioNames } from "./retirement-chart";

export function RetirementCustomer({ plan, change, back, review, orientation }: { plan: CustomerPlan; change: (p: CustomerPlan) => void; back: () => void; review?: () => void; orientation?: ReactNode }) {
  const prefix = useId(), resultRef = useRef<HTMLElement>(null);
  const [run, setRun] = useState<ReturnType<typeof runCustomerCapital> | null>(null);
  const id = (key: string) => `${prefix}-${key}`;
  const edit = (next: CustomerPlan) => {
    if (run?.status === "invalid_input" || JSON.stringify(next.capital) !== JSON.stringify(plan.capital)) setRun(null);
    change(next);
  };
  const cap = (key: keyof CapitalDraft, value: CapitalDraft[keyof CapitalDraft]) => edit(editCustomerCapital(plan, { ...plan.capital, [key]: value }));
  const evidence = <K extends keyof GrantDraft>(key: K, value: GrantDraft[K]) => {
    if (plan.evidence[key] === value) return;
    const next = { ...plan.evidence, [key]: value };
    if (key === "entitlement" || key === "regime" || key === "contract") next.contributionConfirmed = false;
    if (key === "regime" || key === "contract") {
      next.childrenStatus = "unconfirmed";
      next.children = next.children.map(c => ({ ...c, status: "assignment_unconfirmed" }));
    }
    edit({ ...plan, evidence: next });
  };
  const derived = plannedGrantDraft(plan), grant = customerGrant(plan);
  const own = "status" in derived ? derived : annualContribution(derived);
  const error = run?.status === "invalid_input" ? run : null;
  const models = run?.status === "responses" ? customerScenarioNames.map((_, i) =>
    run.responses[run.mode === "comparison" ? 0 : i]?.projectionResults[run.mode === "comparison" ? i * 2 : 0]) : [];
  const references = run?.status === "responses" && run.mode === "comparison" ? customerScenarioNames.map((_, i) => run.responses[0]?.projectionResults[i * 2 + 1]) : [];
  const text = (key: keyof CapitalDraft, label: string, month = false) => <div className="retirement-capital-field">
    <label htmlFor={id(key)}>{label}</label><input id={id(key)} type={month ? "month" : "text"} inputMode={month ? undefined : "decimal"}
      min={month ? "0100-01" : undefined} max={month ? "9999-12" : undefined} value={String(plan.capital[key])}
      onChange={e => cap(key, e.target.value)} aria-invalid={error?.field === key} aria-describedby={error?.field === key ? id("error") : undefined} />
    {error?.field === key && <p id={id("error")} className="retirement-field-error" role="alert">{error.message}</p>}
  </div>;
  const check = (key: keyof CapitalDraft, label: string) => <div><label className="retirement-checkbox" htmlFor={id(key)}><input id={id(key)} type="checkbox" checked={plan.capital[key] === true}
    aria-invalid={error?.field === key} aria-describedby={error?.field === key ? id("check-error") : undefined}
    onChange={e => {
      const next = { ...plan.capital, [key]: e.target.checked };
      // Explicit evidence actions are preserved; ordinary edits revoke the evidence.
      edit(key === "grantConfirmed" || key === "costConfirmed" || key === "referenceCostConfirmed"
        ? { ...plan, capital: next } : editCustomerCapital(plan, next));
    }} />{label}</label>{error?.field === key && <p id={id("check-error")} role="alert">{error.message}</p>}</div>;
  const legalSelect = <K extends keyof GrantDraft>(key: K, label: string, choices: readonly (readonly [string, string])[]) => <div className="retirement-capital-field">
    <label htmlFor={id(`evidence-${key}`)}>{label}</label><select id={id(`evidence-${key}`)} value={String(plan.evidence[key])}
      onChange={e => evidence(key, e.target.value as GrantDraft[K])}>{choices.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
  </div>;
  const calculate = () => {
    const next = runCustomerCapital(plan); setRun(next);
    requestAnimationFrame(() => {
      if (next.status === "invalid_input") {
        const field = document.getElementById(id(next.field));
        if (field) { let parent = field.parentElement; while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; } field.focus(); }
        else resultRef.current?.focus();
      } else resultRef.current?.focus();
    });
  };
  const cost = (reference: boolean) => {
    const mode = reference ? "referenceCostMode" : "costMode", percent = reference ? "referenceCostPercent" : "costPercent", confirmed = reference ? "referenceCostConfirmed" : "costConfirmed";
    return <fieldset><legend>{reference ? "Kosten der Referenz" : "Kostenannahmen"}</legend><label htmlFor={id(mode)}>Kostenbasis{reference ? " der Referenz" : " des Modells"}</label>
      <select id={id(mode)} value={plan.capital[mode]} onChange={e => cap(mode, e.target.value)}>
        <option value="gross_unknown">Bruttomodell – reale Kosten offen</option><option value="explicit">Hypothetische jährliche Bestandsminderung</option>
      </select>{plan.capital[mode] === "explicit" && <>{text(percent, reference ? "Jährliche Bestandsminderung der Referenz in %" : "Jährliche Bestandsminderung in %")}
        <p>Vollständige hypothetische Modellkosten, keine Hersteller-Effektivkostenquote.</p>{check(confirmed, reference ? "Hypothetischen Referenzkostenpfad fachlich bestätigt" : "Hypothetischen Kostenpfad fachlich bestätigt")}</>}
    </fieldset>;
  };
  const year = plan.capital.start.slice(0, 4);
  return <div className="retirement-customer" data-testid="customer-retirement">
    <div className="retirement-customer-intro"><p>Ihr Sparvorhaben, verständlich auf einen Blick.</p><p className="retirement-test-note">Testansicht · nur synthetische Daten · Eingaben werden nicht gespeichert.</p></div>
    {orientation}
    {review && <button className="secondary" onClick={review}>Zurück zu meinen Voraussetzungen</button>}
    <div className="retirement-customer-layout">
      <section className="panel retirement-customer-inputs" aria-labelledby={id("inputs")}>
        <h2 id={id("inputs")}>Ihr Sparvorhaben</h2>
        <form className="retirement-form" noValidate onSubmit={e => { e.preventDefault(); calculate(); }}>
          <div className="retirement-capital-field"><label htmlFor={id("birthYear")}>In welchem Jahr sind Sie geboren? <small>(optional)</small></label>
            <input id={id("birthYear")} inputMode="numeric" value={plan.birthYear} aria-invalid={error?.field === "birthYear"}
              aria-describedby={error?.field === "birthYear" ? id("birth-error") : undefined}
              onChange={e => edit({ ...plan, birthYear: e.target.value, evidence: changeYear(plan.evidence, plan.evidence.year) })} />
            {error?.field === "birthYear" && <p id={id("birth-error")} role="alert">{error.message}</p>}
          </div>
          {text("monthly", "Wie viel möchten Sie monatlich einzahlen?")}
          <p className="retirement-year-equivalent" data-testid="customer-annual">{"cents" in own ? <><strong>{euro(own.cents)}</strong> geplanter Eigenbeitrag {year} · {"status" in derived ? "" : `${derived.months} Monatsraten`}</> : "Der Jahresbeitrag erscheint, sobald Betrag und Zeitraum vollständig sind."}</p>
          {text("start", "Ab wann möchten Sie sparen?", true)}
          {text("end", "Bis wann möchten Sie sparen?", true)}
          <small>Modellziel, kein bestätigter Auszahlungsbeginn. Die tatsächliche Verfügbarkeit hängt vom Vertrag und den rechtlichen Voraussetzungen ab.</small>
          <button className="primary" type="submit">Modellrechnung anzeigen</button>
        </form>
      </section>
      <section className="retirement-customer-overview" ref={resultRef} tabIndex={-1} aria-label="Ihre Ergebnisse" aria-live="polite">
        <div className="panel retirement-funding-card"><h2>Ihre Förderung im Überblick</h2>
          {grant.status === "calculated" ? <><p className="retirement-state">Berechnet · Beitragsjahr {year}</p><dl className="retirement-customer-metrics">
            <div><dt>Eigener Jahresbeitrag</dt><dd>{euro(grant.annualCents)}</dd></div>
            <div><dt>Grundzulage</dt><dd data-testid="customer-base-grant">{euro(grant.result.baseGrantCents)}</dd></div>
            <div><dt>Zugeordnete Kinderzulagen</dt><dd>{euro(grant.result.childrenGrantCents)}</dd></div>
            <div><dt>Eigenbeitrag und berechnete Zulagen</dt><dd>{euro(grant.annualCents + grant.result.totalGrantCents)}</dd></div>
          </dl><p>Regelbasierte Modellrechnung unter den fachlich geprüften Angaben, keine Buchungszusage.</p></>
            : <><p className="retirement-state" data-testid="customer-grant-status">Gemeinsam prüfen</p><p>Ob die Förderung in Ihrem Fall möglich ist, prüfen wir gemeinsam.
              {plan.children !== "no" ? " Dazu gehört auch die Zuordnung möglicher Kinderzulagen." : ""}</p></>}
          <small>Ein möglicher Einmalbonus ist noch zu prüfen und nicht als Betrag enthalten.</small>
        </div>
        <div className="panel retirement-capital-overview"><h2>Was aus Ihren Einzahlungen werden könnte</h2>
          <p>Neutrale Modellrechnung ohne automatisch angerechnete Förderzulagen. Keine Produktprognose oder Garantie.</p>
          <p className="retirement-test-note">Annahmen: {plan.capital.equity} % Aktien; jährliche Aktien-/Rentenrenditen je Szenario {plan.capital.scenarios.map(s => `${s.equity} / ${s.bond} %`).join(" · ")}. Änderungen unter „Feineinstellungen“.</p>
          {plan.capital.grantEnabled && <p>Zusätzlich gewählt: eine einmalige hypothetische Zulage. Diese ist keine bestätigte Förderung und wird nicht wiederholt.</p>}
          {run?.status === "responses" ? <>
            <dl className="retirement-customer-metrics">{customerScenarioNames.map((name, i) => {
              const model = models[i], value = model ? metricCents(model.summary.specifiedEndBalance) : null;
              return <div key={name}><dt>{name}</dt><dd data-testid="customer-end-value">{value === null ? "Gemeinsam prüfen" : projectionEuro(value)}</dd>
                <small>{model?.status === "partial" ? "Teilszenario · weitere Zulagen offen" : "Modellannahme"}</small></div>;
            })}</dl>
            {models[1] && <p data-testid="customer-own">Eigene Einzahlungen: {metricCents(models[1].summary.totals.totalOwn) === null ? "noch zu prüfen" : projectionEuro(metricCents(models[1].summary.totals.totalOwn)!)}.
              {models[1].valueBasis === "before_costs" ? " Bruttowerte; reale Kosten sind offen." : " Nach ausdrücklich gewählten hypothetischen Modellkosten."}</p>}
            {run.responses.some(r => r.primaryIssue && r.primaryIssue.code !== "allowance_coverage_unknown") && <p role="status">Ein Teil der Modellrechnung benötigt eine Prüfung. Die konkrete Ursache steht in den Rechendetails.</p>}
            <RetirementChart models={models} />
            {references.length > 0 && <><p>Vergleich mit ETF-/Fondssparplan bei gleichen Eigenzahlungen und Terminen. Steuern und unterschiedliche Verfügbarkeit sind nicht berücksichtigt; daraus folgt keine Wechsel- oder Produktempfehlung.</p><RetirementChart models={references} reference /></>}
          </> : <p role="status" data-testid="customer-capital-status">{error ? "Bitte korrigieren Sie die markierte Eingabe. Ihre übrigen Angaben bleiben erhalten." : "Mit Ihrer Sparrate und den sichtbaren Modellannahmen können Sie hier drei Szenarien anzeigen. Nach Änderungen ist eine neue Berechnung erforderlich."}</p>}
          {error && !["birthYear", "start", "end", "monthly", "initial", "equity", "oneOff", "oneOffMonth", "stressMonth", "stressPercent", "costPercent", "referenceCostPercent", "referenceEquity", "grantYear", "grantMonth", "grantAmount", "grantConfirmed", "openYears"].includes(error.field) && !error.field.startsWith("scenarios.") && <p role="alert">{error.message}</p>}
        </div>
      </section>
    </div>
    <details className="retirement-customer-details"><summary>Feineinstellungen und Modellannahmen</summary>
      <div className="retirement-form"><p>Die voreingestellten Renditen sind hypothetische Beispiele. Die Szenarien haben keine zugeordneten Wahrscheinlichkeiten.</p>
        <div className="retirement-capital-grid">{text("initial", "Anfangskapital in Euro")}{text("equity", "Aktienquote in %")}</div>
        <div className="retirement-scenario-grid">{plan.capital.scenarios.map((s, i) => <fieldset key={i}><legend>{customerScenarioNames[i]}</legend>
          {(["equity", "bond"] as const).map(asset => <div className="retirement-capital-field" key={asset}><label htmlFor={id(`scenarios.${i}.${asset}`)}>{customerScenarioNames[i]}: {asset === "equity" ? "Aktienrendite" : "Rentenrendite"} in % p. a.</label>
            <input id={id(`scenarios.${i}.${asset}`)} inputMode="decimal" value={s[asset]} aria-invalid={error?.field === `scenarios.${i}.${asset}`}
              aria-describedby={error?.field === `scenarios.${i}.${asset}` ? id("scenario-error") : undefined}
              onChange={e => edit(editCustomerCapital(plan, { ...plan.capital, scenarios: plan.capital.scenarios.map((v, n) => n === i ? { ...v, [asset]: e.target.value } : v) }))} />
            {error?.field === `scenarios.${i}.${asset}` && <p id={id("scenario-error")} role="alert">{error.message}</p>}
          </div>)}
        </fieldset>)}</div>
        {check("oneOffEnabled", "Zusätzliche eigene Einmalzahlung einplanen")}
        {plan.capital.oneOffEnabled && <div className="retirement-capital-grid">{text("oneOff", "Einmalzahlung in Euro")}{text("oneOffMonth", "Monat der Einmalzahlung", true)}</div>}
        {check("stressEnabled", "Einmaligen Aktienkursverlust modellieren")}
        {plan.capital.stressEnabled && <div className="retirement-capital-grid">{text("stressMonth", "Monat des Aktienkursverlusts", true)}{text("stressPercent", "Aktienkursverlust in %")}</div>}
        {cost(false)}{check("referenceEnabled", "Vergleich mit normalem ETF-/Fondssparplan anzeigen")}
        {plan.capital.referenceEnabled && <>{text("referenceEquity", "Aktienquote der Referenz in %")}{cost(true)}</>}
      </div>
    </details>
    <details className="retirement-customer-details"><summary>Beraterprüfung: Förderung und Sonderfälle</summary>
      <div className="retirement-form"><p>Diese Angaben dokumentieren eine gesonderte fachliche Prüfung. Eine Kundenantwort bestätigt weder Berechtigung noch Vertrag oder Kinderzuordnung. Beitragsjahr {year}.</p>
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
        {grant.status !== "calculated" && <p>Prüfhinweis: {grant.message}</p>}
      </div>
    </details>
    <details className="retirement-customer-details"><summary>Prüfansicht: Zulagenereignisse und Rechendetails</summary>
      <div className="retirement-form"><label htmlFor={id("coverage")}>Weitere Zulagen im Kapitalmodell</label><select id={id("coverage")} value={plan.capital.coverage} onChange={e => cap("coverage", e.target.value)}>
        <option value="none_assumed">Ohne weitere Zulagen modellieren – keine Anspruchsaussage</option><option value="unknown">Zulagen offen – Teilszenario</option>
      </select>{plan.capital.coverage === "unknown" && text("openYears", "Offene Förderjahre, aufsteigend und kommagetrennt")}
        {check("grantEnabled", "Einmalige hypothetische Zulage modellieren")}{plan.capital.grantEnabled && <>{text("grantYear", "Förderjahr der hypothetischen Zulage")}{text("grantAmount", "Hypothetische Zulage in Euro")}{text("grantMonth", "Hypothetischer Buchungsmonat", true)}
          <p>Einmalige Hypothese, kein Förderbescheid und kein automatischer Übertrag der Förderkarte.</p>{check("grantConfirmed", "Förderjahr, Betrag und Buchungsmonat ausdrücklich als einmalige Hypothese bestätigt")}</>}
        <label htmlFor={id("output")}>Ausgabeumfang</label><select id={id("output")} value={plan.capital.output} onChange={e => cap("output", e.target.value)}><option value="auto">Automatisch</option><option value="compact">Kompakte Originalblöcke</option><option value="detailed">Originalmonate (bei langen Laufzeiten begrenzt)</option></select>
        {run?.status === "responses" && <><p>Alle Werte stammen aus dem unveränderten Monatsrechenkern. Einzahlungen zum Monatsende; monatliche Zielquotengewichtung. Keine Steuer-, Renten- oder Herstellerrechnung.</p>
          {run.responses.map((r, i) => <div key={i}><p>Anfrage {i + 1}: <code>{r.requestHash}</code> · {r.supportedVersions.modelVersion}</p>{r.primaryIssue && <p>{issueMessage(r.primaryIssue)}</p>}</div>)}
          <details><summary>Vollständige Ergebnis- und Quellenprüfung</summary><RetirementProjection draft={plan.capital} change={next => edit(editCustomerCapital(plan, next))} result={run} show={setRun} /></details>
        </>}
      </div>
    </details>
    <button className="secondary" onClick={back}>Zurück zur Auswahl</button>
  </div>;
}
