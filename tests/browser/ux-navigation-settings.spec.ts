import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { CASE_STORAGE_KEY, RECOVERY_PREFIX } from "../../app/case-storage";
import { qualityOptionalCase } from "../../scripts/quality-fixtures";
const settings = (p: import("@playwright/test").Page) => p.getByRole("button", { name: "Mehr & Einstellungen", exact: true });
const nav = (p: import("@playwright/test").Page, name: string) => p.getByRole("navigation").getByRole("button", { name, exact: false });

test("Navigation per Tastatur, inaktiver leerer Bestand und unveränderter ungespeicherter Entwurf", async ({ page }) => {
  await page.goto("./");
  await expect(nav(page, "Neue Beratung")).toHaveCount(0);
  await expect(nav(page, "Historische Fälle prüfen")).toHaveCount(0);
  await page.getByRole("button", { name: /Privatvermögen/ }).first().click();
  await page.locator(".wizard-steps").getByRole("button", { name: /Ausgangslage/ }).click();
  const name = page.getByLabel("Bezeichnung des Testfalls", { exact: false });
  await name.fill("Synthetischer ungespeicherter UX-Entwurf");
  const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await settings(page).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Daten & Wiederherstellung", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Historische Fälle prüfen", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Originalbestand zur Wiederherstellung herunterladen", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Separate Originaldatei prüfen", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Separate Originaldatei prüfen", exact: true }).click();
  await expect(page.getByLabel("Separate Originaldatei auswählen", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Zurück zu Mehr & Einstellungen", exact: true }).click();
  await nav(page, "Strukturplanung").click();
  await page.getByRole("button", { name: "Zurück zur Beratung", exact: false }).click();
  await expect(name).toHaveValue("Synthetischer ungespeicherter UX-Entwurf");
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(before);
});

for (const [label, scope] of [["Privatvermögen", "Privat"], ["Betriebsvermögen", "Betrieb"], ["Beides verbinden", "Kombiniert"]]) {
  test(`Schnellstart ${label}: Vorauswahl und reguläre Speicherung`, async ({ page }) => {
    await page.goto("./"); await page.getByRole("button", { name: new RegExp(label) }).first().click();
    // Inspect the actual persisted case, avoiding a second copy of the start logic.
    await page.locator(".wizard-head").getByRole("button", { name: "Fall speichern", exact: true }).click();
    const cases = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), CASE_STORAGE_KEY);
    expect(cases).toHaveLength(1);
    expect(cases[0].advisory.scope).toBe(scope === "Privat" ? "private" : scope === "Betrieb" ? "business" : "combined");
    await page.reload(); await nav(page, "Beratungsfälle").click();
    await expect(page.locator(".case-main")).toHaveCount(1);
  });
}

test("Neuer Fall aus Fallverwaltung nutzt unverändert den gemeinsamen Start", async ({ page }) => {
  await page.goto("./"); await nav(page, "Beratungsfälle").click();
  await page.getByRole("button", { name: /Neuer Fall/ }).click();
  await page.locator(".wizard-head").getByRole("button", { name: "Fall speichern", exact: true }).click();
  const cases = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), CASE_STORAGE_KEY);
  expect(cases).toHaveLength(1); expect(cases[0].advisory.scope).toBeNull();
});

test("Optionale Daten: Backupfehler bleibt sichtbar, Rohbestand/Entwurf bleiben erhalten; Backup wird wiederverwendet", async ({ page }, info) => {
  const source = JSON.stringify([qualityOptionalCase()], null, 2);
  await page.goto("./"); await page.evaluate(({ key, source }) => localStorage.setItem(key, source), { key: CASE_STORAGE_KEY, source });
  await page.reload(); await expect(page.locator(".case-store-notice")).toHaveCount(0);
  await nav(page, "Beratungsfälle").click(); await page.getByRole("button", { name: "Synthetische optionale Daten", exact: false }).click();
  await nav(page, "Depotcheck").click();
  await page.evaluate(prefix => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key.startsWith(prefix)) throw new Error("Synthetischer Backupfehler"); return original.call(this, key, value); };
  }, RECOVERY_PREFIX);
  await page.getByRole("button", { name: "Fall speichern", exact: true }).click();
  await expect(page.locator(".case-store-notice")).toHaveAttribute("role", "alert");
  expect(await page.evaluate(key => localStorage.getItem(key), CASE_STORAGE_KEY)).toBe(source);
  await page.reload(); await nav(page, "Beratungsfälle").click(); await page.getByRole("button", { name: "Synthetische optionale Daten", exact: false }).click();
  await nav(page, "Depotcheck").click();
  await page.getByRole("button", { name: "Fall speichern", exact: true }).click();
  await page.getByRole("button", { name: "Fall speichern", exact: true }).click();
  await settings(page).click(); await page.getByText("Originalsicherungen zur Wiederherstellung (1)", { exact: true }).click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Originalsicherung 1 herunterladen", exact: true }).click();
  const download = await event, path = info.outputPath("synthetisches-original.json"); await download.saveAs(path);
  expect(await readFile(path, "utf8")).toBe(source);
  expect(await page.evaluate(prefix => Object.keys(localStorage).filter(k => k.startsWith(prefix)).length, RECOVERY_PREFIX)).toBe(1);
});

test("Mehr & Einstellungen bleibt bei 390 px per Tastatur erreichbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await page.goto("./");
  await settings(page).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Daten & Wiederherstellung", exact: true })).toBeVisible();
});
