import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { MatchupEdge } from "@/components/matchup-edge";
import { PlayerCell } from "@/components/player-cell";
import { PlayerSheet, type SheetTarget } from "@/components/player-sheet";
import { PlayerWatch, watchFromLine, type WatchTarget } from "@/components/player-watch";
import { ReplayBar } from "@/components/replay-bar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueBundle, getMatchups, getTeam, getWeekStats } from "@/lib/data/fns";
import type {
  GameChip,
  MatchupPair,
  MatchupSide,
  StandingRow,
  StarterLine,
  TeamBundle,
} from "@/lib/data/types";
import { formatStatLine } from "@/lib/data/statline";
import { fantasyStatKind } from "@/lib/data/calendar";
import {
  applyReplaySide,
  bookFromLeague,
  LIVE_POLL_MS,
  pairingHasScores,
  pairingIsLive,
  REPLAY_PHASES,
  REPLAY_TICK_MS,
  replayPts,
  replayStatMap,
  seedPairForReplay,
} from "@/lib/replay";
import { cn, fmtRecord, formatPts } from "@/lib/utils";

export const Route = createFileRoute("/league/$leagueId/matchup/$week/$matchupId")({
  component: MatchupPage,
});

function MatchupPage() {
  const { leagueId, week: weekParam, matchupId: idParam } = Route.useParams();
  const week = Number(weekParam);
  const matchupId = Number(idParam);
  const [phase, setPhase] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [watch, setWatch] = useState<WatchTarget | null>(null);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);

  /**
   * A live game and a finished one ask different questions. In progress, you
   * want the play-by-play; otherwise you want the season and whether to start
   * him. Same tap, different surface.
   */
  function openPlayer(t: WatchTarget | null) {
    if (!t) return;
    if (t.gameState === "in") {
      setWatch(t);
      return;
    }
    setSheet({
      player: t.player,
      game: t.gameId || t.gameDetail
        ? { state: t.gameState ?? "pre", detail: t.gameDetail ?? "", opp: null, gameId: t.gameId }
        : null,
      context: { label: t.club, rows: [["Slot", t.slot], ["This week", formatPts(t.points, 1)]] },
    });
  }

  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
    refetchInterval: (q) =>
      phase == null && q.state.data?.scoringLive ? LIVE_POLL_MS : false,
  });
  const matchups = useQuery({
    queryKey: ["matchups", leagueId, week],
    queryFn: () => getMatchups({ data: { leagueId, week } }),
    enabled: Number.isFinite(week),
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

  const rawPair = matchups.data?.find((p) => p.matchupId === matchupId) ?? null;
  const idx = matchups.data?.findIndex((p) => p.matchupId === matchupId) ?? -1;
  const prevNav = idx > 0 ? matchups.data![idx - 1] : null;
  const nextNav =
    idx >= 0 && matchups.data && idx < matchups.data.length - 1
      ? matchups.data[idx + 1]
      : null;

  const homeTeam = useQuery({
    queryKey: ["team", leagueId, rawPair?.home.rosterId, week],
    queryFn: () =>
      getTeam({ data: { leagueId, rosterId: rawPair!.home.rosterId, week } }),
    enabled: Boolean(rawPair),
    refetchInterval: () =>
      phase == null && league.data?.scoringLive ? LIVE_POLL_MS : false,
  });
  const awayTeam = useQuery({
    queryKey: ["team", leagueId, rawPair?.away?.rosterId, week],
    queryFn: () =>
      getTeam({ data: { leagueId, rosterId: rawPair!.away!.rosterId, week } }),
    enabled: Boolean(rawPair?.away),
    refetchInterval: () =>
      phase == null && league.data?.scoringLive ? LIVE_POLL_MS : false,
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
    enabled: Boolean(league.data?.league.season) && Number.isFinite(week),
    refetchInterval: () =>
      phase == null && league.data?.scoringLive ? LIVE_POLL_MS : false,
  });
  const finalsRaw = weekStats.data ?? {};
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
  const book = bookFromLeague(league.data?.league.scoring_settings);
  const usingDemo = Boolean(rawPair && !pairingHasScores(rawPair));
  const seeded = useMemo(() => {
    if (!rawPair) return null;
    const bags = Object.keys(finalsRaw).length ? finalsRaw : { ...(priorStats.data ?? {}) };
    return seedPairForReplay(rawPair, week, bags, book);
  }, [rawPair, week, finalsRaw, priorStats.data, book]);

  useEffect(() => {
    setPhase(null);
    setRunning(false);
    setWatch(null);
  }, [week, matchupId, leagueId]);

  useEffect(() => {
    if (!running || phase == null) return;
    if (phase >= REPLAY_PHASES.length - 1) {
      setRunning(false);
      return;
    }
    const t = window.setTimeout(() => setPhase((p) => (p == null ? 0 : p + 1)), REPLAY_TICK_MS);
    return () => window.clearTimeout(t);
  }, [running, phase]);

  const pair = useMemo(() => {
    if (!seeded) return null;
    if (phase == null) return rawPair;
    return {
      ...seeded.pair,
      home: applyReplaySide(seeded.pair.home, week, phase, seeded.finals),
      away: seeded.pair.away
        ? applyReplaySide(seeded.pair.away, week, phase, seeded.finals)
        : null,
    };
  }, [rawPair, seeded, phase, week]);

  const prevPair = useMemo(() => {
    if (!seeded || phase == null || phase <= 0) return null;
    return {
      home: applyReplaySide(seeded.pair.home, week, phase - 1, seeded.finals),
      away: seeded.pair.away
        ? applyReplaySide(seeded.pair.away, week, phase - 1, seeded.finals)
        : null,
    };
  }, [seeded, phase, week]);

  const stats = useMemo(
    () =>
      phase == null
        ? usingDemo
          ? {}
          : finalsRaw
        : replayStatMap(seeded?.finals ?? finalsRaw, phase, week),
    [finalsRaw, seeded, phase, week, usingDemo],
  );

  const viewHome = useMemo(
    () => replayRoster(homeTeam.data, phase, week),
    [homeTeam.data, phase, week],
  );
  const viewAway = useMemo(
    () => replayRoster(awayTeam.data, phase, week),
    [awayTeam.data, phase, week],
  );

  if (!Number.isFinite(week) || !Number.isFinite(matchupId)) {
    return <p className="text-sm text-muted">That matchup link is broken.</p>;
  }

  if (league.isLoading || matchups.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-36" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!pair) {
    return (
      <div>
        <BackLink leagueId={leagueId} week={week} />
        <p className="mt-4 text-sm text-muted">No matchup with that id this week.</p>
      </div>
    );
  }

  const standings = league.data?.standings ?? [];
  const lastPhase = REPLAY_PHASES.length - 1;
  const canReplay = Boolean(rawPair && !pairingIsLive(rawPair));
  const status =
    phase == null
      ? statusOf(pair)
      : {
          label: REPLAY_PHASES[phase]?.label ?? "Replay",
          tone: (phase >= lastPhase ? "win" : "live") as "live" | "muted" | "win",
        };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <BackLink leagueId={leagueId} week={week} />
        <div className="flex items-center gap-1">
          {prevNav ? (
            <NavChip
              leagueId={leagueId}
              week={week}
              matchupId={prevNav.matchupId}
              label="Prev"
              icon="left"
            />
          ) : (
            <span className="inline-flex h-10 w-10" />
          )}
          {nextNav ? (
            <NavChip
              leagueId={leagueId}
              week={week}
              matchupId={nextNav.matchupId}
              label="Next"
              icon="right"
            />
          ) : (
            <span className="inline-flex h-10 w-10" />
          )}
        </div>
      </div>

      {canReplay ? (
        <div className="mb-4">
          <ReplayBar
            phase={phase}
            running={running}
            onStart={() => {
              setPhase(0);
              setRunning(true);
            }}
            onToggle={() => setRunning((v) => !v)}
            onStop={() => {
              setRunning(false);
              setPhase(null);
            }}
            kicker={usingDemo ? "Simulate this box" : "Replay this box"}
            actionLabel={usingDemo ? "Simulate this week" : "Watch it tick"}
            copy={
              usingDemo
                ? "No unofficial lines yet — last season / a demo bag, scored with your book. Real Sunday stats replace it automatically."
                : "Unofficial yards, TDs, and catches unfold on the same clock as the score."
            }
          />
        </div>
      ) : pairingIsLive(pair) ? (
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-live">
          Live unofficial · same pipe as Sunday · ticks every {LIVE_POLL_MS / 1000}s
        </p>
      ) : null}

      <Scoreboard
        pair={pair}
        week={week}
        leagueId={leagueId}
        standings={standings}
        status={status}
        live={
          phase == null && Boolean(league.data?.scoringLive) && status.tone === "live"
        }
      />

      <MatchupEdge
        pair={pair}
        leagueId={leagueId}
        season={league.data?.league.season ?? ""}
        mine={league.data?.myRosterId ?? null}
      />

      <section className="mt-6 rounded-xl bg-surface shadow-[var(--shadow-border)]">
        <header className="flex items-center justify-between border-b border-line px-3 py-2.5 sm:px-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Starters
          </h2>
          <p className="font-mono text-[11px] tabular-nums text-faint">
            Tap a name · {formatPts(starterTotal(pair.home), 1)}
            <span className="mx-1.5 text-line">·</span>
            {pair.away ? formatPts(starterTotal(pair.away), 1) : "Bye"}
          </p>
        </header>
        <ul>
          {pair.home.starters.map((homeLine, i) => (
            <StarterRow
              key={`${homeLine.slot}-${i}`}
              home={homeLine}
              away={pair.away?.starters[i] ?? null}
              prevHome={prevPair?.home.starters[i] ?? null}
              prevAway={prevPair?.away?.starters[i] ?? null}
              bye={!pair.away}
              stats={stats}
              homeClub={pair.home.teamName}
              awayClub={pair.away?.teamName ?? ""}
              onWatch={openPlayer}
            />
          ))}
        </ul>
      </section>

      {pair.away ? (
        <section className="mt-6 rounded-xl bg-surface shadow-[var(--shadow-border)]">
          <header className="border-b border-line px-3 py-2.5 sm:px-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Bench
            </h2>
          </header>
          {homeTeam.isLoading || awayTeam.isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <BenchGrid
              home={viewHome}
              away={viewAway}
              stats={stats}
              homeClub={pair.home.teamName}
              awayClub={pair.away?.teamName ?? ""}
              onWatch={openPlayer}
            />
          )}
        </section>
      ) : (
        <section className="mt-6 rounded-xl bg-surface shadow-[var(--shadow-border)]">
          <header className="border-b border-line px-3 py-2.5 sm:px-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Bench
            </h2>
          </header>
          {homeTeam.isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-10" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {benchOf(viewHome).map((p) => (
                <li key={p.player_id}>
                  <button
                    type="button"
                    onClick={() =>
                      setWatch({
                        player: p,
                        slot: "BN",
                        points: p.weekPts,
                        line: formatStatLine(p.position, stats[p.player_id]),
                        gameState: p.game?.state ?? null,
                        gameId: p.game?.gameId ?? null,
                        gameDetail: p.game?.detail ?? null,
                        club: pair.home.teamName,
                        stats: stats[p.player_id] ?? null,
                      })
                    }
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left sm:px-4 hover:bg-raised"
                  >
                    <div className="min-w-0 flex-1">
                      <PlayerCell
                        player={p}
                        compact
                        game={p.game}
                        line={formatStatLine(p.position, stats[p.player_id])}
                      />
                    </div>
                    <span className="w-12 text-right font-mono text-sm tabular-nums">
                      {formatPts(p.weekPts, 1)}
                    </span>
                  </button>
                </li>
              ))}
              {benchOf(viewHome).length === 0 ? (
                <li className="px-3 py-4 text-sm text-muted sm:px-4">No one on the pine.</li>
              ) : null}
            </ul>
          )}
        </section>
      )}

      {matchups.data && matchups.data.length > 1 ? (
        <section className="mt-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Rest of week {week}
          </h2>
          <ul className="mt-3 space-y-1.5">
            {matchups.data
              .filter((p) => p.matchupId !== pair.matchupId)
              .map((p) => (
                <li key={p.matchupId}>
                  <Link
                    to="/league/$leagueId/matchup/$week/$matchupId"
                    params={{
                      leagueId,
                      week: String(week),
                      matchupId: String(p.matchupId),
                    }}
                    className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5 text-sm shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
                  >
                    <span className="min-w-0 flex-1 truncate">{p.home.teamName}</span>
                    <span className="shrink-0 font-mono tabular-nums text-muted">
                      {formatPts(p.home.points, 1)}–{formatPts(p.away?.points ?? 0, 1)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-right">
                      {p.away?.teamName ?? "Bye"}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <PlayerWatch target={watch} onClose={() => setWatch(null)} />
      <PlayerSheet target={sheet} leagueId={leagueId} onClose={() => setSheet(null)} />
    </div>
  );
}

function BackLink({ leagueId, week }: { leagueId: string; week: number }) {
  return (
    <Link
      to="/league/$leagueId/matchups"
      params={{ leagueId }}
      search={{ week }}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-fg"
    >
      <ChevronLeft className="size-4" strokeWidth={1.75} />
      Week {week} slate
    </Link>
  );
}

function NavChip({
  leagueId,
  week,
  matchupId,
  label,
  icon,
}: {
  leagueId: string;
  week: number;
  matchupId: number;
  label: string;
  icon: "left" | "right";
}) {
  return (
    <Link
      to="/league/$leagueId/matchup/$week/$matchupId"
      params={{ leagueId, week: String(week), matchupId: String(matchupId) }}
      className="inline-flex size-10 items-center justify-center rounded-sm bg-raised text-muted hover:text-fg"
      aria-label={label}
    >
      {icon === "left" ? (
        <ChevronLeft className="size-4" strokeWidth={1.75} />
      ) : (
        <ChevronRight className="size-4" strokeWidth={1.75} />
      )}
    </Link>
  );
}

function Scoreboard({
  pair,
  week,
  leagueId,
  standings,
  status,
  live,
}: {
  pair: MatchupPair;
  week: number;
  leagueId: string;
  standings: StandingRow[];
  status: { label: string; tone: "live" | "muted" | "win" };
  live: boolean;
}) {
  const away = pair.away;
  const decided = isDecided(pair);
  const homeLeads = !away || pair.home.points > away.points;
  const awayLeads = Boolean(away && away.points > pair.home.points);
  const tied = Boolean(away && pair.home.points === away.points && decided);

  return (
    <section className="rounded-xl bg-surface px-4 py-5 shadow-[var(--shadow-border)] sm:px-6 sm:py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          Week {week}
          {pair.label ? ` · ${pair.label}` : pair.kind === "playoff" ? " · Playoff" : ""}
        </p>
        <Badge tone={status.tone === "live" ? "live" : status.tone === "win" ? "win" : "default"}>
          {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
        <TeamHead
          side={pair.home}
          leagueId={leagueId}
          record={recordOf(standings, pair.home.rosterId)}
          leading={homeLeads && decided}
          align="left"
        />
        <div className="text-center">
          <p className="font-display text-4xl tabular-nums tracking-tight sm:text-5xl">
            <span className={homeLeads && decided ? "text-fg" : "text-muted"}>
              {formatPts(pair.home.points, 1)}
            </span>
            <span className="mx-1.5 text-2xl text-faint sm:mx-2">–</span>
            <span className={awayLeads && decided ? "text-fg" : "text-muted"}>
              {formatPts(away?.points ?? 0, 1)}
            </span>
          </p>
          {tied ? <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-faint">Tie</p> : null}
          {live ? (
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-live">
              Unofficial · {LIVE_POLL_MS / 1000}s
            </p>
          ) : null}
        </div>
        {away ? (
          <TeamHead
            side={away}
            leagueId={leagueId}
            record={recordOf(standings, away.rosterId)}
            leading={awayLeads && decided}
            align="right"
          />
        ) : (
          <div className="text-right">
            <p className="font-display text-2xl tracking-tight text-faint">Bye</p>
            <p className="mt-1 text-sm text-muted">No opponent this week</p>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 font-mono text-[11px] uppercase tracking-wide text-faint">
        <p>{yetLabel(pair.home)}</p>
        <p className="text-right">{away ? yetLabel(away) : "Bye"}</p>
      </div>
    </section>
  );
}

function TeamHead({
  side,
  leagueId,
  record,
  leading,
  align,
}: {
  side: MatchupSide;
  leagueId: string;
  record: StandingRow | undefined;
  leading: boolean;
  align: "left" | "right";
}) {
  return (
    <Link
      to="/league/$leagueId/team/$rosterId"
      params={{ leagueId, rosterId: String(side.rosterId) }}
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <Avatar
        src={side.avatar}
        name={side.teamName}
        className="size-11 sm:size-12"
        textClassName="text-sm"
        tint
      />
      <span className="min-w-0">
        <span className={cn("block truncate text-sm sm:text-base", leading ? "text-fg" : "text-muted")}>
          {side.teamName}
        </span>
        <span className="block truncate font-mono text-[11px] text-faint">
          {side.manager}
          {record
            ? ` · ${fmtRecord(record.wins, record.losses, record.ties)}`
            : ""}
        </span>
      </span>
    </Link>
  );
}

function StarterRow({
  home,
  away,
  prevHome,
  prevAway,
  bye,
  stats,
  homeClub,
  awayClub,
  onWatch,
}: {
  home: StarterLine;
  away: StarterLine | null;
  prevHome: StarterLine | null;
  prevAway: StarterLine | null;
  bye: boolean;
  stats: Record<string, Record<string, number>>;
  homeClub: string;
  awayClub: string;
  onWatch: (t: WatchTarget) => void;
}) {
  const hp = home.points ?? 0;
  const ap = away?.points ?? 0;
  const bothIn = Boolean(home.player && away?.player);
  const homeHot = bothIn && hp > ap;
  const awayHot = bothIn && ap > hp;
  const homeBump = hp - (prevHome?.points ?? hp);
  const awayBump = ap - (prevAway?.points ?? ap);
  return (
    <li className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-line px-3 py-2.5 first:border-t-0 sm:gap-3 sm:px-4">
      <Line
        side={home}
        align="left"
        hot={homeHot}
        bump={homeBump}
        stats={stats}
        club={homeClub}
        onWatch={onWatch}
      />
      <span className="w-8 text-center font-mono text-[10px] uppercase tracking-wide text-faint sm:w-10">
        {home.slot}
      </span>
      {bye ? (
        <span className="text-right text-sm text-faint">Bye</span>
      ) : (
        <Line
          side={away}
          align="right"
          hot={awayHot}
          bump={awayBump}
          stats={stats}
          club={awayClub}
          onWatch={onWatch}
        />
      )}
    </li>
  );
}

function Line({
  side,
  align,
  hot,
  bump,
  stats,
  club,
  onWatch,
}: {
  side: StarterLine | null;
  align: "left" | "right";
  hot: boolean;
  bump: number;
  stats: Record<string, Record<string, number>>;
  club: string;
  onWatch: (t: WatchTarget) => void;
}) {
  if (!side) {
    return <span className="text-sm text-faint">—</span>;
  }
  const bag = side.stats ?? (side.playerId ? stats[side.playerId] : undefined);
  const line = formatStatLine(side.player?.position, bag);
  const target = watchFromLine(side, club, line, bag);
  return (
    <button
      type="button"
      disabled={!target}
      onClick={() => target && onWatch(target)}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors duration-150",
        align === "right" && "flex-row-reverse text-right",
        bump > 0.04 && "bg-win/10",
        target && "hover:bg-raised",
      )}
    >
      <div className="min-w-0 flex-1">
        <PlayerCell
          player={side.player}
          empty="—"
          compact
          game={side.game}
          align={align}
          line={line}
        />
      </div>
      <span
        className={cn(
          "w-10 shrink-0 font-mono text-sm tabular-nums sm:w-12",
          align === "right" ? "text-left" : "text-right",
          hot ? "text-fg" : "text-muted",
        )}
      >
        {formatPts(side.points, 1)}
        {bump > 0.04 ? (
          <span className="block text-[10px] text-win">+{formatPts(bump, 1)}</span>
        ) : null}
      </span>
    </button>
  );
}

function BenchGrid({
  home,
  away,
  stats,
  homeClub,
  awayClub,
  onWatch,
}: {
  home?: TeamBundle;
  away?: TeamBundle;
  stats: Record<string, Record<string, number>>;
  homeClub: string;
  awayClub: string;
  onWatch: (t: WatchTarget) => void;
}) {
  const left = benchOf(home);
  const right = benchOf(away);
  const rows = Math.max(left.length, right.length);
  if (rows === 0) {
    return <p className="px-3 py-4 text-sm text-muted sm:px-4">Both benches are empty.</p>;
  }
  return (
    <ul>
      {Array.from({ length: rows }, (_, i) => {
        const h = left[i];
        const a = right[i];
        return (
          <li
            key={`${h?.player_id ?? "h"}-${a?.player_id ?? "a"}-${i}`}
            className="grid grid-cols-2 gap-4 border-t border-line px-3 py-2.5 first:border-t-0 sm:px-4"
          >
            {h ? (
              <button
                type="button"
                onClick={() =>
                  onWatch({
                    player: h,
                    slot: "BN",
                    points: h.weekPts,
                    line: formatStatLine(h.position, stats[h.player_id]),
                    gameState: h.game?.state ?? null,
                    gameId: h.game?.gameId ?? null,
                    gameDetail: h.game?.detail ?? null,
                    club: homeClub,
                    stats: stats[h.player_id] ?? null,
                  })
                }
                className="flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-raised"
              >
                <div className="min-w-0 flex-1">
                  <PlayerCell
                    player={h}
                    compact
                    game={h.game}
                    line={formatStatLine(h.position, stats[h.player_id])}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-sm tabular-nums text-muted">
                  {formatPts(h.weekPts, 1)}
                </span>
              </button>
            ) : (
              <span />
            )}
            {a ? (
              <button
                type="button"
                onClick={() =>
                  onWatch({
                    player: a,
                    slot: "BN",
                    points: a.weekPts,
                    line: formatStatLine(a.position, stats[a.player_id]),
                    gameState: a.game?.state ?? null,
                    gameId: a.game?.gameId ?? null,
                    gameDetail: a.game?.detail ?? null,
                    club: awayClub,
                    stats: stats[a.player_id] ?? null,
                  })
                }
                className="flex min-w-0 flex-row-reverse items-center gap-2 rounded-md px-1 py-0.5 text-right hover:bg-raised"
              >
                <div className="min-w-0 flex-1">
                  <PlayerCell
                    player={a}
                    compact
                    game={a.game}
                    align="right"
                    line={formatStatLine(a.position, stats[a.player_id])}
                  />
                </div>
                <span className="w-10 shrink-0 text-left font-mono text-sm tabular-nums text-muted">
                  {formatPts(a.weekPts, 1)}
                </span>
              </button>
            ) : (
              <span />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function benchOf(team?: TeamBundle) {
  return (team?.players ?? []).filter((p) => p.slot === "bench");
}

function replayRoster(
  team: TeamBundle | undefined,
  phase: number | null,
  week: number,
): TeamBundle | undefined {
  if (!team || phase == null) return team;
  const clock = REPLAY_PHASES[phase] ?? REPLAY_PHASES[0]!;
  return {
    ...team,
    players: team.players.map((p) => ({
      ...p,
      weekPts: replayPts(p.player_id, p.weekPts ?? 0, phase, week),
      game: p.game
        ? {
            state: clock.state,
            detail: clock.detail,
            opp: p.game.opp,
            gameId: p.game.gameId ?? null,
          }
        : { state: clock.state, detail: clock.detail, opp: null, gameId: null },
    })),
  };
}

function starterTotal(side: MatchupSide) {
  return side.starters.reduce((sum, line) => sum + (line.points ?? 0), 0);
}

function recordOf(standings: StandingRow[], rosterId: number) {
  return standings.find((s) => s.rosterId === rosterId);
}

function gamesOf(pair: MatchupPair): GameChip[] {
  return [...pair.home.starters, ...(pair.away?.starters ?? [])]
    .map((s) => s.game)
    .filter((g): g is GameChip => Boolean(g));
}

function isDecided(pair: MatchupPair) {
  const games = gamesOf(pair);
  if (games.length && games.every((g) => g.state === "post")) return true;
  return pair.home.points > 0 || (pair.away?.points ?? 0) > 0;
}

function yetToPlay(side: MatchupSide) {
  return side.starters.filter((s) => s.player && s.game?.state === "pre").length;
}

function yetLabel(side: MatchupSide) {
  const n = yetToPlay(side);
  const live = side.starters.filter((s) => s.game?.state === "in").length;
  if (live) return live === 1 ? "1 live" : `${live} live`;
  if (n === 0) {
    const had = side.starters.some((s) => s.game);
    return had ? "All in" : "Yet to play";
  }
  return n === 1 ? "1 still to play" : `${n} still to play`;
}

function statusOf(pair: MatchupPair): { label: string; tone: "live" | "muted" | "win" } {
  if (!pair.away) return { label: "Bye", tone: "muted" };
  const games = gamesOf(pair);
  if (games.some((g) => g.state === "in")) return { label: "Live", tone: "live" };
  if (games.length && games.every((g) => g.state === "post")) return { label: "Final", tone: "win" };
  if (pair.home.points === 0 && pair.away.points === 0) return { label: "Preview", tone: "muted" };
  return { label: "In progress", tone: "live" };
}
