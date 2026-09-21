/**
 * Data-quality provenance for metrics exposed by the API.
 *
 * Pure module (no DB / RPC imports) so both the economy monitor and tests can
 * depend on it without booting the provider.
 */
export type DataQuality = "complete" | "partial" | "unavailable";

export type EconomyFieldQuality = {
  potatoSupply: DataQuality;      // on-chain mint supply read
  potatoBurned24h: DataQuality;   // chain indexer (ChainMintDelta); overridden at runtime by coverage
  potatoMinted24h: DataQuality;   // chain indexer (ChainMintDelta); overridden at runtime by coverage
  inflation24h: DataQuality;      // derived from supply vs 24h-old snapshot
  activity24h: DataQuality;       // crafters/traders/tx counts from AuditLog (off-chain, partial by nature)
  topHolders: DataQuality;        // getTokenLargestAccounts (top-20); overridden at runtime
};

/**
 * Static baseline provenance (worst case). takeEconomySnapshot() upgrades
 * mint/burn to partial/complete from the live indexer cursor; historical
 * snapshots carry their own fieldQuality column. Dashboards must never render
 * an "unavailable" field as a measured zero.
 */
export const ECONOMY_FIELD_QUALITY: EconomyFieldQuality = {
  potatoSupply: "complete",
  potatoBurned24h: "unavailable",
  potatoMinted24h: "unavailable",
  inflation24h: "partial",
  activity24h: "partial",
  topHolders: "unavailable",
};

export function worstQuality(q: Record<string, DataQuality>): DataQuality {
  const values = Object.values(q);
  if (values.includes("unavailable")) return values.every((v) => v === "unavailable") ? "unavailable" : "partial";
  if (values.includes("partial")) return "partial";
  return "complete";
}
