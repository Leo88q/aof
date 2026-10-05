import "dotenv/config";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID, unpackAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { AUTHORITY } from "../src/config";
import { connection, program } from "../src/provider";
import { authPda, configPda, materialMintsPda, resourceEscrowAta } from "../src/lib/pda";
import { authorityOnly } from "../src/lib/tx";

if (!AUTHORITY) {
  throw new Error("Initialize resource escrow ATAs with AUTHORITY_MODE=hot and AUTHORITY_SECRET_KEY");
}
const authority = AUTHORITY;

/**
 * Create the four shared auth-PDA token accounts used to escrow refundable
 * exploration/forge costs. Commit instructions intentionally require these
 * ATAs to exist (rather than running four init_if_needed CPIs inside the
 * already large Switchboard account-validation frames).
 */
async function main() {
  const [configAddress] = configPda();
  const [materialsAddress] = materialMintsPda();
  const [authorityAddress] = authPda();
  const cfg: any = await (program.account as any).config.fetch(configAddress);
  const materials: any = await (program.account as any).materialMints.fetch(materialsAddress);
  const resources: Array<[string, any]> = [
    ["data", cfg.dataMint],
    ["circuit", cfg.circuitMint],
    ["silicon", cfg.siliconMint],
    ["dataset", materials.dataset],
  ];
  const seen = new Set<string>();
  const instructions = [];
  for (const [kind, rawMint] of resources) {
    const mint = rawMint instanceof PublicKey ? rawMint : rawMint ? new PublicKey(rawMint) : null;
    if (!mint || mint.equals(PublicKey.default)) throw new Error(`${kind} mint is missing or invalid`);
    const key = mint.toBase58();
    if (seen.has(key)) throw new Error(`resource mint collision: ${kind} reuses ${key}`);
    seen.add(key);
    const address = resourceEscrowAta(mint);
    const existing = await connection.getAccountInfo(address, "confirmed");
    if (existing) {
      if (!existing.owner.equals(TOKEN_PROGRAM_ID)) throw new Error(`${kind} escrow ATA has unexpected owner ${existing.owner.toBase58()}`);
      const token = unpackAccount(address, existing, TOKEN_PROGRAM_ID);
      if (!token.mint.equals(mint) || !token.owner.equals(authorityAddress)) {
        throw new Error(`${kind} escrow ATA has unexpected mint/authority`);
      }
      console.log(`ready ${kind}: ${address.toBase58()}`);
      continue;
    }
    console.log(`create ${kind}: ${address.toBase58()}`);
    instructions.push(createAssociatedTokenAccountIdempotentInstruction(
      authority.publicKey,
      address,
      authorityAddress,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ));
  }
  if (instructions.length === 0) {
    console.log("all four resource escrow ATAs already exist");
    return;
  }
  const signature = await authorityOnly(instructions);
  console.log(`resource escrow ATAs initialized: ${signature}`);
  for (const [kind, mint] of resources) {
    const address = resourceEscrowAta(mint);
    const info = await connection.getAccountInfo(address, "confirmed");
    if (!info || !info.owner.equals(TOKEN_PROGRAM_ID)) throw new Error(`${kind} escrow ATA was not created`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
