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
  if (!idlJson.address) idlJson.address = "2dQsHg3oVKwyKHjemS2CbWkczv6sCRAY5r2WrGBv4vgC";
  const program: any = new anchor.Program(idlJson as any, provider);
  const pid = program.programId as PublicKey;
  const authority = provider.wallet.publicKey;

  const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, pid)[0];
  const B = (s: string) => Buffer.from(s);
  const configPda = pda([B("config")]);
  const authPda = pda([B("auth")]);
  const vaultPda = pda([B("vault")]);
  const toolPda = (m: PublicKey) => pda([B("tool"), m.toBuffer()]);
  const playerPda = (u: PublicKey) => pda([B("player"), u.toBuffer()]);
  const gastankPda = (u: PublicKey) => pda([B("gastank"), u.toBuffer()]);

  let setupPayer: Keypair;
  let foodMint: PublicKey, woodMint: PublicKey, stoneMint: PublicKey;

  const airdrop = async (kp: Keypair, sol = 5) =>
    provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL));

  async function ensureAta(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    const ata = getAssociatedTokenAddressSync(mint, owner, true); // allowOwnerOffCurve для PDA
    try {
      await provider.sendAndConfirm(new Transaction().add(
        createAssociatedTokenAccountInstruction(setupPayer.publicKey, ata, owner, mint)), [setupPayer]);
    } catch (e) {}
    return ata;
  }

  async function expectError(p: Promise<any>, code: string) {
    try { await p; } catch (e: any) {
      const c = e?.error?.errorCode?.code ?? "";
      if (c === code) return;
      throw new Error(`expected ${code}, got: ${c} | ${e?.message?.slice(0, 120)}`);
    }
    throw new Error(`expected ${code}, but call succeeded`);
  }

  async function mintTool(to: PublicKey) {
    const mint = await createMint(provider.connection, setupPayer, authPda, null, 0);
    const tokenAccount = await ensureAta(mint, to);
    await program.methods.mintTool("axe", { common: {} }).accounts({
      config: configPda, authority, auth: authPda, mint, tokenAccount,
      toolData: toolPda(mint), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).rpc();
    return { mint, tokenAccount };
  }

  before(async () => {
    setupPayer = Keypair.generate();
    await airdrop(setupPayer, 100);
    try {
      await program.methods.initialize().accounts({
        config: configPda, authority, auth: authPda, vault: vaultPda,
        systemProgram: SystemProgram.programId }).rpc();
    } catch (e) {}
    foodMint  = await createMint(provider.connection, setupPayer, authPda, null, 0);
    woodMint  = await createMint(provider.connection, setupPayer, authPda, null, 0);
    stoneMint = await createMint(provider.connection, setupPayer, authPda, null, 0);
    await program.methods.setResourceMints(foodMint, woodMint, stoneMint)
      .accounts({ config: configPda, authority }).rpc();
  });

  it("initialize is singleton (повторный вызов падает)", async () => {
    let threw = false;
    try {
      await program.methods.initialize().accounts({
        config: configPda, authority, auth: authPda, vault: vaultPda,
        systemProgram: SystemProgram.programId }).rpc();
    } catch (e) { threw = true; }
    expect(threw).to.be.true;
  });

  it("mint_resource: комиссия в казну, user+fee == amount", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const ata = await ensureAta(woodMint, user.publicKey);
    const treasAta = await ensureAta(woodMint, authority);
    await program.methods.mintResource({ wood: {} }, new BN(10_000)).accounts({
      config: configPda, authority, auth: authPda, mint: woodMint,
      tokenAccount: ata, treasuryToken: treasAta, player: playerPda(user.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).rpc();
    const u = (await provider.connection.getTokenAccountBalance(ata)).value.uiAmount!;
    const t = (await provider.connection.getTokenAccountBalance(treasAta)).value.uiAmount!;
    expect(u + t).to.equal(10_000);
    expect(t).to.be.within(700, 1000); // база 7–10%
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
    const { mint } = await mintTool(user.publicKey);
    const sm = (h: number) => program.methods.startMining(h).accounts({
      config: configPda, user: user.publicKey, tool: toolPda(mint), mint,
      player: playerPda(user.publicKey), systemProgram: SystemProgram.programId }).signers([user]).rpc();
    await expectError(sm(9), "HoursExceedRarityCap");
    await sm(2);
    const pl = await program.account.player.fetch(playerPda(user.publicKey));
    expect(pl.villagersAvailable).to.equal(5);
  });

  it("auction settle: чужой winner_token отклоняется (C1)", async () => {
    const seller = Keypair.generate(); await airdrop(seller);
    const { mint, tokenAccount } = await mintTool(seller.publicKey);
    const auctionPda = pda([B("auction"), mint.toBuffer()]);
    const auctionVault = await ensureAta(mint, auctionPda);
    await program.methods.auctionCreate(new BN(1_000_000), new BN(2)).accounts({
      config: configPda, seller: seller.publicKey, mint, sellerToken: tokenAccount,
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
      config: configPda, seller: seller.publicKey, mint, sellerToken: tokenAccount,
      auction: auctionPda, auctionVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId
    }).signers([seller]).rpc();
    const b1 = Keypair.generate(); await airdrop(b1);
    const b2 = Keypair.generate(); await airdrop(b2);
    // храним текущего биддера локально — это previous_bidder для следующей ставки
    let currentBidder: PublicKey = PublicKey.default;
    const bid = async (bidder: Keypair, amt: number) => {
      const prev = currentBidder.equals(PublicKey.default)
        ? SystemProgram.programId
        : currentBidder;
      await program.methods.auctionBid(new BN(amt)).accounts({
        bidder: bidder.publicKey, mint, auction: auctionPda,
        previousBidder: prev, systemProgram: SystemProgram.programId
      }).signers([bidder]).rpc();
      currentBidder = bidder.publicKey;
    };
    // первая ставка: previous_bidder = system program (current_bidder = default)
    await program.methods.auctionBid(new BN(10_000_000)).accounts({
      bidder: b1.publicKey, mint, auction: auctionPda,
      previousBidder: SystemProgram.programId, systemProgram: SystemProgram.programId }).signers([b1]).rpc();
    currentBidder = b1.publicKey;  // обновляем после первой ставки
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
      config: configPda, authority, auth: authPda, mint: woodMint, tokenAccount: sellerWood,
      treasuryToken: treasAta, player: playerPda(seller.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).rpc();
    const buyerWood = await ensureAta(woodMint, buyer.publicKey);
    const price = 1_000, amount = 100;
    const buyOrder = pda([B("resource_order"), buyer.publicKey.toBuffer(), woodMint.toBuffer()]);
    await program.methods.placeBuyOrder(1, new BN(price), new BN(amount)).accounts({
      config: configPda, maker: buyer.publicKey, mint: woodMint, order: buyOrder,
      systemProgram: SystemProgram.programId }).signers([buyer]).rpc();
    const sellOrder = pda([B("resource_order"), seller.publicKey.toBuffer(), woodMint.toBuffer()]);
    const orderVault = await ensureAta(woodMint, sellOrder);
    await program.methods.placeSellOrder(1, new BN(price), new BN(amount)).accounts({
      config: configPda, maker: seller.publicKey, mint: woodMint, makerToken: sellerWood,
      order: sellOrder, orderVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId
    }).signers([seller]).rpc();
    await program.methods.matchResourceOrders().accounts({
      config: configPda, mint: woodMint, buyOrder, sellOrder, seller: seller.publicKey,
      treasury: authority, sellVault: orderVault, buyerToken: buyerWood, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
    const bal = (await provider.connection.getTokenAccountBalance(buyerWood)).value.uiAmount!;
    expect(bal).to.equal(100);
  });

  it("pack commit-reveal: инструмент минтится игроку", async () => {
    const packConfig = pda([B("pack_config"), Buffer.from([0])]);
    try {
      await program.methods.initPackConfig(0, new BN(100_000_000), [6000, 3200, 700, 100, 0])
        .accounts({ config: configPda, authority, packConfig, systemProgram: SystemProgram.programId }).rpc();
    } catch (e) {}
    const user = Keypair.generate(); await airdrop(user);
    const mint = await createMint(provider.connection, setupPayer, authPda, null, 0);
    const userToken = await ensureAta(mint, user.publicKey);
    const secret = crypto.randomBytes(32);
    const commitHash = crypto.createHash("sha256").update(secret).digest();
    await program.methods.packOpenCommit({ small: {} }, Array.from(commitHash)).accounts({
      config: configPda, authority, user: user.publicKey, treasury: authority,
      packConfig, mint, packCommit: pda([B("pack_commit"), mint.toBuffer()]),
      systemProgram: SystemProgram.programId }).signers([user]).rpc();
    await sleep(1500);
    await program.methods.packOpenReveal(Array.from(secret)).accounts({
      config: configPda, authority, packCommit: pda([B("pack_commit"), mint.toBuffer()]),
      user: user.publicKey, packConfig, mint, userToken, toolData: toolPda(mint),
      auth: authPda, slotHashes: SLOT_HASHES, tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId }).rpc();
    const td = await program.account.toolData.fetch(toolPda(mint));
    expect(td.owner.toString()).to.equal(user.publicKey.toString());
    expect(Object.keys(td.rarity)[0]).to.be.oneOf(["common", "uncommon", "rare", "epic"]);
  });
});
