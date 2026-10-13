import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { normalizeImportedCase, duplicateStructurePlan, caseSnapshot, phasedEntryAmounts, type PhasedEntryPlan, planAssetAmounts, buildPlanWealthStructure, type AdvisoryCase } from "../../app/case-model";
import { CASE_STORAGE_KEY } from "../../app/case-storage";
import { depotA, depotB, depotCsv, planningCase, outputCase } from "./fixtures";

import { h4Case } from "../../scripts/h4-fixtures";

const nav = (page: Page, name: string) => page.getByRole("navigation").getByRole("button", { name, exact: false }).click();
const money = (amount: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
const stored = (page: Page): Promise<AdvisoryCase[]> => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), CASE_STORAGE_KEY);

const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
let buildHashes: Record<string, string>;
const buildFiles = ["index.html", "app.js", "styles.css"];
async function productionHashes() {
  return Object.fromEntries(await Promise.all(buildFiles.map(async (file) => [file, digest(await readFile(`.pages-dist/${file}`))])));
}
test.beforeAll(async ({ request }) => {
  buildHashes = await productionHashes();
  for (const file of buildFiles) {
    const response = await request.get(file);
    expect(response.status()).toBe(200);
    expect(digest(await response.body())).toBe(buildHashes[file]);
  }
  expect((await request.get("/app.js")).status()).toBe(404);
});
test.afterAll(async () => {
  expect(await productionHashes()).toEqual(buildHashes);
});

async function openCase(page: Page, name: string, status?: string) {
  await nav(page, "Beratungsfälle");
  let button = page.getByRole("button", { name, exact: false });
  if (status) button = button.filter({ hasText: status });
  await button.click();
  await expect(page.getByRole("button", { name: "Weiter →", exact: true })).toBeVisible();
}

async function seed(page: Page, item: AdvisoryCase) {
  // storageState is applied once when creating the context, before its first page load.
  // No init script: reload must read the state written by the application.
  await page.goto("./");
  await openCase(page, item.advisory.caseName);
}

async function save(page: Page) {
  await nav(page, "Depotcheck");
  await page.getByRole("button", { name: "Fall speichern", exact: true }).click();
}

async function totals(page: Page, actual: number, planned: number) {
  for (const [label, amount] of [["Ist-Depot", actual], ["Plan-Depot", planned]] as const) {
    await expect(page.getByRole("article").filter({ has: page.getByText(label, { exact: true }) }).locator("strong")).toHaveText(money(amount));
  }
}

async function upload(page: Page, button: ReturnType<Page["getByRole"]>, name: string, csv: string) {
  const chooser = page.waitForEvent("filechooser");
  await button.click();
  await (await chooser).setFiles({ name, mimeType: "text/csv", buffer: Buffer.from(csv) });
  const preview = page.locator(".csv-preview");
  await expect(preview.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(preview.getByText("Strukturübersicht erkannt", { exact: true })).toBeVisible();
  return preview;
}

async function download(page: Page, info: TestInfo, label: string, tag: string) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: new RegExp(label) }).click();
  const result = await event;
  expect(await result.failure()).toBeNull();
  const path = info.outputPath(`${tag}-${result.suggestedFilename()}`);
  await result.saveAs(path);
  expect((await stat(path)).size).toBeGreaterThan(0);
  return { path, name: result.suggestedFilename() };
}

async function currentJson(page: Page, info: TestInfo, tag: string) {
  await nav(page, "Ergebnis & Export");
  const result = await download(page, info, "Vollständige Sicherung", tag);
  return { ...result, item: JSON.parse(await readFile(result.path, "utf8")).case as AdvisoryCase };
}

function validRelations(item: AdvisoryCase) {
  expect(new Set(item.depotAccounts.map((d) => d.id)).size).toBe(item.depotAccounts.length);
  expect(new Set(item.depot.map((h) => h.id)).size).toBe(item.depot.length);
  for (const holding of item.depot) expect(item.depotAccounts.some((d) => d.id === holding.depotId)).toBe(true);
  for (const plan of item.plans) {
    for (const id of plan.depotHoldingIds) expect(item.depot.some((h) => h.id === id)).toBe(true);
  }
  expect(new Set(item.plans.map((p) => p.id)).size).toBe(item.plans.length);
  expect(item.plans.filter((p) => p.id === item.activePlanId)).toHaveLength(1);
  expect(item.plans.filter((p) => p.preferred).length).toBeLessThanOrEqual(1);
}

function content(item: AdvisoryCase) {
  const { id, updatedAt, versions, ...rest } = item;
  return rest;
}

// Every test gets a fresh Playwright context. Exactly three independent lifecycles.
test("Depot-Lebenszyklus: CSV, zwei Depots, Verkäufe, Replacement und Reload", async ({ page }, info) => {
  await page.goto("./");
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await nav(page, "Beratungsfälle");
  await expect(page.getByRole("button", { name: /Ersten Beratungsfall anlegen/ })).toBeVisible();
  await page.getByRole("button", { name: /Ersten Beratungsfall anlegen/ }).click();
  await page.getByRole("button", { name: /^P Privatvermögen/ }).click();
  await page.getByRole("button", { name: "Weiter →", exact: true }).click();
  await page.getByLabel("Bezeichnung des Testfalls").fill("CP0B Depot Lebenszyklus");
  await test.step("H1: real React drafts, typing, clipboard, validation, cent storage and reload", async () => {
    const liquid = page.getByRole("textbox", { name: /^Liquide Mittel gesamt/ });
    const reserve = page.getByRole("textbox", { name: /^Sicherheitsreserve/ });
    await liquid.fill("");
    await liquid.pressSequentially("1.000,");
    await expect(liquid).toHaveValue("1.000,");
    await liquid.pressSequentially("50");
    await expect(liquid).toHaveValue("1.000,50");
    await liquid.press("Tab");
    await page.locator(".wizard-head").getByRole("button", { name: "Fall speichern", exact: true }).click();
    expect((await stored(page))[0].advisory.liquidAssets).toBe(1000.5);

    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(() => navigator.clipboard.writeText("100.000,50 €"));
    await liquid.focus();
    await liquid.press("ControlOrMeta+A");
    await liquid.press("ControlOrMeta+V");
    await expect(liquid).toHaveValue("100.000,50 €");
    await liquid.press("Enter");
    await reserve.fill("5.000,25");
    await reserve.press("Tab");
    await page.locator(".wizard-head").getByRole("button", { name: "Fall speichern", exact: true }).click();
    let saved = (await stored(page))[0];
    expect(saved.advisory.liquidAssets).toBe(100000.5);
    expect(saved.advisory.reserve).toBe(5000.25);
    expect(saved.plans[0].total).toBe(100000.5);
    // Multiple fields own independent drafts/errors. Invalid text never reaches storage.
    await liquid.fill("1.000,");
    await reserve.fill("-100");
    await expect(liquid).toHaveAttribute("aria-invalid", "true");
    await expect(liquid).toHaveValue("1.000,");
    await reserve.press("Tab");
    await expect(reserve).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert")).toHaveCount(2);
    await page.locator(".wizard-head").getByRole("button", { name: "Fall speichern", exact: true }).click();
    saved = (await stored(page))[0];
    expect(saved.advisory.liquidAssets).toBe(100000.5);
    expect(saved.advisory.reserve).toBe(5000.25);
    await liquid.fill("100.000,50");
    await liquid.press("Tab");
    await reserve.fill("");
    await reserve.press("Enter");
    await page.locator(".wizard-head").getByRole("button", { name: "Fall speichern", exact: true }).click();
    expect((await stored(page))[0].advisory.reserve).toBe(0);
    await reserve.fill("5.000,25");
    await reserve.press("Tab");
    await page.locator(".wizard-head").getByRole("button", { name: "Fall speichern", exact: true }).click();
    // Reload uses only the app-written case, not another seeded test state.
    await page.reload();
    await openCase(page, "CP0B Depot Lebenszyklus");
    await expect(liquid).toHaveValue("100.000,5");
    await expect(reserve).toHaveValue("5.000,25");
    saved = (await stored(page))[0];
    expect(saved.advisory.liquidAssets - saved.advisory.reserve).toBe(95000.25);
    // Middle-of-text edits retain both raw text and cursor position.
    await liquid.fill("100.000,50");
    await liquid.press("Home");
    await liquid.press("ArrowRight");
    await liquid.pressSequentially("0");
    await expect(liquid).toHaveValue("1000.000,50");
    expect(await liquid.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(2);
    await liquid.press("Escape");
    await expect(liquid).toHaveValue("100.000,5");
    await page.locator(".wizard-steps").getByRole("button", { name: /Kapitalbedarfe/ }).click();
    await page.getByRole("button", { name: /Ersten Kapitalbedarf erfassen/ }).click();
    const need = page.locator(".need-row").getByRole("textbox", { name: /^Betrag/ });
    await need.fill("1.000,50");
    await need.press("Tab");
    await page.locator(".wizard-head").getByRole("button", { name: "Fall speichern", exact: true }).click();
    saved = (await stored(page))[0];
    expect(saved.advisory.needs[0].amount).toBe(1000.5);
    expect(saved.advisory.liquidAssets - saved.advisory.reserve - saved.advisory.needs[0].amount).toBe(93999.75);
    console.log("PASS H1 browser: typing, real clipboard, incomplete/negative rejection, zero, cents and saved reload");
  });
  await nav(page, "Depotcheck");
  let preview = await upload(page, page.getByRole("button", { name: "Depot-CSV importieren", exact: true }), "synthetic-a.csv", depotCsv("A"));
  await expect(preview.locator(".csv-preview-metrics")).toContainText("1Positionen");
  await expect(preview.locator(".csv-preview-metrics")).toContainText(money(10000));
  await preview.getByLabel("Depotname", { exact: true }).fill(depotA);
  await preview.getByRole("button", { name: "Als neues Depot hinzufügen" }).click();
  preview = await upload(page, page.getByRole("button", { name: "Weiteres Depot hinzufügen" }), "synthetic-b.csv", depotCsv("B"));
  await expect(preview.locator(".csv-preview-metrics")).toContainText("2Positionen");
  await expect(preview.locator(".csv-preview-metrics")).toContainText(money(10000));
  await preview.getByLabel("Depotname", { exact: true }).fill(depotB);
  await preview.getByRole("button", { name: "Als neues Depot hinzufügen" }).click();
  await expect(page.getByRole("heading", { name: `${money(20000)} · 2 Depots` })).toBeVisible();
  await expect(page.locator(".holding-card")).toHaveCount(3);
  await test.step("H1: depot cents, bounded sales, readonly aggregate and linked external value", async () => {
    const position = page.getByLabel(`Positionswert ${depotA}: Synthetische Aktie A`, { exact: true });
    const sale = page.getByLabel(`Geplanter Verkauf ${depotA}: Synthetische Aktie A`, { exact: true });
    await position.fill("10.000,75");
    await position.press("Tab");
    await sale.fill("1.000,50");
    await sale.press("Tab");
    await save(page);
    let saved = (await stored(page))[0];
    expect(saved.advisory.depotValue).toBe(20000.75);
    expect(saved.depot.find(h => h.name === "Synthetische Aktie A")).toMatchObject({ value: 10000.75, plannedSale: 1000.5 });
    await sale.fill("99.999,99");
    await sale.press("Enter");
    await save(page);
    expect((await stored(page))[0].depot.find(h => h.name === "Synthetische Aktie A")!.plannedSale).toBe(10000.75);
    await page.getByRole("button", { name: "← Zurück zur Beratung", exact: true }).click();
    await page.locator(".wizard-steps").getByRole("button", { name: /Ausgangslage/ }).click();
    const aggregate = page.getByRole("textbox", { name: /^Wertpapierdepot/ });
    await expect(aggregate).toHaveAttribute("readonly", "");
    await expect(aggregate).toHaveValue("20.000,75");
    await aggregate.focus();
    await aggregate.pressSequentially("9");
    await expect(aggregate).toHaveValue("20.000,75");
    await nav(page, "Strukturplanung");
    const total = page.getByRole("textbox", { name: /^Zu strukturierendes Kapital/ });
    await expect(total).toBeDisabled();
    await expect(total).toHaveValue("100.000,5");
    await page.getByRole("button", { name: "Abweichenden Betrag verwenden", exact: true }).click();
    await total.fill("1.000,");
    await total.press("Tab");
    await expect(total).toHaveAttribute("aria-invalid", "true");
    await page.getByRole("button", { name: "Erfasste Liquidität übernehmen", exact: true }).click();
    await expect(total).toBeDisabled();
    await expect(total).toHaveAttribute("aria-invalid", "false");
    await expect(total).toHaveValue("100.000,5");
    // Return to the established CP0B fixture; its original assertions stay exact.
    await nav(page, "Depotcheck");
    await position.fill("10000");
    await position.press("Tab");
    await sale.fill("0");
    await sale.press("Tab");
    console.log("PASS H1 browser: depot cents, full-sale cap, readonly aggregate and external linked value");
  });
  await page.getByLabel(`Geplanter Verkauf ${depotA}: Synthetische Aktie A`, { exact: true }).fill("2500");
  await page.getByLabel(`Geplanter Verkauf ${depotB}: Synthetische Aktie B`, { exact: true }).fill("6000");
  await page.getByLabel(`Geplanter Verkauf ${depotB}: Synthetische Aktie B`, { exact: true }).press("Tab");
  await totals(page, 20000, 11500);

  await nav(page, "Strukturplanung");
  await page.getByRole("button", { name: "Ändern", exact: true }).click();
  await page.getByRole("combobox", { name: /^Berücksichtigung/ }).selectOption("retain");
  await expect(page.getByRole("checkbox", { name: /Synthetische Aktie A/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Synthetische Aktie B/ })).toBeChecked();
  // Keep a B-only reference to distinguish replacement remapping from the same WKN in A.
  await page.getByRole("checkbox", { name: /Synthetische Aktie A/ }).uncheck();
  await page.getByRole("checkbox", { name: /Synthetischer Mischfonds/ }).uncheck();
  await save(page);
  const [before] = await stored(page);
  const a = before.depot.find((h) => h.name === "Synthetische Aktie A")!;
  const b = before.depot.find((h) => h.name === "Synthetische Aktie B")!;
  expect(a.wkn).toBe("ZZCP01");
  expect(b.wkn).toBe(a.wkn);
  expect(a.depotId).not.toBe(b.depotId);
  expect(before.plans[0].depotHoldingIds).toEqual([b.id]);
  const target = page.getByRole("article").filter({ has: page.getByRole("textbox", { name: "Depotname", exact: true }).and(page.locator(`input[value="${depotB}"]`)) });
  preview = await upload(page, target.getByRole("button", { name: "CSV ersetzen" }), "synthetic-b-replacement.csv", depotCsv("B", true));
  await expect(preview.getByRole("combobox", { name: /^Zieldepot/ })).toHaveValue(b.depotId);
  await expect(preview.locator(".csv-preview-metrics")).toContainText("2Positionen");
  await expect(preview.locator(".csv-preview-metrics")).toContainText(money(12000));
  await preview.getByRole("button", { name: "Bestehendes Depot ersetzen" }).click();
  await expect(page.locator(".holding-card")).toHaveCount(3);
  await expect(page.getByLabel(`Geplanter Verkauf ${depotA}: Synthetische Aktie A`)).toHaveValue("2.500");
  await expect(page.getByLabel(`Geplanter Verkauf ${depotB}: Synthetische Aktie B`)).toHaveValue("6.000");
  await totals(page, 22000, 13500);
  await save(page);
  const [after] = await stored(page);
  expect(after.id).toBe(before.id);
  expect(after.depotAccounts.map((d) => d.id)).toEqual(before.depotAccounts.map((d) => d.id));
  expect(after.depotAccounts.find((d) => d.id === a.depotId)).toEqual(before.depotAccounts.find((d) => d.id === a.depotId));
  const beforeB = before.depotAccounts.find((d) => d.id === b.depotId)!;
  const afterB = after.depotAccounts.find((d) => d.id === b.depotId)!;
  expect({ ...afterB, updatedAt: beforeB.updatedAt }).toEqual(beforeB);
  expect(Date.parse(afterB.updatedAt)).toBeGreaterThan(Date.parse(beforeB.updatedAt));
  expect(after.depot).toHaveLength(3);
  expect(after.advisory.depotValue).toBe(22000);
  expect(after.depot.find((h) => h.id === a.id)).toEqual(a);
  const replacement = after.depot.find((h) => h.name === b.name)!;
  expect(replacement).toMatchObject({ depotId: b.depotId, wkn: b.wkn, value: 8000, plannedSale: 6000 });
  expect(after.plans[0].depotHoldingIds).toEqual([replacement.id]);
  expect(after.plans[0].depotHoldingIds).not.toContain(a.id);
  validRelations(after);

  await page.reload();
  await openCase(page, after.advisory.caseName);
  await nav(page, "Depotcheck");
  await totals(page, 22000, 13500);
  const reopened = (await currentJson(page, info, "reloaded-depot")).item;
  expect(reopened.id).toBe(after.id);
  expect(reopened.depotAccounts).toEqual(after.depotAccounts);
  expect(reopened.depot).toEqual(after.depot);
  expect(reopened.plans).toEqual(after.plans);
  validRelations(reopened);
});

test.describe("Planung und Fallidentität", () => {
  const fixture = planningCase();
  test.use({ storageState: { cookies: [], origins: [{ origin: "http://127.0.0.1:4173", localStorage: [{ name: CASE_STORAGE_KEY, value: JSON.stringify([fixture]) }] }] } });

  test("Planung, JSON-Kopie, Restore-Abbruch/-Bestätigung und getrennte Fälle nach Reload", async ({ page }, info) => {
    await seed(page, fixture);
    await test.step("P1: stale React list retains external additions and does not resurrect deletions", async () => {
      // Same localStorage, no reload/state update: model a logically separate client.
      const neighbor = normalizeImportedCase({ ...planningCase(), id: "cp0b-p1-neighbor" }, false)!;
      neighbor.advisory.caseName = "Synthetischer P1-Nachbarfall";
      await page.evaluate(({ key, neighbor }) => {
        const current = JSON.parse(localStorage.getItem(key)!);
        localStorage.setItem(key, JSON.stringify([...current, neighbor]));
      }, { key: CASE_STORAGE_KEY, neighbor });
      await nav(page, "Ergebnis & Export");
      await page.getByRole("combobox", { name: /^Bearbeitungsstand/ }).selectOption("In Prüfung");
      await save(page);
      const added = await stored(page);
      expect(added.map((item) => item.id)).toEqual([fixture.id, neighbor.id]);
      expect(added[0].status).toBe("In Prüfung");
      expect({ ...added[1], updatedAt: neighbor.updatedAt }).toEqual(neighbor);
      // Successful save has now synchronized React with [A, B]. Externally remove B.
      await nav(page, "Beratungsfälle");
      await expect(page.getByRole("button", { name: neighbor.advisory.caseName, exact: false })).toBeVisible();
      await openCase(page, fixture.advisory.caseName);
      await page.evaluate(({ key, id }) => {
        const current = JSON.parse(localStorage.getItem(key)!);
        localStorage.setItem(key, JSON.stringify(current.filter((item: { id: string }) => item.id !== id)));
      }, { key: CASE_STORAGE_KEY, id: neighbor.id });
      await nav(page, "Ergebnis & Export");
      await page.getByRole("combobox", { name: /^Bearbeitungsstand/ }).selectOption("Entwurf");
      await save(page);
      const removed = await stored(page);
      expect(removed.map((item) => item.id)).toEqual([fixture.id]);
      expect(removed[0].status).toBe("Entwurf");
      console.log("PASS P1 browser: external neighbor retained; deleted neighbor not resurrected; real save button");
    });
    await test.step("H1: allocation and savings cents; equal-value plan identities discard old drafts", async () => {
      await nav(page, "Strukturplanung");
      const buy = page.getByLabel("Kaufbetrag Synthetischer Kauf", { exact: true });
      await buy.fill("1.000,50");
      await buy.press("Tab");
      await save(page);
      let saved = (await stored(page))[0];
      expect(saved.plans[0].allocations[0].amount).toBe(1000.5);
      expect(saved.plans[0].allocations[0].capitalPotAmounts!.strategic).toBe(1000.5);
      await nav(page, "Strukturplanung");
      await buy.fill("3000");
      await buy.press("Tab");
      const plans = page.getByRole("combobox", { name: /^Aktive Planung/ });
      const total = page.getByRole("textbox", { name: /^Zu strukturierendes Kapital/ });
      // Both different plans now have the SAME model value and editable state.
      await plans.selectOption(fixture.plans[1].id);
      await page.getByRole("button", { name: "Abweichenden Betrag verwenden", exact: true }).click();
      await plans.selectOption(fixture.plans[0].id);
      await page.getByRole("button", { name: "Abweichenden Betrag verwenden", exact: true }).click();
      await total.fill("1.000,");
      await total.press("Tab");
      await expect(total).toHaveAttribute("aria-invalid", "true");
      await plans.selectOption(fixture.plans[1].id);
      await expect(total).toHaveValue("10.000");
      await expect(total).toHaveAttribute("aria-invalid", "false");
      await page.getByRole("button", { name: "Erfasste Liquidität übernehmen", exact: true }).click();
      await plans.selectOption(fixture.plans[0].id);
      await expect(total).toHaveValue("10.000");
      await page.getByRole("button", { name: "Erfasste Liquidität übernehmen", exact: true }).click();
      await page.getByRole("button", { name: "＋ Sparplan", exact: true }).click();
      const saving = page.getByRole("textbox", { name: /^Sparrate/ });
      await saving.fill("100,25");
      await saving.press("Tab");
      await page.getByRole("combobox", { name: /^Zielbezug/ }).selectOption("new");
      const goal = page.locator(".savings-goal-editor").getByRole("textbox", { name: /^Zielbetrag/ });
      await goal.fill("5.000,50");
      await goal.press("Enter");
      await save(page);
      saved = (await stored(page))[0];
      expect(saved.plans[0].investmentPlans.find(e => e.type === "savings")).toMatchObject({ contributionAmount: 100.25 });
      expect(saved.savingsGoals[0].targetAmount).toBe(5000.5);
      await nav(page, "Strukturplanung");
      await page.getByRole("button", { name: "Sparziel löschen", exact: true }).click();
      await page.locator(".savings-section .investment-plan-list article header button").click();
      await save(page);
      saved = (await stored(page))[0];
      expect(saved.savingsGoals).toEqual([]);
      expect(saved.plans[0].investmentPlans).toEqual(fixture.plans[0].investmentPlans);
      console.log("PASS H1 browser: real allocation/savings/goal cents and same-value object identity reset");
    });
    await nav(page, "Depotcheck");
    await totals(page, 20000, 14500);
    await nav(page, "Strukturplanung");
    await page.getByLabel("Kaufbetrag Synthetischer Kauf", { exact: true }).fill("4000");
    await page.getByRole("button", { name: "Vermögensstruktur", exact: true }).click();
    const house = page.locator(".house-view");
    await test.step("D1 A: IST remains complete when active depot mode is none", async () => {
      await house.getByRole("tab", { name: "IST", exact: true }).click();
      await expect(house.locator(".house-roof strong")).toHaveText(money(30000));
      const original = await house.locator(".house-pillars").innerText();
      const foundation = await house.locator(".house-foundation").innerText();
      await page.getByRole("button", { name: "Ändern", exact: true }).click();
      await page.getByRole("combobox", { name: /^Berücksichtigung/ }).selectOption("none");
      await expect(house.locator(".house-roof strong")).toHaveText(money(30000));
      expect(await house.locator(".house-pillars").innerText()).toBe(original);
      expect(await house.locator(".house-foundation").innerText()).toBe(foundation);
      await house.getByRole("button", { name: "Substanzwerte öffnen", exact: true }).click();
      await expect(house.locator(".house-detail-list")).toContainText(fixture.depot[0].name);
      await expect(house.locator(".house-detail-list")).toContainText(fixture.depot[1].name);
      await page.getByRole("combobox", { name: /^Berücksichtigung/ }).selectOption("afterSales");
      await page.getByRole("button", { name: "Schließen", exact: true }).click();
      console.log("PASS D1 A browser: full IST roof, pillars, unresolved and contributors independent of none");
    });
    await test.step("D1 B: PLAN follows active after-sales variant", async () => {
      await house.getByRole("tab", { name: "PLAN", exact: true }).click();
      await expect(house.locator(".house-roof strong")).toHaveText(money(21500));
      await expect(house.getByRole("button", { name: "Substanzwerte öffnen", exact: true }).locator("footer")).toHaveText(money(7500));
      await expect(house.locator(".house-foundation")).toContainText(`${money(8000)} noch ungeklärt`);
      console.log("PASS D1 B browser: PLAN uses active afterSales with purchases, remainder and unresolved");
    });
    let targetValues: string[], targetShares: string[];
    await test.step("D1 C: ZIELPLAN follows separately preferred retain variant", async () => {
      await page.getByRole("combobox", { name: /^Aktive Planung/ }).selectOption(fixture.plans[1].id);
      await page.getByRole("button", { name: "★ Bevorzugt", exact: true }).click();
      await page.getByRole("combobox", { name: /^Aktive Planung/ }).selectOption(fixture.plans[0].id);
      await house.getByRole("tab", { name: "ZIELPLAN", exact: true }).click();
      await expect(house.locator(".house-roof strong")).toHaveText(money(20000));
      await expect(house.locator(".house-roof")).toContainText(fixture.plans[1].name);
      targetValues = await house.locator(".house-pillars footer").allTextContents();
      targetShares = await house.locator(".house-pillars header strong").allTextContents();
      await house.getByRole("tab", { name: "VERGLEICH", exact: true }).click();
      await expect(house.locator(".house-roof strong")).toHaveText(money(20000));
      await expect(house.locator(".house-foundation")).not.toContainText("noch ungeklärt");
      await house.getByRole("combobox", { name: "Vergleichsziel" }).selectOption("plan");
      await expect(house.locator(".house-roof strong")).toHaveText(money(21500));
      await expect(house.locator(".house-foundation")).toContainText(`${money(8000)} noch ungeklärt`);
      console.log("PASS D1 C browser: distinct preferred ZIELPLAN and IST comparison selection");
    });
    await test.step("D1 D: actual Excel and shared print match captured ZIELPLAN", async () => {
      await nav(page, "Ergebnis & Export");
      const result = await download(page, info, "Excel-Arbeitsmappe", "d1-target");
      const wb = XLSX.read(await readFile(result.path), { type: "buffer" });
      const rows = XLSX.utils.sheet_to_json<{ Anlageklasse: string; Betrag: number; Anteil: number }>(wb.Sheets.Vermögensstruktur);
      expect(rows.slice(0, 5).map((r) => money(r.Betrag))).toEqual(targetValues!);
      const pct = (n: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n * 100) + " %";
      expect(rows.slice(0, 5).map((r) => pct(r.Anteil))).toEqual(targetShares!);
      expect(rows.reduce((sum, r) => sum + r.Betrag, 0)).toBe(20000);
      expect(rows[5].Betrag).toBe(0);
      expect(await page.locator(".print-house-pillars b").allTextContents()).toEqual(targetValues!);
      expect(await page.locator(".print-house-pillars strong").allTextContents()).toEqual(targetShares!);
      console.log("PASS D1 D browser: actual downloaded XLSX amounts/shares and shared print equal ZIELPLAN");
    });
    await nav(page, "Depotcheck");
    await totals(page, 20000, 15500);
    await nav(page, "Strukturplanung");
    await page.getByRole("combobox", { name: /^Aktive Planung/ }).selectOption(fixture.plans[1].id);
    await nav(page, "Depotcheck");
    await totals(page, 20000, 11500);
    await nav(page, "Strukturplanung");
    await page.getByRole("combobox", { name: /^Aktive Planung/ }).selectOption(fixture.plans[0].id);
    await page.getByRole("button", { name: "★ Bevorzugt", exact: true }).click();
    await page.getByRole("combobox", { name: /^Aktive Planung/ }).selectOption(fixture.plans[1].id);
    await save(page);
    const [planned] = await stored(page);
    validRelations(planned);
    expect(planned.activePlanId).toBe(fixture.plans[1].id);
    expect(planned.plans.find((p) => p.preferred)!.id).toBe(fixture.plans[0].id);
    expect(planned.plans[0].allocations[0].amount).toBe(4000);
    await test.step("P3 A: active and preferred stay distinct after real save and reload", async () => {
      await page.reload();
      await openCase(page, fixture.advisory.caseName);
      const reopened = (await currentJson(page, info, "p3-distinct-selections")).item;
      expect(reopened.activePlanId).toBe(fixture.plans[1].id);
      expect(reopened.plans.filter((p) => p.preferred).map((p) => p.id)).toEqual([fixture.plans[0].id]);
      validRelations(reopened);
      console.log("PASS P3 A browser: active and preferred remain independent after save/reload");
    });
    // P4: copying the preferred variant activates the copy without changing preference.
    await nav(page, "Strukturplanung");
    await page.getByRole("combobox", { name: /^Aktive Planung/ }).selectOption(planned.plans[0].id);
    await page.getByRole("button", { name: "Duplizieren", exact: true }).click();
    const activeCopyId = await page.getByRole("combobox", { name: /^Aktive Planung/ }).inputValue();
    expect(planned.plans.map((p) => p.id)).not.toContain(activeCopyId);
    await save(page);
    const [withCopy] = await stored(page);
    expect(withCopy.activePlanId).toBe(activeCopyId);
    expect(withCopy.plans).toHaveLength(planned.plans.length + 1);
    expect(withCopy.plans.slice(0, planned.plans.length)).toEqual(planned.plans);
    const copiedPlan = withCopy.plans.find((p) => p.id === activeCopyId)!;
    expect(copiedPlan.preferred).toBe(false);
    expect(withCopy.plans.filter((p) => p.preferred).map((p) => p.id)).toEqual([planned.plans[0].id]);
    expect(copiedPlan.depotHoldingIds).toEqual(planned.plans[0].depotHoldingIds);
    expect(copiedPlan.allocations[0].id).not.toBe(planned.plans[0].allocations[0].id);
    validRelations(withCopy);
    await test.step("P3 D: deleting active non-preferred copy chooses original previous neighbor", async () => {
      await nav(page, "Strukturplanung");
      await page.locator(".plan-toolbar").getByRole("button", { name: "Löschen", exact: true }).click();
      expect(await page.getByRole("combobox", { name: /^Aktive Planung/ }).inputValue()).toBe(planned.plans[1].id);
      await save(page);
      const [deleted] = await stored(page);
      expect(deleted.plans.map((p) => p.id)).toEqual(planned.plans.map((p) => p.id));
      expect(deleted.activePlanId).toBe(planned.plans[1].id);
      expect(deleted.plans.filter((p) => p.preferred).map((p) => p.id)).toEqual([planned.plans[0].id]);
      validRelations(deleted);
      console.log("PASS P3 D browser: active copy deleted; original previous neighbor selected; preference unchanged");
    });
    await nav(page, "Ergebnis & Export");
    await expect(page.locator(".print-metrics")).toContainText(fixture.plans[0].name);
    await expect(page.locator(".print-metrics")).not.toContainText(fixture.plans[1].name);
    await page.getByRole("button", { name: "Version speichern", exact: true }).click();
    const [versioned] = await stored(page);
    expect(versioned.versions).toHaveLength(1);
    const historical = versioned.versions[0];
    expect(Number.isFinite(Date.parse(historical.createdAt))).toBe(true);
    expect(historical.snapshot.status).toBe("Entwurf");
    await page.getByRole("combobox", { name: /^Bearbeitungsstand/ }).selectOption("In Prüfung");
    await save(page);
    const [original] = await stored(page);
    const backup = await currentJson(page, info, "original-backup");
    expect(backup.item).toEqual(original);
    await test.step("H2: actual string-needs and Audit-06 allocation imports reject before store/recalculation", async () => {
      const originalBytes = await page.evaluate((key) => localStorage.getItem(key), CASE_STORAGE_KEY);
      const metrics = await page.locator(".print-metrics").innerText();
      const expectedWealth = original.plans.map(p => buildPlanWealthStructure(original.depot, p));
      for (const kind of ["needs", "allocations"] as const) {
        const damaged = JSON.parse(await readFile(backup.path, "utf8"));
        if (kind === "needs") {
          damaged.case.advisory.needs = [
            { id: 101, purpose: "Synthetischer H2-Bedarf A", amount: "1000", years: 2 },
            { id: 102, purpose: "Synthetischer H2-Bedarf B", amount: "2000", years: 2 },
          ];
        } else {
          const allocation = damaged.case.plans[0].allocations[0];
          damaged.case.plans[0].allocations = ["1000", "2000"].map((amount, index) => ({
            ...allocation, id: index === 0 ? allocation.id : "cp0b-h2-second-allocation",
            amount, capitalPotId: "strategic", capitalPotAmounts: { strategic: amount },
            bucketAmounts: { year10plus: amount },
          }));
        }
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: /JSON importieren/ }).click();
        const rejected = page.waitForEvent("dialog").then(async (dialog) => {
          expect(dialog.type()).toBe("alert");
          expect(dialog.message()).toBe("Die Datei enthält keinen vollständigen VermögensNavigator-Fall.");
          await dialog.accept();
        });
        await (await chooser).setFiles({ name: `synthetic-h2-${kind}.json`, mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(damaged)) });
        await rejected;
        expect(await page.evaluate((key) => localStorage.getItem(key), CASE_STORAGE_KEY)).toBe(originalBytes);
        expect(await stored(page)).toEqual([original]);
        expect(await page.locator(".print-metrics").innerText()).toBe(metrics);
        const current = (await currentJson(page, info, `h2-rejected-${kind}`)).item;
        expect(current).toEqual(original);
        expect(current.plans.map(p => buildPlanWealthStructure(current.depot, p))).toEqual(expectedWealth);
        expect(current.plans.map(p => planAssetAmounts(p).total).every(Number.isFinite)).toBe(true);
      }
      console.log("PASS H2 browser: string needs and two Audit-06 allocations rejected; original bytes, active case, print metrics and numeric projections unchanged");
    });
    await test.step("P3 E: duplicate plan identity in actual JSON backup rejects without changing store, case or view", async () => {
      const originalBytes = await page.evaluate((key) => localStorage.getItem(key), CASE_STORAGE_KEY);
      const invalidBackup = JSON.parse(await readFile(backup.path, "utf8"));
      invalidBackup.case.plans[1].id = invalidBackup.case.plans[0].id;
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: /JSON importieren/ }).click();
      const rejected = page.waitForEvent("dialog").then(async (dialog) => {
        expect(dialog.type()).toBe("alert");
        expect(dialog.message()).toBe("Die Datei enthält keinen vollständigen VermögensNavigator-Fall.");
        await dialog.accept();
      });
      await (await chooser).setFiles({ name: "synthetic-p3-invalid.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(invalidBackup)) });
      await rejected;
      expect(await page.evaluate((key) => localStorage.getItem(key), CASE_STORAGE_KEY)).toBe(originalBytes);
      expect(await stored(page)).toEqual([original]);
      await expect(page.getByRole("heading", { name: "Speichern, versionieren und exportieren" })).toBeVisible();
      expect((await currentJson(page, info, "p3-rejected-import-current")).item).toEqual(original);
      console.log("PASS P3 E browser: duplicate plan JSON rejected; store bytes, current case and export view unchanged");
    });
    await test.step("P2: dangling depot reference rejects JSON import without changing store or active case", async () => {
      const originalBytes = await page.evaluate((key) => localStorage.getItem(key), CASE_STORAGE_KEY);
      const invalidBackup = JSON.parse(await readFile(backup.path, "utf8"));
      invalidBackup.case.depot[2].depotId = "cp0b-p2-missing-depot";
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: /JSON importieren/ }).click();
      const rejected = page.waitForEvent("dialog").then(async (dialog) => {
        expect(dialog.type()).toBe("alert");
        expect(dialog.message()).toBe("Die Datei enthält keinen vollständigen VermögensNavigator-Fall.");
        await dialog.accept();
      });
      await (await chooser).setFiles({ name: "synthetic-p2-invalid.json", mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(invalidBackup)) });
      await rejected;
      expect(await page.evaluate((key) => localStorage.getItem(key), CASE_STORAGE_KEY)).toBe(originalBytes);
      expect(await stored(page)).toEqual([original]);
      await expect(page.getByRole("button", { name: /Vollständige Sicherung/ })).toBeVisible();
      const current = (await currentJson(page, info, "p2-rejected-import-active-case")).item;
      expect(current).toEqual(original);
      expect(current.depot[2].depotId).toBe(original.depot[2].depotId);
      expect(current.depot[2].depotId).not.toBe(current.depotAccounts[0].id);
      console.log("PASS P2 browser: dangling depotId import rejected; original store bytes, active case and depot assignments preserved");
    });
    await test.step("P1: failed import preserves store bytes, active case and export view", async () => {
      const malformed = "{ synthetic malformed store";
      await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: CASE_STORAGE_KEY, value: malformed });
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: /JSON importieren/ }).click();
      await (await chooser).setFiles(backup.path);
      await expect(page.getByRole("alert")).toContainText("Der lokale Fallbestand ist beschädigt");
      expect(await page.evaluate((key) => localStorage.getItem(key), CASE_STORAGE_KEY)).toBe(malformed);
      await expect(page.getByRole("button", { name: /Vollständige Sicherung/ })).toBeVisible();
      expect((await currentJson(page, info, "failed-import-active-case")).item).toEqual(original);
      await page.evaluate(({ key, item }) => localStorage.setItem(key, JSON.stringify([item])), { key: CASE_STORAGE_KEY, item: original });
      console.log("PASS P1 browser: failed import preserves original bytes and active case");
    });
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /JSON importieren/ }).click();
    await (await chooser).setFiles(backup.path);
    await expect(page.getByLabel("Bezeichnung des Testfalls")).toBeVisible();
    await expect.poll(async () => (await stored(page)).length).toBe(2);
    const imported = (await stored(page)).find((c) => c.id !== original.id)!;
    expect(imported.id).not.toBe(original.id);
    expect(imported.versions[0].snapshot.id).toBe(original.id);
    await page.getByLabel("Bezeichnung des Testfalls").fill("CP0B Planung Kopie geändert");
    await nav(page, "Ergebnis & Export");
    await page.getByRole("combobox", { name: /^Bearbeitungsstand/ }).selectOption("Abgeschlossen");
    // A second version proves restoration preserves the entire current history.
    await page.getByRole("button", { name: "Version speichern", exact: true }).click();
    const before = (await currentJson(page, info, "copy-before-restore")).item;
    expect(before.versions).toHaveLength(2);
    const restore = page.getByRole("article").filter({ hasText: historical.label }).getByRole("button", { name: "Wiederherstellen", exact: true });
    const cancel = page.waitForEvent("dialog").then(async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      expect(dialog.message()).toContain(historical.label);
      await dialog.dismiss();
    });
    await restore.click();
    await cancel;
    const unchanged = (await currentJson(page, info, "copy-cancelled")).item;
    expect(unchanged).toEqual(before);
    const restoreStarted = Date.now();
    const confirm = page.waitForEvent("dialog").then(async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.accept();
    });
    await restore.click();
    await confirm;
    await expect(page.getByRole("combobox", { name: /^Bearbeitungsstand/ })).toHaveValue("Entwurf");
    const restored = (await currentJson(page, info, "copy-restored")).item;
    expect(restored.id).toBe(imported.id);
    expect(restored.id).not.toBe(original.id);
    expect(content(restored)).toEqual(content({ ...historical.snapshot, versions: [] } as AdvisoryCase));
    expect(restored.versions).toEqual(before.versions);
    expect(Date.parse(restored.updatedAt)).toBeGreaterThanOrEqual(restoreStarted);
    expect(Date.parse(restored.updatedAt)).toBeLessThanOrEqual(Date.now());
    expect(restored.updatedAt).not.toBe(before.updatedAt);
    await save(page);
    const saved = await stored(page);
    expect(saved.map((c) => c.id).sort()).toEqual([original.id, imported.id].sort());
    // Reading the current store preserves content/history but refreshes updatedAt.
    expect({ ...saved.find((c) => c.id === original.id), updatedAt: original.updatedAt }).toEqual(original);
    const savedCopy = saved.find((c) => c.id === imported.id)!;
    expect(content(savedCopy)).toEqual(content(restored));
    expect(savedCopy.versions).toEqual(before.versions);
    await page.reload();
    // Both names may legitimately be identical after restore. Verify the opened IDs via export.
    for (const item of [original, savedCopy]) {
      await openCase(page, item.advisory.caseName, item.status);
      const reopened = (await currentJson(page, info, `reload-${item.status}`)).item;
      // normalizeImportedCase refreshes updatedAt on load; identity/content/history are invariant.
      expect({ ...reopened, updatedAt: item.updatedAt }).toEqual(item);
      expect(Date.parse(reopened.updatedAt)).toBeGreaterThanOrEqual(Date.parse(item.updatedAt));
      expect(Date.parse(reopened.updatedAt)).toBeLessThanOrEqual(Date.now());
      validRelations(reopened);
    }
    console.log("PASS H2 browser: valid numeric JSON imported with fresh case identity; both healthy cases saved and reopened after real reload");
    expect((await stored(page)).map((c) => c.id).sort()).toEqual([original.id, imported.id].sort());
    expect({ ...(await stored(page)).find((c) => c.id === original.id), updatedAt: original.updatedAt }).toEqual(original);
    await test.step("P3 B: deleting non-active preferred variant preserves active and persists zero preference", async () => {
      await nav(page, "Strukturplanung");
      await page.getByRole("button", { name: "Szenarien", exact: true }).click();
      const confirm = page.waitForEvent("dialog").then((dialog) => dialog.accept());
      await page.getByRole("button", { name: `Planvariante ${savedCopy.plans[0].name} löschen`, exact: true }).click();
      await confirm;
      await save(page);
      const deleted = (await stored(page)).find((c) => c.id === imported.id)!;
      expect(deleted.activePlanId).toBe(savedCopy.activePlanId);
      expect(deleted.plans.some((p) => p.id === savedCopy.plans[0].id)).toBe(false);
      expect(deleted.plans.filter((p) => p.preferred)).toHaveLength(0);
      validRelations(deleted);
      await page.reload();
      await openCase(page, deleted.advisory.caseName, deleted.status);
      const reopened = (await currentJson(page, info, "p3-no-preference-reload")).item;
      expect(reopened.activePlanId).toBe(savedCopy.activePlanId);
      expect(reopened.plans.filter((p) => p.preferred)).toHaveLength(0);
      validRelations(reopened);
      console.log("PASS P3 B browser: non-active preferred deleted; active stable and zero preference survives reload");
    });
    await test.step("P3 C: absent preferred target shows stable hint and no fallback export/result", async () => {
      await expect(page.getByRole("status")).toHaveText("Keine bevorzugte Zielvariante gewählt. Bitte in der Strukturplanung eine Variante als bevorzugt markieren.");
      await expect(page.locator(".print-document")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Excel-Arbeitsmappe/ })).toBeDisabled();
      await expect(page.getByRole("button", { name: /Kundenübersicht/ })).toBeDisabled();
      await expect(page.getByRole("button", { name: /Vollständige Sicherung/ })).toBeEnabled();
      await nav(page, "Strukturplanung");
      await page.getByRole("button", { name: "Vermögensstruktur", exact: true }).click();
      await page.getByRole("tab", { name: "ZIELPLAN", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Keine bevorzugte Zielvariante gewählt");
      await expect(page.locator(".house-layout")).toHaveCount(0);
      await page.getByRole("tab", { name: "PLAN", exact: true }).click();
      await expect(page.locator(".house-layout")).toBeVisible();
      await page.getByRole("button", { name: "← Zurück zur Beratung", exact: true }).click();
      await page.locator(".wizard-steps").getByRole("button", { name: /Ergebnis/ }).click();
      await expect(page.getByRole("status")).toContainText("Keine bevorzugte Zielvariante gewählt");
      await expect(page.locator(".result-metrics")).toContainText("Zielvariante nicht gewählt");
      await expect(page.locator(".maturity-summary article")).toHaveCount(0);
      console.log("PASS P3 C browser: no preferred target has visible hint, no fallback output; JSON stays available");
    });
    await test.step("H3: real JSON import, damaged history, controlled Restore, healthy Restore and explicit save/reload", async () => {
      const pageErrors: string[] = [];
      const onPageError = (error: Error) => pageErrors.push(error.message);
      page.on("pageerror", onPageError);
      const neighbors = await stored(page);
      const source = structuredClone(original);
      source.advisory.caseName = "CP0B H3 beschädigte Historie";
      const good = structuredClone(historical);
      good.id = "cp0b-h3-good"; good.label = "H3 gesunder Zwischenstand";
      good.snapshot.advisory.caseName = "CP0B H3 gesunder Stand";
      source.versions = [good];
      for (const [id, label, damage] of [
        ["snapshot", "H3 beschädigter Snapshot", (v: AdvisoryCase["versions"][number]) => Reflect.set(v, "snapshot", null)],
        ["goals", "H3 beschädigte Sparziele", (v: AdvisoryCase["versions"][number]) => Reflect.set(v.snapshot, "savingsGoals", [null])],
        ["account", "H3 beschädigter Kontoname", (v: AdvisoryCase["versions"][number]) => Reflect.set(v.snapshot.depotAccounts[0], "name", 123)],
        ["money", "H3 beschädigter Finanzbetrag", (v: AdvisoryCase["versions"][number]) => Reflect.set(v.snapshot.advisory, "reserve", "100")],
      ] as const) {
        const version = { ...structuredClone(good), id: `cp0b-h3-${id}`, label };
        damage(version); source.versions.push(version);
      }
      const invalidLabel = { ...structuredClone(good), id: "cp0b-h3-label" };
      Reflect.set(invalidLabel, "label", { synthetic: "invalid React child" });
      source.versions.push(invalidLabel);
      const chooser = page.waitForEvent("filechooser");
      await nav(page, "Ergebnis & Export");
      await page.getByRole("button", { name: /JSON importieren/ }).click();
      await (await chooser).setFiles({ name: "synthetic-h3-history.json", mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({ case: source })) });
      await expect(page.getByLabel("Bezeichnung des Testfalls")).toHaveValue(source.advisory.caseName);
      await expect.poll(async () => (await stored(page)).length).toBe(neighbors.length + 1);
      const imported = (await currentJson(page, info, "h3-imported")).item;
      expect(imported.id).not.toBe(source.id); expect(imported.versions).toEqual(source.versions);
      // Read the real application store on a new page lifecycle before testing Restore.
      await page.reload(); await openCase(page, source.advisory.caseName);
      const before = (await currentJson(page, info, "h3-reloaded-before-restore")).item;
      expect(before.versions).toEqual(source.versions);
      const history = page.locator(".version-history");
      await expect(history.locator("article")).toHaveCount(6);
      await expect(history.getByText("Version ohne gültige Bezeichnung", { exact: true })).toBeVisible();
      await expect(history.getByText("Historische Vorschau nicht verfügbar", { exact: true })).toBeVisible();
      await expect(history.getByText(good.label, { exact: true })).toBeVisible();
      const mainBytes = await page.evaluate(key => localStorage.getItem(key), CASE_STORAGE_KEY);
      const storageBefore = await page.evaluate(() => ({ ...localStorage }));
      const failure = "Diese historische Version kann aufgrund beschädigter Daten nicht wiederhergestellt werden. Der aktuelle Arbeitsstand bleibt unverändert.";
      for (const version of source.versions.slice(1, 5)) {
        const dialogs: string[] = [];
        const handle = async (dialog: import("@playwright/test").Dialog) => {
          dialogs.push(dialog.type());
          if (dialog.type() === "confirm") expect(dialog.message()).toContain(version.label);
          else { expect(dialog.type()).toBe("alert"); expect(dialog.message()).toBe(failure); }
          await dialog.accept();
        };
        page.on("dialog", handle);
        try {
          await history.locator("article").filter({ hasText: version.label }).getByRole("button", { name: "Wiederherstellen", exact: true }).click();
          await expect.poll(() => dialogs).toEqual(["confirm", "alert"]);
        } finally { page.off("dialog", handle); }
        expect((await currentJson(page, info, `h3-rejected-${version.id}`)).item).toEqual(before);
        expect(await page.evaluate(key => localStorage.getItem(key), CASE_STORAGE_KEY)).toBe(mainBytes);
        expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(storageBefore);
      }
      // The fallback label is also the actual safe confirmation text. Cancel is inert.
      const cancel = page.waitForEvent("dialog").then(async dialog => {
        expect(dialog.type()).toBe("confirm"); expect(dialog.message()).toBe("Version ohne gültige Bezeichnung als aktuellen Arbeitsstand wiederherstellen?");
        await dialog.dismiss();
      });
      await history.locator("article").filter({ hasText: "Version ohne gültige Bezeichnung" }).getByRole("button", { name: "Wiederherstellen", exact: true }).click();
      await cancel; expect((await currentJson(page, info, "h3-label-cancelled")).item).toEqual(before);
      expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(storageBefore);
      const confirm = page.waitForEvent("dialog").then(dialog => dialog.accept());
      const started = Date.now();
      await history.locator("article").filter({ hasText: good.label }).getByRole("button", { name: "Wiederherstellen", exact: true }).click();
      await confirm;
      const restored = (await currentJson(page, info, "h3-good-restored")).item;
      expect(restored.id).toBe(imported.id); expect(restored.versions).toEqual(source.versions);
      expect(content(restored)).toEqual(content({ ...good.snapshot, versions: [] } as AdvisoryCase));
      expect(restored.activePlanId).toBe(good.snapshot.activePlanId);
      expect(restored.plans.filter(p => p.preferred).map(p => p.id)).toEqual(good.snapshot.plans.filter(p => p.preferred).map(p => p.id));
      expect(Date.parse(restored.updatedAt)).toBeGreaterThanOrEqual(started);
      expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(storageBefore);
      await save(page); await page.reload(); await openCase(page, restored.advisory.caseName, restored.status);
      const reopened = (await currentJson(page, info, "h3-final-reload")).item;
      expect(reopened.id).toBe(imported.id); expect(content(reopened)).toEqual(content(restored));
      expect(reopened.versions).toEqual(source.versions); validRelations(reopened);
      const finalStore = await stored(page);
      for (const neighbor of neighbors) expect({ ...finalStore.find(c => c.id === neighbor.id), updatedAt: neighbor.updatedAt }).toEqual(neighbor);
      expect(pageErrors).toEqual([]); page.off("pageerror", onPageError);
      console.log("PASS H3 browser: all 6 originals visible; 4 invalid Restores rejected with byte-identical store; healthy Restore, safe label/cancel, explicit save and real reload; no pageerror");
    });
    await test.step("H4: bounded React rates, strict drafts, opaque history, rejected JSON and saved reload", async () => {
      const errors: string[] = [];
      const onError = (error: Error) => errors.push(error.message);
      page.on("pageerror", onError);
      const neighbors = await stored(page), source = h4Case();
      const variant = duplicateStructurePlan(source.plans[0], "Synthetische H4-Variante");
      source.plans.push(variant);
      const good = caseSnapshot(source), damaged = structuredClone(good);
      Reflect.set(damaged.plans[0].investmentPlans[0], "installments", 4294967296);
      source.versions = [
        { id: "cp0b-h4-good", label: "H4 gültige Historie", createdAt: source.createdAt, snapshot: good },
        { id: "cp0b-h4-bad", label: "H4 übergroße historische Raten", createdAt: source.createdAt, snapshot: damaged },
      ];
      async function jsonImport(item: AdvisoryCase, tag: string) {
        await nav(page, "Ergebnis & Export");
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: /JSON importieren/ }).click();
        await (await chooser).setFiles({ name: `synthetic-h4-${tag}.json`, mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify({ case: item })) });
      }
      await jsonImport(source, "valid");
      await expect(page.getByLabel("Bezeichnung des Testfalls")).toHaveValue(source.advisory.caseName);
      await expect.poll(async () => (await stored(page)).length).toBe(neighbors.length + 1);
      const imported = (await currentJson(page, info, "h4-imported")).item;
      expect(imported.id).not.toBe(source.id); expect(imported.versions).toEqual(source.versions);
      await page.reload(); await openCase(page, source.advisory.caseName);
      const beforeRestore = (await currentJson(page, info, "h4-history-reloaded")).item;
      const storageBeforeRestore = await page.evaluate(() => ({ ...localStorage }));
      const history = page.locator(".version-history");
      await expect(history.locator("article")).toHaveCount(2);
      const dialogs: string[] = [];
      const onDialog = async (dialog: import("@playwright/test").Dialog) => {
        dialogs.push(dialog.message()); await dialog.accept();
      };
      page.on("dialog", onDialog);
      try {
        await history.locator("article").filter({ hasText: "H4 übergroße historische Raten" }).getByRole("button", { name: "Wiederherstellen", exact: true }).click();
        await expect.poll(() => dialogs.length).toBe(2);
      } finally { page.off("dialog", onDialog); }
      expect(dialogs[1]).toBe("Diese historische Version kann aufgrund beschädigter Daten nicht wiederhergestellt werden. Der aktuelle Arbeitsstand bleibt unverändert.");
      expect((await currentJson(page, info, "h4-rejected-restore")).item).toEqual(beforeRestore);
      expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(storageBeforeRestore);
      const confirm = page.waitForEvent("dialog").then(d => d.accept());
      await history.locator("article").filter({ hasText: "H4 gültige Historie" }).getByRole("button", { name: "Wiederherstellen", exact: true }).click();
      await confirm;
      const restored = (await currentJson(page, info, "h4-good-restore")).item;
      expect(restored.id).toBe(imported.id); expect(restored.versions).toEqual(source.versions); expect(restored.plans).toEqual(good.plans);
      expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(storageBeforeRestore);
      await nav(page, "Strukturplanung");
      const timeline = page.locator(".capital-timeline");
      await timeline.getByRole("button", { name: /STRATEGISCH/ }).click();
      const detail = page.locator(".capital-pot-detail");
      await detail.getByRole("button", { name: "Ändern", exact: true }).click();
      const count = detail.getByRole("textbox", { name: /^Anzahl Raten/ });
      await expect(count).toHaveValue("3");
      await count.fill(""); await expect(count).toHaveValue("");
      await count.pressSequentially("12"); await count.press("Tab");
      await expect(count).toHaveValue("12"); await expect(count).toHaveAttribute("aria-invalid", "false");
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.evaluate(() => navigator.clipboard.writeText("12"));
      await count.focus(); await count.press("ControlOrMeta+A"); await count.press("ControlOrMeta+V"); await count.press("Tab");
      await expect(count).toHaveValue("12"); await expect(count).toHaveAttribute("aria-invalid", "false");
      await count.fill("1200"); await count.press("Enter"); await expect(count).toHaveValue("1200");
      const invalidBytes = await page.evaluate(() => ({ ...localStorage }));
      for (const raw of ["1201", "4294967296", "1.5", "1.200", "-1", "1e3", ""]) {
        await count.fill(raw); await count.press("Tab");
        await expect(count).toHaveValue(raw); await expect(count).toHaveAttribute("aria-invalid", "true");
        await expect(detail.getByRole("alert")).toContainText("Nicht übernommen; zuletzt gültig: 1200");
        await expect(detail.getByRole("alert")).toContainText("von 1 bis 1200 ohne Trennzeichen");
        expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(invalidBytes);
      }
      // Real OS clipboard shortcut: neither invalid paste nor Enter changes the model.
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.evaluate(() => navigator.clipboard.writeText("4294967296"));
      await count.focus(); await count.press("ControlOrMeta+A"); await count.press("ControlOrMeta+V"); await count.press("Enter");
      await expect(count).toHaveValue("4294967296"); await expect(detail.getByRole("alert")).toContainText("zuletzt gültig: 1200");
      // Distinct pot/product and plan IDs must never share a draft.
      await timeline.getByRole("button", { name: /2030/ }).click();
      await detail.getByRole("button", { name: "Ändern", exact: true }).click();
      await expect(count).toHaveValue("6"); await expect(count).toHaveAttribute("aria-invalid", "false");
      await count.fill("12"); await count.press("Tab");
      await timeline.getByRole("button", { name: /STRATEGISCH/ }).click();
      await detail.getByRole("button", { name: "Ändern", exact: true }).click();
      await expect(count).toHaveValue("4294967296");
      const plans = page.getByRole("combobox", { name: /^Aktive Planung/ });
      await plans.selectOption(variant.id); await detail.getByRole("button", { name: "Ändern", exact: true }).click();
      await expect(count).toHaveValue("3"); await expect(count).toHaveAttribute("aria-invalid", "false");
      await plans.selectOption(source.plans[0].id); await detail.getByRole("button", { name: "Ändern", exact: true }).click();
      await expect(count).toHaveValue("4294967296");
      const beforeImport = (await currentJson(page, info, "h4-unsaved-last-valid")).item;
      expect(Reflect.get(beforeImport.plans[0].investmentPlans[0], "installments")).toBe(1200);
      expect(Reflect.get(beforeImport.plans[0].investmentPlans[1], "installments")).toBe(12);
      expect(Reflect.get(beforeImport.plans[1].investmentPlans[0], "installments")).toBe(3);
      const beforeImportBytes = await page.evaluate(() => ({ ...localStorage }));
      for (const schema of [10, 11]) {
        const corrupt = structuredClone(beforeImport); Reflect.set(corrupt, "schemaVersion", schema);
        Reflect.set(corrupt.plans[0].investmentPlans[0], "installments", 4294967296);
        const alert = page.waitForEvent("dialog").then(async dialog => {
          expect(dialog.type()).toBe("alert"); expect(dialog.message()).toBe("Die Datei enthält keinen vollständigen VermögensNavigator-Fall."); await dialog.accept();
        });
        await jsonImport(corrupt, `bad-schema-${schema}`); await alert;
        expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(beforeImportBytes);
        expect((await currentJson(page, info, `h4-after-rejected-import-${schema}`)).item).toEqual(beforeImport);
      }
      await nav(page, "Strukturplanung");
      await timeline.getByRole("button", { name: /STRATEGISCH/ }).click();
      await detail.getByRole("button", { name: "Ändern", exact: true }).click();
      await count.fill("3"); await count.press("Enter");
      await expect(count).toHaveAttribute("aria-invalid", "false"); await expect(detail.getByRole("alert")).toHaveCount(0);
      await expect(detail.locator(".entry-editor")).toContainText(money(33.33)); await expect(detail.locator(".entry-editor")).toContainText(`Letzte Rate ${money(33.34)}`);
      await save(page); await page.reload(); await openCase(page, source.advisory.caseName);
      const reopened = (await currentJson(page, info, "h4-final-reload")).item;
      expect(reopened.id).toBe(imported.id); expect(reopened.versions).toEqual(source.versions);
      expect(Reflect.get(reopened.plans[0].investmentPlans[0], "installments")).toBe(3);
      expect(phasedEntryAmounts(reopened.plans[0], reopened.plans[0].investmentPlans[0] as PhasedEntryPlan).installmentAmounts).toEqual([33.33,33.33,33.34]);
      const xlsx = await download(page, info, "Excel-Arbeitsmappe", "h4-cent-rates");
      const workbook = XLSX.read(await readFile(xlsx.path), { type: "buffer" });
      const rows = XLSX.utils.sheet_to_json<{ Plan: string; Produkt: string; Anzahl_Raten: number; Ratenhöhe: number; Gestaffelter_Betrag: number; Plausibilität: string }>(workbook.Sheets.Investitionspläne);
      expect(rows.find(r => r.Plan === source.plans[0].name && r.Produkt === source.plans[0].allocations[0].productName)).toMatchObject({
        Anzahl_Raten: 3, Ratenhöhe: 33.33, Gestaffelter_Betrag: 100, Plausibilität: "Plausibel",
      });
      await nav(page, "Strukturplanung"); await timeline.getByRole("button", { name: /STRATEGISCH/ }).click();
      await detail.getByRole("button", { name: "Ändern", exact: true }).click(); await expect(count).toHaveValue("3");
      const finalStore = await stored(page);
      for (const neighbor of neighbors) expect({ ...finalStore.find(c => c.id === neighbor.id), updatedAt: neighbor.updatedAt }).toEqual(neighbor);
      expect(errors).toEqual([]); page.off("pageerror", onError);
      console.log("PASS H4 browser: strict typing/paste/Tab/Enter/blur and isolated pot/product/plan drafts; last-valid 1200; schema10/11 imports and bad Restore inert; healthy Restore, cents, real save/reload and no pageerror");
    });

  });
});

test.describe("Ausgaben", () => {
  const fixture = outputCase();
  test.use({ storageState: { cookies: [], origins: [{ origin: "http://127.0.0.1:4173", localStorage: [{ name: CASE_STORAGE_KEY, value: JSON.stringify([fixture]) }] }] } });

  test("Excel-Download und beide produktiven Druckmodi nach Vollverkauf", async ({ page }, info) => {
    await seed(page, fixture);
    await nav(page, "Depotcheck");
    // A valid cent amount above the computed imported value still exercises the
    // existing full-sale cap, without relying on F-006 stripping decimal digits.
    await page.getByLabel("Geplanter Verkauf Synthetisches Bonddepot: =1+1", { exact: true }).fill("10.592,92");
    await page.getByLabel("Geplanter Verkauf Synthetisches Bonddepot: =1+1", { exact: true }).press("Tab");
    await totals(page, 10592.917767817604, 0);
    await nav(page, "Ergebnis & Export");
    const file = await download(page, info, "Excel-Arbeitsmappe", "workbook");
    expect(file.name).toBe("CP0B-Bond-1-1.xlsx");
    const workbook = XLSX.read(await readFile(file.path), { type: "buffer" });
    const fall = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Fall, { header: 1 });
    expect(fall.find((r) => r[0] === "Fall")?.[1]).toBe(fixture.advisory.caseName);
    expect(fall.find((r) => r[0] === "Depotwert")?.[1]).toBe(10592.917767817604);
    expect(workbook.SheetNames).toEqual(expect.arrayContaining(["Depot", "Zins & Laufzeiten", "Technische Nachweise"]));
    const depot = XLSX.utils.sheet_to_json(workbook.Sheets.Depot);
    expect(depot).toHaveLength(1);
    expect(depot[0]).toMatchObject({ Position: "=1+1", Wert: 10592.917767817604, Verkauf: 10592.917767817604 });
    const bond = workbook.Sheets["Zins & Laufzeiten"];
    expect(bond.A1.v).toBe("Zins & Laufzeiten – IST (physischer Bestand)");
    const rows = XLSX.utils.sheet_to_json<unknown[]>(bond, { header: 1 });
    expect(rows.find((r) => r[0] === "Indikative Rendite bis Fälligkeit")?.[1]).toBe("5,00 %");
    expect(rows.find((r) => r[0] === "Modified Duration")?.[1]).toBe("0,01 Jahre");
    const formulaText = Object.values(bond).find((cell) => cell?.v === "=1+1");
    expect(formulaText).toMatchObject({ t: "s", v: "=1+1" });
    expect(formulaText?.f).toBeUndefined();

    // Capture computed styles synchronously INSIDE window.print at the product's real timer boundary.
    await page.evaluate(() => {
      const calls: unknown[] = [];
      Object.assign(window, { cp0bPrintCalls: calls });
      window.print = () => calls.push({
        mode: document.body.dataset.printMode,
        printMedia: matchMedia("print").matches,
        internal: [...document.querySelectorAll(".internal-only")].map((e) => getComputedStyle(e).display),
        controls: [...document.querySelectorAll(".topbar, .sidebar, .no-print")].map((e) => getComputedStyle(e).display),
        document: getComputedStyle(document.querySelector(".print-document")!).display,
        text: document.querySelector(".print-document")!.textContent,
      });
    });
    for (const [index, mode, label] of [[0, "customer", "Kundenübersicht"], [1, "internal", "Interne Arbeitsunterlage"]] as const) {
      // Print CSS hides the button, so dispatch its click event on the real UI control.
      // No direct handler invocation or copied product timer; window.print remains the sole stub.
      await page.emulateMedia({ media: "print" });
      await page.getByRole("button", { name: new RegExp(label), includeHidden: true }).dispatchEvent("click");
      await expect.poll(() => page.evaluate(() => (window as unknown as { cp0bPrintCalls: unknown[] }).cp0bPrintCalls.length)).toBe(index + 1);
      const calls = await page.evaluate(() => (window as unknown as { cp0bPrintCalls: { mode: string; printMedia: boolean; internal: string[]; controls: string[]; document: string; text: string }[] }).cp0bPrintCalls);
      const call = calls[index];
      expect(call.mode).toBe(mode);
      expect(call.printMedia).toBe(true);
      expect(call.internal).toHaveLength(2);
      for (const display of call.internal) mode === "customer" ? expect(display).toBe("none") : expect(display).not.toBe("none");
      expect(call.controls.length).toBeGreaterThan(2);
      expect(call.controls.every((display) => display === "none")).toBe(true);
      expect(call.document).not.toBe("none");
      expect(call.text).toContain(fixture.advisory.caseName);
      expect(call.text).toContain("Zins & Laufzeiten – IST");
      expect(call.text).toContain("5,00 %");
      await expect(page.locator("body")).not.toHaveAttribute("data-print-mode");
      await page.emulateMedia({ media: "screen" });
      await expect(page.getByRole("button", { name: /Kundenübersicht/ })).toBeVisible();
    }
  });
});
