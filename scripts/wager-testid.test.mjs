import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");

test("wager ticket + line panel expose stable data-testids", () => {
  const ticket = readFileSync(join(root, "src/components/wager-ticket.tsx"), "utf8");
  const book = readFileSync(join(root, "src/components/book-panel.tsx"), "utf8");
  assert.match(ticket, /data-testid="wager-stake"/);
  assert.match(ticket, /data-testid="wager-submit"/);
  assert.match(book, /data-testid="wager-price"/);
  assert.match(book, /data-testid="wager-no-price"/);
});
