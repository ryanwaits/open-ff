import type { MatchupSide, RosterPlayer } from "@/lib/data/types";
import { demoAvailable } from "@/lib/demo/store";
import type { LineupHealth, LineupIssue, Phase } from "./phase";

/**
 * A dev-only override for the week phase, so the states the hero can be in are
 * reviewable without waiting for a Sunday.
 *
 * `resolvePhase` reads the real NFL scoreboard, which means four of the five
 * moods are unreachable for eight months of the year and the fifth is
 * unreachable for the other four. This substitutes the derived inputs — phase,
 * lineup health, draft status, the two scores — and nothing else. Every query,
 * mutation and roster on the page stays real, so what you are looking at is the
 * actual component in the actual layout, not a mock.
 *
 * Guarded twice. The parser refuses to return a state outside a dev build, so a
 * stray `?state=live` in a shared URL is inert in production; and the caller
 * passes `undefined` unless demo mode is switched on, so the param is inert in
 * a dev build too until somebody asks for it. Parsing stays free of the demo
 * store on purpose — `validateSearch` runs during SSR, where a localStorage
 * preference does not exist yet, and stripping the param on the server only to
 * put it back on the client is a hydration mismatch waiting to happen.
 */
export const PROTOTYPE_STATES = [
  "draft",
  "preseason",
  "midweek",
  "gameday",
  "broken",
  "live",
  "settled",
] as const;

export type PrototypeState = (typeof PROTOTYPE_STATES)[number];

/** What each state is for, shown in the switcher. */
export const PROTOTYPE_LABELS: Record<PrototypeState, string> = {
  draft: "board is open",
  preseason: "quiet — hero hidden",
  midweek: "quiet — hero hidden",
  gameday: "quiet — hero hidden",
  broken: "alarm — slots need you",
  live: "scoreboard",
  settled: "week final",
};

export function parsePrototypeState(v: unknown): PrototypeState | undefined {
  if (!demoAvailable || typeof v !== "string") return undefined;
  return (PROTOTYPE_STATES as readonly string[]).includes(v) ? (v as PrototypeState) : undefined;
}

export type PrototypeInput = {
  phase: Phase;
  health: LineupHealth;
  draftStatus: "none" | "pending" | "live" | "complete";
  me: MatchupSide | null;
  them: MatchupSide | null;
  /** Real starters, borrowed to make the fake issues name real players. */
  starters: RosterPlayer[];
  /** Real auto-fill plan length. */
  fixable: number;
};

export type PrototypeOutput = Omit<PrototypeInput, "starters">;

const HEALTHY = (yetToPlay: number): LineupHealth => ({
  issues: [],
  yetToPlay,
  ok: true,
});

/**
 * A settled or live hero needs two scores to say anything. In the preseason both
 * sides are 0-0, which the real component correctly treats as "not played" — so
 * the override supplies a plausible pair rather than rendering an empty shell.
 */
function scored(side: MatchupSide | null, points: number): MatchupSide | null {
  if (!side) return null;
  return side.points > 0 ? side : { ...side, points };
}

/** With no state forced, the real inputs pass straight through. */
export function applyPrototype(
  state: PrototypeState | undefined,
  input: PrototypeInput,
): PrototypeOutput {
  const { health, me, them, starters, fixable } = input;
  if (!state || !demoAvailable) {
    return {
      phase: input.phase,
      health,
      draftStatus: input.draftStatus,
      me,
      them,
      fixable,
    };
  }
  const base: PrototypeOutput = {
    phase: input.phase,
    health: HEALTHY(health.yetToPlay),
    draftStatus: "complete",
    me,
    them,
    fixable,
  };

  switch (state) {
    case "draft":
      return { ...base, phase: "preseason", draftStatus: "live" };
    case "preseason":
      return { ...base, phase: "preseason" };
    case "midweek":
      return { ...base, phase: "midweek" };
    case "gameday":
      return { ...base, phase: "gameday" };
    case "broken": {
      const issues = fakeIssues(starters);
      return {
        ...base,
        phase: "gameday",
        health: { issues, yetToPlay: health.yetToPlay, ok: false },
        // The real plan is empty in a healthy lineup, which would show the
        // fallback CTA. Force the primary so the alarm reads as intended.
        fixable: Math.max(fixable, 1),
      };
    }
    case "live":
      return {
        ...base,
        phase: "live",
        health: HEALTHY(Math.max(health.yetToPlay, 4)),
        me: scored(me, 96.4),
        them: scored(them, 88.1),
      };
    case "settled":
      return {
        ...base,
        phase: "settled",
        health: HEALTHY(0),
        me: scored(me, 118.4),
        them: scored(them, 96.2),
      };
  }
}

/** One empty slot and one bye, named after whoever is actually starting. */
function fakeIssues(starters: RosterPlayer[]): LineupIssue[] {
  const issues: LineupIssue[] = [
    { slot: "FLEX", kind: "empty", player: null, reason: "No starter" },
  ];
  const victim = starters[0];
  if (victim) {
    issues.push({
      slot: victim.starterSlot ?? victim.position ?? "WR",
      kind: "bye",
      player: victim,
      reason: "BYE",
    });
  }
  return issues;
}
