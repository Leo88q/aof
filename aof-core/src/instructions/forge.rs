use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, Burn, MintTo};
use crate::constants::*;
use crate::{ForgeAttemptCommit, ForgeAttemptReveal, ForgeAttemptExpire};
use crate::errors::*;
use crate::events::*;
use crate::randomness::*;

/// Commit ковки. Wood/stone сжигаются сразу (их количество записывается в
/// коммит и возвращается минтом при expiry), SOL-fee (+protector) **не
/// уходит в казну**, а лежит в escrow на PDA `forge_commit` до исхода:
/// reveal → казна, expire → user. Раньше здесь стоял FeatureDisabled из-за
/// отсутствия пути возврата и «мёртвого» meat-аккаунта без стоимости;
/// meat-аккаунты убраны (они ни на что не влияли), путь возврата добавлен.
pub fn commit_handler(
    ctx: Context<ForgeAttemptCommit>,
    slot_type: u8,
    commit_hash: [u8; 32],
    use_protector: bool,
) -> Result<()> {
    // A user-selected secret plus refundable expiry permits selective aborts.
    // Do not accept new economic risk until authenticated VRF + non-optional
    // settlement is implemented. Preserve reveal/expire for existing commits.
    require!(false, AofError::FeatureDisabled);
    require!(slot_type < 3, AofError::InvalidAmount);

    let slot = &mut ctx.accounts.enchant_slot;
    if slot.tool_mint == Pubkey::default() {
        slot.tool_mint = ctx.accounts.tool_mint.key();
        slot.slot_type = slot_type;
    }
    require_keys_eq!(slot.tool_mint, ctx.accounts.tool_mint.key(), AofError::InvalidMint);
    require!(slot.slot_type == slot_type, AofError::InvalidAmount);
    require!(slot.level < ENCHANT_MAX_LEVEL, AofError::EnchantMaxLevel);
    let idx = slot.level as usize; // level->level+1, индекс = текущий уровень

    let wood_cost = ENCHANT_WOOD_COST[idx];
    let stone_cost = ENCHANT_STONE_COST[idx];
    for (mint, from, cost) in [
        (&ctx.accounts.wood_mint, &ctx.accounts.user_wood, wood_cost),
        (&ctx.accounts.stone_mint, &ctx.accounts.user_stone, stone_cost),
    ] {
        require!(from.amount >= cost, AofError::InsufficientBalance);
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: mint.to_account_info(),
                    from: from.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            cost,
        )?;
    }

    let mut fee = ENCHANT_FEE_LAMPORTS[idx];
    if use_protector {
        fee = fee.checked_add(FORGE_PROTECTOR_PRICE_LAMPORTS).ok_or(AofError::MathOverflow)?;
    }
    // Escrow: user -> forge_commit PDA (поверх ренты, которую Anchor уже внёс).
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.forge_commit.to_account_info(),
            },
        ),
        fee,
    )?;

    let slot_num = Clock::get()?.slot;
    let fc = &mut ctx.accounts.forge_commit;
    fc.user = ctx.accounts.user.key();
    fc.tool_mint = ctx.accounts.tool_mint.key();
    fc.slot_type = slot_type;
    fc.commit_hash = commit_hash;
    fc.commit_slot = slot_num;
    fc.use_protector = use_protector;
    fc.paid_lamports = fee;
    fc.wood_burned = wood_cost;
    fc.stone_burned = stone_cost;
    Ok(())
}

/// Перевод escrow с PDA коммита на получателя (оба аккаунта уже `mut`).
fn release_escrow<'info>(from: &AccountInfo<'info>, to: &AccountInfo<'info>, amount: u64) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    **from.try_borrow_mut_lamports()? = from.lamports().checked_sub(amount).ok_or(AofError::MathOverflow)?;
    **to.try_borrow_mut_lamports()? = to.lamports().checked_add(amount).ok_or(AofError::MathOverflow)?;
    Ok(())
}

pub fn reveal_handler(ctx: Context<ForgeAttemptReveal>, secret: [u8; 32]) -> Result<()> {
    require!(
        hash_secret(&secret) == ctx.accounts.forge_commit.commit_hash,
        AofError::CommitMismatch
    );
    let slot_hash = get_slot_hash(&ctx.accounts.slot_hashes, ctx.accounts.forge_commit.commit_slot)?;
    let entropy = derive_entropy(&secret, &slot_hash, b"forge");
    let roll = entropy_u64(&entropy) % 10_000;

    let slot = &mut ctx.accounts.enchant_slot;
    require!(slot.level < ENCHANT_MAX_LEVEL, AofError::EnchantMaxLevel);
    let idx = slot.level as usize;
    let level_before = slot.level;

    let outcome: u8;
    if roll < FORGE_SUCCESS_BPS[idx] as u64 {
        slot.level = slot.level.checked_add(1).ok_or(AofError::MathOverflow)?;
        outcome = 0;
    } else if roll < (FORGE_SUCCESS_BPS[idx] as u64 + FORGE_PARTIAL_FAIL_BPS[idx] as u64) {
        slot.level = slot.level.saturating_sub(1);
        outcome = 1;
    } else {
        // полная потеря — протектор превращает её в частичную неудачу
        if ctx.accounts.forge_commit.use_protector {
            slot.level = slot.level.saturating_sub(1);
            outcome = 1;
        } else {
            slot.level = 0;
            outcome = 2;
        }
    }

    // Исход известен — fee из escrow уходит в казну.
    let paid = ctx.accounts.forge_commit.paid_lamports;
    release_escrow(
        &ctx.accounts.forge_commit.to_account_info(),
        &ctx.accounts.treasury.to_account_info(),
        paid,
    )?;
    ctx.accounts.forge_commit.paid_lamports = 0;

    emit!(ForgeAttempted {
        user: ctx.accounts.forge_commit.user,
        tool_mint: ctx.accounts.forge_commit.tool_mint,
        slot_type: ctx.accounts.forge_commit.slot_type,
        level_before,
        level_after: slot.level,
        outcome,
    });
    Ok(())
}

/// Возврат по просроченному коммиту: строго после `COMMIT_EXPIRY_SLOTS`
/// (> окна SlotHashes, т.е. reveal уже невозможен → двойной выплаты нет).
pub fn expire_handler(ctx: Context<ForgeAttemptExpire>) -> Result<()> {
    let now = Clock::get()?.slot;
    let fc = &ctx.accounts.forge_commit;
    require!(now.saturating_sub(fc.commit_slot) >= COMMIT_EXPIRY_SLOTS, AofError::CommitNotExpired);
    let (paid, wood, stone) = (fc.paid_lamports, fc.wood_burned, fc.stone_burned);

    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    for (mint, to, amount) in [
        (&ctx.accounts.wood_mint, &ctx.accounts.user_wood, wood),
        (&ctx.accounts.stone_mint, &ctx.accounts.user_stone, stone),
    ] {
        if amount == 0 {
            continue;
        }
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: mint.to_account_info(),
                    to: to.to_account_info(),
                    authority: ctx.accounts.auth.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;
    }

    release_escrow(
        &ctx.accounts.forge_commit.to_account_info(),
        &ctx.accounts.user.to_account_info(),
        paid,
    )?;
    let fc = &mut ctx.accounts.forge_commit;
    fc.paid_lamports = 0;
    fc.wood_burned = 0;
    fc.stone_burned = 0;

    emit!(ForgeCommitExpired {
        user: fc.user,
        tool_mint: fc.tool_mint,
        slot_type: fc.slot_type,
        refunded_lamports: paid,
        wood_refunded: wood,
        stone_refunded: stone,
    });
    Ok(())
}
