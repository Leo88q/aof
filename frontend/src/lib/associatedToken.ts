import { PublicKey } from "@solana/web3.js";
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

/** Classic SPL ATA derivation. Uses web3's reviewed PDA primitive, not custom
 * crypto. Kept intentionally Token-only; Token-2022 needs a separate policy.
 * Regression vectors compare this helper against the SPL SDK (test-only dep). */
export function getAssociatedTokenAddressSync(mint: PublicKey, owner: PublicKey, allowOwnerOffCurve = false): PublicKey {
  if (!allowOwnerOffCurve && !PublicKey.isOnCurve(owner.toBytes())) throw new Error("ATA owner is off curve");
  return PublicKey.findProgramAddressSync([owner.toBytes(), TOKEN.toBytes(), mint.toBytes()], ATA)[0];
}
