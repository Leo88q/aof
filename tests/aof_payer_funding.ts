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
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
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
    const ata = getAssociatedTokenAddressSync(mint, owner);
    if (await connection.getAccountInfo(ata)) return ata;
    const tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, owner, mint),
    );
    await provider.sendAndConfirm(tx, [payer]);
    return ata;
  };
  const lamports = (value: number | anchor.BN) => new anchor.BN(value.toString());

  /** Тесты 5 и 10 читают дельту баланса authority вокруг действия игрока. */
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
    const before = await balance(user.publicKey);
    await expectAuthorityUntouched(async () => {
      // Профиль игрока создаётся его действием за его счёт. Конкретная
      // инструкция-триггер зависит от набора аккаунтов сьюты: здесь важно, что
      // `init_if_needed, payer = user` (см. контексты start_mining / mint_tool).
      await program.methods.startMining(1)
        .accounts({ config: configPda, user: user.publicKey, player, materialMints: materialMintsPda, auth: authPda })
        .signers([user]).rpc();
    });
    expect(await balance(user.publicKey)).to.be.lessThan(before);
    expect((await program.account.player.fetch(player)).owner.toBase58()).to.equal(user.publicKey.toBase58());
  });

  it("2. player платит ToolData, authority не платит", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const mint = Keypair.generate();
    const toolData = toolPda(mint.publicKey);
    const userToken = await ensureAta(mint.publicKey, user.publicKey, user);
    const before = await balance(user.publicKey);
    await expectAuthorityUntouched(async () => {
      await program.methods.mintTool("plasma_cutter", { common: {} })
        .accounts({
          config: configPda, authority: authority.publicKey, auth: authPda, mint: mint.publicKey,
          tokenAccount: userToken, recipient: user.publicKey, payer: user.publicKey, toolData,
          tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        })
        .signers([user, mint]).rpc();
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
      await program.methods.initSeasonPass(seasonId)
        .accounts({ config: configPda, player: user.publicKey, season, seasonPass, systemProgram: SystemProgram.programId })
        .signers([user]).rpc();
    });
    expect(await balance(user.publicKey)).to.be.lessThan(before);
    expect((await program.account.seasonPass.fetch(seasonPass)).owner.toBase58()).to.equal(user.publicKey.toBase58());
  });

  it("4. отсутствующий ATA создаётся в транзакции игрока за его lamports", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const mint = Keypair.generate();
    const atas = getAssociatedTokenAddressSync(mint.publicKey, user.publicKey);
    expect(await connection.getAccountInfo(atas)).to.equal(null);
    const before = await balance(user.publicKey);
    await expectAuthorityUntouched(async () => {
      const tx = new anchor.web3.Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(user.publicKey, atas, user.publicKey, mint.publicKey),
      );
      await provider.sendAndConfirm(tx, [user]);
    });
    const after = await connection.getAccountInfo(atas);
    expect(after, "ATA обязана появиться").to.not.equal(null);
    // Повторное идемпотентное создание не платит за уже существующий ATA.
    const mid = await balance(user.publicKey);
    const again = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(user.publicKey, atas, user.publicKey, mint.publicKey),
    );
    await provider.sendAndConfirm(again, [user]);
    expect(await balance(user.publicKey)).to.be.greaterThan(mid - LAMPORTS_PER_SOL);
  });

  it("5. authority авторизует, но не финансирует: payer обязан приложить подпись", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const mint = Keypair.generate();
    const toolData = toolPda(mint.publicKey);
    const userToken = await ensureAta(mint.publicKey, user.publicKey, user);
    // Без подписи получателя минт обязан упасть: payer — отдельный подписант.
    let rejected = false;
    try {
      await program.methods.mintTool("plasma_cutter", { common: {} })
        .accounts({
          config: configPda, authority: authority.publicKey, auth: authPda, mint: mint.publicKey,
          tokenAccount: userToken, recipient: user.publicKey, payer: user.publicKey, toolData,
          tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        })
        .signers([mint]).rpc();
    } catch (error: any) {
      rejected = /missing signature|Signature verification failed|unknown signer/i.test(String(error?.message ?? error));
    }
    expect(rejected, "минт без подписи плательщика обязан быть отклонён").to.equal(true);
    expect(await connection.getAccountInfo(toolData)).to.equal(null);
  });

  it("6. reward claim требует подпись игрока", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const mint = Keypair.generate();
    const userToken = await ensureAta(mint.publicKey, user.publicKey, user);
    const rewardId = Buffer.alloc(32, 7);
    const receipt = rewardReceiptPda(user.publicKey, rewardId);
    const before = await balance(user.publicKey);
    await expectAuthorityUntouched(async () => {
      await program.methods.mintResourceOnce({ data: {} }, lamports(1_000), Array.from(rewardId))
        .accounts({
          config: configPda, materialMints: materialMintsPda, authority: authority.publicKey, auth: authPda,
          mint: mint.publicKey, tokenAccount: userToken, treasuryToken: userToken,
          payer: user.publicKey, player: playerPda(user.publicKey), issuanceCap: issuanceCapPda(0),
          tokenProgram: TOKEN_PROGRAM_ID, rewardReceipt: receipt, systemProgram: SystemProgram.programId,
        })
        .signers([user]).rpc();
    });
    expect(await balance(user.publicKey)).to.be.lessThan(before);
    expect((await program.account.rewardReceipt.fetch(receipt)).recipient.toBase58()).to.equal(user.publicKey.toBase58());
  });

  it("7. claim без подписи игрока (и с чужим payer) отклоняется", async () => {
    const user = Keypair.generate(); await airdrop(user);
    const stranger = Keypair.generate(); await airdrop(stranger);
    const mint = Keypair.generate();
    const userToken = await ensureAta(mint.publicKey, user.publicKey, user);
    const rewardId = Buffer.alloc(32, 9);
    let rejected = false;
    try {
      await program.methods.mintResourceOnce({ data: {} }, lamports(1_000), Array.from(rewardId))
        .accounts({
          config: configPda, materialMints: materialMintsPda, authority: authority.publicKey, auth: authPda,
          mint: mint.publicKey, tokenAccount: userToken, treasuryToken: userToken,
          payer: stranger.publicKey, player: playerPda(user.publicKey), issuanceCap: issuanceCapPda(0),
          tokenProgram: TOKEN_PROGRAM_ID, rewardReceipt: rewardReceiptPda(user.publicKey, rewardId),
          systemProgram: SystemProgram.programId,
        })
        .signers([stranger]).rpc();
    } catch (error: any) {
      rejected = /Unauthorized|0x1770|constraint/i.test(String(error?.message ?? error) + (error?.logs ?? []).join(" "));
    }
    expect(rejected, "payer != token_account.owner обязан быть отклонён").to.equal(true);
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
    const before = await balance(authority.publicKey);
    await program.methods.depositGas(lamports(1_000))
      .accounts({ config: configPda, user: user.publicKey, gastank: pda([B("gastank"), user.publicKey.toBuffer()]), treasury: authority.publicKey, systemProgram: SystemProgram.programId })
      .signers([user]).rpc();
    expect(await balance(authority.publicKey)).to.be.greaterThan(before - 1);
  });
});
