import { f as useRouterState, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { a as Shield, n as Trophy, o as Radio, s as Newspaper, t as UserRound } from "../_libs/lucide-react.mjs";
import { t as cn } from "./utils-B7rbOnud.mjs";
import { i as signOut, t as authClient } from "./client-B9uLNJP0.mjs";
import { n as DEMO_HOSTED_NAME, t as DEMO_HOSTED_ID } from "./types-CUBoEF9H.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/shell-S-vBKzVn.js
var import_jsx_runtime = require_jsx_runtime();
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled (default) -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	const { data, isPending } = authClient.useSession();
	const user = data?.user;
	return {
		user: user ? {
			id: user.id,
			displayName: user.name ?? null,
			primaryEmail: user.email ?? null,
			profileImageUrl: user.image ?? null,
			isDevFallback: false
		} : null,
		isPending
	};
}
/**
* Convenience view of `useCurrentUserState().user` for display (e.g.
* `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
* for redirects/guards use `useCurrentUserState()` and check `isPending`.
*/
function useCurrentUser() {
	return useCurrentUserState().user;
}
/** Render children only when a user is present (real session, or the disabled-auth dev user). */
function SignedIn({ children }) {
	const { user } = useCurrentUserState();
	return user ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children }) : null;
}
/**
* Render children only once we KNOW the visitor is signed out (`isPending` has
* cleared and there is no user). Hidden while the session is still loading.
*/
function SignedOut({ children }) {
	const { user, isPending } = useCurrentUserState();
	if (isPending || user) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
/**
* Minimal signed-in identity chip + sign-out. Restyle freely (see the
* `design-ui` skill). Sign-out is only shown when auth is enabled (the
* disabled-auth dev user has nothing to sign out of).
*/
function UserButton() {
	const user = useCurrentUser();
	if (!user) return null;
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: user.profileImageUrl,
				alt: "",
				className: "h-8 w-8 rounded-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20",
				children: label.charAt(0).toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => void signOut(),
				className: "cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline",
				children: "Sign out"
			})
		]
	});
}
var useLeagueStore = create()(persist((set, get) => ({
	recent: [{
		leagueId: DEMO_HOSTED_ID,
		name: DEMO_HOSTED_NAME,
		season: "2025"
	}],
	remember: (league) => {
		set({ recent: [league, ...get().recent.filter((r) => r.leagueId !== league.leagueId)].slice(0, 8) });
	}
}), { name: "ledger-leagues" }));
var NAV = [
	{
		to: "/",
		label: "Desk",
		icon: Newspaper,
		match: (p) => p === "/"
	},
	{
		to: "/scores",
		label: "Scores",
		icon: Radio,
		match: (p) => p.startsWith("/scores")
	},
	{
		to: "/players",
		label: "Players",
		icon: Shield,
		match: (p) => p.startsWith("/players")
	}
];
function Shell({ children }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const league = useLeagueStore((s) => s.recent)[0];
	const { isPending } = useCurrentUserState();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh flex-col bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "sticky top-0 z-30 border-b border-line/80 bg-bg/90 backdrop-blur-md",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex h-14 max-w-6xl items-center gap-4 px-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/",
							className: "flex items-baseline gap-2 shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-display text-2xl leading-none tracking-tight",
								children: "Ledger"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden font-mono text-[10px] uppercase tracking-[0.18em] text-faint sm:inline",
								children: "Sunday edition"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
							className: "hidden items-center gap-1 md:flex",
							children: [
								NAV.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: item.to,
									className: cn("rounded-sm px-3 py-2 text-sm transition-colors duration-150", item.match(pathname) ? "text-fg" : "text-muted hover:text-fg"),
									children: item.label
								}, item.to)),
								league ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/league/$leagueId",
									params: { leagueId: league.leagueId },
									className: cn("rounded-sm px-3 py-2 text-sm transition-colors duration-150", pathname.startsWith("/league/") ? "text-fg" : "text-muted hover:text-fg"),
									children: "League"
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/data",
									className: cn("rounded-sm px-3 py-2 text-sm transition-colors duration-150", pathname === "/data" ? "text-fg" : "text-muted hover:text-fg"),
									children: "Data"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "ml-auto flex items-center gap-2",
							children: isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-8 animate-pulse rounded-full bg-raised" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignedIn, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignedOut, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/login",
								className: "inline-flex h-9 items-center rounded-sm px-3 text-sm text-muted hover:text-fg",
								children: "Sign in"
							}) })] })
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:pb-12",
				children
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur-md md:hidden",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto grid max-w-lg grid-cols-4 px-2 pb-[env(safe-area-inset-bottom)]",
					children: [NAV.map((item) => {
						const Icon = item.icon;
						const on = item.match(pathname);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: item.to,
							className: cn("flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]", on ? "text-fg" : "text-faint"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								className: "size-4",
								strokeWidth: 1.75
							}), item.label]
						}, item.to);
					}), league ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/league/$leagueId",
						params: { leagueId: league.leagueId },
						className: cn("flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]", pathname.startsWith("/league/") ? "text-fg" : "text-faint"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trophy, {
							className: "size-4",
							strokeWidth: 1.75
						}), "League"]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/login",
						className: "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] text-faint",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserRound, {
							className: "size-4",
							strokeWidth: 1.75
						}), "Sign in"]
					})]
				})
			})
		]
	});
}
//#endregion
export { useCurrentUserState as n, useLeagueStore as r, Shell as t };
