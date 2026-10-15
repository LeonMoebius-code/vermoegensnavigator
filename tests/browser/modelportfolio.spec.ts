import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { CASE_STORAGE_KEY } from "../../app/case-storage";
import type { AdvisoryCase } from "../../app/case-model";
import { modelPortfolioCase } from "../../scripts/modelportfolio-fixtures";

const nav = (page: Page, name: string) => page.getByRole("navigation").getByRole("button", { name }).click();
const money = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const stored = (page: Page): Promise<AdvisoryCase[]> => page.evaluate(key => JSON.parse(localStorage.getItem(key) || "[]"), CASE_STORAGE_KEY);
async function download(page: Page, info: TestInfo, label: RegExp, suffix: string) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: label }).click();
  const file = await event;
  expect(await file.failure()).toBeNull();
  const path = info.outputPath(`${suffix}-${file.suggestedFilename()}`);
  await file.saveAs(path);
  return path;
}

for (const [risk, strategy, moneyQuota, substanceQuota, alternativeQuota, psSubstance] of [
  [2, "Defensiv", 70, 20, 10, 25], [3, "Ausgewogen", 45, 40, 15, 45], [4, "Offensiv", 20, 60, 20, 65],
] as const) {
  test.describe(`Modellportfolio RB ${risk}`, () => {
    const fixture = modelPortfolioCase();
    test.use({ storageState: { cookies: [], origins: [{ origin: "http://127.0.0.1:4173",
      localStorage: [{ name: CASE_STORAGE_KEY, value: JSON.stringify([fixture]) }] }] } });
    for (const [action, label] of [["new", "Als neue Variante"], ["supplement", "Aktuellen Plan ergänzen"], ["replace", "Aktuellen Plan ersetzen"]] as const) {
      test(`${label}: Live-Mindestanlage, Umsetzung und vollständige Durchschau`, async ({ page }, info) => {
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto("./");
        await nav(page, "Beratungsfälle");
        await page.getByRole("button", { name: fixture.advisory.caseName }).click();
        await nav(page, "Strukturplanung");
        await page.getByRole("button", { name: "Modellvorlagen", exact: true }).click();
        const card = page.locator(".model-grid article").filter({ hasText: `Modellportfolio RB ${risk}` });
        await card.getByRole("button", { name: "Anwendung konfigurieren", exact: true }).click();
        const dialog = page.locator(".model-dialog"), amount = dialog.getByRole("textbox", { name: /^Betroffener Betrag/ });
        const warning = dialog.locator(".vv-minimum-warning");
        // Switching actions resets the default and preview using the real strategic remainder.
        for (const [choice, defaultAmount, defaultShortfall] of [
          ["Als neue Variante", 160000, 45000], ["Aktuellen Plan ersetzen", 160000, 45000],
          ["Aktuellen Plan ergänzen", 120000, 65000],
        ] as const) {
          await dialog.getByRole("button", { name: new RegExp(`^${choice}`) }).click();
          await expect(amount).toHaveValue(defaultAmount.toLocaleString("de-DE"));
          await expect(warning).toContainText(money(defaultShortfall));
        }
        await dialog.getByRole("button", { name: new RegExp(`^${label}`) }).click();
        await amount.fill("160.000");
        // No Tab/blur before assertions: the notice must react during typing.
        await expect(amount).toBeFocused();
        await expect(dialog).toContainText(`Private Select ${strategy}: 50 % von ${money(160000)} = ${money(80000)}`);
        await expect(warning).toContainText(money(45000));
        await expect(dialog.getByRole("button", { name: "Ausgewählte Aktion anwenden", exact: true })).toBeEnabled();
        await amount.fill("249.998");
        await expect(warning).toContainText(`Es fehlen ${money(1)}`);
        await amount.fill("250.000");
        await expect(warning).toHaveCount(0);
        await expect(dialog).toContainText("Mindestanlage erfüllt.");
        await amount.fill("300.000");
        await expect(warning).toHaveCount(0);
        await expect(dialog).toContainText(`= ${money(150000)} Einzelanlage`);
        // Existing whole-euro allocation rounding is also used by the notice.
        await amount.fill("249.999,99");
        await expect(warning).toHaveCount(0);
        await expect(dialog).toContainText(`= ${money(125000)} Einzelanlage`);
        await amount.fill("160.000");
        await expect(warning).toContainText(money(45000));
        await dialog.getByRole("button", { name: "Ausgewählte Aktion anwenden", exact: true }).click();
        await expect(dialog).toHaveCount(0); // Warning is informational and does not block.
        const plans = page.getByRole("combobox", { name: /^Aktive Planung/ });
        const activeId = await plans.inputValue();
        await nav(page, "Depotcheck");
        await page.getByRole("button", { name: "Fall speichern", exact: true }).click();
        const saved = (await stored(page))[0], plan = saved.plans.find(p => p.id === activeId)!;
        expect(saved.schemaVersion).toBe(11);
        expect(saved.plans).toHaveLength(action === "new" ? 2 : 1);
        expect(plan.modelAmount).toBe(160000);
        expect(plan.allocations.filter(a => a.source === "model").reduce((sum, a) => sum + a.amount, 0)).toBe(160000);
        expect(plan.allocations.find(a => a.productName === `Private Select ${strategy}`)!.amount).toBe(80000);
        expect(plan.allocations.some(a => a.id === "existing")).toBe(action === "supplement");
        if (action === "new") {
          expect(activeId).not.toBe(fixture.activePlanId);
          expect(saved.plans[0].allocations).toEqual(fixture.plans[0].allocations);
          expect(saved.plans[0].preferred).toBe(true);
          expect(plan.preferred).toBe(false);
        }
        await nav(page, "Strukturplanung");
        await page.getByRole("button", { name: "Vermögensstruktur", exact: true }).click();
        const house = page.locator(".house-view");
        const expected = { Geldwerte: 1600 * moneyQuota, Substanzwerte: 1600 * substanceQuota + (action === "supplement" ? 40000 : 0),
          "Alternative Anlagen": 1600 * alternativeQuota };
        const total = action === "supplement" ? 200000 : 160000;
        await expect(house.locator(".house-roof strong")).toHaveText(money(total));
        await expect(house.locator(".house-foundation")).toContainText("vollständig durchgeschaut");
        for (const [asset, value] of Object.entries(expected))
          await expect(house.getByRole("button", { name: `${asset} öffnen`, exact: true }).locator("footer")).toHaveText(money(value));
        await house.getByRole("button", { name: "Substanzwerte öffnen", exact: true }).click();
        const detail = house.locator(".house-detail-list");
        await expect(detail).toContainText(`Private Select ${strategy}`);
        await expect(detail).toContainText(money(800 * psSubstance));
        await expect(detail).toContainText("ZinsFix Index");
        if (risk > 2) await expect(detail).toContainText("MEA Einzelwert");
        await house.getByRole("tab", { name: "IST", exact: true }).click();
        await expect(house.locator(".house-roof strong")).toHaveText(money(160000));
        await expect(house.getByRole("button", { name: "Geldwerte öffnen", exact: true }).locator("footer")).toHaveText(money(0));
        // Explicitly choose the applied plan as preferred; new variants do not inherit it.
        if (action === "new") await page.getByRole("button", { name: "★ Bevorzugt", exact: true }).click();
        for (const tab of ["PLAN", "ZIELPLAN", "VERGLEICH"]) {
          await house.getByRole("tab", { name: tab, exact: true }).click();
          await expect(house.locator(".house-roof strong")).toHaveText(money(total));
          for (const [asset, value] of Object.entries(expected))
            await expect(house.getByRole("button", { name: `${asset} öffnen`, exact: true }).locator("footer")).toHaveText(money(value));
        }
        // Real capital-pot structure and its contributor detail use the same allocations.
        await page.getByRole("button", { name: "Laufzeiten & Produkte", exact: true }).click();
        const structure = page.locator(".capital-pot-structure");
        await expect(structure).toContainText(money(expected.Geldwerte));
        await expect(structure.locator(".capital-pot-unresolved")).toHaveCount(0);
        await structure.getByRole("button", { name: /Substanzwerte/ }).click();
        await expect(structure.locator(".capital-pot-asset-detail")).toContainText(`Private Select ${strategy}`);
        await expect(structure.locator(".capital-pot-asset-detail")).toContainText(money(800 * psSubstance));
        await nav(page, "Ergebnis & Export");
        const path = await download(page, info, /Excel-Arbeitsmappe/, "model-lookthrough");
        const workbook = XLSX.read(await readFile(path), { type: "buffer" });
        const rows = XLSX.utils.sheet_to_json<{ Anlageklasse: string; Betrag: number }>(workbook.Sheets.Vermögensstruktur);
        for (const [asset, value] of Object.entries(expected)) expect(rows.find(r => r.Anlageklasse === asset)!.Betrag).toBe(value);
        expect(rows.find(r => r.Anlageklasse === "Nicht durchgeschaut")!.Betrag).toBe(0);
        expect(rows.reduce((sum, r) => sum + r.Betrag, 0)).toBe(total);
        const json = JSON.parse(await readFile(await download(page, info, /Vollständige Sicherung/, "model-json"), "utf8")).case as AdvisoryCase;
        expect(json.plans.find(p => p.id === activeId)!.allocations).toEqual(plan.allocations);
        await nav(page, "Depotcheck"); await page.getByRole("button", { name: "Fall speichern", exact: true }).click();
        const beforeReload = (await stored(page))[0];
        await page.reload(); await nav(page, "Beratungsfälle");
        await page.getByRole("button", { name: fixture.advisory.caseName }).click();
        await nav(page, "Ergebnis & Export");
        const reopened = JSON.parse(await readFile(await download(page, info, /Vollständige Sicherung/, "model-reloaded"), "utf8")).case as AdvisoryCase;
        expect(reopened.schemaVersion).toBe(11); expect(reopened.plans).toEqual(beforeReload.plans);
        expect(reopened.versions).toEqual(beforeReload.versions);
        if (risk === 3 && action === "replace") {
          await nav(page, "Strukturplanung");
          await page.getByRole("button", { name: "VV-Selektion", exact: true }).click();
          const direct = page.locator(".vv-result-grid article").filter({ has: page.getByText("Private Select Sicherheit", { exact: true }) });
          await expect(direct).toContainText(money(125000));
          const directAmount = direct.getByRole("textbox", { name: /^Anlagebetrag/ });
          await directAmount.fill("80.000"); await directAmount.press("Tab");
          await expect(direct.locator(".vv-minimum-warning")).toContainText(money(125000));
          await directAmount.fill("125.000"); await directAmount.press("Tab");
          await expect(direct.locator(".vv-minimum-warning")).toHaveCount(0);
        }
        expect(errors).toEqual([]);
        console.log(`PASS Modellportfolio RB${risk} ${action}: live 80k/125k/45k, threshold, actual action, IST/PLAN/ZIELPLAN/VERGLEICH, details, XLSX, JSON and reload`);
      });
    }
  });
}
