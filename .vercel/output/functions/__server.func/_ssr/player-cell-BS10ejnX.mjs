import { a as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { a as initials, t as cn } from "./utils-B7rbOnud.mjs";
import { a as teamLogo, n as playerHeadshot } from "./teams-DHGI6_jF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/player-cell-BS10ejnX.js
var import_jsx_runtime = require_jsx_runtime();
function PlayerCell({ player, empty = "Empty", compact = false, game = null }) {
	if (!player) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "text-sm text-faint",
		children: empty
	});
	const isDef = player.position === "DEF";
	const src = isDef ? teamLogo(player.team ?? player.player_id) : playerHeadshot(player.player_id, player.espn_id);
	const name = isDef && player.team ? `${player.team} D/ST` : player.full_name;
	const meta = [player.position, player.team].filter(Boolean).join(" · ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "flex min-w-0 items-center gap-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: cn("relative shrink-0 overflow-hidden rounded-sm bg-raised", compact ? "size-8" : "size-9"),
			children: [
				src ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src,
					alt: "",
					className: "size-full object-cover",
					onError: (e) => {
						e.currentTarget.style.display = "none";
					}
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "absolute inset-0 grid place-items-center font-mono text-[10px] text-muted",
					children: initials(name)
				}),
				game?.state === "in" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute right-0.5 bottom-0.5 size-1.5 rounded-full bg-live" }) : null
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block truncate text-sm text-fg",
				children: name
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "block truncate font-mono text-[11px] uppercase tracking-wide text-faint",
				children: [meta, game?.state === "in" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-live",
					children: [" · ", game.detail]
				}) : game ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [" · ", game.detail] }) : null]
			})]
		})]
	});
}
//#endregion
export { PlayerCell as t };
