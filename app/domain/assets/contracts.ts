export const assetClasses = [
  "Liquidität",
  "Geldwerte",
  "Substanzwerte",
  "Alternative Anlagen",
  "Sachwerte",
] as const;

export type AssetClass = (typeof assetClasses)[number];

export type AssetMix = Record<AssetClass, number>;
