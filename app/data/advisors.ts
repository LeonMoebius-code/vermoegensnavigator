import type { AdvisorId } from "../domain/advisory/contracts";

export const advisors = [
  {
    id: "leon-moebius",
    initials: "LM",
    name: "Leon Möbius",
    title: "Spezialist Vermögensmanagement",
  },
  {
    id: "jochen-walz",
    initials: "JW",
    name: "Jochen Walz",
    title: "Spezialist Vermögensmanagement",
  },
  {
    id: "david-gerhardt",
    initials: "DG",
    name: "David Gerhardt",
    title: "Spezialist Vermögensmanagement",
  },
  {
    id: "michael-friedrich",
    initials: "MF",
    name: "Michael Friedrich",
    title: "Spezialist Vermögensmanagement",
  },
  {
    id: "corinna-roehl",
    initials: "CR",
    name: "Corinna Röhl",
    title: "Spezialistin Vermögensmanagement",
  },
  {
    id: "emanuel-bock",
    initials: "EB",
    name: "Emanuel Bock",
    title: "Spezialist Vermögensmanagement",
  },
] as const;

export const defaultAdvisorId: AdvisorId = "leon-moebius";

// Contract and runtime literals must describe the same set in both directions.
type SameUnion<A, B> =
  [Exclude<A, B>, Exclude<B, A>] extends [never, never] ? true : false;
type Assert<T extends true> = T;
type _AdvisorIdContractMatchesRuntime =
  Assert<SameUnion<AdvisorId, (typeof advisors)[number]["id"]>>;
