import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
 * Two-team: your roster | deal | theirs. Three-team: one tabbed roster column
 * (you can only read one list at this density) | deal with a leg per sender
 * and a destination pill on every chip.
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

type DirectedPlayer = { id: string; to: number };
type DirectedPick = { pickNo: number; to: number };
type DirectedFaab = { amount: number; to: number };

type RosterTab = "mine" | "them" | "third";

export function TradeComposer({
  leagueId,
  myRosterId,
  theirRosterId,
  thirdRosterId = null,
  partners,
  myRoster,
  theirRoster,
  thirdRoster = [],
  myPicks,
  theirPicks,
  thirdPicks = [],
  projections,
  rosterPositions,
  myFaabFree,
  theirFaabFree,
  thirdFaabFree = null,
  onThirdChange,
  initial,
  countering = false,
  onProposed,
}: {
  leagueId: string;
  myRosterId: number;
  theirRosterId: number;
  /** When set, composer switches to the tabbed three-team layout. */
  thirdRosterId?: number | null;
  partners: TradeComposerPartner[];
  myRoster: RosterPlayer[];
  theirRoster: RosterPlayer[];
  thirdRoster?: RosterPlayer[];
  myPicks: TradeComposerPick[];
  theirPicks: TradeComposerPick[];
  thirdPicks?: TradeComposerPick[];
  projections: Record<string, Projection>;
  rosterPositions: string[];
  myFaabFree: number;
  theirFaabFree: number | null;
  thirdFaabFree?: number | null;
  /** Add / switch / clear the third seat. Required for the + Team control. */
  onThirdChange?: (id: number | null) => void;
  initial?: TradeComposerInitial | null;
  countering?: boolean;
  onProposed?: () => void;
}) {
  const three = thirdRosterId != null;
  const themName =
    partners.find((p) => p.rosterId === theirRosterId)?.teamName ?? `Team ${theirRosterId}`;
  const thirdName =
    thirdRosterId != null
      ? (partners.find((p) => p.rosterId === thirdRosterId)?.teamName ?? `Team ${thirdRosterId}`)
      : "";
  const myName = "You";

  const involvedIds = useMemo(() => {
    const ids = [myRosterId, theirRosterId];
    if (thirdRosterId != null) ids.push(thirdRosterId);
    return ids;
  }, [myRosterId, theirRosterId, thirdRosterId]);

  const availableThirds = useMemo(
    () => partners.filter((p) => p.rosterId !== theirRosterId),
    [partners, theirRosterId],
  );

  // Two-team selections (also the migration source when a third joins).
  const [sendPlayers, setSendPlayers] = useState<string[]>([]);
  const [getPlayers, setGetPlayers] = useState<string[]>([]);
  const [sendPicks, setSendPicks] = useState<number[]>([]);
  const [getPicks, setGetPicks] = useState<number[]>([]);
  const [sendFaab, setSendFaab] = useState<number | null>(null);
  const [getFaab, setGetFaab] = useState<number | null>(null);
  const [sendFaabErr, setSendFaabErr] = useState<string | null>(null);
  const [getFaabErr, setGetFaabErr] = useState<string | null>(null);

  // Three-team: per-asset destinations. Keys are player ids / pick nos.
  const [minePlayers, setMinePlayers] = useState<DirectedPlayer[]>([]);
  const [themPlayers, setThemPlayers] = useState<DirectedPlayer[]>([]);
  const [thirdPlayers, setThirdPlayers] = useState<DirectedPlayer[]>([]);
  const [minePicksSel, setMinePicksSel] = useState<DirectedPick[]>([]);
  const [themPicksSel, setThemPicksSel] = useState<DirectedPick[]>([]);
  const [thirdPicksSel, setThirdPicksSel] = useState<DirectedPick[]>([]);
  const [mineFaab, setMineFaab] = useState<DirectedFaab | null>(null);
  const [themFaab, setThemFaab] = useState<DirectedFaab | null>(null);
  const [thirdFaab, setThirdFaab] = useState<DirectedFaab | null>(null);
  const [mineFaabErr, setMineFaabErr] = useState<string | null>(null);
  const [themFaabErr, setThemFaabErr] = useState<string | null>(null);
  const [thirdFaabErr, setThirdFaabErr] = useState<string | null>(null);

  const [rosterTab, setRosterTab] = useState<RosterTab>("them");

  function defaultDest(from: number): number {
    const others = involvedIds.filter((id) => id !== from);
    if (others.includes(myRosterId)) return myRosterId;
    return others[0] ?? theirRosterId;
  }

  function nameOf(id: number): string {
    if (id === myRosterId) return myName;
    if (id === theirRosterId) return themName;
    if (id === thirdRosterId) return thirdName;
    return partners.find((p) => p.rosterId === id)?.teamName ?? `Team ${id}`;
  }

  function clearTwoTeam() {
    setSendPlayers([]);
    setGetPlayers([]);
    setSendPicks([]);
    setGetPicks([]);
    setSendFaab(null);
    setGetFaab(null);
    setSendFaabErr(null);
    setGetFaabErr(null);
  }

  function clearThreeTeam() {
    setMinePlayers([]);
    setThemPlayers([]);
    setThirdPlayers([]);
    setMinePicksSel([]);
    setThemPicksSel([]);
    setThirdPicksSel([]);
    setMineFaab(null);
    setThemFaab(null);
    setThirdFaab(null);
    setMineFaabErr(null);
    setThemFaabErr(null);
    setThirdFaabErr(null);
  }

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
    // Counter is two-team; clear any three-way state.
    clearThreeTeam();
  }, [initial]);

  // Partner switch drops a half-built deal so chips don't point at the wrong roster.
  useEffect(() => {
    if (initial) return;
    clearTwoTeam();
    clearThreeTeam();
  }, [theirRosterId, initial]);

  // Entering / leaving / switching third: migrate selections and scrub stale dests.
  const prevThirdRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const prev = prevThirdRef.current;
    prevThirdRef.current = thirdRosterId;
    // Skip first mount — nothing to migrate.
    if (prev === undefined) return;

    if (prev == null && thirdRosterId != null) {
      // Two → three: lift two-team selections into directed legs.
      setMinePlayers(sendPlayers.map((id) => ({ id, to: theirRosterId })));
      setThemPlayers(getPlayers.map((id) => ({ id, to: myRosterId })));
      setMinePicksSel(sendPicks.map((pickNo) => ({ pickNo, to: theirRosterId })));
      setThemPicksSel(getPicks.map((pickNo) => ({ pickNo, to: myRosterId })));
      setMineFaab(
        sendFaab != null && sendFaab > 0 ? { amount: sendFaab, to: theirRosterId } : null,
      );
      setThemFaab(getFaab != null && getFaab > 0 ? { amount: getFaab, to: myRosterId } : null);
      setThirdPlayers([]);
      setThirdPicksSel([]);
      setThirdFaab(null);
      setMineFaabErr(null);
      setThemFaabErr(null);
      setThirdFaabErr(null);
      setRosterTab("them");
      return;
    }

    if (prev != null && thirdRosterId == null) {
      // Three → two: keep me↔them only; never leave a dest pointing at the gone seat.
      setMinePlayers((list) => {
        const kept = list
          .filter((a) => a.to === theirRosterId || a.to === myRosterId)
          .map((a) => ({ id: a.id, to: theirRosterId }));
        setSendPlayers(kept.map((a) => a.id));
        return [];
      });
      setThemPlayers((list) => {
        const kept = list
          .filter((a) => a.to === myRosterId || a.to === theirRosterId)
          .map((a) => ({ id: a.id, to: myRosterId }));
        setGetPlayers(kept.map((a) => a.id));
        return [];
      });
      setMinePicksSel((list) => {
        const kept = list
          .filter((a) => a.to === theirRosterId || a.to === myRosterId)
          .map((a) => ({ pickNo: a.pickNo, to: theirRosterId }));
        setSendPicks(kept.map((a) => a.pickNo));
        return [];
      });
      setThemPicksSel((list) => {
        const kept = list
          .filter((a) => a.to === myRosterId || a.to === theirRosterId)
          .map((a) => ({ pickNo: a.pickNo, to: myRosterId }));
        setGetPicks(kept.map((a) => a.pickNo));
        return [];
      });
      setMineFaab((f) => {
        const next =
          f && (f.to === theirRosterId || f.to === myRosterId)
            ? { amount: f.amount, to: theirRosterId }
            : null;
        setSendFaab(next?.amount ?? null);
        return null;
      });
      setThemFaab((f) => {
        const next =
          f && (f.to === myRosterId || f.to === theirRosterId)
            ? { amount: f.amount, to: myRosterId }
            : null;
        setGetFaab(next?.amount ?? null);
        return null;
      });
      setThirdPlayers([]);
      setThirdPicksSel([]);
      setThirdFaab(null);
      setMineFaabErr(null);
      setThemFaabErr(null);
      setThirdFaabErr(null);
      setSendFaabErr(null);
      setGetFaabErr(null);
      setRosterTab("them");
      return;
    }

    if (prev != null && thirdRosterId != null && prev !== thirdRosterId) {
      // Third seat swapped: drop that leg; retarget assets that pointed at the old third.
      setThirdPlayers([]);
      setThirdPicksSel([]);
      setThirdFaab(null);
      setThirdFaabErr(null);
      setMinePlayers((list) =>
        list.map((a) => ({ ...a, to: a.to === prev ? theirRosterId : a.to })),
      );
      setThemPlayers((list) =>
        list.map((a) => ({ ...a, to: a.to === prev ? myRosterId : a.to })),
      );
      setMinePicksSel((list) =>
        list.map((a) => ({ ...a, to: a.to === prev ? theirRosterId : a.to })),
      );
      setThemPicksSel((list) =>
        list.map((a) => ({ ...a, to: a.to === prev ? myRosterId : a.to })),
      );
      setMineFaab((f) => (f && f.to === prev ? { ...f, to: theirRosterId } : f));
      setThemFaab((f) => (f && f.to === prev ? { ...f, to: myRosterId } : f));
      setRosterTab("third");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate on third join/leave/switch only
  }, [thirdRosterId]);

  // --- Balance: always your roster only ---
  const delta = useMemo(() => {
    if (!rosterPositions.length) return null;
    let outgoingIds: string[];
    let incoming: RosterPlayer[];
    if (three) {
      outgoingIds = minePlayers.map((a) => a.id);
      incoming = [
        ...theirRoster.filter((p) =>
          themPlayers.some((a) => a.id === p.player_id && a.to === myRosterId),
        ),
        ...thirdRoster.filter((p) =>
          thirdPlayers.some((a) => a.id === p.player_id && a.to === myRosterId),
        ),
      ];
    } else {
      outgoingIds = sendPlayers;
      incoming = theirRoster.filter((p) => getPlayers.includes(p.player_id));
    }
    return tradeDelta({
      players: myRoster,
      rosterPositions,
      projections,
      outgoingIds,
      incoming,
    });
  }, [
    three,
    myRoster,
    theirRoster,
    thirdRoster,
    rosterPositions,
    projections,
    sendPlayers,
    getPlayers,
    minePlayers,
    themPlayers,
    thirdPlayers,
    myRosterId,
  ]);

  const faabNet = useMemo(() => {
    if (!three) return (getFaab ?? 0) - (sendFaab ?? 0);
    let net = 0;
    if (mineFaab) net -= mineFaab.amount;
    if (themFaab?.to === myRosterId) net += themFaab.amount;
    if (thirdFaab?.to === myRosterId) net += thirdFaab.amount;
    return net;
  }, [three, getFaab, sendFaab, mineFaab, themFaab, thirdFaab, myRosterId]);

  const posBefore = useMemo(() => countPositions(myRoster), [myRoster]);
  const posAfter = useMemo(() => {
    let outgoing: Set<string>;
    let incoming: RosterPlayer[];
    if (three) {
      outgoing = new Set(minePlayers.map((a) => a.id));
      incoming = [
        ...theirRoster.filter((p) =>
          themPlayers.some((a) => a.id === p.player_id && a.to === myRosterId),
        ),
        ...thirdRoster.filter((p) =>
          thirdPlayers.some((a) => a.id === p.player_id && a.to === myRosterId),
        ),
      ];
    } else {
      outgoing = new Set(sendPlayers);
      incoming = theirRoster.filter((p) => getPlayers.includes(p.player_id));
    }
    return countPositions([
      ...myRoster.filter((p) => !outgoing.has(p.player_id)),
      ...incoming,
    ]);
  }, [
    three,
    myRoster,
    theirRoster,
    thirdRoster,
    sendPlayers,
    getPlayers,
    minePlayers,
    themPlayers,
    thirdPlayers,
    myRosterId,
  ]);

  const hasAsset = three
    ? minePlayers.length > 0 ||
      themPlayers.length > 0 ||
      thirdPlayers.length > 0 ||
      minePicksSel.length > 0 ||
      themPicksSel.length > 0 ||
      thirdPicksSel.length > 0 ||
      (mineFaab != null && mineFaab.amount > 0) ||
      (themFaab != null && themFaab.amount > 0) ||
      (thirdFaab != null && thirdFaab.amount > 0)
    : sendPlayers.length > 0 ||
      getPlayers.length > 0 ||
      sendPicks.length > 0 ||
      getPicks.length > 0 ||
      (sendFaab != null && sendFaab > 0) ||
      (getFaab != null && getFaab > 0);

  const faabBlocked = three
    ? Boolean(mineFaabErr || themFaabErr || thirdFaabErr)
    : Boolean(sendFaabErr || getFaabErr);

  const send = useMutation({
    mutationFn: async () => {
      if (theirRosterId === myRosterId) throw new Error("Pick a partner.");
      if (!hasAsset) throw new Error("Add a player, pick, or FAAB.");

      const assets: Array<{
        fromRoster: number;
        toRoster: number;
        kind: "player" | "pick" | "faab";
        playerId?: string | null;
        pickNo?: number | null;
        amount?: number | null;
      }> = [];

      if (three && thirdRosterId != null) {
        const alive = new Set(involvedIds);
        const pushDirected = (
          from: number,
          players: DirectedPlayer[],
          picks: DirectedPick[],
          faab: DirectedFaab | null,
          faabCap: number | null,
          label: string,
        ) => {
          for (const a of players) {
            if (!alive.has(a.to) || a.to === from) {
              throw new Error("An asset points at a team no longer in the deal.");
            }
            assets.push({
              fromRoster: from,
              toRoster: a.to,
              kind: "player",
              playerId: a.id,
            });
          }
          for (const a of picks) {
            if (!alive.has(a.to) || a.to === from) {
              throw new Error("An asset points at a team no longer in the deal.");
            }
            assets.push({
              fromRoster: from,
              toRoster: a.to,
              kind: "pick",
              pickNo: a.pickNo,
            });
          }
          if (faab != null && faab.amount > 0) {
            if (!alive.has(faab.to) || faab.to === from) {
              throw new Error("An asset points at a team no longer in the deal.");
            }
            if (faabCap != null && faab.amount > faabCap) {
              throw new Error(`${label} only has $${faabCap} to trade.`);
            }
            assets.push({
              fromRoster: from,
              toRoster: faab.to,
              kind: "faab",
              amount: faab.amount,
            });
          }
        };
        if (mineFaab != null && mineFaab.amount > myFaabFree) {
          throw new Error(`You only have $${myFaabFree} unstaked.`);
        }
        pushDirected(myRosterId, minePlayers, minePicksSel, mineFaab, myFaabFree, "You");
        pushDirected(
          theirRosterId,
          themPlayers,
          themPicksSel,
          themFaab,
          theirFaabFree,
          themName,
        );
        pushDirected(
          thirdRosterId,
          thirdPlayers,
          thirdPicksSel,
          thirdFaab,
          thirdFaabFree,
          thirdName,
        );
      } else {
        if (sendFaab != null && sendFaab > myFaabFree) {
          throw new Error(`You only have $${myFaabFree} unstaked.`);
        }
        if (theirFaabFree != null && getFaab != null && getFaab > theirFaabFree) {
          throw new Error(`They only have $${theirFaabFree} to trade.`);
        }
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
      }
      return proposeTrade({ data: { leagueId, assets } });
    },
    onSuccess: () => {
      toast("Trade proposed.");
      clearTwoTeam();
      clearThreeTeam();
      onProposed?.();
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not propose"),
  });

  function toggleTwoPlayer(side: "send" | "get", id: string) {
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

  function toggleTwoPick(side: "send" | "get", n: number) {
    if (side === "send") {
      setSendPicks((list) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n]));
    } else {
      setGetPicks((list) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n]));
    }
  }

  function setTwoFaab(side: "send" | "get", raw: string) {
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

  function toggleDirectedPlayer(
    list: DirectedPlayer[],
    set: (n: DirectedPlayer[]) => void,
    from: number,
    id: string,
  ) {
    if (list.some((a) => a.id === id)) {
      set(list.filter((a) => a.id !== id));
    } else {
      set([...list, { id, to: defaultDest(from) }]);
    }
  }

  function toggleDirectedPick(
    list: DirectedPick[],
    set: (n: DirectedPick[]) => void,
    from: number,
    pickNo: number,
  ) {
    if (list.some((a) => a.pickNo === pickNo)) {
      set(list.filter((a) => a.pickNo !== pickNo));
    } else {
      set([...list, { pickNo, to: defaultDest(from) }]);
    }
  }

  function cycleDest(from: number, current: number): number {
    const others = involvedIds.filter((id) => id !== from);
    const i = others.indexOf(current);
    return others[(i + 1) % others.length] ?? others[0] ?? current;
  }

  function setDirectedFaab(
    from: number,
    cap: number | null,
    capLabel: string,
    current: DirectedFaab | null,
    setFaab: (n: DirectedFaab | null) => void,
    setErr: (n: string | null) => void,
    raw: string,
  ) {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 3);
    if (digits === "") {
      setFaab(null);
      setErr(null);
      return;
    }
    const amount = Number(digits);
    const to = current?.to ?? defaultDest(from);
    setFaab({ amount, to });
    if (cap != null && amount > cap) {
      setErr(`${capLabel} $${cap}`);
    } else {
      setErr(null);
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

  function resolvePlayers(
    sel: DirectedPlayer[],
    roster: RosterPlayer[],
  ): Array<RosterPlayer & { to: number }> {
    return sel
      .map((a) => {
        const p = roster.find((r) => r.player_id === a.id);
        return p ? { ...p, to: a.to } : null;
      })
      .filter((p): p is RosterPlayer & { to: number } => p != null);
  }

  function resolvePicks(
    sel: DirectedPick[],
    picks: TradeComposerPick[],
  ): Array<TradeComposerPick & { to: number }> {
    return sel
      .map((a) => {
        const p = picks.find((r) => r.pickNo === a.pickNo);
        return p ? { ...p, to: a.to } : null;
      })
      .filter((p): p is TradeComposerPick & { to: number } => p != null);
  }

  const activeRoster =
    rosterTab === "mine"
      ? {
          title: "Your roster",
          players: myRoster,
          picks: myPicks,
          selectedPlayers: minePlayers.map((a) => a.id),
          selectedPicks: minePicksSel.map((a) => a.pickNo),
          onPlayer: (id: string) =>
            toggleDirectedPlayer(minePlayers, setMinePlayers, myRosterId, id),
          onPick: (n: number) =>
            toggleDirectedPick(minePicksSel, setMinePicksSel, myRosterId, n),
        }
      : rosterTab === "them"
        ? {
            title: themName,
            players: theirRoster,
            picks: theirPicks,
            selectedPlayers: themPlayers.map((a) => a.id),
            selectedPicks: themPicksSel.map((a) => a.pickNo),
            onPlayer: (id: string) =>
              toggleDirectedPlayer(themPlayers, setThemPlayers, theirRosterId, id),
            onPick: (n: number) =>
              toggleDirectedPick(themPicksSel, setThemPicksSel, theirRosterId, n),
          }
        : {
            title: thirdName,
            players: thirdRoster,
            picks: thirdPicks,
            selectedPlayers: thirdPlayers.map((a) => a.id),
            selectedPicks: thirdPicksSel.map((a) => a.pickNo),
            onPlayer: (id: string) =>
              toggleDirectedPlayer(thirdPlayers, setThirdPlayers, thirdRosterId!, id),
            onPick: (n: number) =>
              toggleDirectedPick(thirdPicksSel, setThirdPicksSel, thirdRosterId!, n),
          };

  const balanceBlock = (
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
                    {row.slot}: {row.from?.full_name ?? "open"} → {row.to?.full_name ?? "open"}
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
  );

  const submitBtn = (
    <>
      <Button
        className="mt-4 w-full"
        type="button"
        disabled={!hasAsset || faabBlocked || send.isPending}
        onClick={() => send.mutate()}
      >
        {send.isPending ? "Sending…" : "Propose trade"}
      </Button>
      {three ? (
        <p className="mt-2 text-xs text-muted">
          All three teams must accept — nothing moves if one declines.
        </p>
      ) : null}
    </>
  );

  if (!three) {
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
            onPlayer={(id) => toggleTwoPlayer("send", id)}
            onPick={(n) => toggleTwoPick("send", n)}
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
              onFaab={(raw) => setTwoFaab("send", raw)}
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
              onFaab={(raw) => setTwoFaab("get", raw)}
            />

            {balanceBlock}
            {submitBtn}
          </div>

          <RosterPanel
            title={themName}
            players={theirRoster}
            picks={theirPicks}
            selectedPlayers={getPlayers}
            selectedPicks={getPicks}
            projections={projections}
            onPlayer={(id) => toggleTwoPlayer("get", id)}
            onPick={(n) => toggleTwoPick("get", n)}
          />
        </div>
      </div>
    );
  }

  // --- Three-team layout ---
  return (
    <div className="mt-5 space-y-4">
      {countering ? (
        <p className="text-xs text-muted">Countering an existing offer.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: "mine" as const, label: "You" },
                { id: "them" as const, label: themName },
                { id: "third" as const, label: thirdName },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setRosterTab(t.id)}
                className={cn(
                  "h-9 rounded-sm px-3 text-sm",
                  rosterTab === t.id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                )}
              >
                {t.label}
              </button>
            ))}
            {onThirdChange && availableThirds.length > 0 ? (
              <div className="relative ml-1">
                <label className="sr-only" htmlFor="third-team-pick">
                  Third team
                </label>
                <select
                  id="third-team-pick"
                  className="h-9 max-w-[9rem] rounded-sm bg-raised px-2 text-sm text-muted"
                  value={thirdRosterId ?? ""}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) onThirdChange(v);
                  }}
                >
                  {availableThirds.map((p) => (
                    <option key={p.rosterId} value={p.rosterId}>
                      {p.teamName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {onThirdChange ? (
              <button
                type="button"
                className="ml-1 font-mono text-[11px] uppercase text-muted hover:text-fg"
                onClick={() => onThirdChange(null)}
              >
                Remove
              </button>
            ) : null}
          </div>
          <div className="mt-2">
            <RosterPanel
              title={activeRoster.title}
              players={activeRoster.players}
              picks={activeRoster.picks}
              selectedPlayers={activeRoster.selectedPlayers}
              selectedPicks={activeRoster.selectedPicks}
              projections={projections}
              onPlayer={activeRoster.onPlayer}
              onPick={activeRoster.onPick}
            />
          </div>
        </div>

        <div className="rounded-lg bg-raised/60 p-3 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">The deal</p>

          <DealLeg
            title="You send"
            fromRoster={myRosterId}
            players={resolvePlayers(minePlayers, myRoster)}
            picks={resolvePicks(minePicksSel, myPicks)}
            faab={mineFaab}
            faabErr={mineFaabErr}
            faabFree={myFaabFree}
            faabLabel="Your unstaked"
            projections={projections}
            nameOf={nameOf}
            showDest
            onRemovePlayer={(id) => setMinePlayers((l) => l.filter((a) => a.id !== id))}
            onRemovePick={(n) => setMinePicksSel((l) => l.filter((a) => a.pickNo !== n))}
            onCyclePlayer={(id) =>
              setMinePlayers((l) =>
                l.map((a) => (a.id === id ? { ...a, to: cycleDest(myRosterId, a.to) } : a)),
              )
            }
            onCyclePick={(n) =>
              setMinePicksSel((l) =>
                l.map((a) =>
                  a.pickNo === n ? { ...a, to: cycleDest(myRosterId, a.to) } : a,
                ),
              )
            }
            onFaab={(raw) =>
              setDirectedFaab(
                myRosterId,
                myFaabFree,
                `You only have`,
                mineFaab,
                setMineFaab,
                setMineFaabErr,
                raw,
              )
            }
            onCycleFaab={() =>
              setMineFaab((f) =>
                f ? { ...f, to: cycleDest(myRosterId, f.to) } : f,
              )
            }
          />

          <DealLeg
            title={`${themName} sends`}
            fromRoster={theirRosterId}
            players={resolvePlayers(themPlayers, theirRoster)}
            picks={resolvePicks(themPicksSel, theirPicks)}
            faab={themFaab}
            faabErr={themFaabErr}
            faabFree={theirFaabFree}
            faabLabel="Their FAAB"
            projections={projections}
            nameOf={nameOf}
            showDest
            onRemovePlayer={(id) => setThemPlayers((l) => l.filter((a) => a.id !== id))}
            onRemovePick={(n) => setThemPicksSel((l) => l.filter((a) => a.pickNo !== n))}
            onCyclePlayer={(id) =>
              setThemPlayers((l) =>
                l.map((a) =>
                  a.id === id ? { ...a, to: cycleDest(theirRosterId, a.to) } : a,
                ),
              )
            }
            onCyclePick={(n) =>
              setThemPicksSel((l) =>
                l.map((a) =>
                  a.pickNo === n ? { ...a, to: cycleDest(theirRosterId, a.to) } : a,
                ),
              )
            }
            onFaab={(raw) =>
              setDirectedFaab(
                theirRosterId,
                theirFaabFree,
                `They only have`,
                themFaab,
                setThemFaab,
                setThemFaabErr,
                raw,
              )
            }
            onCycleFaab={() =>
              setThemFaab((f) =>
                f ? { ...f, to: cycleDest(theirRosterId, f.to) } : f,
              )
            }
          />

          <DealLeg
            title={`${thirdName} sends`}
            fromRoster={thirdRosterId!}
            players={resolvePlayers(thirdPlayers, thirdRoster)}
            picks={resolvePicks(thirdPicksSel, thirdPicks)}
            faab={thirdFaab}
            faabErr={thirdFaabErr}
            faabFree={thirdFaabFree}
            faabLabel="Their FAAB"
            projections={projections}
            nameOf={nameOf}
            showDest
            onRemovePlayer={(id) => setThirdPlayers((l) => l.filter((a) => a.id !== id))}
            onRemovePick={(n) => setThirdPicksSel((l) => l.filter((a) => a.pickNo !== n))}
            onCyclePlayer={(id) =>
              setThirdPlayers((l) =>
                l.map((a) =>
                  a.id === id ? { ...a, to: cycleDest(thirdRosterId!, a.to) } : a,
                ),
              )
            }
            onCyclePick={(n) =>
              setThirdPicksSel((l) =>
                l.map((a) =>
                  a.pickNo === n ? { ...a, to: cycleDest(thirdRosterId!, a.to) } : a,
                ),
              )
            }
            onFaab={(raw) =>
              setDirectedFaab(
                thirdRosterId!,
                thirdFaabFree,
                `They only have`,
                thirdFaab,
                setThirdFaab,
                setThirdFaabErr,
                raw,
              )
            }
            onCycleFaab={() =>
              setThirdFaab((f) =>
                f ? { ...f, to: cycleDest(thirdRosterId!, f.to) } : f,
              )
            }
          />

          {balanceBlock}
          {submitBtn}
        </div>
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

function DealLeg({
  title,
  fromRoster,
  players,
  picks,
  faab,
  faabErr,
  faabFree,
  faabLabel,
  projections,
  nameOf,
  showDest,
  onRemovePlayer,
  onRemovePick,
  onCyclePlayer,
  onCyclePick,
  onFaab,
  onCycleFaab,
}: {
  title: string;
  fromRoster: number;
  players: Array<RosterPlayer & { to: number }>;
  picks: Array<TradeComposerPick & { to: number }>;
  faab: DirectedFaab | null;
  faabErr: string | null;
  faabFree: number | null;
  faabLabel: string;
  projections: Record<string, Projection>;
  nameOf: (id: number) => string;
  showDest: boolean;
  onRemovePlayer: (id: string) => void;
  onRemovePick: (n: number) => void;
  onCyclePlayer: (id: string) => void;
  onCyclePick: (n: number) => void;
  onFaab: (raw: string) => void;
  onCycleFaab: () => void;
}) {
  void fromRoster;
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
              {showDest ? (
                <DestPill label={nameOf(p.to)} onCycle={() => onCyclePlayer(p.player_id)} />
              ) : null}
            </Chip>
          </li>
        ))}
        {picks.map((p) => (
          <li key={p.pickNo}>
            <Chip onRemove={() => onRemovePick(p.pickNo)}>
              Pick {p.label}
              {showDest ? (
                <DestPill label={nameOf(p.to)} onCycle={() => onCyclePick(p.pickNo)} />
              ) : null}
            </Chip>
          </li>
        ))}
        {!players.length && !picks.length && !(faab != null && faab.amount > 0) ? (
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
            value={faab == null ? "" : String(faab.amount)}
            onChange={(e) => onFaab(e.target.value)}
            className={cn(
              "w-[3.4ch] bg-transparent font-mono text-base font-bold tabular-nums outline-none placeholder:text-faint/60",
              faabErr && "text-loss",
            )}
          />
        </div>
        {showDest && faab != null && faab.amount > 0 ? (
          <DestPill label={nameOf(faab.to)} onCycle={onCycleFaab} />
        ) : null}
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

function DestPill({ label, onCycle }: { label: string; onCycle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onCycle();
      }}
      className="rounded-pill bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent-fg hover:bg-accent/25"
      title="Change destination"
    >
      → {label}
    </button>
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
