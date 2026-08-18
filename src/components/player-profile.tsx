import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { displayName, headshotFor, type Profile } from "@/lib/data/player-view";
import type { GameChip, PlayerNote, PlayerScheduleGame, SlimPlayer } from "@/lib/data/types";
import { cn, formatPts } from "@/lib/utils";

export type LeagueContext = { label: string; rows: [string, string][] } | null;

/* ---------------------------------------------------------------- sections */

export function ProfileIdentity({
  player,
  size = "md",
  context,
  children,
}: {
  player: SlimPlayer;
  size?: "md" | "lg";
  context?: LeagueContext;
  children?: React.ReactNode;
}) {
  const role = [player.position, player.team, player.number ? `#${player.number}` : null]
    .filter(Boolean)
    .join(" · ");
  const book = [
    player.age != null ? String(player.age) : null,
    player.years_exp != null ? `${player.years_exp} yr${player.years_exp === 1 ? "" : "s"}` : null,
    player.college,
    player.depth_chart_order ? `depth #${player.depth_chart_order}` : null,
  ].filter(Boolean);
  return (
    <div className="flex items-start gap-3">
      <Avatar
        src={headshotFor(player)}
        name={displayName(player)}
        className={size === "lg" ? "size-18" : "size-14"}
        textClassName={size === "lg" ? "text-base" : "text-sm"}
      />
      <div className="min-w-0 flex-1">
        <h1
          className={cn(
            "font-display font-extrabold leading-tight tracking-[-0.035em]",
            size === "lg" ? "text-3xl sm:text-4xl" : "text-2xl",
          )}
        >
          {displayName(player)}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {role ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              {role}
            </span>
          ) : null}
          {player.injury_status ? <Badge tone="loss">{player.injury_status}</Badge> : null}
        </div>
        {book.length ? (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            {book.join(" · ")}
          </p>
        ) : null}
        {context?.label ? (
          <p className="mt-1 text-[13px] text-muted">{context.label}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function ProfileStats({ p, player }: { p: Profile; player: SlimPlayer }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4">
      <Stat value={formatPts(p.points, 1)} label={`${p.season} pts`} />
      <Stat value={formatPts(p.perGame, 1)} label="per game" />
      <Stat
        value={p.posRank ? `${player.position ?? ""}${p.posRank}` : "—"}
        label="position rank"
      />
      <Stat value={String(p.gamesPlayed)} label="games" />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-r border-b border-line px-5 py-3 last:border-r-0 sm:border-b-0">
      <span className="block font-mono text-xl font-semibold tabular-nums">{value}</span>
      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
    </div>
  );
}

export function Section({
  title,
  meta,
  children,
  bare = false,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  bare?: boolean;
}) {
  return (
    <section className={cn(!bare && "border-b border-line last:border-0")}>
      <header className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-1.5">
        <h2 className="font-display text-base font-bold tracking-[-0.03em]">{title}</h2>
        {meta ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            {meta}
          </span>
        ) : null}
      </header>
      <div className="pb-3">{children}</div>
    </section>
  );
}

export function Row({ k, v, tone }: { k: string; v: string; tone?: "loss" }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-1.5">
      <span className="text-sm text-muted">{k}</span>
      <span
        className={cn("font-mono text-sm font-medium tabular-nums", tone === "loss" && "text-loss")}
      >
        {v}
      </span>
    </div>
  );
}

export function ProfileNews({ notes }: { notes: PlayerNote[] }) {
  if (notes.length === 0) {
    return (
      <Section title="News">
        <p className="px-5 text-sm text-muted">No player notes yet.</p>
      </Section>
    );
  }
  const source = notes[0]?.source;
  return (
    <Section title="News" meta={source}>
      <ul>
        {notes.slice(0, 5).map((n) => (
          <li key={n.id} className="border-b border-line px-5 py-3 last:border-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              {noteWhen(n.date)}
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug">{n.headline}</p>
            {n.text && n.text !== n.headline ? (
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{n.text}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ProfileSchedule({
  games,
  week,
  compact = false,
}: {
  games: PlayerScheduleGame[];
  week: number;
  compact?: boolean;
}) {
  if (games.length === 0) {
    return (
      <Section title="Schedule">
        <p className="px-5 text-sm text-muted">No slate for this team yet.</p>
      </Section>
    );
  }
  const shown = compact ? games.filter((g) => g.week >= week).slice(0, 6) : games;
  const hidden = compact ? Math.max(0, games.filter((g) => g.week >= week).length - shown.length) : 0;
  return (
    <Section title="Schedule" meta={compact ? "Next" : `${games.length} weeks`}>
      <ul>
        {shown.map((g) => {
          const now = g.week === week;
          return (
            <li
              key={`${g.week}-${g.opp}`}
              className={cn(
                "flex items-baseline justify-between gap-3 px-5 py-1.5",
                now && "bg-[color-mix(in_oklab,var(--brand)_10%,transparent)]",
              )}
            >
              <span className="w-10 shrink-0 font-mono text-[10px] uppercase tracking-wide text-faint">
                W{g.week}
              </span>
              <span className={cn("min-w-0 flex-1 truncate text-sm", g.bye && "text-muted")}>
                {g.opp}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-faint">
                {g.bye ? "Bye" : g.detail}
              </span>
            </li>
          );
        })}
      </ul>
      {hidden > 0 ? (
        <p className="px-5 pt-1 pb-2 font-mono text-[10px] uppercase tracking-wide text-faint">
          +{hidden} more on the full profile
        </p>
      ) : null}
    </Section>
  );
}

function noteWhen(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ProfileThisWeek({ p, player, game }: { p: Profile; player: SlimPlayer; game?: GameChip | null }) {
  const bye = p.schedule.find((g) => g.bye)?.week ?? p.byeWeek;
  return (
    <Section title="This week">
      <Row k="Opponent" v={game?.opp ?? "—"} />
      <Row k="Game" v={game?.detail ?? "Not scheduled"} />
      <Row
        k="Status"
        v={player.injury_status ?? "No designation"}
        tone={player.injury_status ? "loss" : undefined}
      />
      <Row k="Bye week" v={bye ? `Week ${bye}` : "Unknown"} />
    </Section>
  );
}

/**
 * Splits, grouped by phase of the game. A group only appears if the player
 * logged something in it, so a receiver is not told he threw for zero yards.
 * Within a shown group every line stays, because a running back with zero
 * rushing touchdowns is a fact worth reading.
 */
const SPLIT_GROUPS: { keys: [string, string][] }[] = [
  { keys: [["pass_yd", "Passing yards"], ["pass_td", "Passing TD"], ["pass_int", "Interceptions"]] },
  { keys: [["rush_yd", "Rushing yards"], ["rush_td", "Rushing TD"]] },
  { keys: [["rec", "Receptions"], ["rec_yd", "Receiving yards"], ["rec_td", "Receiving TD"]] },
  { keys: [["fum_lost", "Fumbles lost"]] },
];

export function ProfileSplits({ p }: { p: Profile }) {
  const groups = SPLIT_GROUPS.map((g) =>
    g.keys.filter(([key]) => p.splits[key] != null),
  ).filter((rows) => rows.some(([key]) => (p.splits[key] ?? 0) !== 0));

  if (groups.length === 0) {
    return (
      <Section title={`${p.season} splits`}>
        <p className="px-5 text-sm text-muted">No season splits recorded.</p>
      </Section>
    );
  }

  return (
    <Section title={`${p.season} splits`} meta="Season totals">
      {groups.map((rows, i) => (
        <div key={i} className={i > 0 ? "mt-1 border-t border-line pt-1" : undefined}>
          {rows.map(([key, label]) => (
            <Row key={key} k={label} v={fmt(p.splits[key]!)} />
          ))}
        </div>
      ))}
    </Section>
  );
}

function fmt(n: number): string {
  return n >= 1000 ? n.toLocaleString() : String(n);
}

/**
 * One series, so no legend and no colour-by-value: bar height already encodes
 * magnitude. The average is a reference line rather than a second hue, and
 * weeks with no game are drawn as gaps, because "did not play" and "scored
 * nothing" are different facts.
 */
export function ProfileGameLog({
  weekly,
  bye,
  perGame,
  tall = false,
}: {
  weekly: (number | null)[];
  bye: number | null;
  perGame: number;
  tall?: boolean;
}) {
  const played = weekly.filter((v): v is number => v != null);
  if (played.length === 0) {
    return (
      <Section title="Week by week">
        <p className="px-5 text-sm text-muted">No games recorded for this season yet.</p>
      </Section>
    );
  }
  const top = Math.max(...played, perGame) * 1.15 || 1;
  const best = Math.max(...played);

  return (
    <Section title="Week by week" meta={`Avg ${formatPts(perGame, 1)}`}>
      <div className="px-5 pt-2">
        <div className={cn("relative flex items-end gap-[2px]", tall ? "h-48" : "h-32")}>
          {weekly.map((v, i) => {
            const week = i + 1;
            const isBye = bye === week;
            if (v == null) {
              return (
                <span
                  key={week}
                  title={isBye ? `Week ${week} · bye` : `Week ${week} · no game`}
                  className="flex h-full flex-1 items-end"
                >
                  <span
                    className={cn("h-2.5 w-full rounded-xs", isBye ? "bg-line-strong" : "bg-line")}
                  />
                </span>
              );
            }
            return (
              <span
                key={week}
                title={`Week ${week} · ${formatPts(v, 1)}`}
                className="relative flex h-full flex-1 items-end"
              >
                {v === best ? (
                  <span className="absolute inset-x-0 -top-1 text-center font-mono text-[9px] font-semibold">
                    {formatPts(v, 1)}
                  </span>
                ) : null}
                <span
                  className="w-full rounded-t-xs bg-accent-strong"
                  style={{ height: `${Math.max((v / top) * 100, 2)}%` }}
                />
              </span>
            );
          })}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-faint"
            style={{ bottom: `${(perGame / top) * 100}%` }}
          />
        </div>
        <div className="mt-1 flex gap-[2px] border-t border-line pt-1">
          {weekly.map((_, i) => (
            <span key={i} className="flex-1 text-center font-mono text-[8px] leading-none text-faint">
              {i % 2 === 0 ? i + 1 : ""}
            </span>
          ))}
        </div>
        <p className="pt-2 pb-1 text-xs text-faint">
          {bye ? `Bye in week ${bye}.` : "Bye week unknown."} Blank weeks are games not played.
        </p>
      </div>
    </Section>
  );
}

export function ScoringNote() {
  return (
    <p className="border-b border-line px-5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
      Scored with this league&rsquo;s book
    </p>
  );
}
