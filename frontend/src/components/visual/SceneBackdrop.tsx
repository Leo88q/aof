import { useNav } from "../../nav/NavContext";
import { SCENE_BY_TAB, BACKGROUNDS } from "../../lib/visualAssets";

/**
 * Per-tab scene backdrop. Sits behind the page stack inside .app-shell and
 * crossfades when the tab changes. Purely decorative, so it is hidden from
 * assistive tech and never captures pointer events.
 */
export function SceneBackdrop() {
  const { tab } = useNav();
  const src = SCENE_BY_TAB[tab] ?? BACKGROUNDS.lab;
  return (
    <div className="nf-scene" aria-hidden="true">
      <img key={src} src={src} alt="" draggable={false} />
    </div>
  );
}
