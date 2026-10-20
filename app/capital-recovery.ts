import type { AdvisoryCase } from "./domain/case/contracts";
import type { AdvisorId } from "./domain/advisory/contracts";
import type { CapitalPotId, PlannerAllocation } from "./domain/planning/contracts";
import type { CapitalPotRecovery, HistoricalZone, RecoveryDecision, RecoveryCoverage } from "./domain/case/recovery-contract";
import { validRecoveryDecision, recoveryDecisionKey } from "./domain/case/recovery-contract";
import { diagnoseCapitalRecovery, rawBindings } from "./domain/case/capital-recovery-diagnosis";
import { canonicalJson, sha256, jsonHash, recoveryContentHash } from "./domain/case/recovery-hash";
import { exactSum, exactDifference, equalSum, safeRecoveryTarget } from "./domain/case/recovery-decimal";
import { validCaseFinancialInputs } from "./domain/case/financial-validation";
import { validCurrentPlanGraph } from "./domain/planning/plan-identity";
import { normalizeImportedCase, enforceCaseDepotValue } from "./case-model";
import { phasedEntryAmounts, phasedEntryScheduleValidation } from "./domain/planning/investment-plans";
import { CASE_STORAGE_KEY, RECOVERY_PREFIX, readCaseStore, insertCaseIntoStore } from "./case-storage";
import { advisors } from "./data/advisors";

export type RecoveryStorage = Pick<Storage,"getItem"|"setItem"|"key"|"length">;
export type RecoverySelection = { caseId: string; snapshotId?: string };
export type RecoverySource = { kind: "local"|"file"; bytes: string; selection: RecoverySelection; fullHash: string; entryHash: string;
  owner: AdvisoryCase; selected: AdvisoryCase; working: AdvisoryCase; protected: boolean };
export type RecoverySession = { source: RecoverySource; backupKey: string };
export type RecoveryConfirmation = { sourceHash: string; entryHash: string; contentHash: string; decisionsHash: string;
  zone: HistoricalZone; at: string; advisorId: AdvisorId; reason: string; planningAcknowledged: boolean };
export type RecoveryDiff = { planId?: string; allocationId?: string; investmentId?: string;
  field: "capitalPotAmounts"|"capitalPotId"|"bucketAmounts"|"bucketId"|"schemaVersion"; before: unknown; after: unknown };
export type RecoveryPreview = { candidate: AdvisoryCase; diff: RecoveryDiff[]; coverage: RecoveryCoverage[]; remainingPlanning: string[]; blockers: string[] };
const copy=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const record=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==="object" && !Array.isArray(v);
function throwError(text:string):never { throw new Error(text); }

export function recoverySourceEntries(bytes: string): { id: string; name: string; snapshots: {id:string;label:string}[] }[] {
  const parsed:unknown=JSON.parse(bytes.charCodeAt(0)===0xfeff?bytes.slice(1):bytes);
  const entries=Array.isArray(parsed)?parsed:[record(parsed)&&parsed.case!==undefined?parsed.case:parsed];
  const ids=entries.map(e=>record(e)?e.id:undefined);
  return entries.filter(e=>record(e) && typeof e.id==="string" && !!e.id && ids.filter(x=>x===e.id).length===1)
    .map(e=>({id:e.id as string,name:record(e.advisory)&&typeof e.advisory.caseName==="string"?e.advisory.caseName:"Unbenannter Quellenfall",
      snapshots:Array.isArray(e.versions)?e.versions.filter((v:unknown)=>record(v)&&typeof v.id==="string"&&e.versions.filter((x:unknown)=>record(x)&&x.id===v.id).length===1)
        .map((v:{id:string;label?:unknown})=>({id:v.id,label:typeof v.label==="string"?v.label:v.id})):[]}));
}
export function selectRecoverySource(bytes:string,kind:"local"|"file",selection:RecoverySelection):RecoverySource {
  const parsed:unknown=JSON.parse(bytes.charCodeAt(0)===0xfeff?bytes.slice(1):bytes);
  if (kind==="local" && !Array.isArray(parsed)) throwError("Der lokale Fallbestand ist nicht als Array lesbar; keine Kopienfreigabe.");
  const entries=Array.isArray(parsed)?parsed:[record(parsed)&&parsed.case!==undefined?parsed.case:parsed];
  const found=entries.filter(e=>record(e)&&e.id===selection.caseId);
  if (found.length!==1) throwError("Quellfall ist nicht eindeutig identifiziert.");
  const owner=found[0] as AdvisoryCase;
  let selected=owner;
  if (selection.snapshotId) {
    const versions=Array.isArray(owner.versions)?owner.versions.filter(v=>v?.id===selection.snapshotId):[];
    if (versions.length!==1 || !record(versions[0].snapshot) || Object.hasOwn(versions[0].snapshot,"versions")) throwError("Historischer Snapshot ist nicht eindeutig und verlustfrei auswählbar.");
    selected=versions[0].snapshot as AdvisoryCase;
  }
  const working=selection.snapshotId?{...copy(selected),id:owner.id,versions:copy(owner.versions)}:copy(selected);
  let protectedSource=true;
  try { protectedSource=!normalizeImportedCase(selected,false); } catch { /* raw source retained */ }
  return {kind,bytes,selection:copy(selection),fullHash:sha256(bytes),entryHash:jsonHash(selected),owner:copy(owner),selected:copy(selected),working,protected:protectedSource};
}
function currentSource(storage:RecoveryStorage,source:RecoverySource) {
  const fresh=selectRecoverySource(source.bytes,source.kind,source.selection);
  if (fresh.fullHash!==source.fullHash || fresh.entryHash!==source.entryHash || canonicalJson(fresh.working)!==canonicalJson(source.working)) throwError("Quelleninhalt oder Quellenauswahl wurde verändert. Neue Prüfung erforderlich.");
  if (source.kind==="local" && storage.getItem(CASE_STORAGE_KEY)!==source.bytes) throwError("Der lokale Quellenbestand hat sich geändert. Auswahl und Bestätigung müssen erneuert werden.");
  return fresh;
}
/** Mandatory even for a graph-valid source. Store exact full bytes and read back. */
export function beginRecovery(storage:RecoveryStorage,source:RecoverySource):RecoverySession {
  const fresh=currentSource(storage,source);
  if(new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(new TextEncoder().encode(source.bytes))!==source.bytes)throwError("Originalquelle ist nicht bytegetreu als UTF-8 sicherbar.");
  const key=`${RECOVERY_PREFIX}h5b-${crypto.randomUUID()}`;
  if (storage.getItem(key)!==null) throwError("Sicherungsschlüssel existiert bereits; Prüfung abgebrochen.");
  storage.setItem(key,source.bytes);
  if (storage.getItem(key)!==source.bytes || sha256(storage.getItem(key)!)!==source.fullHash) throwError("Originalsicherung konnte nicht bytegleich zurückgelesen werden. Entwurf bleibt gesperrt.");
  currentSource(storage,source);
  return {source:fresh,backupKey:key};
}
export function verifyRecoverySession(storage:RecoveryStorage,session:RecoverySession) {
  const fresh=currentSource(storage,session.source);
  const backup=storage.getItem(session.backupKey);
  if (!session.backupKey.startsWith(`${RECOVERY_PREFIX}h5b-`) || backup!==fresh.bytes || sha256(backup)!==fresh.fullHash) throwError("Verifizierte Originalsicherung fehlt oder wurde verändert. Wiederherstellung ist gesperrt.");
  return fresh;
}
const decisionKey=recoveryDecisionKey;
function projectedLegacy(a:PlannerAllocation,pots:ReturnType<typeof diagnoseCapitalRecovery>["plans"][number]["currentPots"]) {
  const amounts:Record<string,number>={};
  for (const [potId,amount] of Object.entries(rawBindings(a))) {
    const p=pots.find(x=>x.id===potId);
    if (!p) throwError("Legacybezug kann ohne gültigen Zieltopf nicht bestimmt werden.");
    amounts[p.legacyBucketId]=exactSum([amounts[p.legacyBucketId]||0,amount!]);
  }
  const primary=a.capitalPotId?pots.find(p=>p.id===a.capitalPotId):undefined;
  return {bucketAmounts:amounts,bucketId:primary?.legacyBucketId??a.bucketId};
}

/** Complete deny-by-default diff: only explicitly decided relation fields may
 * differ. Arrays, ordering, all identities, finance, metadata and history remain. */
export function recoveryConservation(before:AdvisoryCase,after:AdvisoryCase,decisions:RecoveryDecision[]):boolean {
  try {
    const expected=copy(before);expected.schemaVersion=11;
    if(before.plans.length!==after.plans.length)return false;
    for(let i=0;i<before.plans.length;i++) {
      const a=expected.plans[i],b=after.plans[i];
      if(a.id!==b.id||a.allocations.length!==b.allocations.length||a.investmentPlans.length!==b.investmentPlans.length)return false;
      for(let j=0;j<a.allocations.length;j++) {
        const old=a.allocations[j],next=b.allocations[j];if(old.id!==next.id)return false;
        const permitted=decisions.filter(d=>d.planId===a.id&&d.kind!=="investment"&&d.allocationId===old.id);
        if(permitted.some(d=>d.kind==="binding"))old.capitalPotAmounts=copy(next.capitalPotAmounts);
        if(permitted.some(d=>d.kind==="primary"))old.capitalPotId=next.capitalPotId;
        if(permitted.some(d=>d.kind==="legacy")){old.bucketId=next.bucketId;old.bucketAmounts=copy(next.bucketAmounts);}
        if(!equalSum(Object.values(rawBindings(before.plans[i].allocations[j])) as number[],Object.values(rawBindings(next)) as number[]))return false;
      }
      for(let j=0;j<a.investmentPlans.length;j++) {
        const old=a.investmentPlans[j],next=b.investmentPlans[j];
        if(old.id!==next.id)return false;
        if(old.type==="phased"&&next.type==="phased"&&decisions.some(d=>d.kind==="investment"&&d.planId===a.id&&d.investmentId===old.id))old.capitalPotId=next.capitalPotId;
      }
    }
    return canonicalJson(expected)===canonicalJson(after);
  }catch{return false;}
}

/** Only typed decisions transform the deep raw copy; activeCase is never used. */
export function previewRecovery(storage:RecoveryStorage,session:RecoverySession,zone:HistoricalZone,decisions:RecoveryDecision[]):RecoveryPreview {
  const source=verifyRecoverySession(storage,session), diagnosis=diagnoseCapitalRecovery(source.working,zone);
  const candidate=copy(source.working), diff:RecoveryDiff[]=[], blockers:string[]=[], coverage:RecoveryCoverage[]=[], remainingPlanning:string[]=[];
  const add=(message:string)=>blockers.push(message);
  if (!diagnosis.repairable) add("Die Rohdateninventur enthält unabhängige Fehler oder ungeklärte Quellenangaben.");
  if (!decisions.every(validRecoveryDecision) || new Set(decisions.map(decisionKey)).size!==decisions.length) throwError("Ungültige oder doppelte fachliche Entscheidung.");
  const used=new Set<RecoveryDecision>();
  const find=(kind:RecoveryDecision["kind"],planId:string,entityId:string,from?:string)=>decisions.find(d=>d.kind===kind&&d.planId===planId&&(d.kind==="investment"?d.investmentId:d.allocationId)===entityId&&(d.kind!=="binding"||d.fromPotId===from));
  const use=(d:RecoveryDecision|undefined)=>{if(d)used.add(d);return d;};
  const changed=(field:RecoveryDiff["field"],before:unknown,after:unknown,ref:Omit<RecoveryDiff,"field"|"before"|"after">={})=>{
    if(canonicalJson(before??null)!==canonicalJson(after??null))diff.push({...ref,field,before:before??null,after:after??null});
  };
  if (diagnosis.repairable) try {
    candidate.schemaVersion=11;
    changed("schemaVersion",source.working.schemaVersion,11);
    for (const pd of diagnosis.plans) {
      const plan=candidate.plans.find(p=>p.id===pd.planId)!;
      const validTargets=new Set(pd.currentPots.map(p=>p.id));
      for (const inv of pd.allocations) {
        const a=plan.allocations.find(a=>a.id===inv.id)!, original=copy(a), result:Partial<Record<CapitalPotId,number>>={};
        let touched=false;
        for (const [potId,value] of Object.entries(inv.bindings) as [CapitalPotId,number][]) {
          const decision=use(find("binding",pd.planId,a.id,potId));
          if (pd.affectedPotIds.includes(potId)&&!decision) add(`${pd.name}: Teilbindung ${a.id}/${potId} (${value}) ist ungeklärt.`);
          if (decision?.kind==="binding") {
            touched=true;
            if (!equalSum(decision.targets.map(t=>t.amount),[value]) || decision.targets.some(t=>!validTargets.has(t.potId)||!safeRecoveryTarget(t.amount,value))) throwError("Teilbindung muss vollständig und exakt auf vorhandene Töpfe verteilt werden.");
            for (const t of decision.targets) result[t.potId]=exactSum([result[t.potId]||0,t.amount]);
          } else result[potId]=exactSum([result[potId]||0,value]);
        }
        if(touched) a.capitalPotAmounts=result;
        const primary=use(find("primary",pd.planId,a.id));
        if ((touched || a.capitalPotId && pd.affectedPotIds.includes(a.capitalPotId)) && !primary) add(`${pd.name}: Einzelreferenz ${a.id} muss ausdrücklich gewählt werden.`);
        if (primary?.kind==="primary") {
          if(!validTargets.has(primary.targetPotId)||!Object.hasOwn(rawBindings(a),primary.targetPotId)) throwError("Einzelreferenz muss eine erhaltene Teilbindung bezeichnen.");
          a.capitalPotId=primary.targetPotId;
          touched=true;
        }
        if (touched) {
          const expected=projectedLegacy(a,pd.currentPots),legacy=use(find("legacy",pd.planId,a.id));
          if (!legacy) add(`${pd.name}: Abgeleitete Legacybezüge ${a.id} müssen sichtbar bestätigt werden.`);
          else Object.assign(a,expected);
        }
        for(const field of ["capitalPotAmounts","capitalPotId","bucketAmounts","bucketId"] as const) changed(field,original[field],a[field],{planId:pd.planId,allocationId:a.id});
        const sum=exactSum(Object.values(rawBindings(a)) as number[]);
        if(!equalSum([sum],[inv.assigned])||exactDifference(a.amount,sum)!==inv.unassigned) add(`${pd.name}: Kapitalerhalt bei ${a.id} ist verletzt.`);
        if(inv.review>0) add(`${pd.name}: Reviewbetrag ${inv.review} bei ${a.id} bleibt ungeklärt; gesonderte fachliche Bearbeitung erforderlich.`);
        if(inv.unassigned>0)remainingPlanning.push(`${pd.name}: ${a.id} hat unverändert ${inv.unassigned} unzugeordnet, davon Review ${inv.review}.`);
      }
      for (const entry of plan.investmentPlans) if(entry.type==="phased") {
        const oldEntry=source.working.plans.find(p=>p.id===plan.id)!.investmentPlans.find(e=>e.id===entry.id)!;
        if(oldEntry.type!=="phased")throwError("Umsetzungstyp verändert.");
        const decision=use(find("investment",pd.planId,entry.id));
        if(pd.affectedPotIds.includes(entry.capitalPotId)&&!decision)add(`${pd.name}: Einstieg ${entry.id} benötigt eine eigene Topfentscheidung.`);
        if(decision?.kind==="investment")entry.capitalPotId=decision.targetPotId;
        changed("capitalPotId",oldEntry.capitalPotId,entry.capitalPotId,{planId:pd.planId,investmentId:entry.id});
        const pot=pd.currentPots.find(p=>p.id===entry.capitalPotId);
        const amounts=phasedEntryAmounts(plan,entry),beforeAmounts=phasedEntryAmounts(source.working.plans.find(p=>p.id===plan.id)!,oldEntry);
        if(beforeAmounts.invalid)add(`${pd.name}: Einstieg ${entry.id} hat bereits unabhängig vom Kalender eine ungültige Ausgangsdeckung oder Kondition.`);
        if(!pot||amounts.invalid)add(`${pd.name}: Einstieg ${entry.id} überschreitet seine Topfdeckung oder hat ungültige Raten/Beträge.`);
        if(beforeAmounts.stagedAmount!==amounts.stagedAmount)add(`${pd.name}: Einstieg ${entry.id} würde seinen tatsächlichen Einstiegsbetrag ändern; H5b darf dies nicht freigeben.`);
        if(pot) {
          const schedule=phasedEntryScheduleValidation(entry,pot,candidate.createdAt);
          if(!schedule.valid)add(`${pd.name}: Einstieg ${entry.id}, letzte Rate ${schedule.lastDate||"ungültig"}, Topffrist ${schedule.deadline||"ohne Jahresfrist"}: nicht fristgerecht umsetzbar.`);
        }
      }
      for (const a of plan.allocations) for(const [pid,value] of Object.entries(rawBindings(a))) {
        const staged=plan.investmentPlans.filter(e=>e.type==="phased"&&e.allocationId===a.id&&e.capitalPotId===pid)
          .map(e=>e.type==="phased"?phasedEntryAmounts(plan,e).stagedAmount:0);
        if(exactSum(staged)>value!)add(`${pd.name}: Mehrere Einstiege überschreiten gemeinsam ${a.id}/${pid}.`);
      }
      for (const pot of pd.currentPots) {
        const before=exactSum(pd.allocations.map(a=>a.bindings[pot.id]||0));
        const after=exactSum(plan.allocations.map(a=>rawBindings(a)[pot.id]||0));
        const difference=exactDifference(pot.total,after);
        coverage.push({planId:pd.planId,potId:pot.id,target:pot.total,before,after,difference});
        if(difference!==0)remainingPlanning.push(`${pd.name}: ${pot.id} ${difference>0?"Unterdeckung":"Überdeckung"} ${Math.abs(difference)}.`);
      }
      const volume=exactDifference(plan.total,exactSum(plan.allocations.map(a=>a.amount)));
      if(volume!==0)remainingPlanning.push(`${pd.name}: Planvolumen minus Allokationen ${volume}; kein automatisches Auffüllen.`);
      for(const pot of pd.historicalPots.filter(p=>!pd.currentPots.some(x=>x.id===p.id))) {
        // Explicitly include vanished pots in the before/after comparison.
        coverage.push({planId:pd.planId,potId:pot.id,target:0,before:exactSum(pd.allocations.map(a=>a.bindings[pot.id]||0)),after:exactSum(plan.allocations.map(a=>rawBindings(a)[pot.id]||0)),difference:exactDifference(0,exactSum(plan.allocations.map(a=>rawBindings(a)[pot.id]||0)))});
      }
    }
    if(used.size!==decisions.length)add("Eine Entscheidung referenziert keine vorhandene Teilbindung oder Umsetzung.");
    if(!recoveryConservation(source.working,candidate,decisions))add("Vollständiger Erhaltungs-Diff verletzt: nicht erlaubte Inhalte oder Identitäten wurden verändert.");
    if(!validCaseFinancialInputs(candidate))add("Aktuelle Finanz- und Ratenprüfung fehlgeschlagen.");
    if(!validCurrentPlanGraph(candidate))add("Aktuelle Graph-, Identitäts- oder Sparzielprüfung fehlgeschlagen.");
    const normalized=normalizeImportedCase(candidate,false);
    if(!normalized)add("Aktuelle Import-/Depotprüfung fehlgeschlagen.");
    else if(recoveryContentHash(normalized)!==recoveryContentHash(candidate))add("Die reguläre Normalisierung würde weitere Inhalte verändern. Vereinfachte H5b-Freigabe bleibt gesperrt.");
    if(recoveryContentHash(enforceCaseDepotValue(candidate))!==recoveryContentHash(candidate))add("Depotableitung würde weitere Werte verändern.");
  } catch(error) { add(error instanceof Error?error.message:"Vollständige Prüfung ist fehlgeschlagen."); }
  return {candidate,diff,coverage,remainingPlanning,blockers:[...new Set(blockers)]};
}
export function confirmRecovery(storage:RecoveryStorage,session:RecoverySession,zone:HistoricalZone,decisions:RecoveryDecision[],reason:string,advisorId:AdvisorId,planningAcknowledged:boolean):RecoveryConfirmation {
  const preview=previewRecovery(storage,session,zone,decisions);
  if(preview.blockers.length)throwError("Kopie ist gesperrt: "+preview.blockers.join(" "));
  if(reason.trim().length<10||!advisors.some(a=>a.id===advisorId))throwError("Konkrete fachliche Begründung und gültiger Beraterkontext sind erforderlich.");
  if(preview.remainingPlanning.length&&!planningAcknowledged)throwError("Verbleibender Planungsbedarf muss ausdrücklich bestätigt werden.");
  return {sourceHash:session.source.fullHash,entryHash:session.source.entryHash,contentHash:recoveryContentHash(preview.candidate),decisionsHash:jsonHash(decisions),zone,
    at:new Date().toISOString(),advisorId,reason:reason.trim(),planningAcknowledged};
}

/** Returns only after P4/P1 committed. UI activation is a separate subsequent step.
 * Existing P1 last-write-wins cross-tab limits continue to apply. */
export function commitRecovery(storage:RecoveryStorage,session:RecoverySession,zone:HistoricalZone,decisions:RecoveryDecision[],confirmation:RecoveryConfirmation) {
  const loaded=readCaseStore(storage.getItem(CASE_STORAGE_KEY));
  if(loaded.malformed)throwError("Aktueller Fallbestand ist unlesbar; keine Kopie wird geschrieben.");
  const source=verifyRecoverySession(storage,session), preview=previewRecovery(storage,session,zone,decisions);
  if(preview.blockers.length)throwError("Kopie ist weiterhin gesperrt: "+preview.blockers.join(" "));
  if(!confirmation||confirmation.sourceHash!==source.fullHash||confirmation.entryHash!==source.entryHash||confirmation.zone!==zone||confirmation.contentHash!==recoveryContentHash(preview.candidate)||confirmation.decisionsHash!==jsonHash(decisions)||confirmation.reason.trim().length<10||!advisors.some(a=>a.id===confirmation.advisorId)||!Number.isFinite(Date.parse(confirmation.at))||preview.remainingPlanning.length&&!confirmation.planningAcknowledged)
    throwError("Die fachliche Bestätigung passt nicht mehr zu Quelle und Entwurf.");
  const evidence:CapitalPotRecovery={formatVersion:1,source:{kind:source.kind,caseId:source.selection.caseId,...(source.selection.snapshotId?{snapshotId:source.selection.snapshotId}:{}),
    schema:source.selected.schemaVersion as 10|11,reference:source.selected.createdAt,fullHash:source.fullHash,entryHash:source.entryHash,hashRule:"sha256-utf8/full;sha256-canonical-json/entry"},
    historicalRule:"pre-PR40-rounded-years",currentRule:"PR40-calendar-months-clamped",historicalZone:zone,diagnosisVersion:1,
    uncertainties:diagnoseCapitalRecovery(source.working,zone).uncertainties,decisions:copy(decisions),
    confirmation:{at:confirmation.at,advisorId:confirmation.advisorId,reason:confirmation.reason,contentHash:confirmation.contentHash,decisionsHash:confirmation.decisionsHash,planningAcknowledged:confirmation.planningAcknowledged},
    checks:{conservation:true,finance:true,depot:true,graph:true,implementation:true,coverage:true},coverage:preview.coverage,remainingPlanning:preview.remainingPlanning,
    ...(source.working.capitalPotRecovery?{priorRecovery:source.working.capitalPotRecovery}:{})};
  const item:AdvisoryCase={...preview.candidate,id:`fall-h5b-${crypto.randomUUID()}`,updatedAt:new Date().toISOString(),capitalPotRecovery:evidence};
  if(item.id===source.owner.id||!validCaseFinancialInputs(item)||!validCurrentPlanGraph(item)||!normalizeImportedCase(item,false))throwError("Abschließende Kopienprüfung fehlgeschlagen.");
  // No awaited work or UI-list write between fresh verification and P1 insert.
  verifyRecoverySession(storage,session);
  const cases=insertCaseIntoStore(storage,item,source.kind==="local"?{id:source.owner.id,entryHash:jsonHash(source.owner)}:undefined);
  return {item:cases.find(c=>c.id===item.id)!,cases};
}
