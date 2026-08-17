import { r as createServerFn } from "./ssr.mjs";
import { n as optionalAuthMiddleware, t as authMiddleware } from "./middleware-CTZthXfq.mjs";
import { _n as record, hn as object, ln as array, mn as number, sn as _enum, un as boolean, vn as string } from "../_libs/@better-auth/core+[...].mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/fns-B6GvjWzs.js
var listMyLeagues_createServerFn_handler = createServerRpc({
	id: "d62b67d4f0685f7ffadcafcbe056f57123fb98379940090602a845a6a7fe7eab",
	name: "listMyLeagues",
	filename: "src/lib/league/fns.ts"
}, (opts) => listMyLeagues.__executeServer(opts));
var listMyLeagues = createServerFn({ method: "GET" }).middleware([optionalAuthMiddleware]).handler(listMyLeagues_createServerFn_handler, async ({ context }) => {
	if (!context.userId) return [];
	return (await import("./engine.server-DxLAl_HW.mjs")).listMyLeagues(context.userId);
});
var createLeague_createServerFn_handler = createServerRpc({
	id: "d9a79c8160edb89d53bee9baea6e6377dded7eff684b9fe8e4fa4818dfd260a5",
	name: "createLeague",
	filename: "src/lib/league/fns.ts"
}, (opts) => createLeague.__executeServer(opts));
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
})).handler(createLeague_createServerFn_handler, async ({ context, data }) => {
	return (await import("./engine.server-DxLAl_HW.mjs")).createLeague({
		userId: context.userId,
		...data
	});
});
var joinLeague_createServerFn_handler = createServerRpc({
	id: "05bf9bc709275dde1c8fcc96f5ca0d853e7746baa31ea7d808f00b51655e84f9",
	name: "joinLeague",
	filename: "src/lib/league/fns.ts"
}, (opts) => joinLeague.__executeServer(opts));
var joinLeague = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	code: string(),
	teamName: string()
})).handler(joinLeague_createServerFn_handler, async ({ context, data }) => {
	return (await import("./engine.server-DxLAl_HW.mjs")).joinLeague(context.userId, data.code, data.teamName);
});
var getDraft_createServerFn_handler = createServerRpc({
	id: "7ac9726c429d23949a7df669cc6b08a90ad6224644b08c763ab609084799e9a8",
	name: "getDraft",
	filename: "src/lib/league/fns.ts"
}, (opts) => getDraft.__executeServer(opts));
var getDraft = createServerFn({ method: "GET" }).middleware([optionalAuthMiddleware]).validator(object({
	leagueId: string(),
	position: string(),
	query: string()
})).handler(getDraft_createServerFn_handler, async ({ context, data }) => {
	const eng = await import("./engine.server-DxLAl_HW.mjs");
	await eng.ensureDemo();
	await eng.flushHousePicks(data.leagueId);
	return eng.loadDraft(data.leagueId, context.userId, data.position, data.query);
});
var startDraft_createServerFn_handler = createServerRpc({
	id: "106688d803e1ffd7271f47dfa61f2b06cc99c6261429f7c34c498fc3fd94f33c",
	name: "startDraft",
	filename: "src/lib/league/fns.ts"
}, (opts) => startDraft.__executeServer(opts));
var startDraft = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ leagueId: string() })).handler(startDraft_createServerFn_handler, async ({ context, data }) => {
	await (await import("./engine.server-DxLAl_HW.mjs")).startDraft(context.userId, data.leagueId);
	return { ok: true };
});
var makePick_createServerFn_handler = createServerRpc({
	id: "4d84cca7dc9e2f32e9f7495e7659fdb611ae6100d300483a680b01cfe40b2930",
	name: "makePick",
	filename: "src/lib/league/fns.ts"
}, (opts) => makePick.__executeServer(opts));
var makePick = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	playerId: string()
})).handler(makePick_createServerFn_handler, async ({ context, data }) => {
	await (await import("./engine.server-DxLAl_HW.mjs")).makePick(context.userId, data.leagueId, data.playerId);
	return { ok: true };
});
var autoFillDraft_createServerFn_handler = createServerRpc({
	id: "7eb1994a8e8ecd76f09a9f9b8ca1ce31403d487470d11e429fea45b9189e1e4f",
	name: "autoFillDraft",
	filename: "src/lib/league/fns.ts"
}, (opts) => autoFillDraft.__executeServer(opts));
var autoFillDraft = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ leagueId: string() })).handler(autoFillDraft_createServerFn_handler, async ({ context, data }) => {
	await (await import("./engine.server-DxLAl_HW.mjs")).autoFillDraft(context.userId, data.leagueId);
	return { ok: true };
});
var startPlayer_createServerFn_handler = createServerRpc({
	id: "5003d58eb2fe8c41aa44663846ef2cd0976d9685eced56f262d654feb60c49bd",
	name: "startPlayer",
	filename: "src/lib/league/fns.ts"
}, (opts) => startPlayer.__executeServer(opts));
var startPlayer = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	playerId: string()
})).handler(startPlayer_createServerFn_handler, async ({ context, data }) => {
	await (await import("./engine.server-DxLAl_HW.mjs")).startPlayer(context.userId, data.leagueId, data.playerId);
	return { ok: true };
});
var sitPlayer_createServerFn_handler = createServerRpc({
	id: "496ea88571271a9c38c6da3dabce45ca3a8c46e5f44ca7b6d1b7a6ebbc7114ec",
	name: "sitPlayer",
	filename: "src/lib/league/fns.ts"
}, (opts) => sitPlayer.__executeServer(opts));
var sitPlayer = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	playerId: string()
})).handler(sitPlayer_createServerFn_handler, async ({ context, data }) => {
	await (await import("./engine.server-DxLAl_HW.mjs")).sitPlayer(context.userId, data.leagueId, data.playerId);
	return { ok: true };
});
var addDrop_createServerFn_handler = createServerRpc({
	id: "d42cfd3423aa883b8f69c0e8a710dc5650fb2348ef6345768aeb4040ed00d7b4",
	name: "addDrop",
	filename: "src/lib/league/fns.ts"
}, (opts) => addDrop.__executeServer(opts));
var addDrop = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	addId: string(),
	dropId: string().nullable(),
	bid: number().optional()
})).handler(addDrop_createServerFn_handler, async ({ context, data }) => {
	return (await import("./engine.server-DxLAl_HW.mjs")).addDrop(context.userId, data.leagueId, data.addId, data.dropId, data.bid ?? 0);
});
var previewImport_createServerFn_handler = createServerRpc({
	id: "af7c4e21111d88cf29313a637b4ad9e16b6511a6c8036836d71a7193e3d01776",
	name: "previewImport",
	filename: "src/lib/league/fns.ts"
}, (opts) => previewImport.__executeServer(opts));
var previewImport = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(object({ sleeperId: string() })).handler(previewImport_createServerFn_handler, async ({ data }) => {
	return (await import("./engine.server-DxLAl_HW.mjs")).previewSleeperImport(data.sleeperId);
});
var importLeague_createServerFn_handler = createServerRpc({
	id: "cfd45bee95c96a29530714c9d4943a6568fa687cad26b49175775db4d2ccd517",
	name: "importLeague",
	filename: "src/lib/league/fns.ts"
}, (opts) => importLeague.__executeServer(opts));
var importLeague = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	sleeperId: string(),
	claimRosterId: number().nullable()
})).handler(importLeague_createServerFn_handler, async ({ context, data }) => {
	return (await import("./engine.server-DxLAl_HW.mjs")).importSleeperLeague({
		userId: context.userId,
		sleeperId: data.sleeperId,
		claimRosterId: data.claimRosterId
	});
});
var previewEspn_createServerFn_handler = createServerRpc({
	id: "e5bd684966d224ad466b14948cea5a1ce149081cf81c1d67332761c4116b134d",
	name: "previewEspn",
	filename: "src/lib/league/fns.ts"
}, (opts) => previewEspn.__executeServer(opts));
var previewEspn = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	season: string(),
	swid: string().optional(),
	espnS2: string().optional()
})).handler(previewEspn_createServerFn_handler, async ({ data }) => {
	return (await import("./engine.server-DxLAl_HW.mjs")).previewEspnImport({
		leagueId: data.leagueId,
		season: data.season,
		swid: data.swid || void 0,
		espnS2: data.espnS2 || void 0
	});
});
var importEspn_createServerFn_handler = createServerRpc({
	id: "c053e772e580eb378e4a88e3fee92be2ec1ba22c827abc973e448d072261baf3",
	name: "importEspn",
	filename: "src/lib/league/fns.ts"
}, (opts) => importEspn.__executeServer(opts));
var importEspn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	season: string(),
	claimRosterId: number().nullable(),
	swid: string().optional(),
	espnS2: string().optional()
})).handler(importEspn_createServerFn_handler, async ({ context, data }) => {
	return (await import("./engine.server-DxLAl_HW.mjs")).importEspnLeague({
		userId: context.userId,
		...data
	});
});
var previewRebuild_createServerFn_handler = createServerRpc({
	id: "82ee8b4f5cdcda0db0b6196c146857850b4e339d51d4fd219c63d380c6e75aaf",
	name: "previewRebuild",
	filename: "src/lib/league/fns.ts"
}, (opts) => previewRebuild.__executeServer(opts));
var previewRebuild = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	paste: string(),
	name: string(),
	season: string(),
	scoring: _enum([
		"ppr",
		"half",
		"std"
	])
})).handler(previewRebuild_createServerFn_handler, async ({ data }) => {
	return (await import("./engine.server-DxLAl_HW.mjs")).previewRebuild(data);
});
var importRebuild_createServerFn_handler = createServerRpc({
	id: "358edc7eab8e413538a0885eefd6a29a3b06ce0f25f320293f272f309a2e6678",
	name: "importRebuild",
	filename: "src/lib/league/fns.ts"
}, (opts) => importRebuild.__executeServer(opts));
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
})).handler(importRebuild_createServerFn_handler, async ({ context, data }) => {
	return (await import("./engine.server-DxLAl_HW.mjs")).importRebuild({
		userId: context.userId,
		...data
	});
});
var getSettings_createServerFn_handler = createServerRpc({
	id: "62f2643322491038915e7b3c7ccd1f99cc5e976d843d3d0717c7ccbea3f92c52",
	name: "getSettings",
	filename: "src/lib/league/fns.ts"
}, (opts) => getSettings.__executeServer(opts));
var getSettings = createServerFn({ method: "GET" }).middleware([optionalAuthMiddleware]).validator(object({ leagueId: string() })).handler(getSettings_createServerFn_handler, async ({ context, data }) => {
	return (await import("./engine.server-DxLAl_HW.mjs")).loadSettings(data.leagueId, context.userId);
});
var saveSettings_createServerFn_handler = createServerRpc({
	id: "bc0503ba3f0151124b3d9ba7d8f8f974bad3f9cf6b1456eba24397dc3ca9b076",
	name: "saveSettings",
	filename: "src/lib/league/fns.ts"
}, (opts) => saveSettings.__executeServer(opts));
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
})).handler(saveSettings_createServerFn_handler, async ({ context, data }) => {
	await (await import("./engine.server-DxLAl_HW.mjs")).saveSettings(context.userId, data.leagueId, data);
	return { ok: true };
});
var claimRoster_createServerFn_handler = createServerRpc({
	id: "bbf7d159263ef19db1e83e13183ebe08e82cf0089667f825606e594ee37471f8",
	name: "claimRoster",
	filename: "src/lib/league/fns.ts"
}, (opts) => claimRoster.__executeServer(opts));
var claimRoster = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	rosterId: number()
})).handler(claimRoster_createServerFn_handler, async ({ context, data }) => {
	await (await import("./engine.server-DxLAl_HW.mjs")).claimRoster(context.userId, data.leagueId, data.rosterId);
	return { ok: true };
});
var getClaims_createServerFn_handler = createServerRpc({
	id: "d6f75319514d37b3e5f30310b895d9cbf0d363087b445d0977a4bd55796a8aca",
	name: "getClaims",
	filename: "src/lib/league/fns.ts"
}, (opts) => getClaims.__executeServer(opts));
var getClaims = createServerFn({ method: "GET" }).middleware([optionalAuthMiddleware]).validator(object({ leagueId: string() })).handler(getClaims_createServerFn_handler, async ({ context, data }) => {
	const ops = await import("./ops.server-BA_UgRzY.mjs");
	const bundle = await (await import("./engine.server-DxLAl_HW.mjs")).loadLeagueBundle(data.leagueId, context.userId);
	return ops.listClaims(data.leagueId, bundle.myRosterId);
});
var cancelClaim_createServerFn_handler = createServerRpc({
	id: "5ad81617a64cf2057e3b2f071fc714628620f3b2febad0f34ec25bae591d948f",
	name: "cancelClaim",
	filename: "src/lib/league/fns.ts"
}, (opts) => cancelClaim.__executeServer(opts));
var cancelClaim = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	claimId: string()
})).handler(cancelClaim_createServerFn_handler, async ({ context, data }) => {
	await (await import("./ops.server-BA_UgRzY.mjs")).cancelClaim(context.userId, data.leagueId, data.claimId);
	return { ok: true };
});
var processWaivers_createServerFn_handler = createServerRpc({
	id: "3ce4441821bab26754777ba9f9101368d4c6fcc9bdd2f69f001371c81f795f9c",
	name: "processWaivers",
	filename: "src/lib/league/fns.ts"
}, (opts) => processWaivers.__executeServer(opts));
var processWaivers = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ leagueId: string() })).handler(processWaivers_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops.server-BA_UgRzY.mjs")).commishProcessWaivers(context.userId, data.leagueId);
});
var advanceWeek_createServerFn_handler = createServerRpc({
	id: "44af465149938d5a88d905808ac7508dd02bb97afc9a4595eaacdf8d5aff4786",
	name: "advanceWeek",
	filename: "src/lib/league/fns.ts"
}, (opts) => advanceWeek.__executeServer(opts));
var advanceWeek = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ leagueId: string() })).handler(advanceWeek_createServerFn_handler, async ({ context, data }) => {
	await (await import("./ops.server-BA_UgRzY.mjs")).commishAdvance(context.userId, data.leagueId);
	return { ok: true };
});
var getTrades_createServerFn_handler = createServerRpc({
	id: "c5aebe267e4c453655e0fc779e187a16eac86b5a2f1c963108178986ee3eb8b0",
	name: "getTrades",
	filename: "src/lib/league/fns.ts"
}, (opts) => getTrades.__executeServer(opts));
var getTrades = createServerFn({ method: "GET" }).middleware([optionalAuthMiddleware]).validator(object({ leagueId: string() })).handler(getTrades_createServerFn_handler, async ({ data }) => {
	return (await import("./ops.server-BA_UgRzY.mjs")).listTrades(data.leagueId);
});
var getTradablePicks_createServerFn_handler = createServerRpc({
	id: "ee81a1f246a6f23a80264c86ee67a6b1b735d88e41c2dea964f76e60fd69e691",
	name: "getTradablePicks",
	filename: "src/lib/league/fns.ts"
}, (opts) => getTradablePicks.__executeServer(opts));
var getTradablePicks = createServerFn({ method: "GET" }).middleware([optionalAuthMiddleware]).validator(object({ leagueId: string() })).handler(getTradablePicks_createServerFn_handler, async ({ data }) => {
	return (await import("./ops.server-BA_UgRzY.mjs")).listTradablePicks(data.leagueId);
});
var proposeTrade_createServerFn_handler = createServerRpc({
	id: "b6b28189d15d66182ccc8944f2da9f5247fdd8eb5405e290775cea5912618e73",
	name: "proposeTrade",
	filename: "src/lib/league/fns.ts"
}, (opts) => proposeTrade.__executeServer(opts));
var proposeTrade = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	assets: array(object({
		fromRoster: number(),
		toRoster: number(),
		kind: _enum(["player", "pick"]),
		playerId: string().nullable().optional(),
		pickNo: number().nullable().optional()
	}))
})).handler(proposeTrade_createServerFn_handler, async ({ context, data }) => {
	return (await import("./ops.server-BA_UgRzY.mjs")).proposeTrade(context.userId, data.leagueId, data.assets);
});
var voteTrade_createServerFn_handler = createServerRpc({
	id: "5073fe3023e5c219ac60dbc34e21e55fde4f5d881b4c2f8483b9e5b50f7c3129",
	name: "voteTrade",
	filename: "src/lib/league/fns.ts"
}, (opts) => voteTrade.__executeServer(opts));
var voteTrade = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	tradeId: string(),
	accept: boolean()
})).handler(voteTrade_createServerFn_handler, async ({ context, data }) => {
	await (await import("./ops.server-BA_UgRzY.mjs")).voteTrade(context.userId, data.leagueId, data.tradeId, data.accept);
	return { ok: true };
});
var cancelTradeFn_createServerFn_handler = createServerRpc({
	id: "3275c95e068703ebe9597affef712acd06e830f4a26574c7621668149db8ce49",
	name: "cancelTradeFn",
	filename: "src/lib/league/fns.ts"
}, (opts) => cancelTradeFn.__executeServer(opts));
var cancelTradeFn = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	leagueId: string(),
	tradeId: string()
})).handler(cancelTradeFn_createServerFn_handler, async ({ context, data }) => {
	await (await import("./ops.server-BA_UgRzY.mjs")).cancelTrade(context.userId, data.leagueId, data.tradeId);
	return { ok: true };
});
//#endregion
export { addDrop_createServerFn_handler, advanceWeek_createServerFn_handler, autoFillDraft_createServerFn_handler, cancelClaim_createServerFn_handler, cancelTradeFn_createServerFn_handler, claimRoster_createServerFn_handler, createLeague_createServerFn_handler, getClaims_createServerFn_handler, getDraft_createServerFn_handler, getSettings_createServerFn_handler, getTradablePicks_createServerFn_handler, getTrades_createServerFn_handler, importEspn_createServerFn_handler, importLeague_createServerFn_handler, importRebuild_createServerFn_handler, joinLeague_createServerFn_handler, listMyLeagues_createServerFn_handler, makePick_createServerFn_handler, previewEspn_createServerFn_handler, previewImport_createServerFn_handler, previewRebuild_createServerFn_handler, processWaivers_createServerFn_handler, proposeTrade_createServerFn_handler, saveSettings_createServerFn_handler, sitPlayer_createServerFn_handler, startDraft_createServerFn_handler, startPlayer_createServerFn_handler, voteTrade_createServerFn_handler };
