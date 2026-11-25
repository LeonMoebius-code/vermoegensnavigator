import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { CASE_STORAGE_KEY, RECOVERY_PREFIX } from "../../app/case-storage";
import { h5aHealthyCase, h5aLegacyCase } from "../../scripts/h5a-fixtures";
import { calculateM1, calculateM2 } from "../../app/domain/retirement/savings-model";
import { savingsDemoInputs } from "../../app/presentation/retirement/retirement-model-demo";
import { enterStep, openNeutralSettings, retirementButton as button, retirementInput as input, runNeutral } from "./ap04b-ux2-helpers";

const yearLabel = "Für welches Jahr möchten Sie erstmals einzahlen?";
const confirmed = "Die sichtbaren neutralen Modellannahmen für diesen aktuellen Snapshot bewusst bestätigt";
const ownCost = "Vollständigen hypothetischen Kostenpfad bestätigt; keine Herstellerkosten übernommen";
const referenceCost = "Referenz: vollständigen hypothetischen Kostenpfad bestätigt; keine Herstellerkosten übernommen";
const grantToggle = "Einmalige manuelle Zulagenhypothese hinzufügen";
const calculate = "Neutrale Kapitalentwicklung berechnen";
const grantConfirmed = "Förderjahr, Betrag und Buchungsmonat dieser einmaligen rein hypothetischen Zulage bestätigt";

async function enter(page: Page, isolated = false) {
  if (isolated) {
    await page.setContent('<!doctype html><html lang="de"><div id="root"></div>');
    await page.addScriptTag({ content: renderer });
    await page.evaluate(() => (window as unknown as { r87Ready: Promise<void> }).r87Ready);
  } else {
    await page.goto("./");
    await page.locator(".sidebar nav").getByRole("button", { name: "Altersvorsorge", exact: true }).click();
  }
  await button(page, "Neue Altersvorsorge planen").click();
  await button(page, "Meine Voraussetzungen prüfen").click();
}

let renderer: string;
// Test-only React development renderer of the production entry, including its
// production parent state and real controlled DOM inputs. The batch drives
// their React-bound handlers to prevent the browser flushing discrete events
// separately. The real Profiler verifies that nothing commits between handlers.
test.beforeAll(async () => {
  const bundled = await build({
    stdin: {
      contents: `
        import React, { act, Profiler, StrictMode } from "react";
        import { createRoot } from "react-dom/client";
        import { RetirementEntry } from "./app/presentation/retirement/retirement-entry";
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        globalThis.r87Commits = 0;
        globalThis.r87Batch = async (run) => { await act(async () => { run(); }); };
        globalThis.r87Ready = globalThis.r87Batch(() => {
          createRoot(document.getElementById("root")).render(<StrictMode><Profiler id="RetirementEntry" onRender={() => { globalThis.r87Commits++; }}><RetirementEntry /></Profiler></StrictMode>);
        });
      `,
      loader: "tsx", resolveDir: process.cwd(),
    },
    bundle: true, write: false, jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' },
  });
  renderer = bundled.outputFiles[0].text;
});

type Event = { control: string; value?: string; checked?: boolean; kind?: "submit" };
async function batch(page: Page, events: Event[], expectCommit = true) {
  return page.evaluate(async ({ events, expectCommit }) => {
    const elements = events.map(({ control }) => {
      const label = Array.from(document.querySelectorAll("label")).find(el => el.textContent?.trim() === control);
      const target = label?.control ?? Array.from(document.querySelectorAll("button")).find(el => el.textContent?.trim() === control);
      if (!target) throw Error("Missing real DOM control: " + control);
      return target;
    });
    const react = window as unknown as { r87Commits: number; r87Batch: (fn: () => void) => Promise<void> };
    const handlers = elements.map((node, i) => {
      const event = events[i];
      const el = event.kind === "submit" ? (node as HTMLButtonElement).form! : node;
      const propKey = Object.keys(el).find(key => key.startsWith("__reactProps$"));
      if (!propKey) throw Error("No React DOM props on " + event.control);
      const props = (el as unknown as Record<string, Record<string, (evt: unknown) => void>>)[propKey];
      if (event.kind === "submit") return () => props.onSubmit({ preventDefault() {} });
      if (el instanceof HTMLButtonElement) return () => props.onClick({});
      const target = event.value === undefined && el instanceof HTMLInputElement
        ? { checked: event.checked ?? !el.checked } : { value: event.value };
      return () => props.onChange({ target });
    });
    const before = react.r87Commits;
    await react.r87Batch(() => {
      handlers.forEach(handler => {
        handler();
        if (react.r87Commits !== before) throw Error("React committed between the real handlers");
      });
    });
    if ((react.r87Commits !== before) !== expectCommit) throw Error("Unexpected number of React commits after the batch");
  }, { events, expectCommit });
}

test("R87-01 A1 Orientierung erhält identische neutrale Kurven und Bestätigung", async ({ page }) => {
  await enter(page);
  await input(page, yearLabel).fill("2027");
  await enterStep(page, "A4");
  await runNeutral(page, { detail: true });
  const result = page.getByTestId("capital-results");
  const before = await result.textContent();
  await enterStep(page, "A1");
  await button(page, "Weiter").click();
  await page.getByText("Weitere Versicherungs- und Sonderfälle", { exact: true }).click();
  await input(page, "Keine weiteren Situationen").check();
  await enterStep(page, "A4");
  await expect(input(page, confirmed)).toBeChecked();
  await expect(result).toHaveText(before!);
});

test("R87-02 2028 gelöscht sperrt A2 und A4 bis zur Synchronisierung", async ({ page }, info) => {
  await enter(page);
  await input(page, yearLabel).fill("2028");
  await enterStep(page, "A2");
  await expect(input(page, "Ab wann möchten Sie sparen?")).toHaveValue("2028-01");
  await enterStep(page, "A4");
  await openNeutralSettings(page);
  await expect(input(page, "Startmonat des Modells")).toHaveValue("2028-01");
  await enterStep(page, "A1");
  await input(page, yearLabel).fill("");
  for (const step of ["A2", "A4"] as const) {
    await enterStep(page, step);
    await expect(input(page, yearLabel)).toBeFocused();
    await expect(input(page, yearLabel)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("capital-results")).toHaveCount(0);
  }
  await page.screenshot({ path: info.outputPath("R87-Jahr-unvollstaendig.png") });
  await input(page, yearLabel).fill("2027");
  await enterStep(page, "A2");
  await expect(input(page, "Ab wann möchten Sie sparen?")).toHaveValue("2027-01");
  await enterStep(page, "A4");
  await openNeutralSettings(page);
  await expect(input(page, "Startmonat des Modells")).toHaveValue("2027-01");
  await runNeutral(page);
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
});

test("R87-03 echte A2-Batch erhält Start und Ende", async ({ page }) => {
  await enter(page, true);
  await enterStep(page, "A2");
  await batch(page, [
    { control: "Ab wann möchten Sie sparen?", value: "2028-10" },
    { control: "Bis wann möchten Sie sparen?", value: "2029-12" },
  ]);
  await expect(input(page, "Ab wann möchten Sie sparen?")).toHaveValue("2028-10");
  await expect(input(page, "Bis wann möchten Sie sparen?")).toHaveValue("2029-12");
});

async function costs(page: Page) {
  await enterStep(page, "A4");
  await openNeutralSettings(page);
  await input(page, "Modell-Kostenmodus").selectOption("explicit");
  await input(page, "Ungeförderten ETF-/Fondssparplan vergleichen").check();
  await input(page, "Referenz-Kostenmodus").selectOption("explicit");
}
test("R87-04 echte A4-Batch erhält beide Kostenbestätigungen", async ({ page }) => {
  await enter(page, true);
  await costs(page);
  await batch(page, [{ control: ownCost }, { control: referenceCost }]);
  await expect(input(page, ownCost)).toBeChecked();
  await expect(input(page, referenceCost)).toBeChecked();
});

async function ownOneOff(page: Page) {
  await page.getByText("Eigene Einmalzahlung ergänzen", { exact: true }).click();
  await input(page, "Zusätzliche eigene Einmalzahlung einplanen").check();
}

async function populateGrant(page: Page) {
  await openNeutralSettings(page);
  await input(page, grantToggle).check();
  await input(page, "Betrag der manuellen Zulagenhypothese in Euro").fill("90");
  await input(page, "Hypothetischer Buchungsmonat der Zulage").fill("2028-06");
}

const monthly = "Wie viel möchten Sie monatlich einzahlen?";
const end = "Bis wann möchten Sie sparen?";
const start = "Ab wann möchten Sie sparen?";
const annual = "Jahresziel für das erste Kalenderjahr in Euro";
const annualTest = "customer-annual";
const modelStart = "Startmonat des Modells";
const referenceToggle = "Ungeförderten ETF-/Fondssparplan vergleichen";
const costRate = "Jährliche modellierte Bestandsminderung in %";
const oneOffEnabled = "Zusätzliche eigene Einmalzahlung einplanen";
const oneOffAmount = "Einmalzahlung in Euro";
const oneOffMonth = "Monat der Einmalzahlung";
const birth = "In welchem Jahr sind Sie geboren? (optional)";

test("R87-05 echte A2-Batch erhält Rate und verschobene Einmalzahlung in A4", async ({ page }) => {
  await enter(page, true);
  await enterStep(page, "A2");
  await ownOneOff(page);
  await input(page, oneOffAmount).fill("90");
  await batch(page, [{ control: monthly, value: "25" }, { control: oneOffMonth, value: "2028-03" }]);
  await expect(page.getByTestId(annualTest)).toContainText("300,00 €");
  await enterStep(page, "A4");
  await openNeutralSettings(page);
  await expect(input(page, "Eigene monatliche Einzahlung in Euro")).toHaveValue("25");
  await expect(input(page, "Einmaliger eigener Modellbeitrag in Euro")).toHaveValue("90");
  await expect(input(page, "Monat des einmaligen Modellbeitrags")).toHaveValue("2028-03");
});

test("R87-06 echte A2-Batch erhält Einmalbetrag bei aus- und eingeschaltetem bereits sichtbarem Feld", async ({ page }) => {
  await enter(page, true);
  await enterStep(page, "A2");
  await ownOneOff(page);
  await batch(page, [
    { control: oneOffEnabled, checked: false }, { control: oneOffAmount, value: "90" }, { control: oneOffEnabled, checked: true },
  ]);
  await expect(input(page, oneOffEnabled)).toBeChecked();
  await expect(input(page, oneOffAmount)).toHaveValue("90");
});

test("R87-07 echte A2-Batch bindet Jahresziel und Centrest an den geänderten letzten Monat", async ({ page }) => {
  await enter(page, true);
  await enterStep(page, "A2");
  await input(page, start).fill("2027-10");
  await ownOneOff(page);
  await input(page, oneOffAmount).fill("90");
  await input(page, oneOffMonth).fill("2027-11");
  await batch(page, [{ control: annual, value: "120,01" }, { control: end, value: "2027-12" }]);
  await expect(page.getByTestId("contribution-explanation")).toContainText("0,01 € Centausgleich im Monat 2027-12");
  await expect(page.getByTestId(annualTest)).toContainText("120,01 €");
});

test("R87-08 echte A2-Batch verwendet die letzte Änderung am selben Feld", async ({ page }) => {
  await enter(page, true);
  await enterStep(page, "A2");
  await batch(page, [{ control: monthly, value: "37" }, { control: monthly, value: "42" }]);
  await expect(input(page, monthly)).toHaveValue("42");
  await expect(page.getByTestId(annualTest)).toContainText("504,00 €");
});

test("R87-09 echte A4-Batch erhält unabhängige Bestätigungen für Kosten und Förderhypothese", async ({ page }) => {
  await enter(page, true);
  await costs(page);
  await populateGrant(page);
  await batch(page, [{ control: ownCost }, { control: grantConfirmed }]);
  await expect(input(page, ownCost)).toBeChecked();
  await expect(input(page, grantConfirmed)).toBeChecked();
  await expect(input(page, referenceCost)).not.toBeChecked();
});

test("R87-10 echte A4-Batch lehnt eine Bestätigung für den vorherigen Kostensatz ab", async ({ page }) => {
  await enter(page, true);
  await costs(page);
  await input(page, referenceCost).check();
  await batch(page, [{ control: costRate, value: "2,5" }, { control: ownCost, checked: true }]);
  await expect(input(page, costRate)).toHaveValue("2,5");
  await expect(input(page, ownCost)).not.toBeChecked();
  await expect(input(page, referenceCost)).toBeChecked();
});

test("R87-11 echte A4-Batch belebt Referenzbestätigung nach Aus- und Einschalten nicht wieder", async ({ page }) => {
  await enter(page, true);
  await costs(page);
  await batch(page, [
    { control: referenceToggle, checked: false }, { control: referenceToggle, checked: true }, { control: referenceCost, checked: true },
  ]);
  await expect(input(page, referenceToggle)).toBeChecked();
  await expect(input(page, referenceCost)).not.toBeChecked();
  await input(page, referenceCost).check();
  await expect(input(page, referenceCost)).toBeChecked();
});

test("R87-12 echte A4-Batch mit Rate und Absenden veröffentlicht keine alte Kurve", async ({ page }) => {
  await enter(page, true);
  await enterStep(page, "A4");
  await runNeutral(page);
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  await openNeutralSettings(page);
  await batch(page, [{ control: "Eigene monatliche Einzahlung in Euro", value: "321" }, { control: calculate, kind: "submit" }]);
  await expect(page.getByRole("alert")).toContainText("bestätigen");
  await expect(page.getByTestId("scenario-line")).toHaveCount(0);
  await runNeutral(page);
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  await expect(page.getByRole("complementary", { name: "Aktueller Beratungsstand" })).toContainText("321,00 €");
});

test("R87-13 echte A4-Batch liest eine frische Bestätigung beim sofortigen Rechnen", async ({ page }) => {
  await enter(page, true);
  await enterStep(page, "A4");
  await batch(page, [{ control: confirmed, checked: true }, { control: calculate, kind: "submit" }]);
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  await expect(input(page, confirmed)).toBeChecked();
});

test("R87-14 echte A4-Batch erhält zwei Änderungen in demselben verschachtelten Szenario", async ({ page }) => {
  await enter(page, true);
  await enterStep(page, "A4");
  await openNeutralSettings(page);
  const stock = "Mittlere Marktannahme: Aktienrendite p.a. in %";
  const bond = "Mittlere Marktannahme: Rentenrendite p.a. in %";
  await batch(page, [{ control: stock, value: "3,5" }, { control: bond, value: "1,5" }]);
  await expect(input(page, stock)).toHaveValue("3,5");
  await expect(input(page, bond)).toHaveValue("1,5");
});

test("R87-15 gültiges Geburtsjahr erhält die unabhängige neutrale Vorschau", async ({ page }) => {
  await enter(page);
  await runNeutral(page);
  const result = await page.getByTestId("capital-results").textContent();
  await enterStep(page, "A1");
  await input(page, birth).fill("2001");
  await enterStep(page, "A4");
  await expect(input(page, confirmed)).toBeChecked();
  await expect(page.getByTestId("capital-results")).toHaveText(result!);
});

test("R87-16 A1-Kinderkontext widerruft manuelle Zulage und erhält getrennte Kostenpfade", async ({ page }) => {
  await enter(page);
  await costs(page);
  await populateGrant(page);
  await input(page, ownCost).check();
  await input(page, referenceCost).check();
  await input(page, grantConfirmed).check();
  await runNeutral(page, { detail: true });
  await expect(page.getByTestId("capital-results")).toBeVisible();
  await enterStep(page, "A1");
  await page.getByRole("button", { name: /Bestehende Vorsorge und Kinder$/ }).click();
  await page.getByRole("group", { name: /aktuell Kindergeld/ }).getByRole("radio", { name: "Ja", exact: true }).check();
  await enterStep(page, "A4");
  await openNeutralSettings(page);
  await expect(input(page, grantConfirmed)).not.toBeChecked();
  await expect(input(page, confirmed)).not.toBeChecked();
  await expect(input(page, ownCost)).toBeChecked();
  await expect(input(page, referenceCost)).toBeChecked();
  await expect(input(page, "Förderjahr der manuellen Zulagenhypothese")).toHaveValue("2027");
  await expect(input(page, "Hypothetischer Buchungsmonat der Zulage")).toHaveValue("2028-06");
  await expect(page.getByTestId("capital-results")).toHaveCount(0);
});

test("R87-17 A2 setzt A1 bidirektional und A4 behält den zuletzt gewählten Kalendermonat", async ({ page }) => {
  await enter(page);
  await enterStep(page, "A2");
  await input(page, start).fill("2028-11");
  await enterStep(page, "A1");
  await expect(input(page, yearLabel)).toHaveValue("2028");
  await input(page, yearLabel).fill("2027");
  await enterStep(page, "A4");
  await openNeutralSettings(page);
  await expect(input(page, modelStart)).toHaveValue("2027-11");
  await input(page, modelStart).fill("2028-08");
  await enterStep(page, "A1");
  await expect(input(page, yearLabel)).toHaveValue("2028");
  await enterStep(page, "A2");
  await expect(input(page, start)).toHaveValue("2028-08");
});

test("R87-18 Monatswechsel desselben Jahres entwertet Kapitalwerte, behält aber die Jahresbindung", async ({ page }) => {
  await enter(page);
  await runNeutral(page);
  await enterStep(page, "A2");
  await input(page, start).fill("2027-02");
  await enterStep(page, "A1");
  await expect(input(page, yearLabel)).toHaveValue("2027");
  await enterStep(page, "A4");
  await expect(page.getByRole("status").filter({ hasText: "Vorschau ist veraltet" })).toBeVisible();
  await expect(page.getByTestId("scenario-line")).toHaveCount(0);
});

test("R87-19 ungültige vierstellige und unvollständige Beitragsjahre sperren alle Folgepfade", async ({ page }) => {
  await enter(page);
  for (const value of ["0099", "202"]) {
    await input(page, yearLabel).fill(value);
    await button(page, "Weiter zum eigenen Sparplan").click();
    await expect(input(page, yearLabel)).toBeFocused();
    for (const step of ["A2", "A3", "A4"] as const) {
      await enterStep(page, step);
      await expect(input(page, yearLabel)).toHaveAttribute("aria-invalid", "true");
      await expect(input(page, yearLabel)).toBeFocused();
    }
  }
});

test("R87-20 leerer A4-Start blockiert Neuberechnung und hinterlässt keine NaN-Regelbindung", async ({ page }) => {
  await enter(page);
  await runNeutral(page);
  await openNeutralSettings(page);
  await input(page, modelStart).fill("");
  await button(page, calculate).click();
  await expect(input(page, modelStart)).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("Beitragsjahr");
  await expect(page.getByTestId("scenario-line")).toHaveCount(0);
  await enterStep(page, "A2");
  await expect(input(page, yearLabel)).toHaveValue("");
  await input(page, yearLabel).fill("2028");
  await enterStep(page, "A2");
  await expect(input(page, start)).toHaveValue("2028-01");
  await page.getByText("Regelstand und Quellen", { exact: true }).click();
  await expect(page.getByText(/estg-2028-v1/)).toBeVisible();
  await expect(page.getByText(/NaN/)).toHaveCount(0);
});

async function cards(page: Page) {
  await enterStep(page, "A3");
  await button(page, "Weiter").click();
  await button(page, "Weiter").click();
  await button(page, "Produkte anzeigen").click();
  return page.locator(".retirement-product-grid").getByRole("checkbox");
}

test("R87-21 A3 weist vierte Auswahl zurück und behält drei bestätigte Vergleichskandidaten", async ({ page }) => {
  await enter(page);
  const checkboxes = await cards(page);
  for (const i of [0, 1, 2, 3]) await checkboxes.nth(i).click();
  await expect(page.locator(".retirement-product-grid").getByRole("checkbox", { checked: true })).toHaveCount(3);
  await expect(checkboxes.nth(3)).not.toBeChecked();
  await button(page, "Direktvergleich öffnen").click();
  await expect(page.locator(".retirement-product-matrix")).toHaveAttribute("data-columns", "3");
});

test("R87-22 abgewiesene vierte Auswahl erhält A4; wirksame A3-Auswahl widerruft A4", async ({ page }) => {
  await enter(page);
  const checkboxes = await cards(page);
  for (const i of [0, 1, 2]) await checkboxes.nth(i).check();
  await costs(page);
  await input(page, ownCost).check();
  await input(page, referenceCost).check();
  await runNeutral(page, { detail: true });
  await expect(page.getByTestId("capital-results")).toBeVisible();
  await enterStep(page, "A3");
  await checkboxes.nth(3).click();
  await enterStep(page, "A4");
  await expect(page.getByTestId("scenario-line")).toHaveCount(6);
  await enterStep(page, "A3");
  await checkboxes.nth(0).uncheck();
  await enterStep(page, "A4");
  await openNeutralSettings(page);
  await expect(input(page, confirmed)).not.toBeChecked();
  await expect(input(page, ownCost)).not.toBeChecked();
  await expect(input(page, referenceCost)).not.toBeChecked();
  await expect(page.getByTestId("capital-results")).toHaveCount(0);
});

test("R87-23 P1 sperrt veränderte Katalogbindung für beide echten Rechenwege", () => {
  const { inputsM1, inputsM2 } = savingsDemoInputs("control", 0);
  for (const [fn, args] of [[calculateM1, inputsM1], [calculateM2, inputsM2]] as const) {
    expect(fn(JSON.stringify(args)).ok).toBe(true);
    const denied = fn(JSON.stringify({ ...args, catalog_ref: { ...args.catalog_ref, hash: "0".repeat(64) } }));
    expect(denied.ok).toBe(false);
    expect(JSON.stringify(denied)).not.toContain("projectionResults");
  }
});

const stores = (page: Page) => page.evaluate(async () => ({
  storage: { ...localStorage }, session: { ...sessionStorage }, indexedDB: await indexedDB.databases(),
}));

test("R87-24 P2 und allgemeiner Schema-11-Fall bleiben beim Wechsel und Reload bytegleich", async ({ page }) => {
  await page.addInitScript(({ key, json }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, json);
  }, { key: CASE_STORAGE_KEY, json: JSON.stringify([h5aHealthyCase()], null, 2) });
  await enter(page);
  const before = await stores(page);
  expect(JSON.parse(before.storage[CASE_STORAGE_KEY])[0].schemaVersion).toBe(11);
  expect(before.indexedDB).toEqual([]);
  await input(page, yearLabel).fill("2028");
  await runNeutral(page, { detail: true });
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  const cases = page.locator(".sidebar nav").getByRole("button", { name: /Beratungsfälle/ });
  page.once("dialog", d => d.dismiss());
  await cases.click();
  await expect(page.getByTestId("capital-results")).toBeVisible();
  page.once("dialog", d => d.accept());
  await cases.click();
  await expect(page.getByTestId("capital-results")).toHaveCount(0);
  expect(await stores(page)).toEqual(before);
  await page.reload();
  expect(await stores(page)).toEqual(before);
});

test("R87-25 Recovery liefert nach verworfenem A4-Entwurf den historischen Originalbestand", async ({ page }, info) => {
  const original = JSON.stringify([h5aLegacyCase(), h5aHealthyCase()], null, 2);
  await page.addInitScript(({ key, json }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, json);
  }, { key: CASE_STORAGE_KEY, json: original });
  await enter(page);
  const before = await stores(page);
  await runNeutral(page);
  page.once("dialog", d => d.accept());
  await page.locator(".sidebar nav").getByRole("button", { name: /Beratungsfälle/ }).click();
  await expect(page.locator(".case-store-notice")).toContainText("historischer Fall ist geschützt");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Originalbestand zur Wiederherstellung herunterladen/ }).click();
  const target = info.outputPath("recovery-original.json");
  await (await download).saveAs(target);
  expect(await readFile(target, "utf8")).toBe(original);
  const after = await stores(page);
  expect(after).toEqual(before);
  expect(Object.keys(after.storage).filter(key => key.startsWith(RECOVERY_PREFIX)))
    .toEqual(Object.keys(before.storage).filter(key => key.startsWith(RECOVERY_PREFIX)));
});

test("R87-26 A4-Bestätigung und Kurven bleiben bei einem doppelten identischen Event erhalten", async ({ page }) => {
  await enter(page, true);
  await enterStep(page, "A4");
  await runNeutral(page);
  const before = await page.getByTestId("capital-results").textContent();
  await openNeutralSettings(page);
  const value = await input(page, "Modell-Aktienquote in %").inputValue();
  await batch(page, [{ control: "Modell-Aktienquote in %", value }, { control: "Modell-Aktienquote in %", value }], false);
  await expect(input(page, confirmed)).toBeChecked();
  await expect(page.getByTestId("capital-results")).toHaveText(before!);
});

test("R87-27 echte A1-Batch sperrt direkte A4-Navigation sofort bei gelöschtem Jahr", async ({ page }) => {
  await enter(page, true);
  await input(page, yearLabel).fill("2028");
  await batch(page, [{ control: yearLabel, value: "" }, { control: "A4 Kapitalentwicklung" }]);
  await expect(input(page, yearLabel)).toBeFocused();
  await expect(input(page, yearLabel)).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("capital-results")).toHaveCount(0);
});

test("R87-28 echte A2-Batch validiert unmittelbar abgesendete ungültige Monatsrate", async ({ page }) => {
  await enter(page, true);
  await enterStep(page, "A2");
  await batch(page, [{ control: monthly, value: "-1" }, { control: "Weiter zum Produktvergleich", kind: "submit" }]);
  await expect(input(page, monthly)).toBeFocused();
  await expect(input(page, monthly)).toHaveAttribute("aria-invalid", "true");
});

test("R87-29 echte A2-Batch übergibt den neuesten Monatsbetrag beim direkten A4-Wechsel", async ({ page }) => {
  await enter(page, true);
  await enterStep(page, "A2");
  await batch(page, [{ control: monthly, value: "86" }, { control: "A4 Kapitalentwicklung" }]);
  await openNeutralSettings(page);
  await expect(input(page, "Eigene monatliche Einzahlung in Euro")).toHaveValue("86");
  await expect(page.getByRole("complementary", { name: "Aktueller Beratungsstand" })).toContainText("1.032,00 €");
});

test("R87-30 echte A4-Batch verweigert alte Förderbestätigung nach Buchungsmonatswechsel", async ({ page }) => {
  await enter(page, true);
  await enterStep(page, "A4");
  await populateGrant(page);
  const booking = "Hypothetischer Buchungsmonat der Zulage";
  await batch(page, [{ control: booking, value: "2028-09" }, { control: grantConfirmed, checked: true }]);
  await expect(input(page, booking)).toHaveValue("2028-09");
  await expect(input(page, grantConfirmed)).not.toBeChecked();
});

test("R87-31 echte A3-Batch schützt Dreiergrenze bei vier Produktaktionen vor dem Render", async ({ page }) => {
  await enter(page, true);
  const checkboxes = await cards(page);
  const labels = await page.locator(".retirement-product-grid article label.retirement-checkbox").allTextContents();
  await batch(page, labels.slice(0, 4).map(label => ({ control: label.trim(), checked: true })));
  await expect(page.locator(".retirement-product-grid").getByRole("checkbox", { checked: true })).toHaveCount(3);
  await expect(checkboxes.nth(3)).not.toBeChecked();
  await button(page, "Direktvergleich öffnen").click();
  await expect(page.locator(".retirement-product-matrix")).toHaveAttribute("data-columns", "3");
});

test("R87-32 globaler Tastaturfokus scrollt bei 375px jeden Navigationsbutton vollständig ins Sichtfeld", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("./");
  const nav = page.locator(".sidebar nav");
  const navButtons = nav.getByRole("button");
  await navButtons.first().focus();
  for (let i = 0; i < await navButtons.count(); i++) {
    if (i) await page.keyboard.press("Tab");
    const current = navButtons.nth(i);
    await expect(current).toBeFocused();
    expect(await current.evaluate(el => {
      const bounds = el.getBoundingClientRect();
      const visible = el.closest("nav")!.getBoundingClientRect();
      return bounds.left >= visible.left - 1 && bounds.right <= visible.right + 1
        && getComputedStyle(el).outlineStyle !== "none";
    })).toBe(true);
  }
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Altersvorsorge", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("R87-33 Browser-Back und -Forward stellen keinen Altersvorsorgeentwurf wieder her", async ({ page }) => {
  await page.goto("about:blank");
  await enter(page);
  await input(page, yearLabel).fill("2028");
  await runNeutral(page);
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  page.once("dialog", d => d.accept());
  await page.goBack();
  expect(page.url()).toBe("about:blank");
  await page.goForward();
  const retirement = page.locator(".sidebar nav").getByRole("button", { name: "Altersvorsorge", exact: true });
  await retirement.click();
  await expect(button(page, "Neue Altersvorsorge planen")).toBeVisible();
  await button(page, "Neue Altersvorsorge planen").click();
  await button(page, "Meine Voraussetzungen prüfen").click();
  await expect(input(page, yearLabel)).toHaveValue("2027");
  await enterStep(page, "A4");
  await expect(page.getByTestId("scenario-line")).toHaveCount(0);
});
