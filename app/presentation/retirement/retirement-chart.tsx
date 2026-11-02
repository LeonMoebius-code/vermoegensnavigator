import { useId } from "react";
import type { ProjectionResult } from "../../domain/retirement/projection-contract";
import { ledgerPoints } from "./customer-plan-adapter";
import { projectionEuro } from "./retirement-projection";
export const customerScenarioNames = ["Zurückhaltend", "Mittlere Annahme", "Höhere Annahme"] as const;
const colors = ["#196f81", "#005b94", "#a44b00"];
const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5)) - 1;
export function RetirementChart({ models, reference = false }: { models: readonly (ProjectionResult | undefined)[]; reference?: boolean }) {
  const id = useId();
  const series = models.map(m => m ? ledgerPoints(m) : []);
  const all = series.flat();
  if (!all.length) return <p role="status">Für diesen Verlauf sind noch keine belastbaren Modellwerte verfügbar.</p>;
  const start = Math.min(...models.filter((m): m is ProjectionResult => !!m).map(m => monthIndex(m.period.startMonth)));
  const end = Math.max(...all.map(p => monthIndex(p.month)));
  const low = Math.min(0, ...all.flatMap(p => [p.cents, p.ownCents]));
  const high = Math.max(1, ...all.flatMap(p => [p.cents, p.ownCents]));
  const x = (m: string) => 105 + (monthIndex(m) - start) / Math.max(1, end - start) * 625;
  const y = (v: number) => 280 - (v - low) / (high - low) * 245;
  const sample = all.filter((_, i) => i === 0 || i === all.length - 1); // Only axis labels, never financial samples.
  return <figure className="retirement-customer-chart">
    <figcaption>{reference ? "ETF-/Fondsreferenz" : "Ihre mögliche Kapitalentwicklung"} · Modellannahmen</figcaption>
    <svg viewBox="0 0 760 330" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Drei Szenarien und eigene Einzahlungen</title>
      <desc id={`${id}-desc`}>Euro über Kalenderjahre. Linien verbinden ausschließlich berechnete Monats- oder Blockendwerte. Die folgende Tabelle enthält zugängliche Originalwerte. Keine Wahrscheinlichkeiten oder Garantien.</desc>
      {[0, .5, 1].map(f => { const value = low + (high - low) * f; return <g key={f}>
        <line x1="105" x2="730" y1={y(value)} y2={y(value)} stroke="#d5e0e8" />
        <text x="95" y={y(value) + 4} textAnchor="end">{new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value / 100)} €</text>
      </g>; })}
      {sample.map((p, i) => <text key={i} x={i ? 730 : 105} y="310" textAnchor={i ? "end" : "start"}>{p.month.slice(0, 4)}</text>)}
      {series.map((points, i) => points.length > 0 && <g key={i}>
        <polyline data-testid="scenario-line" data-scenario={i} data-count={points.length} fill="none" stroke={colors[i]} strokeWidth="3"
          strokeDasharray={i === 0 ? "7 4" : i === 2 ? "2 3" : undefined} points={points.map(p => `${x(p.month)},${y(p.cents)}`).join(" ")} />
        {points.length === 1 && <circle cx={x(points[0].month)} cy={y(points[0].cents)} r="4" fill={colors[i]} />}
      </g>)}
      {series.find(p => p.length) && <polyline data-testid="own-line" fill="none" stroke="#526370" strokeWidth="2" strokeDasharray="4 5"
        points={series.find(p => p.length)!.map(p => `${x(p.month)},${y(p.ownCents)}`).join(" ")} />}
    </svg>
    <ul className="retirement-chart-legend">{customerScenarioNames.map((n, i) => <li key={n}><span style={{ background: colors[i] }} />{n}</li>)}<li><span style={{ background: "#526370" }} />Eigene Einzahlungen</li></ul>
    <p>Keine Vorhersage: Die Linien verbinden echte {models.some(m => m?.ledger?.mode === "compact") ? "Blockendwerte; Zwischenmonate werden nicht angezeigt" : "Monatsendwerte"}. Offene Förderansprüche sind nicht automatisch eingerechnet.</p>
    <details><summary>Verlaufswerte als Tabelle</summary>
      {series.map((points, i) => points.length > 0 && <details key={i}><summary>{customerScenarioNames[i]} · {points.length} Werte</summary>
        <div className="retirement-chart-table"><table><caption>{customerScenarioNames[i]} – Originalwerte des Rechenkerns</caption>
          <thead><tr><th scope="col">Monat</th><th scope="col">Kapital</th><th scope="col">Eigene Einzahlungen</th></tr></thead>
          <tbody>{points.map(p => <tr key={p.month} data-testid="ledger-point"><th scope="row">{p.month}</th><td>{projectionEuro(p.cents)}</td><td>{projectionEuro(p.ownCents)}</td></tr>)}</tbody>
        </table></div>
      </details>)}
    </details>
  </figure>;
}
