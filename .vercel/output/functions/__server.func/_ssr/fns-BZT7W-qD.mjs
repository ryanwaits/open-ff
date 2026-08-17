import { r as createServerFn } from "./ssr.mjs";
import { n as optionalAuthMiddleware } from "./middleware-CTZthXfq.mjs";
import { hn as object, mn as number, sn as _enum, vn as string } from "../_libs/@better-auth/core+[...].mjs";
import { a as isHostedLeague } from "./types-CUBoEF9H.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/fns-BZT7W-qD.js
var getPulse_createServerFn_handler = createServerRpc({
	id: "6b4da88151370a17c3a05899b96af04fc19cc75735874dc2b7bdee99e8c96a60",
	name: "getPulse",
	filename: "src/lib/data/fns.ts"
}, (opts) => getPulse.__executeServer(opts));
var getPulse = createServerFn({ method: "GET" }).handler(getPulse_createServerFn_handler, async () => {
	const sleeper = await import("./sleeper.server-Bqr0Cv6u.mjs");
	const espn = await import("./espn.server-CN-Nbyu7.mjs");
	const [state, board, news, trending] = await Promise.all([
		sleeper.fetchNflState(),
		espn.fetchScoreboard(),
		espn.fetchNews(),
		sleeper.loadTrending()
	]);
	return {
		state,
		games: board.games,
		news,
		trending
	};
});
var getScores_createServerFn_handler = createServerRpc({
	id: "9187e372226126c960d3918cfe6f298c2a232ed885980765140dcd0290413453",
	name: "getScores",
	filename: "src/lib/data/fns.ts"
}, (opts) => getScores.__executeServer(opts));
var getScores = createServerFn({ method: "GET" }).validator(object({
	week: number().optional(),
	season: number().optional(),
	seasonType: number().optional()
})).handler(getScores_createServerFn_handler, async ({ data }) => {
	return (await import("./espn.server-CN-Nbyu7.mjs")).fetchScoreboard(data);
});
var getLiveWire_createServerFn_handler = createServerRpc({
	id: "c5b4ea83df0170ff43fbb089d329a34f0cd0418bd92bb60b2e6d147908ef156a",
	name: "getLiveWire",
	filename: "src/lib/data/fns.ts"
}, (opts) => getLiveWire.__executeServer(opts));
var getLiveWire = createServerFn({ method: "GET" }).validator(object({
	week: number().optional(),
	season: number().optional(),
	kind: _enum([
		"pre",
		"regular",
		"post"
	]).optional()
})).handler(getLiveWire_createServerFn_handler, async ({ data }) => {
	const sleeper = await import("./sleeper.server-Bqr0Cv6u.mjs");
	const live = await import("./live.server-CLcpaCC2.mjs");
	const state = await sleeper.fetchNflState();
	const kind = data.kind ?? (state.season_type === "pre" || state.season_type === "post" ? state.season_type : "regular");
	const week = data.week ?? state.display_week ?? state.week;
	const season = String(data.season ?? state.season);
	const [board, pts] = await Promise.all([live.weekBoard(season, week, kind), live.fetchWeekPoints(season, week, "ppr", kind)]);
	const leaders = Object.entries(pts).map(([id, points]) => {
		const p = sleeper.getPlayer(id);
		return {
			id,
			points,
			name: p?.full_name ?? (p?.team ? `${p.team} D/ST` : id),
			pos: p?.position ?? null,
			team: p?.team ?? null,
			game: live.gameForTeam(board.index, p?.team)
		};
	}).sort((a, b) => b.points - a.points).slice(0, 16);
	return {
		asOf: Date.now(),
		week,
		season,
		kind,
		live: board.live,
		gamesIn: board.games.filter((g) => g.state === "in").length,
		gamesTotal: board.games.length,
		scoredPlayers: Object.keys(pts).length,
		leaders,
		pollMs: board.live ? 12e3 : 3e4
	};
});
var findSleeperUser_createServerFn_handler = createServerRpc({
	id: "cfc952cdecd5bc6b1268b0635feb72791518b0fed156206be9a8eda4fbcbf12c",
	name: "findSleeperUser",
	filename: "src/lib/data/fns.ts"
}, (opts) => findSleeperUser.__executeServer(opts));
var findSleeperUser = createServerFn({ method: "GET" }).validator(object({ query: string() })).handler(findSleeperUser_createServerFn_handler, async ({ data }) => {
	return (await import("./sleeper.server-Bqr0Cv6u.mjs")).lookupUser(data.query);
});
var getLeagueBundle_createServerFn_handler = createServerRpc({
	id: "4b579abd778a668c22fe31dcafb6204c20a6213656bd80b2690485b3dc2f4d38",
	name: "getLeagueBundle",
	filename: "src/lib/data/fns.ts"
}, (opts) => getLeagueBundle.__executeServer(opts));
var getLeagueBundle = createServerFn({ method: "GET" }).middleware([optionalAuthMiddleware]).validator(object({ leagueId: string() })).handler(getLeagueBundle_createServerFn_handler, async ({ data, context }) => {
	if (isHostedLeague(data.leagueId)) return (await import("./engine.server-DxLAl_HW.mjs")).loadLeagueBundle(data.leagueId, context.userId);
	return (await import("./sleeper.server-Bqr0Cv6u.mjs")).loadLeagueBundle(data.leagueId);
});
var getMatchups_createServerFn_handler = createServerRpc({
	id: "d462b5e3dec29337524e26b0a45f17ad13faddf7d8fe055d2c4101389ec95977",
	name: "getMatchups",
	filename: "src/lib/data/fns.ts"
}, (opts) => getMatchups.__executeServer(opts));
var getMatchups = createServerFn({ method: "GET" }).validator(object({
	leagueId: string(),
	week: number()
})).handler(getMatchups_createServerFn_handler, async ({ data }) => {
	if (isHostedLeague(data.leagueId)) return (await import("./engine.server-DxLAl_HW.mjs")).loadMatchups(data.leagueId, data.week);
	return (await import("./sleeper.server-Bqr0Cv6u.mjs")).loadMatchups(data.leagueId, data.week);
});
var getTeam_createServerFn_handler = createServerRpc({
	id: "baa7d841fd09c065b5beb999ef85518804a1bca62b195b1513bdb384f52bd59e",
	name: "getTeam",
	filename: "src/lib/data/fns.ts"
}, (opts) => getTeam.__executeServer(opts));
var getTeam = createServerFn({ method: "GET" }).validator(object({
	leagueId: string(),
	rosterId: number(),
	week: number()
})).handler(getTeam_createServerFn_handler, async ({ data }) => {
	if (isHostedLeague(data.leagueId)) return (await import("./engine.server-DxLAl_HW.mjs")).loadTeam(data.leagueId, data.rosterId, data.week);
	return (await import("./sleeper.server-Bqr0Cv6u.mjs")).loadTeam(data.leagueId, data.rosterId, data.week);
});
var getWire_createServerFn_handler = createServerRpc({
	id: "cdbde668929f11c9b809af1715c3511a9f07eed36a2103694457da0f6094d35f",
	name: "getWire",
	filename: "src/lib/data/fns.ts"
}, (opts) => getWire.__executeServer(opts));
var getWire = createServerFn({ method: "GET" }).validator(object({
	leagueId: string(),
	position: string(),
	query: string()
})).handler(getWire_createServerFn_handler, async ({ data }) => {
	if (isHostedLeague(data.leagueId)) return (await import("./engine.server-DxLAl_HW.mjs")).loadWire(data.leagueId, data.position, data.query);
	return (await import("./sleeper.server-Bqr0Cv6u.mjs")).loadWire(data.leagueId, data.position, data.query);
});
var getActivity_createServerFn_handler = createServerRpc({
	id: "dea222bf8f8a3c82db42b682e0a2d43aa7e7436a6b4fbb0be5a19a1c39760d79",
	name: "getActivity",
	filename: "src/lib/data/fns.ts"
}, (opts) => getActivity.__executeServer(opts));
var getActivity = createServerFn({ method: "GET" }).validator(object({
	leagueId: string(),
	week: number()
})).handler(getActivity_createServerFn_handler, async ({ data }) => {
	if (isHostedLeague(data.leagueId)) return (await import("./engine.server-DxLAl_HW.mjs")).loadActivity(data.leagueId, data.week);
	return (await import("./sleeper.server-Bqr0Cv6u.mjs")).loadActivity(data.leagueId, data.week);
});
var getLeaders_createServerFn_handler = createServerRpc({
	id: "fedc540785a4dcf9ca2ae22155a966fefc11c6e615983d4507a23460bf3555d4",
	name: "getLeaders",
	filename: "src/lib/data/fns.ts"
}, (opts) => getLeaders.__executeServer(opts));
var getLeaders = createServerFn({ method: "GET" }).validator(object({ position: string() })).handler(getLeaders_createServerFn_handler, async ({ data }) => {
	return (await import("./sleeper.server-Bqr0Cv6u.mjs")).loadLeaders(data.position);
});
var getPlayerSearch_createServerFn_handler = createServerRpc({
	id: "1aeb9fa7f773ffe0653656262ff1fc62b7c9154fe19b202815c3f7bd794102cf",
	name: "getPlayerSearch",
	filename: "src/lib/data/fns.ts"
}, (opts) => getPlayerSearch.__executeServer(opts));
var getPlayerSearch = createServerFn({ method: "GET" }).validator(object({
	query: string(),
	position: string()
})).handler(getPlayerSearch_createServerFn_handler, async ({ data }) => {
	return (await import("./sleeper.server-Bqr0Cv6u.mjs")).searchPlayers(data.query, data.position);
});
var getRecap_createServerFn_handler = createServerRpc({
	id: "1da08a9b1a9d3c29dc69ce194df815a43856d7dc985a88ba9bbf764132bce315",
	name: "getRecap",
	filename: "src/lib/data/fns.ts"
}, (opts) => getRecap.__executeServer(opts));
var getRecap = createServerFn({ method: "GET" }).validator(object({
	leagueId: string(),
	week: number()
})).handler(getRecap_createServerFn_handler, async ({ data }) => {
	const sleeper = await import("./sleeper.server-Bqr0Cv6u.mjs");
	if (isHostedLeague(data.leagueId)) {
		const eng = await import("./engine.server-DxLAl_HW.mjs");
		const [bundle, pairs, activity] = await Promise.all([
			eng.loadLeagueBundle(data.leagueId, null),
			eng.loadMatchups(data.leagueId, data.week),
			eng.loadActivity(data.leagueId, data.week)
		]);
		return sleeper.writeRecap(bundle.league.name, data.week, pairs, activity);
	}
	const [bundle, pairs, activity] = await Promise.all([
		sleeper.loadLeagueBundle(data.leagueId),
		sleeper.loadMatchups(data.leagueId, data.week),
		sleeper.loadActivity(data.leagueId, data.week)
	]);
	return sleeper.writeRecap(bundle.league.name, data.week, pairs, activity);
});
var getSources_createServerFn_handler = createServerRpc({
	id: "90c7415cfd2e9f8efdcd464a016365eeabcc2b49cf5c7ead3345657140a568bc",
	name: "getSources",
	filename: "src/lib/data/fns.ts"
}, (opts) => getSources.__executeServer(opts));
var getSources = createServerFn({ method: "GET" }).handler(getSources_createServerFn_handler, async () => {
	return (await import("./sleeper.server-Bqr0Cv6u.mjs")).probeSources();
});
//#endregion
export { findSleeperUser_createServerFn_handler, getActivity_createServerFn_handler, getLeaders_createServerFn_handler, getLeagueBundle_createServerFn_handler, getLiveWire_createServerFn_handler, getMatchups_createServerFn_handler, getPlayerSearch_createServerFn_handler, getPulse_createServerFn_handler, getRecap_createServerFn_handler, getScores_createServerFn_handler, getSources_createServerFn_handler, getTeam_createServerFn_handler, getWire_createServerFn_handler };
