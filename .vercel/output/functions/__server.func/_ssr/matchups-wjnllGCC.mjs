import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { i as getLeagueBundle, o as getMatchups } from "./fns-Dq4AGxFm.mjs";
import { s as Route$5 } from "./router-Day2r6gT.mjs";
import { i as formatPts, t as cn } from "./utils-B7rbOnud.mjs";
import { t as Skeleton } from "./skeleton-pEU6zdaa.mjs";
import { t as Button } from "./button-i2bFG7DG.mjs";
import { t as PlayerCell } from "./player-cell-BS10ejnX.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/matchups-wjnllGCC.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var REPLAY_TICK_MS = 4e3;
var LIVE_POLL_MS = 15e3;
var REPLAY_PHASES = [
	{
		key: "ko",
		label: "Kickoff",
		detail: "Sun 1:00",
		state: "pre"
	},
	{
		key: "q1a",
		label: "Q1 11:04",
		detail: "Q1 11:04",
		state: "in"
	},
	{
		key: "q1b",
		label: "Q1 3:22",
		detail: "Q1 3:22",
		state: "in"
	},
	{
		key: "q2a",
		label: "Q2 9:51",
		detail: "Q2 9:51",
		state: "in"
	},
	{
		key: "ht",
		label: "Halftime",
		detail: "Halftime",
		state: "in"
	},
	{
		key: "q3",
		label: "Q3 6:40",
		detail: "Q3 6:40",
		state: "in"
	},
	{
		key: "q4a",
		label: "Q4 8:15",
		detail: "Q4 8:15",
		state: "in"
	},
	{
		key: "q4b",
		label: "Q4 1:12",
		detail: "Q4 1:12",
		state: "in"
	},
	{
		key: "fin",
		label: "Final",
		detail: "Final",
		state: "post"
	}
];
function hash(s) {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
/** Cumulative unofficial points at this phase. Last phase always equals the real final. */
function replayPts(playerId, finalPts, phaseIndex, week) {
	if (finalPts <= 0 || phaseIndex <= 0) return 0;
	const last = REPLAY_PHASES.length - 1;
	if (phaseIndex >= last) return finalPts;
	const n = last - 1;
	const weights = [];
	let sum = 0;
	for (let i = 0; i < n; i++) {
		const h = hash(`${playerId}:${week}:${i}`);
		const r = h % 1e3 / 1e3;
		const w = r < .32 ? 0 : r < .5 ? .06 + h % 30 / 400 : .12 + h % 90 / 180;
		weights.push(w);
		sum += w;
	}
	const norm = weights.map((w) => w / (sum || 1));
	let acc = 0;
	for (let i = 0; i < phaseIndex; i++) acc += finalPts * (norm[i] ?? 0);
	return Math.round(acc * 10) / 10;
}
function applyReplaySide(side, week, phaseIndex) {
	const phase = REPLAY_PHASES[phaseIndex] ?? REPLAY_PHASES[0];
	const starters = side.starters.map((line) => {
		const final = line.points ?? 0;
		const points = line.playerId ? replayPts(line.playerId, final, phaseIndex, week) : null;
		const game = line.player ? {
			state: phase.state,
			detail: phase.detail,
			opp: line.game?.opp ?? null
		} : null;
		return {
			...line,
			points,
			game
		};
	});
	return {
		...side,
		starters,
		points: starters.reduce((s, l) => s + (l.points ?? 0), 0)
	};
}
function applyReplayPairs(pairs, week, phaseIndex) {
	return pairs.map((pair) => ({
		...pair,
		home: applyReplaySide(pair.home, week, phaseIndex),
		away: pair.away ? applyReplaySide(pair.away, week, phaseIndex) : null
	}));
}
function SideCol({ side, prev, leagueId }) {
	const teamDelta = prev ? side.points - prev.points : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/league/$leagueId/team/$rosterId",
		params: {
			leagueId,
			rosterId: String(side.rosterId)
		},
		className: "block",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "truncate text-sm",
			children: side.teamName
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "flex items-baseline gap-2 font-display text-3xl tabular-nums tracking-tight",
			children: [formatPts(side.points, 2), teamDelta > .04 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "font-mono text-sm text-win",
				children: ["+", formatPts(teamDelta, 1)]
			}) : null]
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "mt-3 space-y-1.5",
		children: side.starters.map((line, i) => {
			const before = prev?.starters[i]?.points ?? 0;
			const bump = (line.points ?? 0) - before;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: cn("flex items-center gap-2 rounded-md px-1 py-1 transition-colors duration-300", bump > .04 && "bg-win/10"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "w-8 shrink-0 font-mono text-[10px] text-faint",
						children: line.slot
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "min-w-0 flex-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerCell, {
							player: line.player,
							empty: "—",
							compact: true,
							game: line.game
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "w-16 text-right font-mono text-xs tabular-nums",
						children: [formatPts(line.points, 1), bump > .04 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "block text-[10px] text-win",
							children: ["+", formatPts(bump, 1)]
						}) : null]
					})
				]
			}, `${i}-${line.slot}-${line.playerId ?? "e"}`);
		})
	})] });
}
function MatchupsPage() {
	const { leagueId } = Route$5.useParams();
	const search = Route$5.useSearch();
	const navigate = Route$5.useNavigate();
	const [phase, setPhase] = (0, import_react.useState)(null);
	const [running, setRunning] = (0, import_react.useState)(false);
	const league = useQuery({
		queryKey: ["league", leagueId],
		queryFn: () => getLeagueBundle({ data: { leagueId } }),
		refetchInterval: (q) => phase == null && q.state.data?.scoringLive ? LIVE_POLL_MS : false
	});
	const week = search.week ?? league.data?.currentWeek ?? 1;
	const matchups = useQuery({
		queryKey: [
			"matchups",
			leagueId,
			week
		],
		queryFn: () => getMatchups({ data: {
			leagueId,
			week
		} }),
		enabled: Boolean(league.data),
		refetchInterval: (q) => {
			if (phase != null) return false;
			return (q.state.data ?? []).some((pair) => [pair.home, pair.away].some((side) => side?.starters.some((s) => s.game?.state === "in"))) || league.data?.scoringLive ? LIVE_POLL_MS : false;
		}
	});
	(0, import_react.useEffect)(() => {
		setPhase(null);
		setRunning(false);
	}, [week, leagueId]);
	(0, import_react.useEffect)(() => {
		if (!running || phase == null) return;
		if (phase >= REPLAY_PHASES.length - 1) {
			setRunning(false);
			return;
		}
		const t = window.setTimeout(() => setPhase((p) => p == null ? 0 : p + 1), REPLAY_TICK_MS);
		return () => window.clearTimeout(t);
	}, [running, phase]);
	const playoffStart = league.data?.ops?.playoffStartWeek ?? league.data?.league.settings.playoff_week_start ?? 15;
	const maxWeek = Math.max(playoffStart + 2, league.data?.ops?.regularWeeks ?? 14, league.data?.currentWeek ?? 1);
	const shown = (0, import_react.useMemo)(() => {
		if (!matchups.data) return [];
		if (phase == null) return matchups.data;
		return applyReplayPairs(matchups.data, week, phase);
	}, [
		matchups.data,
		phase,
		week
	]);
	const prevShown = (0, import_react.useMemo)(() => {
		if (!matchups.data || phase == null || phase <= 0) return null;
		return applyReplayPairs(matchups.data, week, phase - 1);
	}, [
		matchups.data,
		phase,
		week
	]);
	const current = phase != null ? REPLAY_PHASES[phase] : null;
	function startReplay() {
		setPhase(0);
		setRunning(true);
	}
	function stopReplay() {
		setRunning(false);
		setPhase(null);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		league.data?.scoringLive && phase == null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-live",
			children: [
				"Live unofficial · ticks every ",
				LIVE_POLL_MS / 1e3,
				"s"
			]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-4 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
					children: phase == null ? "Replay lab" : running ? "Replay running" : "Replay paused"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-sm text-muted",
					children: [
						"Real unofficial lines from this week, unfolded like a Sunday. Tick every",
						" ",
						REPLAY_TICK_MS / 1e3,
						"s — live games poll every ",
						LIVE_POLL_MS / 1e3,
						"s."
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: phase == null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						onClick: startReplay,
						children: "Watch this week tick"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						onClick: () => setRunning((v) => !v),
						children: running ? "Pause" : "Resume"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "ghost",
						onClick: stopReplay,
						children: "Show finals"
					})] })
				})]
			}), current && phase != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 font-mono text-sm text-live",
				children: [current.label, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-faint",
					children: [
						" ",
						"· ",
						phase + 1,
						"/",
						REPLAY_PHASES.length
					]
				})]
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex gap-1 overflow-x-auto pb-4",
			children: Array.from({ length: maxWeek }, (_, i) => i + 1).map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => navigate({ search: { week: w } }),
				className: cn("flex size-10 shrink-0 flex-col items-center justify-center rounded-sm font-mono text-sm", w === week ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
				children: [w >= playoffStart ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[9px] leading-none",
					children: "P"
				}) : null, w]
			}, w))
		}),
		matchups.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-3",
			children: Array.from({ length: 3 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64" }, i))
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-4",
			children: [shown.map((pair, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: cn("rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5", search.focus === pair.matchupId && "ring-1 ring-accent/40"),
				children: [pair.label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-live",
					children: pair.label
				}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-6 sm:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SideCol, {
						side: pair.home,
						prev: prevShown?.[idx]?.home ?? null,
						leagueId
					}), pair.away ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SideCol, {
						side: pair.away,
						prev: prevShown?.[idx]?.away ?? null,
						leagueId
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Bye week"
					})]
				})]
			}, pair.matchupId)), shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "No matchups this week."
			}) : null]
		})
	] });
}
//#endregion
export { MatchupsPage as component };
