import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueBundle } from "@/lib/data/fns";
import { joinLeague } from "@/lib/league/fns";
import { useLeagueStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/league/$leagueId")({
  component: LeagueLayout,
});

const TABS = [
  { to: "/league/$leagueId" as const, label: "Standings", end: true, when: "always" },
  { to: "/league/$leagueId/matchups" as const, label: "Matchups", end: false, when: "always" },
  { to: "/league/$leagueId/draft" as const, label: "Draft", end: false, when: "hosted" },
  { to: "/league/$leagueId/wire" as const, label: "Adds", end: false, when: "hosted" },
  { to: "/league/$leagueId/trades" as const, label: "Trades", end: false, when: "hosted" },
  { to: "/league/$leagueId/recap" as const, label: "Desk", end: false, when: "always" },
  { to: "/league/$leagueId/activity" as const, label: "Moves", end: false, when: "commish" },
  { to: "/league/$leagueId/settings" as const, label: "Settings", end: false, when: "commish" },
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

  const show = (when: string) => {
    if (when === "always") return true;
    if (when === "hosted") return Boolean(q.data?.hosted);
    if (when === "commish") return Boolean(q.data?.isCommish);
    return false;
  };

  return (
    <Shell>
      {q.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-80" />
        </div>
      ) : q.error ? (
        <p className="text-sm text-loss">Couldn't load that league.</p>
      ) : q.data ? (
        <header className="mb-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="font-display text-4xl tracking-tight">{q.data.league.name}</h1>
            {q.data.myRosterId ? (
              <Link
                to="/league/$leagueId/team/$rosterId"
                params={{ leagueId, rosterId: String(q.data.myRosterId) }}
                className="text-sm text-muted hover:text-fg"
              >
                My team
              </Link>
            ) : null}
          </div>
          {q.data.isCommish && q.data.inviteCode ? (
            <p className="mt-2 font-mono text-xs text-faint">
              Invite {q.data.inviteCode}
              {q.data.locked ? " · locked demo" : ""}
            </p>
          ) : null}
        </header>
      ) : null}

      {q.data?.hosted && !q.data.myRosterId && !q.data.locked ? (
        <ClaimBanner leagueId={leagueId} inviteCode={q.data.inviteCode} />
      ) : null}

      <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4">
        {TABS.filter((tab) => show(tab.when)).map((tab) => {
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

function ClaimBanner({ leagueId, inviteCode }: { leagueId: string; inviteCode: string | null }) {
  const qc = useQueryClient();
  const [rosterId, setRosterId] = useState<number | "">("");
  const preview = useQuery({
    queryKey: ["invite", inviteCode],
    queryFn: async () => {
      const { previewInvite } = await import("@/lib/league/fns");
      return previewInvite({ data: { code: inviteCode! } });
    },
    enabled: Boolean(inviteCode),
  });
  const claim = useMutation({
    mutationFn: () =>
      joinLeague({
        data: {
          code: inviteCode!,
          teamName: "",
          rosterId: rosterId === "" ? null : rosterId,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["league", leagueId] });
      toast("Seat claimed.");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not claim"),
  });

  const seats = preview.data?.seats ?? [];
  if (!inviteCode || preview.isLoading) return null;
  if (!seats.length) return null;

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-border)]">
      <div className="min-w-0 flex-1">
        <p className="text-sm">This league has open seats. Claim one.</p>
        <select
          className="mt-2 h-11 w-full max-w-xs rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]"
          value={rosterId}
          onChange={(e) => setRosterId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Next open seat</option>
          {seats.map((s) => (
            <option key={s.rosterId} value={s.rosterId}>
              {s.teamName}
            </option>
          ))}
        </select>
      </div>
      <Button disabled={claim.isPending} onClick={() => claim.mutate()}>
        {claim.isPending ? "Claiming…" : "Claim"}
      </Button>
    </div>
  );
}
