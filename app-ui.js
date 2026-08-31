"use strict";

function getAllocationData(){
  const total=investment();
  return assets.map(a=>{const raw=safeNumber(inputFor(a.id).value),currentAmount=state.mode==="amount"?raw:total*raw/100;
    const currentPercent=total>0?currentAmount/total*100:0,targetPercent=safeNumber(targetFor(a.id).value),targetAmount=total*targetPercent/100;
    return {...a,currentAmount,currentPercent,targetPercent,targetAmount,differenceAmount:targetAmount-currentAmount,differencePercent:targetPercent-currentPercent};
  });
}

function validateAssets(data){
  const total=investment(),assignedAmount=data.reduce((s,x)=>s+x.currentAmount,0),assignedPercent=data.reduce((s,x)=>s+x.currentPercent,0),
    targetPercent=data.reduce((s,x)=>s+x.targetPercent,0),errors=[],warnings=[],eps=.005;
  if(total<=0)errors.push("Bitte geben Sie eine Anlagesumme größer als 0 EUR ein.");
  if(state.mode==="percent"&&assignedPercent>100+eps)errors.push(`Die IST-Prozentsätze ergeben ${number.format(assignedPercent)} % und überschreiten 100 %.`);
  if(state.mode==="amount"&&assignedAmount>total+eps)errors.push(`Die IST-Beträge übersteigen die Anlagesumme um ${euro.format(assignedAmount-total)}.`);
  if(targetPercent>100+eps)errors.push(`Die SOLL-Prozentsätze ergeben ${number.format(targetPercent)} % und überschreiten 100 %.`);
  else if(targetPercent<100-eps)warnings.push(`Die SOLL-Struktur umfasst nur ${number.format(targetPercent)} %.`);
  if(assignedPercent<100-eps&&total>0)warnings.push(`${euro.format(Math.max(0,total-assignedAmount))} sind im IST keiner Assetklasse zugeordnet.`);
  return {valid:errors.length===0,errors,warnings,assignedAmount,assignedPercent,targetPercent};
}

function updateDashboard(){
  const data=getAllocationData(),v=validateAssets(data),total=investment(),unassigned=Math.max(0,total-v.assignedAmount);
  const maxDev=Math.max(...data.map(x=>Math.abs(x.differencePercent)));
  el.inputColumnTitle.textContent=state.mode==="amount"?"IST-Betrag":"IST-Anteil";
  data.forEach(x=>{
    document.querySelector(`[data-ist-percent="${x.id}"]`).textContent=`${number.format(x.currentPercent)} %`;
    document.querySelector(`[data-target-amount="${x.id}"]`).textContent=euro.format(x.targetAmount);
    const d=document.querySelector(`[data-difference="${x.id}"]`);d.textContent=`${x.differenceAmount>=0?"+":"−"}${euro.format(Math.abs(x.differenceAmount))}`;
    d.classList.toggle("positive",x.differenceAmount>.005);d.classList.toggle("negative",x.differenceAmount<-.005);
  });
  el.assignedSummary.textContent=`${euro.format(v.assignedAmount)} · ${number.format(v.assignedPercent)} %`;
  el.kpiInvestment.textContent=euro.format(total);el.kpiAssigned.textContent=`${number.format(v.assignedPercent)} %`;
  el.kpiUnassigned.textContent=euro.format(unassigned);el.kpiDeviation.textContent=`${number.format(maxDev)} %-Pkt.`;
  el.donutValue.textContent=`${number.format(Math.min(v.assignedPercent,100))} %`;
  el.statusMessage.className="status-message";
  if(v.errors.length){el.statusMessage.textContent=v.errors.join(" ");el.statusMessage.classList.add("error")}
  else if(v.warnings.length){el.statusMessage.textContent=v.warnings.join(" ");el.statusMessage.classList.add("warning")}
  else{el.statusMessage.textContent="Die Asset-Eingaben sind vollständig.";el.statusMessage.classList.add("ok")}
  let cursor=0,segments=[];
  data.forEach(x=>{const p=Math.max(0,Math.min(x.currentPercent,100-cursor));if(p>0){segments.push(`${x.color} ${cursor}% ${cursor+p}%`);cursor+=p}});
  if(cursor<100)segments.push(`#dce4ea ${cursor}% 100%`);el.donut.style.background=`conic-gradient(${segments.join(",")})`;
  el.legend.innerHTML=data.map(x=>`<div class="legend-item"><span class="dot" style="--asset-color:${x.color}"></span><span>${x.name}</span><span class="legend-value">${number.format(x.currentPercent)} %</span></div>`).join("");
  el.comparison.innerHTML=data.map(x=>`<div class="comparison-row" style="--asset-color:${x.color}"><strong>${x.name}</strong><div class="bar-stack">
    <div class="bar-track"><div class="bar ist" style="width:${Math.min(x.currentPercent,100)}%"></div></div>
    <div class="bar-track"><div class="bar soll" style="width:${Math.min(x.targetPercent,100)}%"></div></div>
    <div class="bar-labels"><span>IST</span><span>SOLL</span></div></div><span>${number.format(x.currentPercent)} / ${number.format(x.targetPercent)} %</span></div>`).join("");
  const pv=productValidation();el.optimizeButton.disabled=!v.valid||Math.abs(v.targetPercent-100)>.005||!pv.valid;
}

function updateAll(){updateDashboard();updateProductSummary()}

function setInputMode(mode){
  if(state.mode===mode)return;const data=getAllocationData(),total=investment();state.mode=mode;
  el.modeAmount.classList.toggle("active",mode==="amount");el.modePercent.classList.toggle("active",mode==="percent");
  data.forEach(x=>{inputFor(x.id).step=mode==="amount"?"100":".1";inputFor(x.id).value=mode==="amount"?round(x.currentAmount,2):total>0?round(x.currentPercent,2):0;
    document.querySelector(`[data-ist-unit="${x.id}"]`).textContent=mode==="amount"?"EUR":"%"});
  updateAll();
}

function optimizeDepot(){
  calculateRisk();const data=getAllocationData(),v=validateAssets(data),pv=productValidation();
  if(!v.valid||Math.abs(v.targetPercent-100)>.005||!pv.valid){updateAll();return}
  const tolerance=safeNumber(el.tolerance.value),sorted=[...data].sort((a,b)=>Math.abs(b.differencePercent)-Math.abs(a.differencePercent)),
    relevant=sorted.filter(x=>Math.abs(x.differencePercent)>tolerance),profile=profiles[state.selectedRisk];
  el.rebalancingList.innerHTML=sorted.map(x=>`<div class="rebalancing-item" style="--asset-color:${x.color}"><span><strong>${x.name}</strong><br>
    <small>${x.differenceAmount>.005?"Aufstocken":x.differenceAmount<-.005?"Reduzieren":"Beibehalten"}: ${number.format(x.currentPercent)} % → ${number.format(x.targetPercent)} %</small></span>
    <strong class="${x.differenceAmount>=0?"positive":"negative"}">${x.differenceAmount>=0?"+":"−"}${euro.format(Math.abs(x.differenceAmount))}</strong></div>`).join("");
  const productNames=state.productRows.filter(r=>r.productId&&r.weight>0).sort((a,b)=>b.weight-a.weight).map(r=>`${productById[r.productId].name} ${number.format(r.weight)} %`);
  const parts=[`<p><strong>Risikotyp:</strong> ${profile.name}. ${profile.description}</p>`];
  if(state.method==="model")parts.push(`<p><strong>Musterportfolio:</strong> Das Zielproduktportfolio übernimmt die Bausteine des ${profile.label}. Die Produktgewichte wurden auf eine strategische Asset-Allokation von ${assets.map(a=>`${a.name} ${number.format(safeNumber(targetFor(a.id).value))} %`).join(", ")} verdichtet.</p>`);
  else{parts.push("<p><strong>KI-Logik:</strong> Die lokale Simulation leitet zunächst die Assetquote aus Risikotyp und Anlegermerkmalen ab und wählt anschließend passende, möglichst klar zuordenbare Core- und Satellitenbausteine aus der aktuellen Hausmeinung.</p>");
    if(state.aiReasons.length)parts.push(`<ul>${state.aiReasons.map(r=>`<li>${r}</li>`).join("")}</ul>`)}
  parts.push(`<p><strong>Konkrete Zielprodukte:</strong> ${productNames.join("; ")}.</p>`);
  if(relevant.length){parts.push("<p><strong>Wesentliche IST/SOLL-Abweichungen:</strong></p><ul>");
    relevant.slice(0,5).forEach(x=>parts.push(`<li><strong>${x.name}</strong> ist um ${number.format(Math.abs(x.differencePercent))} Prozentpunkte ${x.differencePercent>0?"untergewichtet":"übergewichtet"}; vorgesehen ist eine ${x.differencePercent>0?"Aufstockung":"Reduzierung"} um ${euro.format(Math.abs(x.differenceAmount))}.</li>`));parts.push("</ul>")}
  else parts.push(`<p>Alle Assetklassen liegen innerhalb der Toleranz von ${number.format(tolerance)} Prozentpunkten.</p>`);
  parts.push("<p>Die konkrete Umsetzung sollte zusätzlich Produktkosten, steuerliche Auswirkungen, Mindestanlagen, Verfügbarkeit sowie bestehende Verlust- oder Gewinnpositionen berücksichtigen.</p>");
  el.reasoning.innerHTML=`<h3>Begründung der Optimierung</h3>${parts.join("")}`;
  state.optimized=true;el.applyButton.disabled=false;el.optimizationEmpty.classList.add("hidden");el.optimizationResult.classList.remove("hidden");
}

function applyTargetAsCurrent(){
  if(!state.optimized)return;const total=investment();
  assets.forEach(a=>{const t=safeNumber(targetFor(a.id).value);inputFor(a.id).value=state.mode==="amount"?round(total*t/100,2):round(t,2)});
  state.optimized=false;el.applyButton.disabled=true;hideOptimization();updateAll();
}
function hideOptimization(){el.optimizationEmpty.classList.remove("hidden");el.optimizationResult.classList.add("hidden")}

function setMethod(method){
  state.method=method;el.methodModelCard.classList.toggle("active",method==="model");el.methodAiCard.classList.toggle("active",method==="ai");
  el.calculateTargetButton.textContent=method==="model"?"Risikotyp und Musterportfolio übernehmen":"Risikotyp und KI-Portfolio berechnen";
}

function resetCalculator(){
  el.horizon.value="medium";el.lossTolerance.value="medium";el.investmentGoal.value="balanced";el.marketReaction.value="hold";
  el.experience.value="medium";el.liquidityNeed.value="medium";el.realAssetPreference.value="medium";el.sustainabilityPreference.value="none";
  el.portfolioStyle.value="coreSatellite";el.manualRisk.value="auto";el.investmentAmount.value=250000;el.tolerance.value=3;
  state.mode="amount";state.method="model";state.selectedRisk="rb3";state.aiReasons=[];state.optimized=false;
  el.modeAmount.classList.add("active");el.modePercent.classList.remove("active");
  document.querySelector('input[name="method"][value="model"]').checked=true;setMethod("model");
  assets.forEach(a=>{inputFor(a.id).value=defaultAmounts[a.id];inputFor(a.id).step="100";document.querySelector(`[data-ist-unit="${a.id}"]`).textContent="EUR"});
  calculateRisk();loadModelProducts("rb3");el.applyButton.disabled=true;hideOptimization();updateAll();
}

function renderUniverse(){
  const q=normalizeName(el.universeSearch.value),cat=el.universeCategory.value,asset=el.universeAsset.value,rk=el.universeRisk.value,sust=el.universeSustainable.value;
  const filtered=houseUniverse.filter(p=>{
    const text=normalizeName([p.name,p.wkn,p.category,p.region,p.sector,p.theme,p.factor].join(" "));
    return (!q||text.includes(q))&&(!cat||p.category===cat)&&(!asset||(p.allocations[asset]||0)>0)&&(!rk||String(p.rk)===rk)&&(!sust||p.sustainable===sust);
  });
  el.universeCount.textContent=`${filtered.length} von ${houseUniverse.length} Produkten`;
  el.universeRows.innerHTML=filtered.map(p=>`<tr>
    <td><strong>${p.name}</strong></td><td>${p.wkn}</td><td><span class="category-chip" style="--chip-color:${categoryColors[p.category]||"#003f8f"}">${p.category}</span></td>
    <td>${p.rk?"RK "+p.rk:"–"}</td><td>${p.horizon}</td><td><div class="asset-mix">${assetMixHtml(p.allocations)}</div></td>
    <td>${p.region}</td><td>${p.sector}</td><td>${p.theme}</td><td>${p.factor}</td><td>${p.sustainable}</td><td>${p.coreSatellite}</td>
    <td><button class="btn btn-secondary btn-small" data-add-universe="${p.id}">Als Zielprodukt</button></td></tr>`).join("");
  document.querySelectorAll("[data-add-universe]").forEach(btn=>btn.addEventListener("click",e=>{
    const id=e.target.dataset.addUniverse;if(state.productRows.some(r=>r.productId===id)){alert("Dieses Produkt ist bereits im Zielportfolio enthalten.");return}
    addProductRow(id,0);document.getElementById("productEditor").scrollIntoView({behavior:"smooth",block:"start"});
  }));
}

function initUniverseFilters(){
  [...new Set(houseUniverse.map(p=>p.category))].sort((a,b)=>a.localeCompare(b,"de")).forEach(c=>{
    const o=document.createElement("option");o.value=c;o.textContent=c;el.universeCategory.appendChild(o);
  });
  [el.universeSearch,el.universeCategory,el.universeAsset,el.universeRisk,el.universeSustainable].forEach(c=>c.addEventListener(c===el.universeSearch?"input":"change",renderUniverse));
  renderUniverse();
}

document.querySelectorAll(".risk-question,#manualRisk").forEach(c=>c.addEventListener("change",calculateRisk));
document.querySelectorAll('input[name="method"]').forEach(r=>r.addEventListener("change",e=>setMethod(e.target.value)));
el.calculateTargetButton.addEventListener("click",applyStrategicTarget);
el.modeAmount.addEventListener("click",()=>setInputMode("amount"));el.modePercent.addEventListener("click",()=>setInputMode("percent"));
el.investmentAmount.addEventListener("input",()=>{renderProductEditor();updateAll();state.optimized=false;hideOptimization()});
el.tolerance.addEventListener("input",()=>{state.optimized=false;hideOptimization();updateAll()});
el.optimizeButton.addEventListener("click",optimizeDepot);el.applyButton.addEventListener("click",applyTargetAsCurrent);el.resetButton.addEventListener("click",resetCalculator);
el.loadModelProductsButton.addEventListener("click",()=>{calculateRisk();loadModelProducts(state.selectedRisk)});
el.loadAiProductsButton.addEventListener("click",loadAiProducts);
el.addProductRowButton.addEventListener("click",()=>addProductRow());
el.normalizeProductsButton.addEventListener("click",normalizeProductWeights);
el.syncProductsButton.addEventListener("click",()=>syncAssetTargetsFromProducts(true));
el.autoSyncProducts.addEventListener("change",()=>{if(el.autoSyncProducts.checked)syncAssetTargetsFromProducts(true)});

renderAssetRows();calculateRisk();initUniverseFilters();loadModelProducts("rb3");updateAll();
