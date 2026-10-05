# Tool NFT metadata release (staged)

**Current state: preparation only.** The repository contains 25 tool illustrations and now has a local metadata builder/uploader with estimate-only-by-default behavior. No Arweave transaction, Solana transaction, mint, deployment, registry change, or mining activation has been made by this work.

## Metadata contract for the 5 × 5 tool set

- Canonical types and names come from the existing game catalog: Plasma Cutter, Silicon Extractor, Data Harvester, Quantum Transmitter, and Neural Seeder.
- The five rarity values retain both the on-chain English enum (`Common` … `Legendary`) and the site's English labels (`Base`, `Enhanced`, `Quantum`, `Singularity`, `Transcendent`) as metadata attributes.
- The JSON `name` is the English tool name. Rarity is a separate trait and appears in the description. Keeping the name to the tool name keeps every UTF-8 name within Metaplex's 32-byte name limit (including `Quantum Transmitter`).
- `NFORGE` is **not** used as the tool NFT symbol: it is present in the utility-token metadata only, and no tool-NFT symbol has been approved. The tool JSON therefore omits `symbol`; the on-chain metadata implementation must use an empty symbol until one is explicitly approved.
- **Approved for this Devnet pilot: `seller_fee_basis_points = 0`** (no seller royalty). Pass `--seller-fee-bps 0` explicitly for both the JSON metadata and the on-chain registry. Creator shares and collection mint remain unapproved and are omitted; do not add creator or collection claims. The metadata helper still omits the optional fee field in draft mode unless an explicit value is supplied.
- Image and JSON URIs are intended to be `https://arweave.net/<transaction-id>`. The bundled local script uploads the existing JPEG variants and matching English JSON.

## Local Arweave preparation and explicit upload

Run locally from the backend directory after installing the locked backend dependencies:

```sh
cd aof_backend
npm ci
npm run nft:arweave:tool-metadata
```

The default command estimates Arweave-mainnet transaction rewards for all still-pending images and JSON files. It does not read a wallet, write a transaction, or send anything to Solana. The estimate is a point-in-time price and can change. The resumable manifest is written under the repository's ignored `out/` directory.

Arweave is mainnet storage, so uploads can incur real cost even though the NFTs are intended for Solana Devnet. The owner approved a hard maximum of **0.20 AR** for the 25 image + 25 JSON uploads, with `seller_fee_basis_points = 0`. Re-estimate immediately before uploading; if the pending total exceeds the cap, stop and obtain a new approval. The user runs the command locally with an owner-only JWK file:

```sh
ARWEAVE_JWK_PATH="$HOME/.config/arweave/jwk.json" \
  npm run nft:arweave:tool-metadata -- --upload --max-cost-ar 0.20 --seller-fee-bps 0
```

The script retries classified transient price/anchor GET failures (network timeouts/resets and HTTP 429/502/503/504) up to five attempts with backoff; POSTs are never blindly retried. It rejects any `--max-cost-ar` value above 0.20 AR before making network requests, checks the refreshed pending estimate plus all rewards recorded by earlier runs against the requested cumulative ceiling before uploading, and checks each newly signed transaction against the remaining allowance. Each accepted entry stores its exact reward in Winston, so restarting does not reset the release budget. Before each POST, the signed transaction ID and reward are journaled locally; if a POST outcome is ambiguous, the tool stops on the unresolved reservation rather than risking a duplicate upload, and that transaction must be reconciled before resuming. Upload mode also rejects any seller fee other than the approved 0 bps. JWK contents must stay on the user's machine. After upload, wait for Arweave confirmation and verify all gateway responses before putting metadata URIs on Solana.

### Read-only post-upload verification

Once the local manifest is complete and the transactions have confirmed, run this from `aof_backend`:

```sh
npm run nft:arweave:verify-tool-metadata -- --manifest ../out/tool-nft-arweave-manifest.json
```

The verifier makes only public HTTPS `GET` requests to the Arweave gateway. It validates the exact 25-variant catalog, the approved 0 bps fee, recorded cumulative rewards at or below 0.20 AR, and all 50 distinct transaction IDs; checks each local artwork digest; fetches every image and JSON document; verifies HTTP status and MIME type; compares gateway bytes to manifest SHA-256 digests; and checks each JSON document against the canonical English metadata builder and its paired image transaction. It does not access the JWK, write files, submit Arweave transactions, or send Solana transactions. It has not been run against Arweave as part of this staged code-only work. Offline mocked-fetch coverage can be run with `npm run test:tool-nft-arweave-verify`.

## Remaining release gates

1. **The Arweave uploader does not implement or verify the Solana mint/URI-registry path.** Review the separate on-chain source changes, build with the repository's pinned Anchor/Rust toolchain, compare generated IDLs, and complete Devnet smoke tests before writing metadata URIs or minting.
2. Confirm Metadata and Master Edition account sizes and rent against the deployed Devnet CPI before release; conservative payer quotes can overestimate rent ([Metaplex account-size guide](https://developers.metaplex.com/token-metadata/guides/account-size-reduction)).
3. After the bounded upload completes, wait for Arweave confirmation and pass the read-only verifier on all 25 image/JSON pairs before using any metadata URI on Solana. The approved Arweave budget and 0 bps royalty do not constitute approval to mint or change on-chain registry state.
4. Issue exactly one NFT per type × rarity to the supplied Devnet recipient, then verify owner, mint supply/decimals, `ToolData`, metadata PDA, and fetched image/JSON for all 25.
5. Exercise the broader game modules in the staged Devnet smoke matrix; this tool-NFT pilot does not establish whole-game readiness.
6. Keep mining disabled until the four finite cumulative lifetime caps are explicitly approved, all six program bytecodes match, and all required local bytecode and smoke gates pass. Bringup must not alter registry statuses automatically.

Cap values are intentionally absent here: repository scenarios are not approved lifetime caps.
