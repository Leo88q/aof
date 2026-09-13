use anchor_lang::prelude::*;
use crate::state::PaymentCurrency;

#[event]
pub struct MarketConfigInitialized {
    pub mascot_mint: Pubkey,
    pub fee_bps: u16,
}

#[event]
pub struct PoolInitialized {
    pub rarity: u8,
    pub base_price_mascot: u64,
    pub base_price_sol_lamports: u64,
}

#[event]
pub struct HotMarketBuy {
    pub rarity: u8,
    pub buyer: Pubkey,
    pub tool: Pubkey,
    pub currency: PaymentCurrency,
    pub price: u64,
    pub fee: u64,
}

#[event]
pub struct HotMarketSellIntoQueue {
    pub rarity: u8,
    pub seller: Pubkey,
    pub tool: Pubkey,
    pub min_price: u64,
}

#[event]
pub struct HotMarketSkip {
    pub rarity: u8,
    pub skipped_tool: Pubkey,
    pub new_tool: Pubkey,
}

#[event]
pub struct HotWindowStarted {
    pub rarity: u8,
    pub end_ts: i64,
    pub multiplier_bps: u16,
}

#[event]
pub struct PriceCranked {
    pub rarity: u8,
    pub old_price_mascot: u64,
    pub new_price_mascot: u64,
    pub old_price_sol: u64,
    pub new_price_sol: u64,
}

#[event]
pub struct SessionCreated {
    pub authority: Pubkey,
    pub session_signer: Pubkey,
    pub valid_until: i64,
}

#[event]
pub struct SessionRevoked {
    pub authority: Pubkey,
    pub session_signer: Pubkey,
}
