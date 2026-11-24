import { calculatePersonalFunding, type PersonYearInput } from "../../app/domain/retirement/premium-entitlement";
import { claimId, claimVersion, type Booking } from "../../app/domain/retirement/premium-funding";
import { reference } from "../../app/domain/retirement/identity-contract";
import type { PremiumProductPath, PremiumWorkspace } from "../../app/presentation/retirement/premium-product-configuration";
import type { ChannelRights } from "../../app/domain/retirement/premium-session";
import { record, syntheticCatalog } from "./avd-catalog-fixture";

export const evidenceB = { class: "B", source: "Synthetischer Prüfbeleg", version: "evidence-v1" } as const;
export const evidenceS = { class: "S", source: "Synthetische Modellannahme", version: "scenario-v1" } as const;
export function personYear(change: Partial<PersonYearInput> = {}): PersonYearInput {
  return { personId: "P", year: 2027, ruleVersion: "estg-2027-v1",
    situation: { value: "direct_new", evidence: evidenceB }, oldRiester: null, partnerPersonId: null, partnerReview: null,
    contractScope: evidenceB, contracts: [{ id: "V1", ownCents: 120000, eligibility: evidenceB }, { id: "V2", ownCents: 120000, eligibility: evidenceB }],
    childScope: evidenceB, children: [{ id: "K", benefit: { value: "yes", evidence: evidenceB },
      assignedPerson: { value: "P", evidence: evidenceB }, supersedesPerson: null }],
    bonus: { beforeAgeLimit: { value: "no", evidence: evidenceB }, priorReceipt: null }, allocations: [], ...change };
}
export function confirmedTransfer(person: PersonYearInput, cents: number, contractId = "V1", month = "2028-08") {
  const claim = calculatePersonalFunding([person])[0].claims.find(c => c.key.component === "base")!;
  const part = claim.parts.find(p => p.contractId === contractId)!;
  return { id: "payment-" + contractId, externalId: "statement-" + contractId, claim: claimId(claim.key), claimVersion: claimVersion(claim),
    kind: "grant", contractId, partId: part.id, allocationId: part.allocationId, month, cents, bookingVersion: "statement-v1",
    reverses: null, openingInclusion: null, amountEvidence: evidenceB } satisfies Booking;
}
export function fundingFile(personYears: readonly PersonYearInput[], bookings: readonly Booking[] = []) {
  return { format: "avd.funding-evidence.v1", personYears, historicClaims: [], bookings, chosenSchedule: null,
    opening: null, settlements: [], ownPayments: personYears.flatMap(person => person.contracts.map(contract => ({
      id: person.personId + "-" + contract.id + "-" + person.year, contractId: contract.id,
      month: person.year + "-12", cents: contract.ownCents, kind: "special", amountEvidence: evidenceB,
    }))) };
}
export const allowedChannels: ChannelRights = {
  screen: { allowed: true, version: "screen-v1" }, csv: { allowed: true, version: "csv-v1" },
  pdf: { allowed: true, version: "pdf-v1" }, json: { allowed: false, version: "json-off" }, print: { allowed: false, version: "print-off" },
};
export function syntheticPremiumWorkspace() {
  const catalog = syntheticCatalog();
  const product = { product: reference(record(catalog, "synthetic-product-1", "product")),
    tariff: reference(record(catalog, "synthetic-tariff-1", "tariff")) };
  const path: PremiumProductPath = { selection: "basis", product,
    costM1: { mode: "K1", cost: reference(record(catalog, "synthetic-k1-m1-1", "cost")), scenario: null },
    costM2: { mode: "K1", cost: reference(record(catalog, "synthetic-k1-m2-1", "cost")), scenario: null },
    cashflowOrders: [],
    returns: { version: "return-v1", evidence: evidenceS, monthlyBps: {},
      annualBps: { equity: 1000, bond: 0, cash: 0, commodity: 0, secured_assets: 0 } },
    options: [{ label: "Synthetische freie Aufteilung", profile: { product, model: "synthetic_reference", option: "free", comfort: null,
      optionEvidence: evidenceS,
      positions: [
        { id: "Aktien", assetClass: "equity", fund: null,
          exposure: [{ fromMonth: "2026-01", toMonthExclusive: null, weightBps: 10000, evidence: evidenceB }] },
        { id: "Sicherung", assetClass: "secured_assets", fund: null,
          exposure: [{ fromMonth: "2026-01", toMonthExclusive: null, weightBps: 0, evidence: evidenceB }] },
      ],
      openingWeightsBps: [6000, 4000], windows: [{ id: "initial", fromMonth: "2027-01", toMonthExclusive: null,
        evidence: evidenceS, openingAction: "CASHFLOW_ONLY", targetWeightsBps: [6000, 4000], cashflowWeightsBps: [6000, 4000] }],
      annualRebalance: null, endActions: [], resolutions: [] } }],
  };
  return { catalog, paths: [path], rights: allowedChannels, scope: "internal" } satisfies PremiumWorkspace;
}
