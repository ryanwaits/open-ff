import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { a as require_jsx_runtime, i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { f as getTeam, i as getLeagueBundle } from "./fns-Dq4AGxFm.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { i as Route$2 } from "./router-Day2r6gT.mjs";
import { t as cn } from "./utils-B7rbOnud.mjs";
import { t as Badge } from "./badge-DJUSvdKs.mjs";
import { t as Button } from "./button-i2bFG7DG.mjs";
import { C as proposeTrade, O as voteTrade, a as cancelTradeFn, d as getTradablePicks, f as getTrades } from "./fns-DTtAXaEu.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/trades-Bt_cIkKW.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function TradesPage() {
	const { leagueId } = Route$2.useParams();
	const qc = useQueryClient();
	const league = useQuery({
		queryKey: ["league", leagueId],
		queryFn: () => getLeagueBundle({ data: { leagueId } })
	});
	const trades = useQuery({
		queryKey: ["trades", leagueId],
		queryFn: () => getTrades({ data: { leagueId } })
	});
	const picks = useQuery({
		queryKey: ["picks", leagueId],
		queryFn: () => getTradablePicks({ data: { leagueId } }),
		enabled: Boolean(league.data?.hosted)
	});
	const mineId = league.data?.myRosterId;
	const standings = league.data?.standings ?? [];
	const partners = standings.filter((s) => s.rosterId !== mineId);
	const [partnerId, setPartnerId] = (0, import_react.useState)(null);
	const [thirdId, setThirdId] = (0, import_react.useState)(null);
	const them = partnerId ?? partners[0]?.rosterId ?? null;
	const [minePlayers, setMinePlayers] = (0, import_react.useState)([]);
	const [themPlayers, setThemPlayers] = (0, import_react.useState)([]);
	const [thirdPlayers, setThirdPlayers] = (0, import_react.useState)([]);
	const [minePicks, setMinePicks] = (0, import_react.useState)([]);
	const [themPicks, setThemPicks] = (0, import_react.useState)([]);
	const [thirdPicks, setThirdPicks] = (0, import_react.useState)([]);
	const [mineTo, setMineTo] = (0, import_react.useState)(null);
	const [themTo, setThemTo] = (0, import_react.useState)(null);
	const [thirdTo, setThirdTo] = (0, import_react.useState)(null);
	const involved = (0, import_react.useMemo)(() => {
		const ids = [
			mineId,
			them,
			thirdId
		].filter((n) => n != null);
		return standings.filter((s) => ids.includes(s.rosterId));
	}, [
		mineId,
		them,
		thirdId,
		standings
	]);
	const mineTeam = useQuery({
		queryKey: [
			"team",
			leagueId,
			mineId,
			league.data?.currentWeek
		],
		queryFn: () => getTeam({ data: {
			leagueId,
			rosterId: mineId,
			week: league.data.currentWeek
		} }),
		enabled: Boolean(mineId && league.data?.hosted && !league.data.locked)
	});
	const themTeam = useQuery({
		queryKey: [
			"team",
			leagueId,
			them,
			league.data?.currentWeek
		],
		queryFn: () => getTeam({ data: {
			leagueId,
			rosterId: them,
			week: league.data.currentWeek
		} }),
		enabled: Boolean(them && league.data)
	});
	const thirdTeam = useQuery({
		queryKey: [
			"team",
			leagueId,
			thirdId,
			league.data?.currentWeek
		],
		queryFn: () => getTeam({ data: {
			leagueId,
			rosterId: thirdId,
			week: league.data.currentWeek
		} }),
		enabled: Boolean(thirdId && league.data)
	});
	const myPicks = (0, import_react.useMemo)(() => (picks.data ?? []).filter((p) => p.rosterId === mineId), [picks.data, mineId]);
	const theirPicks = (0, import_react.useMemo)(() => (picks.data ?? []).filter((p) => p.rosterId === them), [picks.data, them]);
	const thirdPickList = (0, import_react.useMemo)(() => (picks.data ?? []).filter((p) => p.rosterId === thirdId), [picks.data, thirdId]);
	function nameOf(id) {
		if (id == null) return "—";
		return standings.find((s) => s.rosterId === id)?.teamName ?? `Team ${id}`;
	}
	function invalidate() {
		qc.invalidateQueries({ queryKey: ["trades", leagueId] });
		qc.invalidateQueries({ queryKey: ["picks", leagueId] });
		qc.invalidateQueries({ queryKey: ["team", leagueId] });
		qc.invalidateQueries({ queryKey: ["league", leagueId] });
		qc.invalidateQueries({ queryKey: ["draft", leagueId] });
	}
	const send = useMutation({
		mutationFn: async () => {
			if (!mineId || !them) throw new Error("Pick a partner.");
			const destMine = mineTo ?? them;
			const destThem = themTo ?? mineId;
			const destThird = thirdTo ?? mineId;
			const sides = [{
				rosterId: mineId,
				sendTo: destMine,
				players: minePlayers,
				picks: minePicks
			}, {
				rosterId: them,
				sendTo: destThem,
				players: themPlayers,
				picks: themPicks
			}];
			if (thirdId) sides.push({
				rosterId: thirdId,
				sendTo: destThird,
				players: thirdPlayers,
				picks: thirdPicks
			});
			const assets = [];
			for (const side of sides) {
				if (side.sendTo === side.rosterId) throw new Error("A side is sending to itself.");
				for (const id of side.players) assets.push({
					fromRoster: side.rosterId,
					toRoster: side.sendTo,
					kind: "player",
					playerId: id
				});
				for (const n of side.picks) assets.push({
					fromRoster: side.rosterId,
					toRoster: side.sendTo,
					kind: "pick",
					pickNo: n
				});
			}
			if (!assets.length) throw new Error("Add a player or unused pick.");
			return proposeTrade({ data: {
				leagueId,
				assets
			} });
		},
		onSuccess: () => {
			toast("Trade proposed.");
			setMinePlayers([]);
			setThemPlayers([]);
			setThirdPlayers([]);
			setMinePicks([]);
			setThemPicks([]);
			setThirdPicks([]);
			invalidate();
		},
		onError: (e) => toast(e instanceof Error ? e.message : "Could not propose")
	});
	const vote = useMutation({
		mutationFn: (input) => voteTrade({ data: {
			leagueId,
			...input
		} }),
		onSuccess: invalidate,
		onError: (e) => toast(e instanceof Error ? e.message : "Could not vote")
	});
	const pull = useMutation({
		mutationFn: (tradeId) => cancelTradeFn({ data: {
			leagueId,
			tradeId
		} }),
		onSuccess: invalidate,
		onError: (e) => toast(e instanceof Error ? e.message : "Could not cancel")
	});
	function toggle(list, set, v) {
		set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
	}
	if (!league.data?.hosted) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Trades live on hosted Ledger leagues."
	});
	const preDraft = league.data.draftStatus === "pending" || league.data.draftStatus === "live";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "max-w-xl text-sm text-muted",
				children: [
					preDraft ? "Draft hasn't happened yet — trade unused picks now. Your first for their first and second, dump a last-rounder, three-teamers. Ownership moves on the board immediately once everyone accepts." : "Swap players and unused draft picks. Two teams or three. Everyone in the deal has to accept.",
					" ",
					"Deadline week ",
					league.data.ops?.tradeDeadlineWeek ?? 11,
					"."
				]
			}),
			mineId && !league.data.locked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
						children: "Propose"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted",
						children: "Partner"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 flex flex-wrap gap-2",
						children: partners.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								setPartnerId(p.rosterId);
								if (thirdId === p.rosterId) setThirdId(null);
							},
							className: cn("h-10 rounded-sm px-3 text-sm", them === p.rosterId ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
							children: p.teamName
						}, p.rosterId))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 grid gap-6 lg:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetCol, {
							title: "You send",
							sendTo: mineTo ?? them,
							destinations: involved.filter((s) => s.rosterId !== mineId),
							onDest: (id) => setMineTo(id),
							destLabel: nameOf(mineTo ?? them),
							players: mineTeam.data?.players ?? [],
							picks: myPicks,
							selectedPlayers: minePlayers,
							selectedPicks: minePicks,
							onPlayer: (id) => toggle(minePlayers, setMinePlayers, id),
							onPick: (n) => toggle(minePicks, setMinePicks, n)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetCol, {
							title: `${nameOf(them)} sends`,
							sendTo: themTo ?? mineId,
							destinations: involved.filter((s) => s.rosterId !== them),
							onDest: (id) => setThemTo(id),
							destLabel: nameOf(themTo ?? mineId),
							players: themTeam.data?.players ?? [],
							picks: theirPicks,
							selectedPlayers: themPlayers,
							selectedPicks: themPicks,
							onPlayer: (id) => toggle(themPlayers, setThemPlayers, id),
							onPick: (n) => toggle(themPicks, setThemPicks, n)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "font-mono text-[11px] uppercase text-muted hover:text-fg",
							onClick: () => setThirdId(thirdId ? null : partners.find((p) => p.rosterId !== them)?.rosterId ?? null),
							children: thirdId ? "Remove third team" : "Add a third team"
						})
					}),
					thirdId ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 space-y-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-2",
							children: partners.filter((p) => p.rosterId !== them).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setThirdId(p.rosterId),
								className: cn("h-10 rounded-sm px-3 text-sm", thirdId === p.rosterId ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
								children: p.teamName
							}, p.rosterId))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetCol, {
							title: `${nameOf(thirdId)} sends`,
							sendTo: thirdTo ?? mineId,
							destinations: involved.filter((s) => s.rosterId !== thirdId),
							onDest: (id) => setThirdTo(id),
							destLabel: nameOf(thirdTo ?? mineId),
							players: thirdTeam.data?.players ?? [],
							picks: thirdPickList,
							selectedPlayers: thirdPlayers,
							selectedPicks: thirdPicks,
							onPlayer: (id) => toggle(thirdPlayers, setThirdPlayers, id),
							onPick: (n) => toggle(thirdPicks, setThirdPicks, n)
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "mt-5",
						type: "button",
						onClick: () => send.mutate(),
						disabled: send.isPending,
						children: send.isPending ? "Sending…" : "Propose trade"
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Claim a seat to propose trades."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
				children: "Book"
			}), trades.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: "Loading…"
			}) : !trades.data?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: "No trades yet."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-2",
				children: trades.data.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: t.status === "processed" ? "win" : t.status === "proposed" ? "live" : "muted",
								children: t.status
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-faint",
								children: t.sides.map((s) => s.teamName).join(" · ")
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-2 space-y-1 text-sm",
							children: t.assets.map((a, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "text-muted",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-fg",
										children: a.fromName
									}),
									" → ",
									a.toName,
									":",
									" ",
									a.kind === "player" ? a.playerName : a.pickLabel,
									a.pos ? ` (${a.pos})` : ""
								]
							}, i))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 font-mono text-[11px] text-faint",
							children: t.sides.map((s) => `${s.teamName} ${s.accepted ? "in" : "…"}`).join(" · ")
						}),
						t.status === "proposed" && (mineId || league.data.isCommish) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex flex-wrap gap-2",
							children: [
								mineId && t.sides.some((s) => s.rosterId === mineId && !s.accepted) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									onClick: () => vote.mutate({
										tradeId: t.id,
										accept: true
									}),
									children: "Accept"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									variant: "outline",
									onClick: () => vote.mutate({
										tradeId: t.id,
										accept: false
									}),
									children: "Reject"
								})] }) : null,
								league.data.isCommish && t.sides.some((s) => s.house && !s.accepted) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									variant: "outline",
									onClick: () => vote.mutate({
										tradeId: t.id,
										accept: true
									}),
									children: "Accept for house"
								}) : null,
								t.proposerRoster === mineId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									variant: "ghost",
									onClick: () => pull.mutate(t.id),
									children: "Pull offer"
								}) : null
							]
						}) : null
					]
				}, t.id))
			})] })
		]
	});
}
function AssetCol({ title, sendTo, destinations, onDest, destLabel, players, picks, selectedPlayers, selectedPicks, onPlayer, onPick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm",
			children: title
		}),
		destinations.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-2 flex flex-wrap gap-1",
			children: destinations.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => onDest(d.rosterId),
				className: cn("h-8 rounded-sm px-2 font-mono text-[11px]", sendTo === d.rosterId ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
				children: ["to ", d.teamName]
			}, d.rosterId))
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-1 font-mono text-[11px] text-faint",
			children: ["to ", destLabel]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
			className: "mt-2 max-h-64 space-y-1 overflow-y-auto",
			children: [
				players.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onPlayer(p.player_id),
					className: cn("flex min-h-11 w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm", selectedPlayers.includes(p.player_id) ? "bg-accent text-accent-fg" : "hover:bg-raised"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: p.full_name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-[11px] opacity-70",
						children: p.position
					})]
				}) }, p.player_id)),
				picks.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onPick(p.pickNo),
					className: cn("flex min-h-11 w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm", selectedPicks.includes(p.pickNo) ? "bg-accent text-accent-fg" : "hover:bg-raised"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Pick ", p.label] }), p.via ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-mono text-[11px] opacity-70",
						children: ["via ", p.via]
					}) : null]
				}) }, p.pickNo)),
				!players.length && !picks.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-2 py-2 text-xs text-faint",
					children: "No assets yet — unused picks appear after the board is built."
				}) : null
			]
		})
	] });
}
//#endregion
export { TradesPage as component };
