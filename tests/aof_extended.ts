/**
 * NeuroForge (ex-AOF) — extended integration tests (local validator).
 * Referral, rental, collectors, season, lottery, craft orders, burn, repair,
 * gas tank and marketplace paths, each with strict assertions on balances,
 * account state and Anchor error codes. Runs after tests/aof_core.ts, whose
 * before() hook initialises Config, the resource mints and the issuance caps.
 * Run with: anchor test --skip-build
 */
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import {
  createMint, getMint, mintTo, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction,
  createAccount as createTokenAccount, TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";
import fs from "fs";

const SLOT_HASHES = new PublicKey("SysvarS1otHashes111111111111111111111111111");

describe("aof-extended: rental, referral, collectors, season, lottery, craft orders", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const idlJson = JSON.parse(fs.readFileSync(process.cwd() + "/target/idl/aof_core.json", "utf8"));
  if (!idlJson.address) idlJson.address = "okiLaCvFyHqFRFf359emmunPKD77uUmLQ2iJWskZdnx";
  const program: any = new anchor.Program(idlJson as any, provider);
  const pid = program.programId as PublicKey;
  const authority = provider.wallet.publicKey;

  const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, pid)[0];
  const B = (s: string) => Buffer.from(s);
  const configPda = pda([B("config")]);
  const authPda = pda([B("auth")]);
  const vaultPda = pda([B("vault")]);
  const materialMintsPda = pda([B("material_mints")]);
  const toolPda = (m: PublicKey) => pda([B("tool"), m.toBuffer()]);
  const playerPda = (u: PublicKey) => pda([B("player"), u.toBuffer()]);
  const gastankPda = (u: PublicKey) => pda([B("gastank"), u.toBuffer()]);
  const UNIT = new BN(1_000_000_000); // RESOURCE_UNIT (9 decimals)

  let setupPayer: Keypair;
  let circuitMint: PublicKey, siliconMint: PublicKey, dataMint: PublicKey;

  // ResourceKind variants in enum order (seed = variant index), lowerCamel for
  // Anchor's JS enum encoding, from the IDL the suite runs against.
  const RESOURCE_KINDS: string[] = (idlJson.types.find((t: any) => t.name === "ResourceKind").type.variants as any[])
    .map((v: any) => v.name[0].toLowerCase() + v.name.slice(1));
  const issuanceCapPda = (kind: string) => {
    const idx = RESOURCE_KINDS.indexOf(kind);
    if (idx < 0) throw new Error(`unknown kind ${kind}`);
    return pda([B("issuance_cap"), Buffer.from([idx])]);
  };

  async function airdrop(kp: Keypair, sol = 5) {
    const sig = await provider.connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);
  }

  async function ensureAta(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    const ata = getAssociatedTokenAddressSync(mint, owner, true);
    if (await provider.connection.getAccountInfo(ata)) return ata;
    const tx = new Transaction().add(createAssociatedTokenAccountInstruction(setupPayer.publicKey, ata, owner, mint));
    tx.feePayer = setupPayer.publicKey;
    await provider.sendAndConfirm(tx, [setupPayer], { commitment: "confirmed", preflightCommitment: "confirmed" });
    return ata;
  }

  async function sendWithPayer(builder: any, payer: Keypair) {
    const tx = await builder.transaction();
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = (await provider.connection.getLatestBlockhash("confirmed")).blockhash;
    return provider.sendAndConfirm(tx, [payer], { commitment: "confirmed", preflightCommitment: "confirmed" });
  }

  async function sendWithExplicitSigners(builder: any, payer: Keypair, signers: Keypair[]) {
    const tx = await builder.transaction();
    tx.feePayer = payer.publicKey;
    const lifetime = await provider.connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = lifetime.blockhash;
    tx.partialSign(...signers);
    const signature = await provider.connection.sendRawTransaction(tx.serialize(), { preflightCommitment: "confirmed" });
    await provider.connection.confirmTransaction({ ...lifetime, signature }, "confirmed");
    return signature;
  }

  async function sendPlayerClaim(builder: any, payer: Keypair) {
    const tx = await builder.transaction();
    tx.feePayer = payer.publicKey;
    const lifetime = await provider.connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = lifetime.blockhash;
    tx.partialSign(payer);
    const message = tx.compileMessage();
    const required = message.accountKeys.slice(0, message.header.numRequiredSignatures);
    if (required.some((key: PublicKey) => key.equals(provider.wallet.publicKey))) {
      const signed = await provider.wallet.signTransaction(tx);
      const signature = await provider.connection.sendRawTransaction(signed.serialize(), { preflightCommitment: "confirmed" });
      await provider.connection.confirmTransaction({ ...lifetime, signature }, "confirmed");
      return signature;
    }
    const signature = await provider.connection.sendRawTransaction(tx.serialize(), { preflightCommitment: "confirmed" });
    await provider.connection.confirmTransaction({ ...lifetime, signature }, "confirmed");
    return signature;
  }

  async function airdropLamports(kp: Keypair, lamports: number) {
    const signature = await provider.connection.requestAirdrop(kp.publicKey, lamports);
    await provider.connection.confirmTransaction(signature, "confirmed");
  }

  // Admin faucet (mint_resource keeps a 7–10% treasury fee, so the user gets
  // a bit less than `units`). Also creates the user's Player PDA.
  async function giveResource(kind: string, mint: PublicKey, user: PublicKey, units: number): Promise<PublicKey> {
    const ata = await ensureAta(mint, user);
    await program.methods.mintResource({ [kind]: {} }, UNIT.muln(units)).accounts({
      config: configPda, materialMints: materialMintsPda, authority, auth: authPda, issuanceCap: issuanceCapPda(kind), mint,
      tokenAccount: ata, treasuryToken: await ensureAta(mint, authority), player: playerPda(user),
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).rpc();
    return ata;
  }

  async function mintTool(to: PublicKey, toolType = "plasma_cutter") {
    const mint = await createMint(provider.connection, setupPayer, authPda, null, 0);
    const tokenAccount = await ensureAta(mint, to);
    await sendWithPayer(program.methods.mintTool(toolType, { common: {} }).accounts({
      config: configPda, authority, auth: authPda, mint, tokenAccount, recipient: to,
      payer: setupPayer.publicKey, toolData: toolPda(mint), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }), setupPayer);
    return { mint, tokenAccount };
  }

  const balance = async (ata: PublicKey) => new BN((await provider.connection.getTokenAccountBalance(ata)).value.amount);
  const lamports = (key: PublicKey) => provider.connection.getBalance(key);

  // Without `code`, any failure passes (e.g. an `init` on an existing PDA,
  // which fails in the System Program, not with an Anchor code).
  async function expectError(p: Promise<any>, code?: string) {
    try { await p; } catch (e: any) {
      const c = e?.error?.errorCode?.code ?? "";
      if (code && c !== code) throw new Error(`expected ${code}, got: ${c || "?"} | ${e?.message?.slice(0, 200)}`);
      return;
    }
    throw new Error(`expected error ${code ?? ""}, but call succeeded`);
  }

  before(async () => {
    setupPayer = Keypair.generate();
    await airdrop(setupPayer, 20);
    const cfg = await program.account.config.fetch(configPda);
    dataMint = cfg.dataMint;
    circuitMint = cfg.circuitMint;
    siliconMint = cfg.siliconMint;
    expect(circuitMint && !circuitMint.equals(PublicKey.default), "aof_core.ts must set the resource mints first").to.equal(true);
  });

  // ========== REFERRAL ==========
  it("referral: bind needs a registered referrer, rejects self and re-binds; upgrade burns the tier cost", async () => {
    const referrer = Keypair.generate(); await airdrop(referrer);
    const referred = Keypair.generate(); await airdrop(referred);
    const linkOf = (k: Keypair) => pda([B("referral_link"), k.publicKey.toBuffer()]);
    const statsOf = (k: Keypair) => pda([B("referrer_stats"), k.publicKey.toBuffer()]);
    const bind = (ref: Keypair, who: Keypair) => program.methods.referralBind().accounts({
      config: configPda, referred: who.publicKey, referrer: ref.publicKey, referrerPlayer: playerPda(ref.publicKey),
      referrerStats: statsOf(ref), referralLink: linkOf(who), systemProgram: SystemProgram.programId,
    }).signers([who]).rpc();

    await expectError(bind(referrer, referred), "AccountNotInitialized"); // referrer is not a player yet
    await giveResource("circuit", circuitMint, referrer.publicKey, 1);          // creates the referrer's Player PDA
    await expectError(bind(referrer, referrer), "InvalidReferral");
    await bind(referrer, referred);
    const link = await program.account.referralLink.fetch(linkOf(referred));
    expect(link.referrer.toBase58()).to.equal(referrer.publicKey.toBase58());
    expect(link.referred.toBase58()).to.equal(referred.publicKey.toBase58());
    expect(link.tier).to.equal(0);
    expect((await program.account.referrerStats.fetch(statsOf(referrer))).activeCount).to.equal(1);

    // The link is permanent: another referrer cannot take the player over.
    const other = Keypair.generate(); await airdrop(other);
    await giveResource("circuit", circuitMint, other.publicKey, 1);
    await expectError(bind(other, referred));
    expect((await program.account.referralLink.fetch(linkOf(referred))).referrer.toBase58()).to.equal(referrer.publicKey.toBase58());

    // Tier 1 costs 1 000 Circuit + 1 000 Silicon + 500 Data, burned from the player.
    const userCircuit = await ensureAta(circuitMint, referred.publicKey);
    const userSilicon = await ensureAta(siliconMint, referred.publicKey);
    const userData = await ensureAta(dataMint, referred.publicKey);
    const upgrade = () => program.methods.referralUpgrade().accounts({
      config: configPda, user: referred.publicKey, referralLink: linkOf(referred),
      circuitMint, userCircuit, siliconMint, userSilicon, dataMint, userData, tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([referred]).rpc();
    await expectError(upgrade(), "InsufficientBalance");
    await giveResource("circuit", circuitMint, referred.publicKey, 1_200);
    await giveResource("silicon", siliconMint, referred.publicKey, 1_200);
    await giveResource("data", dataMint, referred.publicKey, 600);
    const [w0, s0, f0] = [await balance(userCircuit), await balance(userSilicon), await balance(userData)];
    await upgrade();
    expect(w0.sub(await balance(userCircuit)).toString()).to.equal(UNIT.muln(1_000).toString());
    expect(s0.sub(await balance(userSilicon)).toString()).to.equal(UNIT.muln(1_000).toString());
    expect(f0.sub(await balance(userData)).toString()).to.equal(UNIT.muln(500).toString());
    expect((await program.account.referralLink.fetch(linkOf(referred))).tier).to.equal(1);
  });

  // ========== RENTAL ==========
  it("rental: escrowed listing, bounded paid start, early end/delist/revoke rules, renter ends, delist returns the NFT", async () => {
    const owner = Keypair.generate(); await airdrop(owner);
    const renter = Keypair.generate(); await airdrop(renter);
    const { mint, tokenAccount: ownerToken } = await mintTool(owner.publicKey, "neural_seeder");
    const tool = toolPda(mint);
    const rentalListing = pda([B("rental_listing"), mint.toBuffer()]);
    const rentalAgreement = pda([B("rental_agreement"), mint.toBuffer()]);
    const rentalVault = await ensureAta(mint, rentalListing);
    const DAY = new BN(24 * 3600);
    const PRICE_PER_HOUR = new BN(1_000_000);
    const list = (splitBps: number, minDuration: BN) => program.methods.rentalList(splitBps, minDuration, DAY, PRICE_PER_HOUR).accounts({
      config: configPda, owner: owner.publicKey, mint, tool, rentalListing, ownerToken, rentalVault,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([owner]).rpc();
    await expectError(list(10_000, DAY), "InvalidAmount");                 // the platform keeps >= 5%
    await expectError(list(9_000, new BN(3600)), "InvalidRentalDuration"); // at least 24 h
    await list(9_000, DAY);
    expect((await balance(rentalVault)).toString()).to.equal("1");
    expect((await balance(ownerToken)).toString()).to.equal("0");

    // While listed the NFT is in escrow: it cannot be sold on the marketplace.
    const mktListing = pda([B("listing"), mint.toBuffer()]);
    await expectError(program.methods.marketplaceList(new BN(1_000)).accounts({
      config: configPda, seller: owner.publicKey, mint, tool, sellerToken: ownerToken, listing: mktListing,
      listingVault: await ensureAta(mint, mktListing), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([owner]).rpc(), "ConstraintRaw");

    const TOTAL = PRICE_PER_HOUR.muln(24);                  // 24 h at 0.001 SOL/h
    const OWNER_SHARE = TOTAL.muln(9_000).divn(10_000);     // 90% owner, 10% platform
    const start = (maxTotalFee: BN) => program.methods.rentalStartBounded(DAY, maxTotalFee).accounts({
      config: configPda, renter: renter.publicKey, mint, tool, rentalListing, owner: owner.publicKey,
      treasury: authority, rentalAgreement, rentalVault, systemProgram: SystemProgram.programId,
    }).signers([renter]).rpc();
    await expectError(start(TOTAL.subn(1)), "PriceLimitExceeded");
    const ownerBefore = await lamports(owner.publicKey);
    await start(TOTAL);
    expect(await lamports(owner.publicKey) - ownerBefore).to.equal(OWNER_SHARE.toNumber());
    expect((await program.account.toolData.fetch(tool)).operator.toBase58()).to.equal(renter.publicKey.toBase58());
    const agreement = await program.account.rentalAgreement.fetch(rentalAgreement);
    expect(agreement.renter.toBase58()).to.equal(renter.publicKey.toBase58());
    expect(agreement.end.sub(agreement.start).toString()).to.equal(DAY.toString());

    const end = (caller: Keypair) => program.methods.rentalEnd().accounts({
      config: configPda, caller: caller.publicKey, mint, tool, rentalAgreement, renterRefund: renter.publicKey,
    }).signers([caller]).rpc();
    const delist = () => program.methods.rentalDelist().accounts({
      config: configPda, caller: owner.publicKey, mint, tool, rentalListing, lister: owner.publicKey,
      rentalVault, ownerToken, tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([owner]).rpc();
    const revoke = () => program.methods.rentalRevoke().accounts({
      config: configPda, owner: owner.publicKey, mint, tool, rentalAgreement, renterRefund: renter.publicKey,
      rentalListing, systemProgram: SystemProgram.programId,
    }).signers([owner]).rpc();
    await expectError(end(owner), "RentalGraceNotExpired"); // only the renter may end before the term
    await expectError(delist(), "StillActive");             // the NFT stays in escrow while rented
    await revoke();                                          // the first call only starts the 12 h grace
    expect((await program.account.rentalAgreement.fetch(rentalAgreement)).revokeRequestedAt.toNumber()).to.be.greaterThan(0);
    await expectError(revoke(), "RentalGraceNotExpired");

    await end(renter);
    expect((await program.account.toolData.fetch(tool)).operator.toBase58()).to.equal(owner.publicKey.toBase58());
    expect(await provider.connection.getAccountInfo(rentalAgreement)).to.equal(null);
    await delist();
    expect((await balance(ownerToken)).toString()).to.equal("1");
    expect(await provider.connection.getAccountInfo(rentalListing)).to.equal(null);
    expect(await provider.connection.getAccountInfo(rentalVault)).to.equal(null);
  });

  // ========== COLLECTORS ==========
  it("collectors: only registered mints of the right kind stake, the lock holds the NFT, revoke closes the entry", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const mint = await createMint(provider.connection, setupPayer, setupPayer.publicKey, null, 0);
    const userToken = await ensureAta(mint, user.publicKey);
    await mintTo(provider.connection, setupPayer, mint, userToken, setupPayer, 1);
    const vaultToken = await ensureAta(mint, vaultPda);
    const entry = pda([B("collector_allow"), mint.toBuffer()]);
    const stakedCollector = pda([B("collector"), mint.toBuffer()]);
    const stake = (kind: any) => program.methods.collectorStake(kind).accounts({
      config: configPda, user: user.publicKey, mint, userToken, vault: vaultPda, vaultToken, stakedCollector,
      collectorAllow: entry, player: playerPda(user.publicKey), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([user]).rpc();

    await expectError(stake({ medallion: {} }), "AccountNotInitialized");  // not registered
    await program.methods.registerCollectorMint({ medallion: {} }).accounts({
      config: configPda, authority, mint, entry, systemProgram: SystemProgram.programId,
    }).rpc();
    await expectError(stake({ historian: {} }), "CollectorMintNotAllowed"); // the entry fixes the kind
    await stake({ medallion: {} });
    expect((await balance(vaultToken)).toString()).to.equal("1");
    expect((await balance(userToken)).toString()).to.equal("0");
    const staked = await program.account.stakedCollector.fetch(stakedCollector);
    expect(staked.owner.toBase58()).to.equal(user.publicKey.toBase58());
    const lockSeconds = staked.unlockAt.toNumber() - Math.floor(Date.now() / 1000);
    expect(lockSeconds).to.be.within(3 * 86400 - 3600, 3 * 86400 + 3600); // COLLECTORS_LOCK_SECONDS
    expect((await program.account.player.fetch(playerPda(user.publicKey))).medallionCount).to.equal(1);

    // The 3-day lock holds even with the unstake fee available in the gas tank.
    await program.methods.depositGas(new BN(100_000_000)).accounts({
      config: configPda, user: user.publicKey, gastank: gastankPda(user.publicKey), systemProgram: SystemProgram.programId,
    }).signers([user]).rpc();
    await expectError(program.methods.collectorUnstake().accounts({
      config: configPda, user: user.publicKey, mint, userToken, vault: vaultPda, vaultToken, stakedCollector,
      player: playerPda(user.publicKey), gastank: gastankPda(user.publicKey), tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([user]).rpc(), "LockNotExpired");

    await program.methods.revokeCollectorMint().accounts({ config: configPda, authority, mint, entry }).rpc();
    expect(await provider.connection.getAccountInfo(entry)).to.equal(null);
    expect((await balance(vaultToken)).toString()).to.equal("1"); // already staked NFTs stay staked
  });

  // ========== SEASON ==========
  it("season: XP entitlements require player payment and signature; rent, replay and expiry are guarded", async () => {
    const seasonId = Math.floor(Date.now() / 1000) >>> 0; // u32, unique per run
    const sid = Buffer.alloc(4); sid.writeUInt32LE(seasonId);
    const season = pda([B("season"), sid]);
    await program.methods.initSeason(seasonId).accounts({ config: configPda, authority, season, systemProgram: SystemProgram.programId }).rpc();

    const user = Keypair.generate(); await airdrop(user);
    const seasonPass = pda([B("season_pass"), user.publicKey.toBuffer(), sid]);
    const claimCursor = pda([B("season_xp_claim_cursor"), user.publicKey.toBuffer(), sid]);
    const purchase = () => program.methods.purchaseSeasonPass().accounts({
      config: configPda, user: user.publicKey, treasury: authority, season, seasonPass, systemProgram: SystemProgram.programId,
    }).signers([user]).rpc();
    const before = await lamports(user.publicKey);
    await expectError(purchase(), "SeasonPremiumRequired");
    expect(await lamports(user.publicKey)).to.equal(before);
    expect(await provider.connection.getAccountInfo(seasonPass)).to.equal(null);
    expect(await provider.connection.getAccountInfo(claimCursor)).to.equal(null);

    const xpExpirySlot = (await provider.connection.getSlot("confirmed")) + 20_000;
    const grant = (amount: number, nonce: number, options: {
      authority?: PublicKey; player?: PublicKey; seasonId?: number; season?: PublicKey;
      seasonPass?: PublicKey; claimCursor?: PublicKey; expirySlot?: number | BN;
      campaignByte?: number; entitlementByte?: number; genesisByte?: number;
    } = {}) => {
      const argSeasonId = options.seasonId ?? seasonId;
      const expiry = options.expirySlot ?? xpExpirySlot;
      return program.methods.grantSeasonXp(
        amount,
        argSeasonId,
        nonce,
        new BN(expiry.toString()),
        Array.from(Buffer.alloc(32, options.campaignByte ?? 0x31)),
        Array.from(Buffer.alloc(32, options.entitlementByte ?? (0x40 + (nonce % 64)))),
        Array.from(Buffer.alloc(32, options.genesisByte ?? 0x22)),
      ).accounts({
        config: configPda,
        authority: options.authority ?? authority,
        user: options.player ?? user.publicKey,
        season: options.season ?? season,
        seasonPass: options.seasonPass ?? seasonPass,
        claimCursor: options.claimCursor ?? claimCursor,
        systemProgram: SystemProgram.programId,
      });
    };

    // The first claim creates both PDAs in the player's transaction. The
    // authority co-signs but is neither writable nor the fee payer.
    const authorityBefore = await lamports(authority);
    const playerBefore = await lamports(user.publicKey);
    await sendPlayerClaim(grant(1_500, 0), user);
    expect(await lamports(user.publicKey)).to.be.lessThan(playerBefore);
    expect(await lamports(authority)).to.equal(authorityBefore);
    expect((await program.account.seasonPass.fetch(seasonPass)).owner.toBase58()).to.equal(user.publicKey.toBase58());
    expect((await program.account.seasonPass.fetch(seasonPass)).xp).to.equal(1_500);
    expect((await program.account.seasonXpClaimCursor.fetch(claimCursor)).nextNonce).to.equal(1);
    expect((await lamports(seasonPass))).to.be.greaterThan(0);
    expect((await lamports(claimCursor))).to.be.greaterThan(0);

    // Existing pass and replay cursor receive no second rent charge.
    const passLamports = await lamports(seasonPass);
    const cursorLamports = await lamports(claimCursor);
    const playerBeforeSecond = await lamports(user.publicKey);
    await sendPlayerClaim(grant(1, 1), user);
    expect(await lamports(seasonPass)).to.equal(passLamports);
    expect(await lamports(claimCursor)).to.equal(cursorLamports);
    expect(await lamports(user.publicKey)).to.be.lessThan(playerBeforeSecond); // network fee only; no rent
    expect(await lamports(authority)).to.equal(authorityBefore);
    expect((await program.account.seasonPass.fetch(seasonPass)).xp).to.equal(1_501);
    expect((await program.account.seasonXpClaimCursor.fetch(claimCursor)).nextNonce).to.equal(2);

    const stranger = Keypair.generate(); await airdrop(stranger);
    await expectError(sendWithExplicitSigners(
      grant(100, 2, { authority: stranger.publicKey }), user, [user, stranger],
    ), "Unauthorized");

    // The operator signature covers the serialized amount. Mutating the
    // instruction after co-signing invalidates that signature before send.
    const amountIntent = await grant(100, 2).transaction();
    amountIntent.feePayer = user.publicKey;
    amountIntent.recentBlockhash = (await provider.connection.getLatestBlockhash("confirmed")).blockhash;
    const authoritySigned = await provider.wallet.signTransaction(amountIntent);
    authoritySigned.instructions[0].data[8] ^= 1; // first byte of amount, after discriminator
    authoritySigned.partialSign(user);
    expect(() => authoritySigned.serialize()).to.throw();

    const wrongSeasonId = seasonId + 1;
    await expectError(sendPlayerClaim(grant(100, 2, { seasonId: wrongSeasonId }), user), "ConstraintSeeds");
    const expiredSlot = (await provider.connection.getSlot("confirmed")) - 1;
    await expectError(sendPlayerClaim(grant(100, 2, { expirySlot: expiredSlot }), user), "SeasonXpEntitlementExpired");
    await expectError(sendPlayerClaim(grant(100, 0), user), "SeasonXpNonceMismatch");
    expect((await program.account.seasonPass.fetch(seasonPass)).xp).to.equal(1_501);
    expect((await program.account.seasonXpClaimCursor.fetch(claimCursor)).nextNonce).to.equal(2);

    // If the player can pay the transaction fee and the first account's rent,
    // but not the cursor's rent, Anchor must roll the entire init back.
    const poor = Keypair.generate();
    const poorPass = pda([B("season_pass"), poor.publicKey.toBuffer(), sid]);
    const poorCursor = pda([B("season_xp_claim_cursor"), poor.publicKey.toBuffer(), sid]);
    const poorGrant = grant(200, 0, { player: poor.publicKey, seasonPass: poorPass, claimCursor: poorCursor });
    const estimate = await poorGrant.transaction();
    estimate.feePayer = poor.publicKey;
    estimate.recentBlockhash = (await provider.connection.getLatestBlockhash("confirmed")).blockhash;
    const fee = (await provider.connection.getFeeForMessage(estimate.compileMessage(), "confirmed")).value ?? 10_000;
    const passRent = await provider.connection.getMinimumBalanceForRentExemption(57);
    const cursorRent = await provider.connection.getMinimumBalanceForRentExemption(49);
    await airdropLamports(poor, passRent + Math.floor(cursorRent / 2) + fee * 2);
    const poorBefore = await lamports(poor.publicKey);
    const authorityBeforePoorClaim = await lamports(authority);
    const poorTx = await poorGrant.transaction();
    poorTx.feePayer = poor.publicKey;
    const poorLifetime = await provider.connection.getLatestBlockhash("confirmed");
    poorTx.recentBlockhash = poorLifetime.blockhash;
    poorTx.partialSign(poor);
    const authorityCoSignedPoorTx = await provider.wallet.signTransaction(poorTx);
    const poorSignature = await provider.connection.sendRawTransaction(authorityCoSignedPoorTx.serialize(), {
      skipPreflight: true,
      preflightCommitment: "confirmed",
    });
    const poorConfirmation = await provider.connection.confirmTransaction({ ...poorLifetime, signature: poorSignature }, "confirmed");
    expect(poorConfirmation.value.err, "validator executes the underfunded claim and rolls it back").to.not.equal(null);
    const failedPoorTx = await provider.connection.getTransaction(poorSignature, {
      commitment: "confirmed", maxSupportedTransactionVersion: 0,
    });
    expect(failedPoorTx?.meta?.err).to.not.equal(null);
    expect(await provider.connection.getAccountInfo(poorPass)).to.equal(null);
    expect(await provider.connection.getAccountInfo(poorCursor)).to.equal(null);
    expect(await lamports(poor.publicKey)).to.be.lessThan(poorBefore); // fee may be charged, state is atomic
    expect(await lamports(authority)).to.equal(authorityBeforePoorClaim);

    // Two distinct authority-signed messages race for nonce zero. Only one
    // can advance the shared per-player/per-season cursor.
    const racer = Keypair.generate(); await airdrop(racer);
    const racerPass = pda([B("season_pass"), racer.publicKey.toBuffer(), sid]);
    const racerCursor = pda([B("season_xp_claim_cursor"), racer.publicKey.toBuffer(), sid]);
    const race1 = grant(777, 0, { player: racer.publicKey, seasonPass: racerPass, claimCursor: racerCursor, entitlementByte: 0x61 });
    const race2 = grant(777, 0, { player: racer.publicKey, seasonPass: racerPass, claimCursor: racerCursor, entitlementByte: 0x62 });
    const race = await Promise.allSettled([sendPlayerClaim(race1, racer), sendPlayerClaim(race2, racer)]);
    expect(race.filter((result) => result.status === "fulfilled")).to.have.length(1);
    expect((await program.account.seasonXpClaimCursor.fetch(racerCursor)).nextNonce).to.equal(1);
    expect((await program.account.seasonPass.fetch(racerPass)).xp).to.equal(777);

    const userCircuit = await ensureAta(circuitMint, user.publicKey);
    const claimReward = (level: number, premiumTrack: boolean) => program.methods.claimSeasonReward(level, premiumTrack).accounts({
      config: configPda, authority, materialMints: materialMintsPda, season, seasonPass, circuitMint, userCircuit, auth: authPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();
    const circuitBefore = await balance(userCircuit);
    await expectError(claimReward(1, true), "SeasonPremiumRequired");
    expect((await balance(userCircuit)).toString()).to.equal(circuitBefore.toString());
    await claimReward(1, false);
    expect((await balance(userCircuit)).sub(circuitBefore).toString()).to.equal(UNIT.muln(100).toString()); // 100 units per level
    await expectError(claimReward(1, false), "SeasonRewardAlreadyClaimed");
    await expectError(claimReward(2, false), "SeasonInsufficientXp"); // 1 501 XP < 2 000
    expect((await program.account.seasonPass.fetch(seasonPass)).claimedBitmap.toString()).to.equal("1");
  });

  // ========== LOTTERY / QUANTUM DRAW ==========
  // [F-06] Every ticket is escrowed in full on the round; the draw commits
  // through a Switchboard pool slot (none on this validator = production
  // "pool empty"); before a draw nothing can be claimed and refunds wait for
  // the 14-day timeout. The drawn/claimed path runs in the host tests with an
  // emulated Switchboard (aof-core/src/security_checklist_tests.rs).
  it("lottery: tickets escrowed on the round, draw needs a VRF slot, no claim or early refund", async () => {
    const le = (n: BN) => n.toArrayLike(Buffer, "le", 8);
    const roundId = new BN(Date.now());
    const lotteryRound = pda([B("lottery_round"), le(roundId)]);
    await program.methods.initLotteryRound(roundId).accounts({
      config: configPda, authority, lotteryRound, systemProgram: SystemProgram.programId,
    }).rpc();

    const buyer = Keypair.generate();
    await airdrop(buyer);
    const ticket = (n: number) => pda([B("lottery_ticket"), le(roundId), le(new BN(n))]);
    const ticketCounter = pda([B("lottery_ticket"), B("count"), le(roundId), buyer.publicKey.toBuffer()]);
    const roundBefore = await provider.connection.getBalance(lotteryRound);
    const TICKET_CEILING = new BN(800_000); // LOTTERY_TICKET_PRICE_LAMPORTS: what the player signs
    // A ceiling below the escrowed price must fail closed, not charge more.
    await expectError(program.methods.buyLotteryTicket(TICKET_CEILING.subn(1)).accounts({
      config: configPda, buyer: buyer.publicKey, lotteryRound, lotteryTicket: ticket(0), ticketCounter,
      systemProgram: SystemProgram.programId,
    }).signers([buyer]).rpc(), "PriceAboveMaximum");
    for (const n of [0, 1]) {
      await program.methods.buyLotteryTicket(TICKET_CEILING).accounts({
        config: configPda, buyer: buyer.publicKey, lotteryRound, lotteryTicket: ticket(n), ticketCounter,
        systemProgram: SystemProgram.programId,
      }).signers([buyer]).rpc();
    }
    const TICKET = 800_000; // LOTTERY_TICKET_PRICE_LAMPORTS, escrowed in full
    const round = await program.account.lotteryRound.fetch(lotteryRound);
    expect(round.ticketsSold.toString()).to.equal("2");
    expect(round.poolLamports.toString()).to.equal(String(2 * TICKET));
    expect(await provider.connection.getBalance(lotteryRound)).to.equal(roundBefore + 2 * TICKET);
    expect((await program.account.lotteryTicket.fetch(ticket(1))).buyer.toString()).to.equal(buyer.publicKey.toString());

    // Switchboard On-Demand (mainnet build), pool slot #0 that does not exist.
    const randomness = pda([B("vrf_randomness"), Buffer.alloc(4)]);
    await expectError(program.methods.commitLotteryDraw().accountsStrict({
      config: configPda, cranker: authority, lotteryRound,
      vrfSlot: pda([B("vrf_slot"), randomness.toBuffer()]), randomness, vrfAuthority: pda([B("vrf_authority")]),
      queue: new PublicKey("A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w"), oracle: Keypair.generate().publicKey,
      recentSlothashes: SLOT_HASHES, switchboardProgram: new PublicKey("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv"),
    }).rpc(), "AccountNotInitialized");
    expect((await program.account.lotteryRound.fetch(lotteryRound)).drawCommitted).to.equal(false);

    await expectError(program.methods.claimLotteryPrize().accounts({
      config: configPda, lotteryRound, lotteryTicket: ticket(0), winner: buyer.publicKey,
    }).signers([buyer]).rpc(), "LotteryNotDrawn");
    await expectError(program.methods.refundLotteryTicket().accounts({
      config: configPda, lotteryRound, lotteryTicket: ticket(0), buyer: buyer.publicKey,
    }).rpc(), "LotteryRoundNotExpired");
    expect(await provider.connection.getBalance(lotteryRound)).to.equal(roundBefore + 2 * TICKET);
  });

  // ========== CRAFT ORDERS ==========
  it("craft orders: premium escrowed, fulfill swaps exact resources for premium minus 2%, only the creator cancels", async () => {
    const creator = Keypair.generate(); await airdrop(creator);
    const fulfiller = Keypair.generate(); await airdrop(fulfiller);
    const stranger = Keypair.generate(); await airdrop(stranger);
    const craftOrder = pda([B("craft_order"), creator.publicKey.toBuffer()]);
    const PREMIUM = 10_000_000;
    const CIRCUIT = UNIT.muln(10);
    const SILICON = UNIT.muln(5);
    const create = () => program.methods.craftOrderCreate(CIRCUIT, SILICON, new BN(PREMIUM)).accounts({
      config: configPda, creator: creator.publicKey, craftOrder, systemProgram: SystemProgram.programId,
    }).signers([creator]).rpc();
    await create();
    const orderInfo = (await provider.connection.getAccountInfo(craftOrder))!;
    const orderRent = await provider.connection.getMinimumBalanceForRentExemption(orderInfo.data.length);
    expect(orderInfo.lamports - orderRent).to.equal(PREMIUM);

    const creatorCircuit = await ensureAta(circuitMint, creator.publicKey);
    const creatorSilicon = await ensureAta(siliconMint, creator.publicKey);
    const fulfillerCircuit = await giveResource("circuit", circuitMint, fulfiller.publicKey, 20);
    const fulfillerSilicon = await giveResource("silicon", siliconMint, fulfiller.publicKey, 20);
    const [cw0, cs0, fw0, fs0] = [await balance(creatorCircuit), await balance(creatorSilicon), await balance(fulfillerCircuit), await balance(fulfillerSilicon)];
    const fulfillerBefore = await lamports(fulfiller.publicKey);
    const creatorBefore = await lamports(creator.publicKey);
    await program.methods.craftOrderFulfill().accounts({
      config: configPda, fulfiller: fulfiller.publicKey, craftOrder, creatorRefund: creator.publicKey, treasury: authority,
      circuitMint, fulfillerCircuit, creatorCircuit, siliconMint, fulfillerSilicon, creatorSilicon, tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([fulfiller]).rpc();
    const fee = Math.floor(PREMIUM * 200 / 10_000); // CRAFT_ORDER_FEE_BPS
    expect(await lamports(fulfiller.publicKey) - fulfillerBefore).to.equal(PREMIUM - fee);
    expect(await lamports(creator.publicKey) - creatorBefore).to.equal(orderRent); // the closed order's rent
    expect((await balance(creatorCircuit)).sub(cw0).toString()).to.equal(CIRCUIT.toString());
    expect((await balance(creatorSilicon)).sub(cs0).toString()).to.equal(SILICON.toString());
    expect(fw0.sub(await balance(fulfillerCircuit)).toString()).to.equal(CIRCUIT.toString());
    expect(fs0.sub(await balance(fulfillerSilicon)).toString()).to.equal(SILICON.toString());
    expect(await provider.connection.getAccountInfo(craftOrder)).to.equal(null);

    // A second order: a stranger cannot cancel it; the creator gets everything back.
    await create();
    await expectError(program.methods.craftOrderCancel().accounts({
      config: configPda, creator: stranger.publicKey, craftOrder,
    }).signers([stranger]).rpc(), "ConstraintSeeds");
    const locked = await lamports(craftOrder);
    const beforeCancel = await lamports(creator.publicKey);
    await program.methods.craftOrderCancel().accounts({ config: configPda, creator: creator.publicKey, craftOrder }).signers([creator]).rpc();
    expect(await lamports(creator.publicKey) - beforeCancel).to.equal(locked);
    expect(await provider.connection.getAccountInfo(craftOrder)).to.equal(null);
  });

  // ========== BURN ==========
  it("burn: resource burns check amount, kind and balance and shrink the supply; a tool burn closes the NFT and its data", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const userCircuit = await giveResource("circuit", circuitMint, user.publicKey, 10);
    const burn = (kind: any, amount: BN) => program.methods.burnResource(kind, amount).accounts({
      config: configPda, materialMints: materialMintsPda, user: user.publicKey, mint: circuitMint, tokenAccount: userCircuit,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([user]).rpc();
    const supply = async () => new BN((await provider.connection.getTokenSupply(circuitMint)).value.amount);
    const bal0 = await balance(userCircuit);
    const supply0 = await supply();
    await expectError(burn({ circuit: {} }, new BN(0)), "ZeroAmount");
    await expectError(burn({ silicon: {} }, UNIT), "InvalidResourceKind");
    await expectError(burn({ circuit: {} }, bal0.addn(1)), "InsufficientBalance");
    await burn({ circuit: {} }, UNIT.muln(3));
    expect(bal0.sub(await balance(userCircuit)).toString()).to.equal(UNIT.muln(3).toString());
    expect(supply0.sub(await supply()).toString()).to.equal(UNIT.muln(3).toString());

    const { mint, tokenAccount } = await mintTool(user.publicKey);
    const burnTool = (signer: Keypair, account: PublicKey) => program.methods.burnTool().accounts({
      config: configPda, user: signer.publicKey, mint, tokenAccount: account, toolData: toolPda(mint), tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([signer]).rpc();
    const stranger = Keypair.generate(); await airdrop(stranger);
    await expectError(burnTool(stranger, await ensureAta(mint, stranger.publicKey)), "ConstraintRaw"); // holds no NFT
    await burnTool(user, tokenAccount);
    expect((await getMint(provider.connection, mint)).supply.toString()).to.equal("0");
    expect(await provider.connection.getAccountInfo(tokenAccount)).to.equal(null);
    expect(await provider.connection.getAccountInfo(toolPda(mint))).to.equal(null);
  });

  // ========== REPAIR ==========
  it("repair: only the operator, a positive amount, never above max durability; nothing is burned on failure", async () => {
    const owner = Keypair.generate(); await airdrop(owner);
    const stranger = Keypair.generate(); await airdrop(stranger);
    const { mint } = await mintTool(owner.publicKey, "silicon_extractor");
    const ownerSilicon = await giveResource("silicon", siliconMint, owner.publicKey, 50);
    const ownerCircuit = await giveResource("circuit", circuitMint, owner.publicKey, 50);
    // Token-primary ownership: repair проверяет, где реально лежит supply-1 токен.
    // Инструмент свободен, поэтому это личный ATA того, кого ремонтируют.
    const toolTokenFor = (who: PublicKey) => getAssociatedTokenAddressSync(mint, who, true);
    const repair = (signer: Keypair, amount: number, userSilicon: PublicKey, userCircuit: PublicKey) => program.methods.repair(amount).accounts({
      config: configPda, user: signer.publicKey, tool: toolPda(mint), mint, siliconMint, userSilicon, circuitMint, userCircuit,
      toolToken: toolTokenFor(signer.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([signer]).rpc();
    const [stone0, wood0] = [await balance(ownerSilicon), await balance(ownerCircuit)];
    expect((await program.account.toolData.fetch(toolPda(mint))).durability).to.equal(20); // MAX_DURABILITY
    await expectError(repair(owner, 1, ownerSilicon, ownerCircuit), "DurabilityOverflow");
    await expectError(repair(owner, 0, ownerSilicon, ownerCircuit), "InvalidAmount");
    await expectError(repair(stranger, 1, await ensureAta(siliconMint, stranger.publicKey), await ensureAta(circuitMint, stranger.publicKey)), "NotToolOperator");
    expect((await balance(ownerSilicon)).toString()).to.equal(stone0.toString());
    expect((await balance(ownerCircuit)).toString()).to.equal(wood0.toString());
  });

  // ========== GAS TANK ==========
  it("gas tank: sub-micro dust carries over, small withdrawals are instant, the sweep never takes user funds", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const gastank = gastankPda(user.publicKey);
    const acc = { config: configPda, user: user.publicKey, gastank, systemProgram: SystemProgram.programId };
    await expectError(program.methods.depositGas(new BN(0)).accounts(acc).signers([user]).rpc(), "ZeroAmount");
    await program.methods.depositGas(new BN(1_000_500)).accounts(acc).signers([user]).rpc();
    let tank = await program.account.gasTank.fetch(gastank);
    expect(tank.balanceMicros.toString()).to.equal("1000"); // 1 micro = 1 000 lamports
    expect(tank.dustLamports.toString()).to.equal("500");
    await program.methods.depositGas(new BN(1_500)).accounts(acc).signers([user]).rpc();
    tank = await program.account.gasTank.fetch(gastank);
    expect(tank.balanceMicros.toString()).to.equal("1002"); // 1 500 + 500 dust = 2 micros
    expect(tank.dustLamports.toString()).to.equal("0");

    const sweep = (signer: Keypair | null) => {
      const call = program.methods.sweepGasFees().accounts({
        config: configPda, authority: signer ? signer.publicKey : authority, gastank, treasury: authority,
        systemProgram: SystemProgram.programId,
      });
      return signer ? call.signers([signer]).rpc() : call.rpc();
    };
    const stranger = Keypair.generate(); await airdrop(stranger);
    await expectError(sweep(stranger), "Unauthorized");
    await expectError(sweep(null), "NoExcessToSweep"); // every lamport above rent belongs to the user

    const before = await lamports(user.publicKey);
    await program.methods.withdrawGas(new BN(1_002)).accounts(acc).signers([user]).rpc();
    expect(await lamports(user.publicKey) - before).to.equal(1_002_000);
    tank = await program.account.gasTank.fetch(gastank);
    expect(tank.balanceMicros.toString()).to.equal("0");
    expect(tank.cooldownUntil.toString()).to.equal("0"); // below the 0.2 SOL instant-withdrawal threshold
    await expectError(program.methods.withdrawGas(new BN(1)).accounts(acc).signers([user]).rpc(), "InsufficientBalance");
  });

  // ========== MARKETPLACE ==========
  it("marketplace: canonical tool kinds, only the seller cancels, the buyer owns and relists, the old seller cannot", async () => {
    const seller = Keypair.generate(); await airdrop(seller);
    const buyer = Keypair.generate(); await airdrop(buyer);
    const stranger = Keypair.generate(); await airdrop(stranger);
    // Only the five canonical tool ids can be minted. No legacy NFT accounts
    // exist on the target network, so old tool names are deliberately rejected.
    const { mint, tokenAccount: sellerToken } = await mintTool(seller.publicKey, "plasma_cutter");
    expect((await program.account.toolData.fetch(toolPda(mint))).toolType).to.equal("plasma_cutter");
    for (const kind of ["silicon_extractor", "Data_Harvester", "quantum_transmitter", "neural_seeder"]) {
      const created = await mintTool(seller.publicKey, kind);
      expect((await program.account.toolData.fetch(toolPda(created.mint))).toolType).to.equal(kind.toLowerCase());
    }
    for (const old of ["axe", "pick", "spear", "bow", "reaper", "chainsaw"]) {
      await expectError(mintTool(seller.publicKey, old), "InvalidToolType");
    }

    const listing = pda([B("listing"), mint.toBuffer()]);
    const listingVault = getAssociatedTokenAddressSync(mint, listing, true);
    const list = (who: Keypair, whoToken: PublicKey, price: number) => program.methods.marketplaceList(new BN(price)).accounts({
      config: configPda, seller: who.publicKey, mint, tool: toolPda(mint), sellerToken: whoToken, listing, listingVault,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([who]).rpc();
    const cancel = (who: Keypair, whoToken: PublicKey) => program.methods.marketplaceCancel().accounts({
      config: configPda, mint, listing, seller: who.publicKey, listingVault, sellerToken: whoToken, tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([who]).rpc();
    await ensureAta(mint, listing);
    await list(seller, sellerToken, 1_000_000);
    await expectError(cancel(stranger, await ensureAta(mint, stranger.publicKey)), "Unauthorized");

    const buyerToken = await ensureAta(mint, buyer.publicKey);
    // A quote may live at most 300 s by the chain clock; stay well inside it.
    await program.methods.marketplaceBuyBounded(new BN(1_000_000), new BN(Math.floor(Date.now() / 1000) + 120)).accounts({
      config: configPda, buyer: buyer.publicKey, seller: seller.publicKey, treasury: authority, mint, tool: toolPda(mint),
      listing, listingVault, buyerToken, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([buyer]).rpc();
    const td = await program.account.toolData.fetch(toolPda(mint));
    expect(td.owner.toBase58()).to.equal(buyer.publicKey.toBase58());
    expect(td.operator.toBase58()).to.equal(buyer.publicKey.toBase58());

    await ensureAta(mint, listing); // the sale closed the escrow ATA
    await expectError(list(seller, sellerToken, 1), "NotToolOwner");
    await list(buyer, buyerToken, 2_000_000);
    expect((await program.account.listing.fetch(listing)).seller.toBase58()).to.equal(buyer.publicKey.toBase58());
    await cancel(buyer, buyerToken);
    expect((await balance(buyerToken)).toString()).to.equal("1");
  });

  // ========== REBIRTH (§3.4) ==========
  // Полный сброс: одна транзакция несёт и `reset_for_rebirth` (aof-core), и
  // `do_rebirth` (aof-rebirth). Проверяются обе стороны обещания: прогресс
  // сезона обнулён и излишки сожжены — или не произошло ничего.
  it("rebirth: полный сброс одной транзакцией — прогресс и излишки, без частичных состояний", async () => {
    const rebirthIdlPath = process.cwd() + "/target/idl/aof_rebirth.json";
    const rebirthIdl = JSON.parse(fs.readFileSync(rebirthIdlPath, "utf8"));
    if (!rebirthIdl.address) rebirthIdl.address = "HHwA5u7oZUkP26ZWidB1tWZsztN2MRfF1iV29m3bbSKF";
    const rebirth: any = new anchor.Program(rebirthIdl as any, provider);
    const rebirthPid = rebirth.programId as PublicKey;
    const rebirthPda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, rebirthPid)[0];

    const rebirthConfig = rebirthPda([B("rebirth_config")]);
    const [programData] = PublicKey.findProgramAddressSync(
      [rebirthPid.toBuffer()], new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
    );
    const costLamports = 100_000_000; // 0.1 SOL
    if (!(await provider.connection.getAccountInfo(rebirthConfig))) {
      await rebirth.methods.initRebirthConfig(200, 2_000, 10, authority, new BN(costLamports), new BN(3_600)).accounts({
        rebirthConfig, authority, programData, systemProgram: SystemProgram.programId,
      }).rpc();
    }

    const seasonId = Math.floor(Date.now() / 1000) >>> 0;
    const sid = Buffer.alloc(4); sid.writeUInt32LE(seasonId);
    const season = pda([B("season"), sid]);
    await program.methods.initSeason(seasonId).accounts({
      config: configPda, authority, season, systemProgram: SystemProgram.programId,
    }).rpc();

    const user = Keypair.generate(); await airdrop(user, 5);
    const seasonPass = pda([B("season_pass"), user.publicKey.toBuffer(), sid]);
    const claimCursor = pda([B("season_xp_claim_cursor"), user.publicKey.toBuffer(), sid]);
    const player = playerPda(user.publicKey);
    const rebirthRecord = rebirthPda([B("rebirth_record"), user.publicKey.toBuffer()]);

    // Прогресс: жители/палатка появляются от минта ресурса, XP — из
    // authority-подписанного entitlement в транзакции игрока.
    const circuitAta = await giveResource("circuit", circuitMint, user.publicKey, 3);
    const siliconAta = await giveResource("silicon", siliconMint, user.publicKey, 2);
    await sendPlayerClaim(program.methods.initSeasonPass(seasonId).accounts({
      config: configPda, player: user.publicKey, season, seasonPass, systemProgram: SystemProgram.programId,
    }), user);
    const xpExpiry = new BN((await provider.connection.getSlot("confirmed")) + 20_000);
    const grantXp = (amount: number, nonce: number) => program.methods.grantSeasonXp(
      amount, seasonId, nonce, xpExpiry,
      Array.from(Buffer.alloc(32, 0x31)),
      Array.from(Buffer.alloc(32, 0x51 + nonce)),
      Array.from(Buffer.alloc(32, 0x22)),
    ).accounts({
      config: configPda, authority, user: user.publicKey, season, seasonPass, claimCursor,
      systemProgram: SystemProgram.programId,
    });
    await sendPlayerClaim(grantXp(4_000, 0), user);

    const playerBefore = await program.account.player.fetch(player);
    expect(playerBefore.villagers > 0, "минт ресурса обязан создать прогресс игрока").to.equal(true);
    const circuitBefore = await balance(circuitAta), siliconBefore = await balance(siliconAta);
    expect(circuitBefore.gtn(0) && siliconBefore.gtn(0)).to.equal(true);
    expect((await program.account.seasonPass.fetch(seasonPass)).xp).to.equal(4_000);

    const surplus = [circuitMint, siliconMint].flatMap((mint, index) => [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: index === 0 ? circuitAta : siliconAta, isSigner: false, isWritable: true },
    ]);
    // Подпись игрока обязательна: сжигание идёт от его имени (burn authority —
    // владелец токен-аккаунта), а подпись бэкенда гарантирует полный список.
    const reset = (accounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[]) =>
      program.methods.resetForRebirth(seasonId).accounts({
        config: configPda, operator: authority, user: user.publicKey, player, season, seasonPass,
        materialMints: materialMintsPda, tokenProgram: TOKEN_PROGRAM_ID,
      }).remainingAccounts(accounts).signers([user]).rpc();

    // Не-подписант: сброс от чужого имени не должен трогать чужой прогресс.
    const stranger = Keypair.generate(); await airdrop(stranger);
    await expectError(program.methods.resetForRebirth(seasonId).accounts({
      config: configPda, operator: stranger.publicKey, user: user.publicKey, player, season, seasonPass,
      materialMints: materialMintsPda, tokenProgram: TOKEN_PROGRAM_ID,
    }).remainingAccounts(surplus).signers([stranger, user]).rpc(), "Unauthorized");

    // Любая чужая пара обязана уронить всю инструкцию, а не «сработать частично».
    const strangerAta = await ensureAta(circuitMint, stranger.publicKey);
    await expectError(reset([
      { pubkey: circuitMint, isSigner: false, isWritable: true },
      { pubkey: strangerAta, isSigner: false, isWritable: true },
    ]), "Unauthorized");
    await expectError(reset([
      { pubkey: circuitMint, isSigner: false, isWritable: true },
      { pubkey: siliconAta, isSigner: false, isWritable: true },
    ]), "InvalidResourceKind");
    // Не-канонический токен-аккаунт того же минта и владельца: программа
    // принимает только ATA, иначе сжигание ушло бы не из того места.
    const manualKeypair = Keypair.generate();
    const manual = await createTokenAccount(provider.connection, setupPayer, circuitMint, user.publicKey, manualKeypair);
    await expectError(reset([
      { pubkey: circuitMint, isSigner: false, isWritable: true },
      { pubkey: manual, isSigner: false, isWritable: true },
    ]), "NonCanonicalTokenAccount");

    // Оплата и полный сброс — одной транзакцией: либо всё, либо ничего.
    const tx = new Transaction().add(
      await program.methods.resetForRebirth(seasonId).accounts({
        config: configPda, operator: authority, user: user.publicKey, player, season, seasonPass,
        materialMints: materialMintsPda, tokenProgram: TOKEN_PROGRAM_ID,
      }).remainingAccounts(surplus).instruction(),
      await rebirth.methods.doRebirth().accounts({
        rebirthConfig, authority, rebirthRecord, user: user.publicKey, treasury: authority,
        systemProgram: SystemProgram.programId,
      }).instruction(),
    );
    const treasuryBefore = await lamports(authority);
    await provider.sendAndConfirm(tx, [user]);

    const playerAfter = await program.account.player.fetch(player);
    expect(playerAfter.villagers).to.equal(0);
    expect(playerAfter.villagersAvailable).to.equal(0);
    expect(playerAfter.hasTent).to.equal(false);
    const passAfter = await program.account.seasonPass.fetch(seasonPass);
    expect(passAfter.xp).to.equal(0);
    expect(passAfter.claimedBitmap.toString()).to.equal("0");
    expect(passAfter.premium).to.equal(false);
    expect((await balance(circuitAta)).toString()).to.equal("0");
    expect((await balance(siliconAta)).toString()).to.equal("0");
    expect(playerAfter.historianCount).to.equal(playerBefore.historianCount);
    expect(playerAfter.medallionCount).to.equal(playerBefore.medallionCount);
    const record = await rebirth.account.rebirthRecord.fetch(rebirthRecord);
    expect(record.rebirthCount).to.equal(1);
    expect(record.generation).to.equal(2);
    expect(record.permanentBonusBps).to.equal(200);
    // Комиссию транзакции платит провайдер (он же казна), поэтому цена
    // возрождения видна как приход за вычетом этой комиссии.
    const treasuryAfter = await lamports(authority);
    expect(treasuryAfter - treasuryBefore).to.be.greaterThan(costLamports - 100_000);

    // Непарный список аккаунтов отвергается целиком, а не «как получится».
    await expectError(reset([{ pubkey: circuitMint, isSigner: false, isWritable: true }]), "InvalidAmount");

    // Кулдаун: снова набираем прогресс и пробуем вторую транзакцию «сброс +
    // ребёрт». Она обязана упасть на кулдауне ЦЕЛИКОМ: если бы сброс успел
    // примениться, игрок остался бы без ресурсов и XP, но без бонуса.
    const secondCircuit = await giveResource("circuit", circuitMint, user.publicKey, 1);
    const secondSilicon = await giveResource("silicon", siliconMint, user.publicKey, 1);
    await sendPlayerClaim(grantXp(1_000, 1), user);
    // Жители и палатка — через authority-only ручку: иначе после первого
    // сброса они остаются нулевыми, и «откат» было бы нечем проверить.
    await program.methods.adjustPlayerCapacity(3, true).accounts({
      config: configPda, authority, player,
    }).rpc();
    const xpBefore = (await program.account.seasonPass.fetch(seasonPass)).xp;
    const villagersBefore = (await program.account.player.fetch(player)).villagers;
    expect(villagersBefore).to.be.greaterThan(0);
    expect((await program.account.player.fetch(player)).hasTent).to.equal(true);
    // Комиссию минта забирает казна, поэтому сверяем с фактическим остатком.
    const circuitSecond = await balance(secondCircuit), siliconSecond = await balance(secondSilicon);
    expect(xpBefore).to.equal(1_000);
    expect(circuitSecond.gtn(0) && siliconSecond.gtn(0), "перед второй попыткой у игрока обязаны быть излишки").to.equal(true);
    const second = new Transaction().add(
      await program.methods.resetForRebirth(seasonId).accounts({
        config: configPda, operator: authority, user: user.publicKey, player, season, seasonPass,
        materialMints: materialMintsPda, tokenProgram: TOKEN_PROGRAM_ID,
      }).remainingAccounts([
        { pubkey: circuitMint, isSigner: false, isWritable: true },
        { pubkey: secondCircuit, isSigner: false, isWritable: true },
        { pubkey: siliconMint, isSigner: false, isWritable: true },
        { pubkey: secondSilicon, isSigner: false, isWritable: true },
      ]).instruction(),
      await rebirth.methods.doRebirth().accounts({
        rebirthConfig, authority, rebirthRecord, user: user.publicKey, treasury: authority,
        systemProgram: SystemProgram.programId,
      }).instruction(),
    );
    let failed = false;
    try { await provider.sendAndConfirm(second, [user]); } catch { failed = true; }
    expect(failed, "вторая транзакция обязана упасть на кулдауне").to.equal(true);
    expect((await rebirth.account.rebirthRecord.fetch(rebirthRecord)).rebirthCount).to.equal(1);
    expect((await program.account.seasonPass.fetch(seasonPass)).xp).to.equal(xpBefore);
    expect((await program.account.player.fetch(player)).villagers).to.equal(villagersBefore);
    expect((await program.account.player.fetch(player)).hasTent).to.equal(true);
    expect((await balance(secondCircuit)).toString()).to.equal(circuitSecond.toString());
    expect((await balance(secondSilicon)).toString()).to.equal(siliconSecond.toString());
  });

});
