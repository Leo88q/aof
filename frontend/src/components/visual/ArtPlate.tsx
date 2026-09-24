import type { CSSProperties } from "react";

/**
 * Square plate. The image is always contained, never cropped.
 * Source art is padded, so a chip, a circle, or a card shows the whole object.
 */
export function ArtPlate({
  src,
  alt,
  size = 64,
  className = "",
}: {
  src?: string | null;
  alt: string;
  size?: number | string;
  className?: string;
}) {
  const url = src && src.startsWith("/") ? src : undefined;
  const style: CSSProperties = typeof size === "number"
    ? { width: size, height: size }
    : { width: size };
  return (
    <span className={`nf-plate${className ? ` ${className}` : ""}`} style={style}>
      {url ? (
        <img src={url} alt={alt} draggable={false} />
      ) : (
        <span className="nf-plate__fallback" aria-hidden="true">{src && !url ? src : "◇"}</span>
      )}
    </span>
  );
}
