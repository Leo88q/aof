import { Router } from "express";
import { PublicKey } from "@solana/web3.js";
import { program } from "../provider";
import { energyAccountPda } from "../lib/pda";

const r = Router();
const REGEN_INTERVAL_MS = 30 * 60 * 1000;

// Read the canonical EnergyAccount. A local Prisma balance must never be used
// as an authoritative value for on-chain actions.
r.get("/balance/:user", async (req, res) => {
  try {
    const user = new PublicKey(req.params.user);
    const [address] = energyAccountPda(user);
    const account: any = await (program.account as any).energyAccount.fetchNullable(address);
    if (!account) {
      return res.status(503).json({
        error: "ENERGY_ACCOUNT_UNAVAILABLE_FROM_CANONICAL_CHAIN",
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const lastRegenAt = Number(account.lastRegenAt?.toString?.() ?? account.lastRegenAt ?? 0);
    const cap = Number(account.cap ?? 0);
    const current = Number(account.current ?? 0);
    const elapsedSeconds = Math.max(0, now - lastRegenAt);
    const regenSeconds = REGEN_INTERVAL_MS / 1000;
    const recovered = Math.min(cap, current + Math.floor(elapsedSeconds / regenSeconds));
    const msToNextUnit = recovered >= cap ? 0 : Math.max(0, REGEN_INTERVAL_MS - (elapsedSeconds * 1000 % REGEN_INTERVAL_MS));

    res.json({ amount: recovered, cap, msToNextUnit, source: "onchain" });
  } catch (e: any) {
    res.status(503).json({ error: "ENERGY_ACCOUNT_UNAVAILABLE_FROM_CANONICAL_CHAIN" });
  }
});

// Energy is debited by the canonical game instructions, not by a mutable
// off-chain endpoint.
r.post("/spend", (_req, res) => {
  res.status(503).json({
    error: "ENERGY_SPEND_MUST_USE_CANONICAL_GAME_INSTRUCTION",
  });
});

export default r;
