import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as fs from "node:fs";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { assetClasses, isAssetClass } from "../app/domain/assets/contracts";
import { classificationCase, invalidClassification, classifiedHolding } from "./f010-f023-fixtures";
import { normalizeImportedCase, setCaseDepot, caseSnapshot, getPreferredStructurePlan, type AdvisoryCase } from "../app/case-model";
import { depotAssetAmounts, buildIstWealthStructure, buildPlanWealthStructure, productAssetMix } from "../app/domain/wealth-structure/projection";
import { validDepotClassifications, CLASSIFICATION_ERROR } from "../app/domain/depot/classification-validation";
import { CASE_STORAGE_KEY, RECOVERY_PREFIX, readCaseStore, recoveryBackups, saveCaseToStore, insertCaseIntoStore, writeCaseStore } from "../app/case-storage";
import { SituationStep, ExportCenter, WealthHouse } from "../app/page";
import { parseDepotCsv } from "../app/depot-csv";
import { diagnoseCapitalRecovery } from "../app/domain/case/capital-recovery-diagnosis";

XLSX.set_fs(fs);
class Store {
  values = new Map<string,string>(); failBackup=false; corruptBackup=false;
  get length(){ return this.values.size; } key(i:number){ return [...this.values.keys()][i]??null; }
  getItem(k:string){ return this.values.get(k)??null; }
  setItem(k:string,v:string){ if(k.startsWith(RECOVERY_PREFIX)&&this.failBackup)throw new Error("synthetic quota"); this.values.set(k,k.startsWith(RECOVERY_PREFIX)&&this.corruptBackup?"broken":v); }
}
type NodeProps = {children?: React.ReactNode; [key:string]: any};
function nodes(n: React.ReactNode, pred:(n:React.ReactElement<NodeProps>)=>boolean):React.ReactElement<NodeProps>[] {
  if(Array.isArray(n))return n.flatMap(v=>nodes(v,pred));
  if(!React.isValidElement<NodeProps>(n))return [];
  return [...(pred(n)?[n]:[]), ...nodes(n.props.children,pred)];
}
function hooks<T>(run:()=>T):T {
  const internal=(React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, before=internal.H;
  internal.H={useRef:(v:unknown)=>({current:v}),useState:(v:any)=>[typeof v==="function"?v():v,()=>{}]};
  try{return run();}finally{internal.H=before;}
}
function situation(c:AdvisoryCase,apply:(c:AdvisoryCase)=>void){return hooks(()=>SituationStep({data:c.advisory,depot:c.depot,depotAccounts:c.depotAccounts,update:()=>{},setDepot:d=>apply(setCaseDepot(c,d)),applyDepotImport:()=>{},setView:()=>{}}));}
function view(c:AdvisoryCase, apply:(c:AdvisoryCase)=>void=()=>{}) {return ExportCenter({item:c,preferredPlan:getPreferredStructurePlan(c.plans),setItem:v=>apply(typeof v==="function"?v(c):v),saveCase:()=>{throw new Error("unexpected save");},exportJson:()=>{},importJson:()=>{}});}
function restore(c:AdvisoryCase,confirm=true){const alerts:string[]=[];let next:AdvisoryCase|undefined;const before=globalThis.window;Object.assign(globalThis,{window:{confirm:()=>confirm,alert:(s:string)=>alerts.push(s)}});try{nodes(view(c,v=>{next=v}),n=>n.type==="button"&&renderToStaticMarkup(n).includes("Wiederherstellen"))[0].props.onClick();}finally{Object.assign(globalThis,{window:before});}return {next,alerts};}
function assertSingle(c:AdvisoryCase,asset:string|undefined,amount=10000){const x=buildIstWealthStructure(c.depot,0);assert.equal(x.total,amount);assert.equal(x.unresolved,asset?0:amount);for(const name of assetClasses)assert.equal(x.amounts[name],name===asset?amount:0);assert.equal(Object.values(x.amounts).reduce((s,v)=>s+v,0)+x.unresolved,x.total);}
let groups=0;function test(name:string,run:()=>void){run();groups++;console.log(`PASS F010/F023 ${name}`);}
const invalid:unknown[]=["Krypto","","Substanzwert"," Geldwerte","geldwerte",null,undefined,0,false,[],{},["Geldwerte"]];
test("exact five keys; no coercion",()=>{assetClasses.forEach(v=>assert.equal(isAssetClass(v),true));invalid.forEach(v=>assert.equal(isAssetClass(v),false));assert.equal(isAssetClass({toString:()=>"Geldwerte"}),false);});
test("actual Situation handler: explicit choice of every class, no render decision, multiple depots and identities",()=>{
  for(const asset of assetClasses){let c=classificationCase();c.depotAccounts.push({...c.depotAccounts[0],id:"classification-depot-B",name:"Synthetisches Depot B"});c.depot.push(classifiedHolding(c,{id:"classification-holding-B",depotId:c.depotAccounts[1].id,value:6000,name:c.depot[0].name}));const before=structuredClone(c);let calls=0;
    const v=situation(c,next=>{c=next;calls++;});assert.equal(calls,0);assert.deepEqual(c,before);
    const select=nodes(v,n=>n.type==="select"&&n.props["aria-label"]==="Anlageklasse")[0];assert.equal(select.props.value,"");
    select.props.onChange({target:{value:asset}});assert.equal(calls,1);assert.equal(c.depot[0].classificationStatus,"mapped");assert.equal(c.depot[0].assetClass,asset);assert.deepEqual(c.depot[1],before.depot[1]);assert.equal(c.depot[0].id,before.depot[0].id);assert.equal(c.depot[0].wkn,before.depot[0].wkn);
    const s=new Store();saveCaseToStore(s,c);c=readCaseStore(s.getItem(CASE_STORAGE_KEY)).cases[0];assert.equal(c.depot[0].classificationStatus,"mapped");assert.equal(depotAssetAmounts(c.depot).total,16000);assert.equal(depotAssetAmounts(c.depot).unresolved,0);
  }
  const c=classificationCase();assertSingle(c,undefined);const s=new Store();saveCaseToStore(s,c);assertSingle(readCaseStore(s.getItem(CASE_STORAGE_KEY)).cases[0],undefined);
});
test("catalogue mix remains authoritative; no manual override or product-ID loss",()=>{
  for(const productId of ["ps-ausgewogen","urak-konservativ"]){const c=classificationCase();c.depot[0].productId=productId;const before=structuredClone(c);let calls=0;
    const select=nodes(situation(c,()=>{calls++;}),n=>n.type==="select"&&n.props["aria-label"]==="Anlageklasse")[0];assert.equal(select.props.disabled,true);assert.equal(select.props.value,"catalog");for(const asset of assetClasses)select.props.onChange({target:{value:asset}});assert.equal(calls,0);assert.deepEqual(c,before);
    const x=depotAssetAmounts(c.depot),mix=productAssetMix(productId)!;for(const asset of assetClasses)assert.equal(x.amounts[asset],100*mix[asset]);assert.equal(x.unresolved,0);assert.equal(x.total,10000);
  }
});
test("current 10/11 import and runtime inputs reject invalid mapped/matched/default before cloning",()=>{
  for(const schema of [10,11])for(const value of invalid)for(const status of ["mapped","matched",undefined]){const c=invalidClassification(value,schema);Reflect.set(c.depot[0],"classificationStatus",status);const before=structuredClone(c);assert.equal(validDepotClassifications(c.depot),false);assert.equal(normalizeImportedCase(c,false),null);assert.equal(normalizeImportedCase({case:c}),null);assert.deepEqual(c,before);
    Object.defineProperty(c,"createdAt",{get:()=>{throw new Error("clone/graph reached");}});assert.equal(normalizeImportedCase(c,false),null);
  }
});
test("pure defensive projection preserves every invalid runtime value, sum and input even with catalogue ID",()=>{
  for(const value of invalid)for(const productId of [undefined,"ps-ausgewogen"]){const c=invalidClassification(value);c.depot[0].productId=productId;const before=structuredClone(c);Object.freeze(c.depot[0]);Object.freeze(c.depot);assertSingle(c,undefined);assert.deepEqual(c,before);const x=buildPlanWealthStructure(c.depot,c.plans[0]);assert.equal(x.unresolved,10000);assert.equal(x.total,10000);assert.deepEqual(Object.keys(x.amounts),[...assetClasses]);const html=hooks(()=>renderToStaticMarkup(WealthHouse({plan:c.plans[0],depot:c.depot,context:"depot"})));assert.ok(html.replace(/\s/g," ").includes("10.000 € noch ungeklärt"));assert.ok(!html.includes("vollständig durchgeschaut"));}
});
test("Save/Insert/Write reject without any storage write; P1 protected raw originals and exact backup reuse",()=>{
  for(const value of invalid)for(const op of [saveCaseToStore,insertCaseIntoStore,(s:Store,c:AdvisoryCase)=>writeCaseStore(s,[c])]){const c=invalidClassification(value),s=new Store();insertCaseIntoStore(s,classificationCase("neighbor"));s.setItem(RECOVERY_PREFIX+"existing","safe original backup");const bytes=[...s.values];assert.throws(()=>op(s,c),{message:CLASSIFICATION_ERROR});assert.deepEqual([...s.values],bytes);}
  const bad=invalidClassification(),neighbor=classificationCase("neighbor"),original=JSON.stringify([bad,neighbor],null,2),s=new Store();s.setItem(CASE_STORAGE_KEY,original);
  const loaded=readCaseStore(original);assert.deepEqual(loaded.protectedEntries,[bad]);assert.equal(loaded.cases.length,1);assert.equal(s.getItem(CASE_STORAGE_KEY),original);
  for(const mode of ["quota","readback"]){const blocked=new Store();blocked.setItem(CASE_STORAGE_KEY,original);blocked.failBackup=mode==="quota";blocked.corruptBackup=mode==="readback";assert.throws(()=>saveCaseToStore(blocked,neighbor));assert.equal(blocked.getItem(CASE_STORAGE_KEY),original);}
  saveCaseToStore(s,neighbor);assert.equal(recoveryBackups(s)[0].original,original);saveCaseToStore(s,{...neighbor,status:"In Prüfung"});assert.equal(recoveryBackups(s).length,1);assert.deepEqual(readCaseStore(s.getItem(CASE_STORAGE_KEY)).protectedEntries,[bad]);
});
test("opaque history; actual H3 reject/cancel/restore; import and stored reload preserve classified IDs and original snapshots",()=>{
  for(const value of invalid){const c=classificationCase();c.versions=[{id:"classification-version",label:"Klassifikationssnapshot",createdAt:c.createdAt,snapshot:caseSnapshot(invalidClassification(value))}];const before=structuredClone(c),s=new Store();insertCaseIntoStore(s,c);const bytes=[...s.values];assert.ok(normalizeImportedCase(c,false));assert.equal(restore(c).next,undefined);assert.deepEqual(restore(c).alerts,[CLASSIFICATION_ERROR]);assert.equal(restore(c,false).next,undefined);assert.deepEqual(c,before);assert.deepEqual([...s.values],bytes);assert.equal(diagnoseCapitalRecovery(c.versions[0].snapshot,"UTC").repairable,false);}
  const c=classificationCase();c.depot[0]=classifiedHolding(c);const snapshot=caseSnapshot(c);snapshot.id="old-snapshot-id";c.versions=[{id:"good-classification",label:"Geklärt",createdAt:c.createdAt,snapshot}];c.depot[0].classificationStatus="unresolved";const restored=restore(c).next!;assert.equal(restored.id,c.id);assert.deepEqual(restored.versions,c.versions);assertSingle(restored,"Substanzwerte");const imported=normalizeImportedCase({case:restored})!;assert.notEqual(imported.id,c.id);assert.deepEqual(imported.depot,restored.depot);const s=new Store();insertCaseIntoStore(s,imported);assertSingle(readCaseStore(s.getItem(CASE_STORAGE_KEY)).cases[0],"Substanzwerte");
});
test("documented valid legacy migration and CSV semantics stay unchanged; no hidden historical class repair",()=>{
  for(let schema=0;schema<10;schema++){const c=classificationCase();Reflect.set(c,"schemaVersion",schema);c.depot[0]=classifiedHolding(c);c.depotAccounts=[];Reflect.deleteProperty(c.depot[0],"depotId");const before=structuredClone(c),n=normalizeImportedCase(c,false)!;assert.ok(n);assertSingle(n,"Substanzwerte");assert.equal(n.depot[0].depotId,n.depotAccounts[0].id);assert.deepEqual(c,before);}
  for(const value of ["Krypto",""]){const c=invalidClassification(value,9),before=structuredClone(c),n=normalizeImportedCase(c,false)!;assert.ok(n);assert.equal(n.depot[0].assetClass,value);assertSingle(n,undefined);assert.deepEqual(c,before);const s=new Store();assert.throws(()=>saveCaseToStore(s,n));assert.equal(s.length,0);}
  for(const value of [...assetClasses,"Krypto",""]){const row=parseDepotCsv(new TextEncoder().encode(`Name;Wert;Anlageklasse\nSynthetisch;10000;${value}`).buffer).rows[0];assert.equal(row.classificationStatus,isAssetClass(value)?"mapped":"unresolved");assert.equal(row.assetClass,isAssetClass(value)?value:"Geldwerte");}
});
test("real XLSX and render projections; all five keys, unknown denominator, distinct plans and no preferred fallback",()=>{
  const c=classificationCase();c.depot[0]=classifiedHolding(c);c.depot.push({...c.depot[0],id:"unknown",classificationStatus:"unresolved",value:6000});c.plans[0].depotHoldingIds.push("unknown");
  const dir=mkdtempSync(join(tmpdir(),"classification-xlsx-")),cwd=process.cwd();try{process.chdir(dir);
    const button=nodes(view(c),n=>n.type==="button"&&renderToStaticMarkup(n).includes("Excel-Arbeitsmappe"))[0];button.props.onClick();const wb=XLSX.read(readFileSync(c.advisory.caseName.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g,"-")+".xlsx"),{type:"buffer"});const rows=XLSX.utils.sheet_to_json<{Anlageklasse:string;Betrag:number;Anteil:number}>(wb.Sheets.Vermögensstruktur);assert.equal(rows.length,6);assert.equal(rows.find(r=>r.Anlageklasse==="Substanzwerte")!.Betrag,10000);assert.equal(rows.find(r=>r.Anlageklasse==="Nicht durchgeschaut")!.Betrag,6000);assert.equal(rows.find(r=>r.Anlageklasse==="Substanzwerte")!.Anteil,10000/16000);assert.equal(rows.reduce((s,r)=>s+r.Betrag,0),16000);
    const html=renderToStaticMarkup(view(c));assert.ok(html.replace(/\s/g," ").includes("10.000 €"));assert.ok(html.replace(/\s/g," ").includes("6.000 €"));
  }finally{process.chdir(cwd);rmSync(dir,{recursive:true,force:true});}
  const ist=buildIstWealthStructure(c.depot,0);for(const depotMode of ["none","compare","retain","afterSales"] as const){c.plans[0].depotMode=depotMode;assert.deepEqual(buildIstWealthStructure(c.depot,0),ist);const p=buildPlanWealthStructure(c.depot,c.plans[0]);assert.equal(p.total,depotMode==="none"||depotMode==="compare"?0:16000);}
  c.plans[0].preferred=false;const v=view(c);assert.ok(nodes(v,n=>n.type==="button"&&renderToStaticMarkup(n).includes("Excel-Arbeitsmappe"))[0].props.disabled);assert.ok(!renderToStaticMarkup(v).includes('class="print-document"'));
});
console.log(`F010/F023 classification integrity: ${groups} groups passed.`);
