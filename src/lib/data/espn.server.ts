import type {
  BoxGroup,
  GameDrive,
  GamePlay,
  GameSummary,
  NewsItem,
  ScoreGame,
  ScoreTeam,
  ScoringPlay,
  TeamBox,
} from "./types";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

type EspnEvent = {
  id: string;
  name: string;
  shortName?: string;
  date: string;
  status: { type: { state: string; shortDetail?: string; detail?: string } };
  competitions: Array<{
    competitors: Array<{
      homeAway: "home" | "away";
      score: string;
      winner?: boolean;
      team: { abbreviation: string; displayName: string; logo?: string };
      records?: Array<{ summary: string }>;
    }>;
  }>;
};

type EspnBoard = {
  week?: { number: number };
  season?: { year: number; type?: number; slug?: string };
  events?: EspnEvent[];
};

const cache = new Map<string, { at: number; data: unknown }>();

async function eget<T>(url: string, ttl: number): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttl) return hit.data as T;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`ESPN failed (${res.status})`);
  const data = (await res.json()) as T;
  cache.set(url, { at: Date.now(), data });
  return data;
}

function mapTeam(c: EspnEvent["competitions"][0]["competitors"][0]): ScoreTeam {
  return {
    abbr: c.team.abbreviation,
    name: c.team.displayName,
    logo: c.team.logo ?? "",
    score: c.score ?? "0",
    winner: typeof c.winner === "boolean" ? c.winner : null,
    record: c.records?.[0]?.summary ?? null,
  };
}

export async function fetchScoreboard(opts?: {
  week?: number;
  season?: number;
  seasonType?: number;
}): Promise<{ games: ScoreGame[]; week: number; season: number; seasonType: string }> {
  const qs = new URLSearchParams();
  if (opts?.week) qs.set("week", String(opts.week));
  if (opts?.season) qs.set("dates", String(opts.season));
  if (opts?.seasonType) qs.set("seasontype", String(opts.seasonType));
  const url = `${ESPN}/scoreboard${qs.size ? `?${qs}` : ""}`;
  const board = await eget<EspnBoard>(url, 12_000);
  const week = board.week?.number ?? opts?.week ?? 0;
  const season = board.season?.year ?? opts?.season ?? 0;
  const typeNum = board.season?.type ?? opts?.seasonType ?? 2;
  const seasonType = typeNum === 1 ? "pre" : typeNum === 3 ? "post" : "regular";
  const games: ScoreGame[] = (board.events ?? []).map((ev) => {
    const comp = ev.competitions?.[0];
    const homeC = comp?.competitors.find((c) => c.homeAway === "home");
    const awayC = comp?.competitors.find((c) => c.homeAway === "away");
    const stateRaw = ev.status.type.state;
    const state: ScoreGame["state"] =
      stateRaw === "in" ? "in" : stateRaw === "post" ? "post" : "pre";
    return {
      id: ev.id,
      name: ev.name,
      shortName: ev.shortName ?? ev.name,
      date: ev.date,
      state,
      detail: ev.status.type.shortDetail ?? ev.status.type.detail ?? "",
      week,
      season,
      seasonType,
      home: homeC
        ? mapTeam(homeC)
        : { abbr: "—", name: "TBD", logo: "", score: "", winner: null, record: null },
      away: awayC
        ? mapTeam(awayC)
        : { abbr: "—", name: "TBD", logo: "", score: "", winner: null, record: null },
    };
  });
  return { games, week, season, seasonType };
}

export async function fetchNews(): Promise<NewsItem[]> {
  const data = await eget<{
    articles?: Array<{
      id?: string | number;
      headline?: string;
      description?: string;
      published?: string;
      images?: Array<{ url?: string }>;
      links?: { web?: { href?: string } };
    }>;
  }>(`${ESPN}/news?limit=8`, 180_000);
  return (data.articles ?? []).slice(0, 8).map((a, i) => ({
    id: String(a.id ?? i),
    headline: a.headline ?? "Headline",
    description: a.description ?? "",
    published: a.published ?? "",
    image: a.images?.[0]?.url ?? null,
    link: a.links?.web?.href ?? null,
  }));
}

type RawAthlete = {
  athlete?: {
    id?: string;
    displayName?: string;
    jersey?: string;
    headshot?: { href?: string };
  };
  stats?: string[];
};

type RawStatGroup = {
  name?: string;
  labels?: string[];
  athletes?: RawAthlete[];
};

type RawBoxTeam = {
  team?: {
    abbreviation?: string;
    displayName?: string;
    logo?: string;
  };
  statistics?: RawStatGroup[];
};

type RawTeamStat = {
  name?: string;
  label?: string;
  displayValue?: string;
};

type RawPlay = {
  id?: string;
  text?: string;
  type?: { text?: string };
  scoringPlay?: boolean;
  period?: { number?: number };
  clock?: { displayValue?: string };
  awayScore?: number;
  homeScore?: number;
  statYardage?: number;
};

type RawDrive = {
  id?: string;
  description?: string;
  result?: string;
  displayResult?: string;
  team?: { abbreviation?: string; logo?: string };
  start?: { text?: string };
  plays?: RawPlay[];
};

type RawScoring = {
  id?: string;
  text?: string;
  type?: { text?: string };
  period?: { number?: number };
  clock?: { displayValue?: string };
  awayScore?: number;
  homeScore?: number;
  team?: { abbreviation?: string; logo?: string };
};

type RawSummary = {
  header?: {
    id?: string;
    name?: string;
    week?: number | { number?: number };
    season?: { year?: number; type?: number };
    competitions?: Array<{
      date?: string;
      status?: { type?: { state?: string; shortDetail?: string; detail?: string } };
      situation?: {
        shortDownDistanceText?: string;
        possessionText?: string;
        lastPlay?: { text?: string };
        downDistanceText?: string;
      };
      competitors?: Array<{
        homeAway: "home" | "away";
        score?: string;
        winner?: boolean;
        team?: { abbreviation?: string; displayName?: string; logo?: string };
        records?: Array<{ summary?: string }>;
      }>;
    }>;
  };
  boxscore?: {
    players?: RawBoxTeam[];
    teams?: Array<{
      team?: { abbreviation?: string };
      statistics?: RawTeamStat[];
    }>;
  };
  scoringPlays?: RawScoring[];
  drives?: { current?: RawDrive; previous?: RawDrive[] };
};

const TEAM_STAT_KEEP = new Set([
  "firstDowns",
  "thirdDownEff",
  "fourthDownEff",
  "totalYards",
  "netPassingYards",
  "rushingYards",
  "turnovers",
  "possessionTime",
  "totalPenaltiesYards",
  "sacksYardsLost",
]);

const BOX_GROUPS = [
  "passing",
  "rushing",
  "receiving",
  "kicking",
  "defensive",
  "interceptions",
  "kickReturns",
  "puntReturns",
] as const;

const BOX_LABEL: Record<string, string> = {
  passing: "Passing",
  rushing: "Rushing",
  receiving: "Receiving",
  kicking: "Kicking",
  defensive: "Defense",
  interceptions: "Interceptions",
  kickReturns: "Kick returns",
  puntReturns: "Punt returns",
};

function mapPlay(p: RawPlay): GamePlay | null {
  const text = (p.text ?? "").trim();
  if (!text) return null;
  return {
    id: String(p.id ?? text),
    text,
    type: p.type?.text ?? "",
    scoring: Boolean(p.scoringPlay),
    period: p.period?.number ?? 0,
    clock: p.clock?.displayValue ?? "",
    awayScore: p.awayScore ?? 0,
    homeScore: p.homeScore ?? 0,
    yardage: typeof p.statYardage === "number" ? p.statYardage : null,
  };
}

function mapDrive(d: RawDrive): GameDrive | null {
  const plays = (d.plays ?? []).map(mapPlay).filter((p): p is GamePlay => Boolean(p));
  if (!plays.length && !d.description) return null;
  return {
    id: String(d.id ?? d.description ?? Math.random()),
    team: d.team?.abbreviation ?? "",
    logo: d.team?.logo ?? null,
    result: d.displayResult ?? d.result ?? "",
    description: d.description ?? "",
    start: d.start?.text ?? "",
    plays,
  };
}

export async function fetchGameSummary(eventId: string): Promise<GameSummary> {
  const url = `${ESPN}/summary?event=${encodeURIComponent(eventId)}`;
  const raw = await eget<RawSummary>(url, 8_000);
  const header = raw.header;
  const comp = header?.competitions?.[0];
  const homeC = comp?.competitors?.find((c) => c.homeAway === "home");
  const awayC = comp?.competitors?.find((c) => c.homeAway === "away");
  const stateRaw = comp?.status?.type?.state ?? "pre";
  const state: GameSummary["state"] =
    stateRaw === "in" ? "in" : stateRaw === "post" ? "post" : "pre";
  const typeNum = header?.season?.type ?? 2;

  function teamOf(
    c: NonNullable<typeof homeC> | undefined,
  ): ScoreTeam {
    return {
      abbr: c?.team?.abbreviation ?? "—",
      name: c?.team?.displayName ?? "TBD",
      logo: c?.team?.logo ?? "",
      score: c?.score ?? "0",
      winner: typeof c?.winner === "boolean" ? c.winner : null,
      record: c?.records?.[0]?.summary ?? null,
    };
  }

  const situationBits = [
    comp?.situation?.shortDownDistanceText,
    comp?.situation?.possessionText,
  ].filter(Boolean);
  const lastPlay = comp?.situation?.lastPlay?.text ?? null;

  const scoring: ScoringPlay[] = (raw.scoringPlays ?? []).map((s) => ({
    id: String(s.id ?? s.text ?? ""),
    team: s.team?.abbreviation ?? "",
    logo: s.team?.logo ?? null,
    text: s.text ?? "",
    type: s.type?.text ?? "",
    period: s.period?.number ?? 0,
    clock: s.clock?.displayValue ?? "",
    awayScore: s.awayScore ?? 0,
    homeScore: s.homeScore ?? 0,
  }));

  const prev = raw.drives?.previous ?? [];
  const cur = raw.drives?.current;
  const drives = [...prev, ...(cur ? [cur] : [])]
    .map(mapDrive)
    .filter((d): d is GameDrive => Boolean(d));

  const teamStatsByAbbr = new Map<string, { label: string; value: string }[]>();
  for (const t of raw.boxscore?.teams ?? []) {
    const abbr = t.team?.abbreviation ?? "";
    teamStatsByAbbr.set(
      abbr,
      (t.statistics ?? [])
        .filter((s) => s.name && TEAM_STAT_KEEP.has(s.name))
        .map((s) => ({ label: s.label ?? s.name ?? "", value: s.displayValue ?? "" })),
    );
  }

  const box: TeamBox[] = (raw.boxscore?.players ?? []).map((t) => {
    const abbr = t.team?.abbreviation ?? "";
    const groups: BoxGroup[] = [];
    for (const name of BOX_GROUPS) {
      const g = (t.statistics ?? []).find((s) => s.name === name);
      const rows = (g?.athletes ?? [])
        .filter((a) => a.athlete?.displayName)
        .map((a) => ({
          id: String(a.athlete?.id ?? a.athlete?.displayName),
          name: a.athlete!.displayName!,
          jersey: a.athlete?.jersey ?? null,
          headshot: a.athlete?.headshot?.href ?? null,
          stats: a.stats ?? [],
        }));
      if (!rows.length) continue;
      groups.push({
        name,
        label: BOX_LABEL[name] ?? name,
        headers: g?.labels ?? [],
        rows,
      });
    }
    return {
      abbr,
      name: t.team?.displayName ?? abbr,
      logo: t.team?.logo ?? "",
      groups,
      teamStats: teamStatsByAbbr.get(abbr) ?? [],
    };
  });

  return {
    id: String(header?.id ?? eventId),
    name: header?.name ?? `${awayC?.team?.abbreviation ?? ""} at ${homeC?.team?.abbreviation ?? ""}`,
    shortName: `${awayC?.team?.abbreviation ?? "AWAY"} @ ${homeC?.team?.abbreviation ?? "HOME"}`,
    date: comp?.date ?? "",
    state,
    detail: comp?.status?.type?.shortDetail ?? comp?.status?.type?.detail ?? "",
    week:
      typeof header?.week === "number"
        ? header.week
        : header?.week?.number ?? 0,
    season: header?.season?.year ?? 0,
    seasonType: typeNum === 1 ? "pre" : typeNum === 3 ? "post" : "regular",
    home: teamOf(homeC),
    away: teamOf(awayC),
    situation: situationBits.length ? situationBits.join(" · ") : null,
    lastPlay,
    scoring,
    drives,
    box,
  };
}
