import { expect, type Page, type TestInfo } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
import { createCase, type AdvisoryCase } from "../../app/case-model";
import type { RiskLevel } from "../../app/navigator-config";
import { nav, sha } from "./f021-driver";
export function riskCase(id = "f017"): AdvisoryCase {
  const c = createCase();
  Object.assign(c, { id, createdAt: "2026-10-15T12:00:00.000Z", updatedAt: "2026-10-15T12:00:00.000Z", currentStep: 3 });
  Object.assign(c.advisory, { caseName: `F017 SYNTHETISCH ${id}`, scope: "private", liquidAssets: 200000,
    reserve: 0, horizon: 20, risk: 1, riskSelectionSource: "default",
    needs: [{ id: 702, purpose: "Synthetisch langer Topf", amount: 20000, years: 15 }] });
  Object.assign(c.plans[0], { id: `${id}-plan`, name: "F017 Zielvariante", total: 200000, preferred: true, depotSelectionInitialized: false, depotModeSelectionInitialized: false, allocations: [], investmentPlans: [] });
  c.activePlanId = c.plans[0].id; c.vvFilters.amount = 200000;return c;
}
// F017 UI operations translated from the unchanged diagnostic PR #43.
export const productConflict = (text: string) => /(?:Produkt.{0,30}(?:Risiko|RK).{0,80}(?:Kunden|gewählt|verwendet|über|höher|überschreit)|(?:Risiko|RK).{0,40}(?:Produkt|Baustein).{0,80}(?:Kunden|über|höher|überschreit))/is.test(text);
export async function chooseRisk(p: Page, risk: RiskLevel, assessment = false) {
  if (!(await p.locator(".wizard-steps").count())) { await nav(p, "Strukturplanung"); await p.getByRole("button", { name: "← Zurück zur Beratung", exact: true }).click(); }
  await p.locator(".wizard-steps").getByRole("button", { name: /Ziele & Risiko/ }).click();
  if (!assessment) { await p.locator(".risk-profile-grid button").filter({ hasText: `${risk}/5` }).click(); return; }
  await p.getByRole("button", { name: "Risikoorientierung ermitteln", exact: true }).click();
  const dialog = p.getByRole("dialog", { name: "Risikoorientierung ermitteln" });
  const triangle = dialog.getByRole("img"); const box = (await triangle.boundingBox())!;
  await triangle.click({ position: { x: box.width * 0.15, y: box.height * 0.8 } });
  await dialog.getByRole("button", { name: "Weiter →", exact: true }).click();
  await dialog.locator(".risk-scenario-grid button").first().click();
  await dialog.getByRole("button", { name: "Weiter →", exact: true }).click();
  for (const section of await dialog.locator(".risk-v2-questions section").all()) await section.getByRole("button").first().click();
  await dialog.getByRole("button", { name: "Weiter →", exact: true }).click();
  for (const section of await dialog.locator(".risk-v2-questions section").all()) await section.getByRole("button").first().click();
  await dialog.getByRole("button", { name: "Weiter →", exact: true }).click();
  await dialog.getByRole("button", { name: "Ergebnis übernehmen", exact: true }).click();
}
export async function addProduct(p: Page, name: string, expanded = true) {
  await nav(p, "Strukturplanung");
  const filter = p.locator(".catalog-filters select").last(); const initialFilter = await filter.inputValue();
  await p.getByPlaceholder("Produkt oder WKN suchen").fill(name);
  const card = p.locator(".product-list article").filter({ has: p.getByText(name, { exact: true }) });
  const initiallyVisible = await card.count();
  if (!initiallyVisible && expanded) await filter.selectOption("4");
  await expect(card).toHaveCount(1); await card.getByRole("button", { name: "＋", exact: true }).click();
  const row = p.locator(".bucket-items > div").filter({ has: p.getByLabel(`Kaufbetrag ${name}`, { exact: true }) });
  await p.getByLabel(`Kaufbetrag ${name}`, { exact: true }).fill(name.startsWith("Private Select") ? "125000" : "10000");
  await p.getByLabel(`Kaufbetrag ${name}`, { exact: true }).press("Tab");
  return { initialFilter, initiallyVisible, allocationText: await row.innerText(), workspaceText: await p.locator(".capital-pot-workspace").innerText() };
}
export async function screenshot(p: Page, info: TestInfo, tag: string, selector: string) {
  const bytes=await p.locator(selector).screenshot(); const path=info.outputPath(`${tag}.png`);await writeFile(path,bytes);
  await info.attach(tag,{path,contentType:"image/png"});
  console.log(`F017_SCREENSHOT ${JSON.stringify({tag,sha256:sha(bytes),gzipBase64:gzipSync(bytes).toString("base64")})}`);
}
export async function prints(p: Page, info: TestInfo, conflict: boolean, capture = false) {
  await nav(p,"Ergebnis & Export");
  await p.evaluate(()=>{const w=window as unknown as {f017Prints:string[]};w.f017Prints=[];window.print=()=>w.f017Prints.push(document.body.dataset.printMode!);});
  const results=[];
  for(const [index,label,mode] of [[1,/Kundenübersicht/,"customer"],[2,/Interne Arbeitsunterlage/,"internal"]] as const) {
    await p.getByRole("button",{name:label}).click();
    await expect.poll(()=>p.evaluate(()=>(window as unknown as {f017Prints:string[]}).f017Prints.length)).toBe(index);
    await p.emulateMedia({media:"print"});
    // Retain the mode selected by the real button while inspecting its print media.
    await p.evaluate(m=>document.body.dataset.printMode=m,mode);
    const warning=p.locator(".print-document .product-risk-warnings");
    if(conflict) {await expect(warning).toBeVisible();await expect(warning).toContainText("Produktrisikoklasse");}
    else await expect(warning).toHaveCount(0);
    results.push({mode,text:await warning.allTextContents(),internalVisible:await p.locator(".print-document .internal-only").first().isVisible()});
    if(capture)await screenshot(p,info,`f017-print-${mode}`,".print-document");
    await p.emulateMedia({media:"screen"});
    await expect.poll(()=>p.evaluate(()=>document.body.dataset.printMode)).toBeUndefined();
  }
  expect(await p.evaluate(()=>(window as unknown as {f017Prints:string[]}).f017Prints)).toEqual(["customer","internal"]);
  expect(results[0].internalVisible).toBe(false);expect(results[1].internalVisible).toBe(true);
  return results;
}
