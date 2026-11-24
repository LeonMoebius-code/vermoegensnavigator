import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { PDFDocument } from "pdf-lib";
import { expect, test, type Page } from "@playwright/test";
import { enterStep, openGrantEvidence, openNeutralSettings, retirementButton, retirementInput } from "./ap04b-ux2-helpers";
import { confirmedTransfer, evidenceB, fundingFile, personYear } from "./avd-r88-fixtures";

async function enter(page: Page) {
  await page.goto("./");
  await page.locator(".sidebar nav").getByRole("button", { name: /Altersvorsorge/ }).click();
  await retirementButton(page, "Neue Altersvorsorge planen").click();
}

let browserWorkspace: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: ["tests/browser/avd-r88-workspace-fixture.tsx"], bundle: true, write: false,
    platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' } });
  browserWorkspace = result.outputFiles[0].text;
});

async function enterProtectedWorkspace(page: Page) {
  await page.route("**/avd-synthetic-workspace.html", route => route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: '<!doctype html><html lang="de"><meta charset="utf-8"><div id="root"></div><script src="avd-synthetic-workspace.js"></script></html>',
  }));
  await page.route("**/avd-synthetic-workspace.js", route => route.fulfill({ contentType: "text/javascript", body: browserWorkspace }));
  await page.goto("./avd-synthetic-workspace.html");
  await retirementButton(page, "Neue Altersvorsorge planen").click();
}

test("R88-F01/F02 X01-X02: person total stays separate and A4 automatically includes posted evidence", async ({ page }) => {
  await enter(page);
  await enterStep(page, "A2");
  await retirementInput(page, "Bis wann möchten Sie sparen?").fill("2028-12");
  await page.getByText("Förderbelege und mehrere Verträge", { exact: true }).click();
  const person = personYear({ allocations: [
    { component: "base", childId: null, contractId: "V1", cents: 27000, evidence: evidenceB },
    { component: "base", childId: null, contractId: "V2", cents: 27000, evidence: evidenceB },
  ] });
  const file = fundingFile([person], [confirmedTransfer(person, 27000)]);
  await page.getByLabel("Förderakte auswählen").setInputFiles({
    name: "synthetic-funding.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(file)),
  });
  await expect(page.getByRole("table", { name: "Personenbezogene Förderansprüche" })).toContainText("840,00 €");
  await expect(page.getByRole("table", { name: "Belegte Förderbuchungen" })).toContainText("2028-08");
  await enterStep(page, "A4");
  await retirementInput(page, "Jährliche Bruttogesamtrendite in %").fill("0");
  const comparison = page.getByTestId("premium-comparison");
  await expect(comparison.getByRole("row", { name: /Nur belegte Förderbuchungen 0 %/ })).toContainText("2.670,00 €");
  await expect(comparison.getByRole("row", { name: /Mit gewählter Förderannahme 0 %/ })).toContainText("Offen");
  await expect(comparison.getByRole("row", { name: /Ohne Zulagen 0 %/ })).toContainText("2.400,00 €");
  await expect(page.getByRole("button", { name: /Förderannahme im Kapitalmodell/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Berichtsausgabe" })).toHaveCount(0);
  await enterStep(page, "A2");
  await retirementInput(page, "Wie viel möchten Sie monatlich einzahlen?").fill("150");
  await enterStep(page, "A4");
  await expect(comparison.getByRole("row", { name: /Nur belegte Förderbuchungen 0 %/ })).toContainText("3.870,00 €");
  await expect(comparison.getByRole("row", { name: /Mit gewählter Förderannahme 0 %/ })).toContainText("Offen");
});

test("R88-F02 FT-07/08/09: A1 orientation, A2 child scope and available targets", async ({ page }) => {
  await enter(page);
  await retirementButton(page, "Meine Voraussetzungen prüfen").click();
  await retirementButton(page, "Weiter").click();
  await page.getByRole("radio", { name: "Angestellt und in der deutschen gesetzlichen Rentenversicherung pflichtversichert" }).check();
  await expect(page.getByText(/Die endgültige Berechtigung und Förderhöhe müssen noch geprüft werden/)).toBeVisible();
  await retirementButton(page, "Weiter zum eigenen Sparplan").click();
  const goals = page.getByRole("group", { name: "Beitragsziele" });
  await expect(goals.getByRole("button", { name: /Förder-Mindestbeitrag/ })).toBeVisible();
  await expect(goals.getByRole("button", { name: /Kinderzulage voll/ })).toContainText("Der persönliche Kinderzulagenanspruch ist offen.");
  await openGrantEvidence(page);
  await retirementInput(page, "Gibt es Kinder, für die eine Kinderzulage infrage kommt?").selectOption("yes");
  await expect(page.getByText(/Kinderzulage prüfen. Förderjahr/)).toBeVisible();
  await expect(page.getByTestId("premium-child-card")).toHaveCount(0);
  await expect(goals.getByRole("button", { name: /Kinderzulage voll/ })).toHaveCount(0);
  await page.getByText("Fachlicher Gesamtkatalog der Beitragsziele", { exact: true }).click();
  await expect(page.getByText(/300,00 € Jahresziel für eine mögliche volle Kinderzulage/)).toBeVisible();
  await retirementInput(page, "Gibt es Kinder, für die eine Kinderzulage infrage kommt?").selectOption("no");
  await expect(goals.getByRole("button", { name: /Kinderzulage voll/ })).toHaveCount(0);
  await expect(retirementButton(page, "Weiter zum Produktvergleich")).toBeEnabled();
});

test("R88-F03 X03/X13: A3 and A4 share one profile and stress does not change M1", async ({ page }) => {
  await enterProtectedWorkspace(page);
  await enterStep(page, "A3");
  await retirementButton(page, "Weiter").click();
  await retirementButton(page, "Weiter").click();
  await retirementButton(page, "Produkte anzeigen").click();
  await page.getByTestId("product-basis").getByRole("checkbox").check();
  const profileDetails = page.getByText("Artificial product 1 · Artificial tariff 1", { exact: true });
  await profileDetails.click();
  await retirementInput(page, "Modellprofil").selectOption("0");
  await retirementInput(page, "Aktienverlust im Stressmonat").fill("−40 %");
  await retirementInput(page, "Stressmonat").fill("2027-02");
  const revision = await page.getByTestId("premium-profile-revision").textContent();
  await enterStep(page, "A4");
  const comparison = page.getByTestId("premium-comparison");
  const model1 = comparison.getByRole("row", { name: /M1 · Artificial tariff 1/ });
  const model2 = comparison.getByRole("row", { name: /M2 · Artificial tariff 1/ });
  const stress = comparison.getByRole("row", { name: /M2 mit Stress · Artificial tariff 1/ });
  await expect(stress).toContainText("unmittelbarer Verlust");
  const resultProfile = await model2.getByTestId("premium-result-profile").textContent();
  await expect(stress.getByTestId("premium-result-profile")).toHaveText(resultProfile!);
  const stable = await model1.textContent();
  const equity = retirementInput(page, "Anfangsbestand Aktien");
  if (!await equity.isVisible()) await profileDetails.click();
  await expect(page.getByTestId("premium-profile-revision")).toHaveText(revision!);
  await retirementInput(page, "Anfangsbestand Aktien").fill("99");
  await expect(comparison.getByText("INVALID_WEIGHTS", { exact: true })).toBeVisible();
  await expect(model1).toHaveText(stable!);
  await retirementInput(page, "Anfangsbestand Sicherung").fill("1");
  await expect(comparison.getByText("INVALID_WEIGHTS", { exact: true })).toHaveCount(0);
  await retirementInput(page, "Aktienverlust im Stressmonat").fill("+40 % Gewinn");
  await expect(comparison.getByText("STRESS_LOSS_INVALID", { exact: true })).toBeVisible();
  await expect(model2).toBeVisible();
});

test("R88-F04 D2-T46/T47: download real PDF and CSV, preserve prior bytes after invalidation", async ({ page }) => {
  await enterProtectedWorkspace(page);
  await enterStep(page, "A4");
  await openNeutralSettings(page);
  const pdf = retirementButton(page, "Fixierten Vergleich als PDF ausgeben");
  const csv = retirementButton(page, "Fixierten Vergleich als CSV ausgeben");
  await expect(pdf).toBeDisabled();
  await expect(csv).toBeDisabled();
  await retirementButton(page, "Modellvergleich fixieren").click();
  const download = async (action: typeof pdf) => {
    const got = page.waitForEvent("download");
    await action.click();
    return readFile((await (await got).path())!);
  };
  const originalPDF = await download(pdf);
  const originalCSV = await download(csv);
  const doc = await PDFDocument.load(originalPDF);
  expect(doc.getTitle()).toBe("Historischer Bericht – nicht aktueller Beratungsstand");
  expect(originalCSV.toString()).toContain(doc.getSubject());
  await retirementInput(page, "Jährliche Bruttogesamtrendite in %").fill("15,01");
  await expect(pdf).toBeDisabled();
  await expect(csv).toBeDisabled();
  await page.getByText("Historische Ausgaben dieser Sitzung", { exact: true }).click();
  expect(await download(page.getByRole("button", { name: /^PDF · Historischer Bericht/ }))).toEqual(originalPDF);
  expect(await download(page.getByRole("button", { name: /^CSV · Historischer Bericht/ }))).toEqual(originalCSV);
});
