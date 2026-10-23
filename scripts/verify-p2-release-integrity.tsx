import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as XLSX from "xlsx";
import * as fs from "node:fs";
XLSX.set_fs(fs);
import { p2ReleaseCase } from "./p2-release-fixtures";
import { parseDepotCsv } from "../app/depot-csv";
import { assertCsvReplacementReferences } from "../app/domain/depot/csv-replacement";
import { addDepotAccount, replaceDepotAccount } from "../app/domain/depot/lifecycle";
import { allocationCapitalPotAmounts, allocationBucketAmounts, allocationAmountInCapitalPot, reconcilePlanCapitalPots } from "../app/domain/planning/allocations";
import { planningShortfall } from "../app/domain/planning/capital-pots";
import { normalizeImportedCase, caseSnapshot, type AdvisoryCase } from "../app/case-model";
import { legacyCapitalProtection } from "../app/domain/case/legacy-capital-protection";
import { readCaseStore, insertCaseIntoStore, saveCaseToStore, CASE_STORAGE_KEY as KEY } from "../app/case-storage";
import { ExportCenter } from "../app/page";
let groups = 0;
function test(name: string, run: () => void) { run(); console.log(`PASS P2 release ${++groups}: ${name}`); }
const bytes = (s: string) => new TextEncoder().encode(s).buffer;
const csv = (name = "Müller AG") => `Name;Wert;Anlageklasse\n${name};10000;Substanzwerte`;
function depotCase() {
  const c = p2ReleaseCase(); Object.assign(c, addDepotAccount(c, parseDepotCsv(bytes(csv())).rows));
  c.depot[0].plannedSale = 5000; c.plans[0].depotMode = "retain"; c.plans[0].depotHoldingIds = [c.depot[0].id];
  return c;
}
class Store {
  data = new Map<string,string>(); get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; } setItem(k: string,v: string) { this.data.set(k,v); }
}
test("supported UTF-8/BOM and Windows-1252 names and special characters", () => {
  for (const name of ["Müller AG", "Énergie & Straße", "漢字 Fonds"]) {
    assert.equal(parseDepotCsv(bytes(csv(name))).rows[0].name, name);
    assert.equal(parseDepotCsv(bytes("\uFEFF" + csv(name))).rows[0].name, name);
  }
  for (const name of ["Müller AG", "Énergie & Straße"]) {
    const raw = Uint8Array.from(Buffer.from(csv(name), "latin1"));
    assert.equal(parseDepotCsv(raw.buffer).rows[0].name, name);
  }
});
test("invalid declared UTF-8, replacement characters, control bytes and UTF-16 reject", () => {
  const malformed = new Uint8Array([0xef,0xbb,0xbf,...new TextEncoder().encode(csv()),0xc3]);
  for (const b of [malformed.buffer, bytes(csv("M\uFFFDller")), bytes(csv("Bad\u0000Name")), new Uint8Array([0xff,0xfe,78,0]).buffer])
    assert.throws(() => parseDepotCsv(b));
});
test("replacement with correctly decoded Windows-1252 preserves sales and selections", () => {
  const c = depotCase(), before = structuredClone(c), rows = parseDepotCsv(Uint8Array.from(Buffer.from(csv(), "latin1")).buffer).rows;
  assertCsvReplacementReferences(c,c.depotAccounts[0].id,rows);
  const next = replaceDepotAccount(c,c.depotAccounts[0].id,rows);
  assert.equal(next.depot[0].plannedSale,5000); assert.deepEqual(next.plans[0].depotHoldingIds,[next.depot[0].id]);
  assert.deepEqual(c,before);
});
test("ambiguous, missing and mojibake replacements reject before state/store mutation", () => {
  const c=depotCase(), s=new Store(); insertCaseIntoStore(s,c); const before=JSON.stringify(c), raw=s.getItem(KEY);
  for (const text of [csv("MÃ¼ller AG"),csv("Müller AG")+"\nMüller AG;5000;Substanzwerte",csv("Anderes Produkt")]) {
    const rows=parseDepotCsv(bytes(text)).rows;
    assert.throws(()=>assertCsvReplacementReferences(c,c.depotAccounts[0].id,rows),/nicht eindeutig/);
    assert.equal(JSON.stringify(c),before);assert.equal(s.getItem(KEY),raw);
  }
});
test("safe identity beats name; other depots and valid removals without references stay independent",()=>{
  const c=depotCase();c.depot[0].wkn="SAFE01";const rows=[{...c.depot[0],id:"new-id",name:"Geänderter Name"}];
  assert.doesNotThrow(()=>assertCsvReplacementReferences(c,c.depotAccounts[0].id,rows));
  assert.doesNotThrow(()=>assertCsvReplacementReferences(c,"other-depot",[]));
  c.depot[0].plannedSale=0;c.plans[0].depotHoldingIds=[];
  assert.doesNotThrow(()=>assertCsvReplacementReferences(c,c.depotAccounts[0].id,[]));
});
test("plan shortfall uses plan volume and retains the existing boundary",()=>{
  const c=p2ReleaseCase();for(const [volume,liquid,expected] of [[40000,100000,10000],[50000,100000,0],[60000,30000,0],[40000,30000,10000],[0,100000,50000]]){
    c.advisory.liquidAssets=liquid;assert.equal(planningShortfall(c.advisory,volume),expected);
  }
});
test("explicit zero maps differ from absent/empty maps, positive values unchanged",()=>{
  const a={id:"a",productId:"unifavorit-renten",productName:"SYNTHETISCH",amount:100,bucketId:"year10plus" as const,source:"product" as const,solutionId:"funds",capitalPotId:"strategic" as const};
  assert.equal(allocationAmountInCapitalPot({...a,capitalPotAmounts:{strategic:0}},"strategic"),0);
  assert.deepEqual(allocationCapitalPotAmounts(a),{strategic:100});assert.deepEqual(allocationCapitalPotAmounts({...a,capitalPotAmounts:{}}),{strategic:100});
  assert.deepEqual(allocationBucketAmounts({...a,bucketAmounts:{year10plus:0}}),{year10plus:0});
  assert.equal(allocationAmountInCapitalPot({...a,capitalPotAmounts:{strategic:75}},"strategic"),75);
});
function zeroCase(){const c=p2ReleaseCase();c.plans[0].total=100000;c.plans[0].allocations=[{id:"p2-zero",productId:"unifavorit-renten",productName:"SYNTHETISCH Null",amount:100,bucketId:"year10plus",source:"product",solutionId:"funds",capitalPotId:"strategic",capitalPotAmounts:{strategic:0},bucketAmounts:{year10plus:0}}];return c;}
test("zero survives reconciliation, normalization, save/load and opaque history without altering neighbors",()=>{
  const c=zeroCase(), before=structuredClone(c);c.versions=[{id:"zero-history",label:"SYNTHETISCH",createdAt:c.createdAt,snapshot:caseSnapshot(before)}];
  const plan=reconcilePlanCapitalPots(c.advisory,c.plans[0],c.createdAt,c.savingsGoals);
  assert.deepEqual(plan.allocations[0].capitalPotAmounts,{strategic:0});assert.equal(plan.allocations[0].amount,100);
  assert.equal(allocationAmountInCapitalPot(plan.allocations[0],"strategic"),0);
  const n=normalizeImportedCase(c,false)!;assert.ok(n);assert.deepEqual(n.plans[0].allocations,c.plans[0].allocations);
  const neighbor=p2ReleaseCase("neighbor"),s=new Store();insertCaseIntoStore(s,neighbor);const originalNeighbor=readCaseStore(s.getItem(KEY)).cases[0];insertCaseIntoStore(s,n);saveCaseToStore(s,n);
  const loaded=readCaseStore(s.getItem(KEY)).cases;
  assert.deepEqual(loaded.find(x=>x.id===neighbor.id)!.plans,originalNeighbor.plans);
  assert.deepEqual(loaded.find(x=>x.id===c.id)!.plans[0].allocations,c.plans[0].allocations);
  assert.deepEqual(normalizeImportedCase(c.versions[0].snapshot,false)!.plans[0].allocations,c.plans[0].allocations);
});
test("historical ambiguous zero maps remain protected, never silently migrated",()=>{
  const c=zeroCase(),before=structuredClone(c);Reflect.set(c,"schemaVersion",9);
  assert.equal(legacyCapitalProtection(c),"ambiguous-legacy");assert.equal(normalizeImportedCase(c,false),null);
  assert.deepEqual(c.plans,before.plans);
});
type Props={children?:ReactNode;onClick?:()=>void;disabled?:boolean};
function button(node:ReactNode,label:string):Props|undefined {
  if(Array.isArray(node))return node.map(n=>button(n,label)).find(Boolean);
  if(!isValidElement<Props>(node))return;
  if(node.type==="button"&&renderToStaticMarkup(node).includes(label))return node.props;
  return button(node.props.children,label);
}
test("actual H3 restore keeps explicit zero and original opaque snapshot",()=>{
  const c=zeroCase(),snapshot=caseSnapshot(c);c.versions=[{id:"restore-zero",label:"SYNTHETISCH",createdAt:c.createdAt,snapshot}];
  c.plans[0].allocations[0].amount=200;const original=structuredClone(c),prior=globalThis.window;let restored:AdvisoryCase|undefined;
  Object.assign(globalThis,{window:{confirm:()=>true}});
  try{const tree=ExportCenter({item:c,preferredPlan:c.plans[0],setItem:next=>{restored=typeof next==="function"?next(c):next;},saveCase:()=>{},exportJson:()=>{},importJson:()=>{}});
    button(tree,"Wiederherstellen")!.onClick!();assert.ok(restored);assert.equal(restored.plans[0].allocations[0].amount,100);
    assert.deepEqual(restored.plans[0].allocations[0].capitalPotAmounts,{strategic:0});assert.deepEqual(restored.versions,c.versions);assert.deepEqual(c,original);
  }finally{Object.assign(globalThis,{window:prior});}
});
test("actual XLSX and print retain zero coverage and mark missing-start savings drafts",()=>{
  const c=zeroCase();c.advisory.caseName="SYNTHETISCH-P2-export";
  c.plans[0].investmentPlans=[{id:"draft",type:"savings",productId:"unifavorit-renten",productName:"SYNTHETISCH",contributionAmount:500,frequency:"monthly",startDate:"",note:""}];
  const before=structuredClone(c),dir=mkdtempSync(join(tmpdir(),"p2-export-")),cwd=process.cwd();
  try{process.chdir(dir);const tree=ExportCenter({item:c,preferredPlan:c.plans[0],setItem:()=>{},saveCase:()=>{},exportJson:()=>{},importJson:()=>{}});
    const html=renderToStaticMarkup(tree);assert.ok(html.includes("Unvollständiger Entwurf – Startdatum fehlt"));
    button(tree,"Excel-Arbeitsmappe")!.onClick!();
    const wb=XLSX.read(readFileSync("SYNTHETISCH-P2-export.xlsx"));const savings=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets["Investitionspläne"]);
    assert.equal(savings[0].Start,"");assert.match(String(savings[0].Planungsstatus),/Entwurf/);
    const pots=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets["Kapitaltöpfe"]);
    assert.ok(pots.every(p=>p.Zugeordnet===0));assert.deepEqual(c,before);
  }finally{process.chdir(cwd);rmSync(dir,{recursive:true,force:true});}
});
console.log(`P2 release-integrity: ${groups} groups passed; no schema/version change.`);
