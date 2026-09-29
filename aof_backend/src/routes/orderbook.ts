import { Router } from 'express';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { program } from '../provider';
import { configPda, resourceOrderPda } from '../lib/pda';
import { coSign, pk } from '../lib/tx';

const r = Router();

/**
 * PRICE UNIT SAFETY: aof-core's place_buy_handler transfers
 * price_lamports_per_unit * amount, where amount is in atomic SPL units
 * (1 resource = 10^9 atoms). The old UI labeled the same price "SOL per
 * resource" and rounded amount with parseFloat, potentially escrowing a
 * billion times the shown total. A transaction guard did not bind that quote.
 * Disable ALL new trade/match routes for old clients as well as the new UI;
 * leave maker cancellation live so existing deposits remain recoverable.
 * A future migration needs a new contract price unit, exact amount handling,
 * a wallet-bound intent, and verified end-to-end quote tests before reopening.
 */
const tradingPaused = (_req: any, res: any) => res.status(503).json({ error: 'ORDERBOOK_NEW_TRADES_PAUSED_PRICE_UNIT_MISMATCH' });
r.post('/buy/place', tradingPaused);
r.post('/sell/place', tradingPaused);
r.post('/match', tradingPaused);

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

export default r;
