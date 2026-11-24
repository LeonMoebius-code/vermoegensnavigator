import { jsonHash } from "../case/recovery-hash";
import { copyAvd, description, id, integer, list, nullable, oneOf, requireAvd, shape } from "./avd-data";
import { monthIndex } from "./premium-calendar";
import { allocationPartId, calculatePersonalFunding, grantEvidence, personYearList } from "./premium-entitlement";
import { bookingAssignmentReference, claimId, claimVersion, deriveFunding, distinctRegister, type FundingRegister, type Hypothesis } from "./premium-funding";
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
const scheduleEventFields = { personId: id, year, component: oneOf("base", "child", "bonus"), childId: nullable(id),
  contractId: id, month, cents, confirmedBookingIds: list(id, 500) };
const wholeScheduleEvent = shape(scheduleEventFields);
const partScheduleEvent = shape({ ...scheduleEventFields, part: id });
const scheduleEvent = (input: unknown, at: string) => input && typeof input === "object" && Object.hasOwn(input, "part")
  ? partScheduleEvent(input, at) : wholeScheduleEvent(input, at);
const schedule = nullable(shape({ version: id, firstYear: year, lastYear: year, events: list(scheduleEvent, 1000) }));
const payment = shape({ id, contractId: id, month, cents, kind: oneOf("regular", "special"), amountEvidence: grantEvidence });
const dossierFields = { format: oneOf("avd.funding-evidence.v1"), personYears: personYearList,
  historicClaims: list(claim, 500), bookings: list(booking, 2000), chosenSchedule: schedule,
  opening: nullable(shape({ id, includedBookingIds: list(id, 500), composition: oneOf("known", "open") })),
  settlements: list(shape({oldBookingId: id, childYearKey: id, evidence: bookedEvidence, month}), 500),
  ownPayments: nullable(list(payment, 3500)) };
const bookingAssignments = list(shape({ bookingId: id, bookingVersion: id, sourceClaimVersion: id,
  claimVersion: id, partId: id, allocationId: id, allocationVersion: id, effectiveMonth: month, evidence: bookedEvidence }), 2000);
const dossier = shape(dossierFields);
const dossierWithAssignments = shape({ ...dossierFields, bookingAssignments });

export interface FundingEvidence {
  readonly people: ReturnType<typeof calculatePersonalFunding>;
  readonly register: FundingRegister;
  readonly ownPayments: readonly Cashflow[] | null;
  readonly selectedSchedules: ReadonlyMap<string, NonNullable<FundingRegister["hypothesis"]>>;
}

export function readFundingEvidence(input: unknown, previous: FundingEvidence | null = null): FundingEvidence {
  const payload = copyAvd(input);
  const { bookingAssignments: incomingAssignments, ...data } =
    payload && typeof payload === "object" && Object.hasOwn(payload, "bookingAssignments")
      ? dossierWithAssignments(payload, "förderakte") : { ...dossier(payload, "förderakte"), bookingAssignments: [] };
  const people = calculatePersonalFunding(data.personYears);
  const active = people.flatMap(p => p.claims);
  const historic = previous?.register.claims ?? [];
  const claims = distinctRegister([...historic, ...data.historicClaims, ...active], claimVersion, "claims");
  const booked = distinctRegister([...(previous?.register.booked ?? []), ...data.bookings], b => b.externalId, "bookings");
  const settlements = distinctRegister([...(previous?.register.disjointSettlements ?? []), ...data.settlements],
    s => jsonHash([s.oldBookingId, s.childYearKey]), "settlements");
  const assignments = distinctRegister([...(previous?.register.bookingAssignments ?? []), ...incomingAssignments],
    bookingAssignmentReference, "booking assignments");
  const s = data.chosenSchedule;
  const selectedSchedules = new Map(previous?.selectedSchedules);
  const prior = s && selectedSchedules.get(s.version);
  requireAvd(!prior || prior.scheduleRevision === jsonHash(s), "SCHEDULE_VERSION_REUSED", "chosenSchedule.version");
  const hypothesis = prior ?? (s ? { version: s.version, scheduleRevision: jsonHash(s), firstYear: s.firstYear, lastYear: s.lastYear,
    events: s.events.map((event): Hypothesis => {
      const c = active.find(c => c.key.personId === event.personId && c.key.year === event.year
        && c.key.component === event.component && c.key.childId === event.childId);
      requireAvd(c, "SCHEDULE_PART_OPEN", event.contractId);
      const partId = "part" in event && typeof event.part === "string" ? allocationPartId(claimId(c.key), event.contractId, event.part) : null;
      const [part, ...others] = c.parts.filter(p => p.contractId === event.contractId && (!partId || p.id === partId));
      requireAvd(part && others.length === 0 && event.cents <= part.cents, "SCHEDULE_PART_OPEN", event.contractId);
      return { id: jsonHash([s.version, event]), month: event.month, kind: "grant", cents: event.cents,
        contractId: part.contractId, claim: claimId(c.key), claimVersion: claimVersion(c), partId: part.id,
        allocationId: part.allocationId, allocationVersion: part.allocationVersion, hypothesisVersion: s.version,
        scheduleRevision: jsonHash(s), confirmedBookingIds: event.confirmedBookingIds,
        amountEvidence: { class: "S", source: "Ausdrücklich eingereichter Förderplan", version: s.version } };
    }) } : null);
  if (hypothesis) selectedSchedules.set(hypothesis.version, hypothesis);
  const ownPayments = data.ownPayments === null ? null : distinctRegister(data.ownPayments, p => p.id, "ownPayments");
  if (ownPayments) for (const p of data.personYears) {
    for (const contract of p.contracts) {
      const sum = ownPayments.filter(e => e.contractId === contract.id && Number(e.month.slice(0, 4)) === p.year)
        .reduce((total, event) => total + BigInt(event.cents), 0n);
      requireAvd(sum === BigInt(contract.ownCents), "CONTRACT_PAYMENTS_DIFFER", contract.id);
    }
  }
  const register: FundingRegister = { registerVersion: jsonHash([data, booked, settlements, assignments]), claims,
    activeClaimVersions: active.map(claimVersion), booked, hypothesis, opening: data.opening ?? previous?.register.opening ?? null,
    disjointSettlements: settlements, bookingAssignments: assignments, claimIssues: [
      ...people.flatMap(p => p.issues),
      ...(ownPayments === null && data.personYears.some(p => p.contracts.length > 1) ? [open("OWN_CONTRACT_PLAN_OPEN", "ownPayments")] : []),
    ] };
  const window = { from: "0100-01", through: "9999-12", lastFundingYear: null };
  deriveFunding(register, window); // Reject malformed historical identities before adopting any part.
  if (ownPayments) for (const event of ownPayments) monthIndex(event.month);
  return { people, register, ownPayments: ownPayments as readonly Cashflow[] | null, selectedSchedules };
}

/** Posted evidence survives changes of assumptions, contribution inputs and legal context. */
export function fundingRegisterForCase(data: FundingEvidence, isCurrent: boolean, openingUnchanged: boolean): FundingRegister {
  if (isCurrent && openingUnchanged) return data.register;
  return { ...data.register, registerVersion: jsonHash([data.register.registerVersion, "history-only"]),
    activeClaimVersions: [], claimIssues: [], hypothesis: null, openingContextOpen: !openingUnchanged && Boolean(data.register.opening) };
}
