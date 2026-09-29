import { DataUnavailableNotice } from '../../lib/availability';

/** GET /portfolio/:user deliberately returns 503 until complete canonical
 * balances and independently verified prices can produce a net worth. The
 * legacy view fell back to zero-valued assets, fabricated price history and
 * advertised unimplemented Premium analytics. */
export function PortfolioHome() {
  return <div className="p-4 pb-24 min-w-0 [overflow-wrap:anywhere]">
    <DataUnavailableNotice id="portfolio" />
  </div>;
}
