import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { b as Navigate, x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as cn } from "./utils-B7rbOnud.mjs";
import { n as useCurrentUserState, r as useLeagueStore, t as Shell } from "./shell-S-vBKzVn.mjs";
import { t as Button } from "./button-i2bFG7DG.mjs";
import { b as previewImport, h as importRebuild, m as importLeague, p as importEspn, x as previewRebuild, y as previewEspn } from "./fns-DTtAXaEu.mjs";
import { t as Input } from "./input-Da9nFsco.mjs";
import { SAMPLE_REBUILD } from "./rebuild-DDdCV14e.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/import-uHexdGNo.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ImportPage() {
	const { user, isPending } = useCurrentUserState();
	const navigate = useNavigate();
	const remember = useLeagueStore((s) => s.remember);
	const [source, setSource] = (0, import_react.useState)("rebuild");
	const [leagueId, setLeagueId] = (0, import_react.useState)("");
	const [name, setName] = (0, import_react.useState)("");
	const [season, setSeason] = (0, import_react.useState)("2025");
	const [scoring, setScoring] = (0, import_react.useState)("ppr");
	const [paste, setPaste] = (0, import_react.useState)("");
	const [swid, setSwid] = (0, import_react.useState)("");
	const [espnS2, setEspnS2] = (0, import_react.useState)("");
	const [claim, setClaim] = (0, import_react.useState)(null);
	const [previewData, setPreviewData] = (0, import_react.useState)(null);
	const preview = useMutation({
		mutationFn: async () => {
			if (source === "rebuild") return previewRebuild({ data: {
				paste,
				name: name.trim() || "Rebuilt league",
				season,
				scoring
			} });
			if (source === "espn") return previewEspn({ data: {
				leagueId: leagueId.trim(),
				season,
				swid: swid.trim() || void 0,
				espnS2: espnS2.trim() || void 0
			} });
			return previewImport({ data: { sleeperId: leagueId.trim() } });
		},
		onError: (err) => toast(err instanceof Error ? err.message : "Could not read that."),
		onSuccess: (res) => {
			setPreviewData(res);
			setClaim(res.teams[0]?.rosterId ?? null);
		}
	});
	const run = useMutation({
		mutationFn: async () => {
			if (source === "rebuild") return importRebuild({ data: {
				paste,
				name: name.trim() || previewData?.name || "Rebuilt league",
				season,
				scoring,
				claimRosterId: claim
			} });
			if (source === "espn") return importEspn({ data: {
				leagueId: leagueId.trim(),
				season,
				claimRosterId: claim,
				swid: swid.trim() || void 0,
				espnS2: espnS2.trim() || void 0
			} });
			return importLeague({ data: {
				sleeperId: leagueId.trim(),
				claimRosterId: claim
			} });
		},
		onSuccess: (res) => {
			remember({
				leagueId: res.leagueId,
				name: previewData?.name ?? (name.trim() || "Imported league"),
				season: previewData?.season ?? season
			});
			toast(`Imported · invite ${res.inviteCode}`);
			navigate({
				to: "/league/$leagueId",
				params: { leagueId: res.leagueId }
			});
		},
		onError: (err) => {
			const msg = err instanceof Error ? err.message : "Import failed.";
			if (msg === "Unauthorized") {
				navigate({
					to: "/login",
					search: { redirect: "/import" }
				});
				return;
			}
			toast(msg);
		}
	});
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-40 animate-pulse rounded-xl bg-surface" }) });
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, {
		to: "/login",
		search: { redirect: "/import" }
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-mono text-[11px] uppercase tracking-[0.18em] text-faint",
			children: "Bring a league over"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "mt-2 font-display text-4xl tracking-tight",
			children: "Rebuild"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 max-w-xl text-sm text-muted",
			children: "Paste teams, records, and rosters. No ESPN cookies. Friends claim a seat here and never need the old app."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-8 flex flex-wrap gap-1",
			children: [
				["rebuild", "Paste"],
				["sleeper", "Sleeper"],
				["espn", "ESPN"]
			].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => {
					setSource(id);
					setPreviewData(null);
				},
				className: cn("h-10 rounded-sm px-4 font-mono text-sm", source === id ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
				children: label
			}, id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-6 max-w-2xl space-y-4",
			onSubmit: (e) => {
				e.preventDefault();
				preview.mutate();
			},
			children: [
				source === "rebuild" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-[1fr_auto]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
								children: "League name"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								className: "mt-1.5",
								value: name,
								onChange: (e) => setName(e.target.value),
								placeholder: "Thursday Night Lights"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
							children: "Season"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1.5 flex gap-1",
							children: ["2025", "2026"].map((y) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setSeason(y),
								className: cn("h-10 min-w-16 rounded-sm px-3 font-mono text-sm", season === y ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
								children: y
							}, y))
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
						children: "Scoring"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1.5 flex flex-wrap gap-1",
						children: [
							["ppr", "PPR"],
							["half", "Half"],
							["std", "Std"]
						].map(([id, lab]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setScoring(id),
							className: cn("h-10 rounded-sm px-3 font-mono text-sm", scoring === id ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
							children: lab
						}, id))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
								children: "Teams · one block each"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "font-mono text-[11px] uppercase text-muted hover:text-fg",
								onClick: () => setPaste(SAMPLE_REBUILD),
								children: "Load sample"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							className: "mt-1.5 min-h-64 w-full rounded-md border-0 bg-raised px-3 py-2 font-mono text-xs leading-relaxed text-fg outline-none ring-0 placeholder:text-faint",
							value: paste,
							onChange: (e) => setPaste(e.target.value),
							placeholder: `Masthead | Ryan | 8-6 | 1541.2 | 1490\nJosh Allen\nSaquon Barkley\n…\n\nNight Desk | Alex | 7-7 | 1488\nLamar Jackson`,
							required: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs leading-relaxed text-muted",
						children: [
							"Header line is ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-fg",
								children: "Team | Manager | W-L | PF | PA"
							}),
							". Players underneath, one name per line. Blank line between teams. Records are optional — leave them off to start a fresh season."
						]
					})
				] }) : null,
				source === "sleeper" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block max-w-lg",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
						children: "Sleeper league ID"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-1.5",
						value: leagueId,
						onChange: (e) => setLeagueId(e.target.value),
						placeholder: "1180228818907533312",
						required: true
					})]
				}) : null,
				source === "espn" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-lg space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
								children: "ESPN league ID or URL"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								className: "mt-1.5",
								value: leagueId,
								onChange: (e) => setLeagueId(e.target.value),
								placeholder: "fantasy.espn.com/football/league?leagueId=…",
								required: true
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
							children: "Season"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1.5 flex gap-1",
							children: ["2025", "2026"].map((y) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setSeason(y),
								className: cn("h-10 min-w-16 rounded-sm px-3 font-mono text-sm", season === y ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
								children: y
							}, y))
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "Private leagues need SWID + espn_s2, or flip the league public for one minute. Paste is simpler if you just want the names and scores."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
								children: "SWID"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								className: "mt-1.5",
								value: swid,
								onChange: (e) => setSwid(e.target.value),
								autoComplete: "off"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
								children: "espn_s2"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								className: "mt-1.5",
								value: espnS2,
								onChange: (e) => setEspnS2(e.target.value),
								autoComplete: "off"
							})]
						})
					]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					variant: "outline",
					disabled: preview.isPending,
					children: preview.isPending ? "Reading…" : "Preview"
				})
			]
		}),
		previewData ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-10 max-w-2xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
					children: [
						previewData.season,
						" · ",
						previewData.teamCount,
						" teams · ",
						previewData.scoringLabel
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-1 font-display text-3xl",
					children: previewData.name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-muted",
					children: "Claim your seat. Everyone else stays open."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-4 divide-y divide-line rounded-xl bg-surface shadow-[var(--shadow-border)]",
					children: previewData.teams.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setClaim(t.rosterId),
						className: cn("flex w-full items-center justify-between gap-3 px-4 py-3 text-left", claim === t.rosterId && "bg-raised"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block text-sm",
								children: t.teamName
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-mono text-[11px] text-faint",
								children: [
									t.manager,
									t.record ? ` · ${t.record}` : "",
									" · ",
									t.players,
									" matched",
									t.unmatched?.length ? ` · ${t.unmatched.length} missed` : ""
								]
							}),
							t.unmatched?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "mt-1 block text-[11px] text-muted",
								children: ["Couldn’t match: ", t.unmatched.join(", ")]
							}) : null
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px] uppercase text-faint",
							children: claim === t.rosterId ? "Yours" : "Open"
						})]
					}) }, t.rosterId))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						onClick: () => run.mutate(),
						disabled: run.isPending,
						children: run.isPending ? "Importing…" : "Create league"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "text-sm text-muted hover:text-fg",
						children: "Cancel"
					})]
				})
			]
		}) : null
	] });
}
//#endregion
export { ImportPage as component };
