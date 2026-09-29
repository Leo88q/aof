import { useWalletStr } from "../lib/useWalletStr";
import { DataUnavailableNotice } from "../lib/availability";

/** Both /daily/status and /daily/claim return 503 until an on-chain reward
 * exists. Showing a speculative streak, tomorrow button or zero MIND amount
 * on this deployment would misrepresent closed functionality as claimable. */
export function DailyRewardButton() {
  const user = useWalletStr();
  if (!user) return null;
  return <div className="mb-4"><DataUnavailableNotice id="daily_rewards" /></div>;
}
