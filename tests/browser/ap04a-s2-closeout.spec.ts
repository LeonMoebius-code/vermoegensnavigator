import { test, expect, type Page } from "@playwright/test";
import { emptyRetirementAnswers, fundingOrientation, possibleText } from "../../app/presentation/retirement/retirement-questions";

const btn = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
const yearLabel = "Für welches Jahr möchten Sie erstmals einzahlen?";
const birthLabel = "In welchem Jahr sind Sie geboren? (optional)";
const employee = "Angestellt und in der deutschen gesetzlichen Rentenversicherung pflichtversichert";
const marriage = "Sind Sie verheiratet oder in einer eingetragenen Lebenspartnerschaft?";
const consent = "Haben Sie der erforderlichen Datenübermittlung gegenüber Ihrer zuständigen Stelle zugestimmt?";
const tri = (p: Page, question: string, answer: string) => p.getByRole("group", { name: question, exact: true }).getByRole("radio", { name: answer, exact: true });
async function enter(p: Page) {
  await p.goto("./"); await p.locator(".sidebar nav").getByRole("button", { name: /Altersvorsorge/ }).click();
  await btn(p, "Neue Altersvorsorge planen").click(); await btn(p, "Meine Voraussetzungen prüfen").click();
}
async function show(p: Page, name: string) {
  await p.getByRole("navigation", { name: "Abschnitte der Förderfragen", exact: true }).getByRole("button", { name: new RegExp(name + "$") }).click();
  await expect(p.getByRole("heading", { name, exact: true })).toBeFocused();
}

for (const [year, start, expected] of [
  ["2027", "2027", "possible"], ["2028", "2028", "possible"],
  ["2027", "2028", "conflict"], ["2028", "2027", "conflict"], ["2027", "2029", "conflict"],
  ["2028", "2026", "conflict"], ["2029", "2027", "Förderregelstand"], ["2026", "2028", "erst ab 2027"],
  ["", "2027", "Bitte wählen"], ["oops", "2027", "gültiges vierstelliges"], ["0099", "2027", "gültiges vierstelliges"],
]) test(`R71-01: ${year || "open"} / ${start}: ${expected}`, () => {
  const answers = { ...emptyRetirementAnswers(), year, employment: "employee" as const };
  const original = JSON.stringify(answers), result = fundingOrientation(answers, start);
  expect(JSON.stringify(answers)).toBe(original);
  expect(result.possible).toBe(expected === "possible");
  if (expected === "possible") expect(result.message).toBe(possibleText);
  else if (expected === "conflict") {
    expect(result.message).toContain("stimmt nicht mit dem Beginn Ihres Sparplans überein");
    expect(result.message).not.toContain("kein geprüfter Förderregelstand");
    expect(result.next[0]).toBe("Beitragsjahr und Zahlungsstartjahr gemeinsam prüfen und die abweichende Jahresangabe korrigieren.");
    expect(result.title).toBe("Weitere Angaben erforderlich");
  } else expect(result.message).toContain(expected);
});

test("S2 sequential employee route, own summary, keyboard focus and optional answers", async ({ page }) => {
  await enter(page);
  await expect(page.getByRole("status")).toHaveText("Abschnitt 1 von 4: Zeitraum und Person");
  await expect(page.getByRole("group")).toHaveCount(0);
  await page.getByLabel(yearLabel, { exact: true }).fill("2028"); await page.getByLabel(birthLabel, { exact: true }).fill("1990");
  await btn(page, "Weiter").focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Erwerb und Versicherung", exact: true })).toBeFocused();
  await page.getByRole("radio", { name: employee, exact: true }).check();
  await page.getByRole("checkbox", { name: "Kindererziehungszeiten", exact: true }).check();
  await page.getByRole("checkbox", { name: "Ich pflege Angehörige", exact: true }).check();
  await btn(page, "Weiter").click();
  await expect(page.getByRole("status")).toHaveText("Abschnitt 3 von 4: Bestehende Vorsorge und Kinder");
  await tri(page, "Haben Sie bereits einen Riester-Vertrag?", "Nein").check();
  await tri(page, "Wird für eines Ihrer Kinder aktuell Kindergeld gezahlt?", "Weiß ich nicht / gemeinsam prüfen").check();
  await btn(page, "Weiter").click();
  await expect(page.getByRole("status")).toHaveText("Abschnitt 4 von 4: Ihre erste Orientierung");
  const summary = page.locator(".retirement-answer-summary");
  for (const value of ["2028", "1990", employee, "Kindererziehungszeiten, Ich pflege Angehörige", "Weiß ich nicht / gemeinsam prüfen"]) await expect(summary).toContainText(value);
  await expect(page.getByTestId("funding-orientation")).toHaveText(possibleText);
  await expect(page.getByRole("region", { name: "Vorläufige Förderorientierung" })).toContainText("Zuordnung");
  await expect(page.getByRole("navigation", { name: "Abschnitte der Förderfragen" }).getByRole("button", { name: "4. Ihre erste Orientierung", exact: true })).toHaveAttribute("aria-current", "step");
  await btn(page, "Zurück").click(); await btn(page, "Zurück").click(); await btn(page, "Zurück").click();
  await expect(page.getByLabel(yearLabel, { exact: true })).toHaveValue("2028");
  await show(page, "Erwerb und Versicherung");
  await expect(page.getByRole("checkbox", { name: "Kindererziehungszeiten", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Ich pflege Angehörige", exact: true })).toBeChecked();
  await show(page, "Ihre erste Orientierung"); await btn(page, "Weiter zum eigenen Sparplan").click();
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await btn(page, "Modellrechnung anzeigen").click(); await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  await btn(page, "Zurück zu meinen Voraussetzungen").click();
  await expect(page.getByLabel(birthLabel, { exact: true })).toHaveValue("1990");
});

for (const employment of ["Selbstständig oder freiberuflich", "Derzeit nicht erwerbstätig", "Andere Situation / gemeinsam prüfen"]) test(`S2 special insurance and partner answers survive hiding: ${employment}`, async ({ page }) => {
  await enter(page); await page.getByLabel(yearLabel, { exact: true }).fill("2027"); await btn(page, "Weiter").click();
  await page.getByRole("radio", { name: employment, exact: true }).check(); await btn(page, "Weiter").click();
  await expect(page.getByRole("status")).toHaveText("Abschnitt 3 von 5: Besondere Voraussetzungen");
  await page.getByRole("radio", { name: "Noch unklar", exact: true }).check();
  await tri(page, marriage, "Ja").check(); await tri(page, "Leben Sie dauerhaft getrennt?", "Nein").check();
  await tri(page, "Ist Ihr Partner selbst unmittelbar förderberechtigt?", "Weiß ich nicht / gemeinsam prüfen").check();
  await tri(page, marriage, "Nein").check();
  await expect(page.getByRole("group", { name: "Leben Sie dauerhaft getrennt?", exact: true })).toHaveCount(0);
  await tri(page, marriage, "Ja").check(); await expect(tri(page, "Leben Sie dauerhaft getrennt?", "Nein")).toBeChecked();
  await show(page, "Erwerb und Versicherung"); await page.getByRole("radio", { name: employee, exact: true }).check();
  await expect(page.getByRole("navigation", { name: "Abschnitte der Förderfragen" })).not.toContainText("Besondere Voraussetzungen");
  await show(page, "Ihre erste Orientierung"); await expect(page.locator(".retirement-answer-summary")).not.toContainText("Dauerhaft getrennt");
  await show(page, "Erwerb und Versicherung"); await page.getByRole("radio", { name: employment, exact: true }).check(); await btn(page, "Weiter").click();
  await expect(page.getByRole("radio", { name: "Noch unklar", exact: true })).toBeChecked();
  await expect(tri(page, marriage, "Ja")).toBeChecked();
  await expect(tri(page, "Ist Ihr Partner selbst unmittelbar förderberechtigt?", "Weiß ich nicht / gemeinsam prüfen")).toBeChecked();
  await expect(page.getByTestId("funding-orientation")).not.toHaveText(possibleText);
  await show(page, "Ihre erste Orientierung"); await expect(page.locator(".retirement-answer-summary")).toContainText("Noch unklar");
  await btn(page, "Weiter zum eigenen Sparplan").click(); await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
});

test("S2 civil consent controls partner visibility, preserves answers and remains provisional", async ({ page }) => {
  await enter(page); await page.getByLabel(yearLabel, { exact: true }).fill("2027"); await btn(page, "Weiter").click();
  await page.getByRole("radio", { name: "Verbeamtet", exact: true }).check(); await btn(page, "Weiter").click();
  await expect(page.getByRole("group", { name: "Welche Versicherungssituation trifft auf Sie zu?", exact: true })).toHaveCount(0);
  await tri(page, consent, "Nein").check(); await tri(page, marriage, "Ja").check();
  await tri(page, "Ist Ihr Partner selbst unmittelbar förderberechtigt?", "Ja").check();
  await tri(page, consent, "Ja").check(); await expect(page.getByRole("group", { name: marriage, exact: true })).toHaveCount(0);
  await tri(page, consent, "Weiß ich nicht / gemeinsam prüfen").check(); await expect(tri(page, marriage, "Ja")).toBeChecked();
  await expect(tri(page, "Ist Ihr Partner selbst unmittelbar förderberechtigt?", "Ja")).toBeChecked();
  await show(page, "Ihre erste Orientierung");
  await expect(page.getByTestId("funding-orientation")).toContainText("Einwilligung");
  await expect(page.locator(".retirement-answer-summary")).toContainText("Weiß ich nicht / gemeinsam prüfen");
});

for (const answer of ["Ja", "Nein", "Weiß ich nicht / gemeinsam prüfen"]) test(`S2 child benefit ${answer} never confirms assignment`, async ({ page }) => {
  await enter(page); await show(page, "Bestehende Vorsorge und Kinder");
  await tri(page, "Wird für eines Ihrer Kinder aktuell Kindergeld gezahlt?", answer).check();
  if (answer === "Ja") await expect(page.getByText(/Kindergeldbezug allein ordnet noch keine Kinderzulage zu/)).toBeVisible();
  await btn(page, "Weiter").click();
  await expect(page.locator(".retirement-answer-summary")).toContainText(answer);
  await btn(page, "Weiter zum eigenen Sparplan").click(); await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await page.getByText("Beraterprüfung: Förderung und Sonderfälle", { exact: true }).click();
  await expect(page.getByLabel("Gibt es Kinder, für die eine Kinderzulage infrage kommt?", { exact: true })).toHaveValue(answer === "Ja" ? "yes" : "unknown");
});

test("S2 invalid year and birth focus, optional empty sequence", async ({ page }) => {
  await enter(page); await page.getByLabel(yearLabel, { exact: true }).fill("oops"); await btn(page, "Weiter").click();
  await expect(page.getByLabel(yearLabel, { exact: true })).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("vierstelliges Beitragsjahr");
  await page.getByLabel(yearLabel, { exact: true }).fill("2027"); await page.getByLabel(birthLabel, { exact: true }).fill("2028");
  await page.getByRole("navigation", { name: "Abschnitte der Förderfragen", exact: true }).getByRole("button", { name: /Ihre erste Orientierung$/ }).click(); await expect(page.getByLabel(birthLabel, { exact: true })).toBeFocused();
  await expect(page.getByLabel(birthLabel, { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel(birthLabel, { exact: true }).fill(""); await page.getByLabel(yearLabel, { exact: true }).fill("");
  await btn(page, "Weiter").click(); await btn(page, "Weiter").click(); await btn(page, "Weiter").click();
  await expect(page.getByRole("status")).toHaveText("Abschnitt 4 von 4: Ihre erste Orientierung");
  await expect(page.locator(".retirement-answer-summary")).toContainText("Noch offen");
  await btn(page, "Weiter zum eigenen Sparplan").click(); await expect(page.getByTestId("customer-retirement")).toBeVisible();
});

for (const width of [375, 768, 1280]) test(`S2 all sections reflow at ${width}px and 200% CSS zoom, keyboard back and forward`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await enter(page);
  await page.getByLabel(yearLabel, { exact: true }).fill("2027"); await btn(page, "Weiter").click();
  await page.getByRole("radio", { name: "Selbstständig oder freiberuflich", exact: true }).check();
  await show(page, "Zeitraum und Person");
  for (const name of ["Zeitraum und Person", "Erwerb und Versicherung", "Besondere Voraussetzungen", "Bestehende Vorsorge und Kinder", "Ihre erste Orientierung"]) {
    await show(page, name);
    await expect(page.getByRole("heading", { name, exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => { document.body.style.zoom = "2"; });
    expect(await page.locator(".retirement-questionnaire").evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    for (const control of await page.locator(".retirement-question-actions button").all()) {
      await expect(control).toBeVisible();
      expect(await control.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    }
    await page.evaluate(() => { document.body.style.zoom = "1"; });
  }
  await btn(page, "Zurück").focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Bestehende Vorsorge und Kinder", exact: true })).toBeFocused();
  await btn(page, "Weiter").focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Ihre erste Orientierung", exact: true })).toBeFocused();
});
