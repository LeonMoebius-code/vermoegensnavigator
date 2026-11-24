import { canonicalJson, jsonHash } from "../case/recovery-hash";
import { copyAvd, requireAvd } from "./avd-data";
import { monthIndex } from "./premium-calendar";
import { open, type Cashflow, type Evidence, type FundingPerspective, type Open } from "./premium-contract";

export interface ClaimKey {
  readonly personId: string;
  readonly year: number;
  readonly component: "base" | "child" | "bonus";
  readonly childId: string | null;
  readonly bonusLifetimeKey: string | null;
}
export const claimId = (key: ClaimKey) => jsonHash([key.personId, key.year, key.component, key.childId, key.bonusLifetimeKey]);
export const childYearKey = (key: ClaimKey) => key.childId === null ? null : jsonHash([key.childId, key.year]);

export const settlementReference = (entry: FundingRegister["disjointSettlements"][number]) =>
  jsonHash(["child-settlement", entry]);

export interface ClaimPart {
  readonly id: string;
  readonly contractId: string;
  readonly allocationId: string;
  readonly allocationVersion: string;
  readonly cents: number;
  readonly evidence: Evidence;
}
export interface Claim {
  readonly key: ClaimKey;
  readonly claimRevision: string;
  readonly regimeVersion: string;
  readonly sourceVersion: string;
  readonly amount: { readonly cents: number; readonly evidence: Evidence } | null;
  readonly eligibility: Evidence | null;
  readonly parts: readonly ClaimPart[];
  readonly supersedes: string | null;
  readonly reconciliationGroup: string | null;
}
export const claimVersion = (claim: Claim) => jsonHash([claimId(claim.key), claim.regimeVersion, claim.claimRevision, claim.sourceVersion]);
const partKey = (claim: string, part: string, contract: string) => jsonHash([claim, part, contract]);

export type Booking = Cashflow & {
  readonly kind: "grant";
  readonly externalId: string;
  readonly claim: string;
  readonly claimVersion: string;
  readonly partId: string | null;
  readonly allocationId: string | null;
  readonly bookingVersion: string;
  readonly reverses: string | null;
  readonly openingInclusion: string | null;
  readonly amountEvidence: Evidence & { readonly class: "B" };
};
export type Hypothesis = Cashflow & {
  readonly kind: "grant";
  readonly claim: string;
  readonly claimVersion: string;
  readonly partId: string;
  readonly contractId: string;
  readonly allocationId: string;
  readonly allocationVersion: string;
  readonly hypothesisVersion: string;
  readonly scheduleRevision: string;
  readonly confirmedBookingIds: readonly string[];
  readonly amountEvidence: Evidence & { readonly class: "S" };
};
export interface FundingRegister {
  readonly registerVersion: string;
  readonly claims: readonly Claim[];
  readonly activeClaimVersions: readonly string[];
  readonly booked: readonly Booking[];
  readonly hypothesis: {
    readonly version: string;
    readonly scheduleRevision: string;
    readonly firstYear: number;
    readonly lastYear: number;
    readonly events: readonly Hypothesis[];
  } | null;
  readonly claimIssues?: readonly Open[];
  readonly openingContextOpen?: boolean;
  readonly opening: { readonly id: string; readonly includedBookingIds: readonly string[]; readonly composition: "known" | "open" } | null;
  readonly disjointSettlements: readonly { readonly oldBookingId: string; readonly childYearKey: string; readonly evidence: Evidence & { readonly class: "B" }; readonly month: string }[];
}

export function distinctRegister<T>(items: readonly T[], identity: (item: T) => string, at: string): T[] {
  const unique = new Map<string, T>();
  for (const item of items) {
    const id = identity(item), before = unique.get(id);
    requireAvd(Boolean(id) && (!before || canonicalJson(before) === canonicalJson(item)), "IDENTITY_COLLISION", at);
    if (!before) unique.set(id, item);
  }
  return [...unique.values()];
}

function claimIndex(claims: readonly Claim[]) {
  return new Map(distinctRegister(claims, claimVersion, "claim versions").map(claim => {
    const { key, amount, parts } = claim;
    requireAvd(Boolean(key.personId) && Number.isInteger(key.year) && key.year >= 100 && key.year <= 9999
      && Boolean(claim.regimeVersion && claim.claimRevision && claim.sourceVersion), "CLAIM_IDENTITY_OPEN", "claim");
    requireAvd(key.component === "child" ? Boolean(key.childId) : key.childId === null, "INVALID_CHILD_KEY", "claim.childId");
    requireAvd(key.component === "bonus" ? Boolean(key.bonusLifetimeKey) : key.bonusLifetimeKey === null,
      "INVALID_BONUS_KEY", "claim.bonusLifetimeKey");
    const amountCents = amount?.cents;
    if (amountCents !== undefined) requireAvd(Number.isSafeInteger(amountCents) && amountCents >= 0, "INVALID_CLAIM_AMOUNT", "claim.amount");
    const ids = new Set<string>(), allocations = new Set<string>();
    let allocated = 0n;
    for (const part of parts) {
      requireAvd(Boolean(part.id && part.allocationId && part.allocationVersion && part.contractId)
        && !ids.has(part.id) && !allocations.has(part.allocationId) && Number.isSafeInteger(part.cents) && part.cents >= 0,
      "INVALID_ALLOCATION_PARTITION", "claim.parts");
      ids.add(part.id);
      allocations.add(part.allocationId);
      allocated += BigInt(part.cents);
    }
    requireAvd(amountCents === undefined || allocated <= BigInt(amountCents), "ALLOCATION_OVER_CLAIM", "claim.parts");
    return [claimVersion(claim), claim] as const;
  }));
}

export function deriveFunding(input: FundingRegister, window: { from: string; through: string; lastFundingYear: number | null }) {
  const register = copyAvd(input) as FundingRegister;
  const { from, through, lastFundingYear } = window;
  requireAvd(monthIndex(from) <= monthIndex(through), "INVALID_VALUATION_WINDOW", "funding");
  const claims = claimIndex(register.claims);
  const booked = distinctRegister(register.booked, event => event.externalId, "booked.externalId");
  const ids = new Set<string>(), activeClaims = new Map<string, Claim>(), activeChildren = new Set<string>();
  const blockedChild = new Set<string>();
  const historyIssues: Open[] = register.openingContextOpen ? [open("OPENING_OVERLAP_OPEN", "funding.opening")] : [], combinedIssues: Open[] = [...(register.claimIssues ?? [])];
  const issues = (reason: string, path: string, month?: string) => combinedIssues.push(open(reason, path, month));
  for (const version of register.activeClaimVersions) {
    const claim = claims.get(version);
    requireAvd(claim, "UNKNOWN_ACTIVE_CLAIM", "activeClaimVersions");
    const id = claimId(claim.key), child = childYearKey(claim.key);
    if (activeClaims.has(id) || child && activeChildren.has(child)) issues("CLAIM_ASSIGNMENT_CONFLICT", "activeClaimVersions");
    if (child && activeChildren.has(child)) blockedChild.add(child);
    activeClaims.set(id, claim);
    if (child) activeChildren.add(child);
  }
  const bookingById = new Map(booked.map(event => [event.id, event]));
  const reversed = new Map<string, bigint>();
  const reversedInWindow = new Map<string, bigint>();
  const lastReversalInWindow = new Map<string, string>();
  const attachedReversals = new Map<string, bigint>();
  const bookedPart = (event: Booking) => {
    const part = claims.get(event.claimVersion)?.parts.find(item => item.id === event.partId);
    return part?.contractId === event.contractId && part?.allocationId === event.allocationId ? part : undefined;
  };
  const attached = (event: Booking) => {
    const part = bookedPart(event);
    if (!part || event.cents >= 0) return Boolean(part);
    const prior = bookingById.get(event.reverses!);
    const original = prior && bookedPart(prior);
    return original?.id === part.id && original.allocationId === part.allocationId
      && original.allocationVersion === part.allocationVersion;
  };
  const openingIds = new Set(register.opening?.includedBookingIds ?? []);
  for (const event of booked) {
    const claim = claims.get(event.claimVersion);
    requireAvd(!ids.has(event.id) && claim && claimId(claim.key) === event.claim && Number.isSafeInteger(event.cents)
      && event.amountEvidence.class === "B" && Boolean(event.bookingVersion), "BOOKING_IDENTITY_OPEN", "booked");
    requireAvd(Number(event.month.slice(0, 4)) >= claim.key.year && monthIndex(event.month) >= 0,
      "BOOKING_BEFORE_FUNDING_YEAR", "booked.month");
    ids.add(event.id);
    if (event.cents < 0) {
      const original = event.reverses && bookingById.get(event.reverses);
      requireAvd(original && original.cents > 0 && original.month <= event.month && original.claim === event.claim
        && original.contractId === event.contractId, "REVERSAL_REFERENCE_OPEN", "booked.reverses");
      const amount = (reversed.get(original.id) ?? 0n) - BigInt(event.cents);
      requireAvd(amount <= BigInt(original.cents), "REVERSAL_EXCEEDS_BOOKING", "booked.cents");
      reversed.set(original.id, amount);
      if (attached(event)) attachedReversals.set(original.id, (attachedReversals.get(original.id) ?? 0n) - BigInt(event.cents));
      if (event.month <= through) {
        reversedInWindow.set(original.id, (reversedInWindow.get(original.id) ?? 0n) - BigInt(event.cents));
        if (event.month > (lastReversalInWindow.get(original.id) ?? "")) lastReversalInWindow.set(original.id, event.month);
      }
    }
    if (event.month >= from && event.month <= through && !attached(event))
      historyIssues.push(open("BOOKING_ALLOCATION_OPEN", event.id, event.month));
    if (event.openingInclusion !== null && (!register.opening || event.openingInclusion !== register.opening.id || !openingIds.has(event.id) || event.month > from)
      || openingIds.has(event.id) && event.openingInclusion !== register.opening?.id)
      historyIssues.push(open("OPENING_OVERLAP_OPEN", event.id, event.month));
    if (register.opening?.composition === "open" && event.month === from && !openingIds.has(event.id))
      historyIssues.push(open("OPENING_OVERLAP_OPEN", event.id, event.month));
  }
  for (const id of openingIds) if (!bookingById.has(id)) historyIssues.push(open("OPENING_BOOKING_UNKNOWN", id));
  const inWindow = (e: Cashflow) => e.month >= from && e.month <= through;
  const history = booked.filter(event => inWindow(event) && attached(event) && !(event.month <= from && openingIds.has(event.id)));
  const positives = booked.filter(event => event.cents > 0);
  const byClaim = new Map<string, Booking[]>();
  const childReferences = new Map<string, string[]>();
  const childSettledThrough = new Map<string, string>();
  for (const event of booked) {
    byClaim.set(event.claim, [...(byClaim.get(event.claim) ?? []), event]);
    const child = childYearKey(claims.get(event.claimVersion)!.key);
    if (child) childReferences.set(child, [...(childReferences.get(child) ?? []), event.id]);
  }
  const settlementsByBooking = new Map<string, FundingRegister["disjointSettlements"][number]>();
  for (const settlement of register.disjointSettlements) {
    const original = bookingById.get(settlement.oldBookingId);
    if (!original || original.cents <= 0 || childYearKey(claims.get(original.claimVersion)!.key) !== settlement.childYearKey
      || settlement.evidence.class !== "B" || monthIndex(settlement.month) < monthIndex(original.month)) continue;
    settlementsByBooking.set(original.id, settlement);
    const child = settlement.childYearKey;
    childReferences.set(child, [...(childReferences.get(child) ?? []), settlementReference(settlement)]);
  }
  const drawnBonus = new Set<string>();
  for (const event of positives) {
    const previous = claims.get(event.claimVersion)!;
    if (previous.key.component === "bonus") drawnBonus.add(previous.key.personId);
    const child = childYearKey(previous.key);
    if (!child || !activeChildren.has(child)) continue;
    const successor = [...activeClaims.values()].find(c => childYearKey(c.key) === child);
    if (!successor || claimId(successor.key) === event.claim) continue;
    const linked = successor.supersedes === event.claim && successor.reconciliationGroup === child;
    const reversalMonth = reversedInWindow.get(event.id) === BigInt(event.cents) ? lastReversalInWindow.get(event.id) : undefined;
    const documented = settlementsByBooking.get(event.id)?.month;
    const disjointMonth = documented && documented <= through ? documented : undefined;
    const settled = reversalMonth && disjointMonth
      ? (reversalMonth < disjointMonth ? reversalMonth : disjointMonth) : reversalMonth ?? disjointMonth;
    if (!linked || !settled) blockedChild.add(child);
    else if (settled > (childSettledThrough.get(child) ?? "")) childSettledThrough.set(child, settled);
  }
  for (const child of blockedChild) issues("AUSGLEICH_OFFEN", child);
  const selected = register.hypothesis;
  const hypotheses = selected ? distinctRegister(selected.events, event => event.id, "hypothesis.eventId") : [];
  const projected: Hypothesis[] = [];
  const seenParts = new Set<string>();
  const plannedBonus = new Map<string, string>();
  const plannedByPart = new Map<string, bigint>();
  const plannedByClaim = new Map<string, bigint>();
  if (selected) requireAvd(Number.isInteger(selected.firstYear) && Number.isInteger(selected.lastYear)
    && selected.firstYear <= selected.lastYear && Boolean(selected.version && selected.scheduleRevision), "HYPOTHESIS_HORIZON_OPEN", "hypothesis");
  for (const event of hypotheses) {
    requireAvd(!ids.has(event.id), "IDENTITY_COLLISION", "hypothesis.eventId");
    const claim = activeClaims.get(event.claim);
    if (!claim || claimVersion(claim) !== event.claimVersion) continue;
    const child = childYearKey(claim.key), part = claim.parts.find(item => item.id === event.partId);
    if (child && blockedChild.has(child) || claim.key.component === "bonus" && drawnBonus.has(claim.key.personId)) continue;
    const group = byClaim.get(event.claim) ?? [];
    const basis = child ? childReferences.get(child) ?? [] : group.map(item => item.id);
    const known = new Set(event.confirmedBookingIds);
    const settledThrough = child ? childSettledThrough.get(child) : undefined;
    // A month alone cannot establish that a same-month hypothesis follows an actual settlement.
    if (basis.length !== known.size || basis.some(id => !known.has(id)) || settledThrough && event.month <= settledThrough) continue;
    const knownPositive = group.filter(item => item.cents > 0);
    const key = partKey(event.claim, event.partId, event.contractId);
    if (knownPositive.some(item => item.partId === event.partId && item.contractId === event.contractId)) continue;
    if (!selected || event.hypothesisVersion !== selected.version || event.scheduleRevision !== selected.scheduleRevision
      || claim.key.year < selected.firstYear || claim.key.year > selected.lastYear
      || lastFundingYear !== null && claim.key.year > lastFundingYear || !claim.amount || !claim.eligibility
      || !part || event.contractId !== part.contractId || event.allocationId !== part.allocationId
      || event.allocationVersion !== part.allocationVersion || seenParts.has(key)
      || event.amountEvidence.class !== "S" || !Number.isSafeInteger(event.cents) || event.cents < 0 || event.cents > part.cents
      || Number(event.month.slice(0, 4)) < claim.key.year) {
      issues("HYPOTHESIS_OPEN", event.id);
      continue;
    }
    monthIndex(event.month);
    const already = knownPositive.reduce((sum, item) => sum + BigInt(item.cents), 0n);
    const total = (plannedByClaim.get(event.claim) ?? 0n) + BigInt(event.cents);
    if (total + already > BigInt(claim.amount.cents)) {
      issues("HYPOTHESIS_EXCEEDS_REMAINDER", event.id);
      continue;
    }
    if (claim.key.component === "bonus") {
      const prior = plannedBonus.get(claim.key.personId);
      if (prior && prior !== event.claim) { issues("DUPLICATE_LIFETIME_BONUS", event.id); continue; }
      plannedBonus.set(claim.key.personId, event.claim);
    }
    seenParts.add(key);
    plannedByClaim.set(event.claim, total);
    plannedByPart.set(key, BigInt(event.cents));
    projected.push(event);
  }
  for (const [id, claim] of activeClaims) {
    if (lastFundingYear !== null && claim.key.year > lastFundingYear) continue;
    const coverage = new Map<string, bigint>();
    let unmapped = 0n;
    for (const event of byClaim.get(id) ?? []) {
      if (event.cents <= 0) continue;
      const net = BigInt(event.cents) - (attachedReversals.get(event.id) ?? 0n);
      const original = bookedPart(event);
      const current = claim.parts.find(part => part.id === original?.id && part.contractId === original.contractId
        && part.allocationId === original.allocationId && part.allocationVersion === original.allocationVersion);
      if (!current || claims.get(event.claimVersion)!.regimeVersion !== claim.regimeVersion) unmapped += net;
      else coverage.set(current.id, (coverage.get(current.id) ?? 0n) + net);
    }
    const allocated = claim.parts.reduce((total, part) => total + BigInt(part.cents), 0n);
    if (!claim.amount || !claim.eligibility || allocated !== BigInt(claim.amount.cents) || unmapped !== 0n
      || claim.parts.some(part => (coverage.get(part.id) ?? 0n) + (plannedByPart.get(partKey(id, part.id, part.contractId)) ?? 0n) !== BigInt(part.cents)))
      issues("CLAIM_REMAINDER_OPEN", id);
  }
  if (register.activeClaimVersions.length === 0) issues("FUNDING_SELECTION_OPEN", "funding");
  const perspectives: Record<FundingPerspective, { readonly payments: readonly Cashflow[]; readonly issues: readonly Open[] }> = {
    OHNE_ZULAGEN: { payments: [], issues: [] },
    NUR_BELEGTE_HISTORIE: { payments: history, issues: historyIssues },
    BEDINGT_KOMBINIERT: { payments: [...history, ...projected.filter(inWindow)], issues: [...historyIssues, ...combinedIssues] },
  };
  return copyAvd({ registerVersion: register.registerVersion, ledger: booked, perspectives,
    includedInOpening: booked.filter(event => openingIds.has(event.id)),
    outsideValuation: [...booked, ...projected].filter(event => !inWindow(event)),
  }) as { readonly registerVersion: string; readonly ledger: readonly Booking[]; readonly perspectives: typeof perspectives;
    readonly includedInOpening: readonly Booking[]; readonly outsideValuation: readonly Cashflow[] };
}
