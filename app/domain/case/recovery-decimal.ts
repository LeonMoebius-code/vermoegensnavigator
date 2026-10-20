import { MAX_AMOUNT_CENTS } from "./amount-limits";
/** Exact decimal arithmetic on JSON number representations, never cent rounding.
 * If a result cannot be stored as a JSON number without loss, release is blocked. */
const decimal = (n: number): [bigint, number] => {
  if (!Number.isFinite(n)) throw new Error("Nicht endlicher Betrag.");
  const [mantissa, exponent = "0"] = String(n).toLowerCase().split("e");
  const places = mantissa.split(".")[1]?.length ?? 0;
  return [BigInt(mantissa.replace(".","")), places - Number(exponent)];
};
function aligned(values: number[]) {
  const ds=values.map(decimal), scale=Math.max(0,...ds.map(([,s])=>s));
  return { scale, values: ds.map(([v,s])=>v*10n**BigInt(scale-s)) };
}
export function exactSum(values: number[]): number {
  const d=aligned(values), sum=d.values.reduce((a,b)=>a+b,0n);
  const n=Number(`${sum}e-${d.scale}`), back=aligned([n,...values]);
  if (!Number.isFinite(n) || back.values[0] !== back.values.slice(1).reduce((a,b)=>a+b,0n))
    throw new Error("Betragssumme ist ohne Präzisionsverlust nicht als JSON-Zahl speicherbar.");
  return n;
}
export const exactDifference = (a: number,b: number) => exactSum([a,-b]);
export function equalSum(a: number[], b: number[]) {
  const d=aligned([...a,...b]);
  return d.values.slice(0,a.length).reduce((x,y)=>x+y,0n) === d.values.slice(a.length).reduce((x,y)=>x+y,0n);
}

/** Preserve imported representations, but reject newly typed precision loss or
 * amounts beyond H1. A full unchanged large imported binding may be retained. */
export function safeRecoveryTarget(value:number,sourceAmount:number) {
  if(!Number.isFinite(value)||value<0)return false;
  if(value===sourceAmount)return true;
  const d=aligned([value]);
  return d.values[0]*100n<=MAX_AMOUNT_CENTS*10n**BigInt(d.scale);
}
export function parseRecoveryAmountDraft(raw:string,sourceAmount:number):number {
  const text=raw.trim().replace(",",".");
  if(text.length>200||!/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text))throw new Error("Exakten nichtnegativen Dezimalbetrag ohne Tausendertrennzeichen eingeben.");
  const [mantissa,exp="0"]=text.toLowerCase().split("e"),exponent=Number(exp);
  if(!Number.isInteger(exponent)||Math.abs(exponent)>400)throw new Error("Betrag ist nicht sicher darstellbar.");
  const coefficient=BigInt(mantissa.replace(".","")),places=(mantissa.split(".")[1]?.length||0)-exponent;
  const value=Number(text),[back,backPlaces]=decimal(value),scale=Math.max(0,places,backPlaces);
  if(coefficient*10n**BigInt(scale-places)!==back*10n**BigInt(scale-backPlaces))throw new Error("Eingabe würde beim Speichern gerundet. Exakten darstellbaren Teilbetrag wählen.");
  if(!safeRecoveryTarget(value,sourceAmount))throw new Error("Neuer Teilbetrag überschreitet die H1-Grenze für sichere Betragseingaben.");
  return value;
}
