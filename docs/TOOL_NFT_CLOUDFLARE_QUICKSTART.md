# Cloudflare Pages: Devnet Tool NFT metadata bundle

This quickstart covers only the 25 Tool NFT variants: five tool types × five rarities, each with one JPEG and one metadata JSON (50 public URLs total). The 27 ResourceKind assets are fungible SPL resources and are not part of this metadata bundle; resource images stay in the game frontend. `drop-capsule.jpg` is an extra visual asset, not a ResourceKind.

Use a separate Cloudflare Pages project. The proposed slug is `aof-devnet-nft-metadata`; its availability has not been checked. Never deploy this bundle to the existing `aof` project. If a different slug is approved, prepare the bundle with that exact stable origin.

From the `aof_backend` directory:

```sh
npx wrangler login
npx wrangler pages project create aof-devnet-nft-metadata --production-branch main
node scripts/prepareToolNftCloudflareBundle.mjs --base-url https://aof-devnet-nft-metadata.pages.dev
npx wrangler pages deploy ../out/tool-nft-cloudflare --project-name aof-devnet-nft-metadata --branch main
node scripts/verifyToolNftCloudflareDeployment.mjs --manifest ../out/tool-nft-cloudflare/tool-nft-cloudflare-manifest.json
```

If the proposed slug is unavailable, stop and agree on another separate project name before preparing or deploying. If the project already exists, verify its name and destination; do not replace the existing game project. The local preparer writes 25 JPEGs, 25 canonical JSON files, a manifest, an index, and cache headers. The public verifier performs GET-only checks for all 50 URLs, including content type, canonical metadata, and SHA-256 digests.

This quickstart does not create a Pages project, deploy files, access wallet keys, purchase/upload Arweave data, write metadata URIs to Solana, mint NFTs, or enable mining. Do not write URIs or mint until the Cloudflare verification and the separate Solana bytecode/smoke gates pass. The on-chain metadata registry is configured separately.
