import type { Catalog, CatalogRecord, CaseOverride, ValidatedCatalog, ParameterData } from "./catalog-contract";
import type { CostData, CostSelection } from "./cost-contract";
import { CATALOG_FORMAT, MODEL_VERSIONS, CatalogError, refKey, revisionHash, type Checked, type DeepReadonly, type Kind, type Ref, type Model } from "./identity-contract";
import { canonicalJson } from "../case/recovery-hash";
import type { Channel } from "./source-contract";

const KINDS = ["source","product","tariff","fund","portfolio","parameter","cost"] as const;
const COMPONENTS = ["fund_ter","acquisition","administration","custody","transaction","payout"] as const;
const CHANNELS = ["source","asset","display","export"] as const;
const fail = (code: string, path: string): never => { throw new CatalogError(code,path); };
function check(ok: unknown, code: string, p: string): asserts ok { if (!ok) fail(code,p); }
/** Boundary for inert JSON data, not a sandbox for executable objects or Proxies.
 * Own accessors, sparse arrays and cycles are rejected without invoking those accessors.
 * Reflection on a Proxy can execute traps; callers must not submit executable objects.
 * Limits protect this synchronous catalog boundary, not the financial projection horizon. */
function copyPlain(input: unknown): unknown {
  let count = 0;
  const seen = new Set<object>();
  function copy(v: unknown, depth: number): unknown {
    check(++count <= 100000 && depth <= 40,"resource_limit","$");
    if (typeof v === "string") { check(wellFormed(v),"invalid_unicode","$"); return v; }
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "number") { check(Number.isFinite(v) && !Object.is(v,-0),"invalid_number","$"); return v; }
    check(typeof v === "object" && v !== null,"invalid_shape","$");
    check(!seen.has(v),"cyclic_data","$");
    seen.add(v);
    const proto = Object.getPrototypeOf(v);
    const ds = Object.getOwnPropertyDescriptors(v);
    const keys = Reflect.ownKeys(ds);
    let out: unknown;
    if (Array.isArray(v)) {
      check(proto === Array.prototype,"invalid_shape","$");
      const len = ds.length.value as number;
      check(len <= 10000 && keys.length === len+1,"invalid_array","$");
      const a: unknown[] = [];
      for (let i=0;i<len;i++) {
        const d=ds[String(i)];
        check(d && "value" in d && d.enumerable,"invalid_array","$");
        a.push(copy(d.value,depth+1));
      }
      check(keys.every(k=>k==="length" || typeof k==="string" && /^(0|[1-9][0-9]*)$/.test(k) && Number(k)<len),"invalid_array","$");
      out=a;
    } else {
      check(proto === Object.prototype || proto === null,"invalid_shape","$");
      const o: Record<string,unknown> = Object.create(null);
      for (const k of keys) {
        check(typeof k === "string","invalid_shape","$");
        check(wellFormed(k),"invalid_unicode","$");
        const d=ds[k];
        check("value" in d && d.enumerable,"invalid_shape","$");
        o[k]=copy(d.value,depth+1);
      }
      out=o;
    }
    seen.delete(v);
    return out;
  }
  return copy(input,0);
}
/** Require well-formed Unicode in inert external data, including object keys. */
function wellFormed(s:string):boolean {
  for(let i=0;i<s.length;i++) {
    const code=s.charCodeAt(i);
    if(code>=0xd800 && code<=0xdbff){const next=s.charCodeAt(++i);if(!(next>=0xdc00 && next<=0xdfff))return false;}
    else if(code>=0xdc00 && code<=0xdfff)return false;
  }
  return true;
}
function object(v: unknown, keys: readonly string[], p: string): asserts v is Record<string,unknown> {
  check(v!==null && typeof v==="object" && !Array.isArray(v),"invalid_shape",p);
  check(Object.keys(v).length===keys.length && keys.every(k=>Object.hasOwn(v,k)),"unknown_or_missing_field",p);
}
function array(v: unknown, p: string): asserts v is unknown[] { check(Array.isArray(v),"invalid_array",p); }
function text(v: unknown,p:string): asserts v is string { check(typeof v==="string" && v.length>0 && v.length<=2048 && v.trim()===v,"invalid_text",p); }
function id(v: unknown,p:string): asserts v is string { check(typeof v==="string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v),"invalid_id",p); }
function integer(v:unknown,min:number,max:number,p:string): asserts v is number { check(Number.isSafeInteger(v) && (v as number)>=min && (v as number)<=max,"invalid_integer",p); }
function member(v:unknown,choices:readonly string[],p:string): asserts v is string { check(typeof v==="string" && choices.includes(v),"unknown_value",p); }
function hash(v:unknown,p:string): asserts v is string { check(typeof v==="string" && /^[0-9a-f]{64}$/.test(v),"invalid_hash",p); }
function date(v:unknown,p:string): asserts v is string {
  check(typeof v==="string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v),"invalid_date",p);
  const y=Number(v.slice(0,4)),m=Number(v.slice(5,7)),d=Number(v.slice(8,10));
  const days=[31,y%4===0 && (y%100!==0 || y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
  check(y>=100 && m>=1 && m<=12 && d>=1 && d<=days[m-1],"invalid_date",p);
}
function period(from:unknown,to:unknown,p:string) {
  date(from,p+".from"); if(to!==null){date(to,p+".to");check(from<=to,"invalid_period",p);}
}
function ref(v:unknown,p:string,kind?:Kind): asserts v is Ref {
  object(v,["kind","id","revision","hash"],p);member(v.kind,KINDS,p);id(v.id,p);integer(v.revision,1,Number.MAX_SAFE_INTEGER,p);hash(v.hash,p);
  if(kind)check(v.kind===kind,"reference_kind",p);
}
function refs(v:unknown,p:string,kind?:Kind) {
  array(v,p); const seen=new Set<string>();
  v.forEach((r,i)=>{ref(r,p+"."+i,kind);check(!seen.has(refKey(r)),"duplicate_reference",p);seen.add(refKey(r));});
}
function strings(v:unknown,choices:readonly string[],p:string,nonempty=false) {
  array(v,p);check(!nonempty || v.length>0,"missing_value",p);
  v.forEach(x=>member(x,choices,p));check(new Set(v).size===v.length,"duplicate_value",p);
}
function publication(v:unknown,p:string) {
  check(v!==null && typeof v==="object","invalid_shape",p);
  const state=(v as Record<string,unknown>).state;
  if(state==="internal")object(v,["state"],p);
  else {
    object(v,["state","channels","approval"],p);check(v.state==="released","unknown_value",p);
    strings(v.channels,CHANNELS,p+".channels",true);
    object(v.approval,["authority","record","approvedOn"],p+".approval");
    text(v.approval.authority,p);text(v.approval.record,p);date(v.approval.approvedOn,p);
  }
}
function availability(v:unknown,p:string) {
  object(v,["state","reason","evidence"],p);member(v.state,["announced","available","blocked","open"],p);text(v.reason,p);
  if(v.evidence!==null)ref(v.evidence,p,"source");
  check(v.state==="open" || v.state==="blocked" || v.evidence!==null,"missing_evidence",p);
}
function model(v:unknown,p:string) {
  object(v,["model","version"],p);member(v.model,Object.keys(MODEL_VERSIONS),p);
  check(v.version===MODEL_VERSIONS[v.model as keyof typeof MODEL_VERSIONS],"unknown_version",p);
}
function value(v:unknown,unit:string,p:string) {
  object(v,["class","value","reason"],p);member(v.class,["B","A","S","O"],p);text(v.reason,p);
  if(v.class==="O"){check(v.value===null,"open_value_must_be_null",p);return;}
  if(unit==="date")date(v.value,p);
  else {
    check(typeof v.value==="number" && Number.isFinite(v.value) && v.value>=0 && !Object.is(v.value,-0),"invalid_parameter_value",p);
    if(unit==="ratio" || unit==="annual_ratio")check(v.value<1 || unit==="ratio" && v.value===1,"invalid_ratio",p);
    if(unit==="months" || unit==="years")integer(v.value,0,9999,p);
    if(unit==="eur")check(/^[0-9]+(?:[.][0-9]{1,2})?$/.test(String(v.value)) && Number.isSafeInteger(Math.round(v.value*100)),"invalid_cent_value",p);
  }
}
function components(v:unknown,p:string) { strings(v,COMPONENTS,p,true); }
function costShape(d:Record<string,unknown>,p:string) {
  const common=["product","tariff","phase","mode"];
  ref(d.product,p,"product");ref(d.tariff,p,"tariff");member(d.phase,["savings","payout"],p);
  if(d.mode==="K1") {
    object(d,[...common,"model","modelVersion","convention","parameter","basis","notIndividualOffer","components"],p);
    check(d.phase==="savings","invalid_cost_phase",p);member(d.model,["M1","M2"],p);
    check(d.modelVersion===MODEL_VERSIONS[d.model as "M1"|"M2"],"unknown_version",p);
    check(d.convention===(d.model==="M1"?"M1_additive_v1":"M2_balance_factor_v1"),"cost_convention_mismatch",p);
    ref(d.parameter,p,"parameter");check(d.basis==="effective_yield_reduction" && d.notIndividualOffer===true,"invalid_cost_basis",p);
    components(d.components,p);
  } else if(d.mode==="K2") {
    object(d,[...common,"tariffEvidence","coverage","status","reason","components","charges"],p);
    ref(d.tariffEvidence,p,"source");member(d.coverage,["complete","incomplete"],p);member(d.status,["verified","blocked"],p);text(d.reason,p);components(d.components,p);
    array(d.charges,p);
    for(const charge of d.charges) {
      object(charge,["component","type","parameter","basis","timing"],p);member(charge.component,COMPONENTS,p);member(charge.type,["fixed","rate"],p);
      ref(charge.parameter,p,"parameter");member(charge.basis,["balance","contribution","payment","contract"],p);
      object(charge.timing,["frequency","at","from","until"],p);
      member(charge.timing.frequency,["once","monthly","annual"],p);member(charge.timing.at,["before_return","after_return_before_payment","month_end"],p);
      period(charge.timing.from,charge.timing.until,p);
    }
    check(d.status!=="verified" || d.coverage==="complete","incomplete_K2",p);
  } else {
    check(d.phase==="payout","invalid_cost_phase",p);
    switch(d.mode) {
      case "open":object(d,[...common,"reason"],p);text(d.reason,p);break;
      case "before_payout_costs":object(d,[...common,"label"],p);check(d.label==="scenario_before_payout_costs","missing_cost_label",p);break;
      case "monthly_fixed_eur":case "annual_balance_ratio":
        object(d,[...common,"parameter","convention","components"],p);ref(d.parameter,p,"parameter");components(d.components,p);
        check(d.convention===(d.mode==="monthly_fixed_eur"?"capped_at_available_balance_v1":"payout_balance_factor_v1"),"cost_convention_mismatch",p);break;
      default:fail("unknown_cost_mode",p);
    }
  }
}
function recordShape(v:unknown,p:string): asserts v is CatalogRecord {
  object(v,["kind","id","revision","hash","validFrom","validTo","previous","reviewedOn","changedOn","changedBy","publication","citations","data"],p);
  member(v.kind,KINDS,p);id(v.id,p);integer(v.revision,1,Number.MAX_SAFE_INTEGER,p);hash(v.hash,p);period(v.validFrom,v.validTo,p);
  date(v.reviewedOn,p);date(v.changedOn,p);text(v.changedBy,p);check(v.reviewedOn<=v.changedOn,"invalid_review_date",p);
  if(v.previous!==null)ref(v.previous,p,v.kind as Kind);
  publication(v.publication,p);array(v.citations,p);
  for(const c of v.citations){object(c,["source","locator"],p);ref(c.source,p,"source");text(c.locator,p);}
  check(v.kind==="source" || v.citations.length>0,"missing_citation",p);
  check(v.data!==null && typeof v.data==="object" && !Array.isArray(v.data),"invalid_shape",p);
  const d=v.data as Record<string,unknown>;
  switch(v.kind) {
    case "source":
      object(d,["title","documentVersion","documentHash","issuedOn","authority","purpose"],p);
      text(d.title,p);text(d.documentVersion,p);hash(d.documentHash,p);date(d.issuedOn,p);check(d.issuedOn<=v.reviewedOn,"source_after_review",p);
      member(d.authority,["legislation","manufacturer_final","manufacturer_provisional","project","scenario"],p);
      member(d.purpose,["property","parameter","cost_schedule","algorithm","reference_cases","publication","annuity_factor"],p);
      check(v.citations.length===0,"source_citation_cycle",p);break;
    case "product":
      object(d,["name","manufacturerId","features","manufacturer","bank","guarantee","capabilities"],p);
      text(d.name,p);id(d.manufacturerId,p);refs(d.features,p,"parameter");availability(d.manufacturer,p);availability(d.bank,p);
      check(d.guarantee!==null && typeof d.guarantee==="object","invalid_shape",p);
      {const g=d.guarantee as Record<string,unknown>;
        if(g.kind==="none")object(g,["kind"],p);
        else if(g.kind==="open"){object(g,["kind","reason"],p);text(g.reason,p);}
        else {
          object(g,["kind","rate","basis","appliesAt","referenceDate","evidence"],p);
          member(g.kind,["contribution_guarantee","value_protection_target"],p);ref(g.rate,p,"parameter");ref(g.evidence,p,"source");
          member(g.basis,["own_and_grants","own_grants_and_extra","dated_value"],p);check(g.appliesAt==="contract_maturity","invalid_guarantee_time",p);
          if(g.kind==="value_protection_target"){check(g.basis==="dated_value","invalid_guarantee_basis",p);date(g.referenceDate,p);}
          else {check(g.basis!=="dated_value" && g.referenceDate===null,"invalid_guarantee_basis",p);}
        }
      }
      array(d.capabilities,p);check(d.capabilities.length===3,"missing_model_capability",p);
      {const seen=new Set<string>();for(const c of d.capabilities){
        object(c,["model","version","status","reason","requirements"],p);
        model({model:c.model,version:c.version},p);check(!seen.has(c.model as string),"duplicate_model",p);seen.add(c.model as string);
        member(c.status,["available","blocked"],p);text(c.reason,p);
        object(c.requirements,["investment","costs","guarantee","payout","referenceCases"],p);
        for(const a of Object.values(c.requirements))refs(a,p,"source");
      }}break;
    case "tariff":
      object(d,["product","name","manufacturerCode","accessRules","fundOptions","portfolios","payouts","annuityFactor","manufacturer","bank"],p);
      ref(d.product,p,"product");text(d.name,p);if(d.manufacturerCode!==null)text(d.manufacturerCode,p);
      refs(d.accessRules,p,"parameter");refs(d.fundOptions,p,"fund");refs(d.portfolios,p,"portfolio");
      strings(d.payouts,["fund_plan","life_annuity"],p,true);
      if(d.annuityFactor!==null){ref(d.annuityFactor,p,"parameter");check((d.payouts as string[]).includes("life_annuity"),"invalid_annuity_reference",p);}
      availability(d.manufacturer,p);availability(d.bank,p);break;
    case "fund":
      object(d,["name","isin","assetClass","informationalTer","manufacturer"],p);text(d.name,p);
      if(d.isin!==null)check(typeof d.isin==="string" && validIsin(d.isin),"invalid_isin",p);
      member(d.assetClass,["equity","bond","cash","commodity","secured_assets"],p);
      if(d.informationalTer!==null)ref(d.informationalTer,p,"parameter");availability(d.manufacturer,p);break;
    case "portfolio":
      object(d,["name","mode","weights"],p);text(d.name,p);member(d.mode,["comfort","individual"],p);array(d.weights,p);
      {let sum=0;const seen=new Set<string>();for(const w of d.weights){
        object(w,["fund","basisPoints"],p);ref(w.fund,p,"fund");integer(w.basisPoints,1,10000,p);
        check(!seen.has(refKey(w.fund)),"duplicate_fund",p);seen.add(refKey(w.fund));
        if(d.mode==="individual")check(w.basisPoints%1000===0,"individual_weight_step",p);
        sum+=w.basisPoints;
      }check(sum===10000,"portfolio_total",p);}break;
    case "parameter":
      object(d,["name","purpose","productId","tariffId","phase","unit","value","models","approval","overridePolicy"],p);
      member(d.purpose,["general","annuity_factor"],p);
      text(d.name,p);if(d.productId!==null)id(d.productId,p);if(d.tariffId!==null){id(d.tariffId,p);check(d.productId!==null,"missing_product_owner",p);}
      if(d.phase!==null)member(d.phase,["savings","payout"],p);
      member(d.unit,["annual_ratio","ratio","eur","years","months","date"],p);value(d.value,d.unit,p);
      member(d.approval,["approved","proposed","open"],p);member(d.overridePolicy,["scenario","forbidden"],p);array(d.models,p);
      {const seen=new Set<string>();for(const m of d.models){model(m,p);check(!seen.has((m as {model:string}).model),"duplicate_model",p);seen.add((m as {model:string}).model);}}
      if((d.value as {class:string}).class==="B")check(d.overridePolicy==="forbidden" && v.citations.length>0,"missing_B_evidence",p);
      check((d.value as {class:string}).class!=="O" || d.approval==="open","open_parameter_approval",p);break;
    case "cost":costShape(d,p);break;
  }
  check(v.hash===revisionHash(v),"content_hash_mismatch",p);
}
function validIsin(isin:string) {
  if(!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin))return false;
  const digits=isin.replace(/[A-Z]/g,c=>String(c.charCodeAt(0)-55));let sum=0;
  for(let i=digits.length-1,n=0;i>=0;i--,n++){let d=Number(digits[i]);if(n%2===1)d*=2;sum+=Math.floor(d/10)+d%10;}
  return sum%10===0;
}
function freeze<T>(v:T):DeepReadonly<T> {
  if(v!==null && typeof v==="object"){Object.values(v).forEach(x=>freeze(x));Object.freeze(v);}
  return v as DeepReadonly<T>;
}
type Context = {
  catalog: Catalog;
  get: <K extends Kind>(r:Ref<K>,kind?:K)=>CatalogRecord<K>;
  current: (r:Ref)=>boolean;
};
function graph(c:Catalog):Context {
  const map=new Map<string,CatalogRecord>(), latest=new Map<string,CatalogRecord>();
  for(const r of c.records){
    const key=refKey(r);check(!map.has(key),"duplicate_identity",key);map.set(key,r);
    const identity=JSON.stringify([r.kind,r.id]);const old=latest.get(identity);if(!old || r.revision>old.revision)latest.set(identity,r);
    check(r.changedOn<=c.asOf,"future_revision",key);
  }
  const documents=new Map<string,string>();
  for(const r of c.records)if(r.kind==="source"){const key=JSON.stringify([r.id,r.data.documentVersion]);const known=documents.get(key);check(!known || known===r.data.documentHash,"conflicting_source_version",refKey(r));documents.set(key,r.data.documentHash);}
  const get=<K extends Kind>(r:Ref<K>,kind?:K):CatalogRecord<K>=>{
    const found=map.get(refKey(r));check(found && found.hash===r.hash && (!kind || found.kind===kind),"invalid_reference",refKey(r));
    return found as CatalogRecord<K>;
  };
  const currentKeys=new Set(c.current.map(refKey));
  const current=(r:Ref)=>currentKeys.has(refKey(r)) && get(r).hash===r.hash;
  const ctx={catalog:c,get,current};
  for(const r of c.records) {
    if(r.revision===1)check(r.previous===null,"unexpected_predecessor",refKey(r));
    else {
      check(r.previous && r.previous.kind===r.kind && r.previous.id===r.id && r.previous.revision===r.revision-1,"invalid_predecessor",refKey(r));
      const old=get(r.previous);check(old.changedOn<=r.changedOn && old.validFrom<=r.validFrom,"revision_time_reversal",refKey(r));
    }
    for(const link of links(r)){get(link);}
    semantic(ctx,r);
  }
  for(const r of c.current) {
    const record=get(r);
    check(latest.get(JSON.stringify([r.kind,r.id]))===record,"historical_as_current",refKey(r));
    check(active(record,c.asOf),"outside_validity",refKey(r));
    for(const link of links(record))check(current(link) && active(get(link),c.asOf),"stale_dependency",refKey(r));
  }
  return ctx;
}
/** References in the record body and citations, excluding immutable predecessor links. */
function links(r:CatalogRecord):Ref[] {
  const found:Ref[]=[];
  const visit=(v:unknown)=>{
    if(v && typeof v==="object"){
      const o=v as Record<string,unknown>;
      if(Object.keys(o).length===4 && "kind" in o && "id" in o && "revision" in o && "hash" in o){found.push(o as Ref);return;}
      Object.values(o).forEach(visit);
    }
  };
  visit(r.data);visit(r.citations);return found;
}
const active=(r:CatalogRecord,on:string)=>r.validFrom<=on && (r.validTo===null || on<=r.validTo);
function parameter(ctx:Context,r:Ref<"parameter">,unit:string,purpose:ParameterData["purpose"],owner?:{product:Ref<"product">;tariff:Ref<"tariff">;phase:"savings"|"payout"},use?:{model:Model;version:string}) {
  const p=ctx.get(r,"parameter").data;
  check(p.purpose===purpose,"parameter_purpose",refKey(r));
  check(p.unit===unit,"parameter_unit",refKey(r));
  check(p.value.class!=="O" && p.approval==="approved","parameter_not_approved",refKey(r));
  if(owner)check(p.phase===owner.phase && (p.productId===null || p.productId===owner.product.id) && (p.tariffId===null || p.tariffId===owner.tariff.id),"parameter_scope",refKey(r));
  if(use)check(p.models.some(m=>m.model===use.model && m.version===use.version),"parameter_model_mismatch",refKey(r));
  return p;
}
function semantic(ctx:Context,r:CatalogRecord) {
  const p=refKey(r);
  for(const c of r.citations) {
    const source=ctx.get(c.source,"source");
    check(source.data.issuedOn<=r.reviewedOn,"source_after_review",p);
    check(active(source,r.reviewedOn),"source_not_valid_at_review",p);
  }
  if(r.publication.state==="released")check(r.publication.approval.approvedOn<=r.changedOn,"future_publication_approval",p);
  if(r.kind==="parameter"){
    if(r.data.purpose==="annuity_factor")check(r.data.overridePolicy==="forbidden","annuity_override_forbidden",p);
    if(r.data.productId!==null)check(ctx.catalog.records.some(x=>x.kind==="product" && x.id===r.data.productId),"missing_product_owner",p);
    if(r.data.tariffId!==null)check(ctx.catalog.records.some(x=>x.kind==="tariff" && x.id===r.data.tariffId && x.data.product.id===r.data.productId),"missing_tariff_owner",p);
    if(r.data.value.class==="B")check(r.citations.some(c=>["legislation","manufacturer_final","manufacturer_provisional"].includes(ctx.get(c.source,"source").data.authority)),"missing_B_evidence",p);
  }
  if(r.kind==="product") {
    for(const f of r.data.features){const v=ctx.get(f,"parameter").data;check(v.productId===null || v.productId===r.id,"parameter_scope",p);}
    const g=r.data.guarantee;
    if(g.kind==="contribution_guarantee" || g.kind==="value_protection_target"){
      const v=parameter(ctx,g.rate,"ratio","general");check(v.productId===null || v.productId===r.id,"parameter_scope",p);
      check(v.value.class==="B" && r.citations.some(c=>refKey(c.source)===refKey(g.evidence)),"missing_guarantee_evidence",p);
    }
    for(const cap of r.data.capabilities)if(cap.status==="available" && cap.model==="M3"){
      for(const [section,refs] of Object.entries(cap.requirements)){
        check(refs.length>0,"M3_evidence_incomplete",p+"."+section);
        for(const s of refs){const src=ctx.get(s,"source").data;
          check(src.authority==="manufacturer_final" && src.purpose===(section==="referenceCases"?"reference_cases":section==="costs"?"cost_schedule":"algorithm"),"M3_evidence_unverified",p);}
      }
    }
  }
  if(r.kind==="tariff"){
    for(const a of r.data.accessRules){const v=ctx.get(a,"parameter").data;check((v.productId===null || v.productId===r.data.product.id) && (v.tariffId===null || v.tariffId===r.id),"parameter_scope",p);}
    for(const port of r.data.portfolios)for(const w of ctx.get(port,"portfolio").data.weights)check(r.data.fundOptions.some(f=>canonicalJson(f)===canonicalJson(w.fund)),"portfolio_fund_unavailable",p);
    if(r.data.annuityFactor!==null) {
      const v=ctx.get(r.data.annuityFactor,"parameter").data;
      check(v.unit==="eur" && v.purpose==="annuity_factor" && v.phase==="payout"
        && v.productId===r.data.product.id && v.tariffId===r.id,"invalid_annuity_factor",p);
      if(v.value.class!=="O") {
        parameter(ctx,r.data.annuityFactor,"eur","annuity_factor",{product:r.data.product,tariff:r,phase:"payout"});
        check(v.value.class==="B" && ctx.get(r.data.annuityFactor,"parameter").citations.some(c=>{
          const source=ctx.get(c.source,"source").data;
          return source.authority==="manufacturer_final" && source.purpose==="annuity_factor";
        }),"annuity_evidence_unverified",p);
      }
    }
  }
  if(r.kind==="fund" && r.data.isin!==null)check(r.citations.some(c=>["manufacturer_final","manufacturer_provisional"].includes(ctx.get(c.source,"source").data.authority)),"missing_isin_evidence",p);
  if(r.kind==="fund" && r.data.informationalTer!==null){const v=ctx.get(r.data.informationalTer,"parameter").data;check(v.unit==="annual_ratio","parameter_unit",p);}
  if(r.kind==="cost") {
    const d=r.data;
    check(canonicalJson(ctx.get(d.tariff,"tariff").data.product)===canonicalJson(d.product),"cost_tariff_product",p);
    if(d.mode==="K1"){
      const v=parameter(ctx,d.parameter,"annual_ratio","general",d);
      check(v.value.class==="A" && v.models.some(m=>m.model===d.model && m.version===d.modelVersion),"K1_working_parameter_required",p);
      check(r.citations.length>0,"missing_cost_evidence",p);
    } else if(d.mode==="monthly_fixed_eur" || d.mode==="annual_balance_ratio"){
      parameter(ctx,d.parameter,d.mode==="monthly_fixed_eur"?"eur":"annual_ratio","general",d);
    } else if(d.mode==="K2" && d.status==="verified"){
      const source=ctx.get(d.tariffEvidence,"source").data;
      check(d.coverage==="complete" && source.authority==="manufacturer_final" && source.purpose==="cost_schedule" && r.citations.some(c=>canonicalJson(c.source)===canonicalJson(d.tariffEvidence)),"K2_evidence_unverified",p);
      check(d.charges.length>0,"K2_missing_charges",p);
      for(const charge of d.charges) {
        check(d.components.includes(charge.component),"K2_coverage_mismatch",p);
        const par=parameter(ctx,charge.parameter,charge.type==="fixed"?"eur":"ratio","general",d);
        check(par.value.class==="B" && ctx.get(charge.parameter,"parameter").citations.some(c=>canonicalJson(c.source)===canonicalJson(d.tariffEvidence)),"K2_parameter_unverified",p);
        check(charge.timing.from>=r.validFrom && (r.validTo===null || charge.timing.until!==null && charge.timing.until<=r.validTo),"K2_charge_period",p);
        check(charge.type!=="fixed" || charge.basis==="contract","K2_fixed_basis",p);
      }
      check(d.components.every(x=>d.charges.some(charge=>charge.component===x)),"K2_coverage_mismatch",p);
      for(let i=0;i<d.charges.length;i++)for(let j=i+1;j<d.charges.length;j++){
        const a=d.charges[i],b=d.charges[j];
        check(!(a.component===b.component && a.timing.from<=(b.timing.until??"9999-12-31") && b.timing.from<=(a.timing.until??"9999-12-31")),"K2_duplicate_component",p);
      }
    }
  }
}
function checked<T>(fn:()=>T):Checked<T> {
  try{return {ok:true,value:freeze(fn())};}catch(e){return {ok:false,issue:e instanceof CatalogError?{code:e.code,path:e.path}:{code:"invalid_shape",path:"$"}};}
}
/** The only external catalog ingestion boundary. Copies before validating and freezes on success. */
export function parseCatalog(input:unknown):Checked<Catalog> {
  return checked(()=>{
    const c=copyPlain(input);
    object(c,["format","id","revision","previousHash","hash","origin","asOf","records","current"],"$");
    check(c.format===CATALOG_FORMAT,"unknown_version","$.format");id(c.id,"$.id");integer(c.revision,1,Number.MAX_SAFE_INTEGER,"$.revision");
    hash(c.hash,"$.hash");if(c.previousHash!==null)hash(c.previousHash,"$.previousHash");check((c.revision===1)===(c.previousHash===null),"invalid_catalog_predecessor","$");
    member(c.origin,["synthetic","working"],"$.origin");date(c.asOf,"$.asOf");
    array(c.records,"$.records");check(c.records.length>0,"empty_catalog","$");
    c.records.forEach((r,i)=>recordShape(r,"$.records."+i));refs(c.current,"$.current");check((c.current as unknown[]).length>0,"empty_current","$");
    check(c.hash===revisionHash(c),"content_hash_mismatch","$");
    graph(c as unknown as Catalog);return c as unknown as Catalog;
  });
}
function mustCatalog(input:unknown):Context {
  const result=parseCatalog(input);if(!result.ok)return fail(result.issue.code,result.issue.path);
  return graph(result.value as unknown as Catalog);
}
/** Exact reference + explicit current membership + date, never a latest fallback. */
export function resolveCurrent(input:unknown,reference:unknown,on:unknown):Checked<CatalogRecord> {
  return checked(()=>{const ctx=mustCatalog(input);const r=copyPlain(reference);ref(r,"$.reference");date(on,"$.on");
    check(on===ctx.catalog.asOf,"catalog_date_mismatch","$.on");ctx.get(r);check(ctx.current(r),"not_current",refKey(r));return ctx.get(r);});
}
export function appendCatalogRevision(previous:unknown,next:unknown):Checked<Catalog> {
  return checked(()=>{
    const old=mustCatalog(previous).catalog,ctx=mustCatalog(next),n=ctx.catalog;
    check(n.id===old.id && n.origin===old.origin && n.revision===old.revision+1 && n.previousHash===old.hash && n.asOf>=old.asOf,"catalog_chain_mismatch","$");
    for(const r of old.records){const retained=ctx.get(r);check(canonicalJson(retained)===canonicalJson(r),"revision_overwrite",refKey(r));}
    return n;
  });
}
export function applyCaseOverride(catalog:unknown,input:unknown):Checked<{ base:Ref<"parameter">; effective:CaseOverride; unit:string }> {
  return checked(()=>{
    const ctx=mustCatalog(catalog),o=copyPlain(input);
    object(o,["format","id","caseId","base","value","recordedOn"],"$");check(o.format==="avd.override.v1","unknown_version","$");
    id(o.id,"$.id");id(o.caseId,"$.caseId");ref(o.base,"$.base","parameter");date(o.recordedOn,"$.recordedOn");
    check(o.recordedOn===ctx.catalog.asOf && ctx.current(o.base),"not_current","$.base");
    const p=ctx.get(o.base as Ref<"parameter">,"parameter").data;
    check(p.overridePolicy==="scenario" && p.value.class!=="B","override_forbidden","$");
    value(o.value,p.unit,"$.value");check((o.value as {class:string}).class==="S","override_must_be_scenario","$");
    return {base:o.base as Ref<"parameter">,effective:o as unknown as CaseOverride,unit:p.unit};
  });
}
/** Fail closed for the entire dependency-closed release, before returning any bytes. */
export function publicCatalog(catalog:unknown,channel:unknown):Checked<Catalog> {
  return checked(()=>{member(channel,CHANNELS,"$.channel");const ctx=mustCatalog(catalog);
    for(const r of ctx.catalog.records)check(r.publication.state==="released" && r.publication.channels.includes(channel as Channel),"publication_blocked",refKey(r));
    return ctx.catalog;
  });
}
export function validateCostSelection(catalog:unknown,input:unknown):Checked<CostSelection> {
  return checked(()=>{
    const ctx=mustCatalog(catalog),s=copyPlain(input);
    object(s,["product","tariff","model","modelVersion","costs","returns"],"$");ref(s.product,"$","product");ref(s.tariff,"$","tariff");
    model({model:s.model,version:s.modelVersion},"$");refs(s.costs,"$.costs","cost");
    object(s.returns,["basis","deducted"],"$.returns");member(s.returns.basis,["gross","net"],"$");array(s.returns.deducted,"$");
    const deducted=new Set<string>();for(const d of s.returns.deducted){object(d,["phase","component"],"$");member(d.phase,["savings","payout"],"$");member(d.component,COMPONENTS,"$");
      const key=d.phase+":"+d.component;check(!deducted.has(key),"duplicate_return_component","$");deducted.add(key);}
    check((s.returns.basis==="gross")===(s.returns.deducted.length===0),"return_basis_mismatch","$");
    const selection=s as unknown as CostSelection;const phases=new Set<string>(),charged=new Set<string>();
    for(const r of [selection.product,selection.tariff,...selection.costs])check(ctx.current(r),"not_current",refKey(r));
    check(canonicalJson(ctx.get(selection.tariff,"tariff").data.product)===canonicalJson(selection.product),"cost_tariff_product","$");
    const product=ctx.get(selection.product,"product").data;
    check(product.capabilities.some(c=>c.model===selection.model && c.version===selection.modelVersion && c.status==="available"),"model_blocked","$");
    for(const r of selection.costs){
      const d=ctx.get(r,"cost").data;
      check(canonicalJson(d.product)===canonicalJson(selection.product) && canonicalJson(d.tariff)===canonicalJson(selection.tariff),"cost_scope","$");
      check(!phases.has(d.phase),"conflicting_cost_modes","$");phases.add(d.phase);
      check(d.mode!=="open","payout_costs_open","$");if(d.mode==="K2")check(d.status==="verified" && d.coverage==="complete","K2_blocked","$");
      if(d.mode==="K1")check(d.model===selection.model && d.modelVersion===selection.modelVersion,"cost_model_mismatch","$");
      const use={model:selection.model,version:selection.modelVersion};
      if(d.mode==="K1" || d.mode==="annual_balance_ratio")parameter(ctx,d.parameter,"annual_ratio","general",d,use);
      else if(d.mode==="monthly_fixed_eur")parameter(ctx,d.parameter,"eur","general",d,use);
      else if(d.mode==="K2")for(const charge of d.charges)parameter(ctx,charge.parameter,charge.type==="fixed"?"eur":"ratio","general",d,use);
      if("components" in d)for(const comp of d.components){const key=d.phase+":"+comp;check(!charged.has(key) && !deducted.has(key),"duplicate_cost_component","$");charged.add(key);}
    }
    check(phases.has("savings") && phases.has("payout"),"missing_cost_phase","$");
    return selection;
  });
}
