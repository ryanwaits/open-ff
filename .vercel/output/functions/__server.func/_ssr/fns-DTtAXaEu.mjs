import { r as createServerFn } from "./ssr.mjs";
import { n as optionalAuthMiddleware, t as authMiddleware } from "./middleware-CTZthXfq.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
import { _n as record, hn as object, ln as array, mn as number, sn as _enum, un as boolean, vn as string } from "../_libs/@better-auth/core+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/fns-DTtAXaEu.js
var listMyLeagues = createServerFn({ method: "GET" }).middleware([optionalAuthMiddleware]).handler(createSsrRpc("d62b67d4f0685f7ffadcafcbe056f57123fb98379940090602a845a6a7fe7eab"));
var createLeague = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	name: string(),
	teamName: string(),
	teamCount: number(),
	scoring: _enum([
		"ppr",
		"half",
		"std"
	]),
	fillHouse: boolean()
})).handler(createSsrRpc("d9a79c8160edb89d53bee9baea6e6377dded7eff684b9fe8e4fa4818dfd260a5"));
var joinLeague = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	code: string(),
	teamName: string()
})).handler(createSsrRpc("05bf9bc709275dde1c8fcc96f5ca0d853e7746baa31ea7d808f00b51655e84f9"));
var getDraft = createServerFn({ method: "GET" }).middleware([optionalAuthMiddleware]).validator(object({
	leagueId: string(),
	position: string(),
	query: string()
})).handler(createSsrRpc("7ac9726c429d23949a7df669cc6b08a90ad6224644b08c763ab609084799e9a8"));
var startDraft = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ leagueId: string() })).handler(createSsrRpc("106688d803e1ffd7271f47dfa61f2b06cc99c6261429f7c34c498fc3fd94f33c"));
var makePick = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	playerId: string()
})).handler(createSsrRpc("4d84cca7dc9e2f32e9f7495e7659fdb611ae6100d300483a680b01cfe40b2930"));
var autoFillDraft = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ leagueId: string() })).handler(createSsrRpc("7eb1994a8e8ecd76f09a9f9b8ca1ce31403d487470d11e429fea45b9189e1e4f"));
var startPlayer = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	playerId: string()
})).handler(createSsrRpc("5003d58eb2fe8c41aa44663846ef2cd0976d9685eced56f262d654feb60c49bd"));
var sitPlayer = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	playerId: string()
})).handler(createSsrRpc("496ea88571271a9c38c6da3dabce45ca3a8c46e5f44ca7b6d1b7a6ebbc7114ec"));
var addDrop = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	addId: string(),
	dropId: string().nullable(),
	bid: number().optional()
})).handler(createSsrRpc("d42cfd3423aa883b8f69c0e8a710dc5650fb2348ef6345768aeb4040ed00d7b4"));
var previewImport = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(object({ sleeperId: string() })).handler(createSsrRpc("af7c4e21111d88cf29313a637b4ad9e16b6511a6c8036836d71a7193e3d01776"));
var importLeague = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	sleeperId: string(),
	claimRosterId: number().nullable()
})).handler(createSsrRpc("cfd45bee95c96a29530714c9d4943a6568fa687cad26b49175775db4d2ccd517"));
var previewEspn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	season: string(),
	swid: string().optional(),
	espnS2: string().optional()
})).handler(createSsrRpc("e5bd684966d224ad466b14948cea5a1ce149081cf81c1d67332761c4116b134d"));
var importEspn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	season: string(),
	claimRosterId: number().nullable(),
	swid: string().optional(),
	espnS2: string().optional()
})).handler(createSsrRpc("c053e772e580eb378e4a88e3fee92be2ec1ba22c827abc973e448d072261baf3"));
var previewRebuild = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	paste: string(),
	name: string(),
	season: string(),
	scoring: _enum([
		"ppr",
		"half",
		"std"
	])
})).handler(createSsrRpc("82ee8b4f5cdcda0db0b6196c146857850b4e339d51d4fd219c63d380c6e75aaf"));
var importRebuild = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	paste: string(),
	name: string(),
	season: string(),
	scoring: _enum([
		"ppr",
		"half",
		"std"
	]),
	claimRosterId: number().nullable()
})).handler(createSsrRpc("358edc7eab8e413538a0885eefd6a29a3b06ce0f25f320293f272f309a2e6678"));
var getSettings = createServerFn({ method: "GET" }).middleware([optionalAuthMiddleware]).validator(object({ leagueId: string() })).handler(createSsrRpc("62f2643322491038915e7b3c7ccd1f99cc5e976d843d3d0717c7ccbea3f92c52"));
var saveSettings = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	name: string().optional(),
	book: record(string(), number()).optional(),
	playoffTeams: number().optional(),
	currentWeek: number().optional(),
	waiverType: string().optional(),
	faabBudget: number().optional(),
	tradeDeadlineWeek: number().optional(),
	playoffStartWeek: number().optional(),
	regularWeeks: number().optional()
})).handler(createSsrRpc("bc0503ba3f0151124b3d9ba7d8f8f974bad3f9cf6b1456eba24397dc3ca9b076"));
var claimRoster = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	rosterId: number()
})).handler(createSsrRpc("bbf7d159263ef19db1e83e13183ebe08e82cf0089667f825606e594ee37471f8"));
var getClaims = createServerFn({ method: "GET" }).middleware([optionalAuthMiddleware]).validator(object({ leagueId: string() })).handler(createSsrRpc("d6f75319514d37b3e5f30310b895d9cbf0d363087b445d0977a4bd55796a8aca"));
var cancelClaim = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	claimId: string()
})).handler(createSsrRpc("5ad81617a64cf2057e3b2f071fc714628620f3b2febad0f34ec25bae591d948f"));
var processWaivers = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ leagueId: string() })).handler(createSsrRpc("3ce4441821bab26754777ba9f9101368d4c6fcc9bdd2f69f001371c81f795f9c"));
var advanceWeek = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ leagueId: string() })).handler(createSsrRpc("44af465149938d5a88d905808ac7508dd02bb97afc9a4595eaacdf8d5aff4786"));
var getTrades = createServerFn({ method: "GET" }).middleware([optionalAuthMiddleware]).validator(object({ leagueId: string() })).handler(createSsrRpc("c5aebe267e4c453655e0fc779e187a16eac86b5a2f1c963108178986ee3eb8b0"));
var getTradablePicks = createServerFn({ method: "GET" }).middleware([optionalAuthMiddleware]).validator(object({ leagueId: string() })).handler(createSsrRpc("ee81a1f246a6f23a80264c86ee67a6b1b735d88e41c2dea964f76e60fd69e691"));
var proposeTrade = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	assets: array(object({
		fromRoster: number(),
		toRoster: number(),
		kind: _enum(["player", "pick"]),
		playerId: string().nullable().optional(),
		pickNo: number().nullable().optional()
	}))
})).handler(createSsrRpc("b6b28189d15d66182ccc8944f2da9f5247fdd8eb5405e290775cea5912618e73"));
var voteTrade = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	tradeId: string(),
	accept: boolean()
})).handler(createSsrRpc("5073fe3023e5c219ac60dbc34e21e55fde4f5d881b4c2f8483b9e5b50f7c3129"));
var cancelTradeFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	tradeId: string()
})).handler(createSsrRpc("3275c95e068703ebe9597affef712acd06e830f4a26574c7621668149db8ce49"));
//#endregion
export { proposeTrade as C, startPlayer as D, startDraft as E, voteTrade as O, processWaivers as S, sitPlayer as T, listMyLeagues as _, cancelTradeFn as a, previewImport as b, getClaims as c, getTradablePicks as d, getTrades as f, joinLeague as g, importRebuild as h, cancelClaim as i, getDraft as l, importLeague as m, advanceWeek as n, claimRoster as o, importEspn as p, autoFillDraft as r, createLeague as s, addDrop as t, getSettings as u, makePick as v, saveSettings as w, previewRebuild as x, previewEspn as y };
