/** Isolated AP-03a V1.0 domain. No UI, store, clock, network or grant-kernel imports. */
import * as C from "./projection-contract";
import {
  SCALE, MAX_CENTS, ZERO, ONE, point, fromCents, decimalInteger, decimalString,
  plus, minus, times, checkedCent, checkedDomain, serializedInterval, rootFactor,
  ProjectionBudget, ProjectionStop, enforceOutputBytes, type DecimalInterval as I,
} from "./projection-decimal";

type Data = Record<string, unknown>;
type Check = (value: unknown, path: string) => boolean;
type Request = C.ProjectionRequest | C.ComparisonRequest;
type Located = { bound: C.BoundProjection; path: string };
const issue = (code: C.IssueCode, path: string, month: string | null = null): C.Issue => ({ code, path, month });
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function first(issues: readonly C.Issue[]): C.Issue | null {
  let result: C.Issue | null = null;
  for (const i of issues) if (!result || C.ISSUE_ORDER.indexOf(i.code) < C.ISSUE_ORDER.indexOf(result.code)
    || i.code === result.code && compare(i.path, result.path) < 0) result = i;
  return result;
}
function object(v: unknown): v is Data { return v !== null && typeof v === "object" && !Array.isArray(v); }
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d{0,35}[1-9])?$/;
const monthIndex = (s: string) => Number(s.slice(0, 4)) * 12 + Number(s.slice(5)) - 1;
const monthText = (n: number) => `${String(Math.floor(n / 12)).padStart(4, "0")}-${String(n % 12 + 1).padStart(2, "0")}`;
function validMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(v) && Number(v.slice(0, 4)) >= 100;
}
function validDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !validMonth(v.slice(0, 7))) return false;
  const y = Number(v.slice(0, 4)), m = Number(v.slice(5, 7)), d = Number(v.slice(8));
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d >= 1 && d <= days[m - 1];
}

/** Only called on JSON.parse-owned data or our own result objects. */
function canonicalProjectionJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalProjectionJson).join(",")}]`;
  const data = value as Data;
  return `{${Object.keys(data).sort(compare).map(k => `${JSON.stringify(k)}:${canonicalProjectionJson(data[k])}`).join(",")}}`;
}

class Shape {
  private readonly errors = new Map<C.IssueCode, C.Issue>();
  fail(code: C.IssueCode, path: string): false {
    const old = this.errors.get(code);
    if (!old || compare(path, old.path) < 0) this.errors.set(code, issue(code, path));
    return false;
  }
  result(): C.Issue | null { return first([...this.errors.values()]); }
  fields(v: unknown, shape: Record<string, Check>, p: string): boolean {
    if (!object(v)) return this.fail("invalid_shape", p);
    const names = Object.keys(shape), keys = Object.keys(v);
    if (keys.length !== names.length || keys.some(k => !Object.hasOwn(shape, k))) return this.fail("invalid_shape", p);
    let ok = true;
    for (const k of names) if (!shape[k](v[k], `${p}/${k}`)) ok = false;
    return ok;
  }
  list(check: Check): Check { return (v, p) => {
    if (!Array.isArray(v)) return this.fail("invalid_shape", p);
    let ok = true;
    for (let n = 0; n < v.length; n++) if (!check(v[n], `${p}/${n}`)) ok = false;
    return ok;
  }; }
  nullable(check: Check): Check { return (v, p) => v === null || check(v, p); }
  choices(values: readonly string[]): Check { return (v, p) =>
    typeof v === "string" && values.includes(v) || this.fail("invalid_value", p); }
  id: Check = (v, p) => typeof v === "string" && ID.test(v) || this.fail("invalid_value", p);
  cents: Check = (v, p) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && !Object.is(v, -0)
    || this.fail("invalid_value", p);
  year: Check = (v, p) => typeof v === "number" && Number.isSafeInteger(v) && v >= 100 && v <= 9999
    || this.fail("invalid_calendar", p);
  month: Check = (v, p) => validMonth(v) || this.fail("invalid_calendar", p);
  date: Check = (v, p) => validDate(v) || this.fail("invalid_calendar", p);
  decimal(low: bigint, high: bigint): Check { return (v, p) => {
    if (typeof v !== "string" || v.length > 45 || !DECIMAL.test(v) || v === "-0") return this.fail("invalid_value", p);
    const n = decimalInteger(v);
    return n >= low && n <= high || this.fail("invalid_value", p);
  }; }
  fact(check: Check): Check { return (v, p) => {
    if (!object(v)) return this.fail("invalid_shape", p);
    if (v.state === "known") return this.fields(v, { state: this.choices(["known"]), value: check }, p);
    if (v.state === "unknown") return this.fields(v, { state: this.choices(["unknown"]), reason: this.choices(["missing", "unconfirmed", "conflicting", "unsupported"]) }, p);
    return this.fail("invalid_value", `${p}/state`);
  }; }
  source: Check = (v, p) => this.fields(v, {
    sourceId: this.id, kind: this.choices(["official_rule", "booking_evidence", "contract_evidence", "external_rule_result", "model_assumption", "technical_contract"]),
    quality: this.choices(["confirmed", "hypothetical", "unconfirmed", "conflicting"]),
    reference: (x, q) => typeof x === "string" && x.length > 0 && x.length <= 512 && /^[\x20-\x7e]+$/.test(x) && x.trim() === x || this.fail("invalid_value", q),
    version: this.id, contentHash: this.nullable((x, q) => typeof x === "string" && /^sha256:[0-9a-f]{64}$/.test(x) || this.fail("invalid_value", q)),
    checkedOn: this.nullable(this.date), effectiveFromMonth: this.nullable(this.month), effectiveToMonth: this.nullable(this.month),
  }, p);
  binding: Check = (v, p) => this.fields(v, {
    path: (x, q) => typeof x === "string" && x.length <= 512 && /^\/[A-Za-z0-9_/]+$/.test(x) || this.fail("invalid_value", q),
    sourceIds: this.list(this.id),
  }, p);
  grant: Check = (v, p) => this.fields(v, {
    eventId: this.id,
    grantKey: (x, q) => this.fields(x, { personId: this.id, contractId: this.id, contributionYear: this.year,
      component: this.choices(["base", "child", "bonus", "aggregate"]), childId: this.nullable(this.id) }, q),
    cents: this.cents, amountBasis: this.choices(["actual_booking_confirmed", "external_rule_result", "hypothetical_amount"]),
    externalRule: this.nullable((x, q) => this.fields(x, { ruleId: this.id, ruleVersion: this.id, resultStatus: this.choices(["calculated"]) }, q)),
    sourceBookingRef: this.nullable(this.id), booking: (x, q) => this.fields(x, {
      basis: this.choices(["actual_date_confirmed", "hypothetical_month_end", "pib_may15_month_end_illustration"]),
      month: this.month, referenceDate: this.nullable(this.date),
    }, q),
  }, p);
  costs: Check = (v, p) => {
    if (!object(v)) return this.fail("invalid_shape", p);
    if (v.mode === "gross_only") return this.fields(v, { mode: this.choices(["gross_only"]), costKnowledge: this.choices(["not_assessed", "unknown"]) }, p);
    if (v.mode === "net_return") return this.fields(v, { mode: this.choices(["net_return"]), coverage: this.choices(["all_costs_included", "unconfirmed"]) }, p);
    if (v.mode === "gross_plus_explicit_costs") return this.fields(v, {
      mode: this.choices(["gross_plus_explicit_costs"]), coverage: this.choices(["complete", "unknown", "effective_cost_only", "unsupported_type"]),
      annualRates: this.list((x, q) => this.fields(x, { fromMonth: this.month, effectiveAnnualReduction: this.fact(this.decimal(0n, SCALE)) }, q)),
      fixedFees: this.list((x, q) => this.fields(x, { eventId: this.id, month: this.month, cents: this.cents, sourceBookingRef: this.nullable(this.id) }, q)),
    }, p);
    return this.fail("invalid_value", `${p}/mode`);
  };
  parameters: Check = (v, p) => this.fields(v, {
    projectionId: this.id, instrument: this.choices(["retirement_model", "unfunded_reference"]),
    period: (x, q) => this.fields(x, { startMonth: this.month, endMonth: this.month }, q),
    initial: (x, q) => this.fields(x, { balanceCents: this.fact(this.cents), valuationMonth: this.month, position: this.choices(["immediately_before_start"]) }, q),
    rebalancing: this.choices(["monthly_target_weight"]),
    contributionSchedule: this.list((x, q) => this.fields(x, { fromMonth: this.month, monthlyCents: this.fact(this.cents) }, q)),
    oneOffContributions: this.list((x, q) => this.fields(x, { eventId: this.id, month: this.month, cents: this.cents }, q)),
    grantCoverage: (x, q) => this.fields(x, { mode: this.choices(["complete_events", "none_assumed", "unknown"]), unresolvedContributionYears: this.list(this.year) }, q),
    grantEvents: this.list(this.grant),
    marketSchedule: this.list((x, q) => this.fields(x, { fromMonth: this.month,
      equityAnnualReturn: this.fact(this.decimal(-SCALE, 1000000n * SCALE)), bondAnnualReturn: this.fact(this.decimal(-SCALE, 1000000n * SCALE)) }, q)),
    allocationSchedule: this.list((x, q) => this.fields(x, { fromMonth: this.month, equityWeight: this.fact(this.decimal(0n, SCALE)) }, q)),
    stress: this.nullable((x, q) => this.fields(x, { month: this.month, equityShock: this.fact(this.decimal(-SCALE, 0n)) }, q)),
    costs: this.costs,
  }, p);
  bound: Check = (v, p) => this.fields(v, { parameters: this.parameters, bindings: this.list(this.binding) }, p);
  request(v: unknown): void {
    if (!object(v)) { this.fail("invalid_shape", ""); return; }
    const common: Record<string, Check> = {
      kind: this.choices(["projection", "comparison"]), versions: (x, q) => this.fields(x, {
        modelVersion: this.id, inputContractVersion: this.id, numericConventionVersion: this.id, resultContractVersion: this.id,
      }, q), output: (x, q) => this.fields(x, { mode: this.choices(["auto", "detailed", "compact"]) }, q), sources: this.list(this.source),
    };
    if (v.kind === "projection") this.fields(v, { ...common, projection: this.bound }, "");
    else if (v.kind === "comparison") this.fields(v, { ...common, scenarios: this.list((x, q) => this.fields(x, {
      scenarioId: this.id, retirement: this.bound, reference: this.bound,
    }, q)) }, "");
    else this.fail("invalid_value", "/kind");
  }
}

function locations(r: Request): Located[] {
  return r.kind === "projection" ? [{ bound: r.projection, path: "/projection" }]
    : r.scenarios.flatMap((s, i) => [{ bound: s.retirement, path: `/scenarios/${i}/retirement` }, { bound: s.reference, path: `/scenarios/${i}/reference` }]);
}
function requiredBindings(p: C.ProjectionSpec): string[] {
  const paths = ["/period", "/initial", "/rebalancing", "/grantCoverage", "/stress", "/costs"];
  for (const key of ["contributionSchedule", "oneOffContributions", "grantEvents", "marketSchedule", "allocationSchedule"] as const)
    p[key].forEach((_, i) => paths.push(`/${key}/${i}`));
  if (p.costs.mode === "gross_plus_explicit_costs") {
    p.costs.annualRates.forEach((_, i) => paths.push(`/costs/annualRates/${i}`));
    p.costs.fixedFees.forEach((_, i) => paths.push(`/costs/fixedFees/${i}`));
  }
  return paths.sort(compare);
}
function semanticShape(r: Request, s: Shape, operation: "projection" | "comparison"): void {
  const ordered = (keys: readonly string[], path: string, duplicate: C.IssueCode = "duplicate_identity") => {
    const seen = new Set<string>();
    keys.forEach((key, i) => {
      if (seen.has(key)) s.fail(duplicate, `${path}/${i}`);
      if (i > 0 && compare(keys[i - 1], key) >= 0) s.fail("invalid_order", `${path}/${i}`);
      seen.add(key);
    });
  };
  if (r.kind !== operation) s.fail("wrong_operation", "/kind");
  if (r.kind === "comparison") {
    if (r.scenarios.length !== 3) s.fail("invalid_shape", "/scenarios");
    ordered(r.scenarios.map(x => x.scenarioId), "/scenarios");
    r.scenarios.forEach((x, i) => {
      if (x.retirement.parameters.instrument !== "retirement_model") s.fail("inconsistent_input", `/scenarios/${i}/retirement/parameters/instrument`);
      if (x.reference.parameters.instrument !== "unfunded_reference") s.fail("inconsistent_input", `/scenarios/${i}/reference/parameters/instrument`);
    });
  }
  ordered(r.sources.map(x => x.sourceId), "/sources");
  const sources = new Map(r.sources.map(x => [x.sourceId, x]));
  const usedSources = new Set<string>(), projectionIds = new Set<string>();
  r.sources.forEach((x, i) => {
    if ((x.kind === "model_assumption") !== (x.quality === "hypothetical")) s.fail("inconsistent_input", `/sources/${i}/quality`);
    if (x.effectiveFromMonth && x.effectiveToMonth && x.effectiveFromMonth > x.effectiveToMonth) s.fail("inconsistent_input", `/sources/${i}`);
  });
  let entries = 0, bindings = 0;
  for (const l of locations(r)) {
    const p = l.bound.parameters, path = `${l.path}/parameters`, start = p.period.startMonth, end = p.period.endMonth;
    if (projectionIds.has(p.projectionId)) s.fail("duplicate_identity", `${path}/projectionId`);
    projectionIds.add(p.projectionId);
    if (start > end) s.fail("invalid_calendar", `${path}/period`);
    if (p.initial.valuationMonth !== start) s.fail("inconsistent_input", `${path}/initial/valuationMonth`);
    const schedules: { list: readonly { fromMonth: string }[]; path: string; required: boolean }[] = [
      { list: p.contributionSchedule, path: "/contributionSchedule", required: true },
      { list: p.marketSchedule, path: "/marketSchedule", required: true },
      { list: p.allocationSchedule, path: "/allocationSchedule", required: true },
    ];
    if (p.costs.mode === "gross_plus_explicit_costs") schedules.push({ list: p.costs.annualRates, path: "/costs/annualRates", required: p.costs.coverage === "complete" });
    for (const a of schedules) {
      entries += a.list.length;
      if (a.required && (!a.list.length || a.list[0].fromMonth !== start)) s.fail("invalid_shape", path + a.path);
      ordered(a.list.map(x => x.fromMonth), path + a.path);
      a.list.forEach((x, i) => { if (x.fromMonth < start || x.fromMonth > end) s.fail("invalid_calendar", `${path}${a.path}/${i}/fromMonth`); });
    }
    if (p.costs.mode === "gross_plus_explicit_costs" && p.costs.coverage === "complete"
      && p.costs.annualRates.some(x => x.effectiveAnnualReduction.state !== "known")) s.fail("inconsistent_input", `${path}/costs/coverage`);
    if (p.stress && (p.stress.month < start || p.stress.month > end)) s.fail("invalid_calendar", `${path}/stress/month`);
    const years = p.grantCoverage.unresolvedContributionYears;
    if ((p.grantCoverage.mode === "unknown") !== (years.length > 0)) s.fail("inconsistent_input", `${path}/grantCoverage`);
    ordered(years.map(x => String(x).padStart(4, "0")), `${path}/grantCoverage/unresolvedContributionYears`);
    if (p.instrument === "unfunded_reference" && (p.grantCoverage.mode !== "none_assumed" || p.grantEvents.length || years.length)) s.fail("inconsistent_input", `${path}/grantCoverage`);
    entries += years.length + p.oneOffContributions.length + p.grantEvents.length;
    const allEvents = new Set<string>(), bookingRefs = new Set<string>();
    function events(list: readonly { eventId: string; month: string; sourceBookingRef?: string | null }[], eventPath: string, after: boolean) {
      ordered(list.map(x => `${x.month}/${x.eventId}`), path + eventPath);
      list.forEach((x, i) => {
        const q = `${path}${eventPath}/${i}`;
        if (allEvents.has(x.eventId)) s.fail("duplicate_identity", `${q}/eventId`);
        allEvents.add(x.eventId);
        if (x.sourceBookingRef) {
          if (bookingRefs.has(x.sourceBookingRef)) s.fail("duplicate_identity", `${q}/sourceBookingRef`);
          bookingRefs.add(x.sourceBookingRef);
        }
        if (x.month < start || !after && x.month > end) s.fail("invalid_calendar", `${q}/month`);
      });
    }
    events(p.oneOffContributions, "/oneOffContributions", false);
    events(p.grantEvents.map(x => ({ ...x, month: x.booking.month })), "/grantEvents", true);
    if (p.costs.mode === "gross_plus_explicit_costs") { entries += p.costs.fixedFees.length; events(p.costs.fixedFees, "/costs/fixedFees", true); }
    const grantKeys = new Set<string>(), aggregate = new Map<string, boolean>();
    p.grantEvents.forEach((x, i) => {
      const q = `${path}/grantEvents/${i}`, k = x.grantKey;
      const group = canonicalProjectionJson([k.personId, k.contractId, k.contributionYear]);
      const key = canonicalProjectionJson(k);
      if (grantKeys.has(key)) s.fail("duplicate_identity", `${q}/grantKey`);
      grantKeys.add(key);
      if (aggregate.has(group) && (aggregate.get(group) || k.component === "aggregate")) s.fail("duplicate_identity", `${q}/grantKey`);
      aggregate.set(group, k.component === "aggregate");
      if ((k.component === "child") !== (k.childId !== null)) s.fail("inconsistent_input", `${q}/grantKey/childId`);
      if (x.amountBasis === "actual_booking_confirmed") {
        if (x.externalRule || x.booking.basis !== "actual_date_confirmed" || !x.sourceBookingRef
          || !x.booking.referenceDate || x.booking.referenceDate.slice(0, 7) !== x.booking.month) s.fail("inconsistent_input", q);
      } else {
        if ((x.amountBasis === "external_rule_result") !== (x.externalRule !== null) || x.sourceBookingRef !== null
          || x.booking.basis === "actual_date_confirmed") s.fail("inconsistent_input", q);
        if (x.booking.basis === "hypothetical_month_end" && x.booking.referenceDate !== null) s.fail("inconsistent_input", `${q}/booking`);
        if (x.booking.basis === "pib_may15_month_end_illustration") {
          const expected = `${String(k.contributionYear + 1).padStart(4, "0")}-05`;
          if (k.contributionYear === 9999 || x.booking.month !== expected || x.booking.referenceDate !== `${expected}-15`) s.fail("inconsistent_input", `${q}/booking`);
        }
      }
    });
    const expected = new Set(requiredBindings(p));
    const boundPaths = new Set<string>();
    ordered(l.bound.bindings.map(x => x.path), `${l.path}/bindings`, "invalid_shape");
    bindings += l.bound.bindings.length;
    l.bound.bindings.forEach((b, i) => {
      const q = `${l.path}/bindings/${i}`;
      if (!expected.has(b.path) || boundPaths.has(b.path)) s.fail("invalid_shape", `${q}/path`);
      boundPaths.add(b.path);
      if (!b.sourceIds.length || b.sourceIds.length > 8) s.fail("invalid_shape", `${q}/sourceIds`);
      ordered(b.sourceIds, `${q}/sourceIds`);
      b.sourceIds.forEach((id, j) => { if (!sources.has(id)) s.fail("dangling_source", `${q}/sourceIds/${j}`); else usedSources.add(id); });
    });
  }
  r.sources.forEach((x, i) => { if (!usedSources.has(x.sourceId)) s.fail("inconsistent_input", `/sources/${i}`); });
  if (r.sources.length > C.PROJECTION_LIMITS.sources || bindings > C.PROJECTION_LIMITS.bindings || entries > C.PROJECTION_LIMITS.entries) s.fail("entry_limit", "");
}

function unpaired(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) { const n = s.charCodeAt(++i); if (!(n >= 0xdc00 && n <= 0xdfff)) return true; }
    else if (c >= 0xdc00 && c <= 0xdfff) return true;
  }
  return false;
}
function unicodeData(v: unknown): boolean {
  if (typeof v === "string") return !unpaired(v);
  if (Array.isArray(v)) return v.every(unicodeData);
  if (object(v)) return Object.keys(v).every(k => !unpaired(k) && unicodeData(v[k]));
  return true;
}
function tooDeep(s: string): boolean {
  let depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') quoted = false; }
    else if (c === '"') quoted = true;
    else if (c === "{" || c === "[") { if (++depth > C.PROJECTION_LIMITS.depth) return true; }
    else if (c === "}" || c === "]") depth--;
  }
  return false;
}

/** SHA-256 over our validated canonical UTF-8 bytes; no Node/runtime dependency. */
function digest(bytes: Uint8Array): string {
  const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const data = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64); data.set(bytes); data[bytes.length] = 0x80;
  const view = new DataView(data.buffer); view.setUint32(data.length - 4, bytes.length * 8, false);
  const w = new Uint32Array(64), rotr = (x: number, n: number) => x >>> n | x << 32 - n;
  for (let pos = 0; pos < data.length; pos += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(pos + 4 * i, false);
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = w[i - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ a >>> 3) + w[i - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ b >>> 10); }
    let [a,b,c,d,e,f,g,j] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = j + (rotr(e,6) ^ rotr(e,11) ^ rotr(e,25)) + (e & f ^ ~e & g) + k[i] + w[i];
      const t2 = (rotr(a,2) ^ rotr(a,13) ^ rotr(a,22)) + (a & b ^ a & c ^ b & c);
      j=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,j].forEach((n, i) => { h[i] += n; });
  }
  return "sha256:" + [...h].map(n => n.toString(16).padStart(8, "0")).join("");
}

type Quality = C.MoneyValue["status"];
type Flows = { -readonly [K in keyof C.FlowTotals]: I };
const FLOW_KEYS: readonly (keyof Flows)[] = ["regularOwn", "oneOffOwn", "totalOwn", "specifiedAllowances", "marketResult", "stressLoss", "explicitRunningCosts", "explicitFixedCosts", "totalCostAmount", "deductionInThisCalculation"];
function emptyFlows(): Flows {
  return { regularOwn: ZERO, oneOffOwn: ZERO, totalOwn: ZERO, specifiedAllowances: ZERO, marketResult: ZERO,
    stressLoss: ZERO, explicitRunningCosts: ZERO, explicitFixedCosts: ZERO, totalCostAmount: ZERO, deductionInThisCalculation: ZERO };
}
function addFlows(a: Flows, b: Flows): Flows {
  const result = emptyFlows();
  for (const k of FLOW_KEYS) result[k] = plus(a[k], b[k]);
  return result;
}
const blocked = (i: C.Issue): C.MoneyBlocked => ({ status: "review_required", issue: i });
const na = (): C.MoneyNA => ({ status: "not_applicable", reason: "not_computed_in_selected_cost_mode" });
function money(a: I, path: string, month: string | null = null, status: Quality = "modelliert_unter_annahmen"): C.MoneyValue {
  return { status, interval: serializedInterval(a), displayCents: checkedCent(a, path, month) };
}
function recoverMetric(fn: () => C.MoneyMetric): C.MoneyMetric {
  try { return fn(); } catch (e) { if (e instanceof ProjectionStop && e.issue.code !== "work_limit") return blocked(e.issue); throw e; }
}

class Context {
  readonly p: C.ProjectionSpec;
  readonly root: string;
  readonly bindings: Map<string, C.Binding>;
  readonly issues: C.Issue[] = [];
  readonly start: number;
  readonly end: number;
  readonly n: number;
  constructor(readonly location: Located, readonly sources: Map<string, C.Source>, budget: ProjectionBudget) {
    this.p = location.bound.parameters;
    this.root = `${location.path}/parameters`;
    this.bindings = new Map(location.bound.bindings.map(b => [b.path, b]));
    this.start = monthIndex(this.p.period.startMonth); this.end = monthIndex(this.p.period.endMonth); this.n = this.end - this.start + 1;
    for (const b of location.bound.bindings) budget.tick(`${location.path}/bindings`);
    for (const path of requiredBindings(this.p)) { const i = this.evidence(path); if (i) this.issues.push(i); }
    this.checkFact(this.p.initial.balanceCents, "/initial/balanceCents");
    this.p.contributionSchedule.forEach((x, i) => this.checkFact(x.monthlyCents, `/contributionSchedule/${i}/monthlyCents`));
    this.p.marketSchedule.forEach((x, i) => {
      this.checkFact(x.equityAnnualReturn, `/marketSchedule/${i}/equityAnnualReturn`, "return");
      this.checkFact(x.bondAnnualReturn, `/marketSchedule/${i}/bondAnnualReturn`, "return");
    });
    this.p.allocationSchedule.forEach((x, i) => this.checkFact(x.equityWeight, `/allocationSchedule/${i}/equityWeight`));
    if (this.p.stress) this.checkFact(this.p.stress.equityShock, "/stress/equityShock");
    const costs = this.p.costs;
    if (costs.mode === "gross_plus_explicit_costs") {
      costs.annualRates.forEach((x, i) => this.checkFact(x.effectiveAnnualReduction, `/costs/annualRates/${i}/effectiveAnnualReduction`, "cost"));
      if (costs.coverage !== "complete") this.issues.push(issue(costs.coverage === "effective_cost_only" ? "effective_cost_not_balance_fee" : costs.coverage === "unsupported_type" ? "cost_type_not_supported" : "cost_source_unknown", `${this.root}/costs/coverage`));
    } else if (costs.mode === "net_return" && costs.coverage !== "all_costs_included") this.issues.push(issue("evidence_required", `${this.root}/costs/coverage`));
    this.p.grantEvents.forEach((g, i) => {
      const src = this.boundSources(`/grantEvents/${i}`);
      const has = (kind: C.Source["kind"], quality: C.Source["quality"]) => src.some(x => x.kind === kind && x.quality === quality);
      const valid = g.amountBasis === "actual_booking_confirmed" ? has("booking_evidence", "confirmed")
        : g.amountBasis === "external_rule_result" ? has("external_rule_result", "confirmed") : has("model_assumption", "hypothetical");
      if (!valid || g.booking.basis === "pib_may15_month_end_illustration"
        && (!has("official_rule", "confirmed") || !has("model_assumption", "hypothetical"))) this.issues.push(issue("evidence_required", `${this.root}/grantEvents/${i}`));
    });
  }
  private checkFact<T extends string | number>(v: C.Fact<T>, path: string, type?: "return" | "cost") {
    if (v.state === "unknown") this.issues.push(issue("input_fact_unknown", this.root + path));
    else if (type === "return" && v.value === "-1") this.issues.push(issue("annual_total_loss_timing_required", this.root + path));
    else if (type === "cost" && v.value === "1") this.issues.push(issue("cost_rate_total_loss_timing_required", this.root + path));
  }
  boundSources(path: string): C.Source[] { return this.bindings.get(path)?.sourceIds.map(id => this.sources.get(id)!) ?? []; }
  evidence(path: string): C.Issue | null {
    const b = this.bindings.get(path);
    return !b || this.boundSources(path).some(s => s.quality === "unconfirmed" || s.quality === "conflicting")
      ? issue("evidence_required", this.root + path) : null;
  }
  quality(paths: readonly string[], grant = false, includeCoverage = false): Quality {
    const effective = paths.length ? [...paths] : [grant ? "/grantCoverage" : "/contributionSchedule/0"];
    if (includeCoverage) effective.push("/grantCoverage");
    if (effective.some(p => this.boundSources(p).some(s => s.quality === "hypothetical"))) return "modelliert_unter_annahmen";
    if (grant && paths.length) {
      const grants = paths.map(p => this.p.grantEvents[Number(p.split("/").at(-1))]);
      if (grants.some(g => g.booking.basis !== "actual_date_confirmed" || g.amountBasis === "hypothetical_amount")) return "modelliert_unter_annahmen";
      if (grants.every(g => g.amountBasis === "external_rule_result")) return "regelbasiert";
      if (grants.some(g => g.amountBasis !== "actual_booking_confirmed")) return "modelliert_unter_annahmen";
    }
    return "bestaetigte_eingabe";
  }
  requirePaths(paths: readonly string[]) {
    const error = first(paths.map(p => this.evidence(p)).filter((x): x is C.Issue => x !== null));
    if (error) throw new ProjectionStop(error.code, error.path);
  }
}
function known<T>(f: C.Fact<T>, path: string): T {
  if (f.state !== "known") throw new ProjectionStop("input_fact_unknown", path);
  return f.value;
}
function centsSum(values: readonly number[], path: string): I {
  let n = 0n;
  for (const v of values) n += BigInt(v);
  if (n > MAX_CENTS) throw new ProjectionStop("numeric_domain_exceeded", path);
  return fromCents(Number(n));
}
interface Independents {
  readonly initialBalance: C.MoneyMetric;
  readonly regularOwn: C.MoneyMetric;
  readonly oneOffOwn: C.MoneyMetric;
  readonly totalOwn: C.MoneyMetric;
  readonly specifiedAllowances: C.MoneyMetric;
  readonly completeAllowance: C.MoneyMetric;
}
function independents(c: Context): Independents {
  const p = c.p;
  const initialBalance = recoverMetric(() => {
    c.requirePaths(["/initial"]);
    return money(fromCents(known(p.initial.balanceCents, `${c.root}/initial/balanceCents`)), `${c.root}/initial`, null, c.quality(["/initial"]));
  });
  const regularOwn = recoverMetric(() => {
    const paths = p.contributionSchedule.map((_, i) => `/contributionSchedule/${i}`);
    c.requirePaths(paths);
    let sum = 0n;
    p.contributionSchedule.forEach((v, i) => {
      const n = (p.contributionSchedule[i + 1] ? monthIndex(p.contributionSchedule[i + 1].fromMonth) : c.end + 1) - monthIndex(v.fromMonth);
      sum += BigInt(known(v.monthlyCents, `${c.root}${paths[i]}/monthlyCents`)) * BigInt(n);
    });
    if (sum > MAX_CENTS) throw new ProjectionStop("numeric_domain_exceeded", `${c.root}/contributionSchedule`);
    return money(fromCents(Number(sum)), `${c.root}/contributionSchedule`, null, c.quality(paths));
  });
  const onePaths = p.oneOffContributions.map((_, i) => `/oneOffContributions/${i}`);
  const oneOffOwn = recoverMetric(() => {
    c.requirePaths(onePaths);
    return money(centsSum(p.oneOffContributions.map(x => x.cents), `${c.root}/oneOffContributions`), `${c.root}/oneOffContributions`, null, c.quality(onePaths));
  });
  const totalOwn = recoverMetric(() => {
    if (regularOwn.status === "review_required") return regularOwn;
    if (oneOffOwn.status === "review_required") return oneOffOwn;
    return money(plus(metricInterval(regularOwn), metricInterval(oneOffOwn)), `${c.root}/contributionSchedule`, null,
      regularOwn.status === "modelliert_unter_annahmen" || oneOffOwn.status === "modelliert_unter_annahmen" ? "modelliert_unter_annahmen" : "bestaetigte_eingabe");
  });
  const gs = p.grantEvents.map((g, i) => ({ g, path: `/grantEvents/${i}` })).filter(x => x.g.booking.month <= p.period.endMonth);
  const specifiedAllowances = recoverMetric(() => {
    c.requirePaths(gs.map(x => x.path));
    return money(centsSum(gs.map(x => x.g.cents), `${c.root}/grantEvents`), `${c.root}/grantEvents`, null, c.quality(gs.map(x => x.path), true));
  });
  const completeAllowance = p.grantCoverage.mode === "unknown" ? blocked(issue("allowance_coverage_unknown", `${c.root}/grantCoverage`)) : recoverMetric(() => {
    c.requirePaths(["/grantCoverage"]);
    if (specifiedAllowances.status === "review_required") return specifiedAllowances;
    return money(metricInterval(specifiedAllowances), `${c.root}/grantEvents`, null, c.quality(gs.map(x => x.path), true, true));
  });
  return { initialBalance, regularOwn, oneOffOwn, totalOwn, specifiedAllowances, completeAllowance };
}
function metricInterval(v: C.MoneyMetric): I {
  if (!('interval' in v)) throw new Error("AP03a internal metric dependency");
  return { lo: decimalInteger(v.interval.lowerEuro), hi: decimalInteger(v.interval.upperEuro) };
}
function costUnknown(c: Context): C.MoneyBlocked {
  return blocked(issue(c.p.costs.mode === "net_return" ? "included_cost_amount_unknown" : "cost_source_unknown", `${c.root}/costs`));
}
function outputFlows(raw: Flows, c: Context, paths: { regular: string[]; one: string[]; grants: string[] }, month: string | null): C.FlowTotals {
  const result = {} as { -readonly [K in keyof C.FlowTotals]: C.MoneyMetric };
  for (const k of FLOW_KEYS) {
    if (c.p.costs.mode !== "gross_plus_explicit_costs" && (k === "explicitRunningCosts" || k === "explicitFixedCosts")) result[k] = na();
    else if (c.p.costs.mode !== "gross_plus_explicit_costs" && k === "totalCostAmount") result[k] = costUnknown(c);
    else {
      const quality = k === "regularOwn" ? c.quality(paths.regular) : k === "oneOffOwn" ? c.quality(paths.one)
        : k === "totalOwn" ? c.quality([...paths.regular, ...paths.one]) : k === "specifiedAllowances" ? c.quality(paths.grants, true) : "modelliert_unter_annahmen";
      result[k] = money(raw[k], c.root, month, quality);
    }
  }
  return result;
}
function balance(open: I, close: I, f: Flows, c: Context, month: string | null): C.BalanceCheck {
  const residual = minus(minus(plus(plus(minus(minus(close, open), f.marketResult), f.stressLoss), f.deductionInThisCalculation), f.totalOwn), f.specifiedAllowances);
  if (residual.lo > 0n || residual.hi < 0n) throw new Error("AP03a internal interval balance");
  return { identity: "opening_plus_flows", residualInterval: serializedInterval(residual), status: "interval_consistent" };
}
function displayResidual(open: I, close: I, f: Flows, c: Context, month: string | null): C.MoneyValue {
  const cp = (x: I) => BigInt(checkedCent(x, c.root, month));
  const n = cp(close) - (cp(open) + cp(f.marketResult) - cp(f.stressLoss) - cp(f.deductionInThisCalculation) + cp(f.totalOwn) + cp(f.specifiedAllowances));
  return money(fromCents(Number(n)), c.root, month);
}
function excluded(c: Context): C.ExcludedEvent[] {
  const end = c.p.period.endMonth;
  const list: C.ExcludedEvent[] = c.p.grantEvents.filter(g => g.booking.month > end).map(g => ({ eventType: "grant", eventId: g.eventId, month: g.booking.month, cents: g.cents, reason: "after_end_not_booked" }));
  if (c.p.costs.mode === "gross_plus_explicit_costs") list.push(...c.p.costs.fixedFees.filter(f => f.month > end).map(f => ({ eventType: "fixed_fee" as const, eventId: f.eventId, month: f.month, cents: f.cents, reason: "after_end_not_booked" as const })));
  return list.sort((a, b) => compare(a.month, b.month) || compare(a.eventType, b.eventType) || compare(a.eventId, b.eventId));
}
function resultFrame(c: Context) {
  const mode = c.p.costs.mode;
  return {
    projectionId: c.p.projectionId, instrument: c.p.instrument,
    period: { startMonth: c.p.period.startMonth, endMonth: c.p.period.endMonth, monthCount: c.n },
    valueBasis: mode === "gross_only" ? "before_costs" as const : mode === "net_return" ? "after_included_costs" as const : "after_explicit_costs" as const,
    returnBasis: mode === "net_return" ? "net_of_included_costs" as const : "gross_before_costs" as const,
    allowanceCoverage: c.p.grantCoverage.mode, unresolvedContributionYears: [...c.p.grantCoverage.unresolvedContributionYears], excludedEvents: excluded(c),
  };
}
function failedProjection(c: Context, input: Independents, error: C.Issue): C.ProjectionResult {
  const b = blocked(error), costs = c.p.costs.mode;
  return { ...resultFrame(c), status: "review_required", primaryIssue: error, ledger: null,
    summary: {
      initialBalance: input.initialBalance,
      totals: { regularOwn: input.regularOwn, oneOffOwn: input.oneOffOwn, totalOwn: input.totalOwn, specifiedAllowances: input.specifiedAllowances,
        marketResult: b, stressLoss: b, explicitRunningCosts: costs === "gross_plus_explicit_costs" ? b : na(), explicitFixedCosts: costs === "gross_plus_explicit_costs" ? b : na(),
        totalCostAmount: costs === "gross_plus_explicit_costs" ? b : costUnknown(c), deductionInThisCalculation: b },
      completeAllowanceInflow: input.completeAllowance, specifiedEndBalance: b, completeEndBalance: b,
      beforeCostEndBalance: costs === "gross_only" ? b : na(), afterCostEndBalance: costs === "gross_only" ? costUnknown(c) : b,
      displayRoundingResidual: b, balanceCheck: null,
    } };
}

type FactorCache = Map<string, I>;
function collectFactors(c: Context): string[] {
  const keys: string[] = [];
  for (const x of c.p.marketSchedule) { keys.push(`return:${known(x.equityAnnualReturn, c.root)}`, `return:${known(x.bondAnnualReturn, c.root)}`); }
  if (c.p.costs.mode === "gross_plus_explicit_costs") for (const x of c.p.costs.annualRates) keys.push(`cost:${known(x.effectiveAnnualReduction, c.root)}`);
  return keys;
}
function project(c: Context, input: Independents, mode: "detailed" | "compact", cache: FactorCache, budget: ProjectionBudget): C.ProjectionResult {
  const p = c.p, blocks: C.BlockRow[] = [], rows: C.MonthRow[] = [];
  const initial = fromCents(known(p.initial.balanceCents, c.root));
  let current = initial, total = emptyFlows(), blockTotal = emptyFlows(), blockOpen = initial, blockStart = c.start;
  const blockSize = Math.ceil(c.n / C.PROJECTION_LIMITS.blocks);
  let ci = 0, mi = 0, ai = 0, ki = 0, oi = 0, gi = 0, fi = 0;
  const costRates = p.costs.mode === "gross_plus_explicit_costs" ? p.costs.annualRates : [];
  const fixedFees = p.costs.mode === "gross_plus_explicit_costs" ? p.costs.fixedFees : [];
  const basePaths = ["/period", "/initial", "/rebalancing", "/grantCoverage", "/stress", "/costs"];
  const totalPaths = { regular: p.contributionSchedule.map((_, i) => `/contributionSchedule/${i}`), one: p.oneOffContributions.map((_, i) => `/oneOffContributions/${i}`), grants: p.grantEvents.map((g, i) => g.booking.month <= p.period.endMonth ? `/grantEvents/${i}` : "").filter(Boolean) };
  let bp = new Set<string>(), ownIds: string[] = [], grantIds: string[] = [], feeIds: string[] = [];
  let blockRegular = new Set<string>(), blockOwn = new Set<string>(), blockGrants = new Set<string>();
  for (let m = c.start; m <= c.end; m++) {
    const month = monthText(m);
    budget.tick(c.root, month);
    while (p.contributionSchedule[ci + 1]?.fromMonth <= month) ci++;
    while (p.marketSchedule[mi + 1]?.fromMonth <= month) mi++;
    while (p.allocationSchedule[ai + 1]?.fromMonth <= month) ai++;
    while (costRates[ki + 1]?.fromMonth <= month) ki++;
    const opening = current, market = p.marketSchedule[mi];
    const q = point(decimalInteger(known(p.allocationSchedule[ai].equityWeight, c.root)));
    const bondQ = minus(ONE, q), a = times(opening, q), d = times(opening, bondQ);
    const ga = cache.get(`return:${known(market.equityAnnualReturn, c.root)}`)!, gd = cache.get(`return:${known(market.bondAnnualReturn, c.root)}`)!;
    const aPrime = times(a, ga), dPrime = times(d, gd);
    const gain = plus(times(a, minus(ga, ONE)), times(d, minus(gd, ONE)));
    const stressed = p.stress?.month === month;
    const shock = stressed ? point(decimalInteger(known(p.stress!.equityShock, c.root))) : ZERO;
    const loss = times(aPrime, minus(ZERO, shock));
    const v = plus(times(aPrime, plus(ONE, shock)), dPrime);
    const h = p.costs.mode === "gross_plus_explicit_costs" ? cache.get(`cost:${known(costRates[ki].effectiveAnnualReduction, c.root)}`)! : ONE;
    const running = times(v, minus(ONE, h));
    const ownEvents: { event: C.OwnEvent; path: string }[] = [], grants: { event: C.GrantEvent; path: string }[] = [], fees: { event: C.FeeEvent; path: string }[] = [];
    while (p.oneOffContributions[oi]?.month === month) { ownEvents.push({ event: p.oneOffContributions[oi], path: `/oneOffContributions/${oi}` }); oi++; }
    while (p.grantEvents[gi]?.booking.month === month) { grants.push({ event: p.grantEvents[gi], path: `/grantEvents/${gi}` }); gi++; }
    while (fixedFees[fi]?.month === month) { fees.push({ event: fixedFees[fi], path: `/costs/fixedFees/${fi}` }); fi++; }
    const fee = centsSum(fees.map(x => x.event.cents), `${c.root}/costs/fixedFees`);
    const deduction = plus(running, fee), remaining = minus(times(v, h), fee);
    if (remaining.hi < 0n) throw new ProjectionStop("insufficient_fee_basis", `${c.root}/costs`, month);
    if (remaining.lo < 0n) throw new ProjectionStop("precision_ambiguous", `${c.root}/costs`, month);
    const regular = fromCents(known(p.contributionSchedule[ci].monthlyCents, c.root));
    const lump = centsSum(ownEvents.map(x => x.event.cents), `${c.root}/oneOffContributions`);
    const allowance = centsSum(grants.map(x => x.event.cents), `${c.root}/grantEvents`);
    current = plus(plus(plus(remaining, regular), lump), allowance);
    const f: Flows = { regularOwn: regular, oneOffOwn: lump, totalOwn: plus(regular, lump), specifiedAllowances: allowance,
      marketResult: gain, stressLoss: loss, explicitRunningCosts: running, explicitFixedCosts: fee, totalCostAmount: deduction, deductionInThisCalculation: deduction };
    // Validate all conceptual MonthRow amounts, also when compact was requested.
    for (const value of [aPrime, dPrime, v]) checkedDomain(value, c.root, month);
    for (const value of [opening, a, d, stressed ? aPrime : ZERO, current, ...Object.values(f)]) checkedCent(value, c.root, month);
    const paths = { regular: [`/contributionSchedule/${ci}`], one: ownEvents.map(x => x.path), grants: grants.map(x => x.path) };
    const applied = [...basePaths, paths.regular[0], `/marketSchedule/${mi}`, `/allocationSchedule/${ai}`, ...paths.one, ...paths.grants, ...fees.map(x => x.path)];
    if (p.costs.mode === "gross_plus_explicit_costs") applied.push(`/costs/annualRates/${ki}`);
    const appliedSorted = [...new Set(applied)].sort(compare);
    const rowOwn = ownEvents.map(x => x.event.eventId), rowGrants = grants.map(x => x.event.eventId), rowFees = fees.map(x => x.event.eventId);
    const check = balance(opening, current, f, c, month), residual = displayResidual(opening, current, f, c, month);
    if (mode === "detailed") rows.push({ month, index: m - c.start, openingBalance: money(opening, c.root, month), equityWeight: decimalString(q.lo), bondWeight: decimalString(bondQ.lo),
      equityOpening: money(a, c.root, month), bondOpening: money(d, c.root, month),
      equityFactor: { lower: decimalString(ga.lo), upper: decimalString(ga.hi) }, bondFactor: { lower: decimalString(gd.lo), upper: decimalString(gd.hi) },
      stressApplied: stressed, stressedEquityBasis: money(stressed ? aPrime : ZERO, c.root, month), totals: outputFlows(f, c, paths, month), closingBalance: money(current, c.root, month),
      displayRoundingResidual: residual, balanceCheck: check, appliedSourcePaths: appliedSorted, ownEventIds: rowOwn, grantEventIds: rowGrants, feeEventIds: rowFees });
    total = addFlows(total, f);
    if (mode === "compact") {
      blockTotal = addFlows(blockTotal, f); appliedSorted.forEach(x => bp.add(x)); paths.regular.forEach(x => blockRegular.add(x)); paths.one.forEach(x => blockOwn.add(x)); paths.grants.forEach(x => blockGrants.add(x));
      ownIds.push(...rowOwn); grantIds.push(...rowGrants); feeIds.push(...rowFees);
      if ((m - c.start + 1) % blockSize === 0 || m === c.end) {
        blocks.push({ startMonth: monthText(blockStart), endMonth: month, monthCount: m - blockStart + 1,
          openingBalance: money(blockOpen, c.root, month), closingBalance: money(current, c.root, month),
          totals: outputFlows(blockTotal, c, { regular: [...blockRegular], one: [...blockOwn], grants: [...blockGrants] }, month),
          displayRoundingResidual: displayResidual(blockOpen, current, blockTotal, c, month), balanceCheck: balance(blockOpen, current, blockTotal, c, month),
          appliedSourcePaths: [...bp].sort(compare), ownEventIds: ownIds, grantEventIds: grantIds, feeEventIds: feeIds });
        blockStart = m + 1; blockOpen = current; blockTotal = emptyFlows(); bp = new Set(); ownIds = []; grantIds = []; feeIds = [];
        blockRegular = new Set(); blockOwn = new Set(); blockGrants = new Set();
      }
    }
  }
  const unknown = p.grantCoverage.mode === "unknown";
  const error = unknown ? issue("allowance_coverage_unknown", `${c.root}/grantCoverage`) : null;
  const specified = money(current, c.root), complete = error ? blocked(error) : specified;
  const totals = outputFlows(total, c, totalPaths, null);
  const summary: C.Summary = { initialBalance: input.initialBalance, totals: { ...totals, regularOwn: input.regularOwn, oneOffOwn: input.oneOffOwn, totalOwn: input.totalOwn, specifiedAllowances: input.specifiedAllowances },
    completeAllowanceInflow: input.completeAllowance, specifiedEndBalance: specified, completeEndBalance: complete,
    beforeCostEndBalance: p.costs.mode === "gross_only" ? complete : na(), afterCostEndBalance: p.costs.mode === "gross_only" ? costUnknown(c) : complete,
    displayRoundingResidual: displayResidual(initial, current, total, c, null), balanceCheck: balance(initial, current, total, c, null) };
  return { ...resultFrame(c), status: unknown ? "partial" : "calculated", primaryIssue: error, summary,
    ledger: mode === "detailed" ? { mode, rows } : { mode, blockSizeMonths: blockSize, blocks } };
}

function basisEqual(a: Context, b: Context): boolean {
  const x = a.p, y = b.p;
  if (x.period.startMonth !== y.period.startMonth || x.period.endMonth !== y.period.endMonth || x.initial.balanceCents.state !== "known" || y.initial.balanceCents.state !== "known"
    || x.initial.balanceCents.value !== y.initial.balanceCents.value) return false;
  if (a.evidence("/period") || b.evidence("/period") || a.evidence("/initial") || b.evidence("/initial")) return false;
  const months = [...new Set([...x.contributionSchedule, ...y.contributionSchedule].map(v => v.fromMonth))].sort(compare);
  let i = 0, j = 0;
  for (const m of months) {
    while (x.contributionSchedule[i + 1]?.fromMonth <= m) i++;
    while (y.contributionSchedule[j + 1]?.fromMonth <= m) j++;
    const xv = x.contributionSchedule[i].monthlyCents, yv = y.contributionSchedule[j].monthlyCents;
    if (xv.state !== "known" || yv.state !== "known" || xv.value !== yv.value || a.evidence(`/contributionSchedule/${i}`) || b.evidence(`/contributionSchedule/${j}`)) return false;
  }
  const own = (c: Context) => {
    const sums = new Map<string, bigint>();
    for (let n = 0; n < c.p.oneOffContributions.length; n++) {
      const v = c.p.oneOffContributions[n]; if (c.evidence(`/oneOffContributions/${n}`)) return null;
      sums.set(v.month, (sums.get(v.month) ?? 0n) + BigInt(v.cents));
    }
    return sums;
  };
  const xs = own(a), ys = own(b);
  if (!xs || !ys) return false;
  for (const m of new Set([...xs.keys(), ...ys.keys()])) if ((xs.get(m) ?? 0n) !== (ys.get(m) ?? 0n)) return false;
  return true;
}
function comparison(r: Request, contexts: readonly Context[], results: readonly C.ProjectionResult[]): C.ScenarioComparison[] {
  if (r.kind !== "comparison") return [];
  const equal = contexts.every(c => basisEqual(contexts[0], c));
  return r.scenarios.map((s, i) => {
    const a = results[2 * i], b = results[2 * i + 1];
    const sameCostStage = (a.valueBasis === "before_costs") === (b.valueBasis === "before_costs");
    const mismatch = !equal || !sameCostStage ? issue("basis_mismatch", `/scenarios/${i}`) : null;
    const delta = (x: C.MoneyMetric, y: C.MoneyMetric): C.MoneyMetric => {
      if (mismatch) return blocked(mismatch);
      if (x.status === "review_required") return x;
      if (y.status === "review_required") return y;
      return recoverMetric(() => money(minus(metricInterval(x), metricInterval(y)), `/scenarios/${i}`));
    };
    const full = delta(a.summary.completeEndBalance, b.summary.completeEndBalance);
    const specified = delta(a.summary.specifiedEndBalance, b.summary.specifiedEndBalance);
    const complete = "interval" in full, partial = "interval" in specified;
    const primaryIssue = complete ? null : full.status === "review_required" ? full.issue : issue("basis_mismatch", `/scenarios/${i}`);
    return { scenarioId: s.scenarioId, retirementProjectionId: a.projectionId, referenceProjectionId: b.projectionId,
      status: complete ? "calculated" : partial ? "partial" : "review_required", basis: "same_own_cashflows", completeDifference: full, specifiedDifference: specified, primaryIssue };
  });
}

function execute(input: unknown, operation: "projection" | "comparison"): C.Response {
  let response: C.Response = { operation: null, status: "invalid_input", supportedVersions: { ...C.PROJECTION_VERSIONS }, requestedVersions: null,
    requestHash: null, sourceManifest: [], projectionResults: [], comparisonResults: [], primaryIssue: null };
  const stop = (error: C.Issue, status: "invalid_input" | "resource_error" | "review_required") => ({ ...response, status, primaryIssue: error, projectionResults: [], comparisonResults: [] });
  if (typeof input !== "string") return stop(issue("invalid_type", ""), "invalid_input");
  if (unpaired(input) || input.charCodeAt(0) === 0xfeff) return stop(issue("invalid_unicode", ""), "invalid_input");
  const bytes = new TextEncoder().encode(input);
  if (bytes.length > C.PROJECTION_LIMITS.inputBytes) return stop(issue("input_bytes_limit", ""), "resource_error");
  if (tooDeep(input)) return stop(issue("input_depth_limit", ""), "resource_error");
  let parsed: unknown;
  try { parsed = JSON.parse(input); } catch (e) { if (e instanceof SyntaxError) return stop(issue("invalid_json", ""), "invalid_input"); throw e; }
  if (!unicodeData(parsed)) return stop(issue("invalid_unicode", ""), "invalid_input");
  if (object(parsed) && (parsed.kind === "projection" || parsed.kind === "comparison")) response = { ...response, operation: parsed.kind };
  const shape = new Shape(); shape.request(parsed);
  let error = shape.result();
  if (error) return stop(error, "invalid_input");
  const r = parsed as Request;
  semanticShape(r, shape, operation);
  // Canonical comparison also rejects duplicate JSON keys and numeric spellings.
  if (canonicalProjectionJson(r) !== input) shape.fail("noncanonical_json", "");
  error = shape.result();
  if (error) return stop(error, error.code === "entry_limit" ? "resource_error" : "invalid_input");
  response = { ...response, requestedVersions: { ...r.versions }, requestHash: digest(bytes) };
  if (Object.keys(C.PROJECTION_VERSIONS).some(k => r.versions[k as keyof C.Versions] !== C.PROJECTION_VERSIONS[k as keyof C.Versions])) return stop(issue("version_not_supported", "/versions"), "review_required");
  response = { ...response, sourceManifest: r.sources.map(s => ({ sourceId: s.sourceId, version: s.version, contentHash: s.contentHash })) };
  const locs = locations(r);
  const d = locs.reduce((n, l) => n + monthIndex(l.bound.parameters.period.endMonth) - monthIndex(l.bound.parameters.period.startMonth) + 1, 0);
  if (r.output.mode === "detailed" && d > C.PROJECTION_LIMITS.detailRows) return stop(issue("detail_rows_limit", "/output"), "resource_error");
  const mode = r.output.mode === "auto" ? d <= C.PROJECTION_LIMITS.detailRows ? "detailed" : "compact" : r.output.mode;
  try {
    const budget = new ProjectionBudget(), sources = new Map(r.sources.map(s => [s.sourceId, s]));
    const contexts = locs.map(l => new Context(l, sources, budget));
    const independent = contexts.map(independents);
    // Independent input-sum overflow blocks the trajectory as well; no saturated total.
    contexts.forEach((c, n) => { for (const m of Object.values(independent[n])) if (m.status === "review_required" && m.issue.code !== "allowance_coverage_unknown") c.issues.push(m.issue); });
    const cache: FactorCache = new Map();
    const keys = [...new Set(contexts.filter(c => !c.issues.length).flatMap(collectFactors))].sort(compare);
    for (const key of keys) {
      const [type, value] = key.split(":");
      const q = type === "return" ? SCALE + decimalInteger(value) : SCALE - decimalInteger(value);
      cache.set(key, rootFactor(q, budget, ""));
    }
    const results = contexts.map((c, i) => {
      const factError = first(c.issues);
      if (factError) return failedProjection(c, independent[i], factError);
      try { return project(c, independent[i], mode, cache, budget); }
      catch (e) { if (e instanceof ProjectionStop && e.issue.code !== "work_limit") return failedProjection(c, independent[i], e.issue); throw e; }
    });
    const comparisons = comparison(r, contexts, results);
    const full = results.every(x => x.status === "calculated") && comparisons.every(x => x.status === "calculated");
    const partial = results.some(x => x.status !== "review_required");
    const errors = [...results, ...comparisons].map(x => x.primaryIssue).filter((x): x is C.Issue => x !== null);
    response = { ...response, status: full ? "calculated" : partial ? "partial" : "review_required", projectionResults: results, comparisonResults: comparisons, primaryIssue: full ? null : first(errors) };
    enforceOutputBytes(new TextEncoder().encode(canonicalProjectionJson(response)).length);
    return response;
  } catch (e) {
    if (e instanceof ProjectionStop && (e.issue.code === "work_limit" || e.issue.code === "output_bytes_limit")) return stop(e.issue, "resource_error");
    throw e;
  }
}

function orderedResponse(result: C.Response): C.Response {
  return JSON.parse(canonicalProjectionJson(result)) as C.Response;
}
export function projectRetirement(inputJson: string): C.Response { return orderedResponse(execute(inputJson, "projection")); }
export function compareRetirement(inputJson: string): C.Response { return orderedResponse(execute(inputJson, "comparison")); }
