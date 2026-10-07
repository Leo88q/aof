# Tool NFT metadata release (staged)

**Current state: local preparation only.** Tool issuance is metadata-only: immutable Metaplex Metadata on a 0-decimal, supply-1 classic SPL mint; no Master Edition is created; the auth PDA is the temporary mint/freeze authority required for Metadata CPI, and both authorities are revoked before issuance completes, leaving final freeze authority `None`. This is not a canonical Metaplex Master Edition NFT, so third-party recognition may be reduced. Preserve AOF ownership, marketplace, and custody guards. The repository contains 25 tool illustrations and has local Arweave and Cloudflare Pages preparation/verification tooling. No Arweave transaction, Cloudflare project creation/deployment, Solana transaction, mint, registry change, or mining activation has been made by this work.

## Cloudflare Pages Devnet release (separate project)

Cloudflare Pages can host these Devnet NFT images and JSON metadata without purchasing AR. This is a separate static-content project; it must not replace the existing NeuroForge game at `aof.pages.dev`. The proposed new project slug is `aof-devnet-nft-metadata`; its availability has not been checked. If Cloudflare reports that the slug is unavailable, stop and agree on another separate slug before preparing/deploying. Never substitute the existing project name `aof`.

The generated tool-NFT bundle contains 25 JPEG artworks and 25 Metaplex-style JSON documents with the approved `seller_fee_basis_points = 0`: **50 public URLs = 25 tool type × rarity variants × (one image + one JSON)**. These are not the game's resource count.

The repository separately defines 27 fungible `ResourceKind` SPL tokens (`docs/RESOURCE_MANIFEST.json`). The UI has 27 matching resource JPEGs; `frontend/public/assets/nfts/resources/drop-capsule.jpg` is an additional visual asset, not a 28th `ResourceKind`. Resource mint instructions currently do not create Metaplex Metadata accounts or consume JSON URIs, so adding 27 resource JSONs to the tool-NFT URI registry would be wrong. **Release scope is confirmed as the 25 Tool NFT variants only; the 27 resource tokens and their frontend artwork stay separate.** If wallet-visible on-chain Token Metadata is later wanted for those fungible mints, it needs a separate on-chain implementation and release gate.

Each tool-NFT image/JSON pair is under a compact content-versioned `r/<release-id>/i/<00–24>.jpg` or `r/<release-id>/m/<00–24>.json` path. Metadata URLs are checked against the on-chain registry's 80-byte URI limit; for the proposed slug, they fit without weakening that account bound. The release ID is deterministic for the chosen base URL, artwork bytes, and metadata schema. The builder and verifier are local/read-only with respect to external services: they do not need Cloudflare credentials, read a wallet, spend AR, or submit Solana transactions.

After authenticating to Cloudflare locally with Wrangler and confirming the separate project slug is available, run from `aof_backend`:

```sh
npx wrangler login
npx wrangler pages project create aof-devnet-nft-metadata --production-branch main
npm run nft:cloudflare:tool-metadata:prepare -- --base-url https://aof-devnet-nft-metadata.pages.dev
npx wrangler pages deploy ../out/tool-nft-cloudflare --project-name aof-devnet-nft-metadata --branch main
```

Wrangler may open a browser for the local Cloudflare login; do not put API tokens or other secrets in chat. Confirm the created project is named exactly `aof-devnet-nft-metadata` before deployment. If Cloudflare assigns a different public base URL or a different slug is approved, use that exact stable project URL in `--base-url` when preparing the bundle, and redeploy that newly prepared bundle. The Pages bundle should be deployed as a directory to the new metadata project only.

After the production deployment is available, run:

```sh
npm run nft:cloudflare:tool-metadata:verify -- --manifest ../out/tool-nft-cloudflare/tool-nft-cloudflare-manifest.json
```

The verifier makes public HTTPS GET requests for all 25 image URLs and 25 JSON URLs. It checks HTTP 200, expected MIME types, all 50 SHA-256 digests, exact local/source bytes, canonical metadata fields, and the 0 bps fee. The manifest records the `metadataUri` for each tool/rarity pair.

Once all 50 URLs pass and the separate Solana bytecode/smoke gates are complete, the registry helper can preview the exact on-chain batches and, only with explicit flags, write and freeze the metadata URI registry:

```sh
# Read-only public-URL verification + Devnet authority/registry preflight and transaction plan
npm run nft:cloudflare:tool-metadata:registry -- --bundle ../out/tool-nft-cloudflare \
  --manifest ../out/tool-nft-cloudflare/tool-nft-cloudflare-manifest.json --freeze

# After all Devnet release gates are complete; final batch irreversibly freezes the URI table
npm run nft:cloudflare:tool-metadata:registry -- --bundle ../out/tool-nft-cloudflare \
  --manifest ../out/tool-nft-cloudflare/tool-nft-cloudflare-manifest.json --submit --freeze
```

Both modes repeat the read-only checks for all 50 public assets and verify the Devnet cluster and on-chain Config authority. The helper writes batches of 8, 8, 8, and 1 URI; `--submit` requires `--freeze`, the local backend authority signer, and a successful transaction simulation for every batch. Batches are separate transactions, not one atomic transaction; if interrupted before the final freeze, rerun the same command to rewrite all 25 slots and complete the release. The final batch freezes the table irreversibly. The helper never mints NFTs, changes mining flags, or changes other registry statuses. Keep signing keys local; do not pass them as command-line arguments or send them in chat. Do not write any URI or mint unless both the 50-asset verifier and the separate bytecode/smoke gates pass.

## Metadata contract for the 5 × 5 tool set

- Canonical types and names come from the existing game catalog: Plasma Cutter, Silicon Extractor, Data Harvester, Quantum Transmitter, and Neural Seeder.
- The five rarity values retain both the on-chain English enum (`Common` … `Legendary`) and the site's English labels (`Base`, `Enhanced`, `Quantum`, `Singularity`, `Transcendent`) as metadata attributes.
- The JSON `name` is the English tool name. Rarity is a separate trait and appears in the description. Keeping the name to the tool name keeps every UTF-8 name within Metaplex's 32-byte name limit (including `Quantum Transmitter`).
- `NFORGE` is **not** used as the tool NFT symbol: it is present in the utility-token metadata only, and no tool-NFT symbol has been approved. The tool JSON therefore omits `symbol`; the on-chain metadata implementation must use an empty symbol until one is explicitly approved.
- **Approved for this Devnet pilot: `seller_fee_basis_points = 0`** (no seller royalty). The Cloudflare bundle fixes JSON metadata at 0 bps, and the registry helper hard-codes the same value; the separate Arweave command requires `--seller-fee-bps 0`. Creator shares and collection mint remain unapproved and are omitted; do not add creator or collection claims. The generic metadata helper still omits the optional fee field in draft mode unless an explicit value is supplied.
- For the selected Devnet route, image and JSON URIs use the separate Cloudflare Pages project and immutable-looking, versioned paths; JSON metadata URIs are kept within the on-chain 80-byte URI limit. The optional Arweave uploader below remains a separate, explicit mainnet-storage path and is not required for this Devnet release.

## Local Arweave preparation and explicit upload

Run locally from the backend directory after installing the locked backend dependencies:

```sh
cd aof_backend
npm ci
npm run nft:arweave:tool-metadata -- --estimate --seller-fee-bps 0
```

This explicit estimate includes the approved 0 bps field in the pending JSON and prices all still-pending images and metadata for Arweave mainnet. Estimate mode does not read a wallet, write a transaction, or send anything to Solana. The estimate is a point-in-time price and can change. The resumable manifest is written under the repository's ignored `out/` directory.

Arweave is mainnet storage, so uploads can incur real cost even though the NFTs are intended for Solana Devnet. The owner approved a hard maximum of **0.20 AR** for the 25 image + 25 JSON uploads, with `seller_fee_basis_points = 0`. Re-estimate immediately before uploading; if the pending total exceeds the cap, stop and obtain a new approval. The user runs the command locally with an owner-only JWK file:

```sh
ARWEAVE_JWK_PATH="$HOME/.config/arweave/jwk.json" \
  npm run nft:arweave:tool-metadata -- --upload --max-cost-ar 0.20 --seller-fee-bps 0
```

The script retries classified transient price/anchor GET failures (network timeouts/resets and HTTP 429/502/503/504) up to five attempts with backoff; POSTs are never blindly retried. If a price still fails, the estimator continues through the full pending matrix, prints unavailable rows and a clearly labeled partial sum, then exits nonzero without permitting upload. It rejects any `--max-cost-ar` value above 0.20 AR before making network requests, checks the refreshed pending estimate plus all rewards recorded by earlier runs against the requested cumulative ceiling before uploading, and checks each newly signed transaction against the remaining allowance. Each accepted entry stores its exact reward in Winston, so restarting does not reset the release budget. Before each POST, the signed transaction ID and reward are journaled locally; if a POST outcome is ambiguous, the tool stops on the unresolved reservation rather than risking a duplicate upload, and that transaction must be reconciled before resuming. Upload mode also rejects any seller fee other than the approved 0 bps. JWK contents must stay on the user's machine. After upload, wait for Arweave confirmation and verify all gateway responses before putting metadata URIs on Solana.

### Read-only post-upload verification

Once the local manifest is complete and the transactions have confirmed, run this from `aof_backend`:

```sh
npm run nft:arweave:verify-tool-metadata -- --manifest ../out/tool-nft-arweave-manifest.json
```

The verifier makes only public HTTPS `GET` requests to the Arweave gateway. It validates the exact 25-variant catalog, the approved 0 bps fee, recorded cumulative rewards at or below 0.20 AR, and all 50 distinct transaction IDs; checks each local artwork digest; fetches every image and JSON document; verifies HTTP status and MIME type; compares gateway bytes to manifest SHA-256 digests; and checks each JSON document against the canonical English metadata builder and its paired image transaction. It does not access the JWK, write files, submit Arweave transactions, or send Solana transactions. It has not been run against Arweave as part of this staged code-only work. Offline mocked-fetch coverage can be run with `npm run test:tool-nft-arweave-verify`.

## Remaining release gates

1. **Neither storage tool submits Solana transactions.** Review the separate on-chain URI-registry/mint changes, build with the repository's pinned Anchor/Rust toolchain, compare generated IDLs, and complete Devnet smoke tests before writing metadata URIs or minting.
2. Confirm Metadata account size and rent against the selected validator runtime before release. Issuance pays the Metadata rent **and** Metaplex's flat 0.01 SOL `CreateMetadataAccountV3` fee, which the program parks in the same account ([Metaplex FAQ](https://developers.metaplex.com/token-metadata/faq)); `aof_core::vrf::tool_settlement_rent`, the settler reimbursement and the payer quotes cover both, and Master Edition rent is not part of issuance. Conservative payer quotes can overestimate rent ([Metaplex account-size guide](https://developers.metaplex.com/token-metadata/guides/account-size-reduction)).
3. Before using any metadata URI on Solana, deploy the chosen host and pass its read-only verifier on all 25 image/JSON pairs. Cloudflare verification proves the current public deployment's bytes but does not make those URLs permanently immutable. The prior Arweave budget and the 0 bps royalty do not constitute approval to mint or change on-chain registry state.
4. For the explicitly approved isolated local-validator checks only, use synthetic test URIs and the existing bounded fixtures to verify owner, decimals 0, supply 1, `mint_authority == None`, `freeze_authority == None`, no Master Edition account, `ToolData`, immutable Metadata, and rent accounting. Do not repeat pack/reveal/refund flows; this does not authorize production registry changes or deployed-network transactions.
5. Exercise the broader game modules in the staged Devnet smoke matrix; this tool-NFT pilot does not establish whole-game readiness.
6. Keep mining disabled until all six program bytecodes match, the clean Devnet preflight covers payout mints and the valid material-mint registry, and the separate smoke gate passes. The explicitly accepted uncapped-lifetime-issuance policy is Devnet-only and still requires its preflight acknowledgement; the four finite cap values remain unapproved and unapplied. Do not run `issuance:lifetime-caps:apply`. Bringup must not alter registry statuses automatically.

Cap values are intentionally absent here: repository scenarios are not approved lifetime caps.
