/**
 * NeuroForge — token-primary ownership инструмента на локальном валидаторе.
 *
 * Инструмент — обычный classic SPL-токен (decimals 0, supply 1, без freeze
 * authority), поэтому держатель может перевести его обычным `spl_token::transfer`
 * мимо программы. Программа такие переводы не видит: `ToolData.owner` — это кэш.
 * Этот файл проверяет, что кэш не может авторизовать ценное действие сам по себе,
 * и что `sync_tool_owner` восстанавливает согласованность.
 *
 * ⚠️ СТАТУС: тесты НАПИСАНЫ, НО НЕ ЗАПУСКАЛИСЬ. В песочнице агента нет
 * `cargo`/`anchor`/`solana-test-validator`, поэтому `anchor build` и этот прогон
 * не выполнялись. Файл не является доказательством: доказательством он станет
 * только после `anchor test --skip-build` на машине с тулчейном. До этого
 * корректная формулировка — «validator regression test написан, execution
 * pending», а не «уязвимость закрыта и проверена».
 *
 * Запускается после tests/aof_core.ts (чей before() создаёт Config и auth-PDA).
 * Команда: anchor test --skip-build
 *
 * Нумерация сценариев [n] совпадает с таблицей в docs/TOOL_OWNERSHIP_MODEL.md:
 * 1–15 — token-primary владение и sync, 16–19 — делегированные действия
 * арендатора, 20–21 — сценарии со сдвигом времени валидатора (`it.skip`).
 */
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint, mintTo, getAccount, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID,
  createTransferInstruction,
} from "@solana/spl-token";
import { expect } from "chai";
import fs from "fs";

const CORE_ID = new PublicKey("okiLaCvFyHqFRFf359emmunPKD77uUmLQ2iJWskZdnx");

describe("aof-core: token-primary ownership (кэш не авторизует, sync восстанавливает)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;
  const authority = wallet.publicKey;

  const coreIdl = JSON.parse(fs.readFileSync(process.cwd() + "/target/idl/aof_core.json", "utf8"));
  if (!coreIdl.address) coreIdl.address = CORE_ID.toBase58();
  const core: any = new anchor.Program(coreIdl as any, provider);

  const B = (s: string) => Buffer.from(s);
  const pda = (seeds: Buffer[], program = core.programId as PublicKey) =>
    PublicKey.findProgramAddressSync(seeds, program)[0];

  const coreConfig = pda([B("config")]);
  const authPda = pda([B("auth")]);
  const vaultPda = pda([B("vault")]);
  const toolPda = (mint: PublicKey) => pda([B("tool"), mint.toBuffer()]);
  const playerPda = (user: PublicKey) => pda([B("player"), user.toBuffer()]);

  const RARITY_ARG = { common: {} };
  const ata = (mint: PublicKey, owner: PublicKey) => getAssociatedTokenAddressSync(mint, owner, true);

  let setupPayer: Keypair;
  let owner: Keypair;
  let attacker: Keypair;

  const anchorErrorName = (error: any): string | null =>
    error?.error?.errorCode?.name ?? error?.error?.errorCode?.code ?? null;

  /** Ждёт конкретный код Anchor — иначе тест падает с фактическим кодом. */
  async function expectAnchorError(promise: Promise<any>, expected: string) {
    let failed: any = null;
    try { await promise; } catch (error) { failed = error; }
    expect(failed, `ожидалась ошибка ${expected}`).to.not.equal(null);
    expect(anchorErrorName(failed), `ожидалась ${expected}`).to.equal(expected);
  }

  async function airdrop(kp: Keypair, sol = 5) {
    const sig = await connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  }

  /** Идемпотентно создаёт ATA, переживая отставший bank локального валидатора. */
  async function ensureAta(mint: PublicKey, who: PublicKey): Promise<PublicKey> {
    const address = ata(mint, who);
    if (await connection.getAccountInfo(address, "confirmed")) return address;
    const ix = createAssociatedTokenAccountIdempotentInstruction(setupPayer.publicKey, address, who, mint);
    const tx = new anchor.web3.Transaction().add(ix);
    await provider.sendAndConfirm(tx, [setupPayer], { commitment: "confirmed" });
    return address;
  }

  const balance = async (address: PublicKey) =>
    BigInt((await getAccount(connection, address)).amount.toString());

  const tool = async (mint: PublicKey) => core.account.toolData.fetch(toolPda(mint));

  /** Канонический инструмент: 0-decimal минт с авторитетом auth-PDA. */
  async function mintTool(to: PublicKey) {
    const mint = await createMint(connection, setupPayer, authPda, null, 0);
    const tokenAccount = await ensureAta(mint, to);
    await core.methods
      .mintTool("plasma_cutter", RARITY_ARG)
      .accounts({
        config: coreConfig, authority, auth: authPda, mint, tokenAccount,
        recipient: to, toolData: toolPda(mint),
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      })
      .rpc();
    return { mint, tokenAccount };
  }

  /** Обычный SPL-перевод: программа его не видит, кэш остаётся прежним. */
  async function rawTransfer(mint: PublicKey, from: Keypair, to: Keypair) {
    const source = await ensureAta(mint, from.publicKey);
    const destination = await ensureAta(mint, to.publicKey);
    const tx = new anchor.web3.Transaction().add(
      createTransferInstruction(source, destination, from.publicKey, 1, [], TOKEN_PROGRAM_ID),
    );
    await provider.sendAndConfirm(tx, [from], { commitment: "confirmed" });
  }

  /** `mintResource` требует issuance cap по индексу ResourceKind из IDL. */
  const RESOURCE_KINDS: string[] = (coreIdl.types as any[])
    .find((t: any) => t.name === "ResourceKind")
    .type.variants.map((v: any) => v.name[0].toLowerCase() + v.name.slice(1));
  const issuanceCapPda = (kind: string) =>
    pda([B("issuance_cap"), Buffer.from([RESOURCE_KINDS.indexOf(kind)])]);
  const materialMints = pda([B("material_mints")]);
  const UNIT = new BN(1_000_000_000);

  async function giveResource(kind: string, mint: PublicKey, user: PublicKey, units: number) {
    const tokenAccount = await ensureAta(mint, user);
    await core.methods
      .mintResource({ [kind]: {} }, UNIT.muln(units))
      .accounts({
        config: coreConfig, materialMints, authority, auth: authPda,
        issuanceCap: issuanceCapPda(kind), mint, tokenAccount,
        treasuryToken: await ensureAta(mint, authority), player: playerPda(user),
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      })
      .rpc();
    return tokenAccount;
  }

  const syncOwner = (holder: Keypair, mint: PublicKey) =>
    core.methods
      .syncToolOwner()
      .accounts({
        holder: holder.publicKey,
        mint,
        tool: toolPda(mint),
        holderToken: ata(mint, holder.publicKey),
      })
      .signers([holder])
      .rpc();

  before(async () => {
    setupPayer = Keypair.generate();
    owner = Keypair.generate();
    attacker = Keypair.generate();
    await airdrop(setupPayer, 20);
    await airdrop(owner, 5);
    await airdrop(attacker, 5);

    const cfg = await connection.getAccountInfo(coreConfig);
    expect(cfg, "Config не инициализирован: запустите tests/aof_core.ts перед этим файлом").to.not.equal(null);
    // `collect_mining` читает этот PDA; он тоже создаётся в before() файла aof_core.ts.
    const mm = await connection.getAccountInfo(materialMints);
    expect(mm, "MaterialMints не инициализирован: запустите tests/aof_core.ts перед этим файлом").to.not.equal(null);
  });

  // [1]: канонический путь атомарно двигает и токен, и кэш.
  it("transfer_tool двигает токен и кэш одной транзакцией", async () => {
    const { mint } = await mintTool(owner.publicKey);
    await ensureAta(mint, attacker.publicKey);

    await core.methods
      .transferTool()
      .accounts({
        sender: owner.publicKey, mint,
        senderToken: ata(mint, owner.publicKey),
        recipient: attacker.publicKey,
        recipientToken: ata(mint, attacker.publicKey),
        toolData: toolPda(mint), tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([owner])
      .rpc();

    const cached = await tool(mint);
    expect(cached.owner.toBase58()).to.equal(attacker.publicKey.toBase58());
    expect(cached.operator.toBase58()).to.equal(attacker.publicKey.toBase58());
    expect((await balance(ata(mint, attacker.publicKey))).toString()).to.equal("1");
    expect((await balance(ata(mint, owner.publicKey))).toString()).to.equal("0");
  });

  // [2, 3]: обычный перевод не создаёт второй авторитетной записи — он лишь
  // рассинхронизирует кэш, и до sync инструмент «заморожен» для обоих.
  it("raw SPL transfer рассинхронизирует кэш: старый владелец теряет инструмент, новый ещё не получил", async () => {
    const { mint } = await mintTool(owner.publicKey);
    await rawTransfer(mint, owner, attacker);

    // Токен у атакующего…
    expect((await balance(ata(mint, attacker.publicKey))).toString()).to.equal("1");
    expect((await balance(ata(mint, owner.publicKey))).toString()).to.equal("0");
    // …а кэш всё ещё называет владельцем прежнего держателя.
    const cached = await tool(mint);
    expect(cached.owner.toBase58()).to.equal(owner.publicKey.toBase58(), "кэш обязан отстать — это и есть предмет проверки");

    // Прежний владелец больше не может распорядиться инструментом: токена нет.
    let failed: any = null;
    try {
      await core.methods
        .transferTool()
        .accounts({
          sender: owner.publicKey, mint,
          senderToken: ata(mint, owner.publicKey),
          recipient: attacker.publicKey,
          recipientToken: ata(mint, attacker.publicKey),
          toolData: toolPda(mint), tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([owner])
        .rpc();
    } catch (error) { failed = error; }
    expect(failed, "прежний владелец без токена не должен переводить инструмент").to.not.equal(null);

    // Новый держатель без sync тоже ничего не может: кэш указывает не на него.
    failed = null;
    try {
      await core.methods
        .burnNft()
        .accounts({
          config: coreConfig, user: attacker.publicKey, mint,
          tool: toolPda(mint), tokenAccount: ata(mint, attacker.publicKey),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([attacker])
        .rpc();
    } catch (error) { failed = error; }
    expect(failed, "без sync новый держатель не должен сжигать инструмент").to.not.equal(null);
    expect(anchorErrorName(failed)).to.equal("NotToolOwner");
  });

  // [4]: sync восстанавливает согласованность и доступ.
  it("sync_tool_owner восстанавливает кэш после обычного перевода", async () => {
    const { mint } = await mintTool(owner.publicKey);
    await rawTransfer(mint, owner, attacker);
    expect((await tool(mint)).owner.toBase58()).to.equal(owner.publicKey.toBase58());

    await syncOwner(attacker, mint);

    const cached = await tool(mint);
    expect(cached.owner.toBase58()).to.equal(attacker.publicKey.toBase58());
    expect(cached.operator.toBase58()).to.equal(attacker.publicKey.toBase58());

    // Права действительно восстановлены: инструмент снова можно сжечь.
    await core.methods
      .burnNft()
      .accounts({
        config: coreConfig, user: attacker.publicKey, mint,
        tool: toolPda(mint), tokenAccount: ata(mint, attacker.publicKey),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([attacker])
      .rpc();
    expect((await balance(ata(mint, attacker.publicKey))).toString()).to.equal("0");
  });

  // [5]: посторонний не должен уметь сбросить кэш (иначе он уводит operator).
  it("посторонний не может вызвать sync_tool_owner", async () => {
    const { mint } = await mintTool(owner.publicKey);
    const bystander = Keypair.generate();
    await airdrop(bystander, 2);
    await ensureAta(mint, bystander.publicKey);

    let failed: any = null;
    try { await syncOwner(bystander, mint); } catch (error) { failed = error; }
    expect(failed, "у постороннего нет токена — sync обязан упасть").to.not.equal(null);
    // Кэш остался у законного владельца.
    expect((await tool(mint)).owner.toBase58()).to.equal(owner.publicKey.toBase58());
  });

  // [6–8]: доказательство владения проверяет сам токен, а не его подобие.
  it("sync отклоняет чужой mint, нулевой баланс и чужой token account", async () => {
    const { mint } = await mintTool(owner.publicKey);
    await rawTransfer(mint, owner, attacker);

    // 7: другой mint того же держателя не доказывает владение этим инструментом.
    const alienMint = await createMint(connection, setupPayer, setupPayer.publicKey, null, 0);
    const alienAta = await ensureAta(alienMint, attacker.publicKey);
    await mintTo(connection, setupPayer, alienMint, alienAta, setupPayer, 1);
    let failed: any = null;
    try {
      await core.methods.syncToolOwner().accounts({
        holder: attacker.publicKey, mint, tool: toolPda(mint), holderToken: alienAta,
      }).signers([attacker]).rpc();
    } catch (error) { failed = error; }
    expect(failed, "чужой mint не должен выдаваться за инструмент").to.not.equal(null);

    // 8: владелец правильный, но на аккаунте 0 единиц (токен он уже отдал).
    failed = null;
    try {
      await core.methods.syncToolOwner().accounts({
        holder: owner.publicKey, mint, tool: toolPda(mint),
        holderToken: ata(mint, owner.publicKey),
      }).signers([owner]).rpc();
    } catch (error) { failed = error; }
    expect(failed, "нулевой баланс не должен доказывать владение").to.not.equal(null);

    // 9: на аккаунте ровно 1 единица, но владелец аккаунта — не подписант.
    failed = null;
    try {
      await core.methods.syncToolOwner().accounts({
        holder: owner.publicKey, mint, tool: toolPda(mint),
        holderToken: ata(mint, attacker.publicKey),
      }).signers([owner]).rpc();
    } catch (error) { failed = error; }
    expect(failed, "чужой token account не должен доказывать владение").to.not.equal(null);
  });

  // [9–11]: майнинг авторизуется токеном в эскроу, а не кэшем; сам эскроу
  // нельзя опустошить обычным SPL-переводом.
  it("майнинг требует токен в эскроу, а эскроу нельзя вывести обычным переводом", async () => {
    const { mint, tokenAccount } = await mintTool(owner.publicKey);
    const vaultToken = await ensureAta(mint, vaultPda);
    const player = playerPda(owner.publicKey);

    await core.methods.setMiningEnabled(true).accounts({ config: coreConfig, authority }).rpc();
    try {
      // (a) Свободный инструмент: токен у владельца, флага staked нет. Раньше
      // одной записи `operator`/`owner` хватало, чтобы начать сессию.
      let failed: any = null;
      try {
        await core.methods
          .startMining(1)
          .accounts({
            config: coreConfig, user: owner.publicKey, tool: toolPda(mint), mint,
            player, vault: vaultPda, vaultToken, systemProgram: SystemProgram.programId,
          })
          .signers([owner])
          .rpc();
      } catch (error) { failed = error; }
      expect(failed, "свободный инструмент не должен запускать майнинг").to.not.equal(null);
      expect((await tool(mint)).isMining).to.equal(false);

      // (b) Стейк переносит supply-1 токен в эскроу программы — и только
      // теперь инструмент действительно можно запустить.
      await core.methods
        .stake(new BN(3600))
        .accounts({
          config: coreConfig, user: owner.publicKey, tool: toolPda(mint), mint,
          userToken: tokenAccount, vault: vaultPda, vaultToken, tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([owner])
        .rpc();
      expect((await balance(vaultToken)).toString()).to.equal("1", "токен обязан лежать в эскроу");
      expect((await balance(tokenAccount)).toString()).to.equal("0");

      await core.methods
        .startMining(1)
        .accounts({
          config: coreConfig, user: owner.publicKey, tool: toolPda(mint), mint,
          player, vault: vaultPda, vaultToken, systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      expect((await tool(mint)).isMining).to.equal(true);

      // (c) Эскроу принадлежит PDA программы: обычный перевод подписывается
      // владельцем токен-аккаунта, а им подписать нельзя — «стейк без токена»
      // неконструируем в принципе.
      let drained: any = null;
      try {
        const tx = new anchor.web3.Transaction().add(
          createTransferInstruction(vaultToken, ata(mint, attacker.publicKey), vaultPda, 1, [], TOKEN_PROGRAM_ID),
        );
        await provider.sendAndConfirm(tx, [], { commitment: "confirmed" });
      } catch (error) { drained = error; }
      expect(drained, "эскроу нельзя вывести обычным переводом").to.not.equal(null);
      expect((await balance(vaultToken)).toString()).to.equal("1");
    } finally {
      await core.methods.setMiningEnabled(false).accounts({ config: coreConfig, authority }).rpc();
    }
  });
  // [12, 13]: repair после обычного перевода. Право ремонта доказывает токен, а не
  // запись в кэше, поэтому прежний владелец чинить инструмент больше не может.
  it("repair после raw transfer: прежний владелец теряет инструмент, новый получает его лишь через sync", async () => {
    const { mint } = await mintTool(owner.publicKey);
    const cfg: any = await core.account.config.fetch(coreConfig);
    const stoneMint = cfg.stoneMint as PublicKey;
    const woodMint = cfg.woodMint as PublicKey;
    await rawTransfer(mint, owner, attacker);

    const ownerStone = await giveResource("stone", stoneMint, owner.publicKey, 5);
    const ownerWood = await giveResource("wood", woodMint, owner.publicKey, 5);
    const repair = (signer: Keypair, userStone: PublicKey, userWood: PublicKey, toolToken: PublicKey) =>
      core.methods
        .repair(1)
        .accounts({
          config: coreConfig, user: signer.publicKey, tool: toolPda(mint), mint,
          stoneMint, userStone, woodMint, userWood, toolToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([signer])
        .rpc();

    // Прежний владелец: кэш всё ещё его, но supply-1 токена на его ATA нет.
    let failed: any = null;
    try {
      await repair(owner, ownerStone, ownerWood, ata(mint, owner.publicKey));
    } catch (error) { failed = error; }
    expect(failed, "без токена ремонт запрещён").to.not.equal(null);
    expect(anchorErrorName(failed)).to.equal("ZeroAmount");

    // Новый держатель: без sync кэш указывает на прежнего владельца.
    failed = null;
    try {
      await repair(attacker, await ensureAta(stoneMint, attacker.publicKey),
                   await ensureAta(woodMint, attacker.publicKey), ata(mint, attacker.publicKey));
    } catch (error) { failed = error; }
    expect(failed, "без sync новый держатель не ремонтирует инструмент").to.not.equal(null);
    expect(anchorErrorName(failed)).to.equal("NotToolOperator");

    // Durability не изменилась ни в одном из отклонённых вызовов.
    expect((await tool(mint)).durability).to.equal(20);
  });

  // [14]: collect_mining принимает только тот vault-токен, который принадлежит
  // эскроу программы. Личный ATA владельца как источник награды не годится.
  it("collect_mining требует token account эскроу, а не личный ATA владельца", async () => {
    const { mint } = await mintTool(owner.publicKey);
    const vaultToken = await ensureAta(mint, vaultPda);
    await core.methods
      .stake(new BN(3600))
      .accounts({
        config: coreConfig, user: owner.publicKey, tool: toolPda(mint), mint,
        userToken: ata(mint, owner.publicKey), vault: vaultPda, vaultToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([owner])
      .rpc();

    // Награду платим в свежем минте, чтобы не зависеть от ресурсов сьюта.
    const payoutMint = await createMint(connection, setupPayer, setupPayer.publicKey, null, 9);
    const payoutToken = await ensureAta(payoutMint, owner.publicKey);

    // Сессию надо действительно начать: иначе раньше проверки эскроу сработает
    // констрейнт `tool.is_mining` (NotMining) и до подмены vault_token дело не дойдёт.
    await core.methods.setMiningEnabled(true).accounts({ config: coreConfig, authority }).rpc();
    try {
      await core.methods
        .startMining(1)
        .accounts({
          config: coreConfig, user: owner.publicKey, tool: toolPda(mint), mint,
          player: playerPda(owner.publicKey), vault: vaultPda, vaultToken,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();

      let failed: any = null;
      try {
        await core.methods
          .collectMining()
          .accounts({
            config: coreConfig, user: owner.publicKey, tool: toolPda(mint), mint,
            player: playerPda(owner.publicKey), materialMints, auth: authPda,
            payoutMint, payoutToken, vault: vaultPda,
            // Подмена: вместо эскроу подсунут личный ATA владельца.
            vaultToken: ata(mint, owner.publicKey),
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([owner])
          .rpc();
      } catch (error) { failed = error; }
      expect(failed, "collect с личным ATA вместо эскроу недопустим").to.not.equal(null);
      expect(anchorErrorName(failed)).to.equal("NotToolOwner");
      expect((await balance(vaultToken)).toString()).to.equal("1", "эскроу не тронут");
    } finally {
      await core.methods.setMiningEnabled(false).accounts({ config: coreConfig, authority }).rpc();
    }
  });

  // [15]: stake после обычного перевода — тоже ценное действие, и оно требует
  // свежего кэша: сначала sync, потом стейк.
  it("stake после raw transfer доступен новому держателю только после sync", async () => {
    const { mint } = await mintTool(owner.publicKey);
    const vaultToken = await ensureAta(mint, vaultPda);
    await rawTransfer(mint, owner, attacker);

    const stake = (who: Keypair) =>
      core.methods
        .stake(new BN(3600))
        .accounts({
          config: coreConfig, user: who.publicKey, tool: toolPda(mint), mint,
          userToken: ata(mint, who.publicKey), vault: vaultPda, vaultToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([who])
        .rpc();

    let failed: any = null;
    try { await stake(attacker); } catch (error) { failed = error; }
    expect(failed, "без sync новый держатель не стейкает").to.not.equal(null);
    // Констрейнты Stake идут в порядке полей: `tool.owner == user` раньше
    // `tool.operator == user`, поэтому отказ приходит по owner.
    expect(anchorErrorName(failed)).to.equal("NotToolOwner");
    expect((await tool(mint)).staked).to.equal(false);

    await syncOwner(attacker, mint);
    await stake(attacker);
    expect((await tool(mint)).staked).to.equal(true);
    expect((await balance(vaultToken)).toString()).to.equal("1");
  });
  // =====================================================================
  // Делегированные действия арендатора (Этап 8).
  //
  // Арендованный инструмент лежит в rental_vault листинга, поэтому обычные
  // start_mining/collect_mining/repair для арендатора недостижимы: право даёт
  // активная запись аренды (RentalAgreement.renter == operator == подписант).
  // Гейт operator стоит и в констрейнтах контекста (`tool.operator == user`),
  // поэтому посторонний отклоняется до обработчика — NotToolOperator; цепочка
  // проверок в обработчике (listing/agreement/owner/срок) — вторая линия.
  // =====================================================================

  const DAY = new BN(24 * 3600);
  const PRICE_PER_HOUR = new BN(1_000_000);

  /**
   * Требует валидатора с управляемым временем (например `solana-test-validator`
   * с вахтой по слоту/времени и RPC-хуком). В этой песочнице недоступно: тесты,
   * которым нужно «перемотать» часы, помечены `it.skip` ниже.
   */
  async function warpTimeTo(_unixTimestamp: number): Promise<void> {
    throw new Error(
      "warpTimeTo недоступен: нужен валидатор с управляемым Clock (сценарий помечен it.skip)",
    );
  }

  /** Листинг + активная аренда: токен переходит в эскроу листинга. */
  async function listedAndRented(ownerKp: Keypair, renterKp: Keypair) {
    const { mint, tokenAccount: ownerToken } = await mintTool(ownerKp.publicKey);
    const toolKey = toolPda(mint);
    const rentalListing = pda([B("rental_listing"), mint.toBuffer()]);
    const rentalAgreement = pda([B("rental_agreement"), mint.toBuffer()]);
    const rentalVault = await ensureAta(mint, rentalListing);

    await core.methods
      .rentalList(9_000, DAY, DAY, PRICE_PER_HOUR)
      .accounts({
        config: coreConfig, owner: ownerKp.publicKey, mint, tool: toolKey, rentalListing,
        ownerToken, rentalVault, tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([ownerKp])
      .rpc();
    await core.methods
      .rentalStartBounded(DAY, PRICE_PER_HOUR.muln(24))
      .accounts({
        config: coreConfig, renter: renterKp.publicKey, mint, tool: toolKey, rentalListing,
        owner: ownerKp.publicKey, treasury: authority, rentalAgreement, rentalVault,
        systemProgram: SystemProgram.programId,
      })
      .signers([renterKp])
      .rpc();

    expect((await balance(rentalVault)).toString(), "токен обязан уйти в эскроу листинга").to.equal("1");
    const rented = await core.account.toolData.fetch(toolKey);
    expect(rented.operator.toBase58()).to.equal(renterKp.publicKey.toBase58());
    return { mint, tool: toolKey, rentalListing, rentalAgreement, rentalVault };
  }

  const delegatedStart = (
    who: Keypair, setup: Awaited<ReturnType<typeof listedAndRented>>, hours: number,
  ) =>
    core.methods
      .startMiningDelegated(hours)
      .accounts({
        config: coreConfig, user: who.publicKey, tool: setup.tool, mint: setup.mint,
        player: playerPda(who.publicKey), rentalListing: setup.rentalListing,
        rentalAgreement: setup.rentalAgreement, rentalVault: setup.rentalVault,
        systemProgram: SystemProgram.programId,
      })
      .signers([who])
      .rpc();

  /** Со сбором коллизий нет: `payout_mint` берётся из Config по типу инструмента. */
  async function payoutFor(setup: Awaited<ReturnType<typeof listedAndRented>>, who: Keypair) {
    const cfg: any = await core.account.config.fetch(coreConfig);
    const payoutMint = new PublicKey(cfg.woodMint); // plasma_cutter → ResourceKind::Circuit
    return { payoutMint, payoutToken: await ensureAta(payoutMint, who.publicKey) };
  }

  const delegatedCollect = (
    who: Keypair,
    setup: Awaited<ReturnType<typeof listedAndRented>>,
    payoutMint: PublicKey,
    payoutToken: PublicKey,
  ) =>
    core.methods
      .collectMiningDelegated()
      .accounts({
        config: coreConfig, user: who.publicKey, tool: setup.tool, mint: setup.mint,
        player: playerPda(who.publicKey), materialMints, auth: authPda,
        payoutMint, payoutToken, rentalListing: setup.rentalListing,
        rentalAgreement: setup.rentalAgreement, rentalVault: setup.rentalVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([who])
      .rpc();

  // [16]: арендатор — единственный, кто может запустить сессию; владелец и
  // посторонний делегирования не имеют.
  it("делегированный майнинг: арендатор может, владелец и посторонний — нет", async () => {
    const renter = Keypair.generate();
    await airdrop(renter, 5);
    const setup = await listedAndRented(owner, renter);

    await core.methods.setMiningEnabled(true).accounts({ config: coreConfig, authority }).rpc();
    try {
      // Соглашение знает только одного арендатора: остальные падают на
      // констрейнте operator, до кода обработчика.
      await expectAnchorError(delegatedStart(owner, setup, 4), "NotToolOperator");
      await expectAnchorError(delegatedStart(attacker, setup, 4), "NotToolOperator");

      await delegatedStart(renter, setup, 4);
      const mined = await tool(setup.mint);
      expect(mined.isMining, "сессия обязана стартовать у арендатора").to.equal(true);
      expect(mined.lastMinedHours).to.equal(4);
      // Сессия короче аренды: mining_end внутри agreement.end.
      const agreement = await core.account.rentalAgreement.fetch(setup.rentalAgreement);
      expect(mined.miningEnd.toNumber()).to.be.lessThanOrEqual(agreement.end.toNumber());
      // Инструмент остался в эскроу листинга — арендатор токеном не владеет.
      expect((await balance(setup.rentalVault)).toString()).to.equal("1");
      // Токена у арендатора нет вовсе: он не владелец, только operator.
      expect(await connection.getAccountInfo(ata(setup.mint, renter.publicKey))).to.equal(null);

      // Повторный старт запрещён, пока сессия не закрыта.
      await expectAnchorError(delegatedStart(renter, setup, 1), "AlreadyMining");
    } finally {
      await core.methods.setMiningEnabled(false).accounts({ config: coreConfig, authority }).rpc();
    }
  });

  // [17]: сбор авторизуется тем же proof'ом, но сессию нельзя собрать раньше
  // её конца; посторонний отклоняется до всякой логики награды.
  it("делегированный сбор: сессия должна завершиться, посторонний не собирает", async () => {
    const renter = Keypair.generate();
    await airdrop(renter, 5);
    const setup = await listedAndRented(owner, renter);
    await core.methods.setMiningEnabled(true).accounts({ config: coreConfig, authority }).rpc();
    try {
      await delegatedStart(renter, setup, 1);
      const { payoutMint, payoutToken: renterPayout } = await payoutFor(setup, renter);
      // Постороннему нужен профиль игрока (а с ним ATA выплаты), иначе
      // транзакция упадёт на разборе аккаунтов, не дойдя до проверки оператора.
      await giveResource("wood", payoutMint, attacker.publicKey, 1);
      const attackerPayout = ata(payoutMint, attacker.publicKey);

      // Посторонний: отказ по правам, хотя сессия тоже ещё не завершена.
      await expectAnchorError(
        delegatedCollect(attacker, setup, payoutMint, attackerPayout),
        "NotToolOperator",
      );
      // Арендатор: права есть, но сессия ещё идёт.
      await expectAnchorError(
        delegatedCollect(renter, setup, payoutMint, renterPayout),
        "MiningNotComplete",
      );
      // Награды не появилось, сессия не тронута.
      expect((await tool(setup.mint)).isMining).to.equal(true);
      expect((await balance(renterPayout)).toString(), "награды ещё нет").to.equal("0");
    } finally {
      await core.methods.setMiningEnabled(false).accounts({ config: coreConfig, authority }).rpc();
    }
  });

  // [18]: арендатор вправе завершить аренду в любой момент, и брошенная сессия не
  // должна оставаться висеть на инструменте — иначе после делиста владелец
  // навсегда упрётся в AlreadyMining.
  it("rental_end арендатором гасит брошенную сессию и возвращает operator владельцу", async () => {
    const renter = Keypair.generate();
    await airdrop(renter, 5);
    const setup = await listedAndRented(owner, renter);
    await core.methods.setMiningEnabled(true).accounts({ config: coreConfig, authority }).rpc();
    try {
      await delegatedStart(renter, setup, 4);
      expect((await tool(setup.mint)).isMining).to.equal(true);
    } finally {
      await core.methods.setMiningEnabled(false).accounts({ config: coreConfig, authority }).rpc();
    }

    await core.methods
      .rentalEnd()
      .accounts({
        config: coreConfig, caller: renter.publicKey, mint: setup.mint, tool: setup.tool,
        rentalAgreement: setup.rentalAgreement, renterRefund: renter.publicKey,
      })
      .signers([renter])
      .rpc();

    const after = await tool(setup.mint);
    expect(after.isMining, "брошенная сессия гасится").to.equal(false);
    expect(after.miningEnd.toNumber()).to.equal(0);
    expect(after.lastMinedHours).to.equal(0);
    expect(after.operator.toBase58(), "operator возвращается владельцу").to.equal(owner.publicKey.toBase58());
    expect(await connection.getAccountInfo(setup.rentalAgreement)).to.equal(null);
  });

  // [19]: ремонт арендованного инструмента арендатор делает своим путём и своими
  // ресурсами; обычный repair ему недоступен, владелец делегированным — тоже.
  it("repair_delegated авторизует арендатора, обычный repair ему недоступен", async () => {
    const renter = Keypair.generate();
    await airdrop(renter, 5);
    const setup = await listedAndRented(owner, renter);
    const cfg: any = await core.account.config.fetch(coreConfig);
    const stoneMint = new PublicKey(cfg.stoneMint);
    const woodMint = new PublicKey(cfg.woodMint);
    const renterStone = await giveResource("stone", stoneMint, renter.publicKey, 5);
    const renterWood = await giveResource("wood", woodMint, renter.publicKey, 5);
    const ownerStone = await ensureAta(stoneMint, owner.publicKey);
    const ownerWood = await ensureAta(woodMint, owner.publicKey);

    const repairDelegated = (who: Keypair, stone: PublicKey, wood: PublicKey) =>
      core.methods
        .repairDelegated(1)
        .accounts({
          config: coreConfig, user: who.publicKey, tool: setup.tool, mint: setup.mint,
          stoneMint, userStone: stone, woodMint, userWood: wood,
          rentalListing: setup.rentalListing, rentalAgreement: setup.rentalAgreement,
          rentalVault: setup.rentalVault, tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([who])
        .rpc();

    // Свежий инструмент уже на MAX_DURABILITY, поэтому успешный ремонт здесь
    // недостижим; DurabilityOverflow доказывает, что proof пройден и обработчик
    // дошёл до проверки durability (до балансов и сжигания).
    await expectAnchorError(
      repairDelegated(renter, renterStone, renterWood),
      "DurabilityOverflow",
    );

    // Владелец делегированным путём не проходит: он не operator.
    await expectAnchorError(
      repairDelegated(owner, ownerStone, ownerWood),
      "NotToolOperator",
    );

    // Обычный repair арендатору недоступен по построению: он не owner.
    await expectAnchorError(
      core.methods
        .repair(1)
        .accounts({
          config: coreConfig, user: renter.publicKey, tool: setup.tool, mint: setup.mint,
          stoneMint, userStone: renterStone, woodMint, userWood: renterWood,
          toolToken: ata(setup.mint, renter.publicKey), tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([renter])
        .rpc(),
      "NotToolOwner",
    );
  });

  // [20, 21]: требуют прогрева времени валидатора. Оба сценария написаны и
  // помечены skip, чтобы не выдавать их за выполненную проверку: в песочнице
  // агента нет ни `anchor`, ни валидатора с управляемым Clock.
  it.skip("сессия длиннее аренды отклоняется, а завершённая платит арендатору (нужен сдвиг времени)", async () => {
    const renter = Keypair.generate();
    await airdrop(renter, 5);
    const setup = await listedAndRented(owner, renter);
    const { payoutMint, payoutToken: renterPayout } = await payoutFor(setup, renter);
    await giveResource("wood", payoutMint, attacker.publicKey, 1);
    const attackerPayout = ata(payoutMint, attacker.publicKey);
    const agreement = await core.account.rentalAgreement.fetch(setup.rentalAgreement);

    await core.methods.setMiningEnabled(true).accounts({ config: coreConfig, authority }).rpc();
    try {
      // 20: до конца аренды остаётся час — сессия на 8h в аренду не помещается.
      // (Проверка выполняется в обработчике: констрейнты operator уже пройдены.)
      await warpTimeTo(agreement.end.toNumber() - 3_600);
      await expectAnchorError(delegatedStart(renter, setup, 8), "RentalSessionTooLong");

      // 21: сессия, начатая внутри аренды, собирается уже после её конца —
      // и платит арендатору, а не владельцу; посторонний отклоняется.
      await delegatedStart(renter, setup, 1);
      await warpTimeTo(agreement.end.toNumber() + 3_600);
      await expectAnchorError(
        delegatedCollect(attacker, setup, payoutMint, attackerPayout),
        "NotToolOperator",
      );
      const before = await balance(renterPayout);
      await delegatedCollect(renter, setup, payoutMint, renterPayout);
      expect((await balance(renterPayout)) > before, "награда ушла арендатору").to.equal(true);
      expect((await tool(setup.mint)).isMining).to.equal(false);
    } finally {
      await core.methods.setMiningEnabled(false).accounts({ config: coreConfig, authority }).rpc();
    }
  });
});
