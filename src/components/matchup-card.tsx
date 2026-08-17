import { Link } from "@tanstack/react-router";
import type { MatchupPair, MatchupSide } from "@/lib/data/types";
import { cn, formatPts, initials } from "@/lib/utils";

function Side({
  side,
  align,
  leading,
}: {
  side: MatchupSide;
  align: "left" | "right";
  leading: boolean;
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2.5",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-raised text-xs">
        {side.avatar ? (
          <img src={side.avatar} alt="" className="size-full object-cover" />
        ) : (
          initials(side.teamName)
        )}
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate text-sm", leading ? "text-fg" : "text-muted")}>
          {side.teamName}
        </span>
        <span className="block truncate font-mono text-[11px] text-faint">{side.manager}</span>
      </span>
    </span>
  );
}

export function MatchupCard({
  pair,
  leagueId,
  week,
}: {
  pair: MatchupPair;
  leagueId: string;
  week: number;
}) {
  const away = pair.away;
  const homeLeads = !away || pair.home.points >= away.points;
  const decided = pair.home.points > 0 || (away?.points ?? 0) > 0;
  return (
    <Link
      to="/league/$leagueId/matchup/$week/$matchupId"
      params={{ leagueId, week: String(week), matchupId: String(pair.matchupId) }}
      className="block rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
    >
      <div className="flex items-center gap-3">
        <Side side={pair.home} align="left" leading={homeLeads && decided} />
        <div className="shrink-0 text-center">
          <div className="font-mono text-lg tabular-nums">
            <span className={homeLeads && decided ? "text-fg" : "text-muted"}>
              {formatPts(pair.home.points, 1)}
            </span>
            <span className="mx-1 text-faint">–</span>
            <span className={!homeLeads && decided ? "text-fg" : "text-muted"}>
              {formatPts(away?.points ?? 0, 1)}
            </span>
          </div>
        </div>
        {away ? (
          <Side side={away} align="right" leading={!homeLeads && decided} />
        ) : (
          <div className="flex-1 text-right text-sm text-faint">Bye</div>
        )}
      </div>
    </Link>
  );
}
