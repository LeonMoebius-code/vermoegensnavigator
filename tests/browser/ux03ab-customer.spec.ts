import { test, expect, type Page } from "@playwright/test";
import { gzipSync } from "node:zlib";
const label = (p: Page, name: string) => p.getByLabel(name, { exact: true });
async function enter(p: Page) { await p.goto("./"); await p.locator(".sidebar nav").getByRole("button", { name: /Altersvorsorge/ }).click(); await p.getByRole("button", { name: "Neue Altersvorsorge planen", exact: true }).click(); await p.getByRole("button", { name: "Meine Voraussetzungen prüfen", exact: true }).click(); await p.getByRole("button", { name: "Weiter zum eigenen Sparplan", exact: true }).click(); }
async function advisor(p: Page) { if (!await label(p, "Wurde Ihre Förderberechtigung bereits geklärt?").isVisible()) await p.getByText("Beraterprüfung: Förderung und Sonderfälle", { exact: true }).click(); }
async function zero(p: Page) {
  await label(p, "Ab wann möchten Sie sparen?").fill("2027-10"); await label(p, "Bis wann möchten Sie sparen?").fill("2027-12");
  await p.getByText("Feineinstellungen und Modellannahmen", { exact: true }).click();
  for (const scenario of ["Zurückhaltend", "Mittlere Annahme", "Höhere Annahme"]) for (const asset of ["Aktienrendite", "Rentenrendite"])
    await label(p, `${scenario}: ${asset} in % p. a.`).fill("0");
}
const calculate = (p: Page) => p.getByRole("button", { name: "Modellrechnung anzeigen", exact: true }).click();

test("UX03 U1: four payment questions after guided entry, no checkboxes, open funding plus three actual curves", async ({ page }) => {
  await enter(page);
  await expect(page.locator(".retirement-customer-inputs input:visible, .retirement-customer-inputs select:visible")).toHaveCount(4);
  await expect(page.locator(".retirement-customer input[type=checkbox]:visible")).toHaveCount(0);
  await expect(page.getByTestId("customer-grant-status")).toHaveText("Gemeinsam prüfen");
  await calculate(page);
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  await expect(page.getByRole("region", { name: "Ihre Ergebnisse" })).toBeFocused();
  await advisor(page); await label(page, "Gibt es Kinder, für die eine Kinderzulage infrage kommt?").selectOption("no");
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await expect(page.getByTestId("customer-own")).toContainText("36.000,00 €");
});

test("UX03 one central rate, October first year, no annualisation or stale results", async ({ page }) => {
  await enter(page); await zero(page); await calculate(page);
  await expect(page.getByTestId("customer-annual")).toContainText("300,00 €");
  for (const v of await page.getByTestId("customer-end-value").allTextContents()) expect(v).toBe("300,00 €");
  await label(page, "Wie viel möchten Sie monatlich einzahlen?").fill("200");
  await expect(page.getByTestId("scenario-line")).toHaveCount(0);
  await expect(page.getByTestId("customer-annual")).toContainText("600,00 €");
  await calculate(page); for (const v of await page.getByTestId("customer-end-value").allTextContents()) expect(v).toBe("600,00 €");
  await page.getByText("Verlaufswerte als Tabelle", { exact: true }).click();
  await page.getByText("Mittlere Annahme · 3 Werte", { exact: true }).click();
  await expect(page.getByRole("table", { name: "Mittlere Annahme – Originalwerte des Rechenkerns" })).toContainText("2027-12");
});

test("UX03 U2: two unassigned children do not block independent capital", async ({ page }) => {
  await enter(page); await advisor(page); await label(page, "Gibt es Kinder, für die eine Kinderzulage infrage kommt?").selectOption("yes");
  await advisor(page);
  await page.getByRole("button", { name: "Kind zur Prüfung hinzufügen" }).click(); await page.getByRole("button", { name: "Kind zur Prüfung hinzufügen" }).click();
  await calculate(page); await expect(page.getByTestId("scenario-line")).toHaveCount(3); await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await expect(page.getByLabel("Kind 2: Förderfähigkeit und Zuordnung", { exact: true })).toHaveValue("assignment_unconfirmed");
});

test("UX03 customer Yes never confirms a grant; advisor evidence required and revoked", async ({ page }) => {
  await enter(page); await advisor(page); await label(page, "Wurde Ihre Förderberechtigung bereits geklärt?").selectOption("checked");
  await advisor(page); await label(page, "Gibt es Kinder, für die eine Kinderzulage infrage kommt?").selectOption("no");
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await advisor(page);
  await label(page, "Geprüfte unmittelbare Berechtigung").selectOption("direct_confirmed"); await label(page, "Geprüfte Förderregelung").selectOption("new_confirmed"); await label(page, "Geprüfte Vertragszuordnung").selectOption("single_eligible_confirmed");
  await label(page, "Für Person und Jahr geprüft: keine einzubeziehenden Kinder").check();
  await label(page, "Den geplanten Jahres-Eigenbeitrag für Person, Vertrag und Jahr fachlich als förderfähig geprüft").check();
  await expect(page.getByTestId("customer-base-grant")).toHaveText("390,00 €");
  await label(page, "Wie viel möchten Sie monatlich einzahlen?").fill("150");
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await expect(label(page, "Geprüfte unmittelbare Berechtigung")).toHaveValue("direct_confirmed");
  await expect(label(page, "Den geplanten Jahres-Eigenbeitrag für Person, Vertrag und Jahr fachlich als förderfähig geprüft")).not.toBeChecked();
  await label(page, "Ab wann möchten Sie sparen?").fill("2028-01");
  await expect(label(page, "Geprüfte unmittelbare Berechtigung")).toHaveValue("unconfirmed");
});

test("UX03 malformed amount: local error, keyboard focus, other inputs survive", async ({ page }) => {
  await enter(page); await label(page, "In welchem Jahr sind Sie geboren? (optional)").fill("2004");
  await label(page, "Wie viel möchten Sie monatlich einzahlen?").fill("-1"); await calculate(page);
  await expect(label(page, "Wie viel möchten Sie monatlich einzahlen?")).toBeFocused();
  await expect(label(page, "Wie viel möchten Sie monatlich einzahlen?")).toHaveAttribute("aria-invalid", "true");
  await expect(label(page, "In welchem Jahr sind Sie geboren? (optional)")).toHaveValue("2004");
  await expect(page.getByTestId("scenario-line")).toHaveCount(0);
});

test("UX03 manual grant remains an explicit single hypothesis with local confirmation", async ({ page }) => {
  await enter(page); await zero(page);
  await page.getByText("Prüfansicht: Zulagenereignisse und Rechendetails", { exact: true }).click();
  await label(page, "Einmalige hypothetische Zulage modellieren").check();
  await label(page, "Hypothetische Zulage in Euro").fill("500");
  await label(page, "Hypothetischer Buchungsmonat").fill("2027-12");
  await calculate(page);
  const confirmation = label(page, "Förderjahr, Betrag und Buchungsmonat ausdrücklich als einmalige Hypothese bestätigt");
  await expect(confirmation).toBeFocused(); await expect(confirmation).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("scenario-line")).toHaveCount(0);
  await confirmation.check(); await calculate(page);
  for (const v of await page.getByTestId("customer-end-value").allTextContents()) expect(v).toBe("800,00 €");
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await label(page, "Wie viel möchten Sie monatlich einzahlen?").fill("200");
  await expect(confirmation).not.toBeChecked(); await expect(page.getByTestId("scenario-line")).toHaveCount(0);
});

test("UX03 optional ETF comparison uses the same period and own payments", async ({ page }) => {
  await enter(page); await zero(page);
  await label(page, "Vergleich mit normalem ETF-/Fondssparplan anzeigen").check(); await calculate(page);
  await expect(page.getByTestId("scenario-line")).toHaveCount(6);
  await expect(page.getByTestId("own-line")).toHaveCount(2);
  await expect(page.getByTestId("customer-own")).toContainText("300,00 €");
  await expect(page.getByTestId("customer-retirement")).toContainText("Steuern und unterschiedliche Verfügbarkeit sind nicht berücksichtigt");
});

test("UX03 customer draft survives internal navigation; general storage stays byte-identical", async ({ page }) => {
  await enter(page); const before = await page.evaluate(() => ({ local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage) }));
  await label(page, "Wie viel möchten Sie monatlich einzahlen?").fill("125");
  await page.getByRole("button", { name: "Zurück zur Auswahl", exact: true }).click(); await page.getByRole("button", { name: "Neue Altersvorsorge planen", exact: true }).click(); await page.getByRole("button", { name: "Meine Voraussetzungen prüfen", exact: true }).click(); await page.getByRole("button", { name: "Weiter zum eigenen Sparplan", exact: true }).click();
  await expect(label(page, "Wie viel möchten Sie monatlich einzahlen?")).toHaveValue("125");
  page.once("dialog", d => d.dismiss()); await page.locator(".sidebar nav").getByRole("button", { name: /Beratungsfälle/ }).click();
  await expect(page.getByTestId("customer-retirement")).toBeVisible();
  expect(await page.evaluate(() => ({ local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage) }))).toEqual(before);
});

for (const width of [390, 1440]) test(`UX03 layout and keyboard at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await enter(page); await calculate(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await label(page, "Wie viel möchten Sie monatlich einzahlen?").focus(); await page.keyboard.press("Tab");
  await expect(label(page, "Ab wann möchten Sie sparen?")).toBeFocused();
  const png = await page.screenshot({ path: info.outputPath(`ux03-${width}.png`), fullPage: true });
  console.log(`UX03_SCREENSHOT ${JSON.stringify({ width, gzipBase64: gzipSync(png).toString("base64") })}`);
});
