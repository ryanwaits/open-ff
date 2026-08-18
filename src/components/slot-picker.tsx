import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, CircleMinus, Pencil } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { InjuryMark } from "@/components/player-cell";
import { dstLabel, playerHeadshot, teamLogo } from "@/lib/data/teams";
import type { Projection, RosterPlayer } from "@/lib/data/types";
import { slotAccepts } from "@/lib/league/roster";
import { cn, formatPts } from "@/lib/utils";

/**
 * Choosing who fills a slot is a one-step decision, so it gets a one-step
 * control. The old flow was pick-a-player, then hunt for a target, which meant
 * holding the rule about which positions fit a slot in your head. Here the
 * slot asks the question and only offers answers that are legal.
 */
export function SlotPicker({
  slotLabel,
  occupant,
  bench,
  disabled,
  busy,
  projections,
  onChoose,
  onClear,
}: {
  slotLabel: string;
  occupant: RosterPlayer | undefined;
  bench: RosterPlayer[];
  disabled: boolean;
  busy: boolean;
  projections?: Record<string, Projection>;
  /** Put this player in the slot, replacing whoever is there. */
  onChoose: (playerId: string, name: string) => void;
  /** Send the current occupant to the bench, leaving the slot empty. */
  onClear: () => void;
}) {
  // Ranked by the same projection the lineup shows, so the best option is
  // always the top one.
  const value = (p: RosterPlayer) =>
    projections?.[p.player_id]?.points ?? p.weekPts ?? 0;
  const eligible = bench
    .filter((p) => slotAccepts(p.position, slotLabel))
    .sort((a, b) => value(b) - value(a));

  if (disabled) return null;

  return (
    <DropdownMenu.Root>
      {/* An explicit control, not a whole-row affordance: tapping the player
          opens their profile, tapping edit changes who is in the slot. */}
      <DropdownMenu.Trigger
        disabled={busy}
        aria-label={`Change who starts at ${slotLabel}`}
        title={`Change ${slotLabel}`}
        className="grid size-9 shrink-0 place-items-center rounded-pill border border-line text-faint transition-colors duration-150 hover:border-line-strong hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep disabled:opacity-50 data-[state=open]:border-accent-deep data-[state=open]:bg-raised data-[state=open]:text-fg"
      >
        <Pencil className="size-3.5" strokeWidth={2} />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "z-50 max-h-[min(22rem,60vh)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain",
            "rounded-lg border border-line bg-surface p-1 shadow-[var(--shadow-lift)]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <DropdownMenu.Label className="px-3 pt-2 pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            Starting at {slotLabel}
          </DropdownMenu.Label>

          {occupant ? (
            <Row
              player={occupant}
              current
              onSelect={() => {}}
              actionLabel="Starting now"
              projection={projections?.[occupant.player_id]}
            />
          ) : null}

          {eligible.length > 0 ? (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Label className="px-3 pt-1 pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                From the bench
              </DropdownMenu.Label>
              {eligible.map((p) => (
                <Row
                  key={p.player_id}
                  player={p}
                  onSelect={() => onChoose(p.player_id, p.full_name)}
                  projection={projections?.[p.player_id]}
                />
              ))}
            </>
          ) : (
            <p className="px-3 py-3 text-sm text-muted">
              Nobody on your bench can play {slotLabel}.
            </p>
          )}

          {/* Emptying a slot is a real intent, not a side effect of swapping.
              It gets its own item, its own words, and a rule above it. */}
          {occupant ? (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item
                onSelect={onClear}
                className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-loss outline-none data-[highlighted]:bg-loss/10"
              >
                <span className="grid size-8 shrink-0 place-items-center">
                  <CircleMinus className="size-4" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Bench {occupant.full_name}</span>
                  <span className="block font-mono text-[10px] uppercase tracking-wide text-faint">
                    Leaves {slotLabel} empty
                  </span>
                </span>
              </DropdownMenu.Item>
            </>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Row({
  player,
  current = false,
  onSelect,
  actionLabel,
  projection,
}: {
  player: RosterPlayer;
  current?: boolean;
  onSelect: () => void;
  actionLabel?: string;
  projection?: Projection;
}) {
  const isDef = player.position === "DEF";
  const src = isDef
    ? teamLogo(player.team ?? player.player_id)
    : playerHeadshot(player.player_id, player.espn_id);
  const name = isDef && player.team ? dstLabel(player.team) : player.full_name;
  const meta = [player.position, player.team, player.game?.detail].filter(Boolean).join(" · ");

  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm outline-none",
        "data-[highlighted]:bg-raised",
      )}
    >
      <Avatar src={src} name={name} className="size-8" textClassName="text-[10px]" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium">{name}</span>
          {current ? <Check className="size-3.5 shrink-0 text-accent-strong" strokeWidth={3} /> : null}
        </span>
        <span className="block truncate font-mono text-[10px] uppercase tracking-wide text-faint">
          {actionLabel ?? meta}
        </span>
      </span>
      <InjuryMark status={player.injury_status} />
      <span className="shrink-0 text-right">
        <span className="block font-mono text-sm tabular-nums text-muted">
          {started(player) && player.weekPts != null
            ? formatPts(player.weekPts, 1)
            : projection && projection.reason !== "no-data"
              ? formatPts(projection.points, 1)
              : "—"}
        </span>
        {!started(player) && projection && projection.reason !== "no-data" ? (
          <span className="block font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
            {projection.reason ?? "proj"}
          </span>
        ) : null}
      </span>
    </DropdownMenu.Item>
  );
}

function started(p: RosterPlayer): boolean {
  return p.game?.state === "in" || p.game?.state === "post";
}
