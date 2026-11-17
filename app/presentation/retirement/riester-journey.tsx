import { useId, useRef, type ReactNode } from "react";
import { RetirementInformation } from "./retirement-questions";
import { euro } from "./direct-grant-adapter";
import { changeOldMode, changeOldYear, emptyNewScenario, oldContribution, type Comparison, type OldDraft } from "./old-riester-adapter";
import { RiesterStrategies, type RiesterSelection } from "./riester-strategies";

type AnswerKey = "provider" | "product" | "contractYear" | "paying" | "children" | "partner";
export interface RiesterJourneyDraft extends RiesterSelection {
  provider: string; product: string; contractYear: string;
  paying: "" | "yes" | "no" | "unknown";
  children: "" | "yes" | "no" | "unknown";
  partner: "" | "yes" | "no" | "unknown";
  showChecks: boolean;
}
export const emptyRiesterJourney = (): RiesterJourneyDraft => ({ provider: "", product: "", contractYear: "", paying: "", children: "", partner: "",
  selected: [], variant: "", payout: "", showChecks: false });

/** Selbstauskünfte widerrufen betroffene Evidenz; sie bestätigen nie einen Anspruch. */
export function invalidateRiesterAnswer(d: OldDraft, key: AnswerKey): OldDraft {
  if (key === "provider" || key === "product" || key === "contractYear") return { ...d,
    contract: "unconfirmed", regime: "unconfirmed", childrenStatus: "unconfirmed",
    children: d.children.map(c => ({ ...c, assignment: "assignment_unconfirmed" })),
    contributionConfirmed: false, evidenceQuality: "unconfirmed", comparisonConfirmed: false, newScenario: emptyNewScenario(d.year) };
  if (key === "paying") return { ...d, contributionConfirmed: false, evidenceQuality: "unconfirmed", comparisonConfirmed: false,
    newScenario: { ...d.newScenario, contributionConfirmed: false, scenarioConfirmed: false } };
  return { ...d, ...(key === "partner" ? { partner: "unconfirmed" as const } : {}), childrenStatus: "unconfirmed",
    children: d.children.map(c => ({ ...c, assignment: "assignment_unconfirmed" })), evidenceQuality: "unconfirmed", comparisonConfirmed: false,
    newScenario: { ...d.newScenario, childrenStatus: "unconfirmed", children: d.newScenario.children.map(c => ({ ...c, status: "assignment_unconfirmed" })), scenarioConfirmed: false } };
}

export function RiesterJourney({ ux, draft: d, step, preview, change, update, navigate, children }: {
  ux: RiesterJourneyDraft; draft: OldDraft; step: "b1" | "b2"; preview: Comparison | null;
  change: (next: RiesterJourneyDraft, dirty?: boolean) => void;
  update: (next: OldDraft) => void; navigate: (next: "choice" | "b1" | "b2") => void; children: ReactNode;
}) {
  const prefix = useId(), checks = useRef<HTMLElement>(null);
  const id = (key: string) => `${prefix}-${key}`;
  const answer = <K extends AnswerKey>(key: K, value: RiesterJourneyDraft[K]) => {
    if (ux[key] === value) return;
    change({ ...ux, [key]: value, ...(["provider", "product", "contractYear"].includes(key) ? { payout: "" as const } : {}) });
    update(invalidateRiesterAnswer(d, key));
  };
  const editContribution = (patch: Partial<OldDraft>) => update({ ...d, ...patch, contributionConfirmed: false, evidenceQuality: "unconfirmed", comparisonConfirmed: false,
    newScenario: { ...d.newScenario, contributionConfirmed: false, scenarioConfirmed: false } });
  const amount = oldContribution(d);
  const invalidYear = ux.contractYear !== "" && (!/^\d{4}$/.test(ux.contractYear) || Number(ux.contractYear) < 2002 || Number(ux.contractYear) > d.year);
  const openChecks = () => { change({ ...ux, showChecks: !ux.showChecks }, false);
    if (!ux.showChecks) requestAnimationFrame(() => { checks.current?.focus(); checks.current?.scrollIntoView({ block: "start" }); }); };
  const simpleChoice = (key: "paying" | "children" | "partner", title: string) => <>
    <label htmlFor={id(key)}>{title}</label><select id={id(key)} value={ux[key]} onChange={e => answer(key, e.target.value as RiesterJourneyDraft[typeof key])}>
      <option value="">Bitte wählen oder offen lassen</option><option value="yes">Ja</option><option value="no">Nein</option><option value="unknown">Weiß ich noch nicht</option>
    </select></>;
  return <div className="retirement-riester-journey">
    <nav className="retirement-steps" aria-label="Altersvorsorge-Schritte">
      <button onClick={() => navigate("choice")}>A/B-Auswahl</button>
      <button aria-current={step === "b1" ? "step" : undefined} onClick={() => navigate("b1")}>B1 Bestandsaufnahme</button>
      <button aria-current={step === "b2" ? "step" : undefined} onClick={() => navigate("b2")}>B2 Fördervergleich</button>
    </nav>
    <RetirementInformation riester />
    {step === "b1" ? <section className="panel retirement-form" aria-label="Ihr bisheriger Riester-Vertrag">
      <h2>Welchen Riester-Vertrag haben Sie und zahlen Sie derzeit ein?</h2>
      <p>Wir verschaffen uns einen Überblick und prüfen mögliche Wege. Angaben dürfen offen bleiben. Für den Fördervergleich brauchen Sie noch keinen Vertragsauszug.</p>
      <p>Bitte keine Namen, Vertragsnummern oder Dokumente eingeben. Verwenden Sie in dieser Modellvorschau nur synthetische Testangaben.</p>
      <label htmlFor={id("provider")}>Bei welchem Anbieter besteht Ihr Vertrag?</label><input id={id("provider")} value={ux.provider} maxLength={100} onChange={e => answer("provider", e.target.value)} placeholder="Anbieter oder offen lassen" />
      <label htmlFor={id("product")}>Wie heißt Ihr Riester-Produkt?</label><input id={id("product")} value={ux.product} maxLength={100} onChange={e => answer("product", e.target.value)} placeholder="Produkt oder noch unbekannt" />
      <label htmlFor={id("contractYear")}>In welchem Jahr wurde der Vertrag abgeschlossen?</label><input id={id("contractYear")} inputMode="numeric" value={ux.contractYear} onChange={e => answer("contractYear", e.target.value)} aria-invalid={invalidYear} aria-describedby={invalidYear ? id("year-error") : undefined} placeholder="Jahr oder offen lassen" />
      {invalidYear && <p id={id("year-error")} className="retirement-field-error" role="alert">Bitte ein vierstelliges Abschlussjahr zwischen 2002 und {d.year} angeben oder das Feld offen lassen. Den Vertragsbeginn noch mit dem Anbieter prüfen.</p>}
      {simpleChoice("paying", "Zahlen Sie derzeit regelmäßig in den Vertrag ein?")}
      {ux.paying === "no" && <p>Eine Zahlungspause setzt den Jahresbeitrag nicht automatisch auf null. Bereits gezahlte oder geplante Einmalbeiträge bitte mit berücksichtigen.</p>}
      <label htmlFor={id("year")}>Für welches Beitragsjahr möchten Sie die Förderung prüfen?</label><select id={id("year")} value={d.year} onChange={e => {
        update(changeOldYear(d, Number(e.target.value))); change({ ...ux, payout: "" });
      }}>{[2026, 2027, 2028].map(year => <option key={year} value={year}>{year}</option>)}</select>
      <label htmlFor={id("mode")}>Wie möchten Sie Ihren eigenen Beitrag angeben?</label><select id={id("mode")} value={d.mode} onChange={e => update(changeOldMode(d, e.target.value as OldDraft["mode"]))}>
        <option value="annual">Als Jahresbetrag</option><option value="monthly">Als monatlichen Beitrag</option></select>
      <p>Ein Wechsel der Eingabeart leert die Beitragsfelder. Es wird nichts automatisch umgerechnet.</p>
      {d.mode === "annual" ? <><label htmlFor={id("annual")}>Ihr eigener Jahresbeitrag in Euro</label><input id={id("annual")} inputMode="decimal" value={d.annual} onChange={e => editContribution({ annual: e.target.value })} /></>
        : <><label htmlFor={id("monthly")}>Ihr eigener monatlicher Beitrag in Euro</label><input id={id("monthly")} inputMode="decimal" value={d.monthly} onChange={e => editContribution({ monthly: e.target.value })} />
          <label htmlFor={id("startMonth")}>In welchem Monat beginnen die Zahlungen {d.year}?</label><select id={id("startMonth")} value={d.startMonth} onChange={e => editContribution({ startMonth: e.target.value, months: "" })}>
            <option value="">Noch offen</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
          <label htmlFor={id("months")}>In wie vielen Monaten zahlen Sie {d.year} tatsächlich ein?</label><select id={id("months")} value={d.months} onChange={e => editContribution({ months: e.target.value })}>
            <option value="">Noch offen</option>{Array.from({ length: d.startMonth ? 13 - Number(d.startMonth) : 0 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
          <label className="retirement-checkbox"><input type="checkbox" checked={d.hasOneOff} onChange={e => editContribution({ hasOneOff: e.target.checked })} />Zusätzlich einen eigenen Einmalbeitrag berücksichtigen</label>
          {d.hasOneOff && <><label htmlFor={id("oneOff")}>Ihr eigener Einmalbeitrag in Euro</label><input id={id("oneOff")} inputMode="decimal" value={d.oneOff} onChange={e => editContribution({ oneOff: e.target.value })} /></>}
        </>}
      <p data-testid="riester-entry-contribution" aria-live="polite">{amount.status === "valid" ? `Ihr Jahres-Eigenbeitrag: ${euro(amount.cents)}. Noch kein bestätigter Förderbetrag.` : amount.message}</p>
      {simpleChoice("children", "Kommt Kinderzulage für Sie infrage?")}
      {simpleChoice("partner", "Ist ein Ehe- oder Lebenspartner für Ihre Förderung relevant?")}
      <label htmlFor={id("income")}>Für die bisherige Förderung: maßgebliche rentenversicherungspflichtige Einnahmen des Vorjahres in Euro</label><input id={id("income")} inputMode="decimal" value={d.income} onChange={e => update({ ...d, income: e.target.value, incomeBasis: "unconfirmed", evidenceQuality: "unconfirmed", comparisonConfirmed: false })} />
      <p>Für {d.year} ist grundsätzlich das Jahr {d.year - 1} maßgeblich. Das aktuelle Gehalt ersetzt diese Bemessung nicht. Unbekannt bleibt offen, es wird nicht als null behandelt.</p>
      <button className="primary" onClick={() => navigate("b2")}>Weiter zum Fördervergleich</button>
    </section> : <section className="panel" aria-label="Fördervergleich verstehen"><h2>Was sagt der Fördervergleich aus?</h2>
      <p>Verglichen werden zwei getrennte Fördermodelle für dieselbe Person, dasselbe Jahr {d.year} und denselben eigenen Jahresbeitrag. Der Vergleich beantwortet noch nicht, welche Vertragsstrategie wirtschaftlich besser ist.</p>
      <p>Die neue Förderung ist nicht pauschal besser. Kosten, Garantien, Steuern, Kapitalentwicklung und Auszahlung sind in diesen Förderbeträgen nicht enthalten. Vergleich bei gleichem Nettoaufwand ist hier noch nicht verfügbar.</p>
      <button className="secondary" onClick={() => navigate("b1")}>Zurück zu Ihren Vertragsangaben</button>
    </section>}
    <RiesterStrategies selection={ux} year={d.year} change={selection => change({ ...ux, ...selection })} />
    <section className="panel" aria-label="Was müssen wir noch prüfen?">
      <h2>Was müssen wir vor einer Entscheidung noch prüfen?</h2>
      <ul>
        {(!ux.provider.trim() || !ux.product.trim()) && <li>Anbieter und Produkt fehlen noch. Vertragsbezeichnung beim Anbieter erfragen.</li>}
        {(!ux.contractYear || invalidYear) && <li>Abschlussjahr offen oder unplausibel. Vertragsbeginn bestätigen lassen.</li>}
        {(!ux.paying || ux.paying === "unknown") && <li>Laufende Zahlungen und mögliche Zahlungspausen gemeinsam klären.</li>}
        {(!ux.children || ux.children === "unknown" || d.childrenStatus === "unconfirmed") && <li>Kinderzulage: Anspruch und Zuordnung für das gewählte Jahr je Kind prüfen.</li>}
        {(!ux.partner || ux.partner === "unknown" || d.partner === "unconfirmed") && <li>Partnerkonstellation und mögliche Auswirkungen auf Berechtigung und Zulagen klären.</li>}
        {(!d.income || d.incomeBasis === "unconfirmed") && <li>Maßgebliche Vorjahreseinnahmen und Bemessungsjahr für den Alt-Fördercheck nachweisen.</li>}
        <li>Berechtigung, Förderregime, weitere Verträge, Bonus und Beitragsnachweise einzeln mit dem Berater prüfen. Ihre Antworten ersetzen diese Prüfung nicht.</li>
        <li>Für die wirtschaftliche Entscheidung fehlen geprüfte Vertrags-, Übertragungs- und Garantiewerte mit Stichtagen, Kosten und Auszahlungsterminen. Standmitteilung und Anbieterangebot beschaffen.</li>
        <li>Für eine mögliche Abwahl der lebenslangen Rentenkomponente: Tarifzulässigkeit, Änderungsfrist, Starttermin, Vererbung, Steuern und Versorgung nach Ende des Plans klären.</li>
      </ul>
      <p>Die fehlenden Vertragswerte verhindern die qualitative Orientierung und den bedingten Fördercheck nicht.</p>
    </section>
    <section className="panel" aria-label="Aktueller Stand der Fördermodelle">
      <h2>Ihre vorhandenen Förderangaben</h2>
      <p>Beitragsjahr {d.year}. {amount.status === "valid" ? `Eigener Jahresbeitrag: ${euro(amount.cents)}.` : "Eigener Jahresbeitrag noch offen oder zu korrigieren."}</p>
      <p data-testid="riester-funding-context">{preview?.old.status === "calculated" ? `Altmodell: ${euro(preview.old.result.totalGrantCents)} modellierte Jahreszulage ohne Bonus.` : "Altmodell: aktuell kein berechneter Förderbetrag."} {step === "b2" && preview?.newer.status === "calculated" ? `Neumodell: ${euro(preview.newer.result.totalGrantCents)} modellierte Jahreszulage ohne Bonus.` : "Neumodell separat fachlich prüfen."}</p>
      <p>Diese Förderzahlen gehören zu den getrennten bestätigten Modellannahmen. Sie werden keiner ausgewählten Vertragsstrategie als Vorteil zugerechnet und sind keine tatsächlich gebuchten Zulagen.</p>
      <button className="secondary" aria-expanded={ux.showChecks} aria-controls={id("checks")} onClick={openChecks}>{ux.showChecks ? "Beraterprüfung schließen" : "Förderangaben mit Berater prüfen"}</button>
    </section>
    <section id={id("checks")} ref={checks} tabIndex={-1} aria-label="Einzelprüfung der Förderannahmen" hidden={!ux.showChecks}>
      <h2>Einzelprüfung der Förderannahmen</h2><p>Die vorhandenen Fachformulare prüfen Alt- und Neumodell getrennt. Alle bisherigen Einzelbestätigungen sind weiterhin erforderlich.</p>
      {children}
    </section>
  </div>;
}
