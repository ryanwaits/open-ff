import { useEffect } from "react";
import { pushPublicKey, subscribePush, unsubscribePush } from "@/lib/push/fns";

function onSandbox(): boolean {
  if (typeof window === "undefined") return true;
  return window.location.hostname.endsWith(".grok-sandbox.com");
}

function vapidBytes(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

/** Re-attach the worker after a prior opt-in. Does not prompt. */
export function PushRegister() {
  useEffect(() => {
    if (onSandbox()) return;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    void (async () => {
      const vapid = await pushPublicKey();
      if (!vapid.configured || !vapid.publicKey) return;
      if (Notification.permission !== "granted") return;
      const existing = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!existing) return;
      await registerWorker();
    })();
  }, []);
  return null;
}

export async function enablePushForLeague(leagueId: string, publicKey: string): Promise<boolean> {
  if (onSandbox()) return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
    return false;
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  const reg = await registerWorker();
  if (!reg) return false;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidBytes(publicKey) as BufferSource,
  });
  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return false;
  const res = await subscribePush({ data: { leagueId, endpoint, p256dh, auth } });
  return res.ok;
}

export async function disablePushForLeague(leagueId: string): Promise<void> {
  await unsubscribePush({ data: { leagueId } });
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe().catch(() => undefined);
}
