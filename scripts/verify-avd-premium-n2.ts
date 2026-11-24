import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { calculatePersonalFunding } from "../app/domain/retirement/premium-entitlement";
import { bookingAssignmentReference, childYearKey, claimId, claimVersion, deriveFunding, settlementReference,
  type Booking, type Claim, type FundingRegister, type Hypothesis } from "../app/domain/retirement/premium-funding";
import { readFundingEvidence } from "../app/domain/retirement/premium-funding-input";
import { modelCatalog } from "../app/domain/retirement/model-catalog";
import { DEFAULT_INFLATION, reservePrice, type PriceSelection } from "../app/domain/retirement/premium-price";
import { calculateCurve, productStressDifference, stressEndDifference, type CurveRequest } from "../app/domain/retirement/premium-series";
import { createPremiumSession, type PremiumDraft } from "../app/domain/retirement/premium-session";
import { productCurves, productPathKey, selectProductOption } from "../app/presentation/retirement/premium-product-configuration";
import { childReversalDossiers, confirmedTransfer, evidenceB as B, evidenceS as S, fundingFile, personYear, syntheticPremiumWorkspace } from "../tests/browser/avd-r88-fixtures";

const window = { from: "2029-01", through: "2030-12", lastFundingYear: null };
const bankPart = (id: string, contractId: string, cents: number) => ({ id, contractId, cents, allocationId: id, allocationVersion: "v1", evidence: B });

test("N2-01 / D2-T24 / D4-T89–91: allocation-invalid reversals keep the child-year open across windows", async () => {
  const child = (personId: string, parts: Claim["parts"]): Claim => ({
    key: { personId, year: 2028, component: "child", childId: "K", bonusLifetimeKey: null }, claimRevision: "v1",
    regimeVersion: "estg-2028-v1", sourceVersion: "n2-source", amount: { cents: 30000, evidence: B }, eligibility: B,
    parts, supersedes: null, reconciliationGroup: null,
  });
  const old = child("A", [bankPart("first", "VA", 15000), bankPart("second", "VA", 10000), bankPart("third", "VA-other", 5000)]);
  const successor = { ...child("B", [bankPart("new", "VB", 30000)]), supersedes: claimId(old.key), reconciliationGroup: childYearKey(old.key) };
  const otherVersion = { ...old, claimRevision: "v2", parts: old.parts.map(part => ({ ...part, allocationVersion: "v2" })) };
  const booking = (claim: Claim, index: number, id: string, month: string, cents: number, reverses: string | null = null): Booking => {
    const part = claim.parts[index];
    return { id, externalId: "bank-" + id, claim: claimId(claim.key), claimVersion: claimVersion(claim), partId: part.id,
      allocationId: part.allocationId, contractId: part.contractId, bookingVersion: "v1", openingInclusion: null,
      month, cents, kind: "grant", reverses, amountEvidence: B };
  };
  const posted = booking(old, 0, "posted", "2029-06", 15000);
  const wrong = [
    booking(old, 1, "wrong-part", "2029-09", -15000, posted.id),
    booking(old, 2, "wrong-contract", "2029-09", -15000, posted.id),
    booking(otherVersion, 0, "wrong-version", "2029-09", -15000, posted.id),
  ];
  const planned = (known: string[], month = "2029-12"): Hypothesis => ({ id: "planned", claim: claimId(successor.key), claimVersion: claimVersion(successor),
    partId: "new", contractId: "VB", allocationId: "new", allocationVersion: "v1", hypothesisVersion: "fresh", scheduleRevision: "fresh-v1",
    confirmedBookingIds: known, cents: 30000, month, kind: "grant", amountEvidence: S });
  const register = (booked: Booking[], event: Hypothesis, extra: Partial<FundingRegister> = {}): FundingRegister => ({
    registerVersion: "n2-funding", claims: [old, otherVersion, successor], activeClaimVersions: [claimVersion(successor)],
    booked, opening: null, disjointSettlements: [], hypothesis: { version: "fresh", scheduleRevision: "fresh-v1", firstYear: 2028, lastYear: 2028, events: [event] }, ...extra,
  });
  for (const bad of wrong) for (const evaluate of [window, { ...window, from: "2029-10" }, { ...window, through: "2029-08" }]) {
    const r = deriveFunding(register([posted, bad], planned([posted.id, bad.id])), evaluate);
    assert.deepEqual(r.ledger, [posted, bad]);
    assert.ok(r.perspectives.BEDINGT_KOMBINIERT.issues.some(i => i.reason === "AUSGLEICH_OFFEN"));
    assert.ok(!r.perspectives.BEDINGT_KOMBINIERT.payments.some(e => e.amountEvidence.class === "S"));
    assert.equal(r.perspectives.NUR_BELEGTE_HISTORIE.issues.some(i => i.reason === "BOOKING_ALLOCATION_OPEN"), evaluate === window);
  }
  const debit1 = booking(old, 0, "actual-first", "2029-10", -10000, posted.id);
  const debit2 = booking(old, 0, "actual-last", "2029-11", -5000, posted.id);
  const ledger = [posted, ...wrong, debit1, debit2];
  const refs = ledger.map(e => e.id);
  const after = { ...window, from: "2029-12" };
  const open = deriveFunding(register(ledger, planned(refs)), { ...window, through: "2029-10" });
  assert.ok(open.perspectives.BEDINGT_KOMBINIERT.issues.some(i => i.reason === "AUSGLEICH_OFFEN"));
  const same = deriveFunding(register(ledger, planned(refs, "2029-11")), after);
  assert.ok(same.perspectives.BEDINGT_KOMBINIERT.issues.length);
  const mature = deriveFunding(register(ledger, planned(refs)), after);
  assert.deepEqual(mature.ledger, ledger);
  assert.deepEqual(mature.perspectives.BEDINGT_KOMBINIERT.payments, []);
  assert.ok(mature.perspectives.BEDINGT_KOMBINIERT.issues.some(i => i.reason === "AUSGLEICH_OFFEN"));
  const clean = [posted, debit1, debit2];
  const cleanPlan = planned(clean.map(e => e.id));
  const resolved = deriveFunding(register(clean, cleanPlan), after);
  assert.deepEqual(resolved.perspectives.BEDINGT_KOMBINIERT, { payments: [cleanPlan], issues: [] });
  const next = booking(successor, 0, "new-B", "2029-12", 30000);
  const actual = deriveFunding(register([...ledger, next, next], planned(refs)), after);
  assert.deepEqual(actual.perspectives.BEDINGT_KOMBINIERT.payments, [next]);
  assert.ok(actual.perspectives.BEDINGT_KOMBINIERT.issues.some(i => i.reason === "AUSGLEICH_OFFEN"));
  const settlement = { oldBookingId: posted.id, childYearKey: childYearKey(old.key)!, evidence: B, month: "2029-10" };
  const settledRefs = [posted.id, wrong[0].id, settlementReference(settlement)];
  assert.deepEqual(deriveFunding(register([posted, wrong[0]], planned(settledRefs), { disjointSettlements: [settlement] }), after)
    .perspectives.BEDINGT_KOMBINIERT.payments, []);
  const disjointPlan = planned([posted.id, settlementReference(settlement)]);
  assert.deepEqual(deriveFunding(register([posted], disjointPlan, { disjointSettlements: [settlement] }), after)
    .perspectives.BEDINGT_KOMBINIERT, { payments: [disjointPlan], issues: [] });

  const store = createPremiumSession({ rights: syntheticPremiumWorkspace().rights, scope: "internal" });
  const draft: PremiumDraft = { caseRevision: "n2-fund", price: { mode: "automatic" }, inflation: DEFAULT_INFLATION,
    savings: { caseId: "n2-funding", openingCents: 0, openingVersion: "1", own: [], profiles: [],
      timeline: { valuationStart: after.from, valuationEnd: after.through, contributions: { kind: "holdings_only" }, payoutStart: null, finalFundingYear: null },
      funding: register([posted, wrong[0]], planned([posted.id, wrong[0].id])) },
    curves: [{ id: "combined", returnEvidence: S, scenarioVersion: "1", contractId: null, valueBasis: "nominal",
      perspective: "BEDINGT_KOMBINIERT", model: { mode: "NEUTRAL", annualBps: 0 } }] };
  const blocked = publish(store, draft);
  assert.equal(blocked.complete, false);
  const result = blocked.subresults[0].result;
  assert.ok(result.status === "computed" && result.value.end.status === "O" && result.value.end.reason === "AUSGLEICH_OFFEN");
  assert.equal(store.reserveOperation("fix"), null);
  assert.equal(store.reserveOperation("pdf"), null);
  assert.equal(store.reserveOperation("csv"), null);
  const fixed = publish(store, { ...draft, savings: { ...draft.savings, funding: register([...clean, next], cleanPlan, { registerVersion: "n2-funding-b" }) } });
  assert.notEqual(fixed.comparisonRevision, blocked.comparisonRevision);
  assert.ok(fixed.complete && store.commitOperation(store.reserveOperation("fix")!));
  assert.ok(await store.commitDocument(store.reserveOperation("csv")!));
});

function publish(store: ReturnType<typeof createPremiumSession>, draft: PremiumDraft) {
  assert.equal(store.edit(draft.savings.caseId, draft.caseRevision, draft, () => draft).issue, null);
  return store.commit(store.reserve()!)!;
}

test("N3-01: a missing original preserves the signed B booking and invalid evidence is still rejected", () => {
  const f = childReversalDossiers();
  const unresolved = { ...f.supplemental, reverses: f.secondOriginal.id };
  const initial = readFundingEvidence(f.before);
  const input = { ...f.pending, bookings: [unresolved] };
  const pending = readFundingEvidence(input, initial);
  const repeat = readFundingEvidence(input, pending);
  assert.deepEqual(repeat.register, pending.register);
  const check = (register: FundingRegister) => deriveFunding(register, window);
  const result = check(pending.register);
  assert.deepEqual(result.ledger, [...f.before.bookings, unresolved]);
  assert.deepEqual(result.perspectives.NUR_BELEGTE_HISTORIE.payments, f.before.bookings);
  assert.ok(result.perspectives.BEDINGT_KOMBINIERT.issues.some(issue => issue.path === unresolved.id && issue.month === unresolved.month));
  assert.ok(result.perspectives.BEDINGT_KOMBINIERT.payments.every(event => event.amountEvidence.class === "B"));
  const complete = readFundingEvidence({ ...f.corrected, reversalAssignments: [],
    chosenSchedule: f.schedule("after-missing-original", [f.original.id, f.reversal.id, unresolved.id, f.secondOriginal.id]) }, pending);
  const resolved = check(complete.register);
  assert.deepEqual(resolved.ledger, [...result.ledger, f.secondOriginal]);
  assert.deepEqual(resolved.perspectives.BEDINGT_KOMBINIERT.issues, []);
  assert.equal(resolved.perspectives.BEDINGT_KOMBINIERT.payments.filter(event => event.amountEvidence.class === "S").length, 1);

  for (const invalid of [
    { ...unresolved, reverses: f.successorBase.id, month: "2030-03" },
    { ...unresolved, reverses: f.original.id, month: "2028-12" },
    { ...unresolved, reverses: f.reversal.id },
    { ...unresolved, reverses: unresolved.id },
  ]) assert.throws(() => readFundingEvidence({ ...input, bookings: [invalid] }, initial), /REVERSAL_REFERENCE_OPEN/);
  assert.throws(() => readFundingEvidence({ ...input, bookings: [{ ...unresolved, claimVersion: "unknown" }] }, initial), /BOOKING_IDENTITY_OPEN/);
  assert.throws(() => readFundingEvidence({ ...input, bookings: [{ ...unresolved, month: "2029-13" }] }, initial), /invalid_month/);
  assert.throws(() => readFundingEvidence({ ...input, bookings: [{ ...unresolved, amountEvidence: S }] }, initial), /unknown_value/);
  assert.throws(() => readFundingEvidence({ ...input, bookings: [{ ...unresolved, cents: -1 }] }, pending), /IDENTITY_COLLISION/);
});

test("N3-02: only a unique dated reversal proof and fresh selection close the affected path", () => {
  const f = childReversalDossiers();
  const initial = readFundingEvidence(f.before);
  const pending = readFundingEvidence(f.pending, initial);
  const at = { ...window, from: "2030-01" };
  const evaluate = (register: FundingRegister, bounds = at) => deriveFunding(register, bounds);
  const combined = (register: FundingRegister, bounds = at) => evaluate(register, bounds).perspectives.BEDINGT_KOMBINIERT;
  const checkOpen = (register: FundingRegister, bounds = at) => {
    const side = combined(register, bounds);
    assert.ok(side.issues.some(issue => issue.reason === "AUSGLEICH_OFFEN"));
    assert.ok(side.payments.every(event => event.amountEvidence.class === "B"));
  };
  checkOpen(pending.register, window);
  checkOpen(pending.register, { ...window, from: "2029-03" });
  checkOpen(pending.register);
  const beforeDebit = evaluate(pending.register, { ...window, through: "2029-02" });
  assert.deepEqual(beforeDebit.ledger, pending.register.booked);
  assert.deepEqual(beforeDebit.perspectives.NUR_BELEGTE_HISTORIE, { payments: [f.original, f.reversal], issues: [] });
  assert.deepEqual(evaluate(pending.register).perspectives.OHNE_ZULAGEN, { payments: [], issues: [] });
  const independent = calculateCurve({ caseId: "n3-other-contract", openingCents: 10000, openingVersion: "1", own: [], profiles: [],
    timeline: { valuationStart: at.from, valuationEnd: at.through, contributions: { kind: "holdings_only" }, payoutStart: null, finalFundingYear: null },
    funding: pending.register }, { id: "other-contract", returnEvidence: S, scenarioVersion: "1", contractId: "independent",
    valueBasis: "nominal", perspective: "BEDINGT_KOMBINIERT", model: { mode: "NEUTRAL", annualBps: 0 } }, null, null);
  assert.ok(independent.status === "computed" && independent.value.end.status === "computed" && independent.value.end.cents === 10000);
  const stale = readFundingEvidence({ ...f.correctedBase, chosenSchedule: f.pending.chosenSchedule }, pending);
  assert.ok(combined(stale.register).issues.some(issue => issue.reason === "CLAIM_REMAINDER_OPEN"));
  assert.ok(combined(stale.register).payments.every(event => event.amountEvidence.class === "B"));
  for (const proof of [{ ...f.proof, originalVersion: "stale" }, { ...f.proof, effectiveMonth: "2029-02" },
    { ...f.proof, originalId: f.original.id }]) {
    checkOpen(readFundingEvidence({ ...f.corrected, reversalAssignments: [proof] }, pending).register);
  }
  checkOpen(readFundingEvidence({ ...f.corrected, reversalAssignments: [f.proof, { ...f.proof, evidence: { ...B, version: "another" } }] }, pending).register);
  const resolved = readFundingEvidence(f.corrected, pending);
  const settled = evaluate(resolved.register, window);
  assert.deepEqual(settled.ledger, [...pending.register.booked, f.secondOriginal]);
  assert.notEqual(resolved.register.registerVersion, pending.register.registerVersion);
  assert.deepEqual(readFundingEvidence(f.corrected, resolved).register, resolved.register);
  assert.deepEqual(settled.perspectives.NUR_BELEGTE_HISTORIE.payments, settled.ledger);
  assert.deepEqual(settled.perspectives.BEDINGT_KOMBINIERT.issues, []);
  assert.equal(combined(resolved.register).payments.at(-1)?.cents, 30000);
  const anticipated = readFundingEvidence({ ...f.pending, chosenSchedule: f.corrected.chosenSchedule }, initial);
  const arrived = readFundingEvidence(f.corrected, anticipated);
  assert.ok(combined(arrived.register).issues.some(issue => issue.reason === "CLAIM_REMAINDER_OPEN"));
  assert.ok(combined(arrived.register).payments.every(event => event.amountEvidence.class === "B"));
  checkOpen(resolved.register, { ...window, through: "2029-03" });
  const tooSoon = readFundingEvidence({ ...f.corrected, chosenSchedule: f.schedule("at-proof-month", f.known, f.proof.effectiveMonth) }, pending);
  assert.ok(combined(tooSoon.register, window).payments.every(event => event.amountEvidence.class === "B"));
});

test("N2-02 / X13: equal material price base permits provenance reuse, mismatches block fixing and documents", async () => {
  const ws = syntheticPremiumWorkspace(), path = ws.paths[0], catalog = modelCatalog(ws.catalog, "internal");
  const profile = selectProductOption(path, 0), key = productPathKey(path), caseId = "n2-stress";
  const timeline = { valuationStart: "2027-01", valuationEnd: "2027-12", contributions: { kind: "holdings_only" as const }, payoutStart: null, finalFundingYear: null };
  const basis = { valueBasis: "real" as const, perspective: "OHNE_ZULAGEN" as const, returnEvidence: S, scenarioVersion: "n2" };
  const draft = (loss?: string, selection: PriceSelection = { mode: "automatic" }): PremiumDraft => {
    const configuration = loss === undefined ? profile : { ...profile, stressLoss: loss, stressMonth: "2027-03" };
    const product = productCurves({ paths: [path], configurations: { [key]: configuration }, catalog }, timeline, caseId, basis, 600);
    return { caseRevision: "n2-stress", price: selection, inflation: DEFAULT_INFLATION,
      savings: { caseId, openingCents: 125000, openingVersion: "1", own: [], funding: null, profiles: product.profiles, timeline },
      curves: product.curves };
  };
  let clock = "2026-11-24T10:00:00.000Z";
  const store = createPremiumSession({ rights: ws.rights, catalog: ws.catalog, scope: "internal", clock: () => clock });
  const original = publish(store, draft());
  clock = "2026-11-24T10:01:00.000Z";
  const next = publish(store, draft("-37"));
  const base = next.subresults[1].result, stressed = next.subresults[2].result;
  assert.ok(base.status === "computed" && stressed.status === "computed");
  assert.equal(base.value.price?.reservedAt, "2026-11-24T10:00:00.000Z");
  assert.equal(stressed.value.price?.reservedAt, clock);
  assert.equal(next.subresults[1].original?.subresultId, original.subresults[1].subresultId);
  const difference = productStressDifference(next.subresults, stressed);
  assert.ok(next.complete && difference !== null && difference > 0);
  assert.ok(store.commitOperation(store.reserveOperation("fix")!));
  const pdf = await store.commitDocument(store.reserveOperation("pdf")!);
  const csv = await store.commitDocument(store.reserveOperation("csv")!);
  assert.ok(csv && pdf);
  const csvBytes = store.readDocument(csv.id, caseId)!.bytes;
  const pdfBytes = store.readDocument(pdf.id, caseId)!.bytes;
  assert.ok(new TextDecoder().decode(csvBytes).includes("Endwertdifferenz ohne Stress minus mit Stress EUR"));
  assert.equal((await PDFDocument.load(pdfBytes)).getSubject(), next.comparisonRevision);

  clock = "2026-12-01T10:00:00.000Z";
  const changedMonth = publish(store, draft("-37"));
  assert.ok(changedMonth.complete);
  assert.equal(changedMonth.subresults[1].original, null);
  assert.equal(stressEndDifference(base, changedMonth.subresults[2].result), null);
  const manual = { mode: "manual", month: "2026-11", evidence: S } as const;
  const exactBase = publish(store, draft(undefined, manual));
  clock = "2026-12-02T10:00:00.000Z";
  for (const loss of ["0", "-0", "-100"]) {
    const snapshot = publish(store, draft(loss, manual));
    assert.ok(snapshot.complete);
    assert.equal(snapshot.subresults[1].original?.subresultId, exactBase.subresults[1].subresultId);
    const delta = productStressDifference(snapshot.subresults, snapshot.subresults[2].result);
    assert.ok(delta !== null && (loss === "-100" ? delta > 0 : delta === 0));
  }
  const incompatible = draft("-37", manual);
  const incomplete = publish(store, { ...incompatible, curves: [incompatible.curves[0],
    { ...incompatible.curves[1], scenarioVersion: "different" }, incompatible.curves[2]] });
  assert.ok(incomplete.subresults.every(s => s.result.status === "computed" && s.result.value.complete));
  assert.equal(incomplete.complete, false);
  assert.deepEqual(incomplete.comparisonIssues.map(i => i.reason), ["STRESS_COMPARISON_OPEN"]);
  for (const operation of ["fix", "confirm", "pdf", "csv", "print"] as const) assert.equal(store.reserveOperation(operation), null);
  assert.deepEqual(store.readDocument(csv.id, caseId)!.bytes, csvBytes);
  assert.deepEqual(store.readDocument(pdf.id, caseId)!.bytes, pdfBytes);
  for (const [calendar, inflation] of [[{ version: "utc-v2", timeZone: "UTC" }, DEFAULT_INFLATION],
    [{ version: "berlin-v1", timeZone: "Europe/Berlin" }, { ...DEFAULT_INFLATION, bps: 300 }]] as const) {
    const request = draft("-37");
    const price = reservePrice(request.price, calendar, "2026-11-24T10:02:00.000Z", inflation);
    assert.equal(stressEndDifference(base, calculateCurve(request.savings, request.curves[2], price, catalog)), null);
  }
});

test("N2-03 / D3-T66: dated evidence links old B100 to the new disjoint claim part and leaves the booked bytes", () => {
  const alloc = (contractId: string, cents: number) => ({ component: "base" as const, childId: null, contractId, cents, evidence: B });
  const old = personYear({ children: [], contracts: [{ id: "V1", ownCents: 60000, eligibility: B }, { id: "V2", ownCents: 60000, eligibility: B }],
    allocations: [alloc("V1", 24000), alloc("V2", 15000)] });
  const current = { ...old, allocations: [alloc("V1", 24000), { ...alloc("V2", 10000), part: "booked" },
    { ...alloc("V2", 5000), part: "remaining" }] };
  const a = confirmedTransfer(old, 24000, "V1", "2028-08"), b = confirmedTransfer(old, 10000, "V2", "2028-12");
  const nextClaim = calculatePersonalFunding([current])[0].claims[0];
  const [posted, rest] = nextClaim.parts.slice(1);
  const proof = { bookingId: b.id, bookingVersion: b.bookingVersion, sourceClaimVersion: b.claimVersion,
    claimVersion: claimVersion(nextClaim), partId: posted.id, allocationId: posted.allocationId, allocationVersion: posted.allocationVersion,
    effectiveMonth: "2028-12", evidence: B };
  const oldRegister = readFundingEvidence(fundingFile([old], [a,b]));
  const event = { personId: old.personId, year: 2027, component: "base", childId: null, contractId: "V2",
    month: "2029-01", cents: 5000, part: "remaining", confirmedBookingIds: [a.id, b.id] };
  const schedule = { version: "rest-v1", firstYear: 2027, lastYear: 2027, events: [event] };
  const combined = (input: ReturnType<typeof readFundingEvidence>) =>
    deriveFunding(input.register, { ...window, from: "2028-01" }).perspectives.BEDINGT_KOMBINIERT;
  const missing = readFundingEvidence({ ...fundingFile([current]), chosenSchedule: schedule }, oldRegister);
  assert.deepEqual(combined(missing).payments, [a,b]);
  assert.ok(combined(missing).issues.length);
  assert.deepEqual(combined(readFundingEvidence({ ...fundingFile([current]), chosenSchedule: schedule, bookingAssignments: [proof] }, missing)).payments, [a,b]);
  const renewed = { ...schedule, version: "rest-v2", events: [{ ...event, confirmedBookingIds: [...event.confirmedBookingIds, bookingAssignmentReference(proof)] }] };
  for (const assignments of [[{ ...proof, bookingVersion: "stale" }], [proof, { ...proof, evidence: { ...B, version: "competing" } }]]) {
    const disputed = readFundingEvidence({ ...fundingFile([current]), chosenSchedule: renewed, bookingAssignments: assignments }, oldRegister);
    assert.deepEqual(combined(disputed).payments, [a,b]);
    assert.ok(combined(disputed).issues.some(i => i.reason === "CLAIM_REMAINDER_OPEN"));
  }
  const dossier = { ...fundingFile([current]), chosenSchedule: renewed, bookingAssignments: [proof] };
  const selection = readFundingEvidence(dossier, missing);
  assert.notEqual(selection.register.registerVersion, missing.register.registerVersion);
  assert.deepEqual(combined(selection).issues, []);
  assert.deepEqual(combined(selection).payments.map(e => [e.month, e.cents, e.amountEvidence.class]),
    [["2028-08", 24000, "B"], ["2028-12", 10000, "B"], ["2029-01", 5000, "S"]]);
  const c: Booking = { ...b, id: "new-B50", externalId: "new-ext-B50", claimVersion: claimVersion(nextClaim),
    partId: rest.id, allocationId: rest.allocationId, month: "2029-02", cents: 5000 };
  const final = readFundingEvidence({ ...dossier, bookings: [c] }, selection);
  const replay = readFundingEvidence({ ...dossier, bookings: [c] }, final);
  assert.deepEqual(final.register.booked, [a,b,c]);
  assert.deepEqual(combined(final).payments, [a,b,c]);
  assert.deepEqual(combined(final).issues, []);
  assert.deepEqual(combined(replay), combined(final));
});
