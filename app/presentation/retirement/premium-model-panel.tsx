import { useEffect, useId, useState } from "react";
import { createPremiumSession, PUBLIC_MODEL_RIGHTS, type Snapshot } from "../../domain/retirement/premium-session";
import { CUSTOMER_RETURN, parseCustomerTotalReturn, productStressDifference } from "../../domain/retirement/premium-series";
import { resolvePremiumTimeline, type TimelineDraft } from "./premium-timeline";
import type { CustomerPlan } from "./customer-plan-adapter";
import { euro } from "./direct-grant-adapter";
import { buildPremiumDraft, matchingFunding, type PremiumTerms, type SelectedFunding } from "./premium-plan-adapter";

import type { BoundFundingEvidence } from "./premium-funding-evidence-panel";

import { PremiumDocumentControls } from "./premium-document-controls";
import type { PremiumWorkspace, ProductDraft } from "./premium-product-configuration";

type ModelView = { revision: string; snapshot: Snapshot | null; issue: string | null };
export const createModelController = (workspace: PremiumWorkspace | null = null) => ({
  session: createPremiumSession({ rights: workspace?.rights ?? PUBLIC_MODEL_RIGHTS, scope: workspace?.scope, catalog: workspace?.catalog }),
  view: null as ModelView | null,
});

export function PremiumModelPanel({ plan, caseId, caseRevision, terms, change, selection, editFunding, controller, timing, fundingEvidence = null, product = null, showDocuments = false }: {
  plan: CustomerPlan; caseId: string; caseRevision: string; terms: PremiumTerms;
  change: (terms: PremiumTerms) => void; selection: SelectedFunding | null; editFunding: () => void;
  controller: ReturnType<typeof createModelController>; timing: TimelineDraft; fundingEvidence?: BoundFundingEvidence | null; product?: ProductDraft | null; showDocuments?: boolean;
}) {
  const id = useId();
  const [view, setView] = useState(controller.view);
  const publish = (next: ModelView) => { controller.view = next; setView(next); };
  const selected = matchingFunding(plan, selection);
  const { totalReturn, valueBasis, compareWithout } = terms;
  const key = JSON.stringify([caseRevision, terms, selection?.register.registerVersion, fundingEvidence?.data.register.registerVersion, fundingEvidence?.basis, timing, plan, product?.catalog.catalog.hash, product?.paths, product?.configurations]);
  // Do not display a previous result during the first render of a changed or
  // malformed input. Reserve the new revision before calculating it.
  const visible = view?.revision === key ? view : null;
  useEffect(() => {
    const store = controller.session;
    if (controller.view?.revision === key) return;
    const edit = store.edit(caseId, caseRevision, plan, () => buildPremiumDraft(plan, caseId, caseRevision, terms, selection,
      resolvePremiumTimeline(plan, timing, fundingEvidence ? null : selected?.register.hypothesis?.lastYear ?? null), fundingEvidence, product));
    const reservation = store.reserve();
    const snapshot = reservation ? store.commit(reservation) : null;
    publish({ revision: key, snapshot, issue: edit.issue?.reason ?? null });
  }, [caseId, caseRevision, key]);
  let slider = 600;
  let invalidReturn = false;
  try { slider = parseCustomerTotalReturn(totalReturn); }
  catch { invalidReturn = true; }
  const changeSlider = (value: number) => change({ ...terms, totalReturn: (value / 100).toFixed(2).replace(".", ",") });
  const showFix = visible?.snapshot?.complete && visible.snapshot.status === "live_preview";
  return <section className="panel" aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`}>Kapitalmodell mit Gesamtrendite</h2>
    <label htmlFor={`${id}-rate`}>Jährliche Bruttogesamtrendite in %</label>
    <input id={`${id}-rate`} value={totalReturn} inputMode="decimal" aria-invalid={invalidReturn}
      onChange={event => change({ ...terms, totalReturn: event.target.value })} />
    <input aria-label="Bruttogesamtrendite einstellen" type="range" min={CUSTOMER_RETURN.minBps} max={CUSTOMER_RETURN.maxBps}
      step={CUSTOMER_RETURN.sliderStepBps} value={slider} onChange={event => changeSlider(Number(event.target.value))} />
    <div role="group" aria-label="Wertbasis">
      <button type="button" className="secondary" aria-pressed={valueBasis === "nominal"}
        onClick={() => change({ ...terms, valueBasis: "nominal" })}>Nominal</button>
      <button type="button" className="secondary" aria-pressed={valueBasis === "real"}
        onClick={() => change({ ...terms, valueBasis: "real" })}>Kaufkraft</button>
    </div>
    {fundingEvidence ? <p>Belegte Buchungen aus A2 sind automatisch berücksichtigt. Ein offener Förderteil bleibt getrennt.</p> : selected ? <p>Förderannahme aus A2 · Buchungsmonat {selected.bookingMonth} · erstes Beitragsjahr.</p>
      : <p>Förderung offen. Die Vorschau verwendet den Eigenbeitrag.</p>}
    <button type="button" className="secondary" onClick={editFunding}>Förderplan in A2 bearbeiten</button>
    {(selected || fundingEvidence) && <label><input type="checkbox" checked={compareWithout}
      onChange={event => change({ ...terms, compareWithout: event.target.checked })} /> Vergleich ohne Zulagen</label>}
    {invalidReturn && <p role="status">Bitte einen Wert von −10 bis +15 mit höchstens zwei Nachkommastellen eingeben.</p>}
    {!invalidReturn && visible?.issue && <p role="status">{visible.issue === "END_OVERRIDE_CONFLICT"
      ? "Aktuelle Vergleichszahl offen. Bitte den Endmonatkonflikt in A2 auflösen."
      : "Aktuelle Vergleichszahl offen. Bitte Anfangskapital und Zahlungsplan prüfen."}</p>}
    {visible?.snapshot && <section aria-label="Aktuelle Modellvorschau" data-testid="premium-comparison">
      <p>{visible.snapshot.status === "fixed_conditionally" ? "Fixierter bedingter Modellvergleich in dieser Sitzung" : "Bedingte Modellvorschau"}</p>
      <table><thead><tr><th scope="col">Modell</th><th scope="col">Rendite p. a.</th><th scope="col">Kapital am Bewertungsende</th></tr></thead>
        <tbody>{visible.snapshot.subresults.map(item => {
          const result = item.result;
          if (result.status !== "computed") return <tr key={item.subresultId}><th scope="row">Offen</th><td colSpan={2}>{result.reason}</td></tr>;
          const curve = result.value;
          const marketOffset = Number(curve.curveId.split(":").at(-1));
          const rate = curve.modelMode === "M1" ? Number(curve.marketBasis) / 100 : (slider + marketOffset) / 100;
          const label = curve.label ?? (curve.modelMode === "ETF_BRUTTO" ? "ETF-Bruttoreferenz" : curve.fundingPerspective === "BEDINGT_KOMBINIERT"
            ? "Mit gewählter Förderannahme" : curve.fundingPerspective === "NUR_BELEGTE_HISTORIE" ? "Nur belegte Förderbuchungen" : "Ohne Zulagen");
          const last = curve.rows.at(-1);
          const stress = curve.rows.find(row => "portfolio" in row && row.portfolio?.stress)?.portfolio?.stress;
          const endDifference = productStressDifference(visible.snapshot!.subresults, result);
          return <tr key={item.subresultId}><th scope="row">{label}</th><td>{curve.modelMode === "M2" ? "Anlageklassen" : rate.toLocaleString("de-DE") + " %"}</td>
            <td>{curve.complete && curve.end.status === "computed" ? euro(curve.end.cents) : "Offen"}
              {curve.profileIdentity && <small data-testid="premium-result-profile"> · Profil {curve.profileIdentity.version}</small>}
              {stress && <small> · Aktienexponierung {euro(stress.exposedCents)} · unmittelbarer Verlust {euro(stress.lossCents)}</small>}
              {endDifference !== null && <small data-testid="premium-stress-end-difference"> · Endwertdifferenz ohne Stress minus mit Stress {euro(endDifference)}</small>}
              {last && "portfolio" in last && last.portfolio?.targetWeightsBps && <small> · Zielgewichte {last.portfolio.targetWeightsBps.map(w => w / 100).join(" / ")} %</small>}
              {curve.price && <small> · Preise von {curve.price.referenceMonth.slice(5)}/{curve.price.referenceMonth.slice(0, 4)}</small>}</td></tr>;
        })}</tbody>
      </table>
    </section>}
    {showFix && <button type="button" className="secondary" onClick={() => {
      const store = controller.session;
      const ticket = store.reserveOperation("fix");
      if (!ticket || !store.commitOperation(ticket)) return;
      publish({ revision: key, snapshot: store.current(), issue: null });
    }}>Modellvergleich fixieren</button>}
    {showDocuments && <PremiumDocumentControls session={controller.session} snapshot={visible?.snapshot ?? null} caseId={caseId} />}
  </section>;
}
