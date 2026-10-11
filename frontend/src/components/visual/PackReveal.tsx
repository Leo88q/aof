import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FRAMES = [1, 2, 3, 4, 5, 6].map(
  (frame) => `/assets/reveal/frame-0${frame}.jpg`,
);

/** Full-screen 3D reveal. Frames are decorative; the chain record is the result. */
export function PackReveal({ open, caption, children }: { open: boolean; caption: string; children?: ReactNode }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!open) return;
    setFrame(0);
    const id = window.setInterval(() => setFrame((current) => (current + 1) % FRAMES.length), 220);
    return () => window.clearInterval(id);
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="pack-reveal" role="status">
      <img src={FRAMES[frame]} alt="" />
      <div className="pack-reveal__copy">
        {caption ? <p>{caption}</p> : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
