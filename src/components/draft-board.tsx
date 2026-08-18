import { cn } from "@/lib/utils";

/**
 * The whole draft at a glance.
 *
 * Recent-pick lists say what just happened; this says what the draft *is* —
 * runs forming, who took which position, where your next seat falls. Rounds
 * down, seats across, snake already applied so each cell is the pick that
 * belongs there. Plans 008–012 render into this same grid with different
 * data; keep it presentational.
 */

type BoardPick = {
  pickNo: number;
  round: number;
  slot: number;
  label: string;
  rosterId: number;
  teamName: string;
  via: string | null;
  player: { name: string; position: string | null } | null;
};

type Seat = { rosterId: number; teamName: string };

const POS_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;

/** Strongest for QB → faintest for D/ST. One hue, six steps. */
const POS_TINT: Record<(typeof POS_ORDER)[number], string> = {
  QB: "color-mix(in oklab, var(--brand) 72%, var(--paper-sunken))",
  RB: "color-mix(in oklab, var(--brand) 58%, var(--paper-sunken))",
  WR: "color-mix(in oklab, var(--brand) 44%, var(--paper-sunken))",
  TE: "color-mix(in oklab, var(--brand) 32%, var(--paper-sunken))",
  K: "color-mix(in oklab, var(--brand) 20%, var(--paper-sunken))",
  DEF: "color-mix(in oklab, var(--brand) 12%, var(--paper-sunken))",
};

const POS_LABEL: Record<(typeof POS_ORDER)[number], string> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "D/ST",
};

const COL_PX = 92;
const GUTTER_PX = 28;

function surname(name: string): string {
  const trimmed = name.trim();
  const i = trimmed.indexOf(" ");
  if (i < 0) return trimmed;
  return trimmed.slice(i + 1);
}

function tintFor(position: string | null): string | undefined {
  if (!position) return undefined;
  const key = position === "DST" ? "DEF" : position;
  return POS_TINT[key as (typeof POS_ORDER)[number]];
}

function posKey(position: string | null): (typeof POS_ORDER)[number] | null {
  if (!position) return null;
  if (position === "DST") return "DEF";
  return POS_ORDER.includes(position as (typeof POS_ORDER)[number])
    ? (position as (typeof POS_ORDER)[number])
    : null;
}

export function DraftBoard({
  board,
  seats,
  onClockPickNo,
  myRosterId,
}: {
  board: BoardPick[];
  seats: Seat[];
  onClockPickNo: number;
  myRosterId: number | null;
}) {
  const n = seats.length;
  if (n === 0) return null;

  const byRoundSlot = new Map<string, BoardPick>();
  for (const p of board) {
    byRoundSlot.set(`${p.round}:${p.slot}`, p);
  }

  const rounds = [...new Set(board.map((p) => p.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table
          className="border-collapse text-left"
          style={{ tableLayout: "fixed", width: GUTTER_PX + n * COL_PX }}
        >
          <colgroup>
            <col style={{ width: GUTTER_PX }} />
            {seats.map((s) => (
              <col key={s.rosterId} style={{ width: COL_PX }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-bg p-1" aria-hidden />
              {seats.map((s) => (
                <th
                  key={s.rosterId}
                  className={cn(
                    "truncate px-1 pb-2 text-center font-mono text-[10px] font-semibold uppercase tracking-wide text-faint",
                    myRosterId === s.rosterId && "text-accent-strong",
                  )}
                  title={s.teamName}
                >
                  {s.teamName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((round) => (
              <tr key={round}>
                <th className="sticky left-0 z-10 bg-bg py-0.5 pr-1 text-right font-mono text-[10px] tabular-nums text-faint">
                  {round}
                </th>
                {seats.map((seat, i) => {
                  const slot = round % 2 === 1 ? i + 1 : n - i;
                  const pick = byRoundSlot.get(`${round}:${slot}`);
                  const onClock = pick?.pickNo === onClockPickNo;
                  const mine = myRosterId != null && pick?.rosterId === myRosterId;
                  const pos = posKey(pick?.player?.position ?? null);
                  const bg = tintFor(pick?.player?.position ?? null);

                  return (
                    <td key={seat.rosterId} className="p-0.5 align-top">
                      <div
                        className={cn(
                          "flex min-h-[44px] flex-col justify-center rounded-sm border border-line bg-surface px-1.5 py-1",
                          onClock && "ring-2 ring-accent-deep",
                          mine && !onClock && "ring-1 ring-accent/50",
                        )}
                        style={bg ? { background: bg } : undefined}
                      >
                        {pick?.player ? (
                          <>
                            <span className="truncate text-[11px] font-semibold leading-tight text-fg">
                              {surname(pick.player.name)}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 font-mono text-[9px] tabular-nums text-muted">
                              <span>{pos ? POS_LABEL[pos] : (pick.player.position ?? "—")}</span>
                              <span className="text-faint">{pick.label}</span>
                            </span>
                          </>
                        ) : (
                          <span className="font-mono text-[9px] tabular-nums text-faint">
                            {pick?.label ?? "—"}
                          </span>
                        )}
                        {pick?.via ? (
                          <span className="mt-0.5 truncate font-mono text-[8px] text-accent-strong">
                            ←{pick.via}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-wrap gap-2">
        {POS_ORDER.map((p) => (
          <li key={p} className="flex items-center gap-1.5 text-[10px] text-muted">
            <span
              className="inline-block size-2.5 rounded-sm border border-line"
              style={{ background: POS_TINT[p] }}
              aria-hidden
            />
            <span className="font-mono uppercase tracking-wide">{POS_LABEL[p]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
