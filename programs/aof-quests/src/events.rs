use anchor_lang::prelude::*;

#[event]
pub struct QuestConfigInitialized {
    pub authority: Pubkey,
    pub mascot_mint: Pubkey,
}

#[event]
pub struct QuestCreated {
    pub quest_id: u32,
    pub reward_mascot: u64,
}

#[event]
pub struct QuestRewardClaimed {
    pub user: Pubkey,
    pub quest_id: u32,
    pub reward_mascot: u64,
}

#[event]
pub struct AchievementUnlocked {
    pub user: Pubkey,
    pub achievement_id: u32,
}

#[event]
pub struct ChallengeCreated {
    pub week_number: u32,
    pub medals_pool: u64,
}

#[event]
pub struct ChallengeContributed {
    pub user: Pubkey,
    pub week_number: u32,
    pub medals: u64,
}

#[event]
pub struct DrumCommitted {
    pub user: Pubkey,
    pub randomness: Pubkey,
    pub seed_slot: u64,
}

/// [F-06] The oracle value and the prize it produced (anyone can recompute
/// `drum_prize(value, drum_commit)`).
#[event]
pub struct DrumRevealed {
    pub user: Pubkey,
    pub prize: u64,
    pub randomness: Pubkey,
    pub seed_slot: u64,
    pub value: [u8; 32],
    pub cranker: Pubkey,
}

/// [F-06] Refund of a spin the oracle never revealed.
#[event]
pub struct DrumRefunded {
    pub user: Pubkey,
    pub amount: u64,
}

/// Versioned events: legacy drum indexers must never treat whole-Potato V2
/// payouts as historical raw-atom mascot payouts (or vice versa).
#[event]
pub struct PotatoSpinCommitted {
    pub user: Pubkey,
    pub commit: Pubkey,
    pub mint: Pubkey,
    pub price_atoms: u64,
    pub randomness: Pubkey,
    pub seed_slot: u64,
}

#[event]
pub struct PotatoSpinRevealed {
    pub user: Pubkey,
    pub commit: Pubkey,
    pub mint: Pubkey,
    pub prize_atoms: u64,
    pub randomness: Pubkey,
    pub seed_slot: u64,
    pub value: [u8; 32],
    pub cranker: Pubkey,
}

#[event]
pub struct PotatoSpinRefunded {
    pub user: Pubkey,
    pub commit: Pubkey,
    pub mint: Pubkey,
    pub amount_atoms: u64,
}

#[event]
pub struct VrfSlotAdded {
    pub index: u32,
    pub randomness: Pubkey,
    pub vrf_slot: Pubkey,
}

#[event]
pub struct VrfSlotRetiredChanged {
    pub vrf_slot: Pubkey,
    pub retired: bool,
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

/// [SECURITY_CHECKLIST_REVIEW F-C] A cancelled authority rotation used to be
/// silent, so monitoring could not see a proposed takeover being withdrawn.
#[event]
pub struct AuthorityRotationCancelled {
    pub authority: Pubkey,
    pub cancelled: Pubkey,
    pub slot: u64,
}
