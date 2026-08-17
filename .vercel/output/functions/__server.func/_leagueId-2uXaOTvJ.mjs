import { y as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, n as useQuery } from "./_libs/react+tanstack__react-query.mjs";
import { i as getLeagueBundle, o as getMatchups } from "./_ssr/fns-Dq4AGxFm.mjs";
import { u as Route$8 } from "./_ssr/router-Day2r6gT.mjs";
import { a as initials, i as formatPts, n as fmtRecord, t as cn } from "./_ssr/utils-B7rbOnud.mjs";
import { t as Skeleton } from "./_ssr/skeleton-pEU6zdaa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_leagueId-2uXaOTvJ.js
var import_jsx_runtime = require_jsx_runtime();
function Side({ side, align, leading }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("flex min-w-0 flex-1 items-center gap-2.5", align === "right" && "flex-row-reverse text-right"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-raised text-xs",
			children: side.avatar ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: side.avatar,
				alt: "",
				className: "size-full object-cover"
			}) : initials(side.teamName)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: cn("block truncate text-sm", leading ? "text-fg" : "text-muted"),
				children: side.teamName
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block truncate font-mono text-[11px] text-faint",
				children: side.manager
			})]
		})]
	});
}
function MatchupCard({ pair, leagueId, week }) {
	const away = pair.away;
	const homeLeads = !away || pair.home.points >= away.points;
	const decided = pair.home.points > 0 || (away?.points ?? 0) > 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/league/$leagueId/matchups",
		params: { leagueId },
		search: {
			week,
			focus: pair.matchupId
		},
		className: "block rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Side, {
					side: pair.home,
					align: "left",
					leading: homeLeads && decided
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "shrink-0 text-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "font-mono text-lg tabular-nums",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: homeLeads && decided ? "text-fg" : "text-muted",
								children: formatPts(pair.home.points, 1)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mx-1 text-faint",
								children: "–"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: !homeLeads && decided ? "text-fg" : "text-muted",
								children: formatPts(away?.points ?? 0, 1)
							})
						]
					})
				}),
				away ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Side, {
					side: away,
					align: "right",
					leading: !homeLeads && decided
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex-1 text-right text-sm text-faint",
					children: "Bye"
				})
			]
		})
	});
}
function StandingsPage() {
	const { leagueId } = Route$8.useParams();
	const league = useQuery({
		queryKey: ["league", leagueId],
		queryFn: () => getLeagueBundle({ data: { leagueId } }),
		refetchInterval: (q) => q.state.data?.scoringLive ? 15e3 : false
	});
	const week = league.data?.currentWeek ?? 1;
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
		refetchInterval: () => league.data?.scoringLive ? 15e3 : false
	});
	if (league.isLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-2",
		children: Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-12" }, i))
	});
	if (!league.data) return null;
	const playoff = league.data.league.settings.playoff_teams ?? 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-10 lg:grid-cols-[1.15fr_0.85fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-2xl",
				children: "Standings"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 overflow-x-auto rounded-xl bg-surface shadow-[var(--shadow-border)]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[520px] text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "font-mono text-[11px] uppercase tracking-wide text-faint",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-line",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-3 text-left font-medium",
									children: "#"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-2 py-3 text-left font-medium",
									children: "Team"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-3 text-right font-medium",
									children: "W–L"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-3 text-right font-medium",
									children: "PF"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-3 text-right font-medium",
									children: "PA"
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: league.data.standings.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-line last:border-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2.5 font-mono text-xs text-faint",
								children: i + 1
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-2.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: "/league/$leagueId/team/$rosterId",
									params: {
										leagueId,
										rosterId: String(row.rosterId)
									},
									className: "flex items-center gap-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "grid size-8 place-items-center overflow-hidden rounded-full bg-raised text-[11px]",
										children: row.avatar ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
											src: row.avatar,
											alt: "",
											className: "size-full object-cover"
										}) : initials(row.teamName)
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "block",
										children: row.teamName
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "block font-mono text-[11px] text-faint",
										children: row.manager
									})] })]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2.5 text-right font-mono tabular-nums",
								children: fmtRecord(row.wins, row.losses, row.ties)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2.5 text-right font-mono tabular-nums",
								children: formatPts(row.pf, 1)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2.5 text-right font-mono tabular-nums text-muted",
								children: formatPts(row.pa, 1)
							})
						]
					}, row.rosterId)) })]
				})
			}),
			playoff > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-xs text-faint",
				children: [
					"Top ",
					playoff,
					" make the dance",
					league.data.standings[playoff] ? ` · line sits under ${league.data.standings[playoff - 1]?.teamName}` : "",
					"."
				]
			}) : null
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-end justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "font-display text-2xl",
				children: ["Week ", week]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/league/$leagueId/matchups",
				params: { leagueId },
				search: { week },
				className: "text-sm text-muted hover:text-fg",
				children: "All weeks"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 space-y-2",
			children: [matchups.isLoading ? Array.from({ length: 5 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-20" }, i)) : matchups.data?.map((pair) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MatchupCard, {
				pair,
				leagueId,
				week
			}, pair.matchupId)), matchups.data && matchups.data.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "No matchups posted for this week."
			}) : null]
		})] })]
	});
}
//#endregion
export { StandingsPage as component };
