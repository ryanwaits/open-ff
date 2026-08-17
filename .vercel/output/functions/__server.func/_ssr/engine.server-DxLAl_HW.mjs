import { r as getSql } from "./db-C12UbT90.mjs";
import { i as slotLabel, t as START_SLOTS } from "./teams-DHGI6_jF.mjs";
import { a as parseBook, i as isClassicPreset, n as applyBook, o as presetOf, r as bookFromPreset, s as scoringLabel } from "./scoring-x8-F509i.mjs";
import { getPlayer, playerName } from "./sleeper.server-Bqr0Cv6u.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
//#region node_modules/.nitro/vite/services/ssr/assets/engine.server-DxLAl_HW.js
var DEMO_HOSTED_ID = "lg_backyard";
var DEFAULT_SLOTS = [
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
var HOUSE_NAMES = [
	"Masthead",
	"Night Desk",
	"Copy Chiefs",
	"Widowmakers",
	"Jump Line",
	"The Galley",
	"Rewrite",
	"Slugline",
	"The Spike",
	"Composing Room",
	"Folio",
	"The Rim"
];
var weeklyPpr = null;
var seasonPpr = null;
var seedPromise = null;
function nid(prefix, n = 10) {
	const chars = "abcdefghjkmnpqrstuvwxyz23456789";
	let s = prefix;
	for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 31)];
	return s;
}
function inviteCode() {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let s = "";
	for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * 32)];
	return s;
}
function parseSlots(raw) {
	try {
		const v = JSON.parse(raw);
		return Array.isArray(v) ? v : DEFAULT_SLOTS;
	} catch {
		return DEFAULT_SLOTS;
	}
}
function bookOf(row) {
	const preset = row.scoring === "half" || row.scoring === "std" ? row.scoring : "ppr";
	return parseBook(row.scoring_json, preset);
}
function managerOf(r) {
	if (r.manager_name?.trim()) return r.manager_name;
	if (r.owner_id) return "Member";
	return "House club";
}
function loadSeasonPpr() {
	if (seasonPpr) return seasonPpr;
	seasonPpr = JSON.parse(readFileSync(join(process.cwd(), "data/stats-2025.json"), "utf8"));
	return seasonPpr;
}
function loadWeeklyPpr() {
	if (weeklyPpr) return weeklyPpr;
	weeklyPpr = JSON.parse(readFileSync(join(process.cwd(), "data/weekly-ppr-2025.json"), "utf8"));
	return weeklyPpr;
}
var pprMap = () => new Map(loadSeasonPpr().map((s) => [s.player_id, s.pts_ppr]));
function weekMap(season, week) {
	return loadWeeklyPpr()[String(week)] ?? {};
}
async function scoreWeekMap(row, week) {
	const book = bookOf(row);
	if (row.season === "2025" && isClassicPreset(book) && !row.source_league_id) {
		if (presetOf(book) === "ppr") return weekMap(row.season, week);
	}
	try {
		const { fetchWeekStats } = await import("./live.server-CLcpaCC2.mjs");
		const raw = await fetchWeekStats(row.season, week, "regular");
		const out = {};
		for (const [id, line] of Object.entries(raw)) out[id] = applyBook(book, line);
		return out;
	} catch {
		const { fetchWeekPoints } = await import("./live.server-CLcpaCC2.mjs");
		return fetchWeekPoints(row.season, week, presetOf(book), "regular");
	}
}
function snakeOrder(teams, rounds) {
	const out = [];
	let n = 1;
	for (let r = 1; r <= rounds; r++) {
		const ids = Array.from({ length: teams }, (_, i) => i + 1);
		if (r % 2 === 0) ids.reverse();
		for (const roster of ids) out.push({
			pick: n++,
			round: r,
			roster
		});
	}
	return out;
}
function makeSchedule(teams, weeks) {
	const ids = Array.from({ length: teams }, (_, i) => i + 1);
	if (ids.length % 2 === 1) ids.push(0);
	const m = ids.length;
	const rounds = [];
	const circle = [...ids];
	for (let r = 0; r < m - 1; r++) {
		const pairs = [];
		for (let i = 0; i < m / 2; i++) {
			const a = circle[i];
			const b = circle[m - 1 - i];
			if (a === 0) pairs.push([b, null]);
			else if (b === 0) pairs.push([a, null]);
			else pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
		}
		rounds.push(pairs);
		const last = circle.pop();
		circle.splice(1, 0, last);
	}
	const out = [];
	for (let w = 1; w <= weeks; w++) rounds[(w - 1) % rounds.length].forEach((p, i) => {
		out.push({
			week: w,
			id: i + 1,
			home: p[0],
			away: p[1]
		});
	});
	return out;
}
function playoffLabel(kind, round, playoffTeams, bye) {
	if (kind !== "playoff") return null;
	if (bye) return "Bye";
	const r = round ?? 1;
	if (playoffTeams >= 6) {
		if (r === 1) return "Wild card";
		if (r === 2) return "Semifinal";
		return "Championship";
	}
	if (r === 1) return "Semifinal";
	return "Championship";
}
async function ensureRemainingSchedule(leagueId) {
	const league = await getLeague(leagueId);
	if (league.status === "pre_draft" || league.status === "drafting") return;
	const lastReg = Math.min(league.regular_weeks ?? 14, (league.playoff_start_week ?? 15) - 1);
	if (lastReg < 1) return;
	const sql = await getSql();
	const existing = await sql`
    select distinct week from ff_matchups where league_id = ${leagueId} and week <= ${lastReg}
  `;
	const have = new Set(existing.map((e) => e.week));
	for (const m of makeSchedule(league.team_count, lastReg)) {
		if (have.has(m.week)) continue;
		await sql`
      insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster, kind)
      values (${leagueId}, ${m.week}, ${m.id}, ${m.home}, ${m.away}, ${"regular"})
      on conflict do nothing
    `;
	}
}
async function armLeagueOps(leagueId) {
	const ops = await import("./ops.server-BA_UgRzY.mjs");
	await ops.seedRosterOps(leagueId);
	await ops.ensureDraftBoard(leagueId);
	await ensureRemainingSchedule(leagueId);
}
function compatible(pos, slot) {
	if (!pos) return false;
	if (slot === pos) return true;
	if (slot === "FLEX") return pos === "RB" || pos === "WR" || pos === "TE";
	if (slot === "SUPER_FLEX") return pos === "QB" || pos === "RB" || pos === "WR" || pos === "TE";
	if (slot === "WRRB_FLEX") return pos === "RB" || pos === "WR";
	if (slot === "REC_FLEX") return pos === "WR" || pos === "TE";
	return false;
}
function applyLineup(spots, slots, pts) {
	const startSlots = slots.filter((s) => START_SLOTS.has(s));
	const used = /* @__PURE__ */ new Set();
	const next = spots.map((s) => ({
		...s,
		slot: "bench",
		starter_slot: null
	}));
	const byPts = [...next].sort((a, b) => (pts.get(b.player_id) ?? 0) - (pts.get(a.player_id) ?? 0));
	for (const slot of startSlots) {
		const pick = byPts.find((s) => !used.has(s.player_id) && compatible(getPlayer(s.player_id)?.position, slot));
		if (!pick) continue;
		used.add(pick.player_id);
		pick.slot = "starter";
		pick.starter_slot = slotLabel(slot);
	}
	return next;
}
async function getLeague(id) {
	const rows = await (await getSql())`select * from ff_leagues where id = ${id}`;
	if (!rows[0]) throw new Error("League not found");
	return rows[0];
}
async function getRosters(id) {
	return (await getSql())`select * from ff_rosters where league_id = ${id} order by roster_id`;
}
async function getSpots(id) {
	return (await getSql())`select * from ff_spots where league_id = ${id}`;
}
async function ensureDemo() {
	(await import("./ops.server-BA_UgRzY.mjs")).startLeagueClock();
	if (!seedPromise) seedPromise = seedDemo().catch((err) => {
		seedPromise = null;
		throw err;
	});
	return seedPromise;
}
async function seedDemo() {
	const sql = await getSql();
	if ((await sql`select id from ff_leagues where id = ${"lg_backyard"}`)[0]) return;
	try {
		await seedDemoBody();
	} catch (err) {
		await sql`delete from ff_leagues where id = ${DEMO_HOSTED_ID}`;
		throw err;
	}
}
async function seedDemoBody() {
	const sql = await getSql();
	if ((await sql`select id from ff_leagues where id = ${"lg_backyard"}`)[0]) return;
	const slots = DEFAULT_SLOTS;
	const rounds = slots.length;
	const teams = 10;
	await sql`
    insert into ff_leagues (
      id, name, season, invite_code, commish_id, status, team_count,
      scoring, roster_slots, playoff_teams, current_week, locked
    ) values (
      ${DEMO_HOSTED_ID}, ${"The Backyard"}, ${"2025"}, ${"YARD26"}, ${"house"},
      ${"complete"}, ${teams}, ${"ppr"}, ${JSON.stringify(slots)}, ${4}, ${14}, ${1}
    )
  `;
	await sql`
    insert into ff_draft (league_id, status, pick_no)
    values (${DEMO_HOSTED_ID}, ${"complete"}, ${teams * rounds + 1})
  `;
	for (let i = 1; i <= teams; i++) await sql`
      insert into ff_rosters (league_id, roster_id, team_name, owner_id)
      values (${DEMO_HOSTED_ID}, ${i}, ${HOUSE_NAMES[i - 1] ?? `Seat ${i}`}, ${null})
    `;
	const order = snakeOrder(teams, rounds);
	const ranked = rankPool();
	const taken = /* @__PURE__ */ new Set();
	const byRoster = /* @__PURE__ */ new Map();
	const now = (/* @__PURE__ */ new Date()).toISOString();
	for (const step of order) {
		const player = nextAutopick(step.roster, byRoster, ranked, taken);
		if (!player) break;
		taken.add(player.player_id);
		const list = byRoster.get(step.roster) ?? [];
		list.push(player.player_id);
		byRoster.set(step.roster, list);
		await sql`
      insert into ff_picks (league_id, pick_no, round, roster_id, player_id, picked_at)
      values (${DEMO_HOSTED_ID}, ${step.pick}, ${step.round}, ${step.roster}, ${player.player_id}, ${now})
    `;
	}
	const pts = pprMap();
	for (const [rosterId, ids] of byRoster) {
		const lined = applyLineup(ids.map((player_id) => ({
			league_id: DEMO_HOSTED_ID,
			roster_id: rosterId,
			player_id,
			slot: "bench",
			starter_slot: null
		})), slots, pts);
		for (const s of lined) await sql`
        insert into ff_spots (league_id, roster_id, player_id, slot, starter_slot)
        values (${DEMO_HOSTED_ID}, ${s.roster_id}, ${s.player_id}, ${s.slot}, ${s.starter_slot})
      `;
	}
	for (const m of makeSchedule(teams, 14)) await sql`
      insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster)
      values (${DEMO_HOSTED_ID}, ${m.week}, ${m.id}, ${m.home}, ${m.away})
    `;
}
function rankPool() {
	const out = [];
	for (const row of loadSeasonPpr()) {
		const p = getPlayer(row.player_id);
		if (!p?.position) continue;
		if (![
			"QB",
			"RB",
			"WR",
			"TE",
			"K",
			"DEF"
		].includes(p.position)) continue;
		out.push({
			...p,
			pts: row.pts_ppr
		});
	}
	out.sort((a, b) => b.pts - a.pts);
	return out;
}
function nextAutopick(rosterId, byRoster, ranked, taken) {
	const have = {
		QB: 0,
		RB: 0,
		WR: 0,
		TE: 0,
		K: 0,
		DEF: 0
	};
	for (const id of byRoster.get(rosterId) ?? []) {
		const pos = getPlayer(id)?.position;
		if (pos && have[pos] != null) have[pos] += 1;
	}
	const available = ranked.filter((p) => !taken.has(p.player_id));
	if (!available.length) return null;
	const needs = [];
	if (have.QB < 1) needs.push("QB");
	if (have.RB < 2) needs.push("RB");
	if (have.WR < 2) needs.push("WR");
	if (have.TE < 1) needs.push("TE");
	if (have.K < 1 && (byRoster.get(rosterId)?.length ?? 0) >= 8) needs.push("K");
	if (have.DEF < 1 && (byRoster.get(rosterId)?.length ?? 0) >= 9) needs.push("DEF");
	for (const pos of needs) {
		const idx = available.findIndex((p) => p.position === pos);
		if (idx >= 0 && idx < 28) return available[idx];
	}
	return available[0] ?? null;
}
function asSleeper(row) {
	const slots = parseSlots(row.roster_slots);
	return {
		league_id: row.id,
		name: row.name,
		season: row.season,
		status: row.status,
		sport: "nfl",
		season_type: "regular",
		total_rosters: row.team_count,
		roster_positions: slots,
		scoring_settings: bookOf(row),
		settings: {
			num_teams: row.team_count,
			playoff_teams: row.playoff_teams,
			playoff_week_start: row.playoff_start_week ?? 15,
			type: 0,
			last_scored_leg: row.current_week,
			leg: row.current_week
		}
	};
}
async function scoredStandings(row, rosters, spots) {
	if (rosters.filter((r) => r.snap_wins != null).length >= Math.max(2, rosters.length - 1)) return rosters.map((r) => ({
		rosterId: r.roster_id,
		ownerId: r.owner_id,
		teamName: r.team_name,
		manager: managerOf(r),
		avatar: null,
		wins: r.snap_wins ?? 0,
		losses: r.snap_losses ?? 0,
		ties: r.snap_ties ?? 0,
		pf: r.snap_pf ?? 0,
		pa: r.snap_pa ?? 0,
		waiverPos: r.waiver_order ?? r.roster_id
	})).sort((a, b) => b.wins - a.wins || b.pf - a.pf);
	const sql = await getSql();
	const matchups = await sql`
    select * from ff_matchups
    where league_id = ${row.id} and week <= ${row.current_week}
      and week < ${row.playoff_start_week ?? 15}
  `;
	const locked = await sql`
    select * from ff_week_results where league_id = ${row.id} and week <= ${row.current_week}
  `.catch(() => []);
	const lockedMap = /* @__PURE__ */ new Map();
	for (const r of locked) lockedMap.set(`${r.week}:${r.roster_id}`, r.points);
	const rec = /* @__PURE__ */ new Map();
	for (const r of rosters) rec.set(r.roster_id, {
		w: 0,
		l: 0,
		t: 0,
		pf: 0,
		pa: 0
	});
	const byRosterSpots = /* @__PURE__ */ new Map();
	for (const s of spots) {
		const arr = byRosterSpots.get(s.roster_id) ?? [];
		arr.push(s);
		byRosterSpots.set(s.roster_id, arr);
	}
	const weeks = new Set(matchups.map((m) => m.week));
	const weekPts = /* @__PURE__ */ new Map();
	for (const w of weeks) if (matchups.some((m) => m.week === w && (lockedMap.get(`${w}:${m.home_roster}`) == null || m.away_roster != null && lockedMap.get(`${w}:${m.away_roster}`) == null))) weekPts.set(w, await scoreWeekMap(row, w));
	function total(rosterId, week) {
		const hit = lockedMap.get(`${week}:${rosterId}`);
		if (hit != null) return hit;
		const pts = weekPts.get(week) ?? {};
		let sum = 0;
		for (const s of byRosterSpots.get(rosterId) ?? []) {
			if (s.slot !== "starter") continue;
			sum += pts[s.player_id] ?? 0;
		}
		return sum;
	}
	for (const m of matchups) {
		const hp = total(m.home_roster, m.week);
		const ap = m.away_roster != null ? total(m.away_roster, m.week) : 0;
		const h = rec.get(m.home_roster);
		if (h) {
			h.pf += hp;
			h.pa += ap;
			if (m.away_roster == null) {} else if (hp > ap) h.w += 1;
			else if (hp < ap) h.l += 1;
			else h.t += 1;
		}
		if (m.away_roster != null) {
			const a = rec.get(m.away_roster);
			if (a) {
				a.pf += ap;
				a.pa += hp;
				if (ap > hp) a.w += 1;
				else if (ap < hp) a.l += 1;
				else a.t += 1;
			}
		}
	}
	return rosters.map((r) => {
		const s = rec.get(r.roster_id);
		return {
			rosterId: r.roster_id,
			ownerId: r.owner_id,
			teamName: r.team_name,
			manager: managerOf(r),
			avatar: null,
			wins: s.w,
			losses: s.l,
			ties: s.t,
			pf: s.pf,
			pa: s.pa,
			waiverPos: r.waiver_order ?? r.roster_id
		};
	}).sort((a, b) => b.wins - a.wins || b.pf - a.pf);
}
async function loadLeagueBundle(leagueId, userId, opts) {
	await ensureDemo();
	let row = await getLeague(leagueId);
	if (opts?.tick !== false && row.locked !== 1 && row.status !== "pre_draft" && row.status !== "drafting") try {
		await (await import("./ops.server-BA_UgRzY.mjs")).tickLeague(leagueId);
		row = await getLeague(leagueId);
	} catch {}
	const rosters = await getRosters(leagueId);
	const standings = await scoredStandings(row, rosters, await getSpots(leagueId));
	const mine = userId ? rosters.find((r) => r.owner_id === userId)?.roster_id ?? null : null;
	const draft = (await (await getSql())`select * from ff_draft where league_id = ${leagueId}`)[0];
	const draftStatus = draft?.status === "live" || draft?.status === "pending" || draft?.status === "complete" ? draft.status : "pending";
	let scoringLive = false;
	try {
		const { weekBoard } = await import("./live.server-CLcpaCC2.mjs");
		scoringLive = (await weekBoard(row.season, row.current_week, "regular")).live;
	} catch {
		scoringLive = false;
	}
	return {
		league: asSleeper(row),
		standings,
		currentWeek: row.current_week,
		scoringLabel: scoringLabel(bookOf(row)),
		formatLabel: `Redraft · ${row.team_count}-team`,
		hosted: true,
		myRosterId: mine,
		isCommish: Boolean(userId && row.commish_id === userId),
		inviteCode: row.invite_code,
		draftStatus,
		locked: row.locked === 1,
		scoringLive,
		faabRemaining: mine ? rosters.find((r) => r.roster_id === mine)?.faab_remaining ?? row.faab_budget ?? 100 : null,
		ops: {
			waiverType: row.waiver_type ?? "faab",
			faabBudget: row.faab_budget ?? 100,
			tradeDeadlineWeek: row.trade_deadline_week ?? 11,
			playoffStartWeek: row.playoff_start_week ?? 15,
			regularWeeks: row.regular_weeks ?? 14,
			lastWaiverWeek: row.last_waiver_week ?? 0,
			waiversOpen: (row.waiver_type ?? "faab") !== "none" && (row.last_waiver_week ?? 0) < row.current_week
		}
	};
}
function sideFrom(roster, spots, slots, pts, games) {
	const startSlots = slots.filter((s) => START_SLOTS.has(s));
	const remaining = spots.filter((s) => s.roster_id === roster.roster_id && s.slot === "starter");
	const starters = startSlots.map((slot) => {
		const lab = slotLabel(slot);
		const idx = remaining.findIndex((s) => s.starter_slot === lab);
		const hit = idx >= 0 ? remaining.splice(idx, 1)[0] : void 0;
		const player = hit ? getPlayer(hit.player_id) : null;
		return {
			slot: lab,
			playerId: hit?.player_id ?? null,
			player,
			points: hit ? pts[hit.player_id] ?? 0 : null,
			game: player?.team ? games.get(player.team.toUpperCase()) ?? null : null
		};
	});
	return {
		rosterId: roster.roster_id,
		teamName: roster.team_name,
		manager: managerOf(roster),
		avatar: null,
		points: starters.reduce((n, s) => n + (s.points ?? 0), 0),
		starters
	};
}
async function loadMatchups(leagueId, week) {
	await ensureDemo();
	const row = await getLeague(leagueId);
	const rosters = await getRosters(leagueId);
	const spots = await getSpots(leagueId);
	const matchups = await (await getSql())`
    select * from ff_matchups
    where league_id = ${leagueId} and week = ${week}
    order by matchup_id
  `;
	const locked = await (await getSql())`
    select * from ff_week_results where league_id = ${leagueId} and week = ${week}
  `.catch(() => []);
	const lockedMap = new Map(locked.map((r) => [r.roster_id, r.points]));
	const pts = await scoreWeekMap(row, week);
	const slots = parseSlots(row.roster_slots);
	const byId = new Map(rosters.map((r) => [r.roster_id, r]));
	let games = /* @__PURE__ */ new Map();
	try {
		const { weekBoard } = await import("./live.server-CLcpaCC2.mjs");
		games = (await weekBoard(row.season, week, "regular")).index;
	} catch {
		games = /* @__PURE__ */ new Map();
	}
	return matchups.map((m) => {
		const home = byId.get(m.home_roster);
		const away = m.away_roster != null ? byId.get(m.away_roster) : void 0;
		const homeSide = sideFrom(home, spots, slots, pts, games);
		const awaySide = away ? sideFrom(away, spots, slots, pts, games) : null;
		if (lockedMap.has(home.roster_id)) homeSide.points = lockedMap.get(home.roster_id);
		if (away && awaySide && lockedMap.has(away.roster_id)) awaySide.points = lockedMap.get(away.roster_id);
		const kind = m.kind === "playoff" ? "playoff" : "regular";
		const playoffRound = m.playoff_round ?? null;
		return {
			matchupId: m.matchup_id,
			home: homeSide,
			away: awaySide,
			kind,
			playoffRound,
			label: playoffLabel(kind, playoffRound, row.playoff_teams, m.away_roster == null)
		};
	});
}
async function loadTeam(leagueId, rosterId, week) {
	await ensureDemo();
	const row = await getLeague(leagueId);
	const rosters = await getRosters(leagueId);
	const roster = rosters.find((r) => r.roster_id === rosterId);
	if (!roster) throw new Error("Roster not found");
	const spots = await (await getSql())`
    select * from ff_spots where league_id = ${leagueId} and roster_id = ${rosterId}
  `;
	const pts = await scoreWeekMap(row, week);
	let games = /* @__PURE__ */ new Map();
	try {
		const { weekBoard } = await import("./live.server-CLcpaCC2.mjs");
		games = (await weekBoard(row.season, week, "regular")).index;
	} catch {
		games = /* @__PURE__ */ new Map();
	}
	const rec = (await scoredStandings(row, rosters, await getSpots(leagueId))).find((s) => s.rosterId === rosterId);
	const players = spots.map((s) => {
		const base = getPlayer(s.player_id) ?? {
			player_id: s.player_id,
			full_name: playerName(s.player_id),
			position: null,
			team: null
		};
		return {
			...base,
			slot: s.slot === "starter" ? "starter" : "bench",
			starterSlot: s.starter_slot ?? void 0,
			weekPts: pts[s.player_id] ?? null,
			game: base.team ? games.get(base.team.toUpperCase()) ?? null : null
		};
	});
	players.sort((a, b) => {
		if (a.slot !== b.slot) return a.slot === "starter" ? -1 : 1;
		return (b.weekPts ?? -1) - (a.weekPts ?? -1);
	});
	return {
		rosterId,
		teamName: roster.team_name,
		manager: managerOf(roster),
		avatar: null,
		record: {
			wins: rec?.wins ?? 0,
			losses: rec?.losses ?? 0,
			ties: rec?.ties ?? 0,
			pf: rec?.pf ?? 0,
			pa: rec?.pa ?? 0
		},
		players,
		week
	};
}
async function loadWire(leagueId, position, query) {
	await ensureDemo();
	const spots = await getSpots(leagueId);
	const taken = new Set(spots.map((s) => s.player_id));
	const q = query.trim().toLowerCase();
	const pos = position === "ALL" ? null : position;
	const out = [];
	for (const row of loadSeasonPpr()) {
		if (taken.has(row.player_id)) continue;
		const p = getPlayer(row.player_id);
		if (!p) continue;
		if (pos && p.position !== pos && !(p.fantasy_positions ?? []).includes(pos)) continue;
		if (q && !`${p.full_name} ${p.search_full_name ?? ""} ${p.team ?? ""}`.toLowerCase().includes(q)) continue;
		out.push({
			...p,
			pts: row.pts_ppr,
			rank: null
		});
		if (out.length >= 80) break;
	}
	return out;
}
async function loadActivity(leagueId, _week) {
	await ensureDemo();
	const rows = await (await getSql())`
    select * from ff_moves where league_id = ${leagueId}
    order by created_at desc
    limit 60
  `;
	const rosters = await getRosters(leagueId);
	const names = new Map(rosters.map((r) => [r.roster_id, r.team_name]));
	return rows.map((m) => {
		const created = typeof m.created_at === "string" ? Date.parse(m.created_at) : m.created_at.getTime();
		return {
			id: m.id,
			type: m.type,
			status: "complete",
			created,
			adds: m.add_player_id ? [{
				playerId: m.add_player_id,
				name: playerName(m.add_player_id),
				pos: getPlayer(m.add_player_id)?.position ?? null,
				team: getPlayer(m.add_player_id)?.team ?? null
			}] : [],
			drops: m.drop_player_id ? [{
				playerId: m.drop_player_id,
				name: playerName(m.drop_player_id),
				pos: getPlayer(m.drop_player_id)?.position ?? null,
				team: getPlayer(m.drop_player_id)?.team ?? null
			}] : [],
			rosterIds: [m.roster_id],
			teamNames: [names.get(m.roster_id) ?? `Roster ${m.roster_id}`],
			bid: null
		};
	});
}
async function listMyLeagues(userId) {
	await ensureDemo();
	return (await (await getSql())`
    select l.id, l.name, l.season, l.status, l.commish_id, r.owner_id
    from ff_leagues l
    left join ff_rosters r on r.league_id = l.id and r.owner_id = ${userId}
    where r.owner_id = ${userId} or l.commish_id = ${userId}
    order by l.created_at desc
  `).map((r) => ({
		leagueId: r.id,
		name: r.name,
		season: r.season,
		status: r.status,
		role: r.commish_id === userId ? "commish" : "member"
	}));
}
async function createLeague(input) {
	await ensureDemo();
	const sql = await getSql();
	const name = input.name.trim().slice(0, 40);
	const teamName = input.teamName.trim().slice(0, 28);
	if (name.length < 2) throw new Error("Name your league.");
	if (teamName.length < 2) throw new Error("Name your team.");
	const teamCount = [
		8,
		10,
		12
	].includes(input.teamCount) ? input.teamCount : 10;
	const id = nid("lg_");
	let code = inviteCode();
	for (let i = 0; i < 6; i++) {
		if (!(await sql`select id from ff_leagues where invite_code = ${code}`)[0]) break;
		code = inviteCode();
	}
	const playoff = teamCount >= 12 ? 6 : 4;
	const book = bookFromPreset(input.scoring);
	await sql`
    insert into ff_leagues (
      id, name, season, invite_code, commish_id, status, team_count,
      scoring, roster_slots, playoff_teams, current_week, locked, scoring_json, source
    ) values (
      ${id}, ${name}, ${"2026"}, ${code}, ${input.userId}, ${"pre_draft"},
      ${teamCount}, ${input.scoring}, ${JSON.stringify(DEFAULT_SLOTS)},
      ${playoff}, ${1}, ${0}, ${JSON.stringify(book)}, ${"ledger"}
    )
  `;
	await sql`insert into ff_draft (league_id, status, pick_no) values (${id}, ${"pending"}, ${1})`;
	for (let i = 1; i <= teamCount; i++) {
		const isCommish = i === 1;
		const house = !isCommish && input.fillHouse;
		await sql`
      insert into ff_rosters (league_id, roster_id, team_name, owner_id)
      values (
        ${id}, ${i},
        ${isCommish ? teamName : house ? HOUSE_NAMES[i - 1] ?? `House ${i}` : `Open seat ${i}`},
        ${isCommish ? input.userId : null}
      )
    `;
	}
	const ops = await import("./ops.server-BA_UgRzY.mjs");
	await ops.seedRosterOps(id);
	await ops.ensureDraftBoard(id);
	return {
		leagueId: id,
		inviteCode: code
	};
}
async function joinLeague(userId, code, teamName) {
	await ensureDemo();
	const sql = await getSql();
	const league = (await sql`select * from ff_leagues where invite_code = ${code.trim().toUpperCase()}`)[0];
	if (!league) throw new Error("No league uses that code.");
	if (league.locked) throw new Error("That league is locked.");
	if ((await sql`select * from ff_rosters where league_id = ${league.id} and owner_id = ${userId}`)[0]) return { leagueId: league.id };
	const seat = (await sql`
      select * from ff_rosters
      where league_id = ${league.id} and owner_id is null
      order by roster_id
      limit 1
    `)[0];
	if (!seat) throw new Error("League is full.");
	await sql`
    update ff_rosters set owner_id = ${userId}, team_name = ${teamName.trim().slice(0, 28) || `Club ${seat.roster_id}`}
    where league_id = ${league.id} and roster_id = ${seat.roster_id}
  `;
	return { leagueId: league.id };
}
async function startDraft(userId, leagueId) {
	const league = await getLeague(leagueId);
	if (league.commish_id !== userId) throw new Error("Only the commissioner can open the draft.");
	if (league.locked) throw new Error("This desk is locked.");
	if (league.status !== "pre_draft") throw new Error("Draft already started.");
	await (await import("./ops.server-BA_UgRzY.mjs")).ensureDraftBoard(leagueId);
	const sql = await getSql();
	await sql`update ff_draft set status = ${"live"}, pick_no = ${1} where league_id = ${leagueId}`;
	await sql`update ff_leagues set status = ${"drafting"} where id = ${leagueId}`;
	await flushHousePicks(leagueId);
}
async function loadDraft(leagueId, userId, position, query) {
	await ensureDemo();
	const league = await getLeague(leagueId);
	const sql = await getSql();
	const draft = (await sql`select * from ff_draft where league_id = ${leagueId}`)[0];
	const picks = await sql`select * from ff_picks where league_id = ${leagueId} order by pick_no`;
	const rosters = await getRosters(leagueId);
	const names = new Map(rosters.map((r) => [r.roster_id, r.team_name]));
	const taken = new Set(picks.map((p) => p.player_id).filter(Boolean));
	const current = picks.find((p) => p.pick_no === (draft?.pick_no ?? 1) && !p.player_id) ?? null;
	const mine = userId ? rosters.find((r) => r.owner_id === userId)?.roster_id : null;
	const pos = position === "ALL" ? null : position;
	const q = query.trim().toLowerCase();
	const available = [];
	for (const row of loadSeasonPpr()) {
		if (taken.has(row.player_id)) continue;
		const p = getPlayer(row.player_id);
		if (!p?.position) continue;
		if (pos && p.position !== pos && !(p.fantasy_positions ?? []).includes(pos)) continue;
		if (q && !`${p.full_name} ${p.search_full_name ?? ""} ${p.team ?? ""}`.toLowerCase().includes(q)) continue;
		available.push({
			...p,
			pts: row.pts_ppr
		});
		if (available.length >= 80) break;
	}
	const recent = picks.filter((p) => p.player_id).slice(-12).reverse().map((p) => ({
		pick: p.pick_no,
		round: p.round,
		rosterId: p.roster_id,
		teamName: names.get(p.roster_id) ?? `Roster ${p.roster_id}`,
		player: p.player_id ? getPlayer(p.player_id) : null
	}));
	const nTeams = Math.max(1, rosters.length);
	const stock = picks.map((p) => {
		const orig = p.original_roster ?? p.roster_id;
		const slot = (p.pick_no - 1) % nTeams + 1;
		return {
			pickNo: p.pick_no,
			round: p.round,
			label: `R${p.round}.${String(slot).padStart(2, "0")}`,
			rosterId: p.roster_id,
			ownerName: names.get(p.roster_id) ?? `Team ${p.roster_id}`,
			via: orig !== p.roster_id ? names.get(orig) ?? null : null,
			used: Boolean(p.player_id)
		};
	});
	return {
		status: draft?.status ?? "pending",
		pickNo: draft?.pick_no ?? 1,
		total: picks.length,
		onClockRoster: current?.roster_id ?? null,
		onClockName: current ? names.get(current.roster_id) ?? null : null,
		isMyPick: Boolean(current && mine === current.roster_id),
		isCommish: Boolean(userId && league.commish_id === userId),
		locked: league.locked === 1,
		recent,
		available,
		stock
	};
}
async function makePick(userId, leagueId, playerId) {
	const league = await getLeague(leagueId);
	if (league.locked) throw new Error("This desk is locked.");
	const sql = await getSql();
	const draft = (await sql`select * from ff_draft where league_id = ${leagueId}`)[0];
	if (!draft || draft.status !== "live") throw new Error("Draft is not live.");
	const pick = (await sql`select * from ff_picks where league_id = ${leagueId} and pick_no = ${draft.pick_no}`)[0];
	if (!pick) throw new Error("No pick on the clock.");
	const seat = (await getRosters(leagueId)).find((r) => r.roster_id === pick.roster_id);
	const isCommish = league.commish_id === userId;
	if (seat?.owner_id && seat.owner_id !== userId && !isCommish) throw new Error("Not your pick.");
	if (!seat?.owner_id && !isCommish) throw new Error("House pick — wait or ask the commish.");
	await claimPick(leagueId, pick, playerId);
	await flushHousePicks(leagueId);
}
async function claimPick(leagueId, pick, playerId) {
	const sql = await getSql();
	if ((await sql`select player_id from ff_picks where league_id = ${leagueId} and player_id = ${playerId}`)[0]) throw new Error("Already drafted.");
	if (!getPlayer(playerId)) throw new Error("Unknown player.");
	await sql`
    update ff_picks set player_id = ${playerId}, picked_at = ${(/* @__PURE__ */ new Date()).toISOString()}
    where league_id = ${leagueId} and pick_no = ${pick.pick_no}
  `;
	await sql`
    insert into ff_spots (league_id, roster_id, player_id, slot, starter_slot)
    values (${leagueId}, ${pick.roster_id}, ${playerId}, ${"bench"}, ${null})
  `;
	const next = (await sql`
      select * from ff_picks where league_id = ${leagueId} and player_id is null
      order by pick_no limit 1
    `)[0];
	if (!next) await finishDraft(leagueId);
	else await sql`update ff_draft set pick_no = ${next.pick_no} where league_id = ${leagueId}`;
}
async function finishDraft(leagueId) {
	const league = await getLeague(leagueId);
	const slots = parseSlots(league.roster_slots);
	const spots = await getSpots(leagueId);
	const pts = pprMap();
	const sql = await getSql();
	const byRoster = /* @__PURE__ */ new Map();
	for (const s of spots) {
		const arr = byRoster.get(s.roster_id) ?? [];
		arr.push(s);
		byRoster.set(s.roster_id, arr);
	}
	for (const [rosterId, list] of byRoster) {
		const lined = applyLineup(list, slots, pts);
		for (const s of lined) await sql`
        update ff_spots set slot = ${s.slot}, starter_slot = ${s.starter_slot}
        where league_id = ${leagueId} and roster_id = ${rosterId} and player_id = ${s.player_id}
      `;
	}
	if (!(await sql`select week from ff_matchups where league_id = ${leagueId} limit 1`)[0]) {
		const weeks = Math.min(league.regular_weeks ?? 14, (league.playoff_start_week ?? 15) - 1);
		for (const m of makeSchedule(league.team_count, weeks)) await sql`
        insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster, kind)
        values (${leagueId}, ${m.week}, ${m.id}, ${m.home}, ${m.away}, ${"regular"})
      `;
	} else await ensureRemainingSchedule(leagueId);
	await sql`update ff_draft set status = ${"complete"} where league_id = ${leagueId}`;
	await sql`update ff_leagues set status = ${"in_season"} where id = ${leagueId}`;
}
async function flushHousePicks(leagueId) {
	const league = await getLeague(leagueId);
	if (league.locked || league.status !== "drafting") return;
	const sql = await getSql();
	const rosters = await getRosters(leagueId);
	const ranked = rankPool();
	for (let guard = 0; guard < 200; guard++) {
		const draft = (await sql`select * from ff_draft where league_id = ${leagueId}`)[0];
		if (!draft || draft.status !== "live") return;
		const pick = (await sql`select * from ff_picks where league_id = ${leagueId} and pick_no = ${draft.pick_no}`)[0];
		if (!pick || pick.player_id) return;
		if (rosters.find((r) => r.roster_id === pick.roster_id)?.owner_id) return;
		const taken = new Set((await sql`
        select player_id from ff_picks where league_id = ${leagueId} and player_id is not null
      `).map((r) => r.player_id));
		const spots = await getSpots(leagueId);
		const byRoster = /* @__PURE__ */ new Map();
		for (const s of spots) {
			const arr = byRoster.get(s.roster_id) ?? [];
			arr.push(s.player_id);
			byRoster.set(s.roster_id, arr);
		}
		const player = nextAutopick(pick.roster_id, byRoster, ranked, taken);
		if (!player) return;
		await claimPick(leagueId, pick, player.player_id);
	}
}
async function autoFillDraft(userId, leagueId) {
	const league = await getLeague(leagueId);
	if (league.commish_id !== userId) throw new Error("Only the commissioner can fill the board.");
	if (league.locked) throw new Error("This desk is locked.");
	const sql = await getSql();
	const ranked = rankPool();
	for (let guard = 0; guard < 220; guard++) {
		const draft = (await sql`select * from ff_draft where league_id = ${leagueId}`)[0];
		if (!draft || draft.status !== "live") return;
		const pick = (await sql`select * from ff_picks where league_id = ${leagueId} and pick_no = ${draft.pick_no}`)[0];
		if (!pick) return;
		const taken = new Set((await sql`
        select player_id from ff_picks where league_id = ${leagueId} and player_id is not null
      `).map((r) => r.player_id));
		const spots = await getSpots(leagueId);
		const byRoster = /* @__PURE__ */ new Map();
		for (const s of spots) {
			const arr = byRoster.get(s.roster_id) ?? [];
			arr.push(s.player_id);
			byRoster.set(s.roster_id, arr);
		}
		const player = nextAutopick(pick.roster_id, byRoster, ranked, taken);
		if (!player) return;
		await claimPick(leagueId, pick, player.player_id);
	}
}
function invertSlot(label) {
	if (!label) return "FLEX";
	if (label === "FLX") return "FLEX";
	if (label === "DST") return "DEF";
	if (label === "SF") return "SUPER_FLEX";
	return label;
}
async function startPlayer(userId, leagueId, playerId) {
	const league = await getLeague(leagueId);
	if (league.locked) throw new Error("This desk is locked.");
	const mine = (await getRosters(leagueId)).find((r) => r.owner_id === userId);
	if (!mine) throw new Error("You don't have a seat.");
	const sql = await getSql();
	const spots = await sql`
    select * from ff_spots where league_id = ${leagueId} and roster_id = ${mine.roster_id}
  `;
	if (!spots.find((s) => s.player_id === playerId)) throw new Error("Player is not on your roster.");
	const pos = getPlayer(playerId)?.position ?? null;
	const slots = parseSlots(league.roster_slots).filter((s) => START_SLOTS.has(s));
	const used = new Set(spots.filter((s) => s.slot === "starter" && s.starter_slot).map((s) => s.starter_slot));
	let slot = null;
	for (const s of slots) {
		const lab = slotLabel(s);
		if (!used.has(lab) && compatible(pos, s)) {
			slot = lab;
			break;
		}
	}
	if (!slot) {
		const swap = spots.filter((s) => s.slot === "starter" && compatible(pos, invertSlot(s.starter_slot))).sort((a, b) => (pprMap().get(a.player_id) ?? 0) - (pprMap().get(b.player_id) ?? 0))[0];
		if (!swap) throw new Error("No slot for that position.");
		await sql`
      update ff_spots set slot = ${"bench"}, starter_slot = ${null}
      where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${swap.player_id}
    `;
		slot = swap.starter_slot;
	}
	await sql`
    update ff_spots set slot = ${"starter"}, starter_slot = ${slot}
    where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${playerId}
  `;
}
async function sitPlayer(userId, leagueId, playerId) {
	if ((await getLeague(leagueId)).locked) throw new Error("This desk is locked.");
	const mine = (await getRosters(leagueId)).find((r) => r.owner_id === userId);
	if (!mine) throw new Error("You don't have a seat.");
	await (await getSql())`
    update ff_spots set slot = ${"bench"}, starter_slot = ${null}
    where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${playerId}
  `;
}
async function addDrop(userId, leagueId, addId, dropId, bid = 0) {
	return (await import("./ops.server-BA_UgRzY.mjs")).requestAdd(userId, leagueId, addId, dropId, bid);
}
async function previewSleeperImport(sleeperId) {
	const sleeper = await import("./sleeper.server-Bqr0Cv6u.mjs");
	const { fromSleeperSettings } = await import("./scoring-x8-F509i.mjs").then((n) => n.c);
	const pack = await sleeper.loadImportPack(sleeperId.trim());
	const byUser = new Map(pack.users.map((u) => [u.user_id, u]));
	const book = fromSleeperSettings(pack.league.scoring_settings ?? {});
	return {
		sleeperId: pack.league.league_id,
		name: pack.league.name,
		season: pack.league.season,
		status: pack.league.status,
		teamCount: pack.rosters.length,
		scoringLabel: scoringLabel(book),
		teams: pack.rosters.map((r) => {
			const u = r.owner_id ? byUser.get(r.owner_id) : void 0;
			return {
				rosterId: r.roster_id,
				teamName: u?.metadata?.team_name?.trim() || u?.display_name || `Roster ${r.roster_id}`,
				manager: u?.display_name ?? "Open",
				players: (r.players ?? []).length
			};
		})
	};
}
async function importSleeperLeague(input) {
	await ensureDemo();
	const sleeper = await import("./sleeper.server-Bqr0Cv6u.mjs");
	const { fromSleeperSettings } = await import("./scoring-x8-F509i.mjs").then((n) => n.c);
	const pack = await sleeper.loadImportPack(input.sleeperId.trim());
	if (!pack.rosters.length) throw new Error("That Sleeper league has no rosters.");
	const sql = await getSql();
	const existing = await sql`
    select id, invite_code from ff_leagues
    where source_league_id = ${pack.league.league_id} and commish_id = ${input.userId}
  `.catch(() => []);
	if (existing[0]) return {
		leagueId: existing[0].id,
		inviteCode: existing[0].invite_code
	};
	const book = fromSleeperSettings(pack.league.scoring_settings ?? {});
	const preset = presetOf(book);
	const slots = pack.league.roster_positions?.length ? pack.league.roster_positions : DEFAULT_SLOTS;
	const id = nid("lg_");
	let code = inviteCode();
	for (let i = 0; i < 6; i++) {
		if (!(await sql`select id from ff_leagues where invite_code = ${code}`)[0]) break;
		code = inviteCode();
	}
	const byUser = new Map(pack.users.map((u) => [u.user_id, u]));
	const hasPlayers = pack.rosters.some((r) => (r.players ?? []).length > 0);
	const currentWeek = Math.max(1, pack.league.settings.leg ?? pack.league.settings.last_scored_leg ?? 1);
	const playoff = pack.league.settings.playoff_teams ?? (pack.rosters.length >= 12 ? 6 : 4);
	await sql`
    insert into ff_leagues (
      id, name, season, invite_code, commish_id, status, team_count,
      scoring, roster_slots, playoff_teams, current_week, locked,
      scoring_json, source, source_league_id
    ) values (
      ${id}, ${pack.league.name.slice(0, 48)}, ${pack.league.season}, ${code},
      ${input.userId}, ${hasPlayers ? "in_season" : "pre_draft"}, ${pack.rosters.length}, ${preset},
      ${JSON.stringify(slots)}, ${playoff}, ${currentWeek}, ${0},
      ${JSON.stringify(book)}, ${"sleeper"}, ${pack.league.league_id}
    )
  `;
	await sql`
    insert into ff_draft (league_id, status, pick_no)
    values (${id}, ${hasPlayers ? "complete" : "pending"}, ${1})
  `;
	for (const r of pack.rosters) {
		const u = r.owner_id ? byUser.get(r.owner_id) : void 0;
		const teamName = u?.metadata?.team_name?.trim() || u?.display_name || `Roster ${r.roster_id}`;
		const claim = input.claimRosterId === r.roster_id ? input.userId : null;
		await sql`
      insert into ff_rosters (league_id, roster_id, team_name, owner_id, sleeper_owner_id, manager_name)
      values (${id}, ${r.roster_id}, ${teamName.slice(0, 40)}, ${claim}, ${r.owner_id}, ${u?.display_name ?? null})
    `;
		const starters = r.starters ?? [];
		const startSlots = slots.filter((s) => START_SLOTS.has(s));
		for (const pid of r.players ?? []) {
			if (!pid || pid === "0") continue;
			const idx = starters.indexOf(pid);
			const starter = idx >= 0;
			const lab = starter ? slotLabel(startSlots[idx] ?? "FLEX") : null;
			await sql`
        insert into ff_spots (league_id, roster_id, player_id, slot, starter_slot)
        values (${id}, ${r.roster_id}, ${pid}, ${starter ? "starter" : "bench"}, ${lab})
      `;
		}
	}
	for (const week of pack.weeks) {
		if (!week.rows.length) continue;
		const groups = /* @__PURE__ */ new Map();
		let orphan = 1e3;
		for (const m of week.rows) {
			const key = m.matchup_id ?? orphan++;
			const arr = groups.get(key) ?? [];
			arr.push(m);
			groups.set(key, arr);
		}
		for (const [matchupId, arr] of groups) {
			const home = arr[0];
			const away = arr[1];
			await sql`
        insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster)
        values (${id}, ${week.week}, ${matchupId}, ${home.roster_id}, ${away?.roster_id ?? null})
      `;
		}
		for (const m of week.rows) await sql`
        insert into ff_week_results (league_id, week, roster_id, points, starters_json)
        values (
          ${id}, ${week.week}, ${m.roster_id}, ${m.points},
          ${JSON.stringify(m.starters.map((pid, i) => ({
			playerId: pid,
			points: m.starters_points[i] ?? 0
		})))}
        )
      `;
	}
	if (!pack.weeks.some((w) => w.rows.length)) for (const m of makeSchedule(pack.rosters.length, 14)) await sql`
        insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster)
        values (${id}, ${m.week}, ${m.id}, ${m.home}, ${m.away})
      `;
	const pStart = pack.league.settings.playoff_week_start ?? 15;
	await sql`
    update ff_leagues
    set playoff_start_week = ${pStart}, regular_weeks = ${Math.max(8, pStart - 1)}
    where id = ${id}
  `;
	await armLeagueOps(id);
	return {
		leagueId: id,
		inviteCode: code
	};
}
async function previewEspnImport(input) {
	const pack = await (await import("./espn-ff.server-DgZHQXNI.mjs")).loadEspnImportPack(input);
	return {
		sleeperId: `espn:${pack.season}:${pack.leagueId}`,
		name: pack.name,
		season: pack.season,
		status: pack.status,
		teamCount: pack.teamCount,
		scoringLabel: pack.scoringLabel,
		teams: pack.teams.map((t) => ({
			rosterId: t.rosterId,
			teamName: t.teamName,
			manager: t.manager,
			players: t.players.length
		}))
	};
}
async function importEspnLeague(input) {
	await ensureDemo();
	const pack = await (await import("./espn-ff.server-DgZHQXNI.mjs")).loadEspnImportPack({
		leagueId: input.leagueId,
		season: input.season,
		swid: input.swid,
		espnS2: input.espnS2
	});
	if (!pack.teams.length) throw new Error("That ESPN league has no teams.");
	const sql = await getSql();
	const sourceId = `espn:${pack.season}:${pack.leagueId}`;
	const existing = await sql`
    select id, invite_code from ff_leagues
    where source_league_id = ${sourceId} and commish_id = ${input.userId}
  `.catch(() => []);
	if (existing[0]) return {
		leagueId: existing[0].id,
		inviteCode: existing[0].invite_code
	};
	const id = nid("lg_");
	let code = inviteCode();
	for (let i = 0; i < 6; i++) {
		if (!(await sql`select id from ff_leagues where invite_code = ${code}`)[0]) break;
		code = inviteCode();
	}
	const preset = presetOf(pack.book);
	const hasPlayers = pack.teams.some((t) => t.players.length > 0);
	await sql`
    insert into ff_leagues (
      id, name, season, invite_code, commish_id, status, team_count,
      scoring, roster_slots, playoff_teams, current_week, locked,
      scoring_json, source, source_league_id
    ) values (
      ${id}, ${pack.name.slice(0, 48)}, ${pack.season}, ${code},
      ${input.userId}, ${hasPlayers ? "in_season" : "pre_draft"}, ${pack.teamCount},
      ${preset}, ${JSON.stringify(pack.slots)}, ${pack.playoffTeams}, ${pack.currentWeek},
      ${0}, ${JSON.stringify(pack.book)}, ${"espn"}, ${sourceId}
    )
  `;
	await sql`
    insert into ff_draft (league_id, status, pick_no)
    values (${id}, ${hasPlayers ? "complete" : "pending"}, ${1})
  `;
	for (const t of pack.teams) {
		const claim = input.claimRosterId === t.rosterId ? input.userId : null;
		await sql`
      insert into ff_rosters (league_id, roster_id, team_name, owner_id, sleeper_owner_id, manager_name)
      values (${id}, ${t.rosterId}, ${t.teamName}, ${claim}, ${t.ownerKey}, ${t.manager})
    `;
		for (const p of t.players) await sql`
        insert into ff_spots (league_id, roster_id, player_id, slot, starter_slot)
        values (${id}, ${t.rosterId}, ${p.sleeperId}, ${p.slot}, ${p.starterSlot})
        on conflict do nothing
      `;
	}
	for (const week of pack.weeks) {
		for (const g of week.games) {
			if (!g.home) continue;
			await sql`
        insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster)
        values (${id}, ${week.week}, ${g.matchupId}, ${g.home}, ${g.away})
        on conflict do nothing
      `;
		}
		for (const r of week.results) await sql`
        insert into ff_week_results (league_id, week, roster_id, points, starters_json)
        values (${id}, ${week.week}, ${r.rosterId}, ${r.points}, ${JSON.stringify(r.starters)})
        on conflict do nothing
      `;
	}
	await armLeagueOps(id);
	return {
		leagueId: id,
		inviteCode: code
	};
}
async function previewRebuild(input) {
	const { parseRebuildPaste } = await import("./rebuild-DDdCV14e.mjs");
	const { matchPlayerName } = await import("./sleeper.server-Bqr0Cv6u.mjs");
	const teams = parseRebuildPaste(input.paste);
	if (teams.length < 2) throw new Error("Need at least two teams. One block per team.");
	return {
		sleeperId: "rebuild",
		name: input.name.trim() || "Rebuilt league",
		season: input.season,
		status: "in_season",
		teamCount: teams.length,
		scoringLabel: scoringLabel(bookFromPreset(input.scoring)),
		teams: teams.map((t, i) => {
			const matched = t.names.map((n) => ({
				name: n,
				player: matchPlayerName(n)
			}));
			return {
				rosterId: i + 1,
				teamName: t.teamName,
				manager: t.manager,
				players: matched.filter((m) => m.player).length,
				unmatched: matched.filter((m) => !m.player).map((m) => m.name),
				record: t.wins != null ? `${t.wins}-${t.losses ?? 0}${t.ties ? `-${t.ties}` : ""}${t.pf != null ? ` · ${t.pf.toFixed(1)} PF` : ""}` : null
			};
		})
	};
}
async function ensureSnapColumns() {
	const sql = await getSql();
	await sql.query(`alter table ff_rosters add column if not exists snap_wins int`);
	await sql.query(`alter table ff_rosters add column if not exists snap_losses int`);
	await sql.query(`alter table ff_rosters add column if not exists snap_ties int`);
	await sql.query(`alter table ff_rosters add column if not exists snap_pf real`);
	await sql.query(`alter table ff_rosters add column if not exists snap_pa real`);
}
async function importRebuild(input) {
	await ensureDemo();
	await ensureSnapColumns();
	const { parseRebuildPaste } = await import("./rebuild-DDdCV14e.mjs");
	const { matchPlayerName } = await import("./sleeper.server-Bqr0Cv6u.mjs");
	const teams = parseRebuildPaste(input.paste);
	if (teams.length < 2) throw new Error("Need at least two teams.");
	if (teams.length > 14) throw new Error("14 teams max for now.");
	const sql = await getSql();
	const id = nid("lg_");
	let code = inviteCode();
	for (let i = 0; i < 6; i++) {
		if (!(await sql`select id from ff_leagues where invite_code = ${code}`)[0]) break;
		code = inviteCode();
	}
	const book = bookFromPreset(input.scoring);
	const name = input.name.trim().slice(0, 48) || "Rebuilt league";
	const season = input.season === "2026" ? "2026" : "2025";
	const playoff = teams.length >= 12 ? 6 : 4;
	const hasRecord = teams.some((t) => t.wins != null);
	await sql`
    insert into ff_leagues (
      id, name, season, invite_code, commish_id, status, team_count,
      scoring, roster_slots, playoff_teams, current_week, locked,
      scoring_json, source
    ) values (
      ${id}, ${name}, ${season}, ${code}, ${input.userId},
      ${"in_season"}, ${teams.length}, ${input.scoring},
      ${JSON.stringify(DEFAULT_SLOTS)}, ${playoff}, ${season === "2025" ? 14 : 1},
      ${0}, ${JSON.stringify(book)}, ${"rebuild"}
    )
  `;
	await sql`insert into ff_draft (league_id, status, pick_no) values (${id}, ${"complete"}, ${1})`;
	const pts = pprMap();
	for (let i = 0; i < teams.length; i++) {
		const t = teams[i];
		const rosterId = i + 1;
		const claim = input.claimRosterId === rosterId ? input.userId : null;
		await sql`
      insert into ff_rosters (
        league_id, roster_id, team_name, owner_id, manager_name,
        snap_wins, snap_losses, snap_ties, snap_pf, snap_pa
      ) values (
        ${id}, ${rosterId}, ${t.teamName}, ${claim}, ${t.manager},
        ${t.wins}, ${t.losses}, ${t.ties}, ${t.pf}, ${t.pa}
      )
    `;
		const ids = [];
		for (const name of t.names) {
			const p = matchPlayerName(name);
			if (p && !ids.includes(p.player_id)) ids.push(p.player_id);
		}
		const lined = applyLineup(ids.map((player_id) => ({
			league_id: id,
			roster_id: rosterId,
			player_id,
			slot: "bench",
			starter_slot: null
		})), DEFAULT_SLOTS, pts);
		for (const s of lined) await sql`
        insert into ff_spots (league_id, roster_id, player_id, slot, starter_slot)
        values (${id}, ${rosterId}, ${s.player_id}, ${s.slot}, ${s.starter_slot})
        on conflict do nothing
      `;
	}
	if (!hasRecord || season === "2026") for (const m of makeSchedule(teams.length, season === "2025" ? 14 : 14)) await sql`
        insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster)
        values (${id}, ${m.week}, ${m.id}, ${m.home}, ${m.away})
      `;
	await armLeagueOps(id);
	return {
		leagueId: id,
		inviteCode: code
	};
}
async function loadSettings(leagueId, userId) {
	const row = await getLeague(leagueId);
	const rosters = await getRosters(leagueId);
	return {
		leagueId: row.id,
		name: row.name,
		season: row.season,
		inviteCode: row.invite_code,
		isCommish: Boolean(userId && row.commish_id === userId),
		locked: row.locked === 1,
		scoring: presetOf(bookOf(row)),
		book: bookOf(row),
		playoffTeams: row.playoff_teams,
		currentWeek: row.current_week,
		source: row.source ?? "ledger",
		sourceLeagueId: row.source_league_id ?? null,
		waiverType: row.waiver_type ?? "faab",
		faabBudget: row.faab_budget ?? 100,
		tradeDeadlineWeek: row.trade_deadline_week ?? 11,
		playoffStartWeek: row.playoff_start_week ?? 15,
		regularWeeks: row.regular_weeks ?? 14,
		lastWaiverWeek: row.last_waiver_week ?? 0,
		teams: rosters.map((r) => ({
			rosterId: r.roster_id,
			teamName: r.team_name,
			manager: managerOf(r),
			ownerId: r.owner_id,
			open: !r.owner_id,
			faab: r.faab_remaining ?? row.faab_budget ?? 100,
			waiverOrder: r.waiver_order ?? r.roster_id
		}))
	};
}
async function saveSettings(userId, leagueId, input) {
	const row = await getLeague(leagueId);
	if (row.commish_id !== userId) throw new Error("Only the commissioner can change settings.");
	if (row.locked) throw new Error("This desk is locked.");
	const sql = await getSql();
	const name = input.name?.trim().slice(0, 48) || row.name;
	const book = input.book ? {
		...bookOf(row),
		...input.book
	} : bookOf(row);
	const preset = presetOf(book);
	const playoff = input.playoffTeams ?? row.playoff_teams;
	const week = Math.min(18, Math.max(1, input.currentWeek ?? row.current_week));
	const waiverType = input.waiverType ?? row.waiver_type ?? "faab";
	const faab = input.faabBudget ?? row.faab_budget ?? 100;
	const deadline = input.tradeDeadlineWeek ?? row.trade_deadline_week ?? 11;
	const pStart = input.playoffStartWeek ?? row.playoff_start_week ?? 15;
	const regular = input.regularWeeks ?? row.regular_weeks ?? 14;
	await sql`
    update ff_leagues
    set name = ${name}, scoring = ${preset}, scoring_json = ${JSON.stringify(book)},
        playoff_teams = ${playoff}, current_week = ${week},
        waiver_type = ${waiverType}, faab_budget = ${faab},
        trade_deadline_week = ${deadline}, playoff_start_week = ${pStart},
        regular_weeks = ${regular}
    where id = ${leagueId}
  `;
	await ensureRemainingSchedule(leagueId);
}
async function claimRoster(userId, leagueId, rosterId) {
	if ((await getLeague(leagueId)).locked) throw new Error("This desk is locked.");
	const sql = await getSql();
	if ((await sql`select * from ff_rosters where league_id = ${leagueId} and owner_id = ${userId}`)[0]) throw new Error("You already have a seat.");
	const seat = (await sql`select * from ff_rosters where league_id = ${leagueId} and roster_id = ${rosterId}`)[0];
	if (!seat) throw new Error("No such team.");
	if (seat.owner_id) throw new Error("That seat is taken.");
	await sql`
    update ff_rosters set owner_id = ${userId}
    where league_id = ${leagueId} and roster_id = ${rosterId}
  `;
}
//#endregion
export { addDrop, autoFillDraft, claimRoster, createLeague, ensureDemo, ensureRemainingSchedule, flushHousePicks, importEspnLeague, importRebuild, importSleeperLeague, joinLeague, listMyLeagues, loadActivity, loadDraft, loadLeagueBundle, loadMatchups, loadSettings, loadTeam, loadWire, makePick, previewEspnImport, previewRebuild, previewSleeperImport, saveSettings, sitPlayer, startDraft, startPlayer };
