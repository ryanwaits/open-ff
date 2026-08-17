import { getSql } from "@/lib/db";

/**
 * Keeping player status current.
 *
 * `data/players-slim.json` is a static file committed to the repo and read once
 * per process. It carries `injury_status`, `status` and `team`, all frozen at
 * whatever they were the day the file was generated — so until this existed the
 * app could never learn that anyone had been ruled out.
 *
 * Sleeper's full player map is the fix. It is a ~5 MB document and they ask that
 * it be pulled at most once a day, which is exactly the cadence this needs: the
 * book prices on Wednesday against fresh designations, and a bet placed before
 * news breaks is fair by rule.
 *
 * The bundled file stays as the base layer — it holds names, positions, numbers
 * and headshot ids that do not change. This only overlays the fields that do.
 */

const SLEEPER_PLAYERS = "https://api.sleeper.app/v1/players/nfl";

/** Sleeper's guidance is once per day; this leaves room for an hourly cron to no-op. */
const REFRESH_AFTER_MS = 20 * 60 * 60 * 1000;

export type StatusOverlay = {
  injuryStatus: string | null;
  status: string | null;
  team: string | null;
};

let ready = false;

async function ensureSchema(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(
    `create table if not exists ff_player_status (
      player_id text primary key,
      injury_status text,
      status text,
      team text,
      updated_at timestamptz not null default now())`,
  );
  await sql.query(
    `create table if not exists ff_refresh_log (
      key text primary key,
      at timestamptz not null default now(),
      note text)`,
  );
  ready = true;
}

async function lastRunAt(key: string): Promise<number | null> {
  const sql = await getSql();
  const row = (
    await sql<{ at: string }>`select at from ff_refresh_log where key = ${key}`
  )[0];
  return row ? new Date(row.at).getTime() : null;
}

type SleeperPlayer = {
  player_id?: string;
  injury_status?: string | null;
  status?: string | null;
  team?: string | null;
};

/**
 * Pull the player map and store only what changes.
 *
 * Returns the set of players whose designation moved, so the caller can turn
 * those into league events — an injury appearing is a story, and this is the
 * only moment the app is ever in a position to notice it.
 */
export async function refreshPlayerStatus(opts: { force?: boolean } = {}): Promise<{
  skipped: boolean;
  scanned: number;
  changed: { playerId: string; from: string | null; to: string | null }[];
}> {
  await ensureSchema();
  const sql = await getSql();

  if (!opts.force) {
    const last = await lastRunAt("players");
    if (last != null && Date.now() - last < REFRESH_AFTER_MS) {
      return { skipped: true, scanned: 0, changed: [] };
    }
  }

  const res = await fetch(SLEEPER_PLAYERS, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Sleeper players ${res.status}`);
  const map = (await res.json()) as Record<string, SleeperPlayer>;

  const prior = new Map(
    (
      await sql<{ player_id: string; injury_status: string | null }>`
        select player_id, injury_status from ff_player_status
      `
    ).map((r) => [r.player_id, r.injury_status]),
  );

  const changed: { playerId: string; from: string | null; to: string | null }[] = [];
  let scanned = 0;

  for (const [id, p] of Object.entries(map)) {
    if (!p || typeof p !== "object") continue;
    scanned += 1;
    const injury = norm(p.injury_status);
    const status = norm(p.status);
    const team = norm(p.team);

    // Only players we have seen before can be said to have *changed*. On the
    // first run everyone is new, and calling that an injury event would bury
    // the league's first week under a few hundred meaningless rows.
    if (prior.has(id)) {
      const was = prior.get(id) ?? null;
      if (was !== injury) changed.push({ playerId: id, from: was, to: injury });
    }

    await sql`
      insert into ff_player_status (player_id, injury_status, status, team, updated_at)
      values (${id}, ${injury}, ${status}, ${team}, now())
      on conflict (player_id) do update set
        injury_status = excluded.injury_status,
        status = excluded.status,
        team = excluded.team,
        updated_at = now()
    `;
  }

  await sql`
    insert into ff_refresh_log (key, at, note)
    values (${"players"}, now(), ${`${scanned} scanned, ${changed.length} changed`})
    on conflict (key) do update set at = now(), note = excluded.note
  `;

  return { skipped: false, scanned, changed };
}

/**
 * The overlay for a set of players, empty when the refresh has never run.
 *
 * Callers merge this over the bundled record rather than replacing it, so a
 * league still works before the first refresh — just with stale designations,
 * which is exactly where the app is today.
 */
export async function statusOverlay(
  playerIds: string[],
): Promise<Record<string, StatusOverlay>> {
  if (playerIds.length === 0) return {};
  try {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql<{
      player_id: string;
      injury_status: string | null;
      status: string | null;
      team: string | null;
    }>`
      select player_id, injury_status, status, team
      from ff_player_status
      where player_id = any(${playerIds})
    `;
    const out: Record<string, StatusOverlay> = {};
    for (const r of rows) {
      out[r.player_id] = {
        injuryStatus: r.injury_status,
        status: r.status,
        team: r.team,
      };
    }
    return out;
  } catch {
    // No refresh yet, or no database. The bundled values stand.
    return {};
  }
}

function norm(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
}
