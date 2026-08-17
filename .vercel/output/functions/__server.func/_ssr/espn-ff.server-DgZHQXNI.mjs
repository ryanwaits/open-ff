import { r as bookFromPreset, s as scoringLabel } from "./scoring-x8-F509i.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
//#region node_modules/.nitro/vite/services/ssr/assets/espn-ff.server-DgZHQXNI.js
var ESPN_FF = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";
var ESPN_TEAM = {
	1: "ATL",
	2: "BUF",
	3: "CHI",
	4: "CIN",
	5: "CLE",
	6: "DAL",
	7: "DEN",
	8: "DET",
	9: "GB",
	10: "TEN",
	11: "IND",
	12: "KC",
	13: "LV",
	14: "LAR",
	15: "MIA",
	16: "MIN",
	17: "NE",
	18: "NO",
	19: "NYG",
	20: "NYJ",
	21: "PHI",
	22: "ARI",
	23: "PIT",
	24: "LAC",
	25: "SF",
	26: "SEA",
	27: "TB",
	28: "WSH",
	29: "CAR",
	30: "JAX",
	33: "BAL",
	34: "HOU"
};
var SLOT_POS = {
	0: "QB",
	1: "QB",
	2: "RB",
	3: "FLEX",
	4: "WR",
	5: "FLEX",
	6: "TE",
	7: "FLEX",
	16: "DEF",
	17: "K",
	20: "BN",
	21: "IR",
	23: "FLEX"
};
var espnIndex = null;
function loadEspnIndex() {
	if (espnIndex) return espnIndex;
	const raw = JSON.parse(readFileSync(join(process.cwd(), "data/players-slim.json"), "utf8"));
	const map = /* @__PURE__ */ new Map();
	for (const p of Object.values(raw)) {
		if (p.espn_id != null && p.espn_id !== "") map.set(Number(p.espn_id), p.player_id);
		if (p.position === "DEF" && p.player_id) map.set(NaN, p.player_id);
	}
	espnIndex = map;
	return map;
}
function sleeperOf(playerId, proTeamId) {
	if (playerId < 0) return ESPN_TEAM[Math.abs(playerId) - 16e3] ?? ESPN_TEAM[proTeamId ?? -1] ?? null;
	return loadEspnIndex().get(playerId) ?? null;
}
function parseLeagueId(raw) {
	const url = raw.match(/leagueId=(\d+)/i);
	if (url) return url[1];
	const digits = raw.trim().match(/^(\d{3,})$/);
	if (digits) return digits[1];
	throw new Error("Paste an ESPN league ID or league URL.");
}
async function espnGet(url, cookies) {
	const headers = {
		accept: "application/json",
		"user-agent": "Mozilla/5.0",
		"x-fantasy-source": "kona"
	};
	if (cookies?.swid && cookies?.espnS2) headers.cookie = `SWID=${cookies.swid}; espn_s2=${cookies.espnS2}`;
	const res = await fetch(url, { headers });
	if (res.status === 401 || res.status === 403) throw new Error("That ESPN league is private. In ESPN: League settings → Make league viewable to the public. Or paste SWID + espn_s2 from your ESPN cookies (used once, not saved).");
	if (res.status === 404) throw new Error("No ESPN league with that ID for that season.");
	if (!res.ok) throw new Error(`ESPN fantasy failed (${res.status}).`);
	return await res.json();
}
function slotsFrom(counts) {
	const out = [];
	const order = [
		0,
		1,
		2,
		4,
		6,
		23,
		3,
		5,
		7,
		17,
		16,
		15,
		20,
		21
	];
	const seen = /* @__PURE__ */ new Set();
	for (const id of order) {
		seen.add(id);
		const n = counts?.[String(id)] ?? 0;
		const lab = SLOT_POS[id] ?? "BN";
		for (let i = 0; i < n; i++) out.push(lab);
	}
	for (const [k, n] of Object.entries(counts ?? {})) {
		const id = Number(k);
		if (seen.has(id) || !n) continue;
		const lab = SLOT_POS[id] ?? "BN";
		for (let i = 0; i < n; i++) out.push(lab);
	}
	return out.length ? out : [
		"QB",
		"RB",
		"RB",
		"WR",
		"WR",
		"TE",
		"FLEX",
		"K",
		"DEF",
		"BN",
		"BN",
		"BN",
		"BN",
		"BN",
		"BN"
	];
}
function bookFromEspn(items) {
	const book = bookFromPreset("std");
	if (!items) return book;
	const apply = (key, pts) => {
		book[key] = pts;
	};
	for (const item of items) {
		const pts = item.points ?? 0;
		switch (item.statId) {
			case 3:
				apply("pass_yd", pts);
				break;
			case 8:
				apply("pass_yd", pts / 25);
				break;
			case 4:
				apply("pass_td", pts);
				break;
			case 19:
				apply("pass_2pt", pts);
				break;
			case 20:
				apply("pass_int", pts);
				break;
			case 24:
				apply("rush_yd", pts);
				break;
			case 28:
				apply("rush_yd", pts / 10);
				break;
			case 25:
				apply("rush_td", pts);
				break;
			case 26:
				apply("rush_2pt", pts);
				break;
			case 41:
			case 53:
				apply("rec", pts);
				break;
			case 42:
				apply("rec_yd", pts);
				break;
			case 48:
				apply("rec_yd", pts / 10);
				break;
			case 43:
				apply("rec_td", pts);
				break;
			case 44:
				apply("rec_2pt", pts);
				break;
			case 72:
				apply("fum_lost", pts);
				break;
			case 74:
				apply("fgm_50p", pts);
				break;
			case 77:
				apply("fgm_40_49", pts);
				break;
			case 80:
				apply("fgm_0_19", pts);
				apply("fgm_20_29", pts);
				apply("fgm_30_39", pts);
				break;
			case 86: apply("xpm", pts);
		}
	}
	return book;
}
function mapEntries(entries) {
	const players = [];
	for (const e of entries ?? []) {
		const p = e.playerPoolEntry?.player;
		const sid = sleeperOf(e.playerId, p?.proTeamId);
		if (!sid) continue;
		const pos = SLOT_POS[e.lineupSlotId] ?? "BN";
		const bench = pos === "BN" || pos === "IR";
		players.push({
			sleeperId: sid,
			slot: bench ? pos === "IR" ? "bench" : "bench" : "starter",
			starterSlot: bench ? null : pos === "DEF" ? "DST" : pos === "FLEX" ? "FLX" : pos
		});
	}
	return players;
}
async function loadEspnImportPack(input) {
	const leagueId = parseLeagueId(input.leagueId);
	const season = input.season || "2025";
	const cookies = input.swid && input.espnS2 ? {
		swid: input.swid,
		espnS2: input.espnS2
	} : void 0;
	const raw = await espnGet(`${ESPN_FF}/seasons/${season}/segments/0/leagues/${leagueId}?view=mTeam&view=mRoster&view=mSettings&view=mMatchupScore`, cookies);
	const members = new Map((raw.members ?? []).map((m) => [m.id, m]));
	const book = bookFromEspn(raw.settings?.scoringSettings?.scoringItems);
	const slots = slotsFrom(raw.settings?.rosterSettings?.lineupSlotCounts);
	const teams = (raw.teams ?? []).map((t) => {
		const owner = t.primaryOwner ? members.get(t.primaryOwner) : void 0;
		return {
			rosterId: t.id,
			teamName: (t.name || t.abbrev || `Team ${t.id}`).slice(0, 40),
			manager: owner?.displayName || owner?.firstName || "Manager",
			ownerKey: t.primaryOwner ?? null,
			players: mapEntries(t.roster?.entries)
		};
	});
	const byWeek = /* @__PURE__ */ new Map();
	for (const g of raw.schedule ?? []) {
		const arr = byWeek.get(g.matchupPeriodId) ?? [];
		arr.push(g);
		byWeek.set(g.matchupPeriodId, arr);
	}
	const weeks = [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([week, games]) => ({
		week,
		games: games.map((g) => ({
			matchupId: g.id,
			home: g.home?.teamId ?? 0,
			away: g.away?.teamId ?? null
		})),
		results: games.flatMap((g) => {
			const rows = [];
			for (const side of [g.home, g.away]) {
				if (!side) continue;
				const starters = (side.rosterForCurrentScoringPeriod?.entries ?? []).map((e) => {
					const sid = sleeperOf(e.playerId, e.playerPoolEntry?.player?.proTeamId);
					if (!sid) return null;
					const pos = SLOT_POS[e.lineupSlotId] ?? "BN";
					if (pos === "BN" || pos === "IR") return null;
					return {
						playerId: sid,
						points: e.playerPoolEntry?.appliedStatTotal ?? 0
					};
				}).filter(Boolean);
				rows.push({
					rosterId: side.teamId,
					points: side.totalPoints ?? 0,
					starters
				});
			}
			return rows;
		})
	}));
	const scoredWeeks = weeks.filter((w) => w.results.some((r) => r.points > 0));
	const currentWeek = Math.max(1, scoredWeeks.at(-1)?.week ?? raw.scoringPeriodId ?? 1);
	return {
		leagueId,
		name: raw.settings?.name || `ESPN ${leagueId}`,
		season,
		status: scoredWeeks.length ? "in_season" : "pre_draft",
		teamCount: teams.length,
		scoringLabel: scoringLabel(book),
		book,
		slots,
		playoffTeams: raw.settings?.scheduleSettings?.playoffTeamCount ?? 4,
		currentWeek: Math.min(18, currentWeek),
		teams,
		weeks
	};
}
//#endregion
export { loadEspnImportPack };
