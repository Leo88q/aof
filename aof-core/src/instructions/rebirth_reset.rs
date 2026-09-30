use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{self, Burn};
use anchor_spl::token::spl_token::state::Account as TokenState;
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
///
/// Почему здесь не `Account<Mint>`/`Account<TokenAccount>`: Anchor строит
/// `Account<'info, T>` только из `&'info AccountInfo<'info>`, а
/// `Context::remaining_accounts` — это `&'c [AccountInfo<'info>]` с
/// независимым `'c`, и компилятор такое не пропускает. Поэтому аккаунты
/// проверяются явно (адрес ATA, программа-владелец, точная длина) и
/// распаковываются официальным `spl_token::state::Account::unpack`, а не
/// байтовыми смещениями. Порядок проверок важен: CPI сжигания идёт последним.
pub fn handler<'info>(
    // Явные лайфтаймы обязательны: `AccountInfo`/`Signer` инвариантны по
    // своему параметру, поэтому без общей `'info` у `ctx.accounts.*` и
    // `ctx.remaining_accounts` компилятор требует `'2: '1` и падает на
    // «lifetime may not live long enough» (официальная рекомендация Anchor).
    ctx: Context<'_, '_, '_, 'info, ResetForRebirth<'info>>,
    season_id: u32,
) -> Result<()> {
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

    let user_key = ctx.accounts.user.key();
    let mut burned_accounts: u16 = 0;
    let mut burned_atoms: u64 = 0;
    for pair in pairs.chunks(2) {
        let mint_info = &pair[0];
        let token_info = &pair[1];

        // (1) Минт обязан быть ресурсным минтом конфига — проверка по адресу,
        //     без доверия к содержимому аккаунта.
        require!(
            ctx.accounts
                .config
                .is_resource_mint(&ctx.accounts.material_mints, &mint_info.key()),
            AofError::InvalidResourceKind
        );

        // (2) Аккаунт принадлежит классическому Token program (не Token-2022 и
        //     не подделка) и имеет ровно длину SPL token account: только так
        //     официальный распаковщик читает именно `amount`.
        require_keys_eq!(
            *token_info.owner,
            anchor_spl::token::spl_token::ID,
            AofError::InvalidResourceKind
        );
        let (data_owner, data_mint, amount) = {
            // Область видимости: `try_borrow_data` держит заимствование данных
            // аккаунта, а CPI `burn` пишет в них же. Без этого Anchor падает на
            // "already borrowed".
            let data = token_info.try_borrow_data()?;
            require!(data.len() == TokenState::LEN, AofError::InvalidAmount);
            let state = TokenState::unpack(&data[..]).map_err(|_| AofError::InvalidAmount)?;
            (state.owner, state.mint, state.amount)
        };

        // (3) Данные обязаны подтвердить пару: владелец — игрок, минт — тот
        //     же, что передан рядом. Эти проверки идут раньше адресной, чтобы
        //     отказ называл конкретную причину («чужой», «не тот минт»), а не
        //     только «не тот адрес».
        require_keys_eq!(data_owner, user_key, AofError::Unauthorized);
        require_keys_eq!(data_mint, mint_info.key(), AofError::InvalidResourceKind);

        // (4) И только канонический ATA игрока: адрес выводится из
        //     (владелец, token program, минт), поэтому совпадение адресов
        //     доказывает и владельца токен-аккаунта, и его минт. Из-за этого
        //     «правильный владелец и минт, но счёт открыт вручную» тоже
        //     отвергается: сжигание не может уйти из не того места.
        require_keys_eq!(
            token_info.key(),
            get_associated_token_address(&user_key, &mint_info.key()),
            AofError::NonCanonicalTokenAccount
        );

        // (5) Сжигать нечего, если остаток нулевой. Проверка идёт последней из
        //     отказов, чтобы «пустой» счёт не подменял собой более точную
        //     причину (чужой, не тот минт, не ATA).
        require!(amount > 0, AofError::ZeroAmount);

        // (6) Только теперь — сжигание.
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
