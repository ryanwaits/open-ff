import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, n as useQuery, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { t as findSleeperUser } from "./fns-Dq4AGxFm.mjs";
import { c as ArrowRight, s as Newspaper } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { h as Route$19 } from "./router-Day2r6gT.mjs";
import { t as Skeleton } from "./skeleton-pEU6zdaa.mjs";
import { i as DEMO_LEAGUE_NAME, n as DEMO_HOSTED_NAME, r as DEMO_LEAGUE_ID, t as DEMO_HOSTED_ID } from "./types-CUBoEF9H.mjs";
import { r as useLeagueStore, t as Shell } from "./shell-S-vBKzVn.mjs";
import { t as Badge } from "./badge-DJUSvdKs.mjs";
import { t as Button } from "./button-i2bFG7DG.mjs";
import { _ as listMyLeagues } from "./fns-DTtAXaEu.mjs";
import { t as PlayerCell } from "./player-cell-BS10ejnX.mjs";
import { t as Input } from "./input-Da9nFsco.mjs";
import { t as ScoreStrip } from "./scoreboard-DiAZOO3k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-B6eG7-NH.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Home() {
	const pulse = Route$19.useLoaderData();
	const navigate = useNavigate();
	const remember = useLeagueStore((s) => s.remember);
	const recent = useLeagueStore((s) => s.recent);
	const [query, setQuery] = (0, import_react.useState)("");
	const [leagues, setLeagues] = (0, import_react.useState)(null);
	const mine = useQuery({
		queryKey: ["my-leagues"],
		queryFn: () => listMyLeagues()
	});
	const lookup = useMutation({
		mutationFn: async (q) => findSleeperUser({ data: { query: q } }),
		onSuccess: (res) => {
			if (!res) {
				toast("No Sleeper user by that name.");
				setLeagues([]);
				return;
			}
			setLeagues(res.leagues);
			if (!res.leagues.length) toast("User found, but no NFL leagues listed.");
		},
		onError: () => toast("Could not reach Sleeper. Try again.")
	});
	function openLeague(league) {
		remember(league);
		navigate({
			to: "/league/$leagueId",
			params: { leagueId: league.leagueId }
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "ledger-in grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-end",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-mono text-[11px] uppercase tracking-[0.2em] text-faint",
					children: [
						pulse.state.season,
						" · ",
						pulse.state.season_type === "pre" ? "Preseason" : "Regular",
						" · Week ",
						pulse.state.display_week
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "mt-3 font-display text-5xl leading-[0.95] tracking-tight sm:text-6xl",
					children: [
						"Your league.",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "italic",
							children: "Nobody else's app."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 max-w-md text-sm leading-relaxed text-muted",
					children: "Draft, lineups, waivers, and a weekly dispatch — hosted here. Sleeper only feeds players and stats. Your friends sign in on Ledger. They never download another app."
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
						children: "Open a desk"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-col gap-2 sm:flex-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							asChild: true,
							className: "flex-1",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/new",
								children: "Create a league"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							asChild: true,
							variant: "outline",
							className: "flex-1",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/join",
								children: "Join with a code"
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						variant: "ghost",
						className: "mt-2 w-full",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/import",
							children: "Import a league"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-xs text-faint",
						children: "One commissioner. Invite codes. House clubs fill empty seats."
					})
				]
			})]
		}),
		mine.data && mine.data.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
				children: "Your seats"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 grid gap-2 sm:grid-cols-2",
				children: mine.data.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => openLeague({
						leagueId: l.leagueId,
						name: l.name,
						season: l.season
					}),
					className: "flex w-full items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-left shadow-[var(--shadow-border)] transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-sm",
						children: l.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-mono text-[11px] text-faint",
						children: [
							l.season,
							" · ",
							l.role,
							" · ",
							l.status.replace("_", " ")
						]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4 text-faint" })]
				}) }, l.leagueId))
			})]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "ledger-in-2 mt-10 grid gap-3 sm:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => openLeague({
					leagueId: DEMO_HOSTED_ID,
					name: DEMO_HOSTED_NAME,
					season: "2025"
				}),
				className: "rounded-xl bg-surface p-5 text-left shadow-[var(--shadow-border)] transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "Demo · hosted here" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-3 font-display text-2xl",
						children: DEMO_HOSTED_NAME
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "A finished 10-team redraft scored from 2025 weeks — standings, box scores, recap. No Sleeper login."
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						tone: "muted",
						children: "Optional peek"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-3 font-display text-2xl",
						children: "Public Sleeper league"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Commissioner-only. Paste a username to browse a public Sleeper league. Members still play here."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "mt-4 flex flex-col gap-2 sm:flex-row",
						onSubmit: (e) => {
							e.preventDefault();
							const q = query.trim();
							if (!q) return;
							if (/^\d{10,}$/.test(q)) {
								openLeague({
									leagueId: q,
									name: "Sleeper league",
									season: pulse.state.season
								});
								return;
							}
							lookup.mutate(q);
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: query,
							onChange: (e) => setQuery(e.target.value),
							placeholder: "Sleeper username",
							autoComplete: "off",
							"aria-label": "Sleeper username or league ID"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							variant: "outline",
							disabled: lookup.isPending,
							className: "sm:w-28",
							children: lookup.isPending ? "…" : "Peek"
						})]
					})
				]
			})]
		}),
		leagues && leagues.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
				children: "Sleeper leagues found"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 grid gap-2 sm:grid-cols-2",
				children: leagues.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => openLeague({
						leagueId: l.league_id,
						name: l.name,
						season: l.season
					}),
					className: "flex w-full items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-left shadow-[var(--shadow-border)] transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-sm",
						children: l.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-mono text-[11px] text-faint",
						children: [
							l.season,
							" · ",
							l.total_rosters,
							" teams · ",
							l.status.replace("_", " ")
						]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4 text-faint" })]
				}) }, l.league_id))
			})]
		}) : null,
		recent.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
				children: "Recent"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: recent.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/league/$leagueId",
					params: { leagueId: r.leagueId },
					className: "rounded-full bg-raised px-3 py-1.5 text-sm text-muted hover:text-fg",
					children: r.name
				}, r.leagueId))
			})]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-6 text-xs text-faint",
			children: [
				"Curious how a finished Sleeper season looks?",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "underline-offset-2 hover:underline",
					onClick: () => openLeague({
						leagueId: DEMO_LEAGUE_ID,
						name: DEMO_LEAGUE_NAME,
						season: "2025"
					}),
					children: ["Peek at ", DEMO_LEAGUE_NAME]
				}),
				"."
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "ledger-in-3 mt-12",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-3xl tracking-tight",
					children: "NFL board"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/scores",
					className: "text-sm text-muted hover:text-fg",
					children: "Full scores"
				})]
			}), pulse.games.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScoreStrip, { games: pulse.games }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-28" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-28" })]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-3xl tracking-tight",
					children: "Trending adds"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Sleeper waiver heat, last 24 hours."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-4 divide-y divide-line",
					children: pulse.trending.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-3 py-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerCell, { player: p }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-mono text-xs tabular-nums text-muted",
							children: [p.adds.toLocaleString(), " adds"]
						})]
					}, p.player_id))
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-3xl tracking-tight",
					children: "Wire copy"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-4 space-y-4",
					children: pulse.news.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "border-t border-line pt-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm leading-snug",
							children: n.headline
						}), n.description ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 line-clamp-2 text-xs leading-relaxed text-muted",
							children: n.description
						}) : null]
					}, n.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-4 flex items-center gap-1.5 text-xs text-faint",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Newspaper, { className: "size-3.5" }), "Headlines via ESPN public feed"]
				})
			] })]
		})
	] });
}
//#endregion
export { Home as component };
