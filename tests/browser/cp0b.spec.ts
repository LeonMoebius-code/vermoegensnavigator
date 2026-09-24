import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import type { AdvisoryCase } from "../../app/case-model";
import { CASE_STORAGE_KEY } from "../../app/case-storage";
import { depotA, depotB, depotCsv, planningCase, outputCase } from "./fixtures";

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
  expect(item.plans.some((p) => p.id === item.activePlanId)).toBe(true);
  expect(item.plans.filter((p) => p.preferred)).toHaveLength(1);
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
  await page.getByLabel(`Geplanter Verkauf ${depotA}: Synthetische Aktie A`, { exact: true }).fill("2500");
  await page.getByLabel(`Geplanter Verkauf ${depotB}: Synthetische Aktie B`, { exact: true }).fill("6000");
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
    await nav(page, "Depotcheck");
    await totals(page, 20000, 14500);
    await nav(page, "Strukturplanung");
    await page.getByLabel("Kaufbetrag Synthetischer Kauf", { exact: true }).fill("4000");
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
    expect(saved.find((c) => c.id === original.id)).toEqual(original);
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
    expect((await stored(page)).map((c) => c.id).sort()).toEqual([original.id, imported.id].sort());
    expect((await stored(page)).find((c) => c.id === original.id)).toEqual(original);
  });
});

test.describe("Ausgaben", () => {
  const fixture = outputCase();
  test.use({ storageState: { cookies: [], origins: [{ origin: "http://127.0.0.1:4173", localStorage: [{ name: CASE_STORAGE_KEY, value: JSON.stringify([fixture]) }] }] } });

  test("Excel-Download und beide produktiven Druckmodi nach Vollverkauf", async ({ page }, info) => {
    await seed(page, fixture);
    await nav(page, "Depotcheck");
    await page.getByLabel("Geplanter Verkauf Synthetisches Bonddepot: =1+1", { exact: true }).fill("10592,917767817604");
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
