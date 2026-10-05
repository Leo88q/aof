# Tool NFT metadata release (staged)

**Current state: preparation only.** The repository contains 25 tool illustrations and now has a local metadata builder/uploader with estimate-only-by-default behavior. No Arweave transaction, Solana transaction, mint, deployment, registry change, or mining activation has been made by this work.

## Metadata contract for the 5 × 5 tool set

- Canonical types and names come from the existing game catalog: Plasma Cutter, Silicon Extractor, Data Harvester, Quantum Transmitter, and Neural Seeder.
- The five rarity values retain both the on-chain English enum (`Common` … `Legendary`) and the site's English labels (`Base`, `Enhanced`, `Quantum`, `Singularity`, `Transcendent`) as metadata attributes.
- The JSON `name` is the English tool name. Rarity is a separate trait and appears in the description. Keeping the name to the tool name keeps every UTF-8 name within Metaplex's 32-byte name limit (including `Quantum Transmitter`).
- `NFORGE` is **not** used as the tool NFT symbol: it is present in the utility-token metadata only, and no tool-NFT symbol has been approved. The tool JSON therefore omits `symbol`; the on-chain metadata implementation must use an empty symbol until one is explicitly approved.
- No royalty basis points, creator shares, or collection mint have been approved. Draft JSON omits those fields rather than copying or inventing values. For an exact estimate, pass an already-approved `--seller-fee-bps`; upload mode refuses to run without an explicit value. Creator and collection claims stay omitted. An on-chain mint remains blocked until the required royalty field has an explicit release decision.
- Image and JSON URIs are intended to be `https://arweave.net/<transaction-id>`. The bundled local script uploads the existing JPEG variants and matching English JSON.

## Local Arweave preparation and explicit upload

Run locally from the backend directory after installing the locked backend dependencies:

```sh
cd aof_backend
npm ci
npm run nft:arweave:tool-metadata
```

The default command estimates Arweave-mainnet transaction rewards for all still-pending images and JSON files. It does not read a wallet, write a transaction, or send anything to Solana. The estimate is a point-in-time price and can change. The resumable manifest is written under the repository's ignored `out/` directory.

Arweave is mainnet storage, so uploads can incur real cost even though the NFTs are intended for Solana Devnet. **Do not add `--upload` until the upload cost has been separately approved.** When approved, the user runs the command locally with an owner-only JWK file and an explicit maximum spend, for example:

```sh
ARWEAVE_JWK_PATH="$HOME/.config/arweave/jwk.json" \
  npm run nft:arweave:tool-metadata -- --upload --max-cost-ar YOUR_APPROVED_MAX_AR --seller-fee-bps YOUR_APPROVED_BPS
```

Replace both placeholders with approved numeric values; neither is supplied by this repository. The script checks the total estimate against the supplied maximum before uploading, checks each signed transaction's actual reward against the remaining allowance, and records accepted transaction IDs locally. JWK contents must stay on the user's machine. After upload, wait for Arweave confirmation and verify all gateway responses before putting metadata URIs on Solana.

### Read-only post-upload verification

Once the local manifest is complete and the transactions have confirmed, run this from `aof_backend`:

```sh
npm run nft:arweave:verify-tool-metadata -- --manifest ../out/tool-nft-arweave-manifest.json
```

The verifier makes only public HTTPS `GET` requests to the Arweave gateway. It validates the exact 25-variant catalog and all 50 distinct transaction IDs, checks each local artwork digest, fetches every image and JSON document, verifies HTTP status and MIME type, compares the gateway bytes to the manifest SHA-256 digests, and checks each JSON document against the canonical English metadata builder and its paired image transaction. It does not access the JWK, write files, submit Arweave transactions, or send Solana transactions. It has not been run against Arweave as part of this staged code-only work. Offline mocked-fetch coverage can be run with `npm run test:tool-nft-arweave-verify`.

## Remaining release gates

1. **Source wiring is implemented, build/runtime verification is not.** The Metaplex CPI account maps are updated for direct MintTool, Craft, Reroll, batch mint, Pack/Reroll reveal, and reroll expiry. Craft/Fuse use the shared v0 lookup-table builder because their expanded legacy messages exceed Solana's packet limit. Run the repository's pinned Anchor/Rust build locally, compare the resulting IDL, and exercise these instructions on Devnet before treating this stage as complete. The code-only packet test models the initializer's keys; it does not inspect a live ALT. After provisioning with `npm run vrf:lut:init`, wait for the extended table to activate before building transactions.
2. The payer quotes use the repository's conservative Metaplex maxima: 679 bytes for Metadata and 282 for Master Edition. Metaplex documents that new accounts were reduced from 679 → 607 bytes and Master Edition v1/v2 from 282 → 20 bytes; the quotes intentionally retain the larger bounds to avoid underfunding until the deployed Devnet CPI's actual `data_len()` is observed. This can overestimate rent. Confirm allocated lengths and rent in the local Devnet smoke before release ([Metaplex account-size guide](https://developers.metaplex.com/token-metadata/guides/account-size-reduction)).
3. Produce and locally review all 25 finalized Arweave JSON/image URLs. Do not transact until upload approval and confirmation.
4. Issue exactly one NFT per type × rarity to the supplied Devnet recipient, then verify owner, mint supply/decimals, `ToolData`, metadata PDA, and fetched image/JSON for all 25.
5. Exercise the broader game modules in the staged Devnet smoke matrix; this tool-NFT pilot does not establish whole-game readiness.
6. Keep mining disabled until the four finite cumulative lifetime caps are explicitly approved, all six program bytecodes match, and all required local bytecode and smoke gates pass. Bringup must not alter registry statuses automatically.

Cap values are intentionally absent here: repository scenarios are not approved lifetime caps.
