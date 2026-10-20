import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CASE_STORAGE_KEY as KEY } from "../app/case-storage";
import { beginRecovery,selectRecoverySource,previewRecovery,confirmRecovery,commitRecovery,recoveryConservation,recoverySourceEntries } from "../app/capital-recovery";
import { diagnoseCapitalRecovery } from "../app/domain/case/capital-recovery-diagnosis";
import { sha256,jsonHash } from "../app/domain/case/recovery-hash";
import { h5bCase,h5bNeighbor,h5bDecisions,h5bDeadline } from "./h5b-fixtures";
import { caseSnapshot,createPlan,normalizeImportedCase,getPreferredStructurePlan,type AdvisoryCase } from "../app/case-model";
import { readCaseStore,saveCaseToStore,insertCaseIntoStore,RECOVERY_PREFIX } from "../app/case-storage";
import { recoveryConfirmationStatus,validCapitalPotRecovery,type RecoveryDecision } from "../app/domain/case/recovery-contract";
import { exactSum,parseRecoveryAmountDraft } from "../app/domain/case/recovery-decimal";
import { canonicalJson } from "../app/domain/case/recovery-hash";
import { ExportCenter } from "../app/page";
import { isValidElement,type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const clone=<T,>(x:T):T=>structuredClone(x);
class Store {
  data=new Map<string,string>();
  constructor(raw:string){this.data.set(KEY,raw);}
  get length(){return this.data.size;} key(i:number){return [...this.data.keys()][i]??null;}
  getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,v);}
}
let passed=0;
function test(name:string,run:()=>void){run();console.log(`PASS H5b ${++passed}: ${name}`);}
const zone="Europe/Berlin" as const;
const setup=(c=h5bCase())=>{
  const raw=JSON.stringify([c,{...h5bNeighbor(),id:"h5b-setup-neighbor"}],null,2),storage=new Store(raw);
  const source=selectRecoverySource(raw,"local",{caseId:c.id});
  return {c,raw,storage,source,session:beginRecovery(storage,source)};
};
test("SHA-256 UTF-8 and multiblock vectors",()=>{for(const v of ["","abc","ä漢字🧭","a".repeat(1000)])assert.equal(sha256(v),createHash("sha256").update(v).digest("hex"));});
test("R03/R05/R10 independent copy, exact source, phased plan and neighbors",()=>{
  const {c,raw,storage,session}=setup(),ds=h5bDecisions();
  const preview=previewRecovery(storage,session,zone,ds);assert.deepEqual(preview.blockers,[]);
  const confirm=confirmRecovery(storage,session,zone,ds,"Historische Bindung anhand des konkreten Bedarfs geprüft.",c.advisorId,true);
  const result=commitRecovery(storage,session,zone,ds,confirm);
  assert.notEqual(result.item.id,c.id);assert.equal(result.item.plans[0].allocations[0].id,c.plans[0].allocations[0].id);
  assert.deepEqual(JSON.parse(storage.getItem(KEY)!).find((x:AdvisoryCase)=>x.id===c.id),c);
  assert.equal(storage.getItem(session.backupKey),raw);
  assert.equal(result.item.plans[0].allocations[0].amount,10000);
  assert.deepEqual(result.item.plans[0].investmentPlans[0],{...c.plans[0].investmentPlans[0],capitalPotId:"year-2028"});
});
test("R04 partial amount preserves strategic remainder",()=>{
  const {storage,session}=setup(h5bCase("partial",true));const p=previewRecovery(storage,session,zone,h5bDecisions(true));
  assert.deepEqual(p.blockers,[]);assert.deepEqual(p.candidate.plans[0].allocations[0].capitalPotAmounts,{"year-2028":6000,strategic:4000});
});
test("R12 semantic change detected despite valid IDs and current coverage",()=>{
  const c=h5bCase();c.plans[0].investmentPlans=[];
  c.advisory.needs.push({id:102,purpose:"bleibt",amount:5000,years:1,dueDate:"2027-12-31"},{id:103,purpose:"anderer",amount:10000,years:2,dueDate:"2028-12-31"});
  c.plans[0].allocations[0].amount=25000;c.plans[0].allocations[0].capitalPotAmounts={"year-2027":5000,"year-2028":20000};
  c.plans[0].allocations[0].bucketAmounts={year3:25000};
  assert(diagnoseCapitalRecovery(c,zone).findings.some(f=>f.category==="B"&&f.subject==="year-2027"));
  const x=setup(c),ds:RecoveryDecision[]=[
    {kind:"binding",planId:"h5a-plan",allocationId:"h5a-allocation",fromPotId:"year-2027",targets:[{potId:"year-2027",amount:5000}]},
    {kind:"binding",planId:"h5a-plan",allocationId:"h5a-allocation",fromPotId:"year-2028",targets:[{potId:"year-2028",amount:20000}]},
    {kind:"primary",planId:"h5a-plan",allocationId:"h5a-allocation",targetPotId:"year-2027"},
    {kind:"legacy",planId:"h5a-plan",allocationId:"h5a-allocation"},
  ];
  const preview=previewRecovery(x.storage,x.session,zone,ds);assert.deepEqual(preview.blockers,[]);assert.deepEqual(preview.diff,[]);
  const confirmation=confirmRecovery(x.storage,x.session,zone,ds,"Bestehende gültige Zuordnung trotz geänderter Bedarfsmitgliedschaft bewusst beibehalten.",c.advisorId,true);
  const result=commitRecovery(x.storage,x.session,zone,ds,confirmation);
  assert.deepEqual(result.item.plans,c.plans);assert.notEqual(result.item.id,c.id);
});
test("X05 earlier deadline is detected and cannot be acknowledged away",()=>{
  const c=h5bDeadline(),{storage,session}=setup(c);
  assert(diagnoseCapitalRecovery(c,zone).findings.some(f=>f.category==="C"));
  const ds=h5bDecisions();const binding=ds[0];if(binding.kind==="binding")binding.fromPotId="year-2028";
  const p=previewRecovery(storage,session,zone,ds);assert(p.blockers.some(x=>x.includes("nicht fristgerecht")));
});

const approve=(storage:Store,session:ReturnType<typeof beginRecovery>,ds=h5bDecisions())=>confirmRecovery(storage,session,zone,ds,"Einzelbedarfe, Beträge und Umsetzung ausdrücklich geprüft.","leon-moebius",true);
function finish(c=h5bCase(),ds=h5bDecisions()) { const x=setup(c);return {...x,ds,result:commitRecovery(x.storage,x.session,zone,ds,approve(x.storage,x.session,ds))}; }
test("R01 no stored binding: diagnostic change without artificial allocation",()=>{
  const c=h5bCase();c.plans[0].allocations=[];c.plans[0].investmentPlans=[];
  const x=setup(c),p=previewRecovery(x.storage,x.session,zone,[]);assert.deepEqual(p.blockers,[]);assert.equal(p.candidate.plans[0].allocations.length,0);assert(p.remainingPlanning.length);
});
test("R02 same ID different need set requires explicit decisions",()=>{
  const c=h5bCase();c.plans[0].investmentPlans=[];c.advisory.needs.push({id:102,purpose:"bleibt",amount:5000,years:1,dueDate:"2027-12-31"});
  const x=setup(c);assert(diagnoseCapitalRecovery(c,zone).findings.some(f=>f.category==="B"));
  assert(previewRecovery(x.storage,x.session,zone,[]).blockers.some(s=>s.includes("ungeklärt")));
});
test("R06 inactive variant must be decided, variants never added together",()=>{
  const c=h5bNeighbor(),old=h5bCase().plans[0];old.id="inactive";old.preferred=false;
  old.allocations[0].id="inactive-allocation";const e=old.investmentPlans[0];e.id="inactive-entry";if(e.type==="phased")e.allocationId="inactive-allocation";
  c.plans.push(old);const x=setup(c),p=previewRecovery(x.storage,x.session,zone,[]);
  assert(p.blockers.some(b=>b.includes("inactive-allocation")));assert.equal(diagnoseCapitalRecovery(c,zone).plans.length,2);
  assert.equal(p.coverage.filter(c=>c.planId==="inactive").length,3);
});
test("R07 savings plans retain need and savings-goal identities",()=>{
  const c=h5bCase();c.savingsGoals=[{id:"goal-a",name:"Ziel",targetAmount:1000}];
  for(const [id,targetRef] of [["need-savings",{kind:"need",id:101}],["goal-savings",{kind:"savingsGoal",id:"goal-a"}]] as const)c.plans[0].investmentPlans.push({id,type:"savings",productId:"savings",productName:"Sparen",contributionAmount:123.45678,frequency:"monthly",startDate:"2026-11-01",targetRef,note:"unverändert"});
  const {result}=finish(c);assert.deepEqual(result.item.plans[0].investmentPlans.slice(1),c.plans[0].investmentPlans.slice(1));assert.deepEqual(result.item.savingsGoals,c.savingsGoals);
});
test("R08 H2/P2/P3/H4 independent errors cannot be repaired by topf decisions",()=>{
  const damages:((c:AdvisoryCase)=>void)[]=[c=>{c.advisory.liquidAssets=-1;},c=>{c.plans[0].allocations[0].amount=-1;},c=>{c.plans.push(clone(c.plans[0]));},c=>{c.plans[0].depotHoldingIds=["unknown"];},c=>{const e=c.plans[0].investmentPlans[0];if(e.type==="phased")e.installments=1201;},c=>{c.advisory.needs.push(clone(c.advisory.needs[0]));},c=>{c.plans[0].investmentPlans.push({...c.plans[0].investmentPlans[0]});}];
  for(const damage of damages){const c=h5bCase();damage(c);const x=setup(c);assert(diagnoseCapitalRecovery(c,zone).findings.some(f=>f.category==="D"));assert(previewRecovery(x.storage,x.session,zone,h5bDecisions()).blockers.length);assert.equal(x.storage.getItem(KEY),x.raw);}
});
test("R09 historical snapshot as explicit source retains complete opaque history",()=>{
  const c=h5bNeighbor();c.versions=[{id:"old-version",label:"Historisch",createdAt:c.createdAt,snapshot:caseSnapshot(h5bCase())}];
  const raw=JSON.stringify([c],null,2),storage=new Store(raw),source=selectRecoverySource(raw,"local",{caseId:c.id,snapshotId:"old-version"});
  const before=JSON.stringify(c.versions);const session=beginRecovery(storage,source),ds=h5bDecisions();
  const {item}=commitRecovery(storage,session,zone,ds,approve(storage,session,ds));
  assert.equal(JSON.stringify(item.versions),before);assert.equal(item.capitalPotRecovery!.source.snapshotId,"old-version");
  assert.equal(JSON.stringify(JSON.parse(storage.getItem(KEY)!)[1].versions),before);assert.notEqual(item.id,c.id);
  assert.deepEqual(JSON.parse(storage.getItem(KEY)!).find((entry:AdvisoryCase)=>entry.id===c.id),c);
});
test("R11 Schema 10 works, Schema 0–9 remains protected including X04",()=>{
  const c=h5bCase();Reflect.set(c,"schemaVersion",10);assert.deepEqual(finish(c).result.item.schemaVersion,11);
  for(let schema=0;schema<10;schema++){const legacy=h5bCase();Reflect.set(legacy,"schemaVersion",schema);const x=setup(legacy);assert.equal(diagnoseCapitalRecovery(legacy,zone).repairable,false);assert(previewRecovery(x.storage,x.session,zone,h5bDecisions()).blockers.length);assert.equal(readCaseStore(x.raw).protectedEntries.length,1);}
});
test("X01 backup quota and failed readback block before any draft",()=>{
  for(const fail of ["write","read"]){const c=h5bCase(),raw=JSON.stringify([c]),s=new Store(raw);const set=s.setItem.bind(s),get=s.getItem.bind(s);
    if(fail==="write")s.setItem=(k,v)=>{if(k.startsWith(RECOVERY_PREFIX))throw new Error("quota");set(k,v);};
    else s.getItem=k=>k.startsWith(RECOVERY_PREFIX)?"wrong bytes":get(k);
    assert.throws(()=>beginRecovery(s,selectRecoverySource(raw,"local",{caseId:c.id})));assert.equal(s.getItem(KEY),raw);
  }
});
test("X01 main write failure leaves verified backup and original unchanged",()=>{
  const x=setup(),confirmation=approve(x.storage,x.session);const set=x.storage.setItem.bind(x.storage);
  x.storage.setItem=(k,v)=>{if(k===KEY)throw new Error("main quota");set(k,v);};
  assert.throws(()=>commitRecovery(x.storage,x.session,zone,h5bDecisions(),confirmation),/main quota/);
  assert.equal(x.storage.getItem(KEY),x.raw);assert.equal(x.storage.getItem(x.session.backupKey),x.raw);
});
test("X02 unchanged advisory still detects algorithm impact",()=>{
  const c=h5bCase(),before=canonicalJson(c),d=diagnoseCapitalRecovery(c,zone);assert(d.findings.some(f=>f.category==="A"));assert.equal(canonicalJson(c),before);
});
test("X03 graph validity does not exempt invalid entry coverage",()=>{
  const c=h5bNeighbor();c.plans[0].allocations[0].capitalPotAmounts={"year-2028":1};c.plans[0].allocations[0].bucketAmounts={year3:1};
  const x=setup(c);assert(normalizeImportedCase(c,false));assert(previewRecovery(x.storage,x.session,zone,[]).blockers.some(b=>b.includes("Einstieg")));
});
test("X06 year can move backwards; month ends and leap dates remain calendar-correct",()=>{
  const c=h5bCase();c.createdAt="2026-01-15T12:00:00Z";c.advisory.needs[0].years=.5;
  const d=diagnoseCapitalRecovery(c,zone);assert.equal(d.needs[0].historicalYear,2027);assert.equal(d.needs[0].currentYear,2026);
  for(const [date,years,expected] of [["2028-01-31",1/12,"2028-02-29"],["2027-01-31",1/12,"2027-02-28"],["2028-02-29",1,"2029-02-28"]] as const){c.createdAt=date;c.advisory.needs[0].years=years;assert.equal(diagnoseCapitalRecovery(c,zone).needs[0].currentDate,expected);}
});
test("unknown timezone, invalid dates and ambiguous need IDs never guess",()=>{
  assert.equal(diagnoseCapitalRecovery(h5bCase()).repairable,false);
  for(const date of ["not-a-date","2026-02-30","2026-01-01T12:00:00"]){const c=h5bCase();c.createdAt=date;assert.equal(diagnoseCapitalRecovery(c,zone).repairable,false);}
  const c=h5bCase();c.createdAt="2026-12-31T23:30:00Z";c.advisory.needs[0].years=0;
  assert.equal(diagnoseCapitalRecovery(c,"UTC").needs[0].historicalYear,2026);assert.equal(diagnoseCapitalRecovery(c,zone).needs[0].historicalYear,2027);
});
test("existing target amounts are added, split decisions conserve exact precision",()=>{
  const c=h5bCase();c.plans[0].investmentPlans=[];c.advisory.needs.push({id:102,purpose:"Später",amount:5000,years:2.5,dueDate:"2029-01-01"});
  const a=c.plans[0].allocations[0];a.amount=12345.123456789;a.capitalPotAmounts={"year-2027":10000.123456789,"year-2028":1000,strategic:1345};a.bucketAmounts={year3:11000.123456789,year10plus:1345};
  const ds=h5bDecisions().filter(d=>d.kind!=="investment");if(ds[0].kind==="binding")ds[0].targets=[{potId:"year-2028",amount:6000.123456789},{potId:"year-2029",amount:4000}];
  const x=finish(c,ds),result=x.result.item.plans[0].allocations[0];assert.equal(result.amount,a.amount);assert.deepEqual(result.capitalPotAmounts,{"year-2028":7000.123456789,"year-2029":4000,strategic:1345});
  assert.throws(()=>exactSum([1e30,.01]),/Präzisionsverlust/);
});
test("zero orphan keys require a decision, no primary double counting",()=>{
  const c=h5bNeighbor();c.plans[0].allocations[0].capitalPotAmounts={"year-2028":10000,"year-2027":0};
  const x=setup(c);assert(previewRecovery(x.storage,x.session,zone,[]).blockers.some(b=>b.includes("year-2027")));
  const ds:RecoveryDecision[]=[{kind:"binding",planId:"h5a-plan",allocationId:"h5a-allocation",fromPotId:"year-2027",targets:[{potId:"year-2028",amount:0}]},{kind:"primary",planId:"h5a-plan",allocationId:"h5a-allocation",targetPotId:"year-2028"},{kind:"legacy",planId:"h5a-plan",allocationId:"h5a-allocation"}];
  const p=previewRecovery(x.storage,x.session,zone,ds);assert.deepEqual(p.blockers,[]);assert.equal(p.candidate.plans[0].allocations[0].amount,10000);
});
test("review and unassigned amounts preserved, unresolved review blocks release",()=>{
  const c=h5bCase();c.plans[0].allocations[0].amount=15000;c.plans[0].allocations[0].capitalPotReviewAmount=3000;c.plans[0].allocations[0].capitalPotReviewNote="Ungeklärtes Original";
  const x=setup(c),p=previewRecovery(x.storage,x.session,zone,h5bDecisions());assert(p.blockers.some(b=>b.includes("Reviewbetrag")));assert.equal(p.candidate.plans[0].allocations[0].capitalPotReviewAmount,3000);assert.equal(p.candidate.plans[0].allocations[0].amount,15000);
});
test("unassigned amount is not automatically invested; planning acknowledgement required",()=>{
  const c=h5bCase();c.plans[0].allocations[0].amount=12000;const x=setup(c),ds=h5bDecisions();
  assert.deepEqual(previewRecovery(x.storage,x.session,zone,ds).blockers,[]);
  assert.throws(()=>confirmRecovery(x.storage,x.session,zone,ds,"Konkrete fachliche Entscheidung geprüft.",c.advisorId,false),/Planungsbedarf/);
  assert.equal(commitRecovery(x.storage,x.session,zone,ds,approve(x.storage,x.session,ds)).item.plans[0].allocations[0].amount,12000);
});
test("percent plan preserves economic staged amount, invalid splitting cannot hide loss",()=>{
  const c=h5bCase(),e=c.plans[0].investmentPlans[0];if(e.type==="phased"){e.stagedMode="percent";e.stagedValue=60;}
  assert.deepEqual(finish(c).result.item.plans[0].investmentPlans[0],{...e,capitalPotId:"year-2028"});
  c.plans[0].allocations[0].capitalPotAmounts={"year-2027":6000,strategic:4000};c.plans[0].allocations[0].bucketAmounts={year3:6000,year10plus:4000};
  const x=setup(c),ds=h5bDecisions(true);if(ds[0].kind==="binding")ds[0].targets=[{potId:"strategic",amount:6000}];
  if(ds[1].kind==="primary")ds[1].targetPotId="strategic";if(ds[3].kind==="investment")ds[3].targetPotId="strategic";
  assert(previewRecovery(x.storage,x.session,zone,ds).blockers.some(b=>b.includes("tatsächlichen Einstiegsbetrag")));
});
test("repeated phased relations cannot overcount available binding",()=>{
  const c=h5bCase();c.plans[0].investmentPlans.push({...c.plans[0].investmentPlans[0],id:"second-entry"});
  const ds=h5bDecisions();ds.push({kind:"investment",planId:"h5a-plan",investmentId:"second-entry",targetPotId:"year-2028"});
  const x=setup(c);assert(previewRecovery(x.storage,x.session,zone,ds).blockers.some(b=>b.includes("gemeinsam")));
});
test("complete non-permitted diff catches every identity and history mutation",()=>{
  const x=setup(),ds=h5bDecisions(),p=previewRecovery(x.storage,x.session,zone,ds);assert(recoveryConservation(x.c,p.candidate,ds));
  const changes:((c:AdvisoryCase)=>void)[]=[c=>{c.plans[0].allocations[0].productId="other";},c=>{c.plans[0].allocations[0].amount=1;},c=>{c.plans[0].allocations[0].id="other";},c=>{c.plans[0].notes="other";},c=>{c.plans[0].preferred=false;},c=>{c.advisory.needs[0].id=999;},c=>{c.versions.push({id:"extra",label:"x",createdAt:c.createdAt,snapshot:caseSnapshot(c)});},c=>{const e=c.plans[0].investmentPlans[0];if(e.type==="phased")e.installments=2;}];
  for(const change of changes){const c=clone(p.candidate);change(c);assert.equal(recoveryConservation(x.c,c,ds),false);}
});
test("missing confirmation, changed decisions, changed candidate claims and reason are rejected",()=>{
  const x=setup(),ds=h5bDecisions(),confirmation=approve(x.storage,x.session,ds);
  for(const bad of [undefined,{...confirmation,contentHash:"0".repeat(64)},{...confirmation,entryHash:"0".repeat(64)},{...confirmation,reason:"short"}])assert.throws(()=>commitRecovery(x.storage,x.session,zone,ds,bad!));
  const changed=clone(ds);changed.reverse();assert.throws(()=>commitRecovery(x.storage,x.session,zone,changed,confirmation));assert.equal(x.storage.getItem(KEY),x.raw);
});
test("changed source or changed backup invalidates confirmation; fresh neighbor remains",()=>{
  for(const what of ["source","backup"]){const x=setup(),confirmation=approve(x.storage,x.session);
    if(what==="source")x.storage.setItem(KEY,JSON.stringify([...JSON.parse(x.raw),{...h5bNeighbor(),id:"new-neighbor"}]));else x.storage.data.delete(x.session.backupKey);
    const before=x.storage.getItem(KEY);assert.throws(()=>commitRecovery(x.storage,x.session,zone,h5bDecisions(),confirmation));assert.equal(x.storage.getItem(KEY),before);
    if(what==="source"){const fresh=selectRecoverySource(before!,"local",{caseId:x.c.id}),session=beginRecovery(x.storage,fresh),ds=h5bDecisions();const r=commitRecovery(x.storage,session,zone,ds,approve(x.storage,session,ds));assert(r.cases.some(c=>c.id==="new-neighbor"));}
  }
});
test("malformed target, duplicate source identity and duplicate insert cannot overwrite",()=>{
  const x=setup(),confirmation=approve(x.storage,x.session);x.storage.setItem(KEY,"malformed");assert.throws(()=>commitRecovery(x.storage,x.session,zone,h5bDecisions(),confirmation));assert.equal(x.storage.getItem(KEY),"malformed");
  assert.throws(()=>selectRecoverySource(JSON.stringify([x.c,x.c]),"local",{caseId:x.c.id}));
  const collision=setup();const confirm=approve(collision.storage,collision.session);const saved=crypto.randomUUID;
  try {crypto.randomUUID=()=>"00000000-0000-0000-0000-000000000000";const candidateId="fall-h5b-00000000-0000-0000-0000-000000000000";
    // File source leaves current unrelated store free to change before P1 insert.
    const file=selectRecoverySource(JSON.stringify(x.c),"file",{caseId:x.c.id}),session=beginRecovery(collision.storage,file),ds=h5bDecisions(),approval=approve(collision.storage,session,ds);
    collision.storage.setItem(KEY,JSON.stringify([{...h5bNeighbor(),id:candidateId}]));const before=collision.storage.getItem(KEY);
    assert.throws(()=>commitRecovery(collision.storage,session,zone,ds,approval),/derselben ID/);assert.equal(collision.storage.getItem(KEY),before);
  } finally {crypto.randomUUID=saved;} void confirm;
});
test("separate imported byte source and selected entry have distinct hash definitions",()=>{
  const c=h5bCase(),bytes="\ufeff"+JSON.stringify({exportedAt:"synthetic",case:c},null,4)+"\n",storage=new Store(JSON.stringify([h5bNeighbor()]));
  const source=selectRecoverySource(bytes,"file",{caseId:c.id}),session=beginRecovery(storage,source),ds=h5bDecisions();
  assert.notEqual(source.fullHash,source.entryHash);assert.equal(storage.getItem(session.backupKey),bytes);
  const r=commitRecovery(storage,session,zone,ds,approve(storage,session,ds));assert.equal(r.item.capitalPotRecovery!.source.kind,"file");assert.equal(r.cases.length,2);
});
test("provenance survives JSON import, P1 reload and further save; hostile evidence grants no bypass",()=>{
  const {result,storage}=finish();const history=clone(result.item.versions),evidence=clone(result.item.capitalPotRecovery);
  assert(validCapitalPotRecovery(evidence));assert.equal(recoveryConfirmationStatus(result.item),"content-bound");
  const imported=normalizeImportedCase(JSON.parse(JSON.stringify({case:result.item})))!;assert(imported);assert.deepEqual(imported.capitalPotRecovery,evidence);
  insertCaseIntoStore(storage,imported);saveCaseToStore(storage,{...imported,status:"In Prüfung"});
  const reloaded=readCaseStore(storage.getItem(KEY)).cases.find(c=>c.id===imported.id)!;assert.deepEqual(reloaded.capitalPotRecovery,evidence);assert.deepEqual(reloaded.versions,history);assert.equal(recoveryConfirmationStatus(reloaded),"changed");
  for(const mutate of [(v:Record<string,unknown>)=>{v.formatVersion=2;},(v:Record<string,unknown>)=>{v.bypass=true;},(v:Record<string,unknown>)=>{v.source={};}]){const bad=clone(result.item);mutate(bad.capitalPotRecovery as unknown as Record<string,unknown>);assert.equal(normalizeImportedCase(bad,false),null);}
  const bad=clone(result.item);bad.advisory.liquidAssets=-1;assert.equal(normalizeImportedCase(bad,false),null);
});
function restore(item:AdvisoryCase,index=0) {
  let next:AdvisoryCase|undefined;const alerts:string[]=[];
  const find=(node:ReactNode):(()=>void)[]=>{if(Array.isArray(node))return node.flatMap(find);if(!isValidElement<{children?:ReactNode;onClick?:()=>void}>(node))return[];if(node.type==="button"&&renderToStaticMarkup(node).includes("Wiederherstellen"))return[node.props.onClick!];return find(node.props.children);};
  const previous=globalThis.window;Object.assign(globalThis,{window:{confirm:()=>true,alert:(s:string)=>alerts.push(s)}});
  try{const element=ExportCenter({item,preferredPlan:getPreferredStructurePlan(item.plans),setItem:a=>{next=typeof a==="function"?a(item):a;},saveCase:()=>{throw new Error("must not save");},exportJson:()=>{},importJson:()=>{}});find(element)[index]();}finally{Object.assign(globalThis,{window:previous});}
  return {next,alerts};
}
test("actual regular H3 restore retains copy provenance and invalidates changed business content",()=>{
  const c=h5bCase(),good=h5bNeighbor();good.advisory.notes="Historische andere Inhalte";
  c.versions=[{id:"historical-good",label:"Gültig",createdAt:c.createdAt,snapshot:caseSnapshot(good)}];
  const {result,storage}=finish(c),before=storage.getItem(KEY),r=restore(result.item);
  assert(r.next);assert.deepEqual(r.alerts,[]);assert.equal(r.next.id,result.item.id);assert.deepEqual(r.next.capitalPotRecovery,result.item.capitalPotRecovery);assert.deepEqual(r.next.versions,c.versions);assert.equal(recoveryConfirmationStatus(r.next),"changed");assert.equal(storage.getItem(KEY),before);
});
test("actual rejected restore keeps provenance, current content and opaque snapshots exact",()=>{
  const c=h5bCase();c.versions=[{id:"old",label:"Ungültig",createdAt:c.createdAt,snapshot:caseSnapshot(h5bCase())}];
  const {result,storage}=finish(c),before=canonicalJson(result.item),bytes=storage.getItem(KEY),r=restore(result.item);
  assert.equal(r.next,undefined);assert.equal(r.alerts.length,1);assert.equal(canonicalJson(result.item),before);assert.equal(storage.getItem(KEY),bytes);
});
test("snapshot with independent corruption and snapshot identity ambiguity remain blocked",()=>{
  const c=h5bNeighbor(),snapshot=caseSnapshot(h5bCase());snapshot.advisory.otherAssets=-1;c.versions=[{id:"bad",label:"Bad",createdAt:c.createdAt,snapshot}];
  const raw=JSON.stringify([c]),s=new Store(raw),source=selectRecoverySource(raw,"local",{caseId:c.id,snapshotId:"bad"}),session=beginRecovery(s,source);
  assert(previewRecovery(s,session,zone,h5bDecisions()).blockers.length);c.versions.push(clone(c.versions[0]));assert.throws(()=>selectRecoverySource(JSON.stringify([c]),"local",{caseId:c.id,snapshotId:"bad"}));
  assert.equal(recoverySourceEntries(JSON.stringify([c]))[0].snapshots.length,0);
});
test("contradictory legacy values, overbinding and lossy zero-map fallback block",()=>{
  for(const modify of [(c:AdvisoryCase)=>{c.plans[0].allocations[0].bucketAmounts={year1:10000};},(c:AdvisoryCase)=>{c.plans[0].allocations[0].capitalPotAmounts={"year-2027":11000};},(c:AdvisoryCase)=>{c.plans[0].allocations[0].capitalPotAmounts={"year-2027":0};}]){const c=h5bCase();modify(c);assert.equal(diagnoseCapitalRecovery(c,zone).repairable,false);}
});
test("H1-compatible exact drafts never round typed input or loosen new amount limits",()=>{
  assert.equal(parseRecoveryAmountDraft("6000,123456789",10000.123456789),6000.123456789);
  assert.equal(parseRecoveryAmountDraft("10000.0",10000),10000);
  assert.throws(()=>parseRecoveryAmountDraft("10000.000000000000000001",10000),/gerundet/);
  assert.throws(()=>parseRecoveryAmountDraft("1.000,00",10000));
  assert.throws(()=>parseRecoveryAmountDraft("100000000000000",1000),/H1/);
  assert.equal(parseRecoveryAmountDraft("1e20",1e20),1e20);
});
test("P1 unchanged-source insert guard validates fresh raw identity and never bypasses candidate checks",()=>{
  const original=h5bNeighbor(),raw=JSON.stringify([original]),storage=new Store(raw),candidate={...h5bNeighbor(),id:"new-independent"};
  const guard={id:original.id,entryHash:jsonHash(original)};
  for(const source of [{...guard,entryHash:"0".repeat(64)},{...guard,id:"missing"}]){assert.throws(()=>insertCaseIntoStore(storage,candidate,source));assert.equal(storage.getItem(KEY),raw);}
  assert.throws(()=>insertCaseIntoStore(storage,original,guard));assert.equal(storage.getItem(KEY),raw);
  const damaged=clone(candidate);damaged.advisory.liquidAssets=-1;assert.throws(()=>insertCaseIntoStore(storage,damaged,guard));assert.equal(storage.getItem(KEY),raw);
  insertCaseIntoStore(storage,candidate,guard);assert.deepEqual(JSON.parse(storage.getItem(KEY)!).find((c:AdvisoryCase)=>c.id===original.id),original);
});
console.log(`H5b recovery: ${passed} groups passed; R01–R12 and X01–X06 covered with synthetic sources.`);
