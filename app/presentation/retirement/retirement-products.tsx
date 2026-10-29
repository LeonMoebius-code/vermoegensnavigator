/** Qualitative manufacturer announcement, checked 2026-10-29; never engine data. */
export const productSource = "https://www.union-investment.de/familien-und-altersvorsorge/fuers-alter-vorsorgen/altersvorsorgedepot";
const products = [
  { id: "basis", name: "UniVorsorge Basis", profile: "ETF-orientierter Kapitalmarktansatz.", strategy: "Globale Aktien und Renten mit wählbarer Aufteilung.",
    guarantee: "Keine Beitragsgarantie laut öffentlicher Ankündigung.", lifecycle: "Absenkung der Aktienquote vor Rentenbeginn angekündigt; genaue Vertragsbedingungen weiter prüfen." },
  { id: "pro", name: "UniVorsorge Pro", profile: "Aktive, globale und aktienbetonte Anlage.", strategy: "Aktiv verwaltetes weltweites Aktienportfolio.",
    guarantee: "Keine Beitragsgarantie. Ein behaupteter 80-%-Wertschutz ist hier nicht belegt.", lifecycle: "Ablaufmanagement angekündigt; genaue Sicherungs- und Steuerungsregeln noch nicht hinreichend bestätigt." },
  { id: "garantie", name: "UniVorsorge Garantie", profile: "Garantieorientierte Produktlinie mit Kapitalmarktanteil.", strategy: "Weltweites Aktien- und Rentenportfolio.",
    guarantee: "Angekündigt: 100 % der Beiträge und Zulagen zum Ende der Ansparphase. Tarifbedingungen und Stichtag weiter prüfen.", lifecycle: "Konkrete Sicherungsmechanik noch nicht hinreichend bestätigt; hier nicht nachgebildet." },
] as const;
export function RetirementProducts({ selected, change }: { selected: readonly string[]; change: (ids: string[]) => void }) {
  const card = (p: typeof products[number], detail: boolean) => <section key={p.id} className="panel retirement-product" data-testid={`product-${detail ? "detail-" : ""}${p.id}`}>
    {detail ? <h3>{p.name}</h3> : <h2>{p.name}</h2>}
    <p className="retirement-source-status">Öffentlich angekündigt · Tarifdetails offen</p>
    <dl><dt>Beratungsprofil</dt><dd>{p.profile}</dd><dt>Anlagestrategie</dt><dd>{p.strategy}</dd>
      <dt>Beitragsgarantie</dt><dd>{p.guarantee}</dd><dt>Sicherung und Ablauf</dt><dd>{p.lifecycle}</dd>
      <dt>Kosten</dt><dd>Kosten noch nicht belastbar. Keine freigegebene vollständige Tarifkostenbasis.</dd></dl>
    <p><a href={productSource} target="_blank" rel="noreferrer">Öffentliche Herstellerankündigung</a> · geprüft am 29.10.2026.
      Keine individuelle Vertragszusage, vollständige Fondsliste oder garantierte Rentenzahl.</p>
    {!detail && <label className="retirement-checkbox"><input type="checkbox" checked={selected.includes(p.id)}
      disabled={selected.length >= 2 && !selected.includes(p.id)}
      onChange={e => change(e.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id))} />{p.name} für Detailvergleich auswählen</label>}
  </section>;
  return <div className="retirement-products">
    <p className="retirement-notice"><strong>Qualitativer Vergleich geplanter Produktlinien.</strong> Keine Empfehlung oder Geeignetheitsfeststellung.
      Herstellerankündigungen ersetzen keinen geprüften Tarif. Die Auswahl verändert keine A4-Rendite, Kostenannahme oder Garantie.</p>
    <div className="retirement-product-grid">{products.map(p => card(p, false))}</div>
    <p role="status">{selected.length} von höchstens 2 Linien für die qualitative Detailgegenüberstellung gewählt.</p>
    {selected.length === 2 && <section aria-label="Qualitative Detailgegenüberstellung"><h2>Zwei Linien im Detail</h2>
      <div className="retirement-comparison">{products.filter(p => selected.includes(p.id)).map(p => card(p, true))}</div></section>}
    <details className="retirement-help"><summary>Garantie, Kosten und Modellgrenzen</summary>
      <p>Eine Beitragsgarantie betrifft nur die konkret zugesagten Beträge und den vertraglichen Stichtag. Sie ist kein jederzeitiger Kapitalboden.
        Kostenmaße sind nicht pauschal vergleichbar. A4 verwendet bis AP-03b ausschließlich explizite neutrale Marktannahmen, keine Produktsimulation.</p>
    </details>
  </div>;
}
