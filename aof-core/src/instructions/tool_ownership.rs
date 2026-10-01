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
use crate::state::{RentalAgreement, RentalListing, ToolData};

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
/// Ядро проверки: голые структуры состояния и ключ минтинга параметром.
/// Так проверка живёт в unit-тестах (`cargo test`) без валидатора, а публичная
/// обёртка ниже принимает `Account` (у голого `Mint` нет `.key()`).
pub(crate) fn check_idle_tool_ownership(
    tool: &ToolData,
    mint_key: &Pubkey,
    mint: &Mint,
    token: &TokenAccount,
    holder: &Pubkey,
) -> Result<()> {
    require_keys_eq!(*mint_key, tool.mint, AofError::InvalidMint);
    require_keys_eq!(token.mint, *mint_key, AofError::InvalidMint);
    require_keys_eq!(token.owner, *holder, AofError::NotToolOwner);
    require!(token.amount == TOOL_TOKEN_AMOUNT, AofError::ZeroAmount);
    assert_canonical_tool_mint(mint)?;
    require!(!tool.staked, AofError::AlreadyStaked);
    require!(!tool.is_mining, AofError::AlreadyMining);
    Ok(())
}

pub fn assert_idle_tool_ownership<'info>(
    tool: &ToolData,
    mint: &Account<'info, Mint>,
    token: &Account<'info, TokenAccount>,
    holder: &Pubkey,
) -> Result<()> {
    check_idle_tool_ownership(tool, &mint.key(), mint, token, holder)
}

/// Доказательство «токен лежит в program-controlled escrow»: общий vault стейка
/// (`[VAULT_SEED]`) или vault конкретной записи (листинг/аукцион/аренда).
///
/// Так проверяются делегированные состояния: `ToolData.owner`/`operator` сами по
/// себе ничего не доказывают, потому что кэш может отставать. Простая формула
/// `token_account.owner == operator` здесь неверна: арендатор — operator, но
/// токеном не владеет; он получает право лишь на время активной записи аренды.
pub(crate) fn check_token_in_escrow(
    tool: &ToolData,
    mint_key: &Pubkey,
    mint: &Mint,
    token: &TokenAccount,
    escrow: &Pubkey,
) -> Result<()> {
    require_keys_eq!(*mint_key, tool.mint, AofError::InvalidMint);
    require_keys_eq!(token.mint, *mint_key, AofError::InvalidMint);
    require_keys_eq!(token.owner, *escrow, AofError::NotToolOwner);
    require!(token.amount == TOOL_TOKEN_AMOUNT, AofError::ZeroAmount);
    assert_canonical_tool_mint(mint)?;
    Ok(())
}

pub fn assert_token_in_escrow<'info>(
    tool: &ToolData,
    mint: &Account<'info, Mint>,
    token: &Account<'info, TokenAccount>,
    escrow: &Pubkey,
) -> Result<()> {
    check_token_in_escrow(tool, &mint.key(), mint, token, escrow)
}

/// Ядро делегирования по аренде. Единственная реализация проверки: обе
/// обёртки ниже вызывают именно её, чтобы у старта сессии и у сбора награды не
/// разошлись условия.
///
/// Проверяется вся цепочка, а не только подпись:
///
/// 1. записи относятся к этому же инструменту (`mint` совпадает у `ToolData`,
///    листинга и соглашения);
/// 2. подписант — арендатор из соглашения, он же текущий `operator`
///    инструмента (`token_account.owner == operator` для аренды неверно:
///    токен лежит в эскроу листинга, а не у арендатора);
/// 3. владелец в `ToolData` и в записях совпадает — соглашение не переживает
///    смену владельца инструмента;
/// 4. листинг активен, инструмент не в стейке (аренда и стейк взаимоисключающи);
/// 5. `require_unexpired`: срок аренды не истёк. Для старта сессии — да; для
///    сбора уже начатой сессии — нет, иначе награда за сессию, которая по
///    построению короче аренды, сгорала бы у арендатора из-за формальности.
pub(crate) fn check_rental_delegation(
    tool: &ToolData,
    mint_key: &Pubkey,
    listing: &RentalListing,
    agreement: &RentalAgreement,
    operator: &Pubkey,
    now: i64,
    require_unexpired: bool,
) -> Result<()> {
    require_keys_eq!(*mint_key, tool.mint, AofError::InvalidMint);
    require_keys_eq!(listing.mint, tool.mint, AofError::InvalidMint);
    require_keys_eq!(agreement.mint, tool.mint, AofError::InvalidMint);

    require_keys_eq!(agreement.renter, *operator, AofError::RentalDelegationMissing);
    require_keys_eq!(tool.operator, *operator, AofError::NotToolOperator);
    require_keys_eq!(tool.owner, agreement.owner, AofError::NotToolOwner);
    require_keys_eq!(listing.owner, agreement.owner, AofError::NotToolOwner);

    require!(listing.active, AofError::NotActive);
    require!(!tool.staked, AofError::AlreadyStaked);
    if require_unexpired {
        require!(now < agreement.end, AofError::RentalExpired);
    }
    Ok(())
}

/// Право арендатора начать сессию: аренда активна и ещё не истекла.
pub fn assert_active_rental_delegation<'info>(
    tool: &ToolData,
    mint: &Account<'info, Mint>,
    listing: &Account<'info, RentalListing>,
    agreement: &Account<'info, RentalAgreement>,
    operator: &Pubkey,
    now: i64,
) -> Result<()> {
    check_rental_delegation(tool, &mint.key(), listing, agreement, operator, now, true)
}

/// Право арендатора забрать уже начатую сессию: срок аренды мог истечь, но
/// сессия по построению (`mining_end <= agreement.end`) была начата внутри
/// аренды, а `operator` всё ещё арендатор — значит, это его сессия.
pub fn assert_rental_collect_right<'info>(
    tool: &ToolData,
    mint: &Account<'info, Mint>,
    listing: &Account<'info, RentalListing>,
    agreement: &Account<'info, RentalAgreement>,
    operator: &Pubkey,
    now: i64,
) -> Result<()> {
    check_rental_delegation(tool, &mint.key(), listing, agreement, operator, now, false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::Rarity;

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

    /// Фикстура «инструмент отдан в аренду»: токен лежит в эскроу листинга,
    /// `operator` — арендатор, владелец — владелец инструмента.
    struct Rental {
        tool: ToolData,
        mint_key: Pubkey,
        listing: RentalListing,
        agreement: RentalAgreement,
        owner: Pubkey,
        renter: Pubkey,
    }

    fn rental_fixture() -> Rental {
        let owner = Pubkey::new_unique();
        let renter = Pubkey::new_unique();
        let mint_key = Pubkey::new_unique();
        let tool = ToolData {
            mint: mint_key,
            owner,
            tool_type: "plasma_cutter".to_string(),
            rarity: Rarity::Common,
            durability: 20,
            is_mining: false,
            mining_end: 0,
            staked: false,
            unlock_at: 0,
            last_mined_hours: 0,
            operator: renter,
        };
        let listing = RentalListing {
            owner,
            mint: mint_key,
            owner_split_bps: 5_000,
            min_duration: 3_600,
            max_duration: 86_400,
            active: true,
            price_per_hour_lamports: 1_000,
        };
        let agreement = RentalAgreement {
            mint: mint_key,
            owner,
            renter,
            start: 1_000,
            end: 10_000,
            revoke_requested_at: 0,
        };
        Rental { tool, mint_key, listing, agreement, owner, renter }
    }

    #[test]
    fn rental_delegation_needs_the_registered_renter() {
        let f = rental_fixture();
        assert!(check_rental_delegation(
            &f.tool, &f.mint_key, &f.listing, &f.agreement, &f.renter, 2_000, true
        ).is_ok());
        let stranger = Pubkey::new_unique();
        assert!(
            check_rental_delegation(&f.tool, &f.mint_key, &f.listing, &f.agreement, &stranger, 2_000, true).is_err(),
            "посторонний не получает делегирование"
        );
    }

    #[test]
    fn rental_delegation_expires_but_a_started_session_can_be_collected() {
        let f = rental_fixture();
        assert!(
            check_rental_delegation(&f.tool, &f.mint_key, &f.listing, &f.agreement, &f.renter, 10_000, true).is_err(),
            "истёкшая аренда не даёт начать сессию"
        );
        assert!(
            check_rental_delegation(&f.tool, &f.mint_key, &f.listing, &f.agreement, &f.renter, 10_000, false).is_ok(),
            "начатую внутри аренды сессию можно собрать и после end"
        );
    }

    #[test]
    fn rental_delegation_dies_with_the_listing_and_the_owner() {
        let f = rental_fixture();
        let mut closed = f.listing;
        closed.active = false;
        assert!(
            check_rental_delegation(&f.tool, &f.mint_key, &closed, &f.agreement, &f.renter, 2_000, false).is_err(),
            "снятый с аренды листинг не даёт права"
        );

        let mut foreign_owner = f.agreement;
        foreign_owner.owner = Pubkey::new_unique();
        assert!(
            check_rental_delegation(&f.tool, &f.mint_key, &f.listing, &foreign_owner, &f.renter, 2_000, true).is_err(),
            "соглашение не переживает смену владельца"
        );

        let mut foreign_mint = f.tool;
        foreign_mint.mint = Pubkey::new_unique();
        assert!(
            check_rental_delegation(&foreign_mint, &f.mint_key, &f.listing, &f.agreement, &f.renter, 2_000, true).is_err(),
            "чужая запись о другом минте не делегирует этот инструмент"
        );
    }

    #[test]
    fn rental_delegation_rejects_staked_tools() {
        let mut f = rental_fixture();
        f.tool.staked = true;
        assert!(
            check_rental_delegation(&f.tool, &f.mint_key, &f.listing, &f.agreement, &f.renter, 2_000, true).is_err(),
            "стейк и аренда взаимоисключающи"
        );
    }
}
