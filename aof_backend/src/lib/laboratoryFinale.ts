import { createHash } from "crypto";

/** Anchor account: 8-byte discriminator + Pubkey + u32 + u8. */
export const LABORATORY_FINALE_ACCOUNT_SIZE = 45;

export function laboratoryFinaleDiscriminator(): Buffer {
  return createHash("sha256").update("account:LaboratoryFinale").digest().subarray(0, 8);
}

export type LaboratoryFinaleDecode =
  | { ok: true; exists: false; seals: 0 }
  | { ok: true; exists: true; seals: number }
  | { ok: false; error: "LABORATORY_FINALE_LAYOUT_MISMATCH" };

/** A missing account is a true zero: the counter is created on the first seal.
 * A present account with the wrong size, discriminator or owner is not zero. */
export function decodeLaboratoryFinale(data: Uint8Array | null, expectedOwner: Uint8Array): LaboratoryFinaleDecode {
  if (data === null) return { ok: true, exists: false, seals: 0 };
  if (data.length !== LABORATORY_FINALE_ACCOUNT_SIZE || expectedOwner.length !== 32) {
    return { ok: false, error: "LABORATORY_FINALE_LAYOUT_MISMATCH" };
  }
  const bytes = Buffer.from(data);
  const discriminator = laboratoryFinaleDiscriminator();
  if (!bytes.subarray(0, 8).equals(discriminator)) return { ok: false, error: "LABORATORY_FINALE_LAYOUT_MISMATCH" };
  if (!bytes.subarray(8, 40).equals(Buffer.from(expectedOwner))) return { ok: false, error: "LABORATORY_FINALE_LAYOUT_MISMATCH" };
  return { ok: true, exists: true, seals: bytes.readUInt32LE(40) };
}
