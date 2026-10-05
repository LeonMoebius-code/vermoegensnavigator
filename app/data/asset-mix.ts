import type { AssetMix } from "../domain/assets/contracts";

export const mix = (
  liquidity = 0,
  money = 0,
  substance = 0,
  alternatives = 0,
  real = 0,
): AssetMix => ({
  Liquidität: liquidity,
  Geldwerte: money,
  Substanzwerte: substance,
  "Alternative Anlagen": alternatives,
  Sachwerte: real,
});
