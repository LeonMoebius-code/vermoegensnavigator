import type { Catalog, CatalogRecord, DataByKind } from "../../app/domain/retirement/catalog-contract";
import type { CostSelection } from "../../app/domain/retirement/cost-contract";
import { MODEL_VERSIONS, refKey, reference, revisionHash, type Kind, type Ref } from "../../app/domain/retirement/identity-contract";
import { sha256 } from "../../app/domain/case/recovery-hash";

/** Artificial identities and values. No manufacturer catalog or tariff is shipped. */
export function syntheticCatalog():Catalog {
  const records:CatalogRecord[]=[];
  function add<K extends Kind>(kind:K,id:string,data:DataByKind[K],citation?:Ref<"source">):CatalogRecord<K> {
    const r={kind,id,revision:1,hash:"",previous:null,validFrom:"2026-01-01",validTo:null,
      reviewedOn:"2026-11-17",changedOn:"2026-11-17",changedBy:"synthetic-fixture",
      publication:{state:"internal"},citations:citation?[{source:citation,locator:"Synthetic section 1"}]:[],data} as CatalogRecord<K>;
    (r as {hash:string}).hash=revisionHash(r);records.push(r as CatalogRecord);return r;
  }
  const src=reference(add("source","synthetic-source",{
    title:"Artificial project decision",documentVersion:"test.v1",documentHash:sha256("artificial-source-v1"),
    issuedOn:"2026-01-01",authority:"project",purpose:"parameter"
  }));
  const algorithm=reference(add("source","synthetic-algorithm",{
    title:"Artificial manufacturer algorithm",documentVersion:"test.v1",documentHash:sha256("artificial-algorithm"),
    issuedOn:"2026-01-01",authority:"manufacturer_final",purpose:"algorithm"
  }));
  const schedule=reference(add("source","synthetic-schedule",{
    title:"Artificial complete schedule",documentVersion:"test.v1",documentHash:sha256("artificial-schedule"),
    issuedOn:"2026-01-01",authority:"manufacturer_final",purpose:"cost_schedule"
  }));
  const ter=reference(add("parameter","synthetic-ter",{
    name:"Open informational TER",purpose:"general",productId:null,tariffId:null,phase:null,unit:"annual_ratio",
    value:{class:"O",value:null,reason:"No synthetic TER assumed"},models:[],approval:"open",overridePolicy:"scenario"
  },src));
  const funds=Array.from({length:11},(_,i)=>reference(add("fund","synthetic-fund-"+(i+1),{
    name:"Artificial fund "+(i+1),isin:null,assetClass:i<4?"equity":i<8?"bond":i===8?"commodity":i===9?"cash":"secured_assets",
    informationalTer:ter,manufacturer:{state:"open",reason:"Synthetic option only",evidence:null}
  },src)));
  const comfort=reference(add("portfolio","synthetic-comfort",{
    name:"Artificial comfort mix",mode:"comfort",weights:[3100,1700,700,500,2900,1100].map((basisPoints,i)=>({fund:funds[i],basisPoints}))
  },src));
  const individual=reference(add("portfolio","synthetic-individual",{
    name:"Artificial individual mix",mode:"individual",weights:[5000,3000,2000].map((basisPoints,i)=>({fund:funds[i],basisPoints}))
  },src));
  const emptyRequirements=()=>({investment:[],costs:[],guarantee:[],payout:[],referenceCases:[]});
  for(let i=1;i<=6;i++) {
    const costParam=reference(add("parameter","synthetic-cost-"+i,{
      name:"Artificial annual working cost "+i,purpose:"general",productId:"synthetic-product-"+i,tariffId:"synthetic-tariff-"+i,
      phase:"savings",unit:"annual_ratio",value:{class:"A",value:0.0123+(i-1)/10000,reason:"Artificial test value"},
      models:[{model:"M1",version:MODEL_VERSIONS.M1},{model:"M2",version:MODEL_VERSIONS.M2}],approval:"approved",overridePolicy:"scenario"
    },src));
    const product=reference(add("product","synthetic-product-"+i,{
      name:"Artificial product "+i,manufacturerId:"synthetic-manufacturer",
      features:[],manufacturer:{state:"announced",reason:"Artificial announcement",evidence:src},
      bank:{state:"open",reason:"No real availability",evidence:null},guarantee:{kind:"none"},
      capabilities:(["M1","M2","M3"] as const).map(model=>({model,version:MODEL_VERSIONS[model],
        status:model==="M3"?"blocked":"available",reason:"Catalog declaration only, no engine",requirements:emptyRequirements()}))
    },src));
    const tariff=reference(add("tariff","synthetic-tariff-"+i,{
      product,name:"Artificial tariff "+i,manufacturerCode:null,accessRules:[],fundOptions:funds,
      portfolios:[comfort,individual],payouts:["fund_plan","life_annuity"],annuityFactor:null,
      manufacturer:{state:"open",reason:"Artificial tariff",evidence:null},bank:{state:"open",reason:"No bank release",evidence:null}
    },src));
    add("cost","synthetic-k1-m1-"+i,{product,tariff,phase:"savings",mode:"K1",model:"M1",modelVersion:MODEL_VERSIONS.M1,
      convention:"M1_additive_v1",parameter:costParam,basis:"effective_yield_reduction",notIndividualOffer:true,
      components:["fund_ter","administration","acquisition"]},src);
    add("cost","synthetic-k1-m2-"+i,{product,tariff,phase:"savings",mode:"K1",model:"M2",modelVersion:MODEL_VERSIONS.M2,
      convention:"M2_balance_factor_v1",parameter:costParam,basis:"effective_yield_reduction",notIndividualOffer:true,
      components:["fund_ter","administration","acquisition"]},src);
    add("cost","synthetic-payout-"+i,{product,tariff,phase:"payout",mode:"before_payout_costs",label:"scenario_before_payout_costs"},src);
    if(i===1) {
      const fee=reference(add("parameter","synthetic-fixed-fee",{
        name:"Artificial fee",purpose:"general",productId:product.id,tariffId:tariff.id,phase:"savings",unit:"eur",
        value:{class:"B",value:2.25,reason:"Artificial schedule"},models:[{model:"M1",version:MODEL_VERSIONS.M1},{model:"M2",version:MODEL_VERSIONS.M2}],approval:"approved",overridePolicy:"forbidden"
      },schedule));
      add("cost","synthetic-k2",{product,tariff,phase:"savings",mode:"K2",tariffEvidence:schedule,coverage:"complete",status:"verified",
        reason:"Artificial complete test schedule",components:["administration"],charges:[{component:"administration",type:"fixed",
          parameter:fee,basis:"contract",timing:{frequency:"monthly",at:"month_end",from:"2026-01-01",until:null}}]},schedule);
      const payoutFee=reference(add("parameter","synthetic-payout-fee",{
        name:"Artificial separate payout fee",purpose:"general",productId:product.id,tariffId:tariff.id,phase:"payout",unit:"eur",
        value:{class:"B",value:2.25,reason:"Artificial payout schedule"},models:[{model:"M1",version:MODEL_VERSIONS.M1},{model:"M2",version:MODEL_VERSIONS.M2}],approval:"approved",overridePolicy:"forbidden"
      },schedule));
      add("cost","synthetic-payout-fixed",{product,tariff,phase:"payout",mode:"monthly_fixed_eur",parameter:payoutFee,
        convention:"capped_at_available_balance_v1",components:["administration"]},src);
    }
  }
  const c:Catalog={format:"avd.catalog.v1",id:"synthetic-catalog",revision:1,previousHash:null,hash:"",origin:"synthetic",
    asOf:"2026-11-17",records,current:records.map(reference)};
  return reseal(c);
}
export function record<K extends Kind>(c:Catalog,id:string,kind?:K):CatalogRecord<K> {
  const r=c.records.find(x=>x.id===id && (!kind || kind===x.kind));
  if(!r)throw new Error("Missing synthetic record "+id);return r as CatalogRecord<K>;
}
/** Fixture builder only: recompute a dependency DAG after intentional mutations. */
export function reseal(c:Catalog):Catalog {
  const all=new Map(c.records.map(r=>[refKey(r),r]));const done=new Set<string>(),visiting=new Set<string>();
  const seal=(r:CatalogRecord)=>{
    const k=refKey(r);if(done.has(k))return;if(visiting.has(k))throw new Error("Fixture cycle");visiting.add(k);
    const walk=(v:unknown):unknown=>{
      if(v && typeof v==="object"){
        const o=v as Record<string,unknown>;
        if(Object.keys(o).length===4 && "kind" in o && "hash" in o && "id" in o && "revision" in o){
          const dep=all.get(refKey(o as Ref));if(dep){seal(dep);return {...o,hash:dep.hash};}return {...o};
        }
        if(Array.isArray(v))return v.map(walk);
        return Object.fromEntries(Object.entries(o).map(([key,value])=>[key,walk(value)]));
      }
      return v;
    };
    Object.assign(r,{data:walk(r.data),citations:walk(r.citations),previous:walk(r.previous)});
    (r as {hash:string}).hash=revisionHash(r);visiting.delete(k);done.add(k);
  };
  for(const r of c.records)seal(r);
  c.current=c.current.map(r=>all.has(refKey(r))?reference(all.get(refKey(r))!):r);
  c.hash=revisionHash(c);return c;
}
export function costSelection(c:Catalog):CostSelection {
  return {product:reference(record(c,"synthetic-product-1","product")),tariff:reference(record(c,"synthetic-tariff-1","tariff")),
    model:"M1",modelVersion:MODEL_VERSIONS.M1,
    costs:[reference(record(c,"synthetic-k1-m1-1","cost")),reference(record(c,"synthetic-payout-1","cost"))],
    returns:{basis:"gross",deducted:[]}};
}
