import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { b as Navigate, x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as cn } from "./utils-B7rbOnud.mjs";
import { n as useCurrentUserState, r as useLeagueStore, t as Shell } from "./shell-S-vBKzVn.mjs";
import { t as Button } from "./button-i2bFG7DG.mjs";
import { s as createLeague } from "./fns-DTtAXaEu.mjs";
import { t as Input } from "./input-Da9nFsco.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/new-BUZOXDrE.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function NewLeague() {
	const { user, isPending } = useCurrentUserState();
	const navigate = useNavigate();
	const remember = useLeagueStore((s) => s.remember);
	const [name, setName] = (0, import_react.useState)("");
	const [teamName, setTeamName] = (0, import_react.useState)("");
	const [teamCount, setTeamCount] = (0, import_react.useState)(10);
	const [scoring, setScoring] = (0, import_react.useState)("ppr");
	const [fillHouse, setFillHouse] = (0, import_react.useState)(true);
	const create = useMutation({
		mutationFn: () => createLeague({ data: {
			name,
			teamName,
			teamCount,
			scoring,
			fillHouse
		} }),
		onSuccess: (res) => {
			remember({
				leagueId: res.leagueId,
				name,
				season: "2026"
			});
			toast(`Invite code ${res.inviteCode}`);
			navigate({
				to: "/league/$leagueId/draft",
				params: { leagueId: res.leagueId }
			});
		},
		onError: (err) => {
			const msg = err instanceof Error ? err.message : "Could not create league.";
			if (msg === "Unauthorized") {
				navigate({
					to: "/login",
					search: { redirect: "/new" }
				});
				return;
			}
			toast(msg);
		}
	});
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-40 animate-pulse rounded-xl bg-surface" }) });
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, {
		to: "/login",
		search: { redirect: "/new" }
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-mono text-[11px] uppercase tracking-[0.18em] text-faint",
			children: "Open a desk"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "mt-2 font-display text-4xl tracking-tight",
			children: "New league"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 max-w-xl text-sm text-muted",
			children: "Friends sign in here — not on Sleeper. You get an invite code. Empty seats can be house clubs so you can draft tonight."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-8 max-w-lg space-y-5",
			onSubmit: (e) => {
				e.preventDefault();
				create.mutate();
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
						children: "League name"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-1.5",
						value: name,
						onChange: (e) => setName(e.target.value),
						placeholder: "The Backyard",
						required: true
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
						children: "Your team"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-1.5",
						value: teamName,
						onChange: (e) => setTeamName(e.target.value),
						placeholder: "Night Desk",
						required: true
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
					children: "Teams"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 flex gap-1",
					children: [
						8,
						10,
						12
					].map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setTeamCount(n),
						className: cn("h-10 min-w-14 rounded-sm px-3 font-mono text-sm", teamCount === n ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
						children: n
					}, n))
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
					children: "Scoring"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 flex flex-wrap gap-1",
					children: [
						["ppr", "PPR"],
						["half", "Half"],
						["std", "Standard"]
					].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setScoring(id),
						className: cn("h-10 rounded-sm px-3 font-mono text-sm", scoring === id ? "bg-accent text-accent-fg" : "bg-raised text-muted"),
						children: label
					}, id))
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-start gap-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: fillHouse,
						onChange: (e) => setFillHouse(e.target.checked),
						className: "mt-1 size-4 accent-current"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-sm",
						children: "Fill empty seats with house clubs"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-1 block text-xs text-muted",
						children: "House teams autodraft. Friends can still claim a seat with your invite code."
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						disabled: create.isPending,
						children: create.isPending ? "Opening…" : "Open the league"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/import",
						className: "text-sm text-muted hover:text-fg",
						children: "Import from Sleeper instead"
					})]
				})
			]
		})
	] });
}
//#endregion
export { NewLeague as component };
