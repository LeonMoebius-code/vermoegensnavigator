import { test, expect, type Page } from "@playwright/test";
import { emptyProductAnswers, nextProductAnswers, nextProductSelection, preferenceMatches, products } from "../../app/presentation/retirement/product-finder-data";

const productNames = {
  basis: "UniVorsorge Basis",
  "ruv-standard": "R+V-AltersvorsorgeDepot standard",
  pro: "UniVorsorge Pro",
  "ruv-individuell": "R+V-AltersvorsorgeDepot individuell",
  garantie: "UniVorsorge Garantie",
  "ruv-garantie-80": "R+V-AltersvorsorgeGarantie 80",
} as const;

type ProductId = keyof typeof productNames;
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const card = (page: Page, id: ProductId) => page.getByTestId(`product-${id}`);
const select = (page: Page, id: ProductId) => card(page, id).getByRole("checkbox");
const currentQuestion = (page: Page) => page.locator(".retirement-product-question");
const comparison = (page: Page) => page.getByRole("region", { name: "Qualitative Detailgegenüberstellung" });
const row = (page: Page, title: string) => comparison(page).locator(".retirement-product-row")
  .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
const cell = (page: Page, title: string, product: ProductId) => row(page, title).locator("dl > div")
  .filter({ has: page.getByText(productNames[product], { exact: true }) }).locator("dd");

async function openFinder(page: Page) {
  await page.goto("./");
  await page.locator(".sidebar nav").getByRole("button", { name: "Altersvorsorge" }).click();
  await button(page, "Neue Altersvorsorge planen").click();
  await button(page, "A3 Produktvergleich").click();
}

async function showCards(page: Page) {
  await button(page, "Weiter").click();
  await button(page, "Weiter").click();
  await button(page, "Produkte anzeigen").click();
}

test("AP03B-01/09/10/12/17/18: six source-dated products, separate bank status, no preselection or private tariff data", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => {
    if (!request.url().startsWith("http://127.0.0.1:4173/")) requests.push(request.url());
  });
  await openFinder(page);
  await showCards(page);
  const grid = page.locator(".retirement-product-grid");
  await expect(grid.getByRole("heading")).toHaveText(Object.values(productNames));
  await expect(grid.getByText("Union Investment", { exact: true })).toHaveCount(3);
  await expect(grid.getByText("R+V", { exact: true })).toHaveCount(3);
  await expect(grid.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await expect(button(page, "Direktvergleich öffnen")).toBeDisabled();

  for (const id of Object.keys(productNames) as ProductId[]) {
    const product = card(page, id);
    await expect(product.getByText("Öffentlich angekündigt", { exact: true })).toBeVisible();
    await expect(product.getByText("Unbestätigt", { exact: true })).toBeVisible();
    await expect(product.getByText("Arbeitswert vorhanden, für öffentliche Anzeige nicht freigegeben.")).toBeVisible();
    await product.getByText(`Tarifdetails und Quellen zu ${productNames[id]}`, { exact: true }).click();
    await expect(product.locator("time")).toBeVisible();
    await expect(product.locator("time")).toHaveAttribute("datetime", "2026-11-19");
    await expect(product.getByRole("link")).toHaveCount(3);
    const domain = id.startsWith("ruv-") ? /https:\/\/www\.ruv\.de\// : /https:\/\/www\.union-investment\.de\//;
    for (const link of await product.getByRole("link").all()) await expect(link).toHaveAttribute("href", domain);
  }
  await expect(card(page, "ruv-standard")).toContainText("zwei vorgegebenen ETFs");
  await expect(card(page, "ruv-standard")).toContainText("Startgewichte ist noch zu prüfen");
  await expect(card(page, "ruv-individuell")).toContainText("elf angekündigten ETFs");
  await expect(card(page, "ruv-individuell")).toContainText("zwei Komfortportfolios");
  await expect(card(page, "ruv-individuell")).toContainText("ISINs, TER und Gewichte bleiben offen");
  await expect(card(page, "ruv-garantie-80")).toContainText("Sicherungsvermögen");
  await expect(card(page, "ruv-garantie-80")).toContainText("ETF-Teil");
  await expect(grid).not.toContainText(/\bTarifkennung\s*[:–-]\s*[A-Z]{2,5}\b|\b[A-Z]{2}[A-Z0-9]{10}\b|\b0\s*%\s*(?:Effektivkosten|Kosten)/);
  await expect(grid.getByRole("combobox")).toHaveCount(0);
  await expect(grid.getByRole("spinbutton")).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("AP03B-02/16: one accessible question at a time, keyboard, back and correction", async ({ page }) => {
  await openFinder(page);
  const question = currentQuestion(page);
  const heading = question.getByRole("heading");
  await expect(question.getByRole("group", { name: /Welcher Schutz/ })).toBeVisible();
  await expect(question.getByRole("radio", { checked: true })).toHaveCount(0);
  await question.getByRole("radio", { name: /Mindestens 80/ }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await expect(button(page, "Weiter")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(heading).toHaveText("Vorgefertigtes Modell oder eigene ETF-Auswahl?");
  await expect(heading).toBeFocused();
  await expect(question.getByRole("group")).toHaveCount(1);
  await question.getByRole("radio", { name: "Unklar / keine Präferenz" }).check();

  await button(page, "Zurück").click();
  await expect(heading).toBeFocused();
  await expect(question.getByRole("radio", { name: /Mindestens 80/ })).toBeChecked();
  await question.getByRole("radio", { name: "100 % der Beiträge und Zulagen" }).check();
  await button(page, "Weiter").click();
  await expect(question.getByRole("radio", { name: "Unklar / keine Präferenz" })).toBeChecked();
  await button(page, "Weiter").click();
  await expect(question.getByRole("group", { name: /Lebenslange Rente, Fondsauszahlplan/ })).toBeVisible();
  await expect(question.getByRole("heading")).toHaveCount(1);
  await question.getByRole("radio", { name: "Beide Auszahlungsarten prüfen" }).check();
  await button(page, "Produkte anzeigen").click();
  await expect(page.getByRole("heading", { name: "Sechs Produktalternativen" })).toBeFocused();
  await expect(page.locator(".retirement-product-answers dd")).toHaveText([
    "100 % der Beiträge und Zulagen", "Unklar / keine Präferenz", "Beide Auszahlungsarten prüfen",
  ]);
  await button(page, "Orientierung ändern").click();
  await expect(question.getByRole("radio", { name: "100 % der Beiträge und Zulagen" })).toBeChecked();
  await showCards(page);
  await expect(page.locator(".retirement-product-answers dd").last()).toHaveText("Beide Auszahlungsarten prüfen");
});

test("AP03B-03/04/05/06/07/08/11: explicit feature statuses, two then three columns, fourth refused", async ({ page }) => {
  await openFinder(page);
  await page.getByRole("radio", { name: /Mindestens 80/ }).check();
  await button(page, "Weiter").click();
  await page.getByRole("radio", { name: /Eigene Auswahl/ }).check();
  await button(page, "Weiter").click();
  await page.getByRole("radio", { name: "Beide Auszahlungsarten prüfen" }).check();
  await button(page, "Produkte anzeigen").click();

  await expect(card(page, "pro")).toContainText("80-%-Wertsicherungsziel ohne Beitragsgarantie");
  await expect(card(page, "pro")).toContainText("80 % des Kapitals zu Beginn der Stabilisierungsphase");
  await expect(card(page, "garantie")).toContainText("100 % der eingezahlten Beiträge und Zulagen");
  await expect(card(page, "ruv-garantie-80")).toContainText("80 % der eingezahlten Beiträge und Zulagen");
  await expect(card(page, "ruv-garantie-80")).toContainText("Stichtag: Beginn der Auszahlphase");
  await expect(card(page, "ruv-garantie-80")).toContainText("jederzeitiger 80-%-Depotboden ist nicht zugesagt");

  await select(page, "pro").check();
  await expect(button(page, "Direktvergleich öffnen")).toBeDisabled();
  await select(page, "ruv-individuell").check();
  await button(page, "Direktvergleich öffnen").click();
  const headings = () => comparison(page).getByRole("list", { name: "Gewählte Alternativen" }).locator("strong");
  await expect(headings()).toHaveText([productNames.pro, productNames["ruv-individuell"]]);
  await expect(cell(page, "Abgleich mit Ihren Wünschen", "pro")).toContainText("Schutz: Nicht vorgesehen");
  await expect(cell(page, "Abgleich mit Ihren Wünschen", "pro")).toContainText("Auszahlung: Nicht vorgesehen");
  await expect(cell(page, "Abgleich mit Ihren Wünschen", "ruv-individuell")).toContainText("Anlageentscheidung: Erfüllt");
  await expect(cell(page, "Abgleich mit Ihren Wünschen", "ruv-individuell")).toContainText("Auszahlung: Nicht belegt / noch zu prüfen");
  await expect(cell(page, "Auszahlungsarten", "pro")).toContainText("Lebenslange Rente: Nicht vorgesehen");
  await expect(cell(page, "Auszahlungsarten", "ruv-individuell")).toContainText("Auszahlplan: Öffentlich belegt");

  await button(page, "Zurück zu den Produktkarten").click();
  await select(page, "ruv-garantie-80").check();
  await select(page, "basis").focus();
  await page.keyboard.press("Space");
  await expect(select(page, "basis")).toBeFocused();
  await expect(select(page, "basis")).not.toBeChecked();
  const status = page.getByRole("status").filter({ hasText: "von höchstens" });
  await expect(status).toContainText("UniVorsorge Basis wurde nicht ausgewählt");
  await expect(status).toHaveAttribute("aria-atomic", "true");
  await expect(select(page, "basis")).toHaveAttribute("aria-describedby", await status.getAttribute("id") ?? "");
  await button(page, "Direktvergleich öffnen").click();
  await expect(headings()).toHaveText([productNames.pro, productNames["ruv-individuell"], productNames["ruv-garantie-80"]]);
  await expect(cell(page, "Abgleich mit Ihren Wünschen", "ruv-garantie-80")).toContainText("Schutz: Erfüllt");
  await expect(cell(page, "Anlage und ETF-Auswahl", "ruv-garantie-80")).toContainText("Teilweise / tarifabhängig");
  await expect(cell(page, "Tarifgrenzen", "ruv-garantie-80")).toContainText("Tarifzugang sind offen");
  await comparison(page).getByRole("button", { name: "UniVorsorge Pro abwählen" }).click();
  await expect(comparison(page).getByRole("heading", { level: 2 })).toBeFocused();
  await expect(headings()).toHaveCount(2);
  await comparison(page).getByRole("button", { name: "R+V-AltersvorsorgeGarantie 80 abwählen" }).click();
  await expect(row(page, "Schutz zum Ablauf")).toHaveCount(0);
  await expect(status).toContainText("1 von höchstens 3");
  await button(page, "Zurück zu den Produktkarten").click();
  await expect(select(page, "ruv-individuell")).toBeChecked();
  await expect(select(page, "ruv-garantie-80")).not.toBeChecked();
  await select(page, "basis").check();
  await expect(button(page, "Direktvergleich öffnen")).toBeEnabled();

  await select(page, "ruv-garantie-80").check();
  await button(page, "Orientierung ändern").click();
  await page.getByRole("radio", { name: "100 % der Beiträge und Zulagen" }).check();
  await button(page, "Weiter").click();
  await page.getByRole("radio", { name: "Vorgefertigtes Modell" }).check();
  await button(page, "Weiter").click();
  await page.getByRole("radio", { name: "Fondsauszahlplan", exact: true }).check();
  await button(page, "Produkte anzeigen").click();
  await expect(page.locator(".retirement-product-grid").getByRole("heading")).toHaveText(Object.values(productNames));
  await button(page, "Direktvergleich öffnen").click();
  await expect(cell(page, "Abgleich mit Ihren Wünschen", "ruv-garantie-80")).toContainText("Schutz: Nicht vorgesehen");
  await expect(cell(page, "Abgleich mit Ihren Wünschen", "ruv-garantie-80")).toContainText("Anlageentscheidung: Nicht belegt / noch zu prüfen");
  await expect(cell(page, "Abgleich mit Ihren Wünschen", "basis")).toContainText("Auszahlung: Erfüllt");
});

for (const [label, width, columns] of [
  ["375 px", 375, 1], ["768 px", 768, 1], ["1280 px", 1280, 3], ["1280 px at 200% layout width", 640, 1],
] as const) {
  test(`AP03B-15: ${label} cards and responsive comparison`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await openFinder(page);
    await showCards(page);
    await select(page, "ruv-standard").check();
    await select(page, "pro").check();
    await select(page, "ruv-garantie-80").check();
    const documentFits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(await documentFits()).toBe(true);
    await button(page, "Direktvergleich öffnen").click();
    const protection = row(page, "Schutz zum Ablauf");
    await expect(protection.locator("dt")).toHaveText([productNames["ruv-standard"], productNames.pro, productNames["ruv-garantie-80"]]);
    const measuredColumns = await protection.locator("dl").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length);
    expect(measuredColumns).toBe(columns);
    if (columns === 1) {
      for (const name of await protection.locator("dt").all()) {
        expect((await name.boundingBox())?.height).toBeGreaterThan(10);
      }
    }
    expect(await documentFits()).toBe(true);
  });
}

test("AP03B-19: A/B switch keeps the ephemeral A3 draft, discard clears it without storage", async ({ page }) => {
  await openFinder(page);
  const storage = () => page.evaluate(async () => ({
    local: Object.entries(localStorage), session: Object.entries(sessionStorage), databases: await indexedDB.databases(),
  }));
  const before = await storage();
  await page.getByRole("radio", { name: /Mindestens 80/ }).check();
  await showCards(page);
  await select(page, "ruv-standard").check();
  await button(page, "A/B-Auswahl").click();
  await button(page, "B – Bestehende Riester-Rente prüfen").click();
  await expect(page.getByRole("heading", { name: "B1 – Bestandsaufnahme" })).toBeVisible();
  await button(page, "A/B-Auswahl").click();
  await button(page, "Neue Altersvorsorge planen").click();
  await button(page, "A3 Produktvergleich").click();
  await expect(select(page, "ruv-standard")).toBeChecked();
  expect(await storage()).toEqual(before);
  page.once("dialog", dialog => dialog.dismiss());
  await button(page, "Spezialentwurf neu starten").click();
  await expect(select(page, "ruv-standard")).toBeChecked();
  page.once("dialog", dialog => dialog.accept());
  await button(page, "Spezialentwurf neu starten").click();
  await button(page, "Neue Altersvorsorge planen").click();
  await button(page, "A3 Produktvergleich").click();
  await expect(currentQuestion(page).getByRole("radio", { checked: true })).toHaveCount(0);
  await showCards(page);
  await expect(page.locator(".retirement-product-grid").getByRole("checkbox", { checked: true })).toHaveCount(0);
  expect(await storage()).toEqual(before);
});

const unionIds = ["basis", "pro", "garantie"] as const;
const ruvIds = ["ruv-standard", "ruv-individuell", "ruv-garantie-80"] as const;

for (const [preference, heading, status] of [
  ["Lebenslange Rente", "F01/F02/F03", "Nicht vorgesehen"],
  ["Fondsauszahlplan", "F04", "Erfüllt"],
  ["Beide Auszahlungsarten prüfen", "F05", "Nicht vorgesehen"],
] as const) {
  test(`R85-N1-${heading}: Union payout matches ${preference} with product-specific evidence`, async ({ page }) => {
    await openFinder(page);
    await button(page, "Weiter").click();
    await button(page, "Weiter").click();
    await page.getByRole("radio", { name: preference, exact: true }).check();
    await button(page, "Produkte anzeigen").click();
    for (const id of unionIds) {
      await expect(card(page, id)).toContainText("Lebenslange Rente: Nicht vorgesehen");
      await select(page, id).check();
    }
    await button(page, "Direktvergleich öffnen").click();
    for (const id of unionIds) {
      const payouts = cell(page, "Auszahlungsarten", id);
      await expect(payouts).toContainText("Lebenslange Rente: Nicht vorgesehen");
      await expect(payouts).toContainText("Fondsauszahlplan: Öffentlich belegt");
      await expect(payouts).toContainText("auch keine Übertragung an einen Versicherer zum Beginn der Auszahlphase");
      await expect(payouts.getByRole("link")).toHaveAttribute("href", /wie-funktioniert-die-auszahlung-aus-dem-altersvorsorgedepot$/);
      const match = cell(page, "Abgleich mit Ihren Wünschen", id);
      await expect(match).toContainText(`Auszahlung: ${status}`);
      if (heading === "F05") await expect(match).toContainText("Die Kombination fehlt. Union bietet hier einen Fondsauszahlplan an.");
    }
  });
}

for (const [preference, status] of [
  ["Lebenslange Rente", "Erfüllt"],
  ["Fondsauszahlplan", "Nicht belegt / noch zu prüfen"],
] as const) {
  test(`R85-N1-F06/F07/F08: R+V payout evidence and match for ${preference}`, async ({ page }) => {
    await openFinder(page);
    await button(page, "Weiter").click();
    await button(page, "Weiter").click();
    await page.getByRole("radio", { name: preference, exact: true }).check();
    await button(page, "Produkte anzeigen").click();
    for (const id of ruvIds) {
      await expect(card(page, id)).toContainText("Lebenslange Rente: Öffentlich belegt");
      await expect(card(page, id)).not.toContainText("Fondsauszahlplan: Öffentlich belegt");
      await select(page, id).check();
    }
    await button(page, "Direktvergleich öffnen").click();
    for (const id of ruvIds) {
      const payouts = cell(page, "Auszahlungsarten", id);
      await expect(payouts).toContainText("Auszahlplan: Öffentlich belegt");
      await expect(payouts).not.toContainText("Fondsauszahlplan: Öffentlich belegt");
      await expect(payouts).toContainText("Die Fondsmechanik ist öffentlich nicht belegt");
      await expect(payouts.getByRole("link")).toHaveAttribute("href", "https://www.ruv.de/altersvorsorge/private-rentenversicherung/altersvorsorgedepot");
      await expect(cell(page, "Abgleich mit Ihren Wünschen", id)).toContainText(`Auszahlung: ${status}`);
    }
  });
}

test("R85-N1-T01/T02/T03/T04: own allowed values only, malformed preferences never match", () => {
  const guarantee = products.find(product => product.id === "garantie")!;
  for (const [field, values] of [
    ["payout", ["__invalid__", "__proto__", "constructor", undefined, null, {}, ["plan"]]],
    ["protection", ["bogus", null, ["full"]]],
    ["investment", ["synthetic", {}, ["model"], null, 1]],
  ] as const) {
    for (const value of values) {
      const input = { ...emptyProductAnswers, [field]: value };
      expect(preferenceMatches(guarantee, input)[field]).toBe("unknown");
      expect(nextProductAnswers(input, emptyProductAnswers)).toBeNull();
    }
  }
  const inherited = Object.create({ payout: "plan", protection: "full", investment: "model" });
  const getter = { ...emptyProductAnswers, get payout() { throw new Error("must not read accessor"); } };
  for (const input of [null, [], inherited, getter]) {
    expect(preferenceMatches(guarantee, input).payout).toBe("unknown");
    expect(nextProductAnswers(input, emptyProductAnswers)).toBeNull();
  }
  expect(preferenceMatches(guarantee, inherited)).toEqual({ payout: "unknown", protection: "unknown", investment: "unknown" });
  for (const protection of ["atLeast80", "full"]) {
    expect(preferenceMatches(guarantee, { ...emptyProductAnswers, protection }).protection).toBe("supported");
  }
  for (const payout of ["", "open"]) {
    expect(preferenceMatches(guarantee, { ...emptyProductAnswers, payout }).payout).toBeNull();
  }
  expect(nextProductAnswers({ ...emptyProductAnswers }, emptyProductAnswers)).toBe(emptyProductAnswers);
  expect(nextProductAnswers({ ...emptyProductAnswers, payout: "plan" }, emptyProductAnswers)?.payout).toBe("plan");
});

test("R85-N1-T05/T06/N05: selection validation rejects whole invalid input and preserves equal sets", () => {
  const current = ["basis", "pro"] as const;
  const single = ["basis"] as const;
  expect(nextProductSelection(["basis", "__invalid__"], single)).toBeNull();
  const hole = ["basis", "pro"];
  delete hole[1];
  for (const ids of [
    ["basis", "__invalid__"], ["basis", "basis"], ["basis", "pro", "ruv-standard", "garantie"],
    ["__proto__"], ["constructor"], hole, null, { length: 2, 0: "basis", 1: "pro" },
  ]) {
    expect(nextProductSelection(ids, current)).toBeNull();
    expect(current).toEqual(["basis", "pro"]);
  }
  expect(nextProductSelection(["pro", "basis"], current)).toBe(current);
  expect(nextProductSelection(["pro", "ruv-standard", "basis"], current)).toEqual(["basis", "ruv-standard", "pro"]);
  expect(nextProductSelection([], current)).toEqual([]);
});

test("R85-N1-T06: rapid selection preserves accepted toggles and refuses the fourth", async ({ page }) => {
  await openFinder(page);
  await showCards(page);
  const inputs = page.locator(".retirement-product-grid input");
  await inputs.evaluateAll(nodes => {
    nodes.slice(0, 4).forEach(node => (node as HTMLInputElement).click());
  });
  await expect(page.getByRole("status").filter({ hasText: "3 von höchstens 3" })).toContainText("wurde nicht ausgewählt");
  for (const id of ["basis", "ruv-standard", "pro"] as const) await expect(select(page, id)).toBeChecked();
  await expect(select(page, "ruv-individuell")).not.toBeChecked();
  await button(page, "Direktvergleich öffnen").click();
  await expect(comparison(page).locator(".retirement-product-matrix")).toHaveAttribute("data-columns", "3");
  await expect(comparison(page).getByRole("list", { name: "Gewählte Alternativen" }).getByRole("listitem")).toHaveCount(3);
});
