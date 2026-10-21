import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { controlCase, variants, needVariant, historyOwner, needBase, accepted as accepts } from "../../scripts/f021-fixtures";
import { RECOVERY_PREFIX, nav, raw, data, monitor, seed, open, save, current, excel, emit } from "./f021-driver";

function checkExcel(workbook: Awaited<ReturnType<typeof excel>>, date: string, months: number) {
  expect(workbook.sheets.Kapitalbedarfe.cells).toMatchObject({ B2: 10000, C2: date, E2: months, F2: Number(date.slice(0,4)) });
}

// Derived only from the synthetic F-021 scenarios in audit PR #43.
// A/B mutations change years alone, without fixing any calendar/plan binding.
for (const group of ["A", "B"] as const) for (const variant of variants) {
  test(`F021 ${group} ${variant.tag} – actual JSON import/Excel/reload`, async ({ page }, info) => {
    const errors = monitor(page), neighbor = controlCase("import-neighbor"), c = needVariant(group, variant), expected = accepts(group, variant);
    await seed(page, [neighbor]); await open(page, neighbor); await nav(page, "Ergebnis & Export");
    const activeBefore = await current(page, info, "active-before-import");
    const before = await raw(page), dialogs: string[] = [];
    page.on("dialog", async d => { dialogs.push(d.message()); await d.accept(); });
    const chooser = page.waitForEvent("filechooser"); await page.getByRole("button", { name: /Sicherung importieren|JSON importieren/ }).click();
    await (await chooser).setFiles({ name: `synthetic-${group}-${variant.tag}.json`, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(c)) });
    // File reading is asynchronous. Observe completion by accepted insertion or rejected dialog.
    await expect.poll(async () => dialogs.length > 0 || (await data(page)).some(x => x.id !== neighbor.id)).toBe(true);
    const after = await raw(page), entries = await data(page), accepted = entries.some(x => x.id !== neighbor.id);
    expect(accepted).toBe(expected);
    if (!expected) { expect(after).toBe(before); expect(await current(page, info, "rejected-active-case")).toEqual(activeBefore); }
    let outputs: unknown = null;
    if (accepted) {
      const imported = entries.find(x => x.id !== neighbor.id)!;
      const actual = await current(page, info, "f021-import-json"); const workbook = await excel(page, info, "f021-import-xlsx");
      expect(imported.id).not.toBe(c.id); expect(actual.plans).toEqual(c.plans); expect(actual.versions).toEqual(c.versions);
      checkExcel(workbook, variant.value === 0 ? "2026-10-15" : "2028-04-15", variant.value === 0 ? 0 : 18);
      await page.reload(); const afterReload = await raw(page); await open(page, imported);
      const reloaded = await current(page, info, "f021-import-reloaded");
      expect(afterReload).toBe(after); expect(reloaded.advisory.needs).toEqual(actual.advisory.needs);
      outputs = { actual, workbook, afterReload, reloaded };
    } else expect(after).toBe(before);
    expect(entries.find(x => x.id === neighbor.id)!.advisory).toEqual(neighbor.advisory);
    await emit(page, info, `f021-import-${group}-${variant.tag}`, { group, variant, input: c, before, after, accepted, dialogs, outputs, errors });
    expect(errors).toEqual([]);
  });

  test(`F021 ${group} ${variant.tag} – local reload/P1 protected originals and neighbor save`, async ({ page }, info) => {
    const errors = monitor(page), c = needVariant(group, variant), neighbor = controlCase("store-neighbor");
    await seed(page, [c, neighbor]); const before = (await raw(page))!;
    await nav(page, "Beratungsfälle"); const accessible = await page.getByRole("button", { name: c.advisory.caseName, exact: false }).count() === 1;
    expect(accessible).toBe(accepts(group, variant));
    const notice = await page.locator(".case-store-notice").allTextContents();
    let outputs: unknown = null;
    if (accessible) { await open(page, c); outputs = { actual: await current(page, info, "f021-store-json"), workbook: await excel(page, info, "f021-store-xlsx") }; }
    expect(await raw(page)).toBe(before);
    await open(page, neighbor); await save(page); const after = (await raw(page))!;
    const backups = await page.evaluate(prefix => Object.entries(localStorage).filter(([k]) => k.startsWith(prefix)), RECOVERY_PREFIX);
    if (!accessible) {
      expect(JSON.parse(after).find((x: {id:string}) => x.id === c.id)).toEqual(c); expect(backups).toHaveLength(1); expect(backups[0][1]).toBe(before);
      await save(page);
      expect(await page.evaluate(prefix => Object.entries(localStorage).filter(([k]) => k.startsWith(prefix)), RECOVERY_PREFIX)).toEqual(backups);
      expect(JSON.parse((await raw(page))!).find((x: {id:string}) => x.id === c.id)).toEqual(c);
    } else expect(backups).toEqual([]);
    expect((await data(page)).find(x => x.id === neighbor.id)!.advisory).toEqual(neighbor.advisory);
    await writeFile(info.outputPath("f021-store-original.json"), before);
    const finalRaw = await raw(page); await page.reload(); expect(await raw(page)).toBe(finalRaw);
    await emit(page, info, `f021-store-${group}-${variant.tag}`, { group, variant, input: c, accessible, notice, before, after, backups, outputs, errors });
    expect(errors).toEqual([]);
  });

  test(`F021 ${group} ${variant.tag} – real H3 snapshot restore`, async ({ page }, info) => {
    const errors = monitor(page), c = needVariant(group, variant), owner = historyOwner(c), neighbor = controlCase("history-neighbor");
    await seed(page, [owner, neighbor]); await open(page, owner); const original = await current(page, info, "f021-before-restore"); const before = await raw(page);
    const dialogs: string[] = []; page.on("dialog", async d => { dialogs.push(d.message()); await d.accept(); });
    await page.getByRole("article").filter({ hasText: "Synthetischer Laufzeitsnapshot" }).getByRole("button", { name: "Wiederherstellen", exact: true }).click();
    const after = await current(page, info, "f021-after-restore"), restored = after.advisory.needs.length > 0;
    expect(restored).toBe(accepts(group, variant));
    if (restored) expect(after.advisory.needs).toEqual(c.advisory.needs);
    expect(await page.evaluate(prefix => Object.entries(localStorage).filter(([k]) => k.startsWith(prefix)), RECOVERY_PREFIX)).toEqual([]);
    expect(await raw(page)).toBe(before); expect(after.id).toBe(owner.id); expect(after.versions).toEqual(owner.versions);
    if (!restored) expect(after).toEqual(original);
    await emit(page, info, `f021-restore-${group}-${variant.tag}`, { group, variant, input: c, before, original, after, restored, dialogs, errors });
    expect(errors).toEqual([]);
  });

  test(`F021 ${group} ${variant.tag} – separate H5b raw diagnosis`, async ({ page }, info) => {
    const errors = monitor(page), c = needVariant(group, variant), neighbor = controlCase("h5b-neighbor");
    await seed(page, [c, neighbor]); const before = await raw(page);
    await nav(page, "Historische Fälle prüfen"); await page.getByLabel("Quellfall", { exact: true }).selectOption(c.id);
    await page.getByLabel("Belegte historische Zeitzone", { exact: true }).selectOption("UTC");
    await page.getByRole("button", { name: "Quelle prüfen", exact: true }).click();
    const text = await page.locator(".h5b-view").innerText();
    const draftDisabled = await page.getByRole("button", { name: "Original sichern und Entwurf öffnen", exact: true }).isDisabled();
    if (!variant.valid) expect(draftDisabled).toBe(true);
    expect(await raw(page)).toBe(before);
    expect(await page.evaluate(prefix => Object.keys(localStorage).filter(k => k.startsWith(prefix)), RECOVERY_PREFIX)).toEqual([]);
    await emit(page, info, `f021-h5b-${group}-${variant.tag}`, { group, variant, text, draftDisabled, before, errors }); expect(errors).toEqual([]);
  });
}

for (const group of ["A", "B"] as const) test(`F021 ${group} explicit dueDate keeps priority across import, reload, Excel and restore`, async ({page},info)=>{
  const errors=monitor(page), c=needBase(group); c.advisory.needs[0].dueDate="2028-02-29";
  // An unused malformed duration was already accepted before F-021.
  Reflect.set(c.advisory.needs[0],"years","2");
  const neighbor=controlCase("explicit-neighbor"); await seed(page,[neighbor]); await open(page,neighbor); await nav(page,"Ergebnis & Export");
  const chooser=page.waitForEvent("filechooser"); await page.getByRole("button",{name:/JSON importieren/}).click();
  await (await chooser).setFiles({name:"synthetic-explicit-date.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(c))});
  await expect.poll(async()=>(await data(page)).length).toBe(2);
  const imported=(await data(page)).find(x=>x.id!==neighbor.id)!; const before=await raw(page);
  checkExcel(await excel(page,info,"explicit-import"),"2028-02-29",16);
  await page.reload(); expect(await raw(page)).toBe(before); await open(page,imported);
  expect((await current(page,info,"explicit-reload")).advisory.needs).toEqual(c.advisory.needs);
  const owner=historyOwner(c); await seed(page,[owner,neighbor]); await open(page,owner); await nav(page,"Ergebnis & Export"); const restoreBefore=await raw(page);
  page.on("dialog",async d=>d.accept());
  await page.getByRole("article").filter({hasText:"Synthetischer Laufzeitsnapshot"}).getByRole("button",{name:"Wiederherstellen",exact:true}).click();
  const restored=await current(page,info,"explicit-restored"); expect(restored.advisory.needs).toEqual(c.advisory.needs); expect(restored.versions).toEqual(owner.versions);
  expect(await raw(page)).toBe(restoreBefore); checkExcel(await excel(page,info,"explicit-restore"),"2028-02-29",16); expect(errors).toEqual([]);
  await emit(page,info,`explicit-${group}`,{imported,restored,before,restoreBefore,errors});
});
