import { useId, useMemo, useState } from "react";
import { MODEL_VERSIONS } from "../../domain/retirement/identity-contract";
import { editCustomerCapital, editMonthlyContribution, isCapitalConfirmation, metricCents, sameCapitalConfirmation, type ChangeCustomerPlan, type CustomerPlan } from "./customer-plan-adapter";
import { products, type ProductId } from "./product-finder-data";
import { RetirementChart, CapitalSeriesChart, customerScenarioNames } from "./retirement-chart";
import { projectionEuro, RetirementProjection, type ChangeCapitalDraft } from "./retirement-projection";
import { scenarioNames, type CapitalRun } from "./projection-adapter";
import { computeSavingsDemo, demoExamples, demoProductName, type DemoExample, type ProductModel } from "./retirement-model-demo";

export type CapitalView = "neutral" | ProductModel;
const conventions = {
  M1: "M1_additive_v1 · Die jährlichen Kostenpunkte mindern die gemeinsame Bruttorendite direkt.",
  M2: "M2_balance_factor_v1 · Der monatliche Kostenfaktor (1−k)^(1/12) wirkt auf den modellierten Bestand.",
};
const options = [
  { key: "neutral", label: "Neutrales Modell" },
  { key: "M1", label: "M1 · Kostenvergleich" },
  { key: "M2", label: "M2 · Anlageportfolio" },
] as const;

function NeutralCharts({ result }: { result: Extract<CapitalRun, { status: "responses" }> }) {
  const response = result.responses[0];
  const comparison = result.mode === "comparison";
  const models = scenarioNames.map((_, i) => comparison ? response.projectionResults[i * 2] : result.responses[i].projectionResults[0]);
  const reference = comparison ? scenarioNames.map((_, i) => response.projectionResults[i * 2 + 1]) : [];
  return <section className="retirement-capital-overview" aria-label="Ergebnis der neutralen Modellrechnung">
    <h2>Kapital zum gewählten Modellende</h2>
    {models[1] && metricCents(models[1].summary.totals.totalOwn) !== null && <p data-testid="customer-own">Eigene Einzahlungen: {projectionEuro(metricCents(models[1].summary.totals.totalOwn)!)}.</p>}
    <p>{models[1]?.valueBasis === "before_costs" ? "Bruttowerte · reale Kosten offen" : "Modellwerte nach hypothetischem Kostenabzug"}</p>
    <dl className="retirement-capital-metrics">{models.map((model, i) => {
      const value = model && metricCents(model.summary.specifiedEndBalance);
      return <div key={scenarioNames[i]}><dt>{customerScenarioNames[i]}</dt>
        <dd data-testid="customer-end-value">{value == null || model.status === "review_required" ? "Offen" : projectionEuro(value)}</dd>
        {model?.status === "partial" && <small>Teilszenario · weitere Zulagen offen</small>}</div>;
    })}</dl>
    <RetirementChart models={models} />
    {comparison && <><p>Die ETF-/Fondsreferenz verwendet dieselben Eigenzahlungen und Termine. Unterschiede bei Kostenbasis, Besteuerung und Verfügbarkeit bleiben zu berücksichtigen.</p>
      <RetirementChart models={reference} reference /></>}
  </section>;
}

function SyntheticModel({ mode }: { mode: ProductModel }) {
  const id = useId();
  const [example, setExample] = useState<DemoExample>("year");
  const [tariff, setTariff] = useState(0);
  const activeIndex = example === "year" ? tariff : 0;
  const demo = useMemo(() => computeSavingsDemo(mode, example, activeIndex), [mode, example, activeIndex]);
  const { snapshot, path, series, detail, opening } = demo;
  const costs = path?.cost;
  return <section className="panel retirement-demo" aria-label="Synthetische Modelldemonstration">
    <h2>Demonstrationsrechnung mit synthetischen Daten</h2>
    <p>Diese Zahlen gelten ausschließlich für künstliche Tarife und frei gesetzte S-Annahmen. Der persönliche Sparplan und reale Herstellerprodukte sind von dieser Rechnung getrennt.</p>
    <div className="retirement-capital-grid">
      <div><label htmlFor={`${id}-example`}>Welche Modellwirkung möchten Sie sehen?</label>
        <select id={`${id}-example`} value={example} onChange={e => {
          if (Object.hasOwn(demoExamples, e.target.value)) setExample(e.target.value as DemoExample);
        }}>
          <option value="year">{demoExamples.year}</option><option value="control">{demoExamples.control}</option>
          {mode === "M2" && <><option value="crash">{demoExamples.crash}</option><option value="rebalance">{demoExamples.rebalance}</option></>}
        </select></div>
      {example === "year" && <div><label htmlFor={`${id}-tariff`}>Künstlicher Tarif</label><select id={`${id}-tariff`} value={tariff} onChange={e => {
        const index = Number(e.target.value);
        if (Number.isInteger(index) && index >= 0 && index < 6) setTariff(index);
      }}>{Array.from({ length: 6 }, (_, i) => <option key={i} value={i}>{demoProductName(i)}</option>)}</select></div>}
    </div>
    <p><strong>{demoProductName(activeIndex)}</strong> · Bruttomarktannahmen · {mode === "M1" ? "K1-M1" : "K1-M2"} · {MODEL_VERSIONS[mode]}</p>
    <p>{conventions[mode]}</p>
    <p>M1 und M2 verwenden verschiedene Kostenformeln. Endwerte aus beiden Konventionen zeigen daher keinen Vorsprung eines Produkts.</p>
    {snapshot.ok && path?.status === "bedingt_berechnet" && costs?.class === "S" && series.length > 0 ? <>
      <dl className="retirement-capital-metrics">{series.map((points, i) => <div key={scenarioNames[i]}>
        <dt>{customerScenarioNames[i]}</dt><dd data-testid="demo-end">{projectionEuro(points.at(-1)!.cents)}</dd>
      </div>)}</dl>
      <CapitalSeriesChart series={series} title={`Kapitalverlauf · ${demoProductName(activeIndex)}`} />
      <details className="retirement-analysis-details"><summary>Berateransicht · Kosten, Anlagerisiko und Zahlungsfolge</summary>
        <p>Anfangsbestand {projectionEuro(opening)}. Hypothetische Jahreskosten {new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 2 }).format(costs.annual_ratio)}. Modellierte Einzahlungen erfolgen zum Monatsende.</p>
        <ul>{customerScenarioNames.map((name, i) => <li key={name}>{name} · {mode === "M1" ? "Bruttorendite" : "Aktienrendite"} {demo.equity[i] / 100} % p. a.
          {mode === "M2" && ` · Anleihen ${demo.bond[i] / 100} % p. a.`}
          {demo.gross?.[i] !== undefined && ` · Brutto-Endwert ${projectionEuro(demo.gross[i])}`}</li>)}</ul>
        {detail && <>
          <p>{example === "control" ? "Zielquote 100 % Aktien." : "Zielquote 60 % Aktien und 40 % Anleihen."} Jährlicher Ausgleich nach den Zahlungen in jedem zwölften Modellmonat. Separat gerundete Positionswerte können um Centbeträge vom Gesamtsaldo abweichen.</p>
          {example === "crash" && <p>Im Januar fällt der vorhandene Aktienanteil einmalig um 30 %. Die neue Januar-Rate fließt danach zu.</p>}
          <div className="retirement-chart-table"><table><caption>Mittleres Szenario · Original-Monatsabschluss</caption>
            <thead><tr><th scope="col">Monat</th><th scope="col">Zufluss</th><th scope="col">Kosten</th><th scope="col">Endwert</th><th scope="col">Positionen</th><th scope="col">Ausgleich</th></tr></thead>
            <tbody>{detail.map(row => <tr key={row.month}><th scope="row">{row.month}</th><td>{projectionEuro(row.inflow_cents)}</td>
              <td>{projectionEuro(row.cost_cents)}</td><td>{projectionEuro(row.closing_cents)}</td>
              <td>{row.positions.map(projectionEuro).join(" / ")}</td><td>{row.rebalanced ? "Ja" : "Keiner"}</td></tr>)}</tbody>
          </table></div>
        </>}
      </details>
      <details className="retirement-analysis-details"><summary>Katalog, Quelle und Rechenstand</summary>
        <p>Freigegebener synthetischer Anzeigekatalog <code>{snapshot.catalog_ref.id}</code> · Revision {snapshot.catalog_ref.revision} · {snapshot.as_of}.</p>
        <p>Produkt-ID <code>{path.product_ref.id}</code> · Tarif-ID <code>{path.tariff_ref.id}</code>.</p>
        <p>Kostenevidenz S · <code>{path.scenario_cost_ref?.id}</code> · Marktquelle <code>ux2-demo-scenarios</code>.</p>
        <p>Modell-Snapshot <code>{snapshot.snapshot_hash}</code>. Flüchtige Vorschau mit synthetischen Daten.</p>
      </details>
    </> : <p role="status">Diese Demonstration ist derzeit nicht berechenbar. {snapshot.ok ? path?.issue?.code : snapshot.issue.code}</p>}
  </section>;
}

export function RetirementCapital({ plan, change, result, calculate, stale, view, setView, selected }: {
  plan: CustomerPlan; change: ChangeCustomerPlan; result: CapitalRun | null;
  calculate: () => CapitalRun; stale: string | null; view: CapitalView; setView: (view: CapitalView) => void; selected: readonly ProductId[];
}) {
  const [demo, setDemo] = useState(false);
  const update: ChangeCapitalDraft = (edit, field) => change(current => {
    const capital = edit(current.capital);
    if (!isCapitalConfirmation(field)) {
      return field === "monthly" ? editMonthlyContribution(current, capital) : editCustomerCapital(current, capital);
    }
    if (capital[field] === current.capital[field]) return current;
    if (capital[field] && !sameCapitalConfirmation(current, plan, field))
      return current;
    return { ...current, capital: { ...capital, confirmed: field === "confirmed" && capital.confirmed } };
  });
  return <section className="retirement-capital-flow">
    <div className="retirement-capital-modes" role="group" aria-label="Kapitalmodell">
      {options.map(option => <button key={option.key} aria-pressed={option.key === view} onClick={() => { setView(option.key); setDemo(false); }}>{option.label}</button>)}
    </div>
    {stale && view === "neutral" && <p className="retirement-notice" role="status">{stale}</p>}
    {view === "neutral" ? <section className="panel retirement-neutral">
      <RetirementProjection draft={plan.capital} change={update} result={result} annualPlan={Boolean(plan.contribution)}
        calculate={calculate}
        chart={result?.status === "responses" && <NeutralCharts result={result} />} />
    </section> : <>
      <section className="panel retirement-model-blocked" aria-label="Herstellerrechnung">
        <p className="retirement-state" data-testid="model-blocked">Nicht berechenbar · Kosten offen (O)</p>
        <h2>{view === "M1" ? "Kostenvergleich mit gemeinsamer Bruttobasis" : "Anlageportfolio im Monatsmodell"}</h2>
        <p>Version {MODEL_VERSIONS[view]} · {view === "M1" ? "K1-M1" : "K1-M2"}. {conventions[view]}</p>
        <p>Für alle sechs Herstelleralternativen fehlen verifiziert freigegebene Tarif- und Kostendaten im P1-Anzeigekanal{view === "M2" ? " sowie ein freigegebenes Anlageprofil je Tarif" : ""}. Die öffentlichen Ausgaberechte sind offen (ORG-O01). Die interne Berechnung und die öffentliche Ausgabe werden getrennt geprüft.</p>
        {selected.length > 0 && <p>Ihre qualitative Auswahl: {products.filter(product => selected.includes(product.id)).map(product => product.name).join(", ")}.</p>}
        <button className="secondary" aria-expanded={demo} onClick={() => setDemo(value => !value)}>{demo ? "Synthetische Demonstration schließen" : "Synthetische Demonstration öffnen"}</button>
      </section>
      {demo && <SyntheticModel key={view} mode={view} />}
    </>}
  </section>;
}
