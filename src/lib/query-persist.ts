/** Query key[0] values written to localStorage. Live feeds stay memory-only. */
export const PERSIST_ROOTS = new Set<string>([
  "league",
  "matchups",
  "team",
  "my-leagues",
  "byes",
  "activity",
  "recap",
  "trades",
  "claims",
  "picks",
  "settings",
  "schedule",
  "player-profile",
]);

export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const PERSIST_BUSTER = "ledger-workbook-1";
export const PERSIST_STORAGE_KEY = "ledger-rq";

export function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return typeof root === "string" && PERSIST_ROOTS.has(root);
}
