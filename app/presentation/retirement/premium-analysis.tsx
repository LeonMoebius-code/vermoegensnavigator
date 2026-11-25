import { useId, useState, type ReactNode } from "react";
import { monthIndex } from "../../domain/retirement/premium-calendar";
import { euros, signedOutputCents } from "../../domain/retirement/model-decimal";
import { deflatorFor } from "../../domain/retirement/premium-price";
import { productStressDifference } from "../../domain/retirement/premium-series";
import type { Snapshot, Subresult } from "../../domain/retirement/premium-session";
import { products, type ProductId } from "./product-finder-data";
import { parseStressLoss, productPathKey, type PremiumProductPath, type ProductConfiguration, type ProductDraft } from "./premium-product-configuration";
import { chartMoney, monthLabel, PremiumChart, type ChartSeries } from "./premium-chart";

export const analyses = [
  { id: "capital", label: "Kapitalentwicklung" },
  { id: "stress", label: "Dynamischer Stresstest" },
  { id: "comparison", label: "Wirtschaftlicher Vergleich" },
] as const;
export type Analysis = typeof analyses[number]["id"];
type Result = Subresult & { readonly curveId: string };
type Curve = Extract<Subresult["result"], { status: "computed" }>["value"];
const navy = "#06366c", blue = "#207bb9", teal = "#00776d", orange = "#b84e13", purple = "#76499c", red = "#9e2448";
const colors = [navy, teal, purple];
const pct = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 2 }) + " %";
const cents = (value: number | null | undefined) => value == null ? "Offen" : chartMoney(value);
const endValue = (curve: Curve | undefined) => curve?.complete && curve.end.status === "computed" ? curve.end.cents : null;
const values = (curve: Curve) => curve.rows.map(row => row.balance.status === "computed" ? row.balance.cents : null);
const curveOf = (item: Subresult | undefined) => item?.result.status === "computed" ? item.result.value : undefined;

function Metric({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return <div className="avd-metric"><dt>{label}</dt><dd>{value}</dd>{detail && <dd className="avd-metric-detail">{detail}</dd>}</div>;
}

export function priceValue(curve: Curve, amount: number, month: string) {
  return curve.price ? signedOutputCents(deflatorFor(curve.price)(euros(amount), month), month) : amount;
}

function basisLabel(curve: Curve) {
  return curve.price ? `Kaufkraft in Preisen von ${monthLabel(curve.price.referenceMonth)} · ${pct(curve.price.inflation.bps / 100)} Inflation p. a.`
    : "Nominale Eurobeträge";
}

function openNotice(reason?: string) {
  switch (reason) {
    case "PRODUCT_PROFILE_OPEN": return "Ein gültiges Anlageprofil fehlt.";
    case "INVALID_WEIGHTS": return "Die Anlagegewichte müssen zusammen 100 % ergeben.";
    case "STRESS_LOSS_INVALID": return "Bitte einen Aktienmarktverlust von 0 bis −100 % eingeben.";
    case "STRESS_MONTH_OPEN":
    case "INVALID_MONTH": return "Bitte einen Ereignismonat im Bewertungszeitraum eingeben.";
    case "EXPOSURE_OPEN": return "Die Aktienexponierung im Ereignismonat ist unbelegt.";
    case "UNTERDECKUNG": return "Im Zahlungsplan kann ein Abgang nicht gedeckt werden.";
    case "FUNDING_SELECTION_OPEN": return "Förderzuflüsse und Vertragszuordnung sind noch zu klären.";
    default: return "Ein vollständiger Wert ist offen. Bitte Plan, Tarifdaten und Nachweise prüfen.";
  }
}

function Capital({ results }: { results: readonly Result[] }) {
  const [offset, setOffset] = useState(0);
  if (!results.length) return null;
  const neutral = results.map(curveOf).filter(c => c?.modelMode === "NEUTRAL");
  const primary = neutral[0];
  const scenarios = neutral.filter(c => c!.fundingPerspective === primary?.fundingPerspective);
  const active = scenarios.find(c => Number(c!.curveId.split(":").at(-1)) === offset) ?? primary;
  if (!active) return <p className="avd-open" role="status">{openNotice(results[0]?.result.status === "O" ? results[0].result.reason : undefined)}</p>;
  const row = active.rows.at(-1)!;
  const end = endValue(active);
  const opening = priceValue(active, active.openingCents, active.rows[0].month);
  const partial = active.specifiedEnd.status === "computed" ? active.specifiedEnd.cents : null;
  const growth = partial === null ? null : partial - opening - row.ownCents - row.grantCents;
  const build = [
    { label: "Anfangsbestand", value: opening, color: "#4e5590" },
    { label: "Eigenbeiträge", value: row.ownCents, color: navy },
    { label: "Zulagen im Modell", value: row.grantCents, color: blue },
    { label: "Wertentwicklung", value: growth, color: growth !== null && growth < 0 ? red : teal },
  ];
  const extent = Math.max(1, ...build.map(item => Math.abs(item.value ?? 0)));
  const inputParts = active.rows.map(r => {
    if (r.balance.status !== "computed") return null;
    const principal = opening + r.ownCents;
    return { principal, funded: principal + r.grantCents, end: r.balance.cents, own: r.ownCents, grant: r.grantCents };
  });
  const funded = active.fundingPerspective !== "OHNE_ZULAGEN";
  const chart: ChartSeries[] = [
    { label: "Anfangsbestand", color: "#4e5590", values: inputParts.map(r => r ? opening : null),
      band: { from: inputParts.map(r => r ? 0 : null), to: inputParts.map(r => r ? opening : null) } },
    { label: "Eigenbeiträge", color: blue, values: inputParts.map(r => r?.own ?? null),
      band: { from: inputParts.map(r => r ? opening : null), to: inputParts.map(r => r?.principal ?? null) } },
    ...(funded ? [{ label: "Zulagen im Modell", color: purple, values: inputParts.map(r => r?.grant ?? null),
      band: { from: inputParts.map(r => r?.principal ?? null), to: inputParts.map(r => r?.funded ?? null) } }] : []),
    { label: "Wertentwicklung positiv", color: teal,
      values: inputParts.map(r => r ? Math.max(0, r.end - r.funded) : null),
      band: { from: inputParts.map(r => r?.funded ?? null), to: inputParts.map(r => r ? Math.max(r.funded, r.end) : null) } },
    { label: "Wertentwicklung negativ", color: red,
      values: inputParts.map(r => r ? Math.min(0, r.end - r.funded) : null),
      band: { from: inputParts.map(r => r?.funded ?? null), to: inputParts.map(r => r ? Math.min(r.funded, r.end) : null) } },
  ];
  // Keep one series per funding perspective and a separate ETF gross reference.
  for (const [i, c] of scenarios.entries()) {
    if (!c) continue;
    const chosen = c === active;
    chart.push({ label: pct(Number(c.marketBasis) / 100) + (chosen ? " · gewählt" : ""), color: chosen ? navy : [blue, teal, purple][i],
      values: values(c), dashed: !chosen });
  }
  for (const c of results.map(curveOf)) {
    if (!c || Number(c.curveId.split(":").at(-1)) !== offset) continue;
    if (c.modelMode === "ETF_BRUTTO") chart.push({ label: "ETF-Bruttoreferenz", color: orange, dashed: true, values: values(c) });
    if (c.modelMode === "NEUTRAL" && c.fundingPerspective !== active.fundingPerspective) chart.push({
      label: c.fundingPerspective === "NUR_BELEGTE_HISTORIE" ? "Belegte Förderbuchungen" : "Ohne Zulagen",
      color: c.fundingPerspective === "NUR_BELEGTE_HISTORIE" ? teal : purple, dashed: true, values: values(c),
    });
  }
  return <>
    <div className="avd-capital-result">
      <dl className="avd-headline-result" aria-live="polite"><Metric label="Kapital zum Bewertungsende" value={cents(end)} detail={basisLabel(active)} />
        {end === null && partial !== null && <Metric label="Berechenbarer Teil" value={cents(partial)} detail="Weitere Förder- oder Zahlungsbestandteile offen" />}
      </dl>
      <div className="avd-scenarios" role="group" aria-label="Renditeszenarien anzeigen">
        {scenarios.map(c => c && <button type="button" key={c.curveId} aria-pressed={c === active} onClick={() => setOffset(Number(c.curveId.split(":").at(-1)))}>
          <span>{pct(Number(c.marketBasis) / 100)} p. a.</span><strong>{cents(endValue(c))}</strong>
        </button>)}
      </div>
    </div>
    {end === null && <p role="status" className="avd-open">{openNotice(active.end.status === "O" ? active.end.reason : undefined)}</p>}
    <PremiumChart title="Kapitalverlauf nach Szenario" months={active.rows.map(r => r.month)} series={chart} />
    {partial !== null && <div className="avd-capital-build"><h3>Kapitalaufbau am Bewertungsende{end === null ? " · berechenbarer Teil" : ""}</h3>
      <dl>{build.map(item => <div key={item.label}>
        <dt>{item.label}</dt><dd>{item.label === "Zulagen im Modell" && active.fundingPerspective === "OHNE_ZULAGEN" ? "Ohne Zulagen" : cents(item.value)}</dd>
        <dd className="avd-split-bar" aria-hidden="true"><i style={{ background: item.color, width: `${Math.abs(item.value ?? 0) / extent * 50}%`,
          left: item.value !== null && item.value < 0 ? `${50 - Math.abs(item.value) / extent * 50}%` : "50%" }} /></dd>
      </div>)}</dl>
    </div>}
    <p className="avd-note">Drei deterministische Renditeannahmen. Die Verläufe zeigen keine Eintrittswahrscheinlichkeit.</p>
  </>;
}

function Allocation({ paths, product, portfolios, months, selected, inspect, eventMonth }: {
  paths: readonly PremiumProductPath[]; product: ProductDraft; portfolios: readonly (Curve | undefined)[];
  months: readonly string[]; selected: number | null; inspect: (index: number | null) => void; eventMonth?: string;
}) {
  const lines: ChartSeries[] = [];
  paths.forEach((path, i) => {
    const curve = portfolios[i], configuration = product.configurations[productPathKey(path)];
    const template = configuration && path.options[configuration.option]?.profile;
    if (!curve || !template) return;
    // Weight by the asset class the model actually assigns to each position.
    // This describes month-end holdings, distinct from look-through stress exposure.
    const equity = template.positions.flatMap((position, j) => position.assetClass === "equity" ? [j] : []);
    if (paths.length === 1) {
      const classes = [...new Set(template.positions.map(position => position.assetClass))];
      const names = { equity: "Aktien", bond: "Anleihen", cash: "Liquidität", commodity: "Rohstoffe", secured_assets: "Sicherungsvermögen" };
      const actual = curve.rows.map(row => {
        const weights = "portfolio" in row ? row.portfolio?.actualWeights : null;
        if (!weights || weights.some(v => v === null)) return null;
        return classes.map(asset => template.positions.reduce((sum, position, j) => position.assetClass === asset ? sum + weights[j]! / 100 : sum, 0));
      });
      classes.forEach((asset, j) => {
        const from = actual.map(row => row ? row.slice(0, j).reduce((sum, w) => sum + w, 0) : null);
        lines.push({ label: names[asset] + " · Ist", color: [blue, teal, purple, orange, red][j], values: actual.map(row => row?.[j] ?? null),
          band: { from, to: actual.map((row, k) => row ? row[j] + from[k]! : null) } });
      });
    }
    if (!equity.length) return;
    const name = paths.length > 1 ? products.find(p => p.id === path.selection)?.name + " · " : "";
    const weight = (row: Curve["rows"][number], target: boolean) => {
      const p = "portfolio" in row ? row.portfolio : null;
      const weights = target ? p?.targetWeightsBps : p?.actualWeights;
      if (!weights || equity.some(j => weights[j] == null)) return null;
      const value = equity.reduce((sum, j) => sum + weights[j]!, 0);
      return value / 100;
    };
    if (paths.length !== 1) lines.push({ label: name + "Aktienbausteine · Ist", color: colors[i], values: curve.rows.map(row => weight(row, false)) });
    lines.push({ label: name + "Aktienbausteine · Ziel", color: colors[i], dashed: true, values: curve.rows.map(row => weight(row, true)) });
  });
  if (!lines.length) return <p className="avd-note">Für die gewählte Modellgrundlage liegt kein darstellbarer Verlauf der Aktienbausteine vor.</p>;
  return <PremiumChart title={paths.length === 1 ? "Anlageaufteilung und Aktienziel am Monatsende" : "Gewicht der Aktienbausteine am Monatsende"} months={months} series={lines} isPercent compact
    selected={selected} inspect={inspect} eventMonth={eventMonth} />;
}

function Stress({ results, product, payoutMonth, changeConfiguration }: {
  results: readonly Result[]; product: ProductDraft | null; payoutMonth: string; changeConfiguration: (key: string, value: ProductConfiguration | null) => void;
}) {
  const id = useId();
  const [key, setKey] = useState("");
  const [inspected, inspect] = useState<number | null>(null);
  const path = product?.paths.find(p => productPathKey(p) === key) ?? product?.paths[0];
  if (!path || !product) return <p className="avd-open" role="status">Stresstest offen. Für die gewählten Produkte fehlt ein freigegebener Tarifpfad mit Anlageprofil. Die neutrale Kapitalentwicklung bleibt verfügbar.</p>;
  const pathKey = productPathKey(path), configuration = product.configurations[pathKey];
  const baseItem = results.find(x => x.curveId === pathKey + ":M2");
  const stressItem = results.find(x => x.curveId === pathKey + ":M2:stress");
  const base = curveOf(baseItem), stressed = curveOf(stressItem);
  const stress = stressed?.rows.find(row => "portfolio" in row && row.portfolio?.stress)?.portfolio?.stress;
  const months = (base ?? results.map(curveOf).find(curve => curve?.modelMode === "NEUTRAL"))?.rows.map(row => row.month) ?? [];
  const event = configuration?.stressMonth ?? "";
  const index = months.indexOf(event);
  const markerMonth = (month: string) => {
    if (!configuration) return;
    changeConfiguration(pathKey, { ...configuration, stressMonth: month });
  };
  let loss: number | null = null;
  try { if (configuration?.stressLoss) loss = parseStressLoss(configuration.stressLoss); }
  catch { /* The editable value stays visible while the model is open. */ }
  const before = stress && stressed && index >= 0 ? priceValue(stressed, stress.postMarketCents, event) : null;
  const after = stress && stressed && index >= 0 ? priceValue(stressed, stress.postMarketCents - stress.lossCents, event) : null;
  const exposed = stress && stressed && index >= 0 ? priceValue(stressed, stress.exposedCents, event) : null;
  const immediate = stress && stressed && index >= 0 ? priceValue(stressed, stress.lossCents, event) : null;
  const exposure = stress && stress.postMarketCents > 0 ? 100 * stress.exposedCents / stress.postMarketCents : null;
  const effect = stress && stress.postMarketCents > 0 ? -100 * stress.lossCents / stress.postMarketCents : null;
  const diff = stressItem ? productStressDifference(results, stressItem.result) : null;
  const baseEnd = endValue(base);
  const reason = stressItem?.result.status === "O" ? stressItem.result.reason : baseItem?.result.status === "O" ? baseItem.result.reason : null;
  const window = base ? payoutMonth : "";
  return <>
    <div className="avd-controls avd-stress-controls">
      <label htmlFor={id + "-product"}>Anlageprofil im Stresstest<select id={id + "-product"} value={pathKey} onChange={e => { setKey(e.target.value); inspect(null); }}>
        {product.paths.map(option => <option key={productPathKey(option)} value={productPathKey(option)}>{product.catalog.get(option.product.tariff, "stress choice").data.name}</option>)}
      </select></label>
      {configuration && <>
        <label>Aktienmarktverlust in %<input inputMode="decimal" value={configuration.stressLoss} placeholder="z. B. −30"
          aria-invalid={Boolean(configuration.stressLoss && loss === null)}
          onChange={e => changeConfiguration(pathKey, { ...configuration, stressLoss: e.target.value })} />
          <input type="range" min={-100} max={0} step={1} aria-label="Aktienmarktverlust einstellen"
            aria-valuetext={loss === null ? "Offen" : pct(-loss / 100)}
            value={loss === null ? 0 : -loss / 100} onChange={e => changeConfiguration(pathKey, { ...configuration, stressLoss: e.target.value })} /></label>
        <label>Crashmonat<input type="month" min={months[0]} max={months.at(-1)} value={event} aria-invalid={Boolean(event && months.length && index < 0)}
          onChange={e => markerMonth(e.target.value)} />
          {months.length > 0 && <input type="range" min={0} max={months.length - 1} aria-label="Crashmonat einstellen"
            aria-valuetext={index >= 0 ? monthLabel(event) : "Offen"} value={index < 0 ? Math.floor(months.length / 2) : index}
            onChange={e => markerMonth(months[Number(e.target.value)])} />}</label>
      </>}
    </div>
    {window && index >= 0 && <p className="avd-note">Angenommener Auszahlbeginn {monthLabel(window)} · Ereignis {Math.abs(monthIndex(window) - monthIndex(event))} Monate {event <= window ? "bis zum" : "nach dem"} Auszahlbeginn.</p>}
    {reason && <p role="status" className="avd-open">{openNotice(reason)}</p>}
    {!reason && !stress && <p className="avd-open" role="status">{configuration ? "Bitte Monatsdatum und Marktverlust festlegen. Auch ein Stress von 0 % ist prüfbar." : "Bitte ein gültiges, gemeinsames Anlageprofil hinterlegen."}</p>}
    {stress && stressed && <div className="avd-stress-summary" aria-live="polite">
      <dl className="avd-effect-chain" aria-label="Wirkungskette des Stressereignisses">
        <Metric label="Aktienmarktverlust" value={loss === null ? "Offen" : pct(-loss / 100)} />
        <Metric label="Tatsächliche Aktienexponierung" value={exposure === null ? "Offen" : pct(exposure)} detail={exposed === null ? null : cents(exposed)} />
        <Metric label="Unmittelbarer Portfolioeffekt" value={effect === null ? "Offen" : pct(effect)} detail={immediate === null ? null : cents(-immediate)} />
      </dl>
      <dl className="avd-endpoints">
        <Metric label="Kapital beim Ereignis ohne Crash" value={cents(before)} />
        <Metric label="Kapital unmittelbar nach Crash" value={cents(after)} />
        <Metric label="Endwert ohne / mit Crash" value={cents(baseEnd) + " / " + cents(endValue(stressed))} />
        <Metric label="Langfristige Endwertdifferenz" value={cents(diff)} detail={diff !== null && baseEnd !== null && baseEnd > 0 ? pct(100 * diff / baseEnd) + " des Endwerts ohne Crash" : null} />
      </dl>
      <p className="avd-note">{basisLabel(stressed)} · Der Soforteffekt liegt nach der normalen Monatsrendite und vor Kosten, Zahlungen und Monatsendaktionen.</p>
    </div>}
    {base && <PremiumChart title="Kapital mit und ohne Crash" months={months} compact selected={inspected} inspect={inspect} eventMonth={event}
      moveEvent={configuration ? markerMonth : undefined}
      series={[{ label: "Ohne Crash", color: navy, values: values(base) },
        ...(stressed ? [{ label: "Mit Crash", color: red, dashed: true, values: values(stressed) }] : [])]} />}
    {base && <Allocation paths={[path]} product={product} portfolios={[base]} months={months} selected={inspected} inspect={inspect} eventMonth={event} />}
  </>;
}

function Comparison({ results, product, selected, toggle }: {
  results: readonly Result[]; product: ProductDraft | null; selected: readonly ProductId[];
  toggle: (id: ProductId) => boolean;
}) {
  const [mode, setMode] = useState<"M1" | "M2">("M1");
  const [refused, setRefused] = useState(false);
  const [inspected, inspect] = useState<number | null>(null);
  const paths = product?.paths ?? [];
  const chosen = paths.map(path => ({ path, item: results.find(x => x.curveId === productPathKey(path) + ":" + mode) }));
  const missing = products.filter(p => selected.includes(p.id) && !paths.some(path => path.selection === p.id));
  const first = chosen.map(c => curveOf(c.item)).find(Boolean);
  const months = first?.rows.map(row => row.month) ?? [];
  const paymentBases = chosen.flatMap(({ item }) => {
    const curve = curveOf(item);
    return curve?.complete ? [curve.paymentDependency] : [];
  });
  const aligned = new Set(paymentBases).size <= 1;
  const bars = chosen.map(({ item, path }, i) => {
    const curve = curveOf(item);
    const name = product!.catalog.get(path.product.tariff, "comparison tariff").data.name;
    const last = curve?.rows.at(-1);
    return { name, color: colors[i], end: endValue(curve), reference: curve?.complete && last && "grossCents" in last ? last.grossCents ?? null : null,
      issue: item?.result.status === "O" ? item.result.reason : null };
  });
  const extent = Math.max(1, ...bars.flatMap(b => [b.end ?? 0, b.reference ?? 0]));
  return <>
    <details className="avd-disclosure avd-compare-picker"><summary>Produkte im Vergleich · {selected.length} von 3</summary>
      <fieldset><legend>Bis zu drei Produkte auswählen</legend>
        {products.map(p => <label key={p.id}><input type="checkbox" checked={selected.includes(p.id)}
          onChange={() => setRefused(!toggle(p.id))} />{p.name}</label>)}
      </fieldset>
      {refused && <p role="status">Wählen Sie zuerst eine der drei Alternativen ab.</p>}
    </details>
    <div className="avd-segment" role="group" aria-label="Art des wirtschaftlichen Vergleichs">
      <button type="button" aria-pressed={mode === "M1"} onClick={() => { setMode("M1"); inspect(null); }}>M1 · Kostenwirkung</button>
      <button type="button" aria-pressed={mode === "M2"} onClick={() => { setMode("M2"); inspect(null); }}>M2 · Anlage und Risiko</button>
    </div>
    <p className="avd-note">{mode === "M1" ? "Gemeinsame Bruttorendite und Zahlungsplan je Vergleichspaar. Der Abstand ist modellierte Kostenwirkung am Endwert." :
      "Die Anlageklassen, Profilverläufe und Stressereignisse stammen aus der gemeinsamen Tarifkonfiguration."}{first && " " + basisLabel(first) + "."}</p>
    {!bars.length && <p className="avd-open" role="status">{selected.length
      ? "Für die gewählten Produkte sind keine Tarif- und Kostenwerte für diesen Beratungskanal freigegeben."
      : "Wählen Sie die Produkte für den Vergleich. Offene Tarif- oder Kostendaten bleiben dabei sichtbar."}</p>}
    {missing.length > 0 && <dl className="avd-endpoints">{missing.map(item =>
      <Metric key={item.id} label={item.name} value="Offen" detail={mode === "M1" ? "Tarifkosten im Beratungskanal offen" : "Anlageprofil und Tarifpfad im Beratungskanal offen"} />)}</dl>}
    {!aligned && <p className="avd-open" role="status">Die wirksamen Zahlungen unterscheiden sich zwischen den Tarifen. Ein direkter Kurvenvergleich auf gleicher Zahlungsbasis bleibt offen.</p>}
    {mode === "M1" && bars.length > 0 && <>
      <h3>Kapital zum Bewertungsende</h3>
      <div className="avd-comparison-bars">{bars.map(bar => <div key={bar.name}>
        <strong>{bar.name}</strong>
        {bar.end === null || bar.reference === null ? <p className="avd-note">{openNotice(bar.issue ?? undefined)}</p> :
          <dl>{[{ label: "Bruttoreferenz", amount: bar.reference, color: blue }, { label: "Nach modelliertem Kostenansatz", amount: bar.end, color: bar.color }].map(line =>
            <div key={line.label}><dt>{line.label}</dt><dd><i className="avd-hbar" aria-hidden="true" style={{ width: `${100 * line.amount / extent}%`, background: line.color }} /><b>{cents(line.amount)}</b></dd></div>)}</dl>}
      </div>)}</div>
      {aligned && <PremiumChart title="Kostenwirkung im Zeitverlauf" months={months}
        series={chosen.flatMap(({ item }, i) => {
          const curve = curveOf(item);
          return curve?.complete ? [{ label: bars[i].name, color: colors[i], values: curve.rows.map(row => "K1EndDifferenceCents" in row ? row.K1EndDifferenceCents ?? null : null) }] : [];
        })} />}
      <p className="avd-note">Der Endwertabstand enthält auch entgangene oder vermiedene Wertentwicklung. Er beziffert keine Summe tatsächlich gezahlter Gebühren.</p>
    </>}
    {mode === "M2" && product && <>
      <dl className="avd-endpoints">{bars.map(bar => <Metric key={bar.name} label={bar.name} value={cents(bar.end)}
        detail={bar.end === null ? openNotice(bar.issue ?? undefined) : null} />)}</dl>
      {aligned && <PremiumChart title="Kapitalverläufe der Anlageprofile" months={months} selected={inspected} inspect={inspect}
        series={chosen.flatMap(({ item, path }, i) => {
          const base = curveOf(item);
          if (!base || !base.complete) return [];
          const stress = results.find(v => v.curveId === productPathKey(path) + ":M2:stress");
          const stressed = curveOf(stress);
          return [{ label: bars[i].name, color: colors[i], values: values(base) },
            ...(stress && stressed && productStressDifference(results, stress.result) !== null ?
              [{ label: bars[i].name + " · mit Crash", color: colors[i], values: values(stressed), dashed: true }] : [])];
        })} />}
      {first && aligned && <Allocation paths={paths} product={product} portfolios={chosen.map(c => curveOf(c.item))} months={months} selected={inspected} inspect={inspect} />}
      </>}
  </>;
}

export function PremiumAnalysis({ analysis, snapshot, curveIds, product, payoutMonth, selected, toggle, changeConfiguration }: {
  analysis: Analysis; snapshot: Snapshot | null; curveIds: readonly string[]; product: ProductDraft | null; payoutMonth: string; selected: readonly ProductId[];
  toggle: (id: ProductId) => boolean; changeConfiguration: (key: string, value: ProductConfiguration | null) => void;
}) {
  const results = snapshot?.subresults.map((item, i) => ({ ...item, curveId: curveIds[i] })) ?? [];
  if (analysis === "stress") return <Stress results={results} product={product} payoutMonth={payoutMonth} changeConfiguration={changeConfiguration} />;
  if (analysis === "comparison") return <Comparison results={results} product={product} selected={selected} toggle={toggle} />;
  return <Capital results={results} />;
}
