pub const TRUST_SNAPSHOT_SEED: &[u8] = b"trust_snapshot";

/// Hot-market treasury cut. Below 8% is rejected; above 10% is rejected.
/// The fee already moves to the treasury ATA. This band is the product rate.
pub const MARKET_TREASURY_FEE_MIN_BPS: u16 = 800;
pub const MARKET_TREASURY_FEE_MAX_BPS: u16 = 1_000;
