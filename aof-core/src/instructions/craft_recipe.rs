use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Burn, MintTo};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::CraftRecipe;
use crate::ResourceKind;

/// [БЛОК L] Универсальный мгновенный крафт гемов/баночек.
/// recipe_id: 0-17 (см. таблицу рецептов)
pub fn handler(ctx: Context<CraftRecipe>, recipe_id: u8) -> Result<()> {
    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    // Bound before the macros below: `macro_rules!` is hygienic for locals, so
    // these bindings have to exist at the macro *definition* site.
    let mm = &*ctx.accounts.material_mints;
    let cfg = &*ctx.accounts.config;

    // Макрос для burn одного входа
    macro_rules! burn_in {
        ($mint:expr, $acc:expr, $amt:expr) => {
            require!($acc.amount >= $amt, AofError::InsufficientBalance);
            token::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: $mint.to_account_info(),
                        from: $acc.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                $amt,
            )?;
        };
    }

    // Макрос для mint выхода.
    //
    // [AUDIT F-03] `$kind` lets the macro charge the global supply ceiling and
    // re-check the canonical mint before emitting. Without it this path minted
    // gems and flasks with no bound at all.
    macro_rules! mint_out {
        ($mint:expr, $acc:expr, $amt:expr, $kind:expr) => {
            require!(
                $mint.key() == mint_for_kind(cfg, mm, &$kind),
                AofError::MaterialNotRegistered
            );
            check_supply_cap(mm, &mut ctx.accounts.issuance_cap, $kind, $amt)?;
            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: $mint.to_account_info(),
                        to: $acc.to_account_info(),
                        authority: ctx.accounts.auth.to_account_info(),
                    },
                    signer_seeds,
                ),
                $amt,
            )?;
        };
    }

    match recipe_id {
        // 0 = QuantumBit: 1 BlueCore → 1 QuantumBit
        0 => {
            require!(ctx.accounts.input_1_mint.key() == mm.blue_core, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 1 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::QuantumBit);
        }
        // 1 = NeuralChip: 1 RedCore → 1 NeuralChip
        1 => {
            require!(ctx.accounts.input_1_mint.key() == mm.red_core, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 1 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::NeuralChip);
        }
        // 2 = PhotonBit: 1 ClearQuartz → 1 PhotonBit
        2 => {
            require!(ctx.accounts.input_1_mint.key() == mm.clear_quartz, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 1 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::PhotonBit);
        }
        // 3 = CryoFluid: 2 QuantumBit + 5 Data → 1
        3 => {
            require!(ctx.accounts.input_1_mint.key() == mm.quantum_bit, AofError::MaterialNotRegistered);
            require!(ctx.accounts.input_2_mint.key() == cfg.data_mint, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 2 * RESOURCE_UNIT);
            burn_in!(ctx.accounts.input_2_mint, ctx.accounts.input_2_acc, 5 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::CryoFluid);
        }
        // 4 = VoltFluid: 2 NeuralChip + 3 Silicon → 1
        4 => {
            require!(ctx.accounts.input_1_mint.key() == mm.neural_chip, AofError::MaterialNotRegistered);
            require!(ctx.accounts.input_2_mint.key() == cfg.silicon_mint, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 2 * RESOURCE_UNIT);
            burn_in!(ctx.accounts.input_2_mint, ctx.accounts.input_2_acc, 3 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::VoltFluid);
        }
        // 5 = BioFluid: 5 Circuit + 5 Neuron → 1
        5 => {
            require!(ctx.accounts.input_1_mint.key() == cfg.circuit_mint, AofError::MaterialNotRegistered);
            require!(ctx.accounts.input_2_mint.key() == mm.neuron, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 5 * RESOURCE_UNIT);
            burn_in!(ctx.accounts.input_2_mint, ctx.accounts.input_2_acc, 5 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::BioFluid);
        }
        // 6 = NanoFluid: 3 RoseQuartz + 5 Data → 1
        6 => {
            require!(ctx.accounts.input_1_mint.key() == mm.rose_quartz, AofError::MaterialNotRegistered);
            require!(ctx.accounts.input_2_mint.key() == cfg.data_mint, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 3 * RESOURCE_UNIT);
            burn_in!(ctx.accounts.input_2_mint, ctx.accounts.input_2_acc, 5 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::NanoFluid);
        }
        // 7 = QuantumFluid: 1 PurpleCore + 1 BioChip → 1
        7 => {
            require!(ctx.accounts.input_1_mint.key() == mm.purple_core, AofError::MaterialNotRegistered);
            require!(ctx.accounts.input_2_mint.key() == mm.bio_chip, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 1 * RESOURCE_UNIT);
            burn_in!(ctx.accounts.input_2_mint, ctx.accounts.input_2_acc, 1 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::QuantumFluid);
        }
        // 8 = Data: 5 Dataset → 1 Data
        8 => {
            require!(ctx.accounts.input_1_mint.key() == mm.dataset, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 5 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::Data);
        }
        // 9 = BlueCore: 8 Circuit → 1 BlueCore
        9 => {
            require!(ctx.accounts.input_1_mint.key() == cfg.circuit_mint, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 8 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::BlueCore);
        }
        // 10 = RedCore: 8 Silicon → 1 RedCore
        10 => {
            require!(ctx.accounts.input_1_mint.key() == cfg.silicon_mint, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 8 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::RedCore);
        }
        // 11 = PurpleCore: 8 Neuron → 1 PurpleCore
        11 => {
            require!(ctx.accounts.input_1_mint.key() == mm.neuron, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 8 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::PurpleCore);
        }
        // 12 = ClearQuartz: 6 Circuit + 2 Dataset → 1 ClearQuartz
        12 => {
            require!(ctx.accounts.input_1_mint.key() == cfg.circuit_mint, AofError::MaterialNotRegistered);
            require!(ctx.accounts.input_2_mint.key() == mm.dataset, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 6 * RESOURCE_UNIT);
            burn_in!(ctx.accounts.input_2_mint, ctx.accounts.input_2_acc, 2 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::ClearQuartz);
        }
        // 13 = RoseQuartz: 4 Neuron + 2 Dataset → 1 RoseQuartz
        13 => {
            require!(ctx.accounts.input_1_mint.key() == mm.neuron, AofError::MaterialNotRegistered);
            require!(ctx.accounts.input_2_mint.key() == mm.dataset, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 4 * RESOURCE_UNIT);
            burn_in!(ctx.accounts.input_2_mint, ctx.accounts.input_2_acc, 2 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::RoseQuartz);
        }
        // 14 = BioChip: 4 Neuron + 4 Circuit → 1 BioChip
        14 => {
            require!(ctx.accounts.input_1_mint.key() == mm.neuron, AofError::MaterialNotRegistered);
            require!(ctx.accounts.input_2_mint.key() == cfg.circuit_mint, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 4 * RESOURCE_UNIT);
            burn_in!(ctx.accounts.input_2_mint, ctx.accounts.input_2_acc, 4 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::BioChip);
        }
        // 15 = AmberQuartz: 1 PhotonBit → 1 AmberQuartz
        15 => {
            require!(ctx.accounts.input_1_mint.key() == mm.photon_bit, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 1 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::AmberQuartz);
        }
        // 16 = Mind: 4 Dataset → 1 Mind
        16 => {
            require!(ctx.accounts.input_1_mint.key() == mm.dataset, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 4 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::Mind);
        }
        // 17 = Compute: 4 Circuit + 2 Dataset → 1 Compute
        17 => {
            require!(ctx.accounts.input_1_mint.key() == cfg.circuit_mint, AofError::MaterialNotRegistered);
            require!(ctx.accounts.input_2_mint.key() == mm.dataset, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 4 * RESOURCE_UNIT);
            burn_in!(ctx.accounts.input_2_mint, ctx.accounts.input_2_acc, 2 * RESOURCE_UNIT);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1 * RESOURCE_UNIT, ResourceKind::Compute);
        }
        _ => return Err(AofError::RecipeNotFound.into()),
    }

    Ok(())
}
