use anchor_lang::prelude::*;
use crate::constants::DEFAULT_VILLAGERS;
use crate::InitPlayer;

/// Initialize a Player profile with the player's own signer as both authority
/// and rent payer. No other instruction silently creates this account.
pub fn init_player_handler(ctx: Context<InitPlayer>) -> Result<()> {
    let player = &mut ctx.accounts.player_profile;
    player.owner = ctx.accounts.player.key();
    player.cooldown_until = 0;
    player.has_tent = false;
    player.villagers = DEFAULT_VILLAGERS;
    player.villagers_available = DEFAULT_VILLAGERS;
    player.historian_count = 0;
    player.medallion_count = 0;
    Ok(())
}
