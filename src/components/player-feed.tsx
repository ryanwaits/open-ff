import { injuryMark } from "@/components/player-cell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { playerSearchKeys } from "@/lib/data/player-plays";
import type { ActivityItem, NewsItem, RosterPlayer } from "@/lib/data/types";
import type { Phase } from "@/lib/league/phase";
import { formatAgo, formatPts } from "@/lib/utils";

/**
 * Before kickoff this is a status board, not a scoreboard.
 *
 * Sleeper's daily map is the record of *what* changed (`injury_status`,
 * body part, `news_updated`). RotoWire supplies *why* when the five-item
 * window caught that player. ESPN league headlines only appear if they
 * actually name someone on this roster.
 *
 *   before kickoff  designations, then blurbs, then league moves, then ESPN
 *   live / settled  what your starters actually did, best first
 */
export function PlayerFeed({
  phase,
  players,
  activity,
  news,
  loading,
}: {
  phase: Phase;
  players: RosterPlayer[];
  activity: ActivityItem[];
  news: NewsItem[];
  loading: boolean;
}) {
  const rows =
    phase === "live" || phase === "settled"
      ? scoringRows(players)
      : statusRows(players, activity, news);

  return (
    <section className="rounded-xl bg-surface shadow-[var(--shadow-border)]">
      <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
        <h2 className="font-display text-lg font-bold tracking-[-0.03em]">Your players</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          {phase === "live" || phase === "settled" ? "This week" : "Status"}
        </span>
      </header>
      {loading ? (
        <div className="space-y-2 px-5 pb-5">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted">
          Nothing flagged on your roster. Quiet is good.
        </p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0"
            >
              {/* The name leads. Leading with the chip let a long designation
                  push the names right, so no two started at the same place. */}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{r.title}</span>
                <span className="block text-[13px] text-muted">{r.detail}</span>
              </span>
              {r.tag ? (
                <Badge tone={r.tone} className="shrink-0">
                  {r.tag}
                </Badge>
              ) : null}
              {r.value ? (
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                  {r.value}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Row = {
  id: string;
  tag: string | null;
  tone: "loss" | "win" | "default" | "warn";
  title: string;
  detail: string;
  value?: string;
};

/** Live and settled: what your starters actually did. */
function scoringRows(players: RosterPlayer[]): Row[] {
  return players
    .filter((p) => p.slot === "starter" && p.weekPts != null)
    .sort((a, b) => (b.weekPts ?? 0) - (a.weekPts ?? 0))
    .slice(0, 6)
    .map((p) => ({
      id: p.player_id,
      tag: p.starterSlot ?? p.position ?? null,
      tone: "default" as const,
      title: p.full_name,
      detail: [p.team, p.game?.detail].filter(Boolean).join(" · ") || "No game data",
      value: formatPts(p.weekPts, 1),
    }));
}

/** Before kickoff: what might cost you points. */
function statusRows(players: RosterPlayer[], activity: ActivityItem[], news: NewsItem[]): Row[] {
  const rows: Row[] = [];
  const mine = players.filter((p) => p.slot !== "taxi");

  for (const p of mine) {
    const s = (p.injury_status ?? "").trim();
    if (!s && !p.latest_note) continue;
    const mark = injuryMark(s);
    const detail = [
      p.injury_body_part,
      formatAgo(p.latest_note?.date ?? p.news_updated),
      p.latest_note?.headline ?? p.injury_notes ??
        (p.slot === "starter" ? `starting at ${p.starterSlot}` : "on your bench"),
    ]
      .filter(Boolean)
      .join(" · ");
    rows.push({
      id: `status-${p.player_id}`,
      tag: mark?.label ?? (s ? s.toUpperCase() : "Note"),
      tone: mark?.tone ?? "default",
      title: p.full_name,
      detail,
    });
  }
  // Ruled out first: those are decisions, the rest are just weather.
  rows.sort((a, b) => Number(b.tone === "loss") - Number(a.tone === "loss"));

  const ids = new Set(mine.map((p) => p.player_id));
  for (const item of activity.slice(0, 12)) {
    const add = item.adds.find((a) => ids.has(a.playerId));
    const drop = item.drops.find((d) => ids.has(d.playerId));
    const hit = add ?? drop;
    if (!hit) continue;
    rows.push({
      id: `move-${item.id}-${hit.playerId}`,
      tag: add ? "Add" : "Drop",
      tone: "default",
      title: hit.name,
      detail: `${item.teamNames.join(", ") || "Someone"} · ${item.type}${item.bid ? ` · $${item.bid}` : ""}`,
    });
  }

  // ESPN's feed is league-wide, so only surface a headline when it actually
  // names somebody on this roster.
  const keys = mine.map((p) => ({ p, keys: playerSearchKeys(p) }));
  for (const n of news) {
    const hay = `${n.headline} ${n.description}`.toLowerCase();
    const match = keys.find(({ keys: k }) => k.some((key) => key.length > 4 && hay.includes(key)));
    if (!match) continue;
    rows.push({
      id: `news-${n.id}`,
      tag: "News",
      tone: "default",
      title: n.headline,
      detail: match.p.full_name,
    });
  }

  return rows.slice(0, 7);
}
