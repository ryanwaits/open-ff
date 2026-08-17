import type { DispatchVoice } from "./dispatch";

/** Fill this in later — nicknames, bits, and per-team notes the desk can quote. */
export type TeamNote = {
  /** One line the desk may use as color. Empty until you write it. */
  note?: string;
};

export const WIFFL_VOICE: DispatchVoice & { teamNotes: Record<string, TeamNote> } = {
  nicknames: {},
  bits: [],
  teamNotes: {
    Chumheads: {},
    Shardbearer: {},
    "Blade BMs": {},
    "Chamba-Flav": {},
    "Necked Ninja": {},
    hands: {},
    "6 Pack Jack": {},
    "Baby PJ": {},
    Butterbean: {},
    Hypergonad: {},
    MSDoss: {},
    Strigiformes: {},
    "The Truth": {},
    Coinshot: {},
  },
};

export function voicePack(leagueName: string) {
  if (/wiffl/i.test(leagueName)) return WIFFL_VOICE;
  return { nicknames: {}, bits: [], teamNotes: {} as Record<string, TeamNote> };
}
