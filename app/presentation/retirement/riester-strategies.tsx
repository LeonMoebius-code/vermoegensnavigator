import { useId, useRef } from "react";

export type StrategyId = 1 | 2 | 3 | 4;
export type ParallelVariant = "" | "4a" | "4b";
export type PayoutInterest = "" | "keep" | "check";
export interface RiesterSelection {
  selected: StrategyId[];
  variant: ParallelVariant;
  payout: PayoutInterest;
}
// § 52 Abs. 50a Sätze 6–9 EStG, Rechtsstand ab 01.01.2027.
const parallelFundingRule = "Ein tatsächlicher Abschluss eines weiteren zertifizierten Altersvorsorgevertrags ab 2027 löst automatisch die neuen Förderregeln einheitlich für alle Altersvorsorgeverträge derselben zulageberechtigten Person aus.";
const parallelRightsNotice = "Diese Förderumstellung überträgt kein bisheriges Vertragsvermögen und ändert bestehende Vertragsgarantien nicht automatisch.";
const strategies = [
  { id: 1, title: "Bisherigen Vertrag unverändert weiterführen",
    purpose: "Sie sparen im bisherigen Vertrag weiter und prüfen den Bestandsschutz der bisherigen Förderung.",
    condition: "Alter Vertrag, bisherige Förderregeln und persönliche Fördervoraussetzungen müssen weiterhin passen.",
    opportunity: "Vertraute Vertragsbedingungen und vorhandene Zusagen können erhalten bleiben.",
    risk: "Bestehende Kosten und Anlagerisiken bleiben. Die bisherige Förderung ist nicht für jeden Beitrag automatisch günstiger.",
    funding: "Bisheriger Eigenbeitrag und alte Förderung unter den geprüften Voraussetzungen. Zusätzliche Steuerwirkung offen.",
    value: "Heutigen Vertragswert mit Stichtag und zugesagte spätere Leistung mit Fälligkeit getrennt prüfen.",
    market: "Die bisherige Anlage bleibt. Kosten und Marktrisiken hängen vom vorhandenen Produkt ab.",
    payout: "Vertraglicher Beginn und bisherige Auszahlungsform bleiben zu prüfen. Die separate Auszahlungsoption kann relevant sein.",
    documents: "Standmitteilung, laufende Kosten, Beitragsplan sowie Garantie- und Auszahlungstermine des Altvertrags." },
  { id: 2, title: "Bisherigen Vertrag behalten, neue Förderregeln nutzen",
    purpose: "Das Altprodukt bleibt bestehen. Geprüft wird ein Wechsel allein in die neue Förderung.",
    condition: "Rechtliche Voraussetzungen, Erklärung gegenüber dem Anbieter und Folgen für alle betroffenen Altverträge und gegebenenfalls den Partner klären.",
    opportunity: "Neue Förderregeln können bei unverändertem Produkt zu Ihrer Situation passen.",
    risk: "Der Wechsel der Förderregeln ist grundsätzlich nicht rückgängig zu machen. Eine höhere Zulage oder bessere Gesamtrendite ist nicht zugesagt.",
    funding: "Neue Förderung im bestehenden Produkt prüfen. Folgen für weitere Verträge und Partner einbeziehen. Steuerwirkung offen.",
    value: "Keine Kapitalübertragung geplant. Bestand, Garantiezusage und Leistungstermin dennoch vom Anbieter bestätigen lassen.",
    market: "Produkt, Kosten und Anlage bleiben grundsätzlich bestehen. Ein Förderwechsel beseitigt keine Produktrisiken.",
    payout: "Bisherigen Leistungsbeginn und Auszahlbedingungen prüfen. Ein Förderwechsel allein bestätigt keine andere Auszahlungsform.",
    documents: "Anbieterinformation zum Förderwechsel und dessen Unwiderruflichkeit, weitere Altverträge, Partner- und Kinderzuordnung." },
  { id: 3, title: "Kapital in neues Produkt übertragen",
    purpose: "Geprüft wird die Übertragung des tatsächlich verfügbaren Kapitals in einen neuen Vorsorgevertrag.",
    condition: "Übertragungswert zum Stichtag, neue Produktverfügbarkeit, Wechselkosten sowie neue Garantie- und Auszahlungsbedingungen prüfen.",
    opportunity: "Eine andere Anlage und andere Kostenbedingungen können möglich sein.",
    risk: "Die bisherige Altgarantie bleibt nicht automatisch bestehen. Wechsel-, Abschluss- und Vertriebskosten sowie neue Marktrisiken sind möglich.",
    funding: "Neuer Vertrag und neue Förderregeln. Der Übertrag ist kein neuer eigener Jahresbeitrag. Steuerfolgen gesondert prüfen.",
    value: "Tatsächlichen Übertragungswert und neue Garantie mit ihrem Termin prüfen. Altbeiträge sind nicht automatisch der neue Garantiewert. Altbestand nicht doppelt zählen.",
    market: "Chancen und Verlustrisiken des neuen Produkts prüfen. Keine höhere Rendite oder Werterholung zugesagt.",
    payout: "Neuen Auszahlungsbeginn, Laufzeit und Absicherung nach Ende eines Auszahlplans prüfen. Altbedingungen gelten nicht automatisch weiter.",
    documents: "Verbindlicher Übertragungswert mit Stichtag, Wechselkosten, neues Produktangebot, Garantieumfang und frühestmögliche Auszahlung." },
  { id: 4, title: "Altvertrag behalten und zusätzlich AVD starten",
    purpose: "Sie behalten den Altvertrag und prüfen zusätzlich ein Altersvorsorgedepot, kurz AVD.",
    condition: "Beiträge je Vertrag und Kinderzuordnung gemeinsam prüfen. Auswirkungen auf weitere Altverträge und gegebenenfalls einen mittelbar zulageberechtigten Ehegatten bei dessen Zulagenantrag berücksichtigen.",
    opportunity: "Vorhandene Vertragsrechte können mit einer zusätzlichen Anlage verbunden werden.",
    risk: `${parallelFundingRule} ${parallelRightsNotice} Zulagen dürfen nicht doppelt gerechnet werden. Zwei Verträge können zusätzliche Kosten verursachen.`,
    funding: `${parallelFundingRule} Beiträge je Vertrag getrennt betrachten. Kein gleichzeitiger voller Alt- und Neuanspruch und keine Verdopplung personenbezogener Zulagen. Steuerwirkung offen.`,
    value: `${parallelRightsNotice} Kein Kapitalübertrag vorgesehen. Alte und neue Werte, Garantien und deren Termine getrennt prüfen.`,
    market: "Altanlage und neue Anlage haben eigene Kosten und Risiken. Die Kombination erzeugt keine zusätzliche Garantie.",
    payout: "Beginn und Auszahlungsform beider Verträge getrennt klären. Die Queroption betrifft nur den geeigneten Altvertrag.",
    documents: "Beitragspläne beider Verträge, weitere Altverträge, gegebenenfalls mittelbare Ehegattenberechtigung und Zulagenantrag, Kosten, Förder-/Kinderzuordnung, Garantieumfang und Termine sowie neues Produktangebot." },
] as const;
const variantText = (variant: ParallelVariant) => {
  const plan = variant === "4a"
    ? "4A: Altvertrag beitragsfrei, neuen Vertrag besparen. Vorhandenes Vertragsvermögen und bestehende vertragliche Rechte können erhalten bleiben. Ein Altgarantieanspruch kann bestehen bleiben. Höhe, Fälligkeit und laufende Kosten sind vertraglich zu prüfen."
    : variant === "4b"
      ? "4B: Altvertrag weiter besparen und neuen Vertrag besparen. Beide Beitragsströme und deren Finanzierung nach den neuen einheitlichen Förderregeln und den personenbezogenen Zulagengrenzen getrennt prüfen, Zulagen nicht verdoppeln."
      : "Variante noch offen: 4A stellt den Altvertrag beitragsfrei, 4B bespart ihn weiter. In beiden Fällen wird zusätzlich der neue Vertrag bespart.";
  return `${plan} ${parallelFundingRule} ${parallelRightsNotice}`;
};

export function RiesterStrategies({ selection, change }: {
  selection: RiesterSelection; change: (next: RiesterSelection) => void;
}) {
  const prefix = useId(), comparison = useRef<HTMLElement>(null);
  const chosen = strategies.filter(s => selection.selected.includes(s.id));
  const toggle = (id: StrategyId) => change({ ...selection, selected: selection.selected.includes(id)
    ? selection.selected.filter(s => s !== id) : [...selection.selected, id] });
  const compare = (id: StrategyId) => {
    if (!selection.selected.includes(id)) change({ ...selection, selected: [...selection.selected, id] });
    requestAnimationFrame(() => { comparison.current?.focus(); comparison.current?.scrollIntoView({ block: "start", behavior: "smooth" }); });
  };
  return <section className="retirement-riester-strategies" aria-label="Vier Vertragsstrategien">
    <h2>Welche Möglichkeiten möchten Sie prüfen?</h2>
    <p>Vier Wege zur Orientierung. Keine Möglichkeit ist vorausgewählt oder empfohlen. Wählen Sie mindestens zwei für einen qualitativen Vergleich.</p>
    <p>Neue Förderregeln und neue Verträge kommen ab 2027 in Betracht. Die persönliche und vertragliche Verfügbarkeit ist noch zu prüfen.</p>
    <p>Die Auswahl einer Strategie in dieser Anwendung schließt keinen Vertrag ab und bewirkt keine Förderumstellung.</p>
    <div className="retirement-riester-grid">
      {strategies.map(s => <article className="panel retirement-riester-card" key={s.id} aria-labelledby={`${prefix}-strategy-${s.id}`} data-testid={`riester-strategy-${s.id}`}>
        <p className="eyebrow">STRATEGIE {s.id}</p><h3 id={`${prefix}-strategy-${s.id}`}>{s.title}</h3>
        <p>{s.purpose}</p><p><strong>Voraussetzung: </strong>{s.condition}</p>
        {s.id === 4 && <><label htmlFor={`${prefix}-variant`}>Variante der Strategie 4</label>
          <select id={`${prefix}-variant`} value={selection.variant} onChange={e => change({ ...selection, variant: e.target.value as ParallelVariant })}>
            <option value="">Noch gemeinsam klären</option><option value="4a">4A: Altvertrag beitragsfrei, neuer Vertrag</option><option value="4b">4B: Altvertrag weiter besparen, neuer Vertrag</option>
          </select><p data-testid="riester-variant-explanation">{variantText(selection.variant)}</p></>}
        <details className="retirement-help"><summary>Vorteile/Nachteile</summary>
          <p><strong>Mögliche Chance: </strong>{s.opportunity}</p><p><strong>Nachteile und Risiken: </strong>{s.risk}</p>
        </details>
        <div className="retirement-riester-actions">
          <button className="secondary" aria-label={`Für mich prüfen: Strategie ${s.id}`} aria-pressed={selection.selected.includes(s.id)} onClick={() => toggle(s.id)}>Für mich prüfen</button>
          <button className="secondary" aria-label={`Mit anderer Möglichkeit vergleichen: Strategie ${s.id}`} onClick={() => compare(s.id)}>Mit anderer Möglichkeit vergleichen</button>
        </div>
      </article>)}
    </div>
    <section className="panel retirement-riester-payout" aria-labelledby={`${prefix}-payout-title`}>
      <p className="eyebrow">SEPARATE AUSZAHLUNGSFRAGE</p><h2 id={`${prefix}-payout-title`}>Lebenslange Rente beibehalten oder Auszahlplan prüfen?</h2>
      <p>Bei geeigneten Altverträgen kann die lebenslange Rentenkomponente zugunsten eines befristeten Fondsauszahlplans bis 85 abgewählt werden. Das kann auch zu Strategie 1 passen. Es ist keine fünfte Vertragsstrategie.</p>
      <p><strong>Verfügbarkeit ungeklärt.</strong> Anbieter, Produkt, Abschlussjahr, Änderungsfrist und Bedingungen müssen geprüft werden. Eine Auswahl hier erfasst nur Ihr Prüfinteresse und ändert keinen Vertrag.</p>
      <p>Die beschriebene neue Wahlmöglichkeit beginnt frühestens 2027. Das Beitragsjahr des Förderchecks legt Ihren Auszahlungsbeginn nicht fest.</p>
      <label htmlFor={`${prefix}-payout`}>Was möchten Sie zur Auszahlung besprechen?</label>
      <select id={`${prefix}-payout`} value={selection.payout} onChange={e => change({ ...selection, payout: e.target.value as PayoutInterest })}>
        <option value="">Noch keine Auswahl</option><option value="keep">Lebenslange Rentenkomponente beibehalten</option>
        <option value="check">Mögliche Abwahl zugunsten eines Auszahlplans prüfen</option>
      </select>
      <dl className="retirement-riester-facts">
        <div><dt>Anfangsleistung und Beginn</dt><dd>Ohne reserviertes Kapital für die spätere Rentenversicherung kann die Anfangsleistung höher ausfallen. Betrag und Starttermin sind tarifabhängig und noch offen.</dd></div>
        <div><dt>Kapitalverzehr und Zeit nach 85</dt><dd>Ein befristeter Plan verbraucht das Kapital. Nach seinem Ende entfallen die Zahlungen aus diesem Vertrag. Eine lebenslange Absicherung wird damit aufgegeben.</dd></div>
        <div><dt>Vererbbarkeit</dt><dd>Restkapital, Todesfallleistungen und mögliche Rückzahlung der Förderung hängen von Auszahlungsform und Vertragsbedingungen ab.</dd></div>
        <div><dt>Steuern</dt><dd>Auszahlungen und Todesfallfolgen sind steuerlich zu prüfen. Ein Steuervorteil wird hier nicht berechnet.</dd></div>
      </dl>
      {selection.payout === "check" && <p role="status"><strong>Nur zur Prüfung vorgemerkt.</strong> Keine Abwahl erklärt. Schriftliche Anbieterbedingungen und die Versorgung nach Ende des Plans vor jeder Entscheidung klären.</p>}
    </section>
    <section className="panel retirement-riester-comparison" ref={comparison} tabIndex={-1} aria-label="Qualitative Gegenüberstellung">
      <h2>Ihre qualitative Gegenüberstellung</h2><p role="status">{chosen.length} von 4 Strategien ausgewählt.{chosen.length < 2 ? " Bitte mindestens zwei Strategien auswählen." : " Vergleich ohne Wirtschaftlichkeitsbewertung."}</p>
      {chosen.length >= 2 && <div className="retirement-riester-table" role="region" aria-label="Strategien auf vier gemeinsamen Achsen" tabIndex={0}>
        <table><caption>Teilresultat: Gemeinsamkeiten, Unterschiede und offene Prüfungen</caption>
          <thead><tr><th scope="col">Prüfbereich</th>{chosen.map(s => <th scope="col" key={s.id}>Strategie {s.id}: {s.title}{s.id === 4 && <p>{variantText(selection.variant)}</p>}</th>)}</tr></thead>
          <tbody>{([["Eigenaufwand, Zulage und Steuerwirkung", "funding"], ["Vertragswert, Übertrag und Garantie mit Termin", "value"], ["Kapitalentwicklung und Marktrisiken", "market"], ["Auszahlform, Beginn und Langlebigkeit", "payout"], ["Voraussetzungen", "condition"], ["Mögliche Chancen", "opportunity"], ["Nachteile und Risiken", "risk"], ["Was fehlt für die Entscheidung?", "documents"]] as const).map(([title, key]) =>
            <tr key={key}><th scope="row">{title}</th>{chosen.map(s => <td key={s.id}>{s[key]}</td>)}</tr>)}</tbody>
        </table>
      </div>}
      <p><strong>Wirtschaftlicher Vergleich folgt, sobald Vertragswerte geprüft sind.</strong> Es werden weder Wechselgewinn noch Übertragungsbetrag, Rendite oder neue Garantie berechnet.</p>
      <p>Heutigen Vertragswert, Übertragungswert zum Stichtag und spätere garantierte Leistung mit Fälligkeit getrennt beschaffen. Die spätere Garantie abzüglich des heutigen Werts ist kein Wechselgewinn.</p>
    </section>
    <details className="retirement-help"><summary>Quellen und Grenzen der Strategieübersicht</summary>
      <p>Orientierungsstand 17.11.2026. Keine individuelle Rechts-, Steuer- oder Produktfreigabe. Bedingungen für Person, Beitragsjahr und konkreten Vertrag prüfen.</p>
      <ul>
        <li><a href="https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0052/0052_2027_01_01.html" target="_blank" rel="noreferrer">§ 52 Abs. 50a Sätze 6 bis 9 EStG: einheitliche Förderung ab 2027</a></li>
        <li><a href="https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Moeglichkeiten-der-Altersvorsorge/Altervorsorgereformgesetz" target="_blank" rel="noreferrer">Deutsche Rentenversicherung: Reform, Altverträge und Parallelverträge</a></li>
        <li><a href="https://www.bundesfinanzministerium.de/Content/DE/FAQ/reform-der-privaten-altersvorsorge.html" target="_blank" rel="noreferrer">Bundesfinanzministerium: Reform der privaten Altersvorsorge</a></li>
        <li><a href="https://www.union-investment.de/unsere-services/haeufige-fragen/haeufige-fragen/frage/Wie-funktioniert-die-Auszahlphase-bei-Union-Investment" target="_blank" rel="noreferrer">Union Investment: Auszahlphase und lebenslange Rentenkomponente</a></li>
      </ul>
    </details>
  </section>;
}
