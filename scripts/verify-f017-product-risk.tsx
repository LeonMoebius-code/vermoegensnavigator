import assert from "node:assert/strict";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as XLSX from "xlsx";
import { createCase, caseSnapshot, normalizeImportedCase, type PlannerAllocation } from "../app/case-model";
import { houseProducts, managedPortfolios, modelPortfolios } from "../app/investment-data";
import { allocationProductRisk, planProductRisks, productRiskMessage } from "../app/domain/risk/product-risk";
import { ProductRiskWarnings } from "../app/presentation/product-risk-warnings";
import { ExportCenter } from "../app/page";

const allocation = (id: string, source: PlannerAllocation["source"] = "product", amount = 10000): PlannerAllocation => ({
  id: `${source}-${id}`, productId: id, productName: "Historischer Anzeigename", source, amount,
  solutionId: "mixed", bucketId: "year10plus", capitalPotId: "strategic", capitalPotAmounts: { strategic: amount }, allocationMode: "single",
});
const c = createCase(); Object.assign(c.advisory, { caseName: "F017 synthetic", liquidAssets: 200000, reserve: 0, risk: 1, horizon: 20, needs: [] });
const p = c.plans[0]; p.total = 200000; p.preferred = true;
let groups = 0;
function check(name: string, run: () => void) { run(); groups++; console.log(`PASS F017 ${name}`); }
check("real catalogue risk matrix and stable source/ID", () => {
  for (const product of houseProducts) for (const risk of [1,2,3,4,5] as const) {
    const value = allocationProductRisk(allocation(product.id), risk);
    assert.equal(value.productRisk, product.risk); assert.equal(value.status, product.risk > risk ? "conflict" : "clear");
    assert.equal(value.productName, product.name);
  }
  assert.equal(houseProducts.find(x=>x.id==="uniopti4")!.risk,1);
  assert.equal(houseProducts.find(x=>x.id==="urak-konservativ")!.risk,2);
  for (const vv of managedPortfolios) assert.equal(allocationProductRisk(allocation(vv.id,"vv"),1).productRisk,vv.risk);
  assert.equal(allocationProductRisk(allocation("ps-sicherheit","product"),1).status,"unknown");
  assert.equal(allocationProductRisk(allocation("urak-konservativ","vv"),1).status,"unknown");
});
check("actual model components rather than model risk", () => {
  for (const model of modelPortfolios) for (const h of model.holdings) {
    const a = {...allocation(h.productId,"model"),modelId:model.id};
    const actual = [...houseProducts,...managedPortfolios].find(x=>x.id===h.productId)!;
    assert.ok(actual); assert.equal(allocationProductRisk(a,1).productRisk,actual.risk);
  }
  assert.equal(allocationProductRisk(allocation("rb2","model"),1).status,"unknown");
});
check("unknown, malformed and ambiguous risks never invent a rating", () => {
  const a=allocation("missing"); assert.equal(allocationProductRisk(a,1).productRisk,null);
  assert.equal(allocationProductRisk(a,1).status,"unknown");
  for(const risk of [NaN,Infinity,0,-1,6,1.5]) assert.equal(allocationProductRisk(a,1,{products:[{id:a.productId,name:"X",risk}],portfolios:[]}).status,"unknown");
  const entry={id:a.productId,name:"X",risk:2};
  assert.equal(allocationProductRisk({...a,source:"model"},1,{products:[entry],portfolios:[entry]}).status,"unknown");
});
check("final customer risk only, all selection sources, no input mutation", () => {
  p.allocations=[allocation("urak-konservativ")];
  for(const source of ["manual","assessment","default","legacy"] as const) {
    c.advisory.riskSelectionSource=source; c.advisory.riskAssessmentV2.recommendedRisk=5; c.advisory.riskAssessmentV2.lossCapacity=4;
    for(const risk of [1,2,1,3] as const) {c.advisory.risk=risk;const before=JSON.stringify(c);assert.equal(planProductRisks(p,c.advisory.risk)[0].status,risk===1?"conflict":"clear");assert.equal(JSON.stringify(c),before);}
  }
});
check("separate pots, plans and zero-amount preview; live reassessment", () => {
  c.advisory.risk=1;
  c.advisory.needs=[{id:702,purpose:"Synthetisch 2041",amount:20000,years:15}]; c.createdAt="2026-10-15T12:00:00.000Z";
  p.allocations=[{...allocation("urak-konservativ"),capitalPotAmounts:{strategic:5000,"year-2041":5000}},allocation("uniopti4")];
  const second={...p,id:"other",name:"Andere Variante",preferred:false,allocations:[{...allocation("ps-sicherheit","vv",0)}]};
  const html=renderToStaticMarkup(<ProductRiskWarnings plans={[p,second]} advisory={c.advisory} createdAt={c.createdAt}/>);
  assert.match(html,/strategic/); assert.match(html,/year-2041/); assert.match(html,/Andere Variante/); assert.match(html,/Vorschau ohne Kaufbetrag/);
  assert.match(html,/keine Geeignetheitsfreigabe/); assert.doesNotMatch(html,/UniOpti4/);
  c.advisory.risk=2; assert.equal(renderToStaticMarkup(<ProductRiskWarnings plans={[p,second]} advisory={c.advisory} createdAt={c.createdAt}/>),"");
  p.allocations=[]; assert.deepEqual(planProductRisks(p,1),[]);
});
check("normal save/import preserves allocations and opaque snapshots", () => {
  c.advisory.risk=1; p.allocations=[allocation("urak-konservativ")];
  const snapshot=caseSnapshot(c); c.versions=[{id:"v",label:"F017",createdAt:c.createdAt,snapshot}];
  const before=JSON.stringify(c); const normalized=normalizeImportedCase(c,false)!; assert.ok(normalized);
  assert.deepEqual(normalized.plans[0].allocations,p.allocations); assert.equal(normalized.advisory.risk,1);
  assert.deepEqual(normalized.versions[0].snapshot,snapshot); assert.equal(JSON.stringify(c),before);
  assert.equal(planProductRisks(normalized.plans[0],normalized.advisory.risk)[0].status,"conflict");
});
function find(node: ReactNode, text: string): ReactNode | undefined {
  if(Array.isArray(node)) return node.map(n=>find(n,text)).find(Boolean);
  if(!isValidElement<{children?:ReactNode}>(node)) return;
  if(node.type==="button" && renderToStaticMarkup(node).includes(text)) return node;
  return find(node.props.children,text);
}
check("real result/print component and XLSX export remain enabled with conflict", () => {
  XLSX.set_fs(fs);const cwd=process.cwd(),dir=fs.mkdtempSync(join(tmpdir(),"vn-f017-"));
  try {
    process.chdir(dir);const before=JSON.stringify(c);
    const view=ExportCenter({item:c,preferredPlan:p,setItem:()=>{},saveCase:()=>{},exportJson:()=>{},importJson:()=>{}});
    const html=renderToStaticMarkup(view);assert.match(html,/Produktrisikoklasse 2 liegt über der verwendeten Kundenrisikostufe 1/);
    assert.match(html,/<article class="print-document">[\s\S]*Produktbezogene Risikoprüfung/);
    for(const text of ["Kundenübersicht","Interne Arbeitsunterlage","Excel-Arbeitsmappe","Vollständige Sicherung"]) {
      const button=find(view,text);assert.ok(isValidElement<{disabled?:boolean,onClick:()=>void}>(button));assert.equal(Boolean(button.props.disabled),false);
      if(text==="Excel-Arbeitsmappe")button.props.onClick();
    }
    const wb=XLSX.read(fs.readFileSync("F017-synthetic.xlsx"),{type:"buffer"});
    const rows=XLSX.utils.sheet_to_json<Record<string,string|number>>(wb.Sheets.Produktrisikoprüfung);
    assert.equal(rows[0].Produktrisikoklasse,2);assert.equal(rows[0].Kundenrisikostufe,1);assert.equal(rows[0].Produkt_ID,"urak-konservativ");assert.equal(rows[0].Kaufbetrag,10000);
    assert.match(String(rows[0].Ergebnis),/liegt über/);assert.ok(wb.Sheets.Vermögensstruktur);assert.ok(wb.Sheets.Depot);assert.equal(JSON.stringify(c),before);
  } finally {process.chdir(cwd);fs.rmSync(dir,{recursive:true,force:true});}
});
assert.match(productRiskMessage(allocationProductRisk(allocation("uniopti4"),1)),/Nur dieser RK-Vergleich/);
console.log(`F017: ${groups} direct domain/render/export groups passed.`);
