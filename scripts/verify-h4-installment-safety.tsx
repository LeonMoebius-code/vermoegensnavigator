import assert from "node:assert/strict";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { h4Case } from "./h4-fixtures";
import { MAX_PHASED_INSTALLMENTS, validPhasedInstallments } from "../app/domain/planning/installment-validation";
import { validCaseFinancialInputs } from "../app/domain/case/financial-validation";
import { validCurrentPlanGraph } from "../app/domain/planning/plan-identity";
import { phasedEntryAmounts, phasedEntryLastDate, phasedEntryScheduleValidation, defaultPhasedEntryInstallments,
  parsePhasedEntryNumericDraft, capitalPots, normalizeImportedCase, duplicateStructurePlan, appendStructurePlan,
  reconcilePlanCapitalPots, caseSnapshot, getPreferredStructurePlan, type AdvisoryCase, type PhasedEntryPlan } from "../app/case-model";
import { CASE_STORAGE_KEY, RECOVERY_PREFIX, readCaseStore, recoveryBackups, saveCaseToStore,
  insertCaseIntoStore, writeCaseStore } from "../app/case-storage";
import { ExportCenter } from "../app/page";

class Store {
  values = new Map<string, string>(); failBackup = false; corruptBackup = false; failMain = false;
  get length() { return this.values.size; }
  key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string, v: string) {
    if ((this.failBackup && k.startsWith(RECOVERY_PREFIX)) || (this.failMain && k === CASE_STORAGE_KEY)) throw new Error("synthetic quota");
    this.values.set(k, this.corruptBackup && k.startsWith(RECOVERY_PREFIX) ? "incomplete" : v);
  }
}
const bad: unknown[] = [0, -1, 1.5, 1201, 4294967296, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1,
  1e100, "12", null, undefined, NaN, Infinity, -Infinity, true, false, [], [12], {}];
const good = [1, 2, 6, 12, 120, 240, MAX_PHASED_INSTALLMENTS];
const entry = (c: AdvisoryCase, index = 0) => c.plans[0].investmentPlans[index] as PhasedEntryPlan;
const setCount = (c: AdvisoryCase, value: unknown) => { Reflect.set(entry(c), "installments", value); };
let groups = 0, currentRejections = 0, legacyRejections = 0;
function test(name: string, run: () => void) { run(); groups++; console.log(`PASS H4 ${name}`); }
function roundTrip(c: AdvisoryCase) {
  const n = normalizeImportedCase(JSON.parse(JSON.stringify({ case: c }))); assert.ok(n);
  const s = new Store(); insertCaseIntoStore(s, n); const r = readCaseStore(s.getItem(CASE_STORAGE_KEY));
  assert.equal(r.recoveryNeeded, false); assert.equal(r.cases.length, 1); return r.cases[0];
}

test("central unknown runtime matrix accepts only safe numeric integers 1..1200", () => {
  assert.equal(MAX_PHASED_INSTALLMENTS, 1200);
  for (const v of good) assert.equal(validPhasedInstallments(v), true);
  for (const v of bad) assert.equal(validPhasedInstallments(v), false, String(v));
});
test("direct productive amounts/date/schedule calls are bounded and explicitly invalid", () => {
  const c = h4Case(), p = c.plans[0], pot = capitalPots(c.advisory, p.total, c.createdAt).find(p => p.id === "strategic")!;
  for (const v of bad) {
    setCount(c, v); const before = structuredClone(c);
    const result = phasedEntryAmounts(p, entry(c));
    assert.deepEqual(result, { targetAmount: 0, stagedAmount: 0, immediateAmount: 0, installmentAmounts: [],
      installmentAmount: 0, lastInstallmentAmount: 0, invalid: true, hasRoundingAdjustment: false });
    assert.equal(phasedEntryLastDate(entry(c)), null);
    assert.equal(phasedEntryScheduleValidation(entry(c), pot, c.createdAt).valid, false);
    assert.deepEqual(c, before);
  }
});
test("1200 exact rates and last-cent distribution; unchanged percent/euro/immediate semantics", () => {
  const c = h4Case(), p = c.plans[0], e = entry(c);
  e.installments = MAX_PHASED_INSTALLMENTS;
  const a = phasedEntryAmounts(p, e); assert.equal(a.invalid, false); assert.equal(a.installmentAmounts.length, 1200);
  assert.ok(a.installmentAmounts.slice(0, -1).every(v => v === 0.08)); assert.equal(a.lastInstallmentAmount, 4.08);
  assert.equal(a.installmentAmounts.reduce((sum, v) => sum + Math.round(v * 100), 0), 10000);
  e.installments = 3; assert.deepEqual(phasedEntryAmounts(p, e).installmentAmounts, [33.33, 33.33, 33.34]);
  Object.assign(p.allocations[0], { amount: 100000, capitalPotAmounts: { strategic: 100000 } });
  Object.assign(e, { installments: 6, stagedMode: "percent", stagedValue: 60 });
  const percent = phasedEntryAmounts(p, e); assert.equal(percent.stagedAmount, 60000); assert.equal(percent.immediateAmount, 40000);
  assert.deepEqual(percent.installmentAmounts, Array(6).fill(10000));
  Object.assign(e, { stagedMode: "amount", stagedValue: 60000 }); assert.deepEqual(phasedEntryAmounts(p, e), percent);
  for (const mode of ["percent", "amount"] as const) {
    Object.assign(e, { stagedMode: mode, stagedValue: 0 }); const zero = phasedEntryAmounts(p, e);
    assert.equal(zero.invalid, true); assert.equal(zero.immediateAmount, 100000); assert.equal(zero.stagedAmount, 0);
    assert.ok(normalizeImportedCase(c, false), "existing zero draft survives import");
  }
  Object.assign(e, { stagedMode: "percent", stagedValue: 100 }); assert.equal(phasedEntryAmounts(p, e).immediateAmount, 0);
});
test("dates, rhythms, leap/month end and deadline-constrained normal proposal unchanged", () => {
  const c = h4Case(), e = entry(c), pots = capitalPots(c.advisory, c.plans[0].total, c.createdAt);
  const strategic = pots.find(p => p.id === "strategic")!, year = pots.find(p => p.id === "year-2030")!;
  for (const [frequency, count, date] of [["monthly",2,"2026-02-28"],["quarterly",2,"2026-04-30"],
    ["semiannual",2,"2026-07-31"],["annual",2,"2027-01-31"]] as const) {
    assert.equal(phasedEntryLastDate({ ...e, frequency, installments: count }), date);
  }
  assert.equal(phasedEntryLastDate({ ...e, startDate: "2028-01-31", installments: 2 }), "2028-02-29");
  assert.equal(phasedEntryScheduleValidation({ ...e, installments: 49 }, year, c.createdAt).valid, true);
  assert.equal(phasedEntryScheduleValidation({ ...e, installments: 50 }, year, c.createdAt).valid, false);
  assert.equal(defaultPhasedEntryInstallments(strategic, e.startDate, c.createdAt), 12);
  assert.equal(defaultPhasedEntryInstallments(year, "2029-09-30", c.createdAt), 5);
  for (const preferred of bad) assert.equal(defaultPhasedEntryInstallments(strategic, e.startDate, c.createdAt, preferred as number), 12);
  assert.equal(defaultPhasedEntryInstallments(strategic, e.startDate, c.createdAt, 1200), 1200);
  const n = roundTrip(c); assert.equal(n.plans[0].investmentPlans.length, 2);
  assert.equal(phasedEntryAmounts(n.plans[0], entry(n, 1)).installmentAmount, 1000);
});
test("strict installment text drafts never strip separators, signs or scientific notation", () => {
  for (const v of good) assert.deepEqual(parsePhasedEntryNumericDraft(String(v), "installments"), { status: "valid", value: v });
  for (const raw of ["0","-1","1.5","1,5","1.200","1,200","1 200","1e3","+12","12x","1201","4294967296","9007199254740991"])
    assert.equal(parsePhasedEntryNumericDraft(raw,"installments").status,"invalid", raw);
  assert.equal(parsePhasedEntryNumericDraft("", "installments").status, "empty");
  assert.deepEqual(parsePhasedEntryNumericDraft(" 12 ","installments"),{status:"valid",value:12});
  assert.deepEqual(parsePhasedEntryNumericDraft("60,5","percent"),{status:"valid",value:60.5});
  assert.deepEqual(parsePhasedEntryNumericDraft("60.000","amount"),{status:"valid",value:60000});
});
test("schemas 10/11 reject untouched inputs before clone, graph or normalization; no partial import", () => {
  for (const schema of [10,11]) {
    for (const v of good) { const c = h4Case(); Reflect.set(c,"schemaVersion",schema); setCount(c,v); assert.equal(entry(roundTrip(c)).installments,v); }
    for (const v of bad) {
      const c = h4Case(); Reflect.set(c,"schemaVersion",schema); setCount(c,v); const before = structuredClone(c);
      assert.equal(validCaseFinancialInputs(c,schema),false); assert.equal(validCurrentPlanGraph(c),false);
      assert.equal(normalizeImportedCase(c),null); assert.equal(normalizeImportedCase({case:c},false),null);
      assert.deepEqual(c,before); currentRejections++;
      const s = new Store(); writeCaseStore(s,[h4Case("healthy")]); const bytes = [...s.values];
      const parsed = normalizeImportedCase(JSON.parse(JSON.stringify({case:c})));
      assert.equal(parsed,null); if (parsed) insertCaseIntoStore(s,parsed);
      assert.deepEqual([...s.values],bytes);
    }
  }
});
test("Save/Insert/Write reject direct mutation without touching principal or existing backups", () => {
  for (const v of bad) {
    const s = new Store(); writeCaseStore(s,[h4Case("healthy")]); s.setItem(RECOVERY_PREFIX + "existing", "synthetic original backup");
    const bytes = [...s.values], c = h4Case("invalid"); setCount(c,v); const before = structuredClone(c);
    for (const action of [()=>saveCaseToStore(s,c),()=>insertCaseIntoStore(s,c),()=>writeCaseStore(s,[h4Case("healthy"),c])]) {
      assert.throws(action); assert.deepEqual([...s.values],bytes); assert.deepEqual(c,before);
    }
  }
});
function legacy(schema: number) {
  const c = h4Case(); Reflect.set(c,"schemaVersion",schema);
  if (schema < 8) c.plans[0].investmentPlans.forEach((e,i) => {
    Object.assign(e,{productId:c.plans[0].allocations[i].productId, installmentAmount:i ? 1000 : 10});
    Reflect.deleteProperty(e,"allocationId"); Reflect.deleteProperty(e,"stagedMode"); Reflect.deleteProperty(e,"stagedValue");
  });
  return c;
}
test("schemas 0..9 preserve valid counts, numeric string conversion and missing-field default 1", () => {
  for (let schema=0;schema<=9;schema++) for (const v of [1,6,1200,"6",undefined]) {
    const c=legacy(schema); if(v===undefined)Reflect.deleteProperty(entry(c),"installments");else setCount(c,v);
    const before=structuredClone(c), n=normalizeImportedCase(c,false); assert.ok(n,`${schema}/${v}`);
    assert.equal(entry(n).installments,v===undefined?1:Number(v)); assert.deepEqual(c,before);
    assert.equal(entry(n).allocationId,c.plans[0].allocations[0].id);
    if(schema<8)assert.equal(entry(n).stagedValue,10*entry(n).installments);
  }
});
test("explicit corrupt historical phased fields are rejected rather than repaired or discarded", () => {
  for(let schema=0;schema<=9;schema++) for(const v of bad.filter(v=>v!==undefined && v!=="12")) {
    const c=legacy(schema);setCount(c,v);const before=structuredClone(c);
    assert.equal(normalizeImportedCase(c,false),null,`${schema}/${String(v)}`);assert.deepEqual(c,before);legacyRejections++;
  }
});
test("legacy savings installments 10000000 remains irrelevant; P4 copies preserve inner identities", () => {
  for(let schema=0;schema<=9;schema++) {
    const c=legacy(schema); c.plans[0].investmentPlans.push({id:"h4-legacy-saving",type:"savings",productId:"synthetic",
      productName:"Synthetic",contributionAmount:500,frequency:"monthly",startDate:"2026-01-31",note:""});
    Object.assign(c.plans[0].investmentPlans[2],{installmentAmount:500,installments:10000000});
    const n=normalizeImportedCase(c,false);assert.ok(n);assert.equal(Reflect.get(n.plans[0].investmentPlans[2],"contributionAmount"),500);
    assert.equal("installments" in n.plans[0].investmentPlans[2],false);
  }
  const c=h4Case(), imported=roundTrip(c);assert.notEqual(imported.id,c.id);assert.deepEqual(imported.plans,c.plans);
  const copied=duplicateStructurePlan(c.plans[0]);const appended=appendStructurePlan(c,copied);
  assert.equal(appended.plans.length,2);assert.equal(validCurrentPlanGraph(appended),true);
  copied.investmentPlans.forEach(e=>{if(e.type==="phased")assert.ok(copied.allocations.some(a=>a.id===e.allocationId));});
  setCount(c,4294967296);const corruptCopy=duplicateStructurePlan(c.plans[0]);
  const healthy=h4Case();assert.equal(appendStructurePlan(healthy,corruptCopy),healthy);
  assert.equal(normalizeImportedCase({...healthy,plans:[...healthy.plans,corruptCopy]},false),null);
  const reconciled=reconcilePlanCapitalPots(c.advisory,c.plans[0],c.createdAt,c.savingsGoals);
  assert.equal(reconciled.investmentPlans.some(e=>e.id===entry(c).id),false);
});
type Props = { children?: ReactNode; onClick?: () => void };
function restoreButtons(node: ReactNode): (()=>void)[] {
  if(Array.isArray(node))return node.flatMap(restoreButtons);
  if(!isValidElement<Props>(node))return [];
  if(node.type==="button" && renderToStaticMarkup(node).includes("Wiederherstellen"))return [node.props.onClick!];
  return restoreButtons(node.props.children);
}
test("opaque bad history loads/renders; actual productive Restore rejects without state/store change", () => {
  const c=h4Case(), good=caseSnapshot(c), damaged=structuredClone(good);
  Reflect.set(damaged.plans[0].investmentPlans[0],"installments",4294967296);
  c.versions=[{id:"h4-bad-version",label:"H4 beschädigte Raten",createdAt:c.createdAt,snapshot:damaged},
    {id:"h4-good-version",label:"H4 gesunder Stand",createdAt:c.createdAt,snapshot:good}];
  const n=roundTrip(c);assert.deepEqual(n.versions,c.versions);
  const s=new Store();writeCaseStore(s,[n,h4Case("neighbor")]);const bytes=[...s.values], before=structuredClone(n);
  let applied: AdvisoryCase|undefined;const alerts:string[]=[];const previous=globalThis.window;
  Object.assign(globalThis,{window:{confirm:()=>true,alert:(message:string)=>alerts.push(message)}});
  try {
    const view=ExportCenter({item:n,preferredPlan:getPreferredStructurePlan(n.plans),setItem:next=>{applied=typeof next==="function"?next(n):next;},
      saveCase:()=>{throw new Error("Restore must not save");},exportJson:()=>{},importJson:()=>{}});
    assert.ok(renderToStaticMarkup(view).includes("H4 beschädigte Raten"));
    restoreButtons(view)[1]();assert.equal(applied,undefined);assert.equal(alerts.length,1);assert.match(alerts[0],/aktuelle Arbeitsstand bleibt unverändert/);
    assert.deepEqual(n,before);assert.deepEqual([...s.values],bytes);
    restoreButtons(view)[0]();assert.ok(applied);assert.equal(applied.id,n.id);assert.deepEqual(applied.versions,n.versions);
    assert.deepEqual(applied.plans,good.plans);assert.deepEqual([...s.values],bytes);
  } finally {Object.assign(globalThis,{window:previous});}
});
test("P1 protects originals, healthy neighbor, full byte backup reuse and protected identity", () => {
  const damaged=h4Case("damaged");setCount(damaged,4294967296);const healthy=h4Case("healthy");
  const original=JSON.stringify([damaged,healthy],null,2),s=new Store();s.setItem(CASE_STORAGE_KEY,original);
  const r=readCaseStore(original);assert.equal(r.recoveryNeeded,true);assert.equal(r.malformed,false);
  assert.deepEqual(r.cases.map(c=>c.id),["healthy"]);assert.deepEqual(r.protectedEntries,[damaged]);
  saveCaseToStore(s,{...healthy,status:"In Prüfung"});assert.equal(recoveryBackups(s).length,1);assert.equal(recoveryBackups(s)[0].original,original);
  assert.deepEqual(JSON.parse(s.getItem(CASE_STORAGE_KEY)!).find((c:AdvisoryCase)=>c.id==="damaged"),damaged);
  const backups=recoveryBackups(s);saveCaseToStore(s,{...healthy,status:"Abgeschlossen"});assert.deepEqual(recoveryBackups(s),backups);
  const bytes=[...s.values];assert.throws(()=>saveCaseToStore(s,h4Case("damaged")));assert.throws(()=>insertCaseIntoStore(s,h4Case("damaged")));assert.deepEqual([...s.values],bytes);
  assert.equal(readCaseStore(s.getItem(CASE_STORAGE_KEY)).cases[0].status,"Abgeschlossen","same-case last write wins");
});
test("P1 incomplete prebackup is insufficient; failed backup/main writes preserve original store", () => {
  const a=h4Case("bad-a"),b=h4Case("bad-b");setCount(a,1201);setCount(b,4294967296);const healthy=h4Case("healthy");
  const original=JSON.stringify([a,b,healthy],null,2);
  for(const full of [false,true]) {
    const s=new Store();s.setItem(CASE_STORAGE_KEY,original);s.setItem(RECOVERY_PREFIX+"prior",JSON.stringify(full?[a,b]:[a]));
    saveCaseToStore(s,healthy);assert.equal(recoveryBackups(s).length,full?1:2);
    if(!full)assert.ok(recoveryBackups(s).some(b=>b.original===original));
  }
  for(const field of ["failBackup","corruptBackup","failMain"] as const){
    const s=new Store();s.setItem(CASE_STORAGE_KEY,original);s[field]=true;assert.throws(()=>saveCaseToStore(s,healthy));
    assert.equal(s.getItem(CASE_STORAGE_KEY),original);
  }
  const s=new Store();s.setItem(CASE_STORAGE_KEY,original);const before=[...s.values],invalid=h4Case("invalid");setCount(invalid,NaN);
  assert.throws(()=>saveCaseToStore(s,invalid));assert.deepEqual([...s.values],before,"invalid mutation creates no recovery backup either");
});
console.log(`H4 installment safety: ${groups} groups passed; ${currentRejections} current and ${legacyRejections} legacy rejections; direct bounded domain, real Restore, Store/Recovery verified. React drafts: CP0B browser gate.`);
