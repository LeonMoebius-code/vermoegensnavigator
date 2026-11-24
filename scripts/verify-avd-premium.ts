import "./verify-avd-premium-continuation";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jsonHash } from "../app/domain/case/recovery-hash";
import { lifecycleBoundaries, portfolioRows, type AllocationProfile, type CashflowOrder, type EndAction, type StressEvent } from "../app/domain/retirement/premium-portfolio";
import { claimId, claimVersion, deriveFunding, type Booking, type Claim, type FundingRegister, type Hypothesis } from "../app/domain/retirement/premium-funding";
import { monthIndex, overrideRegularEnd, regularEnd, valuationMonths, type Timeline } from "../app/domain/retirement/premium-calendar";
import { type Cashflow } from "../app/domain/retirement/premium-contract";
import { BERLIN_CALENDAR, DEFAULT_INFLATION, deflatorFor, reservePrice, type Inflation } from "../app/domain/retirement/premium-price";
import { euros, outputCents } from "../app/domain/retirement/model-decimal";
import { SCALE } from "../app/domain/retirement/projection-decimal";
import { calculateCurve, compareOwnBasis, CUSTOMER_RETURN, parseCustomerTotalReturn, type CurveRequest, type SavingsInputs } from "../app/domain/retirement/premium-series";
import { createPremiumSession, type ChannelRights, type Operation, type PremiumDraft } from "../app/domain/retirement/premium-session";
import { childCard, assessPreference, type Preference, type FeatureCheck, type ChildEligibility } from "../app/domain/retirement/premium-evidence";
import { modelCatalog } from "../app/domain/retirement/model-catalog";
import { reference } from "../app/domain/retirement/identity-contract";
import { record, reseal, syntheticCatalog } from "../tests/browser/avd-catalog-fixture";

const fixture = JSON.parse(readFileSync("tests/fixtures/avd-premium-model.synthetic.json", "utf8"));
const S = { class: "S", source: "synthetic assumption", version: "s1" } as const;
const B = { class: "B", source: "synthetic evidence", version: "b1" } as const;
const zero = { equity: 0, bond: 0, cash: 0, commodity: 0, secured_assets: 0 };
const time = (valuationStart = "2027-01", valuationEnd = "2027-12"): Timeline => ({
  valuationStart, valuationEnd, contributions: { kind: "holdings_only" }, finalFundingYear: null, payoutStart: null,
});
const savings = (timeline = time(), openingCents = 1000000): SavingsInputs => ({ caseId: "case-X", timeline,
  openingCents, openingVersion: "o1", own: [], funding: null, profiles: [] });
const curve = (annualBps = 600, range: Partial<CurveRequest> = {}): CurveRequest => ({ id: "neutral", scenarioVersion: "m1",
  returnEvidence: S, contractId: null, perspective: "OHNE_ZULAGEN", valueBasis: "nominal", model: { mode: "NEUTRAL", annualBps }, ...range });
const calc = (request: SavingsInputs, c = curve()) => calculateCurve(request, c, null, null);
function end(result: ReturnType<typeof calc>) {
  assert.equal(result.status, "computed");
  assert.equal(result.value.end.status, "computed");
  return result.value.end.cents;
}
const payment = (id: string, month: string, cents: number, extra: Partial<Cashflow> = {}): Cashflow => ({
  id, month, cents, contractId: null, kind: "special", amountEvidence: S, ...extra,
});
const sharedProduct = (() => {
  const catalog = syntheticCatalog();
  const product = reference(record(catalog, "synthetic-product-1", "product"));
  const tariff = reference(record(catalog, "synthetic-tariff-1", "tariff"));
  return { product, tariff };
})();

function claim(person: string, year: number, cents: number | null, parts: { id: string; contract: string; cents: number }[], opts: Partial<Claim> = {}): Claim {
  return { key: { personId: person, year, component: "base", childId: null, bonusLifetimeKey: null },
    claimRevision: `claim-${person}-${year}-${parts.length}`, sourceVersion: "synthetic-source", regimeVersion: `rule-${year}`,
    eligibility: B, amount: cents === null ? null : { cents, evidence: B },
    parts: parts.map(item => ({ id: item.id, contractId: item.contract, allocationId: item.id, allocationVersion: "alloc-1", cents: item.cents, evidence: B })),
    supersedes: null, reconciliationGroup: null, ...opts };
}
function book(c: Claim, partId: string, eventId: string, month: string, cents: number, opts: Partial<Booking> = {}): Booking {
  const part = c.parts.find(p => p.id === partId)!;
  return { claim: claimId(c.key), claimVersion: claimVersion(c), partId, allocationId: part.allocationId,
    bookingVersion: "booking-v1", openingInclusion: null, reverses: null, externalId: `external:${eventId}`, kind: "grant",
    id: eventId, month, cents, contractId: part.contractId, amountEvidence: B, ...opts };
}
function scenario(c: Claim, partId: string, eventId: string, month: string, cents: number, known: string[] = []): Hypothesis {
  const part = c.parts.find(p => p.id === partId)!;
  return { claim: claimId(c.key), claimVersion: claimVersion(c), partId, allocationId: part.allocationId,
    hypothesisVersion: "forecast1", scheduleRevision: "schedule1", allocationVersion: part.allocationVersion, confirmedBookingIds: known,
    kind: "grant", id: eventId, month, cents, contractId: part.contractId, amountEvidence: S };
}
function register(claims: Claim[], booked: Booking[], events: Hypothesis[] = [], opts: Partial<FundingRegister> = {}): FundingRegister {
  return { registerVersion: "funding1", claims, activeClaimVersions: claims.map(claimVersion), booked,
    hypothesis: { version: "forecast1", scheduleRevision: "schedule1", firstYear: 2027, lastYear: 2030, events },
    opening: null, disjointSettlements: [], ...opts };
}
const fundingWindow = { from: "2028-01", through: "2030-01", lastFundingYear: null };
const active = (input: FundingRegister, window = fundingWindow) => deriveFunding(input, window).perspectives.BEDINGT_KOMBINIERT;
const ids = (value: ReturnType<typeof active>) => value.payments.map(p => p.id);
const cash = (value: ReturnType<typeof active>) => value.payments.reduce((sum, p) => sum + p.cents, 0);

test("D2-T01–T06 / FT-01–FT-03: total returns, exact range, precision and month-end own rates", () => {
  assert.equal(end(calc(savings())), 1060000);
  assert.equal(end(calc(savings(), curve(parseCustomerTotalReturn("6,23")))), 1062300);
  assert.deepEqual(CUSTOMER_RETURN.offsetsBps.map(offset => 600 + offset), [300, 600, 900]);
  for (const [input, expected] of [["-10,00", [870000, 900000, 930000]], ["15,00", [1120000, 1150000, 1180000]]] as const) {
    assert.deepEqual(CUSTOMER_RETURN.offsetsBps.map(offset => end(calc(savings(), curve(parseCustomerTotalReturn(input) + offset)))), expected);
  }
  for (const input of ["-10,01", "15,01", "6,235", "invalid"]) assert.throws(() => parseCustomerTotalReturn(input));
  assert.equal(end(calc(savings(time(), 100))), 106);
  const request = { ...savings(time(), 0), own: valuationMonths(time()).map(month => payment(month, month, 10000)) };
  assert.equal(end(calc(request)), 123265);
});

test("D2-T12 / FT-22: scalar paths have no implicit equity crash", () => {
  const value = calc(savings(), curve(600, { model: { mode: "NEUTRAL", annualBps: 600, stress: { lossBps: 4000 } } as CurveRequest["model"] }));
  assert.equal(value.status, "O");
  assert.equal(end(calc(savings())), 1060000);
});

test("D2-T13–T18 / FT-05–FT-06: independent birth, contribution and valuation dates", () => {
  const basis = { birthYear: 2004, birthMonth: 11, birthMonthEvidence: "B" as const, sourceVersion: "birth-1", endAge: 67 };
  assert.equal(regularEnd(basis, null).month, "2071-10");
  assert.equal(regularEnd({ ...basis, birthMonth: 1 }, null).month, "2070-12");
  assert.equal(regularEnd({ ...basis, birthMonth: 2 }, null).month, "2071-01");
  const unknown = { ...basis, birthMonth: null, birthMonthEvidence: "O" as const };
  assert.equal(regularEnd(unknown, null).status, "offen");
  assert.equal(regularEnd(unknown, null).year, 2071);
  assert.equal(regularEnd(unknown, overrideRegularEnd(unknown, "2071-10", "override-1")).month, "2071-10");
  const override = overrideRegularEnd(basis, "2071-12", "override-1");
  const changed = { ...basis, endAge: 68 };
  assert.equal(regularEnd(changed, override).status, "Konflikt_ungelöst");
  assert.equal(regularEnd(changed, overrideRegularEnd(changed, override.month, "override-2")).month, "2071-12");
  assert.throws(() => valuationMonths({ ...time(), contributions: { kind: "regular", first: "2027-12", last: "2027-01" } }));
  const one = { ...time("2027-01", "2027-01"), contributions: { kind: "regular" as const, first: "2027-01", last: "2027-01" },
    payoutStart: { month: "2072-07", evidence: "S" as const, version: "payout1" } };
  assert.equal(end(calc({ ...savings(one, 0), own: [payment("own1", "2027-01", 10000, { kind: "regular" })] })), 10000);
  assert.equal(one.payoutStart.month, "2072-07");
});

const personal = claim("P", 2027, 39000, [{ id: "first", contract: "V1", cents: 24000 }, { id: "second", contract: "V2", cents: 10000 },
  { id: "rest", contract: "V2", cents: 5000 }]);
const early = book(personal, "first", "B240", "2028-08", 24000);
const later = book(personal, "second", "B100", "2028-12", 10000);
const rest = book(personal, "rest", "B50", "2029-02", 5000);
const broadClaim = claim("P", 2027, 39000, [{ id: "first", contract: "V1", cents: 24000 }, { id: "rest-broad", contract: "V2", cents: 15000 }]);
const broadEarly = book(broadClaim, "first", "B240", "2028-08", 24000);
const forecast150 = scenario(broadClaim, "rest-broad", "S150", "2028-11", 15000, [broadEarly.id]);
const forecast50 = scenario(personal, "rest", "S50", "2029-01", 5000, [early.id, later.id]);

test("D2-T19–T21 / D3-T65–T67 / NT-03: iterative rederivation, idempotence and signed correction", () => {
  assert.equal(cash(active(register([broadClaim], [broadEarly, broadEarly], [forecast150]))), 39000);
  const next = active(register([broadClaim, personal], [broadEarly, later], [forecast150], { activeClaimVersions: [claimVersion(personal)] }));
  assert.deepEqual(ids(next), ["B240", "B100"]);
  assert.equal(cash(next), 34000);
  assert.equal(next.issues[0].reason, "CLAIM_REMAINDER_OPEN");
  assert.equal(cash(active(register([personal], [early, later], [forecast50]))), 39000);
  assert.deepEqual(ids(active(register([personal], [early, later, rest, later], [forecast50]))), ["B240", "B100", "B50"]);
  const reverse = book(personal, "second", "R20", "2029-03", -2000, { reverses: later.id });
  const corrected = active(register([personal], [early, later, rest, later, reverse], [forecast50]));
  assert.equal(cash(corrected), 37000);
  assert.equal(corrected.issues[0].reason, "CLAIM_REMAINDER_OPEN");
});

test("D3-T68: same amount, separate contracts and booking months", () => {
  const c = claim("P", 2027, 38000, [{ id: "one", contract: "V1", cents: 19000 }, { id: "two", contract: "V2", cents: 19000 }]);
  const payments = active(register([c], [], [scenario(c, "one", "same1", "2028-01", 19000), scenario(c, "two", "same2", "2028-06", 19000)])).payments;
  assert.deepEqual(payments.map(x => [x.contractId, x.month, x.cents]), [["V1", "2028-01", 19000], ["V2", "2028-06", 19000]]);
});

test("N1-02 / D2-T25 and FT-16: equal total cannot cover mismatched contract parts", () => {
  const c = claim("P", 2028, 30000, [{ id: "A", contract: "V1", cents: 10000 }, { id: "B", contract: "V2", cents: 20000 }]);
  const v1 = book(c, "A", "first", "2029-04", 10000);
  const v2 = book(c, "B", "second", "2029-06", 20000);
  const half = { ...v2, cents: 10000 };
  const remainder = book(c, "B", "part-two", "2029-08", 10000);
  const run = (entries: Booking[], current = c) =>
    deriveFunding(register(current === c ? [c] : [c, current], entries, [], { activeClaimVersions: [claimVersion(current)] }), fundingWindow);
  for (const entries of [[{ ...v1, cents: 20000 }, half], [v1, half], [{ ...v1, cents: 12000 }, v2]]) {
    const actual = run(entries);
    assert.deepEqual(actual.ledger, entries);
    assert.deepEqual(actual.perspectives.NUR_BELEGTE_HISTORIE.payments, entries);
    assert.deepEqual(actual.perspectives.BEDINGT_KOMBINIERT.payments, entries);
    assert.equal(actual.perspectives.BEDINGT_KOMBINIERT.issues[0].reason, "CLAIM_REMAINDER_OPEN");
    assert.equal(actual.perspectives.NUR_BELEGTE_HISTORIE.issues.length, 0);
  }
  const multiple = run([v1, half, remainder, half]);
  assert.deepEqual(multiple.perspectives.BEDINGT_KOMBINIERT.payments, [v1, half, remainder]);
  assert.equal(multiple.perspectives.BEDINGT_KOMBINIERT.issues.length, 0);
  const reversal = book(c, "B", "correction", "2029-10", -5000, { reverses: remainder.id });
  const restored = book(c, "B", "replacement", "2029-12", 5000);
  assert.equal(run([v1, half, remainder, reversal]).perspectives.BEDINGT_KOMBINIERT.issues[0].reason, "CLAIM_REMAINDER_OPEN");
  assert.equal(run([v1, half, remainder, reversal, restored]).perspectives.BEDINGT_KOMBINIERT.issues.length, 0);
  const current = { ...c, claimRevision: "new-version", parts: c.parts.map(part => ({ ...part, allocationVersion: "allocation-v2" })) };
  const old = run([v1, v2], current);
  assert.deepEqual(old.ledger, [v1, v2]);
  assert.equal(old.perspectives.BEDINGT_KOMBINIERT.issues[0].reason, "CLAIM_REMAINDER_OPEN");
  assert.equal(run([book(current, "A", "new-a", "2029-08", 10000), book(current, "B", "new-b", "2029-10", 20000)],
    current).perspectives.BEDINGT_KOMBINIERT.issues.length, 0);
});

test("D3-T69–T70 / FT-13–FT-15: B and S years, three perspectives and explicit horizon", () => {
  const part = [{ id: "one", contract: "V1", cents: 39000 }];
  const v1 = claim("P", 2027, 39000, part), v2 = claim("P", 2028, 39000, part), future = claim("P", 2029, 39000, part);
  const filed = book(v1, "one", "b-2027", "2028-08", 39000);
  const estimate = scenario(v2, "one", "s-2028", "2029-06", 39000);
  const run = deriveFunding(register([v1, v2], [filed], [estimate]), fundingWindow);
  assert.equal(cash(run.perspectives.BEDINGT_KOMBINIERT), 78000);
  assert.equal(cash(run.perspectives.NUR_BELEGTE_HISTORIE), 39000);
  assert.equal(cash(run.perspectives.OHNE_ZULAGEN), 0);
  const stopped = active(register([v1, v2, future], [filed], [estimate], {
    hypothesis: { version: "forecast1", scheduleRevision: "schedule2", firstYear: 2027, lastYear: 2027, events: [estimate] },
  }));
  assert.deepEqual(ids(stopped), [filed.id]);
  assert.ok(stopped.issues.length > 0);
});

const childBase = { id: "child-part", contract: "V1", cents: 30000 };
const older = claim("ParentA", 2028, 30000, [childBase], { key: { personId: "ParentA", year: 2028, component: "child", childId: "K", bonusLifetimeKey: null } });
const original = book(older, childBase.id, "old-child", "2029-06", 30000);
const younger = claim("ParentB", 2028, 30000, [{ ...childBase, contract: "V2" }], {
  key: { personId: "ParentB", year: 2028, component: "child", childId: "K", bonusLifetimeKey: null },
  supersedes: claimId(older.key), reconciliationGroup: jsonHash(["K", 2028]),
});
const childForecast = scenario(younger, childBase.id, "s-child", "2029-11", 30000);
const childState = (booked: Booking[], events = [childForecast]) => register([older, younger], booked, events, { activeClaimVersions: [claimVersion(younger)] });

test("D4-T89 + T91 / X02: old evidence remains, unresolved family transfer blocks new S booking", () => {
  const r = deriveFunding(childState([original]), fundingWindow);
  assert.equal(r.perspectives.BEDINGT_KOMBINIERT.issues[0].reason, "AUSGLEICH_OFFEN");
  assert.deepEqual(ids(r.perspectives.BEDINGT_KOMBINIERT), [original.id]);
  assert.equal(cash(r.perspectives.NUR_BELEGTE_HISTORIE), 30000);
  assert.deepEqual(r.ledger.map(b => b.month), ["2029-06"]);
  assert.equal(end(calc(savings())), 1060000);
  const secondB = book(younger, childBase.id, "second-positive", "2029-10", 30000);
  const duplicateEconomic = deriveFunding(childState([original, secondB]), fundingWindow);
  assert.equal(duplicateEconomic.ledger.length, 2);
  assert.equal(duplicateEconomic.perspectives.BEDINGT_KOMBINIERT.issues[0].reason, "AUSGLEICH_OFFEN");
});

test("D4-T90: recorded dated corrections precede complete successor assignment", () => {
  const correction = book(older, childBase.id, "corr-child", "2029-12", -30000, { reverses: original.id });
  const booked = book(younger, childBase.id, "new-child", "2030-01", 30000);
  const r = active(childState([original, correction, booked]));
  assert.equal(r.issues.length, 0);
  assert.equal(cash(r), 30000);
  assert.deepEqual(r.payments.map(b => [b.id, b.month]), [[original.id, "2029-06"], [correction.id, "2029-12"], [booked.id, "2030-01"]]);
  assert.equal(active(childState([original, correction, booked]), { ...fundingWindow, through: "2029-11" }).issues[0].reason, "AUSGLEICH_OFFEN");
});

const portBase = (fromMonth: string, starting = [8000, 2000]): AllocationProfile => ({
  caseId: "case-X", profileId: "synthetic-profile", profileVersion: "profile-1", product: sharedProduct,
  model: "synthetic_reference", option: "free", optionEvidence: S, comfort: null,
  positions: [
    { id: "secured_assets", assetClass: "secured_assets", fund: null, exposure: [{ fromMonth, toMonthExclusive: null, weightBps: 0, evidence: B }] },
    { id: "equity", assetClass: "equity", fund: null, exposure: [{ fromMonth, toMonthExclusive: null, weightBps: 10000, evidence: B }] },
  ],
  openingWeightsBps: starting,
  windows: [{ id: "base", fromMonth, toMonthExclusive: null, evidence: S, targetWeightsBps: starting, cashflowWeightsBps: starting, openingAction: "CASHFLOW_ONLY" }],
  annualRebalance: null, endActions: [], resolutions: [],
});
const moment = time("2029-01", "2029-02");
const paths = (profile: AllocationProfile, openingCents: number, list: Cashflow[], orders: CashflowOrder[] = [], t = moment,
  market: Record<string, Partial<typeof zero>> = { "2029-02": { equity: 1000 } }, crash: StressEvent | null = null, costFactor = SCALE) => {
  const payments = new Map<string, Cashflow[]>();
  for (const event of list) payments.set(event.month, [...(payments.get(event.month) ?? []), event]);
  return portfolioRows({ timeline: t, months: valuationMonths(t), opening: euros(openingCents), profile, payments,
    cashflowOrders: orders, returns: { version: "change-v1", evidence: S, annualBps: zero, monthlyBps: market }, stress: crash,
    costs: { mode: "K1", monthlyFactor: costFactor } });
};
const positive = payment("add-20", "2029-01", 2000, { allocation: { kind: "weights", weightsBps: [0, 10000], evidence: S } });
const proRata = (id: string, cents: number) => payment(id, "2029-01", cents, { kind: "grant", amountEvidence: B, allocation: { kind: "pro_rata", evidence: S } });
const debit = (id: string, cents: number, weightsBps: number[]) => payment(id, "2029-01", cents, { kind: "grant", amountEvidence: B,
  allocation: { kind: "weights", weightsBps, evidence: B } });
const order = (ev: Cashflow[], evidence: CashflowOrder["evidence"] = S): CashflowOrder => ({ month: "2029-01", eventIds: ev.map(e => e.id), evidence });
function checkFinal(rows: ReturnType<typeof paths>, cents: number) {
  const last = rows.at(-1)!.outcome;
  assert.equal(last.status, "computed");
  if (last.status === "computed") assert.equal(outputCents(last.total, "end"), cents);
}
function issueAt(rows: ReturnType<typeof paths>, code: string, index = 0) {
  const result = rows[index].outcome;
  assert.equal(result.status, "O");
  if (result.status === "O") assert.equal(result.reason, code);
}

test("D4-T92–T94 / X05 / X10: mixed ordering produces distinct next-month values", () => {
  const c = fixture.portfolioControls.mixed;
  // Open 80 and 5 EUR exactly using a EUR100 starting portfolio and a
  // deterministic -75 percent monthly ETF move on a 20 EUR holding.
  const profile = portBase("2029-01", c.openingWeightsBps), negative = proRata("debit-50", c.negativeCents);
  const rates = { "2029-01": { equity: c.initialEquityBps }, "2029-02": { equity: c.nextMonthEquityBps } };
  issueAt(paths(profile, c.openingCents, [positive, negative], [], moment, rates), "EREIGNISREIHENFOLGE_OFFEN");
  checkFinal(paths(profile, c.openingCents, [positive, negative], [order([negative, positive])], moment, rates), c.expectedNegativeFirstCents);
  checkFinal(paths(profile, c.openingCents, [positive, negative], [order([positive, negative])], moment, rates), c.expectedPositiveFirstCents);
  issueAt(paths(profile, c.openingCents, [positive, negative], [order([negative, positive], B), order([positive, negative], { ...B, version: "b2" }), order([positive, negative])], moment, rates),
    "EREIGNISREIHENFOLGE_OFFEN");
});

test("D4-T95–T97: two actual debits preserve evidence and enforce intermediate coverage", () => {
  const c = fixture.portfolioControls.twoDebits;
  const profile = portBase("2029-01"), secured = debit("debit-40-secured", c.securedDebitCents, [10000, 0]);
  const proportional = proRata("debit-40-proportional", c.proRataDebitCents);
  issueAt(paths(profile, c.openingCents, [secured, proportional]), "EREIGNISREIHENFOLGE_OFFEN");
  checkFinal(paths(profile, c.openingCents, [secured, proportional], [order([secured, proportional])]), c.expectedSecuredFirstCents);
  checkFinal(paths(profile, c.openingCents, [secured, proportional], [order([proportional, secured])]), c.expectedProRataFirstCents);
  const charge = debit("charge-10", -1000, [0, 10000]);
  const add = { ...positive, cents: 500 };
  const singleEquity = portBase("2029-01", [0, 10000]);
  issueAt(paths(singleEquity, 500, [charge, add], [order([charge, add], B)]), "UNTERDECKUNG");
  checkFinal(paths(singleEquity, 500, [charge, add], [order([add, charge])]), 0);
});

test("D3-T71–T74: independently evidenced withdrawal mechanics and insufficient positions", () => {
  const profile = portBase("2029-01"), rates = { "2029-01": { equity: -7500 }, "2029-02": { equity: 1000 } };
  checkFinal(paths(profile, 10000, [debit("secured", -5000, [10000, 0])], [], moment, rates), 3550);
  checkFinal(paths(profile, 10000, [proRata("proportional", -5000)], [], moment, rates), 3521);
  issueAt(paths(profile, 10000, [debit("equity", -5000, [0, 10000])], [], moment, rates), "UNTERDECKUNG");
  issueAt(paths(profile, 10000, [payment("no-source", "2029-01", -8500)], [], moment, rates), "ENTNAHMEQUELLE_OFFEN");
  checkFinal(paths(profile, 10000, [proRata("zero", -8500)], [], moment, rates), 0);
});

const endBook = (actionId: string, weightsBps: number[], evidence: EndAction["evidence"] = B): EndAction => ({
  actionId, externalId: `external:${actionId}`, month: "2027-12", weightsBps, evidence, overrideOf: "annual", revision: "1",
});
const t12 = time("2027-01", "2028-01"), t24 = time("2027-01", "2028-12");
const rebalance = { ...portBase("2027-01", [6000, 4000]), annualRebalance: { evidence: S, revision: "annual1", cycleOverride: null } };
const e17 = endBook("E-17", [4000, 6000]), o23 = endBook("O-23", [4000, 6000], S);
const followingReturn = { "2028-01": { equity: 1000 } };

test("D4-T98–T100 + D3-T79–T80: identity conflict, resolution, reimport and source change", () => {
  const conflict = { ...rebalance, endActions: [e17, o23] };
  issueAt(paths(conflict, 101278, [], [], t12, followingReturn), "MEHRFACHAUFTRAG", 11);
  issueAt(paths({ ...conflict, endActions: [e17, { ...o23, weightsBps: [6000, 4000] }] }, 101278, [], [], t12, followingReturn), "MEHRFACHAUFTRAG", 11);
  const selected = { ...conflict, endActions: [e17, o23, e17], resolutions: [{ month: e17.month, selectedAction: e17.actionId,
    originalActionHashes: [jsonHash(e17), jsonHash(o23)], supersededActions: [o23.actionId], evidence: S, revision: "choose1" }] };
  checkFinal(paths(selected, 101278, [], [], t12, followingReturn), 107355);
  const later = paths(selected, 101278, [], [], t24, followingReturn);
  assert.deepEqual([10, 11, 12, 23].map(i => {
    const a = later[i].outcome; assert.equal(a.status, "computed");
    return a.status === "computed" && (typeof a.endAction === "string" ? a.endAction : a.endAction.actionId);
  }), ["NO_END_ACTION", "E-17", "NO_END_ACTION", "annual:annual1:2028-12"]);
  issueAt(paths({ ...selected, endActions: [{ ...e17, evidence: { ...B, version: "new" } }, o23] }, 101278, [], [], t12, followingReturn), "MEHRFACHAUFTRAG", 11);
});

test("D3-T77–T78 / D4-T105: single end override replaces regular order", () => {
  checkFinal(paths(rebalance, 101278, [], [], t12, followingReturn), 105329);
  checkFinal(paths({ ...rebalance, endActions: [e17] }, 101278, [], [], t12, followingReturn), 107355);
});

const channels: ChannelRights = {
  screen: { version: "visible", allowed: true }, print: { version: "print", allowed: true }, pdf: { version: "pdf", allowed: true },
  csv: { version: "csv", allowed: true }, json: { version: "json", allowed: true },
};
const nominal = curve(0), real = curve(0, { id: "real", valueBasis: "real" });
const usdCalendar = { timeZone: "UTC", version: "utc-v2" };
function draft(subresults = [nominal], request: SavingsInputs = savings(time("2027-11", "2027-11"), fixture.priceControls.nominalCents),
  price: PremiumDraft["price"] = { mode: "automatic" }, inflation: Inflation = DEFAULT_INFLATION): PremiumDraft {
  return { caseRevision: "C1", savings: request, curves: subresults, price, inflation };
}
function sessionEdit(session: ReturnType<typeof createPremiumSession>, request: PremiumDraft) {
  return session.edit(request.savings.caseId, request.caseRevision, request, input => input as PremiumDraft);
}
function run(session: ReturnType<typeof createPremiumSession>) {
  const work = session.reserve();
  assert.ok(work);
  return session.commit(work)!;
}
function moneyAt(snapshot: ReturnType<typeof run>, i: number) { return end(snapshot.subresults[i].result); }

test("D4-T101–T103 / D3-T82–T83 / X14: frozen calendar and independent nominal/manual dependencies", () => {
  let clock = fixture.priceControls.berlinStart;
  const session = createPremiumSession({ rights: channels, clock: () => clock });
  sessionEdit(session, draft([nominal, real]));
  const reservation = session.reserve()!;
  const frozen = reservePrice({ mode: "automatic" }, BERLIN_CALENDAR, clock, DEFAULT_INFLATION);
  assert.equal(frozen.referenceMonth, "2026-12");
  assert.equal(outputCents(deflatorFor(frozen)(euros(1020000), "2027-11"), "end"), fixture.priceControls.berlinRealCents);
  session.replaceCalendar(usdCalendar);
  const after = session.commit(reservation)!;
  assert.equal(after.subresults[1].result.status, "O");
  assert.equal(moneyAt(after, 0), 1020000);
  assert.equal(session.reserveOperation("fix"), null);
  clock = fixture.priceControls.utcStart;
  const resumed = run(session);
  assert.equal(moneyAt(resumed, 1), fixture.priceControls.utcRealCents);
  assert.equal(resumed.subresults[0].original?.subresultId, after.subresults[0].subresultId);
  assert.notEqual(resumed.comparisonRevision, after.comparisonRevision);
  sessionEdit(session, draft([real], undefined, { mode: "manual", month: "2027-01", evidence: S }));
  const fixedBasis = run(session);
  session.replaceCalendar(BERLIN_CALENDAR);
  assert.equal(session.current()?.id, fixedBasis.id);
  assert.equal(moneyAt(fixedBasis, 0), 1003306);

  clock = "2026-11-30T22:59:59.000Z";
  sessionEdit(session, draft([real]));
  const beforeMonth = session.reserve()!;
  clock = "2026-11-30T23:00:03.000Z";
  assert.equal(moneyAt(session.commit(beforeMonth)!, 0), 1000000);
  assert.equal(moneyAt(run(session), 0), 1001652);
});

test("D2-T49–T54 / D4-T104: price reference, negative time, invalid inflation and independent sensitivity", () => {
  const price = reservePrice({ mode: "manual", month: "2026-11", evidence: S }, BERLIN_CALENDAR, fixture.priceControls.utcStart, DEFAULT_INFLATION);
  const f = deflatorFor(price);
  const amount = euros(1020000);
  for (const [m, value] of [["2026-11", 1020000], ["2027-05", 1009950], ["2027-11", 1000000], ["2028-11", 980392], ["2025-11", 1040400]] as const)
    assert.equal(outputCents(f(amount, m), m), value);
  const sensitivity = { ...price, inflation: { bps: 300, evidence: { ...S, version: "inflation3" } } };
  assert.equal(outputCents(deflatorFor(sensitivity)(amount, "2027-11"), "end"), 990291);
  const r = savings(time("2027-11", "2027-11"), 1020000);
  assert.equal(compareOwnBasis(calculateCurve(r, real, price, null), calculateCurve(r, real, sensitivity, null)).status, "O");
  const session = createPremiumSession({ rights: channels });
  sessionEdit(session, draft([nominal, real], undefined, undefined, { ...DEFAULT_INFLATION, bps: -10000 }));
  const result = run(session);
  assert.equal(moneyAt(result, 0), 1020000);
  assert.equal(result.subresults[1].result.status, "O");
  const base = reservePrice({ mode: "manual", month: "2027-01", evidence: S }, BERLIN_CALENDAR, fixture.priceControls.utcStart, DEFAULT_INFLATION);
  const dates = time("2027-01", "2028-01");
  const cumulative = calculateCurve({ ...savings(dates, 0), own: [payment("a", "2027-01", 10000), payment("b", "2028-01", 10000)] }, real, base, null);
  assert.equal(cumulative.status, "computed");
  if (cumulative.status === "computed") assert.equal(cumulative.value.rows.at(-1)!.ownCents, 19804);
});

test("D3-T75–T76, T88 / D2-T22–T23: disjoint opening and historical events, event-wise signed price basis", () => {
  const c = claim("P", 2027, 39000, [{ id: "p", contract: "V1", cents: 39000 }]);
  const event = book(c, "p", "opening-inside", "2028-08", 39000, { openingInclusion: "opening-1" });
  const opening = { id: "opening-1", composition: "known" as const, includedBookingIds: [event.id] };
  const pre = reservePrice({ mode: "manual", month: "2029-01", evidence: S }, BERLIN_CALENDAR, fixture.priceControls.utcStart, DEFAULT_INFLATION);
  const history = curve(0, { ...real, perspective: "NUR_BELEGTE_HISTORIE" });
  const jan = time("2029-01", "2029-01");
  const noDouble = calculateCurve({ ...savings(jan, 39000), funding: register([c], [event], [], { opening }) }, history, pre, null);
  assert.equal(end(noDouble), 39000);
  assert.equal(noDouble.status === "computed" && noDouble.value.rows[0].grantCents, 0);
  assert.equal(outputCents(deflatorFor(pre)(euros(event.cents), event.month), "history"), 39323);
  const correction = book(c, "p", "correct-40", "2029-03", -4000, { reverses: event.id });
  const march = time("2029-01", "2029-03");
  const inputs = { ...savings(march, 39000), funding: register([c], [event, correction], [], { opening }),
    own: [payment("own-jan", "2029-01", 10000), payment("own-feb", "2029-02", 10000)] };
  const nominalView = calculateCurve(inputs, { ...history, valueBasis: "nominal" }, null, null);
  const realView = calculateCurve(inputs, history, pre, null);
  assert.equal(end(nominalView), 55000);
  assert.equal(nominalView.status === "computed" && nominalView.value.rows.at(-1)!.grantCents, -4000);
  const deflate = deflatorFor(pre);
  assert.equal(outputCents(deflate(euros(10000), "2029-01") + deflate(euros(10000), "2029-02") + deflate(euros(-4000), "2029-03"), "check"), 15997);
  assert.equal(realView.status, "computed");
  const correction90 = { ...correction, cents: -9000 };
  const onlyDebit = { ...inputs, own: [], funding: register([c], [event, correction90], [], { opening }) };
  assert.equal(end(calculateCurve(onlyDebit, { ...history, valueBasis: "nominal" }, null, null)), 30000);
});

test("D2-T40–T48 / FT-23 / D3-T87 / D4-T105: invalid draft and transactional export races", () => {
  const store = createPremiumSession({ rights: channels });
  const currentDraft = draft();
  const first = sessionEdit(store, currentDraft);
  const a = store.reserve()!;
  const second = sessionEdit(store, currentDraft);
  const b = store.reserve()!;
  assert.notEqual(first.revision.inputRevision, second.revision.inputRevision);
  assert.ok(store.commit(b));
  assert.equal(store.commit(a), null);
  for (const output of ["print", "pdf", "csv", "json"] as const) assert.equal(store.reserveOperation(output), null);
  const stale = store.reserve()!;
  const invalid = store.edit("case-X", "C1", "15,01", () => { parseCustomerTotalReturn("15,01"); return currentDraft; });
  assert.equal(invalid.issue?.reason, "TOTAL_RETURN_RANGE");
  assert.equal(store.commit(stale), null);
  assert.equal(store.current(), null);
  sessionEdit(store, currentDraft);
  const x = store.reserve()!;
  const yDraft = draft(undefined, { ...currentDraft.savings, caseId: "case-Y" });
  sessionEdit(store, yDraft);
  assert.equal(store.commit(x), null);
  const cmp = run(store);
  const lateFix = store.reserveOperation("fix")!;
  sessionEdit(store, yDraft);
  assert.equal(store.commitOperation(lateFix), null);
  const live = run(store);
  assert.equal(store.current()?.id, live.id);
  const fix = store.reserveOperation("fix")!;
  assert.ok(store.commitOperation(fix));
  assert.equal(store.current()?.status, "fixed_conditionally");
  assert.equal(store.reserveOperation("confirm"), null);
  const csv = store.reserveOperation("csv")!;
  const pdf = store.reserveOperation("pdf")!;
  const printed = store.reserveOperation("print")!;
  store.replaceRights({ ...channels, csv: { allowed: false, version: "csv-off" } });
  assert.equal(store.commitOperation(csv, () => "illegal"), null);
  const verifiedPdf = store.commitOperation(pdf, () => "historical pdf")!;
  assert.equal(store.reports()[0].body, "historical pdf");
  assert.equal(store.commitOperation(printed, () => {
    sessionEdit(store, yDraft);
    return "discarded";
  }), null);
  assert.deepEqual(store.reports(), [verifiedPdf]);
  assert.equal(store.historical(live.id)?.status, "fixed_conditionally");
  assert.equal(store.historical(cmp.id)?.id, cmp.id);
});

test("D2-T31–T39 / FT-21 / X04–X07: explicit T, allocation phases, real exposure and no reset", () => {
  const play = time("2029-01", "2029-02");
  const profile = portBase("2029-01", [3000, 7000]);
  const exposure = { ...profile, positions: profile.positions.map((position, i) => i === 1
    ? { ...position, exposure: [{ fromMonth: "2029-01", toMonthExclusive: null, weightBps: 5000, evidence: B }] } : position) };
  const activeWeight = { ...exposure.windows[0], openingAction: "HOLDINGS_SWITCH" as const, targetWeightsBps: [6000, 4000], cashflowWeightsBps: [6000, 4000] };
  const cashWeight = { ...activeWeight, openingAction: "CASHFLOW_ONLY" as const };
  const shock = { id: "crash", month: "2029-01", lossBps: 4000, evidence: S };
  const rates = { "2029-01": { equity: 1000, secured_assets: -500 } };
  const cost = 99n * SCALE / 100n;
  const own = [payment("inflow", "2029-01", 10000)];
  const holds = paths({ ...exposure, windows: [activeWeight] }, 100000, own, [], play, rates, shock, cost);
  const cashRows = paths({ ...exposure, windows: [cashWeight] }, 100000, own, [], play, rates, shock, cost);
  const a = holds[0].outcome, b = cashRows[0].outcome;
  assert.equal(a.status === "computed" && a.stress?.lossCents, 8800);
  assert.equal(b.status === "computed" && b.stress?.lossCents, 15400);
  assert.equal(a.status === "computed" && outputCents(a.total, "end"), 101278);
  assert.equal(b.status === "computed" && outputCents(b.total, "end"), 99199);
  assert.equal(b.status === "computed" && b.endAction, "NO_END_ACTION");
  const missing = { ...exposure, positions: exposure.positions.map(p => ({ ...p, exposure: [] })) };
  issueAt(paths(missing, 100000, [], [], play, rates, shock), "EXPOSURE_OPEN");
  checkFinal(paths(missing, 100000, [], [], play, {}), 100000);
  const lifecycle = { ...profile, model: "basis" as const, option: "basis_lifecycle" as const };
  assert.throws(() => paths(lifecycle, 100000, [], [], play, {}), /PAYOUT_ANCHOR_OPEN/);
  const bound = { ...time("2029-01", "2032-03"), payoutStart: { month: "2034-02", evidence: "S" as const, version: "T1" } };
  assert.deepEqual(lifecycleBoundaries(bound), ["2029-02", "2032-02"]);
  const plan = paths(lifecycle, 100000, [], [], bound, {});
  for (const [month, equity] of [["2029-01", 7000], ["2029-02", 5000], ["2029-03", 5000], ["2032-01", 5000], ["2032-02", 3000], ["2032-03", 3000]] as const) {
    const state = plan[monthIndex(month) - monthIndex(bound.valuationStart)].outcome;
    assert.equal(state.status === "computed" && state.targetWeightsBps[1], equity);
  }
});

test("D2-T07–T11 / D3-T86 / NT-01–NT-02 / X09: independent synthetic K1 formulas and public channel guard", () => {
  const catalog = syntheticCatalog();
  const trusted = modelCatalog(catalog, "internal");
  const products = [1, 2, 3, 4, 5, 6].map(n => ({ product: reference(record(catalog, `synthetic-product-${n}`, "product")),
    tariff: reference(record(catalog, `synthetic-tariff-${n}`, "tariff")) }));
  const curves = products.map((product, i) => curve(600, { id: `cost-${i}`, model: { mode: "M1", annualBps: 600, product,
    cost: { mode: "K1", cost: reference(record(catalog, `synthetic-k1-m1-${i + 1}`, "cost")), scenario: null } } }));
  const actual = curves.map(c => end(calculateCurve(savings(), c, null, trusted)));
  assert.deepEqual(actual, [1047700, 1047600, 1047500, 1047400, 1047300, 1047200]);
  const profile = portBase("2027-01", [0, 10000]);
  const cost = reference(record(catalog, "synthetic-k1-m2-1", "cost"));
  const m2 = curve(600, { model: { mode: "M2", product: sharedProduct, returns: { version: "r1", evidence: S,
    annualBps: { ...zero, equity: 600 }, monthlyBps: {} }, cost: { mode: "K1", cost, scenario: null }, stress: null, cashflowOrders: [] } });
  assert.equal(end(calculateCurve({ ...savings(), profiles: [profile] }, m2, null, trusted)), 1046962);
  assert.equal(calculateCurve(savings(), { ...curves[0], model: { ...curves[0].model, annualBps: -10000 } } as CurveRequest, null, trusted).status, "O");
  const noK2 = curve(600, { model: { mode: "M1", annualBps: 600, product: sharedProduct,
    cost: { mode: "K2", cost: reference(record(catalog, "synthetic-k2", "cost")), charges: [], scheduleVersion: "candidate" } } });
  assert.equal(calculateCurve(savings(), noK2, null, trusted).status, "O");
  const denied = createPremiumSession({ rights: channels, catalog });
  sessionEdit(denied, draft([nominal, ...curves], savings()));
  const rejected = run(denied);
  assert.equal(moneyAt(rejected, 0), 1000000);
  assert.ok(rejected.subresults.slice(1).every(x => x.result.status === "O" && x.result.reason === "ORG-O01"));
  const text = JSON.stringify(rejected);
  assert.doesNotMatch(text, /1047700|synthetic-k1|synthetic-product|annual_ratio/);
  assert.equal(denied.reserveOperation("pdf"), null);
  const ownerCatalog = reseal({ ...catalog, origin: "working" });
  const denyWorking = createPremiumSession({ rights: channels, catalog: ownerCatalog });
  sessionEdit(denyWorking, draft(curves, savings()));
  assert.ok(run(denyWorking).subresults.every(x => x.result.status === "O"));
});

test("D2-T55–T61 / FT-08–FT-09 / FT-17–FT-19 / D3-T85: separate A2 component and A3 preference evidence", () => {
  const eligibility: ChildEligibility = { caseId: "case-X", personId: "p1", childId: "child1", year: 2027,
    childBenefit: { value: true, evidence: S }, assignment: null, contractPath: { value: true, evidence: B },
    contributionPath: { value: true, evidence: B }, inputRevision: "draft" };
  assert.equal(childCard(eligibility).status, "O");
  assert.equal(childCard({ ...eligibility, childBenefit: { value: false, evidence: B } }).status, "not_relevant");
  const conditional = { ...eligibility, assignment: { value: { personId: "p1", contractId: "c1" }, evidence: B } };
  assert.equal(childCard(conditional).status, "S");
  assert.equal(childCard({ ...conditional, childBenefit: { value: true, evidence: B } }).status, "B");
  const preferred: Preference = { id: "guarantee", criterion: "minimum_guarantee", answer: "explicit_requirement",
    hardness: "explicit_hard", revision: "1", stichtag: "2028-01-10", requirementBasis: "own-and-grants", requiredScope: "one-tariff" };
  const check: FeatureCheck = { preferenceId: preferred.id, tariffId: "t1", productId: "p1", tariffVersion: "v1",
    preferenceRevision: preferred.revision, comparisonRevision: "comparison", stichtag: preferred.stichtag,
    requiredScope: preferred.requiredScope, requirementBasis: preferred.requirementBasis,
    feature: { value: false, evidence: B }, bankChannel: "open" };
  assert.equal(assessPreference({ ...preferred, answer: "none_required" }, check, "v1").status, "orientation");
  assert.equal(assessPreference({ ...preferred, criterion: "both_payouts_same_tariff", answer: "compare" }, check, "v1").status, "orientation");
  assert.equal(assessPreference(preferred, check, "v1").status, "B_MISMATCH");
  assert.equal(assessPreference(preferred, { ...check, feature: { value: true, evidence: S } }, "v1").status, "O");
  assert.equal(assessPreference(preferred, check, "v2").status, "O");
  assert.equal(assessPreference(preferred, check, "v1").bankChannel, "open");
});

test("D2-T27 / D2-T62–T63 / FT-24: ETF uses identical own dates, funding outside valuation and tax reinvestment guard", () => {
  const t = time("2027-01", "2029-12");
  const own = valuationMonths(time()).map(month => payment(`own-${month}`, month, 15000));
  const eligible = claim("P", 2027, 54000, [{ id: "p", contract: "V1", cents: 54000 }]);
  const planned = scenario(eligible, "p", "included", "2028-06", 54000);
  const a4 = curve(0, { perspective: "BEDINGT_KOMBINIERT" });
  const etf = curve(0, { model: { mode: "ETF_BRUTTO", annualBps: 0 } });
  const input = { ...savings(t, 0), own, funding: register([eligible], [], [planned]) };
  const after = calc(input, a4), ref = calc(input, etf);
  assert.equal(end(after), 234000);
  assert.equal(end(ref), 180000);
  assert.deepEqual(compareOwnBasis(after, ref), { status: "computed", evidence: S, value: 54000 });
  assert.equal(end(calc({ ...input, timeline: time() }, a4)), 180000);
  const reinvestment = payment("tax", "2028-06", 10000, { kind: "tax_reinvestment" });
  const asym = calc({ ...input, own: [...own, reinvestment] }, a4);
  assert.equal(compareOwnBasis(asym, ref).status, "O");
  assert.equal(compareOwnBasis(after, calc(input, curve(100, { model: { mode: "ETF_BRUTTO", annualBps: 100 } }))).status, "O");
});

test("D2-T24–T26 and T28–T30 / FT-11–FT-12, FT-16 / D3-T84: no duplicate economic allocation", () => {
  const duplicateChildren = register([older, younger], [original], [childForecast]);
  const blocked = active(duplicateChildren);
  assert.ok(blocked.issues.some(x => x.reason === "CLAIM_ASSIGNMENT_CONFLICT"));
  assert.deepEqual(ids(blocked), [original.id]);
  const over = claim("P", 2028, 100, [{ id: "one", contract: "V1", cents: 80 }, { id: "two", contract: "V2", cents: 80 }]);
  assert.throws(() => active(register([over], [])), /ALLOCATION_OVER_CLAIM/);
  const bonusPart = [{ id: "b", contract: "V1", cents: 20000 }];
  const first = claim("P", 2027, 20000, bonusPart, { key: { personId: "P", year: 2027, component: "bonus", childId: null, bonusLifetimeKey: "b-lifetime" } });
  const next = claim("P", 2028, 20000, bonusPart, { key: { ...first.key, year: 2028 } });
  const paid = book(first, "b", "prior-bonus", "2028-06", 20000);
  const request = scenario(next, "b", "new-bonus", "2029-06", 20000);
  assert.deepEqual(ids(active(register([first, next], [paid], [request]))), [paid.id]);
  const noBenefit = claim("P", 2028, null, [], { eligibility: null });
  assert.ok(active(register([noBenefit], [])).issues.some(issue => issue.reason === "CLAIM_REMAINDER_OPEN"));
});

test("X03 and X13: one revision-bound M2 profile, same stress base, and independent scalar curves", () => {
  const catalog = syntheticCatalog();
  const input = { ...savings(), profiles: [portBase("2027-01")] };
  const profile = input.profiles[0];
  const cost = { mode: "K1" as const, cost: reference(record(catalog, "synthetic-k1-m2-1", "cost")), scenario: null };
  const rates = { version: "profile-return-1", evidence: S, annualBps: zero, monthlyBps: {} };
  const m2 = curve(0, { id: "m2", model: { mode: "M2", returns: rates, product: sharedProduct, cost, stress: null, cashflowOrders: [] } });
  const stressed = { ...m2, id: "m2-stressed", model: { ...m2.model,
    stress: { id: "explicit-shock", month: "2027-01", lossBps: 4000, evidence: S } } } as CurveRequest;
  const list = [nominal, m2, stressed];
  const session = createPremiumSession({ rights: channels, catalog, scope: "internal" });
  sessionEdit(session, draft(list, input));
  const first = run(session);
  const a = first.subresults[1].result, b = first.subresults[2].result;
  assert.equal(a.status, "computed"); assert.equal(b.status, "computed");
  assert.deepEqual(a.value.profileIdentity, b.value.profileIdentity);
  assert.equal(a.value.paymentDependency, b.value.paymentDependency);
  assert.equal(a.value.marketBasis, b.value.marketBasis);
  const crash = b.value.rows[0];
  assert.equal("portfolio" in crash && crash.portfolio?.stress?.lossCents, 80000);
  assert.ok(moneyAt(first, 1) > moneyAt(first, 2));
  const edit = { ...profile, profileVersion: "profile-2", openingWeightsBps: [2000, 8000] };
  sessionEdit(session, draft(list, { ...input, profiles: [edit] }));
  const after = run(session);
  assert.equal(after.subresults[0].original?.subresultId, first.subresults[0].subresultId);
  assert.equal(after.subresults[1].original, null);
  assert.equal(after.subresults[2].original, null);
  const newProfile = after.subresults[2].result;
  assert.equal(newProfile.status, "computed");
  assert.equal(newProfile.value.profileIdentity?.version, "profile-2");
  sessionEdit(session, draft(list, { ...input, profiles: [edit, profile] }));
  const conflict = run(session);
  assert.equal(conflict.subresults[1].result.status, "O");
  assert.equal(conflict.subresults[2].result.status, "O");
  assert.equal(moneyAt(conflict, 0), moneyAt(first, 0));
});

test("X06–X08: product profile boundaries and unchanged documented comfort weights", () => {
  const raw = syntheticCatalog();
  const tariff = record(raw, "synthetic-tariff-1", "tariff");
  const before = portBase("2027-01");
  const publishedMix = record(raw, "synthetic-comfort", "portfolio");
  const market = { version: "r1", evidence: S, annualBps: zero, monthlyBps: {} };
  const c = curve(0, { model: { mode: "M2", product: sharedProduct, returns: market, stress: null, cashflowOrders: [],
    cost: { mode: "K1", cost: reference(record(raw, "synthetic-k1-m2-1", "cost")), scenario: null } } });
  const catalog = modelCatalog(raw, "internal");
  const config = (p: AllocationProfile) => calculateCurve({ ...savings(), profiles: [p] }, c, null, catalog);
  assert.equal(config({ ...before, model: "pro" }).status, "O");
  assert.equal(config({ ...before, model: "garantie" }).status, "O");
  const weights = publishedMix.data.weights.map(item => item.basisPoints);
  const positions = publishedMix.data.weights.map((item, i) => ({ id: `mix-${i}`, fund: item.fund,
    assetClass: record(raw, item.fund.id, "fund").data.assetClass, exposure: [] }));
  const initial = { ...before.windows[0], targetWeightsBps: weights, cashflowWeightsBps: weights };
  const comfort = { ...before, model: "ruv-individuell" as const, option: "comfort" as const, comfort: reference(publishedMix),
    positions, openingWeightsBps: weights, windows: [initial] };
  assert.equal(tariff.data.fundOptions.length, 11);
  assert.ok(weights.some(x => x % 1000 !== 0));
  assert.equal(config(comfort).status, "computed");
  assert.equal(config({ ...comfort, windows: [{ ...initial, cashflowWeightsBps: [...weights].reverse() }] }).status, "O");
  const free = { ...comfort, option: "free" as const, comfort: null };
  assert.equal(config(free).status, "O");
  const tenSteps = [3000, 2000, 1000, 1000, 2000, 1000];
  assert.equal(config({ ...free, windows: [{ ...initial, targetWeightsBps: tenSteps, cashflowWeightsBps: tenSteps }] }).status, "computed");
  const secured = { ...before.positions[0], fund: null }, etf = { ...before.positions[1], fund: tariff.data.fundOptions[0] };
  const inflow = { ...before, model: "ruv-garantie-80" as const, option: "inflow_proxy" as const, positions: [secured, etf] };
  assert.equal(config(inflow).status, "computed");
  assert.equal(config({ ...inflow, annualRebalance: { evidence: S, revision: "yearly", cycleOverride: null } }).status, "O");
  const ruvPath = paths(inflow, 100000, [], [], time("2027-01", "2027-12"), { "2027-02": { equity: 1000 } });
  const last = ruvPath.at(-1)!.outcome;
  assert.equal(last.status === "computed" && last.endAction, "NO_END_ACTION");
  assert.ok(last.status === "computed" && last.actualWeights[1]! > 2000);
});

test("K2: apply an evidenced fee once, validate its amount and block overlapping K1", () => {
  const raw = syntheticCatalog();
  const fee = record(raw, "synthetic-k2", "cost");
  assert.equal(fee.data.mode, "K2");
  fee.data.charges[0].timing.at = "after_return_before_payment";
  reseal(raw);
  const catalog = modelCatalog(raw, "internal");
  const profile = portBase("2027-01", [0, 10000]);
  const request = { ...savings(time("2027-01", "2027-01")), profiles: [profile] };
  const charges = [{ month: "2027-01", cents: 225, allocationBps: [0, 10000], costComponent: "administration", evidence: B }];
  const model = { mode: "M2" as const, product: sharedProduct,
    returns: { version: "fixed", evidence: S, annualBps: zero, monthlyBps: {} }, stress: null, cashflowOrders: [],
    cost: { mode: "K2" as const, cost: reference(fee), scheduleVersion: "booked-v1", charges } };
  assert.equal(end(calculateCurve(request, curve(0, { model }), null, catalog)), 999775);
  const missing = { ...model, cost: { ...model.cost, charges: [] } };
  const unknown = calculateCurve(request, curve(0, { model: missing }), null, catalog);
  assert.equal(unknown.status === "computed" && unknown.value.end.status, "O");
  const crowded = { ...model, cost: { ...model.cost, mode: "K1" as const, scenario: null } };
  assert.equal(calculateCurve(request, curve(0, { model: crowded }), null, catalog).status, "O");
});
