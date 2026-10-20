import type { AdvisorId } from "../advisory/contracts";
import type { CapitalPotId } from "../planning/contracts";
import { advisors } from "../../data/advisors";
import { recoveryContentHash, jsonHash } from "./recovery-hash";

export type HistoricalZone = "UTC" | "Europe/Berlin";
export type RecoveryDecision =
  | { kind: "binding"; planId: string; allocationId: string; fromPotId: CapitalPotId; targets: { potId: CapitalPotId; amount: number }[] }
  | { kind: "primary"; planId: string; allocationId: string; targetPotId: CapitalPotId }
  | { kind: "investment"; planId: string; investmentId: string; targetPotId: CapitalPotId }
  | { kind: "legacy"; planId: string; allocationId: string };
export const recoveryDecisionKey=(d:RecoveryDecision)=>JSON.stringify([d.kind,d.planId,d.kind==="investment"?d.investmentId:d.allocationId,...(d.kind==="binding"?[d.fromPotId]:[])]);
export type RecoveryCoverage = { planId: string; potId: CapitalPotId; target: number; before: number; after: number; difference: number };
export type CapitalPotRecovery = {
  formatVersion: 1;
  source: { kind: "local" | "file"; caseId: string; snapshotId?: string; schema: 10 | 11; reference: string;
    fullHash: string; entryHash: string; hashRule: "sha256-utf8/full;sha256-canonical-json/entry" };
  historicalRule: "pre-PR40-rounded-years";
  currentRule: "PR40-calendar-months-clamped";
  historicalZone: HistoricalZone;
  diagnosisVersion: 1;
  uncertainties: string[];
  decisions: RecoveryDecision[];
  confirmation: { at: string; advisorId: AdvisorId; reason: string; contentHash: string; decisionsHash: string; planningAcknowledged: boolean };
  checks: { conservation: true; finance: true; depot: true; graph: true; implementation: true; coverage: true };
  coverage: RecoveryCoverage[];
  remainingPlanning: string[];
  priorRecovery?: CapitalPotRecovery;
};
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const hash = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const amount = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const pot = (v: unknown) => typeof v === "string" && /^(reserve|strategic|year-\d{4})$/.test(v);
const keys = (v: Record<string, unknown>, required: string[], optional: string[] = []) =>
  required.every(k => Object.hasOwn(v,k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
const strings = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === "string");
export function validRecoveryDecision(v: unknown): v is RecoveryDecision {
  if (!obj(v) || !str(v.planId)) return false;
  switch (v.kind) {
    case "binding": return keys(v,["kind","planId","allocationId","fromPotId","targets"]) && str(v.allocationId) && pot(v.fromPotId) &&
      Array.isArray(v.targets) && v.targets.length > 0 && v.targets.every(t => obj(t) && keys(t,["potId","amount"]) && pot(t.potId) && amount(t.amount)) &&
      new Set(v.targets.map(t => t.potId)).size === v.targets.length;
    case "primary": return keys(v,["kind","planId","allocationId","targetPotId"]) && str(v.allocationId) && pot(v.targetPotId);
    case "investment": return keys(v,["kind","planId","investmentId","targetPotId"]) && str(v.investmentId) && pot(v.targetPotId);
    case "legacy": return keys(v,["kind","planId","allocationId"]) && str(v.allocationId);
    default: return false;
  }
}
/** Strict evidence shape, never a validation exemption. Hashes are local claims,
 * not signatures or proof of adviser authentication. */
export function validCapitalPotRecovery(v: unknown, depth = 0): v is CapitalPotRecovery {
  if (!obj(v) || depth > 16 || !keys(v,["formatVersion","source","historicalRule","currentRule","historicalZone","diagnosisVersion","uncertainties","decisions","confirmation","checks","coverage","remainingPlanning"],["priorRecovery"])) return false;
  const s=v.source, c=v.confirmation, checks=v.checks;
  return v.formatVersion === 1 && v.diagnosisVersion === 1 &&
    v.historicalRule === "pre-PR40-rounded-years" && v.currentRule === "PR40-calendar-months-clamped" &&
    (v.historicalZone === "UTC" || v.historicalZone === "Europe/Berlin") &&
    obj(s) && keys(s,["kind","caseId","schema","reference","fullHash","entryHash","hashRule"],["snapshotId"]) &&
    (s.kind === "local" || s.kind === "file") && str(s.caseId) && (s.schema === 10 || s.schema === 11) && str(s.reference) &&
    (s.snapshotId === undefined || str(s.snapshotId)) && hash(s.fullHash) && hash(s.entryHash) && s.hashRule === "sha256-utf8/full;sha256-canonical-json/entry" &&
    strings(v.uncertainties) && Array.isArray(v.decisions) && v.decisions.every(validRecoveryDecision) && new Set(v.decisions.map(recoveryDecisionKey)).size===v.decisions.length &&
    obj(c) && keys(c,["at","advisorId","reason","contentHash","decisionsHash","planningAcknowledged"]) &&
    str(c.at) && Number.isFinite(Date.parse(c.at)) && advisors.some(a => a.id === c.advisorId) && str(c.reason) && c.reason.trim().length >= 10 && hash(c.contentHash) && hash(c.decisionsHash) && c.decisionsHash === jsonHash(v.decisions) && typeof c.planningAcknowledged === "boolean" &&
    obj(checks) && keys(checks,["conservation","finance","depot","graph","implementation","coverage"]) && Object.values(checks).every(x=>x===true) &&
    Array.isArray(v.coverage) && v.coverage.every(r=>obj(r) && keys(r,["planId","potId","target","before","after","difference"]) && str(r.planId) && pot(r.potId) && [r.target,r.before,r.after].every(amount) && typeof r.difference === "number" && Number.isFinite(r.difference)) &&
    strings(v.remainingPlanning) && (v.priorRecovery === undefined || validCapitalPotRecovery(v.priorRecovery,depth+1));
}
export function recoveryConfirmationStatus(item: object & { capitalPotRecovery?: CapitalPotRecovery }) {
  if (!item.capitalPotRecovery) return "none";
  return validCapitalPotRecovery(item.capitalPotRecovery) && recoveryContentHash(item) === item.capitalPotRecovery.confirmation.contentHash
    ? "content-bound" : "changed";
}
