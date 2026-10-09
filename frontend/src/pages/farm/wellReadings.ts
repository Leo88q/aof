/** Reads the chain timestamp only. It does not estimate accrued power. */
export function stationLastCollectedAt(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const row = state as Record<string, unknown>;
  const raw = row.lastCollectedAt ?? row.last_collected_at;
  const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value) || value < 1_000_000_000 || value > 10_000_000_000) return null;
  return Math.floor(value);
}
