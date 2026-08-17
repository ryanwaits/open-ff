import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Avatar } from "@/components/avatar";
import { MatchupCard } from "@/components/matchup-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueBundle, getMatchups } from "@/lib/data/fns";
import { cn, fmtRecord, formatPts } from "@/lib/utils";

export const Route = createFileRoute("/league/$leagueId/standings")({
  component: StandingsPage,
});

function StandingsPage() {
  const { leagueId } = Route.useParams();
  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
    refetchInterval: (q) => (q.state.data?.scoringLive ? 15_000 : false),
  });
  const week = league.data?.currentWeek ?? 1;
  const matchups = useQuery({
    queryKey: ["matchups", leagueId, week],
    queryFn: () => getMatchups({ data: { leagueId, week } }),
    enabled: Boolean(league.data),
    refetchInterval: () => (league.data?.scoringLive ? 15_000 : false),
  });

  if (league.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }
  if (!league.data) return null;

  const playoff = league.data.league.settings.playoff_teams ?? 0;

  return (
    <div>
      {/* min-w-0 on both tracks: grid items default to min-width:auto, so the
          520px-wide standings table would otherwise size the track and push the
          whole page sideways instead of scrolling inside its own container. */}
      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="min-w-0">
        <h2 className="font-display text-2xl font-bold tracking-[-0.03em]">Standings</h2>
        <div className="mt-4 overflow-x-auto rounded-xl bg-surface shadow-[var(--shadow-border)]">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-wide text-faint">
              <tr className="border-b border-line">
                <th className="px-4 py-3.5 text-left font-medium">#</th>
                <th className="px-2 py-3.5 text-left font-medium">Team</th>
                <th className="px-3 py-3.5 text-right font-medium">W–L</th>
                <th className="px-3 py-3.5 text-right font-medium">PF</th>
                <th className="px-4 py-3.5 text-right font-medium">PA</th>
              </tr>
            </thead>
            <tbody>
              {league.data.standings.map((row, i) => {
                const inPlayoffs = playoff > 0 && i < playoff;
                return (
                  <tr key={row.rosterId} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">
                      {/* The playoff line is the only thing worth marking in a
                          standings table, so it gets the one accent. */}
                      <span
                        className={cn(
                          "grid size-6 place-items-center rounded-pill",
                          inPlayoffs ? "bg-accent text-accent-fg font-semibold" : "text-faint",
                        )}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <Link
                        to="/league/$leagueId/team/$rosterId"
                        params={{ leagueId, rosterId: String(row.rosterId) }}
                        className="flex items-center gap-2.5"
                      >
                        <Avatar src={row.avatar} name={row.teamName} className="size-8" tint />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{row.teamName}</span>
                          <span className="block truncate font-mono text-[11px] text-faint">
                            {row.manager}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-medium tabular-nums">
                      {fmtRecord(row.wins, row.losses, row.ties)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatPts(row.pf, 1)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-muted">
                      {formatPts(row.pa, 1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {playoff > 0 ? (
          <p className="mt-2 text-xs text-faint">
            Top {playoff} make the dance
            {(league.data.ops?.playoffByes ?? 0) > 0
              ? ` · #1${league.data.ops!.playoffByes > 1 ? `–${league.data.ops!.playoffByes}` : ""} bye`
              : ""}
            {league.data.standings[playoff]
              ? ` · line sits under ${league.data.standings[playoff - 1]?.teamName}`
              : ""}
            .
          </p>
        ) : null}
        {league.data.standings.every((s) => s.wins === 0 && s.losses === 0 && s.ties === 0) ? (
          <p className="mt-2 text-xs text-faint">
            Nothing in the book yet. Records stay 0–0 until regular-season kickoff.
          </p>
        ) : null}
      </section>

      <section className="min-w-0">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-bold tracking-[-0.03em]">Week {week}</h2>
          <Link
            to="/league/$leagueId/matchups"
            params={{ leagueId }}
            search={{ week }}
            className="rounded-pill px-3 py-1.5 text-sm font-medium text-muted hover:bg-raised hover:text-fg"
          >
            All weeks
          </Link>
        </div>
        <div className="mt-4 space-y-2">
          {matchups.isLoading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)
            : matchups.data?.map((pair) => (
                <MatchupCard key={pair.matchupId} pair={pair} leagueId={leagueId} week={week} />
              ))}
          {matchups.data && matchups.data.length === 0 ? (
            <p className="text-sm text-muted">No matchups posted for this week.</p>
          ) : null}
        </div>
      </section>
      </div>
    </div>
  );
}
