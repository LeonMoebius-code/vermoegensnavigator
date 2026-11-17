import { test, expect, type Page } from "@playwright/test";
import { emptyRiesterJourney, invalidateRiesterAnswer } from "../../app/presentation/retirement/riester-journey";
import { emptyOldDraft, previewComparison } from "../../app/presentation/retirement/old-riester-adapter";
const btn = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
const label = (p: Page, name: string) => p.getByLabel(name, { exact: true });
const card = (p: Page, id: number) => p.getByTestId(`riester-strategy-${id}`);
const storage = (p: Page) => p.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie, url: location.href }));
async function enter(p: Page) {
  await p.goto("./"); await p.locator(".sidebar nav").getByRole("button", { name: /Altersvorsorge/ }).click();
  await btn(p, "B – Bestehende Riester-Rente prüfen").click();
}
async function confirmOld(p: Page) {
  await btn(p, "Förderangaben mit Berater prüfen").click();
  for (const [name, value] of [["Alt-unmittelbare Berechtigung", "direct_old_confirmed"], ["Alt-Regime und Bestandsschutz", "old_protected_confirmed"], ["Alt-Vertragskontext", "single_private_eligible_confirmed"], ["Nachgewiesenes RV-Bemessungsjahr (t−1)", "2026"], ["Qualität der RV-Bemessung", "simple_domestic_prior_rv_confirmed"], ["Alt-Partnerstatus", "none_relevant_confirmed"], ["Alt-Berufseinsteigerbonus", "history_no_current_confirmed"], ["Vollständige Alt-Kinderliste", "none_confirmed"], ["Alt-Korrekturstatus", "none_confirmed"], ["B-Beitragsstand", "planned"]]) await label(p, name).selectOption(value);
  await label(p, "Maßgeblicher RV-Vorjahresbetrag in Euro").fill("35000"); await label(p, "B-Jahres-Eigenbeitrag in Euro").fill("360");
  await p.getByLabel("B: Jahres-Eigenbeitrag für Person", { exact: false }).check(); await label(p, "Alt-Gesamtbestätigung der Nachweise").selectOption("confirmed");
  await btn(p, "Alt-Fördervorschau prüfen").click(); await expect(p.getByTestId("old-total")).toHaveText("51,43 €");
}

test("UXB-01: independent safe invalidation for existing B1/B2 snapshots", () => {
  const d = emptyOldDraft();
  Object.assign(d, { entitlement: "direct_old_confirmed", regime: "old_protected_confirmed", contract: "single_private_eligible_confirmed", partner: "none_relevant_confirmed", childrenStatus: "none_confirmed", contributionConfirmed: true, evidenceQuality: "confirmed", comparisonConfirmed: true });
  d.newScenario = { ...d.newScenario, entitlement: "direct_confirmed", regime: "new_confirmed", contract: "single_eligible_confirmed", childrenStatus: "none_confirmed", scenarioConfirmed: true, transitionConfirmed: true, contributionConfirmed: true };
  const before = JSON.stringify(d);
  for (const field of ["provider", "product", "contractYear", "paying", "children", "partner"] as const) {
    const next = invalidateRiesterAnswer(d, field); expect(JSON.stringify(d)).toBe(before);
    expect(next.evidenceQuality).toBe("unconfirmed"); expect(next.comparisonConfirmed).toBe(false);
    expect(next.entitlement).toBe("direct_old_confirmed"); expect(next.income).toBe(d.income);
    expect(previewComparison(next).deltaCents).toBeUndefined();
    if (["provider", "product", "contractYear"].includes(field)) {
      expect(next.regime).toBe("unconfirmed"); expect(next.contract).toBe("unconfirmed"); expect(next.newScenario.entitlement).toBe("unconfirmed");
    } else if (field === "paying") {
      expect(next.contract).toBe(d.contract); expect(next.contributionConfirmed).toBe(false); expect(next.newScenario.contributionConfirmed).toBe(false);
    } else {
      expect(next.childrenStatus).toBe("unconfirmed"); expect(next.newScenario.childrenStatus).toBe("unconfirmed"); expect(next.contract).toBe(d.contract);
    }
  }
  expect(emptyRiesterJourney().selected).toEqual([]); expect(emptyRiesterJourney().payout).toBe("");
});

test("UXB-02: four equal cards, two to four selected, deselection and neutral comparison", async ({ page }) => {
  await enter(page);
  await expect(page.getByRole("heading", { name: "B1 – Bestandsaufnahme", exact: true })).toBeFocused();
  await expect(page.locator(".retirement-riester-card")).toHaveCount(4);
  for (let i = 1; i <= 4; i++) {
    await expect(card(page, i).getByRole("button", { name: /^Für mich prüfen/ })).toHaveAttribute("aria-pressed", "false");
    await card(page, i).getByText("Vorteile/Nachteile", { exact: true }).click();
    await expect(card(page, i)).toContainText("Nachteile und Risiken");
  }
  await btn(page, "Für mich prüfen: Strategie 1").click(); await btn(page, "Mit anderer Möglichkeit vergleichen: Strategie 4").click();
  const comparison = page.getByRole("region", { name: "Qualitative Gegenüberstellung", exact: true });
  await expect(comparison).toBeFocused(); await expect(comparison.getByRole("table")).toBeVisible();
  await expect(comparison.getByRole("columnheader")).toHaveCount(3);
  await expect(comparison).toContainText("keine Verdopplung personenbezogener Zulagen");
  for (const text of ["Eigenaufwand, Zulage und Steuerwirkung", "Vertragswert, Übertrag und Garantie mit Termin", "Kapitalentwicklung und Marktrisiken", "Auszahlform, Beginn und Langlebigkeit"]) await expect(comparison.getByRole("rowheader", { name: text, exact: true })).toBeVisible();
  await btn(page, "Für mich prüfen: Strategie 2").click(); await btn(page, "Für mich prüfen: Strategie 3").click();
  await expect(comparison.getByRole("columnheader")).toHaveCount(5);
  await btn(page, "Für mich prüfen: Strategie 1").click(); await btn(page, "Für mich prüfen: Strategie 2").click(); await btn(page, "Für mich prüfen: Strategie 3").click();
  await expect(comparison.getByRole("table")).toHaveCount(0); await expect(comparison).toContainText("mindestens zwei");
  await expect(page.getByTestId("old-result")).toHaveCount(0); await expect(page.getByTestId("comparison-delta")).toHaveCount(0);
});

test("UXB-03: 4A/4B and independent payout interest, contract/year changes revoke interest", async ({ page }) => {
  await enter(page); const payout = label(page, "Was möchten Sie zur Auszahlung besprechen?");
  await expect(payout).toHaveValue(""); await btn(page, "Für mich prüfen: Strategie 1").click();
  await payout.selectOption("check"); await expect(page.getByText("Nur zur Prüfung vorgemerkt.", { exact: true })).toBeVisible();
  await expect(btn(page, "Für mich prüfen: Strategie 1")).toHaveAttribute("aria-pressed", "true");
  await label(page, "Variante der Strategie 4").selectOption("4a"); await expect(page.getByTestId("riester-variant-explanation")).toContainText("Altgarantieanspruch kann bestehen bleiben");
  await label(page, "Variante der Strategie 4").selectOption("4b"); await expect(page.getByTestId("riester-variant-explanation")).toContainText("Zulagen nicht verdoppeln");
  await label(page, "Bei welchem Anbieter besteht Ihr Vertrag?").fill("Testanbieter"); await expect(payout).toHaveValue("");
  await payout.selectOption("check"); await label(page, "Für welches Beitragsjahr möchten Sie die Förderung prüfen?").selectOption("2026");
  await expect(payout).toHaveValue(""); await expect(page.getByText("Die beschriebene neue Wahlmöglichkeit beginnt frühestens 2027.", { exact: false })).toContainText("Beitragsjahr des Förderchecks legt Ihren Auszahlungsbeginn nicht fest");
  await label(page, "Für welches Beitragsjahr möchten Sie die Förderung prüfen?").selectOption("2028"); await expect(payout).toHaveValue("");
  await expect(payout.locator('option[value="check"]')).toBeEnabled();
});

test("UXB-04: existing contribution reused, exact cents, no assumptions or contract extract required", async ({ page }) => {
  await enter(page); await label(page, "Wie möchten Sie Ihren eigenen Beitrag angeben?").selectOption("monthly");
  await label(page, "Ihr eigener monatlicher Beitrag in Euro").fill("30");
  await expect(page.getByTestId("riester-entry-contribution")).not.toContainText("360,00");
  await label(page, "In welchem Monat beginnen die Zahlungen 2027?").selectOption("10");
  await label(page, "In wie vielen Monaten zahlen Sie 2027 tatsächlich ein?").selectOption("3");
  await expect(page.getByTestId("riester-entry-contribution")).toContainText("90,00 €");
  await label(page, "Ihr eigener monatlicher Beitrag in Euro").fill("30,001"); await expect(page.getByTestId("riester-entry-contribution")).not.toContainText("90,00 €");
  await label(page, "Ihr eigener monatlicher Beitrag in Euro").fill("30");
  await btn(page, "Weiter zum Fördervergleich").click(); await expect(page.getByRole("heading", { name: "B2 – Fördervergleich", exact: true })).toBeFocused();
  await btn(page, "Förderangaben mit Berater prüfen").click(); await expect(label(page, "B-Monatlicher Eigenbeitrag in Euro")).toHaveValue("30");
  await expect(label(page, "B-Beitragswirksame Monatsanzahl")).toHaveValue("3");
  await btn(page, "Getrennte Fördermodelle prüfen").click(); await expect(page.getByTestId("comparison-delta")).toHaveCount(0); await expect(page.getByTestId("old-status")).toContainText("prüfen");
});

test("UXB-05: existing model result preserved by selection, revoked by relevant customer answer", async ({ page }) => {
  await enter(page); await confirmOld(page);
  await expect(page.getByTestId("riester-funding-context")).toContainText("51,43 €");
  await btn(page, "Für mich prüfen: Strategie 2").click(); await label(page, "Was möchten Sie zur Auszahlung besprechen?").selectOption("check");
  await expect(page.getByTestId("old-total")).toHaveText("51,43 €");
  await label(page, "Kommt Kinderzulage für Sie infrage?").selectOption("yes"); await expect(page.getByTestId("old-result")).toHaveCount(0);
  await expect(label(page, "Vollständige Alt-Kinderliste")).toHaveValue("unconfirmed");
  await expect(label(page, "Alt-unmittelbare Berechtigung")).toHaveValue("direct_old_confirmed");
  await expect(label(page, "B-Jahres-Eigenbeitrag in Euro")).toHaveValue("360");
  await expect(page.getByTestId("riester-funding-context")).not.toContainText("51,43 €");
  await label(page, "Bei welchem Anbieter besteht Ihr Vertrag?").fill("Anderer Testanbieter");
  await expect(label(page, "Alt-Vertragskontext")).toHaveValue("unconfirmed"); await expect(label(page, "Alt-Regime und Bestandsschutz")).toHaveValue("unconfirmed");
});

test("UXB-06: navigation preserves B answers/choices and independent A draft, no persistence", async ({ page }) => {
  await enter(page); const before = await storage(page);
  await label(page, "Bei welchem Anbieter besteht Ihr Vertrag?").fill("Testanbieter"); await label(page, "Ihr eigener Jahresbeitrag in Euro").fill("360");
  await btn(page, "Für mich prüfen: Strategie 1").click(); await btn(page, "Für mich prüfen: Strategie 4").click(); await label(page, "Variante der Strategie 4").selectOption("4a");
  await btn(page, "B2 Fördervergleich").click(); await btn(page, "A/B-Auswahl").click(); await btn(page, "A – Neue Altersvorsorge planen").click();
  await label(page, "Unmittelbare Berechtigung").selectOption("direct_confirmed");
  await btn(page, "A/B-Auswahl").click(); await btn(page, "B – Bestehende Riester-Rente prüfen").click();
  await expect(label(page, "Bei welchem Anbieter besteht Ihr Vertrag?")).toHaveValue("Testanbieter"); await expect(label(page, "Ihr eigener Jahresbeitrag in Euro")).toHaveValue("360");
  await expect(btn(page, "Für mich prüfen: Strategie 1")).toHaveAttribute("aria-pressed", "true"); await expect(label(page, "Variante der Strategie 4")).toHaveValue("4a");
  await btn(page, "A/B-Auswahl").click(); await btn(page, "A – Neue Altersvorsorge planen").click(); await expect(label(page, "Unmittelbare Berechtigung")).toHaveValue("direct_confirmed");
  expect(await storage(page)).toEqual(before);
});

for (const action of ["Neustart", "Verlassen", "Reload"]) test(`UXB-07: ${action} warns for strategy-only changes, cancel retains and accept discards`, async ({ page }) => {
  await enter(page); const before = await storage(page); await btn(page, "Für mich prüfen: Strategie 3").click();
  const execute = async () => action === "Neustart" ? btn(page, "Spezialentwurf neu starten").click() : action === "Reload" ? page.reload() : page.locator(".sidebar nav").getByRole("button", { name: /Übersicht/ }).click();
  if (action === "Reload") {
    // An aborted reload need not reject with ERR_ABORTED. Observe the actual
    // beforeunload decision and document identity instead of a browser error code.
    await page.evaluate(() => { document.documentElement.dataset.uxbDocument = "original"; });
    const cdp = await page.context().newCDPSession(page);
    const dismissed = page.waitForEvent("dialog").then(async dialog => {
      expect(dialog.type()).toBe("beforeunload"); await dialog.dismiss();
    });
    await Promise.all([cdp.send("Page.reload"), dismissed]);
    await expect(page.locator("html")).toHaveAttribute("data-uxb-document", "original");
    await cdp.detach();
  } else {
    page.once("dialog", d => d.dismiss()); await execute();
  }
  await expect(btn(page, "Für mich prüfen: Strategie 3")).toHaveAttribute("aria-pressed", "true");
  page.once("dialog", d => d.accept()); await execute();
  if (action !== "Neustart") await page.locator(".sidebar nav").getByRole("button", { name: /Altersvorsorge/ }).click();
  await btn(page, "B – Bestehende Riester-Rente prüfen").click(); await expect(btn(page, "Für mich prüfen: Strategie 3")).toHaveAttribute("aria-pressed", "false");
  expect(await storage(page)).toEqual(before);
});

for (const width of [375, 768, 1440]) test(`UXB-08: ${width}px, keyboard focus, comparison containment and 200 percent sizing`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await enter(page);
  const choose = btn(page, "Für mich prüfen: Strategie 1"); await choose.focus(); await page.keyboard.press("Enter"); await expect(choose).toHaveAttribute("aria-pressed", "true");
  await btn(page, "Mit anderer Möglichkeit vergleichen: Strategie 4").focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Qualitative Gegenüberstellung", exact: true })).toBeFocused();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(await overflow()).toBe(true);
  await page.locator(".retirement-riester-grid").screenshot({ path: info.outputPath(`cards-${width}.png`) });
  await label(page, "In welchem Jahr wurde der Vertrag abgeschlossen?").fill("20"); await expect(page.getByRole("alert")).toContainText("vierstelliges Abschlussjahr");
  await page.locator(".retirement-view").evaluate(el => { (el as HTMLElement).style.zoom = "2"; });
  const overflowing = await page.locator(".retirement-view").evaluate(root => Array.from(root.querySelectorAll<HTMLElement>("*"))
    .filter(el => !el.closest(".retirement-riester-table") && el.scrollWidth > el.clientWidth && el.clientWidth > 0)
    .slice(0, 12).map(el => ({ tag: el.tagName, className: el.className, width: el.clientWidth, scroll: el.scrollWidth })));
  expect(await overflow(), JSON.stringify(overflowing)).toBe(true);
});
