import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { directGrantRuleContext } from "../../domain/retirement/direct-grant-rules";
import { annualContribution, changeMode, changeYear, emptyGrantDraft, euro, previewGrant,
  type DraftField, type GrantDraft, type Preview } from "./direct-grant-adapter";

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
  const [step, setStep] = useState<"choice" | "a1" | "a2">("choice");
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
    title.current?.focus();
  };
  return <div className="tool-view retirement-view">
    <p className="eyebrow">SPEZIALISIERTE BERATUNG · ALTERSVORSORGE</p>
    <h1 ref={title} tabIndex={-1}>{step === "choice" ? "Altersvorsorge" : step === "a1" ? "A1 – Fördercheck" : "A2 – Sparen & Förderung"}</h1>
    <p className="retirement-notice"><strong>Ungespeicherte Modellvorschau.</strong> Nur synthetische Testdaten verwenden.
      Eingaben bleiben ausschließlich während dieses geöffneten Entwurfs erhalten. Verlassen, Neuladen oder Schließen verwirft sie.
      Ein Browserhinweis beim Neuladen/Schließen ist browserabhängig. Es gibt keine automatische Wiederherstellung.</p>
    <p className="retirement-notice">{modelNotice} {bonusNotice}</p>
    {step === "choice" ? <div className="retirement-cards">
      <section className="panel">
        <p className="eyebrow">BERATUNGSWEG A · A1/A2</p><h2>Neue Altersvorsorge planen</h2>
        <p>Bestätigten unmittelbaren Standard 2027/2028 prüfen und Beiträge sowie Grund- und Kinderzulagen ansehen.</p>
        <button className="primary" onClick={() => setStep("a1")}>A – Neue Altersvorsorge planen</button>
      </section>
      <section className="panel">
        <p className="eyebrow">BERATUNGSWEG B · SPÄTER</p><h2>Bestehende Riester-Rente prüfen</h2>
        <p>Noch nicht verfügbar. Die separate B1/B2-Oberfläche ist für AP-05a vorgesehen.</p>
        <button disabled>B – Bestehende Riester-Rente prüfen</button>
      </section>
    </div> : <>
      <nav className="retirement-steps" aria-label="Altersvorsorge-Schritte">
        <button onClick={() => setStep("choice")}>A/B-Auswahl</button>
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
    <details className="retirement-help"><summary>Regelstand, Quellen und Modellgrenzen</summary>
      <p>{modelNotice}</p><p>{bonusNotice}</p>
      {rules && <><p>Beitragsjahr: {rules.contributionYear} · Regel-ID: {rules.id} · Geprüft am: {rules.checkedOn} · Rechenversion: {rules.calculationVersion}</p>
        <ul>{rules.sources.map(source => <li key={source}><a href={source} target="_blank" rel="noreferrer">{source}</a></li>)}</ul></>}
      <p>Keine Bonusberechnung, Steuerberechnung, Kapitalprojektion, Produktberatung oder Alt-Riester-Berechnung. Offene Centbruchteile bleiben Prüfzustand und werden nicht als auszahlbare Förderung angezeigt.</p>
    </details>
    <button className="secondary" onClick={restart}>Spezialentwurf neu starten</button>
  </div>;
});
