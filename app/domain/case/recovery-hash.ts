/** H5b hash contract: SHA-256 of UTF-8; canonical JSON sorts object keys,
 * preserves array order and JSON number values. No authentication is implied. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(v => canonicalJson(v ?? null)).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value)
    .filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error("Nicht als JSON darstellbarer Quelleninhalt.");
  return result;
}

// Synchronous SHA-256 also permits the synchronous import/restore boundary to
// reassess content binding. Tested against node:crypto, including UTF-8 vectors.
export function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const words = new Uint32Array(Math.ceil((bytes.length + 9) / 64) * 16);
  bytes.forEach((v, i) => { words[i >>> 2] |= v << (24 - (i % 4) * 8); });
  words[bytes.length >>> 2] |= 0x80 << (24 - (bytes.length % 4) * 8);
  words[words.length - 2] = Math.floor(bytes.length / 0x20000000);
  words[words.length - 1] = bytes.length * 8;
  const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotr = (v: number, n: number) => (v >>> n) | (v << (32 - n));
  const w = new Uint32Array(64);
  for (let offset = 0; offset < words.length; offset += 16) {
    w.set(words.subarray(offset, offset + 16));
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      w[i] = w[i - 16] + (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) + w[i - 7] + (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10));
    }
    let [a,b,c,d,e,f,g,j] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (j + (rotr(e,6)^rotr(e,11)^rotr(e,25)) + ((e&f)^(~e&g)) + k[i] + w[i]) >>> 0;
      const t2 = ((rotr(a,2)^rotr(a,13)^rotr(a,22)) + ((a&b)^(a&c)^(b&c))) >>> 0;
      j=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,j].forEach((v,i) => { h[i]=(h[i]+v)>>>0; });
  }
  return h.map(v => v.toString(16).padStart(8,"0")).join("");
}

export const jsonHash = (value: unknown) => sha256(canonicalJson(value));
/** Outer copy ID, technical update time and the evidence itself are excluded.
 * All business content AND the complete history remain part of this binding. */
export function recoveryContentHash(value: object) {
  const { id: _id, updatedAt: _updated, capitalPotRecovery: _evidence, ...content } = value as Record<string, unknown>;
  return jsonHash(content);
}
