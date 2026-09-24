import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isValidElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as XLSX from "xlsx";
import { addDepotAccount, AdvisoryCase, caseSnapshot, depotAssetAmounts, depotPlanAssetAmounts,
  duplicateStructurePlan, normalizeImportedCase, replaceDepotAccount } from "../app/case-model";
import { buildDepotAnalysisPositions, concentrationMetrics } from "../app/depot-analysis";
import { buildBondIstExportData } from "../app/bond-analysis-data";
import { CASE_STORAGE_KEY, readCaseStore, recoveryBackups, writeCaseStore } from "../app/case-storage";
import { ExportCenter } from "../app/page";
import { AS_OF, ambiguous, annual, blocked, bondCase, emptyCase, holding, multiCase, now, stub } from "./cp0a2-fixtures";
import { categories, cent, compare, exact, Ids, memoryStorage, Reference, Rule } from "./cp0a2-contract";

XLSX.set_fs(fs);
function button(node: ReactNode, label: string, within?: string): (() => void) | undefined {
  if (Array.isArray(node)) return node.map((n) => button(n, label, within)).find(Boolean);
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return undefined;
  if (within && node.type === "article" && renderToStaticMarkup(node).includes(within)) return button(node, label);
  return !within && node.type === "button" && renderToStaticMarkup(node).includes(label) ? node.props.onClick : button(node.props.children, label, within);
}
function view(c: AdvisoryCase, setItem: (item: AdvisoryCase) => void = () => {}) {
  return ExportCenter({ item: c, preferredPlan: c.plans.find((p) => p.preferred)!, setItem: (next) => setItem(typeof next === "function" ? next(c) : next),
    saveCase: () => {}, exportJson: () => {}, importJson: () => {} });
}
function register(ids: Ids, c: AdvisoryCase) {
  ids.entity("CASE", c.id);
  c.depotAccounts.forEach((d) => ids.entity("DEPOT", d.id));
  c.depot.forEach((h) => ids.entity("HOLDING", h.id));
  c.plans.forEach((p) => {
    ids.entity("PLAN", p.id);
    p.allocations.forEach((a) => ids.entity("ALLOCATION", a.id));
    p.investmentPlans.forEach((i) => ids.entity("INVESTMENT", i.id));
  });
}
function identities(ids: Ids, c: AdvisoryCase) {
  return {
    case: ids.ref("CASE", c.id), active: ids.ref("PLAN", c.activePlanId),
    depots: c.depotAccounts.map((d) => ids.ref("DEPOT", d.id)),
    holdings: c.depot.map((h) => [ids.ref("HOLDING", h.id), ids.ref("DEPOT", h.depotId)]),
    plans: c.plans.map((p) => [ids.ref("PLAN", p.id), p.preferred, p.depotHoldingIds.map((id) => ids.ref("HOLDING", id))]),
  };
}

function runReferences() {
  const results: { reference: Reference; actual: Record<string, unknown>; rules: Record<string, Rule> }[] = [];
  const record = (reference: Reference, actual: Record<string, unknown>, expected: Record<string, unknown>, rules: Record<string, Rule> = {}) => {
    assert.ok(categories[reference.category] && reference.invariant && reference.evidence && reference.relevance);
    assert.ok(!results.some((r) => r.reference.id === reference.id), "Unique reference IDs");
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), reference.id);
    for (const field of Object.keys(rules)) assert.ok(field in expected, `Unused rule ${field}`);
    for (const field of Object.keys(expected)) compare(actual[field], expected[field], rules[field] || exact,
      `[${reference.category}] ${reference.id}.${field}: ${reference.relevance}`);
    results.push({ reference, actual, rules });
  };
  const ref = (id: string, category: Reference["category"], invariant: string, evidence: string, relevance: string): Reference =>
    ({ id, category, invariant, evidence, relevance });
  const c = multiCase(), ids = new Ids(); register(ids, c);
  const before = JSON.stringify(c), ist = buildDepotAnalysisPositions(c.depot, c.plans[0], "ist");
  const economic = concentrationMetrics(ist);
  record(ref("multi-depot", "A", "Physische Identität bleibt trotz wirtschaftlicher Aggregation getrennt",
    "scripts/verify-multi-depot.ts: C/D/U", "Verschmelzen von Holdings oder Depotverlust"), {
    identities: identities(ids, c), count: ist.length, economicCount: economic.count, largest: economic.largest?.value,
    depotValue: c.advisory.depotValue, sum: c.depot.reduce((sum, h) => sum + h.value, 0),
    dates: ist.map((p) => p.valuationEnd), currencies: ist.map((p) => p.currency),
  }, {
    identities: { case: "CASE_1", active: "PLAN_1", depots: ["DEPOT_1", "DEPOT_2"],
      holdings: [["HOLDING_1", "DEPOT_1"], ["HOLDING_2", "DEPOT_2"], ["HOLDING_3", "DEPOT_2"]],
      plans: [["PLAN_1", false, ["HOLDING_1", "HOLDING_2", "HOLDING_3"]], ["PLAN_2", true, ["HOLDING_1"]]] },
    count: 3, economicCount: 2, largest: 16000, depotValue: 20000, sum: 20000,
    dates: ["2026-01-01", "2026-01-01", "2026-01-01"], currencies: ["EUR", "EUR", "EUR"],
  }, { largest: cent, depotValue: cent, sum: cent });
  const positions = (plan: AdvisoryCase["plans"][number], state: "ist" | "plan") =>
    buildDepotAnalysisPositions(c.depot, plan, state).map((p) => [
      p.source === "holding" ? ids.ref("HOLDING", p.id) : ids.purchase(p.id), p.source, p.value]);
  record(ref("ist-plan", "A", "IST unverändert, Teilverkauf, Vollverkauf und Kauf ohne Doppelzählung",
    "scripts/verify-multi-depot.ts; scripts/verify-asset-classification.tsx", "Falscher Bestand oder Verwechslung aktiv/bevorzugt"), {
    ist: positions(c.plans[0], "ist"), plan: positions(c.plans[0], "plan"), preferred: positions(c.plans[1], "plan"),
    total: depotPlanAssetAmounts(c.depot, c.plans[0]).total,
    active: ids.ref("PLAN", c.activePlanId), preferredId: ids.ref("PLAN", c.plans.find((p) => p.preferred)!.id),
  }, { ist: [["HOLDING_1", "holding", 10000], ["HOLDING_2", "holding", 6000], ["HOLDING_3", "holding", 4000]],
    plan: [["HOLDING_1", "holding", 7500], ["HOLDING_3", "holding", 4000], ["purchase-ALLOCATION_1", "planned-purchase", 3000]],
    preferred: [["HOLDING_1", "holding", 7500], ["HOLDING_3", "holding", 4000]],
    total: 14500, active: "PLAN_1", preferredId: "PLAN_2" }, { total: cent });
  const unknownIst = depotAssetAmounts(c.depot), unknownPlan = depotPlanAssetAmounts(c.depot, c.plans[0]);
  record(ref("unknown-lookthrough", "A", "Unbekanntes bleibt im Nenner und wird nicht bekannten Klassen zugeschlagen",
    "scripts/verify-asset-classification.tsx: unresolved IST/PLAN", "Künstliche Normalisierung oder Verlust unbekannter Anteile"), {
    status: c.depot[2].classificationStatus, istUnknown: unknownIst.unresolved, istKnown: unknownIst.amounts.Substanzwerte,
    planUnknown: unknownPlan.unresolved, planKnown: unknownPlan.amounts.Substanzwerte,
    otherKnown: Object.entries(unknownPlan.amounts).filter(([k]) => k !== "Substanzwerte").map(([, v]) => v),
  }, { status: "unresolved", istUnknown: 4000, istKnown: 16000, planUnknown: 7000, planKnown: 7500, otherKnown: [0, 0, 0, 0] },
  { istUnknown: cent, istKnown: cent, planUnknown: cent, planKnown: cent });
  assert.equal(JSON.stringify(c), before, "Analysis must not mutate physical IST, selections or identities");

  for (const [name, rows, expectedSales, expectedSelection] of [
    ["unique", [holding("replacement", 12000, { wkn: "ZZCP01" })], [2500], ["HOLDING_4", "HOLDING_2", "HOLDING_3"]],
    ["conflicting", [holding("synthetic-a", 12000, { wkn: "ZZDIFF" })], [0], ["HOLDING_2", "HOLDING_3"]],
    ["ambiguous", [holding("new-1", 6000, { wkn: "ZZCP01" }), holding("new-2", 6000, { wkn: "ZZCP01" })], [0, 0], ["HOLDING_2", "HOLDING_3"]],
  ] as const) {
    const r = { ...c, ...replaceDepotAccount(c, c.depotAccounts[0].id, [...rows]) };
    const ri = new Ids(); register(ri, c); register(ri, r);
    record(ref(`replacement-${name}`, "A", "Nur belastbares depotlokales 1:1-Matching überträgt Referenzen und Verkäufe",
      "scripts/verify-multi-depot.ts: Replacement; scripts/verify-cp4.tsx", "Unberechtigte Referenz- oder Verkaufsübernahme"), {
      sales: r.depot.filter((h) => h.depotId === c.depotAccounts[0].id).map((h) => h.plannedSale),
      selection: r.plans[0].depotHoldingIds.map((id) => ri.ref("HOLDING", id)),
      otherDepot: r.depot.filter((h) => h.depotId === c.depotAccounts[1].id).map((h) => [ri.ref("HOLDING", h.id), h.value]),
    }, { sales: expectedSales, selection: expectedSelection, otherDepot: [["HOLDING_2", 6000], ["HOLDING_3", 4000]] });
  }
  const sourcePlan: AdvisoryCase["plans"][number] = { ...c.plans[0], investmentPlans: [{
    id: "synthetic-investment", type: "phased", allocationId: c.plans[0].allocations[0].id,
    capitalPotId: "strategic", stagedMode: "percent", stagedValue: 50, installments: 2,
    frequency: "monthly", startDate: "2026-10-01", note: "",
  }] };
  register(ids, { ...c, plans: [sourcePlan] });
  const copiedPlan = duplicateStructurePlan(sourcePlan);
  const copiedCase = { ...c, plans: [...c.plans, copiedPlan] }; register(ids, copiedCase);
  record(ref("generated-plan-allocation", "A", "Plankopie erhält neue Plan- und Allokationsidentitäten",
    "scripts/verify-modelportfolio.ts: duplicateStructurePlan", "Aliasbildung zwischen Varianten"), {
    plan: ids.ref("PLAN", copiedPlan.id), allocation: ids.ref("ALLOCATION", copiedPlan.allocations[0].id),
    purchase: ids.purchase(buildDepotAnalysisPositions([], copiedPlan, "plan")[0].id), preferred: copiedPlan.preferred,
    investment: ids.ref("INVESTMENT", copiedPlan.investmentPlans[0].id),
    allocationRef: copiedPlan.investmentPlans[0].type === "phased" ? ids.ref("ALLOCATION", copiedPlan.investmentPlans[0].allocationId) : null,
    startDate: copiedPlan.investmentPlans[0].startDate,
  }, { plan: "PLAN_3", allocation: "ALLOCATION_2", purchase: "purchase-ALLOCATION_2", preferred: false,
    investment: "INVESTMENT_2", allocationRef: "ALLOCATION_2", startDate: "2026-10-01" });

  // Every numeric tolerance is explicit for this metric AND fixture, copied from
  // the matching verify-bond-final case. Coverage/counts/statuses remain exact.
  const bondReferences = [
    { id: "annual", row: annual(), model: "identified", valuationDate: "2026-12-27", maturity: "2027-01-01", stubStart: null, ytm: .05, modified: .01304631441617743, dv01: .013819852588150074, ytmTolerance: 1e-8, modifiedTolerance: 1e-8, dv01Tolerance: 1e-8 },
    { id: "ambiguous-annual", row: ambiguous(), model: "ambiguous", valuationDate: "2026-01-01", maturity: "2027-01-01", stubStart: null, ytm: .06, modified: .9433962264150944, dv01: .9433962264150944, ytmTolerance: 1e-8, modifiedTolerance: 1e-8, dv01Tolerance: 1e-8 },
    { id: "short-first", row: stub(), model: "short-first-annual", valuationDate: "2026-09-18", maturity: "2032-01-27", stubStart: "2026-05-27", ytm: .04497385868331072, modified: 4.641896780274053, dv01: .9240948853266179, ytmTolerance: 1e-8, modifiedTolerance: 1e-8, dv01Tolerance: 1e-8 },
  ];
  for (const b of bondReferences) {
    const bc = bondCase(b.row), data = buildBondIstExportData(bc.depot, bc.plans[0], bc.depotAccounts, now());
    const m = data.analysis.rows[0].metrics;
    const bi = new Ids(); register(bi, bc);
    const tolerance = (value: number): Rule => ({ kind: "absolute", tolerance: value, evidence: `scripts/verify-bond-final.tsx: ${b.id}` });
    record(ref(`bond-${b.id}`, "A", "Bestehendes indikatives Modell, Kennzahlen und volle Coverage",
      "scripts/verify-bond-final.tsx: Decimal70/annual baseline/short first period", "Numerische oder Modellqualitätsänderung"), {
      model: m.model?.modelStatus, frequency: m.model?.selectedFrequency, ytm: m.ytm.value, modified: m.modified.value,
      dv01: m.dv01.value, status: m.ytm.status, reason: m.ytm.reasonCode ?? null, eligible: m.aggregateEligible,
      currency: m.dv01Currency, coverage: data.analysis.ytmCoverage, inclusion: data.analysis.inclusion(data.analysis.rows[0], "ytm"),
      quality: bc.depot[0].bondSource?.quality,
      valuationDate: m.valuationDate, maturity: bc.depot[0].maturity, stubStart: m.model?.shortFirstAnnual?.stubStart ?? null,
      holding: bi.ref("HOLDING", data.analysis.rows[0].position.id), depot: bi.ref("DEPOT", data.analysis.rows[0].position.depotId!),
      durationStatus: m.modified.status, durationReason: m.modified.reasonCode ?? null, dv01Status: m.dv01.status, dv01Reason: m.dv01.reasonCode ?? null,
    }, { model: b.model, frequency: 1, ytm: b.ytm, modified: b.modified, dv01: b.dv01, status: "calculable",
      reason: null, eligible: true, currency: "EUR", coverage: 1, inclusion: "includedAndCalculable", quality: "empirically-supported",
      valuationDate: b.valuationDate, maturity: b.maturity, stubStart: b.stubStart,
      holding: "HOLDING_1", depot: "DEPOT_1", durationStatus: "calculable", durationReason: null, dv01Status: "calculable", dv01Reason: null },
    { ytm: tolerance(b.ytmTolerance), modified: tolerance(b.modifiedTolerance), dv01: tolerance(b.dv01Tolerance) });
  }
  const blockedCase = bondCase(blocked());
  const blockedData = buildBondIstExportData(blockedCase.depot, blockedCase.plans[0], blockedCase.depotAccounts, now());
  const bm = blockedData.analysis.rows[0].metrics;
  record(ref("bond-blocked", "A", "Doppelwährungsstruktur erhält keine erfundene YTM, Duration oder DV01",
    "scripts/verify-bond-final.tsx: dual currency", "Unzulässige Modellierung"), {
    model: bm.model, ytm: bm.ytm, modified: bm.modified, dv01: bm.dv01, eligible: bm.aggregateEligible,
    coverage: blockedData.analysis.ytmCoverage, inclusion: blockedData.analysis.inclusion(blockedData.analysis.rows[0], "ytm"),
  }, { model: null, ytm: { value: null, status: "unsupported-structure", reasonCode: "unsupported-cashflows" },
    modified: { value: null, status: "unsupported-structure", reasonCode: "unsupported-cashflows" },
    dv01: { value: null, status: "unsupported-structure", reasonCode: "unsupported-cashflows" },
    eligible: false, coverage: 0, inclusion: "notCalculable" });
  const excluded = bondCase(ambiguous()); excluded.depot[0].excludeFromBondAggregates = true;
  const ex = buildBondIstExportData(excluded.depot, excluded.plans[0], excluded.depotAccounts, now()).analysis;
  record(ref("bond-excluded", "A", "Manueller Ausschluss bleibt getrennt von Nichtberechenbarkeit",
    "scripts/verify-cp3.tsx: disjoint coverage", "Geschönte Coverage durch verkleinerten Nenner"), {
    coverage: ex.ytmCoverage, aggregateBasis: ex.coverages.ytm.basisEUR, fullValue: ex.directValueEUR, excluded: ex.coverages.ytm.manuallyExcluded,
    inclusion: ex.inclusion(ex.rows[0], "ytm"), status: ex.rows[0].metrics.ytm.status, aggregate: ex.portfolioDv01,
  }, { coverage: 0, aggregateBasis: 0, fullValue: 10000, excluded: { count: 1, valueEUR: 10000 }, inclusion: "manuallyExcluded", status: "calculable", aggregate: null }, { aggregateBasis: cent, fullValue: cent });

  for (const schema of [11, 9, 6]) {
    const source = { ...c, schemaVersion: schema, ...(schema < 10 ? { depotAccounts: undefined } : {}),
      plans: c.plans.map((p) => ({ ...p, depotMode: "retain", depotHoldingIds: schema < 7 ? [] : p.depotHoldingIds })) };
    const loaded = readCaseStore(JSON.stringify([source])); assert.equal(loaded.cases.length, 1);
    const n = loaded.cases[0], ni = new Ids();
    // Preserve old entities in the same registry, even when migration creates a depot.
    register(ni, c); register(ni, n);
    record(ref(`schema-${schema}`, "A", "Unterstützte Strukturen normalisieren zu Schema 11 unter Identitätserhalt",
      "scripts/verify-multi-depot.ts: schema 9; scripts/verify-4b.ts: legacy retain; scripts/verify-cp3.tsx: store",
      "Datenverlust oder veränderte historische Migration"), {
      schema: n.schemaVersion, case: ni.ref("CASE", n.id), createdAt: n.createdAt,
      depotIds: n.depotAccounts.map((d) => ni.ref("DEPOT", d.id)),
      holdingDepots: n.depot.map((h) => ni.ref("DEPOT", h.depotId)),
      holdings: n.depot.map((h) => ni.ref("HOLDING", h.id)), selection: n.plans[0].depotHoldingIds.map((id) => ni.ref("HOLDING", id)),
      recovery: loaded.recoveryNeeded, protected: loaded.protectedEntries.length, malformed: loaded.malformed, value: n.advisory.depotValue,
    }, { schema: 11, case: "CASE_1", createdAt: AS_OF,
      depotIds: schema === 11 ? ["DEPOT_1", "DEPOT_2"] : ["DEPOT_3"],
      holdingDepots: schema === 11 ? ["DEPOT_1", "DEPOT_2", "DEPOT_2"] : ["DEPOT_3", "DEPOT_3", "DEPOT_3"],
      holdings: ["HOLDING_1", "HOLDING_2", "HOLDING_3"], selection: ["HOLDING_1", "HOLDING_2", "HOLDING_3"],
      recovery: false, protected: 0, malformed: false, value: 20000 }, { value: cent });
  }
  const future = { ...emptyCase(), schemaVersion: 12 }, storage = memoryStorage();
  const raw = JSON.stringify([future]); storage.setItem(CASE_STORAGE_KEY, raw);
  const futureRead = readCaseStore(raw); writeCaseStore(storage, [c]);
  record(ref("future-schema-recovery", "A", "Unbekanntes Schema bleibt geschützt und Original bytegenau gesichert",
    "scripts/verify-cp1-review.ts; scripts/verify-cp3.tsx", "Vorwärtsdaten überschrieben oder Recovery verloren"), {
    imported: normalizeImportedCase(future, false), cases: futureRead.cases.length, protected: futureRead.protectedEntries.length,
    recovery: futureRead.recoveryNeeded, malformed: futureRead.malformed,
    originalPreserved: JSON.stringify(JSON.parse(storage.getItem(CASE_STORAGE_KEY)!).find((v: AdvisoryCase) => v.id === future.id)) === JSON.stringify(future),
    backups: recoveryBackups(storage).map((b) => b.original === raw),
  }, { imported: null, cases: 0, protected: 1, recovery: true, malformed: false, originalPreserved: true, backups: [true] });
  const imported = normalizeImportedCase(c)!; register(ids, imported);
  record(ref("import-copy", "B", "JSON-Kopie generiert Fall-ID neu, innere Identitäten bleiben aktuell erhalten",
    "app/case-model.ts: normalizeImportedCase(regenerateId=true)", "Änderung der technisch beobachteten Kopiersemantik untersuchen"), {
    case: ids.ref("CASE", imported.id), active: ids.ref("PLAN", imported.activePlanId),
    holdings: imported.depot.map((h) => ids.ref("HOLDING", h.id)),
  }, { case: "CASE_2", active: "PLAN_1", holdings: ["HOLDING_1", "HOLDING_2", "HOLDING_3"] });

  const invalid = normalizeImportedCase({ ...c, depot: c.depot.map((h, i) => i === 2 ? { ...h, depotId: "missing-depot" } : h) }, false)!;
  record(ref("invalid-depot-fallback", "C", "Bekannter Fehler: ungültige Depotreferenz fällt auf erstes Depot zurück",
    "README.md: CP0A1 bekannte Befunde", "Fehler sichtbar halten; nicht als korrekten Reparaturvertrag verwenden"), {
    before: ids.ref("DEPOT", "missing-depot"), after: ids.ref("DEPOT", invalid.depot[2].depotId),
  }, { before: "DANGLING_DEPOT_1", after: "DEPOT_1" });
  const weak = normalizeImportedCase({ ...c, activePlanId: "missing-plan", plans: c.plans.map((p) => ({ ...p, id: c.plans[0].id, preferred: true })) }, false)!;
  record(ref("weak-plan-integrity", "C", "Bekannter Befund: doppelte IDs, ungültige aktive ID und mehrere bevorzugte Pläne passieren",
    "README.md: CP0A1 Planidentitäten", "Kein fachlich gültiger Auswahlzustand"), {
    ids: weak.plans.map((p) => ids.ref("PLAN", p.id)), active: ids.ref("PLAN", weak.activePlanId), preferredCount: weak.plans.filter((p) => p.preferred).length,
  }, { ids: ["PLAN_1", "PLAN_1"], active: "DANGLING_PLAN_1", preferredCount: 2 });
  const stale = memoryStorage(), second = emptyCase(); register(ids, second);
  writeCaseStore(stale, [c, second]); writeCaseStore(stale, [c]);
  record(ref("stale-local-list", "C", "Bekannter Fehler: veraltete Liste verdrängt zwischenzeitlich gespeicherten gesunden Fall",
    "README.md: CP0A1 veraltete Fallliste", "Nicht als zulässige Konfliktauflösung festschreiben"), {
    saved: readCaseStore(stale.getItem(CASE_STORAGE_KEY)).cases.map((x) => ids.ref("CASE", x.id)),
  }, { saved: ["CASE_1"] });
  const original = multiCase();
  original.advisory.caseName = "Synthetischer historischer Inhalt";
  const historical = caseSnapshot(original);
  original.advisory.caseName = "Synthetischer aktueller Ursprungsfall";
  original.plans[0].name = "Synthetischer aktueller Plan";
  original.versions = [
    { id: "synthetic-version-old", label: "Synthetische ältere Historie", createdAt: AS_OF, snapshot: historical },
    { id: "synthetic-version-new", label: "Synthetische neuere Historie", createdAt: AS_OF, snapshot: caseSnapshot(original) },
  ];
  const copy = normalizeImportedCase(JSON.parse(JSON.stringify({ case: original })))!;
  assert.ok(copy);
  assert.notEqual(copy.id, original.id, "JSON import must create a separate case");
  copy.advisory.caseName = "Synthetische bearbeitete Kopie";
  copy.updatedAt = AS_OF;
  const originalBefore = JSON.stringify(original), copyBefore = JSON.stringify(copy);
  const historyBefore = JSON.stringify(copy.versions);
  const restoreIds = new Ids(); register(restoreIds, original); register(restoreIds, copy);
  const store = memoryStorage(); writeCaseStore(store, [original, copy]);
  const originalLoadedBefore = readCaseStore(store.getItem(CASE_STORAGE_KEY)).cases.find((x) => x.id === original.id)!;
  let restored: AdvisoryCase | undefined;
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: { confirm: () => true } });
    const restore = button(view(copy, (next) => { restored = next; }), "Wiederherstellen", "Synthetische ältere Historie");
    assert.ok(restore);
    const restoreStarted = Date.now(); restore(); const restoreFinished = Date.now();
    assert.ok(restored);
    assert.equal(restoreIds.ref("CASE", restored.id), "CASE_2", "restore-id: restore must retain the current copy identity");
    assert.equal(JSON.stringify(restored.versions), historyBefore, "Restore must retain the entire current history");
    // Compare all normalized historical fields, including inner identities, except current case metadata.
    const { id: snapshotId, updatedAt: snapshotUpdatedAt, versions: snapshotVersions, ...snapshotContent } = normalizeImportedCase(historical, false)!;
    const { id: restoredId, updatedAt: restoredUpdatedAt, versions: restoredVersions, ...restoredContent } = restored;
    assert.deepEqual(restoredContent, snapshotContent, "Restore must recover the complete historical content");
    assert.notEqual(restoredUpdatedAt, copy.updatedAt);
    assert.notEqual(restoredUpdatedAt, historical.updatedAt);
    assert.ok(Date.parse(restoredUpdatedAt) >= restoreStarted && Date.parse(restoredUpdatedAt) <= restoreFinished, "updatedAt must be the restore time");
    assert.equal(JSON.stringify(original), originalBefore, "Restore must not mutate the original");
    assert.equal(JSON.stringify(copy), copyBefore, "Restore must not mutate the input or its snapshots");
    writeCaseStore(store, [original, restored]);
    const loaded = readCaseStore(store.getItem(CASE_STORAGE_KEY));
    assert.equal(loaded.cases.length, 2);
    assert.equal(loaded.recoveryNeeded, false);
    assert.equal(loaded.protectedEntries.length, 0);
    const savedOriginal = loaded.cases.find((x) => x.id === original.id)!;
    const savedCopy = loaded.cases.find((x) => x.id === copy.id)!;
    assert.ok(savedOriginal); assert.ok(savedCopy);
    assert.deepEqual({ ...savedOriginal, updatedAt: AS_OF }, { ...originalLoadedBefore, updatedAt: AS_OF }, "Reloaded original must remain unchanged");
    assert.equal(JSON.stringify(JSON.parse(store.getItem(CASE_STORAGE_KEY)!).find((x: AdvisoryCase) => x.id === original.id)), originalBefore, "Stored original must not be overwritten");
    assert.deepEqual({ ...savedCopy, updatedAt: AS_OF }, { ...restored, updatedAt: AS_OF }, "Reload must retain restored content and history");
    record(ref("restore-id", "A", "Historischer Restore stellt Snapshotinhalt wieder her, erhält die aktuelle Fallidentität und verhindert Kollisionen mit dem Ursprung",
      "Restore-ID-Bugfix-Auftrag; app/page.tsx: ExportCenter.restoreVersion", "Identitätswechsel, Historienverlust oder Überschreiben des Ursprungsfalls"), {
      original: restoreIds.ref("CASE", original.id), copy: restoreIds.ref("CASE", copy.id),
      snapshot: restoreIds.ref("CASE", copy.versions[0].snapshot.id), restored: restoreIds.ref("CASE", restored.id),
      saved: loaded.cases.map((x) => restoreIds.ref("CASE", x.id)).sort(),
      historyCount: savedCopy.versions.length, historicalName: savedCopy.advisory.caseName,
      originalName: savedOriginal.advisory.caseName,
    }, { original: "CASE_1", copy: "CASE_2", snapshot: "CASE_1", restored: "CASE_2", saved: ["CASE_1", "CASE_2"],
      historyCount: 2, historicalName: "Synthetischer historischer Inhalt", originalName: "Synthetischer aktueller Ursprungsfall" });
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
  }

  const report = bondCase(annual()); report.depot[0].plannedSale = report.depot[0].value;
  const reportView = view(report), markup = renderToStaticMarkup(reportView);
  const cwd = process.cwd(), dir = mkdtempSync(join(tmpdir(), "vn-cp0a2-"));
  try {
    process.chdir(dir);
    const exportButton = button(reportView, "Excel-Arbeitsmappe"); assert.ok(exportButton); exportButton();
    const wb = XLSX.read(readFileSync("cp0a2-synthetic.xlsx"), { type: "buffer" });
    const sheet = wb.Sheets["Zins & Laufzeiten"], sheetIndex = wb.SheetNames.indexOf("Zins & Laufzeiten");
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    const cell = (label: string, column: number) => {
      const row = rows.findIndex((r) => r[0] === label); assert.ok(row >= 0, label);
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      return { value: cell.v, type: cell.t, formula: cell.f ?? null };
    };
    const formulaText = Object.values(sheet).find((cell) => cell?.v === "=1+1"); assert.ok(formulaText);
    const depotSheet = wb.Sheets.Depot;
    const depotRows = XLSX.utils.sheet_to_json<unknown[]>(depotSheet, { header: 1 });
    const valueColumn = depotRows[0].indexOf("Wert"); assert.ok(valueColumn >= 0);
    const numericValue = depotSheet[XLSX.utils.encode_cell({ r: 1, c: valueColumn })];
    record(ref("bond-ist-xlsx-print", "A", "Export bleibt IST trotz Vollverkauf; bestätigte Zellen, Typen und Druckwerte",
      "scripts/verify-cp3.tsx: actual IST workbook; scripts/verify-bond-final.tsx: Excel/print", "PLAN-Leak, Formelinterpretation oder fachlich falsche Darstellung"), {
      sheets: wb.SheetNames.slice(sheetIndex, sheetIndex + 2), title: { value: sheet.A1.v, type: sheet.A1.t, formula: sheet.A1.f ?? null },
      ytm: cell("Indikative Rendite bis Fälligkeit", 1), duration: cell("Modified Duration", 1), dv01: cell("Portfolio-DV01", 1),
      formulaText: { value: formulaText.v, type: formulaText.t, formula: formulaText.f ?? null },
      rawDepotValue: { value: numericValue.v, type: numericValue.t, formula: numericValue.f ?? null },
      formulas: [sheet, wb.Sheets["Technische Nachweise"]].flatMap((s) => Object.values(s)).filter((cell) => cell?.f).length,
      printValues: ["Zins &amp; Laufzeiten – IST", "5,00 %", "0,01 Jahre", "0,01 EUR", "10.592,92 EUR"].map((v) => markup.includes(v)),
      printOrder: markup.indexOf("Zinsszenarien") < markup.indexOf("Fälligkeitsübersicht"),
    }, { sheets: ["Zins & Laufzeiten", "Technische Nachweise"], title: { value: "Zins & Laufzeiten – IST (physischer Bestand)", type: "s", formula: null },
      ytm: { value: "5,00 %", type: "s", formula: null }, duration: { value: "0,01 Jahre", type: "s", formula: null },
      dv01: { value: "0,01 EUR", type: "s", formula: null }, formulaText: { value: "=1+1", type: "s", formula: null },
      rawDepotValue: { value: 10592.917767817604, type: "n", formula: null },
      formulas: 0, printValues: [true, true, true, true, true], printOrder: true });
    const general = multiCase(); button(view(general), "Excel-Arbeitsmappe")!();
    const generalWb = XLSX.read(readFileSync("cp0a2-synthetic.xlsx"), { type: "buffer" });
    const structure = XLSX.utils.sheet_to_json<{ Betrag: number }>(generalWb.Sheets.Vermögensstruktur);
    record(ref("general-export-scope", "D", "Offen: Neuanlagen oder vollständiger ZIELPLAN; heute bevorzugte Variante ohne Käufe",
      "Auftrag CP0A2 §4; scripts/verify-asset-classification.tsx dokumentiert Neuanlagen", "Abweichung benötigt Fachentscheidung, keine automatische Rückkehr"), {
      structureTotal: structure.reduce((sum, row) => sum + row.Betrag, 0),
      preferredPlanTotal: depotPlanAssetAmounts(general.depot, general.plans[1]).total,
    }, { structureTotal: 0, preferredPlanTotal: 11500 }, { structureTotal: cent, preferredPlanTotal: cent });
  } finally { process.chdir(cwd); rmSync(dir, { recursive: true }); }
  return results;
}

// Contract self-checks protect against adapters hiding precisely the regressions
// this baseline must detect (rewired references, duplicate IDs, sub-cent drift).
const ids = new Ids();
assert.equal(ids.entity("CASE", "random-a"), "CASE_1");
assert.equal(ids.entity("CASE", "random-b"), "CASE_2");
assert.equal(ids.entity("CASE", "random-a"), "CASE_1");
assert.equal(ids.ref("CASE", "random-a"), "CASE_1");
assert.notEqual(ids.ref("CASE", "missing-a"), ids.ref("CASE", "missing-b"));
assert.throws(() => compare(ids.ref("CASE", "random-b"), "CASE_1", exact, "rewire"));
assert.throws(() => compare(1.001, 1, cent, "sub-cent drift"));
assert.throws(() => compare(null, 0, { kind: "absolute", tolerance: 1e-8, evidence: "self-check" }, "null != zero"));
assert.throws(() => compare(NaN, 0, { kind: "absolute", tolerance: 1e-8, evidence: "self-check" }, "finite"));
const first = runReferences(), second = runReferences();
assert.deepEqual(second, first, "Independent cases with newly generated identities must have identical canonical references");
assert.deepEqual([...new Set(first.map((r) => r.reference.category))].sort(), ["A", "B", "C", "D"]);
assert.deepEqual(Object.fromEntries(Object.keys(categories).map((category) => [category, first.filter((r) => r.reference.category === category).length])),
  { A: 18, B: 1, C: 3, D: 1 });
assert.deepEqual(first.filter((r) => r.reference.category === "C").map((r) => r.reference.id).sort(),
  ["invalid-depot-fallback", "stale-local-list", "weak-plan-integrity"]);
for (const { reference } of first) console.log(`PASS CP0A2 [${reference.category}] ${reference.id}: ${categories[reference.category]}`);
console.log(`CP0A2: ${first.length} references, two independent runs, synthetic data only. C reproduces known bugs; D makes no business decision.`);
