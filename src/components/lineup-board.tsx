import { PlayerCell } from "@/components/player-cell";
import { SlotPicker } from "@/components/slot-picker";
import { Badge } from "@/components/ui/badge";
import type { Projection, RosterPlayer, TeamBundle } from "@/lib/data/types";
import { onBye } from "@/lib/league/phase";
import { labeledStartSlots } from "@/lib/league/roster";
import { cn, formatPts } from "@/lib/utils";

/**
 * Owns lineup editing for the whole app. `team/$rosterId` is a read-only view
 * of anybody's roster; this is where a manager actually sets theirs, so the
 * interaction lives in exactly one place.
 */
export function LineupBoard({
  team,
  rosterPositions,
  editable,
  byes,
  week,
  projections,
  busy,
  onOpenPlayer,
  onStart,
  onSit,
}: {
  team: TeamBundle;
  rosterPositions: string[];
  editable: boolean;
  byes?: Record<string, number>;
  week?: number;
  projections?: Record<string, Projection>;
  busy: boolean;
  onOpenPlayer?: (p: RosterPlayer) => void;
  onStart: (
    playerId: string,
    replaceId: string | null,
    slot: string | null,
    name?: string,
    into?: string,
  ) => void;
  onSit: (playerId: string, name?: string) => void;
}) {
  const slots = labeledStartSlots(rosterPositions);
  const starters = team.players.filter((p) => p.slot === "starter");
  const bench = team.players.filter((p) => p.slot === "bench");
  const bySlot = new Map(starters.map((p) => [p.starterSlot ?? "", p]));

  return (
    <section className="rounded-xl bg-surface shadow-[var(--shadow-border)]">
      <header className="flex flex-wrap items-baseline justify-between gap-3 px-5 pt-5 pb-3">
        <h2 className="font-display text-lg font-bold tracking-[-0.03em]">Starting lineup</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          {editable ? `Week ${team.week} · tap a slot` : `Week ${team.week}`}
        </span>
      </header>

      <ul>
        {slots.map(({ label }) => {
          const p = bySlot.get(label);
          const bye = p ? onBye(p, byes, week) : false;
          const broken = !p || isOut(p) || bye;
          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0",
                broken && "bg-[color-mix(in_oklab,var(--alarm)_9%,transparent)]",
              )}
            >
              <span className="w-9 shrink-0 font-mono text-[10px] uppercase tracking-wide text-faint">
                {label}
              </span>
              {p ? (
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep"
                  onClick={() => onOpenPlayer?.(p)}
                >
                  <PlayerCell player={p} compact game={p.game} />
                </button>
              ) : (
                <span className="min-w-0 flex-1 text-sm font-semibold text-loss">Empty</span>
              )}
              {bye ? <Badge tone="loss">Bye</Badge> : null}
              {p?.injury_status ? <Badge tone="loss">{p.injury_status}</Badge> : null}
              <Points player={p} projection={projections?.[p?.player_id ?? ""]} />
              <SlotPicker
                slotLabel={label}
                occupant={p}
                bench={bench}
                disabled={!editable}
                busy={busy}
                projections={projections}
                onChoose={(playerId, name) =>
                  onStart(playerId, p?.player_id ?? null, p ? null : label, name, label)
                }
                onClear={() => {
                  if (p) onSit(p.player_id, p.full_name);
                }}
              />
            </li>
          );
        })}
      </ul>

      <header className="border-t border-line px-5 pt-4 pb-2">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Bench</h3>
      </header>
      <ul className="pb-2">
        {bench.length === 0 ? (
          <li className="px-5 py-3 text-sm text-muted">Nobody on the bench.</li>
        ) : null}
        {bench.map((p) => (
          <li
            key={p.player_id}
            className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0"
          >
            <span className="w-9 shrink-0 font-mono text-[10px] uppercase tracking-wide text-faint">
              {p.position ?? ""}
            </span>
            <button
              type="button"
              className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep"
              onClick={() => onOpenPlayer?.(p)}
            >
              <PlayerCell player={p} compact game={p.game} />
            </button>
            {onBye(p, byes, week) ? <Badge tone="loss">Bye</Badge> : null}
            {p.injury_status ? <Badge tone="loss">{p.injury_status}</Badge> : null}
            <Points player={p} projection={projections?.[p.player_id]} />
          </li>
        ))}
      </ul>

      {editable ? (
        <p className="px-5 pb-4 text-xs text-faint">
          Bench players go in from the slot they can fill, not from here.
        </p>
      ) : null}
    </section>
  );
}

/**
 * Before kickoff there is no score to show, so an em dash reads as missing data
 * when the real answer is "hasn't happened yet". Show the projection instead,
 * dimmed and marked, and switch to the live figure the moment the ball is in
 * the air.
 */
function Points({
  player,
  projection,
}: {
  player: RosterPlayer | undefined;
  projection: Projection | undefined;
}) {
  if (!player) {
    return <span className="w-14 shrink-0 text-right font-mono text-sm text-faint">—</span>;
  }
  const started = player.game?.state === "in" || player.game?.state === "post";
  if (started && player.weekPts != null) {
    return (
      <span className="w-14 shrink-0 text-right font-mono text-sm font-semibold tabular-nums">
        {formatPts(player.weekPts, 1)}
      </span>
    );
  }
  if (!projection || projection.reason === "no-data") {
    return <span className="w-14 shrink-0 text-right font-mono text-sm text-faint">—</span>;
  }
  return (
    <span className="w-14 shrink-0 text-right">
      <span className="block font-mono text-sm tabular-nums text-muted">
        {formatPts(projection.points, 1)}
      </span>
      <span className="block font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
        {projection.reason === "bye" ? "bye" : projection.reason === "out" ? "out" : "proj"}
      </span>
    </span>
  );
}

const OUT = new Set(["out", "ir", "doubtful", "suspended", "pup", "na"]);
function isOut(p: RosterPlayer): boolean {
  const s = (p.injury_status ?? p.status ?? "").toLowerCase().trim();
  return s.length > 0 && OUT.has(s);
}
