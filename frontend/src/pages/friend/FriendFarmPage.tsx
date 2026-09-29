import { DataUnavailableNotice } from '../../lib/availability';

/** A neighbor visit requires the canonical social index. The legacy farm
 * aggregator silently converted failed balance/tool reads into zero and its
 * visit limit was unavailable (503); neither can support an honest preview. */
export function FriendFarmPage({ address: _address }: { address: string }) {
  return <div className="p-4 pb-24 min-w-0 [overflow-wrap:anywhere]">
    <DataUnavailableNotice id="neighbors" />
  </div>;
}
