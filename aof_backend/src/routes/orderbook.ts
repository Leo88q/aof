import { Router } from 'express';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { SystemProgram } from '@solana/web3.js';
import { program } from '../provider';
import { configPda, materialMintsPda, resourceOrderPda, resourceOrderV2Pda } from '../lib/pda';
import { coSign, pk } from '../lib/tx';
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from '../middleware/security';

const r = Router();

/**
 * PRICE UNIT (v1): aof-core's place_buy_handler transfers
 * price_lamports_per_unit * amount, where amount is in atomic SPL units
 * (1 resource = 10^9 atoms). The old UI labeled the same price "SOL per
 * resource", so it could escrow a billion times the shown total. v1 placement
 * and matching stay closed for new orders; maker cancellation stays live so
 * existing deposits remain recoverable.
 */
const legacyPaused = (_req: any, res: any) => res.status(503).json({ error: 'ORDERBOOK_NEW_TRADES_PAUSED_PRICE_UNIT_MISMATCH' });
r.post('/buy/place', legacyPaused);
r.post('/sell/place', legacyPaused);
r.post('/match', legacyPaused);

/**
 * v2: the price is quoted for a WHOLE resource and every lamport amount is
 * rounded up inside the program, so `total` here is the same number the wallet
 * will see and the escrow can never exceed it. Both routes return the exact
 * quote (`priceLamportsPerWhole`, `amountAtoms`, `totalLamports`,
 * `escrowLamports`) so the client can bind it into the wallet intent.
 */
const ATOMS_PER_UNIT = 1_000_000_000n;

const u64 = (value: unknown, field: string): bigint => {
  const text = String(value ?? '');
  if (!/^[0-9]{1,20}$/.test(text) || BigInt(text) > (1n << 64n) - 1n) throw new Error(`${field} must be a u64`);
  return BigInt(text);
};

/** ceil(price × atoms / 1e9) — the exact formula of `quote_total_lamports`. */
export function quoteTotalLamports(pricePerWhole: bigint, amountAtoms: bigint): bigint {
  const product = pricePerWhole * amountAtoms;
  return (product + ATOMS_PER_UNIT - 1n) / ATOMS_PER_UNIT;
}

const takerBuffer = (total: bigint): bigint => (total * 40n + 9_999n) / 10_000n;

const quote = (pricePerWhole: bigint, amountAtoms: bigint) => {
  const total = quoteTotalLamports(pricePerWhole, amountAtoms);
  return { total, escrow: total + takerBuffer(total) };
};

r.post('/v2/buy/place', requireCircuitOpen, requireWalletLimits('orderbook_buy_place'), requireIdempotency, async (req, res) => {
  try {
    const maker = pk(req.body.maker);
    const mint = pk(req.body.mint);
    const kind = Number(req.body.kind);
    if (!Number.isInteger(kind) || kind < 0 || kind > 26) throw new Error('kind must be 0..26');
    const price = u64(req.body.priceLamportsPerWhole, 'priceLamportsPerWhole');
    const atoms = u64(req.body.amountAtoms, 'amountAtoms');
    if (price === 0n || atoms === 0n) throw new Error('ZeroAmount');
    const totals = quote(price, atoms);
    if (totals.total > (1n << 64n) - 1n || totals.escrow > (1n << 64n) - 1n) throw new Error('MathOverflow');
    const [order] = resourceOrderV2Pda(maker, mint);
    const ix = await (program.methods as any)
      .placeBuyOrderV2(kind, { toString: () => price.toString() } as any, { toString: () => atoms.toString() } as any)
      .accounts({
        config: configPda()[0],
        maker,
        mint,
        materialMints: materialMintsPda()[0],
        order,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], maker);
    res.json({
      tx, order: order.toBase58(), kind,
      priceLamportsPerWhole: price.toString(), amountAtoms: atoms.toString(),
      totalLamports: totals.total.toString(), escrowLamports: totals.escrow.toString(),
    });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

r.post('/v2/sell/place', requireCircuitOpen, requireWalletLimits('orderbook_sell_place'), requireIdempotency, async (req, res) => {
  try {
    const maker = pk(req.body.maker);
    const mint = pk(req.body.mint);
    const kind = Number(req.body.kind);
    if (!Number.isInteger(kind) || kind < 0 || kind > 26) throw new Error('kind must be 0..26');
    const price = u64(req.body.priceLamportsPerWhole, 'priceLamportsPerWhole');
    const atoms = u64(req.body.amountAtoms, 'amountAtoms');
    if (price === 0n || atoms === 0n) throw new Error('ZeroAmount');
    const totals = quote(price, atoms);
    const [order] = resourceOrderV2Pda(maker, mint);
    const orderVault = getAssociatedTokenAddressSync(mint, order, true);
    const makerToken = getAssociatedTokenAddressSync(mint, maker);
    const ix = await (program.methods as any)
      .placeSellOrderV2(kind, { toString: () => price.toString() } as any, { toString: () => atoms.toString() } as any)
      .accounts({
        config: configPda()[0],
        maker,
        mint,
        materialMints: materialMintsPda()[0],
        makerToken,
        order,
        orderVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], maker);
    res.json({
      tx, order: order.toBase58(), kind,
      priceLamportsPerWhole: price.toString(), amountAtoms: atoms.toString(),
      totalLamports: totals.total.toString(),
    });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

// v1 cancellation stays live for every escrow created before the price-unit
// migration: it only returns the maker's own deposit and rent, so closing it
// would strand funds. New orders cannot be created on v1 (see above).
r.post('/buy/cancel', async (req, res) => {
  try {
    const maker = pk(req.body.maker);
    const mint = pk(req.body.mint);
    const [config] = configPda();
    const [order] = resourceOrderPda(maker, mint);
    const ix = await (program.methods as any).cancelBuyOrder()
      .accounts({ config, maker, mint, order }).instruction();
    res.json({ tx: await coSign([ix], maker) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post('/sell/cancel', async (req, res) => {
  try {
    const maker = pk(req.body.maker);
    const mint = pk(req.body.mint);
    const [config] = configPda();
    const [order] = resourceOrderPda(maker, mint);
    const orderVault = getAssociatedTokenAddressSync(mint, order, true);
    const makerToken = getAssociatedTokenAddressSync(mint, maker);
    const ix = await (program.methods as any).cancelSellOrder()
      .accounts({ config, maker, mint, order, orderVault, makerToken, tokenProgram: TOKEN_PROGRAM_ID })
      .instruction();
    res.json({ tx: await coSign([ix], maker) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Cancellation of v2 orders: the programs closes the PDA back to the maker, so
// the full remaining escrow and rent return in one instruction.
r.post('/v2/buy/cancel', async (req, res) => {
  try {
    const maker = pk(req.body.maker);
    const mint = pk(req.body.mint);
    const [order] = resourceOrderV2Pda(maker, mint);
    const ix = await (program.methods as any)
      .cancelBuyOrderV2()
      .accounts({ config: configPda()[0], maker, mint, order })
      .instruction();
    res.json({ tx: await coSign([ix], maker), order: order.toBase58() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post('/v2/sell/cancel', async (req, res) => {
  try {
    const maker = pk(req.body.maker);
    const mint = pk(req.body.mint);
    const [order] = resourceOrderV2Pda(maker, mint);
    const orderVault = getAssociatedTokenAddressSync(mint, order, true);
    const makerToken = getAssociatedTokenAddressSync(mint, maker);
    const ix = await (program.methods as any)
      .cancelSellOrderV2()
      .accounts({ config: configPda()[0], maker, mint, order, orderVault, makerToken, tokenProgram: TOKEN_PROGRAM_ID })
      .instruction();
    res.json({ tx: await coSign([ix], maker), order: order.toBase58() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Permissionless v2 match. The caller supplies both order PDAs; the program
 * re-derives them from each order's own maker and refuses a pair that does not
 * cross, so a tampered quote cannot settle anything the chain would not.
 */
r.post('/v2/match', requireCircuitOpen, requireWalletLimits('orderbook_match'), requireIdempotency, async (req, res) => {
  try {
    const caller = pk(req.body.caller);
    const mint = pk(req.body.mint);
    const buyOrder = pk(req.body.buyOrder);
    const sellOrder = pk(req.body.sellOrder);
    // The client sends the makers; the PDAs are re-derived from them here and
    // again inside the program, so a tampered quote can never settle a pair the
    // chain would not accept.
    const [expectedBuy] = resourceOrderV2Pda(pk(req.body.buyMaker), mint);
    const [expectedSell] = resourceOrderV2Pda(pk(req.body.sellMaker), mint);
    if (!expectedBuy.equals(buyOrder) || !expectedSell.equals(sellOrder)) throw new Error('ORDER_PDA_MISMATCH');
    const config: any = await (program.account as any).config.fetch(configPda()[0]);
    const buyAccount: any = await (program.account as any).resourceOrderV2.fetch(buyOrder);
    const sellAccount: any = await (program.account as any).resourceOrderV2.fetch(sellOrder);
    if (buyAccount.isBuy !== true || sellAccount.isBuy !== false) throw new Error('OrdersDoNotCross');
    const amount = buyAccount.amountRemaining.lt(sellAccount.amountRemaining)
      ? buyAccount.amountRemaining : sellAccount.amountRemaining;
    if (amount.isZero()) return res.status(409).json({ error: 'ORDER_EXHAUSTED' });
    const price = BigInt(sellAccount.priceLamportsPerWhole.toString());
    const gross = quoteTotalLamports(price, BigInt(amount.toString()));
    const takerFee = gross * 40n / 10_000n;
    const makerFee = gross * 10n / 10_000n;
    if (BigInt(buyAccount.escrowLamports.toString()) < gross + takerFee) {
      return res.status(409).json({ error: 'INSUFFICIENT_ORDER_ESCROW' });
    }
    const ix = await (program.methods as any)
      .matchResourceOrdersV2()
      .accounts({
        config: configPda()[0],
        materialMints: materialMintsPda()[0],
        mint,
        buyOrder,
        sellOrder,
        seller: sellAccount.maker,
        treasury: config.treasury,
        sellVault: getAssociatedTokenAddressSync(mint, sellOrder, true),
        buyerToken: getAssociatedTokenAddressSync(mint, buyAccount.maker),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const tx = await coSign([ix], caller);
    res.json({
      tx, treasury: config.treasury.toBase58(), amountAtoms: amount.toString(),
      grossLamports: gross.toString(), takerFeeLamports: takerFee.toString(),
      makerFeeLamports: makerFee.toString(),
    });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

export default r;
