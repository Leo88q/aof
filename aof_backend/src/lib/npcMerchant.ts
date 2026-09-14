/**
 * NPC trading is intentionally disabled.
 *
 * The current on-chain programs do not provide a canonical NPC inventory,
 * escrow, or settlement instruction. Generating random trades off-chain would
 * fabricate volume and pollute the economy/audit metrics, so this module is a
 * fail-closed compatibility surface until a real orderbook integration exists.
 */

export interface MerchantAction {
  type: "buy" | "sell";
  resource: string;
  amount: number;
  price: number;
  reason: string;
}

export async function runMerchantCycle(): Promise<MerchantAction[]> {
  return [];
}

export async function getMerchantStats(): Promise<{
  enabled: false;
  reason: string;
}> {
  return {
    enabled: false,
    reason: "NPC trading is unavailable until canonical orderbook settlement is deployed",
  };
}
