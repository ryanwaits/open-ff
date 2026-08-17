import { Link, useRouterState } from "@tanstack/react-router";
import { Radio, Trophy, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLeagueStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const recent = useLeagueStore((s) => s.recent);
  const league = recent[0];
  const { isPending } = useCurrentUserState();
  const inLeague = pathname.startsWith("/league/");
  const inScores = pathname.startsWith("/scores");

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-15 max-w-6xl items-center gap-3 px-4">
          <Link
            to={league ? "/league/$leagueId" : "/"}
            params={league ? { leagueId: league.leagueId } : undefined}
            className="shrink-0"
          >
            <span className="font-display text-[26px] font-extrabold leading-none tracking-[-0.03em]">
              Ledger
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {league ? (
              <Link
                to="/league/$leagueId"
                params={{ leagueId: league.leagueId }}
                className={cn(
                  "rounded-pill px-3.5 py-2 text-sm font-medium transition-colors duration-150",
                  inLeague ? "bg-raised text-fg" : "text-muted hover:bg-raised hover:text-fg",
                )}
              >
                {league.name}
              </Link>
            ) : null}
            <Link
              to="/scores"
              className={cn(
                "rounded-pill px-3.5 py-2 text-sm font-medium transition-colors duration-150",
                inScores ? "bg-raised text-fg" : "text-muted hover:bg-raised hover:text-fg",
              )}
            >
              Scores
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {isPending ? (
              <div className="size-8 animate-pulse rounded-pill bg-raised" />
            ) : (
              <>
                <SignedIn>
                  <UserButton />
                </SignedIn>
                <SignedOut>
                  <Link
                    to="/login"
                    className="inline-flex h-9 items-center rounded-pill px-3.5 text-sm font-medium text-muted hover:text-fg"
                  >
                    Sign in
                  </Link>
                </SignedOut>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:pb-12">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur-md md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-3 px-2 pb-[env(safe-area-inset-bottom)]">
          {league ? (
            <Link
              to="/league/$leagueId"
              params={{ leagueId: league.leagueId }}
              className={cn(
                "mx-1 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[11px] font-medium transition-colors duration-150",
                inLeague ? "bg-raised text-fg" : "text-faint",
              )}
            >
              <Trophy className="size-4" strokeWidth={1.75} />
              League
            </Link>
          ) : (
            <Link
              to="/"
              className={cn(
                "mx-1 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[11px] font-medium transition-colors duration-150",
                pathname === "/" ? "bg-raised text-fg" : "text-faint",
              )}
            >
              <Trophy className="size-4" strokeWidth={1.75} />
              Home
            </Link>
          )}
          <Link
            to="/scores"
            className={cn(
              "mx-1 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[11px] font-medium transition-colors duration-150",
              inScores ? "bg-raised text-fg" : "text-faint",
            )}
          >
            <Radio className="size-4" strokeWidth={1.75} />
            Scores
          </Link>
          <SignedIn>
            <Link
              to="/join"
              className={cn(
                "mx-1 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[11px] font-medium transition-colors duration-150",
                pathname === "/join" ? "bg-raised text-fg" : "text-faint",
              )}
            >
              <UserRound className="size-4" strokeWidth={1.75} />
              Join
            </Link>
          </SignedIn>
          <SignedOut>
            <Link
              to="/login"
              className="mx-1 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[11px] font-medium text-faint"
            >
              <UserRound className="size-4" strokeWidth={1.75} />
              Sign in
            </Link>
          </SignedOut>
        </div>
      </nav>
    </div>
  );
}
