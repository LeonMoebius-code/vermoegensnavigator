import { expect, type Page, type TestInfo } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { CASE_STORAGE_KEY as KEY, RECOVERY_PREFIX } from "../../app/case-storage";
import type { AdvisoryCase } from "../../app/case-model";
export { KEY, RECOVERY_PREFIX };
export const nav = (p: Page, name: string) => p.getByRole("navigation").getByRole("button", { name, exact: false }).click();
export const raw = (p: Page) => p.evaluate(k => localStorage.getItem(k), KEY);
export const data = async (p: Page): Promise<AdvisoryCase[]> => JSON.parse(await raw(p) || "[]");
export const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
export function monitor(p: Page) { const errors: string[] = []; p.on("pageerror", e => errors.push(e.message)); return errors; }
export async function seed(p: Page, cases: AdvisoryCase[]) {
  await p.goto("./");
  // This context belongs solely to this test. No initialization script can overwrite a real reload.
  await p.evaluate(({ key, bytes }) => localStorage.setItem(key, bytes), { key: KEY, bytes: JSON.stringify(cases, null, 2) });
  await p.reload();
}
export async function open(p: Page, c: AdvisoryCase) {
  await nav(p, "Beratungsfälle"); await p.getByRole("button", { name: c.advisory.caseName, exact: false }).click();
  await expect(p.locator(".wizard-head")).toBeVisible();
}
export async function save(p: Page) { await nav(p, "Depotcheck"); await p.getByRole("button", { name: "Fall speichern", exact: true }).click(); }
export async function download(p: Page, info: TestInfo, name: RegExp, tag: string) {
  const event = p.waitForEvent("download"); await p.getByRole("button", { name }).click(); const d = await event;
  expect(await d.failure()).toBeNull(); const target = info.outputPath(`${tag}-${d.suggestedFilename()}`);
  await d.saveAs(target); const bytes = await readFile(target); expect(bytes.length).toBeGreaterThan(0);
  // The unchanged workflow uploads files only on failure. Preserve successful
  // synthetic XLSX bytes in the original job log without changing that workflow.
  if (d.suggestedFilename().endsWith(".xlsx")) console.log(`F021_DOWNLOAD ${JSON.stringify({ test: info.title, tag, filename: d.suggestedFilename(), sha256: sha(bytes), gzipBase64: gzipSync(bytes).toString("base64") })}`);
  return bytes;
}
export async function current(p: Page, info: TestInfo, tag: string): Promise<AdvisoryCase> {
  await nav(p, "Ergebnis & Export"); return JSON.parse((await download(p, info, /Vollständige Sicherung/, tag)).toString()).case;
}
export async function excel(p: Page, info: TestInfo, tag: string) {
  await nav(p, "Ergebnis & Export"); const bytes = await download(p, info, /Excel-Arbeitsmappe/, tag);
  const wb = XLSX.read(bytes, { type: "buffer" });
  const sheets = Object.fromEntries(wb.SheetNames.filter(n => ["Fall", "Kapitalbedarfe", "Kapitaltöpfe", "Depot", "Depotübersicht", "Vermögensstruktur"].includes(n) || n.startsWith("Plan"))
    .map(n => [n, { rows: XLSX.utils.sheet_to_json(wb.Sheets[n]), cells: Object.fromEntries(Object.entries(wb.Sheets[n]).filter(([k]) => !k.startsWith("!")).map(([k, v]) => [k, (v as XLSX.CellObject).v])) }]));
  return { sha256: sha(bytes), bytes: bytes.length, sheetNames: wb.SheetNames, sheets };
}
export async function emit(p: Page, info: TestInfo, tag: string, observation: unknown) {
  const path = info.outputPath(`${tag}.json`); const json = JSON.stringify(observation, null, 2);
  await writeFile(path, json); await info.attach(tag, { path, contentType: "application/json" });
  console.log(`F021_EVIDENCE ${tag} ${JSON.stringify(observation)}`);
}
