import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { InstallCoach } from "@/components/install-coach";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listAgentTokens, listMyLeagues, mintAgentToken, revokeAgentToken } from "@/lib/league/fns";
import { useLeagueStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const remember = useLeagueStore((s) => s.remember);
  const { user, isPending: sessionPending } = useCurrentUserState();
  const mine = useQuery({
    // Guest fetch returns [] and is persisted — same key after login would
    // keep that empty hit for staleTime (30s). Key by user so sign-in is a miss.
    queryKey: ["my-leagues", user?.id ?? "anon"],
    queryFn: () => listMyLeagues(),
    enabled: !sessionPending && Boolean(user),
    placeholderData: undefined,
  });

  const seats = mine.data ?? [];
  const waiting = sessionPending || (Boolean(user) && mine.data == null && !mine.isError);

  return (
    <Shell center>
      <section className="w-full max-w-xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          Hosted here &middot; no other app
        </p>
        <h1 className="mt-3 font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl">
          Your league, <span className="hl">your desk</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted">
          Sign in, claim a seat, play the week. Commissioners set the book.
        </p>
      </section>

      {seats.length > 0 ? (
        <section className="mt-8 w-full max-w-lg text-center">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Your leagues
          </h2>
          <ul className="mt-3 max-w-lg space-y-2">
            {seats.map((l) => (
              <li key={l.leagueId}>
                <Link
                  to="/league/$leagueId"
                  params={{ leagueId: l.leagueId }}
                  preload="intent"
                  onClick={() => remember({ leagueId: l.leagueId, name: l.name, season: l.season })}
                  className="group flex w-full items-center justify-between gap-3 rounded-xl bg-surface px-4 py-4 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
                >
                  <span>
                    <span className="block text-sm font-semibold">{l.name}</span>
                    <span className="font-mono text-[11px] text-faint">
                      {l.season} · {l.role}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-faint transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-accent-strong" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-center gap-3 text-sm">
            <Link to="/join" className="text-muted hover:text-fg">
              Join another
            </Link>
            {seats.some((s) => s.role === "commish") ? (
              <Link to="/new" className="text-muted hover:text-fg">
                New league
              </Link>
            ) : (
              <Link to="/new" className="text-faint hover:text-muted">
                Start a league
              </Link>
            )}
          </div>
          {user ? <AgentTokensPanel /> : null}
        </section>
      ) : waiting ? (
        <div className="mt-8 h-24 w-full max-w-sm animate-pulse rounded-xl bg-surface" />
      ) : !user ? (
        <div className="mt-8 flex w-full max-w-sm flex-col gap-2">
          <Button asChild>
            <Link to="/join">I have an invite</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">Sign in</Link>
          </Button>
          <Link to="/new" className="mt-2 text-sm text-faint hover:text-muted">
            Start a league
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
          <Button asChild>
            <Link to="/import">Import a league</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/join">Claim a seat</Link>
          </Button>
          <Link to="/new" className="text-sm text-faint hover:text-muted">
            Start empty
          </Link>
          <AgentTokensPanel />
        </div>
      )}

      <InstallCoach />
    </Shell>
  );
}

/** Mint / list / revoke personal off_ tokens for agent hosts. Plaintext once. */
function AgentTokensPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("codex");
  const [once, setOnce] = useState<string | null>(null);

  const tokens = useQuery({
    queryKey: ["agent-tokens"],
    queryFn: () => listAgentTokens(),
  });

  const mint = useMutation({
    mutationFn: () => mintAgentToken({ data: { name } }),
    onSuccess: (res) => {
      setOnce(res.token);
      void qc.invalidateQueries({ queryKey: ["agent-tokens"] });
      toast("Token created — copy it now.");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not mint"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeAgentToken({ data: { id } }),
    onSuccess: () => {
      setOnce(null);
      void qc.invalidateQueries({ queryKey: ["agent-tokens"] });
      toast("Token revoked.");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not revoke"),
  });

  return (
    <div className="mt-8 w-full max-w-lg text-left">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Agent tokens</h2>
      <p className="mt-1 text-sm text-muted">
        Bearer for hosted agents. Shown once; hashed at rest.
      </p>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          mint.mutate();
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="codex"
          aria-label="Token name"
          className="h-9"
        />
        <Button type="submit" size="sm" disabled={mint.isPending}>
          Create
        </Button>
      </form>

      {once ? (
        <div className="mt-3 rounded-xl bg-raised px-3 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Copy now — not shown again
          </p>
          <code className="mt-1 block break-all font-mono text-xs text-fg">{once}</code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              void navigator.clipboard.writeText(once);
              toast("Copied.");
            }}
          >
            Copy
          </Button>
        </div>
      ) : null}

      <ul className="mt-3 space-y-2">
        {(tokens.data ?? []).map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2 shadow-[var(--shadow-border)]"
          >
            <span>
              <span className="block font-mono text-xs">{t.prefix}…</span>
              <span className="font-mono text-[11px] text-faint">{t.name}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate(t.id)}
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
