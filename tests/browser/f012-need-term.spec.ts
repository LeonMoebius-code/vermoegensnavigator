import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { f012Case } from "../../scripts/f012-fixtures";
import { previewNeedTermChange } from "../../app/need-term-change";
import { seed, open, nav, raw, data, current, monitor } from "./f021-driver";
import type { AdvisoryCase } from "../../app/case-model";
const row = (page: Page) => page.locator(".need-row-v2").first();
const dialog = (page: Page) => page.getByRole("dialog", { name: "Terminänderung prüfen" });
const accept = (page: Page) => dialog(page).getByRole("button", { name: "Änderung übernehmen und angezeigte Zuordnungen entfernen", exact: true }).click();
async function back(page: Page) { await nav(page, "Strukturplanung"); await page.getByRole("button", { name: "Zurück zur Beratung", exact: false }).click(); await expect(row(page)).toBeVisible(); }
async function ready(page: Page, info: TestInfo, c = f012Case()) {
  const errors = monitor(page); await seed(page, [c]); await open(page, c);
  const before = await current(page, info, "f012-before"); await back(page); return { before, errors };
}
async function propose(page: Page, value = "2029-04-15") {
  await row(page).getByLabel("Konkreter Termin").fill(value);
  await row(page).getByRole("button", { name: "Termin übernehmen", exact: true }).click();
}
async function evidence(info: TestInfo, tag: string, value: unknown) {
  const bytes = JSON.stringify(value); await writeFile(info.outputPath(`${tag}.json`), bytes);
  console.log(`F012_EVIDENCE ${JSON.stringify({ tag, value })}`);
}
async function screenshot(page: Page, info: TestInfo, tag: string) {
  const path = info.outputPath(`${tag}.png`); await page.screenshot({ path, fullPage: true });
  const bytes = await readFile(path); await info.attach(tag, { path, contentType: "image/png" });
  // The unchanged workflow archives diagnostics only on failure. Embed original
  // synthetic success evidence, with digest, in its complete original job log.
  console.log(`F012_IMAGE ${JSON.stringify({ tag, sha256: createHash("sha256").update(bytes).digest("hex"), base64: bytes.toString("base64") })}`);
}

test("F012 typing fragments and invalid inputs never commit or open a dialog; blur leaves a draft", async ({ page }, info) => {
  const { before, errors } = await ready(page, info), originalRaw = await raw(page);
  const years = row(page).getByLabel("Alternativ in Jahren");
  for (const value of ["", "2", "20", "-1", "51", ""]) {
    await years.fill(value); await years.blur(); expect(await dialog(page).count()).toBe(0);
    expect(await raw(page)).toBe(originalRaw); await expect(row(page).locator(".derived-bucket")).toContainText("15.04.2028");
  }
  await expect(row(page).getByRole("button", { name: "Termin übernehmen" })).toBeDisabled();
  // Invalid browser date fragments serialize as empty; this must not fall back to zero years.
  await row(page).getByLabel("Konkreter Termin").fill(""); await row(page).getByLabel("Konkreter Termin").press("Enter");
  await expect(dialog(page)).toHaveCount(0);
  expect(await current(page, info, "draft-not-committed")).toEqual(before); expect(errors).toEqual([]);
});

test("F012 same-year apply and Enter plus blur commit once without warning; unchanged input is inert", async ({ page }, info) => {
  const { before, errors } = await ready(page, info);
  const date = row(page).getByLabel("Konkreter Termin"); await date.fill("2028-05-20"); await date.press("Enter"); await date.blur();
  await expect(row(page).locator(".derived-bucket")).toContainText("20.05.2028"); await expect(dialog(page)).toHaveCount(0);
  await expect(row(page).getByRole("button", { name: "Termin übernehmen" })).toBeDisabled();
  const after = await current(page, info, "same-year-after"); expect(after.plans).toEqual(before.plans); expect(after.versions).toEqual(before.versions);
  expect(after.advisory.needs[0].dueDate).toBe("2028-05-20"); expect(after.advisory.needs[0].years).toBe(1.49); expect(errors).toEqual([]);
});

test("F012 mode switch requires completed apply and preserves F021 reference/date semantics", async ({ page }, info) => {
  const { before, errors } = await ready(page, info);
  await row(page).getByLabel("Alternativ in Jahren").fill("1.49");
  await expect(row(page).locator(".derived-bucket")).toContainText("Termin: 15.04.2028");
  await row(page).getByRole("button", { name: "Termin übernehmen" }).click();
  await expect(row(page).locator(".derived-bucket")).toContainText("Rechnerischer Termin: 15.04.2028"); await expect(dialog(page)).toHaveCount(0);
  await propose(page, "2028-02-29"); await expect(row(page).locator(".derived-bucket")).toContainText("29.02.2028");
  const after = await current(page, info, "modes-after"); expect(after.advisory.needs[0].years).toBe(1.49);
  expect(after.advisory.needs[0].dueDate).toBe("2028-02-29"); expect(after.plans).toEqual(before.plans); expect(errors).toEqual([]);
});

test("F012 complete multi-plan loss preview and cancel preserve the exact active case", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1500 });
  const { before, errors } = await ready(page, info), storageBefore = await raw(page);
  await propose(page); await expect(dialog(page)).toBeVisible();
  for (const text of ["Plan Alpha", "Plan Beta", "Produkt Voll", "Produkt Geteilt", "Produkt Beta", "Zieljahr 2028", "6.000,25", "3.999,75", "8.000,00", "5.000,00", "einstieg-voll", "einstieg-beta", "4 Raten", "monatlich", "2026-11-01"])
    await expect(dialog(page)).toContainText(text);
  const previewText = await dialog(page).innerText();
  await screenshot(page, info, "f012-warning");
  await expect(dialog(page).getByRole("button", { name: "Abbrechen", exact: true })).toBeFocused();
  await dialog(page).getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0); await expect(row(page).getByLabel("Konkreter Termin")).toHaveValue("2028-04-15");
  await screenshot(page, info, "f012-cancel");
  const after = await current(page, info, "cancel-after"); expect(after).toEqual(before); expect(await raw(page)).toBe(storageBefore);
  await evidence(info, "cancel", { before, after, previewText }); expect(errors).toEqual([]);
});

test("F012 active confirmation changes only announced full/partial bindings and entries; save/reopen/import/plan switch", async ({ page }, info) => {
  const { before, errors } = await ready(page, info), storageBefore = await raw(page);
  await propose(page); await accept(page); await expect(dialog(page)).toHaveCount(0);
  await expect(row(page).locator(".derived-bucket")).toContainText("15.04.2029");
  await screenshot(page, info, "f012-confirmed");
  const after = await current(page, info, "confirmed-after");
  const expected = previewNeedTermChange(before, { caseId: before.id, needId: 701, mode: "date", value: "2029-04-15" }).next;
  expect(after).toEqual(expected); expect(await raw(page)).toBe(storageBefore);
  expect(after.plans[0].allocations[0].capitalPotAmounts).toEqual({ "year-2030": 3999.75 });
  expect(after.plans[0].investmentPlans.map(e => e.id)).toEqual(["einstieg-rest"]); expect(after.plans[1].allocations).toEqual([]);
  await back(page); await page.locator(".wizard-head").getByRole("button", { name: "Fall speichern", exact: true }).click();
  const saved = (await data(page))[0]; expect(saved.plans).toEqual(expected.plans); expect(saved.versions).toEqual(before.versions); expect(saved.schemaVersion).toBe(11);
  const savedRaw = await raw(page);
  await page.reload(); await open(page, saved); const reopened = await current(page, info, "reopened");
  // The existing P1 normalizer refreshes only its technical load timestamp.
  expect(reopened).toEqual({ ...saved, updatedAt: reopened.updatedAt });
  expect(Date.parse(reopened.updatedAt)).toBeGreaterThanOrEqual(Date.parse(saved.updatedAt));
  expect(await raw(page)).toBe(savedRaw);
  await nav(page, "Strukturplanung");
  const planSelect = page.locator("select").filter({ has: page.locator('option[value="f012-plan-b"]') }).first();
  await planSelect.selectOption("f012-plan-b");
  const switched = await current(page, info, "plan-switched"); expect(switched.activePlanId).toBe("f012-plan-b"); expect(switched.plans).toEqual(saved.plans);
  const chooser = page.waitForEvent("filechooser"); await page.getByRole("button", { name: /JSON importieren/ }).click();
  await (await chooser).setFiles({ name: "f012-reviewed-case.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ case: switched })) });
  await expect.poll(async () => (await data(page)).length).toBe(2);
  const imported = await current(page, info, "imported"); expect(imported.id).not.toBe(switched.id); expect(imported.plans).toEqual(switched.plans); expect(imported.versions).toEqual(switched.versions);
  await evidence(info, "confirm-save-reopen-import", { before, expected, after, saved, reopened, switched, imported }); expect(errors).toEqual([]);
});

test("F012 relative target-year loss requires one preview; Escape cancels exactly", async ({ page }, info) => {
  const { before, errors } = await ready(page, info);
  await row(page).getByLabel("Alternativ in Jahren").fill("2.5");
  await row(page).getByLabel("Alternativ in Jahren").press("Enter");
  await expect(dialog(page)).toHaveCount(1); await expect(dialog(page)).toContainText("2029-04-15");
  await page.keyboard.press("Escape"); await expect(dialog(page)).toHaveCount(0);
  expect(await current(page, info, "relative-cancel")).toEqual(before); expect(errors).toEqual([]);
});

for (const kind of ["other-need", "unallocated"] as const) test(`F012 ${kind}: year change has no loss and no warning`, async ({ page }, info) => {
  const c = f012Case();
  if (kind === "other-need") c.advisory.needs.push({ ...c.advisory.needs[0], id: 703, purpose: "Weiterer Bedarf im alten Zieljahr" });
  else c.plans.forEach(plan => { plan.allocations = []; plan.investmentPlans = []; });
  const { before, errors } = await ready(page, info, c); await propose(page);
  await expect(row(page).locator(".derived-bucket")).toContainText("15.04.2029"); await expect(dialog(page)).toHaveCount(0);
  const after = await current(page, info, `${kind}-after`); expect(after.plans).toEqual(before.plans); expect(errors).toEqual([]);
});

test("F012 name and amount remain editable independently; existing deletion warning still cancels", async ({ page }, info) => {
  const { before, errors } = await ready(page, info);
  await row(page).getByLabel("Verwendungszweck").fill("Neue Maschine"); await row(page).locator('input[inputmode="decimal"]').fill("31.000");
  await row(page).locator('input[inputmode="decimal"]').blur();
  const dialogs: string[] = []; page.on("dialog", async d => { dialogs.push(d.message()); await d.dismiss(); });
  await row(page).getByRole("button", { name: "×", exact: true }).click();
  expect(dialogs).toHaveLength(1); expect(dialogs[0]).toContain("Produktzuordnung");
  const after = await current(page, info, "other-fields"); expect(after.advisory.needs[0]).toEqual({ ...before.advisory.needs[0], purpose: "Neue Maschine", amount: 31000 });
  expect(after.plans).toEqual(before.plans); expect(errors).toEqual([]);
});

// Exercise the actual production coordinator with controllable concurrent state,
// without introducing test hooks, globals or state bypasses into the product.
test("F012 a concurrent case change refreshes the actual coordinator dialog; stale approval cannot apply", async ({ page }, info) => {
  const errors = monitor(page);
  const result = await build({ stdin: { contents: `
    import React, { useState } from 'react'; import { createRoot } from 'react-dom/client';
    import { useNeedTermChange } from './app/presentation/need-term-editor';
    import { f012Case } from './scripts/f012-fixtures';
    function Harness() { const [c,setC]=useState(f012Case); const t=useNeedTermChange(c,setC);
      return <><button id="propose" onClick={()=>t.request(701,{mode:'date',value:'2029-04-15'})}>Propose</button>
      <button id="concurrent" onClick={()=>setC(old=>{const n=structuredClone(old);n.plans[0].allocations[0].amount=9000;n.plans[0].allocations[0].capitalPotAmounts['year-2028']=9000;return n;})}>Concurrent external update</button>
      <output>{JSON.stringify(c)}</output>{t.feedback}</>; }
    createRoot(document.getElementById('root')).render(<React.StrictMode><Harness/></React.StrictMode>);`, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic" });
  await page.route("**/f012-concurrency", route => route.fulfill({ contentType: "text/html", body: `<div id="root"></div><script>${result.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>` }));
  await page.goto("http://127.0.0.1:4173/f012-concurrency"); await page.locator("#propose").click(); await expect(dialog(page)).toContainText("8.000,00");
  // Simulate a queued external update while the modal prevents ordinary UI edits.
  await page.evaluate(() => (document.querySelector("#concurrent") as HTMLButtonElement).click());
  await expect(dialog(page)).toContainText("zwischenzeitlich geändert"); await expect(dialog(page)).toContainText("9.000,00");
  let state = JSON.parse(await page.locator("output").innerText()) as AdvisoryCase; expect(state.advisory.needs[0].dueDate).toBe("2028-04-15");
  expect(state.plans[0].allocations[0].amount).toBe(9000);
  await accept(page); await expect(dialog(page)).toHaveCount(0);
  await expect.poll(async () => JSON.parse(await page.locator("output").innerText()).advisory.needs[0].dueDate).toBe("2029-04-15");
  state = JSON.parse(await page.locator("output").innerText()); expect(state.advisory.needs[0].dueDate).toBe("2029-04-15");
  expect(state.plans[0].allocations.map(a => a.id)).toEqual(["geteilt"]); await evidence(info, "concurrency", state); expect(errors).toEqual([]);
});
