import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { i as getLeagueBundle, n as getActivity } from "./fns-Dq4AGxFm.mjs";
import { l as ArrowLeftRight } from "../_libs/lucide-react.mjs";
import { l as Route$7 } from "./router-Day2r6gT.mjs";
import { t as cn } from "./utils-B7rbOnud.mjs";
import { t as Skeleton } from "./skeleton-pEU6zdaa.mjs";
import { t as Badge } from "./badge-DJUSvdKs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/activity-D2v1PEGs.js
var import_jsx_runtime = require_jsx_runtime();
function ActivityPage() {
	const { leagueId } = Route$7.useParams();
	const search = Route$7.useSearch();
	const navigate = Route$7.useNavigate();
	const league = useQuery({
		queryKey: ["league", leagueId],
		queryFn: () => getLeagueBundle({ data: { leagueId } })
	});
	const week = search.week ?? league.data?.currentWeek ?? 1;
	const activity = useQuery({
		queryKey: [
			"activity",
			leagueId,
			week
		],
		queryFn: () => getActivity({ data: {
			leagueId,
			week
		} }),
		enabled: Boolean(league.data)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex gap-1 overflow-x-auto pb-4",
		children: Array.from({ length: 18 }, (_, i) => i + 1).map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: () => navigate({ search: { week: w } }),
			className: cn("flex size-10 shrink-0 items-center justify-center rounded-sm font-mono text-sm", w === week ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
			children: w
		}, w))
	}), activity.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-2",
		children: Array.from({ length: 6 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-16" }, i))
	}) : activity.data && activity.data.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "No transactions this week."
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "space-y-2",
		children: activity.data?.map((tx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-border)]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: tx.type.replace("_", " ") }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						tone: tx.status === "complete" ? "win" : "muted",
						children: tx.status
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-faint",
						children: tx.teamNames.join(" · ")
					}),
					tx.bid != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-mono text-xs text-muted",
						children: ["$", tx.bid]
					}) : null
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap items-center gap-2 text-sm",
				children: [
					tx.adds.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-win",
						children: [
							"+ ",
							p.name,
							p.pos ? ` (${p.pos})` : ""
						]
					}, `a-${p.playerId}`)),
					tx.adds.length && tx.drops.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeftRight, { className: "size-3.5 text-faint" }) : null,
					tx.drops.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-loss",
						children: [
							"− ",
							p.name,
							p.pos ? ` (${p.pos})` : ""
						]
					}, `d-${p.playerId}`))
				]
			})]
		}, tx.id))
	})] });
}
//#endregion
export { ActivityPage as component };
