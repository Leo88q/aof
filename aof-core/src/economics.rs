//! Shared integer accounting primitives used by the real instruction handlers.
//! They establish unit conservation, not a market-price equivalence between
//! different resources or fairness of a disabled randomness mechanism.
use anchor_lang::prelude::*;
use crate::errors::AofError;

/// Return (net, fee), with floor rounding and no overflow at u64::MAX.
/// Reject a rate above 100% rather than manufacturing a negative net amount.
pub fn split_bps(gross: u64, bps: u16) -> Result<(u64, u64)> {
    require!(bps <= 10_000, AofError::InvalidAmount);
    let fee = ((gross as u128) * (bps as u128) / 10_000) as u64;
    Ok((gross.checked_sub(fee).ok_or(AofError::MathOverflow)?, fee))
}

/// Craft's progressive price: base + minted_count * multiplier.
pub fn linear_cost(base: u64, multiplier: u64, minted: u64) -> Result<u64> {
    let cost = (base as u128) + (multiplier as u128) * (minted as u128);
    u64::try_from(cost).map_err(|_| AofError::MathOverflow.into())
}

/// Plan a FULL liability settlement, keeping the source's required reserve.
/// Both results are computed before the caller mutates either balance.
pub fn payout_balances(source: u64, destination: u64, amount: u64, reserve: u64) -> Result<(u64, u64)> {
    let remaining = source.checked_sub(amount).ok_or(AofError::VaultInsufficient)?;
    require!(remaining >= reserve, AofError::VaultInsufficient);
    let received = destination.checked_add(amount).ok_or(AofError::MathOverflow)?;
    Ok((remaining, received))
}

/// Direct debit is permitted ONLY from an account owned by this program.
/// This is not a general SPL/System transfer. Distinct writable accounts are
/// required; sequential calls safely handle shared payout recipients.
pub fn transfer_owned_lamports<'info>(
    from: &AccountInfo<'info>, to: &AccountInfo<'info>, amount: u64, reserve: u64,
) -> Result<()> {
    require_keys_eq!(*from.owner, crate::ID, AofError::Unauthorized);
    require!(from.is_writable && to.is_writable, AofError::Unauthorized);
    require_keys_neq!(from.key(), to.key(), AofError::InvalidAmount);
    // Acquire both borrows first: a failed second borrow must not debit from.
    let mut debit = from.try_borrow_mut_lamports()?;
    let mut credit = to.try_borrow_mut_lamports()?;
    let (remaining, received) = payout_balances(**debit, **credit, amount, reserve)?;
    **debit = remaining;
    **credit = received;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::{AUCTION_FEE_BPS, MARKETPLACE_FEE_BPS, LOTTERY_POOL_BPS};

    struct Rng(u64);
    impl Rng {
        fn next(&mut self) -> u64 {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            self.0
        }
        fn extreme(&mut self) -> u64 {
            match self.next() % 5 { 0 => 0, 1 => 1, 2 => u64::MAX, _ => self.next() }
        }
    }

    #[test]
    fn market_auction_lottery_splits_conserve_every_unit() {
        let mut rng = Rng(0xa0f_c07_2026);
        for _ in 0..20_000 {
            let gross = rng.extreme();
            for rate in [0, 1, MARKETPLACE_FEE_BPS, AUCTION_FEE_BPS, LOTTERY_POOL_BPS, 10_000] {
                let (net, fee) = split_bps(gross, rate).unwrap();
                assert_eq!(net as u128 + fee as u128, gross as u128);
                let numerator = gross as u128 * rate as u128;
                assert!(fee as u128 * 10_000 <= numerator);
                assert!(numerator < (fee as u128 + 1) * 10_000);
            }
        }
        for bad in [10_001, u16::MAX] { assert!(split_bps(u64::MAX, bad).is_err()); }
    }

    #[test]
    fn progressive_craft_cost_matches_exact_integer_model() {
        let mut rng = Rng(0xc4af7_2026);
        for _ in 0..20_000 {
            let (base, multiplier, minted) = (rng.extreme(), rng.extreme(), rng.extreme());
            let expected = base as u128 + multiplier as u128 * minted as u128;
            let got = linear_cost(base, multiplier, minted);
            if expected > u64::MAX as u128 { assert!(got.is_err()); }
            else {
                let cost = got.unwrap();
                assert_eq!(cost as u128, expected);
                assert!(cost >= base);
                if minted > 0 { assert!(linear_cost(base, multiplier, minted - 1).unwrap() <= cost); }
                let balance = rng.next().max(cost);
                assert_eq!((balance - cost) as u128 + cost as u128, balance as u128);
            }
        }
    }

    #[test]
    fn escrow_payouts_never_create_units_or_spend_rent() {
        let mut rng = Rng(0xe5c40_2026);
        for _ in 0..30_000 {
            let (source, dest, amount, reserve) = (rng.extreme(), rng.extreme(), rng.extreme(), rng.extreme());
            let possible = source as u128 >= amount as u128 + reserve as u128
                && dest as u128 + amount as u128 <= u64::MAX as u128;
            let result = payout_balances(source, dest, amount, reserve);
            assert_eq!(result.is_ok(), possible);
            if let Ok((after_source, after_dest)) = result {
                assert!(after_source >= reserve);
                assert_eq!(after_source as u128 + after_dest as u128, source as u128 + dest as u128);
                assert_eq!(after_dest as u128 - dest as u128, amount as u128);
            }
        }
    }

    #[test]
    fn account_transfer_is_atomic_even_on_host_errors_and_handles_shared_recipient() {
        let from_key = Pubkey::new_unique();
        let to_key = Pubkey::new_unique();
        let owner = crate::ID;
        let system = anchor_lang::system_program::ID;
        let mut from_balance = 110;
        let mut to_balance = 5;
        let mut data1 = []; let mut data2 = [];
        let from = AccountInfo::new(&from_key, false, true, &mut from_balance, &mut data1, &owner, false, 0);
        let to = AccountInfo::new(&to_key, false, true, &mut to_balance, &mut data2, &system, false, 0);
        assert!(transfer_owned_lamports(&from, &from, 1, 10).is_err());
        assert!(transfer_owned_lamports(&to, &from, 1, 0).is_err());
        assert!(transfer_owned_lamports(&from, &to, 101, 10).is_err());
        {
            let _held = to.try_borrow_lamports().unwrap();
            assert!(transfer_owned_lamports(&from, &to, 100, 10).is_err());
        }
        assert_eq!((from.lamports(), to.lamports()), (110, 5));
        // Seller can be the configured treasury: don't precompute two writes
        // against the same old balance and lose one of the credits.
        transfer_owned_lamports(&from, &to, 95, 10).unwrap();
        transfer_owned_lamports(&from, &to, 5, 10).unwrap();
        assert_eq!((from.lamports(), to.lamports()), (10, 105));
    }
}
