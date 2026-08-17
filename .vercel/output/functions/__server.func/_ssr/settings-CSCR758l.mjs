import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as Route$3 } from "./router-Day2r6gT.mjs";
import { t as cn } from "./utils-B7rbOnud.mjs";
import { t as Skeleton } from "./skeleton-pEU6zdaa.mjs";
import { t as Button } from "./button-i2bFG7DG.mjs";
import { S as processWaivers, n as advanceWeek, o as claimRoster, u as getSettings, w as saveSettings } from "./fns-DTtAXaEu.mjs";
import { t as Input } from "./input-Da9nFsco.mjs";
import { r as bookFromPreset, t as SCORING_FIELDS } from "./scoring-x8-F509i.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-CSCR758l.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var GROUPS = [...new Set(SCORING_FIELDS.map((f) => f.group))];
function SettingsPage() {
	const { leagueId } = Route$3.useParams();
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["settings", leagueId],
		queryFn: () => getSettings({ data: { leagueId } })
	});
	const [name, setName] = (0, import_react.useState)("");
	const [book, setBook] = (0, import_react.useState)({});
	const [playoff, setPlayoff] = (0, import_react.useState)(4);
	const [week, setWeek] = (0, import_react.useState)(1);
	const [waiverType, setWaiverType] = (0, import_react.useState)("faab");
	const [faab, setFaab] = (0, import_react.useState)(100);
	const [deadline, setDeadline] = (0, import_react.useState)(11);
	const [pStart, setPStart] = (0, import_react.useState)(15);
	const [regular, setRegular] = (0, import_react.useState)(14);
	(0, import_react.useEffect)(() => {
		if (!q.data) return;
		setName(q.data.name);
		setBook(q.data.book);
		setPlayoff(q.data.playoffTeams);
		setWeek(q.data.currentWeek);
		setWaiverType(q.data.waiverType ?? "faab");
		setFaab(q.data.faabBudget ?? 100);
		setDeadline(q.data.tradeDeadlineWeek ?? 11);
		setPStart(q.data.playoffStartWeek ?? 15);
		setRegular(q.data.regularWeeks ?? 14);
	}, [q.data]);
	const save = useMutation({
		mutationFn: () => saveSettings({ data: {
			leagueId,
			name,
			book,
			playoffTeams: playoff,
			currentWeek: week,
			waiverType,
			faabBudget: faab,
			tradeDeadlineWeek: deadline,
			playoffStartWeek: pStart,
			regularWeeks: regular
		} }),
		onSuccess: async () => {
			toast("Settings saved. Scoring applies to unlocked weeks.");
			await qc.invalidateQueries({ queryKey: ["league", leagueId] });
			await qc.invalidateQueries({ queryKey: ["settings", leagueId] });
			await qc.invalidateQueries({ queryKey: ["matchups", leagueId] });
		},
		onError: (err) => toast(err instanceof Error ? err.message : "Could not save.")
	});
	const claim = useMutation({
		mutationFn: (rosterId) => claimRoster({ data: {
			leagueId,
			rosterId
		} }),
		onSuccess: async () => {
			toast("Seat claimed.");
			await qc.invalidateQueries({ queryKey: ["league", leagueId] });
			await qc.invalidateQueries({ queryKey: ["settings", leagueId] });
		},
		onError: (err) => toast(err instanceof Error ? err.message : "Could not claim.")
	});
	const grouped = (0, import_react.useMemo)(() => {
		return GROUPS.map((g) => ({
			group: g,
			fields: SCORING_FIELDS.filter((f) => f.group === g)
		}));
	}, []);
	if (q.isLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64" });
	if (q.error || !q.data) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "text-sm text-muted",
		children: [
			"Settings live on hosted Ledger leagues.",
			" ",
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/import",
				className: "text-fg underline",
				children: "Import one"
			}),
			" ",
			"or create a desk."
		]
	});
	const locked = q.data.locked || !q.data.isCommish;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "max-w-3xl space-y-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
					children: [q.data.source === "sleeper" ? "Imported from Sleeper" : "Hosted on Ledger", q.data.sourceLeagueId ? ` · ${q.data.sourceLeagueId}` : ""]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-1 font-display text-2xl",
					children: "League"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "mt-4 block max-w-md",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
						children: "Name"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-1.5",
						value: name,
						onChange: (e) => setName(e.target.value),
						disabled: locked
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-wrap gap-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
						children: "Playoff teams"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-1.5 w-24",
						type: "number",
						min: 2,
						max: 8,
						value: playoff,
						onChange: (e) => setPlayoff(Number(e.target.value)),
						disabled: locked
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
						children: "Current week"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-1.5 w-24",
						type: "number",
						min: 1,
						max: 18,
						value: week,
						onChange: (e) => setWeek(Number(e.target.value)),
						disabled: locked
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 font-mono text-xs text-faint",
					children: ["Invite ", q.data.inviteCode]
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl",
					children: "Waivers & calendar"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: "FAAB default $100, or rolling priority, or straight free agency. Claims sit until Wednesday and clear on their own. The desk follows the NFL week — scores lock, waivers run, the next slate of matchups opens, and playoffs seed from the standings. You should not have to touch the clock after the league is uploaded."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 flex flex-wrap gap-1",
					children: [
						["faab", "FAAB"],
						["rolling", "Rolling"],
						["none", "Free agency"]
					].map(([id, lab]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: locked,
						onClick: () => setWaiverType(id),
						className: cn("h-10 rounded-sm px-3 font-mono text-sm", waiverType === id ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
						children: lab
					}, id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-wrap gap-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
							children: "FAAB $"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							className: "mt-1.5 w-24",
							type: "number",
							min: 0,
							max: 1e3,
							value: faab,
							onChange: (e) => setFaab(Number(e.target.value)),
							disabled: locked
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
							children: "Trade deadline week"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							className: "mt-1.5 w-24",
							type: "number",
							min: 1,
							max: 18,
							value: deadline,
							onChange: (e) => setDeadline(Number(e.target.value)),
							disabled: locked
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
							children: "Regular weeks"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							className: "mt-1.5 w-24",
							type: "number",
							min: 8,
							max: 17,
							value: regular,
							onChange: (e) => setRegular(Number(e.target.value)),
							disabled: locked
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
							children: "Playoffs start"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							className: "mt-1.5 w-24",
							type: "number",
							min: 12,
							max: 18,
							value: pStart,
							onChange: (e) => setPStart(Number(e.target.value)),
							disabled: locked
						})] })
					]
				}),
				q.data.isCommish && !q.data.locked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommishClock, { leagueId }) : null
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl",
					children: "Scoring"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Baseline book. Finished imported weeks keep their original scores. Live and unlocked weeks use this."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-wrap gap-1",
					children: [[
						"ppr",
						"half",
						"std"
					].map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: locked,
						onClick: () => setBook(bookFromPreset(id)),
						className: cn("h-10 rounded-sm px-3 font-mono text-sm", q.data && book.rec === bookFromPreset(id).rec && book.pass_td === 4 ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
						children: id === "ppr" ? "PPR" : id === "half" ? "Half" : "Standard"
					}, id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: locked,
						onClick: () => setBook({
							...book,
							pass_td: book.pass_td === 6 ? 4 : 6
						}),
						className: "h-10 rounded-sm bg-raised px-3 font-mono text-sm text-muted",
						children: book.pass_td === 6 ? "6pt pass TD" : "4pt pass TD"
					})]
				}),
				grouped.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
						children: g.group
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3",
						children: g.fields.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "rounded-lg bg-surface p-3 shadow-[var(--shadow-border)]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block text-xs text-muted",
								children: f.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								className: "mt-1.5 h-9",
								type: "number",
								step: f.step,
								value: book[f.key] ?? 0,
								disabled: locked,
								onChange: (e) => setBook((prev) => ({
									...prev,
									[f.key]: Number(e.target.value)
								}))
							})]
						}, f.key))
					})]
				}, g.group))
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-2xl",
				children: "Seats"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 divide-y divide-line rounded-xl bg-surface shadow-[var(--shadow-border)]",
				children: q.data.teams.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-3 px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-sm",
						children: t.teamName
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-mono text-[11px] text-faint",
						children: [t.manager, t.faab != null ? ` · $${t.faab}` : ""]
					})] }), t.open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						disabled: claim.isPending,
						onClick: () => claim.mutate(t.rosterId),
						children: "Claim"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-[11px] uppercase text-faint",
						children: "Taken"
					})]
				}, t.rosterId))
			})] }),
			q.data.isCommish && !q.data.locked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				onClick: () => save.mutate(),
				disabled: save.isPending,
				children: save.isPending ? "Saving…" : "Save settings"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: q.data.locked ? "Demo desk is locked." : "Only the commissioner can edit scoring."
			})
		]
	});
}
function CommishClock({ leagueId }) {
	const qc = useQueryClient();
	const waivers = useMutation({
		mutationFn: () => processWaivers({ data: { leagueId } }),
		onSuccess: (res) => {
			toast(`Waivers processed · ${res.awarded} awards`);
			qc.invalidateQueries({ queryKey: ["league", leagueId] });
			qc.invalidateQueries({ queryKey: ["claims", leagueId] });
			qc.invalidateQueries({ queryKey: ["wire", leagueId] });
		},
		onError: (e) => toast(e instanceof Error ? e.message : "Could not process")
	});
	const next = useMutation({
		mutationFn: () => advanceWeek({ data: { leagueId } }),
		onSuccess: () => {
			toast("Week locked and advanced.");
			qc.invalidateQueries({ queryKey: ["league", leagueId] });
			qc.invalidateQueries({ queryKey: ["matchups", leagueId] });
			qc.invalidateQueries({ queryKey: ["settings", leagueId] });
		},
		onError: (e) => toast(e instanceof Error ? e.message : "Could not advance")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-5 flex flex-wrap gap-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				variant: "outline",
				onClick: () => waivers.mutate(),
				disabled: waivers.isPending,
				children: waivers.isPending ? "Processing…" : "Process waivers now"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				variant: "outline",
				onClick: () => next.mutate(),
				disabled: next.isPending,
				children: next.isPending ? "Advancing…" : "Lock week & advance"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "basis-full text-xs text-faint",
				children: "Optional overrides. The league clock already runs waivers Wednesday and advances when the NFL week does."
			})
		]
	});
}
//#endregion
export { SettingsPage as component };
