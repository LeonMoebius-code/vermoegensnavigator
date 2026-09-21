import { buildBondAnalysisData, BOND_EXPORT_SCOPE_NOTICE, BOND_SCENARIO_NOTICE } from "./bond-analysis-data";

export function BondAnalysisView({ data, onInclusionChange }: {
  data: ReturnType<typeof buildBondAnalysisData>;
  onInclusionChange: (id: string, included: boolean) => void;
}) {
  const table = (headers: string[], rows: string[][], compact = false) => <div className="analysis-table-wrap"><table className={`analysis-table${compact ? " compact" : ""}`}><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>;
  return <>
    <p className="analysis-context">Kennzahlen für den berechenbaren und gewählten Teilbestand der direkten Anleihen.</p>
    <div className="analysis-kpis bond-primary">{data.primarySummary.map((s) => <article key={s.key}><span>{s.label}</span><b>{s.value}</b><small>{s.coverageText}</small></article>)}</div>
    {data.customerNotices.length > 0 && <div className="analysis-alert"><h3>Wichtige Hinweise</h3><ul>{data.customerNotices.map((notice) => <li key={notice}>{notice}</li>)}</ul></div>}
    <div className="analysis-section"><h3>Fälligkeitsübersicht</h3><p className="analysis-note">{data.customerLadderNotice}</p>{data.customerLadderRows.length ? table(data.customerLadderHeaders, data.customerLadderRows, true) : <p>Keine belastbare Nominaldarstellung.</p>}</div>
    <div className="analysis-section"><h3>Positionen</h3>{table(data.customerPositionHeaders, data.customerPositionRows, true)}</div>
    <p className="analysis-note export-scope-note">{BOND_EXPORT_SCOPE_NOTICE}</p>
    <details className="analysis-section bond-technical"><summary>Fachliche Details und Datenprüfung</summary>
      <div className="analysis-kpis bond-secondary">{data.riskSummary.map((s) => <article key={s.key}><span>{s.label}</span><b>{s.value}</b><small>{s.coverageText}</small></article>)}</div>
      <h3>Abdeckung und Ausschlüsse je Kennzahl</h3>{table(data.coverageHeaders, data.coverageRows)}
      <h3>Zinsszenarien</h3><div className="scenario-list">{data.scenarioRows.map(([label, value]) => <span key={label}><b>{label}</b><em>{value}</em></span>)}</div><p className="analysis-note">{BOND_SCENARIO_NOTICE}</p>
      <h3>Vollständige Positionsprüfung</h3>
      <div className="analysis-table-wrap"><table className="analysis-table"><thead><tr>{data.positionHeaders.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{data.rows.map((row, i) => <tr key={row.position.id}>{data.positionRows[i].map((cell, j) => <td key={j}>{j === 2 && row.position.source === "holding" ? <><label><input type="checkbox" checked={!row.position.excludeFromBondAggregates} onChange={(e) => onInclusionChange(row.position.id, e.target.checked)} />In aggregierten Rentenkennzahlen berücksichtigen</label><small>{cell}</small></> : j === 12 ? <details><summary>{row.metrics.model?.modelLabel || "Datenstatus und Modellhinweise"}</summary>{cell}</details> : cell}</td>)}</tr>)}</tbody></table></div>
      <h3>Modell, Quellen und Konventionen</h3>{data.notices.map((n) => <p className="analysis-note" key={n}>{n}</p>)}
    </details>
  </>;
}
