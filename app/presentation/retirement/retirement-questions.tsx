import { useId, useRef, useState } from "react";
import type { CustomerPlan } from "./customer-plan-adapter";
import { changeYear } from "./direct-grant-adapter";

/** Ephemeral answers owned by RetirementEntry; never legal evidence or persisted. */
type Answer = "" | "yes" | "no" | "unknown";
export interface RetirementAnswers {
  year: string;
  employment: "" | "employee" | "civil" | "self" | "none" | "other";
  insurance: "" | "statutory" | "professional" | "none" | "unknown";
  civilConsent: Answer;
  upbringing: boolean;
  care: boolean;
  additions: "" | "none" | "unknown";
  married: Answer;
  separated: Answer;
  partner: Answer;
  riester: Answer;
  childBenefit: Answer;
}
export const emptyRetirementAnswers = (): RetirementAnswers => ({ year: "", employment: "", insurance: "", civilConsent: "",
  upbringing: false, care: false, additions: "", married: "", separated: "", partner: "", riester: "", childBenefit: "" });
export const possibleText = "Nach Ihren Angaben kommt eine staatliche Förderung grundsätzlich infrage. Die endgültige Berechtigung und Förderhöhe müssen noch geprüft werden.";
export function fundingOrientation(a: RetirementAnswers, startYear: string) {
  const reviewedYear = a.year === "2027" || a.year === "2028";
  const yearConflict = reviewedYear && a.year !== startYear;
  const supported = reviewedYear && !yearConflict;
  const possible = supported && a.employment === "employee";
  const message = !a.year ? "Bitte wählen Sie das Beitragsjahr für die Förderorientierung."
    : !/^\d{4}$/.test(a.year) || Number(a.year) < 100 ? "Bitte geben Sie ein gültiges vierstelliges Beitragsjahr an."
    : Number(a.year) < 2027 ? "Die neue Förderung beginnt erst ab 2027. Für dieses Jahr wird keine neue AVD-Förderung zugesagt."
    : yearConflict ? "Das gewählte Beitragsjahr stimmt nicht mit dem Beginn Ihres Sparplans überein. Bitte prüfen und korrigieren Sie die Jahresangaben, bevor wir Ihre persönliche Förderung für dieses Jahr beurteilen."
    : !supported ? "Für dieses Beitragsjahr ist hier noch kein geprüfter Förderregelstand hinterlegt."
    : possible ? possibleText
    : a.employment === "civil" ? "Bei Beamten prüfen wir die begünstigte Besoldungs-/Versorgungssituation und die erforderliche Einwilligung zur Datenübermittlung."
    : a.employment === "self" ? "Auch Selbstständige können zur Förderung gehören. Wir prüfen Versicherung, Versorgungseinrichtung und gegebenenfalls Einkünfte und Steuererklärung."
    : a.employment === "none" ? "Ohne Erwerbstätigkeit können Versicherungszeiten oder eine Partnerberechtigung relevant sein."
    : "Bitte klären Sie Ihre konkrete Versicherungssituation für das Beitragsjahr.";
  const next: string[] = [];
  if (!a.year || !/^\d{4}$/.test(a.year) || Number(a.year) < 100) next.push("Beitragsjahr auswählen oder mit dem Berater klären.");
  else if (Number(a.year) < 2027) next.push("Ein Startjahr ab 2027 wählen oder einen bestehenden Riester-Vertrag gesondert prüfen.");
  else if (yearConflict) next.push("Beitragsjahr und Zahlungsstartjahr gemeinsam prüfen und die abweichende Jahresangabe korrigieren.");
  else if (!supported) next.push("Den Rechtsstand für Ihr Beitragsjahr mit dem Berater prüfen.");
  if (!a.employment) next.push("Wählen Sie Ihre Erwerbs- und Versicherungssituation oder klären Sie diese mit Ihrem Berater.");
  if (possible) next.push("Versicherungspflicht für Person und Beitragsjahr, förderfähigen Vertrag und eigenen Jahresbeitrag fachlich prüfen.");
  if (a.employment === "civil") next.push("Besoldungsnachweis und wirksame Einwilligung mit Ihrer zuständigen Stelle prüfen.");
  if (["self", "none", "other"].includes(a.employment)) next.push(a.insurance === "professional"
    ? "Pflichtmitgliedschaft, relevante Einkünfte und Einwilligung der Versorgungseinrichtung prüfen."
    : "Versicherungsnachweis und die gesetzlichen Voraussetzungen Ihrer konkreten Situation prüfen.");
  if (a.upbringing) next.push("Zuordnung der Kindererziehungszeiten beim Rentenversicherungsträger prüfen.");
  if (a.care) next.push("Rentenversicherungspflicht aufgrund der konkreten Pflegesituation prüfen.");
  if (a.additions === "unknown") next.push("Mögliche Erziehungs- oder Pflegezeiten mit dem Rentenversicherungsträger klären.");
  if (a.employment !== "employee" && a.married === "yes") next.push("Partnerberechtigung und weitere Voraussetzungen der mittelbaren Förderung gemeinsam prüfen.");
  if (a.childBenefit !== "no") next.push(a.childBenefit === "yes"
    ? "Für jedes Kind den tatsächlichen Kindergeldanspruch und die zulässige Zulagenzuordnung im Beitragsjahr prüfen."
    : "Klären, ob im Beitragsjahr Kindergeldanspruch besteht und wem eine Kinderzulage zugeordnet werden darf.");
  else next.push("Die Kinderangabe für das Beitragsjahr fachlich prüfen; daraus wird noch keine bestätigte Kinderlosigkeit.");
  if (a.riester !== "no") next.push("Vorhandene Riester-Unterlagen und die Auswirkungen eines neuen Fördervertrags prüfen.");
  return { possible, title: possible ? "Förderung grundsätzlich denkbar" : "Weitere Angaben erforderlich", message, next };
}

/** Only revoke dependent evidence, never infer or confirm a legal status. */
export function invalidateAnswer(plan: CustomerPlan, key: keyof RetirementAnswers): CustomerPlan {
  const e = plan.evidence;
  const children = () => ({ childrenStatus: "unconfirmed" as const, children: e.children.map(c => ({ ...c, status: "assignment_unconfirmed" as const })) });
  if (key === "year") return { ...plan, evidence: changeYear(e, e.year) };
  if (key === "childBenefit") return { ...plan, evidence: { ...e, ...children() } };
  if (key === "riester") return { ...plan, evidence: { ...e, regime: "unconfirmed", contract: "unconfirmed", contributionConfirmed: false, ...children() } };
  const partner = ["married", "separated", "partner"].includes(key);
  return { ...plan, evidence: { ...e, entitlement: "unconfirmed", contributionConfirmed: false, ...(partner ? children() : {}) } };
}

export function FundingOrientation({ answers, year }: { answers: RetirementAnswers; year: string }) {
  const o = fundingOrientation(answers, year);
  return <section className="panel retirement-orientation" aria-label="Vorläufige Förderorientierung" aria-live="polite">
    <p className="eyebrow">IHRE ANGABEN · NOCH KEINE FÖRDERZUSAGE</p>
    <h2>{o.title}</h2><p data-testid="funding-orientation">{o.message}</p>
    <h3>Was wir als Nächstes prüfen</h3><ul>{o.next.map(t => <li key={t}>{t}</li>)}</ul>
    <p>Ihre Antworten ersetzen keine fachliche Bestätigung. Sie können unabhängig davon mit eigenen Beiträgen und einem neutralen Marktmodell weiterrechnen.</p>
  </section>;
}

export function RetirementInformation({ riester = false }: { riester?: boolean }) {
  return <section className="panel retirement-information" aria-label={riester ? "Orientierung zum bestehenden Riester-Vertrag" : "Das Altersvorsorgedepot verstehen"}>
    <p className="eyebrow">{riester ? "BESTEHENDE VORSORGE" : "NEUES FÖRDERREGIME AB 2027"}</p>
    <h2>{riester ? "Ihren Riester-Vertrag richtig einordnen" : "Das Altersvorsorgedepot kurz erklärt"}</h2>
    {riester ? <><p>Bei einem bestehenden Riester-Vertrag prüfen wir die bisherigen Förderregeln, die Vertragsgarantie und Ihre Möglichkeiten: fortführen, die Förderregelung wechseln, Kapital übertragen oder Altvertrag und neue Vorsorge kombinieren.</p>
      <p>Heutiger Vertragswert, tatsächlicher Übertragungswert und spätere Garantie sind unterschiedliche Größen. Auch die spätere Auszahlform ist gesondert zu prüfen. Eine Entscheidung braucht Ihre Vertragsunterlagen.</p></>
      : <><p>Mit einem zertifizierten Altersvorsorgedepot investieren Sie eigene Beiträge und mögliche staatliche Zulagen für später. Die Zulagen fließen in den Vertrag.</p>
        <div className="retirement-facts"><p><strong>120 €</strong> Mindest-Jahreseigenbeitrag im regulären Förderfall</p><p><strong>Bis 540 €</strong> Grundzulage bei 1.800 € eigenem Jahresbeitrag</p><p><strong>Bis 300 € je Kind</strong> bei erfülltem Anspruch und zulässiger Zuordnung</p><p><strong>6.840 €</strong> jährliche Einzahlungshöchstgrenze je einschlägigem Vertrag</p></div>
        <div className="retirement-example"><h3>So könnte Förderung aussehen</h3><p><strong>Bedingtes Beispiel für 2027 – keine persönliche Zusage</strong></p>
          <p>30 € monatlich über zwölf Monate ergeben 360 € Eigenbeitrag. Bei erfüllten Voraussetzungen: 180 € Grundzulage, zusammen <strong>540 € im Vertrag</strong>.</p>
          <p>Mit einem tatsächlich förderfähigen und zugeordneten Kind könnten 300 € hinzukommen: insgesamt <strong>840 € im Vertrag</strong>. Bonus und zusätzliche Steuerentlastung sind hier nicht enthalten.</p></div>
        <p>Marktverluste sind möglich, Kosten mindern das Ergebnis. Eine Garantie hängt von der gewählten Variante und ihren Vertragsbedingungen ab. Die Verfügbarkeit ist an die Altersvorsorge gebunden.</p></>}
    <details className="retirement-help"><summary>Mehr erfahren</summary>
      <p>In der Ansparphase werden Erträge im zertifizierten Vertrag grundsätzlich nicht laufend privat besteuert. Ein zusätzlicher Steuervorteil aus der Günstigerprüfung ist gesondert zu beurteilen. Geförderte Leistungen sind bei Auszahlung grundsätzlich nachgelagert steuerpflichtig.</p>
      <p>Grundzulage, mögliche Kinderzulage und ein möglicher einmaliger Berufseinsteigerbonus setzen jeweils die gesetzlichen Voraussetzungen voraus. Familien-, Vertrags- und Jahreskonstellation müssen geprüft werden. Ein Bonus wird nicht automatisch hinzugerechnet.</p>
      {riester ? <p>Bei Ihrem bestehenden Riester-Vertrag prüfen wir Garantie, Auszahltermin und eine bestehende lebenslange Rentenkomponente anhand der Vertragsunterlagen. Ein anderes Förderregime oder eine andere Auszahlform wird hier nicht automatisch gewählt.</p>
        : <p>Beim neuen Altersvorsorgedepot sieht Union Investment einen Fondsauszahlplan vor. Dieser garantiert keine lebenslange Monatsrente. Vorzeitige schädliche Verwendung kann Rückzahlungen auslösen; Auszahlung, Kosten und Garantien sind am konkreten Vertrag zu prüfen.</p>}
      <p>Quellenstand: Recht für 2027/2028, geprüft 11.11.2026; öffentliche Union-Information, Stand Oktober 2026. Keine individuelle Produkt- oder Förderzusage.</p>
      <ul><li><a href="https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0010a/0010a_2027_01_01.html" target="_blank" rel="noreferrer">Gesetzliche Voraussetzungen 2027</a></li>
        <li><a href="https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0010a/0010a_2028_01_01.html" target="_blank" rel="noreferrer">Gesetzliche Voraussetzungen 2028</a></li>
        <li><a href="https://www.bundesfinanzministerium.de/Content/DE/FAQ/reform-der-privaten-altersvorsorge.html" target="_blank" rel="noreferrer">BMF: Förderung und Höchstbeiträge</a></li>
        <li><a href="https://www.union-investment.de/familien-und-altersvorsorge/fuers-alter-vorsorgen/antworten/wie-funktioniert-das-altersvorsorgedepot" target="_blank" rel="noreferrer">Union Investment: Funktionsweise und Auszahlung</a></li></ul>
    </details>
  </section>;
}

const employmentOptions = [["employee", "Angestellt und in der deutschen gesetzlichen Rentenversicherung pflichtversichert"], ["civil", "Verbeamtet"], ["self", "Selbstständig oder freiberuflich"], ["none", "Derzeit nicht erwerbstätig"], ["other", "Andere Situation / gemeinsam prüfen"]] as const;
const insuranceOptions = [["statutory", "Gesetzliche Rentenversicherungspflicht"], ["professional", "Pflichtmitglied einer berufsständischen Versorgungseinrichtung"], ["none", "Keine dieser Versicherungen"], ["unknown", "Noch unklar"]] as const;
const answerOptions = [["yes", "Ja"], ["no", "Nein"], ["unknown", "Weiß ich nicht / gemeinsam prüfen"]] as const;
const questionSections = ["Zeitraum und Person", "Erwerb und Versicherung", "Besondere Voraussetzungen", "Bestehende Vorsorge und Kinder", "Ihre erste Orientierung"] as const;

export function RetirementQuestions({ answers: a, plan, change, birth, back, next, riester }: {
  answers: RetirementAnswers; plan: CustomerPlan; change: <K extends keyof RetirementAnswers>(key: K, value: RetirementAnswers[K]) => void;
  birth: (value: string) => void; back: () => void; next: () => void; riester: () => void;
}) {
  const prefix = useId(), yearRef = useRef<HTMLInputElement>(null), birthRef = useRef<HTMLInputElement>(null);
  // Section navigation is presentation state only. Answers remain owned by RetirementEntry.
  const [section, setSection] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const insuranceQuestion = ["self", "none", "other"].includes(a.employment);
  const partnerQuestions = insuranceQuestion || a.employment === "civil" && a.civilConsent !== "yes";
  const sections = [0, 1, ...(insuranceQuestion || a.employment === "civil" ? [2] : []), 3, 4];
  const position = sections.indexOf(section);
  const move = (target: number) => {
    setSection(target);
    requestAnimationFrame(() => heading.current?.focus());
  };
  const [errors, setErrors] = useState<{ year?: string; birth?: string }>({});
  const id = (s: string) => `${prefix}-${s}`;
  const tri = (key: "civilConsent" | "married" | "separated" | "partner" | "riester" | "childBenefit", question: string) => <fieldset className="retirement-answer-group"><legend>{question}</legend>
    {answerOptions.map(([value, label]) => <label key={value} className="retirement-answer"><input type="radio" name={id(key)} checked={a[key] === value} onChange={() => change(key, value)} />{label}</label>)}
  </fieldset>;
  const submit = (target?: number) => {
    const year = a.year && (!/^\d{4}$/.test(a.year) || Number(a.year) < 100) ? "Bitte ein vierstelliges Beitragsjahr eingeben oder offenlassen." : undefined;
    const birth = plan.birthYear && (!/^\d{4}$/.test(plan.birthYear) || Number(plan.birthYear) < 100 || Number(plan.birthYear) > Number(a.year || plan.capital.start.slice(0, 4))) ? "Bitte ein gültiges Geburtsjahr bis zum Beitragsjahr eingeben oder offenlassen." : undefined;
    setErrors({ year, birth });
    if (year || birth) {
      setSection(0);
      requestAnimationFrame(() => { if (year) yearRef.current?.focus(); else birthRef.current?.focus(); });
    } else if (target !== undefined) move(target); else next();
  };
  const answerText = (value: Answer) => answerOptions.find(([key]) => key === value)?.[1] ?? "Noch offen";
  const summary: [string, string][] = [
    ["Erstes Beitragsjahr", a.year || "Noch offen"], ["Geburtsjahr (optional)", plan.birthYear || "Nicht angegeben"],
    ["Beruf und Versicherung", employmentOptions.find(([key]) => key === a.employment)?.[1] ?? "Noch offen"],
    ["Zusätzliche Situationen", [a.upbringing ? "Kindererziehungszeiten" : "", a.care ? "Ich pflege Angehörige" : "",
      a.additions === "none" ? "Keine weiteren Situationen" : a.additions === "unknown" ? "Zusätzliche Zeiten gemeinsam prüfen" : ""].filter(Boolean).join(", ") || "Noch offen"],
    ...(a.employment === "civil" ? [["Einwilligung zur Datenübermittlung", answerText(a.civilConsent)] as [string, string]] : []),
    ...(insuranceQuestion ? [["Versicherung im Sonderfall", insuranceOptions.find(([key]) => key === a.insurance)?.[1] ?? "Noch offen"] as [string, string]] : []),
    ...(partnerQuestions ? [["Ehe / Lebenspartnerschaft", answerText(a.married)] as [string, string],
      ...(a.married === "yes" ? [["Dauerhaft getrennt", answerText(a.separated)], ["Partner unmittelbar förderberechtigt", answerText(a.partner)]] as [string, string][] : [])] : []),
    ["Bestehender Riester-Vertrag", answerText(a.riester)], ["Kindergeld", answerText(a.childBenefit)],
  ];
  return <div className="retirement-question-layout retirement-guided-layout">
    <section className="panel retirement-questionnaire" aria-label="Ihre Voraussetzungen">
      <p role="status" aria-live="polite" aria-atomic="true">Abschnitt {position + 1} von {sections.length}: {questionSections[section]}</p>
      <nav className="retirement-question-progress" aria-label="Abschnitte der Förderfragen">
        <ol>{sections.map((index, i) => <li key={index}><button type="button" aria-current={section === index ? "step" : undefined}
          onClick={() => index > section ? submit(index) : move(index)}>{i + 1}. {questionSections[index]}</button></li>)}</ol>
      </nav>
      <h2 ref={heading} tabIndex={-1}>{questionSections[section]}</h2>
      <p>Ihre Antworten geben eine erste Orientierung. Unklare Angaben dürfen offenbleiben.</p>
      <form className="retirement-form" noValidate onSubmit={e => { e.preventDefault(); section === 4 ? submit() : submit(sections[position + 1]); }}>
        {section === 0 && <>
        <label htmlFor={id("year")}>Für welches Jahr möchten Sie erstmals einzahlen?</label>
        <input id={id("year")} ref={yearRef} inputMode="numeric" value={a.year} placeholder="z. B. 2027" aria-invalid={!!errors.year} aria-describedby={errors.year ? id("year-error") : undefined} onChange={e => { setErrors({}); change("year", e.target.value); }} />
        {errors.year && <p id={id("year-error")} role="alert">{errors.year}</p>}
        <label htmlFor={id("birth")}>In welchem Jahr sind Sie geboren? (optional)</label>
        <input id={id("birth")} ref={birthRef} inputMode="numeric" value={plan.birthYear} aria-invalid={!!errors.birth} aria-describedby={errors.birth ? id("birth-error") : undefined} onChange={e => { setErrors({}); birth(e.target.value); }} />
        {errors.birth && <p id={id("birth-error")} role="alert">{errors.birth}</p>}
        </>}
        {section === 1 && <>
        <fieldset className="retirement-answer-group"><legend>Wie sind Sie derzeit beruflich tätig und versichert?</legend>
          {employmentOptions.map(([v, label]) => <label key={v} className="retirement-answer"><input type="radio" name={id("employment")} checked={a.employment === v} onChange={() => change("employment", v)} />{label}</label>)}
        </fieldset><p>Im öffentlichen Dienst angestellt, aber nicht verbeamtet? Wählen Sie Ihre tatsächliche Versicherungsform.</p>
        <fieldset className="retirement-answer-group"><legend>Treffen zusätzlich weitere Situationen auf Sie zu?</legend>
          <p>Mehrfachauswahl möglich – unabhängig von Ihrer Berufstätigkeit.</p>
          <label className="retirement-answer"><input type="checkbox" checked={a.upbringing} onChange={e => change("upbringing", e.target.checked)} />Kindererziehungszeiten</label>
          <label className="retirement-answer"><input type="checkbox" checked={a.care} onChange={e => change("care", e.target.checked)} />Ich pflege Angehörige</label>
          <label className="retirement-answer"><input type="checkbox" checked={a.additions === "none"} onChange={e => change("additions", e.target.checked ? "none" : "")} />Keine weiteren Situationen</label>
          <label className="retirement-answer"><input type="checkbox" checked={a.additions === "unknown"} onChange={e => change("additions", e.target.checked ? "unknown" : "")} />Zusätzliche Zeiten gemeinsam prüfen</label>
        </fieldset>
        </>}
        {section === 2 && <>
        {a.employment === "civil" && tri("civilConsent", "Haben Sie der erforderlichen Datenübermittlung gegenüber Ihrer zuständigen Stelle zugestimmt?")}
        {insuranceQuestion && <><fieldset className="retirement-answer-group"><legend>Welche Versicherungssituation trifft auf Sie zu?</legend>
          {insuranceOptions.map(([v, label]) => <label className="retirement-answer" key={v}><input type="radio" name={id("insurance")} checked={a.insurance === v} onChange={() => change("insurance", v)} />{label}</label>)}
        </fieldset></>}
        {partnerQuestions && <>{tri("married", "Sind Sie verheiratet oder in einer eingetragenen Lebenspartnerschaft?")}
          {a.married === "yes" && <>{tri("separated", "Leben Sie dauerhaft getrennt?")}{tri("partner", "Ist Ihr Partner selbst unmittelbar förderberechtigt?")}<p>Auch bei passenden Antworten müssen die weiteren Voraussetzungen der mittelbaren Förderung geprüft werden.</p></>}</>}
        </>}
        {section === 3 && <>
        {tri("riester", "Haben Sie bereits einen Riester-Vertrag?")}
        {(a.riester === "yes" || a.riester === "unknown") && <div className="retirement-example"><p>Ein neuer Fördervertrag kann die Förderung Ihres bestehenden Vertrags beeinflussen.</p><button type="button" onClick={riester}>Bestehenden Riester-Vertrag zuerst prüfen</button><p>Ihre Antworten bleiben beim internen Wechsel erhalten. A- und B-Vertragsnachweise bleiben getrennt.</p></div>}
        {tri("childBenefit", "Wird für eines Ihrer Kinder aktuell Kindergeld gezahlt?")}
        {a.childBenefit === "yes" && <p>Kindergeldbezug allein ordnet noch keine Kinderzulage zu. Anspruch und Zuordnung je Kind und Jahr prüfen wir in der Beraterprüfung; bitte noch keine Namen oder Geburtsdaten von Kindern eingeben.</p>}
        </>}
        {section === 4 && <>
          <h3>Ihre eigenen Angaben</h3>
          <dl className="retirement-answer-summary">{summary.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <FundingOrientation answers={a} year={plan.capital.start.slice(0, 4)} />
        </>}
        <div className="retirement-question-actions">
          <button type="button" onClick={() => section === 0 ? back() : move(sections[position - 1])}>{section === 0 ? "Zurück zur Einführung" : "Zurück"}</button>
          {section !== 4 && <button className="primary" type="submit">Weiter</button>}
          <button className={section === 4 ? "primary" : "secondary"} type="button" onClick={() => submit()}>Weiter zum eigenen Sparplan</button>
        </div>
        {section !== 4 && <p>Sie können offene Angaben später gemeinsam klären oder direkt mit Ihrem eigenen Sparplan neutral weiterrechnen.</p>}
      </form>
    </section>
    {section !== 4 && <FundingOrientation answers={a} year={plan.capital.start.slice(0, 4)} />}
  </div>;
}
