use anchor_lang::prelude::*;
use crate::errors::LiquidityError;

#[account]
pub struct LpPool {
    pub rarity: u8,
    pub bump: u8,
    pub total_shares: u64,
    pub mascot_reserve: u64,
    pub accumulated_fees: u64,
}

impl LpPool {
    pub const SIZE: usize = 8 + 1 + 1 + 8 + 8 + 8;

    /// Multiply before division in u128. Dividing by a rounded share price
    /// systematically over-mints shares and dilutes existing depositors.
    pub fn shares_for_deposit(&self, amount: u64) -> Result<u64> {
        if self.total_shares == 0 {
            // Preserve the existing initial denomination (1 share / 1e9 units).
            return Ok(amount / 1_000_000_000);
        }
        let assets = (self.mascot_reserve as u128)
            .checked_add(self.accumulated_fees as u128)
            .ok_or(LiquidityError::MathOverflow)?;
        // SW024: checked_mul/checked_div keep the divisor guard explicit even if
        // the enclosing require! is ever refactored away.
        let shares = (amount as u128)
            .checked_mul(self.total_shares as u128)
            .ok_or(LiquidityError::MathOverflow)?
            .checked_div(assets)
            .ok_or(LiquidityError::ZeroAmount)?;
        u64::try_from(shares).map_err(|_| LiquidityError::MathOverflow.into())
    }
}

/// floor(value * shares / total), without rejecting valid u64 balances just
/// because the intermediate product exceeds u64.
pub fn pro_rata(value: u64, shares: u64, total: u64) -> Result<u64> {
    require!(total > 0 && shares <= total, LiquidityError::NotEnoughShares);
    // SW024: explicit checked_div in addition to the require! above.
    let out = (value as u128)
        .checked_mul(shares as u128)
        .ok_or(LiquidityError::MathOverflow)?
        .checked_div(total as u128)
        .ok_or(LiquidityError::NotEnoughShares)?;
    Ok(out as u64)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn pool(assets: u64, shares: u64) -> LpPool {
        LpPool { rarity: 1, bump: 0, total_shares: shares, mascot_reserve: assets, accumulated_fees: 0 }
    }
    #[test]
    fn deposit_does_not_round_price_down() {
        assert_eq!(pool(5, 2).shares_for_deposit(4).unwrap(), 1); // old formula minted 2
        assert_eq!(pool(0, 0).shares_for_deposit(2_000_000_000).unwrap(), 2);
        assert!(pool(0, 1).shares_for_deposit(1).is_err());
    }
    #[test]
    fn withdrawal_supports_full_u64_balances() {
        assert_eq!(pro_rata(u64::MAX, u64::MAX, u64::MAX).unwrap(), u64::MAX);
        assert!(pro_rata(10, 2, 1).is_err());
        assert!(pro_rata(10, 0, 0).is_err());
    }
    #[test]
    fn round_trip_cannot_extract_existing_reserve() {
        for reserve in 1..100u64 {
            for shares in 1..30u64 {
                for deposit in 1..30u64 {
                    let minted = pool(reserve, shares).shares_for_deposit(deposit).unwrap();
                    let out = pro_rata(reserve + deposit, minted, shares + minted).unwrap();
                    assert!(out <= deposit);
                }
            }
        }
    }
    #[test]
    fn full_range_share_and_solvency_properties() {
        // Fixed seed makes failures reproducible; include zero/MAX separately.
        let mut seed = 0x7a1f_c39d_825e_601bu64;
        let mut next = || { seed ^= seed << 13; seed ^= seed >> 7; seed ^= seed << 17; seed };
        for _ in 0..10_000 {
            let reserve = next();
            let fees = next();
            let total = next().max(1);
            let deposit = next();
            let p = LpPool { accumulated_fees: fees, ..pool(reserve, total) };
            let assets = reserve as u128 + fees as u128;
            if assets == 0 {
                assert!(p.shares_for_deposit(deposit).is_err());
                continue;
            }
            let expected = deposit as u128 * total as u128 / assets;
            match p.shares_for_deposit(deposit) {
                Ok(minted) => assert_eq!(minted as u128, expected),
                Err(_) => assert!(expected > u64::MAX as u128),
            }
            let shares = next() % total;
            let principal = pro_rata(reserve, shares, total).unwrap();
            let fee_share = pro_rata(fees, shares, total).unwrap();
            assert!(principal <= reserve && fee_share <= fees);
            assert!(principal as u128 + fee_share as u128 <= assets);
        }
        for v in [0, 1, u64::MAX] {
            assert!(pro_rata(v, 0, 0).is_err());
            assert_eq!(pro_rata(v, u64::MAX, u64::MAX).unwrap(), v);
            assert!(pool(0, 1).shares_for_deposit(v).is_err());
        }
        assert!(pool(1, u64::MAX).shares_for_deposit(u64::MAX).is_err());
    }

}
