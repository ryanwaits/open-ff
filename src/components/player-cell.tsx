import { Avatar } from "@/components/avatar";
import { playerHeadshot, teamLogo } from "@/lib/data/teams";
import type { GameChip, SlimPlayer } from "@/lib/data/types";
import { cn } from "@/lib/utils";

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
      <Avatar
        src={src}
        name={name}
        className={compact ? "size-8" : "size-9"}
        textClassName="text-[10px]"
      >
        {game?.state === "in" ? (
          <span className="absolute right-0.5 bottom-0.5 size-1.5 rounded-pill bg-live ring-2 ring-bg" />
        ) : null}
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-fg">{name}</span>
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
