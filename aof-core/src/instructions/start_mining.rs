use anchor_lang::prelude::*;
use crate::StartMining;
use crate::errors::*;
use crate::constants::DEFAULT_VILLAGERS;
use crate::instructions::tool_ownership::assert_token_in_escrow;

/// [НАХОДКА]: в присланном state.rs уже есть тип `Player` с полями
/// `villagers`/`villagers_available`/`has_tent` и константа PLAYER_SEED/
/// PLAYER_SPACE — но ни одна из присланных инструкций его не использовала.
/// Это ровно тот "гейт по жителям", который в реальной Ronin-версии
/// (villagers_available >= 1 в index.js, стартовое значение 6) держал
/// майнинг. Подключаю здесь: инструмент нельзя запустить без свободного
/// жителя, и требуемые часы теперь ограничены Rarity::max_hours().
pub fn handler(ctx: Context<StartMining>, hours: u8) -> Result<()> {
    // [AUDIT F-27] on-chain kill-switch (see collect_mining).
    require!(ctx.accounts.config.mining_enabled, AofError::MiningDisabled);
    require!(hours > 0, AofError::ZeroAmount);
    require!(hours <= ctx.accounts.tool.durability, AofError::InsufficientDurability);
    require!(
        hours <= ctx.accounts.tool.rarity.max_hours(),
        AofError::HoursExceedRarityCap
    );

    let player = &mut ctx.accounts.player;
    // init_if_needed: первый вызов создаёт профиль со стартовыми 6 жителями
    // ([ФАКТ] villagers_available: 6, villagers: 6 при создании юзера в index.js)
    if player.owner == Pubkey::default() {
        player.owner = ctx.accounts.user.key();
        player.villagers = DEFAULT_VILLAGERS;
        player.villagers_available = DEFAULT_VILLAGERS;
        player.has_tent = false;
        player.cooldown_until = 0;
    }
    require!(player.villagers_available > 0, AofError::NoIdleVillagers);

    // Token-primary ownership: инструмент можно запустить в майнинг только пока
    // его supply-1 токен реально лежит в программе. Флаг `tool.staked`, который
    // проверяет контекст, — это утверждение программы о себе; здесь проверяется
    // сам токен. Иначе достаточно было бы снять/перевести токен так, чтобы флаг
    // остался, и майнинг продолжился бы на инструменте, которого у эскроу нет.
    assert_token_in_escrow(
        &ctx.accounts.tool,
        &ctx.accounts.mint,
        &ctx.accounts.vault_token,
        &ctx.accounts.vault.key(),
    )?;

    player.villagers_available -= 1;

    let now = Clock::get()?.unix_timestamp;
    let speed = crate::instructions::collect_mining::enchant_slot_level(
        &ctx.accounts.mint.key(),
        crate::instructions::collect_mining::SPEED_ENCHANT_SLOT,
        &ctx.remaining_accounts,
    )?;
    let wait = crate::instructions::collect_mining::mining_wait_hours(hours, speed)?;
    ctx.accounts.tool.is_mining = true;
    ctx.accounts.tool.mining_end = now
        .checked_add((wait as i64) * 3600)
        .ok_or(AofError::MathOverflow)?;
    ctx.accounts.tool.last_mined_hours = hours;
    Ok(())
}
