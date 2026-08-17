import {
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { useState } from "react";
import { Toaster } from "sonner";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AuthProvider } from "@/lib/auth/provider";
import { NO_FLASH_SCRIPT, useTheme } from "@/lib/theme";
import appCss from "../styles.css?url";

const APP_NAME = "Ledger";
const host = import.meta.env.VITE_PUBLIC_HOSTNAME;
const ogImage = host
  ? `https://og.grok.me/v1/card.png?host=${encodeURIComponent(host)}&title=${encodeURIComponent(APP_NAME)}`
  : undefined;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "A custom fantasy football desk for your leagues — standings, matchups, scores, and weekly recaps.",
      },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#f7f4ea" },
      { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#14161a" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(ogImage
        ? [
            { property: "og:image", content: ogImage },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
          ]
        : []),
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  const { resolved } = useTheme();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
            placeholderData: keepPreviousData,
          },
        },
      }),
  );

  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Stamps data-theme before first paint. Must stay inline and before
            the body, or the page flashes light on a dark device. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>
        <PreviewHostBridge />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Outlet />
          </AuthProvider>
        </QueryClientProvider>
        <Toaster
          theme={resolved}
          position="bottom-center"
          offset={16}
          gap={10}
          duration={4000}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "flex w-full items-start gap-3 rounded-lg bg-surface px-4 py-3 shadow-[0_0_0_1px_var(--hairline),var(--lift)]",
              title: "text-sm font-semibold text-fg",
              description: "mt-0.5 font-mono text-[11px] leading-relaxed text-muted",
              icon: "shrink-0 [&>svg]:size-4",
              success: "[&_[data-icon]]:text-accent-strong",
              error: "[&_[data-icon]]:text-loss",
              actionButton:
                "ml-auto shrink-0 rounded-pill bg-accent px-3 py-1.5 text-xs font-bold text-accent-fg",
              closeButton: "rounded-pill border border-line bg-surface text-faint",
            },
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}
