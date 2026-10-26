import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { CASE_STORAGE_KEY, RECOVERY_PREFIX } from "../../app/case-storage";
import type { AdvisoryCase } from "../../app/case-model";
import { qualityNeedsCase, qualityOptionalCase, qualityProtectedCase } from "../../scripts/quality-fixtures";
import { modelPortfolioCase } from "../../scripts/modelportfolio-fixtures";

const nav = (page: Page, name: string) => page.getByRole("navigation").getByRole("button", { name }).click();
const state = (raw: string) => ({ cookies: [], origins: [{ origin: "http://127.0.0.1:4173", localStorage: [{ name: CASE_STORAGE_KEY, value: raw }] }] });
const stored = (page: Page): Promise<AdvisoryCase[]> => page.evaluate(key => JSON.parse(localStorage.getItem(key) || "[]"), CASE_STORAGE_KEY);
async function open(page: Page, name: string) {
  await nav(page, "Beratungsfälle");
  await page.getByRole("button", { name, exact: false }).click();
}
async function download(page: Page, info: TestInfo, label: RegExp, tag: string) {
  const event = page.waitForEvent("download");
  const settings = page.locator(".settings-view");
  await (await settings.count() ? settings : page).getByRole("button", { name: label }).click();
  const file = await event;
  expect(await file.failure()).toBeNull();
  const path = info.outputPath(`${tag}-${file.suggestedFilename()}`);
  await file.saveAs(path);
  return readFile(path);
}

test.describe("Kapitalbedarfe: reale Termine, Ausgaben und Reload", () => {
  const fixture = qualityNeedsCase();
  test.use({ storageState: state(JSON.stringify([fixture])) });
  test("1,49/1,50, führender Termin, echte JSON/XLSX-Ausgaben und feste Fallreferenz", async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto("./"); await open(page, fixture.advisory.caseName);
    await page.locator(".wizard-steps").getByRole("button", { name: /Kapitalbedarfe/ }).click();
    const rows = page.locator(".need-row-v2");
    for (const i of [0, 1]) {
      await expect(rows.nth(i).locator(".derived-bucket")).toContainText("15.04.2028 · 18 Monate · Zieljahr 2028");
    }
    const exactYears = rows.nth(2).getByRole("spinbutton", { name: "Alternativ in Jahren" });
    await expect(exactYears).toHaveValue("");
    await expect(rows.nth(2).locator(".derived-bucket")).toContainText("01.04.2028");
    // F-012: completed explicit apply clears the mode; drafts do not mutate the case.
    await exactYears.fill("1.5");
    await rows.nth(2).getByRole("button", { name: "Termin übernehmen", exact: true }).click();
    await expect(rows.nth(2).locator('input[type="date"]')).toHaveValue("");
    await expect(rows.nth(2).locator(".derived-bucket")).toContainText("15.04.2028");
    await rows.nth(2).getByLabel("Konkreter Termin").fill("2028-04-01");
    await rows.nth(2).getByRole("button", { name: "Termin übernehmen", exact: true }).click();
    await expect(exactYears).toHaveValue("");
    await page.locator(".wizard-head").getByRole("button", { name: "Fall speichern", exact: true }).click();
    const saved = (await stored(page))[0];
    expect(saved.advisory.needs.slice(0, 2)).toEqual(fixture.advisory.needs.slice(0, 2));
    expect(saved.createdAt).toBe(fixture.createdAt); expect(saved.versions).toEqual(fixture.versions);
    await nav(page, "Strukturplanung");
    await expect(page.locator(".capital-pot-workspace")).toContainText("2028");
    await nav(page, "Ergebnis & Export");
    const workbook = XLSX.read(await download(page, info, /Excel-Arbeitsmappe/, "needs-xlsx"), { type: "buffer" });
    const output = XLSX.utils.sheet_to_json<{ Termin: string; Zieljahr: number; Monate: number }>(workbook.Sheets.Kapitalbedarfe);
    expect(output.map(r => [r.Termin, r.Monate, r.Zieljahr])).toEqual([
      ["2028-04-15", 18, 2028], ["2028-04-15", 18, 2028], ["2028-04-01", 18, 2028],
    ]);
    await expect(page.locator(".print-needs")).toContainText("15.04.2028 · berechnet (18 Monate)");
    const json = JSON.parse((await download(page, info, /Vollständige Sicherung/, "needs-json")).toString()).case as AdvisoryCase;
    expect(json.advisory.needs).toEqual(saved.advisory.needs); expect(json.plans).toEqual(saved.plans);
    await page.reload(); await open(page, fixture.advisory.caseName);
    await page.locator(".wizard-steps").getByRole("button", { name: /Kapitalbedarfe/ }).click();
    await expect(rows.nth(0).locator(".derived-bucket")).toContainText("15.04.2028 · 18 Monate · Zieljahr 2028");
    expect((await stored(page))[0]).toEqual(saved);
    expect(errors).toEqual([]);
    console.log("PASS needs browser: relative/exact editing, original years/history, actual XLSX/JSON, print and stable reload on recorded case date");
  });
});

for (const kind of ["optional", "protected", "mixed", "malformed"] as const) {
  test.describe(`Recovery ${kind}`, () => {
    const healthy = qualityNeedsCase("quality-healthy"); healthy.advisory.caseName = "Synthetischer gesunder Nachbarfall";
    const entries = kind === "optional" ? [qualityOptionalCase(), healthy]
      : kind === "protected" ? [qualityProtectedCase(), healthy]
      : [qualityProtectedCase(), qualityOptionalCase(), healthy];
    const raw = kind === "malformed" ? "{synthetic-invalid-json" : JSON.stringify(entries, null, 2);
    test.use({ storageState: state(raw) });
    test("Meldung, Originaldownload und unveränderte Schutzverträge", async ({ page }, info) => {
      await page.goto("./");
      const notice = page.locator(".case-store-notice");
      if (kind === "optional") await expect(notice).toHaveCount(0);
      else {
        await expect(notice).toBeVisible();
        await expect(notice).toHaveAttribute("role", "alert");
      }
      if (kind !== "optional") {
        await expect(notice).not.toContainText("0 beschädigte");
        await expect(notice).not.toContainText("VERTRAULICHER-TESTWERT");
      }
      if (kind === "mixed") {
        await expect(notice).toContainText("2 Positionen");
        await expect(notice).toContainText("Datumsangaben");
        await expect(notice).toContainText("Die betroffenen Fälle bleiben lesbar");
      }
      if (kind === "protected" || kind === "mixed") await expect(notice).toContainText("1 beschädigter oder inkonsistenter Fall ist geschützt");
      if (kind === "malformed") await expect(notice).toContainText("Speichern ist zum Schutz des Bestands gesperrt");
      await page.getByRole("button", { name: "Mehr & Einstellungen", exact: true }).click();
      if (kind === "optional") await expect(page.locator(".settings-view")).toContainText("2 Positionen");
      expect((await download(page, info, /Originalbestand zur Wiederherstellung herunterladen/, `original-${kind}`)).toString()).toBe(raw);
      expect(await page.evaluate(key => localStorage.getItem(key), CASE_STORAGE_KEY)).toBe(raw);
      if (kind === "malformed") {
        // A newly started case cannot overwrite a wholly unreadable store.
        await nav(page, "Depotcheck");
        await page.getByRole("button", { name: "Fall speichern", exact: true }).click();
        await expect(notice).toContainText("Bestand wurde nicht überschrieben");
        expect(await page.evaluate(key => localStorage.getItem(key), CASE_STORAGE_KEY)).toBe(raw);
      } else {
        await nav(page, "Beratungsfälle");
        await expect(page.getByRole("button", { name: /Synthetischer geschützter Fall/ })).toHaveCount(0);
        if (kind !== "protected") await expect(page.getByRole("button", { name: /Synthetische optionale Daten/ })).toBeVisible();
        await page.getByRole("button", { name: healthy.advisory.caseName }).click();
        await nav(page, "Depotcheck");
        await page.getByRole("button", { name: "Fall speichern", exact: true }).click();
        const backups = await page.evaluate(prefix => Object.keys(localStorage).filter(k => k.startsWith(prefix)).map(k => localStorage.getItem(k)), RECOVERY_PREFIX);
        expect(backups).toEqual([raw]);
        const saved = await stored(page);
        expect(saved.find(c => c.id === healthy.id)!.versions).toEqual(healthy.versions);
        if (kind !== "optional") expect(saved.find(c => c.id === "quality-protected")).toEqual(entries[0]);
        await page.reload();
        await expect(page.getByText(/Originalsicherungen zur Wiederherstellung/)).toHaveCount(0);
        await page.getByRole("button", { name: "Mehr & Einstellungen", exact: true }).click();
        await expect(page.getByText(/Originalsicherungen zur Wiederherstellung \(1\)/)).toBeVisible();
      }
      console.log(`PASS recovery browser ${kind}: severity, categories, private-value exclusion, exact original bytes and storage protection`);
    });
  });
}

for (const width of [1440, 1180, 1024, 768, 390]) {
  test.describe(`Vermögenshaus ${width}px`, () => {
    const fixture = modelPortfolioCase();
    fixture.plans[0].preferred = true;
    test.use({ viewport: { width, height: 1000 }, storageState: state(JSON.stringify([fixture])) });
    test("fünf vollständige Säulen, mittiges Dach, Fundament und Interaktion in vier Modi", async ({ page }) => {
      const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
      await page.goto("./"); await open(page, fixture.advisory.caseName);
      await nav(page, "Strukturplanung");
      await page.getByRole("button", { name: "Vermögensstruktur", exact: true }).click();
      const house = page.locator(".house-view"), scroll = house.locator(".house-frame");
      // Also cover a narrow embedded container on a wide viewport (not a media-query trigger).
      if (width === 1440) await house.locator(".house-layout").evaluate(e => { e.style.width = "680px"; e.style.maxWidth = "100%"; });
      for (const mode of ["IST", "PLAN", "ZIELPLAN", "VERGLEICH"]) {
        await house.getByRole("tab", { name: mode, exact: true }).click();
        for (const control of await house.locator(".house-mode-tabs button, .house-mode-tabs select").all()) {
          const box = await control.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
        }
        const measurement = await scroll.evaluate(el => {
          const rect = (e: Element) => { const r = e.getBoundingClientRect(); return { x: r.x, right: r.right, width: r.width }; };
          const whole = el.querySelector(".wealth-house")!;
          const pillars = [...el.querySelectorAll(".house-pillars > button")];
          const clippedText = pillars.flatMap(p => [...p.querySelectorAll("header span, header strong, footer, .pillar-delta > *")])
            .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent);
          return { region: rect(el), house: rect(whole), roof: rect(el.querySelector(".house-roof")!),
            foundation: rect(el.querySelector(".house-foundation")!), pillars: pillars.map(rect),
            names: pillars.map(e => e.getAttribute("aria-label")), client: el.clientWidth, scroll: el.scrollWidth, clippedText };
        });
        expect(measurement.names).toEqual(["Liquidität öffnen", "Geldwerte öffnen", "Substanzwerte öffnen", "Alternative Anlagen öffnen", "Sachwerte öffnen"]);
        const center = (r: { x: number; width: number }) => r.x + r.width / 2;
        expect(Math.abs(center(measurement.roof) - center(measurement.pillars[2]))).toBeLessThanOrEqual(1);
        expect(Math.abs(measurement.roof.width - measurement.foundation.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(measurement.roof.width - measurement.house.width)).toBeLessThanOrEqual(1);
        expect(Math.max(...measurement.pillars.map(p => p.width)) - Math.min(...measurement.pillars.map(p => p.width))).toBeLessThanOrEqual(1);
        expect(measurement.pillars[0].x).toBeGreaterThanOrEqual(measurement.house.x);
        expect(measurement.pillars[4].right).toBeLessThanOrEqual(measurement.house.right);
        expect(measurement.region.width).toBeLessThanOrEqual(width);
        expect(measurement.clippedText).toEqual([]);
        expect(measurement.scroll).toBeLessThanOrEqual(measurement.client + 1);
        expect(measurement.house.x).toBeGreaterThanOrEqual(measurement.region.x);
        expect(measurement.house.right).toBeLessThanOrEqual(measurement.region.right);
        for (const pillar of measurement.pillars) {
          expect(pillar.x).toBeGreaterThanOrEqual(measurement.region.x);
          expect(pillar.right).toBeLessThanOrEqual(measurement.region.right);
        }
        console.log(`HOUSE_GEOMETRY ${JSON.stringify({ viewport: width, mode, ...measurement })}`);
        for (const name of ["Liquidität", "Geldwerte", "Substanzwerte", "Alternative Anlagen", "Sachwerte"]) {
          const button = house.getByRole("button", { name: `${name} öffnen`, exact: true });
          await button.click();
          await expect(button).toHaveClass("active");
          await expect(house.locator(".house-detail")).toBeVisible();
          // Native click must reach each fully contained button without horizontal scrolling.
          const visible = await button.evaluate(el => {
            const r = el.getBoundingClientRect(), s = el.closest(".house-frame")!.getBoundingClientRect();
            return r.left >= s.left - 1 && r.right <= s.right + 1;
          });
          expect(visible).toBe(true);
        }
        await expect(house.locator(".house-roof strong")).toHaveText(new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(160000));
      }
      expect(errors).toEqual([]);
      console.log(`PASS house browser ${width}: five columns, centered roof/third pillar, aligned foundation, no clipped labels or values, all 20 mode/column interactions`);
    });
  });
}
