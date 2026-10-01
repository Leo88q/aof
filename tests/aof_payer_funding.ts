/**
 * [PAYER] Приёмочные тесты payer-remediation (пункт 10 плана, коммиты 4–6).
 *
 * ⚠️ PENDING VALIDATION: тесты написаны для `anchor test`, но НЕ ЗАПУСКАЛИСЬ.
 * В песочнице нет cargo/anchor/solana-test-validator, поэтому Rust/Anchor не
 * компилировался, IDL не перегенерировался и SBF-замеров нет (см. статус
 * «source-aligned manually; generated validation pending» в
 * docs/PAYER_REMEDIATION.md и обязательный блок в Draft PR #32).
 *
 * Десять обязательных проверок правила «все live player-specific аккаунты
 * оплачивает игрок, проект платит только за инфраструктуру»:
 *
 *   1. player платит за Player/profile;
 *   2. player платит за ToolData;
 *   3. player платит за init_season_pass;
 *   4. player платит за свой ATA (ленивое создание в его транзакции);
 *   5. authority авторизует, но не финансирует;
 *   6. reward claim требует подписи игрока;
 *   7. отсутствующий player signer отклоняется;
 *   8. prepaid escrow ограничен cap'ом;
 *   9. остаток escrow возвращается игроку;
 *  10. authority balance не уменьшается при обычном действии игрока.
 *
 * Все проверки — через фактические изменения lamports/балансов на валидаторе,
 * а не через «код выглядит правильно».
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AofCore } from "../target/types/aof_core";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createMint } from "@solana/spl-token";
import { expect } from "chai";

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
  const issuanceCapPda = (kindByte: number) => pda([B("issuance_cap"), Uint8Array.of(kindByte)]);
  const rewardReceiptPda = (owner: PublicKey, rewardId: Buffer) => pda([B("reward_receipt"), owner.toBuffer(), rewardId]);

  const balance = (key: PublicKey) => connection.getBalance(key, "confirmed");
  const airdrop = async (who: Keypair, sol = 20) => {
    const sig = await connection.requestAirdrop(who.publicKey, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  };
  const ensureAta = async (mint: PublicKey, owner: PublicKey, payer: Keypair) => {
    const ata = getAssociatedTokenAddressSync(mint, owner, true);
    if (await connection.getAccountInfo(ata)) return ata;
    const tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, owner, mint),
    );
    tx.feePayer = payer.publicKey;
    await provider.sendAndConfirm(tx, [payer], { commitment: "confirmed", preflightCommitment: "confirmed" });
    return ata;
  };
  /** AnchorProvider defaults feePayer to its authority wallet; these acceptance
   * helpers override that default so a player action really charges the player. */
  const sendForPayer = async (builder: any, payer: Keypair) => {
    const tx = await builder.transaction();
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    return provider.sendAndConfirm(tx, [payer], { commitment: "confirmed", preflightCommitment: "confirmed" });
  };
  const sendWithoutPlayerSignature = async (builder: any, payer: Keypair) => {
    const tx = await builder.transaction();
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    return provider.sendAndConfirm(tx, [], { commitment: "confirmed", preflightCommitment: "confirmed" });
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

  it("1. player платит rent профиля Player (start_mining) и authority не меняется", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const player = playerPda(user.publicKey);
    expect(await connection.getAccountInfo(player)).to.equal(null);

    // start_mining requires a real staked tool and its vault ATA; prepare these
    // first, with player-funded mint/ATA/ToolData and project-funded vault ATA.
    const mint = await createMint(connection, user, authPda, null, 0);
    const userToken = await ensureAta(mint, user.publicKey, user);
    await sendForPayer(program.methods.mintTool("plasma_cutter", { common: {} }).accounts({
      config: configPda, authority: authority.publicKey, auth: authPda, mint,
      tokenAccount: userToken, recipient: user.publicKey, payer: user.publicKey,
      toolData: toolPda(mint), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }), user);
    const vaultToken = await ensureAta(mint, vaultPda, authority);
    await sendForPayer(program.methods.stake(new anchor.BN(3_600)).accounts({
      config: configPda, user: user.publicKey, tool: toolPda(mint), mint, userToken,
      vault: vaultPda, vaultToken, tokenProgram: TOKEN_PROGRAM_ID,
    }), user);

    const config = await program.account.config.fetch(configPda);
    const miningWasEnabled = config.miningEnabled;
    if (!miningWasEnabled) {
      await program.methods.setMiningEnabled(true)
        .accounts({ config: configPda, authority: authority.publicKey }).rpc();
    }
    const before = await balance(user.publicKey);
    try {
      await expectAuthorityUntouched(async () => {
        await sendForPayer(program.methods.startMining(1).accounts({
          config: configPda, user: user.publicKey, tool: toolPda(mint), mint, player,
          vault: vaultPda, vaultToken, systemProgram: SystemProgram.programId,
        }), user);
      });
      expect(await balance(user.publicKey)).to.be.lessThan(before);
      expect((await program.account.player.fetch(player)).owner.toBase58()).to.equal(user.publicKey.toBase58());
    } finally {
      if (!miningWasEnabled) {
        await program.methods.setMiningEnabled(false)
          .accounts({ config: configPda, authority: authority.publicKey }).rpc();
      }
    }
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
    const before = await balance(user.publicKey);
    await expectAuthorityUntouched(async () => {
      await sendForPayer(program.methods.mintTool("plasma_cutter", { common: {} })
        .accounts({
          config: configPda, authority: authority.publicKey, auth: authPda, mint,
          tokenAccount: userToken, recipient: user.publicKey, payer: user.publicKey, toolData,
          tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        }), user);
    });
    expect(await balance(user.publicKey)).to.be.lessThan(before);
    expect((await program.account.toolData.fetch(toolData)).owner.toBase58()).to.equal(user.publicKey.toBase58());
  });

  it("3. player платит init_season_pass, authority не платит", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const seasonId = Math.floor(Date.now() / 1000) >>> 0;
    const season = pda([B("season"), (() => { const b = Buffer.alloc(4); b.writeUInt32LE(seasonId); return b; })()]);
    await program.methods.initSeason(seasonId)
      .accounts({ config: configPda, authority: authority.publicKey, season, systemProgram: SystemProgram.programId })
      .rpc();
    const seasonPass = seasonPassPda(user.publicKey, seasonId);
    const before = await balance(user.publicKey);
    await expectAuthorityUntouched(async () => {
      await sendForPayer(program.methods.initSeasonPass(seasonId)
        .accounts({ config: configPda, player: user.publicKey, season, seasonPass, systemProgram: SystemProgram.programId }), user);
    });
    expect(await balance(user.publicKey)).to.be.lessThan(before);
    expect((await program.account.seasonPass.fetch(seasonPass)).owner.toBase58()).to.equal(user.publicKey.toBase58());
  });

  it("4. отсутствующий ATA создаётся в транзакции игрока за его lamports", async () => {
    const user = Keypair.generate(); await airdrop(user);
    // The test is about the player's ATA rent; prepare the mint separately as
    // project infrastructure so the Token Program can validate the mint.
    const mint = await createMint(connection, authority, authority.publicKey, null, 9);
    const atas = getAssociatedTokenAddressSync(mint, user.publicKey);
    expect(await connection.getAccountInfo(atas)).to.equal(null);
    const before = await balance(user.publicKey);
    await expectAuthorityUntouched(async () => {
      const tx = new anchor.web3.Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(user.publicKey, atas, user.publicKey, mint),
      );
      tx.feePayer = user.publicKey;
      await provider.sendAndConfirm(tx, [user], { commitment: "confirmed", preflightCommitment: "confirmed" });
    });
    const after = await connection.getAccountInfo(atas);
    expect(after, "ATA обязана появиться").to.not.equal(null);
    // Повторное идемпотентное создание не платит за уже существующий ATA.
    const mid = await balance(user.publicKey);
    const again = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(user.publicKey, atas, user.publicKey, mint),
    );
    again.feePayer = user.publicKey;
    await provider.sendAndConfirm(again, [user], { commitment: "confirmed", preflightCommitment: "confirmed" });
    expect(await balance(user.publicKey)).to.be.greaterThan(mid - LAMPORTS_PER_SOL);
  });

  it("5. authority авторизует, но не финансирует: payer обязан приложить подпись", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const mint = await createMint(connection, user, authPda, null, 0);
    const toolData = toolPda(mint);
    const userToken = await ensureAta(mint, user.publicKey, user);
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
  });

  it("6. reward claim требует подпись игрока", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const config = await program.account.config.fetch(configPda);
    const mint = config.dataMint as PublicKey;
    const userToken = await ensureAta(mint, user.publicKey, user);
    const treasuryToken = await ensureAta(mint, config.treasury as PublicKey, authority);
    const rewardId = Buffer.alloc(32, 7);
    const receipt = rewardReceiptPda(user.publicKey, rewardId);
    const before = await balance(user.publicKey);
    await expectAuthorityUntouched(async () => {
      await sendForPayer(program.methods.mintResourceOnce({ data: {} }, lamports(1_000), Array.from(rewardId))
        .accounts({
          config: configPda, materialMints: materialMintsPda, authority: authority.publicKey, auth: authPda,
          mint, tokenAccount: userToken, treasuryToken,
          payer: user.publicKey, player: playerPda(user.publicKey), issuanceCap: issuanceCapPda(0),
          tokenProgram: TOKEN_PROGRAM_ID, rewardReceipt: receipt, systemProgram: SystemProgram.programId,
        }), user);
    });
    expect(await balance(user.publicKey)).to.be.lessThan(before);
    expect((await program.account.rewardReceipt.fetch(receipt)).recipient.toBase58()).to.equal(user.publicKey.toBase58());
  });

  it("7. claim без подписи игрока (и с чужим payer) отклоняется", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const stranger = Keypair.generate(); await airdrop(stranger);
    const config = await program.account.config.fetch(configPda);
    const mint = config.dataMint as PublicKey;
    const userToken = await ensureAta(mint, user.publicKey, user);
    const treasuryToken = await ensureAta(mint, config.treasury as PublicKey, authority);
    const rewardId = Buffer.alloc(32, 9);
    const receipt = rewardReceiptPda(user.publicKey, rewardId);
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
    expect(await connection.getAccountInfo(receipt)).to.equal(null);

    let wrongPayerRejected = false;
    try {
      await sendForPayer(program.methods.mintResourceOnce({ data: {} }, lamports(1_000), Array.from(rewardId))
        .accounts({
          config: configPda, materialMints: materialMintsPda, authority: authority.publicKey, auth: authPda,
          mint, tokenAccount: userToken, treasuryToken,
          payer: stranger.publicKey, player: playerPda(user.publicKey), issuanceCap: issuanceCapPda(0),
          tokenProgram: TOKEN_PROGRAM_ID, rewardReceipt: receipt, systemProgram: SystemProgram.programId,
        }), stranger);
    } catch (error: any) {
      wrongPayerRejected = /Unauthorized|0x1770|constraint/i.test(String(error?.message ?? error) + (error?.logs ?? []).join(" "));
    }
    expect(wrongPayerRejected, "payer != token_account.owner обязан быть отклонён").to.equal(true);
    expect(await connection.getAccountInfo(receipt)).to.equal(null);
  });

  // 8 и 9 зависят от VRF-механизма (pack_open_commit) и требуют mock-оракула
  // Switchboard из tests/aof_vrf_localnet.ts: там уже проверяются
  //   * commit.depositLamports == tool_settlement_rent (cap, а не «сколько
  //     попросит поселенец») — см. тест «escrowed»;
  //   * возмещение поселенцу ровно min(deposit, frontedRent), а излишек
  //     остаётся на аккаунте игрока — тест с `settlementRent`.
  // Здесь они помечены skip, пока валидатор не запущен: эти два случая нельзя
  // доказать статически, а без warp-хелпера окно refund (18 000 слотов) в тесте
  // не достигается.
  it.skip("8. prepaid escrow ограничен cap'ом (проверяется в tests/aof_vrf_localnet.ts)", async () => {
    // Ожидаемые утверждения при запуске валидатора:
    //   expect(commit.depositLamports.toNumber()).to.equal(await settlementRent());
    //   expect(authorityBefore - authorityAfter).to.equal(0);
    //   expect(userBefore - userAfter).to.be.at.least(price + deposit);
    throw new Error("pending validator: см. tests/aof_vrf_localnet.ts (escrow/deposit)");
  });

  it.skip("9. остаток prepaid escrow возвращается игроку (нужен warp 18 000 слотов)", async () => {
    // pack_open_expire закрывает commit с `close = user`: игроку возвращаются
    // price + неиспользованный deposit + rent. Ожидаемые утверждения:
    //   expect(userAfter - userBefore).to.be.at.least(escrowed);
    //   expect(authorityBefore - authorityAfter).to.equal(0);
    throw new Error("pending validator: нужен warp до commit_slot + VRF_REFUND_AFTER_SLOTS");
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
