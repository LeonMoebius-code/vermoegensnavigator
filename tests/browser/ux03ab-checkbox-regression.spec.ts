import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { annualContribution } from "../../app/presentation/retirement/direct-grant-adapter";
import { customerGrant, emptyCustomerPlan, plannedGrantDraft, runCustomerCapital, type CustomerPlan } from "../../app/presentation/retirement/customer-plan-adapter";

/** Synthetic, independently counted: 3 × 100 + 60 = 360; without once = 300. */
function confirmedPlan(): CustomerPlan {
  const p = emptyCustomerPlan();
  return { ...p, funding: "checked", children: "no", evidence: { ...p.evidence, entitlement: "direct_confirmed", regime: "new_confirmed",
    contract: "single_eligible_confirmed", childrenStatus: "none_confirmed", contributionConfirmed: true }, capital: { ...p.capital,
    start: "2027-10", end: "2027-12", oneOffEnabled: true, oneOff: "60", oneOffMonth: "2027-12",
    scenarios: [0, 1, 2].map(() => ({ equity: "0", bond: "0" })) } };
}

type Tree = { type?: unknown; props?: Record<string, unknown> };
type Customer = (props: { plan: CustomerPlan; change: (next: CustomerPlan) => void; back: () => void }) => Tree;
let component: Customer, directory: string;
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "ux03-checkbox-component-"));
  const output = join(directory, "component.mjs");
  // This isolates hooks only, then invokes the REAL component's onChange handler.
  // It is a Node component-integration check, not a claimed browser rendering.
  await build({ stdin: { contents: `export { RetirementCustomer } from ${JSON.stringify(resolve("app/presentation/retirement/retirement-customer.tsx"))};`,
    resolveDir: process.cwd(), loader: "tsx" }, bundle: true, platform: "node", format: "esm", jsx: "automatic", outfile: output,
    plugins: [{ name: "synthetic-react-hooks", setup(builder) {
      builder.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, args => ({ path: args.path, namespace: "synthetic-hooks" }));
      builder.onLoad({ filter: /.*/, namespace: "synthetic-hooks" }, args => ({ loader: "js", contents: args.path === "react"
        ? 'export const useId=()=>"checkbox-regression"; export const useRef=()=>({current:null}); export const useState=()=>[null,()=>{}];'
        : 'export const Fragment=Symbol("fragment"); export const jsx=(type,props)=>({type,props}); export const jsxs=jsx;' }));
    } }] });
  component = (await import(pathToFileURL(output).href)).RetirementCustomer as Customer;
});
test.afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

function checkboxChange(plan: CustomerPlan, key: string, checked: boolean): CustomerPlan {
  let changed: CustomerPlan | null = null;
  const root = component({ plan, change: next => { changed = next; }, back: () => {} });
  function find(value: unknown): Tree | null {
    if (Array.isArray(value)) { for (const child of value) { const hit = find(child); if (hit) return hit; } return null; }
    if (!value || typeof value !== "object") return null;
    const node = value as Tree;
    if (node.type === "input" && node.props?.id === `checkbox-regression-${key}`) return node;
    return find(node.props?.children);
  }
  const target = find(root);
  expect(target, `real checkbox ${key}`).not.toBeNull();
  (target!.props!.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked } });
  expect(changed).not.toBeNull();
  return changed!;
}

test("P2 component: disabling own once revokes contribution evidence and grant until reconfirmed", () => {
  const before = confirmedPlan(), snapshot = JSON.stringify(before);
  const prior = customerGrant(before);
  expect(prior.status).toBe("calculated");
  if (prior.status !== "calculated") throw new Error("confirmed grant fixture");
  expect(prior.annualCents).toBe(36000); expect(prior.result.baseGrantCents).toBe(18000);
  const next = checkboxChange(before, "oneOffEnabled", false);
  const draft = plannedGrantDraft(next); if ("status" in draft) throw new Error(draft.message);
  expect(annualContribution(draft)).toMatchObject({ status: "valid", cents: 30000 });
  expect(next.evidence.contributionConfirmed).toBe(false);
  expect(next.evidence.entitlement).toBe("direct_confirmed");
  expect(customerGrant(next).status).toBe("review_required");
  const capital = runCustomerCapital(next); expect(capital.status).toBe("responses");
  if (capital.status !== "responses") throw new Error("capital fixture");
  for (const response of capital.responses) expect(response.projectionResults[0].summary.specifiedEndBalance).toHaveProperty("displayCents", 30000);
  const checked = customerGrant({ ...next, evidence: { ...next.evidence, contributionConfirmed: true } });
  expect(checked.status).toBe("calculated");
  if (checked.status === "calculated") expect(checked.result.baseGrantCents).toBe(15000);
  expect(JSON.stringify(before)).toBe(snapshot);
});

for (const key of ["stressEnabled", "referenceEnabled"] as const) test(`P2 component: market/reference checkbox ${key} preserves own-contribution evidence`, () => {
  const before = confirmedPlan(), next = checkboxChange(before, key, true);
  expect(next.evidence.contributionConfirmed).toBe(true);
  expect(next.evidence).toEqual(before.evidence);
  expect(customerGrant(next)).toEqual(customerGrant(before));
});

for (const key of ["costConfirmed", "referenceCostConfirmed", "grantConfirmed"] as const)
  for (const checked of [false, true]) test(`P2 component: explicit ${key}=${checked} keeps unrelated evidence separate`, () => {
    const p = confirmedPlan();
    p.capital = { ...p.capital, costMode: "explicit", referenceEnabled: true, referenceCostMode: "explicit", grantEnabled: true,
      grantAmount: "60", grantMonth: "2027-12", costConfirmed: true, referenceCostConfirmed: true, grantConfirmed: true, [key]: !checked };
    const next = checkboxChange(p, key, checked);
    expect(next.capital[key]).toBe(checked);
    for (const other of ["costConfirmed", "referenceCostConfirmed", "grantConfirmed"] as const) if (other !== key) expect(next.capital[other]).toBe(true);
    expect(next.evidence).toEqual(p.evidence);
  });

const input = (p: Page, name: string) => p.getByLabel(name, { exact: true });
const calculate = (p: Page) => p.getByRole("button", { name: "Modellrechnung anzeigen", exact: true }).click();
test("P2 browser: remove confirmed own once, block grant, invalidate capital, reconfirm; market edit retains evidence", async ({ page }) => {
  await page.goto("./");
  await page.locator(".sidebar nav").getByRole("button", { name: /Altersvorsorge/ }).click();
  await page.getByRole("button", { name: "Neue Altersvorsorge planen", exact: true }).click();
  await input(page, "Ab wann möchten Sie sparen?").fill("2027-10");
  await input(page, "Bis wann möchten Sie sparen?").fill("2027-12");
  await input(page, "Wurde Ihre Förderberechtigung bereits geklärt?").selectOption("checked");
  await input(page, "Gibt es Kinder, für die eine Kinderzulage infrage kommt?").selectOption("no");
  await page.getByText("Feineinstellungen und Modellannahmen", { exact: true }).click();
  for (const scenario of ["Zurückhaltend", "Mittlere Annahme", "Höhere Annahme"]) for (const asset of ["Aktienrendite", "Rentenrendite"])
    await input(page, `${scenario}: ${asset} in % p. a.`).fill("0");
  const once = input(page, "Zusätzliche eigene Einmalzahlung einplanen");
  await once.check(); await input(page, "Einmalzahlung in Euro").fill("60"); await input(page, "Monat der Einmalzahlung").fill("2027-12");
  await page.getByText("Beraterprüfung: Förderung und Sonderfälle", { exact: true }).click();
  await input(page, "Geprüfte unmittelbare Berechtigung").selectOption("direct_confirmed");
  await input(page, "Geprüfte Förderregelung").selectOption("new_confirmed");
  await input(page, "Geprüfte Vertragszuordnung").selectOption("single_eligible_confirmed");
  await input(page, "Für Person und Jahr geprüft: keine einzubeziehenden Kinder").check();
  const contribution = input(page, "Den geplanten Jahres-Eigenbeitrag für Person, Vertrag und Jahr fachlich als förderfähig geprüft");
  await contribution.check();
  await expect(page.getByTestId("customer-annual")).toContainText("360,00 €");
  await expect(page.getByTestId("customer-base-grant")).toHaveText("180,00 €");
  await calculate(page); await expect(page.getByTestId("scenario-line")).toHaveCount(3);
  for (const value of await page.getByTestId("customer-end-value").allTextContents()) expect(value).toBe("360,00 €");

  await once.uncheck();
  await expect(page.getByTestId("customer-annual")).toContainText("300,00 €");
  await expect(contribution).not.toBeChecked();
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  await expect(page.getByTestId("customer-grant-status")).toHaveText("Gemeinsam prüfen");
  await expect(page.getByTestId("customer-end-value")).toHaveCount(0);
  await expect(page.getByTestId("scenario-line")).toHaveCount(0);
  await expect(input(page, "Geprüfte unmittelbare Berechtigung")).toHaveValue("direct_confirmed");
  await expect(input(page, "Geprüfte Förderregelung")).toHaveValue("new_confirmed");
  await expect(input(page, "Geprüfte Vertragszuordnung")).toHaveValue("single_eligible_confirmed");

  await calculate(page); // Independent capital remains usable without grant confirmation.
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
  for (const value of await page.getByTestId("customer-end-value").allTextContents()) expect(value).toBe("300,00 €");
  await contribution.check();
  await expect(page.getByTestId("customer-base-grant")).toHaveText("150,00 €");
  await expect(page.getByTestId("scenario-line")).toHaveCount(3);

  await input(page, "Einmaligen Aktienkursverlust modellieren").check();
  await expect(contribution).toBeChecked();
  await expect(page.getByTestId("customer-base-grant")).toHaveText("150,00 €");
  await expect(page.getByTestId("scenario-line")).toHaveCount(0);
  await input(page, "Einmaligen Aktienkursverlust modellieren").uncheck();
  await expect(contribution).toBeChecked();
  await expect(page.getByTestId("customer-base-grant")).toHaveText("150,00 €");
  await once.check();
  await expect(page.getByTestId("customer-annual")).toContainText("360,00 €");
  await expect(contribution).not.toBeChecked();
  await expect(page.getByTestId("customer-base-grant")).toHaveCount(0);
});
