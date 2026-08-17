import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { r as getLeaders, s as getPlayerSearch } from "./fns-Dq4AGxFm.mjs";
import { i as formatPts, r as formatInt, t as cn } from "./utils-B7rbOnud.mjs";
import { t as Skeleton } from "./skeleton-pEU6zdaa.mjs";
import { t as Shell } from "./shell-S-vBKzVn.mjs";
import { t as PlayerCell } from "./player-cell-BS10ejnX.mjs";
import { t as Input } from "./input-Da9nFsco.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/players-YFfOHwwb.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var POS = [
	"ALL",
	"QB",
	"RB",
	"WR",
	"TE",
	"K",
	"DEF"
];
function PlayersPage() {
	const [pos, setPos] = (0, import_react.useState)("ALL");
	const [q, setQ] = (0, import_react.useState)("");
	const leaders = useQuery({
		queryKey: ["leaders", pos],
		queryFn: () => getLeaders({ data: { position: pos } }),
		enabled: q.trim().length === 0
	});
	const search = useQuery({
		queryKey: [
			"psearch",
			q,
			pos
		],
		queryFn: () => getPlayerSearch({ data: {
			query: q,
			position: pos
		} }),
		enabled: q.trim().length > 0
	});
	const rows = (0, import_react.useMemo)(() => {
		if (q.trim()) return search.data ?? [];
		return leaders.data ?? [];
	}, [
		q,
		search.data,
		leaders.data
	]);
	const loading = q.trim() ? search.isLoading : leaders.isLoading;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-[11px] uppercase tracking-[0.18em] text-faint",
				children: "Season PPR · Sleeper unofficial stats"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-1 font-display text-4xl tracking-tight",
				children: "Players"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 max-w-xl text-sm text-muted",
				children: "Live season scoring from Sleeper, with a 2025 seed if the feed is quiet. Search the active pool anytime."
			})
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 flex flex-col gap-3 sm:flex-row sm:items-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Search a name or team",
				className: "sm:max-w-xs"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-1",
				children: POS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setPos(p),
					className: cn("h-9 rounded-sm px-3 font-mono text-xs", pos === p ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
					children: p
				}, p))
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 overflow-x-auto rounded-xl bg-surface shadow-[var(--shadow-border)]",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full min-w-[640px] text-left text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "font-mono text-[11px] uppercase tracking-wide text-faint",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-line",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3 font-medium",
								children: "#"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-2 py-3 font-medium",
								children: "Player"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-3 text-right font-medium",
								children: "PPR"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-3 text-right font-medium",
								children: "Pass"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-3 text-right font-medium",
								children: "Rush"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-3 text-right font-medium",
								children: "Rec"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3 text-right font-medium",
								children: "GP"
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: loading ? Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
					className: "border-b border-line",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						colSpan: 7,
						className: "px-4 py-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8" })
					})
				}, i)) : rows.map((p, i) => {
					const leader = "pts_ppr" in p && typeof p.pts_ppr === "number" ? p : null;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-line last:border-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5 font-mono text-xs text-faint",
								children: i + 1
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-2.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerCell, {
									player: p,
									compact: true
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2.5 text-right font-mono tabular-nums",
								children: leader ? formatPts(leader.pts_ppr, 1) : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted",
								children: leader ? `${formatInt(leader.pass_yd)} / ${formatInt(leader.pass_td)}` : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted",
								children: leader ? `${formatInt(leader.rush_yd)} / ${formatInt(leader.rush_td)}` : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted",
								children: leader ? `${formatInt(leader.rec)} / ${formatInt(leader.rec_yd)}` : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5 text-right font-mono text-xs tabular-nums text-muted",
								children: leader ? formatInt(leader.gp) : "—"
							})
						]
					}, p.player_id);
				}) })]
			})
		})
	] });
}
//#endregion
export { PlayersPage as component };
