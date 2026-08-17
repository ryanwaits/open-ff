import { o as __toESM } from "./_runtime.mjs";
import { n as require_react } from "./_libs/@radix-ui/react-compose-refs+[...].mjs";
import { f as useRouterState, h as Outlet, y as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, n as useQuery } from "./_libs/react+tanstack__react-query.mjs";
import { i as getLeagueBundle } from "./_ssr/fns-Dq4AGxFm.mjs";
import { d as Route$11 } from "./_ssr/router-Day2r6gT.mjs";
import { t as cn } from "./_ssr/utils-B7rbOnud.mjs";
import { t as Skeleton } from "./_ssr/skeleton-pEU6zdaa.mjs";
import { r as useLeagueStore, t as Shell } from "./_ssr/shell-S-vBKzVn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_leagueId-DUjtenuT.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TABS = [
	{
		to: "/league/$leagueId",
		label: "Standings",
		end: true,
		when: "always"
	},
	{
		to: "/league/$leagueId/matchups",
		label: "Matchups",
		end: false,
		when: "always"
	},
	{
		to: "/league/$leagueId/draft",
		label: "Draft",
		end: false,
		when: "hosted"
	},
	{
		to: "/league/$leagueId/wire",
		label: "Wire",
		end: false,
		when: "always"
	},
	{
		to: "/league/$leagueId/trades",
		label: "Trades",
		end: false,
		when: "hosted"
	},
	{
		to: "/league/$leagueId/activity",
		label: "Moves",
		end: false,
		when: "always"
	},
	{
		to: "/league/$leagueId/recap",
		label: "Recap",
		end: false,
		when: "always"
	},
	{
		to: "/league/$leagueId/settings",
		label: "Settings",
		end: false,
		when: "hosted"
	}
];
function LeagueLayout() {
	const { leagueId } = Route$11.useParams();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const remember = useLeagueStore((s) => s.remember);
	const q = useQuery({
		queryKey: ["league", leagueId],
		queryFn: () => getLeagueBundle({ data: { leagueId } }),
		refetchInterval: (query) => query.state.data?.scoringLive ? 15e3 : false
	});
	(0, import_react.useEffect)(() => {
		if (q.data) remember({
			leagueId: q.data.league.league_id,
			name: q.data.league.name,
			season: q.data.league.season
		});
	}, [q.data, remember]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		q.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8 w-48" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-12 w-80" })]
		}) : q.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-loss",
			children: "Couldn't load that league. Check the ID or try the demo from the desk."
		}) : q.data ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "mb-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
					children: [
						q.data.formatLabel,
						" · ",
						q.data.scoringLabel,
						" · ",
						q.data.league.season,
						q.data.scoringLive ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-live",
							children: " · Live unofficial"
						}) : null
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-1 font-display text-4xl tracking-tight",
					children: q.data.league.name
				}),
				q.data.hosted && q.data.inviteCode ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 font-mono text-xs text-faint",
					children: [
						"Invite ",
						q.data.inviteCode,
						q.data.locked ? " · locked demo" : "",
						q.data.myRosterId ? " · your seat" : ""
					]
				}) : null
			]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
			className: "-mx-4 mb-6 flex gap-1 overflow-x-auto px-4",
			children: TABS.filter((tab) => tab.when === "always" || q.data?.hosted).map((tab) => {
				const href = tab.to.replace("$leagueId", leagueId);
				const on = tab.end ? pathname === href : pathname.startsWith(href);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: tab.to,
					params: { leagueId },
					className: cn("shrink-0 rounded-sm px-3 py-2 text-sm", on ? "bg-raised text-fg" : "text-muted hover:text-fg"),
					children: tab.label
				}, tab.to);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
	] });
}
//#endregion
export { LeagueLayout as component };
