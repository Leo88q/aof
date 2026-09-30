import { useState } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { sitePanelCopy } from '../../i18n/sitePanelCopy';
import { SITE_SCENERY, type SceneryId } from '../content/scenery';
import { Fader, Lamp, Lever, NamePlate, Rocker } from '../ui/Controls';

/**
 * Стенд сайта: нарисованная сцена на фоне и пульт к ней.
 *
 * Пульт — оформление страницы, а не игра: он включает и выключает подсветку
 * фона, меняет слой (сцена / металл / сетка) и её яркость. Ни одного числа из
 * сети здесь нет, поэтому пульт доступен и без кошелька.
 */

export type StandMode = 'scene' | 'metal' | 'grid';
export const STAND_MODES: readonly StandMode[] = ['scene', 'metal', 'grid'];
export const STAND_DEFAULT_LEVEL = 60;

export function useStandState() {
  const [on, setOn] = useState(true);
  const [mode, setMode] = useState(0);
  const [level, setLevel] = useState(STAND_DEFAULT_LEVEL);
  return { on, setOn, mode: STAND_MODES[mode], modeIndex: mode, setMode, level, setLevel };
}

export type StandState = ReturnType<typeof useStandState>;

export function SiteBackdrop({ scene, state }: { scene: SceneryId; state: StandState }) {
  const { on, mode, level } = state;
  return (
    <div className="site-backdrop" aria-hidden="true">
      <div
        className="site-backdrop__layer site-backdrop__scene"
        data-on={on && mode === 'scene'}
        style={{ backgroundImage: `url('${SITE_SCENERY[scene]}')`, opacity: on && mode === 'scene' ? level / 100 : 0 }}
      />
      <div className="site-backdrop__layer site-backdrop__metal" data-on={on && mode === 'metal'} />
      <div className="site-backdrop__layer site-backdrop__grid" data-on={on && mode === 'grid'} />
      <span className="site-backdrop__scan" />
    </div>
  );
}

export function StandDeck({ state }: { state: StandState }) {
  const { language } = useLocale();
  const copy = sitePanelCopy[language];
  const { on, setOn, modeIndex, setMode, level, setLevel } = state;
  return (
    <div className="site-deck" data-on={on}>
      <div className="site-deck__id">
        <Lamp state={on ? 'live' : 'off'} />
        <NamePlate>{copy.deckLabel}</NamePlate>
      </div>
      <Lever on={on} onChange={setOn} label={copy.switchLabel} compact />
      <Rocker
        legend={copy.modeLegend}
        options={copy.modes}
        value={modeIndex}
        onChange={setMode}
        id="site-stand-mode"
      />
      <Fader label={copy.levelLabel} value={level} onChange={setLevel} id="site-stand-level" />
      <p className="site-deck__status" role="status">
        {on ? copy.statusOn : copy.statusOff}
      </p>
    </div>
  );
}
