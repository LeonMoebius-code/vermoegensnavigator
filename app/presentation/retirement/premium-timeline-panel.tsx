import { newPremiumIdentity } from "../../domain/retirement/premium-contract";
import { useId, useState } from "react";
import { AvdError } from "../../domain/retirement/avd-data";
import { overrideRegularEnd, regularEnd } from "../../domain/retirement/premium-calendar";
import { endAgeBasis, type TimelineDraft } from "./premium-timeline";
import type { CustomerPlan } from "./customer-plan-adapter";

export function PremiumTimelinePanel({ plan, draft, change, compact = false, changeEnd }: {
  plan: CustomerPlan; draft: TimelineDraft; change: (value: TimelineDraft) => void;
  compact?: boolean; changeEnd?: (month: string) => void;
}) {
  const id = useId();
  const [directMonth, setDirectMonth] = useState("");
  const basis = endAgeBasis(plan, draft);
  let status: ReturnType<typeof regularEnd> | null = null;
  if (draft.mode === "end_age") {
    try { status = regularEnd(basis, draft.override); }
    catch (error) { if (!(error instanceof AvdError)) throw error; }
  }
  const commitOverride = (month: string) => {
    if (!month || !status) return;
    change({ ...draft, override: overrideRegularEnd(basis, month, newPremiumIdentity()) });
  };
  return <details className={compact ? "avd-timeline-control" : undefined}><summary>{compact ? "Sparende und Auszahlbeginn" : "Sparende und Bewertung getrennt festlegen"}</summary>
    {compact && draft.mode === "dated" && <label>Letzter Sparmonat<input type="month" value={plan.capital.end}
      onChange={e => changeEnd?.(e.target.value)} /></label>}
    <div className="retirement-capital-grid">
      <div><label htmlFor={`${id}-mode`}>Art des Zahlungsplans</label><select id={`${id}-mode`} value={draft.mode}
        onChange={e => change({ ...draft, mode: e.target.value as TimelineDraft["mode"] })}>
        <option value="dated">Direkter letzter Beitragsmonat</option>
        <option value="end_age">Letzten Beitragsmonat aus Endalter ableiten</option>
        <option value="holdings_only">Bestandsprojektion ohne reguläre Beiträge</option>
      </select></div>
      <div><label htmlFor={`${id}-valuation`}>Kapital bewerten bis Monat</label><input id={`${id}-valuation`} type="month"
        value={draft.valuationEnd} onChange={e => change({ ...draft, valuationEnd: e.target.value })} /></div>
      <div><label htmlFor={`${id}-payout`}>Angenommener Auszahlbeginn</label><input id={`${id}-payout`} type="month"
        value={draft.payoutMonth} onChange={e => change({ ...draft, payoutMonth: e.target.value })} /></div>
    </div>
    {draft.mode === "end_age" && <>
      <label htmlFor={`${id}-age`}>Spar-Endalter</label><input id={`${id}-age`} inputMode="numeric" value={draft.endAge}
        onChange={e => change({ ...draft, endAge: e.target.value })} />
      <label htmlFor={`${id}-birth-month`}>Geburtsmonat als Modellannahme</label><select id={`${id}-birth-month`} value={draft.birthMonth}
        onChange={e => change({ ...draft, birthMonth: e.target.value })}>
        <option value="">Offen</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
      </select>
      <p role="status" className={status?.status === "Konflikt_ungelöst" ? "avd-open" : undefined}>{!status ? "Geburtsjahr in A1 und Spar-Endalter prüfen." : status.status === "Konflikt_ungelöst"
        ? `Konflikt: gesetzter Monat ${status.previous}, neu abgeleitet ${status.derived ?? "offen"}.` : status.month
          ? `Letzter Monatsendbeitrag ${status.month} · ${status.status}.`
          : `Zieljahr ${status.year}. Der genaue Beitragsmonat ist offen.`}</p>
      <label htmlFor={`${id}-override`}>Beitragsende direkt annehmen</label><input id={`${id}-override`} type="month" value={directMonth}
        onChange={e => setDirectMonth(e.target.value)} />
      <button type="button" className="secondary" disabled={!directMonth || !status} onClick={() => commitOverride(directMonth)}>Diesen Monat übernehmen</button>
      {status?.status === "Konflikt_ungelöst" && <>
        <button type="button" className="secondary" onClick={() => commitOverride(status.previous!)}>Bisherigen Endmonat beibehalten</button>
        <button type="button" className="secondary" onClick={() => change({ ...draft, override: null })}>
          {status.derived ? "Neu abgeleiteten Endmonat übernehmen" : "Direkte Annahme verwerfen und Monat offenlassen"}
        </button>
      </>}
    </>}
  </details>;
}
