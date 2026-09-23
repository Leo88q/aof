use anchor_lang::prelude::*;
use crate::state::Currency;

#[event]
pub struct HotMarketBought {
    pub buyer: Pubkey,
    pub rarity: u8,
    pub currency: Currency,
    pub price: u64,
    pub sold_since_start: u64,
}

#[event]
pub struct HotMarketSold {
    pub seller: Pubkey,
    pub rarity: u8,
    pub currency: Currency,
    pub price: u64,
}

#[event]
pub struct HotMarketEventStarted {
    pub rarity: u8,
    pub end_ts: i64,
    pub multiplier_bps: u16,
}

#[event]
pub struct HotMarketCranked {
    pub rarity: u8,
    pub new_price_core: u64,
    pub new_price_gem: u64,
}

#[event]
pub struct HotMarketSkipped {
    pub user: Pubkey,
    pub rarity: u8,
}

#[event]
pub struct LimitOrderPlaced {
    pub maker: Pubkey,
    pub rarity: u8,
    pub is_buy: bool,
    pub limit_price: u64,
}

#[event]
pub struct LimitOrderMatched {
    pub maker: Pubkey,
    pub rarity: u8,
    pub price: u64,
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

/// SW027: admin fee change is observable off-chain (Helika/GameSight/Game Signals).
#[event]
pub struct GlobalFeesUpdated {
    pub authority: Pubkey,
    pub fee_bps: u16,
}

/// SW027: pause toggle must be trackable by indexers and the Watchtower.
#[event]
pub struct GlobalPausedUpdated {
    pub authority: Pubkey,
    pub paused: bool,
}

/// SW027: cancelling a resting limit order returns escrow — emit for attribution.
#[event]
pub struct LimitOrderCancelled {
    pub maker: Pubkey,
    pub rarity: u8,
    pub refunded: u64,
}
