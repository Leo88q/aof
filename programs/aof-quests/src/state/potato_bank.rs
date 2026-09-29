use anchor_lang::prelude::*;
use crate::errors::QuestError;

/// A separate ATA owned by this PDA holds only V2 Potato-spin inventory.
/// Old QuestConfig payouts and historical drum refunds have NO signing path
/// into this vault. The PDA is created PAUSED; there is no paid V2 commit yet.
pub const POTATO_BANK_SEED: &[u8] = b"potato_bank";
pub const POTATO_DECIMALS: u8 = 9;
pub const POTATO_UNIT: u64 = 1_000_000_000;
pub const POTATO_SPIN_PRICE: u64 = 5 * POTATO_UNIT;
pub const POTATO_MAX_PRIZE: u64 = 50 * POTATO_UNIT;

/// Distinct discriminator and PDA from legacy DrumCommit: old indexers and
/// settlement workers cannot accidentally decode/pay a whole-token V2 spin.
#[account]
pub struct PotatoCommit {
    pub user: Pubkey,
    pub bump: u8,
    pub randomness: Pubkey,
    pub seed_slot: u64,
    pub commit_slot: u64,
    pub created_at: i64,
    pub cost: u64,
}

impl PotatoCommit {
    pub const SIZE: usize = 8 + 32 + 1 + 32 + 8 + 8 + 8 + 8;
}

#[account]
pub struct PotatoBank {
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub reserved_atoms: u64,
    pub open_spins: u32,
    pub paused: bool,
    pub bump: u8,
}

impl PotatoBank {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 4 + 1 + 1;

    /// Must be called with the freshly deserialized vault balance immediately
    /// before a V2 commit. The handler must take this bank account mutably,
    /// transfer the price and lock the VRF slot in the SAME transaction.
    fn consistent(&self) -> bool {
        u64::from(self.open_spins).checked_mul(POTATO_MAX_PRIZE) == Some(self.reserved_atoms)
    }

    pub fn reserve(&mut self, vault_balance: u64) -> core::result::Result<(), QuestError> {
        if self.paused { return Err(QuestError::PotatoBankPaused); }
        if !self.consistent() { return Err(QuestError::PotatoBankInsolvent); }
        let available = vault_balance.checked_sub(self.reserved_atoms).ok_or(QuestError::PotatoBankInsolvent)?;
        if available < POTATO_MAX_PRIZE { return Err(QuestError::PotatoBankInsolvent); }
        self.reserved_atoms = self.reserved_atoms.checked_add(POTATO_MAX_PRIZE).ok_or(QuestError::MathOverflow)?;
        self.open_spins = self.open_spins.checked_add(1).ok_or(QuestError::MathOverflow)?;
        Ok(())
    }

    /// Check the payout without consuming other open spins' reserved assets.
    /// Reveal/refund must transfer the prize/cost and release in one atomic ix.
    pub fn can_settle(&self, vault_balance: u64, payout: u64) -> bool {
        if !self.consistent() || self.open_spins == 0 || payout > POTATO_MAX_PRIZE { return false; }
        vault_balance.checked_sub(payout).map(|remaining|
            remaining >= self.reserved_atoms - POTATO_MAX_PRIZE).unwrap_or(false)
    }

    pub fn release(&mut self, vault_balance: u64, payout: u64) -> core::result::Result<(), QuestError> {
        if !self.can_settle(vault_balance, payout) { return Err(QuestError::PotatoBankInsolvent); }
        self.reserved_atoms -= POTATO_MAX_PRIZE;
        self.open_spins -= 1;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn bank() -> PotatoBank {
        PotatoBank { mint: Pubkey::new_unique(), vault: Pubkey::new_unique(), reserved_atoms: 0, open_spins: 0, paused: false, bump: 1 }
    }
    #[test]
    fn reserve_every_open_spin_and_refuse_oversubscription() {
        let mut b = bank();
        assert!(b.reserve(100 * POTATO_UNIT).is_ok());
        assert!(b.reserve(100 * POTATO_UNIT).is_ok());
        assert!(matches!(b.reserve(100 * POTATO_UNIT), Err(QuestError::PotatoBankInsolvent)));
        assert_eq!(b.open_spins, 2);
        assert_eq!(b.reserved_atoms, 100 * POTATO_UNIT);
        assert!(matches!(b.release(100 * POTATO_UNIT, 51 * POTATO_UNIT), Err(QuestError::PotatoBankInsolvent)));
        assert!(matches!(b.release(99 * POTATO_UNIT, POTATO_MAX_PRIZE), Err(QuestError::PotatoBankInsolvent)));
        assert!(b.release(100 * POTATO_UNIT, POTATO_SPIN_PRICE).is_ok());
        assert_eq!(b.reserved_atoms, POTATO_MAX_PRIZE);
        assert_eq!(b.open_spins, 1);
        // Only this spin remains: its known refund is 5, not the maximum
        // 50. A vault with 40 can cover that refund, but a vault with 4 cannot.
        assert!(b.can_settle(40 * POTATO_UNIT, POTATO_SPIN_PRICE));
        assert!(matches!(b.release(4 * POTATO_UNIT, POTATO_SPIN_PRICE), Err(QuestError::PotatoBankInsolvent)));
        assert!(b.release(95 * POTATO_UNIT, POTATO_MAX_PRIZE).is_ok());
        assert_eq!(b.open_spins, 0);
        assert_eq!(b.reserved_atoms, 0);
    }
    #[test]
    fn v2_whole_unit_table_matches_reservation_and_price() {
        use crate::instructions::drum::drum_reveal::DRUM_PRIZES;
        assert_eq!(POTATO_SPIN_PRICE, 5_000_000_000);
        assert_eq!(POTATO_MAX_PRIZE, 50_000_000_000);
        assert_eq!(DRUM_PRIZES.iter().map(|(weight, _)| u32::from(*weight)).sum::<u32>(), 10_000);
        assert_eq!(DRUM_PRIZES.iter().map(|(_, amount)| *amount * POTATO_UNIT).max(), Some(POTATO_MAX_PRIZE));
        assert_eq!(DRUM_PRIZES.iter().map(|(weight, amount)| u128::from(*weight) * u128::from(*amount)).sum::<u128>(), 47_500);
    }

    #[test]
    fn paused_or_corrupt_bank_never_accepts_a_spin() {
        let mut b = bank();
        b.paused = true;
        assert!(matches!(b.reserve(100 * POTATO_UNIT), Err(QuestError::PotatoBankPaused)));
        b.paused = false;
        b.reserved_atoms = 100 * POTATO_UNIT;
        assert!(matches!(b.reserve(90 * POTATO_UNIT), Err(QuestError::PotatoBankInsolvent)));
        assert!(!b.can_settle(100 * POTATO_UNIT, POTATO_SPIN_PRICE));
        b.reserved_atoms = 0;
        b.open_spins = 1;
        assert!(matches!(b.release(100 * POTATO_UNIT, POTATO_SPIN_PRICE), Err(QuestError::PotatoBankInsolvent)));
    }
}
