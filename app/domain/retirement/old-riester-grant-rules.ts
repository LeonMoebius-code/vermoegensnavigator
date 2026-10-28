import type { OldRiesterRuleContext } from "./old-riester-grant-contract";

const root = "https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/";
const sources = Object.freeze([
  root + "0079/0079_2014_07_31.html",
  root + "0084/0084_2018_01_01.html",
  root + "0085/0085_2018_12_15.html",
  root + "0086/0086_2014_07_31.html",
  "https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuern/Steuerliche_Themengebiete/Rentenbesteuerung/2023-10-05-stl-foerderung-private-altersvorsorge.pdf?__blob=publicationFile&v=3",
]);
const common = { calculationVersion: "ap01b-v1", checkedOn: "2026-10-28", childEntitlementPeriod: "first" } as const;
// Explicit entries: never derive a later year's authority from a numeric range.
const rules: readonly OldRiesterRuleContext[] = Object.freeze([
  Object.freeze({ ...common, id: "alt-2026-checked-20261028", contributionYear: 2026,
    childParentAssignment: "old_until_2027", sources }),
  Object.freeze({ ...common, id: "alt-bestand-2027-checked-20261028", contributionYear: 2027,
    childParentAssignment: "old_until_2027", sources: Object.freeze([...sources,
      root + "0052/0052_2027_01_01.html", root + "0085/0085_2027_01_01.html",
      "https://www.recht.bund.de/bgbl/1/2026/156/regelungstext.pdf?__blob=publicationFile&v=1"]) }),
  Object.freeze({ ...common, id: "alt-bestand-2028-checked-20261028", contributionYear: 2028,
    childParentAssignment: "neutral_from_2028", sources: Object.freeze([...sources,
      root + "0052/0052_2028_01_01.html", root + "0085/0085_2028_01_01.html",
      "https://www.recht.bund.de/bgbl/1/2026/156/regelungstext.pdf?__blob=publicationFile&v=1"]) }),
]);
export function oldRiesterRuleContext(id: string): OldRiesterRuleContext | null {
  return rules.find(rule => rule.id === id) ?? null;
}
