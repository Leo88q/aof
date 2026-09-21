import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BorshAccountsCoder, BorshInstructionCoder } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import idl from "../src/idl/aof_core.json";
import { inboxRewardId, rewardReceiptPda, fetchRewardReceipt, assertRewardReceipt } from "../src/lib/rewardReceipt";
import { reconcileInboxClaims } from "../src/lib/rewardReconciliation";
import { serializeChainValue } from "../src/lib/serializeChain";
import { parsePurchaseBounds } from "../src/security/purchaseBounds";

async function main() {
  const recipient = Keypair.generate().publicKey, mint = Keypair.generate().publicKey;
  const id = "stable-inbox-id", core = new PublicKey(idl.address);
  assert.deepEqual(inboxRewardId(id), inboxRewardId(id));
  assert.notDeepEqual(inboxRewardId(id), inboxRewardId(id + "2"));
  // [AUDIT F-28] the receipt tombstone is namespaced by (recipient, reward_id).
  const [pda, bump] = PublicKey.findProgramAddressSync([Buffer.from("reward_receipt"), recipient.toBuffer(), inboxRewardId(id)], core);
  assert.ok(pda.equals(rewardReceiptPda(id, recipient)));
  // Two wallets claiming the same logical reward must NOT collide: the old
  // global namespace made the second claim impossible ("already claimed").
  const other = Keypair.generate().publicKey;
  assert.ok(!rewardReceiptPda(id, other).equals(pda));
  assert.ok(rewardReceiptPda(id, other).equals(
    PublicKey.findProgramAddressSync([Buffer.from("reward_receipt"), other.toBuffer(), inboxRewardId(id)], core)[0]));
  const coder = new BorshAccountsCoder(idl as any);
  const gross = new BN("1000000000");
  const data = await coder.encode("RewardReceipt", {
    reward_id: Array.from(inboxRewardId(id)), recipient, mint, gross_amount: gross, claimed_slot: new BN(9), bump,
  });
  assert.equal(data.length, 121); // Exact Anchor layout, discriminator included.
  const rpc: any = { getAccountInfo: async (key: PublicKey, commitment: string) => {
    assert.ok(key.equals(pda)); assert.equal(commitment, "finalized");
    return { owner: core, data, executable: false };
  } };
  const expected = { recipient: recipient.toBase58(), mint: mint.toBase58(), grossAmount: gross.toString() };
  assert.deepEqual(await fetchRewardReceipt(rpc, id, recipient), expected);
  assertRewardReceipt(expected, expected);
  for (const mismatch of [{ ...expected, recipient: mint.toBase58() }, { ...expected, mint: recipient.toBase58() }, { ...expected, grossAmount: "2" }]) {
    assert.throws(() => assertRewardReceipt(expected, mismatch), /conflicts/);
  }
  assert.equal(await fetchRewardReceipt({ getAccountInfo: async () => null } as any, id, recipient), null);
  await assert.rejects(fetchRewardReceipt({ getAccountInfo: async () => { throw Error("RPC timeout"); } } as any, id, recipient), /timeout/);
  await assert.rejects(fetchRewardReceipt({ getAccountInfo: async () => ({ owner: mint, data }) } as any, id, recipient), /owner/);
  await assert.rejects(fetchRewardReceipt({ getAccountInfo: async () => ({ owner: core, data: Buffer.alloc(121) }) } as any, id, recipient));

  const instructions = new BorshInstructionCoder(idl as any);
  const encoded = instructions.encode("mint_resource_once", { kind: { Wood: {} }, amount: gross, reward_id: Array.from(inboxRewardId(id)) });
  assert.equal(encoded.length, 49); // 8 discriminator + 1 enum + 8 amount + 32 ID
  const buy = instructions.encode("marketplace_buy_bounded", { max_price_lamports: new BN("18446744073709551615"), expires_at: new BN(150) });
  assert.equal(buy.length, 24);
  assert.equal(buy.readBigUInt64LE(8), (1n << 64n) - 1n);
  assert.deepEqual(parsePurchaseBounds({ maxPriceLamports: "18446744073709551615", expiresAt: "150" }, 100), { maxPriceLamports: "18446744073709551615", expiresAt: "150" });
  for (const bad of [1, "-1", "1e9", "18446744073709551616"]) assert.throws(() => parsePurchaseBounds({ maxPriceLamports: bad, expiresAt: "150" }, 100));
  for (const bad of [100, "100", "401", "9223372036854775807"]) assert.throws(() => parsePurchaseBounds({ maxPriceLamports: "1", expiresAt: bad }, 100));
  assert.deepEqual(serializeChainValue({ values: [new BN("18446744073709551615"), 9007199254740993n], recipient }), { values: ["18446744073709551615", "9007199254740993"], recipient: recipient.toBase58() });

  const row: any = { id, rewardVersion: 1, rewardAmount: 1, claimMint: expected.mint, user: expected.recipient, claimSignature: "duplicate-retry" };
  const updates: any[] = [];
  const db: any = { inboxItem: { findMany: async () => [row], updateMany: async (value: any) => { updates.push(value); return { count: 1 }; } } };
  const failed: any = { getSignatureStatuses: async () => ({ value: [{ err: "already initialized", confirmationStatus: "finalized" }] }) };
  // A failed duplicate transaction does NOT undo the original finalized receipt.
  assert.equal(await reconcileInboxClaims(db, failed, async () => expected), 1);
  assert.equal(updates[0].data.claimState, "confirmed");
  updates.length = 0;
  assert.equal(await reconcileInboxClaims(db, { getSignatureStatuses: async () => ({ value: [{ err: null, confirmationStatus: "finalized" }] }) } as any, async () => null), 0);
  assert.equal(updates.length, 0);
  assert.equal(await reconcileInboxClaims(db, failed, async () => ({ ...expected, grossAmount: "2" })), 0);
  assert.equal(updates[0].data.claimState, "quarantined");
  updates.length = 0;
  assert.equal(await reconcileInboxClaims(db, failed, async () => null), 1);
  assert.equal(updates[0].data.claimed, false);

  let pages = 0;
  const paged: any = { inboxItem: {
    findMany: async (query: any) => {
      pages++;
      if (pages === 1) return Array.from({ length: 100 }, (_, i) => ({ ...row, id: String(i).padStart(3, "0"), rewardVersion: 0 }));
      assert.equal(query.where.id.gt, "099"); return [{ ...row, id: "100", rewardVersion: 0 }];
    }, updateMany: async () => ({ count: 1 }),
  } };
  const statuses: any = { getSignatureStatuses: async (signatures: string[]) => ({ value: signatures.length === 100 ? Array(100).fill(null) : [{ err: null, confirmationStatus: "finalized" }] }) };
  assert.equal(await reconcileInboxClaims(paged, statuses), 1);
  assert.equal(pages, 2);


  // A bounded one-shot job resumes beyond 1000 unresolved rows on its next run.
  let saved: string | null = null, resumeQueries: any[] = [];
  const checkpointDb: any = { inboxItem: { findMany: async (query: any) => {
    resumeQueries.push(query);
    if (query.where.id?.gt === "099") return [];
    return Array.from({ length: 100 }, (_, i) => ({ ...row, id: String(i).padStart(3, "0"), rewardVersion: 0 }));
  } } };
  const checkpoint = async (cursor: string | null) => { saved = cursor; };
  await reconcileInboxClaims(checkpointDb, statuses, undefined, 1, { checkpoint });
  assert.equal(saved, "099");
  await reconcileInboxClaims(checkpointDb, statuses, undefined, 1, { cursor: saved!, checkpoint });
  assert.equal(resumeQueries[1].where.id.gt, "099");
  assert.equal(saved, null);

  // Static checks complement, not replace, the validator replay tests.
  const root = path.resolve(__dirname, "../..");
  const toml = require("toml");
  assert.equal(require("toml/package.json").version, "4.2.0");
  const config = toml.parse(readFileSync(path.join(root, "Anchor.toml"), "utf8"));
  assert.equal(config.programs.localnet.aof_core, idl.address);
  try { toml.parse('[__proto__]\npolluted = "yes"'); } catch { /* rejecting special keys is also safe */ }
  assert.equal(({} as any).polluted, undefined);
  const browserIntent = readFileSync(path.join(root, "frontend/src/lib/transactionIntent.ts"), "utf8");
  assert.equal(browserIntent.match(/CORE_PROGRAM_ID = "([^"]+)"/)?.[1], idl.address);
  assert.deepEqual(JSON.parse(browserIntent.match(/MARKETPLACE_BUY_DISCRIMINATOR = (\[[^\]]+\])/)![1]),
    idl.instructions.find((ix) => ix.name === "marketplace_buy_bounded")!.discriminator);
  const lib = readFileSync(path.join(root, "aof-core/src/lib.rs"), "utf8");
  assert.match(lib, /pub fn marketplace_buy\(ctx: Context<MarketplaceBuy>\)[\s\S]*?err!\(AofError::FeatureDisabled\)/);
  const context = lib.slice(lib.indexOf("pub struct MintResourceOnce"), lib.indexOf("pub struct BurnResource"));
  assert.match(context, /init, payer = authority, space = 8 \+ RewardReceipt::INIT_SPACE/);
  // [AUDIT F-28] the seed is (recipient, reward_id), not reward_id alone.
  assert.match(context, /seeds = \[b"reward_receipt", token_account.owner.as_ref\(\), reward_id.as_ref\(\)\]/);
  assert.doesNotMatch(context, /seeds = \[b"reward_receipt", reward_id.as_ref\(\)\]/);
  assert.doesNotMatch(context, /close\s*=/);
  for (const account of ["mint", "token_account", "treasury_token"]) assert.match(context, new RegExp(`pub ${account}:`));
  const inbox = readFileSync(path.join(root, "aof_backend/src/routes/inbox.ts"), "utf8");
  assert.match(inbox, /\.mintResourceOnce\(/);
  assert.doesNotMatch(inbox, /\.mintResource\(/);
  console.log("reward receipts: ABI/layout, finalized decoding, conflicts, replay-safe reconciliation, pagination, exact amount serialization and purchase bounds passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
