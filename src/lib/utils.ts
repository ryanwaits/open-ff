import { clsx, type ClassValue } from "clsx";
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

/** Compact relative time for status lines. Null when the date is missing or junk. */
export function formatAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
