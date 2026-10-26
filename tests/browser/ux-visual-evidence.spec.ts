import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { CASE_STORAGE_KEY } from "../../app/case-storage";
import { qualityOptionalCase } from "../../scripts/quality-fixtures";
import { modelPortfolioCase } from "../../scripts/modelportfolio-fixtures";
const BASE = "ae798dfff80b6f805b013e0a1aa871120bdde1d1";
const button = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
async function picture(p: Page, info: TestInfo, name: string, selector?: string) {
  const bytes = selector ? await p.locator(selector).screenshot({ animations: "disabled" }) : await p.screenshot({ animations: "disabled" });
  await info.attach(name, { body: bytes, contentType: "image/png" });
  // Preserve successful screenshots in original CI logs without changing artifact workflows.
  console.log(`UX_SCREENSHOT ${JSON.stringify({ name, sha256: createHash("sha256").update(bytes).digest("hex"), base64: bytes.toString("base64") })}`);
}
test("Synthetische Vorher-/Nachher-Nachweise vom echten Ausgangscode und aktuellen Build", async ({ page }, info) => {
  const dir = mkdtempSync(join(tmpdir(), "vn-ux-before-"));
  try {
    cpSync("app", join(dir, "app"), { recursive: true }); cpSync("github-entry.tsx", join(dir, "github-entry.tsx"));
    symlinkSync(resolve("node_modules"), join(dir, "node_modules"), "dir");
    for (const path of ["app/page.tsx", "app/presentation/case-store-notice.ts", "app/globals.css"]) writeFileSync(join(dir, path), execFileSync("git", ["show", `${BASE}:${path}`]));
    const js = (await build({ entryPoints: [join(dir, "github-entry.tsx")], bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", minify: true })).outputFiles[0].contents;
    const css = execFileSync("git", ["show", `${BASE}:app/globals.css`]);
    await page.route("**/app.js*", route => route.fulfill({ body: Buffer.from(js), contentType: "application/javascript" }));
    await page.route("**/styles.css*", route => route.fulfill({ body: css, contentType: "text/css" }));
    const source = JSON.stringify([qualityOptionalCase()]);
    await page.goto("./"); await page.evaluate(({ key, source }) => localStorage.setItem(key, source), { key: CASE_STORAGE_KEY, source }); await page.reload();
    await expect(page.locator(".case-store-notice")).toBeVisible();
    await picture(page, info, "01-vorher-navigation-banner");
    await page.unroute("**/app.js*"); await page.unroute("**/styles.css*"); await page.reload();
    await expect(page.locator(".case-store-notice")).toHaveCount(0);
    await picture(page, info, "02-nachher-navigation-ohne-banner");
    await button(page, "Mehr & Einstellungen").click();
    await picture(page, info, "03-nachher-einstellungen");
    const c = modelPortfolioCase(); c.plans[0].preferred = true;
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: CASE_STORAGE_KEY, raw: JSON.stringify([c]) });
    const house = async () => {
      await page.reload(); await page.getByRole("navigation").getByRole("button", { name: /Beratungsfälle/ }).click();
      await page.getByRole("button", { name: c.advisory.caseName, exact: false }).click();
      await page.getByRole("navigation").getByRole("button", { name: "Strukturplanung" }).click();
      await button(page, "Vermögensstruktur").click();
      await page.locator(".house-layout").evaluate(e => { e.style.width = "680px"; e.style.maxWidth = "100%"; });
    };
    await house(); await picture(page, info, "05-nachher-haus-680", ".house-layout");
    await page.setViewportSize({ width: 390, height: 1000 });
    await picture(page, info, "06-nachher-haus-mobil", ".house-layout");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.route("**/app.js*", route => route.fulfill({ body: Buffer.from(js), contentType: "application/javascript" }));
    await page.route("**/styles.css*", route => route.fulfill({ body: css, contentType: "text/css" }));
    await house(); await picture(page, info, "04-vorher-haus-680", ".house-layout");
    console.log(`UX_BEFORE_SOURCE ${BASE}: original page, notice and CSS; all other app sources unchanged by this package`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
