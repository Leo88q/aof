use anchor_lang::prelude::*;
use crate::SetResourceMints;
use crate::errors::AofError;

/// Устанавливает 6 ресурсных минтов в Config:
/// food, wood, stone, seeds, water, potato (POTATO — внешний токен коллаборации)
pub fn handler(
    ctx: Context<SetResourceMints>,
    food_mint: Pubkey,
    wood_mint: Pubkey,
    stone_mint: Pubkey,
    seeds_mint: Pubkey,
    water_mint: Pubkey,
    potato_mint: Pubkey,
) -> Result<()> {
    let mints = [food_mint, wood_mint, stone_mint, seeds_mint, water_mint, potato_mint];
    for (index, mint) in mints.iter().enumerate() {
        require!(*mint != Pubkey::default(), AofError::InvalidMint);
        require!(
            !mints[..index].iter().any(|previous| previous == mint),
            AofError::InvalidMint,
        );
    }

    let cfg = &mut ctx.accounts.config;
    cfg.food_mint = food_mint;
    cfg.wood_mint = wood_mint;
    cfg.stone_mint = stone_mint;
    cfg.seeds_mint = seeds_mint;
    cfg.water_mint = water_mint;
    cfg.potato_mint = potato_mint;
    Ok(())
}
