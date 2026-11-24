import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { calculatePersonalFunding, type PersonYearInput } from "../app/domain/retirement/premium-entitlement";
import { fundingRegisterForCase, readFundingEvidence } from "../app/domain/retirement/premium-funding-input";
import { claimId, claimVersion, deriveFunding, type Booking } from "../app/domain/retirement/premium-funding";
import { historicalReport } from "../app/domain/retirement/premium-document";
import { createPremiumSession, PUBLIC_MODEL_RIGHTS, type PremiumDraft } from "../app/domain/retirement/premium-session";
import { modelCatalog } from "../app/domain/retirement/model-catalog";
import { childCard, assessPreference, type Preference } from "../app/domain/retirement/premium-evidence";
import { calculateCurve, type CurveRequest } from "../app/domain/retirement/premium-series";
import { DEFAULT_INFLATION } from "../app/domain/retirement/premium-price";
import { reference } from "../app/domain/retirement/identity-contract";
import { parseStressLoss, productCurves, productPathKey, selectProductOption, tariffFeature } from "../app/presentation/retirement/premium-product-configuration";
import { emptyProductAnswers, preferenceMatches, products } from "../app/presentation/retirement/product-finder-data";
import { allowedChannels, confirmedTransfer, evidenceB as B, evidenceS as S, fundingFile, personYear, syntheticPremiumWorkspace } from "../tests/browser/avd-r88-fixtures";
import { record, reseal } from "../tests/browser/avd-catalog-fixture";

const window = { from: "2027-01", through: "2029-12", lastFundingYear: null };
const allocation = (component: "base" | "child" | "bonus", contractId: string, cents: number, childId: string | null = null) =>
  ({ component, childId, contractId, cents, evidence: B } as const);

test("D2-T25 and FT-16: original 840 EUR aggregate and independently allocated contract events", () => {
  const open = calculatePersonalFunding([personYear()])[0];
  // 2 × 1,200 = 2,400 eligible, 180 + .25 × 1,440 = 540, max child = 300.
  assert.equal(open.ownCents, 240000);
  assert.equal(open.totalCents, 84000);
  assert.notEqual(open.totalCents, 2 * 69000);
  assert.equal(open.status, "S");
  assert.deepEqual(open.claims.map(c => c.amount?.cents), [54000, 30000, 0]);
  assert.ok(open.claims.every(c => c.parts.length === 0));
  const omitted = readFundingEvidence(fundingFile([personYear()]));
  const out = deriveFunding(omitted.register, window);
  assert.deepEqual(out.perspectives.BEDINGT_KOMBINIERT.payments, []);
  assert.ok(out.perspectives.BEDINGT_KOMBINIERT.issues.some(issue => issue.reason === "ALLOCATION_OPEN"));
  assert.throws(() => calculatePersonalFunding([personYear(), personYear({ personId: "other" })]), /CONTRACT_OWNER_CONFLICT/);

  const person = personYear({ allocations: [allocation("base", "V1", 27000), allocation("base", "V2", 27000),
    allocation("child", "V2", 30000, "K")] });
  const first = confirmedTransfer(person, 27000);
  const path = readFundingEvidence({ ...fundingFile([person], [first]), chosenSchedule: { version: "chosen-v1", firstYear: 2027, lastYear: 2027,
    events: [{ personId: "P", year: 2027, component: "base", childId: null, contractId: "V2", month: "2028-09", cents: 27000, confirmedBookingIds: [first.id] },
      { personId: "P", year: 2027, component: "child", childId: "K", contractId: "V2", month: "2028-10", cents: 30000, confirmedBookingIds: [] }] } });
  assert.deepEqual(deriveFunding(path.register, window).perspectives.BEDINGT_KOMBINIERT.payments.map(e => [e.contractId, e.month, e.cents]),
    [["V1", "2028-08", 27000], ["V2", "2028-09", 27000], ["V2", "2028-10", 30000]]);
});

test("D2-T26: § 90 partner path remains separately evidenced and neutral amounts are independent", () => {
  const base = personYear({ year: 2027, personId: "A", ruleVersion: "alt-bestand-2027-checked-20261028", situation: { value: "direct_old", evidence: B },
    children: [], contracts: [{ id: "R", ownCents: 120000, eligibility: B }] });
  const partner = personYear({ personId: "B", situation: { value: "indirect", evidence: B }, partnerPersonId: "A", children: [],
    contracts: [{ id: "N", ownCents: 120000, eligibility: B }] });
  assert.equal(calculatePersonalFunding([base, partner])[1].totalCents, null);
  const checked: PersonYearInput = { ...partner, partnerReview: { value: "old_direct_new_indirect_excluded", evidence: B } };
  assert.equal(calculatePersonalFunding([checked])[0].totalCents, null);
  const result = calculatePersonalFunding([base, checked]);
  assert.equal(result[1].totalCents, 0);
  assert.equal(result[1].status, "B");
  const book = readFundingEvidence(fundingFile([base, checked]));
  assert.equal(deriveFunding(book.register, window).perspectives.OHNE_ZULAGEN.issues.length, 0);
});

test("D2-T24 and FT-12: transferred child, dated old reversals and annual evidence scope", () => {
  const a = personYear({ personId: "A", year: 2028, ruleVersion: "estg-2028-v1",
    children: [{ ...personYear().children[0], assignedPerson: { value: "A", evidence: B } }],
    allocations: [allocation("child", "V1", 10000, "K"), allocation("child", "V2", 20000, "K")] });
  const old = calculatePersonalFunding([a])[0].claims[1];
  const ledger = old.parts.map((p, i): Booking => ({ id: "old-" + i, externalId: "statement-old-" + i, claim: claimId(old.key), claimVersion: claimVersion(old),
    kind: "grant", contractId: p.contractId, partId: p.id, allocationId: p.allocationId, month: "2029-06", cents: p.cents,
    bookingVersion: "v1", reverses: null, openingInclusion: null, amountEvidence: B }));
  const a2 = { ...a, children: [{ ...a.children[0], assignedPerson: { value: "B", evidence: B } }] };
  const b = personYear({ personId: "B", year: 2028, ruleVersion: "estg-2028-v1",
    contracts: [{ id: "V3", ownCents: 120000, eligibility: B }, { id: "V4", ownCents: 120000, eligibility: B }],
    children: [{ ...a.children[0], assignedPerson: { value: "B", evidence: B }, supersedesPerson: "A" }],
    allocations: [allocation("child", "V3", 15000, "K"), allocation("child", "V4", 15000, "K")] });
  const first = readFundingEvidence(fundingFile([a], ledger));
  const next = { ...fundingFile([a2, b]), chosenSchedule: { version: "next-v1", firstYear: 2028, lastYear: 2028,
    events: ["V3", "V4"].map(contractId => ({ personId: "B", year: 2028, component: "child", childId: "K", contractId,
      month: "2029-10", cents: 15000, confirmedBookingIds: [] })) } };
  const before = readFundingEvidence(next, first);
  const blocked = deriveFunding(before.register, window);
  assert.deepEqual(blocked.perspectives.BEDINGT_KOMBINIERT.payments, ledger);
  assert.ok(blocked.perspectives.BEDINGT_KOMBINIERT.issues.some(i => i.reason === "AUSGLEICH_OFFEN"));
  const reversals = ledger.map(event => ({ ...event, id: "reversal-" + event.id, externalId: "refund-" + event.externalId,
    month: "2029-09", reverses: event.id, cents: -event.cents }));
  const after = deriveFunding(readFundingEvidence({ ...next, bookings: reversals }, before).register, window);
  assert.deepEqual(after.ledger.slice(0, 2), ledger);
  const active = after.perspectives.BEDINGT_KOMBINIERT.payments;
  assert.equal(active.reduce((n, e) => n + e.cents, 0), 30000);
  assert.deepEqual(active.map(e => e.month), ["2029-06", "2029-06", "2029-09", "2029-09", "2029-10", "2029-10"]);
  const unknown = personYear({ year: 2028, ruleVersion: "estg-2028-v1", children: [{ ...personYear().children[0], benefit: null }] });
  assert.equal(calculatePersonalFunding([personYear(), unknown])[1].claims[1].amount, null);
});

test("D2-T30, FT-11 and D3-T84: first proposed bonus cannot recur or equal evidence of prior payment", () => {
  const of = (year: number, prior: "paid" | "not_paid" | null) =>
    personYear({ year, ruleVersion: year === 2027 ? "estg-2027-v1" : "estg-2028-v1",
      bonus: { beforeAgeLimit: { value: "yes", evidence: B }, priorReceipt: prior ? { value: prior, evidence: B } : null } });
  const bonus = (p: ReturnType<typeof calculatePersonalFunding>[number]) => p.claims.find(c => c.key.component === "bonus")!;
  assert.equal(bonus(calculatePersonalFunding([of(2027, null)])[0]).amount, null);
  const next = calculatePersonalFunding([of(2027, "not_paid"), of(2028, "not_paid")]);
  assert.equal(bonus(next[0]).amount?.cents, 20000);
  assert.equal(bonus(next[1]).amount, null);
  const paid = calculatePersonalFunding([of(2027, "not_paid"), of(2028, "paid")]);
  assert.equal(bonus(paid[1]).amount?.cents, 0);
  assert.equal(bonus(paid[0]).key.bonusLifetimeKey, bonus(paid[1]).key.bonusLifetimeKey);
  const future = calculatePersonalFunding([2027, 2028, 2029, 2030, 2031, 2032].map(y => of(y, "not_paid")));
  assert.equal(future.filter(p => bonus(p).amount?.cents === 20000).length, 1);
});

test("FT-08/09: no benefit is distinct from unknown and catalogue goals are unchanged", () => {
  const child = { caseId: "synthetic-case", personId: "P", childId: "K", year: 2027,
    childBenefit: null, assignment: null, contractPath: null, contributionPath: null, inputRevision: "1" };
  assert.equal(childCard(child).status, "O");
  assert.equal(childCard({ ...child, childBenefit: { value: false, evidence: B } }).status, "not_relevant");
});

const scenario = { id: "neutral", scenarioVersion: "v1", valueBasis: "nominal", perspective: "OHNE_ZULAGEN",
  returnEvidence: S, contractId: null, model: { mode: "NEUTRAL", annualBps: 0 } } as const satisfies CurveRequest;
const initial: PremiumDraft = { caseRevision: "case1", price: { mode: "automatic" }, inflation: DEFAULT_INFLATION,
  savings: { caseId: "test-case", openingCents: 100000, openingVersion: "opening-v1", own: [], funding: null, profiles: [],
    timeline: { valuationStart: "2027-01", valuationEnd: "2027-12", contributions: { kind: "holdings_only" }, finalFundingYear: null, payoutStart: null } },
  curves: [scenario] };

function publish(store: ReturnType<typeof createPremiumSession>, draft: PremiumDraft = initial) {
  assert.equal(store.edit(draft.savings.caseId, draft.caseRevision, draft, () => draft).issue, null);
  return store.commit(store.reserve()!)!;
}
function fixed(store: ReturnType<typeof createPremiumSession>) {
  assert.ok(store.commitOperation(store.reserveOperation("fix")!));
}

test("D2-T36 and X03/X13: same profile and one stress loss without M1 or neutral invalidation", () => {
  assert.equal(parseStressLoss("−40 %"), 4000);
  assert.throws(() => parseStressLoss("-101 %"));
  assert.throws(() => parseStressLoss("+40 % Gewinn"));
  const ws = syntheticPremiumWorkspace(), catalog = modelCatalog(ws.catalog, "internal"), path = ws.paths[0];
  const key = productPathKey(path), first = selectProductOption(path, 0);
  const draft = (changes = first) => {
    const parameters = productCurves({ paths: [path], configurations: { [key]: changes }, catalog },
      initial.savings.timeline, initial.savings.caseId, scenario, 600);
    return { ...initial, savings: { ...initial.savings, profiles: parameters.profiles }, curves: [scenario, ...parameters.curves] };
  };
  const session = createPremiumSession({ rights: ws.rights, catalog: ws.catalog, scope: "internal" });
  const a = publish(session, draft());
  const b = publish(session, draft({ ...first, stressLoss: "−40 %", stressMonth: "2027-01" }));
  assert.equal(b.subresults[1].original?.subresultId, a.subresults[1].subresultId);
  assert.equal(b.subresults[2].original?.subresultId, a.subresults[2].subresultId);
  const regular = b.subresults[2].result, stress = b.subresults[3].result;
  assert.ok(regular.status === "computed" && stress.status === "computed");
  assert.deepEqual(regular.value.profileIdentity, stress.value.profileIdentity);
  assert.equal(stress.value.rows.filter(row => "portfolio" in row && row.portfolio?.stress).length, 1);

  const next = publish(session, draft({ ...first, opening: ["40", "60"], version: "weights-v2" }));
  assert.equal(next.subresults[0].original?.subresultId, a.subresults[0].subresultId);
  assert.equal(next.subresults[1].original?.subresultId, a.subresults[1].subresultId);
  assert.equal(next.subresults[2].original, null);
  assert.notDeepEqual(next.subresults[2].result, regular);
});

test("D2-T43: a pending cost or tariff change cannot replace the verified neutral original", () => {
  const ws = syntheticPremiumWorkspace(), path = ws.paths[0], key = productPathKey(path);
  const make = (workspace = ws, configuration = selectProductOption(workspace.paths[0], 0)) => {
    const prepared = productCurves({ paths: workspace.paths, configurations: { [key]: configuration }, catalog: modelCatalog(workspace.catalog, "internal") },
      initial.savings.timeline, initial.savings.caseId, scenario, 600);
    return { ...initial, savings: { ...initial.savings, profiles: prepared.profiles }, curves: [scenario, ...prepared.curves] };
  };
  const store = createPremiumSession({ rights: ws.rights, catalog: ws.catalog, scope: "internal" });
  const draft = make();
  const baseline = publish(store, draft);
  store.edit(initial.savings.caseId, initial.caseRevision, draft, () => draft);
  const reserved = store.reserve()!;
  const catalogChanged = structuredClone(ws.catalog);
  record(catalogChanged, "synthetic-cost-1", "parameter").data.value = { class: "A", value: .042, reason: "Separate cost fixture" };
  store.replaceCatalog(reseal(catalogChanged));
  const updated = store.commit(reserved)!;
  assert.equal(updated.subresults[0].original?.subresultId, baseline.subresults[0].subresultId);
  for (const result of updated.subresults.slice(1).map(s => s.result)) assert.ok(result.status === "O" && result.reason === "PRODUCT_CATALOG_CHANGED");

  store.replaceCatalog(ws.catalog);
  const tariffChanged = structuredClone(ws.catalog);
  record(tariffChanged, "synthetic-tariff-1", "tariff").data.name = "Artificial revised tariff";
  reseal(tariffChanged);
  store.edit(initial.savings.caseId, initial.caseRevision, draft, () => draft);
  const oldTariff = store.reserve()!;
  store.replaceCatalog(tariffChanged);
  const changedTariff = store.commit(oldTariff)!;
  assert.ok(changedTariff.subresults[1].result.status === "O" && changedTariff.subresults[1].result.reason === "PRODUCT_CATALOG_CHANGED");
  assert.equal(changedTariff.subresults[0].original?.subresultId, baseline.subresults[0].subresultId);
  store.replaceCatalog(ws.catalog);

  for (const kind of ["funding", "exposure"] as const) {
    publish(store, draft);
    const old = store.reserve()!;
    const variant = structuredClone(draft);
    if (kind === "funding") {
      variant.curves[1] = { ...variant.curves[1], perspective: "BEDINGT_KOMBINIERT" };
      Object.assign(variant.savings, { funding: readFundingEvidence(fundingFile([personYear()])).register });
    }
    if (kind === "exposure") Object.assign(variant.savings, { profiles: variant.savings.profiles.map(p => ({ ...p,
      positions: p.positions.map(q => ({ ...q, exposure: q.exposure.map(e => ({ ...e, evidence: { ...e.evidence, version: "exposure-v2" } })) })) })) });
    store.edit(initial.savings.caseId, initial.caseRevision, variant, () => variant);
    assert.equal(store.commit(old), null);
    const fresh = store.commit(store.reserve()!)!;
    assert.equal(fresh.subresults[0].original?.subresultId, baseline.subresults[0].subresultId);
    const updated = fresh.subresults[kind === "funding" ? 1 : 2];
    assert.equal(updated.original, null);
    if (kind === "funding") assert.ok(updated.result.status === "computed" && updated.result.value.end.status === "O");
  }
});

test("D2-T46 and D2-T47: real files bind one comparison, reject stale output and preserve archived bytes", async () => {
  const store = createPremiumSession({ rights: allowedChannels, scope: "internal", clock: () => "2026-11-24T12:00:00.000Z" });
  const person = personYear({ children: [], allocations: [allocation("base", "V1", 54000)] });
  const actual = confirmedTransfer(person, 54000, "V1", "2027-08");
  const funded = readFundingEvidence(fundingFile([person], [actual])).register;
  const archivedDraft = { ...initial, savings: { ...initial.savings, funding: funded },
    curves: [{ ...scenario, perspective: "BEDINGT_KOMBINIERT" as const }] };
  const baseline = publish(store, archivedDraft);
  assert.equal(store.reserveOperation("pdf"), null);
  assert.equal(store.reserveOperation("csv"), null);
  fixed(store);
  const oldPDF = store.reserveOperation("pdf")!;
  const oldCSV = store.reserveOperation("csv")!;
  const pdfRun = store.commitDocument(oldPDF);
  const csvRun = store.commitDocument(oldCSV);
  const second = publish(store, archivedDraft);
  assert.notEqual(second.comparisonRevision, baseline.comparisonRevision);
  assert.equal(second.subresults[0].original?.subresultId, baseline.subresults[0].subresultId);
  assert.equal(await pdfRun, null);
  assert.equal(await csvRun, null);
  assert.equal(store.archiveForCase(initial.savings.caseId).length, 0);
  fixed(store);
  const pdf = await store.commitDocument(store.reserveOperation("pdf")!);
  const csv = await store.commitDocument(store.reserveOperation("csv")!);
  assert.ok(pdf && csv);
  const pdfBytes = store.readDocument(pdf.id, initial.savings.caseId)!.bytes;
  const csvBytes = store.readDocument(csv.id, initial.savings.caseId)!.bytes;
  const text = new TextDecoder().decode(csvBytes);
  const doc = await PDFDocument.load(pdfBytes);
  assert.equal(doc.getTitle(), historicalReport);
  assert.equal(doc.getSubject(), second.comparisonRevision);
  assert.equal(doc.getCreationDate()?.toISOString(), pdf.createdAt);
  assert.ok(text.includes(historicalReport) && text.includes(second.comparisonRevision) && text.includes(baseline.comparisonRevision));
  assert.ok(text.includes("Übernommenes Original") && text.includes("1540,00") && text.includes(actual.id));
  const blockedFunding = readFundingEvidence(fundingFile([personYear({
    children: [{ ...personYear().children[0], assignedPerson: null }],
  })])).register;
  const changed = { ...initial, caseRevision: "case2", savings: { ...initial.savings, funding: blockedFunding,
    timeline: { ...initial.savings.timeline, valuationEnd: "2027-11" } },
    curves: [{ ...scenario, perspective: "BEDINGT_KOMBINIERT" as const }] };
  assert.equal(publish(store, changed).complete, false);
  assert.equal(store.reserveOperation("pdf"), null);
  assert.equal(store.reserveOperation("csv"), null);
  assert.deepEqual(store.readDocument(pdf.id, initial.savings.caseId)!.bytes, pdfBytes);
  assert.deepEqual(store.readDocument(csv.id, initial.savings.caseId)!.bytes, csvBytes);
  assert.equal(store.readDocument(pdf.id, "another-case"), null);
  store.replaceRights({ ...allowedChannels, pdf: { allowed: false, version: "revoked" } });
  assert.equal(store.readDocument(pdf.id, initial.savings.caseId), null);
  assert.deepEqual(store.archiveForCase(initial.savings.caseId).map(d => d.channel), ["csv"]);
});

test("D4-T105, X09: download permissions are separate from screen rights and spreadsheet text is escaped", async () => {
  const pub = createPremiumSession({ rights: PUBLIC_MODEL_RIGHTS });
  publish(pub); fixed(pub);
  for (const channel of ["pdf", "csv", "print", "json"] as const) assert.equal(pub.reserveOperation(channel), null);
  const priv = createPremiumSession({ rights: allowedChannels, scope: "internal" });
  publish(priv, { ...initial, curves: [{ ...scenario, label: "=1+1" }] }); fixed(priv);
  const csv = await priv.commitDocument(priv.reserveOperation("csv")!);
  assert.ok(csv);
  assert.ok(new TextDecoder().decode(priv.readDocument(csv.id, initial.savings.caseId)!.bytes).includes('"\'=1+1"'));
});

test("D2-T58–T61, D3-T85 and FT-17–19: hard tariff evidence is time and scope bound", () => {
  const ws = syntheticPremiumWorkspace();
  const source = reference(record(ws.catalog, "synthetic-algorithm", "source"));
  const date = "2027-12-31";
  const fact = (criterion: "fund_plan" | "life_annuity" | "value_protection_only" | "contribution_guarantee", dateRef = date) =>
    ({ criterion, established: true, date: dateRef, source });
  const productFor = (kind: "contribution_guarantee" | "value_protection_target", rate: number, basis: "own_and_grants" | "dated_value") => {
    const raw = structuredClone(ws.catalog);
    const item = record(raw, "synthetic-product-1", "product");
    const example = record(raw, "synthetic-fixed-fee", "parameter");
    const { hash: _, ...rest } = example;
    const parameter = { ...rest, id: "synthetic-guarantee", hash: "", citations: [{ source, locator: "Fixture evidence" }],
      data: { ...example.data, unit: "ratio" as const, value: { class: "B" as const, value: rate, reason: "Fixture guarantee ratio" } } };
    raw.records.push(parameter);
    raw.current.push(reference(parameter));
    item.citations.push({ source, locator: "Fixture guarantee evidence" });
    item.data.guarantee = { kind, rate: reference(parameter), basis, appliesAt: "contract_maturity", referenceDate: kind === "value_protection_target" ? date : null, evidence: source };
    const parsed = reseal(raw);
    return { m: modelCatalog(parsed, "internal"), path: { ...ws.paths[0], facts: [fact("contribution_guarantee")], product: {
      product: reference(record(parsed, "synthetic-product-1", "product")), tariff: reference(record(parsed, "synthetic-tariff-1", "tariff")),
    } } };
  };
  const guarantee = productFor("contribution_guarantee", 1, "own_and_grants");
  const pro = productFor("value_protection_target", .8, "dated_value");
  const guarantee80 = productFor("contribution_guarantee", .8, "own_and_grants");
  const request: Preference = { id: "pref", criterion: "exclude_guarantee", answer: "explicit_requirement", hardness: "explicit_hard",
    revision: "p1", stichtag: date, requirementBasis: "own_and_grants", requiredScope: "contribution_guarantee" };
  const assess = (p: Preference, path: typeof ws.paths[0], model: ReturnType<typeof modelCatalog>,
    current = path.product.tariff.hash) => assessPreference(p, {
    preferenceId: p.id, preferenceRevision: p.revision, tariffId: path.product.tariff.id, productId: path.product.product.id,
    tariffVersion: path.product.tariff.hash, comparisonRevision: "cmp", stichtag: p.stichtag,
    requirementBasis: p.requirementBasis, requiredScope: p.requiredScope, feature: tariffFeature(path, model, p), bankChannel: "open",
  }, current);
  assert.equal(assess({ ...request, answer: "none_required", hardness: "soft" }, guarantee.path, guarantee.m).status, "orientation");
  assert.equal(assess(request, guarantee.path, guarantee.m).status, "B_MISMATCH");
  assert.equal(assess({ ...request, hardness: "revoked", revision: "p2" }, guarantee.path, guarantee.m).status, "orientation");
  const minimum = { ...request, criterion: "minimum_guarantee" as const };
  assert.equal(assess(minimum, pro.path, pro.m).status, "O");
  assert.equal(assess(minimum, { ...pro.path, facts: [fact("value_protection_only")] }, pro.m).status, "B_MISMATCH");
  assert.equal(assess(minimum, guarantee80.path, guarantee80.m).status, "B_MATCH");
  assert.equal(assess(minimum, guarantee80.path, guarantee80.m, "another-tariff-hash").status, "O");
  assert.equal(assess({ ...minimum, stichtag: "2028-12-31" }, guarantee80.path, guarantee80.m).status, "O");
  const payout = { ...request, criterion: "both_payouts_same_tariff" as const, requiredScope: "same_tariff", requirementBasis: "fund_plan_and_life_annuity" };
  const incomplete = { ...guarantee.path, facts: [fact("life_annuity")] };
  assert.equal(assess({ ...payout, answer: "compare", hardness: "soft" }, incomplete, guarantee.m).status, "orientation");
  assert.equal(assess(payout, incomplete, guarantee.m).status, "O");
  const complete = { ...guarantee.path, facts: [fact("life_annuity"), fact("fund_plan")] };
  const paths = assess(payout, complete, guarantee.m);
  assert.equal(paths.status, "B_MATCH");
  assert.equal(paths.bankChannel, "open");
  assert.equal(assess(payout, { ...complete, facts: [fact("life_annuity"), fact("fund_plan", "2026-12-31")] }, guarantee.m).status, "O");
  assert.equal(preferenceMatches(products.find(p => p.id === "garantie")!, { ...emptyProductAnswers, protection: "none" }).protection, null);
  assert.equal(calculateCurve(initial.savings, scenario, null, null).status, "computed");
});
