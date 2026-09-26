use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};
use crate::state::{DrumCommit, QuestConfig, VrfSlot};
use crate::errors::QuestError;
use crate::events::DrumRevealed;
use crate::vrf::{self, VrfRevealParams, SLOT_HASHES_ID, VRF_AUTHORITY_SEED, VRF_SLOT_SEED};

/// Таблица шансов барабана: (вес в bps, сумма маскотов).
/// Сумма весов строго = 10000. Редкие крупные призы с малым весом.
///
/// [AUDIT F-13] The old table paid an expected **40** mascots per spin against
/// a spin price of 5 (0.4*10 + 0.3*25 + 0.2*50 + 0.09*150 + 0.01*500), i.e. the
/// treasury lost 8x the price on every spin — a ready-made printing press the
/// moment `drum_commit` was switched on. The table below is calibrated to an
/// expected value of 4.75 against the same price of 5 (95% RTP). The invariants
/// (weights sum to 10000, EV <= price) are now asserted by `drum_odds_tests`.
pub const DRUM_PRIZES: [(u16, u64); 5] = [
    (6000, 2),    // 60% -> 2 маскота
    (2500, 5),    // 25% -> 5  (ровно стоимость спина)
    (1000, 10),   // 10% -> 10
    (400, 20),    //  4% -> 20
    (100, 50),    //  1% -> 50 (джекпот)
];

/// Largest prize in DRUM_PRIZES (the treasury must cover it at commit).
pub const DRUM_MAX_PRIZE: u64 = 50;

/// Prize of a spin: a pure function of the oracle value and the commit key.
pub fn drum_prize(value: &[u8; 32], commit: &Pubkey) -> u64 {
    let roll = vrf::bps(vrf::lane(&vrf::derive_roll(value, b"drum", commit.as_ref()), 0));
    let mut acc: u64 = 0;
    for (weight, amount) in DRUM_PRIZES.iter() {
        acc += *weight as u64;
        if roll < acc {
            return *amount;
        }
    }
    DRUM_PRIZES[DRUM_PRIZES.len() - 1].1
}

/// [F-06] Permissionless settlement: whoever brings the oracle's signed value
/// makes this program reveal (CPI signed by its PDA) and pay the prize.
#[derive(Accounts)]
pub struct DrumReveal<'info> {
    #[account(
        mut,
        seeds = [b"drum_commit", drum_commit.user.as_ref()],
        bump = drum_commit.bump,
        close = user
    )]
    pub drum_commit: Account<'info, DrumCommit>,

    #[account(seeds = [b"quest_config"], bump = quest_config.bump)]
    pub quest_config: Box<Account<'info, QuestConfig>>,

    /// Anyone may settle; pays Switchboard's reveal and an ATA re-creation.
    #[account(mut)]
    pub cranker: Signer<'info>,

    /// CHECK: recipient is the stored commit owner, not an authorization signer.
    #[account(mut, address = drum_commit.user @ QuestError::Unauthorized)]
    pub user: UncheckedAccount<'info>,

    #[account(
        mut,
        address = quest_config.treasury_mascot @ QuestError::Unauthorized
    )]
    pub treasury_mascot: Box<Account<'info, TokenAccount>>,

    #[account(address = quest_config.mascot_mint @ QuestError::Unauthorized)]
    pub mascot_mint: Box<Account<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = cranker,
        associated_token::mint = mascot_mint,
        associated_token::authority = user
    )]
    pub user_mascot: Box<Account<'info, TokenAccount>>,

    #[account(mut, seeds = [VRF_SLOT_SEED, drum_commit.randomness.as_ref()], bump = vrf_slot.bump)]
    pub vrf_slot: Box<Account<'info, VrfSlot>>,
    /// CHECK: the randomness account locked by this spin; verified by vrf::reveal.
    #[account(mut, address = drum_commit.randomness @ QuestError::InvalidRandomnessAccount)]
    pub randomness: UncheckedAccount<'info>,
    /// CHECK: PDA that signs the Switchboard CPI as the randomness authority.
    #[account(seeds = [VRF_AUTHORITY_SEED], bump)]
    pub vrf_authority: UncheckedAccount<'info>,
    /// CHECK: must be the oracle Switchboard assigned to the randomness at commit.
    #[account(constraint = crate::vrf::assigned_oracle_is(&randomness, &oracle.key()) @ QuestError::InvalidRandomnessAccount)]
    pub oracle: UncheckedAccount<'info>,
    /// CHECK: the trusted Switchboard queue.
    #[account(address = crate::vrf::SWITCHBOARD_QUEUE @ QuestError::InvalidRandomnessAccount)]
    pub queue: UncheckedAccount<'info>,
    /// CHECK: Switchboard oracle stats PDA ["OracleRandomnessStats", oracle].
    #[account(mut, constraint = stats.key() == crate::vrf::stats_address(&oracle.key()) @ QuestError::InvalidRandomnessAccount)]
    pub stats: UncheckedAccount<'info>,
    /// CHECK: SlotHashes sysvar.
    #[account(address = SLOT_HASHES_ID)]
    pub recent_slothashes: UncheckedAccount<'info>,
    /// CHECK: wSOL reward escrow of the randomness account (its ATA).
    #[account(mut, constraint = reward_escrow.key() == crate::vrf::reward_escrow_address(&randomness.key()) @ QuestError::InvalidRandomnessAccount)]
    pub reward_escrow: UncheckedAccount<'info>,
    /// CHECK: native SOL mint.
    #[account(address = anchor_spl::token::spl_token::native_mint::ID)]
    pub wrapped_sol_mint: UncheckedAccount<'info>,
    /// CHECK: Switchboard program state PDA ["STATE"].
    #[account(address = crate::vrf::SWITCHBOARD_STATE @ QuestError::InvalidRandomnessAccount)]
    pub program_state: UncheckedAccount<'info>,
    pub switchboard_program: Program<'info, crate::vrf::SwitchboardOnDemand>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DrumReveal>, params: VrfRevealParams) -> Result<()> {
    let clock = Clock::get()?;
    let commit_key = ctx.accounts.drum_commit.key();
    let (randomness, seed_slot, commit_slot) = (
        ctx.accounts.drum_commit.randomness,
        ctx.accounts.drum_commit.seed_slot,
        ctx.accounts.drum_commit.commit_slot,
    );
    let accounts = vrf::RevealAccounts {
        switchboard_program: ctx.accounts.switchboard_program.to_account_info(),
        randomness: ctx.accounts.randomness.to_account_info(),
        oracle: ctx.accounts.oracle.to_account_info(),
        queue: ctx.accounts.queue.to_account_info(),
        stats: ctx.accounts.stats.to_account_info(),
        vrf_authority: ctx.accounts.vrf_authority.to_account_info(),
        payer: ctx.accounts.cranker.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        reward_escrow: ctx.accounts.reward_escrow.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        wrapped_sol_mint: ctx.accounts.wrapped_sol_mint.to_account_info(),
        program_state: ctx.accounts.program_state.to_account_info(),
    };
    let value = vrf::reveal(
        &mut ctx.accounts.vrf_slot,
        &commit_key,
        &randomness,
        seed_slot,
        commit_slot,
        &accounts,
        &params,
        ctx.bumps.vrf_authority,
        clock.slot,
    )?;
    let prize_amount = drum_prize(&value, &commit_key);

    // Казна принадлежит quest_config-PDA и подписывает перевод через signer_seeds.
    let config_bump = ctx.accounts.quest_config.bump;
    let bump_bytes = [config_bump];
    let config_seeds: &[&[u8]] = &[b"quest_config", &bump_bytes];
    let signer_seeds: &[&[&[u8]]] = &[config_seeds];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.treasury_mascot.to_account_info(),
                to: ctx.accounts.user_mascot.to_account_info(),
                authority: ctx.accounts.quest_config.to_account_info(),
            },
            signer_seeds,
        ),
        prize_amount,
    )?;

    emit!(DrumRevealed {
        user: ctx.accounts.user.key(),
        prize: prize_amount,
        randomness,
        seed_slot,
        value,
        cranker: ctx.accounts.cranker.key(),
    });
    Ok(())
}

#[cfg(test)]
mod drum_odds_tests {
    use super::*;

    #[test]
    fn weights_sum_to_ten_thousand() {
        let sum: u32 = DRUM_PRIZES.iter().map(|(w, _)| *w as u32).sum();
        assert_eq!(sum, 10_000, "drum weights must form a full probability space");
    }

    #[test]
    fn expected_payout_does_not_exceed_the_spin_price() {
        const SPIN_COST: u128 = 5;
        let ev: u128 = DRUM_PRIZES
            .iter()
            .map(|(w, amount)| (*w as u128) * (*amount as u128))
            .sum();
        assert!(
            ev <= SPIN_COST * 10_000,
            "drum EV {ev} exceeds the spin price {SPIN_COST}: the treasury would bleed on every spin"
        );
        assert_eq!(SPIN_COST as u64, crate::instructions::drum::drum_commit::DRUM_SPIN_COST_MASCOT);
    }

    #[test]
    fn max_prize_constant_matches_the_table() {
        let max = DRUM_PRIZES.iter().map(|(_, amount)| *amount).max().unwrap();
        assert_eq!(max, DRUM_MAX_PRIZE, "the commit-time treasury check must cover the jackpot");
    }

    /// The VRF-driven prize follows the table: sample many oracle values.
    #[test]
    fn vrf_prize_distribution_follows_the_weights() {
        let commit = Pubkey::new_unique();
        let mut x: u64 = 0x5eed_d7a0;
        let mut counts = [0u32; 5];
        for _ in 0..20_000 {
            let mut value = [0u8; 32];
            for chunk in value.chunks_mut(8) {
                x ^= x << 13;
                x ^= x >> 7;
                x ^= x << 17;
                chunk.copy_from_slice(&x.to_le_bytes());
            }
            let prize = drum_prize(&value, &commit);
            let idx = DRUM_PRIZES.iter().position(|(_, a)| *a == prize).expect("prize from the table");
            counts[idx] += 1;
        }
        for (i, (w, _)) in DRUM_PRIZES.iter().enumerate() {
            let expected = 20_000.0 * (*w as f64) / 10_000.0;
            let sd = (20_000.0 * (*w as f64 / 10_000.0) * (1.0 - *w as f64 / 10_000.0)).sqrt();
            assert!(((counts[i] as f64) - expected).abs() <= 5.0 * sd + 1.0, "bucket {i}: {counts:?}");
        }
    }
}
