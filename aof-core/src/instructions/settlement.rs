//! [F-06] Shared pieces of VRF settlements (tool NFT issuance, escrow release).
use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo};
use crate::constants::*;
use crate::errors::AofError;
use crate::randomness::weighted_pick;
use crate::state::{Rarity, ToolData};
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

/// Mint the single unit of a freshly created tool NFT (the mint was created
/// in this instruction with the auth PDA as mint authority).
pub fn mint_tool_nft<'info>(
    token_program: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    auth: &AccountInfo<'info>,
    auth_bump: u8,
) -> Result<()> {
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    token::mint_to(
        CpiContext::new_with_signer(
            token_program.clone(),
            MintTo { mint: mint.clone(), to: to.clone(), authority: auth.clone() },
            signer_seeds,
        ),
        1,
    )
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

/// Pay the settler back the rent it fronted for the NFT accounts, never more
/// than the player prepaid. Any unused deposit stays on the commit and goes
/// back to the player with the commit's rent.
pub fn reimburse_settler<'info>(commit: &AccountInfo<'info>, settler: &AccountInfo<'info>, deposit: u64) -> Result<u64> {
    let fronted = vrf::tool_settlement_rent(&Rent::get()?);
    let amount = deposit.min(fronted);
    release_escrow(commit, settler, amount)?;
    Ok(amount)
}
