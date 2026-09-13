/**
 * index.solana.js — Age of Farming: Solana Migration backend.
 * Firebase Functions v2 (onCall), Node.js 20, CommonJS.
 *
 * Devnet/localnet first. No mainnet secrets.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const crypto = require('crypto');

const solCore = require('../solCore.js');

// ============================================
// Config (env)
// ============================================
const SOL_RPC = process.env.SOL_RPC || 'http://localhost:8899';
const AOF_PROGRAM_ID = process.env.AOF_PROGRAM_ID || '';
const SOL_AUTHORITY_KEY = process.env.SOL_AUTHORITY_KEY || '';
const SOL_FEE_WALLET = process.env.SOL_FEE_WALLET || '';

if (!AOF_PROGRAM_ID) {
  console.warn('[aof-sol] AOF_PROGRAM_ID is not set — on-chain calls will fail.');
}

const PROGRAM_ID_PK = AOF_PROGRAM_ID ? new PublicKey(AOF_PROGRAM_ID) : null;

admin.initializeApp();
const db = admin.firestore();
const connection = new Connection(SOL_RPC, 'confirmed');

// ============================================
// Helpers: signature verification
// ============================================

/**
 * Verify an ed25519 signed message (Solana wallet standard).
 * @param {string} message      original UTF-8 message that was signed
 * @param {string} sigBase64    signature, base64
 * @param {string} pubkeyBase58 signer pubkey, base58
 * @returns {boolean}
 */
function verifySolMessage(message, sigBase64, pubkeyBase58) {
  try {
    const msgBytes = Buffer.from(message, 'utf8');
    const sigBytes = Buffer.from(sigBase64, 'base64');
    const pubBytes = bs58.decode(pubkeyBase58);
    if (sigBytes.length !== nacl.sign.signatureLength) return false;
    if (pubBytes.length !== nacl.sign.publicKeyLength) return false;
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
  } catch (_) {
    return false;
  }
}

// ============================================
// Helpers: tx hashing & deduplication
// ============================================

/**
 * sha256 over the raw transaction bytes (base64 input) — stable idempotency key.
 * @param {string} txBase64 serialized transaction, base64
 * @returns {string} hex digest
 */
function computeTxHash(txBase64) {
  return crypto.createHash('sha256').update(Buffer.from(txBase64, 'base64')).digest('hex');
}

/**
 * Record a processed transaction in sol_tx_log (deduplication).
 * Throws HttpsError('already-exists') if the same tx was already applied.
 * @param {string} txHash sha256 hex from computeTxHash()
 * @param {string} uid    authenticated user id
 * @param {string} type   logical operation, e.g. 'craft' | 'stake' | 'withdraw'
 */
async function recordTx(txHash, uid, type) {
  const ref = db.collection('sol_tx_log').doc(txHash);
  const snap = await ref.get();
  if (snap.exists) {
    throw new HttpsError('already-exists', `Transaction ${txHash} has already been processed`);
  }
  await ref.set({
    txHash,
    uid,
    type,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ============================================
// Helpers: on-chain event parsing (Anchor)
// ============================================

/** Minimal borsh-style reader over a Buffer. */
function makeReader(buf) {
  let off = 0;
  return {
    u8() { return buf.readUInt8(off++); },
    u32() { const v = buf.readUInt32LE(off); off += 4; return v; },
    u64() { const v = buf.readBigUInt64LE(off); off += 8; return v; },
    i64() { const v = buf.readBigInt64LE(off); off += 8; return v; },
    bool() { return buf.readUInt8(off++) === 1; },
    pk() { const v = new PublicKey(buf.subarray(off, off + 32)); off += 32; return v.toBase58(); },
    str() { const len = this.u32(); const v = buf.toString('utf8', off, off + len); off += len; return v; },
    bytes(n) { const v = Buffer.from(buf.subarray(off, off + n)); off += n; return v; },
    done() { return off >= buf.length; },
  };
}

/** Anchor event discriminator = sha256("event:<Name>")[0..8]. */
function eventDisc(name) {
  return crypto.createHash('sha256').update(`event:${name}`).digest().subarray(0, 8);
}

const KNOWN_EVENTS = ['Staked', 'Unstaked', 'PaidOut', 'Crafted', 'Rerolled', 'MintedTool', 'BurnedNft'];
const EVENT_DISC_MAP = Object.fromEntries(KNOWN_EVENTS.map((n) => [eventDisc(n).toString('hex'), n]));

/** Best-effort decode of a known event payload (field order must match the Rust event). */
function decodeEvent(name, payload) {
  const r = makeReader(payload);
  try {
    switch (name) {
      case 'Staked':
      case 'Unstaked':
        return { name, data: { user: r.pk(), mint: r.pk() } };
      case 'PaidOut':
        return { name, data: { user: r.pk(), amount: Number(r.u64()) } };
      case 'Crafted':
        return { name, data: { user: r.pk(), prevMint: r.pk(), newMint: r.pk(), toolType: r.str(), rarity: r.u8() } };
      case 'Rerolled':
        return { name, data: { user: r.pk(), mintA: r.pk(), mintB: r.pk(), newMint: r.pk(), newType: r.str() } };
      case 'MintedTool':
        return { name, data: { user: r.pk(), mint: r.pk(), toolType: r.str(), rarity: r.u8() } };
      case 'BurnedNft':
        return { name, data: { user: r.pk(), mint: r.pk() } };
      default:
        return { name, data: { raw: payload.toString('hex') } };
    }
  } catch (_) {
    return { name, data: { raw: payload.toString('hex') } };
  }
}

/**
 * Fetch a confirmed transaction and decode all Anchor program events
 * from its "Program data: ..." logs.
 * @param {string} signature transaction signature
 * @returns {Promise<Array<{name: string, data: object}>>}
 */
async function eventsOf(signature) {
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: 'confirmed',
  });
  if (!tx?.meta?.logMessages) return [];
  const events = [];
  for (const log of tx.meta.logMessages) {
    if (!log.startsWith('Program data: ')) continue;
    try {
      const raw = Buffer.from(bs58.decode(log.slice('Program data: '.length)));
      if (raw.length < 9) continue;
      const eventName = EVENT_DISC_MAP[raw.subarray(0, 8).toString('hex')];
      if (!eventName) continue;
      events.push(decodeEvent(eventName, raw.subarray(8)));
    } catch (_) {
      // skip malformed log lines
    }
  }
  return events;
}

// ============================================
// Helpers: pack loot rolling
// ============================================

const LOOT_TABLE = [
  { rarity: 'Common', weight: 60 },
  { rarity: 'Uncommon', weight: 25 },
  { rarity: 'Rare', weight: 10 },
  { rarity: 'Epic', weight: 4 },
  { rarity: 'Legendary', weight: 1 },
];

const TOOL_TYPES = ['Axe', 'Pickaxe', 'FishingRod', 'WateringCan'];

/**
 * Roll a random loot drop for opening a pack.
 * @returns {{ toolType: string, rarity: string }}
 */
function rollLoot() {
  const totalWeight = LOOT_TABLE.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  let rarity = LOOT_TABLE[0].rarity;
  for (const entry of LOOT_TABLE) {
    roll -= entry.weight;
    if (roll <= 0) {
      rarity = entry.rarity;
      break;
    }
  }
  const toolType = TOOL_TYPES[Math.floor(Math.random() * TOOL_TYPES.length)];
  return { toolType, rarity };
}
// ============================================
// Endpoints: wallet authentication (Solana)
// ============================================

const AUTH_CHALLENGE_TTL_MS = 5 * 60 * 1000;   // challenge lives 5 minutes
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;    // session lives 24 hours

/**
 * Step 1: issue a random sign-in challenge for a Solana wallet.
 * Stored in Firestore collection `sol_auth`, keyed by pubkey.
 */
exports.getWalletAuthChallenge = onCall(async (request) => {
  const pubkeyRaw = String(request.data?.pubkey || '').trim();
  if (!pubkeyRaw) {
    throw new HttpsError('invalid-argument', 'pubkey is required');
  }

  let pk;
  try {
    pk = new PublicKey(pubkeyRaw);
  } catch (_) {
    throw new HttpsError('invalid-argument', 'Invalid Solana pubkey');
  }
  const pubkey = pk.toBase58();

  const nonce = crypto.randomBytes(32).toString('base64url');
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + AUTH_CHALLENGE_TTL_MS;

  const challenge =
    `Age of Farming — Solana sign-in
` +
    `wallet: ${pubkey}
` +
    `nonce: ${nonce}
` +
    `issuedAt: ${issuedAtMs}
` +
    `chain: devnet`;

  await db.collection('sol_auth').doc(pubkey).set({
    pubkey,
    nonce,
    challenge,
    issuedAtMs,
    expiresAtMs,
    used: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { challenge, expiresInSec: Math.floor(AUTH_CHALLENGE_TTL_MS / 1000) };
});

/**
 * Step 2: verify the ed25519 signature over the challenge
 * (verifySolMessage instead of the legacy verifyMessage),
 * enforce challenge freshness & single-use, then create a session.
 */
exports.authenticateSolanaWallet = onCall(async (request) => {
  const pubkeyRaw = String(request.data?.pubkey || '').trim();
  const signature = String(request.data?.signature || '').trim();
  if (!pubkeyRaw || !signature) {
    throw new HttpsError('invalid-argument', 'pubkey and signature are required');
  }

  let pk;
  try {
    pk = new PublicKey(pubkeyRaw);
  } catch (_) {
    throw new HttpsError('invalid-argument', 'Invalid Solana pubkey');
  }
  const pubkey = pk.toBase58();

  const ref = db.collection('sol_auth').doc(pubkey);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'No challenge issued for this wallet');
  }
  const rec = snap.data();

  // anti-replay: challenge is single-use
  if (rec.used) {
    throw new HttpsError('already-exists', 'Challenge already consumed');
  }

  // freshness check
  const now = Date.now();
  if (!rec.expiresAtMs || now > rec.expiresAtMs) {
    throw new HttpsError('deadline-exceeded', 'Challenge expired — request a new one');
  }

  // ed25519 detached signature verification (Solana wallet standard)
  const sigOk = verifySolMessage(rec.challenge, signature, pubkey);
  if (!sigOk) {
    throw new HttpsError('permission-denied', 'Signature verification failed');
  }

  // consume the challenge
  await ref.update({
    used: true,
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const uid = `sol:${pubkey}`;
  const sessionId = crypto.randomBytes(16).toString('hex');
  const sessionExpiresAtMs = now + SESSION_TTL_MS;

  await db.collection('sol_sessions').doc(sessionId).set({
    sessionId,
    uid,
    pubkey,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAtMs: sessionExpiresAtMs,
  });

  await db.collection('players').doc(uid).set(
    {
      uid,
      wallet: pubkey,
      chain: 'solana',
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Firebase custom token acts as the session credential client-side
  const token = await admin.auth().createCustomToken(uid, {
    wallet: pubkey,
    chain: 'solana',
    sessionId,
  });

  return { ok: true, uid, sessionId, token, expiresAtMs: sessionExpiresAtMs };
});

// ============================================
// Endpoint: wallet balances
// ============================================

const TOKEN_PROGRAM_ID_PK = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/**
 * Balances of a Solana wallet:
 * - SOL (lamports) via connection.getBalance
 * - SPL resource tokens (food/wood/stone) via getParsedTokenAccountsByOwner
 * - gas tank PDA lamports
 *
 * Resource amounts are tracked in micros (1e6); lamports equivalents
 * are derived through solCore.microsToLamports (1 micro = 1000 lamports).
 */
exports.getWalletBalancesSol = onCall(async (request) => {
  const pubkeyRaw = String(request.data?.pubkey || '').trim();
  if (!pubkeyRaw) {
    throw new HttpsError('invalid-argument', 'pubkey is required');
  }

  let ownerPk;
  try {
    ownerPk = new PublicKey(pubkeyRaw);
  } catch (_) {
    throw new HttpsError('invalid-argument', 'Invalid Solana pubkey');
  }
  const pubkey = ownerPk.toBase58();

  const [solLamports, parsedAccounts, gastankLamports] = await Promise.all([
    connection.getBalance(ownerPk, 'confirmed'),
    connection
      .getParsedTokenAccountsByOwner(ownerPk, { programId: TOKEN_PROGRAM_ID_PK })
      .catch(() => ({ value: [] })),
    connection
      .getBalance(solCore.deriveGasTank(pubkey)[0], 'confirmed')
      .catch(() => 0),
  ]);

  // aggregate raw SPL amounts per mint across all token accounts
  const byMint = new Map();
  for (const { account } of parsedAccounts.value || []) {
    const info = account?.data?.parsed?.info;
    if (!info?.mint) continue;
    const raw = BigInt(info.tokenAmount?.amount ?? '0');
    byMint.set(info.mint, (byMint.get(info.mint) || 0n) + raw);
  }

  const RESOURCE_MINTS = {
    food: process.env.SOL_FOOD_MINT || '',
    wood: process.env.SOL_WOOD_MINT || '',
    stone: process.env.SOL_STONE_MINT || '',
  };

  const resources = {};
  for (const [key, mint] of Object.entries(RESOURCE_MINTS)) {
    if (!mint) continue;
    const micros = Number(byMint.get(mint) ?? 0n);
    resources[key] = {
      mint,
      micros,
      lamports: Number(solCore.microsToLamports(micros)),
    };
  }

  return {
    pubkey,
    sol: solLamports,
    gastankLamports,
    resources,
  };
});
// ============================================
// Endpoints: NFT tool minting (server co-sign flow)
// ============================================

const { Keypair, TransactionInstruction } = require('@solana/web3.js');

const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

/** Anchor instruction discriminator = sha256("global:<Name>")[0..8]. */
function globalDisc(name) {
  return crypto.createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

/** borsh-encode a Rust String (u32 LE length + utf8 bytes). */
function borshString(s) {
  const b = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(b.length, 0);
  return Buffer.concat([len, b]);
}

/** Lazily parsed authority keypair (base58 secret from env). */
let _authorityKp = null;
function getAuthorityKeypair() {
  if (_authorityKp) return _authorityKp;
  if (!SOL_AUTHORITY_KEY) {
    throw new HttpsError('failed-precondition', 'SOL_AUTHORITY_KEY is not configured');
  }
  try {
    _authorityKp = new Keypair(bs58.decode(SOL_AUTHORITY_KEY.trim()));
  } catch (_) {
    throw new HttpsError('internal', 'Invalid SOL_AUTHORITY_KEY');
  }
  return _authorityKp;
}

/**
 * Global pause switch (Firestore config/solana.paused).
 * The on-chain program enforces its own pause as well.
 */
async function assertNotPaused() {
  const snap = await db.collection('config').doc('solana').get();
  if (snap.exists && snap.data()?.paused === true) {
    throw new HttpsError('failed-precondition', 'Minting is temporarily paused');
  }
}

/**
 * 4. Build a PARTIALLY-signed mint transaction.
 * Flow: verifySolMessage -> paused check -> build craft tx with fee in whole
 * micros (converted via microsToLamports) -> authority partial-sign ->
 * return { txBase64 } for the client to co-sign (user = fee payer + signer).
 */
exports.mintNFTTool = onCall(async (request) => {
  const type = String(request.data?.type || '').trim();
  const rarity = String(request.data?.rarity || '').trim();
  const pubkeyRaw = String(request.data?.userPubkey || '').trim();
  const signature = String(request.data?.userSignature || '').trim();

  if (!type || !rarity || !pubkeyRaw || !signature) {
    throw new HttpsError('invalid-argument', 'type, rarity, userPubkey and userSignature are required');
  }
  if (!TOOL_TYPES.includes(type)) {
    throw new HttpsError('invalid-argument', `Unknown tool type: ${type}`);
  }
  const rarityIdx = RARITY_ORDER.indexOf(rarity);
  if (rarityIdx === -1) {
    throw new HttpsError('invalid-argument', `Unknown rarity: ${rarity}`);
  }
  if (!PROGRAM_ID_PK) {
    throw new HttpsError('failed-precondition', 'AOF_PROGRAM_ID is not configured');
  }

  let userPk;
  try {
    userPk = new PublicKey(pubkeyRaw);
  } catch (_) {
    throw new HttpsError('invalid-argument', 'Invalid Solana pubkey');
  }
  const user = userPk.toBase58();

  // --- ed25519 signature verification over the canonical mint request ---
  const message =
    `Age of Farming — mint NFT tool
` +
    `type: ${type}
` +
    `rarity: ${rarity}
` +
    `user: ${user}
` +
    `feeMicros: ${solCore.FEE_PER_NFT_MICROS}
` +
    `chain: devnet`;

  if (!verifySolMessage(message, signature, user)) {
    throw new HttpsError('permission-denied', 'Signature verification failed');
  }

  // --- pause check ---
  await assertNotPaused();

  // --- fee: integer micros -> lamports (no float math anywhere) ---
  const feeLamports = Number(solCore.microsToLamports(solCore.FEE_PER_NFT_MICROS));

  // --- PDAs ---
  const [authPda] = solCore.deriveAuth();
  const [configPda] = solCore.deriveConfig();
  const [vaultPda] = solCore.deriveVault();
  const [playerPda] = solCore.derivePlayer(user);
  const [gastankPda] = solCore.deriveGasTank(user);

  // --- instruction data: disc("global:mint_tool") + borsh(type: String, rarity: u8) ---
  const ixData = Buffer.concat([
    globalDisc('mint_tool'),
    borshString(type),
    Buffer.from([rarityIdx]),
  ]);

  const authorityKp = getAuthorityKeypair();

  const mintIx = new TransactionInstruction({
    programId: PROGRAM_ID_PK,
    keys: [
      { pubkey: authPda, isSigner: false, isWritable: true },
      { pubkey: authorityKp.publicKey, isSigner: true, isWritable: false }, // server co-sign
      { pubkey: userPk, isSigner: true, isWritable: true },                 // client co-sign
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: gastankPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData,
  });

  const feeIx = SystemProgram.transfer({
    fromPubkey: userPk,
    toPubkey: vaultPda,
    lamports: feeLamports,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction();
  tx.feePayer = userPk; // client pays network gas
  tx.recentBlockhash = blockhash;
  tx.add(feeIx, mintIx);

  // authority signs ONLY its part; the client must complete the remaining signature
  tx.partialSign(authorityKp);

  const txBase64 = tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString('base64');

  return { txBase64, message, feeLamports, blockhash, lastValidBlockHeight };
});

/**
 * 5. Accept the fully co-signed tx: dedup via sol_tx_log, broadcast,
 * verify the on-chain MintedTool event through eventsOf(), mirror the
 * tool into Firestore, return { signature }.
 */
exports.submitSignedMint = onCall(async (request) => {
  const signedTxBase64 = String(request.data?.signedTxBase64 || '').trim();
  if (!signedTxBase64) {
    throw new HttpsError('invalid-argument', 'signedTxBase64 is required');
  }

  await assertNotPaused();

  const raw = Buffer.from(signedTxBase64, 'base64');

  // identify the submitting wallet (first required signer == fee payer)
  let signer = null;
  try {
    const vtx = VersionedTransaction.deserialize(raw);
    signer = vtx.message.staticAccountKeys[0].toBase58();
  } catch (_) {
    try {
      const ltx = Transaction.from(raw);
      signer = ltx.signatures[0]?.publicKey?.toBase58() || null;
    } catch (_e) {
      throw new HttpsError('invalid-argument', 'Cannot deserialize transaction');
    }
  }
  if (!signer) {
    throw new HttpsError('invalid-argument', 'No signer found in transaction');
  }
  const uid = `sol:${signer}`;

  // --- idempotency: one processing attempt per unique tx payload ---
  const txHash = computeTxHash(signedTxBase64);
  await recordTx(txHash, uid, 'mint_nft');

  // --- broadcast + confirm ---
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  let sig;
  try {
    sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      'confirmed',
    );
  } catch (e) {
    // release the dedup slot so the client can retry with a fresh tx
    await db.collection('sol_tx_log').doc(txHash).delete().catch(() => {});
    throw new HttpsError('internal', `Broadcast failed: ${e.message}`);
  }

  // --- on-chain verification via Anchor events ---
  const evts = await eventsOf(sig);
  const minted = evts.find((e) => e.name === 'MintedTool');
  if (!minted) {
    throw new HttpsError('internal', 'MintedTool event not found — mint not verified');
  }

  const mint = minted.data.mint;

  // --- mirror into Firestore ---
  await db.collection('tools').doc(mint).set(
    {
      mint,
      ownerUid: uid,
      ownerWallet: signer,
      toolType: minted.data.toolType,
      rarity: RARITY_ORDER[minted.data.rarity] ?? minted.data.rarity,
      chain: 'solana',
      signature: sig,
      txHash,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await db.collection('players').doc(uid).set(
    {
      uid,
      wallet: signer,
      chain: 'solana',
      toolCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { signature: sig, mint, toolType: minted.data.toolType };
});
// ============================================
// Endpoints: NFT tool reroll (server co-sign flow)
// ============================================
const SOL_REROLL_SALT = process.env.SOL_REROLL_SALT || 'aof-reroll-salt-v1';
const FEE_PER_REROLL_MICROS = solCore.FEE_PER_CRAFT_MICROS;

/** seed = sha256(blockhash || requestId || SALT) — deterministic on-chain randomness input. */
function rerollSeed(blockhashB58, requestId) {
  return crypto.createHash('sha256').update(
    Buffer.concat([bs58.decode(blockhashB58), Buffer.from(requestId, 'utf8'), Buffer.from(SOL_REROLL_SALT, 'utf8')]),
  ).digest();
}

/** 6a. Build PARTIALLY-signed reroll tx: verifySolMessage -> paused -> seed(blockhash+requestId+SALT) -> authority partial-sign. */
exports.rerollNFTTool = onCall(async (request) => {
  const mintARaw = String(request.data?.mintA || '').trim();
  const mintBRaw = String(request.data?.mintB || '').trim();
  const requestId = String(request.data?.requestId || '').trim();
  const pubkeyRaw = String(request.data?.userPubkey || '').trim();
  const signature = String(request.data?.userSignature || '').trim();
  if (!mintARaw || !mintBRaw || !requestId || !pubkeyRaw || !signature) {
    throw new HttpsError('invalid-argument', 'mintA, mintB, requestId, userPubkey and userSignature are required');
  }
  if (requestId.length > 64) {
    throw new HttpsError('invalid-argument', 'requestId too long');
  }
  let mintAPk, mintBPk, userPk;
  try {
    mintAPk = new PublicKey(mintARaw);
    mintBPk = new PublicKey(mintBRaw);
    userPk = new PublicKey(pubkeyRaw);
  } catch (_) {
    throw new HttpsError('invalid-argument', 'Invalid Solana pubkey');
  }
  if (mintAPk.equals(mintBPk)) {
    throw new HttpsError('invalid-argument', 'mintA and mintB must differ');
  }
  if (!PROGRAM_ID_PK) {
    throw new HttpsError('failed-precondition', 'AOF_PROGRAM_ID is not configured');
  }
  const user = userPk.toBase58();

  // --- ed25519 verification over the canonical reroll request ---
  const message =
    `Age of Farming — reroll NFT tool
` +
    `mintA: ${mintAPk.toBase58()}
` +
    `mintB: ${mintBPk.toBase58()}
` +
    `requestId: ${requestId}
` +
    `user: ${user}
` +
    `feeMicros: ${FEE_PER_REROLL_MICROS}
` +
    `chain: devnet`;
  if (!verifySolMessage(message, signature, user)) {
    throw new HttpsError('permission-denied', 'Signature verification failed');
  }

  await assertNotPaused();

  // --- integer-only fee conversion (no float math) ---
  const feeLamports = Number(solCore.microsToLamports(FEE_PER_REROLL_MICROS));

  // --- PDAs ---
  const [authPda] = solCore.deriveAuth();
  const [configPda] = solCore.deriveConfig();
  const [vaultPda] = solCore.deriveVault();
  const [playerPda] = solCore.derivePlayer(user);
  const [gastankPda] = solCore.deriveGasTank(user);
  const [toolAPda] = solCore.deriveTool(mintAPk.toBase58());
  const [toolBPda] = solCore.deriveTool(mintBPk.toBase58());

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const seed = rerollSeed(blockhash, requestId);

  // --- ix data: disc("global:reroll_tool") + borsh(mintA, mintB, requestId: String, seed: [u8;32]) ---
  const ixData = Buffer.concat([
    globalDisc('reroll_tool'),
    mintAPk.toBuffer(),
    mintBPk.toBuffer(),
    borshString(requestId),
    seed,
  ]);

  const authorityKp = getAuthorityKeypair();
  const rerollIx = new TransactionInstruction({
    programId: PROGRAM_ID_PK,
    keys: [
      { pubkey: authPda, isSigner: false, isWritable: true },
      { pubkey: authorityKp.publicKey, isSigner: true, isWritable: false }, // server co-sign
      { pubkey: userPk, isSigner: true, isWritable: true },                 // client co-sign
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: gastankPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: toolAPda, isSigner: false, isWritable: true },
      { pubkey: toolBPda, isSigner: false, isWritable: true },
      { pubkey: mintAPk, isSigner: false, isWritable: false },
      { pubkey: mintBPk, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData,
  });

  const feeIx = SystemProgram.transfer({ fromPubkey: userPk, toPubkey: vaultPda, lamports: feeLamports });

  const tx = new Transaction();
  tx.feePayer = userPk; // client pays network gas
  tx.recentBlockhash = blockhash;
  tx.add(feeIx, rerollIx);
  tx.partialSign(authorityKp); // client must complete the remaining signature

  const txBase64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
  return { txBase64, message, requestId, feeLamports, blockhash, lastValidBlockHeight };
});

/** 6b. Accept fully co-signed reroll tx: dedup sol_tx_log -> broadcast -> verify Rerolled event -> mirror Firestore. */
exports.submitSignedReroll = onCall(async (request) => {
  const signedTxBase64 = String(request.data?.signedTxBase64 || '').trim();
  if (!signedTxBase64) {
    throw new HttpsError('invalid-argument', 'signedTxBase64 is required');
  }

  await assertNotPaused();

  const raw = Buffer.from(signedTxBase64, 'base64');
  // identify submitting wallet (first required signer == fee payer)
  let signer = null;
  try {
    const vtx = VersionedTransaction.deserialize(raw);
    signer = vtx.message.staticAccountKeys[0].toBase58();
  } catch (_) {
    try {
      const ltx = Transaction.from(raw);
      signer = ltx.signatures[0]?.publicKey?.toBase58() || null;
    } catch (_e) {
      throw new HttpsError('invalid-argument', 'Cannot deserialize transaction');
    }
  }
  if (!signer) {
    throw new HttpsError('invalid-argument', 'No signer found in transaction');
  }
  const uid = `sol:${signer}`;

  // --- idempotency: one processing attempt per unique tx payload ---
  const txHash = computeTxHash(signedTxBase64);
  await recordTx(txHash, uid, 'reroll_nft');

  // --- broadcast + confirm ---
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  let sig;
  try {
    sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  } catch (e) {
    // release the dedup slot so the client can retry with a fresh tx
    await db.collection('sol_tx_log').doc(txHash).delete().catch(() => {});
    throw new HttpsError('internal', `Broadcast failed: ${e.message}`);
  }

  // --- on-chain verification via Anchor events ---
  const evts = await eventsOf(sig);
  const rerolled = evts.find((e) => e.name === 'Rerolled');
  if (!rerolled) {
    throw new HttpsError('internal', 'Rerolled event not found — reroll not verified');
  }
  if (rerolled.data.user !== signer) {
    throw new HttpsError('permission-denied', 'Rerolled event user mismatch');
  }

  const { mintA, mintB, newMint, newType } = rerolled.data;

  // --- mirror: create new tool, mark consumed ones, adjust player counter (2 -> 1) ---
  const batch = db.batch();
  batch.set(db.collection('tools').doc(newMint), {
    mint: newMint,
    ownerUid: uid,
    ownerWallet: signer,
    toolType: newType,
    chain: 'solana',
    sourceMints: [mintA, mintB],
    signature: sig,
    txHash,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  for (const old of [mintA, mintB]) {
    batch.set(db.collection('tools').doc(old), {
      status: 'rerolled',
      rerolledInto: newMint,
      burnedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  batch.set(db.collection('players').doc(uid), {
    uid,
    wallet: signer,
    chain: 'solana',
    toolCount: admin.firestore.FieldValue.increment(-1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();

  return { signature: sig, newMint, toolType: newType };
});
// ============================================
// Endpoint: NFT staking (client-signed tx submit)
// ============================================

/** 7. Accept fully-signed stake tx: paused -> dedup sol_tx_log -> broadcast -> verify Staked events via eventsOf -> mirror Firestore. */
exports.stakeNfts = onCall(async (request) => {
  const signedTxBase64 = String(request.data?.signedTxBase64 || '').trim();
  if (!signedTxBase64) {
    throw new HttpsError('invalid-argument', 'signedTxBase64 is required');
  }

  await assertNotPaused();

  const raw = Buffer.from(signedTxBase64, 'base64');
  // identify submitting wallet (first required signer == fee payer)
  let signer = null;
  try {
    const vtx = VersionedTransaction.deserialize(raw);
    signer = vtx.message.staticAccountKeys[0].toBase58();
  } catch (_) {
    try {
      const ltx = Transaction.from(raw);
      signer = ltx.signatures[0]?.publicKey?.toBase58() || null;
    } catch (_e) {
      throw new HttpsError('invalid-argument', 'Cannot deserialize transaction');
    }
  }
  if (!signer) {
    throw new HttpsError('invalid-argument', 'No signer found in transaction');
  }
  const uid = `sol:${signer}`;

  // --- idempotency: one processing attempt per unique tx payload ---
  const txHash = computeTxHash(signedTxBase64);
  await recordTx(txHash, uid, 'stake_nfts');

  // --- broadcast + confirm ---
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  let sig;
  try {
    sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  } catch (e) {
    // release the dedup slot so the client can retry with a fresh tx
    await db.collection('sol_tx_log').doc(txHash).delete().catch(() => {});
    throw new HttpsError('internal', `Broadcast failed: ${e.message}`);
  }

  // --- on-chain verification via Anchor events ---
  const evts = await eventsOf(sig);
  const stakedAll = evts.filter((e) => e.name === 'Staked');
  if (!stakedAll.length) {
    throw new HttpsError('internal', 'Staked event not found — stake not verified');
  }
  if (stakedAll.some((e) => e.data.user !== signer)) {
    throw new HttpsError('permission-denied', 'Staked event user mismatch');
  }

  // --- mirror into Firestore: mark tools staked, bump player counter ---
  const batch = db.batch();
  const mints = [...new Set(stakedAll.map((e) => e.data.mint))];
  for (const mint of mints) {
    const toolSnap = await db.collection('tools').doc(mint).get();
    if (!toolSnap.exists || toolSnap.data()?.ownerUid !== uid) {
      throw new HttpsError('permission-denied', `Tool ${mint} is not owned by ${uid}`);
    }
    batch.set(db.collection('tools').doc(mint), {
      status: 'staked',
      stakedAt: admin.firestore.FieldValue.serverTimestamp(),
      stakeSignature: sig,
      txHash,
    }, { merge: true });
  }
  batch.set(db.collection('players').doc(uid), {
    uid,
    wallet: signer,
    chain: 'solana',
    stakedCount: admin.firestore.FieldValue.increment(mints.length),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();

  return { signature: sig, mints };
});
// ============================================
// Endpoints: NFT unstaking (server co-sign flow)
// ============================================
const FEE_PER_UNSTAKE_MICROS = solCore.FEE_PER_NFT_MICROS;

/** 8a. Build PARTIALLY-signed unstake tx: verifySolMessage -> paused -> NO fee transfer (on-chain program debits gasTank itself) -> authority partial-sign. */
exports.requestUnstake = onCall(async (request) => {
  const mintRaw = String(request.data?.mint || '').trim();
  const pubkeyRaw = String(request.data?.userPubkey || '').trim();
  const signature = String(request.data?.userSignature || '').trim();
  if (!mintRaw || !pubkeyRaw || !signature) {
    throw new HttpsError('invalid-argument', 'mint, userPubkey and userSignature are required');
  }
  let mintPk, userPk;
  try {
    mintPk = new PublicKey(mintRaw);
    userPk = new PublicKey(pubkeyRaw);
  } catch (_) {
    throw new HttpsError('invalid-argument', 'Invalid Solana pubkey');
  }
  if (!PROGRAM_ID_PK) {
    throw new HttpsError('failed-precondition', 'AOF_PROGRAM_ID is not configured');
  }
  const user = userPk.toBase58();

  // --- ed25519 verification over the canonical unstake request ---
  const message =
    `Age of Farming — unstake NFT tool
` +
    `mint: ${mintPk.toBase58()}
` +
    `user: ${user}
` +
    `feeMicros: ${FEE_PER_UNSTAKE_MICROS}
` +
    `chain: devnet`;
  if (!verifySolMessage(message, signature, user)) {
    throw new HttpsError('permission-denied', 'Signature verification failed');
  }

  await assertNotPaused();

  // --- integer-only fee conversion (informational; fee is debited on-chain from gasTank, server does NOT touch it) ---
  const feeLamports = Number(solCore.microsToLamports(FEE_PER_UNSTAKE_MICROS));

  // --- PDAs ---
  const [authPda] = solCore.deriveAuth();
  const [configPda] = solCore.deriveConfig();
  const [vaultPda] = solCore.deriveVault();
  const [playerPda] = solCore.derivePlayer(user);
  const [gastankPda] = solCore.deriveGasTank(user);
  const [toolPda] = solCore.deriveTool(mintPk.toBase58());

  // --- ix data: disc("global:unstake_tool") + borsh(mint: Pubkey) ---
  const ixData = Buffer.concat([globalDisc('unstake_tool'), mintPk.toBuffer()]);

  const authorityKp = getAuthorityKeypair();
  const unstakeIx = new TransactionInstruction({
    programId: PROGRAM_ID_PK,
    keys: [
      { pubkey: authPda, isSigner: false, isWritable: true },
      { pubkey: authorityKp.publicKey, isSigner: true, isWritable: false }, // server co-sign
      { pubkey: userPk, isSigner: true, isWritable: true },                 // client co-sign
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: gastankPda, isSigner: false, isWritable: true },            // program debits fee itself
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: toolPda, isSigner: false, isWritable: true },
      { pubkey: mintPk, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction();
  tx.feePayer = userPk; // client pays network gas only
  tx.recentBlockhash = blockhash;
  tx.add(unstakeIx); // deliberately NO SystemProgram.transfer fee ix — fee already charged on-chain
  tx.partialSign(authorityKp); // client must complete the remaining signature

  const txBase64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
  return { txBase64, message, feeLamports, blockhash, lastValidBlockHeight };
});

/** 8b. Accept fully co-signed unstake tx: dedup sol_tx_log -> broadcast -> verify Unstaked events via eventsOf -> mirror Firestore (gasTank untouched). */
exports.verifyUnstake = onCall(async (request) => {
  const signedTxBase64 = String(request.data?.signedTxBase64 || '').trim();
  if (!signedTxBase64) {
    throw new HttpsError('invalid-argument', 'signedTxBase64 is required');
  }

  await assertNotPaused();

  const raw = Buffer.from(signedTxBase64, 'base64');
  // identify submitting wallet (first required signer == fee payer)
  let signer = null;
  try {
    const vtx = VersionedTransaction.deserialize(raw);
    signer = vtx.message.staticAccountKeys[0].toBase58();
  } catch (_) {
    try {
      const ltx = Transaction.from(raw);
      signer = ltx.signatures[0]?.publicKey?.toBase58() || null;
    } catch (_e) {
      throw new HttpsError('invalid-argument', 'Cannot deserialize transaction');
    }
  }
  if (!signer) {
    throw new HttpsError('invalid-argument', 'No signer found in transaction');
  }
  const uid = `sol:${signer}`;

  // --- idempotency: one processing attempt per unique tx payload ---
  const txHash = computeTxHash(signedTxBase64);
  await recordTx(txHash, uid, 'unstake_nft');

  // --- broadcast + confirm ---
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  let sig;
  try {
    sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  } catch (e) {
    // release the dedup slot so the client can retry with a fresh tx
    await db.collection('sol_tx_log').doc(txHash).delete().catch(() => {});
    throw new HttpsError('internal', `Broadcast failed: ${e.message}`);
  }

  // --- on-chain verification via Anchor events ---
  const evts = await eventsOf(sig);
  const unstakedAll = evts.filter((e) => e.name === 'Unstaked');
  if (!unstakedAll.length) {
    throw new HttpsError('internal', 'Unstaked event not found — unstake not verified');
  }
  if (unstakedAll.some((e) => e.data.user !== signer)) {
    throw new HttpsError('permission-denied', 'Unstaked event user mismatch');
  }

  // --- mirror into Firestore: tools back to idle, stakedCount down; gasTank NOT touched (fee settled on-chain) ---
  const batch = db.batch();
  const mints = [...new Set(unstakedAll.map((e) => e.data.mint))];
  for (const mint of mints) {
    const toolSnap = await db.collection('tools').doc(mint).get();
    if (!toolSnap.exists || toolSnap.data()?.ownerUid !== uid) {
      throw new HttpsError('permission-denied', `Tool ${mint} is not owned by ${uid}`);
    }
    batch.set(db.collection('tools').doc(mint), {
      status: 'idle',
      unstakedAt: admin.firestore.FieldValue.serverTimestamp(),
      unstakeSignature: sig,
      txHash,
    }, { merge: true });
  }
  batch.set(db.collection('players').doc(uid), {
    uid,
    wallet: signer,
    chain: 'solana',
    stakedCount: admin.firestore.FieldValue.increment(-mints.length),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();

  return { signature: sig, mints };
});
// ============================================
// Endpoints: collectors & packs staking/unstaking
// ============================================
const COLLECTOR_LOCK_SECONDS = 3 * 86400; // 3 дня
const PACK_LOCK_MIN_SEC = 60;
const PACK_LOCK_MAX_SEC = 30 * 86400;

/** Извлечь первого обязательного подписанта (fee payer) из сырых байт транзакции. */
function txSignerOf(raw) {
  try {
    const vtx = VersionedTransaction.deserialize(raw);
    return vtx.message.staticAccountKeys[0].toBase58();
  } catch (_) {
    try {
      const ltx = Transaction.from(raw);
      return ltx.signatures[0]?.publicKey?.toBase58() || null;
    } catch (_e) {
      throw new HttpsError('invalid-argument', 'Cannot deserialize transaction');
    }
  }
}

/** Общий submit полностью подписанной стейк-транзакции: paused -> дедуп sol_tx_log -> broadcast -> события Staked через eventsOf -> зеркало в Firestore. */
async function stakeNftLike(signedTxBase64, logType, collName, counterField, lockSeconds) {
  if (!signedTxBase64) throw new HttpsError('invalid-argument', 'signedTxBase64 is required');
  await assertNotPaused();
  const raw = Buffer.from(signedTxBase64, 'base64');
  const signer = txSignerOf(raw);
  if (!signer) throw new HttpsError('invalid-argument', 'No signer found in transaction');
  const uid = `sol:${signer}`;
  const txHash = computeTxHash(signedTxBase64);
  await recordTx(txHash, uid, logType);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  let sig;
  try {
    sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  } catch (e) {
    await db.collection('sol_tx_log').doc(txHash).delete().catch(() => {}); // освободить слот дедупа для ретрая
    throw new HttpsError('internal', `Broadcast failed: ${e.message}`);
  }
  const evts = await eventsOf(sig);
  const stakedAll = evts.filter((e) => e.name === 'Staked');
  if (!stakedAll.length) throw new HttpsError('internal', 'Staked event not found — stake not verified');
  if (stakedAll.some((e) => e.data.user !== signer)) throw new HttpsError('permission-denied', 'Staked event user mismatch');
  const batch = db.batch();
  const mints = [...new Set(stakedAll.map((e) => e.data.mint))];
  for (const mint of mints) {
    const snap = await db.collection(collName).doc(mint).get();
    if (!snap.exists || snap.data()?.ownerUid !== uid) throw new HttpsError('permission-denied', `${collName}/${mint} is not owned by ${uid}`);
    batch.set(db.collection(collName).doc(mint), {
      status: 'staked',
      stakedAt: admin.firestore.FieldValue.serverTimestamp(),
      stakeSignature: sig,
      txHash,
      ...(lockSeconds != null ? { lockSeconds } : {}),
    }, { merge: true });
  }
  batch.set(db.collection('players').doc(uid), {
    uid, wallet: signer, chain: 'solana',
    [counterField]: admin.firestore.FieldValue.increment(mints.length),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  return { signature: sig, mints };
}

/** Общий билдер ЧАСТИЧНО подписанной unstake-транзакции (co-sign): verifySolMessage -> paused -> БЕЗ fee-transfer (программа сама дебетует gasTank) -> authority partial-sign. */
async function buildUnstakeCoSign({ mintRaw, pubkeyRaw, signature, label, discName, lockSeconds }) {
  if (!mintRaw || !pubkeyRaw || !signature) throw new HttpsError('invalid-argument', 'mint, userPubkey and userSignature are required');
  let mintPk, userPk;
  try {
    mintPk = new PublicKey(mintRaw);
    userPk = new PublicKey(pubkeyRaw);
  } catch (_) { throw new HttpsError('invalid-argument', 'Invalid Solana pubkey'); }
  if (!PROGRAM_ID_PK) throw new HttpsError('failed-precondition', 'AOF_PROGRAM_ID is not configured');
  const user = userPk.toBase58();
  const message =
    `Age of Farming — ${label}
` +
    `mint: ${mintPk.toBase58()}
` +
    `user: ${user}
` +
    `lockSeconds: ${lockSeconds}
` +
    `feeMicros: ${FEE_PER_UNSTAKE_MICROS}
` +
    `chain: devnet`;
  if (!verifySolMessage(message, signature, user)) throw new HttpsError('permission-denied', 'Signature verification failed');
  await assertNotPaused();
  const feeLamports = Number(solCore.microsToLamports(FEE_PER_UNSTAKE_MICROS)); // информационно; списание on-chain
  const [authPda] = solCore.deriveAuth();
  const [configPda] = solCore.deriveConfig();
  const [vaultPda] = solCore.deriveVault();
  const [playerPda] = solCore.derivePlayer(user);
  const [gastankPda] = solCore.deriveGasTank(user);
  const [assetPda] = solCore.deriveTool(mintPk.toBase58());
  const lockBuf = Buffer.alloc(8);
  lockBuf.writeBigUInt64LE(BigInt(lockSeconds), 0);
  const ixData = Buffer.concat([globalDisc(discName), mintPk.toBuffer(), lockBuf]);
  const authorityKp = getAuthorityKeypair();
  const unstakeIx = new TransactionInstruction({
    programId: PROGRAM_ID_PK,
    keys: [
      { pubkey: authPda, isSigner: false, isWritable: true },
      { pubkey: authorityKp.publicKey, isSigner: true, isWritable: false }, // серверный co-sign
      { pubkey: userPk, isSigner: true, isWritable: true },                 // клиентский co-sign
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: gastankPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: assetPda, isSigner: false, isWritable: true },
      { pubkey: mintPk, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData,
  });
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction();
  tx.feePayer = userPk;
  tx.recentBlockhash = blockhash;
  tx.add(unstakeIx); // намеренно без SystemProgram.transfer — fee уже списывается on-chain из gasTank
  tx.partialSign(authorityKp);
  const txBase64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
  return { txBase64, message, feeLamports, lockSeconds, blockhash, lastValidBlockHeight };
}

/** 9a. Стейк коллекционеров (клиентская tx): дедуп -> broadcast -> Staked events -> зеркало. */
exports.stakeCollectors = onCall((request) =>
  stakeNftLike(String(request.data?.signedTxBase64 || '').trim(), 'stake_collectors', 'collectors', 'stakedCollectors', COLLECTOR_LOCK_SECONDS));

/** 9b. Анстейк коллекционера (co-sign): фиксированный lockSeconds=3*86400 в подписанном сообщении и ix data. */
exports.requestUnstakeCollector = onCall((request) =>
  buildUnstakeCoSign({
    mintRaw: String(request.data?.mint || '').trim(),
    pubkeyRaw: String(request.data?.userPubkey || '').trim(),
    signature: String(request.data?.userSignature || '').trim(),
    label: 'unstake collector',
    discName: 'unstake_collector',
    lockSeconds: COLLECTOR_LOCK_SECONDS,
  }));

/** 10a. Стейк паков (клиентская tx): дедуп -> broadcast -> Staked events -> зеркало. */
exports.stakePacks = onCall((request) =>
  stakeNftLike(String(request.data?.signedTxBase64 || '').trim(), 'stake_packs', 'packs', 'stakedPacks', null));

/** 10b. Анстейк пака (co-sign): lockSeconds из body, валидация 60..30 дней. */
exports.requestUnstakePacks = onCall((request) => {
  const lockSeconds = Number(request.data?.lockSeconds);
  if (!Number.isInteger(lockSeconds) || lockSeconds < PACK_LOCK_MIN_SEC || lockSeconds > PACK_LOCK_MAX_SEC) {
    throw new HttpsError('invalid-argument', `lockSeconds must be an integer between ${PACK_LOCK_MIN_SEC} and ${PACK_LOCK_MAX_SEC}`);
  }
  return buildUnstakeCoSign({
    mintRaw: String(request.data?.mint || '').trim(),
    pubkeyRaw: String(request.data?.userPubkey || '').trim(),
    signature: String(request.data?.userSignature || '').trim(),
    label: 'unstake pack',
    discName: 'unstake_pack',
    lockSeconds,
  });
});
// ============================================
// Endpoints: pack opening (burn pack -> issue tools)
// ============================================
const PACK_TOOLS_N = Math.max(1, Number(process.env.SOL_PACK_TOOLS || 3));

/** Каноническое строковое представление лута (для подписи и сверки между шагами). */
function lootToString(loot) {
  return loot.map((l) => `${l.toolType}:${l.rarity}`).join('|');
}

/** Валидация лута, возвращённого клиентом на втором шаге. */
function parseLoot(raw) {
  if (!Array.isArray(raw) || raw.length !== PACK_TOOLS_N) {
    throw new HttpsError('invalid-argument', `loot must be an array of ${PACK_TOOLS_N} entries`);
  }
  return raw.map((entry) => {
    const toolType = String(entry?.toolType || '').trim();
    const rarity = String(entry?.rarity || '').trim();
    if (!TOOL_TYPES.includes(toolType)) {
      throw new HttpsError('invalid-argument', `Unknown tool type: ${toolType}`);
    }
    if (!RARITY_ORDER.includes(rarity)) {
      throw new HttpsError('invalid-argument', `Unknown rarity: ${rarity}`);
    }
    return { toolType, rarity };
  });
}

/** Каноническое сообщение open-pack — одинаково для шага 1 и повторной верификации на шаге 2. */
function buildOpenPackMessage({ packMint, user, requestId, loot }) {
  return (
    `Age of Farming — open pack
` +
    `pack: ${packMint}
` +
    `user: ${user}
` +
    `requestId: ${requestId}
` +
    `loot: ${lootToString(loot)}
` +
    `feeMicros: ${solCore.FEE_PER_PACK_MICROS}
` +
    `chain: devnet`
  );
}

/** Полностью серверная отправка tx: feePayer = authority, БЕЗ fee-transfer (fee дебетуется on-chain из gasTank). */
async function sendAuthorityTx(instructions) {
  const authorityKp = getAuthorityKeypair();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction();
  tx.feePayer = authorityKp.publicKey;
  tx.recentBlockhash = blockhash;
  for (const ix of instructions) tx.add(ix);
  tx.sign(authorityKp);
  const raw = tx.serialize({ requireAllSignatures: true, verifySignatures: true });
  const sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  return { signature: sig, blockhash, lastValidBlockHeight };
}

/** mint_tool ix для автовыдачи (authority-only: подпись пользователя не требуется, fee из gasTank on-chain). */
function buildAutoMintToolIx({ userPk, toolType, rarityIdx }) {
  const [authPda] = solCore.deriveAuth();
  const [configPda] = solCore.deriveConfig();
  const [vaultPda] = solCore.deriveVault();
  const [playerPda] = solCore.derivePlayer(userPk.toBase58());
  const [gastankPda] = solCore.deriveGasTank(userPk.toBase58());
  const ixData = Buffer.concat([globalDisc('mint_tool'), borshString(toolType), Buffer.from([rarityIdx])]);
  return new TransactionInstruction({
    programId: PROGRAM_ID_PK,
    keys: [
      { pubkey: authPda, isSigner: false, isWritable: true },
      { pubkey: getAuthorityKeypair().publicKey, isSigner: true, isWritable: false }, // серверный подписант
      { pubkey: userPk, isSigner: false, isWritable: true },                          // автовыдача от имени игрока
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: gastankPda, isSigner: false, isWritable: true },                      // программа дебетует gasTank сама
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData,
  });
}

/** 11a. openPack: rollLoot -> co-sign burn_pack tx -> { loot, txBase64 }. Лут фиксируется в подписываемом сообщении. */
exports.openPack = onCall(async (request) => {
  const packMintRaw = String(request.data?.packMint || '').trim();
  const requestId = String(request.data?.requestId || '').trim();
  const pubkeyRaw = String(request.data?.userPubkey || '').trim();
  const signature = String(request.data?.userSignature || '').trim();
  if (!packMintRaw || !requestId || !pubkeyRaw || !signature) {
    throw new HttpsError('invalid-argument', 'packMint, requestId, userPubkey and userSignature are required');
  }
  if (requestId.length > 64) {
    throw new HttpsError('invalid-argument', 'requestId too long');
  }
  let packMintPk, userPk;
  try {
    packMintPk = new PublicKey(packMintRaw);
    userPk = new PublicKey(pubkeyRaw);
  } catch (_) {
    throw new HttpsError('invalid-argument', 'Invalid Solana pubkey');
  }
  if (!PROGRAM_ID_PK) {
    throw new HttpsError('failed-precondition', 'AOF_PROGRAM_ID is not configured');
  }
  const user = userPk.toBase58();

  // --- roll loot ДО построения tx; попадает в подписанное сообщение => клиент не может его подменить ---
  const loot = Array.from({ length: PACK_TOOLS_N }, () => rollLoot());
  const message = buildOpenPackMessage({ packMint: packMintPk.toBase58(), user, requestId, loot });

  // --- ed25519 verification over the canonical open-pack request (включая лут) ---
  if (!verifySolMessage(message, signature, user)) {
    throw new HttpsError('permission-denied', 'Signature verification failed');
  }

  await assertNotPaused();

  // --- integer-only fee conversion (no float math) ---
  const feeLamports = Number(solCore.microsToLamports(solCore.FEE_PER_PACK_MICROS));

  // --- PDAs ---
  const [authPda] = solCore.deriveAuth();
  const [configPda] = solCore.deriveConfig();
  const [vaultPda] = solCore.deriveVault();
  const [playerPda] = solCore.derivePlayer(user);
  const [gastankPda] = solCore.deriveGasTank(user);
  const [packPda] = solCore.deriveTool(packMintPk.toBase58());

  // --- ix data: disc("global:burn_pack") + borsh(packMint: Pubkey, requestId: String) ---
  const ixData = Buffer.concat([
    globalDisc('burn_pack'),
    packMintPk.toBuffer(),
    borshString(requestId),
  ]);

  const authorityKp = getAuthorityKeypair();
  const burnIx = new TransactionInstruction({
    programId: PROGRAM_ID_PK,
    keys: [
      { pubkey: authPda, isSigner: false, isWritable: true },
      { pubkey: authorityKp.publicKey, isSigner: true, isWritable: false }, // серверный co-sign
      { pubkey: userPk, isSigner: true, isWritable: true },                 // клиентский co-sign
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: gastankPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: packPda, isSigner: false, isWritable: true },
      { pubkey: packMintPk, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData,
  });

  const feeIx = SystemProgram.transfer({ fromPubkey: userPk, toPubkey: vaultPda, lamports: feeLamports });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction();
  tx.feePayer = userPk; // клиент платит сетевой газ
  tx.recentBlockhash = blockhash;
  tx.add(feeIx, burnIx);
  tx.partialSign(authorityKp); // клиент должен досигнать оставшуюся подпись

  const txBase64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
  return { txBase64, message, loot, requestId, feeLamports, blockhash, lastValidBlockHeight };
});

/** 11b. submitSignedBurnPack: дедуп -> отправка -> верификация BurnedNft -> автовыдача N инструментов через mint_tool -> зеркало Firestore. */
exports.submitSignedBurnPack = onCall(async (request) => {
  const signedTxBase64 = String(request.data?.signedTxBase64 || '').trim();
  const packMintRaw = String(request.data?.packMint || '').trim();
  const requestId = String(request.data?.requestId || '').trim();
  const pubkeyRaw = String(request.data?.userPubkey || '').trim();
  const signature = String(request.data?.userSignature || '').trim();
  const loot = parseLoot(request.data?.loot);
  if (!signedTxBase64 || !packMintRaw || !requestId || !pubkeyRaw || !signature) {
    throw new HttpsError('invalid-argument', 'signedTxBase64, packMint, requestId, userPubkey and userSignature are required');
  }

  await assertNotPaused();

  let packMintPk, userPk;
  try {
    packMintPk = new PublicKey(packMintRaw);
    userPk = new PublicKey(pubkeyRaw);
  } catch (_) {
    throw new HttpsError('invalid-argument', 'Invalid Solana pubkey');
  }
  const user = userPk.toBase58();

  // --- повторная ed25519-верификация: лут привязан к подписи и не может быть подменён между шагами ---
  const message = buildOpenPackMessage({ packMint: packMintPk.toBase58(), user, requestId, loot });
  if (!verifySolMessage(message, signature, user)) {
    throw new HttpsError('permission-denied', 'Signature verification failed');
  }

  const raw = Buffer.from(signedTxBase64, 'base64');
  const signer = txSignerOf(raw);
  if (!signer) {
    throw new HttpsError('invalid-argument', 'No signer found in transaction');
  }
  if (signer !== user) {
    throw new HttpsError('permission-denied', 'Transaction signer does not match authenticated wallet');
  }
  const uid = `sol:${signer}`;

  // --- idempotency: одна попытка обработки на уникальный payload tx ---
  const txHash = computeTxHash(signedTxBase64);
  await recordTx(txHash, uid, 'burn_pack');

  // --- broadcast + confirm ---
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  let sig;
  try {
    sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  } catch (e) {
    await db.collection('sol_tx_log').doc(txHash).delete().catch(() => {}); // освободить слот дедупа для ретрая
    throw new HttpsError('internal', `Broadcast failed: ${e.message}`);
  }

  // --- on-chain verification via Anchor events ---
  const evts = await eventsOf(sig);
  const burned = evts.find((e) => e.name === 'BurnedNft');
  if (!burned) {
    throw new HttpsError('internal', 'BurnedNft event not found — pack burn not verified');
  }
  if (burned.data.user !== signer) {
    throw new HttpsError('permission-denied', 'BurnedNft event user mismatch');
  }
  if (burned.data.mint !== packMintPk.toBase58()) {
    throw new HttpsError('permission-denied', 'BurnedNft event mint mismatch');
  }

  // --- мягкая проверка владения паком в Firestore (on-chain — источник истины) ---
  const packSnap = await db.collection('packs').doc(packMintPk.toBase58()).get();
  if (packSnap.exists && packSnap.data()?.ownerUid !== uid) {
    throw new HttpsError('permission-denied', `Pack ${packMintPk.toBase58()} is not owned by ${uid}`);
  }

  // --- зеркало: пак помечен сожжённым ---
  await db.collection('packs').doc(packMintPk.toBase58()).set(
    {
      status: 'burned',
      burnedAt: admin.firestore.FieldValue.serverTimestamp(),
      burnSignature: sig,
      txHash,
    },
    { merge: true },
  );

  // --- автовыдача N инструментов через mint_tool (authority-only, fee из gasTank on-chain) ---
  const mints = [];
  const errors = [];
  for (const entry of loot) {
    const rarityIdx = RARITY_ORDER.indexOf(entry.rarity);
    try {
      const mintIx = buildAutoMintToolIx({ userPk, toolType: entry.toolType, rarityIdx });
      const { signature: mintSig } = await sendAuthorityTx([mintIx]);
      const mintEvts = await eventsOf(mintSig);
      const minted = mintEvts.find((e) => e.name === 'MintedTool');
      if (!minted) {
        throw new Error('MintedTool event not found');
      }
      if (minted.data.user !== signer) {
        throw new Error('MintedTool event user mismatch');
      }
      const mint = minted.data.mint;
      const rarityOut = RARITY_ORDER[minted.data.rarity] ?? entry.rarity;
      mints.push({ mint, toolType: minted.data.toolType, rarity: rarityOut, signature: mintSig });
      await db.collection('tools').doc(mint).set(
        {
          mint,
          ownerUid: uid,
          ownerWallet: signer,
          toolType: minted.data.toolType,
          rarity: rarityOut,
          chain: 'solana',
          sourcePack: packMintPk.toBase58(),
          signature: mintSig,
          packTxHash: txHash,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (e) {
      errors.push(`${entry.toolType}/${entry.rarity}: ${e.message}`);
    }
  }

  if (mints.length > 0) {
    await db.collection('players').doc(uid).set(
      {
        uid,
        wallet: signer,
        chain: 'solana',
        toolCount: admin.firestore.FieldValue.increment(mints.length),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  if (!mints.length) {
    throw new HttpsError('internal', `Tool issuance failed: ${errors.join('; ')}`);
  }

  return { signature: sig, packMint: packMintPk.toBase58(), mints, errors };
});
// ============================================
// Endpoints: resource deposits & withdrawals (SPL)
// ============================================
const { getAssociatedTokenAddressSync } = require('@solana/spl-token');

const RESOURCE_KEYS = ['food', 'wood', 'stone'];
const FEE_PER_WITHDRAW_MICROS = solCore.FEE_PER_NFT_MICROS; // fee дебетуется on-chain из gasTank
const MAX_AMOUNT_MICROS = 1_000_000_000_000_000; // sanity cap (< 2^53, помещается в u64)

/** PublicKey минта ресурса из env или null, если не сконфигурирован. */
function resourceMintPk(resource) {
  const envKey = { food: 'SOL_FOOD_MINT', wood: 'SOL_WOOD_MINT', stone: 'SOL_STONE_MINT' }[resource];
  const raw = envKey ? process.env[envKey] : '';
  if (!raw) return null;
  try { return new PublicKey(raw.trim()); } catch (_) { return null; }
}

/** ATA владельца под конкретный минт (allowOwnerOffCurve — vault является PDA). */
function ataOf(ownerPk, mintPk) {
  return getAssociatedTokenAddressSync(mintPk, ownerPk, true);
}

/**
 * Строгая дельта баланса vault-ATA по минту из мета транзакции.
 * (solCore.vaultSplDelta фильтрует owner === 'vault' литерально и никогда
 * не совпадёт с реальным pubkey владельца — поэтому локальная версия
 * сверяется с реальным vault-PDA.)
 */
function vaultSplDeltaFromTx(txMeta, mintBase58) {
  if (!txMeta?.preTokenBalances || !txMeta?.postTokenBalances) return 0;
  const vaultOwner = solCore.deriveVault()[0].toBase58();
  const sum = (list) => (list || [])
    .filter((b) => b.mint === mintBase58 && b.owner === vaultOwner)
    .reduce((acc, b) => acc + BigInt(b.uiTokenAmount?.amount ?? '0'), 0n);
  const delta = sum(txMeta.postTokenBalances) - sum(txMeta.preTokenBalances);
  return delta > 0n ? Number(delta) : 0;
}

/** Валидация целочисленной суммы в микросах. */
function assertValidAmount(amountMicros) {
  if (!Number.isInteger(amountMicros) || amountMicros <= 0 || amountMicros > MAX_AMOUNT_MICROS) {
    throw new HttpsError('invalid-argument', `amountMicros must be a positive integer <= ${MAX_AMOUNT_MICROS}`);
  }
}

/** 12. Депозит: клиент сам отправляет SPL-transfer в vault-ATA, сервер верифицирует vaultSplDelta >= requested и зачисляет баланс. */
exports.requestDeposit = onCall(async (request) => {
  const signature = String(request.data?.signature || '').trim();
  const resource = String(request.data?.resource || '').trim();
  const amountMicros = Number(request.data?.amountMicros);
  const pubkeyRaw = String(request.data?.userPubkey || '').trim();
  if (!signature || !pubkeyRaw) {
    throw new HttpsError('invalid-argument', 'signature and userPubkey are required');
  }
  if (!RESOURCE_KEYS.includes(resource)) {
    throw new HttpsError('invalid-argument', `Unknown resource: ${resource}`);
  }
  assertValidAmount(amountMicros);

  let userPk;
  try { userPk = new PublicKey(pubkeyRaw); } catch (_) {
    throw new HttpsError('invalid-argument', 'Invalid Solana pubkey');
  }
  const user = userPk.toBase58();

  const mintPk = resourceMintPk(resource);
  if (!mintPk) {
    throw new HttpsError('failed-precondition', `SOL_${resource.toUpperCase()}_MINT is not configured`);
  }

  await assertNotPaused();

  // --- транзакция должна быть подтверждена и успешна ---
  const tx = await connection
    .getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' })
    .catch(() => null);
  if (!tx) {
    throw new HttpsError('not-found', 'Deposit transaction not found or not confirmed yet');
  }
  if (tx.meta?.err) {
    throw new HttpsError('failed-precondition', 'Deposit transaction failed on-chain');
  }

  // --- подписант транзакции обязан совпадать с заявленным кошельком ---
  const txSigner = tx.transaction?.message?.accountKeys?.[0]?.pubkey;
  if (txSigner !== user) {
    throw new HttpsError('permission-denied', 'Deposit transaction signer mismatch');
  }

  // --- верификация дельты vault: зачисляем фактически пришедшую сумму (>= requested) ---
  const delta = vaultSplDeltaFromTx(tx.meta, mintPk.toBase58());
  if (delta < amountMicros) {
    throw new HttpsError('failed-precondition', `Vault delta ${delta} < requested ${amountMicros}`);
  }

  const uid = `sol:${user}`;
  const txHash = crypto.createHash('sha256').update(signature).digest('hex');
  await recordTx(txHash, uid, 'deposit'); // один депозит-клейм на транзакцию

  await db.collection('players').doc(uid).set(
    {
      uid,
      wallet: user,
      chain: 'solana',
      [`balances.${resource}.micros`]: admin.firestore.FieldValue.increment(delta),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await db.collection('deposits').doc(txHash).set({
    txHash,
    signature,
    uid,
    wallet: user,
    resource,
    mint: mintPk.toBase58(),
    requestedMicros: amountMicros,
    creditedMicros: delta,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, signature, resource, creditedMicros: delta };
});

/** Извлечь из legacy-tx наш withdraw-ix и распарсить (mint, amountMicros). */
function extractWithdrawIx(raw) {
  let ltx;
  try { ltx = Transaction.from(raw); } catch (_) { return null; }
  const disc = globalDisc('withdraw');
  for (const ix of ltx.instructions) {
    if (!ix.programId.equals(PROGRAM_ID_PK)) continue;
    const d = Buffer.from(ix.data);
    if (d.length < 8 + 32 + 8) continue;
    if (!d.subarray(0, 8).equals(disc)) continue;
    try {
      return { mint: new PublicKey(d.subarray(8, 40)).toBase58(), amount: Number(d.readBigUInt64LE(40)) };
    } catch (_) { return null; }
  }
  return null;
}

/** Каноническое сообщение withdraw — одинаково для шага 1 и повторной верификации на шаге 2. */
function buildWithdrawMessage({ resource, mint, user, amountMicros }) {
  return (
    `Age of Farming — withdraw ${resource}
` +
    `mint: ${mint}
` +
    `user: ${user}
` +
    `amountMicros: ${amountMicros}
` +
    `feeMicros: ${FEE_PER_WITHDRAW_MICROS}
` +
    `chain: devnet`
  );
}

/** 13a. buildWithdrawTx (co-sign): verifySolMessage -> paused -> проверка баланса и ATA -> БЕЗ fee-transfer (fee дебетуется on-chain из gasTank) -> authority partial-sign. */
exports.requestWithdraw = onCall(async (request) => {
  const resource = String(request.data?.resource || '').trim();
  const amountMicros = Number(request.data?.amountMicros);
  const pubkeyRaw = String(request.data?.userPubkey || '').trim();
  const signature = String(request.data?.userSignature || '').trim();
  if (!resource || !pubkeyRaw || !signature) {
    throw new HttpsError('invalid-argument', 'resource, userPubkey and userSignature are required');
  }
  if (!RESOURCE_KEYS.includes(resource)) {
    throw new HttpsError('invalid-argument', `Unknown resource: ${resource}`);
  }
  assertValidAmount(amountMicros);
  if (!PROGRAM_ID_PK) {
    throw new HttpsError('failed-precondition', 'AOF_PROGRAM_ID is not configured');
  }

  let userPk;
  try { userPk = new PublicKey(pubkeyRaw); } catch (_) {
    throw new HttpsError('invalid-argument', 'Invalid Solana pubkey');
  }
  const user = userPk.toBase58();

  const mintPk = resourceMintPk(resource);
  if (!mintPk) {
    throw new HttpsError('failed-precondition', `SOL_${resource.toUpperCase()}_MINT is not configured`);
  }

  // --- ed25519-верификация канонического запроса на вывод ---
  const message = buildWithdrawMessage({ resource, mint: mintPk.toBase58(), user, amountMicros });
  if (!verifySolMessage(message, signature, user)) {
    throw new HttpsError('permission-denied', 'Signature verification failed');
  }

  await assertNotPaused();

  // --- игровой баланс должен покрывать вывод (fee списывается отдельно on-chain из gasTank) ---
  const uid = `sol:${user}`;
  const playerSnap = await db.collection('players').doc(uid).get();
  const bal = Number(playerSnap.data()?.balances?.[resource]?.micros ?? 0);
  if (bal < amountMicros) {
    throw new HttpsError('failed-precondition', `Insufficient ${resource} balance: ${bal} < ${amountMicros}`);
  }

  // --- ATA получателя обязан существовать (программа не создаёт его сама) ---
  const userAta = ataOf(userPk, mintPk);
  const ataInfo = await connection.getAccountInfo(userAta, 'confirmed').catch(() => null);
  if (!ataInfo) {
    throw new HttpsError('failed-precondition', 'Destination ATA does not exist — create it client-side first');
  }

  // --- integer-only fee conversion (информационно; списание on-chain) ---
  const feeLamports = Number(solCore.microsToLamports(FEE_PER_WITHDRAW_MICROS));

  // --- PDAs ---
  const [authPda] = solCore.deriveAuth();
  const [configPda] = solCore.deriveConfig();
  const [vaultPda] = solCore.deriveVault();
  const [playerPda] = solCore.derivePlayer(user);
  const [gastankPda] = solCore.deriveGasTank(user);
  const vaultAta = ataOf(vaultPda, mintPk);

  // --- ix data: disc("global:withdraw") + borsh(mint: Pubkey, amountMicros: u64) ---
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(BigInt(amountMicros), 0);
  const ixData = Buffer.concat([globalDisc('withdraw'), mintPk.toBuffer(), amountBuf]);

  const authorityKp = getAuthorityKeypair();
  const withdrawIx = new TransactionInstruction({
    programId: PROGRAM_ID_PK,
    keys: [
      { pubkey: authPda, isSigner: false, isWritable: true },
      { pubkey: authorityKp.publicKey, isSigner: true, isWritable: false }, // серверный co-sign
      { pubkey: userPk, isSigner: true, isWritable: true },                 // клиентский co-sign
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: gastankPda, isSigner: false, isWritable: true },            // программа дебетует fee сама
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },              // источник SPL
      { pubkey: userAta, isSigner: false, isWritable: true },               // получатель
      { pubkey: mintPk, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID_PK, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction();
  tx.feePayer = userPk; // клиент платит только сетевой газ
  tx.recentBlockhash = blockhash;
  tx.add(withdrawIx); // намеренно без SystemProgram.transfer — fee уже списывается on-chain из gasTank
  tx.partialSign(authorityKp); // клиент должен досигнать оставшуюся подпись

  const txBase64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
  return { txBase64, message, feeLamports, blockhash, lastValidBlockHeight };
});

/** 13b. submitSignedWithdraw (v2, debit-first): повторная верификация сообщения + ix-параметров -> АТОМАРНЫЙ дебет (balance -= amount + fee) и бронирование слота sol_tx_log/{txHash} (set, merge:false) ДО broadcast -> sendAuthorityTx -> подтверждение getParsedTransaction('finalized') в retry-цикле (5 попыток, 2/4/8/16/32 сек) -> post-verify: сверка оттока из vault (локальный vaultSplDeltaFromTx с учётом meta.loadedAddresses) -> успех: ничего (дебет сделан до broadcast) -> провал после ретраев: компенсация balance += amount + fee + пометка sol_tx_log compensated, БЕЗ throw. Устраняет гонку двойного вывода: on-chain перевод невозможен без предварительного атомарного списания. */
exports.submitSignedWithdraw = onCall(async (request) => {
  const signedTxBase64 = String(request.data?.signedTxBase64 || '').trim();
  const resource = String(request.data?.resource || '').trim();
  const amountMicros = Number(request.data?.amountMicros);
  const pubkeyRaw = String(request.data?.userPubkey || '').trim();
  const signature = String(request.data?.userSignature || '').trim();
  if (!signedTxBase64 || !resource || !pubkeyRaw || !signature) {
    throw new HttpsError('invalid-argument', 'signedTxBase64, resource, userPubkey and userSignature are required');
  }
  if (!RESOURCE_KEYS.includes(resource)) {
    throw new HttpsError('invalid-argument', `Unknown resource: ${resource}`);
  }
  assertValidAmount(amountMicros);

  let userPk;
  try { userPk = new PublicKey(pubkeyRaw); } catch (_) {
    throw new HttpsError('invalid-argument', 'Invalid Solana pubkey');
  }
  const user = userPk.toBase58();

  const mintPk = resourceMintPk(resource);
  if (!mintPk) {
    throw new HttpsError('failed-precondition', `SOL_${resource.toUpperCase()}_MINT is not configured`);
  }

  await assertNotPaused();

  // --- повторная ed25519-верификация: параметры привязаны к подписи и не могут быть подменены между шагами ---
  const message = buildWithdrawMessage({ resource, mint: mintPk.toBase58(), user, amountMicros });
  if (!verifySolMessage(message, signature, user)) {
    throw new HttpsError('permission-denied', 'Signature verification failed');
  }

  const raw = Buffer.from(signedTxBase64, 'base64');
  const signer = txSignerOf(raw);
  if (!signer) {
    throw new HttpsError('invalid-argument', 'No signer found in transaction');
  }
  if (signer !== user) {
    throw new HttpsError('permission-denied', 'Transaction signer does not match authenticated wallet');
  }

  // --- в tx должен лежать именно наш withdraw-ix с ожидаемыми mint/amount ---
  const wix = extractWithdrawIx(raw);
  if (!wix) {
    throw new HttpsError('invalid-argument', 'withdraw instruction not found in transaction');
  }
  if (wix.mint !== mintPk.toBase58() || wix.amount !== amountMicros) {
    throw new HttpsError('permission-denied', 'Withdraw instruction params mismatch');
  }

  const uid = `sol:${signer}`;
  const txHash = computeTxHash(signedTxBase64); // идентичность payload: слот дедупа и id документа
  const totalDebit = amountMicros + FEE_PER_WITHDRAW_MICROS;
  const logRef = db.collection('sol_tx_log').doc(txHash);
  const playerRef = db.collection('players').doc(uid);
  const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Локальная версия vaultSplDeltaFromTx: у parsed-транзакций статические ключи лежат
   * в tx.transaction.message.accountKeys, а адреса, подгруженные из ALT (versioned tx),
   * присутствуют ТОЛЬКО в meta.loadedAddresses — без склейки обоих наборов часть
   * token-balances не разрешается в аккаунты и отток из vault «теряется».
   * Возвращает суммарный ОТТОК (<= 0n) по всем token-аккаунтам данного mint как BigInt.
   */
  function vaultSplDeltaFromTx(tx, mintBase58) {
    const meta = tx?.meta;
    if (!meta) return 0n;

    let keys = [];
    const msgKeys = tx.transaction?.message?.accountKeys;
    if (Array.isArray(msgKeys)) {
      keys = msgKeys.map((k) => (typeof k === 'string' ? k : k?.pubkey));
    } else if (Array.isArray(meta.accountKeys)) {
      keys = meta.accountKeys.map((k) => (typeof k === 'string' ? k : k?.pubkey));
    }
    const loadedWritable = Array.isArray(meta.loadedAddresses?.writable) ? meta.loadedAddresses.writable : [];
    const loadedReadonly = Array.isArray(meta.loadedAddresses?.readonly) ? meta.loadedAddresses.readonly : [];
    keys = keys.concat(loadedWritable.map(String), loadedReadonly.map(String)); // ALT-адреса замыкают индексацию

    const balByIdx = (arr, idx) => (arr || [])
      .filter((e) => e.accountIndex === idx && e.mint === mintBase58)
      .reduce((acc, e) => acc + BigInt(e?.uiTokenAmount?.amount || '0'), 0n);

    const idxs = new Set();
    for (const arr of [meta.preTokenBalances, meta.postTokenBalances]) {
      for (const e of arr || []) if (e.mint === mintBase58) idxs.add(Number(e.accountIndex));
    }

    let outflow = 0n;
    for (const idx of idxs) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= keys.length) continue; // битая индексация — пропустить
      const d = balByIdx(meta.postTokenBalances, idx) - balByIdx(meta.preTokenBalances, idx);
      if (d < 0n) outflow += d; // отток — это vault; приток получателя не учитываем
    }
    return outflow;
  }

  /** Компенсация: возврат totalDebit на баланс + пометка sol_tx_log compensated (идемпотентна по статусу). */
  const compensate = async (reason) => {
    await db.runTransaction(async (t) => {
      const snap = await t.get(logRef);
      if (!snap.exists || snap.data()?.status === 'compensated') return;
      t.set(playerRef, {
        [`balances.${resource}.micros`]: admin.firestore.FieldValue.increment(totalDebit),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      t.set(logRef, {
        status: 'compensated',
        compensatedReason: String(reason || '').slice(0, 500),
        compensatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  };

  // --- ШАГ 1: атомарно ДО broadcast — баланс >= amount + fee, дебет и бронь слота дедупа ---
  try {
    await db.runTransaction(async (t) => {
      const logSnap = await t.get(logRef);
      if (logSnap.exists) {
        throw new HttpsError('already-exists', 'Duplicate withdraw payload'); // слот занят — повтор отклонён
      }
      const snap = await t.get(playerRef);
      const cur = Number(snap.data()?.balances?.[resource]?.micros ?? 0);
      if (!Number.isFinite(cur) || cur < totalDebit) {
        throw new HttpsError('failed-precondition', `Insufficient ${resource} balance: ${cur} < ${totalDebit}`);
      }
      t.set(playerRef, {
        uid,
        wallet: signer,
        chain: 'solana',
        [`balances.${resource}.micros`]: admin.firestore.FieldValue.increment(-totalDebit),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      t.set(logRef, {
        txHash,
        uid,
        kind: 'withdraw',
        resource,
        amountMicros,
        feeMicros: FEE_PER_WITHDRAW_MICROS,
        totalDebitedMicros: totalDebit,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: false }); // строгая запись: параллельный запрос не может переиграть слот
    });
  } catch (e) {
    if (e instanceof HttpsError) throw e; // недостаток средств / дубликат / гонка — ДО любого broadcast
    throw new HttpsError('internal', `Pre-debit transaction failed: ${e.message}`);
  }

  // --- ШАГ 2: broadcast (дебет уже зафиксирован, двойной вывод невозможен) ---
  let sig;
  try {
    sig = await sendAuthorityTx(raw);
  } catch (e) {
    await compensate(`broadcast_failed: ${e.message}`).catch(() => {});
    throw new HttpsError('internal', `Broadcast failed: ${e.message}`); // баланс уже возвращён
  }

  // --- подтверждение: getParsedTransaction с commitment 'finalized', retry-цикл 5 попыток, задержки 2/4/8/16/32 сек ---
  const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 32000];
  let parsed = null;
  for (const delayMs of RETRY_DELAYS_MS) {
    await sleepMs(delayMs);
    try {
      parsed = await connection.getParsedTransaction(sig, {
        commitment: 'finalized',
        maxSupportedTransactionVersion: 0,
      });
    } catch (_) {
      parsed = null;
    }
    if (parsed) break; // финализирована (даже с meta.err — классифицируем ниже)
  }

  // --- ШАГ 3: post-verify. При успехе дополнительно ничего не делаем — дебет выполнен на шаге 1 ---
  const txFailedOnChain = Boolean(parsed?.meta?.err);
  const vaultOutflow = parsed && !txFailedOnChain ? vaultSplDeltaFromTx(parsed, mintPk.toBase58()) : 0n;
  const verified = Boolean(parsed) && !txFailedOnChain && vaultOutflow === -BigInt(amountMicros);

  if (verified) {
    await logRef.set({
      status: 'confirmed',
      signature: sig,
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});
    await db.collection('withdrawals').doc(txHash).set({
      txHash,
      signature: sig,
      uid,
      wallet: signer,
      resource,
      mint: mintPk.toBase58(),
      requestedMicros: amountMicros,
      feeMicros: FEE_PER_WITHDRAW_MICROS,
      paidMicros: amountMicros,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { signature: sig, resource, paidMicros: amountMicros };
  }

  // --- ШАГ 4: post-verify провален после всех ретраев — компенсация БЕЗ throw ---
  // Внимание: при not_finalized_after_retries tx теоретически может финализироваться позже;
  // слот sol_tx_log остаётся занятым (status compensated), повтор того же payload невозможен.
  const reason = !parsed
    ? 'not_finalized_after_retries'
    : txFailedOnChain
      ? `on_chain_error: ${JSON.stringify(parsed.meta.err)}`
      : `vault_outflow_mismatch: ${vaultOutflow.toString()} != -${amountMicros}`;
  await compensate(reason).catch(() => {});
  return { signature: sig, resource, paidMicros: 0, compensated: true };
});
/** 14a. Депозит нативного токена: клиент сам отправляет SystemProgram.transfer(user -> bankPDA), сервер верифицирует lamportsDelta(bankPDA) >= запрошенного и зачисляет микросы (целочисленная конвертация lamports <-> micros). */
exports.requestRonDeposit = onCall(async (request) => {
  const signature = String(request.data?.signature || '').trim();
  const amountMicros = Number(request.data?.amountMicros);
  const pubkeyRaw = String(request.data?.userPubkey || '').trim();
  if (!signature || !pubkeyRaw) {
    throw new HttpsError('invalid-argument', 'signature and userPubkey are required');
  }
  assertValidAmount(amountMicros);
  if (!PROGRAM_ID_PK) {
    throw new HttpsError('failed-precondition', 'AOF_PROGRAM_ID is not configured');
  }

  let userPk;
  try { userPk = new PublicKey(pubkeyRaw); } catch (_) {
    throw new HttpsError('invalid-argument', 'Invalid Solana pubkey');
  }
  const user = userPk.toBase58();

  await assertNotPaused();

  const [bankPda] = deriveBank();

  // --- транзакция должна быть подтверждена и успешна ---
  const tx = await connection
    .getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' })
    .catch(() => null);
  if (!tx) {
    throw new HttpsError('not-found', 'Deposit transaction not found or not confirmed yet');
  }
  if (tx.meta?.err) {
    throw new HttpsError('failed-precondition', 'Deposit transaction failed on-chain');
  }

  // --- подписант транзакции обязан совпадать с заявленным кошельком ---
  const txSigner = tx.transaction?.message?.accountKeys?.[0]?.pubkey;
  if (txSigner !== user) {
    throw new HttpsError('permission-denied', 'Deposit transaction signer mismatch');
  }

  // --- верификация дельты банка: зачисляем фактически пришедшие lamports (>= запрошенных микрос) ---
  const deltaLamports = lamportsDeltaFromTx(tx, bankPda.toBase58());
  const minLamports = solCore.microsToLamports(amountMicros);
  if (BigInt(deltaLamports) < minLamports) {
    throw new HttpsError('failed-precondition', `Bank delta ${deltaLamports} < requested ${minLamports} lamports`);
  }

  const uid = `sol:${user}`;
  const txHash = crypto.createHash('sha256').update(signature).digest('hex');
  await recordTx(txHash, uid, 'ron_deposit'); // один депозит-клейм на транзакцию

  const creditedMicros = Number(solCore.lamportsToMicros(BigInt(deltaLamports)));

  await db.collection('players').doc(uid).set(
    {
      uid,
      wallet: user,
      chain: 'solana',
      'balances.ron.micros': admin.firestore.FieldValue.increment(creditedMicros),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await db.collection('deposits').doc(txHash).set({
    txHash,
    signature,
    uid,
    wallet: user,
    resource: 'ron',
    bank: bankPda.toBase58(),
    requestedMicros: amountMicros,
    creditedMicros,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, signature, resource: 'ron', creditedMicros };
});

/** 14b. Вывод нативного токена (single-call co-sign): verifySolMessage -> paused -> АТОМАРНОЕ РЕЗЕРВИРОВАНИЕ ДО broadcast (runTransaction: баланс >= amount+fee, дебет баланса, sol_tx_log merge:false; недостаток средств/дубликат — throw до отправки) -> sendAuthorityTx -> верификация (getParsedTransaction finalized, retry 5 попыток 2/4/8/16/32 c, PaidOut + lamportsDelta с учётом meta.loadedAddresses) -> успех: дебит уже сделан, повторно не списываем; провал после всех retry: компенсация (баланс += amount+fee, sol_tx_log compensated) БЕЗ throw. */
exports.requestRonWithdraw = onCall(async (request) => {
  const amountMicros = Number(request.data?.amountMicros);
  const requestId = String(request.data?.requestId || '').trim();
  const pubkeyRaw = String(request.data?.userPubkey || '').trim();
  const signature = String(request.data?.userSignature || '').trim();
  if (!requestId || !pubkeyRaw || !signature) {
    throw new HttpsError('invalid-argument', 'requestId, userPubkey and userSignature are required');
  }
  if (requestId.length > 64) {
    throw new HttpsError('invalid-argument', 'requestId too long');
  }
  assertValidAmount(amountMicros);
  if (!PROGRAM_ID_PK) {
    throw new HttpsError('failed-precondition', 'AOF_PROGRAM_ID is not configured');
  }

  let userPk;
  try { userPk = new PublicKey(pubkeyRaw); } catch (_) {
    throw new HttpsError('invalid-argument', 'Invalid Solana pubkey');
  }
  const user = userPk.toBase58();
  const uid = `sol:${user}`;

  // --- ed25519-верификация канонического запроса на вывод RON ---
  const message = buildRonWithdrawMessage({ user, requestId, amountMicros });
  if (!verifySolMessage(message, signature, user)) {
    throw new HttpsError('permission-denied', 'Signature verification failed');
  }

  await assertNotPaused();

  // --- сумма на цепи — в lamports (целочисленная конвертация из микрос, без float) ---
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(solCore.microsToLamports(amountMicros), 0);

  const [authPda] = solCore.deriveAuth();
  const [configPda] = solCore.deriveConfig();
  const [playerPda] = solCore.derivePlayer(user);
  const [gastankPda] = solCore.deriveGasTank(user);
  const [bankPda] = deriveBank();

  // --- ix data: disc("global:withdraw_ron") + borsh(amountLamports: u64) ---
  const ixData = Buffer.concat([globalDisc('withdraw_ron'), amountBuf]);

  const authorityKp = getAuthorityKeypair();
  const withdrawIx = new TransactionInstruction({
    programId: PROGRAM_ID_PK,
    keys: [
      { pubkey: authPda, isSigner: false, isWritable: true },
      { pubkey: authorityKp.publicKey, isSigner: true, isWritable: false }, // серверный co-sign
      { pubkey: userPk, isSigner: false, isWritable: true },                // получатель
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: gastankPda, isSigner: false, isWritable: true },            // программа дебетует fee сама
      { pubkey: bankPda, isSigner: false, isWritable: true },               // источник lamports (PDA программы)
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData,
  });

  // --- оценка сетевой комиссии (lamports): резервируется вместе с суммой, чтобы баланс не ушёл в минус ---
  const FEE_LAMPORTS = 5000n;
  const feeMicros = Number(solCore.lamportsToMicros(FEE_LAMPORTS));
  const totalMicros = amountMicros + feeMicros;

  // --- дедуп-ключ детерминирован (user, requestId): on-chain подпись неизвестна до broadcast,
  //     поэтому слот бронируется по хешу запроса; подпись дописывается в документ после отправки ---
  const txHash = crypto.createHash('sha256').update(`ron_withdraw:${user}:${requestId}`).digest('hex');
  const logRef = db.collection('sol_tx_log').doc(txHash);
  const playerRef = db.collection('players').doc(uid);

  // --- ШАГ 1: атомарное резервирование ДО broadcast (проверка + дебит + слот дедупа одним runTransaction) ---
  await db.runTransaction(async (t) => {
    const logSnap = await t.get(logRef);
    if (logSnap.exists) {
      throw new HttpsError('already-exists', 'Duplicate withdraw request: requestId already used');
    }
    const snap = await t.get(playerRef);
    const cur = Number(snap.data()?.balances?.ron?.micros ?? 0);
    if (cur < totalMicros) {
      throw new HttpsError('failed-precondition', `Insufficient ron balance: ${cur} < ${totalMicros}`);
    }
    t.set(playerRef, {
      uid,
      wallet: user,
      chain: 'solana',
      'balances.ron.micros': admin.firestore.FieldValue.increment(-totalMicros),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    t.set(logRef, {
      txHash,
      uid,
      wallet: user,
      resource: 'ron',
      requestId,
      amountMicros,
      feeMicros,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });
  });

  // --- lamportsDelta с учётом meta.loadedAddresses (versioned tx / ALT: loaded-адреса идут после статических ключей) ---
  const lamportsDeltaFromTx = (info, addr) => {
    const meta = info.meta || {};
    const staticKeys = (info.transaction?.message?.accountKeys || [])
      .map((k) => (typeof k === 'string' ? k : (k.pubkey || String(k))));
    const loaded = [
      ...(meta.loadedAddresses?.writable || []),
      ...(meta.loadedAddresses?.readonly || []),
    ];
    const allKeys = staticKeys.slice();
    for (const k of loaded) {
      if (!allKeys.includes(k)) allKeys.push(k); // в parsed-ответах loaded уже могут быть в accountKeys — не дублируем
    }
    const idx = allKeys.indexOf(addr);
    if (idx === -1) return 0;
    const pre = meta.preBalances?.[idx];
    const post = meta.postBalances?.[idx];
    if (pre == null || post == null) return 0;
    return post - pre;
  };

  // --- аудит успешной выплаты (идемпотентно, best-effort) ---
  const finalizeSuccess = async (finalSig) => {
    await db.collection('withdrawals').doc(txHash).set({
      txHash,
      signature: finalSig,
      uid,
      wallet: user,
      resource: 'ron',
      requestId,
      requestedMicros: amountMicros,
      feeMicros,
      paidMicros: amountMicros,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }).catch((err) => console.error('withdraw audit write failed:', err));
    await logRef.set({
      status: 'confirmed',
      signature: finalSig,
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }).catch((err) => console.error('sol_tx_log confirm write failed:', err));
  };

  let sig = null;
  try {
    // --- ШАГ 2: broadcast (полностью серверная отправка, feePayer = authority) ---
    ({ signature: sig } = await sendAuthorityTx([withdrawIx]));
    await logRef.set({ signature: sig }, { merge: true }).catch(() => {});

    // --- ШАГ 3: подтверждение — finalized, retry 5 попыток с задержками 2/4/8/16/32 c ---
    const CONFIRM_DELAYS_MS = [2000, 4000, 8000, 16000, 32000];
    let txInfo = null;
    for (const delayMs of CONFIRM_DELAYS_MS) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      txInfo = await connection
        .getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: 'finalized' })
        .catch(() => null);
      if (txInfo) break;
    }
    if (!txInfo) {
      throw new Error(`Withdraw tx ${sig} not finalized after ${CONFIRM_DELAYS_MS.length} attempts`);
    }
    if (txInfo.meta?.err) {
      throw new Error(`Withdraw tx failed on-chain: ${JSON.stringify(txInfo.meta.err)}`);
    }

    // --- ШАГ 4: верификация выплаты (lamports покинули bank PDA + Anchor-событие PaidOut) ---
    const bankDelta = lamportsDeltaFromTx(txInfo, bankPda.toBase58());
    if (bankDelta >= 0) {
      throw new Error('No lamports left the bank PDA — withdraw not verified');
    }
    const evts = await eventsOf(sig);
    const paidOut = evts.find((e) => e.name === 'PaidOut');
    if (!paidOut) {
      throw new Error('PaidOut event not found — withdraw not verified');
    }
    if (paidOut.data.user !== user) {
      throw new Error('PaidOut event user mismatch');
    }

    // --- успех: дебит баланса уже выполнен на шаге резервирования, повторно ничего не списываем ---
    await finalizeSuccess(sig);
    return { signature: sig, resource: 'ron', paidMicros: amountMicros };
  } catch (e) {
    const reason = e?.message || String(e);

    // страховка: tx мог всё же попасть в цепь сразу после последнего retry —
    // компенсация в этом случае дала бы двойную выплату, поэтому перепроверяем
    const late = sig
      ? await connection
          .getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: 'finalized' })
          .catch(() => null)
      : null;
    if (late && !late.meta?.err) {
      await finalizeSuccess(sig);
      return { signature: sig, resource: 'ron', paidMicros: amountMicros };
    }

    // --- компенсация: возврат amount+fee на игровой баланс, слот дедупа помечается compensated ---
    await db.runTransaction(async (t) => {
      t.set(playerRef, {
        uid,
        wallet: user,
        chain: 'solana',
        'balances.ron.micros': admin.firestore.FieldValue.increment(totalMicros),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      t.set(logRef, {
        status: 'compensated',
        error: String(reason).slice(0, 500),
        compensatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    // НЕ throw: средства восстановлены, клиент может повторить вывод с новым requestId
    return { status: 'compensated', reason };
  }
});
/** 15. Начисление skins/shards в Firestore: verifySolMessage -> paused -> кулдаун -> дедуп requestId (sol_tx_log) -> серверный ролл -> атомарное начисление + штамп кулдауна. */
exports.collectExplorationRewards = onCall(async (request) => {
  const requestId = String(request.data?.requestId || '').trim();
  const pubkeyRaw = String(request.data?.userPubkey || '').trim();
  const signature = String(request.data?.userSignature || '').trim();
  if (!requestId || !pubkeyRaw || !signature) {
    throw new HttpsError('invalid-argument', 'requestId, userPubkey and userSignature are required');
  }
  if (requestId.length > 64) {
    throw new HttpsError('invalid-argument', 'requestId too long');
  }

  let userPk;
  try { userPk = new PublicKey(pubkeyRaw); } catch (_) {
    throw new HttpsError('invalid-argument', 'Invalid Solana pubkey');
  }
  const user = userPk.toBase58();
  const uid = `sol:${user}`;

  // --- ed25519-верификация ДО любого начисления ---
  const message = buildExplorationMessage({ user, requestId });
  if (!verifySolMessage(message, signature, user)) {
    throw new HttpsError('permission-denied', 'Signature verification failed');
  }

  await assertNotPaused();

  const now = Date.now();
  const playerRef = db.collection('players').doc(uid);

  // --- кулдаун между сборами ---
  const preSnap = await playerRef.get();
  const lastCollectMs = Number(preSnap.data()?.exploration?.lastCollectMs ?? 0);
  if (lastCollectMs && now - lastCollectMs < EXPLORATION_COOLDOWN_MS) {
    const retryInSec = Math.ceil((EXPLORATION_COOLDOWN_MS - (now - lastCollectMs)) / 1000);
    throw new HttpsError('failed-precondition', `Exploration rewards on cooldown — retry in ${retryInSec}s`);
  }

  // --- дедуп: один клейм на (user, requestId) ---
  const claimHash = crypto.createHash('sha256').update(`exploration:${user}:${requestId}`).digest('hex');
  await recordTx(claimHash, uid, 'exploration_rewards');

  // --- серверный ролл наград (клиент не влияет на исход; выполняется строго после verifySolMessage) ---
  const shards = crypto.randomInt(EXPLORATION_SHARDS_MIN, EXPLORATION_SHARDS_MAX + 1);
  const skins = rollSkinCount();

  // --- атомарное начисление + штамп кулдауна (повторная проверка внутри транзакции против гонок) ---
  await db.runTransaction(async (t) => {
    const snap = await t.get(playerRef);
    const last = Number(snap.data()?.exploration?.lastCollectMs ?? 0);
    if (last && now - last < EXPLORATION_COOLDOWN_MS) {
      throw new HttpsError('failed-precondition', 'Exploration rewards on cooldown');
    }
    t.set(playerRef, {
      uid,
      wallet: user,
      chain: 'solana',
      shards: admin.firestore.FieldValue.increment(shards),
      skins: admin.firestore.FieldValue.increment(skins),
      exploration: {
        lastCollectMs: now,
        lastRequestId: requestId,
        lastShards: shards,
        lastSkins: skins,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { ok: true, requestId, shards, skins };
});
