//! `sync_tool_owner` — восстановление согласованности кэша `ToolData` с
//! фактическим держателем токена после обычного SPL-перевода.
//!
//! ## Зачем
//!
//! Инструмент — обычный classic SPL-токен, поэтому держатель может перевести его
//! `spl_token::transfer`, минуя программу. Программа такие переводы не видит:
//! токен меняет владельца, а `ToolData.owner`/`operator` остаются прежними, и
//! инструмент «замерзает» — новый держатель не может ни застейкать, ни продать,
//! ни переплавить его, потому что все эти пути сверяются с кэшем.
//!
//! `transfer_tool` остаётся предпочтительным путём (одна транзакция двигает и
//! токен, и кэш, и обязательства). `sync_tool_owner` — путь восстановления для
//! тех, кто уже воспользовался обычным переводом.
//!
//! ## Почему нужна подпись нового держателя
//!
//! Синхронизация меняет `operator`, то есть право майнить/чинить и получать
//! доход. Permissionless-keeper мог бы «синхронизировать» инструмент, который
//! сейчас в аренде или застейкан, и увести делегирование у законного оператора.
//! Поэтому подписывает именно новый держатель, и он обязан доказать владение
//! реальным токеном.
//!
//! ## Что не делает
//!
//! Не трогает `rarity`, `durability`, `mining_end`, `last_mined_hours`,
//! `unlock_at`; не выводит инструмент из escrow; не снимает блокировки. Если
//! токен лежит в escrow (стейк, аренда, листинг, аукцион), доказательство
//! владения не проходит по построению: эскроу-аккаунт принадлежит программе, а не
//! держателю, и `amount == 1` ищется на личном ATA. Так синхронизация не может
//! обойти активные обязательства.

use anchor_lang::prelude::*;

use crate::events::ToolOwnershipSynced;
use crate::instructions::tool_ownership::assert_idle_tool_ownership;
use crate::SyncToolOwner;

pub fn sync_handler(ctx: Context<SyncToolOwner>) -> Result<()> {
    let holder = ctx.accounts.holder.key();
    let tool = &mut ctx.accounts.tool;

    // Владение доказывает токен, а не запись в `ToolData`. Кэш здесь намеренно
    // НЕ сверяется с `holder`: расхождение кэша и есть то, что мы исправляем.
    assert_idle_tool_ownership(
        tool,
        &ctx.accounts.mint,
        &ctx.accounts.holder_token,
        &holder,
    )?;

    let previous_owner = tool.owner;
    let previous_operator = tool.operator;

    // `owner` — кто владеет инструментом; `operator` — кто вправе майнить/чинить.
    // Инструмент свободен (escrow-проверка выше гарантирует `!staked && !is_mining`),
    // поэтому активной аренды нет: арендный vault держал бы токен, и владение не
    // доказалось бы. Сбрасывать чужое делегирование не приходится.
    tool.owner = holder;
    tool.operator = holder;
    // Долг перед прежним владельцем не переносится: как и в `transfer_tool`,
    // оставшийся unlock_at не должен блокировать новому держателю разблокировку.
    tool.unlock_at = 0;

    emit!(ToolOwnershipSynced {
        mint: tool.mint,
        previous_owner,
        previous_operator,
        new_owner: holder,
        slot: Clock::get()?.slot,
    });
    Ok(())
}
