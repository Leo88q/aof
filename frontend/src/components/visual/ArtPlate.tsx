import type { CSSProperties } from "react";

/**
 * Square plate. The image is always contained, never cropped.
 * Source art is pre-trimmed to the object (scripts/assets/trim-art.sh), so the
 * item fills the plate instead of floating in a black frame.
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
  // Прозрачные иконки (/assets/icons/**) показываем без сокета и подложки.
  const isIcon = !!url && url.startsWith("/assets/icons/");
  const style: CSSProperties = typeof size === "number"
    ? { width: size, height: size }
    : { width: size };
  return (
    <span className={`nf-plate${isIcon ? " nf-plate--icon" : ""}${className ? ` ${className}` : ""}`} style={style}>
      {url ? (
        <img src={url} alt={alt} draggable={false} />
      ) : (
        <span className="nf-plate__fallback" aria-hidden="true">{src && !url ? src : "◇"}</span>
      )}
    </span>
  );
}
