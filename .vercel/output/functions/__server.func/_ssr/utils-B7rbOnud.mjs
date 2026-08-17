import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/utils-B7rbOnud.js
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function formatPts(n, digits = 2) {
	if (n == null || Number.isNaN(n)) return "—";
	return n.toFixed(digits);
}
function formatInt(n) {
	if (n == null || Number.isNaN(n)) return "—";
	return Math.round(n).toLocaleString("en-US");
}
function initials(name) {
	if (!name) return "?";
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}
function fmtRecord(wins, losses, ties = 0) {
	return ties > 0 ? `${wins}–${losses}–${ties}` : `${wins}–${losses}`;
}
//#endregion
export { initials as a, formatPts as i, fmtRecord as n, formatInt as r, cn as t };
