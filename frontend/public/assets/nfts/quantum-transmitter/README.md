# Quantum Transmitter NFT assets

This directory keeps the five regenerated card artworks and their portable metadata in the repository so they are not lost when the sandbox is reset.

- `common.png` — Common, edition 001
- `uncommon.png` — Uncommon, edition 002
- `rare.png` — Rare, edition 003
- `epic.png` — Epic, edition 004
- `legendary.png` — Legendary, edition 005
- `collection.json` — collection index
- `metadata/*.json` — Metaplex-compatible per-card metadata with relative image paths

The frontend catalogue is wired through `frontend/src/lib/nftCollection.ts` and displayed in the Tools tab. These are local visual assets and metadata; minting them on-chain still requires a configured collection/mint authority and is intentionally not claimed by this catalogue.
