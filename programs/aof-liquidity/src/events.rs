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
