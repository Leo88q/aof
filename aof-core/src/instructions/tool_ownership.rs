//! Token-primary ownership: единственное авторитетное доказательство владения
//! инструментом — реальный supply-1 SPL-токен, а не запись в `ToolData`.
//!
//! ## Почему так
//!
//! Инструмент — обычный classic SPL-токен (decimals 0, supply 1). Любой держатель
//! может перевести его обычным `spl_token::transfer`, не обращаясь к программе:
//! программа не видит такие переводы и не может их запретить (freeze authority
//! намеренно отсутствует — её требуют девять проверок `freeze_authority.is_none()`
//! в `mint_tool`, `craft`, `reroll`, `marketplace_list`, `auction_create`,
//! `offer_create`, `offer_accept`, `rental_list`). Поэтому `ToolData.owner` —
//! **кэш**, который может отстать от фактического владельца токена.
//!
//! Правило: механика не может авторизовать ценное действие только по
//! `ToolData.owner`/`ToolData.operator`. Нужно доказательство одного из двух видов:
//!
//! * [`assert_idle_tool_ownership`] — подписант реально держит токен (idle-случай);
//! * [`assert_token_in_escrow`] — токен лежит в program-controlled escrow, а
//!   делегирование (например, активная аренда) подтверждено отдельной записью.
//!
//! Обычный SPL-перевод не создаёт второе авторитетное состояние: он лишь делает
//! кэш устаревшим. Новый держатель вызывает `sync_tool_owner` и восстанавливает
//! согласованность.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_option::COption;
use anchor_spl::token::{Mint, TokenAccount};

use crate::errors::AofError;
use crate::state::ToolData;

/// Единственная единица инструмента: supply-1, decimals 0.
pub const TOOL_TOKEN_AMOUNT: u64 = 1;

/// Каноническая форма инструментального mint.
///
/// Проверяется при каждом доказательстве владения, а не только при минте: mint
/// приходит в инструкцию аккаунтом, и без этой проверки чужой 0-decimal минт с
/// произвольным supply мог бы выдать себя за инструмент.
pub fn assert_canonical_tool_mint(mint: &Mint) -> Result<()> {
    require!(mint.decimals == 0, AofError::InvalidMint);
    require!(mint.supply == TOOL_TOKEN_AMOUNT, AofError::InvalidMint);
    require!(mint.freeze_authority == COption::None, AofError::InvalidMint);
    Ok(())
}

/// Доказательство «подписант реально держит инструмент».
///
/// Проверяет сам токен, а не кэш: mint совпадает с `ToolData.mint`, аккаунт
/// принадлежит подписанту и содержит ровно одну единицу, mint канонический.
/// Дополнительно требуется, чтобы инструмент был свободен: застейканный или
/// майнящий инструмент лежит в escrow, и «владение» им через личный ATA
/// невозможно по построению.
///
/// Кэш `ToolData.owner` здесь **не** сверяется: эта функция — как раз путь
/// восстановления после обычного SPL-перевода. Вызывающий код, которому нужна и
/// согласованность кэша, проверяет `tool.owner == signer` отдельно.
pub fn assert_idle_tool_ownership(
    tool: &ToolData,
    mint: &Mint,
    token: &TokenAccount,
    holder: &Pubkey,
) -> Result<()> {
    require_keys_eq!(mint.key(), tool.mint, AofError::InvalidMint);
    require_keys_eq!(token.mint, mint.key(), AofError::InvalidMint);
    require_keys_eq!(token.owner, *holder, AofError::NotToolOwner);
    require!(token.amount == TOOL_TOKEN_AMOUNT, AofError::ZeroAmount);
    assert_canonical_tool_mint(mint)?;
    require!(!tool.staked, AofError::AlreadyStaked);
    require!(!tool.is_mining, AofError::AlreadyMining);
    Ok(())
}

/// Доказательство «токен лежит в program-controlled escrow»: общий vault стейка
/// (`[VAULT_SEED]`) или vault конкретной записи (листинг/аукцион/аренда).
///
/// Так проверяются делегированные состояния: `ToolData.owner`/`operator` сами по
/// себе ничего не доказывают, потому что кэш может отставать. Простая формула
/// `token_account.owner == operator` здесь неверна: арендатор — operator, но
/// токеном не владеет; он получает право лишь на время активной записи аренды.
pub fn assert_token_in_escrow(
    tool: &ToolData,
    mint: &Mint,
    token: &TokenAccount,
    escrow: &Pubkey,
) -> Result<()> {
    require_keys_eq!(mint.key(), tool.mint, AofError::InvalidMint);
    require_keys_eq!(token.mint, mint.key(), AofError::InvalidMint);
    require_keys_eq!(token.owner, *escrow, AofError::NotToolOwner);
    require!(token.amount == TOOL_TOKEN_AMOUNT, AofError::ZeroAmount);
    assert_canonical_tool_mint(mint)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mint_with(decimals: u8, supply: u64, freeze: COption<Pubkey>) -> Mint {
        Mint {
            mint_authority: COption::None,
            supply,
            decimals,
            is_initialized: true,
            freeze_authority: freeze,
        }
    }

    #[test]
    fn canonical_mint_shape_is_enforced() {
        assert!(assert_canonical_tool_mint(&mint_with(0, 1, COption::None)).is_ok());
        assert!(assert_canonical_tool_mint(&mint_with(9, 1, COption::None)).is_err(), "decimals != 0");
        assert!(assert_canonical_tool_mint(&mint_with(0, 2, COption::None)).is_err(), "supply != 1");
        assert!(
            assert_canonical_tool_mint(&mint_with(0, 1, COption::Some(Pubkey::new_unique()))).is_err(),
            "freeze authority должна отсутствовать"
        );
    }
}
