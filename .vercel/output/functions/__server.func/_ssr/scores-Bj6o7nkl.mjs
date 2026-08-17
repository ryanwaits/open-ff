import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { a as getLiveWire, u as getScores } from "./fns-Dq4AGxFm.mjs";
import { f as Route$12 } from "./router-Day2r6gT.mjs";
import { i as formatPts, t as cn } from "./utils-B7rbOnud.mjs";
import { t as Skeleton } from "./skeleton-pEU6zdaa.mjs";
import { t as DEMO_HOSTED_ID } from "./types-CUBoEF9H.mjs";
import { t as Shell } from "./shell-S-vBKzVn.mjs";
import { t as Button } from "./button-i2bFG7DG.mjs";
import { t as ScoreStrip } from "./scoreboard-DiAZOO3k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/scores-Bj6o7nkl.js
var import_jsx_runtime = require_jsx_runtime();
var KINDS = [
	{
		id: "pre",
		label: "Pre",
		type: 1
	},
	{
		id: "regular",
		label: "Regular",
		type: 2
	},
	{
		id: "post",
		label: "Post",
		type: 3
	}
];
function ScoresPage() {
	const search = Route$12.useSearch();
	const navigate = Route$12.useNavigate();
	const kind = search.kind ?? "pre";
	const seasonType = KINDS.find((k) => k.id === kind)?.type ?? 1;
	const week = search.week;
	const season = search.season ?? 2026;
	const q = useQuery({
		queryKey: [
			"scores",
			season,
			week,
			seasonType
		],
		queryFn: () => getScores({ data: {
			week: search.week,
			season: search.season,
			seasonType
		} }),
		refetchInterval: (query) => {
			const games = query.state.data?.games ?? [];
			if (games.some((g) => g.state === "in")) return 12e3;
			if (games.some((g) => g.state === "pre")) return 3e4;
			return false;
		}
	});
	const wire = useQuery({
		queryKey: [
			"live-wire",
			search.season,
			search.week,
			kind
		],
		queryFn: () => getLiveWire({ data: {
			season: search.season,
			week: search.week,
			kind
		} }),
		refetchInterval: (query) => query.state.data?.live ? 12e3 : 3e4
	});
	const resolvedWeek = search.week ?? wire.data?.week ?? q.data?.week ?? 1;
	const liveGames = q.data?.games.filter((g) => g.state === "in").length ?? 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-[11px] uppercase tracking-[0.18em] text-faint",
				children: "ESPN public scoreboard"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-1 font-display text-4xl tracking-tight",
				children: "NFL scores"
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: KINDS.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					variant: kind === k.id ? "primary" : "outline",
					onClick: () => navigate({ search: {
						...search,
						kind: k.id
					} }),
					children: k.label
				}, k.id))
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-6 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
					children: "Scoring pipe"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: liveGames > 0 ? `${liveGames} game${liveGames === 1 ? "" : "s"} live · unofficial fantasy lines poll every 12s.` : "No NFL games in progress. The pipe is live — nothing to tick until kickoff."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 font-mono text-[11px] text-faint",
					children: wire.data ? `${wire.data.kind} ${wire.data.season} week ${wire.data.week} · ${wire.data.scoredPlayers} unofficial lines · ${wire.data.gamesIn}/${wire.data.gamesTotal} live` : "Checking unofficial feed…"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 text-sm",
					children: [
						"Watch a real completed week unfold the same way Sundays will —",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/league/$leagueId/matchups",
							params: { leagueId: DEMO_HOSTED_ID },
							search: { week: 14 },
							className: "text-fg underline decoration-line underline-offset-4 hover:decoration-fg",
							children: "replay The Backyard, week 14"
						}),
						"."
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 flex gap-1 overflow-x-auto pb-2",
			children: Array.from({ length: kind === "regular" ? 18 : kind === "pre" ? 4 : 5 }, (_, i) => i + 1).map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => navigate({ search: {
					...search,
					week: w,
					season
				} }),
				className: cn("flex size-10 shrink-0 items-center justify-center rounded-sm font-mono text-sm", w === resolvedWeek ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
				children: w
			}, w))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6",
			children: q.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-1 gap-2 sm:grid-cols-2",
				children: Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-28" }, i))
			}) : q.data?.games.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScoreStrip, { games: q.data.games }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "No games for that week."
			})
		}),
		wire.data?.leaders.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-10",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl",
					children: "Unofficial PPR this week"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Same Sleeper stat line we score leagues from. Empty means they have not posted this week yet."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "mt-4 divide-y divide-line rounded-xl bg-surface shadow-[var(--shadow-border)]",
					children: wire.data.leaders.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center gap-3 px-4 py-2.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "w-6 font-mono text-xs text-faint",
								children: i + 1
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0 flex-1 truncate text-sm",
								children: [row.name, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 font-mono text-[11px] uppercase text-faint",
									children: [row.pos, row.team].filter(Boolean).join(" · ")
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-sm tabular-nums",
								children: formatPts(row.points, 1)
							})
						]
					}, row.id))
				})
			]
		}) : null
	] });
}
//#endregion
export { ScoresPage as component };
