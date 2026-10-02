import { Router } from "express";
import { connection, program } from "../provider";
import { createSeasonXpEntitlement } from "../lib/seasonXpEntitlementStore";
import { parseNewSeasonXpEntitlement } from "../lib/seasonXpEntitlement";
import { seasonPda } from "../lib/pda";
import { pk } from "../lib/tx";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

/**
 * Create a bounded, off-chain XP entitlement. This endpoint never broadcasts a
 * transaction and never pays for a player account; settlement is a separate
 * wallet-authenticated player claim through /xp/claims/:id/transaction.
 */
r.post("/grant-intent", requireAdmin, async (req, res) => {
  try {
    const input = parseNewSeasonXpEntitlement(req.body);
    const player = pk(input.player);
    if (player.toBase58() !== input.player) return res.status(400).json({ error: "INVALID_XP_ENTITLEMENT_PLAYER" });

    const [seasonAddress] = seasonPda(input.seasonId);
    const season = await (program.account as any).season.fetchNullable(seasonAddress);
    if (!season || Number(season.seasonId) !== input.seasonId) {
      return res.status(404).json({ error: "SEASON_NOT_FOUND" });
    }

    // These are read from the live RPC/program configuration, never accepted
    // from the admin request. The genesis digest is embedded in the exact
    // authority-signed on-chain instruction later returned to the player.
    const [clusterGenesisHash, currentSlot] = await Promise.all([
      connection.getGenesisHash(),
      connection.getSlot("confirmed"),
    ]);
    pk(clusterGenesisHash);
    const programId = program.programId.toBase58();
    const entitlement = await createSeasonXpEntitlement({
      input: { ...input, player: player.toBase58() },
      clusterGenesisHash,
      programId,
      currentSlot,
    });
    return res.status(201).json({
      entitlement: {
        id: entitlement.id,
        clusterGenesisHash: entitlement.clusterGenesisHash,
        programId: entitlement.programId,
        seasonId: entitlement.seasonId,
        player: entitlement.player,
        amount: entitlement.amount,
        campaignId: entitlement.campaignId,
        nonce: entitlement.nonce,
        expirySlot: entitlement.expirySlot,
        status: entitlement.status,
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002" || /UNIQUE constraint failed|unique constraint/i.test(String(error?.message ?? ""))) {
      return res.status(409).json({ error: "XP_ENTITLEMENT_CAMPAIGN_ALREADY_GRANTED" });
    }
    const message = String(error?.message ?? error);
    const status = message.startsWith("INVALID_XP_ENTITLEMENT") ? 400
      : message === "XP_ENTITLEMENT_PENDING_LIMIT" ? 429 : (error?.status || 500);
    return res.status(status).json({ error: message });
  }
});

export default r;
