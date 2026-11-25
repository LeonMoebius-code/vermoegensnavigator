import { newPremiumIdentity } from "../../domain/retirement/premium-contract";
import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { directGrantRuleContext } from "../../domain/retirement/direct-grant-rules";
import { changeYear, euro } from "./direct-grant-adapter";
import { oldRiesterRuleContext } from "../../domain/retirement/old-riester-grant-rules";
import { changeOldMode, changeOldYear, emptyOldDraft, oldContribution, oldRuleId, previewComparison, previewOldGrant,
  type Comparison, type NewScenario, type OldDraft, type OldField, type OldPreview, type NewPreview } from "./old-riester-adapter";
import { emptyRiesterJourney, RiesterJourney } from "./riester-journey";
import { RetirementProducts, type ProductFinderStep } from "./retirement-products";
import { emptyProductAnswers, nextProductAnswers, nextProductSelection, type ProductId } from "./product-finder-data";
import { RetirementCapital, type CapitalView } from "./retirement-capital";
import { bindCapitalConfirmations, editCustomerCapital, emptyCustomerPlan, incompleteYearMessage, editMonthlyContribution, paymentYear, revokeCapitalConfirmations, runCustomerCapital, validBirthYear, validContributionYear, type ChangeCustomerPlan, type CustomerPlan } from "./customer-plan-adapter";
import { RetirementCustomer } from "./retirement-customer";
import { emptyRetirementAnswers, invalidateAnswer, RetirementInformation, RetirementQuestions, type RetirementAnswers } from "./retirement-questions";
import type { CapitalRun } from "./projection-adapter";
import { DEFAULT_TIMELINE_DRAFT, resolvePremiumTimeline, type TimelineDraft } from "./premium-timeline";
import { PremiumModelPanel, createModelController } from "./premium-model-panel";
import { DEFAULT_PREMIUM_TERMS, currentBoundFunding, fundingBasis, matchingFunding, selectScenarioFunding, timedPaymentBasis, type PremiumTerms, type SelectedFunding } from "./premium-plan-adapter";

import { jsonHash } from "../../domain/case/recovery-hash";
import { modelCatalog } from "../../domain/retirement/model-catalog";
import { productChannelAllowed } from "../../domain/retirement/premium-products";
import { PUBLIC_MODEL_RIGHTS } from "../../domain/retirement/premium-session";
import { PremiumTimelinePanel } from "./premium-timeline-panel";
import { PremiumProductPanel } from "./premium-product-panel";
import { type Configurations, type PremiumWorkspace, type ProductConfiguration } from "./premium-product-configuration";
import { FundingEvidencePanel, type BoundFundingEvidence } from "./premium-funding-evidence-panel";

export interface RetirementNavigation { confirmDiscard: () => boolean }
const discardMessage = "Ungespeicherten Altersvorsorgeentwurf verwerfen? Alle Vorsorgeeingaben gehen verloren. Allgemeine Vermögensfälle bleiben erhalten.";
const switchMessage = "Zum Riester-Bestand wechseln? Ihre Eingaben bleiben in dieser Sitzung erhalten. Die aktuelle A4-Vorschau und ihre Modellbestätigungen werden zurückgesetzt.";
const bonusNotice = "Einmalbonus gesondert zu prüfen; in den angezeigten Förderbeträgen nicht enthalten.";
const modelNotice = "Jahresbezogene Modellrechnung, keine individuelle Förderzusage. Einmalbonus gesondert prüfen.";
const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
function Help({ children }: { children: ReactNode }) {
  return <details className="retirement-help"><summary>Was bedeutet das?</summary><p>{children}</p></details>;
}

const steps = [
  { id: "a1", label: "A1 Fördercheck", title: "Ihre Situation und Förderung" },
  { id: "a2", label: "A2 Sparen & Förderung", title: "Ihr Beitrag und Ihre Förderung" },
  { id: "a3", label: "A3 Produktvergleich", title: "Welche Anlage passt zu Ihren Wünschen?" },
  { id: "a4", label: "A4 Kapitalentwicklung", title: "Ihre mögliche Kapitalentwicklung" },
] as const;
type AStep = typeof steps[number]["id"];
type Step = AStep | "choice" | "b1" | "b2";


/** The entire draft lives here; unmount discards it. */
export const RetirementEntry = forwardRef<RetirementNavigation, { workspace?: PremiumWorkspace }>(function RetirementEntry({ workspace }, ref) {
  const catalog = useMemo(() => workspace ? modelCatalog(workspace.catalog, "internal") : null, [workspace?.catalog]);
  const allowedWorkspace = workspace && catalog && (workspace.scope === "internal" || productChannelAllowed(catalog, "display")) ? workspace : null;
  const [step, setStep] = useState<Step>("choice");
  const [advisor, setAdvisor] = useState(false);
  const [intro, setIntro] = useState(true);
  const [plan, setPlan] = useState(emptyCustomerPlan);
  const [premiumId, setPremiumId] = useState(() => newPremiumIdentity());
  const [premiumRevision, setPremiumRevision] = useState(() => newPremiumIdentity());
  const [premiumController, setPremiumController] = useState(() => createModelController(allowedWorkspace));
  const [configurations, setConfigurations] = useState<Configurations>({});
  const [premiumTiming, setPremiumTiming] = useState<TimelineDraft>(DEFAULT_TIMELINE_DRAFT);
  const [premiumTerms, setPremiumTerms] = useState<PremiumTerms>(DEFAULT_PREMIUM_TERMS);
  const [premiumFunding, setPremiumFunding] = useState<SelectedFunding | null>(null);
  const [fundingEvidence, setFundingEvidence] = useState<BoundFundingEvidence | null>(null);
  const currentPlan = useRef(plan);
  const [answers, setAnswers] = useState(() => ({ ...emptyRetirementAnswers(), year: paymentYear(plan.capital.start) }));
  const currentAnswers = useRef(answers);
  const [questionSection, setQuestionSection] = useState(0);
  const [yearFocus, setYearFocus] = useState(0);
  const [productFinder, setProductFinder] = useState({ selected: [] as readonly ProductId[], answers: emptyProductAnswers });
  const currentFinder = useRef(productFinder);
  const activePaths = allowedWorkspace?.rights.screen.allowed
    ? allowedWorkspace.paths.filter(path => productFinder.selected.includes(path.selection)) : [];
  const premiumProducts = catalog && activePaths.length ? { catalog, paths: activePaths, configurations } : null;
  const changePremiumConfiguration = (key: string, next: ProductConfiguration | null) => {
    premiumController.session.invalidate();
    setConfigurations(prior => {
      const own = { ...prior };
      const before = own[key];
      if (!next) delete own[key];
      else {
        const profileContent = ({ stressLoss: _loss, stressMonth: _month, version: _version, ...profile }: ProductConfiguration) => profile;
        const sameProfile = before && jsonHash(profileContent(before)) === jsonHash(profileContent(next));
        own[key] = { ...next, version: sameProfile ? before.version : newPremiumIdentity() };
      }
      return own;
    });
    setPremiumRevision(newPremiumIdentity());
    setDirty(true);
  };
  const [productStep, setProductStep] = useState<ProductFinderStep>(0);
  const [result, setResult] = useState<CapitalRun | null>(null);
  const [refresh, setRefresh] = useState<"none" | "calculated" | "products" | "inputs">("none");
  const [capitalView, setCapitalView] = useState<CapitalView>("neutral");
  const [bDraft, setBDraft] = useState(emptyOldDraft);
  const [bJourney, setBJourney] = useState(emptyRiesterJourney);
  const [bPreview, setBPreview] = useState<Comparison | null>(null);
  const [dirty, setDirty] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);

  const invalidateResult = (cause: "products" | "inputs") => {
    setResult(null);
    setRefresh(status => status === "none" ? "none" : cause);
  };
  const storePlan = (next: CustomerPlan) => {
    premiumController.session.invalidate();
    currentPlan.current = next;
    setPlan(next);
    setPremiumRevision(newPremiumIdentity());
    setPremiumFunding(prior => matchingFunding(next, prior));
  };
  const storeAnswers = (next: RetirementAnswers) => {
    currentAnswers.current = next;
    setAnswers(next);
  };
  // Event handlers commit one edit against the latest draft. The ref is updated
  // before React renders, so another edit or calculation in the same batch sees it.
  const updatePlan: ChangeCustomerPlan = edit => {
    const prior = currentPlan.current, next = bindCapitalConfirmations(prior, edit(prior));
    if (JSON.stringify(prior) === JSON.stringify(next)) return;
    if (next.capital.start !== prior.capital.start) {
      const year = paymentYear(next.capital.start);
      if (year !== currentAnswers.current.year) storeAnswers({ ...currentAnswers.current, year });
    }
    if (JSON.stringify([next.capital, next.contribution]) !== JSON.stringify([prior.capital, prior.contribution])
      || validBirthYear(next.birthYear, next.capital.start) !== validBirthYear(prior.birthYear, prior.capital.start))
      invalidateResult("inputs");
    storePlan(next);
    setDirty(true);
  };
  const yearIsBound = () => validContributionYear(currentAnswers.current.year)
    && currentAnswers.current.year === paymentYear(currentPlan.current.capital.start);
  const navigateA = (target: AStep) => {
    if (target !== "a1" && !yearIsBound()) {
      setIntro(false);
      setQuestionSection(0);
      setStep("a1");
      setYearFocus(request => request + 1);
      return;
    }
    setStep(target);
  };
  const changeSituation = (current: CustomerPlan, next: CustomerPlan, affectsCalendarOrValidity = false): CustomerPlan => {
    // A1 provides no payments to the neutral model. Its legal context only
    // binds a separately enabled grant hypothesis, while the calendar and
    // a blocking input error affect the whole calculation.
    if (!current.capital.grantEnabled && !affectsCalendarOrValidity) return next;
    return revokeCapitalConfirmations(next, ["confirmed", "grantConfirmed"]);
  };
  const answer = <K extends keyof RetirementAnswers>(key: K, value: RetirementAnswers[K]) => {
    const prior = currentAnswers.current;
    if (prior[key] === value) return;
    const next = { ...prior, [key]: value };
    if ((key === "care" || key === "upbringing") && value) next.additions = "";
    if (key === "additions" && value) { next.care = false; next.upbringing = false; }
    storeAnswers(next);
    updatePlan(current => {
      let p = invalidateAnswer(current, key);
      if (key === "childBenefit") p = { ...p, children: value === "yes" ? "yes" : value === "no" ? "no" : "unknown" };
      if (key === "year" && validContributionYear(next.year)) {
        const month = paymentYear(p.capital.start) ? p.capital.start.slice(5) : "01";
        p = editCustomerCapital(p, { ...p.capital, start: `${next.year}-${month}` });
      }
      return changeSituation(current, p, key === "year");
    });
    if (key === "year") invalidateResult("inputs");
    setDirty(true);
  };
  const changeBirth = (value: string) => updatePlan(p => {
    if (p.birthYear === value) return p;
    const validityChanged = validBirthYear(p.birthYear, p.capital.start) !== validBirthYear(value, p.capital.start);
    return changeSituation(p, { ...p, birthYear: value, evidence: changeYear(p.evidence, p.evidence.year) }, validityChanged);
  });
  const storeProductFinder = (next: typeof productFinder) => {
    currentFinder.current = next;
    setProductFinder(next);
  };
  const productFinderChanged = () => {
    const p = currentPlan.current;
    storePlan(revokeCapitalConfirmations(p));
    invalidateResult("products");
    setDirty(true);
  };
  const toggleProduct = (id: ProductId) => {
    const current = currentFinder.current, selected = current.selected;
    const next = nextProductSelection(selected.includes(id) ? selected.filter(candidate => candidate !== id) : [...selected, id], selected);
    if (!next) return false;
    if (next !== selected) {
      storeProductFinder({ ...current, selected: next });
      productFinderChanged();
    }
    return true;
  };
  const changeProductAnswers = (input: unknown) => {
    const current = currentFinder.current;
    const next = nextProductAnswers(input, current.answers);
    if (next && next !== current.answers) {
      storeProductFinder({ ...current, answers: next });
      productFinderChanged();
    }
  };
  const updateB = (next: OldDraft) => {
    if (next.year !== bDraft.year || next.contract !== bDraft.contract || next.regime !== bDraft.regime) setBJourney(ux => ({ ...ux, payout: "" }));
    setBDraft(next); setDirty(true); setBPreview(null);
  };
  const enterB = () => {
    const p = currentPlan.current;
    if (p.capital.confirmed && !window.confirm(switchMessage)) return;
    storePlan(revokeCapitalConfirmations(p));
    invalidateResult("inputs");
    setBPreview(null);
    setStep("b1");
  };
  const changeTiming = (value: TimelineDraft) => {
    premiumController.session.invalidate();
    setPremiumTiming(value); setPremiumRevision(newPremiumIdentity()); setDirty(true);
    if (value.mode === "holdings_only") setPremiumFunding(null);
    try {
      const t = resolvePremiumTimeline(currentPlan.current, value, null);
      if (t.contributions.kind === "regular" && value.mode === "end_age") {
        const end = t.contributions.last;
        updatePlan(p => editCustomerCapital(p, { ...p.capital, end }));
      }
    } catch (error) { if (!(error instanceof Error) || error.name !== "AvdError") throw error; }
  };
  const configureProducts = (showPreference: boolean) => premiumProducts && <PremiumProductPanel
    paths={activePaths} catalog={premiumProducts.catalog} values={configurations} change={changePremiumConfiguration} payoutMonth={premiumTiming.payoutMonth}
    setPayoutMonth={payoutMonth => changeTiming({ ...premiumTiming, payoutMonth })} advisor={advisor} showPreference={showPreference} />;
  const confirmDiscard = () => !dirty || window.confirm(discardMessage);
  useImperativeHandle(ref, () => ({ confirmDiscard }), [dirty]);
  useEffect(() => { title.current?.focus(); }, [step, intro]);
  useEffect(() => {
    premiumController.session.replaceCatalog(allowedWorkspace?.catalog ?? null);
    premiumController.session.replaceRights(allowedWorkspace?.rights ?? PUBLIC_MODEL_RIGHTS);
  }, [allowedWorkspace, premiumController]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const restart = () => {
    if (!confirmDiscard()) return;
    setDirty(false); setStep("choice"); setIntro(true); setAdvisor(false);
    setPremiumId(newPremiumIdentity()); setPremiumController(createModelController(allowedWorkspace)); setConfigurations({}); setPremiumTerms(DEFAULT_PREMIUM_TERMS); setPremiumTiming(DEFAULT_TIMELINE_DRAFT); setPremiumFunding(null); setFundingEvidence(null);
    setBDraft(emptyOldDraft()); setBPreview(null); setBJourney(emptyRiesterJourney());
    storeProductFinder({ selected: [], answers: emptyProductAnswers }); setProductStep(0);
    setResult(null); setRefresh("none"); setCapitalView("neutral");
    const fresh = emptyCustomerPlan();
    storePlan(fresh); storeAnswers({ ...emptyRetirementAnswers(), year: paymentYear(fresh.capital.start) });
    setQuestionSection(0); setYearFocus(0);
  };

  const guided = steps.find(s => s.id === step);
  const activePaymentBasis = timedPaymentBasis(plan, premiumTiming);
  const payments = activePaymentBasis.payments;
  const activeSelection = activePaymentBasis.effective && premiumTiming.mode !== "holdings_only"
    ? matchingFunding(activePaymentBasis.effective, premiumFunding) : null;
  const monthError = payments.status === "invalid_input" && payments.field === "monthly" ? payments.message : null;
  return <div className={`tool-view retirement-view retirement-ux2${guided ? " avd-workspace" : ""}`} data-retirement-stage={step}>
    {guided ? <div className="avd-workbar avd-journey-toolbar">
      <button className="retirement-route-back" onClick={() => setStep("choice")}><span aria-hidden="true">‹</span> A/B-Auswahl</button>
      <nav className="retirement-steps retirement-guided-nav" aria-label="Altersvorsorge-Schritte">
        {steps.map(item => <button key={item.id} aria-current={step === item.id ? "step" : undefined} onClick={() => navigateA(item.id)}>{item.label}</button>)}
      </nav>
      <div className="avd-segment" role="group" aria-label="Beratungsansicht">
        <button type="button" aria-pressed={!advisor} onClick={() => setAdvisor(false)}>Kundenansicht</button>
        <button type="button" aria-pressed={advisor} onClick={() => setAdvisor(true)}>Berateransicht</button>
      </div>
    </div> : null}
    {step !== "a4" && <header className="retirement-journey-header">
      <h1 ref={title} tabIndex={-1}>{guided?.title ?? (step === "choice" ? "Altersvorsorge" : step === "b1" ? "B1 – Bestandsaufnahme" : "B2 – Fördervergleich")}</h1>
      <p className="retirement-session-note">Flüchtige Vorschau · Nur synthetische Daten verwenden · Eingaben werden nicht gespeichert</p>
    </header>}
    {step === "choice" ? <>
      <div className="retirement-cards retirement-entry-cards">
        <section className="panel">
          <h2>Neue Altersvorsorge planen</h2>
          <p>Fördervoraussetzungen klären, Beiträge planen und Anlagealternativen vergleichen.</p>
          <button className="primary" onClick={() => setStep("a1")}>Neue Altersvorsorge planen</button>
        </section>
        <section className="panel">
          <h2>Bestehende Riester-Rente prüfen</h2>
          <p>Den bestehenden Vertrag einordnen und die alte mit der neuen Förderung vergleichen.</p>
          <button className="primary" onClick={enterB}>B – Bestehende Riester-Rente prüfen</button>
        </section>
      </div>
      <details className="retirement-help"><summary>Was ist ein Altersvorsorgedepot?</summary><RetirementInformation /></details>
      <p className="retirement-session-note-detail">Beim Neuladen oder Verlassen verfällt der Entwurf. Es gibt keine automatische Wiederherstellung.</p>
    </> : step === "b1" || step === "b2" ? <>
      <p className="retirement-notice">{modelNotice} {bonusNotice}</p>
      <RiesterJourney ux={bJourney} draft={bDraft} step={step} preview={bPreview}
        change={(next, dirty = true) => { setBJourney(next); if (dirty) setDirty(true); }}
        update={updateB} navigate={next => { setBPreview(null); setStep(next); }}>
        <OldRiesterView draft={bDraft} step={step} preview={bPreview}
          navigate={next => { setBPreview(null); setStep(next); }} update={updateB} show={setBPreview} />
      </RiesterJourney>
    </> : <>

      {step === "a1" ? intro ? <div className="retirement-introduction">
        <RetirementInformation />
        <button className="primary" onClick={() => setIntro(false)}>Meine Voraussetzungen prüfen</button>
      </div> : <RetirementQuestions answers={answers} plan={plan} change={answer}
        section={questionSection} setSection={setQuestionSection}
        birth={changeBirth} yearFocus={yearFocus} advisor={advisor}
        back={() => setIntro(true)} next={() => navigateA("a2")} riester={enterB} />
      : step === "a2" ? <><RetirementCustomer plan={plan} change={updatePlan} back={() => navigateA("a1")}
        timing={premiumTiming} changeTiming={changeTiming} advisor={advisor} onAdvisor={() => setAdvisor(true)}
        boundFunding={fundingEvidence} fundingSelection={activeSelection?.bookingMonth ?? null} chooseFunding={month => {
          const active = timedPaymentBasis(currentPlan.current, premiumTiming);
          const choice = month === null || !active.effective || premiumTiming.mode === "holdings_only" ? null
            : selectScenarioFunding(active.effective, premiumId, month);
          if (month !== null && !choice) return false;
          premiumController.session.invalidate();
          setPremiumFunding(choice); setPremiumRevision(newPremiumIdentity()); setDirty(true);
          return true;
        }} next={() => {
        if (!yearIsBound() || timedPaymentBasis(currentPlan.current, premiumTiming).payments.status !== "valid") return false;
        navigateA("a3");
        return true;
      }} /><FundingEvidencePanel value={fundingEvidence}
        isCurrent={currentBoundFunding(plan, activePaymentBasis.timeline, fundingEvidence)}
        bind={(data, previous) => {
          premiumController.session.invalidate();
          setFundingEvidence(data ? { data, basis: activePaymentBasis.effective && premiumTiming.mode !== "holdings_only" ? fundingBasis(activePaymentBasis.effective) : "",
            holdingsBasis: activePaymentBasis.effective && premiumTiming.mode === "holdings_only" ? fundingBasis(activePaymentBasis.effective) : undefined,
            opening: plan.capital.initial }
            : previous ? { ...previous, basis: "", holdingsBasis: undefined } : null);
          setPremiumFunding(null);
          setPremiumRevision(newPremiumIdentity());
          setDirty(true);
        }} /></>
      : step === "a3" ? <>
        <RetirementProducts selected={productFinder.selected} toggleSelection={toggleProduct} answers={productFinder.answers}
          changeAnswers={changeProductAnswers} step={productStep} navigate={setProductStep} next={() => navigateA("a4")} />
        {configureProducts(true)}
      </> : <>
        <PremiumModelPanel headingRef={title} plan={plan} caseId={premiumId} caseRevision={premiumRevision} controller={premiumController}
          timing={premiumTiming} terms={premiumTerms} selection={premiumFunding} fundingEvidence={fundingEvidence} product={premiumProducts}
          configure={configureProducts(false)} workspace={allowedWorkspace}
          showDocuments={Boolean(allowedWorkspace)} editFunding={() => navigateA("a2")} advisor={advisor}
          selectedProducts={productFinder.selected} toggleProduct={toggleProduct} changeConfiguration={changePremiumConfiguration}
          toggleReference={referenceEnabled => updatePlan(p => editCustomerCapital(p, { ...p.capital, referenceEnabled }))}
          editPlan={<>
            {premiumTiming.mode !== "holdings_only" && <aside className="avd-plan-rate avd-range-field" aria-label="Aktueller Beratungsstand">
              <label htmlFor="avd-monthly-rate">Monatsrate in Euro</label>
              <input id="avd-monthly-rate" inputMode="decimal" value={plan.capital.monthly} aria-invalid={Boolean(monthError)}
                aria-describedby={monthError ? "avd-monthly-error" : undefined}
                onChange={event => { const monthly = event.target.value; updatePlan(p => editMonthlyContribution(p, { ...p.capital, monthly })); }} />
              <input type="range" aria-label="Monatsrate im Kapitalmodell einstellen" min={0}
                max={Math.max(570, payments.status === "valid" ? payments.monthly / 100 : 0)} step={5}
                value={payments.status === "valid" ? payments.monthly / 100 : 0}
                aria-valuetext={payments.status === "valid" ? euro(payments.monthly) : "Offen"}
                onChange={event => { const monthly = event.target.value; updatePlan(p => editMonthlyContribution(p, { ...p.capital, monthly })); }} />
              {monthError && <small id="avd-monthly-error" role="status">{monthError}</small>}
              {currentBoundFunding(plan, activePaymentBasis.timeline, fundingEvidence) && fundingEvidence?.data.ownPayments
                ? <small>Beitragsentwurf · aktuell gelten die datierten Vertragszahlungen.</small>
                : payments.status === "valid" && <small>{euro(payments.monthly)} mtl. · {euro(payments.total)} im ersten Beitragsjahr</small>}
            </aside>}
            <PremiumTimelinePanel compact plan={plan} draft={premiumTiming} change={changeTiming}
              changeEnd={end => updatePlan(p => editCustomerCapital(p, { ...p.capital, end }))} />
          </>}
          change={terms => { premiumController.session.invalidate(); setPremiumTerms(terms); setDirty(true); }} />
        <div className="avd-legacy-model">
          <h2>Separate Modellvorschau mit Anlageklassen</h2>
          {(premiumTiming.mode === "holdings_only" || !activePaymentBasis.effective) && <p className="avd-note">Diese getrennte Vorschau verwendet den regulären Beitragsentwurf, nicht die aktuelle Zahlungsgrundlage der Kapitalentwicklung.</p>}
          <RetirementCapital plan={plan} change={updatePlan} result={result}
            stale={refresh === "products" ? "Produktwahl oder Orientierung geändert. Die bisherige Vorschau ist veraltet. Bestätigen Sie Ihre Modellannahmen für eine neue Berechnung."
              : refresh === "inputs" ? "Die bisherige Vorschau ist veraltet. Berechnen Sie die Kapitalentwicklung mit den aktuellen Angaben erneut." : null}
            view={capitalView} setView={setCapitalView} selected={productFinder.selected}
            calculate={() => {
              const next: CapitalRun = yearIsBound() ? runCustomerCapital(currentPlan.current)
                : { status: "invalid_input", field: "start", message: incompleteYearMessage };
              setResult(next);
              if (next.status === "responses" && next.responses.every(response => response.status === "calculated" || response.status === "partial"))
                setRefresh("calculated");
              setDirty(true);
              return next;
            }} />
        </div>
      </>}
    </>}
    {step !== "choice" && <button className="secondary retirement-restart" onClick={restart}>Spezialentwurf neu starten</button>}
  </div>;
});

const childChoices = [["unconfirmed", "Unklar / noch nicht bestätigt"], ["none_confirmed", "Vollständig geprüft: keine einzubeziehenden Kinder"],
  ["list_confirmed", "Vollständige Liste – jedes Kind einzeln bestätigen"], ["conflicting", "Widersprüchlich – fachlich klären"]] as const;
const assignments = [["assignment_unconfirmed", "Zuordnung noch nicht bestätigt"], ["eligibility_unconfirmed", "Förderfähigkeit ungeklärt"],
  ["eligible_assigned_confirmed", "Förderfähigkeit und Personenzuordnung für Jahr und Regime bestätigt"], ["conflicting_assignment", "Zuordnung widersprüchlich"]] as const;
const statusText = (p: OldPreview | NewPreview) => p.status === "calculated" ? "Berechnet" :
  `${p.status === "review_required" ? "Fachlich prüfen" : p.status === "unsupported" ? "Derzeit nicht unterstützt (keine Aussage über gesetzlichen Anspruch)" : "Eingabe korrigieren"}: ${p.message}`;
function GrantAmounts({ preview, name }: { preview: OldPreview | NewPreview; name: "old" | "new" }) {
  if (preview.status !== "calculated") return <p role="alert" data-testid={`${name}-status`}>{statusText(preview)}</p>;
  return <section data-testid={`${name}-result`}>
    <p>Modellierte Jahreszulagen {preview.result.contributionYear}, ohne Einmalbonus. Keine tatsächlich gebuchte Zulage.</p>
    <dl>
      <dt>Eigener Jahresbeitrag</dt><dd data-testid={`${name}-own`}>{euro(preview.annualCents)}</dd>
      {"minimumOwnContributionCents" in preview.result && <>
        <dt>Modellierter erforderlicher Jahres-Mindesteigenbeitrag</dt><dd data-testid="old-minimum">{euro(preview.result.minimumOwnContributionCents)}</dd>
        <dt>Deckungsstatus</dt><dd data-testid="old-fulfillment">{preview.result.fulfillment.status} · {preview.result.fulfillment.status === "full" ? "voll" : preview.result.fulfillment.status === "reduced" ? "gekürzt" : "null"}</dd>
      </>}
      <dt>Grundzulage</dt><dd data-testid={`${name}-base`}>{euro(preview.result.baseGrantCents)}</dd>
      {preview.result.childGrants.map((c, i) => <div key={c.childId}><dt>Kinderzulage Kind {i + 1}</dt><dd data-testid={`${name}-child`}>{euro(c.grantCents)}</dd></div>)}
      <dt>Summe Kinderzulagen</dt><dd data-testid={`${name}-children`}>{euro(preview.result.childrenGrantCents)}</dd>
      <dt>Summe modellierte Grund- und Kinderzulagen ohne Bonus</dt><dd data-testid={`${name}-total`}>{euro(preview.result.totalGrantCents)}</dd>
    </dl>
  </section>;
}

function OldRiesterView({ draft: d, step, preview, update, navigate, show }: {
  draft: OldDraft; step: "b1" | "b2"; preview: Comparison | null;
  update: (next: OldDraft) => void; navigate: (next: "choice" | "b1" | "b2") => void; show: (next: Comparison) => void;
}) {
  const prefix = useId(), result = useRef<HTMLDivElement>(null);
  const id = (key: string) => `${prefix}-${key}`;
  const errorField = preview?.old.status !== "calculated" ? preview?.old.field : undefined;
  const change = <K extends OldField>(key: K, value: OldDraft[K]) => update({ ...d, [key]: value,
    ...(key !== "evidenceQuality" ? { evidenceQuality: "unconfirmed" as const } : {}), comparisonConfirmed: false });
  const changeContribution = <K extends OldField>(key: K, value: OldDraft[K]) => update({ ...d, [key]: value,
    contributionConfirmed: false, evidenceQuality: "unconfirmed", comparisonConfirmed: false,
    newScenario: { ...d.newScenario, contributionConfirmed: false } });
  const newChange = <K extends keyof NewScenario>(key: K, value: NewScenario[K]) => update({ ...d,
    newScenario: { ...d.newScenario, [key]: value, ...(key !== "scenarioConfirmed" ? { scenarioConfirmed: false } : {}) }, comparisonConfirmed: false });
  const select = (key: OldField, label: string, choices: readonly (readonly [string, string])[]) => <>
    <label htmlFor={id(key)}>{label}</label><select id={id(key)} value={String(d[key])}
      aria-invalid={errorField === key} aria-describedby={errorField === key ? id("error") : undefined}
      onChange={e => change(key, e.target.value as never)}>{choices.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
  </>;
  const newSelect = (key: "entitlement" | "regime" | "contract" | "childrenStatus", label: string, choices: readonly (readonly [string, string])[]) => <>
    <label htmlFor={id(`new-${key}`)}>{label}</label><select id={id(`new-${key}`)} value={d.newScenario[key]}
      onChange={e => {
        if (key === "childrenStatus") {
          const value = e.target.value as NewScenario["childrenStatus"];
          update({ ...d, comparisonConfirmed: false, newScenario: { ...d.newScenario, childrenStatus: value, scenarioConfirmed: false,
            children: value === "none_confirmed" ? [] : d.newScenario.children } });
        } else newChange(key, e.target.value as never);
      }}>{choices.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
  </>;
  const amount = oldContribution(d), rules = oldRiesterRuleContext(oldRuleId(d.year));
  const newRules = d.year === 2027 || d.year === 2028 ? directGrantRuleContext(d.year === 2027 ? "estg-2027-v1" : "estg-2028-v1") : null;
  const calculateB = () => {
    const next: Comparison = step === "b2" ? previewComparison(d) : { old: previewOldGrant(d), newer: { status: "review_required", message: "Neues Szenario separat prüfen." } };
    show(next);
    requestAnimationFrame(() => {
      if (next.old.status !== "calculated" && next.old.field && step === "b1") document.getElementById(id(next.old.field))?.focus();
      else result.current?.focus();
    });
  };
  return <>
    <p>Eine bestimmte Person · Beitragsjahr {d.year} · Alt-Regel: {oldRuleId(d.year) || "ungeprüft"}.</p>
    {step === "b1" ? <section className="panel retirement-form" aria-label="Alt-Riester-Nachweise">
      <p>Nachweise für diese Person, dieses Jahr und diesen Alt-Regelstand vorgelagert prüfen. Keine Namen, Belege oder Vertragsnummern eingeben.</p>
      <label htmlFor={id("year")}>Alt-Beitragsjahr</label><select id={id("year")} value={d.year} onChange={e => update(changeOldYear(d, Number(e.target.value)))}>
        {[2026, 2027, 2028].map(year => <option key={year} value={year}>{year} – {oldRuleId(year)}</option>)}
      </select>
      <p>Jahreswechsel entzieht alle zeitbezogenen Bestätigungen, auch Kinder-, Partner-, Bonus- und Beitragsstatus.</p>
      {select("entitlement", "Alt-unmittelbare Berechtigung", [["unconfirmed", "Unklar / unbestätigt"], ["direct_old_confirmed", "Unmittelbare Altberechtigung für Person und Jahr nachgewiesen"], ["conflicting", "Widersprüchlich"], ["timeline_unconfirmed", "Unterjähriger Berechtigungsverlauf offen"], ["indirect", "Mittelbar berechtigt"], ["ineligible", "Nicht berechtigt"]])}
      <Help>Beruf, Alter, Einkommen und ein bestehender Vertrag beweisen die Berechtigung nicht. Mittelbare Berechtigung und ungeklärte Statuswechsel benötigen eine eigene Fachprüfung.</Help>
      {select("regime", "Alt-Regime und Bestandsschutz", [["unconfirmed", "Unklar / unbestätigt"],
        [d.year === 2026 ? "old_2026_confirmed" : "old_protected_confirmed", d.year === 2026 ? "Alt-Regelkontext 2026 bestätigt" : "Altbestand bestätigt: kein wirksamer Förderwechsel / auslösender Neuvertrag"],
        ["conflicting", "Bestand / Übergang widersprüchlich"], ["new_confirmed", "Tatsächlich neues Förderregime bestätigt"]])}
      {select("contract", "Alt-Vertragskontext", [["unconfirmed", "Unklar / unbestätigt"], ["single_private_eligible_confirmed", "Genau ein eigener förderfähiger privater Ansparvertrag; sämtliche weiteren aktiven/ruhenden/übertragenen/beendeten Verträge mitgeprüft"],
        ["transition_unconfirmed", "Vertragsübergang ungeklärt"], ["conflicting", "Verträge widersprüchlich"], ["multiple", "Mehrere relevante Verträge, auch ruhend"], ["multiple_and_new_regime", "Mehrverträge mit neuem Regime"], ["housing", "Wohn-Riester"], ["occupational", "Betriebliche Altersversorgung"], ["ineligible", "Nicht förderfähiger Vertrag"]])}
      <label htmlFor={id("income")}>Maßgeblicher RV-Vorjahresbetrag in Euro</label>
      <input id={id("income")} inputMode="decimal" value={d.income} onChange={e => change("income", e.target.value)} aria-invalid={errorField === "income"} aria-describedby={errorField === "income" ? id("error") : undefined} />
      <label htmlFor={id("incomeYear")}>Nachgewiesenes RV-Bemessungsjahr (t−1)</label>
      <select id={id("incomeYear")} value={d.incomeYear} onChange={e => change("incomeYear", e.target.value)}><option value="">Ausdrücklich auswählen</option>{[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}</select>
      {select("incomeBasis", "Qualität der RV-Bemessung", [["unconfirmed", "Unklar / unbestätigt"], ["simple_domestic_prior_rv_confirmed", `Einfache inländische RV-Basis ${d.year - 1} einschließlich Betrag ausdrücklich nachgewiesen`], ["conflicting", "Aktuelles Brutto / widersprüchliche Jahresgrundlage"], ["special", "Sonderbemessung / gemischte Bemessungsarten"]])}
      <Help>Nur die maßgeblichen inländischen RV-Einnahmen des Vorjahres. Aktuelles Brutto ist kein Ersatz. Ein nachgewiesener Betrag 0,00 € ist möglich; leer bleibt unbekannt.</Help>
      {select("partner", "Alt-Partnerstatus", [["unconfirmed", "Unklar / unbestätigt"], ["none_relevant_confirmed", "Kein relevanter mittelbarer Partner bestätigt"], ["direct_independent_confirmed", "Partner eigenständig unmittelbar berechtigt; Kinderzuordnung geklärt"], ["conflicting", "Partnerstatus widersprüchlich"], ["indirect_included", "Mittelbar abhängige Partnerkonstellation"], ["indirect_new_direct_old", "Mittelbar neu / unmittelbar Altbestand"]])}
      {select("bonus", "Alt-Berufseinsteigerbonus", [["unconfirmed", "Erstanspruch / Bonushistorie unklar"], ["age_excluded_confirmed", "Bonus am maßgeblichen Jahresbeginn altersbedingt ausgeschlossen und nachgewiesen"], ["history_no_current_confirmed", "Erstanspruch / Verbrauchshistorie belegt; in diesem Jahr kein Bonus"], ["conflicting", "Bonushistorie widersprüchlich"], ["current_year_confirmed", "Erstmaliger Bonus in diesem Jahr bestätigt"]])}
      <Help>Ein offener oder aktueller Altbonus sperrt auch die gewöhnliche Zulage: Er beeinflusst den Mindesteigenbeitrag. Keine automatische Freigabe aus einem Geburtsdatum.</Help>
      <label htmlFor={id("childrenStatus")}>Vollständige Alt-Kinderliste</label>
      <select id={id("childrenStatus")} value={d.childrenStatus} onChange={e => {
        const value = e.target.value as OldDraft["childrenStatus"];
        update({ ...d, childrenStatus: value, children: value === "none_confirmed" ? [] : d.children, evidenceQuality: "unconfirmed", comparisonConfirmed: false });
      }}>{childChoices.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select>
      <Help>Altbestand: erster maßgeblicher Kindergeld-Anspruchszeitraum. 2028 Elternzuordnung separat nach den neuen geschlechtsneutralen Regeln prüfen. Keine feste Altersgrenze von 18 Jahren, keine Übernahme aus A oder dem neuen Szenario.</Help>
      {d.childrenStatus === "list_confirmed" && <fieldset id={id("children")} tabIndex={-1}><legend>Alt-Kinder für {d.year} / {oldRuleId(d.year)}</legend>
        {d.children.map((c, i) => <div key={c.id} className="retirement-child">
          <label htmlFor={id(`birth-${c.id}`)}>Alt-Kind {i + 1}: Geburtsjahr</label><input id={id(`birth-${c.id}`)} inputMode="numeric" value={c.birthYear} onChange={e => change("children", d.children.map(x => x.id === c.id ? { ...x, birthYear: e.target.value, assignment: "assignment_unconfirmed" } : x))} />
          <label htmlFor={id(`child-${c.id}`)}>Alt-Kind {i + 1}: Förderfähigkeit und Zuordnung {d.year}</label><select id={id(`child-${c.id}`)} value={c.assignment} onChange={e => change("children", d.children.map(x => x.id === c.id ? { ...x, assignment: e.target.value as typeof x.assignment } : x))}>{assignments.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select>
          <button onClick={() => change("children", d.children.filter(x => x.id !== c.id))}>Alt-Kind {i + 1} entfernen</button>
        </div>)}
        <button onClick={() => change("children", [...d.children, { id: crypto.randomUUID(), birthYear: "", contributionYear: d.year, ruleContext: oldRuleId(d.year), assignment: "assignment_unconfirmed" }])}>Alt-Kind hinzufügen</button>
      </fieldset>}
      {select("correction", "Alt-Korrekturstatus", [["unconfirmed", "Unklar / unbestätigt"], ["none_confirmed", "Kein offener Korrektur- oder Rückforderungsfall bestätigt"], ["conflicting", "Korrektursachverhalt widersprüchlich"], ["retrospective", "Rückwirkende Korrektur / Rückforderung"]])}
      <p>Vertrags-/Übertragungswerte, Garantien, Kosten und gebuchte Zulagen sind spätere separat zu prüfende Schritte und werden hier nicht benötigt.</p>
    </section> : <section className="panel retirement-form" aria-label="Neues hypothetisches Vergleichsszenario">
      <p className="retirement-notice"><strong>Zwei alternative Fördermodelle; keine Wechselprüfung oder Empfehlung.</strong> Der reale Altstatus bleibt erhalten. Das neue Modell gilt nur unter separat fachlich geprüften hypothetischen Voraussetzungen; ein tatsächlicher Wechsel wird weder bestätigt noch ausgelöst.</p>
      <p>Alt-Nachweise und eigene Kinderzuordnung in B1 prüfen. Gleiche Person und gleiches Beitragsjahr {d.year}; die Regeln sind alternativ, kein paralleler Anspruch.</p>
      {d.year === 2026 ? <p>Für 2026 nicht unterstützt: kein neues Fördermodell und keine Vergleichsdifferenz.</p> : <>
        {newSelect("entitlement", "Neu-Szenario: unmittelbare Berechtigung", [["unconfirmed", "Unklar / unbestätigt"], ["direct_confirmed", "Neue unmittelbare Berechtigung für dieselbe Person im Szenario fachlich bestätigt"], ["indirect", "Mittelbare Berechtigung"], ["ineligible", "Nicht berechtigt"]])}
        {newSelect("regime", "Neu-Szenario: Förderregime", [["unconfirmed", "Unklar / unbestätigt"], ["new_confirmed", `Neues Regime ${d.year} für diese alternative Szenariokonstellation fachlich bestätigt`], ["old", "Im Szenario weiter altes Regime"]])}
        {newSelect("contract", "Neu-Szenario: Vertragskontext", [["unconfirmed", "Unklar / unbestätigt"], ["single_eligible_confirmed", "Genau ein eigener förderfähiger Vertrag im neuen Szenario fachlich bestätigt"], ["transition_unconfirmed", "Übergangszuordnung ungeklärt"], ["multiple", "Mehrere relevante Verträge"]])}
        <label className="retirement-checkbox"><input type="checkbox" checked={d.newScenario.transitionConfirmed} onChange={e => newChange("transitionConfirmed", e.target.checked)} />Vertrags- und Übergangsannahme einschließlich des im Szenario wirksamen Regimeübergangs eigenständig fachlich geprüft; keine Aussage über die tatsächliche Wechselmöglichkeit des Altvertrags.</label>
        {newSelect("childrenStatus", "Neu-Szenario: vollständige Kinderzuordnung", childChoices)}
        <Help>Je Kind eigene Prüfung nach dem neuen Recht: 2028 letzter maßgeblicher Kindergeld-Anspruchszeitraum und geschlechtsneutrale Elternzuordnung. Altzuordnung wird niemals kopiert. Alle Voraussetzungen gelten nur für dieses alternative Szenario.</Help>
        {d.newScenario.childrenStatus === "list_confirmed" && <fieldset><legend>Neue Kinderzuordnung {d.year}</legend>
          {d.newScenario.children.map((c, i) => <div key={c.id} className="retirement-child"><label htmlFor={id(`new-child-${c.id}`)}>Neu-Kind {i + 1}: Förderfähigkeit und Zuordnung {d.year}</label>
            <select id={id(`new-child-${c.id}`)} value={c.status} onChange={e => newChange("children", d.newScenario.children.map(x => x.id === c.id ? { ...x, status: e.target.value as typeof x.status } : x))}>{assignments.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select>
            <button onClick={() => newChange("children", d.newScenario.children.filter(x => x.id !== c.id))}>Neu-Kind {i + 1} entfernen</button></div>)}
          <button onClick={() => newChange("children", [...d.newScenario.children, { id: crypto.randomUUID(), contributionYear: d.year, status: "assignment_unconfirmed" }])}>Neu-Kind hinzufügen</button>
        </fieldset>}
        <label className="retirement-checkbox"><input type="checkbox" checked={d.newScenario.contributionConfirmed} onChange={e => newChange("contributionConfirmed", e.target.checked)} />Derselbe angezeigte Jahres-Eigenbeitrag ist für Person, Jahr und Vertrag im neuen Szenario eigenständig als förderfähig bestätigt.</label>
        <label className="retirement-checkbox"><input type="checkbox" checked={d.newScenario.scenarioConfirmed} onChange={e => newChange("scenarioConfirmed", e.target.checked)} />Alle Voraussetzungen der hypothetischen neuen Standardkonstellation wurden vorgelagert fachlich geprüft. Eine bloße Wunschannahme oder Alt-Bestätigung reicht nicht.</label>
      </>}
    </section>}
    <section className="panel retirement-form" aria-label="Gemeinsamer Jahres-Eigenbeitrag">
      <h2>{step === "b2" ? "Gleicher eigener Jahresbeitrag in beiden Modellen" : "Förderfähiger Jahres-Eigenbeitrag"}</h2>
      <label htmlFor={id("mode")}>B-Beitragsmodus</label><select id={id("mode")} value={d.mode} onChange={e => update(changeOldMode(d, e.target.value as OldDraft["mode"]))}><option value="annual">Jahresbeitrag</option><option value="monthly">Monatsbeitrag</option></select>
      <p>Moduswechsel leert die Beitragsfelder. Bitte neu eingeben und bestätigen.</p>
      {d.mode === "annual" ? <><label htmlFor={id("annual")}>B-Jahres-Eigenbeitrag in Euro</label><input id={id("annual")} inputMode="decimal" value={d.annual} aria-invalid={errorField === "annual"} aria-describedby={errorField === "annual" ? id("error") : undefined} onChange={e => changeContribution("annual", e.target.value)} /></> : <>
        <label htmlFor={id("monthly")}>B-Monatlicher Eigenbeitrag in Euro</label><input id={id("monthly")} inputMode="decimal" value={d.monthly} onChange={e => changeContribution("monthly", e.target.value)} />
        <label htmlFor={id("startMonth")}>B-Startmonat {d.year}</label><select id={id("startMonth")} value={d.startMonth} onChange={e => update({ ...d, startMonth: e.target.value, months: "", contributionConfirmed: false, evidenceQuality: "unconfirmed", comparisonConfirmed: false, newScenario: { ...d.newScenario, contributionConfirmed: false } })}><option value="">Bitte wählen</option>{monthNames.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        <label htmlFor={id("months")}>B-Beitragswirksame Monatsanzahl</label><select id={id("months")} value={d.months} onChange={e => changeContribution("months", e.target.value)}><option value="">Bitte wählen</option>{Array.from({ length: d.startMonth ? 13 - Number(d.startMonth) : 0 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
        <label className="retirement-checkbox"><input type="checkbox" checked={d.hasOneOff} onChange={e => changeContribution("hasOneOff", e.target.checked)} />B: Zusätzlicher einmaliger Eigenbeitrag</label>
        {d.hasOneOff && <><label htmlFor={id("oneOff")}>B-Einmaliger Eigenbeitrag in Euro</label><input id={id("oneOff")} inputMode="decimal" value={d.oneOff} onChange={e => changeContribution("oneOff", e.target.value)} /></>}
      </>}
      <div className="retirement-annual" aria-live="polite">{amount.status === "valid" ? <><strong>Jahres-Eigenbeitrag: {euro(amount.cents)}</strong>{d.mode === "monthly" && <p>{euro(amount.terms[0])} × {amount.terms[1]} Monatsraten + {euro(amount.terms[2])} einmalig</p>}</> : amount.message}</div>
      <label htmlFor={id("quality")}>B-Beitragsstand</label><select id={id("quality")} value={d.quality} onChange={e => changeContribution("quality", e.target.value as OldDraft["quality"])}><option value="unconfirmed">Bitte ausdrücklich wählen</option><option value="planned">Geplante förderfähige Eigenbeiträge</option><option value="actual">Tatsächlich gezahlte förderfähige Eigenbeiträge</option><option value="conflicting">Widersprüchlich</option><option value="ineligible">Nicht förderfähig</option></select>
      <label className="retirement-checkbox"><input id={id("contributionConfirmed")} type="checkbox" checked={d.contributionConfirmed} onChange={e => change("contributionConfirmed", e.target.checked)} />B: Jahres-Eigenbeitrag für Person, Altvertrag und Beitragsjahr ausdrücklich bestätigt; nur eigene Zahlungen, keine Zulagen, Erträge oder Überträge.</label>
      <Help>Tatsächlich gezahlt und geplant sind alternative Beitragsqualitäten; sie werden nicht addiert. Oktober erlaubt höchstens drei ausdrücklich gewählte Monatsraten. Ein positiver Beitrag unter 60 € kann im unmittelbaren Altstandard eine Teilzulage ergeben.</Help>
      {select("evidenceQuality", "Alt-Gesamtbestätigung der Nachweise", [["unconfirmed", "Noch nicht vollständig bestätigt"], ["confirmed", "Alle Pflichtbelege liegen vor; keine offenen / widersprüchlichen Nachweise oder Korrektur-/Rückforderungsfälle"], ["conflicting", "Nachweise widersprüchlich / noch offen"]])}
      {step === "b2" && <><label className="retirement-checkbox"><input type="checkbox" checked={d.comparisonConfirmed} onChange={e => update({ ...d, comparisonConfirmed: e.target.checked })} />Vergleichsbasis bestätigt: dieselbe Person, dasselbe Jahr und derselbe eigene Jahresbeitrag in beiden getrennten Fördermodellen; unterschiedliche Rechtsannahmen, kein gemeinsamer Anspruch.</label><p>Über 6.840 € ist ausschließlich das neue Modell gesperrt. Keine stille Kappung. Alle Beträge und die Differenz bleiben ohne Einmalbonus.</p></>}
      <button className="primary" onClick={calculateB}>{step === "b1" ? "Alt-Fördervorschau prüfen" : "Getrennte Fördermodelle prüfen"}</button>
    </section>
    <div className="retirement-result" ref={result} tabIndex={-1} aria-live="polite" aria-atomic="true" id={id("error")}>
      {preview ? <>
        <div className={step === "b2" ? "retirement-comparison" : ""}>
          <section className="panel"><h2>Altes Riester-System bei bestätigtem Altbestand</h2><p>{d.quality === "planned" ? "Geplante" : d.quality === "actual" ? "Tatsächlich gezahlte" : "Unbestätigte"} Eigenbeiträge.</p><GrantAmounts preview={preview.old} name="old" /></section>
          {step === "b2" && <section className="panel"><h2>Neues System unter getrennten hypothetischen Voraussetzungen</h2><GrantAmounts preview={preview.newer} name="new" /></section>}
        </div>
        {step === "b2" && (preview.deltaCents !== undefined ? <section className="panel"><h2>Differenz der modellierten Jahreszulagen unter unterschiedlichen Annahmen</h2><p>Neu − Alt, ohne Einmalbonus</p><strong data-testid="comparison-delta">{preview.deltaCents < 0 ? "−" : preview.deltaCents > 0 ? "+" : ""}{euro(Math.abs(preview.deltaCents))}</strong></section>
          : <p role="status" data-testid="comparison-incomplete">Vergleich unvollständig: zwei berechnete Seiten und ausdrücklich bestätigte Vergleichsbasis erforderlich. Keine numerische Differenz.</p>)}
      </> : <p role="status" data-testid="old-empty">Bestätigungen und aktueller Beitrag erforderlich. Keine aktuellen Förderbeträge; Vorschau bewusst neu prüfen.</p>}
    </div>
    <details className="retirement-help"><summary>Regelstand, Quellen und Modellgrenzen</summary>
      <p>Jahresbezogene Modellrechnung; keine individuelle Förderzusage. Ohne Bonus, Steuern, Kosten, Rendite, Vertragswerte oder Wechselentscheidung.</p>
      {[rules, ...(step === "b2" ? [newRules] : [])].map((r, i) => r && <section key={r.id}><p>{i === 0 ? "Alt" : "Neu"}: {r.id} · Beitragsjahr {r.contributionYear} · Geprüft am {r.checkedOn} · {r.calculationVersion}</p><ul>{r.sources.map(s => <li key={s}><a href={s} target="_blank" rel="noreferrer">{s}</a></li>)}</ul></section>)}
      <p>Halbcent und divergierende Faktor-/Prozentlesarten bleiben Fachprüfstatus ohne Förderzahl. Partnerabhängigkeit, Mehrverträge, Bonusjahr, Sonderbemessung und rückwirkende Korrekturen brauchen getrennte Fachprüfung. Diese Oberfläche bescheinigt keinen realen Regimewechsel.</p>
    </details>
  </>;
}
