/**
 * Pure book math — safe to import from unit tests (no DB).
 * SQL-backed wager ops live in wagers.server.ts.
 */

/**
 * Profit per dollar staked on a moneyline given win probability.
 * There is deliberately no vig. Clamping caps the extreme at 19×.
 */
export function payoutMultiplier(probability: number): number {
  const p = Math.min(0.95, Math.max(0.05, probability));
  return Math.round(((1 - p) / p) * 100) / 100;
}
