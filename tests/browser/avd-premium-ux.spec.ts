import { expect, test, type Page } from "@playwright/test";
import { enterStep, retirementButton, retirementInput } from "./ap04b-ux2-helpers";

async function enter(page: Page) {
  await page.goto("./");
  await page.locator(".sidebar nav").getByRole("button", { name: /Altersvorsorge/ }).click();
  await retirementButton(page, "Neue Altersvorsorge planen").click();
}

test("AVD A1/A2: Sonderfragen, gemeinsamer Beitrag und beide Endmonate im Konflikt", async ({ page }) => {
  await enter(page);
  await retirementButton(page, "Meine Voraussetzungen prüfen").click();
  await retirementInput(page, "In welchem Jahr sind Sie geboren? (optional)").fill("1980");
  await retirementButton(page, "Weiter").click();
  await page.getByRole("radio", { name: "Selbstständig oder freiberuflich" }).check();
  await expect(page.getByTestId("funding-orientation")).toContainText("Auch Selbstständige");
  await retirementButton(page, "Weiter").click();
  await expect(page.getByRole("group", { name: "Welche Versicherungssituation trifft auf Sie zu?" })).toBeVisible();
  await retirementButton(page, "Weiter zum eigenen Sparplan").click();

  const rate = retirementInput(page, "Wie viel möchten Sie monatlich einzahlen?");
  await rate.fill("125,47");
  await retirementButton(page, "Berateransicht").click();
  await expect(rate).toHaveValue("125,47");
  await retirementButton(page, "Kundenansicht").click();
  await expect(page.getByTestId("customer-annual")).toContainText("1.505,64 €");

  await page.getByText("Sparende und Bewertung getrennt festlegen", { exact: true }).click();
  await retirementInput(page, "Art des Zahlungsplans").selectOption("end_age");
  await retirementInput(page, "Geburtsmonat als Modellannahme").selectOption("4");
  await retirementInput(page, "Beitragsende direkt annehmen").fill("2047-01");
  await retirementButton(page, "Diesen Monat übernehmen").click();
  await retirementInput(page, "Spar-Endalter").fill("68");
  await expect(page.getByRole("status").filter({ hasText: "Konflikt:" })).toContainText("gesetzter Monat 2047-01, neu abgeleitet 2048-03");
  await expect(page.getByTestId("planned-annual-contribution")).toHaveCount(0);
  await enterStep(page, "A4");
  await expect(page.getByTestId("premium-comparison")).toHaveCount(0);
  await expect(page.getByText(/Endmonatkonflikt in A2/)).toBeVisible();
  await page.getByText("Sparende und Auszahlbeginn", { exact: true }).click();
  await retirementButton(page, "Neu abgeleiteten Endmonat übernehmen").click();
  await expect(page.getByRole("figure", { name: "Kapitalverlauf nach Szenario" })).toBeVisible();
});

test("AVD A3: gemeinsamer Zwei- und Drei-Produktvergleich, offene Werte bleiben sichtbar", async ({ page }) => {
  await enter(page);
  await enterStep(page, "A3");
  await retirementButton(page, "Alle Produkte ansehen").click();
  const overview = page.locator(".avd-product-overview");
  await expect(overview.getByRole("checkbox")).toHaveCount(6);
  await overview.getByRole("checkbox", { name: /UniVorsorge Basis/ }).check();
  await overview.getByRole("checkbox", { name: /UniVorsorge Pro/ }).check();
  await retirementButton(page, "Direktvergleich öffnen").click();
  await expect(page.getByRole("list", { name: "Gewählte Alternativen" }).getByRole("listitem")).toHaveCount(2);
  await page.getByRole("checkbox", { name: "Nur Unterschiede anzeigen" }).check();
  await expect(page.getByRole("heading", { name: "Auszahlungsarten", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kosten und Datenstand" })).toBeVisible();
  await expect(page.getByText(/Für alle gewählten Union-Produkte/)).toBeVisible();
  await retirementButton(page, "Zurück zu den Produktkarten").click();
  await overview.getByRole("checkbox", { name: /AltersvorsorgeDepot standard/ }).check();
  await retirementButton(page, "Direktvergleich öffnen").click();
  await expect(page.getByRole("list", { name: "Gewählte Alternativen" }).getByRole("listitem")).toHaveCount(3);
  await page.getByRole("checkbox", { name: "Nur Unterschiede anzeigen" }).check();
  await expect(page.getByRole("heading", { name: "Auszahlungsarten", exact: true })).toBeVisible();
  await enterStep(page, "A4");
  await retirementButton(page, "Wirtschaftlicher Vergleich").click();
  await expect(page.getByText("Produkte im Vergleich · 3 von 3")).toBeVisible();
  await expect(page.getByText(/keine Tarif- und Kostenwerte/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Berichtsausgabe" })).toHaveCount(0);
});

test("AVD A4: Szenario, exakte Rendite, negativer Kapitalaufbau, Wertbasis und Tastatur", async ({ page }) => {
  await enter(page);
  await enterStep(page, "A4");
  const figure = page.getByRole("figure", { name: "Kapitalverlauf nach Szenario" });
  const scenarios = page.getByRole("group", { name: "Renditeszenarien anzeigen" });
  await expect(scenarios.getByRole("button")).toHaveCount(3);
  await expect(scenarios.getByRole("button", { name: /^6 % p\. a\./ })).toHaveAttribute("aria-pressed", "true");
  await scenarios.getByRole("button", { name: /^9 % p\. a\./ }).click();
  await expect(figure.getByRole("listitem").filter({ hasText: /^9 % · gewählt$/ })).toBeVisible();
  const rate = retirementInput(page, "Jährliche Bruttogesamtrendite in %");
  await rate.fill("6,23");
  await expect(scenarios.getByRole("button", { name: /^9,23 % p\. a\./ })).toHaveAttribute("aria-pressed", "true");
  const explore = figure.getByRole("slider", { name: /Monatswerte erkunden/ });
  await explore.focus();
  await page.keyboard.press("Home");
  await expect(explore).toHaveAttribute("aria-valuetext", /^01\/2027/);
  await page.keyboard.press("ArrowRight");
  await expect(explore).toHaveAttribute("aria-valuetext", /^02\/2027/);

  await page.getByText("Wertetabelle · Kapitalverlauf nach Szenario", { exact: true }).click();
  await expect(figure.getByRole("table").getByRole("row", { name: /^02\/2027/ })).toBeVisible();
  await rate.fill("-8");
  await expect(page.locator(".avd-capital-build > dl > div").filter({ hasText: "Wertentwicklung" })).toContainText(/-\d/);
  await retirementButton(page, "Kaufkraft").click();
  await retirementInput(page, "Preisbezugsmonat · optional").fill("2027-02");
  await expect(page.getByText(/Kaufkraft in Preisen von 02\/2027/)).toBeVisible();
  await retirementInput(page, "Inflationsannahme pro Jahr in %").fill("-100");
  await expect(figure).toHaveCount(0);
  await expect(page.getByText(/Inflationsannahme über −100/)).toBeVisible();
  await retirementButton(page, "Nominal").click();
  await expect(figure).toBeVisible();
});


test("R90-N3: anbieterübergreifender Filter und Rückkehr zur vollständigen Matrix", async ({ page }) => {
  await enter(page);
  await enterStep(page, "A3");
  await retirementButton(page, "Alle Produkte ansehen").click();
  const overview = page.locator(".avd-product-overview");
  await overview.getByRole("checkbox", { name: /UniVorsorge Basis/ }).check();
  await overview.getByRole("checkbox", { name: /AltersvorsorgeDepot standard/ }).check();
  await retirementButton(page, "Direktvergleich öffnen").click();
  const toggle = page.getByRole("checkbox", { name: "Nur Unterschiede anzeigen" });
  const rows = page.locator(".retirement-product-row");
  const protection = page.getByRole("heading", { name: "Schutz zum Ablauf", exact: true });
  const assertFilter = async () => {
    await expect(rows).toHaveCount(7);
    await toggle.check();
    await expect(rows).toHaveCount(6);
    await expect(protection).toHaveCount(0);
    await expect(page.getByText("Für alle gewählten Produkte ist zum Auszahlbeginn keine Beitragsgarantie angekündigt.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Auszahlungsarten", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kosten und Datenstand", exact: true })).toBeVisible();
    await toggle.uncheck();
    await expect(protection).toBeVisible();
    await expect(rows).toHaveCount(7);
  };
  await assertFilter();
  await retirementButton(page, "Zurück zu den Produktkarten").click();
  await overview.getByRole("checkbox", { name: /AltersvorsorgeDepot individuell/ }).check();
  await retirementButton(page, "Direktvergleich öffnen").click();
  await assertFilter();
});
