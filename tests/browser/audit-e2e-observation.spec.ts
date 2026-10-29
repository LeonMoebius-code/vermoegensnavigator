import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { auditCase, saleCase, variants, needVariant, historyOwner, replacementCsv } from "./audit-e2e-fixtures";
import { KEY, RECOVERY_PREFIX, nav, raw, data, monitor, seed, open, save, input, current, excel, emit, saleFlow, riskFlow } from "./audit-e2e-driver";

// Phase A: observe actual application behavior. These tests never declare a finding resolved.
test("AUDIT A F020 – full UI/Excel/save/raw/reload/resave chain", async ({ page }, info) => {
  await saleFlow(page, info);
});

test("AUDIT A F020 – healthy saves, direct cap and CSV replacement with two depots", async ({ page }, info) => {
  const errors = monitor(page), c = saleCase(), neighbor = auditCase("sale-neighbor");
  await seed(page, [c, neighbor]); await open(page, c); await nav(page, "Depotcheck");
  await input(page, "Geplanter Verkauf AUDIT Depot A: AUDIT Position A", 2000); await save(page);
  const healthy = await data(page); expect(healthy.find(x => x.id === c.id)!.depot[0].plannedSale).toBe(2000);
  await page.reload(); await open(page, c); const reopened = await current(page, info, "f020-healthy");
  expect(reopened.depot[0].plannedSale).toBe(2000);
  await nav(page, "Depotcheck"); await input(page, "Geplanter Verkauf AUDIT Depot A: AUDIT Position A", 20000);
  expect(await page.getByLabel("Geplanter Verkauf AUDIT Depot A: AUDIT Position A").inputValue()).toBe("10.000");
  await input(page, "Geplanter Verkauf AUDIT Depot A: AUDIT Position A", 8000);
  const target = page.getByRole("article").filter({ has: page.getByRole("textbox", { name: "Depotname", exact: true }).and(page.locator('input[value="AUDIT Depot A"]')) });
  const chooser = page.waitForEvent("filechooser"); await target.getByRole("button", { name: "CSV ersetzen", exact: true }).click();
  await (await chooser).setFiles({ name: "synthetic-a-replacement.csv", mimeType: "text/csv", buffer: Buffer.from(replacementCsv()) });
  await page.locator(".csv-preview").getByRole("button", { name: "Bestehendes Depot ersetzen", exact: true }).click();
  await save(page); const after = await data(page), item = after.find(x => x.id === c.id)!;
  expect(item.depot.find(h => h.name === "AUDIT Position A")).toMatchObject({ value: 5000, plannedSale: 5000 });
  expect(item.depot.find(h => h.depotId === "audit-depot-B")).toEqual(c.depot[1]);
  expect(after.find(x => x.id === neighbor.id)!.advisory).toEqual(neighbor.advisory);
  await emit(page, info, "f020-controls", { healthy, reopened, after, errors }); expect(errors).toEqual([]);
});

for (const group of ["A", "B"] as const) for (const variant of variants) {
  test(`AUDIT A F021 ${group} ${variant.tag} – actual JSON import/Excel/reload`, async ({ page }, info) => {
    const errors = monitor(page), neighbor = auditCase("import-neighbor"), c = needVariant(group, variant);
    await seed(page, [neighbor]); await open(page, neighbor); await nav(page, "Ergebnis & Export");
    const before = await raw(page), dialogs: string[] = [];
    page.on("dialog", async d => { dialogs.push(d.message()); await d.accept(); });
    const chooser = page.waitForEvent("filechooser"); await page.getByRole("button", { name: /Sicherung importieren|JSON importieren/ }).click();
    await (await chooser).setFiles({ name: `synthetic-${group}-${variant.tag}.json`, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(c)) });
    // File reading is asynchronous. Observe completion by accepted insertion or rejected dialog.
    await expect.poll(async () => dialogs.length > 0 || (await data(page)).some(x => x.id !== neighbor.id)).toBe(true);
    const after = await raw(page), entries = await data(page), accepted = entries.some(x => x.id !== neighbor.id);
    let outputs: unknown = null;
    if (accepted) {
      const imported = entries.find(x => x.id !== neighbor.id)!;
      const actual = await current(page, info, "f021-import-json"); const workbook = await excel(page, info, "f021-import-xlsx");
      await page.reload(); const afterReload = await raw(page); await open(page, imported);
      const reloaded = await current(page, info, "f021-import-reloaded");
      outputs = { actual, workbook, afterReload, reloaded };
    } else expect(after).toBe(before);
    expect(entries.find(x => x.id === neighbor.id)!.advisory).toEqual(neighbor.advisory);
    await emit(page, info, `f021-import-${group}-${variant.tag}`, { group, variant, input: c, before, after, accepted, dialogs, outputs, errors });
    expect(errors).toEqual([]);
  });

  test(`AUDIT A F021 ${group} ${variant.tag} – local reload/P1 protected originals and neighbor save`, async ({ page }, info) => {
    const errors = monitor(page), c = needVariant(group, variant), neighbor = auditCase("store-neighbor");
    await seed(page, [c, neighbor]); const before = (await raw(page))!;
    await nav(page, "Beratungsfälle"); const accessible = await page.getByRole("button", { name: c.advisory.caseName, exact: false }).count() === 1;
    const notice = await page.locator(".case-store-notice").allTextContents();
    let outputs: unknown = null;
    if (accessible) { await open(page, c); outputs = { actual: await current(page, info, "f021-store-json"), workbook: await excel(page, info, "f021-store-xlsx") }; }
    expect(await raw(page)).toBe(before);
    await open(page, neighbor); await save(page); const after = (await raw(page))!;
    const backups = await page.evaluate(prefix => Object.entries(localStorage).filter(([k]) => k.startsWith(prefix)), RECOVERY_PREFIX);
    if (!accessible) { expect(JSON.parse(after).find((x: {id:string}) => x.id === c.id)).toEqual(c); expect(backups.map(([,v]) => v)).toContain(before); }
    expect((await data(page)).find(x => x.id === neighbor.id)!.advisory).toEqual(neighbor.advisory);
    await writeFile(info.outputPath("f021-store-original.json"), before);
    await page.reload(); expect(await raw(page)).toBe(after);
    await emit(page, info, `f021-store-${group}-${variant.tag}`, { group, variant, input: c, accessible, notice, before, after, backups, outputs, errors });
    expect(errors).toEqual([]);
  });

  test(`AUDIT A F021 ${group} ${variant.tag} – real H3 snapshot restore`, async ({ page }, info) => {
    const errors = monitor(page), c = needVariant(group, variant), owner = historyOwner(c), neighbor = auditCase("history-neighbor");
    await seed(page, [owner, neighbor]); await open(page, owner); const original = await current(page, info, "f021-before-restore"); const before = await raw(page);
    const dialogs: string[] = []; page.on("dialog", async d => { dialogs.push(d.message()); await d.accept(); });
    await page.getByRole("article").filter({ hasText: "AUDIT Laufzeitsnapshot" }).getByRole("button", { name: "Wiederherstellen", exact: true }).click();
    const after = await current(page, info, "f021-after-restore"), restored = after.advisory.needs.length > 0;
    expect(await raw(page)).toBe(before); expect(after.id).toBe(owner.id); expect(after.versions).toEqual(owner.versions);
    if (!restored) expect(after).toEqual(original);
    await emit(page, info, `f021-restore-${group}-${variant.tag}`, { group, variant, input: c, before, original, after, restored, dialogs, errors });
    expect(errors).toEqual([]);
  });

  test(`AUDIT A F021 ${group} ${variant.tag} – separate H5b raw diagnosis`, async ({ page }, info) => {
    const errors = monitor(page), c = needVariant(group, variant), neighbor = auditCase("h5b-neighbor");
    await seed(page, [c, neighbor]); const before = await raw(page);
    await nav(page, "Historische Fälle prüfen"); await page.getByLabel("Quellfall", { exact: true }).selectOption(c.id);
    await page.getByLabel("Belegte historische Zeitzone", { exact: true }).selectOption("UTC");
    await page.getByRole("button", { name: "Quelle prüfen", exact: true }).click();
    const text = await page.locator(".h5b-view").innerText();
    const draftDisabled = await page.getByRole("button", { name: "Original sichern und Entwurf öffnen", exact: true }).isDisabled();
    expect(await raw(page)).toBe(before);
    expect(await page.evaluate(prefix => Object.keys(localStorage).filter(k => k.startsWith(prefix)), RECOVERY_PREFIX)).toEqual([]);
    await emit(page, info, `f021-h5b-${group}-${variant.tag}`, { group, variant, text, draftDisabled, before, errors }); expect(errors).toEqual([]);
  });
}

for (const row of [
  { risk: 1, product: "UniOpti4" },
  { risk: 2, product: "UniRak ESG Konservativ -net- A" },
  { risk: 1, product: "UniRak ESG Konservativ -net- A" },
  { risk: 1, product: "UniGlobal" },
  { risk: 2, product: "UniRak ESG Konservativ -net- A", change: 1 },
  { risk: 1, product: "UniRak ESG Konservativ -net- A", assessment: true },
  { risk: 1, product: "Private Select Sicherheit" },
] as const) test(`AUDIT A F017 customer ${row.risk} / ${row.product} ${"assessment" in row ? "assessment" : "manual"} ${"change" in row ? "risk-change" : ""}`, async ({ page }, info) => {
  await riskFlow(page, info, row.risk, row.product, "assessment" in row, "change" in row ? row.change : undefined);
});
