use anchor_lang::prelude::*;

use crate::{
    constants::*,
    state::ToolMetadataRegistry,
    AofError,
};

/// Configure a slice of the fixed 25-entry tool URI table. `freeze = true` is
/// accepted only once every slot is present and the URIs are all distinct;
/// issuance paths reject the registry until that irreversible freeze occurs.
pub fn set_tool_metadata_uris_handler(
    ctx: Context<SetToolMetadataUris>,
    start_index: u8,
    metadata_uris: Vec<String>,
    seller_fee_basis_points: u16,
    freeze: bool,
) -> Result<()> {
    let start = start_index as usize;
    require!(
        !metadata_uris.is_empty() && metadata_uris.len() <= TOOL_METADATA_URI_BATCH_MAX,
        AofError::InvalidToolMetadataUris
    );
    require!(
        start
            .checked_add(metadata_uris.len())
            .is_some_and(|end| end <= TOOL_METADATA_URI_COUNT),
        AofError::InvalidToolMetadataUris
    );
    require!(
        seller_fee_basis_points <= 10_000,
        AofError::InvalidSellerFeeBasisPoints
    );
    for uri in &metadata_uris {
        require!(is_arweave_metadata_uri(uri), AofError::InvalidToolMetadataUris);
    }

    let authority = ctx.accounts.authority.key();
    let registry = &mut ctx.accounts.tool_metadata_registry;
    require!(!registry.frozen, AofError::ToolMetadataRegistryFrozen);

    if !registry.initialized {
        registry.authority = authority;
        registry.initialized = true;
        registry.frozen = false;
        registry.populated_mask = 0;
        registry.seller_fee_basis_points = seller_fee_basis_points;
        registry.bump = ctx.bumps.tool_metadata_registry;
        registry.metadata_uris = vec![String::new(); TOOL_METADATA_URI_COUNT];
    } else {
        require!(
            registry.seller_fee_basis_points == seller_fee_basis_points,
            AofError::InvalidSellerFeeBasisPoints
        );
        // Allow an authority rotation between batches while still requiring
        // the current Config authority for every update.
        registry.authority = authority;
    }

    for (offset, uri) in metadata_uris.into_iter().enumerate() {
        let index = start + offset;
        registry.metadata_uris[index] = uri;
        registry.populated_mask |= 1u32 << index;
    }

    if freeze {
        require!(
            registry.populated_mask == TOOL_METADATA_COMPLETE_MASK,
            AofError::InvalidToolMetadataRegistry
        );
        for left in 0..TOOL_METADATA_URI_COUNT {
            for right in (left + 1)..TOOL_METADATA_URI_COUNT {
                require!(
                    registry.metadata_uris[left] != registry.metadata_uris[right],
                    AofError::InvalidToolMetadataUris
                );
            }
        }
        registry.frozen = true;
    }

    Ok(())
}

fn is_arweave_metadata_uri(uri: &str) -> bool {
    const PREFIX: &str = "https://arweave.net/";
    let Some(transaction_id) = uri.strip_prefix(PREFIX) else {
        return false;
    };
    transaction_id.len() == 43
        && transaction_id.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_'
        })
        && uri.len() <= TOOL_METADATA_URI_MAX_LEN
}

#[derive(Accounts)]
pub struct SetToolMetadataUris<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority)]
    pub config: Account<'info, crate::state::Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + ToolMetadataRegistry::INIT_SPACE,
        seeds = [TOOL_METADATA_REGISTRY_SEED],
        bump
    )]
    pub tool_metadata_registry: Account<'info, ToolMetadataRegistry>,
    pub system_program: Program<'info, System>,
}
