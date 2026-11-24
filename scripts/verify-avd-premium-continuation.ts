import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { calculatePersonalFunding, type PersonYearInput } from "../app/domain/retirement/premium-entitlement";
import { fundingRegisterForCase, readFundingEvidence } from "../app/domain/retirement/premium-funding-input";
import { claimId, claimVersion, childYearKey, deriveFunding, settlementReference, type Booking } from "../app/domain/retirement/premium-funding";
import { historicalReport, renderPremiumDocument } from "../app/domain/retirement/premium-document";
import { createPremiumSession, PUBLIC_MODEL_RIGHTS, type PremiumDraft } from "../app/domain/retirement/premium-session";
import { modelCatalog } from "../app/domain/retirement/model-catalog";
import { childCard, assessPreference, type Preference } from "../app/domain/retirement/premium-evidence";
import { calculateCurve, productStressDifference, stressEndDifference, type CurveRequest } from "../app/domain/retirement/premium-series";
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

test("N1-01 / D2-T24 / D4-T89–T91: transferred child needs a renewed matured selection", () => {
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
  const throughJanuary = { ...window, through: "2030-01" };
  for (const month of ["2029-09", "2029-10", "2029-12"]) {
    const reversals = ledger.map(event => ({ ...event, id: "reversal-" + event.id, externalId: "refund-" + event.externalId,
      month, reverses: event.id, cents: -event.cents }));
    const partial = readFundingEvidence({ ...next, bookings: [reversals[0]] }, before);
    const derive = (input: ReturnType<typeof readFundingEvidence>) => deriveFunding(input.register, throughJanuary);
    assert.ok(derive(partial).perspectives.BEDINGT_KOMBINIERT.issues.some(i => i.reason === "AUSGLEICH_OFFEN"));
    const submitted = readFundingEvidence({ ...next, bookings: reversals }, partial);
    const expected = [...ledger, ...reversals];
    const after = derive(submitted);
    assert.deepEqual(after.ledger, expected);
    assert.deepEqual(after.perspectives.BEDINGT_KOMBINIERT.payments, expected);
    assert.equal(expected.reduce((n, e) => n + e.cents, 0), 0);
    assert.ok(after.perspectives.BEDINGT_KOMBINIERT.issues.some(i => i.reason === "CLAIM_REMAINDER_OPEN"));
    assert.notEqual(submitted.register.registerVersion, before.register.registerVersion);
    assert.deepEqual(derive(readFundingEvidence({ ...next, bookings: reversals }, submitted)), after);
    const renew = (selectedMonth: string, version: string) => ({ ...next, chosenSchedule: { ...next.chosenSchedule, version,
      events: next.chosenSchedule.events.map(event => ({ ...event, month: selectedMonth, confirmedBookingIds: expected.map(e => e.id) })) } });
    assert.throws(() => readFundingEvidence(renew(month, "next-v1"), submitted), /SCHEDULE_VERSION_REUSED/);
    for (const tooEarly of ["2029-08", month])
      assert.deepEqual(derive(readFundingEvidence(renew(tooEarly, "early-" + tooEarly), submitted)).perspectives.BEDINGT_KOMBINIERT.payments, expected);
    const renewed = readFundingEvidence(renew("2030-01", "next-v2"), submitted);
    assert.deepEqual(derive(renewed).perspectives.BEDINGT_KOMBINIERT.payments.slice(4).map(e => [e.contractId, e.month, e.cents]),
      [["V3", "2030-01", 15000], ["V4", "2030-01", 15000]]);
    assert.notEqual(renewed.register.registerVersion, submitted.register.registerVersion);
    const successor = calculatePersonalFunding([b])[0].claims[1];
    const actual = successor.parts.map((p, i): Booking => ({ ...ledger[i], id: "new-" + i, externalId: "new-statement-" + i,
      claim: claimId(successor.key), claimVersion: claimVersion(successor), contractId: p.contractId, partId: p.id, allocationId: p.allocationId,
      month: "2030-01", cents: p.cents }));
    assert.deepEqual(derive(readFundingEvidence({ ...next, bookings: actual }, renewed)).perspectives.BEDINGT_KOMBINIERT.payments, [...expected, ...actual]);
  }
  const settlements = ledger.map(e => ({ oldBookingId: e.id, childYearKey: childYearKey(old.key)!, month: "2029-07", evidence: B }));
  const disjoint = readFundingEvidence({ ...next, settlements }, before);
  assert.deepEqual(deriveFunding(disjoint.register, window).perspectives.BEDINGT_KOMBINIERT.payments, ledger);
  const newPlan = { ...next, chosenSchedule: { ...next.chosenSchedule, version: "disjoint-v2",
    events: next.chosenSchedule.events.map(event => ({ ...event,
      confirmedBookingIds: [...ledger.map(e => e.id), ...settlements.map(settlementReference)] })) } };
  assert.equal(deriveFunding(readFundingEvidence(newPlan, disjoint).register, window).perspectives.BEDINGT_KOMBINIERT.payments.length, 4);
});

test("FT-12: first entitlement period in 2027, last in 2028, adult child and open benefit year", () => {
  // Synthetic reviewed fact pattern. Two eligible, unmarried recipients in both years.
  // A is awarded Jan–Jun, B Jul–Dec. K turns 18 in July 2028 and child benefit continues.
  const periods = [{ months: "01–06", person: "A" }, { months: "07–12", person: "B" }];
  const p = (year: 2027 | 2028, personId: string, known = true) => {
    const award = year === 2027 ? periods[0] : periods[1];
    const evidence = { ...B, source: year === 2027 ? "synthetic reviewed first period" : "synthetic reviewed last period",
      version: String(year) + "-" + award.person };
    return personYear({ year, personId, ruleVersion: year === 2027 ? "estg-2027-v1" : "estg-2028-v1",
      contracts: [{ id: "V-" + personId, ownCents: 120000, eligibility: B }],
      children: [{ id: "K", benefit: known ? { value: "yes", evidence } : null,
        assignedPerson: known ? { value: award.person, evidence } : null, supersedesPerson: null }],
      allocations: [allocation("base", "V-" + personId, 39000),
        ...(known && award.person === personId ? [allocation("child", "V-" + personId, 30000, "K")] : [])] });
  };
  const people = [p(2027, "A"), p(2027, "B"), p(2028, "A"), p(2028, "B")];
  const child = calculatePersonalFunding(people).flatMap(r => r.claims.filter(c => c.key.component === "child"));
  assert.deepEqual(child.map(c => [c.key.personId, c.key.year, c.regimeVersion, c.amount?.cents]),
    [["A", 2027, "estg-2027-v1", 30000], ["B", 2028, "estg-2028-v1", 30000]]);
  const first = child[0], part = first.parts[0];
  const booked: Booking = { ...confirmedTransfer(people[0], 39000, "V-A"), claim: claimId(first.key), claimVersion: claimVersion(first),
    id: "FT12-B", externalId: "FT12-proof", month: "2028-06", partId: part.id, allocationId: part.allocationId, cents: 30000 };
  const selected = readFundingEvidence({ ...fundingFile(people, [booked]), chosenSchedule: { version: "ft12-2028", firstYear: 2028, lastYear: 2028,
    events: [{ personId: "B", year: 2028, component: "child", childId: "K", contractId: "V-B", month: "2029-06", cents: 30000, confirmedBookingIds: [] }] } });
  const combined = (input: typeof selected) => deriveFunding(input.register, window).perspectives.BEDINGT_KOMBINIERT;
  assert.deepEqual(combined(selected).payments.map(e => [e.contractId, e.month, e.cents, e.amountEvidence.class]),
    [["V-A", "2028-06", 30000, "B"], ["V-B", "2029-06", 30000, "S"]]);
  const open = readFundingEvidence(fundingFile([people[0], people[1], p(2028, "A", false), p(2028, "B", false)]), selected);
  assert.deepEqual(combined(open).payments, [booked]);
  assert.ok(combined(open).issues.some(i => i.reason === "CHILD_YEAR_OPEN"));
  assert.notEqual(open.register.registerVersion, selected.register.registerVersion);
});

test("D2-T19–T21 / D3-T65–T67 / N1-02: B/S replay with disjoint active parts on the same contract", () => {
  const firstPart = allocation("base", "V1", 24000);
  const p = personYear({ children: [], contracts: [{ id: "V1", ownCents: 60000, eligibility: B },
    { id: "V2", ownCents: 60000, eligibility: B }], allocations: [firstPart, allocation("base", "V2", 15000)] });
  const revised = { ...p, allocations: [firstPart, { ...allocation("base", "V2", 10000), part: "posted" },
    { ...allocation("base", "V2", 5000), part: "residual" }] };
  const booked240 = confirmedTransfer(p, 24000, "V1", "2028-08");
  const claim = calculatePersonalFunding([revised])[0].claims[0];
  const bookPart = (index: number, month: string): Booking => {
    const part = claim.parts[index];
    return { ...booked240, id: "booking-" + index, externalId: "evidence-" + index, claimVersion: claimVersion(claim),
      contractId: part.contractId, partId: part.id, allocationId: part.allocationId, cents: part.cents, month };
  };
  const booked100 = bookPart(1, "2028-12"), booked50 = bookPart(2, "2029-02");
  const event = { personId: p.personId, year: 2027, component: "base", childId: null, contractId: "V2" };
  const plan150 = { version: "opening-plan", firstYear: 2027, lastYear: 2027, events: [{ ...event,
    cents: 15000, month: "2028-11", confirmedBookingIds: [booked240.id] }] };
  const stage1 = readFundingEvidence({ ...fundingFile([p], [booked240]), chosenSchedule: plan150 });
  const stage2 = readFundingEvidence({ ...fundingFile([revised], [booked100]), chosenSchedule: plan150 }, stage1);
  const plan50 = { ...plan150, version: "new-plan", events: [{ ...event,
    cents: 5000, month: "2029-01", confirmedBookingIds: [booked240.id, booked100.id] }] };
  assert.throws(() => readFundingEvidence({ ...fundingFile([revised]), chosenSchedule: plan50 }, stage2), /SCHEDULE_PART_OPEN/);
  const chosen50 = { ...plan50, events: [{ ...plan50.events[0], part: "residual" }] };
  const stage3 = readFundingEvidence({ ...fundingFile([revised]), chosenSchedule: chosen50 }, stage2);
  const actual = { ...fundingFile([revised], [booked50]), chosenSchedule: chosen50 };
  const stage4 = readFundingEvidence(actual, stage3);
  const repeat = readFundingEvidence(actual, stage4);
  const results = [stage1, stage2, stage3, stage4, repeat].map(input => deriveFunding(input.register, window).perspectives.BEDINGT_KOMBINIERT);
  assert.deepEqual(results.map(r => r.payments.map(e => [e.amountEvidence.class, e.cents, e.contractId, e.month])), [
    [["B", 24000, "V1", "2028-08"], ["S", 15000, "V2", "2028-11"]],
    [["B", 24000, "V1", "2028-08"], ["B", 10000, "V2", "2028-12"]],
    [["B", 24000, "V1", "2028-08"], ["B", 10000, "V2", "2028-12"], ["S", 5000, "V2", "2029-01"]],
    [["B", 24000, "V1", "2028-08"], ["B", 10000, "V2", "2028-12"], ["B", 5000, "V2", "2029-02"]],
    [["B", 24000, "V1", "2028-08"], ["B", 10000, "V2", "2028-12"], ["B", 5000, "V2", "2029-02"]],
  ]);
  assert.deepEqual(results.map(r => r.issues.map(i => i.reason)), [[], ["CLAIM_REMAINDER_OPEN"], [], [], []]);
  assert.deepEqual(stage4.register.booked, [booked240, booked100, booked50]);
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

test("D2-T36 and X03/X13: same profile and one stress loss without M1 or neutral invalidation", async () => {
  for (const [input, expected] of [["0 %", 0], ["-0 %", 0], ["−0,00 %", 0], ["−40 %", 4000], ["-100 %", 10000]] as const)
    assert.equal(parseStressLoss(input), expected);
  for (const invalid of ["", "-101 %", "40 %", "+40 % Gewinn", "-0,001 %"])
    assert.throws(() => parseStressLoss(invalid), /STRESS_LOSS_INVALID/);
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

  assert.ok(regular.value.end.status === "computed" && stress.value.end.status === "computed");
  const difference = regular.value.end.cents - stress.value.end.cents;
  assert.notEqual(difference, stress.value.rows[0].portfolio?.stress?.lossCents);
  assert.equal(productStressDifference(b.subresults, stress), difference);
  const prepared = draft({ ...first, stressLoss: "−40 %", stressMonth: "2027-01" });
  const other = calculateCurve(prepared.savings, { ...prepared.curves[2], scenarioVersion: "other" }, null, catalog);
  assert.equal(stressEndDifference(other, stress), null);
  fixed(session);
  const snapshot = session.current()!;
  const csv = new TextDecoder().decode(await renderPremiumDocument("csv", snapshot, snapshot.reservedAt));
  assert.match(csv, /"Unmittelbarer Verlust EUR";"[0-9]+,\d{2}"/);
  assert.ok(csv.includes('"Endwertdifferenz ohne Stress minus mit Stress EUR";"' + (difference / 100).toFixed(2).replace(".", ",") + '"'));
  const pdf = await PDFDocument.load(await renderPremiumDocument("pdf", snapshot, snapshot.reservedAt));
  assert.equal(pdf.getSubject(), snapshot.comparisonRevision);
  const zero = publish(session, draft({ ...first, stressLoss: "0", stressMonth: "2027-01" }));
  const zeroModel = zero.subresults.at(-1)!.result;
  assert.ok(zeroModel.status === "computed" && zeroModel.value.stressEventId);
  assert.notEqual(zeroModel.value.stressEventId, stress.value.stressEventId);
  assert.deepEqual(zeroModel.value.rows.map(row => row.balance), regular.value.rows.map(row => row.balance));
  assert.equal(productStressDifference(zero.subresults, zeroModel), 0);
  const signed = publish(session, draft({ ...first, stressLoss: "-0", stressMonth: "2027-01" }));
  assert.deepEqual(signed.subresults.at(-1)!.result, zeroModel);
  assert.notEqual(zero.comparisonRevision, a.comparisonRevision);
  assert.equal(a.subresults.length, 3);

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
  const fact = (tariff: typeof ws.paths[0]["product"]["tariff"], criterion: "fund_plan" | "life_annuity" | "value_protection_only" | "contribution_guarantee", dateRef = date) =>
    ({ criterion, established: true, date: dateRef, source, tariff });
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
    const tariff = reference(record(parsed, "synthetic-tariff-1", "tariff"));
    return { m: modelCatalog(parsed, "internal"), path: { ...ws.paths[0], facts: [fact(tariff, "contribution_guarantee")], product: {
      product: reference(record(parsed, "synthetic-product-1", "product")), tariff,
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
  assert.equal(assess(minimum, { ...pro.path, facts: [fact(pro.path.product.tariff, "value_protection_only")] }, pro.m).status, "B_MISMATCH");
  assert.equal(assess(minimum, guarantee80.path, guarantee80.m).status, "B_MATCH");
  assert.equal(assess(minimum, guarantee80.path, guarantee80.m, "another-tariff-hash").status, "O");
  assert.equal(assess({ ...minimum, stichtag: "2028-12-31" }, guarantee80.path, guarantee80.m).status, "O");
  const payout = { ...request, criterion: "both_payouts_same_tariff" as const, requiredScope: "same_tariff", requirementBasis: "fund_plan_and_life_annuity" };
  const tariff = guarantee.path.product.tariff;
  const incomplete = { ...guarantee.path, facts: [fact(tariff, "life_annuity")] };
  assert.equal(assess({ ...payout, answer: "compare", hardness: "soft" }, incomplete, guarantee.m).status, "orientation");
  assert.equal(assess(payout, incomplete, guarantee.m).status, "O");
  const complete = { ...guarantee.path, facts: [fact(tariff, "life_annuity"), fact(tariff, "fund_plan")] };
  const paths = assess(payout, complete, guarantee.m);
  assert.equal(paths.status, "B_MATCH");
  assert.equal(paths.bankChannel, "open");
  assert.equal(assess(payout, { ...complete, facts: [fact(tariff, "life_annuity"), fact(tariff, "fund_plan", "2026-12-31")] }, guarantee.m).status, "O");
  assert.equal(assess(minimum, { ...guarantee80.path, facts: guarantee.path.facts }, guarantee80.m).status, "O");
  assert.equal(assess(minimum, { ...guarantee80.path, facts: [{ ...guarantee80.path.facts[0], source: { ...source, hash: "stale" } }] }, guarantee80.m).status, "O");
  assert.equal(assess(payout, { ...complete, facts: [fact(tariff, "life_annuity"), fact(guarantee80.path.product.tariff, "fund_plan")] }, guarantee.m).status, "O");
  assert.equal(preferenceMatches(products.find(p => p.id === "garantie")!, { ...emptyProductAnswers, protection: "none" }).protection, null);
  assert.equal(calculateCurve(initial.savings, scenario, null, null).status, "computed");
});
