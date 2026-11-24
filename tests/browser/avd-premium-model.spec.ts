import { expect, test, type Page } from "@playwright/test";
import { enterStep, openGrantEvidence, openNeutralSettings, retirementButton, retirementInput } from "./ap04b-ux2-helpers";

async function enter(page: Page) {
  await page.goto("./");
  await page.locator(".sidebar nav").getByRole("button", { name: /Altersvorsorge/ }).click();
  await retirementButton(page, "Neue Altersvorsorge planen").click();
}

test("MODEL D2-T01–T04 and D2-T40: live total return preserves two decimals and removes stale values", async ({ page }) => {
  await enter(page);
  await enterStep(page, "A4");
  await openNeutralSettings(page);
  await retirementInput(page, "Endmonat des Modells").fill("2027-12");
  await retirementInput(page, "Anfangskapital in Euro").fill("10000");
  await retirementInput(page, "Eigene monatliche Einzahlung in Euro").fill("0");
  const input = retirementInput(page, "Jährliche Bruttogesamtrendite in %");
  const results = page.getByTestId("premium-comparison");
  await expect(results).toContainText("10.600,00 €");
  await input.fill("6,23");
  await expect(results).toContainText("10.623,00 €");
  await page.getByRole("slider", { name: "Bruttogesamtrendite einstellen" }).focus();
  await page.keyboard.press("Escape");
  await expect(input).toHaveValue("6,23");
  await retirementButton(page, "Modellvergleich fixieren").click();
  await expect(results).toContainText("Fixierter bedingter Modellvergleich");
  await enterStep(page, "A3");
  await enterStep(page, "A4");
  await expect(results).toContainText("Fixierter bedingter Modellvergleich");
  await input.fill("15,01");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(results).toHaveCount(0);
  await expect(retirementButton(page, "Modellvergleich fixieren")).toHaveCount(0);
});

test("MODEL X01 / X02: A2 explicitly selects a modeled booking and A4 automatically uses it", async ({ page }) => {
  await enter(page);
  await enterStep(page, "A2");
  await retirementInput(page, "Bis wann möchten Sie sparen?").fill("2028-12");
  await openGrantEvidence(page);
  await retirementInput(page, "Wurde Ihre Förderberechtigung bereits geklärt?").selectOption("checked");
  await retirementInput(page, "Gibt es Kinder, für die eine Kinderzulage infrage kommt?").selectOption("no");
  await retirementInput(page, "Geprüfte unmittelbare Berechtigung").selectOption("direct_confirmed");
  await retirementInput(page, "Geprüfte Förderregelung").selectOption("new_confirmed");
  await retirementInput(page, "Geprüfte Vertragszuordnung").selectOption("single_eligible_confirmed");
  await page.getByLabel("Für Person und Jahr geprüft: keine einzubeziehenden Kinder").check();
  await page.getByLabel("Den geplanten Jahres-Eigenbeitrag für Person, Vertrag und Jahr fachlich als förderfähig geprüft").check();
  await expect(page.getByTestId("customer-base-grant")).toHaveText("390,00 €");
  await expect(retirementInput(page, "Angenommener Buchungsmonat der Förderung")).toHaveValue("2028-06");
  await retirementButton(page, "Förderannahme im Kapitalmodell verwenden").click();
  await enterStep(page, "A4");
  await retirementInput(page, "Jährliche Bruttogesamtrendite in %").fill("0");
  const compare = page.getByTestId("premium-comparison");
  await expect(compare).toContainText("2.790,00 €");
  await page.getByLabel("Vergleich ohne Zulagen", { exact: true }).check();
  await expect(compare).toContainText("2.400,00 €");
  await enterStep(page, "A2");
  await retirementInput(page, "Wie viel möchten Sie monatlich einzahlen?").fill("150");
  await enterStep(page, "A4");
  await expect(compare).toContainText("3.600,00 €");
  await expect(compare).not.toContainText("Mit gewählter Förderannahme");
});

test("MODEL X11: blocked continuation opens the section with the invalid one-off payment", async ({ page }) => {
  await enter(page);
  await enterStep(page, "A2");
  const details = page.getByText("Eigene Einmalzahlung ergänzen", { exact: true });
  await details.click();
  await retirementInput(page, "Zusätzliche eigene Einmalzahlung einplanen").check();
  await details.click();
  await retirementButton(page, "Weiter zum Produktvergleich").click();
  await expect(retirementInput(page, "Monat der Einmalzahlung")).toBeFocused();
  await expect(retirementInput(page, "Monat der Einmalzahlung")).toHaveAttribute("aria-invalid", "true");
});

test("MODEL D2-T45 / D4-T105: direct browser print cannot expose the current preview", async ({ page }) => {
  await enter(page);
  await enterStep(page, "A4");
  const preview = page.getByTestId("premium-comparison");
  await expect(preview).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(preview).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await expect(preview).toBeVisible();
});
