import { test, expect } from "@playwright/test";
import { calculateDirectGrant } from "../../app/domain/retirement/direct-grant";
import type { DirectGrantInput } from "../../app/domain/retirement/direct-grant-contract";
import { annualContribution, changeMode, changeYear, emptyGrantDraft, parseEuroCents, previewGrant, type GrantDraft } from "../../app/presentation/retirement/direct-grant-adapter";
const standard = (): GrantDraft => ({ ...emptyGrantDraft(), entitlement: "direct_confirmed", regime: "new_confirmed",
  contract: "single_eligible_confirmed", childrenStatus: "none_confirmed", annual: "360", quality: "planned", contributionConfirmed: true });

test("A04-04/05/07/11/14: vollständige Domainvergleichsmatrix, keine Bonusaddition", () => {
  for (const year of [2027, 2028]) for (const raw of ["0", "59,99", "60", "119,99", "120", "120,01", "300", "360", "360,01", "1.800", "6.840"]) for (const count of [0, 1, 3]) {
    const draft: GrantDraft = { ...standard(), year, annual: raw, childrenStatus: count ? "assigned_confirmed" : "none_confirmed",
      children: Array.from({ length: count }, (_, i) => ({ id: `synthetic-${i}`, status: "eligible_assigned_confirmed" })) };
    const input: DirectGrantInput = { contributionYear: year, ruleContext: year === 2027 ? "estg-2027-v1" : "estg-2028-v1",
      entitlement: "direct_confirmed", regime: "new_confirmed", eligibleContractContext: "single_eligible_confirmed",
      eligibleOwnContributionCents: parseEuroCents(raw)!, children: draft.children.map(c => ({ ...c, contributionYear: year })), pendingEvidence: ["bonus"] };
    const original = JSON.stringify(draft), direct = calculateDirectGrant(input), actual = previewGrant(draft);
    expect(actual.status).toBe(direct.status);
    if (actual.status === "calculated") {
      expect(actual.result).toEqual(direct); expect(actual.input).toEqual(input);
      expect(actual.result.bonus.includedInTotal).toBe(false);
    } else { expect(actual.domain).toEqual(direct); expect(actual).not.toHaveProperty("annualCents"); }
    expect(JSON.stringify(draft)).toBe(original);
  }
});
test("A04-06/09/10: Parser, sichere Centgrenzen, falsche Jahre und UI-Einzahlungsgrenze", () => {
  for (const [text, cents] of [["0", 0], ["120,01", 12001], ["1.800,50", 180050], ["0,1", 10], ["90.071.992.547.409,91", Number.MAX_SAFE_INTEGER]] as const) expect(parseEuroCents(text)).toBe(cents);
  for (const raw of ["", " ", "-0", "-1", "+1", "1.2", "1,234", "1e3", "Infinity", "NaN", "0x10", "120,", "1,2,3", "1 000", "90.071.992.547.409,92", "9".repeat(129)]) {
    expect(parseEuroCents(raw)).toBeNull(); expect(previewGrant({ ...standard(), annual: raw }).status).toBe("invalid_input");
  }
  expect(previewGrant({ ...standard(), year: 2026 }).status).toBe("unsupported");
  expect(previewGrant({ ...standard(), year: 2029 }).status).toBe("review_required");
  expect(previewGrant({ ...standard(), annual: "6840,01" }).status).toBe("review_required");
});
test("A04-08: Oktober drei Raten plus Einmalzahlung exakt; keine automatische Zwölfmonatsbasis", () => {
  const d: GrantDraft = { ...standard(), mode: "monthly", monthly: "25,01", startMonth: "10", months: "3", hasOneOff: true, oneOff: "44,97" };
  expect(annualContribution(d)).toEqual({ status: "valid", cents: 12000, terms: [2501, 3, 4497] });
  expect(previewGrant(d).status).toBe("calculated");
  for (const months of ["", "0", "4", "12", "3.0", "-1"]) expect(annualContribution({ ...d, months }).status).toBe("invalid_input");
  expect(annualContribution({ ...d, monthly: "90.071.992.547.409,91" }).status).toBe("invalid_input");
  const switched = changeMode(d, "annual");
  expect(switched.annual).toBe(""); expect(switched.contributionConfirmed).toBe(false);
});
test("A04-03/12/13/15: offene Nachweise und Scopeausschlüsse zeigen keine Förderbeträge", () => {
  const cases: Partial<GrantDraft>[] = [ { entitlement: "unconfirmed" }, { regime: "unconfirmed" }, { contract: "unconfirmed" },
    { contract: "transition_unconfirmed" }, { childrenStatus: "unconfirmed" }, { childrenStatus: "conflicting" },
    { childrenStatus: "assigned_confirmed", children: [] }, { childrenStatus: "none_confirmed", children: [{ id: "synthetic", status: "eligible_assigned_confirmed" }] },
    { childrenStatus: "assigned_confirmed", children: [{ id: "synthetic", status: "assignment_unconfirmed" }] },
    { contributionConfirmed: false }, { quality: "unconfirmed" } ];
  for (const patch of cases) { const result = previewGrant({ ...standard(), ...patch }); expect(result.status).toBe("review_required"); expect(result).not.toHaveProperty("result"); }
  for (const patch of [{ entitlement: "indirect" }, { entitlement: "ineligible" }, { regime: "old" }, { contract: "multiple" }] as const) {
    const result = previewGrant({ ...standard(), ...patch });
    const input: DirectGrantInput = { contributionYear: 2027, ruleContext: "estg-2027-v1", entitlement: "direct_confirmed", regime: "new_confirmed", eligibleContractContext: "single_eligible_confirmed", eligibleOwnContributionCents: 36000, children: [], pendingEvidence: ["bonus"] };
    const expected = calculateDirectGrant({ ...input, ...("contract" in patch ? { eligibleContractContext: patch.contract } : patch) });
    expect(result.status).toBe("unsupported"); if (result.status !== "calculated") expect(result.domain).toEqual(expected);
  }
  const changed = changeYear({ ...standard(), childrenStatus: "assigned_confirmed", children: [{ id: "opaque", status: "eligible_assigned_confirmed" }] }, 2028);
  expect(changed.entitlement).toBe("unconfirmed"); expect(changed.childrenStatus).toBe("unconfirmed");
  expect(changed.children[0].status).toBe("assignment_unconfirmed"); expect(changed.contributionConfirmed).toBe(false);
});
