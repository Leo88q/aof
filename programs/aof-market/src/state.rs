use anchor_lang::prelude::*;

pub const CONFIG_SEED: &[u8] = b"market_config";
pub const POOL_SEED: &[u8] = b"hot_pool";
pub const LIMIT_ORDER_SEED: &[u8] = b"hot_limit_order";
pub const CONFIG_SPACE: usize = 8 + 32 + 32 + 32 + 32 + 2 + 1 + 1;
pub const POOL_SPACE: usize = 8 + 1 + 8 + 8 + 8 + 2 + 2 + 8 + 8 + 8 + 8 + 8 + 2 + 2 + 1 + 1;
pub const LIMIT_ORDER_SPACE: usize = 8 + 32 + 1 + 1 + 1 + 8 + 8 + 1;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Currency {
    Core,
    Gem,
}

#[account]
#[derive(InitSpace)]
pub struct MarketConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub core_mint: Pubkey,
    pub gem_mint: Pubkey,
    pub fee_bps: u16,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct HotMarketPool {
    pub rarity: u8,
    pub target_price_core: u64,
    pub target_price_gem: u64,
    pub target_rate_per_hour: u64,
    pub decay_bps_per_hour: u16,
    pub growth_bps_per_sale: u16,
    pub sold_since_start: u64,
    pub purchases_in_window: u64,
    pub start_ts: i64,
    pub last_trade_ts: i64,
    pub hot_window_end_ts: i64,
    pub hot_multiplier_bps: u16,
    pub fee_bps: u16,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct HotLimitOrder {
    pub maker: Pubkey,
    pub rarity: u8,
    pub currency: Currency,
    pub is_buy: bool,
    pub limit_price: u64,
    pub amount_escrowed: u64,
    pub active: bool,
}
