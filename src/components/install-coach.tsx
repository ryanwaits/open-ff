import { useEffect, useState } from "react";
import { brand } from "@/skin/brand";

const DISMISS_KEY = "open-ff-a2hs";

type BeforeInstall = Event & { prompt: () => Promise<void> };

function standalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone))
  );
}

function iosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const ipadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return ios || ipadOs;
}

export function InstallCoach() {
  const [hidden, setHidden] = useState(true);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstall | null>(null);

  useEffect(() => {
    if (standalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setIos(iosSafari());
    setHidden(false);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstall);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null);
    dismiss();
  }

  return (
    <aside className="mt-8 w-full max-w-lg rounded-xl bg-surface px-4 py-4 text-left shadow-[var(--shadow-border)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Home screen</p>
      <p className="mt-1 text-sm font-semibold">Keep {brand.name} on this phone</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        {ios
          ? "Tap Share, then Add to Home Screen. Safari only — Chrome on iOS cannot pin it."
          : deferred
            ? "Install this site as an app. It opens on the desk, not the browser chrome."
            : "Use the browser menu → Install app or Add to Home Screen."}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {deferred ? (
          <button
            type="button"
            className="text-sm font-semibold text-accent-strong hover:text-fg"
            onClick={() => void install()}
          >
            Install
          </button>
        ) : null}
        <button type="button" className="text-sm text-muted hover:text-fg" onClick={dismiss}>
          Not now
        </button>
      </div>
    </aside>
  );
}
