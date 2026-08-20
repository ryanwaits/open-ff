import assert from "node:assert/strict";
import { test } from "node:test";
import { notifyRoster } from "./send.server.ts";

test("notifyRoster is a no-op without VAPID keys", async () => {
  const prevPub = process.env.VAPID_PUBLIC_KEY;
  const prevPriv = process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  try {
    await notifyRoster("lg_test", 1, {
      kind: "clock",
      title: "You're on the clock",
      body: "It's your pick.",
      url: "/league/lg_test/draft",
    });
  } finally {
    if (prevPub === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = prevPub;
    if (prevPriv === undefined) delete process.env.VAPID_PRIVATE_KEY;
    else process.env.VAPID_PRIVATE_KEY = prevPriv;
  }
  assert.ok(true);
});
