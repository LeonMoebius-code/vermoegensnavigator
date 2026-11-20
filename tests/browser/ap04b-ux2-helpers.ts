import type { Page } from "@playwright/test";

export const retirementButton = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
export const retirementInput = (page: Page, label: string) => page.getByLabel(label, { exact: true });
export const retirementScenarioNames = ["Defensivere Marktannahme", "Mittlere Marktannahme", "Höhere Marktannahme"];
export const enterStep = (page: Page, step: "A1" | "A2" | "A3" | "A4") =>
  page.getByRole("navigation", { name: "Altersvorsorge-Schritte" }).getByRole("button", { name: new RegExp(`^${step} `) }).click();

export async function openNeutralSettings(page: Page) {
  if (await page.locator(".retirement-capital-settings").getAttribute("open") === null)
    await page.getByText("Zahlungsplan und Modellannahmen bearbeiten", { exact: true }).click();
}

export async function openGrantEvidence(page: Page) {
  if (!await retirementInput(page, "Geprüfte unmittelbare Berechtigung").isVisible())
    await page.getByText("Beraterprüfung: Förderung und Sonderfälle", { exact: true }).click();
}

export async function clearNeutralReturns(page: Page) {
  await enterStep(page, "A4");
  await openNeutralSettings(page);
  for (const name of retirementScenarioNames) for (const asset of ["Aktienrendite", "Rentenrendite"])
    await retirementInput(page, `${name}: ${asset} p.a. in %`).fill("0");
}

export async function runNeutral(page: Page, { detail = false, navigate = true } = {}) {
  const confirm = page.getByLabel(/Die sichtbaren neutralen Modellannahmen/);
  if (navigate && await confirm.count() === 0) await enterStep(page, "A4");
  await confirm.check();
  await retirementButton(page, "Neutrale Kapitalentwicklung berechnen").click();
  if (detail && await page.getByTestId("capital-results").count())
    await page.locator(".retirement-analysis-details").first().evaluate(el => { (el as HTMLDetailsElement).open = true; });
}
