import BN from "bn.js";

/** Stable JSON wire types: base58 public keys, decimal strings for ALL BN/u64
 * amounts. BN has words/negative, not `_bn`; serializing its internals corrupted
 * marketplace quotes and leaked implementation-specific number representations. */
export function serializeChainValue(value: any): any {
  if (value === null || value === undefined) return value;
  if (BN.isBN(value) || typeof value === "bigint") return value.toString(10);
  if (typeof value === "object" && typeof value.toBase58 === "function") return value.toBase58();
  if (Array.isArray(value)) return value.map(serializeChainValue);
  if (value instanceof Uint8Array) return Array.from(value);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serializeChainValue(entry)]));
  return value;
}
