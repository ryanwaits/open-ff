import { Link, useRouterState } from "@tanstack/react-router";
import { Newspaper, Radio, Shield, Trophy, UserRound } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLeagueStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Desk", icon: Newspaper, match: (p: string) => p === "/" },
  {
    to: "/scores",
    label: "Scores",
    icon: Radio,
    match: (p: string) => p.startsWith("/scores"),
  },
  {
    to: "/players",
    label: "Players",
    icon: Shield,
    match: (p: string) => p.startsWith("/players"),
  },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const recent = useLeagueStore((s) => s.recent);
  const league = recent[0];
  const { isPending } = useCurrentUserState();

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex items-baseline gap-2 shrink-0">
            <span className="font-display text-2xl leading-none tracking-tight">Ledger</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-faint sm:inline">
              Sunday edition
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-sm px-3 py-2 text-sm transition-colors duration-150",
                  item.match(pathname) ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            ))}
            {league ? (
              <Link
                to="/league/$leagueId"
                params={{ leagueId: league.leagueId }}
                className={cn(
                  "rounded-sm px-3 py-2 text-sm transition-colors duration-150",
                  pathname.startsWith("/league/") ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                League
              </Link>
            ) : null}
            <Link
              to="/data"
              className={cn(
                "rounded-sm px-3 py-2 text-sm transition-colors duration-150",
                pathname === "/data" ? "text-fg" : "text-muted hover:text-fg",
              )}
            >
              Data
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
        <div className="mx-auto grid max-w-lg grid-cols-4 px-2 pb-[env(safe-area-inset-bottom)]">
          {NAV.map((item) => {
            const Icon = item.icon;
            const on = item.match(pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]",
                  on ? "text-fg" : "text-faint",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
          {league ? (
            <Link
              to="/league/$leagueId"
              params={{ leagueId: league.leagueId }}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]",
                pathname.startsWith("/league/") ? "text-fg" : "text-faint",
              )}
            >
              <Trophy className="size-4" strokeWidth={1.75} />
              League
            </Link>
          ) : (
            <Link
              to="/login"
              className="flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] text-faint"
            >
              <UserRound className="size-4" strokeWidth={1.75} />
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
