import assert from "node:assert/strict";
import {
  addDepotAccount, createCase, deleteDepotAccount, normalizeImportedCase,
  replaceDepotAccount, setCaseDepot, type AdvisoryCase,
} from "../app/case-model";
import {
  CASE_STORAGE_KEY, insertCaseIntoStore, readCaseStore, recoveryBackups,
  saveCaseToStore, writeCaseStore,
} from "../app/case-storage";

// Explicit, invented identities and contents; no real customer/bank/depot data.
function fixture(id = "p2-case-a"): AdvisoryCase {
  const item = createCase();
  item.id = id;
  item.advisory.caseName = "Synthetischer P2-Fall";
  item.depotAccounts = ["p2-depot-a", "p2-depot-b"].map((id, index) => ({
    id, name: `Synthetisches Depot ${index + 1}`, createdAt: item.createdAt, updatedAt: item.createdAt,
  }));
  item.depot = [1000, 2000, 3000].map((value, index) => ({
    id: `p2-holding-${index + 1}`, depotId: index === 0 ? "p2-depot-a" : "p2-depot-b",
    name: `Synthetische Position ${index + 1}`, value, plannedSale: 100,
    assetClass: "Substanzwerte", region: "Weltweit", risk: 3, note: "Synthetisch",
    classificationStatus: "mapped", excludeFromBondAggregates: false,
  }));
  item.plans[0].depotHoldingIds = ["p2-holding-1", "p2-holding-3"];
  return item;
}
class Store {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
let groups = 0;
function test(name: string, run: () => void) {
  run(); groups++;
  console.log(`PASS P2 ${name}`);
}
function rejectedWithoutMutation(source: unknown) {
  const before = JSON.stringify(source);
  assert.equal(normalizeImportedCase(source, false), null);
  assert.equal(normalizeImportedCase({ case: source }), null, "JSON backup import also rejects corruption");
  assert.equal(JSON.stringify(source), before, "Rejected input stays intact: no reassignment/deletion");
}

test("valid schema 10/11 multi-depot identities, holding contents and plan selections stay intact", () => {
  for (const schemaVersion of [10, 11]) {
    const source = { ...fixture(), schemaVersion }, before = JSON.stringify(source);
    const loaded = normalizeImportedCase(source, false);
    assert.ok(loaded);
    assert.equal(loaded.schemaVersion, 11);
    assert.deepEqual(loaded.depotAccounts, source.depotAccounts);
    assert.deepEqual(JSON.parse(JSON.stringify(loaded.depot)), source.depot, "All persisted holding contents stay intact");
    assert.deepEqual(loaded.plans[0].depotHoldingIds, ["p2-holding-1", "p2-holding-3"]);
    assert.equal(loaded.advisory.depotValue, 6000);
    assert.equal(JSON.stringify(source), before);
  }
});

test("schema 10/11 reject missing, empty, dangling and non-string depot references", () => {
  for (const schemaVersion of [10, 11]) {
    for (const depotId of [undefined, "", "missing-depot", null, 17, {}, []]) {
      const source = { ...fixture(), schemaVersion };
      const invalid = { ...source.depot[2], depotId };
      if (depotId === undefined) Reflect.deleteProperty(invalid, "depotId");
      rejectedWithoutMutation({ ...source, depot: [...source.depot.slice(0, 2), invalid] });
    }
    for (const depotAccounts of [[], undefined])
      rejectedWithoutMutation({ ...fixture(), schemaVersion, depotAccounts });
  }
});

test("schema 9 without accounts migrates all historical holdings into exactly one new depot", () => {
  for (const depotAccounts of [undefined, []]) {
    const source = { ...fixture(), schemaVersion: 9, depotAccounts,
      depot: fixture().depot.map(({ depotId, ...holding }, index) =>
        index === 0 ? holding : { ...holding, depotId: index === 1 ? "" : "old-unusable-depot" }),
    };
    const before = JSON.stringify(source), loaded = normalizeImportedCase(source, false);
    assert.ok(loaded);
    assert.equal(loaded.schemaVersion, 11);
    assert.equal(loaded.depotAccounts.length, 1);
    assert.equal(loaded.depotAccounts[0].name, "Depot 1");
    assert.ok(loaded.depotAccounts[0].id);
    assert.deepEqual(loaded.depot.map((h) => h.depotId), Array(3).fill(loaded.depotAccounts[0].id));
    assert.deepEqual(loaded.depot.map((h) => h.id), ["p2-holding-1", "p2-holding-2", "p2-holding-3"]);
    assert.deepEqual(loaded.depot.map((h) => [h.value, h.plannedSale]), [[1000, 100], [2000, 100], [3000, 100]]);
    assert.deepEqual(loaded.plans[0].depotHoldingIds, ["p2-holding-1", "p2-holding-3"]);
    assert.equal(loaded.advisory.depotValue, 6000);
    assert.equal(JSON.stringify(source), before);
  }
});

test("legacy with existing accounts preserves valid references and rejects invented assignments", () => {
  const source = { ...fixture(), schemaVersion: 9 }, before = JSON.stringify(source);
  const loaded = normalizeImportedCase(source, false);
  assert.ok(loaded);
  assert.deepEqual(loaded.depotAccounts, source.depotAccounts);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded.depot)), source.depot);
  assert.equal(JSON.stringify(source), before);
  for (const depotId of [undefined, "", "missing-depot"])
    rejectedWithoutMutation({ ...source, depot: [{ ...source.depot[0], depotId }, ...source.depot.slice(1)] });
});

test("empty schema 9/10/11 remains empty without a synthetic depot", () => {
  for (const schemaVersion of [9, 10, 11]) {
    const source = { ...createCase(), schemaVersion }, before = JSON.stringify(source);
    const loaded = normalizeImportedCase(source, false);
    assert.ok(loaded);
    assert.deepEqual(loaded.depot, []);
    assert.deepEqual(loaded.depotAccounts, []);
    assert.equal(JSON.stringify(source), before);
  }
});

test("read protects dangling schema 11 originals while a healthy neighbor stays readable", () => {
  const healthy = fixture(), bad = fixture("p2-case-b");
  bad.depot[2].depotId = "missing-depot";
  const original = JSON.stringify([bad, healthy], null, 2), loaded = readCaseStore(original);
  assert.deepEqual(loaded.cases.map((c) => c.id), [healthy.id]);
  assert.equal(loaded.malformed, false);
  assert.equal(loaded.recoveryNeeded, true);
  assert.equal(loaded.original, original);
  assert.deepEqual(loaded.protectedEntries, [bad]);
  assert.deepEqual(loaded.recoveryEntries, [bad]);
  const store = new Store(); store.setItem(CASE_STORAGE_KEY, original);
  for (let index = 0; index < 3; index++) {
    const saved = saveCaseToStore(store, { ...healthy, status: "In Prüfung" });
    assert.deepEqual(saved.map((c) => c.id), [healthy.id]);
    assert.equal(saved[0].status, "In Prüfung");
    const reread = readCaseStore(store.getItem(CASE_STORAGE_KEY));
    assert.deepEqual(reread.protectedEntries, [bad]);
    assert.deepEqual(reread.recoveryEntries, [bad]);
    assert.deepEqual(JSON.parse(store.getItem(CASE_STORAGE_KEY)!).find((c: AdvisoryCase) => c.id === bad.id), bad);
    assert.equal(recoveryBackups(store).length, 1, "No redundant backups after healthy edits");
    assert.equal(recoveryBackups(store)[0].original, original, "Byte-exact original backup is retained/reused");
  }
});

test("save, insert and full write reject corrupt candidates before any store/backup mutation", () => {
  const healthy = fixture(), protectedCase = fixture("p2-protected");
  protectedCase.depot[0].depotId = "missing-depot";
  for (const recovery of [false, true]) {
    const store = new Store();
    store.setItem(CASE_STORAGE_KEY, JSON.stringify(recovery ? [protectedCase, healthy] : [healthy], null, 2));
    const before = [...store.values];
    for (const depotId of ["", "missing-depot"]) {
      const bad = fixture("p2-new-invalid"); bad.depot[2].depotId = depotId;
      for (const operation of [saveCaseToStore, insertCaseIntoStore]) {
        assert.throws(() => operation(store, bad));
        assert.deepEqual([...store.values], before);
      }
      assert.throws(() => saveCaseToStore(store, { ...bad, id: healthy.id }));
      assert.throws(() => writeCaseStore(store, [healthy, bad]));
      assert.deepEqual([...store.values], before);
    }
  }
});

test("normal depot lifecycle calls preserve referential integrity", () => {
  let item = fixture();
  const { depotId: unused, ...parsed } = item.depot[0];
  item = { ...item, ...addDepotAccount(item, [{ ...parsed, id: "p2-added" }], "Synthetischer Import") };
  assert.ok(normalizeImportedCase(item, false));
  item = { ...item, ...replaceDepotAccount(item, "p2-depot-b", [{ ...parsed, id: "p2-replacement" }]) };
  assert.ok(normalizeImportedCase(item, false));
  assert.deepEqual(replaceDepotAccount(item, "missing-depot", [parsed]), item);
  item = setCaseDepot(item, item.depot.map((h) => ({ ...h, plannedSale: 0 })));
  assert.ok(normalizeImportedCase(item, false));
  item = { ...item, ...deleteDepotAccount(item, "p2-depot-b") };
  assert.ok(normalizeImportedCase(item, false));
  assert.ok(!item.depot.some((h) => h.depotId === "p2-depot-b"));
});

console.log(`P2 depot-integrity contract: ${groups} groups passed; schema 10/11 strict, schema 9 migration, immutable inputs, P1 recovery and write rejection. Schema remains 11.`);
