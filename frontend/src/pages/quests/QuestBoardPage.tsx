import { DataUnavailableNotice } from '../../lib/availability';

/** GET /quests/daily/:user is deliberately 503 until canonical progress
 * indexing exists. Do not advertise fictional daily rewards or render a
 * failed read as an empty quest board. */
export function QuestBoardPage() {
  return <div className="p-4 pb-24 min-w-0 [overflow-wrap:anywhere]">
    <DataUnavailableNotice id="quest_progress" />
  </div>;
}
