import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { joinLeague } from "@/lib/league/fns";
import { useLeagueStore } from "@/lib/store";

type Search = { code?: string };

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  component: JoinLeague,
});

function JoinLeague() {
  const search = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const remember = useLeagueStore((s) => s.remember);
  const [code, setCode] = useState(search.code ?? "");
  const [teamName, setTeamName] = useState("");

  const join = useMutation({
    mutationFn: () => joinLeague({ data: { code, teamName } }),
    onSuccess: (res) => {
      remember({ leagueId: res.leagueId, name: res.name || teamName || "My league", season: res.season });
      void navigate({ to: "/league/$leagueId", params: { leagueId: res.leagueId } });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Could not join.";
      if (msg === "Unauthorized") {
        void navigate({ to: "/login", search: { redirect: "/join" } });
        return;
      }
      toast(msg);
    },
  });

  if (isPending) {
    return (
      <Shell>
        <div className="h-40 animate-pulse rounded-xl bg-surface" />
      </Shell>
    );
  }
  if (!user) return <Navigate to="/login" search={{ redirect: "/join" }} />;

  return (
    <Shell>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
        Take a seat
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Join a league</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Ask your commissioner for the six-character code. No Sleeper account.
      </p>
      <form
        className="mt-8 max-w-lg space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          join.mutate();
        }}
      >
        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Invite code
          </span>
          <Input
            className="mt-1.5 uppercase tracking-[0.2em]"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="YARD26"
            required
            maxLength={8}
          />
        </label>
        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Your team
          </span>
          <Input
            className="mt-1.5"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Rainey Street"
            required
          />
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={join.isPending}>
            {join.isPending ? "Joining…" : "Claim a seat"}
          </Button>
          <Link to="/" className="text-sm text-muted hover:text-fg">
            Cancel
          </Link>
        </div>
      </form>
    </Shell>
  );
}
