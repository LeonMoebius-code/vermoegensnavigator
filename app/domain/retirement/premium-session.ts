import { jsonHash } from "../case/recovery-hash";
import { copyAvd, requireAvd } from "./avd-data";
import { modelCatalog } from "./model-catalog";
import { PREMIUM_MODEL, PREMIUM_RULES, modelIssue, newPremiumIdentity, type Open } from "./premium-contract";
import { BERLIN_CALENDAR, priceComparisonBasis, reservePrice, type Inflation, type PriceSelection, type ProjectCalendar } from "./premium-price";
import { calculateCurve, productStressDifference, requiresStressComparison, type CurveRequest, type SavingsInputs } from "./premium-series";
import { renderPremiumDocument, type DocumentChannel } from "./premium-document";
import { productChannelAllowed } from "./premium-products";

export type OutputChannel = "screen" | "print" | "pdf" | "csv" | "json";
export type ChannelRights = Readonly<Record<OutputChannel, { readonly allowed: boolean; readonly version: string }>>;
export interface PremiumDraft {
  readonly caseRevision: string;
  readonly savings: SavingsInputs;
  readonly curves: readonly CurveRequest[];
  readonly price: PriceSelection;
  readonly inflation: Inflation;
}
export type Revision = Readonly<{ caseId: string; caseRevision: string; inputRevision: string }>;
export type Reservation = Readonly<{ revision: Revision; comparisonRevision: string; reservedAt: string; token: string }>;
export type Operation = "fix" | "confirm" | Exclude<OutputChannel, "screen">;
export type OperationTicket = Readonly<{ operation: Operation; token: string }>;
export interface ArchivedDocument {
  readonly id: string;
  readonly channel: DocumentChannel;
  readonly createdAt: string;
  readonly comparisonRevision: string;
  readonly caseId: string;
}
export type Subresult = Readonly<{ subresultId: string; fingerprint: string; original: { readonly subresultId: string;
  readonly comparisonRevision: string; readonly fingerprint: string; readonly reason: "same_dependencies" } | null;
  result: ReturnType<typeof calculateCurve> }>;
export interface Snapshot {
  readonly id: string;
  readonly revision: Revision;
  readonly comparisonRevision: string;
  readonly reservedAt: string;
  readonly status: "live_preview" | "fixed_conditionally" | "fixed";
  readonly complete: boolean;
  readonly comparisonIssues: readonly Open[];
  readonly fingerprint: string;
  readonly subresults: readonly Subresult[];
}
const freeze = <T>(value: T): T => copyAvd(value) as T;
// Snapshots are derived from validated inputs and can be larger than the
// ingestion limit, since each accepted input composes several monthly rows.
function freezeResult<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) freezeResult(item);
    Object.freeze(value);
  }
  return value;
}
const token = newPremiumIdentity;

export const PUBLIC_MODEL_RIGHTS = Object.freeze({
  screen: Object.freeze({ allowed: true, version: "public-1" }),
  print: Object.freeze({ allowed: false, version: "public-1" }),
  pdf: Object.freeze({ allowed: false, version: "public-1" }),
  csv: Object.freeze({ allowed: false, version: "public-1" }),
  json: Object.freeze({ allowed: false, version: "public-1" }),
});

/** Browser-session boundary. For persisted or multi-client commits a transactional
 * store must enforce this contract itself. Retained browser data is not a server archive. */
export function createPremiumSession(options: { readonly rights: ChannelRights; readonly calendar?: ProjectCalendar;
  readonly clock?: () => string; readonly catalog?: unknown; readonly scope?: "internal" | "public" }) {
  const scope = options.scope ?? "public";
  const clock = options.clock ?? (() => new Date().toISOString());
  let rights = freeze(options.rights), calendar = freeze(options.calendar ?? BERLIN_CALENDAR);
  let catalog = options.catalog === undefined ? null : modelCatalog(options.catalog, "internal");
  let revision: Revision | null = null, draft: PremiumDraft | null = null;
  let latest: Reservation | null = null, current: Snapshot | null = null;
  const pending = new WeakMap<Reservation, { draft: PremiumDraft; catalog: typeof catalog; calendar: ProjectCalendar; priceContext: ReturnType<typeof reservePrice> | Open }>();
  const actions = new WeakMap<OperationTicket, { snapshot: Snapshot; channel: ChannelRights[OutputChannel] | null }>();
  const retained = new Map<string, Snapshot>();
  const reusable = new Map<string, { original: Subresult; snapshot: Snapshot }>();
  const history: Array<Readonly<{ id: string; comparisonRevision: string; operation: Operation; createdAt: string; body: string }>> = [];
  const documents = new Map<string, { info: ArchivedDocument; bytes: Uint8Array; product: boolean }>();
  const keyFor = (curve: CurveRequest) => `${curve.id}:${curve.valueBasis}`;

  function retire() {
    if (current) retained.set(current.id, current);
    current = null;
  }
  function invalidate() {
    latest = null;
    draft = null;
    retire();
  }
  function edit(caseId: string, caseRevision: string, input: unknown, validate: (input: unknown) => PremiumDraft) {
    // Invalidation precedes validation. An invalid draft has its own identity.
    revision = freeze({ caseId, caseRevision, inputRevision: token() });
    invalidate();
    try {
      const candidate = freeze(validate(input));
      requireAvd(candidate.caseRevision === caseRevision && candidate.savings.caseId === caseId
        && candidate.curves.length > 0 && new Set(candidate.curves.map(keyFor)).size === candidate.curves.length,
      "COMPARISON_CONTEXT_OPEN", "draft");
      draft = candidate;
      return { revision, issue: null };
    } catch (error) {
      return { revision, issue: modelIssue(error) };
    }
  }
  function reserve(): Reservation | null {
    if (!revision || !draft) return null;
    latest = freeze({ revision, comparisonRevision: token(), reservedAt: clock(), token: token() });
    retire();
    let priceContext: ReturnType<typeof reservePrice> | Open;
    try { priceContext = freeze(reservePrice(draft.price, calendar, latest.reservedAt, draft.inflation)); }
    catch (error) { priceContext = modelIssue(error); }
    pending.set(latest, { draft, catalog, calendar, priceContext });
    return latest;
  }
  function fingerprintFor(p: PremiumDraft, curve: CurveRequest, price: unknown, costCatalog: unknown) {
    const { savings } = p;
    const model = curve.model;
    const isProduct = curve.model.mode === "M1" || curve.model.mode === "M2";
    const profiles = model.mode === "M2" ? savings.profiles.filter(item => item.product.product.hash === model.product.product.hash
      && item.product.tariff.hash === model.product.tariff.hash) : [];
    const { payoutStart, finalFundingYear, ...timeline } = savings.timeline;
    return jsonHash({ model: PREMIUM_MODEL, rules: PREMIUM_RULES, caseId: savings.caseId, timeline, curve,
      fundingYear: curve.perspective === "OHNE_ZULAGEN" ? null : finalFundingYear,
      payoutStart: profiles.some(profile => profile.option === "basis_lifecycle") ? payoutStart : null,
      openingCents: savings.openingCents, openingVersion: savings.openingVersion, own: savings.own,
      funding: curve.perspective === "OHNE_ZULAGEN" ? null : savings.funding,
      profiles, price, catalog: isProduct ? costCatalog : null });
  }
  function commit(reservation: Reservation): Snapshot | null {
    const reserved = pending.get(reservation);
    pending.delete(reservation);
    if (!reserved || latest !== reservation || draft !== reserved.draft || !revision
      || revision.inputRevision !== reservation.revision.inputRevision
      || revision.caseId !== reservation.revision.caseId || revision.caseRevision !== reservation.revision.caseRevision) return null;
    const { curves, savings, price } = draft;
    const catalogHash = reserved.catalog?.catalog.hash ?? null;
    const { priceContext } = reserved;
    const subresults = curves.map(curve => {
      const real = curve.valueBasis === "real";
      const product = curve.model.mode === "M1" || curve.model.mode === "M2";
      const basisForReuse = real && !('status' in priceContext)
        ? priceComparisonBasis(priceContext) : real ? priceContext : null;
      const blockedPublication = product && scope === "public" && reserved.catalog && !productChannelAllowed(reserved.catalog, "display");
      const fingerprint = blockedPublication ? jsonHash([curve.id, curve.model.mode, "ORG-O01"])
        : fingerprintFor(reserved.draft, curve, basisForReuse, catalogHash);
      let invalid: Open | null = null;
      if (product && catalogHash !== (catalog?.catalog.hash ?? null)) invalid = modelIssueFor("PRODUCT_CATALOG_CHANGED", "catalog");
      if (real && "status" in priceContext) invalid = priceContext;
      if (real && price.mode === "automatic" && jsonHash(calendar) !== jsonHash(reserved.calendar))
        invalid = modelIssueFor("PROJECT_CALENDAR_CHANGED", "price.calendar");
      if (blockedPublication)
        invalid = modelIssueFor("ORG-O01", "channel");
      const saved = reusable.get(`${savings.caseId}:${keyFor(curve)}`);
      const identical = !invalid && saved?.original.fingerprint === fingerprint;
      const result = invalid ?? (identical ? saved.original.result : calculateCurve(savings, curve,
        real && !("status" in priceContext) ? priceContext : null, reserved.catalog));
      const origin = identical ? saved.original.original ?? { subresultId: saved.original.subresultId,
        comparisonRevision: saved.snapshot.comparisonRevision, fingerprint: saved.original.fingerprint, reason: "same_dependencies" as const } : null;
      return { subresultId: token(), fingerprint, original: origin, result };
    });
    const fullFingerprint = jsonHash({ reservation, dependencies: subresults.map(({ fingerprint, subresultId }) => [fingerprint, subresultId]),
      catalog: scope === "internal" ? catalogHash : null, prices: priceContext, rights: rights.screen });
    // The calculation and this compare-and-write execute in the same JS task.
    // A stale promise can call commit, but cannot reattach itself to a newer draft.
    if (latest !== reservation || draft !== reserved.draft || !rights.screen.allowed) return null;
    const comparisonIssues = curves.flatMap((curve, i) => requiresStressComparison(curve.id)
      && productStressDifference(subresults, subresults[i].result) === null
      ? [modelIssueFor("STRESS_COMPARISON_OPEN", curve.id)] : []);
    const complete = comparisonIssues.length === 0 && subresults.every(item => item.result.status === "computed" && item.result.value.complete);
    current = freezeResult({ id: token(), revision, comparisonRevision: reservation.comparisonRevision, reservedAt: reservation.reservedAt,
      status: "live_preview" as const, complete, comparisonIssues, fingerprint: fullFingerprint, subresults });
    subresults.forEach((item, i) => {
      if (item.result.status === "computed") reusable.set(`${savings.caseId}:${keyFor(curves[i])}`, { original: item, snapshot: current! });
    });
    return current;
  }
  function modelIssueFor(reason: string, path: string): Open { return { status: "O", reason, path }; }
  function replaceCalendar(next: ProjectCalendar) {
    const previous = jsonHash(calendar);
    calendar = freeze(next);
    if (draft?.price.mode === "automatic" && draft.curves.some(curve => curve.valueBasis === "real") && jsonHash(calendar) !== previous) retire();
  }
  function replaceCatalog(next: unknown) {
    const previous = catalog?.catalog.hash;
    catalog = next === null ? null : modelCatalog(next, "internal");
    if (previous !== catalog?.catalog.hash && draft?.curves.some(curve => curve.model.mode === "M1" || curve.model.mode === "M2")) retire();
  }
  function replaceRights(next: ChannelRights) {
    if (!next.screen.allowed || jsonHash(next.screen) !== jsonHash(rights.screen)) retire();
    rights = freeze(next);
  }
  function actionAllowed(operation: Operation, snapshot: Snapshot | null) {
    if (!snapshot?.complete) return false;
    if (operation === "fix") return snapshot.status === "live_preview";
    if (snapshot.status === "live_preview") return false;
    if (operation === "confirm") return false; // Whole comparisons always include S returns. Component evidence is separate.
    if (!rights[operation].allowed) return false;
    return channelPermitted(operation, containsProduct(snapshot));
  }
  function containsProduct(snapshot: Snapshot) {
    return snapshot.subresults.some(item => item.result.status === "computed"
      && (item.result.value.modelMode === "M1" || item.result.value.modelMode === "M2"));
  }
  function channelPermitted(channel: OutputChannel, product: boolean) {
    return rights[channel].allowed && (!product || Boolean(catalog && (scope === "internal" || productChannelAllowed(catalog, "export"))));
  }
  function reserveOperation(operation: Operation): OperationTicket | null {
    if (!actionAllowed(operation, current)) return null;
    const ticket = freeze({ operation, token: token() });
    actions.set(ticket, { snapshot: current!, channel: operation !== "fix" && operation !== "confirm" ? rights[operation] : null });
    return ticket;
  }
  function commitOperation(ticket: OperationTicket, render?: (snapshot: Snapshot) => string) {
    const work = actions.get(ticket);
    actions.delete(ticket);
    if (!work || current !== work.snapshot || !actionAllowed(ticket.operation, current)) return null;
    if (ticket.operation === "fix") {
      current = freezeResult({ ...current, status: "fixed_conditionally" as const });
      retained.set(current.id, current);
      return current;
    }
    if (ticket.operation === "confirm" || !render || jsonHash(work.channel) !== jsonHash(rights[ticket.operation])) return null;
    const body = render(current);
    if (current !== work.snapshot || !actionAllowed(ticket.operation, current)
      || jsonHash(work.channel) !== jsonHash(rights[ticket.operation])) return null;
    const report = Object.freeze({ id: token(), historical: true as const, comparisonRevision: current.comparisonRevision,
      operation: ticket.operation, createdAt: clock(), body });
    history.push(report);
    return report;
  }
  async function commitDocument(ticket: OperationTicket) {
    const work = actions.get(ticket);
    actions.delete(ticket);
    const { operation } = ticket;
    if (operation !== "pdf" && operation !== "csv" || !work) return null;
    const authorized = () => current === work.snapshot && actionAllowed(operation, work.snapshot)
      && jsonHash(work.channel) === jsonHash(rights[operation]);
    if (!authorized()) return null;
    const createdAt = clock();
    const bytes = await renderPremiumDocument(operation, work.snapshot, createdAt);
    if (!authorized()) return null;
    const info = freeze({ id: token(), channel: operation, createdAt, comparisonRevision: work.snapshot.comparisonRevision,
      caseId: work.snapshot.revision.caseId });
    documents.set(info.id, { info, bytes: new Uint8Array(bytes), product: containsProduct(work.snapshot) });
    return info;
  }
  function archiveForCase(caseId: string) {
    return [...documents.values()].filter(entry => entry.info.caseId === caseId && channelPermitted(entry.info.channel, entry.product))
      .map(entry => entry.info);
  }
  function readDocument(id: string, caseId: string) {
    const entry = documents.get(id);
    if (!entry || entry.info.caseId !== caseId || !channelPermitted(entry.info.channel, entry.product)) return null;
    return { info: entry.info, bytes: new Uint8Array(entry.bytes) };
  }
  return { edit, invalidate, reserve, commit, replaceCalendar, replaceCatalog, replaceRights, reserveOperation, commitOperation,
    commitDocument, canDocument: (channel: DocumentChannel) => actionAllowed(channel, current), archiveForCase, readDocument, current: () => current, historical: (id: string) => retained.get(id) ?? null, reports: () => history.slice() };
}
