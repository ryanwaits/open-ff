import { n as createMiddleware } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/middleware-CTZthXfq.js
/**
* Auth middleware for server functions — the standard way to get the caller's
* verified user id. When deployed the session cookie is same-origin and rides
* along automatically. In the live preview the client also forwards the bearer
* token (partitioned cookies) via the `.client` hook below — call sites do not
* thread it themselves.
*
*   import { createServerFn } from "@tanstack/react-start";
*   import { getSql } from "@/lib/db";
*   import { authMiddleware } from "@/lib/auth/middleware";
*
*   export const listTodos = createServerFn({ method: "GET" })
*     .middleware([authMiddleware])
*     .handler(async ({ context }) => {
*       const sql = await getSql();
*       return sql`select * from todos where user_id = ${context.userId}`;
*     });
*
* Signed out (auth on — the default, including live preview) -> throws
* `UnauthorizedError` (see `verify.server.ts`). Only when auth is explicitly
* disabled (`VITE_AUTH_ENABLED=false`) does it resolve the shared dev user and
* never throw. Use it on every server function that touches per-user data, and
* scope every query by `context.userId`.
*/
var authMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
	const { getBearerToken } = await import("./client-B9uLNJP0.mjs").then((n) => n.n).then((n) => n.n);
	return next({ sendContext: { bearerToken: getBearerToken() ?? void 0 } });
}).server(async ({ next, context }) => {
	const { assertSameSiteRequest } = await import("./isolation.server-CGNg1r0B.mjs");
	const { requireUserId } = await import("./verify.server-DsMqx3CM.mjs");
	assertSameSiteRequest();
	return next({ context: { userId: await requireUserId(context.bearerToken) } });
});
/**
* Soft session — never throws. Use on public reads that personalize when
* someone is signed in (my roster, commish chrome) but still work as a guest.
*/
var optionalAuthMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
	const { getBearerToken } = await import("./client-B9uLNJP0.mjs").then((n) => n.n).then((n) => n.n);
	return next({ sendContext: { bearerToken: getBearerToken() ?? void 0 } });
}).server(async ({ next, context }) => {
	const { getSessionUser, DEV_USER_ID } = await import("./verify.server-DsMqx3CM.mjs");
	const { authConfigured } = await import("./verify.server-DsMqx3CM.mjs");
	let userId = null;
	if (!authConfigured) userId = process.env.DATABASE_URL?.trim() ? null : DEV_USER_ID;
	else userId = (await getSessionUser(context.bearerToken))?.id ?? null;
	return next({ context: { userId } });
});
//#endregion
export { optionalAuthMiddleware as n, authMiddleware as t };
