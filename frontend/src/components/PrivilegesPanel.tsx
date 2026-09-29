import { DataUnavailableNotice } from "../lib/availability";

/** GET /privileges/:user returns 503 until canonical indexing exists. No
 * locally assembled access rights or discounts are trustworthy yet. */
export function PrivilegesPanel({ compact = false }: { compact?: boolean }) {
  return <DataUnavailableNotice id="privileges" compact={compact} />;
}
