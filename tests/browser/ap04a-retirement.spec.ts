import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { CASE_STORAGE_KEY } from "../../app/case-storage";
import { outputCase, planningCase } from "./fixtures";
import { calculateDirectGrant } from "../../app/domain/retirement/direct-grant";
import { euro } from "../../app/presentation/retirement/direct-grant-adapter";
import { enterStep, openGrantEvidence } from "./ap04b-ux2-helpers";
const nav = (p: Page, name: string) => p.locator(".sidebar nav").getByRole("button", { name: new RegExp(name) });
const btn = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
const state = (p: Page) => p.evaluate(() => ({ local: Object.fromEntries(Object.entries(localStorage)), session: Object.fromEntries(Object.entries(sessionStorage)), cookie: document.cookie, url: location.href }));
const evidence = (p: Page, name: string) => p.getByLabel(name, { exact: true });
const ownConfirmed = "Den geplanten Jahres-Eigenbeitrag für Person, Vertrag und Jahr fachlich als förderfähig geprüft";
const childrenQuestion = "Gibt es Kinder, für die eine Kinderzulage infrage kommt?";
const noneConfirmed = "Für Person und Jahr geprüft: keine einzubeziehenden Kinder";
const annualInput = (p: Page) => p.getByTestId("customer-annual-input");
const review = (p: Page) => p.getByTestId("grant-review-message");
async function grantStep(p: Page) { await enterStep(p, "A2"); await openGrantEvidence(p); }
async function entry(p: Page) { await p.goto("./"); await nav(p, "Altersvorsorge").click(); await btn(p, "Neue Altersvorsorge planen").click(); await grantStep(p); }
async function confirmations(p: Page, children = 0) {
  await evidence(p, "Wurde Ihre Förderberechtigung bereits geklärt?").selectOption("checked");
  await p.getByLabel("Geprüfte unmittelbare Berechtigung", { exact: true }).selectOption("direct_confirmed");
  await p.getByLabel("Geprüfte Förderregelung", { exact: true }).selectOption("new_confirmed");
  await p.getByLabel("Geprüfte Vertragszuordnung", { exact: true }).selectOption("single_eligible_confirmed");
  await evidence(p, childrenQuestion).selectOption(children ? "yes" : "no");
  if (children) for (let i = 1; i <= children; i++) {
    await btn(p, "Kind zur Prüfung hinzufügen").click();
    await evidence(p, `Kind ${i}: Förderfähigkeit und Zuordnung`).selectOption("eligible_assigned_confirmed");
  }
  else await evidence(p, noneConfirmed).check();
}
async function annual(p: Page, amount = "360") {
  await annualInput(p).fill(amount);
  await evidence(p, ownConfirmed).check();
}
async function noResult(p: Page) { await expect(p.getByTestId("grant-result")).toHaveCount(0); await expect(p.getByTestId("customer-base-grant")).toHaveCount(0); await expect(p.getByTestId("total-grant")).toHaveCount(0); }
async function picture(p: Page, info: TestInfo, name: string) {
  const bytes = await p.locator(".retirement-view").screenshot({ animations: "disabled" });
  await info.attach(name, { body: bytes, contentType: "image/png" });
  console.log(`AP04A_SCREENSHOT ${JSON.stringify({ name, sha256: createHash("sha256").update(bytes).digest("hex"), base64: bytes.toString("base64") })}`);
}

test("A04-01/02: beide eigenständigen Einstiege, B aktiv, kein neuer allgemeiner Fall", async ({ page }) => {
  await page.goto("./"); const before = await state(page);
  await nav(page, "Altersvorsorge").click();
  await expect(btn(page, "Neue Altersvorsorge planen")).toBeEnabled();
  await expect(btn(page, "B – Bestehende Riester-Rente prüfen")).toBeEnabled();
  await expect(btn(page, "B – Bestehende Riester-Rente prüfen")).toBeVisible();
  await btn(page, "B – Bestehende Riester-Rente prüfen").click();
  await expect(page.getByRole("heading", { name: "B1 – Bestandsaufnahme", exact: true })).toBeVisible();
  await btn(page, "Förderangaben mit Berater prüfen").click();
  await expect(page.getByRole("region", { name: "Alt-Riester-Nachweise", exact: true })).toBeVisible();
  await btn(page, "B2 Fördervergleich").click();
  await expect(page.getByRole("heading", { name: "B2 – Fördervergleich", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Neues hypothetisches Vergleichsszenario", exact: true })).toBeVisible();
  await btn(page, "A/B-Auswahl").click();
  await expect(page.getByRole("heading", { name: "Altersvorsorge", exact: true })).toBeVisible();
  await expect(btn(page, "Neue Altersvorsorge planen")).toBeVisible();
  await expect(btn(page, "B – Bestehende Riester-Rente prüfen")).toBeVisible();
  await nav(page, "Beratungsfälle").click();
  await btn(page, "Altersvorsorge ohne Vermögensfall").click();
  await expect(page.getByRole("heading", { name: "Altersvorsorge", exact: true })).toBeVisible();
  expect(await state(page)).toEqual(before);
});

test("A04-03: alle Nachweise initial unbestätigt; Prüfung ohne Förderbeträge", async ({ page }) => {
  await entry(page);
  for (const label of ["Geprüfte unmittelbare Berechtigung", "Geprüfte Förderregelung", "Geprüfte Vertragszuordnung"])
    await expect(evidence(page, label)).toHaveValue("unconfirmed");
  await expect(evidence(page, childrenQuestion)).toHaveValue("unknown");
  await annual(page);
  await expect(page.getByTestId("customer-grant-status")).toHaveText("Gemeinsam prüfen");
  await noResult(page);
});

for (const year of [2027, 2028]) for (const count of [0, 1, 2]) test(`A04-04/05/11/14: ${year}, ${count} bestätigte Kinder, unverändertes Domainresultat`, async ({ page }, info) => {
  await entry(page); await evidence(page, "Ab wann möchten Sie sparen?").fill(`${year}-01`);
  await confirmations(page, count); await annual(page);
  const direct = calculateDirectGrant({ contributionYear: year, ruleContext: `estg-${year}-v1`, entitlement: "direct_confirmed", regime: "new_confirmed", eligibleContractContext: "single_eligible_confirmed", eligibleOwnContributionCents: 36000,
    children: Array.from({ length: count }, (_, i) => ({ id: `synthetic-${i}`, contributionYear: year, status: "eligible_assigned_confirmed" })), pendingEvidence: ["bonus"] });
  expect(direct.status).toBe("calculated"); if (direct.status !== "calculated") throw new Error("domain fixture");
  await expect(page.getByTestId("customer-base-grant")).toHaveText(euro(direct.baseGrantCents));
  await expect(page.getByTestId("total-grant")).toHaveText(euro(direct.totalGrantCents));
  await expect(page.getByTestId("total-inflow")).toHaveText(euro(36000 + direct.totalGrantCents));
  expect(await page.getByTestId("child-grant").allTextContents()).toEqual(direct.childGrants.map(c => euro(c.grantCents)));
  await expect(page.locator(".retirement-view")).toContainText("enthält keinen Einmalbonus");
  await page.getByText("Regelstand und Quellen", { exact: true }).click();
  await expect(page.locator(".retirement-view")).toContainText(`estg-${year}-v1`);
  await expect(page.locator(".retirement-view")).toContainText("2026-10-27");
  await expect(page.locator(".retirement-view")).toContainText("ap01a-v1");
  if (year === 2027 && count === 2) await picture(page, info, "a2-desktop-zwei-kinder");
});

for (const [amount, base] of [["0", "0,00 €"], ["119,99", "0,00 €"], ["120", "60,00 €"], ["120,01", null], ["300", "150,00 €"], ["360", "180,00 €"], ["1.800", "540,00 €"]] as const) test(`A04-07: Jahresgrenze ${amount}`, async ({ page }) => {
  await entry(page); await confirmations(page); await annual(page, amount);
  if (base === null) { await noResult(page); await expect(page.getByTestId("grant-review-message")).toContainText("Centbruchteil"); }
  else await expect(page.getByTestId("customer-base-grant")).toHaveText(base);
});

test("A04-08/15: Oktober, genaue Monatsanzahl, Einmalbeitrag und Wechsel des aktiven Zahlungsplans", async ({ page }) => {
  await entry(page); await confirmations(page);
  await evidence(page, "Ab wann möchten Sie sparen?").fill("2027-10");
  await evidence(page, "Bis wann möchten Sie sparen?").fill("2027-12");
  await evidence(page, "Wie viel möchten Sie monatlich einzahlen?").fill("25");
  await page.getByText("Eigene Einmalzahlung ergänzen", { exact: true }).click();
  await evidence(page, "Zusätzliche eigene Einmalzahlung einplanen").check();
  await evidence(page, "Einmalzahlung in Euro").fill("45,00");
  await evidence(page, "Monat der Einmalzahlung").fill("2027-11");
  await expect(page.getByTestId("customer-annual")).toContainText("120,00 €");
  await expect(page.getByTestId("customer-annual")).toContainText("3 Monatsraten");
  await evidence(page, ownConfirmed).check();
  await expect(page.getByTestId("customer-base-grant")).toHaveText("60,00 €");
  await evidence(page, "Bis wann möchten Sie sparen?").fill("2027-11");
  await noResult(page);
  await expect(evidence(page, ownConfirmed)).not.toBeChecked();
  await annualInput(page).fill("80");
  await expect(evidence(page, "Wie viel möchten Sie monatlich einzahlen?")).toHaveValue("17,50");
  await expect(page.getByTestId("customer-annual")).toContainText("80,00 €");
  await noResult(page);
});

for (const amount of ["", "120,001", "-1", "1e3", "90071992547410", "6.840,01"]) test(`A04-09/10: ungültiger oder ungeprüfter Beitrag '${amount}'`, async ({ page }) => {
  await entry(page); await confirmations(page); await annual(page, amount); await noResult(page);
  await expect(page.getByTestId("grant-review-message")).toContainText(amount === "6.840,01" ? "über 6.840" : "eingeben");
});

for (const status of ["assignment_unconfirmed", "conflicting_assignment", "eligibility_unconfirmed"]) test(`A04-12: Kinderstatus ${status} ohne vollständige Bestätigung`, async ({ page }) => {
  await entry(page); await confirmations(page, 1);
  await evidence(page, "Kind 1: Förderfähigkeit und Zuordnung").selectOption(status);
  await annual(page); await noResult(page); await expect(review(page)).toContainText(/Kinder|Kindes/);
});
for (const [label, value] of [["Geprüfte unmittelbare Berechtigung", "indirect"], ["Geprüfte Förderregelung", "old"], ["Geprüfte Vertragszuordnung", "multiple"], ["Geprüfte Vertragszuordnung", "transition_unconfirmed"]]) test(`A04-13: ${value} ohne Förderzahlen`, async ({ page }) => {
  await entry(page); await confirmations(page); await page.getByLabel(label, { exact: true }).selectOption(value);
  // Regime and contract changes require independent child evidence to be entered again.
  if (value === "old" || value === "multiple") await evidence(page, noneConfirmed).check();
  await annual(page); await noResult(page); await expect(page.getByTestId("grant-review-message")).toContainText(value === "transition_unconfirmed" ? "Fachlich prüfen" : "Derzeit nicht unterstützt");
});

test("A04-05/15/16: Navigation erhält Angaben, Jahrwechsel entzieht sämtliche Jahresbestätigungen", async ({ page }) => {
  await entry(page); await confirmations(page, 1); await annual(page);
  await btn(page, "A/B-Auswahl").click(); await btn(page, "Neue Altersvorsorge planen").click(); await grantStep(page);
  await expect(evidence(page, "Geprüfte unmittelbare Berechtigung")).toHaveValue("direct_confirmed");
  await expect(annualInput(page)).toHaveValue("360");
  await evidence(page, "Ab wann möchten Sie sparen?").fill("2028-01"); await noResult(page);
  for (const label of ["Geprüfte unmittelbare Berechtigung", "Geprüfte Förderregelung", "Geprüfte Vertragszuordnung"])
    await expect(evidence(page, label)).toHaveValue("unconfirmed");
  await expect(evidence(page, ownConfirmed)).not.toBeChecked();
  await expect(evidence(page, "Kind 1: Förderfähigkeit und Zuordnung")).toHaveValue("assignment_unconfirmed");
});

for (const destination of ["Übersicht", "Beratungsfälle", "Strukturplanung", "Depotcheck", "Ergebnis & Export", "Mehr & Einstellungen", "Neustart"]) test(`A04-17: Verlustschutz und Abbruch bei ${destination}`, async ({ page }) => {
  await entry(page); await confirmations(page); await annual(page, "300");
  const before = await state(page);
  const action = () => destination === "Neustart" ? btn(page, "Spezialentwurf neu starten").click() : destination === "Mehr & Einstellungen" ? btn(page, destination).click() : nav(page, destination).click();
  page.once("dialog", async dialog => { expect(dialog.message()).toContain("verwerfen"); await dialog.dismiss(); });
  await action(); await expect(page.getByTestId("customer-base-grant")).toHaveText("150,00 €");
  expect(await state(page)).toEqual(before);
  page.once("dialog", async dialog => { expect(dialog.message()).toContain("Vermögensfälle bleiben erhalten"); await dialog.accept(); });
  await action(); await noResult(page); expect(await state(page)).toEqual(before);
  if (destination !== "Neustart") await nav(page, "Altersvorsorge").click();
  await btn(page, "Neue Altersvorsorge planen").click(); await grantStep(page);
  await expect(page.getByLabel("Geprüfte unmittelbare Berechtigung", { exact: true })).toHaveValue("unconfirmed");
});

test("A04-17/18: allgemeiner Entwurf, gesunde Nachbarn, Store/JSON/XLSX/Druck unverändert", async ({ page }, info) => {
  const a = outputCase(), b = planningCase(); a.advisory.caseName = "AP04 synthetischer Bestand A"; b.advisory.caseName = "AP04 synthetischer Nachbar B";
  // Fully specify selected modules. The unchanged exporter's blank-state fallback
  // creates a fresh display timestamp on each export; that is not a store mutation.
  for (const item of [a, b]) for (const id of item.advisory.modules) item.moduleStates[id] = {
    status: "not_started", currentSlide: 0, checklist: {}, notes: "", updatedAt: item.updatedAt,
  };
  const raw = JSON.stringify([a, b], null, 2);
  await page.goto("./"); await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: CASE_STORAGE_KEY, raw }); await page.reload();
  await nav(page, "Beratungsfälle").click(); await page.getByRole("button", { name: a.advisory.caseName, exact: false }).click();
  await nav(page, "Ergebnis & Export").click();
  async function outputs(tag: string) {
    const jsonEvent = page.waitForEvent("download"); await page.getByRole("button", { name: /Vollständige Sicherung/ }).click();
    const jsonPath = info.outputPath(`${tag}.json`); await (await jsonEvent).saveAs(jsonPath);
    const json = JSON.parse(await readFile(jsonPath, "utf8"));
    const xlsxEvent = page.waitForEvent("download"); await page.getByRole("button", { name: /Excel-Arbeitsmappe/ }).click();
    const xlsxPath = info.outputPath(`${tag}.xlsx`); await (await xlsxEvent).saveAs(xlsxPath);
    const wb = XLSX.read(await readFile(xlsxPath), { type: "buffer" });
    return { case: json.case, sheets: Object.fromEntries(wb.SheetNames.map(name => [name, XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null })])), print: await page.locator(".print-document").textContent() };
  }
  const before = await state(page), outputBefore = await outputs("before");
  await nav(page, "Altersvorsorge").click(); await btn(page, "Neue Altersvorsorge planen").click(); await grantStep(page);
  await confirmations(page, 2); await annual(page);
  expect(await state(page)).toEqual(before);
  page.once("dialog", d => d.accept()); await nav(page, "Ergebnis & Export").click();
  expect(await outputs("after")).toEqual(outputBefore); expect(await state(page)).toEqual(before);
  expect(await page.evaluate(key => localStorage.getItem(key), CASE_STORAGE_KEY)).toBe(raw);
  expect(JSON.stringify(outputBefore)).not.toContain("eligibleOwnContributionCents");
  expect(outputBefore.case.schemaVersion).toBe(11);
  await nav(page, "Beratungsfälle").click(); await btn(page, "＋ Neuer Fall").click();
  await expect(page.locator(".wizard-head")).toBeVisible();
});

test("A04-19: Reload verliert nur flüchtigen Entwurf; keinerlei neuer Datenspeicher", async ({ page }) => {
  await entry(page); const before = await state(page); await confirmations(page); await annual(page);
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    (window as unknown as { ap04Databases: string }).ap04Databases = JSON.stringify(dbs);
  });
  expect(await state(page)).toEqual(before);
  await expect(page.locator(".retirement-view")).toContainText("Eingaben werden nicht gespeichert");
  page.once("dialog", dialog => dialog.accept()); await page.reload();
  await nav(page, "Altersvorsorge").click(); await btn(page, "Neue Altersvorsorge planen").click(); await grantStep(page);
  await expect(page.getByLabel("Geprüfte unmittelbare Berechtigung", { exact: true })).toHaveValue("unconfirmed");
  expect(await state(page)).toEqual(before); expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
});

for (const width of [1440, 390]) test(`A04-20: ${width}px, Tastatur, Fokus, Hilfe und keine horizontale Scrollfläche`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await page.goto("./");
  await nav(page, "Altersvorsorge").focus(); await page.keyboard.press("Enter");
  await btn(page, "Neue Altersvorsorge planen").focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Ihre Situation und Förderung", exact: true })).toBeFocused();
  await grantStep(page);
  await expect(page.getByText(/Beruf, Familienstand und Geburtsjahr ersetzen/)).toBeVisible();
  await confirmations(page); await annual(page, "120,001");
  await btn(page, "Weiter zum Produktvergleich").click();
  await expect(annualInput(page)).toHaveAttribute("aria-invalid", "true");
  await expect(annualInput(page)).toBeFocused();
  const geometry = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth,
    header: document.querySelector(".topbar")!.getBoundingClientRect().width,
    view: document.querySelector(".retirement-view")!.getBoundingClientRect().width }));
  expect(geometry.documentWidth, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.width);
  await picture(page, info, `a2-fehler-${width}`);
});

for (const [label, value] of [["Geprüfte unmittelbare Berechtigung", "unconfirmed"], ["Geprüfte Förderregelung", "old"], ["Geprüfte Vertragszuordnung", "multiple"], ["Kind 1: Förderfähigkeit und Zuordnung", "conflicting_assignment"]]) test(`A04-15: ${label} entfernt berechnetes Ergebnis sofort`, async ({ page }) => {
  await entry(page); await confirmations(page, 1); await annual(page); await expect(page.getByTestId("grant-result")).toBeVisible();
  await evidence(page, label).selectOption(value); await noResult(page);
});
for (const year of [2026, 2029]) test(`A04-06: manipuliertes Jahr ${year} erhält keine unterstützte Fördervorschau`, async ({ page }) => {
  await entry(page);
  await evidence(page, "Ab wann möchten Sie sparen?").fill(`${year}-01`);
  await confirmations(page); await annual(page);
  await noResult(page); await expect(review(page)).toContainText("Nur 2027 und 2028");
});
