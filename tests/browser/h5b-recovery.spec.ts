import { test,expect,type Page,type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { CASE_STORAGE_KEY as KEY,RECOVERY_PREFIX } from "../../app/case-storage";
import { caseSnapshot,type AdvisoryCase } from "../../app/case-model";
import { h5bCase,h5bNeighbor,h5bDeadline } from "../../scripts/h5b-fixtures";
const state=(raw:string)=>({cookies:[],origins:[{origin:"http://127.0.0.1:4173",localStorage:[{name:KEY,value:raw}]}]});
const nav=(p:Page,name:string)=>p.getByRole("navigation").getByRole("button",{name}).click();
const stored=(p:Page)=>p.evaluate(k=>localStorage.getItem(k)!,KEY);
async function select(p:Page,c:AdvisoryCase,snapshotId="") {
  await nav(p,"Historische Fälle prüfen");
  await p.getByLabel("Quellfall",{exact:true}).selectOption(c.id);
  await p.getByLabel("Ausgewählter Quellenstand",{exact:true}).selectOption(snapshotId);
  await p.getByLabel("Belegte historische Zeitzone",{exact:true}).selectOption("Europe/Berlin");
  await p.getByRole("button",{name:"Quelle prüfen",exact:true}).click();
}
async function begin(p:Page){await p.getByRole("button",{name:"Original sichern und Entwurf öffnen",exact:true}).click();await expect(p.getByText("Vollständige Originalquelle lokal bytegleich",{exact:false})).toBeVisible();}
async function decide(p:Page,from="year-2027",to="year-2028") {
  const field=p.locator(".h5b-binding").filter({has:p.getByLabel(`Zieltopf h5a-allocation ${from} 1`,{exact:true})});
  await field.getByLabel(`Zieltopf h5a-allocation ${from} 1`,{exact:true}).selectOption(to);
  await field.getByRole("button",{name:"Teilbindung festlegen",exact:true}).click();
  await p.getByLabel("Einzelreferenz h5a-allocation",{exact:true}).selectOption(to);
  await p.getByRole("checkbox",{name:/Abgeleitete Legacy-Bucketbezüge für h5a-allocation/}).check();
  await p.getByLabel("Einstieg h5a-phased",{exact:true}).selectOption(to);
}
async function approve(p:Page){
  await p.getByLabel("Konkrete fachliche Begründung",{exact:true}).fill("Der konkrete historische Bedarf und alle Teilbindungen wurden fachlich geprüft.");
  const ack=p.getByRole("checkbox",{name:/Den konkret ausgewiesenen verbleibenden Planungsbedarf/});if(await ack.count())await ack.check();
  await p.getByRole("button",{name:"Gesamtdiff fachlich bestätigen",exact:true}).click();
  await expect(p.getByRole("button",{name:"Neue geprüfte Fallkopie speichern",exact:true})).toBeEnabled();
}
async function getDownload(p:Page,info:TestInfo){
  const event=p.waitForEvent("download");await p.getByRole("button",{name:"Unveränderte Originalquelle herunterladen",exact:true}).click();
  const d=await event;expect(await d.failure()).toBeNull();const path=info.outputPath(d.suggestedFilename());await d.saveAs(path);return readFile(path,"utf8");
}
function errors(p:Page){const errors:string[]=[];p.on("pageerror",e=>errors.push(e.message));return errors;}

for(const partial of [false,true])test.describe(`H5b ${partial?"Teilbindung":"Vollbindung"}`,()=>{
  const c=h5bCase("h5b-original",partial),snapshot=caseSnapshot(h5bNeighbor());
  c.versions=[{id:"untouched",label:"Unveränderte Historie",createdAt:c.createdAt,snapshot}];
  const raw=JSON.stringify([c,h5bNeighbor()],null,2);
  test.use({storageState:state(raw)});
  test("echter Download, manuelle Entscheidungen, unabhängige Kopie und Reload erhalten Original und Historie",async({page},info)=>{
    const es=errors(page);await page.goto("./");await select(page,c);
    await expect(page.locator(".h5b-view")).toContainText("aktuell geschützt");expect(await getDownload(page,info)).toBe(raw);expect(await stored(page)).toBe(raw);
    await begin(page);await expect(page.getByRole("button",{name:"Gesamtdiff fachlich bestätigen",exact:true})).toBeDisabled();
    await expect(page.getByRole("alert").filter({hasText:"Kopienfreigabe gesperrt"})).toContainText("Teilbindung");
    await page.getByLabel("Teilbetrag h5a-allocation year-2027 1",{exact:true}).fill(partial?"6000.000000000000000001":"10000.000000000000000001");
    await page.getByLabel("Zieltopf h5a-allocation year-2027 1",{exact:true}).selectOption("year-2028");
    await page.locator(".h5b-binding").filter({has:page.getByLabel("Zieltopf h5a-allocation year-2027 1",{exact:true})}).getByRole("button",{name:"Teilbindung festlegen",exact:true}).click();
    await expect(page.locator(".h5b-binding [role=alert]")).toContainText("gerundet");
    await page.getByLabel("Teilbetrag h5a-allocation year-2027 1",{exact:true}).fill(partial?"6000":"10000");
    await decide(page);await expect(page.getByRole("table",{name:"Vollständiger Änderungsvergleich"})).toContainText("year-2028");
    await approve(page);
    // A new unfinished input edit must revoke both the decision and the approval.
    await page.getByLabel("Teilbetrag h5a-allocation year-2027 1",{exact:true}).fill(partial?"6000.0":"10000.0");
    await expect(page.getByRole("button",{name:"Neue geprüfte Fallkopie speichern",exact:true})).toBeDisabled();
    await page.locator(".h5b-binding").filter({has:page.getByLabel("Zieltopf h5a-allocation year-2027 1",{exact:true})}).getByRole("button",{name:"Teilbindung festlegen",exact:true}).click();await approve(page);
    await page.getByRole("button",{name:"Neue geprüfte Fallkopie speichern",exact:true}).click();
    await expect(page.locator(".wizard-head .eyebrow")).toHaveText(c.advisory.caseName);
    const saved=JSON.parse(await stored(page)) as AdvisoryCase[],copy=saved.find(x=>x.id!==c.id&&x.capitalPotRecovery)!;
    expect(copy.id).not.toBe(c.id);expect(saved.find(x=>x.id===c.id)).toEqual(c);expect(saved.some(x=>x.id==="h5b-neighbor")).toBeTruthy();
    expect(copy.plans[0].allocations[0].id).toBe(c.plans[0].allocations[0].id);expect(copy.plans[0].allocations[0].amount).toBe(10000);
    expect(copy.plans[0].allocations[0].capitalPotAmounts).toEqual(partial?{"year-2028":6000,strategic:4000}:{"year-2028":10000});
    expect(copy.plans[0].investmentPlans).toEqual([{...c.plans[0].investmentPlans[0],capitalPotId:"year-2028"}]);expect(copy.versions).toEqual(c.versions);
    const backups=await page.evaluate(prefix=>Object.entries(localStorage).filter(([k])=>k.startsWith(prefix)),RECOVERY_PREFIX);expect(backups.map(([,v])=>v)).toContain(raw);
    const persisted=await stored(page);await page.reload();expect(await stored(page)).toBe(persisted);
    await nav(page,"Beratungsfälle");await page.getByRole("button",{name:new RegExp(c.advisory.caseName)}).click();
    await expect(page.getByText("Der aktuelle Inhalt entspricht der damaligen Kopienfreigabe",{exact:false})).toBeVisible();
    expect(JSON.parse(await stored(page)).find((x:AdvisoryCase)=>x.id===c.id)).toEqual(c);expect(es).toEqual([]);
  });
});

test.describe("H5b gültige ID mit früherer Frist",()=>{
  const c=h5bDeadline(),raw=JSON.stringify([c]);test.use({storageState:state(raw)});
  test("X05 zeigt konkrete letzte Rate und Topffrist; Freigabe bleibt gesperrt",async({page})=>{
    const es=errors(page);await page.goto("./");await select(page,c);await expect(page.locator(".h5b-view")).toContainText("Maßgebliche Frist");await begin(page);await decide(page,"year-2028");
    const block=page.getByRole("alert").filter({hasText:"Kopienfreigabe gesperrt"});await expect(block).toContainText("2028-09-01");await expect(block).toContainText("2028-04-15");await expect(block).toContainText("nicht fristgerecht");
    await page.getByLabel("Konkrete fachliche Begründung",{exact:true}).fill("Ein pauschaler Freigabetext darf die konkrete Fristprüfung nicht umgehen.");
    await expect(page.getByRole("button",{name:"Gesamtdiff fachlich bestätigen",exact:true})).toBeDisabled();expect(await stored(page)).toBe(raw);expect(es).toEqual([]);
  });
});

for(const failure of ["backup-write","backup-read","main-write"] as const)test.describe(`H5b ${failure}`,()=>{
  const c=h5bCase(),raw=JSON.stringify([c,h5bNeighbor()],null,2);test.use({storageState:state(raw)});
  test("tatsächlicher Storagefehler hält Hauptbestand und Original unverändert",async({page})=>{
    const es=errors(page);await page.goto("./");await select(page,c);
    if(failure==="main-write"){await begin(page);await decide(page);await approve(page);}
    await page.evaluate(({failure,key,prefix})=>{
      const set=Storage.prototype.setItem,get=Storage.prototype.getItem;
      Storage.prototype.setItem=function(k,v){if(failure==="backup-write"&&k.startsWith(prefix)||failure==="main-write"&&k===key)throw new DOMException("Synthetischer Schreibfehler","QuotaExceededError");set.call(this,k,v);};
      if(failure==="backup-read")Storage.prototype.getItem=function(k){return k.startsWith(prefix)?"synthetisch fehlerhafte Rückleseprüfung":get.call(this,k);};
    },{failure,key:KEY,prefix:`${RECOVERY_PREFIX}h5b-`});
    await page.getByRole("button",{name:failure==="main-write"?"Neue geprüfte Fallkopie speichern":"Original sichern und Entwurf öffnen",exact:true}).click();
    await expect(page.locator(".h5b-view > [role=alert]")).toBeVisible();expect(await stored(page)).toBe(raw);expect(es).toEqual([]);
    if(failure!=="main-write")await expect(page.getByRole("heading",{name:"3. Fachliche Zuordnungsentscheidungen",exact:true})).toHaveCount(0);
    else expect((await page.evaluate(prefix=>Object.entries(localStorage).filter(([k])=>k.startsWith(prefix)),RECOVERY_PREFIX)).map(([,v])=>v)).toContain(raw);
  });
});

test.describe("H5b historischer Snapshot",()=>{
  const c=h5bNeighbor();c.versions=[{id:"old-version",label:"Historischer H5b-Quellenstand",createdAt:c.createdAt,snapshot:caseSnapshot(h5bCase())}];
  const raw=JSON.stringify([c],null,2);test.use({storageState:state(raw)});
  test("explizit gewählter Snapshot erzeugt neue Kopie mit unveränderter vollständiger Historie",async({page})=>{
    const es=errors(page);await page.goto("./");await select(page,c,"old-version");await expect(page.locator(".h5b-view")).toContainText("Ausdrücklich gewählte historische Version: old-version");
    await begin(page);await decide(page);await approve(page);await page.getByRole("button",{name:"Neue geprüfte Fallkopie speichern",exact:true}).click();
    await expect(page.locator(".wizard-head .eyebrow")).toHaveText("Synthetischer H5b-Originalfall");
    const saved=JSON.parse(await stored(page)) as AdvisoryCase[],copy=saved.find(x=>x.capitalPotRecovery)!;expect(copy.versions).toEqual(c.versions);expect(copy.capitalPotRecovery!.source.snapshotId).toBe("old-version");expect(saved.find(x=>x.id===c.id)).toEqual(c);expect(es).toEqual([]);
  });
});

test.describe("H5b veränderte Quelle",()=>{
  const c=h5bCase(),raw=JSON.stringify([c]);test.use({storageState:state(raw)});
  test("frisch hinzugekommener Nachbar verhindert veraltete Freigabe und bleibt erhalten",async({page})=>{
    const es=errors(page);await page.goto("./");await select(page,c);await begin(page);await decide(page);await approve(page);
    const newer=JSON.stringify([c,h5bNeighbor()]);await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:KEY,raw:newer});
    await page.getByRole("button",{name:"Neue geprüfte Fallkopie speichern",exact:true}).click();await expect(page.locator(".h5b-view")).toContainText("Quellenbestand hat sich geändert");expect(await stored(page)).toBe(newer);expect(es).toEqual([]);
  });
});

test.describe("H5b separate Quelldatei",()=>{
  const c=h5bCase(),raw=JSON.stringify([h5bNeighbor()]);test.use({storageState:state(raw)});
  test("ausdrücklich ausgewählte importierte Datei wird vollständig gesichert und kopiert",async({page},info)=>{
    const es=errors(page);await page.goto("./");await nav(page,"Historische Fälle prüfen");
    const fileBytes=JSON.stringify({exportedAt:"synthetisch",case:c},null,4)+"\n";
    await page.getByLabel("Separate Originaldatei auswählen",{exact:false}).setInputFiles({name:"synthetic-source.json",mimeType:"application/json",buffer:Buffer.from(fileBytes)});
    await page.getByLabel("Quellfall",{exact:true}).selectOption(c.id);await page.getByLabel("Belegte historische Zeitzone",{exact:true}).selectOption("Europe/Berlin");await page.getByRole("button",{name:"Quelle prüfen",exact:true}).click();
    expect(await getDownload(page,info)).toBe(fileBytes);await begin(page);await decide(page);await approve(page);await page.getByRole("button",{name:"Neue geprüfte Fallkopie speichern",exact:true}).click();
    await expect(page.locator(".wizard-head .eyebrow")).toHaveText(c.advisory.caseName);const saved=JSON.parse(await stored(page)) as AdvisoryCase[],copy=saved.find(x=>x.capitalPotRecovery)!;
    expect(copy.capitalPotRecovery!.source.kind).toBe("file");expect(saved).toHaveLength(2);expect(es).toEqual([]);
  });
});

test.describe("H5b semantisch geänderter graphgültiger Fall",()=>{
  const c=h5bCase();c.plans[0].investmentPlans=[];c.advisory.needs.push({id:102,purpose:"bleibt",amount:5000,years:1,dueDate:"2027-12-31"},{id:103,purpose:"weiterhin 2028",amount:10000,years:2,dueDate:"2028-12-31"});
  c.plans[0].allocations[0].amount=25000;c.plans[0].allocations[0].capitalPotAmounts={"year-2027":5000,"year-2028":20000};c.plans[0].allocations[0].bucketAmounts={year3:25000};
  const raw=JSON.stringify([c]);test.use({storageState:state(raw)});
  test("R12 wird auch ohne geschütztes Original oder aktuelle Deckungslücke sichtbar",async({page})=>{
    const es=errors(page);await page.goto("./");await select(page,c);await expect(page.locator(".h5b-view")).toContainText("regulär lesbar");await expect(page.locator(".h5b-view")).toContainText("Gleiche ID, andere Bedarfszugehörigkeit");await begin(page);
    await expect(page.getByRole("alert").filter({hasText:"Kopienfreigabe gesperrt"})).toContainText("Teilbindung");expect(await stored(page)).toBe(raw);expect(es).toEqual([]);
  });
});

test.describe("H5b ungültige Rohmetadaten",()=>{
  const c=h5bCase();Reflect.set(c.advisory,"caseName",{invalid:true});Reflect.set(c.advisory.needs[0],"id",{ambiguous:true});Reflect.set(c.plans[0],"name",{invalid:true});
  const raw=JSON.stringify([c]);test.use({storageState:state(raw)});
  test("geschützte Rohdaten werden ohne React-Fehler diagnostiziert und nicht freigegeben",async({page})=>{
    const es=errors(page);await page.goto("./");await select(page,c);
    await expect(page.locator(".h5b-view")).toContainText("uneindeutige Bedarf-IDs");
    await expect(page.getByRole("button",{name:"Original sichern und Entwurf öffnen",exact:true})).toBeDisabled();expect(await stored(page)).toBe(raw);expect(es).toEqual([]);
  });
});
