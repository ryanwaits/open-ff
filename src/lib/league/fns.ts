import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";

export const listMyLeagues = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => {
    if (!context.userId) return [];
    const eng = await import("./engine.server");
    return eng.listMyLeagues(context.userId);
  });

export const createLeague = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string(),
      teamName: z.string(),
      teamCount: z.number(),
      scoring: z.enum(["ppr", "half", "std"]),
      fillHouse: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    return eng.createLeague({ userId: context.userId, ...data });
  });

export const joinLeague = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      code: z.string(),
      teamName: z.string(),
      rosterId: z.number().nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    return eng.joinLeague(context.userId, data.code, data.teamName, data.rosterId);
  });

export const previewInvite = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string() }))
  .handler(async ({ data }) => {
    const eng = await import("./engine.server");
    return eng.previewInvite(data.code);
  });

export const getDesk = createServerFn({ method: "GET" })
  .validator(z.object({ leagueId: z.string(), week: z.number() }))
  .handler(async ({ data }) => {
    const eng = await import("./engine.server");
    return eng.loadDesk(data.leagueId, data.week);
  });

export const getDraft = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string(), position: z.string(), query: z.string() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.ensureDemo();
    await eng.flushHousePicks(data.leagueId);
    return eng.loadDraft(data.leagueId, context.userId, data.position, data.query);
  });

/** ~250 players scored under this league's book — mock draft only; no writes. */
export const getMockPool = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ data }) => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { scoringBookFor, perGameUnder } = await import("@/lib/data/projections.server");
    const { getPlayer } = await import("@/lib/data/sleeper.server");
    const book = await scoringBookFor(data.leagueId);
    const seed = JSON.parse(
      readFileSync(join(process.cwd(), "data/stats-2025.json"), "utf8"),
    ) as { player_id: string }[];
    const out: {
      playerId: string;
      name: string;
      position: string | null;
      team: string | null;
      pts: number;
    }[] = [];
    for (const row of seed) {
      const p = getPlayer(row.player_id);
      if (!p?.position) continue;
      const pts = perGameUnder(book, row.player_id);
      if (pts == null) continue;
      out.push({
        playerId: row.player_id,
        name: p.full_name,
        position: p.position,
        team: p.team ?? null,
        pts,
      });
    }
    out.sort((a, b) => b.pts - a.pts);
    return out.slice(0, 250);
  });

export const startDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.startDraft(context.userId, data.leagueId);
    return { ok: true };
  });

export const makePick = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string(), playerId: z.string() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.makePick(context.userId, data.leagueId, data.playerId);
    return { ok: true };
  });

export const queueAdd = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string(), playerId: z.string() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.queueAdd(context.userId, data.leagueId, data.playerId);
    return { ok: true };
  });

export const queueRemove = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string(), playerId: z.string() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.queueRemove(context.userId, data.leagueId, data.playerId);
    return { ok: true };
  });

export const queueReorder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string(), playerIds: z.array(z.string()) }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.queueReorder(context.userId, data.leagueId, data.playerIds);
    return { ok: true };
  });

export const setAutodraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string(), on: z.boolean() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.setAutodraft(context.userId, data.leagueId, data.on);
    return { ok: true };
  });

export const autoFillDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.autoFillDraft(context.userId, data.leagueId);
    return { ok: true };
  });

export const startPlayer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      leagueId: z.string(),
      playerId: z.string(),
      replaceId: z.string().nullable().optional(),
      slot: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.startPlayer(context.userId, data.leagueId, data.playerId, data.replaceId, data.slot);
    return { ok: true };
  });

export const sitPlayer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string(), playerId: z.string() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.sitPlayer(context.userId, data.leagueId, data.playerId);
    return { ok: true };
  });

export const addDrop = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      leagueId: z.string(),
      addId: z.string(),
      dropId: z.string().nullable(),
      bid: z.number().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    return eng.addDrop(context.userId, data.leagueId, data.addId, data.dropId, data.bid ?? 0);
  });

export const previewImport = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ sleeperId: z.string() }))
  .handler(async ({ data }) => {
    const eng = await import("./engine.server");
    return eng.previewSleeperImport(data.sleeperId);
  });

export const importLeague = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ sleeperId: z.string(), claimRosterId: z.number().nullable() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    return eng.importSleeperLeague({
      userId: context.userId,
      sleeperId: data.sleeperId,
      claimRosterId: data.claimRosterId,
    });
  });

export const previewEspn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      leagueId: z.string(),
      season: z.string(),
      swid: z.string().optional(),
      espnS2: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const eng = await import("./engine.server");
    return eng.previewEspnImport({
      leagueId: data.leagueId,
      season: data.season,
      swid: data.swid || undefined,
      espnS2: data.espnS2 || undefined,
    });
  });

export const importEspn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      leagueId: z.string(),
      season: z.string(),
      claimRosterId: z.number().nullable(),
      swid: z.string().optional(),
      espnS2: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    return eng.importEspnLeague({ userId: context.userId, ...data });
  });

export const previewRebuild = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      paste: z.string().optional(),
      known: z.string().optional(),
      pdfBase64: z.string().optional(),
      teams: z
        .array(
          z.object({
            teamName: z.string(),
            manager: z.string(),
            wins: z.number().nullable(),
            losses: z.number().nullable(),
            ties: z.number().nullable(),
            pf: z.number().nullable(),
            pa: z.number().nullable(),
            names: z.array(z.string()),
          }),
        )
        .optional(),
      name: z.string(),
      season: z.string(),
      scoring: z.enum(["ppr", "half", "std"]),
    }),
  )
  .handler(async ({ data }) => {
    const eng = await import("./engine.server");
    return eng.previewRebuild(data);
  });

export const importRebuild = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      paste: z.string().optional(),
      known: z.string().optional(),
      teams: z
        .array(
          z.object({
            teamName: z.string(),
            manager: z.string(),
            wins: z.number().nullable(),
            losses: z.number().nullable(),
            ties: z.number().nullable(),
            pf: z.number().nullable(),
            pa: z.number().nullable(),
            names: z.array(z.string()),
          }),
        )
        .optional(),
      name: z.string(),
      season: z.string(),
      scoring: z.enum(["ppr", "half", "std"]),
      claimRosterId: z.number().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    return eng.importRebuild({ userId: context.userId, ...data });
  });

export const getSettings = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    return eng.loadSettings(data.leagueId, context.userId);
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      leagueId: z.string(),
      name: z.string().optional(),
      book: z.record(z.string(), z.number()).optional(),
      playoffTeams: z.number().optional(),
      currentWeek: z.number().optional(),
      waiverType: z.string().optional(),
      faabBudget: z.number().optional(),
      tradeDeadlineWeek: z.number().optional(),
      playoffStartWeek: z.number().optional(),
      regularWeeks: z.number().optional(),
      playoffByes: z.number().optional(),
      slots: z.array(z.string()).optional(),
      bettingOn: z.boolean().optional(),
      poolSeed: z.number().optional(),
      wagerCap: z.number().optional(),
      exposureCap: z.number().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.saveSettings(context.userId, data.leagueId, data);
    return { ok: true };
  });

export const claimRoster = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string(), rosterId: z.number() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.claimRoster(context.userId, data.leagueId, data.rosterId);
    return { ok: true };
  });

export const getClaims = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    const eng = await import("./engine.server");
    const mine = await eng.rosterIdOwnedBy(data.leagueId, context.userId ?? null);
    return ops.listClaims(data.leagueId, mine);
  });

export const cancelClaim = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string(), claimId: z.string() }))
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    await ops.cancelClaim(context.userId, data.leagueId, data.claimId);
    return { ok: true };
  });

export const processWaivers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.commishProcessWaivers(context.userId, data.leagueId);
  });

export const advanceWeek = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    await ops.commishAdvance(context.userId, data.leagueId);
    return { ok: true };
  });

export const getTrades = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ data }) => {
    const ops = await import("./ops.server");
    return ops.listTrades(data.leagueId);
  });

export const getTradablePicks = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ data }) => {
    const ops = await import("./ops.server");
    return ops.listTradablePicks(data.leagueId);
  });

export const proposeTrade = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      leagueId: z.string(),
      assets: z.array(
        z.object({
          fromRoster: z.number(),
          toRoster: z.number(),
          kind: z.enum(["player", "pick", "faab"]),
          playerId: z.string().nullable().optional(),
          pickNo: z.number().nullable().optional(),
          amount: z.number().nullable().optional(),
        }),
      ),
    }),
  )
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    return ops.proposeTrade(context.userId, data.leagueId, data.assets);
  });

export const voteTrade = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string(), tradeId: z.string(), accept: z.boolean() }))
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    await ops.voteTrade(context.userId, data.leagueId, data.tradeId, data.accept);
    return { ok: true };
  });

export const cancelTradeFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string(), tradeId: z.string() }))
  .handler(async ({ context, data }) => {
    const ops = await import("./ops.server");
    await ops.cancelTrade(context.userId, data.leagueId, data.tradeId);
    return { ok: true };
  });

export const getSchedule = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    return eng.loadSchedule(data.leagueId, context.userId);
  });

export const saveWeekSchedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      leagueId: z.string(),
      week: z.number(),
      pairs: z.array(
        z.object({
          home: z.number(),
          away: z.number().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.saveWeekSchedule(context.userId, data.leagueId, data.week, data.pairs);
    return { ok: true };
  });

export const rebuildSchedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.rebuildSchedule(context.userId, data.leagueId);
    return { ok: true };
  });

/* ------------------------------------------------------------------ book -- */

export const getBook = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string(), week: z.number().optional() }))
  .handler(async ({ context, data }) => {
    const book = await import("./book.server");
    return book.loadBook(data.leagueId, context.userId, data.week);
  });

export const placeWager = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      leagueId: z.string(),
      matchupId: z.number(),
      kind: z.enum(["spread", "moneyline"]),
      sideRoster: z.number(),
      line: z.number(),
      stake: z.number(),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await import("./wagers.server");
    return w.placeWager({ ...data, userId: context.userId });
  });

export const pullWager = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string(), wagerId: z.string() }))
  .handler(async ({ context, data }) => {
    const w = await import("./wagers.server");
    await w.pullWager(context.userId, data.leagueId, data.wagerId);
    return { ok: true };
  });
