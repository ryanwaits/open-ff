import assert from "node:assert/strict";
import { test } from "node:test";
import {
  configuredGrokProviders,
  configuredLoginSocials,
  nativeGoogleConfigured,
} from "./providers.ts";

function withEnv(keys, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(keys)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("native Google is off unless both env vars are non-empty", () => {
  withEnv({ GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined }, () => {
    assert.equal(nativeGoogleConfigured(), false);
  });
  withEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: undefined }, () => {
    assert.equal(nativeGoogleConfigured(), false);
  });
  withEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "  " }, () => {
    assert.equal(nativeGoogleConfigured(), false);
  });
  withEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" }, () => {
    assert.equal(nativeGoogleConfigured(), true);
  });
});

test("login socials: no Google without broker or native env", () => {
  withEnv(
    {
      GROK_AUTH_CLIENT_ID: undefined,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
    },
    () => {
      assert.deepEqual(configuredGrokProviders("localhost"), []);
      assert.deepEqual(configuredLoginSocials("localhost"), []);
    },
  );
});

test("login socials: native Google off-sandbox when both env vars set", () => {
  withEnv(
    {
      GROK_AUTH_CLIENT_ID: undefined,
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
    },
    () => {
      assert.deepEqual(configuredLoginSocials("localhost"), [
        { providerId: "google", label: "Google", kind: "native" },
      ]);
    },
  );
});
