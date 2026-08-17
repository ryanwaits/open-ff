/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck — restored from the last good build; public fns below stay typed.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSql } from "@/lib/db";
import { getPlayer, playerName } from "@/lib/data/sleeper.server";
import { slotLabel, START_SLOTS } from "@/lib/data/teams";
import type {
  ActivityItem,
  LeagueBundle,
  MatchupPair,
  SlimPlayer,
  TeamBundle,
  WirePlayer,
} from "@/lib/data/types";
import {
  applyBook,
  bookFromPreset,
  fromSleeperSettings,
  isClassicPreset,
  parseBook,
  presetOf,
  scoringLabel,
} from "./scoring";
import { clampPlayoffByes, defaultPlayoffByes, playoffRoundLabel } from "./playoffs";
import { recordEvent } from "./events.server";
import { invertSlotKey, labeledStartSlots, normalizeSlots, slotBreakdown } from "./roster";

export const DEMO_HOSTED_ID = "lg_backyard";
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
	"The Rim",
	"Hellbox",
	"The Slot",
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
		const { fetchWeekStats } = await import("@/lib/data/live.server");
		const raw = await fetchWeekStats(row.season, week, "regular");
		const out = {};
		for (const [id, line] of Object.entries(raw)) out[id] = applyBook(book, line);
		return out;
	} catch {
		const { fetchWeekPoints } = await import("@/lib/data/live.server");
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
function playoffLabel(kind, round, playoffTeams, bye, playoffByes) {
	if (kind !== "playoff") return null;
	return playoffRoundLabel(round ?? 1, playoffTeams, playoffByes ?? defaultPlayoffByes(playoffTeams), Boolean(bye));
}
export async function ensureRemainingSchedule(leagueId: string): Promise<void> {
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
	const ops = await import("./ops.server");
	await ops.ensureOpsSchema();
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
	const labeled = labeledStartSlots(slots);
	const used = /* @__PURE__ */ new Set();
	const next = spots.map((s) => ({
		...s,
		slot: "bench",
		starter_slot: null
	}));
	const byPts = [...next].sort((a, b) => (pts.get(b.player_id) ?? 0) - (pts.get(a.player_id) ?? 0));
	for (const { key, label } of labeled) {
		const pick = byPts.find((s) => !used.has(s.player_id) && compatible(getPlayer(s.player_id)?.position, key));
		if (!pick) continue;
		used.add(pick.player_id);
		pick.slot = "starter";
		pick.starter_slot = label;
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
export async function ensureDemo(): Promise<void> {
	(await import("./ops.server")).startLeagueClock();
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
		const lockedHome = lockedMap.get(`${m.week}:${m.home_roster}`);
		const lockedAway = m.away_roster != null ? lockedMap.get(`${m.week}:${m.away_roster}`) : null;
		// 0–0 with no prior week locked is unplayed — do not book it as a tie.
		const played =
			hp !== 0 ||
			ap !== 0 ||
			(m.week < row.current_week && (lockedHome != null || lockedAway != null));
		if (!played) continue;
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
export async function loadLeagueBundle(leagueId: string, userId: string | null, opts?: { tick?: boolean }): Promise<LeagueBundle> {
	await ensureDemo();
	let row = await getLeague(leagueId);
	if (opts?.tick !== false && row.locked !== 1 && row.status !== "pre_draft" && row.status !== "drafting") try {
		await (await import("./ops.server")).tickLeague(leagueId);
		row = await getLeague(leagueId);
	} catch {}
	const rosters = await getRosters(leagueId);
	const standings = await scoredStandings(row, rosters, await getSpots(leagueId));
	const mine = userId ? rosters.find((r) => r.owner_id === userId)?.roster_id ?? null : null;
	const draft = (await (await getSql())`select * from ff_draft where league_id = ${leagueId}`)[0];
	const draftStatus = draft?.status === "live" || draft?.status === "pending" || draft?.status === "complete" ? draft.status : "pending";
	let scoringLive = false;
	try {
		const { weekBoard } = await import("@/lib/data/live.server");
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
		lineup: slotBreakdown(parseSlots(row.roster_slots)),
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
			playoffByes: row.playoff_byes ?? defaultPlayoffByes(row.playoff_teams),
			lastWaiverWeek: row.last_waiver_week ?? 0,
			waiversOpen: (row.waiver_type ?? "faab") !== "none" && (row.last_waiver_week ?? 0) < row.current_week
		}
	};
}
function sideFrom(roster, spots, slots, pts, games) {
	const labeled = labeledStartSlots(slots);
	const remaining = spots.filter((s) => s.roster_id === roster.roster_id && s.slot === "starter");
	const starters = labeled.map(({ key, label }) => {
		let idx = remaining.findIndex((s) => s.starter_slot === label);
		if (idx < 0) idx = remaining.findIndex((s) => invertSlotKey(s.starter_slot) === key);
		const hit = idx >= 0 ? remaining.splice(idx, 1)[0] : void 0;
		const player = hit ? getPlayer(hit.player_id) : null;
		return {
			slot: label,
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
export async function loadMatchups(leagueId: string, week: number): Promise<MatchupPair[]> {
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
		const { weekBoard } = await import("@/lib/data/live.server");
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
			label: playoffLabel(kind, playoffRound, row.playoff_teams, m.away_roster == null, row.playoff_byes)
		};
	});
}
export async function loadTeam(leagueId: string, rosterId: number, week: number): Promise<TeamBundle> {
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
		const { weekBoard } = await import("@/lib/data/live.server");
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
export async function loadWire(leagueId: string, position: string, query: string): Promise<WirePlayer[]> {
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
export async function loadActivity(leagueId: string, _week: number): Promise<ActivityItem[]> {
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
export async function listMyLeagues(userId: string): Promise<{ leagueId: string; name: string; season: string; status: string; role: string }[]> {
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
export async function createLeague(input: { userId: string; name: string; teamName: string; teamCount: number; scoring: "ppr" | "half" | "std"; fillHouse: boolean }): Promise<{ leagueId: string; inviteCode: string; season: string }> {
	await ensureDemo();
	const sql = await getSql();
	const name = input.name.trim().slice(0, 40);
	const teamName = input.teamName.trim().slice(0, 28);
	if (name.length < 2) throw new Error("Name your league.");
	if (teamName.length < 2) throw new Error("Name your team.");
	const teamCount = [8, 10, 12, 14].includes(input.teamCount) ? input.teamCount : 10;
	const id = nid("lg_");
	let code = inviteCode();
	for (let i = 0; i < 6; i++) {
		if (!(await sql`select id from ff_leagues where invite_code = ${code}`)[0]) break;
		code = inviteCode();
	}
	const playoff = teamCount >= 14 ? 7 : teamCount >= 12 ? 6 : 4;
	const byes = defaultPlayoffByes(playoff);
	const book = bookFromPreset(input.scoring);
	const ops = await import("./ops.server");
	await ops.ensureOpsSchema();
	let season = String(new Date().getUTCFullYear());
	try {
		const { fetchNflState } = await import("@/lib/data/sleeper.server");
		season = String((await fetchNflState()).season);
	} catch {
		/* keep calendar year */
	}
	await sql`
    insert into ff_leagues (
      id, name, season, invite_code, commish_id, status, team_count,
      scoring, roster_slots, playoff_teams, current_week, locked, scoring_json, source,
      playoff_byes
    ) values (
      ${id}, ${name}, ${season}, ${code}, ${input.userId}, ${"pre_draft"},
      ${teamCount}, ${input.scoring}, ${JSON.stringify(DEFAULT_SLOTS)},
      ${playoff}, ${1}, ${0}, ${JSON.stringify(book)}, ${"ledger"}, ${byes}
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
	await ops.seedRosterOps(id);
	await ops.ensureDraftBoard(id);
	// Genesis. Every dollar the league will ever hold is minted here — the
	// managers' budgets by seedRosterOps above, and the house pool now. Nothing
	// creates FAAB after this, which is what makes the ledger auditable.
	try {
		const { seedPool } = await import("./wagers.server");
		const seed = Math.max(0, Math.round(teamCount * 20));
		await sql`update ff_leagues set pool_seed = ${seed} where id = ${id}`;
		await seedPool(id, seed);
	} catch {
		/* a league without a pool simply has betting switched off */
	}
	return {
		leagueId: id,
		inviteCode: code,
		season
	};
}
export async function joinLeague(userId: string, code: string, teamName: string, rosterId?: number | null): Promise<{ leagueId: string; season: string; name: string }> {
	await ensureDemo();
	const sql = await getSql();
	const league = (await sql`select * from ff_leagues where invite_code = ${code.trim().toUpperCase()}`)[0];
	if (!league) throw new Error("No league uses that code.");
	if (league.locked) throw new Error("That league is locked.");
	if ((await sql`select * from ff_rosters where league_id = ${league.id} and owner_id = ${userId}`)[0]) {
		return { leagueId: league.id, season: league.season, name: league.name };
	}
	const seat = rosterId
		? (await sql`select * from ff_rosters where league_id = ${league.id} and roster_id = ${rosterId} and owner_id is null`)[0]
		: (await sql`
      select * from ff_rosters
      where league_id = ${league.id} and owner_id is null
      order by roster_id
      limit 1
    `)[0];
	if (!seat) throw new Error(rosterId ? "That seat is taken." : "League is full.");
	const keepName = teamName.trim() || seat.team_name;
	await sql`
    update ff_rosters set owner_id = ${userId}, team_name = ${keepName.slice(0, 28) || `Club ${seat.roster_id}`}
    where league_id = ${league.id} and roster_id = ${seat.roster_id}
  `;
	return { leagueId: league.id, season: league.season, name: league.name };
}
export async function startDraft(userId: string, leagueId: string): Promise<void> {
	const league = await getLeague(leagueId);
	if (league.commish_id !== userId) throw new Error("Only the commissioner can open the draft.");
	if (league.locked) throw new Error("This desk is locked.");
	if (league.status !== "pre_draft") throw new Error("Draft already started.");
	await (await import("./ops.server")).ensureDraftBoard(leagueId);
	const sql = await getSql();
	await sql`update ff_draft set status = ${"live"}, pick_no = ${1} where league_id = ${leagueId}`;
	await sql`update ff_leagues set status = ${"drafting"} where id = ${leagueId}`;
	await flushHousePicks(leagueId);
}
export async function loadDraft(
  leagueId: string,
  userId: string | null,
  position: string,
  query: string,
): Promise<{
  status: string;
  pickNo: number;
  total: number;
  onClockRoster: number | null;
  onClockName: string | null;
  isMyPick: boolean;
  isCommish: boolean;
  locked: boolean;
  recent: { pick: number; round: number; rosterId: number; teamName: string; player: ReturnType<typeof getPlayer> }[];
  available: (SlimPlayer & { pts: number })[];
  stock: {
    pickNo: number;
    round: number;
    label: string;
    rosterId: number;
    ownerName: string;
    via: string | null;
    used: boolean;
  }[];
}> {
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
export async function makePick(userId: string, leagueId: string, playerId: string): Promise<void> {
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
export async function flushHousePicks(leagueId: string): Promise<void> {
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
export async function autoFillDraft(userId: string, leagueId: string): Promise<void> {
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
	return invertSlotKey(label);
}
export async function startPlayer(userId: string, leagueId: string, playerId: string, replaceId?: string | null, slot?: string | null): Promise<void> {
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
	if (replaceId) {
		const swap = spots.find((s) => s.player_id === replaceId && s.slot === "starter");
		if (!swap) throw new Error("That player is not in a start slot.");
		if (!compatible(pos, invertSlot(swap.starter_slot))) throw new Error("That slot does not take this position.");
		await sql`
      update ff_spots set slot = ${"bench"}, starter_slot = ${null}
      where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${swap.player_id}
    `;
		await sql`
      update ff_spots set slot = ${"starter"}, starter_slot = ${swap.starter_slot}
      where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${playerId}
    `;
		await recordEvent({
			leagueId,
			week: league.current_week,
			kind: "lineup_set",
			actorRoster: mine.roster_id,
			playerId,
			payload: { slot: swap.starter_slot, benched: swap.player_id, via: "swap" }
		});
		return;
	}
	if (slot) {
		if (!compatible(pos, invertSlot(slot))) throw new Error("That slot does not take this position.");
		const occupant = spots.find((s) => s.slot === "starter" && s.starter_slot === slot);
		if (occupant) {
			await sql`
        update ff_spots set slot = ${"bench"}, starter_slot = ${null}
        where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${occupant.player_id}
      `;
		}
		await sql`
      update ff_spots set slot = ${"starter"}, starter_slot = ${slot}
      where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${playerId}
    `;
		await recordEvent({
			leagueId,
			week: league.current_week,
			kind: "lineup_set",
			actorRoster: mine.roster_id,
			playerId,
			payload: { slot, benched: occupant?.player_id ?? null, via: "slot" }
		});
		return;
	}
	const labeled = labeledStartSlots(parseSlots(league.roster_slots));
	const used = new Set(spots.filter((s) => s.slot === "starter" && s.starter_slot).map((s) => s.starter_slot));
	let next = null;
	for (const { key, label } of labeled) {
		if (!used.has(label) && compatible(pos, key)) {
			next = label;
			break;
		}
	}
	if (!next) throw new Error("Pick a starter to replace.");
	await sql`
    update ff_spots set slot = ${"starter"}, starter_slot = ${next}
    where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${playerId}
  `;
	await recordEvent({
		leagueId,
		week: league.current_week,
		kind: "lineup_set",
		actorRoster: mine.roster_id,
		playerId,
		payload: { slot: next, benched: null, via: "auto" }
	});
}
export async function sitPlayer(userId: string, leagueId: string, playerId: string): Promise<void> {
	const league = await getLeague(leagueId);
	if (league.locked) throw new Error("This desk is locked.");
	const mine = (await getRosters(leagueId)).find((r) => r.owner_id === userId);
	if (!mine) throw new Error("You don't have a seat.");
	const sql = await getSql();
	const before = (await sql<{ starter_slot: string | null }>`
    select starter_slot from ff_spots
    where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${playerId}
  `)[0];
	await sql`
    update ff_spots set slot = ${"bench"}, starter_slot = ${null}
    where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${playerId}
  `;
	// The slot he vacated is the part worth keeping: an empty FLEX on Sunday is
	// a story, and after the write there is nothing left to say which one it was.
	await recordEvent({
		leagueId,
		week: league.current_week,
		kind: "lineup_benched",
		actorRoster: mine.roster_id,
		playerId,
		payload: { fromSlot: before?.starter_slot ?? null }
	});
}
export async function addDrop(userId: string, leagueId: string, addId: string, dropId: string | null, bid = 0): Promise<{ mode: "claim" | "free_agent" }> {
	return (await import("./ops.server")).requestAdd(userId, leagueId, addId, dropId, bid);
}
export async function previewSleeperImport(sleeperId: string): Promise<{
  sleeperId: string;
  name: string;
  season: string;
  status: string;
  teamCount: number;
  scoringLabel: string;
  teams: { rosterId: number; teamName: string; manager: string; players: number }[];
}> {
	const sleeper = await import("@/lib/data/sleeper.server");
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
export async function importSleeperLeague(input: { userId: string; sleeperId: string; claimRosterId: number | null }): Promise<{ leagueId: string; inviteCode: string }> {
	await ensureDemo();
	const sleeper = await import("@/lib/data/sleeper.server");
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
export async function previewEspnImport(input: { leagueId: string; season: string; swid?: string; espnS2?: string }): Promise<{
  sleeperId: string;
  name: string;
  season: string;
  status: string;
  teamCount: number;
  scoringLabel: string;
  teams: { rosterId: number; teamName: string; manager: string; players: number; unmatched?: string[]; record?: string | null }[];
}> {
	const pack = await (await import("@/lib/data/espn-ff.server")).loadEspnImportPack(input);
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
export async function importEspnLeague(input: { userId: string; leagueId: string; season: string; claimRosterId: number | null; swid?: string; espnS2?: string }): Promise<{ leagueId: string; inviteCode: string }> {
	await ensureDemo();
	const pack = await (await import("@/lib/data/espn-ff.server")).loadEspnImportPack({
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
export async function previewRebuild(input: {
  paste?: string;
  known?: string;
  pdfBase64?: string;
  teams?: {
    teamName: string;
    manager: string;
    wins: number | null;
    losses: number | null;
    ties: number | null;
    pf: number | null;
    pa: number | null;
    names: string[];
  }[];
  name: string;
  season: string;
  scoring: "ppr" | "half" | "std";
}): Promise<{
  sleeperId: string;
  name: string;
  season: string;
  status: string;
  teamCount: number;
  scoringLabel: string;
  format: string;
  knownId: string | null;
  warnings: string[];
  pickCount: number;
  playoffTeams: number;
  playoffByes: number;
  teams: {
    rosterId: number;
    teamName: string;
    manager: string;
    names: string[];
    wins: number | null;
    losses: number | null;
    ties: number | null;
    pf: number | null;
    pa: number | null;
    players: number;
    unmatched: string[];
    matched: { name: string; playerId: string | null; pos: string | null }[];
    record: string | null;
  }[];
}> {
	const { parseImportSource } = await import("./recap");
	const { matchPlayerName } = await import("@/lib/data/sleeper.server");
	const parsed = parseImportSource({
		paste: input.paste,
		known: input.known,
		pdfBase64: input.pdfBase64,
		teams: input.teams,
	});
	if (parsed.teams.length < 2) {
		throw new Error(parsed.warnings[0] ?? "Need at least two teams. One block per team.");
	}
	const playoffTeams = parsed.teams.length >= 14 ? 7 : parsed.teams.length >= 12 ? 6 : 4;
	return {
		sleeperId: parsed.knownId ?? "rebuild",
		name: input.name.trim() || parsed.suggestedName || "Rebuilt league",
		season: input.season || parsed.suggestedSeason || "2026",
		status: "in_season",
		teamCount: parsed.teams.length,
		scoringLabel: scoringLabel(bookFromPreset(input.scoring)),
		format: parsed.format,
		knownId: parsed.knownId,
		warnings: parsed.warnings,
		pickCount: parsed.pickCount,
		playoffTeams,
		playoffByes: defaultPlayoffByes(playoffTeams),
		teams: parsed.teams.map((t, i) => {
			const matched = t.names.map((n) => {
				const player = matchPlayerName(n);
				return {
					name: n,
					playerId: player?.player_id ?? null,
					pos: player?.position ?? null,
				};
			});
			return {
				rosterId: i + 1,
				teamName: t.teamName,
				manager: t.manager,
				names: t.names,
				wins: t.wins,
				losses: t.losses,
				ties: t.ties,
				pf: t.pf,
				pa: t.pa,
				players: matched.filter((m) => m.playerId).length,
				unmatched: matched.filter((m) => !m.playerId).map((m) => m.name),
				matched,
				record:
					t.wins != null
						? `${t.wins}-${t.losses ?? 0}${t.ties ? `-${t.ties}` : ""}${t.pf != null ? ` · ${t.pf.toFixed(1)} PF` : ""}`
						: null,
			};
		}),
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
export async function importRebuild(input: {
  userId: string;
  paste?: string;
  known?: string;
  pdfBase64?: string;
  teams?: {
    teamName: string;
    manager: string;
    wins: number | null;
    losses: number | null;
    ties: number | null;
    pf: number | null;
    pa: number | null;
    names: string[];
  }[];
  name: string;
  season: string;
  scoring: "ppr" | "half" | "std";
  claimRosterId: number | null;
}): Promise<{ leagueId: string; inviteCode: string }> {
	await ensureDemo();
	await ensureSnapColumns();
	const { parseImportSource } = await import("./recap");
	const { matchPlayerName } = await import("@/lib/data/sleeper.server");
	const parsed = parseImportSource({
		paste: input.paste,
		known: input.known,
		pdfBase64: input.pdfBase64,
		teams: input.teams,
	});
	const teams = parsed.teams;
	if (teams.length < 2) throw new Error(parsed.warnings[0] ?? "Need at least two teams.");
	if (teams.length > 14) throw new Error("14 teams max for now.");
	const sql = await getSql();
	const ops = await import("./ops.server");
	await ops.ensureOpsSchema();
	const id = nid("lg_");
	let code = inviteCode();
	for (let i = 0; i < 6; i++) {
		if (!(await sql`select id from ff_leagues where invite_code = ${code}`)[0]) break;
		code = inviteCode();
	}
	const book = bookFromPreset(input.scoring);
	const name = (input.name.trim() || parsed.suggestedName || "Rebuilt league").slice(0, 48);
	const season = input.season === "2025" ? "2025" : parsed.suggestedSeason || input.season || "2026";
	const playoff = teams.length >= 14 ? 7 : teams.length >= 12 ? 6 : 4;
	const byes = defaultPlayoffByes(playoff);
	const hasRecord = teams.some((t) => t.wins != null);
	await sql`
    insert into ff_leagues (
      id, name, season, invite_code, commish_id, status, team_count,
      scoring, roster_slots, playoff_teams, current_week, locked,
      scoring_json, source, playoff_byes
    ) values (
      ${id}, ${name}, ${season}, ${code}, ${input.userId},
      ${"in_season"}, ${teams.length}, ${input.scoring},
      ${JSON.stringify(DEFAULT_SLOTS)}, ${playoff}, ${season === "2025" ? 14 : 1},
      ${0}, ${JSON.stringify(book)}, ${"rebuild"}, ${byes}
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
		for (const playerName of t.names) {
			const p = matchPlayerName(playerName);
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
	if (!hasRecord || season === "2026") for (const m of makeSchedule(teams.length, 14)) await sql`
        insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster)
        values (${id}, ${m.week}, ${m.id}, ${m.home}, ${m.away})
      `;
	await armLeagueOps(id);
	return {
		leagueId: id,
		inviteCode: code
	};
}
export async function loadSettings(leagueId: string, userId: string | null): Promise<{
  leagueId: string;
  name: string;
  season: string;
  inviteCode: string;
  isCommish: boolean;
  locked: boolean;
  scoring: "ppr" | "half" | "std";
  book: ReturnType<typeof bookOf>;
  playoffTeams: number;
  currentWeek: number;
  source: string;
  sourceLeagueId: string | null;
  waiverType: string;
  faabBudget: number;
  tradeDeadlineWeek: number;
  playoffStartWeek: number;
  regularWeeks: number;
  playoffByes: number;
  lastWaiverWeek: number;
  slots: string[];
  bettingOn: boolean;
  poolSeed: number;
  wagerCap: number;
  exposureCap: number;
  teams: {
    rosterId: number;
    teamName: string;
    manager: string;
    ownerId: string | null;
    open: boolean;
    faab: number;
    waiverOrder: number;
  }[];
}> {
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
		playoffByes: row.playoff_byes ?? defaultPlayoffByes(row.playoff_teams),
		lastWaiverWeek: row.last_waiver_week ?? 0,
		slots: parseSlots(row.roster_slots),
		bettingOn: Boolean(row.betting_on),
		poolSeed: row.pool_seed ?? 200,
		wagerCap: row.wager_cap ?? 25,
		exposureCap: row.exposure_cap ?? 60,
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
export async function saveSettings(userId: string, leagueId: string, input: {
  name?: string;
  book?: Record<string, number>;
  playoffTeams?: number;
  currentWeek?: number;
  waiverType?: string;
  faabBudget?: number;
  tradeDeadlineWeek?: number;
  playoffStartWeek?: number;
  regularWeeks?: number;
  playoffByes?: number;
  slots?: string[];
}): Promise<void> {
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
	const playoff = Math.min(8, Math.max(2, input.playoffTeams ?? row.playoff_teams));
	const week = Math.min(18, Math.max(1, input.currentWeek ?? row.current_week));
	const waiverType = input.waiverType ?? row.waiver_type ?? "faab";
	const faab = input.faabBudget ?? row.faab_budget ?? 100;
	const deadline = input.tradeDeadlineWeek ?? row.trade_deadline_week ?? 11;
	const pStart = Math.min(18, Math.max(10, input.playoffStartWeek ?? row.playoff_start_week ?? 15));
	const regular = Math.min(pStart - 1, Math.max(8, input.regularWeeks ?? row.regular_weeks ?? 14));
	const byes = clampPlayoffByes(playoff, input.playoffByes ?? row.playoff_byes ?? defaultPlayoffByes(playoff));
	const slots = input.slots ? normalizeSlots(input.slots) : parseSlots(row.roster_slots);
	// The book's own settings. Genesis numbers are the league's to choose: the
	// ratio of pool seed to total manager FAAB is what decides whether a payout
	// ever has to scale down.
	try {
		const { ensureWagerSchema, seedPool } = await import("./wagers.server");
		await ensureWagerSchema();
		if (input.bettingOn != null) {
			await sql`update ff_leagues set betting_on = ${input.bettingOn ? 1 : 0} where id = ${leagueId}`;
		}
		if (input.poolSeed != null) {
			const seed = Math.max(0, Math.min(5000, Math.round(input.poolSeed)));
			await sql`update ff_leagues set pool_seed = ${seed} where id = ${leagueId}`;
			await seedPool(leagueId, seed);
		}
		if (input.wagerCap != null) {
			await sql`update ff_leagues set wager_cap = ${Math.max(1, Math.round(input.wagerCap))} where id = ${leagueId}`;
		}
		if (input.exposureCap != null) {
			await sql`update ff_leagues set exposure_cap = ${Math.max(1, Math.round(input.exposureCap))} where id = ${leagueId}`;
		}
	} catch {
		/* a league without the book tables simply has no betting */
	}
	await sql`
    update ff_leagues
    set name = ${name}, scoring = ${preset}, scoring_json = ${JSON.stringify(book)},
        playoff_teams = ${playoff}, current_week = ${week},
        waiver_type = ${waiverType}, faab_budget = ${faab},
        trade_deadline_week = ${deadline}, playoff_start_week = ${pStart},
        regular_weeks = ${regular}, playoff_byes = ${byes},
        roster_slots = ${JSON.stringify(slots)}
    where id = ${leagueId}
  `;
	if (input.slots) {
		const pts = pprMap();
		const rosters = await getRosters(leagueId);
		const allSpots = await getSpots(leagueId);
		for (const roster of rosters) {
			const mine = allSpots.filter((s) => s.roster_id === roster.roster_id);
			const lined = applyLineup(mine, slots, pts);
			for (const s of lined) {
				await sql`
          update ff_spots set slot = ${s.slot}, starter_slot = ${s.starter_slot}
          where league_id = ${leagueId} and roster_id = ${roster.roster_id} and player_id = ${s.player_id}
        `;
			}
		}
	}
	await ensureRemainingSchedule(leagueId);
}
export async function claimRoster(userId: string, leagueId: string, rosterId: number): Promise<void> {
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

type SchedulePair = { matchupId: number; home: number; away: number | null };
type ScheduleWeek = { week: number; locked: boolean; pairs: SchedulePair[] };

export async function loadSchedule(leagueId: string, userId: string | null): Promise<{
  leagueId: string;
  isCommish: boolean;
  locked: boolean;
  currentWeek: number;
  regularWeeks: number;
  playoffStartWeek: number;
  teams: { rosterId: number; teamName: string }[];
  weeks: ScheduleWeek[];
}> {
  await ensureDemo();
  const row = await getLeague(leagueId);
  const rosters = await getRosters(leagueId);
  const sql = await getSql();
  const lastReg = Math.min(row.regular_weeks ?? 14, (row.playoff_start_week ?? 15) - 1);
  await ensureRemainingSchedule(leagueId);
  const matchups = await sql<{
    week: number;
    matchup_id: number;
    home_roster: number;
    away_roster: number | null;
    kind: string | null;
  }>`
    select week, matchup_id, home_roster, away_roster, kind
    from ff_matchups
    where league_id = ${leagueId} and week <= ${lastReg}
      and (kind is null or kind = ${"regular"})
    order by week, matchup_id
  `;
  const scored = await sql<{ week: number; points: number }>`
    select week, points from ff_week_results where league_id = ${leagueId}
  `.catch(() => []);
  const lockedWeeks = new Set<number>();
  for (const r of scored) {
    if ((r.points ?? 0) > 0) lockedWeeks.add(r.week);
  }
  const byWeek = new Map<number, SchedulePair[]>();
  for (const m of matchups) {
    const list = byWeek.get(m.week) ?? [];
    list.push({ matchupId: m.matchup_id, home: m.home_roster, away: m.away_roster });
    byWeek.set(m.week, list);
  }
  const weeks: ScheduleWeek[] = [];
  for (let w = 1; w <= lastReg; w++) {
    weeks.push({
      week: w,
      locked: lockedWeeks.has(w),
      pairs: byWeek.get(w) ?? [],
    });
  }
  return {
    leagueId,
    isCommish: Boolean(userId && row.commish_id === userId),
    locked: row.locked === 1,
    currentWeek: row.current_week,
    regularWeeks: lastReg,
    playoffStartWeek: row.playoff_start_week ?? 15,
    teams: rosters.map((r) => ({ rosterId: r.roster_id, teamName: r.team_name })),
    weeks,
  };
}

function assertWeekPairs(teamCount: number, pairs: { home: number; away: number | null }[]) {
  const seen = new Set<number>();
  for (const p of pairs) {
    if (p.home < 1 || p.home > teamCount) throw new Error("Bad home team.");
    if (seen.has(p.home)) throw new Error("A team is listed twice this week.");
    seen.add(p.home);
    if (p.away != null) {
      if (p.away < 1 || p.away > teamCount) throw new Error("Bad away team.");
      if (seen.has(p.away)) throw new Error("A team is listed twice this week.");
      if (p.away === p.home) throw new Error("A team cannot play itself.");
      seen.add(p.away);
    }
  }
  if (seen.size !== teamCount) {
    throw new Error(`Every team needs a slot. ${seen.size} of ${teamCount} are set.`);
  }
}

export async function saveWeekSchedule(
  userId: string,
  leagueId: string,
  week: number,
  pairs: { home: number; away: number | null }[],
): Promise<void> {
  const row = await getLeague(leagueId);
  if (row.commish_id !== userId) throw new Error("Only the commissioner can set the schedule.");
  if (row.locked) throw new Error("This desk is locked.");
  const lastReg = Math.min(row.regular_weeks ?? 14, (row.playoff_start_week ?? 15) - 1);
  if (week < 1 || week > lastReg) throw new Error("That week is not a regular-season week.");
  assertWeekPairs(row.team_count, pairs);
  const sql = await getSql();
  const scored = await sql<{ points: number }>`
    select points from ff_week_results where league_id = ${leagueId} and week = ${week}
  `;
  if (scored.some((r) => (r.points ?? 0) > 0)) {
    throw new Error("That week already has scores. Leave it.");
  }
  await sql`delete from ff_week_results where league_id = ${leagueId} and week = ${week}`;
  await sql`
    delete from ff_matchups
    where league_id = ${leagueId} and week = ${week} and (kind is null or kind = ${"regular"})
  `;
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i]!;
    await sql`
      insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster, kind)
      values (${leagueId}, ${week}, ${i + 1}, ${p.home}, ${p.away}, ${"regular"})
    `;
  }
}

export async function rebuildSchedule(userId: string, leagueId: string): Promise<void> {
  const row = await getLeague(leagueId);
  if (row.commish_id !== userId) throw new Error("Only the commissioner can set the schedule.");
  if (row.locked) throw new Error("This desk is locked.");
  const lastReg = Math.min(row.regular_weeks ?? 14, (row.playoff_start_week ?? 15) - 1);
  const sql = await getSql();
  const scored = await sql<{ week: number; points: number }>`
    select week, points from ff_week_results where league_id = ${leagueId}
  `;
  const keep = new Set<number>();
  for (const r of scored) {
    if ((r.points ?? 0) > 0) keep.add(r.week);
  }
  const generated = makeSchedule(row.team_count, lastReg);
  for (let w = 1; w <= lastReg; w++) {
    if (keep.has(w)) continue;
    await sql`delete from ff_week_results where league_id = ${leagueId} and week = ${w}`;
    await sql`
      delete from ff_matchups
      where league_id = ${leagueId} and week = ${w} and (kind is null or kind = ${"regular"})
    `;
    const rows = generated.filter((m) => m.week === w);
    for (const m of rows) {
      await sql`
        insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster, kind)
        values (${leagueId}, ${m.week}, ${m.id}, ${m.home}, ${m.away}, ${"regular"})
      `;
    }
  }
}

export async function previewInvite(code: string): Promise<{
  leagueId: string;
  name: string;
  season: string;
  seats: { rosterId: number; teamName: string }[];
} | null> {
	await ensureDemo();
	const sql = await getSql();
	const league = (await sql`select * from ff_leagues where invite_code = ${code.trim().toUpperCase()}`)[0];
	if (!league || league.locked) return null;
	const seats = await sql`
    select roster_id, team_name from ff_rosters
    where league_id = ${league.id} and owner_id is null
    order by roster_id
  `;
	return {
		leagueId: league.id,
		name: league.name,
		season: league.season,
		seats: seats.map((s) => ({ rosterId: s.roster_id, teamName: s.team_name })),
	};
}

export async function loadDispatch(leagueId: string, week: number): Promise<import("./dispatch").DispatchArticle> {
	const desk = await loadDesk(leagueId, week);
	return desk.articles[0]!;
}

export async function loadDesk(leagueId: string, week: number): Promise<import("./dispatch").DeskEdition> {
	await ensureDemo();
	await (await import("./ops.server")).ensureOpsSchema();
	const sql = await getSql();
	const { parseJson } = await import("./dispatch");
	const existing = await sql`
    select * from ff_dispatches
    where league_id = ${leagueId} and week = ${week}
    order by created_at asc
  `;
	const stale =
		existing.length <= 1 &&
		existing.some((r) => /blank paper|still blank/i.test(String(r.headline)));
	if (existing.length >= 2 && !stale) {
		return {
			week,
			edition: existing.some((r) => r.kind === "recap") ? "recap" : "prep",
			kicker: existing.some((r) => r.kind === "recap") ? `Week ${week} recap` : `Week ${week} prep`,
			articles: existing.map((r) => ({
				id: r.id,
				leagueId,
				week: r.week,
				kind: r.kind,
				slug: r.slug || r.id,
				kicker: r.kind === "lead" || r.kind === "preview" ? `Week ${week} prep` : r.kind === "recap" ? `Week ${week} recap` : "From the draft",
				headline: r.headline,
				dek: r.dek,
				body: parseJson(r.body_json, []),
				bullets: parseJson(r.bullets_json, []),
				box: parseJson(r.box_json, []),
				focus: parseJson(r.focus_json, []),
				source: r.source === "llm" ? "llm" : "rules",
				createdAt: String(r.created_at),
			})),
		};
	}
	if (stale || existing.length) {
		await sql`delete from ff_dispatches where league_id = ${leagueId} and week = ${week}`;
	}
	const row = await getLeague(leagueId);
	const rosters = await getRosters(leagueId);
	const spots = await getSpots(leagueId);
	const standings = await scoredStandings(row, rosters, spots);
	const pairs = await loadMatchups(leagueId, week);
	const activity = await loadActivity(leagueId, week);
	const rosterCards = rosters.map((r) => ({
		team: r.team_name,
		manager: managerOf(r),
		players: spots
			.filter((s) => s.roster_id === r.roster_id)
			.map((s) => {
				const p = getPlayer(s.player_id);
				return {
					name: p?.full_name ?? playerName(s.player_id),
					pos: p?.position ?? null,
				};
			}),
	}));
	if (rosterCards.some((r) => r.players.length < 5) && /wiffl/i.test(row.name)) {
		const { WIFFL_2026 } = await import("./recaps/wiffl-2026");
		for (const card of rosterCards) {
			const known = WIFFL_2026.teams.find((t) => t.teamName === card.team);
			if (!known) continue;
			card.players = known.names.map((name) => {
				const p = matchPlayerName(name);
				return { name: p?.full_name ?? name, pos: p?.position ?? null };
			});
		}
	}
	const { buildDispatchContext, composeDesk } = await import("./dispatch");
	const ctx = buildDispatchContext({
		leagueId,
		leagueName: row.name,
		season: row.season,
		week,
		status: row.status,
		standings,
		pairs,
		activity,
		rosters: rosterCards,
	});
	const desk = composeDesk(ctx);
	const now = new Date().toISOString();
	const articles = [];
	for (const draft of desk.articles) {
		const id = `ds_${leagueId}_${week}_${draft.slug}`.slice(0, 64);
		await sql`
      insert into ff_dispatches (
        id, league_id, week, kind, slug, headline, dek, body_json, bullets_json, box_json, focus_json, context_json, source
      ) values (
        ${id}, ${leagueId}, ${week}, ${draft.kind}, ${draft.slug}, ${draft.headline}, ${draft.dek},
        ${JSON.stringify(draft.body)}, ${JSON.stringify(draft.bullets)}, ${JSON.stringify(draft.box)},
        ${JSON.stringify(draft.focus)}, ${JSON.stringify({ week: ctx.week, league: ctx.leagueName })}, ${draft.source}
      )
    `;
		articles.push({
			...draft,
			id,
			leagueId,
			createdAt: now,
		});
	}
	return { week, edition: desk.edition, kicker: desk.kicker, articles };
}


