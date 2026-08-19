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
