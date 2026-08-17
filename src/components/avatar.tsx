import { useEffect, useState } from "react";
import { cn, initials } from "@/lib/utils";

/**
 * Deterministic tint index for a name. Teams that have never uploaded an image
 * still need to be told apart at a glance, and a stable-per-name mark does that
 * without asking anyone to pick a colour.
 */
function tintOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % TINTS.length;
}

/**
 * One hue, five intensities. Staying on the brand hue keeps the palette at the
 * one-or-two colours the theme allows, while still giving fourteen teams
 * distinguishable crests.
 */
const TINTS = [
  "color-mix(in oklab, var(--brand) 14%, var(--paper-sunken))",
  "color-mix(in oklab, var(--brand) 26%, var(--paper-sunken))",
  "color-mix(in oklab, var(--brand) 38%, var(--paper-sunken))",
  "color-mix(in oklab, var(--brand) 52%, var(--paper-sunken))",
  "color-mix(in oklab, var(--brand) 68%, var(--paper-sunken))",
];

type Props = {
  /** Remote image. Falls back to the monogram if absent or broken. */
  src?: string | null;
  name: string | null | undefined;
  className?: string;
  /** Monogram size. Defaults to something sane for a 32-36px mark. */
  textClassName?: string;
  /** Tint the fallback by name. Off for players, on for teams. */
  tint?: boolean;
  children?: React.ReactNode;
};

/**
 * The monogram is never painted over the photo. Player headshots are
 * transparent PNGs, so a fallback layered *behind* one still shows through the
 * cutout — which is the bug this component exists to prevent. The monogram
 * renders only while there is no usable image.
 */
export function Avatar({
  src,
  name,
  className,
  textClassName = "text-[11px]",
  tint = false,
  children,
}: Props) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // A recycled row (virtualised lists, week changes) must not keep the previous
  // player's load state.
  useEffect(() => {
    setBroken(false);
    setLoaded(false);
  }, [src]);

  const showImage = Boolean(src) && !broken;
  const label = initials(name);

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-pill bg-raised",
        className,
      )}
      style={
        tint && !showImage
          ? { background: TINTS[tintOf(name ?? "?")] }
          : undefined
      }
    >
      {showImage ? null : (
        <span className={cn("font-mono font-medium text-muted", textClassName)}>{label}</span>
      )}
      {showImage ? (
        <img
          src={src!}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-200 ease-out",
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
        />
      ) : null}
      {children}
    </span>
  );
}
