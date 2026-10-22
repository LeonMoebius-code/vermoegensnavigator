export const assetClasses = [
  "Liquidität",
  "Geldwerte",
  "Substanzwerte",
  "Alternative Anlagen",
  "Sachwerte",
] as const;

export type AssetClass = (typeof assetClasses)[number];

/** Runtime data must match an exact domain key; never coerce imported values. */
export const isAssetClass = (value: unknown): value is AssetClass =>
  typeof value === "string" && assetClasses.some((name) => name === value);

export type AssetMix = Record<AssetClass, number>;
