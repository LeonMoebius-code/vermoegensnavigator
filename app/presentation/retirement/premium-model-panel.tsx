import { useEffect, useId, useState, type ReactNode } from "react";
import { createPremiumSession, PUBLIC_MODEL_RIGHTS, type Snapshot } from "../../domain/retirement/premium-session";
import { CUSTOMER_RETURN, parseCustomerTotalReturn, productStressDifference } from "../../domain/retirement/premium-series";
import { resolvePremiumTimeline, type TimelineDraft } from "./premium-timeline";
import type { CustomerPlan } from "./customer-plan-adapter";
import { euro } from "./direct-grant-adapter";
import { buildPremiumDraft, matchingFunding, type PremiumTerms, type SelectedFunding } from "./premium-plan-adapter";

import type { BoundFundingEvidence } from "./premium-funding-evidence-panel";

import { PremiumDocumentControls } from "./premium-document-controls";
import { analyses, PremiumAnalysis, priceValue, type Analysis } from "./premium-analysis";
import type { ProductId } from "./product-finder-data";
import type { PremiumWorkspace, ProductDraft, ProductConfiguration } from "./premium-product-configuration";

type ModelView = { revision: string; snapshot: Snapshot | null; issue: string | null; curveIds: readonly string[] };
export const createModelController = (workspace: PremiumWorkspace | null = null) => ({
  session: createPremiumSession({ rights: workspace?.rights ?? PUBLIC_MODEL_RIGHTS, scope: workspace?.scope, catalog: workspace?.catalog }),
  view: null as ModelView | null,
});

export function PremiumModelPanel({ headingRef, plan, caseId, caseRevision, terms, change, selection, editFunding, controller, timing, fundingEvidence = null, product = null, showDocuments = false, selectedProducts, toggleProduct, changeConfiguration, editPlan, advisor, toggleReference, configure, workspace }: {
  headingRef: React.Ref<HTMLHeadingElement>;
  plan: CustomerPlan; caseId: string; caseRevision: string; terms: PremiumTerms;
  change: (terms: PremiumTerms) => void; selection: SelectedFunding | null; editFunding: () => void;
  controller: ReturnType<typeof createModelController>; timing: TimelineDraft; fundingEvidence?: BoundFundingEvidence | null; product?: ProductDraft | null; showDocuments?: boolean;
  selectedProducts: readonly ProductId[]; toggleProduct: (id: ProductId) => boolean;
  changeConfiguration: (key: string, value: ProductConfiguration | null) => void;
  editPlan: ReactNode; advisor: boolean; toggleReference: (value: boolean) => void; configure: ReactNode; workspace: PremiumWorkspace | null;
}) {
  const [analysis, setAnalysis] = useState<Analysis>("capital");
  const id = useId();
  const [view, setView] = useState(controller.view);
  const publish = (next: ModelView) => { controller.view = next; setView(next); };
  const selected = matchingFunding(plan, selection);
  const { totalReturn, valueBasis, compareWithout } = terms;
  const screen = workspace?.rights.screen ?? PUBLIC_MODEL_RIGHTS.screen;
  const key = JSON.stringify([caseRevision, terms, workspace?.rights, workspace?.scope, selection?.register.registerVersion, fundingEvidence?.data.register.registerVersion, fundingEvidence?.basis, timing, plan, product?.catalog.catalog.hash, product?.paths, product?.configurations]);
  // Do not display a previous result during the first render of a changed or
  // malformed input. Reserve the new revision before calculating it.
  const visible = screen.allowed && view?.revision === key ? view : null;
  useEffect(() => {
    const store = controller.session;
    store.replaceCatalog(workspace?.catalog ?? null);
    store.replaceRights(workspace?.rights ?? PUBLIC_MODEL_RIGHTS);
    if (controller.view?.revision === key) return;
    let curveIds: readonly string[] = [];
    const edit = store.edit(caseId, caseRevision, plan, () => {
      const draft = buildPremiumDraft(plan, caseId, caseRevision, terms, selection,
        resolvePremiumTimeline(plan, timing, fundingEvidence ? null : selected?.register.hypothesis?.lastYear ?? null), fundingEvidence, product);
      curveIds = draft.curves.map(curve => curve.id);
      return draft;
    });
    const reservation = store.reserve();
    const snapshot = reservation ? store.commit(reservation) : null;
    publish({ revision: key, snapshot, curveIds, issue: edit.issue?.reason ?? null });
  }, [caseId, caseRevision, key]);
  let slider = 600;
  let invalidReturn = false;
  try { slider = parseCustomerTotalReturn(totalReturn); }
  catch { invalidReturn = true; }
  const changeSlider = (value: number) => change({ ...terms, totalReturn: (value / 100).toFixed(2).replace(".", ",") });
  const showFix = visible?.snapshot?.complete && visible.snapshot.status === "live_preview";
  const planControls = <div className="avd-controls avd-plan-controls">
        <div className="avd-range-field">
          <label htmlFor={`${id}-rate`}>Jährliche Bruttogesamtrendite in %</label>
          <input id={`${id}-rate`} value={totalReturn} inputMode="decimal" aria-invalid={invalidReturn}
            onChange={event => change({ ...terms, totalReturn: event.target.value })} />
          <input aria-label="Bruttogesamtrendite einstellen" type="range" min={CUSTOMER_RETURN.minBps} max={CUSTOMER_RETURN.maxBps}
            step={CUSTOMER_RETURN.sliderStepBps} value={slider} aria-valuetext={invalidReturn ? "Offen" : slider / 100 + " %"}
            onChange={event => changeSlider(Number(event.target.value))} />
        </div>
        {editPlan}
      </div>;
  const capitalOptions = <div className="avd-analysis-options">
        <label className="retirement-checkbox"><input type="checkbox" checked={plan.capital.referenceEnabled}
          onChange={event => toggleReference(event.target.checked)} />ETF-Bruttoreferenz anzeigen</label>
        {(selected || fundingEvidence) && <label className="retirement-checkbox"><input type="checkbox" checked={compareWithout}
          onChange={event => change({ ...terms, compareWithout: event.target.checked })} />Vergleich ohne Zulagen</label>}
        {!fundingEvidence && !selected && <p className="avd-note">Förderung offen · Vorschau mit eigenen Zahlungen.</p>}
      </div>;
  return <section className="avd-analysis" aria-labelledby={`${id}-heading`}>
    <div className="avd-analysis-topbar">
      <nav className="avd-analysis-nav" aria-label="Finanzanalysen">
        {analyses.map((item, i) => <button type="button" key={item.id} aria-current={analysis === item.id ? "page" : undefined}
          onClick={() => setAnalysis(item.id)}><span aria-hidden="true">{i + 1}</span>{item.label}</button>)}
      </nav>
      <p className="retirement-session-note">Vorschau · Nur synthetische Eingaben · Keine Speicherung</p>
    </div>
    <div className="panel avd-analysis-panel" data-analysis={analysis}>
      <header className="avd-analysis-header">
        <h1 ref={headingRef} tabIndex={-1} id={`${id}-heading`}>{analyses.find(item => item.id === analysis)!.label}</h1>
        <div className="avd-segment" role="group" aria-label="Wertbasis">
          <button type="button" aria-pressed={valueBasis === "nominal"} onClick={() => change({ ...terms, valueBasis: "nominal" })}>Nominal</button>
          <button type="button" aria-pressed={valueBasis === "real"} onClick={() => change({ ...terms, valueBasis: "real" })}>Kaufkraft</button>
        </div>
      </header>
      {valueBasis === "real" && <div className="avd-controls avd-price-controls">
        <label>Inflationsannahme pro Jahr in %<input inputMode="decimal" value={terms.inflationText ?? String(terms.inflation / 100).replace(".", ",")}
          aria-invalid={visible?.issue === "INFLATION_OPEN"} onChange={event => change({ ...terms, inflationText: event.target.value })} /></label>
        <label>Preisbezugsmonat · optional<input type="month" value={terms.priceMonth ?? ""} onChange={event => change({ ...terms, priceMonth: event.target.value })} /></label>
        {!terms.priceMonth && <small>Automatischer Preisbezug auf den Monat der Berechnung.</small>}
      </div>}
      {invalidReturn && <p className="avd-open" role="status">Bitte einen Wert von −10 bis +15 mit höchstens zwei Nachkommastellen eingeben.</p>}
      {!invalidReturn && visible?.issue && <p className="avd-open" role="status">{visible.issue === "END_OVERRIDE_CONFLICT"
        ? "Aktuelle Vergleichszahl offen. Bitte den Endmonatkonflikt in A2 auflösen."
        : visible.issue === "INFLATION_OPEN" ? "Bitte eine Inflationsannahme über −100 % mit höchstens zwei Nachkommastellen eingeben."
          : "Aktuelle Vergleichszahl offen. Bitte Anfangskapital und Zahlungsplan prüfen."}</p>}
      <PremiumAnalysis analysis={analysis} snapshot={visible?.snapshot ?? null} curveIds={visible?.curveIds ?? []}
        controls={planControls} capitalOptions={capitalOptions} product={screen.allowed ? product : null} payoutMonth={timing.payoutMonth} selected={selectedProducts} toggle={toggleProduct} changeConfiguration={changeConfiguration} />
    </div>
    {configure}
    <div className="avd-model-footer">
    {fundingEvidence ? <p>Belegte Buchungen aus A2 sind automatisch berücksichtigt. Ein offener Förderteil bleibt getrennt.</p> : selected ? <p>Förderannahme aus A2 · Buchungsmonat {selected.bookingMonth} · erstes Beitragsjahr.</p>
      : <p>Förderung offen. Die Vorschau verwendet den Eigenbeitrag.</p>}
    <button type="button" className="secondary" onClick={editFunding}>Förderplan in A2 bearbeiten</button>
    {visible?.snapshot && <section aria-label="Aktuelle Modellvorschau" data-testid="premium-comparison">
      <p className="avd-note">{visible.snapshot.status === "fixed_conditionally" ? "Fixierter bedingter Modellvergleich in dieser Sitzung" : "Bedingte Modellvorschau"}</p>
      {visible.snapshot.comparisonIssues.length > 0 && <p role="status">Die Endwertdifferenz ist offen. Für den Stressvergleich fehlt eine vollständige Rechnung auf derselben Grundlage.</p>}
      <div className="avd-table-scroll"><table><thead><tr><th scope="col">Modell</th><th scope="col">Rendite p. a.</th><th scope="col">Kapital am Bewertungsende</th></tr></thead>
        <tbody>{visible.snapshot.subresults.map(item => {
          const result = item.result;
          if (result.status !== "computed") return <tr key={item.subresultId}><th scope="row">Offen</th><td colSpan={2}>{result.reason}</td></tr>;
          const curve = result.value;
          const marketOffset = Number(curve.curveId.split(":").at(-1));
          const rate = curve.modelMode === "M1" ? Number(curve.marketBasis) / 100 : (slider + marketOffset) / 100;
          const label = curve.label ?? (curve.modelMode === "ETF_BRUTTO" ? "ETF-Bruttoreferenz" : curve.fundingPerspective === "BEDINGT_KOMBINIERT"
            ? "Mit gewählter Förderannahme" : curve.fundingPerspective === "NUR_BELEGTE_HISTORIE" ? "Nur belegte Förderbuchungen" : "Ohne Zulagen");
          const last = curve.rows.at(-1);
          const stressRow = curve.rows.find(row => "portfolio" in row && row.portfolio?.stress);
          const stress = stressRow?.portfolio?.stress;
          const endDifference = productStressDifference(visible.snapshot!.subresults, result);
          return <tr key={item.subresultId}><th scope="row">{label}</th><td>{curve.modelMode === "M2" ? "Anlageklassen" : rate.toLocaleString("de-DE") + " %"}</td>
            <td>{curve.complete && curve.end.status === "computed" ? euro(curve.end.cents) : "Offen"}
              {curve.profileIdentity && <small data-testid="premium-result-profile"> · Profil {curve.profileIdentity.version}</small>}
              {stress && stressRow && <small> · Aktienexponierung {euro(priceValue(curve, stress.exposedCents, stressRow.month))}
                {" · unmittelbarer Verlust "}{euro(priceValue(curve, stress.lossCents, stressRow.month))}</small>}
              {endDifference !== null && <small data-testid="premium-stress-end-difference"> · Endwertdifferenz ohne Stress minus mit Stress {euro(endDifference)}</small>}
              {last && "portfolio" in last && last.portfolio?.targetWeightsBps && <small> · Zielgewichte {last.portfolio.targetWeightsBps.map(w => w / 100).join(" / ")} %</small>}
              {curve.price && <small> · Preise von {curve.price.referenceMonth.slice(5)}/{curve.price.referenceMonth.slice(0, 4)}</small>}</td></tr>;
        })}</tbody>
      </table></div>
      {advisor && <details className="avd-disclosure"><summary>Revisions- und Modellnachweis</summary>
        <p>Vergleichsrevision <code>{visible.snapshot.comparisonRevision}</code> · Berechnungszeitpunkt {visible.snapshot.reservedAt}</p>
        <ul>{visible.snapshot.subresults.map((item, i) => <li key={item.subresultId}>
          {item.result.status === "computed" ? item.result.value.label ?? item.result.value.modelMode : "Offen"} · {visible.curveIds[i]}
          {item.result.status === "computed" && ` · ${item.result.evidence.class} · ${item.result.evidence.source} · ${item.result.evidence.version}`}
          {item.original && ` · Originalrevision ${item.original.comparisonRevision}`}
        </li>)}</ul>
      </details>}
    </section>}
    {showFix && <button type="button" className="secondary" onClick={() => {
      const store = controller.session;
      const ticket = store.reserveOperation("fix");
      if (!ticket || !store.commitOperation(ticket)) return;
      publish({ revision: key, snapshot: store.current(), issue: null, curveIds: visible!.curveIds });
    }}>Modellvergleich fixieren</button>}
    {showDocuments && <PremiumDocumentControls session={controller.session} snapshot={visible?.snapshot ?? null} caseId={caseId} />}
    </div>
  </section>;
}
