// Byte sizes include Anchor's 8-byte account discriminator.
// Keep these pinned to aof-core/src/constants.rs and tests/readiness payer tests.
export const PLAYER_ACCOUNT_SIZE = 59;
export const TOOL_DATA_ACCOUNT_SIZE = 161;
export const REWARD_RECEIPT_ACCOUNT_SIZE = 121;
export const SEASON_PASS_ACCOUNT_SIZE = 57;
export const SEASON_PREMIUM_CLAIMS_ACCOUNT_SIZE = 53;
export const SEASON_XP_CLAIM_CURSOR_ACCOUNT_SIZE = 49;
export const TOKEN_ACCOUNT_SIZE = 165;
export const TOKEN_MINT_SIZE = 82;
// Metaplex rent upper bounds used by tool-mint payer quotes (external accounts,
// so unlike the constants above these do not include an Anchor discriminator).
export const METAPLEX_METADATA_MAX_ACCOUNT_SIZE = 679;
/** Metaplex Token Metadata charges the creator a 0.01 SOL fee for
 * `CreateMetadataAccountV3` and keeps it in the Metadata account. Mirrors
 * `aof_core::constants::TOOL_METADATA_CREATION_FEE_LAMPORTS`. */
export const METAPLEX_CREATION_FEE_LAMPORTS = 10_000_000;
