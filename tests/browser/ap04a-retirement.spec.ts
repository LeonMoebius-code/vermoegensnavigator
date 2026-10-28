import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { CASE_STORAGE_KEY } from "../../app/case-storage";
import { outputCase, planningCase } from "./fixtures";
import { calculateDirectGrant } from "../../app/domain/retirement/direct-grant";
import { euro } from "../../app/presentation/retirement/direct-grant-adapter";
const nav = (p: Page, name: string) => p.locator(".sidebar nav").getByRole("button", { name: new RegExp(name) });
const btn = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
const state = (p: Page) => p.evaluate(() => ({ local: Object.fromEntries(Object.entries(localStorage)), session: Object.fromEntries(Object.entries(sessionStorage)), cookie: document.cookie, url: location.href }));
async function entry(p: Page) { await p.goto("./"); await nav(p, "Altersvorsorge").click(); await btn(p, "A – Neue Altersvorsorge planen").click(); }
async function confirmations(p: Page, children = 0) {
  await p.getByLabel("Unmittelbare Berechtigung", { exact: true }).selectOption("direct_confirmed");
  await p.getByLabel("Förderregime", { exact: true }).selectOption("new_confirmed");
  await p.getByLabel("Förderfähiger Vertrag", { exact: true }).selectOption("single_eligible_confirmed");
  await p.getByLabel("Kinderzuordnung im Beitragsjahr", { exact: true }).selectOption(children ? "assigned_confirmed" : "none_confirmed");
  if (children) for (let i = 1; i <= children; i++) {
    if (i > 1) await btn(p, "Kind hinzufügen").click();
    await p.getByLabel(`Kind ${i}: Förderfähigkeit und Zuordnung`, { exact: false }).selectOption("eligible_assigned_confirmed");
  }
}
async function annual(p: Page, amount = "360") {
  await btn(p, "A2 Sparen & Förderung").click();
  await p.getByLabel("Förderfähiger Jahres-Eigenbeitrag in Euro", { exact: true }).fill(amount);
  await p.getByLabel("Beitragsstand", { exact: true }).selectOption("planned");
  await p.getByLabel("Den angezeigten Jahres-Eigenbeitrag", { exact: false }).check();
  await btn(p, "Fördervorschau prüfen").click();
}
async function noResult(p: Page) { await expect(p.getByTestId("grant-result")).toHaveCount(0); await expect(p.getByTestId("base-grant")).toHaveCount(0); await expect(p.getByTestId("total-grant")).toHaveCount(0); }
async function picture(p: Page, info: TestInfo, name: string) {
  const bytes = await p.locator(".retirement-view").screenshot({ animations: "disabled" });
  await info.attach(name, { body: bytes, contentType: "image/png" });
  console.log(`AP04A_SCREENSHOT ${JSON.stringify({ name, sha256: createHash("sha256").update(bytes).digest("hex"), base64: bytes.toString("base64") })}`);
}

test("A04-01/02: beide eigenständigen Einstiege, B aktiv, kein neuer allgemeiner Fall", async ({ page }) => {
  await page.goto("./"); const before = await state(page);
  await nav(page, "Altersvorsorge").click();
  await expect(btn(page, "A – Neue Altersvorsorge planen")).toBeEnabled();
  await expect(btn(page, "B – Bestehende Riester-Rente prüfen")).toBeEnabled();
  await expect(page.locator(".retirement-cards")).toContainText("B1/B2");
  await nav(page, "Beratungsfälle").click();
  await btn(page, "Altersvorsorge ohne Vermögensfall").click();
  await expect(page.getByRole("heading", { name: "Altersvorsorge", exact: true })).toBeVisible();
  expect(await state(page)).toEqual(before);
});

test("A04-03: alle Nachweise initial unbestätigt; Prüfung ohne Förderbeträge", async ({ page }) => {
  await entry(page);
  for (const label of ["Unmittelbare Berechtigung", "Förderregime", "Förderfähiger Vertrag", "Kinderzuordnung im Beitragsjahr"]) await expect(page.getByLabel(label, { exact: true })).toHaveValue("unconfirmed");
  await annual(page);
  await expect(page.getByTestId("grant-status")).toContainText("Unmittelbare Berechtigung"); await noResult(page);
});

for (const year of [2027, 2028]) for (const count of [0, 1, 2]) test(`A04-04/05/11/14: ${year}, ${count} bestätigte Kinder, unverändertes Domainresultat`, async ({ page }, info) => {
  await entry(page); await page.getByLabel("Beitragsjahr", { exact: true }).selectOption(String(year));
  await confirmations(page, count); await annual(page);
  const direct = calculateDirectGrant({ contributionYear: year, ruleContext: `estg-${year}-v1`, entitlement: "direct_confirmed", regime: "new_confirmed", eligibleContractContext: "single_eligible_confirmed", eligibleOwnContributionCents: 36000,
    children: Array.from({ length: count }, (_, i) => ({ id: `synthetic-${i}`, contributionYear: year, status: "eligible_assigned_confirmed" })), pendingEvidence: ["bonus"] });
  expect(direct.status).toBe("calculated"); if (direct.status !== "calculated") throw new Error("domain fixture");
  await expect(page.getByTestId("base-grant")).toHaveText(euro(direct.baseGrantCents));
  await expect(page.getByTestId("total-grant")).toHaveText(euro(direct.totalGrantCents));
  await expect(page.getByTestId("total-inflow")).toHaveText(euro(36000 + direct.totalGrantCents));
  expect(await page.getByTestId("child-grant").allTextContents()).toEqual(direct.childGrants.map(c => euro(c.grantCents)));
  await expect(page.locator(".retirement-view")).toContainText("in den angezeigten Förderbeträgen nicht enthalten");
  await page.getByText("Regelstand, Quellen und Modellgrenzen", { exact: true }).click();
  await expect(page.locator(".retirement-view")).toContainText(`estg-${year}-v1`);
  await expect(page.locator(".retirement-view")).toContainText("2026-10-27");
  await expect(page.locator(".retirement-view")).toContainText("ap01a-v1");
  if (year === 2027 && count === 2) await picture(page, info, "a2-desktop-zwei-kinder");
});

for (const [amount, base] of [["0", "0,00 €"], ["119,99", "0,00 €"], ["120", "60,00 €"], ["120,01", null], ["300", "150,00 €"], ["360", "180,00 €"], ["1.800", "540,00 €"]] as const) test(`A04-07: Jahresgrenze ${amount}`, async ({ page }) => {
  await entry(page); await confirmations(page); await annual(page, amount);
  if (base === null) { await noResult(page); await expect(page.getByTestId("grant-status")).toContainText("Centbruchteil"); }
  else await expect(page.getByTestId("base-grant")).toHaveText(base);
});

test("A04-08/15: Oktober, genaue Monatsanzahl, Einmalbeitrag, Moduswechsel verlangt Neueingabe", async ({ page }) => {
  await entry(page); await confirmations(page); await btn(page, "A2 Sparen & Förderung").click();
  await page.getByLabel("Beitragsmodus", { exact: true }).selectOption("monthly");
  await btn(page, "25 € / Monat").click();
  await page.getByLabel("Tatsächlicher / geplanter Startmonat", { exact: false }).selectOption("10");
  const months = page.getByLabel("Beitragswirksame Monatsanzahl", { exact: true });
  expect(await months.locator("option").allTextContents()).toEqual(["Bitte wählen", "1", "2", "3"]);
  await months.selectOption("3");
  await page.getByLabel("Zusätzlicher einmaliger förderfähiger Eigenbeitrag", { exact: true }).check();
  await page.getByLabel("Einmaliger Eigenbeitrag in Euro", { exact: true }).fill("45,00");
  await expect(page.locator(".retirement-annual")).toContainText("120,00 €");
  await expect(page.locator(".retirement-annual")).toContainText("3 Monatsraten");
  await page.getByLabel("Beitragsstand", { exact: true }).selectOption("planned");
  await page.getByLabel("Den angezeigten Jahres-Eigenbeitrag", { exact: false }).check();
  await btn(page, "Fördervorschau prüfen").click(); await expect(page.getByTestId("base-grant")).toHaveText("60,00 €");
  await months.selectOption("2"); await noResult(page);
  await expect(page.getByLabel("Den angezeigten Jahres-Eigenbeitrag", { exact: false })).not.toBeChecked();
  await page.getByLabel("Beitragsmodus", { exact: true }).selectOption("annual");
  await expect(page.getByLabel("Förderfähiger Jahres-Eigenbeitrag in Euro", { exact: true })).toHaveValue("");
  await expect(page.locator(".retirement-form")).toContainText("Bitte neu eingeben"); await noResult(page);
});

for (const amount of ["", "120,001", "-1", "1e3", "90071992547410", "6.840,01"]) test(`A04-09/10: ungültiger oder ungeprüfter Beitrag '${amount}'`, async ({ page }) => {
  await entry(page); await confirmations(page); await annual(page, amount); await noResult(page);
  await expect(page.getByTestId("grant-status")).toContainText(amount === "6.840,01" ? "über 6.840" : "eingeben");
});

for (const status of ["unconfirmed", "conflicting", "assigned_confirmed"]) test(`A04-12: Kinderstatus ${status} ohne vollständige Bestätigung`, async ({ page }) => {
  await entry(page); await confirmations(page);
  await page.getByLabel("Kinderzuordnung im Beitragsjahr", { exact: true }).selectOption(status);
  await annual(page); await noResult(page); await expect(page.getByTestId("grant-status")).toContainText(/Kinder|Kindes/);
});
for (const [label, value] of [["Unmittelbare Berechtigung", "indirect"], ["Förderregime", "old"], ["Förderfähiger Vertrag", "multiple"], ["Förderfähiger Vertrag", "transition_unconfirmed"]]) test(`A04-13: ${value} ohne Förderzahlen`, async ({ page }) => {
  await entry(page); await confirmations(page); await page.getByLabel(label, { exact: true }).selectOption(value);
  await annual(page); await noResult(page); await expect(page.getByTestId("grant-status")).toContainText(value === "transition_unconfirmed" ? "Fachlich prüfen" : "Derzeit nicht unterstützt");
});

test("A04-05/15/16: Navigation erhält Angaben, Jahrwechsel entzieht sämtliche Jahresbestätigungen", async ({ page }) => {
  await entry(page); await confirmations(page, 1); await annual(page);
  await btn(page, "A/B-Auswahl").click(); await btn(page, "A – Neue Altersvorsorge planen").click();
  await expect(page.getByLabel("Unmittelbare Berechtigung", { exact: true })).toHaveValue("direct_confirmed");
  await btn(page, "A2 Sparen & Förderung").click();
  await expect(page.getByLabel("Förderfähiger Jahres-Eigenbeitrag in Euro", { exact: true })).toHaveValue("360");
  await btn(page, "A1 Fördercheck").click();
  await page.getByLabel("Beitragsjahr", { exact: true }).selectOption("2028"); await noResult(page);
  await expect(page.getByLabel("Unmittelbare Berechtigung", { exact: true })).toHaveValue("unconfirmed");
  await expect(page.getByLabel("Förderregime", { exact: true })).toHaveValue("unconfirmed");
  await expect(page.getByLabel("Förderfähiger Vertrag", { exact: true })).toHaveValue("unconfirmed");
  await expect(page.getByLabel("Kinderzuordnung im Beitragsjahr", { exact: true })).toHaveValue("unconfirmed");
  await btn(page, "A2 Sparen & Förderung").click(); await expect(page.getByLabel("Beitragsstand", { exact: true })).toHaveValue("unconfirmed");
});

for (const destination of ["Übersicht", "Beratungsfälle", "Strukturplanung", "Depotcheck", "Ergebnis & Export", "Mehr & Einstellungen", "Neustart"]) test(`A04-17: Verlustschutz und Abbruch bei ${destination}`, async ({ page }) => {
  await entry(page); await confirmations(page); await annual(page, "300");
  const before = await state(page);
  const action = () => destination === "Neustart" ? btn(page, "Spezialentwurf neu starten").click() : destination === "Mehr & Einstellungen" ? btn(page, destination).click() : nav(page, destination).click();
  page.once("dialog", async dialog => { expect(dialog.message()).toContain("verwerfen"); await dialog.dismiss(); });
  await action(); await expect(page.getByTestId("base-grant")).toHaveText("150,00 €");
  expect(await state(page)).toEqual(before);
  page.once("dialog", async dialog => { expect(dialog.message()).toContain("Vermögensfälle bleiben erhalten"); await dialog.accept(); });
  await action(); await noResult(page); expect(await state(page)).toEqual(before);
  if (destination !== "Neustart") await nav(page, "Altersvorsorge").click();
  await btn(page, "A – Neue Altersvorsorge planen").click();
  await expect(page.getByLabel("Unmittelbare Berechtigung", { exact: true })).toHaveValue("unconfirmed");
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
  await nav(page, "Altersvorsorge").click(); await btn(page, "A – Neue Altersvorsorge planen").click();
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
  await expect(page.locator(".retirement-view")).toContainText("keine automatische Wiederherstellung");
  page.once("dialog", dialog => dialog.accept()); await page.reload();
  await nav(page, "Altersvorsorge").click(); await btn(page, "A – Neue Altersvorsorge planen").click();
  await expect(page.getByLabel("Unmittelbare Berechtigung", { exact: true })).toHaveValue("unconfirmed");
  expect(await state(page)).toEqual(before); expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
});

for (const width of [1440, 390]) test(`A04-20: ${width}px, Tastatur, Fokus, Hilfe und keine horizontale Scrollfläche`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await page.goto("./");
  await nav(page, "Altersvorsorge").focus(); await page.keyboard.press("Enter");
  await btn(page, "A – Neue Altersvorsorge planen").focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "A1 – Fördercheck", exact: true })).toBeFocused();
  await page.locator(".retirement-form").getByText("Was bedeutet das?", { exact: true }).first().click();
  await expect(page.locator(".retirement-form")).toContainText("Berufsbezeichnung");
  await confirmations(page); await annual(page, "120,001");
  await expect(page.getByLabel("Förderfähiger Jahres-Eigenbeitrag in Euro", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Förderfähiger Jahres-Eigenbeitrag in Euro", { exact: true })).toBeFocused();
  const geometry = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth,
    header: document.querySelector(".topbar")!.getBoundingClientRect().width,
    view: document.querySelector(".retirement-view")!.getBoundingClientRect().width }));
  expect(geometry.documentWidth, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.width);
  await picture(page, info, `a2-fehler-${width}`);
});

for (const [label, value] of [["Unmittelbare Berechtigung", "unconfirmed"], ["Förderregime", "old"], ["Förderfähiger Vertrag", "multiple"], ["Kind 1: Förderfähigkeit und Zuordnung", "conflicting_assignment"]]) test(`A04-15: ${label} entfernt berechnetes Ergebnis sofort`, async ({ page }) => {
  await entry(page); await confirmations(page, 1); await annual(page); await expect(page.getByTestId("grant-result")).toBeVisible();
  await btn(page, "A1 Fördercheck").click(); await page.getByLabel(label, { exact: label !== "Kind 1: Förderfähigkeit und Zuordnung" }).selectOption(value); await noResult(page);
});
for (const year of [2026, 2029]) test(`A04-06: manipuliertes Jahr ${year} erhält keine unterstützte Fördervorschau`, async ({ page }) => {
  await entry(page); const yearSelect = page.getByLabel("Beitragsjahr", { exact: true });
  expect(await yearSelect.locator("option").allTextContents()).toEqual(["2027 – estg-2027-v1", "2028 – estg-2028-v1"]);
  await yearSelect.evaluate((el, year) => { const option = document.createElement("option"); option.value = String(year); option.textContent = String(year); el.appendChild(option); }, year);
  await yearSelect.selectOption(String(year)); await confirmations(page); await annual(page);
  await noResult(page); await expect(page.getByTestId("grant-status")).toContainText("Nur 2027 und 2028");
});
