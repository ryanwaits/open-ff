import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { listMyLeagues } from "@/lib/league/fns";
import { useLeagueStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const remember = useLeagueStore((s) => s.remember);
  const mine = useQuery({
    queryKey: ["my-leagues"],
    queryFn: () => listMyLeagues(),
  });

  function openLeague(league: { leagueId: string; name: string; season: string }) {
    remember(league);
    void navigate({ to: "/league/$leagueId", params: { leagueId: league.leagueId } });
  }

  const seats = mine.data ?? [];

  return (
    <Shell>
      <section className="max-w-xl">
        <h1 className="font-display text-5xl leading-[0.95] tracking-tight sm:text-6xl">
          Your league.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Sign in, claim a seat, play the week. Commissioners set the book.
        </p>
      </section>

      <SignedOut>
        <div className="mt-8 flex flex-col gap-2 sm:max-w-sm">
          <Button asChild>
            <Link to="/join">I have an invite</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">Sign in</Link>
          </Button>
          <Link to="/new" className="mt-2 text-sm text-faint hover:text-muted">
            Start a league
          </Link>
        </div>
      </SignedOut>

      <SignedIn>
        {mine.isLoading ? (
          <div className="mt-8 h-24 animate-pulse rounded-xl bg-surface" />
        ) : seats.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Your leagues
            </h2>
            <ul className="mt-3 max-w-lg space-y-2">
              {seats.map((l) => (
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
                        {l.season} · {l.role}
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-faint" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-3 text-sm">
              <Link to="/join" className="text-muted hover:text-fg">
                Join another
              </Link>
              {seats.some((s) => s.role === "commish") ? (
                <Link to="/new" className="text-muted hover:text-fg">
                  New league
                </Link>
              ) : (
                <Link to="/new" className="text-faint hover:text-muted">
                  Start a league
                </Link>
              )}
            </div>
          </section>
        ) : (
          <div className="mt-8 flex flex-col gap-2 sm:max-w-sm">
            <Button asChild>
              <Link to="/join">Claim a seat</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/new">Start a league</Link>
            </Button>
          </div>
        )}
      </SignedIn>
    </Shell>
  );
}
