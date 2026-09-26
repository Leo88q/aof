use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::Token;
use crate::errors::QuestError;
use crate::events::{VrfSlotAdded, VrfSlotRetiredChanged};
use crate::state::{QuestConfig, VrfSlot};
use crate::vrf::{self, VRF_AUTHORITY_SEED, VRF_RANDOMNESS_SEED, VRF_SLOT_SEED};

/// [F-06] Authority-only: add one Switchboard randomness account to this
/// program's pool (authority = PDA [VRF_AUTHORITY_SEED] of this program).
#[derive(Accounts)]
#[instruction(index: u32, recent_slot: u64)]
pub struct QuestVrfPoolAdd<'info> {
    #[account(seeds = [b"quest_config"], bump = quest_config.bump, has_one = authority @ QuestError::Unauthorized)]
    pub quest_config: Box<Account<'info, QuestConfig>>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: PDA that becomes the Switchboard authority of the new account.
    #[account(seeds = [VRF_AUTHORITY_SEED], bump)]
    pub vrf_authority: UncheckedAccount<'info>,
    /// CHECK: created by Switchboard's randomness_init at this program's PDA.
    #[account(mut, seeds = [VRF_RANDOMNESS_SEED, &index.to_le_bytes()], bump)]
    pub randomness: UncheckedAccount<'info>,
    #[account(init, payer = authority, space = VrfSlot::SIZE, seeds = [VRF_SLOT_SEED, randomness.key().as_ref()], bump)]
    pub vrf_slot: Box<Account<'info, VrfSlot>>,
    /// CHECK: wSOL ATA of the randomness account, created by Switchboard.
    #[account(mut, constraint = reward_escrow.key() == crate::vrf::reward_escrow_address(&randomness.key()) @ QuestError::InvalidRandomnessAccount)]
    pub reward_escrow: UncheckedAccount<'info>,
    /// CHECK: the trusted Switchboard queue.
    #[account(mut, address = crate::vrf::SWITCHBOARD_QUEUE @ QuestError::InvalidRandomnessAccount)]
    pub queue: UncheckedAccount<'info>,
    /// CHECK: Switchboard program state PDA ["STATE"].
    #[account(address = crate::vrf::SWITCHBOARD_STATE @ QuestError::InvalidRandomnessAccount)]
    pub program_state: UncheckedAccount<'info>,
    /// CHECK: Switchboard LUT signer PDA ["LutSigner", randomness].
    #[account(constraint = lut_signer.key() == crate::vrf::lut_signer_address(&randomness.key()) @ QuestError::InvalidRandomnessAccount)]
    pub lut_signer: UncheckedAccount<'info>,
    /// CHECK: address lookup table Switchboard creates for (lut_signer, recent_slot).
    #[account(mut, constraint = lut.key() == crate::vrf::lut_address(&lut_signer.key(), recent_slot) @ QuestError::InvalidRandomnessAccount)]
    pub lut: UncheckedAccount<'info>,
    /// CHECK: native SOL mint.
    #[account(address = anchor_spl::token::spl_token::native_mint::ID)]
    pub wrapped_sol_mint: UncheckedAccount<'info>,
    pub switchboard_program: Program<'info, crate::vrf::SwitchboardOnDemand>,
    pub address_lookup_table_program: Program<'info, crate::vrf::AddressLookupTableProgram>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct QuestVrfPoolSetRetired<'info> {
    #[account(seeds = [b"quest_config"], bump = quest_config.bump, has_one = authority @ QuestError::Unauthorized)]
    pub quest_config: Account<'info, QuestConfig>,
    pub authority: Signer<'info>,
    #[account(mut, seeds = [VRF_SLOT_SEED, vrf_slot.randomness.as_ref()], bump = vrf_slot.bump)]
    pub vrf_slot: Account<'info, VrfSlot>,
}

pub fn add_handler(ctx: Context<QuestVrfPoolAdd>, index: u32, recent_slot: u64) -> Result<()> {
    let a = vrf::InitAccounts {
        switchboard_program: ctx.accounts.switchboard_program.to_account_info(),
        randomness: ctx.accounts.randomness.to_account_info(),
        reward_escrow: ctx.accounts.reward_escrow.to_account_info(),
        vrf_authority: ctx.accounts.vrf_authority.to_account_info(),
        queue: ctx.accounts.queue.to_account_info(),
        payer: ctx.accounts.authority.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
        wrapped_sol_mint: ctx.accounts.wrapped_sol_mint.to_account_info(),
        program_state: ctx.accounts.program_state.to_account_info(),
        lut_signer: ctx.accounts.lut_signer.to_account_info(),
        lut: ctx.accounts.lut.to_account_info(),
        address_lookup_table_program: ctx.accounts.address_lookup_table_program.to_account_info(),
    };
    vrf::cpi_init(&a, index, ctx.bumps.randomness, ctx.bumps.vrf_authority, recent_slot)?;
    let created = vrf::load_randomness(&ctx.accounts.randomness.to_account_info())?;
    require_keys_eq!(created.authority, ctx.accounts.vrf_authority.key(), QuestError::InvalidRandomnessAccount);
    require_keys_eq!(created.queue, vrf::SWITCHBOARD_QUEUE, QuestError::InvalidRandomnessAccount);

    let slot = &mut ctx.accounts.vrf_slot;
    slot.randomness = ctx.accounts.randomness.key();
    slot.index = index;
    slot.lock = Pubkey::default();
    slot.locked_at_slot = 0;
    slot.retired = false;
    slot.commits = 0;
    slot.reveals = 0;
    slot.bump = ctx.bumps.vrf_slot;
    emit!(VrfSlotAdded { index, randomness: slot.randomness, vrf_slot: slot.key() });
    Ok(())
}

pub fn set_retired_handler(ctx: Context<QuestVrfPoolSetRetired>, retired: bool) -> Result<()> {
    let slot = &mut ctx.accounts.vrf_slot;
    if retired {
        require_keys_eq!(slot.lock, Pubkey::default(), QuestError::VrfSlotBusy);
    }
    slot.retired = retired;
    emit!(VrfSlotRetiredChanged { vrf_slot: slot.key(), retired });
    Ok(())
}
