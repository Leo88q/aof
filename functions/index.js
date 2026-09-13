/* eslint-env node, es2020 */
/* eslint-disable require-jsdoc */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {ethers} = require("ethers");
const cors = require("cors"); // Import cors package
require("dotenv").config();
const {FieldValue} = require("firebase-admin/firestore");
const crypto = require("crypto");

const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onRequest} = require("firebase-functions/v2/https");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");

const functionsV2 = require("firebase-functions/v2");
functionsV2.setGlobalOptions({
  region: "us-central1",
  timeoutSeconds: 300,
  memory: "512MiB",
});

// one helper at top of index.js
function canonicalUserId(decoded) {
  return String(decoded.walletAddress || decoded.address || decoded.uid || "").toLowerCase();
}

const rollUnderPct = (pct) => {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  // compare 0..999,999 vs p * 10,000 (supports 2+ decimals safely)
  return crypto.randomInt(0, 1_000_000) < Math.round(p * 10_000);
};

const WITHDRAW_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12h

const CORE_ADDR = process.env.CONTRACT_ADDRESS_TOKENS; // Main token address

const normalizeAddr = (a) => String(a || "").replace(/^ronin:/i, "0x").toLowerCase();

const CHALLENGE_TTL_SEC = 120; // 2 minutes
const AUTH_CHALLENGE_SECRET = process.env.AUTH_CHALLENGE_SECRET;
const RON_MICROS_PER_RON = 1_000_000;
const MAX_ENERGY_CAP = 5000;

const RAW_PACKS = (process.env.PACKS_COLLECTIONS || "").split(",").map((s) => s.trim()).filter(Boolean);

const PACKS_BY_KEY = {
  small: process.env.PACK_ADDR_SMALL || RAW_PACKS[0],
  medium: process.env.PACK_ADDR_MEDIUM || RAW_PACKS[1],
  big: process.env.PACK_ADDR_BIG || RAW_PACKS[2],
};

const ALLOWED_PACKS = new Set(
    Object.values(PACKS_BY_KEY).filter(Boolean),
);

const PACK_VAULT_ADDRESS = (process.env.PACK_VAULT_ADDRESS ||
   "").toLowerCase();

const ALLOWED_PACKS_LC = new Set([...ALLOWED_PACKS].map((a) => String(a).toLowerCase()));
const PACK_VAULT_LC = String(PACK_VAULT_ADDRESS || "").toLowerCase();

const RAW_COLLECTORS = (process.env.COLLECTORS_COLLECTIONS || "")
    .split(",").map((s) => normalizeAddr(s)).filter(Boolean);

const COLLECTORS_BY_KEY = {
  historian: normalizeAddr(process.env.COLLECTOR_HISTORIAN),
  historian_certificate: normalizeAddr(process.env.COLLECTOR_HISTORIAN) || RAW_COLLECTORS[0],
  research: normalizeAddr(process.env.COLLECTOR_RESEARCHER),
  research_medallion: normalizeAddr(process.env.COLLECTOR_RESEARCHER) || RAW_COLLECTORS[1],
  researchermedallion: normalizeAddr(process.env.COLLECTOR_RESEARCHER) || RAW_COLLECTORS[1],
};

const COLLECTOR_TYPE_BY_ADDRESS = {};
if (COLLECTORS_BY_KEY.historian) {
  COLLECTOR_TYPE_BY_ADDRESS[String(COLLECTORS_BY_KEY.historian).toLowerCase()] = "historian";
}
if (COLLECTORS_BY_KEY.researchermedallion) {
  COLLECTOR_TYPE_BY_ADDRESS[String(COLLECTORS_BY_KEY.researchermedallion).toLowerCase()] = "researchermedallion";
}

const ALLOWED_COLLECTORS = new Set(
    Object.values(COLLECTORS_BY_KEY).filter(Boolean).map((a) => a.toLowerCase()),
);

const REFERRAL_TIERS = [
  {level: 0, pct: 0.1, cost: {wood: 0, stone: 0, food: 0}}, // base
  {level: 1, pct: 0.5, cost: {wood: 1000, stone: 1000, food: 500}},
  {level: 2, pct: 1.0, cost: {wood: 3000, stone: 3000, food: 2000}},
  {level: 3, pct: 1.7, cost: {wood: 7000, stone: 7000, food: 4000}},
  {level: 4, pct: 2.5, cost: {wood: 12000, stone: 12000, food: 7000}},
  {level: 5, pct: 3.5, cost: {wood: 20000, stone: 20000, food: 13000}},
  {level: 6, pct: 5.0, cost: {wood: 50000, stone: 50000, food: 25000}},
];

const COLLECTOR_VAULT_ADDRESS = normalizeAddr(process.env.COLLECTOR_VAULT_ADDRESS || "");

exports.reconcileStakeCollectors = onDocumentCreated(
    {document: "stake_collectors_jobs/{jobId}", region: "us-central1", timeoutSeconds: 540, memory: "512MiB"},
    async (event) => {
      const snap = event.data; if (!snap) return;
      await finalizeStakeCollectorsJob(snap.ref, snap.data());
    },
);

// ====== SECURITY + MATH HELPERS (ADD THIS) ======

/** How many confirmations we consider "final" */
const WAIT_CONFS_DEPOSIT = 2;
const WAIT_CONFS_WITHDRAW = 2;

/** Minimum gross withdrawal per id (BASE units). Adjust if your decimals != 18. */
const MIN_GROSS_BASE = 10n; // example if decimals=0; use 10n * 10n**18n if decimals=18

/** Use one scope for both deposit & withdraw so they can't race balances */
const MUTEX_SCOPE = "account";

/** CHAIN_ID used in EIP-712 domain; set once, keep it constant. */
const CHAIN_ID = 2020; // <-- replace with Ronin mainnet chainId or Saigon testnet as you use

/**
 * Build the EIP-712 domain used when verifying withdraw signatures.
 * Depends on CHAIN_ID and CORE_ADDR.
 * @return {{name:string, version:string, chainId:number, verifyingContract:string}}
 */
function eip712Domain() {
  return {
    name: "AgeOfFarming",
    version: "1",
    chainId: CHAIN_ID,
    verifyingContract: CORE_ADDR,
  };
}

/**
 * Produce a canonical, sorted list of (id, amt) pairs so signatures and
 * idempotency keys are stable regardless of input order.
 * @param {Array<number|string>} tokenIds - Token IDs to withdraw.
 * @param {Array<string|number|bigint>} amounts - BASE-unit amounts for each tokenId.
 * @return {Array<{id:number, amt:string}>} Sorted array of pairs.
 */
function canonicalPairs(tokenIds, amounts) {
  const pairs = tokenIds.map((id, i) => ({
    id: Number(id),
    amt: String(amounts[i]),
  }));
  pairs.sort((a, b) => a.id - b.id);
  return pairs;
}

/**
 * Compute a keccak256 over the canonical pairs for EIP-712 payloads.
 * @param {Array<{id:number, amt:string}>} pairs - Canonical (id, amt) pairs.
 * @return {string} 0x-prefixed keccak256 hash.
 */
function pairsHashOf(pairs) {
  return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint256[]", "uint256[]"],
          [pairs.map((p) => p.id), pairs.map((p) => BigInt(p.amt))],
      ),
  );
}

/**
 * Stable idempotency key for a withdraw request.
 * @param {string} userAddress - Requesting user’s address (any case).
 * @param {Array<{id:number, amt:string}>} pairs - Canonical (id, amt) pairs.
 * @param {string|number} nonce - Client-provided nonce.
 * @return {string} Stable request ID.
 */
function withdrawRequestId(userAddress, pairs, nonce) {
  return stableRequestIdFrom({
    op: "requestWithdraw",
    userAddress: String(userAddress).toLowerCase(),
    pairs, // already canonical
    nonce: String(nonce),
  });
}

const isUintString = (s) => typeof s === "string" && /^[0-9]+$/.test(s);
// ✅ Only this wallet may use the panel
const SPECIAL_ADDRS = new Set([
  "".toLowerCase(),
]);

exports.updateSelfOpsFlags = functions.https.onRequest(
    (req, res) => {
      corsHandler(req, res, async () => {
        try {
          if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

          // ---- Auth ----
          const idToken = req.headers.authorization?.split("Bearer ")[1];
          if (!idToken) return res.status(401).send("Unauthorized: No token.");

          let decoded;
          try {
            decoded = await admin.auth().verifyIdToken(idToken);
          } catch {
            return res.status(401).send("Unauthorized: Invalid token.");
          }

          const uidLower = String(decoded.uid || "").toLowerCase();
          if (!SPECIAL_ADDRS.has(uidLower)) return res.status(403).send("Forbidden.");

          // ---- Inputs (booleans only) ----
          const {blockTriggers, disableFunctions} = req.body?.data || {};
          if (typeof blockTriggers !== "boolean" || typeof disableFunctions !== "boolean") {
            return res.status(400).send("blockTriggers and disableFunctions must be booleans.");
          }

          // ---- Write to config/runtime (Admin SDK ignores security rules) ----
          const cfgRef = db.collection("config").doc("runtime");

          await cfgRef.set({
            blockTriggers,
            disableFunctions,
            opsFlagsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            opsFlagsUpdatedBy: uidLower,
          }, {merge: true});


          const snap = await cfgRef.get();
          const data = snap.data() || {};
          return res.status(200).json({
            success: true,
            blockTriggers: !!data.blockTriggers,
            disableFunctions: !!data.disableFunctions,
          });
        } catch (e) {
          console.error("updateSelfOpsFlags error:", e);
          return res.status(500).send(e.message || "Internal error.");
        }
      });
    },
);

const isAllowedToolType = (toolType) => {
  const t = String(toolType || "").toLowerCase();
  return t.includes("axe") || t.includes("pick") || t.includes("spear") || t.includes("bow");
};
const isBowType = (toolType) => String(toolType || "").toLowerCase().includes("bow");


exports.sweepStakeCollectorsJobs = onSchedule(
    {region: "us-central1", schedule: "every 2 minutes", timeZone: "UTC", timeoutSeconds: 240, memory: "512MiB"},
    async () => {
      const qs = await db.collection("stake_collectors_jobs")
          .where("status", "in", ["pending", "processing"])
          .orderBy("createdAt", "asc").limit(20).get();

      for (const d of qs.docs) {
        const job = d.data() || {};
        if (job.status === "processing") {
          const last = job.lastAttemptAt?.toMillis?.() ?? 0;
          if (Date.now() - last > 6*60*1000) await d.ref.update({status: "pending", lastError: "watchdog reset"});
        }
        try {
          await finalizeStakeCollectorsJob(d.ref, job);
        } catch (e) {
          console.error("collector job error:", d.id, e);
        }
      }
    },
);

/**
 * Map a token ID to its user document field name (e.g., 0 -> "food").
 * @param {number} id - Token ID.
 * @return {string} Field key in the user doc.
 */
function fieldOf(id) {
  return TOKEN_ID_TO_FIELD[Number(id)];
}

// minimal processor, same logic you use in request path, but pulling fresh receipt:
async function finalizeStakeCollectorsJob(jobRef, job) {
  const j = job || {};
  if (!j.txHash || !j.userAddress) return;

  try {
    await jobRef.update({status: "processing", lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(), attempts: FieldValue.increment(1)});
  } catch {
    return;
  }

  try {
    const rc = await provider.waitForTransaction(String(j.txHash), 1, 30_000).catch(() => null);
    if (!rc || rc.status !== 1) throw new Error("tx not confirmed");

    // parse all collector transfers user -> vault
    const found = [];
    for (const log of (rc.logs || [])) {
      const addr = (log.address || "").toLowerCase();
      if (!ALLOWED_COLLECTORS.has(addr)) continue;
      if ((log.topics?.[0] || "").toLowerCase() !== ERC721_TRANSFER_TOPIC.toLowerCase()) continue;
      let p; try {
        p = ERC721_XFER_IFACE.parseLog(log);
      } catch {
        continue;
      }
      const from = (p.args?.from || "").toLowerCase();
      const to = (p.args?.to || "").toLowerCase();
      const id = Number(p.args?.tokenId);
      if (from === j.userAddress && to === COLLECTOR_VAULT_ADDRESS) {
        found.push({collection: addr, tokenId: id});
      }
    }
    if (!found.length) throw new Error("no collector transfers found");

    // write docs (+ meta jobs) just like in your request path
    const batch = db.batch();
    const userRef = db.collection("users").doc(j.userAddress);
    let incHist = 0; let incMed = 0;
    for (const it of found) {
      const docId = `${j.userAddress}_${it.collection}_${it.tokenId}`;
      const type = COLLECTOR_TYPE_BY_ADDRESS[it.collection] || null;
      if (type === "historian") incHist++;
      if (type === "researchermedallion") incMed++;

      batch.set(db.collection("staked_collectors").doc(docId), {
        ownerUid: j.userAddress, // if you key users by wallet; otherwise carry decoded.uid in job
        userAddress: j.userAddress,
        collectionAddress: it.collection,
        tokenId: it.tokenId,
        stakedAt: admin.firestore.FieldValue.serverTimestamp(),
        collectorKey: type,
        txHash: j.txHash,
      }, {merge: true});

      batch.set(db.collection("staked_collectors_meta_jobs").doc(docId), {
        docId,
        userAddress: j.userAddress,
        collectionAddress: it.collection,
        tokenId: it.tokenId,
        status: "queued",
        retryCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
    }
    if (incHist || incMed) {
      batch.set(userRef, {
        ...(incHist ? {has_historian: FieldValue.increment(incHist)} : {}),
        ...(incMed ? {has_medallion: FieldValue.increment(incMed)} : {}),
      }, {merge: true});
    }
    await batch.commit();

    await jobRef.update({status: "completed", finalizedAt: admin.firestore.FieldValue.serverTimestamp()});
  } catch (e) {
    await jobRef.update({status: "pending", lastError: e.message || String(e)}); // let sweeper retry
  }
}

exports.stakeCollectors = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        const decoded = await admin.auth().verifyIdToken(idToken).catch(() => null);
        if (!decoded) return res.status(401).send("Unauthorized: Invalid token.");

        const body = req.body?.data || {};
        const userAddressIn = String(body.userAddress || "");
        const userLower = normalizeAddr(userAddressIn);
        const tokenIds = Array.isArray(body.tokenIds) ?
          body.tokenIds.map(Number) :
          (body.tokenId != null ? [Number(body.tokenId)] : []);
        const txHashes = Array.isArray(body.txHashes) ?
          body.txHashes :
          (body.txHash ? [body.txHash] : (body.transactionHash ? [body.transactionHash] : []));

        if (tokenIds.length === 0) return res.status(400).send("tokenIds required.");
        if (txHashes.length === 0) return res.status(400).send("txHash/txHashes required.");

        if (!ethers.isAddress(userLower)) return res.status(400).send("Bad userAddress.");

        // auth match against normalized
        if (decoded.uid.toLowerCase() !== userLower) {
          return res.status(403).send("Permission denied: auth/user mismatch.");
        }
        if (!COLLECTOR_VAULT_ADDRESS) return res.status(500).send("COLLECTOR_VAULT_ADDRESS is not configured.");


        const vaultLower = COLLECTOR_VAULT_ADDRESS;

        // --- Build all items to stake (may reuse the same tx for multiple tokenIds) ---
        const items = [];
        for (const id of tokenIds) {
          // pick per-index hash if present, else reuse the first
          const hash = txHashes[tokenIds.indexOf(id)] || txHashes[0];
          const rc = await provider.getTransactionReceipt(hash).catch(() => null);
          if (!rc || rc.status !== 1) {
            // enqueue a reconcile job and return 202, like packs/tools
            const jobId = `stake_collectors:${userLower}:${hash}`;
            await db.collection("stake_collectors_jobs").doc(jobId).set({
              status: "pending",
              userAddress: userLower,
              txHash: hash,
              tokenIds: [...new Set(tokenIds.map(Number))].sort((a, b)=>a-b),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              attempts: 0,
              lastError: !rc ? "no_receipt_yet" : "receipt_status_not_1",
            }, {merge: true});

            return res.status(202).json({
              success: true, status: "pending", requestId: jobId, txHash: hash,
              message: "Stake submitted — finalization is queued.",
            });
          }

          // live parse path (when rc exists now)
          let col = null;
          for (const log of (rc.logs || [])) {
            const addr = (log.address || "").toLowerCase();
            if (!ALLOWED_COLLECTORS.has(addr)) continue;
            if ((log.topics?.[0] || "").toLowerCase() !== ERC721_TRANSFER_TOPIC.toLowerCase()) continue;
            let parsed; try {
              parsed = ERC721_XFER_IFACE.parseLog(log);
            } catch {
              continue;
            }
            const from = (parsed.args?.from || "").toLowerCase();
            const to = (parsed.args?.to || "").toLowerCase();
            const tid = Number(parsed.args?.tokenId);
            if (from === userLower && to === COLLECTOR_VAULT_ADDRESS && tid === id) {
              col = addr; break;
            }
          }

          if (!col) {
            // enqueue a reconcile job if parsing didn’t find a match (router paths, trimmed logs, etc.)
            const jobId = `stake_collectors:${userLower}:${hash}`;
            await db.collection("stake_collectors_jobs").doc(jobId).set({
              status: "pending",
              userAddress: userLower,
              txHash: hash,
              tokenIds: [...new Set(tokenIds.map(Number))].sort((a, b)=>a-b),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              attempts: 0,
              lastError: "parse_produced_no_ids",
            }, {merge: true});

            return res.status(202).json({
              success: true, status: "pending", requestId: jobId, txHash: hash,
            });
          }
          // best-effort ownerOf (no hard fail on lag)
          try {
            await waitOwnerIs(provider, col, id, vaultLower, 10_000, 500);
          } catch (e) {
            console.log(e);
          }
          items.push({tokenId: id, colLower: col, txHash: hash});
        }

        // --- Idempotent write under user mutex + counters ---
        const requestId = `stakeCollectors:${userLower}:${tokenIds.join(",")}:${txHashes.join(",")}`;
        const result = await withUserMutex(userLower, requestId, async (lock) => {
          const userRef = db.collection("users").doc(decoded.uid);
          const mkIds = (it) => `${userLower}_${it.colLower}_${it.tokenId}`;
          const stRefs = items.map((it) => db.collection("staked_collectors").doc(mkIds(it)));
          const jobRefs = items.map((it) => db.collection("staked_collectors_meta_jobs").doc(mkIds(it)));

          await db.runTransaction(async (tx) => {
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) throw new Error("User not found.");

            let incHist = 0; let incMed = 0;
            for (let i = 0; i < items.length; i++) {
              const it = items[i];
              const docId = mkIds(it);
              const type = COLLECTOR_TYPE_BY_ADDRESS[it.colLower] || null; // 'historian' | 'researchermedallion' | null
              if (type === "historian") incHist++;
              if (type === "researchermedallion") incMed++;

              const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
              const nowTs = admin.firestore.Timestamp.now();
              const unlockAtTs = admin.firestore.Timestamp.fromMillis(nowTs.toMillis() + THREE_DAYS_MS);

              tx.set(stRefs[i], {
                ownerUid: decoded.uid,
                userAddress: userLower,
                collectionAddress: it.colLower,
                tokenId: it.tokenId,
                stakedAt: unlockAtTs,
                unlockAt: unlockAtTs,
                stakedAtActual: nowTs,
                collectorKey: type,
                txHash: it.txHash,
              }, {merge: true});
              tx.set(jobRefs[i], {
                docId,
                userAddress: userLower,
                collectionAddress: it.colLower,
                tokenId: it.tokenId,
                status: "queued",
                retryCount: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, {merge: true}); // idempotent
            }
            const userUpdates = {};
            if (incHist > 0) userUpdates.has_historian = FieldValue.increment(incHist);
            if (incMed > 0) userUpdates.has_medallion = FieldValue.increment(incMed);
            if (Object.keys(userUpdates).length) tx.set(userRef, userUpdates, {merge: true});
          });

          await lock.markCompleted({staked: items.length});
          return ok({
            success: true,
            staked: items.length,
            docIds: items.map(mkIds),
          });
        }, {scope: "collectors", idempotencyKey: requestId, waitMs: 15000, retryEveryMs: 250});

        return res.status(result.status).json(result.body);
      } catch (e) {
        if (e?.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("stakeCollectors error:", e);
        return res.status(500).send(e?.message || "Internal error.");
      }
    }),
);


exports.pokeCollectorsMeta = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        const decoded = await admin.auth().verifyIdToken(idToken).catch(() => null);
        if (!decoded) return res.status(401).send("Unauthorized: Invalid token.");

        const {stakedCollectorDocId} = req.body?.data || {};
        if (!stakedCollectorDocId) return res.status(400).send("Missing stakedCollectorDocId.");

        const jobRef = db.collection("staked_collectors_meta_jobs").doc(stakedCollectorDocId);
        const stakedRef = db.collection("staked_collectors").doc(stakedCollectorDocId);
        const metaRef = db.collection("staked_collectors_meta").doc(stakedCollectorDocId);

        // CAS: set processing only if queued or error
        await db.runTransaction(async (tx) => {
          const j = await tx.get(jobRef);
          if (!j.exists) throw new Error("Meta job not found.");
          const d = j.data() || {};
          if (!["queued", "error"].includes(d.status)) {
          // someone else is processing or already done
            throw Object.assign(new Error("Job not ready"), {code: "SKIP"});
          }
          tx.update(jobRef, {status: "processing", updatedAt: admin.firestore.FieldValue.serverTimestamp()});
        }).catch((e) => {
          if (e.code !== "SKIP") throw e;
        });

        // Load staked doc (source of truth)
        const st = await stakedRef.get();
        if (!st.exists) {
        // mark terminal
          await jobRef.set({status: "dead", updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
          return res.status(404).send("Staked doc not found.");
        }
        const {collectionAddress, tokenId, userAddress} = st.data() || {};
        if (!ethers.isAddress(collectionAddress) || !Number.isFinite(Number(tokenId))) {
          return res.status(400).send("Bad staked doc data.");
        }

        // Read tokenURI & fetch metadata (reuse your gateways)
        const c = new ethers.Contract(collectionAddress, ERC721_METADATA_ABI, provider);
        const tokenUriRaw = await c.tokenURI(Number(tokenId));
        let meta;
        try {
          meta = await fetchJsonWithGateways(String(tokenUriRaw));
        } catch (e) {
          await jobRef.set({
            status: "error",
            retryCount: admin.firestore.FieldValue.increment(1),
            lastError: e.message || String(e),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
          return res.status(500).send("Failed to fetch token metadata.");
        }
        const tokenUriHttp = IPFS_GATEWAYS[0](String(tokenUriRaw));

        const imageRaw = meta.image || meta.image_url;
        const animationRaw = meta.animation_url || meta.animation;
        const imageUrl = imageRaw ? IPFS_GATEWAYS[0](String(imageRaw)) : null;
        const animationUrl = animationRaw ? IPFS_GATEWAYS[0](String(animationRaw)) : null;
        const name = meta.name || `${tokenId}`;
        const description = meta.description || "";
        const attributes = Array.isArray(meta.attributes) ? meta.attributes : [];

        // Write cache
        await metaRef.set({
          docId: stakedCollectorDocId,
          userAddress: (userAddress || "").toLowerCase(),
          collectionAddress: (collectionAddress || "").toLowerCase(),
          tokenId: Number(tokenId),
          tokenURI: tokenUriHttp,
          name, description, imageUrl, animationUrl, attributes,
          raw: meta,
          fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});

        // Mark job completed
        await jobRef.set({
          status: "completed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});

        return res.status(200).json({success: true, status: "completed"});
      } catch (e) {
        console.error("pokeCollectorsMeta error:", e);
        return res.status(500).send(e?.message || "Internal error.");
      }
    }),
);

exports.sweepCollectorsMeta = onSchedule(
    {
      schedule: "every 2 minutes",
      timeZone: "Etc/UTC",
      region: "us-central1", // keep consistent with your other v2 functions
      timeoutSeconds: 120,
      memory: "512MiB",
    },
    async (event) => {
      const MAX = 10; // per sweep
      const MAX_RETRIES = 5; // then mark dead

      const jobsSnap = await db.collection("staked_collectors_meta_jobs")
          .where("status", "in", ["queued", "error"])
          .orderBy("updatedAt", "asc")
          .limit(MAX)
          .get();

      for (const j of jobsSnap.docs) {
        const jd = j.data() || {};
        const docId = jd.docId || j.id;
        if ((jd.retryCount || 0) > MAX_RETRIES) {
          await j.ref.update({status: "dead", updatedAt: admin.firestore.FieldValue.serverTimestamp()});
          continue;
        }
        // call our HTTPS function internally would require token; instead inline minimal logic:
        try {
        // Re-run same logic as pokeCollectorsMeta (compact):
          const st = await db.collection("staked_collectors").doc(docId).get();
          if (!st.exists) {
            await j.ref.update({status: "dead", updatedAt: admin.firestore.FieldValue.serverTimestamp()});
            continue;
          }
          const {collectionAddress, tokenId, userAddress} = st.data() || {};
          const c = new ethers.Contract(collectionAddress, ERC721_METADATA_ABI, provider);
          const tokenUriRaw = await c.tokenURI(Number(tokenId));
          const meta = await fetchJsonWithGateways(String(tokenUriRaw));
          const tokenUri = IPFS_GATEWAYS[0](String(tokenUriRaw));

          const imageRaw = meta.image || meta.image_url;
          const animationRaw = meta.animation_url || meta.animation;
          const imageUrl = imageRaw ? IPFS_GATEWAYS[0](String(imageRaw)) : null;
          const animationUrl = animationRaw ? IPFS_GATEWAYS[0](String(animationRaw)) : null;
          await db.collection("staked_collectors_meta").doc(docId).set({
            docId,
            userAddress: (userAddress || "").toLowerCase(),
            collectionAddress: (collectionAddress || "").toLowerCase(),
            tokenId: Number(tokenId),
            tokenURI: tokenUri,
            name: meta.name || `${tokenId}`,
            description: meta.description || "",
            imageUrl, animationUrl,
            attributes: Array.isArray(meta.attributes) ? meta.attributes : [],
            raw: meta,
            fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});

          await j.ref.update({status: "completed", updatedAt: admin.firestore.FieldValue.serverTimestamp()});
        } catch (e) {
          await j.ref.set({
            status: "error",
            retryCount: admin.firestore.FieldValue.increment(1),
            lastError: e.message || String(e),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
        }
      }
      return null;
    });


exports.requestUnstakeCollectors = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        const decoded = await admin.auth().verifyIdToken(idToken).catch(() => null);
        if (!decoded) return res.status(401).send("Unauthorized: Invalid token.");

        // --- Inputs ---
        const body = req.body?.data || {};
        const stakedCollectorDocIds = canonIds(body.stakedCollectorDocIds);
        const nonce = String(body.nonce || "");
        const signature = String(body.signature || "");
        if (stakedCollectorDocIds.length === 0 || !nonce || !signature) {
          return res.status(400).send("Missing stakedCollectorDocIds, nonce, or signature.");
        }

        const message = `Unstake collectors: ${JSON.stringify({stakedCollectorDocIds, nonce})}`;
        let recovered;
        try {
          recovered = ethers.verifyMessage(message, signature);
        } catch {
          return res.status(401).send("Invalid signature.");
        }
        const userLower = recovered.toLowerCase();
        if (decoded.uid.toLowerCase() !== userLower) {
          return res.status(403).send("Permission denied: auth/user mismatch.");
        }

        if (!COLLECTOR_VAULT_ADDRESS) return res.status(500).send("COLLECTOR_VAULT_ADDRESS is not configured.");
        const vaultLower = COLLECTOR_VAULT_ADDRESS;

        // --- Read and validate docs
        const dbx = admin.firestore();
        const refs = stakedCollectorDocIds.map((id) => dbx.collection("staked_collectors").doc(String(id)));
        const snaps = await dbx.getAll(...refs);

        const items = [];
        // Track how many of each type we’re removing
        const decCounts = {has_historian: 0, has_medallion: 0};
        for (let i = 0; i < snaps.length; i++) {
          const s = snaps[i];
          if (!s.exists) return res.status(404).send(`staked_collectors doc not found: ${stakedCollectorDocIds[i]}`);
          const d = s.data() || {};
          if ((d.userAddress || "").toLowerCase() !== userLower) {
            return res.status(403).send(`Ownership mismatch for doc ${s.id}.`);
          }
          const collection = String(d.collectionAddress || "").toLowerCase();
          const tokenId = Number(d.tokenId);
          if (!ALLOWED_COLLECTORS.has(collection)) return res.status(403).send("Disallowed collection.");
          const key = String(d.collectorKey || "").toLowerCase();
          if (key === "historian") decCounts.has_historian++;
          if (key === "researchermedallion") decCounts.has_medallion++;

          items.push({docId: s.id, collection, tokenId});
        }

        // ---- Cooldown / Timelock guard ------------------------------------
        // Accept either `unlockAt` or (for backward-compat) `stakedAt` as a millis/Timestamp.
        {
          const now = Date.now();
          const locked = [];
          for (let i = 0; i < snaps.length; i++) {
            const d = snaps[i].data() || {};
            const unlockAt =
              (typeof d.unlockAt === "number" ? d.unlockAt : (d.unlockAt?.toMillis?.() ?? 0)) ||
              (typeof d.stakedAt === "number" ? d.stakedAt : (d.stakedAt?.toMillis?.() ?? 0));
            if (unlockAt > now) locked.push({id: snaps[i].id, unlockAt});
          }
          if (locked.length) {
            const soonest = locked.reduce((m, x) => Math.min(m, x.unlockAt), Number.POSITIVE_INFINITY);
            const secs = Math.ceil((soonest - now) / 1000);
            return res.status(400).send(
                `Some collectors are still locked. Soonest unlock in ${secs}s. Locked: ${locked.map((x) => x.id).join(", ")}`,
            );
          }
        }
        // -------------------------------------------------------------------


        // If your users collection is keyed by UID (recommended):
        const userRef = dbx.collection("users").doc(decoded.uid);

        // If yours is keyed by wallet address instead, use this instead:
        // const userRef = dbx.collection("users").doc(userLower);

        const userSnap = await userRef.get();
        if (!userSnap.exists) return res.status(404).send("User not found.");

        // --- On-chain: signer (vault owner) transfers NFT back
        const pk = process.env.CONTRACT_OWNER_PRIVATE_KEY;
        if (!pk) return res.status(500).send("CONTRACT_OWNER_PRIVATE_KEY is not configured.");
        const signer = new ethers.Wallet(pk, provider);

        if (signer.address.toLowerCase() !== COLLECTOR_VAULT_ADDRESS) {
          return res.status(500).send(
              `Signer ${signer.address.toLowerCase()} does not match COLLECTOR_VAULT_ADDRESS ${COLLECTOR_VAULT_ADDRESS}.`,
          );
        }
        // --- Figure out who owns each token *now* and split work:
        const toTransfer = []; // still in vault → needs on-chain transfer
        const alreadyUser = []; // already owned by user → just clean up Firestore
        for (const it of items) {
          const c = new ethers.Contract(it.collection, ERC721_MIN_ABI, provider);
          const owner = (await c.ownerOf(it.tokenId)).toLowerCase();
          if (owner === vaultLower) {
            toTransfer.push(it);
          } else if (owner === userLower) {
            alreadyUser.push(it);
          } else {
            console.log("[unstakeCollectors] unexpected owner", {
              collection: it.collection, tokenId: it.tokenId, owner, expectedVault: vaultLower, user: userLower,
            });
            return res.status(409).send(
                `Token ${it.tokenId} owned by ${owner}; must be held by vault or user to proceed.`,
            );
          }
        }

        // --- Fee: charge ONLY for tokens we actually transfer from vault
        const expectedFeeMicros = toTransfer.length * FEE_PER_NFT_RON_MICROS;
        if (expectedFeeMicros > 0) {
          const userSnap = await userRef.get();
          if (!userSnap.exists) return res.status(404).send("User not found.");
          const inTankMicros = readRonTankMicros(userSnap.data() || {});
          if (inTankMicros < expectedFeeMicros) {
            return res.status(403).send("Insufficient RON in gas tank to pay unstake fee.");
          }
        }

        // --- On-chain: only for the ones still in the vault
        if (toTransfer.length > 0) {
          const byCollection = toTransfer.reduce((m, it) => {
            (m[it.collection] ||= []).push(it.tokenId); return m;
          }, {});
          for (const [collectionAddr, tokenIds] of Object.entries(byCollection)) {
            const c = new ethers.Contract(collectionAddr, ERC721_MIN_ABI, signer);
            for (const id of tokenIds) {
              const tx = await c["safeTransferFrom(address,address,uint256)"](vaultLower, userLower, id);
              const r = await tx.wait(1);
              if (!r.status) throw new Error(`Unstake tx failed for token ${id} (collection ${collectionAddr}).`);
              const okBack = await waitOwnerIs(provider, collectionAddr, id, userLower, 60_000, 1_000);
              if (!okBack) throw new Error(`ownerOf(${id}) did not become user after unstake for token ${id}.`);
            }
          }
        }

        await dbx.runTransaction(async (tx) => {
        // reads (ALL reads first)
          const freshUser = await tx.get(userRef);
          if (!freshUser.exists) throw new Error("User disappeared.");
          const currentMicros = readRonTankMicros(freshUser.data() || {});
          if (currentMicros < expectedFeeMicros) {
            throw new Error("Insufficient RON at commit time.");
          }

          const baseIds = [...toTransfer, ...alreadyUser].map((it) => it.docId);
          const stRefs = baseIds.map((id) => dbx.collection("staked_collectors").doc(id));
          const metaRefs= baseIds.map((id) => dbx.collection("staked_collectors_meta").doc(id));
          const jobRefs = baseIds.map((id) => dbx.collection("staked_collectors_meta_jobs").doc(id));

          const stSnaps = await tx.getAll(...stRefs);
          // sanity: still yours
          stSnaps.forEach((s) => {
            const d = s.data();
            if (!d || (String(d.userAddress || "").toLowerCase() !== userLower)) {
              throw new Error("Ownership changed before commit.");
            }
          });

          // writes (after all reads)
          tx.update(userRef, {
            gasTankRonMicros: FieldValue.increment(-expectedFeeMicros),
            // legacy float for back-compat display
            gasTankRon: FieldValue.increment(-microsToRon(expectedFeeMicros)),
          });
          stRefs.forEach((r) => tx.delete(r));
          metaRefs.forEach((r) => tx.delete(r));
          jobRefs.forEach((r) => tx.delete(r));

          // counters: clamp to 0
          const cur = freshUser.data() || {};
          const dec = {};
          if (decCounts.has_historian > 0) {
            const next = Math.max(0, Number(cur.has_historian || 0) - decCounts.has_historian);
            dec.has_historian = next;
          }
          if (decCounts.has_medallion > 0) {
            const next = Math.max(0, Number(cur.has_medallion || 0) - decCounts.has_medallion);
            dec.has_medallion = next;
          }
          if (Object.keys(dec).length) {
            tx.set(userRef, dec, {merge: true});
          }
        });

        return res.json({
          success: true,
          unstaked: items.length,
          requested: items.length,
          transferred: toTransfer.length,
          alreadyUser: alreadyUser.length,
          feeChargedRON: Number(microsToRon(expectedFeeMicros).toFixed(2)),
        });
      } catch (e) {
        console.error("requestUnstakeCollectors error:", e);
        return res.status(500).send(e?.message || "Internal error.");
      }
    }),
);

exports.canStakeCollector = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        const decoded = await admin.auth().verifyIdToken(idToken).catch(() => null);
        if (!decoded) return res.status(401).send("Unauthorized: Invalid token.");

        const {collectorKey, collectionAddress} = req.body?.data || {};
        const keyLc = String(collectorKey || "").toLowerCase();

        // Resolve type from key OR address
        const addrFromKey = COLLECTORS_BY_KEY[keyLc];
        const addr = (collectionAddress || addrFromKey || "").toLowerCase();
        let type = null;
        if (addr && COLLECTOR_TYPE_BY_ADDRESS[addr]) type = COLLECTOR_TYPE_BY_ADDRESS[addr];
        else if (keyLc === "historian" || keyLc === "researchermedallion") type = keyLc;

        if (!type) return res.status(400).json({allowed: false, reason: "BAD_COLLECTOR"});
        // No uniqueness constraint anymore
        return res.json({allowed: true, reason: "OK"});
      } catch (e) {
        console.error("canStakeCollector error:", e);
        return res.status(500).send(e?.message || "Internal error.");
      }
    }),
);

// --- Collectors meta: on-create job processor (same as packs, different collections)
async function runCollectorMetaJob(jobSnap) {
  const job = jobSnap.data() || {};
  const {userAddress, collectionAddress, tokenId} = job;
  if (!userAddress || !collectionAddress || tokenId == null) return;

  const c721 = new ethers.Contract(collectionAddress, ERC721_METADATA_ABI, provider);
  const rawUri = await c721.tokenURI(Number(tokenId));

  const toHex64 = (id) => Number(id).toString(16).padStart(64, "0");
  const applyId = (tpl, id) => String(tpl || "").replace("{id}", toHex64(Number(id)));
  const metaUri = applyId(rawUri, tokenId);

  let meta = {};
  try {
    meta = await fetchJsonWithGateways(metaUri);
  } catch (e) {
    console.log(e);
  }

  const docId = `${String(userAddress).toLowerCase()}_${String(collectionAddress).toLowerCase()}_${Number(tokenId)}`;
  await db.collection("staked_collectors_meta").doc(docId).set({
    type: meta?.type || meta?.name || null,
    rarity: meta?.rarity || null,
    image: meta?.image || null,
    metaUri,
    pending_meta: false,
    lastMetaFetchAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  await jobSnap.ref.set({status: "completed", updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
}

exports.backfillCollectorMetadata = onDocumentCreated(
    {document: "staked_collectors_meta_jobs/{jobId}", region: "us-central1", timeoutSeconds: 540, memory: "512MiB"},
    withKillSwitchBg(async (event) => {
      if (!event.data) return;
      try {
        await runCollectorMetaJob(event.data);
      } catch (e) {
        const attempts = (event.data.data()?.attempts || 0) + 1;
        if (attempts >= 5) {
          await event.data.ref.set({attempts, lastError: String(e), parked: true}, {merge: true});
        } else {
          await event.data.ref.set({attempts, lastError: String(e)}, {merge: true});
        }
      }
    }),
);

exports.sweepCollectorMetaJobs = onSchedule(
    {region: "us-central1", schedule: "every 2 minutes", timeZone: "UTC", timeoutSeconds: 240, memory: "512MiB"},
    withKillSwitchBg(async () => {
      const qs = await db.collection("staked_collectors_meta_jobs").orderBy("createdAt", "asc").limit(20).get();
      for (const doc of qs.docs) {
        try {
          await runCollectorMetaJob(doc);
        } catch (e) {
          console.log(e);
        }
      }
    }),
);

function parsePackDepositsFromReceipt(receipt, collectionLower, userLower, vaultLower) {
  const ids = [];
  for (const log of (receipt.logs || [])) {
    if ((log.address || "").toLowerCase() !== collectionLower) continue;
    if ((log.topics?.[0] || "").toLowerCase() !== ERC721_TRANSFER_TOPIC.toLowerCase()) continue;
    try {
      const p = ERC721_XFER_IFACE.parseLog(log);
      const from = (p.args?.from || "").toLowerCase();
      const to = (p.args?.to || "").toLowerCase();
      const id = Number(p.args?.tokenId);
      if (from === userLower && to === vaultLower && Number.isFinite(id)) {
        ids.push(id);
      }
    } catch {/* ignore */}
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}
// ---------- Maintenance / Kill Switch ----------
const kS_DOC_REF = () => db.collection("config").doc("runtime");
const KS_CACHE_MS = 5000; // refresh every 5s
let ksCache = {updated: 0, disabled: false, message: "", allowUIDs: [], allowFunctions: [], blockTriggers: false};

async function readKillSwitch(force = false) {
  const now = Date.now();
  if (!force && (now - ksCache.updated) < KS_CACHE_MS) return ksCache;

  try {
    const snap = await kS_DOC_REF().get();
    const d = snap.exists ? (snap.data() || {}) : {};
    ksCache = {
      updated: now,
      disabled: Boolean(d.disableFunctions),
      message: String(d.maintenanceMessage || "Maintenance"),
      allowUIDs: Array.isArray(d.allowUIDs) ? d.allowUIDs.map((s) => String(s).toLowerCase()) : [],
      allowFunctions: Array.isArray(d.allowFunctions) ? d.allowFunctions.map(String) : [],
      blockTriggers: Boolean(d.blockTriggers),
    };
  } catch (e) {
    // Fail-open with last known value; never block the world due to a read hiccup
    console.warn("KillSwitch read failed; using cached value. ", e.message || e);
  }
  return ksCache;
}

function functionName() {
  // GCF v1 exposes FUNCTION_TARGET; v2 uses K_SERVICE.
  return process.env.FUNCTION_TARGET || process.env.K_SERVICE || "unknown";
}

async function isBypassedForReq(req, ks) {
  // 1) Per-function bypass
  if (Array.isArray(ks.allowFunctions) && ks.allowFunctions.includes(functionName())) {
    return true;
  }

  // Normalize allow lists
  const allowUIDs = (ks.allowUIDs || []).map((s) => String(s).toLowerCase());
  const allowAddrs = (ks.allowAddresses || ks.allowWallets || []).map((s) => String(s).toLowerCase());

  // 2) Preferred: Firebase token matches allowUIDs
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  if (token) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      const uidLower = String(decoded?.uid || "").toLowerCase();
      if (uidLower && allowUIDs.includes(uidLower)) return true;
    } catch {/* fall through */}
  }

  // 3) Fallback (pre-auth endpoints like getWalletAuthChallenge):
  // Accept wallet via header, body, or query — include `address` too.
  const candidates = [
    req.headers["x-wallet-address"],
    req.body?.data?.userAddress,
    req.body?.userAddress,
    req.body?.address, // <— NEW
    req.query?.address, // <— NEW
    req.query?.userAddress,
  ].filter(Boolean).map((s) => String(s).toLowerCase());

  if (candidates.some((a) => allowUIDs.includes(a) || allowAddrs.includes(a))) {
    return true;
  }

  // Optional emergency header bypass
  if (ks.bypassSecret && req.headers["x-maint-bypass"] === ks.bypassSecret) return true;

  return false;
}

const IPFS_GATEWAYS = [
  (u) => u.replace(/^ipfs:\/\/ipfs\//i, "https://cloudflare-ipfs.com/ipfs/").replace(/^ipfs:\/\//i, "https://cloudflare-ipfs.com/ipfs/"),
  (u) => u.replace(/^ipfs:\/\/ipfs\//i, "https://dweb.link/ipfs/").replace(/^ipfs:\/\//i, "https://dweb.link/ipfs/"),
  (u) => u.replace(/^ipfs:\/\/ipfs\//i, "https://ipfs.io/ipfs/").replace(/^ipfs:\/\//i, "https://ipfs.io/ipfs/"),
  (u) => u.replace(/^ipfs:\/\/ipfs\//i, "https://gateway.pinata.cloud/ipfs/").replace(/^ipfs:\/\//i, "https://gateway.pinata.cloud/ipfs/"),
];

async function fetchJsonWithGateways(url) {
  let lastErr;
  for (const gw of IPFS_GATEWAYS) {
    const candidate = gw(url);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(candidate, {cache: "no-store"});
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
      } catch (e) {
        lastErr = e;
        await sleep(300 * (attempt + 1));
      }
    }
  }
  throw lastErr || new Error("All gateways failed");
}

function killSwitchIsOn(ks) {
  // Support either schema: {enabled:true} or {disabled:true}
  if (typeof ks?.enabled === "boolean") return ks.enabled;
  if (typeof ks?.disabled === "boolean") return ks.disabled;
  return false;
}

// Wrapper for HTTP (works for both v1 + v2 onRequest bodies)
function withKillSwitchHttp(handler) {
  return async (req, res) => {
    // keep your CORS behavior
    return corsHandler(req, res, async () => {
      const ks = await readKillSwitch();
      if (killSwitchIsOn(ks) && !(await isBypassedForReq(req, ks))) {
        res.set("Retry-After", "120");
        return res.status(503).json({
          error: "MAINTENANCE_MODE",
          message: ks.message || "Temporarily unavailable",
        });
      }
      return handler(req, res);
    });
  };
}

// Wrapper for background triggers (Firestore/Schedule/etc.)
function withKillSwitchBg(handler) {
  return async (...args) => {
    const ks = await readKillSwitch();
    // Allow per-function bypass
    if (ks.allowFunctions.includes(functionName())) return handler(...args);
    if (killSwitchIsOn(ks) && ks.blockTriggers) {
      console.log(`[${functionName()}] skipped due to maintenance mode.`);
      return;
    }
    return handler(...args);
  };
}


const TOKEN_ID_TO_FIELD = {
  0: "food",
  1: "wood",
  2: "stone",
};

// Minimal ABI
const ERC721_MIN_ABI = [
  "function ownerOf(uint256) view returns (address)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
];

// --- ERC-721 Transfer event (for parsing logs) ---
const ERC721_XFER_IFACE = new ethers.Interface([
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);
// Optional (handy for quick topic filtering before parseLog):
const ERC721_TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

const STRICT_REQUIRE_TX = false;

// Minimal ERC1155 event iface for parsing logs
const ERC1155_IFACE = new ethers.Interface([
  "event TransferSingle(address indexed operator," +
  " address indexed from, address indexed to," +
  " uint256 id, uint256 value)",
  "event TransferBatch(address indexed operator, address " +
  "indexed from, address indexed to, uint256[] ids, uint256[] values)",
  "function depositRonForGas() payable",
]);

// Build an idempotent request id
const makeRequestId = ({nonce, depositTxHash,
  userAddress, tokenIds, amounts, ronAmount}) => {
  if (nonce) return `n:${String(nonce)}`;
  if (depositTxHash) return `tx:${depositTxHash.toLowerCase()}`;
  // fallback: deterministic hash of payload (not as strong as a nonce)
  const payload = JSON.stringify({userAddress,
    tokenIds, amounts, ronAmount});
  return `h:${ethers.keccak256(ethers.toUtf8Bytes(payload))}`;
};


const MIN_ENERGY_TO_UNSTAKE = 999;
const FEE_PER_CRAFT_RON = 0.1;
const FEE_PER_PACK_RON = 0.01;
const MIN_ENERGY_TO_CRAFT = 100;
const FEE_PER_CRAFT_RON_MICROS = Math.round(FEE_PER_CRAFT_RON * 1e6);

const FEE_PER_NFT_RON = 0.01; // human
const FEE_PER_NFT_RON_MICROS = Math.round(FEE_PER_NFT_RON * RON_MICROS_PER_RON);

const ronToMicros = (ron) => {
  const n = Number(ron);
  if (!Number.isFinite(n) || n < 0) throw new Error("Bad RON amount");
  // Round to micros to avoid float drift
  return Math.round(n * RON_MICROS_PER_RON);
};

const microsToRon = (micros) => Number(micros || 0) / RON_MICROS_PER_RON;

// Back-compat reader
const readRonTankMicros = (userDoc) => {
  const v = Number(userDoc?.gasTankRonMicros || 0);
  if (Number.isFinite(v) && v > 0) return Math.round(v);
  // fallback to legacy float field
  const legacy = Number(userDoc?.gasTankRon || 0);
  return Math.round(legacy * RON_MICROS_PER_RON);
};

// Back-compat dual-writer
const incRonTank = (txOrRef, userRef, microsDelta) => {
  // Always update the new integer field
  txOrRef.update(userRef, {gasTankRonMicros: FieldValue.increment(microsDelta)});
  // OPTIONAL: for a few weeks, also keep legacy float roughly in sync:
  const legacyDelta = microsDelta / RON_MICROS_PER_RON;
  txOrRef.update(userRef, {gasTankRon: FieldValue.increment(legacyDelta)});
};

if (!process.env.AUTH_CHALLENGE_SECRET) {
  throw new Error("AUTH_CHALLENGE_SECRET must be set");
}
if (!process.env.RPC_ADDRESS) {
  throw new Error("RPC_ADDRESS must be set");
}

[
  "CONTRACT_OWNER_PRIVATE_KEY",
  "CONTRACT_ADDRESS_TOOLS",
  "CONTRACT_ADDRESS_TOKENS",
  "PACK_VAULT_ADDRESS",
].forEach((k) => {
  if (!process.env[k]) throw new Error(`${k} must be set`);
});

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore(); // Initialize Firestore

const ALLOWED_ORIGINS = [
  /^https?:\/\/(www\.)?ageoffarming\.com$/, // prod (apex + www)
  /^https?:\/\/ageoffarming\.netlify\.app$/, // Netlify primary (if used)
  /^https?:\/\/[a-z0-9-]+--ageoffarming\.netlify\.app$/, // Netlify previews
  /^https?:\/\/aoftest\.netlify\.app$/, // ✅ your test site
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, // local dev
];

const originOK = (origin) => {
  if (!origin) return true; // allow curl/Postman and same-origin
  try {
    return ALLOWED_ORIGINS.some((re) => re.test(origin));
  } catch {
    return false;
  }
};


const corsHandler = cors({origin(origin, cb) {
  if (originOK(origin)) return cb(null, true);
  return cb(new Error("CORS_REJECT"));
}});

// Set up your Ethereum provider (Ronin network RPC URL)
const req = new ethers.FetchRequest("https://api-gateway.skymavis.com/rpc");
req.setHeader("x-api-key", process.env.RONIN_API_KEY); // or use ?apikey=... in the URL
const provider = new ethers.JsonRpcProvider(req, {chainId: 2020, name: "ronin"});

// Private key of the contract owner (securely stored,
// never exposed in frontend)
const contractOwnerPrivateKey = process.env.CONTRACT_OWNER_PRIVATE_KEY;
// Use env variables in production
const wallet = new ethers.Wallet(
    contractOwnerPrivateKey, provider);

// Set up contract details
const contractAddressTools = process.env.CONTRACT_ADDRESS_TOOLS;
const contractAbiTools = [
  // --- View Functions (for reading data) ---
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
  "function uri(uint256 id) view returns (string)",
  "function getNextTokenId() view returns (uint256)",
  "function isApprovedForAll(address account, address operator) " +
    "view returns (bool)",

  // --- User-Facing Transaction Functions ---
  "function setApprovalForAll(address operator, bool approved) public",
  "function stake(uint256[] calldata tokenIds) external",

  // --- Owner-Only Transaction Functions (called by server) ---
  "function ownerMint(address to, string memory toolType, " +
    "string memory rarity) external",
  "function ownerMintWithBurn(address to, string memory toolType, string "+
  "memory rarity, uint256[] calldata burnTokenIds, bool force_mint) external",
  "function ownerUnstake(address user, uint256[] calldata tokenIds) " +
    "external",
  "function ownerBurnBatch(address user, uint256[] " +
  "calldata tokenIds) external",

  // --- Events ---
  "event Staked(address indexed user, uint256[] tokenIds)",
  "event Unstaked(address indexed user, uint256[] tokenIds)",
  "event TokenMinted(address indexed to, uint256 tokenId, string rarity)",
];

const contractTools = new ethers.Contract(
    contractAddressTools, contractAbiTools, wallet);

const CORE_ABI = [
  "function wrapperOf(uint256) view returns (address)",
  "function decimals(uint256) view returns (uint8)", // optional
  "function decimalsOf(uint256) view returns (uint8)", // your actual fn
  "function approveWrapperAsVaultOperator(uint256 id, bool approved) external",
  "function ownerWithdrawRon(address user, uint256 amountWei) external",
];

const WRAPPER_ABI = [
  "function ownerWrapFromVaultTo(address to, uint256 amount) external",
  "function owner() view returns (address)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function withdrawForToWithPermit(address user,address to,"+
  "uint256 amount,uint256 deadline,uint8 v,bytes32 r,bytes32 s) external",
];

// Small helpers (declared at file scope to satisfy no-inner-declarations)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withBackoff(fn, {retries=3, base=150, factor=2, jitter=100} = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      if (attempt++ >= retries) throw e;
      const wait = Math.min(2000, base * (factor ** (attempt - 1))) + Math.random() * jitter;
      await sleep(wait);
    }
  }
}
const canonIds = (arr) => [...new Set((arr || []).map(String))].sort();
const waitOwnerIs = async (provider, collection, id, wantLower,
    timeoutMs = 60_000, everyMs = 1_000) => {
  const c = new ethers.Contract(collection, ERC721_MIN_ABI, provider);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const owner = (await c.ownerOf(id)).toLowerCase();
      if (owner === wantLower) return true;
    } catch (e) {
      console.log(e);
    }
    await sleep(everyMs);
  }
  return false;
};

async function getCoreDecimals(core, id) {
  try {
    return Number(await core.decimalsOf(id));
  } catch {
    console.log("miau");
  }
  try {
    return Number(await core.decimals(id));
  } catch {
    console.log("miau");
  }
  return 18; // safe fallback
}

const ok = (body = {}) => ({status: 200, body});
const err = (code, msg) => ({status: code, body: {error: String(msg)}});

// Max hours (cap to durability elsewhere)
const MAX_HOURS_BASE = 8;
const MAX_HOURS_RM = 12;
const MAX_HOURS_H = 14;
const MAX_HOURS_BOTH = 20; // capped by your 20 durability

function maxHoursByPerks(hasHistorian, hasMedallion) {
  if (hasHistorian && hasMedallion) return MAX_HOURS_BOTH;
  if (hasHistorian) return MAX_HOURS_H;
  if (hasMedallion) return MAX_HOURS_RM;
  return MAX_HOURS_BASE;
}

// Base fees per hour (percent)
const BASE_FEE_BY_HOUR = {1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7};

// Discounts (% off the base) by hour
const DISCOUNT_RM = {2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10, 8: 10};
const DISCOUNT_H = {2: 23, 3: 23, 4: 23, 5: 23, 6: 23, 7: 23, 8: 23};
const DISCOUNT_BOTH = {2: 50, 3: 43, 4: 43, 5: 43, 6: 42, 7: 41, 8: 41};

// Returns final penalty percent; fee tier is capped at 8h
function calculatePenalty(hours, hasHistorian, hasMedallion) {
  const feeHours = Math.max(1, Math.min(8, Number(hours) || 1));
  const base = BASE_FEE_BY_HOUR[feeHours] ?? Math.max(0, feeHours - 1);
  let discount = 0;
  if (hasHistorian && hasMedallion) discount = DISCOUNT_BOTH[feeHours] ?? 0;
  else if (hasHistorian) discount = DISCOUNT_H[feeHours] ?? 0;
  else if (hasMedallion) discount = DISCOUNT_RM[feeHours] ?? 0;
  const penalty = base * (1 - discount / 100);
  return Math.round(penalty * 100) / 100;
}

// const getRandomFee = (min, max) =>
//   Math.floor(Math.random() * (max - min + 1)) + min;

// // Exact integer math on base units (BigInt):
// // fee = floor(gross * pct / 100)
// const feePercentOf = (grossBigInt, pct) =>
//   (ethers.toBigInt(grossBigInt) * BigInt(pct)) / 100n;

/**
 * Consume a one-time nonce for a user/purpose, or throw
 *  if it's already used.
 * @param {string} user    Wallet address or UID of the
 * caller.
 * @param {string} purpose Logical bucket for the nonce
 * (e.g., "withdraw", "deposit").
 * @param {string} nonce   Unique nonce string provided by the client.
 * @return {Promise<void>} Resolves if the nonce was unused
 * and is now marked as used.
 * @throws {Error} If the nonce is missing/invalid or already used.
 */
async function consumeNonceOrFail(user, purpose, nonce) {
  if (!nonce || typeof nonce !== "string") throw new Error("Missing nonce");
  const ref = db.collection("nonces").doc(`${purpose}:${user}:${nonce}`);
  await ref.create({
    usedAt: admin.firestore.FieldValue.serverTimestamp(),
    expireAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
  });
}

const b64u = (buf) => Buffer.from(buf).toString("base64url");

/**
 * Create a short-lived, stateless login challenge token for `address`.
 * Token format: "<base64url(JSON payload)>.<base64url(HMAC-SHA256)>".
 * Payload fields:
 *  - sub: lowercased wallet address (string)
 *  - iat: issued-at (unix seconds, number)
 *  - exp: expires-at (unix seconds, number)
 *  - rnd: 16-hex char nonce (string)
 *
 * @param {string} address - EVM wallet address to bind to the challenge.
 * @return {string} Signed challenge token.
 */
function makeChallengeToken(address) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: address.toLowerCase(),
    iat: now,
    exp: now + CHALLENGE_TTL_SEC,
    rnd: crypto.randomBytes(8).toString("hex"),
  };
  const payloadB64 = b64u(JSON.stringify(payload));
  const sig = crypto
      .createHmac("sha256", AUTH_CHALLENGE_SECRET)
      .update(payloadB64)
      .digest("base64url");
  return `${payloadB64}.${sig}`;
}

/**
 * Verify a challenge token created by {@link makeChallengeToken}.
 * Ensures format is valid, HMAC matches, subject matches `expectedAddress`,
 * and token is not expired.
 *
 * @param {string} token - The token to verify.
 * @param {string} expectedAddress - The wallet address
 *  that must match payload.sub.
 * @return {{sub:string, iat:number, exp:number, rnd:string}}
 * Decoded payload if valid.
 * @throws {Error} If the token format/signature is invalid,
 * subject mismatches, or expired.
 */
function verifyChallengeToken(token, expectedAddress) {
  const [payloadB64, sig] = String(token || "").split(".");
  if (!payloadB64 || !sig) throw new Error("Bad token format");
  const goodSig = crypto
      .createHmac("sha256", AUTH_CHALLENGE_SECRET)
      .update(payloadB64)
      .digest("base64url");
  if (sig !== goodSig) throw new Error("Bad token signature");

  const payload = JSON.parse(Buffer.from(
      payloadB64, "base64url").toString());
  const now = Math.floor(Date.now() / 1000);
  if (payload.sub !==
    expectedAddress.toLowerCase()) throw new Error("Sub mismatch");
  if (payload.exp < now) throw new Error("Token expired");
  return payload; // ok
}

const MUTEX = {
  ttlMs: 3 * 60 * 1000, // lease per operation
  waitMs: 10 * 1000, // how long to wait if busy before 423
  retryEveryMs: 200, // poll interval while waiting
};

function stableRequestIdFrom(obj) {
  return "h:" + ethers.keccak256(ethers.toUtf8Bytes(
      JSON.stringify(obj)));
}

/**
 * Acquire a per-user mutex with lease + reentrancy.
 * Lock doc id: `${uid.toLowerCase()}:${scope}`
 */
async function acquireUserMutexOrThrow({
  uid,
  scope = "global",
  requestId,
  idempotencyKey,
  ttlMs = MUTEX.ttlMs,
  maxWaitMs = MUTEX.waitMs,
  retryEveryMs = MUTEX.retryEveryMs,
  reservationTtlMs = 2 * 60 * 1000,
  completedTtlMs = 24 * 60 * 60 * 1000,
  maxCompletedKeys = 50,
}) {
  const lockRef = db.collection("user_locks").doc(`${uid.toLowerCase()}:${scope}`);
  const ownerPid = crypto.randomUUID();

  // 🔧 ensure we *try once* even for 0ms
  const effectiveWaitMs = Math.max(1, Number(maxWaitMs) || 0);
  const deadline = Date.now() + effectiveWaitMs;
  let firstAttempt = true;

  function pruneCompletedMap(mapObj, nowMs) {
    const ttl = Number(completedTtlMs) || (24 * 60 * 60 * 1000); // 24h
    const cap = Math.max(1, Number(maxCompletedKeys) || 50);
    const entries = Object.entries(mapObj || {});
    const fresh = entries
        .filter(([, ts]) => {
          const ms = ts?.toMillis?.() ? ts.toMillis() : (typeof ts === "number" ? ts : 0);
          return ms >= (nowMs - ttl);
        })
        .sort((a, b) => {
          const ams = a[1]?.toMillis?.() ? a[1].toMillis() : a[1];
          const bms = b[1]?.toMillis?.() ? b[1].toMillis() : b[1];
          return bms - ams; // newest first
        })
    // keep at most (cap - 1) so we have room for the new entry
        .slice(0, Math.max(0, cap - 1));
    return Object.fromEntries(fresh);
  }

  while (firstAttempt || Date.now() < deadline) {
    firstAttempt = false;
    try {
      let acquired = false;

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(lockRef);
        const now = Date.now();
        const newExp = admin.firestore.Timestamp.fromMillis(now + ttlMs);

        if (!snap.exists) {
          const data = {
            uid: uid.toLowerCase(),
            scope,
            ownerPid,
            requestId,
            expiresAt: newExp,
            acquiredAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            completed: {},
            ...(idempotencyKey ? {
              reservedKey: idempotencyKey,
              reservedAt: admin.firestore.Timestamp.fromMillis(now),
              reservedExp: admin.firestore.Timestamp.fromMillis(now + reservationTtlMs),
            } : {}),
          };
          tx.set(lockRef, data, {merge: true});
          acquired = true;
          return;
        }

        const d = snap.data() || {};
        const expMs = d.expiresAt?.toMillis?.() ?? 0;
        const resExpMs = d.reservedExp?.toMillis?.() ?? 0;
        const nowTs = admin.firestore.Timestamp.fromMillis(now);

        if (idempotencyKey && d.completed && d.completed[idempotencyKey]) {
          const err = new Error("ALREADY_DONE");
          err.code = "ALREADY_DONE";
          throw err;
        }

        if (d.reservedKey && resExpMs > now && (!idempotencyKey || d.reservedKey !== idempotencyKey)) {
          const err = new Error("IN_PROGRESS");
          err.code = "IN_PROGRESS";
          throw err;
        }

        if (d.ownerPid === ownerPid) {
          tx.update(lockRef, {
            expiresAt: newExp,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          acquired = true;
          return;
        }

        if (expMs <= now) {
          tx.update(lockRef, {
            ownerPid,
            requestId,
            expiresAt: newExp,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(idempotencyKey && (!d.reservedKey || d.reservedKey === idempotencyKey || resExpMs <= now) ?
              {
                reservedKey: idempotencyKey,
                reservedAt: nowTs,
                reservedExp: admin.firestore.Timestamp.fromMillis(now + reservationTtlMs),
              } :
              {}
            ),
          });
          acquired = true;
          return;
        }

        const err = new Error("BUSY");
        err.code = "BUSY";
        throw err;
      });

      if (acquired) {
        return {
          lockId: lockRef.id,
          alreadyCompleted: false,
          extend: async (extraMs = ttlMs) => {
            const newExp = admin.firestore.Timestamp.fromMillis(Date.now() + extraMs);
            await lockRef.update({expiresAt: newExp, updatedAt: admin.firestore.FieldValue.serverTimestamp()});
          },
          markCompleted: async (meta = {}) => {
            if (!idempotencyKey) return;
            const nowTs = admin.firestore.Timestamp.now();
            await db.runTransaction(async (tx) => {
              const s = await tx.get(lockRef);
              if (!s.exists) return;
              const d = s.data() || {};
              const completed = pruneCompletedMap(d.completed || {}, Date.now());
              completed[idempotencyKey] = nowTs;
              tx.update(lockRef, {
                completed,
                reservedKey: admin.firestore.FieldValue.delete(),
                reservedAt: admin.firestore.FieldValue.delete(),
                reservedExp: admin.firestore.FieldValue.delete(),
                lastMeta: meta || null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            });
          },
          // 🔧 NEW: let callers clear reservation on error to avoid “stuck IN_PROGRESS”
          clearReservation: async () => {
            await db.runTransaction(async (tx) => {
              const s = await tx.get(lockRef);
              if (!s.exists) return;
              const d = s.data() || {};
              if (d.ownerPid !== ownerPid) return; // only the holder can clear
              tx.update(lockRef, {
                reservedKey: admin.firestore.FieldValue.delete(),
                reservedAt: admin.firestore.FieldValue.delete(),
                reservedExp: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            });
          },
          release: async (preserveReservation = false) => {
            try {
              await db.runTransaction(async (tx) => {
                const s = await tx.get(lockRef);
                if (!s.exists) return;
                if (s.data()?.ownerPid === ownerPid) {
                  const clear = {
                    ownerPid: admin.firestore.FieldValue.delete(),
                    requestId: admin.firestore.FieldValue.delete(),
                    expiresAt: admin.firestore.FieldValue.delete(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  };
                  if (!preserveReservation) {
                    clear.reservedKey = admin.firestore.FieldValue.delete();
                    clear.reservedAt = admin.firestore.FieldValue.delete();
                    clear.reservedExp = admin.firestore.FieldValue.delete();
                  }
                  tx.update(lockRef, clear);
                }
              });
            } catch (e) {
              console.warn("mutex release warning:", e.message || e);
            }
          },
        };
      }
    } catch (e) {
      if (e.code === "ALREADY_DONE") {
        return {
          lockId: lockRef.id,
          alreadyCompleted: true,
          extend: async () => {},
          markCompleted: async () => {},
          clearReservation: async () => {},
          release: async () => {},
        };
      }
      if (e.code === "BUSY" || e.code === "IN_PROGRESS") {
        // If we’ve run out of time, break; otherwise backoff (at least 1ms)
        if (Date.now() >= deadline) break;
        const backoff = Math.max(1, Number(retryEveryMs) || 0);
        if (backoff > 0) await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw e;
    }
  }

  const err = new Error("LOCK_BUSY");
  err.code = "LOCK_BUSY";
  throw err;
}

async function withUserMutex(uid, requestId, handler, opts = {}) {
  let lock;
  try {
    lock = await acquireUserMutexOrThrow({
      uid,
      scope: opts.scope || "global",
      requestId,
      idempotencyKey: opts.idempotencyKey || requestId,
      ttlMs: opts.ttlMs ?? MUTEX.ttlMs,
      maxWaitMs: opts.maxWaitMs ?? MUTEX.waitMs,
      retryEveryMs: opts.retryEveryMs ?? MUTEX.retryEveryMs,
      reservationTtlMs: opts.reservationTtlMs, // <— add this line
    });
  } catch (e) {
    e.code = "LOCK_BUSY";
    throw e;
  }

  if (lock.alreadyCompleted) {
    return ok({success: true, status: "completed", requestId});
  }

  try {
    const out = await handler(lock);
    // For async/background flows, caller can defer completion and let a job finalize the reservation.
    if (!opts.deferCompletion) {
      await lock.markCompleted(opts.completedMeta || {});
    }
    return out;
  } finally {
    try {
      await lock.release(Boolean(opts.deferCompletion)); // preserveReservation = true for deferred flows
    } catch (e) {
      console.warn("mutex release warn:", e?.message || e);
    }
  }
}

/**
 * Finalize a reservation from a background worker (no ownership required).
 * Clears reservedKey and records completion for the given idempotency key.
 */
async function finalizeUserMutex({uid, scope = "global", idempotencyKey, meta = {}}) {
  if (!uid || !idempotencyKey) return;
  const lockRef = db.collection("user_locks").doc(`${uid.toLowerCase()}:${scope}`);
  const nowTs = admin.firestore.Timestamp.now();
  await db.runTransaction(async (tx) => {
    const s = await tx.get(lockRef);
    if (!s.exists) return;
    const d = s.data() || {};
    const completed = (() => {
      const entries = Object.entries(d.completed || {});
      // keep last 50 w/ 24h TTL – same policy as acquireUserMutexOrThrow
      const fresh = entries
          .filter(([, ts]) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : ts) >= (Date.now() - (24 * 60 * 60 * 1000)))
          .sort((a, b) => ((b[1]?.toMillis?.() ?? b[1]) - (a[1]?.toMillis?.() ?? a[1])));
      const trimmed = fresh.slice(0, 49);
      return Object.fromEntries(trimmed);
    })();
    completed[idempotencyKey] = nowTs;
    tx.update(lockRef, {
      completed,
      reservedKey: admin.firestore.FieldValue.delete(),
      reservedAt: admin.firestore.FieldValue.delete(),
      reservedExp: admin.firestore.FieldValue.delete(),
      lastMeta: meta || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

exports.getWalletAuthChallenge = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        const raw = (req.query.address || req.body?.address || "").toString();
        const address = normalizeAddr(raw); // ronin: → 0x, lowercase
        if (!ethers.isAddress(address)) {
          return res.status(400).json({error: "BAD_ADDRESS"});
        }

        const token = makeChallengeToken(address);
        const message = `Login to AOF: ${token}`; // sign EXACTLY this
        return res.status(200).json({token, message});
      } catch (e) {
        console.error(e);
        return res.status(500).send("Failed to create challenge");
      }
    }));

/**
 * Ensure the Firebase Auth user matches the target wallet address.
 * @param {object} decoded - decoded Firebase token
 * @param {string} addr - wallet address to compare
 */
function assertAuthMatches(decoded, addr) {
  if (!decoded?.uid || !ethers.isAddress(addr)) {
    throw new Error("Bad user or address");
  }
  if (decoded.uid.toLowerCase() !== addr.toLowerCase()) {
    throw new Error("Permission denied: auth/user mismatch.");
  }
}

exports.updateBalancesAfterDeposit = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        // --- 1) Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) {
          return res.status(401).send(
              "Unauthorized: No token provided.");
        }
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send(
              "Unauthorized: Invalid token.");
        }

        // --- 2) Payload ---
        const {
          userAddress,
          tokenIds,
          amounts, // base-unit strings
          humanAmounts, // optional, for sanity display
          ronAmount, // optional, human (e.g., "0.5")
          depositTxHash, // optional but recommended for verification
          ronTxHash, // optional: tx that sent native RON to
          //  your contract (if you still use depositRonForGas)
          nonce, // optional: for idempotency
        } = req.body?.data || {};

        if (!userAddress || !Array.isArray(tokenIds) ||
       !Array.isArray(amounts) || tokenIds.length !== amounts.length) {
          return err(400, "Missing or invalid parameters.");
        }
        // Caller must be the same user
        if ((decoded.uid || "").toLowerCase() !== String(
            userAddress).toLowerCase()) {
          return res.status(403).send(
              "Permission denied: You can only update your own balances.");
        }

        // --- 3) Idempotency guard doc ---
        const requestId = makeRequestId({nonce, depositTxHash,
          userAddress, tokenIds, amounts, ronAmount});
        const result = await withUserMutex(userAddress, requestId,
            async () => {
              const depRef = db.collection("deposits").doc(requestId);
              const userRef = db.collection("users").doc(userAddress.toLowerCase());

              // If strict, require tx hashes
              if (STRICT_REQUIRE_TX && (!depositTxHash && !ronTxHash) &&
         (tokenIds.length > 0 || Number(ronAmount || 0) > 0)) {
                return err(400, "Transaction hash required for verification.");
              }

              // --- 4) On-chain verification (if tx hashes supplied) ---
              // a) Verify ERC1155 deposit tx actually moved
              // tokens from user -> CORE_ADDR
              const chainDeposit = {ids: [], values: []};
              if (depositTxHash) {
                const rc = await provider.getTransactionReceipt(
                    depositTxHash);
                if (!rc || rc.status !== 1) {
                  return err(400,
                      "Deposit transaction not found or failed.");
                }
                if ((rc.to || "").toLowerCase() !==
                   CORE_ADDR.toLowerCase()) {
                  // It might be a router/wallet calling core; allow,
                  //  but ensure logs are from CORE_ADDR
                  // We rely on logs’ address to be CORE_ADDR below.
                }

                // Parse ERC1155 events emitted by the core
                const moved = new Map(); // id -> BigInt total moved
                for (const log of rc.logs || []) {
                  if ((log.address || "").toLowerCase() !==
           CORE_ADDR.toLowerCase()) continue;
                  let parsed;
                  try {
                    parsed = ERC1155_IFACE.parseLog(log);
                  } catch {
                    continue;
                  }
                  if (parsed.name !== "TransferSingle" &&
             parsed.name !== "TransferBatch") continue;

                  const from = parsed.args[1].toLowerCase();
                  const to = parsed.args[2].toLowerCase();
                  if (from !== userAddress.toLowerCase()) continue;
                  if (to !== CORE_ADDR.toLowerCase()) continue;

                  if (parsed.name === "TransferSingle") {
                    const id = Number(parsed.args[3]);
                    const v = BigInt(parsed.args[4].toString());
                    moved.set(id, (moved.get(id) || 0n) + v);
                  } else {
                    const ids = parsed.args[3].map((x) => Number(x));
                    const vs = parsed.args[4].map(
                        (x) => BigInt(x.toString()));
                    for (let i = 0; i < ids.length; i++) {
                      moved.set(ids[i], (moved.get(ids[i]) || 0n) + vs[i]);
                    }
                  }
                }

                // Require at least the requested amounts were
                // moved (>=, not exactly, to allow extra)
                const requested = new Map();
                for (let i = 0; i < tokenIds.length; i++) {
                  const id = Number(tokenIds[i]);
                  const amt = BigInt(String(amounts[i]));
                  if (amt > 0n) {
                    requested.set(id, (
                      requested.get(id) || 0n) + amt);
                  }
                }
                for (const [id, reqAmt] of requested.entries()) {
                  const movedAmt = moved.get(id) || 0n;
                  if (movedAmt < reqAmt) {
                    return err(400,
                        `On-chain verification failed for id ${id}:` +
              ` moved ${movedAmt} < requested ${reqAmt}.`);
                  }
                }

                // For logging / audit
                chainDeposit.ids = Array.from(
                    new Set([...requested.keys()]));
                chainDeposit.values= chainDeposit.ids.map(
                    (id) => (requested.get(id) || 0n).toString());
              }

              // b) Verify RON deposit (if you still use
              //  depositRonForGas and ronTxHash supplied)
              if (ronTxHash && Number(ronAmount || 0) > 0) {
                const rc = await provider.getTransactionReceipt(ronTxHash);
                if (!rc || rc.status !== 1) {
                  return err(400,
                      "RON transaction not found or failed.");
                }
                const tx = await provider.getTransaction(ronTxHash);
                if (!tx) {
                  return err(400,
                      "RON transaction not found.");
                }

                const toAddr = (tx.to || "").toLowerCase();
                const fromAddr = (tx.from || "").toLowerCase();
                const hot = wallet.address.toLowerCase();
                const core = CORE_ADDR.toLowerCase();

                // Accept deposits to EITHER the core contract
                //  OR the hot wallet
                if (toAddr !== hot && toAddr !== core) {
                  return err(400,
                      "RON tx not sent to an approved address.");
                }
                if (fromAddr !== userAddress.toLowerCase()) {
                  return err(400,
                      "RON tx sender mismatch.");
                }

                const expected = ethers.parseEther(String(ronAmount));
                if (tx.value < expected) {
                  return err(400,
                      "RON tx value less than declared ronAmount.");
                }
                // (Optional) method sanity: call data selector
                //  equals depositRonForGas()
                if (tx.data && tx.data !== "0x") {
                  const selector = tx.data.slice(0, 10); // 4-byte
                  const expectedSelector = ERC1155_IFACE.getFunction(
                      "depositRonForGas").selector;
                  if (selector !== expectedSelector) {
                    console.warn(
                        "RON tx did not call depositRonForGas();" +
              " continuing because value matched.");
                  }
                }
              } else if (STRICT_REQUIRE_TX && Number(
                  ronAmount || 0) > 0) {
                return err(400,
                    "RON tx hash required in strict mode.");
              }

              // --- 5) Convert base -> human using on-chain decimals ---
              const core = new ethers.Contract(CORE_ADDR,
                  CORE_ABI, provider);
              const ids = tokenIds.map((x) => Number(x));
              const decsRaw = await Promise.all(ids.map((id) => getCoreDecimals(core, id)));
              const decs = decsRaw.map((d) => Number(d));

              const increments = {}; // field -> Number
              for (let i = 0; i < ids.length; i++) {
                const id = ids[i];
                const field = TOKEN_ID_TO_FIELD[id];
                if (!field) {
                  return err(400,
                      `Invalid tokenId: ${id}`);
                }

                let base;
                try {
                  base = BigInt(String(amounts[i]));
                } catch {
                  return err(400,
                      `Bad base-unit amount for id ${id}`);
                }
                if (base <= 0n) continue;

                const dec = decs[i] ?? 18;
                const humanStr = ethers.formatUnits(base, dec);
                const humanNum = Number(humanStr);
                if (humanNum > 1e9) {
                  return err(400,
                      `Amount too large for id ${id}`);
                }
                if (!Number.isFinite(humanNum)) {
                  return err(400,
                      `Bad converted amount for id ${id}`);
                }
                if (Math.abs(humanNum) > Number.MAX_SAFE_INTEGER) {
                  return err(400,
                      `Amount too large for `+
                        `Firestore numeric field (id ${id}).`);
                }
                increments[field] = (increments[field] || 0) + humanNum;

                // Optional mismatch warning vs client humanAmounts
                if (Array.isArray(humanAmounts) &&
        humanAmounts.length === amounts.length) {
                  const clientHuman = Number(humanAmounts[i]);
                  const diff = Math.abs((clientHuman || 0) - humanNum);
                  if (diff > 1e-9) {
                    console.warn(
                        `Human mismatch for id ${id}: ` +
            `client=${clientHuman} server=${humanNum}`);
                  }
                }
              }

              // RON credit
              let ronNum = 0;
              if (ronAmount && Number(ronAmount) > 0) {
                ronNum = Number(ronAmount);
                if (!Number.isFinite(ronNum) || ronNum < 0) {
                  return err(400, "Invalid ronAmount.");
                }
              }
              // If nothing to do, short-circuit
              if (Object.keys(increments).length === 0 && ronNum === 0) {
                return ok({success: true, message:
           "No balances to update."});
              }

              // --- 6) TRANSACTION: idempotent write ---
              const result = await db.runTransaction(async (tx) => {
                const depSnap = await tx.get(depRef);
                if (depSnap.exists) {
                  const st = depSnap.data()?.status;
                  if (st === "completed") {
                    return {alreadyDone: true, record: depSnap.data()};
                  }
                  // allow re-entrance from 'reserved' to finalize below
                } else {
                  // mark reserved so concurrent calls don't double-apply
                  tx.set(depRef, {
                    userAddress,
                    tokenIds,
                    amounts,
                    humanAmounts: humanAmounts || null,
                    ronAmount: ronAmount || null,
                    depositTxHash: depositTxHash || null,
                    ronTxHash: ronTxHash || null,
                    status: "reserved",
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    chainDeposit, // for audit
                  });
                }

                // Apply increments
                const updates = {};
                for (const [field, inc] of Object.entries(increments)) {
                  updates[field] = FieldValue.increment(inc);
                }
                if (Object.keys(updates).length) {
                  tx.update(userRef, updates);
                }
                // RON (micros) dual-write for migration
                if (ronNum > 0) {
                  const creditMicros = ronToMicros(ronNum);
                  incRonTank(tx, userRef, creditMicros);
                }
                tx.update(depRef, {status: "completed",
                  completedAt: admin.firestore.FieldValue.serverTimestamp()});

                return {alreadyDone: false, updates, requestId};
              });

              if (result.alreadyDone) {
                return ok({success: true,
                  status: "completed", requestId,
                  message: "Already applied."});
              }

              return ok({success: true,
                status: "completed",
                requestId,
                applied: {...increments, ...(
          ronNum > 0 ? {gasTankRon: ronNum} : {})}});
            });

        return res.status(result.status).json(result.body);
      } catch (e) {
        if (e.code === "LOCK_BUSY") {
          res.set(
              "Retry-After", "2"); return res.status(423).json(
              {busy: true,
                message:
                   "Another action is in progress. Try again shortly."});
        }
        console.error("updateBalancesAfterDeposit error:", e);
        return res.status(500).send(e.message ||
         "Failed to update user balances.");
      }
    }));

// ===== Helper used above: consume nonce inside a transaction =====
async function consumeNonceOrFailInTx(tx, userAddrLower, kind, nonceStr) {
  const nonceRef = db.collection("nonces").doc(`${userAddrLower}_${kind}_${nonceStr}`);
  const n = await tx.get(nonceRef);
  if (n.exists) throw Object.assign(new Error("Replay detected (nonce already used)."), {code: "NONCE_USED"});
  tx.set(nonceRef, {usedAt: Date.now(), kind, user: userAddrLower});
}

exports.mintNFTTool = onRequest(
    {region: "us-central1", timeoutSeconds: 300, memory: "512MiB"},
    withKillSwitchHttp(async (req, res) => {
      try {
      // ---------- AUTH ----------
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized.");
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Invalid token.");
        }

        // ---------- INPUTS ----------
        const {userAddress, toolType, rarity, nonce, signature} = req.body?.data || {};
        if (!userAddress || !toolType || !rarity || !nonce || !signature) {
          return err(400, "Missing or invalid parameters.");
        }
        if (decoded.uid.toLowerCase() !== String(userAddress).toLowerCase()) {
          return res.status(403).send("Permission denied: auth/user mismatch.");
        }

        // ---------- SIG CHECK ----------
        const payloadForSig = {userAddress, toolType, rarity, nonce};
        const message = `Mint tool: ${JSON.stringify(payloadForSig)}`;
        let recovered;
        try {
          recovered = ethers.verifyMessage(message, signature);
        } catch {
          return res.status(401).send("Invalid signature.");
        }
        if (recovered.toLowerCase() !== String(userAddress).toLowerCase()) {
          return res.status(401).send("Invalid signature.");
        }

        // ---------- Helpers ----------
        const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
        const BASE_RESOURCE_ORDER = ["food", "wood", "stone"]; // skins are NFT burns
        const SKIN_TOOLTYPE_ALIASES = ["Animal_Skin", "Animal Skin", "Material"]; // exact stored values (no normalization for queries)

        const userAddressLower = String(userAddress).toLowerCase();
        const looksLikeTent = (s) =>
          String(s || "").toLowerCase().replace(/[_\s-]+/g, " ").includes("tent"); // detection only (no DB filter)
        const isTent = looksLikeTent(toolType);

        // ---------- IDEMPOTENT REQUEST ----------
        const requestId = stableRequestIdFrom({
          op: "mintNFTTool",
          userAddress: userAddressLower,
          toolType,
          rarity,
          nonce,
        });
        const jobRef = db.collection("mint_jobs").doc(requestId);

        // Fast idempotency short-circuit
        {
          const existing = await jobRef.get();
          if (existing.exists) {
            const j = existing.data() || {};
            if (["reserved", "pending", "processing"].includes(j.status)) {
              return res.status(202).json({
                success: true,
                status: j.status,
                requestId,
                txHash: j.txHash || null,
                message: "Mint already enqueued; waiting for confirmation.",
              });
            }
            if (j.status === "completed") {
              return res.status(200).json({
                success: true,
                status: "completed",
                requestId,
                txHash: j.txHash || null,
              });
            }
          }
        }

        const result = await withUserMutex(
            userAddressLower,
            requestId,
            async (lock) => {
              const costDocId = `${String(toolType).toLowerCase()}_${String(rarity).toLowerCase()}`;
              const userDocRef = db.collection("users").doc(userAddressLower);
              const costDocRef = db.collection("craft_cost_tools").doc(costDocId.toLowerCase());

              const enqueued = false;

              try {
                // ---------- RESERVE (READS then WRITES in a single txn) ----------
                let reserved = {
                  dynamic: {food: 0, wood: 0, stone: 0},
                  burnTokenIds: [], // final chosen set for ownerMintWithBurn (set later)
                  burnedToolDocIds: [], // staked_nfts docIds to delete (skins + chosen prev)
                  skinsBurnIds: [], // skin token ids (burned off-chain; contract only validates prev tool)
                  tentBurn: null, // {prevCostId, slotsLost, boostLost, skinsCount}
                  prevCandidates: [], // <— NEW: previous-rarity candidate tokenIds (no toolType filter)
                  prevIdToDocId: {}, // <— NEW: map tokenId -> staked_nfts docId
                };

                await db.runTransaction(async (tx) => {
                  const MAX_SKIN_BUFFER = 5;
                  const skinIdToDocId = {}; // tokenId -> staked_nfts docId

                  // READS
                  const [userSnap, costSnap] = await Promise.all([tx.get(userDocRef), tx.get(costDocRef)]);
                  if (!userSnap.exists) throw new Error("User data not found.");
                  if (!costSnap.exists) throw new Error("Crafting cost not found.");

                  const user = userSnap.data() || {};
                  const cost = costSnap.data() || {};

                  // skins cost (must be >0 for tents)
                  const skinsNeeded = isTent ? Number(cost.skins ?? cost.skin ?? cost.skinsCount ?? 0) : 0;
                  if (isTent && (!Number.isFinite(skinsNeeded) || skinsNeeded <= 0)) {
                    throw new Error("Tent crafting misconfigured: skins cost must be > 0.");
                  }

                  const mintedCount = Number((cost.minted ?? cost.mintedCount) || 0);
                  const mult =
                {common: 1, uncommon: 2, rare: 4, epic: 8, legendary: 16}[
                    String(rarity).toLowerCase()
                ] || 1;

                  // dynamic resources: wood/stone scale; food constant
                  const dynamic = {
                    food: Number(cost.food || 0),
                    wood: Number((cost.wood || 0) + mintedCount * mult),
                    stone: Number((cost.stone || 0) + mintedCount * mult),
                  };

                  // basic requirements
                  if (Number(user.energy || 0) < MIN_ENERGY_TO_CRAFT) {
                    throw new Error("Insufficient energy.");
                  }
                  if (readRonTankMicros(user) < FEE_PER_CRAFT_RON_MICROS) {
                    throw new Error("Insufficient RON in game wallet for fee.");
                  }
                  for (const r of BASE_RESOURCE_ORDER) {
                    const need = Number(dynamic[r] || 0);
                    if (need > 0 && Number(user[r] || 0) < need) {
                      throw new Error(`Insufficient ${r}.`);
                    }
                  }

                  // ----- Previous-rarity candidates (NO toolType filter) -----
                  const rarityIndex = RARITY_ORDER.indexOf(String(rarity));
                  let prevTentCostId = null;
                  let slotsToLose = 0;
                  let boostToLose = 0;

                  const prevCandidates = [];
                  const prevIdToDocId = {};

                  if (rarityIndex > 0) {
                    const requiredRarity = RARITY_ORDER[rarityIndex - 1];

                    const burnQ = db
                        .collection("staked_nfts")
                        .where("userAddress", "==", userAddressLower)
                        .where("collectionAddress", "==", String(contractAddressTools))
                        .where("rarity", "==", requiredRarity)
                        .where("durability", "==", 20)
                        .where("is_mining", "==", 0)
                        .limit(20); // collect a handful; we’ll match type on-chain

                    const burnSnap = await tx.get(burnQ);
                    if (burnSnap.empty) {
                      throw new Error(
                          `Requires 1 ${requiredRarity} ${toolType.replace(/_/g, " ")} to burn.`,
                      );
                    }
                    burnSnap.docs.forEach((d) => {
                      const data = d.data() || {};
                      const tid = Number(data.tokenId);
                      if (Number.isFinite(tid)) {
                        prevCandidates.push(tid);
                        prevIdToDocId[tid] = d.id;
                      }
                    });

                    // Tent capacity/boost impact (use the requested toolType & prev rarity)
                    if (isTent) {
                      prevTentCostId = `${String(toolType).toLowerCase()}_${String(requiredRarity).toLowerCase()}`;
                      const prevCostSnap = await tx.get(
                          db.collection("craft_cost_tools").doc(prevTentCostId.toLowerCase()),
                      );
                      const prevCfg = prevCostSnap.exists ? prevCostSnap.data() || {} : {};

                      const _slots =
                    Number(prevCfg.slots ?? prevCfg.capacity ?? prevCfg.villagerSlots ?? 0) || 0;
                      const _boost = Number(prevCfg.boost ?? prevCfg.miningBoost ?? 0) || 0;

                      slotsToLose = _slots;
                      boostToLose = _boost;

                      const freeNow = Number(user.villagers_available ?? user.villagersFree ?? 0);
                      if (freeNow < slotsToLose) {
                        throw new Error(
                            `Free up at least ${slotsToLose} villagers before upgrading your tent (capacity check).`,
                        );
                      }
                    }
                  }

                  // ----- Skins for tents (alias-aware, exact literals only) -----
                  const skinsBurnIds = [];
                  if (isTent && skinsNeeded > 0) {
                    let skinsDocs = [];
                    try {
                      const qIn = db
                          .collection("staked_nfts")
                          .where("userAddress", "==", userAddressLower)
                          .where("collectionAddress", "==", String(contractAddressTools))
                          .where("durability", "==", 20)
                          .where("is_mining", "==", 0)
                          .where("toolType", "in", SKIN_TOOLTYPE_ALIASES)
                          .limit(skinsNeeded + MAX_SKIN_BUFFER);
                      const snap = await tx.get(qIn);
                      skinsDocs = snap.docs;
                    } catch {
                      // Fallback: multiple equality queries
                      for (const alias of SKIN_TOOLTYPE_ALIASES) {
                        if (skinsDocs.length >= skinsNeeded) break;
                        const qEq = db
                            .collection("staked_nfts")
                            .where("userAddress", "==", userAddressLower)
                            .where("collectionAddress", "==", String(contractAddressTools))
                            .where("toolType", "==", alias)
                            .where("durability", "==", 20)
                            .where("is_mining", "==", 0)
                            .limit((skinsNeeded + MAX_SKIN_BUFFER) - skinsDocs.length);
                        const snap = await tx.get(qEq);
                        skinsDocs = skinsDocs.concat(snap.docs);
                      }
                    }

                    if (skinsDocs.length < skinsNeeded) {
                      throw new Error(`Requires ${skinsNeeded} Animal Skin(s) staked to burn.`);
                    }
                    skinsDocs.forEach((d, idx) => {
                      const data = d.data() || {};
                      const tid = Number(data.tokenId);
                      if (Number.isFinite(tid)) {
                        skinIdToDocId[tid] = d.id;
                        if (idx < skinsNeeded) {
                          skinsBurnIds.push(tid);
                        } else {
                          // optional: track extras if you want adaptive retry
                        }
                      }
                    });
                  }

                  if (isTent && skinsNeeded > 0 && skinsBurnIds.length < skinsNeeded) {
                    throw new Error(
                        `Internal error: missing ${skinsNeeded - skinsBurnIds.length} skin burn id(s).`,
                    );
                  }

                  // consume nonce (anti-replay) — FIRST WRITE
                  await consumeNonceOrFailInTx(tx, userAddressLower, "mint_tool", String(nonce));

                  // lock numeric resources + fee
                  tx.update(userDocRef, {
                    "locks.crafting.food": admin.firestore.FieldValue.increment(Number(dynamic.food || 0)),
                    "locks.crafting.wood": admin.firestore.FieldValue.increment(Number(dynamic.wood || 0)),
                    "locks.crafting.stone": admin.firestore.FieldValue.increment(Number(dynamic.stone || 0)),
                    "locks.crafting.ronMicros": admin.firestore.FieldValue.increment(FEE_PER_CRAFT_RON_MICROS),
                  });

                  // write job (reserved)
                  tx.set(
                      jobRef,
                      {
                        status: "reserved",
                        userAddress: userAddressLower,
                        toolType: toolType.toLowerCase(), // display keying; TX uses original 'toolType'
                        rarity,
                        burnTokenIds: [], // set later after pre-sim chooses
                        burnedToolDocIds: Object.values(skinIdToDocId), // skins docIds now; prev docId added later
                        skinsBurnIds,
                        ownerUid: userAddressLower,
                        dynamicCostData: {
                          food: Number(dynamic.food || 0),
                          wood: Number(dynamic.wood || 0),
                          stone: Number(dynamic.stone || 0),
                          skinsNeeded: isTent ? Number(skinsNeeded) : 0,
                        },
                        tentBurn: isTent ?
                    {
                      prevCostId: prevTentCostId,
                      slotsLost: slotsToLose,
                      boostLost: boostToLose || 0,
                      skinsCount: Number(skinsNeeded),
                    } :
                    null,
                        prevCandidates, // <— store candidates (ids only)
                        prevIdToDocId, // <— store mapping for later deletion
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        attempts: 0,
                      },
                      {merge: false},
                  );

                  // pass back (non-transaction state)
                  reserved = {
                    dynamic,
                    burnTokenIds: [], // not set yet
                    burnedToolDocIds: Object.values(skinIdToDocId),
                    skinsBurnIds,
                    tentBurn: isTent ?
                  {
                    prevCostId: prevTentCostId,
                    slotsLost: slotsToLose,
                    boostLost: boostToLose || 0,
                    skinsCount: Number(skinsNeeded),
                  } :
                  null,
                    prevCandidates,
                    prevIdToDocId,
                  };
                });

                // ---------- HARD SANITY: tents must include skin burn ids ----------
                if (isTent && (reserved?.tentBurn?.skinsCount || 0) > 0) {
                  const haveSkins = Number(reserved?.skinsBurnIds?.length || 0);
                  if (haveSkins < Number(reserved.tentBurn.skinsCount)) {
                    throw new Error("Internal error: skin tokenIds missing for tent craft.");
                  }
                }

                // ---------- CHAIN PRE-SIM (alias-aware: pivot to on-chain literal) ----------
                const c1155 = new ethers.Contract(contractAddressTools, TOOLNFT_META_ABI, provider);

                // family normalizer: lower, remove _-/space, and treat skin_tent == tent
                const norm = (s) => String(s || "").toLowerCase().replace(/[_\s-]+/g, "");
                const normFamily = (s) => norm(s).replace(/^skin(?=tent)/, "");
                const sameFamily = (a, b) => normFamily(a) === normFamily(b);

                const force_mint = false;
                const tryPreSimWithType = async (ids, ttype) => {
                  const bn = ids.map((x) => ethers.toBigInt(x));
                  try {
                    await contractTools.ownerMintWithBurn.staticCall(
                        userAddressLower, ttype, rarity, bn, force_mint,
                    );
                    return true;
                  } catch (e) {
                    const msg = String(e?.shortMessage || e?.message || "");
                    if (/missing revert data/i.test(msg)) {
                      await contractTools.ownerMintWithBurn.estimateGas(
                          userAddressLower, ttype, rarity, bn, force_mint,
                      );
                      return true;
                    }
                    throw e;
                  }
                };

                const rarityIdx = ["Common", "Uncommon", "Rare", "Epic", "Legendary"].indexOf(String(rarity));

                let burnIds = [];
                let toolTypeForTx = toolType; // default to the requested literal

                if (rarityIdx <= 0) {
                  // Common → nothing to burn; just mint with requested literal
                  burnIds = [];
                } else {
                  const pcs = Array.isArray(reserved.prevCandidates) ? reserved.prevCandidates : [];
                  if (pcs.length === 0) {
                    throw new Error("Mint pre-simulation failed: no previous-rarity candidates found.");
                  }

                  let lastErr = null;

                  // 1) Prefer exact literal match first (fast path)
                  for (const id of pcs) {
                    const onType = await c1155.tokenTypes(Number(id));
                    if (onType === toolType) {
                      try {
                        await tryPreSimWithType([Number(id)], onType);
                        burnIds = [Number(id)];
                        toolTypeForTx = onType; // same as requested, but explicit
                        break;
                      } catch (e) {
                        lastErr = e;
                      }
                    }
                  }

                  // 2) Fallback: alias-equivalent family (e.g., ShortBow vs Short_Bow, Tent vs Skin_Tent)
                  if (!burnIds.length) {
                    for (const id of pcs) {
                      const onType = await c1155.tokenTypes(Number(id));
                      if (sameFamily(onType, toolType)) {
                        try {
                          // IMPORTANT: use the candidate’s on-chain literal for the TX
                          await tryPreSimWithType([Number(id)], onType);
                          burnIds = [Number(id)];
                          toolTypeForTx = onType;
                          break;
                        } catch (e) {
                          lastErr = e;
                        }
                      }
                    }
                  }

                  if (!burnIds.length) {
                    const reason = String(lastErr?.reason || lastErr?.shortMessage || lastErr?.message || "unknown");
                    throw new Error(`Mint pre-simulation failed: ${reason}`);
                  }
                }

                // Persist the exact set + the actual type we’ll pass in the tx
                const updates = {
                  burnTokenIds: burnIds,
                  toolTypeForTx, // <— NEW: record the literal we will use on-chain
                };
                // also add the chosen prev docId to burnedToolDocIds (so the finalizer deletes it)
                const chosenPrevDocId =
  burnIds.length === 1 ? reserved.prevIdToDocId?.[burnIds[0]] || null : null;
                if (chosenPrevDocId) {
                  updates.burnedToolDocIds = admin.firestore.FieldValue.arrayUnion(chosenPrevDocId);
                }
                await jobRef.update(updates);

                // ---------- On-chain sanity check using toolTypeForTx ----------
                {
                  const prevIdx = ["Common", "Uncommon", "Rare", "Epic", "Legendary"].indexOf(String(rarity)) - 1;
                  const requiredPrevRarity = prevIdx >= 0 ? ["Common", "Uncommon", "Rare", "Epic", "Legendary"][prevIdx] : null;

                  const toRarityName = (r) => {
                    if (typeof r === "string") return r;
                    const n = Number(r);
                    if (Number.isFinite(n) && RARITY_ORDER[n]) return RARITY_ORDER[n];
                    try {
                      return ethers.decodeBytes32String(r);
                    } catch {
                      return String(r);
                    }
                  };

                  if (burnIds.length) {
                    const [types, rarities] = await Promise.all([
                      Promise.all(burnIds.map((id) => c1155.tokenTypes(Number(id)))),
                      Promise.all(burnIds.map((id) => c1155.tokenRarities(Number(id)))),
                    ]);

                    let okPrev = 0;
                    const problems = [];
                    for (let i = 0; i < burnIds.length; i++) {
                      const tt = String(types[i]);
                      const rr = String(toRarityName(rarities[i]));
                      if (requiredPrevRarity && tt === String(toolTypeForTx) && rr === requiredPrevRarity) {
                        okPrev++;
                      } else {
                        problems.push({id: burnIds[i], type: tt, rarity: rr});
                      }
                    }
                    if (requiredPrevRarity && okPrev < 1) {
                      throw new Error(`Mint pre-check failed: need 1 ${RARITY_ORDER[prevIdx]} ${toolTypeForTx.replace(/_/g, " ")}.`);
                    }
                    if (problems.length) {
                      const first = problems[0];
                      throw new Error(`Mint pre-check failed: burn id ${first.id} is ${first.type}/${first.rarity}, not required type/rarity.`);
                    }
                  } else if (requiredPrevRarity) {
                    throw new Error("Mint pre-check failed: missing previous-rarity burn id.");
                  }

                  // Skins sanity remains unchanged (only for tents)
                  if (isTent) {
                    const skinsNeeded = Number(reserved?.tentBurn?.skinsCount || 0);
                    const skinIds = Array.isArray(reserved?.skinsBurnIds) ?
      reserved.skinsBurnIds.slice(0, skinsNeeded) :
      [];
                    if (skinsNeeded > 0) {
                      if (skinIds.length < skinsNeeded) {
                        throw new Error(`Mint pre-check failed: need ${skinsNeeded} Animal_Skin, got ${skinIds.length}.`);
                      }
                      const skinTypes = await Promise.all(skinIds.map((id) => c1155.tokenTypes(Number(id))));
                      const SKIN_TOOLTYPE_ALIASES = ["Animal_Skin", "Animal Skin", "Material"];
                      const isSkinAlias = (s) => SKIN_TOOLTYPE_ALIASES.includes(String(s || ""));
                      const okSkins = skinTypes.filter((t) => isSkinAlias(t)).length;
                      if (okSkins < skinsNeeded) {
                        throw new Error(`Mint pre-check failed: need ${skinsNeeded} Animal_Skin, got ${okSkins}.`);
                      }
                    }
                  }
                }

                // ---------- SEND TX using toolTypeForTx ----------
                const burnIdsBN = burnIds.map((x) => ethers.toBigInt(x));
                const txResp = await contractTools.ownerMintWithBurn(
                    userAddressLower,
                    toolTypeForTx, // <— use the actual on-chain literal we matched to the candidate
                    rarity,
                    burnIdsBN,
                    false,
                );
                const txHash = txResp.hash || "";
                await jobRef.set({status: "pending", txHash}, {merge: true});

                return {
                  status: 202,
                  body: {
                    success: true,
                    status: "pending",
                    requestId,
                    txHash,
                    message: "Mint submitted. It will be finalized after confirmation.",
                  },
                };
              } catch (innerErr) {
                if (!enqueued) {
                  try {
                    await lock.markCompleted({
                      status: "failed_pre_enqueue",
                      error: String(innerErr?.message || innerErr),
                    });
                  } catch (e) {
                    console.log(e);
                  }
                }
                throw innerErr;
              }
            },
            {
              scope: "mint",
              idempotencyKey: requestId,
              deferCompletion: true,
              reservationTtlMs: 10 * 60 * 1000,
            },
        );

        return res.status(result.status).json(result.body);
      } catch (err) {
        if (err?.code === "LOCK_BUSY") {
          try {
            const active = await db
                .collection("mint_jobs")
                .where("userAddress", "==", String(req.body?.data?.userAddress || "").toLowerCase())
                .where("status", "in", ["reserved", "pending", "processing"])
                .orderBy("createdAt", "desc")
                .limit(1)
                .get();
            if (!active.empty) {
              const j = active.docs[0].data() || {};
              return res.status(202).json({
                success: true,
                status: j.status || "pending",
                requestId: active.docs[0].id,
                txHash: j.txHash || null,
                message: "Another mint is already in progress for this account.",
              });
            }
          } catch (e) {
            console.log(e);
          }
          res.set("Retry-After", "5");
          return res
              .status(423)
              .json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("mintNFTTool error:", err);
        return res.status(500).send(err.message || "Internal error.");
      }
    }),
);

exports.pokeRerollJob = onRequest(
    {region: "us-central1", timeoutSeconds: 300, memory: "512MiB"},
    withKillSwitchHttp(async (req, res) => {
      try {
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized.");
        await admin.auth().verifyIdToken(idToken);

        const {requestId} = req.body?.data || {};
        if (!requestId) return err(400, "Missing requestId.");

        const jobRef = db.collection("reroll_jobs").doc(requestId);
        const snap = await jobRef.get();
        if (!snap.exists) return res.status(404).send("Job not found.");

        const job = snap.data() || {};
        if (job.status === "completed") {
          return res.status(200).json({success: true, status: "completed"});
        }

        const rc = await provider
            .waitForTransaction(String(job.txHash), 1, 5_000)
            .catch(() => null);

        if (!rc || rc.status !== 1) {
          return res
              .status(200)
              .json({success: true, status: job.status, note: "tx not confirmed yet"});
        }

        await finalizeRerollJob(jobRef, job);
        const done = await jobRef.get();
        return res.status(200).json({success: true, status: done.data()?.status || "unknown"});
      } catch (err) {
        console.error("pokeRerollJob error:", err);
        return res.status(500).send(err.message || "Internal error.");
      }
    }),
);


async function finalizeRerollJob(jobRef, jobData) {
  const FieldValue = admin.firestore.FieldValue;
  const job = jobData || (await jobRef.get()).data() || {};

  // Only process active jobs
  if (!job.status || !["pending", "processing"].includes(job.status)) return;

  const userLower = String(job.userAddress || "").toLowerCase();
  const userRef = db.collection("users").doc(userLower);

  // Idempotency markers
  const applyRef = db.collection("apply_markers").doc(`reroll:${jobRef.id}`);
  const unreserveRef = db.collection("apply_markers").doc(`reroll_unreserve:${jobRef.id}`);

  const burnDocIds = Array.isArray(job.burnedToolDocIds) ? job.burnedToolDocIds : [];

  const FOOD_PER_REROLL = Number(job?.dynamicCostData?.food || 0);
  const RON_MICROS_PER_REROLL = Number(job?.dynamicCostData?.ronMicros || 0);

  // Prefer mint hash (2-tx flow). Fallback to legacy txHash.
  const txHash = String(job.mintTxHash || job.txHash || "");
  if (!txHash) {
    await jobRef.set({status: "failed", lastError: "Missing txHash (mint)"}, {merge: true});
    return;
  }

  // Mark attempt
  try {
    await jobRef.set(
        {
          status: "processing",
          attempts: FieldValue.increment(1),
          lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );
  } catch {
    // If we can't bump attempts, just continue
  }

  // Wait for the mint tx (the burn was already mined in the worker)
  const rc = await provider.getTransactionReceipt(txHash).catch(() => null);

  if (!rc) {
    await jobRef.set({
      status: "pending",
      lastError: "mint not confirmed yet",
      nextCheckAt: admin.firestore.Timestamp.fromMillis(Date.now() + 15_000),
    }, {merge: true});
    return; // let the next sweep pick it up
  }

  // Mint failed → unreserve the locked balances, mark failed
  if (!rc || rc.status !== 1) {
    await db.runTransaction(async (tx) => {
      const [mark, userSnap] = await Promise.all([tx.get(unreserveRef), tx.get(userRef)]);
      if (mark.exists) return; // already unreserved

      if (!userSnap.exists) throw new Error("User not found (unreserve).");

      tx.update(userRef, {
        "locks.reroll.food": FieldValue.increment(-FOOD_PER_REROLL),
        "locks.reroll.ronMicros": FieldValue.increment(-RON_MICROS_PER_REROLL),
      });

      tx.set(unreserveRef, {
        userAddress: userLower,
        jobId: jobRef.id,
        type: "reroll_unreserve",
        appliedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await jobRef.set(
        {
          status: "failed",
          lastError: `Reroll tx failed: ${txHash}`,
          finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );

    try {
      await finalizeUserMutex({
        uid: userLower,
        scope: "reroll",
        idempotencyKey: jobRef.id,
        meta: {status: "finalized", jobStatus: "failed"},
      });
    } catch (e) {
      console.log(e);
    }
    return;
  }

  // Apply Firestore effects exactly once
  let alreadyApplied = false;
  await db.runTransaction(async (tx) => {
    const [applySnap, userSnap] = await Promise.all([tx.get(applyRef), tx.get(userRef)]);

    if (applySnap.exists) {
      alreadyApplied = true; return;
    }
    if (!userSnap.exists) throw new Error("User not found.");

    const u = userSnap.data() || {};
    if ((u.food ?? 0) < FOOD_PER_REROLL) throw new Error("Insufficient food on finalize (recheck).");
    if ((u.gasTankRonMicros ?? 0) < RON_MICROS_PER_REROLL) {
      throw new Error("Insufficient RON on finalize (recheck).");
    }

    // Deduct & unlock
    tx.update(userRef, {
      "food": FieldValue.increment(-FOOD_PER_REROLL),
      "locks.reroll.food": FieldValue.increment(-FOOD_PER_REROLL),

      "gasTankRonMicros": FieldValue.increment(-RON_MICROS_PER_REROLL),
      "locks.reroll.ronMicros": FieldValue.increment(-RON_MICROS_PER_REROLL),
    });
    // If you also persist a float "gasTankRon", keep it consistent:
    if (typeof microsToRon === "function") {
      tx.update(userRef, {gasTankRon: FieldValue.increment(-microsToRon(RON_MICROS_PER_REROLL))});
    }

    // Delete the burned inputs from staked_nfts
    const stakedCol = db.collection("staked_nfts");
    for (const id of burnDocIds) {
      if (typeof id === "string" && id.length > 0) {
        tx.delete(stakedCol.doc(id));
      }
    }

    // Optional analytics
    if (job.toolTypeForTx && job.rarityTo) {
      const costId = `${String(job.toolTypeForTx).toLowerCase()}_${String(job.rarityTo).toLowerCase()}`;
      const costRef = db.collection("craft_cost_tools").doc(costId);
      tx.set(costRef, {minted: FieldValue.increment(1)}, {merge: true});
    }

    const RARITY_MULTIPLIERS = {Common: 1, Uncommon: 2, Rare: 4, Epic: 8, Legendary: 16};
    const mintPoints = RARITY_MULTIPLIERS[String(job.rarityTo)] || 1;
    tx.set(
        db.collection("rankings").doc(userLower),
        {mint_score: FieldValue.increment(mintPoints)},
        {merge: true},
    );

    // Mark applied
    tx.set(applyRef, {
      userAddress: userLower,
      jobId: jobRef.id,
      type: "reroll",
      appliedAt: admin.firestore.FieldValue.serverTimestamp(),
      toolType: job.toolTypeForTx || null,
      rarityFrom: job.rarityFrom || null,
      rarityTo: job.rarityTo || null,
    });
  });

  // Finish (idempotent)
  await jobRef.set(
      {
        status: "completed",
        finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
        note: alreadyApplied ? "idempotent-complete" : admin.firestore.FieldValue.delete(),
      },
      {merge: true},
  );

  try {
    await finalizeUserMutex({
      uid: userLower,
      scope: "reroll",
      idempotencyKey: jobRef.id,
      meta: {status: "finalized", jobStatus: "ok"},
    });
  } catch (e) {
    console.log(e);
  }

  return {ok: true};
}


// Robust staked doc finder for mixed casing/types in stored docs
async function findStakedDocTx(tx, {tid, userLower, userAddress, collParam, collTools}) {
  const stakedCol = db.collection("staked_nfts");

  const addrCandidates = [
    String(userLower),
    String(userAddress),
  ];

  const collCandidates = Array.from(new Set([
    String(collParam),
    String(collParam).toLowerCase(),
    String(collTools),
    String(collTools).toLowerCase(),
  ]));

  const tokenCandidates = [
    Number(tid),
    String(tid),
  ];

  for (const ua of addrCandidates) {
    for (const ca of collCandidates) {
      for (const tk of tokenCandidates) {
        const snap = await tx.get(
            stakedCol.where("userAddress", "==", ua)
                .where("collectionAddress", "==", ca)
                .where("tokenId", "==", tk)
                .limit(1),
        );
        if (!snap.empty) return snap.docs[0];
      }
    }
  }
  throw new Error(`Token ${tid} is not staked or not yours.`);
}


exports.rerollNFTTool = onRequest(
    {region: "us-central1", timeoutSeconds: 300, memory: "512MiB"},
    withKillSwitchHttp(async (req, res) => {
      try {
      // ---- AUTH ----
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized.");
        const decoded = await admin.auth().verifyIdToken(idToken).catch(() => null);
        if (!decoded) return res.status(401).send("Invalid token.");

        // ---- INPUTS ----
        const {
          userAddress,
          collectionAddress,
          tokenIds, // array of 2 ids (strings or numbers)
          tokenDocIds, // OPTIONAL: array of 2 Firestore docIds (strings)
          rarity, // Common / Uncommon / Rare / Epic  (Legendary not allowed to reroll)
          costFood, // UI-declared food (must match expected)
          feeRON, // UI-declared RON (must match expected)
          feeTxHash, // optional
          nonce,
          signature,
        } = req.body?.data || {};

        if (!userAddress || !collectionAddress || !Array.isArray(tokenIds) ||
          tokenIds.length !== 2 || !rarity || !nonce || !signature) {
          return err(400, "Missing or invalid parameters.");
        }
        if (String(decoded.uid).toLowerCase() !== String(userAddress).toLowerCase()) {
          return res.status(403).send("Permission denied: auth/user mismatch.");
        }

        // ---- COST SCHEDULE (2-burn reroll) ----
        const COSTS = {
          Common: {food: 200, ron: 3},
          Uncommon: {food: 400, ron: 10},
          Rare: {food: 800, ron: 30},
          Epic: {food: 1500, ron: 70},
        };

        const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

        if (!COSTS[rarity]) return err(400, "Invalid rarity for 2-burn reroll.");
        const expectedFood = COSTS[rarity].food;
        const expectedRon = COSTS[rarity].ron;

        if (Number(costFood) !== expectedFood) return err(400, "Bad costFood.");
        if (Number(feeRON || 0) && Math.abs(Number(feeRON) - expectedRon) > 1e-9) {
          return err(400, "Bad feeRON.");
        }

        const userLower = String(userAddress).toLowerCase();
        const collLower = String(collectionAddress).toLowerCase();
        const rarityIdx = RARITY_ORDER.indexOf(String(rarity));
        if (rarityIdx < 0) return err(400, "Invalid rarity.");
        if (rarityIdx >= RARITY_ORDER.length - 1) return err(400, "Legendary cannot be rerolled.");
        const nextRarity = RARITY_ORDER[rarityIdx + 1];

        const canonIds = [...new Set(tokenIds.map((x) => String(x)))].sort();
        if (canonIds.length !== 2) return err(400, "Provide exactly 2 unique tokenIds.");

        // ---- SIG CHECK ----
        const payloadForSig = {
          userAddress,
          collectionAddress,
          tokenIds: canonIds, // stringify already
          rarity,
          costFood: expectedFood,
          feeRON: expectedRon,
          nonce,
          ...(Array.isArray(tokenDocIds) && tokenDocIds.length === 2 ? {tokenDocIds} : {}),
        };
        const message = `Reroll tools: ${JSON.stringify(payloadForSig)}`;
        let recovered;
        try {
          recovered = ethers.verifyMessage(message, signature);
        } catch {
          return res.status(401).send("Invalid signature.");
        }
        if (recovered.toLowerCase() !== String(userAddress).toLowerCase()) {
          return res.status(401).send("Invalid signature.");
        }

        // ---- Idempotency ----
        const requestId = stableRequestIdFrom({
          op: "rerollNFTTool",
          userAddress: userLower,
          collectionAddress: collLower,
          tokenIds: canonIds,
          rarity,
          nonce,
        });
        const jobRef = db.collection("reroll_jobs").doc(requestId);

        // Fast short-circuit
        {
          const ex = await jobRef.get();
          if (ex.exists) {
            const j = ex.data() || {};
            if (["reserved", "pending", "processing"].includes(j.status)) {
              return res.status(202).json({
                success: true,
                status: j.status,
                requestId,
                txHash: j.txHash || null,
                message: "Reroll already enqueued; waiting for confirmation.",
              });
            }
            if (j.status === "completed") {
              return res.status(200).json({
                success: true,
                status: "completed",
                requestId,
                txHash: j.txHash || null,
              });
            }
          }
        }

        // ---- Reserve resources + validate inputs atomically ----
        const result = await withUserMutex(
            userLower,
            requestId,
            async (lock) => {
              const userRef = db.collection("users").doc(userLower);

              const requiredRonMicros = ronToMicros(expectedRon);

              let enqueued = false;
              const reserved = {
                burnedToolDocIds: [],
                burnTokenIds: [],
                dynamicCostData: {food: expectedFood, ronMicros: requiredRonMicros},
                toolTypeForTx: null,
                rarityFrom: rarity,
                rarityTo: nextRarity,
                feeRON: expectedRon,
                feeTxHash: feeTxHash || null,
              };

              try {
                await db.runTransaction(async (tx) => {
                  // ---------- READS FIRST ----------
                  const userSnap = await tx.get(userRef);
                  if (!userSnap.exists) throw new Error("User data not found.");
                  const user = userSnap.data() || {};

                  // Balance checks
                  if (Number(user.food || 0) < expectedFood) {
                    throw new Error("Insufficient food for reroll.");
                  }
                  if (readRonTankMicros(user) < requiredRonMicros) {
                    throw new Error("Insufficient RON in game wallet for fee.");
                  }

                  if (Number(user.energy || 0) < MIN_ENERGY_TO_CRAFT) {
                    throw new Error("Insufficient energy.");
                  }

                  // Gather the 2 staked docs
                  const foundDocs = [];
                  const docIdsFromClient = Array.isArray(tokenDocIds) ? tokenDocIds : [];

                  if (docIdsFromClient.length === 2) {
                    // Prefer exact docId reads when provided
                    const stakedCol = db.collection("staked_nfts");
                    const refs = docIdsFromClient.map((id) => stakedCol.doc(String(id)));
                    const snaps = await tx.getAll(...refs);
                    if (snaps.some((s) => !s.exists)) throw new Error("Some selected items are missing.");

                    for (const s of snaps) {
                      const x = s.data() || {};
                      if (String(x.userAddress || "").toLowerCase() !== userLower) {
                        throw new Error("Ownership mismatch.");
                      }
                      if (String(x.collectionAddress || "").toLowerCase() !== String(collectionAddress).toLowerCase()) {
                        throw new Error("Collection mismatch.");
                      }
                      if (Number(x.is_mining || 0) !== 0) throw new Error(`Token ${x.tokenId} is currently mining.`);
                      if (Number(x.durability ?? 20) !== 20) throw new Error(`Token ${x.tokenId} is not full durability.`);
                      if (String(x.rarity) !== String(rarity)) throw new Error(`Token ${x.tokenId} rarity mismatch.`);
                      foundDocs.push({docId: s.id, tokenId: Number(x.tokenId)});
                    }
                  } else {
                    // Robust finder fallback by fields
                    for (const tid of canonIds) {
                      const d = await findStakedDocTx(tx, {
                        tid,
                        userLower,
                        userAddress, // original case from input
                        collParam: collectionAddress,
                        collTools: contractAddressTools,
                      });
                      const x = d.data() || {};
                      if (Number(x.is_mining || 0) !== 0) throw new Error(`Token ${tid} is currently mining.`);
                      if (Number(x.durability ?? 20) !== 20) throw new Error(`Token ${tid} is not full durability.`);
                      if (String(x.rarity) !== String(rarity)) throw new Error(`Token ${tid} rarity mismatch.`);
                      const tok = Number.isFinite(Number(x.tokenId)) ? Number(x.tokenId) : Number(tid);
                      foundDocs.push({docId: d.id, tokenId: tok});
                    }
                  }

                  // ---------- NONCE CONSUMPTION ----------
                  await consumeNonceOrFailInTx(tx, userLower, "reroll", String(nonce));

                  // ---------- WRITES ----------
                  tx.update(userRef, {
                    "locks.reroll.food": admin.firestore.FieldValue.increment(expectedFood),
                    "locks.reroll.ronMicros": admin.firestore.FieldValue.increment(requiredRonMicros),
                  });

                  tx.set(jobRef, {
                    status: "reserved",
                    userAddress: userLower,
                    collectionAddress: collLower,
                    burnTokenIds: foundDocs.map((f) => f.tokenId),
                    burnedToolDocIds: foundDocs.map((f) => f.docId),
                    rarityFrom: rarity,
                    rarityTo: nextRarity,
                    dynamicCostData: {food: expectedFood, ronMicros: requiredRonMicros},
                    feeRON: expectedRon,
                    feeTxHash: feeTxHash || null,
                    ownerUid: userLower,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    attempts: 0,
                  });

                  reserved.burnTokenIds = foundDocs.map((f) => f.tokenId);
                  reserved.burnedToolDocIds = foundDocs.map((f) => f.docId);
                });

                enqueued = true;

                // ---- Pre-sim + send tx (outside txn) ----
                const c1155 = new ethers.Contract(contractAddressTools, TOOLNFT_META_ABI, provider);

                // Read on-chain metadata for the burn ids
                const types = await Promise.all(reserved.burnTokenIds.map((id) => c1155.tokenTypes(Number(id))));
                const rarities = await Promise.all(reserved.burnTokenIds.map((id) => c1155.tokenRarities(Number(id))));

                // Allowed families check (types may differ)
                const norm = (s) => String(s || "").toLowerCase().replace(/[_\s-]+/g, " ");
                const isAllowedFamily = (s) => /\b(axe|pick|spear)\b/i.test(norm(s));
                if (!types.every(isAllowedFamily)) throw new Error("Only Axe, Pick, or Spear tools can be rerolled.");

                // Rarity must match requested rarity for BOTH tools
                const toRarityName = (r) => {
                  if (typeof r === "string") return r;
                  try {
                    return ethers.decodeBytes32String(r);
                  } catch {
                    return String(r);
                  }
                };
                if (!rarities.every((r) => String(toRarityName(r)) === String(rarity))) {
                  throw new Error("Both tools must match the requested rarity.");
                }

                // --- Pre-sim burn (fail fast) ---
                const burnIdsBN = reserved.burnTokenIds.map((x) => ethers.toBigInt(x));
                try {
                  await contractTools.ownerBurnBatch.staticCall(userLower, burnIdsBN);
                } catch (e) {
                  const msg = String(e?.shortMessage || e?.message || "pre-sim failed");
                  throw new Error(`Reroll pre-simulation failed (burn): ${msg}`);
                }

                // --- Submit tx #1: burn the two staked items ---
                const burnTx = await contractTools.ownerBurnBatch(userLower, burnIdsBN);
                await jobRef.set(
                    {status: "processing", stage: "burn_submitted", burnTxHash: burnTx.hash},
                    {merge: true},
                );

                // Wait for burn confirmation and capture the receipt
                const burnRcpt = await burnTx.wait(1);
                await jobRef.set({stage: "burn_mined", burnBlock: burnRcpt.blockNumber}, {merge: true});

                // --- Decide the random mint type (uniform over 3 candidates) ---
                // Seed is derived from chain data so the user cannot pre-pick via nonce.
                // Add a server salt to avoid anyone precomputing offline.
                const candidates = ["Stone_Axe", "Stone_Pick", "Stone_Spear"];
                const salt = process.env.REROLL_SALT || "public-fallback-salt";
                const seedHex = ethers.keccak256(
                    ethers.solidityPacked(
                        ["bytes32", "bytes32", "string", "string"],
                        [burnRcpt.blockHash, burnTx.hash, requestId, salt],
                    ),
                );
                const idx = Number(ethers.toBigInt(seedHex) % 3n);
                const mintType = candidates[idx];

                // Pre-sim mint with the chosen random type
                try {
                  await contractTools.ownerMint.staticCall(userLower, mintType, nextRarity);
                } catch (e) {
                  const msg = String(e?.shortMessage || e?.message || "pre-sim failed");
                  throw new Error(`Reroll pre-simulation failed (mint): ${msg}`);
                }

                // --- Submit tx #2: mint the new random tool ---
                const mintTx = await contractTools.ownerMint(userLower, mintType, nextRarity);
                await jobRef.set(
                    {
                      stage: "mint_submitted",
                      mintTxHash: mintTx.hash,
                      txHash: mintTx.hash, // keep backward-compat with any UI using j.txHash
                      toolTypeForTx: mintType,
                    },
                    {merge: true},
                );
                await mintTx.wait(1);

                await jobRef.set(
                    {
                      status: "processing", // keep it "pending" or "processing"
                      stage: "mint_mined",
                      mintTxHash: mintTx.hash,
                      txHash: mintTx.hash, // legacy compatibility for finalizer
                      toolTypeForTx: mintType,
                    },
                    {merge: true},
                );

                // Tell client the job is still async
                return {
                  status: 202,
                  body: {
                    success: true,
                    status: "pending",
                    requestId,
                    txHash: mintTx.hash,
                    message: "Reroll submitted. It will be finalized after confirmation.",
                  },
                };
              } catch (innerErr) {
                if (!enqueued) {
                  try {
                    await lock.markCompleted({
                      status: "failed_pre_enqueue",
                      error: String(innerErr?.message || innerErr),
                    });
                  } catch (e) {
                    console.log(e);
                  }
                } else {
                  try {
                    // unreserve & mark failed
                    await db.runTransaction(async (tx) => {
                      const unreserveRef = db.collection("apply_markers").doc(`reroll_unreserve:${requestId}`);
                      const uref = db.collection("users").doc(userLower);
                      const [mark, userSnap] = await Promise.all([tx.get(unreserveRef), tx.get(uref)]);
                      if (!mark.exists && userSnap.exists) {
                        tx.update(uref, {
                          "locks.reroll.food": admin.firestore.FieldValue.increment(-expectedFood),
                          "locks.reroll.ronMicros": admin.firestore.FieldValue.increment(-requiredRonMicros),
                        });
                        tx.set(unreserveRef, {
                          userAddress: userLower, jobId: requestId, type: "reroll_unreserve",
                          appliedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                      }
                    });
                    await jobRef.set({
                      status: "failed",
                      lastError: String(innerErr?.message || innerErr),
                      finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, {merge: true});
                  } catch (e) {
                    console.log(e);
                  }
                  try {
                    await finalizeUserMutex({
                      uid: userLower, scope: "reroll", idempotencyKey: requestId,
                      meta: {status: "finalized", jobStatus: "failed_early"},
                    });
                  } catch (e) {
                    console.log(e);
                  }
                }
                throw innerErr;
              }
            },
            {
              scope: "reroll",
              idempotencyKey: requestId,
              deferCompletion: true,
              reservationTtlMs: 10 * 60 * 1000,
            },
        );

        return res.status(result.status).json(result.body);
      } catch (err) {
        if (err?.code === "LOCK_BUSY") {
          try {
            const userLowerFromReq = String(req.body?.data?.userAddress || "").toLowerCase();
            const active = await db
                .collection("reroll_jobs")
                .where("userAddress", "==", userLowerFromReq)
                .where("status", "in", ["reserved", "pending", "processing"])
                .orderBy("createdAt", "desc")
                .limit(1)
                .get();

            if (!active.empty) {
              const j = active.docs[0].data() || {};
              return res.status(202).json({
                success: true,
                status: j.status || "pending",
                requestId: active.docs[0].id,
                txHash: j.txHash || null,
                message: "Another reroll is already in progress for this account.",
              });
            }

            const reqIdForLock = stableRequestIdFrom({
              op: "rerollNFTTool",
              userAddress: userLowerFromReq,
              collectionAddress: String(req.body?.data?.collectionAddress || "").toLowerCase(),
              tokenIds: Array.isArray(req.body?.data?.tokenIds) ? [...new Set(req.body.data.tokenIds.map(String))].sort() : [],
              rarity: String(req.body?.data?.rarity || ""),
              nonce: String(req.body?.data?.nonce || ""),
            });

            try {
              await finalizeUserMutex({
                uid: userLowerFromReq,
                scope: "reroll",
                idempotencyKey: reqIdForLock,
                meta: {status: "finalized", jobStatus: "stale_lock_reset"},
              });
              return res.status(409).json({reset: true, message: "Stale lock cleared. Please retry."});
            } catch (e2) {
              console.log("finalizeUserMutex stale reset failed:", e2);
            }
          } catch (e) {
            console.log(e);
          }
          res.set("Retry-After", "5");
          return res.status(423).json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("rerollNFTTool error:", err);
        return res.status(500).send(err.message || "Internal error.");
      }
    }),
);

exports.sweepRerollJobs = onSchedule(
    {
      region: "us-central1",
      schedule: "every 2 minutes",
      timeZone: "UTC",
      timeoutSeconds: 240,
      memory: "512MiB",
    },
    withKillSwitchBg(async () => {
      const nowMs = Date.now();

      // Fetch a small batch of pending + processing jobs (oldest first)
      const [pendSnap, procSnap] = await Promise.all([
        db.collection("reroll_jobs")
            .where("status", "==", "pending")
            .orderBy("createdAt", "asc")
            .limit(20)
            .get(),
        db.collection("reroll_jobs")
            .where("status", "==", "processing")
            .orderBy("createdAt", "asc")
            .limit(20)
            .get(),
      ]);

      const batch = [...pendSnap.docs, ...procSnap.docs];
      if (batch.length === 0) return;

      for (const docSnap of batch) {
        const jobRef = docSnap.ref;
        const job = docSnap.data() || {};

        // Optional backoff gate (honors timeouts that set nextCheckAt)
        const nca = job.nextCheckAt?.toMillis?.() ?? null;
        if (nca && nca > nowMs) continue;

        try {
          await finalizeRerollJob(jobRef, job);
        } catch (e) {
          console.error("sweepRerollJobs item error:", jobRef.id, e);
        }
      }
    }),
);


async function finalizeMintJobV2(jobRef, jobData) {
  const FieldValue = admin.firestore.FieldValue;
  const job = jobData || {};

  // Only handle pending/processing
  if (!job.status || !["pending", "processing"].includes(job.status)) return;
  if (!job.txHash) {
    await jobRef.update({status: "failed", lastError: "Missing txHash"});
    return;
  }

  // Claim the job (lightweight lock)
  try {
    await jobRef.update({
      status: "processing",
      attempts: FieldValue.increment(1),
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch {
    return; // someone else processing
  }

  const norm = (s) => String(s || "").toLowerCase().replace(/[_\s-]+/g, "");
  const isSkinType = (s) => {
    const n = norm(s);
    return n === "animalskin" || n === "material";
  };
  const looksLikeTent = (s) => String(s || "").toLowerCase().replace(/[_\s-]+/g, " ").includes("tent");

  const isSkinMint = isSkinType(job.toolType) || isSkinType(job.toolTypeForTx) || String(job.reason || "").toLowerCase() === "collect_skin";
  const isShardMint = String(job.reason || "").toLowerCase() === "collect_shard";

  const SKIN_SCORE_START_TS = 1758996000;

  const userAddrLower = String(job.userAddress || "").toLowerCase();
  const ownerUid = userAddrLower; // IMPORTANT: mutex + users doc key

  const userDocRef = db.collection("users").doc(ownerUid);

  // Cost doc (not used for shards/skins)
  const costDocId = `${String(job.toolType).toLowerCase()}_${String(job.rarity).toLowerCase()}`;
  const costDocRef = db.collection("craft_cost_tools").doc(costDocId.toLowerCase());

  const applyRef = db.collection("apply_markers").doc(`mint:${jobRef.id}`);
  const unreserveRef = db.collection("apply_markers").doc(`mint_unreserve:${jobRef.id}`);
  const burnSkinsRef = db.collection("apply_markers").doc(`mint_burnskins:${jobRef.id}`);

  const burnedIds = Array.isArray(job.burnedToolDocIds) ? job.burnedToolDocIds : [];
  const skinsBurnIds = Array.isArray(job.skinsBurnIds) ? job.skinsBurnIds.map(Number).filter(Number.isFinite) : [];

  try {
    // -------- wait 1 conf on the mint --------
    let rc;
    try {
      rc = await provider.waitForTransaction(String(job.txHash), 1, 300_000);
    } catch {
      await jobRef.update({status: "processing", lastError: "waitForTransaction timeout"}).catch(() => {});
      try {
        await finalizeUserMutex({
          uid: ownerUid,
          scope: "mint",
          idempotencyKey: jobRef.id,
          meta: {status: "finalized", jobStatus: "retry_later"},
        });
      } catch (e) {
        console.log(e);
      }
      return;
    }

    // -------- tx failed -> unreserve (idempotent) --------
    if (!rc || rc.status !== 1) {
      await db.runTransaction(async (tx) => {
        const [unresSnap, userSnap] = await Promise.all([tx.get(unreserveRef), tx.get(userDocRef)]);
        if (unresSnap.exists) return;
        if (!userSnap.exists) throw new Error("User document not found (unreserve).");

        const dd = job.dynamicCostData || {};
        const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

        const ronToUnreserve =
          (String(job.reason).toLowerCase() === "collect_skin" || String(job.toolType || "").toLowerCase().includes("skin")) ?
          0 :
          FEE_PER_CRAFT_RON_MICROS;

        tx.update(userDocRef, {
          "locks.crafting.food": FieldValue.increment(-n(dd.food)),
          "locks.crafting.wood": FieldValue.increment(-n(dd.wood)),
          "locks.crafting.stone": FieldValue.increment(-n(dd.stone)),
          "locks.crafting.ronMicros": FieldValue.increment(-ronToUnreserve),
        });

        tx.set(unreserveRef, {
          userAddress: userAddrLower,
          jobId: jobRef.id,
          type: "mint_unreserve",
          appliedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await jobRef.update({
        status: "failed",
        lastError: `Mint tx failed: ${job.txHash}`,
        finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      try {
        await finalizeUserMutex({
          uid: ownerUid,
          scope: "mint",
          idempotencyKey: jobRef.id,
          meta: {status: "finalized", jobStatus: "failed"},
        });
      } catch (e) {
        console.warn("finalizeUserMutex(mint) failed:", e?.message || e);
      }
      return;
    }

    // -------- SUCCESS PATH: count how many were minted; top-up if needed --------
    const toolsLower = String(contractAddressTools || "").toLowerCase();
    const iface1155 = new ethers.Interface([
      "event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)",
      "event TransferBatch(address indexed operator,address indexed from,address indexed to,uint256[] ids,uint256[] values)",
    ]);

    const fromZero = ethers.ZeroAddress.toLowerCase();
    let mintedHere = 0;
    try {
      for (const log of (rc.logs || [])) {
        if (String(log.address || "").toLowerCase() !== toolsLower) continue;
        let p; try {
          p = iface1155.parseLog(log);
        } catch {
          continue;
        }

        if (p?.name === "TransferSingle") {
          if (String(p.args?.from || "").toLowerCase() === fromZero &&
              String(p.args?.to || "").toLowerCase() === userAddrLower) {
            mintedHere += Number(p.args?.value || 0);
          }
        } else if (p?.name === "TransferBatch") {
          if (String(p.args?.from || "").toLowerCase() === fromZero &&
              String(p.args?.to || "").toLowerCase() === userAddrLower) {
            const vals = (p.args?.values || []).map(Number);
            mintedHere += vals.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
          }
        }
      }
    } catch (e) {
      console.log(e);
    }

    const expected = Math.max(1, Number(job.expectedAmount || job.amount || 1));
    let totalMinted = mintedHere;

    if (isShardMint && totalMinted < expected) {
      const shortage = expected - totalMinted;
      try {
        if (typeof contractTools.ownerMintBatchMixed === "function" && shortage > 1) {
          const typesArr = Array(shortage).fill("Blueprint_Shard");
          const raritiesArr = Array(shortage).fill("Common");
          const tx2 = await contractTools.ownerMintBatchMixed(job.userAddress, typesArr, raritiesArr);
          const rc2 = await provider.waitForTransaction(tx2.hash, 1, 300_000);
          if (rc2?.status === 1) totalMinted = expected;
        } else if (typeof contractTools.ownerMint === "function") {
          for (let i = 0; i < shortage; i++) {
            const tx2 = await contractTools.ownerMint(job.userAddress, "Blueprint_Shard", "Common");
            const rc2 = await provider.waitForTransaction(tx2.hash, 1, 300_000);
            if (rc2?.status === 1) totalMinted += 1;
          }
        }
      } catch (e) {
        await jobRef.set({lastError: `top-up failed: ${String(e?.message || e)}`}, {merge: true});
      }
    }

    // -------- burn skins ON-CHAIN now (idempotent) --------
    if (skinsBurnIds.length > 0) {
      const burnedAlready = await burnSkinsRef.get();
      if (!burnedAlready.exists) {
        try {
          const idsBN = skinsBurnIds.map((x) => ethers.toBigInt(x));
          const burnTx = await contractTools.ownerBurnBatch(job.userAddress, idsBN);
          await provider.waitForTransaction(burnTx.hash, 1, 300_000);

          await burnSkinsRef.set({
            userAddress: userAddrLower,
            jobId: jobRef.id,
            type: "mint_burnskins",
            count: skinsBurnIds.length,
            appliedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (e) {
          await jobRef.update({status: "processing", lastError: `ownerBurnBatch failed: ${e?.message || e}`}).catch(() => {});
          try {
            await finalizeUserMutex({
              uid: ownerUid,
              scope: "mint",
              idempotencyKey: jobRef.id,
              meta: {status: "finalized", jobStatus: "retry_later"},
            });
          } catch (e) {
            console.log(e);
          }
          return;
        }
      }
    }

    // -------- apply Firestore effects (idempotent) --------
    let alreadyApplied = false;
    await db.runTransaction(async (tx) => {
      const [applySnap, userSnap, costSnap] = await Promise.all([
        tx.get(applyRef),
        tx.get(userDocRef),
        tx.get(costDocRef),
      ]);

      if (applySnap.exists) {
        alreadyApplied = true; return;
      }
      if (!userSnap.exists) throw new Error("User document not found.");
      if (!isSkinMint && !isShardMint && !costSnap.exists) throw new Error("Crafting cost not found.");

      const u = userSnap.data() || {};
      const dd = job.dynamicCostData || {};
      const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

      const need = (isSkinMint || isShardMint) ?
        {energy: 0, food: 0, wood: 0, stone: 0, gasTankRonMicros: 0} :
        {
          energy: 100,
          food: n(dd.food),
          wood: n(dd.wood),
          stone: n(dd.stone),
          gasTankRonMicros: FEE_PER_CRAFT_RON_MICROS,
        };

      // safety: don't go negative
      if (
        (u.energy ?? 0) < need.energy ||
        (u.food ?? 0) < need.food ||
        (u.wood ?? 0) < need.wood ||
        (u.stone ?? 0) < need.stone ||
        (u.gasTankRonMicros ?? 0) < need.gasTankRonMicros
      ) {
        throw new Error("Insufficient resources to finalize craft");
      }

      // Tent specific (not relevant for shards/skins, but keep unchanged)
      const tb = job.tentBurn || null;
      const slotsLost = Number(tb?.slotsLost || 0);
      const boostLost = Number(tb?.boostLost || 0);

      if (slotsLost > 0) {
        const curAvail = Number(u.villagers_available ?? u.villagersFree ?? 0);
        if (curAvail < slotsLost) {
          throw new Error(`Free up at least ${slotsLost} villagers before finalizing your tent upgrade (recheck).`);
        }
      }

      const userUpdates = {
        ...(need.energy ? {energy: FieldValue.increment(-need.energy)} : {}),
        ...(need.food ? {food: FieldValue.increment(-need.food)} : {}),
        ...(need.wood ? {wood: FieldValue.increment(-need.wood)} : {}),
        ...(need.stone ? {stone: FieldValue.increment(-need.stone)} : {}),
        ...(need.gasTankRonMicros ? {
          gasTankRonMicros: FieldValue.increment(-need.gasTankRonMicros),
          gasTankRon: FieldValue.increment(-microsToRon(need.gasTankRonMicros)),
        } : {}),
        "locks.crafting.food": FieldValue.increment(-need.food),
        "locks.crafting.wood": FieldValue.increment(-need.wood),
        "locks.crafting.stone": FieldValue.increment(-need.stone),
        "locks.crafting.ronMicros": FieldValue.increment(-need.gasTankRonMicros),
      };

      if (looksLikeTent(job.toolType)) userUpdates.has_tent = 0;
      if (slotsLost > 0) {
        const capField = "villagers_capacity" in u ? "villagers_capacity" : "villagers";
        userUpdates[capField] = FieldValue.increment(-slotsLost);
        userUpdates.villagers_available = FieldValue.increment(-slotsLost);
        userUpdates.has_tent = 0;
      }
      if (boostLost > 0) {
        const boostField = u?.boosts && typeof u?.boosts?.mining === "number" ? "boosts.mining" : "boost";
        userUpdates[boostField] = FieldValue.increment(-boostLost);
      }

      tx.update(userDocRef, userUpdates);

      // delete staked input docs (not used for shards)
      const stakedCol = db.collection("staked_nfts");
      (Array.isArray(burnedIds) ? burnedIds : [])
          .filter((id) => typeof id === "string" && id.length > 0)
          .forEach((id) => tx.delete(stakedCol.doc(id)));

      if (!isSkinMint && !isShardMint) {
        tx.update(costDocRef, {minted: FieldValue.increment(1)});
      }

      // rankings
      const RARITY_MULTIPLIERS = {Common: 1, Uncommon: 2, Rare: 4, Epic: 8, Legendary: 16};
      const mintPoints = RARITY_MULTIPLIERS[String(job.rarity)] || 1;

      const rankingsDocRef = db.collection("rankings").doc(userAddrLower);
      const rankUpdates = {mint_score: FieldValue.increment(mintPoints)};

      if (isShardMint) {
        rankUpdates.shards_found = FieldValue.increment(Math.max(0, Number(totalMinted || 0)));
      }

      const nowSec = Math.floor(Date.now() / 1000);
      if (isSkinMint && nowSec >= SKIN_SCORE_START_TS) {
        rankUpdates.skins_found = FieldValue.increment(1);
      }

      tx.set(rankingsDocRef, rankUpdates, {merge: true});

      tx.set(applyRef, {
        userAddress: userAddrLower,
        jobId: jobRef.id,
        type: "mint",
        appliedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    if (alreadyApplied) {
      await jobRef.update({
        status: "completed",
        finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
        note: "idempotent-complete",
      });
      try {
        await finalizeUserMutex({
          uid: ownerUid,
          scope: "mint",
          idempotencyKey: jobRef.id,
          meta: {status: "finalized", jobStatus: "ok"},
        });
      } catch (e) {
        console.warn("finalizeUserMutex(mint) failed:", e?.message || e);
      }
      // optional backfill stays as in your previous code (skins)
      return {ok: true};
    }

    await jobRef.update({
      status: "completed",
      finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      await finalizeUserMutex({
        uid: ownerUid,
        scope: "mint",
        idempotencyKey: jobRef.id,
        meta: {status: "finalized", jobStatus: "ok"},
      });
    } catch (e) {
      console.warn("finalizeUserMutex(mint) failed:", e?.message || e);
    }

    // (Optional) your tent cleanup stays as in your previous version
    return {ok: true};
  } catch (err) {
    // best-effort unreserve then mark failed
    try {
      await db.runTransaction(async (tx) => {
        const [unresSnap, userSnap] = await Promise.all([tx.get(unreserveRef), tx.get(userDocRef)]);
        if (unresSnap.exists) return;
        if (!userSnap.exists) throw new Error("User document not found (catch/unreserve).");

        const dd = job.dynamicCostData || {};
        const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

        tx.update(userDocRef, {
          "locks.crafting.food": FieldValue.increment(-n(dd.food)),
          "locks.crafting.wood": FieldValue.increment(-n(dd.wood)),
          "locks.crafting.stone": FieldValue.increment(-n(dd.stone)),
          "locks.crafting.ronMicros": FieldValue.increment(-FEE_PER_CRAFT_RON_MICROS),
        });

        tx.set(unreserveRef, {
          userAddress: userAddrLower,
          jobId: jobRef.id,
          type: "mint_unreserve",
          appliedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    } catch (e2) {
      console.warn("finalizeMintJobV2: unreserve in catch failed:", e2?.message || e2);
    }

    try {
      await finalizeUserMutex({
        uid: ownerUid,
        scope: "mint",
        idempotencyKey: jobRef.id,
        meta: {status: "finalized", jobStatus: "failed"},
      });
    } catch (e) {
      console.log(e);
    }
  }
}

// Firestore trigger: finalize when a mint job doc is created
exports.reconcileMintV2 = onDocumentCreated(
    {
      document: "mint_jobs/{jobId}",
      region: "us-central1",
      timeoutSeconds: 540,
      memory: "512MiB",
    },
    withKillSwitchBg(async (event) => {
      const snap = event.data;
      if (!snap) return;
      await finalizeMintJobV2(snap.ref, snap.data());
    }),
);

// Scheduled sweeper: picks up stuck or pending jobs periodically
exports.sweepMintJobsV2 = onSchedule(
    {
      region: "us-central1",
      schedule: "every 2 minutes",
      timeZone: "UTC",
      timeoutSeconds: 240,
      memory: "512MiB",
    },
    withKillSwitchBg(async () => {
      const batch = await db
          .collection("mint_jobs")
          .where("status", "in", ["pending", "processing"])
          .orderBy("createdAt", "asc")
          .limit(20)
          .get();

      if (batch.empty) return;

      for (const doc of batch.docs) {
        try {
          await finalizeMintJobV2(doc.ref, doc.data());
        } catch (e) {
          console.error("sweepMintJobsV2 item error:", doc.id, e);
        }
      }
    }),
);

// Manual poke (HTTP): re-run finalization for one job
exports.pokeMintJob = onRequest(
    {region: "us-central1", timeoutSeconds: 300, memory: "512MiB"},
    withKillSwitchHttp(async (req, res) => {
      try {
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized.");
        await admin.auth().verifyIdToken(idToken);

        const {requestId} = req.body?.data || {};
        if (!requestId) return err(400, "Missing requestId.");

        const jobRef = db.collection("mint_jobs").doc(requestId);
        const snap = await jobRef.get();
        if (!snap.exists) return res.status(404).send("Job not found.");

        const job = snap.data() || {};
        if (job.status === "completed") {
          return res.status(200).json({success: true, status: "completed"});
        }

        // Quick confirm hint
        const rc = await provider
            .waitForTransaction(String(job.txHash), 1, 5_000)
            .catch(() => null);
        if (!rc || rc.status !== 1) {
          return res.status(200).json({success: true, status: job.status, note: "tx not confirmed yet"});
        }

        await finalizeMintJobV2(jobRef, job);
        const done = await jobRef.get();
        return res.status(200).json({success: true, status: done.data()?.status || "unknown"});
      } catch (err) {
        console.error("pokeMintJob error:", err);
        return res.status(500).send(err.message || "Internal error.");
      }
    }),
);

exports.authenticateRoninWallet = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      const {walletAddress, token, signature} = req.body?.data || {};
      if (!walletAddress || !signature || !token) {
        return err(400,
            "walletAddress, token and signature are required.");
      }

      try {
      // 1) Verify stateless challenge token
        const uid = normalizeAddr(walletAddress); // ronin: → 0x, then lowercase
        if (!ethers.isAddress(uid)) return res.status(400).json({error: "BAD_ADDRESS"});
        // Verify challenge token binds to THIS address
        verifyChallengeToken(token, uid);

        // 2) Verify the wallet signature of the exact message
        const message = `Login to AOF: ${token}`;
        let recovered;
        try {
          recovered = ethers.verifyMessage(message, signature);
        } catch {
          return res.status(401).send("Invalid signature.");
        }
        if (recovered.toLowerCase() !== uid) {
          return res.status(401).send("Invalid signature.");
        }

        // 3) Create / fetch Firebase Auth user and mint custom token
        let userRecord;
        try {
          userRecord = await admin.auth().getUser(uid);
        } catch (error) {
          if (error.code === "auth/user-not-found") {
            userRecord = await admin.auth().createUser({uid, displayName: uid});
          } else {
            throw error;
          }
        }

        // 3b) Ensure Firestore user doc exists at users/{uid} (lowercase)
        const userRef = db.collection("users").doc(uid);
        const snap = await userRef.get();
        if (!snap.exists) {
          await userRef.set({
            userAddress: uid,
            // sensible defaults so post-login calls don't 404
            food: 0,
            wood: 0,
            stone: 0,
            energy: 1000,
            gasTankRon: 0,
            gasTankRonMicros: 0,
            can_mint: 1,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            villagers_available: 6,
            villagers: 6,
            total_rewards: 0,
            has_medallion: 0,
            has_historian: 0,
            total_crafter: 0,
          }, {merge: true});
        }

        const customToken = await admin.auth().createCustomToken(userRecord.uid);
        return res.status(200).json({token: customToken});
      } catch (err) {
        console.error("Auth error:", err);
        return res.status(500).send(
            "An internal error occurred during authentication");
      }
    }));

exports.exchangeFoodEnergy = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
      // --- Auth (unchanged) ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) {
          return res.status(401).send("Unauthorized: No token provided.");
        }
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        const usersDocId = decoded.uid.toLowerCase();
        const lockKey = usersDocId;

        // --- Inputs ---
        const {amount: amountRaw, signature, clientNonce} = req.body?.data || {};
        const amount = Number.parseInt(amountRaw, 10);
        if (!Number.isFinite(amount) || amount <= 0) {
          return err(400, "Please provide a valid amount of food to exchange.");
        }
        if (!signature) return err(400, "Missing signature.");
        if (!clientNonce) return err(400, "Missing clientNonce.");

        // OPTIONAL: anti-replay (persist nonce per user for a short TTL)
        await consumeNonceOrFail(usersDocId, "exchangeFoodEnergy", String(clientNonce));

        // --- Mutex key now includes the nonce so each click is unique ---
        const requestId = stableRequestIdFrom({
          op: "exchangeFoodEnergy",
          uid: lockKey,
          nonce: String(clientNonce),
        });

        const result = await withUserMutex(
            lockKey,
            requestId,
            async () => {
              const energyToReceive = amount * 4;
              const message = `Exchange ${amount} food for ${energyToReceive} energy`;

              let recovered;
              try {
                recovered = ethers.verifyMessage(message, signature);
              } catch {
                return {status: 401, body: {success: false, message: "Invalid signature."}};
              }

              if (recovered.toLowerCase() !== decoded.uid.toLowerCase()) {
                return {status: 401, body: {success: false, message: "Invalid signature."}};
              }

              const FieldValue = admin.firestore.FieldValue;
              const userRef = db.collection("users").doc(usersDocId);
              const rankingsRef = db.collection("rankings").doc(usersDocId);

              // Compute season once per request
              const {season} = getCurrentSeasonInfo(Date.now());
              const isWinter = season === "Winter";

              let newFood = null;
              let newEnergy = null;
              const opId = `exch_${Date.now()}_${Math.random().toString(36).slice(2)}`;

              await db.runTransaction(async (tx) => {
                const snap = await tx.get(userRef);
                if (!snap.exists) throw new Error("User data not found.");

                const data = snap.data() || {};
                const currentFood = Number(data.food || 0);
                const currentEnergy = Number(data.energy || 0);

                if (currentFood < amount) {
                  throw new Error("Insufficient food balance.");
                }

                const energyPerFood = 4;
                const availableRoom = MAX_ENERGY_CAP - currentEnergy;
                if (availableRoom <= 0) {
                  throw new Error(`Energy is already at the cap (${MAX_ENERGY_CAP}).`);
                }
                if (energyToReceive > availableRoom) {
                  const maxFood = Math.floor(availableRoom / energyPerFood);
                  throw new Error(
                      `This exchange would exceed the energy cap (${MAX_ENERGY_CAP}). ` +
                  `You can exchange at most ${maxFood} food right now.`,
                  );
                }

                // Update balances
                tx.update(userRef, {
                  food: FieldValue.increment(-amount),
                  energy: FieldValue.increment(energyToReceive),
                  lastEnergyExchangeAt: new Date(),
                  lastEnergyExchangeOpId: opId,
                });

                // WINTER bonus — update rankings.consumed_food atomically with the same tx
                if (isWinter) {
                  tx.set(
                      rankingsRef,
                      {
                        // keep existing fields (mint_score, total_rewards, username) untouched
                        consumed_food: FieldValue.increment(amount),
                        // optional observability:
                        last_consumed_food_at: FieldValue.serverTimestamp(),
                      },
                      {merge: true},
                  );
                }

                newFood = currentFood - amount;
                newEnergy = currentEnergy + energyToReceive;
              });

              return {
                status: 200,
                body: {
                  success: true,
                  opId,
                  exchanged: amount,
                  gainedEnergy: energyToReceive,
                  newBalances: {food: newFood, energy: newEnergy},
                  // optional echo for UI: was winter applied?
                  winterCounted: isWinter,
                },
              };
            },
            {scope: "exchange", idempotencyKey: requestId},
        );

        return res.status(result.status).json(result.body);
      } catch (error) {
        if (error.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({
            busy: true,
            message: "Another action is in progress. Try again shortly.",
          });
        }
        console.error("exchangeFoodEnergy error:", error);
        return res.status(500).send(error.message || "An error occurred during the exchange.");
      }
    }),
);


exports.reconcileStakeFromTx = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        const {userAddress, collectionAddress, transactionHash} = (req.body.data || {});
        if (!userAddress || !collectionAddress || !transactionHash) return err(400, "Missing params.");

        const receipt = await provider.getTransactionReceipt(transactionHash).catch(() => null);
        const okStatus = !!receipt && Number(receipt.status) === 1; // handles 1, "0x1", true
        if (!okStatus) {
          return res.status(400).send("Tx not found or failed.");
        }

        const requestId = stableRequestIdFrom({op: "reconcileStakeFromTx", userAddress, transactionHash});

        const result = await withUserMutex(userAddress, requestId, async (lock) => {
          const userLower = userAddress.toLowerCase();
          const colLower = collectionAddress.toLowerCase();

          // --- NEW: ERC-721 pack deposits (user -> PACK_VAULT_ADDRESS) ---
          const isPack721 = ALLOWED_PACKS_LC.has(colLower);
          const vaultLower = String(PACK_VAULT_ADDRESS || "").toLowerCase();

          const parsePackDeposits = (rc) => {
            const ids = [];
            for (const log of rc.logs || []) {
              if ((log.address || "").toLowerCase() !== colLower) continue;
              if ((log.topics?.[0] || "").toLowerCase() !== ERC721_TRANSFER_TOPIC.toLowerCase()) continue;
              try {
                const p = ERC721_XFER_IFACE.parseLog(log);
                const from = (p.args?.from || "").toLowerCase();
                const to = (p.args?.to || "").toLowerCase();
                const id = Number(p.args?.tokenId);
                if (from === userLower && to === vaultLower && Number.isFinite(id)) {
                  ids.push(id);
                }
              } catch {/* ignore non-matching logs */}
            }
            return [...new Set(ids)].sort((a, b)=>a-b);
          };

          // existing parsers (1155 tools)...
          const ifaceTools = new ethers.Interface(contractAbiTools);
          const iface1155 = new ethers.Interface([
            "event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)",
            "event TransferBatch(address indexed operator,address indexed from,address indexed to,uint256[] ids,uint256[] values)",
          ]);

          const parseStakedTools = (rc) => {
            for (const log of rc.logs || []) {
              if ((log.address || "").toLowerCase() !== contractAddressTools.toLowerCase()) continue;
              try {
                const p = ifaceTools.parseLog(log);
                if (p?.name === "Staked") {
                  const user = (p.args?.user || "").toLowerCase();
                  const ids = (p.args?.tokenIds || []).map(Number);
                  return {user, ids};
                }
              } catch (e) {
                console.log(e);
              }
            }
            return null;
          };

          const parse1155Transfers = (rc) => {
            const ids = [];
            for (const log of rc.logs || []) {
              if ((log.address || "").toLowerCase() !== contractAddressTools.toLowerCase()) continue;
              try {
                const p = iface1155.parseLog(log);
                if (p?.name === "TransferSingle") {
                  const from = (p.args?.from || "").toLowerCase();
                  const to = (p.args?.to || "").toLowerCase();
                  const id = Number(p.args?.id || 0);
                  const val = Number(p.args?.value || 0);
                  if (from === userLower && to === contractAddressTools.toLowerCase() && val > 0) ids.push(id);
                } else if (p?.name === "TransferBatch") {
                  const from = (p.args?.from || "").toLowerCase();
                  const to = (p.args?.to || "").toLowerCase();
                  const arr = (p.args?.ids || []).map(Number);
                  const vals = (p.args?.values || []).map(Number);
                  if (from === userLower && to === contractAddressTools.toLowerCase()) {
                    arr.forEach((id, i) => {
                      if ((vals[i] || 0) > 0) ids.push(id);
                    });
                  }
                }
              } catch (e) {
                console.log(e);
              }
            }
            return [...new Set(ids)].sort((a, b)=>a-b);
          };

          // --- Decide which path to use ---
          let ids = [];
          if (isPack721) {
            ids = parsePackDeposits(receipt);
            if (!ids.length) return err(404, "No ERC-721 pack deposits found in tx.");
            // Write to staked_packs (separate collection keeps tool logic untouched)
            const stakedCol = db.collection("staked_packs");
            const batch = db.batch();
            for (const tokenId of ids) {
              const docId = `${userLower}_${colLower}_${tokenId}`;
              batch.set(stakedCol.doc(docId), {
                ownerUid: userLower,
                userAddress,
                collectionAddress,
                tokenId,
                stakedAt: admin.firestore.FieldValue.serverTimestamp(),
                txHash: transactionHash,
                vault: PACK_VAULT_ADDRESS,
                pending_meta: true,
              }, {merge: true});
            }
            await batch.commit();

            const jobsCol = db.collection("staked_pack_meta_jobs");
            const jb = db.batch();
            for (const tokenId of ids) {
              const jobId = `${userLower}_${colLower}_${tokenId}`;
              jb.set(jobsCol.doc(jobId), {
                userAddress,
                collectionAddress,
                tokenId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                attempts: 0,
              }, {merge: true});
            }
            await jb.commit();

            return ok({success: true, kind: "pack721", upserted: ids.length});
          }

          // --- Original 1155 Tools flow (unchanged) ---
          const st = parseStakedTools(receipt);
          let evIdsSorted = [];
          if (st && st.user === userLower) {
            evIdsSorted = [...st.ids].sort((a, b)=>a-b);
          } else {
            evIdsSorted = parse1155Transfers(receipt);
          }
          if (!evIdsSorted.length) return err(404, "No stake/transfer ids found.");

          const stakedCol = db.collection("staked_nfts");
          const batch = db.batch();

          for (const tokenId of evIdsSorted) {
            const docId = `${userLower}_${contractAddressTools.toLowerCase()}_${tokenId}`;
            batch.set(stakedCol.doc(docId), {
              ownerUid: userLower,
              userAddress,
              collectionAddress: contractAddressTools,
              tokenId,
              toolType: null, rarity: null, category: "tool",
              metaUri: null,
              stakedAt: admin.firestore.FieldValue.serverTimestamp(),
              durability: 20,
              is_mining: 0,
              mining_end: 0,
              txHash: transactionHash,
              pending_meta: true,
              lastMetaFetchAt: null,
            }, {merge: true});
          }
          await batch.commit();

          const jobs = db.collection("staked_meta_jobs");
          const jb = db.batch();
          for (const tokenId of evIdsSorted) {
            const jobId =
         `${userLower}_${collectionAddress.toLowerCase()}_${tokenId}`;
            jb.set(jobs.doc(jobId), {
              userAddress, collectionAddress, tokenId,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              attempts: 0,
            }, {merge: true});
          }
          await jb.commit();

          return ok({success: true, kind: "tools1155", upserted: evIdsSorted.length});
        });

        return res.status(result.status).json(result.body);
      } catch (e) {
        if (e.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true,
            message: "Another action is in progress. Try again shortly."});
        }
        console.error("reconcileStakeFromTx:", e);
        return res.status(500).send(e.message || "Internal error.");
      }
    }));


exports.backfillStakedMetadata = onDocumentCreated(
    "staked_meta_jobs/{jobId}",
    withKillSwitchBg(async (event) => {
      const snap = event.data; // DataSnapshot
      if (!snap) return;
      const job = snap.data(); // Document data
      const {userAddress, collectionAddress, tokenId} = job;
      if (!userAddress ||
      !collectionAddress || tokenId == null) return;

      const GATEWAYS = [
        (u) => u.replace(/^ipfs:\/\/ipfs\//i,
            "https://cloudflare-ipfs.com/ipfs/").replace(/^ipfs:\/\//i,
            "https://cloudflare-ipfs.com/ipfs/"),
        (u) => u.replace(/^ipfs:\/\/ipfs\//i,
            "https://dweb.link/ipfs/").replace(/^ipfs:\/\//i,
            "https://dweb.link/ipfs/"),
        (u) => u.replace(/^ipfs:\/\/ipfs\//i,
            "https://ipfs.io/ipfs/").replace(/^ipfs:\/\//i,
            "https://ipfs.io/ipfs/"),
        (u) => u.replace(/^ipfs:\/\/ipfs\//i,
            "https://gateway.pinata.cloud/ipfs/").replace(/^ipfs:\/\//i,
            "https://gateway.pinata.cloud/ipfs/"),
      ];
      const idToHex64 = (id) => Number(id).toString(16).padStart(64, "0");
      const applyIdTemplate = (raw, tokenId) => (raw ||
         "").replace("{id}", idToHex64(tokenId));
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      async function fetchJsonWithGateways(url) {
        let lastErr;
        for (let i = 0; i < GATEWAYS.length; i++) {
          const candidate = GATEWAYS[i](url);
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const r = await fetch(candidate,
                  {cache: "no-store"});
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return await r.json();
            } catch (e) {
              lastErr = e;
              await sleep(300 * (attempt + 1));
            }
          }
        }
        throw lastErr || new Error("All gateways failed");
      }

      try {
      // fetch uri with a couple retries
        let rawUri;
        for (let i = 0; i < 3; i++) {
          try {
            rawUri = await contractTools.uri(Number(tokenId)); break;
          } catch (e) {
            if (i === 2) throw e; await sleep(300 * (i + 1));
          }
        }
        const metaUri = applyIdTemplate(rawUri, tokenId);
        let meta = {};
        try {
          meta = await fetchJsonWithGateways(metaUri);
        } catch (e) {/* keep meta empty, still clear pending flag */}

        const toolType = meta?.type || null;
        const rarity = meta?.rarity || null;
        const category = meta?.category || "tool";

        // update staked_nfts
        const docId = `${userAddress.toLowerCase()}_` +
      `${collectionAddress.toLowerCase()}_${Number(tokenId)}`;
        const ref = db.collection("staked_nfts").doc(docId);
        await ref.set({
          toolType,
          rarity,
          category,
          metaUri,
          pending_meta: false,
          lastMetaFetchAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});

        // delete job
        await snap.ref.delete();
      } catch (e) {
        const attempts = (job.attempts || 0) + 1;
        if (attempts >= 5) {
        // park the job; visible for manual inspection
          await snap.ref.set({attempts, lastError: e.message ||
           String(e), parked: true}, {merge: true});
        } else {
        // backoff and retry by rewriting the job
          await snap.ref.set({attempts, lastError: e.message ||
          String(e)}, {merge: true});
        // re-enqueue after small delay
        // (Cloud Functions doesn't support sleeps in triggers well;
        // simplest is leave the doc; a scheduled job
        //  can re-pick parked/retryable)
        }
      }
    }));

async function finalizeStakeJobV2(jobRef, jobData) {
  const job = jobData || {};
  if (!job.status || !["pending", "processing"].includes(job.status)) return;
  if (!job.txHash) {
    await jobRef.update({status: "failed", lastError: "Missing txHash"});
    return;
  }

  // light lock
  try {
    await jobRef.update({
      status: "processing",
      attempts: admin.firestore.FieldValue.increment(1),
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch {
    return; // another worker grabbed it
  }

  try {
    const rc = await provider
        .waitForTransaction(String(job.txHash), 1, 300_000)
        .catch(() => null);

    if (!rc) {
      await jobRef.update({
        status: "pending",
        lastError: "still no receipt after wait",
      });
      return;
    }
    if (Number(rc.status) !== 1) throw new Error(`Stake tx status != 1: ${job.txHash} (raw=${rc.status})`);

    const userLower = String(job.userAddress || "").toLowerCase();
    const colLower = String(job.collectionAddress || "").toLowerCase();
    const toolsLower = String(contractAddressTools || "").toLowerCase();

    // ---------------- PACK (ERC-721) PATH ----------------
    const isPack = ALLOWED_PACKS_LC.has(colLower);
    if (isPack) {
      const ids = parsePackDepositsFromReceipt(rc, colLower, userLower, PACK_VAULT_LC);
      if (!ids.length) throw new Error("No ERC-721 pack deposits found in tx logs.");

      // intersect with requestedTokenIds if present
      const requested = Array.isArray(job.requestedTokenIds) ?
        job.requestedTokenIds.map(Number) :
        ids;
      const reqSet = new Set(requested);
      const finalIds = ids.filter((id) => reqSet.has(Number(id)));
      if (!finalIds.length) {
        throw new Error("None of the requested pack ids were found in tx logs.");
      }

      const stakedCol = db.collection("staked_packs");
      const batch = db.batch();
      for (const tokenId of finalIds) {
        const docId = `${userLower}_${colLower}_${tokenId}`;
        batch.set(
            stakedCol.doc(docId),
            {
              ownerUid: job.ownerUid || job.userAddress, // prefer UID when available
              userAddress: job.userAddress,
              collectionAddress: job.collectionAddress,
              tokenId,
              stakedAt: admin.firestore.FieldValue.serverTimestamp(),
              txHash: job.txHash,
              vault: PACK_VAULT_ADDRESS,
              pending_meta: true,
            },
            {merge: true},
        );
      }
      await batch.commit();

      const jobsCol = db.collection("staked_pack_meta_jobs");
      const jb = db.batch();
      for (const tokenId of finalIds) {
        const jid = `${userLower}_${colLower}_${tokenId}`;
        jb.set(
            jobsCol.doc(jid),
            {
              userAddress: job.userAddress,
              collectionAddress: job.collectionAddress,
              tokenId,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              attempts: 0,
            },
            {merge: true},
        );
      }
      await jb.commit();

      await jobRef.update({
        status: "completed",
        finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
        appliedIds: finalIds,
        kind: "pack721",
      });
      return;
    }

    // ---------------- TOOLS (ERC-1155) PATH ----------------
    const ifaceTools = new ethers.Interface(contractAbiTools);
    const iface1155 = new ethers.Interface([
      "event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)",
      "event TransferBatch(address indexed operator,address indexed from,address indexed to,uint256[] ids,uint256[] values)",
    ]);

    const parseStaked = (receipt) => {
      for (const log of receipt.logs || []) {
        if ((log.address || "").toLowerCase() !== toolsLower) continue;
        try {
          const p = ifaceTools.parseLog(log);
          if (p?.name === "Staked") {
            const user = (p.args?.user || "").toLowerCase();
            const ids = (p.args?.tokenIds || []).map((x) => Number(x));
            return {user, ids};
          }
        } catch (e) {
          console.log(e);
        }
      }
      return null;
    };

    const parseTransfers = (receipt) => {
      const ids = [];
      for (const log of receipt.logs || []) {
        if ((log.address || "").toLowerCase() !== toolsLower) continue;
        try {
          const p = iface1155.parseLog(log);
          if (p?.name === "TransferSingle") {
            const from = (p.args?.from || "").toLowerCase();
            const to = (p.args?.to || "").toLowerCase();
            const id = Number(p.args?.id || 0);
            const val = Number(p.args?.value || 0);
            if (from === userLower && to === toolsLower && val > 0) ids.push(id);
          } else if (p?.name === "TransferBatch") {
            const from = (p.args?.from || "").toLowerCase();
            const to = (p.args?.to || "").toLowerCase();
            const arr = (p.args?.ids || []).map((x) => Number(x));
            const vals = (p.args?.values || []).map((x) => Number(x));
            if (from === userLower && to === toolsLower) {
              arr.forEach((id, i) => {
                if ((vals[i] || 0) > 0) ids.push(id);
              });
            }
          }
        } catch (e) {
          console.log(e);
        }
      }
      return [...new Set(ids)].sort((a, b) => a - b);
    };

    const st = parseStaked(rc);
    let evIdsSorted = [];
    if (st && st.user === userLower) evIdsSorted = [...st.ids].sort((a, b) => a - b);
    else evIdsSorted = parseTransfers(rc);

    if (!evIdsSorted.length) {
      const c1155 = new ethers.Contract(
          contractAddressTools,
          ["function balanceOf(address account, uint256 id) view returns (uint256)"],
          provider,
      );

      // Use the ids claimed by the client/job as candidates
      const candidates =
        (Array.isArray(job?.requestedTokenIds) ? job.requestedTokenIds : []).map(Number);

      const holder = contractAddressTools.toLowerCase(); // self-custody; if you ever move to a vault, swap here
      const deposited = [];
      for (const id of [...new Set(candidates)]) {
        const bal = await c1155.balanceOf(holder, id).catch(() => 0);
        if (Number(bal) > 0) deposited.push(id);
      }
      if (deposited.length) {
        evIdsSorted = deposited.sort((a, b) => a - b);
      }
    }

    if (!evIdsSorted.length) throw new Error("No stake/transfer ids found in tx logs.");

    // Upsert staked_nfts docs (minimal; meta fetched later)
    const stakedCol = db.collection("staked_nfts");
    const toolsBatch = db.batch();
    for (const tokenId of evIdsSorted) {
      const docId = `${userLower}_${toolsLower}_${tokenId}`;
      toolsBatch.set(
          stakedCol.doc(docId),
          {
            ownerUid: job.ownerUid || job.userAddress,
            userAddress: job.userAddress,
            collectionAddress: contractAddressTools,
            tokenId,
            toolType: null,
            rarity: null,
            category: "tool",
            metaUri: null,
            stakedAt: admin.firestore.FieldValue.serverTimestamp(),
            durability: 20,
            is_mining: 0,
            mining_end: 0,
            txHash: job.txHash,
            pending_meta: true,
            lastMetaFetchAt: null,
          },
          {merge: true},
      );
    }
    await toolsBatch.commit();

    // -------- TENT capacity + BOOST (idempotent per job) --------
    try {
      const c1155 = new ethers.Contract(contractAddressTools, TOOLNFT_META_ABI, provider);

      // resolve toolType/rarity so we can detect tents and look up slots/boost
      const pairs = await Promise.all(
          evIdsSorted.map(async (id) => {
            try {
              const [tt, rr] = await Promise.all([
                c1155.tokenTypes(Number(id)),
                c1155.tokenRarities(Number(id)),
              ]);
              return {id: Number(id), toolType: tt, rarity: rr};
            } catch {
              return {id: Number(id), toolType: null, rarity: null};
            }
          }),
      );

      const tentCountsByCostId = new Map();
      const looksLikeTent = (s) =>
        String(s || "").toLowerCase().replace(/[_\s-]+/g, " ").includes("tent");

      for (const p of pairs) {
        if (looksLikeTent(p.toolType)) {
          const costId = `${String(p.toolType || "").toLowerCase()}_${String(p.rarity || "").toLowerCase()}`;
          tentCountsByCostId.set(costId, (tentCountsByCostId.get(costId) || 0) + 1);
        }
      }

      if (tentCountsByCostId.size > 0) {
        let totalSlots = 0;
        let totalBoost = 0;

        // read craft_cost_tools docs to sum slots & boost
        const costIds = Array.from(tentCountsByCostId.keys());
        const costSnaps = await Promise.all(
            costIds.map((id) => db.collection("craft_cost_tools").doc(id.toLowerCase()).get()),
        );
        costSnaps.forEach((snap, i) => {
          if (!snap.exists) return;
          const data = snap.data() || {};
          const slots = Number(data.slots || 0);
          const boost = Number(data.boost || 0);
          if (!Number.isFinite(slots) || slots < 0) return;
          const count = tentCountsByCostId.get(costIds[i]) || 0;
          totalSlots += slots * count;
          if (Number.isFinite(boost) && boost > 0) totalBoost += boost * count;
        });

        const userRef = db.collection("users").doc(userLower);
        const markRef = db.collection("stake_capacity_marks").doc(jobRef.id); // idempotency per job

        await db.runTransaction(async (tx) => {
          const [markSnap, userSnap] = await Promise.all([tx.get(markRef), tx.get(userRef)]);
          if (markSnap.exists) return; // already applied for this job id

          const user = userSnap.exists ? (userSnap.data() || {}) : {};
          const alreadyHasTent = Number(user.has_tent || 0) > 0;

          if (alreadyHasTent) {
            // do NOT add slots/boost again
            tx.set(markRef, {
              applied: true,
              slots: 0,
              boost: 0,
              note: "already_had_tent",
              userAddress: job.userAddress,
              collectionAddress: job.collectionAddress,
              txHash: job.txHash,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
          }

          // First tent being staked → add capacity & boost and set the flag
          const incSlots = admin.firestore.FieldValue.increment(totalSlots || 0);
          const incBoost = admin.firestore.FieldValue.increment(totalBoost || 0);

          tx.update(userRef, {
            villagers: incSlots,
            villagers_available: incSlots,
            boost: incBoost,
            has_tent: 1,
          });

          tx.set(markRef, {
            applied: true,
            slots: totalSlots,
            boost: totalBoost,
            setHasTent: true,
            userAddress: job.userAddress,
            collectionAddress: job.collectionAddress,
            txHash: job.txHash,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
      }
    } catch (e) {
      console.log("tent capacity/boost apply (sweeper) error:", e);
      // non-fatal; continue
    }

    // enqueue metadata fetch jobs
    const metaJobs = db.collection("staked_meta_jobs");
    const mb = db.batch();
    for (const tokenId of evIdsSorted) {
      const jid = `${userLower}_${toolsLower}_${tokenId}`;
      mb.set(
          metaJobs.doc(jid),
          {
            userAddress: job.userAddress,
            collectionAddress: contractAddressTools,
            tokenId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            attempts: 0,
          },
          {merge: true},
      );
    }
    await mb.commit();

    await jobRef.update({
      status: "completed",
      finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
      appliedIds: evIdsSorted,
      kind: "tools1155",
    });
  } catch (err) {
    await jobRef.update({status: "failed", lastError: err.message || String(err)});
  }
}


const ERC721_METADATA_ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)",
];

exports.backfillPackMetadata = onDocumentCreated(
    {document: "staked_pack_meta_jobs/{jobId}", region: "us-central1", timeoutSeconds: 540, memory: "512MiB"},
    withKillSwitchBg(async (event) => {
      const snap = event.data; if (!snap) return;
      const job = snap.data() || {};
      const {userAddress, collectionAddress, tokenId} = job;
      if (!userAddress || !collectionAddress || tokenId == null) return;

      const idToHex64 = (id) => Number(id).toString(16).padStart(64, "0");
      const applyIdTemplate = (raw, tid) => (String(raw || "")).replace("{id}", idToHex64(tid));

      const GATEWAYS = [
        (u) => u.replace(/^ipfs:\/\/ipfs\//i, "https://cloudflare-ipfs.com/ipfs/").replace(/^ipfs:\/\//i, "https://cloudflare-ipfs.com/ipfs/"),
        (u) => u.replace(/^ipfs:\/\/ipfs\//i, "https://dweb.link/ipfs/").replace(/^ipfs:\/\//i, "https://dweb.link/ipfs/"),
        (u) => u.replace(/^ipfs:\/\/ipfs\//i, "https://ipfs.io/ipfs/").replace(/^ipfs:\/\//i, "https://ipfs.io/ipfs/"),
        (u) => u.replace(/^ipfs:\/\/ipfs\//i, "https://gateway.pinata.cloud/ipfs/").replace(/^ipfs:\/\//i, "https://gateway.pinata.cloud/ipfs/"),
      ];
      async function fetchJsonWithGateways(url) {
        let lastErr;
        for (const gw of GATEWAYS) {
          const candidate = gw(url);
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const r = await fetch(candidate, {cache: "no-store"});
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return await r.json();
            } catch (e) {
              lastErr = e; await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
            }
          }
        }
        throw lastErr || new Error("All gateways failed");
      }

      try {
      // Some ERC721s use plain tokenURI; others expose a {id} template in baseURI.
        const c721 = new ethers.Contract(collectionAddress, ERC721_METADATA_ABI, provider);
        const rawUri = await c721.tokenURI(Number(tokenId));
        // if the contract returns a template with {id}, normalize it (rare for ERC721, but safe)
        const metaUri = applyIdTemplate(rawUri, tokenId);

        // Resolve metadata JSON (best-effort)
        let meta = {};
        try {
          meta = await fetchJsonWithGateways(metaUri);
        } catch {/* ignore, still clear pending flag */}

        const packType = meta?.type || meta?.name || null;
        const rarity = meta?.rarity || null;
        const image = meta?.image || null;

        const docId = `${String(userAddress).toLowerCase()}_${String(collectionAddress).toLowerCase()}_${Number(tokenId)}`;
        await db.collection("staked_packs").doc(docId).set({
          packType,
          rarity,
          image,
          metaUri,
          pending_meta: false,
          lastMetaFetchAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});

        await snap.ref.delete();
      } catch (e) {
        const attempts = (job.attempts || 0) + 1;
        if (attempts >= 3) {
          await snap.ref.set({attempts, lastError: String(e), parked: true}, {merge: true});
        } else {
          await snap.ref.set({attempts, lastError: String(e)}, {merge: true});
        }
      }
    }),
);

exports.sweepPackMetaJobs = onSchedule(
    {region: "us-central1", schedule: "every 2 minutes", timeZone: "UTC", timeoutSeconds: 240, memory: "512MiB"},
    withKillSwitchBg(async () => {
      const qs = await db.collection("staked_pack_meta_jobs").limit(20).get();
      for (const doc of qs.docs) {
        try {
          await exports.backfillPackMetadata.run?.({data: doc});
        } catch (e) {
          console.log(e);
        }
      }
    }),
);

const TOOLNFT_META_ABI = [
  "function uri(uint256 id) view returns (string)",
  "function tokenTypes(uint256 id) view returns (string)",
  "function tokenRarities(uint256 id) view returns (string)",
  "function baseURI() view returns (string)",
];

const META_BASE = "https://ageoffarming.com/metadata/";
const IMG_BASE = "https://ageoffarming.com/images/";

const stripDiacritics = (s) =>
  (s?.normalize?.("NFKD") || s).replace(/[\u0300-\u036f]/g, "");

const slugTool = (s) =>
  stripDiacritics(String(s || ""))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function fromToolRarity(toolType, rarity) {
  // toolType can be "Stone_Axe"; we keep that and also build a pretty name.
  const toolSlug = slugTool(String(toolType || "").replace(/_/g, " "));
  const raritySlug = String(rarity || "").toLowerCase();
  return {
    metaUri: `${META_BASE}${toolSlug}/${raritySlug}.json`,
    image: `${IMG_BASE}${toolSlug}_${raritySlug}.png`,
    name: `${String(toolType || "").replace(/_/g, " ")} (${cap(raritySlug)})`,
    toolType, rarity,
  };
}

async function fetchJsonNoCache(url) {
  const r = await fetch(url, {headers: {"cache-control": "no-cache"}});
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

async function resolveToolMetadataOnServer(collectionAddress, tokenId, provider) {
  const c = new ethers.Contract(collectionAddress, TOOLNFT_META_ABI, provider);

  // 1) Try uri(id) first (happy path)
  try {
    const raw = await c.uri(Number(tokenId));
    if (raw && typeof raw === "string") {
      const url = raw.replace(/^ipfs:\/\/ipfs\//i, "https://cloudflare-ipfs.com/ipfs/")
          .replace(/^ipfs:\/\//i, "https://cloudflare-ipfs.com/ipfs/");
      try {
        const meta = await fetchJsonNoCache(url);
        const img = (meta?.image || meta?.image_url || meta?.imageUrl || meta?.imageURI || meta?.animation_url) || null;
        const rawType = meta?.type || meta?.toolType || null;
        const toolType =
          rawType && /^short[\s_-]*bow$/i.test(String(rawType)) ? "Short_Bow" : rawType;

        return {
          ok: true,
          metaUri: url,
          image: img,
          name: meta?.name || null,
          toolType,
          rarity: meta?.rarity || null,
          meta,
        };
      } catch (e) {
        console.log(e);
      }
    }
  } catch (e) {
    console.log(e);
  }

  // 2) Fall back to on-chain mappings (public getters)
  try {
    const [toolTypeOnChain, rarity] = await Promise.all([
      c.tokenTypes(Number(tokenId)),
      c.tokenRarities(Number(tokenId)),
    ]);
    const built = fromToolRarity(toolTypeOnChain, rarity);

    // 🔧 normalize ShortBow -> Short_Bow
    const toolType =
      built?.toolType && /^short[\s_-]*bow$/i.test(String(built.toolType)) ?
        "Short_Bow" :
        built.toolType;

    // Try to fetch JSON (best-effort)
    try {
      const meta = await fetchJsonNoCache(built.metaUri);
      const img =
        (meta?.image || meta?.image_url || meta?.imageUrl || meta?.imageURI || meta?.animation_url) ||
        built.image;
      return {ok: true, ...built, toolType, image: img, meta}; // toolType overrides built.toolType
    } catch {
      // Even if fetch fails, return synthetic paths so UI can render image
      return {ok: true, ...built, toolType, meta: null};
    }
  } catch (e) {
    console.log(e);
  }

  return {ok: false, reason: "could_not_resolve"};
}

async function createAndSendSkinMintJob({userAddressLower, baseKey, idx}) {
  // Unique, idempotent job id tied to this collect request + index
  const requestId = stableRequestIdFrom({
    op: "mintSkin",
    userAddress: userAddressLower,
    baseKey, // include collect request key (ids+nonce or requestId)
    idx, // which skin in this collect
  });
  const jobRef = db.collection("mint_jobs").doc(requestId);

  // If already present, return idempotently
  const existing = await jobRef.get();
  if (existing.exists) {
    const j = existing.data() || {};
    if (["reserved", "pending", "processing", "completed"].includes(j.status)) {
      return {requestId, status: j.status, txHash: j.txHash || null};
    }
  }

  // Reserve the job (no resource locks needed for skins)
  await jobRef.set({
    status: "reserved",
    userAddress: userAddressLower,
    toolType: "Animal_Skin",
    rarity: "Common",
    burnTokenIds: [],
    burnedToolDocIds: [],
    dynamicCostData: {food: 0, wood: 0, stone: 0},
    reason: "collect_skin",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    attempts: 0,
  }, {merge: false});

  // Pre-simulate like in mintNFTTool (tolerant to missing revert data)
  const burnIdsBN = [];
  const force_mint = false; // bypass crafting/burn route for skins
  try {
    await contractTools.ownerMintWithBurn.staticCall(
        userAddressLower, "Animal_Skin", "Common", burnIdsBN, force_mint,
    );
  } catch (e) {
    const msg = String(e?.shortMessage || e?.message || "");
    if (/missing revert data/i.test(msg)) {
      await contractTools.ownerMintWithBurn
          .estimateGas(userAddressLower, "Animal_Skin", "Common", burnIdsBN, force_mint)
          .catch((eg) => {
            throw new Error(`Skin mint pre-sim failed: ${eg.shortMessage || eg.message}`);
          });
    } else {
      throw new Error(`Skin mint pre-sim failed: ${e.shortMessage || e.message}`);
    }
  }

  // Send tx
  let txHash = "";
  try {
    const txResp = await contractTools.ownerMintWithBurn(
        userAddressLower, "Animal_Skin", "Common", burnIdsBN, force_mint,
    );
    txHash = txResp.hash || "";
  } catch (e) {
    // Mark job failed if send fails (no locks to release here)
    await jobRef.set({status: "failed", lastError: String(e?.message || e)}, {merge: true});
    throw e;
  }

  // Mark pending (awaiting confirmation / sweeper finalization)
  await jobRef.set({status: "pending", txHash}, {merge: true});
  return {requestId, status: "pending", txHash};
}

async function runToolMetaJob(jobSnap) {
  const job = jobSnap.data() || {};
  const {userAddress, collectionAddress, tokenId} = job;
  if (!userAddress || !collectionAddress || tokenId == null) {
    await jobSnap.ref.delete().catch(()=>{});
    return;
  }

  try {
    const out = await resolveToolMetadataOnServer(collectionAddress, Number(tokenId), provider);

    const docId = `${String(userAddress).toLowerCase()}_${String(collectionAddress).toLowerCase()}_${Number(tokenId)}`;
    const update = {
      pending_meta: false,
      lastMetaFetchAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (out.ok) {
      update.metaUri = out.metaUri || null;
      update.image = out.image || null;
      update.name = out.name || (out.toolType && out.rarity ? `${out.toolType.replace(/_/g, " ")} (${cap(String(out.rarity).toLowerCase())})` : null);
      update.toolType = out.toolType || null;
      update.rarity = out.rarity || null;
    }

    await db.collection("staked_nfts").doc(docId).set(update, {merge: true});
  } catch (e) {
    // keep pending_meta true; sweeper will retry
    await jobSnap.ref.update({attempts: admin.firestore.FieldValue.increment(1), lastError: String(e)}).catch(()=>{});
    return;
  }

  await jobSnap.ref.delete().catch(()=>{});
}

// Trigger + sweeper
exports.backfillToolMetadata = onDocumentCreated(
    {document: "staked_meta_jobs/{jobId}", region: "us-central1", timeoutSeconds: 540, memory: "512MiB"},
    withKillSwitchBg(async (event) => {
      if (event.data) await runToolMetaJob(event.data);
    }),
);

exports.sweepToolMetaJobs = onSchedule(
    {region: "us-central1", schedule: "every 2 minutes", timeZone: "UTC", timeoutSeconds: 240, memory: "512MiB"},
    withKillSwitchBg(async () => {
      const qs = await db.collection("staked_meta_jobs").orderBy("createdAt", "asc").limit(20).get();
      for (const doc of qs.docs) {
        try {
          await runToolMetaJob(doc);
        } catch (e) {
          console.log("tool meta job error:", e);
        }
      }
    }),
);

exports.stakeNfts = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
      // --- 1) Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        const {userAddress, collectionAddress, tokenIds, transactionHash} = req.body.data || {};
        try {
          assertAuthMatches(decoded, userAddress);
        } catch (e) {
          return res.status(401).send(e.message || "Auth mismatch.");
        }
        if (!userAddress || !collectionAddress || !Array.isArray(tokenIds) || !transactionHash) {
          return err(400, "Missing or invalid parameters.");
        }

        const requestId = stableRequestIdFrom({
          op: "stakeNfts",
          userAddress,
          transactionHash,
          tokenIds: [...tokenIds].sort(),
        });

        const result = await withUserMutex(userAddress, requestId, async () => {
          const userLower = String(userAddress).toLowerCase();
          const colLower = String(collectionAddress || "").toLowerCase();
          const toolsLower = contractAddressTools.toLowerCase();
          const isTools = (colLower === toolsLower);
          const isPack = ALLOWED_PACKS_LC.has(colLower);

          // --- Quick receipt; otherwise enqueue reconcile job ---
          const receipt = await provider.getTransactionReceipt(transactionHash).catch(() => null);
          const okStatus = !!receipt && Number(receipt.status) === 1; // handles 1, "0x1", true
          if (!okStatus) {
            const jobId = stableRequestIdFrom({
              op: "stake_job",
              userAddress,
              collectionAddress,
              transactionHash,
              tokenIds: [...new Set((tokenIds || []).map(Number))].sort((a, b) => a - b),
            });
            await db.collection("stake_jobs").doc(jobId).set({
              status: "pending",
              userAddress,
              collectionAddress,
              txHash: transactionHash,
              requestedTokenIds: [...new Set((tokenIds || []).map(Number))].sort((a, b) => a - b),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              attempts: 0,
              lastError: !receipt ? "no_receipt_yet" : "receipt_status_not_1",
              ownerUid: decoded.uid,
            }, {merge: true});
            return {
              status: 202,
              body: {
                success: true,
                status: "pending",
                requestId: jobId,
                txHash: transactionHash,
                message: "Stake submitted — finalization is queued.",
              },
            };
          }

          // ---------- Pack (ERC-721) path ----------
          if (isPack) {
            const ids = parsePackDepositsFromReceipt(receipt, colLower, userLower, PACK_VAULT_LC);
            if (!ids.length) {
              const jobId = stableRequestIdFrom({
                op: "stake_job",
                userAddress,
                collectionAddress,
                transactionHash,
                tokenIds: [...new Set((tokenIds || []).map(Number))].sort((a, b) => a - b),
              });
              await db.collection("stake_jobs").doc(jobId).set({
                status: "pending",
                userAddress,
                collectionAddress,
                txHash: transactionHash,
                requestedTokenIds: [...new Set((tokenIds || []).map(Number))].sort((a, b) => a - b),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                attempts: 0,
                lastError: "pack_parse_produced_no_ids",
                ownerUid: decoded.uid,
              }, {merge: true});
              return {status: 202, body: {success: true, status: "pending", requestId: jobId, txHash: transactionHash}};
            }

            // Upsert pack stake docs
            const stakedCol = db.collection("staked_packs");
            const batch = db.batch();
            for (const tokenId of ids) {
              const docId = `${userLower}_${colLower}_${tokenId}`;
              batch.set(stakedCol.doc(docId), {
                ownerUid: decoded.uid,
                userAddress,
                collectionAddress,
                tokenId,
                stakedAt: admin.firestore.FieldValue.serverTimestamp(),
                txHash: transactionHash,
                vault: PACK_VAULT_ADDRESS,
                pending_meta: true,
              }, {merge: true});
            }
            await batch.commit();

            // Enqueue meta jobs
            const jobsCol = db.collection("staked_pack_meta_jobs");
            const jb = db.batch();
            for (const tokenId of ids) {
              const jobId = `${userLower}_${colLower}_${tokenId}`;
              jb.set(jobsCol.doc(jobId), {
                userAddress,
                collectionAddress,
                tokenId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                attempts: 0,
              }, {merge: true});
            }
            await jb.commit();

            return ok({success: true, kind: "pack721", upserted: ids.length, blockNumber: receipt.blockNumber});
          }

          // ---------- Tools (ERC-1155) path ----------
          if (!isTools) {
            return err(403, "collectionAddress is neither Tools nor an allowed Pack.");
          }

          const ifaceTools = new ethers.Interface(contractAbiTools);
          const iface1155 = new ethers.Interface([
            "event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)",
            "event TransferBatch(address indexed operator,address indexed from,address indexed to,uint256[] ids,uint256[] values)",
          ]);

          const parseStakedFromReceipt = (rc) => {
            for (const log of rc.logs || []) {
              if ((log.address || "").toLowerCase() !== toolsLower) continue;
              try {
                const parsed = ifaceTools.parseLog(log);
                if (parsed?.name === "Staked") {
                  const user = (parsed.args?.user || "").toLowerCase();
                  const ids = (parsed.args?.tokenIds || []).map((x) => Number(x));
                  return {user, ids};
                }
              } catch (e) {
                console.log(e);
              }
            }
            return null;
          };

          const parse1155TransfersFromReceipt = (rc) => {
            const ids = [];
            for (const log of rc.logs || []) {
              if ((log.address || "").toLowerCase() !== toolsLower) continue;
              try {
                const p = iface1155.parseLog(log);
                if (p?.name === "TransferSingle") {
                  const from = (p.args?.from || "").toLowerCase();
                  const to = (p.args?.to || "").toLowerCase();
                  const id = Number(p.args?.id || 0);
                  const val = Number(p.args?.value || 0);
                  if (from === userLower && to === toolsLower && val > 0) ids.push(id);
                } else if (p?.name === "TransferBatch") {
                  const from = (p.args?.from || "").toLowerCase();
                  const to = (p.args?.to || "").toLowerCase();
                  const arr = (p.args?.ids || []).map(Number);
                  const vals = (p.args?.values || []).map(Number);
                  if (from === userLower && to === toolsLower) {
                    arr.forEach((id, i) => {
                      if ((vals[i] || 0) > 0) ids.push(id);
                    });
                  }
                }
              } catch (e) {
                console.log(e);
              }
            }
            return [...new Set(ids)].sort((a, b) => a - b);
          };

          const parsed = parseStakedFromReceipt(receipt);
          let evIdsSorted = [];
          if (parsed && parsed.user === userLower) evIdsSorted = [...parsed.ids].sort((a, b) => a - b);
          else evIdsSorted = parse1155TransfersFromReceipt(receipt);

          if (!evIdsSorted.length) {
            const c1155 = new ethers.Contract(
                contractAddressTools,
                ["function balanceOf(address account, uint256 id) view returns (uint256)"],
                provider,
            );

            const candidates = (Array.isArray(tokenIds) ? tokenIds : []).map(Number);

            const holder = contractAddressTools.toLowerCase(); // self-custody; if you ever move to a vault, swap here
            const deposited = [];
            for (const id of [...new Set(candidates)]) {
              const bal = await c1155.balanceOf(holder, id).catch(() => 0);
              if (Number(bal) > 0) deposited.push(id);
            }
            if (deposited.length) {
              evIdsSorted = deposited.sort((a, b) => a - b);
            }
          }

          if (evIdsSorted.length === 0) {
            const jobId = stableRequestIdFrom({
              op: "stake_job",
              userAddress,
              collectionAddress,
              transactionHash,
              tokenIds: [...new Set((tokenIds || []).map(Number))].sort((a, b) => a - b),
            });
            await db.collection("stake_jobs").doc(jobId).set({
              status: "pending",
              userAddress,
              collectionAddress,
              txHash: transactionHash,
              requestedTokenIds: [...new Set((tokenIds || []).map(Number))].sort((a, b) => a - b),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              attempts: 0,
              lastError: "tools_parse_produced_no_ids",
              ownerUid: decoded.uid,
            }, {merge: true});
            return {status: 202, body: {success: true, status: "pending", requestId: jobId, txHash: transactionHash}};
          }
          // Count tents by costId and enforce "one tent" limit up-front
          const looksLikeTent = (s) =>
            String(s || "").toLowerCase().replace(/[_\s-]+/g, " ").includes("tent");

          {
            const userRef = db.collection("users").doc(userLower);
            const userSnap = await userRef.get();
            const alreadyHasTent = Number(userSnap.data()?.has_tent || 0) > 0;

            if (alreadyHasTent) {
            // Only check as many ids as needed; stop on first Tent
              const c1155 = new ethers.Contract(contractAddressTools, TOOLNFT_META_ABI, provider);
              for (const id of evIdsSorted) {
                try {
                  const tt = await c1155.tokenTypes(Number(id));
                  if (looksLikeTent(tt)) {
                    return err(400, "You already have a tent staked.");
                  }
                } catch (e) {
                // ignore and keep probing the next id
                }
              }
            // No tent found among these IDs → continue staking flow
            }
          }

          // ---------- Resolve toolType/rarity for all ids (reliable Tent detection) ----------
          const c1155 = new ethers.Contract(contractAddressTools, TOOLNFT_META_ABI, provider);
          const typePairs = await Promise.all(
              evIdsSorted.map(async (id) => {
                try {
                  const [tt, rr] = await Promise.all([
                    c1155.tokenTypes(Number(id)),
                    c1155.tokenRarities(Number(id)),
                  ]);
                  return {id: Number(id), toolType: tt, rarity: rr};
                } catch (e) {
                  console.log("type/rarity fetch failed for", id, e);
                  return {id: Number(id), toolType: null, rarity: null};
                }
              }),
          );
          const byId = new Map(typePairs.map((p) => [p.id, p]));

          const tentCountsByCostId = new Map();
          for (const p of typePairs) {
            if (looksLikeTent(p.toolType)) {
              const costId = `${String(p.toolType || "").toLowerCase()}_${String(p.rarity || "").toLowerCase()}`;
              tentCountsByCostId.set(costId, (tentCountsByCostId.get(costId) || 0) + 1);
            }
          }
          if (tentCountsByCostId.size > 0) {
            const numTentsRequested = [...tentCountsByCostId.values()].reduce((a, b) => a + b, 0);
            const userRef = db.collection("users").doc(userLower);
            const userSnap = await userRef.get();
            const alreadyHasTent = Number(userSnap.data()?.has_tent || 0) > 0;
            if (alreadyHasTent) return err(400, "You already have a tent staked.");
            if (numTentsRequested > 1) return err(400, "You can only stake one tent.");
          }

          // ---------- Upsert staked_nfts (write-first) ----------
          const stakedCol = db.collection("staked_nfts");
          const batch = db.batch();
          for (const tokenId of evIdsSorted) {
            const docId = `${userLower}_${toolsLower}_${tokenId}`;
            const p = byId.get(Number(tokenId)) || {};
            let quick = {};
            if (p.toolType && p.rarity) {
              quick = fromToolRarity(p.toolType, p.rarity); // {metaUri,image,name,toolType,rarity}
            }

            batch.set(stakedCol.doc(docId), {
              ownerUid: decoded.uid,
              userAddress,
              collectionAddress: contractAddressTools,
              tokenId: Number(tokenId),
              toolType: null, rarity: null, category: "tool",
              metaUri: null,
              stakedAt: admin.firestore.FieldValue.serverTimestamp(),
              durability: 20,
              is_mining: 0,
              mining_end: 0,
              txHash: transactionHash,
              pending_meta: true,
              lastMetaFetchAt: null,
              ...(quick.metaUri ? {metaUri: quick.metaUri} : {}),
              ...(quick.image ? {image: quick.image} : {}),
              ...(quick.name ? {name: quick.name} : {}),
              ...(quick.toolType ? {toolType: quick.toolType} : {}),
              ...(quick.rarity ? {rarity: quick.rarity} : {}),
            }, {merge: true});
          }
          await batch.commit();

          // ---------- Apply Tent capacity (villagers & available) + boost + has_tent (idempotent by requestId) ----------
          if (tentCountsByCostId.size > 0) {
            const numTentsRequested = [...tentCountsByCostId.values()].reduce((a, b) => a + b, 0);

            // fetch slots & boost for each tent costId
            let totalSlots = 0;
            let totalBoost = 0;
            const ids = Array.from(tentCountsByCostId.keys());
            const costRefs = ids.map((id) => db.collection("craft_cost_tools").doc(id.toLowerCase()));
            const snaps = await Promise.all(costRefs.map((r) => r.get()));
            snaps.forEach((snap, i) => {
              if (!snap.exists) return;
              const data = snap.data() || {};
              const slots = Number(data.slots || 0);
              const boost = Number(data.boost || 0);
              const count = tentCountsByCostId.get(ids[i]) || 0;
              if (Number.isFinite(slots) && slots > 0) totalSlots += slots * count;
              if (Number.isFinite(boost) && boost > 0) totalBoost += boost * count;
            });

            const userRef = db.collection("users").doc(userLower);
            const markRef = db.collection("stake_capacity_marks").doc(requestId);

            await db.runTransaction(async (tx) => {
              const [markSnap, userSnap] = await Promise.all([tx.get(markRef), tx.get(userRef)]);
              if (markSnap.exists) return; // already applied for this requestId

              const user = userSnap.exists ? (userSnap.data() || {}) : {};
              const alreadyHasTent = Number(user.has_tent || 0) > 0;

              // Respect the one-tent rule (you already checked earlier; this double-checks under race conditions)
              if (alreadyHasTent) throw new Error("You already have a tent staked.");
              if (numTentsRequested > 1) throw new Error("You can only stake one tent.");

              const updates = {has_tent: 1};

              // capacity & available villagers
              if (totalSlots > 0) {
                updates.villagers = admin.firestore.FieldValue.increment(totalSlots);
                updates.villagers_available = admin.firestore.FieldValue.increment(totalSlots);
              }

              // boost from tent
              if (totalBoost > 0) {
                updates.boost = admin.firestore.FieldValue.increment(totalBoost);
              }

              tx.update(userRef, updates);

              tx.set(markRef, {
                applied: true,
                slots: totalSlots,
                boost: totalBoost,
                setHasTent: true,
                userAddress,
                collectionAddress,
                txHash: transactionHash,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            });
          }

          // ---------- Enqueue metadata jobs ----------
          const jobs = db.collection("staked_meta_jobs");
          const jobBatch = db.batch();
          for (const tokenId of evIdsSorted) {
            const jobId = `${userLower}_${toolsLower}_${tokenId}`;
            jobBatch.set(jobs.doc(jobId), {
              userAddress,
              collectionAddress,
              tokenId: Number(tokenId),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              attempts: 0,
            }, {merge: true});
          }
          await jobBatch.commit();

          return ok({success: true, kind: "tools1155", upserted: evIdsSorted.length, blockNumber: receipt.blockNumber});
        });

        return res.status(result.status).json(result.body);
      } catch (e) {
        if (e.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("stakeNfts error:", e);
        return res.status(500).send(e.message || "Internal error during staking.");
      }
    }),
);


// Trigger when a stake job is created
exports.reconcileStakeV2 = onDocumentCreated(
    {
      document: "stake_jobs/{jobId}",
      region: "us-central1",
      timeoutSeconds: 540,
      memory: "512MiB",
    },
    withKillSwitchBg(async (event) => {
      const snap = event.data;
      if (!snap) return;
      await finalizeStakeJobV2(snap.ref, snap.data());
    }),
);

// Sweeper (picks up stuck/pending)
exports.sweepStakeJobsV2 = onSchedule(
    {
      region: "us-central1",
      schedule: "every 2 minutes",
      timeZone: "UTC",
      timeoutSeconds: 240,
      memory: "512MiB",
    },
    withKillSwitchBg(async () => {
      const take = async (status) => db.collection("stake_jobs")
          .where("status", "==", status)
          .limit(20)
          .get();
      const pend = await take("pending");
      const procs = await take("processing");
      const docs = [...pend.docs, ...procs.docs];
      if (docs.length === 0) return;

      for (const doc of docs) {
        const job = doc.data() || {};
        // if "processing" is stale (>6 min since lastAttemptAt), push back to pending
        if (job.status === "processing") {
          const last = job.lastAttemptAt?.toMillis?.() ?? 0;
          if (Date.now() - last > 6 * 60 * 1000) {
            await doc.ref.update({status: "pending", lastError: "processing watchdog reset"});
          }
        }
        try {
          await finalizeStakeJobV2(doc.ref, doc.data());
        } catch (e) {
          console.error("sweepStakeJobsV2 item error:", doc.id, e);
        }
      }
    }),
);

// Optional manual poke (like pokeMintJob)
exports.pokeStakeJob = onRequest(
    {region: "us-central1", timeoutSeconds: 300, memory: "512MiB"},
    withKillSwitchHttp(async (req, res) => {
      try {
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized.");
        await admin.auth().verifyIdToken(idToken);

        const {requestId} = req.body?.data || {};
        if (!requestId) return err(400, "Missing requestId.");

        const jobRef = db.collection("stake_jobs").doc(requestId);
        const snap = await jobRef.get();
        if (!snap.exists) return res.status(404).send("Job not found.");

        const job = snap.data() || {};
        if (job.status === "completed") {
          return res.status(200).json({success: true, status: "completed"});
        }

        const rc = await provider.waitForTransaction(String(job.txHash), 1, 5_000).catch(() => null);
        if (!rc || Number(rc.status) !== 1) {
          return res.status(200).json({success: true, status: job.status, note: "tx not confirmed yet"});
        }

        await finalizeStakeJobV2(jobRef, job);
        const done = await jobRef.get();
        return res.status(200).json({success: true, status: done.data()?.status || "unknown"});
      } catch (err) {
        console.error("pokeStakeJob error:", err);
        return res.status(500).send(err.message || "Internal error.");
      }
    }),
);

exports.getServerTime = functions.https.onCall((data, context) => {
  // Returns the current server time in milliseconds since epoch
  return {now: Date.now()};
});


const SEASON_START_GMT_MS = Date.UTC(2025, 8, 13, 18, 0, 0); // Wed 2025-09-10 18:00 GMT
const SEASONS = ["Autumn", "Winter", "Spring", "Summer"];
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function getCurrentSeasonInfo(nowMs = Date.now()) {
  const delta = Math.max(0, nowMs - SEASON_START_GMT_MS);
  const weekIndex = Math.floor(delta / WEEK_MS);
  const season = SEASONS[weekIndex % 4];
  const dayNumber = (Math.floor(delta / DAY_MS) % 7) + 1; // 1..7
  return {season, dayNumber};
}

function clampEnergyMultiplier(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return 1;
  return Math.max(0.1, Math.min(10, x));
}

function keyForCosts(toolRaw) {
  let k = String(toolRaw || "").toLowerCase().trim();
  k = k.replace(/[\s-]+/g, "_"); // spaces/hyphens -> underscore
  if (k === "shortbow") k = "Short_Bow";
  if (k === "longbow") k = "long_bow";
  return k.replace(/_+/g, "_"); // collapse repeats
}

exports.startMining = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
      // 1. Authentication
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        let decodedToken;
        try {
          decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        // 2. Inputs
        const {stakedNftDocId, miningTime, nonce, signature} = req.body.data || {};
        const uid = decodedToken.uid;
        if (!stakedNftDocId || !Number.isInteger(miningTime) || miningTime <= 0) {
          return err(400, "Missing or invalid parameters.");
        }
        if (!nonce || !signature) return err(400, "Missing signed intent.");

        // 2b. Verify signed intent
        const signedPayload = {stakedNftDocId, miningTime, nonce};
        const message = `Start mining: ${JSON.stringify(signedPayload)}`;
        let recovered;
        try {
          recovered = ethers.verifyMessage(message, signature);
        } catch {
          return res.status(401).send("Invalid signature.");
        }
        if (recovered.toLowerCase() !== uid.toLowerCase()) {
          return res.status(401).send("Signature/user mismatch.");
        }

        await consumeNonceOrFail(uid.toLowerCase(), "startMining", String(nonce));
        const requestId = stableRequestIdFrom({op: "startMining", uid, stakedNftDocId, miningTime, nonce});

        const {season, dayNumber} = getCurrentSeasonInfo(Date.now());
        const seasonDocRef = db.collection("seasons").doc(season);

        const result = await withUserMutex(uid, requestId, async (lock) => {
          const userDocRef = db.collection("users").doc(uid);
          const stakedNftRef = db.collection("staked_nfts").doc(stakedNftDocId);

          await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            const stakedNftDoc = await transaction.get(stakedNftRef);
            const seasonDoc = await transaction.get(seasonDocRef);

            if (!userDoc.exists) throw new Error("User data not found.");
            if (!stakedNftDoc.exists) throw new Error("Staked tool not found.");

            const userData = userDoc.data();
            const nftData = stakedNftDoc.data();

            const hasHistorian = Number(userData.has_historian || 0) > 0;
            const hasMedallion = Number(userData.has_medallion || 0) > 0;
            const permittedMax = maxHoursByPerks(hasHistorian, hasMedallion);

            const toolType = nftData.toolType || "";
            if (!isAllowedToolType(toolType)) {
              throw new Error("This item cannot mine. Allowed: Axe, Pick, Spear, Bow.");
            }
            // Bows are hard-capped at 8h even with perks
            const perToolMax = isBowType(toolType) ? Math.min(permittedMax, 8) : permittedMax;

            // --- Checks ---
            if ((nftData.userAddress || "").toLowerCase() !== uid.toLowerCase()) {
              throw new Error("Permission denied: Not your tool.");
            }
            if (nftData.is_mining === 1) throw new Error("This tool is already mining.");

            if (miningTime > perToolMax) {
              throw new Error(`Mining time exceeds your perk limit (${permittedMax}h).`);
            }
            if (nftData.durability < miningTime) {
              throw new Error("Not enough durability for this duration.");
            }
            if ((userData.villagers_available || 0) < 1) {
              throw new Error("No villagers available to mine.");
            }

            // Costs
            const costDocId = `${keyForCosts(nftData.toolType)}_${(nftData.rarity || "").toLowerCase()}`;
            const costDocRef = db.collection("craft_cost_tools").doc(costDocId.toLowerCase());
            const costDoc = await transaction.get(costDocRef);
            if (!costDoc.exists) throw new Error("Tool cost info not found." + costDocId + costDocRef);

            const energyPerHour = Number(costDoc.data().energy || 0);

            // === NEW: season multiplier (fallback 1, clamped 0.1..10) ===
            const raw = seasonDoc.exists ? seasonDoc.data()[String(dayNumber)] : undefined;
            const energyMultiplier = clampEnergyMultiplier(raw);

            // === NEW: apply multiplier and ceil (same as client) ===
            const totalEnergyCost = Math.ceil(energyPerHour * miningTime * energyMultiplier);
            if ((userData.energy || 0) < totalEnergyCost) throw new Error("Not enough energy.");

            // Updates
            const miningEndTime = Date.now() + miningTime * 3600 * 1000;
            transaction.update(userDocRef, {
              energy: FieldValue.increment(-totalEnergyCost),
              villagers_available: FieldValue.increment(-1),
            });
            transaction.update(stakedNftRef, {
              is_mining: 1,
              mining_time: miningTime,
              mining_end: miningEndTime,
              energy_multiplier_applied: energyMultiplier,
              season_applied: season,
              season_day_applied: dayNumber,
            });
          });

          console.log(`User ${uid} started mining with ${stakedNftDocId}`);
          const response = ok({success: true});
          await lock.markCompleted({stakedNftDocId, miningTime});
          return response;
        }, {scope: "mining", idempotencyKey: requestId});

        return res.status(result.status).json(result.body);
      } catch (error) {
        if (error.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("Error in startMining:", error);
        return res.status(500).send(error.message || "An internal error occurred.");
      }
    }),
);

const makeCostId = (toolType, rarity) =>
  (`${keyForCosts(toolType)}_${String(rarity || "").trim().toLowerCase()}`).toLowerCase();

exports.startMiningBatch = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
      // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }
        const uid = decoded.uid?.toLowerCase();

        // --- Inputs ---
        const {stakedNftDocIds, miningTime, nonce, signature} = req.body.data || {};
        if (!Array.isArray(stakedNftDocIds) || stakedNftDocIds.length === 0 || !Number.isInteger(miningTime) || miningTime <= 0) {
          return err(400, "Missing or invalid parameters.");
        }
        if (!nonce || !signature) return err(400, "Missing signed intent.");

        // --- Verify sig over canonical payload ---
        const uniqueSortedIds = [...new Set(stakedNftDocIds.map(String))].sort();
        const signedPayload = {stakedNftDocIds: uniqueSortedIds, miningTime, nonce};
        const message = `Start mining (batch): ${JSON.stringify(signedPayload)}`;
        let recovered;
        try {
          recovered = ethers.verifyMessage(message, signature).toLowerCase();
        } catch {
          return res.status(401).send("Invalid signature.");
        }
        if (recovered !== uid) return res.status(401).send("Signature/user mismatch.");

        try {
          await consumeNonceOrFail(uid, "startMiningBatch", String(nonce));
        } catch (e) {
          return err(400, e.message || "Nonce error.");
        }

        const requestId = stableRequestIdFrom({op: "startMiningBatch", uid, ids: uniqueSortedIds, miningTime, nonce});

        // --- NEW: season info pulled once (same as single start) ---
        const {season, dayNumber} = getCurrentSeasonInfo(Date.now());
        const seasonDocRef = db.collection("seasons").doc(season);

        const result = await withUserMutex(uid, requestId, async (lock) => {
          const userRef = db.collection("users").doc(uid);
          const toolRefs = uniqueSortedIds.map((id) => db.collection("staked_nfts").doc(id));

          let processed = 0;
          let totalEnergyDebited = 0;

          await db.runTransaction(async (tx) => {
          // Load user + season + tools
            const [userSnap, seasonSnap, ...toolSnaps] = await Promise.all([
              tx.get(userRef),
              tx.get(seasonDocRef),
              ...toolRefs.map((r) => tx.get(r)),
            ]);

            if (!userSnap.exists) throw new Error("User data not found.");
            const user = userSnap.data();

            const hasHistorian = Number(user.has_historian || 0) > 0;
            const hasMedallion = Number(user.has_medallion || 0) > 0;

            // Batch requires either perk
            if (!(hasHistorian || hasMedallion)) {
              throw new Error("Batch start requires Historian or Research Medallion.");
            }

            const permittedMax = maxHoursByPerks(hasHistorian, hasMedallion);
            if (miningTime > permittedMax) {
              throw new Error(`Mining time exceeds your perk limit (${permittedMax}h).`);
            }

            // Season multiplier (global)
            const rawSeasonValue = seasonSnap.exists ? seasonSnap.data()[String(dayNumber)] : undefined;
            const seasonMultBase = clampEnergyMultiplier(rawSeasonValue);

            // NEW: per-user season exemption (optional)
            // If `users/{uid}.season_exemptions.Winter === true`, ignore seasonal multiplier.
            const userExempt = !!(user.season_exemptions?.[season]);
            const seasonMultEffective = userExempt ? 1 : seasonMultBase;

            // NEW: per-user override (optional), e.g. `users/{uid}.energy_multipliers = { default: 1, Winter: 0.9 }`
            const perUserMult = clampEnergyMultiplier(
                (user.energy_multipliers?.[season] ?? user.energy_multipliers?.default ?? 1),
            );

            // Validate tools + collect costs
            const tools = toolSnaps.map((s) => {
              if (!s.exists) throw new Error("Staked tool not found.");
              return {id: s.id, ref: s.ref, data: s.data()};
            });

            const costIds = new Set();
            for (const t of tools) {
              const d = t.data;
              if ((d.userAddress || "").toLowerCase() !== uid) throw new Error("Permission denied: Not your tool.");
              if (d.is_mining === 1) throw new Error("One or more tools already mining.");
              if ((d.durability || 0) < miningTime) throw new Error("One or more tools lack durability.");
              if (!isAllowedToolType(d.toolType)) {
                throw new Error("One or more items cannot mine. Allowed: Axe, Pick, Spear, Bow.");
              }
              if (isBowType(d.toolType) && miningTime > 8) throw new Error("Bows are capped at 8h per run.");
              const costId = makeCostId(d.toolType, d.rarity);
              costIds.add(costId);
            }

            // Fetch costs once
            const costRefs = [...costIds].map((id) => db.collection("craft_cost_tools").doc(id));
            const costSnaps = await Promise.all(costRefs.map((r) => tx.get(r)));
            const costMap = {};
            costSnaps.forEach((snap, i) => {
              if (!snap.exists) throw new Error(`Tool cost info not found for ${costRefs[i].id}`);
              const data = snap.data();
              costMap[costRefs[i].id] = {energy: Number(data.energy || 0), income: Number(data.income || 0)};
            });

            // Compute total energy using per-tool multipliers and ceil per tool (same as client)
            let totalEnergy = 0;
            const perToolComputed = [];

            for (const t of tools) {
              const d = t.data;
              const cid = makeCostId(d.toolType, d.rarity);
              const entry = costMap[cid];
              if (!entry) throw new Error(`Tool cost info not found for ${cid}`);
              const energyPerHour = entry.energy;

              // NEW: optional per-tool modifier (e.g., tent/skin/gear), server-controlled
              const perToolMult = clampEnergyMultiplier(d.energy_multiplier ?? 1);

              const appliedMult = clampEnergyMultiplier(seasonMultEffective * perUserMult * perToolMult);
              const toolCost = Math.ceil(energyPerHour * miningTime * appliedMult);

              totalEnergy += toolCost;
              perToolComputed.push({
                ref: t.ref,
                appliedMult,
                breakdown: {season: seasonMultEffective, user: perUserMult, tool: perToolMult},
              });
            }

            if ((user.energy || 0) < totalEnergy) throw new Error("Not enough energy.");
            if ((user.villagers_available || 0) < tools.length) throw new Error("Not enough villagers.");

            const miningEnd = Date.now() + miningTime * 3600 * 1000;

            // Apply updates
            tx.update(userRef, {
              energy: admin.firestore.FieldValue.increment(-totalEnergy),
              villagers_available: admin.firestore.FieldValue.increment(-tools.length),
            });

            for (const t of tools) {
              const computed = perToolComputed.find((x) => x.ref.path === t.ref.path);
              tx.update(t.ref, {
                is_mining: 1,
                mining_time: miningTime,
                mining_end: miningEnd,
                // NEW: persist applied multiplier & breakdown for audit/debug
                energy_multiplier_applied: computed?.appliedMult ?? 1,
                energy_multiplier_breakdown: computed?.breakdown ?? {season: 1, user: 1, tool: 1},
                season_applied: season,
                season_day_applied: dayNumber,
              });
            }

            processed = tools.length;
            totalEnergyDebited = totalEnergy;
          });

          const response = ok({
            success: true,
            processed,
            season,
            dayNumber,
            // helpful for telemetry/UX
            totalEnergyDebited: totalEnergyDebited,
          });

          await lock.markCompleted({processed, miningTime});
          return response;
        }, {scope: "mining", idempotencyKey: requestId});

        return res.status(result.status).json(result.body);
      } catch (err) {
        if (err.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("startMiningBatch error:", err);
        return res.status(500).send(err.message || "Internal error.");
      }
    }),
);


exports.collectRewards = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized");
        let decodedToken;
        try {
          decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized");
        }

        // --- Input + stateless verify ---
        const data = req.body?.data || {};
        const {stakedNftDocIds, nonce, signature} = data;
        const ids = Array.isArray(stakedNftDocIds) ? stakedNftDocIds : [];
        if (ids.length === 0) return res.status(400).send("Missing stakedNftDocIds");
        if (!nonce || !signature) return res.status(400).send("Missing nonce/signature.");

        const idsForSig = [...new Set(ids.map(String))].sort();
        const message = `Collect rewards: ${JSON.stringify({stakedNftDocIds: idsForSig, nonce})}`;
        let recovered;
        try {
          recovered = ethers.verifyMessage(message, signature).toLowerCase();
        } catch {
          return res.status(401).send("Invalid signature.");
        }

        const authAddr = (decodedToken.walletAddress || decodedToken.address || decodedToken.uid || "").toLowerCase();
        if (recovered !== authAddr) return res.status(401).send("Signature does not match authenticated user.");

        const collectorUid = decodedToken.uid; // users/{uid}
        const requestId = stableRequestIdFrom({op: "collectRewards", uid: collectorUid, nonce, ids: idsForSig});

        const FieldValue = admin.firestore.FieldValue;

        const TIER_PCT = [0.1, 0.5, 1.0, 1.7, 2.5, 3.5, 5.0];
        const pctForLevel = (lvl) => TIER_PCT[Math.max(0, Math.min(6, Number(lvl) | 0))] || 0.1;

        const result = await withUserMutex(
            collectorUid,
            requestId,
            async (lock) => {
              const userRef = db.collection("users").doc(collectorUid);
              const rankingsRef = db.collection("rankings").doc(collectorUid);

              await consumeNonceOrFail(authAddr, "collect", String(nonce));

              // ---------- TRANSACTION ----------
              const outcome = await db.runTransaction(async (tx) => {
                // ====== PHASE 1: ALL READS ======
                // Collector user
                const userSnap = await tx.get(userRef);
                if (!userSnap.exists) throw new Error("User data not found");
                const userData = userSnap.data() || {};

                const hasHistorian = Number(userData.has_historian || 0) > 0;
                const hasMedallion = Number(userData.has_medallion || 0) > 0;
                const myUsername = String(userData.username || "");

                // --- NEW: tent boost flags/values ---
                const hasTent = Number(userData.has_tent || 0) > 0;
                // Prefer nested boosts.mining if present; fallback to flat boost
                const boostRaw = (userData?.boosts?.mining ?? userData?.boost ?? 0);
                const tentBoostPct = hasTent ? Math.max(0, Number(boostRaw) || 0) : 0; // e.g., 3 => 3%
                const tentBoostMult = 1 + (tentBoostPct / 100);

                // Batch restriction
                if (idsForSig.length > 1 && !(hasHistorian || hasMedallion)) {
                  throw new Error("Batch collect requires Historian or Research Medallion.");
                }
                if (idsForSig.length > 420) throw new Error("Too many tools at once");

                // Potential referrer reads (optional)
                const referredByName = String(userData.referredBy || "").trim();
                let refUid = null;
                let refUserSnap = null;
                let refUserData = null;

                if (referredByName) {
                  const unameRef = db.collection("usernames").doc(referredByName.toLowerCase());
                  const unameSnap = await tx.get(unameRef);
                  if (unameSnap.exists) {
                    refUid = String(unameSnap.data()?.uid || "");
                    if (refUid) {
                      const refUserRef = db.collection("users").doc(refUid);
                      refUserSnap = await tx.get(refUserRef);
                      if (refUserSnap.exists) {
                        refUserData = refUserSnap.data() || {};
                      } else {
                        refUid = null;
                      }
                    }
                  }
                }

                // Staked tools
                const nftRefs = idsForSig.map((id) => db.collection("staked_nfts").doc(id));
                const nftSnaps = await tx.getAll(...nftRefs);

                // Identify eligible and gather cost ids
                const now = Date.now();
                const eligible = [];
                const costIdSet = new Set();

                for (let i = 0; i < nftSnaps.length; i++) {
                  const snap = nftSnaps[i];
                  if (!snap.exists) continue;
                  const d = snap.data() || {};

                  const owner = String(d.userAddress || "").toLowerCase();
                  if (owner !== authAddr) continue;
                  if (Number(d.is_mining || 0) !== 1) continue;

                  const endMs =
                typeof d.mining_end === "number" ?
                  d.mining_end :
                  d.mining_end?.toMillis?.() ?? 0;
                  if (endMs > now) continue;

                  const toolTypeLower = String(d.toolType || "").toLowerCase();
                  const rarity = String(d.rarity || "").toLowerCase();

                  let rewardType = "";
                  if (toolTypeLower.includes("pick")) rewardType = "stone";
                  else if (toolTypeLower.includes("axe")) rewardType = "wood";
                  else if (toolTypeLower.includes("spear")) rewardType = "food";
                  else if (toolTypeLower.includes("bow")) rewardType = "skin";
                  if (!rewardType) continue;

                  const costId = `${keyForCosts(d.toolType)}_${rarity}`;
                  costIdSet.add(costId);

                  eligible.push({
                    index: i,
                    miningTime: Number(d.mining_time || 0),
                    rewardType,
                    costId,
                  });
                }

                if (eligible.length === 0) throw new Error("No eligible tools to collect");

                // Tool incomes (per costId)
                const costIds = Array.from(costIdSet);
                const costRefs = costIds.map((id) => db.collection("craft_cost_tools").doc(id.toLowerCase()));
                const costSnaps = costRefs.length ? await tx.getAll(...costRefs) : [];
                const incomeByCostId = new Map();
                for (let i = 0; i < costSnaps.length; i++) {
                  const snap = costSnaps[i];
                  const id = costIds[i];
                  incomeByCostId.set(id, snap.exists ? Number(snap.data()?.income || 0) : 0);
                }

                // Referral eligibility + percent
                let refEligible = false;
                let refPercent = 0;
                let refUsername = "";

                if (refUid && refUserData) {
                  const cap =
                (Number(refUserData.has_medallion || 0) > 0 ? 5 : 0) +
                (Number(refUserData.has_historian || 0) > 0 ? 25 : 0);

                  if (cap > 0) {
                    const listUid = Array.isArray(refUserData.myReferralsUid) ?
                  refUserData.myReferralsUid :
                  [];

                    // fall back to username list if uid list missing
                    let pos = -1;
                    if (listUid.length) {
                      pos = listUid.indexOf(collectorUid);
                    } else if (myUsername && Array.isArray(refUserData.myReferrals)) {
                      pos = refUserData.myReferrals.indexOf(myUsername);
                    }

                    refEligible = pos > -1 && pos < cap;
                    const level = Number(refUserData.referral_level || 0);
                    refPercent = refEligible ? (pctForLevel(level) / 100) : 0;
                    refUsername = String(refUserData.username || referredByName);
                  }
                }

                // ====== PHASE 2: COMPUTE ======
                let villagersToReturn = 0;
                const totals = {food: 0, wood: 0, stone: 0, total: 0};
                const bonus = {food: 0, wood: 0, stone: 0}; // for referrer
                let skinWins = 0;

                const penaltyPercent = (miningTime) =>
                  calculatePenalty(miningTime, hasHistorian, hasMedallion); // your existing helper

                for (const e of eligible) {
                  const income = Number(incomeByCostId.get(e.costId) || 0);

                  if (e.rewardType === "skin") {
                    // Bows: RNG chance; tent boost does NOT affect skin chance.
                    const chancePct = Math.max(
                        0,
                        Math.min(100, income * e.miningTime * (1 - penaltyPercent(e.miningTime) / 100)),
                    );
                    if (rollUnderPct(chancePct)) skinWins += 1;
                  } else {
                    // Resource tools: apply penalty, then tent boost multiplier if has_tent.
                    const base = income * e.miningTime;
                    const finBase = base * (1 - penaltyPercent(e.miningTime) / 100);
                    const finUser = finBase * (tentBoostMult); // <-- tent boost applied here

                    if (finUser > 0) {
                      totals[e.rewardType] += finUser;
                      totals.total += finUser;

                      // If you want referral to be on *pre-boost* base instead, change finUser->finBase below.
                      if (refPercent > 0) {
                        bonus[e.rewardType] += finUser * refPercent;
                      }
                    }
                  }

                  villagersToReturn += 1;
                }

                // ====== PREP BEFORE WRITES (still no writes yet) ======
                let flatRef = null;
                let flatSnap = null;
                if (refUid && refEligible && refPercent > 0) {
                  flatRef = db.collection("referrals").doc(`${refUid}_${collectorUid}`);
                  flatSnap = await tx.get(flatRef);
                }

                // ====== PHASE 3: WRITES (no more reads after this point) ======

                // a) Clear mining and reduce durability on each tool
                for (const e of eligible) {
                  tx.update(nftRefs[e.index], {
                    is_mining: 0,
                    mining_time: 0,
                    mining_end: 0,
                    durability: FieldValue.increment(-e.miningTime),
                  });
                }

                // b) Update collector resources + villagers
                const userUpdates = {
                  villagers_available: FieldValue.increment(villagersToReturn),
                };
                if (totals.food) userUpdates.food = FieldValue.increment(totals.food);
                if (totals.wood) userUpdates.wood = FieldValue.increment(totals.wood);
                if (totals.stone) userUpdates.stone = FieldValue.increment(totals.stone);
                tx.update(userRef, userUpdates);

                // c) Rankings (public)
                tx.set(
                    rankingsRef,
                    {total_rewards: FieldValue.increment(totals.total)},
                    {merge: true},
                );

                // d) Referral bonus (if eligible)
                if (refUid && refEligible && refPercent > 0) {
                  const refUserRef = db.collection("users").doc(refUid);

                  const refIncrements = {};
                  if (bonus.food) refIncrements.food = FieldValue.increment(bonus.food);
                  if (bonus.wood) refIncrements.wood = FieldValue.increment(bonus.wood);
                  if (bonus.stone) refIncrements.stone = FieldValue.increment(bonus.stone);
                  if (Object.keys(refIncrements).length) tx.update(refUserRef, refIncrements);

                  const statsDocId = (refUsername ? refUsername.toLowerCase() : `uid:${refUid}`);
                  const refStatsRef = db.collection("referral_stats").doc(statsDocId);
                  tx.set(
                      refStatsRef,
                      {
                        referrerUid: refUid,
                        bonus_food: FieldValue.increment(bonus.food || 0),
                        bonus_wood: FieldValue.increment(bonus.wood || 0),
                        bonus_stone: FieldValue.increment(bonus.stone || 0),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                      },
                      {merge: true},
                  );

                  tx.set(
                      refStatsRef.collection("by_user").doc(collectorUid),
                      {
                        referred_uid: collectorUid,
                        referred_username: myUsername || collectorUid,
                        bonus_food: FieldValue.increment(bonus.food || 0),
                        bonus_wood: FieldValue.increment(bonus.wood || 0),
                        bonus_stone: FieldValue.increment(bonus.stone || 0),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                      },
                      {merge: true},
                  );

                  tx.set(
                      flatRef,
                      {
                        ...(flatSnap.exists ? {} : {createdAt: admin.firestore.FieldValue.serverTimestamp()}),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        referrerUid: refUid,
                        referrer: refUsername || "",
                        referred_uid: collectorUid,
                        referred_username: myUsername || collectorUid,
                        bonus_food: FieldValue.increment(bonus.food || 0),
                        bonus_wood: FieldValue.increment(bonus.wood || 0),
                        bonus_stone: FieldValue.increment(bonus.stone || 0),
                      },
                      {merge: true},
                  );
                }

                return {
                  processed: eligible.length,
                  villagersReturned: villagersToReturn,
                  totals,
                  referralBonus: bonus,
                  skinWins,
                  // (optional) you could return the boost info for UI:
                  tentBoostAppliedPct: tentBoostPct,
                  hasTent,
                };
              }); // end transaction

              // --- Enqueue & send skin mint jobs (idempotent) ---
              const skinMintJobs = [];
              if (outcome.skinWins > 0) {
                const userAddrLower = authAddr; // already lowercased above
                const baseKey = {collectRequestId: requestId, ids: idsForSig};
                for (let i = 0; i < outcome.skinWins; i++) {
                  try {
                    const j = await createAndSendSkinMintJob({
                      userAddressLower: userAddrLower,
                      baseKey,
                      idx: i,
                    });
                    skinMintJobs.push(j);
                  } catch (e) {
                    console.error("Failed to enqueue/send skin mint job:", e?.message || e);
                  }
                }
              }

              const response = ok({success: true, ...outcome, skinMintJobs});
              await lock.markCompleted({processed: response.body.processed});
              return response;
            },
            {scope: "collect", idempotencyKey: requestId},
        );

        return res.status(result.status).json(result.body);
      } catch (err) {
        if (err.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({
            busy: true,
            message: "Another action is in progress. Try again shortly.",
          });
        }
        console.error("collectRewards error:", err);
        return res.status(500).send(err.message || "Internal error");
      }
    }),
);


// --- TX waiting helpers ---
const TX_CONFIRM_TIMEOUT_MS = 180_000; // 3 minutes "primary" wait
const RECEIPT_BACKSTOP_MS = 300_000; // +5 minutes soft backstop polling
const RECEIPT_POLL_MS = 4_000; // poll interval

async function waitTxBounded(txOrHash, confirmations = 1, timeoutMs = TX_CONFIRM_TIMEOUT_MS) {
  const hash = typeof txOrHash === "string" ?
    txOrHash :
    (txOrHash?.hash || txOrHash?.transactionHash);
  if (!hash) throw new Error("waitTxBounded: missing tx hash");

  // 1) primary bounded wait (fast path)
  try {
    const rc = await provider.waitForTransaction(hash, confirmations, timeoutMs);
    return rc; // may be null on timeout on some providers
  } catch (e) {
    // fall through to backstop polling on timeouts / transient provider errors
    const msg = String(e?.message || e);
    if (!/timeout|TIMEOUT/i.test(msg)) throw e;
  }

  // 2) backstop polling (handles "I lost the socket but tx got mined")
  const start = Date.now();
  while (Date.now() - start < RECEIPT_BACKSTOP_MS) {
    const rc = await provider.getTransactionReceipt(hash);
    if (rc && rc.status === 1 && (rc.confirmations ?? 0) >= confirmations) return rc;
    await new Promise((r) => setTimeout(r, RECEIPT_POLL_MS));
  }
  return null; // still unknown; let caller decide (e.g., mark "pending")
}

exports.requestWithdraw = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
      // ---- Auth ----
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        // ---- Inputs ----
        const {
          userAddress,
          tokenIds,
          amounts, // BASE units (string/number); UI keeps sending these
          nonce, // REQUIRED
          validUntil, // REQUIRED (unix seconds)
          signature,
          ronAmount, // must be absent
        } = req.body?.data || {};

        if (ronAmount && Number(ronAmount) > 0) {
          return err(400, "RON withdrawals are not supported by this endpoint.");
        }

        // Basic validation
        if (!userAddress || !Array.isArray(tokenIds) || !Array.isArray(amounts) ||
          tokenIds.length === 0 || tokenIds.length !== amounts.length || signature == null) {
          return err(400, "Missing or invalid parameters.");
        }
        if (nonce == null || String(nonce).trim() === "") {
          return err(400, "Nonce is required.");
        }
        if (validUntil == null || Number.isNaN(Number(validUntil))) {
          return err(400, "validUntil (unix seconds) is required.");
        }
        if (!ethers.isAddress(userAddress)) return err(400, "Bad userAddress");

        try {
          assertAuthMatches(decoded, userAddress);
        } catch (e) {
          return res.status(403).send(e.message || "Permission denied.");
        }

        // TokenIds validation
        for (const id of tokenIds) {
          if (!Number.isInteger(Number(id)) || Number(id) < 0 || Number(id) > 2) {
            return err(400, "Bad tokenId");
          }
        }
        const tokenIdSet = new Set(tokenIds.map((x) => Number(x)));
        if (tokenIdSet.size !== tokenIds.length) {
          return err(400, "Duplicate tokenIds not allowed.");
        }

        // Amounts validation + min amount
        for (let i = 0; i < amounts.length; i++) {
          let v;
          try {
            v = ethers.toBigInt(String(amounts[i]));
          } catch {
            return err(400, `Bad amount for id ${tokenIds[i]}`);
          }
          if (v <= 0n) return err(400, `Amount for id ${tokenIds[i]} must be > 0`);
          if (v < MIN_GROSS_BASE) return err(400, `Amount for id ${tokenIds[i]} below minimum threshold.`);
        }

        // ---- Canonical pairs ----
        const pairs = canonicalPairs(tokenIds, amounts);

        // ---- EIP-712 exact signature ----
        const domain = eip712Domain(); // { name, version, chainId: CHAIN_ID, verifyingContract: CORE_ADDR }
        const types = {
          Withdraw: [
            {name: "user", type: "address"},
            {name: "pairsHash", type: "bytes32"},
            {name: "nonce", type: "string"},
            {name: "validUntil", type: "uint256"},
          ],
        };
        const value = {
          user: userAddress,
          pairsHash: pairsHashOf(pairs),
          nonce: String(nonce),
          validUntil: Number(validUntil),
        };

        let recovered;
        try {
          recovered = ethers.verifyTypedData(domain, types, value, signature);
        } catch {
          return res.status(401).send("Invalid signature.");
        }
        if (recovered.toLowerCase() !== String(userAddress).toLowerCase()) {
          return res.status(401).send("Invalid signature.");
        }
        if (Number(validUntil) <= Math.floor(Date.now() / 1000)) {
          return err(400, "Signature expired.");
        }

        // ---- Mutex + idempotency key (shared scope with deposit) ----
        const requestId = withdrawRequestId(userAddress, pairs, nonce);

        const result = await withUserMutex(
            userAddress,
            requestId,
            async (lock) => {
              const userRef = db.collection("users").doc(userAddress.toLowerCase());
              const withdrawRef = db.collection("withdrawals").doc(requestId);

              // Load user
              const snap = await userRef.get();
              if (!snap.exists) return res.status(404).send("User document not found.");
              const data = snap.data() || {};

              // Energy gate
              const MIN_ENERGY_TO_WITHDRAW = 999;
              if ((data.energy || 0) <= MIN_ENERGY_TO_WITHDRAW) {
                return res.status(403).send("Insufficient energy.");
              }

              // Cooldown
              {
                const nowMs = Date.now();
                const untilMs = Number(data.withdraw_cooldown_until || 0);
                if (untilMs && nowMs < untilMs) {
                  const when = new Date(untilMs).toISOString();
                  return err(429, `Withdrawal cooldown active. Try again at ${when}.`);
                }
              }

              // Tiers/fees
              const hasH = Number(data.has_historian || 0) === 1;
              const hasRM = Number(data.has_medallion || 0) === 1;
              let tier = "base";
              if (hasH && hasRM) tier = "both";
              else if (hasRM) tier = "rm";
              else if (hasH) tier = "h";

              const BANDS = {
                base: [700, 1000],
                rm: [500, 800],
                h: [300, 600],
                both: [100, 300],
              };

              function pickFeeBps(tier, userAddress, nonceStr, ids, amts) {
                const [min, max] = BANDS[tier];
                const range = BigInt(max - min + 1);
                const hash = ethers.solidityPackedKeccak256(
                    ["address", "string", "uint256[]", "uint256[]"],
                    [ethers.getAddress(userAddress), String(nonceStr), ids.map((x) => BigInt(x)), amts.map((a) => BigInt(a))],
                );
                const n = BigInt(hash);
                return min + Number(n % range);
              }

              const ids = pairs.map((p) => p.id);
              const grossBase = pairs.map((p) => p.amt);
              const feeBps = pickFeeBps(tier, userAddress, String(nonce), ids, grossBase);

              // Precompute fee/net in BASE
              const feeAmountsBase = [];
              const netAmountsBase = [];
              for (let i = 0; i < ids.length; i++) {
                const gb = ethers.toBigInt(String(grossBase[i]));
                const fee = (gb * BigInt(feeBps)) / 10000n;
                const net = gb - fee;
                if (net <= 0n) return err(400, `Amount for id ${ids[i]} too small after fee.`);
                feeAmountsBase[i] = fee.toString();
                netAmountsBase[i] = net.toString();
              }

              const core = new ethers.Contract(CORE_ADDR, CORE_ABI, provider);

              // ===== PHASE 1: RESERVE (LOCK) using HUMAN -> BASE availability =====
              let resumedFromReserved = false;
              try {
                await db.runTransaction(async (tx) => {
                  const fresh = await tx.get(userRef);
                  if (!fresh.exists) throw new Error("User document not found.");
                  const u = fresh.data() || {};

                  const wdoc = await tx.get(withdrawRef);
                  if (wdoc.exists) {
                    const w = wdoc.data() || {};
                    const status = w.status || "reserved";
                    if (["reserved", "settled", "partial"].includes(status)) {
                      resumedFromReserved = true;
                      return;
                    }
                  }

                  // Cooldown guard again inside txn
                  const nowMs = Date.now();
                  const untilMs = Number(u.withdraw_cooldown_until || 0);
                  if (untilMs && nowMs < untilMs) {
                    throw new Error(`COOLDOWN_UNTIL:${untilMs}`);
                  }

                  // Consume nonce atomically with reservation
                  await consumeNonceOrFailInTx(tx, userAddress.toLowerCase(), "withdraw", String(nonce));

                  const locks = (((u.locks || {}).resources) || {});
                  const lockUpdates = {};

                  for (let i = 0; i < ids.length; i++) {
                    const id = ids[i];
                    const field = fieldOf(id); // 'food' | 'wood' | 'stone'
                    const dec = TOKEN_DECIMALS[id] ?? 18;

                    const gb = ethers.toBigInt(String(grossBase[i]));
                    const currHuman = Number(u[field] || 0);
                    const currBase = parseHumanToBase(currHuman, dec);
                    const lockedBase = ethers.toBigInt(String(locks[field] || "0"));

                    const availableBase = currBase > lockedBase ? (currBase - lockedBase) : 0n;
                    if (availableBase < gb) throw new Error(`Insufficient available balance for ${field}.`);

                    lockUpdates[`locks.resources.${field}`] = (lockedBase + gb).toString();
                  }

                  tx.set(withdrawRef, {
                    userAddress: userAddress.toLowerCase(),
                    tokenIds: ids,
                    amountsBase: grossBase,
                    netAmountsBase,
                    feeAmountsBase,
                    feeBps,
                    tier,
                    nonce: String(nonce),
                    validUntil: Number(validUntil),
                    createdAt: Date.now(),
                    status: "reserved",
                    txHashes: [],
                    failures: [],
                    requestId,
                  }, {merge: false});

                  if (Object.keys(lockUpdates).length) tx.update(userRef, lockUpdates);

                  // Start cooldown upon reservation
                  tx.update(userRef, {
                    withdraw_cooldown_until: nowMs + WITHDRAW_COOLDOWN_MS,
                  });
                });
              } catch (e) {
                const msg = String(e?.message || e);
                if (msg.startsWith("COOLDOWN_UNTIL:")) {
                  const untilMs = Number(msg.split(":")[1] || 0);
                  const when = new Date(untilMs).toISOString();
                  return err(429, `Withdrawal cooldown active. Try again at ${when}.`);
                }
                throw e;
              }

              if (resumedFromReserved) {
                const wdocNow = await withdrawRef.get();
                const w = wdocNow.exists ? (wdocNow.data() || {}) : null;
                if (w && (w.status === "settled" || w.status === "partial")) {
                  return ok({
                    success: (w.status === "settled") && (!w.failures || w.failures.length === 0),
                    txHashes: w.txHashes || [],
                    failed: w.failures || [],
                    feeBps: w.feeBps,
                    netAmountsBase: w.netAmountsBase,
                    feeAmountsBase: w.feeAmountsBase,
                    tier: w.tier,
                    note: "Idempotent response.",
                  });
                }
                return err(409, "A withdrawal with this id is already reserved and in progress. Try again shortly.");
              }

              // ===== PHASE 2: ON-CHAIN PAYOUT (NET in BASE) =====
              const txHashes = [];
              const failures = [];
              const decBaseByFieldSucceeded = {}; // accumulate GROSS (BASE) that actually got paid per field

              for (let i = 0; i < ids.length; i++) {
                const id = ids[i];
                const field = TOKEN_ID_TO_FIELD[id];
                const netBase = ethers.toBigInt(String(netAmountsBase[i]));
                const gb = ethers.toBigInt(String(grossBase[i]));
                if (gb === 0n) continue;

                try {
                  const wrapperAddr = await core.wrapperOf(id);
                  if (!wrapperAddr || wrapperAddr === ethers.ZeroAddress) {
                    throw new Error(`Wrapper not found for id ${id}`);
                  }
                  const wrapper = new ethers.Contract(wrapperAddr, WRAPPER_ABI, wallet);

                  try {
                    await wrapper.ownerWrapFromVaultTo.staticCall(userAddress, netBase);
                  } catch (e) {
                    const msg = String(e?.shortMessage || e?.message || "");
                    if (/missing revert data/i.test(msg)) {
                      await wrapper.ownerWrapFromVaultTo.estimateGas(userAddress, netBase);
                    } else {
                      throw new Error(`ownerWrapFromVaultTo pre-sim failed: ${e.shortMessage || e.message}`);
                    }
                  }

                  const tx = await wrapper.ownerWrapFromVaultTo(userAddress, netBase);
                  const rc = await waitTxBounded(tx, WAIT_CONFS_WITHDRAW, TX_CONFIRM_TIMEOUT_MS);
                  if (!rc) throw new Error("TX_CONFIRM_TIMEOUT");
                  const txHash = rc?.hash || rc?.transactionHash || tx?.hash || "";
                  if (!txHash) throw new Error("Transaction mined but no hash available");
                  txHashes.push(txHash);

                  decBaseByFieldSucceeded[field] = (decBaseByFieldSucceeded[field] || 0n) + gb;
                } catch (e) {
                  failures.push({id, error: String(e?.message || e)});
                  // continue with other ids
                }
              }

              // ===== PHASE 3: SETTLE DB — HUMAN is source of truth =====
              let txnFailed = false;
              let txnErrorMsg = "";
              try {
                await db.runTransaction(async (tx) => {
                  const fresh = await tx.get(userRef);
                  if (!fresh.exists) throw new Error("User document not found.");
                  const u = fresh.data() || {};

                  const updatesHuman = {}; // set exact next human numbers
                  const lockReleases = {}; // release reserved BASE

                  const lockedMap = (((u.locks || {}).resources) || {});
                  for (let i = 0; i < ids.length; i++) {
                    const id = ids[i];
                    const field = fieldOf(id);
                    const dec = TOKEN_DECIMALS[id] ?? 18;

                    const gb = ethers.toBigInt(String(grossBase[i]));
                    const lockedBase = ethers.toBigInt(String(lockedMap[field] || "0"));
                    const newLocked = lockedBase >= gb ? (lockedBase - gb) : 0n;
                    lockReleases[`locks.resources.${field}`] = newLocked.toString();

                    // Only debit balance for succeeded ids (use accumulated GROSS)
                    const succeededGross = decBaseByFieldSucceeded[field] || 0n;
                    if (succeededGross > 0n) {
                      const currHuman = Number(u[field] || 0);
                      const currBase = parseHumanToBase(currHuman, dec);

                      // Underflow guard (allow tiny dust)
                      const DUST = 3n;
                      if (currBase + DUST < succeededGross) {
                        throw new Error(`Insufficient balance when finalizing ${field}. Need ${succeededGross}, have ${currBase}.`);
                      }

                      const nextBase = currBase >= succeededGross ? (currBase - succeededGross) : 0n;
                      updatesHuman[field] = Number(ethers.formatUnits(nextBase, dec));
                    }
                  }

                  if (Object.keys(lockReleases).length) tx.update(userRef, lockReleases);
                  if (Object.keys(updatesHuman).length) tx.update(userRef, updatesHuman);

                  tx.set(withdrawRef, {
                    status: failures.length ? "partial" : "settled",
                    txHashes,
                    failures,
                    settledAt: Date.now(),
                  }, {merge: true});
                });
              } catch (e) {
                txnFailed = true;
                txnErrorMsg = String(e?.message || e);
                console.error("withdraw DB settle txn failed:", txnErrorMsg, {userAddress, tokenIds: ids, requestId});

                try {
                  await withdrawRef.set({
                    status: "db_failed",
                    txHashes,
                    failures,
                    dbError: txnErrorMsg,
                    failedAt: Date.now(),
                  }, {merge: true});
                } catch (e2) {
                  console.log(e2);
                }
              }

              const response = txnFailed ?
            err(500, `On-chain transfer succeeded, but DB settlement failed: ${txnErrorMsg}`) :
            ok({
              success: failures.length === 0,
              txHashes,
              failed: failures,
              feeBps,
              netAmountsBase,
              feeAmountsBase,
              tier,
            });

              try {
                await lock.markCompleted({txHashes, status: txnFailed ? "db_failed" : (failures.length ? "partial" : "ok")});
              } catch (e) {
                console.log(e);
              }

              return response;
            },
            {scope: MUTEX_SCOPE, idempotencyKey: requestId},
        );

        return res.status(result.status).json(result.body);
      } catch (err) {
        if (err.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("requestWithdraw error:", err);
        return res.status(500).send(err.message || "Internal error during withdrawal.");
      }
    }),
);

// ------- helpers specific to human↔base -------
const TOKEN_DECIMALS = {0: 18, 1: 18, 2: 18};

/**
 * Convert a human (UI) amount into base units for on-chain math.
 * Safely normalizes decimals to a plain string, then uses ethers.parseUnits.
 *
 * @param {(number|string)} humanNumber - Human-readable amount (no exponents preferred).
 * @param {number} [decimals=18] - Token decimals (0–18).
 * @return {bigint} Amount in base units; returns 0n if the value cannot be parsed.
 */
function parseHumanToBase(humanNumber, decimals) {
  const s = toPlainDecimal(humanNumber, Math.min(decimals ?? 18, 18));
  try {
    return ethers.parseUnits(s, decimals ?? 18);
  } catch {
    return 0n;
  }
}
function toPlainDecimal(x, maxFrac = 18) {
  const n = Number(x) || 0;
  // Avoid scientific notation and overlong fractions
  return n.toLocaleString("en-US", {useGrouping: false, maximumFractionDigits: maxFrac});
}

exports.requestDeposit = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
      // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        // --- Payload ---
        const {
          userAddress,
          coreAddress,
          items, // [{ id, wrapper, value, deadline, v,r,s }]
          tokenIds, // [0,1,2]
          humanAmounts, // ["12.5","0","3"]
          ronAmount, ronTxHash,
          clientNonce,
        } = req.body?.data || {};

        if (ronAmount || ronTxHash) return err(400, "RON deposits are not supported by this endpoint.");
        if (!userAddress || !coreAddress || !Array.isArray(items) || items.length === 0) {
          return err(400, "Missing parameters (userAddress, coreAddress, items).");
        }
        if (decoded.uid.toLowerCase() !== String(userAddress).toLowerCase()) {
          return res.status(403).send("Permission denied: mismatched user.");
        }
        if (coreAddress.toLowerCase() !== CORE_ADDR.toLowerCase()) {
          return res.status(403).send("coreAddress mismatch.");
        }
        if (!ethers.isAddress(userAddress)) return res.status(400).send("Bad userAddress");
        if (!ethers.isAddress(coreAddress)) return res.status(400).send("Bad coreAddress");

        if (!Array.isArray(tokenIds) || !Array.isArray(humanAmounts) ||
          tokenIds.length !== humanAmounts.length || tokenIds.length === 0) {
          return err(400, "tokenIds/humanAmounts length mismatch or empty.");
        }

        // ---- No duplicates & set equality with items.ids ----
        const tokenIdSet = new Set(tokenIds.map((x) => Number(x)));
        if (tokenIdSet.size !== tokenIds.length) return err(400, "Duplicate tokenIds not allowed.");

        const itemIdList = items.map((it) => Number(it?.id));
        if (itemIdList.some((x) => Number.isNaN(x))) return err(400, "Invalid item id.");
        const itemIdSet = new Set(itemIdList);
        if (itemIdSet.size !== itemIdList.length) return err(400, "Duplicate item ids not allowed.");
        if (itemIdSet.size !== tokenIdSet.size || [...itemIdSet].some((id) => !tokenIdSet.has(id))) {
          return err(400, "items and tokenIds must match exactly.");
        }

        // ---- No zero/negative human amounts ----
        for (let i = 0; i < tokenIds.length; i++) {
          const n = Number(String(humanAmounts[i]));
          if (!(n > 0)) return err(400, `amount for id ${tokenIds[i]} must be > 0`);
        }

        // ---- Idempotency / anti-replay ----
        await consumeNonceOrFail(userAddress.toLowerCase(), "deposit", String(clientNonce));
        const requestId = stableRequestIdFrom({op: "requestDeposit", userAddress, clientNonce});

        // ABI (plus errors for nicer messages)
        const WRAPPER_ABI = [
          "function withdrawForToWithPermit(address user,address to,uint256 amount,uint256 deadline,uint8 v,bytes32 r,bytes32 s) returns (bool)",
          "function balanceOf(address) view returns (uint256)",
          "function owner() view returns (address)",
          "error ERC2612ExpiredSignature(uint256 deadline)",
          "error ERC2612InvalidSigner(address signer)",
          "error ERC2612InvalidSignature()",
          "error ERC20InsufficientAllowance(address spender,uint256 needed,uint256 allowed)",
          "error ERC20InsufficientBalance(address from,uint256 needed,uint256 balance)",
        ];
        const ERR_IFACE = new ethers.Interface(WRAPPER_ABI);

        const result = await withUserMutex(
            userAddress,
            requestId,
            async () => {
              const core = new ethers.Contract(CORE_ADDR, CORE_ABI, provider);
              const txHashes = [];
              const FieldValue = admin.firestore.FieldValue;

              // Build index (tokenId -> human index)
              const indexById = new Map(tokenIds.map((id, i) => [Number(id), i]));

              // --- Validate each item & expected wrapper/owner ---
              for (const it of items) {
                if (!/^\d+$/.test(String(it.value))) return res.status(400).send("Invalid value (must be integer string)");
                if (
                  typeof it?.id !== "number" ||
              !it?.wrapper || it?.wrapper === ethers.ZeroAddress ||
              !it?.value || !it?.deadline ||
              it?.v === undefined || !it?.r || !it?.s
                ) return err(400, "Invalid item payload.");
                if (!ethers.isAddress(it.wrapper)) return res.status(400).send("Bad wrapper address");

                const expectedWrapper = await core.wrapperOf(it.id);
                if (!expectedWrapper || expectedWrapper.toLowerCase() !== it.wrapper.toLowerCase()) {
                  return err(400, `Wrapper mismatch for id=${it.id}.`);
                }

                const wrapper = new ethers.Contract(it.wrapper, WRAPPER_ABI, wallet);
                const wOwner = await wrapper.owner();
                if (wOwner.toLowerCase() !== wallet.address.toLowerCase()) {
                  return res.status(403).send("Server is not owner of wrapper.");
                }

                // Soft balance sanity (ERC20 balance of user)
                const want = ethers.toBigInt(String(it.value));
                const bal = await wrapper.balanceOf(userAddress);
                if (ethers.toBigInt(bal) < want) {
                  return res.status(403).send(`Insufficient wrapped balance for id=${it.id}.`);
                }

                // Deadline must be in future
                const now = Math.floor(Date.now() / 1000);
                if (Number(it.deadline) <= now) return err(400, "Permit expired");

                // Ensure corresponding human entry exists
                if (indexById.get(Number(it.id)) === undefined) {
                  return err(400, `Missing human amount for id ${it.id}`);
                }
              }

              // --- Execute unwraps (one tx per id) ---
              for (const it of items) {
                const wrapper = new ethers.Contract(it.wrapper, WRAPPER_ABI, wallet);
                const amount = ethers.toBigInt(String(it.value)); // BASE == ERC20 units
                let v = Number(it.v);
                if (v === 0 || v === 1) v += 27;

                // Preflight with decode
                try {
                  await wrapper.withdrawForToWithPermit.staticCall(
                      userAddress, CORE_ADDR, amount, it.deadline, v, it.r, it.s,
                  );
                } catch (e) {
                  const data = e?.data || e?.info?.error?.data;

                  try {
                    if (data) console.log(`Reverted: ${ERR_IFACE.parseError(data).name}`);
                  } catch (e) {
                    console.log(e);
                  }
                  // Some nodes hide staticCall reasons; try estimateGas too
                  try {
                    await wrapper.withdrawForToWithPermit.estimateGas(
                        userAddress, CORE_ADDR, amount, it.deadline, v, it.r, it.s,
                    );
                  } catch (eg) {
                    const d2 = eg?.data || eg?.info?.error?.data;
                    let nice2 = eg.shortMessage || eg.message || "unknown";
                    try {
                      if (d2) nice2 = `Reverted: ${ERR_IFACE.parseError(d2).name}`;
                    } catch (e) {
                      console.log(e);
                    }
                    throw new Error(`withdrawForToWithPermit preflight failed: ${nice2}`);
                  }
                }

                // Send tx
                try {
                  const tx = await wrapper.withdrawForToWithPermit(
                      userAddress, CORE_ADDR, amount, it.deadline, v, it.r, it.s,
                  );
                  const rc = await waitTxBounded(tx, WAIT_CONFS_DEPOSIT, TX_CONFIRM_TIMEOUT_MS);
                  txHashes.push(rc?.hash || tx?.hash);

                  if (!rc) {
                    await db.collection("resource_deposits").doc(requestId).set({
                      ownerUid: decoded.uid,
                      userAddress: userAddress.toLowerCase(),
                      tokenIds: tokenIds.map(Number),
                      humanAmounts: humanAmounts.map(String),
                      txHashes,
                      status: "pending",
                      lastError: "TX_CONFIRM_TIMEOUT",
                      createdAt: FieldValue.serverTimestamp(),
                    }, {merge: true});
                    return ok({success: false, pending: true, txHashes});
                  }
                } catch (e) {
                  await db.collection("resource_deposits").doc(requestId).set({
                    ownerUid: decoded.uid,
                    userAddress: userAddress.toLowerCase(),
                    tokenIds: tokenIds.map(Number),
                    humanAmounts: humanAmounts.map(String),
                    txHashes,
                    status: "pending",
                    lastError: String(e?.shortMessage || e?.message || e),
                    createdAt: FieldValue.serverTimestamp(),
                  }, {merge: true});
                  return ok({success: false, pending: true, txHashes});
                }
              }

              // --- Credit DB immediately using provided HUMAN units ---
              const userRef = db.collection("users").doc(userAddress.toLowerCase());
              await db.runTransaction(async (tx) => {
                const snap = await tx.get(userRef);
                if (!snap.exists) throw new Error("User doc not found.");

                const updates = {};
                for (let i = 0; i < tokenIds.length; i++) {
                  const id = Number(tokenIds[i]);
                  const field = fieldOf(id); // 0->'food',1->'wood',2->'stone'
                  if (!field) throw new Error(`Unknown token id ${id}`);
                  const n = Number(String(humanAmounts[i]));
                  if (Number.isFinite(n) && n > 0) {
                    updates[field] = admin.firestore.FieldValue.increment(n);
                  }
                }
                if (Object.keys(updates).length) tx.update(userRef, updates);
              });

              await db.collection("resource_deposits").doc(requestId).set({
                ownerUid: decoded.uid,
                userAddress: userAddress.toLowerCase(),
                tokenIds: tokenIds.map(Number),
                humanAmounts: humanAmounts.map(String),
                txHashes,
                status: "credited",
                creditedIds: tokenIds.map(Number),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              }, {merge: true});

              return ok({success: true, txHashes});
            },
            {scope: MUTEX_SCOPE, idempotencyKey: requestId},
        );

        return res.status(result.status).json(result.body);
      } catch (err) {
        if (err.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("requestDeposit error:", err);
        return res.status(500).send(err.message || "Internal error");
      }
    }),
);


exports.reconcilePendingDeposits = onSchedule(
    {
      region: "us-central1",
      schedule: "every 2 minutes",
      timeZone: "UTC",
      timeoutSeconds: 240,
      memory: "512MiB",
    }, async () => {
      const qs = await db.collection("resource_deposits")
          .where("status", "in", ["pending", "partial"])
          .limit(100).get();

      for (const doc of qs.docs) {
        const d = doc.data();
        try {
          const userAddr = String(d.userAddress || "").toLowerCase();
          const tokenIds = (d.tokenIds || []).map(Number);
          const amountsHum = (d.humanAmounts || []).map((x) => String(x));
          const txHashes = (d.txHashes || []).filter(Boolean);

          if (!tokenIds.length || !amountsHum.length || tokenIds.length !== amountsHum.length) continue;
          if (!txHashes.length) continue;

          // Build wrapper map: id -> wrapper address
          const core = new ethers.Contract(CORE_ADDR, CORE_ABI, provider);
          const idToWrapper = {};
          for (const id of tokenIds) {
            const waddr = await core.wrapperOf(id);
            if (waddr && waddr !== ethers.ZeroAddress) idToWrapper[id] = waddr.toLowerCase();
          }

          // Which wrappers have confirmed receipts?
          const confirmedWrappers = new Set();
          for (const h of txHashes) {
            const rc = await provider.getTransactionReceipt(h);
            if (rc && rc.status === 1 && rc.to) {
              confirmedWrappers.add(String(rc.to).toLowerCase());
            }
          }
          if (confirmedWrappers.size === 0) continue;

          await db.runTransaction(async (tx) => {
            const snap = await tx.get(doc.ref);
            if (!snap.exists) return;
            const cur = snap.data() || {};
            const alreadyCreditedIds = new Set((cur.creditedIds || []).map(Number));

            // Compute which ids to credit now (confirmed & not yet credited)
            const creditNow = [];
            for (let i = 0; i < tokenIds.length; i++) {
              const id = tokenIds[i];
              const waddr = idToWrapper[id];
              if (!waddr) continue;
              if (!confirmedWrappers.has(waddr)) continue;
              if (alreadyCreditedIds.has(id)) continue;
              creditNow.push([id, amountsHum[i]]);
            }
            if (!creditNow.length) return;

            const userRef = db.collection("users").doc(userAddr);
            const usr = await tx.get(userRef);
            if (!usr.exists) throw new Error("User missing");

            const updates = {};
            for (const [id, humanStr] of creditNow) {
              const field = fieldOf(id); // 0->'food', 1->'wood', 2->'stone'
              const n = Number(String(humanStr));
              if (!Number.isFinite(n) || !(n > 0)) continue;

              // Source of truth (HUMAN units)
              updates[field] = admin.firestore.FieldValue.increment(n);
            }

            if (Object.keys(updates).length) tx.update(userRef, updates);

            // Mark ids credited; set status accordingly
            const nextCredited = Array.from(new Set([...(cur.creditedIds || []), ...creditNow.map(([id]) => id)]));
            const allCredited = nextCredited.length === tokenIds.length;

            tx.update(doc.ref, {
              status: allCredited ? "credited" : "partial",
              creditedIds: nextCredited,
              lastReconciledAt: Date.now(),
            });
          });
        } catch (e) {
          console.error("reconcilePendingDeposits:", doc.id, e);
        }
      }
    },
);

const WAIT_CONFS_RON_DEPOSIT = 2;
const WAIT_CONFS_RON_WITHDRAW = 2;

const WEI_PER_MICRO = 1_000_000_000_000n; // 1e12 → 6-decimal micros exact

/** Optional: selector for depositRonForGas(), if your contract uses it */
const SELECTOR_DEPOSIT_RON = ethers.id("depositRonForGas()").slice(0, 10); // '0x…'

exports.requestRonDeposit = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
      // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        // --- Inputs ---
        const {userAddress, ronAmount, ronTxHash, nonce} = req.body?.data || {};
        if (!userAddress || !ronAmount || !ronTxHash || !nonce) {
          return err(400, "Missing parameters (userAddress, ronAmount, ronTxHash, nonce).");
        }
        if (!ethers.isAddress(userAddress)) return err(400, "Bad userAddress");
        if (decoded.uid.toLowerCase() !== userAddress.toLowerCase()) {
          return res.status(403).send("Permission denied: mismatched user.");
        }

        // --- Amount (exact micros; max 6 decimals) ---
        let wei;
        try {
          wei = ethers.parseEther(String(ronAmount));
        } catch {
          return err(400, "Invalid ronAmount.");
        }
        if (wei <= 0n) return err(400, "Invalid ronAmount.");
        if (wei % WEI_PER_MICRO !== 0n) return err(400, "ronAmount must have at most 6 decimals.");
        const micros = Number(wei / WEI_PER_MICRO);
        if (!Number.isSafeInteger(micros)) return err(400, "Amount too large.");

        // --- One-time nonce (anti-replay) ---
        await consumeNonceOrFail(userAddress.toLowerCase(), "ron_deposit", String(nonce));

        // --- Idempotency key (tx-hash + user) ---
        const requestId = stableRequestIdFrom({op: "ron_deposit", userAddress, ronTxHash});

        const result = await withUserMutex(
            userAddress,
            requestId,
            async () => {
              // Network guard
              const net = await provider.getNetwork();
              if (Number(net.chainId) !== Number(CHAIN_ID)) {
                return err(400, `Wrong chain. Expected ${CHAIN_ID}, got ${Number(net.chainId)}.`);
              }

              // Fetch tx + receipt
              const receipt = await provider.getTransactionReceipt(ronTxHash);
              if (!receipt || receipt.status !== 1) return err(400, "RON transaction not found or failed.");
              const tx = await provider.getTransaction(ronTxHash);
              if (!tx) return err(400, "RON transaction not found.");

              // Confirmations (reorg safety)
              const head = await provider.getBlockNumber();
              const confs = receipt.blockNumber ? (head - receipt.blockNumber + 1) : 0;
              if (confs < WAIT_CONFS_RON_DEPOSIT) {
                return err(409, `Transaction not sufficiently confirmed yet (${confs}/${WAIT_CONFS_RON_DEPOSIT}).`);
              }

              // Shape checks
              const fromAddr = (tx.from || "").toLowerCase();
              const toAddr = (tx.to || "").toLowerCase();
              if (fromAddr !== userAddress.toLowerCase()) return err(400, "RON tx sender mismatch.");
              if (toAddr !== CORE_ADDR.toLowerCase()) return err(400, "RON tx was not sent to CORE_ADDR.");
              if (tx.value !== wei) return err(400, "RON tx value does not match ronAmount.");

              // (Optional) data check: accept empty "0x" or explicit deposit selector
              const sel = (tx.data || "0x").slice(0, 10).toLowerCase();
              if (sel !== "0x" && sel !== SELECTOR_DEPOSIT_RON.toLowerCase()) {
                // If your contract *requires* depositRonForGas selector, change this to a hard error.
                console.warn("RON deposit tx had unexpected calldata selector:", sel);
              }

              const depRef = db.collection("ron_deposits").doc(requestId);
              const userRef = db.collection("users").doc(userAddress.toLowerCase());

              await db.runTransaction(async (txf) => {
                // 1) READS — do all of them before any write
                const depSnap = await txf.get(depRef);
                const userSnap = await txf.get(userRef);

                // Idempotency: already completed?
                if (depSnap.exists && depSnap.data()?.status === "completed") {
                  return; // nothing else to do
                }
                if (!userSnap.exists) throw new Error("User document not found.");

                const u = userSnap.data() || {};
                const haveMicros = Number(u.gasTankRonMicros || 0);
                const nextMicros = haveMicros + micros;

                // 2) WRITES — now it’s safe to write
                // Reserve record if it doesn't exist yet
                if (!depSnap.exists) {
                  txf.set(depRef, {
                    userAddress: userAddress.toLowerCase(),
                    ronTxHash,
                    amountWei: wei.toString(),
                    amountMicros: micros,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    status: "reserved",
                    confirmations: confs,
                  });
                }

                // Credit exact micros (keep using integers, no floats)
                txf.update(userRef, {
                  gasTankRonMicros: nextMicros,
                  // legacy mirror for UI; derived from micros to avoid drift
                  gasTankRon: Number((nextMicros / 1e6).toFixed(6)),
                });

                // Finalize deposit
                txf.set(depRef, {
                  status: "completed",
                  completedAt: admin.firestore.FieldValue.serverTimestamp(),
                  confirmations: confs,
                }, {merge: true});
              });

              return ok({success: true, txHash: ronTxHash});
            },
            {scope: MUTEX_SCOPE, idempotencyKey: requestId},
        );

        return res.status(result.status).json(result.body);
      } catch (err) {
        if (err.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("requestRonDeposit error:", err);
        return res.status(500).send(err.message || "Internal error during RON deposit.");
      }
    }),
);

exports.requestRonWithdraw = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
      // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        // --- Inputs ---
        const {userAddress, ronAmount, nonce, signature} = req.body?.data || {};
        if (!userAddress || !ronAmount || !nonce || !signature) {
          return err(400, "Missing parameters (userAddress, ronAmount, nonce, signature).");
        }
        if (!ethers.isAddress(userAddress)) return err(400, "Bad userAddress");
        if (decoded.uid.toLowerCase() !== userAddress.toLowerCase()) {
          return res.status(403).send("Permission denied: mismatched user.");
        }

        // --- Signature over simple message (UI uses signMessage) ---
        const payload = {userAddress, ronAmount: String(ronAmount), nonce};
        const message = `Withdraw RON: ${JSON.stringify(payload)}`;
        let recovered;
        try {
          recovered = ethers.verifyMessage(message, signature);
        } catch {
          return res.status(401).send("Invalid signature.");
        }
        if (recovered.toLowerCase() !== userAddress.toLowerCase()) {
          return res.status(401).send("Signature/user mismatch.");
        }

        // --- Amount (exact micros; max 6 decimals) ---
        let wei;
        try {
          wei = ethers.parseEther(String(ronAmount));
        } catch {
          return err(400, "Invalid ronAmount.");
        }
        if (wei <= 0n) return err(400, "Invalid ronAmount.");
        if (wei % WEI_PER_MICRO !== 0n) return err(400, "ronAmount must have at most 6 decimals.");
        const reqMicrosBig = wei / WEI_PER_MICRO;
        if (reqMicrosBig > BigInt(Number.MAX_SAFE_INTEGER)) return err(400, "Amount too large.");
        const reqMicros = Number(reqMicrosBig);

        // --- Nonce (anti-replay) ---
        await consumeNonceOrFail(userAddress.toLowerCase(), "ron_withdraw", String(nonce));

        const requestId = stableRequestIdFrom({
          op: "requestRonWithdraw",
          userAddress: userAddress.toLowerCase(),
          ronAmount: String(ronAmount),
          nonce: String(nonce),
        });

        const result = await withUserMutex(
            userAddress,
            requestId,
            async (lock) => {
              const userRef = db.collection("users").doc(userAddress.toLowerCase());
              const core = new ethers.Contract(CORE_ADDR, CORE_ABI, wallet);

              // Atomic cooldown + balance precheck (no debit yet)
              try {
                await db.runTransaction(async (txDb) => {
                  const snap = await txDb.get(userRef);
                  if (!snap.exists) throw new Error("User document not found.");
                  const u = snap.data() || {};

                  const nowMs = Date.now();
                  const untilMs = Number(u.withdraw_cooldown_until_ron || 0);
                  if (untilMs && nowMs < untilMs) {
                    throw new Error(`COOLDOWN_UNTIL:${untilMs}`);
                  }

                  const haveMicros = Number(u.gasTankRonMicros || 0);
                  if (haveMicros < reqMicros) throw new Error("Insufficient RON balance in gas tank.");

                  // Set new cooldown now (prevents spam even if chain tx fails)
                  txDb.update(userRef, {withdraw_cooldown_until_ron: nowMs + WITHDRAW_COOLDOWN_MS});
                });
              } catch (e) {
                const msg = String(e?.message || e);
                if (msg.startsWith("COOLDOWN_UNTIL:")) {
                  const untilMs = Number(msg.split(":")[1] || 0);
                  const when = new Date(untilMs).toISOString();
                  return err(429, `Withdrawal cooldown active. Try again at ${when}.`);
                }
                if (/Insufficient RON balance/i.test(msg)) {
                  return res.status(403).send("Insufficient RON balance in gas tank.");
                }
                throw e;
              }

              // Network guard
              const net = await wallet.provider.getNetwork();
              if (Number(net.chainId) !== Number(CHAIN_ID)) {
                return err(400, `Wrong chain. Expected ${CHAIN_ID}, got ${Number(net.chainId)}.`);
              }

              // Pre-flight
              try {
                await core.ownerWithdrawRon.staticCall(userAddress, wei);
              } catch (e) {
                const msg = String(e?.shortMessage || e?.message || "");
                if (/missing revert data/i.test(msg)) {
                  await core.ownerWithdrawRon.estimateGas(userAddress, wei).catch((eg) => {
                    throw new Error(`ownerWithdrawRon pre-sim failed: ${eg.shortMessage || eg.message}`);
                  });
                } else {
                  throw new Error(`ownerWithdrawRon pre-sim failed: ${e.shortMessage || e.message}`);
                }
              }

              // Send tx and wait with confirmation + timeout
              let tx; let rc;
              try {
                tx = await core.ownerWithdrawRon(userAddress, wei);
                rc = await waitTxBounded(tx, WAIT_CONFS_RON_WITHDRAW, TX_CONFIRM_TIMEOUT_MS);
              } catch (e) {
                // If unknown finality, audit & bail without DB debit
                const txHash = tx?.hash || null;
                try {
                  await db.collection("ron_withdrawals").add({
                    userAddress: userAddress.toLowerCase(),
                    amountWei: wei.toString(),
                    amountMicros: reqMicros,
                    nonce: String(nonce),
                    requestId,
                    txHash,
                    createdAt: Date.now(),
                    status: "timeout_unknown",
                  });
                } catch (e) {
                  console.log(e);
                }
                await lock.markCompleted({txHash, status: "timeout_unknown"}).catch(() => {});
                return err(504, "Transaction status unknown (timeout). Please retry later.");
              }

              if (!rc) {
                // same unknown case as above (paranoia)
                const txHash = tx?.hash || null;
                try {
                  await db.collection("ron_withdrawals").add({
                    userAddress: userAddress.toLowerCase(),
                    amountWei: wei.toString(),
                    amountMicros: reqMicros,
                    nonce: String(nonce),
                    requestId,
                    txHash,
                    createdAt: Date.now(),
                    status: "timeout_unknown",
                  });
                } catch (e) {
                  console.log(e);
                }
                await lock.markCompleted({txHash, status: "timeout_unknown"}).catch(() => {});
                return err(504, "Transaction status unknown (timeout). Please retry later.");
              }

              const txHash = rc?.hash || rc?.transactionHash || tx?.hash || "";

              // DB debit in a transaction (exact micros)
              let txnFailed = false;
              let txnErrorMsg = "";
              try {
                await db.runTransaction(async (txDb) => {
                  const fresh = await txDb.get(userRef);
                  if (!fresh.exists) throw new Error("User document not found.");
                  const u = fresh.data() || {};

                  const have = Number(u.gasTankRonMicros || 0);
                  if (have < reqMicros) throw new Error("Insufficient balance when finalizing.");

                  const nextMicros = have - reqMicros;
                  txDb.update(userRef, {
                    gasTankRonMicros: nextMicros,
                    gasTankRon: Number((nextMicros / 1e6).toFixed(6)), // legacy mirror
                  });
                });
              } catch (e) {
                txnFailed = true;
                txnErrorMsg = String(e?.message || e);
                console.error("RON withdraw DB txn failed:", txnErrorMsg, {userAddress, requestId});
              }

              // Audit
              try {
                await db.collection("ron_withdrawals").add({
                  userAddress: userAddress.toLowerCase(),
                  amountWei: wei.toString(),
                  amountMicros: reqMicros,
                  nonce: String(nonce),
                  requestId,
                  txHash,
                  createdAt: Date.now(),
                  status: txnFailed ? "onchain_ok_db_fail" : "ok",
                  dbError: txnFailed ? txnErrorMsg : null,
                });
              } catch (e) {
                console.warn("ron_withdrawals audit write failed", e?.message || e);
              }

              const response = txnFailed ?
            err(500, `On-chain transfer succeeded, but DB update failed: ${txnErrorMsg}`) :
            ok({success: true, transactionHash: txHash, debitedMicros: reqMicros});

              try {
                await lock.markCompleted({txHash, status: txnFailed ? "db_failed" : "ok"});
              } catch (e) {
                console.log(e);
              }

              return response;
            },
            {scope: MUTEX_SCOPE, idempotencyKey: requestId},
        );

        return res.status(result.status).json(result.body);
      } catch (err) {
        if (err.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("requestRonWithdraw error:", err);
        return res.status(500).send(err.message || "Internal error during RON withdrawal.");
      }
    }),
);

exports.requestUnstake = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      // 1) Auth
      const idToken = req.headers.authorization?.split("Bearer ")[1];
      if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch {
        return res.status(401).send("Unauthorized: Invalid token.");
      }

      // 2) Inputs (RAW)
      const raw = req.body?.data || {};
      const rawUserAddress = raw.userAddress;
      const rawCollectionAddress = contractAddressTools; // tools only here
      const rawTokenIds = raw.tokenIds;
      const rawSignature = raw.signature;
      const rawFeeRON = raw.feeRON; // optional
      const rawFeeTxHash = raw.feeTxHash; // optional

      try {
        assertAuthMatches(decoded, rawUserAddress);
      } catch (e) {
        return res.status(403).send(e.message || "Permission denied.");
      }

      if (!rawUserAddress || !rawCollectionAddress || !Array.isArray(rawTokenIds) || rawTokenIds.length === 0 || !rawSignature) {
        return err(400, "Missing or invalid parameters.");
      }

      // 3) Signature verification against EXACT payload
      const payloadForSig = {
        userAddress: rawUserAddress,
        collectionAddress: rawCollectionAddress,
        tokenIds: rawTokenIds,
        ...(rawFeeRON !== undefined ? {feeRON: rawFeeRON} : {}),
        ...(rawFeeTxHash !== undefined ? {feeTxHash: rawFeeTxHash} : {}),
      };
      const message = `Unstake NFTs: ${JSON.stringify(payloadForSig)}`;
      let recovered;
      try {
        recovered = ethers.verifyMessage(message, rawSignature);
      } catch {
        return res.status(401).send("Invalid signature.");
      }
      if (recovered.toLowerCase() !== String(rawUserAddress).toLowerCase()) {
        return res.status(401).send("Signature does not match userAddress.");
      }

      // 4) Normalize
      const userAddress = String(rawUserAddress);
      const userLower = userAddress.toLowerCase(); // <-- use lowercased doc id for users
      const collectionAddress = String(rawCollectionAddress);
      const tokenIds = Array.from(new Set(rawTokenIds.map((x) => Number(x)))).filter((x) => Number.isFinite(x));
      if (tokenIds.length === 0) return err(400, "No valid tokenIds.");

      const expectedFeeMicros = tokenIds.length * FEE_PER_NFT_RON_MICROS;
      if (rawFeeRON !== undefined) {
        const clientFeeMicros = ronToMicros(rawFeeRON);
        if (!Number.isInteger(clientFeeMicros) || clientFeeMicros !== expectedFeeMicros) {
          return res.status(403).send("Declared fee does not match required fee.");
        }
      }

      // 5) User checks (energy + fee pre-check)
      const userRef = admin.firestore().collection("users").doc(userLower); // <-- lowercased here
      const userSnap = await userRef.get();
      if (!userSnap.exists) return res.status(404).send("User not found.");
      const userData = userSnap.data() || {};

      const energy = Number(userData.energy || 0);
      if (energy <= MIN_ENERGY_TO_UNSTAKE) {
        return res.status(403).send(`Not enough energy to unstake (need > ${MIN_ENERGY_TO_UNSTAKE}).`);
      }
      const gasMicros = readRonTankMicros(userData);
      if (gasMicros < expectedFeeMicros) {
        return res.status(403).send("Insufficient RON in gas tank to pay withdrawal fee.");
      }

      try {
      // 6) Verify ownership + state in Firestore
        const stakedCol = admin.firestore().collection("staked_nfts");
        const chunk = (arr, size) => {
          const out = [];
          for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
          return out;
        };
        const tokenChunks = chunk(tokenIds, 10);

        let fetchedDocs = [];
        for (const c of tokenChunks) {
          const q = stakedCol
              .where("userAddress", "==", userAddress) // keep original-case for equality filter
              .where("collectionAddress", "==", collectionAddress)
              .where("tokenId", "in", c);
          const snap = await q.get();
          fetchedDocs = fetchedDocs.concat(snap.docs);
        }
        if (fetchedDocs.length !== tokenIds.length) return res.status(403).send("Mismatch in staked tokens.");

        // Validate each: tools must be full durability and not mining
        for (const d of fetchedDocs) {
          const tool = d.data() || {};
          if (tool.category === "tool") {
            const durability = Number(tool.durability ?? 20);
            const mining = Number(tool.is_mining ?? 0);
            if (durability < 20) throw new Error(`Token ID ${tool.tokenId} must be full durability (20).`);
            if (mining > 0) throw new Error(`Token ID ${tool.tokenId} is currently mining.`);
          }
        }

        // 7) Tent detection — mirror stakeNfts: trust chain for toolType/rarity
        const looksLikeTent = (s) =>
          String(s || "").toLowerCase().replace(/[_\s-]+/g, " ").includes("tent");

        const c1155 = new ethers.Contract(contractAddressTools, TOOLNFT_META_ABI, provider);

        // Resolve toolType/rarity for ALL ids (like in stakeNfts)
        const typePairs = await Promise.all(
            tokenIds.map(async (id) => {
              try {
                const [tt, rr] = await Promise.all([
                  c1155.tokenTypes(Number(id)),
                  c1155.tokenRarities(Number(id)),
                ]);
                return {id: Number(id), toolType: tt, rarity: rr};
              } catch (e) {
                console.log("type/rarity fetch failed for", id, e);
                return {id: Number(id), toolType: null, rarity: null};
              }
            }),
        );

        // Build tent cost ids exactly like in stakeNfts
        const tentCostIds = [];
        for (const p of typePairs) {
          if (looksLikeTent(p.toolType)) {
            const costId = `${String(p.toolType || "").toLowerCase()}_${String(p.rarity || "").toLowerCase()}`;
            tentCostIds.push(costId); // e.g., "skin_tent_uncommon"
          }
        }

        let tentSlots = 0;
        let tentBoost = 0;
        if (tentCostIds.length > 0) {
          // enforce 1 tent per batch (same rule)
          const uniqueTentIds = [...new Set(tentCostIds)];
          if (uniqueTentIds.length > 1 || tentCostIds.length > 1) {
            return res.status(400).send("Unstaking multiple tents at once is not allowed.");
          }

          // Fetch config using the exact id built from chain (same as stakeNfts)
          const tentRef = db.collection("craft_cost_tools").doc(uniqueTentIds[0].toLowerCase());
          const tentSnap = await tentRef.get();
          if (!tentSnap.exists) return res.status(400).send("Tent config missing.");
          const cfg = tentSnap.data() || {};
          tentSlots = Number(cfg.slots || 0) || 0;
          tentBoost = Number(cfg.boost || 0) || 0;

          // Pre-checks identical in spirit to stake flow
          const currentAvailable = Number(userData.villagers_available || 0);
          if (currentAvailable < tentSlots) {
            return res.status(403).send(`Free up at least ${tentSlots} villagers before unstaking your tent.`);
          }
          if (!(Number(userData.has_tent || 0) > 0)) {
            return res.status(400).send("No tent is currently staked.");
          }
        }

        // 8) On-chain call
        if (!contractTools) throw new Error("Contract not initialized on server.");
        const tx = await contractTools.ownerUnstake(userAddress, tokenIds);
        const receipt = await tx.wait(1);
        if (!receipt || receipt.status !== 1) throw new Error("Unstake transaction failed on-chain.");

        // best-effort Unstaked event verification (non-fatal)
        try {
          const iface = new ethers.Interface(contractAbiTools);
          let ok = false;
          for (const log of receipt.logs || []) {
            try {
              const parsed = iface.parseLog(log);
              if (parsed?.name === "Unstaked") {
                const evUser = (parsed.args?.user || "").toLowerCase();
                const evIds = (parsed.args?.tokenIds || []).map((x) => Number(x));
                const sameUser = evUser === userAddress.toLowerCase();
                const sameSet = evIds.length === tokenIds.length && evIds.every((id) => tokenIds.includes(id));
                if (sameUser && sameSet) {
                  ok = true; break;
                }
              }
            } catch (e) {
              console.log(e);
            }
          }
          if (!ok) console.warn("Unstaked event not found/mismatch; continuing due to receipt.status=1");
        } catch (e) {
          console.warn("Event parse warning:", e);
        }

        // 9) Firestore transaction AFTER chain success
        await admin.firestore().runTransaction(async (tx) => {
          const freshUserSnap = await tx.get(userRef);
          if (!freshUserSnap.exists) throw new Error("User disappeared.");
          const freshUser = freshUserSnap.data() || {};
          const currentMicros = readRonTankMicros(freshUser);
          if (currentMicros < expectedFeeMicros) throw new Error("Insufficient RON at commit time to pay fee.");

          // re-read target docs inside txn
          const refs = fetchedDocs.map((d) => d.ref);
          const freshSnaps = await tx.getAll(...refs);
          if (freshSnaps.length !== refs.length) throw new Error("Some staked docs went missing.");
          for (const s of freshSnaps) {
            const tool = s.data();
            if (!tool) throw new Error("Staked doc missing.");
            if ((String(tool.userAddress || "").toLowerCase()) !== userAddress.toLowerCase()) {
              throw new Error("Ownership changed before commit.");
            }
          }

          // Fee updates
          tx.update(userRef, {
            gasTankRonMicros: admin.firestore.FieldValue.increment(-expectedFeeMicros),
            gasTankRon: admin.firestore.FieldValue.increment(-microsToRon(expectedFeeMicros)),
          });

          // Tent decrements (if applicable)
          if (tentSlots > 0 || tentBoost > 0) {
            const curAvailable = Number(freshUser.villagers_available || 0);
            if (curAvailable < tentSlots) {
              throw new Error(`Free up at least ${tentSlots} villagers before unstaking your tent (recheck).`);
            }

            const updates = {has_tent: 0};
            if (tentSlots > 0) {
              updates.villagers = admin.firestore.FieldValue.increment(-tentSlots);
              updates.villagers_available = admin.firestore.FieldValue.increment(-tentSlots);
            }
            if (tentBoost > 0) {
              updates.boost = admin.firestore.FieldValue.increment(-tentBoost);
            }
            tx.update(userRef, updates);
          }

          // Remove staked docs
          refs.forEach((r) => tx.delete(r));
        });

        return res.status(200).json({
          data: {
            success: true,
            transactionHash: receipt.transactionHash || tx.hash,
            unstaked: tokenIds,
            feeCharged: Number(microsToRon(expectedFeeMicros).toFixed(2)),
            energyChecked: true,
            tentRemoved: (tentSlots > 0) ? {slots: tentSlots, boost: tentBoost} : null,
          },
        });
      } catch (err) {
        console.error("Error in requestUnstake:", err);
        return res.status(500).send(err.message || "An internal error occurred during unstaking.");
      }
    }),
);


exports.redeemKeyAndCreateUser = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
      // Verify Firebase Auth token
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) {
          return res.status(401).send(
              "Unauthorized: No token provided.");
        }

        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch (e) {
          return res.status(401).send("Unauthorized: Invalid token.");
        }
        const uid = decoded.uid;

        const {/* key,*/ username} = req.body?.data || {};
        // if (!key || typeof key !== "string") {
        //   return err(400,"Missing or invalid key.");
        // }
        if (!username || username.trim().length < 3 ||
     username.trim().length > 15) {
          return err(400,
              "Username must be between 3 and 15 characters.");
        }

        const cleanUsername = username.trim();
        const usernameDocId = cleanUsername.toLowerCase();

        const requestId = stableRequestIdFrom({op: "redeemKeyAndCreateUser",
          uid, username: usernameDocId});

        const result = await withUserMutex(uid, requestId, async () => {
        // const keyRef = db.collection("keys").doc(key);
          const userRef = db.collection("users").doc(uid);
          const rankRef = db.collection("rankings").doc(uid);
          const usernameRef = db.collection("usernames").doc(usernameDocId);

          await db.runTransaction(async (tx) => {
            const [userSnap, unameSnap] = await Promise.all([
              tx.get(userRef),
              tx.get(usernameRef),
            ]);

            const existing = userSnap.exists ? (userSnap.data() || {}) : null;

            if (unameSnap.exists) {
              throw new Error("Username is already taken.");
            }

            if (existing && (existing.username || "").trim()) {
              throw new Error("User is already registered.");
            }
            if (!existing) {
            // Create the user doc with your defaults + username
              tx.set(userRef, {
                food: 0,
                wood: 0,
                stone: 0,
                energy: 1500,
                gasTankRon: 0,
                gasTankRonMicros: 0,
                can_mint: 1,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                villagers_available: 6,
                villagers: 6,
                total_rewards: 0,
                has_medallion: 0,
                has_historian: 0,
                total_crafter: 0,
                username: cleanUsername,
              });
            } else {
              // Partial profile existed → just finish it
              tx.update(userRef, {username: cleanUsername});
            }

            // Public rankings doc
            tx.set(rankRef, {username: cleanUsername,
              total_rewards: 0, mint_score: 0},
            {merge: true});

            // Reserve username (prevents race conditions)
            tx.set(usernameRef, {uid, createdAt: admin.firestore.FieldValue.serverTimestamp()});

          // Delete the key after successful creation (per your requirement)
          // tx.delete(keyRef);
          });

          return ok({success: true, message:
        "Account created.", username: cleanUsername});
        });

        return res.status(result.status).json(result.body);
      } catch (e) {
        if (e.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true,
            message: "Another action is in progress. Try again shortly."});
        }
        console.error("redeemKeyAndCreateUser error:", e);
        const status = e.code === "not-found" ? 404 : e.code ===
      "already-exists" ? 409 : 500;
        return res.status(status).send(e.message ||
         "An internal error occurred while creating the account.");
      }
    }));

exports.setUsername = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
    // 1. Verify Firebase Auth Token
      const idToken = req.headers.authorization?.split("Bearer ")[1];
      if (!idToken) {
        return res.status(401).send("Unauthorized: No token provided.");
      }
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).send("Unauthorized: Invalid token.");
      }

      const uid = decodedToken.uid;
      const {username} = req.body.data;
      try {
      // 2. Validate the username
        if (!username || username.trim().length < 3 ||
     username.trim().length > 15) {
          return err(400,
              "Username must be between 3 and 15 characters.");
        }
        const cleanUsername = username.trim();

        // 3. Check for username uniqueness (optional but highly recommended)
        const usersRef = db.collection("users");
        const snapshot = await usersRef.where(
            "username", "==", cleanUsername).limit(1).get();
        if (!snapshot.empty) {
          return res.status(409).send("Username is already taken.");
        }

        const requestId = stableRequestIdFrom({op: "setUsername",
          uid, username: cleanUsername.toLowerCase()});

        const result = await withUserMutex(uid, requestId, async () => {
          // 4. Update the user's document
          const userRef = db.collection("users").doc(uid);
          const rankingsRef = db.collection("rankings").doc(uid);
          const unameRef = db.collection("usernames").doc(cleanUsername.toLowerCase());

          await db.runTransaction(async (tx) => {
            const [uSnap, nameSnap] = await Promise.all([tx.get(userRef), tx.get(unameRef)]);
            console.log(uSnap);
            if (nameSnap.exists) throw new Error("Username is already taken.");
            tx.update(userRef, {username: cleanUsername});
            tx.set(rankingsRef, {username: cleanUsername}, {merge: true});
            tx.set(unameRef, {uid, createdAt: admin.firestore.FieldValue.serverTimestamp()});
          });

          console.log(`Username for user ${uid}` +
        ` set to: ${cleanUsername}`);
          return ok({success: true,
            message: "Username updated."});
        });

        return res.status(result.status).json(result.body);
      } catch (error) {
        if (error.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true,
            message: "Another action is in progress. Try again shortly."});
        }
        console.error(`Error setting username for ${uid}:`, error);
        return res.status(500).send(
            "An internal error occurred while setting username.");
      }
    }));

exports.setReferralCode = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") {
          return res.status(405).send("Method Not Allowed");
        }

        // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");

        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }
        const uid = canonicalUserIdFromDecoded(decoded); // wallet-first, normalized

        // --- Input ---
        const data = req.body?.data || {};
        const reqCodeRaw = String(data.referral_code || "").trim();
        const replace = Boolean(data.replace); // allow rotation if already set

        const generate10 = () => String(Math.floor(Math.random() * 1e10)).padStart(10, "0");
        const code = reqCodeRaw || generate10();

        if (!/^\d{10}$/.test(code)) {
          return res.status(400).send("Referral code must be exactly 10 digits.");
        }

        const requestId = stableRequestIdFrom({op: "setReferralCode", uid, code, replace});

        const result = await withUserMutex(uid, requestId, async () => {
          const actorId = canonicalUserId(decoded);
          const userRef = db.collection("users").doc(actorId);

          const outcome = await db.runTransaction(async (tx) => {
          // 1) Read user to get username + current code
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) throw new Error("USER_NOT_FOUND");

            const user = userSnap.data() || {};
            const username = (user.username || "").trim();
            if (!username) throw new Error("USERNAME_REQUIRED");

            const lower = username.toLowerCase();
            const unameRef = db.collection("usernames").doc(lower);

            // 2) Read username mapping + new code guard + old code guard (if any)
            const codeRef = db.collection("referral_codes").doc(code);
            const [unameSnap, codeSnap] = await Promise.all([tx.get(unameRef), tx.get(codeRef)]);

            if (!unameSnap.exists) throw new Error("USERNAME_MAP_MISSING");
            if (unameSnap.get("uid") !== uid) throw new Error("USERNAME_MISMATCH");

            const existingUserCode = user.referral_code || "";
            const existingNameCode = unameSnap.get("referral_code") || "";

            // If already set to this same code, idempotent success
            if ((existingUserCode && existingUserCode === code) || (existingNameCode && existingNameCode === code)) {
              return ok({success: true, referral_code: code, rotated: false});
            }

            // If some (different) code already exists, require replace=true
            const alreadyHasDifferent =
            (existingUserCode && existingUserCode !== code) ||
            (existingNameCode && existingNameCode !== code);

            if (alreadyHasDifferent && !replace) {
              throw new Error("ALREADY_HAS_CODE");
            }

            // Global uniqueness guard: if code doc exists for another uid, reject
            if (codeSnap.exists && codeSnap.get("uid") !== uid) {
              throw new Error("CODE_TAKEN");
            }

            // If rotating, delete old code guard doc
            if (alreadyHasDifferent) {
              const old = existingUserCode || existingNameCode;
              if (old && old !== code) {
                const oldRef = db.collection("referral_codes").doc(String(old));
                // Read oldRef BEFORE any writes to satisfy transaction constraints
                await tx.get(oldRef); // no-op read to keep all reads before writes
                tx.delete(oldRef);
              }
            }

            // 3) Writes (atomic)
            tx.set(
                codeRef,
                {
                  uid,
                  username,
                  username_lower: lower,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                {merge: true},
            );

            tx.set(
                unameRef,
                {referral_code: code, updatedAt: admin.firestore.FieldValue.serverTimestamp()},
                {merge: true},
            );

            tx.set(
                userRef,
                {referral_code: code, updatedAt: admin.firestore.FieldValue.serverTimestamp()},
                {merge: true},
            );

            return ok({success: true, referral_code: code, rotated: !!alreadyHasDifferent});
          });

          return outcome;
        });

        return res.status(result.status).json(result.body);
      } catch (error) {
        if (error?.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res
              .status(423)
              .json({busy: true, message: "Another action is in progress. Try again shortly."});
        }

        const map = {
          USER_NOT_FOUND: [404, "User profile not found."],
          USERNAME_REQUIRED: [400, "Please set a username first."],
          USERNAME_MAP_MISSING: [404, "Username map missing."],
          USERNAME_MISMATCH: [409, "Username mismatch."],
          CODE_TAKEN: [409, "Referral code already exists. Please try again."],
          ALREADY_HAS_CODE: [409, "Referral code already set. Pass replace=true to rotate."],
        };
        const [code, msg] = map[error?.message] || [500, "Internal error while setting referral code."];
        console.error("setReferralCode error:", error);
        return res.status(code).send(msg);
      }
    }),
);


exports.setReferral = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") {
          return res.status(405).send("Method Not Allowed");
        }

        // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        // --- Input: CODE ONLY (exactly 10 digits) ---
        const referralCodeRaw = String(req.body?.data?.referral_code || "").trim();
        if (!/^\d{10}$/.test(referralCodeRaw)) {
          return res.status(400).send("Referral code must be exactly 10 digits.");
        }

        // We will verify the signature over the code on the client; here also verify caller identity:
        const data = req.body?.data || {};
        const nonce = String(data.nonce || "");
        const signature = String(data.signature || "");
        if (!nonce || !signature) return res.status(400).send("Missing nonce/signature.");
        const msg = `Set referral: ${JSON.stringify({referral_code: referralCodeRaw, nonce})}`;
        let recovered;
        try {
          recovered = ethers.verifyMessage(msg, signature).toLowerCase();
        } catch {
          return res.status(401).send("Invalid signature.");
        }

        // Make sure the recovered wallet matches the authenticated principal
        const authCandidates = [
          decoded.uid,
          decoded.walletAddress,
          decoded.address,
        ].filter(Boolean).map((s) => String(s).toLowerCase());
        if (!authCandidates.includes(recovered)) {
          return res.status(401).send("Signature does not match authenticated user.");
        }

        // Canonical document id = recovered wallet address (the crypto-verified identity)
        const norm = (s) => String(s||"").replace(/^ronin:/i, "0x").toLowerCase();
        const meDocId = norm(recovered);

        const requestId = stableRequestIdFrom({op: "setReferral", uid: meDocId, code: referralCodeRaw});

        const result = await withUserMutex(meDocId, requestId, async () => {
          const userRef = db.collection("users").doc(meDocId);
          const codeRef = db.collection("referral_codes").doc(referralCodeRaw);

          await db.runTransaction(async (tx) => {
          // ---- Reads (all before writes) ----
            const [meSnap, codeSnap] = await Promise.all([tx.get(userRef), tx.get(codeRef)]);
            if (!meSnap.exists) throw new Error("SELF_NOT_FOUND");
            if (!codeSnap.exists) throw new Error("CODE_NOT_FOUND");

            const me = meSnap.data() || {};
            const myUsername = String(me.username || "").trim();

            // only treat as already set if the field is a **non-empty** string
            const hasByUid = typeof me.referredByUid === "string" && me.referredByUid.length > 0;
            const hasByName = typeof me.referredBy === "string" && me.referredBy.trim().length > 0;
            const alreadySet = hasByUid || hasByName;

            // Normalize referrer's uid to match your users doc-id convention
            const referrerUid = norm(codeSnap.get("uid") || "");

            if (!referrerUid) throw new Error("CODE_NOT_FOUND");
            if (referrerUid === meDocId) throw new Error("SELF_REFERRAL");

            const removedBy = String(me.referral_removed_by || "").toLowerCase();
            const rebindSameReferrer = !!removedBy && removedBy === referrerUid;

            // Capacity check on referrer
            const refUserRef = db.collection("users").doc(referrerUid);
            const refUserSnap = await tx.get(refUserRef);
            if (!refUserSnap.exists) throw new Error("REFERRER_PROFILE_NOT_FOUND");

            const referrerUsername = String(refUserSnap.get("username") || codeSnap.get("username") || "");
            const referrerUsernameLower = referrerUsername ? referrerUsername.toLowerCase() :
                                                           String(codeSnap.get("username_lower") || "").toLowerCase();

            // If already set, only allow idempotent re-set
            if (alreadySet) {
              const currentUid = String(me.referredByUid || "").toLowerCase();
              const currentByName = String(me.referredBy || "").toLowerCase();
              const same =
              currentUid === referrerUid ||
              (!!referrerUsernameLower && currentByName === referrerUsernameLower);
              if (!same) throw new Error("REFERRAL_ALREADY_SET");
            }

            const refUser = refUserSnap.data() || {};
            const hasHistorian = Number(refUser.has_historian || 0) > 0; // 25
            const hasResearcher = Number(refUser.has_medallion || 0) > 0; // 5
            const capacity = (hasHistorian ? 25 : 0) + (hasResearcher ? 5 : 0);

            const currentList = Array.isArray(refUser.myReferrals) ?
            refUser.myReferrals.map((v) => String(v || "")) :
            [];

            // Keep your legacy list values: prefer username else uid
            const entryToStore = myUsername || meDocId;

            const setList = new Set(currentList);
            const alreadyInList =
            setList.has(entryToStore) ||
            setList.has(meDocId) ||
            (myUsername && setList.has(myUsername));

            const idempotentSameReferrer =
            alreadySet &&
            (String(me.referredByUid || "").toLowerCase() === referrerUid ||
              (!!referrerUsernameLower &&
                String(me.referredBy || "").toLowerCase() === referrerUsernameLower));

            if (!alreadyInList) {
              if (capacity <= 0 && !idempotentSameReferrer && !rebindSameReferrer) {
                const e = new Error(`MAX_REFERRALS_REACHED:0`);
                e.meta = {capacity: 0};
                throw e;
              }
              if (currentList.length >= capacity && !idempotentSameReferrer && !rebindSameReferrer) {
                const e = new Error(`MAX_REFERRALS_REACHED:${capacity}`);
                e.meta = {capacity};
                throw e;
              }

              currentList.push(entryToStore);
              tx.update(refUserRef, {
                myReferrals: currentList,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              tx.set(refUserRef, {myReferralsUid: FieldValue.arrayUnion(meDocId)}, {merge: true});

              // NEW: bump aggregate counters in referral_stats under BOTH parents
              const statsParents = Array.from(
                  new Set([referrerUsernameLower || null, `uid:${referrerUid}`].filter(Boolean)),
              );
              for (const docId of statsParents) {
                const refStatsRef = db.collection("referral_stats").doc(docId);
                tx.set(
                    refStatsRef,
                    {
                      referrerUid: referrerUid,
                      total_referred: FieldValue.increment(1),
                      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    {merge: true},
                );
              }
            }

            // Write referredBy* on me if not set yet (store both for convenience)
            if (!alreadySet || rebindSameReferrer) {
              tx.set(
                  userRef,
                  {
                    referredBy: referrerUsername || referrerUsernameLower,
                    referredByUid: referrerUid,
                    referredByCode: referralCodeRaw,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    referral_removed_by: FieldValue.delete(),
                    referral_removed_at: FieldValue.delete(),
                  },
                  {merge: true},
              );
            }
          });

          return ok({
            success: true,
            message: "Referral set via code.",
            wroteTo: `users/${meDocId}`,

          });
        });

        return res.status(result.status).json(result.body);
      } catch (error) {
        if (error?.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res
              .status(423)
              .json({busy: true, message: "Another action is in progress. Try again shortly."});
        }

        let code = 500;
        let msg = "Internal error while setting referral.";
        if (typeof error?.message === "string" && error.message.startsWith("MAX_REFERRALS_REACHED")) {
          code = 409;
          const capText = error.message.split(":")[1] || "0";
          msg = `Maximum number of referrals reached (${capText}).`;
        } else {
          const map = {
            CODE_NOT_FOUND: [404, "Referral code not found."],
            SELF_REFERRAL: [400, "Self-referral is not allowed."],
            REFERRAL_ALREADY_SET: [409, "Referral already set and cannot be changed."],
            REFERRER_PROFILE_NOT_FOUND: [404, "Referrer profile not found."],
            SELF_NOT_FOUND: [404, "User profile not found."],
          };
          [code, msg] = map[error?.message] || [code, msg];
        }

        console.error("setReferral (code-only) error:", error);
        return res.status(code).send(msg);
      }
    }),
);


// Resolves ipfs://, ar://, data:, http(s) — return a browser-usable URL
function resolveMediaUrl(u) {
  if (!u) return null;
  const s = String(u);
  if (s.startsWith("ipfs://")) {
    const path = s.replace("ipfs://", "");
    return `https://ipfs.io/ipfs/${path}`;
  }
  if (s.startsWith("ar://")) {
    return `https://arweave.net/${s.slice(5)}`;
  }
  // allow data:, http(s) as-is
  return s;
}

// Extract {name,image} from Moralis item or raw metadata
function pickNameImage(it) {
  const nm = it?.normalized_metadata || it?.normalizedMetadata;
  const mdRaw = it?.metadata;
  let md;
  try {
    if (mdRaw && typeof mdRaw === "string") md = JSON.parse(mdRaw);
  } catch (e) {
    console.log(e);
  }
  const name = it?.name || nm?.name || md?.name || null;
  const image = resolveMediaUrl(nm?.image || md?.image || md?.image_url || it?.image);
  return {name, image};
}

// Optional on-chain backfill for items missing metadata
async function backfillOnchainMeta(provider, collection, tokenId) {
  try {
    const ABI = ["function tokenURI(uint256) view returns (string)"];
    const c = new ethers.Contract(collection, ABI, provider);
    const tokenUri = await c.tokenURI(ethers.toBigInt(tokenId));
    let name = null; let image = null;
    // try to fetch JSON
    const url = resolveMediaUrl(tokenUri);
    if (url && url.startsWith("http")) {
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json().catch(() => null);
        if (j) {
          name = j.name || null;
          image = resolveMediaUrl(j.image || j.image_url || null);
        }
      }
    }
    return {tokenUri, name, image};
  } catch {
    return {};
  }
}

const MORALIS_API_KEY = process.env.MORALIS_API_KEY || (functions.config().moralis && functions.config().moralis.key) || "";

const chainHex = (chainId) => (Number(chainId) === 2020 ? "0x7e4" : "0x7e5"); // mainnet/testnet

const moralisGet = async (url) => {
  const r = await fetch(url, {headers: {"x-api-key": MORALIS_API_KEY}});
  const text = await r.text();
  if (!r.ok) throw new Error(`Moralis GET ${r.status}: ${text}`);
  return JSON.parse(text);
};

// tiny cache to absorb bursts
const _cache = new Map();
const getCache = (k, ttlMs = 10_000) => {
  const v = _cache.get(k);
  return v && Date.now() - v.t < ttlMs ? v.d : null;
};
const setCache = (k, d) => _cache.set(k, {t: Date.now(), d});

exports.getWalletResBalances_moralis = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
    // CORS
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        return res.status(204).send("");
      }
      res.set("Access-Control-Allow-Origin", "*");
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      try {
        if (!MORALIS_API_KEY) return res.status(500).send("MORALIS_API_KEY not configured.");

        // Auth
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        const decoded = await admin.auth().verifyIdToken(idToken).catch(() => null);
        if (!decoded) return res.status(401).send("Unauthorized: Invalid token.");

        // Inputs
        const {userAddress, coreAddress, chainId} = req.body?.data || {};
        if (!userAddress || !coreAddress || !chainId) {
          return res.status(400).send("Missing userAddress/coreAddress/chainId.");
        }

        const staticKey = `coreStatic:${coreAddress.toLowerCase()}`; // wrappers+decimals
        let staticHit = getCache(staticKey, /* ttlMs*/ 10 * 60 * 1000); // 10 min
        if (!staticHit) {
          const core = new ethers.Contract(coreAddress, [
            "function wrapperOf(uint256) view returns (address)",
            "function decimalsOf(uint256) view returns (uint8)",
            "function decimals(uint256) view returns (uint8)",
          ], provider);
          const wrappers = await Promise.all([0, 1, 2].map((id)=>
            withBackoff(() => core.wrapperOf(id)).then(String),
          ));
          const getDec = async (id) => {
            try {
              return Number(await withBackoff(() => core.decimalsOf(id)));
            } catch {
              return Number(await withBackoff(() => core.decimals(id)));
            }
          };
          const decs = await Promise.all([0, 1, 2].map(getDec));
          staticHit = {wrappers, coreDecimalsById: {0: decs[0], 1: decs[1], 2: decs[2]}};
          setCache(staticKey, staticHit);
        }
        const {wrappers, coreDecimalsById} = staticHit;
        const chain = chainHex(chainId);
        // Read from chain directly (Moralis /function can reject Ronin)
        // 3) ERC-20 metadata for wrappers → decimals
        const metaUrl = new URL(`https://deep-index.moralis.io/api/v2.2/erc20/metadata`);
        metaUrl.searchParams.set("chain", chain);
        wrappers
            .filter((a) => a && a !== ethers.ZeroAddress) // guard zero address
            .forEach((a) => metaUrl.searchParams.append("addresses[]", a));
        const metas = await moralisGet(metaUrl.toString());
        const decByAddr = {};
        for (const m of metas || []) decByAddr[(m.address || "").toLowerCase()] = Number(m.decimals || 18);

        const wrapperDecimals = {
          0: wrappers[0] && wrappers[0] !== ethers.ZeroAddress ? (decByAddr[(wrappers[0]||"").toLowerCase()] ?? 18) : 18,
          1: wrappers[1] && wrappers[1] !== ethers.ZeroAddress ? (decByAddr[(wrappers[1]||"").toLowerCase()] ?? 18) : 18,
          2: wrappers[2] && wrappers[2] !== ethers.ZeroAddress ? (decByAddr[(wrappers[2]||"").toLowerCase()] ?? 18) : 18,
        };

        // 4) User ERC-20 balances for wrappers (single call; filter with token_addresses)
        const balUrl = new URL(`https://deep-index.moralis.io/api/v2.2/${userAddress}/erc20`);
        balUrl.searchParams.set("chain", chain);
        wrappers
            .filter((a) => a && a !== ethers.ZeroAddress)
            .forEach((a) => balUrl.searchParams.append("token_addresses", a));
        const balList = await moralisGet(balUrl.toString()); // array of tokens
        const balByAddr = {};
        for (const it of balList || []) {
          const addr = String(it.token_address || it.address || "").toLowerCase();
          balByAddr[addr] = String(it.balance ?? "0");
        }
        const balRes = wrappers.map((a) => ({
          address: a,
          balance: balByAddr[String(a || "").toLowerCase()] || "0",
        }));

        const wrapperBalancesRaw = {
          0: (BigInt(balRes[0]?.balance || "0")).toString(),
          1: (BigInt(balRes[1]?.balance || "0")).toString(),
          2: (BigInt(balRes[2]?.balance || "0")).toString(),
        };
        const walletWrapperBalances = {
          0: (Number(balRes[0]?.balance || "0") / 10 ** wrapperDecimals[0]).toString(),
          1: (Number(balRes[1]?.balance || "0") / 10 ** wrapperDecimals[1]).toString(),
          2: (Number(balRes[2]?.balance || "0") / 10 ** wrapperDecimals[2]).toString(),
        };

        const WRAPPER_MIN_ABI = ["function owner() view returns (address)"];
        const ownersArr = await Promise.all(
            wrappers.map((a) =>
            a && a !== ethers.ZeroAddress ?
              new ethers.Contract(a, WRAPPER_MIN_ABI, provider).owner().catch(() => ethers.ZeroAddress) :
              Promise.resolve(ethers.ZeroAddress),
            ),
        );
        const wrapperOwners = {0: ownersArr[0] || ethers.ZeroAddress, 1: ownersArr[1] || ethers.ZeroAddress, 2: ownersArr[2] || ethers.ZeroAddress};

        // 5) Native RON balance (wei)
        const ronUrl = new URL(`https://deep-index.moralis.io/api/v2.2/${userAddress}/balance`);
        ronUrl.searchParams.set("chain", chain);
        const ron = await moralisGet(ronUrl.toString()); // { balance: "..." }

        const payload = {
          wrappers: {0: wrappers[0], 1: wrappers[1], 2: wrappers[2]},
          wrapperDecimals,
          wrapperBalancesRaw,
          walletWrapperBalances,
          walletRonWei: ron?.balance || "0",
          coreDecimalsById,
          wrapperOwners,
        };

        const userKey = `bal:${chain}:${coreAddress.toLowerCase()}:${userAddress.toLowerCase()}`;
        setCache(userKey, payload);
        return res.json(payload);
      } catch (e) {
        console.error("getWalletResBalances_moralis error:", e);
        return res.status(500).send(e.message || "Internal error.");
      }
    }),
);

exports.getNftMetadata_moralis = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      if (req.method === "OPTIONS") return res.status(204).send("");

      const idToken = req.headers.authorization?.split("Bearer ")[1];
      if (!idToken) return res.status(401).send("Unauthorized");
      await admin.auth().verifyIdToken(idToken);

      const addr = String(req.body?.data?.collectionAddress || req.query?.collectionAddress || "");
      const tokenId = String(req.body?.data?.tokenId || req.query?.tokenId || "");
      const chain = (req.body?.data?.chain || req.query?.chain || "0x7e4").toLowerCase();

      if (!ethers.isAddress(addr) || !tokenId) return res.status(400).send("Bad contract or tokenId");
      if (!["0x7e4", "0x7e5", "ronin", "ronin-testnet"].includes(chain)) return res.status(400).send("Bad chain");

      const apiKey =
        process.env.MORALIS_API_KEY ||
        (functions.config().moralis && functions.config().moralis.api_key);
      if (!apiKey) return res.status(500).send("MORALIS_API_KEY not set");

      const url = new URL(`https://deep-index.moralis.io/api/v2.2/nft/${addr}/${tokenId}`);
      url.searchParams.set("chain", chain);
      url.searchParams.set("format", "decimal");
      url.searchParams.set("normalizeMetadata", "true");

      const resp = await fetch(url, {headers: {"X-API-Key": apiKey, "Accept": "application/json"}});
      if (!resp.ok) {
        const text = await resp.text().catch(()=> "");
        throw new Error(`Moralis ${resp.status}: ${text}`);
      }
      const data = await resp.json();
      const nm = data?.normalized_metadata || data?.normalizedMetadata || {};
      let md = null;
      try {
        if (data?.metadata && typeof data.metadata === "string") md = JSON.parse(data.metadata);
      } catch (e) {
        console.log(e);
      }
      const name = data?.name || nm?.name || md?.name || null;
      const image = resolveMediaUrl(nm?.image || md?.image || md?.image_url || data?.image) || null;
      const tokenUri = data?.token_uri || data?.tokenUri || null;

      return res.json({tokenId: String(tokenId), name, image, tokenUri});
    } catch (e) {
      console.error("getNftMetadata_moralis error:", e);
      return res.status(500).send(e?.message || "Internal Server Error");
    }
  });
});

exports.listOwned721_moralis = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      if (req.method === "OPTIONS") return res.status(204).send("");

      // Auth
      const idToken = req.headers.authorization?.split("Bearer ")[1];
      if (!idToken) return res.status(401).send("Unauthorized");
      await admin.auth().verifyIdToken(idToken);

      // Inputs
      const normalize = (s = "") => String(s).trim().toLowerCase().replace(/^ronin:/, "0x");
      const owner = normalize(req.body?.data?.userAddress || req.query?.userAddress || "");
      const collection = normalize(req.body?.data?.collectionAddress || req.query?.collectionAddress || "");
      const chain = (req.body?.data?.chain || req.query?.chain || "0x7e4").toLowerCase(); // 0x7e4 mainnet / 0x7e5 saigon
      const includeMetadata = ["1", "true", true].includes(String(req.body?.data?.includeMetadata ?? "true").toLowerCase());
      const doBackfill = ["1", "true", true].includes(String(req.body?.data?.backfillOnchain ?? "true").toLowerCase());

      if (!ethers.isAddress(owner) || !ethers.isAddress(collection)) {
        return res.status(400).send("Bad address");
      }
      if (!["0x7e4", "0x7e5", "ronin", "ronin-testnet"].includes(chain)) {
        return res.status(400).send("Bad chain (use 0x7e4 or 0x7e5)");
      }

      const apiKey =
        process.env.MORALIS_API_KEY ||
        (functions.config().moralis && functions.config().moralis.api_key);
      if (!apiKey) {
        return res.status(500).send("MORALIS_API_KEY not set (env or functions.config().moralis.api_key)");
      }

      // Moralis request (filter by contract)
      const tokenIds = [];
      const itemsOut = [];
      let cursor = null;
      const limit = 100;

      do {
        const url = new URL(`https://deep-index.moralis.io/api/v2.2/${owner}/nft`);
        url.searchParams.set("chain", chain);
        url.searchParams.set("format", "decimal");
        url.searchParams.set("limit", String(limit));
        url.searchParams.append("token_addresses", ethers.getAddress(collection));
        if (includeMetadata) url.searchParams.set("normalizeMetadata", "true");
        if (cursor) url.searchParams.set("cursor", cursor);

        const resp = await fetch(url, {headers: {"X-API-Key": apiKey, "Accept": "application/json"}});
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(`Moralis ${resp.status}: ${text}`);
        }
        const data = await resp.json();
        const pageItems = data?.result || data?.items || [];
        for (const it of pageItems) {
          const tokenId = String(it.token_id ?? it.tokenId ?? "");
          if (!tokenId) continue;
          tokenIds.push(tokenId);
          if (includeMetadata) {
            const {name, image} = pickNameImage(it);
            itemsOut.push({
              tokenId, name: name || null, image: image || null,
              tokenUri: it?.token_uri || it?.tokenUri || null,
            });
          }
        }
        cursor = data?.cursor || data?.next_cursor || data?.result?.paging?.nextCursor || null;
      } while (cursor);

      // Keep stable ordering
      tokenIds.sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0));
      if (!includeMetadata) {
        return res.json({tokenIds, count: tokenIds.length, chain});
      }

      // If any item lacks name/image, optionally backfill via on-chain tokenURI
      const missing = itemsOut.filter((x) => !x.name || !x.image);
      if (doBackfill && missing.length) {
        const RONIN_RPC = process.env.RONIN_RPC || "https://api.roninchain.com/rpc";
        const provider = new ethers.JsonRpcProvider(RONIN_RPC);

        // tiny concurrency
        const pool = 3;
        let idx = 0;
        await Promise.all(Array(Math.min(pool, missing.length)).fill(0).map(async () => {
          while (idx < missing.length) {
            const i = idx++;
            const m = missing[i];
            const extra = await backfillOnchainMeta(provider, ethers.getAddress(collection), m.tokenId);
            m.tokenUri = m.tokenUri || extra.tokenUri || null;
            m.name = m.name || extra.name || null;
            m.image = m.image || extra.image || null;
          }
        }));
      }

      // Return sorted by tokenId
      const itemsSorted = itemsOut
          .sort((a, b) => (BigInt(a.tokenId) < BigInt(b.tokenId) ? -1 : BigInt(a.tokenId) > BigInt(b.tokenId) ? 1 : 0));

      return res.json({
        items: itemsSorted,
        count: tokenIds.length,
        chain,
      });
    } catch (e) {
      console.error("listOwned721_moralis error:", e);
      return res.status(500).send(e?.message || "Internal Server Error");
    }
  });
});

// --- Shared Alchemy helpers (Ronin) ---

const ALCHEMY_API_KEY =
  process.env.ALCHEMY_API_KEY ||
  (functions.config().alchemy && (functions.config().alchemy.key || functions.config().alchemy.api_key)) ||
  "";

function alchemyHostForChain(chain) {
  // your code uses hex chain ids
  const c = String(chain || "").toLowerCase();
  // 0x7e4 mainnet, 0x7e5 saigon
  if (c === "0x7e4" || c === "ronin") return "ronin-mainnet.g.alchemy.com";
  if (c === "0x7e5" || c === "ronin-testnet" || c === "saigon") return "ronin-saigon.g.alchemy.com";
  throw new Error("Unsupported chain for Ronin (use 0x7e4 or 0x7e5)");
}

// REST base for NFT API v3
function alchemyNftBase(chain) {
  const host = alchemyHostForChain(chain);
  return `https://${host}/nft/v3/${ALCHEMY_API_KEY}`;
}

// JSON-RPC base (token API + core RPC)
function alchemyRpcBase(chain) {
  const host = alchemyHostForChain(chain);
  return `https://${host}/v2/${ALCHEMY_API_KEY}`;
}

async function alchemyGet(url) {
  const r = await fetch(url, {headers: {"Accept": "application/json"}});
  const txt = await r.text().catch(()=> "");
  if (!r.ok) throw new Error(`Alchemy GET ${r.status}: ${txt}`);
  return JSON.parse(txt || "{}");
}

async function alchemyRpc(url, method, params) {
  const r = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({jsonrpc: "2.0", id: 1, method, params}),
  });
  const txt = await r.text().catch(()=> "");
  if (!r.ok) throw new Error(`Alchemy RPC ${r.status}: ${txt}`);
  const body = JSON.parse(txt || "{}");
  if (body.error) throw new Error(`Alchemy RPC error: ${body.error.message || JSON.stringify(body.error)}`);
  return body.result;
}

const normalizeRonin = (s = "") => String(s).trim().toLowerCase().replace(/^ronin:/, "0x");

// Alchemy's NFT objects: prefer cached image, fall back to raw metadata
function pickAlchemyNameImage(item) {
  const name =
    item?.name ??
    item?.title ??
    item?.raw?.metadata?.name ??
    item?.contract?.name ??
    null;

  const image =
    resolveMediaUrl(
        item?.image?.cachedUrl ||
      item?.image?.pngUrl ||
      item?.raw?.metadata?.image ||
      item?.raw?.metadata?.image_url ||
      item?.tokenUri?.gateway ||
      item?.tokenUri?.raw ||
      null,
    ) || null;

  const tokenUri =
    item?.tokenUri?.gateway ||
    item?.tokenUri?.raw ||
    item?.raw?.tokenUri?.gateway ||
    item?.raw?.tokenUri?.raw ||
    null;

  return {name, image, tokenUri};
}

exports.listOwned721_alchemy = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      if (req.method === "OPTIONS") return res.status(204).send("");

      // Auth
      const idToken = req.headers.authorization?.split("Bearer ")[1];
      if (!idToken) return res.status(401).send("Unauthorized");
      await admin.auth().verifyIdToken(idToken);

      if (!ALCHEMY_API_KEY) return res.status(500).send("ALCHEMY_API_KEY not set");

      // Inputs
      const owner = normalizeRonin(req.body?.data?.userAddress || req.query?.userAddress || "");
      const collection = normalizeRonin(req.body?.data?.collectionAddress || req.query?.collectionAddress || "");
      const chain = (req.body?.data?.chain || req.query?.chain || "0x7e4").toLowerCase(); // 0x7e4 mainnet / 0x7e5 saigon
      const includeMetadata = ["1", "true", true].includes(String(req.body?.data?.includeMetadata ?? "true").toLowerCase());
      const doBackfill = ["1", "true", true].includes(String(req.body?.data?.backfillOnchain ?? "true").toLowerCase());

      if (!ethers.isAddress(owner) || !ethers.isAddress(collection)) {
        return res.status(400).send("Bad address");
      }

      // Alchemy NFT API v3: getNFTsForOwner filtered by contract
      const base = alchemyNftBase(chain);
      const pageSize = 100;

      const tokenIds = [];
      const itemsOut = [];
      let pageKey = null;

      do {
        const url = new URL(`${base}/getNFTsForOwner`);
        url.searchParams.set("owner", ethers.getAddress(owner));
        url.searchParams.append("contractAddresses[]", ethers.getAddress(collection));
        url.searchParams.set("withMetadata", includeMetadata ? "true" : "false");
        url.searchParams.set("pageSize", String(pageSize));
        if (pageKey) url.searchParams.set("pageKey", pageKey);

        const data = await alchemyGet(url.toString());
        const pageItems = data?.ownedNfts || [];

        for (const it of pageItems) {
          const tokenId = String(it?.tokenId ?? it?.id?.tokenId ?? "");
          if (!tokenId) continue;
          tokenIds.push(tokenId);
          if (includeMetadata) {
            const {name, image, tokenUri} = pickAlchemyNameImage(it);
            itemsOut.push({tokenId, name: name || null, image: image || null, tokenUri: tokenUri || null});
          }
        }

        pageKey = data?.pageKey || null;
      } while (pageKey);

      // sort by numeric tokenId asc
      tokenIds.sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0));
      if (!includeMetadata) {
        return res.json({tokenIds, count: tokenIds.length, chain});
      }

      // Backfill (on-chain tokenURI) for missing meta if requested
      const missing = itemsOut.filter((x) => !x.name || !x.image);
      if (doBackfill && missing.length) {
        const provider = new ethers.JsonRpcProvider(alchemyRpcBase(chain));

        const pool = 3;
        let idx = 0;
        await Promise.all(Array(Math.min(pool, missing.length)).fill(0).map(async () => {
          while (idx < missing.length) {
            const i = idx++;
            const m = missing[i];
            const extra = await backfillOnchainMeta(provider, ethers.getAddress(collection), m.tokenId);
            m.tokenUri = m.tokenUri || extra.tokenUri || null;
            m.name = m.name || extra.name || null;
            m.image = m.image || extra.image || null;
          }
        }));
      }

      const itemsSorted = itemsOut.sort((a, b)=> (BigInt(a.tokenId) < BigInt(b.tokenId) ? -1 : BigInt(a.tokenId) > BigInt(b.tokenId) ? 1 : 0));
      return res.json({items: itemsSorted, count: tokenIds.length, chain});
    } catch (e) {
      console.error("listOwned721_alchemy error:", e);
      return res.status(500).send(e?.message || "Internal Server Error");
    }
  });
});

exports.getNftMetadata_alchemy = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      if (req.method === "OPTIONS") return res.status(204).send("");

      const idToken = req.headers.authorization?.split("Bearer ")[1];
      if (!idToken) return res.status(401).send("Unauthorized");
      await admin.auth().verifyIdToken(idToken);

      if (!ALCHEMY_API_KEY) return res.status(500).send("ALCHEMY_API_KEY not set");

      const addr = String(req.body?.data?.collectionAddress || req.query?.collectionAddress || "");
      const tokenId = String(req.body?.data?.tokenId || req.query?.tokenId || "");
      const chain = (req.body?.data?.chain || req.query?.chain || "0x7e4").toLowerCase();

      if (!ethers.isAddress(addr) || !tokenId) return res.status(400).send("Bad contract or tokenId");

      const base = alchemyNftBase(chain);
      const url = new URL(`${base}/getNFTMetadata`);
      url.searchParams.set("contractAddress", ethers.getAddress(addr));
      url.searchParams.set("tokenId", tokenId);
      // You can also pass tokenType=erc721 if you want to be explicit

      const data = await alchemyGet(url.toString());
      const {name, image, tokenUri} = pickAlchemyNameImage(data);

      return res.json({tokenId: String(tokenId), name: name || null, image: image || null, tokenUri: tokenUri || null});
    } catch (e) {
      console.error("getNftMetadata_alchemy error:", e);
      return res.status(500).send(e?.message || "Internal Server Error");
    }
  });
});

exports.getWalletResBalances_alchemy = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
    // CORS
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        return res.status(204).send("");
      }
      res.set("Access-Control-Allow-Origin", "*");
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      try {
      // Auth
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        const decoded = await admin.auth().verifyIdToken(idToken).catch(() => null);
        if (!decoded) return res.status(401).send("Unauthorized: Invalid token.");

        // Inputs
        const {userAddress, coreAddress, chainId} = req.body?.data || {};
        if (!userAddress || !coreAddress || !chainId) {
          return res.status(400).send("Missing userAddress/coreAddress/chainId.");
        }

        const chain = Number(chainId) === 2020 ? "0x7e4" : "0x7e5"; // ronin / saigon
        const rpcUrl = alchemyRpcBase(chain); // e.g. https://ronin-mainnet.g.alchemy.com/v2/<KEY>
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // --- Static (wrappers + core decimals), cached ---
        const staticKey = `coreStatic:${coreAddress.toLowerCase()}`;
        let staticHit = getCache(staticKey, 30 * 60 * 1000); // 30 min cache
        if (!staticHit) {
          const core = new ethers.Contract(coreAddress, [
            "function wrapperOf(uint256) view returns (address)",
            "function decimalsOf(uint256) view returns (uint8)",
            "function decimals(uint256) view returns (uint8)",
          ], provider);

          const wrappers = await Promise.all([0, 1, 2].map((i) =>
            withBackoff(() => core.wrapperOf(i)).then(String),
          ));

          const getDec = async (i) => {
            try {
              return Number(await withBackoff(() => core.decimalsOf(i)));
            } catch {
              return Number(await withBackoff(() => core.decimals(i)));
            }
          };
          const decs = await Promise.all([0, 1, 2].map(getDec));
          staticHit = {wrappers, coreDecimalsById: {0: decs[0], 1: decs[1], 2: decs[2]}};
          setCache(staticKey, staticHit);
        }
        const {wrappers, coreDecimalsById} = staticHit;

        // --- ERC-20 decimals for wrappers (Alchemy Token Metadata -> fallback to on-chain) ---
        const tokenList = wrappers
            .filter((a) => a && a !== ethers.ZeroAddress)
            .map((a) => ethers.getAddress(a));

        const wrapperDecimals = {0: 18, 1: 18, 2: 18};
        // Try Alchemy token metadata first
        for (let i = 0; i < 3; i++) {
          const addr = wrappers[i];
          if (!addr || addr === ethers.ZeroAddress) continue;
          try {
            const meta = await alchemyRpc(rpcUrl, "alchemy_getTokenMetadata", [ethers.getAddress(addr)]);
            const dec = Number(meta?.decimals);
            if (Number.isFinite(dec)) wrapperDecimals[i] = dec;
          } catch {
          // fallback to on-chain decimals()
            try {
              const erc20 = new ethers.Contract(addr, ["function decimals() view returns (uint8)"], provider);
              const dec = Number(await withBackoff(() => erc20.decimals()));
              if (Number.isFinite(dec)) wrapperDecimals[i] = dec;
            } catch {/* keep default 18 */}
          }
        }

        // --- Balances: try Token API, then fallback to direct balanceOf ---
        const balByAddr = {};
        if (tokenList.length) {
          try {
          // Correct param shape for Alchemy Enhanced method
            const result = await alchemyRpc(rpcUrl, "alchemy_getTokenBalances", [
              ethers.getAddress(userAddress),
              tokenList,
            ]); // returns { address, tokenBalances: [{contractAddress, tokenBalance, error}] }
            const arr = Array.isArray(result?.tokenBalances) ? result.tokenBalances : [];
            for (const it of arr) {
              const addr = String(it.contractAddress || "").toLowerCase();
              const hex = it.tokenBalance ?? "0x0";
              if (it.error) {
              // fall through; we'll overwrite from on-chain in fallback
                balByAddr[addr] = "0";
                continue;
              }
              let dec = "0";
              try {
                dec = BigInt(hex).toString();
              } catch {/* keep 0 */}
              balByAddr[addr] = dec;
            }

            // If every balance is "0" and/or we got errors, do a direct read fallback.
            const allZeroOrMissing = tokenList.every((a) => (balByAddr[(a||"").toLowerCase()] ?? "0") === "0");
            if (allZeroOrMissing) throw new Error("token_api_empty_on_ronin");
          } catch {
          // Fallback: direct on-chain ERC-20 balanceOf
            const ABI = ["function balanceOf(address) view returns (uint256)"];
            const reads = tokenList.map(async (a) => {
              try {
                const c = new ethers.Contract(a, ABI, provider);
                const v = await withBackoff(() => c.balanceOf(userAddress));
                balByAddr[a.toLowerCase()] = BigInt(v).toString();
              } catch {
                balByAddr[a.toLowerCase()] = "0";
              }
            });
            await Promise.all(reads);
          }
        }

        const balRes = wrappers.map((a) => ({
          address: a || ethers.ZeroAddress,
          balance: a ? (balByAddr[(a||"").toLowerCase()] || "0") : "0",
        }));

        const wrapperBalancesRaw = {
          0: (BigInt(balRes[0]?.balance || "0")).toString(),
          1: (BigInt(balRes[1]?.balance || "0")).toString(),
          2: (BigInt(balRes[2]?.balance || "0")).toString(),
        };
        const walletWrapperBalances = {
          0: (Number(balRes[0]?.balance || "0") / 10 ** wrapperDecimals[0]).toString(),
          1: (Number(balRes[1]?.balance || "0") / 10 ** wrapperDecimals[1]).toString(),
          2: (Number(balRes[2]?.balance || "0") / 10 ** wrapperDecimals[2]).toString(),
        };

        // Wrapper owners (best-effort)
        const WRAPPER_MIN_ABI = ["function owner() view returns (address)"];
        const ownersArr = await Promise.all(
            wrappers.map((a) =>
          a && a !== ethers.ZeroAddress ?
            new ethers.Contract(a, WRAPPER_MIN_ABI, provider).owner().catch(() => ethers.ZeroAddress) :
            Promise.resolve(ethers.ZeroAddress),
            ),
        );
        const wrapperOwners = {0: ownersArr[0] || ethers.ZeroAddress, 1: ownersArr[1] || ethers.ZeroAddress, 2: ownersArr[2] || ethers.ZeroAddress};

        // Native RON (wei)
        const walletRonWei = (await provider.getBalance(userAddress)).toString();

        const payload = {
          wrappers: {0: wrappers[0], 1: wrappers[1], 2: wrappers[2]},
          wrapperDecimals,
          wrapperBalancesRaw,
          walletWrapperBalances,
          walletRonWei,
          coreDecimalsById,
          wrapperOwners,
        };

        const userKey = `bal:${chain}:${coreAddress.toLowerCase()}:${userAddress.toLowerCase()}`;
        setCache(userKey, payload);
        return res.json(payload);
      } catch (e) {
        console.error("getWalletResBalances_alchemy error:", e);
        return res.status(500).send(e.message || "Internal error.");
      }
    }),
);


// ---- Small helper to safely get a tier ----
function referral_tiers_safe(level) {
  const tier = REFERRAL_TIERS.find((t) => t.level === level);
  if (!tier) throw new Error("Unknown target tier.");
  return tier;
}

exports.upgradeReferralTier = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") {
          return res.status(405).send("Method Not Allowed");
        }

        // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");

        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        const uid = decoded.uid;

        // --- Input ---
        const data = req.body?.data || {};
        const meRaw = String(data.me || "").trim(); // username
        const targetLevelRaw = Number(data.targetLevel);
        const nonce = String(data.nonce || "");
        const signature = String(data.signature || "");

        if (!meRaw || meRaw.length < 3 || meRaw.length > 15) {
          return res.status(400).send("Invalid username.");
        }
        if (!Number.isFinite(targetLevelRaw)) {
          return res.status(400).send("Invalid targetLevel.");
        }
        if (!signature) {
          return res.status(400).send("Missing signature.");
        }

        // --- Mutex / idempotency key ---
        const requestId = stableRequestIdFrom({
          op: "upgradeReferralTier",
          uid,
          me: meRaw.toLowerCase(),
          targetLevel: targetLevelRaw | 0,
          nonce, // included to make the key unique per signed intent (optional)
        });

        const result = await withUserMutex(uid, requestId, async (lock) => {
        // All state changes happen in a single TX
          const outcome = await admin.firestore().runTransaction(async (tx) => {
            const userRef = admin.firestore().collection("users").doc(uid);
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) throw new Error("User data not found.");

            const user = userSnap.data() || {};
            const currentLevel = Number.isFinite(user.referral_level) ? Number(user.referral_level) : 0;
            const username = String(user.username || "").trim();
            if (!username) throw new Error("Username not set on profile.");

            // Username must match caller-provided "me" (case-insensitive)
            if (username.toLowerCase() !== meRaw.toLowerCase()) {
              throw new Error("Username mismatch.");
            }

            // Validate target
            const targetLevel = targetLevelRaw | 0;
            if (targetLevel < 1 || targetLevel > 6) {
              throw new Error("Target level out of range.");
            }
            if (targetLevel !== currentLevel + 1) {
              throw new Error("You must upgrade one tier at a time.");
            }

            const tier = referral_tiers_safe(targetLevel); // small helper below
            const cost = tier.cost; // {wood, stone, food}

            // --- Signature verification ---
            // Must match the exact message the client signs:
            // `Upgrade referral tier by username: ${JSON.stringify({ me, targetLevel, nonce })}`
            const msgPayload = {me: username, targetLevel, nonce}; // preserve key order
            const message = `Upgrade referral tier by username: ${JSON.stringify(msgPayload)}`;

            const recovered = ethers.verifyMessage(message, signature).toLowerCase();

            // Determine the expected wallet address for this user
            const expectedAddr =
            String(
                user.wallet_address ||
              user.wallet ||
              user.address ||
              decoded.walletAddress ||
              decoded.address ||
              uid, // some setups use the address as UID
            ).toLowerCase();

            if (!expectedAddr || recovered !== expectedAddr) {
              throw new Error("Invalid signature.");
            }

            // --- Resource check ---
            const have = {
              wood: Number(user.wood || 0),
              stone: Number(user.stone || 0),
              food: Number(user.food || 0),
            };
            if (have.wood < cost.wood || have.stone < cost.stone || have.food < cost.food) {
              throw new Error("Not enough resources for upgrade.");
            }

            // --- Apply updates ---
            tx.update(userRef, {
              referral_level: targetLevel,
              wood: FieldValue.increment(-cost.wood),
              stone: FieldValue.increment(-cost.stone),
              food: FieldValue.increment(-cost.food),
              referral_upgraded_at: admin.firestore.FieldValue.serverTimestamp(),
            });

            return {targetLevel, cost};
          });

          // Mark the mutex as completed (pattern A)
          await lock.markCompleted({upgradedTo: outcome.targetLevel});

          return ok({
            success: true,
            upgradedTo: outcome.targetLevel,
            cost: outcome.cost,
          });
        }, {scope: "referral-upgrade", idempotencyKey: requestId});

        return res.status(result.status).json(result.body);
      } catch (error) {
        if (error.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({
            busy: true,
            message: "Another action is in progress. Try again shortly.",
          });
        }
        console.error("Error in upgradeReferralTier:", error);
        return res.status(500).send(error.message || "An internal error occurred.");
      }
    }),
);

// Helper: canonical user id (wallet-first, normalizes ronin: → 0x, lowercased)
function canonicalUserIdFromDecoded(decoded) {
  const raw = String(decoded.walletAddress || decoded.address || decoded.uid || "");
  return raw.replace(/^ronin:/i, "0x").toLowerCase();
}

exports.removeReferral = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        // Helper normalizers
        const normAddr = (s) => String(s || "").replace(/^ronin:/i, "0x").toLowerCase();
        const isAddr = (s) => /^((0x)|(?:ronin:))[0-9a-f]{40}$/i.test(String(s || ""));

        // Canonical referrer = wallet-first id
        const referrerId = normAddr(decoded.walletAddress || decoded.address || decoded.uid || "");
        if (!referrerId) return res.status(401).send("Unauthorized: Missing principal.");

        // --- Input ---
        const data = req.body?.data || {};
        const referredUidRaw = String(data.referredUid || data.uid || "").trim();
        const referredUsernameRaw = String(data.referredUsername || data.username || "").trim();
        const byUserDocIdRaw = String(data.byUserDocId || "").trim();

        if (!referredUidRaw && !referredUsernameRaw && !byUserDocIdRaw) {
          return res.status(400).send("Provide referredUid or referredUsername or byUserDocId.");
        }

        let referredId = referredUidRaw ? normAddr(referredUidRaw) : "";
        const referredUsername = referredUsernameRaw;

        // Resolve username -> uid if needed
        if (!referredId && referredUsername) {
          const unameSnap = await db.collection("usernames").doc(referredUsername.toLowerCase()).get();
          if (!unameSnap.exists) return res.status(404).send("Referred username not found.");
          referredId = normAddr(unameSnap.get("uid") || "");
          if (!referredId) return res.status(404).send("Referred username not found.");
        }

        // Fallback: address-like by_user id
        const byUserDocId = byUserDocIdRaw || referredId || "";
        if (!referredId && isAddr(byUserDocId)) referredId = normAddr(byUserDocId);

        // --- Reads (outside of transaction) ---
        const referrerRef = db.collection("users").doc(referrerId);
        const referredRef = db.collection("users").doc(referredId);

        const [referrerSnap, referredSnap] = await Promise.all([referrerRef.get(), referredRef.get()]);
        if (!referrerSnap.exists) return res.status(404).send("Referrer profile not found.");
        if (!referredSnap.exists) return res.status(404).send("Referred user not found.");

        const referrer = referrerSnap.data() || {};
        const referred = referredSnap.data() || {};

        const referrerUsername = String(referrer.username || "").trim();
        const referrerUsernameLower = referrerUsername.toLowerCase();
        const referredCurrentUsername = String(referred.username || ""); // may be missing
        const referredCurrentUsernameLower = referredCurrentUsername.toLowerCase();

        // Current lists
        const currentList = Array.isArray(referrer.myReferrals) ? referrer.myReferrals.map(String) : [];
        const currentUidList = Array.isArray(referrer.myReferralsUid) ? referrer.myReferralsUid.map(String) : [];

        // Map every username currently in the list -> uid via /usernames once
        const nameEntries = currentList.filter((v) => !isAddr(v));
        const uniqueLower = Array.from(new Set(nameEntries.map((s) => s.toLowerCase())));
        const nameDocs = await Promise.all(
            uniqueLower.map((n) => db.collection("usernames").doc(n).get()),
        );
        const nameToUid = new Map();
        nameDocs.forEach((s, i) => {
          if (s.exists) nameToUid.set(uniqueLower[i], normAddr(s.get("uid") || ""));
        });

        // Decide if an entry belongs to the referred user
        const belongs = (entry) => {
          const s = String(entry || "");
          if (isAddr(s)) return normAddr(s) === referredId;
          const low = s.toLowerCase();
          if (low === referredCurrentUsernameLower) return true;
          if (referredUsername) {
            const inReq = referredUsername.toLowerCase();
            if (low === inReq) return true;
          }
          return nameToUid.get(low) === referredId;
        };

        // Rebuild arrays
        const filteredList = currentList.filter((s) => !belongs(s));
        const removedFromNames = currentList.length - filteredList.length;

        const filteredUidList = currentUidList.filter((u) => normAddr(u) !== referredId);
        const removedFromUids = currentUidList.length - filteredUidList.length;

        // Check if referred user currently points to referrer
        const pointsToReferrer =
        (String(referred.referredByUid || "").toLowerCase() === referrerId) ||
        (referrerUsername && String(referred.referredBy || "").toLowerCase() === referrerUsernameLower);

        // Stats parents (username + stable uid parent)
        const statsDocIds = Array.from(new Set([referrerUsernameLower || null, `uid:${referrerId}`].filter(Boolean)));
        const statsRefs = statsDocIds.map((id) => db.collection("referral_stats").doc(id));

        // by_user rollup (prefer uid id)
        const byUserKey = referredId || (isAddr(byUserDocId) ? byUserDocId.toLowerCase() : "");
        const byUserRefs = byUserKey ? statsRefs.map((p) => p.collection("by_user").doc(byUserKey)) : [];

        // Build batch writes
        const batch = db.batch();
        const FieldValue = admin.firestore.FieldValue;

        const shouldDec = (removedFromNames > 0) || (removedFromUids > 0) || pointsToReferrer; // decrement once

        // 1) Referrer arrays
        if (removedFromNames > 0 || removedFromUids > 0) {
          const patch = {updatedAt: admin.firestore.FieldValue.serverTimestamp()};
          if (removedFromNames > 0) patch.myReferrals = filteredList;
          if (removedFromUids > 0) patch.myReferralsUid = filteredUidList;
          batch.update(referrerRef, patch);
        }

        // 2) Referred user link
        if (pointsToReferrer) {
          batch.set(
              referredRef,
              {
                referredBy: FieldValue.delete(),
                referredByUid: FieldValue.delete(),
                referredByCode: FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                referral_removed_by: referrerId,
                referral_removed_at: admin.firestore.FieldValue.serverTimestamp(),
              },
              {merge: true},
          );
        }

        // 3) Stats decrement (once) + delete per-user rollups
        if (shouldDec) {
          for (const sRef of statsRefs) {
            batch.set(
                sRef,
                {total_referred: FieldValue.increment(-1), updatedAt: admin.firestore.FieldValue.serverTimestamp(), referrerUid: referrerId},
                {merge: true},
            );
          }
        }
        for (const r of byUserRefs) batch.delete(r);

        // 4) Flat pair doc
        const flatRef = db.collection("referrals").doc(`${referrerId}_${referredId}`);
        batch.delete(flatRef);

        await batch.commit();

        return res.status(200).json({
          success: true,
          referrerId,
          referredId,
          removedFromNames,
          removedFromUids,
          pointsToReferrer,
          decremented: !!shouldDec,
          byUserKey: byUserKey || null,
        });
      } catch (error) {
        if (error?.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("removeReferral error:", error);
        return res.status(500).send(error?.message || "Internal error while removing referral.");
      }
    }),
);

const EXP_TIERS = [
  {level: 1, upgrade: {wood: 1000, stone: 1000, food: 1000}, missionsPerDay: 1, chancePct: 30, shardMin: 2, shardMax: 3, cooldownH: 24},
  {level: 2, upgrade: {wood: 2000, stone: 2000, food: 2000}, missionsPerDay: 1, chancePct: 40, shardMin: 2, shardMax: 3, cooldownH: 22},
  {level: 3, upgrade: {wood: 3000, stone: 3000, food: 3000}, missionsPerDay: 1, chancePct: 50, shardMin: 3, shardMax: 4, cooldownH: 20},
  {level: 4, upgrade: {wood: 4000, stone: 4000, food: 4000}, missionsPerDay: 1, chancePct: 55, shardMin: 3, shardMax: 5, cooldownH: 18},
  {level: 5, upgrade: {wood: 5000, stone: 5000, food: 5000}, missionsPerDay: 1, chancePct: 60, shardMin: 4, shardMax: 5, cooldownH: 16},
  {level: 6, upgrade: {wood: 6000, stone: 6000, food: 6000}, missionsPerDay: 2, chancePct: 60, shardMin: 4, shardMax: 5, cooldownH: 14},
  {level: 7, upgrade: {wood: 7000, stone: 7000, food: 7000}, missionsPerDay: 2, chancePct: 65, shardMin: 4, shardMax: 6, cooldownH: 12},
  {level: 8, upgrade: {wood: 8000, stone: 8000, food: 8000}, missionsPerDay: 2, chancePct: 70, shardMin: 5, shardMax: 6, cooldownH: 10},
  {level: 9, upgrade: {wood: 9000, stone: 9000, food: 9000}, missionsPerDay: 2, chancePct: 75, shardMin: 5, shardMax: 7, cooldownH: 9},
  {level: 10, upgrade: {wood: 10000, stone: 10000, food: 10000}, missionsPerDay: 3, chancePct: 80, shardMin: 6, shardMax: 8, cooldownH: 8},
];

const TRIP_COST = {food: 75, wood: 35, stone: 35}; // total per run

const exp_tier_safe = (level) => {
  const t = EXP_TIERS.find((x) => x.level === level);
  if (!t) throw new Error("Unknown exploration tier");
  return t;
};

exports.upgradeExplorationLevel = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        const uidLower = String(decoded.uid);

        // --- Input ---
        const data = req.body?.data || {};
        const targetLevelRaw = Number(data.targetLevel);
        const nonce = String(data.nonce || "");
        const signature = String(data.signature || "");
        if (!Number.isFinite(targetLevelRaw)) return res.status(400).send("Invalid targetLevel.");
        if (!signature) return res.status(400).send("Missing signature.");

        // Idempotency
        const requestId = stableRequestIdFrom({
          op: "upgradeExplorationLevel",
          uid: uidLower,
          targetLevel: targetLevelRaw | 0,
          nonce,
        });

        const result = await withUserMutex(uidLower, requestId, async (lock) => {
          const out = await admin.firestore().runTransaction(async (tx) => {
            const userRef = admin.firestore().collection("users").doc(uidLower);
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) throw new Error("User data not found.");
            const user = userSnap.data() || {};

            try {
              await consumeNonceOrFailInTx(tx, uidLower, "upgrade_exploration", String(nonce));
            } catch {
              throw new Error("Duplicate request.");
            }

            // IMPORTANT: default to 0 so 0 -> 1 is allowed
            const curRaw = Number(user.exploration_level);
            const currentLevel = Number.isFinite(curRaw) ? Math.max(0, Math.min(curRaw, 10)) : 0;

            const targetLevel = targetLevelRaw | 0;
            if (targetLevel < 1 || targetLevel > 10) {
              throw new Error("Target level out of range.");
            }
            if (targetLevel !== currentLevel + 1) {
              throw new Error("You must upgrade one tier at a time.");
            }

            const tier = exp_tier_safe(targetLevel); // from your EXP_TIERS
            const cost = tier.upgrade;

            // Signature verification (must match client message)
            // `Upgrade exploration tier: ${JSON.stringify({ targetLevel, nonce })}`
            const msgPayload = {targetLevel, nonce}; // keep key order
            const message = `Upgrade exploration tier: ${JSON.stringify(msgPayload)}`;
            const recovered = ethers.verifyMessage(message, signature).toLowerCase();

            const expectedAddr = String(
                user.wallet_address || user.wallet || user.address ||
            decoded.walletAddress || decoded.address || uidLower,
            ).toLowerCase();
            if (!expectedAddr || recovered !== expectedAddr) throw new Error("Invalid signature.");

            // Resource check
            const have = {
              wood: Number(user.wood || 0),
              stone: Number(user.stone || 0),
              food: Number(user.food || 0),
            };
            if (have.wood < cost.wood || have.stone < cost.stone || have.food < cost.food) {
              throw new Error("Not enough resources for upgrade.");
            }

            // Apply updates
            tx.update(userRef, {
              exploration_level: targetLevel,
              wood: admin.firestore.FieldValue.increment(-cost.wood),
              stone: admin.firestore.FieldValue.increment(-cost.stone),
              food: admin.firestore.FieldValue.increment(-cost.food),
              exploration_upgraded_at: admin.firestore.FieldValue.serverTimestamp(),
            });

            return {targetLevel, cost};
          });

          await lock.markCompleted({upgradedTo: out.targetLevel});
          return ok({success: true, upgradedTo: out.targetLevel, cost: out.cost});
        }, {scope: "exploration-upgrade", idempotencyKey: requestId});

        return res.status(result.status).json(result.body);
      } catch (error) {
        if (error.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("Error in upgradeExplorationLevel:", error);
        return res.status(500).send(error.message || "An internal error occurred.");
      }
    }),
);


exports.startExploration = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        const uidLower = String(decoded.uid); // keep exact UID keying for your users/<uid> docs

        // --- Input ---
        const data = req.body?.data || {};
        const levelRaw = Number(data.level);
        const nonce = String(data.nonce || "");
        const signature = String(data.signature || "");
        if (!Number.isFinite(levelRaw)) return res.status(400).send("Invalid level.");
        if (!signature) return res.status(400).send("Missing signature.");

        // --- RON helpers (same pattern as mint) ---
        const RON_MICROS = 1_000_000;
        const microsToRon = (x) => Number(x || 0) / RON_MICROS;
        const readRonTankMicros = (u) => {
          const micro = Number(u?.gasTankRonMicros);
          if (Number.isFinite(micro)) return micro;
          const ron = Number(u?.gasTankRon);
          return Number.isFinite(ron) ? Math.round(ron * RON_MICROS) : 0;
        };
        const FEE_PER_EXPLORE_RON = 0.1;
        const FEE_PER_EXPLORE_RON_MICROS = Math.round(FEE_PER_EXPLORE_RON * RON_MICROS);

        // Idempotency
        const requestId = stableRequestIdFrom({
          op: "startExploration",
          uid: uidLower,
          level: levelRaw | 0,
          nonce,
        });

        const result = await withUserMutex(
            uidLower,
            requestId,
            async (lock) => {
              const out = await admin.firestore().runTransaction(async (tx) => {
                const userRef = admin.firestore().collection("users").doc(uidLower);
                const jobRef = admin.firestore().collection("exploration_jobs").doc(uidLower);

                const [userSnap, jobSnap] = await Promise.all([tx.get(userRef), tx.get(jobRef)]);
                if (!userSnap.exists) throw new Error("User data not found.");
                const user = userSnap.data() || {};

                // Block if a job is still active/pending.
                if (jobSnap.exists) {
                  const job = jobSnap.data() || {};
                  const status = String(job.status || "").toLowerCase();
                  if (status === "active" || status === "pending") {
                    throw new Error("Active job exists.");
                  }
                }

                // --- Access gate: must have exploration_level >= 1 on profile ---
                const storedLevel = Number.isFinite(user.exploration_level) ? Number(user.exploration_level) : 0;
                if (storedLevel < 1) {
                  throw new Error("Exploration locked: reach level 1 first.");
                }

                // Sanity: client-provided level must be 1..10 and match profile
                const level = levelRaw | 0;
                if (level < 1 || level > 10) throw new Error("Level out of range.");
                if (level !== storedLevel) throw new Error("Level mismatch.");

                const tier = exp_tier_safe(level);

                // Signature check
                const msgPayload = {level, nonce};
                const message = `Start exploration: ${JSON.stringify(msgPayload)}`;
                const recovered = ethers.verifyMessage(message, signature).toLowerCase();
                const expectedAddr = String(
                    user.wallet_address ||
              user.wallet ||
              user.address ||
              decoded.walletAddress ||
              decoded.address ||
              uidLower,
                ).toLowerCase();
                if (!expectedAddr || recovered !== expectedAddr) throw new Error("Invalid signature.");

                // ---- Anti-replay (consume nonce atomically; same helper you use in mint) ----
                try {
                  await consumeNonceOrFailInTx(tx, uidLower, "start_exploration", String(nonce));
                } catch (e) {
                  throw new Error("Duplicate request."); // clean surface message for client
                }

                // Resource check (trip cost is total per run)
                const have = {
                  wood: Number(user.wood || 0),
                  stone: Number(user.stone || 0),
                  food: Number(user.food || 0),
                };
                if (have.wood < TRIP_COST.wood || have.stone < TRIP_COST.stone || have.food < TRIP_COST.food) {
                  throw new Error("Not enough resources for trip.");
                }

                // --- New: RON tank check (0.1 RON)
                if (readRonTankMicros(user) < FEE_PER_EXPLORE_RON_MICROS) {
                  throw new Error("Not enough RON in game wallet.");
                }

                const hoursToMs = (h) => Math.max(0, Math.round(h * 3600000));
                const now = admin.firestore.Timestamp.now();
                const endsAt = admin.firestore.Timestamp.fromMillis(
                    now.toMillis() + hoursToMs(tier.cooldownH),
                );

                // Deduct trip cost + RON fee, then (re)create the job — all atomically
                tx.update(userRef, {
                  wood: admin.firestore.FieldValue.increment(-TRIP_COST.wood),
                  stone: admin.firestore.FieldValue.increment(-TRIP_COST.stone),
                  food: admin.firestore.FieldValue.increment(-TRIP_COST.food),
                  gasTankRonMicros: admin.firestore.FieldValue.increment(-FEE_PER_EXPLORE_RON_MICROS),
                  gasTankRon: admin.firestore.FieldValue.increment(-microsToRon(FEE_PER_EXPLORE_RON_MICROS)),
                  last_exploration_started_at: now,
                });

                tx.set(
                    jobRef,
                    {
                      uid: uidLower,
                      level,
                      status: "active",
                      startedAt: now,
                      endsAt,
                      lastOutcome: null,
                    },
                    {merge: true},
                );

                return {
                  level,
                  startedAt: now.toDate().toISOString(),
                  endsAt: endsAt.toDate().toISOString(),
                };
              });

              await lock.markCompleted({started: true});
              return ok({success: true, job: out});
            },
            {scope: "exploration-start", idempotencyKey: requestId},
        );

        return res.status(result.status).json(result.body);
      } catch (error) {
        if (error.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("Error in startExploration:", error);
        return res.status(500).send(error.message || "An internal error occurred.");
      }
    }),
);


exports.collectExplorationRewards = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        // -------- AUTH --------
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        // IMPORTANT: keep exact UID (your UI listens to users/{authUid} and jobs/{authUid})
        const uid = String(decoded.uid);

        // -------- INPUTS --------
        const data = req.body?.data || {};
        const nonce = String(data.nonce || "");
        const signature = String(data.signature || "");
        if (!signature) return res.status(400).send("Missing signature.");

        // Idempotency key for this collect
        const requestId = stableRequestIdFrom({
          op: "collectExplorationRewards",
          uid,
          nonce,
        });

        const result = await withUserMutex(
            uid,
            requestId,
            async (lock) => {
              // ——— TRANSACTION: validate job, roll RNG, write outcome ———
              const outcome = await admin.firestore().runTransaction(async (tx) => {
                const userRef = db.collection("users").doc(uid);
                const jobRef = db.collection("exploration_jobs").doc(uid);

                const [userSnap, jobSnap] = await Promise.all([tx.get(userRef), tx.get(jobRef)]);
                if (!userSnap.exists) throw new Error("User data not found.");
                if (!jobSnap.exists) throw new Error("No exploration job found.");

                const user = userSnap.data() || {};
                const job = jobSnap.data() || {};

                // Sig must match the client message
                const payload = {nonce};
                const message = `Collect exploration rewards: ${JSON.stringify(payload)}`;
                const norm = (s) => String(s || "").replace(/^ronin:/i, "0x").toLowerCase();

                const recoveredAddr = norm(ethers.verifyMessage(message, signature));
                let profileAddr = norm(user.wallet_address || user.wallet || user.address || "");

                // First-time link: persist recovered signer as the profile wallet
                if (!profileAddr) {
                  tx.update(userRef, {wallet_address: recoveredAddr});
                  profileAddr = recoveredAddr;
                }
                if (recoveredAddr !== profileAddr) throw new Error("Invalid signature.");

                // Must be active and finished
                if (String(job.status || "").toLowerCase() !== "active") {
                  throw new Error("Job not active.");
                }
                const now = admin.firestore.Timestamp.now();
                const ends =
              job.endsAt?.toDate ? job.endsAt.toDate().getTime() :
              typeof job.endsAt === "number" ? job.endsAt : 0;
                if (!ends || now.toMillis() < ends) {
                  throw new Error("Exploration not finished yet.");
                }

                // RNG (crypto) + shard count
                const level = Number(job.level || 1);
                const tier = exp_tier_safe(level);

                // Player bonuses
                const hasHistorian = Number(user.has_historian || 0) > 0;
                const hasMedallion = Number(user.has_medallion || 0) > 0;

                // Compute effective chance
                const baseChancePct = Number(tier.chancePct || 0);
                const bonusPct = (hasHistorian ? 5 : 0) + (hasMedallion ? 2 : 0); // +7% if both
                const effectiveChancePct = Math.min(100, baseChancePct + bonusPct);

                // roll 0.00 .. 99.99 and compare
                const roll = Number(crypto.randomInt(0, 10_000)) / 100;
                const won = roll < effectiveChancePct;

                let shards = 0;
                if (won) {
                  const min = Math.max(1, Math.floor(Number(tier.shardMin || 1)));
                  const max = Math.max(min, Math.floor(Number(tier.shardMax || min)));
                  const span = max - min + 1;
                  shards = min + crypto.randomInt(0, span);
                }

                const mintRequestId = won ?
              stableRequestIdFrom({op: "collectShard", uid, explorationJobId: jobRef.id, nonce}) :
              null;

                // Persist outcome on the job (server truth)
                tx.update(jobRef, {
                  status: "complete",
                  completedAt: now,
                  lastOutcome: won ? "won" : "miss",
                  lastRoll: roll,
                  lastResult: won ?
                {type: "shard", shards, mintRequestId} :
                {type: "none", shards: 0},
                });

                return {
                  jobId: jobRef.id,
                  won,
                  shards,
                  mintRequestId,
                  toAddr: profileAddr, // 0x-lower
                };
              });

              // ——— If win: enqueue shard mint job + submit a SINGLE on-chain TX ———
              if (outcome.won && outcome.shards > 0 && outcome.mintRequestId) {
                const mintRef = db.collection("mint_jobs").doc(outcome.mintRequestId);

                // Fast idempotency
                const existing = await mintRef.get();
                if (existing.exists) {
                  const j = existing.data() || {};
                  if (["reserved", "pending", "processing", "completed"].includes(String(j.status || ""))) {
                    await lock.markCompleted({collected: true, alreadyMinting: true});
                    return ok({
                      success: true,
                      won: true,
                      shards: Number(outcome.shards),
                      mintRequestId: outcome.mintRequestId,
                      message: `You found ${Number(outcome.shards)} shard(s)!`,
                    });
                  }
                }

                // Create job as FREE (no locks), record expectedAmount
                await mintRef.set({
                  status: "reserved",
                  reason: "collect_shard",
                  ownerUid: uid, // exact UID to reach users/{uid}
                  userAddress: outcome.toAddr, // 0x-lower for on-chain
                  toolType: "Blueprint_Shard",
                  toolTypeForTx: "Blueprint_Shard",
                  rarity: "Common",
                  amount: Number(outcome.shards), // expectedAmount for finalizer
                  expectedAmount: Number(outcome.shards), // explicit
                  dynamicCostData: {food: 0, wood: 0, stone: 0},
                  burnTokenIds: [],
                  burnedToolDocIds: [],
                  skinsBurnIds: [],
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  attempts: 0,
                }, {merge: false});

                // Submit EXACTLY ONE TX here:
                //  - Prefer batch when shards > 1
                //  - Otherwise single mint
                //  - Do NOT loop here; the finalizer will top-up if the chain minted fewer than expected.
                try {
                  let txResp;
                  if (Number(outcome.shards) > 1 && typeof contractTools.ownerMintBatchMixed === "function") {
                    const n = Number(outcome.shards);
                    const typesArr = Array(n).fill("Blueprint_Shard");
                    const raritiesArr = Array(n).fill("Common");
                    txResp = await contractTools.ownerMintBatchMixed(outcome.toAddr, typesArr, raritiesArr);
                  } else if (typeof contractTools.ownerMint === "function") {
                    txResp = await contractTools.ownerMint(outcome.toAddr, "Blueprint_Shard", "Common");
                  } else {
                    throw new Error("No suitable mint function found (need ownerMintBatchMixed or ownerMint).");
                  }

                  await mintRef.set({status: "pending", txHash: txResp.hash || null}, {merge: true});
                } catch (e) {
                  await mintRef.set(
                      {status: "failed", lastError: String(e?.message || e)},
                      {merge: true},
                  );
                  // Still return the exploration outcome to the client.
                }
              }

              await lock.markCompleted({collected: true});

              return ok({
                success: true,
                won: outcome.won,
                shards: Number(outcome.shards || 0),
                mintRequestId: outcome.mintRequestId || null,
                message: outcome.won ?
              `You found ${Number(outcome.shards)} shard(s)!` :
              "No drop this time.",
              });
            },
            {scope: "exploration-collect", idempotencyKey: requestId},
        );

        return res.status(result.status).json(result.body);
      } catch (error) {
        if (error.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({
            busy: true,
            message: "Another action is in progress. Try again shortly.",
          });
        }
        console.error("Error in collectExplorationRewards:", error);
        return res.status(500).send(error.message || "An internal error occurred.");
      }
    }),
);

exports.repairTool = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") {
          return res.status(405).send(
              "Method Not Allowed");
        }

        // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) {
          return res.status(401).send(
              "Unauthorized: No token provided.");
        }

        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        // --- Input normalization ---
        const data = req.body?.data || {};
        const token = data.token;
        const signature = data.signature;
        let repairs = [];
        if (Array.isArray(data.repairs)) {
          repairs = data.repairs
              .map((r) => {
                const nRaw = Number.parseInt(r?.repairAmount, 10);
                const n = Number.isFinite(nRaw) ? nRaw : 0;
                return {stakedNftDocId: r?.stakedNftDocId,
                  repairAmount: n};
              })
              .filter((r) => r.stakedNftDocId && r.repairAmount > 0);
        } else if (data.stakedNftDocId) {
          const nRaw = Number.parseInt(data.repairAmount, 10);
          const n = Number.isFinite(nRaw) ? nRaw : 0;
          if (n > 0) {
            repairs = [{stakedNftDocId: data.stakedNftDocId,
              repairAmount: n}];
          }
        }
        if (repairs.length === 0) {
          return err(400,
              "Missing repair payload.");
        }
        if (repairs.length > 450) {
          return err(400,
              "Too many tools at once.");
        }

        const ownerId = (decoded.walletAddress ||
         decoded.address || decoded.uid || "").toLowerCase();
        const userRef = db.collection("users").doc(decoded.uid);

        // --- Stateless token + signature verify ---
        try {
          verifyChallengeToken(token, ownerId);

          const normForSig = repairs
              .map((r) => ({stakedNftDocId: String(r.stakedNftDocId),
                repairAmount: Number(r.repairAmount | 0)}))
              .sort((a, b) => a.stakedNftDocId.localeCompare(
                  b.stakedNftDocId));
          const payload = {action: "repair", userAddress: ownerId,
            repairs: normForSig, token};
          const message = `Repair tools: ${JSON.stringify(payload)}`;

          const recovered = ethers.verifyMessage(message, signature);
          if (recovered.toLowerCase() !== ownerId) {
            return res.status(401).send("Invalid signature.");
          }
        } catch (e) {
          console.error("Repair auth verify failed:", e);
          return res.status(401).send(e.message || "Authorization failed.");
        }

        // --- Mutex (Pattern A) ---
        const requestId = stableRequestIdFrom({
          op: "repairTool",
          uid: ownerId,
          token,
          repairs: repairs
              .map((r) => ({id: String(r.stakedNftDocId),
                n: Number(r.repairAmount | 0)}))
              .sort((a, b) => a.id.localeCompare(b.id)),
        });

        const result = await withUserMutex(ownerId, requestId, async (lock) => {
          const outcome = await db.runTransaction(async (tx) => {
          // PHASE 1: reads
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) throw new Error("User data not found.");

            const userData = userSnap.data() || {};
            const userEnergy = userData.energy || 0;
            if (userEnergy <= 0) {
              throw new Error(
                  "Not enough energy to repair (need > 0).");
            }

            const nftRefs = repairs.map((r) => db.collection(
                "staked_nfts").doc(r.stakedNftDocId));
            const nftSnaps = await tx.getAll(...nftRefs);

            const normalized = [];
            const costIdSet = new Set();

            for (let i = 0; i < nftSnaps.length; i++) {
              const snap = nftSnaps[i];
              if (!snap.exists) continue;

              const d = snap.data();
              const owner = (d.userAddress || "").toLowerCase();
              if (owner !== ownerId) continue;

              const current = d.durability || 0;
              if (current >= 20) continue;

              const requested = Math.max(0, repairs[i].repairAmount | 0);
              if (!requested) continue;

              const missing = 20 - current;
              const inc = Math.min(requested, missing);

              const tool = (d.toolType || "").toLowerCase();
              const rarity = (d.rarity || "").toLowerCase();
              const costId = `${tool}_${rarity}`;
              costIdSet.add(costId);

              normalized.push({index: i, ref: nftRefs[i], inc, costId,
                idStr: repairs[i].stakedNftDocId});
            }

            if (normalized.length === 0) {
              throw new Error(
                  "No eligible tools to repair.");
            }

            const costIds = Array.from(costIdSet);
            const costRefs = costIds.map((id) => db.collection(
                "craft_cost_tools").doc(id.toLowerCase()));
            const costSnaps = costRefs.length ? await tx.getAll(
                ...costRefs) : [];

            const costMap = new Map();
            for (let i = 0; i < costSnaps.length; i++) {
              const snap = costSnaps[i];
              const id = costIds[i];
              if (!snap.exists) costMap.set(id, {wood: 0, stone: 0});
              else {
                const c = snap.data();
                costMap.set(id, {wood: c.wood_repair || 0,
                  stone: c.stone_repair || 0});
              }
            }

            const totals = {wood: 0, stone: 0};
            const repairedTools = [];

            for (const n of normalized) {
              const unit = costMap.get(n.costId) || {wood: 0, stone: 0};
              const costWood = unit.wood * n.inc;
              const costStone = unit.stone * n.inc;

              totals.wood += costWood;
              totals.stone += costStone;

              repairedTools.push({stakedNftDocId: n.idStr, inc: n.inc,
                cost: {wood: costWood, stone: costStone}});
            }

            const haveWood = userData.wood || 0;
            const haveStone = userData.stone || 0;
            if (haveWood < totals.wood || haveStone <
            totals.stone) throw new Error("Not enough resources for repair.");

            for (const n of normalized) {
              tx.update(n.ref, {durability: FieldValue.increment(n.inc)});
            }
            tx.update(userRef, {
              wood: FieldValue.increment(-totals.wood),
              stone: FieldValue.increment(-totals.stone),
            });

            return {repaired: normalized.length, totals, repairedTools};
          });

          // << Pattern A: return a result object, NOT res... >>
          const {repaired, totals} = outcome;
          const response = ok({success: true, repaired, totals});
          await lock.markCompleted({repaired});
          return response;
        }, {scope: "repair", idempotencyKey: requestId});

        return res.status(result.status).json(result.body);
      } catch (error) {
        if (error.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true,
            message: "Another action is in progress. Try again shortly."});
        }
        console.error("Error in repairTool function:", error);
        return res.status(500).send(error.message ||
         "An internal error occurred.");
      }
    }));

exports.stakePacks = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
      // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized: No token provided.");
        const decoded = await admin.auth().verifyIdToken(idToken).catch(() => null);
        if (!decoded) return res.status(401).send("Unauthorized: Invalid token.");

        // --- Inputs ---
        const body = req.body?.data || {};
        const userAddress = String(body.userAddress || "");
        const tokenIds = Array.isArray(body.tokenIds) ? body.tokenIds : [];
        const txHash = body.txHash || body.transactionHash || null;
        const lockSeconds = Number(body.lockSeconds ?? 0);
        const packKey = String(body.packKey || "").toLowerCase(); // <-- UI sends 'small'|'medium'|'big'

        // Resolve collection from packKey FIRST (fixes "use before set")
        const collectionAddress = PACKS_BY_KEY[packKey];

        // Validate after resolution
        if (!ethers.isAddress(userAddress)) return res.status(400).send("Bad userAddress.");
        if (decoded.uid.toLowerCase() !== userAddress.toLowerCase()) {
          return res.status(403).send("Permission denied: auth/user mismatch.");
        }
        if (!PACK_VAULT_ADDRESS) return res.status(500).send("PACK_VAULT_ADDRESS is not configured.");
        if (tokenIds.length !== 1) return res.status(400).send("Exactly one tokenId is required.");

        const userLower = userAddress.toLowerCase();
        const vaultLower = PACK_VAULT_ADDRESS.toLowerCase();
        const tokenId = Number(tokenIds[0]);

        let colLower = collectionAddress?.toLowerCase?.() || null;

        // --- Authoritative check: owner must be the vault (wait briefly)
        const read721 = new ethers.Contract(
            colLower,
            ["function ownerOf(uint256) view returns (address)"],
            provider,
        );
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const waitForOwnerToBeVault = async (id, timeoutMs = 120_000, everyMs = 1_000) => {
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            try {
              const owner = (await read721.ownerOf(id)).toLowerCase();
              if (owner === vaultLower) return true;
            } catch (e) {
              console.error("ERC165 check failed:", e?.message || e);
            }
            await sleep(everyMs);
          }
          return false;
        };

        // Optional: best-effort parse of the tx that did the transfer
        if (txHash) {
          const rc = await provider.waitForTransaction(txHash, 1).catch(() => null);
          if (rc && rc.status === 1) {
          // (We tolerate the absence of logs; ownerOf is the authoritative check)
          }
        }

        if (!txHash) return res.status(400).send("txHash required.");
        const rc = await provider.getTransactionReceipt(txHash).catch(() => null);
        if (txHash) {
          if (!rc || rc.status !== 1) return res.status(400).send("Stake tx not found or failed.");

          // Prefer deriving the collection from the Transfer log (authoritative)
          let derived = null;
          for (const log of (rc.logs || [])) {
            if ((log.topics?.[0] || "").toLowerCase() !== ERC721_TRANSFER_TOPIC.toLowerCase()) continue;
            let p; try {
              p = ERC721_XFER_IFACE.parseLog(log);
            } catch {
              continue;
            }
            const from = (p.args?.from || "").toLowerCase();
            const to = (p.args?.to || "").toLowerCase();
            const id = Number(p.args?.tokenId);
            if (from === userLower && to === vaultLower && id === tokenId) {
              const addr = (log.address || "").toLowerCase();
              if (ALLOWED_COLLECTORS.has(addr)) {
                derived = addr; break;
              }
            }
          }
          if (!derived) return res.status(400).send("No valid collector Transfer to vault found in tx.");
          colLower = derived;
        }

        // --- ERC721 sanity on the chosen collection
        if (!colLower || !ethers.isAddress(colLower)) {
          return res.status(400).send("Could not resolve a valid collector collection.");
        }
        const erc165 = new ethers.Contract(colLower, ["function supportsInterface(bytes4) view returns (bool)"], provider);
        const is721 = await erc165.supportsInterface("0x80ac58cd").catch(() => false);
        if (!is721) console.warn("ERC-165 probe failed for", colLower, "(continuing)");

        // rc = await provider.getTransactionReceipt(txHash)
        let derivedCollectionAddr = null;
        let moved = false;

        for (const lg of rc.logs || []) {
        // Quick prefilter by topic (optional):
          if (!lg.topics || lg.topics[0] !== ERC721_TRANSFER_TOPIC) continue;

          // Parse the Transfer
          let ev;
          try {
            ev = ERC721_XFER_IFACE.parseLog(lg);
          } catch {
            continue;
          }

          const from = (ev.args.from || "").toLowerCase();
          const to = (ev.args.to || "").toLowerCase();
          const id = Number(ev.args.tokenId || 0);

          // The NFT contract that emitted the event:
          const contractAddr = (lg.address || "").toLowerCase();

          // Require it to be one of your pack collections
          if (!ALLOWED_PACKS.has(contractAddr)) continue;

          if (from === userLower && to === vaultLower && id === tokenId) {
            derivedCollectionAddr = contractAddr; // <- authoritative source
            moved = true;
            break;
          }
        }

        if (!moved) return err(400, "No valid pack Transfer to vault found in tx.");
        if (!derivedCollectionAddr) return err(403, "Disallowed pack collection.");

        // (Optional but strong) double-check final owner:
        const read7211 = new ethers.Contract(derivedCollectionAddr, ERC721_MIN_ABI, provider);
        const ownerNow = (await read7211.ownerOf(tokenId)).toLowerCase();
        if (ownerNow !== vaultLower) return err(409, "Pack not in vault yet.");

        // Use derivedCollectionAddr for your Firestore write


        const inVault = await waitForOwnerToBeVault(tokenId, 60_000, 1_000);
        if (!inVault) {
          return res.status(409).json({success: false, message: "Pack not in vault yet."});
        }

        // --- Idempotency + write
        const requestId = stableRequestIdFrom({
          op: "stakePack:single",
          userAddress: userLower,
          collectionAddress: colLower,
          tokenId,
          txHash: txHash ? String(txHash) : null,
        });

        const result = await withUserMutex(userLower, requestId, async (lock) => {
          const docId = `${userLower}_${colLower}_${tokenId}`;
          const ref = db.collection("staked_packs").doc(docId);
          const unlockAt = lockSeconds > 0 ?
          admin.firestore.Timestamp.fromMillis(Date.now() + lockSeconds * 1000) :
          null;

          await ref.set({
            ownerUid: decoded.uid, // <-- add this so your UI filter never excludes it
            userAddress: userLower,
            collectionAddress: colLower,
            tokenId,
            stakedAt: admin.firestore.FieldValue.serverTimestamp(),
            canOpenAt: unlockAt,
            opened: 0,
            packKey, // nice to have for UI
          }, {merge: true});

          const response = ok({success: true, stakedPackDocId: docId, canOpenAt: unlockAt});
          await lock.markCompleted({staked: tokenIds.length}); // equals 1 here
          return response;
        }, {scope: "packs", idempotencyKey: requestId});

        return res.status(result.status).json(result.body);
      } catch (e) {
        if (e?.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("stakePacks error:", e);
        return res.status(500).send(e?.message || "Internal error.");
      }
    }));


exports.requestUnstakePacks = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") {
          return res.status(405).send(
              "Method Not Allowed");
        }

        // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) {
          return res.status(401).send(
              "Unauthorized: No token provided.");
        }
        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(idToken);
        } catch {
          return res.status(401).send("Unauthorized: Invalid token.");
        }

        if (!PACK_VAULT_ADDRESS) {
          return res.status(500).send(
              "PACK_VAULT_ADDRESS is not configured.");
        }
        if (!process.env.CONTRACT_OWNER_PRIVATE_KEY) {
          return res.status(500).send(
              "CONTRACT_OWNER_PRIVATE_KEY is not configured.");
        }

        // --- Inputs ---
        const body = req.body?.data || {};
        const stakedPackDocIds = canonIds(body.stakedPackDocIds);
        const nonce = String(body.nonce || "");
        const signature = String(body.signature || "");
        if (stakedPackDocIds.length === 0 || !nonce || !signature) {
          return err(400,
              "Missing stakedPackDocIds, nonce, or signature.");
        }

        // Signature: must match the UI message format exactly
        const message = `Unstake packs: ${JSON.stringify(
            {stakedPackDocIds, nonce})}`;
        let recovered;
        try {
          recovered = ethers.verifyMessage(message, signature);
        } catch {
          return res.status(401).send("Invalid signature.");
        }
        const userLower = recovered.toLowerCase();

        // Also require Firebase uid == wallet address
        if (decoded.uid.toLowerCase() !== userLower) {
          return res.status(403).send(
              "Permission denied: auth/user mismatch.");
        }

        // --- Load docs & validate ownership/state ---
        const dbx = admin.firestore();
        const refs = stakedPackDocIds.map((id) => dbx.collection(
            "staked_packs").doc(id));
        const snaps = await dbx.getAll(...refs);

        const items = [];
        for (let i = 0; i < snaps.length; i++) {
          const s = snaps[i];
          if (!s.exists) {
            return res.status(404).send(
                `staked_packs doc not found: ${stakedPackDocIds[i]}`);
          }
          const d = s.data() || {};
          if ((d.userAddress || "").toLowerCase() !== userLower) {
            return res.status(403).send(
                `Ownership mismatch for doc ${s.id}.`);
          }
          if (Number(d.opened || 0) === 1) {
            return res.status(403).send(
                `Pack already opened: ${d.tokenId} (${d.collectionAddress}).`);
          }
          if (!ethers.isAddress(d.collectionAddress) || !Number.isFinite(
              Number(d.tokenId))) {
            return err(400, `Bad data in staked doc ${s.id}.`);
          }
          items.push({docRef: s.ref,
            collection: d.collectionAddress.toLowerCase(),
            tokenId: Number(d.tokenId)});
        }

        // --- Simple fee check (0.01 RON per pack) ---
        const expectedFee = Number((items.length * FEE_PER_PACK_RON).toFixed(2));
        const userRef = dbx.collection("users").doc(userLower);
        const userSnap = await userRef.get();
        if (!userSnap.exists) return res.status(404).send("User not found.");
        const gasTankRon = Number((userSnap.data() || {}).gasTankRon || 0);
        if (gasTankRon < expectedFee) {
          return res.status(403).send(
              "Insufficient RON in gas tank to pay withdrawal fee.");
        }

        // --- Signer (your vault EOA) ---
        const signer = new ethers.Wallet(process.env.CONTRACT_OWNER_PRIVATE_KEY,
            provider);
        const vaultLower = PACK_VAULT_ADDRESS.toLowerCase();
        if (signer.address.toLowerCase() !== vaultLower) {
          return res.status(500).send(
              "Signer does not match PACK_VAULT_ADDRESS. The vault "+
          "must be an EOA holding the NFTs.");
        }

        // Verify tokens are in the vault now (best effort)
        for (const it of items) {
          try {
            const c = new ethers.Contract(it.collection, ERC721_MIN_ABI,
                provider);
            const owner = (await c.ownerOf(it.tokenId)).toLowerCase();
            if (owner !== vaultLower) {
              return res.status(409).send(
                  `Token ${it.tokenId} not in vault for ${it.collection}.`);
            }
          } catch {
            return res.status(409).send(
                `Could not read ownerOf(${it.tokenId}) for ${it.collection}.`);
          }
        }

        // --- On-chain: direct safeTransferFrom(vault → user) per token ---
        // Group by collection just to reuse contract objects
        const byCollection = items.reduce((m, it) => {
          (m[it.collection] ||= []).push(it.tokenId);
          return m;
        }, {});

        for (const [collectionAddr, tokenIds] of Object.entries(byCollection)) {
          const erc721 = new ethers.Contract(collectionAddr, ERC721_MIN_ABI,
              signer);
          for (const id of tokenIds) {
            const tx = await erc721["safeTransferFrom(address,address,uint256)"](
                vaultLower, userLower, id);
            const rc = await tx.wait(1);
            if (!rc || rc.status !== 1) {
              throw new Error(
                  `Unstake tx failed for token ${id} `+
            `(collection ${collectionAddr}).`);
            }

            // Wait until ownerOf reflects user (indexing lag safety)
            const ok = await waitOwnerIs(provider, collectionAddr,
                id, userLower, 60_000, 1_000);
            if (!ok) {
              throw new Error(
                  `ownerOf(${id}) did not become user after `+
            `tx for ${collectionAddr}.`);
            }
          }
        }

        // --- Firestore commit: deduct fee & delete docs (atomic) ---
        await dbx.runTransaction(async (tx) => {
          const freshUser = await tx.get(userRef);
          if (!freshUser.exists) throw new Error("User disappeared.");
          const currentGas = Number((freshUser.data() || {}).gasTankRon || 0);
          if (currentGas < expectedFee) {
            throw new Error(
                "Insufficient RON at commit time.");
          }

          tx.update(userRef, {gasTankRon: admin.firestore.FieldValue.increment(
              -expectedFee)});
          refs.forEach((r) => tx.delete(r));
        });

        return res.status(200).json({
          success: true,
          unstaked: items.map((i) => ({collectionAddress: i.collection,
            tokenId: i.tokenId})),
          feeCharged: expectedFee,
        });
      } catch (e) {
        console.error("requestUnstakePacks error:", e);
        return res.status(500).send(e?.message ||
         "Internal error.");
      }
    }));

const NONCE_DOC = db.collection("tx_nonces").doc((wallet.address || "").toLowerCase());

async function reserveNonce() {
  let assigned;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(NONCE_DOC);

    // what the chain *expects next* including pending txs
    let chainPending = null;
    try {
      chainPending = await provider.getTransactionCount(wallet.address, "pending");
    } catch (e) {
      // if provider hiccups, we’ll just rely on the doc value
      console.warn("reserveNonce: getTransactionCount failed:", e?.message || e);
    }

    // Firestore’s view
    let cur =
      snap.exists && typeof snap.data().next === "number" ?
        Number(snap.data().next) :
        null;

    // If we don’t have a stored value, seed from chain (or 0 as last resort)
    if (cur == null) cur = chainPending ?? 0;

    // ✅ Fast-forward if Firestore is behind the chain’s pending nonce
    if (chainPending != null && cur < chainPending) {
      cur = chainPending;
    }

    assigned = cur; // this is the nonce the caller will use
    tx.set(
        NONCE_DOC,
        {next: cur + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp()},
        {merge: true},
    );
  });
  return assigned;
}

async function sendTxWithReservedNonce(sendFn, attempt = 0) {
  const nonce = await reserveNonce();

  // Floors + bump policy (tweak by env without redeploying code)
  const MIN_TIP_GWEI = BigInt(process.env.MIN_TIP_GWEI || "2"); // EIP-1559 tip floor
  const MIN_GAS_GWEI = BigInt(process.env.MIN_GAS_PRICE_GWEI || "20"); // legacy floor
  const BUMP_PCT = BigInt(process.env.GAS_BUMP_PCT || "15"); // % bump on retry

  const fee = await provider.getFeeData();
  const latestBlock = await provider.getBlock("latest").catch(() => null);
  const base = latestBlock?.baseFeePerGas ?? 0n;

  const bump = (x) => (x * (100n + BUMP_PCT)) / 100n;

  const overrides = {nonce};

  if (fee.maxFeePerGas && fee.maxPriorityFeePerGas) {
    // EIP-1559
    let tip = fee.maxPriorityFeePerGas;
    const tipFloor = ethers.parseUnits(MIN_TIP_GWEI.toString(), "gwei");
    if (tip < tipFloor) tip = tipFloor;
    if (attempt) tip = bump(tip);

    // London rule: target maxFee >= 2*baseFee + tip
    let max = fee.maxFeePerGas;
    const london = base * 2n + tip;
    if (max < london) max = london;
    if (attempt) max = bump(max);

    overrides.maxPriorityFeePerGas = tip;
    overrides.maxFeePerGas = max;
  } else {
    // Legacy (gasPrice)
    let gp = fee.gasPrice ?? ethers.parseUnits(MIN_GAS_GWEI.toString(), "gwei");
    const floor = ethers.parseUnits(MIN_GAS_GWEI.toString(), "gwei");
    if (gp < floor) gp = floor;
    if (attempt) gp = bump(gp);
    overrides.gasPrice = gp;
  }

  try {
    const tx = await sendFn(overrides);
    const rc = await tx.wait(1); // 1 conf
    return {tx, rc};
  } catch (e) {
    const msg = String(e?.shortMessage || e?.message || e?.code || "");
    // Handle both cases:
    //  a) someone else used our nonce → reserve a new one
    //  b) node wants a higher fee for SAME nonce → bump and retry once
    if (/underpriced|replacement|fee too low|nonce too low/i.test(msg) && attempt < 1) {
      const pending = await provider.getTransactionCount(wallet.address, "pending");
      const latest = await provider.getTransactionCount(wallet.address, "latest");
      if (pending > nonce || latest > nonce) {
        // a) our nonce was consumed — retry fresh (new nonce)
        return await sendTxWithReservedNonce(sendFn, attempt + 1);
      }
      // b) same nonce exists somewhere → bump & retry
      return await sendTxWithReservedNonce(sendFn, attempt + 1);
    }
    throw e;
  }
}


exports.adminRemintForBurnedPack = onRequest(async (req, res) => {
  // verify admin auth…
  const {jobId} = req.body.data || {};
  const jobRef = db.collection("open_pack_jobs").doc(jobId);
  const j = (await jobRef.get()).data() || {};
  if (!j || !j.toolTypes || !j.rarities) return res.status(400).send("No loot profile stored.");

  const TOOLS_ADDR = process.env.CONTRACT_ADDRESS_TOOLS;
  const tools = new ethers.Contract(TOOLS_ADDR, TOOLS_MIXED_ABI, wallet);

  const {rc} = await sendTxWithReservedNonce((ov) =>
    tools.ownerMintBatchMixed(j.userAddress.toLowerCase(), j.toolTypes, j.rarities, ov),
  );

  await jobRef.set({status: "completed", mintTxHash: rc.hash, finalizedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
  res.json({ok: true, tx: rc.hash});
});

const SERVER_ID = process.env.FUNCTION_NAME || `srv-${Math.random().toString(36).slice(2)}`;

async function claimJobOrSkip(jobRef, leaseMs = 120000) {
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) throw Object.assign(new Error("No job"), {code: "SKIP"});
    const d = snap.data() || {};
    const leaseExpired = !d.leaseUntil || (d.leaseUntil.toMillis?.() ?? d.leaseUntil) < now;

    // Only start if we are pending, or processing but lease expired.
    if (!(d.status === "pending" || (d.status === "processing" && leaseExpired))) {
      throw Object.assign(new Error("Not ready"), {code: "SKIP"});
    }

    tx.update(jobRef, {
      status: "processing",
      processingBy: SERVER_ID,
      attempts: FieldValue.increment(1),
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      leaseUntil: new Date(now + leaseMs),
    });
  });
}

function makeRng(seedHex /* "0x..." */) {
  // turn hex into a 32-bit seed
  let h = 0;
  for (let i = 2; i < seedHex.length; i += 8) {
    h ^= Number.parseInt(seedHex.slice(i, i + 8), 16) >>> 0;
  }
  let t = h >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function rollLoot(rng, packKey, count) {
  const TYPES = ["Stone_Axe", "Stone_Pick", "Stone_Spear"];
  const RARITIES = ["Common", "Uncommon", "Rare", "Epic"];

  // keys must match your packKey: 'small' | 'medium' | 'big'
  const weightsByPack = {
    small: [0.60, 0.32, 0.07, 0.01], // <-- fixed 0.07
    medium: [0.50, 0.35, 0.10, 0.05],
    big: [0.35, 0.40, 0.15, 0.10],
  };

  const key = String(packKey || "small").toLowerCase();
  const wRaw = weightsByPack[key] || weightsByPack.small;

  // normalize defensively in case of future edits
  const sum = wRaw.reduce((a, b) => a + b, 0);
  const w = sum > 0 ? wRaw.map((x) => x / sum) : weightsByPack.small;

  const toolTypes = [];
  const rarities = [];

  for (let i = 0; i < count; i++) {
    const t = TYPES[Math.floor(rng() * TYPES.length)];
    const r = rng();

    let idx = 0; let acc = 0;
    for (; idx < w.length; idx++) {
      acc += w[idx];
      if (r <= acc) break;
    }
    // clamp just in case floating point leaves r > acc after loop
    rarities.push(RARITIES[Math.min(idx, RARITIES.length - 1)]);
    toolTypes.push(t);
  }

  return {toolTypes, rarities};
}

const ERC721_FOR_PACKS_ABI = [
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
  "function burn(uint256)",
  "function getApproved(uint256) view returns (address)",
  "function isApprovedForAll(address owner,address operator) view returns (bool)",
  "function safeTransferFrom(address from,address to,uint256 tokenId)",
];

const TOOLS_MIXED_ABI = [
  "function ownerMintBatchMixed(address to, string[] toolTypes, string[] rarities) returns (uint256[])",
  "function uri(uint256 id) view returns (string)",
  "event TokensMintedMixed(address indexed to, uint256[] tokenIds)",
  "event TokenMinted(address indexed to, uint256 indexed tokenId, string rarity)",
];

const COLLECTION_MINT_MARKERS = "open_pack_minted_markers";
const COLLECTION_NONCE_RES = "nonce_reservations";

function encodeMintCalldata(toolsIface, user, toolTypes, rarities) {
  return toolsIface.encodeFunctionData("ownerMintBatchMixed", [user, toolTypes, rarities]);
}
function keccakHex(hex) {
  return ethers.keccak256(hex);
}

// Reserve a specific account nonce in Firestore so we always reuse it on retries.
async function reserveNonceForJob(jobRef, jobId, wallet, provider) {
  const doc = await jobRef.get();
  const job = doc.data() || {};
  if (job.mintNonce != null) return Number(job.mintNonce);

  const acct = wallet.address.toLowerCase();
  // Start from the 'pending' nonce (includes mempool) to avoid collisions.
  const next = await provider.getTransactionCount(acct, "pending");

  for (let i = 0; i < 64; i++) {
    const tryNonce = next + i;
    const resId = `${acct}:${tryNonce}`;
    const resRef = db.collection(COLLECTION_NONCE_RES).doc(resId);
    try {
      // Create fails if already exists.
      await resRef.create({
        reservedBy: jobId,
        account: acct,
        nonce: tryNonce,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await jobRef.update({mintNonce: tryNonce});
      return tryNonce;
    } catch (e) {
      // Already reserved; check if it's ours, else try next.
      const exist = await resRef.get().catch(() => null);
      if (exist?.exists && exist.data()?.reservedBy === jobId) {
        await jobRef.update({mintNonce: tryNonce});
        return tryNonce;
      }
      continue;
    }
  }
  throw new Error("Unable to reserve nonce");
}
const DEAD = "0x000000000000000000000000000000000000dEaD";

exports.openPack = functions.https.onRequest(
    withKillSwitchHttp(async (req, res) => {
      try {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        // --- Auth ---
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized");
        const decoded = await admin.auth().verifyIdToken(idToken);

        // --- Inputs ---
        const {stakedPackDocId, nonce, signature} = req.body?.data || {};
        if (!stakedPackDocId || !nonce || !signature) {
          return res.status(400).send("Missing stakedPackDocId/nonce/signature.");
        }

        // --- Load staked pack ---
        const packRef = admin.firestore().collection("staked_packs").doc(String(stakedPackDocId));
        const packSnap = await packRef.get();
        if (!packSnap.exists) return res.status(404).send("Pack not found.");
        const pack = packSnap.data() || {};

        const userAddress = normalizeAddr(pack.userAddress);
        const collectionAddress = normalizeAddr(pack.collectionAddress);
        const packTypeHint = kindFromAddress(collectionAddress); // 'small' | 'medium' | 'big'

        // Optional: if you store ownerUid on the doc, check it. Otherwise rely on signature below.
        if (pack.ownerUid && decoded.uid !== pack.ownerUid) {
          return res.status(403).send("Auth mismatch.");
        }

        if (pack.opened === 1) {
          return res.status(200).json({success: true, alreadyOpened: true});
        }
        const toMillis = (v) =>
          v?.toMillis?.() ??
          (typeof v === "number" ? v :
          typeof v === "string" ? Date.parse(v) || 0 : 0);

        if (toMillis(pack.canOpenAt) > Date.now()) {
          return res.status(403).send("Pack is still locked.");
        }

        // --- Verify the exact signed message (must match client JSON) ---
        const tokenIdStr = String(pack.tokenId); // keep as string
        if (!ethers.isAddress(userAddress) || !ethers.isAddress(collectionAddress) || !isUintString(tokenIdStr)) {
          return res.status(400).send("Corrupt staked pack record.");
        }
        const msg = `Open pack: ${JSON.stringify({
          stakedPackDocId: String(stakedPackDocId),
          tokenId: tokenIdStr, // string, no precision loss
          nonce: String(nonce),
        })}`;


        let recovered;
        try {
          recovered = ethers.verifyMessage(msg, String(signature)).toLowerCase();
        } catch {
          return res.status(401).send("Invalid signature.");
        }
        if (recovered !== userAddress) return res.status(401).send("Signature/user mismatch.");

        // --- One-time nonce ---
        await consumeNonceOrFail(userAddress, "openPack", String(nonce));

        // --- Create/reset job to 'pending' (idempotent) ---
        const requestId = stableRequestIdFrom({op: "openPack", stakedPackDocId});
        const jobRef = admin.firestore().collection("open_pack_jobs").doc(requestId);

        console.log("OPENPACK enqueue start", {requestId, userAddress, collectionAddress, tokenIdStr});

        await admin.firestore().runTransaction(async (tx) => {
          const s = await tx.get(jobRef);
          const base = {
            ownerUid: decoded.uid,
            userAddress,
            collectionAddress,
            tokenId: tokenIdStr, // store as string in Firestore
            stakedPackDocId: String(stakedPackDocId),
            rngSeed: requestId,
            packTypeHint,
          };
          if (s.exists) {
          // reset to pending and keep original createdAt
            tx.update(jobRef, {
              ...base,
              status: "pending",
              lastError: admin.firestore.FieldValue.delete(),
              attempts: admin.firestore.FieldValue.increment(1),
              lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          } else {
            tx.set(jobRef, {
              ...base,
              status: "pending",
              attempts: 0,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        });

        console.log("OPENPACK enqueue done", {requestId});

        // Return 202 with the job id; your UI will listen to open_pack_jobs/{requestId}
        return res.status(202).json({success: true, status: "pending", requestId});
      } catch (e) {
        if (e?.code === "LOCK_BUSY") {
          res.set("Retry-After", "2");
          return res.status(423).json({busy: true, message: "Another action is in progress. Try again shortly."});
        }
        console.error("openPack enqueue error:", e);
        return res.status(500).send(e?.message || "Internal error.");
      }
    }),
);


const PACK_COUNTS = {small: 1, medium: 2, big: 3};

// Optional: collection-address mapping (fast path)
// Put this in an env var in prod to avoid redeploys:
// PACK_KIND_BY_COLLECTION='{"0xabc...":"small","0xdef...":"medium","0xghi...":"big"}'

const naddr = (a) => String(a||"").replace(/^ronin:/i, "0x").toLowerCase();
const PACK_KIND_BY_COLLECTION = {
  [naddr(process.env.PACK_ADDR_SMALL)]: "small",
  [naddr(process.env.PACK_ADDR_MEDIUM)]: "medium",
  [naddr(process.env.PACK_ADDR_BIG)]: "big",
};
const kindFromAddress = (addr) => PACK_KIND_BY_COLLECTION[naddr(addr)] || "small";

async function finalizeOpenPackJobV2(jobRef, jobData) {
  try {
    await claimJobOrSkip(jobRef);
  } catch (e) {
    if (e.code === "SKIP") return; // someone else is working it
    throw e;
  }
  const job = jobData || {};
  if (!job.status || !["pending", "processing"].includes(job.status)) return;
  if (!job.stakedPackDocId || !job.userAddress || !job.collectionAddress || job.tokenId == null) {
    await jobRef.update({status: "failed", lastError: "Bad job payload"});
    return;
  }

  const PACK_VAULT = normalizeAddr(process.env.PACK_VAULT_ADDRESS);
  const TOOLS_ADDR = process.env.CONTRACT_ADDRESS_TOOLS;
  if (!TOOLS_ADDR || !PACK_VAULT) {
    await jobRef.update({status: "failed", lastError: "Contracts not configured"});
    return;
  }

  const userLower = String(job.userAddress).toLowerCase();
  const packRef = db.collection("staked_packs").doc(String(job.stakedPackDocId));

  try {
    // If already applied, short-circuit
    const appliedRef = db.collection("apply_markers").doc(`open_pack:${job.stakedPackDocId}`);
    const mintedMarkerRef = db.collection(COLLECTION_MINT_MARKERS).doc(String(job.stakedPackDocId));

    const [appliedSnap, mintedSnap] = await Promise.all([appliedRef.get(), mintedMarkerRef.get()]);

    if (appliedSnap.exists) {
      await jobRef.update({status: "completed", finalizedAt: admin.firestore.FieldValue.serverTimestamp()});
      return;
    }

    // If we minted in a previous attempt, reuse that info and SKIP minting step entirely.
    let mintTxHash = job.mintTxHash || null;
    let mintedIds = Array.isArray(job.mintedIds) ? job.mintedIds.map(Number) : null;

    if (mintedSnap.exists) {
      const md = mintedSnap.data() || {};
      mintTxHash = mintTxHash || md.mintTxHash || null;
      if (!mintedIds && Array.isArray(md.mintedIds)) mintedIds = md.mintedIds.map(Number);
    }

    // Re-read staked pack
    const packSnap = await packRef.get();
    if (!packSnap.exists) throw new Error("staked pack doc missing");
    const pack = packSnap.data() || {};
    if (String(pack.userAddress || "").toLowerCase() !== userLower) {
      throw new Error("pack owner mismatch");
    }

    // Contracts
    const packErc721 = new ethers.Contract(job.collectionAddress, ERC721_FOR_PACKS_ABI, wallet);
    const tools = new ethers.Contract(TOOLS_ADDR, TOOLS_MIXED_ABI, wallet);

    // Owner must be the vault
    const tid = ethers.toBigInt(job.tokenId);
    const ownerNow = (await packErc721.ownerOf(tid)).toLowerCase();
    if (ownerNow !== PACK_VAULT) throw new Error("Pack not in vault");

    let toolTypes = job.toolTypes || null;
    let rarities = job.rarities || null;

    if (!toolTypes || !rarities) {
      const key = (job.packTypeHint || kindFromAddress(job.collectionAddress)); // never unknown now
      const count = PACK_COUNTS[key] ?? 1;

      const rng = makeRng(String(job.rngSeed || jobRef.id));
      const rolled = rollLoot(rng, key, count);
      toolTypes = rolled.toolTypes;
      rarities = rolled.rarities;

      // guard lengths
      const n = count;
      if (toolTypes.length !== n) toolTypes = Array.from({length: n}, (_, i)=>rolled.toolTypes[i]??rolled.toolTypes[0]);
      if (rarities.length !== n) rarities = Array.from({length: n}, (_, i)=>rolled.rarities[i] ??rolled.rarities[0]);

      await jobRef.update({
        packProfile: {key, count: n},
        packTypeDetected: key,
        toolTypes,
        rarities,
      });
    }

    if (!Array.isArray(toolTypes) || !toolTypes.length || !Array.isArray(rarities) || toolTypes.length !== rarities.length) {
      throw new Error("Invalid rolled loot arrays");
    }

    if (!mintTxHash && !mintedIds) {
      const toolsIface = new ethers.Interface(TOOLS_MIXED_ABI);

      // a) Simulate to catch obvious reverts early
      try {
        await tools.ownerMintBatchMixed.staticCall(userLower, toolTypes, rarities);
      } catch (e) {
        throw new Error(`Mint simulation failed: ${e.shortMessage || e.message}`);
      }

      // b) Build calldata & reserve a nonce, then PERSIST INTENT BEFORE SENDING
      const calldata = encodeMintCalldata(toolsIface, userLower, toolTypes, rarities);
      const calldataHash = keccakHex(calldata);
      const mintNonce = await reserveNonceForJob(jobRef, jobRef.id, wallet, provider);

      const est = await tools.ownerMintBatchMixed
          .estimateGas(userLower, toolTypes, rarities)
          .catch(() => 200000n);
      const gasLimit = est + (est / 10n); // +10%

      // --- fee selection + persistence (EIP-1559 or legacy) ---
      const fee = await provider.getFeeData();
      let ov; // overrides used for the send
      const updatePayload = {
        stage: "mint_intent",
        mintCalldata: calldata,
        mintCalldataHash: calldataHash,
        mintNonce,
        mintGasLimit: gasLimit.toString(),
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (fee.maxFeePerGas && fee.maxPriorityFeePerGas) {
        const maxFeePerGas = fee.maxFeePerGas;
        const maxPriorityFeePerGas = fee.maxPriorityFeePerGas;
        ov = {nonce: mintNonce, gasLimit, maxFeePerGas, maxPriorityFeePerGas};
        updatePayload.mintMaxFeePerGas = maxFeePerGas.toString();
        updatePayload.mintMaxPriorityFeePerGas = maxPriorityFeePerGas.toString();
      } else {
        // Legacy path
        const gasPrice = fee.gasPrice ?? ethers.parseUnits("3", "gwei");
        ov = {nonce: mintNonce, gasLimit, gasPrice};
        updatePayload.mintGasPrice = gasPrice.toString();
      }

      await jobRef.update(updatePayload);

      // c) Send using the EXACT persisted nonce & fees so retries cannot produce a new tx
      let sentTx; let rc;
      try {
        sentTx = await tools.ownerMintBatchMixed(userLower, toolTypes, rarities, ov);
        rc = await sentTx.wait();
      } catch (e) {
        const msg = String(e?.shortMessage || e?.message || e);
        if (msg.toLowerCase().includes("nonce") && msg.toLowerCase().includes("low")) {
          // Same nonce likely mined earlier; proceed to burn/finalize.
        } else {
          throw new Error(`Mint send failed: ${msg}`);
        }
      }

      mintTxHash = rc?.hash || sentTx?.hash || null;

      // d) Parse minted tokenIds (same logic as your code)
      try {
        const out = [];
        const uniqPush = (n) => {
          const v = Number(n); if (Number.isFinite(v)) out.push(v);
        };

        const ifaceCustom = new ethers.Interface(TOOLS_MIXED_ABI);
        const iface1155 = new ethers.Interface([
          "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
          "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)",
        ]);
        const iface721 = new ethers.Interface([
          "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
        ]);
        const ZERO = ethers.ZeroAddress;

        for (const lg of (rc?.logs || [])) {
          try {
            const p = ifaceCustom.parseLog(lg);
            if (p?.name === "TokensMintedMixed") {
              (p.args?.tokenIds || []).forEach(uniqPush); continue;
            }
            if (p?.name === "TokenMinted") {
              uniqPush(p.args?.tokenId); continue;
            }
          } catch (e) {
            console.log(e);
          }
          try {
            const p = iface1155.parseLog(lg);
            if (p?.name === "TransferSingle" && String(p.args?.from).toLowerCase() === ZERO) {
              uniqPush(p.args?.id); continue;
            }
            if (p?.name === "TransferBatch" && String(p.args?.from).toLowerCase() === ZERO) {
              (p.args?.ids || []).forEach(uniqPush); continue;
            }
          } catch (e) {
            console.log(e);
          }
          try {
            const p = iface721.parseLog(lg);
            if (p?.name === "Transfer" && String(p.args?.from).toLowerCase() === ZERO) {
              uniqPush(p.args?.tokenId); continue;
            }
          } catch (e) {
            console.log(e);
          }
        }

        if (out.length) {
          mintedIds = Array.from(new Set(out.map(Number))).sort((a, b) => a - b);
        }
      } catch (e) {
        console.log(e);
      }

      // e) Persist tx hash & ids, and write the MINTED MARKER so future retries SKIP minting
      await jobRef.update({mintTxHash, mintedIds: mintedIds || null, stage: "mint_mined"});
      await db.collection(COLLECTION_MINT_MARKERS)
          .doc(String(job.stakedPackDocId))
          .set({
            ownerUid: job.ownerUid || null,
            userAddress: userLower,
            mintTxHash,
            mintedIds: mintedIds || null,
            toolTypes, rarities,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
    }

    // 3) If we still don’t know the ids, leave them null (optional).
    //    It won’t affect idempotency — they’re minted on-chain already.

    // 4) Burn/consume the pack (idempotent)
    const approvedOp = await packErc721.isApprovedForAll(PACK_VAULT, wallet.address);
    const singleApproved = (await packErc721.getApproved(tid)).toLowerCase() === wallet.address.toLowerCase();
    if (!approvedOp && !singleApproved && wallet.address.toLowerCase() !== PACK_VAULT) {
      throw new Error("Server wallet is not approved operator for vault; cannot burn/transfer pack");
    }

    if (!job.burnTxHash) {
      let burnTxHash = null;

      await jobRef.update({
        status: "processing",
        stage: "burn_sending",
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      try {
        if (packErc721.burn) {
          const {tx, rc} = await sendTxWithReservedNonce((ov) => packErc721.burn(tid, ov));
          burnTxHash = rc?.hash || tx?.hash;
        } else {
          const {tx, rc} = await sendTxWithReservedNonce((ov) =>
            packErc721["safeTransferFrom(address,address,uint256)"](PACK_VAULT, DEAD, tid, ov),
          );
          burnTxHash = rc?.hash || tx?.hash;
        }
        await jobRef.update({burnTxHash});
      } catch (e) {
        // leave job as failed; sweeper will retry with a fresh nonce/fees
        throw new Error(`Burn/consume failed: ${e?.shortMessage || e?.message || e}`);
      }
    }

    // 5) Atomically apply DB effects (delete staked pack + apply marker)
    await db.runTransaction(async (tx) => {
      const packFresh = await tx.get(packRef);
      if (!packFresh.exists) return; // already deleted
      const d = packFresh.data() || {};
      if ((d.userAddress || "").toLowerCase() !== userLower) throw new Error("Ownership changed");

      tx.delete(packRef);
      tx.set(
          db.collection("apply_markers").doc(`open_pack:${job.stakedPackDocId}`),
          {
            ownerUid: job.ownerUid || null, // safe carry-through
            userAddress: userLower,
            collectionAddress: job.collectionAddress,
            tokenId: Number(job.tokenId),
            mintTxHash: job.mintTxHash || mintTxHash || null,
            mintedIds: mintedIds || null,
            burnTxHash: job.burnTxHash || null,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
      );
    });

    await jobRef.update({
      status: "completed",
      finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
      // keep mintTxHash/mintedIds/burnTxHash as audit
    });
    try {
      await finalizeUserMutex({
        uid: (job.userAddress || job.uid || "").toLowerCase(),
        scope: "openpack",
        idempotencyKey: jobRef.id,
        meta: {status: "finalized", jobStatus: "ok"},
      });
      return {ok: true};
    } catch (e) {
      console.warn("finalizeUserMutex(openpack) failed:", e?.message || e);
    }
  } catch (err) {
    await jobRef.update({
      status: "failed",
      lastError: err.message || String(err),
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}


// Trigger when an open-pack job is created
exports.reconcileOpenPackV2 = onDocumentWritten(
    {
      document: "open_pack_jobs/{jobId}",
      region: "us-central1",
      timeoutSeconds: 540,
      memory: "512MiB",
    },
    async (event) => {
      const afterSnap = event.data?.after;
      if (!afterSnap?.exists) return;

      const before = event.data.before?.data() || {};
      const after = afterSnap.data() || {};
      const beforeStatus = before.status || "none";
      const afterStatus = after.status || "none";

      // run when a job *enters* pending
      if (afterStatus !== "pending" || beforeStatus === "pending") return;

      try {
        await finalizeOpenPackJobV2(afterSnap.ref, after);
      } catch (e) {
        console.error("reconcileOpenPackV2 error:", e);
        await afterSnap.ref.update({status: "failed", lastError: e?.message || String(e)});
      }
    },
);

// Sweeper (stuck/pending)
exports.sweepOpenPackJobsV2 = onSchedule(
    {
      region: "us-central1",
      schedule: "every 1 minutes",
      timeZone: "UTC",
      timeoutSeconds: 240,
      memory: "512MiB",
    },
    async () => {
      const batch = await db.collection("open_pack_jobs")
          .where("status", "in", ["pending", "processing"])
          .orderBy("createdAt", "asc")
          .limit(20)
          .get();

      for (const doc of batch.docs) {
        const job = doc.data() || {};
        if (job.status === "processing") {
          const last = job.lastAttemptAt?.toMillis?.() ?? 0;
          if (Date.now() - last > 6 * 60 * 1000) {
            await doc.ref.update({status: "pending", lastError: "watchdog reset"});
          }
        }
        try {
          await finalizeOpenPackJobV2(doc.ref, doc.data());
        } catch (e) {
          console.error("sweepOpenPackJobsV2 item error:", doc.id, e);
        }
      }
    },
);

// Optional manual poke
exports.pokeOpenPackJob = onRequest(
    {region: "us-central1", timeoutSeconds: 300, memory: "512MiB"},
    withKillSwitchHttp(async (req, res) => {
      try {
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).send("Unauthorized.");
        await admin.auth().verifyIdToken(idToken);

        const {requestId} = req.body?.data || {};
        if (!requestId) return err(400, "Missing requestId.");

        const jobRef = db.collection("open_pack_jobs").doc(requestId);
        const snap = await jobRef.get();
        if (!snap.exists) return res.status(404).send("Job not found.");

        const job = snap.data() || {};
        const decoded = await admin.auth().verifyIdToken(idToken);
        if (job.ownerUid && job.ownerUid !== decoded.uid) {
          return res.status(403).send("Not your job.");
        }
        if (job.status === "completed") {
          return res.status(200).json({success: true, status: "completed"});
        }

        await finalizeOpenPackJobV2(jobRef, job);
        const done = await jobRef.get();
        return res.status(200).json({success: true, status: done.data()?.status || "unknown"});
      } catch (err) {
        console.error("pokeOpenPackJob error:", err);
        return res.status(500).send(err.message || "Internal error.");
      }
    }),
);

async function runPackMetaJob(jobSnap) {
  const job = jobSnap.data() || {};
  const {userAddress, collectionAddress, tokenId} = job;
  if (!userAddress || !collectionAddress || tokenId == null) return;

  const c721 = new ethers.Contract(collectionAddress, ERC721_METADATA_ABI, provider);
  const rawUri = await c721.tokenURI(Number(tokenId));

  const toHex64 = (id) => Number(id).toString(16).padStart(64, "0");
  const applyId = (tpl, id) => String(tpl || "").includes("{id}") ?
    String(tpl).replace("{id}", toHex64(id)) :
    String(tpl);

  const metaUri = applyId(rawUri, tokenId);

  // fetch with your gateway helper (reuse from your code)
  let meta = {};
  try {
    meta = await fetchJsonWithGateways(metaUri);
  } catch (e) {
    console.log(e);
  }

  const docId = `${String(userAddress).toLowerCase()}_${String(collectionAddress).toLowerCase()}_${Number(tokenId)}`;
  await db.collection("staked_packs").doc(docId).set({
    packType: meta?.type || meta?.name || null,
    rarity: meta?.rarity || null,
    image: meta?.image || null,
    metaUri,
    pending_meta: false,
    lastMetaFetchAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  await jobSnap.ref.delete();
}

exports.backfillPackMetadata = onDocumentCreated(
    {document: "staked_pack_meta_jobs/{jobId}", region: "us-central1", timeoutSeconds: 540, memory: "512MiB"},
    withKillSwitchBg(async (event) => {
      if (event.data) await runPackMetaJob(event.data);
    }),
);

exports.sweepPackMetaJobs = onSchedule(
    {region: "us-central1", schedule: "every 2 minutes", timeZone: "UTC", timeoutSeconds: 240, memory: "512MiB"},
    withKillSwitchBg(async () => {
      const qs = await db.collection("staked_pack_meta_jobs").orderBy("createdAt", "asc").limit(20).get();
      for (const doc of qs.docs) {
        try {
          await runPackMetaJob(doc);
        } catch (e) {
          console.log(e);
        }
      }
    }),
);
