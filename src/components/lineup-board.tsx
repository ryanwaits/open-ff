import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { PlayerCell } from "@/components/player-cell";
import { SlotPicker } from "@/components/slot-picker";
import { Badge } from "@/components/ui/badge";
import type { Projection, RosterPlayer, TeamBundle } from "@/lib/data/types";
import { onBye } from "@/lib/league/phase";
import { labeledStartSlots, slotAccepts } from "@/lib/league/roster";
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

  /**
   * A bench player you have picked up but not yet put down.
   *
   * The slot picker asks "who fills this slot"; this asks the same question from
   * the other end, because you usually decide you want a player in before you
   * decide who he displaces. While someone is armed, the slots he can legally
   * take light up and the rest go quiet, so the rule is shown rather than
   * remembered.
   */
  const [picked, setPicked] = useState<RosterPlayer | null>(null);
  const [targetSlot, setTargetSlot] = useState<string | null>(null);

  // Derived rather than stored, so the moment the swap lands — or the week turns,
  // or the roster is someone else's — he is no longer on the bench and the board
  // drops out of this mode without an effect having to notice.
  const armed =
    picked && editable && bench.some((p) => p.player_id === picked.player_id) ? picked : null;

  const cancel = () => {
    setPicked(null);
    setTargetSlot(null);
  };
  const arm = (p: RosterPlayer | null) => {
    setPicked(p);
    setTargetSlot(null);
  };

  useEffect(() => {
    if (!armed) return;
    // The setters are stable, so this binds once per arming rather than per render.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPicked(null);
        setTargetSlot(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed]);

  const outgoing = targetSlot ? bySlot.get(targetSlot) : undefined;

  const confirm = () => {
    if (!armed || !targetSlot) return;
    onStart(
      armed.player_id,
      outgoing?.player_id ?? null,
      outgoing ? null : targetSlot,
      armed.full_name,
      targetSlot,
    );
    cancel();
  };

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
          const takes = armed ? slotAccepts(armed.position, label) : false;
          const chosen = targetSlot === label;
          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0",
                broken && !armed && "bg-[color-mix(in_oklab,var(--alarm)_9%,transparent)]",
                // While a player is armed the board answers one question only, so
                // slots he cannot take recede rather than compete for the press.
                armed && !takes && "opacity-40",
                chosen && "bg-[color-mix(in_oklab,var(--brand)_14%,transparent)]",
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
              {armed ? (
                <button
                  type="button"
                  disabled={!takes || busy}
                  aria-pressed={chosen}
                  onClick={() => setTargetSlot(chosen ? null : label)}
                  className={cn(
                    "shrink-0 rounded-pill px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide transition-colors duration-150",
                    !takes && "text-faint",
                    takes && chosen && "bg-accent text-accent-fg",
                    takes && !chosen && "text-accent-strong shadow-[0_0_0_1px_var(--color-accent-deep)] hover:bg-raised",
                  )}
                >
                  {!takes ? "No" : chosen ? "Chosen" : p ? "Swap in" : "Put here"}
                </button>
              ) : (
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
              )}
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
        {bench.map((p) => {
          const isArmed = armed?.player_id === p.player_id;
          const canStart = slots.some(({ label }) => slotAccepts(p.position, label));
          return (
            <li
              key={p.player_id}
              className={cn(
                "flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0",
                isArmed && "bg-[color-mix(in_oklab,var(--brand)_14%,transparent)]",
                armed && !isArmed && "opacity-40",
              )}
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
              {editable && canStart ? (
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={isArmed}
                  aria-label={isArmed ? `Cancel starting ${p.full_name}` : `Start ${p.full_name}`}
                  onClick={() => arm(isArmed ? null : p)}
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-pill transition-colors duration-150",
                    isArmed
                      ? "bg-accent text-accent-fg"
                      : "text-faint hover:bg-raised hover:text-fg",
                  )}
                >
                  <ArrowUp className="size-4" strokeWidth={2.4} />
                </button>
              ) : (
                <span className="size-8 shrink-0" />
              )}
            </li>
          );
        })}
      </ul>

      {/* Pinned rather than placed. The slot you are aiming at can be a screen
          away from the bench row you started from, so the thing that commits the
          swap follows you instead of waiting where you left it. */}
      {armed ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-40 flex justify-center px-4 md:bottom-6">
          <div className="flex w-full max-w-md items-center gap-3 rounded-pill bg-surface px-4 py-2.5 shadow-[0_0_0_1px_var(--color-line-strong),var(--shadow-lift)]">
            <span className="min-w-0 flex-1 text-sm leading-tight">
              {targetSlot ? (
                <>
                  <span className="font-semibold">{armed.full_name}</span>
                  <span className="text-muted"> into </span>
                  <span className="font-mono text-xs uppercase">{targetSlot}</span>
                  {outgoing ? (
                    <span className="block truncate font-mono text-[10px] uppercase tracking-wide text-faint">
                      {outgoing.full_name} to the bench
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="font-semibold">{armed.full_name}</span>
                  <span className="block font-mono text-[10px] uppercase tracking-wide text-faint">
                    Pick a lit slot
                  </span>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={cancel}
              className="shrink-0 rounded-pill px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-muted hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!targetSlot || busy}
              onClick={confirm}
              className="push shrink-0 rounded-pill bg-accent px-4 py-2 text-sm font-bold text-accent-fg disabled:pointer-events-none disabled:opacity-45"
            >
              {busy ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
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
