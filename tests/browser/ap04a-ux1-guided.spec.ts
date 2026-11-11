import { test, expect, type Page } from "@playwright/test";
import { emptyRetirementAnswers, fundingOrientation, invalidateAnswer, possibleText, type RetirementAnswers } from "../../app/presentation/retirement/retirement-questions";
import { emptyCustomerPlan, customerGrant } from "../../app/presentation/retirement/customer-plan-adapter";

const button = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
async function entry(p: Page) { await p.goto("./"); await p.locator(".sidebar nav").getByRole("button", { name: /Altersvorsorge/ }).click(); }
async function questions(p: Page) { await entry(p); await button(p, "Neue Altersvorsorge planen").click(); await button(p, "Meine Voraussetzungen prüfen").click(); }
const tri = (p: Page, question: string, answer: string) => p.getByRole("group", { name: question, exact: true }).getByRole("radio", { name: answer, exact: true });
const employee = "Angestellt und in der deutschen gesetzlichen Rentenversicherung pflichtversichert";
const yearLabel = "Für welches Jahr möchten Sie erstmals einzahlen?";

for (const year of ["2027", "2028"]) test(`UX1 orientation ${year}: employee plus independent additional times, no evidence`, () => {
  const a = { ...emptyRetirementAnswers(), year, employment: "employee" as const, upbringing: true, care: true };
  expect(fundingOrientation(a, year)).toMatchObject({ possible: true, message: possibleText });
  expect(customerGrant(emptyCustomerPlan()).status).toBe("review_required");
});
for (const year of ["", "2026", "2029", "oops"]) test(`UX1 unapproved or unknown year ${year}: no positive status`, () => {
  const o = fundingOrientation({ ...emptyRetirementAnswers(), year, employment: "employee" }, year || "2027");
  expect(o.possible).toBe(false); expect(o.next[0]).toMatch(/Beitragsjahr|Startjahr|Rechtsstand/);
});
for (const employment of ["civil", "self", "none", "other"] as const) test(`UX1 ${employment}: concrete open condition, no blanket rejection`, () => {
  const o = fundingOrientation({ ...emptyRetirementAnswers(), year: "2027", employment, married: "yes", partner: "yes" }, "2027");
  expect(o.possible).toBe(false); expect(o.message).not.toMatch(/nicht berechtigt|ausgeschlossen/); expect(o.next.length).toBeGreaterThan(1);
});
for (const key of Object.keys(emptyRetirementAnswers()) as (keyof RetirementAnswers)[]) test(`UX1 invalidation ${key}: revoke only documented dependent evidence`, () => {
  const p = emptyCustomerPlan();
  p.evidence = { ...p.evidence, entitlement: "direct_confirmed", regime: "new_confirmed", contract: "single_eligible_confirmed", childrenStatus: "assigned_confirmed",
    children: [{ id: "synthetic-child", status: "eligible_assigned_confirmed" }], contributionConfirmed: true };
  p.capital = { ...p.capital, costConfirmed: true, referenceCostConfirmed: true, grantConfirmed: true };
  p.funding = "checked"; p.children = "yes";
  expect(customerGrant(p).status).toBe("calculated");
  const original = JSON.stringify(p), next = invalidateAnswer(p, key);
  expect(JSON.stringify(p)).toBe(original); expect(next.capital).toEqual(p.capital);
  expect(customerGrant(next).status).toBe("review_required");
  if (key === "riester") { expect(next.evidence.regime).toBe("unconfirmed"); expect(next.evidence.contract).toBe("unconfirmed"); expect(next.evidence.entitlement).toBe("direct_confirmed"); }
  else if (key === "childBenefit") { expect(next.evidence.childrenStatus).toBe("unconfirmed"); expect(next.evidence.contributionConfirmed).toBe(true); expect(next.evidence.entitlement).toBe("direct_confirmed"); }
  else expect(next.evidence.entitlement).toBe("unconfirmed");
  if (["year", "married", "separated", "partner", "riester", "childBenefit"].includes(key)) expect(next.evidence.children[0].status).toBe("assignment_unconfirmed");
  else expect(next.evidence.children[0].status).toBe("eligible_assigned_confirmed");
});

test("UX1 S1: no selected route, guest details, bounded example, B-specific orientation", async ({ page }) => {
  await entry(page);
  await expect(button(page, "Neue Altersvorsorge planen")).toBeVisible();
  await expect(button(page, "B – Bestehende Riester-Rente prüfen")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByText("Mehr erfahren", { exact: true }).click();
  await expect(page.getByText(/Beim neuen Altersvorsorgedepot sieht Union Investment einen Fondsauszahlplan vor/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Das Altersvorsorgedepot verstehen" })).toContainText("540 € im Vertrag");
  await expect(page.getByRole("region", { name: "Das Altersvorsorgedepot verstehen" })).toContainText("840 € im Vertrag");
  await button(page, "B – Bestehende Riester-Rente prüfen").click();
  await expect(page.getByRole("region", { name: "Orientierung zum bestehenden Riester-Vertrag" })).toContainText("tatsächlicher Übertragungswert");
  await page.getByText("Mehr erfahren", { exact: true }).click();
  await expect(page.getByText(/Bei Ihrem bestehenden Riester-Vertrag prüfen wir Garantie, Auszahltermin/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Das Altersvorsorgedepot verstehen" })).toHaveCount(0);
  await expect(page.getByTestId("old-result")).toHaveCount(0);
});

test("UX1 S2: unselected answers; standard orientation, multiple times, no fabricated evidence, neutral capital", async ({ page }) => {
  await questions(page);
  await expect(page.getByRole("radio").filter({ has: page.locator(":checked") })).toHaveCount(0);
  expect(await page.locator('.retirement-questionnaire input:checked').count()).toBe(0);
  await page.getByLabel(yearLabel, { exact: true }).fill("2027");
  await page.getByRole("radio", { name: employee, exact: true }).check();
  await page.getByRole("checkbox", { name: "Kindererziehungszeiten", exact: true }).check();
  await page.getByRole("checkbox", { name: "Ich pflege Angehörige", exact: true }).check();
  await expect(page.getByRole("radio", { name: employee, exact: true })).toBeChecked();
  await expect(page.getByTestId("funding-orientation")).toHaveText(possibleText);
  await expect(page.getByRole("group", { name: "Sind Sie verheiratet oder in einer eingetragenen Lebenspartnerschaft?" })).toHaveCount(0);
  await button(page, "Weiter zum eigenen Sparplan").click();
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await button(page, "Modellrechnung anzeigen").click();
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  await page.getByText("Beraterprüfung: Förderung und Sonderfälle", { exact: true }).click();
  for (const label of ["Geprüfte unmittelbare Berechtigung", "Geprüfte Förderregelung", "Geprüfte Vertragszuordnung"]) await expect(page.getByLabel(label, { exact: true })).toHaveValue("unconfirmed");
  await button(page, "Zurück zu meinen Voraussetzungen").click();
  await expect(page.getByRole("checkbox", { name: "Kindererziehungszeiten", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Ich pflege Angehörige", exact: true })).toBeChecked();
});

test("UX1 partner, Riester, child evidence remain open; A/B navigation retains answers and keeps B independent", async ({ page }) => {
  await questions(page); const before = await page.evaluate(() => JSON.stringify({ local: localStorage, session: sessionStorage }));
  await page.getByLabel(yearLabel, { exact: true }).fill("2028");
  await page.getByRole("radio", { name: "Derzeit nicht erwerbstätig", exact: true }).check();
  await tri(page, "Sind Sie verheiratet oder in einer eingetragenen Lebenspartnerschaft?", "Ja").check();
  await tri(page, "Leben Sie dauerhaft getrennt?", "Nein").check();
  await tri(page, "Ist Ihr Partner selbst unmittelbar förderberechtigt?", "Ja").check();
  await tri(page, "Wird für eines Ihrer Kinder aktuell Kindergeld gezahlt?", "Ja").check();
  await tri(page, "Haben Sie bereits einen Riester-Vertrag?", "Ja").check();
  await expect(page.getByTestId("funding-orientation")).not.toHaveText(possibleText);
  await expect(page.getByRole("region", { name: "Vorläufige Förderorientierung" })).toContainText("mittelbaren Förderung");
  await button(page, "Bestehenden Riester-Vertrag zuerst prüfen").click();
  await expect(page.getByTestId("old-result")).toHaveCount(0);
  await button(page, "A/B-Auswahl").click(); await button(page, "Neue Altersvorsorge planen").click(); await button(page, "Meine Voraussetzungen prüfen").click();
  await expect(tri(page, "Ist Ihr Partner selbst unmittelbar förderberechtigt?", "Ja")).toBeChecked();
  await expect(page.getByLabel(yearLabel, { exact: true })).toHaveValue("2028");
  expect(await page.evaluate(() => JSON.stringify({ local: localStorage, session: sessionStorage }))).toBe(before);
  page.once("dialog", d => d.dismiss()); await button(page, "Spezialentwurf neu starten").click();
  await expect(page.getByLabel(yearLabel, { exact: true })).toHaveValue("2028");
  page.once("dialog", d => d.accept()); await button(page, "Spezialentwurf neu starten").click();
  await button(page, "Neue Altersvorsorge planen").click(); await button(page, "Meine Voraussetzungen prüfen").click();
  await expect(page.getByLabel(yearLabel, { exact: true })).toHaveValue("");
});

test("UX1 correction of a previously confirmed personal case blocks stale grant immediately", async ({ page }) => {
  await questions(page); await page.getByLabel(yearLabel, { exact: true }).fill("2027"); await page.getByRole("radio", { name: employee, exact: true }).check();
  await button(page, "Weiter zum eigenen Sparplan").click();
  await page.getByText("Beraterprüfung: Förderung und Sonderfälle", { exact: true }).click();
  await page.getByLabel("Wurde Ihre Förderberechtigung bereits geklärt?", { exact: true }).selectOption("checked");
  await page.getByLabel("Gibt es Kinder, für die eine Kinderzulage infrage kommt?", { exact: true }).selectOption("no");
  for (const [label, value] of [["Geprüfte unmittelbare Berechtigung", "direct_confirmed"], ["Geprüfte Förderregelung", "new_confirmed"], ["Geprüfte Vertragszuordnung", "single_eligible_confirmed"]]) await page.getByLabel(label, { exact: true }).selectOption(value);
  await page.getByLabel("Für Person und Jahr geprüft: keine einzubeziehenden Kinder", { exact: true }).check();
  await page.getByLabel("Den geplanten Jahres-Eigenbeitrag für Person, Vertrag und Jahr fachlich als förderfähig geprüft", { exact: true }).check();
  await expect(page.getByTestId("customer-base-grant")).toHaveText("390,00 €");
  await button(page, "Zurück zu meinen Voraussetzungen").click(); await page.getByRole("radio", { name: "Selbstständig oder freiberuflich", exact: true }).check();
  await expect(page.getByTestId("funding-orientation")).not.toHaveText(possibleText);
  await button(page, "Weiter zum eigenen Sparplan").click();
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await page.getByText("Beraterprüfung: Förderung und Sonderfälle", { exact: true }).click();
  await expect(page.getByLabel("Geprüfte unmittelbare Berechtigung", { exact: true })).toHaveValue("unconfirmed");
  await expect(page.getByLabel("Geprüfte Vertragszuordnung", { exact: true })).toHaveValue("single_eligible_confirmed");
  await expect(page.getByLabel("Den geplanten Jahres-Eigenbeitrag für Person, Vertrag und Jahr fachlich als förderfähig geprüft", { exact: true })).not.toBeChecked();
});

for (const width of [375, 768, 1280]) test(`UX1 M1/M2 ${width}px: long labels, keyboard focus, local errors, 200% layout`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await entry(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await button(page, "Neue Altersvorsorge planen").focus(); await page.keyboard.press("Enter");
  await button(page, "Meine Voraussetzungen prüfen").focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Ihre mögliche Förderung", exact: true })).toBeFocused();
  const year = page.getByLabel(yearLabel, { exact: true }); await year.fill("oops"); await button(page, "Weiter zum eigenen Sparplan").click();
  await expect(year).toBeFocused(); await expect(year).toHaveAttribute("aria-invalid", "true");
  await year.fill("2027"); await page.getByRole("radio", { name: employee, exact: true }).check();
  await expect(page.getByTestId("funding-orientation")).toHaveText(possibleText);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await year.focus(); await page.keyboard.press("Tab"); await expect(page.getByLabel("In welchem Jahr sind Sie geboren? (optional)", { exact: true })).toBeFocused();
  await page.screenshot({ path: info.outputPath(`ux1-m2-${width}.png`), fullPage: true });
  // CSS zoom exercises enlarged controls and reflow; half-width viewport additionally
  // models the CSS-pixel viewport reduction of browser zoom. Not a claimed human UA audit.
  await page.evaluate(() => { document.body.style.zoom = "2"; });
  await expect(button(page, "Weiter zum eigenen Sparplan")).toBeVisible();
  await button(page, "Weiter zum eigenen Sparplan").click(); await expect(page.getByTestId("customer-retirement")).toBeVisible();
  await page.evaluate(() => { document.body.style.zoom = "1"; });
  await page.setViewportSize({ width: Math.floor(width / 2), height: 700 });
  await button(page, "Zurück zu meinen Voraussetzungen").click();
  expect(await page.evaluate(() => document.querySelector(".retirement-questionnaire")!.scrollWidth <= document.querySelector(".retirement-questionnaire")!.clientWidth)).toBe(true);
});
