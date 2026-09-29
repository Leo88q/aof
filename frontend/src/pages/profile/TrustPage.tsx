import { DataUnavailableNotice } from "../../lib/availability";

/** The public GET /trust/:user is disabled until canonical indexing exists.
 * No local calculation of tiers, score, privileges or penalties can replace
 * that read. Keep the reason visible in the currently selected language. */
export function TrustPage() {
  return <div className="p-4 pb-24 min-w-0"><DataUnavailableNotice id="trust_profile" /></div>;
}
