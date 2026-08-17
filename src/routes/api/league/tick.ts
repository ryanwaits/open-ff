import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/league/tick")({
  server: {
    handlers: {
      GET: async () => {
        const ops = await import("@/lib/league/ops.server");
        ops.startLeagueClock();
        const res = await ops.tickAllLeagues();
        return Response.json(res);
      },
      POST: async () => {
        const ops = await import("@/lib/league/ops.server");
        ops.startLeagueClock();
        const res = await ops.tickAllLeagues();
        return Response.json(res);
      },
    },
  },
});
