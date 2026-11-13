import { test, expect } from "@playwright/test";
import { auditCase, needVariant, variants, riskCase } from "./audit-e2e-fixtures";
import { monitor, seed, open, nav, raw, data, current, excel, emit, saleFlow, riskFlow, chooseRisk, addProduct, save, productConflict } from "./audit-e2e-driver";

// Phase B: business invariants. Expected product failures MUST remain red.
// No xfail, skip, retries or timeout overrides; observation tests remain intact.
test("AUDIT B F020 – a regular save must never persist a sale above market value", async ({ page }, info) => {
  const measured = await saleFlow(page, info);
  const persisted = JSON.parse(measured.savedRaw).find((c: { id: string }) => c.id === "f020");
  for (const holding of persisted.depot) {
    expect(holding.plannedSale, `Persisted sale ${holding.plannedSale} must be <= market value ${holding.value}; either visible cap or refused save is valid`).toBeLessThanOrEqual(holding.value);
  }
});

for (const variant of variants) test(`AUDIT B F021 ${variant.tag} – relative duration trust boundary without annual binding`, async ({ page }, info) => {
  const errors = monitor(page), neighbor = auditCase("contract-neighbor"), c = needVariant("B", variant);
  await seed(page, [neighbor]); await open(page, neighbor); await nav(page, "Ergebnis & Export"); const before = await raw(page);
  const dialogs: string[] = []; page.on("dialog", async d => { dialogs.push(d.message()); await d.accept(); });
  const chooser = page.waitForEvent("filechooser"); await page.getByRole("button", { name: /JSON importieren/ }).click();
  await (await chooser).setFiles({ name: `synthetic-contract-${variant.tag}.json`, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(c)) });
  await expect.poll(async () => dialogs.length > 0 || (await data(page)).some(x => x.id !== neighbor.id)).toBe(true);
  const after = await raw(page), entries = await data(page), accepted = entries.some(x => x.id !== neighbor.id);
  const workbook = accepted ? await excel(page, info, "contract-needs") : null;
  await emit(page, info, `f021-contract-${variant.tag}`, { variant, input: c, before, after, accepted, dialogs, workbook, errors });
  expect(errors).toEqual([]);
  if (!variant.valid) {
    expect(accepted, "Typfalsche, negative oder fehlende relative Laufzeit muss vor Annahme zurückgewiesen werden").toBe(false);
    expect(after).toBe(before);
  } else {
    expect(accepted).toBe(true);
    expect(workbook!.sheets.Kapitalbedarfe.rows[0]).toMatchObject({ Termin: variant.value === 0 ? "2026-10-15" : "2028-04-15", Monate: variant.value === 0 ? 0 : 18 });
  }
});

for (const row of [
  { risk: 1, product: "UniOpti4", conflict: false },
  { risk: 2, product: "UniRak ESG Konservativ -net- A", conflict: false },
  { risk: 1, product: "UniRak ESG Konservativ -net- A", conflict: true },
  { risk: 1, product: "UniGlobal", conflict: true },
  { risk: 2, product: "UniRak ESG Konservativ -net- A", change: 1, conflict: true },
  { risk: 1, product: "UniRak ESG Konservativ -net- A", assessment: true, conflict: true },
  { risk: 1, product: "Private Select Sicherheit", conflict: true },
] as const) test(`AUDIT B F017 ${row.risk} / ${row.product} ${"assessment" in row ? "assessment" : "manual"} ${"change" in row ? "changed-risk" : ""} – visible product risk check`, async ({ page }, info) => {
  const result = await riskFlow(page, info, row.risk, row.product, "assessment" in row, "change" in row ? row.change : undefined);
  expect(result.usedRisk).toBe("change" in row ? row.change : row.risk);
  expect(result.riskSource).toBe("assessment" in row ? "assessment" : "manual");
  expect(result.productWarning, "Risiko-V2 Abschnitt 18 verlangt eine sichtbare Produkt-RK/Kunden-RK-Prüfung; keine technische Kaufsperre gefordert").toBe(row.conflict);
});

test("AUDIT B F017 – independent product risk checks in two long-horizon pots", async ({ page }, info) => {
  const errors = monitor(page), c = riskCase(); await seed(page, [c]); await open(page, c); await chooseRisk(page, 1);
  const strategic = await addProduct(page, "UniRak ESG Konservativ -net- A");
  await page.locator(".capital-timeline").getByRole("button").filter({ has: page.getByText("2041", { exact: true }) }).click();
  const annual = await addProduct(page, "UniRak ESG Konservativ -net- A");
  const planner = await page.locator(".capital-pot-workspace").innerText(); await save(page);
  const item = await current(page, info, "f017-two-pots-json"), workbook = await excel(page, info, "f017-two-pots-xlsx");
  await emit(page, info, "f017-two-pots", { strategic, annual, planner, item, workbook, errors });
  expect(errors).toEqual([]); expect(item.plans[0].allocations).toHaveLength(2);
  expect(productConflict(planner), "RK conflict must be visible independently of either long minimum horizon").toBe(true);
});
