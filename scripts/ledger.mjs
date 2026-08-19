#!/usr/bin/env bun
/**
 * Read-only ledger CLI.
 *
 *   bun scripts/ledger.mjs --help
 *   bun scripts/ledger.mjs getEvents --league <id> --limit 20
 *   bun scripts/ledger.mjs getLeagueFacts --league <id> --week <n>
 *   bun scripts/ledger.mjs getAgentContext --league <id> --user <id>
 *
 * --help / --list work with zero DB (catalog import only).
 *
 * Live reads import `events.server` / `league-facts.server` /
 * `agent-context.server`, which call `getSql()`. bun has no Vite
 * `import.meta.glob`, so the PGLite fallback cannot migrate here. Set
 * `DATABASE_URL` to the same Postgres the app uses, or run reads through
 * the running app.
 *
 * Mutating catalog entries (placeWager, makePick, …) are listed in --help
 * but are not dispatched from argv.
 */
import { AGENT_TOOLS } from "../src/lib/agent/catalog.ts";

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--list") out.list = true;
    else if (a === "--json") out.json = argv[++i];
    else if (a.startsWith("--") && a.length > 2) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next != null && !next.startsWith("--")) {
        i += 1;
        out[key] = next;
      } else {
        out[key] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function printHelp() {
  const lines = [
    "Read-only ledger CLI. Mutating tools are listed, not dispatched.",
    "",
    "Usage:",
    "  bun scripts/ledger.mjs --help",
    "  bun scripts/ledger.mjs --list",
    "  bun scripts/ledger.mjs getEvents --league <id> [--limit n] [--sinceWeek n]",
    "  bun scripts/ledger.mjs getLeagueFacts --league <id> --week <n>",
    "  bun scripts/ledger.mjs getAgentContext --league <id> --user <id>",
    "",
    "Live reads need DATABASE_URL (same Postgres as the app) or the running app.",
    "bun cannot boot the PGLite fallback (no import.meta.glob).",
    "--user is the seat holder's user id (dump is their purse).",
    "",
    "Tools:",
  ];
  const idW = Math.max(...AGENT_TOOLS.map((t) => t.id.length));
  for (const t of AGENT_TOOLS) {
    lines.push(`  ${t.id.padEnd(idW)}  ${t.scope.padEnd(9)}  ${t.kind.padEnd(8)}  ${t.title}`);
  }
  console.log(lines.join("\n"));
}

function payloadOf(args) {
  const json = args.json ? JSON.parse(args.json) : {};
  return {
    leagueId: args.league ?? args.leagueId ?? json.leagueId,
    limit: args.limit != null ? Number(args.limit) : json.limit,
    sinceWeek: args.sinceWeek != null ? Number(args.sinceWeek) : json.sinceWeek,
    week: args.week != null ? Number(args.week) : json.week,
    userId: args.user ?? args.userId ?? json.userId,
  };
}

async function dispatchRead(id, args) {
  const data = payloadOf(args);
  if (id === "getEvents") {
    if (!data.leagueId) fail("getEvents requires --league <id>");
    const ev = await import("../src/lib/league/events.server.ts");
    return ev.readEvents(data.leagueId, {
      limit: Number.isFinite(data.limit) ? data.limit : undefined,
      sinceWeek: Number.isFinite(data.sinceWeek) ? data.sinceWeek : undefined,
    });
  }
  if (id === "getLeagueFacts") {
    if (!data.leagueId || !Number.isFinite(data.week)) {
      fail("getLeagueFacts requires --league <id> --week <n>");
    }
    const facts = await import("../src/lib/league/league-facts.server.ts");
    return facts.loadLeagueFacts(data.leagueId, data.week);
  }
  if (id === "getAgentContext") {
    if (!data.leagueId || !data.userId) {
      fail("getAgentContext requires --league <id> --user <id>");
    }
    const ctx = await import("../src/lib/league/agent-context.server.ts");
    return ctx.loadAgentContext(data.leagueId, data.userId);
  }
  fail(
    `${id} is a catalogued read but this CLI slice only dispatches getEvents, getLeagueFacts, and getAgentContext.`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const id = args._[0];
  if (args.help || args.list || !id) {
    printHelp();
    process.exit(0);
  }

  const tool = AGENT_TOOLS.find((t) => t.id === id);
  if (!tool) fail(`Unknown tool ${id}. bun scripts/ledger.mjs --help`);
  if (tool.mutating) {
    fail(`${id} is mutating and is not dispatched from this CLI. See src/lib/agent/CATALOG.md.`);
  }

  try {
    const result = await dispatchRead(id, args);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    fail(
      `${msg}\nLive reads need DATABASE_URL (same Postgres as the app). bun cannot boot PGLite (no import.meta.glob).`,
    );
  }
}

await main();
