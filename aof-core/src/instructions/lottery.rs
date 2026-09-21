use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::{InitLotteryRound, BuyLotteryTicket, DrawLottery, CommitLotteryDraw, ClaimLotteryPrize, RefundLotteryRound};
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
    // [AUDIT F-23] start of the refund clock: without a creation timestamp a
    // never-drawn round could strand its pool with no way to prove how long it
    // had been stuck.
    r.created_at = Clock::get()?.unix_timestamp;
    Ok(())
}

pub fn buy_ticket_handler(ctx: Context<BuyLotteryTicket>) -> Result<()> {
    // Ticket sales stay disabled: the draw is a plain authority commit-reveal
    // (see [AUDIT F-06]) and there is no VRF yet. The body below is the shape
    // the instruction must have when it is switched on — including the
    // on-chain per-wallet ticket cap that `LOTTERY_MAX_TICKETS_PER_DAY` used to
    // describe without ever enforcing.
    require!(false, AofError::FeatureDisabled);
    require!(!ctx.accounts.lottery_round.drawn, AofError::LotteryRoundClosed);

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
    round.tickets_sold = round
        .tickets_sold
        .checked_add(1)
        .ok_or(AofError::MathOverflow)?;
    round.pool_lamports = round.pool_lamports.checked_add(pool_cut).ok_or(AofError::MathOverflow)?;

    // [AUDIT] per-wallet daily cap, enforced on-chain instead of trusting the
    // backend: the counter PDA is derived from (round, buyer), so `init` on a
    // capped counter fails before any lamports move.
    let counter = &mut ctx.accounts.ticket_counter;
    if counter.buyer == Pubkey::default() {
        counter.buyer = ctx.accounts.buyer.key();
        counter.round_id = round.round_id;
        counter.bump = ctx.bumps.ticket_counter;
    }
    require!(
        counter.count < LOTTERY_MAX_TICKETS_PER_DAY,
        AofError::LotteryDailyLimitReached
    );
    counter.count = counter
        .count
        .checked_add(1)
        .ok_or(AofError::MathOverflow)?;

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

/// [AUDIT F-06] Disabled. `commit_lottery_draw` + `draw_lottery` is a plain
/// authority commit-reveal: the authority generates the secret itself, and
/// after the commit lands the slot hash is public, so an offline grind can
/// pick a secret that produces a chosen `winning_ticket`. There is no forced
/// settlement and (before F-23) no refund path, so an "unlucky" round simply
/// stayed unrevealed with the pool locked. Keeping the instruction callable
/// would be a payable randomness game whose outcome the house can choose.
pub fn commit_draw_handler(_ctx: Context<CommitLotteryDraw>, _commit_hash: [u8; 32]) -> Result<()> {
    require!(false, AofError::RandomnessDisabled);
    #[allow(unreachable_code)]
    {
        let round = &mut _ctx.accounts.lottery_round;
        require!(!round.drawn, AofError::LotteryRoundClosed);
        require!(!round.draw_committed, AofError::LotteryDrawAlreadyCommitted);
        require!(round.tickets_sold > 0, AofError::LotteryRoundClosed);
        round.draw_committed = true;
        round.draw_commit_slot = Clock::get()?.slot;
        round.draw_commit_hash = _commit_hash;
        Ok(())
    }
}

/// [AUDIT F-06] Disabled — see `commit_draw_handler`.
pub fn draw_handler(_ctx: Context<DrawLottery>, _secret: [u8; 32]) -> Result<()> {
    require!(false, AofError::RandomnessDisabled);
    #[allow(unreachable_code)]
    {
        let round = &mut _ctx.accounts.lottery_round;
        require!(!round.drawn, AofError::LotteryRoundClosed);
        require!(round.draw_committed, AofError::LotteryDrawNotCommitted);
        require!(hash_secret(&_secret) == round.draw_commit_hash, AofError::InvalidHash);
        require!(round.tickets_sold > 0, AofError::LotteryRoundClosed);

        let commit_slot = round.draw_commit_slot;
        let slot_hash = get_slot_hash(&_ctx.accounts.slot_hashes, commit_slot)?;
        let entropy = derive_entropy(&_secret, &slot_hash, b"lottery");
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
}

pub fn claim_prize_handler(ctx: Context<ClaimLotteryPrize>) -> Result<()> {
    // [AUDIT F-19] `set_paused` used to leave the prize claim path open.
    require!(!ctx.accounts.config.paused, AofError::Paused);
    let round = &mut ctx.accounts.lottery_round;
    require!(round.drawn, AofError::LotteryNotDrawn);
    require!(!round.claimed, AofError::LotteryRoundClosed);
    require!(
        ctx.accounts.lottery_ticket.ticket_number == round.winning_ticket,
        AofError::NotWinningTicket
    );

    let amount = round.pool_lamports;
    round.claimed = true;
    // The round PDA must keep its rent-exempt reserve, so the payout is capped
    // by whatever sits above that reserve — never the reserve itself.
    let min_rent = Rent::get()?.minimum_balance(LOTTERY_ROUND_SPACE);
    let round_lamports = round.to_account_info().lamports();
    let payout = amount.min(round_lamports.saturating_sub(min_rent));
    require!(payout > 0, AofError::VaultInsufficient);

    **round.to_account_info().try_borrow_mut_lamports()? -= payout;
    **ctx.accounts.winner.try_borrow_mut_lamports()? += payout;

    emit!(LotteryClaimed {
        round_id: round.round_id,
        winner: ctx.accounts.winner.key(),
        amount: payout,
    });
    Ok(())
}

/// [AUDIT F-23] A round the authority never reveals used to lock its pool in
/// the PDA forever (there is no forced settlement and no expiry). Once the
/// timeout has elapsed anyone may sweep the pool — and the account's rent —
/// back to the configured treasury and close the round.
pub fn refund_round_handler(ctx: Context<RefundLotteryRound>, _round_id: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round = &ctx.accounts.round;
    require!(!round.drawn, AofError::LotteryAlreadyDrawn);
    require!(
        now >= round
            .created_at
            .saturating_add(LOTTERY_ROUND_TIMEOUT_SECONDS),
        AofError::LotteryRoundNotExpired
    );

    emit!(LotteryRoundRefunded {
        round_id: round.round_id,
        lamports: round.pool_lamports,
        tickets_sold: round.tickets_sold,
        at: now,
    });
    // `close = treasury` in the Accounts struct moves every remaining lamport
    // (pool + rent) to the configured treasury after this handler returns.
    Ok(())
}
