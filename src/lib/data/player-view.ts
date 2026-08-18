import { useQuery } from "@tanstack/react-query";
import { getPlayerProfile } from "./fns";
import { dstLabel, playerHeadshot, teamLogo } from "./teams";
import type { SlimPlayer } from "./types";

export type Profile = NonNullable<Awaited<ReturnType<typeof getPlayerProfile>>>;

export function usePlayerProfile(leagueId: string, playerId: string) {
  return useQuery({
    queryKey: ["player-profile", leagueId, playerId],
    queryFn: () => getPlayerProfile({ data: { leagueId, playerId } }),
  });
}

export function headshotFor(player: SlimPlayer): string | null {
  return player.position === "DEF"
    ? teamLogo(player.team ?? player.player_id)
    : playerHeadshot(player.player_id, player.espn_id);
}

export function displayName(player: SlimPlayer): string {
  return player.position === "DEF" && player.team ? dstLabel(player.team) : player.full_name;
}
