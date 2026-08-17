import { r as getSql } from "./db-C12UbT90.mjs";
import { getPlayer, playerName } from "./sleeper.server-Bqr0Cv6u.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ops.server-BA_UgRzY.js
function nid(prefix, n = 10) {
	const chars = "abcdefghjkmnpqrstuvwxyz23456789";
	let s = prefix;
	for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 31)];
	return s;
}
var opsReady = false;
async function ensureOpsSchema() {
	if (opsReady) return;
	const sql = await getSql();
	for (const s of [
		`alter table ff_leagues add column if not exists waiver_type text not null default 'faab'`,
		`alter table ff_leagues add column if not exists faab_budget int not null default 100`,
		`alter table ff_leagues add column if not exists waiver_clear_dow int not null default 3`,
		`alter table ff_leagues add column if not exists trade_deadline_week int not null default 11`,
		`alter table ff_leagues add column if not exists playoff_start_week int not null default 15`,
		`alter table ff_leagues add column if not exists regular_weeks int not null default 14`,
		`alter table ff_leagues add column if not exists last_waiver_week int not null default 0`,
		`alter table ff_rosters add column if not exists faab_remaining int`,
		`alter table ff_rosters add column if not exists waiver_order int`,
		`alter table ff_picks add column if not exists original_roster int`,
		`alter table ff_matchups add column if not exists kind text not null default 'regular'`,
		`alter table ff_matchups add column if not exists playoff_round int`,
		`alter table ff_moves add column if not exists bid int`,
		`create table if not exists ff_claims (
      id text primary key, league_id text not null, week int not null, roster_id int not null,
      add_player_id text not null, drop_player_id text, bid int not null default 0,
      status text not null default 'pending', created_at timestamptz not null default now())`,
		`create table if not exists ff_trades (
      id text primary key, league_id text not null, week int not null,
      status text not null default 'proposed', proposer_roster int not null,
      created_at timestamptz not null default now(), resolved_at timestamptz)`,
		`create table if not exists ff_trade_sides (
      trade_id text not null, roster_id int not null, accepted int not null default 0,
      primary key (trade_id, roster_id))`,
		`create table if not exists ff_trade_assets (
      id text primary key, trade_id text not null, from_roster int not null, to_roster int not null,
      kind text not null, player_id text, pick_no int)`
	]) await sql.query(s);
	await sql.query(`update ff_rosters set faab_remaining = coalesce(faab_remaining, 100), waiver_order = coalesce(waiver_order, roster_id) where faab_remaining is null or waiver_order is null`);
	await sql.query(`update ff_picks set original_roster = roster_id where original_roster is null`);
	opsReady = true;
}
async function leagueOf(id) {
	await ensureOpsSchema();
	const rows = await (await getSql())`select * from ff_leagues where id = ${id}`;
	if (!rows[0]) throw new Error("League not found");
	return rows[0];
}
function playoffStart(l) {
	return l.playoff_start_week ?? 15;
}
function faabBudget(l) {
	return l.faab_budget ?? 100;
}
function parseSlots(raw) {
	try {
		const v = JSON.parse(raw);
		return Array.isArray(v) ? v : [];
	} catch {
		return [];
	}
}
async function ensureDraftBoard(leagueId) {
	await ensureOpsSchema();
	const sql = await getSql();
	if (((await sql`select count(*)::int as n from ff_picks where league_id = ${leagueId}`)[0]?.n ?? 0) > 0) return;
	const league = await leagueOf(leagueId);
	const slots = parseSlots(league.roster_slots);
	const rounds = Math.max(1, slots.length || 15);
	const teams = league.team_count;
	let n = 1;
	for (let r = 1; r <= rounds; r++) {
		const ids = Array.from({ length: teams }, (_, i) => i + 1);
		if (r % 2 === 0) ids.reverse();
		for (const roster of ids) {
			await sql`
        insert into ff_picks (league_id, pick_no, round, roster_id, player_id, original_roster)
        values (${leagueId}, ${n}, ${r}, ${roster}, ${null}, ${roster})
        on conflict do nothing
      `;
			n += 1;
		}
	}
}
async function seedRosterOps(leagueId) {
	await ensureOpsSchema();
	await (await getSql())`
    update ff_rosters
    set faab_remaining = coalesce(faab_remaining, ${faabBudget(await leagueOf(leagueId))}),
        waiver_order = coalesce(waiver_order, roster_id)
    where league_id = ${leagueId}
  `;
}
function waiversOpen(l) {
	if ((l.waiver_type ?? "faab") === "none") return false;
	return (l.last_waiver_week ?? 0) < l.current_week;
}
async function requestAdd(userId, leagueId, addId, dropId, bid) {
	const league = await leagueOf(leagueId);
	if (league.locked) throw new Error("This desk is locked.");
	if (league.status === "pre_draft" || league.status === "drafting") throw new Error("Wait until the draft is over.");
	const sql = await getSql();
	const mine = (await sql`select * from ff_rosters where league_id = ${leagueId} and owner_id = ${userId}`)[0];
	if (!mine) throw new Error("You don't have a seat.");
	if ((await sql`select player_id from ff_spots where league_id = ${leagueId} and player_id = ${addId}`)[0]) throw new Error("Already rostered.");
	if (!getPlayer(addId)) throw new Error("Unknown player.");
	const cap = parseSlots(league.roster_slots).length || 15;
	if (((await sql`
    select count(*)::int as n from ff_spots where league_id = ${leagueId} and roster_id = ${mine.roster_id}
  `)[0]?.n ?? 0) >= cap && !dropId) throw new Error("Drop someone first.");
	if (dropId) {
		if (!(await sql`
      select player_id from ff_spots
      where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${dropId}
    `)[0]) throw new Error("You don't have that player to drop.");
	}
	const amount = (league.waiver_type ?? "faab") === "faab" ? Math.max(0, Math.floor(bid || 0)) : 0;
	if (waiversOpen(league)) {
		const purse = mine.faab_remaining ?? faabBudget(league);
		if (amount > purse) throw new Error(`Bid $${amount} is over your $${purse} remaining.`);
		await sql`
      insert into ff_claims (id, league_id, week, roster_id, add_player_id, drop_player_id, bid, status)
      values (
        ${nid("cl_")}, ${leagueId}, ${league.current_week}, ${mine.roster_id},
        ${addId}, ${dropId}, ${amount}, ${"pending"}
      )
    `;
		return { mode: "claim" };
	}
	await applyAddDrop(leagueId, mine.roster_id, addId, dropId, "free_agent", null);
	return { mode: "free_agent" };
}
async function applyAddDrop(leagueId, rosterId, addId, dropId, type, bid) {
	const sql = await getSql();
	const league = await leagueOf(leagueId);
	if (dropId) await sql`
      delete from ff_spots
      where league_id = ${leagueId} and roster_id = ${rosterId} and player_id = ${dropId}
    `;
	await sql`
    insert into ff_spots (league_id, roster_id, player_id, slot, starter_slot)
    values (${leagueId}, ${rosterId}, ${addId}, ${"bench"}, ${null})
    on conflict do nothing
  `;
	await sql`
    insert into ff_moves (id, league_id, week, roster_id, type, add_player_id, drop_player_id, bid)
    values (${nid("mv_", 12)}, ${leagueId}, ${league.current_week}, ${rosterId}, ${type}, ${addId}, ${dropId}, ${bid})
  `;
}
async function cancelClaim(userId, leagueId, claimId) {
	const sql = await getSql();
	const mine = (await sql`select * from ff_rosters where league_id = ${leagueId} and owner_id = ${userId}`)[0];
	if (!mine) throw new Error("You don't have a seat.");
	const row = await sql`
    select roster_id, status from ff_claims where id = ${claimId} and league_id = ${leagueId}
  `;
	if (!row[0] || row[0].status !== "pending") throw new Error("Claim is gone.");
	if (row[0].roster_id !== mine.roster_id) throw new Error("Not your claim.");
	await sql`update ff_claims set status = ${"cancelled"} where id = ${claimId}`;
}
async function processWaivers(leagueId, week) {
	const league = await leagueOf(leagueId);
	if (league.locked) return { awarded: 0 };
	const w = week ?? league.current_week;
	const sql = await getSql();
	const rolling = (league.waiver_type ?? "faab") === "rolling";
	const claims = rolling ? await sql`
        select c.* from ff_claims c
        join ff_rosters r on r.league_id = c.league_id and r.roster_id = c.roster_id
        where c.league_id = ${leagueId} and c.week = ${w} and c.status = ${"pending"}
        order by r.waiver_order asc, c.created_at asc
      ` : await sql`
        select c.* from ff_claims c
        join ff_rosters r on r.league_id = c.league_id and r.roster_id = c.roster_id
        where c.league_id = ${leagueId} and c.week = ${w} and c.status = ${"pending"}
        order by c.bid desc, r.waiver_order asc, c.created_at asc
      `;
	const rosters = await sql`select * from ff_rosters where league_id = ${leagueId}`;
	const purse = new Map(rosters.map((r) => [r.roster_id, r.faab_remaining ?? faabBudget(league)]));
	const order = rosters.slice().sort((a, b) => (a.waiver_order ?? a.roster_id) - (b.waiver_order ?? b.roster_id)).map((r) => r.roster_id);
	let awarded = 0;
	const winners = [];
	for (const c of claims) {
		const taken = await sql`
      select player_id from ff_spots where league_id = ${leagueId} and player_id = ${c.add_player_id}
    `;
		const cash = purse.get(c.roster_id) ?? 0;
		if (taken[0] || c.bid > cash) {
			await sql`update ff_claims set status = ${"lost"} where id = ${c.id}`;
			continue;
		}
		if (c.drop_player_id) {
			if (!(await sql`
        select player_id from ff_spots
        where league_id = ${leagueId} and roster_id = ${c.roster_id} and player_id = ${c.drop_player_id}
      `)[0]) {
				await sql`update ff_claims set status = ${"lost"} where id = ${c.id}`;
				continue;
			}
		}
		await applyAddDrop(leagueId, c.roster_id, c.add_player_id, c.drop_player_id, "waiver", rolling ? null : c.bid);
		if (!rolling) {
			purse.set(c.roster_id, cash - c.bid);
			await sql`update ff_rosters set faab_remaining = ${cash - c.bid} where league_id = ${leagueId} and roster_id = ${c.roster_id}`;
		}
		await sql`update ff_claims set status = ${"won"} where id = ${c.id}`;
		winners.push(c.roster_id);
		awarded += 1;
	}
	if (winners.length) {
		const next = [...order.filter((id) => !winners.includes(id)), ...winners.filter((id, i) => winners.indexOf(id) === i)];
		for (let i = 0; i < next.length; i++) await sql`update ff_rosters set waiver_order = ${i + 1} where league_id = ${leagueId} and roster_id = ${next[i]}`;
	}
	await sql`update ff_leagues set last_waiver_week = ${w} where id = ${leagueId}`;
	return { awarded };
}
async function listClaims(leagueId, rosterId) {
	await ensureOpsSchema();
	const sql = await getSql();
	const league = await leagueOf(leagueId);
	const rows = await sql`
    select * from ff_claims
    where league_id = ${leagueId} and week = ${league.current_week}
    order by bid desc, created_at asc
  `;
	return {
		week: league.current_week,
		open: waiversOpen(league),
		waiverType: league.waiver_type ?? "faab",
		items: rows.filter((r) => r.status === "pending" || r.roster_id === rosterId).map((r) => ({
			id: r.id,
			rosterId: r.roster_id,
			mine: r.roster_id === rosterId,
			add: {
				id: r.add_player_id,
				name: playerName(r.add_player_id),
				pos: getPlayer(r.add_player_id)?.position ?? null
			},
			drop: r.drop_player_id ? {
				id: r.drop_player_id,
				name: playerName(r.drop_player_id),
				pos: getPlayer(r.drop_player_id)?.position ?? null
			} : null,
			bid: r.bid,
			status: r.status
		}))
	};
}
async function proposeTrade(userId, leagueId, assets) {
	const league = await leagueOf(leagueId);
	if (league.locked) throw new Error("This desk is locked.");
	if (league.current_week > (league.trade_deadline_week ?? 11) && league.status !== "pre_draft" && league.status !== "drafting") throw new Error("Trade deadline has passed.");
	const sql = await getSql();
	const mine = (await sql`select * from ff_rosters where league_id = ${leagueId} and owner_id = ${userId}`)[0];
	if (!mine) throw new Error("You don't have a seat.");
	if (assets.length < 1) throw new Error("Add something to the trade.");
	const sides = /* @__PURE__ */ new Set();
	for (const a of assets) {
		sides.add(a.fromRoster);
		sides.add(a.toRoster);
		if (a.kind === "player") {
			if (!a.playerId) throw new Error("Missing player.");
			if (!(await sql`
        select player_id from ff_spots
        where league_id = ${leagueId} and roster_id = ${a.fromRoster} and player_id = ${a.playerId}
      `)[0]) throw new Error("A player in this trade is not on that roster.");
		} else {
			if (!a.pickNo) throw new Error("Missing pick.");
			const pick = await sql`
        select roster_id, player_id from ff_picks where league_id = ${leagueId} and pick_no = ${a.pickNo}
      `;
			if (!pick[0]) throw new Error("That pick does not exist. Open the draft board first.");
			if (pick[0].player_id) throw new Error("That pick is already used.");
			if (pick[0].roster_id !== a.fromRoster) throw new Error("They don't own that pick.");
		}
	}
	if (!sides.has(mine.roster_id)) throw new Error("You have to be in the trade.");
	if (sides.size < 2) throw new Error("Need at least two teams.");
	const id = nid("tr_");
	await sql`
    insert into ff_trades (id, league_id, week, status, proposer_roster)
    values (${id}, ${leagueId}, ${league.current_week}, ${"proposed"}, ${mine.roster_id})
  `;
	for (const roster of sides) await sql`
      insert into ff_trade_sides (trade_id, roster_id, accepted)
      values (${id}, ${roster}, ${roster === mine.roster_id ? 1 : 0})
    `;
	for (const a of assets) await sql`
      insert into ff_trade_assets (id, trade_id, from_roster, to_roster, kind, player_id, pick_no)
      values (
        ${nid("ta_")}, ${id}, ${a.fromRoster}, ${a.toRoster}, ${a.kind},
        ${a.playerId ?? null}, ${a.pickNo ?? null}
      )
    `;
	return { tradeId: id };
}
async function voteTrade(userId, leagueId, tradeId, accept) {
	const sql = await getSql();
	const isCommish = (await sql`select commish_id from ff_leagues where id = ${leagueId}`)[0]?.commish_id === userId;
	const mine = (await sql`select * from ff_rosters where league_id = ${leagueId} and owner_id = ${userId}`)[0];
	const trade = (await sql`
      select status, proposer_roster from ff_trades where id = ${tradeId} and league_id = ${leagueId}
    `)[0];
	if (!trade || trade.status !== "proposed") throw new Error("Trade is not open.");
	const mySide = mine ? await sql`select roster_id from ff_trade_sides where trade_id = ${tradeId} and roster_id = ${mine.roster_id}` : [];
	if (!mySide[0] && !isCommish) throw new Error("You're not in this trade.");
	if (!accept) {
		if (!mySide[0] && !isCommish) throw new Error("You're not in this trade.");
		await sql`update ff_trades set status = ${"rejected"}, resolved_at = ${(/* @__PURE__ */ new Date()).toISOString()} where id = ${tradeId}`;
		return;
	}
	if (mySide[0] && mine) await sql`update ff_trade_sides set accepted = ${1} where trade_id = ${tradeId} and roster_id = ${mine.roster_id}`;
	if (isCommish) {
		const pending = await sql`
      select s.roster_id from ff_trade_sides s
      where s.trade_id = ${tradeId} and s.accepted = 0
    `;
		for (const p of pending) {
			const seat = (await sql`
          select owner_id from ff_rosters where league_id = ${leagueId} and roster_id = ${p.roster_id}
        `)[0];
			if (seat?.owner_id && seat.owner_id !== userId) continue;
			await sql`update ff_trade_sides set accepted = ${1} where trade_id = ${tradeId} and roster_id = ${p.roster_id}`;
		}
	}
	if (!(await sql`
    select roster_id from ff_trade_sides where trade_id = ${tradeId} and accepted = 0
  `)[0]) await executeTrade(leagueId, tradeId);
}
async function cancelTrade(userId, leagueId, tradeId) {
	const sql = await getSql();
	const mine = (await sql`select * from ff_rosters where league_id = ${leagueId} and owner_id = ${userId}`)[0];
	const trade = (await sql`
      select status, proposer_roster from ff_trades where id = ${tradeId} and league_id = ${leagueId}
    `)[0];
	if (!mine || !trade) throw new Error("Trade not found.");
	if (trade.status !== "proposed") throw new Error("Already settled.");
	if (trade.proposer_roster !== mine.roster_id) throw new Error("Only the proposer can pull it.");
	await sql`update ff_trades set status = ${"cancelled"}, resolved_at = ${(/* @__PURE__ */ new Date()).toISOString()} where id = ${tradeId}`;
}
async function executeTrade(leagueId, tradeId) {
	const sql = await getSql();
	const assets = await sql`select * from ff_trade_assets where trade_id = ${tradeId}`;
	const league = await leagueOf(leagueId);
	for (const a of assets) if (a.kind === "player" && a.player_id) {
		await sql`
        delete from ff_spots
        where league_id = ${leagueId} and roster_id = ${a.from_roster} and player_id = ${a.player_id}
      `;
		await sql`
        insert into ff_spots (league_id, roster_id, player_id, slot, starter_slot)
        values (${leagueId}, ${a.to_roster}, ${a.player_id}, ${"bench"}, ${null})
        on conflict do nothing
      `;
		await sql`
        insert into ff_moves (id, league_id, week, roster_id, type, add_player_id, drop_player_id)
        values (${nid("mv_", 12)}, ${leagueId}, ${league.current_week}, ${a.to_roster}, ${"trade"}, ${a.player_id}, ${null})
      `;
	} else if (a.kind === "pick" && a.pick_no) await sql`
        update ff_picks set roster_id = ${a.to_roster}
        where league_id = ${leagueId} and pick_no = ${a.pick_no} and player_id is null
      `;
	await sql`update ff_trades set status = ${"processed"}, resolved_at = ${(/* @__PURE__ */ new Date()).toISOString()} where id = ${tradeId}`;
}
async function listTrades(leagueId) {
	await ensureOpsSchema();
	await ensureDraftBoard(leagueId);
	const sql = await getSql();
	const trades = await sql`
    select * from ff_trades where league_id = ${leagueId}
    order by created_at desc
    limit 40
  `;
	const rosters = await sql`select * from ff_rosters where league_id = ${leagueId} order by roster_id`;
	const names = new Map(rosters.map((r) => [r.roster_id, r.team_name]));
	const owners = new Map(rosters.map((r) => [r.roster_id, r.owner_id]));
	const out = [];
	for (const t of trades) {
		const sides = await sql`
      select roster_id, accepted from ff_trade_sides where trade_id = ${t.id}
    `;
		const assets = await sql`select * from ff_trade_assets where trade_id = ${t.id}`;
		out.push({
			id: t.id,
			week: t.week,
			status: t.status,
			proposerRoster: t.proposer_roster,
			created: typeof t.created_at === "string" ? Date.parse(t.created_at) : t.created_at.getTime(),
			sides: sides.map((s) => ({
				rosterId: s.roster_id,
				teamName: names.get(s.roster_id) ?? `Team ${s.roster_id}`,
				accepted: s.accepted === 1,
				house: !owners.get(s.roster_id)
			})),
			assets: assets.map((a) => ({
				fromRoster: a.from_roster,
				toRoster: a.to_roster,
				fromName: names.get(a.from_roster) ?? "",
				toName: names.get(a.to_roster) ?? "",
				kind: a.kind,
				playerId: a.player_id,
				playerName: a.player_id ? playerName(a.player_id) : null,
				pos: a.player_id ? getPlayer(a.player_id)?.position ?? null : null,
				pickNo: a.pick_no,
				pickLabel: a.pick_no ? pickLabelSync(a.pick_no, rosters.length) : null
			}))
		});
	}
	return out;
}
function pickLabelSync(pickNo, teams) {
	const n = Math.max(1, teams);
	const round = Math.ceil(pickNo / n);
	const slot = (pickNo - 1) % n + 1;
	return `R${round}.${String(slot).padStart(2, "0")}`;
}
async function listTradablePicks(leagueId) {
	await ensureDraftBoard(leagueId);
	const sql = await getSql();
	const rosters = await sql`select * from ff_rosters where league_id = ${leagueId}`;
	const picks = await sql`select * from ff_picks where league_id = ${leagueId} and player_id is null order by pick_no`;
	const names = new Map(rosters.map((r) => [r.roster_id, r.team_name]));
	return picks.map((p) => ({
		pickNo: p.pick_no,
		round: p.round,
		rosterId: p.roster_id,
		originalRoster: p.original_roster ?? p.roster_id,
		label: pickLabelSync(p.pick_no, rosters.length),
		ownerName: names.get(p.roster_id) ?? `Team ${p.roster_id}`,
		via: (p.original_roster ?? p.roster_id) !== p.roster_id ? names.get(p.original_roster ?? p.roster_id) : null
	}));
}
async function snapshotWeek(leagueId, week) {
	const sql = await getSql();
	if ((await sql`
    select roster_id from ff_week_results where league_id = ${leagueId} and week = ${week} limit 1
  `)[0]) return;
	const { loadMatchups } = await import("./engine.server-DxLAl_HW.mjs");
	const pairs = await loadMatchups(leagueId, week);
	for (const p of pairs) for (const side of [p.home, p.away]) {
		if (!side) continue;
		await sql`
        insert into ff_week_results (league_id, week, roster_id, points, starters_json)
        values (
          ${leagueId}, ${week}, ${side.rosterId}, ${side.points},
          ${JSON.stringify(side.starters.map((s) => ({
			playerId: s.playerId,
			points: s.points ?? 0
		})))}
        )
        on conflict do nothing
      `;
	}
}
async function seedPlayoffs(leagueId, week) {
	const league = await leagueOf(leagueId);
	const start = playoffStart(league);
	if (week < start) return;
	const sql = await getSql();
	if ((await sql`
    select matchup_id from ff_matchups where league_id = ${leagueId} and week = ${week} and kind = ${"playoff"} limit 1
  `)[0]) return;
	const { loadLeagueBundle } = await import("./engine.server-DxLAl_HW.mjs");
	const seeds = (await loadLeagueBundle(leagueId, null, { tick: false })).standings.slice(0, league.playoff_teams).map((s) => s.rosterId);
	if (seeds.length < 2) return;
	const round = week - start + 1;
	const pairs = [];
	const byes = [];
	if (round === 1) {
		if (seeds.length === 4) pairs.push([seeds[0], seeds[3]], [seeds[1], seeds[2]]);
		else if (seeds.length >= 6) {
			pairs.push([seeds[2], seeds[5]], [seeds[3], seeds[4]]);
			byes.push(seeds[0], seeds[1]);
		} else for (let i = 0; i < Math.floor(seeds.length / 2); i++) pairs.push([seeds[i], seeds[seeds.length - 1 - i]]);
	} else {
		const prev = await sql`
      select home_roster, away_roster from ff_matchups
      where league_id = ${leagueId} and week = ${week - 1} and kind = ${"playoff"}
      order by matchup_id
    `;
		const results = await sql`
      select roster_id, points from ff_week_results where league_id = ${leagueId} and week = ${week - 1}
    `;
		const pts = new Map(results.map((r) => [r.roster_id, r.points]));
		const winners = [];
		for (const m of prev) {
			if (m.away_roster == null) continue;
			const hp = pts.get(m.home_roster) ?? 0;
			const ap = pts.get(m.away_roster) ?? 0;
			winners.push(hp >= ap ? m.home_roster : m.away_roster);
		}
		if (seeds.length >= 6 && round === 2) {
			const remaining = [...seeds.slice(0, 2), ...winners];
			if (remaining.length >= 4) pairs.push([remaining[0], remaining[3]], [remaining[1], remaining[2]]);
		} else if (winners.length >= 2) pairs.push([winners[0], winners[1]]);
	}
	for (let i = 0; i < pairs.length; i++) await sql`
      insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster, kind, playoff_round)
      values (${leagueId}, ${week}, ${i + 1}, ${pairs[i][0]}, ${pairs[i][1]}, ${"playoff"}, ${round})
      on conflict do nothing
    `;
	for (let i = 0; i < byes.length; i++) await sql`
      insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster, kind, playoff_round)
      values (${leagueId}, ${week}, ${pairs.length + i + 1}, ${byes[i]}, ${null}, ${"playoff"}, ${round})
      on conflict do nothing
    `;
}
async function tickLeague(leagueId) {
	await ensureOpsSchema();
	startLeagueClock();
	const league = await leagueOf(leagueId);
	if (league.locked || league.status === "pre_draft" || league.status === "drafting") return {
		advanced: 0,
		waivers: 0
	};
	let advanced = 0;
	let waivers = 0;
	try {
		const { fetchNflState } = await import("./sleeper.server-Bqr0Cv6u.mjs");
		const { ensureRemainingSchedule } = await import("./engine.server-DxLAl_HW.mjs");
		const state = await fetchNflState();
		if (state.season !== league.season) {
			await ensureRemainingSchedule(leagueId);
			await seedPlayoffs(leagueId, league.current_week);
			return {
				advanced: 0,
				waivers: 0
			};
		}
		const nflWeek = Math.max(1, Math.min(18, state.display_week || state.week || 1));
		const sql = await getSql();
		for (let w = 1; w < nflWeek; w++) await snapshotWeek(leagueId, w);
		if (league.current_week < nflWeek) {
			for (let w = league.current_week; w < nflWeek; w++) {
				const res = await processWaivers(leagueId, w);
				waivers += res.awarded;
				await seedPlayoffs(leagueId, w + 1);
				advanced += 1;
			}
			await sql`update ff_leagues set current_week = ${nflWeek} where id = ${leagueId}`;
		} else if ((/* @__PURE__ */ new Date()).getUTCDay() >= (league.waiver_clear_dow ?? 3) && (league.last_waiver_week ?? 0) < league.current_week) {
			const res = await processWaivers(leagueId, league.current_week);
			waivers += res.awarded;
		}
		await ensureRemainingSchedule(leagueId);
		await seedPlayoffs(leagueId, Math.max(league.current_week, nflWeek));
	} catch {
		return {
			advanced,
			waivers
		};
	}
	return {
		advanced,
		waivers
	};
}
async function tickAllLeagues() {
	await ensureOpsSchema();
	const rows = await (await getSql())`
    select id from ff_leagues
    where locked = 0 and status not in (${"pre_draft"}, ${"drafting"})
  `;
	let advanced = 0;
	let waivers = 0;
	for (const row of rows) {
		const res = await tickLeague(row.id);
		advanced += res.advanced;
		waivers += res.waivers;
	}
	return {
		leagues: rows.length,
		advanced,
		waivers
	};
}
var clockRef = globalThis;
function startLeagueClock() {
	if (clockRef.__ledgerClock__) return;
	clockRef.__ledgerClock__ = setInterval(() => {
		tickAllLeagues().catch(() => void 0);
	}, 3e5);
	setTimeout(() => {
		tickAllLeagues().catch(() => void 0);
	}, 2e4);
}
async function commishAdvance(userId, leagueId) {
	const league = await leagueOf(leagueId);
	const sql = await getSql();
	if ((await sql`select commish_id from ff_leagues where id = ${leagueId}`)[0]?.commish_id !== userId) throw new Error("Only the commissioner can advance the week.");
	if (league.locked) throw new Error("This desk is locked.");
	await snapshotWeek(leagueId, league.current_week);
	await processWaivers(leagueId, league.current_week);
	const next = Math.min(18, league.current_week + 1);
	await seedPlayoffs(leagueId, next);
	const { ensureRemainingSchedule } = await import("./engine.server-DxLAl_HW.mjs");
	await ensureRemainingSchedule(leagueId);
	await sql`update ff_leagues set current_week = ${next} where id = ${leagueId}`;
}
async function commishProcessWaivers(userId, leagueId) {
	if ((await (await getSql())`select commish_id from ff_leagues where id = ${leagueId}`)[0]?.commish_id !== userId) throw new Error("Only the commissioner can process waivers.");
	return processWaivers(leagueId);
}
//#endregion
export { cancelClaim, cancelTrade, commishAdvance, commishProcessWaivers, ensureDraftBoard, listClaims, listTradablePicks, listTrades, proposeTrade, requestAdd, seedRosterOps, startLeagueClock, tickAllLeagues, tickLeague, voteTrade };
