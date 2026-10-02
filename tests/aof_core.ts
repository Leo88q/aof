import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import { createMint, getMint, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createTransferInstruction, createAccount as createTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import * as crypto from "crypto";
import fs from "fs";
import { anchorErrorCode, submitWithPayer, waitForAccountOwner } from "./payer-transaction";

const SLOT_HASHES = new PublicKey("SysvarS1otHashes111111111111111111111111111");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("aof-core: security & core flows", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const idlJson = JSON.parse(fs.readFileSync(process.cwd() + "/target/idl/aof_core.json", "utf8"));
  if (!idlJson.address) idlJson.address = "okiLaCvFyHqFRFf359emmunPKD77uUmLQ2iJWskZdnx";
  const program: any = new anchor.Program(idlJson as any, provider);
  const pid = program.programId as PublicKey;
  const authority = provider.wallet.publicKey;
  const providerSigner = (provider.wallet as anchor.Wallet).payer;

  const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, pid)[0];
  const B = (s: string) => Buffer.from(s);
  const configPda = pda([B("config")]);
  const programDataPda = PublicKey.findProgramAddressSync(
    [pid.toBuffer()],
    new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
  )[0];
  const authPda = pda([B("auth")]);
  const vaultPda = pda([B("vault")]);
  const materialMintsPda = pda([B("material_mints")]);
  const toolPda = (m: PublicKey) => pda([B("tool"), m.toBuffer()]);
  const playerPda = (u: PublicKey) => pda([B("player"), u.toBuffer()]);
  const gastankPda = (u: PublicKey) => pda([B("gastank"), u.toBuffer()]);
  const UNIT_RAW = new BN(1_000_000_000);
  // ResourceKind variants in enum order, taken from the IDL the suite runs
  // against (seed = kind as u8 = variant index); lowerCamel for Anchor's JS enum encoding.
  const RESOURCE_KINDS: string[] = (idlJson.types.find((t: any) => t.name === "ResourceKind").type.variants as any[])
    .map((v: any) => v.name[0].toLowerCase() + v.name.slice(1));
  const issuanceCapPda = (kind: string) => {
    const idx = RESOURCE_KINDS.indexOf(kind);
    if (idx < 0) throw new Error(`unknown kind ${kind}`);
    return pda([B("issuance_cap"), Buffer.from([idx])]);
  };
  const TEST_CAP_EPOCH_SLOTS = new BN(1_500);
  const TEST_CAP_PER_EPOCH = UNIT_RAW.mul(new BN(1_000_000)); // generous default for the suite

  let setupPayer: Keypair;
  const playerSigners = new Map<string, Keypair>();
  let dataMint: PublicKey, circuitMint: PublicKey, siliconMint: PublicKey, mindMint: PublicKey;
  let neuronMint: PublicKey, synapseMint: PublicKey;
  let signalMint: PublicKey, modelMint: PublicKey, powerMint: PublicKey, computeMint: PublicKey;
  const UNIT = new BN(1_000_000_000); // RESOURCE_UNIT (9 decimals)

  // Admin faucet for resource tokens: mint_resource keeps a treasury fee, so
  // callers ask for `amount` and get amount - fee. Returns the user's ATA.
  // MintResource deliberately never creates Player; tests initialize a profile
  // with its real owner as signer/payer before using the admin faucet.
  async function giveResource(kind: string, mint: PublicKey, user: PublicKey, units: number): Promise<PublicKey> {
    if (user.equals(vaultPda)) {
      // A program-owned vault PDA cannot sign init_player. Mint to a real player,
      // then move the requested amount into the vault's token account.
      const donor = Keypair.generate();
      await airdrop(donor);
      const donorAta = await giveResource(kind, mint, donor.publicKey, units * 2);
      const vaultAta = await ensureAta(mint, vaultPda);
      const transfer = new Transaction().add(createTransferInstruction(
        donorAta, vaultAta, donor.publicKey, UNIT.muln(units).toNumber(), [], TOKEN_PROGRAM_ID,
      ));
      await submitWithPayer(provider.connection, transfer, donor);
      return vaultAta;
    }
    await ensurePlayer(user);
    const ata = await ensureAta(mint, user);
    const treasuryAta = await ensureAta(mint, authority);
    await program.methods.mintResource({ [kind]: {} }, UNIT.muln(units)).accounts({
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, issuanceCap: issuanceCapPda(kind), mint,
      tokenAccount: ata, treasuryToken: treasuryAta, player: playerPda(user),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).rpc();
    return ata;
  }
  const balance = async (ata: PublicKey) => new BN((await provider.connection.getTokenAccountBalance(ata)).value.amount);

  // Lamport change of each account inside one transaction (pre/post balances of
  // its metadata), plus the fee its payer was charged. Exact even for the
  // provider wallet, which also pays every fee of the suite.
  async function txDeltas(signature: string) {
    await provider.connection.confirmTransaction(signature, "confirmed");
    const tx = await provider.connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx?.meta) throw new Error(`transaction ${signature} not found`);
    const meta = tx.meta;
    const keys = tx.transaction.message.getAccountKeys().staticAccountKeys;
    const delta = (key: PublicKey) => {
      const i = keys.findIndex((k) => k.equals(key));
      if (i < 0) throw new Error(`${key.toBase58()} is not an account of ${signature}`);
      return meta.postBalances[i] - meta.preBalances[i];
    };
    return Object.assign(delta, { fee: meta.fee });
  }

  // The validator's clock, not the runner's: they drift apart, so waiting a
  // fixed number of wall-clock seconds for an on-chain deadline is flaky.
  async function waitForChainTime(unixTimestamp: number, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const clock = await provider.connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
      if (clock && Number(clock.data.readBigInt64LE(32)) >= unixTimestamp) return;
      if (Date.now() > deadline) throw new Error(`chain clock did not reach ${unixTimestamp}`);
      await sleep(500);
    }
  }

  // The provider wallet is the treasury and pays every fee. On this validator
  // its balance can end a few lamports off credit - meta.fee (seen: +16,
  // +32), so its delta gets a small window; the program's own transfers are
  // pinned exactly through the other parties of each settlement.
  const FEE_PAYER_SLACK = 1_000;
  function expectFeePayerDelta(actual: number, expected: number) {
    expect(actual - expected, `fee payer delta ${actual} vs ${expected}`).to.be.within(-FEE_PAYER_SLACK, FEE_PAYER_SLACK);
  }

  const airdrop = async (kp: Keypair, sol = 5) => {
    const requested = sol * LAMPORTS_PER_SOL;
    const signature = await provider.connection.requestAirdrop(kp.publicKey, requested);
    const confirmation = await provider.connection.confirmTransaction(signature, "confirmed");
    if (confirmation.value.err) throw new Error(`airdrop failed: ${JSON.stringify(confirmation.value.err)}`);
    const credited = await provider.connection.getBalance(kp.publicKey, "confirmed");
    if (credited < requested) throw new Error(`airdrop not visible for ${kp.publicKey}: expected >= ${requested}, got ${credited}`);
    playerSigners.set(kp.publicKey.toBase58(), kp);
  };

  async function ensureAta(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    await waitForAccountOwner(provider.connection, mint, TOKEN_PROGRAM_ID, "SPL Token mint");
    const ata = getAssociatedTokenAddressSync(mint, owner, true); // allowOwnerOffCurve для PDA
    // Idempotent by construction (check-then-create) instead of swallowing every
    // error: a real failure (funding, wrong owner) must surface, not be hidden.
    if (await provider.connection.getAccountInfo(ata)) return ata;
    const tx = new Transaction().add(createAssociatedTokenAccountInstruction(setupPayer.publicKey, ata, owner, mint));
    await submitWithPayer(provider.connection, tx, setupPayer);
    return ata;
  }

  async function ensurePlayer(owner: PublicKey): Promise<PublicKey> {
    const profile = playerPda(owner);
    if (await provider.connection.getAccountInfo(profile, "confirmed")) return profile;
    const signer = owner.equals(providerSigner.publicKey)
      ? providerSigner
      : playerSigners.get(owner.toBase58());
    if (!signer) throw new Error(`no local signer available to initialize Player for ${owner}`);
    const tx = await program.methods.initPlayer().accounts({
      player: owner, playerProfile: profile, systemProgram: SystemProgram.programId,
    }).transaction();
    await submitWithPayer(provider.connection, tx, signer);
    return profile;
  }

  /** Charge setup-payer rent and network fees to the same explicit signer.
   * Include the provider only when its authority signature is actually required. */
  async function sendWithPayer(builder: any, payer: Keypair) {
    const tx = await builder.transaction();
    return submitWithPayer(provider.connection, tx, payer, [providerSigner]);
  }

  // Bootstrap calls are allowed to fail only with "already initialised" (a
  // validator that was not reset). Every other error aborts the suite here,
  // with the Anchor code in the message, instead of surfacing later as an
  // unrelated AccountNotInitialized on config.
  function rethrowUnlessAlreadyInitialised(step: string, e: any): void {
    const code = e?.error?.errorCode?.code ?? "";
    const msg = (e?.error?.errorMessage ?? e?.message ?? "").toString();
    const logs: string[] = e?.logs ?? e?.transactionLogs ?? [];
    const alreadyInUse = /already in use/.test(msg) || logs.some((l) => /already in use/.test(l));
    if (alreadyInUse) { console.log(`${step}: already initialised, continuing`); return; }
    throw new Error(`${step} FAILED: code=${code || "?"} msg=${msg.slice(0, 300)}`);
  }

  async function expectError(p: Promise<any>, code: string) {
    try { await p; } catch (e: any) {
      const c = await anchorErrorCode(e, idlJson.errors ?? [], provider.connection);
      if (c === code) return;
      throw new Error(`expected ${code}, got: ${c ?? "?"} | ${e?.message?.slice(0, 160)}`);
    }
    throw new Error(`expected ${code}, but call succeeded`);
  }

  // Like expectError, but also pins the account Anchor blamed ("AnchorError
  // caused by account: <name>").
  async function expectAccountError(p: Promise<any>, code: string, account: string) {
    try { await p; } catch (e: any) {
      const c = e?.error?.errorCode?.code ?? "";
      const origin = typeof e?.error?.origin === "string" ? e.error.origin : "";
      if (c === code && origin === account) return;
      throw new Error(`expected ${code} on ${account}, got: ${c} on ${origin || "?"} | ${e?.message?.slice(0, 160)}`);
    }
    throw new Error(`expected ${code} on ${account}, but call succeeded`);
  }

  // [F-06] Switchboard On-Demand accounts of a VRF commit (default = mainnet
  // build). The local validator has neither Switchboard nor a pool slot, which
  // is exactly the production "pool empty" state.
  const SWITCHBOARD_PROGRAM = new PublicKey("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv");
  const SWITCHBOARD_QUEUE = new PublicKey("A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w");
  const u32le = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
  const u64le = (n: BN) => n.toArrayLike(Buffer, "le", 8);
  const vrfCommitAccounts = () => {
    const randomness = pda([B("vrf_randomness"), u32le(0)]);
    return {
      vrfSlot: pda([B("vrf_slot"), randomness.toBuffer()]), randomness,
      vrfAuthority: pda([B("vrf_authority")]), queue: SWITCHBOARD_QUEUE, oracle: Keypair.generate().publicKey,
      recentSlothashes: SLOT_HASHES, switchboardProgram: SWITCHBOARD_PROGRAM,
    };
  };

  async function mintTool(to: PublicKey, toolType = "plasma_cutter") {
    const mint = await createMint(provider.connection, setupPayer, authPda, null, 0);
    const tokenAccount = await ensureAta(mint, to);
    await sendWithPayer(program.methods.mintTool(toolType, { common: {} }).accounts({
      config: configPda, authority, auth: authPda, mint, tokenAccount,
      // [AUDIT F-22] the destination ATA must belong to the declared recipient.
      recipient: to,
      payer: setupPayer.publicKey, toolData: toolPda(mint), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }), setupPayer);
    return { mint, tokenAccount };
  }

  before(async () => {
    setupPayer = Keypair.generate();
    await airdrop(setupPayer, 100);
    // Диагностика: раньше ошибки initialize/initMaterialMints проглатывались
    // (catch {}), и весь набор падал позже на setResourceMints с
    // AccountNotInitialized по config, не показывая настоящую причину.
    // Теперь bootstrap падает сразу (см. rethrowUnlessAlreadyInitialised).
    console.log(`provider wallet ${authority.toBase58()} balance: ` +
      `${await provider.connection.getBalance(authority)} lamports`);
    console.log(`program id ${pid.toBase58()} | config ${configPda.toBase58()} | ` +
      `programData ${programDataPda.toBase58()}`);
    try {
      await program.methods.initialize(authority).accounts({
        config: configPda, authority, auth: authPda, vault: vaultPda,
        programData: programDataPda, systemProgram: SystemProgram.programId }).rpc();
      console.log("initialize: ok");
    } catch (e: any) {
      rethrowUnlessAlreadyInitialised("initialize", e);
    }
    // Resource mints use the production 9-decimal atomic unit. Tool/NFT
    // mints created by mintTool below intentionally remain 0-decimal NFTs.
    dataMint  = await createMint(provider.connection, setupPayer, authPda, null, 9);
    circuitMint  = await createMint(provider.connection, setupPayer, authPda, null, 9);
    siliconMint = await createMint(provider.connection, setupPayer, authPda, null, 9);
    mindMint = await createMint(provider.connection, setupPayer, authPda, null, 9);
    const materialArgs: PublicKey[] = [];
    for (let i = 0; i < 23; i += 1) {
      materialArgs.push(await createMint(provider.connection, setupPayer, authPda, null, 9));
    }
    neuronMint = materialArgs[0];
    synapseMint = materialArgs[1];
    signalMint = materialArgs[2];
    modelMint = materialArgs[3];
    powerMint = materialArgs[4];
    computeMint = materialArgs[5];
    try {
      await (program.methods as any).initMaterialMints(...materialArgs)
        .accounts({ config: configPda, authority, materialMints: materialMintsPda, systemProgram: SystemProgram.programId }).rpc();
      console.log("initMaterialMints: ok");
    } catch (e: any) {
      rethrowUnlessAlreadyInitialised("initMaterialMints", e);
    }
    await program.methods.setResourceMints(
      dataMint, circuitMint, siliconMint, materialArgs[0], materialArgs[4], mindMint,
    ).accounts({ config: configPda, authority }).rpc();
    // Issuance caps are fail-closed: every mint_resource* needs an initialised
    // cap PDA for its kind, so initialise all of them (idempotent across runs).
    for (const kind of RESOURCE_KINDS) {
      if (await provider.connection.getAccountInfo(issuanceCapPda(kind))) continue;
      await program.methods.initIssuanceCap({ [kind]: {} }, TEST_CAP_EPOCH_SLOTS, TEST_CAP_PER_EPOCH)
        .accounts({ config: configPda, authority, issuanceCap: issuanceCapPda(kind), systemProgram: SystemProgram.programId }).rpc();
    }
  });

  // An auction with a bid cannot end sooner than 5 minutes after that bid
  // (anti-snipe). It is opened here, first, and settled by the last test of
  // this suite, so the rest of the suite runs while the window elapses.
  let biddedAuction: { seller: Keypair; bidder: Keypair; mint: PublicKey; tokenAccount: PublicKey;
    auctionPda: PublicKey; auctionVault: PublicKey; winnerToken: PublicKey; bid: number } | undefined;

  it("auction with a bid: a bid inside the last 5 minutes pushes the end 5 minutes out (settled at the end of the suite)", async () => {
    const seller = Keypair.generate(); await airdrop(seller);
    const bidder = Keypair.generate(); await airdrop(bidder);
    const { mint, tokenAccount } = await mintTool(seller.publicKey);
    const auctionPda = pda([B("auction"), mint.toBuffer()]);
    const auctionVault = await ensureAta(mint, auctionPda);
    const winnerToken = await ensureAta(mint, bidder.publicKey);
    await program.methods.auctionCreate(new BN(1_000_000), new BN(2)).accounts({
      config: configPda, seller: seller.publicKey, mint, tool: toolPda(mint), sellerToken: tokenAccount,
      auction: auctionPda, auctionVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([seller]).rpc();
    const created = (await program.account.auction.fetch(auctionPda)).endTime.toNumber();
    const bid = 20_000_000;
    await program.methods.auctionBid(new BN(bid)).accounts({
      config: configPda, bidder: bidder.publicKey, mint, auction: auctionPda,
      previousBidder: seller.publicKey, systemProgram: SystemProgram.programId,
    }).signers([bidder]).rpc();
    const extended = (await program.account.auction.fetch(auctionPda)).endTime.toNumber();
    // AUCTION_ANTI_SNIPE_EXTENSION_SECONDS = 300, counted from the bid.
    expect(extended - created).to.be.within(295, 302);
    biddedAuction = { seller, bidder, mint, tokenAccount, auctionPda, auctionVault, winnerToken, bid };
  });

  it("issuance cap: per-kind budget blocks over-issuance, cap=0 halts, set never resets the counter", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const stranger = Keypair.generate(); await airdrop(stranger);
    await ensurePlayer(user.publicKey);
    const ata = await ensureAta(mindMint, user.publicKey);
    const treasAta = await ensureAta(mindMint, authority);
    const cap = issuanceCapPda("mind");
    // [PAYER] mint_resource_once теперь требует подпись игрока-получателя
    // (`payer == token_account.owner`): Player и RewardReceipt оплачивает он,
    // а не кошелёк оператора.
    const mintAccounts = {
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, issuanceCap: cap, mint: mindMint,
      tokenAccount: ata, treasuryToken: treasAta, payer: user.publicKey, player: playerPda(user.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId };
    const setCap = (epoch: BN, limit: BN) => program.methods.setIssuanceCap({ mind: {} }, epoch, limit)
      .accounts({ config: configPda, authority, issuanceCap: cap }).rpc();
    // Only the config authority may change a cap.
    await expectError(program.methods.setIssuanceCap({ mind: {} }, TEST_CAP_EPOCH_SLOTS, UNIT.muln(5))
      .accounts({ config: configPda, authority: stranger.publicKey, issuanceCap: cap }).signers([stranger]).rpc(), "Unauthorized");
    // Re-init of an existing cap must fail (PDA already in use).
    let reinit = false;
    try {
      await program.methods.initIssuanceCap({ mind: {} }, TEST_CAP_EPOCH_SLOTS, UNIT.muln(5))
        .accounts({ config: configPda, authority, issuanceCap: cap, systemProgram: SystemProgram.programId }).rpc();
    } catch (error: any) {
      expect(`${error.message} ${(error.logs || []).join(" ")}`).to.match(/already in use|already initialized|custom program error: 0x0/i);
      reinit = true;
    }
    expect(reinit).to.equal(true);
    // Long epoch so the budget cannot roll over mid-test.
    const longEpoch = new BN(6_480_000);
    await setCap(longEpoch, UNIT.muln(5));
    const alreadyMinted = new BN((await program.account.issuanceCap.fetch(cap)).mintedInEpoch.toString());
    // set_issuance_cap must never reset the epoch counter (that would be a bypass).
    await setCap(longEpoch, UNIT.muln(5).add(alreadyMinted));
    expect((await program.account.issuanceCap.fetch(cap)).mintedInEpoch.toString()).to.equal(alreadyMinted.toString());

    // Authority may authorize issuance but can never be its destination or the
    // payer/recipient of a reward claim. The authority ATA here is otherwise a
    // valid token account for this mint.
    await expectError(program.methods.mintResource({ mind: {} }, new BN(1)).accounts({
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, issuanceCap: cap, mint: mindMint,
      tokenAccount: treasAta, treasuryToken: treasAta, player: playerPda(authority),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).rpc(), "Unauthorized");
    const authorityRewardId = Array.from(crypto.randomBytes(32));
    const authorityReceipt = pda([B("reward_receipt"), authority.toBuffer(), Buffer.from(authorityRewardId)]);
    await expectError(program.methods.mintResourceOnce({ mind: {} }, new BN(1), authorityRewardId).accounts({
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, issuanceCap: cap, mint: mindMint,
      tokenAccount: treasAta, treasuryToken: treasAta, payer: authority, player: playerPda(authority),
      rewardReceipt: authorityReceipt, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).rpc(), "Unauthorized");
    expect(await provider.connection.getAccountInfo(authorityReceipt)).to.equal(null);

    const supplyBefore = new BN((await provider.connection.getTokenSupply(mindMint)).value.amount);
    await program.methods.mintResource({ mind: {} }, UNIT.muln(3)).accounts(mintAccounts).rpc();
    // 3 + 3 > 5: rejected atomically (no partial supply change).
    await expectError(program.methods.mintResource({ mind: {} }, UNIT.muln(3)).accounts(mintAccounts).rpc(), "IssuanceCapExceeded");
    // Exactly filling the remaining budget is allowed; one more base unit is not.
    await program.methods.mintResource({ mind: {} }, UNIT.muln(2)).accounts(mintAccounts).rpc();
    await expectError(program.methods.mintResource({ mind: {} }, new BN(1)).accounts(mintAccounts).rpc(), "IssuanceCapExceeded");
    const supplyDelta = new BN((await provider.connection.getTokenSupply(mindMint)).value.amount).sub(supplyBefore);
    expect(supplyDelta.toString()).to.equal(UNIT.muln(5).toString());
    const state = await program.account.issuanceCap.fetch(cap);
    expect(new BN(state.mintedInEpoch.toString()).sub(alreadyMinted).toString()).to.equal(UNIT.muln(5).toString());
    // mint_resource_once shares the same budget and leaves no receipt behind on failure.
    const rewardId = Array.from(crypto.randomBytes(32));
    // [AUDIT F-28] the tombstone is namespaced by (recipient, reward_id).
    const receipt = pda([B("reward_receipt"), user.publicKey.toBuffer(), Buffer.from(rewardId)]);
    await expectError(program.methods.mintResourceOnce({ mind: {} }, new BN(1), rewardId)
      .accounts({ ...mintAccounts, rewardReceipt: receipt }).signers([user]).rpc(), "IssuanceCapExceeded");
    expect(await provider.connection.getAccountInfo(receipt)).to.equal(null);
    // cap = 0 is an explicit halt switch (distinct error from exhaustion).
    await setCap(longEpoch, new BN(0));
    await expectError(program.methods.mintResource({ mind: {} }, new BN(1)).accounts(mintAccounts).rpc(), "IssuanceCapNotConfigured");
    // Epoch bounds are enforced.
    await expectError(setCap(new BN(1), UNIT), "InvalidIssuanceCapParams");
    // Restore a generous budget for the rest of the suite.
    await setCap(TEST_CAP_EPOCH_SLOTS, TEST_CAP_PER_EPOCH);
  });

  it("reward receipts: atomic mint, authority/mint checks and permanent replay protection", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const stranger = Keypair.generate(); await airdrop(stranger);
    const userCircuit = await ensureAta(circuitMint, user.publicKey);
    const otherCircuit = await ensureAta(circuitMint, stranger.publicKey);
    const userSilicon = await ensureAta(siliconMint, user.publicKey);
    const treasuryCircuit = await ensureAta(circuitMint, authority);
    const treasurySilicon = await ensureAta(siliconMint, authority);
    const rewardId = Array.from(crypto.randomBytes(32));
    // [AUDIT F-28] (recipient, reward_id), not reward_id alone.
    const rewardReceipt = pda([B("reward_receipt"), user.publicKey.toBuffer(), Buffer.from(rewardId)]);
    const gross = UNIT.muln(2);
    // [PAYER] Claim награды подписывает получатель: он же платит за свой
    // профиль и чек, authority только авторизует минт.
    const accounts = {
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, issuanceCap: issuanceCapPda("circuit"),
      mint: circuitMint, tokenAccount: userCircuit, treasuryToken: treasuryCircuit, payer: user.publicKey,
      player: playerPda(user.publicKey),
      rewardReceipt, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    };
    await expectError(program.methods.mintResourceOnce({ circuit: {} }, gross, rewardId)
      .accounts({ ...accounts, authority: stranger.publicKey }).signers([stranger, user]).rpc(), "Unauthorized");
    await expectError(program.methods.mintResourceOnce({ circuit: {} }, gross, rewardId)
      .accounts({ ...accounts, mint: siliconMint, tokenAccount: userSilicon, treasuryToken: treasurySilicon })
      .signers([user]).rpc(), "InvalidResourceKind");
    expect(await provider.connection.getAccountInfo(rewardReceipt)).to.equal(null);
    const pauseSig = await program.methods.setPaused(true).accounts({ config: configPda, authority }).rpc();
    await expectError(program.methods.mintResourceOnce({ circuit: {} }, gross, rewardId).accounts(accounts).signers([user]).rpc(), "Paused");
    await program.methods.setPaused(false).accounts({ config: configPda, authority }).rpc();
    // set_paused must leave an on-chain event trail (Watchtower PausedToggled).
    {
      const tx = await provider.connection.getTransaction(pauseSig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      const parsed = [...new anchor.EventParser(pid, new anchor.BorshCoder(idlJson)).parseLogs(tx!.meta!.logMessages!)];
      const ev = parsed.find((e: any) => e.name === "pausedToggled" || e.name === "PausedToggled");
      expect(ev, "PausedToggled event").to.not.equal(undefined);
      expect((ev as any).data.paused).to.equal(true);
      expect((ev as any).data.authority.toBase58()).to.equal(authority.toBase58());
    }
    const before = (await balance(userCircuit)).add(await balance(treasuryCircuit));
    const userLamportsBefore = await provider.connection.getBalance(user.publicKey, "confirmed");
    await program.methods.mintResourceOnce({ circuit: {} }, gross, rewardId).accounts(accounts).signers([user]).rpc();
    // [PAYER] весь rent профиля и чека списан с игрока, а не с оператора.
    expect(await provider.connection.getBalance(user.publicKey, "confirmed")).to.be.lessThan(userLamportsBefore);
    const receipt = await program.account.rewardReceipt.fetch(rewardReceipt);
    expect(receipt.recipient.toBase58()).to.equal(user.publicKey.toBase58());
    expect(receipt.mint.toBase58()).to.equal(circuitMint.toBase58());
    expect(receipt.grossAmount.toString()).to.equal(gross.toString());
    expect((await balance(userCircuit)).add(await balance(treasuryCircuit)).sub(before).toString()).to.equal(gross.toString());
    // [AUDIT F-28] Replay protection is per recipient: (recipient, reward_id)
    // is replay-proof, but the same reward_id for a DIFFERENT wallet is a
    // different tombstone. The old global namespace rejected it, which silently
    // burned the other player's reward.
    {
      let rejected = false;
      try {
        await program.methods.mintResourceOnce({ circuit: {} }, gross.addn(1), rewardId).accounts(accounts).signers([user]).rpc();
      } catch (error: any) {
        const log = `${error.message} ${(error.logs || []).join(" ")}`;
        expect(log).to.match(/already in use|already initialized|custom program error: 0x0/i);
        rejected = true;
      }
      expect(rejected, "same recipient + same reward_id must stay replay-protected").to.equal(true);

      const strangerBefore = await balance(otherCircuit);
      const strangerReceipt = pda([B("reward_receipt"), stranger.publicKey.toBuffer(), Buffer.from(rewardId)]);
      await program.methods.mintResourceOnce({ circuit: {} }, gross, rewardId).accounts({
        ...accounts, tokenAccount: otherCircuit, payer: stranger.publicKey,
        player: playerPda(stranger.publicKey), rewardReceipt: strangerReceipt,
      }).signers([stranger]).rpc();
      expect((await program.account.rewardReceipt.fetch(strangerReceipt)).recipient.toBase58())
        .to.equal(stranger.publicKey.toBase58());
      expect((await balance(otherCircuit)).gt(strangerBefore)).to.equal(true);

      // A fresh reward_id for the same recipient is a new tombstone, not a replay.
      const freshId = Array.from(crypto.randomBytes(32));
      const freshReceipt = pda([B("reward_receipt"), user.publicKey.toBuffer(), Buffer.from(freshId)]);
      await program.methods.mintResourceOnce({ circuit: {} }, UNIT, freshId)
        .accounts({ ...accounts, rewardReceipt: freshReceipt }).signers([user]).rpc();
    }
    // Two different signed messages for one logical reward: exactly one mint.
    const concurrentId = Array.from(crypto.randomBytes(32));
    const concurrentReceipt = pda([B("reward_receipt"), user.publicKey.toBuffer(), Buffer.from(concurrentId)]);
    const results = await Promise.allSettled([gross, gross.addn(1)].map((amount) =>
      program.methods.mintResourceOnce({ circuit: {} }, amount, concurrentId)
        .accounts({ ...accounts, rewardReceipt: concurrentReceipt }).rpc()));
    expect(results.filter((result) => result.status === "fulfilled").length).to.equal(1);
  });

  it("marketplace: signed price/deadline reject before transfers and valid purchase settles", async () => {
    const seller = Keypair.generate(); await airdrop(seller);
    const buyer = Keypair.generate(); await airdrop(buyer);
    const { mint, tokenAccount } = await mintTool(seller.publicKey);
    const listing = pda([B("listing"), mint.toBuffer()]);
    const listingVault = await ensureAta(mint, listing);
    const buyerToken = await ensureAta(mint, buyer.publicKey);
    const price = new BN(1_000_001); // exercises floor rounding of the fee
    await program.methods.marketplaceList(price).accounts({ config: configPda, seller: seller.publicKey,
      mint, tool: toolPda(mint), sellerToken: tokenAccount, listing, listingVault,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).signers([seller]).rpc();
    const accounts = { config: configPda, buyer: buyer.publicKey, seller: seller.publicKey, treasury: authority,
      mint, tool: toolPda(mint), listing, listingVault, buyerToken,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId };
    const deadline = new BN(Math.floor(Date.now() / 1000) + 120);
    const before = await provider.connection.getBalance(buyer.publicKey);
    await expectError(program.methods.marketplaceBuyBounded(price.subn(1), deadline).accounts(accounts).signers([buyer]).rpc(), "PriceLimitExceeded");
    await expectError(program.methods.marketplaceBuyBounded(price, new BN(1)).accounts(accounts).signers([buyer]).rpc(), "QuoteExpired");
    const legacy = await program.methods.marketplaceBuyBounded(price, deadline).accounts(accounts).instruction();
    legacy.data = legacy.data.subarray(0, 8);
    await expectError(submitWithPayer(provider.connection, new Transaction().add(legacy), buyer), "InstructionDidNotDeserialize");
    // [Шаг B п.12] легаси-инструкция marketplace_buy удалена из программы: дискриминатор
    // без trailing-аргументов теперь не десериализуется, а не возвращает FeatureDisabled.
    const removedDiscriminator = legacy.data.length >= 8 ? legacy.data : null;
    expect(removedDiscriminator).to.not.equal(null);
    expect(await provider.connection.getBalance(buyer.publicKey)).to.equal(before);
    expect((await balance(buyerToken)).toNumber()).to.equal(0);
    const sellerBefore = await provider.connection.getBalance(seller.publicKey);
    const returnedRent = (await provider.connection.getBalance(listing)) + (await provider.connection.getBalance(listingVault));
    const signature = await program.methods.marketplaceBuyBounded(price, deadline).accounts(accounts).signers([buyer]).rpc();
    // Confirmed signature and RPC transaction-history availability are distinct.
    let saleTx = await provider.connection.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    for (let attempt = 0; !saleTx?.meta && attempt < 20; attempt++) {
      await sleep(250);
      saleTx = await provider.connection.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    }
    expect(saleTx?.meta, "confirmed sale transaction metadata within 5 seconds").to.exist;
    expect(saleTx!.meta!.err).to.equal(null);
    const fee = price.muln(300).divn(10_000).toNumber();
    expect(before - await provider.connection.getBalance(buyer.publicKey)).to.equal(price.toNumber());
    expect(await provider.connection.getBalance(seller.publicKey) - sellerBefore).to.equal(price.toNumber() - fee + returnedRent);
    // The validator's provider treasury may hold >2^53 lamports: JSON numeric
    // balance subtraction would round. Verify the successful System transfer's
    // small exact amount instead (network fees are not System transfers).
    const treasuryTransfers = saleTx!.meta!.innerInstructions!.flatMap(inner => inner.instructions)
      .filter((ix: any) => ix.program === "system" && ix.parsed?.type === "transfer"
        && ix.parsed.info.source === buyer.publicKey.toBase58()
        && ix.parsed.info.destination === authority.toBase58());
    expect(treasuryTransfers.length).to.equal(1);
    const paidFee = (treasuryTransfers[0] as any).parsed.info.lamports;
    expect(Number.isSafeInteger(paidFee)).to.equal(true);
    expect(paidFee).to.equal(fee);
    expect((await balance(buyerToken)).toNumber()).to.equal(1);
    const buyerAfter = await provider.connection.getBalance(buyer.publicKey);
    // A distinct signed message, not an RPC retry of an already-successful tx.
    await expectError(program.methods.marketplaceBuyBounded(price.addn(1), deadline).accounts(accounts).signers([buyer]).rpc(), "AccountNotInitialized");
    expect(await provider.connection.getBalance(buyer.publicKey)).to.equal(buyerAfter);
    expect((await balance(buyerToken)).toNumber()).to.equal(1);
    expect((await program.account.toolData.fetch(toolPda(mint))).owner.toBase58()).to.equal(buyer.publicKey.toBase58());
  });

  it("initialize is singleton (повторный вызов падает)", async () => {
    let threw = false;
    try {
      await program.methods.initialize(authority).accounts({
        config: configPda, authority, auth: authPda, vault: vaultPda,
        programData: programDataPda, systemProgram: SystemProgram.programId }).rpc();
    } catch (e) { threw = true; }
    expect(threw).to.be.true;
  });

  it("mint_resource: balance deltas conserve gross mint and treasury fee with existing balances", async () => {
    const user = Keypair.generate(); await airdrop(user);
    // The treasury is shared with other tests and real payouts. Pre-fund the
    // recipient too, so this test also catches absolute-balance assertions
    // when run alone. Neither account is assumed to start at zero.
    const ata = await giveResource("circuit", circuitMint, user.publicKey, 1);
    const treasAta = await ensureAta(circuitMint, authority);
    const userBefore = await balance(ata);
    const treasuryBefore = await balance(treasAta);
    const supplyBefore = new BN((await provider.connection.getTokenSupply(circuitMint)).value.amount);
    expect(userBefore.gtn(0)).to.equal(true);
    expect(treasuryBefore.gtn(0)).to.equal(true);
    const gross = new BN(10_000);
    await program.methods.mintResource({ circuit: {} }, gross).accounts({
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, issuanceCap: issuanceCapPda("circuit"), mint: circuitMint,
      tokenAccount: ata, treasuryToken: treasAta, player: playerPda(user.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).rpc();
    const userDelta = (await balance(ata)).sub(userBefore);
    const treasuryDelta = (await balance(treasAta)).sub(treasuryBefore);
    const supplyDelta = new BN((await provider.connection.getTokenSupply(circuitMint)).value.amount).sub(supplyBefore);
    expect(userDelta.add(treasuryDelta).eq(gross)).to.equal(true, "user + treasury deltas must equal gross mint");
    expect(supplyDelta.eq(gross)).to.equal(true, "total supply must increase by exactly the gross amount");
    expect(treasuryDelta.gten(700) && treasuryDelta.lten(1000)).to.equal(true, "base fee must remain 7–10%");
  });

  it("withdraw_gas: кулдаун взводится после вывода (H1)", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const acc = { config: configPda, user: user.publicKey, gastank: gastankPda(user.publicKey), systemProgram: SystemProgram.programId };
    await program.methods.depositGas(new BN(1_000_000_000)).accounts(acc).signers([user]).rpc();
    // [AUDIT F-20] The 12h window is armed only above
    // GASTANK_INSTANT_WITHDRAW_MICROS (200_000 micros = 0.2 SOL), so a player
    // keeps access to small amounts of their own funds. Pin the threshold from
    // both sides: exactly at it stays instant, one micro over arms the cooldown.
    await program.methods.withdrawGas(new BN(200_000)).accounts(acc).signers([user]).rpc();
    await program.methods.withdrawGas(new BN(200_001)).accounts(acc).signers([user]).rpc();
    // Once armed, even a 1-micro withdrawal must wait out the full cooldown.
    await expectError(program.methods.withdrawGas(new BN(1)).accounts(acc).signers([user]).rpc(), "CooldownNotExpired");
  });

  it("unstake до unlock падает (C6)", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const { mint, tokenAccount } = await mintTool(user.publicKey);
    const vaultToken = await ensureAta(mint, vaultPda);
    const gAcc = { config: configPda, user: user.publicKey, gastank: gastankPda(user.publicKey), systemProgram: SystemProgram.programId };
    await program.methods.depositGas(new BN(100_000_000)).accounts(gAcc).signers([user]).rpc();
    await program.methods.stake(new BN(3600)).accounts({
      config: configPda, user: user.publicKey, tool: toolPda(mint), mint, userToken: tokenAccount,
      vault: vaultPda, vaultToken, tokenProgram: TOKEN_PROGRAM_ID }).signers([user]).rpc();
    await expectError(program.methods.unstake().accounts({
      config: configPda, user: user.publicKey, tool: toolPda(mint), mint, userToken: tokenAccount,
      gastank: gastankPda(user.publicKey), vault: vaultPda, vaultToken, tokenProgram: TOKEN_PROGRAM_ID
    }).signers([user]).rpc(), "LockNotExpired");
  });

  it("start_mining: кап часов по редкости + житель занят", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const { mint, tokenAccount } = await mintTool(user.publicKey);
    const vaultToken = await ensureAta(mint, vaultPda);
    await program.methods.stake(new BN(3600)).accounts({
      config: configPda, user: user.publicKey, tool: toolPda(mint), mint,
      userToken: tokenAccount, vault: vaultPda, vaultToken, tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([user]).rpc();
    const sm = (h: number) => program.methods.startMining(h).accounts({
      config: configPda, user: user.publicKey, tool: toolPda(mint), mint,
      player: playerPda(user.publicKey),
      // Token-primary ownership: майнинг требует токен в эскроу программы.
      vault: vaultPda, vaultToken,
      systemProgram: SystemProgram.programId }).signers([user]).rpc();
    // New deployments default to a closed mining switch. Explicit activation
    // is required even for the local-validator pilot.
    expect((await program.account.config.fetch(configPda)).miningEnabled).to.equal(false);
    await expectError(sm(2), "MiningDisabled");
    await program.methods.setMiningEnabled(true).accounts({ config: configPda, authority }).rpc();
    try {
      await expectError(sm(9), "HoursExceedRarityCap");
      await sm(2);
      const pl = await program.account.player.fetch(playerPda(user.publicKey));
      expect(pl.villagersAvailable).to.equal(5);

      // The collect path must validate completion before minting or clearing
      // mining state. This is the pre-completion half of the atomic settlement
      // regression; a full payout assertion requires advancing validator time.
      const payoutToken = await ensureAta(circuitMint, user.publicKey);
      await expectError(program.methods.collectMining().accounts({
        config: configPda,
        user: user.publicKey,
        tool: toolPda(mint),
        mint,
        player: playerPda(user.publicKey),
        materialMints: materialMintsPda,
        auth: authPda,
        payoutMint: circuitMint,
        payoutToken,
        vault: vaultPda, vaultToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([user]).rpc(), "MiningNotComplete");
      const stillMining = await program.account.toolData.fetch(toolPda(mint));
      expect(stillMining.isMining).to.equal(true);
      // Turning the switch off also blocks collection of an existing session;
      // no state can be silently cleared without its atomic payout.
      await program.methods.setMiningEnabled(false).accounts({ config: configPda, authority }).rpc();
      await expectError(program.methods.collectMining().accounts({
        config: configPda, user: user.publicKey, tool: toolPda(mint), mint,
        player: playerPda(user.publicKey), materialMints: materialMintsPda,
        auth: authPda, payoutMint: circuitMint, payoutToken,
        vault: vaultPda, vaultToken, tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([user]).rpc(), "MiningDisabled");
      expect((await program.account.toolData.fetch(toolPda(mint))).isMining).to.equal(true);
    } finally {
      await program.methods.setMiningEnabled(false).accounts({ config: configPda, authority }).rpc();
    }
  });

  it("harvest synapse: rental operator is accepted and owner is rejected", async () => {
    const owner = Keypair.generate(); await airdrop(owner);
    const renter = Keypair.generate(); await airdrop(renter);
    const { mint, tokenAccount } = await mintTool(owner.publicKey, "Neural_Seeder");
    const ownerNeuron = await ensureAta(neuronMint, owner.publicKey);
    const ownerNeuronTreasury = await ensureAta(neuronMint, authority);
    await ensurePlayer(owner.publicKey);
    await program.methods.mintResource({ neuron: {} }, new BN(10_000_000_000)).accounts({
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, issuanceCap: issuanceCapPda("neuron"), mint: neuronMint,
      tokenAccount: ownerNeuron, treasuryToken: ownerNeuronTreasury, player: playerPda(owner.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).rpc();
    const ownerTile = pda([B("lab_tile"), owner.publicKey.toBuffer(), Buffer.from([0])]);
    // plant_neuron(tile_index: u8, amount: u64). Passing only the amount made
    // Anchor treat it as tile_index and the account map as `amount`, which
    // surfaced as "Account `config` not provided" (tests/aof_core.ts:210).
    await program.methods.plantNeuron(0, new BN(1_000_000_000)).accounts({
      config: configPda, user: owner.publicKey, materialMints: materialMintsPda,
      energyAccount: pda([B("energy_account"), owner.publicKey.toBuffer()]), labTile: ownerTile,
      neuronMint, userNeuron: ownerNeuron, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([owner]).rpc();

    const rentalListing = pda([B("rental_listing"), mint.toBuffer()]);
    // [SECURITY_CHECKLIST_REVIEW F-H] a listed NFT sits in escrow (an ATA of
    // the listing PDA); the owner split is capped at 95% (5% platform fee).
    const rentalVault = await ensureAta(mint, rentalListing);
    await program.methods.rentalList(9_500, new BN(24 * 3600), new BN(24 * 3600), new BN(0)).accounts({
      config: configPda, owner: owner.publicKey, mint, tool: toolPda(mint), rentalListing,
      ownerToken: tokenAccount, rentalVault, tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).signers([owner]).rpc();
    expect((await balance(rentalVault)).toString()).to.equal("1");
    const rentalAgreement = pda([B("rental_agreement"), mint.toBuffer()]);
    // rental_start удалён вместе с заглушкой (шаг B п.12); потолок комиссии принимает rental_start_bounded.
    await program.methods.rentalStartBounded(new BN(24 * 3600), new BN(0)).accounts({
      config: configPda, renter: renter.publicKey, mint, tool: toolPda(mint), rentalListing,
      owner: owner.publicKey, treasury: authority, rentalAgreement, rentalVault, systemProgram: SystemProgram.programId,
    }).signers([renter]).rpc();

    const ownerSynapse = await ensureAta(synapseMint, owner.publicKey);
    await expectError(program.methods.harvestSynapse(0).accounts({
      config: configPda, user: owner.publicKey, materialMints: materialMintsPda,
      energyAccount: pda([B("energy_account"), owner.publicKey.toBuffer()]), labTile: ownerTile,
      toolData: toolPda(mint), auth: authPda, synapseMint, userSynapse: ownerSynapse,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([owner]).rpc(), "NotToolOperator");

    const renterNeuron = await ensureAta(neuronMint, renter.publicKey);
    await ensurePlayer(renter.publicKey);
    await program.methods.mintResource({ neuron: {} }, new BN(10_000_000_000)).accounts({
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, issuanceCap: issuanceCapPda("neuron"), mint: neuronMint,
      tokenAccount: renterNeuron, treasuryToken: ownerNeuronTreasury, player: playerPda(renter.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).rpc();
    const renterTile = pda([B("lab_tile"), renter.publicKey.toBuffer(), Buffer.from([0])]);
    await program.methods.plantNeuron(0, new BN(1_000_000_000)).accounts({
      config: configPda, user: renter.publicKey, materialMints: materialMintsPda,
      energyAccount: pda([B("energy_account"), renter.publicKey.toBuffer()]), labTile: renterTile,
      neuronMint, userNeuron: renterNeuron, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([renter]).rpc();
    const renterSynapse = await ensureAta(synapseMint, renter.publicKey);
    await expectError(program.methods.harvestSynapse(0).accounts({
      config: configPda, user: renter.publicKey, materialMints: materialMintsPda,
      energyAccount: pda([B("energy_account"), renter.publicKey.toBuffer()]), labTile: renterTile,
      toolData: toolPda(mint), auth: authPda, synapseMint, userSynapse: renterSynapse,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([renter]).rpc(), "LabTileNotReady");
  });

  it("auction settle: чужой winner_token отклоняется (C1)", async () => {
    const seller = Keypair.generate(); await airdrop(seller);
    const { mint, tokenAccount } = await mintTool(seller.publicKey);
    const auctionPda = pda([B("auction"), mint.toBuffer()]);
    const auctionVault = await ensureAta(mint, auctionPda);
    await program.methods.auctionCreate(new BN(1_000_000), new BN(2)).accounts({
      config: configPda, seller: seller.publicKey, mint, tool: toolPda(mint), sellerToken: tokenAccount,
      auction: auctionPda, auctionVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId
    }).signers([seller]).rpc();
    await sleep(2500);
    const attacker = Keypair.generate(); await airdrop(attacker, 1);
    const attackerAta = await ensureAta(mint, attacker.publicKey);
    const settle = (winnerToken: PublicKey) => program.methods.auctionSettle().accounts({
      config: configPda, mint, auction: auctionPda, seller: seller.publicKey, treasury: authority,
      auctionVault, winnerToken, tool: toolPda(mint), tokenProgram: TOKEN_PROGRAM_ID }).rpc();
    await expectError(settle(attackerAta), "Unauthorized");
    await settle(tokenAccount); // продавец забирает при отсутствии ставок
  });

  it("auction bid: предыдущий ставивший получает возврат", async () => {
    const seller = Keypair.generate(); await airdrop(seller);
    const { mint, tokenAccount } = await mintTool(seller.publicKey);
    const auctionPda = pda([B("auction"), mint.toBuffer()]);
    const auctionVault = await ensureAta(mint, auctionPda);
    await program.methods.auctionCreate(new BN(1_000_000), new BN(600)).accounts({
      config: configPda, seller: seller.publicKey, mint, tool: toolPda(mint), sellerToken: tokenAccount,
      auction: auctionPda, auctionVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId
    }).signers([seller]).rpc();
    const b1 = Keypair.generate(); await airdrop(b1);
    const b2 = Keypair.generate(); await airdrop(b2);
    // AuctionCreate initializes current_bidder to the seller even before the
    // first bid, so the address constraint must be respected on every bid.
    let currentBidder: PublicKey = seller.publicKey;
    const bid = async (bidder: Keypair, amt: number) => {
      await program.methods.auctionBid(new BN(amt)).accounts({
        config: configPda, bidder: bidder.publicKey, mint, auction: auctionPda,
        previousBidder: currentBidder, systemProgram: SystemProgram.programId
      }).signers([bidder]).rpc();
      currentBidder = bidder.publicKey;
    };
    await program.methods.setPaused(true).accounts({ config: configPda, authority }).rpc();
    await expectError(program.methods.auctionBid(new BN(10_000_000)).accounts({
      config: configPda, bidder: b1.publicKey, mint, auction: auctionPda,
      previousBidder: currentBidder, systemProgram: SystemProgram.programId
    }).signers([b1]).rpc(), "Paused");
    await program.methods.setPaused(false).accounts({ config: configPda, authority }).rpc();
    const auctionRent = await provider.connection.getBalance(auctionPda);
    await bid(b1, 10_000_000);
    const before = await provider.connection.getBalance(b1.publicKey);
    await bid(b2, 20_000_000);
    const after = await provider.connection.getBalance(b1.publicKey);
    expect(after - before).to.equal(10_000_000);
    expect(await provider.connection.getBalance(auctionPda)).to.equal(auctionRent + 20_000_000);
    const selfBidBefore = await provider.connection.getBalance(b2.publicKey);
    await bid(b2, 30_000_000); // previous_bidder aliases bidder, but not escrow
    expect(selfBidBefore - await provider.connection.getBalance(b2.publicKey)).to.equal(10_000_000);
    expect(await provider.connection.getBalance(auctionPda)).to.equal(auctionRent + 30_000_000);
  });

  // [RUNTIME LAMPORT RULE] Offer acceptance (and auction settlement, tested at
  // the end of this suite) used to move lamports directly before the token
  // CPI. The runtime re-checks the instruction's lamport sum at every CPI from
  // the accounts passed to it, so each failed with UnbalancedInstruction: no
  // offer could be accepted, and an auction with a bid could never be settled
  // (bid and NFT locked for good).
  it("offer accept: the buyer gets the NFT, the seller and the treasury split the escrow", async () => {
    const seller = Keypair.generate(); await airdrop(seller);
    const buyer = Keypair.generate(); await airdrop(buyer);
    const { mint, tokenAccount: sellerToken } = await mintTool(seller.publicKey);
    const offer = pda([B("offer"), mint.toBuffer(), buyer.publicKey.toBuffer()]);
    const PRICE = 30_000_000;
    await program.methods.offerCreate(new BN(PRICE)).accounts({
      config: configPda, buyer: buyer.publicKey, mint, offer, systemProgram: SystemProgram.programId,
    }).signers([buyer]).rpc();
    const buyerToken = await ensureAta(mint, buyer.publicKey);
    const offerLamports = await provider.connection.getBalance(offer);
    const signature = await program.methods.offerAccept().accounts({
      config: configPda, seller: seller.publicKey, mint, tool: toolPda(mint), offer, buyerRefund: buyer.publicKey,
      treasury: authority, sellerToken, buyerToken, tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([seller]).rpc();
    const d = await txDeltas(signature);
    const fee = Math.floor(PRICE * 250 / 10_000); // OFFER_FEE_BPS
    expect((await balance(buyerToken)).toString()).to.equal("1");
    expect((await balance(sellerToken)).toString()).to.equal("0");
    expect(await provider.connection.getAccountInfo(offer)).to.equal(null);
    expect((await program.account.toolData.fetch(toolPda(mint))).owner.toBase58()).to.equal(buyer.publicKey.toBase58());
    expect(d(seller.publicKey)).to.equal(PRICE - fee);
    expect(d(buyer.publicKey)).to.equal(offerLamports - PRICE); // the offer's rent comes back (close = buyer_refund)
    expectFeePayerDelta(d(authority), fee - d.fee);
  });

  it("orderbook: полное сведение не ломает rent (C2)", async () => {
    const buyer = Keypair.generate(); await airdrop(buyer);
    const seller = Keypair.generate(); await airdrop(seller);
    const sellerCircuit = await ensureAta(circuitMint, seller.publicKey);
    const treasAta = await ensureAta(circuitMint, authority);
    await ensurePlayer(seller.publicKey);
    await program.methods.mintResource({ circuit: {} }, new BN(1_000)).accounts({
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, issuanceCap: issuanceCapPda("circuit"), mint: circuitMint, tokenAccount: sellerCircuit,
      treasuryToken: treasAta, player: playerPda(seller.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).rpc();
    const buyerCircuit = await ensureAta(circuitMint, buyer.publicKey);
    const price = 1_000, amount = 100;
    const buyOrder = pda([B("resource_order"), buyer.publicKey.toBuffer(), circuitMint.toBuffer()]);
    await program.methods.placeBuyOrder(1, new BN(price), new BN(amount)).accounts({
      config: configPda, maker: buyer.publicKey, mint: circuitMint, materialMints: materialMintsPda, order: buyOrder,
      systemProgram: SystemProgram.programId }).signers([buyer]).rpc();
    const sellOrder = pda([B("resource_order"), seller.publicKey.toBuffer(), circuitMint.toBuffer()]);
    const orderVault = await ensureAta(circuitMint, sellOrder);
    await program.methods.placeSellOrder(1, new BN(price), new BN(amount)).accounts({
      config: configPda, maker: seller.publicKey, mint: circuitMint, materialMints: materialMintsPda, makerToken: sellerCircuit,
      order: sellOrder, orderVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId
    }).signers([seller]).rpc();
    const matchAccounts = {
      config: configPda, materialMints: materialMintsPda, mint: circuitMint, buyOrder, sellOrder, seller: seller.publicKey,
      treasury: authority, sellVault: orderVault, buyerToken: buyerCircuit, tokenProgram: TOKEN_PROGRAM_ID,
    };
    await program.methods.setPaused(true).accounts({ config: configPda, authority }).rpc();
    await expectError(program.methods.matchResourceOrders().accounts(matchAccounts).rpc(), "Paused");
    await program.methods.setPaused(false).accounts({ config: configPda, authority }).rpc();
    await program.methods.matchResourceOrders().accounts(matchAccounts).rpc();
    const bal = (await provider.connection.getTokenAccountBalance(buyerCircuit)).value.amount;
    expect(bal).to.equal("100");
  });

  it("orderbook v2: цена за целый ресурс, эскроу вверх, свод и отмена", async () => {
    const buyer = Keypair.generate(); await airdrop(buyer);
    const seller = Keypair.generate(); await airdrop(seller);
    // Продавец получает 2 целых ресурса (mint_resource удерживает казённую
    // комиссию, поэтому берём с запасом) и продаёт 100 атомов из них.
    const sellerCircuit = await giveResource("circuit", circuitMint, seller.publicKey, 2);
    const buyerCircuit = await ensureAta(circuitMint, buyer.publicKey);
    const atoms = 100;                       // атомы — та же единица, что в v1
    const pricePerWhole = new BN(100_000_000_000); // 100 SOL за ЦЕЛЫЙ ресурс
    // ceil(1e11 × 100 / 1e9) = 10_000 лампор ровно; подушка тейкера ceil(×40/10⁴)=40.
    const total = 10_000, deposit = 10_040;

    const buyOrder = pda([B("resource_order_v2"), buyer.publicKey.toBuffer(), circuitMint.toBuffer()]);
    await program.methods.placeBuyOrderV2(1, pricePerWhole, new BN(atoms)).accounts({
      config: configPda, maker: buyer.publicKey, mint: circuitMint, materialMints: materialMintsPda,
      order: buyOrder, systemProgram: SystemProgram.programId,
    }).signers([buyer]).rpc();
    let order = await program.account.resourceOrderV2.fetch(buyOrder);
    expect(order.escrowLamports.toString()).to.equal(String(deposit));
    expect(order.priceLamportsPerWhole.toString()).to.equal(pricePerWhole.toString());
    expect(order.amountRemaining.toString()).to.equal(String(atoms));

    // Пыль округляется ВВЕРХ: 1 атом по 1,5 лампора за атом (цена за целый
    // ресурс 1,5e9) стоит 2 лампора + подушка 1 = 3 в эскроу.
    const dustOrder = pda([B("resource_order_v2"), buyer.publicKey.toBuffer(), siliconMint.toBuffer()]);
    await program.methods.placeBuyOrderV2(2, new BN(1_500_000_000), new BN(1)).accounts({
      config: configPda, maker: buyer.publicKey, mint: siliconMint, materialMints: materialMintsPda,
      order: dustOrder, systemProgram: SystemProgram.programId,
    }).signers([buyer]).rpc();
    expect((await program.account.resourceOrderV2.fetch(dustOrder)).escrowLamports.toString()).to.equal("3");
    const dustAccount = await provider.connection.getAccountInfo(dustOrder);
    expect(dustAccount).to.not.equal(null);
    // Эскроу лежит в САМОМ аккаунте заявки: getBalance вернул бы rent + эскроу,
    // поэтому сверяем баланс минус rent-exemption — ровно 3 лампора.
    const dustRentMin = await provider.connection.getMinimumBalanceForRentExemption(dustAccount!.data.length);
    const dustBalance = dustAccount!.lamports;
    expect(dustBalance - dustRentMin).to.equal(3);
    const buyerBefore = await provider.connection.getBalance(buyer.publicKey);
    await program.methods.cancelBuyOrderV2().accounts({
      config: configPda, maker: buyer.publicKey, mint: siliconMint, order: dustOrder,
    }).signers([buyer]).rpc();
    expect(await provider.connection.getAccountInfo(dustOrder)).to.equal(null);
    // close = maker возвращает ВЕСЬ баланс закрытого аккаунта (rent + эскроу)
    // ровно один раз: «баланс + эскроу» было бы двойным счётом, а «ноль» —
    // потерей депозита (комиссию за подпись платит кошелёк провайдера).
    expect(await provider.connection.getBalance(buyer.publicKey) - buyerBefore).to.equal(dustBalance);

    // Нулевая цена и нулевой объём не создают заявку вовсе (ZeroAmount).
    const zeroOrder = pda([B("resource_order_v2"), buyer.publicKey.toBuffer(), dataMint.toBuffer()]);
    await expectError(program.methods.placeBuyOrderV2(0, new BN(0), new BN(atoms)).accounts({
      config: configPda, maker: buyer.publicKey, mint: dataMint, materialMints: materialMintsPda,
      order: zeroOrder, systemProgram: SystemProgram.programId,
    }).signers([buyer]).rpc(), "ZeroAmount");

    const sellOrder = pda([B("resource_order_v2"), seller.publicKey.toBuffer(), circuitMint.toBuffer()]);
    const sellVault = await ensureAta(circuitMint, sellOrder);
    await program.methods.placeSellOrderV2(1, pricePerWhole, new BN(atoms)).accounts({
      config: configPda, maker: seller.publicKey, mint: circuitMint, materialMints: materialMintsPda,
      makerToken: sellerCircuit, order: sellOrder, orderVault: sellVault,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([seller]).rpc();

    const signature = await program.methods.matchResourceOrdersV2().accounts({
      config: configPda, materialMints: materialMintsPda, mint: circuitMint, buyOrder, sellOrder,
      seller: seller.publicKey, treasury: authority, sellVault, buyerToken: buyerCircuit,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();
    const d = await txDeltas(signature);
    const takerFee = Math.floor(total * 40 / 10_000), makerFee = Math.floor(total * 10 / 10_000);
    expect((await balance(buyerCircuit)).toString()).to.equal(String(atoms));
    expect(d(seller.publicKey)).to.equal(total - makerFee);
    expectFeePayerDelta(d(authority), takerFee + makerFee - d.fee);
    order = await program.account.resourceOrderV2.fetch(buyOrder);
    expect(order.escrowLamports.toString()).to.equal(String(deposit - total - takerFee));
    expect(order.amountRemaining.toString()).to.equal("0");

    // Отмена после полного свода: эскроу уже выплачен, но rent обоих аккаунтов
    // (ордера и vault) обязан вернуться продавцу — иначе выход заперт.
    const sellerBefore = await provider.connection.getBalance(seller.publicKey);
    // Продавец держит в заявке только rent: ресурс лежит в vault, а SOL-эскроу
    // у продавца не бывает, поэтому возврат равен ровно сумме двух аккаунтов.
    const sellerRent = (await provider.connection.getBalance(sellOrder))
      + (await provider.connection.getBalance(sellVault));
    await program.methods.cancelSellOrderV2().accounts({
      config: configPda, maker: seller.publicKey, mint: circuitMint, order: sellOrder,
      orderVault: sellVault, makerToken: sellerCircuit, tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([seller]).rpc();
    await program.methods.cancelBuyOrderV2().accounts({
      config: configPda, maker: buyer.publicKey, mint: circuitMint, order: buyOrder,
    }).signers([buyer]).rpc();
    expect(await provider.connection.getBalance(seller.publicKey) - sellerBefore).to.equal(sellerRent);
    expect(await provider.connection.getAccountInfo(sellOrder)).to.equal(null);
    expect(await provider.connection.getAccountInfo(sellVault)).to.equal(null);
    expect(order.escrowLamports.toString()).to.equal("0");
    expect((await balance(sellerCircuit)).toNumber()).to.be.greaterThan(0);
  });

  // [F-06] Paid randomness mechanics commit through Switchboard On-Demand. With
  // no pool slot (no Switchboard on this validator) a commit must fail while
  // Anchor loads the accounts, before any lamport, token or PDA changes. The
  // full commit/reveal/refund cycle runs in the host tests
  // (aof-core/src/security_checklist_tests.rs, emulated Switchboard) and on
  // devnet (scripts/vrf/devnet-smoke.mjs).
  it("VRF pack commit: an empty Switchboard pool fails the commit before any charge", async () => {
    const packConfig = pda([B("pack_config"), Buffer.from([0])]);
    const PRICE = 100_000_000;
    try {
      await program.methods.initPackConfig(0, new BN(PRICE), [6000, 3200, 700, 100, 0])
        .accounts({ config: configPda, authority, packConfig, systemProgram: SystemProgram.programId }).rpc();
      console.log("initPackConfig: ok");
    } catch (e: any) {
      rethrowUnlessAlreadyInitialised("initPackConfig", e);
    }
    const user = Keypair.generate(); await airdrop(user);
    const nonce = new BN(1);
    const packCommit = pda([B("pack_commit"), user.publicKey.toBuffer(), u64le(nonce)]);
    const before = await provider.connection.getBalance(user.publicKey);
    // The operator (here the bootstrap authority) co-signs every pack commit.
    await expectAccountError(program.methods.packOpenCommit({ small: {} }, nonce, new BN(PRICE)).accountsStrict({
      config: configPda, authority, user: user.publicKey, packConfig, packCommit, ...vrfCommitAccounts(),
      systemProgram: SystemProgram.programId,
    }).signers([user]).rpc(), "AccountNotInitialized", "vrf_slot");
    expect(await provider.connection.getBalance(user.publicKey)).to.equal(before);
    expect(await provider.connection.getAccountInfo(packCommit)).to.equal(null);
  });

  it("VRF forge commit: an empty Switchboard pool fails the commit and burns nothing", async () => {
    const user = Keypair.generate(); await airdrop(user);
    // [AUDIT F-17] mint_tool only accepts canonical tool kinds.
    const { mint: toolMint } = await mintTool(user.publicKey, "silicon_extractor");
    const userCircuit = await giveResource("circuit", circuitMint, user.publicKey, 1000);
    const userSilicon = await giveResource("silicon", siliconMint, user.publicKey, 1000);
    const circuitBefore = await balance(userCircuit);
    const siliconBefore = await balance(userSilicon);
    const slotType = 0;
    const enchantSlot = pda([B("enchant_slot"), toolMint.toBuffer(), Buffer.from([slotType])]);
    const forgeCommit = pda([B("forge_commit"), toolMint.toBuffer(), Buffer.from([slotType])]);
    await expectAccountError(program.methods.forgeAttemptCommit(slotType, true).accountsStrict({
      config: configPda, authority, user: user.publicKey, tool: toolPda(toolMint), toolMint, enchantSlot, forgeCommit,
      circuitMint, userCircuit, siliconMint, userSilicon, ...vrfCommitAccounts(),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([user]).rpc(), "AccountNotInitialized", "vrf_slot");
    expect((await balance(userCircuit)).toString()).to.equal(circuitBefore.toString());
    expect((await balance(userSilicon)).toString()).to.equal(siliconBefore.toString());
    expect(await provider.connection.getAccountInfo(forgeCommit)).to.equal(null);
    expect(await provider.connection.getAccountInfo(enchantSlot)).to.equal(null);
  });

  it("VRF reroll commit: an empty Switchboard pool fails the commit and keeps the tool", async () => {
    const rerollConfig = pda([B("reroll_config")]);
    if (!(await provider.connection.getAccountInfo(rerollConfig))) {
      await program.methods.initRerollConfig([5500, 3000, 1100, 400, 0])
        .accounts({ config: configPda, authority, rerollConfig, systemProgram: SystemProgram.programId }).rpc();
    }
    const user = Keypair.generate(); await airdrop(user);
    const { mint: burnMint, tokenAccount: burnToken } = await mintTool(user.publicKey);
    const gAcc = { config: configPda, user: user.publicKey, gastank: gastankPda(user.publicKey), systemProgram: SystemProgram.programId };
    await program.methods.depositGas(new BN(100_000_000)).accounts(gAcc).signers([user]).rpc();
    const nonce = new BN(1);
    const rerollCommit = pda([B("reroll_commit"), user.publicKey.toBuffer(), u64le(nonce)]);
    await expectAccountError(program.methods.rerollRandomCommit(nonce).accountsStrict({
      config: configPda, authority, user: user.publicKey, gastank: gastankPda(user.publicKey), rerollConfig,
      burnTool: toolPda(burnMint), burnMint, burnToken, rerollCommit, ...vrfCommitAccounts(),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([user]).rpc(), "AccountNotInitialized", "vrf_slot");
    const td = await program.account.toolData.fetch(toolPda(burnMint));
    expect(td.owner.toString()).to.equal(user.publicKey.toString());
    expect((await balance(burnToken)).toString()).to.equal("1");
    expect(await provider.connection.getAccountInfo(rerollCommit)).to.equal(null);
  });

  it("start_signal_processing: burns synapse+silicon from writable mints, arms the processor, blocks re-start and early collect", async () => {
    // Regression for the read-only-mint bug: StartSignalProcessing.synapse_mint /
    // silicon_mint were declared without `mut`, so token::burn failed with
    // "writable privilege escalated" and milling never worked on-chain.
    const user = Keypair.generate(); await airdrop(user);
    const userSynapse = await giveResource("synapse", synapseMint, user.publicKey, 100);
    const userSilicon = await giveResource("silicon", siliconMint, user.publicKey, 100);
    const synapseBefore = await balance(userSynapse);
    const siliconBefore = await balance(userSilicon);
    const supplyBefore = new BN((await provider.connection.getTokenSupply(synapseMint)).value.amount);
    const signalState = pda([B("signal_state"), user.publicKey.toBuffer()]);
    const acc = {
      config: configPda, user: user.publicKey, materialMints: materialMintsPda,
      energyAccount: pda([B("energy_account"), user.publicKey.toBuffer()]), signalState,
      synapseMint, siliconMint, userSynapse, userSilicon,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    };
    await program.methods.startSignalProcessing(1).accounts(acc).signers([user]).rpc();
    // batch 1 recipe: 6 synapse + 1 silicon (start_signal_processing.rs MILL_*_COST[0])
    expect(synapseBefore.sub(await balance(userSynapse)).toString()).to.equal(UNIT.muln(6).toString());
    expect(siliconBefore.sub(await balance(userSilicon)).toString()).to.equal(UNIT.muln(1).toString());
    const supplyAfter = new BN((await provider.connection.getTokenSupply(synapseMint)).value.amount);
    expect(supplyBefore.sub(supplyAfter).toString()).to.equal(UNIT.muln(6).toString());
    const mill = await program.account.signalState.fetch(signalState);
    expect(mill.owner.toString()).to.equal(user.publicKey.toString());
    expect(mill.inProgress).to.equal(true);
    expect(mill.outputSignal.toString()).to.equal(UNIT.muln(3).toString());
    // A second batch while one is running is rejected and burns nothing.
    await expectError(program.methods.startSignalProcessing(2).accounts(acc).signers([user]).rpc(), "SignalInProgress");
    expect(synapseBefore.sub(await balance(userSynapse)).toString()).to.equal(UNIT.muln(6).toString());
    // Collecting before ready_at (1h) is rejected.
    const userSignal = await ensureAta(signalMint, user.publicKey);
    await expectError(program.methods.collectSignal().accounts({
      config: configPda, user: user.publicKey, materialMints: materialMintsPda, signalState,
      auth: authPda, signalMint, userSignal, tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([user]).rpc(), "SignalNotReady");
    expect((await balance(userSignal)).toString()).to.equal("0");
  });

  it("start_model_training: burns signal+power+fuel from writable mints for both fuel kinds, blocks early collect", async () => {
    // Same regression class as signal processing: signal/power/circuit/compute mints in
    // StartModelTraining lacked `mut`. Covers fuel_kind 0 (circuit) and 1 (compute) with
    // two separate users because an oven can only run one batch at a time.
    for (const fuelKind of [0, 1] as const) {
      const user = Keypair.generate(); await airdrop(user);
      const userSignal = await giveResource("signal", signalMint, user.publicKey, 100);
      const userPower = await giveResource("power", powerMint, user.publicKey, 100);
      const userCircuit = await giveResource("circuit", circuitMint, user.publicKey, 100);
      const userCompute = await giveResource("compute", computeMint, user.publicKey, 100);
      const before = { signal: await balance(userSignal), power: await balance(userPower), circuit: await balance(userCircuit), compute: await balance(userCompute) };
      const modelState = pda([B("model_state"), user.publicKey.toBuffer()]);
      const acc = {
        config: configPda, user: user.publicKey, materialMints: materialMintsPda,
        energyAccount: pda([B("energy_account"), user.publicKey.toBuffer()]), modelState,
        signalMint, powerMint, circuitMint, computeMint, userSignal, userPower, userCircuit, userCompute,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      };
      await program.methods.startModelTraining(1, fuelKind).accounts(acc).signers([user]).rpc();
      // batch 1 recipe: 4 signal + 3 power + (5 circuit | 2 compute) (start_model_training.rs OVEN_*_COST[0])
      expect(before.signal.sub(await balance(userSignal)).toString()).to.equal(UNIT.muln(4).toString(), `signal fuel=${fuelKind}`);
      expect(before.power.sub(await balance(userPower)).toString()).to.equal(UNIT.muln(3).toString(), `power fuel=${fuelKind}`);
      expect(before.circuit.sub(await balance(userCircuit)).toString()).to.equal(UNIT.muln(fuelKind === 0 ? 5 : 0).toString(), `circuit fuel=${fuelKind}`);
      expect(before.compute.sub(await balance(userCompute)).toString()).to.equal(UNIT.muln(fuelKind === 1 ? 2 : 0).toString(), `compute fuel=${fuelKind}`);
      const oven = await program.account.modelState.fetch(modelState);
      expect(oven.inProgress).to.equal(true);
      expect(oven.fuelKind).to.equal(fuelKind);
      expect(oven.outputModel.toString()).to.equal(UNIT.muln(fuelKind === 0 ? 2 : 3).toString());
      await expectError(program.methods.startModelTraining(1, fuelKind).accounts(acc).signers([user]).rpc(), "ModelInProgress");
      const userModel = await ensureAta(modelMint, user.publicKey);
      await expectError(program.methods.collectModel().accounts({
        config: configPda, user: user.publicKey, materialMints: materialMintsPda, modelState,
        auth: authPda, modelMint: modelMint, userModel, tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([user]).rpc(), "ModelNotReady");
      expect((await balance(userModel)).toString()).to.equal("0");
    }
  });
  // ---------------------------------------------------------------------------
  // Regressions for the 2026-09-21 audit (see REMEDIATION_STATUS.md). Each test
  // names the finding it protects; they mutate global config (authority,
  // paused, mining flag, supply caps) and always restore it.
  // ---------------------------------------------------------------------------
  describe("audit regressions 2026-09-21", () => {
    it("F-22: mint_tool mints only to the declared recipient", async () => {
      const to = Keypair.generate(); await airdrop(to);
      const other = Keypair.generate();
      const mint = await createMint(provider.connection, setupPayer, authPda, null, 0);
      const tokenAccount = await ensureAta(mint, to.publicKey);
      const accounts = {
        config: configPda, authority, auth: authPda, mint, tokenAccount,
        recipient: other.publicKey, // not the ATA owner
        payer: setupPayer.publicKey,
        toolData: toolPda(mint), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      };
      await expectError(
        sendWithPayer(program.methods.mintTool("plasma_cutter", { common: {} }).accounts(accounts), setupPayer),
        "ConstraintTokenOwner",
      );
      await sendWithPayer(program.methods.mintTool("plasma_cutter", { common: {} })
        .accounts({ ...accounts, recipient: to.publicKey }), setupPayer);
      const td = await program.account.toolData.fetch(toolPda(mint));
      expect(td.owner.toBase58()).to.equal(to.publicKey.toBase58());
    });

    it("F-22 authority separation: authority cannot be payer or recipient", async () => {
      const to = Keypair.generate(); await airdrop(to);
      const mint = await createMint(provider.connection, setupPayer, authPda, null, 0);
      const recipientAta = await ensureAta(mint, to.publicKey);
      const toolData = toolPda(mint);

      await expectError(
        program.methods.mintTool("plasma_cutter", { common: {} }).accounts({
          config: configPda, authority, auth: authPda, mint, tokenAccount: recipientAta,
          recipient: to.publicKey, payer: authority, toolData,
          tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        }).rpc(),
        "Unauthorized",
      );

      const authorityAta = await ensureAta(mint, authority);
      await expectError(
        sendWithPayer(program.methods.mintTool("plasma_cutter", { common: {} }).accounts({
          config: configPda, authority, auth: authPda, mint, tokenAccount: authorityAta,
          recipient: authority, payer: setupPayer.publicKey, toolData,
          tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        }), setupPayer),
        "Unauthorized",
      );
      expect(await provider.connection.getAccountInfo(toolData)).to.equal(null);
    });

    it("F-02: two-step authority rotation", async () => {
      const next = Keypair.generate(); await airdrop(next);
      await program.methods.setPendingAuthority(next.publicKey).accounts({ config: configPda, authority }).rpc();
      expect((await program.account.config.fetch(configPda)).pendingAuthority.toBase58())
        .to.equal(next.publicKey.toBase58());
      await expectError(
        program.methods.acceptAuthority()
          .accounts({ config: configPda, newAuthority: setupPayer.publicKey })
          .signers([setupPayer]).rpc(),
        "NotPendingAuthority",
      );
      await program.methods.acceptAuthority()
        .accounts({ config: configPda, newAuthority: next.publicKey }).signers([next]).rpc();
      expect((await program.account.config.fetch(configPda)).authority.toBase58())
        .to.equal(next.publicKey.toBase58());
      // Rotate back: the rest of the suite signs as the provider wallet.
      await program.methods.setPendingAuthority(authority)
        .accounts({ config: configPda, authority: next.publicKey }).signers([next]).rpc();
      await program.methods.acceptAuthority()
        .accounts({ config: configPda, newAuthority: authority }).rpc();
      expect((await program.account.config.fetch(configPda)).authority.toBase58())
        .to.equal(authority.toBase58());
    });

    it("F-03: the global supply cap blocks minting over the ceiling", async () => {
      const user = Keypair.generate(); await airdrop(user);
      await ensurePlayer(user.publicKey);
      const mintInfo = await getMint(provider.connection, circuitMint);
      const supply = new BN(mintInfo.supply.toString());
      const setCap = (cap: BN) => program.methods.setSupplyCap({ circuit: {} }, cap)
        .accounts({ config: configPda, authority, materialMints: materialMintsPda }).rpc();
      await setCap(supply.add(UNIT.muln(5)));
      const acc = {
        config: configPda, materialMints: materialMintsPda, authority, auth: authPda,
        issuanceCap: issuanceCapPda("circuit"), mint: circuitMint,
        tokenAccount: await ensureAta(circuitMint, user.publicKey),
        treasuryToken: await ensureAta(circuitMint, authority),
        player: playerPda(user.publicKey),
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      };
      await expectError(
        program.methods.mintResource({ circuit: {} }, UNIT.muln(10)).accounts(acc).rpc(),
        "SupplyCapExceeded",
      );
      await program.methods.mintResource({ circuit: {} }, UNIT.muln(5)).accounts(acc).rpc();
      await expectError(
        program.methods.mintResource({ circuit: {} }, UNIT.muln(1)).accounts(acc).rpc(),
        "SupplyCapExceeded",
      );
      // u64::MAX == SUPPLY_CAP_UNLIMITED restores the un-capped behaviour.
      await setCap(new BN("18446744073709551615"));
    });

    it("F-01: pay_out is bounded by its vault guard", async () => {
      const recipient = Keypair.generate(); await airdrop(recipient);
      await giveResource("circuit", circuitMint, recipient.publicKey, 1); // creates the Player PDA
      const vaultToken = await ensureAta(circuitMint, vaultPda);
      await giveResource("circuit", circuitMint, vaultPda, 40); // fund the vault ATA
      const guard = pda([B("vault_guard"), circuitMint.toBuffer()]);
      const pay = async (amount: BN) => program.methods.payOut(amount).accounts({
        config: configPda, authority, materialMints: materialMintsPda, vaultGuard: guard,
        player: playerPda(recipient.publicKey), vault: vaultPda, mint: circuitMint, vaultToken,
        userToken: await ensureAta(circuitMint, recipient.publicKey), tokenProgram: TOKEN_PROGRAM_ID,
      }).rpc();
      // Un-configured mint: the guard PDA does not exist, so the withdrawal is
      // impossible at all (fail closed).
      await expectError(pay(UNIT), "AccountNotInitialized");
      // `init_vault_guard` rejects epoch_slots outside
      // [ISSUANCE_EPOCH_MIN_SLOTS; ISSUANCE_EPOCH_MAX_SLOTS] = [1_500; 6_480_000]
      // with InvalidVaultGuardParams, so the fixture has to stay in range. 2_000
      // slots is far longer than this test runs, so the epoch cannot roll under
      // it and the budget assertions below stay meaningful.
      await program.methods.initVaultGuard(new BN(2_000), UNIT.muln(10), UNIT.muln(3))
        .accounts({ config: configPda, authority, mint: circuitMint, vaultGuard: guard, systemProgram: SystemProgram.programId })
        .rpc();
      await expectError(pay(UNIT.muln(5)), "VaultGuardLimitExceeded"); // above max_per_tx
      await pay(UNIT.muln(3));
      await pay(UNIT.muln(3));
      await pay(UNIT.muln(3));
      await expectError(pay(UNIT.muln(3)), "VaultGuardLimitExceeded"); // epoch budget spent
    });

    it("F-C: the guardian freezes cash-out; payouts stop, gameplay and own exits go on, only the admin unfreezes", async () => {
      // Owner requirement: fraudsters holding an inflated in-game balance must
      // not withdraw it, and the game must not suffer.
      const guardian = Keypair.generate(); await airdrop(guardian, 1);
      const stranger = Keypair.generate(); await airdrop(stranger, 1);
      const player = Keypair.generate(); await airdrop(player, 1);
      const cfg = async () => (await program.account.config.fetch(configPda)) as any;
      const stop = (caller: Keypair, pauseGame: boolean, freezeCashout: boolean) =>
        program.methods.emergencyStop(pauseGame, freezeCashout)
          .accounts({ config: configPda, caller: caller.publicKey }).signers([caller]).rpc();
      await program.methods.setRoles(authority, guardian.publicKey).accounts({ config: configPda, authority }).rpc();
      try {
        expect((await cfg()).guardian.toBase58()).to.equal(guardian.publicKey.toBase58());

        // A payout route that works before the incident...
        await giveResource("silicon", siliconMint, player.publicKey, 1); // creates the Player PDA
        const vaultToken = await ensureAta(siliconMint, vaultPda);
        await giveResource("silicon", siliconMint, vaultPda, 20);
        const guard = pda([B("vault_guard"), siliconMint.toBuffer()]);
        await program.methods.initVaultGuard(new BN(2_000), UNIT.muln(10), UNIT.muln(3))
          .accounts({ config: configPda, authority, mint: siliconMint, vaultGuard: guard, systemProgram: SystemProgram.programId })
          .rpc();
        const playerSilicon = await ensureAta(siliconMint, player.publicKey);
        const pay = () => program.methods.payOut(UNIT).accounts({
          config: configPda, authority, materialMints: materialMintsPda, vaultGuard: guard,
          player: playerPda(player.publicKey), vault: vaultPda, mint: siliconMint, vaultToken,
          userToken: playerSilicon, tokenProgram: TOKEN_PROGRAM_ID,
        }).rpc();
        await pay();
        // ...and SOL the player deposited before it.
        const gastank = pda([B("gastank"), player.publicKey.toBuffer()]);
        const gasAccounts = { config: configPda, user: player.publicKey, gastank, systemProgram: SystemProgram.programId };
        await program.methods.depositGas(new BN(10_000_000)).accounts(gasAccounts).signers([player]).rpc();

        // Only the guardian or the admin pulls an emergency stop, and a stop must switch something on.
        await expectError(stop(stranger, false, true), "Unauthorized");
        await expectError(stop(guardian, false, false), "InvalidAmount");
        await stop(guardian, false, true);
        const frozen = await cfg();
        expect([frozen.paused, frozen.cashoutFrozen]).to.deep.equal([false, true]);

        // Value cannot leave the game...
        const before = await balance(playerSilicon);
        await expectError(pay(), "CashoutFrozen");
        expect((await balance(playerSilicon)).toString()).to.equal(before.toString());
        // ...the game goes on (resource issuance is not frozen)...
        await giveResource("silicon", siliconMint, player.publicKey, 1);
        expect((await balance(playerSilicon)).gt(before)).to.equal(true);
        // ...and the player takes their own deposit back.
        const lamportsBefore = await provider.connection.getBalance(player.publicKey);
        await program.methods.withdrawGas(new BN(10_000)).accounts(gasAccounts).signers([player]).rpc();
        expect(await provider.connection.getBalance(player.publicKey) - lamportsBefore).to.equal(10_000_000); // the provider pays the fee

        // The guardian cannot lift the freeze; the admin can, and payouts resume.
        await expectError(program.methods.setCashoutFrozen(false)
          .accounts({ config: configPda, authority: guardian.publicKey }).signers([guardian]).rpc(), "Unauthorized");
        await program.methods.setCashoutFrozen(false).accounts({ config: configPda, authority }).rpc();
        expect((await cfg()).cashoutFrozen).to.equal(false);
        await pay();
        expect((await balance(playerSilicon)).gt(before)).to.equal(true);
      } finally {
        // Never leave the rest of the suite frozen, paused or with a foreign guardian.
        const c = await cfg();
        if (c.cashoutFrozen) await program.methods.setCashoutFrozen(false).accounts({ config: configPda, authority }).rpc();
        if (c.paused) await program.methods.setPaused(false).accounts({ config: configPda, authority }).rpc();
        await program.methods.setRoles(authority, authority).accounts({ config: configPda, authority }).rpc();
      }
    });

    it("F-19 / F-C: pause blocks new listings but never locks the seller's NFT", async () => {
      // Owner decision (SECURITY_CHECKLIST_REVIEW F-C, supersedes F-19): pause
      // stops new activity, while exits that only return a player's own
      // assets (marketplace cancel, rental end, refunds) stay open.
      const seller = Keypair.generate(); await airdrop(seller);
      const { mint, tokenAccount } = await mintTool(seller.publicKey);
      const second = await mintTool(seller.publicKey);
      const listAccounts = (m: PublicKey, sellerToken: PublicKey, listing: PublicKey, listingVault: PublicKey) => ({
        config: configPda, seller: seller.publicKey, mint: m, tool: toolPda(m),
        sellerToken, listing, listingVault,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      });
      const listing = pda([B("listing"), mint.toBuffer()]);
      const listingVault = await ensureAta(mint, listing);
      await program.methods.marketplaceList(new BN(1_000))
        .accounts(listAccounts(mint, tokenAccount, listing, listingVault)).signers([seller]).rpc();
      const secondListing = pda([B("listing"), second.mint.toBuffer()]);
      const secondVault = await ensureAta(second.mint, secondListing);
      await program.methods.setPaused(true).accounts({ config: configPda, authority }).rpc();
      try {
        await expectError(program.methods.marketplaceList(new BN(1_000))
          .accounts(listAccounts(second.mint, second.tokenAccount, secondListing, secondVault)).signers([seller]).rpc(), "Paused");
        await program.methods.marketplaceCancel().accounts({
          config: configPda, mint, listing, seller: seller.publicKey, listingVault,
          sellerToken: tokenAccount, tokenProgram: TOKEN_PROGRAM_ID,
        }).signers([seller]).rpc();
        expect((await balance(tokenAccount)).toString()).to.equal("1");
        expect(await provider.connection.getAccountInfo(listing)).to.equal(null);
      } finally {
        // Never leave the program paused for the rest of the suite.
        await program.methods.setPaused(false).accounts({ config: configPda, authority }).rpc();
      }
    });

    it("F-10: an NFT can be listed again after a cancel", async () => {
      const seller = Keypair.generate(); await airdrop(seller);
      const { mint, tokenAccount } = await mintTool(seller.publicKey);
      const listing = pda([B("listing"), mint.toBuffer()]);
      let listingVault = await createTokenAccount(provider.connection, setupPayer, mint, listing, Keypair.generate());
      const listAccounts = () => ({
        config: configPda, seller: seller.publicKey, mint, tool: toolPda(mint),
        sellerToken: tokenAccount, listing, listingVault,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      });
      await program.methods.marketplaceList(new BN(1_000)).accounts(listAccounts()).signers([seller]).rpc();
      await program.methods.marketplaceCancel().accounts({
        config: configPda, mint, listing, seller: seller.publicKey, listingVault,
        sellerToken: tokenAccount, tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([seller]).rpc();
      // Both the Listing PDA and escrow token account close on cancel. Use a
      // fresh classic token account owned by the same PDA for the relist; the
      // instruction only requires the correct mint/owner, not an associated ATA.
      listingVault = await createTokenAccount(provider.connection, setupPayer, mint, listing, Keypair.generate());
      await program.methods.marketplaceList(new BN(2_000)).accounts(listAccounts()).signers([seller]).rpc();
      expect((await program.account.listing.fetch(listing)).priceLamports.toString()).to.equal("2000");
      expect((await program.account.listing.fetch(listing)).active).to.equal(true);
    });

    it("F-27: the on-chain mining kill-switch gates start_mining", async () => {
      const user = Keypair.generate(); await airdrop(user);
      const { mint, tokenAccount } = await mintTool(user.publicKey);
      const vaultToken = await ensureAta(mint, vaultPda);
      await program.methods.stake(new BN(3600)).accounts({
        config: configPda, user: user.publicKey, tool: toolPda(mint), mint,
        userToken: tokenAccount, vault: vaultPda, vaultToken, tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([user]).rpc();
      const sm = () => program.methods.startMining(2).accounts({
        config: configPda, user: user.publicKey, tool: toolPda(mint), mint,
        player: playerPda(user.publicKey),
        vault: vaultPda, vaultToken, systemProgram: SystemProgram.programId,
      }).signers([user]).rpc();
      await program.methods.setMiningEnabled(false).accounts({ config: configPda, authority }).rpc();
      await expectError(sm(), "MiningDisabled");
      await program.methods.setMiningEnabled(true).accounts({ config: configPda, authority }).rpc();
      try {
        await sm();
      } finally {
        await program.methods.setMiningEnabled(false).accounts({ config: configPda, authority }).rpc();
      }
    });

    it("F-29: a craft order must ask for at least one resource", async () => {
      const creator = Keypair.generate(); await airdrop(creator);
      const craftOrder = pda([B("craft_order"), creator.publicKey.toBuffer()]);
      await expectError(
        program.methods.craftOrderCreate(new BN(0), new BN(0), new BN(LAMPORTS_PER_SOL / 100))
          .accounts({ config: configPda, creator: creator.publicKey, craftOrder, systemProgram: SystemProgram.programId })
          .signers([creator]).rpc(),
        "EmptyCraftOrder",
      );
    });
  });
  it("craft recipe: burns/mint match the recipe; failed second burn or cap rolls everything back", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const registry = await program.account.materialMints.fetch(materialMintsPda);
    const gemMint: PublicKey = registry.quantumBit;
    const outputMint: PublicKey = registry.cryoFluid;
    const gems = await giveResource("quantumBit", gemMint, user.publicKey, 5);
    const data = await giveResource("data", dataMint, user.publicKey, 1);
    const output = await ensureAta(outputMint, user.publicKey);
    const accounts = { config: configPda, user: user.publicKey, materialMints: materialMintsPda, auth: authPda,
      input1Mint: gemMint, input1Acc: gems, input2Mint: dataMint, input2Acc: data,
      outputMint, outputAcc: output, tokenProgram: TOKEN_PROGRAM_ID };
    const snapshot = async () => ({
      gems: (await balance(gems)).toString(), data: (await balance(data)).toString(), output: (await balance(output)).toString(),
      gemSupply: (await getMint(provider.connection, gemMint)).supply.toString(),
      dataSupply: (await getMint(provider.connection, dataMint)).supply.toString(),
      outputSupply: (await getMint(provider.connection, outputMint)).supply.toString(),
    });
    const craft = () => program.methods.craftRecipe(3).accounts(accounts).signers([user]).rpc();
    const beforeFailure = await snapshot();
    await expectError(craft(), "InsufficientBalance"); // first CPI burn already ran
    expect(await snapshot()).to.deep.equal(beforeFailure);
    await giveResource("data", dataMint, user.publicKey, 10);
    const funded = await snapshot();
    const supply = new BN(funded.outputSupply);
    await program.methods.setSupplyCap({ cryoFluid: {} }, supply)
      .accounts({ config: configPda, authority, materialMints: materialMintsPda }).rpc();
    try {
      await expectError(craft(), "SupplyCapExceeded"); // both input burns rolled back
      expect(await snapshot()).to.deep.equal(funded);
      await program.methods.setSupplyCap({ cryoFluid: {} }, supply.add(UNIT))
        .accounts({ config: configPda, authority, materialMints: materialMintsPda }).rpc();
      await craft(); // exact cap passes
      const after = await snapshot();
      expect(new BN(funded.gems).sub(new BN(after.gems)).toString()).to.equal(UNIT.muln(2).toString());
      expect(new BN(funded.data).sub(new BN(after.data)).toString()).to.equal(UNIT.muln(5).toString());
      expect(new BN(after.output).sub(new BN(funded.output)).toString()).to.equal(UNIT.toString());
      expect(new BN(funded.gemSupply).sub(new BN(after.gemSupply)).toString()).to.equal(UNIT.muln(2).toString());
      expect(new BN(funded.dataSupply).sub(new BN(after.dataSupply)).toString()).to.equal(UNIT.muln(5).toString());
      expect(new BN(after.outputSupply).sub(new BN(funded.outputSupply)).toString()).to.equal(UNIT.toString());
    } finally {
      await program.methods.setSupplyCap({ cryoFluid: {} }, new BN("18446744073709551615"))
        .accounts({ config: configPda, authority, materialMints: materialMintsPda }).rpc();
    }
  });

  describe("after the 5-minute anti-snipe window", () => {
    it("auction settle with a bid: the winner gets the NFT, the seller and the treasury split the bid", async () => {
      if (!biddedAuction) throw new Error("the auction-with-a-bid test did not open its auction");
      const { seller, bidder, mint, auctionPda, auctionVault, winnerToken, bid } = biddedAuction;
      await waitForChainTime((await program.account.auction.fetch(auctionPda)).endTime.toNumber() + 1, 420_000);
      const auctionLamports = await provider.connection.getBalance(auctionPda);
      const vaultLamports = await provider.connection.getBalance(auctionVault);
      const signature = await program.methods.auctionSettle().accounts({
        config: configPda, mint, auction: auctionPda, seller: seller.publicKey, treasury: authority,
        auctionVault, winnerToken, tool: toolPda(mint), tokenProgram: TOKEN_PROGRAM_ID,
      }).rpc();
      const d = await txDeltas(signature);
      const fee = Math.floor(bid * 400 / 10_000); // AUCTION_FEE_BPS
      expect((await balance(winnerToken)).toString()).to.equal("1");
      expect(await provider.connection.getAccountInfo(auctionPda)).to.equal(null);
      expect(await provider.connection.getAccountInfo(auctionVault)).to.equal(null);
      expect((await program.account.toolData.fetch(toolPda(mint))).owner.toBase58()).to.equal(bidder.publicKey.toBase58());
      // Seller: the bid minus the fee, the escrow ATA rent and the auction's rent (close = seller).
      expect(d(seller.publicKey)).to.equal(auctionLamports - fee + vaultLamports);
      expectFeePayerDelta(d(authority), fee - d.fee); // the treasury is the provider, which pays the fee
    });
  });
});
