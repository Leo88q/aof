use anchor_lang::prelude::*;
use crate::constants::*;
use crate::AdjustPlayerCapacity;
use crate::errors::*;
use crate::events::*;

/// [ФАКТ, по вашему уточнению]: slots/boost палатки живут в Firestore
/// (craft_cost_tools/{tent}_{rarity}) — «on-chain буст не нужен». Но сама
/// `Player.villagers_available`, которую проверяет start_mining, должна
/// оставаться корректной, когда палатка застейкана/анстейкана. Эта
/// инструкция — authority-only (сервер уже прочитал Firestore-конфиг,
/// знает slots, и co-signed вызывает этот перевод), она НЕ содержит
/// экономических значений сама по себе — только безопасно двигает счётчик
/// по команде сервера, который остаётся источником правды по числам.
///
/// [AUDIT F-15] `delta` was an unbounded `i32`, so a bug or a compromised
/// server key could set `villagers = 0` for any player and permanently brick
/// their mining (`start_mining` would always fail with NoIdleVillagers, and
/// only the same authority could undo it). Two brakes now apply: the step is
/// capped by `MAX_CAPACITY_DELTA`, and the new total can never drop below the
/// villagers that are currently busy — removing capacity has to wait for the
/// sessions to end. The change is also emitted with before/after values so a
/// bad call is visible instead of silent.
pub fn handler(ctx: Context<AdjustPlayerCapacity>, delta: i32, has_tent: bool) -> Result<()> {
    let player = &mut ctx.accounts.player;

    let magnitude = delta.unsigned_abs();
    require!(
        magnitude <= MAX_CAPACITY_DELTA,
        AofError::InvalidCapacityDelta
    );

    let previous_villagers = player.villagers;
    let busy = previous_villagers.saturating_sub(player.villagers_available);

    if delta >= 0 {
        let d = magnitude;
        player.villagers = player.villagers.checked_add(d).ok_or(AofError::MathOverflow)?;
        player.villagers_available = player
            .villagers_available
            .checked_add(d)
            .ok_or(AofError::MathOverflow)?;
    } else {
        let d = magnitude;
        // Never take capacity that is currently in use: sessions in flight are
        // tracked as `villagers - villagers_available`.
        require!(
            previous_villagers >= busy.saturating_add(d),
            AofError::InvalidCapacityDelta
        );
        player.villagers = player.villagers.checked_sub(d).ok_or(AofError::MathOverflow)?;
        player.villagers_available = player.villagers_available.saturating_sub(d);
    }
    player.has_tent = has_tent;

    emit!(PlayerCapacityChanged {
        player: player.owner,
        previous_villagers,
        next_villagers: player.villagers,
        delta,
        has_tent,
    });
    Ok(())
}
