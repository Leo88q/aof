import { BN } from "bn.js";
import { Router } from "express";
import { SystemProgram } from "@solana/web3.js";
import { program } from "../provider";
import { configPda, rentalAgreementPda, rentalListingPda, toolPda } from "../lib/pda";
import { coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";

const r = Router();

r.post("/list", requireCircuitOpen, requireWalletLimits("rental__list"), requireIdempotency, async (req, res) => {
  try {
    const owner = pk(req.body.owner);
    const mint = pk(req.body.mint);
    const ownerSplitBps = Number(req.body.ownerSplitBps);
    const minDuration = new BN(req.body.minDuration);
    const maxDuration = new BN(req.body.maxDuration);
    // [ФИКС] Цена аренды за час в lamports (если не указана — аренда бесплатна)
    const pricePerHourLamports = new BN(req.body.pricePerHourLamports || 0);
    const [config] = configPda();
    const [tool] = toolPda(mint);
    const [rentalListing] = rentalListingPda(mint);

    const ix = await (program.methods as any)
      .rentalList(ownerSplitBps, minDuration as any, maxDuration as any, pricePerHourLamports as any)
      .accounts({
        config,
        owner,
        mint,
        tool,
        rentalListing,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = await coSign([ix], owner);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/start", requireCircuitOpen, requireWalletLimits("rental__start"), requireIdempotency, async (req, res) => {
  try {
    const renter = pk(req.body.renter);
    const mint = pk(req.body.mint);
    const durationSeconds = new BN(req.body.durationSeconds);
    const [config] = configPda();
    const [tool] = toolPda(mint);
    const [rentalListing] = rentalListingPda(mint);
    const [rentalAgreement] = rentalAgreementPda(mint);

    // [ФИКС] Читаем листинг (владелец) и конфиг (казна) для новых аккаунтов
    // оплаты аренды: аванс сплится между владельцем и казной
    const listing: any = await (program.account as any)["rentalListing"].fetch(rentalListing);
    const cfg: any = await (program.account as any)["config"].fetch(config);

    const ix = await (program.methods as any)
      .rentalStart(durationSeconds as any)
      .accounts({
        config,
        renter,
        mint,
        tool,
        rentalListing,
        owner: listing.owner,
        treasury: cfg.treasury,
        rentalAgreement,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = await coSign([ix], renter);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/end", requireCircuitOpen, requireWalletLimits("rental__end"), requireIdempotency, async (req, res) => {
  try {
    const caller = pk(req.body.caller);
    const mint = pk(req.body.mint);
    const renterRefund = pk(req.body.renterRefund);
    const [tool] = toolPda(mint);
    const [rentalAgreement] = rentalAgreementPda(mint);

    const ix = await (program.methods as any)
      .rentalEnd()
      .accounts({ caller, mint, tool, rentalAgreement, renterRefund })
      .instruction();

    const tx = await coSign([ix], caller);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/revoke", requireCircuitOpen, requireWalletLimits("rental__revoke"), requireIdempotency, async (req, res) => {
  try {
    const owner = pk(req.body.owner);
    const mint = pk(req.body.mint);
    const [tool] = toolPda(mint);
    const [rentalAgreement] = rentalAgreementPda(mint);

    const ix = await (program.methods as any)
      .rentalRevoke()
      .accounts({ owner, mint, tool, rentalAgreement })
      .instruction();

    const tx = await coSign([ix], owner);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
