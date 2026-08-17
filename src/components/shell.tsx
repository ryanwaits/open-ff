import { Link, useRouterState } from "@tanstack/react-router";
import { Radio, Trophy, UserRound } from "lucide-react";
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
      <header className="sticky top-0 z-30 border-b border-line/80 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link
            to={league ? "/league/$leagueId" : "/"}
            params={league ? { leagueId: league.leagueId } : undefined}
            className="flex items-baseline gap-2 shrink-0"
          >
            <span className="font-display text-2xl leading-none tracking-tight">Ledger</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {league ? (
              <Link
                to="/league/$leagueId"
                params={{ leagueId: league.leagueId }}
                className={cn(
                  "rounded-sm px-3 py-2 text-sm transition-colors duration-150",
                  inLeague ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                {league.name}
              </Link>
            ) : null}
            <Link
              to="/scores"
              className={cn(
                "rounded-sm px-3 py-2 text-sm transition-colors duration-150",
                inScores ? "text-fg" : "text-muted hover:text-fg",
              )}
            >
              Scores
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {isPending ? (
              <div className="size-8 animate-pulse rounded-full bg-raised" />
            ) : (
              <>
                <SignedIn>
                  <UserButton />
                </SignedIn>
                <SignedOut>
                  <Link
                    to="/login"
                    className="inline-flex h-9 items-center rounded-sm px-3 text-sm text-muted hover:text-fg"
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
                "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]",
                inLeague ? "text-fg" : "text-faint",
              )}
            >
              <Trophy className="size-4" strokeWidth={1.75} />
              League
            </Link>
          ) : (
            <Link
              to="/"
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]",
                pathname === "/" ? "text-fg" : "text-faint",
              )}
            >
              <Trophy className="size-4" strokeWidth={1.75} />
              Home
            </Link>
          )}
          <Link
            to="/scores"
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]",
              inScores ? "text-fg" : "text-faint",
            )}
          >
            <Radio className="size-4" strokeWidth={1.75} />
            Scores
          </Link>
          <SignedIn>
            <Link
              to="/join"
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]",
                pathname === "/join" ? "text-fg" : "text-faint",
              )}
            >
              <UserRound className="size-4" strokeWidth={1.75} />
              Join
            </Link>
          </SignedIn>
          <SignedOut>
            <Link
              to="/login"
              className="flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] text-faint"
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
