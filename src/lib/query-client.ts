import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  type DehydratedState,
  type EnsureQueryDataOptions,
  hydrate,
  keepPreviousData,
  QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import {
  PERSIST_BUSTER,
  PERSIST_MAX_AGE_MS,
  PERSIST_STORAGE_KEY,
  shouldPersistQueryKey,
  shouldStaleOnRestore,
} from "./query-persist";

export type RouterContext = {
  queryClient: QueryClient;
};

/**
 * Cached hits resolve now and refresh in the background. Cold cache still waits.
 * Route loaders must use this — `ensureQueryData` blocks tab nav once staleTime elapses.
 */
export function warmQuery<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  client: QueryClient,
  options: EnsureQueryDataOptions<TQueryFnData, TError, TData, TQueryKey>,
): Promise<TData> {
  const cached = client.getQueryData<TData>(options.queryKey);
  if (cached !== undefined) {
    void client.prefetchQuery(options);
    return Promise.resolve(cached);
  }
  return client.ensureQueryData(options);
}

function restorePersistedClient(client: QueryClient) {
  try {
    const raw = window.localStorage.getItem(PERSIST_STORAGE_KEY);
    if (!raw) return;
    const persisted = JSON.parse(raw) as {
      buster?: string;
      timestamp?: number;
      clientState?: DehydratedState;
    };
    if (
      persisted.buster !== PERSIST_BUSTER ||
      typeof persisted.timestamp !== "number" ||
      Date.now() - persisted.timestamp >= PERSIST_MAX_AGE_MS ||
      !persisted.clientState
    ) {
      return;
    }
    hydrate(client, persisted.clientState);
    // Paint last-known immediately, then treat mutable workbook keys as stale
    // so a reload after a lineup write cannot reuse a still-fresh snapshot.
    void client.invalidateQueries({
      predicate: (q) => shouldStaleOnRestore(q.queryKey),
      refetchType: "none",
    });
  } catch {
    // Corrupt persist — persistQueryClient will retry or drop it.
  }
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/** Server: new client per request. Browser: one client for the tab. */
export function getQueryClient(): QueryClient {
  if (typeof window !== "undefined") {
    if (!browserClient) {
      const client = makeQueryClient();
      restorePersistedClient(client);
      persistQueryClient({
        queryClient: client,
        persister: createSyncStoragePersister({
          storage: window.localStorage,
          key: PERSIST_STORAGE_KEY,
        }),
        maxAge: PERSIST_MAX_AGE_MS,
        buster: PERSIST_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (q) =>
            q.state.status === "success" && shouldPersistQueryKey(q.queryKey),
        },
      });
      browserClient = client;
    }
    return browserClient;
  }
  return makeQueryClient();
}
