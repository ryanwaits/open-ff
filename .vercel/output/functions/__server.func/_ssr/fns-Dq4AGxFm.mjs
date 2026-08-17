import { r as createServerFn } from "./ssr.mjs";
import { n as optionalAuthMiddleware } from "./middleware-CTZthXfq.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
import { hn as object, mn as number, sn as _enum, vn as string } from "../_libs/@better-auth/core+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/fns-Dq4AGxFm.js
var getPulse = createServerFn({ method: "GET" }).handler(createSsrRpc("6b4da88151370a17c3a05899b96af04fc19cc75735874dc2b7bdee99e8c96a60"));
var getScores = createServerFn({ method: "GET" }).validator(object({
	week: number().optional(),
	season: number().optional(),
	seasonType: number().optional()
})).handler(createSsrRpc("9187e372226126c960d3918cfe6f298c2a232ed885980765140dcd0290413453"));
var getLiveWire = createServerFn({ method: "GET" }).validator(object({
	week: number().optional(),
	season: number().optional(),
	kind: _enum([
		"pre",
		"regular",
		"post"
	]).optional()
})).handler(createSsrRpc("c5b4ea83df0170ff43fbb089d329a34f0cd0418bd92bb60b2e6d147908ef156a"));
var findSleeperUser = createServerFn({ method: "GET" }).validator(object({ query: string() })).handler(createSsrRpc("cfc952cdecd5bc6b1268b0635feb72791518b0fed156206be9a8eda4fbcbf12c"));
var getLeagueBundle = createServerFn({ method: "GET" }).middleware([optionalAuthMiddleware]).validator(object({ leagueId: string() })).handler(createSsrRpc("4b579abd778a668c22fe31dcafb6204c20a6213656bd80b2690485b3dc2f4d38"));
var getMatchups = createServerFn({ method: "GET" }).validator(object({
	leagueId: string(),
	week: number()
})).handler(createSsrRpc("d462b5e3dec29337524e26b0a45f17ad13faddf7d8fe055d2c4101389ec95977"));
var getTeam = createServerFn({ method: "GET" }).validator(object({
	leagueId: string(),
	rosterId: number(),
	week: number()
})).handler(createSsrRpc("baa7d841fd09c065b5beb999ef85518804a1bca62b195b1513bdb384f52bd59e"));
var getWire = createServerFn({ method: "GET" }).validator(object({
	leagueId: string(),
	position: string(),
	query: string()
})).handler(createSsrRpc("cdbde668929f11c9b809af1715c3511a9f07eed36a2103694457da0f6094d35f"));
var getActivity = createServerFn({ method: "GET" }).validator(object({
	leagueId: string(),
	week: number()
})).handler(createSsrRpc("dea222bf8f8a3c82db42b682e0a2d43aa7e7436a6b4fbb0be5a19a1c39760d79"));
var getLeaders = createServerFn({ method: "GET" }).validator(object({ position: string() })).handler(createSsrRpc("fedc540785a4dcf9ca2ae22155a966fefc11c6e615983d4507a23460bf3555d4"));
var getPlayerSearch = createServerFn({ method: "GET" }).validator(object({
	query: string(),
	position: string()
})).handler(createSsrRpc("1aeb9fa7f773ffe0653656262ff1fc62b7c9154fe19b202815c3f7bd794102cf"));
var getRecap = createServerFn({ method: "GET" }).validator(object({
	leagueId: string(),
	week: number()
})).handler(createSsrRpc("1da08a9b1a9d3c29dc69ce194df815a43856d7dc985a88ba9bbf764132bce315"));
var getSources = createServerFn({ method: "GET" }).handler(createSsrRpc("90c7415cfd2e9f8efdcd464a016365eeabcc2b49cf5c7ead3345657140a568bc"));
//#endregion
export { getLiveWire as a, getPulse as c, getSources as d, getTeam as f, getLeagueBundle as i, getRecap as l, getActivity as n, getMatchups as o, getWire as p, getLeaders as r, getPlayerSearch as s, findSleeperUser as t, getScores as u };
