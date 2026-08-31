"use strict";

function safeNumber(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,n):0}
function round(v,d=2){const f=10**d;return Math.round((v+Number.EPSILON)*f)/f}
function investment(){return safeNumber(el.investmentAmount.value)}
function inputFor(id){return document.querySelector(`[data-ist-input="${id}"]`)}
function targetFor(id){return document.querySelector(`[data-target-input="${id}"]`)}

function renderAssetRows(){
  el.allocationRows.innerHTML=assets.map(a=>`<tr>
    <td><div class="asset-label" style="--asset-color:${a.color}"><span class="asset-stripe"></span><span>${a.name}</span></div></td>
    <td><div class="input-wrap row-input"><input type="number" min="0" step="100" value="${defaultAmounts[a.id]}" data-ist-input="${a.id}"><span class="unit" data-ist-unit="${a.id}">EUR</span></div></td>
    <td class="numeric" data-ist-percent="${a.id}">0,00 %</td>
    <td><div class="input-wrap target-input"><input type="number" min="0" max="100" step=".5" value="${profiles.rb3.allocations[a.id]}" data-target-input="${a.id}"><span class="unit">%</span></div></td>
    <td class="numeric" data-target-amount="${a.id}">0,00 EUR</td>
    <td class="numeric" data-difference="${a.id}">0,00 EUR</td></tr>`).join("");
  document.querySelectorAll("[data-ist-input]").forEach(i=>i.addEventListener("input",()=>{state.optimized=false;hideOptimization();updateAll()}));
  document.querySelectorAll("[data-target-input]").forEach(i=>i.addEventListener("input",()=>{
    el.autoSyncProducts.checked=false;state.targetOrigin="Manuell angepasste Asset-Allokation";el.targetOrigin.textContent=state.targetOrigin;
    state.optimized=false;hideOptimization();updateAll();
  }));
}

function calculateRisk(){
  let score=0;
  Object.entries(riskScores).forEach(([key,map])=>score+=map[el[key].value]||0);
  let selected=score<=4?"rb2":score<=8?"rb3":"rb4";
  if(el.manualRisk.value!=="auto")selected=el.manualRisk.value;
  state.selectedRisk=selected;
  const p=profiles[selected];
  el.riskScore.textContent=score;el.riskBadge.textContent=p.label;el.calculatedProfile.value=p.name;
  el.riskDescription.textContent=p.description+(el.manualRisk.value!=="auto"?" Der Risikotyp wurde manuell vorgegeben.":"");
  return {score,selected};
}

function addDeltas(values,deltas){Object.entries(deltas).forEach(([k,v])=>values[k]+=v)}
function normalizeWithBounds(values,riskKey){
  const bounds={
    rb2:{liquiditaet:[0,25],geldwerte:[45,85],substanzwerte:[10,30],alternativ:[5,15],sachwerte:[0,10]},
    rb3:{liquiditaet:[0,20],geldwerte:[25,60],substanzwerte:[30,50],alternativ:[10,20],sachwerte:[0,10]},
    rb4:{liquiditaet:[0,15],geldwerte:[10,35],substanzwerte:[50,70],alternativ:[15,25],sachwerte:[0,10]}
  }[riskKey],result={};
  assets.forEach(a=>{const [min,max]=bounds[a.id];result[a.id]=Math.min(max,Math.max(min,Math.round(values[a.id]*2)/2))});
  const addOrder=riskKey==="rb2"?["geldwerte","liquiditaet","substanzwerte","alternativ","sachwerte"]:
    riskKey==="rb3"?["substanzwerte","geldwerte","alternativ","sachwerte","liquiditaet"]:
    ["substanzwerte","alternativ","geldwerte","sachwerte","liquiditaet"];
  let sum=Object.values(result).reduce((a,b)=>a+b,0),guard=0;
  while(Math.abs(100-sum)>=.25&&guard++<1000){
    const diff=100-sum,order=diff>0?addOrder:[...addOrder].reverse();let changed=false;
    for(const key of order){const [min,max]=bounds[key];
      if(diff>0&&result[key]+.5<=max){result[key]+=.5;changed=true;break}
      if(diff<0&&result[key]-.5>=min){result[key]-=.5;changed=true;break}}
    if(!changed)break;sum=Object.values(result).reduce((a,b)=>a+b,0);
  }
  return result;
}

function buildAiTargets(riskKey){
  const base={...profiles[riskKey].allocations},v={...base},reasons=[];
  const h=el.horizon.value;
  if(h==="short"){addDeltas(v,{liquiditaet:8,geldwerte:7,substanzwerte:-10,alternativ:-5,sachwerte:0});reasons.push("Kurzer Anlagehorizont: höherer Liquiditäts- und Geldwertanteil.")}
  if(h==="medium"){addDeltas(v,{liquiditaet:0,geldwerte:3,substanzwerte:-3,alternativ:0,sachwerte:0});reasons.push("Mittlerer Anlagehorizont: leicht defensivere Ausrichtung.")}
  if(h==="long"){addDeltas(v,{liquiditaet:0,geldwerte:-6,substanzwerte:4,alternativ:0,sachwerte:2});reasons.push("Langer Anlagehorizont: mehr Substanz- und Sachwerte.")}
  if(h==="veryLong"){addDeltas(v,{liquiditaet:-3,geldwerte:-9,substanzwerte:8,alternativ:0,sachwerte:4});reasons.push("Sehr langer Anlagehorizont: deutlich höherer langfristiger Chancenanteil.")}
  if(el.lossTolerance.value==="low"){addDeltas(v,{liquiditaet:5,geldwerte:10,substanzwerte:-10,alternativ:-5,sachwerte:0});reasons.push("Geringe Verlusttoleranz: zusätzlicher Stabilitätspuffer.")}
  if(el.lossTolerance.value==="high"){addDeltas(v,{liquiditaet:-2,geldwerte:-8,substanzwerte:7,alternativ:3,sachwerte:0});reasons.push("Hohe Verlusttoleranz: stärkere Chancenorientierung.")}
  if(el.marketReaction.value==="sell"){addDeltas(v,{liquiditaet:4,geldwerte:6,substanzwerte:-7,alternativ:-3,sachwerte:0});reasons.push("Verkaufsneigung bei Rückgängen: geringere Schwankungsintensität.")}
  if(el.marketReaction.value==="buy"){addDeltas(v,{liquiditaet:0,geldwerte:-6,substanzwerte:4,alternativ:2,sachwerte:0});reasons.push("Nachinvestitionsbereitschaft: höherer langfristiger Risikoanteil.")}
  if(el.experience.value==="low"){addDeltas(v,{liquiditaet:0,geldwerte:5,substanzwerte:-2,alternativ:-3,sachwerte:0});reasons.push("Geringe Erfahrung: einfachere und defensivere Struktur.")}
  if(el.experience.value==="high"){addDeltas(v,{liquiditaet:0,geldwerte:-7,substanzwerte:2,alternativ:3,sachwerte:2});reasons.push("Hohe Erfahrung: differenziertere alternative und reale Anlagen.")}
  if(el.liquidityNeed.value==="high"){addDeltas(v,{liquiditaet:12,geldwerte:3,substanzwerte:-10,alternativ:-5,sachwerte:0});reasons.push("Hoher Liquiditätsbedarf: deutliche strategische Reserve.")}
  if(el.liquidityNeed.value==="medium"){addDeltas(v,{liquiditaet:4,geldwerte:-2,substanzwerte:-2,alternativ:0,sachwerte:0});reasons.push("Mittlerer Liquiditätsbedarf: kleine strategische Reserve.")}
  if(el.liquidityNeed.value==="low"){addDeltas(v,{liquiditaet:-2,geldwerte:0,substanzwerte:2,alternativ:0,sachwerte:0});reasons.push("Geringer Liquiditätsbedarf: höhere Investitionsquote.")}
  if(el.realAssetPreference.value==="medium"){addDeltas(v,{liquiditaet:0,geldwerte:-3,substanzwerte:-2,alternativ:0,sachwerte:5});reasons.push("Moderate Sachwertpräferenz: eigenständige Immobilienbeimischung.")}
  if(el.realAssetPreference.value==="high"){addDeltas(v,{liquiditaet:0,geldwerte:-4,substanzwerte:-4,alternativ:-2,sachwerte:10});reasons.push("Hohe Sachwertpräferenz: deutliche Immobilienbeimischung.")}
  const normalized=normalizeWithBounds(v,riskKey);
  const changes=assets.map(a=>({name:a.name,delta:normalized[a.id]-base[a.id]})).filter(x=>Math.abs(x.delta)>=.5);
  if(changes.length)reasons.push("Abweichung zum Musterportfolio: "+changes.map(x=>`${x.name} ${x.delta>0?"+":"−"}${number.format(Math.abs(x.delta))} %-Pkt.`).join(", ")+".");
  state.aiReasons=reasons;return normalized;
}

function resolveProduct(name){return productByName.get(normalizeName(name))}
function makeRow(productId,weight,reason=""){return {uid:++state.uid,productId,weight:round(weight,2),reason}}

function loadModelProducts(riskKey=state.selectedRisk){
  state.method="model";
  document.querySelector('input[name="method"][value="model"]').checked=true;
  setMethod("model");
  state.productRows=profiles[riskKey].products.map(([name,weight,reason])=>{
    const p=resolveProduct(name);
    if(!p)console.warn("Produkt nicht gefunden:",name);
    return makeRow(p?p.id:"",weight,reason);
  });
  const p=profiles[riskKey];
  assets.forEach(a=>targetFor(a.id).value=p.allocations[a.id]);
  state.targetOrigin=`Musterportfolio ${p.label}`;
  el.targetOrigin.textContent=state.targetOrigin;el.autoSyncProducts.checked=true;
  state.optimized=false;hideOptimization();renderProductEditor();updateAll();
}

function distributeAsset(target,ids){
  const style=el.portfolioStyle.value;
  const usable=ids.map(name=>resolveProduct(name)).filter(Boolean);
  const count=Math.min(usable.length,style==="core"?2:style==="broad"?4:3);
  const chosen=usable.slice(0,count);
  const splits=count===1?[1]:count===2?[.6,.4]:count===3?[.5,.3,.2]:[.4,.25,.2,.15];
  return chosen.map((p,i)=>makeRow(p.id,target*splits[i],"KI-Auswahl aus der aktuellen Hausmeinung"));
}

function buildAiProductRows(targets,riskKey){
  const sustainable=el.sustainabilityPreference.value==="yes";
  const rows=[];
  if(targets.liquiditaet>0)rows.push(...distributeAsset(targets.liquiditaet,["UnionGeldmarktFonds","UniOpti4"]));

  let bondNames;
  if(sustainable)bondNames=["UniESG Unternehmensanleihen -net-A","UER Unternehmensanleihen 2032 -net- A","UER Corporates A","UniEuroRenta"];
  else if(el.horizon.value==="short")bondNames=["UER Unternehmensanleihen 2029 III -net- A","UniInstitutional Euro Reserve Plus","UniEuroKapital Corporates -net- A","UER Corporates A"];
  else if(riskKey==="rb4")bondNames=["Carmignac Credit 2031","UER Unternehmensanleihen 2032 -net- A","UER Corporates A","UniEuroRenta HighYield"];
  else bondNames=["UER Unternehmensanleihen 2032 -net- A","Carmignac Credit 2031","UER Corporates A","VOBA PUR PREMIUM R UI P"];
  if(targets.geldwerte>0)rows.push(...distributeAsset(targets.geldwerte,bondNames));

  let equityNames;
  if(sustainable)equityNames=["UniESG Aktien Global -net-","Pictet – Water P (EUR)","ÖkoWorld Klima C","KBI Global Sustainable Infrastructure"];
  else equityNames=["UniGlobal -net-","UniMarktführer -net- A","UniDividendenAss -net- A",
    el.experience.value==="high"?"Pictet - Robotics P dy EUR":"iShares Core MSCI World UCITS ETF"];
  if(targets.substanzwerte>0)rows.push(...distributeAsset(targets.substanzwerte,equityNames));

  if(targets.alternativ>0){
    const altNames=sustainable?["Allianz PrivateFinancePolice","Xetra-Gold"]:["Xetra-Gold","Allianz PrivateFinancePolice"];
    rows.push(...distributeAsset(targets.alternativ,altNames));
  }
  if(targets.sachwerte>0)rows.push(...distributeAsset(targets.sachwerte,["UniImmo: Europa","hausInvest","UniImmo: Deutschland"]));
  const total=rows.reduce((sum,row)=>sum+row.weight,0),diff=round(100-total,2);
  if(rows.length&&Math.abs(diff)>.001)rows[0].weight=round(rows[0].weight+diff,2);
  return rows;
}

function loadAiProducts(){
  state.method="ai";
  document.querySelector('input[name="method"][value="ai"]').checked=true;
  setMethod("ai");
  const {selected}=calculateRisk();
  const targets=buildAiTargets(selected);
  state.productRows=buildAiProductRows(targets,selected);
  assets.forEach(a=>targetFor(a.id).value=targets[a.id]);
  state.targetOrigin=`KI-Optimierung auf Basis ${profiles[selected].label}`;
  el.targetOrigin.textContent=state.targetOrigin;el.autoSyncProducts.checked=true;
  state.optimized=false;hideOptimization();renderProductEditor();updateAll();
}

function applyStrategicTarget(){
  calculateRisk();
  if(state.method==="model")loadModelProducts(state.selectedRisk);else loadAiProducts();
}

function productOptions(selectedId){
  const groups={};
  allProducts.forEach(p=>{(groups[p.category]??=[]).push(p)});
  return Object.entries(groups).sort(([a],[b])=>a.localeCompare(b,"de")).map(([cat,products])=>
    `<optgroup label="${cat}">${products.sort((a,b)=>a.name.localeCompare(b.name,"de")).map(p=>
      `<option value="${p.id}" ${p.id===selectedId?"selected":""}>${p.name}${p.wkn&&p.wkn!=="–"?" · "+p.wkn:""}</option>`).join("")}</optgroup>`).join("");
}

function assetMixHtml(allocations){
  return assets.filter(a=>(allocations[a.id]||0)>.01).map(a=>`<span class="mix-chip" style="--chip-color:${a.color}">${a.name} ${number.format(allocations[a.id])} %</span>`).join("");
}

function renderProductEditor(){
  el.targetProductRows.innerHTML=state.productRows.map(row=>{
    const p=productById[row.productId];
    if(!p)return `<tr data-uid="${row.uid}"><td><select class="product-select" data-product-select="${row.uid}"><option value="">Produkt wählen …</option>${productOptions("")}</select></td>
      <td><div class="input-wrap weight-input"><input type="number" min="0" max="100" step=".1" value="${row.weight}" data-product-weight="${row.uid}"><span class="unit">%</span></div></td>
      <td class="numeric">–</td><td>–</td><td>–</td><td>–</td><td><button class="btn btn-danger btn-small" data-delete-row="${row.uid}">Entfernen</button></td></tr>`;
    return `<tr data-uid="${row.uid}">
      <td><select class="product-select" data-product-select="${row.uid}">${productOptions(p.id)}</select></td>
      <td><div class="input-wrap weight-input"><input type="number" min="0" max="100" step=".1" value="${row.weight}" data-product-weight="${row.uid}"><span class="unit">%</span></div></td>
      <td class="numeric" data-product-amount="${row.uid}">${euro.format(investment()*row.weight/100)}</td>
      <td><span class="category-chip" style="--chip-color:${categoryColors[p.category]||"#003f8f"}">${p.category}</span>
        <div class="product-meta">WKN ${p.wkn||"–"} · ${p.rk?"RK "+p.rk:"RK –"} · Horizont ${p.horizon||"–"}</div></td>
      <td><div class="asset-mix">${assetMixHtml(p.allocations)}</div></td>
      <td><span class="source-chip ${p.isHouseOpinion?"house":"special"}">${p.isHouseOpinion?"Hausmeinung":"Musterportfolio / Sonderbaustein"}</span>
        <div class="product-meta">${p.source}</div></td>
      <td><button type="button" class="btn btn-danger btn-small" data-delete-row="${row.uid}">Entfernen</button></td></tr>`;
  }).join("");

  document.querySelectorAll("[data-product-select]").forEach(select=>select.addEventListener("change",e=>{
    const row=state.productRows.find(r=>r.uid===Number(e.target.dataset.productSelect));if(row)row.productId=e.target.value;
    productRowsChanged();
  }));
  document.querySelectorAll("[data-product-weight]").forEach(input=>input.addEventListener("input",e=>{
    const uid=Number(e.target.dataset.productWeight),row=state.productRows.find(r=>r.uid===uid);if(row)row.weight=safeNumber(e.target.value);
    const amountCell=document.querySelector(`[data-product-amount="${uid}"]`);
    if(amountCell&&row)amountCell.textContent=euro.format(investment()*row.weight/100);
    productRowsChanged(false);
  }));
  document.querySelectorAll("[data-delete-row]").forEach(btn=>btn.addEventListener("click",e=>{
    const uid=Number(e.target.dataset.deleteRow);state.productRows=state.productRows.filter(r=>r.uid!==uid);productRowsChanged();
  }));
  updateProductSummary();
}

function productRowsChanged(rerender=true){
  state.targetOrigin="Individuell modifiziertes Zielproduktportfolio";el.targetOrigin.textContent=state.targetOrigin;
  state.optimized=false;hideOptimization();
  if(el.autoSyncProducts.checked)syncAssetTargetsFromProducts(false);
  if(rerender)renderProductEditor();else updateProductSummary();
  updateAll();
}

function productAllocation(){
  const result=Object.fromEntries(assets.map(a=>[a.id,0]));
  state.productRows.forEach(row=>{const p=productById[row.productId];if(!p)return;
    assets.forEach(a=>result[a.id]+=row.weight*(p.allocations[a.id]||0)/100);
  });
  return result;
}

function productValidation(){
  const total=state.productRows.reduce((s,r)=>s+safeNumber(r.weight),0);
  const selected=state.productRows.filter(r=>r.productId);
  const duplicates=selected.map(r=>r.productId).filter((id,i,arr)=>arr.indexOf(id)!==i);
  const errors=[],warnings=[];
  if(total>100.005)errors.push(`Die Produktgewichte ergeben ${number.format(total)} % und überschreiten 100 %.`);
  if(Math.abs(total-100)>.005)warnings.push(`Die Produktgewichte ergeben ${number.format(total)} %. Für ein vollständiges Zielportfolio müssen sie 100 % ergeben.`);
  if(duplicates.length)errors.push("Ein Zielprodukt wurde mehrfach ausgewählt. Bitte fassen Sie die Gewichtung in einer Zeile zusammen.");
  if(selected.length!==state.productRows.length)warnings.push("Mindestens eine Produktzeile enthält noch keine Produktauswahl.");
  return {total,errors,warnings,valid:errors.length===0&&Math.abs(total-100)<=.005};
}

function syncAssetTargetsFromProducts(update=true){
  const alloc=productAllocation();
  assets.forEach(a=>targetFor(a.id).value=round(alloc[a.id],2));
  state.targetOrigin=state.targetOrigin.startsWith("Musterportfolio")?state.targetOrigin:"Zielproduktportfolio · produktbasiertes Asset-SOLL";
  el.targetOrigin.textContent=state.targetOrigin;
  if(update)updateAll();
}

function updateProductSummary(){
  const pv=productValidation(),alloc=productAllocation();
  el.productCount.textContent=state.productRows.filter(r=>r.productId&&r.weight>0).length;
  el.productWeightTotal.textContent=`${number.format(pv.total)} %`;
  el.productUnallocated.textContent=`${number.format(Math.max(0,100-pv.total))} %`;
  const target=Object.fromEntries(assets.map(a=>[a.id,safeNumber(targetFor(a.id).value)]));
  const deviation=Math.max(...assets.map(a=>Math.abs((alloc[a.id]||0)-target[a.id])));
  el.productAssetDeviation.textContent=`${number.format(deviation)} %-Pkt.`;
  el.productStatus.className="status-message";
  if(pv.errors.length){el.productStatus.textContent=pv.errors.join(" ");el.productStatus.classList.add("error")}
  else if(pv.warnings.length){el.productStatus.textContent=pv.warnings.join(" ");el.productStatus.classList.add("warning")}
  else{el.productStatus.textContent="Das Zielproduktportfolio ist vollständig und konsistent.";el.productStatus.classList.add("ok")}

  const notices=[];
  state.productRows.forEach(r=>{const p=productById[r.productId];if(!p)return;
    if(p.minInvestment&&investment()*r.weight/100<p.minInvestment)notices.push(`${p.name}: Zielbetrag ${euro.format(investment()*r.weight/100)} liegt unter der hinterlegten Mindestanlage von ${euro.format(p.minInvestment)}.`);
  });
  const legacy=state.productRows.map(r=>productById[r.productId]).filter(p=>p&&!p.isHouseOpinion&&p.id==="sp_uer2031");
  if(legacy.length)notices.push("UER Unternehmensanleihen 2031 II -net- A ist Bestandteil der Musterportfolios vom 11.03.2026, wurde in der aktuellen Fonds-Matrix vom 01.07.2026 jedoch nicht gefunden.");
  if(notices.length){el.productNotice.innerHTML=notices.map(n=>`<div>• ${n}</div>`).join("");el.productNotice.classList.remove("hidden")}
  else el.productNotice.classList.add("hidden");
}

function normalizeProductWeights(){
  const total=state.productRows.reduce((s,r)=>s+safeNumber(r.weight),0);
  if(!state.productRows.length)return;
  if(total<=0){const equal=100/state.productRows.length;state.productRows.forEach(r=>r.weight=round(equal,2))}
  else state.productRows.forEach(r=>r.weight=round(r.weight/total*100,2));
  const diff=round(100-state.productRows.reduce((s,r)=>s+r.weight,0),2);
  if(state.productRows.length)state.productRows[0].weight=round(state.productRows[0].weight+diff,2);
  productRowsChanged();
}

function addProductRow(productId="",weight=0){
  state.productRows.push(makeRow(productId,weight));renderProductEditor();updateAll();
}
