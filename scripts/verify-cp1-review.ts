import assert from "node:assert/strict";
import { test } from "node:test";
import { createCase, addDepotAccount, replaceDepotAccount, normalizeImportedCase, ParsedDepotHolding, replacementHoldingIdMap } from "../app/case-model";
import { CASE_STORAGE_KEY, readCaseStore, writeCaseStore, recoveryBackups } from "../app/case-storage";
import { parseDepotCsv } from "../app/depot-csv";
import { classifyDepotProduct } from "../app/depot-analysis";

const csv = (text: string) => parseDepotCsv(new TextEncoder().encode(text).buffer);
const holding = (id: string, extra: Partial<ParsedDepotHolding> = {}): ParsedDepotHolding => ({
  id, name: "Synthetisch", value: 1000, plannedSale: 100, assetClass: "Geldwerte", region: "Weltweit", risk: 2, note: "", ...extra,
});
class Store {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test("CSV retains an unnamed zero-market-value holding with WKN and nominal", () => {
  const rows = csv("Bezeichnung;Kurswert incl. Stückzinsen;WKN;Stück/Nominal\n;0;SYN001;1000").rows;
  assert.equal(rows.length, 1);
  const item = createCase();
  const state = addDepotAccount(item, [holding("old")]);
  const next = replaceDepotAccount(state, state.depotAccounts[0].id, rows);
  assert.equal(next.depot.length, 1);
  assert.equal(next.depot[0].nominalOrUnits, 1000);
  assert.equal(next.advisory.depotValue, 0);
  assert.equal(normalizeImportedCase({ ...item, ...next })!.depot.length, 1);
});

test("CSV rejects quotes embedded in an unquoted required number atomically", () => {
  const state = addDepotAccount(createCase(), [holding("old")]);
  const before = JSON.stringify(state);
  for (const value of ['1"2"3', '"100"0']) {
    assert.throws(() => replaceDepotAccount(state, state.depotAccounts[0].id,
      csv(`Name;Wert\nGut;200\nDefekt;${value}`).rows));
    assert.equal(JSON.stringify(state), before);
  }
  assert.equal(csv('Name;Wert\n"Synthetisch; mit ""Zitat""";"1.234,56"').rows[0].value, 1234.56);
});

test("unchanged corrupt cases do not create a full backup on every save or delete", () => {
  const store = new Store();
  const healthy = createCase();
  const bad = { ...createCase(), id: "broken", plans: [null] };
  const original = JSON.stringify([bad, healthy]);
  store.setItem(CASE_STORAGE_KEY, original);
  for (let index = 0; index < 8; index++) {
    const loaded = readCaseStore(store.getItem(CASE_STORAGE_KEY));
    writeCaseStore(store, loaded.cases.map((item) => ({ ...item, status: index % 2 ? "Entwurf" : "In Prüfung" })));
  }
  writeCaseStore(store, []);
  assert.deepEqual(JSON.parse(store.getItem(CASE_STORAGE_KEY)!), [bad]);
  assert.equal(recoveryBackups(store).length, 1);
  assert.equal(recoveryBackups(store)[0].original, original);
});

test("malformed collection containers remain recoverable alongside healthy cases", () => {
  for (const field of ["depot", "depotAccounts", "versions", "savingsGoals"] as const) {
    const store = new Store();
    const healthy = createCase();
    const bad = { ...createCase(), id: `bad-${field}`, [field]: { lost: "synthetic-original" } };
    const original = JSON.stringify([bad, healthy]);
    store.setItem(CASE_STORAGE_KEY, original);
    const loaded = readCaseStore(original);
    assert.deepEqual(loaded.cases.map((item) => item.id), [healthy.id], field);
    assert.deepEqual(loaded.protectedEntries, [bad], field);
    writeCaseStore(store, loaded.cases);
    writeCaseStore(store, []);
    assert.deepEqual(JSON.parse(store.getItem(CASE_STORAGE_KEY)!), [bad]);
    assert.ok(recoveryBackups(store).some((backup) => backup.original === original));
  }
});

test("duplicate case IDs are rejected before a write makes both cases unloadable", () => {
  const store = new Store();
  const item = createCase();
  writeCaseStore(store, [item]);
  const original = store.getItem(CASE_STORAGE_KEY);
  assert.throws(() => writeCaseStore(store, [item, { ...item, status: "In Prüfung" }]));
  assert.equal(store.getItem(CASE_STORAGE_KEY), original);
});

test("duplicated depot account IDs cannot make replacement touch two physical depots", () => {
  const item = createCase();
  const state = addDepotAccount(item, [holding("a")]);
  const invalid = { ...item, ...state, depotAccounts: [...state.depotAccounts, { ...state.depotAccounts[0], name: "Anderes Depot" }] };
  assert.equal(normalizeImportedCase(invalid, false), null);
});

test("name veto includes certificates and stripped bonds with a fixed source type", () => {
  for (const name of ["Synthetisches Zertifikat", "Synthetic Certificate", "Synthetic Stripped Bond", "Synthetische Stufenzinsanleihe", "Synthetische Nachranganleihe"]) {
    assert.notEqual(classifyDepotProduct({ securityType: "Festverzinsliche", name }).bondKind, "fixed", name);
  }
});

test("replacement cannot turn an original ID conflict into a name match after ID repair", () => {
  const item = createCase();
  const state = addDepotAccount(item, [holding("a", { wkn: "AAAAAA" }), holding("b", { name: "Zweiter Titel" })]);
  state.plans[0].depotHoldingIds = ["a", "b"];
  const parsed = [holding("a", { wkn: "BBBBBB", name: "Zweiter Titel" })];
  const next = replaceDepotAccount(state, state.depotAccounts[0].id, parsed);
  // The known ID refers to A, whose WKN contradicts B. Do not reinterpret it as b.
  assert.deepEqual(next.plans[0].depotHoldingIds, []);
  assert.equal(next.depot[0].plannedSale, 0);
  assert.equal(replacementHoldingIdMap(state.depot, parsed.map((row) => ({ ...row, depotId: state.depotAccounts[0].id }))).size, 0);
});

test("duplicate import IDs must still count towards WKN ambiguity", () => {
  const state = addDepotAccount(createCase(), [holding("old", { wkn: "AAAAAA" })]);
  state.plans[0].depotHoldingIds = ["old"];
  const rows = [holding("duplicate", { wkn: "AAAAAA" }), holding("duplicate", { wkn: "AAAAAA" }), holding("unique", { wkn: "AAAAAA" })];
  assert.equal(replacementHoldingIdMap(state.depot, rows.map((row) => ({ ...row, depotId: state.depotAccounts[0].id }))).size, 0);
  const next = replaceDepotAccount(state, state.depotAccounts[0].id, rows);
  assert.deepEqual(next.plans[0].depotHoldingIds, []);
  assert.ok(next.depot.every((row) => row.plannedSale === 0));
  assert.equal(new Set(next.depot.map((row) => row.id)).size, 3);
});

test("combined source classification preserves the supported bare Geldmarkt enum", () => {
  const rows = csv("Bezeichnung;Kurswert incl. Stückzinsen;Wertpapiertyp\nSynthetisch;1000;Geldmarkt").rows;
  assert.equal(classifyDepotProduct(rows[0]).sub, "Geldmarktfonds");
  assert.equal(classifyDepotProduct(rows[0]).direct, false);
});

test("storage preserves duplicate original IDs, future schemas, and new damaged payloads", () => {
  const store = new Store();
  const healthy = createCase();
  const duplicate = { ...createCase(), id: "duplicate" };
  const future = { ...createCase(), id: "future", schemaVersion: 999 };
  const original = JSON.stringify([duplicate, { ...duplicate, status: "In Prüfung" }, future, healthy]);
  store.setItem(CASE_STORAGE_KEY, original);
  const loaded = readCaseStore(original);
  assert.deepEqual(loaded.cases.map((item) => item.id), [healthy.id]);
  assert.equal(loaded.protectedEntries.length, 3);
  writeCaseStore(store, loaded.cases);
  assert.throws(() => writeCaseStore(store, [duplicate]));
  const newBad = { ...createCase(), id: "new-bad", plans: [null] };
  const changedOriginal = JSON.stringify([...JSON.parse(store.getItem(CASE_STORAGE_KEY)!), newBad]);
  store.setItem(CASE_STORAGE_KEY, changedOriginal);
  writeCaseStore(store, []);
  const backups = recoveryBackups(store);
  assert.equal(backups.length, 2);
  assert.ok(backups.some((backup) => backup.original === original));
  assert.ok(backups.some((backup) => backup.original === changedOriginal));
  assert.deepEqual(JSON.parse(store.getItem(CASE_STORAGE_KEY)!), [...loaded.protectedEntries, newBad]);
});

test("backup verification and main-write quota failures preserve the original", () => {
  for (const failure of ["backup-throw", "backup-silent", "main-throw"]) {
    const store = new Store();
    const healthy = createCase();
    const bad = { ...createCase(), id: "bad", plans: [null] };
    const original = JSON.stringify([bad, healthy]);
    store.setItem(CASE_STORAGE_KEY, original);
    const failing = {
      get length() { return store.length; }, key: (index: number) => store.key(index),
      getItem: (key: string) => store.getItem(key),
      setItem: (key: string, value: string) => {
        if (key === CASE_STORAGE_KEY || failure === "backup-throw") throw new Error("quota");
        if (failure !== "backup-silent") store.setItem(key, value);
      },
    };
    assert.throws(() => writeCaseStore(failing, [healthy]), failure);
    assert.equal(store.getItem(CASE_STORAGE_KEY), original, failure);
    if (failure === "main-throw") assert.equal(recoveryBackups(store)[0].original, original);
  }
});

test("a verified recovery copy allows later healthy saves when no more backups fit", () => {
  const store = new Store();
  const healthy = createCase();
  store.setItem(CASE_STORAGE_KEY, JSON.stringify([{ ...createCase(), id: "bad", plans: [null] }, healthy]));
  writeCaseStore(store, [healthy]);
  const limited = {
    get length() { return store.length; }, key: (index: number) => store.key(index),
    getItem: (key: string) => store.getItem(key),
    setItem: (key: string, value: string) => {
      if (key !== CASE_STORAGE_KEY) throw new Error("no room for redundant backups");
      store.setItem(key, value);
    },
  };
  writeCaseStore(limited, [{ ...healthy, status: "In Prüfung" }]);
  assert.equal(readCaseStore(store.getItem(CASE_STORAGE_KEY)).cases[0].status, "In Prüfung");
  assert.equal(recoveryBackups(store).length, 1);
});
