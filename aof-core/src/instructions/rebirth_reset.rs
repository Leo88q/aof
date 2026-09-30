use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::state::*;
use crate::ResetForRebirth;

/// [§3.4] Полный сброс перерождения — одна инструкция, а не три:
///
/// 1. обнуляет прогресс игрока (`villagers`, `villagers_available`, `has_tent`);
/// 2. обнуляет сезонный пропуск (`xp`, `claimed_bitmap`, `premium`);
/// 3. сжигает ВЕСЬ остаток каждого ресурсного аккаунта, переданного
///    бэкендом в `remaining_accounts` парами `(mint, token_account)`.
///
/// Почему это безопасно как «всё или ничего»:
/// * любые ошибки — неканонический минт, чужой владелец, не-ATA аккаунт,
///   отсутствующий аккаунт, превышение лимита — роняют всю инструкцию, и
///   тогда не сбрасывается ничего;
/// * инструкция требует подпись `config.operator`, то есть бэкенда: только
///   он видит полный список ресурсных аккаунтов игрока, поэтому игрок не
///   может вручную собрать транзакцию с частичным списком и оставить себе
///   излишки;
/// * `aof_rebirth::do_rebirth` (permanent bonus) в той же транзакции тоже
///   требует подписи authority, так что «отдельно бонус без сброса» не
///   существует.
pub fn handler(ctx: Context<ResetForRebirth>, season_id: u32) -> Result<()> {
    let player = &mut ctx.accounts.player;
    let xp_before = ctx.accounts.season_pass.xp;
    let has_tent_before = player.has_tent;

    // --- 1. Прогресс деревни -------------------------------------------------
    player.villagers = 0;
    player.villagers_available = 0;
    player.has_tent = false;

    // --- 2. Сезонный пропуск -------------------------------------------------
    // Перки `historian_count`/`medallion_count` не трогаем: это застейканные
    // коллекционные NFT, а не прогресс. Их счётчик обязан совпадать с числом
    // застейканных экземпляров, иначе `collector_unstake` сломал бы инвариант.
    let pass = &mut ctx.accounts.season_pass;
    pass.xp = 0;
    pass.claimed_bitmap = 0;
    pass.premium = false;

    // --- 3. Излишки ресурсов -------------------------------------------------
    let pairs = ctx.remaining_accounts;
    require!(pairs.len() % 2 == 0, AofError::InvalidAmount);
    let pair_count = pairs.len() / 2;
    require!(
        pair_count <= REBIRTH_RESET_MAX_RESOURCE_ACCOUNTS,
        AofError::RebirthBurnLimitExceeded
    );

    let mut burned_accounts: u16 = 0;
    let mut burned_atoms: u64 = 0;
    for pair in pairs.chunks(2) {
        let mint_info = &pair[0];
        let token_info = &pair[1];
        // Область видимости: `Account<T>` держит заимствование данных
        // аккаунта, а CPI `burn` пишет в них же. Без этого Anchor падает на
        // "already borrowed".
        let amount = {
            let mint = Account::<Mint>::try_from(mint_info)?;
            let token = Account::<TokenAccount>::try_from(token_info)?;
            require!(
                ctx.accounts
                    .config
                    .is_resource_mint(&ctx.accounts.material_mints, &mint.key()),
                AofError::InvalidResourceKind
            );
            require!(token.owner == ctx.accounts.user.key(), AofError::Unauthorized);
            require!(token.mint == mint.key(), AofError::InvalidResourceKind);
            require!(
                is_canonical_ata(&token_info.key(), &token.owner, &token.mint),
                AofError::NonCanonicalTokenAccount
            );
            require!(token.amount > 0, AofError::ZeroAmount);
            token.amount
        };
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: mint_info.clone(),
                    from: token_info.clone(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;
        burned_accounts = burned_accounts
            .checked_add(1)
            .ok_or(AofError::MathOverflow)?;
        burned_atoms = burned_atoms.checked_add(amount).ok_or(AofError::MathOverflow)?;
    }

    emit!(RebirthReset {
        user: ctx.accounts.user.key(),
        season_id,
        xp_before,
        has_tent_before,
        burned_accounts,
        burned_atoms,
    });
    Ok(())
}
