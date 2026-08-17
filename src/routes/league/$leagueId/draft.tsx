import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PlayerCell } from "@/components/player-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueBundle } from "@/lib/data/fns";
import { autoFillDraft, getDraft, makePick, startDraft } from "@/lib/league/fns";
import { cn, formatPts } from "@/lib/utils";

const POS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"] as const;

export const Route = createFileRoute("/league/$leagueId/draft")({
  component: DraftPage,
});

function DraftPage() {
  const { leagueId } = Route.useParams();
  const qc = useQueryClient();
  const [pos, setPos] = useState<(typeof POS)[number]>("ALL");
  const [q, setQ] = useState("");
  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const draft = useQuery({
    queryKey: ["draft", leagueId, pos, q],
    queryFn: () => getDraft({ data: { leagueId, position: pos, query: q } }),
    refetchInterval: (query) => (query.state.data?.status === "live" ? 4000 : false),
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["draft", leagueId] });
    void qc.invalidateQueries({ queryKey: ["league", leagueId] });
  }

  const start = useMutation({
    mutationFn: () => startDraft({ data: { leagueId } }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof Error ? e.message : "Could not start"),
  });
  const fill = useMutation({
    mutationFn: () => autoFillDraft({ data: { leagueId } }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof Error ? e.message : "Could not fill"),
  });
  const pick = useMutation({
    mutationFn: (playerId: string) => makePick({ data: { leagueId, playerId } }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof Error ? e.message : "Pick failed"),
  });

  if (!league.data?.hosted) {
    return (
      <p className="text-sm text-muted">
        This is a Sleeper peek — the draft already happened over there.
      </p>
    );
  }

  const d = draft.data;

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          {d ? `${d.status} · pick ${Math.min(d.pickNo, d.total || 1)} / ${d.total || "—"}` : "Draft"}
        </p>
        <h2 className="mt-1 font-display text-3xl tracking-tight">
          {d?.status === "complete"
            ? "Board is closed"
            : d?.onClockName
              ? `${d.onClockName} is on the clock`
              : "Waiting to open"}
        </h2>
        {d?.isMyPick ? (
          <p className="mt-2 text-sm text-live">Your pick. Take someone.</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {d?.status === "pending" && d.isCommish ? (
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              {start.isPending ? "Opening…" : "Open the draft"}
            </Button>
          ) : null}
          {d?.status === "live" && d.isCommish ? (
            <Button variant="outline" onClick={() => fill.mutate()} disabled={fill.isPending}>
              {fill.isPending ? "Filling…" : "Autodraft the rest"}
            </Button>
          ) : null}
          {d?.status === "complete" ? (
            <Button asChild variant="outline">
              <Link to="/league/$leagueId" params={{ leagueId }}>
                Standings
              </Link>
            </Button>
          ) : null}
        </div>

        <ol className="mt-6 space-y-2">
          {draft.isLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)
            : d?.recent.map((p) => (
                <li
                  key={p.pick}
                  className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2 shadow-[var(--shadow-border)]"
                >
                  <span className="w-10 font-mono text-[11px] text-faint">
                    {p.round}.{p.pick}
                  </span>
                  <div className="min-w-0 flex-1">
                    <PlayerCell player={p.player} compact />
                  </div>
                  <span className="truncate text-xs text-muted">{p.teamName}</span>
                </li>
              ))}
          {d && d.recent.length === 0 ? (
            <p className="text-sm text-muted">No picks yet. Unused picks can be traded before you open the board.</p>
          ) : null}
        </ol>

        {d && d.stock.some((p) => !p.used) ? (
          <div className="mt-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Pick stock</p>
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
              {d.stock
                .filter((p) => !p.used)
                .slice(0, 40)
                .map((p) => (
                  <li
                    key={p.pickNo}
                    className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm"
                  >
                    <span className="font-mono text-xs text-faint">{p.label}</span>
                    <span className="min-w-0 truncate text-muted">
                      {p.ownerName}
                      {p.via ? <span className="text-faint"> · via {p.via}</span> : null}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the pool"
            className="sm:max-w-xs"
          />
          <div className="flex flex-wrap gap-1">
            {POS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPos(p)}
                className={cn(
                  "h-9 rounded-sm px-3 font-mono text-xs",
                  pos === p ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-4 divide-y divide-line rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {draft.isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <li key={i} className="p-3">
                  <Skeleton className="h-8" />
                </li>
              ))
            : d?.available.map((p) => (
                <li key={p.player_id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <PlayerCell player={p} compact />
                  </div>
                  <span className="font-mono text-xs tabular-nums text-muted">
                    {formatPts(p.pts, 1)}
                  </span>
                  {d.status === "live" && (d.isMyPick || d.isCommish) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pick.isPending}
                      onClick={() => pick.mutate(p.player_id)}
                    >
                      Draft
                    </Button>
                  ) : (
                    <Badge tone="muted">Pool</Badge>
                  )}
                </li>
              ))}
        </ul>
      </section>
    </div>
  );
}
