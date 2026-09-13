use anchor_lang::prelude::*;
use crate::CollectMining;
use crate::errors::*;

/// [РАСШИРЕНО]: житель, занятый в start_mining, освобождается при сборе.
/// Фактическая выдача ресурсов игроку по-прежнему происходит отдельным
/// вызовом pay_out от authority (сервер считает доход офчейн и переводит
/// из vault) — эта инструкция только закрывает on-chain состояние сессии.
pub fn handler(ctx: Context<CollectMining>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(now >= ctx.accounts.tool.mining_end, AofError::MiningNotComplete);

    let hours = ctx.accounts.tool.last_mined_hours;
    ctx.accounts.tool.durability = ctx
        .accounts
        .tool
        .durability
        .checked_sub(hours)
        .ok_or(AofError::InsufficientDurability)?;
    ctx.accounts.tool.is_mining = false;
    ctx.accounts.tool.mining_end = 0;

    let player = &mut ctx.accounts.player;
    player.villagers_available = player
        .villagers_available
        .saturating_add(1)
        .min(player.villagers);
    Ok(())
}
