import { a as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as cn } from "./utils-B7rbOnud.mjs";
import { t as Badge } from "./badge-DJUSvdKs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/scoreboard-DiAZOO3k.js
var import_jsx_runtime = require_jsx_runtime();
function TeamRow({ abbr, name, logo, score, winner, state }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex items-center gap-2.5", state === "post" && winner === false && "opacity-45"),
		children: [
			logo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: logo,
				alt: "",
				className: "size-6 object-contain"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-6 rounded-sm bg-raised" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "min-w-0 flex-1 truncate text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium",
					children: abbr
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "hidden text-muted sm:inline",
					children: [" ", name]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-base tabular-nums",
				children: state === "pre" ? "" : score
			})
		]
	});
}
function GameCard({ game }) {
	const tone = game.state === "in" ? "live" : game.state === "post" ? "muted" : "default";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "flex flex-col gap-2.5 rounded-lg bg-surface p-3.5 shadow-[var(--shadow-border)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone,
					children: game.state === "in" ? "Live" : game.detail
				}), game.state !== "in" && game.state !== "pre" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-[11px] text-faint",
					children: game.detail
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TeamRow, {
				...game.away,
				state: game.state
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TeamRow, {
				...game.home,
				state: game.state
			})
		]
	});
}
function ScoreStrip({ games }) {
	if (!games.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "No NFL games on the board."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4",
		children: games.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCard, { game: g }, g.id))
	});
}
//#endregion
export { ScoreStrip as t };
