import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEMO_HOSTED_ID, DEMO_HOSTED_NAME } from "@/lib/data/types";

export type SavedLeague = {
  leagueId: string;
  name: string;
  season: string;
};

type LeagueStore = {
  recent: SavedLeague[];
  remember: (league: SavedLeague) => void;
  hasHydrated: boolean;
};

export const useLeagueStore = create<LeagueStore>()(
  persist(
    (set, get) => ({
      recent: [
        { leagueId: DEMO_HOSTED_ID, name: DEMO_HOSTED_NAME, season: "2025" },
      ],
      hasHydrated: false,
      remember: (league) => {
        const next = [
          league,
          ...get().recent.filter((r) => r.leagueId !== league.leagueId),
        ].slice(0, 8);
        set({ recent: next });
      },
    }),
    {
      name: "ledger-leagues",
      partialize: (s) => ({ recent: s.recent }),
      onRehydrateStorage: () => () => {
        useLeagueStore.setState({ hasHydrated: true });
      },
    },
  ),
);
