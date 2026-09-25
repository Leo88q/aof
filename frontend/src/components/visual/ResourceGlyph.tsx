/**
 * Resource glyph: shows the resource artwork when it exists, otherwise the
 * emoji that was there before. Keeps every screen on one code path so a
 * missing icon degrades to the old look instead of an empty box.
 */
export function ResourceGlyph({
  icon,
  alt,
  className = "",
  size,
}: {
  icon?: string | null;
  alt?: string;
  className?: string;
  size?: number;
}) {
  const isPath = typeof icon === "string" && icon.startsWith("/");
  if (isPath) {
    return (
      <img
        src={icon}
        alt={alt ?? ""}
        draggable={false}
        className={"object-contain " + className}
        {...(size ? { width: size, height: size } : {})}
      />
    );
  }
  if (!icon) return null;
  return <span className={className}>{icon}</span>;
}
