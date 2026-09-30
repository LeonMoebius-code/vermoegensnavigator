import assert from "node:assert/strict";
import { createCase, normalizeImportedCase, type AdvisoryCase } from "../app/case-model";
import {
  CASE_STORAGE_KEY, RECOVERY_PREFIX, readCaseStore, recoveryBackups, writeCaseStore,
  saveCaseToStore, insertCaseIntoStore, removeCaseFromStore,
} from "../app/case-storage";

class Store {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
const fixture = (id: string): AdvisoryCase => {
  const item = normalizeImportedCase(createCase(), false)!;
  item.id = id;
  item.advisory.caseName = `Synthetischer P1-Fall ${id}`;
  return item;
};
const read = (store: Store) => readCaseStore(store.getItem(CASE_STORAGE_KEY)).cases;
const ids = (cases: AdvisoryCase[]) => cases.map((item) => item.id);
// The existing loader refreshes updatedAt. Compare all other content, including history.
const content = (cases: AdvisoryCase[]) => cases.map(({ updatedAt, ...item }) => item);
function matchesStore(store: Store, result: AdvisoryCase[]) {
  assert.deepEqual(content(result), content(read(store)));
  assert.deepEqual(JSON.parse(JSON.stringify(result)), JSON.parse(store.getItem(CASE_STORAGE_KEY)!));
}
let groups = 0;
function test(name: string, run: () => void) {
  run(); groups++;
  console.log(`PASS P1 ${name}`);
}

test("stale client save retains externally added and edited neighbors, in place", () => {
  const store = new Store();
  writeCaseStore(store, [fixture("A")]);
  const clientA = read(store); // This snapshot stays stale throughout Client B's changes.
  insertCaseIntoStore(store, fixture("B"));
  saveCaseToStore(store, { ...read(store)[0], status: "Abgeschlossen" });
  assert.deepEqual(ids(clientA), ["A"]);
  const result = saveCaseToStore(store, { ...clientA[0], status: "In Prüfung" });
  assert.deepEqual(ids(result), ["B", "A"]);
  assert.equal(result[0].status, "Abgeschlossen");
  assert.equal(result[1].status, "In Prüfung");
  matchesStore(store, result);
});

test("stale client save does not resurrect an externally removed foreign case", () => {
  const store = new Store();
  writeCaseStore(store, [fixture("A"), fixture("B")]);
  const clientA = read(store);
  removeCaseFromStore(store, "B");
  assert.deepEqual(ids(clientA), ["A", "B"]);
  const result = saveCaseToStore(store, { ...clientA[0], status: "In Prüfung" });
  assert.deepEqual(ids(result), ["A"]);
  assert.equal(result[0].status, "In Prüfung");
  matchesStore(store, result);
});

test("new save and P4 import add to the current store without displacing neighbors", () => {
  const store = new Store();
  writeCaseStore(store, [fixture("A")]);
  const clientA = read(store);
  insertCaseIntoStore(store, fixture("B"));
  const result = saveCaseToStore(store, fixture("C"));
  assert.deepEqual(ids(result), ["C", "B", "A"]);
  matchesStore(store, result);
  const imported = normalizeImportedCase(clientA[0])!;
  assert.notEqual(imported.id, "A");
  const inserted = insertCaseIntoStore(store, imported);
  assert.deepEqual(ids(inserted), [imported.id, "C", "B", "A"]);
  assert.deepEqual(imported.plans, clientA[0].plans);
  matchesStore(store, inserted);
  const before = store.getItem(CASE_STORAGE_KEY);
  assert.throws(() => insertCaseIntoStore(store, { ...imported, status: "Abgeschlossen" }));
  assert.equal(store.getItem(CASE_STORAGE_KEY), before);
});

test("stale client delete removes only its requested ID and preserves external additions/deletions", () => {
  const store = new Store();
  writeCaseStore(store, [fixture("A"), fixture("B"), fixture("D")]);
  const clientA = read(store);
  insertCaseIntoStore(store, fixture("C"));
  removeCaseFromStore(store, "D");
  assert.deepEqual(ids(clientA), ["A", "B", "D"]);
  const result = removeCaseFromStore(store, clientA[0].id);
  assert.deepEqual(ids(result), ["C", "B"]);
  matchesStore(store, result);
});

test("delete of a missing healthy ID is idempotent and leaves other content intact", () => {
  const store = new Store();
  writeCaseStore(store, [fixture("B")]);
  const before = content(read(store));
  for (let index = 0; index < 2; index++) {
    const result = removeCaseFromStore(store, "missing");
    assert.deepEqual(content(result), before);
    matchesStore(store, result);
  }
});

test("protected neighbors, future schemas and duplicate/missing original IDs survive all operations", () => {
  const store = new Store();
  const duplicate = fixture("duplicate");
  const protectedEntries = [
    { ...fixture("bad"), plans: [null] },
    { ...fixture("future"), schemaVersion: 12 },
    duplicate, { ...duplicate, status: "In Prüfung" }, { ...fixture("missing"), id: "" },
  ];
  const original = JSON.stringify([...protectedEntries, fixture("A")], null, 2);
  store.setItem(CASE_STORAGE_KEY, original);
  matchesStoreWithProtected(saveCaseToStore(store, { ...fixture("A"), status: "In Prüfung" }));
  matchesStoreWithProtected(insertCaseIntoStore(store, fixture("B")));
  matchesStoreWithProtected(removeCaseFromStore(store, "A"));
  assert.equal(recoveryBackups(store).length, 1);
  assert.equal(recoveryBackups(store)[0].original, original);
  function matchesStoreWithProtected(result: AdvisoryCase[]) {
    const loaded = readCaseStore(store.getItem(CASE_STORAGE_KEY));
    assert.deepEqual(loaded.protectedEntries, JSON.parse(JSON.stringify(protectedEntries)));
    assert.deepEqual(content(result), content(loaded.cases));
  }
  for (const id of ["bad", "future", "duplicate"]) {
    const before = [...store.values];
    assert.throws(() => saveCaseToStore(store, fixture(id)));
    assert.throws(() => insertCaseIntoStore(store, fixture(id)));
    assert.throws(() => removeCaseFromStore(store, id));
    assert.deepEqual([...store.values], before);
  }
});

test("malformed total stores block save, insert and delete with byte-identical originals", () => {
  for (const original of ['{ broken synthetic JSON', '{"synthetic":"not-an-array"}']) {
    const store = new Store();
    store.setItem(CASE_STORAGE_KEY, original);
    assert.throws(() => saveCaseToStore(store, fixture("A")));
    assert.throws(() => insertCaseIntoStore(store, fixture("B")));
    assert.throws(() => removeCaseFromStore(store, "A"));
    assert.deepEqual([...store.values], [[CASE_STORAGE_KEY, original]]);
  }
});

test("verified backup reuse avoids multiplication; new damage requires a new exact backup", () => {
  const store = new Store();
  const bad = { ...fixture("bad"), plans: [null] };
  const original = JSON.stringify([bad, fixture("A")], null, 2);
  store.setItem(CASE_STORAGE_KEY, original);
  store.setItem(`${RECOVERY_PREFIX}existing`, original);
  for (let index = 0; index < 8; index++) saveCaseToStore(store, fixture("A"));
  insertCaseIntoStore(store, fixture("B"));
  removeCaseFromStore(store, "A");
  const set = store.setItem.bind(store);
  store.setItem = (key, value) => {
    if (key !== CASE_STORAGE_KEY) throw new Error("synthetic quota for additional backups");
    set(key, value);
  };
  saveCaseToStore(store, { ...read(store)[0], status: "In Prüfung" });
  store.setItem = set;
  assert.equal(recoveryBackups(store).length, 1);
  assert.equal(recoveryBackups(store)[0].original, original);
  const changed = JSON.stringify([...JSON.parse(store.getItem(CASE_STORAGE_KEY)!), { ...fixture("new-bad"), plans: [null] }], null, 2);
  store.setItem(CASE_STORAGE_KEY, changed);
  saveCaseToStore(store, fixture("B"));
  assert.equal(recoveryBackups(store).length, 2);
  assert.ok(recoveryBackups(store).some((backup) => backup.original === changed));
});

test("backup duplicate multiplicity is verified before reuse", () => {
  const store = new Store(), duplicate = fixture("duplicate");
  const original = JSON.stringify([duplicate, duplicate, fixture("A")]);
  store.setItem(CASE_STORAGE_KEY, original);
  store.setItem(`${RECOVERY_PREFIX}incomplete`, JSON.stringify([duplicate]));
  saveCaseToStore(store, fixture("A"));
  assert.equal(recoveryBackups(store).length, 2);
  assert.ok(recoveryBackups(store).some((backup) => backup.original === original));
});

test("missing IDs, invalid structures and explicit full-replacement duplicates are rejected", () => {
  const store = new Store();
  writeCaseStore(store, [fixture("A")]);
  const before = [...store.values];
  for (const item of [{ ...fixture("bad"), id: "" }, { ...fixture("bad"), id: undefined },
    { ...fixture("bad"), plans: [null] }, { ...fixture("bad"), plans: [] }]) {
    for (const operation of [saveCaseToStore, insertCaseIntoStore]) {
      assert.throws(() => operation(store, item as unknown as AdvisoryCase));
      assert.deepEqual([...store.values], before);
    }
  }
  assert.throws(() => writeCaseStore(store, [fixture("A"), fixture("A")]));
  assert.throws(() => removeCaseFromStore(store, ""));
  assert.deepEqual([...store.values], before);
});

test("backup failures and main-write failures abort each mutation without changing original bytes", () => {
  for (const operation of [
    (store: Store) => saveCaseToStore(store, fixture("A")),
    (store: Store) => insertCaseIntoStore(store, fixture("B")),
    (store: Store) => removeCaseFromStore(store, "A"),
  ]) for (const failure of ["backup-throw", "backup-silent", "main-throw"]) {
    const store = new Store();
    const original = JSON.stringify([{ ...fixture("bad"), plans: [null] }, fixture("A")], null, 2);
    store.setItem(CASE_STORAGE_KEY, original);
    const set = store.setItem.bind(store);
    store.setItem = (key, value) => {
      if (failure === "backup-throw" || key === CASE_STORAGE_KEY) throw new Error("synthetic quota");
      if (failure !== "backup-silent") set(key, value);
    };
    assert.throws(() => operation(store));
    assert.equal(store.getItem(CASE_STORAGE_KEY), original);
    if (failure === "main-throw") assert.equal(recoveryBackups(store)[0].original, original);
  }
});

test("optional-data recovery and depot-value normalization remain available", () => {
  const store = new Store();
  const item = fixture("A");
  item.depotAccounts = [{ id: "depot", name: "Synthetisch", createdAt: item.createdAt, updatedAt: item.updatedAt }];
  item.depot = [{ id: "holding", depotId: "depot", name: "Synthetisch", value: 1000,
    plannedSale: 0, assetClass: "Geldwerte", region: "Weltweit", risk: 2, note: "" }];
  Object.assign(item, normalizeImportedCase(item, false));
  item.advisory.depotValue = 9999;
  const original = JSON.stringify([{ ...item, depot: [{ ...item.depot[0], coupon: "invalid" }] }]);
  store.setItem(CASE_STORAGE_KEY, original);
  assert.equal(readCaseStore(original).recoveryNeeded, true);
  const result = saveCaseToStore(store, item);
  assert.equal(result[0].advisory.depotValue, 1000);
  assert.equal(recoveryBackups(store)[0].original, original);
  matchesStore(store, result);
});

console.log(`P1 case-store contract: ${groups} groups passed; stale snapshots, operations, protected originals and recovery. Schema 11; no atomic cross-tab guarantee.`);
