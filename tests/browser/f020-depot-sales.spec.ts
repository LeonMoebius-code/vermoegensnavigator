import { test, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { saleCase, replacementCsv } from "../../scripts/f020-fixtures";
import { controlCase, historyOwner } from "../../scripts/f021-fixtures";
import { nav, raw, data, monitor, seed, open, save, current, excel, emit, RECOVERY_PREFIX } from "./f021-driver";

const saleLabel = "Geplanter Verkauf AUDIT Depot A: AUDIT Position A";
const valueLabel = "Positionswert AUDIT Depot A: AUDIT Position A";
const conflict = (p:Page)=>p.locator(".depot-sale-conflicts");
async function input(p:Page,label:string,amount:number) {
  const field=p.getByLabel(label,{exact:true});await field.fill(String(amount));await field.press("Tab");
}
async function wizard(p:Page) {
  await nav(p,"Strukturplanung");await p.getByRole("button",{name:"← Zurück zur Beratung",exact:true}).click();
  await p.locator(".wizard-steps").getByRole("button").nth(1).click();
}
async function market(p:Page,surface:string,amount:number) {
  if(surface==="wizard") {await wizard(p);const f=p.getByLabel("Aktueller Wert",{exact:true}).nth(0);await f.fill(String(amount));await f.press("Tab");}
  else {await nav(p,"Depotcheck");await input(p,valueLabel,amount);}
}
function checkExcel(w:Awaited<ReturnType<typeof excel>>) {
  expect(w.sheets.Depot.cells).toMatchObject({D2:5000,H2:5000,D3:6000,H3:0});
  expect(w.sheets["Vermögensstruktur"].rows.reduce<number>((s,r)=>s+Number((r as {Betrag:number}).Betrag),0)).toBe(206000);
}
const euroNumber=(text:string)=>Number(text.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", "."));
async function house(p:Page) {
  await nav(p,"Strukturplanung");await p.getByRole("button",{name:"Vermögensstruktur",exact:true}).click();
  const h=p.locator(".house-view"),modes:Record<string,string>={};
  for(const [mode,total] of [["IST","211.000"],["PLAN","206.000"],["ZIELPLAN","206.000"]]) {
    await h.getByRole("tab",{name:mode,exact:true}).click();modes[mode]=await h.innerText();expect(euroNumber(await h.locator(".house-roof strong").innerText())).toBe(Number(total.replace(".","")));
  }
  return modes;
}

// Permanent translation of audit PR #43's F020 persistence assertion, with the
// mandated active conflict solution and real UI/JSON/XLSX/print observations.
for(const surface of ["wizard","depot"]) for(const correction of ["sale","value"]) test(`F020 ${surface} conflict, every save/output path, conscious ${correction} correction`,async({page},info)=>{
  const errors=monitor(page),c=saleCase(),neighbor=controlCase("f020-neighbor");await seed(page,[c,neighbor]);await open(page,c);await save(page);
  const baseline=(await raw(page))!;await market(page,surface,5000);
  await expect(conflict(page)).toBeVisible();await expect(conflict(page)).toContainText("AUDIT Depot A: AUDIT Position A");
  await expect(conflict(page)).toContainText("5.000,00");await expect(conflict(page)).toContainText("8.000,00");
  const warning=await conflict(page).innerText();await page.screenshot({path:info.outputPath(`f020-${surface}-conflict.png`),fullPage:true});
  const downloads:string[]=[];page.on("download",d=>downloads.push(d.suggestedFilename()));
  await page.evaluate(()=>{(window as unknown as {f020Prints:number}).f020Prints=0;window.print=()=>{(window as unknown as {f020Prints:number}).f020Prints++;};});
  await wizard(page);
  // Both wizard save buttons, on different parts of the real UI.
  const wizardSaves=page.getByRole("button",{name:"Fall speichern",exact:true});expect(await wizardSaves.count()).toBe(2);
  for(const b of await wizardSaves.all()){await b.click();expect(await raw(page)).toBe(baseline);}
  // Keep an unrelated unsaved draft edit through every rejection.
  await page.getByLabel("Bezeichnung des Testfalls",{exact:true}).fill("F020 UNGESPEICHERTER ENTWURF");
  await page.locator(".wizard-steps").getByRole("button").nth(5).click();
  await page.getByRole("button",{name:"Vollständigen Fall als JSON",exact:true}).click();
  await nav(page,"Strukturplanung");
  for(const label of ["Version speichern","Fall speichern"]) {await page.getByRole("button",{name:label,exact:true}).click();expect(await raw(page)).toBe(baseline);}
  await nav(page,"Depotcheck");await page.getByRole("button",{name:"Fall speichern",exact:true}).click();expect(await raw(page)).toBe(baseline);
  await expect(page.getByLabel(valueLabel,{exact:true})).toHaveValue("5.000");await expect(page.getByLabel(saleLabel,{exact:true})).toHaveValue("8.000");
  await nav(page,"Ergebnis & Export");await page.getByRole("button",{name:"Version speichern",exact:true}).click();expect(await raw(page)).toBe(baseline);
  for(const label of [/Kundenübersicht/,/Interne Arbeitsunterlage/,/Excel-Arbeitsmappe/,/Vollständige Sicherung/]) {
    const b=page.getByRole("button",{name:label});await expect(b).toBeDisabled();
    // Native disabled control and event-handler guard are both exercised.
    await b.dispatchEvent("click");
  }
  await expect(page.locator(".print-document")).toHaveCount(0);
  expect(await page.evaluate(()=>(window as unknown as {f020Prints:number}).f020Prints)).toBe(0);expect(downloads).toEqual([]);
  expect(await raw(page)).toBe(baseline);
  // This is PR #43's original business assertion applied to the actually saved case.
  const persisted=JSON.parse((await raw(page))!).find((x:{id:string})=>x.id===c.id);
  for(const holding of persisted.depot) expect(holding.plannedSale).toBeLessThanOrEqual(holding.value);
  expect(persisted.versions).toEqual(c.versions);expect(persisted.updatedAt).toBe(JSON.parse(baseline)[0].updatedAt);
  if(correction==="sale") {if(surface==="wizard")await wizard(page);else await nav(page,"Depotcheck");await input(page,saleLabel,5000);}
  else {
    await market(page,surface,10000);await expect(conflict(page)).toHaveCount(0);
    // Value correction is verified independently, then align with exact audit fixture.
    await save(page);expect((await data(page)).find(x=>x.id===c.id)!.depot[0]).toMatchObject({value:10000,plannedSale:8000});
    await input(page,saleLabel,5000);await input(page,valueLabel,5000);
  }
  await expect(conflict(page)).toHaveCount(0);await save(page);
  const depotTotals=await page.locator(".depot-top article strong").allInnerTexts();
  expect(depotTotals.slice(0,2).map(euroNumber)).toEqual([11000,6000]);
  const correctedRaw=(await raw(page))!,stored=JSON.parse(correctedRaw);
  expect(stored.find((x:{id:string})=>x.id===c.id).advisory.caseName).toBe("F020 UNGESPEICHERTER ENTWURF");
  expect(stored.find((x:{id:string})=>x.id===c.id).depot).toEqual([{...c.depot[0],value:5000,plannedSale:5000},c.depot[1]]);
  expect(stored.find((x:{id:string})=>x.id===neighbor.id).advisory).toEqual(neighbor.advisory);
  const first=await excel(page,info,"f020-corrected-before-reload");checkExcel(first);const jsonBefore=await current(page,info,"f020-corrected-json");
  const modes=await house(page);await page.reload();expect(await raw(page)).toBe(correctedRaw);
  const reopened={...c,advisory:{...c.advisory,caseName:"F020 UNGESPEICHERTER ENTWURF"}};await open(page,reopened);
  const jsonAfter=await current(page,info,"f020-reloaded-json");expect(jsonAfter.depot).toEqual(jsonBefore.depot);
  await save(page);const savedAgain=(await raw(page))!;const second=await excel(page,info,"f020-corrected-after-reload");checkExcel(second);
  expect(JSON.parse(savedAgain).find((x:{id:string})=>x.id===c.id).depot).toEqual(jsonBefore.depot);
  // Real successful version path and both native print invocations after correction.
  await page.getByRole("button",{name:"Version speichern",exact:true}).click();const versioned=(await data(page)).find(x=>x.id===c.id)!;
  expect(versioned.versions).toHaveLength(1);expect(versioned.versions[0].snapshot.depot).toEqual(jsonBefore.depot);
  await page.evaluate(()=>{(window as unknown as {f020Prints:number}).f020Prints=0;window.print=()=>{(window as unknown as {f020Prints:number}).f020Prints++;};});
  for(const label of [/Kundenübersicht/,/Interne Arbeitsunterlage/])await page.getByRole("button",{name:label}).click();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {f020Prints:number}).f020Prints)).toBe(2);
  await expect(page.locator(".print-document")).toHaveCount(1);
  await writeFile(info.outputPath("f020-corrected-store.json"),correctedRaw);expect(errors).toEqual([]);
  await emit(page,info,`f020-${surface}-${correction}`,{warning,baseline,correctedRaw,savedAgain,first,second,jsonBefore,jsonAfter,modes,depotTotals,versioned,errors});
});

for(const surface of ["wizard","depot"]) test(`F020 ${surface} direct cap, small sale, safe market reduction and multi-conflict positions`,async({page},info)=>{
  const errors=monitor(page),c=saleCase();await seed(page,[c]);await open(page,c);await market(page,surface,10000);
  await input(page,saleLabel,20000);await expect(page.getByLabel(saleLabel,{exact:true})).toHaveValue("10.000");
  await input(page,saleLabel,2000);await market(page,surface,5000);await expect(conflict(page)).toHaveCount(0);await save(page);
  await page.reload();await open(page,c);const small=await current(page,info,"f020-small-sale");expect(small.depot[0]).toMatchObject({value:5000,plannedSale:2000});
  await nav(page,"Depotcheck");await input(page,saleLabel,4000);await input(page,"Geplanter Verkauf AUDIT Depot B: AUDIT Position B",5000);
  await market(page,surface,3000);
  if(surface==="wizard") {const f=page.getByLabel("Aktueller Wert",{exact:true}).nth(1);await f.fill("2000");await f.press("Tab");}
  else await input(page,"Positionswert AUDIT Depot B: AUDIT Position B",2000);
  await expect(conflict(page).locator("li")).toHaveCount(2);await expect(conflict(page)).toContainText("AUDIT Depot B: AUDIT Position B");
  const before=await raw(page);await save(page);expect(await raw(page)).toBe(before);expect(errors).toEqual([]);
  await emit(page,info,`f020-positive-${surface}`,{small,conflicts:await conflict(page).innerText(),before,errors});
});

for(const surface of ["wizard","depot"]) test(`F020 ${surface} CSV replacement retains its cap and other depot`,async({page},info)=>{
  const errors=monitor(page),c=saleCase(),neighbor=controlCase("csv-neighbor");await seed(page,[c,neighbor]);await open(page,c);
  if(surface==="wizard")await wizard(page);else await nav(page,"Depotcheck");
  if(surface==="depot") {
    const target=page.getByRole("article").filter({has:page.getByRole("textbox",{name:"Depotname",exact:true}).and(page.locator('input[value="AUDIT Depot A"]'))});
    const chooser=page.waitForEvent("filechooser");await target.getByRole("button",{name:"CSV ersetzen",exact:true}).click();
    await(await chooser).setFiles({name:"f020-replacement.csv",mimeType:"text/csv",buffer:Buffer.from(replacementCsv())});
  } else {
    const chooser=page.waitForEvent("filechooser");await page.getByRole("button",{name:"CSV importieren",exact:true}).click();
    await(await chooser).setFiles({name:"f020-replacement.csv",mimeType:"text/csv",buffer:Buffer.from(replacementCsv())});
    // Use the actual preview's replace selector, independently of wizard entry.
    await page.locator(".csv-preview").getByRole("combobox").first().selectOption("audit-depot-A");
  }
  await page.locator(".csv-preview").getByRole("button",{name:"Bestehendes Depot ersetzen",exact:true}).click();await save(page);
  const entries=await data(page),item=entries.find(x=>x.id===c.id)!;expect(item.depot.find(h=>h.depotId==="audit-depot-A")).toMatchObject({value:5000,plannedSale:5000});
  expect(item.depot.find(h=>h.depotId==="audit-depot-B")).toEqual(c.depot[1]);expect(entries.find(x=>x.id===neighbor.id)!.advisory).toEqual(neighbor.advisory);
  expect(errors).toEqual([]);await emit(page,info,`f020-csv-${surface}`,{entries,errors});
});

for(const schema of [10,11]) test(`F020 P1 schema${schema} protects original, full backup and healthy neighbor`,async({page},info)=>{
  const errors=monitor(page),c=saleCase(),neighbor=controlCase("p1-neighbor");Reflect.set(c,"schemaVersion",schema);c.depot[0].value=5000;
  await seed(page,[c,neighbor]);const before=(await raw(page))!;await nav(page,"Beratungsfälle");await expect(page.getByRole("button",{name:c.advisory.caseName,exact:false})).toHaveCount(0);
  await expect(page.locator(".case-store-notice")).toBeVisible();expect(await raw(page)).toBe(before);
  await open(page,neighbor);await save(page);const after=(await raw(page))!,backups=await page.evaluate(prefix=>Object.entries(localStorage).filter(([k])=>k.startsWith(prefix)),RECOVERY_PREFIX);
  expect(backups).toHaveLength(1);expect(backups[0][1]).toBe(before);expect(JSON.parse(backups[0][1])).toEqual([c,neighbor]);
  expect(JSON.parse(after).find((x:{id:string})=>x.id===c.id)).toEqual(c);await save(page);
  expect(await page.evaluate(prefix=>Object.entries(localStorage).filter(([k])=>k.startsWith(prefix)),RECOVERY_PREFIX)).toEqual(backups);
  await page.reload();const reloaded=(await raw(page))!;expect(JSON.parse(reloaded).find((x:{id:string})=>x.id===c.id)).toEqual(c);expect(errors).toEqual([]);
  await emit(page,info,`f020-p1-${schema}`,{before,after,backups,reloaded,errors});
});

for(const mode of ["quota","readback"]) test(`F020 P1 backup ${mode} refuses main mutation`,async({page},info)=>{
  const errors=monitor(page),c=saleCase(),neighbor=controlCase("quota-neighbor");c.depot[0].value=5000;await seed(page,[c,neighbor]);const before=await raw(page);
  await page.evaluate(({prefix,mode})=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith(prefix)){if(mode==="quota")throw new DOMException("synthetic quota","QuotaExceededError");return original.call(this,k,"incomplete");}return original.call(this,k,v);};},{prefix:RECOVERY_PREFIX,mode});
  await open(page,neighbor);await save(page);expect(await raw(page)).toBe(before);await expect(page.locator(".case-store-notice")).toBeVisible();expect(errors).toEqual([]);
  await emit(page,info,`f020-backup-failure-${mode}`,{before,after:await raw(page),errors});
});

for(const valid of [false,true]) test(`F020 actual H3 restore ${valid?"valid":"invalid"} sale snapshot remains opaque until restore`,async({page},info)=>{
  const errors=monitor(page),snapshot=saleCase();if(!valid)snapshot.depot[0].value=5000;
  const owner=historyOwner(snapshot);await seed(page,[owner]);await open(page,owner);const original=await current(page,info,"f020-history-original"),before=await raw(page);
  page.on("dialog",async d=>d.accept());await page.getByRole("article").filter({hasText:"Synthetischer Laufzeitsnapshot"}).getByRole("button",{name:"Wiederherstellen",exact:true}).click();
  const after=await current(page,info,"f020-history-after");expect(after.versions).toEqual(owner.versions);expect(await raw(page)).toBe(before);
  if(valid)expect(after.depot).toEqual(snapshot.depot);else expect(after).toEqual(original);expect(errors).toEqual([]);
  await emit(page,info,`f020-restore-${valid}`,{original,after,before,errors});
});

test("F020 invalid current JSON import is refused without replacing the active case",async({page},info)=>{
  const errors=monitor(page),neighbor=controlCase("json-neighbor"),c=saleCase();c.depot[0].value=5000;await seed(page,[neighbor]);await open(page,neighbor);
  const original=await current(page,info,"f020-json-original"),before=await raw(page);const dialogs:string[]=[];page.on("dialog",async d=>{dialogs.push(d.message());await d.accept();});
  const chooser=page.waitForEvent("filechooser");await page.getByRole("button",{name:/JSON importieren/}).click();await(await chooser).setFiles({name:"f020-invalid.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(c))});
  await expect.poll(()=>dialogs.length).toBe(1);expect(await raw(page)).toBe(before);expect(await current(page,info,"f020-json-after")).toEqual(original);expect(errors).toEqual([]);
});
