/**
 * [PAYER] Приёмочные тесты payer-remediation (пункт 10 плана, коммиты 4–6).
 *
 * ⚠️ PENDING VALIDATION: тесты написаны для `anchor test`, но НЕ ЗАПУСКАЛИСЬ.
 * В песочнице нет cargo/anchor/solana-test-validator, поэтому Rust/Anchor не
 * компилировался, IDL не перегенерировался и SBF-замеров нет (см. статус
 * «source-aligned manually; generated validation pending» в
 * docs/PAYER_REMEDIATION.md и обязательный блок в Draft PR #32).
 *
 * Десять payer cases в этом suite:
 *   1. InitPlayer получает rent от игрока; MintResource не создаёт отсутствующий профиль;
 *   2. MintTool получает rent ToolData от payer;
 *   3. неверный recipient отклоняется атомарно;
 *   4. authority authorizes, player co-signs/pays, and pass + replay cursor rent is charged only once;
 *   5. ATA rent списывается один раз, для existing ATA остаётся только network fee;
 *   6. authority authorizes, но без подписи payer mint не проходит;
 *   7. claim оплачивает Player + RewardReceipt; replay не повторяет mint/rent;
 *   8. claim без подписи игрока/с неверным payer отклоняется;
 *   9. недостаточный баланс не создаёт аккаунт и списывает только fee;
 *  10. authority balance не уменьшается при player-funded action.
 *
 * Async escrow cap, cranker deltas и timeout/refund warp проверяются в
 * `tests/aof_vrf_localnet.ts`; эти checks не остаются `it.skip`.
 * Все проверки используют реальные изменения lamports/балансов на валидаторе.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AofCore } from "../target/types/aof_core";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createMint } from "@solana/spl-token";
import { expect } from "chai";
import { waitForAccountOwner } from "./payer-transaction";

const B = (s: string) => Buffer.from(s);

describe("payer remediation: игрок платит за свои аккаунты", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.AofCore as Program<AofCore>;
  const authority = (provider.wallet as anchor.Wallet).payer;
  const connection = provider.connection;

  const configPda = PublicKey.findProgramAddressSync([B("config")], program.programId)[0];
  const authPda = PublicKey.findProgramAddressSync([B("auth")], program.programId)[0];
  const materialMintsPda = PublicKey.findProgramAddressSync([B("material_mints")], program.programId)[0];
  const pda = (seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0];
  const playerPda = (owner: PublicKey) => pda([B("player"), owner.toBuffer()]);
  const toolPda = (mint: PublicKey) => pda([B("tool"), mint.toBuffer()]);
  const vaultPda = pda([B("vault")]);
  const seasonPassPda = (owner: PublicKey, seasonId: number) => {
    const id = Buffer.alloc(4); id.writeUInt32LE(seasonId);
    return pda([B("season_pass"), owner.toBuffer(), id]);
  };
  const seasonXpClaimCursorPda = (owner: PublicKey, seasonId: number) => {
    const id = Buffer.alloc(4); id.writeUInt32LE(seasonId);
    return pda([B("season_xp_claim_cursor"), owner.toBuffer(), id]);
  };
  const issuanceCapPda = (kindByte: number) => pda([B("issuance_cap"), Uint8Array.of(kindByte)]);
  const rewardReceiptPda = (owner: PublicKey, rewardId: Buffer) => pda([B("reward_receipt"), owner.toBuffer(), rewardId]);
  let playerAccountRent: number | undefined;

  const balance = (key: PublicKey) => connection.getBalance(key, "confirmed");
  const airdrop = async (who: Keypair, sol = 20) => {
    const requested = sol * LAMPORTS_PER_SOL;
    const sig = await connection.requestAirdrop(who.publicKey, requested);
    const confirmation = await connection.confirmTransaction(sig, "confirmed");
    if (confirmation.value.err) throw new Error(`airdrop failed: ${JSON.stringify(confirmation.value.err)}`);
    const credited = await connection.getBalance(who.publicKey, "confirmed");
    if (credited < requested) throw new Error(`airdrop not visible for ${who.publicKey}: expected >= ${requested}, got ${credited}`);
  };
  const preparePayerTransaction = async (
    tx: anchor.web3.Transaction,
    payer: Keypair,
    extraSigners: Keypair[] = [],
  ) => {
    tx.feePayer = payer.publicKey;
    const { context, value: latest } = await connection.getLatestBlockhashAndContext("confirmed");
    tx.recentBlockhash = latest.blockhash;
    const message = tx.compileMessage();
    const required = message.accountKeys.slice(0, message.header.numRequiredSignatures);
    const candidates = [payer, ...extraSigners, authority];
    const signers = required.map((key) => candidates.find((candidate) => candidate.publicKey.equals(key)));
    const missing = required.filter((key) => !candidates.some((candidate) => candidate.publicKey.equals(key)));
    if (missing.length) throw new Error(`missing local test signer(s): ${missing.map((key) => key.toBase58()).join(", ")}`);
    tx.partialSign(...signers as Keypair[]);
    return { tx, latest, minContextSlot: context.slot };
  };
  const submitPayerTransaction = async (
    tx: anchor.web3.Transaction,
    payer: Keypair,
    options: { skipPreflight?: boolean; extraSigners?: Keypair[] } = {},
  ) => {
    const { tx: signed, latest, minContextSlot } = await preparePayerTransaction(tx, payer, options.extraSigners ?? []);
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: options.skipPreflight ?? false,
      preflightCommitment: "confirmed",
      minContextSlot,
      maxRetries: 0,
    });
    let err: any = null;
    let failedTransaction: any = null;
    try {
      const confirmation = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
      err = confirmation.value.err;
    } catch (confirmationError) {
      // web3.js rejects confirmTransaction with the raw TransactionError when
      // a submitted transaction fails on-chain (rather than returning value.err).
      try {
        failedTransaction = await connection.getTransaction(signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
      } catch {
        throw confirmationError;
      }
      if (!failedTransaction?.meta?.err) throw confirmationError;
      err = failedTransaction.meta.err;
    }
    if (err && !failedTransaction) {
      failedTransaction = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
    }
    return { signature, err, logs: failedTransaction?.meta?.logMessages ?? [] };
  };
  const waitForTokenMint = (mint: PublicKey) =>
    waitForAccountOwner(connection, mint, TOKEN_PROGRAM_ID, "SPL Token mint");
  const ensureAta = async (mint: PublicKey, owner: PublicKey, payer: Keypair) => {
    // A just-confirmed createMint can still be simulated against an older bank
    // which sees the mint as SystemProgram-owned; wait until this RPC observes Tokenkeg.
    await waitForTokenMint(mint);
    const ata = getAssociatedTokenAddressSync(mint, owner, true);
    if (await connection.getAccountInfo(ata)) return ata;
    const tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, owner, mint, TOKEN_PROGRAM_ID),
    );
    const result = await submitPayerTransaction(tx, payer);
    if (result.err) throw new Error(`ATA creation failed: ${JSON.stringify(result.err)}`);
    return ata;
  };
  /** Sign with the named player payer (plus only required local co-signers); do
   * not let AnchorProvider silently replace the action's fee payer. */
  const sendForPayer = async (builder: any, payer: Keypair, extraSigners: Keypair[] = []) => {
    const tx = await builder.transaction();
    const result = await submitPayerTransaction(tx, payer, { extraSigners });
    if (result.err) throw new Error(`player-funded transaction failed: ${JSON.stringify(result.err)}; ${(result.logs ?? []).join("\n")}`);
    return result.signature;
  };
  /** Submit a deliberately failing local-validator transaction without preflight,
   * so fee-payer lamport deltas and runtime atomicity are observable on chain. */
  const submitForPayerWithoutPreflight = async (builder: any, payer: Keypair) => {
    const tx = await builder.transaction();
    return submitPayerTransaction(tx, payer, { skipPreflight: true });
  };
  const sendWithoutPlayerSignature = async (builder: any, payer: Keypair) => {
    const tx = await builder.transaction();
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    return provider.sendAndConfirm(tx, [], { commitment: "confirmed", preflightCommitment: "confirmed" });
  };
  const transactionDeltas = async (signature: string) => {
    await connection.confirmTransaction(signature, "confirmed");
    const tx = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx?.meta) throw new Error(`transaction ${signature} not found`);
    const keys = tx.transaction.message.getAccountKeys().staticAccountKeys;
    const index = (key: PublicKey) => {
      const i = keys.findIndex((candidate) => candidate.equals(key));
      if (i < 0) throw new Error(`${key.toBase58()} is not an account of ${signature}`);
      return i;
    };
    const delta = (key: PublicKey) => tx.meta!.postBalances[index(key)] - tx.meta!.preBalances[index(key)];
    return Object.assign(delta, {
      fee: tx.meta.fee,
      pre: (key: PublicKey) => tx.meta!.preBalances[index(key)],
      err: tx.meta.err,
      logs: tx.meta.logMessages ?? [],
    });
  };
  const assertFailedPayerTransaction = async (builder: any, payer: Keypair, expectedLog?: string) => {
    const submitted = await submitForPayerWithoutPreflight(builder, payer);
    expect(submitted.err, "validator must execute and reject the transaction").to.not.equal(null);
    const delta = await transactionDeltas(submitted.signature);
    expect(delta.err).to.not.equal(null);
    if (expectedLog) expect(delta.logs.join("\n")).to.contain(expectedLog);
    return delta;
  };
  const lamports = (value: number | anchor.BN) => new anchor.BN(value.toString());

  /** Проверки payer-дельты сверяют balance authority вокруг player-funded транзакций. */
  const expectAuthorityUntouched = async (action: () => Promise<unknown>) => {
    const before = await balance(authority.publicKey);
    await action();
    const after = await balance(authority.publicKey);
    // Транзакцию отправлял игрок, поэтому authority платит только за свои
    // собственные действия. Для чужого действия дельта обязана быть нулевой.
    expect(after, "authority не должен финансировать действие игрока").to.equal(before);
  };

  it("1. InitPlayer charges profile rent to the player; MintResource fails closed without it and never creates it", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const player = playerPda(user.publicKey);
    expect(await connection.getAccountInfo(player)).to.equal(null);
    const cfg = await program.account.config.fetch(configPda);
    const mint = cfg.dataMint as PublicKey;
    const userAta = await ensureAta(mint, user.publicKey, user);
    const treasuryAta = await ensureAta(mint, cfg.treasury as PublicKey, authority);
    const beforeTokens = (await connection.getTokenAccountBalance(userAta)).value.amount;
    const authorityBefore = await balance(authority.publicKey);
    const absentProfileAccounts = {
      config: configPda, materialMints: materialMintsPda, authority: authority.publicKey, auth: authPda,
      issuanceCap: issuanceCapPda(0), mint, tokenAccount: userAta, treasuryToken: treasuryAta, player,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    };

    // Mirror the operator resource-mint route: player pays the fee and signs as
    // fee payer, authority co-signs authorization. An absent Player must fail
    // before any token/profile write.
    const userBeforeRejectedMint = await balance(user.publicKey);
    const rejectedMintDelta = await assertFailedPayerTransaction(program.methods.mintResource({ data: {} }, lamports(1_000_000_000)
      ).accounts(absentProfileAccounts), user, "PlayerNotInitialized");
    expect(rejectedMintDelta(player)).to.equal(0, "failed mint leaves the absent Player PDA absent and unfunded");
    expect(rejectedMintDelta(userAta)).to.equal(0, "failed mint rolls back token-account lamports and token state");
    expect(rejectedMintDelta(user.publicKey)).to.equal(-rejectedMintDelta.fee,
      "the player pays the failed transaction fee; no rent is charged");
    expect(rejectedMintDelta(authority.publicKey)).to.equal(0, "authority co-signs but pays no fee");
    expect(await connection.getAccountInfo(player)).to.equal(null);
    expect((await connection.getTokenAccountBalance(userAta)).value.amount).to.equal(beforeTokens);
    expect(await balance(user.publicKey)).to.equal(userBeforeRejectedMint - rejectedMintDelta.fee);
    expect(await balance(authority.publicKey)).to.equal(authorityBefore,
      "authority co-signed but did not pay the failed player transaction");

    const beforeInit = await balance(user.publicKey);
    const initSignature = await sendForPayer(program.methods.initPlayer().accounts({
      player: user.publicKey, playerProfile: player, systemProgram: SystemProgram.programId,
    }), user);
    const initDelta = await transactionDeltas(initSignature);
    const profileInfo = await connection.getAccountInfo(player, "confirmed");
    expect(profileInfo).to.not.equal(null);
    const profileRent = await connection.getMinimumBalanceForRentExemption(profileInfo!.data.length, "confirmed");
    playerAccountRent = profileRent;
    expect(initDelta(player)).to.equal(profileRent, "the Player PDA receives exactly rent-exempt balance");
    expect(initDelta(user.publicKey)).to.equal(-(profileRent + initDelta.fee), "player pays rent plus network fee");
    expect(await balance(user.publicKey)).to.be.lessThan(beforeInit);
    expect(await balance(authority.publicKey)).to.equal(authorityBefore, "authority is not the InitPlayer payer");
    expect((await program.account.player.fetch(player)).owner.toBase58()).to.equal(user.publicKey.toBase58());

    const playerLamports = await balance(player);
    const beforeMintTokens = (await connection.getTokenAccountBalance(userAta)).value.amount;
    const mintSignature = await sendForPayer(program.methods.mintResource({ data: {} }, lamports(1_000_000_000)
      ).accounts(absentProfileAccounts), user);
    const mintDelta = await transactionDeltas(mintSignature);
    expect(mintDelta(player)).to.equal(0, "MintResource reads, but does not init or fund, the existing Player PDA");
    expect(mintDelta(user.publicKey)).to.equal(-mintDelta.fee, "an existing ATA/profile incurs only the player's network fee");
    expect(await balance(player)).to.equal(playerLamports);
    expect((await connection.getTokenAccountBalance(userAta)).value.amount).to.not.equal(beforeMintTokens);
    expect(await balance(authority.publicKey)).to.equal(authorityBefore,
      "authority signs MintResource but is not the fee payer or Player rent payer");
  });

  it("2. player платит mint, ATA и ToolData, authority не платит", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const beforeMintAndAta = await balance(user.publicKey);
    // mint_tool expects a real, initialized zero-decimal SPL mint whose mint
    // authority is the program's auth PDA; player funds this mint and their ATA.
    const mint = await createMint(connection, user, authPda, null, 0);
    const toolData = toolPda(mint);
    const userToken = await ensureAta(mint, user.publicKey, user);
    expect(await balance(user.publicKey)).to.be.lessThan(beforeMintAndAta);
    expect(await connection.getAccountInfo(toolData)).to.equal(null);
    const before = await balance(user.publicKey);
    const authorityBefore = await balance(authority.publicKey);
    const signature = await sendForPayer(program.methods.mintTool("plasma_cutter", { common: {} })
      .accounts({
        config: configPda, authority: authority.publicKey, auth: authPda, mint,
        tokenAccount: userToken, recipient: user.publicKey, payer: user.publicKey, toolData,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      }), user);
    const delta = await transactionDeltas(signature);
    const toolDataInfo = await connection.getAccountInfo(toolData, "confirmed");
    expect(toolDataInfo).to.not.equal(null);
    const toolDataRent = await connection.getMinimumBalanceForRentExemption(toolDataInfo!.data.length, "confirmed");
    expect(delta(toolData)).to.equal(toolDataRent, "rent is credited to ToolData exactly once");
    expect(delta(user.publicKey)).to.equal(-(toolDataRent + delta.fee), "player pays ToolData rent and transaction fee");
    expect(delta(authority.publicKey)).to.equal(0, "authority co-signature does not fund ToolData or network fee");
    expect(await balance(user.publicKey)).to.be.lessThan(before);
    expect(await balance(authority.publicKey)).to.equal(authorityBefore);
    expect((await program.account.toolData.fetch(toolData)).owner.toBase58()).to.equal(user.publicKey.toBase58());

    // An operator-authorized/prepaid mint may have a distinct non-authority
    // payer. This proves authority != payer and authority != recipient without
    // making the authority a rent or network-fee sponsor.
    const sponsor = Keypair.generate(); await airdrop(sponsor, 2);
    const recipient = Keypair.generate();
    const sponsoredMint = await createMint(connection, sponsor, authPda, null, 0);
    const recipientToken = await ensureAta(sponsoredMint, recipient.publicKey, sponsor);
    const sponsoredToolData = toolPda(sponsoredMint);
    const sponsorBefore = await balance(sponsor.publicKey);
    const recipientBefore = await balance(recipient.publicKey);
    const authorityBeforeSponsored = await balance(authority.publicKey);
    const sponsoredSignature = await sendForPayer(program.methods.mintTool("plasma_cutter", { common: {} })
      .accounts({
        config: configPda, authority: authority.publicKey, auth: authPda, mint: sponsoredMint,
        tokenAccount: recipientToken, recipient: recipient.publicKey, payer: sponsor.publicKey, toolData: sponsoredToolData,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      }), sponsor);
    const sponsoredDelta = await transactionDeltas(sponsoredSignature);
    const sponsoredInfo = await connection.getAccountInfo(sponsoredToolData, "confirmed");
    expect(sponsoredInfo).to.not.equal(null);
    const sponsoredRent = await connection.getMinimumBalanceForRentExemption(sponsoredInfo!.data.length, "confirmed");
    expect(sponsoredDelta(sponsoredToolData)).to.equal(sponsoredRent);
    expect(sponsoredDelta(sponsor.publicKey)).to.equal(-(sponsoredRent + sponsoredDelta.fee));
    expect(sponsoredDelta(recipient.publicKey)).to.equal(0, "recipient does not fund the prepaid ToolData");
    expect(sponsoredDelta(authority.publicKey)).to.equal(0, "authority is neither payer nor recipient");
    expect(await balance(recipient.publicKey)).to.equal(recipientBefore);
    expect(await balance(authority.publicKey)).to.equal(authorityBeforeSponsored);
    expect((await program.account.toolData.fetch(sponsoredToolData)).owner.toBase58()).to.equal(recipient.publicKey.toBase58());
    expect((await connection.getTokenAccountBalance(recipientToken)).value.amount).to.equal("1");
  });

  it("3. wrong MintTool recipient fails atomically; payer and authority keep their roles", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const wrongRecipient = Keypair.generate();
    const mint = await createMint(connection, user, authPda, null, 0);
    const userToken = await ensureAta(mint, user.publicKey, user);
    const toolData = toolPda(mint);
    expect(await connection.getAccountInfo(toolData)).to.equal(null);
    const tokensBefore = (await connection.getTokenAccountBalance(userToken)).value.amount;
    const authorityBefore = await balance(authority.publicKey);
    const userBefore = await balance(user.publicKey);
    const delta = await assertFailedPayerTransaction(program.methods.mintTool("plasma_cutter", { common: {} })
      .accounts({
        config: configPda, authority: authority.publicKey, auth: authPda, mint,
        tokenAccount: userToken, recipient: wrongRecipient.publicKey, payer: user.publicKey, toolData,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      }), user);
    expect(delta(toolData)).to.equal(0, "mismatched recipient cannot create or fund ToolData");
    expect(delta(userToken)).to.equal(0, "failed mint leaves recipient ATA lamports unchanged");
    expect(delta(user.publicKey)).to.equal(-delta.fee, "the signing payer pays only the failed network fee");
    expect(delta(authority.publicKey)).to.equal(0, "authority does not pay or receive the tool");
    expect(await connection.getAccountInfo(toolData)).to.equal(null);
    expect((await connection.getTokenAccountBalance(userToken)).value.amount).to.equal(tokensBefore);
    expect(await balance(user.publicKey)).to.equal(userBefore - delta.fee);
    expect(await balance(authority.publicKey)).to.equal(authorityBefore);
  });

  it("4. authority authorizes; player signs/pays pass + replay cursor once, expiry and replay fail", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const seasonId = Math.floor(Date.now() / 1000) >>> 0;
    const seasonSeed = Buffer.alloc(4); seasonSeed.writeUInt32LE(seasonId);
    const season = pda([B("season"), seasonSeed]);
    await program.methods.initSeason(seasonId)
      .accounts({ config: configPda, authority: authority.publicKey, season, systemProgram: SystemProgram.programId })
      .rpc();

    // Keep the separate init_season_pass path too: its player is the payer,
    // and duplicate initialization can never transfer rent a second time.
    const initPlayer = Keypair.generate(); await airdrop(initPlayer);
    const initPass = seasonPassPda(initPlayer.publicKey, seasonId);
    const initBefore = await balance(initPlayer.publicKey);
    const authorityBeforeInit = await balance(authority.publicKey);
    const initSignature = await sendForPayer(program.methods.initSeasonPass(seasonId).accounts({
      config: configPda, player: initPlayer.publicKey, season, seasonPass: initPass,
      systemProgram: SystemProgram.programId,
    }), initPlayer);
    const initDelta = await transactionDeltas(initSignature);
    const initPassInfo = await connection.getAccountInfo(initPass, "confirmed");
    expect(initPassInfo).to.not.equal(null);
    const initPassRent = await connection.getMinimumBalanceForRentExemption(initPassInfo!.data.length, "confirmed");
    expect(initDelta(initPass)).to.equal(initPassRent);
    expect(initDelta(initPlayer.publicKey)).to.equal(-(initPassRent + initDelta.fee));
    expect(await balance(initPlayer.publicKey)).to.be.lessThan(initBefore);
    expect(await balance(authority.publicKey)).to.equal(authorityBeforeInit);
    const duplicateInit = await submitForPayerWithoutPreflight(program.methods.initSeasonPass(seasonId).accounts({
      config: configPda, player: initPlayer.publicKey, season, seasonPass: initPass,
      systemProgram: SystemProgram.programId,
    }), initPlayer);
    expect(duplicateInit.err).to.not.equal(null);
    const duplicateInitDelta = await transactionDeltas(duplicateInit.signature);
    expect(duplicateInitDelta(initPass)).to.equal(0);
    expect(duplicateInitDelta(initPlayer.publicKey)).to.equal(-duplicateInitDelta.fee);

    const seasonPass = seasonPassPda(user.publicKey, seasonId);
    const claimCursor = seasonXpClaimCursorPda(user.publicKey, seasonId);
    expect(await connection.getAccountInfo(seasonPass)).to.equal(null);
    expect(await connection.getAccountInfo(claimCursor)).to.equal(null);

    const grant = (amount: number, nonce: number, requestedExpirySlot?: number) => ({
      // Successful grants use a fresh bounded window; negative tests may pass
      // a previously expired slot without changing any signed fields.
      transaction: async () => {
        const expirySlot = requestedExpirySlot ?? (await connection.getSlot("confirmed")) + 20_000;
        return program.methods.grantSeasonXp(
          amount,
          seasonId,
          nonce,
          new anchor.BN(expirySlot.toString()),
          Array.from(Buffer.alloc(32, 0x31)),
          Array.from(Buffer.alloc(32, 0x50 + (nonce % 64))),
          Array.from(Buffer.alloc(32, 0x22)),
        ).accounts({
          config: configPda,
          authority: authority.publicKey,
          user: user.publicKey,
          season,
          seasonPass,
          claimCursor,
          systemProgram: SystemProgram.programId,
        }).transaction();
      },
    });

    const userBefore = await balance(user.publicKey);
    const authorityBefore = await balance(authority.publicKey);
    const grantSignature = await sendForPayer(grant(25, 0), user);
    const grantDelta = await transactionDeltas(grantSignature);
    const passInfo = await connection.getAccountInfo(seasonPass, "confirmed");
    const cursorInfo = await connection.getAccountInfo(claimCursor, "confirmed");
    expect(passInfo).to.not.equal(null);
    expect(cursorInfo).to.not.equal(null);
    const passRent = await connection.getMinimumBalanceForRentExemption(passInfo!.data.length, "confirmed");
    const cursorRent = await connection.getMinimumBalanceForRentExemption(cursorInfo!.data.length, "confirmed");
    expect(grantDelta(seasonPass)).to.equal(passRent, "first claim creates the SeasonPass at rent-exempt minimum");
    expect(grantDelta(claimCursor)).to.equal(cursorRent, "first claim creates one per-season replay cursor");
    expect(grantDelta(user.publicKey)).to.equal(-(passRent + cursorRent + grantDelta.fee),
      "player pays pass rent, cursor rent, and the network fee");
    expect(grantDelta(authority.publicKey)).to.equal(0, "authority co-signs but pays no rent or network fee");
    expect(await balance(user.publicKey)).to.be.lessThan(userBefore);
    expect(await balance(authority.publicKey)).to.equal(authorityBefore);
    expect((await program.account.seasonPass.fetch(seasonPass)).owner.toBase58()).to.equal(user.publicKey.toBase58());
    expect((await program.account.seasonPass.fetch(seasonPass)).xp).to.equal(25);
    expect((await program.account.seasonXpClaimCursor.fetch(claimCursor)).nextNonce).to.equal(1);

    // Both PDAs already exist: a later nonce pays only the network fee.
    const passLamports = await balance(seasonPass);
    const cursorLamports = await balance(claimCursor);
    const secondSignature = await sendForPayer(grant(10, 1), user);
    const secondDelta = await transactionDeltas(secondSignature);
    expect(secondDelta(seasonPass)).to.equal(0, "existing SeasonPass rent is not charged again");
    expect(secondDelta(claimCursor)).to.equal(0, "existing replay-cursor rent is not charged again");
    expect(secondDelta(user.publicKey)).to.equal(-secondDelta.fee, "player pays only the network fee on subsequent claims");
    expect(secondDelta(authority.publicKey)).to.equal(0);
    expect(await balance(seasonPass)).to.equal(passLamports);
    expect(await balance(claimCursor)).to.equal(cursorLamports);
    expect((await program.account.seasonPass.fetch(seasonPass)).xp).to.equal(35);
    expect((await program.account.seasonXpClaimCursor.fetch(claimCursor)).nextNonce).to.equal(2);
    expect(await balance(authority.publicKey)).to.equal(authorityBefore);

    const replay = await assertFailedPayerTransaction(grant(25, 0), user, "SeasonXpNonceMismatch");
    expect(replay(seasonPass)).to.equal(0, "a replay cannot change XP or pass rent");
    expect(replay(claimCursor)).to.equal(0, "a replay cannot move the cursor backwards");
    expect(replay(user.publicKey)).to.equal(-replay.fee, "player pays only the failed transaction fee");
    expect(replay(authority.publicKey)).to.equal(0);

    const expiredSlot = (await connection.getSlot("confirmed")) - 1;
    const expired = await assertFailedPayerTransaction(grant(5, 2, expiredSlot), user,
      "SeasonXpEntitlementExpired");
    expect(expired(seasonPass)).to.equal(0);
    expect(expired(claimCursor)).to.equal(0);
    expect((await program.account.seasonPass.fetch(seasonPass)).xp).to.equal(35,
      "failed and expired claims leave pass state unchanged");
    expect((await program.account.seasonXpClaimCursor.fetch(claimCursor)).nextNonce).to.equal(2);
    expect(await balance(authority.publicKey)).to.equal(authorityBefore);

    // Authority signature is over the exact instruction data; changing the
    // amount after signing makes serialization fail before any wallet can send.
    const tamperBuilder = grant(99, 2);
    const tamperTx = await tamperBuilder.transaction();
    const prepared = await preparePayerTransaction(tamperTx, user);
    prepared.tx.instructions[0].data[8] ^= 1;
    expect(() => prepared.tx.serialize()).to.throw();
  });

  it("5. отсутствующий ATA создаётся за rent игрока; повторная проверка existing account стоит только network fee", async () => {
    const user = Keypair.generate(); await airdrop(user);
    // The test is about the player's ATA rent; prepare the mint separately as
    // project infrastructure so the Token Program can validate the mint.
    const mint = await createMint(connection, authority, authority.publicKey, null, 9);
    await waitForTokenMint(mint);
    const atas = getAssociatedTokenAddressSync(mint, user.publicKey);
    expect(await connection.getAccountInfo(atas)).to.equal(null);
    const before = await balance(user.publicKey);
    const authorityBefore = await balance(authority.publicKey);
    const createAta = () => new anchor.web3.Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(user.publicKey, atas, user.publicKey, mint, TOKEN_PROGRAM_ID),
    );
    const first = createAta();
    first.feePayer = user.publicKey;
    first.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    const firstResult = await submitPayerTransaction(first, user);
    const firstDelta = await transactionDeltas(firstResult.signature);
    const after = await connection.getAccountInfo(atas, "confirmed");
    expect(after, "ATA обязана появиться").to.not.equal(null);
    const ataRent = await connection.getMinimumBalanceForRentExemption(after!.data.length, "confirmed");
    expect(firstDelta(atas)).to.equal(ataRent, "ATA receives the canonical rent-exempt minimum");
    expect(firstDelta(user.publicKey)).to.equal(-(ataRent + firstDelta.fee), "player pays ATA rent and network fee");
    expect(await balance(user.publicKey)).to.be.lessThan(before);
    expect(await balance(authority.publicKey)).to.equal(authorityBefore);

    // An existing ATA gets rentDue=0: the idempotent repeat pays only a network fee.
    const mid = await balance(user.publicKey);
    const again = createAta();
    again.feePayer = user.publicKey;
    again.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    const againResult = await submitPayerTransaction(again, user);
    const repeatDelta = await transactionDeltas(againResult.signature);
    expect(repeatDelta(atas)).to.equal(0, "existing ATA is not rent-charged twice");
    expect(repeatDelta(user.publicKey)).to.equal(-repeatDelta.fee, "the repeat pays only network fee");
    expect(await balance(user.publicKey)).to.equal(mid - repeatDelta.fee);
    expect(await balance(authority.publicKey)).to.equal(authorityBefore);
  });

  it("6. authority authorizes MintTool but does not fund; missing payer signature is rejected", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const mint = await createMint(connection, user, authPda, null, 0);
    const toolData = toolPda(mint);
    const userToken = await ensureAta(mint, user.publicKey, user);
    const userBefore = await balance(user.publicKey);
    const authorityBefore = await balance(authority.publicKey);
    // Без подписи игрока (payer = recipient = player) клиент не должен собрать транзакцию.
    let rejected = false;
    try {
      await sendWithoutPlayerSignature(program.methods.mintTool("plasma_cutter", { common: {} })
        .accounts({
          config: configPda, authority: authority.publicKey, auth: authPda, mint,
          tokenAccount: userToken, recipient: user.publicKey, payer: user.publicKey, toolData,
          tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        }), user);
    } catch (error: any) {
      rejected = /missing signature|Signature verification failed|unknown signer/i.test(String(error?.message ?? error));
    }
    expect(rejected, "минт без подписи плательщика обязан быть отклонён").to.equal(true);
    expect(await connection.getAccountInfo(toolData)).to.equal(null);
    expect((await connection.getTokenAccountBalance(userToken)).value.amount).to.equal("0");
    expect(await balance(user.publicKey)).to.equal(userBefore, "unsigned transaction is rejected before any payer debit");
    expect(await balance(authority.publicKey)).to.equal(authorityBefore, "authority does not substitute for the missing player signature");
  });

  it("7. reward claim charges the player for Player and RewardReceipt; replay has no rent or token side effects", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const config = await program.account.config.fetch(configPda);
    const mint = config.dataMint as PublicKey;
    const userToken = await ensureAta(mint, user.publicKey, user);
    const treasuryToken = await ensureAta(mint, config.treasury as PublicKey, authority);
    const rewardId = Buffer.alloc(32, 7);
    const player = playerPda(user.publicKey);
    const receipt = rewardReceiptPda(user.publicKey, rewardId);
    expect(await connection.getAccountInfo(player)).to.equal(null);
    expect(await connection.getAccountInfo(receipt)).to.equal(null);
    const before = await balance(user.publicKey);
    const authorityBefore = await balance(authority.publicKey);
    const signature = await sendForPayer(program.methods.mintResourceOnce({ data: {} }, lamports(1_000), Array.from(rewardId))
      .accounts({
        config: configPda, materialMints: materialMintsPda, authority: authority.publicKey, auth: authPda,
        mint, tokenAccount: userToken, treasuryToken,
        payer: user.publicKey, player, issuanceCap: issuanceCapPda(0),
        tokenProgram: TOKEN_PROGRAM_ID, rewardReceipt: receipt, systemProgram: SystemProgram.programId,
      }), user);
    const delta = await transactionDeltas(signature);
    const playerInfo = await connection.getAccountInfo(player, "confirmed");
    const receiptInfo = await connection.getAccountInfo(receipt, "confirmed");
    expect(playerInfo).to.not.equal(null);
    expect(receiptInfo).to.not.equal(null);
    const playerRent = await connection.getMinimumBalanceForRentExemption(playerInfo!.data.length, "confirmed");
    const receiptRent = await connection.getMinimumBalanceForRentExemption(receiptInfo!.data.length, "confirmed");
    expect(delta(player)).to.equal(playerRent);
    expect(delta(receipt)).to.equal(receiptRent);
    expect(delta(user.publicKey)).to.equal(-(playerRent + receiptRent + delta.fee),
      "claim payer pays Player rent, RewardReceipt rent, and network fee");
    expect(delta(authority.publicKey)).to.equal(0, "authority only authorizes the claim");
    expect(await balance(user.publicKey)).to.be.lessThan(before);
    expect(await balance(authority.publicKey)).to.equal(authorityBefore);
    expect((await program.account.rewardReceipt.fetch(receipt)).recipient.toBase58()).to.equal(user.publicKey.toBase58());

    // Reusing the same (recipient, reward_id) is a physical replay rejection.
    // The existing Player/receipt receive no second rent, token CPI is rolled
    // back, and only the player's failed-transaction fee is charged.
    const tokensAfterClaim = (await connection.getTokenAccountBalance(userToken)).value.amount;
    const userBeforeReplay = await balance(user.publicKey);
    const replay = await submitForPayerWithoutPreflight(program.methods.mintResourceOnce(
      { data: {} }, lamports(1_000), Array.from(rewardId),
    ).accounts({
      config: configPda, materialMints: materialMintsPda, authority: authority.publicKey, auth: authPda,
      mint, tokenAccount: userToken, treasuryToken,
      payer: user.publicKey, player, issuanceCap: issuanceCapPda(0),
      tokenProgram: TOKEN_PROGRAM_ID, rewardReceipt: receipt, systemProgram: SystemProgram.programId,
    }), user);
    expect(replay.err, "same reward id must not initialize a second claim").to.not.equal(null);
    const replayDelta = await transactionDeltas(replay.signature);
    expect(replayDelta(player)).to.equal(0);
    expect(replayDelta(receipt)).to.equal(0);
    expect(replayDelta(userToken)).to.equal(0);
    expect(replayDelta(user.publicKey)).to.equal(-replayDelta.fee);
    expect(replayDelta(authority.publicKey)).to.equal(0);
    expect((await connection.getTokenAccountBalance(userToken)).value.amount).to.equal(tokensAfterClaim,
      "failed replay rolls back every mint CPI");
    expect(await balance(user.publicKey)).to.equal(userBeforeReplay - replayDelta.fee);
  });

  it("8. claim without player signature or with wrong payer fails without creating Player or receipt", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const stranger = Keypair.generate(); await airdrop(stranger);
    const config = await program.account.config.fetch(configPda);
    const mint = config.dataMint as PublicKey;
    const userToken = await ensureAta(mint, user.publicKey, user);
    const treasuryToken = await ensureAta(mint, config.treasury as PublicKey, authority);
    const rewardId = Buffer.alloc(32, 9);
    const player = playerPda(user.publicKey);
    const receipt = rewardReceiptPda(user.publicKey, rewardId);
    const userBeforeUnsigned = await balance(user.publicKey);
    const strangerBeforeUnsigned = await balance(stranger.publicKey);
    const authorityBefore = await balance(authority.publicKey);
    let missingPlayerSignatureRejected = false;
    try {
      await sendWithoutPlayerSignature(program.methods.mintResourceOnce({ data: {} }, lamports(1_000), Array.from(rewardId))
        .accounts({
          config: configPda, materialMints: materialMintsPda, authority: authority.publicKey, auth: authPda,
          mint, tokenAccount: userToken, treasuryToken,
          payer: user.publicKey, player: playerPda(user.publicKey), issuanceCap: issuanceCapPda(0),
          tokenProgram: TOKEN_PROGRAM_ID, rewardReceipt: receipt, systemProgram: SystemProgram.programId,
        }), user);
    } catch (error: any) {
      missingPlayerSignatureRejected = /signature|signer/i.test(String(error?.message ?? error));
    }
    expect(missingPlayerSignatureRejected, "claim без подписи payer/player не должен быть отправлен").to.equal(true);
    expect(await connection.getAccountInfo(player)).to.equal(null);
    expect(await connection.getAccountInfo(receipt)).to.equal(null);
    expect(await balance(user.publicKey)).to.equal(userBeforeUnsigned, "missing signature is rejected before charging the player");
    expect(await balance(stranger.publicKey)).to.equal(strangerBeforeUnsigned);
    expect(await balance(authority.publicKey)).to.equal(authorityBefore);

    const wrongPayerDelta = await assertFailedPayerTransaction(program.methods.mintResourceOnce(
      { data: {} }, lamports(1_000), Array.from(rewardId),
    ).accounts({
      config: configPda, materialMints: materialMintsPda, authority: authority.publicKey, auth: authPda,
      mint, tokenAccount: userToken, treasuryToken,
      payer: stranger.publicKey, player, issuanceCap: issuanceCapPda(0),
      tokenProgram: TOKEN_PROGRAM_ID, rewardReceipt: receipt, systemProgram: SystemProgram.programId,
    }), stranger, "Unauthorized");
    expect(wrongPayerDelta(stranger.publicKey)).to.equal(-wrongPayerDelta.fee,
      "unauthorized payer pays only the failed network fee, not Player/receipt rent");
    expect(wrongPayerDelta(player)).to.equal(0);
    expect(wrongPayerDelta(receipt)).to.equal(0);
    expect(wrongPayerDelta(userToken)).to.equal(0);
    expect(wrongPayerDelta(authority.publicKey)).to.equal(0);
    expect(await connection.getAccountInfo(player)).to.equal(null);
    expect(await connection.getAccountInfo(receipt)).to.equal(null);
    expect(await balance(stranger.publicKey)).to.equal(strangerBeforeUnsigned - wrongPayerDelta.fee);
    expect(await balance(authority.publicKey)).to.equal(authorityBefore);
  });

  // Async cap/reimbursement and warp-based timeout refund are active physical
  // local-validator tests in tests/aof_vrf_localnet.ts (CI requires the mock).

  it("9. insufficient player balance fails atomically; only the player's network fee is charged", async () => {
    expect(playerAccountRent, "case 1 must capture the runtime Player rent").to.be.a("number");
    const requiredRent = playerAccountRent!;
    expect(requiredRent).to.be.greaterThan(20_000, "leave enough lamports to pay the failed transaction fee");
    const user = Keypair.generate();
    const funded = requiredRent - 20_000;
    await connection.confirmTransaction(await connection.requestAirdrop(user.publicKey, funded), "confirmed");
    const before = await balance(user.publicKey);
    expect(before).to.equal(funded);
    expect(before).to.be.lessThan(requiredRent, "payer cannot fund the Player PDA's rent-exempt minimum");
    const player = playerPda(user.publicKey);
    expect(await connection.getAccountInfo(player)).to.equal(null);
    const authorityBefore = await balance(authority.publicKey);

    const delta = await assertFailedPayerTransaction(program.methods.initPlayer().accounts({
      player: user.publicKey, playerProfile: player, systemProgram: SystemProgram.programId,
    }), user);
    expect(delta(player)).to.equal(0, "failed create-account CPI leaves the PDA absent and unfunded");
    expect(delta(user.publicKey)).to.equal(-delta.fee, "failed atomic init charges only the payer's network fee");
    expect(await balance(user.publicKey)).to.equal(before - delta.fee);
    expect(await balance(authority.publicKey)).to.equal(authorityBefore, "project authority does not rescue an underfunded player");
    expect(await connection.getAccountInfo(player)).to.equal(null);
  });

  it("10. authority balance не уменьшается при обычном действии игрока", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const before = await balance(user.publicKey);
    await expectAuthorityUntouched(async () => {
      await sendForPayer(program.methods.depositGas(lamports(1_000))
        .accounts({ config: configPda, user: user.publicKey, gastank: pda([B("gastank"), user.publicKey.toBuffer()]), treasury: authority.publicKey, systemProgram: SystemProgram.programId }), user);
    });
    expect(await balance(user.publicKey)).to.be.lessThan(before);
  });
});
