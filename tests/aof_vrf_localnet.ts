/**
 * [F-06] The full VRF cycle on the real runtime: pool slot -> pack commit ->
 * permissionless reveal -> NFT settlement, through aof-core's actual CPIs.
 *
 * A Switchboard oracle cannot sign for a local chain, so the CI job loads a
 * test double at the Switchboard program id (tests/mock-switchboard: the same
 * discriminators, account order, account layout and state transitions, no
 * enclave signature check). What this proves on the real runtime:
 *   - the signer seeds and account lists of the init / commit / reveal CPIs;
 *   - the commit-time freshness check against the real SlotHashes sysvar;
 *   - the oracle binding, the slot lock and its release, the escrow release
 *     and the settler reimbursement;
 *   - the outcome derivation (recomputed here from the published value);
 *   - the compute units of the VRF instructions (tests/aof_cu_report.ts).
 * What it does not prove: Switchboard's own signature verification, which
 * aof_backend/scripts/vrfDevnetProbe.ts exercises against the devnet queue.
 *
 * Without the test double (a plain local `anchor test`) the suite is skipped;
 * CI sets AOF_REQUIRE_SWITCHBOARD_MOCK so that it can never be skipped there.
 */
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import * as crypto from "crypto";
import fs from "fs";

const SB_PROGRAM = new PublicKey("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv");
const SB_QUEUE = new PublicKey("A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w");
const SB_STATE = new PublicKey("7Gs9n5FQMeC9XcEhg281bRZ6VHRrCvqp5Yq1j78HkvNa");
const SLOT_HASHES = new PublicKey("SysvarS1otHashes111111111111111111111111111");
const ALT_PROGRAM = new PublicKey("AddressLookupTab1e1111111111111111111111111");
// aof-core constants::PACK_TOOL_TYPES and state::Rarity, in order.
const PACK_TOOL_TYPES = ["plasma_cutter", "silicon_extractor", "data_harvester"];
const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];

/** aof-core settlement::roll_tool: vrf::derive_roll, lanes 0/1, bps, weighted_pick. */
export function rollTool(value: Buffer, tag: string, commit: PublicKey, odds: number[]) {
  const roll = crypto.createHash("sha256")
    .update(Buffer.from("aof-vrf-v1")).update(Buffer.from(tag)).update(commit.toBuffer()).update(value)
    .digest();
  const lane = (i: number) => roll.readBigUInt64LE(i * 8);
  const below = (x: bigint, n: bigint) => (x * n) >> 64n;
  const bps = Number(below(lane(0), 10_000n));
  let rarity = odds.length - 1;
  let acc = 0;
  for (let i = 0; i < odds.length; i += 1) {
    acc += odds[i];
    if (bps % 10_000 < acc) {
      rarity = i;
      break;
    }
  }
  return { bps, rarity, toolType: PACK_TOOL_TYPES[Number(below(lane(1), BigInt(PACK_TOOL_TYPES.length)))] };
}

describe("aof-core: VRF cycle on the local validator (Switchboard test double)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const idlJson = JSON.parse(fs.readFileSync(process.cwd() + "/target/idl/aof_core.json", "utf8"));
  if (!idlJson.address) idlJson.address = "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq";
  const program: any = new anchor.Program(idlJson as any, provider);
  const pid = program.programId as PublicKey;
  const authority = provider.wallet.publicKey;

  const B = (s: string) => Buffer.from(s);
  const pda = (seeds: Buffer[], programId = pid) => PublicKey.findProgramAddressSync(seeds, programId)[0];
  const u32le = (n: number) => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n, 0);
    return b;
  };
  const u64le = (n: BN) => n.toArrayLike(Buffer, "le", 8);
  const configPda = pda([B("config")]);
  const vrfAuthority = pda([B("vrf_authority")]);
  const packConfig = pda([B("pack_config"), Buffer.from([0])]);
  const authPda = pda([B("auth")]);
  const zero = PublicKey.default.toBase58();

  const airdrop = async (kp: Keypair, sol = 5) =>
    connection.confirmTransaction(await connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL));

  async function expectError(p: Promise<any>, code: string) {
    try {
      await p;
    } catch (e: any) {
      const got = e?.error?.errorCode?.code ?? "";
      if (got === code) return;
      throw new Error(`expected ${code}, got: ${got} | ${String(e?.message ?? e).slice(0, 200)}`);
    }
    throw new Error(`expected ${code}, but the call succeeded`);
  }

  // Lamport change of each account inside one transaction (its pre/post
  // balances), plus the fee its payer was charged. Exact even for the provider
  // wallet, which is the treasury here and pays every fee of the suite.
  async function txDeltas(signature: string) {
    await connection.confirmTransaction(signature, "confirmed");
    const tx = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx?.meta) throw new Error(`transaction ${signature} not found`);
    const meta = tx.meta;
    const keys = tx.transaction.message.getAccountKeys().staticAccountKeys;
    const index = (key: PublicKey) => {
      const i = keys.findIndex((k) => k.equals(key));
      if (i < 0) throw new Error(`${key.toBase58()} is not an account of ${signature}`);
      return i;
    };
    const delta = (key: PublicKey) => meta.postBalances[index(key)] - meta.preBalances[index(key)];
    return Object.assign(delta, { fee: meta.fee, pre: (key: PublicKey) => meta.preBalances[index(key)] });
  }

  // The provider wallet is the treasury and pays every fee. On this validator
  // its balance can end a few lamports off credit - meta.fee (seen: +16), so
  // its delta gets a small window; the program's own transfers are pinned
  // exactly through the commit account, the settler and the player.
  function expectFeePayerDelta(actual: number, expected: number) {
    expect(actual - expected, `fee payer delta ${actual} vs ${expected}`).to.be.within(-1_000, 1_000);
  }

  let index = -1;
  // The commit made by the commit test, settled by the reveal test.
  let pending: { user: Keypair; packCommit: PublicKey; oracle: PublicKey } | undefined;
  let randomness: PublicKey;
  let vrfSlot: PublicKey;
  let treasury: PublicKey;
  let price: BN;
  let odds: number[];

  // Default commitment on purpose: .rpc() confirms at the provider's
  // commitment, and a stricter read can still see the previous state.
  async function readRandomness() {
    const info = await connection.getAccountInfo(randomness);
    if (!info) throw new Error("randomness account missing");
    const d = info.data;
    return {
      owner: info.owner,
      authority: new PublicKey(d.subarray(8, 40)),
      queue: new PublicKey(d.subarray(40, 72)),
      seedSlot: d.readBigUInt64LE(104),
      oracle: new PublicKey(d.subarray(112, 144)),
      revealSlot: d.readBigUInt64LE(144),
      value: Buffer.from(d.subarray(152, 184)),
    };
  }

  const commitAccounts = (user: PublicKey, packCommit: PublicKey, oracle: PublicKey) => ({
    config: configPda, authority, user, packConfig, packCommit, vrfSlot, randomness, vrfAuthority,
    queue: SB_QUEUE, oracle, recentSlothashes: SLOT_HASHES, switchboardProgram: SB_PROGRAM,
    systemProgram: SystemProgram.programId,
  });

  const revealAccounts = (cranker: PublicKey, user: PublicKey, packCommit: PublicKey, oracle: PublicKey) => {
    const mint = pda([B("pack_mint"), packCommit.toBuffer()]);
    return {
      config: configPda, cranker, packCommit, user, treasury, mint,
      userToken: getAssociatedTokenAddressSync(mint, user),
      toolData: pda([B("tool"), mint.toBuffer()]), auth: authPda,
      ...switchboardRevealAccounts(oracle),
      tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    };
  };

  const revealParams = (value: Buffer) => ({ signature: Array(64).fill(0), recoveryId: 0, value: Array.from(value) });

  /** Shared Switchboard accounts of every reveal. */
  const switchboardRevealAccounts = (oracle: PublicKey) => ({
    vrfSlot, randomness, vrfAuthority, oracle, queue: SB_QUEUE,
    stats: pda([B("OracleRandomnessStats"), oracle.toBuffer()], SB_PROGRAM),
    recentSlothashes: SLOT_HASHES,
    rewardEscrow: getAssociatedTokenAddressSync(NATIVE_MINT, randomness, true),
    wrappedSolMint: NATIVE_MINT, programState: SB_STATE, switchboardProgram: SB_PROGRAM,
  });

  /** A tool NFT issued by the program, as tests/aof_core.ts mintTool does. */
  async function mintTool(owner: Keypair) {
    const mint = await createMint(connection, owner, authPda, null, 0);
    const tokenAccount = (await getOrCreateAssociatedTokenAccount(connection, owner, mint, owner.publicKey)).address;
    await program.methods.mintTool("axe", { common: {} }).accounts({
      config: configPda, authority, auth: authPda, mint, tokenAccount, recipient: owner.publicKey,
      toolData: pda([B("tool"), mint.toBuffer()]), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).rpc();
    return { mint, tokenAccount };
  }

  async function commitPack(oracle: PublicKey) {
    const user = Keypair.generate();
    await airdrop(user);
    const nonce = new BN(Date.now());
    const packCommit = pda([B("pack_commit"), user.publicKey.toBuffer(), u64le(nonce)]);
    await program.methods.packOpenCommit({ small: {} }, nonce, price)
      .accounts(commitAccounts(user.publicKey, packCommit, oracle)).signers([user]).rpc();
    return { user, packCommit };
  }

  before(async function () {
    const sb = await connection.getAccountInfo(SB_PROGRAM);
    if (!sb?.executable) {
      if (process.env.AOF_REQUIRE_SWITCHBOARD_MOCK) {
        throw new Error(`the Switchboard test double is not loaded at ${SB_PROGRAM.toBase58()}`);
      }
      console.log("      skipped: no Switchboard program on this validator (CI loads tests/mock-switchboard)");
      this.skip();
    }
    for (let i = 0; i < 64 && index < 0; i += 1) {
      const r = pda([B("vrf_randomness"), u32le(i)]);
      if (!(await connection.getAccountInfo(pda([B("vrf_slot"), r.toBuffer()])))) index = i;
    }
    expect(index).to.be.greaterThan(-1);
    randomness = pda([B("vrf_randomness"), u32le(index)]);
    vrfSlot = pda([B("vrf_slot"), randomness.toBuffer()]);
    treasury = (await program.account.config.fetch(configPda)).treasury;
    // tests/aof_core.ts creates pack config 0 in its empty-pool test.
    const pc = await program.account.packConfig.fetch(packConfig);
    price = pc.priceLamports;
    odds = pc.oddsBps.map(Number);
  });

  it("vrf_pool_add: only the operator, and the CPI creates a Switchboard-owned account with the program PDA as authority", async () => {
    const recentSlot = await connection.getSlot("finalized");
    const lutSigner = pda([B("LutSigner"), randomness.toBuffer()], SB_PROGRAM);
    const accounts = (operator: PublicKey) => ({
      config: configPda, operator, vrfAuthority, randomness, vrfSlot,
      rewardEscrow: getAssociatedTokenAddressSync(NATIVE_MINT, randomness, true),
      queue: SB_QUEUE, programState: SB_STATE, lutSigner,
      lut: pda([lutSigner.toBuffer(), new BN(recentSlot).toArrayLike(Buffer, "le", 8)], ALT_PROGRAM),
      wrappedSolMint: NATIVE_MINT, switchboardProgram: SB_PROGRAM, addressLookupTableProgram: ALT_PROGRAM,
      tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    });
    const stranger = Keypair.generate();
    await airdrop(stranger, 1);
    await expectError(program.methods.vrfPoolAdd(index, new BN(recentSlot))
      .accounts(accounts(stranger.publicKey)).signers([stranger]).rpc(), "Unauthorized");
    await program.methods.vrfPoolAdd(index, new BN(recentSlot)).accounts(accounts(authority)).rpc();

    const r = await readRandomness();
    expect(r.owner.toBase58()).to.equal(SB_PROGRAM.toBase58());
    expect(r.authority.toBase58()).to.equal(vrfAuthority.toBase58());
    expect(r.queue.toBase58()).to.equal(SB_QUEUE.toBase58());
    const slot = await program.account.vrfSlot.fetch(vrfSlot);
    expect(slot.randomness.toBase58()).to.equal(randomness.toBase58());
    expect(slot.lock.toBase58()).to.equal(zero);
    expect(slot.retired).to.equal(false);
  });

  it("pack commit: escrows the price, seeds from the previous slot's hash, binds the oracle and locks the slot", async () => {
    const oracle = Keypair.generate().publicKey;
    const user = Keypair.generate();
    await airdrop(user);
    const nonce = new BN(7);
    const packCommit = pda([B("pack_commit"), user.publicKey.toBuffer(), u64le(nonce)]);
    const before = await connection.getBalance(user.publicKey);
    // The operator must co-sign: a commit signed by the player alone is refused.
    const stranger = Keypair.generate();
    await airdrop(stranger, 1);
    await expectError(program.methods.packOpenCommit({ small: {} }, nonce, price)
      .accounts({ ...commitAccounts(user.publicKey, packCommit, oracle), authority: stranger.publicKey })
      .signers([user, stranger]).rpc(), "Unauthorized");
    // A price above the player's limit is refused.
    await expectError(program.methods.packOpenCommit({ small: {} }, nonce, price.subn(1))
      .accounts(commitAccounts(user.publicKey, packCommit, oracle)).signers([user]).rpc(), "PriceAboveMaximum");

    await program.methods.packOpenCommit({ small: {} }, nonce, price)
      .accounts(commitAccounts(user.publicKey, packCommit, oracle)).signers([user]).rpc();
    const commit = await program.account.packCommit.fetch(packCommit);
    const r = await readRandomness();
    expect(commit.randomness.toBase58()).to.equal(randomness.toBase58());
    expect(r.seedSlot.toString()).to.equal(commit.seedSlot.toString());
    expect(BigInt(commit.commitSlot.toString()) - 1n).to.equal(r.seedSlot);
    expect(r.oracle.toBase58()).to.equal(oracle.toBase58());
    expect(r.revealSlot).to.equal(0n);
    const slot = await program.account.vrfSlot.fetch(vrfSlot);
    expect(slot.lock.toBase58()).to.equal(packCommit.toBase58());
    expect(slot.commits.toString()).to.equal("1");
    // Price and the prepaid settlement rent sit in the commit account.
    const escrowed = price.add(commit.depositLamports).toNumber();
    expect(await connection.getBalance(packCommit)).to.be.at.least(escrowed);
    expect(before - (await connection.getBalance(user.publicKey))).to.be.at.least(escrowed);

    // The slot is busy until the reveal: a second commit on it is refused.
    const other = Keypair.generate();
    await airdrop(other);
    const otherCommit = pda([B("pack_commit"), other.publicKey.toBuffer(), u64le(nonce)]);
    await expectError(program.methods.packOpenCommit({ small: {} }, nonce, price)
      .accounts(commitAccounts(other.publicKey, otherCommit, oracle)).signers([other]).rpc(), "VrfSlotBusy");

    pending = { user, packCommit, oracle };
  });

  it("pack reveal: another oracle is refused; a third party settles, the NFT matches the published value, escrow and slot are released", async () => {
    if (!pending) throw new Error("the commit test did not leave a pending commit");
    const { user, packCommit, oracle } = pending;
    const commit = await program.account.packCommit.fetch(packCommit);
    const cranker = Keypair.generate();
    await airdrop(cranker, 2);
    const value = crypto.createHash("sha256").update("aof localnet vrf #1").digest();

    await expectError(program.methods.packOpenReveal(revealParams(value))
      .accounts(revealAccounts(cranker.publicKey, user.publicKey, packCommit, Keypair.generate().publicKey))
      .signers([cranker]).rpc(), "InvalidRandomnessAccount");

    const accounts = revealAccounts(cranker.publicKey, user.publicKey, packCommit, oracle);
    const signature = await program.methods.packOpenReveal(revealParams(value)).accounts(accounts).signers([cranker]).rpc();
    const d = await txDeltas(signature);

    // Outcome = aof-core's roll of the published value for this commit.
    const expected = rollTool(value, "pack", packCommit, odds);
    const tool = await program.account.toolData.fetch(accounts.toolData);
    expect(Object.keys(tool.rarity)[0]).to.equal(RARITIES[expected.rarity]);
    expect(tool.toolType).to.equal(expected.toolType);
    expect(tool.owner.toBase58()).to.equal(user.publicKey.toBase58());
    expect(tool.mint.toBase58()).to.equal(accounts.mint.toBase58());
    expect((await connection.getTokenAccountBalance(accounts.userToken)).value.amount).to.equal("1");

    // Switchboard's account now carries the value; the slot is free again.
    const r = await readRandomness();
    expect(r.value.equals(value)).to.equal(true);
    expect(r.revealSlot > 0n).to.equal(true);
    expect(r.oracle.toBase58()).to.equal(zero);
    const slot = await program.account.vrfSlot.fetch(vrfSlot);
    expect(slot.lock.toBase58()).to.equal(zero);
    expect(slot.reveals.toString()).to.equal("1");

    // Money, to the lamport inside the reveal transaction: the price goes to
    // the treasury, the settler gets back exactly the rent it fronted for the
    // NFT accounts, and the rest of the commit account returns to the player.
    expect(await connection.getAccountInfo(packCommit)).to.equal(null);
    const commitLamports = d.pre(packCommit);
    expect(d(packCommit)).to.equal(-commitLamports);
    if (treasury.equals(authority)) expectFeePayerDelta(d(treasury), commit.paidLamports.toNumber() - d.fee);
    else expect(d(treasury)).to.equal(commit.paidLamports.toNumber());
    const settlementRent = d(accounts.mint) + d(accounts.userToken) + d(accounts.toolData);
    expect(d(cranker.publicKey)).to.equal(commit.depositLamports.toNumber() - settlementRent);
    expect(d(user.publicKey)).to.equal(commitLamports - commit.paidLamports.toNumber() - commit.depositLamports.toNumber());

    // Settled once: the commit account is gone.
    await expectError(program.methods.packOpenReveal(revealParams(value)).accounts(accounts).signers([cranker]).rpc(),
      "AccountNotInitialized");
  });

  it("the freed slot serves the next commit: a recommit resets the reveal and settles with its own value", async () => {
    const oracle = Keypair.generate().publicKey;
    const { user, packCommit } = await commitPack(oracle);
    let r = await readRandomness();
    expect(r.revealSlot).to.equal(0n);
    expect(r.value.equals(Buffer.alloc(32))).to.equal(true);
    expect(r.oracle.toBase58()).to.equal(oracle.toBase58());

    const cranker = Keypair.generate();
    await airdrop(cranker, 2);
    const value = crypto.createHash("sha256").update("aof localnet vrf #2").digest();
    const accounts = revealAccounts(cranker.publicKey, user.publicKey, packCommit, oracle);
    await program.methods.packOpenReveal(revealParams(value)).accounts(accounts).signers([cranker]).rpc();
    const expected = rollTool(value, "pack", packCommit, odds);
    const tool = await program.account.toolData.fetch(accounts.toolData);
    expect(Object.keys(tool.rarity)[0]).to.equal(RARITIES[expected.rarity]);
    expect(tool.toolType).to.equal(expected.toolType);
    r = await readRandomness();
    expect(r.value.equals(value)).to.equal(true);
    const slot = await program.account.vrfSlot.fetch(vrfSlot);
    expect(slot.lock.toBase58()).to.equal(zero);
    expect([slot.commits.toString(), slot.reveals.toString()]).to.deep.equal(["2", "2"]);
  });

  it("random reroll: the commit burns the old tool and takes the fee from the gas tank, the reveal mints the rolled tool", async () => {
    const rerollConfig = pda([B("reroll_config")]);
    const rerollOdds: number[] = (await program.account.rerollConfig.fetch(rerollConfig)).oddsBps.map(Number);
    const user = Keypair.generate();
    await airdrop(user);
    const { mint: burnMint, tokenAccount: burnToken } = await mintTool(user);
    const gastank = pda([B("gastank"), user.publicKey.toBuffer()]);
    await program.methods.depositGas(new BN(100_000_000)).accounts({
      config: configPda, user: user.publicKey, gastank, systemProgram: SystemProgram.programId,
    }).signers([user]).rpc();
    const tankBefore = (await program.account.gasTank.fetch(gastank)).balanceMicros.toNumber();

    const oracle = Keypair.generate().publicKey;
    const nonce = new BN(11);
    const rerollCommit = pda([B("reroll_commit"), user.publicKey.toBuffer(), u64le(nonce)]);
    await program.methods.rerollRandomCommit(nonce).accounts({
      config: configPda, authority, user: user.publicKey, gastank, rerollConfig,
      burnTool: pda([B("tool"), burnMint.toBuffer()]), burnMint, burnToken, rerollCommit,
      vrfSlot, randomness, vrfAuthority, queue: SB_QUEUE, oracle, recentSlothashes: SLOT_HASHES,
      switchboardProgram: SB_PROGRAM, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([user]).rpc();
    // The old tool is gone at commit time: token account and ToolData closed.
    expect(await connection.getAccountInfo(burnToken)).to.equal(null);
    expect(await connection.getAccountInfo(pda([B("tool"), burnMint.toBuffer()]))).to.equal(null);
    const commit = await program.account.rerollCommit.fetch(rerollCommit);
    expect((await program.account.gasTank.fetch(gastank)).balanceMicros.toNumber())
      .to.equal(tankBefore - commit.feeLamports.toNumber() / 1_000);
    expect((await program.account.vrfSlot.fetch(vrfSlot)).lock.toBase58()).to.equal(rerollCommit.toBase58());

    const cranker = Keypair.generate();
    await airdrop(cranker, 2);
    const value = crypto.createHash("sha256").update("aof localnet vrf reroll").digest();
    const newMint = pda([B("reroll_mint"), rerollCommit.toBuffer()]);
    const newToolData = pda([B("tool"), newMint.toBuffer()]);
    const signature = await program.methods.rerollRandomReveal(revealParams(value)).accounts({
      config: configPda, cranker: cranker.publicKey, rerollCommit, user: user.publicKey, treasury, newMint,
      newToken: getAssociatedTokenAddressSync(newMint, user.publicKey), newToolData, auth: authPda,
      ...switchboardRevealAccounts(oracle),
      tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).signers([cranker]).rpc();
    const d = await txDeltas(signature);

    const expected = rollTool(value, "reroll", rerollCommit, rerollOdds);
    const tool = await program.account.toolData.fetch(newToolData);
    expect(Object.keys(tool.rarity)[0]).to.equal(RARITIES[expected.rarity]);
    expect(tool.toolType).to.equal(expected.toolType);
    expect(tool.owner.toBase58()).to.equal(user.publicKey.toBase58());
    expect((await connection.getTokenAccountBalance(getAssociatedTokenAddressSync(newMint, user.publicKey))).value.amount)
      .to.equal("1");
    expect(await connection.getAccountInfo(rerollCommit)).to.equal(null);
    expect((await program.account.vrfSlot.fetch(vrfSlot)).lock.toBase58()).to.equal(zero);
    if (treasury.equals(authority)) expectFeePayerDelta(d(treasury), commit.feeLamports.toNumber() - d.fee);
    else expect(d(treasury)).to.equal(commit.feeLamports.toNumber());
    expect(d(rerollCommit)).to.equal(-d.pre(rerollCommit));
  });
});
