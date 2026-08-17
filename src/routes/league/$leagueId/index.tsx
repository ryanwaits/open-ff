import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { LineupBoard } from "@/components/lineup-board";
import { PhaseHero } from "@/components/phase-hero";
import { PlayerFeed } from "@/components/player-feed";
import { PlayerSheet, type SheetTarget } from "@/components/player-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getActivity,
  getLeagueBundle,
  getByeWeeks,
  getMatchups,
  getProjections,
  getPulse,
  getRecap,
  getTeam,
} from "@/lib/data/fns";
import { sitPlayer, startPlayer } from "@/lib/league/fns";
import { planAutoFill } from "@/lib/league/autofill";
import { lineupHealth, resolvePhase } from "@/lib/league/phase";
import { cn, fmtRecord, formatPts } from "@/lib/utils";

export const Route = createFileRoute("/league/$leagueId/")({
  component: MyTeamPage,
});

function MyTeamPage() {
  const { leagueId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
    refetchInterval: (q) => (q.state.data?.scoringLive ? 15_000 : false),
  });
  const week = league.data?.currentWeek ?? 1;
  const rosterId = league.data?.myRosterId ?? null;

  const pulse = useQuery({ queryKey: ["pulse"], queryFn: () => getPulse() });
  const season = league.data?.league.season ?? pulse.data?.state.season ?? "";
  const byes = useQuery({
    queryKey: ["byes", season],
    queryFn: () => getByeWeeks({ data: { season } }),
    enabled: Boolean(season),
    staleTime: 12 * 60 * 60 * 1000,
  });

  const team = useQuery({
    queryKey: ["team", leagueId, rosterId, week],
    queryFn: () => getTeam({ data: { leagueId, rosterId: Number(rosterId), week } }),
    enabled: rosterId != null && Boolean(league.data),
    refetchInterval: () => (league.data?.scoringLive ? 15_000 : false),
  });

  const matchups = useQuery({
    queryKey: ["matchups", leagueId, week],
    queryFn: () => getMatchups({ data: { leagueId, week } }),
    enabled: Boolean(league.data),
    refetchInterval: () => (league.data?.scoringLive ? 15_000 : false),
  });

  const roster = team.data?.players;
  const projections = useQuery({
    queryKey: ["projections", leagueId, week, roster?.length ?? 0],
    queryFn: () =>
      getProjections({
        data: {
          leagueId,
          season,
          week,
          players: (roster ?? []).map((p) => ({
            player_id: p.player_id,
            team: p.team,
            injury_status: p.injury_status,
            status: p.status,
          })),
        },
      }),
    enabled: Boolean(season) && Boolean(roster?.length),
    staleTime: 60_000,
  });

  const activity = useQuery({
    queryKey: ["activity", leagueId, week],
    queryFn: () => getActivity({ data: { leagueId, week } }),
    enabled: Boolean(league.data),
  });

  const recap = useQuery({
    queryKey: ["recap", leagueId, week],
    queryFn: () => getRecap({ data: { leagueId, week } }),
    enabled: Boolean(league.data),
  });

  const editable = Boolean(league.data?.hosted && rosterId != null && !league.data?.locked);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["team", leagueId] });
    void qc.invalidateQueries({ queryKey: ["league", leagueId] });
    void qc.invalidateQueries({ queryKey: ["matchups", leagueId] });
  }
  const start = useMutation({
    mutationFn: (input: {
      playerId: string;
      replaceId?: string | null;
      slot?: string | null;
      name?: string;
      into?: string;
    }) => startPlayer({ data: { leagueId, ...input } }),
    onSuccess: (_r, vars) => {
      invalidate();
      if (vars.name) toast.success(`${vars.name} starts${vars.into ? ` at ${vars.into}` : ""}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start"),
  });
  const sit = useMutation({
    mutationFn: (input: { playerId: string; name?: string }) =>
      sitPlayer({ data: { leagueId, playerId: input.playerId } }),
    onSuccess: (_r, vars) => {
      invalidate();
      if (vars.name) toast(`${vars.name} moved to the bench`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not sit"),
  });

  const autoFill = useMutation({
    mutationFn: async (swaps: ReturnType<typeof planAutoFill>) => {
      // One at a time: each swap changes what the next one is replacing, and
      // the endpoint is per-player.
      for (const s of swaps) {
        await startPlayer({
          data: {
            leagueId,
            playerId: s.inPlayer.player_id,
            replaceId: s.outPlayer?.player_id ?? null,
            slot: s.outPlayer ? null : s.slot,
          },
        });
      }
      return swaps;
    },
    onSuccess: (swaps) => {
      invalidate();
      if (swaps.length === 0) return;
      const first = swaps[0]!;
      toast.success(
        swaps.length === 1
          ? `${first.inPlayer.full_name} starts at ${first.slot}`
          : `Filled ${swaps.length} slots`,
        {
          description:
            swaps.length === 1
              ? first.outPlayer
                ? `In for ${first.outPlayer.full_name}.`
                : "The slot was empty."
              : swaps.map((s) => `${s.slot} · ${s.inPlayer.full_name}`).join("  ·  "),
        },
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not set the lineup"),
  });

  const games = pulse.data?.games;
  const nflState = pulse.data?.state;
  const bundle = league.data;
  const phase = useMemo(
    () =>
      bundle
        ? resolvePhase(bundle, games, nflState)
        : { phase: "midweek" as const, nextKickoff: null, gamesInPlay: 0, gamesLeft: 0 },
    [bundle, games, nflState],
  );

  const players = team.data?.players;
  const rosterPositions = league.data?.league.roster_positions;
  const byeMap = byes.data;
  const health = useMemo(
    () => lineupHealth(players ?? [], rosterPositions, byeMap, week),
    [players, rosterPositions, byeMap, week],
  );

  const projMap = projections.data;
  const plan = useMemo(
    () =>
      planAutoFill({
        players: players ?? [],
        rosterPositions: rosterPositions ?? [],
        projections: projMap ?? {},
        byes: byeMap,
        week,
      }),
    [players, rosterPositions, projMap, byeMap, week],
  );

  const pairs = matchups.data;
  const myPair = useMemo(() => {
    if (!pairs || rosterId == null) return null;
    return pairs.find((p) => p.home.rosterId === rosterId || p.away?.rosterId === rosterId) ?? null;
  }, [pairs, rosterId]);

  if (league.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 rounded-xl" />
        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }
  if (!league.data) return null;

  // No seat in this league. Nothing personal to show, so point at the league
  // rather than render an empty shell.
  if (rosterId == null) {
    return (
      <div className="rounded-xl bg-surface px-5 py-6 shadow-[var(--shadow-border)]">
        <p className="font-display text-xl font-bold tracking-[-0.03em]">
          You don&rsquo;t have a seat here
        </p>
        <p className="mt-2 max-w-prose text-sm text-muted">
          This page is your roster and your week. Browse the league instead.
        </p>
        <Link
          to="/league/$leagueId/standings"
          params={{ leagueId }}
          className="mt-4 inline-flex h-11 items-center rounded-pill bg-raised px-5 text-sm font-semibold hover:bg-line"
        >
          Open the league
        </Link>
      </div>
    );
  }

  const me = myPair ? (myPair.home.rosterId === rosterId ? myPair.home : myPair.away) : null;
  const them = myPair ? (myPair.home.rosterId === rosterId ? myPair.away : myPair.home) : null;

  const standings = league.data.standings;
  const myIndex = standings.findIndex((s) => s.rosterId === rosterId);
  const playoff = league.data.league.settings.playoff_teams ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <PhaseHero
        phase={phase.phase}
        health={health}
        fixable={plan.length}
        fixing={autoFill.isPending}
        onFix={() => autoFill.mutate(plan)}
        leagueId={leagueId}
        week={week}
        me={me}
        them={them}
        draftStatus={league.data.draftStatus}
        waiversOpen={league.data.ops?.waiversOpen ?? false}
        editable={editable}
      />

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div id="lineup" className="min-w-0 scroll-mt-20">
          {team.isLoading || !team.data ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <LineupBoard
              team={team.data}
              rosterPositions={league.data.league.roster_positions ?? []}
              editable={editable}
              byes={byes.data}
              week={week}
              projections={projections.data}
              onOpenPlayer={(p) =>
                setSheet({
                  player: p,
                  game: p.game ?? null,
                  context: {
                    label: p.slot === "starter" ? `Starting at ${p.starterSlot}` : "On your bench",
                    rows: [["Slot", p.starterSlot ?? "Bench"]],
                  },
                })
              }
              busy={start.isPending || sit.isPending}
              onStart={(playerId, replaceId, slot, name, into) =>
                start.mutate({ playerId, replaceId, slot, name, into })
              }
              onSit={(playerId, name) => sit.mutate({ playerId, name })}
            />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <PlayerFeed
            phase={phase.phase}
            players={team.data?.players ?? []}
            activity={activity.data ?? []}
            news={pulse.data?.news ?? []}
            loading={team.isLoading}
          />

          <section className="rounded-xl bg-surface shadow-[var(--shadow-border)]">
            <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
              <h2 className="font-display text-lg font-bold tracking-[-0.03em]">Where you sit</h2>
              {playoff > 0 ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                  Top {playoff} make it
                </span>
              ) : null}
            </header>
            <div>
              {neighbours(standings, myIndex, playoff).map((row) => (
                <button
                  key={row.rosterId}
                  data-gap={row.gapBefore ? "" : undefined}
                  type="button"
                  onClick={() =>
                    void navigate({
                      to: "/league/$leagueId/team/$rosterId",
                      params: { leagueId, rosterId: String(row.rosterId) },
                    })
                  }
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-line px-5 py-2.5 text-left last:border-0",
                    row.gapBefore && "border-t-2 border-t-line-strong",
                    row.rosterId === rosterId ? "bg-raised" : "hover:bg-raised",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-pill font-mono text-[10px]",
                      playoff > 0 && row.rank <= playoff
                        ? "bg-accent font-semibold text-accent-fg"
                        : "text-faint",
                    )}
                  >
                    {row.rank}
                  </span>
                  <Avatar src={row.avatar} name={row.teamName} className="size-7" tint />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.teamName}</span>
                  <span className="font-mono text-xs text-muted">
                    {fmtRecord(row.wins, row.losses, row.ties)}
                  </span>
                </button>
              ))}
            </div>
            <div className="px-5 py-3">
              <Link
                to="/league/$leagueId/standings"
                params={{ leagueId }}
                className="font-mono text-[11px] uppercase tracking-wide text-accent-strong"
              >
                Full standings
              </Link>
            </div>
          </section>

          {recap.data ? (
            <Link
              to="/league/$leagueId/recap"
              params={{ leagueId }}
              search={{ week, story: undefined }}
              className="block rounded-xl bg-surface px-5 py-5 shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                {recap.data.kicker}
              </p>
              <p className="mt-1.5 font-display text-xl font-bold leading-snug tracking-[-0.03em]">
                <span className="hl">{recap.data.headline}</span>
              </p>
              <p className="mt-2.5 text-sm text-muted">{recap.data.dek}</p>
            </Link>
          ) : null}
        </div>
      </div>

      <PlayerSheet target={sheet} leagueId={leagueId} onClose={() => setSheet(null)} />

      {me && them ? (
        <p className="text-xs text-faint">
          Week {week} &middot; {me.teamName} {formatPts(me.points, 1)} vs {them.teamName}{" "}
          {formatPts(them.points, 1)}.
        </p>
      ) : null}
    </div>
  );
}

type StandingLike = {
  rosterId: number;
  teamName: string;
  avatar: string | null;
  wins: number;
  losses: number;
  ties: number;
};

/**
 * Your row plus the playoff cut. The full table is one tap away; what you
 * actually want daily is where you sit relative to the line.
 *
 * The window is contiguous, because a list that skips a rank reads as a bug
 * rather than as an edit. When you sit too far from the cut to show both in
 * five rows, the jump is marked instead of silently closed.
 */
function neighbours(standings: StandingLike[], myIndex: number, playoff: number) {
  const ranked = standings.map((s, i) => ({ ...s, rank: i + 1, gapBefore: false }));
  if (ranked.length === 0) return ranked;
  if (myIndex < 0) return ranked.slice(0, 5);

  const MAX = 5;
  const cut = playoff > 0 ? playoff - 1 : myIndex;
  const lo = Math.max(0, Math.min(myIndex - 1, cut));
  const hi = Math.min(ranked.length - 1, Math.max(myIndex + 1, cut + 1));

  if (hi - lo + 1 <= MAX) {
    // Widen to fill the card rather than leaving a stub.
    let start = lo;
    let end = hi;
    while (end - start + 1 < MAX && (start > 0 || end < ranked.length - 1)) {
      if (end < ranked.length - 1) end += 1;
      else if (start > 0) start -= 1;
    }
    return ranked.slice(start, end + 1);
  }

  // Too far apart: show the cut, then my neighbourhood, and mark the jump.
  const top = playoff > 0 ? ranked.slice(cut, cut + 2) : [];
  const mineStart = Math.max(top.length ? cut + 2 : 0, myIndex - 1);
  const mine = ranked.slice(mineStart, mineStart + (MAX - top.length));
  if (top.length && mine.length && mine[0]!.rank > top[top.length - 1]!.rank + 1) {
    mine[0] = { ...mine[0]!, gapBefore: true };
  }
  return [...top, ...mine];
}
