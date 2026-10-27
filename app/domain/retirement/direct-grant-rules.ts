import type { DirectGrantRuleContext, DirectGrantRuleId } from "./direct-grant-contract";

const root = "https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/";

/** Fresh metadata on each call: callers cannot mutate later results. */
export function directGrantRuleContext(id: DirectGrantRuleId): DirectGrantRuleContext {
  const year = id === "estg-2027-v1" ? 2027 : 2028;
  return {
    id, contributionYear: year, calculationVersion: "ap01a-v1", checkedOn: "2026-10-27",
    baseAndMinimumEffectiveFrom: "2027-01-01", childAssignmentEffectiveFrom: `${year}-01-01`,
    sources: [
      `${root}0084/0084_2027_01_01.html`,
      `${root}0085/0085_${year}_01_01.html`,
      `${root}0086/0086_2027_01_01.html`,
    ],
  };
}
