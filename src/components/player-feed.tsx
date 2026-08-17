import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { playerSearchKeys } from "@/lib/data/player-plays";
import type { ActivityItem, NewsItem, RosterPlayer } from "@/lib/data/types";
import type { Phase } from "@/lib/league/phase";
import { formatPts } from "@/lib/utils";

/**
 * There is no per-player news feed available to this app. Sleeper gives a
 * status designation with no timestamp, and ESPN's feed is eight league-wide
 * headlines. So this card is assembled from three real sources instead, and
 * changes with the week:
 *
 *   before kickoff  designations on your roster, then league moves involving
 *                   your players, then any ESPN headline that names one of them
 *   live / settled  what your starters actually did, best first
 *
 * Nothing here is invented. If a source is empty it contributes nothing.
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
  const rows = phase === "live" || phase === "settled"
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
              className="flex items-start gap-3 border-b border-line px-5 py-3 last:border-0"
            >
              {r.tag ? (
                <Badge tone={r.tone}>{r.tag}</Badge>
              ) : (
                <span className="w-1" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{r.title}</span>
                <span className="block text-[13px] text-muted">{r.detail}</span>
              </span>
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
  tone: "loss" | "win" | "muted";
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
      tone: "muted" as const,
      title: p.full_name,
      detail: [p.team, p.game?.detail].filter(Boolean).join(" · ") || "No game data",
      value: formatPts(p.weekPts, 1),
    }));
}

/** Before kickoff: what might cost you points. */
function statusRows(
  players: RosterPlayer[],
  activity: ActivityItem[],
  news: NewsItem[],
): Row[] {
  const rows: Row[] = [];
  const mine = players.filter((p) => p.slot !== "taxi");

  for (const p of mine) {
    const s = (p.injury_status ?? "").trim();
    if (!s) continue;
    const severe = /^(out|ir|doubtful|suspended|pup)$/i.test(s);
    rows.push({
      id: `status-${p.player_id}`,
      tag: s.toUpperCase(),
      tone: severe ? "loss" : "muted",
      title: p.full_name,
      detail: [p.position, p.team, p.slot === "starter" ? `starting at ${p.starterSlot}` : "on your bench"]
        .filter(Boolean)
        .join(" · "),
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
      tone: "muted",
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
      tone: "muted",
      title: n.headline,
      detail: match.p.full_name,
    });
  }

  return rows.slice(0, 7);
}
