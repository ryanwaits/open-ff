import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { i as getLeagueBundle } from "./fns-Dq4AGxFm.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { c as Route$6 } from "./router-Day2r6gT.mjs";
import { i as formatPts, t as cn } from "./utils-B7rbOnud.mjs";
import { t as Skeleton } from "./skeleton-pEU6zdaa.mjs";
import { t as Badge } from "./badge-DJUSvdKs.mjs";
import { t as Button } from "./button-i2bFG7DG.mjs";
import { E as startDraft, l as getDraft, r as autoFillDraft, v as makePick } from "./fns-DTtAXaEu.mjs";
import { t as PlayerCell } from "./player-cell-BS10ejnX.mjs";
import { t as Input } from "./input-Da9nFsco.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/draft-CM-w-LJ2.js
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
function DraftPage() {
	const { leagueId } = Route$6.useParams();
	const qc = useQueryClient();
	const [pos, setPos] = (0, import_react.useState)("ALL");
	const [q, setQ] = (0, import_react.useState)("");
	const league = useQuery({
		queryKey: ["league", leagueId],
		queryFn: () => getLeagueBundle({ data: { leagueId } })
	});
	const draft = useQuery({
		queryKey: [
			"draft",
			leagueId,
			pos,
			q
		],
		queryFn: () => getDraft({ data: {
			leagueId,
			position: pos,
			query: q
		} }),
		refetchInterval: (query) => query.state.data?.status === "live" ? 4e3 : false
	});
	function invalidate() {
		qc.invalidateQueries({ queryKey: ["draft", leagueId] });
		qc.invalidateQueries({ queryKey: ["league", leagueId] });
	}
	const start = useMutation({
		mutationFn: () => startDraft({ data: { leagueId } }),
		onSuccess: invalidate,
		onError: (e) => toast(e instanceof Error ? e.message : "Could not start")
	});
	const fill = useMutation({
		mutationFn: () => autoFillDraft({ data: { leagueId } }),
		onSuccess: invalidate,
		onError: (e) => toast(e instanceof Error ? e.message : "Could not fill")
	});
	const pick = useMutation({
		mutationFn: (playerId) => makePick({ data: {
			leagueId,
			playerId
		} }),
		onSuccess: invalidate,
		onError: (e) => toast(e instanceof Error ? e.message : "Pick failed")
	});
	if (!league.data?.hosted) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "This is a Sleeper peek — the draft already happened over there."
	});
	const d = draft.data;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-8 lg:grid-cols-[0.9fr_1.1fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
				children: d ? `${d.status} · pick ${Math.min(d.pickNo, d.total || 1)} / ${d.total || "—"}` : "Draft"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mt-1 font-display text-3xl tracking-tight",
				children: d?.status === "complete" ? "Board is closed" : d?.onClockName ? `${d.onClockName} is on the clock` : "Waiting to open"
			}),
			d?.isMyPick ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-live",
				children: "Your pick. Take someone."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap gap-2",
				children: [
					d?.status === "pending" && d.isCommish ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => start.mutate(),
						disabled: start.isPending,
						children: start.isPending ? "Opening…" : "Open the draft"
					}) : null,
					d?.status === "live" && d.isCommish ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						onClick: () => fill.mutate(),
						disabled: fill.isPending,
						children: fill.isPending ? "Filling…" : "Autodraft the rest"
					}) : null,
					d?.status === "complete" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						variant: "outline",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/league/$leagueId",
							params: { leagueId },
							children: "Standings"
						})
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
				className: "mt-6 space-y-2",
				children: [draft.isLoading ? Array.from({ length: 6 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-12" }, i)) : d?.recent.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center gap-3 rounded-lg bg-surface px-3 py-2 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "w-10 font-mono text-[11px] text-faint",
							children: [
								p.round,
								".",
								p.pick
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "min-w-0 flex-1",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerCell, {
								player: p.player,
								compact: true
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "truncate text-xs text-muted",
							children: p.teamName
						})
					]
				}, p.pick)), d && d.recent.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "No picks yet. Unused picks can be traded before you open the board."
				}) : null]
			}),
			d && d.stock.some((p) => !p.used) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
					children: "Pick stock"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 max-h-72 space-y-1 overflow-y-auto",
					children: d.stock.filter((p) => !p.used).slice(0, 40).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-xs text-faint",
							children: p.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-0 truncate text-muted",
							children: [p.ownerName, p.via ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-faint",
								children: [" · via ", p.via]
							}) : null]
						})]
					}, p.pickNo))
				})]
			}) : null
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-3 sm:flex-row",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Search the pool",
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
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-4 divide-y divide-line rounded-xl bg-surface shadow-[var(--shadow-border)]",
			children: draft.isLoading ? Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "p-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8" })
			}, i)) : d?.available.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center gap-3 px-3 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "min-w-0 flex-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerCell, {
							player: p,
							compact: true
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-xs tabular-nums text-muted",
						children: formatPts(p.pts, 1)
					}),
					d.status === "live" && (d.isMyPick || d.isCommish) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						disabled: pick.isPending,
						onClick: () => pick.mutate(p.player_id),
						children: "Draft"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						tone: "muted",
						children: "Pool"
					})
				]
			}, p.player_id))
		})] })]
	});
}
//#endregion
export { DraftPage as component };
