import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { DataUnavailableNotice } from '../../lib/availability';
import { useWalletStr } from '../../lib/useWalletStr';
import { useLocale } from '../../i18n/LocaleProvider';
import { questsHomeCopy } from '../../i18n/questsHomeCopy';
import { UI_ICONS } from '../../lib/visualAssets';
import { Note, Panel, Sticker } from '../../ui/forge/kit';
import { PunchedCard, type StepState } from '../../ui/forge/devices';

type Tab = 'daily' | 'challenges' | 'achievements';
const tabs = [
  { id: 'daily', icon: UI_ICONS.questsDaily },
  { id: 'challenges', icon: UI_ICONS.challenges },
  { id: 'achievements', icon: UI_ICONS.achievements },
] as const;
// The backend GETs for quests and achievements explicitly return 503 until
// canonical indexing exists. Do not request them or invent a 0/N progress bar.
const emptyQuestSteps: StepState[] = Array.from({ length: 12 }, () => 'open');

export function QuestsHome() {
  const { language } = useLocale();
  const copy = questsHomeCopy[language];
  const user = useWalletStr();
  const [activeTab, setActiveTab] = useState<Tab>('daily');

  return <div lang={language} className="p-4 pt-6 pb-24 min-w-0 [overflow-wrap:anywhere]">
    <h1 className="text-2xl font-bold mb-4 break-words">{copy.title}</h1>
    <div role="tablist" aria-label={copy.title} className="flex flex-wrap gap-2 mb-4">
      {tabs.map(tab => <button key={tab.id} type="button" role="tab"
        aria-selected={activeTab === tab.id} aria-controls={`quest-${tab.id}`}
        onClick={() => setActiveTab(tab.id)}
        className={`inline-flex min-w-0 items-center gap-2 px-3 py-2 rounded-full text-sm whitespace-normal break-words text-left ${
          activeTab === tab.id ? 'bg-accent-600 text-soil-950 font-semibold' : 'bg-soil-850 text-straw'
        }`}>
        <img src={tab.icon} alt="" className="w-4 h-4 shrink-0 object-contain" />
        {copy[tab.id]}
      </button>)}
    </div>

    {activeTab === 'daily' && <div id="quest-daily" role="tabpanel" className="space-y-3">
      <Panel tier="panel" device="cards" id={<Sticker>{copy.sticker}</Sticker>}
        meta={copy.meta} title={copy.panelTitle} sub={copy.panelSub}>
        <PunchedCard unknown title={copy.cardTitle} steps={emptyQuestSteps} rows={4} footMid={copy.placeholder} />
        {!user && <Note quiet>{copy.connect}</Note>}
      </Panel>
      <DataUnavailableNotice id="quest_progress" />
    </div>}

    {activeTab === 'challenges' && <Card className="space-y-3">
      <div id="quest-challenges" role="tabpanel">
        <h2 className="text-parchment font-semibold flex items-center gap-2 break-words">
          <img src={UI_ICONS.challenges} alt="" className="w-5 h-5 shrink-0 object-contain" />{copy.challengeTitle}
        </h2>
        <p className="text-straw text-sm mt-2 break-words">{copy.challengeReason}</p>
        <p className="text-straw text-xs mt-2 break-words">{copy.challengeProgress}</p>
        <button type="button" disabled className="w-full mt-3 px-3 py-3 rounded-2xl bg-soil-800 text-straw font-semibold cursor-not-allowed whitespace-normal break-words">
          {copy.challengeDisabled}
        </button>
      </div>
    </Card>}

    {activeTab === 'achievements' && <div id="quest-achievements" role="tabpanel" className="space-y-3">
      <p className="text-straw text-sm break-words">{copy.achievementNote}</p>
      <DataUnavailableNotice id="quest_progress" />
    </div>}
  </div>;
}
