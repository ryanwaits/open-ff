import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayerCell } from "@/components/player-cell";
import { PlayerSheet, type SheetTarget } from "@/components/player-sheet";
import { PlayerWatch, watchFromLine, type WatchTarget } from "@/components/player-watch";
import { ReplayBar } from "@/components/replay-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueBundle, getMatchups, getWeekStats } from "@/lib/data/fns";
import { fantasyStatKind } from "@/lib/data/calendar";
import { formatStatLine } from "@/lib/data/statline";
import type { MatchupSide } from "@/lib/data/types";
import {
  applyReplayPairs,
  bookFromLeague,
  LIVE_POLL_MS,
  pairingHasScores,
  pairingIsLive,
  REPLAY_PHASES,
  REPLAY_TICK_MS,
  seedPairsForReplay,
} from "@/lib/replay";
import { cn, formatPts } from "@/lib/utils";

type Search = { week?: number; focus?: number };

export const Route = createFileRoute("/league/$leagueId/matchups")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    week: s.week != null ? Number(s.week) : undefined,
    focus: s.focus != null ? Number(s.focus) : undefined,
  }),
  component: MatchupsPage,
});

function SideCol({
  side,
  prev,
  leagueId,
  stats,
  onPlayer,
}: {
  side: MatchupSide;
  prev: MatchupSide | null;
  leagueId: string;
  stats: Record<string, Record<string, number>>;
  onPlayer: (t: WatchTarget | null) => void;
}) {
  const teamDelta = prev ? side.points - prev.points : 0;
  return (
    <div>
      <Link
        to="/league/$leagueId/team/$rosterId"
        params={{ leagueId, rosterId: String(side.rosterId) }}
        className="block"
      >
        <p className="truncate text-sm">{side.teamName}</p>
        <p className="flex items-baseline gap-2 font-display text-3xl tabular-nums tracking-tight">
          {formatPts(side.points, 2)}
          {teamDelta > 0.04 ? (
            <span className="font-mono text-sm text-win">+{formatPts(teamDelta, 1)}</span>
          ) : null}
        </p>
      </Link>
      <ul className="mt-3 space-y-1.5">
        {side.starters.map((line, i) => {
          const before = prev?.starters[i]?.points ?? 0;
          const now = line.points ?? 0;
          const bump = now - before;
          const bag = line.stats ?? (line.playerId ? stats[line.playerId] : undefined);
          return (
            <li
              key={`${i}-${line.slot}-${line.playerId ?? "e"}`}
              className={cn(
                "flex items-center gap-2 rounded-md px-1 py-1 transition-colors duration-300",
                bump > 0.04 && "bg-win/10",
              )}
            >
              <span className="w-8 shrink-0 font-mono text-[10px] text-faint">{line.slot}</span>
              <button
                type="button"
                disabled={!line.player}
                onClick={() =>
                  onPlayer(
                    watchFromLine(line, side.teamName, formatStatLine(line.player?.position, bag), bag),
                  )
                }
                className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep disabled:cursor-default"
              >
                <PlayerCell
                  player={line.player}
                  empty="—"
                  compact
                  game={line.game}
                  line={formatStatLine(line.player?.position, bag)}
                />
              </button>
              <span className="w-16 text-right font-mono text-xs tabular-nums">
                {formatPts(line.points, 1)}
                {bump > 0.04 ? (
                  <span className="block text-[10px] text-win">+{formatPts(bump, 1)}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MatchupsPage() {
  const { leagueId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [phase, setPhase] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [watch, setWatch] = useState<WatchTarget | null>(null);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);

  /** Live game means play-by-play; anything else means the profile. */
  function openPlayer(t: WatchTarget | null) {
    if (!t) return;
    if (t.gameState === "in") {
      setWatch(t);
      return;
    }
    setSheet({
      player: t.player,
      game:
        t.gameId || t.gameDetail
          ? { state: t.gameState ?? "pre", detail: t.gameDetail ?? "", opp: null, gameId: t.gameId }
          : null,
      context: { label: t.club, rows: [["Slot", t.slot]] },
    });
  }

  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
    refetchInterval: (q) =>
      phase == null && q.state.data?.scoringLive ? LIVE_POLL_MS : false,
  });
  const week = search.week ?? league.data?.currentWeek ?? 1;
  const matchups = useQuery({
    queryKey: ["matchups", leagueId, week],
    queryFn: () => getMatchups({ data: { leagueId, week } }),
    enabled: Boolean(league.data),
    refetchInterval: (q) => {
      if (phase != null) return false;
      const rows = q.state.data ?? [];
      const live = rows.some((pair) =>
        [pair.home, pair.away].some((side) =>
          side?.starters.some((s) => s.game?.state === "in"),
        ),
      );
      return live || league.data?.scoringLive ? LIVE_POLL_MS : false;
    },
  });
  const weekStats = useQuery({
    queryKey: ["week-stats", league.data?.league.season, week],
    queryFn: () =>
      getWeekStats({
        data: {
          season: String(league.data!.league.season),
          week,
          kind: fantasyStatKind(),
        },
      }),
    enabled: Boolean(league.data?.league.season),
  });
  const priorSeason = league.data?.league.season
    ? String(Number(league.data.league.season) - 1)
    : "";
  const priorStats = useQuery({
    queryKey: ["week-stats", priorSeason, week],
    queryFn: () =>
      getWeekStats({
        data: { season: priorSeason, week, kind: fantasyStatKind() },
      }),
    enabled: Boolean(priorSeason) && Number.isFinite(Number(priorSeason)),
  });
  const liveFinals = weekStats.data ?? {};
  const hasLiveStats = Object.keys(liveFinals).length > 0;
  const book = bookFromLeague(league.data?.league.scoring_settings);
  const seeded = useMemo(() => {
    const bags = hasLiveStats ? liveFinals : { ...(priorStats.data ?? {}) };
    return seedPairsForReplay(matchups.data ?? [], week, bags, book);
  }, [matchups.data, week, liveFinals, priorStats.data, hasLiveStats, book]);
  const finals = seeded.finals;
  const seededPairs = seeded.pairs;
  const usingDemo = Boolean(matchups.data?.some((p) => !pairingHasScores(p)));

  useEffect(() => {
    setPhase(null);
    setRunning(false);
  }, [week, leagueId]);

  useEffect(() => {
    if (!running || phase == null) return;
    if (phase >= REPLAY_PHASES.length - 1) {
      setRunning(false);
      return;
    }
    const t = window.setTimeout(() => setPhase((p) => (p == null ? 0 : p + 1)), REPLAY_TICK_MS);
    return () => window.clearTimeout(t);
  }, [running, phase]);

  const playoffStart = league.data?.ops?.playoffStartWeek ?? league.data?.league.settings.playoff_week_start ?? 15;
  const maxWeek = Math.max(
    playoffStart + 2,
    league.data?.ops?.regularWeeks ?? 14,
    league.data?.currentWeek ?? 1,
  );

  const shown = useMemo(() => {
    if (!seededPairs.length) return [];
    if (phase == null) return matchups.data ?? [];
    return applyReplayPairs(seededPairs, week, phase, finals);
  }, [matchups.data, seededPairs, phase, week, finals]);

  const prevShown = useMemo(() => {
    if (!seededPairs.length || phase == null || phase <= 0) return null;
    return applyReplayPairs(seededPairs, week, phase - 1, finals);
  }, [seededPairs, phase, week, finals]);

  const weekLive = (matchups.data ?? []).some(pairingIsLive);
  const canReplay = !weekLive;

  useEffect(() => {
    if (!canReplay && phase != null) {
      setPhase(null);
      setRunning(false);
    }
  }, [canReplay, phase]);

  function startReplay() {
    setPhase(0);
    setRunning(true);
  }

  function stopReplay() {
    setRunning(false);
    setPhase(null);
  }

  return (
    <div>
      {league.data?.scoringLive && phase == null ? (
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-live">
          Live unofficial · ticks every {LIVE_POLL_MS / 1000}s
        </p>
      ) : null}

      {canReplay ? (
        <div className="mb-4">
          <ReplayBar
            phase={phase}
            running={running}
            onStart={startReplay}
            onToggle={() => setRunning((v) => !v)}
            onStop={stopReplay}
            kicker={usingDemo ? "Simulate this week" : "Replay lab"}
            actionLabel={usingDemo ? "Simulate this week" : "Watch it tick"}
            copy={
              usingDemo
                ? "No unofficial lines yet — this unfolds last season / a demo bag through your scoring book. Real Sunday stats replace it automatically."
                : "Unofficial points and stat lines from this week, unfolded like a Sunday."
            }
          />
        </div>
      ) : null}

      <div className="flex gap-1 overflow-x-auto pb-4">
        {Array.from({ length: maxWeek }, (_, i) => i + 1).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => navigate({ search: { week: w } })}
            className={cn(
              "flex size-10 shrink-0 flex-col items-center justify-center rounded-sm font-mono text-sm",
              w === week ? "bg-accent text-accent-fg" : "bg-raised text-muted",
            )}
          >
            {w >= playoffStart ? <span className="text-[9px] leading-none">P</span> : null}
            {w}
          </button>
        ))}
      </div>

      {matchups.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((pair, idx) => (
            <article
              key={pair.matchupId}
              className={cn(
                "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5",
                search.focus === pair.matchupId && "ring-1 ring-accent/40",
              )}
            >
              {pair.label ? (
                <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-live">
                  {pair.label}
                </p>
              ) : null}
              <Link
                to="/league/$leagueId/matchup/$week/$matchupId"
                params={{
                  leagueId,
                  week: String(week),
                  matchupId: String(pair.matchupId),
                }}
                className="mb-4 block text-sm text-muted hover:text-fg"
              >
                Open box score
              </Link>
              <div className="grid gap-6 sm:grid-cols-2">
                <SideCol
                  side={pair.home}
                  prev={prevShown?.[idx]?.home ?? null}
                  leagueId={leagueId}
                  stats={finals}
                  onPlayer={openPlayer}
                />
                {pair.away ? (
                  <SideCol
                    side={pair.away}
                    prev={prevShown?.[idx]?.away ?? null}
                    leagueId={leagueId}
                    stats={finals}
                    onPlayer={openPlayer}
                  />
                ) : (
                  <p className="text-sm text-muted">Bye week</p>
                )}
              </div>
            </article>
          ))}
          {shown.length === 0 ? (
            <p className="text-sm text-muted">No matchups this week.</p>
          ) : null}
        </div>
      )}
      <PlayerWatch target={watch} onClose={() => setWatch(null)} />
      <PlayerSheet target={sheet} leagueId={leagueId} onClose={() => setSheet(null)} />
    </div>
  );
}
