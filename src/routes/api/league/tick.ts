import { createFileRoute } from "@tanstack/react-router";

let warnedPublicClock = false;

function authorizeTick(request: Request): Response | null {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    if (!warnedPublicClock) {
      warnedPublicClock = true;
      console.warn("CRON_SECRET is unset; /api/league/tick is public");
    }
    return null;
  }
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const query = new URL(request.url).searchParams.get("secret") ?? "";
  if (bearer === expected || query === expected) return null;
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

async function tickLeagues() {
  const ops = await import("@/lib/league/ops.server");
  ops.startLeagueClock();
  const res = await ops.tickAllLeagues();
  return Response.json(res);
}

export const Route = createFileRoute("/api/league/tick")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorizeTick(request);
        if (denied) return denied;
        return tickLeagues();
      },
      POST: async ({ request }) => {
        const denied = authorizeTick(request);
        if (denied) return denied;
        return tickLeagues();
      },
    },
  },
});
