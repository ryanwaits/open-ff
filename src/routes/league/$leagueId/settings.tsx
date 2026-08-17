import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { bookFromPreset, SCORING_FIELDS, type ScoringBook } from "@/lib/league/scoring";
import {
  countsFromSlots,
  describeSlots,
  presetIdOf,
  ROSTER_PRESETS,
  SLOT_STEPPERS,
  slotsFromCounts,
  type SlotCounts,
} from "@/lib/league/roster";
import { getLeagueBundle } from "@/lib/data/fns";
import { claimRoster, getSettings, saveSettings, processWaivers, advanceWeek } from "@/lib/league/fns";
import { defaultPlayoffByes, describeBracket } from "@/lib/league/playoffs";
import { cn } from "@/lib/utils";
import { ScheduleDesk } from "@/components/schedule-desk";

export const Route = createFileRoute("/league/$leagueId/settings")({
  component: SettingsPage,
});

const GROUPS = [...new Set(SCORING_FIELDS.map((f) => f.group))];

function SettingsPage() {
  const { leagueId } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["settings", leagueId],
    queryFn: () => getSettings({ data: { leagueId } }),
  });
  // Already cached by the league layout, so this costs nothing.
  const bundle = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const [name, setName] = useState("");
  const [book, setBook] = useState<ScoringBook>({});
  const [playoff, setPlayoff] = useState(4);
  const [week, setWeek] = useState(1);
  const [waiverType, setWaiverType] = useState("faab");
  const [faab, setFaab] = useState(100);
  const [deadline, setDeadline] = useState(11);
  const [pStart, setPStart] = useState(15);
  const [regular, setRegular] = useState(14);
  const [byes, setByes] = useState(0);
  const [counts, setCounts] = useState<SlotCounts>(countsFromSlots(ROSTER_PRESETS[0]!.slots));
  const [bettingOn, setBettingOn] = useState(false);
  const [poolSeed, setPoolSeed] = useState(200);
  const [wagerCap, setWagerCap] = useState(25);
  const [exposureCap, setExposureCap] = useState(60);

  useEffect(() => {
    if (!q.data) return;
    setName(q.data.name);
    setBook(q.data.book);
    setPlayoff(q.data.playoffTeams);
    setWeek(q.data.currentWeek);
    setWaiverType(q.data.waiverType ?? "faab");
    setFaab(q.data.faabBudget ?? 100);
    setDeadline(q.data.tradeDeadlineWeek ?? 11);
    setPStart(q.data.playoffStartWeek ?? 15);
    setRegular(q.data.regularWeeks ?? 14);
    setByes(q.data.playoffByes ?? defaultPlayoffByes(q.data.playoffTeams));
    if (q.data.slots?.length) setCounts(countsFromSlots(q.data.slots));
    setBettingOn(q.data.bettingOn);
    setPoolSeed(q.data.poolSeed);
    setWagerCap(q.data.wagerCap);
    setExposureCap(q.data.exposureCap);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          leagueId,
          name,
          book,
          playoffTeams: playoff,
          currentWeek: week,
          waiverType,
          faabBudget: faab,
          tradeDeadlineWeek: deadline,
          playoffStartWeek: pStart,
          regularWeeks: regular,
          playoffByes: byes,
          slots: slotsFromCounts(counts),
          bettingOn,
          poolSeed,
          wagerCap,
          exposureCap,
        },
      }),
    onSuccess: async () => {
      toast("Settings saved. Scoring applies to unlocked weeks.");
      await qc.invalidateQueries({ queryKey: ["league", leagueId] });
      await qc.invalidateQueries({ queryKey: ["settings", leagueId] });
      await qc.invalidateQueries({ queryKey: ["matchups", leagueId] });
      await qc.invalidateQueries({ queryKey: ["team"] });
      await qc.invalidateQueries({ queryKey: ["book", leagueId] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Could not save."),
  });

  const claim = useMutation({
    mutationFn: (rosterId: number) => claimRoster({ data: { leagueId, rosterId } }),
    onSuccess: async () => {
      toast("Seat claimed.");
      await qc.invalidateQueries({ queryKey: ["league", leagueId] });
      await qc.invalidateQueries({ queryKey: ["settings", leagueId] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Could not claim."),
  });

  const grouped = useMemo(() => {
    return GROUPS.map((g) => ({
      group: g,
      fields: SCORING_FIELDS.filter((f) => f.group === g),
    }));
  }, []);

  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.error || !q.data) {
    return (
      <p className="text-sm text-muted">
        Settings live on hosted Ledger leagues.{" "}
        <Link to="/import" className="text-fg underline">
          Import one
        </Link>{" "}
        or create a desk.
      </p>
    );
  }

  const locked = q.data.locked || !q.data.isCommish;

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em]">League setup</h1>
        <p className="mt-1.5 text-sm text-muted">
          {q.data.isCommish
            ? "You run this league. Everything here is yours to change."
            : "Read-only. Your commissioner can change these."}
        </p>
      </header>

      {/* The draft lives here rather than in the tab bar: it happens once, and
          on the night it matters it deserves the whole screen, not a tab. */}
      <Link
        to="/league/$leagueId/draft"
        params={{ leagueId }}
        className="flex items-center justify-between gap-4 rounded-xl bg-surface px-5 py-4 shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
      >
        <span>
          <span className="block font-display text-lg font-bold tracking-[-0.03em]">Draft room</span>
          <span className="mt-0.5 block text-sm text-muted">
            {bundle.data?.draftStatus === "live"
              ? "Live now. Somebody is on the clock."
              : bundle.data?.draftStatus === "complete"
                ? "Complete. Open the board to review it."
                : "Not started yet."}
          </span>
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wide text-accent-strong">Open</span>
      </Link>

      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          {q.data.source === "sleeper" ? "Imported from Sleeper" : "Hosted on Ledger"}
          {q.data.sourceLeagueId ? ` · ${q.data.sourceLeagueId}` : ""}
        </p>
        <h2 className="mt-1 font-display text-2xl">League</h2>
        <label className="mt-4 block max-w-md">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Name</span>
          <Input
            className="mt-1.5"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={locked}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-6">
          <label className="block">
            <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Current week
            </span>
            <Input
              className="mt-1.5 w-24"
              type="number"
              min={1}
              max={18}
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              disabled={locked}
            />
          </label>
        </div>
        <p className="mt-3 font-mono text-xs text-faint">Invite {q.data.inviteCode}</p>
      </section>

      <section>
        <h2 className="font-display text-2xl">Roster</h2>
        <p className="mt-1 text-sm text-muted">
          Starters and bench. 3 WR with a W/R and no FLEX is a common 14-team
          book. Saving re-seats everyone into the new lineup.
        </p>
        <div className="mt-4 flex flex-wrap gap-1">
          {ROSTER_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={locked}
              onClick={() => setCounts(countsFromSlots(p.slots))}
              className={cn(
                "h-10 rounded-sm px-3 font-mono text-sm",
                presetIdOf(slotsFromCounts(counts)) === p.id
                  ? "bg-accent text-accent-fg"
                  : "bg-raised text-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-3 rounded-xl bg-surface px-4 py-3 font-mono text-xs text-muted shadow-[var(--shadow-border)]">
          {describeSlots(slotsFromCounts(counts))}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SLOT_STEPPERS.map((row) => {
            const n = counts[row.key];
            return (
              <div
                key={row.key}
                className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2.5 shadow-[var(--shadow-border)]"
              >
                <span>
                  <span className="block text-sm">{row.label}</span>
                  <span className="block font-mono text-[10px] uppercase text-faint">{row.hint}</span>
                </span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={locked || n <= 0}
                    onClick={() =>
                      setCounts((c) => ({ ...c, [row.key]: Math.max(0, n - 1) }))
                    }
                    className="grid size-9 place-items-center rounded-sm bg-raised text-muted disabled:opacity-30"
                    aria-label={`Fewer ${row.label}`}
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-mono text-sm tabular-nums">{n}</span>
                  <button
                    type="button"
                    disabled={locked || n >= row.max}
                    onClick={() =>
                      setCounts((c) => ({ ...c, [row.key]: Math.min(row.max, n + 1) }))
                    }
                    className="grid size-9 place-items-center rounded-sm bg-raised text-muted disabled:opacity-30"
                    aria-label={`More ${row.label}`}
                  >
                    +
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl">Playoffs</h2>
        <p className="mt-1 text-sm text-muted">
          How many make it, who sits the first week, and when the dance starts.
          A 14-team desk usually wants 7 in and the 1-seed on a bye. Later
          rounds reseed — best leftover vs worst leftover.
        </p>
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Teams in
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {[4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                type="button"
                disabled={locked}
                onClick={() => {
                  setPlayoff(n);
                  setByes(defaultPlayoffByes(n));
                }}
                className={cn(
                  "h-10 min-w-11 rounded-sm px-3 font-mono text-sm",
                  playoff === n ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            First-round byes
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                disabled={locked || n > playoff - 2}
                onClick={() => setByes(n)}
                className={cn(
                  "h-10 min-w-11 rounded-sm px-3 font-mono text-sm",
                  byes === n ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                )}
              >
                {n === 0 ? "None" : n === 1 ? "1 seed" : `${n} seeds`}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <label>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Regular weeks
            </span>
            <Input
              className="mt-1.5 w-24"
              type="number"
              min={8}
              max={17}
              value={regular}
              onChange={(e) => setRegular(Number(e.target.value))}
              disabled={locked}
            />
          </label>
          <label>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Playoffs start
            </span>
            <Input
              className="mt-1.5 w-24"
              type="number"
              min={10}
              max={18}
              value={pStart}
              onChange={(e) => setPStart(Number(e.target.value))}
              disabled={locked}
            />
          </label>
        </div>
        <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm text-muted shadow-[var(--shadow-border)]">
          {describeBracket(playoff, byes, pStart)}
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl">Schedule</h2>
        <p className="mt-1 text-sm text-muted">
          Regular-season pairings. Ledger fills a circle-method slate when the
          league is created or imported — change any week here. Scored weeks
          stay put. Playoffs seed from the standings when that week arrives.
        </p>
        <div className="mt-4">
          <ScheduleDesk leagueId={leagueId} canEdit={q.data.isCommish && !q.data.locked} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl">Waivers & calendar</h2>
        <p className="mt-1 text-sm text-muted">
          FAAB default $100, or rolling priority, or straight free agency. Claims
          sit until Wednesday and clear on their own. The desk follows the NFL
          regular season — preseason does not move the week, write ties, or
          lock scores. Once kickoff week starts, scores lock, waivers run, the
          next slate opens, and playoffs seed from the standings.
        </p>
        <div className="mt-4 flex flex-wrap gap-1">
          {(
            [
              ["faab", "FAAB"],
              ["rolling", "Rolling"],
              ["none", "Free agency"],
            ] as const
          ).map(([id, lab]) => (
            <button
              key={id}
              type="button"
              disabled={locked}
              onClick={() => setWaiverType(id)}
              className={cn(
                "h-10 rounded-sm px-3 font-mono text-sm",
                waiverType === id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
              )}
            >
              {lab}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <label>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">FAAB $</span>
            <Input
              className="mt-1.5 w-24"
              type="number"
              min={0}
              max={1000}
              value={faab}
              onChange={(e) => setFaab(Number(e.target.value))}
              disabled={locked}
            />
          </label>
          <label>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Trade deadline week
            </span>
            <Input
              className="mt-1.5 w-24"
              type="number"
              min={1}
              max={18}
              value={deadline}
              onChange={(e) => setDeadline(Number(e.target.value))}
              disabled={locked}
            />
          </label>
        </div>
        {q.data.isCommish && !q.data.locked ? (
          <CommishClock leagueId={leagueId} />
        ) : null}
      </section>

      <section>
        <h2 className="font-display text-2xl">The book</h2>
        <p className="mt-1 text-sm text-muted">
          Managers stake FAAB on matchups against a house pool. Losing stakes go into the pool and
          winners are paid out of it, so the league&rsquo;s total FAAB never changes — the seed
          below plus every manager&rsquo;s budget is all the money that will ever exist. Nobody can
          bet against their own team.
        </p>
        <div className="mt-4 flex flex-wrap gap-1">
          {(
            [
              [true, "On"],
              [false, "Off"],
            ] as const
          ).map(([id, lab]) => (
            <button
              key={String(id)}
              type="button"
              disabled={locked}
              onClick={() => setBettingOn(id)}
              className={cn(
                "h-10 rounded-sm px-4 font-mono text-sm",
                bettingOn === id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
              )}
            >
              {lab}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <label>
            <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Pool seed $
            </span>
            <Input
              className="mt-1.5 w-24"
              type="number"
              min={0}
              max={5000}
              value={poolSeed}
              onChange={(e) => setPoolSeed(Number(e.target.value))}
              disabled={locked}
            />
          </label>
          <label>
            <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Max per wager $
            </span>
            <Input
              className="mt-1.5 w-24"
              type="number"
              min={1}
              max={1000}
              value={wagerCap}
              onChange={(e) => setWagerCap(Number(e.target.value))}
              disabled={locked}
            />
          </label>
          <label>
            <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Max at risk $
            </span>
            <Input
              className="mt-1.5 w-24"
              type="number"
              min={1}
              max={2000}
              value={exposureCap}
              onChange={(e) => setExposureCap(Number(e.target.value))}
              disabled={locked}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-faint">
          A small pool against large budgets means winners get scaled payouts when a week goes
          against the house. The ratio is the dial.
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl">Scoring</h2>
        <p className="mt-1 text-sm text-muted">
          Every stat Ledger can book — passing through returns. Kick and punt
          return yards and TDs are on the player, not the D/ST. Finished
          imported weeks keep their original scores; live weeks use this.
        </p>
        <div className="mt-4 flex flex-wrap gap-1">
          {(["ppr", "half", "std"] as const).map((id) => (
            <button
              key={id}
              type="button"
              disabled={locked}
              onClick={() => setBook(bookFromPreset(id))}
              className={cn(
                "h-10 rounded-sm px-3 font-mono text-sm",
                q.data && book.rec === bookFromPreset(id).rec && book.pass_td === 4
                  ? "bg-accent text-accent-fg"
                  : "bg-raised text-muted",
              )}
            >
              {id === "ppr" ? "PPR" : id === "half" ? "Half" : "Standard"}
            </button>
          ))}
          <button
            type="button"
            disabled={locked}
            onClick={() => setBook({ ...book, pass_td: book.pass_td === 6 ? 4 : 6 })}
            className="h-10 rounded-sm bg-raised px-3 font-mono text-sm text-muted"
          >
            {book.pass_td === 6 ? "6pt pass TD" : "4pt pass TD"}
          </button>
        </div>

        {grouped.map((g) => (
          <div key={g.group} className="mt-6">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              {g.group}
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {g.fields.map((f) => (
                <label key={f.key} className="rounded-lg bg-surface p-3 shadow-[var(--shadow-border)]">
                  <span className="block text-xs text-muted">{f.label}</span>
                  <Input
                    className="mt-1.5 h-9"
                    type="number"
                    step={f.step}
                    value={book[f.key] ?? 0}
                    disabled={locked}
                    onChange={(e) =>
                      setBook((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-display text-2xl">Seats</h2>
        <ul className="mt-3 divide-y divide-line rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {q.data.teams.map((t) => (
            <li key={t.rosterId} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="block text-sm">{t.teamName}</span>
                <span className="font-mono text-[11px] text-faint">
                  {t.manager}
                  {t.faab != null ? ` · $${t.faab}` : ""}
                </span>
              </span>
              {t.open ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={claim.isPending}
                  onClick={() => claim.mutate(t.rosterId)}
                >
                  Claim
                </Button>
              ) : (
                <span className="font-mono text-[11px] uppercase text-faint">Taken</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {q.data.isCommish && !q.data.locked ? (
        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      ) : (
        <p className="text-sm text-muted">
          {q.data.locked ? "Demo desk is locked." : "Only the commissioner can edit scoring."}
        </p>
      )}
    </div>
  );
}

function CommishClock({ leagueId }: { leagueId: string }) {
  const qc = useQueryClient();
  const waivers = useMutation({
    mutationFn: () => processWaivers({ data: { leagueId } }),
    onSuccess: (res) => {
      toast(`Waivers processed · ${res.awarded} awards`);
      void qc.invalidateQueries({ queryKey: ["league", leagueId] });
      void qc.invalidateQueries({ queryKey: ["claims", leagueId] });
      void qc.invalidateQueries({ queryKey: ["wire", leagueId] });
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not process"),
  });
  const next = useMutation({
    mutationFn: () => advanceWeek({ data: { leagueId } }),
    onSuccess: () => {
      toast("Week locked and advanced.");
      void qc.invalidateQueries({ queryKey: ["league", leagueId] });
      void qc.invalidateQueries({ queryKey: ["matchups", leagueId] });
      void qc.invalidateQueries({ queryKey: ["settings", leagueId] });
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not advance"),
  });
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={() => waivers.mutate()} disabled={waivers.isPending}>
        {waivers.isPending ? "Processing…" : "Process waivers now"}
      </Button>
      <Button type="button" variant="outline" onClick={() => next.mutate()} disabled={next.isPending}>
        {next.isPending ? "Advancing…" : "Lock week & advance"}
      </Button>
      <p className="basis-full text-xs text-faint">
        Optional overrides. The league clock runs waivers Wednesday and
        advances with the NFL regular season — not preseason.
      </p>
    </div>
  );
}
