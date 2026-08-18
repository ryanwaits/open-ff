import { keepPreviousData, QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  PERSIST_BUSTER,
  PERSIST_MAX_AGE_MS,
  PERSIST_STORAGE_KEY,
  shouldPersistQueryKey,
} from "./query-persist";

export type RouterContext = {
  queryClient: QueryClient;
};

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
