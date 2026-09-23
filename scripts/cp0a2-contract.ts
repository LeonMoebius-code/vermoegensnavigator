import assert from "node:assert/strict";

/** Classification is part of every reference, never inferred from a passing test. */
export const categories = {
  A: "Fachlich bestätigt: Gleichwertigkeit verbindlich",
  B: "Technisch beobachtet: Abweichung untersuchen, kein fachlicher Sollzustand",
  C: "Bekannter Fehler: Reproduktion, ausdrücklich kein korrekter Sollzustand",
  D: "Offene fachliche Semantik: Entscheidung ausstehend",
} as const;
export type Reference = {
  id: string;
  category: keyof typeof categories;
  invariant: string;
  evidence: string;
  relevance: string;
};
export type Rule = { kind: "exact" } | { kind: "cent" } |
  { kind: "absolute"; tolerance: number; evidence: string };
export const exact: Rule = { kind: "exact" };
export const cent: Rule = { kind: "cent" };

/** No global epsilon and no rounding of actual results. */
export function compare(actual: unknown, expected: unknown, rule: Rule, label: string) {
  if (rule.kind === "absolute") {
    assert.ok(rule.evidence && Number.isFinite(rule.tolerance) && rule.tolerance > 0, "Tolerance requires provenance and a finite positive bound");
    assert.equal(typeof actual, "number", label);
    assert.equal(typeof expected, "number", label);
    assert.ok(Number.isFinite(actual) && Number.isFinite(expected), label);
    assert.ok(Math.abs((actual as number) - (expected as number)) <= rule.tolerance,
      `${label}: ${actual} != ${expected} (absolute tolerance ${rule.tolerance})`);
  } else {
    if (rule.kind === "cent") {
      for (const value of [actual, expected]) {
        assert.equal(typeof value, "number", label);
        // Validate cent granularity by round trip, never silently round the result.
        assert.ok(Number.isFinite(value) && Number.isSafeInteger(Math.round((value as number) * 100)), label);
        assert.equal(Math.round((value as number) * 100) / 100, value, `${label}: sub-cent value`);
      }
    }
    assert.deepEqual(actual, expected, label);
  }
}

type Kind = "CASE" | "DEPOT" | "HOLDING" | "PLAN" | "ALLOCATION" | "INVESTMENT" | "VERSION";
/** Register entities BEFORE reading references; one registry spans all lifecycle stages.
 * Entity order is significant. Unknown references remain distinct DANGLING tokens.
 * No heuristic string replacement, sorting, or deletion of identity fields.
 */
export class Ids {
  private entities = new Map<Kind, Map<string, string>>();
  private dangling = new Map<Kind, Map<string, string>>();
  entity(kind: Kind, raw: string): string {
    assert.ok(typeof raw === "string" && raw.length > 0, `Missing ${kind} identity`);
    const map = this.entities.get(kind) || new Map<string, string>();
    this.entities.set(kind, map);
    if (!map.has(raw)) map.set(raw, `${kind}_${map.size + 1}`);
    return map.get(raw)!;
  }
  ref(kind: Kind, raw: string): string {
    const known = this.entities.get(kind)?.get(raw);
    if (known) return known;
    const map = this.dangling.get(kind) || new Map<string, string>();
    this.dangling.set(kind, map);
    if (!map.has(raw)) map.set(raw, `DANGLING_${kind}_${map.size + 1}`);
    return map.get(raw)!;
  }
  purchase(raw: string): string {
    assert.ok(raw.startsWith("purchase-"), "Purchase must retain allocation relationship");
    return `purchase-${this.ref("ALLOCATION", raw.slice("purchase-".length))}`;
  }
}

export function memoryStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() { return entries.size; },
  };
}
