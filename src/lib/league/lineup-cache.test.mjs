import { test } from "bun:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { invalidateAfterLineup, invalidateAfterRosterMove } from "./lineup-cache";

test("lineup invalidate refetches inactive matchups", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  let n = 0;
  const key = ["matchups", "lg1", 1];
  await qc.fetchQuery({
    queryKey: key,
    queryFn: () => ({ n: ++n }),
  });
  assert.equal(qc.getQueryData(key).n, 1);
  assert.equal(qc.getQueryState(key)?.isInvalidated, false);

  await invalidateAfterLineup(qc, "lg1");

  assert.equal(qc.getQueryData(key).n, 2);
  assert.equal(qc.getQueryState(key)?.isInvalidated, false);
});

test("roster move invalidates team and projections", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
  const teamKey = ["team", "lg1", 1, 1];
  const projKey = ["projections", "lg1", 1, "a,b,c"];
  await qc.fetchQuery({ queryKey: teamKey, queryFn: () => ({ n: 1 }) });
  await qc.fetchQuery({ queryKey: projKey, queryFn: () => ({ n: 1 }) });
  assert.equal(qc.getQueryState(teamKey)?.isInvalidated, false);
  assert.equal(qc.getQueryState(projKey)?.isInvalidated, false);

  await invalidateAfterRosterMove(qc, "lg1");

  assert.equal(qc.getQueryState(teamKey)?.isInvalidated, true);
  assert.equal(qc.getQueryState(projKey)?.isInvalidated, true);
});
