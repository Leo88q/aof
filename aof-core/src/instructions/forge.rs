use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Burn, Transfer};
use crate::constants::*;
use crate::{ForgeAttemptCommit, ForgeAttemptReveal, ForgeAttemptExpire};
use crate::errors::*;
use crate::events::*;
use crate::vrf::{self, VrfRevealParams};

/// [F-06] Forge commit. Circuit and Silicon are escrowed until the outcome is
/// known, the SOL fee (+protector) is escrowed on the commit PDA, the current
/// level is snapshotted and a pool randomness account is committed (see vrf.rs).
/// The operator co-signs as the backend gate.
pub fn commit_handler(ctx: Context<ForgeAttemptCommit>, slot_type: u8, use_protector: bool) -> Result<()> {
    require!(slot_type < 3, AofError::InvalidAmount);

    let slot = &mut ctx.accounts.enchant_slot;
    if slot.tool_mint == Pubkey::default() {
        slot.tool_mint = ctx.accounts.tool_mint.key();
        slot.slot_type = slot_type;
    }
    require_keys_eq!(slot.tool_mint, ctx.accounts.tool_mint.key(), AofError::InvalidMint);
    require!(slot.slot_type == slot_type, AofError::InvalidAmount);
    require!(slot.level < ENCHANT_MAX_LEVEL, AofError::EnchantMaxLevel);
    let level_before = slot.level;
    let idx = level_before as usize; // level->level+1, индекс = текущий уровень

    let circuit_cost = ENCHANT_CIRCUIT_COST[idx];
    let silicon_cost = ENCHANT_SILICON_COST[idx];
    for (from, escrow, cost) in [
        (&ctx.accounts.user_circuit, &ctx.accounts.escrow_circuit, circuit_cost),
        (&ctx.accounts.user_silicon, &ctx.accounts.escrow_silicon, silicon_cost),
    ] {
        require!(from.amount >= cost, AofError::InsufficientBalance);
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: escrow.to_account_info(),
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
    // Escrow: user -> forge_commit PDA (on top of the rent Anchor just paid).
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

    let clock = Clock::get()?;
    let commit_key = ctx.accounts.forge_commit.key();
    let accounts = vrf::CommitAccounts {
        switchboard_program: ctx.accounts.switchboard_program.to_account_info(),
        randomness: ctx.accounts.randomness.to_account_info(),
        queue: ctx.accounts.queue.to_account_info(),
        oracle: ctx.accounts.oracle.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        vrf_authority: ctx.accounts.vrf_authority.to_account_info(),
    };
    let seed_slot = vrf::commit(&mut ctx.accounts.vrf_slot, commit_key, &accounts, ctx.bumps.vrf_authority, clock.slot)?;

    let fc = &mut ctx.accounts.forge_commit;
    fc.user = ctx.accounts.user.key();
    fc.tool_mint = ctx.accounts.tool_mint.key();
    fc.slot_type = slot_type;
    fc.level_before = level_before;
    fc.use_protector = use_protector;
    fc.paid_lamports = fee;
    fc.circuit_burned = circuit_cost;
    fc.silicon_burned = silicon_cost;
    fc.randomness = ctx.accounts.randomness.key();
    fc.seed_slot = seed_slot;
    fc.commit_slot = clock.slot;
    fc.bump = ctx.bumps.forge_commit;

    emit!(VrfCommitted {
        mechanic: VRF_MECHANIC_FORGE,
        commit: commit_key,
        user: fc.user,
        randomness: fc.randomness,
        seed_slot,
        commit_slot: clock.slot,
        escrow_lamports: fee,
    });
    Ok(())
}

/// Outcome of one upgrade attempt from `level_before`:
/// (level_after, outcome 0=success 1=partial_fail 2=full_loss).
pub fn forge_outcome(value: &[u8; 32], commit: &Pubkey, level_before: u8, use_protector: bool) -> Result<(u8, u8)> {
    require!(level_before < ENCHANT_MAX_LEVEL, AofError::EnchantMaxLevel);
    let idx = level_before as usize;
    let roll = vrf::bps(vrf::lane(&vrf::derive_roll(value, b"forge", commit.as_ref()), 0));
    let success = FORGE_SUCCESS_BPS[idx] as u64;
    let partial = success + FORGE_PARTIAL_FAIL_BPS[idx] as u64;
    Ok(if roll < success {
        (level_before.checked_add(1).ok_or(AofError::MathOverflow)?, 0)
    } else if roll < partial || use_protector {
        // полная потеря — протектор превращает её в частичную неудачу
        (level_before.saturating_sub(1), 1)
    } else {
        (0, 2)
    })
}

/// [F-06] Permissionless settlement of a forge attempt (see pack_open_reveal).
pub fn reveal_handler(ctx: Context<ForgeAttemptReveal>, params: VrfRevealParams) -> Result<()> {
    let clock = Clock::get()?;
    let commit_key = ctx.accounts.forge_commit.key();
    let (randomness, seed_slot, commit_slot) = (
        ctx.accounts.forge_commit.randomness,
        ctx.accounts.forge_commit.seed_slot,
        ctx.accounts.forge_commit.commit_slot,
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

    // A revealed forge attempt consumes the escrowed inputs; a non-revealed
    // attempt instead returns them through `expire_handler`.
    let fc = &ctx.accounts.forge_commit;
    let token_program = ctx.accounts.token_program.to_account_info();
    let auth = ctx.accounts.auth.to_account_info();
    burn_auth_escrow(
        &token_program,
        &ctx.accounts.circuit_mint.to_account_info(),
        &ctx.accounts.escrow_circuit.to_account_info(),
        &auth,
        ctx.bumps.auth,
        fc.circuit_burned,
    )?;
    burn_auth_escrow(
        &token_program,
        &ctx.accounts.silicon_mint.to_account_info(),
        &ctx.accounts.escrow_silicon.to_account_info(),
        &auth,
        ctx.bumps.auth,
        fc.silicon_burned,
    )?;

    // Only this commit can move the slot while it is pending (the commit PDA
    // is unique per tool+slot), so the level must still be the snapshot.
    let level_before = ctx.accounts.forge_commit.level_before;
    require!(ctx.accounts.enchant_slot.level == level_before, AofError::CommitMismatch);
    let (level_after, outcome) = forge_outcome(&value, &commit_key, level_before, ctx.accounts.forge_commit.use_protector)?;
    ctx.accounts.enchant_slot.level = level_after;

    // Исход известен — fee из escrow уходит в казну.
    let paid = ctx.accounts.forge_commit.paid_lamports;
    release_escrow(
        &ctx.accounts.forge_commit.to_account_info(),
        &ctx.accounts.treasury.to_account_info(),
        paid,
    )?;
    ctx.accounts.forge_commit.paid_lamports = 0;

    emit!(VrfSettled {
        mechanic: VRF_MECHANIC_FORGE,
        commit: commit_key,
        randomness,
        seed_slot,
        value,
        cranker: ctx.accounts.cranker.key(),
    });
    emit!(ForgeAttempted {
        user: ctx.accounts.forge_commit.user,
        tool_mint: ctx.accounts.forge_commit.tool_mint,
        slot_type: ctx.accounts.forge_commit.slot_type,
        level_before,
        level_after,
        outcome,
    });
    Ok(())
}

fn burn_auth_escrow<'info>(
    token_program: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    escrow: &AccountInfo<'info>,
    auth: &AccountInfo<'info>,
    auth_bump: u8,
    amount: u64,
) -> Result<()> {
    if amount == 0 { return Ok(()); }
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    token::burn(
        CpiContext::new_with_signer(
            token_program.clone(),
            Burn { mint: mint.clone(), from: escrow.clone(), authority: auth.clone() },
            signer_seeds,
        ),
        amount,
    )
}

fn refund_auth_escrow<'info>(
    token_program: &AccountInfo<'info>,
    escrow: &AccountInfo<'info>,
    destination: &AccountInfo<'info>,
    auth: &AccountInfo<'info>,
    auth_bump: u8,
    amount: u64,
) -> Result<()> {
    if amount == 0 { return Ok(()); }
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    token::transfer(
        CpiContext::new_with_signer(
            token_program.clone(),
            Transfer { from: escrow.clone(), to: destination.clone(), authority: auth.clone() },
            signer_seeds,
        ),
        amount,
    )
}

/// Перевод escrow с PDA коммита на получателя (оба аккаунта уже `mut`).
fn release_escrow<'info>(from: &AccountInfo<'info>, to: &AccountInfo<'info>, amount: u64) -> Result<()> {
    let reserve = Rent::get()?.minimum_balance(from.data_len());
    crate::economics::transfer_owned_lamports(from, to, amount, reserve)
}

/// [F-06] Refund a forge attempt the oracle never revealed: escrowed Circuit
/// and Silicon are transferred back (not re-minted), and the SOL fee and rent
/// go back to the user. Permissionless after the reveal window closes.
pub fn expire_handler(ctx: Context<ForgeAttemptExpire>) -> Result<()> {
    let clock = Clock::get()?;
    let commit_key = ctx.accounts.forge_commit.key();
    let commit_slot = ctx.accounts.forge_commit.commit_slot;
    vrf::release_for_refund(&mut ctx.accounts.vrf_slot, &commit_key, commit_slot, clock.slot)?;

    let fc = &ctx.accounts.forge_commit;
    let (paid, circuit, silicon) = (fc.paid_lamports, fc.circuit_burned, fc.silicon_burned);
    let token_program = ctx.accounts.token_program.to_account_info();
    let auth = ctx.accounts.auth.to_account_info();
    refund_auth_escrow(
        &token_program,
        &ctx.accounts.escrow_circuit.to_account_info(),
        &ctx.accounts.user_circuit.to_account_info(),
        &auth,
        ctx.bumps.auth,
        circuit,
    )?;
    refund_auth_escrow(
        &token_program,
        &ctx.accounts.escrow_silicon.to_account_info(),
        &ctx.accounts.user_silicon.to_account_info(),
        &auth,
        ctx.bumps.auth,
        silicon,
    )?;

    // The escrowed fee reaches the user with the rent through `close = user`.
    let fc = &mut ctx.accounts.forge_commit;
    fc.circuit_burned = 0;
    fc.silicon_burned = 0;
    emit!(ForgeCommitExpired {
        user: fc.user,
        tool_mint: fc.tool_mint,
        slot_type: fc.slot_type,
        refunded_lamports: paid,
        circuit_refunded: circuit,
        silicon_refunded: silicon,
    });
    emit!(VrfCommitRefunded {
        mechanic: VRF_MECHANIC_FORGE,
        commit: commit_key,
        user: fc.user,
        refunded_lamports: paid,
    });
    Ok(())
}
