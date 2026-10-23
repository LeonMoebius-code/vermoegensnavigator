import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import * as XLSX from "xlsx";
import { normalizeImportedCase } from "../../app/case-model";
import { controlCase } from "../../scripts/f021-fixtures";
import { outputCase } from "./fixtures";
import { seed, open, nav, raw, current, monitor, sha } from "./f021-driver";

// Independent inventory: also checks that later/conditional fixed sheets retain their names.
const fixed = ["Fall", "Kapitalbedarfe", "Kapitaltöpfe", "Investitionspläne", "Vermögensstruktur",
  "Depotübersicht", "Depot", "VV-Auswahl", "Datenstände", "Fachmodule", "Kunden-Checkliste", "Produktrisikoprüfung"];
const long = "A".repeat(31);
const scenarios = [
  { tag: "standard", names: ["Plan A – Ausgangsstruktur", "Plan B"], sheets: ["Plan-A-Ausgangsstruktur", "Plan-B"] },
  { tag: "Fall", names: ["Fall"], sheets: ["Fall_2"] },
  { tag: "all-fixed", names: [...fixed, "Zins & Laufzeiten", "Technische Nachweise"],
    sheets: [...fixed.map(n => `${n}_2`), "Zins-Laufzeiten", "Technische-Nachweise"] },
  { tag: "duplicates-case-suffix", names: ["Variante", "Variante", "variante", "VARIANTE_2", "Variante"],
    sheets: ["Variante", "Variante_2", "variante_3", "VARIANTE_2_2", "Variante_4"] },
  { tag: "sanitization", names: ["Depot/Neu", "Depot:Neu", "Depot?Neu", " Depot Neu "],
    sheets: ["Depot-Neu", "Depot-Neu_2", "Depot-Neu_3", "Depot-Neu_4"] },
  { tag: "31-characters", names: [long + "1", long + "2", "A".repeat(29) + "_2", long.toLowerCase() + "3"],
    sheets: [long, "A".repeat(29) + "_2", "A".repeat(29) + "_3", "a".repeat(29) + "_4"] },
  { tag: "empty-and-preoccupied-suffix", names: [" ", "  ", "Plan", "Fall_2", "Fall", "fall"],
    sheets: ["Plan", "Plan_2", "Plan_3", "Fall_2", "Fall_3", "fall_4"] },
  { tag: "two-digit-suffix", names: Array(12).fill(long),
    sheets: [long, ...Array.from({ length: 11 }, (_, i) => "A".repeat(31 - `_${i + 2}`.length) + `_${i + 2}`)] },
];

for (const scenario of scenarios) test(`F007 actual XLSX download: ${scenario.tag}`, async ({ page }, info) => {
  const errors = monitor(page), c = controlCase(`f007-${scenario.tag}`), template = c.plans[0];
  c.plans = scenario.names.map((name, i) => ({ ...structuredClone(template), id: `f007-plan-${i}`, name, preferred: i === 0,
    allocations: [0, 1].map(j => ({ id: `f007-allocation-${i}-${j}`, productId: "unifavorit-renten",
      productName: `SYNTHETISCH Plan ${i} Position ${j}`, source: "product" as const, solutionId: "mixed",
      amount: 1000 * (i + 1) + j, bucketId: "year10plus" as const,
      capitalPotId: "strategic", capitalPotAmounts: { strategic: 1000 * (i + 1) + j }, allocationMode: "single" as const })),
  }));
  c.activePlanId = c.plans.at(-1)!.id; // Export preference and active plan deliberately differ.
  expect(normalizeImportedCase(c, false)).not.toBeNull();
  await seed(page, [c]); await open(page, c);
  const before = await current(page, info, "f007-before"); const originalStore = await raw(page);
  expect(before.plans.map(p => p.name)).toEqual(scenario.names);
  await nav(page, "Ergebnis & Export");
  const downloads: string[][] = [];
  for (let repeat = 0; repeat < 2; repeat++) {
    const event = page.waitForEvent("download");
    await page.getByRole("button", { name: /Excel-Arbeitsmappe/ }).click();
    const d = await event; expect(await d.failure()).toBeNull();
    const path = info.outputPath(`f007-${repeat}.xlsx`); await d.saveAs(path);
    const bytes = await readFile(path), wb = XLSX.read(bytes, { type: "buffer" });
    const expectedNames = [...fixed.slice(0, 3), ...scenario.sheets, ...fixed.slice(3)];
    expect(wb.SheetNames).toEqual(expectedNames);
    expect(new Set(wb.SheetNames.map(n => n.toLowerCase())).size).toBe(wb.SheetNames.length);
    for (const name of wb.SheetNames) {
      expect(name.length).toBeGreaterThan(0); expect(name.length).toBeLessThanOrEqual(31);
      expect(name).not.toMatch(/[\\/?*\[\]:]/);
    }
    expect(wb.Sheets.Fall.B2.v).toBe(c.advisory.caseName);
    expect(wb.Sheets.Fall.B16.v).toBe(scenario.names[0]);
    for (const [i, name] of scenario.sheets.entries()) {
      // Exact full row equality proves no overwritten, omitted or cross-assigned plan content.
      expect(XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" })).toEqual(c.plans[i].allocations.map(a => ({
        Produkt: a.productName, Produkt_ID: a.productId, Laufzeitband: "Strategisches Kapital",
        Topfabdeckung: `Strategisch verfügbares Kapital: ${a.amount}`, Betrag: a.amount, Quelle: a.source, Modell: "",
      })));
    }
    downloads.push(wb.SheetNames);
    console.log(`F007_DOWNLOAD ${JSON.stringify({ test: info.title, repeat, sha256: sha(bytes),
      mapping: c.plans.map((p, i) => ({ planId: p.id, planName: p.name, sheet: scenario.sheets[i] })),
      gzipBase64: gzipSync(bytes).toString("base64") })}`);
  }
  expect(downloads[1]).toEqual(downloads[0]);
  expect(await current(page, info, "f007-after")).toEqual(before);
  expect(await raw(page)).toBe(originalStore); expect(errors).toEqual([]);
});

test("F007 unchanged standard export including conditional bond sheets", async ({ page }, info) => {
  const c = outputCase(), errors = monitor(page); c.plans[0].name = "Plan A – Ausgangsstruktur";
  await seed(page, [c]); await open(page, c); const before = await current(page, info, "f007-bond-before");
  const original = await raw(page), event = page.waitForEvent("download");
  await page.getByRole("button", { name: /Excel-Arbeitsmappe/ }).click(); const d = await event;
  expect(await d.failure()).toBeNull(); const path = info.outputPath("f007-standard-bond.xlsx"); await d.saveAs(path);
  const bytes = await readFile(path), wb = XLSX.read(bytes, { type: "buffer" });
  expect(wb.SheetNames).toEqual([...fixed.slice(0, 3), "Plan-A-Ausgangsstruktur", ...fixed.slice(3, 7),
    "Zins & Laufzeiten", "Technische Nachweise", ...fixed.slice(7)]);
  expect(XLSX.utils.sheet_to_json(wb.Sheets.Depot)).toHaveLength(1);
  expect(wb.Sheets["Zins & Laufzeiten"]["!ref"]).toBeTruthy();
  expect(wb.Sheets["Technische Nachweise"]["!ref"]).toBeTruthy();
  expect(await current(page, info, "f007-bond-after")).toEqual(before);
  expect(await raw(page)).toBe(original); expect(errors).toEqual([]);
  console.log(`F007_DOWNLOAD ${JSON.stringify({ test: info.title, sha256: sha(bytes), gzipBase64: gzipSync(bytes).toString("base64") })}`);
});
