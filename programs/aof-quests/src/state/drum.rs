use anchor_lang::prelude::*;

/// [F-06] A paid spin waiting for its Switchboard reveal.
/// seeds = [b"drum_commit", user] (one pending spin per wallet).
#[account]
pub struct DrumCommit {
    pub user: Pubkey,
    pub bump: u8,
    /// Pool randomness account locked by this spin and its seed slot.
    pub randomness: Pubkey,
    pub seed_slot: u64,
    pub commit_slot: u64,
    pub created_at: i64,
    /// Mascots paid into the treasury at commit; returned on refund.
    pub cost: u64,
}

impl DrumCommit {
    pub const SIZE: usize = 8 + 32 + 1 + 32 + 8 + 8 + 8 + 8;
}

/// [F-06] One Switchboard randomness account of this program's pool
/// (same layout and rules as aof-core's VrfSlot; see vrf.rs).
/// seeds = [b"vrf_slot", randomness].
#[account]
pub struct VrfSlot {
    pub randomness: Pubkey,
    pub index: u32,
    pub lock: Pubkey,
    pub locked_at_slot: u64,
    pub retired: bool,
    pub commits: u64,
    pub reveals: u64,
    pub bump: u8,
}

impl VrfSlot {
    pub const SIZE: usize = 8 + 32 + 4 + 32 + 8 + 1 + 8 + 8 + 1;
}
