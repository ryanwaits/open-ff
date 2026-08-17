//#region node_modules/.nitro/vite/services/ssr/assets/espn.server-CN-Nbyu7.js
var ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
var cache = /* @__PURE__ */ new Map();
async function eget(url, ttl) {
	const hit = cache.get(url);
	if (hit && Date.now() - hit.at < ttl) return hit.data;
	const res = await fetch(url, { headers: { accept: "application/json" } });
	if (!res.ok) throw new Error(`ESPN failed (${res.status})`);
	const data = await res.json();
	cache.set(url, {
		at: Date.now(),
		data
	});
	return data;
}
function mapTeam(c) {
	return {
		abbr: c.team.abbreviation,
		name: c.team.displayName,
		logo: c.team.logo ?? "",
		score: c.score ?? "0",
		winner: typeof c.winner === "boolean" ? c.winner : null,
		record: c.records?.[0]?.summary ?? null
	};
}
async function fetchScoreboard(opts) {
	const qs = new URLSearchParams();
	if (opts?.week) qs.set("week", String(opts.week));
	if (opts?.season) qs.set("dates", String(opts.season));
	if (opts?.seasonType) qs.set("seasontype", String(opts.seasonType));
	const board = await eget(`${ESPN}/scoreboard${qs.size ? `?${qs}` : ""}`, 12e3);
	const week = board.week?.number ?? opts?.week ?? 0;
	const season = board.season?.year ?? opts?.season ?? 0;
	const typeNum = board.season?.type ?? opts?.seasonType ?? 2;
	const seasonType = typeNum === 1 ? "pre" : typeNum === 3 ? "post" : "regular";
	return {
		games: (board.events ?? []).map((ev) => {
			const comp = ev.competitions?.[0];
			const homeC = comp?.competitors.find((c) => c.homeAway === "home");
			const awayC = comp?.competitors.find((c) => c.homeAway === "away");
			const stateRaw = ev.status.type.state;
			const state = stateRaw === "in" ? "in" : stateRaw === "post" ? "post" : "pre";
			return {
				id: ev.id,
				name: ev.name,
				shortName: ev.shortName ?? ev.name,
				date: ev.date,
				state,
				detail: ev.status.type.shortDetail ?? ev.status.type.detail ?? "",
				week,
				season,
				seasonType,
				home: homeC ? mapTeam(homeC) : {
					abbr: "—",
					name: "TBD",
					logo: "",
					score: "",
					winner: null,
					record: null
				},
				away: awayC ? mapTeam(awayC) : {
					abbr: "—",
					name: "TBD",
					logo: "",
					score: "",
					winner: null,
					record: null
				}
			};
		}),
		week,
		season,
		seasonType
	};
}
async function fetchNews() {
	return ((await eget(`${ESPN}/news?limit=8`, 18e4)).articles ?? []).slice(0, 8).map((a, i) => ({
		id: String(a.id ?? i),
		headline: a.headline ?? "Headline",
		description: a.description ?? "",
		published: a.published ?? "",
		image: a.images?.[0]?.url ?? null,
		link: a.links?.web?.href ?? null
	}));
}
//#endregion
export { fetchNews, fetchScoreboard };
