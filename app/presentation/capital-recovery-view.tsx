import { recoveryDecisionKey } from "../domain/case/recovery-contract";
import { parseRecoveryAmountDraft } from "../domain/case/recovery-decimal";
import { useEffect, useState } from "react";
import type { AdvisoryCase } from "../domain/case/contracts";
import type { AdvisorId } from "../domain/advisory/contracts";
import type { CapitalPotId } from "../domain/planning/contracts";
import type { HistoricalZone, RecoveryDecision } from "../domain/case/recovery-contract";
import { diagnoseCapitalRecovery } from "../domain/case/capital-recovery-diagnosis";
import { capitalPotDeadline } from "../domain/planning/investment-plans";
import { canonicalJson } from "../domain/case/recovery-hash";
import { advisors } from "../data/advisors";
import { CASE_STORAGE_KEY } from "../case-storage";
import { beginRecovery,selectRecoverySource,recoverySourceEntries,previewRecovery,confirmRecovery,commitRecovery,
  type RecoverySource,type RecoverySession,type RecoveryConfirmation,type RecoveryPreview } from "../capital-recovery";

const numberText=(n:number)=>String(n); // exact stored representation, intentionally no currency rounding
const errorText=(error:unknown)=>error instanceof Error?error.message:"Prüfung fehlgeschlagen. Quelle bleibt erhalten.";
function downloadSource(source:RecoverySource) {
  const url=URL.createObjectURL(new Blob([source.bytes],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download=source.kind==="local"?"h5b-original-fallbestand.json":"h5b-original-quelldatei.json";
  a.click();URL.revokeObjectURL(url);
}
const key=recoveryDecisionKey;

function BindingEditor({planId,allocationId,fromPotId,amount,pots,decision,onDecision,onClear,disabled}: {
  planId:string;allocationId:string;fromPotId:CapitalPotId;amount:number;pots:{id:CapitalPotId;label:string}[];
  decision?:RecoveryDecision;onDecision:(d:RecoveryDecision)=>void;onClear:()=>void;disabled:boolean;
}) {
  const [targets,setTargets]=useState([{potId:"",amount:String(amount)}]);
  const [error,setError]=useState("");
  const dirty=()=>onClear();
  return <fieldset disabled={disabled} className="h5b-binding">
    <legend>Teilbindung {allocationId} / {fromPotId}: {numberText(amount)} EUR</legend>
    {targets.map((t,i)=><div className="h5b-row" key={i}>
      <label>Zieltopf {i+1}<select aria-label={`Zieltopf ${allocationId} ${fromPotId} ${i+1}`} value={t.potId} onChange={e=>{dirty();setTargets(xs=>xs.map((x,j)=>i===j?{...x,potId:e.target.value}:x));}}>
        <option value="">Bitte fachlich auswählen</option>{pots.map(p=><option key={p.id} value={p.id}>{p.id} – {p.label}</option>)}
      </select></label>
      <label>Teilbetrag {i+1} in EUR<input aria-label={`Teilbetrag ${allocationId} ${fromPotId} ${i+1}`} value={t.amount} onChange={e=>{dirty();setTargets(xs=>xs.map((x,j)=>i===j?{...x,amount:e.target.value}:x));}}/></label>
      {targets.length>1&&<button type="button" onClick={()=>{dirty();setTargets(xs=>xs.filter((_,j)=>i!==j));}}>Teil {i+1} entfernen</button>}
    </div>)}
    <p>Dezimalpunkt oder Dezimalkomma, ohne Tausendertrennzeichen. Die vollständige Summe muss exakt erhalten bleiben.</p>
    <button type="button" onClick={()=>{dirty();setTargets(xs=>[...xs,{potId:"",amount:""}]);}}>Weitere Aufteilung</button>{" "}
    <button type="button" onClick={()=>{
      try {
        if(targets.some(t=>!t.potId))throw new Error("Zieltopf fehlt.");
        const selected=targets.map(t=>({potId:t.potId as CapitalPotId,amount:parseRecoveryAmountDraft(t.amount,amount)}));
        setError("");onDecision({kind:"binding",planId,allocationId,fromPotId,targets:selected});
      }catch(e){setError(errorText(e));}

    }}>Teilbindung festlegen</button>
    {decision?.kind==="binding"&&<p role="status">Festgelegt: {decision.targets.map(t=>`${t.potId}: ${numberText(t.amount)}`).join("; ")}. Zum Ändern neue Entscheidung festlegen.</p>}
    {error&&<p role="alert">{error}</p>}
  </fieldset>;
}

export function CapitalRecoveryView({advisorId,onCommitted}: {advisorId:AdvisorId;onCommitted:(item:AdvisoryCase,cases:AdvisoryCase[])=>void}) {
  const [bytes,setBytes]=useState<string|null>(null),[kind,setKind]=useState<"local"|"file">("local"),[filename,setFilename]=useState("");
  const [caseId,setCaseId]=useState(""),[snapshotId,setSnapshotId]=useState(""),[zone,setZone]=useState<HistoricalZone|"">("");
  const [source,setSource]=useState<RecoverySource|null>(null),[session,setSession]=useState<RecoverySession|null>(null);
  const [decisions,setDecisions]=useState<RecoveryDecision[]>([]),[confirmation,setConfirmation]=useState<RecoveryConfirmation|null>(null);
  const [reason,setReason]=useState(""),[planningAck,setPlanningAck]=useState(false),[error,setError]=useState(""),[committed,setCommitted]=useState("");
  const reset=()=>{setSource(null);setSession(null);setDecisions([]);setConfirmation(null);setReason("");setPlanningAck(false);setCommitted("");setError("");};
  const loadLocal=()=>{reset();setKind("local");setFilename("");setCaseId("");setSnapshotId("");try{setBytes(window.localStorage.getItem(CASE_STORAGE_KEY));}catch(e){setError(errorText(e));}};
  useEffect(()=>{loadLocal();},[]);
  useEffect(()=>{setConfirmation(null);},[advisorId]);
  useEffect(()=>{
    const invalidate=(e:StorageEvent)=>{if(e.key===CASE_STORAGE_KEY||e.key===session?.backupKey||e.key===null){setConfirmation(null);setError("Der Quellenbestand oder seine Sicherung wurde in einem anderen Fenster verändert. Erneut auswählen und prüfen.");}};
    window.addEventListener("storage",invalidate);return()=>window.removeEventListener("storage",invalidate);
  },[session]);
  let entries:ReturnType<typeof recoverySourceEntries>=[],parseError="";
  try{if(bytes!==null)entries=recoverySourceEntries(bytes);}catch{parseError="Quelldatei ist nicht als JSON lesbar. Keine Reparatur möglich.";}
  const diagnosis=source?diagnoseCapitalRecovery(source.working,zone||undefined):null;
  let preview:RecoveryPreview|null=null,previewError="";
  if(session&&zone&&!committed)try{preview=previewRecovery(window.localStorage,session,zone,decisions);}catch(e){previewError=errorText(e);}
  const decide=(d:RecoveryDecision)=>{setConfirmation(null);setDecisions(xs=>[...xs.filter(x=>key(x)!==key(d)),d]);setError("");};
  const removeDecision=(k:string)=>{setConfirmation(null);setDecisions(xs=>xs.filter(d=>key(d)!==k));};
  const anyDraftEdit=()=>setConfirmation(null);
  return <div className="tool-view h5b-view">
    <div className="tool-head"><div><p className="eyebrow">HISTORISCHE KAPITALBINDUNGEN</p><h1>Historische Fälle prüfen</h1>
      <p>Nach Prüfung entsteht ausschließlich eine unabhängige Fallkopie. Originalfall und historische Versionen bleiben erhalten.</p></div></div>
    <section className="h5b-panel"><h2>1. Originalquelle eindeutig auswählen</h2>
      <button onClick={loadLocal}>Lokalen Bestand frisch einlesen</button>{" "}
      <label>Separate Originaldatei auswählen <input type="file" accept=".json,application/json" onChange={async e=>{
        const f=e.target.files?.[0];if(!f)return;
        try {
          const fileBytes=new Uint8Array(await f.arrayBuffer()),text=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(fileBytes);
          const encoded=new TextEncoder().encode(text);
          if(encoded.length!==fileBytes.length||encoded.some((b,i)=>b!==fileBytes[i]))throw new Error("Dateibytes lassen sich nicht unverändert als UTF-8 sichern.");
          reset();setKind("file");setFilename(f.name);setBytes(text);setCaseId("");setSnapshotId("");
        }catch(x){setError(errorText(x));}finally{e.target.value="";}
      }}/></label>
      <p>Quelle: {kind==="local"?"vollständiger lokaler Fallbestand":`separat gewählte importierte Quelldatei: ${filename}`}</p>
      {parseError&&<p role="alert">{parseError}</p>}{bytes===null&&<p>Kein lokaler Fallbestand vorhanden. Eine Originaldatei kann ausgewählt werden.</p>}
      <label>Quellfall<select aria-label="Quellfall" value={caseId} onChange={e=>{reset();setCaseId(e.target.value);setSnapshotId("");}}>
        <option value="">Bitte eindeutig auswählen</option>{entries.map(e=><option key={e.id} value={e.id}>{e.name} · {e.id}</option>)}
      </select></label>
      <label>Ausgewählter Quellenstand<select aria-label="Ausgewählter Quellenstand" value={snapshotId} onChange={e=>{reset();setSnapshotId(e.target.value);}}>
        <option value="">Gespeicherter aktueller Stand</option>{entries.find(e=>e.id===caseId)?.snapshots.map(v=><option key={v.id} value={v.id}>Historische Version: {v.label} · {v.id}</option>)}
      </select></label>
      <label>Belegte historische Zeitzone<select aria-label="Belegte historische Zeitzone" value={zone} onChange={e=>{setZone(e.target.value as HistoricalZone|"");setConfirmation(null);setDecisions([]);}}>
        <option value="">Ungeklärt – keine Zuordnung freigeben</option><option value="Europe/Berlin">Europe/Berlin</option><option value="UTC">UTC</option>
      </select></label>
      <p>Die Zeitzone muss aus dem damaligen Nutzungskontext bekannt sein. Bei anderen oder ungeklärten Zeitzonen bleibt die vereinfachte Freigabe gesperrt.</p>
      <button disabled={!caseId||bytes===null||!!parseError} onClick={()=>{try{reset();setSource(selectRecoverySource(bytes!,kind,{caseId,snapshotId:snapshotId||undefined}));}catch(e){setError(errorText(e));}}}>Quelle prüfen</button>
    </section>
    {error&&<p className="csv-error" role="alert">{error}</p>}
    {source&&diagnosis&&<>
      <section className="h5b-panel"><h2>2. Rohdateninventur und Kalendervergleich</h2>
        <p>Original: <strong>{typeof source.owner.advisory?.caseName==="string"?source.owner.advisory.caseName:source.selection.caseId}</strong> · {source.selection.caseId} · {source.protected?"aktuell geschützt":"regulär lesbar"} · Schema {String(diagnosis.schema)} · Referenz {String(diagnosis.reference)}</p>
        {source.selection.snapshotId&&<p>Ausdrücklich gewählte historische Version: {source.selection.snapshotId}. Die vollständige Historie des Quellfalls wird unverändert übernommen.</p>}
        <button onClick={()=>downloadSource(source)}>Unveränderte Originalquelle herunterladen</button>
        <p>Der Download wird angeboten; ein Klick belegt keine erfolgreich extern gespeicherte Datei.</p>
        <details><summary>Definierte Quellenfingerabdrücke</summary><p>Vollquelle: SHA-256 der UTF-8-Originalbytes: {source.fullHash}</p><p>Ausgewählter Fall bzw. Snapshot: SHA-256 des kanonischen JSON-Inhalts (sortierte Objektschlüssel, unveränderte Arrayfolge): {source.entryHash}</p></details>
        {diagnosis.uncertainties.map((s,i)=><p key={i}>{s}</p>)}
        <div className="h5b-scroll"><table><thead><tr><th>Bedarf / ID</th><th>Betrag</th><th>Laufzeit / expliziter Termin</th><th>Historisches Vergleichsjahr</th><th>Aktueller Termin / Jahr</th></tr></thead><tbody>
          {diagnosis.needs.map(n=><tr key={n.id}><td>{n.purpose} / {n.id}</td><td>{numberText(n.amount)}</td><td>{n.years} Jahre / {n.dueDate||"relativ"}</td><td>{n.historicalYear??"ungeklärt"}</td><td>{n.currentDate} / {n.currentYear}</td></tr>)}
        </tbody></table></div>
        <ul>{diagnosis.findings.map((f,i)=><li key={i}><strong>{f.category} · {f.planId} · {f.subject}:</strong> {f.message}</li>)}</ul>
        {diagnosis.plans.map(p=><details key={p.planId} open><summary>{p.name} · {p.planId} · {p.active?"aktiv":"inaktiv"} · {p.preferred?"bevorzugt":"Alternative"} · Planvolumen {numberText(p.total)} EUR</summary>
          <div className="h5b-scroll"><table><thead><tr><th>Regel</th><th>Topf</th><th>Bedarf-IDs</th><th>Soll</th><th>Früheste Frist</th></tr></thead><tbody>
            {[["Historisch rechnerisch",p.historicalPots],["Aktuell kalendergerecht",p.currentPots]].map(([label,pots])=>(pots as typeof p.currentPots).map(pot=><tr key={`${label}/${pot.id}`}><td>{label as string}</td><td>{pot.id}</td><td>{pot.needs.map(n=>n.id).join(", ")||"—"}</td><td>{numberText(pot.total)}</td><td>{capitalPotDeadline(pot,source.working.createdAt)||"ohne Jahresfrist"}</td></tr>))}
          </tbody></table></div>
          {p.allocations.map(a=><p key={a.id}>Allokation {a.id} · {a.raw.productName}: Gesamt {numberText(a.raw.amount)}, zugeordnet {numberText(a.assigned)}, unzugeordnet {numberText(a.unassigned)}, Review {numberText(a.review)} EUR. Einzelreferenz {String(a.raw.capitalPotId||"keine")}; Map: {canonicalJson(a.bindings)}. Legacy: {a.raw.bucketId} / {canonicalJson(a.raw.bucketAmounts??{})}.</p>)}
          <details><summary>Vollständige unveränderte Allokationen, Einstiege und Sparzielbezüge</summary><pre>{JSON.stringify({allocations:p.allocations.map(a=>a.raw),investmentPlans:p.investmentPlans,savingsGoals:source.working.savingsGoals},null,2)}</pre></details>
        </details>)}
        {!session&&<button disabled={!diagnosis.repairable||!!committed} onClick={()=>{try{setSession(beginRecovery(window.localStorage,source));setError("");}catch(e){setError(`Originalsicherung fehlgeschlagen: ${errorText(e)}`);}}}>Original sichern und Entwurf öffnen</button>}
        {session&&<p role="status">Vollständige Originalquelle lokal bytegleich gesichert und zurückgelesen. Der Hauptbestand ist noch unverändert.</p>}
      </section>
      {session&&zone&&!committed&&<section className="h5b-panel" onChangeCapture={anyDraftEdit}><h2>3. Fachliche Zuordnungsentscheidungen</h2>
        <p>Eine Vorbelegung gilt nicht als Zustimmung. Betroffene Teilbindungen, Einzelreferenzen und Einstiege müssen ausdrücklich entschieden werden.</p>
        {diagnosis.plans.map(p=><section key={p.planId}><h3>{p.name} – {p.active?"aktiv":"inaktiv"}</h3>
          {p.allocations.map(a=><div key={a.id}>
            {Object.entries(a.bindings).map(([pid,amount])=><BindingEditor key={`${p.planId}/${a.id}/${pid}/${zone}`} planId={p.planId} allocationId={a.id} fromPotId={pid as CapitalPotId} amount={amount!} pots={p.currentPots}
              decision={decisions.find(d=>d.kind==="binding"&&d.planId===p.planId&&d.allocationId===a.id&&d.fromPotId===pid)} onDecision={decide} onClear={()=>removeDecision(JSON.stringify(["binding",p.planId,a.id,pid]))} disabled={false}/>)}
            <label>Einzelreferenz {a.id}<select aria-label={`Einzelreferenz ${a.id}`} value={(decisions.find(d=>d.kind==="primary"&&d.planId===p.planId&&d.allocationId===a.id) as Extract<RecoveryDecision,{kind:"primary"}>|undefined)?.targetPotId||""} onChange={e=>e.target.value?decide({kind:"primary",planId:p.planId,allocationId:a.id,targetPotId:e.target.value as CapitalPotId}):removeDecision(JSON.stringify(["primary",p.planId,a.id]))}>
              <option value="">Noch nicht entschieden</option>{p.currentPots.map(pot=><option key={pot.id} value={pot.id}>{pot.id}</option>)}
            </select></label>
            <label><input type="checkbox" checked={decisions.some(d=>d.kind==="legacy"&&d.planId===p.planId&&d.allocationId===a.id)} onChange={e=>e.target.checked?decide({kind:"legacy",planId:p.planId,allocationId:a.id}):removeDecision(JSON.stringify(["legacy",p.planId,a.id]))}/>Abgeleitete Legacy-Bucketbezüge für {a.id} anhand des vollständigen Vergleichs konsistent korrigieren</label>
          </div>)}
          {p.investmentPlans.filter(e=>e.type==="phased").map(e=><label key={e.id}>Topf des bestehenden Einstiegs {e.id}<select aria-label={`Einstieg ${e.id}`} value={(decisions.find(d=>d.kind==="investment"&&d.planId===p.planId&&d.investmentId===e.id) as Extract<RecoveryDecision,{kind:"investment"}>|undefined)?.targetPotId||""} onChange={x=>x.target.value?decide({kind:"investment",planId:p.planId,investmentId:e.id,targetPotId:x.target.value as CapitalPotId}):removeDecision(JSON.stringify(["investment",p.planId,e.id]))}>
            <option value="">Noch nicht entschieden</option>{p.currentPots.map(pot=><option key={pot.id} value={pot.id}>{pot.id}</option>)}
          </select></label>)}
        </section>)}
        {previewError&&<p role="alert" className="csv-error">{previewError}</p>}
        {preview&&<>
          <h2>4. Vollständiger Vergleich und Freigabe zur weiteren Bearbeitung</h2>
          <div className="h5b-scroll"><table aria-label="Vollständiger Änderungsvergleich"><thead><tr><th>Plan / Bezug</th><th>Feld</th><th>Original</th><th>Entwurf</th></tr></thead><tbody>
            {preview.diff.map((d,i)=><tr key={i}><td>{d.planId} / {d.allocationId||d.investmentId}</td><td>{d.field}</td><td>{canonicalJson(d.before)}</td><td>{canonicalJson(d.after)}</td></tr>)}
          </tbody></table></div>
          <div className="h5b-scroll"><table aria-label="Deckungsvergleich"><thead><tr><th>Plan / Topf</th><th>Soll aktuell</th><th>Deckung vorher</th><th>Deckung nachher</th><th>Offen (+) / überdeckt (−)</th></tr></thead><tbody>{preview.coverage.map((c,i)=><tr key={i}><td>{c.planId} / {c.potId}</td><td>{numberText(c.target)}</td><td>{numberText(c.before)}</td><td>{numberText(c.after)}</td><td>{numberText(c.difference)}</td></tr>)}</tbody></table></div>
          <p>Varianten sind Alternativen. Ihre Beträge werden nicht zu einem Kundenanlagebetrag addiert. Produkte, Gesamtbeträge, innere Identitäten und historische Snapshots bleiben unverändert.</p>
          {!!preview.blockers.length&&<div role="alert" className="csv-error"><strong>Kopienfreigabe gesperrt</strong><ul>{preview.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul></div>}
          {preview.remainingPlanning.length>0&&<><h3>Verbleibender Planungsbedarf</h3><ul>{preview.remainingPlanning.map((p,i)=><li key={i}>{p}</li>)}</ul><label><input type="checkbox" checked={planningAck} onChange={e=>{setPlanningAck(e.target.checked);setConfirmation(null);}}/>Den konkret ausgewiesenen verbleibenden Planungsbedarf zur weiteren Bearbeitung übernehmen</label></>}
          <p>Beraterkontext: <strong>{advisors.find(a=>a.id===advisorId)?.name}</strong>. Browserlokale Dokumentation, keine authentisierte Vier-Augen-Freigabe.</p>
          <label>Konkrete fachliche Begründung<textarea aria-label="Konkrete fachliche Begründung" value={reason} onChange={e=>{setReason(e.target.value);setConfirmation(null);}}/></label>
          <p>Die Bestätigung gibt ausschließlich die geprüfte Fallkopie zur weiteren Bearbeitung frei. Sie bestätigt weder Geeignetheit noch Anlageempfehlung oder Abschlussreife.</p>
          <button disabled={preview.blockers.length>0||reason.trim().length<10||preview.remainingPlanning.length>0&&!planningAck} onClick={()=>{try{setConfirmation(confirmRecovery(window.localStorage,session,zone,decisions,reason,advisorId,planningAck));setError("");}catch(e){setError(errorText(e));}}}>Gesamtdiff fachlich bestätigen</button>{" "}
          <button disabled={!confirmation||!!previewError||preview.blockers.length>0} onClick={()=>{
            let result:ReturnType<typeof commitRecovery>;
            try{result=commitRecovery(window.localStorage,session,zone,decisions,confirmation!);}catch(e){setConfirmation(null);setError(`Kopie wurde nicht gespeichert: ${errorText(e)}`);return;}
            setCommitted(result.item.id);setConfirmation(null);
            try{onCommitted(result.item,result.cases);}catch{setError(`Kopie ${result.item.id} wurde erfolgreich gespeichert. Die anschließende Anzeige konnte nicht aktualisiert werden; der Schreibvorgang wurde nicht rückgängig gemacht.`);}
          }}>Neue geprüfte Fallkopie speichern</button>
          {confirmation&&<p role="status">Bestätigung an genau diese Quelle, Entscheidungen und diesen Kandidateninhalt gebunden.</p>}
        </>}
      </section>}
      {committed&&<section className="h5b-panel"><h2>Fallkopie gespeichert</h2><p>Neue äußere Fall-ID: {committed}. Original und Historie bleiben erhalten.</p></section>}
    </>}
  </div>;
}
