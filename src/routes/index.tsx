import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Newspaper } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ScoreStrip } from "@/components/scoreboard";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { findSleeperUser, getPulse } from "@/lib/data/fns";
import {
  DEMO_HOSTED_ID,
  DEMO_HOSTED_NAME,
  DEMO_LEAGUE_ID,
  DEMO_LEAGUE_NAME,
  type LeagueSummary,
  type Pulse,
} from "@/lib/data/types";
import { listMyLeagues } from "@/lib/league/fns";
import { useLeagueStore } from "@/lib/store";
import { PlayerCell } from "@/components/player-cell";

export const Route = createFileRoute("/")({
  loader: () => getPulse(),
  component: Home,
});

function Home() {
  const pulse = Route.useLoaderData() as Pulse;
  const navigate = useNavigate();
  const remember = useLeagueStore((s) => s.remember);
  const recent = useLeagueStore((s) => s.recent);
  const [query, setQuery] = useState("");
  const [leagues, setLeagues] = useState<LeagueSummary[] | null>(null);
  const mine = useQuery({
    queryKey: ["my-leagues"],
    queryFn: () => listMyLeagues(),
  });
  const lookup = useMutation({
    mutationFn: async (q: string) => findSleeperUser({ data: { query: q } }),
    onSuccess: (res) => {
      if (!res) {
        toast("No Sleeper user by that name.");
        setLeagues([]);
        return;
      }
      setLeagues(res.leagues);
      if (!res.leagues.length) toast("User found, but no NFL leagues listed.");
    },
    onError: () => toast("Could not reach Sleeper. Try again."),
  });

  function openLeague(league: { leagueId: string; name: string; season: string }) {
    remember(league);
    void navigate({ to: "/league/$leagueId", params: { leagueId: league.leagueId } });
  }

  return (
    <Shell>
      <section className="ledger-in grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
            {pulse.state.season} · {pulse.state.season_type === "pre" ? "Preseason" : "Regular"} ·
            Week {pulse.state.display_week}
          </p>
          <h1 className="mt-3 font-display text-5xl leading-[0.95] tracking-tight sm:text-6xl">
            Your league.
            <br />
            <span className="italic">Nobody else's app.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            Draft, lineups, waivers, and a weekly dispatch — hosted here.
            Sleeper only feeds players and stats. Your friends sign in on
            Ledger. They never download another app.
          </p>
        </div>
        <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Open a desk
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <Link to="/new">Create a league</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/join">Join with a code</Link>
            </Button>
          </div>
          <Button asChild variant="ghost" className="mt-2 w-full">
            <Link to="/import">Import a league</Link>
          </Button>
          <p className="mt-3 text-xs text-faint">
            One commissioner. Invite codes. House clubs fill empty seats.
          </p>
        </div>
      </section>

      {mine.data && mine.data.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Your seats
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {mine.data.map((l) => (
              <li key={l.leagueId}>
                <button
                  type="button"
                  onClick={() =>
                    openLeague({ leagueId: l.leagueId, name: l.name, season: l.season })
                  }
                  className="flex w-full items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-left shadow-[var(--shadow-border)] transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)]"
                >
                  <span>
                    <span className="block text-sm">{l.name}</span>
                    <span className="font-mono text-[11px] text-faint">
                      {l.season} · {l.role} · {l.status.replace("_", " ")}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-faint" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="ledger-in-2 mt-10 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() =>
            openLeague({ leagueId: DEMO_HOSTED_ID, name: DEMO_HOSTED_NAME, season: "2025" })
          }
          className="rounded-xl bg-surface p-5 text-left shadow-[var(--shadow-border)] transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)]"
        >
          <Badge>Demo · hosted here</Badge>
          <h2 className="mt-3 font-display text-2xl">{DEMO_HOSTED_NAME}</h2>
          <p className="mt-1 text-sm text-muted">
            A finished 10-team redraft scored from 2025 weeks — standings,
            box scores, recap. No Sleeper login.
          </p>
        </button>
        <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <Badge tone="muted">Optional peek</Badge>
          <h2 className="mt-3 font-display text-2xl">Public Sleeper league</h2>
          <p className="mt-1 text-sm text-muted">
            Commissioner-only. Paste a username to browse a public Sleeper
            league. Members still play here.
          </p>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const q = query.trim();
              if (!q) return;
              if (/^\d{10,}$/.test(q)) {
                openLeague({ leagueId: q, name: "Sleeper league", season: pulse.state.season });
                return;
              }
              lookup.mutate(q);
            }}
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sleeper username"
              autoComplete="off"
              aria-label="Sleeper username or league ID"
            />
            <Button type="submit" variant="outline" disabled={lookup.isPending} className="sm:w-28">
              {lookup.isPending ? "…" : "Peek"}
            </Button>
          </form>
        </div>
      </section>

      {leagues && leagues.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Sleeper leagues found
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {leagues.map((l) => (
              <li key={l.league_id}>
                <button
                  type="button"
                  onClick={() =>
                    openLeague({
                      leagueId: l.league_id,
                      name: l.name,
                      season: l.season,
                    })
                  }
                  className="flex w-full items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-left shadow-[var(--shadow-border)] transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)]"
                >
                  <span>
                    <span className="block text-sm">{l.name}</span>
                    <span className="font-mono text-[11px] text-faint">
                      {l.season} · {l.total_rosters} teams · {l.status.replace("_", " ")}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-faint" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recent.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Recent
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {recent.map((r) => (
              <Link
                key={r.leagueId}
                to="/league/$leagueId"
                params={{ leagueId: r.leagueId }}
                className="rounded-full bg-raised px-3 py-1.5 text-sm text-muted hover:text-fg"
              >
                {r.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <p className="mt-6 text-xs text-faint">
        Curious how a finished Sleeper season looks?{" "}
        <button
          type="button"
          className="underline-offset-2 hover:underline"
          onClick={() =>
            openLeague({ leagueId: DEMO_LEAGUE_ID, name: DEMO_LEAGUE_NAME, season: "2025" })
          }
        >
          Peek at {DEMO_LEAGUE_NAME}
        </button>
        .
      </p>

      <section className="ledger-in-3 mt-12">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="font-display text-3xl tracking-tight">NFL board</h2>
          <Link to="/scores" className="text-sm text-muted hover:text-fg">
            Full scores
          </Link>
        </div>
        {pulse.games.length ? (
          <ScoreStrip games={pulse.games} />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        )}
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2 className="font-display text-3xl tracking-tight">Trending adds</h2>
          <p className="mt-1 text-sm text-muted">Sleeper waiver heat, last 24 hours.</p>
          <ul className="mt-4 divide-y divide-line">
            {pulse.trending.map((p) => (
              <li key={p.player_id} className="flex items-center justify-between gap-3 py-2.5">
                <PlayerCell player={p} />
                <span className="font-mono text-xs tabular-nums text-muted">
                  {p.adds.toLocaleString()} adds
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-3xl tracking-tight">Wire copy</h2>
          <ul className="mt-4 space-y-4">
            {pulse.news.map((n) => (
              <li key={n.id} className="border-t border-line pt-3">
                <p className="text-sm leading-snug">{n.headline}</p>
                {n.description ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                    {n.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-faint">
            <Newspaper className="size-3.5" />
            Headlines via ESPN public feed
          </p>
        </div>
      </section>
    </Shell>
  );
}
