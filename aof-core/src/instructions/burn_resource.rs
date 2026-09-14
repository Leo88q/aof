use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Burn};
use crate::constants::*;
use crate::state::*;
use crate::BurnResource;
use crate::errors::*;
use crate::ResourceKind;

fn mint_for_kind(config: &Config, material_mints: &MaterialMints, kind: &ResourceKind) -> Pubkey {
    match kind {
        // Старые ресурсы из Config
        ResourceKind::Food => config.food_mint,
        ResourceKind::Wood => config.wood_mint,
        ResourceKind::Stone => config.stone_mint,
        // [БЛОК L] Новые ресурсы из MaterialMints
        ResourceKind::Seeds => material_mints.seeds,
        ResourceKind::Wheat => material_mints.wheat,
        ResourceKind::Flour => material_mints.flour,
        ResourceKind::Bread => material_mints.bread,
        ResourceKind::Water => material_mints.water,
        ResourceKind::Coal => material_mints.coal,
        ResourceKind::Meat => material_mints.meat,
        ResourceKind::StoneBlue => material_mints.stone_blue,
        ResourceKind::StonePurple => material_mints.stone_purple,
        ResourceKind::StoneRed => material_mints.stone_red,
        ResourceKind::SandWhite => material_mints.sand_white,
        ResourceKind::SandPink => material_mints.sand_pink,
        ResourceKind::SandYellow => material_mints.sand_yellow,
        ResourceKind::GemBlue => material_mints.gem_blue,
        ResourceKind::GemOrange => material_mints.gem_orange,
        ResourceKind::GemWhite => material_mints.gem_white,
        ResourceKind::GemGreen => material_mints.gem_green,
        ResourceKind::FlaskBlue => material_mints.flask_blue,
        ResourceKind::FlaskYellow => material_mints.flask_yellow,
        ResourceKind::FlaskGreen => material_mints.flask_green,
        ResourceKind::FlaskPink => material_mints.flask_pink,
        ResourceKind::FlaskPurple => material_mints.flask_purple,
        ResourceKind::LoveHeart => material_mints.love_heart,
        ResourceKind::Potato => config.potato_mint,
    }
}

pub fn handler(ctx: Context<BurnResource>, kind: ResourceKind, amount: u64) -> Result<()> {
    require!(amount > 0, AofError::ZeroAmount);
    let expected = mint_for_kind(&ctx.accounts.config, &*ctx.accounts.material_mints, &kind);
    require!(ctx.accounts.mint.key() == expected, AofError::InvalidResourceKind);
    require!(
        ctx.accounts.token_account.amount >= amount,
        AofError::InsufficientBalance
    );
    let cpi_accounts = Burn {
        mint: ctx.accounts.mint.to_account_info(),
        from: ctx.accounts.token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::burn(cpi_ctx, amount)?;
    Ok(())
}
