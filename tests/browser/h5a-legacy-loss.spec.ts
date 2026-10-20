import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { CASE_STORAGE_KEY as KEY, RECOVERY_PREFIX } from "../../app/case-storage";
import { caseSnapshot, type AdvisoryCase } from "../../app/case-model";
import { h5aLegacyCase, h5aHealthyCase } from "../../scripts/h5a-fixtures";

const state = (raw: string) => ({ cookies: [], origins: [{ origin: "http://127.0.0.1:4173", localStorage: [{ name: KEY, value: raw }] }] });
const nav = (p: Page, name: string) => p.getByRole("navigation").getByRole("button", { name }).click();
const bytes = (p: Page) => p.evaluate(() => ({ ...localStorage }));
async function openNeighbor(p: Page) {
  await nav(p, "Beratungsfälle");
  await p.getByRole("button", { name: "Synthetischer H5a-Nachbar", exact: false }).click();
}
async function download(p: Page, info: TestInfo, name: RegExp, tag: string) {
  const event = p.waitForEvent("download"); await p.getByRole("button", { name }).click();
  const file = await event; expect(await file.failure()).toBeNull();
  const path = info.outputPath(`${tag}-${file.suggestedFilename()}`); await file.saveAs(path);
  return (await readFile(path)).toString();
}
async function current(p: Page, info: TestInfo, tag: string): Promise<AdvisoryCase> {
  await nav(p, "Ergebnis & Export");
  return JSON.parse(await download(p, info, /Vollständige Sicherung/, tag)).case;
}
async function importCase(p: Page, c: AdvisoryCase) {
  await nav(p, "Ergebnis & Export"); const chooser = p.waitForEvent("filechooser");
  await p.getByRole("button", { name: /JSON importieren/ }).click();
  await (await chooser).setFiles({ name: "synthetic-h5a.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ case: c })) });
}

for (const partial of [false, true]) {
  test.describe(`H5a ${partial ? "Teilbetrag" : "vollständige Bindung"}`, () => {
    const legacy = h5aLegacyCase("h5a-legacy", partial), neighbor = h5aHealthyCase();
    const raw = JSON.stringify([legacy, neighbor], null, 2);
    test.use({ storageState: state(raw) });
    test("Recovery, echter Originaldownload, Nachbarspeichern und Reload erhalten Kapitalbindungen", async ({ page }, info) => {
      const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
      await page.goto("./"); const notice = page.locator(".case-store-notice");
      await expect(notice).toContainText("1 historischer Fall ist geschützt");
      await expect(notice).toContainText("fachlich geprüft"); await expect(notice).not.toContainText("1 beschädigter");
      expect(await download(page, info, /Originalbestand zur Wiederherstellung herunterladen/, "original")).toBe(raw);
      expect((await bytes(page))[KEY]).toBe(raw);
      await openNeighbor(page);
      await nav(page, "Beratungsfälle");
      await expect(page.getByRole("button", { name: /Synthetischer H5a-Altfall/ })).toHaveCount(0);
      await page.getByRole("button", { name: neighbor.advisory.caseName, exact: false }).click();
      await nav(page, "Depotcheck"); await page.getByRole("button", { name: "Fall speichern", exact: true }).click();
      const saved = await bytes(page);
      expect(JSON.parse(saved[KEY]).find((c: AdvisoryCase) => c.id === legacy.id)).toEqual(legacy);
      expect(Object.entries(saved).filter(([k]) => k.startsWith(RECOVERY_PREFIX)).map(([, v]) => v)).toEqual([raw]);
      await page.reload(); await expect(page.locator(".case-store-notice")).toContainText("historischer Fall ist geschützt");
      expect((await bytes(page))[KEY]).toBe(saved[KEY]);
      await expect(page.getByText(/Originalsicherungen zur Wiederherstellung \(1\)/)).toBeVisible();
      await openNeighbor(page); await nav(page, "Depotcheck"); await page.getByRole("button", { name: "Fall speichern", exact: true }).click();
      expect(Object.keys(await bytes(page)).filter(k => k.startsWith(RECOVERY_PREFIX))).toHaveLength(1);
      expect(errors).toEqual([]);
    });
  });
}

test.describe("H5a tatsächlicher Import und Restore", () => {
  const c = h5aHealthyCase();
  c.versions = [{ id: "h5a-bad-version", label: "H5a historisch geschützt", createdAt: c.createdAt, snapshot: caseSnapshot(h5aLegacyCase()) }];
  test.use({ storageState: state(JSON.stringify([c])) });
  test("abgelehnter JSON-Import und Restore lassen aktiven Fall, Historie und Storage unverändert", async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto("./"); await openNeighbor(page);
    const before = await current(page, info, "before"), storage = await bytes(page);
    for (const partial of [false, true]) {
      const dialog = page.waitForEvent("dialog").then(async d => { expect(d.type()).toBe("alert"); expect(d.message()).toContain("Kapitalbindungen"); await d.accept(); });
      await importCase(page, h5aLegacyCase("import", partial)); await dialog;
      expect(await bytes(page)).toEqual(storage); expect(await current(page, info, "after-import")).toEqual(before);
    }
    const messages: string[] = [];
    page.on("dialog", async d => { messages.push(d.message()); await d.accept(); });
    await page.getByRole("article").filter({ hasText: "H5a historisch geschützt" }).getByRole("button", { name: "Wiederherstellen", exact: true }).click();
    await expect.poll(() => messages.length).toBe(2);
    expect(messages[1]).toContain("Kapitalbindungen"); expect(messages[1]).not.toContain("aufgrund beschädigter Daten");
    expect(await bytes(page)).toEqual(storage); expect(await current(page, info, "after-restore")).toEqual(before);
    expect(before.versions).toEqual(c.versions); expect(errors).toEqual([]);
  });
});

test.describe("H5a Originalsicherung schlägt fehl", () => {
  const raw = JSON.stringify([h5aLegacyCase(), h5aHealthyCase()], null, 2);
  test.use({ storageState: state(raw) });
  test("echter Speichern-Button bricht vor dem Hauptschreiben ab", async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto("./"); await openNeighbor(page); const before = await bytes(page);
    await page.evaluate(prefix => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v) {
        if (k.startsWith(prefix)) throw new DOMException("Synthetic backup quota", "QuotaExceededError");
        original.call(this, k, v);
      };
    }, RECOVERY_PREFIX);
    await nav(page, "Depotcheck"); await page.getByRole("button", { name: "Fall speichern", exact: true }).click();
    await expect(page.locator(".case-store-notice")).toBeVisible();
    expect(await bytes(page)).toEqual(before); expect((await bytes(page))[KEY]).toBe(raw); expect(errors).toEqual([]);
  });
});

test.describe("H5a zulässige alte Bucketmigration", () => {
  test.use({ storageState: state(JSON.stringify([h5aHealthyCase()])) });
  test("echter JSON-Import erhält eindeutige Bucketbindung mit neuer äußerer ID", async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    const old = h5aLegacyCase("old-bucket"); Reflect.set(old, "schemaVersion", 7);
    old.advisory.caseName = "Synthetischer eindeutiger Bucketimport"; old.plans[0].investmentPlans = [];
    delete old.plans[0].allocations[0].capitalPotId; delete old.plans[0].allocations[0].capitalPotAmounts;
    await page.goto("./"); await openNeighbor(page); await importCase(page, old);
    // Import preserves currentStep=3: the case-name input lives in step 1.
    await expect(page.locator(".wizard-head .eyebrow")).toHaveText(old.advisory.caseName);
    const imported = await current(page, info, "bucket-import"); expect(imported.id).not.toBe(old.id);
    expect(imported.advisory.caseName).toBe(old.advisory.caseName);
    expect(imported.currentStep).toBe(old.currentStep);
    expect(imported.plans[0].allocations[0].amount).toBe(10000);
    expect(imported.plans[0].allocations[0].id).toBe(old.plans[0].allocations[0].id);
    expect(imported.plans[0].allocations[0].capitalPotAmounts).toEqual({ "year-2028": 10000 });
    expect(JSON.parse((await bytes(page))[KEY]).map((c: AdvisoryCase) => c.id)).toContain("h5a-neighbor");
    expect(errors).toEqual([]);
  });
});
