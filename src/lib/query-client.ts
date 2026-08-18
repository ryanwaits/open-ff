import { keepPreviousData, QueryClient } from "@tanstack/react-query";

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
  if (typeof window === "undefined") return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
