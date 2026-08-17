import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { BarChart3, House, Search, Settings, Shield, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { WeekPicker } from "@/components/week-picker";
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
  { to: "/league/$leagueId" as const, label: "Home", end: true, when: "always", owns: [] as string[], Icon: House },
  {
    to: "/league/$leagueId/roster" as const,
    label: "My Team",
    end: false,
    when: "always",
    owns: [] as string[],
    Icon: Shield,
  },
  {
    to: "/league/$leagueId/matchups" as const,
    label: "Matchups",
    end: false,
    when: "always",
    owns: ["/matchup/"],
    Icon: Swords,
  },
  {
    to: "/league/$leagueId/standings" as const,
    label: "League",
    end: false,
    when: "always",
    owns: ["/trades", "/activity", "/team/", "/recap"],
    Icon: BarChart3,
  },
  { to: "/league/$leagueId/wire" as const, label: "Players", end: false, when: "hosted", owns: [] as string[], Icon: Search },
];

function LeagueLayout() {
  const { leagueId } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as { week?: number } });
  const navigate = useNavigate();
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

  const tabs = TABS.filter((tab) => show(tab.when)).map((tab) => {
    const href = tab.to.replace("$leagueId", leagueId);
    return {
      key: tab.to,
      label: tab.label,
      to: tab.to,
      params: { leagueId },
      Icon: tab.Icon,
      active: tab.end
        ? pathname === href
        : pathname.startsWith(href) ||
          tab.owns.some((seg) => pathname.startsWith(`/league/${leagueId}${seg}`)),
    };
  });

  /**
   * The week belongs to the league header, not to each page. Three routes used
   * to draw their own seventeen-button strip; now they share one control that
   * writes the same search param.
   */
  const WEEKLY = ["/matchups", "/activity", "/recap"];
  const usesWeek = WEEKLY.some((seg) => pathname.startsWith(`/league/${leagueId}${seg}`));
  const playoffStart =
    q.data?.ops?.playoffStartWeek ?? q.data?.league.settings.playoff_week_start ?? 15;
  const maxWeek = Math.max(playoffStart + 2, q.data?.ops?.regularWeeks ?? 14, q.data?.currentWeek ?? 1);
  const shownWeek = search.week ?? q.data?.currentWeek ?? 1;

  const setupHref = `/league/${leagueId}/settings`;
  const gear = (
    <Link
      to="/league/$leagueId/settings"
      params={{ leagueId }}
      aria-label="League setup"
      title="League setup"
      className={cn(
        "ml-1 grid size-9 shrink-0 place-items-center rounded-pill transition-colors duration-150",
        pathname.startsWith(setupHref) || pathname.startsWith(`/league/${leagueId}/draft`)
          ? "bg-fg text-bg"
          : "text-faint hover:bg-raised hover:text-fg",
      )}
    >
      <Settings className="size-4" strokeWidth={2} />
    </Link>
  );

  return (
    <Shell tabs={tabs} trailing={gear}>
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
            {usesWeek ? (
              <WeekPicker
                week={shownWeek}
                maxWeek={maxWeek}
                playoffStart={playoffStart}
                currentWeek={q.data.currentWeek}
                onPick={(w) =>
                  void navigate({ to: pathname, search: (prev) => ({ ...prev, week: w }) })
                }
              />
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
