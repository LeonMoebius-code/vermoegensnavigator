import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { build } from "esbuild";
import type * as Store from "../../app/infrastructure/retirement/avd-indexeddb";
import type * as Fixture from "./avd-p2-fixture";
import type * as Case from "../../app/domain/retirement/avd-case";
import type * as Comparison from "../../app/domain/retirement/avd-comparison";

declare global {
  interface Window {
    AVDP2: typeof Store & typeof Fixture & Pick<typeof Case, "caseRef"> & Pick<typeof Comparison, "catalogRef" | "comparisonRef">;
  }
}

let script: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: [
        'export * from "./app/infrastructure/retirement/avd-indexeddb";',
        'export * from "./tests/browser/avd-p2-fixture";',
        'export {caseRef} from "./app/domain/retirement/avd-case";',
        'export {catalogRef,comparisonRef} from "./app/domain/retirement/avd-comparison";'
      ].join("\n"), resolveDir: process.cwd(), sourcefile: "p2-browser-test.ts"
    },
    bundle: true, write: false, format: "iife", globalName: "AVDP2", platform: "browser", target: "es2022"
  });
  script = result.outputFiles[0].text;
});

const url = "https://avd-p2.test/";
async function install(context: BrowserContext, page: Page) {
  await context.route(url, route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Artificial AVD test</title>" }));
  await page.goto(url);
  await page.addScriptTag({ content: script });
}

test("AVD-P2-IDB browser reload persists case, comparison and originals with separate general storage", async ({ page, context }) => {
  await install(context, page);
  const expected = await page.evaluate(async () => {
    const a = window.AVDP2;
    const { input, catalog } = a.fixture();
    // Synthetic opaque schema-11 and recovery bytes at the same origin.
    localStorage.setItem("vermoegensnavigator-cases-v2", '{"schemaVersion":11,"case":"bytes"}');
    localStorage.setItem("vermoegensnavigator-cases-v2-recovery-synthetic", '{"history":["old-a","old-b"]}');
    const old = JSON.stringify(localStorage);
    const store = await a.openAvdStore();
    try {
      await store.registerCatalog(catalog, null);
      await store.createCase(input);
      const comparison = a.candidate(input, catalog);
      await store.checkCandidate(comparison, a.caseRef(input), null);
      const before = await store.readCurrentComparison(input.case_id);
      if (before.status !== "missing") throw Error(before.status);
      await store.publishComparison(comparison, a.caseRef(input), null);
      return { input, comparison, old };
    } finally { store.close(); }
  });
  await page.reload();
  await page.addScriptTag({ content: script });
  const actual = await page.evaluate(async ({ input, comparison }) => {
    const a = window.AVDP2;
    const store = await a.openAvdStore();
    try {
      return {
        input: await store.readCase(input.case_id),
        current: await store.readCurrentComparison(input.case_id),
        historical: await store.readHistoricalComparison(input.case_id, a.comparisonRef(comparison)),
        old: JSON.stringify(localStorage)
      };
    } finally { store.close(); }
  }, { input: expected.input, comparison: expected.comparison });
  expect(actual.input).toEqual(expected.input);
  expect(actual.current).toMatchObject({ status: "current", comparison: expected.comparison });
  expect(actual.historical).toMatchObject({ status: "historisch_fixiert", comparison: expected.comparison, input: expected.input });
  expect(actual.old).toBe(expected.old);
});

test("AVD-P2-IDB two browser tabs cannot overwrite the same case revision", async ({ page, context }) => {
  await install(context, page);
  const tab = await context.newPage();
  await tab.goto(url);
  await tab.addScriptTag({ content: script });
  const input = await page.evaluate(async () => {
    const a = window.AVDP2, { input, catalog } = a.fixture();
    const store = await a.openAvdStore();
    try { await store.registerCatalog(catalog, null); return await store.createCase(input); }
    finally { store.close(); }
  });
  const read = (p: Page) => p.evaluate(async key => {
    const store = await window.AVDP2.openAvdStore();
    try { return await store.readCase(key); } finally { store.close(); }
  }, input.case_id);
  const views = await Promise.all([read(page), read(tab)]);
  expect(views).toEqual([input, input]);
  const save = (p: Page, extra: number) => p.evaluate(async ({ input, extra }) => {
    const a = window.AVDP2, store = await a.openAvdStore();
    try {
      const next = a.nextCase(input, c => { c.payments[0].amount.value = extra; });
      return { ok: true, result: await store.appendCase(a.caseRef(input), next) };
    } catch (error) { return { ok: false, code: (error as { code: string }).code }; }
    finally { store.close(); }
  }, { input, extra });
  const results = await Promise.all([save(page, 12000), save(tab, 13000)]);
  expect(results.filter(item => item.ok)).toHaveLength(1);
  expect(results.filter(item => !item.ok)).toEqual([{ ok: false, code: "case_conflict" }]);
  expect(await read(page)).toEqual(results.find(item => item.ok)?.result);
  expect(await tab.evaluate(async input => {
    const a = window.AVDP2, store = await a.openAvdStore();
    try { return await store.readCaseRevision(a.caseRef(input)); } finally { store.close(); }
  }, input)).toEqual(input);
});

test("AVD-P2-IDB concurrent publications, case updates and late calculation answers", async ({ page, context }) => {
  await install(context, page);
  const second = await context.newPage();
  await second.goto(url);
  await second.addScriptTag({ content: script });
  const input = await page.evaluate(async () => {
    const a = window.AVDP2, { input, catalog } = a.fixture(), store = await a.openAvdStore();
    try { await store.registerCatalog(catalog, null); return await store.createCase(input); }
    finally { store.close(); }
  });
  const compete = (p: Page, run: string) => p.evaluate(async ({ input, run }) => {
    const a = window.AVDP2, store = await a.openAvdStore();
    try {
      const full = a.candidate(input, a.fixture().catalog, { run });
      return { ok: true, comparison: await store.publishComparison(full, a.caseRef(input), null) };
    } catch (error) { return { ok: false, code: (error as { code: string }).code }; }
    finally { store.close(); }
  }, { input, run });
  const outcomes = await Promise.all([compete(page, "a"), compete(second, "b")]);
  expect(outcomes.filter(item => item.ok)).toHaveLength(1);
  expect(outcomes.filter(item => !item.ok)).toEqual([{ ok: false, code: "comparison_conflict" }]);
  const first = outcomes.find(item => item.ok)?.comparison;
  expect(first).toBeDefined();
  const newInput = await second.evaluate(async input => {
    const a = window.AVDP2, store = await a.openAvdStore();
    try {
      return await store.appendCase(a.caseRef(input), a.nextCase(input, c => {
        c.payments[0].amount.value = 21000;
        c.grants[0].amount.value = 9000;
        c.grants[1].amount.value = 8500;
      }));
    }
    finally { store.close(); }
  }, input);
  const result = await page.evaluate(async ({ input, first, newInput }) => {
    const a = window.AVDP2, store = await a.openAvdStore(), catalog = a.fixture().catalog;
    async function issue(op: () => unknown) {
      try { await op(); return null; } catch (error) { return (error as {code: string}).code; }
    }
    try {
      const late = a.candidate(input, catalog, { previous: first });
      const conflict = await issue(() => store.publishComparison(late, a.caseRef(input), a.comparisonRef(first)));
      const current = await store.readCurrentComparison(input.case_id);
      const exportError = await issue(() => store.checkExport(a.caseRef(newInput), a.comparisonRef(first), false, "capital_projection"));
      const dirty = await issue(() => store.checkExport(a.caseRef(newInput), a.comparisonRef(first), true, "capital_projection"));
      const wrongReuse = a.candidate(newInput, catalog, { previous: first, reuse: "path-2" });
      const reuseError = await issue(() => store.publishComparison(wrongReuse, a.caseRef(newInput), a.comparisonRef(first)));
      const next = a.candidate(newInput, catalog, { previous: first });
      const fresh = await store.publishComparison(next, a.caseRef(newInput), a.comparisonRef(first));
      const unchanged = a.candidate(newInput, catalog, { previous: fresh, reuse: "path-2" });
      const forged = a.mutable(unchanged);
      forged.subresults[7].calculation.calculation_id = "made-up-original";
      forged.subresults[7].calculation = a.seal(forged.subresults[7].calculation);
      const missingOrigin = await issue(() => store.publishComparison(a.seal(forged), a.caseRef(newInput), a.comparisonRef(fresh)));
      const reused = await store.publishComparison(unchanged, a.caseRef(newInput), a.comparisonRef(fresh));
      const historical = await store.readHistoricalComparison(input.case_id, a.comparisonRef(first));
      const synthetic = await issue(() => store.checkExport(a.caseRef(newInput), a.comparisonRef(reused), false, "capital_projection"));
      return { conflict, current, exportError, dirty, fresh, reused, reuseError, historical, synthetic, missingOrigin };
    } finally { store.close(); }
  }, { input, first: first!, newInput });
  expect(result.conflict).toBe("case_conflict");
  expect(result.current).toEqual({ status: "veraltet", case: { case_id: input.case_id, case_revision: 2, hash: newInput.hash },
    comparison: { comparison_revision: 1, hash: first!.hash } });
  expect(result.exportError).toBe("export_not_current");
  expect(result.dirty).toBe("unsaved_changes");
  expect(result.synthetic).toBe("synthetic_export_forbidden");
  expect(result.missingOrigin).toBe("calculation_original_missing_or_changed");
  expect(result.reuseError).toBe("calculation_binding");
  expect(result.fresh.subresults[7].calculation.calculation_id).not.toBe(first!.subresults[7].calculation.calculation_id);
  expect(result.reused.subresults[7].calculation).toEqual(result.fresh.subresults[7].calculation);
  expect(result.historical.comparison).toEqual(first);
});

test("AVD-P2-IDB a catalog update in another tab makes staged results stale", async ({ page, context }) => {
  await install(context, page);
  const setup = await page.evaluate(async () => {
    const a = window.AVDP2, { input, catalog } = a.fixture(true), store = await a.openAvdStore();
    try {
      await store.registerCatalog(catalog, null);
      await store.createCase(input);
      const first = a.candidate(input, catalog);
      await store.publishComparison(first, a.caseRef(input), null);
      return { input, catalog, first };
    } finally { store.close(); }
  });
  const tab = await context.newPage();
  await tab.goto(url);
  await tab.addScriptTag({ content: script });
  await tab.evaluate(async ({ catalog }) => {
    const a = window.AVDP2, store = await a.openAvdStore();
    try { await store.registerCatalog(a.nextCatalog(catalog, true), a.catalogRef(catalog)); }
    finally { store.close(); }
  }, setup);
  const result = await page.evaluate(async ({ input, catalog, first }) => {
    const a = window.AVDP2, store = await a.openAvdStore();
    try {
      const late = a.candidate(input, catalog, { previous: first });
      let code = null;
      try { await store.publishComparison(late, a.caseRef(input), a.comparisonRef(first)); }
      catch (error) { code = (error as { code: string }).code; }
      return { code, active: await store.readCurrentComparison(input.case_id), history: await store.readHistoricalComparison(input.case_id, a.comparisonRef(first)) };
    } finally { store.close(); }
  }, setup);
  expect(result.code).toBe("catalog_conflict");
  expect(result.active.status).toBe("veraltet");
  expect(result.history.comparison).toEqual(setup.first);
});

test("AVD-P2-IDB real abort and constraint error roll back calculations, comparisons and current pointer", async ({ page, context }) => {
  await install(context, page);
  const result = await page.evaluate(async () => {
    const a = window.AVDP2, { input, catalog } = a.fixture(), store = await a.openAvdStore();
    await store.registerCatalog(catalog, null);
    await store.createCase(input);
    const first = a.candidate(input, catalog);
    await store.publishComparison(first, a.caseRef(input), null);
    const next = a.candidate(input, catalog, { previous: first, run: "rollback" });
    const put = IDBObjectStore.prototype.put, add = IDBObjectStore.prototype.add;
    async function attempt() {
      try { await store.publishComparison(next, a.caseRef(input), a.comparisonRef(first)); return "unexpected-success"; }
      catch (error) { return (error as { code: string }).code; }
    }
    let aborted: string, failed: string;
    try {
      IDBObjectStore.prototype.put = function (value, key) {
        const result = put.call(this, value, key);
        if (this.name === "case_heads") this.transaction.abort();
        return result;
      };
      aborted = await attempt();
    } finally { IDBObjectStore.prototype.put = put; }
    try {
      IDBObjectStore.prototype.add = function (value, key) {
        return add.call(this, value, this.name === "comparisons" ? [input.case_id, 1] : key);
      };
      failed = await attempt();
    } finally { IDBObjectStore.prototype.add = add; }
    try {
      const current = await store.readCurrentComparison(input.case_id);
      const historical = await store.readHistoricalComparison(input.case_id, a.comparisonRef(first));
      // Re-submit identical calculation IDs and revision. Any partial row would make this fail.
      const retry = await store.publishComparison(next, a.caseRef(input), a.comparisonRef(first));
      return { aborted, failed, current, historical, first, retry, next };
    } finally { store.close(); }
  });
  expect(result.aborted).toMatch(/^indexeddb_transaction_(aborted|failed)$/);
  expect(result.failed).toBe("indexeddb_transaction_failed");
  expect(result.current).toMatchObject({ status: "current", comparison: result.first });
  expect(result.historical.comparison).toEqual(result.first);
  expect(result.retry).toEqual(result.next);
});

test("AVD-P2-IDB isolated copy, historical restore and damaged history fail closed", async ({ page, context }) => {
  await install(context, page);
  const result = await page.evaluate(async () => {
    const a = window.AVDP2, { input, catalog } = a.fixture(), store = await a.openAvdStore();
    try {
      await store.registerCatalog(catalog, null);
      await store.createCase(input);
      const now = await store.appendCase(a.caseRef(input), a.nextCase(input, c => { c.payments[0].amount.value = 22222; }));
      const change = { changed_at: a.LATEST, changed_by: "tester", change_id: "separate-restore" };
      const independent = await store.copyCase(a.caseRef(input), "independent-case", change);
      const restored = await store.restoreCase(a.caseRef(now), a.caseRef(input), change);
      const source = await store.readCaseRevision(a.caseRef(input));
      let duplicate = null;
      try { await store.createCase(input); } catch (error) { duplicate = (error as {code: string}).code; }
      const badProof = { ...a.caseRef(input), hash: "a".repeat(64) };
      let wrongHash = null;
      try { await store.restoreCase(a.caseRef(restored), badProof, { ...change, change_id: "bad-attempt" }); }
      catch (error) { wrongHash = (error as {code: string}).code; }
      const open = indexedDB.open(a.AVD_DATABASE, 1);
      const raw = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
      });
      try {
        const tx = raw.transaction("cases", "readwrite");
        tx.objectStore("cases").put({ ...input, route: "B" }, [input.case_id, 1]);
        await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
      } finally { raw.close(); }
      let damaged = null;
      try { await store.restoreCase(a.caseRef(restored), a.caseRef(input), { ...change, change_id: "tampered-attempt" }); }
      catch (error) { damaged = (error as {code: string}).code; }
      return { input, now, independent, restored, source, duplicate, wrongHash, damaged,
        current: await store.readCase(input.case_id), copy: await store.readCase(independent.case_id) };
    } finally { store.close(); }
  });
  expect(result.duplicate).toBe("case_id_conflict");
  expect(result.wrongHash).toBe("stored_case_binding");
  expect(result.damaged).toBe("content_hash_mismatch");
  expect(result.independent.case_id).not.toBe(result.input.case_id);
  expect(result.independent.origin).toMatchObject({ kind: "copy", case: { hash: result.input.hash } });
  expect(result.copy).toEqual(result.independent);
  expect(result.source).toEqual(result.input);
  expect(result.current).toEqual(result.restored);
  expect(result.restored).toMatchObject({ case_revision: 3, previous_hash: result.now.hash,
    origin: { kind: "restore", case: { hash: result.input.hash } }, payments: result.input.payments });
});

test("AVD-P2-IDB missing factory and native blocked open fail explicitly", async ({ page, context }) => {
  await install(context, page);
  const results = await page.evaluate(async () => {
    const a = window.AVDP2;
    const store = await a.openAvdStore();
    store.close();
    const open = indexedDB.open(a.AVD_DATABASE, 1);
    const blocker = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
    });
    async function issue(factory: IDBFactory | null) {
      try { (await a.openAvdStore(factory)).close(); return "unexpected-success"; }
      catch (error) { return (error as { code: string }).code; }
    }
    try {
      // A native upgrade blocked by an independent connection without a versionchange handler.
      return [await issue(null), await issue({ open: (name: string) => indexedDB.open(name, 2) } as IDBFactory)];
    } finally { blocker.close(); }
  });
  expect(results).toEqual(["indexeddb_unavailable", "indexeddb_blocked"]);
});

test("AVD-P2-IDB atomic ordering of a comparison publication and case write across tabs", async ({ page, context }) => {
  await install(context, page);
  const second = await context.newPage();
  await second.goto(url);
  await second.addScriptTag({ content: script });
  const starting = await page.evaluate(async () => {
    const a = window.AVDP2, { input, catalog } = a.fixture(), store = await a.openAvdStore();
    try {
      await store.registerCatalog(catalog, null);
      await store.createCase(input);
      return { input, candidate: a.candidate(input, catalog) };
    } finally { store.close(); }
  });
  const pendingPublish = page.evaluate(async ({ input, candidate }) => {
    const a = window.AVDP2, store = await a.openAvdStore();
    try { await store.publishComparison(candidate, a.caseRef(input), null); return "published"; }
    catch (error) { return (error as {code: string}).code; }
    finally { store.close(); }
  }, starting);
  const pendingChange = second.evaluate(async ({ input }) => {
    const a = window.AVDP2, store = await a.openAvdStore();
    try { return await store.appendCase(a.caseRef(input), a.nextCase(input)); } finally { store.close(); }
  }, starting);
  const [publication, changed] = await Promise.all([pendingPublish, pendingChange]);
  expect(changed.case_revision).toBe(2);
  expect(["published", "case_conflict"]).toContain(publication);
  const result = await second.evaluate(async ({ input }) => {
    const a = window.AVDP2, store = await a.openAvdStore();
    try { return await store.readCurrentComparison(input.case_id); } finally { store.close(); }
  }, starting);
  expect(result.status).toBe(publication === "published" ? "veraltet" : "missing");
});

test("AVD-P2-IDB rejects invented blocks under P1 release and leaves no current comparison", async ({ page, context }) => {
  await install(context, page);
  const result = await page.evaluate(async () => {
    const a = window.AVDP2, { input, catalog } = a.exportBoundaryFixture(true, false), store = await a.openAvdStore();
    async function issue(fn: () => Promise<unknown>) {
      try { await fn(); return "accepted"; } catch (error) { return (error as {code: string}).code; }
    }
    try {
      await store.registerCatalog(catalog, null);
      await store.createCase(input);
      const invalid = a.unsupportedBlocks(a.candidate(input, catalog));
      return {
        publish: await issue(() => store.publishComparison(invalid, a.caseRef(input), null)),
        report: await issue(() => store.checkExport(a.caseRef(input), a.comparisonRef(invalid), false, "documented_blocks")),
        state: (await store.readCurrentComparison(input.case_id)).status
      };
    } finally { store.close(); }
  });
  expect(result).toEqual({ publish: "block_proof_mismatch", report: "export_not_current", state: "missing" });
});

test("AVD-P2-IDB evidence change invalidates a verified mixed comparison without changing its original", async ({ page, context }) => {
  await install(context, page);
  const result = await page.evaluate(async () => {
    const a = window.AVDP2, { input, catalog } = a.manualBlockFixture(), store = await a.openAvdStore();
    async function issue(fn: () => Promise<unknown>) {
      try { await fn(); return "accepted"; } catch (error) { return (error as {code: string}).code; }
    }
    try {
      await store.registerCatalog(catalog, null);
      await store.createCase(input);
      const mixed = a.candidate(input, catalog), pointer = a.comparisonRef(mixed);
      await store.publishComparison(mixed, a.caseRef(input), null);
      const active = await store.readCurrentComparison(input.case_id);
      const capital = await issue(() => store.checkExport(a.caseRef(input), pointer, false, "capital_projection"));
      const changed = a.nextCase(input, draft => { draft.evidence[2].proof_id = "new-evidence-revision"; });
      await store.appendCase(a.caseRef(input), changed);
      return { active, capital, now: await store.readCurrentComparison(input.case_id),
        report: await issue(() => store.checkExport(a.caseRef(changed), pointer, false, "documented_blocks")),
        historical: await store.readHistoricalComparison(input.case_id, pointer), mixed };
    } finally { store.close(); }
  });
  expect(result.active).toMatchObject({ status: "current", result_capability: { status: "partially_numeric", numeric: 11, blocked: 1 } });
  expect(result.capital).toBe("synthetic_export_forbidden");
  expect(result.now.status).toBe("veraltet");
  expect(result.report).toBe("export_not_current");
  expect(result.historical.comparison).toEqual(result.mixed);
});

for (const released of [false, true]) {
  test("AVD-P2-IDB export eligibility uses P1 release metadata: " + released, async ({ page, context }) => {
    await install(context, page);
    const result = await page.evaluate(async released => {
      const a = window.AVDP2, { input, catalog } = a.exportBoundaryFixture(released), store = await a.openAvdStore();
      try {
        await store.registerCatalog(catalog, null);
        await store.createCase(input);
        const candidate = a.candidate(input, catalog);
        await store.publishComparison(candidate, a.caseRef(input), null);
        async function check(purpose: "capital_projection" | "documented_blocks") {
          try { return await store.checkExport(a.caseRef(input), a.comparisonRef(candidate), false, purpose); }
          catch (error) { return (error as {code: string}).code; }
        }
        return { capital: await check("capital_projection"), blocked: await check("documented_blocks"),
          current: await store.readCurrentComparison(input.case_id) };
      } finally { store.close(); }
    }, released);
    if (released) {
      expect(result.capital).toBe("export_result_not_eligible");
      expect(result.blocked).toMatchObject({ purpose: "documented_blocks",
        case: { case_revision: 1 }, comparison: { comparison_revision: 1 },
        result_capability: { status: "documented_blocks", numeric: 0, blocked: 12 } });
      expect(result.blocked).not.toHaveProperty("export_id");
    } else expect(result).toMatchObject({ capital: "publication_blocked", blocked: "publication_blocked" });
    expect(result.current).toMatchObject({ status: "current", completeness: "complete",
      result_capability: { status: "documented_blocks", numeric: 0, blocked: 12 } });
  });
}
