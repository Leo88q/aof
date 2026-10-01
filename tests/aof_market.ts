/**
 * NeuroForge (ex-AOF) — событийный рынок инструментов на локальном валидаторе.
 *
 * Проверяет ровно то, что нельзя проверить чтением кода: пул покупает и продаёт
 * инструмент, а владение (`ToolData.owner`) едет вместе с NFT. Раньше
 * `hot_market_buy/sell_into_queue` возвращали `TradingDisabled`, потому что
 * синхронизировать владение было нечем; теперь рынок вызывает
 * `aof_core::transfer_tool` через CPI, и этот файл доказывает результат на
 * реальных балансах:
 *
 *  1. покупка переводит NFT покупателю, переписывает владельца и делит цену
 *     между резервом пула и казной;
 *  2. потолок цены меньше цены пула отклоняется — кошелёк не может быть
 *     списан по цене, которую он не подписывал;
 *  3. продажа возвращает инструмент пулу и платит продавцу из резерва;
 *  4. произвольный SPL-минт (без канонического ToolData) не продаётся по цене
 *     пула — «кран» закрыт;
 *  5. чужой ВАЛЮТНЫЙ минт (F-CURRENCY-01) не покупает инструмент ни под
 *     `Currency::Core`, ни под `Currency::Gem`: констрейнт связывает
 *     `currency_mint` с `MarketConfig.core_mint`/`gem_mint` до первого перевода,
 *     а канонический минт той же инструкцией проходит.
 *
 * Запускается после tests/aof_core.ts, чей before() создаёт Config и auth-PDA
 * (тот же контракт, что у tests/aof_extended.ts).
 * Команда: anchor test --skip-build
 */
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint, mintTo, getAccount, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";
import fs from "fs";

const MARKET_ID = new PublicKey("4BhD6spJHdvHQ9mgyaU6AUSLU37oJbTMCDcAXyWhMRVo");
const CORE_ID = new PublicKey("HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq");

describe("aof-market: горячий рынок покупает и продаёт инструмент вместе с владением", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;
  const authority = wallet.publicKey;

  const coreIdl = JSON.parse(fs.readFileSync(process.cwd() + "/target/idl/aof_core.json", "utf8"));
  if (!coreIdl.address) coreIdl.address = CORE_ID.toBase58();
  const marketIdl = JSON.parse(fs.readFileSync(process.cwd() + "/target/idl/aof_market.json", "utf8"));
  if (!marketIdl.address) marketIdl.address = MARKET_ID.toBase58();
  const core: any = new anchor.Program(coreIdl as any, provider);
  const market: any = new anchor.Program(marketIdl as any, provider);

  const B = (s: string) => Buffer.from(s);
  const pda = (seeds: Buffer[], program = core.programId as PublicKey) =>
    PublicKey.findProgramAddressSync(seeds, program)[0];

  const coreConfig = pda([B("config")]);
  const authPda = pda([B("auth")]);
  const toolPda = (mint: PublicKey) => pda([B("tool"), mint.toBuffer()]);
  const marketConfig = pda([B("market_config")], market.programId);
  const poolPda = (rarity: number) => pda([B("hot_pool"), Buffer.from([rarity])], market.programId);

  const RARITY = 0; // common
  const RARITY_ARG = { common: {} };
  const UNIT = new BN(1_000_000_000); // 9 decimals, как у ресурсных минтов
  const FEE_BPS = 200; // 2 %
  // Цена пула: 1 CORE. Затухание 0, рост 0 — в тесте цена обязана быть
  // предсказуемой, иначе проверка балансов превращается в проверку формулы.
  const TARGET_CORE = new BN(1).mul(UNIT);
  const TARGET_GEM = new BN(1).mul(UNIT);

  let setupPayer: Keypair;
  let buyer: Keypair;
  let treasury: Keypair;
  let coreMint: PublicKey;
  let gemMint: PublicKey;
  let toolMint: PublicKey;
  let pool: PublicKey;

  const ata = (mint: PublicKey, owner: PublicKey) => getAssociatedTokenAddressSync(mint, owner, true);

  async function airdrop(kp: Keypair, sol = 5) {
    const sig = await connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  }

  async function waitForTokenMint(mint: PublicKey, timeoutMs = 10_000): Promise<void> {
    // `createMint` confirms through its own web3.js transaction.  The local
    // validator can nevertheless answer the immediately following ATA
    // simulation from an older bank where the new account is still owned by
    // SystemProgram; Associated Token then reports the misleading
    // `IncorrectProgramId`.  Do not retry the mutation blindly: wait until the
    // same RPC reader observes the mint under Tokenkeg first.
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const info = await connection.getAccountInfo(mint, "confirmed");
      if (info?.owner.equals(TOKEN_PROGRAM_ID)) return;
      if (Date.now() >= deadline) {
        throw new Error(
          `mint ${mint.toBase58()} was not observed under ${TOKEN_PROGRAM_ID.toBase58()}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async function ensureAta(mint: PublicKey, owner: PublicKey, payer: Keypair): Promise<PublicKey> {
    const address = ata(mint, owner);
    const info = await connection.getAccountInfo(address, "confirmed");
    if (!info) {
      await waitForTokenMint(mint);
      const ix = createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        address,
        owner,
        mint,
      );
      // This suite starts after a deliberately long (~5 minute) time-warping
      // test.  AnchorProvider may still hold a cached blockhash from before the
      // warp, so build and confirm against one explicit lifetime.  The ATA
      // instruction is idempotent, which makes a retry safe if confirmation is
      // lost at the blockhash boundary.
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const lifetime = await connection.getLatestBlockhash("confirmed");
        const tx = new anchor.web3.Transaction().add(ix);
        tx.feePayer = payer.publicKey;
        tx.recentBlockhash = lifetime.blockhash;
        tx.sign(payer);
        try {
          const signature = await connection.sendRawTransaction(tx.serialize(), {
            preflightCommitment: "confirmed",
          });
          const confirmation = await connection.confirmTransaction(
            { signature, ...lifetime },
            "confirmed",
          );
          if (confirmation.value.err) {
            throw new Error(`ATA transaction failed: ${JSON.stringify(confirmation.value.err)}`);
          }
          return address;
        } catch (error) {
          lastError = error;
          if (!/blockhash\s*not\s*found|block height exceeded/i.test(String((error as any)?.message ?? error))) {
            throw error;
          }
        }
      }
      throw lastError;
    }
    return address;
  }

  const balance = async (address: PublicKey) => BigInt((await getAccount(connection, address)).amount.toString());

  async function sendWithPayer(builder: any, payer: Keypair) {
    const tx = await builder.transaction();
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    return provider.sendAndConfirm(tx, [payer], { commitment: "confirmed", preflightCommitment: "confirmed" });
  }

  /** Инструмент каноническим путём aof_core: 0-decimal минт с авторитетом auth-PDA. */
  async function mintTool(to: PublicKey) {
    const mint = await createMint(connection, setupPayer, authPda, null, 0);
    const tokenAccount = await ensureAta(mint, to, setupPayer);
    await sendWithPayer(core.methods
      .mintTool("plasma_cutter", RARITY_ARG)
      .accounts({
        config: coreConfig,
        authority,
        auth: authPda,
        mint,
        tokenAccount,
        recipient: to,
        payer: setupPayer.publicKey,
        toolData: toolPda(mint),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }), setupPayer);
    return mint;
  }

  // `currency`/`currencyMint` — параметры F-CURRENCY-01: тест на чужой валютный
  // mint обязан уметь подать «согласованный» чужой минт вместо канонического.
  async function buy(
    buyerKp: Keypair,
    mint: PublicKey,
    maxPrice: BN,
    currency: any = { core: {} },
    currencyMint: PublicKey = coreMint,
  ) {
    return market.methods
      .hotMarketBuy(RARITY, currency, maxPrice)
      .accounts({
        config: marketConfig,
        buyer: buyerKp.publicKey,
        pool,
        treasury: treasury.publicKey,
        currencyMint,
        buyerCurrency: ata(currencyMint, buyerKp.publicKey),
        treasuryCurrency: ata(currencyMint, treasury.publicKey),
        newToolMint: mint,
        poolTool: ata(mint, pool),
        buyerTool: ata(mint, buyerKp.publicKey),
        poolCurrency: ata(currencyMint, pool),
        toolData: toolPda(mint),
        coreProgram: core.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([buyerKp])
      .rpc();
  }

  async function sell(
    sellerKp: Keypair,
    mint: PublicKey,
    minPrice: BN,
    currency: any = { core: {} },
    currencyMint: PublicKey = coreMint,
  ) {
    return market.methods
      .hotMarketSellIntoQueue(RARITY, currency, minPrice)
      .accounts({
        config: marketConfig,
        seller: sellerKp.publicKey,
        pool,
        currencyMint,
        sellerCurrency: ata(currencyMint, sellerKp.publicKey),
        poolCurrency: ata(currencyMint, pool),
        soldToolMint: mint,
        sellerTool: ata(mint, sellerKp.publicKey),
        poolTool: ata(mint, pool),
        treasuryCurrency: ata(currencyMint, treasury.publicKey),
        toolData: toolPda(mint),
        coreProgram: core.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([sellerKp])
      .rpc();
  }

  /** Имя ошибки Anchor из брошенного исключения (или null). */
  const anchorErrorName = (error: any): string | null =>
    error?.error?.errorCode?.name ?? error?.error?.errorCode?.code ?? null;

  before(async () => {
    setupPayer = Keypair.generate();
    buyer = Keypair.generate();
    treasury = Keypair.generate();
    await airdrop(setupPayer, 20);
    await airdrop(buyer, 5);

    // Config нужен только для чтения auth-PDA-минта; bootstrap делает aof_core.ts.
    const cfg = await connection.getAccountInfo(coreConfig);
    expect(cfg, "Config не инициализирован: запустите tests/aof_core.ts перед этим файлом").to.not.equal(null);

    coreMint = await createMint(connection, setupPayer, setupPayer.publicKey, null, 9);
    gemMint = await createMint(connection, setupPayer, setupPayer.publicKey, null, 9);

    // Marketplace-конфиг: авторитет и есть upgrade authority программы aof_market
    // (её проверяет init_market_config по ProgramData).
    // ProgramData берём от фактического program id (IDL), а не от константы:
    // CI пересобирает артефакты со своими ключами и синхронизирует адрес в IDL.
    const programData = PublicKey.findProgramAddressSync(
      [market.programId.toBuffer()],
      new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
    )[0];
    await market.methods
      .initMarketConfig(FEE_BPS)
      .accounts({
        config: marketConfig,
        authority,
        coreMint,
        gemMint,
        treasury: treasury.publicKey,
        programData,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    pool = poolPda(RARITY);
    await market.methods
      .initPool(RARITY, TARGET_CORE, TARGET_GEM, new BN(0), 0, 0, FEE_BPS)
      .accounts({ config: marketConfig, authority, pool, systemProgram: SystemProgram.programId })
      .rpc();

    // Резерв пула и казна — обычные ATA обеих валют; покупателю нужен баланс.
    await ensureAta(coreMint, pool, setupPayer);
    await ensureAta(coreMint, treasury.publicKey, setupPayer);
    await ensureAta(gemMint, pool, setupPayer);
    await ensureAta(gemMint, treasury.publicKey, setupPayer);
    await ensureAta(coreMint, buyer.publicKey, setupPayer);
    await ensureAta(coreMint, authority, setupPayer);
    await mintTo(connection, setupPayer, coreMint, ata(coreMint, buyer.publicKey), setupPayer, 10n * 1_000_000_000n);
    // Казна и пул платят ренту за ATA инструментов: держим их с небольшим запасом.
    await mintTo(connection, setupPayer, coreMint, ata(coreMint, pool), setupPayer, 10n * 1_000_000_000n);
  });

  it("покупка переводит NFT и владение, делит цену между пулом и казной", async () => {
    toolMint = await mintTool(pool);
    await ensureAta(toolMint, buyer.publicKey, setupPayer);

    const poolBefore = await balance(ata(coreMint, pool));
    const treasuryBefore = await balance(ata(coreMint, treasury.publicKey));
    const buyerBefore = await balance(ata(coreMint, buyer.publicKey));

    await buy(buyer, toolMint, TARGET_CORE);

    const tool: any = await core.account.toolData.fetch(toolPda(toolMint));
    expect(tool.owner.toBase58()).to.equal(buyer.publicKey.toBase58(), "владение обязано перейти покупателю");
    expect(tool.operator.toBase58()).to.equal(buyer.publicKey.toBase58());
    expect((await balance(ata(toolMint, buyer.publicKey))).toString()).to.equal("1");
    expect((await balance(ata(toolMint, pool))).toString()).to.equal("0");

    const fee = BigInt(TARGET_CORE.toString()) * BigInt(FEE_BPS) / 10_000n;
    const toPool = BigInt(TARGET_CORE.toString()) - fee;
    expect((await balance(ata(coreMint, pool))).toString()).to.equal((poolBefore + toPool).toString());
    expect((await balance(ata(coreMint, treasury.publicKey))).toString()).to.equal((treasuryBefore + fee).toString());
    expect((await balance(ata(coreMint, buyer.publicKey))).toString()).to.equal((buyerBefore - BigInt(TARGET_CORE.toString())).toString());
  });

  it("потолок цены ниже цены пула отклоняется", async () => {
    const mint = await mintTool(pool);
    await ensureAta(mint, buyer.publicKey, setupPayer);
    let failed: any = null;
    try {
      await buy(buyer, mint, new BN(1));
    } catch (error) {
      failed = error;
    }
    expect(failed, "покупка с потолком 1 атом обязана упасть").to.not.equal(null);
    expect(anchorErrorName(failed)).to.equal("SlippageExceeded");
    const tool: any = await core.account.toolData.fetch(toolPda(mint));
    expect(tool.owner.toBase58()).to.equal(pool.toBase58(), "инструмент обязан остаться в пуле");
  });

  it("продажа возвращает инструмент пулу и платит продавцу из резерва", async () => {
    const sellerBefore = await balance(ata(coreMint, buyer.publicKey));
    const poolBefore = await balance(ata(coreMint, pool));

    await sell(buyer, toolMint, new BN(1));

    const tool: any = await core.account.toolData.fetch(toolPda(toolMint));
    expect(tool.owner.toBase58()).to.equal(pool.toBase58(), "владение обязано вернуться пулу");
    expect((await balance(ata(toolMint, pool))).toString()).to.equal("1");
    expect((await balance(ata(toolMint, buyer.publicKey))).toString()).to.equal("0");

    // Пустая история сделок в окне: цена снова базовая, комиссия — та же доля.
    const fee = BigInt(TARGET_CORE.toString()) * BigInt(FEE_BPS) / 10_000n;
    const payout = BigInt(TARGET_CORE.toString()) - fee;
    expect((await balance(ata(coreMint, buyer.publicKey))).toString()).to.equal((sellerBefore + payout).toString());
    expect((await balance(ata(coreMint, pool))).toString()).to.equal((poolBefore - payout - fee).toString());
  });

  it("произвольный SPL-минт не продаётся по цене пула", async () => {
    const alien = await createMint(connection, setupPayer, setupPayer.publicKey, null, 0);
    await ensureAta(alien, buyer.publicKey, setupPayer);
    await mintTo(connection, setupPayer, alien, ata(alien, buyer.publicKey), setupPayer, 1);
    await ensureAta(alien, pool, setupPayer);

    let failed: any = null;
    try {
      await sell(buyer, alien, new BN(1));
    } catch (error) {
      failed = error;
    }
    expect(failed, "у произвольного минта нет канонического ToolData — продажа обязана упасть").to.not.equal(null);
    expect((await balance(ata(alien, buyer.publicKey))).toString()).to.equal("1", "чужой токен не должен уехать в пул");
  });

  // F-CURRENCY-01: цена пула считается по аргументу `currency`, а платёж идёт в
  // том mint'е, который пришёл аккаунтом `currency_mint`. Пока они не связаны,
  // покупатель объявляет дорогую валюту и платит своим произвольным минтом,
  // забирая настоящий инструмент из пула. Тест держит привязку на валидаторе:
  // чужой минт обязан упасть ДО любого перевода, а канонический — работать.
  it("чужой валютный mint не покупает инструмент — ни под Core, ни под Gem", async () => {
    toolMint = await mintTool(pool);
    await ensureAta(toolMint, buyer.publicKey, setupPayer);

    // Злоумышленник может бесправно создать свой SPL-mint, начеканить его себе
    // и создать «согласованные» token-аккаунты пула и казны под него: рынок
    // раньше связывал их только друг с другом.
    const fakeMint = await createMint(connection, setupPayer, setupPayer.publicKey, null, 9);
    await ensureAta(fakeMint, buyer.publicKey, setupPayer);
    await mintTo(
      connection, setupPayer, fakeMint, ata(fakeMint, buyer.publicKey), setupPayer,
      1_000n * 1_000_000_000n,
    );
    await ensureAta(fakeMint, pool, setupPayer);
    await ensureAta(fakeMint, treasury.publicKey, setupPayer);

    const poolToolBefore = await balance(ata(toolMint, pool));
    const ownerBefore = (await core.account.toolData.fetch(toolPda(toolMint))).owner.toBase58();
    const poolReserveBefore = await balance(ata(coreMint, pool));
    const treasuryBefore = await balance(ata(coreMint, treasury.publicKey));
    const fakeBalanceBefore = await balance(ata(fakeMint, buyer.publicKey));
    const gemReserveBefore = await balance(ata(gemMint, pool));

    expect(ownerBefore).to.equal(pool.toBase58(), "предпосылка: инструмент лежит в пуле");

    for (const [label, currency, maxPrice] of [
      ["Core", { core: {} }, TARGET_CORE],
      ["Gem", { gem: {} }, TARGET_GEM],
    ] as const) {
      let failed: any = null;
      try {
        await buy(buyer, toolMint, maxPrice, currency, fakeMint);
      } catch (error) {
        failed = error;
      }
      expect(failed, `покупка с валютой ${label} и чужим минтом обязана упасть`).to.not.equal(null);
      expect(anchorErrorName(failed), `ожидается InvalidCurrencyMint для ${label}`).to.equal("InvalidCurrencyMint");
    }

    // Инструмент, владение и деньги не сдвинулись ни на атом.
    expect((await balance(ata(toolMint, pool))).toString()).to.equal(poolToolBefore.toString(), "инструмент обязан остаться в пуле");
    expect((await balance(ata(toolMint, buyer.publicKey))).toString()).to.equal("0", "покупатель не должен получить инструмент");
    expect((await core.account.toolData.fetch(toolPda(toolMint))).owner.toBase58()).to.equal(pool.toBase58(), "владение не должно перейти");
    expect((await balance(ata(coreMint, pool))).toString()).to.equal(poolReserveBefore.toString(), "резерв пула не тронут");
    expect((await balance(ata(coreMint, treasury.publicKey))).toString()).to.equal(treasuryBefore.toString(), "казна не тронута");
    expect((await balance(ata(fakeMint, buyer.publicKey))).toString()).to.equal(fakeBalanceBefore.toString(), "чужой токен не списан");

    // Положительный контроль: канонический Gem-минт той же инструкцией проходит,
    // то есть проверка привязывает валюту, а не блокирует торговлю целиком.
    await ensureAta(gemMint, buyer.publicKey, setupPayer);
    await mintTo(
      connection, setupPayer, gemMint, ata(gemMint, buyer.publicKey), setupPayer,
      10n * 1_000_000_000n,
    );
    await buy(buyer, toolMint, TARGET_GEM, { gem: {} }, gemMint);

    const bought: any = await core.account.toolData.fetch(toolPda(toolMint));
    expect(bought.owner.toBase58()).to.equal(buyer.publicKey.toBase58(), "канонический Gem обязан купить инструмент");
    expect((await balance(ata(toolMint, buyer.publicKey))).toString()).to.equal("1");
    expect((await balance(ata(gemMint, pool))).toString()).to.not.equal(gemReserveBefore.toString(), "оплата обязана прийти в резерв пула");
  });
});
