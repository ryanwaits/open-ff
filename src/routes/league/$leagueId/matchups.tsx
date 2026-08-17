import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MatchupEdge } from "@/components/matchup-edge";
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
    <div className="min-w-0">
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

  const shown = useMemo(() => {
    if (!seededPairs.length) return [];
    if (phase == null) return matchups.data ?? [];
    return applyReplayPairs(seededPairs, week, phase, finals);
  }, [matchups.data, seededPairs, phase, week, finals]);

  const prevShown = useMemo(() => {
    if (!seededPairs.length || phase == null || phase <= 0) return null;
    return applyReplayPairs(seededPairs, week, phase - 1, finals);
  }, [seededPairs, phase, week, finals]);

  // The page shows one matchup at a time. Yours is the default, but every game
  // in the week is one tap or one arrow key away.
  const mineRosterId = league.data?.myRosterId ?? null;
  const myIndex = shown.findIndex(
    (p) => p.home.rosterId === mineRosterId || p.away?.rosterId === mineRosterId,
  );
  const focusIndex = shown.findIndex((p) => p.matchupId === search.focus);
  const defaultIndex = focusIndex >= 0 ? focusIndex : myIndex >= 0 ? myIndex : 0;
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked != null && picked < shown.length ? picked : defaultIndex;
  const pair = shown[selected] ?? null;

  function move(delta: number) {
    if (!shown.length) return;
    setPicked((selected + delta + shown.length) % shown.length);
  }

  // The strip scrolls rather than paginating, so a fourteen-team league is a
  // swipe instead of fourteen clicks. Arrows only appear when there is
  // somewhere to go.
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const syncEdges = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);
  useEffect(() => {
    syncEdges();
    const el = stripRef.current;
    if (!el) return;
    const ro = new ResizeObserver(syncEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncEdges, shown.length]);

  function scrollStrip(dir: 1 | -1) {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 200), behavior: "smooth" });
  }

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

      {matchups.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {shown.length > 1 ? (
            <div className="relative">
              {edges.left ? (
                <button
                  type="button"
                  aria-label="Scroll matchups left"
                  onClick={() => scrollStrip(-1)}
                  className="absolute top-1/2 left-0 z-10 grid size-8 -translate-x-1 -translate-y-1/2 place-items-center rounded-pill border border-line bg-surface text-faint shadow-[var(--shadow-lift)] hover:text-fg"
                >
                  <ChevronLeft className="size-4" strokeWidth={2} />
                </button>
              ) : null}
              {edges.right ? (
                <button
                  type="button"
                  aria-label="Scroll matchups right"
                  onClick={() => scrollStrip(1)}
                  className="absolute top-1/2 right-0 z-10 grid size-8 translate-x-1 -translate-y-1/2 place-items-center rounded-pill border border-line bg-surface text-faint shadow-[var(--shadow-lift)] hover:text-fg"
                >
                  <ChevronRight className="size-4" strokeWidth={2} />
                </button>
              ) : null}
            <div
              ref={stripRef}
              onScroll={syncEdges}
              role="tablist"
              aria-label="Matchups this week"
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  move(1);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  move(-1);
                }
              }}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
            >
              {shown.map((p, i) => {
                const on = i === selected;
                const homeLeads = !p.away || p.home.points >= p.away.points;
                const decided = p.home.points > 0 || (p.away?.points ?? 0) > 0;
                const yours =
                  p.home.rosterId === mineRosterId || p.away?.rosterId === mineRosterId;
                return (
                  <button
                    key={p.matchupId}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    tabIndex={on ? 0 : -1}
                    onClick={() => setPicked(i)}
                    className={cn(
                      "w-44 shrink-0 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150",
                      on
                        ? "border-line-strong bg-surface shadow-[var(--shadow-lift)]"
                        : "border-line bg-transparent hover:bg-surface",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
                        {yours ? "Your game" : `Game ${i + 1}`}
                      </span>
                      {pairingIsLive(p) ? (
                        <span className="size-1.5 shrink-0 rounded-pill bg-live" />
                      ) : null}
                    </span>
                    <span className="mt-1.5 flex items-baseline justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        <span className={homeLeads && decided ? "font-semibold" : "text-muted"}>
                          {p.home.teamName}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums">
                        {formatPts(p.home.points, 1)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-baseline justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        <span className={!homeLeads && decided ? "font-semibold" : "text-muted"}>
                          {p.away?.teamName ?? "Bye"}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums">
                        {formatPts(p.away?.points ?? 0, 1)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            </div>
          ) : null}

          {pair ? (
            <>
              <article className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
                {pair.label ? (
                  <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-live">
                    {pair.label}
                  </p>
                ) : null}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-bold tracking-[-0.03em]">
                    {pair.home.rosterId === mineRosterId || pair.away?.rosterId === mineRosterId
                      ? "Your matchup"
                      : `${pair.home.teamName} vs ${pair.away?.teamName ?? "Bye"}`}
                  </h2>
                  <Link
                    to="/league/$leagueId/matchup/$week/$matchupId"
                    params={{ leagueId, week: String(week), matchupId: String(pair.matchupId) }}
                    className="font-mono text-[11px] uppercase tracking-wide text-accent-strong"
                  >
                    Full box score
                  </Link>
                </div>
                <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <SideCol
                    side={pair.home}
                    prev={prevShown?.[selected]?.home ?? null}
                    leagueId={leagueId}
                    stats={finals}
                    onPlayer={openPlayer}
                  />
                  {pair.away ? (
                    <SideCol
                      side={pair.away}
                      prev={prevShown?.[selected]?.away ?? null}
                      leagueId={leagueId}
                      stats={finals}
                      onPlayer={openPlayer}
                    />
                  ) : (
                    <p className="text-sm text-muted">Bye week</p>
                  )}
                </div>
              </article>
              <MatchupEdge
                pair={pair}
                leagueId={leagueId}
                season={league.data?.league.season ?? ""}
                mine={mineRosterId}
              />
            </>
          ) : null}

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
