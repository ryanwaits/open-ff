import type { DispatchVoice } from "./dispatch";

/** Fill this in later — nicknames, bits, and per-team notes the desk can quote. */
export type TeamNote = {
  /** One line the desk may use as color. Empty until you write it. */
  note?: string;
};

export const WIFFL_VOICE: DispatchVoice & { teamNotes: Record<string, TeamNote> } = {
  nicknames: {
    Chumheads: ["Chums", "Chumheads"],
    Shardbearer: ["Shardbearer"],
    "Blade BMs": ["Blade", "Blade BMs"],
    "Chamba-Flav": ["Chamba", "Chamba-Flav"],
    "Necked Ninja": ["Necked", "Necked Ninja"],
    hands: ["Hands", "Panda", "Hands of Panda"],
    Hypergonad: ["Gonads", "Hypergonad"],
    "6 Pack Jack": ["6 Pack", "6 Pack Jack"],
    "Baby PJ": ["Baby PJ", "PJs"],
    Butterbean: ["Butterbean"],
    MSDoss: ["MSDoss"],
    Strigiformes: ["Strigiformes"],
    "The Truth": ["The Truth"],
    Coinshot: ["Coinshot"],
  },
  bits: [
    "Unofficial map: the west is Chumheads, Hands, and Hypergonad; the gulf includes 6 Pack and Baby PJ; the south includes Butterbean.",
    "The west has taken something like 70–80% of the titles. Everyone hates them for it; they lean into being hated. Hypergonad is the villain; Hands is the one they tolerate.",
    "Hands and Hypergonad are tied or one cup apart for most championships — the feud is the league's actual plot.",
  ],
  teamNotes: {
    Chumheads: {
      note: "Chums — retired Southwest pilot, Florida, no filter, the unhinged seat of the west.",
    },
    Shardbearer: {
      note: "Strigiformes' kid, already flipping the wire (Stroud, Freiermuth, Zvada).",
    },
    "Blade BMs": {
      note: "Blade — the doctor; his tree is Strigiformes, Butterbean, and Necked (a grandson's seat this year).",
    },
    "Chamba-Flav": {
      note: "Chamba — retired pet vet; his tree is MSDoss, 6 Pack, and Baby PJ.",
    },
    "Necked Ninja": {
      note: "A grandson running Necked this year; the old manager is still in the chat, not on the card.",
    },
    hands: {
      note: "Hands, sometimes Panda — co-commish with Hypergonad, west seat, the polite half of the feud and still the second-most disliked.",
    },
    "6 Pack Jack": {
      note: "Hands' cousin, gulf seat.",
    },
    "Baby PJ": {
      note: "Another Hands cousin, gulf, a lawyer — the name is a Christmas joke about kids in pajamas that the league will not let die.",
    },
    Butterbean: {
      note: "Hands' cousin, south seat — cares a lot, never won a title.",
    },
    Hypergonad: {
      note: "Hands' brother, co-commish, west — cocky on purpose, probably the most hated seat in the league, maybe one cup ahead in the feud.",
    },
    MSDoss: {
      note: "Hands' cousin, Chamba's tree.",
    },
    Strigiformes: {
      note: "Hands' cousin, Blade's tree, a doctor — locked in of late, no title on the books that anyone can remember.",
    },
    "The Truth": {
      note: "Hypergonad's kid, first year — cares a ton, the baseball player.",
    },
    Coinshot: {
      note: "Strigiformes' kid, a few years in, locked in, no title yet.",
    },
  },
};

export function voicePack(leagueName: string) {
  if (/wiffl/i.test(leagueName)) return WIFFL_VOICE;
  return { nicknames: {}, bits: [], teamNotes: {} as Record<string, TeamNote> };
}
