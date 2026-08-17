import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Shell } from "@/components/shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueBundle } from "@/lib/data/fns";
import { useLeagueStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/league/$leagueId")({
  component: LeagueLayout,
});

const TABS = [
  { to: "/league/$leagueId" as const, label: "Standings", end: true, when: "always" },
  { to: "/league/$leagueId/matchups" as const, label: "Matchups", end: false, when: "always" },
  { to: "/league/$leagueId/draft" as const, label: "Draft", end: false, when: "hosted" },
  { to: "/league/$leagueId/wire" as const, label: "Wire", end: false, when: "always" },
  { to: "/league/$leagueId/trades" as const, label: "Trades", end: false, when: "hosted" },
  { to: "/league/$leagueId/activity" as const, label: "Moves", end: false, when: "always" },
  { to: "/league/$leagueId/recap" as const, label: "Recap", end: false, when: "always" },
  { to: "/league/$leagueId/settings" as const, label: "Settings", end: false, when: "hosted" },
];

function LeagueLayout() {
  const { leagueId } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const remember = useLeagueStore((s) => s.remember);
  const q = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
    refetchInterval: (query) => (query.state.data?.scoringLive ? 15_000 : false),
  });

  useEffect(() => {
    if (q.data) {
      remember({
        leagueId: q.data.league.league_id,
        name: q.data.league.name,
        season: q.data.league.season,
      });
    }
  }, [q.data, remember]);

  return (
    <Shell>
      {q.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-80" />
        </div>
      ) : q.error ? (
        <p className="text-sm text-loss">
          Couldn't load that league. Check the ID or try the demo from the desk.
        </p>
      ) : q.data ? (
        <header className="mb-6">
          <h1 className="font-display text-4xl tracking-tight">{q.data.league.name}</h1>
          {q.data.hosted && q.data.inviteCode ? (
            <p className="mt-2 font-mono text-xs text-faint">
              Invite {q.data.inviteCode}
              {q.data.locked ? " · locked demo" : ""}
              {q.data.myRosterId ? " · your seat" : ""}
            </p>
          ) : null}
        </header>
      ) : null}

      <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4">
        {TABS.filter((tab) => tab.when === "always" || q.data?.hosted).map((tab) => {
          const href = tab.to.replace("$leagueId", leagueId);
          const on = tab.end
            ? pathname === href
            : tab.to.endsWith("/matchups")
              ? pathname.startsWith(href) ||
                pathname.startsWith(`/league/${leagueId}/matchup/`)
              : pathname.startsWith(href);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ leagueId }}
              className={cn(
                "shrink-0 rounded-sm px-3 py-2 text-sm",
                on ? "bg-raised text-fg" : "text-muted hover:text-fg",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </Shell>
  );
}
