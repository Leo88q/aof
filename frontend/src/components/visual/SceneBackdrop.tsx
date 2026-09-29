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
  // Landscape art stays at its natural aspect ratio in the portrait game.
  // Never enlarge the middle of a 16:9 scene to fill a tall viewport.
  const scenes = [src, BACKGROUNDS.grid, BACKGROUNDS.deep, BACKGROUNDS.forge].filter((image, index, all) => all.indexOf(image) === index).slice(0, 3);
  return (
    <div className="nf-scene" aria-hidden="true">
      {scenes.map((image) => <img key={image} src={image} alt="" draggable={false} />)}
    </div>
  );
}
