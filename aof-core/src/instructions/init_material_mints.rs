use anchor_lang::prelude::*;
use crate::InitMaterialMints;
use crate::constants::*;
use crate::errors::AofError;

#[inline(never)]
fn require_distinct_mints(mints: &[Pubkey]) -> Result<()> {
    for (index, mint) in mints.iter().enumerate() {
        require!(*mint != Pubkey::default(), AofError::InvalidMint);
        require!(
            !mints[..index].iter().any(|previous| previous == mint),
            AofError::InvalidMint,
        );
    }
    Ok(())
}

/// [БЛОК L] Инициализация PDA MaterialMints с адресами всех 23 минтов
/// Вызывается один раз админом при деплое.
///
/// SBPF ограничивает стековый кадр функции 4096 байтами. Anchor deserializes все
/// 23 аргумента `Pubkey` в сгенерированной обёртке инструкции, а прежний вызов
/// `require_distinct_mints(&[seeds, wheat, ...])` создавал там же второй массив
/// из 23 элементов (ещё 736 байт), и весь handler в эту обёртку инлайнился.
/// Загрузчик отклонял программу целиком:
///
/// ```text
/// Function _ZN8aof_core9__private8__global19init_material_mints... overflows the
/// maximum allowed frame space by accessing an offset 576 bytes greater than the
/// maximum of 4096. Estimated function frame size: 4672 bytes.
/// ```
///
/// (CI run 34906762097, job Anchor test: aof_core не деплоился, поэтому падал
/// `"before all"` hook всего набора тестов.)
///
/// Минты собираются в heap-`Vec` (24 байта на стеке) вместо массива из 23
/// элементов. Сигнатура, порядок аргументов и IDL не меняются: tests/aof_core.ts
/// и aof_backend/src/routes/admin.ts продолжают работать как раньше.
///
/// Handler ОБЯЗАН быть инлайном в обёртку (`#[inline(always)]`). Замер в CI run
/// 34909103310: с `#[inline(never)]` кадр остался ровно 4672 байта — замена
/// массива на `Vec` сэкономила 736 байт, но отдельный вызов handler с 23
/// аргументами `Pubkey` добавил обратно столько же стековой области аргументов
/// (в SBPF в регистрах передаётся только 5 аргументов), плюс верификатор
/// продолжал сообщать "A function call ... overwrites values in the frame".
/// Инлайн убирает сам вызов, а локальные переменные handler теперь малы.
#[inline(always)]
pub fn handler(
    ctx: Context<InitMaterialMints>,
    seeds: Pubkey,
    wheat: Pubkey,
    flour: Pubkey,
    bread: Pubkey,
    water: Pubkey,
    coal: Pubkey,
    meat: Pubkey,
    stone_blue: Pubkey,
    stone_purple: Pubkey,
    stone_red: Pubkey,
    sand_white: Pubkey,
    sand_pink: Pubkey,
    sand_yellow: Pubkey,
    gem_blue: Pubkey,
    gem_orange: Pubkey,
    gem_white: Pubkey,
    gem_green: Pubkey,
    flask_blue: Pubkey,
    flask_yellow: Pubkey,
    flask_green: Pubkey,
    flask_pink: Pubkey,
    flask_purple: Pubkey,
    love_heart: Pubkey,
) -> Result<()> {
    // Heap, not a stack array: see the note on `handler` about the 4096-byte
    // SBPF frame limit.
    let mut mints: Vec<Pubkey> = Vec::with_capacity(23);
    mints.push(seeds);
    mints.push(wheat);
    mints.push(flour);
    mints.push(bread);
    mints.push(water);
    mints.push(coal);
    mints.push(meat);
    mints.push(stone_blue);
    mints.push(stone_purple);
    mints.push(stone_red);
    mints.push(sand_white);
    mints.push(sand_pink);
    mints.push(sand_yellow);
    mints.push(gem_blue);
    mints.push(gem_orange);
    mints.push(gem_white);
    mints.push(gem_green);
    mints.push(flask_blue);
    mints.push(flask_yellow);
    mints.push(flask_green);
    mints.push(flask_pink);
    mints.push(flask_purple);
    mints.push(love_heart);
    require_distinct_mints(&mints)?;

    let mm = &mut ctx.accounts.material_mints;
    mm.seeds = seeds;
    mm.wheat = wheat;
    mm.flour = flour;
    mm.bread = bread;
    mm.water = water;
    mm.coal = coal;
    mm.meat = meat;
    mm.stone_blue = stone_blue;
    mm.stone_purple = stone_purple;
    mm.stone_red = stone_red;
    mm.sand_white = sand_white;
    mm.sand_pink = sand_pink;
    mm.sand_yellow = sand_yellow;
    mm.gem_blue = gem_blue;
    mm.gem_orange = gem_orange;
    mm.gem_white = gem_white;
    mm.gem_green = gem_green;
    mm.flask_blue = flask_blue;
    mm.flask_yellow = flask_yellow;
    mm.flask_green = flask_green;
    mm.flask_pink = flask_pink;
    mm.flask_purple = flask_purple;
    mm.love_heart = love_heart;
    mm.bump = ctx.bumps.material_mints;
    Ok(())
}
