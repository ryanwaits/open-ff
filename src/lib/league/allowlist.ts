export function normEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function emailAllowed(allow: string[], email: string | null): boolean {
  if (allow.length === 0) return true; // code-only
  if (!email) return false;
  return allow.includes(normEmail(email));
}
