import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";
import { caseSnapshot, type PlannerAllocation } from "../../app/case-model";
import { houseProducts, modelPortfolios, managedPortfolios } from "../../app/investment-data";
import { riskCase, chooseRisk, addProduct, productConflict, prints, screenshot } from "./f017-driver";
import { monitor, seed, open, nav, raw, data, current, download, emit, save } from "./f021-driver";

async function workbook(page: Parameters<typeof nav>[0], info: Parameters<typeof download>[1], tag: string) {
  await nav(page,"Ergebnis & Export");const bytes=await download(page,info,/Excel-Arbeitsmappe/,tag),wb=XLSX.read(bytes,{type:"buffer"});
  return {sheetNames:wb.SheetNames,rows:XLSX.utils.sheet_to_json<Record<string,string|number>>(wb.Sheets.Produktrisikoprüfung),cells:Object.fromEntries(Object.entries(wb.Sheets.Produktrisikoprüfung).filter(([k])=>!k.startsWith("!")).map(([k,v])=>[k,(v as XLSX.CellObject).v]))};
}
const rowFor=(page:Parameters<typeof nav>[0],name:string)=>page.locator(".bucket-items > div").filter({has:page.getByLabel(`Kaufbetrag ${name}`,{exact:true})});
const allocation=(id:string,source:PlannerAllocation["source"]="product",amount=10000):PlannerAllocation=>({id:`${id}-${source}`,productId:id,productName:[...houseProducts,...managedPortfolios].find(x=>x.id===id)?.name||"Unbekannter Altbaustein",source,amount,bucketId:"year10plus",solutionId:"mixed",allocationMode:"single",capitalPotId:"strategic",capitalPotAmounts:{strategic:amount},bucketAmounts:{year10plus:amount}});

function unchangedNeighbor(actual: ReturnType<typeof riskCase> | undefined, before: ReturnType<typeof riskCase>) {
  expect(actual).toBeDefined();
  // Existing P1 normalizes technical updatedAt on read/save (same contract as CP0B).
  // All business data, identities, plans, history and every other field stay exact.
  expect({...actual,updatedAt:before.updatedAt}).toEqual(before);
  expect(Date.parse(actual!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(before.updatedAt));
}

// Same seven diagnostic rows and two-pot assertion from #43, strengthened with
// actual result, both print modes, XLSX cells, store and reload assertions.
for(const row of [
  {risk:1,product:"UniOpti4",conflict:false},
  {risk:2,product:"UniRak ESG Konservativ -net- A",conflict:false},
  {risk:1,product:"UniRak ESG Konservativ -net- A",conflict:true},
  {risk:1,product:"UniGlobal",conflict:true},
  {risk:2,product:"UniRak ESG Konservativ -net- A",change:1,conflict:true},
  {risk:1,product:"UniRak ESG Konservativ -net- A",assessment:true,conflict:true},
  {risk:1,product:"Private Select Sicherheit",conflict:true},
] as const)test(`F017 ${row.risk} ${row.product} ${"assessment" in row?"assessment":"manual"} ${"change" in row?"profile-change":""}`,async({page},info)=>{
  const errors=monitor(page),c=riskCase(),neighbor=riskCase("neighbor");await seed(page,[c,neighbor]);await open(page,c);
  await chooseRisk(page,row.risk,"assessment" in row);const added=await addProduct(page,row.product);
  if("change" in row && row.change){await chooseRisk(page,row.change);await nav(page,"Strukturplanung");}
  const planner=await page.locator(".capital-pot-workspace").innerText();
  expect(productConflict(planner)).toBe(row.conflict);
  await expect(rowFor(page,row.product).locator(".product-risk-notice")).toHaveCount(row.conflict?1:0);
  const captured=row.product==="UniRak ESG Konservativ -net- A" && row.risk===1 && !("assessment" in row);
  if(captured)await screenshot(page,info,"f017-planner",".capital-pot-workspace");
  await save(page);const saved=await data(page),stored=saved.find(x=>x.id===c.id)!;
  expect(stored.advisory.risk).toBe("change" in row?row.change:row.risk);expect(stored.advisory.riskSelectionSource).toBe("assessment" in row?"assessment":"manual");
  expect(stored.plans[0].allocations).toHaveLength(1);expect(stored.plans[0].allocations[0].amount).toBe(row.product.startsWith("Private Select")?125000:10000);
  unchangedNeighbor(saved.find(x=>x.id===neighbor.id),neighbor);
  await nav(page,"Strukturplanung");await page.getByRole("button",{name:"← Zurück zur Beratung",exact:true}).click();
  await page.locator(".wizard-steps").getByRole("button").last().click();
  await expect(page.locator(".result-page .product-risk-warnings")).toHaveCount(row.conflict?1:0);
  const beforeReload=await raw(page);await page.reload();expect(await raw(page)).toBe(beforeReload);await open(page,c);
  const actual=await current(page,info,"f017-json");expect(actual.plans).toEqual(stored.plans);expect(actual.advisory).toEqual(stored.advisory);
  await expect(page.locator(".export-view > .no-print .product-risk-warnings")).toHaveCount(row.conflict?1:0);
  const wb=await workbook(page,info,"f017-real-xlsx");expect(wb.rows).toHaveLength(1);
  expect(wb.rows[0]).toMatchObject({Produkt_ID:stored.plans[0].allocations[0].productId,Kaufbetrag:stored.plans[0].allocations[0].amount,Kundenrisikostufe:actual.advisory.risk});
  expect(String(wb.rows[0].Ergebnis)).toContain(row.conflict?"liegt über":"liegt nicht über");
  expect(wb.rows[0].Produktrisikoklasse).toBe([...houseProducts,...managedPortfolios].find(x=>x.id===stored.plans[0].allocations[0].productId)!.risk);
  const print=await prints(page,info,row.conflict,captured);
  if(captured)await screenshot(page,info,"f017-result",".export-view");
  await save(page);expect((await data(page)).find(x=>x.id===c.id)!.plans).toEqual(stored.plans);unchangedNeighbor((await data(page)).find(x=>x.id===neighbor.id),neighbor);
  expect(errors).toEqual([]);await emit(page,info,"f017-matrix",{row,added,planner,actual,wb,print,errors});
});

test("F017 two long-horizon pots remain independently visible; dynamic risk after save/reload",async({page},info)=>{
  const errors=monitor(page),c=riskCase();await seed(page,[c]);await open(page,c);await chooseRisk(page,1);
  await addProduct(page,"UniRak ESG Konservativ -net- A");
  await page.locator(".capital-timeline").getByRole("button").filter({has:page.getByText("2041",{exact:true})}).click();
  await addProduct(page,"UniRak ESG Konservativ -net- A");
  const summary=page.locator(".capital-pot-workspace > .product-risk-warnings");await expect(summary.locator("li")).toHaveCount(2);
  await expect(summary).toContainText("strategic");await expect(summary).toContainText("year-2041");
  expect(productConflict(await page.locator(".capital-pot-workspace").innerText())).toBe(true);
  await save(page);const original=(await data(page))[0];expect(original.plans[0].allocations).toHaveLength(2);
  const first=await workbook(page,info,"f017-two-pots");expect(first.rows).toHaveLength(2);expect(first.rows.every(r=>String(r.Ergebnis).includes("liegt über"))).toBe(true);
  for(const risk of [2,1,2,1] as const){
    await chooseRisk(page,risk);await nav(page,"Strukturplanung");await expect(page.locator(".capital-pot-workspace > .product-risk-warnings li")).toHaveCount(risk===1?2:0);
    await save(page);await page.reload();await open(page,c);const actual=await current(page,info,`f017-cycle-${risk}`);
    expect(actual.plans).toEqual(original.plans);expect(actual.advisory.risk).toBe(risk);
    const wb=await workbook(page,info,`f017-cycle-${risk}`);expect(wb.rows.every(r=>String(r.Ergebnis).includes(risk===1?"liegt über":"liegt nicht über"))).toBe(true);
  }
  expect(errors).toEqual([]);await emit(page,info,"f017-two-pots",{original,first,errors});
});

for(const source of ["default","legacy"] as const)test(`F017 final risk with ${source}, deviating assessment and unknown ID`,async({page},info)=>{
  const c=riskCase();c.advisory.riskSelectionSource=source;c.advisory.riskAssessmentV2.recommendedRisk=5;c.advisory.riskAssessmentV2.lossCapacity=5;
  c.plans[0].allocations=[allocation("urak-konservativ"),allocation("missing")];const errors=monitor(page);await seed(page,[c]);await open(page,c);await nav(page,"Strukturplanung");
  await expect(rowFor(page,"UniRak ESG Konservativ -net- A").locator(".product-risk-notice")).toContainText("Produktrisikoklasse 2 liegt über der verwendeten Kundenrisikostufe 1");
  await expect(rowFor(page,"Unbekannter Altbaustein").locator(".product-risk-notice")).toHaveAttribute("data-risk-status","unknown");
  await save(page);const actual=await current(page,info,"f017-sources");expect(actual.advisory.risk).toBe(1);expect(actual.advisory.riskSelectionSource).toBe(source);
  const wb=await workbook(page,info,"f017-unknown");expect(wb.rows[1].Produktrisikoklasse).toBe("Nicht bestimmbar");expect(wb.rows[1].Ergebnis).toContain("nicht möglich");
  expect(errors).toEqual([]);await emit(page,info,"f017-sources",{source,actual,wb,errors});
});

test("F017 model components, alternate plans, zero preview, preferred-only print",async({page},info)=>{
  const c=riskCase(),model=modelPortfolios[0];c.plans[0].allocations=[allocation("uniopti4")];
  const alternative={...structuredClone(c.plans[0]),id:"alternative",name:"F017 Modellalternative",preferred:false,allocations:model.holdings.map(h=>({...allocation(h.productId,"model",h.weight*1000),modelId:model.id}))};
  alternative.allocations.push({...allocation("urak-konservativ","model",0),modelId:model.id});c.plans.push(alternative);c.activePlanId=alternative.id;
  const errors=monitor(page);await seed(page,[c]);await open(page,c);await nav(page,"Strukturplanung");
  const summary=page.locator(".capital-pot-workspace > .product-risk-warnings");await expect(summary).toContainText(alternative.name);await expect(summary).toContainText("Vorschau ohne Kaufbetrag");
  await save(page);const wb=await workbook(page,info,"f017-models");expect(wb.rows).toHaveLength(model.holdings.length+2);
  for(const h of model.holdings){const actual=wb.rows.find(r=>r.Produkt_ID===h.productId)!;expect(actual.Produktrisikoklasse).toBe([...houseProducts,...managedPortfolios].find(x=>x.id===h.productId)!.risk);expect(actual.Quelle).toBe("model");}
  await expect(page.locator(".export-view > .no-print .product-risk-warnings")).toContainText(alternative.name);
  await prints(page,info,false); // preferred plan contains only RK1; alternative warnings stay in all-plan summary/Excel.
  expect(errors).toEqual([]);await emit(page,info,"f017-models",{wb,errors});
});

for(const risk of [1,2] as const)test(`F017 horizon independent at final risk ${risk}`,async({page},info)=>{
  const c=riskCase();c.advisory.risk=risk;c.advisory.riskSelectionSource="manual";c.advisory.needs.push({id:703,purpose:"Früher Bedarf",amount:10000,years:1});
  const a=allocation("urak-konservativ");a.capitalPotId="year-2027";a.capitalPotAmounts={"year-2027":10000};c.plans[0].allocations=[a];
  await seed(page,[c]);await open(page,c);await nav(page,"Strukturplanung");await page.locator(".capital-timeline").getByRole("button").filter({has:page.getByText("2027",{exact:true})}).click();
  const row=rowFor(page,a.productName);await expect(row).toContainText("Mindesthorizont bis zum frühesten Bedarf prüfen");await expect(row.locator(".product-risk-notice")).toHaveCount(risk===1?1:0);
  await emit(page,info,`f017-horizon-${risk}`,{text:await row.innerText()});
});

test("F017 actual H3 restore re-evaluates final risk and preserves snapshot and neighbor",async({page},info)=>{
  const c=riskCase(),snapshot=riskCase("snapshot"),neighbor=riskCase("history-neighbor");
  c.advisory.risk=2;c.plans[0].allocations=[allocation("urak-konservativ")];snapshot.plans[0].allocations=[allocation("urak-konservativ")];
  c.versions=[{id:"f017-v1",label:"F017 synthetischer Snapshot",createdAt:c.createdAt,snapshot:caseSnapshot(snapshot)}];
  const errors=monitor(page);await seed(page,[c,neighbor]);await open(page,c);await nav(page,"Ergebnis & Export");await expect(page.locator(".print-document .product-risk-warnings")).toHaveCount(0);
  const before=await raw(page);page.on("dialog",async d=>d.accept());await page.getByRole("article").filter({hasText:"F017 synthetischer Snapshot"}).getByRole("button",{name:"Wiederherstellen",exact:true}).click();
  const actual=await current(page,info,"f017-restored");expect(actual.advisory.risk).toBe(1);expect(actual.versions).toEqual(c.versions);expect(await raw(page)).toBe(before);
  await expect(page.locator(".print-document .product-risk-warnings")).toContainText("Produktrisikoklasse 2 liegt über");await save(page);
  const stored=(await data(page)).find(x=>x.id===c.id)!;expect(stored.versions).toEqual(c.versions);unchangedNeighbor((await data(page)).find(x=>x.id===neighbor.id),neighbor);
  await page.reload();await open(page,stored);const reloaded=await current(page,info,"f017-restored-reloaded");expect(reloaded.versions).toEqual(c.versions);expect(reloaded.advisory.risk).toBe(1);
  expect(errors).toEqual([]);await emit(page,info,"f017-h3",{before,actual,reloaded,errors});
});

test("F017 RK3 filter expansion in two pots and removing a current allocation",async({page},info)=>{
  const c=riskCase();await seed(page,[c]);await open(page,c);await chooseRisk(page,1);
  const first=await addProduct(page,"UniGlobal");expect(first.initiallyVisible).toBe(0);
  await page.locator(".capital-timeline").getByRole("button").filter({has:page.getByText("2041",{exact:true})}).click();await addProduct(page,"UniGlobal");
  const warnings=page.locator(".capital-pot-workspace > .product-risk-warnings li");await expect(warnings).toHaveCount(2);
  // Hide RK3 from catalogue; existing positions and their checks remain.
  await page.locator(".catalog-filters select").last().selectOption("1");
  await expect(rowFor(page,"UniGlobal")).toHaveCount(1);await expect(warnings).toHaveCount(2);
  await rowFor(page,"UniGlobal").getByRole("button",{name:"×",exact:true}).click();await expect(warnings).toHaveCount(1);
  const text=await page.locator(".capital-pot-workspace > .product-risk-warnings").innerText();expect(text).toContain("strategic");expect(text).not.toContain("year-2041");
  await save(page);const actual=await current(page,info,"f017-rk3-filter");expect(actual.plans[0].allocations).toHaveLength(1);
  const wb=await workbook(page,info,"f017-rk3-filter");expect(wb.rows[0].Produktrisikoklasse).toBe(3);expect(wb.rows[0].Kundenrisikostufe).toBe(1);
  await emit(page,info,"f017-rk3-filter",{first,text,actual,wb});
});
