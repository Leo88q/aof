import { BN } from "bn.js";
import { Router } from "express";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {AUTHORITY_PUBKEY} from "../config";
import { connection, program } from "../provider";
import { authPda, configPda, energyAccountPda, materialMintsPda, playerPda, issuanceCapPda } from "../lib/pda";
import { authorityOnly, coSign, coSignQuoted, pk } from "../lib/tx";
import { TOKEN_ACCOUNT_SIZE } from "../lib/accountSizes";
import { requireExistingPlayer } from "../lib/playerAccount";
import { fetchOne } from "../lib/decode";
import { validateMintForTransaction } from "../security/mintValidator";
import { requireCircuitOpen, requireWalletLimits } from "../middleware/security";
import { validateSingleCanonicalResourceMint } from "../lib/resourceRegistry";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

const RESOURCE_UNIT = new BN("1000000000");

const kindMap: Record<string, any> = {
  // Базовые ресурсы
  data: { data: {} },
  circuit: { circuit: {} },
  silicon: { silicon: {} },
  mind: { mind: {} },
  // [БЛОК L] Хлебная цепочка
  neuron: { neuron: {} },
  synapse: { synapse: {} },
  signal: { signal: {} },
  model: { model: {} },
  power: { power: {} },
  compute: { compute: {} },
  dataset: { dataset: {} },
  // Камни
  blueCore: { blueCore: {} },
  purpleCore: { purpleCore: {} },
  redCore: { redCore: {} },
  // Песок
  clearQuartz: { clearQuartz: {} },
  roseQuartz: { roseQuartz: {} },
  amberQuartz: { amberQuartz: {} },
  // Гемы
  quantumBit: { quantumBit: {} },
  neuralChip: { neuralChip: {} },
  photonBit: { photonBit: {} },
  bioChip: { bioChip: {} },
  // Баночки
  cryoFluid: { cryoFluid: {} },
  voltFluid: { voltFluid: {} },
  bioFluid: { bioFluid: {} },
  nanoFluid: { nanoFluid: {} },
  quantumFluid: { quantumFluid: {} },
  // Особое
  soulCore: { soulCore: {} },
};

r.post("/mint", requireAdmin, requireCircuitOpen, async (req, res) => {
  try {
    // Проверка что минт разрешён и существует на чейне
    await validateMintForTransaction(req.body.mint);

    const owner = pk(req.body.owner);
    const mint = pk(req.body.mint);
    await requireExistingPlayer(owner);
    const kind = kindMap[req.body.kind];
    if (!kind) return res.status(400).json({ error: "unknown resource kind" });
    const amount = new BN(req.body.amount);

    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [auth] = authPda();
    const [player] = playerPda(owner);
    const cfg: any = await fetchOne("config", config);
    if (!cfg?.treasury) return res.status(400).json({ error: "Config not initialized" });
    const treasury = new PublicKey(cfg.treasury.toString());
    const tokenAccount = getAssociatedTokenAddressSync(mint, owner, true);
    const treasuryToken = getAssociatedTokenAddressSync(mint, treasury, true);

    const ix = await (program.methods as any)
      .mintResource(kind, amount as any)
      .accounts({
        config,
        materialMints,
        authority: AUTHORITY_PUBKEY,
        auth,
        mint,
        tokenAccount,
        treasuryToken,
        player,
        issuanceCap: issuanceCapPda(kind)[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: pk("11111111111111111111111111111111"),
      })
      .instruction();

    // [PAYER] ATA игрока — его аккаунт: создаётся лениво в ЕГО транзакции, payer
    // = кошелёк игрока, подпись игрока; authority добавляет только авторизацию
    // минта. ATA казны — инфраструктура проекта: её rent проект платит сам и
    // вне транзакции игрока (и только если её ещё нет).
    const treasuryInfo = await connection.getAccountInfo(treasuryToken, "confirmed");
    if (!treasuryInfo) {
      await authorityOnly([
        createAssociatedTokenAccountIdempotentInstruction(AUTHORITY_PUBKEY, treasuryToken, treasury, mint),
      ]);
    }
    const createUserAta = createAssociatedTokenAccountIdempotentInstruction(owner, tokenAccount, owner, mint);
    const prepared = await coSignQuoted([createUserAta, ix], owner, [
      { name: "recipient_ata", address: tokenAccount, size: TOKEN_ACCOUNT_SIZE, strategy: "idempotent" },
    ]);
    res.json(prepared);
  } catch (e: any) {
    res.status(e?.status || 400).json({ error: e.message });
  }
});

r.post("/burn", requireCircuitOpen, async (req, res) => {
  try {
    // Проверка что минт разрешён
    await validateMintForTransaction(req.body.mint);

    const owner = pk(req.body.owner);
    const mint = pk(req.body.mint);
    const kind = kindMap[req.body.kind];
    if (!kind) return res.status(400).json({ error: "unknown resource kind" });
    const amount = new BN(req.body.amount);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const tokenAccount = getAssociatedTokenAddressSync(mint, owner);

    const ix = await (program.methods as any)
      .burnResource(kind, amount as any)
      .accounts({
        config,
        materialMints,
        user: owner,
        mint,
        tokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const { coSign } = await import("../lib/tx");
    const tx = await coSign([ix], owner);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// [§3.8] DATA → энергия. Курс и потолок заданы константами программы
// (`DATA_ATOMS_PER_ENERGY` = 1 целый DATA за 1 энергию, не выше `ENERGY_CAP`),
// поэтому маршрут не пересчитывает награду, а только строит транзакцию ровно с
// тем количеством DATA, которое показано игроку. Тело: `dataAmount` в целых
// DATA (как в /chain/lab/plant-neuron), в атомы переводит бэкенд.
r.post("/exchange-energy", requireCircuitOpen, requireWalletLimits("resources_exchange_energy"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const [config] = configPda();
    const cfg: any = await fetchOne("config", config);
    if (!cfg) return res.status(503).json({ error: "CORE_CONFIG_NOT_INITIALIZED" });

    const dataMint = new PublicKey(cfg.dataMint);
    if (dataMint.equals(PublicKey.default)) {
      return res.status(503).json({ error: "RESOURCE_REGISTRY_INCOMPLETE", details: ["DATA:missing_or_default"] });
    }
    // Каноничность минта DATA — до построения транзакции: подменённый SPL-минт
    // не станет «DATA» только потому, что так назван в теле запроса.
    const mintCheck = await validateSingleCanonicalResourceMint(connection, "DATA", dataMint);
    if (!mintCheck.ok) {
      return res.status(503).json({ error: "RESOURCE_MINT_REGISTRY_UNAVAILABLE_OR_INVALID", details: mintCheck.errors });
    }

    const rawAmount = String(req.body.dataAmount ?? "");
    if (!/^\d+$/.test(rawAmount)) throw new Error("dataAmount must be a positive whole number of DATA");
    const whole = new BN(rawAmount);
    // Курс 1:1: обменять можно и ровно 1 целый DATA, поэтому отсекаем только ноль
    // (bn.js `lten` — «меньше или равно»).
    if (whole.lten(0)) throw new Error("dataAmount must be a positive whole number of DATA");
    const dataAmount = whole.mul(RESOURCE_UNIT);

    const [energyAccount] = energyAccountPda(user);
    const userData = getAssociatedTokenAddressSync(dataMint, user);

    const ix = await (program.methods as any)
      .exchangeDataEnergy(dataAmount as any)
      .accounts({
        config,
        user,
        energyAccount,
        dataMint,
        userData,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(e?.status || 400).json({ error: e.message });
  }
});

export default r;
