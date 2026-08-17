import { playerHeadshot, teamLogo } from "@/lib/data/teams";
import type { GameChip, SlimPlayer } from "@/lib/data/types";
import { cn, initials } from "@/lib/utils";

export function PlayerCell({
  player,
  empty = "Empty",
  compact = false,
  game = null,
  align = "left",
  line = null,
}: {
  player: SlimPlayer | null | undefined;
  empty?: string;
  compact?: boolean;
  game?: GameChip | null;
  align?: "left" | "right";
  line?: string | null;
}) {
  if (!player) {
    return <span className="text-sm text-faint">{empty}</span>;
  }
  const isDef = player.position === "DEF";
  const src = isDef
    ? teamLogo(player.team ?? player.player_id)
    : playerHeadshot(player.player_id, player.espn_id);
  const name =
    isDef && player.team ? `${player.team} D/ST` : player.full_name;
  const meta = [player.position, player.team].filter(Boolean).join(" · ");

  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <span
        className={cn(
          "relative shrink-0 overflow-hidden rounded-sm bg-raised",
          compact ? "size-8" : "size-9",
        )}
      >
        {src ? (
          <img
            src={src}
            alt=""
            className="size-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <span className="absolute inset-0 grid place-items-center font-mono text-[10px] text-muted">
          {initials(name)}
        </span>
        {game?.state === "in" ? (
          <span className="absolute right-0.5 bottom-0.5 size-1.5 rounded-full bg-live" />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-fg">{name}</span>
        <span className="block truncate font-mono text-[11px] uppercase tracking-wide text-faint">
          {meta}
          {gameLabel(game)}
        </span>
        {line ? (
          <span className="mt-0.5 block truncate font-mono text-[11px] text-muted normal-case tracking-normal">
            {line}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function gameLabel(game: GameChip | null) {
  if (!game) return null;
  const bits = [game.opp, game.detail].filter(Boolean);
  if (!bits.length) return null;
  return (
    <span className={game.state === "in" ? "text-live" : undefined}>
      {" · "}
      {bits.join(" · ")}
    </span>
  );
}
