import assert from "node:assert/strict";
import { normalizeImportedCase, targetDateForNeed, monthsUntilNeed, capitalPots } from "../app/case-model";
import { validCaseFinancialInputs } from "../app/domain/case/financial-validation";
import { legacyCapitalProtection } from "../app/domain/case/legacy-capital-protection";
import { diagnoseCapitalRecovery } from "../app/domain/case/capital-recovery-diagnosis";
import { CASE_STORAGE_KEY, RECOVERY_PREFIX, readCaseStore, recoveryBackups,
  writeCaseStore, saveCaseToStore, insertCaseIntoStore } from "../app/case-storage";
import { controlCase, needBase, needVariant, variants, accepted, historyOwner } from "./f021-fixtures";

class Store {
  values = new Map<string,string>(); failBackup = false; corruptBackup = false;
  get length() { return this.values.size; }
  key(i:number) { return [...this.values.keys()][i] ?? null; }
  getItem(k:string) { return this.values.get(k) ?? null; }
  setItem(k:string,v:string) {
    if (k.startsWith(RECOVERY_PREFIX) && this.failBackup) throw new Error("synthetic quota");
    this.values.set(k,k.startsWith(RECOVERY_PREFIX) && this.corruptBackup ? "incomplete" : v);
  }
}
let groups=0;
function test(name:string,run:()=>void) { run(); groups++; console.log(`PASS F021 ${name}`); }

test("A/B strict guard precedes graph and JSON copy; original remains untouched",()=>{
  for(const group of ["A","B"] as const) for(const v of variants) {
    const c=needVariant(group,v), before=structuredClone(c);
    assert.equal(validCaseFinancialInputs(c),v.valid,`${group} ${v.tag} immediate type/value guard`);
    for(const wrapped of [false,true]) assert.equal(!!normalizeImportedCase(wrapped?{case:c}:c,false),accepted(group,v),`${group} ${v.tag}`);
    assert.deepEqual(c,before);
    if(!v.valid) {
      // Neither a calendar/graph access nor a JSON clone may precede rejection.
      Object.defineProperty(c,"createdAt",{get:()=>{throw new Error("calendar/clone reached");}});
      assert.equal(normalizeImportedCase(c,false),null);
    }
  }
});
test("runtime nonfinite and other wrong types reject before JSON can turn them into null",()=>{
  for(const value of [NaN,Infinity,-Infinity,true,[],{},"", "0"]) {
    const c=needBase("B"); Reflect.set(c.advisory.needs[0],"years",value); const before=structuredClone(c);
    assert.equal(validCaseFinancialInputs(c),false); assert.equal(normalizeImportedCase(c,false),null);
    for(const mutate of [saveCaseToStore,insertCaseIntoStore,(s:Store,c:typeof before)=>writeCaseStore(s,[c])]) {
      const s=new Store(); insertCaseIntoStore(s,controlCase("neighbor")); const bytes=[...s.values];
      assert.throws(()=>mutate(s,c)); assert.deepEqual([...s.values],bytes);
    }
    assert.deepEqual(c,before);
  }
});
test("Save/Insert/Write obey exact A/B acceptance and retain healthy neighbors",()=>{
  for(const group of ["A","B"] as const) for(const v of variants) for(const op of ["save","insert","write"] as const) {
    const c=needVariant(group,v), s=new Store(), neighbor=controlCase("neighbor"); insertCaseIntoStore(s,neighbor);
    const bytes=[...s.values], run=()=>op==="save"?saveCaseToStore(s,c):op==="insert"?insertCaseIntoStore(s,c):writeCaseStore(s,[c,neighbor]);
    if(accepted(group,v)) { run(); const loaded=readCaseStore(s.getItem(CASE_STORAGE_KEY));
      assert.equal(loaded.cases.length,2); assert.deepEqual(loaded.cases.find(x=>x.id===neighbor.id)!.advisory,normalizeImportedCase(neighbor,false)!.advisory);
    } else { assert.throws(run); assert.deepEqual([...s.values],bytes); }
  }
});
test("P1 raw reads protect damaged originals; complete backup readback/reuse and atomic failure",()=>{
  for(const group of ["A","B"] as const) for(const v of variants.filter(v=>!v.valid)) {
    const c=needVariant(group,v), neighbor=controlCase("neighbor"), original=JSON.stringify([c,neighbor],null,2), s=new Store();
    s.setItem(CASE_STORAGE_KEY,original); const loaded=readCaseStore(original);
    assert.deepEqual(loaded.protectedEntries,JSON.parse(original).slice(0,1)); assert.equal(s.getItem(CASE_STORAGE_KEY),original);
    for(const mode of ["quota","readback"] as const) {
      const blocked=new Store(); blocked.setItem(CASE_STORAGE_KEY,original); blocked.failBackup=mode==="quota"; blocked.corruptBackup=mode==="readback";
      assert.throws(()=>saveCaseToStore(blocked,neighbor)); assert.equal(blocked.getItem(CASE_STORAGE_KEY),original);
    }
    saveCaseToStore(s,neighbor); assert.equal(recoveryBackups(s).length,1); assert.equal(recoveryBackups(s)[0].original,original);
    saveCaseToStore(s,{...neighbor,status:"In Prüfung"}); assert.equal(recoveryBackups(s).length,1);
    assert.deepEqual(readCaseStore(s.getItem(CASE_STORAGE_KEY)).protectedEntries,JSON.parse(original).slice(0,1));
    assert.deepEqual(readCaseStore(s.getItem(CASE_STORAGE_KEY)).cases[0].advisory,normalizeImportedCase(neighbor,false)!.advisory);
  }
});
test("P4 retains inner identities and opaque snapshots even when their duration is invalid",()=>{
  for(const v of variants) {
    const c=historyOwner(needVariant("B",v)), before=structuredClone(c), imported=normalizeImportedCase({case:c}); assert.ok(imported);
    assert.notEqual(imported.id,c.id); assert.deepEqual(imported.plans,c.plans); assert.equal(imported.activePlanId,c.activePlanId);
    assert.deepEqual(imported.versions,c.versions); const s=new Store(); insertCaseIntoStore(s,imported);
    assert.deepEqual(readCaseStore(s.getItem(CASE_STORAGE_KEY)).cases[0].versions,c.versions); assert.deepEqual(c,before);
  }
});
test("explicit valid dueDate keeps established priority, including unused malformed years",()=>{
  for(const value of [0,1.49,null,false,"2",-1,undefined,NaN,Infinity]) {
    const c=needBase("B"); c.advisory.needs[0].dueDate="2028-02-29"; Reflect.set(c.advisory.needs[0],"years",value);
    const before=structuredClone(c), n=normalizeImportedCase(c,false); assert.ok(n);
    assert.equal(targetDateForNeed(n.advisory.needs[0],n.createdAt),"2028-02-29"); assert.equal(monthsUntilNeed(n.advisory.needs[0],n.createdAt),16);
    const s=new Store(); insertCaseIntoStore(s,n); assert.equal(readCaseStore(s.getItem(CASE_STORAGE_KEY)).cases.length,1); assert.deepEqual(c,before);
  }
  for(const dueDate of [undefined,"","2028-02-30","invalid"]) {
    const c=needBase("B"); c.advisory.needs[0].dueDate=dueDate; Reflect.set(c.advisory.needs[0],"years",null);
    assert.equal(normalizeImportedCase(c,false),null,"invalid explicit date must not bypass relative guard");
  }
});
test("PR40 dates, rounding, leap years and year pots remain exact",()=>{
  for(const [reference,years,date,months] of [
    ["2026-10-15",0,"2026-10-15",0],["2026-10-15",1.49,"2028-04-15",18],
    ["2026-10-15",1.5,"2028-04-15",18],["2026-10-15",2,"2028-10-15",24],
    ["2026-01-31",1/12,"2026-02-28",1],["2028-01-31",1/12,"2028-02-29",1],
    ["2028-02-29",1,"2029-02-28",12],["2026-12-31T23:30:00-10:00",1/12,"2027-01-31",1],
  ] as const) {
    const c=needBase("B"); c.createdAt=reference; c.advisory.needs[0].years=years; const n=normalizeImportedCase(c,false); assert.ok(n);
    assert.equal(targetDateForNeed(n.advisory.needs[0],reference),date); assert.equal(monthsUntilNeed(n.advisory.needs[0],reference),months);
    assert.ok(capitalPots(n.advisory,n.plans[0].total,reference).some(p=>p.id===`year-${date.slice(0,4)}`));
  }
});
test("legacy schemas cannot heal invalid durations; H5b remains read-only and blocks them",()=>{
  for(const group of ["A","B"] as const) for(const v of variants.filter(v=>!v.valid)) {
    const c=needVariant(group,v), before=structuredClone(c); const d=diagnoseCapitalRecovery(c,"UTC"); assert.equal(d.repairable,false); assert.ok(d.findings.some(f=>f.category==="D")); assert.deepEqual(c,before);
    for(let schema=0;schema<=9;schema++) { const old=structuredClone(c); old.schemaVersion=schema;
      assert.equal(legacyCapitalProtection(old),"invalid-data"); assert.equal(normalizeImportedCase(old,false),null); assert.equal(old.schemaVersion,schema);
    }
  }
});
console.log(`F021 need duration: ${groups} groups passed; A/B guard, import, runtime mutators, P1/P4, calendar and H5 boundaries.`);
