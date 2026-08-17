import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PlayerCell } from "@/components/player-cell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueBundle, getTeam, getWire } from "@/lib/data/fns";
import { addDrop, cancelClaim, getClaims } from "@/lib/league/fns";
import { cn, formatPts } from "@/lib/utils";

const POS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"] as const;

export const Route = createFileRoute("/league/$leagueId/wire")({
  component: WirePage,
});

function WirePage() {
  const { leagueId } = Route.useParams();
  const qc = useQueryClient();
  const [pos, setPos] = useState<(typeof POS)[number]>("ALL");
  const [q, setQ] = useState("");
  const [dropId, setDropId] = useState<string>("");
  const [bid, setBid] = useState(1);
  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const week = league.data?.currentWeek ?? 1;
  const mineId = league.data?.myRosterId;
  const team = useQuery({
    queryKey: ["team", leagueId, mineId, week],
    queryFn: () =>
      getTeam({ data: { leagueId, rosterId: mineId!, week } }),
    enabled: Boolean(league.data?.hosted && mineId && !league.data.locked),
  });
  const wire = useQuery({
    queryKey: ["wire", leagueId, pos, q],
    queryFn: () => getWire({ data: { leagueId, position: pos, query: q } }),
  });

  const claims = useQuery({
    queryKey: ["claims", leagueId],
    queryFn: () => getClaims({ data: { leagueId } }),
    enabled: Boolean(league.data?.hosted),
  });

  const drafted = league.data?.draftStatus === "complete";
  const canClaim =
    Boolean(league.data?.hosted && mineId && !league.data.locked) && drafted;

  const claim = useMutation({
    mutationFn: (addId: string) =>
      addDrop({
        data: { leagueId, addId, dropId: dropId || null, bid },
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["wire", leagueId] });
      void qc.invalidateQueries({ queryKey: ["team", leagueId] });
      void qc.invalidateQueries({ queryKey: ["league", leagueId] });
      void qc.invalidateQueries({ queryKey: ["claims", leagueId] });
      toast(
        res.mode === "claim"
          ? league.data?.ops?.waiverType === "faab"
            ? `Bid $${bid} in the wire.`
            : "Claim queued."
          : "Added.",
      );
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not claim"),
  });

  const wireCopy = !league.data?.hosted
    ? `Everyone not on a roster, ranked by ${league.data?.league.season ?? ""} PPR. Read-only peek.`
    : !drafted
      ? "The wire opens after the draft. Right now you can browse the pool; adds, drops, and FAAB start once the board is final."
      : league.data.ops?.waiverType === "none"
        ? "Free agency only. Instant add/drop. No claims queue."
        : league.data.ops?.waiversOpen
          ? league.data.ops.waiverType === "rolling"
            ? `Waivers are open. Claims process Wednesday in waiver order (you are #${
                league.data.standings.find((s) => s.rosterId === mineId)?.waiverPos ?? "—"
              }). After they run, leftovers are free agents.`
            : `Waivers are open. Bid FAAB — you have $${league.data.faabRemaining ?? 100} left. Claims process Wednesday (highest bid wins; ties go to waiver order). After that, leftover players are free agents.`
          : `Free agency. Instant add/drop. ${
              league.data.ops?.waiverType === "faab"
                ? `You have $${league.data.faabRemaining ?? 100} FAAB left for next week's wire.`
                : "Next week's wire uses rolling priority."
            }`;

  return (
    <div>
      <p className="max-w-xl text-sm text-muted">{wireCopy}</p>
      {canClaim ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block max-w-xs">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Drop if full
            </span>
            <select
              className="mt-1.5 h-11 w-full rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]"
              value={dropId}
              onChange={(e) => setDropId(e.target.value)}
            >
              <option value="">No drop</option>
              {team.data?.players.map((p) => (
                <option key={p.player_id} value={p.player_id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>
          {league.data?.ops?.waiversOpen && league.data.ops.waiverType === "faab" ? (
            <label>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Bid $</span>
              <Input
                className="mt-1.5 w-24"
                type="number"
                min={0}
                max={league.data.faabRemaining ?? 100}
                value={bid}
                onChange={(e) => setBid(Number(e.target.value))}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {claims.data?.items.length ? (
        <ul className="mt-5 space-y-2">
          {claims.data.items.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm shadow-[var(--shadow-border)]"
            >
              <span>
                {c.mine ? "Your" : "A"} claim · +{c.add.name}
                {c.drop ? ` / −${c.drop.name}` : ""}
                {c.bid > 0 ? ` · $${c.bid}` : ""} · {c.status}
              </span>
              {c.mine && c.status === "pending" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    cancelClaim({ data: { leagueId, claimId: c.id } }).then(() => {
                      void qc.invalidateQueries({ queryKey: ["claims", leagueId] });
                    })
                  }
                >
                  Pull
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search available players"
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

      <ul className="mt-6 divide-y divide-line rounded-xl bg-surface shadow-[var(--shadow-border)]">
        {wire.isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="p-3">
                <Skeleton className="h-8" />
              </li>
            ))
          : wire.data?.map((p) => (
              <li key={p.player_id} className="flex items-center gap-3 px-3 py-2.5">
                <Link
                  to="/league/$leagueId/player/$playerId"
                  params={{ leagueId, playerId: p.player_id }}
                  className="min-w-0 flex-1 rounded-md"
                >
                  <PlayerCell player={p} compact />
                </Link>
                <span className="font-mono text-sm tabular-nums">
                  {formatPts(p.pts, 1)}
                </span>
                {canClaim ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={claim.isPending}
                    onClick={() => claim.mutate(p.player_id)}
                  >
                    {league.data?.ops?.waiversOpen
                      ? league.data.ops.waiverType === "faab"
                        ? "Bid"
                        : "Claim"
                      : "Add"}
                  </Button>
                ) : null}
              </li>
            ))}
      </ul>
      {wire.data && wire.data.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No available players match.</p>
      ) : null}
    </div>
  );
}
