import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import * as crypto from "crypto";
import fs from "fs";

const SLOT_HASHES = new PublicKey("SysvarS1otHashes111111111111111111111111111");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("aof-core: security & core flows", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const idlJson = JSON.parse(fs.readFileSync(process.cwd() + "/target/idl/aof_core.json", "utf8"));
  if (!idlJson.address) idlJson.address = "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq";
  const program: any = new anchor.Program(idlJson as any, provider);
  const pid = program.programId as PublicKey;
  const authority = provider.wallet.publicKey;

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

  let setupPayer: Keypair;
  let foodMint: PublicKey, woodMint: PublicKey, stoneMint: PublicKey, potatoMint: PublicKey;
  let seedsMint: PublicKey, wheatMint: PublicKey;
  let flourMint: PublicKey, breadMint: PublicKey, waterMint: PublicKey, coalMint: PublicKey;
  const UNIT = new BN(1_000_000_000); // RESOURCE_UNIT (9 decimals)

  // Admin faucet for resource tokens: mint_resource keeps a treasury fee, so
  // callers ask for `amount` and get amount - fee. Returns the user's ATA.
  async function giveResource(kind: string, mint: PublicKey, user: PublicKey, units: number): Promise<PublicKey> {
    const ata = await ensureAta(mint, user);
    const treasuryAta = await ensureAta(mint, authority);
    await program.methods.mintResource({ [kind]: {} }, UNIT.muln(units)).accounts({
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, mint,
      tokenAccount: ata, treasuryToken: treasuryAta, player: playerPda(user),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).rpc();
    return ata;
  }
  const balance = async (ata: PublicKey) => new BN((await provider.connection.getTokenAccountBalance(ata)).value.amount);

  const airdrop = async (kp: Keypair, sol = 5) =>
    provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL));

  async function ensureAta(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    const ata = getAssociatedTokenAddressSync(mint, owner, true); // allowOwnerOffCurve для PDA
    // Idempotent by construction (check-then-create) instead of swallowing every
    // error: a real failure (funding, wrong owner) must surface, not be hidden.
    if (await provider.connection.getAccountInfo(ata)) return ata;
    await provider.sendAndConfirm(new Transaction().add(
      createAssociatedTokenAccountInstruction(setupPayer.publicKey, ata, owner, mint)), [setupPayer]);
    return ata;
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
      const c = e?.error?.errorCode?.code ?? "";
      if (c === code) return;
      throw new Error(`expected ${code}, got: ${c} | ${e?.message?.slice(0, 120)}`);
    }
    throw new Error(`expected ${code}, but call succeeded`);
  }

  async function mintTool(to: PublicKey, toolType = "axe") {
    const mint = await createMint(provider.connection, setupPayer, authPda, null, 0);
    const tokenAccount = await ensureAta(mint, to);
    await program.methods.mintTool(toolType, { common: {} }).accounts({
      config: configPda, authority, auth: authPda, mint, tokenAccount,
      toolData: toolPda(mint), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).rpc();
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
    foodMint  = await createMint(provider.connection, setupPayer, authPda, null, 9);
    woodMint  = await createMint(provider.connection, setupPayer, authPda, null, 9);
    stoneMint = await createMint(provider.connection, setupPayer, authPda, null, 9);
    potatoMint = await createMint(provider.connection, setupPayer, authPda, null, 9);
    const materialArgs: PublicKey[] = [];
    for (let i = 0; i < 23; i += 1) {
      materialArgs.push(await createMint(provider.connection, setupPayer, authPda, null, 9));
    }
    seedsMint = materialArgs[0];
    wheatMint = materialArgs[1];
    flourMint = materialArgs[2];
    breadMint = materialArgs[3];
    waterMint = materialArgs[4];
    coalMint = materialArgs[5];
    try {
      await (program.methods as any).initMaterialMints(...materialArgs)
        .accounts({ config: configPda, authority, materialMints: materialMintsPda, systemProgram: SystemProgram.programId }).rpc();
      console.log("initMaterialMints: ok");
    } catch (e: any) {
      rethrowUnlessAlreadyInitialised("initMaterialMints", e);
    }
    await program.methods.setResourceMints(
      foodMint, woodMint, stoneMint, materialArgs[0], materialArgs[4], potatoMint,
    ).accounts({ config: configPda, authority }).rpc();
  });

  it("reward receipts: atomic mint, authority/mint checks and permanent replay protection", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const stranger = Keypair.generate(); await airdrop(stranger);
    const userWood = await ensureAta(woodMint, user.publicKey);
    const otherWood = await ensureAta(woodMint, stranger.publicKey);
    const userStone = await ensureAta(stoneMint, user.publicKey);
    const treasuryWood = await ensureAta(woodMint, authority);
    const treasuryStone = await ensureAta(stoneMint, authority);
    const rewardId = Array.from(crypto.randomBytes(32));
    const rewardReceipt = pda([B("reward_receipt"), Buffer.from(rewardId)]);
    const gross = UNIT.muln(2);
    const accounts = {
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda,
      mint: woodMint, tokenAccount: userWood, treasuryToken: treasuryWood, player: playerPda(user.publicKey),
      rewardReceipt, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    };
    await expectError(program.methods.mintResourceOnce({ wood: {} }, gross, rewardId)
      .accounts({ ...accounts, authority: stranger.publicKey }).signers([stranger]).rpc(), "Unauthorized");
    await expectError(program.methods.mintResourceOnce({ wood: {} }, gross, rewardId)
      .accounts({ ...accounts, mint: stoneMint, tokenAccount: userStone, treasuryToken: treasuryStone }).rpc(), "InvalidResourceKind");
    expect(await provider.connection.getAccountInfo(rewardReceipt)).to.equal(null);
    await program.methods.setPaused(true).accounts({ config: configPda, authority }).rpc();
    await expectError(program.methods.mintResourceOnce({ wood: {} }, gross, rewardId).accounts(accounts).rpc(), "Paused");
    await program.methods.setPaused(false).accounts({ config: configPda, authority }).rpc();
    const before = (await balance(userWood)).add(await balance(treasuryWood));
    await program.methods.mintResourceOnce({ wood: {} }, gross, rewardId).accounts(accounts).rpc();
    const receipt = await program.account.rewardReceipt.fetch(rewardReceipt);
    expect(receipt.recipient.toBase58()).to.equal(user.publicKey.toBase58());
    expect(receipt.mint.toBase58()).to.equal(woodMint.toBase58());
    expect(receipt.grossAmount.toString()).to.equal(gross.toString());
    expect((await balance(userWood)).add(await balance(treasuryWood)).sub(before).toString()).to.equal(gross.toString());
    const after = (await balance(userWood)).toString();
    for (const variant of [accounts, { ...accounts, tokenAccount: otherWood, player: playerPda(stranger.publicKey) },
      { ...accounts, mint: stoneMint, tokenAccount: userStone, treasuryToken: treasuryStone }]) {
      let rejected = false;
      try {
        await program.methods.mintResourceOnce({ wood: {} }, gross.addn(1), rewardId).accounts(variant).rpc();
      } catch (error: any) {
        const log = `${error.message} ${(error.logs || []).join(" ")}`;
        expect(log).to.match(/already in use|already initialized|custom program error: 0x0/i);
        rejected = true;
      }
      expect(rejected).to.equal(true);
    }
    expect((await balance(userWood)).toString()).to.equal(after);
    // Two different signed messages for one logical reward: exactly one mint.
    const concurrentId = Array.from(crypto.randomBytes(32));
    const concurrentReceipt = pda([B("reward_receipt"), Buffer.from(concurrentId)]);
    const results = await Promise.allSettled([gross, gross.addn(1)].map((amount) =>
      program.methods.mintResourceOnce({ wood: {} }, amount, concurrentId)
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
    const price = new BN(1_000_000);
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
    await expectError(provider.sendAndConfirm(new Transaction().add(legacy), [buyer]).catch((error: any) => { throw anchor.AnchorError.parse(error.logs || []) || error; }), "InstructionDidNotDeserialize");
    await expectError(program.methods.marketplaceBuy().accounts(accounts).signers([buyer]).rpc(), "FeatureDisabled");
    expect(await provider.connection.getBalance(buyer.publicKey)).to.equal(before);
    expect((await balance(buyerToken)).toNumber()).to.equal(0);
    await program.methods.marketplaceBuyBounded(price, deadline).accounts(accounts).signers([buyer]).rpc();
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
    const ata = await giveResource("wood", woodMint, user.publicKey, 1);
    const treasAta = await ensureAta(woodMint, authority);
    const userBefore = await balance(ata);
    const treasuryBefore = await balance(treasAta);
    const supplyBefore = new BN((await provider.connection.getTokenSupply(woodMint)).value.amount);
    expect(userBefore.gtn(0)).to.equal(true);
    expect(treasuryBefore.gtn(0)).to.equal(true);
    const gross = new BN(10_000);
    await program.methods.mintResource({ wood: {} }, gross).accounts({
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, mint: woodMint,
      tokenAccount: ata, treasuryToken: treasAta, player: playerPda(user.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).rpc();
    const userDelta = (await balance(ata)).sub(userBefore);
    const treasuryDelta = (await balance(treasAta)).sub(treasuryBefore);
    const supplyDelta = new BN((await provider.connection.getTokenSupply(woodMint)).value.amount).sub(supplyBefore);
    expect(userDelta.add(treasuryDelta).eq(gross)).to.equal(true, "user + treasury deltas must equal gross mint");
    expect(supplyDelta.eq(gross)).to.equal(true, "total supply must increase by exactly the gross amount");
    expect(treasuryDelta.gten(700) && treasuryDelta.lten(1000)).to.equal(true, "base fee must remain 7–10%");
  });

  it("withdraw_gas: кулдаун взводится после вывода (H1)", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const acc = { config: configPda, user: user.publicKey, gastank: gastankPda(user.publicKey), systemProgram: SystemProgram.programId };
    await program.methods.depositGas(new BN(1_000_000_000)).accounts(acc).signers([user]).rpc();
    await program.methods.withdrawGas(new BN(100_000)).accounts(acc).signers([user]).rpc();
    await expectError(program.methods.withdrawGas(new BN(100_000)).accounts(acc).signers([user]).rpc(), "CooldownNotExpired");
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
      player: playerPda(user.publicKey), systemProgram: SystemProgram.programId }).signers([user]).rpc();
    await expectError(sm(9), "HoursExceedRarityCap");
    await sm(2);
    const pl = await program.account.player.fetch(playerPda(user.publicKey));
    expect(pl.villagersAvailable).to.equal(5);

    // The collect path must validate completion before minting or clearing
    // mining state. This is the pre-completion half of the atomic settlement
    // regression; a full payout assertion requires advancing validator time.
    const payoutToken = await ensureAta(woodMint, user.publicKey);
    await expectError(program.methods.collectMining().accounts({
      config: configPda,
      user: user.publicKey,
      tool: toolPda(mint),
      mint,
      player: playerPda(user.publicKey),
      materialMints: materialMintsPda,
      auth: authPda,
      payoutMint: woodMint,
      payoutToken,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([user]).rpc(), "MiningNotComplete");
    const stillMining = await program.account.toolData.fetch(toolPda(mint));
    expect(stillMining.isMining).to.equal(true);
  });

  it("harvest wheat: rental operator is accepted and owner is rejected", async () => {
    const owner = Keypair.generate(); await airdrop(owner);
    const renter = Keypair.generate(); await airdrop(renter);
    const { mint, tokenAccount } = await mintTool(owner.publicKey, "Reaper");
    const ownerSeeds = await ensureAta(seedsMint, owner.publicKey);
    const ownerSeedsTreasury = await ensureAta(seedsMint, authority);
    await program.methods.mintResource({ seeds: {} }, new BN(10_000_000_000)).accounts({
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, mint: seedsMint,
      tokenAccount: ownerSeeds, treasuryToken: ownerSeedsTreasury, player: playerPda(owner.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).rpc();
    const ownerTile = pda([B("farm_tile"), owner.publicKey.toBuffer(), Buffer.from([0])]);
    // plant_seeds(tile_index: u8, amount: u64). Passing only the amount made
    // Anchor treat it as tile_index and the account map as `amount`, which
    // surfaced as "Account `config` not provided" (tests/aof_core.ts:210).
    await program.methods.plantSeeds(0, new BN(1_000_000_000)).accounts({
      config: configPda, user: owner.publicKey, materialMints: materialMintsPda,
      energyAccount: pda([B("energy_account"), owner.publicKey.toBuffer()]), farmTile: ownerTile,
      seedsMint, userSeeds: ownerSeeds, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([owner]).rpc();

    const rentalListing = pda([B("rental_listing"), mint.toBuffer()]);
    await program.methods.rentalList(10_000, new BN(24 * 3600), new BN(24 * 3600), new BN(0)).accounts({
      config: configPda, owner: owner.publicKey, mint, tool: toolPda(mint), rentalListing,
      systemProgram: SystemProgram.programId,
    }).signers([owner]).rpc();
    const rentalAgreement = pda([B("rental_agreement"), mint.toBuffer()]);
    await program.methods.rentalStart(new BN(24 * 3600)).accounts({
      config: configPda, renter: renter.publicKey, mint, tool: toolPda(mint), rentalListing,
      owner: owner.publicKey, treasury: authority, rentalAgreement, systemProgram: SystemProgram.programId,
    }).signers([renter]).rpc();

    const ownerWheat = await ensureAta(wheatMint, owner.publicKey);
    await expectError(program.methods.harvestWheat(0).accounts({
      config: configPda, user: owner.publicKey, materialMints: materialMintsPda,
      energyAccount: pda([B("energy_account"), owner.publicKey.toBuffer()]), farmTile: ownerTile,
      toolData: toolPda(mint), auth: authPda, wheatMint, userWheat: ownerWheat,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([owner]).rpc(), "NotToolOperator");

    const renterSeeds = await ensureAta(seedsMint, renter.publicKey);
    await program.methods.mintResource({ seeds: {} }, new BN(10_000_000_000)).accounts({
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, mint: seedsMint,
      tokenAccount: renterSeeds, treasuryToken: ownerSeedsTreasury, player: playerPda(renter.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).rpc();
    const renterTile = pda([B("farm_tile"), renter.publicKey.toBuffer(), Buffer.from([0])]);
    await program.methods.plantSeeds(0, new BN(1_000_000_000)).accounts({
      config: configPda, user: renter.publicKey, materialMints: materialMintsPda,
      energyAccount: pda([B("energy_account"), renter.publicKey.toBuffer()]), farmTile: renterTile,
      seedsMint, userSeeds: renterSeeds, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([renter]).rpc();
    const renterWheat = await ensureAta(wheatMint, renter.publicKey);
    await expectError(program.methods.harvestWheat(0).accounts({
      config: configPda, user: renter.publicKey, materialMints: materialMintsPda,
      energyAccount: pda([B("energy_account"), renter.publicKey.toBuffer()]), farmTile: renterTile,
      toolData: toolPda(mint), auth: authPda, wheatMint, userWheat: renterWheat,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([renter]).rpc(), "FarmTileNotReady");
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
    await bid(b1, 10_000_000);
    const before = await provider.connection.getBalance(b1.publicKey);
    await bid(b2, 20_000_000);
    const after = await provider.connection.getBalance(b1.publicKey);
    expect(after - before).to.be.within(9_990_000, 10_000_000);
  });

  it("orderbook: полное сведение не ломает rent (C2)", async () => {
    const buyer = Keypair.generate(); await airdrop(buyer);
    const seller = Keypair.generate(); await airdrop(seller);
    const sellerWood = await ensureAta(woodMint, seller.publicKey);
    const treasAta = await ensureAta(woodMint, authority);
    await program.methods.mintResource({ wood: {} }, new BN(1_000)).accounts({
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, mint: woodMint, tokenAccount: sellerWood,
      treasuryToken: treasAta, player: playerPda(seller.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).rpc();
    const buyerWood = await ensureAta(woodMint, buyer.publicKey);
    const price = 1_000, amount = 100;
    const buyOrder = pda([B("resource_order"), buyer.publicKey.toBuffer(), woodMint.toBuffer()]);
    await program.methods.placeBuyOrder(1, new BN(price), new BN(amount)).accounts({
      config: configPda, maker: buyer.publicKey, mint: woodMint, materialMints: materialMintsPda, order: buyOrder,
      systemProgram: SystemProgram.programId }).signers([buyer]).rpc();
    const sellOrder = pda([B("resource_order"), seller.publicKey.toBuffer(), woodMint.toBuffer()]);
    const orderVault = await ensureAta(woodMint, sellOrder);
    await program.methods.placeSellOrder(1, new BN(price), new BN(amount)).accounts({
      config: configPda, maker: seller.publicKey, mint: woodMint, materialMints: materialMintsPda, makerToken: sellerWood,
      order: sellOrder, orderVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId
    }).signers([seller]).rpc();
    const matchAccounts = {
      config: configPda, materialMints: materialMintsPda, mint: woodMint, buyOrder, sellOrder, seller: seller.publicKey,
      treasury: authority, sellVault: orderVault, buyerToken: buyerWood, tokenProgram: TOKEN_PROGRAM_ID,
    };
    await program.methods.setPaused(true).accounts({ config: configPda, authority }).rpc();
    await expectError(program.methods.matchResourceOrders().accounts(matchAccounts).rpc(), "Paused");
    await program.methods.setPaused(false).accounts({ config: configPda, authority }).rpc();
    await program.methods.matchResourceOrders().accounts(matchAccounts).rpc();
    const bal = (await provider.connection.getTokenAccountBalance(buyerWood)).value.amount;
    expect(bal).to.equal("100");
  });

  it("new pack commitments reject unsafe randomness without charging the user", async () => {
    // New payments must fail atomically, including rent paid by init.
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
    const mint = await createMint(provider.connection, setupPayer, authPda, null, 0);
    const secret = crypto.randomBytes(32);
    const commitHash = crypto.createHash("sha256").update(secret).digest();
    const packCommit = pda([B("pack_commit"), mint.toBuffer()]);
    const before = await provider.connection.getBalance(user.publicKey);
    await expectError(program.methods.packOpenCommit({ small: {} }, Array.from(commitHash)).accounts({
      config: configPda, authority, user: user.publicKey,
      packConfig, auth: authPda, mint, packCommit,
      systemProgram: SystemProgram.programId }).signers([user]).rpc(), "FeatureDisabled");
    expect(await provider.connection.getBalance(user.publicKey)).to.equal(before);
    expect(await provider.connection.getAccountInfo(packCommit)).to.equal(null);
  });

  it("new forge commitments reject selective-abort randomness and roll back resource burns", async () => {
    // Regression: even a fully funded user cannot create an unsafe commitment.
    // Legacy design: the SOL fee is escrowed on the ForgeCommit PDA and
    // the burned wood/stone amounts are recorded so forge_attempt_expire can
    // re-mint them after the reveal window. Level-0 attempt: 200 wood + 200
    // stone + 33_000_000 lamports (+ 20_000_000 with the protector).
    const user = Keypair.generate(); await airdrop(user);
    const { mint: toolMint } = await mintTool(user.publicKey, "pickaxe");
    const userWood = await giveResource("wood", woodMint, user.publicKey, 1000);
    const userStone = await giveResource("stone", stoneMint, user.publicKey, 1000);
    const woodBefore = await balance(userWood);
    const stoneBefore = await balance(userStone);
    const treasuryBefore = await provider.connection.getBalance(authority);
    const secret = crypto.randomBytes(32);
    const commitHash = crypto.createHash("sha256").update(secret).digest();
    const slotType = 0;
    const enchantSlot = pda([B("enchant_slot"), toolMint.toBuffer(), Buffer.from([slotType])]);
    const forgeCommit = pda([B("forge_commit"), toolMint.toBuffer(), Buffer.from([slotType])]);
    await expectError(program.methods.forgeAttemptCommit(slotType, Array.from(commitHash), true).accounts({
      config: configPda, user: user.publicKey, tool: toolPda(toolMint), toolMint, enchantSlot, forgeCommit,
      woodMint, userWood, stoneMint, userStone,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).signers([user]).rpc(), "FeatureDisabled");
    expect((await balance(userWood)).toString()).to.equal(woodBefore.toString());
    expect((await balance(userStone)).toString()).to.equal(stoneBefore.toString());
    expect(await provider.connection.getAccountInfo(forgeCommit)).to.equal(null);
  });

  it("disabled commit-reveal mechanics stay fail-closed: reroll_random_commit", async () => {
    // Same fail-closed policy as packs (reroll_random.rs burns the tool before
    // reveal and has no refund path). The guard runs before any state change,
    // so it must trigger even with a freshly minted tool and empty gastank.
    const user = Keypair.generate(); await airdrop(user);
    const { mint: burnMint, tokenAccount: burnToken } = await mintTool(user.publicKey);
    const gAcc = { config: configPda, user: user.publicKey, gastank: gastankPda(user.publicKey), systemProgram: SystemProgram.programId };
    await program.methods.depositGas(new BN(100_000_000)).accounts(gAcc).signers([user]).rpc();
    const newMint = await createMint(provider.connection, setupPayer, authPda, null, 0);
    const commitHash = crypto.createHash("sha256").update(crypto.randomBytes(32)).digest();
    await expectError((program.methods as any).rerollRandomCommit(Array.from(commitHash)).accounts({
      config: configPda, user: user.publicKey, gastank: gastankPda(user.publicKey),
      burnTool: toolPda(burnMint), burnMint, burnToken, newMint,
      rerollCommit: pda([B("reroll_commit"), newMint.toBuffer()]),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([user]).rpc(), "FeatureDisabled");
    const td = await program.account.toolData.fetch(toolPda(burnMint));
    expect(td.owner.toString()).to.equal(user.publicKey.toString());
  });

  it("start_milling: burns wheat+stone from writable mints, arms the mill, blocks re-start and early collect", async () => {
    // Regression for the read-only-mint bug: StartMilling.wheat_mint /
    // stone_mint were declared without `mut`, so token::burn failed with
    // "writable privilege escalated" and milling never worked on-chain.
    const user = Keypair.generate(); await airdrop(user);
    const userWheat = await giveResource("wheat", wheatMint, user.publicKey, 100);
    const userStone = await giveResource("stone", stoneMint, user.publicKey, 100);
    const wheatBefore = await balance(userWheat);
    const stoneBefore = await balance(userStone);
    const supplyBefore = new BN((await provider.connection.getTokenSupply(wheatMint)).value.amount);
    const millState = pda([B("mill_state"), user.publicKey.toBuffer()]);
    const acc = {
      config: configPda, user: user.publicKey, materialMints: materialMintsPda,
      energyAccount: pda([B("energy_account"), user.publicKey.toBuffer()]), millState,
      wheatMint, stoneMint, userWheat, userStone,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    };
    await program.methods.startMilling(1).accounts(acc).signers([user]).rpc();
    // batch 1 recipe: 6 wheat + 1 stone (start_milling.rs MILL_*_COST[0])
    expect(wheatBefore.sub(await balance(userWheat)).toString()).to.equal(UNIT.muln(6).toString());
    expect(stoneBefore.sub(await balance(userStone)).toString()).to.equal(UNIT.muln(1).toString());
    const supplyAfter = new BN((await provider.connection.getTokenSupply(wheatMint)).value.amount);
    expect(supplyBefore.sub(supplyAfter).toString()).to.equal(UNIT.muln(6).toString());
    const mill = await program.account.millState.fetch(millState);
    expect(mill.owner.toString()).to.equal(user.publicKey.toString());
    expect(mill.inProgress).to.equal(true);
    expect(mill.outputFlour.toString()).to.equal(UNIT.muln(3).toString());
    // A second batch while one is running is rejected and burns nothing.
    await expectError(program.methods.startMilling(2).accounts(acc).signers([user]).rpc(), "MillInProgress");
    expect(wheatBefore.sub(await balance(userWheat)).toString()).to.equal(UNIT.muln(6).toString());
    // Collecting before ready_at (1h) is rejected.
    const userFlour = await ensureAta(flourMint, user.publicKey);
    await expectError(program.methods.collectFlour().accounts({
      config: configPda, user: user.publicKey, materialMints: materialMintsPda, millState,
      auth: authPda, flourMint, userFlour, tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([user]).rpc(), "MillNotReady");
    expect((await balance(userFlour)).toString()).to.equal("0");
  });

  it("start_baking: burns flour+water+fuel from writable mints for both fuel kinds, blocks early collect", async () => {
    // Same regression class as milling: flour/water/wood/coal mints in
    // StartBaking lacked `mut`. Covers fuel_kind 0 (wood) and 1 (coal) with
    // two separate users because an oven can only run one batch at a time.
    for (const fuelKind of [0, 1] as const) {
      const user = Keypair.generate(); await airdrop(user);
      const userFlour = await giveResource("flour", flourMint, user.publicKey, 100);
      const userWater = await giveResource("water", waterMint, user.publicKey, 100);
      const userWood = await giveResource("wood", woodMint, user.publicKey, 100);
      const userCoal = await giveResource("coal", coalMint, user.publicKey, 100);
      const before = { flour: await balance(userFlour), water: await balance(userWater), wood: await balance(userWood), coal: await balance(userCoal) };
      const ovenState = pda([B("oven_state"), user.publicKey.toBuffer()]);
      const acc = {
        config: configPda, user: user.publicKey, materialMints: materialMintsPda,
        energyAccount: pda([B("energy_account"), user.publicKey.toBuffer()]), ovenState,
        flourMint, waterMint, woodMint, coalMint, userFlour, userWater, userWood, userCoal,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      };
      await program.methods.startBaking(1, fuelKind).accounts(acc).signers([user]).rpc();
      // batch 1 recipe: 4 flour + 3 water + (5 wood | 2 coal) (start_baking.rs OVEN_*_COST[0])
      expect(before.flour.sub(await balance(userFlour)).toString()).to.equal(UNIT.muln(4).toString(), `flour fuel=${fuelKind}`);
      expect(before.water.sub(await balance(userWater)).toString()).to.equal(UNIT.muln(3).toString(), `water fuel=${fuelKind}`);
      expect(before.wood.sub(await balance(userWood)).toString()).to.equal(UNIT.muln(fuelKind === 0 ? 5 : 0).toString(), `wood fuel=${fuelKind}`);
      expect(before.coal.sub(await balance(userCoal)).toString()).to.equal(UNIT.muln(fuelKind === 1 ? 2 : 0).toString(), `coal fuel=${fuelKind}`);
      const oven = await program.account.ovenState.fetch(ovenState);
      expect(oven.inProgress).to.equal(true);
      expect(oven.fuelKind).to.equal(fuelKind);
      expect(oven.outputBread.toString()).to.equal(UNIT.muln(fuelKind === 0 ? 2 : 3).toString());
      await expectError(program.methods.startBaking(1, fuelKind).accounts(acc).signers([user]).rpc(), "OvenInProgress");
      const userBread = await ensureAta(breadMint, user.publicKey);
      await expectError(program.methods.collectBread().accounts({
        config: configPda, user: user.publicKey, materialMints: materialMintsPda, ovenState,
        auth: authPda, breadMint: breadMint, userBread, tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([user]).rpc(), "OvenNotReady");
      expect((await balance(userBread)).toString()).to.equal("0");
    }
  });
});
