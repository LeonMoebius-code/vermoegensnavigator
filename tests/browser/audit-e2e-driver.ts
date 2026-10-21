import type { RiskLevel } from "../../app/navigator-config";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { CASE_STORAGE_KEY as KEY, RECOVERY_PREFIX } from "../../app/case-storage";
import type { AdvisoryCase } from "../../app/case-model";
import { auditCase, saleCase, riskCase, clone, replacementCsv } from "./audit-e2e-fixtures";
export { KEY, RECOVERY_PREFIX };
export const nav = (p: Page, name: string) => p.getByRole("navigation").getByRole("button", { name, exact: false }).click();
export const raw = (p: Page) => p.evaluate(k => localStorage.getItem(k), KEY);
export const data = async (p: Page): Promise<AdvisoryCase[]> => JSON.parse(await raw(p) || "[]");
export const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
export function monitor(p: Page) { const errors: string[] = []; p.on("pageerror", e => errors.push(e.message)); return errors; }
export async function seed(p: Page, cases: AdvisoryCase[]) {
  await p.goto("./");
  // This context belongs solely to this test. No initialization script can overwrite a real reload.
  await p.evaluate(({ key, bytes }) => localStorage.setItem(key, bytes), { key: KEY, bytes: JSON.stringify(cases, null, 2) });
  await p.reload();
}
export async function open(p: Page, c: AdvisoryCase) {
  await nav(p, "Beratungsfälle"); await p.getByRole("button", { name: c.advisory.caseName, exact: false }).click();
  await expect(p.locator(".wizard-head")).toBeVisible();
}
export async function save(p: Page) { await nav(p, "Depotcheck"); await p.getByRole("button", { name: "Fall speichern", exact: true }).click(); }
export async function download(p: Page, info: TestInfo, name: RegExp, tag: string) {
  const event = p.waitForEvent("download"); await p.getByRole("button", { name }).click(); const d = await event;
  expect(await d.failure()).toBeNull(); const target = info.outputPath(`${tag}-${d.suggestedFilename()}`);
  await d.saveAs(target); const bytes = await readFile(target); expect(bytes.length).toBeGreaterThan(0); return bytes;
}
export async function current(p: Page, info: TestInfo, tag: string): Promise<AdvisoryCase> {
  await nav(p, "Ergebnis & Export"); return JSON.parse((await download(p, info, /Vollständige Sicherung/, tag)).toString()).case;
}
export async function excel(p: Page, info: TestInfo, tag: string) {
  await nav(p, "Ergebnis & Export"); const bytes = await download(p, info, /Excel-Arbeitsmappe/, tag);
  const wb = XLSX.read(bytes, { type: "buffer" });
  const sheets = Object.fromEntries(wb.SheetNames.filter(n => ["Fall", "Kapitalbedarfe", "Kapitaltöpfe", "Depot", "Depotübersicht", "Vermögensstruktur"].includes(n) || n.startsWith("Plan "))
    .map(n => [n, { rows: XLSX.utils.sheet_to_json(wb.Sheets[n]), cells: Object.fromEntries(Object.entries(wb.Sheets[n]).filter(([k]) => !k.startsWith("!")).map(([k, v]) => [k, (v as XLSX.CellObject).v])) }]));
  return { sha256: sha(bytes), bytes: bytes.length, sheetNames: wb.SheetNames, sheets };
}
export async function emit(p: Page, info: TestInfo, tag: string, observation: unknown) {
  const path = info.outputPath(`${tag}.json`); const json = JSON.stringify(observation, null, 2);
  await writeFile(path, json); await info.attach(tag, { path, contentType: "application/json" });
  await p.screenshot({ path: info.outputPath(`${tag}.png`), fullPage: true });
  console.log(`AUDIT_EVIDENCE ${tag} ${JSON.stringify(observation)}`);
}
export async function input(p: Page, name: string, amount: number) {
  const field = p.getByLabel(name, { exact: true }); await field.fill(String(amount)); await field.press("Tab"); return field.inputValue();
}
export async function house(p: Page) {
  await nav(p, "Strukturplanung"); await p.getByRole("button", { name: "Vermögensstruktur", exact: true }).click();
  const h = p.locator(".house-view"), modes: Record<string, string> = {};
  for (const mode of ["IST", "PLAN", "ZIELPLAN"]) { await h.getByRole("tab", { name: mode, exact: true }).click(); modes[mode] = await h.innerText(); }
  return modes;
}
export async function saleFlow(p: Page, info: TestInfo) {
  const errors = monitor(p), c = saleCase(), neighbor = auditCase("healthy-neighbor"); await seed(p, [c, neighbor]); await open(p, c);
  await nav(p, "Depotcheck");
  await input(p, "Positionswert AUDIT Depot A: AUDIT Position A", 10000);
  await input(p, "Geplanter Verkauf AUDIT Depot A: AUDIT Position A", 8000);
  await save(p); // Healthy 10k/8k baseline is persisted by the real button first.
  const healthy = await raw(p);
  await input(p, "Positionswert AUDIT Depot A: AUDIT Position A", 5000);
  const ui = { value: await p.getByLabel("Positionswert AUDIT Depot A: AUDIT Position A").inputValue(),
    sale: await p.getByLabel("Geplanter Verkauf AUDIT Depot A: AUDIT Position A").inputValue(), text: await p.locator(".depot-view").innerText() };
  await p.screenshot({ path: info.outputPath("f020-value-edit.png"), fullPage: true });
  const before = await excel(p, info, "f020-before-reload");
  await save(p); const savedRaw = (await raw(p))!; await writeFile(info.outputPath("f020-store-before-reload.json"), savedRaw);
  const saved = JSON.parse(savedRaw) as AdvisoryCase[];
  await p.reload(); const rawAfterReload = await raw(p); await open(p, c);
  const reloaded = await current(p, info, "f020-json-reloaded");
  const modes = await house(p);
  await save(p); const savedAgainRaw = await raw(p); const after = await excel(p, info, "f020-after-reload");
  const observation = { healthy, ui, before, savedRaw, savedHash: sha(savedRaw), rawAfterReload, reloaded, modes,
    savedAgainRaw, after, errors, neighborBefore: neighbor,
    neighborAfter: saved.find(x => x.id === neighbor.id), otherDepot: saved.find(x => x.id === c.id)!.depot[1] };
  await emit(p, info, "f020-main", observation); expect(errors).toEqual([]); return observation;
}
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
export async function addProduct(p: Page, name: string, expanded = false) {
  await nav(p, "Strukturplanung");
  const filter = p.locator(".catalog-filters select").last(); const initialFilter = await filter.inputValue();

  await p.getByPlaceholder("Produkt oder WKN suchen").fill(name);
  const card = p.locator(".product-list article").filter({ has: p.getByText(name, { exact: true }) });
  const initiallyVisible = await card.count();
  if (!initiallyVisible && expanded) await filter.selectOption("4");
  await expect(card).toHaveCount(1); await card.getByRole("button", { name: "＋", exact: true }).click();
  const row = p.locator(".bucket-items > div").filter({ has: p.getByLabel(`Kaufbetrag ${name}`, { exact: true }) });
  // Commit a nonzero allocation through the actual amount editor, independently of its default.
  const amount = row.getByRole("textbox").first(); await amount.fill(name.startsWith("Private Select") ? "125000" : "10000"); await amount.press("Tab");
  return { initialFilter, initiallyVisible, allocationText: await row.innerText(), workspaceText: await p.locator(".capital-pot-workspace").innerText() };
}
export async function riskFlow(p: Page, info: TestInfo, risk: RiskLevel, productName: string, assessment = false, changeRisk?: RiskLevel) {
  const errors = monitor(p), c = riskCase(); await seed(p, [c, auditCase("risk-neighbor")]); await open(p, c);
  await chooseRisk(p, risk, assessment); const added = await addProduct(p, productName, true);
  if (changeRisk) { await chooseRisk(p, changeRisk); await nav(p, "Strukturplanung"); }
  const planner = await p.locator(".capital-pot-workspace").innerText();
  await save(p); const stored = await raw(p); await p.reload(); await open(p, c);
  const item = await current(p, info, "f017-reloaded-json"); const resultText = await p.locator(".export-view").innerText();
  const printText = await p.locator(".print-document").textContent();
  // Invoke actual print-button path but intercept only the native system print dialog.
  await p.evaluate(() => { (window as unknown as { auditPrints: number }).auditPrints = 0; window.print = () => { (window as unknown as { auditPrints: number }).auditPrints++; }; });
  await p.getByRole("button", { name: /Kundenübersicht/ }).click();
  await expect.poll(() => p.evaluate(() => (window as unknown as { auditPrints: number }).auditPrints)).toBe(1);
  const workbook = await excel(p, info, "f017-xlsx");
  const observation = { risk, assessment, changeRisk, productName, added, planner, productWarning: productConflict(planner), stored,
    usedRisk: item.advisory.risk, riskSource: item.advisory.riskSelectionSource, item, resultText, printText, workbook, errors };
  await emit(p, info, "f017", observation); expect(errors).toEqual([]); return observation;
}
