import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  comparisonLimit, costLabel, featureLabels, payoutLabels, preferenceMatches, productFinderSourceDate,
  productPayoutSource, productQuestions, products, productSources, sharedComparisonFacts, type SharedComparisonFact, type ProductAnswers, type ProductId,
} from "./product-finder-data";

type Product = typeof products[number];
export type ProductFinderStep = 0 | 1 | 2 | "cards" | "comparison";

function Protection({ product }: { product: Product }) {
  const { basis, date, commitment } = product.protection;
  return <>{commitment} Bezugsgröße: {basis}. Stichtag: {date}.</>;
}

function Payouts({ product }: { product: Product }) {
  const source = productPayoutSource(product);
  return <>
    <ul className="retirement-product-facts">
      <li>Lebenslange Rente: <strong>{payoutLabels[product.annuity.status]}</strong>. {product.annuity.description}</li>
      <li>{product.plan.kind === "fund" ? "Fondsauszahlplan" : "Auszahlplan"}: <strong>{payoutLabels[product.plan.status]}</strong>. {product.plan.description}</li>
    </ul>
    <a href={source.url}>Herstellerquelle zur Auszahlung</a>
  </>;
}

function Sources({ product }: { product: Product }) {
  return <>
    <p>Quellen geprüft und fachlich eingeordnet am <time dateTime={productFinderSourceDate}>{productFinderSourceDate.split("-").reverse().join(".")}</time>.</p>
    <ul className="retirement-product-facts">
      {productSources(product).map(source => <li key={source.url}><a href={source.url}>{source.label}</a></li>)}
    </ul>
  </>;
}

function Preferences({ product, answers }: { product: Product; answers: ProductAnswers }) {
  const matches = preferenceMatches(product, answers);
  const rows = [
    ["Schutz", matches.protection],
    ["Anlageentscheidung", matches.investment],
    ["Auszahlung", matches.payout],
  ] as const;
  const unionCombinationMissing = answers.payout === "both" && product.annuity.status === "absent" && product.plan.kind === "fund";
  return <ul className="retirement-product-facts">
    {rows.map(([label, match]) => <li key={label}>{label}: <strong>{match ? featureLabels[match] : "Keine Präferenz angegeben"}</strong>
      {label === "Auszahlung" && unionCombinationMissing && <>. Die Kombination fehlt. Union bietet hier einen Fondsauszahlplan an. Das Vergleichsinteresse schließt dieses Produkt nicht aus.</>}
    </li>)}
  </ul>;
}

const investmentHeadlines: Record<ProductId, string> = {
  basis: "Lebenszyklus mit zwei aktiven ETFs",
  pro: "Globaler Aktienfonds",
  garantie: "Aktien und Anleihen mit Sicherungsmechanismus",
  "ruv-standard": "Zwei vorgegebene ETFs",
  "ruv-individuell": "Eigene ETF-Auswahl oder Komfortportfolio",
  "ruv-garantie-80": "Sicherungsvermögen und ETF-Teil",
};

function ProtectionSummary({ product }: { product: Product }) {
  const protection = product.protection;
  if (protection.kind === "none") return <>Keine Beitragsgarantie angekündigt</>;
  if (protection.kind === "target") return <><strong>80 % Wertsicherungsziel</strong><small>Bezugsbasis: Beginn der Stabilisierungsphase · keine Beitragsgarantie</small></>;
  if (protection.kind === "guarantee") return <><strong>{protection.level} % Beiträge und Zulagen</strong><small>Angekündigt zum Auszahlbeginn</small></>;
  return <>Schutz offen</>;
}

function ProductDetails({ product, answers }: { product: Product; answers: ProductAnswers }) {
  return <div className="avd-product-detail-body">
    <p>{product.investment} {product.investmentDetails}</p>
    <p><Protection product={product} /></p>
    <dl className="avd-product-source">
      <div><dt>Hersteller- und Datenstand</dt><dd>{product.manufacturerStatus}</dd></div>
      <div><dt>Bankverfügbarkeit und Beratung</dt><dd>{product.bankStatus}</dd></div>
      <div><dt>Kosten</dt><dd>{costLabel(product.costs)}</dd></div>
    </dl>
    <dl>
      <dt>Auszahlungsarten</dt><dd><Payouts product={product} /></dd>
      <dt>Tarifgrenzen</dt><dd>{product.limits}</dd>
      <dt>Vorteil</dt><dd>{product.benefit}</dd>
      <dt>Grenze oder Risiko</dt><dd>{product.risk}</dd>
      <dt>Abgleich mit Ihren Wünschen</dt><dd><Preferences product={product} answers={answers} /></dd>
    </dl>
    <Sources product={product} />
  </div>;
}

function ProductCard({ product, answers, checked, countId, toggle }: {
  product: Product; answers: ProductAnswers; checked: boolean; countId: string; toggle: () => void;
}) {
  const payout = product.annuity.status === "absent" ? "Fondsauszahlplan" : "Rente oder Auszahlplan";
  return <article className="retirement-product avd-product-row" data-testid={`product-${product.id}`}>
    <div className="avd-product-identity"><p>{product.provider}</p><h3>{product.name}</h3></div>
    <div className="avd-product-fact"><span>Anlage</span><strong>{investmentHeadlines[product.id]}</strong></div>
    <div className="avd-product-fact"><span>Schutz</span><ProtectionSummary product={product} /></div>
    <div className="avd-product-fact"><span>Auszahlung</span>{payout}</div>
    <div className="avd-product-pick">
      <label className="retirement-checkbox">
        <input type="checkbox" checked={checked} aria-describedby={countId} onChange={toggle}
          aria-label={product.name + " für Detailvergleich auswählen"} /><span className="avd-visually-compact">{product.name} für Detailvergleich auswählen</span>
      </label>

    </div>
    <details className="retirement-help avd-product-detail">
      <summary aria-label={`Tarifdetails und Quellen zu ${product.name}`}>Details</summary>
      <ProductDetails product={product} answers={answers} />
    </details>
  </article>;
}

function CompareProtection({ product }: { product: Product }) {
  const protection = product.protection;
  if (protection.kind === "target") return <>
    <strong>Wertsicherungsziel</strong>
    <small>{protection.basis} · zum Ende der Ansparphase</small>
    <small>Keine Beitragsgarantie · Ziel kann unterschritten werden</small>
  </>;
  return <>
    <ProtectionSummary product={product} />
    {protection.kind === "guarantee" && <small>{protection.level === 80 ? "Kein garantierter Depotwert während der Laufzeit" : "Endgültige Vertragsbedingungen maßgeblich"}</small>}
  </>;
}

function ComparePayout({ product }: { product: Product }) {
  return <>
    <strong>{product.plan.kind === "fund" ? "Fondsauszahlplan" : "Auszahlplan"}: {payoutLabels[product.plan.status]}</strong>
    <small>Lebenslange Rente: {payoutLabels[product.annuity.status]}</small>
    <small>{product.plan.kind === "fund" ? "Keine Übertragung an einen Versicherer zum Auszahlbeginn" : "Rentenhöhe und Fondsmechanik offen"}</small>
    <details className="avd-compare-payout-detail">
      <summary>Auszahlungsdetails und Quelle</summary>
      <Payouts product={product} />
    </details>
  </>;
}

const comparisonRows: readonly { title: string; sharedFact?: SharedComparisonFact; content: (product: Product, answers: ProductAnswers) => ReactNode }[] = [
  { title: "Anlage und ETF-Auswahl", content: product => <>
    <strong>{investmentHeadlines[product.id]}</strong>
    <small>Eigene ETF-Auswahl: {featureLabels[product.etf]}</small>
  </> },
  { title: "Schutz zum Ablauf", sharedFact: "no_announced_contribution_guarantee", content: product => <CompareProtection product={product} /> },
  { title: "Auszahlungsarten", sharedFact: "union_fund_payout_without_annuity", content: product => <ComparePayout product={product} /> },
  { title: "Kosten und Datenstand", content: product => <>
    <strong>Tarifkosten öffentlich offen</strong>
    <small>Bankverfügbarkeit: {product.bankStatus.toLocaleLowerCase("de-DE")}</small>
  </> },
  { title: "Tarifgrenzen", content: product => product.limits },
  { title: "Vorteile und Risiken", content: product => <><p>{product.benefit}</p><p>{product.risk}</p></> },
  { title: "Abgleich mit Ihren Wünschen", content: (product, answers) => <Preferences product={product} answers={answers} /> },
];

function ProductComparison({ selected, answers, toggle }: {
  selected: readonly Product[]; answers: ProductAnswers; toggle: (product: Product) => void;
}) {
  const [differences, setDifferences] = useState(false);
  const sharedFacts = sharedComparisonFacts(selected);
  const rows = differences ? comparisonRows.filter(row => !row.sharedFact || !sharedFacts.includes(row.sharedFact)) : comparisonRows;
  return <div className="retirement-product-matrix avd-direct-compare" data-columns={selected.length}>
    <label className="retirement-checkbox avd-difference-toggle"><input type="checkbox" checked={differences}
      onChange={e => setDifferences(e.target.checked)} />Nur Unterschiede anzeigen</label>
    <ul className="retirement-product-columns retirement-product-selection" aria-label="Gewählte Alternativen">
      {selected.map(product => <li key={product.id}>
        <strong>{product.name}</strong>
        <button aria-label={`${product.name} abwählen`} onClick={() => toggle(product)}>Abwählen</button>
      </li>)}
    </ul>
    {selected.length >= 2 && <>
      <h3 className="avd-compare-section avd-visually-compact">Tarifmerkmale und offene Punkte</h3>
      {rows.map(row => <section key={row.title} className="retirement-product-row">
        <h3>{row.title}</h3>
        <dl className="retirement-product-columns">
          {selected.map(product => <div key={product.id}>
            <dt>{product.name}</dt><dd>{row.content(product, answers)}</dd>
          </div>)}
        </dl>
      </section>)}
      <section className="avd-shared-facts"><h3>Gemeinsame belegte Rahmenbedingungen</h3>
        <ul><li>Alle gewählten Produkte sind öffentlich angekündigt.</li>
        {sharedFacts.includes("no_announced_contribution_guarantee") && <li>Für alle gewählten Produkte ist zum Auszahlbeginn keine Beitragsgarantie angekündigt.</li>}
        {sharedFacts.includes("union_fund_payout_without_annuity") && <li>Für alle gewählten Union-Produkte ist der Fondsauszahlplan angekündigt. Eine lebenslange Rente bietet Union für diese Produkte nicht an.</li>}</ul>
        {differences && <p>Offene Tarif-, Kosten- und Bankangaben bleiben sichtbar.</p>}
      </section>
      <div className="retirement-product-columns avd-compare-sources">
        {selected.map(product => <details className="retirement-help" key={product.id}>
          <summary>Tarifdetails und Quellen · {product.name}</summary>
          <ProductDetails product={product} answers={answers} />
        </details>)}
      </div>
    </>}
  </div>;
}

export function RetirementProducts({ selected, toggleSelection, answers, changeAnswers, step, navigate, next }: {
  selected: readonly ProductId[];
  toggleSelection: (id: ProductId) => boolean;
  answers: ProductAnswers;
  changeAnswers: (answers: ProductAnswers) => void;
  step: ProductFinderStep;
  navigate: (step: ProductFinderStep) => void;
  next: () => void;
}) {
  const prefix = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const moveFocus = useRef(false);
  const [refused, setRefused] = useState("");
  const question = typeof step === "number" ? productQuestions[step] : null;
  const countId = `${prefix}-count`;
  const selectedProducts = products.filter(product => selected.includes(product.id));
  useEffect(() => {
    if (moveFocus.current) {
      heading.current?.focus();
      moveFocus.current = false;
    }
  }, [step]);

  function move(next: ProductFinderStep) {
    moveFocus.current = true;
    setRefused("");
    navigate(next);
  }

  function toggle(product: Product) {
    if (!toggleSelection(product.id)) {
      setRefused(`${product.name} wurde nicht ausgewählt. Wählen Sie zuerst eine der drei Alternativen ab.`);
      return;
    }
    // The focused control disappears after removing a column.
    if (step === "comparison") heading.current?.focus();
    setRefused("");
  }

  const countText = `${selected.length} von höchstens ${comparisonLimit} Alternativen gewählt. Für den Direktvergleich sind mindestens zwei nötig.`;

  return <div className="retirement-products">

    {question && typeof step === "number" ? <section className="panel retirement-product-question">
      <p className="avd-kicker">Ihre Wünsche · {step + 1} von {productQuestions.length}</p>
      <h2 ref={heading} tabIndex={-1} id={`${prefix}-question`}>{question.title}</h2>
      <fieldset aria-labelledby={`${prefix}-question`}>
        {question.options.map(([value, label]) => <label key={value} className="retirement-checkbox">
          <input type="radio" name={`${prefix}-${question.key}`} value={value} checked={answers[question.key] === value}
            onChange={() => changeAnswers({ ...answers, [question.key]: value })} />
          {label}
        </label>)}
      </fieldset>
      <div className="retirement-product-actions">
        {step > 0 && <button onClick={() => move(step === 2 ? 1 : 0)}>Zurück</button>}
        {step < 2
          ? <button className="primary" onClick={() => move(step === 0 ? 1 : 2)}>Weiter</button>
          : <button className="primary" onClick={() => move("cards")}>Produkte anzeigen</button>}
        {step < 2 && <button className="secondary" onClick={() => move("cards")}>Alle Produkte ansehen</button>}
      </div>
    </section> : <>
      <section aria-labelledby={`${prefix}-products`}>
        <div className="avd-product-header">
          <h2 ref={heading} tabIndex={-1} id={`${prefix}-products`}>{step === "comparison" ? "Qualitative Detailgegenüberstellung" : "Sechs Produktalternativen"}</h2>
          <div className="retirement-product-actions">
          {step === "comparison"
            ? <button onClick={() => move("cards")}>Zurück zu den Produktkarten</button>
            : <>
              <button onClick={() => move(0)}>Orientierung ändern</button>
            </>}
          </div>
        </div>
        <div className="avd-product-command">
        {step === "cards" && <details className="retirement-help avd-product-wishes"><summary>Ihre angegebenen Wünsche</summary><dl className="retirement-product-answers">
          {productQuestions.map(item => <div key={item.key}><dt>{item.title}</dt>
            <dd>{item.options.find(([value]) => value === answers[item.key])?.[1] ?? "Keine Präferenz angegeben"}</dd></div>)}
        </dl></details>}
        <div className={step === "cards" ? "retirement-product-toolbar" : undefined}>
          <p id={countId} role="status" aria-atomic="true">{countText}{refused && ` ${refused}`}</p>
          {step === "cards" && <button className="primary" disabled={selected.length < 2} aria-describedby={countId}
            onClick={() => move("comparison")}>Direktvergleich öffnen</button>}
        </div>
        </div>
        {step === "comparison" ? <ProductComparison selected={selectedProducts} answers={answers} toggle={toggle} />
          : <div className="avd-product-sheet">
            <p className="avd-market-status"><strong>Herstellerstand</strong> Alle sechs öffentlich angekündigt <span>Bankweg unbestätigt · Tarifkosten öffentlich offen</span></p>
            <div className="avd-product-column-headings" aria-hidden="true"><span>Produkt</span><span>Anlage</span><span>Schutz zum Ablauf</span><span>Auszahlung</span><span>Auswahl</span></div>
            <div className="retirement-product-grid avd-product-overview">{products.map(product => <ProductCard key={product.id}
              product={product} answers={answers} checked={selected.includes(product.id)} countId={countId} toggle={() => toggle(product)} />)}</div>
          </div>}
        <div className="retirement-product-actions"><button className="primary" onClick={next}>Weiter zur Kapitalentwicklung</button></div>
      </section>
    </>}
  </div>;
}
