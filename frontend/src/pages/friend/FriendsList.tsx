import { DataUnavailableNotice } from '../../lib/availability';

/** /neighbors/list/:user currently responds 503 until the canonical social
 * index exists. Neither a zero visit limit nor an empty friends list is known.
 * Search and visits must not lead to a fake or unverifiable farm preview. */
export function FriendsList() {
  return <div className="p-4 pb-24 min-w-0 [overflow-wrap:anywhere]">
    <DataUnavailableNotice id="neighbors" />
  </div>;
}
