import { getSql } from "@/lib/db";
import { getPlayer, playerName } from "@/lib/data/sleeper.server";
import {
  clampPlayoffByes,
  defaultPlayoffByes,
  firstRoundSeeds,
} from "./playoffs";

function nid(prefix: string, n = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = prefix;
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

type LeagueOps = {
  id: string;
  season: string;
  status: string;
  locked: number;
  team_count: number;
  current_week: number;
  playoff_teams: number;
  roster_slots: string;
  waiver_type?: string;
  faab_budget?: number;
  waiver_clear_dow?: number;
  trade_deadline_week?: number;
  playoff_start_week?: number;
  regular_weeks?: number;
  last_waiver_week?: number;
  playoff_byes?: number;
};

type RosterOps = {
  roster_id: number;
  team_name: string;
  owner_id: string | null;
  faab_remaining?: number | null;
  waiver_order?: number | null;
};

let opsReady = 0;
const OPS_SCHEMA = 3;

export async function ensureOpsSchema(): Promise<void> {
  if (opsReady >= OPS_SCHEMA) return;
  const sql = await getSql();
  const stmts = [
    `alter table ff_leagues add column if not exists waiver_type text not null default 'faab'`,
    `alter table ff_leagues add column if not exists faab_budget int not null default 100`,
    `alter table ff_leagues add column if not exists waiver_clear_dow int not null default 3`,
    `alter table ff_leagues add column if not exists trade_deadline_week int not null default 11`,
    `alter table ff_leagues add column if not exists playoff_start_week int not null default 15`,
    `alter table ff_leagues add column if not exists regular_weeks int not null default 14`,
    `alter table ff_leagues add column if not exists last_waiver_week int not null default 0`,
    `alter table ff_leagues add column if not exists playoff_byes int`,
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
      kind text not null, player_id text, pick_no int)`,
    `create table if not exists ff_dispatches (
      id text primary key, league_id text not null, week int not null,
      kind text not null default 'recap', headline text not null, dek text not null,
      body_json text not null default '[]', bullets_json text not null default '[]',
      box_json text not null default '[]',
      context_json text, source text not null default 'rules',
      created_at timestamptz not null default now())`,
    `alter table ff_dispatches add column if not exists box_json text not null default '[]'`,
    `alter table ff_dispatches add column if not exists slug text`,
    `alter table ff_dispatches add column if not exists focus_json text not null default '[]'`,
  ];
  for (const s of stmts) await sql.query(s);
  await sql.query(
    `update ff_rosters set faab_remaining = coalesce(faab_remaining, 100), waiver_order = coalesce(waiver_order, roster_id) where faab_remaining is null or waiver_order is null`,
  );
  await sql.query(`update ff_picks set original_roster = roster_id where original_roster is null`);
  await sql.query(
    `update ff_leagues set playoff_byes = case
      when playoff_teams = 7 then 1
      when playoff_teams = 6 then 2
      when playoff_teams = 5 then 1
      else 0 end
     where playoff_byes is null`,
  );
  opsReady = OPS_SCHEMA;
}

async function leagueOf(id: string): Promise<LeagueOps> {
  await ensureOpsSchema();
  const rows = await (await getSql())<LeagueOps>`select * from ff_leagues where id = ${id}`;
  if (!rows[0]) throw new Error("League not found");
  return rows[0];
}

function playoffStart(l: LeagueOps): number {
  return l.playoff_start_week ?? 15;
}
function regularWeeks(l: LeagueOps): number {
  return l.regular_weeks ?? 14;
}
function faabBudget(l: LeagueOps): number {
  return l.faab_budget ?? 100;
}

function parseSlots(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

export async function ensureDraftBoard(leagueId: string): Promise<void> {
  await ensureOpsSchema();
  const sql = await getSql();
  const existing = await sql<{ n: number }>`select count(*)::int as n from ff_picks where league_id = ${leagueId}`;
  if ((existing[0]?.n ?? 0) > 0) return;
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

export async function seedRosterOps(leagueId: string): Promise<void> {
  await ensureOpsSchema();
  const sql = await getSql();
  const league = await leagueOf(leagueId);
  await sql`
    update ff_rosters
    set faab_remaining = coalesce(faab_remaining, ${faabBudget(league)}),
        waiver_order = coalesce(waiver_order, roster_id)
    where league_id = ${leagueId}
  `;
}

function waiversOpen(l: LeagueOps): boolean {
  if ((l.waiver_type ?? "faab") === "none") return false;
  return (l.last_waiver_week ?? 0) < l.current_week;
}

export async function requestAdd(
  userId: string,
  leagueId: string,
  addId: string,
  dropId: string | null,
  bid: number,
): Promise<{ mode: "claim" | "free_agent" }> {
  const league = await leagueOf(leagueId);
  if (league.locked) throw new Error("This desk is locked.");
  if (league.status === "pre_draft" || league.status === "drafting") {
    throw new Error("Wait until the draft is over.");
  }
  const sql = await getSql();
  const mine = (
    await sql<RosterOps>`select * from ff_rosters where league_id = ${leagueId} and owner_id = ${userId}`
  )[0];
  if (!mine) throw new Error("You don't have a seat.");
  if ((await sql`select player_id from ff_spots where league_id = ${leagueId} and player_id = ${addId}`)[0]) {
    throw new Error("Already rostered.");
  }
  if (!getPlayer(addId)) throw new Error("Unknown player.");
  const cap = parseSlots(league.roster_slots).length || 15;
  const spots = await sql<{ n: number }>`
    select count(*)::int as n from ff_spots where league_id = ${leagueId} and roster_id = ${mine.roster_id}
  `;
  if ((spots[0]?.n ?? 0) >= cap && !dropId) throw new Error("Drop someone first.");
  if (dropId) {
    const own = await sql`
      select player_id from ff_spots
      where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${dropId}
    `;
    if (!own[0]) throw new Error("You don't have that player to drop.");
  }
  const amount =
    (league.waiver_type ?? "faab") === "faab" ? Math.max(0, Math.floor(bid || 0)) : 0;
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

async function applyAddDrop(
  leagueId: string,
  rosterId: number,
  addId: string,
  dropId: string | null,
  type: string,
  bid: number | null,
): Promise<void> {
  const sql = await getSql();
  const league = await leagueOf(leagueId);
  if (dropId) {
    await sql`
      delete from ff_spots
      where league_id = ${leagueId} and roster_id = ${rosterId} and player_id = ${dropId}
    `;
  }
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

export async function cancelClaim(userId: string, leagueId: string, claimId: string): Promise<void> {
  const sql = await getSql();
  const mine = (
    await sql<RosterOps>`select * from ff_rosters where league_id = ${leagueId} and owner_id = ${userId}`
  )[0];
  if (!mine) throw new Error("You don't have a seat.");
  const row = await sql<{ roster_id: number; status: string }>`
    select roster_id, status from ff_claims where id = ${claimId} and league_id = ${leagueId}
  `;
  if (!row[0] || row[0].status !== "pending") throw new Error("Claim is gone.");
  if (row[0].roster_id !== mine.roster_id) throw new Error("Not your claim.");
  await sql`update ff_claims set status = ${"cancelled"} where id = ${claimId}`;
}

export async function processWaivers(leagueId: string, week?: number): Promise<{ awarded: number }> {
  const league = await leagueOf(leagueId);
  if (league.locked) return { awarded: 0 };
  const w = week ?? league.current_week;
  const sql = await getSql();
  const rolling = (league.waiver_type ?? "faab") === "rolling";
  const claims = rolling
    ? await sql<{
        id: string;
        roster_id: number;
        add_player_id: string;
        drop_player_id: string | null;
        bid: number;
        created_at: string;
      }>`
        select c.* from ff_claims c
        join ff_rosters r on r.league_id = c.league_id and r.roster_id = c.roster_id
        where c.league_id = ${leagueId} and c.week = ${w} and c.status = ${"pending"}
        order by r.waiver_order asc, c.created_at asc
      `
    : await sql<{
        id: string;
        roster_id: number;
        add_player_id: string;
        drop_player_id: string | null;
        bid: number;
        created_at: string;
      }>`
        select c.* from ff_claims c
        join ff_rosters r on r.league_id = c.league_id and r.roster_id = c.roster_id
        where c.league_id = ${leagueId} and c.week = ${w} and c.status = ${"pending"}
        order by c.bid desc, r.waiver_order asc, c.created_at asc
      `;
  const rosters = await sql<RosterOps>`select * from ff_rosters where league_id = ${leagueId}`;
  const purse = new Map(rosters.map((r) => [r.roster_id, r.faab_remaining ?? faabBudget(league)]));
  const order = rosters
    .slice()
    .sort((a, b) => (a.waiver_order ?? a.roster_id) - (b.waiver_order ?? b.roster_id))
    .map((r) => r.roster_id);
  let awarded = 0;
  const winners: number[] = [];
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
      const own = await sql`
        select player_id from ff_spots
        where league_id = ${leagueId} and roster_id = ${c.roster_id} and player_id = ${c.drop_player_id}
      `;
      if (!own[0]) {
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
    const rest = order.filter((id) => !winners.includes(id));
    const next = [...rest, ...winners.filter((id, i) => winners.indexOf(id) === i)];
    for (let i = 0; i < next.length; i++) {
      await sql`update ff_rosters set waiver_order = ${i + 1} where league_id = ${leagueId} and roster_id = ${next[i]}`;
    }
  }
  await sql`update ff_leagues set last_waiver_week = ${w} where id = ${leagueId}`;
  return { awarded };
}

export async function listClaims(leagueId: string, rosterId: number | null) {
  await ensureOpsSchema();
  const sql = await getSql();
  const league = await leagueOf(leagueId);
  const rows = await sql<{
    id: string;
    roster_id: number;
    add_player_id: string;
    drop_player_id: string | null;
    bid: number;
    status: string;
  }>`
    select * from ff_claims
    where league_id = ${leagueId} and week = ${league.current_week}
    order by bid desc, created_at asc
  `;
  return {
    week: league.current_week,
    open: waiversOpen(league),
    waiverType: league.waiver_type ?? "faab",
    items: rows
      .filter((r) => r.status === "pending" || r.roster_id === rosterId)
      .map((r) => ({
        id: r.id,
        rosterId: r.roster_id,
        mine: r.roster_id === rosterId,
        add: { id: r.add_player_id, name: playerName(r.add_player_id), pos: getPlayer(r.add_player_id)?.position ?? null },
        drop: r.drop_player_id
          ? { id: r.drop_player_id, name: playerName(r.drop_player_id), pos: getPlayer(r.drop_player_id)?.position ?? null }
          : null,
        bid: r.bid,
        status: r.status,
      })),
  };
}

export type TradeAssetIn = {
  fromRoster: number;
  toRoster: number;
  kind: "player" | "pick";
  playerId?: string | null;
  pickNo?: number | null;
};

export async function proposeTrade(
  userId: string,
  leagueId: string,
  assets: TradeAssetIn[],
): Promise<{ tradeId: string }> {
  const league = await leagueOf(leagueId);
  if (league.locked) throw new Error("This desk is locked.");
  if (
    league.current_week > (league.trade_deadline_week ?? 11) &&
    league.status !== "pre_draft" &&
    league.status !== "drafting"
  ) {
    throw new Error("Trade deadline has passed.");
  }
  const sql = await getSql();
  const mine = (
    await sql<RosterOps>`select * from ff_rosters where league_id = ${leagueId} and owner_id = ${userId}`
  )[0];
  if (!mine) throw new Error("You don't have a seat.");
  if (assets.length < 1) throw new Error("Add something to the trade.");
  const sides = new Set<number>();
  for (const a of assets) {
    sides.add(a.fromRoster);
    sides.add(a.toRoster);
    if (a.kind === "player") {
      if (!a.playerId) throw new Error("Missing player.");
      const own = await sql`
        select player_id from ff_spots
        where league_id = ${leagueId} and roster_id = ${a.fromRoster} and player_id = ${a.playerId}
      `;
      if (!own[0]) throw new Error("A player in this trade is not on that roster.");
    } else {
      if (!a.pickNo) throw new Error("Missing pick.");
      const pick = await sql<{ roster_id: number; player_id: string | null }>`
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
  for (const roster of sides) {
    await sql`
      insert into ff_trade_sides (trade_id, roster_id, accepted)
      values (${id}, ${roster}, ${roster === mine.roster_id ? 1 : 0})
    `;
  }
  for (const a of assets) {
    await sql`
      insert into ff_trade_assets (id, trade_id, from_roster, to_roster, kind, player_id, pick_no)
      values (
        ${nid("ta_")}, ${id}, ${a.fromRoster}, ${a.toRoster}, ${a.kind},
        ${a.playerId ?? null}, ${a.pickNo ?? null}
      )
    `;
  }
  return { tradeId: id };
}

export async function voteTrade(
  userId: string,
  leagueId: string,
  tradeId: string,
  accept: boolean,
): Promise<void> {
  const sql = await getSql();
  const commishRow = await sql<{ commish_id: string }>`select commish_id from ff_leagues where id = ${leagueId}`;
  const isCommish = commishRow[0]?.commish_id === userId;
  const mine = (
    await sql<RosterOps>`select * from ff_rosters where league_id = ${leagueId} and owner_id = ${userId}`
  )[0];
  const trade = (
    await sql<{ status: string; proposer_roster: number }>`
      select status, proposer_roster from ff_trades where id = ${tradeId} and league_id = ${leagueId}
    `
  )[0];
  if (!trade || trade.status !== "proposed") throw new Error("Trade is not open.");
  const mySide = mine
    ? await sql`select roster_id from ff_trade_sides where trade_id = ${tradeId} and roster_id = ${mine.roster_id}`
    : [];
  if (!mySide[0] && !isCommish) throw new Error("You're not in this trade.");
  if (!accept) {
    if (!mySide[0] && !isCommish) throw new Error("You're not in this trade.");
    await sql`update ff_trades set status = ${"rejected"}, resolved_at = ${new Date().toISOString()} where id = ${tradeId}`;
    return;
  }
  if (mySide[0] && mine) {
    await sql`update ff_trade_sides set accepted = ${1} where trade_id = ${tradeId} and roster_id = ${mine.roster_id}`;
  }
  if (isCommish) {
    const pending = await sql<{ roster_id: number }>`
      select s.roster_id from ff_trade_sides s
      where s.trade_id = ${tradeId} and s.accepted = 0
    `;
    for (const p of pending) {
      const seat = (
        await sql<{ owner_id: string | null }>`
          select owner_id from ff_rosters where league_id = ${leagueId} and roster_id = ${p.roster_id}
        `
      )[0];
      if (seat?.owner_id && seat.owner_id !== userId) continue;
      await sql`update ff_trade_sides set accepted = ${1} where trade_id = ${tradeId} and roster_id = ${p.roster_id}`;
    }
  }
  const leftover = await sql`
    select roster_id from ff_trade_sides where trade_id = ${tradeId} and accepted = 0
  `;
  if (!leftover[0]) await executeTrade(leagueId, tradeId);
}

export async function cancelTrade(userId: string, leagueId: string, tradeId: string): Promise<void> {
  const sql = await getSql();
  const mine = (
    await sql<RosterOps>`select * from ff_rosters where league_id = ${leagueId} and owner_id = ${userId}`
  )[0];
  const trade = (
    await sql<{ status: string; proposer_roster: number }>`
      select status, proposer_roster from ff_trades where id = ${tradeId} and league_id = ${leagueId}
    `
  )[0];
  if (!mine || !trade) throw new Error("Trade not found.");
  if (trade.status !== "proposed") throw new Error("Already settled.");
  if (trade.proposer_roster !== mine.roster_id) throw new Error("Only the proposer can pull it.");
  await sql`update ff_trades set status = ${"cancelled"}, resolved_at = ${new Date().toISOString()} where id = ${tradeId}`;
}

async function executeTrade(leagueId: string, tradeId: string): Promise<void> {
  const sql = await getSql();
  const assets = await sql<{
    from_roster: number;
    to_roster: number;
    kind: string;
    player_id: string | null;
    pick_no: number | null;
  }>`select * from ff_trade_assets where trade_id = ${tradeId}`;
  const league = await leagueOf(leagueId);
  for (const a of assets) {
    if (a.kind === "player" && a.player_id) {
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
    } else if (a.kind === "pick" && a.pick_no) {
      await sql`
        update ff_picks set roster_id = ${a.to_roster}
        where league_id = ${leagueId} and pick_no = ${a.pick_no} and player_id is null
      `;
    }
  }
  await sql`update ff_trades set status = ${"processed"}, resolved_at = ${new Date().toISOString()} where id = ${tradeId}`;
}

export async function listTrades(leagueId: string) {
  await ensureOpsSchema();
  await ensureDraftBoard(leagueId);
  const sql = await getSql();
  const trades = await sql<{
    id: string;
    week: number;
    status: string;
    proposer_roster: number;
    created_at: string | Date;
  }>`
    select * from ff_trades where league_id = ${leagueId}
    order by created_at desc
    limit 40
  `;
  const rosters = await sql<RosterOps>`select * from ff_rosters where league_id = ${leagueId} order by roster_id`;
  const names = new Map(rosters.map((r) => [r.roster_id, r.team_name]));
  const owners = new Map(rosters.map((r) => [r.roster_id, r.owner_id]));
  const out = [];
  for (const t of trades) {
    const sides = await sql<{ roster_id: number; accepted: number }>`
      select roster_id, accepted from ff_trade_sides where trade_id = ${t.id}
    `;
    const assets = await sql<{
      from_roster: number;
      to_roster: number;
      kind: string;
      player_id: string | null;
      pick_no: number | null;
    }>`select * from ff_trade_assets where trade_id = ${t.id}`;
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
        house: !owners.get(s.roster_id),
      })),
      assets: assets.map((a) => ({
        fromRoster: a.from_roster,
        toRoster: a.to_roster,
        fromName: names.get(a.from_roster) ?? "",
        toName: names.get(a.to_roster) ?? "",
        kind: a.kind,
        playerId: a.player_id,
        playerName: a.player_id ? playerName(a.player_id) : null,
        pos: a.player_id ? (getPlayer(a.player_id)?.position ?? null) : null,
        pickNo: a.pick_no,
        pickLabel: a.pick_no ? pickLabelSync(a.pick_no, rosters.length) : null,
      })),
    });
  }
  return out;
}

function pickLabelSync(pickNo: number, teams: number): string {
  const n = Math.max(1, teams);
  const round = Math.ceil(pickNo / n);
  const slot = ((pickNo - 1) % n) + 1;
  return `R${round}.${String(slot).padStart(2, "0")}`;
}

export async function listTradablePicks(leagueId: string) {
  await ensureDraftBoard(leagueId);
  const sql = await getSql();
  const rosters = await sql<RosterOps>`select * from ff_rosters where league_id = ${leagueId}`;
  const picks = await sql<{
    pick_no: number;
    round: number;
    roster_id: number;
    original_roster: number | null;
    player_id: string | null;
  }>`select * from ff_picks where league_id = ${leagueId} and player_id is null order by pick_no`;
  const names = new Map(rosters.map((r) => [r.roster_id, r.team_name]));
  return picks.map((p) => ({
    pickNo: p.pick_no,
    round: p.round,
    rosterId: p.roster_id,
    originalRoster: p.original_roster ?? p.roster_id,
    label: pickLabelSync(p.pick_no, rosters.length),
    ownerName: names.get(p.roster_id) ?? `Team ${p.roster_id}`,
    via: (p.original_roster ?? p.roster_id) !== p.roster_id ? names.get(p.original_roster ?? p.roster_id) : null,
  }));
}

export async function snapshotWeek(leagueId: string, week: number): Promise<void> {
  const sql = await getSql();
  const existing = await sql`
    select roster_id from ff_week_results where league_id = ${leagueId} and week = ${week} limit 1
  `;
  if (existing[0]) return;
  const { loadMatchups } = await import("./engine.server");
  const pairs = await loadMatchups(leagueId, week);
  for (const p of pairs) {
    for (const side of [p.home, p.away]) {
      if (!side) continue;
      await sql`
        insert into ff_week_results (league_id, week, roster_id, points, starters_json)
        values (
          ${leagueId}, ${week}, ${side.rosterId}, ${side.points},
          ${JSON.stringify(side.starters.map((s) => ({ playerId: s.playerId, points: s.points ?? 0 })))}
        )
        on conflict do nothing
      `;
    }
  }
}

async function seedPlayoffs(leagueId: string, week: number): Promise<void> {
  const league = await leagueOf(leagueId);
  const start = playoffStart(league);
  if (week < start) return;
  const sql = await getSql();
  const already = await sql`
    select matchup_id from ff_matchups where league_id = ${leagueId} and week = ${week} and kind = ${"playoff"} limit 1
  `;
  if (already[0]) return;
  const { loadLeagueBundle } = await import("./engine.server");
  const bundle = await loadLeagueBundle(leagueId, null, { tick: false });
  const n = Math.max(2, league.playoff_teams);
  const seeds = bundle.standings.slice(0, n).map((s) => s.rosterId);
  if (seeds.length < 2) return;
  const byeCount = clampPlayoffByes(
    seeds.length,
    league.playoff_byes ?? defaultPlayoffByes(seeds.length),
  );
  const seedRank = new Map(seeds.map((id, i) => [id, i]));
  const round = week - start + 1;
  const pairs: Array<[number, number | null]> = [];
  const byes: number[] = [];
  if (round === 1) {
    const first = firstRoundSeeds(seeds.length, byeCount);
    for (const [a, b] of first.games) {
      pairs.push([seeds[a - 1]!, seeds[b - 1]!]);
    }
    for (const s of first.byes) byes.push(seeds[s - 1]!);
  } else {
    const prev = await sql<{ home_roster: number; away_roster: number | null }>`
      select home_roster, away_roster from ff_matchups
      where league_id = ${leagueId} and week = ${week - 1} and kind = ${"playoff"}
      order by matchup_id
    `;
    const results = await sql<{ roster_id: number; points: number }>`
      select roster_id, points from ff_week_results where league_id = ${leagueId} and week = ${week - 1}
    `;
    const pts = new Map(results.map((r) => [r.roster_id, r.points]));
    const alive: number[] = [];
    for (const m of prev) {
      if (m.away_roster == null) {
        alive.push(m.home_roster);
        continue;
      }
      const hp = pts.get(m.home_roster) ?? 0;
      const ap = pts.get(m.away_roster) ?? 0;
      alive.push(hp >= ap ? m.home_roster : m.away_roster);
    }
    const ordered = alive
      .slice()
      .sort((a, b) => (seedRank.get(a) ?? 99) - (seedRank.get(b) ?? 99));
    if (ordered.length % 2 === 1) {
      byes.push(ordered[0]!);
      ordered.shift();
    }
    for (let i = 0; i < ordered.length / 2; i++) {
      pairs.push([ordered[i]!, ordered[ordered.length - 1 - i]!]);
    }
  }
  for (let i = 0; i < pairs.length; i++) {
    await sql`
      insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster, kind, playoff_round)
      values (${leagueId}, ${week}, ${i + 1}, ${pairs[i]![0]}, ${pairs[i]![1]}, ${"playoff"}, ${round})
      on conflict do nothing
    `;
  }
  for (let i = 0; i < byes.length; i++) {
    await sql`
      insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster, kind, playoff_round)
      values (${leagueId}, ${week}, ${pairs.length + i + 1}, ${byes[i]!}, ${null}, ${"playoff"}, ${round})
      on conflict do nothing
    `;
  }
}

/** Drop 0-point snapshots written while the NFL was still in preseason. */
async function rewindGhostWeeks(leagueId: string): Promise<void> {
  const sql = await getSql();
  const scored = await sql<{ points: number }>`
    select points from ff_week_results where league_id = ${leagueId}
  `;
  if (scored.some((r) => (r.points ?? 0) > 0)) return;
  await sql`delete from ff_week_results where league_id = ${leagueId}`;
  await sql`update ff_leagues set current_week = ${1} where id = ${leagueId} and current_week > 1`;
}

export async function tickLeague(leagueId: string): Promise<{ advanced: number; waivers: number }> {
  await ensureOpsSchema();
  startLeagueClock();
  const league = await leagueOf(leagueId);
  if (league.locked || league.status === "pre_draft" || league.status === "drafting") {
    return { advanced: 0, waivers: 0 };
  }
  let advanced = 0;
  let waivers = 0;
  try {
    const { fetchNflState } = await import("@/lib/data/sleeper.server");
    const { ensureRemainingSchedule } = await import("./engine.server");
    const state = await fetchNflState();
    if (state.season !== league.season) {
      await ensureRemainingSchedule(leagueId);
      await seedPlayoffs(leagueId, league.current_week);
      return { advanced: 0, waivers: 0 };
    }
    // Preseason display_week is not the fantasy regular season. Do not
    // advance or snapshot 0–0 weeks as ties.
    if (state.season_type !== "regular" && state.season_type !== "post") {
      await rewindGhostWeeks(leagueId);
      await ensureRemainingSchedule(leagueId);
      return { advanced: 0, waivers: 0 };
    }
    const nflWeek = Math.max(1, Math.min(18, state.display_week || state.week || 1));
    const sql = await getSql();
    for (let w = 1; w < nflWeek; w++) {
      await snapshotWeek(leagueId, w);
    }
    if (league.current_week < nflWeek) {
      for (let w = league.current_week; w < nflWeek; w++) {
        const res = await processWaivers(leagueId, w);
        waivers += res.awarded;
        await seedPlayoffs(leagueId, w + 1);
        advanced += 1;
      }
      await sql`update ff_leagues set current_week = ${nflWeek} where id = ${leagueId}`;
    } else {
      const dow = new Date().getUTCDay();
      const clear = league.waiver_clear_dow ?? 3;
      if (dow >= clear && (league.last_waiver_week ?? 0) < league.current_week) {
        const res = await processWaivers(leagueId, league.current_week);
        waivers += res.awarded;
      }
    }
    await ensureRemainingSchedule(leagueId);
    await seedPlayoffs(leagueId, Math.max(league.current_week, nflWeek));
  } catch {
    return { advanced, waivers };
  }
  return { advanced, waivers };
}

export async function tickAllLeagues(): Promise<{ leagues: number; advanced: number; waivers: number }> {
  await ensureOpsSchema();
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
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
  return { leagues: rows.length, advanced, waivers };
}

const clockRef = globalThis as typeof globalThis & { __ledgerClock__?: ReturnType<typeof setInterval> };

export function startLeagueClock(): void {
  if (clockRef.__ledgerClock__) return;
  clockRef.__ledgerClock__ = setInterval(() => {
    void tickAllLeagues().catch(() => undefined);
  }, 5 * 60 * 1000);
  setTimeout(() => {
    void tickAllLeagues().catch(() => undefined);
  }, 20_000);
}

export async function commishAdvance(userId: string, leagueId: string): Promise<void> {
  const league = await leagueOf(leagueId);
  const sql = await getSql();
  const row = await sql<{ commish_id: string }>`select commish_id from ff_leagues where id = ${leagueId}`;
  if (row[0]?.commish_id !== userId) throw new Error("Only the commissioner can advance the week.");
  if (league.locked) throw new Error("This desk is locked.");
  await snapshotWeek(leagueId, league.current_week);
  await processWaivers(leagueId, league.current_week);
  const next = Math.min(18, league.current_week + 1);
  await seedPlayoffs(leagueId, next);
  const { ensureRemainingSchedule } = await import("./engine.server");
  await ensureRemainingSchedule(leagueId);
  await sql`update ff_leagues set current_week = ${next} where id = ${leagueId}`;
}

export async function commishProcessWaivers(userId: string, leagueId: string): Promise<{ awarded: number }> {
  const sql = await getSql();
  const row = await sql<{ commish_id: string }>`select commish_id from ff_leagues where id = ${leagueId}`;
  if (row[0]?.commish_id !== userId) throw new Error("Only the commissioner can process waivers.");
  return processWaivers(leagueId);
}

export function opsSummary(l: {
  waiver_type?: string | null;
  faab_budget?: number | null;
  trade_deadline_week?: number | null;
  playoff_start_week?: number | null;
  regular_weeks?: number | null;
  last_waiver_week?: number | null;
  playoff_teams?: number | null;
  playoff_byes?: number | null;
  current_week: number;
}) {
  const last = l.last_waiver_week ?? 0;
  const teams = l.playoff_teams ?? 4;
  return {
    waiverType: l.waiver_type ?? "faab",
    faabBudget: l.faab_budget ?? 100,
    tradeDeadlineWeek: l.trade_deadline_week ?? 11,
    playoffStartWeek: l.playoff_start_week ?? 15,
    regularWeeks: l.regular_weeks ?? 14,
    playoffByes: l.playoff_byes ?? defaultPlayoffByes(teams),
    lastWaiverWeek: last,
    waiversOpen: (l.waiver_type ?? "faab") !== "none" && last < l.current_week,
  };
}
