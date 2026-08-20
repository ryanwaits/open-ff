import { AGENT_TOOLS } from "./catalog";
import { AGENT_CORE } from "./core";

export type DispatchArgs = Record<string, unknown>;

function str(v: unknown, name: string): string {
  if (typeof v !== "string" || !v) throw new Error(`${name} is required`);
  return v;
}

function num(v: unknown, name: string): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} is required`);
  return n;
}

function optNum(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function optStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v !== "string") throw new Error("expected string");
  return v;
}

function asJson(result: unknown): unknown {
  return result === undefined ? { ok: true } : result;
}

/**
 * Call a core catalog id against the hosted-league engine.
 * `userId` must come from the host (OPENFF_USER / token) — never from model args.
 */
export async function dispatch(
  id: string,
  userId: string | null | undefined,
  args: DispatchArgs = {},
): Promise<unknown> {
  if (id === "tick" || id === "tickAllLeagues") {
    throw new Error(`${id} is a cron clock, not a tool`);
  }
  if (!AGENT_CORE.has(id)) {
    throw new Error(`Unknown tool: ${id}`);
  }

  const meta = AGENT_TOOLS.find((t) => t.id === id);
  if (meta?.mutating) {
    if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
  }

  const uid = userId ?? null;

  switch (id) {
    case "getAgentContext": {
      const { loadAgentContext } = await import("@/lib/league/agent-context.server");
      return asJson(await loadAgentContext(str(args.leagueId, "leagueId"), uid));
    }
    case "listMyLeagues": {
      if (!userId) throw new Error("listMyLeagues requires a signed-in user (OPENFF_USER)");
      const { listMyLeagues } = await import("@/lib/league/engine.server");
      return asJson(await listMyLeagues(userId));
    }
    case "getTeam": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      return asJson(
        await eng.loadTeam(leagueId, num(args.rosterId, "rosterId"), num(args.week, "week")),
      );
    }
    case "getBook": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      const book = await import("@/lib/league/book.server");
      return asJson(await book.loadBook(leagueId, uid, optNum(args.week)));
    }
    case "getMatchups": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      return asJson(await eng.loadMatchups(leagueId, num(args.week, "week")));
    }
    case "getWire": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      const scope =
        args.scope === "all" || args.scope === "available" || args.scope === "free_agent"
          ? args.scope
          : "available";
      return asJson(
        await eng.loadWire(
          leagueId,
          str(args.position ?? "ALL", "position"),
          typeof args.query === "string" ? args.query : "",
          scope,
        ),
      );
    }
    case "getDraft": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      return asJson(
        await eng.loadDraft(
          leagueId,
          uid,
          str(args.position ?? "ALL", "position"),
          typeof args.query === "string" ? args.query : "",
        ),
      );
    }
    case "getSettings": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      return asJson(await eng.loadSettings(leagueId, uid));
    }
    case "getEvents": {
      const { readEvents } = await import("@/lib/league/events.server");
      return asJson(
        await readEvents(str(args.leagueId, "leagueId"), {
          limit: optNum(args.limit),
          sinceWeek: optNum(args.sinceWeek),
        }),
      );
    }
    case "getLeagueFacts": {
      const { loadLeagueFacts } = await import("@/lib/league/league-facts.server");
      return asJson(await loadLeagueFacts(str(args.leagueId, "leagueId"), num(args.week, "week")));
    }
    case "sitPlayer": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const { sitPlayer } = await import("@/lib/league/engine.server");
      await sitPlayer(userId, str(args.leagueId, "leagueId"), str(args.playerId, "playerId"));
      return { ok: true };
    }
    case "startPlayer": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const { startPlayer } = await import("@/lib/league/engine.server");
      await startPlayer(
        userId,
        str(args.leagueId, "leagueId"),
        str(args.playerId, "playerId"),
        args.replaceId == null ? undefined : (optStr(args.replaceId) ?? null),
        args.slot == null ? undefined : (optStr(args.slot) ?? null),
      );
      return { ok: true };
    }
    case "dropPlayer": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const { dropPlayer } = await import("@/lib/league/engine.server");
      await dropPlayer(userId, str(args.leagueId, "leagueId"), str(args.playerId, "playerId"));
      return { ok: true };
    }
    case "placeWager": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const { placeWager } = await import("@/lib/league/wagers.server");
      const kind = args.kind;
      if (kind !== "spread" && kind !== "moneyline") {
        throw new Error("kind must be spread or moneyline");
      }
      return asJson(
        await placeWager({
          userId,
          leagueId: str(args.leagueId, "leagueId"),
          matchupId: num(args.matchupId, "matchupId"),
          kind,
          sideRoster: num(args.sideRoster, "sideRoster"),
          line: num(args.line, "line"),
          stake: num(args.stake, "stake"),
        }),
      );
    }
    case "pullWager": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const { pullWager } = await import("@/lib/league/wagers.server");
      await pullWager(userId, str(args.leagueId, "leagueId"), str(args.wagerId, "wagerId"));
      return { ok: true };
    }
    case "makePick": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const { makePick } = await import("@/lib/league/engine.server");
      await makePick(userId, str(args.leagueId, "leagueId"), str(args.playerId, "playerId"));
      return { ok: true };
    }
    case "queueAdd": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const { queueAdd } = await import("@/lib/league/engine.server");
      await queueAdd(userId, str(args.leagueId, "leagueId"), str(args.playerId, "playerId"));
      return { ok: true };
    }
    case "voteTrade": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const { voteTrade } = await import("@/lib/league/ops.server");
      if (typeof args.accept !== "boolean") throw new Error("accept must be boolean");
      await voteTrade(
        userId,
        str(args.leagueId, "leagueId"),
        str(args.tradeId, "tradeId"),
        args.accept,
      );
      return { ok: true };
    }
    case "previewImport": {
      const { previewSleeperImport } = await import("@/lib/league/engine.server");
      const includeHistory = args.includeHistory === true;
      return asJson(await previewSleeperImport(str(args.sleeperId, "sleeperId"), includeHistory));
    }
    case "importLeague": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      if (args.confirm !== true) {
        throw new Error("importLeague requires confirm: true");
      }
      const { importSleeperLeague } = await import("@/lib/league/engine.server");
      const claim =
        args.claimRosterId == null || args.claimRosterId === ""
          ? null
          : num(args.claimRosterId, "claimRosterId");
      return asJson(
        await importSleeperLeague({
          userId,
          sleeperId: str(args.sleeperId, "sleeperId"),
          claimRosterId: claim,
          includeHistory: args.includeHistory === true,
        }),
      );
    }
    default:
      throw new Error(`Unknown tool: ${id}`);
  }
}
