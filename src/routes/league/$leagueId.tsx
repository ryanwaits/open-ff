import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Settings } from "lucide-react";
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

/**
 * Four destinations, grouped by how often you need them rather than by which
 * table they read from. Anything configuration-shaped lives behind the gear:
 * a draft happens once, so a permanent tab is dead weight for 51 weeks and far
 * too quiet on the night it matters.
 */
const TABS = [
  { to: "/league/$leagueId" as const, label: "My Team", end: true, when: "always", owns: [] as string[] },
  {
    to: "/league/$leagueId/matchups" as const,
    label: "Matchup",
    end: false,
    when: "always",
    owns: ["/matchup/"],
  },
  {
    to: "/league/$leagueId/standings" as const,
    label: "League",
    end: false,
    when: "always",
    owns: ["/trades", "/activity", "/team/", "/recap"],
  },
  { to: "/league/$leagueId/wire" as const, label: "Players", end: false, when: "hosted", owns: [] as string[] },
];

/** Sections inside League. Standings is the default. */
const LEAGUE_SECTIONS = [
  { to: "/league/$leagueId/standings" as const, label: "Standings", when: "always" },
  { to: "/league/$leagueId/trades" as const, label: "Trades", when: "hosted" },
  { to: "/league/$leagueId/recap" as const, label: "Desk", when: "always" },
  { to: "/league/$leagueId/activity" as const, label: "Moves", when: "commish" },
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

  const inLeagueSection = LEAGUE_SECTIONS.some((sec) =>
    pathname.startsWith(sec.to.replace("$leagueId", leagueId)),
  );

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
            <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">
              {q.data.league.name}
            </h1>

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

      <nav className="-mx-4 mb-4 flex items-center gap-1 overflow-x-auto px-4">
        {TABS.filter((tab) => show(tab.when)).map((tab) => {
          const href = tab.to.replace("$leagueId", leagueId);
          const on = tab.end
            ? pathname === href
            : pathname.startsWith(href) ||
              tab.owns.some((seg) => pathname.startsWith(`/league/${leagueId}${seg}`));
          return (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ leagueId }}
              className={cn(
                "shrink-0 rounded-pill px-4 py-2 text-sm font-semibold transition-colors duration-150",
                on ? "bg-fg text-bg" : "text-muted hover:bg-raised hover:text-fg",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
        {/* Everyone sees the same shell. Permissions change what is editable
            inside setup, not whether the door exists. */}
        <Link
          to="/league/$leagueId/settings"
          params={{ leagueId }}
          aria-label="League setup"
          title="League setup"
          className={cn(
            "ml-auto grid size-9 shrink-0 place-items-center rounded-pill transition-colors duration-150",
            pathname.startsWith(`/league/${leagueId}/settings`) ||
              pathname.startsWith(`/league/${leagueId}/draft`)
              ? "bg-fg text-bg"
              : "text-faint hover:bg-raised hover:text-fg",
          )}
        >
          <Settings className="size-4" strokeWidth={2} />
        </Link>
      </nav>

      {inLeagueSection ? (
        <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4">
          {LEAGUE_SECTIONS.filter((sec) => show(sec.when)).map((sec) => {
            const href = sec.to.replace("$leagueId", leagueId);
            const on = pathname.startsWith(href);
            return (
              <Link
                key={sec.to}
                to={sec.to}
                params={{ leagueId }}
                className={cn(
                  "shrink-0 rounded-pill px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
                  on ? "bg-raised text-fg" : "text-faint hover:text-fg",
                )}
              >
                {sec.label}
              </Link>
            );
          })}
        </nav>
      ) : (
        <div className="mb-6" />
      )}

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
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl bg-surface px-4 py-4 shadow-[var(--shadow-border)]">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">This league has open seats. Claim one.</p>
        <select
          className="mt-2 h-11 w-full max-w-xs rounded-pill border border-line bg-raised px-4 text-sm text-fg"
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
