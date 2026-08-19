/** Cash actually taken from a purse, and what the pool may be credited. */
export function applyLoss(
  remaining: number,
  stake: number,
): {
  remaining: number;
  poolCredit: number;
} {
  const cash = Math.max(0, remaining);
  const take = Math.min(cash, Math.max(0, stake));
  return { remaining: cash - take, poolCredit: take };
}

/** Exact FAAB to move in a trade, or -1 if spendable cannot cover amount. */
export function tradeTake(spendable: number, amount: number): number {
  const want = Math.max(0, Math.floor(amount));
  const have = Math.max(0, spendable);
  return want > have ? -1 : want;
}
