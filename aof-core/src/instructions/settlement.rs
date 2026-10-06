//! [F-06] Shared pieces of VRF settlements (tool NFT issuance, escrow release).
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::metadata::mpl_token_metadata::{
    instructions::{
        CreateMasterEditionV3,
        CreateMasterEditionV3InstructionArgs,
        CreateMetadataAccountV3,
        CreateMetadataAccountV3InstructionArgs,
    },
    types::DataV2,
};
use anchor_spl::token::{self, MintTo};
use crate::constants::*;
use crate::errors::AofError;
use crate::randomness::weighted_pick;
use crate::state::{canonical_tool_type, Rarity, ToolData, ToolMetadataRegistry, TOOL_KINDS};
use crate::vrf;

/// Rarity (by the commit's odds snapshot) and tool type of a tool-producing
/// settlement. Lane 0 drives the rarity, lane 1 the type: independent draws.
pub fn roll_tool(value: &[u8; 32], tag: &[u8], commit: &Pubkey, odds_bps: &[u16; 5]) -> Result<(Rarity, String)> {
    let roll = vrf::derive_roll(value, tag, commit.as_ref());
    let rarity_idx = weighted_pick(vrf::bps(vrf::lane(&roll, 0)), odds_bps);
    let rarity = Rarity::from_u8(rarity_idx as u8).ok_or(AofError::MathOverflow)?;
    let type_idx = vrf::below(vrf::lane(&roll, 1), PACK_TOOL_TYPES.len() as u64) as usize;
    Ok((rarity, PACK_TOOL_TYPES[type_idx].to_string()))
}

/// Mint one non-fungible tool token and create immutable Metaplex metadata and
/// its Master Edition. `Some(0)` prevents printing child editions, making this
/// a standard unique NFT rather than an SPL token with metadata only.
pub fn mint_tool_nft<'info>(
    token_program: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    auth: &AccountInfo<'info>,
    auth_bump: u8,
    metadata: &AccountInfo<'info>,
    master_edition: &AccountInfo<'info>,
    token_metadata_program: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    registry: &ToolMetadataRegistry,
    tool_type: &str,
    rarity: Rarity,
) -> Result<()> {
    let canonical_type = canonical_tool_type(tool_type).ok_or(AofError::InvalidToolType)?;
    let name = tool_display_name(canonical_type)?;
    let uri = registry.metadata_uri(canonical_type, rarity)?;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];

    token::mint_to(
        CpiContext::new_with_signer(
            token_program.clone(),
            MintTo {
                mint: mint.clone(),
                to: to.clone(),
                authority: auth.clone(),
            },
            signer_seeds,
        ),
        1,
    )?;

    let metadata_ix = CreateMetadataAccountV3 {
        metadata: *metadata.key,
        mint: *mint.key,
        mint_authority: *auth.key,
        payer: *payer.key,
        update_authority: (*auth.key, true),
        system_program: *system_program.key,
        // Rent is optional in the current Metaplex instruction interface; the
        // program obtains the sysvar through the runtime, avoiding an extra
        // packet account on every tool issuance.
        rent: None,
    }
    .instruction(CreateMetadataAccountV3InstructionArgs {
        data: DataV2 {
            name: name.to_string(),
            // No tool-NFT symbol has been approved; keep this empty, matching
            // the existing canonical JSON contract rather than inventing one.
            symbol: String::new(),
            uri: uri.to_string(),
            seller_fee_basis_points: registry.seller_fee_basis_points,
            creators: None,
            collection: None,
            uses: None,
        },
        is_mutable: false,
        collection_details: None,
    });
    invoke_signed(
        &metadata_ix,
        &[
            metadata.clone(),
            mint.clone(),
            auth.clone(),
            payer.clone(),
            auth.clone(),
            system_program.clone(),
            token_metadata_program.clone(),
        ],
        signer_seeds,
    )?;

    let master_edition_ix = CreateMasterEditionV3 {
        edition: *master_edition.key,
        mint: *mint.key,
        update_authority: *auth.key,
        mint_authority: *auth.key,
        payer: *payer.key,
        metadata: *metadata.key,
        token_program: *token_program.key,
        system_program: *system_program.key,
        rent: None,
    }
    .instruction(CreateMasterEditionV3InstructionArgs {
        max_supply: Some(0),
    });
    invoke_signed(
        &master_edition_ix,
        &[
            master_edition.clone(),
            mint.clone(),
            auth.clone(),
            auth.clone(),
            payer.clone(),
            metadata.clone(),
            token_program.clone(),
            system_program.clone(),
            token_metadata_program.clone(),
        ],
        signer_seeds,
    )?;
    Ok(())
}

fn tool_display_name(tool_type: &str) -> Result<&'static str> {
    let index = TOOL_KINDS
        .iter()
        .position(|kind| *kind == tool_type)
        .ok_or(AofError::InvalidToolType)?;
    Ok([
        "Plasma Cutter",
        "Silicon Extractor",
        "Data Harvester",
        "Quantum Transmitter",
        "Neural Seeder",
    ][index])
}

pub fn write_tool(td: &mut ToolData, mint: Pubkey, owner: Pubkey, tool_type: String, rarity: Rarity, durability: u8) {
    td.mint = mint;
    td.owner = owner;
    td.tool_type = tool_type;
    td.rarity = rarity;
    td.durability = durability;
    td.is_mining = false;
    td.mining_end = 0;
    td.staked = false;
    td.unlock_at = 0;
    td.last_mined_hours = 0;
    td.operator = owner;
}

/// Move `amount` escrowed lamports off a commit PDA of this program, keeping
/// the PDA rent-exempt until Anchor's `close` hands the rest to the user.
pub fn release_escrow<'info>(commit: &AccountInfo<'info>, to: &AccountInfo<'info>, amount: u64) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let reserve = Rent::get()?.minimum_balance(commit.data_len());
    crate::economics::transfer_owned_lamports(commit, to, amount, reserve)
}

/// Reimburse only the exact rent paid by the cranker for the minted account
/// set, using post-CPI account lengths and never exceeding the user's deposit.
pub fn reimburse_settler<'info>(
    commit: &AccountInfo<'info>,
    settler: &AccountInfo<'info>,
    deposit: u64,
    mint: &AccountInfo<'info>,
    token_account: &AccountInfo<'info>,
    tool_data: &AccountInfo<'info>,
    metadata: &AccountInfo<'info>,
    master_edition: &AccountInfo<'info>,
) -> Result<u64> {
    let rent = Rent::get()?;
    let account_infos = [mint, token_account, tool_data, metadata, master_edition];
    let mut fronted = 0u64;
    for account in account_infos {
        fronted = fronted
            .checked_add(rent.minimum_balance(account.data_len()))
            .ok_or(AofError::MathOverflow)?;
    }
    let amount = deposit.min(fronted);
    release_escrow(commit, settler, amount)?;
    Ok(amount)
}
