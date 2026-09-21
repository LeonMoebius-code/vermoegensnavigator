import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isValidElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as XLSX from "xlsx";
import { finalCsv, finalHeaders, finalMatrix, finalRow, shortReferences, SyntheticRow } from "./bond-final-fixtures";
import { parseDepotCsv } from "../app/depot-csv";
import { bondCouponCalendar, couponAccruedDiagnostic } from "../app/bond-math";
import { analyzeBondV2 } from "../app/bond-v2";
import { structureOverviewSource, validBondSource } from "../app/bond-source";
import { buildBondAnalysisData } from "../app/bond-analysis-data";
import { BondAnalysisView } from "../app/bond-analysis-view";
import { classifyDepotProduct, buildDepotAnalysisPositions } from "../app/depot-analysis";
import { addDepotAccount, createCase, normalizeImportedCase, caseSnapshot, replaceDepotAccount, setCaseDepot } from "../app/case-model";
import { writeCaseStore, readCaseStore, CASE_STORAGE_KEY } from "../app/case-storage";
import { ExportCenter } from "../app/page";

let groups = 0;
const test = (name: string, run: () => void) => { run(); groups++; console.log(`PASS final ${name}`); };
const close = (a: number | null | undefined, b: number, tol = 1e-8) => assert.ok(a !== null && a !== undefined && Math.abs(a-b) <= tol, `${a} != ${b}`);
const parse = (rows: SyntheticRow[]) => parseDepotCsv(new TextEncoder().encode(finalCsv(rows)).buffer).rows;
const metric = (r = finalRow()) => { const h = parse([r])[0]; return analyzeBondV2({ ...h, source: "holding", classification: classifyDepotProduct(h) }); };
const sample = (rows = finalMatrix()) => { const c = createCase(); return { ...c, ...addDepotAccount(c, parse(rows), "Synthetic profile v2") }; };
const data = (c = sample(), state: "ist" | "plan" = "ist") => buildBondAnalysisData(c.depot, c.plans[0], state, c.depotAccounts);

test("29 columns, user-confirmed EUR, positive AI and empty FX, restricted signature", () => {
  assert.equal(finalHeaders.length, 29);
  const cp1252 = Uint8Array.from(finalCsv([finalRow()]), (char) => char.charCodeAt(0));
  assert.equal(parseDepotCsv(cp1252.buffer).rows[0].bondSource?.profileVersion, 2);
  const h = parse([finalRow()])[0], m = metric();
  assert.equal(h.fxRate, undefined); assert.equal(h.bondSource?.profileVersion, 2);
  assert.equal(h.bondSource?.reportingEvidence, "user-confirmed-format-convention");
  assert.equal(h.bondSource?.quality, "empirically-supported"); assert.equal(h.bondSource?.accruedQuantizationPer100, null);
  close(m.dirtyPrice.value, shortReferences[0].dirty); close(m.ytm.value, .05); assert.equal(m.reportingComparable, true);
  assert.doesNotMatch(JSON.stringify(h), /SYNTHETIC-PRIVATE-SLOT|SYNTHETIC-DEPOT-SLOT/);
  const shortened = finalCsv([finalRow()]).split("\n").map((l) => l.split(";").slice(1).join(";")).join("\n");
  assert.equal(parseDepotCsv(new TextEncoder().encode(shortened).buffer).rows[0].bondSource?.profileVersion, 1);
  const legacy = { ...h, bondSource: structureOverviewSource(h, 1) };
  assert.equal(validBondSource(legacy.bondSource, legacy)?.profileVersion, 1);
  assert.equal(validBondSource({ ...h.bondSource, reportingEvidence: undefined }, h), undefined);
  assert.equal(validBondSource({ ...h.bondSource, units: { ...h.bondSource!.units, fx: "reporting-per-bond" } }, h), undefined);
});

test("unique annual/half/quarter: independent Decimal70 short-bond yields and DV01", () => {
  for (const ref of shortReferences) {
    const m = metric(finalRow({ Kurs: ref.dirty-ref.ai, "Kurswert incl. Stückzinsen": ref.dirty*100, Stückzinsen: ref.ai*100 }));
    assert.equal(m.model?.modelStatus, "identified"); assert.equal(m.model?.selectedFrequency, ref.frequency);
    close(m.ytm.value, .05); close(m.macaulay.value, 5/365); close(m.modified.value, .01304631441617743);
    close(m.dv01.value, ref.dirty*100 * .01304631441617743 * .0001);
    assert.equal(m.model?.candidates.filter((c) => c.compatible).length, 1);
    // Independent finite difference of the explicit one-payment plan.
    const cf = 100+6/ref.frequency, pv = (y: number) => cf / (1+y)**(5/365)*100;
    close((pv(.0501)-pv(.0499))/2, -m.dv01.value!, 1e-7);
  }
  const semi = metric(finalMatrix()[1]); assert.ok(semi.ytm.value! < .051); // never 753.9% annual overpayment
});

test("ambiguous models: no residual winner, alternatives and no aggregate contamination", () => {
  const r = finalMatrix()[3], m = metric(r), a = data(sample([r])).analysis;
  assert.equal(m.model?.modelStatus, "ambiguous"); assert.equal(m.model?.selectedFrequency, null);
  assert.equal(m.model?.candidates.filter((c) => c.compatible).length, 3);
  close(m.ytm.value, .06); assert.match(m.model!.modelLabel, /Jahresmodellannahme/);
  assert.ok(Math.max(...m.model!.candidates.map((c) => c.ytm!)) - Math.min(...m.model!.candidates.map((c) => c.ytm!)) > .001);
  close(a.ytmCoverage, 0); assert.equal(a.averageModeledYtm, null); assert.equal(a.portfolioDv01, null);
  close(a.currentYieldCoverage, 1); close(a.maturityCoverage, 1); close(a.ladderCoverage, 1);
  // At this date half/quarter match but annual does not: no annual assumption.
  const x = metric(finalRow({ Bewertungsende: "02.07.2026", Stückzinsen: 6/365*100, Kurs: 100-6/365, "Kurswert incl. Stückzinsen": 10000 }));
  assert.equal(x.model?.modelStatus, "ambiguous"); assert.equal(x.ytm.value, null);
  assert.deepEqual(x.model?.candidates.filter((c) => c.compatible).map((c) => c.frequency), [2,4]);
});

test("none/missing/invalid AI, explicit zero coupon and independent metrics", () => {
  const none = metric(finalMatrix()[4]); assert.equal(none.ytm.reasonCode, "coupon-model-contradiction");
  assert.equal(none.modified.value, null); assert.equal(none.dv01.value, null); assert.notEqual(none.currentYield.value, null);
  const missing = metric(finalMatrix()[5]); assert.equal(missing.model?.modelStatus, "assumed-annual"); close(missing.ytm.value, .06);
  for (const bad of ["n/a", "5abc", "1e3", "NaN", "-1"]) {
    const m = metric(finalRow({ Stückzinsen: bad })); assert.equal(m.ytm.value, null, bad); assert.notEqual(m.currentYield.value, null);
  }
  const zero = metric(finalRow({ Zinssatz: 0, Stückzinsen: 0, Kurs: 100, "Kurswert incl. Stückzinsen": 10000 }));
  assert.equal(zero.model?.modelStatus, "frequency-independent"); close(zero.ytm.value, 0); assert.equal(zero.aggregateEligible, true);
  assert.equal(metric(finalRow({ Endfälligkeit: "" })).ytm.reasonCode, "missing-maturity");
  assert.equal(metric(finalRow({ Bewertungsende: "01.01.2027" })).ytm.reasonCode, "matured");
});

test("FX division and reporting AI, missing foreign FX retains full EUR denominator", () => {
  const ref = shortReferences[1], eur = ref.dirty*100/1.25;
  const foreign = finalRow({ Währung: "USD", Devisenkurs: 1.25, Kurs: ref.dirty-ref.ai, Stückzinsen: ref.ai*100/1.25, "Kurswert incl. Stückzinsen": eur });
  const m = metric(foreign); close(m.dirtyPrice.value, ref.dirty); close(m.ytm.value, .05); assert.equal(m.dv01Currency, "USD");
  const a = data(sample([foreign])).analysis; close(a.portfolioDv01, eur*.01304631441617743*.0001);
  assert.equal(metric({ ...foreign, Devisenkurs: .8 }).ytm.reasonCode, "price-path-conflict");
  const absent = metric({ ...foreign, Devisenkurs: "" }); assert.equal(absent.ytm.reasonCode, "missing-required-fx"); assert.equal(absent.reportingComparable, true);
  const c = sample([finalRow(), { ...foreign, Devisenkurs: "" }]), b = data(c).analysis;
  close(b.directValueEUR, shortReferences[0].dirty*100+eur); close(b.ytmCoverage, shortReferences[0].dirty*100/(shortReferences[0].dirty*100+eur)); close(b.averageModeledYtm, .05);
  close(b.currentYieldCoverage, 1); close(b.ladderCoverage, 1);
});

test("EOM, leap and non-EOM anchors, strict future dates, separate daycounts and diagnostic band", () => {
  assert.deepEqual(bondCouponCalendar("2023-12-01", "2024-08-31", 8, 4)?.cashflows.map((c) => [c.date,c.amount]), [["2024-02-29",2],["2024-05-31",2],["2024-08-31",102]]);
  assert.deepEqual(bondCouponCalendar("2023-12-01", "2024-08-30", 8, 4)?.cashflows.map((c) => c.date), ["2024-02-29","2024-05-30","2024-08-30"]);
  assert.deepEqual(bondCouponCalendar("2026-07-01", "2027-01-01", 6, 2)?.cashflows.map((c) => [c.date,c.amount]), [["2027-01-01",103]]);
  assert.equal(bondCouponCalendar("2026-01-01", "", 6, 4), null);
  assert.equal(bondCouponCalendar("2026-01-01", "2025-01-01", 6, 4), null);
  const d = couponAccruedDiagnostic("2026-04-30", "2027-01-31", 12, 1, 3, null);
  assert.equal(d.band, .05); assert.equal(d.variants.find((v) => v.dayCount === "30E/360")?.compatible, true);
  assert.equal(d.variants.find((v) => v.dayCount === "ACT/365F")?.compatible, false);
  assert.equal(couponAccruedDiagnostic("2026-01-02","2027-01-01",0,1,.051,null).compatible,false);
  assert.equal(couponAccruedDiagnostic("2026-01-02","2027-01-01",0,1,.051,.026).compatible,true);
  const stale = metric(finalRow({ Bewertungsanfang: "01.01.2020", Stückzinsen: 900, Kurs: 91, "Kurswert incl. Stückzinsen": 10000 }));
  assert.equal(stale.model?.modelStatus, "inconsistent"); assert.ok(stale.model?.candidates.every((c) => c.band === .05));
});

test("dual currency and fund labels preserve economic uncertainty and existing corrections", () => {
  for (const key of ["Wertpapiertyp", "Anlagemedium", "Bezeichnung"]) {
    const h = parse([finalRow({ [key]: "Doppelwährungsanleihe" })])[0];
    assert.equal(classifyDepotProduct(h).bondKind, "other"); assert.equal(metric(finalRow({ [key]: "Doppelwährungsanleihe" })).ytm.value, null);
  }
  for (const label of ["Lebenszyklusfonds", "Hybridfonds", "wertgesicherte Fonds", "Mischfonds"]) {
    const h = parse([finalRow({ Anlagemedium: label, Anlagesegment: "Aktien" })])[0];
    assert.equal(classifyDepotProduct(h).main, "Mischfonds / Multi-Asset"); assert.equal(h.classificationStatus, "unresolved");
  }
  const commodity = parse([finalRow({ Anlagemedium: "Rohstofffonds", Anlagesegment: "Aktien" })])[0];
  assert.equal(classifyDepotProduct(commodity).main,"Alternative Anlagen"); assert.equal(classifyDepotProduct(commodity).direct,false); assert.equal(commodity.assetClass,"Alternative Anlagen");
  assert.equal(classifyDepotProduct(parse([finalRow({ Wertpapiertyp: "Aktienanleihe" })])[0]).main,"Strukturierte Produkte");
});

test("aggregation, exclusion, PLAN, persistence, JSON and replacement", () => {
  let c = sample(); const a = data(c).analysis, refs = shortReferences;
  const selectedValue = refs.reduce((s,r)=>s+r.dirty*100,0)+10000;
  const total = selectedValue + 20000 + 2*refs[0].dirty*100;
  close(a.directValueEUR,total); close(a.ytmCoverage,selectedValue/total);
  close(a.averageModeledYtm,(refs.reduce((s,r)=>s+r.dirty*100*.05,0)+600)/selectedValue);
  const dv01 = refs.reduce((s,r)=>s+r.dirty*100*.01304631441617743*.0001,0)+1/1.06;
  close(a.portfolioDv01,dv01); close(a.scenarios[0].effect,dv01*100);
  c = setCaseDepot(c, c.depot.map((h,i)=>i===0?{...h,plannedSale:h.value/2}:h));
  close(data(c,"plan").analysis.rows[0].ytm,.05); close(data(c,"plan").analysis.rows[0].dv01,a.rows[0].dv01!/2);
  close(data(c,"plan").rows[0].position.accruedInterest,refs[0].ai*50);
  c.depot[1].excludeFromBondAggregates=true;
  const excluded=data(c).analysis; close(excluded.directValueEUR,total); close(excluded.portfolioDv01,dv01-a.rows[1].dv01!);
  const original=JSON.stringify(c); const restored=normalizeImportedCase(JSON.parse(original),false)!;
  assert.equal(JSON.stringify(data(restored).analysis),JSON.stringify(data(c).analysis)); assert.equal(JSON.stringify(c),original);
  const storage=new Map<string,string>(); const store={get length(){return storage.size;},key:(i:number)=>[...storage.keys()][i]??null,getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>{storage.set(k,v);},removeItem:(k:string)=>{storage.delete(k);}};
  writeCaseStore(store,[c]); const loaded=readCaseStore(store.getItem(CASE_STORAGE_KEY)).cases[0]; assert.equal(JSON.stringify(data(loaded).analysis),JSON.stringify(data(c).analysis));
  assert.equal(caseSnapshot(c).schemaVersion,11); assert.equal(caseSnapshot(c).depot[0].bondSource?.profileVersion,2);
  c={...c,...replaceDepotAccount(c,c.depotAccounts[0].id,parse(finalMatrix()))}; assert.equal(c.depot[1].excludeFromBondAggregates,true);
  close(data(c,"plan").analysis.rows[0].ytm,.05);
});

function button(node: ReactNode, label: string): (() => void) | undefined {
  if (Array.isArray(node)) return node.map((n)=>button(n,label)).find(Boolean);
  if (!isValidElement<{children?:ReactNode;onClick?:()=>void}>(node)) return undefined;
  return node.type === "button" && renderToStaticMarkup(node).includes(label) ? node.props.onClick : button(node.props.children,label);
}
test("customer UI is concise while technical diagnostics remain accessible", () => {
  const c=sample(); c.advisory.caseName="bond-final-synthetic";
  const d=data(c), ui=renderToStaticMarkup(<BondAnalysisView data={d} onInclusionChange={()=>{}} />);
  const standard=ui.split('<details class="analysis-section bond-technical">')[0];
  assert.match(standard,/Indikative Rendite bis Fälligkeit/);
  assert.match(standard,/Laufende Verzinsung/);
  assert.match(standard,/von 8 Anleihen und/);
  assert.match(standard,/Fälligkeitsübersicht/);
  assert.match(standard,/Fachlicher Status/);
  assert.doesNotMatch(standard,/Modellalternative|Stückzinsband|Abdeckung und Ausschlüsse je Kennzahl/);
  assert.match(ui,/Fachliche Details und Datenprüfung/);
  assert.match(ui,/Abdeckung und Ausschlüsse je Kennzahl/);
  assert.match(ui,/Modellalternative/);
  assert.match(ui,/type="checkbox"/);
});

test("accrued-interest currency follows the validated profile without legacy promotion", () => {
  const ref=shortReferences[1], eur=ref.dirty*100/1.25;
  const usd=finalRow({ Währung:"USD", Devisenkurs:1.25, Kurs:ref.dirty-ref.ai, Stückzinsen:ref.ai*100/1.25, "Kurswert incl. Stückzinsen":eur });
  const confirmed=data(sample([usd]));
  assert.equal(confirmed.positionHeaders[4],"Stückzinsen (EUR-Berichtswährung)");
  assert.match(confirmed.positionRows[0][4],/EUR-Berichtswährung/);
  const c=sample([usd]);
  c.depot[0]={...c.depot[0],bondSource:structureOverviewSource(c.depot[0],1)};
  const legacy=data(c);
  assert.equal(legacy.positionHeaders[4],"Stückzinsen (profilabhängige Währung)");
  assert.match(legacy.positionRows[0][4],/Währungskonvention ungeklärt/);
  assert.doesNotMatch(legacy.positionRows[0][4],/EUR-Berichtswährung/);
});

test("empty, complete, partial, unavailable and large portfolios have honest presentation states", () => {
  const emptyCase=createCase(), empty=buildBondAnalysisData([],emptyCase.plans[0],"ist",[]);
  assert.equal(empty.analysis.directCount,0); assert.equal(empty.primarySummary[0].value,"nicht berechenbar");
  const complete=data(sample([finalRow()])); close(complete.analysis.ytmCoverage,1); assert.match(complete.primarySummary[0].coverageText,/1 von 1/);
  const partial=data(sample([finalRow(),finalMatrix()[4]])); assert.ok(partial.analysis.ytmCoverage! > 0 && partial.analysis.ytmCoverage! < 1);
  assert.match(partial.customerPositionRows[1][5],/widersprüchlich/);
  const unavailable=data(sample([finalMatrix()[4]])); assert.equal(unavailable.analysis.averageModeledYtm,null); assert.match(unavailable.primarySummary[0].coverageText,/Anleihe nicht berechenbar/);
  const largeRows=Array.from({length:120},(_,i)=>finalRow({Bezeichnung:`Synthetic bond ${i+1}`,WKN:`L${String(i).padStart(5,"0")}`}));
  const large=data(sample(largeRows)); assert.equal(large.customerPositionRows.length,120); assert.equal(large.positionRows.length,120);
});

test("actual Excel separates customer report and technical evidence; print stays customer-facing", () => {
  const c=sample(); c.advisory.caseName="bond-final-synthetic";
  const d=data(c);
  const view=ExportCenter({item:c,preferredPlan:c.plans[0],setItem:()=>{},saveCase:()=>{},exportJson:()=>{},importJson:()=>{}});
  const print=renderToStaticMarkup(view);
  assert.match(print,/Zins &amp; Laufzeiten – IST/);
  assert.match(print,/von 8 Anleihen und/);
  assert.match(print,/Fälligkeitsübersicht/);
  assert.match(print,/Fachlicher Status/);
  assert.doesNotMatch(print,/Modellalternative|Stückzinsband|Keine Herstellerbestätigung|Abdeckung: Indikative/);
  const cwd=process.cwd(), dir=mkdtempSync(join(tmpdir(),"bond-final-"));
  try {
    process.chdir(dir); button(view,"Excel-Arbeitsmappe")!();
    const wb=XLSX.read(readFileSync("bond-final-synthetic.xlsx"),{type:"buffer"});
    const rows=XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Zins & Laufzeiten"],{header:1,defval:""});
    const technical=XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Technische Nachweise"],{header:1,defval:""});
    assert.deepEqual(rows, d.exportRows.map((r) => [...r, ...Array(6-r.length).fill("")]));
    assert.equal(rows.find((r)=>r[0]==="Portfolio-DV01")?.[1],d.summary.find((s)=>s.key==="dv01")?.value);
    assert.match(JSON.stringify(rows),/Überblick.*Fälligkeitsübersicht.*Positionen/);
    assert.doesNotMatch(JSON.stringify(rows),/Modellalternative|Stückzinsband|Keine Herstellerbestätigung/);
    assert.match(JSON.stringify(technical),/Mehrdeutig.*Jahresmodellannahme/);
    assert.match(JSON.stringify(technical),/Modellalternative.*Stückzinsband/);
    for(const sheet of [wb.Sheets["Zins & Laufzeiten"],wb.Sheets["Technische Nachweise"]])
      for(const cell of Object.values(sheet) as any[]) assert.ok(!cell.f,"bond export text must not become a formula");
  } finally { process.chdir(cwd); rmSync(dir,{recursive:true}); }
});
console.log(`Bond final: ${groups} regression groups passed, synthetic data only.`);
