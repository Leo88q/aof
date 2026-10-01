use anchor_lang::prelude::*;
use crate::SetResourceMints;
use crate::errors::AofError;
use crate::events::ResourceMintsUpdated;

/// Устанавливает 6 ресурсных минтов в Config:
/// food, wood, stone, seeds, water, potato (POTATO — внешний токен коллаборации)
pub fn handler(
    ctx: Context<SetResourceMints>,
    data_mint: Pubkey,
    circuit_mint: Pubkey,
    silicon_mint: Pubkey,
    neuron_mint: Pubkey,
    power_mint: Pubkey,
    mind_mint: Pubkey,
) -> Result<()> {
    let mints = [data_mint, circuit_mint, silicon_mint, neuron_mint, power_mint, mind_mint];
    for (index, mint) in mints.iter().enumerate() {
        require!(*mint != Pubkey::default(), AofError::InvalidMint);
        require!(
            !mints[..index].iter().any(|previous| previous == mint),
            AofError::InvalidMint,
        );
    }

    let cfg = &mut ctx.accounts.config;
    let previous = [cfg.data_mint, cfg.circuit_mint, cfg.silicon_mint, cfg.neuron_mint, cfg.power_mint, cfg.mind_mint];
    cfg.data_mint = data_mint;
    cfg.circuit_mint = circuit_mint;
    cfg.silicon_mint = silicon_mint;
    cfg.neuron_mint = neuron_mint;
    cfg.power_mint = power_mint;
    cfg.mind_mint = mind_mint;
    emit!(ResourceMintsUpdated { previous, current: mints, authority: ctx.accounts.authority.key(), slot: Clock::get()?.slot });
    Ok(())
}
