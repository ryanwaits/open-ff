import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getPlayerProfile } from "./fns";
import { dstLabel, playerHeadshot, playerTeam, teamLogo } from "./teams";
import type { SlimPlayer, TeamBundle, WirePlayer } from "./types";

export type Profile = NonNullable<Awaited<ReturnType<typeof getPlayerProfile>>>;

export const PROFILE_STALE_MS = 5 * 60 * 1000;

export function profileQueryKey(leagueId: string, playerId: string) {
  return ["player-profile", leagueId, playerId] as const;
}

export function profileQueryOptions(leagueId: string, playerId: string) {
  return {
    queryKey: profileQueryKey(leagueId, playerId),
    queryFn: () => getPlayerProfile({ data: { leagueId, playerId } }),
    staleTime: PROFILE_STALE_MS,
  };
}

export function prefetchPlayerProfile(client: QueryClient, leagueId: string, playerId: string) {
  return client.prefetchQuery(profileQueryOptions(leagueId, playerId));
}

/** Hover / press start — same player the click is about to open. */
export function profileIntent(client: QueryClient, leagueId: string, playerId: string) {
  return {
    onPointerEnter: () => {
      void prefetchPlayerProfile(client, leagueId, playerId);
    },
    onPointerDown: () => {
      void prefetchPlayerProfile(client, leagueId, playerId);
    },
    onFocus: () => {
      void prefetchPlayerProfile(client, leagueId, playerId);
    },
  };
}

export function usePlayerProfile(leagueId: string, playerId: string) {
  return useQuery(profileQueryOptions(leagueId, playerId));
}

/** Identity from a profile we already have, or the roster/wire row that opened this. */
export function findCachedSlimPlayer(
  client: QueryClient,
  leagueId: string,
  playerId: string,
): SlimPlayer | null {
  const profile = client.getQueryData<Profile>(profileQueryKey(leagueId, playerId));
  if (profile?.player) return profile.player;
  for (const q of client.getQueryCache().findAll({ queryKey: ["team", leagueId] })) {
    const hit = (q.state.data as TeamBundle | undefined)?.players.find(
      (p) => p.player_id === playerId,
    );
    if (hit) return hit;
  }
  for (const q of client.getQueryCache().findAll({ queryKey: ["wire", leagueId] })) {
    const hit = (q.state.data as WirePlayer[] | undefined)?.find((p) => p.player_id === playerId);
    if (hit) return hit;
  }
  return null;
}

/** Background-warm the lineup so the drawer is a cache hit. Stagger so paint stays first. */
export function useWarmRosterProfiles(leagueId: string, playerIds: string[] | undefined) {
  const qc = useQueryClient();
  const key = playerIds?.join("\0") ?? "";
  useEffect(() => {
    if (!key || typeof window === "undefined") return;
    const ids = key.split("\0");
    const timers = ids.slice(0, 16).map((id, i) =>
      window.setTimeout(
        () => {
          void prefetchPlayerProfile(qc, leagueId, id);
        },
        250 + i * 90,
      ),
    );
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [qc, leagueId, key]);
}

export function headshotFor(player: SlimPlayer): string | null {
  return player.position === "DEF"
    ? teamLogo(playerTeam(player))
    : playerHeadshot(player.player_id, player.espn_id);
}

export function displayName(player: SlimPlayer): string {
  const team = playerTeam(player);
  return player.position === "DEF" && team ? dstLabel(team) : player.full_name;
}
