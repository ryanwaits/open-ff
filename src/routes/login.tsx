import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { LOCAL_SEED } from "@/lib/auth/local-seed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const dest = redirect && redirect.startsWith("/") ? redirect : "/";
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState<string>(LOCAL_SEED.email);
  const [password, setPassword] = useState<string>(LOCAL_SEED.password);
  const [name, setName] = useState<string>(LOCAL_SEED.name);
  const [busy, setBusy] = useState(false);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({ email, password, name });
        if (res.error) throw new Error(res.error.message ?? "Sign-up failed");
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message ?? "Sign-in failed");
      }
      void navigate({ to: dest });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-fg">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-display text-3xl tracking-tight">
          Ledger
        </Link>
        <p className="mt-2 text-sm text-muted">
          This is your Ledger account — not Sleeper, not ESPN. Email works
          here with nothing else to set up. Google and X use the same login.
        </p>
        <p className="mt-2 text-xs text-faint">
          Local seed is {LOCAL_SEED.email} / {LOCAL_SEED.password}. Restart
          wipes the in-memory DB and reseeds that account. A hosted database
          keeps whatever you create.
        </p>
        <div className="mt-8 space-y-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: dest })}
              >
                Continue with {p.label}
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted">Sign-in is disabled.</p>
          )}
        </div>

        {authEnabled ? (
          <form className="mt-8 space-y-3" onSubmit={(e) => void onEmail(e)}>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              {mode === "up" ? "Create an account" : "Email"}
            </p>
            {mode === "up" ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display name"
                required
              />
            ) : null}
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@league.com"
              required
              autoComplete="email"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={8}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in"}
            </Button>
            <button
              type="button"
              className="text-sm text-muted hover:text-fg"
              onClick={() => setMode(mode === "up" ? "in" : "up")}
            >
              {mode === "up" ? "Already have an account?" : "Need an account?"}
            </button>
          </form>
        ) : null}

        <Link to="/" className="mt-6 inline-block text-sm text-muted hover:text-fg">
          Back to the desk
        </Link>
      </div>
    </main>
  );
}
