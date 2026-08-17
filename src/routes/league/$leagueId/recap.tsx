import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueBundle, getRecap } from "@/lib/data/fns";
import { cn, formatPts } from "@/lib/utils";

export const Route = createFileRoute("/league/$leagueId/recap")({
  validateSearch: (s: Record<string, unknown>) => ({
    week: s.week != null ? Number(s.week) : undefined,
  }),
  component: RecapPage,
});

function RecapPage() {
  const { leagueId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const week = search.week ?? league.data?.currentWeek ?? 1;
  const recap = useQuery({
    queryKey: ["recap", leagueId, week],
    queryFn: () => getRecap({ data: { leagueId, week } }),
    enabled: Boolean(league.data),
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <article>
        <div className="flex gap-1 overflow-x-auto pb-4">
          {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => navigate({ search: { week: w } })}
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-sm font-mono text-sm",
                w === week ? "bg-accent text-accent-fg" : "bg-raised text-muted",
              )}
            >
              {w}
            </button>
          ))}
        </div>

        {recap.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-16" />
            <Skeleton className="h-24" />
          </div>
        ) : recap.data ? (
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              {recap.data.kicker}
            </p>
            <h2 className="mt-2 font-display text-4xl leading-[1.05] tracking-tight">
              {recap.data.headline}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">{recap.data.dek}</p>
            <ul className="mt-6 space-y-3">
              {recap.data.bullets.map((b) => (
                <li key={b} className="border-t border-line pt-3 text-sm leading-relaxed">
                  {b}
                </li>
              ))}
            </ul>
            {recap.data.wireNote ? (
              <p className="mt-6 text-sm italic text-muted">{recap.data.wireNote}</p>
            ) : null}
          </div>
        ) : null}
      </article>

      <aside>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          Box
        </h3>
        <ul className="mt-3 divide-y divide-line rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {recap.data?.box.map((b) => (
            <li key={`${b.winner}-${b.loser}`} className="px-4 py-3">
              <p className="text-sm">
                <span className="text-fg">{b.winner}</span>
                <span className="text-faint"> over </span>
                <span className="text-muted">{b.loser}</span>
              </p>
              <p className="font-mono text-xs tabular-nums text-faint">
                {b.score} · {formatPts(b.margin, 1)} margin
              </p>
            </li>
          ))}
          {recap.data && recap.data.box.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted">No scored games this week.</li>
          ) : null}
        </ul>

        <div className="mt-6 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            <Sparkles className="size-3.5" />
            Next: Grok voice
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This dispatch is written from the box score — no model yet. Same
            payload can feed weekly articles, commissioner notes, and
            automated smack talk once we wire a language model.
          </p>
        </div>
      </aside>
    </div>
  );
}
