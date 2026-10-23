import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";
import { p2ReleaseCase } from "../../scripts/p2-release-fixtures";
import { parseDepotCsv } from "../../app/depot-csv";
import { addDepotAccount } from "../../app/domain/depot/lifecycle";
import { seed, open, nav, current, raw, save, download, monitor } from "./f021-driver";

for (const [volume, liquid, shortfall] of [[40000,100000,10000],[50000,100000,0],[60000,30000,0],[40000,30000,10000],[0,100000,50000]]) {
  test(`F013 active/preferred same plan: ${volume}/${liquid}/${shortfall}`, async ({ page }, info) => {
    const c=p2ReleaseCase();c.plans[0].total=volume;c.advisory.liquidAssets=liquid;
    const errors=monitor(page);await seed(page,[c]);await open(page,c);await nav(page,"Strukturplanung");
    await expect(page.locator(".capital-shortfall")).toHaveCount(shortfall>0?1:0);
    if(shortfall)await expect(page.locator(".capital-shortfall")).toContainText(shortfall.toLocaleString("de-DE"));
    await page.getByRole("button",{name:"← Zurück zur Beratung",exact:true}).click();
    await page.locator(".wizard-steps").getByRole("button",{name:/Ergebnis/}).click();
    await expect(page.locator(".warning-panel")).toHaveCount(shortfall>0?1:0);
    if(shortfall)await expect(page.locator(".warning-panel")).toContainText(`${shortfall.toLocaleString("de-DE")}`);
    expect((await current(page,info,"f013-case")).plans[0].total).toBe(volume);expect(errors).toEqual([]);
  });
}
test("F013 result uses preferred, planner uses active, no fallback without preference",async({page})=>{
  const c=p2ReleaseCase();c.plans.push({...structuredClone(c.plans[0]),id:"other",name:"Andere Variante",total:100000,preferred:true});c.plans[0].preferred=false;
  await seed(page,[c]);await open(page,c);await nav(page,"Strukturplanung");await expect(page.locator(".capital-shortfall")).toHaveCount(1);
  await page.getByRole("button",{name:"← Zurück zur Beratung",exact:true}).click();await page.locator(".wizard-steps").getByRole("button",{name:/Ergebnis/}).click();
  await expect(page.locator(".warning-panel")).toHaveCount(0);
  c.plans.forEach(p=>p.preferred=false);await seed(page,[c]);await open(page,c);
  await page.locator(".wizard-steps").getByRole("button",{name:/Ergebnis/}).click();await expect(page.locator(".warning-panel")).toHaveCount(0);
  await expect(page.locator(".result-page")).toContainText("Keine bevorzugte Zielvariante gewählt");
});
const csv=(name:string)=>`Name;Wert;Anlageklasse\n${name};10000;Substanzwerte`;
function importCase(){const c=p2ReleaseCase();Object.assign(c,addDepotAccount(c,parseDepotCsv(new TextEncoder().encode(csv("Müller AG")).buffer).rows));
  c.depot[0].plannedSale=5000;c.plans[0].depotHoldingIds=[c.depot[0].id];c.plans[0].depotMode="retain";return c;}
for(const route of ["Depotcheck","Ausgangslage"]){
  test(`F008 actual ${route} replacement rejects ambiguous reference loss without changing original or neighbor`,async({page},info)=>{
    const c=importCase(),neighbor=p2ReleaseCase("p2-neighbor");const errors=monitor(page);
    await seed(page,[c,neighbor]);await open(page,c);const before=await current(page,info,"f008-before"),store=await raw(page);
    if(route==="Depotcheck"){await nav(page,"Depotcheck");const event=page.waitForEvent("filechooser");await page.getByRole("button",{name:"CSV ersetzen",exact:true}).first().click();
      await(await event).setFiles({name:"synthetic-ambiguous.csv",mimeType:"text/csv",buffer:Buffer.from(csv("MÃ¼ller AG"))});}
    else {await nav(page,"Strukturplanung");await page.getByRole("button",{name:"← Zurück zur Beratung",exact:true}).click();await page.locator(".wizard-steps").getByRole("button",{name:/Ausgangslage/}).click();
      const event=page.waitForEvent("filechooser");await page.getByRole("button",{name:"Depot-CSV importieren",exact:true}).click();await(await event).setFiles({name:"synthetic-ambiguous.csv",mimeType:"text/csv",buffer:Buffer.from(csv("MÃ¼ller AG"))});}
    await page.getByRole("button",{name:"Bestehendes Depot ersetzen",exact:true}).click();await expect(page.locator(".csv-error")).toContainText("nicht eindeutig zuordenbar");
    expect(await raw(page)).toBe(store);await page.getByRole("button",{name:"Abbrechen",exact:true}).click();expect(await current(page,info,"f008-after")).toEqual(before);
    await page.reload();expect(JSON.parse(await raw(page)||"[]").find((x:{id:string})=>x.id===neighbor.id).plans).toEqual(neighbor.plans);expect(errors).toEqual([]);
  });
}
test("F008 actual Windows-1252 replacement preserves name, sale and remapped selection",async({page},info)=>{
  const c=importCase();await seed(page,[c]);await open(page,c);await nav(page,"Depotcheck");const event=page.waitForEvent("filechooser");
  await page.getByRole("button",{name:"CSV ersetzen",exact:true}).first().click();await(await event).setFiles({name:"synthetic-cp1252.csv",mimeType:"text/csv",buffer:Buffer.from(csv("Müller AG"),"latin1")});
  await expect(page.locator(".csv-preview")).toBeVisible();await page.getByRole("button",{name:"Bestehendes Depot ersetzen",exact:true}).click();await expect(page.locator(".csv-error")).toHaveCount(0);
  await save(page);await page.reload();await open(page,c);const n=await current(page,info,"f008-valid");expect(n.depot[0]).toMatchObject({name:"Müller AG",plannedSale:5000});expect(n.plans[0].depotHoldingIds).toEqual([n.depot[0].id]);
});
test("F024 repeated actual model applications keep both origins and label last-model summary",async({page},info)=>{
  const c=p2ReleaseCase();c.plans[0].total=300000;await seed(page,[c]);await open(page,c);await nav(page,"Strukturplanung");
  for(const risk of [2,3]){
    await page.getByRole("button",{name:"Modellvorlagen",exact:true}).click();
    await page.locator(".model-grid article").filter({hasText:`Modellportfolio RB ${risk}`}).getByRole("button",{name:"Anwendung konfigurieren",exact:true}).click();
    const dialog=page.locator(".model-dialog");await dialog.getByRole("button",{name:/^Aktuellen Plan ergänzen/}).click();
    const amount=dialog.getByRole("textbox",{name:/^Betroffener Betrag/});await amount.fill("100.000");await amount.press("Tab");
    await dialog.getByRole("button",{name:"Ausgewählte Aktion anwenden",exact:true}).click();
  }
  await save(page);const n=await current(page,info,"f024-models");
  expect(n.plans[0].allocations.filter(a=>a.modelId==="rb2").reduce((s,a)=>s+a.amount,0)).toBe(100000);
  expect(n.plans[0].allocations.filter(a=>a.modelId==="rb3").reduce((s,a)=>s+a.amount,0)).toBe(100000);expect(n.plans[0].modelId).toBe("rb3");
  await nav(page,"Strukturplanung");await page.getByRole("button",{name:"Szenarien",exact:true}).click();
  await expect(page.locator(".compare-view")).toContainText("Zuletzt angewendetes Modell");
});
test("F016/F025 actual save/reload, XLSX and both prints preserve zero and mark missing-start draft",async({page},info)=>{
  const c=p2ReleaseCase();c.plans[0].total=100000;c.plans[0].allocations=[{id:"p2-zero",productId:"unifavorit-renten",productName:"SYNTHETISCH Null",amount:100,bucketId:"year10plus",source:"product",solutionId:"funds",capitalPotId:"strategic",capitalPotAmounts:{strategic:0},bucketAmounts:{year10plus:0}}];
  c.plans[0].investmentPlans=[{id:"p2-savings",type:"savings",productId:"unifavorit-renten",productName:"SYNTHETISCH Sparen",contributionAmount:500,frequency:"monthly",startDate:"",note:""}];
  const errors=monitor(page);await seed(page,[c]);await open(page,c);await nav(page,"Strukturplanung");
  await expect(page.locator(".savings-section")).toContainText("Unvollständiger Entwurf – Startdatum fehlt");await save(page);await page.reload();await open(page,c);
  const n=await current(page,info,"f016-zero");expect(n.plans[0].allocations).toEqual(c.plans[0].allocations);expect(n.plans[0].investmentPlans[0].startDate).toBe("");
  const wb=XLSX.read(await download(page,info,/Excel-Arbeitsmappe/,"p2-xlsx"),{type:"buffer"});
  const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets["Investitionspläne"]);expect(rows[0]).toMatchObject({Start:"",Planungsstatus:"Unvollständiger Entwurf – Startdatum fehlt",Sparrate:500});
  const pots=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets["Kapitaltöpfe"]);expect(pots.every(p=>p.Zugeordnet===0)).toBeTruthy();
  await page.evaluate(()=>{window.print=()=>{};});for(const label of [/Kundenübersicht/,/Interne Arbeitsunterlage/]){await page.getByRole("button",{name:label}).click();await expect(page.locator(".print-document")).toContainText("Unvollständiger Entwurf – Startdatum fehlt");}
  expect(errors).toEqual([]);
});
