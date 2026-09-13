use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::{InitLotteryRound, BuyLotteryTicket, DrawLottery, CommitLotteryDraw, ClaimLotteryPrize};
use crate::errors::*;
use crate::events::*;
use crate::randomness::*;

pub fn init_round_handler(ctx: Context<InitLotteryRound>, round_id: u64) -> Result<()> {
    let r = &mut ctx.accounts.lottery_round;
    r.round_id = round_id;
    r.pool_lamports = 0;
    r.tickets_sold = 0;
    r.draw_slot = 0;
    r.drawn = false;
    r.winning_ticket = 0;
    r.claimed = false;
    r.bump = ctx.bumps.lottery_round;
    // [ФИКС] инициализация commit-reveal полей
    r.draw_committed = false;
    r.draw_commit_slot = 0;
    r.draw_commit_hash = [0u8; 32];
    Ok(())
}

pub fn buy_ticket_handler(ctx: Context<BuyLotteryTicket>) -> Result<()> {
    require!(!ctx.accounts.lottery_round.drawn, AofError::LotteryRoundClosed);
    // дневной кап решается офчейн-подсчётом сервера в реальном проде

    let price = LOTTERY_TICKET_PRICE_LAMPORTS;
    let pool_cut = price.checked_mul(LOTTERY_POOL_BPS as u64).ok_or(AofError::MathOverflow)? / 10_000;
    let dev_cut = price.checked_sub(pool_cut).ok_or(AofError::MathOverflow)?;

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.lottery_round.to_account_info(),
            },
        ),
        pool_cut,
    )?;
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        dev_cut,
    )?;

    let round = &mut ctx.accounts.lottery_round;
    let ticket_number = round.tickets_sold;
    round.tickets_sold += 1;
    round.pool_lamports = round.pool_lamports.checked_add(pool_cut).ok_or(AofError::MathOverflow)?;

    let t = &mut ctx.accounts.lottery_ticket;
    t.round_id = round.round_id;
    t.ticket_number = ticket_number;
    t.buyer = ctx.accounts.buyer.key();

    emit!(LotteryTicketBought {
        round_id: round.round_id,
        buyer: ctx.accounts.buyer.key(),
        ticket_number,
    });
    Ok(())
}

/// [ФИКС] Фаза 1 (commit): authority заранее вычисляет secret офчейн и присылает
/// ончейн только sha256(secret). Ни сервер, ни игроки в этот момент не могут
/// повлиять на исход, т.к. финальная энтропия домешивает хэш слота коммита,
/// которого на момент коммита ещё не существует.
pub fn commit_draw_handler(ctx: Context<CommitLotteryDraw>, commit_hash: [u8; 32]) -> Result<()> {
    let round = &mut ctx.accounts.lottery_round;
    require!(!round.drawn, AofError::LotteryRoundClosed);
    require!(round.tickets_sold > 0, AofError::LotteryRoundClosed);
    round.draw_committed = true;
    round.draw_commit_slot = Clock::get()?.slot;
    round.draw_commit_hash = commit_hash;
    Ok(())
}

/// [ФИКС] Фаза 2 (reveal): authority публикует secret. Программа проверяет
/// sha256(secret) == commit_hash, затем берёт хэш слота КОММИТА (его на момент
/// коммита ещё не существовало) -> никто не мог предугадать энтропию заранее.
/// Коммит+ревил в одном слоте невозможен: хэш слота коммита появляется в
/// SlotHashes только со следующего слота.
pub fn draw_handler(ctx: Context<DrawLottery>, secret: [u8; 32]) -> Result<()> {
    let round = &mut ctx.accounts.lottery_round;
    require!(!round.drawn, AofError::LotteryRoundClosed);
    require!(round.draw_committed, AofError::LotteryDrawNotCommitted);
    require!(
        hash_secret(&secret) == round.draw_commit_hash,
        AofError::InvalidHash
    );

    let commit_slot = round.draw_commit_slot;
    let slot_hash = get_slot_hash(&ctx.accounts.slot_hashes, commit_slot)?;
    let entropy = derive_entropy(&secret, &slot_hash, b"lottery");
    let winning_ticket = entropy_u64(&entropy) % round.tickets_sold;

    round.drawn = true;
    round.draw_slot = commit_slot;
    round.winning_ticket = winning_ticket;

    emit!(LotteryDrawn {
        round_id: round.round_id,
        winning_ticket,
        pool_lamports: round.pool_lamports,
    });
    Ok(())
}

pub fn claim_prize_handler(ctx: Context<ClaimLotteryPrize>) -> Result<()> {
    let round = &mut ctx.accounts.lottery_round;
    require!(round.drawn, AofError::LotteryNotDrawn);
    require!(!round.claimed, AofError::LotteryRoundClosed);
    require!(
        ctx.accounts.lottery_ticket.ticket_number == round.winning_ticket,
        AofError::NotWinningTicket
    );

    let amount = round.pool_lamports;
    round.claimed = true;

    **round.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.winner.try_borrow_mut_lamports()? += amount;

    emit!(LotteryClaimed {
        round_id: round.round_id,
        winner: ctx.accounts.winner.key(),
        amount,
    });
    Ok(())
}
