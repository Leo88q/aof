/**
 * solCore.js — Solana equivalents of core Ronin helpers.
 * No mainnet secrets — devnet only.
 */

const nacl = require('tweetnacl');
const bs58 = require('bs58');
const { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount } = require('@solana/spl-token');

/**
 * Verify a Solana signed message (replacement for ethers.verifyMessage / EIP-712).
 * @param {string} message — original UTF-8 message
 * @param {string} sigBase64 — signature in base64
 * @param {string} addrBase58 — signer address in base58
 * @returns {boolean}
 */
function verifySolMessage(message, sigBase64, addrBase58) {
  try {
    const msgBytes = Buffer.from(message, 'utf8');
    const sig = Buffer.from(sigBase64, 'base64');
    const pub = bs58.decode(addrBase58);
    return nacl.sign.detached.verify(msgBytes, sig, pub);
  } catch (_) {
    return false;
  }
}

/**
 * Derive Solana program PDAs.
 */
// Keep the legacy helper aligned with the canonical Anchor program ID. The
// active backend uses src/lib/pda.ts; this file is not a deployment source.
const PROGRAM_ID = process.env.SOL_PROGRAM_ID || 'HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq';
const PROGRAM_ID_PK = new PublicKey(PROGRAM_ID);

function deriveConfig() {
  return PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID_PK);
}
function deriveAuth() {
  return PublicKey.findProgramAddressSync([Buffer.from('auth')], PROGRAM_ID_PK);
}
function deriveVault() {
  return PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID_PK);
}
function derivePlayer(user) {
  return PublicKey.findProgramAddressSync([Buffer.from('player'), new PublicKey(user).toBuffer()], PROGRAM_ID_PK);
}
function deriveGasTank(user) {
  return PublicKey.findProgramAddressSync([Buffer.from('gastank'), new PublicKey(user).toBuffer()], PROGRAM_ID_PK);
}
function deriveTool(mint) {
  return PublicKey.findProgramAddressSync([Buffer.from('tool'), new PublicKey(mint).toBuffer()], PROGRAM_ID_PK);
}

/**
 * Convert SOL-micros (1e6 per SOL) -> lamports (1e9 per SOL)
 * 1 micros = 1000 lamports
 */
const MICROS_TO_LAMPORTS = 1000;
function microsToLamports(micros) {
  return BigInt(micros) * BigInt(MICROS_TO_LAMPORTS);
}
function lamportsToMicros(lamports) {
  return BigInt(lamports) / BigInt(MICROS_TO_LAMPORTS);
}

/**
 * Get SPL token balances for resource mints + SOL + gastank
 * Returns: { food, wood, stone, sol, gastankLamports }
 */
async function getWalletBalancesSol(walletAddress) {
  const rpc = process.env.SOL_RPC || 'https://api.devnet.solana.com';
  const conn = new Connection(rpc, 'confirmed');
  const userPk = new PublicKey(walletAddress);

  // resource mint addresses from env (or derive from config PDA)
  const foodMint = new PublicKey(process.env.SOL_FOOD_MINT || 'So11111111111111111111111111111111111111112'); // placeholder
  const woodMint = new PublicKey(process.env.SOL_WOOD_MINT || 'So11111111111111111111111111111111111111112');
  const stoneMint = new PublicKey(process.env.SOL_STONE_MINT || 'So11111111111111111111111111111111111111112');

  async function getSplBalance(mint) {
    try {
      const ata = await getAssociatedTokenAddress(mint, userPk);
      const acc = await getAccount(conn, ata);
      return Number(acc.amount);
    } catch (_) {
      return 0;
    }
  }

  const [food, wood, stone, sol, gastankLamports] = await Promise.all([
    getSplBalance(foodMint),
    getSplBalance(woodMint),
    getSplBalance(stoneMint),
    conn.getBalance(userPk),
    // gastank PDA holds SOL directly
    (async () => {
      try {
        const [gastank] = deriveGasTank(walletAddress);
        return await conn.getBalance(gastank);
      } catch (_) {
        return 0;
      }
    })(),
  ]);

  return { food, wood, stone, sol, gastankLamports };
}

/**
 * Compute vault SPL token delta from pre/post token balances in transaction meta.
 */
function vaultSplDelta(txMeta, mint) {
  if (!txMeta?.preTokenBalances || !txMeta?.postTokenBalances) return 0;
  const pre = txMeta.preTokenBalances.find(b => b.mint === mint && b.owner === 'vault');
  const post = txMeta.postTokenBalances.find(b => b.mint === mint && b.owner === 'vault');
  const preAmt = pre ? BigInt(pre.uiTokenAmount.amount) : 0n;
  const postAmt = post ? BigInt(post.uiTokenAmount.amount) : 0n;
  return Number(postAmt - preAmt);
}

/**
 * Compute lamports delta for a pubkey from pre/post balances.
 */
function lamportsDelta(txMeta, pubkey) {
  if (!txMeta?.preBalances || !txMeta?.postBalances) return 0;
  // accountKeys order maps to pre/postBalances
  // find index of pubkey in accountKeys
  const keys = txMeta.accountKeys || [];
  const idx = keys.findIndex(k => k.pubkey === pubkey);
  if (idx === -1) return 0;
  return Number(txMeta.postBalances[idx]) - Number(txMeta.preBalances[idx]);
}

/**
 * Fee constants (micros)
 */
const FEE_PER_CRAFT_MICROS = 100000;
const FEE_PER_NFT_MICROS = 10000;
const FEE_PER_PACK_MICROS = 10000;

module.exports = {
  verifySolMessage,
  deriveConfig,
  deriveAuth,
  deriveVault,
  derivePlayer,
  deriveGasTank,
  deriveTool,
  microsToLamports,
  lamportsToMicros,
  getWalletBalancesSol,
  vaultSplDelta,
  lamportsDelta,
  FEE_PER_CRAFT_MICROS,
  FEE_PER_NFT_MICROS,
  FEE_PER_PACK_MICROS,
  PROGRAM_ID,
};