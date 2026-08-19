import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPts(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

export function formatInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function fmtRecord(wins: number, losses: number, ties = 0): string {
  return ties > 0 ? `${wins}–${losses}–${ties}` : `${wins}–${losses}`;
}

/**
 * Elapsed time as one token — "3m", "5h", "2d". For meta columns too narrow
 * to carry "ago". Null when the timestamp is missing or in the future.
 */
export function elapsedShort(at: number | null | undefined): string | null {
  if (at == null) return null;
  const ms = Date.now() - at;
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Compact relative time for status lines. Null when the date is missing or junk. */
export function formatAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const short = elapsedShort(new Date(iso).getTime());
  if (short == null) return null;
  return short === "now" ? "just now" : `${short} ago`;
}

/** Surname only — enough to identify a player in a one-line summary. */
export function lastName(p: { last_name?: string | null; full_name: string }): string {
  const last = p.last_name?.trim();
  if (last) return last;
  const parts = p.full_name.trim().split(/\s+/);
  return parts[parts.length - 1] || p.full_name;
}

/** "A", "A + B", "A, B + C" — a list read aloud, not a CSV. */
export function joinBits(bits: string[]): string {
  if (bits.length <= 1) return bits[0] ?? "";
  if (bits.length === 2) return `${bits[0]} + ${bits[1]}`;
  return `${bits.slice(0, -1).join(", ")} + ${bits[bits.length - 1]}`;
}
