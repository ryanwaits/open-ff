/**
 * MCP stdio allowlist (042). Subset of AGENT_TOOLS — not the full catalog.
 * Add an id here + a dispatch branch to expose a new verb over MCP.
 */
export const AGENT_CORE: ReadonlySet<string> = new Set([
  // reads
  "getAgentContext",
  "listMyLeagues",
  "getTeam",
  "getBook",
  "getMatchups",
  "getWire",
  "getDraft",
  "getSettings",
  "getEvents",
  "getLeagueFacts",
  // atoms
  "sitPlayer",
  "startPlayer",
  "dropPlayer",
  "placeWager",
  "pullWager",
  "makePick",
  "queueAdd",
  "voteTrade",
  // migrate
  "previewImport",
  "importLeague",
]);
