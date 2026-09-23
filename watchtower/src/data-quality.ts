/** Data availability is not implementation/deployment readiness. */
import type { DataQuality } from "./read-model";

export type DomainQuality = { dataQuality: DataQuality; reason: string | null };
export function domainQuality(quality: DataQuality, provider: string, saltConfigured: boolean): Record<string, DomainQuality> {
  const unavailable = provider !== "indexer" || quality === "unavailable";
  const reason = provider !== "indexer" ? "Live finalized indexer is not configured" : "Expected program history is missing or stale";
  const domain = (limitation: string): DomainQuality => unavailable
    ? { dataQuality: "unavailable", reason }
    : { dataQuality: "partial", reason: limitation };
  return {
    players: !saltConfigured ? { dataQuality: "unavailable", reason: "Shared player hash salt is not configured" }
      : domain("Wallet connection/session telemetry is not authoritative; ledger actors only"),
    economy: domain("No complete event-to-double-entry-ledger reconciliation evidence"),
    craft: domain("Craft mappings exist; plot/plant/harvest and full resource provenance are not verified"),
    market: domain("Core market events only; hot-market placement and matching remain disabled"),
    security: domain("Session/LP/rebirth streams and deployed custody are not verified"),
  };
}

export function liveQuality(quality: DataQuality, provider: string): DataQuality {
  return provider === "indexer" ? quality : "unavailable";
}
