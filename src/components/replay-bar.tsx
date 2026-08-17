import { Button } from "@/components/ui/button";
import { REPLAY_PHASES, REPLAY_TICK_MS } from "@/lib/replay";

export function ReplayBar({
  phase,
  running,
  onStart,
  onToggle,
  onStop,
  kicker = "Replay lab",
  copy = "Real unofficial lines, unfolded like a Sunday.",
  actionLabel = "Watch it tick",
}: {
  phase: number | null;
  running: boolean;
  onStart: () => void;
  onToggle: () => void;
  onStop: () => void;
  kicker?: string;
  copy?: string;
  actionLabel?: string;
}) {
  const current = phase != null ? REPLAY_PHASES[phase] : null;
  return (
    <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            {phase == null ? kicker : running ? "Replay running" : "Replay paused"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {copy} Tick every {REPLAY_TICK_MS / 1000}s.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {phase == null ? (
            <Button type="button" size="sm" onClick={onStart}>
              {actionLabel}
            </Button>
          ) : (
            <>
              <Button type="button" size="sm" variant="outline" onClick={onToggle}>
                {running ? "Pause" : "Resume"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onStop}>
                Show finals
              </Button>
            </>
          )}
        </div>
      </div>
      {current && phase != null ? (
        <p className="mt-3 font-mono text-sm text-live">
          {current.label}
          <span className="text-faint">
            {" "}
            · {phase + 1}/{REPLAY_PHASES.length}
          </span>
        </p>
      ) : null}
    </div>
  );
}
