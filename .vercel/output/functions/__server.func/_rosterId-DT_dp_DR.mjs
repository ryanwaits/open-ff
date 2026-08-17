import { a as require_jsx_runtime, i as useQueryClient, n as useQuery, t as useMutation } from "./_libs/react+tanstack__react-query.mjs";
import { f as getTeam, i as getLeagueBundle } from "./_ssr/fns-Dq4AGxFm.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { n as Route } from "./_ssr/router-Day2r6gT.mjs";
import { a as initials, i as formatPts, n as fmtRecord } from "./_ssr/utils-B7rbOnud.mjs";
import { t as Skeleton } from "./_ssr/skeleton-pEU6zdaa.mjs";
import { t as Badge } from "./_ssr/badge-DJUSvdKs.mjs";
import { t as Button } from "./_ssr/button-i2bFG7DG.mjs";
import { D as startPlayer, T as sitPlayer } from "./_ssr/fns-DTtAXaEu.mjs";
import { t as PlayerCell } from "./_ssr/player-cell-BS10ejnX.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_rosterId-DT_dp_DR.js
var import_jsx_runtime = require_jsx_runtime();
function TeamPage() {
	const { leagueId, rosterId } = Route.useParams();
	const qc = useQueryClient();
	const league = useQuery({
		queryKey: ["league", leagueId],
		queryFn: () => getLeagueBundle({ data: { leagueId } }),
		refetchInterval: (q) => q.state.data?.scoringLive ? 15e3 : false
	});
	const week = league.data?.currentWeek ?? 1;
	const team = useQuery({
		queryKey: [
			"team",
			leagueId,
			rosterId,
			week
		],
		queryFn: () => getTeam({ data: {
			leagueId,
			rosterId: Number(rosterId),
			week
		} }),
		enabled: Boolean(league.data),
		refetchInterval: () => league.data?.scoringLive ? 15e3 : false
	});
	const mine = league.data?.hosted && league.data.myRosterId === Number(rosterId) && !league.data.locked;
	function invalidate() {
		qc.invalidateQueries({ queryKey: [
			"team",
			leagueId,
			rosterId
		] });
		qc.invalidateQueries({ queryKey: ["league", leagueId] });
		qc.invalidateQueries({ queryKey: ["matchups", leagueId] });
	}
	const start = useMutation({
		mutationFn: (playerId) => startPlayer({ data: {
			leagueId,
			playerId
		} }),
		onSuccess: invalidate,
		onError: (e) => toast(e instanceof Error ? e.message : "Could not start")
	});
	const sit = useMutation({
		mutationFn: (playerId) => sitPlayer({ data: {
			leagueId,
			playerId
		} }),
		onSuccess: invalidate,
		onError: (e) => toast(e instanceof Error ? e.message : "Could not sit")
	});
	if (team.isLoading || league.isLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-2",
		children: Array.from({ length: 10 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-12" }, i))
	});
	if (!team.data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Roster not found."
	});
	const groups = [
		{
			key: "starter",
			label: `Week ${week} starters`
		},
		{
			key: "bench",
			label: "Bench"
		},
		{
			key: "ir",
			label: "IR"
		},
		{
			key: "taxi",
			label: "Taxi"
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "grid size-14 place-items-center overflow-hidden rounded-full bg-raised text-lg",
			children: team.data.avatar ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: team.data.avatar,
				alt: "",
				className: "size-full object-cover"
			}) : initials(team.data.teamName)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-3xl tracking-tight",
				children: team.data.teamName
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: [
					team.data.manager,
					" ·",
					" ",
					fmtRecord(team.data.record.wins, team.data.record.losses, team.data.record.ties),
					" ",
					"· ",
					formatPts(team.data.record.pf, 1),
					" PF"
				]
			}),
			mine ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-faint",
				children: "Your roster — sit or start anyone."
			}) : null
		] })]
	}), groups.map((g) => {
		const rows = team.data.players.filter((p) => p.slot === g.key);
		if (!rows.length) return null;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
				children: g.label
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 divide-y divide-line rounded-xl bg-surface shadow-[var(--shadow-border)]",
				children: rows.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center gap-3 px-3 py-2.5",
					children: [
						p.starterSlot ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "w-8 font-mono text-[10px] text-faint",
							children: p.starterSlot
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-8" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "min-w-0 flex-1",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerCell, {
								player: p,
								compact: true,
								game: p.game
							})
						}),
						p.injury_status ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: "loss",
							children: p.injury_status
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "w-12 text-right font-mono text-sm tabular-nums",
							children: formatPts(p.weekPts, 1)
						}),
						mine && g.key === "starter" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							disabled: sit.isPending,
							onClick: () => sit.mutate(p.player_id),
							children: "Sit"
						}) : null,
						mine && g.key === "bench" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							disabled: start.isPending,
							onClick: () => start.mutate(p.player_id),
							children: "Start"
						}) : null
					]
				}, p.player_id))
			})]
		}, g.key);
	})] });
}
//#endregion
export { TeamPage as component };
