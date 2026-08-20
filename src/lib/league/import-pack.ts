import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlayer, matchPlayerName } from "@/lib/data/sleeper.server";
import { START_SLOTS, slotLabel } from "@/lib/data/teams";
import { defaultPlayoffByes } from "./playoffs";
import { labeledStartSlots } from "./roster";
import { bookFromPreset, fromSleeperSettings, presetOf, type ScoringBook } from "./scoring";

async function sql() {
  return (await import("@/lib/db")).getSql();
}

export type ImportPackSource = "sleeper" | "espn" | "rebuild" | "yahoo";

export type ImportPackTeam = {
  rosterId: number;
  teamName: string;
  manager: string;
  ownerKey: string | null;
  players: Array<{ playerId: string; starterSlot: string | null }>;
  snap?: {
    wins: number | null;
    losses: number | null;
    ties: number | null;
    pf: number | null;
    pa: number | null;
  };
};

export type ImportPackWeek = {
  week: number;
  games: Array<{ matchupId: number; home: number; away: number | null }>;
  results: Array<{
    rosterId: number;
    points: number;
    starters?: Array<{ playerId: string; points: number }>;
  }>;
};

/** Canonical one-way extract shape. Scoring conversion stays in adapters. */
export type ImportPack = {
  source: ImportPackSource;
  sourceLeagueId: string;
  name: string;
  season: string;
  status: "pre_draft" | "drafting" | "in_season";
  book: ScoringBook;
  slots: string[];
  playoffTeams: number;
  currentWeek: number;
  playoffStartWeek?: number;
  playoffByes?: number;
  /** When weeks are empty, commit synthesizes a round-robin (default true). */
  synthesizeSchedule?: boolean;
  warnings?: string[];
  teams: ImportPackTeam[];
  weeks: ImportPackWeek[];
};

export const DEFAULT_IMPORT_SLOTS = [
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
  "BN",
] as const;

function nid(prefix: string, n = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = prefix;
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 31)];
  return s;
}

function inviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * 32)];
  return s;
}

function makeSchedule(
  teams: number,
  weeks: number,
): Array<{ week: number; id: number; home: number; away: number | null }> {
  const ids = Array.from({ length: teams }, (_, i) => i + 1);
  if (ids.length % 2 === 1) ids.push(0);
  const m = ids.length;
  const rounds: Array<Array<[number | null, number | null]>> = [];
  const circle = [...ids];
  for (let r = 0; r < m - 1; r++) {
    const pairs: Array<[number | null, number | null]> = [];
    for (let i = 0; i < m / 2; i++) {
      const a = circle[i] ?? 0;
      const b = circle[m - 1 - i] ?? 0;
      if (a === 0) pairs.push([b, null]);
      else if (b === 0) pairs.push([a, null]);
      else pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    const last = circle.pop() ?? 0;
    circle.splice(1, 0, last);
  }
  const out: Array<{ week: number; id: number; home: number; away: number | null }> = [];
  for (let w = 1; w <= weeks; w++) {
    const round = rounds[(w - 1) % rounds.length] ?? [];
    round.forEach((p, i) => {
      out.push({ week: w, id: i + 1, home: p[0] ?? 0, away: p[1] });
    });
  }
  return out;
}

function compatible(pos: string | null | undefined, slot: string): boolean {
  if (!pos) return false;
  if (slot === pos) return true;
  if (slot === "FLEX") return pos === "RB" || pos === "WR" || pos === "TE";
  if (slot === "SUPER_FLEX") return pos === "QB" || pos === "RB" || pos === "WR" || pos === "TE";
  if (slot === "WRRB_FLEX") return pos === "RB" || pos === "WR";
  if (slot === "REC_FLEX") return pos === "WR" || pos === "TE";
  return false;
}

function assignStarters(
  playerIds: string[],
  slots: string[],
  pts: Map<string, number>,
): Array<{ playerId: string; starterSlot: string | null }> {
  const labeled = labeledStartSlots(slots);
  const used = new Set<string>();
  const rows = playerIds.map((playerId) => ({ playerId, starterSlot: null as string | null }));
  const byPts = [...rows].sort((a, b) => (pts.get(b.playerId) ?? 0) - (pts.get(a.playerId) ?? 0));
  for (const { key, label } of labeled) {
    const pick = byPts.find(
      (s) => !used.has(s.playerId) && compatible(getPlayer(s.playerId)?.position, key),
    );
    if (!pick) continue;
    used.add(pick.playerId);
    pick.starterSlot = label;
  }
  return rows;
}

function normalizeStatus(raw: string | undefined, hasPlayers: boolean): ImportPack["status"] {
  const s = (raw ?? "").toLowerCase();
  if (s === "pre_draft" || s === "drafting" || s === "in_season") return s;
  if (s.includes("draft") && !hasPlayers) return "drafting";
  return hasPlayers ? "in_season" : "pre_draft";
}

type SleeperRawPack = {
  league: {
    league_id: string;
    name: string;
    season: string;
    status: string;
    roster_positions?: string[];
    scoring_settings?: Record<string, number>;
    previous_league_id?: string | null;
    settings: {
      playoff_teams?: number;
      playoff_week_start?: number;
      last_scored_leg?: number;
      leg?: number;
    };
  };
  users: Array<{
    user_id: string;
    display_name?: string;
    metadata?: { team_name?: string };
  }>;
  rosters: Array<{
    roster_id: number;
    owner_id: string | null;
    players?: string[] | null;
    starters?: string[] | null;
    settings?: {
      wins?: number;
      losses?: number;
      ties?: number;
      fpts?: number;
      fpts_decimal?: number;
      fpts_against?: number;
      fpts_against_decimal?: number;
    };
  }>;
  weeks: Array<{
    week: number;
    rows: Array<{
      roster_id: number;
      matchup_id: number | null;
      points: number;
      starters: string[];
      starters_points: number[];
    }>;
  }>;
};

/** Map Sleeper loadImportPack → canonical ImportPack. Scoring via fromSleeperSettings. */
export function packFromSleeper(raw: SleeperRawPack, warnings: string[] = []): ImportPack {
  const byUser = new Map(raw.users.map((u) => [u.user_id, u]));
  const book = fromSleeperSettings(raw.league.scoring_settings ?? {});
  const slots = raw.league.roster_positions?.length
    ? raw.league.roster_positions
    : [...DEFAULT_IMPORT_SLOTS];
  const startSlots = slots.filter((s) => START_SLOTS.has(s));
  const hasPlayers = raw.rosters.some((r) => (r.players ?? []).length > 0);
  const teams: ImportPackTeam[] = raw.rosters.map((r) => {
    const u = r.owner_id ? byUser.get(r.owner_id) : undefined;
    const starters = r.starters ?? [];
    const players = (r.players ?? [])
      .filter((pid) => pid && pid !== "0")
      .map((pid) => {
        const idx = starters.indexOf(pid);
        const starter = idx >= 0;
        return {
          playerId: pid,
          starterSlot: starter ? slotLabel(startSlots[idx] ?? "FLEX") : null,
        };
      });
    return {
      rosterId: r.roster_id,
      teamName: (
        u?.metadata?.team_name?.trim() ||
        u?.display_name ||
        `Roster ${r.roster_id}`
      ).slice(0, 40),
      manager: u?.display_name ?? "Open",
      ownerKey: r.owner_id,
      players,
    };
  });

  const weeks: ImportPackWeek[] = [];
  for (const week of raw.weeks) {
    if (!week.rows.length) continue;
    const groups = new Map<number, typeof week.rows>();
    let orphan = 1000;
    for (const m of week.rows) {
      const key = m.matchup_id ?? orphan++;
      const arr = groups.get(key) ?? [];
      arr.push(m);
      groups.set(key, arr);
    }
    const games: ImportPackWeek["games"] = [];
    for (const [matchupId, arr] of groups) {
      const home = arr[0];
      if (!home) continue;
      games.push({
        matchupId,
        home: home.roster_id,
        away: arr[1]?.roster_id ?? null,
      });
    }
    weeks.push({
      week: week.week,
      games,
      results: week.rows.map((m) => ({
        rosterId: m.roster_id,
        points: m.points,
        starters: m.starters.map((pid, i) => ({
          playerId: pid,
          points: m.starters_points[i] ?? 0,
        })),
      })),
    });
  }

  const currentWeek = Math.max(
    1,
    raw.league.settings.leg ?? raw.league.settings.last_scored_leg ?? 1,
  );
  const playoffTeams = raw.league.settings.playoff_teams ?? (raw.rosters.length >= 12 ? 6 : 4);

  return {
    source: "sleeper",
    sourceLeagueId: raw.league.league_id,
    name: raw.league.name.slice(0, 48),
    season: raw.league.season,
    status: normalizeStatus(raw.league.status, hasPlayers),
    book,
    slots,
    playoffTeams,
    currentWeek,
    playoffStartWeek: raw.league.settings.playoff_week_start ?? 15,
    warnings: warnings.length ? warnings : undefined,
    teams,
    weeks,
  };
}

type EspnRawPack = {
  leagueId: string;
  name: string;
  season: string;
  status: string;
  book: ScoringBook;
  slots: string[];
  playoffTeams: number;
  currentWeek: number;
  teams: Array<{
    rosterId: number;
    teamName: string;
    manager: string;
    ownerKey: string | null;
    players: Array<{ sleeperId: string; slot: string; starterSlot: string | null }>;
  }>;
  weeks: Array<{
    week: number;
    games: Array<{ matchupId: number; home: number; away: number | null }>;
    results: Array<{
      rosterId: number;
      points: number;
      starters: Array<{ playerId: string; points: number }>;
    }>;
  }>;
};

/** Map ESPN loadEspnImportPack → canonical ImportPack. Book already converted. */
export function packFromEspn(raw: EspnRawPack, warnings: string[] = []): ImportPack {
  const hasPlayers = raw.teams.some((t) => t.players.length > 0);
  return {
    source: "espn",
    sourceLeagueId: `espn:${raw.season}:${raw.leagueId}`,
    name: raw.name.slice(0, 48),
    season: raw.season,
    status: normalizeStatus(raw.status, hasPlayers),
    book: raw.book,
    slots: raw.slots.length ? raw.slots : [...DEFAULT_IMPORT_SLOTS],
    playoffTeams: raw.playoffTeams,
    currentWeek: raw.currentWeek,
    warnings: warnings.length ? warnings : undefined,
    teams: raw.teams.map((t) => ({
      rosterId: t.rosterId,
      teamName: t.teamName.slice(0, 40),
      manager: t.manager,
      ownerKey: t.ownerKey,
      players: t.players.map((p) => ({
        playerId: p.sleeperId,
        starterSlot: p.starterSlot,
      })),
    })),
    weeks: raw.weeks.map((w) => ({
      week: w.week,
      games: w.games,
      results: w.results.map((r) => ({
        rosterId: r.rosterId,
        points: r.points,
        starters: r.starters,
      })),
    })),
  };
}

type RebuildTeamIn = {
  teamName: string;
  manager: string;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  pf: number | null;
  pa: number | null;
  names: string[];
};

/** Map rebuild/recap parse → ImportPack. Scoring is a preset only. */
export function packFromRebuild(input: {
  teams: RebuildTeamIn[];
  name: string;
  season: string;
  scoring: "ppr" | "half" | "std";
  knownId?: string | null;
  warnings?: string[];
}): ImportPack {
  const slots = [...DEFAULT_IMPORT_SLOTS];
  const book = bookFromPreset(input.scoring);
  const pts = new Map<string, number>();
  try {
    const seed = JSON.parse(
      readFileSync(join(process.cwd(), "data/stats-2025.json"), "utf8"),
    ) as Array<{ player_id: string; pts_ppr: number }>;
    for (const s of seed) pts.set(s.player_id, s.pts_ppr);
  } catch {
    /* seed optional for tests */
  }

  const playoffTeams = input.teams.length >= 14 ? 7 : input.teams.length >= 12 ? 6 : 4;
  const season = input.season === "2025" ? "2025" : input.season || "2026";
  const hasRecord = input.teams.some((t) => t.wins != null);

  const teams: ImportPackTeam[] = input.teams.map((t, i) => {
    const ids: string[] = [];
    for (const playerName of t.names) {
      const p = matchPlayerName(playerName);
      if (p && !ids.includes(p.player_id)) ids.push(p.player_id);
    }
    return {
      rosterId: i + 1,
      teamName: t.teamName.slice(0, 40),
      manager: t.manager,
      ownerKey: null,
      players: assignStarters(ids, slots, pts),
      snap: {
        wins: t.wins,
        losses: t.losses,
        ties: t.ties,
        pf: t.pf,
        pa: t.pa,
      },
    };
  });

  return {
    source: "rebuild",
    sourceLeagueId: input.knownId ?? "",
    name: (input.name.trim() || "Rebuilt league").slice(0, 48),
    season,
    status: "in_season",
    book,
    slots,
    playoffTeams,
    currentWeek: season === "2025" ? 14 : 1,
    playoffByes: defaultPlayoffByes(playoffTeams),
    warnings: input.warnings?.length ? input.warnings : undefined,
    // Historic standings paste: keep snap W-L only; skip invented matchups.
    synthesizeSchedule: !hasRecord || season === "2026",
    teams,
    weeks: [],
  };
}

/**
 * Merge prior-season Sleeper roster records onto matching owners.
 * Does not insert prior weeks (week numbers would collide with current season).
 */
export function mergeSleeperHistory(pack: ImportPack, prior: SleeperRawPack): ImportPack {
  const byOwner = new Map(
    prior.rosters.flatMap((r) => (r.owner_id ? [[r.owner_id, r] as const] : [])),
  );
  const teams = pack.teams.map((t) => {
    if (!t.ownerKey) return t;
    const prev = byOwner.get(t.ownerKey);
    if (!prev?.settings) return t;
    const s = prev.settings;
    const pf = typeof s.fpts === "number" ? s.fpts + (s.fpts_decimal ?? 0) / 100 : null;
    const pa =
      typeof s.fpts_against === "number"
        ? s.fpts_against + (s.fpts_against_decimal ?? 0) / 100
        : null;
    return {
      ...t,
      snap: {
        wins: s.wins ?? null,
        losses: s.losses ?? null,
        ties: s.ties ?? null,
        pf,
        pa,
      },
    };
  });
  const warn = `Included prior season ${prior.league.name} (${prior.league.season}) records only — weeks stay from current.`;
  return {
    ...pack,
    teams,
    warnings: [...(pack.warnings ?? []), warn],
  };
}

async function ensureSnapColumns(): Promise<void> {
  const db = await sql();
  await db.query(`alter table ff_rosters add column if not exists snap_wins int`);
  await db.query(`alter table ff_rosters add column if not exists snap_losses int`);
  await db.query(`alter table ff_rosters add column if not exists snap_ties int`);
  await db.query(`alter table ff_rosters add column if not exists snap_pf real`);
  await db.query(`alter table ff_rosters add column if not exists snap_pa real`);
}

async function armAfterImport(
  leagueId: string,
  teamCount: number,
  regularWeeks: number,
  fillSchedule: boolean,
): Promise<void> {
  const ops = await import("./ops.server");
  await ops.ensureOpsSchema();
  await ops.seedRosterOps(leagueId);
  await ops.ensureDraftBoard(leagueId);
  if (!fillSchedule) return;
  const db = await sql();
  const existing = await db<{ week: number }>`
    select distinct week from ff_matchups
    where league_id = ${leagueId} and week <= ${regularWeeks}
  `;
  const have = new Set(existing.map((e) => e.week));
  for (const m of makeSchedule(teamCount, regularWeeks)) {
    if (have.has(m.week)) continue;
    await db`
      insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster, kind)
      values (${leagueId}, ${m.week}, ${m.id}, ${m.home}, ${m.away}, ${"regular"})
      on conflict do nothing
    `;
  }
}

/**
 * One SQL writer for leagues / rosters / spots / weeks.
 * Adapters own scoring conversion; this only persists the pack.
 */
export async function commitImportPack(input: {
  userId: string;
  pack: ImportPack;
  claimRosterId: number | null;
}): Promise<{ leagueId: string; inviteCode: string }> {
  const { pack, userId, claimRosterId } = input;
  if (!pack.teams.length) throw new Error("Import pack has no teams.");

  const db = await sql();
  const sourceKey = pack.sourceLeagueId || null;
  if (sourceKey) {
    const existing = await db<{ id: string; invite_code: string }>`
      select id, invite_code from ff_leagues
      where source_league_id = ${sourceKey} and commish_id = ${userId}
    `.catch(() => [] as Array<{ id: string; invite_code: string }>);
    if (existing[0]) {
      return { leagueId: existing[0].id, inviteCode: existing[0].invite_code };
    }
  }

  if (pack.teams.some((t) => t.snap)) await ensureSnapColumns();

  const id = nid("lg_");
  let code = inviteCode();
  for (let i = 0; i < 6; i++) {
    if (!(await db`select id from ff_leagues where invite_code = ${code}`)[0]) break;
    code = inviteCode();
  }

  const preset = presetOf(pack.book);
  const hasPlayers = pack.teams.some((t) => t.players.length > 0);
  const status =
    pack.status === "pre_draft" || pack.status === "drafting"
      ? hasPlayers
        ? "in_season"
        : pack.status
      : pack.status;
  const playoffStart = pack.playoffStartWeek ?? 15;
  const regularWeeks = Math.max(8, playoffStart - 1);
  const byes = pack.playoffByes ?? defaultPlayoffByes(pack.playoffTeams);
  const draftStatus = hasPlayers || pack.source === "rebuild" ? "complete" : "pending";

  await db`
    insert into ff_leagues (
      id, name, season, invite_code, commish_id, status, team_count,
      scoring, roster_slots, playoff_teams, current_week, locked,
      scoring_json, source, source_league_id, playoff_start_week, regular_weeks, playoff_byes
    ) values (
      ${id}, ${pack.name.slice(0, 48)}, ${pack.season}, ${code}, ${userId},
      ${status}, ${pack.teams.length}, ${preset},
      ${JSON.stringify(pack.slots)}, ${pack.playoffTeams}, ${pack.currentWeek},
      ${0}, ${JSON.stringify(pack.book)}, ${pack.source}, ${sourceKey},
      ${playoffStart}, ${regularWeeks}, ${byes}
    )
  `;
  await db`
    insert into ff_draft (league_id, status, pick_no)
    values (${id}, ${draftStatus}, ${1})
  `;

  for (const t of pack.teams) {
    const claim = claimRosterId === t.rosterId ? userId : null;
    if (t.snap) {
      await db`
        insert into ff_rosters (
          league_id, roster_id, team_name, owner_id, sleeper_owner_id, manager_name,
          snap_wins, snap_losses, snap_ties, snap_pf, snap_pa
        ) values (
          ${id}, ${t.rosterId}, ${t.teamName.slice(0, 40)}, ${claim}, ${t.ownerKey}, ${t.manager},
          ${t.snap.wins}, ${t.snap.losses}, ${t.snap.ties}, ${t.snap.pf}, ${t.snap.pa}
        )
      `;
    } else {
      await db`
        insert into ff_rosters (league_id, roster_id, team_name, owner_id, sleeper_owner_id, manager_name)
        values (${id}, ${t.rosterId}, ${t.teamName.slice(0, 40)}, ${claim}, ${t.ownerKey}, ${t.manager})
      `;
    }
    for (const p of t.players) {
      if (!p.playerId || p.playerId === "0") continue;
      const starter = p.starterSlot != null;
      await db`
        insert into ff_spots (league_id, roster_id, player_id, slot, starter_slot)
        values (
          ${id}, ${t.rosterId}, ${p.playerId},
          ${starter ? "starter" : "bench"}, ${p.starterSlot}
        )
        on conflict do nothing
      `;
    }
  }

  const scoredWeeks = pack.weeks.filter((w) => w.games.length || w.results.length);
  for (const week of scoredWeeks) {
    for (const g of week.games) {
      if (!g.home) continue;
      await db`
        insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster)
        values (${id}, ${week.week}, ${g.matchupId}, ${g.home}, ${g.away})
        on conflict do nothing
      `;
    }
    for (const r of week.results) {
      await db`
        insert into ff_week_results (league_id, week, roster_id, points, starters_json)
        values (
          ${id}, ${week.week}, ${r.rosterId}, ${r.points},
          ${JSON.stringify(r.starters ?? [])}
        )
        on conflict do nothing
      `;
    }
  }

  if (!scoredWeeks.length && pack.synthesizeSchedule !== false) {
    for (const m of makeSchedule(pack.teams.length, 14)) {
      await db`
        insert into ff_matchups (league_id, week, matchup_id, home_roster, away_roster)
        values (${id}, ${m.week}, ${m.id}, ${m.home}, ${m.away})
      `;
    }
  }

  await armAfterImport(
    id,
    pack.teams.length,
    regularWeeks,
    pack.synthesizeSchedule !== false || scoredWeeks.length > 0,
  );
  return { leagueId: id, inviteCode: code };
}
