use anchor_lang::prelude::*;
use crate::{MintResourceOnce, ResourceKind};
use crate::constants::*;
use crate::instructions::mint_resource::execute_mint;

pub fn handler(ctx: Context<MintResourceOnce>, kind: ResourceKind, amount: u64, reward_id: [u8; 32]) -> Result<()> {
    // Профиль мог быть создан init_if_needed-веткой этой же инструкции,
    // поэтому владельца профиля проставляем здесь, а не в `execute_mint`,
    // который больше ничего не пишет в аккаунт игрока (этот аккаунт платит
    // и создаёт сам игрок, а не кошелёк проекта).
    if ctx.accounts.player.owner == Pubkey::default() {
        let profile = &mut ctx.accounts.player;
        profile.owner = ctx.accounts.token_account.owner;
        profile.villagers = DEFAULT_VILLAGERS;
        profile.villagers_available = DEFAULT_VILLAGERS;
    }
    // `init` (not init_if_needed), scoped to the reward ID alone, blocks replay
    // even when the caller changes amount, recipient, mint, or transaction ID.
    // Account creation, both token mints and the receipt write are atomic.
    execute_mint(&ctx.accounts.config, &ctx.accounts.material_mints,
        Some(&*ctx.accounts.player), &mut ctx.accounts.issuance_cap,
        &ctx.accounts.mint, &ctx.accounts.token_account,
        &ctx.accounts.treasury_token, &ctx.accounts.auth, &ctx.accounts.token_program,
        ctx.bumps.auth, kind, amount)?;
    let receipt = &mut ctx.accounts.reward_receipt;
    receipt.reward_id = reward_id;
    receipt.recipient = ctx.accounts.token_account.owner;
    receipt.mint = ctx.accounts.mint.key();
    receipt.gross_amount = amount;
    receipt.claimed_slot = Clock::get()?.slot;
    receipt.bump = ctx.bumps.reward_receipt;
    Ok(())
}
