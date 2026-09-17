use anchor_lang::prelude::*;
use crate::PackOpenExpire;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;

/// Возврат escrow по просроченному pack-коммиту.
///
/// Условие: `current_slot - commit_slot >= COMMIT_EXPIRY_SLOTS` (600 > ~512
/// слотов окна SlotHashes). После этого `pack_open_reveal` уже физически не
/// может пройти (`get_slot_hash` вернёт CommitExpired), значит двойной выплаты
/// (инструмент + возврат) быть не может. Escrow `paid_lamports` переводится
/// `user`, затем `close = user` возвращает ему ренту PDA.
pub fn handler(ctx: Context<PackOpenExpire>) -> Result<()> {
    let now = Clock::get()?.slot;
    let commit_slot = ctx.accounts.pack_commit.commit_slot;
    require!(
        now.saturating_sub(commit_slot) >= COMMIT_EXPIRY_SLOTS,
        AofError::CommitNotExpired
    );

    let paid = ctx.accounts.pack_commit.paid_lamports;
    if paid > 0 {
        let commit_info = ctx.accounts.pack_commit.to_account_info();
        **commit_info.try_borrow_mut_lamports()? = commit_info
            .lamports()
            .checked_sub(paid)
            .ok_or(AofError::MathOverflow)?;
        **ctx.accounts.user.try_borrow_mut_lamports()? = ctx
            .accounts
            .user
            .lamports()
            .checked_add(paid)
            .ok_or(AofError::MathOverflow)?;
        ctx.accounts.pack_commit.paid_lamports = 0;
    }

    emit!(PackCommitExpired {
        user: ctx.accounts.pack_commit.user,
        mint: ctx.accounts.pack_commit.mint,
        pack_type: ctx.accounts.pack_commit.pack_type,
        refunded_lamports: paid,
    });
    Ok(())
}
