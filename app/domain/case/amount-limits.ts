/** Shared H1 bound: below 2^46 EUR every cent remains distinguishable. */
export const MAX_AMOUNT_CENTS = BigInt(2 ** 46) * 100n - 1n;
