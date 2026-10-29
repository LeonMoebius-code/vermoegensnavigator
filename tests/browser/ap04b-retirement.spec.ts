import { test, expect, type Page, type Locator, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import * as XLSX from "xlsx";
import { CASE_STORAGE_KEY } from "../../app/case-storage";
import { outputCase, planningCase } from "./fixtures";

const names = ["Defensivere Marktannahme", "Mittlere Marktannahme", "Höhere Marktannahme"];
const button = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
const nav = (p: Page, name: string) => p.locator(".sidebar nav").getByRole("button", { name: new RegExp(name) });
const input = (p: Page, label: string) => p.getByLabel(label, { exact: true });
const model = (p: Page, i = 0, reference = false) => p.getByTestId("capital-results").getByTestId(reference ? "reference-model" : "neutral-model").nth(i);
const metric = (root: Locator, label: string) => root.getByText(label, { exact: true }).locator("..").locator("dd > strong").first();
const state = (p: Page) => p.evaluate(() => ({ local: Object.fromEntries(Object.entries(localStorage)), session: Object.fromEntries(Object.entries(sessionStorage)), cookie: document.cookie, url: location.href }));
async function entry(p: Page) { await p.goto("./");await nav(p,"Altersvorsorge").click();await button(p,"A – Neue Altersvorsorge planen").click(); }
async function a4(p: Page) { await entry(p);await button(p,"A4 Kapitalentwicklung").click(); }
async function zeroForm(p: Page, start="2027-01", end="2027-03") {
  await input(p,"Startmonat des Modells").fill(start);await input(p,"Endmonat des Modells").fill(end);
  await input(p,"Anfangskapital in Euro").fill("0");await input(p,"Eigene monatliche Einzahlung in Euro").fill("100");await input(p,"Modell-Aktienquote in %").fill("100");
  for(const name of names)for(const asset of ["Aktienrendite","Rentenrendite"])await input(p,`${name}: ${asset} p.a. in %`).fill("0");
}
async function calculate(p: Page) { await p.getByLabel("Die sichtbaren neutralen Modellannahmen",{exact:false}).check();await button(p,"Neutrale Kapitalentwicklung berechnen").click(); }
async function noResult(p: Page) { await expect(p.getByTestId("capital-results")).toHaveCount(0);await expect(p.getByLabel("Die sichtbaren neutralen Modellannahmen",{exact:false})).not.toBeChecked(); }
async function picture(p: Page, info: TestInfo, name: string) {
  const bytes=await p.screenshot({animations:"disabled"});await info.attach(name,{body:bytes,contentType:"image/png"});
  console.log(`AP04B_SCREENSHOT ${JSON.stringify({name,sha256:createHash("sha256").update(bytes).digest("hex"),gzipBase64:gzipSync(bytes).toString("base64")})}`);
}

test("A4B-01: three qualitative products, max two, no hidden product simulation", async({page})=>{
  await entry(page);await button(page,"A3 Produktvergleich").click();await expect(page.getByRole("heading",{name:"A3 – Produktvergleich",exact:true})).toBeFocused();
  const cards=page.locator(".retirement-product-grid");await expect(cards.locator(".retirement-product")).toHaveCount(3);
  for(const name of ["Basis","Pro","Garantie"])await expect(cards.getByRole("heading",{name:`UniVorsorge ${name}`,exact:true})).toBeVisible();
  await page.getByLabel("UniVorsorge Basis für Detailvergleich auswählen",{exact:true}).check();await page.getByLabel("UniVorsorge Pro für Detailvergleich auswählen",{exact:true}).check();
  await expect(page.getByLabel("UniVorsorge Garantie für Detailvergleich auswählen",{exact:true})).toBeDisabled();
  await expect(page.getByRole("region",{name:"Qualitative Detailgegenüberstellung"})).toContainText("Kosten noch nicht belastbar");
  await expect(page.locator(".retirement-products")).toContainText("Öffentlich angekündigt");await expect(page.locator(".retirement-products")).toContainText("kein jederzeitiger Kapitalboden");
  await button(page,"A4 Kapitalentwicklung").click();await zeroForm(page);await calculate(page);
  await expect(metric(model(page),"Vollständiger Endwert im gewählten Modell")).toHaveText("300,00 €");
  await button(page,"A3 Produktvergleich").click();await page.getByLabel("UniVorsorge Pro für Detailvergleich auswählen",{exact:true}).uncheck();await page.getByLabel("UniVorsorge Garantie für Detailvergleich auswählen",{exact:true}).check();
  await button(page,"A4 Kapitalentwicklung").click();await noResult(page);await expect(input(page,"Modell-Aktienquote in %")).toHaveValue("100");
  await calculate(page);await expect(metric(model(page),"Vollständiger Endwert im gewählten Modell")).toHaveText("300,00 €");
});
test("A4B-02: neutral January/October/zero examples and cost unknown status", async({page})=>{
  await a4(page);await zeroForm(page,"2027-01","2027-12");await calculate(page);
  for(let i=0;i<3;i++)await expect(metric(model(page,i),"Vollständiger Endwert im gewählten Modell")).toHaveText("1.200,00 €");
  await expect(metric(model(page),"Modellierte Kosteninformation")).toHaveText("Nicht belastbar");
  await expect(model(page)).toContainText("Bruttomodell ohne Kostenabzug");await input(page,"Startmonat des Modells").fill("2027-10");await noResult(page);await calculate(page);
  await expect(metric(model(page),"Eigene Einzahlungen")).toHaveText("300,00 €");await expect(metric(model(page),"Vollständiger Endwert im gewählten Modell")).toHaveText("300,00 €");
  await input(page,"Eigene monatliche Einzahlung in Euro").fill("0");await calculate(page);await expect(metric(model(page),"Vollständiger Endwert im gewählten Modell")).toHaveText("0,00 €");
});
test("A4B-03: three annual scenarios use independent fixed equity oracles", async({page})=>{
  await a4(page);await zeroForm(page,"2027-01","2027-12");await input(page,"Anfangskapital in Euro").fill("1000");await input(page,"Eigene monatliche Einzahlung in Euro").fill("0");
  for(const [i,value] of ["3","6","8"].entries())await input(page,`${names[i]}: Aktienrendite p.a. in %`).fill(value);
  await calculate(page);for(const [i,value] of ["1.030,00 €","1.060,00 €","1.080,00 €"].entries())await expect(metric(model(page,i),"Vollständiger Endwert im gewählten Modell")).toHaveText(value);
});
test("A4B-04: dated stress only hits equity, later own contributions survive", async({page})=>{
  await a4(page);await zeroForm(page);await input(page,"Anfangskapital in Euro").fill("1000");await page.getByLabel("Einmaligen Aktienmarkt-Stress aktivieren",{exact:true}).check();
  await input(page,"Ereignismonat des Aktien-Stress").fill("2027-02");await input(page,"Einmaliger Aktienkursverlust in %").fill("-30");await calculate(page);
  await expect(metric(model(page),"Einmaliger Aktien-Stressverlust")).toHaveText("330,00 €");await expect(metric(model(page),"Eigene Einzahlungen")).toHaveText("300,00 €");
  await expect(metric(model(page),"Vollständiger Endwert im gewählten Modell")).toHaveText("970,00 €");
  await input(page,"Modell-Aktienquote in %").fill("0");await noResult(page);await calculate(page);
  await expect(metric(model(page),"Einmaliger Aktien-Stressverlust")).toHaveText("0,00 €");await expect(metric(model(page),"Vollständiger Endwert im gewählten Modell")).toHaveText("1.300,00 €");
});
test("A4B-05: optional own one-off is dated; editing amount/date removes results",async({page})=>{
  await a4(page);await zeroForm(page);await page.getByLabel("Einmaligen eigenen Beitrag hinzufügen",{exact:true}).check();
  await input(page,"Einmaliger eigener Modellbeitrag in Euro").fill("500");await input(page,"Monat des einmaligen Modellbeitrags").fill("2027-02");await calculate(page);
  await expect(metric(model(page),"Eigene Einzahlungen")).toHaveText("800,00 €");await input(page,"Monat des einmaligen Modellbeitrags").fill("2027-03");await noResult(page);
  await calculate(page);await input(page,"Einmaliger eigener Modellbeitrag in Euro").fill("250");await noResult(page);
});
test("A4B-06: one hypothetical grant, unfunded reference and partial comparison",async({page})=>{
  await a4(page);await zeroForm(page,"2027-01","2028-12");await page.getByLabel("Einmalige manuelle Zulagenhypothese hinzufügen",{exact:true}).check();
  await input(page,"Betrag der manuellen Zulagenhypothese in Euro").fill("180");await input(page,"Hypothetischer Buchungsmonat der Zulage").fill("2028-05");
  await page.getByLabel("Ungeförderten ETF-/Fondssparplan vergleichen",{exact:true}).check();
  await page.getByLabel("Förderjahr, Betrag und Buchungsmonat dieser einmaligen",{exact:false}).check();await calculate(page);
  await expect(metric(model(page),"Separat spezifizierte Zulagen")).toHaveText("180,00 €");await expect(metric(model(page),"Vollständiger Endwert im gewählten Modell")).toHaveText("2.580,00 €");
  await expect(metric(model(page,0,true),"Separat spezifizierte Zulagen")).toHaveText("0,00 €");await expect(metric(model(page,0,true),"Vollständiger Endwert im gewählten Modell")).toHaveText("2.400,00 €");
  await expect(metric(page.getByTestId("capital-comparison").first(),"Vollständige Differenz Modell minus Referenz")).toHaveText("180,00 €");
  await expect(page.getByTestId("capital-results")).toContainText("Keine Nachsteuer- oder Verfügbarkeitsgleichheit");
  await input(page,"Zulagenabdeckung im Modell").selectOption("unknown");await input(page,"Offene Förderjahre, aufsteigend und kommagetrennt").fill("2028");
  await page.getByLabel("Förderjahr, Betrag und Buchungsmonat dieser einmaligen",{exact:false}).check();await calculate(page);
  await expect(metric(model(page),"Endwert des spezifizierten Szenarios")).toHaveText("2.580,00 €");await expect(metric(model(page),"Vollständiger Endwert im gewählten Modell")).toHaveText("Nicht belastbar");
  await expect(page.getByText("Vollständige Differenz Modell minus Referenz",{exact:true})).toHaveCount(0);await expect(page.getByTestId("capital-comparison").first()).toContainText("keine vollständige Differenz");
  await input(page,"Betrag der manuellen Zulagenhypothese in Euro").fill("200");await noResult(page);await expect(page.getByLabel("Förderjahr, Betrag und Buchungsmonat dieser einmaligen",{exact:false})).not.toBeChecked();
});
test("A4B-07: unconfirmed costs block trajectory; incompatible stages block comparison",async({page})=>{
  await a4(page);await zeroForm(page);await input(page,"Modell-Kostenmodus").selectOption("explicit");await calculate(page);
  await expect(metric(model(page),"Eigene Einzahlungen")).toHaveText("300,00 €");await expect(metric(model(page),"Vollständiger Endwert im gewählten Modell")).toHaveText("Nicht belastbar");
  await page.getByLabel("Ungeförderten ETF-/Fondssparplan vergleichen",{exact:true}).check();await page.getByLabel("Vollständigen hypothetischen Kostenpfad bestätigt; keine Herstellerkosten übernommen",{exact:true}).check();await calculate(page);
  await expect(page.getByTestId("capital-comparison").first()).toContainText("Nicht vollständig vergleichbar");await expect(page.getByText("Vollständige Differenz Modell minus Referenz",{exact:true})).toHaveCount(0);
  await input(page,"Referenz-Kostenmodus").selectOption("explicit");await page.getByLabel("Vollständigen hypothetischen Kostenpfad bestätigt; keine Herstellerkosten übernommen",{exact:true}).check();await page.getByLabel("Referenz: vollständigen hypothetischen Kostenpfad bestätigt; keine Herstellerkosten übernommen",{exact:true}).check();await calculate(page);
  await expect(metric(page.getByTestId("capital-comparison").first(),"Vollständige Differenz Modell minus Referenz")).toHaveText("0,00 €");
});
test("A4B-08: input errors focus fields; undated and dated domain issues remain visible",async({page})=>{
  await a4(page);await zeroForm(page);await input(page,"Anfangskapital in Euro").fill("0,001");await calculate(page);
  await expect(input(page,"Anfangskapital in Euro")).toHaveAttribute("aria-invalid","true");await expect(input(page,"Anfangskapital in Euro")).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("keine Rundung");await input(page,"Anfangskapital in Euro").fill("1000");
  await input(page,"Modell-Kostenmodus").selectOption("explicit");await input(page,"Jährliche modellierte Bestandsminderung in %").fill("100");await page.getByLabel("Vollständigen hypothetischen Kostenpfad bestätigt; keine Herstellerkosten übernommen",{exact:true}).check();await calculate(page);
  const issue=page.getByTestId("capital-results").locator(".retirement-issue").first();await issue.getByText("Prüfdetails",{exact:true}).click();await expect(issue).toContainText("cost_rate_total_loss_timing_required");await expect(issue).toContainText("ohne Monatszuordnung");
  await input(page,"Modell-Kostenmodus").selectOption("gross_unknown");await input(page,"Endmonat des Modells").fill("2027-01");await input(page,"Anfangskapital in Euro").fill("10000000000000");await input(page,"Eigene monatliche Einzahlung in Euro").fill("0");
  await input(page,`${names[0]}: Aktienrendite p.a. in %`).fill("0,0000000000006000000000000016500001");await calculate(page);
  await expect(page.getByTestId("capital-results").locator(".retirement-scenario-result").first()).toContainText("Monat: 2027-01");
  const dated=page.getByTestId("capital-results").locator(".retirement-issue").first();await dated.getByText("Prüfdetails",{exact:true}).click();await expect(dated).toContainText("precision_ambiguous");
});

for(const group of [0,1])test(`A4B-09: relevant visible field group ${group} invalidates synchronously`,async({page})=>{
  await a4(page);await zeroForm(page,"2027-01","2027-12");
  const changes=group===0?[["Startmonat des Modells","2027-02"],["Endmonat des Modells","2028-12"],["Anfangskapital in Euro","50"],["Eigene monatliche Einzahlung in Euro","120"],["Modell-Aktienquote in %","50"],["Ausgabeumfang","compact"]]
    :names.flatMap(name=>[[`${name}: Aktienrendite p.a. in %`,"0,5"],[`${name}: Rentenrendite p.a. in %`,"0,2"]]);
  for(const [label,value] of changes){await calculate(page);await expect(page.getByTestId("capital-results")).toBeVisible();if(label==="Ausgabeumfang")await input(page,label).selectOption(value);else await input(page,label).fill(value);await noResult(page);}
});
for(const group of [0,1])test(`A4B-09b: conditional assumption group ${group} invalidates all confirmations`,async({page})=>{
  await a4(page);await zeroForm(page,"2027-01","2028-12");
  for(const label of ["Einmaligen eigenen Beitrag hinzufügen","Einmaligen Aktienmarkt-Stress aktivieren","Einmalige manuelle Zulagenhypothese hinzufügen","Ungeförderten ETF-/Fondssparplan vergleichen"])await page.getByLabel(label,{exact:true}).check();
  await input(page,"Einmaliger eigener Modellbeitrag in Euro").fill("10");await input(page,"Monat des einmaligen Modellbeitrags").fill("2027-02");
  await input(page,"Ereignismonat des Aktien-Stress").fill("2027-02");await input(page,"Betrag der manuellen Zulagenhypothese in Euro").fill("180");await input(page,"Hypothetischer Buchungsmonat der Zulage").fill("2028-05");
  await input(page,"Zulagenabdeckung im Modell").selectOption("unknown");await input(page,"Modell-Kostenmodus").selectOption("explicit");await input(page,"Referenz-Kostenmodus").selectOption("explicit");
  const changes=group===0?[["Einmaliger eigener Modellbeitrag in Euro","20"],["Monat des einmaligen Modellbeitrags","2027-03"],["Ereignismonat des Aktien-Stress","2027-03"],["Einmaliger Aktienkursverlust in %","-20"],["Jährliche modellierte Bestandsminderung in %","1"]]
    :[["Förderjahr der manuellen Zulagenhypothese","2028"],["Betrag der manuellen Zulagenhypothese in Euro","200"],["Hypothetischer Buchungsmonat der Zulage","2028-06"],["Offene Förderjahre, aufsteigend und kommagetrennt","2027,2028"],["Aktienquote der ungeförderten Referenz in %","50"],["Referenz: jährliche modellierte Bestandsminderung in %","1"]];
  for(const [label,value] of changes){
    await page.getByLabel("Förderjahr, Betrag und Buchungsmonat dieser einmaligen",{exact:false}).check();
    for(const prefix of ["Vollständigen","Referenz: vollständigen"])await page.getByLabel(`${prefix} hypothetischen Kostenpfad bestätigt; keine Herstellerkosten übernommen`,{exact:true}).check();
    await calculate(page);await expect(page.getByTestId("capital-results")).toBeVisible();await input(page,label).fill(value);await noResult(page);
    await expect(page.getByLabel("Förderjahr, Betrag und Buchungsmonat dieser einmaligen",{exact:false})).not.toBeChecked();
    for(const prefix of ["Vollständigen","Referenz: vollständigen"])await expect(page.getByLabel(`${prefix} hypothetischen Kostenpfad bestätigt; keine Herstellerkosten übernommen`,{exact:true})).not.toBeChecked();
  }
});
test("A4B-10: A2 remains yearly, no silent transfer, A/B navigation invalidates A4",async({page})=>{
  await entry(page);await input(page,"Unmittelbare Berechtigung").selectOption("direct_confirmed");await input(page,"Förderregime").selectOption("new_confirmed");await input(page,"Förderfähiger Vertrag").selectOption("single_eligible_confirmed");await input(page,"Kinderzuordnung im Beitragsjahr").selectOption("none_confirmed");
  await button(page,"A2 Sparen & Förderung").click();await input(page,"Förderfähiger Jahres-Eigenbeitrag in Euro").fill("360");await input(page,"Beitragsstand").selectOption("planned");await page.getByLabel("Den angezeigten Jahres-Eigenbeitrag",{exact:false}).check();await button(page,"Fördervorschau prüfen").click();await expect(page.getByTestId("total-grant")).toHaveText("180,00 €");
  await button(page,"A4 Kapitalentwicklung").click();await zeroForm(page,"2027-01","2027-12");await calculate(page);await expect(metric(model(page),"Separat spezifizierte Zulagen")).toHaveText("0,00 €");
  await expect(page.locator(".retirement-capital")).toContainText("A2-Übernahme ist eine spätere Etappe");
  await button(page,"A2 Sparen & Förderung").click();await input(page,"Förderfähiger Jahres-Eigenbeitrag in Euro").fill("600");await expect(page.getByTestId("grant-result")).toHaveCount(0);
  await button(page,"A4 Kapitalentwicklung").click();await noResult(page);await expect(input(page,"Eigene monatliche Einzahlung in Euro")).toHaveValue("100");
  await button(page,"A/B-Auswahl").click();await button(page,"B – Bestehende Riester-Rente prüfen").click();await expect(page.getByRole("heading",{name:"B1 – Bestandsaufnahme",exact:true})).toBeVisible();
  await expect(input(page,"Maßgeblicher RV-Vorjahresbetrag in Euro")).toHaveValue("");
  await button(page,"A/B-Auswahl").click();await button(page,"A – Neue Altersvorsorge planen").click();await button(page,"A4 Kapitalentwicklung").click();await noResult(page);
});
for(const destination of ["Übersicht","Ergebnis & Export","Neustart"])test(`A4B-11: existing discard/cancel guard protects A4 at ${destination}`,async({page})=>{
  await a4(page);await zeroForm(page);await calculate(page);const before=await state(page);
  const action=()=>destination==="Neustart"?button(page,"Spezialentwurf neu starten").click():nav(page,destination).click();
  page.once("dialog",d=>d.dismiss());await action();await expect(metric(model(page),"Vollständiger Endwert im gewählten Modell")).toHaveText("300,00 €");expect(await state(page)).toEqual(before);
  page.once("dialog",d=>d.accept());await action();expect(await state(page)).toEqual(before);
  if(destination!=="Neustart")await nav(page,"Altersvorsorge").click();await button(page,"A – Neue Altersvorsorge planen").click();await button(page,"A4 Kapitalentwicklung").click();await noResult(page);
  await expect(input(page,"Endmonat des Modells")).toHaveValue("2056-12");
});
test("A4B-12: reload loses A3/A4 only, no storage or hidden persistence",async({page})=>{
  await a4(page);const before=await state(page);await zeroForm(page);await calculate(page);expect(await state(page)).toEqual(before);
  page.once("dialog",d=>d.accept());await page.reload();await nav(page,"Altersvorsorge").click();await button(page,"A – Neue Altersvorsorge planen").click();await button(page,"A4 Kapitalentwicklung").click();
  await noResult(page);await expect(input(page,"Endmonat des Modells")).toHaveValue("2056-12");expect(await state(page)).toEqual(before);expect(await page.evaluate(()=>indexedDB.databases())).toEqual([]);
});
test("A4B-13: full calendar compacts display, detail stop does not shorten horizon",async({page})=>{
  await a4(page);await zeroForm(page,"0100-01","9999-12");await input(page,"Eigene monatliche Einzahlung in Euro").fill("0,01");await calculate(page);
  await expect(metric(model(page),"Vollständiger Endwert im gewählten Modell")).toHaveText("1.188,00 €");
  await model(page).getByText(/Kapitalverlauf · 118800 Modellmonate/).click();await expect(model(page).locator("tbody tr")).toHaveCount(12);
  await expect(model(page)).toContainText("kompakte Ausgabe");await input(page,"Ausgabeumfang").selectOption("detailed");await calculate(page);
  await expect(page.getByTestId("capital-results")).toContainText("Kontrollierte Ressourcengrenze");await expect(page.getByTestId("neutral-model")).toHaveCount(0);await expect(input(page,"Endmonat des Modells")).toHaveValue("9999-12");
});
for(const width of [390,1440])test(`A4B-14: ${width}px keyboard, field/result focus, source and overflow evidence`,async({page},info)=>{
  await page.setViewportSize({width,height:1000});await page.goto("./");await nav(page,"Altersvorsorge").focus();await page.keyboard.press("Enter");await button(page,"A – Neue Altersvorsorge planen").focus();await page.keyboard.press("Enter");
  await button(page,"A3 Produktvergleich").focus();await page.keyboard.press("Enter");await expect(page.getByRole("heading",{name:"A3 – Produktvergleich",exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await picture(page,info,`a3-${width}`);
  await button(page,"A4 Kapitalentwicklung").focus();await page.keyboard.press("Enter");await zeroForm(page);await input(page,"Anfangskapital in Euro").fill("1,001");await calculate(page);await expect(input(page,"Anfangskapital in Euro")).toBeFocused();
  await input(page,"Anfangskapital in Euro").fill("0");await calculate(page);await expect(page.locator(".retirement-capital > .retirement-result")).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await picture(page,info,`a4-${width}`);
});
test("A4B-15: existing cases, full JSON/XLSX/print and raw storage remain identical",async({page},info)=>{
  const a=outputCase(),b=planningCase();a.advisory.caseName="AP04b synthetischer Originalfall";b.advisory.caseName="AP04b synthetischer Nachbar";
  for(const item of [a,b])for(const id of item.advisory.modules)item.moduleStates[id]={status:"not_started",currentSlide:0,checklist:{},notes:"",updatedAt:item.updatedAt};
  const raw=JSON.stringify([a,b],null,2);await page.goto("./");await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:CASE_STORAGE_KEY,raw});await page.reload();
  await nav(page,"Beratungsfälle").click();await page.getByRole("button",{name:a.advisory.caseName,exact:false}).click();await nav(page,"Ergebnis & Export").click();
  async function outputs(tag:string){const download=page.waitForEvent("download");await page.getByRole("button",{name:/Vollständige Sicherung/}).click();const jp=info.outputPath(`${tag}.json`);await(await download).saveAs(jp);const json=JSON.parse(await readFile(jp,"utf8"));
    const xd=page.waitForEvent("download");await page.getByRole("button",{name:/Excel-Arbeitsmappe/}).click();const xp=info.outputPath(`${tag}.xlsx`);await(await xd).saveAs(xp);const wb=XLSX.read(await readFile(xp),{type:"buffer"});
    return{case:json.case,sheets:Object.fromEntries(wb.SheetNames.map(n=>[n,XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:null})])),print:await page.locator(".print-document").textContent()};}
  const before=await state(page),exportBefore=await outputs("before");await nav(page,"Altersvorsorge").click();await button(page,"A – Neue Altersvorsorge planen").click();await button(page,"A4 Kapitalentwicklung").click();await zeroForm(page);await calculate(page);
  expect(await state(page)).toEqual(before);page.once("dialog",d=>d.accept());await nav(page,"Ergebnis & Export").click();expect(await outputs("after")).toEqual(exportBefore);expect(await state(page)).toEqual(before);
  expect(await page.evaluate(key=>localStorage.getItem(key),CASE_STORAGE_KEY)).toBe(raw);expect(exportBefore.case.schemaVersion).toBe(11);
});
