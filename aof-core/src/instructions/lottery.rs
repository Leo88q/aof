use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::{
    InitLotteryRound, BuyLotteryTicket, DrawLottery, CommitLotteryDraw, ClaimLotteryPrize, RefundLotteryRound,
    ExpireLotteryDraw, RefundLotteryTicket,
};
use crate::errors::*;
use crate::events::*;
use crate::vrf::{self, VrfRevealParams};

pub fn init_round_handler(ctx: Context<InitLotteryRound>, round_id: u64) -> Result<()> {
    let r = &mut ctx.accounts.lottery_round;
    r.round_id = round_id;
    r.pool_lamports = 0;
    r.tickets_sold = 0;
    r.seed_slot = 0;
    r.drawn = false;
    r.winning_ticket = 0;
    r.claimed = false;
    r.bump = ctx.bumps.lottery_round;
    r.draw_committed = false;
    r.draw_commit_slot = 0;
    r.randomness = Pubkey::default();
    // [AUDIT F-23] start of the sales window and of the refund clock.
    r.created_at = Clock::get()?.unix_timestamp;
    Ok(())
}

/// [F-06] Ticket purchase. The FULL price is escrowed on the round (nothing
/// reaches the treasury before the draw), so an undrawn round can refund
/// every ticket in full. Sales close as soon as a draw is committed.
///
/// `max_price_lamports` is the ceiling the buyer signed in the wallet intent.
/// It is checked against the price actually escrowed in this transaction, so a
/// changed constant (or a quote that raced a deploy) fails closed instead of
/// charging more than the player saw.
pub fn buy_ticket_handler(ctx: Context<BuyLotteryTicket>, max_price_lamports: u64) -> Result<()> {
    require!(!ctx.accounts.lottery_round.drawn, AofError::LotteryRoundClosed);
    require!(!ctx.accounts.lottery_round.draw_committed, AofError::LotterySalesClosed);

    let price = LOTTERY_TICKET_PRICE_LAMPORTS;
    require!(price <= max_price_lamports, AofError::PriceAboveMaximum);
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.lottery_round.to_account_info(),
            },
        ),
        price,
    )?;

    let round = &mut ctx.accounts.lottery_round;
    let ticket_number = round.tickets_sold;
    round.tickets_sold = round
        .tickets_sold
        .checked_add(1)
        .ok_or(AofError::MathOverflow)?;
    round.pool_lamports = round.pool_lamports.checked_add(price).ok_or(AofError::MathOverflow)?;

    // [AUDIT] per-wallet cap, enforced on-chain instead of trusting the
    // backend: the counter PDA is derived from (round, buyer).
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

/// [F-06] Close sales and commit the draw to a pool randomness account.
/// The operator may do it at any time; after LOTTERY_SALES_SECONDS anyone may,
/// so a round cannot be held open (or kept from drawing) by the house. The
/// winner is fixed by the oracle, not by who commits or when.
pub fn commit_draw_handler(ctx: Context<CommitLotteryDraw>) -> Result<()> {
    let clock = Clock::get()?;
    let round = &ctx.accounts.lottery_round;
    require!(!round.drawn, AofError::LotteryRoundClosed);
    require!(!round.draw_committed, AofError::LotteryDrawAlreadyCommitted);
    require!(round.seed_slot != u64::MAX, AofError::LotteryRoundClosed);
    require!(round.tickets_sold > 0, AofError::LotteryRoundClosed);
    let sales_over = clock.unix_timestamp >= round.created_at.saturating_add(LOTTERY_SALES_SECONDS);
    require!(
        sales_over || ctx.accounts.cranker.key() == ctx.accounts.config.operator,
        AofError::LotterySalesOpen
    );

    let commit_key = ctx.accounts.lottery_round.key();
    let seed_slot = vrf::commit(&mut ctx.accounts.vrf_slot, commit_key, clock.slot)?;

    let round = &mut ctx.accounts.lottery_round;
    round.draw_committed = true;
    round.draw_commit_slot = clock.slot;
    round.seed_slot = seed_slot;
    round.randomness = ctx.accounts.vrf_slot.key();

    emit!(VrfCommitted {
        mechanic: VRF_MECHANIC_LOTTERY,
        commit: commit_key,
        user: ctx.accounts.cranker.key(),
        randomness: round.randomness,
        seed_slot,
        commit_slot: clock.slot,
        escrow_lamports: round.pool_lamports,
    });
    Ok(())
}

/// [F-06] Permissionless draw: four future slot hashes, winning ticket from
/// the verified value, the house share (LOTTERY_DEV_BPS) to the treasury.
pub fn draw_handler(ctx: Context<DrawLottery>, params: VrfRevealParams) -> Result<()> {
    let clock = Clock::get()?;
    let round_key = ctx.accounts.lottery_round.key();
    let round = &ctx.accounts.lottery_round;
    require!(!round.drawn, AofError::LotteryRoundClosed);
    require!(round.draw_committed, AofError::LotteryDrawNotCommitted);
    require!(round.tickets_sold > 0, AofError::LotteryRoundClosed);
    let (randomness, seed_slot, commit_slot) = (round.randomness, round.seed_slot, round.draw_commit_slot);

    let value = vrf::reveal(
        &mut ctx.accounts.vrf_slot,
        &round_key,
        seed_slot,
        commit_slot,
        &ctx.accounts.recent_slothashes.to_account_info(),
        clock.slot,
    )?;

    let tickets = ctx.accounts.lottery_round.tickets_sold;
    let roll = vrf::derive_roll(&value, b"lottery", round_key.as_ref());
    let winning_ticket = vrf::below(vrf::lane(&roll, 0), tickets);

    // House share leaves the escrow now that the round is settled; the rest
    // is the prize.
    let pool = ctx.accounts.lottery_round.pool_lamports;
    let (prize, house) = crate::economics::split_bps(pool, LOTTERY_DEV_BPS)?;
    if house > 0 {
        let reserve = Rent::get()?.minimum_balance(LOTTERY_ROUND_SPACE);
        crate::economics::transfer_owned_lamports(
            &ctx.accounts.lottery_round.to_account_info(),
            &ctx.accounts.treasury.to_account_info(),
            house,
            reserve,
        )?;
    }

    let round = &mut ctx.accounts.lottery_round;
    round.drawn = true;
    round.winning_ticket = winning_ticket;
    round.pool_lamports = prize;

    emit!(VrfSettled {
        mechanic: VRF_MECHANIC_LOTTERY,
        commit: round_key,
        randomness,
        seed_slot,
        value,
        cranker: ctx.accounts.cranker.key(),
    });
    emit!(LotteryDrawn {
        round_id: round.round_id,
        winning_ticket,
        pool_lamports: prize,
    });
    Ok(())
}

/// [F-06] The oracle never revealed the draw inside the window: free the pool
/// slot and reopen the round for a new draw commit. Nobody could see the old
/// value settle anything, so re-drawing gives no one a choice.
pub fn expire_draw_handler(ctx: Context<ExpireLotteryDraw>) -> Result<()> {
    let clock = Clock::get()?;
    let round_key = ctx.accounts.lottery_round.key();
    let round = &ctx.accounts.lottery_round;
    require!(!round.drawn, AofError::LotteryAlreadyDrawn);
    require!(round.draw_committed, AofError::LotteryDrawNotCommitted);
    let commit_slot = round.draw_commit_slot;
    let path = vrf::unsettled(&ctx.accounts.recent_slothashes.to_account_info(), commit_slot, clock.slot)?;
    vrf::release_lock(&mut ctx.accounts.vrf_slot, &round_key)?;
    let round = &mut ctx.accounts.lottery_round;
    round.draw_committed = false;
    round.draw_commit_slot = 0;
    // A skipped slot never had an outcome, so the round may draw again.
    // An aged-out hash may already have been seen: tickets can be refunded,
    // but seed_slot = u64::MAX blocks a second draw of the same pot.
    round.seed_slot = if path == vrf::Unsettled::TreasuryForfeit { u64::MAX } else { 0 };
    round.randomness = Pubkey::default();
    emit!(VrfCommitRefunded {
        mechanic: VRF_MECHANIC_LOTTERY,
        commit: round_key,
        user: Pubkey::default(),
        refunded_lamports: 0,
    });
    Ok(())
}

/// [AUDIT F-23 / F-06] A round that was never drawn refunds each ticket in
/// full to its buyer after LOTTERY_ROUND_TIMEOUT_SECONDS (permissionless; the
/// money can only go to the ticket's buyer). A draw in flight must settle or
/// expire first. Closing the ticket makes a second refund impossible.
pub fn refund_ticket_handler(ctx: Context<RefundLotteryTicket>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round = &ctx.accounts.lottery_round;
    require!(!round.drawn, AofError::LotteryAlreadyDrawn);
    require!(!round.draw_committed, AofError::LotteryDrawAlreadyCommitted);
    require!(
        now >= round.created_at.saturating_add(LOTTERY_ROUND_TIMEOUT_SECONDS),
        AofError::LotteryRoundNotExpired
    );
    let price = LOTTERY_TICKET_PRICE_LAMPORTS;
    let reserve = Rent::get()?.minimum_balance(LOTTERY_ROUND_SPACE);
    crate::economics::transfer_owned_lamports(
        &ctx.accounts.lottery_round.to_account_info(),
        &ctx.accounts.buyer.to_account_info(),
        price,
        reserve,
    )?;
    let round = &mut ctx.accounts.lottery_round;
    round.pool_lamports = round.pool_lamports.checked_sub(price).ok_or(AofError::MathOverflow)?;
    emit!(LotteryTicketRefunded {
        round_id: round.round_id,
        ticket_number: ctx.accounts.lottery_ticket.ticket_number,
        buyer: ctx.accounts.buyer.key(),
        lamports: price,
    });
    Ok(())
}

pub fn claim_prize_handler(ctx: Context<ClaimLotteryPrize>) -> Result<()> {
    // [AUDIT F-19] `set_paused` used to leave the prize claim path open.
    require!(!ctx.accounts.config.paused, AofError::Paused);
    let min_rent = Rent::get()?.minimum_balance(LOTTERY_ROUND_SPACE);
    let round_info = ctx.accounts.lottery_round.to_account_info();
    let payout = settle_prize(
        &mut ctx.accounts.lottery_round,
        ctx.accounts.lottery_ticket.ticket_number,
        &round_info, &ctx.accounts.winner.to_account_info(), min_rent,
    )?;

    emit!(LotteryClaimed {
        round_id: ctx.accounts.lottery_round.round_id,
        winner: ctx.accounts.winner.key(),
        amount: payout,
    });
    Ok(())
}

/// Close a settled, empty round: its prize was claimed, or (undrawn) every
/// ticket was refunded after the timeout. Only the rent is left and it goes
/// to the treasury that paid for the round. Player money never does.
pub fn refund_round_handler(ctx: Context<RefundLotteryRound>, _round_id: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round = &ctx.accounts.round;
    require!(round.pool_lamports == 0, AofError::LotteryRoundNotEmpty);
    require!(!round.draw_committed || round.drawn, AofError::LotteryDrawAlreadyCommitted);
    let settled = if round.drawn {
        round.claimed
    } else {
        now >= round.created_at.saturating_add(LOTTERY_ROUND_TIMEOUT_SECONDS)
    };
    require!(settled, AofError::LotteryRoundNotExpired);

    emit!(LotteryRoundRefunded {
        round_id: round.round_id,
        lamports: ctx.accounts.round.to_account_info().lamports(),
        tickets_sold: round.tickets_sold,
        at: now,
    });
    // `close = treasury` moves the remaining rent after this handler returns.
    Ok(())
}

/// Shared by the handler and host account tests. An underfunded prize is a
/// liability, not a smaller prize: NEVER consume claimed on partial payment.
fn settle_prize<'info>(
    round: &mut crate::state::LotteryRound, ticket_number: u64,
    source: &AccountInfo<'info>, winner: &AccountInfo<'info>, min_rent: u64,
) -> Result<u64> {
    require!(round.drawn, AofError::LotteryNotDrawn);
    require!(!round.claimed, AofError::LotteryRoundClosed);
    require!(ticket_number == round.winning_ticket, AofError::NotWinningTicket);
    let amount = round.pool_lamports;
    require!(amount > 0, AofError::VaultInsufficient);
    crate::economics::transfer_owned_lamports(source, winner, amount, min_rent)?;
    round.claimed = true;
    // The escrow is empty now; `refund_lottery_round` may close the round.
    round.pool_lamports = 0;
    Ok(amount)
}

#[cfg(test)]
mod settlement_tests {
    use super::*;
    use crate::state::LotteryRound;

    fn round() -> LotteryRound {
        LotteryRound { round_id: 1, pool_lamports: 100, tickets_sold: 2, seed_slot: 10,
            drawn: true, winning_ticket: 1, claimed: false, bump: 0, created_at: 0,
            draw_committed: true, draw_commit_slot: 9, randomness: Pubkey::default() }
    }

    #[test]
    fn full_prize_or_no_mutation_and_no_second_claim() {
        let source_key = Pubkey::new_unique(); let winner_key = Pubkey::new_unique();
        let system = anchor_lang::system_program::ID; let owner = crate::ID;
        let mut source_balance = 109; let mut winner_balance = 7;
        let mut source_data = []; let mut winner_data = [];
        let source = AccountInfo::new(&source_key, false, true, &mut source_balance, &mut source_data, &owner, false, 0);
        let winner = AccountInfo::new(&winner_key, true, true, &mut winner_balance, &mut winner_data, &system, false, 0);
        let mut state = round();
        // Old code paid 99 and permanently marked the 100-unit prize claimed.
        assert!(settle_prize(&mut state, 1, &source, &winner, 10).is_err());
        assert!(!state.claimed);
        assert_eq!((source.lamports(), winner.lamports()), (109, 7));
        **source.try_borrow_mut_lamports().unwrap() = 110; // fixture replenishment
        assert!(settle_prize(&mut state, 0, &source, &winner, 10).is_err());
        assert!(!state.claimed);
        state.drawn = false;
        assert!(settle_prize(&mut state, 1, &source, &winner, 10).is_err());
        state.drawn = true;
        assert_eq!(settle_prize(&mut state, 1, &source, &winner, 10).unwrap(), 100);
        for _ in 0..100 {
            assert!(settle_prize(&mut state, 1, &source, &winner, 10).is_err());
            assert_eq!((source.lamports(), winner.lamports()), (10, 107));
        }
        assert!(state.claimed);
    }

    #[test]
    fn receiver_overflow_and_zero_prize_do_not_consume_claim() {
        let source_key = Pubkey::new_unique(); let winner_key = Pubkey::new_unique();
        let system = anchor_lang::system_program::ID; let owner = crate::ID;
        let mut source_balance = 110; let mut winner_balance = u64::MAX;
        let mut source_data = []; let mut winner_data = [];
        let source = AccountInfo::new(&source_key, false, true, &mut source_balance, &mut source_data, &owner, false, 0);
        let winner = AccountInfo::new(&winner_key, true, true, &mut winner_balance, &mut winner_data, &system, false, 0);
        let mut state = round();
        assert!(settle_prize(&mut state, 1, &source, &winner, 10).is_err());
        assert!(!state.claimed);
        state.pool_lamports = 0;
        assert!(settle_prize(&mut state, 1, &source, &winner, 10).is_err());
        assert!(!state.claimed);
        assert_eq!((source.lamports(), winner.lamports()), (110, u64::MAX));
    }
}
