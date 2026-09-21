import { buildBondAnalysisData, bondCoverageLabel, BOND_SCENARIO_NOTICE } from "./bond-analysis-data";

export function BondAnalysisView({ data, onInclusionChange }: {
  data: ReturnType<typeof buildBondAnalysisData>;
  onInclusionChange: (id: string, included: boolean) => void;
}) {
  const table = (headers: string[], rows: string[][]) => <div className="analysis-table-wrap"><table className="analysis-table"><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>;
  return <>
    <p className="analysis-context">{data.notices[0]}</p>
    {data.notices.slice(2, 5).map((n) => <p className="analysis-context" key={n}>{n}</p>)}
    <div className="analysis-kpis four">{data.summary.map((s) => <article key={s.key}><span>{s.label}</span><b>{s.value}</b><small>{bondCoverageLabel(s.coverage)} · berechenbarer gewählter Teilbestand</small></article>)}</div>
    <details className="analysis-section"><summary>Abdeckung und Ausschlüsse je Kennzahl</summary>{table(data.coverageHeaders, data.coverageRows)}</details>
    <div className="analysis-section"><h3>Zinsszenarien</h3><div className="scenario-list">{data.scenarioRows.map(([label, value]) => <span key={label}><b>{label}</b><em>{value}</em></span>)}</div><p className="analysis-note">{BOND_SCENARIO_NOTICE}</p></div>
    <div className="analysis-section"><h3>Fälligkeitsleiter nach Nominalwährung</h3><p className="analysis-note">{data.ladderNotice}</p>{data.ladderRows.length ? table(data.ladderHeaders, data.ladderRows) : <p>keine belastbare Nominaldarstellung</p>}</div>
    <div className="analysis-section"><h3>Direkte Rentenpositionen</h3>
      <div className="analysis-table-wrap"><table className="analysis-table"><thead><tr>{data.positionHeaders.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{data.rows.map((row, i) => <tr key={row.position.id}>{data.positionRows[i].map((cell, j) => <td key={j}>{j === 2 && row.position.source === "holding" ? <><label><input type="checkbox" checked={!row.position.excludeFromBondAggregates} onChange={(e) => onInclusionChange(row.position.id, e.target.checked)} />In aggregierten Rentenkennzahlen berücksichtigen</label><small>{cell}</small></> : j === 12 ? <details><summary>{row.metrics.model?.modelLabel || "Datenstatus und Modellhinweise"}</summary>{cell}</details> : cell}</td>)}</tr>)}</tbody></table></div>
    </div>
    <div className="analysis-section"><h3>Modellannahmen und Datenlücken</h3>{data.notices.filter((_, i) => i < 2 || i >= 5).map((n) => <p className="analysis-note" key={n}>{n}</p>)}</div>
  </>;
}
