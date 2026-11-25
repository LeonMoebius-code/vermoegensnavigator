import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type ChartSeries = {
  readonly label: string;
  readonly color: string;
  readonly values: readonly (number | null)[];
  readonly dashed?: boolean;
  readonly band?: { readonly from: readonly (number | null)[]; readonly to: readonly (number | null)[] };
};

const shortMoney = new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const percent = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 2 });
export const monthLabel = (month: string) => month.slice(5) + "/" + month.slice(0, 4);
export const chartMoney = (cents: number) => money.format(cents / 100);

function scaleFor(series: readonly ChartSeries[], isPercent: boolean) {
  if (isPercent) return { low: 0, high: 100, ticks: [0, 25, 50, 75, 100] };
  const values = series.flatMap(line => [...line.values, ...line.band?.from ?? [], ...line.band?.to ?? []].filter(value => value !== null));
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const range = Math.max(max - min, 100);
  const unit = 10 ** Math.floor(Math.log10(range / 4));
  const step = ([1, 2, 2.5, 5, 10].find(n => n * unit >= range / 5) ?? 10) * unit;
  const low = Math.floor(min / step) * step, high = Math.max(step, Math.ceil(max / step) * step);
  return { low, high, ticks: Array.from({ length: Math.round((high - low) / step) + 1 }, (_, i) => low + i * step) };
}

export function PremiumChart({ title, months, series, isPercent = false, selected, inspect, eventMonth, moveEvent, compact = false }: {
  title: string; months: readonly string[]; series: readonly ChartSeries[]; isPercent?: boolean;
  selected?: number | null; inspect?: (index: number | null) => void; eventMonth?: string;
  moveEvent?: (month: string) => void; compact?: boolean;
}) {
  const id = useId(), svg = useRef<SVGSVGElement>(null);
  const [local, setLocal] = useState<number | null>(null);
  const [focus, setFocus] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const active = drag ?? (inspect ? selected ?? null : local);
  const setIndex = (index: number | null) => inspect ? inspect(index) : setLocal(index);
  const width = 900, height = compact ? 157 : 250;
  const left = 65, right = 878, top = 13, bottom = height - 30;
  const last = months.length - 1;
  const index = active === null ? null : Math.min(Math.max(active, 0), last);
  const { low, high, ticks } = scaleFor(series, isPercent);
  const x = (i: number) => left + (right - left) * i / Math.max(1, last);
  const y = (value: number) => bottom - (bottom - top) * (value - low) / (high - low);
  const format = (value: number | null | undefined) => value == null ? "Offen" : isPercent ? percent.format(value / 100) : chartMoney(value);
  const event = eventMonth ? months.indexOf(eventMonth) : -1;
  const marker = drag ?? event;
  const tickMonths = [...new Set(Array.from({ length: 6 }, (_, i) => Math.round(last * i / 5)))];
  const locate = (clientX: number) => {
    const bounds = svg.current!.getBoundingClientRect();
    const position = ((clientX - bounds.left) * width / bounds.width - left) / (right - left);
    return Math.max(0, Math.min(last, Math.round(position * last)));
  };
  const keyIndex = (e: KeyboardEvent, current: number) => {
    const next = ({ ArrowLeft: current - 1, ArrowDown: current - 1, ArrowRight: current + 1, ArrowUp: current + 1,
      Home: 0, End: last, PageUp: current + 12, PageDown: current - 12 })[e.key];
    if (next === undefined) return null;
    e.preventDefault();
    return Math.max(0, Math.min(last, next));
  };
  function finishDrag(e: PointerEvent<SVGRectElement>) {
    const next = locate(e.clientX);
    setDrag(null);
    setIndex(next);
    moveEvent?.(months[next]);
  }
  if (!months.length || !series.some(line => line.values.some(value => value !== null))) return null;
  return <figure className="avd-chart" aria-labelledby={id + "-title"}>
    <div className="avd-chart-heading"><figcaption id={id + "-title"}>{title}</figcaption>
      {event >= 0 && moveEvent && <span className="avd-chart-event-label">Crashmonat {monthLabel(months[marker])} · Marker ziehbar</span>}
    </div>
    <ul className="avd-chart-legend">{series.map(line => <li key={line.label}>
      <i aria-hidden="true" className={line.band ? "avd-band-swatch" : line.dashed ? "avd-dashed" : ""} style={{ color: line.color }} />{line.label}
    </li>)}</ul>
    <div className="avd-chart-surface">
      <svg ref={svg} className={compact ? "avd-chart-compact" : undefined} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"
        onPointerMove={e => { if (e.pointerType === "mouse" && drag === null) setIndex(locate(e.clientX)); }}
        onPointerLeave={() => { if (!focus && drag === null) setIndex(null); }}>
        {ticks.map(tick => <g key={tick}><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "avd-axis" : "avd-gridline"} />
          <text x={left - 10} y={y(tick) + 4} textAnchor="end">{isPercent ? tick + " %" : shortMoney.format(tick / 100) + " €"}</text></g>)}
        {tickMonths.map((i, position) => <text key={i} x={x(i)} y={height - 8}
          className={position % 2 === 1 && position !== tickMonths.length - 1 ? "avd-minor-tick" : undefined}
          textAnchor={position === 0 ? "start" : position === tickMonths.length - 1 ? "end" : "middle"}>{monthLabel(months[i])}</text>)}
        <defs><clipPath id={id + "-plot"}><rect x={left - 3} y={top - 3} width={right - left + 6} height={bottom - top + 6} /></clipPath></defs>
        <g clipPath={`url(#${id}-plot)`}>
        {series.filter(line => line.band).map(line => {
          const band = line.band!;
          const segments: number[][] = [];
          band.to.forEach((value, i) => {
            if (value === null || band.from[i] === null) return;
            if (i === 0 || band.to[i - 1] === null || band.from[i - 1] === null) segments.push([]);
            segments.at(-1)!.push(i);
          });
          return <g key={line.label}>{segments.map((part, i) => <polygon key={i}
            points={[...part.map(p => `${x(p)},${y(band.to[p]!)}`), ...part.slice().reverse().map(p => `${x(p)},${y(band.from[p]!)}`)].join(" ")}
            fill={line.color} fillOpacity=".24" />)}</g>;
        })}
        {series.filter(line => !line.band).map(line => {
          const parts: number[][] = [];
          line.values.forEach((value, i) => {
            if (value === null) return;
            if (i === 0 || line.values[i - 1] === null) parts.push([]);
            parts.at(-1)!.push(i);
          });
          return <g key={line.label}>{parts.map((part, i) => {
            const points = part.map(p => `${x(p)},${y(line.values[p]!)}`).join(" ");
            return <g key={i}>
              {part.length === 1 ? <circle cx={x(part[0])} cy={y(line.values[part[0]]!)} r="4" fill={line.color} /> : <polyline points={points}
                fill="none" stroke={line.color} strokeWidth="2.4" strokeDasharray={line.dashed ? "6 5" : undefined} vectorEffect="non-scaling-stroke" />}
            </g>;
          })}</g>;
        })}
        </g>
        {index !== null && <line x1={x(index)} x2={x(index)} y1={top} y2={bottom} className="avd-crosshair" />}
        {marker >= 0 && <g>
          <line x1={x(marker)} x2={x(marker)} y1={top} y2={bottom} className="avd-event" />
          <circle cx={x(marker)} cy={top + 5} r="5" className="avd-event-dot" />
          {moveEvent && <rect x={x(marker) - 12} y={top} width={24} height={bottom - top} fill="transparent" className="avd-event-grab"
            data-testid="avd-crash-marker" onPointerDown={e => {
              if (e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              const next = locate(e.clientX);
              setDrag(next);
              setIndex(next);
            }} onPointerMove={e => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              const next = locate(e.clientX);
              setDrag(next);
              setIndex(next);
            }}
            onPointerUp={finishDrag} onPointerCancel={() => setDrag(null)} />}
        </g>}
      </svg>
      {index !== null && <div aria-hidden="true" className="avd-chart-tooltip" style={{ left: `${x(index) / width * 100}%` }} data-align={index > last / 2 ? "left" : "right"}>
        <strong>{monthLabel(months[index])}</strong>
        {series.map(line => <span key={line.label}>{line.label}<b>{format(line.values[index])}</b></span>)}
      </div>}
    </div>
    <div className="avd-chart-tools">
    <label className="avd-chart-keyboard">Monatswerte erkunden
      <input type="range" aria-label={`Monatswerte erkunden · ${title}`} min={0} max={Math.max(0, last)} value={index ?? last}
        aria-valuetext={`${monthLabel(months[index ?? last])}. ${series.map(line => line.label + " " + format(line.values[index ?? last])).join(". ")}`}
        onFocus={() => { setFocus(true); setIndex(index ?? last); }} onBlur={() => { setFocus(false); setIndex(null); }}
        onKeyDown={e => { const next = keyIndex(e, index ?? last); if (next !== null) setIndex(next); }}
        onChange={e => setIndex(Number(e.target.value))} />
    </label>
    <details className="avd-chart-alternative"><summary>Wertetabelle · {title}</summary>
      <div className="avd-table-scroll" tabIndex={0} role="region" aria-label={title}>
        <table><thead><tr><th scope="col">Monat</th>{series.map(line => <th key={line.label} scope="col">{line.label}</th>)}</tr></thead>
          <tbody>{months.map((month, i) => <tr key={month}><th scope="row">{monthLabel(month)}</th>
            {series.map(line => <td key={line.label}>{format(line.values[i])}</td>)}</tr>)}</tbody></table>
      </div>
    </details>
    </div>
  </figure>;
}
