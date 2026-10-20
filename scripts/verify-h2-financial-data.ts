import assert from "node:assert/strict";
import {
  createCase, createPlan, caseSnapshot, normalizeImportedCase, duplicateStructurePlan,
  capitalPots, strategicAmount, planningShortfall, planAssetAmounts,
  allocationCapitalCoverageTotal, allocationCoverageTotal, buildIstWealthStructure,
  buildPlanWealthStructure, getActiveStructurePlan, getPreferredStructurePlan,
  annualSavingsContribution, phasedEntryAmounts, type AdvisoryCase,
} from "../app/case-model";
import { validCaseFinancialInputs } from "../app/domain/case/financial-validation";
import { CASE_STORAGE_KEY, RECOVERY_PREFIX, readCaseStore, recoveryBackups,
  writeCaseStore, saveCaseToStore, insertCaseIntoStore } from "../app/case-storage";

const AS_OF = "2026-01-01T12:00:00.000Z";
function fixture(id = "h2-case"): AdvisoryCase {
  const c = createCase();
  Object.assign(c, { id, createdAt: AS_OF, updatedAt: AS_OF });
  Object.assign(c.advisory, { caseName: "Synthetischer H2-Fall", liquidAssets: 100_000,
    depotValue: 1000, otherAssets: 1234.56789, reserve: 5000,
    needs: [{ id: 1, purpose: "A", amount: 10_000, years: 2 }, { id: 2, purpose: "B", amount: 20_000, years: 2 }] });
  c.depotAccounts = [{ id: "h2-depot", name: "Synthetisches Depot", createdAt: AS_OF, updatedAt: AS_OF }];
  c.depot = [{ id: "h2-holding", depotId: "h2-depot", name: "Synthetische Position",
    value: 1000, plannedSale: 50, assetClass: "Substanzwerte", region: "Weltweit", risk: 3,
    note: "", gainLossAmount: -123.4567, gainLossPercent: -12.34567, classificationStatus: "mapped" }];
  const p = c.plans[0];
  Object.assign(p, { id: "h2-plan", total: 100_000, capitalMode: "manual", modelAmount: 3000,
    depotMode: "afterSales", depotSelectionInitialized: false, depotModeSelectionInitialized: false, createdAt: AS_OF, updatedAt: AS_OF });
  p.allocations = [1000, 2000].map((amount, i) => ({ id: `h2-allocation-${i}`, productId: "synthetic-unmapped",
    productName: "Synthetisches Produkt", solutionId: "synthetic", source: "product", bucketId: "year10plus",
    amount, capitalPotId: "strategic", capitalPotAmounts: { strategic: amount }, bucketAmounts: { year10plus: amount },
    capitalPotReviewAmount: 0 }));
  p.investmentPlans = [
    { id: "h2-phased", type: "phased", allocationId: p.allocations[0].id, capitalPotId: "strategic",
      stagedMode: "amount", stagedValue: 500, installments: 4, frequency: "monthly", startDate: "2026-02-01", note: "" },
    { id: "h2-saving", type: "savings", productId: "synthetic-unmapped", productName: "Synthetisch",
      contributionAmount: 25, frequency: "monthly", startDate: "2026-02-01", note: "",
      targetRef: { kind: "savingsGoal", id: "h2-goal" } },
  ];
  c.activePlanId = p.id;
  c.savingsGoals = [{ id: "h2-goal", name: "Synthetisches Sparziel", targetAmount: 5000 }];
  c.vvFilters.amount = 100_000;
  c.versions = [{ id: "h2-version", label: "Synthetischer Snapshot", createdAt: AS_OF, snapshot: caseSnapshot(c) }];
  return c;
}
class Store {
  values = new Map<string, string>();
  failBackup = false; failMain = false; corruptBackup = false;
  get length() { return this.values.size; }
  key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string, v: string) {
    if ((this.failBackup && k.startsWith(RECOVERY_PREFIX)) || (this.failMain && k === CASE_STORAGE_KEY)) throw new Error("synthetic quota");
    this.values.set(k, this.corruptBackup && k.startsWith(RECOVERY_PREFIX) ? "synthetic bad backup" : v);
  }
}
let groups = 0, rejected = 0;
function test(name: string, run: () => void) { run(); groups++; console.log(`PASS H2 ${name}`); }
function roundTrip(c: AdvisoryCase) {
  const parsed: unknown = JSON.parse(JSON.stringify({ case: c }));
  const n = normalizeImportedCase(parsed); assert.ok(n);
  const s = new Store(); insertCaseIntoStore(s, n);
  const r = readCaseStore(s.getItem(CASE_STORAGE_KEY));
  assert.equal(r.recoveryNeeded, false); assert.equal(r.cases.length, 1);
  return r.cases[0];
}
const mandatory: [string, (c: AdvisoryCase, v: unknown) => void][] = [
  ...["liquidAssets", "depotValue", "otherAssets", "reserve"].map((field): [string, (c: AdvisoryCase, v: unknown) => void] =>
    [`advisory.${field}`, (c, v) => { Reflect.set(c.advisory, field, v); }]),
  ["need.amount", (c,v) => { Reflect.set(c.advisory.needs[0], "amount", v); }],
  ["plan.total", (c,v) => { Reflect.set(c.plans[0], "total", v); }],
  ["allocation.amount", (c,v) => { Reflect.set(c.plans[0].allocations[0], "amount", v); }],
  ["capitalPotAmounts.strategic", (c,v) => { Reflect.set(c.plans[0].allocations[0].capitalPotAmounts!, "strategic", v); }],
  ["bucketAmounts.year10plus", (c,v) => { Reflect.set(c.plans[0].allocations[0].bucketAmounts!, "year10plus", v); }],
  ["contributionAmount", (c,v) => { Reflect.set(c.plans[0].investmentPlans[1], "contributionAmount", v); }],
  ["stagedValue", (c,v) => { Reflect.set(c.plans[0].investmentPlans[0], "stagedValue", v); }],
  ["goal.targetAmount", (c,v) => { Reflect.set(c.savingsGoals[0], "targetAmount", v); }],
  ["holding.value", (c,v) => { Reflect.set(c.depot[0], "value", v); }],
  ["holding.plannedSale", (c,v) => { Reflect.set(c.depot[0], "plannedSale", v); }],
];
const optional: [string, (c: AdvisoryCase, v: unknown) => void][] = [
  ["modelAmount", (c,v) => { Reflect.set(c.plans[0], "modelAmount", v); }],
  ["capitalPotReviewAmount", (c,v) => { Reflect.set(c.plans[0].allocations[0], "capitalPotReviewAmount", v); }],
  ["vvFilters.amount", (c,v) => { Reflect.set(c.vvFilters, "amount", v); }],
];
const bad: unknown[] = ["1000", "0", null, undefined, true, false, [], {}, -1, NaN, Infinity, -Infinity];
function rejectsFinancial(set: (c: AdvisoryCase) => void, label: string) {
  for (const schema of [10, 11]) {
    const c = fixture(); Reflect.set(c, "schemaVersion", schema); set(c);
    const before = structuredClone(c);
    assert.equal(normalizeImportedCase(c, false), null, `${schema}: ${label}`);
    assert.equal(normalizeImportedCase({ case: c }), null, `${schema} wrapped: ${label}`);
    assert.deepEqual(c, before, "rejection never changes the original"); rejected++;
  }
}

test("current mandatory fields reject every corrupt numeric class before transformations", () => {
  for (const [name, set] of mandatory) for (const v of bad) rejectsFinancial(c => set(c,v), `${name}=${String(v)}`);
});
test("optional amounts retain absent/default contracts but reject present corruption", () => {
  for (const [name,set] of optional) {
    for (const v of bad.filter(v => v !== undefined)) rejectsFinancial(c => set(c,v), `${name}=${String(v)}`);
    const c=fixture(); set(c,undefined); assert.ok(normalizeImportedCase(c,false), name);
  }
  const c=fixture(); Reflect.deleteProperty(c,"vvFilters");
  assert.equal(normalizeImportedCase(c,false)?.vvFilters.amount,100_000);
});
test("integer, cent, higher precision and zero remain valid and unrounded", () => {
  for (const [name,set] of [...mandatory,...optional]) for (const v of [0, 1, 1000.5, 1000.123456789]) {
    const c=fixture(); set(c,v);
    if(name !== "stagedValue" && name !== "contributionAmount") c.plans[0].investmentPlans=[];
    if(name === "plan.total") c.plans[0].allocations=[];
    assert.equal(validCaseFinancialInputs(c),true);
    const n=normalizeImportedCase(c,false); assert.ok(n);
    assert.equal(n.advisory.otherAssets,c.advisory.otherAssets);
    assert.deepEqual(n.plans,c.plans);
  }
  const c=fixture(); c.advisory.reserve=0;c.advisory.needs=[];
  Object.assign(c.depot[0],{value:1000.123456789,plannedSale:0.123456789});
  c.plans[0].allocations[0].amount=1000.123456789;
  c.savingsGoals[0].targetAmount=5000.123456789;
  const n=roundTrip(c);
  assert.equal(n.depot[0].value,c.depot[0].value); assert.equal(n.depot[0].plannedSale,c.depot[0].plannedSale);
  assert.equal(n.savingsGoals[0].targetAmount,c.savingsGoals[0].targetAmount);
  assert.equal(n.depot[0].gainLossAmount,-123.4567); assert.equal(n.depot[0].gainLossPercent,-12.34567);
});
test("Astra string needs and negative reserve rejected; numeric 30000/65000/0 control", () => {
  rejectsFinancial(c => c.advisory.needs.forEach(n => Reflect.set(n,"amount",String(n.amount))),"Astra F-005");
  rejectsFinancial(c => { c.advisory.reserve=-5000; },"negative reserve");
  const c=roundTrip(fixture());
  const pots=capitalPots(c.advisory,c.plans[0].total,c.createdAt);
  assert.equal(pots.find(p=>p.kind==="year")?.total,30000);
  assert.equal(pots.find(p=>p.kind==="strategic")?.total,65000);
  assert.equal(strategicAmount(c.advisory,c.plans[0].total),65000);
  assert.equal(planningShortfall(c.advisory,c.plans[0].total),0);
});
test("independently reproduced Audit 06 strings rejected; numerical two-allocation control", () => {
  rejectsFinancial(c => c.plans[0].allocations.forEach(a => {
    Reflect.set(a,"amount",String(a.amount)); Reflect.set(a.capitalPotAmounts!,"strategic",String(a.amount));
  }),"Audit 06 paired string allocations");
  const c=roundTrip(fixture()), p=c.plans[0];
  assert.equal(planAssetAmounts(p).total,3000); assert.equal(planAssetAmounts(p).unresolved,3000);
  assert.equal(p.allocations.reduce((s,a)=>s+allocationCapitalCoverageTotal(a),0),3000);
  assert.equal(p.allocations.reduce((s,a)=>s+allocationCoverageTotal(a),0),3000);
  assert.equal(buildPlanWealthStructure(c.depot,p).total,100950);
});
test("mapping shapes, corrupt collection elements and percentage contract rejected", () => {
  for (const field of ["capitalPotAmounts","bucketAmounts"]) for (const v of [null, [], "1000", true, { strategic:null }, { strategic:Infinity }])
    rejectsFinancial(c=>{Reflect.set(c.plans[0].allocations[0],field,v);},field);
  for (const v of [null,[],100,"bad"]) {
    rejectsFinancial(c=>{Reflect.set(c.advisory.needs,0,v);},"need element");
    rejectsFinancial(c=>{Reflect.set(c.savingsGoals,0,v);},"goal element");
    rejectsFinancial(c=>{Reflect.set(c.plans[0].allocations,0,v);},"allocation element");
    rejectsFinancial(c=>{Reflect.set(c.plans[0].investmentPlans,0,v);},"investment element");
  }
  for (const v of ["50",null,-1,101,NaN,Infinity]) rejectsFinancial(c=>{
    Object.assign(c.plans[0].investmentPlans[0],{stagedMode:"percent",stagedValue:v});
  },"percent");
  for(const v of [0,50.125,100]){
    const c=fixture();Object.assign(c.plans[0].investmentPlans[0],{stagedMode:"percent",stagedValue:v});
    assert.equal(Reflect.get(normalizeImportedCase(c,false)!.plans[0].investmentPlans[0],"stagedValue"),v);
  }
});
test("incomplete, empty, under- and overplanning remain legal; no artificial sum constraint", () => {
  for (const amount of [0,1000,120000]) {
    const c=fixture(); c.plans[0].investmentPlans=[];
    Object.assign(c.plans[0].allocations[0],{amount,capitalPotAmounts:{strategic:100},bucketAmounts:{year10plus:100}});
    const n=roundTrip(c);assert.equal(n.plans[0].allocations[0].amount,amount);
    assert.equal(allocationCapitalCoverageTotal(n.plans[0].allocations[0]),100);
  }
  const c=fixture();c.plans[0].investmentPlans=[];
  Object.assign(c.plans[0].allocations[0],{capitalPotId:undefined,capitalPotAmounts:{},bucketAmounts:{}});
  assert.ok(normalizeImportedCase(c,false));
});
test("all direct Save/Insert/Write financial failures leave store and backups untouched", () => {
  for(const [name,set] of [...mandatory,...optional]) for(const v of bad) {
    if(v===undefined && optional.some(([n])=>n===name))continue;
    const s=new Store();writeCaseStore(s,[fixture("healthy")]); const before=[...s.values];
    const c=fixture("invalid");set(c,v);
    for(const action of [()=>saveCaseToStore(s,c),()=>insertCaseIntoStore(s,c),()=>writeCaseStore(s,[fixture("healthy"),c])]){
      assert.throws(action,name); assert.deepEqual([...s.values],before,name);
    }
  }
});
test("nonfinite originals rejected before JSON clone including overwritten depotValue", () => {
  for(const amount of [NaN,Infinity,-Infinity]) for(const set of [
    (c:AdvisoryCase)=>{c.savingsGoals[0].targetAmount=amount;},
    (c:AdvisoryCase)=>{c.advisory.depotValue=amount;},
    (c:AdvisoryCase)=>{c.plans[0].allocations[0].amount=amount;},
  ]){
    const c=fixture();set(c);const before=structuredClone(c);
    assert.equal(normalizeImportedCase(c,false),null);
    assert.deepEqual(c,before);const s=new Store();assert.throws(()=>insertCaseIntoStore(s,c));assert.equal(s.length,0);
  }
  const c=fixture(); c.advisory.depotValue=999999; // Valid stale numeric aggregate is still derived.
  assert.equal(roundTrip(c).advisory.depotValue,1000);
});
test("P1 protects financial originals; full backup created and reused for healthy neighbors", () => {
  const damaged=fixture("damaged");Reflect.set(damaged.advisory.needs[0],"amount","10000");
  const original=JSON.stringify([damaged,fixture("healthy")],null,2), s=new Store();s.setItem(CASE_STORAGE_KEY,original);
  const r=readCaseStore(original);assert.equal(r.malformed,false);assert.equal(r.recoveryNeeded,true);
  assert.deepEqual(r.cases.map(c=>c.id),["healthy"]);assert.deepEqual(r.protectedEntries,[damaged]);
  const healthy={...r.cases[0],status:"In Prüfung" as const};saveCaseToStore(s,healthy);
  assert.equal(recoveryBackups(s).length,1);assert.equal(recoveryBackups(s)[0].original,original);
  assert.deepEqual(readCaseStore(s.getItem(CASE_STORAGE_KEY)).protectedEntries,[damaged]);
  saveCaseToStore(s,{...healthy,status:"Abgeschlossen"});insertCaseIntoStore(s,fixture("added"));
  assert.equal(recoveryBackups(s).length,1);assert.equal(recoveryBackups(s)[0].original,original);
  assert.deepEqual(readCaseStore(s.getItem(CASE_STORAGE_KEY)).protectedEntries,[damaged]);
  const before=[...s.values];assert.throws(()=>saveCaseToStore(s,fixture("damaged")));assert.deepEqual([...s.values],before);
});
test("P1 incomplete/full backups and backup/main failures preserve damaged principal store", () => {
  const damaged=fixture("bad");Reflect.set(damaged.plans[0].allocations[0],"amount","1000");
  const original=JSON.stringify([damaged,fixture("healthy")]);
  for(const mode of ["incomplete","existing","failBackup","corruptBackup","failMain"]){
    const s=new Store();s.setItem(CASE_STORAGE_KEY,original);
    if(mode==="incomplete")s.setItem(`${RECOVERY_PREFIX}prior`,JSON.stringify([fixture("healthy")]));
    if(mode==="existing")s.setItem(`${RECOVERY_PREFIX}prior`,original);
    s.failBackup=mode==="failBackup";s.corruptBackup=mode==="corruptBackup";s.failMain=mode==="failMain";
    if(["failBackup","corruptBackup","failMain"].includes(mode)){
      assert.throws(()=>saveCaseToStore(s,{...fixture("healthy"),status:"In Prüfung"}));
      assert.equal(s.getItem(CASE_STORAGE_KEY),original);
    }else{
      saveCaseToStore(s,fixture("healthy"));assert.equal(recoveryBackups(s).length,mode==="incomplete"?2:1);
      assert.ok(recoveryBackups(s).some(b=>b.original===original));
    }
  }
});
test("JSON rejection never inserts an ID or partially accepts damaged plans", () => {
  const s=new Store();writeCaseStore(s,[fixture("healthy")]);const before=[...s.values];
  const c=fixture();const second=createPlan("synthetic second",100_000);second.allocations=[{...c.plans[0].allocations[0],id:"second-a"}];
  Reflect.set(second.allocations[0],"amount","1000");c.plans.push(second);
  const n=normalizeImportedCase(JSON.parse(JSON.stringify({case:c})));assert.equal(n,null);
  if(n)insertCaseIntoStore(s,n);assert.deepEqual([...s.values],before);
});
test("P4 fresh outer IDs, inner graph/copy identities, opaque history and restore validation", () => {
  const c=fixture(),snapshot=structuredClone(c.versions[0].snapshot);
  Reflect.set(c.versions[0].snapshot.advisory.needs[0],"amount","10000");
  const n=roundTrip(c);assert.notEqual(n.id,c.id);assert.deepEqual(n.plans,c.plans);
  assert.deepEqual(n.versions,c.versions);assert.equal(n.versions[0].snapshot.id,c.id);
  assert.equal(normalizeImportedCase(n.versions[0].snapshot,false),null);
  assert.ok(normalizeImportedCase(snapshot,false));
  const copied=duplicateStructurePlan(c.plans[0]);assert.notEqual(copied.id,c.plans[0].id);
  assert.equal(Reflect.get(copied.investmentPlans[0],"allocationId"),copied.allocations[0].id);
  const next={...c,plans:[...c.plans,copied]};assert.ok(normalizeImportedCase(next,false));
});
test("schema 0-9 valid migrations and explicitly converted legacy monetary fields survive", () => {
  for(let schema=0;schema<=9;schema++){
    const c=fixture();Reflect.set(c,"schemaVersion",schema);c.plans[0].investmentPlans=[];
    const n=normalizeImportedCase(c,false);assert.ok(n,`schema ${schema}`);assert.equal(n.schemaVersion,11);
    assert.equal(n.activePlanId,c.activePlanId);assert.deepEqual(n.versions,c.versions);
  }
  for(const schema of [7,8,9]){
    const c=fixture();Reflect.set(c,"schemaVersion",schema);
    Reflect.set(c.savingsGoals[0],"targetAmount","5000.1234");Reflect.set(c.depot[0],"plannedSale","50.1234");
    c.plans[0].allocations.forEach(a=>{delete a.capitalPotAmounts;delete a.capitalPotId;Reflect.set(a,"bucketAmounts",{year10plus:String(a.amount)});});
    Reflect.set(c.plans[0],"investmentPlans",schema<8 ? [
      {id:"legacy-saving",type:"savings",installmentAmount:"25.125",frequency:"monthly"},
      {id:"legacy-phased",type:"phased",productId:"synthetic-unmapped",capitalPotId:"strategic",installmentAmount:"100",installments:4},
    ] : [
      {...c.plans[0].investmentPlans[1],contributionAmount:"25.125"},
      {...c.plans[0].investmentPlans[0],stagedValue:"500.125"},
    ]);
    // H5a forbids ambiguous phased deletion. Give this monetary conversion
    // fixture a unique product match; ambiguity rejection is checked separately.
    if(schema<8)c.plans[0].allocations[1].productId="synthetic-other";
    const n=normalizeImportedCase(c,false);assert.ok(n,`legacy strings ${schema}`);
    assert.equal(n.savingsGoals[0].targetAmount,5000.1234);assert.equal(n.depot[0].plannedSale,50.1234);
    assert.equal(n.plans[0].allocations[0].capitalPotAmounts?.strategic,1000);
    const saving=n.plans[0].investmentPlans.find(e=>e.type==="savings");assert.ok(saving?.type==="savings");assert.equal(saving.contributionAmount,25.125);
    if(schema>=8)assert.equal(Reflect.get(n.plans[0].investmentPlans[1],"stagedValue"),500.125);
  }
  const old=fixture();Reflect.set(old,"schemaVersion",6);Reflect.deleteProperty(old,"savingsGoals");
  Reflect.set(old.plans[0],"investmentPlans",[{id:"old-saving",type:"savings"}]);
  assert.equal(Reflect.get(normalizeImportedCase(old,false)!.plans[0].investmentPlans[0],"contributionAmount"),0);
});
test("legacy label is no license for negative, null, nonfinite or unconverted string repair", () => {
  for(const schema of [0,7,8,9]) for(const v of [-1,null,NaN,Infinity,-Infinity]){
    const c=fixture();Reflect.set(c,"schemaVersion",schema);c.plans[0].investmentPlans=[];
    Reflect.set(c.savingsGoals[0],"targetAmount",v);assert.equal(normalizeImportedCase(c,false),null);
  }
  for(const set of [
    (c:AdvisoryCase)=>Reflect.set(c.advisory,"liquidAssets","100000"),
    (c:AdvisoryCase)=>Reflect.set(c.plans[0].allocations[0].capitalPotAmounts!,"strategic","1000"),
  ]){const c=fixture();Reflect.set(c,"schemaVersion",9);set(c);assert.equal(normalizeImportedCase(c,false),null);}
});
test("unchanged numeric calculations, IST/PLAN/ZIELPLAN and export-ready monetary rows", () => {
  const source=fixture(),p=createPlan("Synthetisch unabhängig",5000);source.plans.push(p);source.activePlanId=p.id;
  const n=roundTrip(source),active=getActiveStructurePlan(n),preferred=getPreferredStructurePlan(n.plans)!;
  assert.equal(active.id,p.id);assert.equal(preferred.id,source.plans[0].id);
  assert.deepEqual(buildIstWealthStructure(n.depot,n.advisory.liquidAssets),buildIstWealthStructure(source.depot,source.advisory.liquidAssets));
  assert.equal(buildIstWealthStructure(n.depot,n.advisory.liquidAssets).total,101000);
  assert.equal(buildPlanWealthStructure(n.depot,active).total,5000);
  assert.equal(buildPlanWealthStructure(n.depot,preferred).total,100950);
  const saving=preferred.investmentPlans[1];assert.ok(saving.type==="savings");assert.equal(annualSavingsContribution(saving),300);
  const phased=preferred.investmentPlans[0];assert.ok(phased.type==="phased");
  assert.deepEqual(phasedEntryAmounts(preferred,phased),phasedEntryAmounts(source.plans[0],phased));
  assert.deepEqual(phasedEntryAmounts(preferred,phased).installmentAmounts,[125,125,125,125]);
  // These are the live numeric values consumed by the existing JSON/Excel/print outputs.
  assert.deepEqual(n.plans[0].allocations.map(a=>a.amount),[1000,2000]);
  assert.equal(n.advisory.reserve,5000);assert.equal(n.savingsGoals[0].targetAmount,5000);
});
console.log(`H2 financial data: ${groups} groups passed; ${rejected} current-schema rejection cases; real import/store/reload, P1 recovery and legacy contracts verified.`);
