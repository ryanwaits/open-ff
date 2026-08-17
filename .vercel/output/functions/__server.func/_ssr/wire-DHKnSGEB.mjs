import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { a as require_jsx_runtime, i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { f as getTeam, i as getLeagueBundle, p as getWire } from "./fns-Dq4AGxFm.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { r as Route$1 } from "./router-Day2r6gT.mjs";
import { i as formatPts, t as cn } from "./utils-B7rbOnud.mjs";
import { t as Skeleton } from "./skeleton-pEU6zdaa.mjs";
import { t as Button } from "./button-i2bFG7DG.mjs";
import { c as getClaims, i as cancelClaim, t as addDrop } from "./fns-DTtAXaEu.mjs";
import { t as PlayerCell } from "./player-cell-BS10ejnX.mjs";
import { t as Input } from "./input-Da9nFsco.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/wire-DHKnSGEB.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var POS = [
	"ALL",
	"QB",
	"RB",
	"WR",
	"TE",
	"K",
	"DEF"
];
function WirePage() {
	const { leagueId } = Route$1.useParams();
	const qc = useQueryClient();
	const [pos, setPos] = (0, import_react.useState)("ALL");
	const [q, setQ] = (0, import_react.useState)("");
	const [dropId, setDropId] = (0, import_react.useState)("");
	const [bid, setBid] = (0, import_react.useState)(1);
	const league = useQuery({
		queryKey: ["league", leagueId],
		queryFn: () => getLeagueBundle({ data: { leagueId } })
	});
	const week = league.data?.currentWeek ?? 1;
	const mineId = league.data?.myRosterId;
	const team = useQuery({
		queryKey: [
			"team",
			leagueId,
			mineId,
			week
		],
		queryFn: () => getTeam({ data: {
			leagueId,
			rosterId: mineId,
			week
		} }),
		enabled: Boolean(league.data?.hosted && mineId && !league.data.locked)
	});
	const wire = useQuery({
		queryKey: [
			"wire",
			leagueId,
			pos,
			q
		],
		queryFn: () => getWire({ data: {
			leagueId,
			position: pos,
			query: q
		} })
	});
	const claims = useQuery({
		queryKey: ["claims", leagueId],
		queryFn: () => getClaims({ data: { leagueId } }),
		enabled: Boolean(league.data?.hosted)
	});
	const drafted = league.data?.draftStatus === "complete";
	const canClaim = Boolean(league.data?.hosted && mineId && !league.data.locked) && drafted;
	const claim = useMutation({
		mutationFn: (addId) => addDrop({ data: {
			leagueId,
			addId,
			dropId: dropId || null,
			bid
		} }),
		onSuccess: (res) => {
			qc.invalidateQueries({ queryKey: ["wire", leagueId] });
			qc.invalidateQueries({ queryKey: ["team", leagueId] });
			qc.invalidateQueries({ queryKey: ["league", leagueId] });
			qc.invalidateQueries({ queryKey: ["claims", leagueId] });
			toast(res.mode === "claim" ? league.data?.ops?.waiverType === "faab" ? `Bid $${bid} in the wire.` : "Claim queued." : "Added.");
		},
		onError: (e) => toast(e instanceof Error ? e.message : "Could not claim")
	});
	const wireCopy = !league.data?.hosted ? "Everyone not on a roster, ranked by 2025 PPR. Read-only peek." : !drafted ? "The wire opens after the draft. Right now you can browse the pool; adds, drops, and FAAB start once the board is final." : league.data.ops?.waiverType === "none" ? "Free agency only. Instant add/drop. No claims queue." : league.data.ops?.waiversOpen ? league.data.ops.waiverType === "rolling" ? `Waivers are open. Claims process Wednesday in waiver order (you are #${league.data.standings.find((s) => s.rosterId === mineId)?.waiverPos ?? "—"}). After they run, leftovers are free agents.` : `Waivers are open. Bid FAAB — you have $${league.data.faabRemaining ?? 100} left. Claims process Wednesday (highest bid wins; ties go to waiver order). After that, leftover players are free agents.` : `Free agency. Instant add/drop. ${league.data.ops?.waiverType === "faab" ? `You have $${league.data.faabRemaining ?? 100} FAAB left for next week's wire.` : "Next week's wire uses rolling priority."}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "max-w-xl text-sm text-muted",
			children: wireCopy
		}),
		canClaim ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 flex flex-wrap items-end gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block max-w-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
					children: "Drop if full"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					className: "mt-1.5 h-11 w-full rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]",
					value: dropId,
					onChange: (e) => setDropId(e.target.value),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "",
						children: "No drop"
					}), team.data?.players.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: p.player_id,
						children: p.full_name
					}, p.player_id))]
				})]
			}), league.data?.ops?.waiversOpen && league.data.ops.waiverType === "faab" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
				children: "Bid $"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				className: "mt-1.5 w-24",
				type: "number",
				min: 0,
				max: league.data.faabRemaining ?? 100,
				value: bid,
				onChange: (e) => setBid(Number(e.target.value))
			})] }) : null]
		}) : null,
		claims.data?.items.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-5 space-y-2",
			children: claims.data.items.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm shadow-[var(--shadow-border)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					c.mine ? "Your" : "A",
					" claim · +",
					c.add.name,
					c.drop ? ` / −${c.drop.name}` : "",
					c.bid > 0 ? ` · $${c.bid}` : "",
					" · ",
					c.status
				] }), c.mine && c.status === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "ghost",
					onClick: () => cancelClaim({ data: {
						leagueId,
						claimId: c.id
					} }).then(() => {
						qc.invalidateQueries({ queryKey: ["claims", leagueId] });
					}),
					children: "Pull"
				}) : null]
			}, c.id))
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 flex flex-col gap-3 sm:flex-row",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Search available players",
				className: "sm:max-w-xs"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-1",
				children: POS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setPos(p),
					className: cn("h-9 rounded-sm px-3 font-mono text-xs", pos === p ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
					children: p
				}, p))
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-6 divide-y divide-line rounded-xl bg-surface shadow-[var(--shadow-border)]",
			children: wire.isLoading ? Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "p-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8" })
			}, i)) : wire.data?.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center gap-3 px-3 py-2.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "min-w-0 flex-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerCell, {
							player: p,
							compact: true
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-sm tabular-nums",
						children: formatPts(p.pts, 1)
					}),
					canClaim ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						disabled: claim.isPending,
						onClick: () => claim.mutate(p.player_id),
						children: league.data?.ops?.waiversOpen ? league.data.ops.waiverType === "faab" ? "Bid" : "Claim" : "Add"
					}) : null
				]
			}, p.player_id))
		}),
		wire.data && wire.data.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-sm text-muted",
			children: "No available players match."
		}) : null
	] });
}
//#endregion
export { WirePage as component };
