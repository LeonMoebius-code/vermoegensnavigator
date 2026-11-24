import { jsonHash } from "../case/recovery-hash";
import { copyAvd, description, id, integer, list, nullable, oneOf, requireAvd, shape, type Rule } from "./avd-data";
import { directGrantAmounts } from "./direct-grant";
import { calculateOldRiesterGrant } from "./old-riester-grant";
import { oldRiesterRuleContext } from "./old-riester-grant-rules";
import { directGrantRuleContext } from "./direct-grant-rules";
import { childYearKey, claimId, type Claim, type ClaimKey, type ClaimPart } from "./premium-funding";
import { open, type Evidence, type Open } from "./premium-contract";

const money = integer(0, Number.MAX_SAFE_INTEGER);
const year = integer(100, 9999);
export const grantEvidence = shape({ class: oneOf("B", "S"), source: description, version: id });
function fact<T>(value: Rule<T>) { return shape({ value, evidence: grantEvidence }); }

const contract = shape({ id, ownCents: money, eligibility: grantEvidence });
const child = shape({ id, benefit: nullable(fact(oneOf("yes", "no"))),
  assignedPerson: nullable(fact(id)), supersedesPerson: nullable(id) });
const bonus = shape({ beforeAgeLimit: nullable(fact(oneOf("yes", "no"))),
  priorReceipt: nullable(fact(oneOf("paid", "not_paid"))) });
const component = oneOf("base", "child", "bonus");
const allocationFields = { component, childId: nullable(id), contractId: id, cents: money, evidence: grantEvidence };
const wholeAllocation = shape(allocationFields);
const distinctAllocation = shape({ ...allocationFields, part: id });
const allocation = (input: unknown, at: string) => input && typeof input === "object" && Object.hasOwn(input, "part")
  ? distinctAllocation(input, at) : wholeAllocation(input, at);
export const allocationPartId = (claim: string, contract: string, part?: string) =>
  jsonHash(part ? [claim, contract, part] : [claim, contract]);
const person = shape({ personId: id, year, ruleVersion: oneOf("estg-2027-v1", "estg-2028-v1",
    "alt-2026-checked-20261028", "alt-bestand-2027-checked-20261028", "alt-bestand-2028-checked-20261028"),
  situation: nullable(fact(oneOf("direct_new", "direct_old", "indirect", "ineligible"))),
  oldRiester: (input: unknown) => input,
  partnerPersonId: nullable(id),
  partnerReview: nullable(fact(oneOf("old_direct_new_indirect_excluded", "requires_individual_review"))),
  contractScope: nullable(grantEvidence), contracts: list(contract, 10), childScope: nullable(grantEvidence),
  children: list(child, 25), bonus, allocations: list(allocation, 54) });
export const personYearList = list(person, 100);
export type PersonYearInput = ReturnType<typeof person>;
type GrantFact = ReturnType<typeof grantEvidence>;
type Component = ReturnType<typeof component>;

function combine(rules: string, values: readonly GrantFact[]): GrantFact {
  return { class: values.some(item => item.class === "S") ? "S" : "B", source: rules, version: jsonHash(values) };
}

export function calculatePersonalFunding(input: unknown) {
  const people = personYearList(copyAvd(input), "personenjahre");
  const byPersonYear = new Set<string>();
  const childOwners = new Map<string, Set<string>>();
  const contractOwners = new Map<string, string>();
  for (const p of people) {
    const key = jsonHash([p.personId, p.year]);
    requireAvd(!byPersonYear.has(key), "DUPLICATE_PERSON_YEAR", "personenjahre");
    byPersonYear.add(key);
    for (const contract of p.contracts) {
      const contractYear = jsonHash([contract.id, p.year]);
      const owner = contractOwners.get(contractYear);
      requireAvd(owner === undefined || owner === p.personId, "CONTRACT_OWNER_CONFLICT", contract.id);
      contractOwners.set(contractYear, p.personId);
    }
    for (const k of p.children) {
      if (k.benefit?.value !== "yes" || !k.assignedPerson) continue;
      const childKey = jsonHash([k.id, p.year]);
      let owners = childOwners.get(childKey);
      if (!owners) childOwners.set(childKey, owners = new Set());
      owners.add(k.assignedPerson.value);
    }
  }
  const earlierBonus = new Set<string>();
  return [...people].sort((a, b) => a.year - b.year).map(p => {
    const issues: Open[] = [];
    const claims: Claim[] = [];
    const isNew = p.ruleVersion === "estg-2027-v1" || p.ruleVersion === "estg-2028-v1";
    const rules = isNew ? directGrantRuleContext(p.ruleVersion as "estg-2027-v1" | "estg-2028-v1") : oldRiesterRuleContext(p.ruleVersion)!;
    const context = p.situation;
    const validRules = rules.contributionYear === p.year;
    const contracts = new Set(p.contracts.map(c => c.id));
    requireAvd(contracts.size === p.contracts.length, "DUPLICATE_CONTRACT", p.personId);
    requireAvd(new Set(p.children.map(c => c.id)).size === p.children.length, "DUPLICATE_CHILD_YEAR", p.personId);
    requireAvd(p.allocations.every(a => (a.component === "child") === (a.childId !== null)
      && contracts.has(a.contractId) && (a.childId === null || p.children.some(child => child.id === a.childId))),
    "ALLOCATION_TARGET_INVALID", p.personId);
    const own = p.contracts.reduce((total, c) => total + BigInt(c.ownCents), 0n);
    requireAvd(own <= BigInt(Number.MAX_SAFE_INTEGER), "CONTRIBUTION_OVERFLOW", p.personId);
    const basis = validRules && (isNew ? context?.value === "direct_new" : context?.value === "direct_old") && context && p.contractScope && p.contracts.length > 0
      ? combine(rules.id, [context.evidence, p.contractScope, ...p.contracts.map(c => c.eligibility)]) : null;
    const partner = people.find(entry => entry.personId === p.partnerPersonId && entry.year === p.year && entry.personId !== p.personId);
    const old = !isNew && basis && p.contracts.length === 1 ? calculateOldRiesterGrant(p.oldRiester) : null;
    const oldAmounts = old?.status === "calculated" && old.contributionYear === p.year && old.ruleContext?.id === rules.id
      && p.oldRiester && typeof p.oldRiester === "object" && "eligibleOwnContributionCents" in p.oldRiester
      && p.oldRiester.eligibleOwnContributionCents === Number(own) ? old : null;
    const exclusion = validRules && context?.value === "ineligible" ? context.evidence
      : validRules && context?.value === "indirect" && p.partnerReview?.value === "old_direct_new_indirect_excluded"
        && p.partnerReview.evidence.class === "B" && context.evidence.class === "B"
        && isNew && partner?.situation?.value === "direct_old" && partner.situation.evidence.class === "B"
        && oldRiesterRuleContext(partner.ruleVersion)?.contributionYear === p.year ? p.partnerReview.evidence : null;
    const amounts = basis && isNew ? directGrantAmounts(Number(own), []) : oldAmounts;
    const personIssues = !validRules ? "YEAR_RULE_OPEN" : context?.value === "indirect" ? "PARTNER_REVIEW_OPEN" : "ELIGIBILITY_OPEN";
    const limit = context?.value === "indirect" ? 1 : 2;
    const allDestinations = new Set(p.allocations.filter(a => a.cents > 0).map(a => a.contractId));
    const limitValid = allDestinations.size <= limit;
    if (!limitValid) issues.push(open("ALLOCATION_CONTRACT_LIMIT", p.personId));

    function componentClaim(kind: Component, childId: string | null, cents: number | null,
      evidence: GrantFact | null, reason: string, previous: string | null = null) {
      const key: ClaimKey = { personId: p.personId, year: p.year, component: kind, childId,
        bonusLifetimeKey: kind === "bonus" ? jsonHash([p.personId, "entry-bonus"]) : null };
      const all = p.allocations.filter(a => a.component === kind && a.childId === childId);
      const ids = all.map(a => allocationPartId(claimId(key), a.contractId, "part" in a && typeof a.part === "string" ? a.part : undefined));
      const mixed = all.some(a => !("part" in a) && all.some(other => other !== a && other.contractId === a.contractId));
      const partitionComplete = cents !== null && all.reduce((total, a) => total + BigInt(a.cents), 0n) === BigInt(cents);
      const partitionSafe = limitValid && all.length <= 10 && !mixed && new Set(ids).size === ids.length && cents !== null
        && all.reduce((total, a) => total + BigInt(a.cents), 0n) <= BigInt(cents);
      if (cents === null) issues.push(open(reason, claimId(key)));
      else if (!partitionComplete || !partitionSafe) issues.push(open("ALLOCATION_OPEN", claimId(key)));
      const parts: ClaimPart[] = !partitionSafe ? [] : all.flatMap((a, index) => a.cents === 0 ? [] : [{
        id: ids[index], contractId: a.contractId, allocationId: ids[index], allocationVersion: jsonHash(a), cents: a.cents, evidence: a.evidence,
      }]);
      const claimEvidence: Evidence | null = evidence;
      const claim: Claim = { key, claimRevision: jsonHash([p, kind, childId, cents, evidence]), regimeVersion: rules.id,
        sourceVersion: evidence?.version ?? jsonHash([rules.id, reason]), amount: cents === null || !evidence ? null : { cents, evidence },
        eligibility: claimEvidence, parts, supersedes: previous === null ? null : claimId({ ...key, personId: previous }),
        reconciliationGroup: previous === null ? null : childYearKey(key) };
      claims.push(claim);
    }

    componentClaim("base", null, exclusion ? 0 : amounts?.baseGrantCents ?? null, exclusion ?? basis,
      amounts && "numerator" in amounts ? "GRANT_ROUNDING_OPEN" : personIssues);
    if ((!p.childScope || oldAmounts?.childGrants.some(oldChild => !p.children.some(child => child.id === oldChild.childId)))
      && !exclusion) issues.push(open("CHILD_YEAR_OPEN", p.personId));
    for (const k of p.children) {
      const owners = childOwners.get(jsonHash([k.id, p.year]));
      if (k.assignedPerson && k.assignedPerson.value !== p.personId && k.assignedPerson.evidence.class === "B"
        && (!owners || owners.size <= 1)) continue;
      if (owners && owners.size > 1) {
        componentClaim("child", k.id, null, null, "CHILD_ASSIGNMENT_CONFLICT", k.supersedesPerson);
      } else if (exclusion || k.benefit?.value === "no" && k.benefit.evidence.class === "B") {
        componentClaim("child", k.id, 0, exclusion ?? k.benefit!.evidence, "CHILD_YEAR_OPEN");
      } else {
        const evidence = basis && p.childScope && k.benefit?.value === "yes" && k.assignedPerson?.value === p.personId
          ? combine(rules.id, [basis, p.childScope, k.benefit.evidence, k.assignedPerson.evidence]) : null;
        const childAmount = isNew ? Number(own) < 12000 ? 0 : Math.min(Number(own), 30000)
          : oldAmounts?.childGrants.find(child => child.childId === k.id)?.grantCents ?? null;
        componentClaim("child", k.id, evidence ? childAmount : null, evidence, "CHILD_YEAR_OPEN", k.supersedesPerson);
      }
    }

    const { beforeAgeLimit, priorReceipt } = p.bonus;
    const previousBonus = earlierBonus.has(p.personId);
    if (oldAmounts || exclusion || beforeAgeLimit?.value === "no" && beforeAgeLimit.evidence.class === "B"
      || priorReceipt?.value === "paid" && priorReceipt.evidence.class === "B") {
      componentClaim("bonus", null, 0, exclusion ?? (oldAmounts ? basis : priorReceipt?.value === "paid" && priorReceipt.evidence.class === "B" ? priorReceipt.evidence : beforeAgeLimit!.evidence), "BONUS_OPEN");
      if (priorReceipt?.value === "paid" && priorReceipt.evidence.class === "B") earlierBonus.add(p.personId);
    } else if (isNew && basis && own < 12000n) {
      componentClaim("bonus", null, 0, basis, "BONUS_OPEN");
    } else if (isNew && basis && beforeAgeLimit?.value === "yes" && priorReceipt?.value === "not_paid" && !previousBonus) {
      componentClaim("bonus", null, 20000, combine(rules.id, [basis, beforeAgeLimit.evidence, priorReceipt.evidence]), "BONUS_OPEN");
      // A later year needs proof of receipt; an earlier modeled claim alone does not prove a zero.
      earlierBonus.add(p.personId);
    } else componentClaim("bonus", null, null, null, "BONUS_OPEN");

    const amountsKnown = claims.every(c => c.amount !== null) && Boolean(p.childScope || exclusion)
      && !issues.some(issue => issue.reason === "CHILD_YEAR_OPEN" && issue.path === p.personId);
    const totalCents = amountsKnown ? claims.reduce((sum, c) => sum + c.amount!.cents, 0) : null;
    return { personId: p.personId, year: p.year, ownCents: Number(own), ruleVersion: rules.id, claims, totalCents,
      status: totalCents === null ? "O" as const : issues.length || claims.some(c => c.amount?.evidence.class === "S") ? "S" as const : "B" as const,
      issues };
  });
}
