import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { directGrantRuleContext } from "../../domain/retirement/direct-grant-rules";
import { annualContribution, changeMode, changeYear, emptyGrantDraft, euro, previewGrant,
  type DraftField, type GrantDraft, type Preview } from "./direct-grant-adapter";
import { oldRiesterRuleContext } from "../../domain/retirement/old-riester-grant-rules";
import { changeOldMode, changeOldYear, emptyOldDraft, oldContribution, oldRuleId, previewComparison, previewOldGrant,
  type Comparison, type NewScenario, type OldDraft, type OldField, type OldPreview, type NewPreview } from "./old-riester-adapter";

export interface RetirementNavigation { confirmDiscard: () => boolean }
const discardMessage = "Ungespeicherten Altersvorsorgeentwurf verwerfen? Alle Vorsorgeeingaben gehen verloren. Allgemeine Vermögensfälle bleiben erhalten.";
const bonusNotice = "Einmalbonus gesondert zu prüfen; in den angezeigten Förderbeträgen nicht enthalten.";
const modelNotice = "Jahresbezogene Modellrechnung, keine individuelle Förderzusage. Einmalbonus gesondert prüfen.";
const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
function Help({ children }: { children: ReactNode }) {
  return <details className="retirement-help"><summary>Was bedeutet das?</summary><p>{children}</p></details>;
}

/** The entire draft lives here; unmount discards it. No persistence or general-case API. */
export const RetirementEntry = forwardRef<RetirementNavigation>(function RetirementEntry(_, ref) {
  const [draft, setDraft] = useState(emptyGrantDraft);
  const [step, setStep] = useState<"choice" | "a1" | "a2" | "b1" | "b2">("choice");
  const [bDraft, setBDraft] = useState(emptyOldDraft);
  const [bPreview, setBPreview] = useState<Comparison | null>(null);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [changed, setChanged] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const resultArea = useRef<HTMLDivElement>(null);
  const fieldPrefix = useId();
  const fieldId = (field: DraftField) => `${fieldPrefix}-${field}`;
  const errorId = `${fieldPrefix}-error`;
  const confirmDiscard = () => !dirty || window.confirm(discardMessage);
  useImperativeHandle(ref, () => ({ confirmDiscard }), [dirty]);
  useEffect(() => { title.current?.focus(); }, [step]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const update = (next: GrantDraft) => {
    setDraft(next); setDirty(true); setPreview(null); setChanged(true);
  };
  const field = <K extends DraftField>(key: K, value: GrantDraft[K]) => update({ ...draft, [key]: value });
  const contributionField = <K extends DraftField>(key: K, value: GrantDraft[K]) => update({ ...draft, [key]: value, contributionConfirmed: false });
  const invalidField = preview && preview.status !== "calculated" ? preview.field : undefined;
  const propsFor = (key: DraftField) => ({ id: fieldId(key), "aria-invalid": invalidField === key,
    "aria-describedby": invalidField === key ? errorId : undefined });
  const contribution = annualContribution(draft);
  const rules = draft.year === 2027 || draft.year === 2028
    ? directGrantRuleContext(draft.year === 2027 ? "estg-2027-v1" : "estg-2028-v1") : null;
  const calculate = () => {
    const next = previewGrant(draft);
    setPreview(next); setChanged(false);
    if (next.status !== "calculated" && next.field && ["year", "entitlement", "regime", "contract", "childrenStatus", "children"].includes(next.field)) setStep("a1");
    // Wait for the error/result DOM, never for a previous computation snapshot.
    requestAnimationFrame(() => {
      if (next.status !== "calculated" && next.field) document.getElementById(fieldId(next.field))?.focus();
      else resultArea.current?.focus();
    });
  };
  const restart = () => {
    if (!confirmDiscard()) return;
    setDraft(emptyGrantDraft()); setDirty(false); setPreview(null); setChanged(false); setStep("choice");
    setBDraft(emptyOldDraft()); setBPreview(null);
    title.current?.focus();
  };
  return <div className="tool-view retirement-view">
    <p className="eyebrow">SPEZIALISIERTE BERATUNG · ALTERSVORSORGE</p>
    <h1 ref={title} tabIndex={-1}>{step === "choice" ? "Altersvorsorge" : step === "a1" ? "A1 – Fördercheck" : step === "a2" ? "A2 – Sparen & Förderung" : step === "b1" ? "B1 – Bestandsaufnahme" : "B2 – Fördervergleich"}</h1>
    <p className="retirement-notice"><strong>Ungespeicherte Modellvorschau.</strong> Nur synthetische Testdaten verwenden.
      Eingaben bleiben ausschließlich während dieses geöffneten Entwurfs erhalten. Verlassen, Neuladen oder Schließen verwirft sie.
      Ein Browserhinweis beim Neuladen/Schließen ist browserabhängig. Es gibt keine automatische Wiederherstellung.</p>
    <p className="retirement-notice">{modelNotice} {bonusNotice}</p>
    {step === "choice" ? <div className="retirement-cards">
      <section className="panel">
        <p className="eyebrow">BERATUNGSWEG A · A1/A2</p><h2>Neue Altersvorsorge planen</h2>
        <p>Bestätigten unmittelbaren Standard 2027/2028 prüfen und Beiträge sowie Grund- und Kinderzulagen ansehen.</p>
        <button className="primary" onClick={() => { setPreview(null); setBPreview(null); setStep("a1"); }}>A – Neue Altersvorsorge planen</button>
      </section>
      <section className="panel">
        <p className="eyebrow">BERATUNGSWEG B · B1/B2</p><h2>Bestehende Riester-Rente prüfen</h2>
        <p>Alt-Fördercheck und bedingter Fördermodellvergleich ohne Vertragswerte.</p>
        <button className="primary" onClick={() => { setPreview(null); setBPreview(null); setStep("b1"); }}>B – Bestehende Riester-Rente prüfen</button>
      </section>
    </div> : step === "b1" || step === "b2" ? <OldRiesterView draft={bDraft} step={step} preview={bPreview}
      navigate={next => { setBPreview(null); setStep(next); }}
      update={next => { setBDraft(next); setDirty(true); setBPreview(null); }}
      show={setBPreview} /> : <>
      <nav className="retirement-steps" aria-label="Altersvorsorge-Schritte">
        <button onClick={() => { setPreview(null); setBPreview(null); setStep("choice"); }}>A/B-Auswahl</button>
        <button aria-current={step === "a1" ? "step" : undefined} onClick={() => setStep("a1")}>A1 Fördercheck</button>
        <button aria-current={step === "a2" ? "step" : undefined} onClick={() => setStep("a2")}>A2 Sparen & Förderung</button>
      </nav>
      {step === "a1" ? <section className="panel retirement-form" aria-label="Bestätigungen für das Beitragsjahr">
        <p>Die rechtliche Prüfung erfolgt vorgelagert für diese Person und das gewählte Jahr. Diese Oberfläche ermittelt keine Anspruchsberechtigung.</p>
        <label htmlFor={fieldId("year")}>Beitragsjahr</label>
        <select {...propsFor("year")} value={draft.year} onChange={e => update(changeYear(draft, Number(e.target.value)))}>
          <option value={2027}>2027 – estg-2027-v1</option><option value={2028}>2028 – estg-2028-v1</option>
        </select>
        <p>Bei Jahreswechsel alle jahresbezogenen Bestätigungen und Kinderzuordnungen erneut prüfen.</p>
        <label htmlFor={fieldId("entitlement")}>Unmittelbare Berechtigung</label>
        <select {...propsFor("entitlement")} value={draft.entitlement} onChange={e => field("entitlement", e.target.value as GrantDraft["entitlement"])}>
          <option value="unconfirmed">Unklar / noch nicht bestätigt</option>
          <option value="direct_confirmed">Unmittelbare Berechtigung für Person und Jahr bestätigt</option>
          <option value="indirect">Mittelbare Berechtigung</option><option value="ineligible">Nicht berechtigt</option>
        </select>
        <Help>Eine Berufsbezeichnung, das Geburtsjahr oder der Familienstand beweist keine Berechtigung. Mittelbare und andere Sonderfälle sind hier derzeit nicht unterstützt.</Help>
        <label htmlFor={fieldId("regime")}>Förderregime</label>
        <select {...propsFor("regime")} value={draft.regime} onChange={e => field("regime", e.target.value as GrantDraft["regime"])}>
          <option value="unconfirmed">Unklar / noch nicht bestätigt</option><option value="new_confirmed">Neues Förderregime einschließlich etwaigem wirksamem Wechsel bestätigt</option><option value="old">Altes Riester-Regime</option>
        </select>
        <label htmlFor={fieldId("contract")}>Förderfähiger Vertrag</label>
        <select {...propsFor("contract")} value={draft.contract} onChange={e => field("contract", e.target.value as GrantDraft["contract"])}>
          <option value="unconfirmed">Unklar / noch nicht bestätigt</option><option value="single_eligible_confirmed">Genau ein zulässiger förderfähiger Vertrag bestätigt</option><option value="multiple">Mehrere Verträge</option><option value="transition_unconfirmed">Übergangszuordnung ungeklärt</option>
        </select>
        <label htmlFor={fieldId("childrenStatus")}>Kinderzuordnung im Beitragsjahr</label>
        <select {...propsFor("childrenStatus")} value={draft.childrenStatus} onChange={e => {
          const status = e.target.value as GrantDraft["childrenStatus"];
          update({ ...draft, childrenStatus: status, children: status === "assigned_confirmed"
            ? draft.children.length ? draft.children : [{ id: crypto.randomUUID(), status: "assignment_unconfirmed" }] : [] });
        }}>
          <option value="unconfirmed">Unklar / noch nicht bestätigt</option><option value="none_confirmed">Keine förderfähigen Kinder für dieses Jahr bestätigt</option><option value="assigned_confirmed">Ein oder mehrere Kinder – Zuordnung einzeln bestätigen</option><option value="conflicting">Widersprüchliche Zuordnung – fachlich klären</option>
        </select>
        <Help>Förderfähigkeit, Kindergeldbezug und Zuordnung zu dieser Person müssen nach dem Recht des gewählten Jahres bestätigt sein. 2027/2028 unterscheiden sich. Keine automatische Zuordnung; keine Namen oder Geburtsdaten eingeben.</Help>
        {draft.childrenStatus === "assigned_confirmed" && <fieldset {...propsFor("children")} tabIndex={-1}>
          <legend>Kinder einzeln bestätigen</legend>
          {draft.children.map((child, index) => <div className="retirement-child" key={child.id}>
            <label htmlFor={`${fieldId("children")}-${child.id}`}>Kind {index + 1}: Förderfähigkeit und Zuordnung {draft.year}</label>
            <select id={`${fieldId("children")}-${child.id}`} value={child.status} onChange={e => field("children", draft.children.map(c => c.id === child.id ? { ...c, status: e.target.value as typeof c.status } : c))}>
              <option value="assignment_unconfirmed">Zuordnung noch nicht bestätigt</option><option value="eligibility_unconfirmed">Förderfähigkeit ungeklärt</option><option value="eligible_assigned_confirmed">Förderfähigkeit und Zuordnung zu dieser Person bestätigt</option><option value="conflicting_assignment">Zuordnung widersprüchlich</option>
            </select>
            <button onClick={() => field("children", draft.children.filter(c => c.id !== child.id))}>Kind {index + 1} entfernen</button>
          </div>)}
          <button onClick={() => field("children", [...draft.children, { id: crypto.randomUUID(), status: "assignment_unconfirmed" }])}>Kind hinzufügen</button>
        </fieldset>}
        <button className="primary" onClick={() => { setPreview(null); setStep("a2"); }}>Weiter zu A2</button>
      </section> : <section className="panel retirement-form" aria-label="Beitragseingabe">
        <p>Beitragsjahr {draft.year} · {rules?.id ?? "kein geprüfter Regelstand"}</p>
        <label htmlFor={fieldId("mode")}>Beitragsmodus</label>
        <select {...propsFor("mode")} value={draft.mode} onChange={e => update(changeMode(draft, e.target.value as GrantDraft["mode"]))}>
          <option value="annual">Jahresbeitrag</option><option value="monthly">Monatsbeitrag</option>
        </select>
        <p>Moduswechsel leert die Beitragsfelder: Bitte neu eingeben und bestätigen. Es erfolgt keine gerundete Umrechnung.</p>
        {draft.mode === "annual" ? <><label htmlFor={fieldId("annual")}>Förderfähiger Jahres-Eigenbeitrag in Euro</label>
          <input {...propsFor("annual")} inputMode="decimal" value={draft.annual} onChange={e => contributionField("annual", e.target.value)} placeholder="z. B. 360,00" /></> : <>
          <label htmlFor={fieldId("monthly")}>Monatlicher Eigenbeitrag in Euro</label>
          <input {...propsFor("monthly")} inputMode="decimal" value={draft.monthly} onChange={e => contributionField("monthly", e.target.value)} />
          <div className="retirement-examples" aria-label="Beispiele für Monatsbeiträge">{[10, 25, 30, 50, 100, 150].map(amount => <button key={amount} onClick={() => contributionField("monthly", String(amount))}>{amount} € / Monat</button>)}</div>
          <label htmlFor={fieldId("startMonth")}>Tatsächlicher / geplanter Startmonat {draft.year}</label>
          <select {...propsFor("startMonth")} value={draft.startMonth} onChange={e => update({ ...draft, startMonth: e.target.value, months: "", contributionConfirmed: false })}>
            <option value="">Bitte wählen</option>{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </select>
          <label htmlFor={fieldId("months")}>Beitragswirksame Monatsanzahl</label>
          <select {...propsFor("months")} value={draft.months} onChange={e => contributionField("months", e.target.value)}>
            <option value="">Bitte wählen</option>{Array.from({ length: draft.startMonth ? 13 - Number(draft.startMonth) : 0 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
          <label className="retirement-checkbox"><input type="checkbox" checked={draft.hasOneOff} onChange={e => contributionField("hasOneOff", e.target.checked)} />Zusätzlicher einmaliger förderfähiger Eigenbeitrag</label>
          {draft.hasOneOff && <><label htmlFor={fieldId("oneOff")}>Einmaliger Eigenbeitrag in Euro</label><input {...propsFor("oneOff")} inputMode="decimal" value={draft.oneOff} onChange={e => contributionField("oneOff", e.target.value)} /></>}
        </>}
        <Help>Nur eigene förderfähige Beiträge im gewählten Kalenderjahr. Keine Zulagen, Erträge oder Überträge. Oktober bedeutet höchstens drei Monatsraten; Pausen durch die tatsächliche Anzahl berücksichtigen.</Help>
        <div className="retirement-annual" aria-live="polite">{contribution.status === "valid"
          ? <><strong>Jahres-Eigenbeitrag: {euro(contribution.cents)}</strong>{draft.mode === "monthly" && <p>{euro(contribution.terms[0])} × {contribution.terms[1]} Monatsraten + {euro(contribution.terms[2])} einmaliger Eigenbeitrag</p>}</>
          : <p>{contribution.message}</p>}</div>
        <label htmlFor={fieldId("quality")}>Beitragsstand</label>
        <select {...propsFor("quality")} value={draft.quality} onChange={e => contributionField("quality", e.target.value as GrantDraft["quality"])}>
          <option value="unconfirmed">Bitte ausdrücklich wählen</option><option value="planned">Geplante förderfähige Eigenbeiträge</option><option value="actual">Tatsächlich gezahlte förderfähige Eigenbeiträge</option>
        </select>
        <label className="retirement-checkbox"><input {...propsFor("contributionConfirmed")} type="checkbox" checked={draft.contributionConfirmed} onChange={e => field("contributionConfirmed", e.target.checked)} />Den angezeigten Jahres-Eigenbeitrag als förderfähig für Person, Vertrag und Beitragsjahr bestätigt; keine Zulagen, Erträge oder Überträge enthalten.</label>
        <p>Fördermarkierungen im Jahresbeitrag: <strong>120 / 300 / 360 / 1.800 €</strong>. Unter 120 € keine Grund-/Kinderzulagen; oberhalb 1.800 € keine zusätzliche Grundzulage im geprüften Kern.
          Über 6.840 € jährlich: gesonderte rechtliche und Anbieterprüfung, keine bestätigte Standardvorschau.</p>
        <button className="primary" onClick={calculate}>Fördervorschau prüfen</button>
      </section>}
      <div className="retirement-result" ref={resultArea} tabIndex={-1} aria-live="polite" aria-atomic="true">
        {preview?.status === "calculated" ? <section className="panel" data-testid="grant-result">
          <h2>Regelbasiert berechnet – {preview.result.contributionYear}</h2>
          <p>{draft.quality === "planned" ? "Geplante" : "Tatsächlich gezahlte"} Eigenbeiträge; keine Buchungs- oder Förderzusage.</p>
          <dl>
            <dt>Jahres-Eigenbeitrag</dt><dd>{euro(preview.annualCents)}</dd>
            <dt>Grundzulage</dt><dd data-testid="base-grant">{euro(preview.result.baseGrantCents)}</dd>
            {preview.result.childGrants.map((child, i) => <div key={child.childId}><dt>Kinderzulage Kind {i + 1}</dt><dd data-testid="child-grant">{euro(child.grantCents)}</dd></div>)}
            <dt>Summe Kinderzulagen</dt><dd>{euro(preview.result.childrenGrantCents)}</dd>
            <dt>Summe Grund- und Kinderzulagen ohne Einmalbonus</dt><dd data-testid="total-grant">{euro(preview.result.totalGrantCents)}</dd>
            <dt>Eigenbeitrag + berechnete Grund-/Kinderzulagen</dt><dd data-testid="total-inflow">{euro(preview.annualCents + preview.result.totalGrantCents)}</dd>
          </dl>
        </section> : <p role={preview ? "alert" : "status"} id={errorId} data-testid="grant-status">{preview
          ? `${preview.status === "review_required" ? "Fachlich prüfen" : preview.status === "unsupported" ? "Derzeit nicht unterstützt" : "Eingabe korrigieren"}: ${preview.message}`
          : changed ? "Angaben geändert – Fördervorschau neu prüfen. Keine aktuellen Förderbeträge." : "Bestätigungen und Beitrag erforderlich. Förderberechtigung fachlich prüfen; noch keine Fördervorschau."}</p>}
      </div>
    </>}
    {step !== "b1" && step !== "b2" && <details className="retirement-help"><summary>Regelstand, Quellen und Modellgrenzen</summary>
      <p>{modelNotice}</p><p>{bonusNotice}</p>
      {rules && <><p>Beitragsjahr: {rules.contributionYear} · Regel-ID: {rules.id} · Geprüft am: {rules.checkedOn} · Rechenversion: {rules.calculationVersion}</p>
        <ul>{rules.sources.map(source => <li key={source}><a href={source} target="_blank" rel="noreferrer">{source}</a></li>)}</ul></>}
      <p>Keine Bonusberechnung, Steuerberechnung, Kapitalprojektion, Produktberatung oder Alt-Riester-Berechnung. Offene Centbruchteile bleiben Prüfzustand und werden nicht als auszahlbare Förderung angezeigt.</p>
    </details>}
    <button className="secondary" onClick={restart}>Spezialentwurf neu starten</button>
  </div>;
});

const childChoices = [["unconfirmed", "Unklar / noch nicht bestätigt"], ["none_confirmed", "Vollständig geprüft: keine einzubeziehenden Kinder"],
  ["list_confirmed", "Vollständige Liste – jedes Kind einzeln bestätigen"], ["conflicting", "Widersprüchlich – fachlich klären"]] as const;
const assignments = [["assignment_unconfirmed", "Zuordnung noch nicht bestätigt"], ["eligibility_unconfirmed", "Förderfähigkeit ungeklärt"],
  ["eligible_assigned_confirmed", "Förderfähigkeit und Personenzuordnung für Jahr und Regime bestätigt"], ["conflicting_assignment", "Zuordnung widersprüchlich"]] as const;
const statusText = (p: OldPreview | NewPreview) => p.status === "calculated" ? "Berechnet" :
  `${p.status === "review_required" ? "Fachlich prüfen" : p.status === "unsupported" ? "Derzeit nicht unterstützt (keine Aussage über gesetzlichen Anspruch)" : "Eingabe korrigieren"}: ${p.message}`;
function GrantAmounts({ preview, name }: { preview: OldPreview | NewPreview; name: "old" | "new" }) {
  if (preview.status !== "calculated") return <p role="alert" data-testid={`${name}-status`}>{statusText(preview)}</p>;
  return <section data-testid={`${name}-result`}>
    <p>Modellierte Jahreszulagen {preview.result.contributionYear}, ohne Einmalbonus. Keine tatsächlich gebuchte Zulage.</p>
    <dl>
      <dt>Eigener Jahresbeitrag</dt><dd data-testid={`${name}-own`}>{euro(preview.annualCents)}</dd>
      {"minimumOwnContributionCents" in preview.result && <>
        <dt>Modellierter erforderlicher Jahres-Mindesteigenbeitrag</dt><dd data-testid="old-minimum">{euro(preview.result.minimumOwnContributionCents)}</dd>
        <dt>Deckungsstatus</dt><dd data-testid="old-fulfillment">{preview.result.fulfillment.status} · {preview.result.fulfillment.status === "full" ? "voll" : preview.result.fulfillment.status === "reduced" ? "gekürzt" : "null"}</dd>
      </>}
      <dt>Grundzulage</dt><dd data-testid={`${name}-base`}>{euro(preview.result.baseGrantCents)}</dd>
      {preview.result.childGrants.map((c, i) => <div key={c.childId}><dt>Kinderzulage Kind {i + 1}</dt><dd data-testid={`${name}-child`}>{euro(c.grantCents)}</dd></div>)}
      <dt>Summe Kinderzulagen</dt><dd data-testid={`${name}-children`}>{euro(preview.result.childrenGrantCents)}</dd>
      <dt>Summe modellierte Grund- und Kinderzulagen ohne Bonus</dt><dd data-testid={`${name}-total`}>{euro(preview.result.totalGrantCents)}</dd>
    </dl>
  </section>;
}

function OldRiesterView({ draft: d, step, preview, update, navigate, show }: {
  draft: OldDraft; step: "b1" | "b2"; preview: Comparison | null;
  update: (next: OldDraft) => void; navigate: (next: "choice" | "b1" | "b2") => void; show: (next: Comparison) => void;
}) {
  const prefix = useId(), result = useRef<HTMLDivElement>(null);
  const id = (key: string) => `${prefix}-${key}`;
  const errorField = preview?.old.status !== "calculated" ? preview?.old.field : undefined;
  const change = <K extends OldField>(key: K, value: OldDraft[K]) => update({ ...d, [key]: value,
    ...(key !== "evidenceQuality" ? { evidenceQuality: "unconfirmed" as const } : {}), comparisonConfirmed: false });
  const changeContribution = <K extends OldField>(key: K, value: OldDraft[K]) => update({ ...d, [key]: value,
    contributionConfirmed: false, evidenceQuality: "unconfirmed", comparisonConfirmed: false,
    newScenario: { ...d.newScenario, contributionConfirmed: false } });
  const newChange = <K extends keyof NewScenario>(key: K, value: NewScenario[K]) => update({ ...d,
    newScenario: { ...d.newScenario, [key]: value, ...(key !== "scenarioConfirmed" ? { scenarioConfirmed: false } : {}) }, comparisonConfirmed: false });
  const select = (key: OldField, label: string, choices: readonly (readonly [string, string])[]) => <>
    <label htmlFor={id(key)}>{label}</label><select id={id(key)} value={String(d[key])}
      aria-invalid={errorField === key} aria-describedby={errorField === key ? id("error") : undefined}
      onChange={e => change(key, e.target.value as never)}>{choices.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
  </>;
  const newSelect = (key: "entitlement" | "regime" | "contract" | "childrenStatus", label: string, choices: readonly (readonly [string, string])[]) => <>
    <label htmlFor={id(`new-${key}`)}>{label}</label><select id={id(`new-${key}`)} value={d.newScenario[key]}
      onChange={e => {
        if (key === "childrenStatus") {
          const value = e.target.value as NewScenario["childrenStatus"];
          update({ ...d, comparisonConfirmed: false, newScenario: { ...d.newScenario, childrenStatus: value, scenarioConfirmed: false,
            children: value === "none_confirmed" ? [] : d.newScenario.children } });
        } else newChange(key, e.target.value as never);
      }}>{choices.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
  </>;
  const amount = oldContribution(d), rules = oldRiesterRuleContext(oldRuleId(d.year));
  const newRules = d.year === 2027 || d.year === 2028 ? directGrantRuleContext(d.year === 2027 ? "estg-2027-v1" : "estg-2028-v1") : null;
  const calculateB = () => {
    const next: Comparison = step === "b2" ? previewComparison(d) : { old: previewOldGrant(d), newer: { status: "review_required", message: "Neues Szenario separat prüfen." } };
    show(next);
    requestAnimationFrame(() => {
      if (next.old.status !== "calculated" && next.old.field && step === "b1") document.getElementById(id(next.old.field))?.focus();
      else result.current?.focus();
    });
  };
  return <>
    <nav className="retirement-steps" aria-label="Altersvorsorge-Schritte">
      <button onClick={() => navigate("choice")}>A/B-Auswahl</button>
      <button aria-current={step === "b1" ? "step" : undefined} onClick={() => navigate("b1")}>B1 Bestandsaufnahme</button>
      <button aria-current={step === "b2" ? "step" : undefined} onClick={() => navigate("b2")}>B2 Fördervergleich</button>
    </nav>
    <p>Eine bestimmte Person · Beitragsjahr {d.year} · Alt-Regel: {oldRuleId(d.year) || "ungeprüft"}.</p>
    {step === "b1" ? <section className="panel retirement-form" aria-label="Alt-Riester-Nachweise">
      <p>Nachweise für diese Person, dieses Jahr und diesen Alt-Regelstand vorgelagert prüfen. Keine Namen, Belege oder Vertragsnummern eingeben.</p>
      <label htmlFor={id("year")}>Alt-Beitragsjahr</label><select id={id("year")} value={d.year} onChange={e => update(changeOldYear(d, Number(e.target.value)))}>
        {[2026, 2027, 2028].map(year => <option key={year} value={year}>{year} – {oldRuleId(year)}</option>)}
      </select>
      <p>Jahreswechsel entzieht alle zeitbezogenen Bestätigungen, auch Kinder-, Partner-, Bonus- und Beitragsstatus.</p>
      {select("entitlement", "Alt-unmittelbare Berechtigung", [["unconfirmed", "Unklar / unbestätigt"], ["direct_old_confirmed", "Unmittelbare Altberechtigung für Person und Jahr nachgewiesen"], ["conflicting", "Widersprüchlich"], ["timeline_unconfirmed", "Unterjähriger Berechtigungsverlauf offen"], ["indirect", "Mittelbar berechtigt"], ["ineligible", "Nicht berechtigt"]])}
      <Help>Beruf, Alter, Einkommen und ein bestehender Vertrag beweisen die Berechtigung nicht. Mittelbare Berechtigung und ungeklärte Statuswechsel benötigen eine eigene Fachprüfung.</Help>
      {select("regime", "Alt-Regime und Bestandsschutz", [["unconfirmed", "Unklar / unbestätigt"],
        [d.year === 2026 ? "old_2026_confirmed" : "old_protected_confirmed", d.year === 2026 ? "Alt-Regelkontext 2026 bestätigt" : "Altbestand bestätigt: kein wirksamer Förderwechsel / auslösender Neuvertrag"],
        ["conflicting", "Bestand / Übergang widersprüchlich"], ["new_confirmed", "Tatsächlich neues Förderregime bestätigt"]])}
      {select("contract", "Alt-Vertragskontext", [["unconfirmed", "Unklar / unbestätigt"], ["single_private_eligible_confirmed", "Genau ein eigener förderfähiger privater Ansparvertrag; sämtliche weiteren aktiven/ruhenden/übertragenen/beendeten Verträge mitgeprüft"],
        ["transition_unconfirmed", "Vertragsübergang ungeklärt"], ["conflicting", "Verträge widersprüchlich"], ["multiple", "Mehrere relevante Verträge, auch ruhend"], ["multiple_and_new_regime", "Mehrverträge mit neuem Regime"], ["housing", "Wohn-Riester"], ["occupational", "Betriebliche Altersversorgung"], ["ineligible", "Nicht förderfähiger Vertrag"]])}
      <label htmlFor={id("income")}>Maßgeblicher RV-Vorjahresbetrag in Euro</label>
      <input id={id("income")} inputMode="decimal" value={d.income} onChange={e => change("income", e.target.value)} aria-invalid={errorField === "income"} aria-describedby={errorField === "income" ? id("error") : undefined} />
      <label htmlFor={id("incomeYear")}>Nachgewiesenes RV-Bemessungsjahr (t−1)</label>
      <select id={id("incomeYear")} value={d.incomeYear} onChange={e => change("incomeYear", e.target.value)}><option value="">Ausdrücklich auswählen</option>{[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}</select>
      {select("incomeBasis", "Qualität der RV-Bemessung", [["unconfirmed", "Unklar / unbestätigt"], ["simple_domestic_prior_rv_confirmed", `Einfache inländische RV-Basis ${d.year - 1} einschließlich Betrag ausdrücklich nachgewiesen`], ["conflicting", "Aktuelles Brutto / widersprüchliche Jahresgrundlage"], ["special", "Sonderbemessung / gemischte Bemessungsarten"]])}
      <Help>Nur die maßgeblichen inländischen RV-Einnahmen des Vorjahres. Aktuelles Brutto ist kein Ersatz. Ein nachgewiesener Betrag 0,00 € ist möglich; leer bleibt unbekannt.</Help>
      {select("partner", "Alt-Partnerstatus", [["unconfirmed", "Unklar / unbestätigt"], ["none_relevant_confirmed", "Kein relevanter mittelbarer Partner bestätigt"], ["direct_independent_confirmed", "Partner eigenständig unmittelbar berechtigt; Kinderzuordnung geklärt"], ["conflicting", "Partnerstatus widersprüchlich"], ["indirect_included", "Mittelbar abhängige Partnerkonstellation"], ["indirect_new_direct_old", "Mittelbar neu / unmittelbar Altbestand"]])}
      {select("bonus", "Alt-Berufseinsteigerbonus", [["unconfirmed", "Erstanspruch / Bonushistorie unklar"], ["age_excluded_confirmed", "Bonus am maßgeblichen Jahresbeginn altersbedingt ausgeschlossen und nachgewiesen"], ["history_no_current_confirmed", "Erstanspruch / Verbrauchshistorie belegt; in diesem Jahr kein Bonus"], ["conflicting", "Bonushistorie widersprüchlich"], ["current_year_confirmed", "Erstmaliger Bonus in diesem Jahr bestätigt"]])}
      <Help>Ein offener oder aktueller Altbonus sperrt auch die gewöhnliche Zulage: Er beeinflusst den Mindesteigenbeitrag. Keine automatische Freigabe aus einem Geburtsdatum.</Help>
      <label htmlFor={id("childrenStatus")}>Vollständige Alt-Kinderliste</label>
      <select id={id("childrenStatus")} value={d.childrenStatus} onChange={e => {
        const value = e.target.value as OldDraft["childrenStatus"];
        update({ ...d, childrenStatus: value, children: value === "none_confirmed" ? [] : d.children, evidenceQuality: "unconfirmed", comparisonConfirmed: false });
      }}>{childChoices.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select>
      <Help>Altbestand: erster maßgeblicher Kindergeld-Anspruchszeitraum. 2028 Elternzuordnung separat nach den neuen geschlechtsneutralen Regeln prüfen. Keine feste Altersgrenze von 18 Jahren, keine Übernahme aus A oder dem neuen Szenario.</Help>
      {d.childrenStatus === "list_confirmed" && <fieldset id={id("children")} tabIndex={-1}><legend>Alt-Kinder für {d.year} / {oldRuleId(d.year)}</legend>
        {d.children.map((c, i) => <div key={c.id} className="retirement-child">
          <label htmlFor={id(`birth-${c.id}`)}>Alt-Kind {i + 1}: Geburtsjahr</label><input id={id(`birth-${c.id}`)} inputMode="numeric" value={c.birthYear} onChange={e => change("children", d.children.map(x => x.id === c.id ? { ...x, birthYear: e.target.value, assignment: "assignment_unconfirmed" } : x))} />
          <label htmlFor={id(`child-${c.id}`)}>Alt-Kind {i + 1}: Förderfähigkeit und Zuordnung {d.year}</label><select id={id(`child-${c.id}`)} value={c.assignment} onChange={e => change("children", d.children.map(x => x.id === c.id ? { ...x, assignment: e.target.value as typeof x.assignment } : x))}>{assignments.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select>
          <button onClick={() => change("children", d.children.filter(x => x.id !== c.id))}>Alt-Kind {i + 1} entfernen</button>
        </div>)}
        <button onClick={() => change("children", [...d.children, { id: crypto.randomUUID(), birthYear: "", contributionYear: d.year, ruleContext: oldRuleId(d.year), assignment: "assignment_unconfirmed" }])}>Alt-Kind hinzufügen</button>
      </fieldset>}
      {select("correction", "Alt-Korrekturstatus", [["unconfirmed", "Unklar / unbestätigt"], ["none_confirmed", "Kein offener Korrektur- oder Rückforderungsfall bestätigt"], ["conflicting", "Korrektursachverhalt widersprüchlich"], ["retrospective", "Rückwirkende Korrektur / Rückforderung"]])}
      <p>Vertrags-/Übertragungswerte, Garantien, Kosten und gebuchte Zulagen sind spätere separat zu prüfende Schritte und werden hier nicht benötigt.</p>
    </section> : <section className="panel retirement-form" aria-label="Neues hypothetisches Vergleichsszenario">
      <p className="retirement-notice"><strong>Zwei alternative Fördermodelle; keine Wechselprüfung oder Empfehlung.</strong> Der reale Altstatus bleibt erhalten. Das neue Modell gilt nur unter separat fachlich geprüften hypothetischen Voraussetzungen; ein tatsächlicher Wechsel wird weder bestätigt noch ausgelöst.</p>
      <p>Alt-Nachweise und eigene Kinderzuordnung in B1 prüfen. Gleiche Person und gleiches Beitragsjahr {d.year}; die Regeln sind alternativ, kein paralleler Anspruch.</p>
      {d.year === 2026 ? <p>Für 2026 nicht unterstützt: kein neues Fördermodell und keine Vergleichsdifferenz.</p> : <>
        {newSelect("entitlement", "Neu-Szenario: unmittelbare Berechtigung", [["unconfirmed", "Unklar / unbestätigt"], ["direct_confirmed", "Neue unmittelbare Berechtigung für dieselbe Person im Szenario fachlich bestätigt"], ["indirect", "Mittelbare Berechtigung"], ["ineligible", "Nicht berechtigt"]])}
        {newSelect("regime", "Neu-Szenario: Förderregime", [["unconfirmed", "Unklar / unbestätigt"], ["new_confirmed", `Neues Regime ${d.year} für diese alternative Szenariokonstellation fachlich bestätigt`], ["old", "Im Szenario weiter altes Regime"]])}
        {newSelect("contract", "Neu-Szenario: Vertragskontext", [["unconfirmed", "Unklar / unbestätigt"], ["single_eligible_confirmed", "Genau ein eigener förderfähiger Vertrag im neuen Szenario fachlich bestätigt"], ["transition_unconfirmed", "Übergangszuordnung ungeklärt"], ["multiple", "Mehrere relevante Verträge"]])}
        <label className="retirement-checkbox"><input type="checkbox" checked={d.newScenario.transitionConfirmed} onChange={e => newChange("transitionConfirmed", e.target.checked)} />Vertrags- und Übergangsannahme einschließlich des im Szenario wirksamen Regimeübergangs eigenständig fachlich geprüft; keine Aussage über die tatsächliche Wechselmöglichkeit des Altvertrags.</label>
        {newSelect("childrenStatus", "Neu-Szenario: vollständige Kinderzuordnung", childChoices)}
        <Help>Je Kind eigene Prüfung nach dem neuen Recht: 2028 letzter maßgeblicher Kindergeld-Anspruchszeitraum und geschlechtsneutrale Elternzuordnung. Altzuordnung wird niemals kopiert. Alle Voraussetzungen gelten nur für dieses alternative Szenario.</Help>
        {d.newScenario.childrenStatus === "list_confirmed" && <fieldset><legend>Neue Kinderzuordnung {d.year}</legend>
          {d.newScenario.children.map((c, i) => <div key={c.id} className="retirement-child"><label htmlFor={id(`new-child-${c.id}`)}>Neu-Kind {i + 1}: Förderfähigkeit und Zuordnung {d.year}</label>
            <select id={id(`new-child-${c.id}`)} value={c.status} onChange={e => newChange("children", d.newScenario.children.map(x => x.id === c.id ? { ...x, status: e.target.value as typeof x.status } : x))}>{assignments.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select>
            <button onClick={() => newChange("children", d.newScenario.children.filter(x => x.id !== c.id))}>Neu-Kind {i + 1} entfernen</button></div>)}
          <button onClick={() => newChange("children", [...d.newScenario.children, { id: crypto.randomUUID(), contributionYear: d.year, status: "assignment_unconfirmed" }])}>Neu-Kind hinzufügen</button>
        </fieldset>}
        <label className="retirement-checkbox"><input type="checkbox" checked={d.newScenario.contributionConfirmed} onChange={e => newChange("contributionConfirmed", e.target.checked)} />Derselbe angezeigte Jahres-Eigenbeitrag ist für Person, Jahr und Vertrag im neuen Szenario eigenständig als förderfähig bestätigt.</label>
        <label className="retirement-checkbox"><input type="checkbox" checked={d.newScenario.scenarioConfirmed} onChange={e => newChange("scenarioConfirmed", e.target.checked)} />Alle Voraussetzungen der hypothetischen neuen Standardkonstellation wurden vorgelagert fachlich geprüft. Eine bloße Wunschannahme oder Alt-Bestätigung reicht nicht.</label>
      </>}
    </section>}
    <section className="panel retirement-form" aria-label="Gemeinsamer Jahres-Eigenbeitrag">
      <h2>{step === "b2" ? "Gleicher eigener Jahresbeitrag in beiden Modellen" : "Förderfähiger Jahres-Eigenbeitrag"}</h2>
      <label htmlFor={id("mode")}>B-Beitragsmodus</label><select id={id("mode")} value={d.mode} onChange={e => update(changeOldMode(d, e.target.value as OldDraft["mode"]))}><option value="annual">Jahresbeitrag</option><option value="monthly">Monatsbeitrag</option></select>
      <p>Moduswechsel leert die Beitragsfelder. Bitte neu eingeben und bestätigen.</p>
      {d.mode === "annual" ? <><label htmlFor={id("annual")}>B-Jahres-Eigenbeitrag in Euro</label><input id={id("annual")} inputMode="decimal" value={d.annual} aria-invalid={errorField === "annual"} aria-describedby={errorField === "annual" ? id("error") : undefined} onChange={e => changeContribution("annual", e.target.value)} /></> : <>
        <label htmlFor={id("monthly")}>B-Monatlicher Eigenbeitrag in Euro</label><input id={id("monthly")} inputMode="decimal" value={d.monthly} onChange={e => changeContribution("monthly", e.target.value)} />
        <label htmlFor={id("startMonth")}>B-Startmonat {d.year}</label><select id={id("startMonth")} value={d.startMonth} onChange={e => update({ ...d, startMonth: e.target.value, months: "", contributionConfirmed: false, evidenceQuality: "unconfirmed", comparisonConfirmed: false, newScenario: { ...d.newScenario, contributionConfirmed: false } })}><option value="">Bitte wählen</option>{monthNames.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        <label htmlFor={id("months")}>B-Beitragswirksame Monatsanzahl</label><select id={id("months")} value={d.months} onChange={e => changeContribution("months", e.target.value)}><option value="">Bitte wählen</option>{Array.from({ length: d.startMonth ? 13 - Number(d.startMonth) : 0 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
        <label className="retirement-checkbox"><input type="checkbox" checked={d.hasOneOff} onChange={e => changeContribution("hasOneOff", e.target.checked)} />B: Zusätzlicher einmaliger Eigenbeitrag</label>
        {d.hasOneOff && <><label htmlFor={id("oneOff")}>B-Einmaliger Eigenbeitrag in Euro</label><input id={id("oneOff")} inputMode="decimal" value={d.oneOff} onChange={e => changeContribution("oneOff", e.target.value)} /></>}
      </>}
      <div className="retirement-annual" aria-live="polite">{amount.status === "valid" ? <><strong>Jahres-Eigenbeitrag: {euro(amount.cents)}</strong>{d.mode === "monthly" && <p>{euro(amount.terms[0])} × {amount.terms[1]} Monatsraten + {euro(amount.terms[2])} einmalig</p>}</> : amount.message}</div>
      <label htmlFor={id("quality")}>B-Beitragsstand</label><select id={id("quality")} value={d.quality} onChange={e => changeContribution("quality", e.target.value as OldDraft["quality"])}><option value="unconfirmed">Bitte ausdrücklich wählen</option><option value="planned">Geplante förderfähige Eigenbeiträge</option><option value="actual">Tatsächlich gezahlte förderfähige Eigenbeiträge</option><option value="conflicting">Widersprüchlich</option><option value="ineligible">Nicht förderfähig</option></select>
      <label className="retirement-checkbox"><input id={id("contributionConfirmed")} type="checkbox" checked={d.contributionConfirmed} onChange={e => change("contributionConfirmed", e.target.checked)} />B: Jahres-Eigenbeitrag für Person, Altvertrag und Beitragsjahr ausdrücklich bestätigt; nur eigene Zahlungen, keine Zulagen, Erträge oder Überträge.</label>
      <Help>Tatsächlich gezahlt und geplant sind alternative Beitragsqualitäten; sie werden nicht addiert. Oktober erlaubt höchstens drei ausdrücklich gewählte Monatsraten. Ein positiver Beitrag unter 60 € kann im unmittelbaren Altstandard eine Teilzulage ergeben.</Help>
      {select("evidenceQuality", "Alt-Gesamtbestätigung der Nachweise", [["unconfirmed", "Noch nicht vollständig bestätigt"], ["confirmed", "Alle Pflichtbelege liegen vor; keine offenen / widersprüchlichen Nachweise oder Korrektur-/Rückforderungsfälle"], ["conflicting", "Nachweise widersprüchlich / noch offen"]])}
      {step === "b2" && <><label className="retirement-checkbox"><input type="checkbox" checked={d.comparisonConfirmed} onChange={e => update({ ...d, comparisonConfirmed: e.target.checked })} />Vergleichsbasis bestätigt: dieselbe Person, dasselbe Jahr und derselbe eigene Jahresbeitrag in beiden getrennten Fördermodellen; unterschiedliche Rechtsannahmen, kein gemeinsamer Anspruch.</label><p>Über 6.840 € ist ausschließlich das neue Modell gesperrt. Keine stille Kappung. Alle Beträge und die Differenz bleiben ohne Einmalbonus.</p></>}
      <button className="primary" onClick={calculateB}>{step === "b1" ? "Alt-Fördervorschau prüfen" : "Getrennte Fördermodelle prüfen"}</button>
    </section>
    <div className="retirement-result" ref={result} tabIndex={-1} aria-live="polite" aria-atomic="true" id={id("error")}>
      {preview ? <>
        <div className={step === "b2" ? "retirement-comparison" : ""}>
          <section className="panel"><h2>Altes Riester-System bei bestätigtem Altbestand</h2><p>{d.quality === "planned" ? "Geplante" : d.quality === "actual" ? "Tatsächlich gezahlte" : "Unbestätigte"} Eigenbeiträge.</p><GrantAmounts preview={preview.old} name="old" /></section>
          {step === "b2" && <section className="panel"><h2>Neues System unter getrennten hypothetischen Voraussetzungen</h2><GrantAmounts preview={preview.newer} name="new" /></section>}
        </div>
        {step === "b2" && (preview.deltaCents !== undefined ? <section className="panel"><h2>Differenz der modellierten Jahreszulagen unter unterschiedlichen Annahmen</h2><p>Neu − Alt, ohne Einmalbonus</p><strong data-testid="comparison-delta">{preview.deltaCents < 0 ? "−" : preview.deltaCents > 0 ? "+" : ""}{euro(Math.abs(preview.deltaCents))}</strong></section>
          : <p role="status" data-testid="comparison-incomplete">Vergleich unvollständig: zwei berechnete Seiten und ausdrücklich bestätigte Vergleichsbasis erforderlich. Keine numerische Differenz.</p>)}
      </> : <p role="status" data-testid="old-empty">Bestätigungen und aktueller Beitrag erforderlich. Keine aktuellen Förderbeträge; Vorschau bewusst neu prüfen.</p>}
    </div>
    <details className="retirement-help"><summary>Regelstand, Quellen und Modellgrenzen</summary>
      <p>Jahresbezogene Modellrechnung; keine individuelle Förderzusage. Ohne Bonus, Steuern, Kosten, Rendite, Vertragswerte oder Wechselentscheidung.</p>
      {[rules, ...(step === "b2" ? [newRules] : [])].map((r, i) => r && <section key={r.id}><p>{i === 0 ? "Alt" : "Neu"}: {r.id} · Beitragsjahr {r.contributionYear} · Geprüft am {r.checkedOn} · {r.calculationVersion}</p><ul>{r.sources.map(s => <li key={s}><a href={s} target="_blank" rel="noreferrer">{s}</a></li>)}</ul></section>)}
      <p>Halbcent und divergierende Faktor-/Prozentlesarten bleiben Fachprüfstatus ohne Förderzahl. Partnerabhängigkeit, Mehrverträge, Bonusjahr, Sonderbemessung und rückwirkende Korrekturen brauchen getrennte Fachprüfung. Diese Oberfläche bescheinigt keinen realen Regimewechsel.</p>
    </details>
  </>;
}
