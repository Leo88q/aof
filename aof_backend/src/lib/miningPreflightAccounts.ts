/**
 * Normalize accounts decoded by a raw BorshAccountsCoder.
 *
 * `Program` camel-cases account fields before building its coder, but the
 * standalone BorshAccountsCoder in miningDevnetPreflight receives the committed
 * snake_case IDL directly. Keep this adapter explicit so a missing underscore
 * cannot masquerade as an enabled mining flag or absent reward mint/cap.
 */
export function normalizeMiningPreflightAccounts(
  rawConfig: Record<string, any>,
  rawMaterialMints: Record<string, any>,
) {
  return {
    config: {
      miningEnabled: rawConfig.mining_enabled,
      paused: rawConfig.paused,
      circuitMint: rawConfig.circuit_mint,
      siliconMint: rawConfig.silicon_mint,
    },
    materialMints: {
      dataset: rawMaterialMints.dataset,
      neuron: rawMaterialMints.neuron,
      maxSupply: rawMaterialMints.max_supply,
    },
  };
}
