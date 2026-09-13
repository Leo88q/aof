use anchor_lang::prelude::*;

#[account]
pub struct LpPool {
    pub rarity: u8,
    pub bump: u8,
    /// Всего выпущено долей
    pub total_shares: u64,
    /// Резерв маскот-токена в пуле
    pub mascot_reserve: u64,
    /// Накопленные комиссии от хот-маркета
    pub accumulated_fees: u64,
}

impl LpPool {
    pub const SIZE: usize = 8 + 1 + 1 + 8 + 8 + 8;

    /// Стоимость одной доли в маскот-токене
    pub fn share_price(&self) -> u64 {
        if self.total_shares == 0 {
            return 1_000_000_000; // 1:1 при первом депозите
        }
        (self.mascot_reserve + self.accumulated_fees) / self.total_shares
    }
}
