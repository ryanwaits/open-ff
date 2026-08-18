import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ClaimButton } from "@/components/claim-button";
import { ClaimDialog } from "@/components/claim-dialog";
import {
  ProfileGameLog,
  ProfileIdentity,
  ProfileNews,
  ProfileSchedule,
  ProfileSplits,
  ProfileStats,
  ProfileThisWeek,
  ScoringNote,
} from "@/components/player-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueBundle, getTeam } from "@/lib/data/fns";
import { displayName, headshotFor, usePlayerProfile } from "@/lib/data/player-view";
import { useClaim } from "@/lib/league/use-claim";
import { fmtRecord } from "@/lib/utils";
import { baseSlotLabel } from "@/lib/data/teams";

export const Route = createFileRoute("/league/$leagueId/player/$playerId")({
  component: PlayerPage,
});

function PlayerPage() {
  const { leagueId, playerId } = Route.useParams();
  const router = useRouter();
  const q = usePlayerProfile(leagueId, playerId);

  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const week = league.data?.currentWeek ?? 1;
  const rosterId = league.data?.myRosterId ?? null;

  const myTeam = useQuery({
    queryKey: ["team", leagueId, rosterId, week],
    queryFn: () => getTeam({ data: { leagueId, rosterId: Number(rosterId), week } }),
    enabled: rosterId != null && Boolean(league.data),
  });

  const p = q.data;
  const mine = myTeam.data?.players.find((r) => r.player_id === playerId);
  const claim = useClaim(leagueId);
  const ownedBy = p?.ownedBy ?? null;
  const waiversOpen = Boolean(league.data?.ops?.waiversOpen);
  const waiverType = league.data?.ops?.waiverType ?? "faab";

  if (q.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 rounded-xl" />
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }
  if (!p) {
    return <p className="text-sm text-muted">No profile for this player.</p>;
  }

  const player = p.player;
  const myRecord =
    league.data && rosterId != null
      ? (() => {
          const row = league.data.standings.find((s) => s.rosterId === rosterId);
          return row ? fmtRecord(row.wins, row.losses, row.ties) : "—";
        })()
      : "—";
  const context = mine
    ? {
        label: mine.slot === "starter" ? `Starting at ${mine.starterSlot}` : "On your bench",
        rows: [
          ["Slot", baseSlotLabel(mine.starterSlot) || "Bench"] as [string, string],
          ["This week", mine.weekPts != null ? String(mine.weekPts) : "Not played"] as [
            string,
            string,
          ],
        ],
      }
    : ownedBy
      ? {
          label: `On ${ownedBy.teamName}`,
          rows: [
            ["Roster", ownedBy.teamName] as [string, string],
            ["Status", "Needs a trade"] as [string, string],
          ],
        }
      : waiversOpen && waiverType !== "none"
        ? {
            label: "On waivers",
            rows: [
              ["Status", waiverType === "faab" ? "Bid available" : "Claim available"] as [
                string,
                string,
              ],
              ["Your record", myRecord] as [string, string],
            ],
          }
        : {
            label: "Free agent",
            rows: [
              ["Status", "Available to add"] as [string, string],
              ["Your record", myRecord] as [string, string],
            ],
          };

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => router.history.back()}
        className="inline-flex w-fit items-center gap-1.5 rounded-pill px-2 py-1 text-sm font-semibold text-muted hover:bg-raised hover:text-fg"
      >
        <ArrowLeft className="size-4" strokeWidth={2.2} />
        Back
      </button>

      <section className="rounded-xl bg-surface shadow-[var(--shadow-border)]">
        <div className="p-5">
          <ProfileIdentity player={player} size="lg" context={context}>
            <div className="shrink-0">
              <ClaimButton
                verdict={claim.verdictFor(playerId, p.ownedBy)}
                leagueId={leagueId}
                playerId={playerId}
                ownerRosterId={p.ownedBy?.rosterId}
                onClaim={() =>
                  claim.setTarget({
                    player,
                    name: displayName(player),
                    headshot: headshotFor(player),
                    action: mine ? "drop" : "add",
                  })
                }
              />
            </div>
          </ProfileIdentity>
        </div>
        <div className="border-t border-line">
          <ProfileStats p={p} player={player} />
        </div>
        <ScoringNote />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="rounded-xl bg-surface shadow-[var(--shadow-border)]">
            <ProfileNews notes={p.news} />
          </section>
          <section className="rounded-xl bg-surface shadow-[var(--shadow-border)]">
            <ProfileGameLog weekly={p.weekly} bye={p.byeWeek} perGame={p.perGame} tall />
          </section>
          <section className="rounded-xl bg-surface shadow-[var(--shadow-border)]">
            <ProfileSplits p={p} />
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <section className="rounded-xl bg-surface shadow-[var(--shadow-border)]">
            <ProfileThisWeek p={p} player={player} game={mine?.game} />
          </section>
          <section className="rounded-xl bg-surface shadow-[var(--shadow-border)]">
            <ProfileSchedule games={p.schedule} week={p.slateWeek} />
          </section>
          {!mine && !ownedBy ? (
            <Link
              to="/league/$leagueId/wire"
              params={{ leagueId }}
              className="rounded-xl bg-surface px-5 py-4 text-sm font-semibold shadow-[var(--shadow-border)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
            >
              Look for him on the wire
            </Link>
          ) : null}
        </div>
      </div>

      <ClaimDialog
        open={claim.open}
        onOpenChange={(next) => {
          if (!next) claim.setTarget(null);
        }}
        leagueId={leagueId}
        target={claim.target}
        mode={claim.mode}
        waiverType={claim.waiverType}
        faabRemaining={claim.faabRemaining}
        waiverPos={claim.waiverPos}
        droppable={claim.droppable}
        mustDrop={claim.mustDrop}
        rosterCount={claim.rosterCount}
        rosterCap={claim.rosterCap}
      />
    </div>
  );
}
