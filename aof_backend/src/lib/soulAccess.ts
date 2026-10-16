import { createHash } from "crypto";

/** Anchor account: 8-byte discriminator + Pubkey + i64 + u32 + u8 (SoulAccess). */
export const SOUL_ACCESS_ACCOUNT_SIZE = 53;

export function soulAccessDiscriminator(): Buffer {
  return createHash("sha256").update("account:SoulAccess").digest().subarray(0, 8);
}

export type SoulAccessDecode =
  | { ok: true; exists: false; unlocked: false }
  | { ok: true; exists: true; unlocked: true; unlockedAt: number; sealsAtUnlock: number }
  | { ok: false; error: "SOUL_ACCESS_LAYOUT_MISMATCH" };

/** A missing account is honestly locked: the gate opens only on-chain.
 * A present account with the wrong size, discriminator or owner is not locked
 * and not open; it is unreadable. */
export function decodeSoulAccess(data: Uint8Array | null, expectedOwner: Uint8Array): SoulAccessDecode {
  if (data === null) return { ok: true, exists: false, unlocked: false };
  if (data.length !== SOUL_ACCESS_ACCOUNT_SIZE || expectedOwner.length !== 32) {
    return { ok: false, error: "SOUL_ACCESS_LAYOUT_MISMATCH" };
  }
  const bytes = Buffer.from(data);
  if (!bytes.subarray(0, 8).equals(soulAccessDiscriminator())) return { ok: false, error: "SOUL_ACCESS_LAYOUT_MISMATCH" };
  if (!bytes.subarray(8, 40).equals(Buffer.from(expectedOwner))) return { ok: false, error: "SOUL_ACCESS_LAYOUT_MISMATCH" };
  const unlockedAt = Number(bytes.readBigInt64LE(40));
  const sealsAtUnlock = bytes.readUInt32LE(48);
  // A written account is only the gate when the unlock handler stamped it.
  if (unlockedAt <= 0 || sealsAtUnlock < 1) return { ok: false, error: "SOUL_ACCESS_LAYOUT_MISMATCH" };
  return { ok: true, exists: true, unlocked: true, unlockedAt, sealsAtUnlock };
}
