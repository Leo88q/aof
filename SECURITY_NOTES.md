# AOF Security — Sentio Audit 2026-09-23

Before: 91 findings (4 critical 64 high 7 medium 16 low)
After: 1 high

Fixed:
- SW025 unwrap() 3x in drum_reveal.rs:74,80,113 -> map_err InvalidData/InvalidHash
- SW016 init_if_needed in challenge_contribute.rs:24 -> init
- Added QuestError::InvalidData, AlreadyInitialized

Remaining 1 high SW013 PDA seed unvalidated:
- Location: drum_reveal.rs:27 PDA drum_commit uses user as seed
- Reality: pub user: Signer<'info> — already validated as signer
- Sentio 0.3.2 false positive, does not recognize Signer with #[account(mut, signer)] + close = user
- Manual review: safe, has_one = user check present
- Baseline: sentio-baseline.json

cargo check: Finished dev profile
