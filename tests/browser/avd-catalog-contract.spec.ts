import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { canonicalJson } from "../../app/domain/case/recovery-hash";
import { MODEL_VERSIONS, reference, refKey, revisionHash, type Checked } from "../../app/domain/retirement/identity-contract";
import type { Catalog, CatalogRecord } from "../../app/domain/retirement/catalog-contract";
import { parseCatalog, resolveCurrent, appendCatalogRevision, applyCaseOverride, publicCatalog, validateCostSelection } from "../../app/domain/retirement/catalog-validation";
import { syntheticCatalog, record, reseal, costSelection } from "./avd-catalog-fixture";

function code<T>(result:Checked<T>,expected:string) {
  expect(result.ok).toBe(false);
  if(!result.ok)expect(result.issue.code).toBe(expected);
}
function valid(c:Catalog) {
  const r=parseCatalog(c);expect(r).toMatchObject({ok:true});if(!r.ok)throw new Error(JSON.stringify(r));return r.value;
}
function reviseCosts(c:Catalog):Catalog {
  const n=structuredClone(c);n.revision++;n.previousHash=c.hash;
  const prior=record(n,"synthetic-cost-1","parameter");
  const p=structuredClone(prior);(p as {revision:number}).revision++;p.previous=reference(prior);
  p.data.value={class:"A",value:0.0234,reason:"New artificial assumption"};
  n.records.push(p);
  const replaced:CatalogRecord[]=[p];
  for(const id of ["synthetic-k1-m1-1","synthetic-k1-m2-1"]){
    const old=record(n,id,"cost"),next=structuredClone(old);
    (next as {revision:number}).revision++;next.previous=reference(old);
    if(next.data.mode!=="K1")throw new Error("Fixture K1");next.data.parameter=reference(p);
    n.records.push(next);replaced.push(next);
  }
  n.current=n.current.map(r=>reference(replaced.find(x=>x.kind===r.kind && x.id===r.id)??r));
  return reseal(n);
}
test("P1-01: six independent product/tariff identities and eleven stable fund options",()=>{
  const c=valid(syntheticCatalog());
  expect(c.records.filter(r=>r.kind==="product")).toHaveLength(6);
  expect(c.records.filter(r=>r.kind==="tariff")).toHaveLength(6);
  expect(c.records.filter(r=>r.kind==="fund")).toHaveLength(11);
  for(const t of c.records)if(t.kind==="tariff"){expect(t.data.fundOptions).toHaveLength(11);expect(t.data.annuityFactor).toBeNull();}
  expect(c.records.filter(r=>r.kind==="fund").every(r=>r.data.isin===null)).toBe(true);
});
test("P1-02: SHA-256 agrees with independent crypto and binds complete record metadata",()=>{
  const c=syntheticCatalog();
  for(const r of [...c.records,c]){const {hash,...body}=r;expect(hash).toBe(createHash("sha256").update(canonicalJson(body)).digest("hex"));}
  const tampered=structuredClone(c);record(tampered,"synthetic-product-1","product").data.name="Tampered";
  code(parseCatalog(tampered),"content_hash_mismatch");
});
test("P1-03: copy and deep freeze prevent caller aliases and historical mutation",()=>{
  const c=syntheticCatalog(),parsed=valid(c);const old=parsed.records[0].data;
  record(c,"synthetic-source","source").data.title="Caller changed";
  expect(parsed.records[0].data).toBe(old);
  expect(Object.isFrozen(parsed)).toBe(true);expect(Object.isFrozen(parsed.records)).toBe(true);
  expect(Object.isFrozen(old)).toBe(true);expect((old as {title:string}).title).toBe("Artificial project decision");
  expect(()=>{(old as {title:string}).title="Mutation";}).toThrow();
});
test("P1-04: comfort retains non-ten-percent weights, individual mode accepts ten-percent steps",()=>{
  const c=valid(syntheticCatalog());const a=c.records.find(r=>r.id==="synthetic-comfort");
  expect(a?.kind).toBe("portfolio");if(a?.kind==="portfolio")expect(a.data.weights.map(w=>w.basisPoints)).toEqual([3100,1700,700,500,2900,1100]);
});
test("P1-05: explicit current resolution returns exact references and separate model versions",()=>{
  const c=syntheticCatalog(),r=record(c,"synthetic-product-1","product");
  expect(resolveCurrent(c,reference(r),c.asOf)).toMatchObject({ok:true,value:{id:r.id,revision:1,hash:r.hash}});
  expect(r.data.capabilities.map(x=>x.version)).toEqual(Object.values(MODEL_VERSIONS));
  code(resolveCurrent(c,{...reference(r),revision:2},c.asOf),"invalid_reference");
  code(resolveCurrent(c,reference(r),"2026-11-18"),"catalog_date_mismatch");
});
test("P1-06: cost revision retains old bytes, sources and prior cost versions",()=>{
  const old=syntheticCatalog(),n=reviseCosts(old),before=canonicalJson(old);
  expect(appendCatalogRevision(old,n)).toMatchObject({ok:true});
  expect(canonicalJson(old)).toBe(before);
  for(const r of old.records)expect(n.records.find(x=>refKey(x)===refKey(r))).toEqual(r);
  expect(n.current.find(r=>r.id==="synthetic-cost-1")?.revision).toBe(2);
  code(resolveCurrent(n,reference(record(old,"synthetic-cost-1","parameter")),n.asOf),"not_current");
});
test("P1-07: overwriting or deleting historical revisions fails the append boundary",()=>{
  const old=syntheticCatalog(),n=reviseCosts(old);
  const p=record(n,"synthetic-cost-1","parameter");p.data.value={class:"A",value:0.0345,reason:"Changed history"};reseal(n);
  code(appendCatalogRevision(old,n),"invalid_reference");
  const deleted=reviseCosts(old);deleted.records=deleted.records.filter(r=>r.id!=="synthetic-k2");reseal(deleted);
  code(appendCatalogRevision(old,deleted),"invalid_reference");
});
test("P1-08: explicit scenario override preserves central A revision and all other products",()=>{
  const c=syntheticCatalog(),before=canonicalJson(c);
  const o={format:"avd.override.v1",id:"synthetic-override",caseId:"synthetic-case",base:reference(record(c,"synthetic-cost-1","parameter")),
    value:{class:"S",value:0.0312,reason:"Explicit artificial case scenario"},recordedOn:c.asOf};
  expect(applyCaseOverride(c,o)).toMatchObject({ok:true,value:{base:o.base,effective:o,unit:"annual_ratio"}});
  expect(canonicalJson(c)).toBe(before);
  const b={...o,base:reference(record(c,"synthetic-fixed-fee","parameter"))};code(applyCaseOverride(c,b),"override_forbidden");
  code(applyCaseOverride(c,{...o,value:{...o.value,class:"A"}}),"override_must_be_scenario");
});
test("P1-09: valid K1 M1/M2, verified K2, and separated payout costs",()=>{
  const c=syntheticCatalog(),s=costSelection(c);
  expect(validateCostSelection(c,s)).toMatchObject({ok:true});
  expect(validateCostSelection(c,{...s,model:"M2",modelVersion:MODEL_VERSIONS.M2,costs:[
    reference(record(c,"synthetic-k1-m2-1","cost")),s.costs[1]]})).toMatchObject({ok:true});
  expect(validateCostSelection(c,{...s,costs:[reference(record(c,"synthetic-k2","cost")),s.costs[1]]})).toMatchObject({ok:true});
  expect(validateCostSelection(c,{...s,costs:[s.costs[0],reference(record(c,"synthetic-payout-fixed","cost"))]})).toMatchObject({ok:true});
});
test("P1-10: reject K1/K2 and additional TER in the same phase",()=>{
  const c=syntheticCatalog(),s=costSelection(c);
  code(validateCostSelection(c,{...s,costs:[...s.costs,reference(record(c,"synthetic-k2","cost"))]}),"conflicting_cost_modes");
  code(validateCostSelection(c,{...s,returns:{basis:"net",deducted:[{phase:"savings",component:"fund_ter"}]}}),"duplicate_cost_component");
  code(validateCostSelection(c,{...s,costs:[s.costs[0]]}),"missing_cost_phase");
});
test("P1-11: phase-specific inclusion does not double-count an independent payout fee",()=>{
  const c=syntheticCatalog(),s=costSelection(c);
  expect(validateCostSelection(c,{...s,returns:{basis:"net",deducted:[{phase:"payout",component:"fund_ter"}]}})).toMatchObject({ok:true});
  code(validateCostSelection(c,{...s,returns:{basis:"gross",deducted:[{phase:"savings",component:"fund_ter"}]}}),"return_basis_mismatch");
  code(validateCostSelection(c,{...s,model:"M3",modelVersion:MODEL_VERSIONS.M3,costs:[reference(record(c,"synthetic-k2","cost")),s.costs[1]]}),"model_blocked");
});
test("P1-12: blocked incomplete K2 and open payout costs remain representable but not usable",()=>{
  const c=syntheticCatalog(),k=record(c,"synthetic-k2","cost");
  if(k.data.mode!=="K2")throw new Error("Fixture");k.data.coverage="incomplete";k.data.status="blocked";reseal(c);valid(c);
  const s=costSelection(c);code(validateCostSelection(c,{...s,costs:[reference(k),s.costs[1]]}),"K2_blocked");
  const payout=record(c,"synthetic-payout-1","cost");
  payout.data={product:s.product,tariff:s.tariff,phase:"payout",mode:"open",reason:"No payout costs known"};reseal(c);valid(c);
  code(validateCostSelection(c,costSelection(c)),"payout_costs_open");
});
test("P1-13: unknown TER remains O/null and is never returned as a numeric zero",()=>{
  const c=syntheticCatalog(),p=record(c,"synthetic-ter","parameter");
  expect(resolveCurrent(c,reference(p),c.asOf)).toMatchObject({ok:true,value:{data:{value:{class:"O",value:null}}}});
  const o={format:"avd.override.v1",id:"synthetic-o",caseId:"synthetic-case",base:reference(p),
    value:{class:"S",value:0.0022,reason:"Explicit artificial assumption"},recordedOn:c.asOf};
  expect(applyCaseOverride(c,o)).toMatchObject({ok:true});
});
test("P1-14: public release is channel-specific and rejects any internal historical dependency",()=>{
  const c=syntheticCatalog();for(const channel of ["source","asset","display","export"])code(publicCatalog(c,channel),"publication_blocked");
  for(const r of c.records)r.publication={state:"released",channels:["display"],approval:{authority:"synthetic-owner",record:"synthetic-approval",approvedOn:c.asOf}};
  reseal(c);expect(publicCatalog(c,"display")).toMatchObject({ok:true});code(publicCatalog(c,"source"),"publication_blocked");
  record(c,"synthetic-source","source").publication={state:"internal"};reseal(c);code(publicCatalog(c,"display"),"publication_blocked");
});
test("P1-15: source and product availability do not establish bank or personal entitlement",()=>{
  const c=valid(syntheticCatalog());const p=c.records.find(r=>r.kind==="product");
  expect(p?.kind).toBe("product");if(p?.kind==="product"){expect(p.data.manufacturer.state).toBe("announced");expect(p.data.bank.state).toBe("open");}
  const leaked=syntheticCatalog() as unknown as Record<string,unknown>;leaked.evidenceStatus="bestaetigt";code(parseCatalog(leaked),"unknown_or_missing_field");
});
test("P1-16: value-protection target and maturity contribution guarantee remain distinct",()=>{
  const c=syntheticCatalog(),src=record(c,"synthetic-algorithm","source"),rate=structuredClone(record(c,"synthetic-fixed-fee","parameter"));
  (rate as {id:string}).id="synthetic-guarantee-ratio";rate.data.productId="synthetic-product-1";rate.data.tariffId=null;rate.data.phase=null;rate.data.unit="ratio";
  rate.data.value={class:"B",value:0.8,reason:"Artificial dated protection target"};rate.citations=[{source:reference(src),locator:"Artificial protection section"}];c.records.push(rate);c.current.push(reference(rate));
  const p=record(c,"synthetic-product-1","product");p.citations=[{source:reference(src),locator:"Artificial protection section"}];
  p.data.guarantee={kind:"value_protection_target",rate:reference(rate),basis:"dated_value",appliesAt:"contract_maturity",referenceDate:"2026-01-01",evidence:reference(src)};
  reseal(c);valid(c);p.data.guarantee={...p.data.guarantee,kind:"contribution_guarantee"};reseal(c);code(parseCatalog(c),"invalid_guarantee_basis");
});

const negative:[string,string,(c:Catalog)=>void][]=[
  ["unknown format","unknown_version",c=>{(c as {format:string}).format="avd.catalog.v99";}],
  ["unknown top field","unknown_or_missing_field",c=>{Object.assign(c,{extra:true});}],
  ["unknown data field","unknown_or_missing_field",c=>{Object.assign(record(c,"synthetic-fund-1").data,{extra:1});}],
  ["missing field","unknown_or_missing_field",c=>{delete (record(c,"synthetic-fund-1").data as unknown as Record<string,unknown>).name;}],
  ["duplicate identity","duplicate_identity",c=>{c.records.push(structuredClone(c.records[0]));}],
  ["unresolved source","invalid_reference",c=>{record(c,"synthetic-fund-1").citations[0].source={...reference(record(c,"synthetic-source","source")),id:"missing-source"};}],
  ["missing source","missing_citation",c=>{record(c,"synthetic-fund-1").citations=[];}],
  ["invalid date","invalid_date",c=>{record(c,"synthetic-fund-1").validFrom="2026-02-30";}],
  ["reversed period","invalid_period",c=>{record(c,"synthetic-fund-1").validTo="2025-01-01";}],
  ["future record","future_revision",c=>{record(c,"synthetic-fund-1").changedOn="2026-12-01";}],
  ["expired current","outside_validity",c=>{record(c,"synthetic-fund-1").validTo="2026-11-16";}],
  ["unknown model version","unknown_version",c=>{record(c,"synthetic-product-1","product").data.capabilities[0].version="latest";}],
  ["M3 unproven","M3_evidence_incomplete",c=>{record(c,"synthetic-product-1","product").data.capabilities[2].status="available";}],
  ["negative weight","invalid_integer",c=>{record(c,"synthetic-comfort","portfolio").data.weights[0].basisPoints=-1;}],
  ["fractional weight","invalid_integer",c=>{record(c,"synthetic-comfort","portfolio").data.weights[0].basisPoints=3100.5;}],
  ["weight sum","portfolio_total",c=>{record(c,"synthetic-comfort","portfolio").data.weights[0].basisPoints=3000;}],
  ["individual step","individual_weight_step",c=>{const p=record(c,"synthetic-comfort","portfolio");p.data.mode="individual";}],
  ["duplicate fund","duplicate_fund",c=>{const p=record(c,"synthetic-comfort","portfolio");p.data.weights[1].fund=p.data.weights[0].fund;}],
  ["O numeric zero","open_value_must_be_null",c=>{Object.assign(record(c,"synthetic-ter","parameter").data.value,{value:0});}],
  ["O approved","open_parameter_approval",c=>{record(c,"synthetic-ter","parameter").data.approval="approved";}],
  ["numeric string","invalid_parameter_value",c=>{Object.assign(record(c,"synthetic-cost-1","parameter").data.value,{value:"0.02"});}],
  ["rate one","invalid_ratio",c=>{Object.assign(record(c,"synthetic-cost-1","parameter").data.value,{value:1});}],
  ["B with no proof","missing_B_evidence",c=>{const p=record(c,"synthetic-fixed-fee","parameter");p.citations=[{source:reference(record(c,"synthetic-source","source")),locator:"Wrong proof"}];}],
  ["unapproved working cost","parameter_not_approved",c=>{record(c,"synthetic-cost-1","parameter").data.approval="proposed";}],
  ["cost wrong unit","parameter_unit",c=>{record(c,"synthetic-cost-1","parameter").data.unit="ratio";}],
  ["wrong cost convention","cost_convention_mismatch",c=>{Object.assign(record(c,"synthetic-k1-m1-1","cost").data,{convention:"M2_balance_factor_v1"});}],
  ["K1 payout phase","invalid_cost_phase",c=>{Object.assign(record(c,"synthetic-k1-m1-1","cost").data,{phase:"payout"});}],
  ["unknown component","unknown_value",c=>{Object.assign(record(c,"synthetic-k1-m1-1","cost").data,{components:["mystery_fee"]});}],
  ["K2 incomplete verified","incomplete_K2",c=>{Object.assign(record(c,"synthetic-k2","cost").data,{coverage:"incomplete"});}],
  ["K2 wrong proof","K2_evidence_unverified",c=>{Object.assign(record(c,"synthetic-k2","cost").data,{tariffEvidence:reference(record(c,"synthetic-source","source"))});}],
  ["K2 missing charges","K2_missing_charges",c=>{Object.assign(record(c,"synthetic-k2","cost").data,{charges:[]});}],
  ["K2 duplicate charge","K2_duplicate_component",c=>{const k=record(c,"synthetic-k2","cost");if(k.data.mode==="K2")k.data.charges.push(structuredClone(k.data.charges[0]));}],
  ["payout uncapped convention","cost_convention_mismatch",c=>{Object.assign(record(c,"synthetic-payout-fixed","cost").data,{convention:"unlimited"});}],
  ["invalid ISIN checksum","invalid_isin",c=>{record(c,"synthetic-fund-1","fund").data.isin="AA0000000001";}],
  ["missing fund availability","unknown_or_missing_field",c=>{Object.assign(record(c,"synthetic-fund-1","fund").data.manufacturer,{implicit:true});}],
  ["source issued after review","source_after_review",c=>{record(c,"synthetic-source","source").data.issuedOn="2026-11-18";}],
  ["unknown cost mode","unknown_cost_mode",c=>{Object.assign(record(c,"synthetic-payout-1","cost").data,{mode:"free"});}],
  ["unknown parameter owner","missing_product_owner",c=>{record(c,"synthetic-cost-1","parameter").data.productId="missing-product";}],
  ["mismatched tariff","cost_tariff_product",c=>{Object.assign(record(c,"synthetic-k1-m1-1","cost").data,{tariff:reference(record(c,"synthetic-tariff-2","tariff"))});}],
  ["inaccessible portfolio fund","portfolio_fund_unavailable",c=>{record(c,"synthetic-tariff-1","tariff").data.fundOptions.splice(0,1);}]
];
for(const [name,expected,mutate] of negative)test("P1-negative: "+name,()=>{
  const c=syntheticCatalog();mutate(c);reseal(c);code(parseCatalog(c),expected);
});
test("P1-17: current dependencies cannot silently retain an older parameter revision",()=>{
  const old=syntheticCatalog(),n=reviseCosts(old);
  n.current=n.current.map(r=>r.id.startsWith("synthetic-k1-")?reference(record(old,r.id,"cost")):r);reseal(n);
  code(parseCatalog(n),"historical_as_current");
  const n2=reviseCosts(old);n2.records=n2.records.filter(r=>!(r.kind==="cost" && r.revision===2));
  n2.current=n2.current.map(r=>r.kind==="cost"?reference(record(old,r.id,"cost")):r);reseal(n2);
  code(parseCatalog(n2),"stale_dependency");
});
test("P1-18: conflicting document versions, unknown references and predecessor gaps fail",()=>{
  const c=syntheticCatalog(),s=structuredClone(record(c,"synthetic-source","source"));
  (s as {revision:number}).revision=2;s.previous=reference(record(c,"synthetic-source","source"));s.data.documentHash="1".repeat(64);
  c.records.push(s);reseal(c);code(parseCatalog(c),"conflicting_source_version");
  const bad=syntheticCatalog(),r=record(bad,"synthetic-fund-1");(r as {revision:number}).revision=3;reseal(bad);
  code(parseCatalog(bad),"invalid_predecessor");
  const ref=reference(record(syntheticCatalog(),"synthetic-product-1","product"));
  code(resolveCurrent(syntheticCatalog(),{...ref,hash:"f".repeat(64)},"2026-11-17"),"invalid_reference");
});
test("P1-19: hostile objects do not execute accessors or inherit hidden fields",()=>{
  let reads=0;const c=syntheticCatalog();
  Object.defineProperty(c,"evil",{enumerable:true,get(){reads++;throw new Error("Must not read");}});
  code(parseCatalog(c),"invalid_shape");expect(reads).toBe(0);
  const sparse=syntheticCatalog();sparse.records.length++;code(parseCatalog(sparse),"invalid_array");
  const cyclic=syntheticCatalog();Object.assign(cyclic,{self:cyclic});code(parseCatalog(cyclic),"cyclic_data");
  const symbol=syntheticCatalog();Object.assign(symbol,{[Symbol("secret")]:1});code(parseCatalog(symbol),"invalid_shape");
  const hidden=syntheticCatalog();Object.defineProperty(hidden,"secret",{value:1});code(parseCatalog(hidden),"invalid_shape");
  code(parseCatalog(new Date()),"invalid_shape");
});
test("P1-20: cost selection rejects hostile fields and reference/model mismatches",()=>{
  const c=syntheticCatalog(),s=costSelection(c);
  code(validateCostSelection(c,{...s,modelVersion:"latest"}),"unknown_version");
  code(validateCostSelection(c,{...s,extra:true}),"unknown_or_missing_field");
  code(validateCostSelection(c,{...s,costs:[s.costs[1],s.costs[1]]}),"duplicate_reference");
  code(validateCostSelection(c,{...s,costs:[reference(record(c,"synthetic-k1-m1-2","cost")),s.costs[1]]}),"cost_scope");
});
test("P1-browser: catalog runtime works without changing existing cases, UI, storage or schema",async({page})=>{
  const bundled=await build({entryPoints:["app/domain/retirement/catalog-validation.ts"],bundle:true,write:false,format:"iife",globalName:"AVDCatalog",platform:"browser",target:"es2022"});
  await page.goto("./");
  const state=()=>page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage},url:location.href,text:document.body.innerText}));
  const before=await state();await page.addScriptTag({content:bundled.outputFiles[0].text});
  const result=await page.evaluate(c=>{
    const api=(window as unknown as {AVDCatalog:{parseCatalog:(c:unknown)=>{ok:boolean};publicCatalog:(c:unknown,ch:string)=>{ok:boolean}}}).AVDCatalog;
    return {valid:api.parseCatalog(c).ok,public:api.publicCatalog(c,"asset").ok};
  },syntheticCatalog());
  expect(result).toEqual({valid:true,public:false});expect(await state()).toEqual(before);
});

test("P1-21: annual payout proxy has its own parameter and versioned convention",()=>{
  const c=syntheticCatalog(),s=costSelection(c),p=record(c,"synthetic-payout-1","cost");
  const rate=structuredClone(record(c,"synthetic-cost-1","parameter"));(rate as {id:string}).id="synthetic-payout-rate";
  rate.data.phase="payout";c.records.push(rate);c.current.push(reference(rate));
  p.data={product:s.product,tariff:s.tariff,phase:"payout",mode:"annual_balance_ratio",
    parameter:reference(rate),convention:"payout_balance_factor_v1",components:["payout"]};
  reseal(c);expect(validateCostSelection(c,costSelection(c))).toMatchObject({ok:true});
  Object.assign(p.data,{convention:"wrong"});reseal(c);code(parseCatalog(c),"cost_convention_mismatch");
});
test("P1-22: ordinary exact-cent fees are accepted and fractional cents rejected",()=>{
  const c=syntheticCatalog(),p=record(c,"synthetic-fixed-fee","parameter");
  p.data.value={class:"B",value:0.29,reason:"Artificial exact-cent fee"};reseal(c);valid(c);
  p.data.value={class:"B",value:0.291,reason:"Fractional-cent fee"};reseal(c);code(parseCatalog(c),"invalid_cent_value");
});
test("P1-23: a complete explicit M3 evidence manifest is accepted only with final sources",()=>{
  const c=syntheticCatalog(),p=record(c,"synthetic-product-1","product"),cap=p.data.capabilities[2];
  const cases=structuredClone(record(c,"synthetic-algorithm","source"));(cases as {id:string}).id="synthetic-reference-cases";
  cases.data.purpose="reference_cases";cases.data.documentHash="e".repeat(64);c.records.push(cases);c.current.push(reference(cases));
  const a=reference(record(c,"synthetic-algorithm","source")),k=reference(record(c,"synthetic-schedule","source"));
  cap.requirements={investment:[a],costs:[k],guarantee:[a],payout:[a],referenceCases:[reference(cases)]};cap.status="available";reseal(c);valid(c);
  record(c,"synthetic-algorithm","source").data.authority="manufacturer_provisional";reseal(c);code(parseCatalog(c),"M3_evidence_unverified");
});
test("P1-24: cost and publication histories require a linked catalog successor",()=>{
  const old=syntheticCatalog(),n=reviseCosts(old);
  n.previousHash="0".repeat(64);reseal(n);code(appendCatalogRevision(old,n),"catalog_chain_mismatch");
  const h=reviseCosts(old);record(h,"synthetic-cost-1","parameter").publication={state:"internal"};
  expect(publicCatalog(h,"source")).toMatchObject({ok:false});
});
test("P1-25: forged hashes and non-finite values cannot cross ingestion",()=>{
  const c=syntheticCatalog();c.current[0]={...c.current[0],hash:"0".repeat(64)};c.hash=revisionHash(c);code(parseCatalog(c),"invalid_reference");
  for(const n of [NaN,Infinity,-Infinity,-0]){
    const x=syntheticCatalog();Object.assign(record(x,"synthetic-cost-1","parameter").data.value,{value:n});code(parseCatalog(x),"invalid_number");
  }
});

test("P1-26: savings cost assumptions cannot silently become payout assumptions",()=>{
  const c=syntheticCatalog(),s=costSelection(c),p=record(c,"synthetic-payout-1","cost");
  p.data={product:s.product,tariff:s.tariff,phase:"payout",mode:"annual_balance_ratio",
    parameter:reference(record(c,"synthetic-cost-1","parameter")),convention:"payout_balance_factor_v1",components:["payout"]};
  reseal(c);code(parseCatalog(c),"parameter_scope");
});
