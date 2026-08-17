import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { i as getLeagueBundle, l as getRecap } from "./fns-Dq4AGxFm.mjs";
import { i as Sparkles } from "../_libs/lucide-react.mjs";
import { o as Route$4 } from "./router-Day2r6gT.mjs";
import { i as formatPts, t as cn } from "./utils-B7rbOnud.mjs";
import { t as Skeleton } from "./skeleton-pEU6zdaa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/recap-DvnMRBFm.js
var import_jsx_runtime = require_jsx_runtime();
function RecapPage() {
	const { leagueId } = Route$4.useParams();
	const search = Route$4.useSearch();
	const navigate = Route$4.useNavigate();
	const league = useQuery({
		queryKey: ["league", leagueId],
		queryFn: () => getLeagueBundle({ data: { leagueId } })
	});
	const week = search.week ?? league.data?.currentWeek ?? 1;
	const recap = useQuery({
		queryKey: [
			"recap",
			leagueId,
			week
		],
		queryFn: () => getRecap({ data: {
			leagueId,
			week
		} }),
		enabled: Boolean(league.data)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-8 lg:grid-cols-[1.1fr_0.9fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex gap-1 overflow-x-auto pb-4",
			children: Array.from({ length: 18 }, (_, i) => i + 1).map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => navigate({ search: { week: w } }),
				className: cn("flex size-10 shrink-0 items-center justify-center rounded-sm font-mono text-sm", w === week ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
				children: w
			}, w))
		}), recap.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8 w-40" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-16" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-24" })
			]
		}) : recap.data ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-[11px] uppercase tracking-[0.18em] text-faint",
				children: recap.data.kicker
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mt-2 font-display text-4xl leading-[1.05] tracking-tight",
				children: recap.data.headline
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-base leading-relaxed text-muted",
				children: recap.data.dek
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-6 space-y-3",
				children: recap.data.bullets.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "border-t border-line pt-3 text-sm leading-relaxed",
					children: b
				}, b))
			}),
			recap.data.wireNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-6 text-sm italic text-muted",
				children: recap.data.wireNote
			}) : null
		] }) : null] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
				children: "Box"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-3 divide-y divide-line rounded-xl bg-surface shadow-[var(--shadow-border)]",
				children: [recap.data?.box.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-fg",
								children: b.winner
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-faint",
								children: " over "
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted",
								children: b.loser
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-mono text-xs tabular-nums text-faint",
						children: [
							b.score,
							" · ",
							formatPts(b.margin, 1),
							" margin"
						]
					})]
				}, `${b.winner}-${b.loser}`)), recap.data && recap.data.box.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-4 py-6 text-sm text-muted",
					children: "No scored games this week."
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5" }), "Next: Grok voice"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm leading-relaxed text-muted",
					children: "This dispatch is written from the box score — no model yet. Same payload can feed weekly articles, commissioner notes, and automated smack talk once we wire a language model."
				})]
			})
		] })]
	});
}
//#endregion
export { RecapPage as component };
