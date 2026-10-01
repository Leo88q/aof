<!-- HISTORICAL — pre-canonical devnet setup note; retained as an audit record, not a deployment instruction. -->
# Devnet Potato: mint creation and payment gates

**Status: NOT configured; no Potato payments are open.** Potato is a separate external SPL mint; the legacy `aof_core::Config.potato_mint` is the in-game **MIND** mint. Never reuse MIND or reassign historical quest/drum commitments to Potato. This procedure is devnet-only. Never share a seed phrase, keypair JSON or private key in chat or Git.

## 1. Create a separate devnet test mint (operator's secure machine)

Install compatible Solana and `spl-token` CLIs from official releases. Neither is available in this workspace. Use a **new devnet-only** fee-payer and mint authority; protect and back up secrets privately, outside this checkout:

```sh
mkdir -p "$HOME/.config/solana"
solana-keygen new --outfile "$HOME/.config/solana/potato-devnet-operator.json"
chmod 600 "$HOME/.config/solana/potato-devnet-operator.json"
solana config set --url https://api.devnet.solana.com --keypair "$HOME/.config/solana/potato-devnet-operator.json"
solana config get
solana airdrop 2
solana balance
spl-token create-token --decimals 9
```

Record only the **public mint address** as `POTATO_DEVNET_MINT`. Nine decimals is an implementation assumption, **not yet confirmed by the owner**: 5 whole Potato = `5_000_000_000` atoms. If the actual mint differs, redesign the scale and rebuild/test before using it; the current bank initialization rejects other decimals. Creating a mint does not establish a name, liquidity, market value or guaranteed redemption. Review mint/freeze authority and metadata separately.

```sh
export POTATO_DEVNET_MINT='<POTATO_DEVNET_MINT>'   # replace placeholder with public address only
spl-token display "$POTATO_DEVNET_MINT"
npm --prefix aof_backend run inspect:potato-devnet
```

The read-only inspector verifies devnet genesis, compares Potato to the MIND mint read from core Config, checks the SPL mint/decimals and the **dedicated PotatoBank PDA + its canonical ATA**. It requires the bank to be paused, checks bank mint/vault pointers, reserves equal `open_spins × 50 whole Potato`, and requires vault assets for existing reserves plus one possible jackpot. It signs nothing. Missing mint, bank or custody results in `BLOCKED`; this is expected before deployment. **A passing inspection is NOT a payment authorization or a program-bytecode proof.**

## 2. Separate vault, never reinterpret legacy QuestConfig

The QuestConfig mascot mint/treasury retain their **original** token and ownership. Existing quest rewards and old drum reveals/refunds continue to use the legacy QuestConfig PDA. Do not reconfigure that treasury or deposit Potato into it for V2. The new Potato vault is the canonical ATA of the `potato_bank` PDA under the quests program ID:

```sh
node - <<'JS'
const {PublicKey} = require('./aof_backend/node_modules/@solana/web3.js');
const {getAssociatedTokenAddressSync} = require('./aof_backend/node_modules/@solana/spl-token');
const idl = require('./aof_backend/src/idl/aof_quests.json');
const mint = new PublicKey(process.env.POTATO_DEVNET_MINT);
const bank = PublicKey.findProgramAddressSync([Buffer.from('potato_bank')], new PublicKey(idl.address))[0];
console.log('bank', bank.toBase58());
console.log('vault', getAssociatedTokenAddressSync(mint, bank, true).toBase58());
JS
```

After compiling/deploying **verified** quests program bytes, the QuestConfig authority can call `init_potato_bank` with the devnet Potato mint; it creates the vault and records the mint, starting **paused**. Verify its actual signer and on-chain ownership. Fund this new vault with a separate, deliberate SPL transfer, then read it back. **Do not unpause or offer sales yet.** The bank's on-chain initializer checks decimals but does not itself read core Config to exclude MIND: the devnet inspector and the operator's signed launch checklist must verify distinct mints; this remains a release gate, not a claim of on-chain enforcement.

## 3. V2 status and launch evidence

The approved spin proposal is 5 **whole** Potato, prizes 2/5/10/20/50, weights 60/25/10/4/1% (expected 4.75 per paid spin before costs). The historical `drum_commit` is **still fail-closed** and uses raw atomic units; never unguard it or point legacy QuestConfig at Potato. The separate `potato_spin_*` V2 code uses a **distinct PotatoCommit account discriminator and PDA**, reserves 50 whole tokens for each open spin in the bank, transfers the 5-token price in the same transaction as reservation and VRF locking, and atomically releases the reserve with each oracle payout or timeout refund. Its events are distinct from legacy drum events; the existing backend VRF worker only discovers legacy `DrumCommit` accounts and **does not yet discover or settle V2**. Its commit retains an unconditional **FeatureDisabled** guard pending review. Even if the operator unpauses PotatoBank, this guard prevents all paid V2 spins.

Before removing that guard: confirm mint decimals and distinctness from MIND on the target genesis; compile Rust and generate/compare Anchor IDL (the committed IDL was edited by hand), run unit/Anchor tests and concurrent-spin/refund/paused-after-commit/VRF-timeout signed devnet tests with actual token balances and events. Verify wallet transaction construction and backend quote/settler wiring against the new V2 IDL, deployed bytecode, upgrade authority, custody and journaled signatures. Conduct security review for the legacy payouts, oracle availability and rollback. Preserve an independent treasury inventory above **all** outstanding jackpots. The UI/backend currently block purchases and should remain blocked. VIP and season-pass charges have separate release gates. No mainnet transaction is authorized by devnet setup.
