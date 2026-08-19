/**
 * React Query fingerprint for a getProjections call.
 *
 * Length is not enough: a 1-in/1-out waiver keeps the same roster size, the
 * key does not change, and the new player renders as "—" until a full reload.
 */
export function projectionRosterKey(ids: readonly string[] | undefined): string {
  if (!ids?.length) return "";
  return [...ids].sort().join(",");
}
