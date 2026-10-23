import type { AdvisoryCase } from "./contracts";
import type { CapitalPot, CapitalPotId, PlannerAllocation } from "../planning/contracts";
import type { HistoricalZone } from "./recovery-contract";
import { validCapitalPotRecovery } from "./recovery-contract";
import { validCaseFinancialInputs } from "./financial-validation";
import { capitalPots, targetDateForNeed, monthsUntilNeed, bucketForMonths, maturityBuckets } from "../planning/capital-pots";
import { addLocalMonthsClamped, localDateParts } from "../planning/calendar";
import { exactSum, exactDifference } from "./recovery-decimal";
import { canonicalJson } from "./recovery-hash";

export type RecoveryFinding = { category: "A" | "B" | "C" | "D"; planId?: string; subject: string; message: string };
export type RecoveryNeed = { id: number; purpose: string; amount: number; years: number; dueDate?: string; historicalYear?: number; currentDate: string; currentYear: number };
export type PlanDiagnosis = { planId: string; name: string; active: boolean; preferred: boolean; total: number;
  historicalPots: CapitalPot[]; currentPots: CapitalPot[]; affectedPotIds: CapitalPotId[];
  allocations: { id: string; raw: PlannerAllocation; bindings: Partial<Record<CapitalPotId,number>>; assigned: number; unassigned: number; review: number }[];
  investmentPlans: AdvisoryCase["plans"][number]["investmentPlans"] };
export type RecoveryDiagnosis = { version: 1; schema: unknown; reference: unknown; findings: RecoveryFinding[]; uncertainties: string[];
  needs: RecoveryNeed[]; plans: PlanDiagnosis[]; repairable: boolean };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown) => typeof v === "string" && v.trim().length > 0;
const unique = (xs: unknown[]) => xs.every(id) && new Set(xs).size === xs.length;
const deadline = (pot: CapitalPot, reference: string) => pot.kind === "year" ? pot.earliestDueDate || addLocalMonthsClamped(reference,pot.minMonths) : undefined;

/** Explicit maps are inventories, including zero keys. The old fallback is only
 * interpreted when no map was stored; ambiguous zero-map fallbacks are blocked. */
export function rawBindings(a: PlannerAllocation): Partial<Record<CapitalPotId,number>> {
  if (a.capitalPotAmounts !== undefined) return { ...a.capitalPotAmounts };
  return a.capitalPotId ? { [a.capitalPotId]: a.amount } : {};
}

/** Raw, read-only diagnostic. No normalizer, default repair or reconciliation. */
export function diagnoseCapitalRecovery(raw: unknown, zone?: HistoricalZone): RecoveryDiagnosis {
  const d: RecoveryDiagnosis={version:1,schema:record(raw)?raw.schemaVersion:undefined,reference:record(raw)?raw.createdAt:undefined,
    findings:[],uncertainties:["Die historische Kalendergegenrechnung erklärt mögliche Abweichungen; sie beweist keine damalige Beraterentscheidung."],needs:[],plans:[],repairable:false};
  const fail=(subject:string,message:string,planId?:string)=>d.findings.push({category:"D",subject:String(subject),message,planId:planId===undefined?undefined:String(planId)});
  if (!record(raw) || !record(raw.advisory) || !Array.isArray(raw.advisory.needs) || !Array.isArray(raw.plans)) { fail("Fall","Quelldarstellung ist nicht eindeutig interpretierbar."); return d; }
  if (raw.schemaVersion !== 10 && raw.schemaVersion !== 11) fail("Schema","Aktive Wiederherstellung ist auf Schema 10 und 11 begrenzt; ältere Originale bleiben geschützt.");
  if (!validCaseFinancialInputs(raw,Number(raw.schemaVersion))) fail("Finanzwerte","Unabhängige Finanz- oder Ratenfehler; keine Reparaturfreigabe.");
  if (raw.capitalPotRecovery !== undefined && !validCapitalPotRecovery(raw.capitalPotRecovery)) fail("Herkunft","Ungültiger Herkunftsnachweis.");
  if (!zone) d.uncertainties.push("Historische Zeitzone ist ungeklärt. Vor einer Zuordnung muss sie anhand der Quelle ausdrücklich festgelegt werden.");
  const reference=typeof raw.createdAt === "string" ? raw.createdAt : "";
  const parts=localDateParts(reference);
  if (!parts || !/^(\d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2}))$/.test(reference) || !Number.isFinite(Date.parse(reference))) {
    fail("Fallreferenz","Ungültiges oder zeitlich mehrdeutiges Referenzdatum."); return d;
  }
  const needIds=raw.advisory.needs.map(n=>record(n)?n.id:undefined);
  if (needIds.some(n=>typeof n !== "number" || !Number.isFinite(n)) || new Set(needIds).size !== needIds.length) { fail("Bedarfe","Fehlende oder uneindeutige Bedarf-IDs."); return d; }
  const c=raw as unknown as AdvisoryCase;
  if(typeof c.advisory.caseName!=="string")fail("Fallname","Ungültige Fallmetadaten.");
  const needsValid=c.advisory.needs.every(n=>n && typeof n.purpose === "string" && Number.isFinite(n.years) && n.years >= 0 &&
    Number.isFinite(n.amount) && n.amount >= 0 && (n.dueDate === undefined || typeof n.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(n.dueDate) && !!localDateParts(n.dueDate)));
  if (!needsValid) { fail("Bedarfe","Ungültige Laufzeit, Beträge oder explizite Termine; keine Ersatzwerte."); return d; }
  const historicalYear=zone ? Number(new Intl.DateTimeFormat("en",{timeZone:zone,year:"numeric"}).format(new Date(reference))) : undefined;
  const zonedParts=zone ? new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(reference)) : null;
  const historicalReference=zonedParts ? ["year","month","day"].map(part=>
    zonedParts.find(p=>p.type===part)!.value.padStart(part==="year"?4:2,"0")).join("-") : reference;
  try {
    d.needs=c.advisory.needs.map(n=>({ ...n,historicalYear:historicalYear === undefined ? undefined : n.dueDate && Number(n.dueDate.slice(0,4))>1900 ? Number(n.dueDate.slice(0,4)) : historicalYear+Math.max(0,Math.round(n.years)),
      currentDate:targetDateForNeed(n,reference),currentYear:Number(targetDateForNeed(n,reference).slice(0,4)) }));
    if (!id(c.id) || !unique(c.plans.map(p=>p?.id)) || !c.plans.length || c.plans.filter(p=>p?.id===c.activePlanId).length!==1 || c.plans.some(p=>typeof p?.preferred!=="boolean") || c.plans.filter(p=>p.preferred).length>1)
      fail("Identitäten","Fall-/Planidentitäten oder Active-/Preferred-Markierungen sind ungültig.");
    if (!Array.isArray(c.versions) || !unique(c.versions.map(v=>v?.id))) fail("Historie","Historienidentitäten sind nicht eindeutig.");
    if (!Array.isArray(c.savingsGoals) || !unique(c.savingsGoals.map(g=>g?.id))) fail("Sparziele","Sparzielidentitäten sind nicht eindeutig.");
    if (!Array.isArray(c.depot) || !Array.isArray(c.depotAccounts) || !unique(c.depot.map(h=>h?.id)) || !unique(c.depotAccounts.map(a=>a?.id)) ||
      c.depot.some(h=>!c.depotAccounts.some(a=>a.id===h.depotId))) fail("Depot","Unabhängige Depot- oder Holdingfehler.");
    const allocationIds:string[]=[], investmentIds:string[]=[];
    for (const p of c.plans) {
      if(!p||!id(p.id)){fail("Plan","Fehlende oder ungültige Planidentität.");continue;}
      if(typeof p.name!=="string")fail(p.id,"Ungültiger Planname.",p.id);
      if (!p || !Array.isArray(p.allocations) || !Array.isArray(p.investmentPlans) || !Array.isArray(p.depotHoldingIds)) { fail("Plan","Ungültige Plankollektionen.",p?.id); continue; }
      if (new Set(p.depotHoldingIds).size !== p.depotHoldingIds.length || p.depotHoldingIds.some(x=>!c.depot?.some(h=>h.id===x))) fail("Depotwahl","Ungültige Plandepotbezüge.",p.id);
      const current=capitalPots(c.advisory,p.total,reference);
      const historical=current.filter(x=>x.kind!=="year").map(x=>({...x}));
      if (zone) {
        const grouped=new Map<number,typeof c.advisory.needs>();
        for (const n of c.advisory.needs.filter(n=>n.amount>0)) {
          const y=d.needs.find(x=>x.id===n.id)!.historicalYear!;
          grouped.set(y,[...(grouped.get(y)||[]),n]);
        }
        for (const [year,ns] of [...grouped].sort(([a],[b])=>a-b)) {
          const minMonths=Math.min(...ns.map(n=>monthsUntilNeed(n,historicalReference)));
          const exact=ns.map(n=>n.dueDate).filter((s):s is string=>!!s).sort();
          historical.push({id:`year-${year}`,year,kind:"year",label:String(year),range:"Historische Vergleichsrechnung",total:exactSum(ns.map(n=>n.amount)),needs:ns,
            earliestDueDate:exact[0]||addLocalMonthsClamped(historicalReference,minMonths)||undefined,minMonths,legacyBucketId:bucketForMonths(minMonths)});
        }
      }
      const affected=new Set<CapitalPotId>();
      if (zone) for (const old of historical) {
        const now=current.find(x=>x.id===old.id);
        if (!now) { affected.add(old.id); d.findings.push({category:"A",planId:p.id,subject:old.id,message:"Historischer Topf entfällt in der aktuellen Kalenderrechnung."}); }
        else if (canonicalJson(old.needs.map(n=>n.id))!==canonicalJson(now.needs.map(n=>n.id)) || old.total!==now.total) {
          affected.add(old.id); d.findings.push({category:"B",planId:p.id,subject:old.id,message:"Gleiche ID, andere Bedarfszugehörigkeit oder Sollbeträge."});
        } else if (deadline(old,historicalReference)!==deadline(now,reference)) {
          affected.add(old.id); d.findings.push({category:"C",planId:p.id,subject:old.id,message:`Maßgebliche Frist: ${deadline(old,historicalReference)} → ${deadline(now,reference)}.`});
        }
      }
      const allocations:PlanDiagnosis["allocations"]=[];
      for (const a of p.allocations) {
        allocationIds.push(a?.id);
        if (!a || !id(a.productId) || typeof a.productName!=="string" || !id(a.solutionId)) { fail("Allokation","Ungültige Produkt-/Solutionidentität.",p.id); continue; }
        const bindings=rawBindings(a), values=Object.values(bindings) as number[];
        if (values.some(v=>!Number.isFinite(v)||v<0)) { fail(a.id,"Ungültige Teilbeträge.",p.id); continue; }
        const assigned=exactSum(values), unassigned=exactDifference(a.amount,assigned);
        if (unassigned<0 || (a.capitalPotReviewAmount||0)>unassigned) fail(a.id,"Überzuordnung oder widersprüchlicher Reviewbetrag.",p.id);
        if (a.capitalPotAmounts !== undefined && !values.some(v=>v>0) && a.capitalPotId && a.amount>0) fail(a.id,"Nullmap und Einzelreferenz widersprechen sich; keine implizite Vollbindung.",p.id);
        if (a.capitalPotId && !Object.hasOwn(bindings,a.capitalPotId)) fail(a.id,"Einzelreferenz steht außerhalb der gespeicherten Teilbindungen.",p.id);
        for (const key of new Set([...Object.keys(bindings),...(a.capitalPotId?[a.capitalPotId]:[])])) if (!current.some(x=>x.id===key)) {
          affected.add(key as CapitalPotId); d.findings.push({category:"A",planId:p.id,subject:`${a.id}/${key}`,message:"Gespeicherter Topfbezug existiert heute nicht, auch Nullschlüssel sind relevant."});
        }
        const expectedLegacy=(pots:CapitalPot[])=>{
          const result:Record<string,number>={};
          for(const [pid,value] of Object.entries(bindings)) {
            const pot=pots.find(x=>x.id===pid);if(!pot)return null;
            if(value!>0)result[pot.legacyBucketId]=exactSum([result[pot.legacyBucketId]||0,value!]);
          }
          return result;
        };
        const storedLegacy=a.bucketAmounts===undefined?undefined:Object.fromEntries(Object.entries(a.bucketAmounts).filter(([,v])=>v!>0));
        const oldLegacy=zone?expectedLegacy(historical):null,nowLegacy=expectedLegacy(current);
        const hybrid=[...historical,...current.filter(pot=>!historical.some(old=>old.id===pot.id))];
        const hybridUnambiguous=historical.every(old=>!current.some(now=>now.id===old.id&&now.legacyBucketId!==old.legacyBucketId));
        const legacyMatches=(expected:Record<string,number>|null,pots:CapitalPot[])=>expected!==null &&
          (storedLegacy===undefined||canonicalJson(storedLegacy)===canonicalJson(expected)) &&
          (!a.capitalPotId||pots.find(pot=>pot.id===a.capitalPotId)?.legacyBucketId===a.bucketId);
        if(!maturityBuckets.some(b=>b.id===a.bucketId)||a.bucketAmounts&&Object.keys(a.bucketAmounts).some(k=>!maturityBuckets.some(b=>b.id===k))||
          zone&&!legacyMatches(oldLegacy,historical)&&!legacyMatches(nowLegacy,current)&&!(hybridUnambiguous&&legacyMatches(expectedLegacy(hybrid),hybrid)))
          fail(a.id,"Legacy-Bucketbezüge widersprechen sowohl historischer als auch aktueller Kapitalbindung; keine Zuordnung erraten.",p.id);
        allocations.push({id:a.id,raw:a,bindings,assigned,unassigned,review:a.capitalPotReviewAmount||0});
      }
      for (const e of p.investmentPlans) {
        investmentIds.push(e?.id);
        if (!e || !["monthly","quarterly","semiannual","annual"].includes(e.frequency) || (!/^\d{4}-\d{2}-\d{2}$/.test(e.startDate)||!localDateParts(e.startDate))) fail(e?.id||"Einstieg","Ungültiger Rhythmus oder Starttermin.",p.id);
        if (e?.type==="phased" && (!p.allocations.some(a=>a.id===e.allocationId) || !["amount","percent"].includes(e.stagedMode))) fail(e.id,"Ungültige Einstiegsreferenz oder Modus.",p.id);
        else if (e?.type==="savings" && e.targetRef && (e.targetRef.kind==="need" ? c.advisory.needs.filter(n=>n.id===e.targetRef!.id).length!==1 : e.targetRef.kind==="savingsGoal" ? c.savingsGoals?.filter(g=>g.id===e.targetRef!.id).length!==1 : true)) fail(e.id,"Ungültige Sparzielreferenz.",p.id);
        else if (e?.type!=="phased" && e?.type!=="savings") fail("Einstieg","Unbekannter Umsetzungstyp.",p.id);
      }
      d.plans.push({planId:p.id,name:typeof p.name==="string"?p.name:"Plan ohne gültigen Namen",active:p.id===c.activePlanId,preferred:p.preferred,total:p.total,historicalPots:historical,currentPots:current,affectedPotIds:[...affected],allocations,investmentPlans:p.investmentPlans});
    }
    if (!unique(allocationIds) || !unique(investmentIds)) fail("Identitäten","Allokations-/Investmentidentitäten sind nicht eindeutig.");
  } catch { fail("Rohdaten","Dateninventur ist nicht verlustfrei möglich; die Quelle bleibt geschützt."); }
  d.repairable=!!zone && !d.findings.some(f=>f.category==="D");
  return d;
}
