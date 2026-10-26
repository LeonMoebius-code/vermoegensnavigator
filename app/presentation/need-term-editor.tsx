import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { AdvisoryCase } from "../case-model";
import type { AdvisoryData } from "../domain/advisory/contracts";
import { needCalendarDate, NEED_CALENDAR_ERROR } from "../domain/planning/calendar";
import { commitNeedTermChange, previewNeedTermChange, type NeedTermRequest } from "../need-term-change";

type Preview = ReturnType<typeof previewNeedTermChange>;
type Pending = { request: NeedTermRequest; preview: Preview; phase: "review" | "commit"; refreshed: boolean };
export type NeedTermInput = { mode: "date"; value: string } | { mode: "years"; value: number };
const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 20 });
const frequencies: Record<string, string> = { monthly: "monatlich", quarterly: "vierteljährlich", semiannual: "halbjährlich", annual: "jährlich" };

export function useNeedTermChange(item: AdvisoryCase, setItem: Dispatch<SetStateAction<AdvisoryCase>>) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState("");
  const [reset, setReset] = useState(0);
  // All state updaters are pure. Re-evaluate on every intervening case update;
  // the final functional setter independently checks the same review key.
  useEffect(() => {
    if (!pending) return;
    try {
      const preview = previewNeedTermChange(item, pending.request);
      if (preview.unchanged) { setPending(null); return; }
      if (preview.key !== pending.preview.key) {
        setPending({ ...pending, preview,
          phase: pending.phase === "commit" && !preview.losses.length ? "commit" : "review", refreshed: true });
      } else if (pending.phase === "commit") {
        setItem((current) => commitNeedTermChange(current, pending.request, pending.preview.key));
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Terminänderung kann nicht sicher übernommen werden.");
      setPending(null);
    }
  }, [item, pending, setItem]);
  const cancel = () => { setPending(null); setReset((value) => value + 1); };
  return {
    busy: Boolean(pending), reset,
    request: (needId: number, input: NeedTermInput) => {
      if (pending) return;
      setError("");
      try {
        const request = { caseId: item.id, needId, ...input } as NeedTermRequest;
        const preview = previewNeedTermChange(item, request);
        if (!preview.unchanged) setPending({ request, preview, phase: preview.losses.length ? "review" : "commit", refreshed: false });
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Terminänderung nicht möglich."); }
    },
    feedback: <>
      {error && <p role="alert" className="need-term-error">{error}</p>}
      {pending?.phase === "review" && <NeedTermReview preview={pending.preview} refreshed={pending.refreshed}
        cancel={cancel} confirm={() => setPending((current) => current ? { ...current, phase: "commit" } : null)} />}
    </>,
  };
}

function NeedTermReview({ preview, refreshed, cancel, confirm }: {
  preview: Preview; refreshed: boolean; cancel: () => void; confirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    node.showModal();
    return () => { node.close(); previousFocus?.focus(); };
  }, []);
  return <dialog ref={dialog} className="need-term-dialog" aria-labelledby="need-term-title" aria-describedby="need-term-description"
    onCancel={(event) => { event.preventDefault(); cancel(); }}>
    <h2 id="need-term-title">Terminänderung prüfen</h2>
    <p id="need-term-description">{preview.purpose || "Kapitalbedarf"}: {preview.beforeDate} (Zieljahr {preview.beforeYear}) → {preview.afterDate} (Zieljahr {preview.afterYear}).
      Die folgenden bestehenden Zuordnungen werden entfernt oder reduziert. Es erfolgt keine Umbuchung.</p>
    {refreshed && <p role="alert">Der Fall wurde zwischenzeitlich geändert. Bitte die aktualisierte Vorschau erneut prüfen und bestätigen.</p>}
    {!preview.losses.length && <p>Inzwischen sind keine bestehenden Zuordnungen mehr betroffen.</p>}
    {[...new Set(preview.losses.map((loss) => loss.planId))].map((id) => <section key={id}>
      <h3>{preview.losses.find((loss) => loss.planId === id)!.planName}</h3>
      <ul>{preview.losses.filter((loss) => loss.planId === id).map((loss, index) => <li key={`${loss.kind}-${loss.allocationId}-${index}`}>
        <strong>{loss.productName}</strong> · {loss.pot} · Zuordnung {loss.allocationId}
        {loss.kind === "binding" ? <>
          <br />Wegfallende Zuordnungsinformation: {money.format(loss.lost)}; kein finanzieller Verlust.
          <br />Verbleibende Produktzuordnung: {money.format(loss.remaining)}.
        </> : loss.kind === "phased" ? <>
          <br />Gestaffelter Einstiegsplan {loss.entryId}: {loss.installments} Raten, {frequencies[loss.frequency!] || loss.frequency}, Start {loss.startDate}.
          <br />Entfallender Einstiegsbetrag: {money.format(loss.lost)}; verbleibend: {money.format(loss.remaining)}.
          {loss.note && <><br />{loss.note}</>}
        </> : <><br />Entfallender Allokationsbetrag: {money.format(loss.lost)}; verbleibende Produktzuordnung: {money.format(loss.remaining)}.</>}
      </li>)}</ul>
    </section>)}
    <p>Allokations- und Einstiegsbeträge beschreiben dieselbe Planung aus unterschiedlichen Blickwinkeln und werden nicht addiert.</p>
    <footer><button autoFocus className="secondary" onClick={cancel}>Abbrechen</button>
      <button className="primary" onClick={confirm}>Änderung übernehmen und angezeigte Zuordnungen entfernen</button></footer>
  </dialog>;
}

/** Only an explicit button or Enter commits. Blur and date selection merely edit
 * the draft, so keyboard fragments and modal focus changes cannot reconcile. */
export function NeedTermEditor({ need, referenceDate, busy, onApply }: {
  need: AdvisoryData["needs"][number]; referenceDate: string; busy: boolean; onApply: (input: NeedTermInput) => void;
}) {
  const [date, setDate] = useState(need.dueDate || "");
  const [years, setYears] = useState(need.dueDate ? "" : String(need.years));
  const [mode, setMode] = useState<"date" | "years">(need.dueDate ? "date" : "years");
  useEffect(() => {
    setDate(need.dueDate || ""); setYears(need.dueDate ? "" : String(need.years)); setMode(need.dueDate ? "date" : "years");
  }, [need.id, need.dueDate, need.years]);
  const complete = mode === "date" ? /^\d{4,}-\d{2}-\d{2}$/.test(date)
    : /^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(years) && Number.isFinite(Number(years)) && Number(years) >= 0;
  const valid = complete && Boolean(needCalendarDate(mode === "date" ? { dueDate: date }
    : { years: Number(years) }, referenceDate));
  const dirty = date !== (need.dueDate || "") || years !== (need.dueDate ? "" : String(need.years));
  const apply = () => { if (valid && dirty && !busy) onApply(mode === "date" ? { mode, value: date } : { mode, value: Number(years) }); };
  return <div className="need-term-editor" onKeyDown={(event) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); apply(); }
  }}>
    <label><span>Konkreter Termin</span><input type="date" min="0100-01-01" max="9999-12-31" value={date} onChange={(event) => {
      setDate(event.target.value); setMode("date"); setYears("");
    }} /></label>
    <label><span>Alternativ in Jahren</span><input type="number" min="0" step="any" value={years}
      placeholder={date ? "Konkreter Termin ist führend" : undefined} onChange={(event) => {
        setYears(event.target.value); setDate(""); setMode("years");
      }} /></label>
    <div className="need-term-actions"><button className="secondary" disabled={!dirty || !valid || busy} onClick={apply}>Termin übernehmen</button>
      {dirty && <small role="status">Entwurf – noch nicht übernommen{!valid ? ". Bitte Eingabe vervollständigen." : "."}</small>}
      {dirty && complete && !valid && <small role="alert">{NEED_CALENDAR_ERROR}</small>}
    </div>
  </div>;
}
