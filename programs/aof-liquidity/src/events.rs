use anchor_lang::prelude::*;

#[event]
pub struct LpConfigInitialized {
    pub authority: Pubkey,
    pub mascot_mint: Pubkey,
}

#[event]
pub struct LpDeposited {
    pub user: Pubkey,
    pub rarity: u8,
    pub amount: u64,
    pub shares_minted: u64,
}

#[event]
pub struct LpWithdrawn {
    pub user: Pubkey,
    pub rarity: u8,
    pub shares_burned: u64,
    pub amount_received: u64,
    pub fees_received: u64,
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

/// [SECURITY_CHECKLIST_REVIEW F-C] A cancelled authority rotation used to be
/// silent, so monitoring could not see a proposed takeover being withdrawn.
#[event]
pub struct AuthorityRotationCancelled {
    pub authority: Pubkey,
    pub cancelled: Pubkey,
    pub slot: u64,
}
