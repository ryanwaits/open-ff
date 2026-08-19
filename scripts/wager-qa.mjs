#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
/**
 * Click through the FAAB book: sign in → new league → betting on → matchups.
 * Uses agent-browser (not Playwright). App must already be up on :8080.
 *
 * Exit 0 on live price stake OR honest no-price empty state.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { LOCAL_SEED } from "../src/lib/auth/local-seed.ts";

const base = "http://127.0.0.1:8080";
const root = join(import.meta.dirname, "..");
const shots = join(root, "screenshots");
const ab = process.env.AGENT_BROWSER_BIN || `${process.env.HOME || ""}/.bun/bin/agent-browser`;
const session = `wager-qa-${process.pid}`;

mkdirSync(shots, { recursive: true });

function probe() {
  const r = spawnSync("curl", ["-sf", "-o", "/dev/null", "--max-time", "2", `${base}/`], {
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(
      "WAGER_QA: app is down at http://127.0.0.1:8080/ — start with `bun run dev`, then re-run.",
    );
    process.exit(1);
  }
}

function run(args, opts = {}) {
  const r = spawnSync(ab, ["--session", session, ...args], {
    encoding: "utf8",
    cwd: root,
    ...opts,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  if (opts.allowFail) return { status: r.status ?? 1, out };
  if (r.status !== 0) {
    throw new Error(`agent-browser ${args.join(" ")} failed (${r.status}): ${out}`);
  }
  return { status: 0, out };
}

function evalJson(script) {
  const { out } = run(["eval", "--stdin"], { input: script });
  // agent-browser may wrap JSON; take the last JSON-looking chunk
  const start = out.indexOf("{") >= 0 ? out.indexOf("{") : out.indexOf("[");
  if (start < 0) throw new Error(`eval produced no JSON: ${out}`);
  return JSON.parse(out.slice(start));
}

function pageErrors() {
  const { out } = run(["errors", "--json"], { allowFail: true });
  try {
    const start = out.indexOf("{");
    if (start < 0) return [];
    const parsed = JSON.parse(out.slice(start));
    const errs = parsed?.data?.errors ?? parsed?.errors ?? [];
    return Array.isArray(errs) ? errs : [];
  } catch {
    return out && !/errors":\[\]/.test(out) ? [out] : [];
  }
}

function clearPageErrors() {
  run(["errors", "--clear"], { allowFail: true });
}

function assertNoPageErrors(where) {
  // SSR skeleton vs client content on settings/matchups trips React hydration
  // warnings in headless chrome; they recover client-side. Fail on everything else.
  const errs = pageErrors().filter((e) => {
    const text = typeof e === "string" ? e : e?.text || JSON.stringify(e);
    return !/Hydration failed because the server rendered/i.test(text);
  });
  if (errs.length) {
    throw new Error(`pageerror at ${where}: ${JSON.stringify(errs)}`);
  }
}

probe();

let leagueId = null;
try {
  run(["open", `${base}/login`]);
  run(["wait", "--load", "networkidle"]);
  clearPageErrors();
  run(["find", "placeholder", "you@league.com", "fill", LOCAL_SEED.email]);
  run(["find", "placeholder", "Password", "fill", LOCAL_SEED.password]);
  run(["find", "role", "button", "click", "--name", "Sign in"]);
  run(["wait", "--load", "networkidle"]);
  {
    const { out } = run(["get", "url"]);
    if (out.includes("/login")) {
      throw new Error("Login failed — still on /login (seed missing?)");
    }
  }
  assertNoPageErrors("after login");

  run(["open", `${base}/new`]);
  run(["wait", "--load", "networkidle"]);
  clearPageErrors();
  run(["find", "placeholder", "The Backyard", "fill", "Wager QA Desk"]);
  run(["find", "placeholder", "Night Desk", "fill", "Night Desk"]);
  run(["find", "role", "button", "click", "--name", "Open the league"]);
  run(["wait", "--url", "**/league/lg_*"]);
  run(["wait", "--load", "networkidle"]);
  {
    const { out } = run(["get", "url"]);
    leagueId = out.match(/league\/(lg_[a-z0-9]+)/)?.[1] ?? null;
    if (!leagueId) throw new Error(`No league id in ${out}`);
  }

  // Fresh creates can land with seats filled but week 1 unassigned —
  // rebuild so matchups (and LinePanel) exist.
  run(["open", `${base}/league/${leagueId}/settings`]);
  run(["wait", "--load", "networkidle"]);
  run(["wait", "--text", "The book"]);
  run(["wait", "600"]);
  clearPageErrors();
  {
    const body = evalJson(
      `({ hasRebuild: [...document.querySelectorAll("button")].some(b => /Rebuild unplayed weeks/i.test(b.textContent || "")), unassigned: /unassigned/i.test(document.body.innerText) })`,
    );
    if (body.hasRebuild && body.unassigned) {
      run(["find", "role", "button", "click", "--name", "Rebuild unplayed weeks"]);
      run(["wait", "1500"]);
    }
  }

  run(["find", "role", "button", "click", "--name", "On", "--exact"]);
  run(["find", "role", "button", "click", "--name", "Save settings"]);
  run(["wait", "1500"]);
  run(["wait", "--load", "networkidle"]);
  assertNoPageErrors("after settings save");

  run(["open", `${base}/league/${leagueId}/matchups`]);
  run(["wait", "--load", "networkidle"]);
  run(["wait", "1200"]);
  clearPageErrors();
  const counts = evalJson(`({
    price: document.querySelectorAll('[data-testid="wager-price"]').length,
    noPrice: document.querySelectorAll('[data-testid="wager-no-price"]').length,
    theLine: /The line/i.test(document.body.innerText),
    noMatchups: /No matchups this week/i.test(document.body.innerText),
  })`);

  if (!counts.price && !counts.noPrice) {
    throw new Error(
      `LinePanel never rendered after betting save (price=${counts.price} noPrice=${counts.noPrice} theLine=${counts.theLine} noMatchups=${counts.noMatchups}). Product bug or empty slate.`,
    );
  }

  if (counts.price > 0) {
    const clicked = evalJson(`(() => {
      const btns = [...document.querySelectorAll('[data-testid="wager-price"]')];
      const live = btns.find(b => !b.disabled);
      if (!live) return { ok: false, reason: "all price buttons disabled" };
      live.click();
      return { ok: true };
    })()`);
    if (!clicked.ok) throw new Error(clicked.reason || "no live price to click");
    run(["wait", "400"]);
    run(["find", "testid", "wager-stake", "fill", "1"]);
    run(["find", "testid", "wager-submit", "click"]);
    run(["wait", "1200"]);
    const placed = evalJson(`({
      toast: /\\$1 on /i.test(document.body.innerText),
      placedBtn: /Wager placed/i.test(document.body.innerText),
    })`);
    if (!placed.toast && !placed.placedBtn) {
      throw new Error("Stake submitted but no success toast / placed state");
    }
    run(["screenshot", join(shots, "wager-ticket.png")]);
    assertNoPageErrors("after stake");
    console.log(
      JSON.stringify({ ok: true, path: "price", leagueId, shot: "screenshots/wager-ticket.png" }),
    );
  } else {
    run(["screenshot", join(shots, "wager-no-price.png")]);
    assertNoPageErrors("no-price");
    console.log(
      "WAGER_QA: line not live (preseason / no projections) — ticket UI mounted, no stake placed.",
    );
    console.log(
      JSON.stringify({
        ok: true,
        path: "no-price",
        leagueId,
        shot: "screenshots/wager-no-price.png",
      }),
    );
  }
  process.exit(0);
} catch (err) {
  try {
    run(["screenshot", join(shots, "wager-qa-fail.png")], { allowFail: true });
  } catch {
    /* ignore */
  }
  console.error(
    JSON.stringify({ ok: false, error: String(err?.message || err), leagueId }, null, 2),
  );
  process.exit(1);
} finally {
  spawnSync(ab, ["--session", session, "close"], { encoding: "utf8" });
}
