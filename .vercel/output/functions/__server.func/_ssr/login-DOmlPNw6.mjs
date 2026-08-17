import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { x as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as GROK_PROVIDERS } from "./server-CyhOJtFm.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { p as Route$15 } from "./router-Day2r6gT.mjs";
import { r as signIn, t as authClient } from "./client-B9uLNJP0.mjs";
import { t as Button } from "./button-i2bFG7DG.mjs";
import { t as Input } from "./input-Da9nFsco.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-DOmlPNw6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Login() {
	const { redirect } = Route$15.useSearch();
	const navigate = useNavigate();
	const dest = redirect && redirect.startsWith("/") ? redirect : "/";
	const [mode, setMode] = (0, import_react.useState)("in");
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [name, setName] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function onEmail(e) {
		e.preventDefault();
		setBusy(true);
		try {
			if (mode === "up") {
				const res = await authClient.signUp.email({
					email,
					password,
					name
				});
				if (res.error) throw new Error(res.error.message ?? "Sign-up failed");
			} else {
				const res = await authClient.signIn.email({
					email,
					password
				});
				if (res.error) throw new Error(res.error.message ?? "Sign-in failed");
			}
			navigate({ to: dest });
		} catch (err) {
			toast(err instanceof Error ? err.message : "Could not sign in");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "grid min-h-dvh place-items-center bg-bg px-6 text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "font-display text-3xl tracking-tight",
					children: "Ledger"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "This is your league login — not Sleeper. Friends never need another app."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-8 space-y-2",
					children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						variant: "outline",
						className: "w-full",
						onClick: () => signIn(p.providerId, { callbackURL: dest }),
						children: ["Continue with ", p.label]
					}, p.providerId))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "mt-8 space-y-3",
					onSubmit: (e) => void onEmail(e),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-[11px] uppercase tracking-[0.16em] text-faint",
							children: mode === "up" ? "Create an account" : "Email"
						}),
						mode === "up" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: name,
							onChange: (e) => setName(e.target.value),
							placeholder: "Display name",
							required: true
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "email",
							value: email,
							onChange: (e) => setEmail(e.target.value),
							placeholder: "you@league.com",
							required: true,
							autoComplete: "email"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "password",
							value: password,
							onChange: (e) => setPassword(e.target.value),
							placeholder: "Password",
							required: true,
							minLength: 8,
							autoComplete: mode === "up" ? "new-password" : "current-password"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							className: "w-full",
							disabled: busy,
							children: busy ? "Working…" : mode === "up" ? "Create account" : "Sign in"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "text-sm text-muted hover:text-fg",
							onClick: () => setMode(mode === "up" ? "in" : "up"),
							children: mode === "up" ? "Already have an account?" : "Need an account?"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "mt-6 inline-block text-sm text-muted hover:text-fg",
					children: "Back to the desk"
				})
			]
		})
	});
}
//#endregion
export { Login as component };
