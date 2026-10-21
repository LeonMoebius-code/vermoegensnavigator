import assert from "node:assert/strict";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeImportedCase, caseSnapshot, buildIstWealthStructure, buildPlanWealthStructure, type AdvisoryCase } from "../app/case-model";
import { validCaseFinancialInputs } from "../app/domain/case/financial-validation";
import { validDepotSale, depotSaleConflicts } from "../app/domain/depot/sale-validation";
import { setCaseDepot, replaceDepotAccount } from "../app/domain/depot/lifecycle";
import { diagnoseCapitalRecovery } from "../app/domain/case/capital-recovery-diagnosis";
import { CASE_STORAGE_KEY, RECOVERY_PREFIX, readCaseStore, recoveryBackups, saveCaseToStore, insertCaseIntoStore, writeCaseStore } from "../app/case-storage";
import { ExportCenter } from "../app/page";
import { saleCase } from "./f020-fixtures";
import { controlCase } from "./f021-fixtures";

class Store {
  values = new Map<string,string>(); failBackup = false; corruptBackup = false; failMain = false;
  get length() { return this.values.size; }
  key(i:number) { return [...this.values.keys()][i] ?? null; }
  getItem(k:string) { return this.values.get(k) ?? null; }
  setItem(k:string,v:string) {
    if ((k.startsWith(RECOVERY_PREFIX) && this.failBackup) || (k===CASE_STORAGE_KEY && this.failMain)) throw new Error("synthetic quota");
    this.values.set(k,k.startsWith(RECOVERY_PREFIX) && this.corruptBackup ? "incomplete" : v);
  }
}
const ops = [saveCaseToStore, insertCaseIntoStore, (s:Store,c:AdvisoryCase)=>writeCaseStore(s,[c,controlCase("neighbor")])];
let groups=0;
function test(name:string,run:()=>void) { run(); groups++; console.log(`PASS F020 ${name}`); }
const bad = () => { const c=saleCase(); c.depot[0].value=5000; return c; };

test("shared sale guard is strict, exact and non-mutating",()=>{
  for(const [v,s,ok] of [[0,0,true],[5000,5000,true],[10000,2000,true],[1.123456,1.123456,true],[5000,8000,false],
    ...[undefined,null,false,true,"5000",NaN,Infinity,-Infinity,-1,[],{}].flatMap(v=>[[v,0,false],[5000,v,false]])] as unknown[][]) {
    assert.equal(validDepotSale(v,s),ok,`${String(v)} / ${String(s)}`);
  }
  const c=bad(), before=structuredClone(c); assert.deepEqual(depotSaleConflicts(c.depot),[c.depot[0]]); assert.deepEqual(c,before);
});
test("schema10/11 reject untouched input before graph/JSON; legacy remains separate",()=>{
  for(const schema of [10,11]) {
    const c=bad(); Reflect.set(c,"schemaVersion",schema); const before=structuredClone(c);
    assert.equal(validCaseFinancialInputs(c,schema),false); assert.equal(normalizeImportedCase(c,false),null); assert.equal(normalizeImportedCase({case:c}),null);
    assert.deepEqual(c,before); Object.defineProperty(c,"createdAt",{get(){throw new Error("graph or clone reached");}});
    assert.equal(normalizeImportedCase(c,false),null);
  }
});
test("Save/Insert/Write reject runtime invalid sales before serializing and preserve store exactly",()=>{
  for(const op of ops) for(const value of [8000,NaN,Infinity,-Infinity,null,false,"8000",undefined]) {
    const c=bad(); Reflect.set(c.depot[0],"plannedSale",value); const before=structuredClone(c),s=new Store(); insertCaseIntoStore(s,controlCase("neighbor"));
    const bytes=[...s.values]; assert.throws(()=>op(s,c)); assert.deepEqual([...s.values],bytes); assert.deepEqual(c,before);
  }
  // A JSON clone would replace nonfinite values; it must never be reached.
  for(const op of ops) { const c=bad(); Object.defineProperty(c,"createdAt",{get(){throw new Error("clone reached");}});
    const s=new Store(); assert.throws(()=>op(s,c),/Depotverkäufe/); assert.equal(s.length,0); }
});
test("failed same-case save/version preserves updatedAt, history, neighbor and active edits",()=>{
  const s=new Store(), c=saleCase(); insertCaseIntoStore(s,controlCase("neighbor")); insertCaseIntoStore(s,c);
  const original=s.getItem(CASE_STORAGE_KEY); const draft=bad(); draft.advisory.goal="Ungespeicherte Änderung";
  draft.updatedAt="2030-01-01"; draft.versions.push({id:"not-saved",label:"Not saved",createdAt:draft.updatedAt,snapshot:caseSnapshot(draft)});
  const before=structuredClone(draft); assert.throws(()=>saveCaseToStore(s,draft)); assert.equal(s.getItem(CASE_STORAGE_KEY),original); assert.deepEqual(draft,before);
});
test("P1 protects current raw originals with healthy neighbors and complete readback backup",()=>{
  for(const schema of [10,11]) {
    const c=bad(); Reflect.set(c,"schemaVersion",schema); const neighbor=controlCase("neighbor"), original=JSON.stringify([c,neighbor],null,2),s=new Store(); s.setItem(CASE_STORAGE_KEY,original);
    const read=readCaseStore(original); assert.equal(read.cases.length,1); assert.deepEqual(read.protectedEntries,[c]); assert.equal(s.getItem(CASE_STORAGE_KEY),original);
    saveCaseToStore(s,neighbor); assert.deepEqual(JSON.parse(s.getItem(CASE_STORAGE_KEY)!).find((x:AdvisoryCase)=>x.id===c.id),c);
    assert.equal(recoveryBackups(s).length,1); assert.equal(recoveryBackups(s)[0].original,original);
    assert.deepEqual(readCaseStore(recoveryBackups(s)[0].original).protectedEntries,[c]);
    saveCaseToStore(s,neighbor); assert.equal(recoveryBackups(s).length,1);
    assert.throws(()=>saveCaseToStore(s,{...saleCase(),schemaVersion:schema}));
  }
});
test("P1 quota, bad readback and main-write failure keep original bytes",()=>{
  for(const mode of ["quota","readback","main"]) {
    const s=new Store(), original=JSON.stringify([bad(),controlCase("neighbor")],null,2);s.setItem(CASE_STORAGE_KEY,original);
    s.failBackup=mode==="quota";s.corruptBackup=mode==="readback";s.failMain=mode==="main";
    assert.throws(()=>saveCaseToStore(s,controlCase("neighbor"))); assert.equal(s.getItem(CASE_STORAGE_KEY),original);
    if(mode==="main") assert.equal(recoveryBackups(s)[0].original,original);
  }
});
test("schemas0-9 retain documented cap/default/string migration without altering originals",()=>{
  for(let schema=0;schema<=9;schema++) for(const sale of [8000,"8000",undefined]) {
    const c=bad();Reflect.set(c,"schemaVersion",schema);Reflect.set(c.depot[0],"plannedSale",sale); const before=structuredClone(c);
    const n=normalizeImportedCase(c,false); assert.ok(n,`schema ${schema} sale ${sale}`);
    assert.equal(n.depot[0].plannedSale,sale===undefined?0:5000); assert.deepEqual(c,before);
  }
});
test("P4 and raw loading keep invalid historical snapshots opaque",()=>{
  const c=saleCase(); c.versions=[{id:"old-sale",label:"Unverändert",createdAt:c.createdAt,snapshot:caseSnapshot(bad())}];
  const n=normalizeImportedCase(c);assert.ok(n);assert.notEqual(n.id,c.id);assert.deepEqual(n.versions,c.versions);assert.deepEqual(n.plans,c.plans);
  const s=new Store();insertCaseIntoStore(s,n);assert.deepEqual(readCaseStore(s.getItem(CASE_STORAGE_KEY)).cases[0].versions,c.versions);
});
type Props={children?:ReactNode;onClick?:()=>void;disabled?:boolean};
function buttons(node:ReactNode):{text:string;props:Props}[] {
  if(Array.isArray(node))return node.flatMap(buttons);if(!isValidElement<Props>(node))return [];
  if(node.type==="button")return [{text:renderToStaticMarkup(node),props:node.props}];return buttons(node.props.children);
}
function view(c:AdvisoryCase,apply:(c:AdvisoryCase)=>void=()=>{}) {
  return ExportCenter({item:c,preferredPlan:c.plans[0],setItem:next=>apply(typeof next==="function"?next(c):next),saveCase:()=>{},exportJson:()=>{throw new Error("unexpected export");},importJson:()=>{}});
}
test("actual H3 restore rejects current inconsistent snapshot without activating or rewriting it",()=>{
  const c=saleCase();c.versions=[{id:"bad-snapshot",label:"F020",createdAt:c.createdAt,snapshot:caseSnapshot(bad())}];const before=structuredClone(c);
  const prior=globalThis.window;let applied=false;const alerts:string[]=[];Object.assign(globalThis,{window:{confirm:()=>true,alert:(s:string)=>alerts.push(s)}});
  try{buttons(view(c,()=>{applied=true;})).find(b=>b.text.includes("Wiederherstellen"))!.props.onClick!();}finally{Object.assign(globalThis,{window:prior});}
  assert.equal(applied,false);assert.equal(alerts.length,1);assert.deepEqual(c,before);
});
test("ExportCenter blocks all regular outputs and omits printable customer document",()=>{
  const c=bad(),markup=renderToStaticMarkup(view(c)); assert.ok(markup.includes("Verkaufskonflikt"));assert.ok(!markup.includes('class="print-document"'));
  for(const label of ["Kundenübersicht","Interne Arbeitsunterlage","Excel-Arbeitsmappe","Vollständige Sicherung"]) {
    const b=buttons(view(c)).find(b=>b.text.includes(label))!;assert.equal(b.props.disabled,true,label);b.props.onClick!();
  }
});
test("draft lifecycle retains intentional sale, CSV replacement alone caps the target depot",()=>{
  const c=saleCase(),draft=setCaseDepot(c,bad().depot);assert.equal(draft.depot[0].plannedSale,8000);assert.equal(c.depot[0].value,10000);
  const replaced=replaceDepotAccount(c,c.depotAccounts[0].id,[{...c.depot[0],value:5000}]);
  assert.equal(replaced.depot.find(h=>h.depotId===c.depotAccounts[0].id)!.plannedSale,5000);assert.deepEqual(replaced.depot[0],c.depot[1]);
});
test("conscious sale/value correction persists unchanged over load/resave and exact projections",()=>{
  for(const correction of ["sale","value"]) {
    const c=bad();if(correction==="sale")c.depot[0].plannedSale=5000;else c.depot[0].value=8000;
    assert.equal(depotSaleConflicts(c.depot).length,0);const s=new Store();saveCaseToStore(s,c);
    const n=readCaseStore(s.getItem(CASE_STORAGE_KEY)).cases[0];assert.equal(JSON.stringify(n.depot),JSON.stringify(c.depot));saveCaseToStore(s,n);
    assert.deepEqual(JSON.parse(s.getItem(CASE_STORAGE_KEY)!)[0].depot,c.depot);
    if(correction==="sale") {assert.equal(buildIstWealthStructure(c.depot,c.advisory.liquidAssets).total,211000);assert.equal(buildPlanWealthStructure(c.depot,c.plans[0]).total,206000);}
  }
});
test("H5b diagnosis cannot create a recovery copy for a current sale conflict",()=>{
  const c=bad(),before=structuredClone(c);assert.equal(diagnoseCapitalRecovery(c,"UTC").repairable,false);assert.deepEqual(c,before);
});
console.log(`F020 depot sale consistency: ${groups} groups passed.`);
