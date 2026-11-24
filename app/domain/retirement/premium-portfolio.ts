import { jsonHash } from "../case/recovery-hash";
import { requireAvd } from "./avd-data";
import { ASSET_CLASSES, type AssetClass } from "./model-input";
import { applyFactor, basisPoints, euros, monthlyFactor, outputCents, splitBalance, sumBalances } from "./model-decimal";
import { SCALE } from "./projection-decimal";
import { monthIndex, shiftMonth, type Timeline } from "./premium-calendar";
import { modelIssue, type Cashflow, type DateWindow, type Evidence, type Open, type ProductVersion } from "./premium-contract";
import { distinctRegister } from "./premium-funding";
import type { Ref } from "./identity-contract";

export type ProductId = "basis" | "pro" | "garantie" | "ruv-standard" | "ruv-individuell" | "ruv-garantie-80";
export interface Position {
  readonly id: string;
  readonly assetClass: AssetClass;
  readonly fund: Ref<"fund"> | null;
  readonly exposure: readonly (DateWindow & { readonly weightBps: number; readonly evidence: Evidence })[];
}
export interface AllocationWindow extends DateWindow {
  readonly id: string;
  readonly evidence: Evidence;
  readonly targetWeightsBps: readonly number[];
  readonly cashflowWeightsBps: readonly number[];
  readonly openingAction: "HOLDINGS_SWITCH" | "CASHFLOW_ONLY";
}
export interface EndAction {
  readonly actionId: string;
  readonly externalId: string;
  readonly month: string;
  readonly weightsBps: readonly number[];
  readonly evidence: Evidence;
  readonly overrideOf: string | null;
  readonly revision: string;
}
export interface ActionResolution {
  readonly month: string;
  readonly selectedAction: string;
  readonly originalActionHashes: readonly string[];
  readonly supersededActions: readonly string[];
  readonly evidence: Evidence;
  readonly revision: string;
}
export interface AllocationProfile {
  readonly caseId: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly product: ProductVersion;
  readonly model: ProductId | "synthetic_reference";
  readonly option: "free" | "comfort" | "basis_lifecycle" | "pro_equity" | "stabilization_proxy" | "guarantee_proxy" | "inflow_proxy";
  readonly optionEvidence: Evidence;
  readonly comfort: Ref<"portfolio"> | null;
  readonly positions: readonly Position[];
  readonly openingWeightsBps: readonly number[];
  readonly windows: readonly AllocationWindow[];
  readonly annualRebalance: { readonly evidence: Evidence; readonly revision: string;
    readonly cycleOverride: { readonly month: string; readonly revision: string; readonly evidence: Evidence } | null } | null;
  readonly endActions: readonly EndAction[];
  readonly resolutions: readonly ActionResolution[];
}
export interface MonthlyReturnPath {
  readonly version: string;
  readonly evidence: Evidence & { readonly class: "S" };
  readonly annualBps: Readonly<Record<AssetClass, number | null>>;
  readonly monthlyBps: Readonly<Record<string, Readonly<Partial<Record<AssetClass, number>>>>>;
}
export interface StressEvent {
  readonly id: string;
  readonly month: string;
  readonly lossBps: number;
  readonly evidence: Evidence & { readonly class: "S" };
}
export interface CashflowOrder {
  readonly month: string;
  readonly eventIds: readonly string[];
  readonly evidence: Evidence & { readonly class: "B" | "S" };
}
export type PortfolioCosts =
  | { readonly mode: "K1"; readonly monthlyFactor: bigint }
  | { readonly mode: "K2"; readonly charges: (month: string, postStress: bigint, currentContributions: bigint) => readonly { readonly amount: bigint; readonly allocationBps: readonly number[] }[] }
  | { readonly mode: "gross" };

const includesMonth = (w: DateWindow, month: string) => w.fromMonth <= month && (w.toMonthExclusive === null || month < w.toMonthExclusive);
function checkWindow(w: DateWindow, at: string) {
  requireAvd(w.toMonthExclusive === null ? monthIndex(w.fromMonth) >= 0 : monthIndex(w.fromMonth) < monthIndex(w.toMonthExclusive), "INVALID_WINDOW", at);
}
function checkWeights(weights: readonly number[], count: number, at: string) {
  requireAvd(weights.length === count && weights.every(item => Number.isInteger(item) && item >= 0 && item <= 10000)
    && weights.reduce((sum, item) => sum + item, 0) === 10000, "INVALID_WEIGHTS", at);
}

export function lifecycleBoundaries(timeline: Timeline) {
  requireAvd(timeline.payoutStart?.evidence === "S", "PAYOUT_ANCHOR_OPEN", "payoutStart");
  return [shiftMonth(timeline.payoutStart.month, -60), shiftMonth(timeline.payoutStart.month, -24)] as const;
}

function profileWindows(profile: AllocationProfile, timeline: Timeline) {
  if (profile.option !== "basis_lifecycle") return profile.windows;
  const [early, late] = lifecycleBoundaries(timeline);
  const [initial] = profile.windows;
  requireAvd(initial && profile.windows.length === 1 && initial.toMonthExclusive === null
    && initial.fromMonth <= early, "LIFECYCLE_BASE_PROFILE_OPEN", "profile.windows");
  const position = profile.positions.findIndex(p => p.assetClass === "equity");
  requireAvd(profile.positions.length === 2 && position >= 0
    && profile.positions[1 - position].assetClass !== "equity", "LIFECYCLE_ASSETS_OPEN", "profile.positions");
  const weights = (equity: number) => position === 0 ? [equity, 10000 - equity] : [10000 - equity, equity];
  const change = (id: string, fromMonth: string, toMonthExclusive: string | null, equity: number) => ({
    id, fromMonth, toMonthExclusive, openingAction: "HOLDINGS_SWITCH" as const,
    targetWeightsBps: weights(equity), cashflowWeightsBps: weights(equity), evidence: profile.optionEvidence,
  });
  return [
    ...(initial.fromMonth < early ? [{ ...initial, toMonthExclusive: early }] : []),
    change(`${initial.id}:T-60`, early, late, 5000), change(`${initial.id}:T-24`, late, null, 3000),
  ];
}

function actionAt(profile: AllocationProfile, orders: readonly EndAction[], month: string, index: number,
  weights: readonly number[], firstMonth: string): EndAction | null {
  const candidates = orders.filter(order => order.month === month);
  const [first] = candidates;
  if (candidates.length > 1) {
    const decisions = profile.resolutions.filter(item => item.month === month);
    requireAvd(decisions.length === 1, "MEHRFACHAUFTRAG", "profile.resolutions");
    const decision = decisions[0];
    const selected = candidates.find(action => action.actionId === decision.selectedAction);
    const originals = candidates.map(action => jsonHash(action)).sort();
    const superseded = candidates.filter(action => action !== selected).map(action => action.actionId).sort();
    requireAvd(selected && decision.revision && decision.evidence.version
      && jsonHash([...decision.originalActionHashes].sort()) === jsonHash(originals)
      && jsonHash([...decision.supersededActions].sort()) === jsonHash(superseded), "MEHRFACHAUFTRAG", "profile.resolutions");
    return selected;
  }
  if (first) return first;
  const cycle = profile.annualRebalance;
  if (!cycle) return null;
  const override = cycle.cycleOverride;
  const cycleStart = override && override.month <= month ? override.month : firstMonth;
  const elapsed = cycleStart === firstMonth ? index + 1 : monthIndex(month) - monthIndex(cycleStart) + 1;
  if (elapsed % 12 !== 0) return null;
  return { actionId: `annual:${cycle.revision}:${month}`, externalId: `annual:${cycle.revision}:${month}`,
    month, weightsBps: weights, evidence: cycle.evidence, revision: override?.revision ?? cycle.revision, overrideOf: null };
}

function perMonthFactor(path: MonthlyReturnPath, month: string, asset: AssetClass) {
  requireAvd(ASSET_CLASSES.includes(asset) && Boolean(path.version) && path.evidence.class === "S", "RETURN_SOURCE_OPEN", "returns");
  const monthly = path.monthlyBps[month]?.[asset];
  const rate = monthly ?? path.annualBps[asset];
  requireAvd(Number.isSafeInteger(rate) && rate! > -10000 && rate! <= 100000, "RETURN_FACTOR_OPEN", `returns.${asset}`);
  const factor = SCALE + basisPoints(rate!);
  return monthly === undefined ? monthlyFactor(factor, `returns.${asset}`) : factor;
}

function asOrdered(events: readonly Cashflow[], orders: readonly CashflowOrder[], month: string) {
  if (events.length < 2 || events.every(event => event.cents >= 0)) return events;
  const options = distinctRegister(orders.filter(item => item.month === month), item => item.evidence.source + ":" + item.evidence.version, "cashflowOrders");
  const belegt = options.filter(order => order.evidence.class === "B");
  const choices = belegt.length ? belegt : options.filter(order => order.evidence.class === "S");
  requireAvd(choices.length === 1 && choices[0].evidence.version, "EREIGNISREIHENFOLGE_OFFEN", "cashflowOrders");
  const chosen = choices[0].eventIds;
  const byId = new Map(events.map(event => [event.id, event]));
  requireAvd(chosen.length === events.length && new Set(chosen).size === chosen.length && chosen.every(id => byId.has(id)),
    "EREIGNISREIHENFOLGE_OFFEN", "cashflowOrders");
  return chosen.map(id => byId.get(id)!);
}

function moveCash(balances: readonly bigint[], event: Cashflow, defaultWeights: readonly number[]) {
  const value = euros(Math.abs(event.cents));
  const total = sumBalances(balances);
  const allocation = event.allocation;
  if (event.cents < 0) {
    requireAvd(value <= total, "UNTERDECKUNG", event.id);
    requireAvd(allocation && (allocation.evidence.class === "B" || allocation.evidence.class === "S"), "ENTNAHMEQUELLE_OFFEN", event.id);
    if (allocation.kind === "pro_rata") {
      requireAvd(allocation.evidence.class === "S", "ENTNAHMEQUELLE_OFFEN", event.id);
      let assigned = 0n, cumulative = 0n;
      return balances.map(balance => {
        cumulative += balance;
        const rounded = (value * cumulative + total / 2n) / total;
        const amount = rounded - assigned;
        assigned = rounded;
        requireAvd(amount <= balance, "UNTERDECKUNG", event.id);
        return balance - amount;
      });
    }
  }
  requireAvd(allocation?.kind !== "pro_rata", "INVALID_POSITIVE_ALLOCATION", event.id);
  const weights = allocation?.weightsBps ?? defaultWeights;
  checkWeights(weights, balances.length, event.id);
  const portions = splitBalance(value, weights);
  return balances.map((balance, index) => {
    const result = event.cents < 0 ? balance - portions[index] : balance + portions[index];
    requireAvd(result >= 0n, "UNTERDECKUNG", event.id);
    return result;
  });
}

export function portfolioRows(input: {
  readonly months: readonly string[];
  readonly timeline: Timeline;
  readonly opening: bigint;
  readonly profile: AllocationProfile;
  readonly returns: MonthlyReturnPath;
  readonly stress: StressEvent | null;
  readonly costs: PortfolioCosts;
  readonly payments: ReadonlyMap<string, readonly Cashflow[]>;
  readonly cashflowOrders: readonly CashflowOrder[];
}) {
  const { months, timeline, profile, opening, returns, stress, costs, payments, cashflowOrders } = input;
  const windows = profileWindows(profile, timeline);
  const { positions } = profile;
  requireAvd(positions.length > 0 && positions.length <= 16 && new Set(positions.map(p => p.id)).size === positions.length,
    "POSITION_IDENTITY_OPEN", "profile.positions");
  checkWeights(profile.openingWeightsBps, positions.length, "profile.openingWeightsBps");
  for (const window of windows) {
    checkWindow(window, window.id);
    checkWeights(window.targetWeightsBps, positions.length, window.id);
    checkWeights(window.cashflowWeightsBps, positions.length, window.id);
  }
  for (const position of positions) for (const exposure of position.exposure) checkWindow(exposure, position.id);
  const orders = distinctRegister(profile.endActions, order => order.externalId, "profile.endActions");
  requireAvd(new Set(orders.map(order => order.actionId)).size === orders.length
    && orders.every(order => monthIndex(order.month) >= 0 && order.revision && order.actionId && order.evidence.version && order.evidence.source),
  "ACTION_IDENTITY_OPEN", "profile.endActions");
  if (profile.annualRebalance?.cycleOverride) {
    const override = profile.annualRebalance.cycleOverride;
    requireAvd(monthIndex(override.month) >= 0 && override.evidence.class === "S" && override.revision && override.evidence.version,
      "REBALANCE_CYCLE_OPEN", "profile.annualRebalance.cycleOverride");
  }
  if (stress) requireAvd(months.includes(stress.month) && Number.isInteger(stress.lossBps) && stress.lossBps >= 0
    && stress.lossBps <= 10000 && stress.evidence.class === "S" && Boolean(stress.id), "INVALID_STRESS_EVENT", "stress");
  let balances = splitBalance(opening, profile.openingWeightsBps);
  let blocked: Open | null = null;
  return months.map((month, index) => {
    if (blocked) return { month, outcome: blocked } as const;
    try {
      const matches = windows.filter(window => includesMonth(window, month));
      requireAvd(matches.length === 1, "PROFILE_MONTH_OPEN", "profile.windows");
      const window = matches[0];
      if (window.fromMonth === month && window.openingAction === "HOLDINGS_SWITCH")
        balances = splitBalance(sumBalances(balances), window.targetWeightsBps);
      balances = balances.map((balance, i) => balance === 0n ? 0n : applyFactor(balance, perMonthFactor(returns, month, positions[i].assetClass)));
      let stressDetails: { eventId: string; exposedCents: number; postMarketCents: number; lossCents: number } | null = null;
      if (stress?.month === month) {
        const before = sumBalances(balances);
        const affected = balances.map((balance, i) => {
          if (balance === 0n) return 0n;
          const matching = positions[i].exposure.filter(item => includesMonth(item, month));
          requireAvd(matching.length === 1 && Number.isInteger(matching[0].weightBps)
            && matching[0].weightBps >= 0 && matching[0].weightBps <= 10000 && matching[0].evidence.version,
          "EXPOSURE_OPEN", positions[i].id);
          return applyFactor(balance, basisPoints(matching[0].weightBps));
        });
        const losses = affected.map(value => applyFactor(value, basisPoints(stress.lossBps)));
        balances = balances.map((balance, i) => balance - losses[i]);
        stressDetails = { eventId: stress.id, exposedCents: outputCents(sumBalances(affected), month),
          postMarketCents: outputCents(before, month), lossCents: outputCents(sumBalances(losses), month) };
      }
      const events = payments.get(month) ?? [];
      let bookedCostCents: number | null = null;
      if (costs.mode === "K1") balances = balances.map(value => applyFactor(value, costs.monthlyFactor));
      if (costs.mode === "K2") {
        const total = sumBalances(balances);
        const contribution = events.filter(event => event.kind === "regular" || event.kind === "special")
          .reduce((amount, event) => amount + euros(event.cents), 0n);
        const charges = costs.charges(month, total, contribution);
        let charged = 0n;
        for (const charge of charges) {
          checkWeights(charge.allocationBps, balances.length, month);
          const amounts = splitBalance(charge.amount, charge.allocationBps);
          balances = balances.map((value, i) => {
            requireAvd(amounts[i] <= value, "COST_DECKUNG_OFFEN", month);
            return value - amounts[i];
          });
          charged += charge.amount;
        }
        bookedCostCents = outputCents(charged, month);
      }
      for (const event of asOrdered(events, cashflowOrders, month)) balances = moveCash(balances, event, window.cashflowWeightsBps);
      const endAction = actionAt(profile, orders, month, index, window.targetWeightsBps, months[0]);
      const total = sumBalances(balances);
      if (endAction) {
        checkWeights(endAction.weightsBps, positions.length, endAction.actionId);
        balances = splitBalance(total, endAction.weightsBps);
      }
      const positionCents = balances.map(value => outputCents(value, month));
      const actualWeights = balances.map(value => total === 0n ? null : Number(value * 10_000_000n / total) / 1000);
      return { month, outcome: { status: "computed", total, positionCents, actualWeights, stress: stressDetails,
        profileWindowId: window.id, targetWeightsBps: window.targetWeightsBps, cashflowWeightsBps: window.cashflowWeightsBps,
        endAction: endAction ?? "NO_END_ACTION", bookedCostCents } } as const;
    } catch (error) {
      blocked = modelIssue(error, month);
      return { month, outcome: blocked } as const;
    }
  });
}
