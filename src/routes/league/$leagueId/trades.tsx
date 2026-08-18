import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TradeOfferCard } from "@/components/trade-offer-card";
import { Button } from "@/components/ui/button";
import { getLeagueBundle, getProjections, getTeam } from "@/lib/data/fns";
import type { Projection, RosterPlayer, SlimPlayer } from "@/lib/data/types";
import {
  cancelTradeFn,
  getTradablePicks,
  getTrades,
  proposeTrade,
  voteTrade,
} from "@/lib/league/fns";
import { tradeDelta, type TradeDelta } from "@/lib/league/lineup-value";
import { cn } from "@/lib/utils";

type TradesSearch = { counter?: string };

export const Route = createFileRoute("/league/$leagueId/trades")({
  validateSearch: (s: Record<string, unknown>): TradesSearch => {
    const out: TradesSearch = {};
    if (typeof s.counter === "string") out.counter = s.counter;
    return out;
  },
  component: TradesPage,
});

type PendingSide = {
  rosterId: number;
  sendTo: number;
  players: string[];
  picks: number[];
};

function TradesPage() {
  const { leagueId } = Route.useParams();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const trades = useQuery({
    queryKey: ["trades", leagueId],
    queryFn: () => getTrades({ data: { leagueId } }),
  });
  const picks = useQuery({
    queryKey: ["picks", leagueId],
    queryFn: () => getTradablePicks({ data: { leagueId } }),
    enabled: Boolean(league.data?.hosted),
  });
  const mineId = league.data?.myRosterId;
  const week = league.data?.currentWeek ?? 1;
  const season = league.data?.league.season ?? "";
  const rosterPositions = league.data?.league.roster_positions ?? [];
  const standings = league.data?.standings ?? [];
  const partners = standings.filter((s) => s.rosterId !== mineId);
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [thirdId, setThirdId] = useState<number | null>(null);
  const them = partnerId ?? partners[0]?.rosterId ?? null;

  // One getTeam per involved roster, shared across every pending card.
  const bookRosterIds = useMemo(() => {
    const ids = new Set<number>();
    if (mineId != null) ids.add(mineId);
    for (const t of trades.data ?? []) {
      if (t.status !== "proposed") continue;
      if (mineId == null || !t.sides.some((s) => s.rosterId === mineId)) continue;
      for (const s of t.sides) ids.add(s.rosterId);
    }
    return [...ids].sort((a, b) => a - b);
  }, [trades.data, mineId]);

  const bookRosterQueries = useQueries({
    queries: bookRosterIds.map((rosterId) => ({
      queryKey: ["team", leagueId, rosterId, week] as const,
      queryFn: () => getTeam({ data: { leagueId, rosterId, week } }),
      enabled: Boolean(league.data && rosterId != null),
    })),
  });

  const rosterById = useMemo(() => {
    const map = new Map<number, RosterPlayer[]>();
    bookRosterIds.forEach((id, i) => {
      const players = bookRosterQueries[i]?.data?.players;
      if (players) map.set(id, players);
    });
    return map;
  }, [bookRosterIds, bookRosterQueries]);

  const playerById = useMemo(() => {
    const map = new Map<string, SlimPlayer>();
    for (const players of rosterById.values()) {
      for (const p of players) map.set(p.player_id, p);
    }
    return map;
  }, [rosterById]);

  const projectionInputs = useMemo(() => {
    const byId = new Map<
      string,
      {
        player_id: string;
        team: string | null;
        injury_status: string | null | undefined;
        status: string | null | undefined;
      }
    >();
    for (const players of rosterById.values()) {
      for (const p of players) {
        byId.set(p.player_id, {
          player_id: p.player_id,
          team: p.team,
          injury_status: p.injury_status,
          status: p.status,
        });
      }
    }
    return [...byId.values()];
  }, [rosterById]);

  const projectionsQ = useQuery({
    queryKey: ["projections", leagueId, week, projectionInputs.length],
    queryFn: () =>
      getProjections({
        data: {
          leagueId,
          season,
          week,
          players: projectionInputs,
        },
      }),
    enabled: Boolean(season) && projectionInputs.length > 0,
    staleTime: 60_000,
  });
  const projections = (projectionsQ.data ?? {}) as Record<string, Projection>;

  const bookRostersReady =
    bookRosterIds.length === 0 ||
    bookRosterIds.every((_, i) => bookRosterQueries[i]?.data != null);
  // Empty map while loading is a false 0.0 — wait for the book when we asked for one.
  const projectionsReady =
    projectionInputs.length === 0 || projectionsQ.isSuccess || projectionsQ.isError;

  const deltas = useMemo(() => {
    const out = new Map<string, TradeDelta | null>();
    if (mineId == null) return out;
    const minePlayers = rosterById.get(mineId);
    if (!minePlayers || !bookRostersReady || !projectionsReady || !rosterPositions.length) {
      for (const t of trades.data ?? []) out.set(t.id, null);
      return out;
    }
    for (const t of trades.data ?? []) {
      if (t.status !== "proposed" || !t.sides.some((s) => s.rosterId === mineId)) {
        out.set(t.id, null);
        continue;
      }
      const outgoingIds = t.assets
        .filter((a) => a.kind === "player" && a.fromRoster === mineId && a.playerId)
        .map((a) => a.playerId!);
      const incoming: RosterPlayer[] = [];
      for (const a of t.assets) {
        if (a.kind !== "player" || a.toRoster !== mineId || !a.playerId) continue;
        const fromPlayers = rosterById.get(a.fromRoster);
        const found = fromPlayers?.find((p) => p.player_id === a.playerId);
        if (found) incoming.push(found);
      }
      // Wait until every counterparty roster used by this trade has loaded.
      const needed = new Set(
        t.assets
          .filter((a) => a.kind === "player" && a.toRoster === mineId)
          .map((a) => a.fromRoster),
      );
      if ([...needed].some((id) => !rosterById.has(id))) {
        out.set(t.id, null);
        continue;
      }
      out.set(
        t.id,
        tradeDelta({
          players: minePlayers,
          rosterPositions,
          projections,
          outgoingIds,
          incoming,
        }),
      );
    }
    return out;
  }, [
    trades.data,
    mineId,
    rosterById,
    bookRostersReady,
    projectionsReady,
    rosterPositions,
    projections,
  ]);

  const [minePlayers, setMinePlayers] = useState<string[]>([]);
  const [themPlayers, setThemPlayers] = useState<string[]>([]);
  const [thirdPlayers, setThirdPlayers] = useState<string[]>([]);
  const [minePicks, setMinePicks] = useState<number[]>([]);
  const [themPicks, setThemPicks] = useState<number[]>([]);
  const [thirdPicks, setThirdPicks] = useState<number[]>([]);
  const [mineTo, setMineTo] = useState<number | null>(null);
  const [themTo, setThemTo] = useState<number | null>(null);
  const [thirdTo, setThirdTo] = useState<number | null>(null);

  const involved = useMemo(() => {
    const ids = [mineId, them, thirdId].filter((n): n is number => n != null);
    return standings.filter((s) => ids.includes(s.rosterId));
  }, [mineId, them, thirdId, standings]);

  const mineTeam = useQuery({
    queryKey: ["team", leagueId, mineId, league.data?.currentWeek],
    queryFn: () => getTeam({ data: { leagueId, rosterId: mineId!, week: league.data!.currentWeek } }),
    enabled: Boolean(mineId && league.data?.hosted && !league.data.locked),
  });
  const themTeam = useQuery({
    queryKey: ["team", leagueId, them, league.data?.currentWeek],
    queryFn: () => getTeam({ data: { leagueId, rosterId: them!, week: league.data!.currentWeek } }),
    enabled: Boolean(them && league.data),
  });
  const thirdTeam = useQuery({
    queryKey: ["team", leagueId, thirdId, league.data?.currentWeek],
    queryFn: () => getTeam({ data: { leagueId, rosterId: thirdId!, week: league.data!.currentWeek } }),
    enabled: Boolean(thirdId && league.data),
  });

  const myPicks = useMemo(
    () => (picks.data ?? []).filter((p) => p.rosterId === mineId),
    [picks.data, mineId],
  );
  const theirPicks = useMemo(
    () => (picks.data ?? []).filter((p) => p.rosterId === them),
    [picks.data, them],
  );
  const thirdPickList = useMemo(
    () => (picks.data ?? []).filter((p) => p.rosterId === thirdId),
    [picks.data, thirdId],
  );

  function nameOf(id: number | null) {
    if (id == null) return "—";
    return standings.find((s) => s.rosterId === id)?.teamName ?? `Team ${id}`;
  }

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["trades", leagueId] });
    void qc.invalidateQueries({ queryKey: ["picks", leagueId] });
    void qc.invalidateQueries({ queryKey: ["team", leagueId] });
    void qc.invalidateQueries({ queryKey: ["league", leagueId] });
    void qc.invalidateQueries({ queryKey: ["draft", leagueId] });
  }

  const send = useMutation({
    mutationFn: async () => {
      if (!mineId || !them) throw new Error("Pick a partner.");
      const destMine = mineTo ?? them;
      const destThem = themTo ?? mineId;
      const destThird = thirdTo ?? mineId;
      const sides: PendingSide[] = [
        { rosterId: mineId, sendTo: destMine, players: minePlayers, picks: minePicks },
        { rosterId: them, sendTo: destThem, players: themPlayers, picks: themPicks },
      ];
      if (thirdId) {
        sides.push({ rosterId: thirdId, sendTo: destThird, players: thirdPlayers, picks: thirdPicks });
      }
      const assets: Array<{
        fromRoster: number;
        toRoster: number;
        kind: "player" | "pick";
        playerId?: string | null;
        pickNo?: number | null;
      }> = [];
      for (const side of sides) {
        if (side.sendTo === side.rosterId) throw new Error("A side is sending to itself.");
        for (const id of side.players) {
          assets.push({ fromRoster: side.rosterId, toRoster: side.sendTo, kind: "player", playerId: id });
        }
        for (const n of side.picks) {
          assets.push({ fromRoster: side.rosterId, toRoster: side.sendTo, kind: "pick", pickNo: n });
        }
      }
      if (!assets.length) throw new Error("Add a player or unused pick.");
      return proposeTrade({ data: { leagueId, assets } });
    },
    onSuccess: () => {
      toast("Trade proposed.");
      setMinePlayers([]);
      setThemPlayers([]);
      setThirdPlayers([]);
      setMinePicks([]);
      setThemPicks([]);
      setThirdPicks([]);
      invalidate();
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not propose"),
  });

  const vote = useMutation({
    mutationFn: (input: { tradeId: string; accept: boolean }) =>
      voteTrade({ data: { leagueId, ...input } }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof Error ? e.message : "Could not vote"),
  });
  const pull = useMutation({
    mutationFn: (tradeId: string) => cancelTradeFn({ data: { leagueId, tradeId } }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof Error ? e.message : "Could not cancel"),
  });

  function toggle<T>(list: T[], set: (n: T[]) => void, v: T) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  if (!league.data?.hosted) {
    return <p className="text-sm text-muted">Trades live on hosted Ledger leagues.</p>;
  }

  const preDraft = league.data.draftStatus === "pending" || league.data.draftStatus === "live";

  return (
    <div className="space-y-8">
      <p className="max-w-xl text-sm text-muted">
        {preDraft
          ? "Draft hasn't happened yet — trade unused picks now. Your first for their first and second, dump a last-rounder, three-teamers. Ownership moves on the board immediately once everyone accepts."
          : "Swap players and unused draft picks. Two teams or three. Everyone in the deal has to accept."}{" "}
        Deadline week {league.data.ops?.tradeDeadlineWeek ?? 11}.
      </p>

      {mineId && !league.data.locked ? (
        <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Propose</p>
          <p className="mt-2 text-xs text-muted">Partner</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {partners.map((p) => (
              <button
                key={p.rosterId}
                type="button"
                onClick={() => {
                  setPartnerId(p.rosterId);
                  if (thirdId === p.rosterId) setThirdId(null);
                }}
                className={cn(
                  "h-10 rounded-sm px-3 text-sm",
                  them === p.rosterId ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                )}
              >
                {p.teamName}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <AssetCol
              title="You send"
              sendTo={mineTo ?? them}
              destinations={involved.filter((s) => s.rosterId !== mineId)}
              onDest={(id) => setMineTo(id)}
              destLabel={nameOf(mineTo ?? them)}
              players={mineTeam.data?.players ?? []}
              picks={myPicks}
              selectedPlayers={minePlayers}
              selectedPicks={minePicks}
              onPlayer={(id) => toggle(minePlayers, setMinePlayers, id)}
              onPick={(n) => toggle(minePicks, setMinePicks, n)}
            />
            <AssetCol
              title={`${nameOf(them)} sends`}
              sendTo={themTo ?? mineId}
              destinations={involved.filter((s) => s.rosterId !== them)}
              onDest={(id) => setThemTo(id)}
              destLabel={nameOf(themTo ?? mineId)}
              players={themTeam.data?.players ?? []}
              picks={theirPicks}
              selectedPlayers={themPlayers}
              selectedPicks={themPicks}
              onPlayer={(id) => toggle(themPlayers, setThemPlayers, id)}
              onPick={(n) => toggle(themPicks, setThemPicks, n)}
            />
          </div>

          <div className="mt-4">
            <button
              type="button"
              className="font-mono text-[11px] uppercase text-muted hover:text-fg"
              onClick={() =>
                setThirdId(
                  thirdId
                    ? null
                    : (partners.find((p) => p.rosterId !== them)?.rosterId ?? null),
                )
              }
            >
              {thirdId ? "Remove third team" : "Add a third team"}
            </button>
          </div>
          {thirdId ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {partners
                  .filter((p) => p.rosterId !== them)
                  .map((p) => (
                    <button
                      key={p.rosterId}
                      type="button"
                      onClick={() => setThirdId(p.rosterId)}
                      className={cn(
                        "h-10 rounded-sm px-3 text-sm",
                        thirdId === p.rosterId ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                      )}
                    >
                      {p.teamName}
                    </button>
                  ))}
              </div>
              <AssetCol
                title={`${nameOf(thirdId)} sends`}
                sendTo={thirdTo ?? mineId}
                destinations={involved.filter((s) => s.rosterId !== thirdId)}
                onDest={(id) => setThirdTo(id)}
                destLabel={nameOf(thirdTo ?? mineId)}
                players={thirdTeam.data?.players ?? []}
                picks={thirdPickList}
                selectedPlayers={thirdPlayers}
                selectedPicks={thirdPicks}
                onPlayer={(id) => toggle(thirdPlayers, setThirdPlayers, id)}
                onPick={(n) => toggle(thirdPicks, setThirdPicks, n)}
              />
            </div>
          ) : null}

          <Button className="mt-5" type="button" onClick={() => send.mutate()} disabled={send.isPending}>
            {send.isPending ? "Sending…" : "Propose trade"}
          </Button>
        </section>
      ) : (
        <p className="text-sm text-muted">Claim a seat to propose trades.</p>
      )}

      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Book</p>
        {trades.isLoading ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : !trades.data?.length ? (
          <p className="mt-3 text-sm text-muted">No trades yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {trades.data.map((t) => {
              const delta = deltas.get(t.id) ?? null;
              const minePlayers = mineId != null ? rosterById.get(mineId) : undefined;
              let posBefore: Record<string, number> | undefined;
              let posAfter: Record<string, number> | undefined;
              if (delta != null && minePlayers && mineId != null) {
                const outgoing = new Set(
                  t.assets
                    .filter((a) => a.kind === "player" && a.fromRoster === mineId && a.playerId)
                    .map((a) => a.playerId!),
                );
                const incoming = t.assets
                  .filter((a) => a.kind === "player" && a.toRoster === mineId && a.playerId)
                  .map((a) => {
                    const from = rosterById.get(a.fromRoster);
                    return from?.find((p) => p.player_id === a.playerId) ?? null;
                  })
                  .filter((p): p is RosterPlayer => p != null);
                const afterPlayers = [
                  ...minePlayers.filter((p) => !outgoing.has(p.player_id)),
                  ...incoming,
                ];
                posBefore = countPositions(minePlayers);
                posAfter = countPositions(afterPlayers);
              }
              const waitingOnMe =
                Boolean(mineId) &&
                t.status === "proposed" &&
                t.sides.some((s) => s.rosterId === mineId && !s.accepted);
              return (
                <TradeOfferCard
                  key={t.id}
                  trade={t}
                  myRosterId={mineId ?? null}
                  delta={delta}
                  projections={projections}
                  playerById={playerById}
                  posBefore={posBefore}
                  posAfter={posAfter}
                  busy={vote.isPending || pull.isPending}
                  onAccept={
                    waitingOnMe
                      ? () => vote.mutate({ tradeId: t.id, accept: true })
                      : undefined
                  }
                  onDecline={
                    waitingOnMe
                      ? () => vote.mutate({ tradeId: t.id, accept: false })
                      : undefined
                  }
                  onCounter={
                    waitingOnMe
                      ? () =>
                          void navigate({
                            search: (prev) => ({ ...prev, counter: t.id }),
                          })
                      : undefined
                  }
                  onAcceptHouse={
                    league.data.isCommish &&
                    t.status === "proposed" &&
                    t.sides.some((s) => s.house && !s.accepted)
                      ? () => vote.mutate({ tradeId: t.id, accept: true })
                      : undefined
                  }
                  onPull={
                    t.status === "proposed" && t.proposerRoster === mineId
                      ? () => pull.mutate(t.id)
                      : undefined
                  }
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function countPositions(players: Array<{ position: string | null }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of players) {
    const pos = p.position?.trim() || "?";
    counts[pos] = (counts[pos] ?? 0) + 1;
  }
  return counts;
}

function AssetCol({
  title,
  sendTo,
  destinations,
  onDest,
  destLabel,
  players,
  picks,
  selectedPlayers,
  selectedPicks,
  onPlayer,
  onPick,
}: {
  title: string;
  sendTo: number | null;
  destinations: Array<{ rosterId: number; teamName: string }>;
  onDest: (id: number) => void;
  destLabel: string;
  players: Array<{ player_id: string; full_name: string; position: string | null }>;
  picks: Array<{ pickNo: number; label: string; via: string | null | undefined }>;
  selectedPlayers: string[];
  selectedPicks: number[];
  onPlayer: (id: string) => void;
  onPick: (n: number) => void;
}) {
  return (
    <div>
      <p className="text-sm">{title}</p>
      {destinations.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {destinations.map((d) => (
            <button
              key={d.rosterId}
              type="button"
              onClick={() => onDest(d.rosterId)}
              className={cn(
                "h-8 rounded-sm px-2 font-mono text-[11px]",
                sendTo === d.rosterId ? "bg-accent text-accent-fg" : "bg-raised text-muted",
              )}
            >
              to {d.teamName}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-1 font-mono text-[11px] text-faint">to {destLabel}</p>
      )}
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        {players.map((p) => (
          <li key={p.player_id}>
            <button
              type="button"
              onClick={() => onPlayer(p.player_id)}
              className={cn(
                "flex min-h-11 w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm",
                selectedPlayers.includes(p.player_id) ? "bg-accent text-accent-fg" : "hover:bg-raised",
              )}
            >
              <span>{p.full_name}</span>
              <span className="font-mono text-[11px] opacity-70">{p.position}</span>
            </button>
          </li>
        ))}
        {picks.map((p) => (
          <li key={p.pickNo}>
            <button
              type="button"
              onClick={() => onPick(p.pickNo)}
              className={cn(
                "flex min-h-11 w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm",
                selectedPicks.includes(p.pickNo) ? "bg-accent text-accent-fg" : "hover:bg-raised",
              )}
            >
              <span>Pick {p.label}</span>
              {p.via ? <span className="font-mono text-[11px] opacity-70">via {p.via}</span> : null}
            </button>
          </li>
        ))}
        {!players.length && !picks.length ? (
          <li className="px-2 py-2 text-xs text-faint">No assets yet — unused picks appear after the board is built.</li>
        ) : null}
      </ul>
    </div>
  );
}
