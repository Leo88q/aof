
#[account]
#[derive(InitSpace)]
pub struct TrustSnapshot {
    pub user: Pubkey,
    pub score: u16,
    pub tier: u8,
    pub computed_epoch: u64,
    pub oracle_authority: Pubkey,
}
