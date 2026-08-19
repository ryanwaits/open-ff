import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A scrollable box that admits it is one.
 *
 * An overflow list with a hidden scrollbar and a hard bottom edge reads as a
 * finished list — the last row looks like the last row, and the six players
 * below it are simply never found. So the edges get a shade that only appears
 * on the side there is more content on: impossible to draw when the list fits,
 * impossible to miss when it does not.
 *
 * The shade colour has to match whatever sits behind the list, so it is passed
 * in as a token rather than assumed.
 */
export function ScrollShade({
  children,
  className,
  shade = "var(--color-bg)",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** CSS colour of the surface behind the list. */
  shade?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    // A sub-pixel remainder is not "more content". Round it away, or the shade
    // sits there permanently on a list that fits.
    const top = el.scrollTop > 1;
    const bottom = max > 1 && el.scrollTop < max - 1;
    setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }, []);

  useEffect(() => {
    const box = viewport.current;
    const inner = content.current;
    if (!box || !inner) return;
    measure();
    // Content changes (a partner swap, picks arriving) move the edges without a
    // scroll event, so the content wrapper is watched as well as the viewport.
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className="relative min-w-0">
      <div
        ref={viewport}
        onScroll={measure}
        className={cn("scroll-thin overflow-y-auto overscroll-contain", className)}
        {...rest}
      >
        <div ref={content}>{children}</div>
      </div>
      <Shade side="top" on={edges.top} shade={shade} />
      <Shade side="bottom" on={edges.bottom} shade={shade} />
    </div>
  );
}

function Shade({ side, on, shade }: { side: "top" | "bottom"; on: boolean; shade: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        // Short on purpose: a tall fade erases the row it is meant to hint at.
        "pointer-events-none absolute inset-x-0 h-6 transition-opacity duration-200 ease-out",
        side === "top" ? "top-0" : "bottom-0",
        on ? "opacity-100" : "opacity-0",
      )}
      style={{
        background: `linear-gradient(to ${side === "top" ? "bottom" : "top"}, ${shade}, transparent)`,
      }}
    />
  );
}
