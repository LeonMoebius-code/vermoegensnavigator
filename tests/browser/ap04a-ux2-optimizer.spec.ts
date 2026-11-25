import { test, expect, type Page } from "@playwright/test";
import { clearNeutralReturns, enterStep, runNeutral } from "./ap04b-ux2-helpers";
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
  await clearNeutralReturns(page); await runNeutral(page);
  for (const v of await page.getByTestId("customer-end-value").allTextContents()) expect(v).toBe("120,00 €");
  await enterStep(page, "A2");
  await label(page, "Wie viel möchten Sie monatlich einzahlen?").fill("45");
  await expect(page.getByTestId("contribution-mode")).toHaveText("Individuell");
  await expect(target(page, "Förder-Mindestbeitrag")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("customer-annual")).toContainText("135,00 €");
  await expect(page.getByTestId("scenario-line")).toHaveCount(0);
  await runNeutral(page);
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
  await clearNeutralReturns(page); await runNeutral(page);
  for (const v of await page.getByTestId("customer-end-value").allTextContents()) expect(v).toBe("120,01 €");
});

test("UX2 UI annual validation focuses field and preserves other entries", async ({ page }) => {
  await enter(page); await october(page); await target(page, "Höchste Grundzulage").click();
  await page.getByTestId("customer-annual-input").fill("120,001");
  await expect(page.getByTestId("customer-annual-input")).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Weiter zum Produktvergleich", exact: true }).click();
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


test("R81-R1-01: excess one-off distinguishes target, actual contribution and conditional grant", async ({ page }) => {
  await enter(page); await october(page); await clearNeutralReturns(page); await enterStep(page, "A2");
  const minimum = target(page, "Förder-Mindestbeitrag");
  const childGoal = target(page, "Kinderzulage voll");
  const annualGoal = label(page, "Jahresziel für das erste Kalenderjahr in Euro");
  const monthly = label(page, "Wie viel möchten Sie monatlich einzahlen?");
  const actual = page.getByTestId("planned-annual-contribution");
  const example = (title: string) => page.locator(".avd-target-examples > div").filter({ has: page.getByText(title, { exact: true }) });
  const minimumExample = example("Förder-Mindestbeitrag");
  const childExample = example("Kinderzulage voll");
  const calculate = () => runNeutral(page);
  async function displayed(goal: string, actualEuro: string, rate: string, grantEuro: string, card: typeof minimum, details = minimumExample) {
    await expect(annualGoal).toHaveValue(goal);
    await expect(actual).toHaveText(`Tatsächlich geplanter Jahresbeitrag: ${actualEuro} €`);
    await expect(page.getByTestId("customer-annual")).toContainText(`${actualEuro} €`);
    await expect(monthly).toHaveValue(rate);
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(details).toContainText(`Tatsächlich geplanter Jahresbeitrag: ${actualEuro} €`);
    await expect(details).toContainText("Für Ihren tatsächlichen Zahlungsplan · bedingter Standardfall");
    await expect(details).toContainText(`Mögliche Grundzulage · bedingt: ${grantEuro} €`);
    await expect(details).not.toContainText("Orientierungsbeispiel");
    await expect(page.getByTestId("conditional-base-grant")).toHaveText(`${grantEuro} €`);
    await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  }
  await minimum.click();
  await page.getByText("Grundlage der Förderziele", { exact: true }).click();
  await expect(minimumExample).toBeVisible();
  await displayed("120,00", "120,00", "40,00", "60,00", minimum);
  await page.getByText("Eigene Einmalzahlung ergänzen", { exact: true }).click();
  const once = label(page, "Zusätzliche eigene Einmalzahlung einplanen");
  await once.check(); await label(page, "Einmalzahlung in Euro").fill("200");
  await label(page, "Monat der Einmalzahlung").fill("2027-11");

  // Fixed independent HOLD oracle: 0 + 200 = 200, conditional base grant 100.
  await displayed("120,00", "200,00", "0,00", "100,00", minimum);
  await expect(minimum).toContainText("Jahresziel: 120,00 €");
  await expect(minimumExample).not.toContainText("60,00 €");
  await expect(page.getByTestId("contribution-explanation")).toContainText("Die Einmalzahlung von 200,00 € bleibt erhalten. Die Monatsrate beträgt 0,00 €.");
  await expect(childExample).toContainText("Orientierungsbeispiel bei exakt 300,00 € Jahresbeitrag · kein individueller Förderanspruch");
  await expect(childExample).toContainText("Mögliche Grundzulage · bedingt: 150,00 €");
  await calculate();
  await expect(page.getByTestId("customer-end-value")).toHaveText(["200,00 €", "200,00 €", "200,00 €"]);
  await expect(page.getByTestId("customer-own")).toContainText("200,00 €");
  await enterStep(page, "A2");
  await page.getByText("Eigene Einmalzahlung ergänzen", { exact: true }).click();
  await page.getByText("Grundlage der Förderziele", { exact: true }).click();
  await expect(page.getByTestId("conditional-funding")).toContainText("Das Kapitalmodell übernimmt dieses bedingte Szenario nicht automatisch.");

  // Switching goals updates the active example without altering the own one-off.
  await childGoal.click();
  await displayed("300,00", "300,00", "33,33", "150,00", childGoal, childExample);
  await expect(label(page, "Einmalzahlung in Euro")).toHaveValue("200");
  await expect(minimumExample).toContainText("Orientierungsbeispiel bei exakt 120,00 € Jahresbeitrag · kein individueller Förderanspruch");
  await expect(minimumExample).toContainText("Mögliche Grundzulage · bedingt: 60,00 €");
  await expect(minimumExample).not.toContainText("Für Ihren tatsächlichen Zahlungsplan");
  await label(page, "Einmalzahlung in Euro").fill("90");
  await displayed("300,00", "300,00", "70,00", "150,00", childGoal, childExample);
  await minimum.click();
  await displayed("120,00", "120,00", "10,00", "60,00", minimum);

  // Returning from an excess one-off to exactly the goal clears the excess notice.
  await label(page, "Einmalzahlung in Euro").fill("200");
  await displayed("120,00", "200,00", "0,00", "100,00", minimum);
  await label(page, "Einmalzahlung in Euro").fill("120");
  await displayed("120,00", "120,00", "0,00", "60,00", minimum);
  await expect(page.getByTestId("contribution-explanation")).not.toContainText("überschreitet Ihr Jahresziel");
  await once.uncheck();
  await displayed("120,00", "120,00", "40,00", "60,00", minimum);
  await expect(page.getByTestId("scenario-line")).toHaveCount(0);
  await calculate();
  await expect(page.getByTestId("customer-end-value")).toHaveText(["120,00 €", "120,00 €", "120,00 €"]);
});
