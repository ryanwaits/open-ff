import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listMyLeagues } from "@/lib/league/fns";
import { useLeagueStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const remember = useLeagueStore((s) => s.remember);
  const { user, isPending } = useCurrentUserState();
  const mine = useQuery({
    queryKey: ["my-leagues"],
    queryFn: () => listMyLeagues(),
  });

  const seats = mine.data ?? [];

  return (
    <Shell center>
      <section className="w-full max-w-xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          Hosted here &middot; no other app
        </p>
        <h1 className="mt-3 font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl">
          Your league, <span className="hl">your desk</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted">
          Sign in, claim a seat, play the week. Commissioners set the book.
        </p>
      </section>

      {seats.length > 0 ? (
        <section className="mt-8 w-full max-w-lg text-center">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Your leagues
          </h2>
          <ul className="mt-3 max-w-lg space-y-2">
            {seats.map((l) => (
              <li key={l.leagueId}>
                <Link
                  to="/league/$leagueId"
                  params={{ leagueId: l.leagueId }}
                  preload="intent"
                  onClick={() =>
                    remember({ leagueId: l.leagueId, name: l.name, season: l.season })
                  }
                  className="group flex w-full items-center justify-between gap-3 rounded-xl bg-surface px-4 py-4 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
                >
                  <span>
                    <span className="block text-sm font-semibold">{l.name}</span>
                    <span className="font-mono text-[11px] text-faint">
                      {l.season} · {l.role}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-faint transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-accent-strong" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-center gap-3 text-sm">
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
      ) : isPending || mine.data == null ? (
        <div className="mt-8 h-24 w-full max-w-sm animate-pulse rounded-xl bg-surface" />
      ) : !user ? (
        <div className="mt-8 flex w-full max-w-sm flex-col gap-2">
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
      ) : (
        <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
          <Button asChild>
            <Link to="/import">Import a league</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/join">Claim a seat</Link>
          </Button>
          <Link to="/new" className="text-sm text-faint hover:text-muted">
            Start empty
          </Link>
        </div>
      )}
    </Shell>
  );
}
