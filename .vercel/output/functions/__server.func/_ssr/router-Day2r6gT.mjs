import { o as __toESM } from "../_runtime.mjs";
import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as useRouter, _ as createFileRoute, d as HeadContent, g as lazyRouteComponent, h as Outlet, m as createRouter, u as Scripts, v as createRootRoute } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, r as QueryClientProvider } from "../_libs/react+tanstack__react-query.mjs";
import { fn as literal, hn as object, mn as number, vn as string, yn as union } from "../_libs/@better-auth/core+[...].mjs";
import { c as getPulse } from "./fns-Dq4AGxFm.mjs";
import { n as auth } from "./server-CyhOJtFm.mjs";
import { r as TriangleAlert } from "../_libs/lucide-react.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-Day2r6gT.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-loss",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-muted",
				children: error.message || "An unexpected error occurred. Try reloading the page."
			})
		]
	});
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
/**
* Whether `origin` is a known Grok embedder. Exported for tests.
* Do not list internal staging hosts here — this file ships in download/export.
*/
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
/** Public preview zone. Staging embedders frame this host via the proxy CSP. */
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
/** Resolve the parent origin to post to, or null when the bridge must noop. */
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	const candidates = [referrer, ancestorOrigin ?? ""].filter(Boolean);
	for (const candidate of candidates) try {
		const origin = candidate.includes("://") ? new URL(candidate).origin : candidate;
		if (isGrokEmbedderOrigin(origin)) return origin;
		if (!isSandboxPreviewGuestHost(guestHostname)) continue;
		const parsed = new URL(origin.includes("://") ? origin : `https://${origin}`);
		if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.origin;
	} catch {}
	return null;
}
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	if (typeof window === "undefined") return () => {};
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	const parentOrigin = resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		if (envelope.data.type === "hello") {
			if (!HelloSchema.safeParse(event.data).success) return;
			announce();
			return;
		}
		if (envelope.data.type === "navigate") {
			const parsed = NavigateSchema.safeParse(event.data);
			if (!parsed.success) return;
			navigate(parsed.data.path);
			queueMicrotask(reportLocation);
			return;
		}
		if (envelope.data.type === "history") {
			const parsed = HistorySchema.safeParse(event.data);
			if (!parsed.success) return;
			if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
			window.history.go(parsed.data.delta);
		}
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var styles_default = "/assets/styles-EVazNp1Y.css";
var APP_NAME = "Ledger";
var Route$20 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "A custom fantasy football desk for your leagues — standings, matchups, scores, and weekly recaps."
			},
			{
				name: "apple-mobile-web-app-title",
				content: APP_NAME
			},
			{
				name: "theme-color",
				content: "#0c0c0a"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			},
			...[]
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap"
			}
		]
	}),
	component: RootDocument
});
function RootDocument() {
	const [queryClient] = (0, import_react.useState)(() => new QueryClient({ defaultOptions: { queries: {
		staleTime: 3e4,
		retry: 1,
		refetchOnWindowFocus: false
	} } }));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
				client: queryClient,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
				theme: "dark",
				position: "bottom-center",
				toastOptions: { style: {
					background: "#151512",
					color: "#f1efe6",
					border: "1px solid #2a2923"
				} }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	});
}
var $$splitComponentImporter$17 = () => import("./routes-B6eG7-NH.mjs");
var Route$19 = createFileRoute("/")({
	loader: () => getPulse(),
	component: lazyRouteComponent($$splitComponentImporter$17, "component")
});
var $$splitComponentImporter$16 = () => import("./data-CJw8kMIb.mjs");
var Route$18 = createFileRoute("/data")({ component: lazyRouteComponent($$splitComponentImporter$16, "component") });
var $$splitComponentImporter$15 = () => import("./import-uHexdGNo.mjs");
var Route$17 = createFileRoute("/import")({ component: lazyRouteComponent($$splitComponentImporter$15, "component") });
var $$splitComponentImporter$14 = () => import("./join-l9f3u18u.mjs");
var Route$16 = createFileRoute("/join")({
	validateSearch: (s) => ({ code: typeof s.code === "string" ? s.code : void 0 }),
	component: lazyRouteComponent($$splitComponentImporter$14, "component")
});
var $$splitComponentImporter$13 = () => import("./login-DOmlPNw6.mjs");
var Route$15 = createFileRoute("/login")({
	validateSearch: (s) => ({ redirect: typeof s.redirect === "string" ? s.redirect : void 0 }),
	component: lazyRouteComponent($$splitComponentImporter$13, "component")
});
var $$splitComponentImporter$12 = () => import("./new-BUZOXDrE.mjs");
var Route$14 = createFileRoute("/new")({ component: lazyRouteComponent($$splitComponentImporter$12, "component") });
var $$splitComponentImporter$11 = () => import("./players-YFfOHwwb.mjs");
var Route$13 = createFileRoute("/players")({ component: lazyRouteComponent($$splitComponentImporter$11, "component") });
var $$splitComponentImporter$10 = () => import("./scores-Bj6o7nkl.mjs");
var Route$12 = createFileRoute("/scores")({
	validateSearch: (s) => ({
		week: typeof s.week === "number" ? s.week : s.week ? Number(s.week) : void 0,
		season: typeof s.season === "number" ? s.season : s.season ? Number(s.season) : void 0,
		kind: s.kind === "pre" || s.kind === "regular" || s.kind === "post" ? s.kind : void 0
	}),
	component: lazyRouteComponent($$splitComponentImporter$10, "component")
});
var $$splitComponentImporter$9 = () => import("../_leagueId-DUjtenuT.mjs");
var Route$11 = createFileRoute("/league/$leagueId")({ component: lazyRouteComponent($$splitComponentImporter$9, "component") });
var Route$10 = createFileRoute("/api/auth/$")({ server: { handlers: {
	GET: ({ request }) => auth.handler(request),
	POST: ({ request }) => auth.handler(request)
} } });
var Route$9 = createFileRoute("/api/league/tick")({ server: { handlers: {
	GET: async () => {
		const ops = await import("./ops.server-BA_UgRzY.mjs");
		ops.startLeagueClock();
		const res = await ops.tickAllLeagues();
		return Response.json(res);
	},
	POST: async () => {
		const ops = await import("./ops.server-BA_UgRzY.mjs");
		ops.startLeagueClock();
		const res = await ops.tickAllLeagues();
		return Response.json(res);
	}
} } });
var $$splitComponentImporter$8 = () => import("../_leagueId-2uXaOTvJ.mjs");
var Route$8 = createFileRoute("/league/$leagueId/")({ component: lazyRouteComponent($$splitComponentImporter$8, "component") });
var $$splitComponentImporter$7 = () => import("./activity-D2v1PEGs.mjs");
var Route$7 = createFileRoute("/league/$leagueId/activity")({
	validateSearch: (s) => ({ week: s.week != null ? Number(s.week) : void 0 }),
	component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
var $$splitComponentImporter$6 = () => import("./draft-CM-w-LJ2.mjs");
var Route$6 = createFileRoute("/league/$leagueId/draft")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./matchups-wjnllGCC.mjs");
var Route$5 = createFileRoute("/league/$leagueId/matchups")({
	validateSearch: (s) => ({
		week: s.week != null ? Number(s.week) : void 0,
		focus: s.focus != null ? Number(s.focus) : void 0
	}),
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("./recap-DvnMRBFm.mjs");
var Route$4 = createFileRoute("/league/$leagueId/recap")({
	validateSearch: (s) => ({ week: s.week != null ? Number(s.week) : void 0 }),
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import("./settings-CSCR758l.mjs");
var Route$3 = createFileRoute("/league/$leagueId/settings")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./trades-Bt_cIkKW.mjs");
var Route$2 = createFileRoute("/league/$leagueId/trades")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./wire-DHKnSGEB.mjs");
var Route$1 = createFileRoute("/league/$leagueId/wire")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("../_rosterId-DT_dp_DR.mjs");
var Route = createFileRoute("/league/$leagueId/team/$rosterId")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var IndexRoute = Route$19.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$20
});
var DataRoute = Route$18.update({
	id: "/data",
	path: "/data",
	getParentRoute: () => Route$20
});
var ImportRoute = Route$17.update({
	id: "/import",
	path: "/import",
	getParentRoute: () => Route$20
});
var JoinRoute = Route$16.update({
	id: "/join",
	path: "/join",
	getParentRoute: () => Route$20
});
var LoginRoute = Route$15.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => Route$20
});
var NewRoute = Route$14.update({
	id: "/new",
	path: "/new",
	getParentRoute: () => Route$20
});
var PlayersRoute = Route$13.update({
	id: "/players",
	path: "/players",
	getParentRoute: () => Route$20
});
var ScoresRoute = Route$12.update({
	id: "/scores",
	path: "/scores",
	getParentRoute: () => Route$20
});
var LeagueLeagueIdRoute = Route$11.update({
	id: "/league/$leagueId",
	path: "/league/$leagueId",
	getParentRoute: () => Route$20
});
var ApiAuthSplatRoute = Route$10.update({
	id: "/api/auth/$",
	path: "/api/auth/$",
	getParentRoute: () => Route$20
});
var ApiLeagueTickRoute = Route$9.update({
	id: "/api/league/tick",
	path: "/api/league/tick",
	getParentRoute: () => Route$20
});
var LeagueLeagueIdIndexRoute = Route$8.update({
	id: "/",
	path: "/",
	getParentRoute: () => LeagueLeagueIdRoute
});
var LeagueLeagueIdRouteChildren = {
	LeagueLeagueIdActivityRoute: Route$7.update({
		id: "/activity",
		path: "/activity",
		getParentRoute: () => LeagueLeagueIdRoute
	}),
	LeagueLeagueIdDraftRoute: Route$6.update({
		id: "/draft",
		path: "/draft",
		getParentRoute: () => LeagueLeagueIdRoute
	}),
	LeagueLeagueIdMatchupsRoute: Route$5.update({
		id: "/matchups",
		path: "/matchups",
		getParentRoute: () => LeagueLeagueIdRoute
	}),
	LeagueLeagueIdRecapRoute: Route$4.update({
		id: "/recap",
		path: "/recap",
		getParentRoute: () => LeagueLeagueIdRoute
	}),
	LeagueLeagueIdSettingsRoute: Route$3.update({
		id: "/settings",
		path: "/settings",
		getParentRoute: () => LeagueLeagueIdRoute
	}),
	LeagueLeagueIdTradesRoute: Route$2.update({
		id: "/trades",
		path: "/trades",
		getParentRoute: () => LeagueLeagueIdRoute
	}),
	LeagueLeagueIdWireRoute: Route$1.update({
		id: "/wire",
		path: "/wire",
		getParentRoute: () => LeagueLeagueIdRoute
	}),
	LeagueLeagueIdIndexRoute,
	LeagueLeagueIdTeamRosterIdRoute: Route.update({
		id: "/team/$rosterId",
		path: "/team/$rosterId",
		getParentRoute: () => LeagueLeagueIdRoute
	})
};
var rootRouteChildren = {
	IndexRoute,
	DataRoute,
	ImportRoute,
	JoinRoute,
	LoginRoute,
	NewRoute,
	PlayersRoute,
	ScoresRoute,
	LeagueLeagueIdRoute: LeagueLeagueIdRoute._addFileChildren(LeagueLeagueIdRouteChildren),
	ApiAuthSplatRoute,
	ApiLeagueTickRoute
};
var routeTree = Route$20._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { Route$3 as a, Route$6 as c, Route$11 as d, Route$12 as f, Route$19 as h, Route$2 as i, Route$7 as l, Route$16 as m, Route as n, Route$4 as o, Route$15 as p, Route$1 as r, Route$5 as s, router_exports as t, Route$8 as u };
