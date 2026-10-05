export const TOOL_TYPES = Object.freeze([
  { id: "plasma_cutter", name: "Plasma Cutter", fileStem: "plasma-cutter" },
  { id: "silicon_extractor", name: "Silicon Extractor", fileStem: "silicon-extractor" },
  { id: "data_harvester", name: "Data Harvester", fileStem: "data-harvester" },
  { id: "quantum_transmitter", name: "Quantum Transmitter", fileStem: "quantum-transmitter" },
  { id: "neural_seeder", name: "Neural Seeder", fileStem: "neural-seeder" },
]);

export const TOOL_RARITIES = Object.freeze([
  { id: "common", chainName: "Common", displayName: "Base", fileSuffix: "" },
  { id: "uncommon", chainName: "Uncommon", displayName: "Enhanced", fileSuffix: "-uncommon" },
  { id: "rare", chainName: "Rare", displayName: "Quantum", fileSuffix: "-rare" },
  { id: "epic", chainName: "Epic", displayName: "Singularity", fileSuffix: "-epic" },
  { id: "legendary", chainName: "Legendary", displayName: "Transcendent", fileSuffix: "-legendary" },
]);

const TOOL_BY_ID = new Map(TOOL_TYPES.map((tool) => [tool.id, tool]));
const RARITY_BY_ID = new Map(TOOL_RARITIES.map((rarity) => [rarity.id, rarity]));
const ARWEAVE_TX_ID = /^[A-Za-z0-9_-]{43}$/;

export function listToolNftVariants() {
  return TOOL_TYPES.flatMap((tool) => TOOL_RARITIES.map((rarity) => ({
    key: `${tool.id}/${rarity.id}`,
    toolType: tool.id,
    toolName: tool.name,
    rarity: rarity.id,
    rarityName: rarity.chainName,
    displayRarity: rarity.displayName,
    imageFile: `${tool.fileStem}${rarity.fileSuffix}.jpg`,
  })));
}

export function arweaveUrl(txId) {
  if (typeof txId !== "string" || !ARWEAVE_TX_ID.test(txId)) {
    throw new Error("Arweave transaction IDs must be 43-character base64url strings");
  }
  return `https://arweave.net/${txId}`;
}

export function createToolNftMetadata({ toolType, rarity, imageUri, sellerFeeBasisPoints }) {
  const tool = TOOL_BY_ID.get(toolType);
  const tier = RARITY_BY_ID.get(rarity);
  if (!tool) throw new Error(`Unknown tool type: ${String(toolType)}`);
  if (!tier) throw new Error(`Unknown tool rarity: ${String(rarity)}`);
  if (typeof imageUri !== "string" || !/^https:\/\/arweave\.net\/[A-Za-z0-9_-]{43}$/.test(imageUri)) {
    throw new Error("imageUri must be an Arweave gateway URL for a valid transaction ID");
  }

  // Symbol and royalty basis points remain omitted until their values are
  // approved. An explicit `sellerFeeBasisPoints` argument is accepted for a
  // reviewed release build; creators and collection are not claimed here.
  const metadata = {
    name: tool.name,
    description: `${tool.name} (${tier.displayName}) is an in-game tool NFT for NeuroForge. Its gameplay state is maintained on Solana.`,
    image: imageUri,
    attributes: [
      { trait_type: "Tool Type", value: tool.name },
      { trait_type: "Tool ID", value: tool.id },
      { trait_type: "Rarity", value: tier.chainName },
      { trait_type: "Display Rarity", value: tier.displayName },
    ],
    properties: {
      category: "image",
      files: [{ uri: imageUri, type: "image/jpeg" }],
    },
  };
  if (sellerFeeBasisPoints !== undefined && sellerFeeBasisPoints !== null) {
    if (!Number.isInteger(sellerFeeBasisPoints) || sellerFeeBasisPoints < 0 || sellerFeeBasisPoints > 10_000) {
      throw new Error("sellerFeeBasisPoints must be an approved integer from 0 through 10000");
    }
    metadata.seller_fee_basis_points = sellerFeeBasisPoints;
  }
  return metadata;
}

export function serializeToolNftMetadata(metadata) {
  return Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

export function formatWinstonAsAr(winston) {
  const value = BigInt(winston);
  const whole = value / 1_000_000_000_000n;
  const fractional = (value % 1_000_000_000_000n).toString().padStart(12, "0");
  return `${whole}.${fractional}`;
}

export function parseArAsWinston(value) {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value)) {
    throw new Error("AR amounts must be non-negative decimals with at most 12 fractional digits");
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 1_000_000_000_000n + BigInt(fraction.padEnd(12, "0") || "0");
}
