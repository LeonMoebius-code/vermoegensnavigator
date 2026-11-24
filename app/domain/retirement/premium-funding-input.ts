import { jsonHash } from "../case/recovery-hash";
import { copyAvd, description, id, integer, list, nullable, oneOf, requireAvd, shape } from "./avd-data";
import { monthIndex } from "./premium-calendar";
import { calculatePersonalFunding, grantEvidence, personYearList } from "./premium-entitlement";
import { claimId, claimVersion, deriveFunding, distinctRegister, type FundingRegister, type Hypothesis } from "./premium-funding";
import { open, type Cashflow } from "./premium-contract";

const cents = integer(0, Number.MAX_SAFE_INTEGER);
const year = integer(100, 9999);
const month = (input: unknown, at: string) => {
  requireAvd(typeof input === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(input) && input >= "0100-01", "invalid_month", at);
  return input;
};
const bookedEvidence = shape({ class: oneOf("B"), source: description, version: id });
const key = shape({ personId: id, year, component: oneOf("base", "child", "bonus"), childId: nullable(id), bonusLifetimeKey: nullable(id) });
const claim = shape({ key, claimRevision: id, regimeVersion: id, sourceVersion: id,
  amount: nullable(shape({ cents, evidence: grantEvidence })), eligibility: nullable(grantEvidence),
  parts: list(shape({ id, contractId: id, allocationId: id, allocationVersion: id, cents, evidence: grantEvidence }), 10),
  supersedes: nullable(id), reconciliationGroup: nullable(id) });
const bookingFields = { id, externalId: id, claim: id, claimVersion: id, kind: oneOf("grant"), contractId: nullable(id),
  partId: nullable(id), allocationId: nullable(id), month, cents: integer(-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
  bookingVersion: id, reverses: nullable(id), openingInclusion: nullable(id), amountEvidence: bookedEvidence };
const bookingWithoutAllocation = shape(bookingFields);
const bookingWithAllocation = shape({ ...bookingFields, allocation: shape({ kind: oneOf("weights"),
  weightsBps: list(integer(0, 10000), 30, 1), evidence: bookedEvidence }) });
function booking(input: unknown, at: string) {
  return input && typeof input === "object" && Object.hasOwn(input, "allocation")
    ? bookingWithAllocation(input, at) : bookingWithoutAllocation(input, at);
}
const schedule = nullable(shape({ version: id, firstYear: year, lastYear: year,
  events: list(shape({ personId: id, year, component: oneOf("base", "child", "bonus"), childId: nullable(id),
    contractId: id, month, cents, confirmedBookingIds: list(id, 500) }), 1000) }));
const payment = shape({ id, contractId: id, month, cents, kind: oneOf("regular", "special"), amountEvidence: grantEvidence });
const dossier = shape({ format: oneOf("avd.funding-evidence.v1"), personYears: personYearList,
  historicClaims: list(claim, 500), bookings: list(booking, 2000), chosenSchedule: schedule,
  opening: nullable(shape({ id, includedBookingIds: list(id, 500), composition: oneOf("known", "open") })),
  settlements: list(shape({oldBookingId: id, childYearKey: id, evidence: bookedEvidence, month}), 500),
  ownPayments: nullable(list(payment, 3500)) });

export interface FundingEvidence {
  readonly people: ReturnType<typeof calculatePersonalFunding>;
  readonly register: FundingRegister;
  readonly ownPayments: readonly Cashflow[] | null;
}

export function readFundingEvidence(input: unknown, previous: FundingEvidence | null = null): FundingEvidence {
  const data = dossier(copyAvd(input), "förderakte");
  const people = calculatePersonalFunding(data.personYears);
  const active = people.flatMap(p => p.claims);
  const historic = previous?.register.claims ?? [];
  const claims = distinctRegister([...historic, ...data.historicClaims, ...active], claimVersion, "claims");
  const booked = distinctRegister([...(previous?.register.booked ?? []), ...data.bookings], b => b.externalId, "bookings");
  const settlements = distinctRegister([...(previous?.register.disjointSettlements ?? []), ...data.settlements],
    s => jsonHash([s.oldBookingId, s.childYearKey]), "settlements");
  const s = data.chosenSchedule;
  const hypothesis = s ? { version: s.version, scheduleRevision: jsonHash(s), firstYear: s.firstYear, lastYear: s.lastYear,
    events: s.events.map((event): Hypothesis => {
      const c = active.find(c => c.key.personId === event.personId && c.key.year === event.year
        && c.key.component === event.component && c.key.childId === event.childId);
      const part = c?.parts.find(p => p.contractId === event.contractId);
      requireAvd(c && part && event.cents <= part.cents, "SCHEDULE_PART_OPEN", event.contractId);
      return { id: jsonHash([s.version, event]), month: event.month, kind: "grant", cents: event.cents,
        contractId: part.contractId, claim: claimId(c.key), claimVersion: claimVersion(c), partId: part.id,
        allocationId: part.allocationId, allocationVersion: part.allocationVersion, hypothesisVersion: s.version,
        scheduleRevision: jsonHash(s), confirmedBookingIds: event.confirmedBookingIds,
        amountEvidence: { class: "S", source: "Ausdrücklich eingereichter Förderplan", version: s.version } };
    }) } : null;
  const ownPayments = data.ownPayments === null ? null : distinctRegister(data.ownPayments, p => p.id, "ownPayments");
  if (ownPayments) for (const p of data.personYears) {
    for (const contract of p.contracts) {
      const sum = ownPayments.filter(e => e.contractId === contract.id && Number(e.month.slice(0, 4)) === p.year)
        .reduce((total, event) => total + BigInt(event.cents), 0n);
      requireAvd(sum === BigInt(contract.ownCents), "CONTRACT_PAYMENTS_DIFFER", contract.id);
    }
  }
  const register: FundingRegister = { registerVersion: jsonHash([data, booked, settlements]), claims,
    activeClaimVersions: active.map(claimVersion), booked, hypothesis, opening: data.opening ?? previous?.register.opening ?? null,
    disjointSettlements: settlements, claimIssues: [
      ...people.flatMap(p => p.issues),
      ...(ownPayments === null && data.personYears.some(p => p.contracts.length > 1) ? [open("OWN_CONTRACT_PLAN_OPEN", "ownPayments")] : []),
    ] };
  const window = { from: "0100-01", through: "9999-12", lastFundingYear: null };
  deriveFunding(register, window); // Reject malformed historical identities before adopting any part.
  if (ownPayments) for (const event of ownPayments) monthIndex(event.month);
  return { people, register, ownPayments: ownPayments as readonly Cashflow[] | null };
}

/** Posted evidence survives changes of assumptions, contribution inputs and legal context. */
export function fundingRegisterForCase(data: FundingEvidence, isCurrent: boolean, openingUnchanged: boolean): FundingRegister {
  if (isCurrent && openingUnchanged) return data.register;
  return { ...data.register, registerVersion: jsonHash([data.register.registerVersion, "history-only"]),
    activeClaimVersions: [], claimIssues: [], hypothesis: null, openingContextOpen: !openingUnchanged && Boolean(data.register.opening) };
}
