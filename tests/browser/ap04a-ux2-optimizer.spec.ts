import { test, expect, type Page } from "@playwright/test";
const label = (p: Page, name: string) => p.getByLabel(name, { exact: true });
async function enter(p: Page) {
  await p.goto("./"); await p.locator(".sidebar nav").getByRole("button", { name: /Altersvorsorge/ }).click();
  await p.getByRole("button", { name: "Neue Altersvorsorge planen", exact: true }).click();
  await p.getByRole("button", { name: "Meine Voraussetzungen prüfen", exact: true }).click();
  await p.getByRole("button", { name: "Weiter zum eigenen Sparplan", exact: true }).click();
}
async function october(p: Page) {
  await label(p, "Ab wann möchten Sie sparen?").fill("2027-10");
  await label(p, "Bis wann möchten Sie sparen?").fill("2027-12");
  await label(p, "Wie viel möchten Sie monatlich einzahlen?").fill("10");
}
const target = (p: Page, text: string) => p.getByRole("group", { name: "Beitragsziele", exact: true }).getByRole("button", { name: new RegExp(`^${text}`) });
async function zero(p: Page) {
  await p.getByText("Feineinstellungen und Modellannahmen", { exact: true }).click();
  for (const scenario of ["Zurückhaltend", "Mittlere Annahme", "Höhere Annahme"]) for (const asset of ["Aktienrendite", "Rentenrendite"])
    await label(p, `${scenario}: ${asset} in % p. a.`).fill("0");
}

test("UX2 UI October minimum, target sync, manual override and no stale curve", async ({ page }) => {
  await enter(page); await october(page);
  await expect(page.getByTestId("customer-annual")).toContainText("30,00 €");
  await expect(page.getByTestId("contribution-explanation")).toContainText("fehlen 90,00 €");
  await expect(page.getByTestId("conditional-base-grant")).toHaveText("0,00 €");
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await target(page, "Förder-Mindestbeitrag").focus(); await page.keyboard.press("Enter");
  await expect(target(page, "Förder-Mindestbeitrag")).toHaveAttribute("aria-pressed", "true");
  await expect(label(page, "Wie viel möchten Sie monatlich einzahlen?")).toHaveValue("40,00");
  await expect(page.getByTestId("customer-annual")).toContainText("120,00 €");
  await expect(page.getByTestId("conditional-base-grant")).toHaveText("60,00 €");
  await zero(page); await page.getByRole("button", { name: "Modellrechnung anzeigen", exact: true }).click();
  for (const v of await page.getByTestId("customer-end-value").allTextContents()) expect(v).toBe("120,00 €");
  await label(page, "Wie viel möchten Sie monatlich einzahlen?").fill("45");
  await expect(page.getByTestId("contribution-mode")).toHaveText("Individuell");
  await expect(target(page, "Förder-Mindestbeitrag")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("customer-annual")).toContainText("135,00 €");
  await expect(page.getByTestId("scenario-line")).toHaveCount(0);
  await page.getByRole("button", { name: "Modellrechnung anzeigen", exact: true }).click();
  for (const v of await page.getByTestId("customer-end-value").allTextContents()) expect(v).toBe("135,00 €");
});

test("UX2 UI annual amount and dated one-off reach the exact same model", async ({ page }) => {
  await enter(page); await october(page);
  await page.getByText("Eigene Einmalzahlung ergänzen", { exact: true }).click();
  await label(page, "Zusätzliche eigene Einmalzahlung einplanen").check();
  await label(page, "Einmalzahlung in Euro").fill("90"); await label(page, "Monat der Einmalzahlung").fill("2027-11");
  await expect(page.getByTestId("customer-annual")).toContainText("120,00 €");
  await page.getByTestId("customer-annual-input").fill("120,01");
  await expect(label(page, "Wie viel möchten Sie monatlich einzahlen?")).toHaveValue("10,00");
  await expect(page.getByTestId("contribution-explanation")).toContainText("0,01 € Centausgleich im Monat 2027-12");
  await expect(page.getByTestId("customer-annual")).toContainText("120,01 €");
  await expect(page.getByTestId("conditional-base-grant")).toHaveCount(0);
  await expect(page.getByTestId("conditional-funding-status")).toContainText("Centbruchteil");
  await zero(page); await page.getByRole("button", { name: "Modellrechnung anzeigen", exact: true }).click();
  for (const v of await page.getByTestId("customer-end-value").allTextContents()) expect(v).toBe("120,01 €");
});

test("UX2 UI annual validation focuses field and preserves other entries", async ({ page }) => {
  await enter(page); await october(page); await target(page, "Höchste Grundzulage").click();
  await page.getByTestId("customer-annual-input").fill("120,001");
  await expect(page.getByTestId("customer-annual-input")).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Modellrechnung anzeigen", exact: true }).click();
  await expect(page.getByTestId("customer-annual-input")).toBeFocused();
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await expect(page.getByTestId("conditional-base-grant")).toHaveCount(0);
  await expect(label(page, "Ab wann möchten Sie sparen?")).toHaveValue("2027-10");
  await page.getByTestId("customer-annual-input").fill("120");
  await expect(page.getByTestId("customer-annual-input")).toHaveAttribute("aria-invalid", "false");
});

test("UX2 UI target and annual intent survive back navigation without confirming evidence", async ({ page }) => {
  await enter(page); await october(page); await target(page, "Erste Grundförderstufe voll").click();
  await page.getByRole("button", { name: "Zurück zu meinen Voraussetzungen", exact: true }).click();
  await page.getByRole("button", { name: "Weiter zum eigenen Sparplan", exact: true }).click();
  await expect(target(page, "Erste Grundförderstufe voll")).toHaveAttribute("aria-pressed", "true");
  await expect(label(page, "Wie viel möchten Sie monatlich einzahlen?")).toHaveValue("120,00");
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await expect(page.getByTestId("conditional-funding")).toContainText("bedingt");
});

for (const width of [375, 768, 1280]) test(`UX2 UI ${width}px readable targets, focus and no horizontal overflow`, async ({ page, browser }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await enter(page); await october(page);
  await target(page, "Förder-Mindestbeitrag").focus(); await page.keyboard.press("Enter");
  await expect(target(page, "Förder-Mindestbeitrag")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (width === 1280) {
    // A 2x browser scale uses half as many CSS pixels. Root CSS zoom alone
    // leaves media queries at 1280px and is not browser-zoom emulation.
    const scaled = await browser.newContext({ viewport: { width: 640, height: 500 }, deviceScaleFactor: 2 });
    try {
      const zoomPage = await scaled.newPage(); await enter(zoomPage); await october(zoomPage);
      await target(zoomPage, "Förder-Mindestbeitrag").focus(); await zoomPage.keyboard.press("Enter");
      await expect(target(zoomPage, "Förder-Mindestbeitrag")).toBeFocused();
      await expect(label(zoomPage, "Wie viel möchten Sie monatlich einzahlen?")).toHaveValue("40,00");
      expect(await zoomPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await zoomPage.screenshot({ path: info.outputPath("optimizer-200-percent.png"), fullPage: true });
    } finally { await scaled.close(); }
  }
  await page.screenshot({ path: info.outputPath(`optimizer-${width}.png`), fullPage: true });
});
