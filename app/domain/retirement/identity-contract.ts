import { canonicalJson, sha256 } from "../case/recovery-hash";

export const CATALOG_FORMAT = "avd.catalog.v1" as const;
/** Catalog capability identifiers only. No projection engine is implemented here. */
export const MODEL_VERSIONS = { M1: "avd.m1.v1", M2: "avd.m2.v1", M3: "avd.m3.v1" } as const;
export type Model = keyof typeof MODEL_VERSIONS;
export type Kind = "source" | "product" | "tariff" | "fund" | "portfolio" | "parameter" | "cost";
export type Ref<K extends Kind = Kind> = Readonly<{ kind: K; id: string; revision: number; hash: string }>;
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type Period = { validFrom: string; validTo: string | null };
export type CatalogIssue = { code: string; path: string };
export type Checked<T> = { ok: true; value: DeepReadonly<T> } | { ok: false; issue: CatalogIssue };
export class CatalogError extends Error {
  constructor(readonly code: string, readonly path: string) { super(code + ": " + path); }
}
/** Trusted internal helper; not an external input validator or Proxy sandbox. */
export const refKey = (r: Pick<Ref, "kind" | "id" | "revision">) => JSON.stringify([r.kind, r.id, r.revision]);
/** Trusted inert data only. SHA-256 content binding, not authentication or input validation. */
export function revisionHash(record: object): string {
  const { hash: _hash, ...body } = record as Record<string, unknown>;
  return sha256(canonicalJson(body));
}
/** Trusted internal helper; external data must pass the catalog boundary first. */
export function reference<K extends Kind>(record: Ref<K>): Ref<K> {
  return Object.freeze({ kind: record.kind, id: record.id, revision: record.revision, hash: record.hash });
}
