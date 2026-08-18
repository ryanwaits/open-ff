import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PlayerStatRow, type PlayerStatRowData } from "@/components/player-stat-row";
import { consequenceLine } from "@/components/trade-offer-card";
import { Button } from "@/components/ui/button";
import type { Projection, RosterPlayer } from "@/lib/data/types";
import { proposeTrade } from "@/lib/league/fns";
import { tradeDelta } from "@/lib/league/lineup-value";
import { cn } from "@/lib/utils";

/**
 * Three columns, and the deal is the middle one.
 *
 * The old form kept selections highlighted inside two scrolling lists, so the
 * thing you were about to send never existed anywhere as one object. Here it
 * does, with a running balance — and FAAB is an input rather than something the
 * engine accepts but the page cannot offer.
 */

export type TradeComposerPick = {
  pickNo: number;
  label: string;
  via?: string | null;
};

export type TradeComposerPartner = {
  rosterId: number;
  teamName: string;
};

/** Prefill from Counter — already mapped to your send / get columns. */
export type TradeComposerInitial = {
  sendPlayerIds: string[];
  sendPickNos: number[];
  sendFaab: number | null;
  getPlayerIds: string[];
  getPickNos: number[];
  getFaab: number | null;
};

export function TradeComposer({
  leagueId,
  myRosterId,
  theirRosterId,
  partners,
  myRoster,
  theirRoster,
  myPicks,
  theirPicks,
  projections,
  rosterPositions,
  myFaabFree,
  theirFaabFree,
  initial,
  countering = false,
  onProposed,
}: {
  leagueId: string;
  myRosterId: number;
  theirRosterId: number;
  partners: TradeComposerPartner[];
  myRoster: RosterPlayer[];
  theirRoster: RosterPlayer[];
  myPicks: TradeComposerPick[];
  theirPicks: TradeComposerPick[];
  projections: Record<string, Projection>;
  rosterPositions: string[];
  /** Unstaked FAAB you can send. */
  myFaabFree: number;
  /** Partner free balance when known; null skips a client-side ceiling. */
  theirFaabFree: number | null;
  initial?: TradeComposerInitial | null;
  countering?: boolean;
  onProposed?: () => void;
}) {
  const themName =
    partners.find((p) => p.rosterId === theirRosterId)?.teamName ?? `Team ${theirRosterId}`;

  const [sendPlayers, setSendPlayers] = useState<string[]>([]);
  const [getPlayers, setGetPlayers] = useState<string[]>([]);
  const [sendPicks, setSendPicks] = useState<number[]>([]);
  const [getPicks, setGetPicks] = useState<number[]>([]);
  const [sendFaab, setSendFaab] = useState<number | null>(null);
  const [getFaab, setGetFaab] = useState<number | null>(null);
  const [sendFaabErr, setSendFaabErr] = useState<string | null>(null);
  const [getFaabErr, setGetFaabErr] = useState<string | null>(null);

  useEffect(() => {
    if (!initial) return;
    setSendPlayers(initial.sendPlayerIds);
    setGetPlayers(initial.getPlayerIds);
    setSendPicks(initial.sendPickNos);
    setGetPicks(initial.getPickNos);
    setSendFaab(initial.sendFaab);
    setGetFaab(initial.getFaab);
    setSendFaabErr(null);
    setGetFaabErr(null);
  }, [initial]);

  // Partner switch drops a half-built deal so chips don't point at the wrong roster.
  useEffect(() => {
    if (initial) return;
    setSendPlayers([]);
    setGetPlayers([]);
    setSendPicks([]);
    setGetPicks([]);
    setSendFaab(null);
    setGetFaab(null);
    setSendFaabErr(null);
    setGetFaabErr(null);
  }, [theirRosterId, initial]);

  const delta = useMemo(() => {
    if (!rosterPositions.length) return null;
    const incoming = theirRoster.filter((p) => getPlayers.includes(p.player_id));
    return tradeDelta({
      players: myRoster,
      rosterPositions,
      projections,
      outgoingIds: sendPlayers,
      incoming,
    });
  }, [myRoster, theirRoster, rosterPositions, projections, sendPlayers, getPlayers]);

  const faabNet = (getFaab ?? 0) - (sendFaab ?? 0);

  const posBefore = useMemo(() => countPositions(myRoster), [myRoster]);
  const posAfter = useMemo(() => {
    const out = new Set(sendPlayers);
    const after = [
      ...myRoster.filter((p) => !out.has(p.player_id)),
      ...theirRoster.filter((p) => getPlayers.includes(p.player_id)),
    ];
    return countPositions(after);
  }, [myRoster, theirRoster, sendPlayers, getPlayers]);

  const hasAsset =
    sendPlayers.length > 0 ||
    getPlayers.length > 0 ||
    sendPicks.length > 0 ||
    getPicks.length > 0 ||
    (sendFaab != null && sendFaab > 0) ||
    (getFaab != null && getFaab > 0);

  const faabBlocked = Boolean(sendFaabErr || getFaabErr);

  const send = useMutation({
    mutationFn: async () => {
      if (theirRosterId === myRosterId) throw new Error("Pick a partner.");
      if (!hasAsset) throw new Error("Add a player, pick, or FAAB.");
      if (sendFaab != null && sendFaab > myFaabFree) {
        throw new Error(`You only have $${myFaabFree} unstaked.`);
      }
      if (theirFaabFree != null && getFaab != null && getFaab > theirFaabFree) {
        throw new Error(`They only have $${theirFaabFree} to trade.`);
      }
      const assets: Array<{
        fromRoster: number;
        toRoster: number;
        kind: "player" | "pick" | "faab";
        playerId?: string | null;
        pickNo?: number | null;
        amount?: number | null;
      }> = [];
      for (const id of sendPlayers) {
        assets.push({
          fromRoster: myRosterId,
          toRoster: theirRosterId,
          kind: "player",
          playerId: id,
        });
      }
      for (const n of sendPicks) {
        assets.push({
          fromRoster: myRosterId,
          toRoster: theirRosterId,
          kind: "pick",
          pickNo: n,
        });
      }
      if (sendFaab != null && sendFaab > 0) {
        assets.push({
          fromRoster: myRosterId,
          toRoster: theirRosterId,
          kind: "faab",
          amount: sendFaab,
        });
      }
      for (const id of getPlayers) {
        assets.push({
          fromRoster: theirRosterId,
          toRoster: myRosterId,
          kind: "player",
          playerId: id,
        });
      }
      for (const n of getPicks) {
        assets.push({
          fromRoster: theirRosterId,
          toRoster: myRosterId,
          kind: "pick",
          pickNo: n,
        });
      }
      if (getFaab != null && getFaab > 0) {
        assets.push({
          fromRoster: theirRosterId,
          toRoster: myRosterId,
          kind: "faab",
          amount: getFaab,
        });
      }
      return proposeTrade({ data: { leagueId, assets } });
    },
    onSuccess: () => {
      toast("Trade proposed.");
      setSendPlayers([]);
      setGetPlayers([]);
      setSendPicks([]);
      setGetPicks([]);
      setSendFaab(null);
      setGetFaab(null);
      setSendFaabErr(null);
      setGetFaabErr(null);
      onProposed?.();
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not propose"),
  });

  function togglePlayer(side: "send" | "get", id: string) {
    if (side === "send") {
      setSendPlayers((list) =>
        list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      );
    } else {
      setGetPlayers((list) =>
        list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      );
    }
  }

  function togglePick(side: "send" | "get", n: number) {
    if (side === "send") {
      setSendPicks((list) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n]));
    } else {
      setGetPicks((list) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n]));
    }
  }

  function setFaab(side: "send" | "get", raw: string) {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 3);
    const n = digits === "" ? null : Number(digits);
    if (side === "send") {
      if (n != null && n > myFaabFree) {
        setSendFaab(n);
        setSendFaabErr(`You only have $${myFaabFree} unstaked.`);
      } else {
        setSendFaab(n);
        setSendFaabErr(null);
      }
    } else {
      if (theirFaabFree != null && n != null && n > theirFaabFree) {
        setGetFaab(n);
        setGetFaabErr(`They only have $${theirFaabFree} to trade.`);
      } else {
        setGetFaab(n);
        setGetFaabErr(null);
      }
    }
  }

  const sendPlayerRows = sendPlayers
    .map((id) => myRoster.find((p) => p.player_id === id))
    .filter((p): p is RosterPlayer => p != null);
  const getPlayerRows = getPlayers
    .map((id) => theirRoster.find((p) => p.player_id === id))
    .filter((p): p is RosterPlayer => p != null);
  const sendPickRows = sendPicks
    .map((n) => myPicks.find((p) => p.pickNo === n))
    .filter((p): p is TradeComposerPick => p != null);
  const getPickRows = getPicks
    .map((n) => theirPicks.find((p) => p.pickNo === n))
    .filter((p): p is TradeComposerPick => p != null);

  return (
    <div className="mt-5 space-y-4">
      {countering ? (
        <p className="text-xs text-muted">Countering an existing offer.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)]">
        <RosterPanel
          title="Your roster"
          players={myRoster}
          picks={myPicks}
          selectedPlayers={sendPlayers}
          selectedPicks={sendPicks}
          projections={projections}
          onPlayer={(id) => togglePlayer("send", id)}
          onPick={(n) => togglePick("send", n)}
        />

        <div className="rounded-lg bg-raised/60 p-3 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">The deal</p>

          <DealSide
            title="You send"
            players={sendPlayerRows}
            picks={sendPickRows}
            faab={sendFaab}
            faabErr={sendFaabErr}
            faabFree={myFaabFree}
            faabLabel="Your unstaked"
            projections={projections}
            onRemovePlayer={(id) => setSendPlayers((l) => l.filter((x) => x !== id))}
            onRemovePick={(n) => setSendPicks((l) => l.filter((x) => x !== n))}
            onFaab={(raw) => setFaab("send", raw)}
          />

          <DealSide
            title={`You get · ${themName}`}
            players={getPlayerRows}
            picks={getPickRows}
            faab={getFaab}
            faabErr={getFaabErr}
            faabFree={theirFaabFree}
            faabLabel="Their FAAB"
            projections={projections}
            onRemovePlayer={(id) => setGetPlayers((l) => l.filter((x) => x !== id))}
            onRemovePick={(n) => setGetPicks((l) => l.filter((x) => x !== n))}
            onFaab={(raw) => setFaab("get", raw)}
          />

          <div className="mt-4 space-y-2 border-t border-line pt-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Balance</p>
            {delta ? (
              <>
                <p className="text-sm text-muted">{consequenceLine(delta)}</p>
                {delta.changed.length > 0 ? (
                  <ul className="space-y-1">
                    {delta.changed.map((row) => (
                      <li
                        key={row.slot}
                        className="flex items-baseline justify-between gap-2 font-mono text-[11px] text-faint"
                      >
                        <span>
                          {row.slot}: {row.from?.full_name ?? "open"} →{" "}
                          {row.to?.full_name ?? "open"}
                        </span>
                        <span className="tabular-nums">
                          {row.delta > 0 ? "+" : ""}
                          {row.delta.toFixed(1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="font-mono text-[11px] text-faint">
                  Starters {delta.before.total.toFixed(1)} → {delta.after.total.toFixed(1)}
                  {delta.change !== 0
                    ? ` (${delta.change > 0 ? "+" : ""}${delta.change.toFixed(1)})`
                    : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-faint">Add players to see the lineup shift.</p>
            )}
            <PositionShift before={posBefore} after={posAfter} />
            {faabNet !== 0 ? (
              <p className="font-mono text-[11px] text-faint">
                FAAB {faabNet > 0 ? "+" : "−"}${Math.abs(faabNet)}
              </p>
            ) : null}
          </div>

          <Button
            className="mt-4 w-full"
            type="button"
            disabled={!hasAsset || faabBlocked || send.isPending}
            onClick={() => send.mutate()}
          >
            {send.isPending ? "Sending…" : "Propose trade"}
          </Button>
        </div>

        <RosterPanel
          title={themName}
          players={theirRoster}
          picks={theirPicks}
          selectedPlayers={getPlayers}
          selectedPicks={getPicks}
          projections={projections}
          onPlayer={(id) => togglePlayer("get", id)}
          onPick={(n) => togglePick("get", n)}
        />
      </div>
    </div>
  );
}

function RosterPanel({
  title,
  players,
  picks,
  selectedPlayers,
  selectedPicks,
  projections,
  onPlayer,
  onPick,
}: {
  title: string;
  players: RosterPlayer[];
  picks: TradeComposerPick[];
  selectedPlayers: string[];
  selectedPicks: number[];
  projections: Record<string, Projection>;
  onPlayer: (id: string) => void;
  onPick: (n: number) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto">
        {players.map((p) => {
          const proj = projections[p.player_id];
          const data: PlayerStatRowData = {
            player: p,
            projection: proj?.points ?? null,
            projectionIsAverage: proj?.reason === "season-avg",
          };
          return (
            <li key={p.player_id}>
              <PlayerStatRow
                data={data}
                dense
                selected={selectedPlayers.includes(p.player_id)}
                onSelect={() => onPlayer(p.player_id)}
              />
            </li>
          );
        })}
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
              {p.via ? (
                <span className="font-mono text-[11px] opacity-70">via {p.via}</span>
              ) : null}
            </button>
          </li>
        ))}
        {!players.length && !picks.length ? (
          <li className="px-2 py-2 text-xs text-faint">
            No assets yet — unused picks appear after the board is built.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function DealSide({
  title,
  players,
  picks,
  faab,
  faabErr,
  faabFree,
  faabLabel,
  projections,
  onRemovePlayer,
  onRemovePick,
  onFaab,
}: {
  title: string;
  players: RosterPlayer[];
  picks: TradeComposerPick[];
  faab: number | null;
  faabErr: string | null;
  faabFree: number | null;
  faabLabel: string;
  projections: Record<string, Projection>;
  onRemovePlayer: (id: string) => void;
  onRemovePick: (n: number) => void;
  onFaab: (raw: string) => void;
}) {
  return (
    <div className="mt-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">{title}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {players.map((p) => (
          <li key={p.player_id}>
            <Chip onRemove={() => onRemovePlayer(p.player_id)}>
              <span className="truncate">{p.full_name}</span>
              <span className="font-mono text-[10px] opacity-70">{p.position}</span>
              {projections[p.player_id] ? (
                <span className="font-mono text-[10px] tabular-nums opacity-70">
                  {projections[p.player_id]!.points.toFixed(1)}
                </span>
              ) : null}
            </Chip>
          </li>
        ))}
        {picks.map((p) => (
          <li key={p.pickNo}>
            <Chip onRemove={() => onRemovePick(p.pickNo)}>Pick {p.label}</Chip>
          </li>
        ))}
        {!players.length && !picks.length && !(faab != null && faab > 0) ? (
          <li className="px-1 py-1 text-xs text-faint">Nothing yet — tap a player or pick.</li>
        ) : null}
      </ul>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-faint">plus FAAB</span>
        <div
          className={cn(
            "flex items-baseline rounded-md bg-surface px-2.5 py-1 shadow-[var(--shadow-border)] focus-within:shadow-[0_0_0_1px_var(--color-accent-deep)]",
            faabErr && "shadow-[0_0_0_1px_var(--color-loss)]",
          )}
        >
          <span className="font-mono text-sm font-bold text-faint">$</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            aria-label={`${title} FAAB`}
            value={faab == null ? "" : String(faab)}
            onChange={(e) => onFaab(e.target.value)}
            className={cn(
              "w-[3.4ch] bg-transparent font-mono text-base font-bold tabular-nums outline-none placeholder:text-faint/60",
              faabErr && "text-loss",
            )}
          />
        </div>
        {faabFree != null ? (
          <span className="font-mono text-[11px] text-faint">
            {faabLabel} ${faabFree}
          </span>
        ) : null}
      </div>
      {faabErr ? <p className="mt-1 text-xs text-loss">{faabErr}</p> : null}
    </div>
  );
}

function Chip({
  children,
  onRemove,
}: {
  children: ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-sm bg-surface px-2 py-1 text-xs text-fg shadow-[var(--shadow-border)]">
      {children}
      <button
        type="button"
        aria-label="Remove"
        onClick={onRemove}
        className="rounded-pill p-0.5 text-faint hover:bg-raised hover:text-fg"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

function PositionShift({
  before,
  after,
}: {
  before: Record<string, number>;
  after: Record<string, number>;
}) {
  const positions = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((pos) => (before[pos] ?? 0) !== (after[pos] ?? 0))
    .sort();
  if (!positions.length) return null;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {positions.map((pos) => (
        <li key={pos} className="font-mono text-[11px] text-faint">
          {pos} {before[pos] ?? 0}→{after[pos] ?? 0}
        </li>
      ))}
    </ul>
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
