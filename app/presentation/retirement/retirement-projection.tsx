import { useId, useRef } from "react";
import type { Issue, MoneyMetric, ProjectionResult, Response, ScenarioComparison } from "../../domain/retirement/projection-contract";
import { calculateCapital, issueMessage, scenarioNames, type CapitalDraft, type CapitalField, type CapitalRun } from "./projection-adapter";
import { euro } from "./direct-grant-adapter";

const responseStatus: Record<Response["status"], string> = { calculated: "Modellrechnung verfügbar", partial: "Teilweise berechenbar",
  review_required: "Fachlich zu prüfen", invalid_input: "Eingabe korrigieren", resource_error: "Kontrollierte Ressourcengrenze" };
export function projectionEuro(cents: number): string {
  const n = BigInt(cents), absolute = n < 0n ? -n : n;
  return `${n < 0n ? "−" : ""}${euro(Number(absolute))}`;
}
function Problem({ issue }: { issue: Issue | null }) {
  return issue && <div className="retirement-issue"><p>{issueMessage(issue)}</p>
    <details><summary>Prüfdetails</summary><code>{issue.code} · {issue.month ?? "ohne Monatszuordnung"} · {issue.path || "Gesamte Anfrage"}</code></details></div>;
}
function Metric({ label, value }: { label: string; value: MoneyMetric }) {
  return <div className="retirement-metric"><dt>{label}</dt><dd>{"displayCents" in value ? <>
    <strong>{projectionEuro(value.displayCents)}</strong><small>{value.status === "modelliert_unter_annahmen" ? "Modelliert unter Annahmen" : value.status === "regelbasiert" ? "Regelbasiert" : "Bestätigte Eingabe"} · UI-Annahmen ap04b-ui-v1</small>
    <details><summary>Rechenintervall</summary><small>{value.interval.lowerEuro} bis {value.interval.upperEuro} EUR.
      Numerisches Rechenintervall, keine Marktprognosespanne. Beide Grenzen ergeben dieselbe Centanzeige.</small></details>
  </> : value.status === "review_required" ? <><strong>Nicht belastbar</strong><Problem issue={value.issue} /></>
    : <><strong>In diesem Modus nicht berechnet</strong><small>Kein Nullbetrag und keine Aussage über reale Kosten.</small></>}</dd></div>;
}
function Ledger({ model }: { model: ProjectionResult }) {
  const ledger = model.ledger;
  if (!ledger) return null;
  const rows = ledger.mode === "detailed" ? ledger.rows.map(r => ({ period: r.month, value: r.closingBalance }))
    : ledger.blocks.map(b => ({ period: `${b.startMonth} bis ${b.endMonth}`, value: b.closingBalance }));
  const selected = rows.filter((_, i) => rows.length <= 12 || i < 6 || i >= rows.length - 6);
  return <details className="retirement-help"><summary>Kapitalverlauf · {model.period.monthCount} Modellmonate · {ledger.mode === "compact" ? "kompakte" : "detaillierte"} Ausgabe</summary>
    <p>Auszug: {rows.length > 12 ? `erste und letzte sechs von ${rows.length}` : rows.length} echte Domainzeilen.
      Die Berechnung umfasst den vollständigen Zeitraum; keine interpolierten Werte. Alle Kapitalwerte sind modelliert aus den bestätigten UI-Annahmen.</p>
    <table className="retirement-ledger"><caption>Monats-/Blockendkapital – keine Prognose oder Garantie</caption>
      <thead><tr><th scope="col">Zeitraum</th><th scope="col">Modellierter Endwert</th></tr></thead>
      <tbody>{selected.map(r => <tr key={r.period}><th scope="row">{r.period}</th><td>{"displayCents" in r.value ? projectionEuro(r.value.displayCents) : "Nicht belastbar"}</td></tr>)}</tbody></table>
  </details>;
}
function ModelResult({ model, reference = false }: { model: ProjectionResult; reference?: boolean }) {
  return <section className="retirement-model-result" data-testid={reference ? "reference-model" : "neutral-model"}>
    <h4>{reference ? "Ungeförderte ETF-/Fondsreferenz" : "Neutrales Altersvorsorgemodell"}</h4>
    <p>{model.valueBasis === "before_costs" ? "Bruttomodell ohne Kostenabzug – reale Kosten unbekannt" : "Nach explizitem hypothetischem Kostenpfad – keine Herstellerkosten"}.
      {model.status === "partial" ? " Teilszenario: weitere Zulagen offen." : model.status === "review_required" ? " Trajektorie gesperrt; unabhängige Eingabesummen können verfügbar sein." : " Modellrechnung, keine Prognose oder Zusage."}</p>
    <Problem issue={model.primaryIssue} />
    <dl>
      <Metric label="Eigene Einzahlungen" value={model.summary.totals.totalOwn} />
      <Metric label="Separat spezifizierte Zulagen" value={model.summary.totals.specifiedAllowances} />
      <Metric label="Vollständiger Zulagenzufluss im Modell" value={model.summary.completeAllowanceInflow} />
      <Metric label="Modellierte Marktentwicklung" value={model.summary.totals.marketResult} />
      <Metric label="Einmaliger Aktien-Stressverlust" value={model.summary.totals.stressLoss} />
      <Metric label="Modellierte Kosteninformation" value={model.summary.totals.totalCostAmount} />
      <Metric label="Endwert des spezifizierten Szenarios" value={model.summary.specifiedEndBalance} />
      <Metric label="Vollständiger Endwert im gewählten Modell" value={model.summary.completeEndBalance} />
    </dl>
    {model.excludedEvents.length > 0 && <p role="status">Nach Modellende nicht gebucht: {model.excludedEvents.map(e => `${e.month}: ${projectionEuro(e.cents)}`).join("; ")}.
      Diese hypothetischen Ereignisse sind nicht im Endwert enthalten.</p>}
    <Ledger model={model} />
  </section>;
}
function ComparisonResult({ comparison }: { comparison: ScenarioComparison }) {
  return <section className="retirement-reference-result" data-testid="capital-comparison">
    <h4>Vergleich bei gleichem Eigenbeitrag</h4>
    <p><strong>Bruttowerte beziehungsweise die oben benannte Kostenbasis.</strong> Keine Nachsteuer- oder Verfügbarkeitsgleichheit.
      Steuern, Vorabpauschale, Teilfreistellung, Sparerpauschbetrag und Auszahlungsbesteuerung sind nicht modelliert.</p>
    <p>Vergleichsstatus: {comparison.status === "calculated" ? "Vollständige vergleichbare Modellwerte" : comparison.status === "partial" ? "Nur Teilszenario – keine vollständige Differenz" : "Nicht vollständig vergleichbar"}.</p>
    {comparison.status === "calculated" ? <dl><Metric label="Vollständige Differenz Modell minus Referenz" value={comparison.completeDifference} /></dl>
      : <Problem issue={comparison.primaryIssue} />}
  </section>;
}
function Results({ result }: { result: Extract<CapitalRun, { status: "responses" }> }) {
  return <div data-testid="capital-results"><h2>Neutrale Kapitalentwicklung – drei Szenarien</h2>
    <p>Keine Produktsimulation, keine garantierte Unterkurve, kein individueller Förderanspruch. Die Beispielrenditen sind veränderbare Hypothesen.
      Zulagen sind Vertragszuflüsse, keine weiteren Eigenbeiträge und keine frei verfügbare Girogutschrift.</p>
    <div className="retirement-scenario-grid">{scenarioNames.map((name, i) => {
      const response = result.responses[result.mode === "comparison" ? 0 : i];
      const model = response.projectionResults[result.mode === "comparison" ? 2 * i : 0];
      const reference = result.mode === "comparison" ? response.projectionResults[2 * i + 1] : undefined;
      return <section className="panel retirement-scenario-result" key={name} aria-label={name}><h3>{name}</h3>
        <p>{responseStatus[response.status]}</p><Problem issue={response.primaryIssue} />
        {model && <ModelResult model={model} />}{reference && <ModelResult model={reference} reference />}
        {result.mode === "comparison" && response.comparisonResults[i] && <ComparisonResult comparison={response.comparisonResults[i]} />}
      </section>;
    })}</div>
    <details className="retirement-help"><summary>Rechenstand und Quellenbindung</summary>
      <p>Ausschließlich hypothetische UI-Annahmen ap04b-ui-v1; kein Hersteller- oder Buchungsnachweis. Nullwerte bezeichnen nur ausdrücklich gewählte Modellannahmen.</p>
      {result.responses.map((r, i) => <div key={i}><p>Anfrage {i + 1}: <code>{r.requestHash ?? "Kein gültiger Anfragehash"}</code></p>
        <p>Rechenversion: {r.supportedVersions.modelVersion} · {r.supportedVersions.numericConventionVersion}</p>
        <p>{r.sourceManifest.map(s => `${s.sourceId} / ${s.version}`).join("; ") || "Noch kein gültiges Quellenmanifest"}</p></div>)}
    </details>
  </div>;
}

function TextField({ id, label, value, change, invalid, error, month = false }: {
  id: string; label: string; value: string; change: (v: string) => void; invalid: boolean; error: string; month?: boolean;
}) {
  return <div className="retirement-capital-field"><label htmlFor={id}>{label}</label><input id={id} value={value}
    type={month ? "month" : "text"} min={month ? "0100-01" : undefined} max={month ? "9999-12" : undefined}
    inputMode={month ? undefined : "decimal"} onChange={e => change(e.target.value)} aria-invalid={invalid} aria-describedby={invalid ? error : undefined} /></div>;
}
export function RetirementProjection({ draft, change, result, show }: { draft: CapitalDraft; change: (d: CapitalDraft) => void;
  result: CapitalRun | null; show: (r: CapitalRun) => void }) {
  const prefix = useId(), output = useRef<HTMLDivElement>(null), error = `${prefix}-error`;
  const id = (field: CapitalField) => `${prefix}-${field}`;
  const invalid = (field: CapitalField) => result?.status === "invalid_input" && result.field === field;
  const edit = (next: CapitalDraft, field: CapitalField) => {
    const confirmations: CapitalField[] = ["confirmed", "costConfirmed", "referenceCostConfirmed", "grantConfirmed"];
    if (!confirmations.includes(field)) next = { ...next, confirmed: false, costConfirmed: false, referenceCostConfirmed: false, grantConfirmed: false };
    else if (field !== "confirmed") next = { ...next, confirmed: false };
    change(next);
  };
  const scalar = <K extends Exclude<keyof CapitalDraft, "scenarios">>(key: K, value: CapitalDraft[K]) => edit({ ...draft, [key]: value }, key);
  const text = (key: Exclude<keyof CapitalDraft, "scenarios">, label: string, asMonth = false) => <TextField id={id(key)} label={label}
    value={String(draft[key])} change={v => scalar(key, v as never)} invalid={invalid(key)} error={error} month={asMonth} />;
  const checkbox = (key: keyof CapitalDraft, label: string) => <label className="retirement-checkbox" htmlFor={id(key)}>
    <input id={id(key)} type="checkbox" checked={draft[key] === true} aria-invalid={invalid(key)} aria-describedby={invalid(key) ? error : undefined}
      onChange={e => scalar(key as Exclude<keyof CapitalDraft, "scenarios">, e.target.checked as never)} />{label}</label>;
  const costFields = (reference: boolean) => {
    const mode = reference ? "referenceCostMode" : "costMode", rate = reference ? "referenceCostPercent" : "costPercent", confirmed = reference ? "referenceCostConfirmed" : "costConfirmed";
    return <fieldset><legend>{reference ? "Kostenbasis der Referenz" : "Kostenbasis des neutralen Modells"}</legend>
      <label htmlFor={id(mode)}>{reference ? "Referenz-Kostenmodus" : "Modell-Kostenmodus"}</label>
      <select id={id(mode)} value={draft[mode]} onChange={e => scalar(mode, e.target.value as CapitalDraft[typeof mode])}>
        <option value="gross_unknown">Bruttomodell ohne Kostenabzug – Kosten unbekannt</option>
        <option value="explicit">Expliziter hypothetischer Kostenpfad</option>
      </select>
      {draft[mode] === "explicit" ? <>{text(rate, `${reference ? "Referenz: jährliche" : "Jährliche"} modellierte Bestandsminderung in %`)}
        <p>Nur eine fachlich kompatible vollständige Modell-Bestandsminderung. Keine ungeprüfte Hersteller-Effektivkostenquote oder zusätzliche Doppelbelastung.</p>
        {checkbox(confirmed, `${reference ? "Referenz: vollständigen" : "Vollständigen"} hypothetischen Kostenpfad bestätigt; keine Herstellerkosten übernommen`)}</>
        : <p>Kein bestätigter Nachkostenwert. Reale Kosten und Gesamtkostenbetrag sind nicht als 0 EUR bekannt.</p>}
    </fieldset>;
  };
  const calculate = () => {
    const next = calculateCapital(JSON.stringify(draft)); show(next);
    requestAnimationFrame(() => next.status === "invalid_input" && next.field !== "form"
      ? document.getElementById(id(next.field))?.focus() : output.current?.focus());
  };
  return <div className="retirement-capital">
    <p className="retirement-notice"><strong>Neutrales Kapitalmarktmodell, keine UniVorsorge-Produktsimulation.</strong> A3-Auswahl, Garantien und Hersteller-Ablaufmechaniken
      werden nicht eingerechnet. Keine Prognose, keine Förderzusage und keine Nachsteuerrechnung.</p>
    <p>A2-Übernahme ist eine spätere Etappe: kein automatisch gebundener Jahreswert und keine Wiederholung in Folgejahren.
      Hier sind nur eine ausdrücklich zulagenfreie/offene Abdeckung und klar hypothetische Einzelereignisse möglich.</p>
    <form className="retirement-form" onSubmit={e => { e.preventDefault(); calculate(); }} noValidate>
      <fieldset><legend>Zeitraum und eigene Zahlungen</legend><div className="retirement-capital-grid">
        {text("start", "Startmonat des Modells", true)}{text("end", "Endmonat des Modells", true)}
        {text("initial", "Anfangskapital in Euro")}{text("monthly", "Eigene monatliche Einzahlung in Euro")}
      </div><p>Anfangskapital unmittelbar vor dem Start; Einzahlungen am Monatsende. Eurobeträge mit Dezimalkomma, ohne Cent-Rundung. Kein Hochrechnen des ersten Jahres auf zwölf Raten.</p>
        {checkbox("oneOffEnabled", "Einmaligen eigenen Beitrag hinzufügen")}
        {draft.oneOffEnabled && <div className="retirement-capital-grid">{text("oneOff", "Einmaliger eigener Modellbeitrag in Euro")}{text("oneOffMonth", "Monat des einmaligen Modellbeitrags", true)}</div>}
      </fieldset>
      <fieldset><legend>Neutrale Marktannahmen</legend>{text("equity", "Modell-Aktienquote in %")}
        <p>Rentenquote ergänzt auf 100 %. Monatliches Rebalancing; geometrische Monatsrenditen aus den ausdrücklich gesetzten Jahresannahmen.</p>
        <div className="retirement-scenario-grid">{draft.scenarios.map((s, i) => <fieldset key={i}><legend>{scenarioNames[i]}</legend>
          {(["equity", "bond"] as const).map(key => <TextField key={key} id={id(`scenarios.${i}.${key}`)} label={`${scenarioNames[i]}: ${key === "equity" ? "Aktienrendite" : "Rentenrendite"} p.a. in %`}
            value={s[key]} error={error} invalid={invalid(`scenarios.${i}.${key}`)} change={v => edit({ ...draft,
              scenarios: draft.scenarios.map((x, n) => n === i ? { ...x, [key]: v } : x) }, `scenarios.${i}.${key}`)} />)}
        </fieldset>)}</div><p>Die Startwerte sind editierbare hypothetische Beispiele, keine Produktdaten und keine garantierte untere Entwicklung.</p>
        {checkbox("stressEnabled", "Einmaligen Aktienmarkt-Stress aktivieren")}
        {draft.stressEnabled && <><div className="retirement-capital-grid">{text("stressMonth", "Ereignismonat des Aktien-Stress", true)}
          {text("stressPercent", "Einmaliger Aktienkursverlust in %")}</div>
          <p>Beispiele: −20, −30 oder −40 %. Nur die Aktienkomponente vor neuen Einzahlungen wird belastet; der Gesamtportfolioeffekt hängt von der Quote ab.
            Kein automatischer Ausgleich: danach gelten ausschließlich die sichtbaren Renditeannahmen.</p></>}
      </fieldset>
      {costFields(false)}
      <fieldset><legend>Zulagenabdeckung und getrennte Ereignisse</legend><label htmlFor={id("coverage")}>Zulagenabdeckung im Modell</label>
        <select id={id("coverage")} value={draft.coverage} onChange={e => scalar("coverage", e.target.value as CapitalDraft["coverage"])}>
          <option value="none_assumed">Ohne weitere Zulagen angenommen – keine Anspruchsaussage</option><option value="unknown">Weitere Zulagen offen – nur Teilszenario</option>
        </select>
        {draft.coverage === "unknown" && text("openYears", "Offene Förderjahre, aufsteigend und kommagetrennt")}
        <p>Bekannte explizite Ereignisse bleiben enthalten. Offene Jahre erzeugen keine erfundenen Zahlungen.</p>
        {checkbox("grantEnabled", "Einmalige manuelle Zulagenhypothese hinzufügen")}
        {draft.grantEnabled && <>{text("grantYear", "Förderjahr der manuellen Zulagenhypothese")}{text("grantAmount", "Betrag der manuellen Zulagenhypothese in Euro")}
          {text("grantMonth", "Hypothetischer Buchungsmonat der Zulage", true)}
          <p>Manuelle Modellannahme, kein A2-Transfer, kein Bescheid und keine tatsächliche Vertragsgutschrift. Einmaliger Vertragszufluss, keine Eigenzahlung oder Girogutschrift.
            Es gibt keinen allgemeinen Mai-/Junitermin. Nach Modellende wird das Ereignis ausdrücklich ausgeschlossen.</p>
          {checkbox("grantConfirmed", "Förderjahr, Betrag und Buchungsmonat dieser einmaligen rein hypothetischen Zulage bestätigt")}</>}
      </fieldset>
      <fieldset><legend>Freiwillige ungeförderte Referenz</legend>{checkbox("referenceEnabled", "Ungeförderten ETF-/Fondssparplan vergleichen")}
        {draft.referenceEnabled && <>{text("referenceEquity", "Aktienquote der ungeförderten Referenz in %")}
          <p>Gleiche eigenen Beiträge, Anfangswerte und Kalenderzeitpunkte in allen sechs Projektionen. Keine Zulagen auf der Referenzseite.
            Dieselben drei Aktien-/Renten-Marktannahmen; eigene Referenzquote und ausdrücklich abgegrenzte Kostenbasis.</p>{costFields(true)}
          <p>Bruttowerte oder benannte Kostenbasis; keine Nachsteuer- oder Verfügbarkeitsgleichheit. Keine pauschale Gleichsetzung unterschiedlicher Steuer- und Auszahlregeln.</p></>}
        <p>Gleicher wirtschaftlicher Nettoaufwand: späterer, gesondert zu entscheidender Ausbau; in diesem Modell nicht berechenbar oder freigeschaltet.</p>
      </fieldset>
      <label htmlFor={id("output")}>Ausgabeumfang</label><select id={id("output")} value={draft.output} onChange={e => scalar("output", e.target.value as CapitalDraft["output"])}>
        <option value="auto">Automatisch – Vertragsgrenzen beachten</option><option value="compact">Kompakt – vollständige Berechnung</option><option value="detailed">Detailliert – bei langen Zeiträumen begrenzt</option>
      </select>
      {checkbox("confirmed", "Die sichtbaren neutralen Modellannahmen für diesen aktuellen Snapshot bewusst bestätigt")}
      <button className="primary" type="submit">Neutrale Kapitalentwicklung berechnen</button>
    </form>
    <div className="retirement-result" ref={output} tabIndex={-1} aria-live="polite">
      {result?.status === "invalid_input" ? <p id={error} role="alert">Eingabe korrigieren: {result.message}</p>
        : result?.status === "responses" ? <Results result={result} />
        : <p role="status" data-testid="capital-empty">Noch kein aktuelles Kapitalergebnis. Angaben und Bestätigungen prüfen; nach Änderungen neu berechnen.</p>}
    </div>
  </div>;
}
