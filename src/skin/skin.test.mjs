import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "../..");

test("styles.css references shape/type tokens by var, not literal", () => {
  const styles = readFileSync(join(root, "src/styles.css"), "utf8");
  assert.match(styles, /var\(--r-xs\)/);
  assert.match(styles, /var\(--font-stack-sans\)/);
  assert.doesNotMatch(styles, /--radius-xs:\s*8px/);
});

test("tokens.css defines the raw shape + type knobs", () => {
  const tokens = readFileSync(join(root, "src/skin/tokens.css"), "utf8");
  for (const name of [
    "--r-xs",
    "--r-sm",
    "--r-md",
    "--r-lg",
    "--r-xl",
    "--r-pill",
    "--font-stack-display",
    "--font-stack-sans",
    "--font-stack-mono",
  ]) {
    assert.match(tokens, new RegExp(`${name}:`), `tokens.css should define ${name}`);
  }
});

test("boxscore skin defines the full token contract", () => {
  const boxscore = readFileSync(join(root, "src/skin/skins/boxscore.css"), "utf8");
  for (const name of [
    "paper",
    "paper-raised",
    "paper-sunken",
    "band",
    "ink",
    "ink-2",
    "ink-3",
    "hairline",
    "hairline-strong",
    "brand",
    "brand-deep",
    "brand-strong",
    "brand-ink",
    "highlight",
    "alarm",
    "caution",
    "lift",
    "press-cast",
    "r-pill",
    "font-stack-sans",
  ]) {
    assert.match(boxscore, new RegExp(`--${name}:`), `boxscore.css should define --${name}`);
  }
});

test("theme.ts stores the skin under ledger-skin and stamps data-skin pre-paint", () => {
  const theme = readFileSync(join(root, "src/lib/theme.ts"), "utf8");
  assert.match(theme, /SKIN_KEY\s*=\s*"ledger-skin"/);
  assert.match(theme, /data-skin/);
  assert.match(theme, /NO_FLASH_SCRIPT/);
});
