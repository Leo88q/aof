use anchor_lang::prelude::*;

/// Pure helpers shared by the VRF settlements (see vrf.rs).
///
/// History: this module used to hold the legacy `sha256(secret || slot_hash)`
/// commit-reveal (authority-held secret + public SlotHashes). That scheme let
/// the secret holder withhold unfavourable reveals and was never a VRF; every
/// mechanic now settles through the program-owned Switchboard pool instead,
/// and the legacy helpers were removed so nothing can be wired to them again.

/// Weighted pick of an index 0..N from weights in basis points (the weights
/// must sum to 10_000; callers validate their tables). Returns the first
/// bucket the roll falls into.
pub fn weighted_pick(roll_bps: u64, weights_bps: &[u16]) -> usize {
    let mut acc: u64 = 0;
    let r = roll_bps % 10_000;
    for (i, w) in weights_bps.iter().enumerate() {
        acc += *w as u64;
        if r < acc {
            return i;
        }
    }
    weights_bps.len() - 1
}

/// SlotHashes sysvar address (Switchboard seeds randomness from it).
pub const SLOT_HASHES_ID: Pubkey = anchor_lang::solana_program::sysvar::slot_hashes::ID;

#[cfg(test)]
mod weighted_pick_tests {
    use super::*;

    #[test]
    fn buckets_follow_the_cumulative_weights() {
        let w = [6_000u16, 3_200, 700, 100, 0];
        assert_eq!(weighted_pick(0, &w), 0);
        assert_eq!(weighted_pick(5_999, &w), 0);
        assert_eq!(weighted_pick(6_000, &w), 1);
        assert_eq!(weighted_pick(9_199, &w), 1);
        assert_eq!(weighted_pick(9_200, &w), 2);
        assert_eq!(weighted_pick(9_899, &w), 2);
        assert_eq!(weighted_pick(9_900, &w), 3);
        assert_eq!(weighted_pick(9_999, &w), 3);
    }

    #[test]
    fn a_zero_weight_bucket_is_unreachable() {
        let w = [5_500u16, 3_000, 1_100, 400, 0];
        for r in 0..10_000u64 {
            assert_ne!(weighted_pick(r, &w), 4, "roll {r} reached the zero-weight Legendary bucket");
        }
    }
}
