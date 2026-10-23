import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { build } from "esbuild";
import { f026Variants, f026Case } from "../../scripts/f026-fixtures";
import { controlCase, historyOwner } from "../../scripts/f021-fixtures";
import { f012Case } from "../../scripts/f012-fixtures";
import { seed, open, nav, raw, data, current, excel, monitor, save, RECOVERY_PREFIX, emit } from "./f021-driver";
import type { AdvisoryCase } from "../../app/case-model";
const row = (p: Page) => p.locator(".need-row-v2").first();
const dialog = (p: Page) => p.getByRole("dialog", { name: "Terminänderung prüfen" });
const storage = (p: Page) => p.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
async function upload(p: Page, c: AdvisoryCase) {
  await nav(p, "Ergebnis & Export"); const chooser = p.waitForEvent("filechooser");
  await p.getByRole("button", { name: /JSON importieren/ }).click();
  await (await chooser).setFiles({ name: "SYNTHETISCH-f026.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(c)) });
}
async function back(p: Page) {
  await nav(p, "Strukturplanung"); await p.getByRole("button", { name: "Zurück zur Beratung", exact: false }).click();
  await expect(row(p)).toBeVisible();
}
async function checkExcel(p: Page, info: TestInfo, date: string) {
  const w = await excel(p, info, "f026-xlsx");
  expect(w.sheets.Kapitalbedarfe.cells).toMatchObject({ B2: 10000, C2: date, F2: Number(date.slice(0, 4)) });
  expect(w.sheets.Kapitaltöpfe.rows).toEqual(expect.arrayContaining([expect.objectContaining({ Kapitaltopf: String(Number(date.slice(0, 4))), Zielbetrag: 10000 })]));
  return w;
}

for (const v of f026Variants) test(`F026 ${v.tag}: actual JSON import and valid save/reload/XLSX`, async ({ page }, info) => {
  const errors = monitor(page), c = f026Case(v), neighbor = controlCase(`f026-neighbor-${v.tag}`);
  await seed(page, [neighbor]); await open(page, neighbor); const before = await current(page, info, "f026-import-before"), storeBefore = await raw(page);
  const dialogs: string[] = []; page.on("dialog", async d => { dialogs.push(d.message()); await d.accept(); });
  await upload(page, c); await expect.poll(async () => dialogs.length > 0 || (await data(page)).length > 1).toBe(true);
  expect((await data(page)).length > 1).toBe(v.date !== null);
  if (v.date) {
    const imported = (await data(page)).find(x => x.id !== neighbor.id)!;
    expect(imported.id).not.toBe(c.id); expect(imported.advisory.needs).toEqual(c.advisory.needs);
    expect(imported.createdAt).toBe(c.createdAt); expect(imported.versions).toEqual(c.versions);
    await checkExcel(page, info, v.date); await save(page); const saved = (await data(page)).find(x => x.id === imported.id)!;
    expect(saved.advisory.needs).toEqual(c.advisory.needs); const savedRaw = await raw(page);
    await page.reload(); expect(await raw(page)).toBe(savedRaw); await open(page, saved);
    const loaded = await current(page, info, "f026-reloaded");
    expect(loaded.advisory.needs).toEqual(c.advisory.needs); expect(loaded.createdAt).toBe(c.createdAt);
    await back(page); await expect(row(page).locator(".derived-bucket")).toContainText(`Zieljahr ${Number(v.date.slice(0, 4))}`);
  } else {
    expect(dialogs.length).toBeGreaterThan(0); expect(await raw(page)).toBe(storeBefore);
    expect(await current(page, info, "f026-rejected-active")).toEqual(before);
  }
  await emit(page, info, `f026-import-${v.tag}`, { input: c, valid: v.date !== null, dialogs, errors }); expect(errors).toEqual([]);
});

for (const v of f026Variants.filter(v => v.date === null)) test(`F026 ${v.tag}: raw originals, neighbor backup, opaque snapshot/H3 and H5b`, async ({ page }, info) => {
  const errors = monitor(page), c = f026Case(v), neighbor = controlCase(`f026-protected-neighbor-${v.tag}`);
  await seed(page, [c, neighbor]); const original = await raw(page);
  await nav(page, "Beratungsfälle"); await expect(page.getByRole("button", { name: c.advisory.caseName, exact: false })).toHaveCount(0);
  await open(page, neighbor); await save(page);
  expect((await data(page)).find(x => x.id === c.id)).toEqual(c);
  const backups = await page.evaluate(prefix => Object.entries(localStorage).filter(([k]) => k.startsWith(prefix)), RECOVERY_PREFIX);
  expect(backups).toHaveLength(1); expect(backups[0][1]).toBe(original);
  await save(page); expect(await page.evaluate(prefix => Object.entries(localStorage).filter(([k]) => k.startsWith(prefix)), RECOVERY_PREFIX)).toEqual(backups);
  const stored = await raw(page); await page.reload(); expect(await raw(page)).toBe(stored);
  await nav(page, "Historische Fälle prüfen"); await page.getByLabel("Quellfall", { exact: true }).selectOption(c.id);
  await page.getByLabel("Belegte historische Zeitzone", { exact: true }).selectOption("UTC");
  await page.getByRole("button", { name: "Quelle prüfen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Original sichern und Entwurf öffnen", exact: true })).toBeDisabled();
  expect(await raw(page)).toBe(stored);
  await open(page, neighbor); const owner = historyOwner(c); await upload(page, owner);
  await expect.poll(async () => (await data(page)).length).toBe(3);
  const active = await current(page, info, "f026-opaque-snapshot-imported");
  expect(active.id).not.toBe(owner.id); expect(active.versions).toEqual(owner.versions);
  const currentBefore = await current(page, info, "f026-before-restore"), bytesBefore = await storage(page), messages: string[] = [];
  page.on("dialog", async d => { messages.push(d.message()); await d.accept(); });
  await page.getByRole("article").filter({ hasText: "Synthetischer Laufzeitsnapshot" }).getByRole("button", { name: "Wiederherstellen", exact: true }).click();
  expect(await current(page, info, "f026-after-rejected-restore")).toEqual(currentBefore); expect(await storage(page)).toEqual(bytesBefore);
  expect(messages.length).toBeGreaterThan(0); expect((await data(page)).find(x => x.id === c.id)).toEqual(c);
  await emit(page, info, `f026-protected-${v.tag}`, { input: c, backups, currentBefore, messages, errors }); expect(errors).toEqual([]);
});

test("F026 invalid F012 drafts never apply, open loss confirmation or alter existing bindings", async ({ page }, info) => {
  const c = f012Case(), errors = monitor(page); await seed(page, [c]); await open(page, c);
  const before = await current(page, info, "f026-editor-before"), bytes = await raw(page); await back(page);
  const input = row(page).getByLabel("Alternativ in Jahren");
  for (const value of ["7974", "7975", "1000000", "1e308"]) {
    await input.fill(value); await input.press("Enter"); await input.blur();
    await expect(row(page).getByRole("button", { name: "Termin übernehmen", exact: true })).toBeDisabled();
    await expect(row(page).getByRole("alert")).toContainText("0100 und 9999");
    await expect(dialog(page)).toHaveCount(0); await expect(row(page).locator(".derived-bucket")).toContainText("15.04.2028");
    expect(await raw(page)).toBe(bytes);
  }
  for (const value of ["0099-12-31", "10000-01-01"]) {
    await row(page).getByLabel("Konkreter Termin").fill(value); await row(page).getByLabel("Konkreter Termin").press("Enter");
    await expect(row(page).getByRole("button", { name: "Termin übernehmen", exact: true })).toBeDisabled();
    await expect(dialog(page)).toHaveCount(0);
  }
  expect(await current(page, info, "f026-editor-rejected")).toEqual(before); await back(page);
  for (const years of [100, 200]) {
    await input.fill(String(years)); await row(page).getByRole("button", { name: "Termin übernehmen", exact: true }).click();
    await expect(dialog(page)).toBeVisible(); await expect(dialog(page)).toContainText(String(2026 + years));
    await dialog(page).getByRole("button", { name: "Abbrechen", exact: true }).click();
    expect(await current(page, info, `f026-editor-cancel-${years}`)).toEqual(before); await back(page);
  }
  expect(await raw(page)).toBe(bytes); expect(errors).toEqual([]);
});

test("F026 200 years can be committed in the real editor, saved and exported", async ({ page }, info) => {
  const c = f026Case(f026Variants[0]), errors = monitor(page); await seed(page, [c]); await open(page, c); await back(page);
  await row(page).getByLabel("Alternativ in Jahren").fill("200"); await row(page).getByRole("button", { name: "Termin übernehmen", exact: true }).click();
  await expect(row(page).locator(".derived-bucket")).toContainText("2226"); await expect(dialog(page)).toHaveCount(0);
  const after = await current(page, info, "f026-editor-200"); expect(after.advisory.needs[0].years).toBe(200);
  await save(page); await checkExcel(page, info, "2226-10-15"); const stored = await raw(page);
  await page.reload(); expect(await raw(page)).toBe(stored); await open(page, (await data(page))[0]);
  expect((await current(page, info, "f026-editor-200-reload")).advisory.needs[0].years).toBe(200); expect(errors).toEqual([]);
});

test("F026 a changed reference invalidates a pending real F012 approval before any loss", async ({ page }, info) => {
  const errors = monitor(page);
  const harness = await build({ stdin: { contents: `
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import {useNeedTermChange} from './app/presentation/need-term-editor';import {f012Case} from './scripts/f012-fixtures';
    function Harness(){const [c,setC]=useState(f012Case);const t=useNeedTermChange(c,setC);return <>
    <button id="propose" onClick={()=>t.request(701,{mode:'years',value:2.5})}>Propose</button>
    <button id="change-reference" onClick={()=>setC(old=>({...old,createdAt:'9999-12-31'}))}>Change reference</button>
    <output>{JSON.stringify(c)}</output>{t.feedback}</>;}createRoot(document.getElementById('root')).render(<React.StrictMode><Harness/></React.StrictMode>);`,
    resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic" });
  await page.route("**/f026-coordinator", route => route.fulfill({ contentType: "text/html", body: `<div id="root"></div><script>${harness.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>` }));
  await page.goto("http://127.0.0.1:4173/f026-coordinator");
  const before = JSON.parse(await page.locator("output").innerText()); await page.locator("#propose").click(); await expect(dialog(page)).toBeVisible();
  await page.evaluate(() => (document.querySelector("#change-reference") as HTMLButtonElement).click());
  await expect(dialog(page)).toHaveCount(0); await expect(page.getByRole("alert")).toContainText("0100 und 9999");
  expect(JSON.parse(await page.locator("output").innerText())).toEqual({ ...before, createdAt: "9999-12-31" });
  await emit(page, info, "f026-stale-calendar-approval", { before, errors }); expect(errors).toEqual([]);
});
