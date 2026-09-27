import { BN } from "bn.js";
import { Router } from "express";
import { SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
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
    // [SECURITY_CHECKLIST_REVIEW F-H] the NFT is escrowed in the listing's ATA
    // for as long as the listing exists.
    const ownerToken = getAssociatedTokenAddressSync(mint, owner);
    const rentalVault = getAssociatedTokenAddressSync(mint, rentalListing, true);
    const vaultAta = createAssociatedTokenAccountIdempotentInstruction(owner, rentalVault, rentalListing, mint);

    const ix = await (program.methods as any)
      .rentalList(ownerSplitBps, minDuration as any, maxDuration as any, pricePerHourLamports as any)
      .accounts({
        config,
        owner,
        mint,
        tool,
        rentalListing,
        ownerToken,
        rentalVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = await coSign([vaultAta, ix], owner);
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
    // [SECURITY_CHECKLIST_REVIEW F-H] The renter signs a ceiling on the total fee
    // (terms can change between listings). Default: the quote shown right now.
    const quote = new BN(listing.pricePerHourLamports.toString()).mul(durationSeconds).div(new BN(3600));
    const maxTotalFee = req.body.maxTotalFeeLamports !== undefined
      ? new BN(String(req.body.maxTotalFeeLamports))
      : quote;
    if (maxTotalFee.isNeg()) throw new Error("maxTotalFeeLamports must be a non-negative integer");
    const rentalVault = getAssociatedTokenAddressSync(mint, rentalListing, true);

    const ix = await (program.methods as any)
      .rentalStartBounded(durationSeconds as any, maxTotalFee as any)
      .accounts({
        config,
        renter,
        mint,
        tool,
        rentalListing,
        owner: listing.owner,
        treasury: cfg.treasury,
        rentalAgreement,
        rentalVault,
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
    const [config] = configPda();
    const [tool] = toolPda(mint);
    const [rentalAgreement] = rentalAgreementPda(mint);

    const ix = await (program.methods as any)
      .rentalEnd()
      .accounts({ config, caller, mint, tool, rentalAgreement, renterRefund })
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
    const [config] = configPda();
    const [tool] = toolPda(mint);
    const [rentalAgreement] = rentalAgreementPda(mint);
    const agreement: any = await (program.account as any)["rentalAgreement"].fetch(rentalAgreement);

    const [rentalListing] = rentalListingPda(mint);

    const ix = await (program.methods as any)
      .rentalRevoke()
      .accounts({
        config, owner, mint, tool, rentalAgreement, renterRefund: agreement.renter,
        // [SECURITY_CHECKLIST_REVIEW F-H] terms for the pro-rata refund
        rentalListing, systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = await coSign([ix], owner);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// [SECURITY_CHECKLIST_REVIEW F-H] Withdraw a listing that is not rented out: the
// escrowed NFT returns to the tool's owner, rent to whoever paid the listing.
r.post("/delist", requireCircuitOpen, requireWalletLimits("rental__delist"), requireIdempotency, async (req, res) => {
  try {
    const caller = pk(req.body.caller);
    const mint = pk(req.body.mint);
    const [config] = configPda();
    const [tool] = toolPda(mint);
    const [rentalListing] = rentalListingPda(mint);
    const listing: any = await (program.account as any)["rentalListing"].fetch(rentalListing);
    const toolData: any = await (program.account as any)["toolData"].fetch(tool);
    const ownerToken = getAssociatedTokenAddressSync(mint, toolData.owner);
    const rentalVault = getAssociatedTokenAddressSync(mint, rentalListing, true);
    const ownerAta = createAssociatedTokenAccountIdempotentInstruction(caller, ownerToken, toolData.owner, mint);

    const ix = await (program.methods as any)
      .rentalDelist()
      .accounts({
        config, caller, mint, tool, rentalListing, lister: listing.owner,
        rentalVault, ownerToken, tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = await coSign([ownerAta, ix], caller);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
