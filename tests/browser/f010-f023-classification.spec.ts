import { test, expect, type Page, type Locator, type TestInfo } from "@playwright/test";
import * as XLSX from "xlsx";
import { assetClasses, type AssetClass } from "../../app/domain/assets/contracts";
import { CLASSIFICATION_ERROR } from "../../app/domain/depot/classification-validation";
import { caseSnapshot, type AdvisoryCase } from "../../app/case-model";
import { classificationCase, classifiedHolding, invalidClassification } from "../../scripts/f010-f023-fixtures";
import { seed, open, nav, save, raw, data, current, download, monitor, emit, RECOVERY_PREFIX } from "./f021-driver";
import { screenshot } from "./f017-driver";

type Amounts = [number, number, number, number, number];
const euros = (v:number) => new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(v);
const shares = (v:number,total:number) => new Intl.NumberFormat("de-DE",{minimumFractionDigits:1,maximumFractionDigits:1}).format(total?v/total*100:0)+" %";
async function situation(p:Page){await nav(p,"Strukturplanung");await p.getByRole("button",{name:"← Zurück zur Beratung",exact:true}).click();await p.locator(".wizard-steps").getByRole("button").nth(1).click();}
async function depotHouse(p:Page){await p.getByRole("tab",{name:"Vermögenshaus",exact:true}).click();return p.locator(".house-view");}
async function house(h:Locator,amounts:Amounts,unknown:number,total:number){
  await expect(h.locator(".house-pillars button footer")).toHaveText(amounts.map(euros));
  await expect(h.locator(".house-pillars button header strong")).toHaveText(amounts.map(v=>shares(v,total)));
  await expect(h.locator(".house-foundation b")).toHaveText(unknown?`${euros(unknown)} noch ungeklärt`:"vollständig durchgeschaut");
  await expect(h.locator(".house-roof strong")).toContainText(euros(total));
  return {pillars:await h.locator(".house-pillars button footer").allTextContents(),foundation:await h.locator(".house-foundation").innerText(),roof:await h.locator(".house-roof").innerText()};
}
async function outputs(p:Page,info:TestInfo,amounts:Amounts,unknown:number,total:number,capture=false){
  await nav(p,"Ergebnis & Export");const bytes=await download(p,info,/Excel-Arbeitsmappe/,"f010-f023-real-xlsx"),wb=XLSX.read(bytes,{type:"buffer"});
  const rows=XLSX.utils.sheet_to_json<{Anlageklasse:string;Betrag:number;Anteil:number}>(wb.Sheets.Vermögensstruktur);
  expect(rows.map(r=>r.Anlageklasse)).toEqual([...assetClasses,"Nicht durchgeschaut"]);
  expect(rows.map(r=>r.Betrag)).toEqual([...amounts,unknown]);expect(rows.reduce((s,r)=>s+r.Betrag,0)).toBe(total);
  for(const [i,r] of rows.entries())expect(r.Anteil).toBe(total?[...amounts,unknown][i]/total:0);
  await p.evaluate(()=>{const w=window as unknown as {classificationPrints:string[]};w.classificationPrints=[];window.print=()=>w.classificationPrints.push(document.body.dataset.printMode!);});
  const print=[];
  for(const [index,label,mode] of [[1,/Kundenübersicht/,"customer"],[2,/Interne Arbeitsunterlage/,"internal"]] as const){
    await p.getByRole("button",{name:label}).click();await expect.poll(()=>p.evaluate(()=>(window as unknown as {classificationPrints:string[]}).classificationPrints.length)).toBe(index);
    await p.emulateMedia({media:"print"});await p.evaluate(m=>document.body.dataset.printMode=m,mode);
    await expect(p.locator(".print-house-pillars b")).toHaveText(amounts.map(euros));await expect(p.locator(".print-house-pillars strong")).toHaveText(amounts.map(v=>shares(v,total)));
    const row=p.locator(".print-table > div").filter({has:p.getByText("Nicht durchgeschaut",{exact:true})});await expect(row).toContainText(euros(unknown));await expect(row).toContainText(shares(unknown,total));
    print.push({mode,pillars:await p.locator(".print-house-pillars b").allTextContents(),unknown:await row.innerText()});
    if(capture)await screenshot(p,info,`f010-f023-print-${mode}`,".print-document");
    await p.emulateMedia({media:"screen"});await expect.poll(()=>p.evaluate(()=>document.body.dataset.printMode)).toBeUndefined();
  }
  expect(await p.evaluate(()=>(window as unknown as {classificationPrints:string[]}).classificationPrints)).toEqual(["customer","internal"]);
  return {rows,print};
}
async function upload(p:Page,c:AdvisoryCase|Buffer){const chooser=p.waitForEvent("filechooser");await p.getByRole("button",{name:/JSON importieren/}).click();await(await chooser).setFiles({name:"classification-synthetic.json",mimeType:"application/json",buffer:Buffer.isBuffer(c)?c:Buffer.from(JSON.stringify(c))});}
function neighborUnchanged(actual:AdvisoryCase|undefined,before:AdvisoryCase){expect({...actual,updatedAt:before.updatedAt}).toEqual(before);}

for(const asset of assetClasses)test(`F010 explicit ${asset} – Situation, Depot, IST/PLAN/ZIELPLAN, result, real XLSX, both prints and reload`,async({page},info)=>{
  const errors=monitor(page),c=classificationCase(),neighbor=classificationCase("classification-neighbor");await seed(page,[c,neighbor]);await open(page,c);
  const select=page.getByRole("combobox",{name:"Anlageklasse",exact:true});await expect(select).toHaveValue("");
  await select.selectOption(asset);const amounts=assetClasses.map(a=>a===asset?10000:0) as Amounts;
  await save(page);const saved=(await data(page)).find(x=>x.id===c.id)!;expect(saved.depot[0]).toEqual(classifiedHolding(c,{assetClass:asset}));neighborUnchanged((await data(page)).find(x=>x.id===neighbor.id),neighbor);
  const depot=await house(await depotHouse(page),amounts,0,10000);
  await nav(page,"Strukturplanung");await page.getByRole("button",{name:"Vermögensstruktur",exact:true}).click();const structure=page.locator(".house-view");const modes=[];
  for(const mode of ["IST","PLAN","ZIELPLAN"]){await structure.getByRole("tab",{name:mode,exact:true}).click();modes.push(await house(structure,amounts,0,10000));}
  await situation(page);await page.locator(".wizard-steps").getByRole("button").last().click();const result=await house(page.locator(".result-page .house-view"),amounts,0,10000);
  const output=await outputs(page,info,amounts,0,10000,asset==="Substanzwerte");
  const original=await raw(page);await page.reload();expect(await raw(page)).toBe(original);await open(page,saved);const reloaded=await current(page,info,"f010-reloaded");expect(reloaded.depot).toEqual(saved.depot);
  if(asset==="Substanzwerte"){
    const bytes=await download(page,info,/Vollständige Sicherung/,"f010-import-source");await upload(page,bytes);await expect.poll(async()=>(await data(page)).length).toBe(3);
    const imported=await current(page,info,"f010-imported");expect(imported.id).not.toBe(c.id);expect(imported.depot).toEqual(saved.depot);expect(imported.plans).toEqual(saved.plans);
    await page.getByRole("button",{name:"Version speichern",exact:true}).click();const versioned=(await data(page)).find(x=>x.id===imported.id)!;expect(versioned.versions).toHaveLength(1);
    await situation(page);await page.getByRole("combobox",{name:"Anlageklasse",exact:true}).selectOption("Sachwerte");await nav(page,"Ergebnis & Export");const beforeRestore=await raw(page);
    page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"Wiederherstellen",exact:true}).click();const restored=await current(page,info,"f010-h3-restored");expect(restored.depot).toEqual(saved.depot);expect(restored.id).toBe(imported.id);expect(restored.versions).toEqual(versioned.versions);expect(await raw(page)).toBe(beforeRestore);
    await save(page);await page.reload();await open(page,restored);expect((await current(page,info,"f010-h3-reloaded")).depot).toEqual(saved.depot);
  }
  expect(errors).toEqual([]);await emit(page,info,"f010-classes",{asset,input:c,saved,depot,modes,result,output,reloaded,errors});
});

test("F010 no decision stays unresolved in both selectors and all output paths",async({page},info)=>{
  const errors=monitor(page),c=classificationCase();await seed(page,[c]);await open(page,c);await expect(page.getByRole("combobox",{name:"Anlageklasse",exact:true})).toHaveValue("");await save(page);
  await expect(page.getByRole("combobox",{name:"Anlageklasse",exact:true})).toHaveValue("");const state=await current(page,info,"f010-no-decision");expect(state.depot[0].classificationStatus).toBe("unresolved");
  await nav(page,"Depotcheck");const actual=await house(await depotHouse(page),[0,0,0,0,0],10000,10000);const output=await outputs(page,info,[0,0,0,0,0],10000,10000);
  await page.reload();await open(page,c);expect((await current(page,info,"f010-no-decision-reload")).depot[0].classificationStatus).toBe("unresolved");expect(errors).toEqual([]);await emit(page,info,"f010-no-decision",{state,actual,output,errors});
});

test("F010 multiple depots, same name and WKN; catalogue mixed holding protected and independent Active/Preferred",async({page},info)=>{
  const c=classificationCase();c.advisory.liquidAssets=2000;c.depotAccounts.push({...c.depotAccounts[0],id:"classification-depot-B",name:"Synthetisches Depot B"});
  c.depot.push({...c.depot[0],id:"classification-holding-B",depotId:c.depotAccounts[1].id,value:6000});
  c.depot.push(classifiedHolding(c,{id:"classification-catalog",productId:"ps-ausgewogen",name:"Synthetischer Produktmix"}));
  c.plans[0].total=5000;c.plans[0].capitalMode="manual";c.plans[0].depotHoldingIds=[c.depot[0].id,c.depot[1].id];c.plans[0].preferred=false;
  c.plans.push({...structuredClone(c.plans[0]),id:"classification-preferred",name:"Klassifikation Ziel",preferred:true,total:3000,depotHoldingIds:[c.depot[1].id,c.depot[2].id]});
  const errors=monitor(page);await seed(page,[c]);await open(page,c);const selects=page.getByRole("combobox",{name:"Anlageklasse",exact:true});await expect(selects.nth(2)).toBeDisabled();await expect(selects.nth(2)).toHaveValue("catalog");
  await selects.nth(0).selectOption("Substanzwerte");await save(page);const stored=(await data(page))[0];expect(stored.depot[1]).toEqual(c.depot[1]);expect(stored.depot[2]).toEqual(c.depot[2]);expect(stored.depot[0].wkn).toBe(c.depot[1].wkn);
  await nav(page,"Strukturplanung");await page.getByRole("button",{name:"Vermögensstruktur",exact:true}).click();const h=page.locator(".house-view");await h.getByRole("tab",{name:"IST",exact:true}).click();const ist=await house(h,[2000,5500,14500,0,0],6000,28000);
  await h.getByRole("tab",{name:"PLAN",exact:true}).click();const plan=await house(h,[5000,0,10000,0,0],6000,21000);
  await h.getByRole("tab",{name:"ZIELPLAN",exact:true}).click();const target=await house(h,[3000,5500,4500,0,0],6000,19000);await screenshot(page,info,"f010-f023-mixed-target",".house-view");
  await situation(page);await page.locator(".wizard-steps").getByRole("button").last().click();await house(page.locator(".result-page .house-view"),[3000,5500,4500,0,0],6000,19000);
  const output=await outputs(page,info,[3000,5500,4500,0,0],6000,19000,true);expect(errors).toEqual([]);await emit(page,info,"f010-multiple-depots",{input:c,stored,ist,plan,target,output,errors});
});

for(const schema of [10,11])for(const value of ["Krypto","",42])test(`F023 schema ${schema} class ${JSON.stringify(value)} – import/restore reject; P1 originals/backups/neighbors survive`,async({page},info)=>{
  const bad=invalidClassification(value,schema),owner=classificationCase("classification-owner"),neighbor=classificationCase("classification-neighbor");owner.versions=[{id:"classification-bad-snapshot",label:"Ungültige Klassifikation",createdAt:owner.createdAt,snapshot:caseSnapshot(bad)}];
  const errors=monitor(page);await seed(page,[owner,neighbor]);await open(page,owner);const active=await current(page,info,"f023-before"),before=await raw(page),dialogs:string[]=[];
  page.on("dialog",async d=>{dialogs.push(d.message());await d.accept();});await upload(page,bad);await expect.poll(()=>dialogs.length).toBe(1);expect(dialogs[0]).toBe(CLASSIFICATION_ERROR);expect(await raw(page)).toBe(before);expect(await current(page,info,"f023-import-rejected")).toEqual(active);
  await page.getByRole("button",{name:"Wiederherstellen",exact:true}).click();await expect.poll(()=>dialogs.length).toBe(3);expect(dialogs[2]).toBe(CLASSIFICATION_ERROR);expect(await raw(page)).toBe(before);expect(await current(page,info,"f023-restore-rejected")).toEqual(active);
  await seed(page,[bad,neighbor]);const original=await raw(page);await nav(page,"Beratungsfälle");await expect(page.getByRole("button",{name:bad.advisory.caseName,exact:false})).toHaveCount(0);await open(page,neighbor);await save(page);
  expect((await data(page)).find(x=>x.id===bad.id)).toEqual(bad);const backups=await page.evaluate(prefix=>Object.entries(localStorage).filter(([k])=>k.startsWith(prefix)),RECOVERY_PREFIX);expect(backups).toHaveLength(1);expect(backups[0][1]).toBe(original);await save(page);expect(await page.evaluate(prefix=>Object.entries(localStorage).filter(([k])=>k.startsWith(prefix)),RECOVERY_PREFIX)).toEqual(backups);
  neighborUnchanged((await data(page)).find(x=>x.id===neighbor.id),neighbor);expect(errors).toEqual([]);await emit(page,info,"f023-rejections",{input:bad,owner,before,active,dialogs,original,backups,after:await raw(page),errors});
});

test("F010/F023 absent preferred: IST/PLAN available, no target/export/print fallback",async({page},info)=>{
  const c=classificationCase();c.depot[0]=classifiedHolding(c);c.plans[0].preferred=false;await seed(page,[c]);await open(page,c);await nav(page,"Strukturplanung");await page.getByRole("button",{name:"Vermögensstruktur",exact:true}).click();const h=page.locator(".house-view");
  for(const name of ["IST","PLAN"]){await h.getByRole("tab",{name,exact:true}).click();await house(h,[0,0,10000,0,0],0,10000);}
  await h.getByRole("tab",{name:"ZIELPLAN",exact:true}).click();await expect(h.locator(".wealth-house")).toHaveCount(0);await expect(h).toContainText("Keine bevorzugte Zielvariante");
  await nav(page,"Ergebnis & Export");for(const name of [/Excel-Arbeitsmappe/,/Kundenübersicht/,/Interne Arbeitsunterlage/])await expect(page.getByRole("button",{name})).toBeDisabled();await expect(page.locator(".print-document")).toHaveCount(0);await emit(page,info,"f010-no-preferred",{input:c,actual:await current(page,info,"f010-no-preferred")});
});

test("F010 Depotcheck manual choice is explicit and changes only the selected depot identity",async({page},info)=>{
  const c=classificationCase();c.depotAccounts.push({...c.depotAccounts[0],id:"classification-depot-B",name:"Synthetisches Depot B"});c.depot.push({...c.depot[0],id:"classification-holding-B",depotId:c.depotAccounts[1].id,value:6000});
  const errors=monitor(page);await seed(page,[c]);await open(page,c);await nav(page,"Depotcheck");const selects=page.getByRole("combobox",{name:"Anlageklasse",exact:true});await expect(selects.nth(0)).toHaveValue("");await expect(selects.nth(1)).toHaveValue("");
  await selects.nth(0).selectOption("Geldwerte");await save(page);let stored=(await data(page))[0];expect(stored.depot[0]).toEqual(classifiedHolding(c,{assetClass:"Geldwerte"}));expect(stored.depot[1]).toEqual(c.depot[1]);await house(await depotHouse(page),[0,10000,0,0,0],6000,16000);
  await page.getByRole("tab",{name:"Bestand & Transaktionen",exact:true}).click();await selects.nth(1).selectOption("Substanzwerte");await save(page);stored=(await data(page))[0];expect(stored.depot[0]).toEqual(classifiedHolding(c,{assetClass:"Geldwerte"}));expect(stored.depot[1]).toEqual({...c.depot[1],classificationStatus:"mapped",assetClass:"Substanzwerte"});await house(await depotHouse(page),[0,10000,6000,0,0],0,16000);
  expect(errors).toEqual([]);await emit(page,info,"f010-depot-selector",{input:c,stored,errors});
});
