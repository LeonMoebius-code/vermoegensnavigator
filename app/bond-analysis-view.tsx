import { buildBondAnalysisData } from "./bond-analysis-data";
import { bondReasonLabel } from "./bond-v2";

export function BondAnalysisView({ data, onInclusionChange }: {
  data: ReturnType<typeof buildBondAnalysisData>;
  onInclusionChange: (id: string, included: boolean) => void;
}) {
  const table = (headers: string[], rows: string[][], compact = false) => <div className="analysis-table-wrap"><table className={`analysis-table${compact ? " compact" : ""}`}><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>;
  return <>
    <div className="analysis-kpis four">{data.summary.map((s) => <article key={s.key}><span>{s.label}</span><b>{s.value}</b><small>{s.coverageText}</small>{s.resultNote && <small>{s.resultNote}</small>}</article>)}</div>
    <div className="analysis-section"><h3>Zinsszenarien</h3><div className="scenario-list">{data.scenarioRows.map(([label, value]) => <span key={label}><b>{label}</b><em>{value}</em></span>)}</div><small className="analysis-note">{data.scenarioNotice}</small></div>
    <div className="analysis-section"><h3>Fälligkeitsübersicht nach Nominalwährung</h3><small className="analysis-note">{data.customerLadderNotice}</small>{data.customerLadderRows.length ? table(data.customerLadderHeaders, data.customerLadderRows, true) : <p>Keine belastbare Nominaldarstellung.</p>}</div>
    <div className="analysis-section"><h3>Positionen</h3>
      <div className="analysis-table-wrap"><table className="analysis-table compact"><thead><tr><th>Einbeziehen</th>{data.customerPositionHeaders.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{data.rows.map((row, i) => <tr key={row.position.id}>
        <td>{row.position.source === "holding" && <input type="checkbox" aria-label={`In aggregierten Rentenkennzahlen berücksichtigen: ${row.position.name}`} checked={!row.position.excludeFromBondAggregates} onChange={(e) => onInclusionChange(row.position.id, e.target.checked)} />}</td>
        {data.customerPositionRows[i].map((cell, j) => <td key={j} title={j >= 4 && cell === "–" ? bondReasonLabel(row.metrics[(["ytm", "currentYield", "modified", "dv01"] as const)[j - 4]].reasonCode) || "Nicht berechenbar" : undefined}>{cell}</td>)}
      </tr>)}</tbody></table></div>
      {data.modelFootnote && <small className="analysis-note">{data.modelFootnote}</small>}
    </div>
    <details className="analysis-section bond-technical"><summary>Fachliche Details und Datenprüfung</summary>
      <h3>Modellabdeckung nach Qualität</h3>{table(data.modelCoverageHeaders, data.modelCoverageRows, true)}
      <h3>Abdeckung und Ausschlüsse je Kennzahl</h3>{table(data.coverageHeaders, data.coverageRows)}
      <h3>Vollständige Fälligkeitsprüfung</h3><p className="analysis-note">{data.ladderNotice}</p>{table(data.ladderHeaders, data.ladderRows)}
      <h3>Vollständige Positionsprüfung</h3>
      {table(data.positionHeaders, data.positionRows)}
      <h3>Modell, Quellen und Konventionen</h3>{data.notices.map((n) => <p className="analysis-note" key={n}>{n}</p>)}
    </details>
  </>;
}
