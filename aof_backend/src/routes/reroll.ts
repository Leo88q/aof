import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import {AUTHORITY_PUBKEY} from "../config";
import { program, connection } from "../provider";
import {
  authPda,
  configPda,
  craftEconomyPda,
  gastankPda,
  rarityCounterPda,
  rerollCommitPda,
  rerollConfigPda,
  rerollMintPda,
  toolPda,
  toolMetadataRegistryPda,
  tokenMetadataPda,
  TOKEN_METADATA_PROGRAM_ID,
} from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { coSignWithVrfLookupTableQuoted } from "../lib/vrfLookupTableTransactions";
import {
  TOOL_DATA_ACCOUNT_SIZE,
  METAPLEX_METADATA_MAX_ACCOUNT_SIZE,
  METAPLEX_CREATION_FEE_LAMPORTS,
} from "../lib/accountSizes";
import { requireCircuitOpen, requireWalletLimits } from "../middleware/security";
import { requireAdmin } from "../middleware/adminAuth";
import { randomNonce, reservePoolSlot, vrfCommitAccounts } from "../lib/vrf";
import { commitStatus, selfSettleTransaction } from "../lib/vrfSettlement";

const r = Router();

r.post("/fuse", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const mintA = pk(req.body.mintA);
    const mintB = pk(req.body.mintB);
    const newMint = pk(req.body.newMint);
    const newType = req.body.newType;

    const [config] = configPda();
    const [gastank] = gastankPda(user);
    const [toolA] = toolPda(mintA);
    const [toolB] = toolPda(mintB);
    const [newToolData] = toolPda(newMint);
    const [auth] = authPda();
    const tokenA = getAssociatedTokenAddressSync(mintA, user);
    const tokenB = getAssociatedTokenAddressSync(mintB, user);
    const newToken = getAssociatedTokenAddressSync(newMint, user);

    // [AUDIT F-09] Rerolling now burns the craft bundle for the target rarity
    // and moves the rarity counter. The on-chain side derives the target rarity
    // itself (tool_a.rarity + 1); we only have to resolve the resource mints
    // from Config and derive the matching ATAs and the rarity counter PDA.
    const [craftEconomy] = craftEconomyPda();
    const cfg: any = await (program.account as any)["config"].fetch(config);
    const toolAccount: any = await (program.account as any)["toolData"].fetch(toolA);
    const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
    const rarityOf = (v: any): number => {
      if (typeof v === "number") return v;
      return RARITIES.findIndex((name) => v && typeof v === "object" && name in v);
    };
    const targetRarity = rarityOf(toolAccount.rarity) + 1;
    if (!(targetRarity >= 1 && targetRarity < RARITIES.length)) {
      throw new Error("Reroll target rarity is out of range");
    }
    const [rarityCounter] = rarityCounterPda(targetRarity);
    const resourceMints = {
      circuit: new PublicKey(cfg.circuitMint),
      silicon: new PublicKey(cfg.siliconMint),
      data: new PublicKey(cfg.dataMint),
      neuron: new PublicKey(cfg.neuronMint),
      power: new PublicKey(cfg.powerMint),
      mind: new PublicKey(cfg.mindMint),
    };
    const ata = (m: PublicKey) => getAssociatedTokenAddressSync(m, user);

    const ix = await (program.methods as any)
      .reroll(newType)
      .accounts({
        config,
        user,
        gastank,
        toolA,
        mintA,
        tokenA,
        toolB,
        mintB,
        tokenB,
        newMint,
        newToken,
        newToolData,
        auth,
        rarityCounter,
        craftEconomy,
        circuitMint: resourceMints.circuit,
        userCircuit: ata(resourceMints.circuit),
        siliconMint: resourceMints.silicon,
        userSilicon: ata(resourceMints.silicon),
        dataMint: resourceMints.data,
        userData: ata(resourceMints.data),
        neuronMint: resourceMints.neuron,
        userNeuron: ata(resourceMints.neuron),
        powerMint: resourceMints.power,
        userPower: ata(resourceMints.power),
        mindMint: resourceMints.mind,
        userMind: ata(resourceMints.mind),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        toolMetadataRegistry: toolMetadataRegistryPda()[0],
        metadata: tokenMetadataPda(newMint)[0],
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .instruction();
    // User funds ToolData and both new Metaplex accounts; expose those rent
    // maxima in a quote bound to this exact transaction message.
    const prepared = await coSignWithVrfLookupTableQuoted([ix], user, [
      { name: "new_tool_data", address: newToolData, size: TOOL_DATA_ACCOUNT_SIZE, strategy: "init_if_needed" },
      { name: "metaplex_metadata", address: tokenMetadataPda(newMint)[0], size: METAPLEX_METADATA_MAX_ACCOUNT_SIZE, strategy: "init" , protocolFeeLamports: METAPLEX_CREATION_FEE_LAMPORTS },
    ]);
    res.json(prepared);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * [F-06] Random reroll: burn one tool, receive a random one. Operator
 * co-signed commit (fee escrowed from the gas tank, odds snapshotted,
 * Switchboard commit on a pool slot); the vrf-settler reveals it, or the
 * player can with POST /random/reveal. The new NFT is the PDA mint
 * [reroll_mint, rerollCommit].
 */
r.post("/random/commit", requireCircuitOpen, requireWalletLimits("reroll_commit"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const burnMint = pk(req.body.burnMint);
    const burnToken = req.body.burnToken ? pk(req.body.burnToken) : getAssociatedTokenAddressSync(burnMint, user);
    const nonce = randomNonce();
    const [rerollCommit] = rerollCommitPda(user, nonce);
    const slot = await reservePoolSlot(program, connection);
    const vrf = await vrfCommitAccounts(program, connection, slot);

    const ix = await (program.methods as any)
      .rerollRandomCommit(new BN(nonce))
      .accounts({
        config: configPda()[0],
        authority: AUTHORITY_PUBKEY,
        user,
        gastank: gastankPda(user)[0],
        rerollConfig: rerollConfigPda()[0],
        burnTool: toolPda(burnMint)[0],
        burnMint,
        burnToken,
        rerollCommit,
        ...vrf,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx, rerollCommit: rerollCommit.toBase58(), mint: rerollMintPda(rerollCommit)[0].toBase58(), nonce });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

r.get("/random/status/:rerollCommit", async (req, res) => {
  try {
    res.json(await commitStatus("reroll", new PublicKey(req.params.rerollCommit)));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** Transaction for the player to settle (or after the window refund) a reroll. */
r.post("/random/reveal", requireCircuitOpen, requireWalletLimits("reroll_reveal"), async (req, res) => {
  try {
    res.json(await selfSettleTransaction("reroll", pk(req.body.rerollCommit), pk(req.body.user)));
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

r.post("/config/init", requireAdmin, async (req, res) => {
  try {
    const oddsBps = req.body.oddsBps;
    const [config] = configPda();
    const [rerollConfig] = rerollConfigPda();

    const ix = await (program.methods as any)
      .initRerollConfig(oddsBps)
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        rerollConfig,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
