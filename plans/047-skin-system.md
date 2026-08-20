# 047 — Runtime skin system (Ledger + Box Score, N skins later)

> Reconciled 2026-08-20 at `84d684e`. Finding still live (`data-skin` not in
> app source). `__root.tsx` now mounts `PushRegister` (037) — keep it. Still
> design-incomplete: `review-plan` before execute.

**Goal:** `data-skin` on `<html>` switches the whole look — colors, radii, type,
label voice, button/card structure — at runtime, like `data-theme` does for
light/dark. Ledger stays byte-identical as default. Box Score ships as the
second skin, proving the axis. Skin × theme is a matrix: every skin defines
light + dark.

**Non-goals:** no component forks per skin, no CSS-in-JS, no engine/auth
changes (skin SKILL.md "do not edit" list holds). `data-accent` ramp survives
as a Ledger-internal knob.

Design source: the "Box Score" canvas (claude.ai artifact `a9ee7f62`),
Tokens + DarkTokens artboards are the palette of record.

## Phase A — make skin a token axis (no visual change)

1. `src/skin/tokens.css`: current `:root` values become the implicit `ledger`
   skin (unchanged selectors → zero regression). Add raw tokens for what
   `@theme inline` currently hardcodes: `--r-xs…--r-xl`, `--r-pill`,
   `--font-stack-display/sans/mono`.
2. `src/styles.css` `@theme inline`: point `--radius-*`, `--font-*` at those
   vars instead of literals. `--shadow-border` already composes vars; add
   `--rule` (row divider color) token, alias `--color-line` to it.
3. Verify: build + typecheck + screenshot diff — pixel-identical.

## Phase B — skin plumbing

1. `src/lib/theme.ts`: add `skinPref` (localStorage `skin`, default `ledger`)
   beside theme pref; stamp `data-skin` in the same pre-paint inline script in
   `__root.tsx` (no flash). Keep `theme-color` meta in sync per skin+mode.
2. Settings (league setup → appearance, plus the shell toggle area): skin
   picker. Per-user pref only in this slice.

## Phase C — semantic voice classes (the codemod)

Mechanical, Ledger-identical output:

1. `.microlabel` utility = today's `font-mono text-[10px/11px] uppercase
   tracking-*` recipe, defined once in styles.css under `[data-skin]` scope.
   Codemod ~190 call sites. Box Score restyles it italic 12px (or agate caps
   for table heads — second class `.field-label`).
2. `.push`: keep name; per-skin block. Ledger = 3D press. Box Score = flat
   blue pill, no transform.
3. `.hl`: per-skin band color/thickness (Ledger `--highlight`, Box Score
   `--tint` at baseline).
4. `.card` utility = `bg-surface rounded-xl shadow-[var(--shadow-border)]`
   (100+ sites). Ledger keeps lift; Box Score sets `--lift: 0 0 #0000` and
   ring → hairline rule, radius 0 via Phase A tokens. Zebra: components
   already use `border-line` + `bg` tokens, so white-row look falls out of
   token values; `bg-raised` rows (129 sites) read as "earned fill" — audit
   the handful that are texture-not-signal.

## Phase D — boxscore skin file

`src/skin/skins/boxscore.css`, imported after tokens.css:
`[data-skin="boxscore"]` + dark blocks. Values from the canvas:
paper `#FBFAF6`, panel `#F1F0EA`, panel-2 `#E9E8E1`, hairline `#CFCEC5`,
ink `#101114/#54565A/#8F9194`, brand `#2118C8`, deep `#150E9E`, link
`#2B46E0`, tint `#B9C0EE`, wash `#E9EBF8`, alarm `#D2422E` (marks only);
dark: paper `#141519`, ink `#ECEBE4`, blue `#2A2BDC`, link `#8691F7`,
hair `#2E2F34`, alarm `#EE6A52`. Radii 0 (pill 999), Helvetica stack,
lift none.

## Phase E — flourishes (ships with D)

Ghost numerals (`<GhostNum>` renders per-page number, `display:none` in
ledger), gray slot rails, agate spec tables, stamp/barcode on recap. Each is
additive CSS/components gated on `[data-skin="boxscore"]`.

## QA gate

Per phase: `bun run typecheck && bun run build && bun run lint`. Screenshot
both skins × both modes on home/standings/matchups/player (agent-browser).
Ledger default must be pixel-identical through Phase C.

## Execution notes (read before starting — file-level map)

**Slice order:** A → B → minimal D (token-only boxscore so the picker is real)
→ C (codemod) → full D+E. A picker with one skin is pointless; minimal D ships
in slice 1.

- `src/lib/theme.ts` — pattern to copy: `THEME_KEY`/`readPref`/
  `useSyncExternalStore` + `NO_FLASH_SCRIPT` string. Add `SKIN_KEY="ledger-skin"`,
  `SkinPref = "ledger" | "boxscore"`, `useSkin()`. Convention: ledger = attribute
  ABSENT (like data-accent); only stamp `data-skin="boxscore"`. Extend
  `NO_FLASH_SCRIPT` to stamp skin in the same pre-paint pass (it is already
  inlined in `__root.tsx` head).
- `src/routes/__root.tsx` — `theme-color` metas are hardcoded to Ledger cream/
  dark (`#f7f4ea`/`#14161a`) via `prefers-color-scheme` media. Skin switch must
  update them at runtime (small effect in RootDocument keyed on skin+resolved;
  boxscore: `#fbfaf6`/`#141519`). Google Fonts link (Jakarta/JetBrains) stays —
  Box Score uses system Helvetica, loads nothing extra.
- `src/styles.css` — `@theme inline` radii (`--radius-xs: 8px` … literals) and
  fonts (`--font-display` literal stacks) become `var(--r-*)` /
  `var(--font-stack-*)` references. `@theme inline` emits the var reference
  into utilities, so runtime swap works like the colors already do.
- `src/skin/tokens.css` — add to `:root` (Ledger values): `--r-xs:8px --r-sm:10px
  --r-md:14px --r-lg:18px --r-xl:22px --r-pill:999px`, `--font-stack-display/
  sans/mono` (current Jakarta/JetBrains stacks).
- `src/skin/skins/boxscore.css` (new, imported after tokens.css):
  `[data-skin="boxscore"]` light + dark blocks per the palette in Phase D;
  radii → 0 except `--r-pill:999px`; Helvetica/Courier stacks; `--lift: 0 0 #0000`.
- Skin picker: settings page appearance area + document in shell; per-user only.
- Toaster in `__root.tsx` uses `rounded-lg` + literal shadow classNames — swept
  up by Phase C `.card`/token pass, fine in slice 1 (radius token makes it
  square already).
- `src/skin/SKILL.md` rewrite lands in Phase B (decision 6).

**QA slice 1:** typecheck/build/lint green; agent-browser screenshots of home +
standings in ledger (must be pixel-identical to today) and boxscore light/dark.

## Decisions (2026-08-19)

1. Skin scope: **per-user** localStorage pref only. No DB column.
2. `data-accent="blue"`: **keep** as a Ledger-internal knob (orthogonal:
   accent = color-within-a-skin, skin = whole look). ~30 lines, harmless.
   Kill later if two-blues confusion shows up.
3. Fonts are per-skin tokens: **Ledger keeps Plus Jakarta / JetBrains Mono;
   Box Score matches the mocks** — Helvetica Neue system stack
   (`"Helvetica Neue", Helvetica, Arial, sans-serif`), Courier stack for
   record-ID mono. No webfont license needed.
4. **Ledger stays default** for now.
5. Phase E flourishes ship **with the first Box Score release** (ghost
   numerals, slot rails, agate spec tables, recap stamp).
6. grok.me is no longer a constraint. Rewrite `src/skin/SKILL.md` to
   document the runtime skin system (how to author a skin file); prune the
   grok.me-HOSTING paragraphs (Grok install tutorial, host-slug naming,
   fork-and-edit contract). **PWA itself is untouched and load-bearing** —
   manifest, `grok-pwa` middleware, and A2HS install path all stay; the
   install UX upgrade is plan 048. The "do not edit" engine/auth list holds.
