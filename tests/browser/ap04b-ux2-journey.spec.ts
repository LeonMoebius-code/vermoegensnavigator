import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { savingsDemoInputs } from "../../app/presentation/retirement/retirement-model-demo";
import { publicCatalog } from "../../app/domain/retirement/catalog-validation";
import { calculateM1, calculateM2 } from "../../app/domain/retirement/savings-model";
import type { Catalog } from "../../app/domain/retirement/catalog-contract";
import { reference, revisionHash } from "../../app/domain/retirement/identity-contract";

const button = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
const input = (p: Page, label: string) => p.getByLabel(label, { exact: true });
const scenarioNames = ["Defensivere Marktannahme", "Mittlere Marktannahme", "Höhere Marktannahme"];
const capture = async (p: Page, info: TestInfo, name: string) => {
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await p.locator(".retirement-view").screenshot({ path: info.outputPath(`${name}.png`), animations: "disabled" });
};
async function entry(p: Page) {
  await p.goto("./");
  await p.locator(".sidebar nav").getByRole("button", { name: "Altersvorsorge", exact: true }).click();
}
async function noOverflow(p: Page) {
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await p.evaluate(() => innerWidth));
}
async function runNeutral(p: Page) {
  await p.getByLabel(/Die sichtbaren neutralen Modellannahmen/).check();
  await button(p, "Neutrale Kapitalentwicklung berechnen").click();
}

for (const width of [375, 768, 1280]) test(`UX01/03/04/06–13/24/26/33/34/37–39 guided journey at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  await entry(page);
  const start = button(page, "Neue Altersvorsorge planen");
  await expect(start).toBeVisible();
  await expect(button(page, "B – Bestehende Riester-Rente prüfen")).toBeVisible();
  await capture(page, info, `01-Einstieg-${width}`);
  await start.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Ihre Situation und Förderung" })).toBeFocused();
  await button(page, "Meine Voraussetzungen prüfen").click();
  await input(page, "Für welches Jahr möchten Sie erstmals einzahlen?").fill("2027");
  await button(page, "Weiter").click();
  await expect(page.getByRole("heading", { name: "Erwerb und Versicherung", exact: true })).toBeFocused();
  await page.getByRole("radio", { name: /Angestellt und in der deutschen/ }).check();
  await expect(page.getByRole("region", { name: "Vorläufige Förderorientierung" })).toContainText("endgültige Berechtigung und Förderhöhe");
  await noOverflow(page);
  await capture(page, info, `02-Foerderstatus-${width}`);
  await button(page, "Weiter zum eigenen Sparplan").click();
  await expect(page.getByRole("group", { name: "Beitragsziele" }).getByRole("button")).toHaveCount(5);
  await input(page, "Ab wann möchten Sie sparen?").fill("2027-10");
  await input(page, "Bis wann möchten Sie sparen?").fill("2027-12");
  await page.getByText("Eigene Einmalzahlung ergänzen", { exact: true }).click();
  await input(page, "Zusätzliche eigene Einmalzahlung einplanen").check();
  await input(page, "Einmalzahlung in Euro").fill("90");
  await input(page, "Monat der Einmalzahlung").fill("2027-12");
  await page.getByTestId("customer-annual-input").fill("120,01");
  await expect(page.getByTestId("contribution-explanation")).toContainText("0,01 € Centausgleich im Monat 2027-12");
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await noOverflow(page);
  await capture(page, info, `03-Beitrag-${width}`);
  await button(page, "Weiter zum Produktvergleich").click();
  await expect(page.locator(".retirement-product-question fieldset")).toHaveCount(1);
  await capture(page, info, `04-Produktfrage-${width}`);
  await button(page, "Weiter").click();
  await button(page, "Weiter").click();
  await button(page, "Produkte anzeigen").click();
  const cards = page.locator(".retirement-product-grid");
  await expect(cards.getByRole("article")).toHaveCount(6);
  await capture(page, info, `05-Produktkarten-${width}`);
  await cards.getByRole("checkbox").nth(0).check();
  await cards.getByRole("checkbox").nth(1).check();
  await button(page, "Direktvergleich öffnen").click();
  await expect(page.locator(".retirement-product-matrix")).toHaveAttribute("data-columns", "2");
  await capture(page, info, `06-Vergleich-zwei-${width}`);
  await button(page, "Zurück zu den Produktkarten").click();
  await cards.getByRole("checkbox").nth(2).check();
  await cards.getByRole("checkbox").nth(3).click();
  await expect(cards.getByRole("checkbox").nth(3)).not.toBeChecked();
  await button(page, "Direktvergleich öffnen").click();
  await expect(page.locator(".retirement-product-matrix")).toHaveAttribute("data-columns", "3");
  await noOverflow(page);
  await capture(page, info, `07-Vergleich-drei-${width}`);
  await button(page, "Weiter zur Kapitalentwicklung").click();
  await page.getByText("Zahlungsplan und Modellannahmen bearbeiten", { exact: true }).click();
  await expect(input(page, "Eigene monatliche Einzahlung in Euro")).toHaveValue("10,00");
  for (const name of scenarioNames) for (const asset of ["Aktienrendite", "Rentenrendite"])
    await input(page, `${name}: ${asset} p.a. in %`).fill("0");
  await page.getByText("Zahlungsplan und Modellannahmen bearbeiten", { exact: true }).click();
  await runNeutral(page);
  await expect(page.getByTestId("customer-end-value")).toHaveText(["120,01 €", "120,01 €", "120,01 €"]);
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  await page.getByText("Verlaufswerte als Tabelle", { exact: true }).click();
  await page.getByText("Mittlere Annahme · 3 Werte", { exact: true }).click();
  const table = page.getByRole("table", { name: "Mittlere Annahme – Originalwerte des Rechenkerns" });
  await expect(table.getByRole("row").last()).toContainText("2027-12");
  await expect(table.getByRole("row").last()).toContainText("120,01 €");
  await expect(page.getByText(/Berateransicht · Beträge/)).toBeVisible();
  await noOverflow(page);
  await capture(page, info, `08-Neutrales-Modell-${width}`);
  await button(page, "M1 · Kostenvergleich").click();
  const vendor = page.getByRole("region", { name: "Herstellerrechnung" });
  await expect(vendor).toContainText("Nicht berechenbar · Kosten offen (O)");
  await expect(vendor).toContainText("P1-Anzeigekanal");
  await expect(page.getByTestId("scenario-line")).toHaveCount(0);
  await capture(page, info, `09-Kosten-offen-${width}`);
  await button(page, "Synthetische Demonstration öffnen").click();
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  await noOverflow(page);
  await capture(page, info, `10-Modell-M1-${width}`);
  await page.locator(".retirement-demo").screenshot({ path: info.outputPath(`10-M1-Verlauf-${width}.png`) });
  await button(page, "M2 · Anlageportfolio").click();
  await button(page, "Synthetische Demonstration öffnen").click();
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  await noOverflow(page);
  await capture(page, info, `11-Modell-M2-${width}`);
  await page.locator(".retirement-demo").screenshot({ path: info.outputPath(`11-M2-Verlauf-${width}.png`) });
  await expect(page.getByRole("button", { name: /Speichern|Export/i }).and(page.locator(".retirement-view button"))).toHaveCount(0);
  expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
});

test("UX25–32/36: synthetic controls, exact cost conventions, crash and rebalancing", async ({ page }) => {
  await entry(page);
  await button(page, "Neue Altersvorsorge planen").click();
  await button(page, "A4 Kapitalentwicklung").click();
  for (const [mode, value, convention] of [
    ["M1 · Kostenvergleich", "10.064,34 €", "M1_additive_v1"],
    ["M2 · Anlageportfolio", "10.062,79 €", "M2_balance_factor_v1"],
  ]) {
    await button(page, mode).click();
    await expect(page.getByTestId("demo-end")).toHaveCount(0);
    await button(page, "Synthetische Demonstration öffnen").click();
    await input(page, "Welche Modellwirkung möchten Sie sehen?").selectOption("control");
    const demo = page.getByRole("region", { name: "Synthetische Modelldemonstration" });
    await expect(demo).toContainText("Demonstrationsrechnung mit synthetischen Daten");
    await expect(demo).toContainText(convention);
    await expect(demo.getByTestId("demo-end")).toHaveText([value, value, value]);
    await expect(demo).not.toContainText(/Union|R\+V|Leibrente|iCPPI/);
    await demo.getByText("Fachebene · Katalog, Quelle und Rechenstand", { exact: true }).click();
    await expect(demo.getByText(/Kostenevidenz S/)).toBeVisible();
    await expect(demo).toContainText("ux2-demo-1-tariff");
  }
  await input(page, "Welche Modellwirkung möchten Sie sehen?").selectOption("crash");
  await expect(page.getByTestId("demo-end")).toHaveText(["920,00 €", "920,00 €", "920,00 €"]);
  await page.getByText(/Berateransicht · Kosten, Anlagerisiko/).click();
  const row = page.getByRole("table", { name: "Mittleres Szenario · Original-Monatsabschluss" }).getByRole("row").last();
  await expect(row).toContainText("100,00 €");
  await expect(row).toContainText("480,00 € / 440,00 €");
  await input(page, "Welche Modellwirkung möchten Sie sehen?").selectOption("rebalance");
  await expect(page.getByTestId("demo-end")).toHaveText(["1.250,00 €", "1.250,00 €", "1.250,00 €"]);
  await expect(row).toContainText("750,00 € / 500,00 €");
  await expect(row.getByRole("cell").last()).toHaveText("Ja");
});

test("UX36: P1 display authorizes only the explicit synthetic snapshot; reject changed bindings and open publication", () => {
  const { inputsM1, inputsM2 } = savingsDemoInputs("control", 0);
  expect(publicCatalog(inputsM1.catalog, "display").ok).toBe(true);
  expect(publicCatalog(inputsM1.catalog, "export").ok).toBe(false);
  const internal = structuredClone(inputsM1.catalog as Catalog);
  const last = internal.records.at(-1)!;
  const restricted = { ...last, publication: { state: "internal" } } as typeof last;
  const sealed = { ...restricted, hash: revisionHash(restricted) };
  internal.records[internal.records.length - 1] = sealed;
  internal.current[internal.current.length - 1] = reference(sealed);
  internal.hash = revisionHash(internal);
  expect(publicCatalog(internal, "display")).toMatchObject({ ok: false });
  const restrictedCalculation = calculateM1(JSON.stringify({ ...inputsM1, catalog: internal,
    catalog_ref: { ...inputsM1.catalog_ref, hash: internal.hash } }));
  expect(restrictedCalculation).toMatchObject({ ok: false });
  expect(JSON.stringify(restrictedCalculation)).not.toContain("ux2-demo-");
  expect(calculateM1('{"__proto__":{"model_version":"avd.m1.v1"}}').ok).toBe(false);
  for (const [calculator, data] of [[calculateM1, inputsM1], [calculateM2, inputsM2]] as const) {
    expect(calculator(JSON.stringify(data)).ok).toBe(true);
    expect(calculator("{").ok).toBe(false);
    expect(calculator(Object.create({ ...data })).ok).toBe(false);
    expect(calculator(JSON.stringify({ ...data, catalog_ref: { ...data.catalog_ref, revision: 2 } })).ok).toBe(false);
  }
});

test("UX02/05/19–23/35: navigation preserves a valid preview, changes revoke it, discard can be canceled", async ({ page }) => {
  await entry(page);
  await button(page, "Neue Altersvorsorge planen").click();
  await button(page, "Meine Voraussetzungen prüfen").click();
  await button(page, "Weiter zum eigenen Sparplan").click();
  await button(page, "A4 Kapitalentwicklung").click();
  await runNeutral(page);
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  await button(page, "A3 Produktvergleich").click();
  await button(page, "A4 Kapitalentwicklung").click();
  await expect(page.getByLabel(/Die sichtbaren neutralen Modellannahmen/)).toBeChecked();
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  await button(page, "A/B-Auswahl").click();
  page.once("dialog", dialog => dialog.dismiss());
  await button(page, "B – Bestehende Riester-Rente prüfen").click();
  await expect(page.getByRole("heading", { name: "Altersvorsorge", exact: true })).toBeVisible();
  await button(page, "Neue Altersvorsorge planen").click();
  await button(page, "A4 Kapitalentwicklung").click();
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  await button(page, "A1 Fördercheck").click();
  await input(page, "In welchem Jahr sind Sie geboren? (optional)").fill("2000");
  await button(page, "A4 Kapitalentwicklung").click();
  await expect(page.getByRole("status").filter({ hasText: "Vorschau ist veraltet" })).toBeVisible();
  await expect(page.getByTestId("customer-end-value")).toHaveCount(0);
  await button(page, "A2 Sparen & Förderung").click();
  await input(page, "Wie viel möchten Sie monatlich einzahlen?").fill("-1");
  await button(page, "Weiter zum Produktvergleich").click();
  await expect(input(page, "Wie viel möchten Sie monatlich einzahlen?")).toBeFocused();
  await expect(input(page, "Wie viel möchten Sie monatlich einzahlen?")).toHaveAttribute("aria-invalid", "true");
});


test("UX05/22: A1 contract and child changes revoke dependent evidence and the neutral preview", async ({ page }) => {
  await entry(page);
  await button(page, "Neue Altersvorsorge planen").click();
  await button(page, "Meine Voraussetzungen prüfen").click();
  await page.getByRole("button", { name: /Bestehende Vorsorge und Kinder$/ }).click();
  const group = (name: RegExp) => page.getByRole("group", { name });
  await group(/bereits einen Riester-Vertrag/).getByRole("radio", { name: "Nein", exact: true }).check();
  await group(/aktuell Kindergeld/).getByRole("radio", { name: "Nein", exact: true }).check();
  await button(page, "Weiter zum eigenen Sparplan").click();
  await page.getByText("Beraterprüfung: Förderung und Sonderfälle", { exact: true }).click();
  await input(page, "Wurde Ihre Förderberechtigung bereits geklärt?").selectOption("checked");
  await input(page, "Geprüfte unmittelbare Berechtigung").selectOption("direct_confirmed");
  await input(page, "Geprüfte Förderregelung").selectOption("new_confirmed");
  await input(page, "Geprüfte Vertragszuordnung").selectOption("single_eligible_confirmed");
  await input(page, "Für Person und Jahr geprüft: keine einzubeziehenden Kinder").check();
  const contribution = input(page, "Den geplanten Jahres-Eigenbeitrag für Person, Vertrag und Jahr fachlich als förderfähig geprüft");
  await contribution.check();
  await expect(page.getByTestId("customer-base-grant")).toHaveText("390,00 €");
  await button(page, "A4 Kapitalentwicklung").click();
  await runNeutral(page);
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  await button(page, "A1 Fördercheck").click();
  await group(/aktuell Kindergeld/).getByRole("radio", { name: "Ja", exact: true }).check();
  await button(page, "A2 Sparen & Förderung").click();
  await page.getByText("Beraterprüfung: Förderung und Sonderfälle", { exact: true }).click();
  await expect(input(page, "Geprüfte unmittelbare Berechtigung")).toHaveValue("direct_confirmed");
  await expect(contribution).toBeChecked();
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await button(page, "A4 Kapitalentwicklung").click();
  await expect(page.getByTestId("scenario-line")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Vorschau ist veraltet" })).toBeVisible();
  await button(page, "A1 Fördercheck").click();
  await group(/bereits einen Riester-Vertrag/).getByRole("radio", { name: "Ja", exact: true }).check();
  await button(page, "A2 Sparen & Förderung").click();
  await page.getByText("Beraterprüfung: Förderung und Sonderfälle", { exact: true }).click();
  await expect(input(page, "Geprüfte unmittelbare Berechtigung")).toHaveValue("direct_confirmed");
  await expect(input(page, "Geprüfte Vertragszuordnung")).toHaveValue("unconfirmed");
  await expect(contribution).not.toBeChecked();
});
