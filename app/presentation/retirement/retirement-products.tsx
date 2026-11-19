import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  comparisonLimit, costLabel, featureLabels, payoutLabels, preferenceMatches, productFinderSourceDate,
  productPayoutSource, productQuestions, products, productSources, type ProductAnswers, type ProductId,
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
      {label === "Auszahlung" && unionCombinationMissing && <>. Die Kombination fehlt. Union bietet hier einen Fondsauszahlplan an.</>}
    </li>)}
  </ul>;
}

function ProductCard({ product, answers, checked, countId, toggle }: {
  product: Product; answers: ProductAnswers; checked: boolean; countId: string; toggle: () => void;
}) {
  return <article className="panel retirement-product" data-testid={`product-${product.id}`}>
    <p className="eyebrow">{product.provider}</p>
    <h3>{product.name}</h3>
    <p>{product.investment}</p>
    <dl>
      <dt>Schutz zum Ablauf</dt><dd><Protection product={product} /></dd>
      <dt>Auszahlungsarten</dt><dd><Payouts product={product} /></dd>
      <dt>Kosten</dt><dd>{costLabel(product.costs)}</dd>
      <dt>Hersteller- und Datenstand</dt><dd>{product.manufacturerStatus}</dd>
      <dt>Bankverfügbarkeit und Beratung</dt><dd>{product.bankStatus}</dd>
    </dl>
    <details className="retirement-help">
      <summary>Tarifdetails und Quellen zu {product.name}</summary>
      <p>{product.investmentDetails}</p>
      <dl>
        <dt>Tarifgrenzen</dt><dd>{product.limits}</dd>
        <dt>Vorteil</dt><dd>{product.benefit}</dd>
        <dt>Grenze oder Risiko</dt><dd>{product.risk}</dd>
        <dt>Abgleich mit Ihren Wünschen</dt><dd><Preferences product={product} answers={answers} /></dd>
      </dl>
      <Sources product={product} />
    </details>
    <label className="retirement-checkbox">
      <input type="checkbox" checked={checked} aria-describedby={countId} onChange={toggle} />
      {product.name} für Detailvergleich auswählen
    </label>
  </article>;
}

const comparisonRows: readonly { title: string; content: (product: Product, answers: ProductAnswers) => ReactNode }[] = [
  { title: "Anlage und ETF-Auswahl", content: product => <>
    <p>{product.investment} {product.investmentDetails}</p>
    <p>Eigene ETF-Auswahl: <strong>{featureLabels[product.etf]}</strong>.</p>
  </> },
  { title: "Schutz zum Ablauf", content: product => <Protection product={product} /> },
  { title: "Auszahlungsarten", content: product => <Payouts product={product} /> },
  { title: "Kosten und Datenstand", content: product => <>
    <p>{costLabel(product.costs)}</p>
    <p>Hersteller- und Datenstand: {product.manufacturerStatus}. Bankverfügbarkeit und Beratung: {product.bankStatus}.</p>
    <Sources product={product} />
  </> },
  { title: "Tarifgrenzen", content: product => product.limits },
  { title: "Vorteile und Risiken", content: product => <><p>{product.benefit}</p><p>{product.risk}</p></> },
  { title: "Abgleich mit Ihren Wünschen", content: (product, answers) => <Preferences product={product} answers={answers} /> },
];

function ProductComparison({ selected, answers, toggle }: {
  selected: readonly Product[]; answers: ProductAnswers; toggle: (product: Product) => void;
}) {
  return <div className="retirement-product-matrix" data-columns={selected.length}>
    <ul className="retirement-product-columns retirement-product-selection" aria-label="Gewählte Alternativen">
      {selected.map(product => <li key={product.id}>
        <strong>{product.name}</strong>
        <button aria-label={`${product.name} abwählen`} onClick={() => toggle(product)}>Abwählen</button>
      </li>)}
    </ul>
    {selected.length >= 2 && comparisonRows.map(row => <section key={row.title} className="retirement-product-row">
      <h3>{row.title}</h3>
      <dl className="retirement-product-columns">
        {selected.map(product => <div key={product.id}>
          <dt>{product.name}</dt><dd>{row.content(product, answers)}</dd>
        </div>)}
      </dl>
    </section>)}
  </div>;
}

export function RetirementProducts({ selected, toggleSelection, answers, changeAnswers, step, navigate }: {
  selected: readonly ProductId[];
  toggleSelection: (id: ProductId) => boolean;
  answers: ProductAnswers;
  changeAnswers: (answers: ProductAnswers) => void;
  step: ProductFinderStep;
  navigate: (step: ProductFinderStep) => void;
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
    <p className="retirement-notice">Der Produktfinder dient der Orientierung. Produktberatung, Kundenfall und Export sind für diese Vorschau nicht freigegeben. A4 verwendet eigenständige neutrale Modellannahmen.</p>
    {question && typeof step === "number" ? <section className="panel retirement-product-question">
      <p>Orientierung · Frage {step + 1} von {productQuestions.length}</p>
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
      </div>
    </section> : <>
      <section aria-labelledby={`${prefix}-products`}>
        <h2 ref={heading} tabIndex={-1} id={`${prefix}-products`}>{step === "comparison" ? "Qualitative Detailgegenüberstellung" : "Sechs Produktalternativen"}</h2>
        <div className="retirement-product-actions">
          {step === "comparison"
            ? <button onClick={() => move("cards")}>Zurück zu den Produktkarten</button>
            : <>
              <button onClick={() => move(0)}>Orientierung ändern</button>
            </>}
        </div>
        {step === "cards" && <dl className="retirement-product-answers">
          {productQuestions.map(item => <div key={item.key}><dt>{item.title}</dt>
            <dd>{item.options.find(([value]) => value === answers[item.key])?.[1] ?? "Keine Präferenz angegeben"}</dd></div>)}
        </dl>}
        <div className={step === "cards" ? "retirement-product-toolbar" : undefined}>
          <p id={countId} role="status" aria-atomic="true">{countText}{refused && ` ${refused}`}</p>
          {step === "cards" && <button className="primary" disabled={selected.length < 2} aria-describedby={countId}
            onClick={() => move("comparison")}>Direktvergleich öffnen</button>}
        </div>
        {step === "comparison" ? <ProductComparison selected={selectedProducts} answers={answers} toggle={toggle} />
          : <>
            <div className="retirement-product-grid">{products.map(product => <ProductCard key={product.id}
              product={product} answers={answers} checked={selected.includes(product.id)} countId={countId} toggle={() => toggle(product)} />)}</div>
            <div className="retirement-product-actions">
              <button className="primary" disabled={selected.length < 2} aria-describedby={countId}
                onClick={() => move("comparison")}>Auswahl vergleichen</button>
            </div>
          </>}
      </section>
    </>}
  </div>;
}
