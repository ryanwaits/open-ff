import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { d as getSources } from "./fns-Dq4AGxFm.mjs";
import { t as Skeleton } from "./skeleton-pEU6zdaa.mjs";
import { t as Shell } from "./shell-S-vBKzVn.mjs";
import { t as Badge } from "./badge-DJUSvdKs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/data-CJw8kMIb.js
var import_jsx_runtime = require_jsx_runtime();
function SourceCard({ source }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
					children: [
						source.cost,
						" · ",
						source.latencyMs,
						"ms"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: source.ok ? "win" : "loss",
					children: source.ok ? "Live" : "Down"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mt-2 font-display text-2xl",
				children: source.name
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm leading-relaxed text-muted",
				children: source.role
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 font-mono text-[11px] text-faint",
				children: source.detail
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs leading-relaxed text-faint",
				children: source.license
			})
		]
	});
}
function DataPage() {
	const sources = useQuery({
		queryKey: ["sources"],
		queryFn: () => getSources(),
		staleTime: 6e4
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-mono text-[11px] uppercase tracking-[0.18em] text-faint",
			children: "How the desk is fed"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "mt-2 max-w-2xl font-display text-4xl tracking-tight sm:text-5xl",
			children: "Cheap, open, and good enough to run a league."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 max-w-2xl text-sm leading-relaxed text-muted",
			children: "Official NFL / fantasy APIs want real money. Ledger does not buy a firehose. It imports your Sleeper league, reads the ESPN scoreboard, and keeps nflverse as the open archive. No keys. No SportsDataIO invoice."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-10 grid gap-4 md:grid-cols-3",
			children: sources.isLoading ? Array.from({ length: 3 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-48" }, i)) : sources.data?.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceCard, { source: s }, s.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-12 max-w-2xl space-y-4 text-sm leading-relaxed text-muted",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-3xl text-fg",
					children: "The rule that makes this free"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
					"Sleeper is the ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-fg",
						children: "data pipe"
					}),
					", not the clubhouse. Players, unofficial weekly stats, and trending adds come from their public API — no member accounts, no Sleeper login. Ledger hosts the league: seats, draft, lineups, waivers, standings."
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "One commissioner can still peek at a public Sleeper league. Everyone else signs in here (Google, X, or email) and plays on Ledger. That is how you avoid making the group download another app." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "pt-4 font-display text-3xl text-fg",
					children: "What each layer is for"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-fg",
					children: "Sleeper"
				}), " is the player encyclopedia and unofficial weekly stat line — no keys, personal use, stay under ~1,000 calls/min. Members never touch it. During games we poll that unofficial line every ~15s (same feed Sleeper uses for live points). It is not a licensed play-by-play firehose."] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-fg",
					children: "ESPN public"
				}), " is the NFL world — scoreboard, clock, headlines. Same JSON their site uses. Cache it. Do not sell it."] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-fg",
					children: "nflverse"
				}), " is the open archive — weekly player stats and play-by-play on GitHub, updated nightly. Perfect for recaps, models, and historical leaders. Wrong tool for Sunday live scoring."] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "pt-4 font-display text-3xl text-fg",
					children: "What we skipped on purpose"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "SportsDataIO, FantasyData, and Sportradar are cleaner and licensed for products you sell. They are also why most custom fantasy apps die in a spreadsheet. We do not need them to run friends-and-family leagues." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Live official box scores with an SLA are the one thing you cannot honestly get for free. For a personal desk, Sleeper matchup points update during games. That is enough." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "pt-4 font-display text-3xl text-fg",
					children: "The AI chapter"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Digests and smack talk do not need a stats vendor. They need a structured box score (we have that) and a language model. The Recap tab already writes a week dispatch from real matchup math. Next we point that same payload at Grok and let it talk like your league." })
			]
		})
	] });
}
//#endregion
export { DataPage as component };
