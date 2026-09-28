### nf-mutate 2026-09-27T22:38:14.218Z (max 60 mutants/file, seed 7)

| target | file | run | killed | survived | score |
|---|---|---:|---:|---:|---:|
| wallet-proof | `aof_backend/src/security/walletProofCore.ts` | 20 | 15 | 5 | 75.0% |
| authority-gate | `aof_backend/src/security/authorityGate.ts` | 39 | 37 | 2 | 94.9% |
| purchase-bounds | `aof_backend/src/security/purchaseBounds.ts` | 29 | 18 | 11 | 62.1% |
| reward-receipt | `aof_backend/src/lib/rewardReceipt.ts` | 26 | 21 | 5 | 80.8% |
| resource-registry | `aof_backend/src/lib/resourceRegistryCore.ts` | 31 | 30 | 1 | 96.8% |
| fraud-hold | `aof_backend/src/security/fraudHold.ts` | 46 | 37 | 9 | 80.4% |
| chain-indexer | `aof_backend/src/lib/chainIndexerCore.ts` | 60 | 46 | 14 | 76.7% |
| vrf-settlement | `aof_backend/src/lib/vrfSettlement.ts` | 60 | 23 | 37 | 38.3% |
| admin-auth | `aof_backend/src/middleware/adminAuth.ts` | — | — | — | skip |
| fraud-signals | `aof_backend/src/lib/fraudSignals.ts` | — | — | — | skip |
| watchtower-normalizer | `watchtower/src/event-normalizer.ts` | 60 | 40 | 20 | 66.7% |
| core-economics | `aof-core/src/economics.rs` | — | — | — | skip |
| core-state-guards | `aof-core/src/state.rs` | — | — | — | skip |

**wallet-proof survivors**

- L9 `int+1`: `export function canonicalJson(value: unknown, depth = 0): string {` → `export function canonicalJson(value: unknown, depth = 1): string {`
- L10 `gt→gte`: `if (depth > 32) throw new Error("Wallet payload nesting exceeds limit");` → `if (depth >= 32) throw new Error("Wallet payload nesting exceeds limit");`
- L10 `if→if(false)`: `if (depth > 32) throw new Error("Wallet payload nesting exceeds limit");` → `if (false) throw new Error("Wallet payload nesting exceeds limit");`
- L10 `int+1`: `if (depth > 32) throw new Error("Wallet payload nesting exceeds limit");` → `if (depth > 33) throw new Error("Wallet payload nesting exceeds limit");`
- L26 `and→or`: `const source = body && typeof body === "object"` → `const source = body || typeof body === "object"`

**authority-gate survivors**

- L48 `if→if(false)`: `if (rawMode !== "hot" && rawMode !== "read-only") {` → `if (false) {`
- L101 `if→if(true)`: `if (isProduction) {` → `if (true) {`

**purchase-bounds survivors**

- L2 `int+1`: `export function parsePurchaseBounds(body: any, now = Math.floor(Date.now() / 1000)) {` → `export function parsePurchaseBounds(body: any, now = Math.floor(Date.now() / 1001)) {`
- L5 `int+1`: `if (typeof maximum !== "string" || !/^[1-9][0-9]{0,19}$/.test(maximum) || BigInt(maximum) > 0xffffffffffffffffn) {` → `if (typeof maximum !== "string" || !/^[1-10][0-9]{0,19}$/.test(maximum) || BigInt(maximum) > 0xffffffffffffffffn) {`
- L5 `int+1`: `if (typeof maximum !== "string" || !/^[1-9][0-9]{0,19}$/.test(maximum) || BigInt(maximum) > 0xffffffffffffffffn) {` → `if (typeof maximum !== "string" || !/^[1-9][0-9]{1,19}$/.test(maximum) || BigInt(maximum) > 0xffffffffffffffffn) {`
- L5 `int+1`: `if (typeof maximum !== "string" || !/^[1-9][0-9]{0,19}$/.test(maximum) || BigInt(maximum) > 0xffffffffffffffffn) {` → `if (typeof maximum !== "string" || !/^[1-9][0-9]{0,20}$/.test(maximum) || BigInt(maximum) > 0xffffffffffffffffn) {`
- L8 `or→and`: `if (typeof deadline !== "string" || !/^[1-9][0-9]{0,15}$/.test(deadline) ||` → `if (typeof deadline !== "string" && !/^[1-9][0-9]{0,15}$/.test(deadline) ||`
- L8 `or→and`: `if (typeof deadline !== "string" || !/^[1-9][0-9]{0,15}$/.test(deadline) ||` → `if (typeof deadline !== "string" || !/^[1-9][0-9]{0,15}$/.test(deadline) &&`
- L8 `int+1`: `if (typeof deadline !== "string" || !/^[1-9][0-9]{0,15}$/.test(deadline) ||` → `if (typeof deadline !== "string" || !/^[1-10][0-9]{0,15}$/.test(deadline) ||`
- L8 `int+1`: `if (typeof deadline !== "string" || !/^[1-9][0-9]{0,15}$/.test(deadline) ||` → `if (typeof deadline !== "string" || !/^[1-9][0-9]{1,15}$/.test(deadline) ||`
- L8 `int+1`: `if (typeof deadline !== "string" || !/^[1-9][0-9]{0,15}$/.test(deadline) ||` → `if (typeof deadline !== "string" || !/^[1-9][0-9]{0,16}$/.test(deadline) ||`
- L9 `gt→gte`: `!Number.isSafeInteger(Number(deadline)) || Number(deadline) <= now || Number(deadline) - now > 300) {` → `!Number.isSafeInteger(Number(deadline)) || Number(deadline) <= now || Number(deadline) - now >= 300) {`
- L9 `minus→plus`: `!Number.isSafeInteger(Number(deadline)) || Number(deadline) <= now || Number(deadline) - now > 300) {` → `!Number.isSafeInteger(Number(deadline)) || Number(deadline) <= now || Number(deadline) + now > 300) {`

**reward-receipt survivors**

- L10 `gt→gte`: `if (typeof id !== "string" || !id || id.length > 128) throw new Error("Invalid inbox ID");` → `if (typeof id !== "string" || !id || id.length >= 128) throw new Error("Invalid inbox ID");`
- L10 `or→and`: `if (typeof id !== "string" || !id || id.length > 128) throw new Error("Invalid inbox ID");` → `if (typeof id !== "string" && !id || id.length > 128) throw new Error("Invalid inbox ID");`
- L10 `or→and`: `if (typeof id !== "string" || !id || id.length > 128) throw new Error("Invalid inbox ID");` → `if (typeof id !== "string" || !id && id.length > 128) throw new Error("Invalid inbox ID");`
- L10 `if→if(false)`: `if (typeof id !== "string" || !id || id.length > 128) throw new Error("Invalid inbox ID");` → `if (false) throw new Error("Invalid inbox ID");`
- L10 `int+1`: `if (typeof id !== "string" || !id || id.length > 128) throw new Error("Invalid inbox ID");` → `if (typeof id !== "string" || !id || id.length > 129) throw new Error("Invalid inbox ID");`

**resource-registry survivors**

- L115 `or→and`: `if (!configKey || !materialKey || !configKey.equals(materialKey)) {` → `if (!configKey && !materialKey || !configKey.equals(materialKey)) {`

**fraud-hold survivors**

- L20 `lt→lte`: `if (!Number.isInteger(value) || value < 1 || value > 3) throw new Error("FRAUD_HOLD_MIN_SEVERITY must be 1, 2, 3 or off");` → `if (!Number.isInteger(value) || value <= 1 || value > 3) throw new Error("FRAUD_HOLD_MIN_SEVERITY must be 1, 2, 3 or off");`
- L20 `or→and`: `if (!Number.isInteger(value) || value < 1 || value > 3) throw new Error("FRAUD_HOLD_MIN_SEVERITY must be 1, 2, 3 or off");` → `if (!Number.isInteger(value) && value < 1 || value > 3) throw new Error("FRAUD_HOLD_MIN_SEVERITY must be 1, 2, 3 or off");`
- L20 `int+1`: `if (!Number.isInteger(value) || value < 1 || value > 3) throw new Error("FRAUD_HOLD_MIN_SEVERITY must be 1, 2, 3 or off");` → `if (!Number.isInteger(value) || value < 2 || value > 3) throw new Error("FRAUD_HOLD_MIN_SEVERITY must be 1, 2, 3 or off");`
- L20 `int+1`: `if (!Number.isInteger(value) || value < 1 || value > 3) throw new Error("FRAUD_HOLD_MIN_SEVERITY must be 1, 2, 3 or off");` → `if (!Number.isInteger(value) || value < 1 || value > 4) throw new Error("FRAUD_HOLD_MIN_SEVERITY must be 1, 2, 3 or off");`
- L52 `if→if(false)`: `if (!Number.isFinite(minSeverity)) return;` → `if (false) return;`
- L53 `gt→gte`: `const targets = wallets.filter((w): w is string => typeof w === "string" && w.length > 0);` → `const targets = wallets.filter((w): w is string => typeof w === "string" && w.length >= 0);`
- L53 `and→or`: `const targets = wallets.filter((w): w is string => typeof w === "string" && w.length > 0);` → `const targets = wallets.filter((w): w is string => typeof w === "string" || w.length > 0);`
- L53 `int+1`: `const targets = wallets.filter((w): w is string => typeof w === "string" && w.length > 0);` → `const targets = wallets.filter((w): w is string => typeof w === "string" && w.length > 1);`
- L54 `if→if(false)`: `if (!targets.length) return;` → `if (false) return;`

**chain-indexer survivors**

- L41 `if→if(false)`: `if (value === null || value === undefined) return null;` → `if (false) return null;`
- L45 `or→and`: `if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value).toString("hex");` → `if (Buffer.isBuffer(value) && value instanceof Uint8Array) return Buffer.from(value).toString("hex");`
- L49 `if→if(false)`: `if (typeof v.toBase58 === "function") return v.toBase58();` → `if (false) return v.toBase58();`
- L66 `gt→gte`: `if (typeof v === "string" && v.length > 0) return v;` → `if (typeof v === "string" && v.length >= 0) return v;`
- L66 `int+1`: `if (typeof v === "string" && v.length > 0) return v;` → `if (typeof v === "string" && v.length > 1) return v;`
- L74 `and→or`: `if (typeof v === "string" && /^-?\d+$/.test(v)) return v;` → `if (typeof v === "string" || /^-?\d+$/.test(v)) return v;`
- L75 `if→if(false)`: `if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));` → `if (false) return String(Math.trunc(v));`
- L75 `and→or`: `if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));` → `if (typeof v === "number" || Number.isFinite(v)) return String(Math.trunc(v));`
- L75 `eq→neq`: `if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));` → `if (typeof v !== "number" && Number.isFinite(v)) return String(Math.trunc(v));`
- L95 `int+1`: `if (!logs || logs.length === 0) return [];` → `if (!logs || logs.length === 1) return [];`
- L104 `int+1`: `let i = 0;` → `let i = 1;`
- L109 `plus→minus`: `eventIndex: base + i,` → `eventIndex: base - i,`
- L120 `int+1`: `base += 1000; // per-program index namespace; a single tx never emits 1000 events` → `base += 1001; // per-program index namespace; a single tx never emits 1000 events`
- L143 `if→if(false)`: `if (delta === 0n) continue;` → `if (false) continue;`

**vrf-settlement survivors**

- L48 `true→false`: `const ata = (mint: PublicKey, owner: PublicKey) => getAssociatedTokenAddressSync(mint, owner, true);` → `const ata = (mint: PublicKey, owner: PublicKey) => getAssociatedTokenAddressSync(mint, owner, false);`
- L51 `int+1`: `return (program.account as any).config.fetch(configPda()[0]);` → `return (program.account as any).config.fetch(configPda()[1]);`
- L55 `int+1`: `return (program.account as any).materialMints.fetch(materialMintsPda()[0]);` → `return (program.account as any).materialMints.fetch(materialMintsPda()[1]);`
- L82 `eq→neq`: `if (mechanic === "pack") push(mechanic, await acc.packCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));` → `if (mechanic !== "pack") push(mechanic, await acc.packCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));`
- L83 `if→if(false)`: `if (mechanic === "reroll") push(mechanic, await acc.rerollCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));` → `if (false) push(mechanic, await acc.rerollCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));`
- L83 `eq→neq`: `if (mechanic === "reroll") push(mechanic, await acc.rerollCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));` → `if (mechanic !== "reroll") push(mechanic, await acc.rerollCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));`
- L84 `if→if(true)`: `if (mechanic === "exploration") push(mechanic, await acc.explorationCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));` → `if (true) push(mechanic, await acc.explorationCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));`
- L85 `if→if(true)`: `if (mechanic === "forge") push(mechanic, await acc.forgeCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));` → `if (true) push(mechanic, await acc.forgeCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));`
- L86 `if→if(false)`: `if (mechanic === "lottery") {` → `if (false) {`
- L90 `if→if(true)`: `if (mechanic === "drum") {` → `if (true) {`
- L90 `eq→neq`: `if (mechanic === "drum") {` → `if (mechanic !== "drum") {`
- L103 `not→id`: `if (!account) return null;` → `if (account) return null;`
- L103 `if→if(false)`: `if (!account) return null;` → `if (false) return null;`
- L104 `if→if(false)`: `if (mechanic === "lottery" && (!account.drawCommitted || account.drawn)) return null;` → `if (false) return null;`
- L104 `and→or`: `if (mechanic === "lottery" && (!account.drawCommitted || account.drawn)) return null;` → `if (mechanic === "lottery" || (!account.drawCommitted || account.drawn)) return null;`
- L104 `if→if(true)`: `if (mechanic === "lottery" && (!account.drawCommitted || account.drawn)) return null;` → `if (true) return null;`
- L108 `eq→neq`: `user: mechanic === "lottery" ? null : account.user,` → `user: mechanic !== "lottery" ? null : account.user,`
- L111 `eq→neq`: `commitSlot: Number(mechanic === "lottery" ? account.drawCommitSlot : account.commitSlot),` → `commitSlot: Number(mechanic !== "lottery" ? account.drawCommitSlot : account.commitSlot),`
- L213 `int+1`: `newMint, newToken: ata(newMint, a.user), newToolData: toolPda(newMint)[0], auth: authPda()[0], ...withAta,` → `newMint, newToken: ata(newMint, a.user), newToolData: toolPda(newMint)[0], auth: authPda()[1], ...withAta,`
- L221 `int+1`: `config, materialMints: materialMintsPda()[0], explorationCommit: c.address, user: a.user, vrfSlot,` → `config, materialMints: materialMintsPda()[1], explorationCommit: c.address, user: a.user, vrfSlot,`
- L222 `int+1`: `auth: authPda()[0],` → `auth: authPda()[1],`
- L232 `int+1`: `config, materialMints: materialMintsPda()[0], forgeCommit: c.address, user: a.user, vrfSlot,` → `config, materialMints: materialMintsPda()[1], forgeCommit: c.address, user: a.user, vrfSlot,`
- L278 `if→if(false)`: `if (mechanic === "pack") return packMintPda(commit)[0];` → `if (false) return packMintPda(commit)[0];`
- L304 `int+1`: `(error as { status?: number }).status = 409;` → `(error as { status?: number }).status = 410;`
- L307 `not→id`: `if (commit.user && !commit.user.equals(player)) {` → `if (commit.user && commit.user.equals(player)) {`
- L307 `if→if(true)`: `if (commit.user && !commit.user.equals(player)) {` → `if (true) {`
- L307 `and→or`: `if (commit.user && !commit.user.equals(player)) {` → `if (commit.user || !commit.user.equals(player)) {`
- L313 `eq→neq`: `const ixs = phase === "revealable"` → `const ixs = phase !== "revealable"`
- L326 `if→if(true)`: `if (typeof v === "number") return RARITY_NAMES[v] || String(v);` → `if (true) return RARITY_NAMES[v] || String(v);`
- L326 `eq→neq`: `if (typeof v === "number") return RARITY_NAMES[v] || String(v);` → `if (typeof v !== "number") return RARITY_NAMES[v] || String(v);`
- L327 `and→or`: `return RARITY_NAMES.find((name) => v && typeof v === "object" && name in v) || "unknown";` → `return RARITY_NAMES.find((name) => v || typeof v === "object" && name in v) || "unknown";`
- L327 `or→and`: `return RARITY_NAMES.find((name) => v && typeof v === "object" && name in v) || "unknown";` → `return RARITY_NAMES.find((name) => v && typeof v === "object" && name in v) && "unknown";`
- L333 `if→if(true)`: `if (pending) {` → `if (true) {`
- L333 `if→if(false)`: `if (pending) {` → `if (false) {`
- L344 `if→if(false)`: `if (!mint) return { state: "unknown" };` → `if (false) return { state: "unknown" };`
- L345 `int+1`: `const tool: any = await (program.account as any).toolData.fetchNullable(toolPda(mint)[0]);` → `const tool: any = await (program.account as any).toolData.fetchNullable(toolPda(mint)[1]);`
- L346 `if→if(true)`: `if (!tool) return { state: "refunded" };` → `if (true) return { state: "refunded" };`

**watchtower-normalizer survivors**

- L128 `eq→neq`: `const str = (v: unknown): string | null => (typeof v === "string" && v.length ? v : typeof v === "number" || typeof v === "bigint" ? String(v) : null);` → `const str = (v: unknown): string | null => (typeof v === "string" && v.length ? v : typeof v !== "number" || typeof v === "bigint" ? String(v) : null);`
- L128 `and→or`: `const str = (v: unknown): string | null => (typeof v === "string" && v.length ? v : typeof v === "number" || typeof v === "bigint" ? String(v) : null);` → `const str = (v: unknown): string | null => (typeof v === "string" || v.length ? v : typeof v === "number" || typeof v === "bigint" ? String(v) : null);`
- L129 `int+1`: `const bool = (v: unknown) => v === true || v === "true" || v === 1;` → `const bool = (v: unknown) => v === true || v === "true" || v === 2;`
- L129 `or→and`: `const bool = (v: unknown) => v === true || v === "true" || v === 1;` → `const bool = (v: unknown) => v === true || v === "true" && v === 1;`
- L136 `and→or`: `const pid = (w: unknown) => (typeof w === "string" && w ? hashPlayer(w, salt) : null);` → `const pid = (w: unknown) => (typeof w === "string" || w ? hashPlayer(w, salt) : null);`
- L141 `if→if(false)`: `if (!category) throw new Error(`unknown Watchtower event type ${type}`);` → `if (false) throw new Error(`unknown Watchtower event type ${type}`);`
- L164 `eq→neq`: `emit("PurchaseCompleted", { playerId: buyer, counterpartyId: seller, amount: price, currency: LAMPORTS, attributes: { venue: row.eventType === "ListingSold" ? "listing" : "offer" } });` → `emit("PurchaseCompleted", { playerId: buyer, counterpartyId: seller, amount: price, currency: LAMPORTS, attributes: { venue: row.eventType !== "ListingSold" ? "listing" : "offer" } });`
- L319 `if→if(true)`: `if (bool(d.success)) emit("RewardGranted", { currency: "RESOURCE", attributes: { source: "exploration", woodReward: str(d.woodReward), stoneReward: str(d.stoneReward) } });` → `if (true) emit("RewardGranted", { currency: "RESOURCE", attributes: { source: "exploration", woodReward: str(d.woodReward), stoneReward: str(d.stoneReward) } });`
- L376 `eq→neq`: `emit("TreasuryDeposited", { playerId: null, amount: str(d.amountLamports), currency: LAMPORTS, attributes: { source: "gas_fees", destination: opts.treasury ? (str(d.to) === opts.treasury ? "treasury" : "other") : "unknown" } });` → `emit("TreasuryDeposited", { playerId: null, amount: str(d.amountLamports), currency: LAMPORTS, attributes: { source: "gas_fees", destination: opts.treasury ? (str(d.to) !== opts.treasury ? "treasury" : "other") : "unknown" } });`
- L447 `if→if(false)`: `if (bool(d.paused)) {` → `if (false) {`
- L447 `if→if(true)`: `if (bool(d.paused)) {` → `if (true) {`
- L448 `true→false`: `emit("PausedToggled", { playerId: null, attributes: { paused: true, authority: "guardian_or_admin" } });` → `emit("PausedToggled", { playerId: null, attributes: { paused: false, authority: "guardian_or_admin" } });`
- L451 `if→if(false)`: `if (bool(d.cashout_frozen)) emit("ConfigUpdated", { playerId: null, attributes: { setting: "cashout_frozen", frozen: true } });` → `if (false) emit("ConfigUpdated", { playerId: null, attributes: { setting: "cashout_frozen", frozen: true } });`
- L496 `and→or`: `const wallets = new Set(Object.entries(data).filter(([k, v]) => WALLET_KEYS.has(k) && typeof v === "string").map(([, v]) => v as string));` → `const wallets = new Set(Object.entries(data).filter(([k, v]) => WALLET_KEYS.has(k) || typeof v === "string").map(([, v]) => v as string));`
- L496 `eq→neq`: `const wallets = new Set(Object.entries(data).filter(([k, v]) => WALLET_KEYS.has(k) && typeof v === "string").map(([, v]) => v as string));` → `const wallets = new Set(Object.entries(data).filter(([k, v]) => WALLET_KEYS.has(k) && typeof v !== "string").map(([, v]) => v as string));`
- L497 `int+1`: `if (wallets.size === 0) return attrs;` → `if (wallets.size === 1) return attrs;`
- L497 `if→if(false)`: `if (wallets.size === 0) return attrs;` → `if (false) return attrs;`
- L497 `if→if(true)`: `if (wallets.size === 0) return attrs;` → `if (true) return attrs;`
- L498 `eq→neq`: `const walk = (v: unknown): unknown => typeof v === "string" ? (wallets.has(v) ? "<redacted-wallet>" : v) : Array.isArray(v) ? v.map(walk) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)])) : v;` → `const walk = (v: unknown): unknown => typeof v === "string" ? (wallets.has(v) ? "<redacted-wallet>" : v) : Array.isArray(v) ? v.map(walk) : v && typeof v !== "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)])) : v;`
- L508 `int+1`: `source: { program: programs[0] ?? "", event: "ChainTx", eventIndex: -1 },` → `source: { program: programs[0] ?? "", event: "ChainTx", eventIndex: -2 },`


## Follow-up (same day, after new tests)

| target | before | after | what was added |
|---|---:|---:|---|
| `aof_backend/src/lib/vrfSettlement.ts` | 38.3 % | **99.2 %** (127/128, all mutants run) | `scripts/vrfSettlementSelfTest.ts`: discovery per mechanic, lottery filter, reveal + refund account wiring checked against the committed IDL for all six mechanics, player self-settlement (409/403/phase), status |
| `aof_backend/src/security/walletProofCore.ts` | 75.0 % | **100 %** | nesting-depth guard, non-object bodies |
| `aof_backend/src/security/purchaseBounds.ts` | 62.1 % | 75.9 % | deadline window with a realistic clock (remaining survivors are regex-internal) |
| `frontend/src/lib/txGuard.ts` | 48.9 % | 76.7 % (90 of 337 sampled) | `tests/txGuard.test.ts`: fee/spend/rent ceilings at the boundary, compute-budget layouts, prep-mint and ATA policies field by field, block lists, CPI programs from simulation logs, allowlist always enforced, fee payer / lookup tables. Remaining survivors are in `estimateTokenOutflows`, which is unreachable because the instruction policy already rejects every SPL transfer |
| `frontend/src/lib/coreInstructions.ts` (generated) | 2.2 % | n/a | table is now compared row by row with the IDL in `security.test.ts` (discriminator, accounts, signer/actor slots, authority-only invariant); `claim_season_reward` and `init_lottery_round` were missing from the authority-only set, `winner`/`referred` from the actor set — fixed in the generator |
| `aof_backend/src/lib/readCache.ts` (new) | — | tested by `scripts/readCacheSelfTest.ts` | single-flight + TTL cache in front of `/query/*` |
