import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { CASE_STORAGE_KEY } from "../../app/case-storage";
import { outputCase, planningCase } from "./fixtures";
const btn = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
const label = (p: Page, name: string) => p.getByLabel(name, { exact: true });
const nav = (p: Page, name: string) => p.locator(".sidebar nav").getByRole("button", { name: new RegExp(name) });
const state = (p: Page) => p.evaluate(async () => ({ local: Object.fromEntries(Object.entries(localStorage)), session: Object.fromEntries(Object.entries(sessionStorage)), cookie: document.cookie, url: location.href, databases: await indexedDB.databases() }));
async function entry(p: Page, year = 2027) { await p.goto("./"); await nav(p, "Altersvorsorge").click(); await btn(p, "B – Bestehende Riester-Rente prüfen").click(); if (year !== 2027) await label(p, "Alt-Beitragsjahr").selectOption(String(year)); }
async function oldConfirm(p: Page, year = 2027, children: number[] = [], income = "35.000") {
  await label(p, "Alt-unmittelbare Berechtigung").selectOption("direct_old_confirmed");
  await label(p, "Alt-Regime und Bestandsschutz").selectOption(year === 2026 ? "old_2026_confirmed" : "old_protected_confirmed");
  await label(p, "Alt-Vertragskontext").selectOption("single_private_eligible_confirmed");
  await label(p, "Maßgeblicher RV-Vorjahresbetrag in Euro").fill(income);
  await label(p, "Nachgewiesenes RV-Bemessungsjahr (t−1)").selectOption(String(year - 1));
  await label(p, "Qualität der RV-Bemessung").selectOption("simple_domestic_prior_rv_confirmed");
  await label(p, "Alt-Partnerstatus").selectOption("none_relevant_confirmed");
  await label(p, "Alt-Berufseinsteigerbonus").selectOption("history_no_current_confirmed");
  await label(p, "Vollständige Alt-Kinderliste").selectOption(children.length ? "list_confirmed" : "none_confirmed");
  for (let i = 0; i < children.length; i++) {
    await btn(p, "Alt-Kind hinzufügen").click(); await label(p, `Alt-Kind ${i + 1}: Geburtsjahr`).fill(String(children[i]));
    await label(p, `Alt-Kind ${i + 1}: Förderfähigkeit und Zuordnung ${year}`).selectOption("eligible_assigned_confirmed");
  }
  await label(p, "Alt-Korrekturstatus").selectOption("none_confirmed");
}
async function own(p: Page, value = "360", quality = "planned") {
  await label(p, "B-Jahres-Eigenbeitrag in Euro").fill(value); await label(p, "B-Beitragsstand").selectOption(quality);
  await p.getByLabel("B: Jahres-Eigenbeitrag für Person", { exact: false }).check(); await evidence(p);
}
async function evidence(p: Page) { await label(p, "Alt-Gesamtbestätigung der Nachweise").selectOption("confirmed"); }
async function calculate(p: Page) { await btn(p, "Alt-Fördervorschau prüfen").click(); }
async function newConfirm(p: Page, year = 2027, count = 0) {
  await label(p, "Neu-Szenario: unmittelbare Berechtigung").selectOption("direct_confirmed");
  await label(p, "Neu-Szenario: Förderregime").selectOption("new_confirmed");
  await label(p, "Neu-Szenario: Vertragskontext").selectOption("single_eligible_confirmed");
  await p.getByLabel("Vertrags- und Übergangsannahme", { exact: false }).check();
  await label(p, "Neu-Szenario: vollständige Kinderzuordnung").selectOption(count ? "list_confirmed" : "none_confirmed");
  for (let i = 0; i < count; i++) { await btn(p, "Neu-Kind hinzufügen").click(); await label(p, `Neu-Kind ${i + 1}: Förderfähigkeit und Zuordnung ${year}`).selectOption("eligible_assigned_confirmed"); }
  await p.getByLabel("Derselbe angezeigte Jahres-Eigenbeitrag", { exact: false }).check();
  await p.getByLabel("Alle Voraussetzungen der hypothetischen", { exact: false }).check();
  await p.getByLabel("Vergleichsbasis bestätigt", { exact: false }).check();
}
async function noOld(p: Page) { for (const name of ["old-result", "old-base", "old-total", "old-minimum", "old-fulfillment"]) await expect(p.getByTestId(name)).toHaveCount(0); }
async function noComparison(p: Page) { await noOld(p); await expect(p.getByTestId("new-result")).toHaveCount(0); await expect(p.getByTestId("comparison-delta")).toHaveCount(0); }

test("B05-01/02/03: real B navigation, empty states, independent A/B drafts", async ({ page }) => {
  await entry(page); await expect(page.getByRole("heading", { name: "B1 – Bestandsaufnahme", exact: true })).toBeFocused();
  for (const name of ["Alt-unmittelbare Berechtigung", "Alt-Regime und Bestandsschutz", "Alt-Vertragskontext", "Alt-Partnerstatus", "Alt-Berufseinsteigerbonus", "Vollständige Alt-Kinderliste", "Alt-Korrekturstatus"]) await expect(label(page, name)).toHaveValue("unconfirmed");
  await calculate(page); await noOld(page);
  await oldConfirm(page); await own(page); await calculate(page); await expect(page.getByTestId("old-total")).toHaveText("51,43 €");
  await btn(page, "B2 Fördervergleich").click(); await btn(page, "B1 Bestandsaufnahme").click();
  await expect(label(page, "Alt-unmittelbare Berechtigung")).toHaveValue("direct_old_confirmed"); await noOld(page);
  await btn(page, "A/B-Auswahl").click(); await btn(page, "A – Neue Altersvorsorge planen").click();
  await expect(label(page, "Unmittelbare Berechtigung")).toHaveValue("unconfirmed"); await label(page, "Unmittelbare Berechtigung").selectOption("direct_confirmed");
  await btn(page, "A/B-Auswahl").click(); await btn(page, "B – Bestehende Riester-Rente prüfen").click();
  await expect(label(page, "B-Jahres-Eigenbeitrag in Euro")).toHaveValue("360"); await noOld(page);
  await btn(page, "A/B-Auswahl").click(); await btn(page, "A – Neue Altersvorsorge planen").click(); await expect(label(page, "Unmittelbare Berechtigung")).toHaveValue("direct_confirmed");
});

for (const year of [2026, 2027, 2028]) test(`B05-04/15/16/23/27: ${year}, confirmed annual legal contexts`, async ({ page }) => {
  await entry(page, year); await oldConfirm(page, year, [2010, 2014], "20.000"); await own(page, "60"); await calculate(page);
  await expect(page.getByTestId("old-minimum")).toHaveText("60,00 €"); await expect(page.getByTestId("old-base")).toHaveText("175,00 €"); await expect(page.getByTestId("old-children")).toHaveText("600,00 €"); await expect(page.getByTestId("old-total")).toHaveText("775,00 €");
  await page.getByText("Regelstand, Quellen und Modellgrenzen", { exact: true }).click(); await expect(page.locator(".retirement-view")).toContainText(year === 2026 ? "alt-2026-checked-20261028" : `alt-bestand-${year}-checked-20261028`);
  await btn(page, "B2 Fördervergleich").click();
  if (year !== 2026) await newConfirm(page, year, 2);
  await btn(page, "Getrennte Fördermodelle prüfen").click(); await expect(page.getByTestId("old-total")).toHaveText("775,00 €");
  if (year === 2026) { await expect(page.getByTestId("new-status")).toContainText("2026"); await expect(page.getByTestId("comparison-delta")).toHaveCount(0); }
  else { await expect(page.getByTestId("new-total")).toHaveText("0,00 €"); await expect(page.getByTestId("comparison-delta")).toHaveText("−775,00 €"); }
});

test("B05-05/15/27: year change revokes all time confirmations including both children", async ({ page }) => {
  await entry(page); await oldConfirm(page, 2027, [2007]); await own(page); await btn(page, "B2 Fördervergleich").click(); await newConfirm(page, 2027, 1);
  await btn(page, "Getrennte Fördermodelle prüfen").click(); await expect(page.getByTestId("comparison-delta")).toBeVisible();
  await btn(page, "B1 Bestandsaufnahme").click(); await label(page, "Alt-Beitragsjahr").selectOption("2028"); await noComparison(page);
  for (const name of ["Alt-unmittelbare Berechtigung", "Alt-Regime und Bestandsschutz", "Alt-Vertragskontext", "Qualität der RV-Bemessung", "Alt-Partnerstatus", "Alt-Berufseinsteigerbonus", "Vollständige Alt-Kinderliste", "Alt-Korrekturstatus", "B-Beitragsstand"]) await expect(label(page, name)).toHaveValue("unconfirmed");
  await expect(label(page, "Nachgewiesenes RV-Bemessungsjahr (t−1)")).toHaveValue(""); await expect(page.getByLabel("B: Jahres-Eigenbeitrag für Person", { exact: false })).not.toBeChecked();
  await label(page, "Vollständige Alt-Kinderliste").selectOption("list_confirmed"); await expect(label(page, "Alt-Kind 1: Förderfähigkeit und Zuordnung 2028")).toHaveValue("assignment_unconfirmed");
  await btn(page, "B2 Fördervergleich").click(); await expect(label(page, "Neu-Szenario: Förderregime")).toHaveValue("unconfirmed"); await expect(label(page, "Neu-Szenario: vollständige Kinderzuordnung")).toHaveValue("unconfirmed");
});

for (const [income, ownAmount, expected, minimum, fulfillment] of [["35.000", "360", "51,43 €", "1.225,00 €", "reduced"], ["0,00", "0", "0,00 €", "60,00 €", "zero"], ["0", "30", "87,50 €", "60,00 €", "reduced"], ["35.019", "1.225", "175,00 €", "1.225,00 €", "full"]]) test(`B05-07/17/18: ${income}/${ownAmount}, real core result`, async ({ page }) => {
  await entry(page); await oldConfirm(page, 2027, [], income); await own(page, ownAmount, "actual"); await calculate(page);
  await expect(page.getByTestId("old-total")).toHaveText(expected); await expect(page.getByTestId("old-minimum")).toHaveText(minimum); await expect(page.getByTestId("old-fulfillment")).toContainText(fulfillment);
  await expect(page.locator(".retirement-result")).toContainText("Tatsächlich gezahlte");
});

test("B05-14/19: mixed children 2007/2008, no 18-year cutoff or remainder cent", async ({ page }) => {
  await entry(page); await oldConfirm(page, 2027, [2007, 2008]); await own(page, "0,01"); await calculate(page);
  expect(await page.getByTestId("old-child").allTextContents()).toEqual(["0,00 €", "0,00 €"]); await expect(page.getByTestId("old-base")).toHaveText("0,00 €"); await expect(page.getByTestId("old-total")).toHaveText("0,00 €");
  await own(page, "740"); await calculate(page); expect(await page.getByTestId("old-child").allTextContents()).toEqual(["185,00 €", "300,00 €"]);
});
for (const [income, amount] of [["0", "0,06"], ["6.125", "0,03"]]) test(`B05-20: G14/N29 ${income}/${amount} no money`, async ({ page }) => {
  await entry(page); await oldConfirm(page, 2027, [], income); await own(page, amount); await calculate(page); await noOld(page); await expect(page.getByTestId("old-status")).toContainText("rounding_convention_required");
});

for (const [name, value, expected] of [
  ["Qualität der RV-Bemessung", "conflicting", "review_required"], ["Qualität der RV-Bemessung", "special", "unsupported"], ["Nachgewiesenes RV-Bemessungsjahr (t−1)", "2027", "review_required"],
  ["Alt-Regime und Bestandsschutz", "unconfirmed", "review_required"], ["Alt-Regime und Bestandsschutz", "new_confirmed", "unsupported"],
  ["Alt-Vertragskontext", "multiple", "unsupported"], ["Alt-Vertragskontext", "housing", "unsupported"], ["Alt-Vertragskontext", "occupational", "unsupported"],
  ["Alt-Partnerstatus", "unconfirmed", "review_required"], ["Alt-Partnerstatus", "indirect_included", "unsupported"],
  ["Alt-Berufseinsteigerbonus", "unconfirmed", "review_required"], ["Alt-Berufseinsteigerbonus", "current_year_confirmed", "unsupported"],
  ["Vollständige Alt-Kinderliste", "unconfirmed", "review_required"], ["Alt-Korrekturstatus", "retrospective", "unsupported"],
  ["Alt-Gesamtbestätigung der Nachweise", "conflicting", "review_required"]]) test(`B05-06/09/10/11/12/13/22: ${name}/${value}`, async ({ page }) => {
  await entry(page); await oldConfirm(page); await own(page); await calculate(page); await expect(page.getByTestId("old-result")).toBeVisible();
  await label(page, name).selectOption(value); await noOld(page); if (name !== "Alt-Gesamtbestätigung der Nachweise") await evidence(page);
  await calculate(page); await noOld(page); await expect(page.getByTestId("old-status")).toContainText(expected === "unsupported" ? "Derzeit nicht unterstützt" : "Fachlich prüfen");
});

test("B05-11/12: direct independent partner and evidenced age exclusion allowed", async ({ page }) => {
  await entry(page); await oldConfirm(page); await own(page); await label(page, "Alt-Partnerstatus").selectOption("direct_independent_confirmed"); await label(page, "Alt-Berufseinsteigerbonus").selectOption("age_excluded_confirmed"); await evidence(page); await calculate(page); await expect(page.getByTestId("old-total")).toHaveText("51,43 €");
});

for (const value of ["", "-1", "1e3", "120,001", "90071992547410", "1.23"]) test(`B05-08: bad exact contribution '${value}' no stale money`, async ({ page }) => {
  await entry(page); await oldConfirm(page); await own(page); await calculate(page); await label(page, "B-Jahres-Eigenbeitrag in Euro").fill(value); await noOld(page); await calculate(page); await noOld(page); await expect(page.getByTestId("old-status")).toContainText("Eingabe korrigieren");
});

test("B05-21: October 3 monthly rates plus one-off, mode change clears inputs", async ({ page }) => {
  await entry(page); await oldConfirm(page); await label(page, "B-Beitragsmodus").selectOption("monthly"); await label(page, "B-Monatlicher Eigenbeitrag in Euro").fill("100"); await label(page, "B-Startmonat 2027").selectOption("10");
  const months = label(page, "B-Beitragswirksame Monatsanzahl"); expect(await months.locator("option").allTextContents()).toEqual(["Bitte wählen", "1", "2", "3"]); await months.selectOption("3");
  await page.getByLabel("B: Zusätzlicher einmaliger Eigenbeitrag", { exact: true }).check(); await label(page, "B-Einmaliger Eigenbeitrag in Euro").fill("60"); await label(page, "B-Beitragsstand").selectOption("planned"); await page.getByLabel("B: Jahres-Eigenbeitrag für Person", { exact: false }).check(); await evidence(page); await calculate(page);
  await expect(page.getByTestId("old-own")).toHaveText("360,00 €"); await expect(page.getByTestId("old-total")).toHaveText("51,43 €"); await expect(page.locator(".retirement-result")).toContainText("Geplante");
  await months.selectOption("2"); await noOld(page); await expect(page.getByLabel("B: Jahres-Eigenbeitrag für Person", { exact: false })).not.toBeChecked();
  await label(page, "B-Beitragsmodus").selectOption("annual"); await expect(label(page, "B-Jahres-Eigenbeitrag in Euro")).toHaveValue("");
});

test("B05-24/28: old result isolated from unconfirmed new scenario; no winner or sum", async ({ page }) => {
  await entry(page); await oldConfirm(page); await own(page); await btn(page, "B2 Fördervergleich").click(); await btn(page, "Getrennte Fördermodelle prüfen").click();
  await expect(page.getByTestId("old-total")).toHaveText("51,43 €"); await expect(page.getByTestId("new-result")).toHaveCount(0); await expect(page.getByTestId("comparison-delta")).toHaveCount(0); await expect(page.getByTestId("comparison-incomplete")).toBeVisible();
  await expect(page.locator(".retirement-view")).not.toContainText(/Gewinner|beste Wahl|Wechselrendite/);
});
for (const [amount, newer, delta] of [["60", "0,00 €", "−775,00 €"], ["120", "300,00 €", "−475,00 €"], ["300", "750,00 €", "−25,00 €"], ["350", "775,00 €", "0,00 €"], ["360", "780,00 €", "+5,00 €"], ["1.800", "1.140,00 €", "+365,00 €"]]) test(`B05-25/26: ${amount} equal annual contribution comparison`, async ({ page }) => {
  await entry(page); await oldConfirm(page, 2027, [2010, 2014], "20.000"); await own(page, amount); await btn(page, "B2 Fördervergleich").click(); await newConfirm(page, 2027, 2); await btn(page, "Getrennte Fördermodelle prüfen").click();
  await expect(page.getByTestId("old-own")).toHaveText(`${amount},00 €`); await expect(page.getByTestId("new-own")).toHaveText(`${amount},00 €`); await expect(page.getByTestId("old-total")).toHaveText("775,00 €"); await expect(page.getByTestId("new-total")).toHaveText(newer); await expect(page.getByTestId("comparison-delta")).toHaveText(delta);
});

test("B05-27/29/30: both results invalidated; separate 2028 children and new cap", async ({ page }) => {
  await entry(page, 2028); await oldConfirm(page, 2028, [2010], "20.000"); await own(page); await btn(page, "B2 Fördervergleich").click(); await newConfirm(page, 2028, 1); await btn(page, "Getrennte Fördermodelle prüfen").click(); await expect(page.getByTestId("comparison-delta")).toBeVisible();
  await label(page, "Neu-Kind 1: Förderfähigkeit und Zuordnung 2028").selectOption("conflicting_assignment"); await noComparison(page);
  await page.getByLabel("Alle Voraussetzungen der hypothetischen", { exact: false }).check(); await page.getByLabel("Vergleichsbasis bestätigt", { exact: false }).check(); await btn(page, "Getrennte Fördermodelle prüfen").click(); await expect(page.getByTestId("old-result")).toBeVisible(); await expect(page.getByTestId("new-status")).toContainText("Fachlich prüfen"); await expect(page.getByTestId("comparison-delta")).toHaveCount(0);
  await label(page, "B-Jahres-Eigenbeitrag in Euro").fill("6.840,01"); await noComparison(page); await page.getByLabel("B: Jahres-Eigenbeitrag für Person", { exact: false }).check(); await evidence(page);
  await label(page, "Neu-Kind 1: Förderfähigkeit und Zuordnung 2028").selectOption("eligible_assigned_confirmed"); await page.getByLabel("Derselbe angezeigte Jahres-Eigenbeitrag", { exact: false }).check(); await page.getByLabel("Alle Voraussetzungen der hypothetischen", { exact: false }).check(); await page.getByLabel("Vergleichsbasis bestätigt", { exact: false }).check(); await btn(page, "Getrennte Fördermodelle prüfen").click();
  await expect(page.getByTestId("old-own")).toHaveText("6.840,01 €"); await expect(page.getByTestId("new-status")).toContainText("über 6.840"); await expect(page.getByTestId("comparison-delta")).toHaveCount(0);
});

for (const destination of ["Übersicht", "Beratungsfälle", "Strukturplanung", "Depotcheck", "Ergebnis & Export", "Mehr & Einstellungen", "Neustart"]) test(`B05-31: shared loss protection ${destination}, cancel preserves both drafts`, async ({ page }) => {
  await entry(page); await btn(page, "A/B-Auswahl").click(); await btn(page, "A – Neue Altersvorsorge planen").click(); await label(page, "Unmittelbare Berechtigung").selectOption("direct_confirmed"); await btn(page, "A/B-Auswahl").click(); await btn(page, "B – Bestehende Riester-Rente prüfen").click();
  await oldConfirm(page); await own(page); await calculate(page); const before = await state(page);
  const action = () => destination === "Neustart" ? btn(page, "Spezialentwurf neu starten").click() : destination === "Mehr & Einstellungen" ? btn(page, destination).click() : nav(page, destination).click();
  page.once("dialog", async d => { expect(d.message()).toContain("verwerfen"); await d.dismiss(); }); await action(); await expect(page.getByTestId("old-total")).toHaveText("51,43 €"); expect(await state(page)).toEqual(before);
  await btn(page, "A/B-Auswahl").click(); await btn(page, "A – Neue Altersvorsorge planen").click(); await expect(label(page, "Unmittelbare Berechtigung")).toHaveValue("direct_confirmed"); await btn(page, "A/B-Auswahl").click(); await btn(page, "B – Bestehende Riester-Rente prüfen").click();
  page.once("dialog", async d => { expect(d.message()).toContain("Vermögensfälle bleiben erhalten"); await d.accept(); }); await action(); if (destination !== "Neustart") await nav(page, "Altersvorsorge").click(); await btn(page, "B – Bestehende Riester-Rente prüfen").click(); await expect(label(page, "Alt-unmittelbare Berechtigung")).toHaveValue("unconfirmed"); expect(await state(page)).toEqual(before);
});

test("B05-31/32: reload discards B without persistence", async ({ page }) => {
  await entry(page); const before = await state(page); await oldConfirm(page); await own(page); await calculate(page); expect(await state(page)).toEqual(before);
  page.once("dialog", d => d.accept()); await page.reload(); await nav(page, "Altersvorsorge").click(); await btn(page, "B – Bestehende Riester-Rente prüfen").click(); await expect(label(page, "Alt-unmittelbare Berechtigung")).toHaveValue("unconfirmed"); await noOld(page); expect(await state(page)).toEqual(before);
});

for (const width of [1440, 390]) test(`B05-32: ${width}px keyboard, error/result focus, source details, no overflow`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await page.goto("./"); await nav(page, "Altersvorsorge").focus(); await page.keyboard.press("Enter"); await btn(page, "B – Bestehende Riester-Rente prüfen").focus(); await page.keyboard.press("Enter"); await expect(page.getByRole("heading", { name: "B1 – Bestandsaufnahme", exact: true })).toBeFocused();
  await oldConfirm(page); await own(page, "120,001"); await calculate(page); await expect(label(page, "B-Jahres-Eigenbeitrag in Euro")).toBeFocused(); await expect(label(page, "B-Jahres-Eigenbeitrag in Euro")).toHaveAttribute("aria-invalid", "true");
  await own(page); await calculate(page); await expect(page.locator(".retirement-result")).toBeFocused(); await expect(page.locator(".retirement-result")).toHaveAttribute("aria-live", "polite");
  await btn(page, "B2 Fördervergleich").click(); await newConfirm(page); await btn(page, "Getrennte Fördermodelle prüfen").click();
  await page.getByText("Regelstand, Quellen und Modellgrenzen", { exact: true }).click(); for (const text of ["ap01b-v1", "2026-10-28", "ap01a-v1", "2026-10-27"]) await expect(page.locator(".retirement-view")).toContainText(text);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const image = await page.locator(".retirement-view").screenshot();
  await info.attach(`b2-${width}`, { body: image, contentType: "image/png" });
  console.log(`AP05A_SCREENSHOT ${JSON.stringify({ name: `b2-${width}`, sha256: createHash("sha256").update(image).digest("hex"), base64: image.toString("base64") })}`);
});

test("B05-32: general originals and exact JSON/XLSX/print before/after B2", async ({ page }, info) => {
  const a = outputCase(), b = planningCase(); a.advisory.caseName = "B05 synthetischer Bestand A"; b.advisory.caseName = "B05 synthetischer Nachbar B";
  for (const item of [a, b]) for (const id of item.advisory.modules) item.moduleStates[id] = { status: "not_started", currentSlide: 0, checklist: {}, notes: "", updatedAt: item.updatedAt };
  const raw = JSON.stringify([a, b], null, 2); await page.goto("./"); await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: CASE_STORAGE_KEY, raw }); await page.reload();
  await nav(page, "Beratungsfälle").click(); await page.getByRole("button", { name: a.advisory.caseName, exact: false }).click(); await nav(page, "Ergebnis & Export").click();
  async function outputs(tag: string) {
    const jsonEvent = page.waitForEvent("download"); await page.getByRole("button", { name: /Vollständige Sicherung/ }).click(); const jsonPath = info.outputPath(`${tag}.json`); await (await jsonEvent).saveAs(jsonPath); const json = JSON.parse(await readFile(jsonPath, "utf8"));
    const xlsxEvent = page.waitForEvent("download"); await page.getByRole("button", { name: /Excel-Arbeitsmappe/ }).click(); const xlsxPath = info.outputPath(`${tag}.xlsx`); await (await xlsxEvent).saveAs(xlsxPath); const wb = XLSX.read(await readFile(xlsxPath), { type: "buffer" });
    return { case: json.case, sheets: Object.fromEntries(wb.SheetNames.map(n => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null })])), print: await page.locator(".print-document").textContent() };
  }
  const before = await state(page), outputBefore = await outputs("before");
  await nav(page, "Altersvorsorge").click(); await btn(page, "B – Bestehende Riester-Rente prüfen").click(); await oldConfirm(page, 2027, [2010, 2014], "20.000"); await own(page); await btn(page, "B2 Fördervergleich").click(); await newConfirm(page, 2027, 2); await btn(page, "Getrennte Fördermodelle prüfen").click(); await expect(page.getByTestId("comparison-delta")).toHaveText("+5,00 €"); expect(await state(page)).toEqual(before);
  page.once("dialog", d => d.accept()); await nav(page, "Ergebnis & Export").click(); expect(await outputs("after")).toEqual(outputBefore); expect(await state(page)).toEqual(before); expect(await page.evaluate(key => localStorage.getItem(key), CASE_STORAGE_KEY)).toBe(raw); expect(outputBefore.case.schemaVersion).toBe(11);
  expect(JSON.stringify(outputBefore)).not.toMatch(/newScenario|eligibleOwnContributionCents|minimumOwnContributionCents/);
});
