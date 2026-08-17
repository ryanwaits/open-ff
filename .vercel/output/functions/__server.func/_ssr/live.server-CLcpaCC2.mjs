//#region node_modules/.nitro/vite/services/ssr/assets/live.server-CLcpaCC2.js
function seasonTypeNum(seasonType) {
	if (seasonType === "pre") return 1;
	if (seasonType === "post") return 3;
	return 2;
}
function indexGames(games) {
	const out = /* @__PURE__ */ new Map();
	for (const g of games) {
		out.set(g.home.abbr.toUpperCase(), {
			state: g.state,
			detail: g.detail,
			opp: `vs ${g.away.abbr}`
		});
		out.set(g.away.abbr.toUpperCase(), {
			state: g.state,
			detail: g.detail,
			opp: `@ ${g.home.abbr}`
		});
	}
	return out;
}
function gameForTeam(index, team) {
	if (!team) return null;
	return index.get(team.toUpperCase()) ?? null;
}
var pointsCache = /* @__PURE__ */ new Map();
var statsCache = /* @__PURE__ */ new Map();
/** Unofficial Sleeper weekly points. Short TTL so Sunday games tick. */
async function fetchWeekPoints(season, week, scoring, seasonType = "regular") {
	const kind = seasonType === "pre" || seasonType === "post" ? seasonType : "regular";
	const key = `${kind}:${season}:${week}:${scoring}`;
	const hit = pointsCache.get(key);
	if (hit && Date.now() - hit.at < 12e3) return hit.data;
	const raw = await fetchWeekStats(season, week, kind);
	const statKey = scoring === "std" ? "pts_std" : scoring === "half" ? "pts_half_ppr" : "pts_ppr";
	const data = {};
	for (const [id, row] of Object.entries(raw)) {
		const pts = row?.[statKey];
		if (typeof pts === "number") data[id] = pts;
	}
	pointsCache.set(key, {
		at: Date.now(),
		data
	});
	return data;
}
async function fetchWeekStats(season, week, seasonType = "regular") {
	const kind = seasonType === "pre" || seasonType === "post" ? seasonType : "regular";
	const key = `raw:${kind}:${season}:${week}`;
	const hit = statsCache.get(key);
	if (hit && Date.now() - hit.at < 12e3) return hit.data;
	const res = await fetch(`https://api.sleeper.app/v1/stats/nfl/${kind}/${season}/${week}`, { headers: { accept: "application/json" } });
	if (!res.ok) return hit?.data ?? {};
	const raw = await res.json() ?? {};
	statsCache.set(key, {
		at: Date.now(),
		data: raw
	});
	return raw;
}
async function weekBoard(season, week, seasonType) {
	const board = await (await import("./espn.server-CN-Nbyu7.mjs")).fetchScoreboard({
		week,
		season: Number(season) || void 0,
		seasonType: seasonTypeNum(seasonType)
	});
	const index = indexGames(board.games);
	return {
		live: board.games.some((g) => g.state === "in"),
		index,
		games: board.games
	};
}
//#endregion
export { fetchWeekPoints, fetchWeekStats, gameForTeam, weekBoard };
