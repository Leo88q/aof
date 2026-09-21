use anchor_lang::prelude::*;

#[event]
pub struct RebirthConfigInitialized {
    pub authority: Pubkey,
    pub bonus_per_rebirth_bps: u16,
    pub max_bonus_bps: u16,
    pub max_rebirths: u8,
}

#[event]
pub struct RebirthPerformed {
    pub user: Pubkey,
    pub generation: u16,
    pub rebirth_count: u8,
    pub permanent_bonus_bps: u16,
}

/// [AUDIT F-02] Authority rotation, both steps.
#[event]
pub struct AuthorityRotationProposed {
    pub previous: Pubkey,
    pub next: Pubkey,
    pub at: i64,
}

#[event]
pub struct AuthorityChanged {
    pub previous: Pubkey,
    pub next: Pubkey,
    pub at: i64,
}
