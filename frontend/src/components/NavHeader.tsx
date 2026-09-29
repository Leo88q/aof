import { ResourceGlyph } from "./visual/ResourceGlyph";
import { useLocale } from "../i18n/LocaleProvider";
import { gameHeaders, type GameHeaderId } from "../i18n/gameHeaders";
import { useNav } from "../nav/NavContext";

/**
 * Шапка вложенного экрана: полоса прибора с волоском снизу, заголовок Exo 2,
 * кнопка «Назад» — та же капсула, что и остальные клавиши набора.
 * Раньше здесь были инлайновые цвета #5FC9DA и фон на каждом элементе —
 * теперь только классы, чтобы палитра менялась в одном месте.
 */
type NavHeaderProps = { tabKey: string; icon?: string } &
  ({ headerId: GameHeaderId; title?: never } | { title: string; headerId?: never });

export function NavHeader({ title, headerId, tabKey, icon }: NavHeaderProps) {
  const { stacks, pop } = useNav();
  const { language } = useLocale();
  const canPop = (stacks[tabKey]?.length ?? 0) > 1;
  return (
    <div className="nav-bar">
      <div className="nav-side">
        {canPop ? (
          <button type="button" className="nav-back" onClick={() => pop(tabKey)}>
            <span aria-hidden="true">‹</span> {gameHeaders[language].back}
          </button>
        ) : null}
      </div>
      <div className="nav-title">
        {icon ? <ResourceGlyph icon={icon} alt="" className="w-5 h-5" /> : null}
        <span>{headerId ? gameHeaders[language][headerId] : title}</span>
      </div>
      <div className="nav-side" aria-hidden="true" />
    </div>
  );
}
