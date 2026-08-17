import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MatchupCard } from "@/components/matchup-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueBundle, getMatchups, getRecap } from "@/lib/data/fns";
import { cn, fmtRecord, formatPts, initials } from "@/lib/utils";

export const Route = createFileRoute("/league/$leagueId/")({
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
  const recap = useQuery({
    queryKey: ["recap", leagueId, week],
    queryFn: () => getRecap({ data: { leagueId, week } }),
    enabled: Boolean(league.data),
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
      {recap.data ? (
        <Link
          to="/league/$leagueId/recap"
          params={{ leagueId }}
          search={{ week, story: undefined }}
          className="mb-10 block rounded-xl bg-surface px-4 py-4 shadow-[var(--shadow-border)] transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)]"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            {recap.data.kicker}
          </p>
          <p className="mt-1 font-display text-2xl tracking-tight">{recap.data.headline}</p>
          <p className="mt-2 text-sm text-muted">{recap.data.dek}</p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-faint">
            Open the desk
          </p>
        </Link>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
      <section>
        <h2 className="font-display text-2xl">Standings</h2>
        <div className="mt-4 overflow-x-auto rounded-xl bg-surface shadow-[var(--shadow-border)]">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-wide text-faint">
              <tr className="border-b border-line">
                <th className="px-3 py-3 text-left font-medium">#</th>
                <th className="px-2 py-3 text-left font-medium">Team</th>
                <th className="px-3 py-3 text-right font-medium">W–L</th>
                <th className="px-3 py-3 text-right font-medium">PF</th>
                <th className="px-3 py-3 text-right font-medium">PA</th>
              </tr>
            </thead>
            <tbody>
              {league.data.standings.map((row, i) => (
                <tr key={row.rosterId} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5 font-mono text-xs text-faint">{i + 1}</td>
                  <td className="px-2 py-2.5">
                    <Link
                      to="/league/$leagueId/team/$rosterId"
                      params={{ leagueId, rosterId: String(row.rosterId) }}
                      className="flex items-center gap-2.5"
                    >
                      <span className="grid size-8 place-items-center overflow-hidden rounded-full bg-raised text-[11px]">
                        {row.avatar ? (
                          <img src={row.avatar} alt="" className="size-full object-cover" />
                        ) : (
                          initials(row.teamName)
                        )}
                      </span>
                      <span>
                        <span className="block">{row.teamName}</span>
                        <span className="block font-mono text-[11px] text-faint">
                          {row.manager}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {fmtRecord(row.wins, row.losses, row.ties)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatPts(row.pf, 1)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted">
                    {formatPts(row.pa, 1)}
                  </td>
                </tr>
              ))}
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

      <section>
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl">Week {week}</h2>
          <Link
            to="/league/$leagueId/matchups"
            params={{ leagueId }}
            search={{ week }}
            className="text-sm text-muted hover:text-fg"
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
