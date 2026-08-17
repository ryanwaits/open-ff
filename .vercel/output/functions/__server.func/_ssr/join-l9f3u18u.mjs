import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { b as Navigate, x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { m as Route$16 } from "./router-Day2r6gT.mjs";
import { n as useCurrentUserState, r as useLeagueStore, t as Shell } from "./shell-S-vBKzVn.mjs";
import { t as Button } from "./button-i2bFG7DG.mjs";
import { g as joinLeague } from "./fns-DTtAXaEu.mjs";
import { t as Input } from "./input-Da9nFsco.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/join-l9f3u18u.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function JoinLeague() {
	const search = Route$16.useSearch();
	const { user, isPending } = useCurrentUserState();
	const navigate = useNavigate();
	const remember = useLeagueStore((s) => s.remember);
	const [code, setCode] = (0, import_react.useState)(search.code ?? "");
	const [teamName, setTeamName] = (0, import_react.useState)("");
	const join = useMutation({
		mutationFn: () => joinLeague({ data: {
			code,
			teamName
		} }),
		onSuccess: (res) => {
			remember({
				leagueId: res.leagueId,
				name: teamName || "My league",
				season: "2026"
			});
			navigate({
				to: "/league/$leagueId",
				params: { leagueId: res.leagueId }
			});
		},
		onError: (err) => {
			const msg = err instanceof Error ? err.message : "Could not join.";
			if (msg === "Unauthorized") {
				navigate({
					to: "/login",
					search: { redirect: "/join" }
				});
				return;
			}
			toast(msg);
		}
	});
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-40 animate-pulse rounded-xl bg-surface" }) });
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, {
		to: "/login",
		search: { redirect: "/join" }
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-mono text-[11px] uppercase tracking-[0.18em] text-faint",
			children: "Take a seat"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "mt-2 font-display text-4xl tracking-tight",
			children: "Join a league"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 max-w-xl text-sm text-muted",
			children: "Ask your commissioner for the six-character code. No Sleeper account."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-8 max-w-lg space-y-5",
			onSubmit: (e) => {
				e.preventDefault();
				join.mutate();
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
						children: "Invite code"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-1.5 uppercase tracking-[0.2em]",
						value: code,
						onChange: (e) => setCode(e.target.value.toUpperCase()),
						placeholder: "YARD26",
						required: true,
						maxLength: 8
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
						placeholder: "Rainey Street",
						required: true
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						disabled: join.isPending,
						children: join.isPending ? "Joining…" : "Claim a seat"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "text-sm text-muted hover:text-fg",
						children: "Cancel"
					})]
				})
			]
		})
	] });
}
//#endregion
export { JoinLeague as component };
