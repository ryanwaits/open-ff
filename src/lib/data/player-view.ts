import { useQuery } from "@tanstack/react-query";
import { getPlayerProfile } from "./fns";
import { dstLabel, playerHeadshot, playerTeam, teamLogo } from "./teams";
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
    ? teamLogo(playerTeam(player))
    : playerHeadshot(player.player_id, player.espn_id);
}

export function displayName(player: SlimPlayer): string {
  const team = playerTeam(player);
  return player.position === "DEF" && team ? dstLabel(team) : player.full_name;
}
