/**
 * The upstream identity providers this app offers for sign-in (via the broker).
 *
 * Source of truth for BOTH the server (`server.ts`, one `genericOAuth` provider
 * per entry) and the client (`client.ts` / sign-in buttons). Kept in its own
 * dependency-free module so the client can import it without pulling the
 * server-only Better Auth instance (and `pg`) into the browser bundle.
 *
 * Each app federates to the shared **auth broker** (`GROK_AUTH_ISSUER`), which
 * holds the real Google/X secrets. The app never sees them — it only knows its
 * own per-app client id/secret and which upstream to ask the broker for (`idp`).
 *
 * To add an upstream (e.g. GitHub) once the broker supports it: add one entry
 * here (`{ providerId: "grok-github", idp: "github", label: "GitHub" }`). The
 * `providerId` is this app's local id and the OAuth callback path segment
 * (`/api/auth/oauth2/callback/<providerId>`); `idp` is the hint the broker reads
 * to pick the upstream (Better Auth's id for X is still `twitter`).
 */
export type GrokProvider = {
  /** This app's local provider id; also the callback path segment. */
  providerId: string;
  /** Upstream hint the broker forwards to (Better Auth social id). */
  idp: string;
  /** Human label for the sign-in button. */
  label: string;
};

export const GROK_PROVIDERS: readonly GrokProvider[] = [
  { providerId: "grok-google", idp: "google", label: "Google" },
  { providerId: "grok-x", idp: "twitter", label: "X" },
];

/**
 * Google/X work only when this host has a real broker client, or when the
 * request is the Grok live preview (`*.grok-sandbox.com`). Self-host without
 * `GROK_AUTH_CLIENT_ID` must not offer those buttons.
 */
export function grokBrokerConfigured(host = ""): boolean {
  const clientId = typeof process !== "undefined" ? process.env.GROK_AUTH_CLIENT_ID?.trim() : "";
  if (clientId) return true;
  const h = host || (typeof window !== "undefined" ? window.location.hostname : "");
  return h === "grok-sandbox.com" || h.endsWith(".grok-sandbox.com");
}

/** Providers the login page may actually render. */
export function configuredGrokProviders(host = ""): readonly GrokProvider[] {
  return grokBrokerConfigured(host) ? GROK_PROVIDERS : [];
}

/** True when this app has its own Google OAuth client (not the Grok broker). */
export function nativeGoogleConfigured(): boolean {
  if (typeof process === "undefined") return false;
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return Boolean(id && secret);
}

export type LoginSocial = {
  providerId: string;
  label: string;
  kind: "broker" | "native";
};

/**
 * Sign-in buttons the login loader may render. Broker Google/X when the broker
 * is on; native Google when `GOOGLE_CLIENT_*` are set (even off-sandbox).
 * If both Google paths exist, the broker button is enough — do not show two.
 */
export function configuredLoginSocials(host = ""): LoginSocial[] {
  const social: LoginSocial[] = configuredGrokProviders(host).map((p) => ({
    providerId: p.providerId,
    label: p.label,
    kind: "broker",
  }));
  const hasGoogle = social.some((p) => p.label === "Google");
  if (nativeGoogleConfigured() && !hasGoogle) {
    social.push({ providerId: "google", label: "Google", kind: "native" });
  }
  return social;
}
