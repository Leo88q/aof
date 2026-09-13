use anchor_lang::prelude::*;
use crate::AdjustPlayerCapacity;
use crate::errors::*;

/// [ФАКТ, по вашему уточнению]: slots/boost палатки живут в Firestore
/// (craft_cost_tools/{tent}_{rarity}) — «on-chain буст не нужен». Но сама
/// `Player.villagers_available`, которую проверяет start_mining, должна
/// оставаться корректной, когда палатка застейкана/анстейкана. Эта
/// инструкция — authority-only (сервер уже прочитал Firestore-конфиг,
/// знает slots, и co-signed вызывает этот перевод), она НЕ содержит
/// экономических значений сама по себе — только безопасно двигает счётчик
/// по команде сервера, который остаётся источником правды по числам.
pub fn handler(ctx: Context<AdjustPlayerCapacity>, delta: i32, has_tent: bool) -> Result<()> {
    let player = &mut ctx.accounts.player;
    if delta >= 0 {
        let d = delta as u32;
        player.villagers = player.villagers.checked_add(d).ok_or(AofError::MathOverflow)?;
        player.villagers_available = player
            .villagers_available
            .checked_add(d)
            .ok_or(AofError::MathOverflow)?;
    } else {
        let d = delta.unsigned_abs();
        player.villagers = player.villagers.checked_sub(d).ok_or(AofError::MathOverflow)?;
        // не уводим доступных ниже нуля, даже если все жители сейчас заняты
        player.villagers_available = player.villagers_available.saturating_sub(d);
    }
    player.has_tent = has_tent;
    Ok(())
}
