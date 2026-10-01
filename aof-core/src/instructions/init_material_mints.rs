use anchor_lang::prelude::*;
use crate::InitMaterialMints;
use crate::constants::*;
use crate::errors::AofError;
use crate::events::MaterialMintsInitialized;

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
    neuron: Pubkey,
    synapse: Pubkey,
    signal: Pubkey,
    model: Pubkey,
    power: Pubkey,
    compute: Pubkey,
    dataset: Pubkey,
    blue_core: Pubkey,
    purple_core: Pubkey,
    red_core: Pubkey,
    clear_quartz: Pubkey,
    rose_quartz: Pubkey,
    amber_quartz: Pubkey,
    quantum_bit: Pubkey,
    neural_chip: Pubkey,
    photon_bit: Pubkey,
    bio_chip: Pubkey,
    cryo_fluid: Pubkey,
    volt_fluid: Pubkey,
    bio_fluid: Pubkey,
    nano_fluid: Pubkey,
    quantum_fluid: Pubkey,
    soul_core: Pubkey,
) -> Result<()> {
    // Heap, not a stack array: see the note on `handler` about the 4096-byte
    // SBPF frame limit.
    let mut mints: Vec<Pubkey> = Vec::with_capacity(23);
    mints.push(neuron);
    mints.push(synapse);
    mints.push(signal);
    mints.push(model);
    mints.push(power);
    mints.push(compute);
    mints.push(dataset);
    mints.push(blue_core);
    mints.push(purple_core);
    mints.push(red_core);
    mints.push(clear_quartz);
    mints.push(rose_quartz);
    mints.push(amber_quartz);
    mints.push(quantum_bit);
    mints.push(neural_chip);
    mints.push(photon_bit);
    mints.push(bio_chip);
    mints.push(cryo_fluid);
    mints.push(volt_fluid);
    mints.push(bio_fluid);
    mints.push(nano_fluid);
    mints.push(quantum_fluid);
    mints.push(soul_core);
    require_distinct_mints(&mints)?;

    let mm = &mut ctx.accounts.material_mints;
    mm.seeds = neuron;
    mm.synapse = synapse;
    mm.signal = signal;
    mm.model = model;
    mm.power = power;
    mm.compute = compute;
    mm.dataset = dataset;
    mm.blue_core = blue_core;
    mm.purple_core = purple_core;
    mm.red_core = red_core;
    mm.clear_quartz = clear_quartz;
    mm.rose_quartz = rose_quartz;
    mm.amber_quartz = amber_quartz;
    mm.quantum_bit = quantum_bit;
    mm.neural_chip = neural_chip;
    mm.photon_bit = photon_bit;
    mm.bio_chip = bio_chip;
    mm.cryo_fluid = cryo_fluid;
    mm.volt_fluid = volt_fluid;
    mm.bio_fluid = bio_fluid;
    mm.nano_fluid = nano_fluid;
    mm.quantum_fluid = quantum_fluid;
    mm.soul_core = soul_core;
    mm.bump = ctx.bumps.material_mints;
    // [AUDIT F-03] No ceiling configured at deploy time: every resource starts
    // at `SUPPLY_CAP_UNLIMITED` (u64::MAX) and the authority is expected to
    // tighten the interesting kinds with `set_supply_cap` before launch.
    // Starting at 0 would mean "halted", which would break the whole economy
    // before anybody had a chance to configure it.
    mm.max_supply = [SUPPLY_CAP_UNLIMITED; RESOURCE_KIND_COUNT];
    emit!(MaterialMintsInitialized { authority: ctx.accounts.authority.key(), slot: Clock::get()?.slot });
    Ok(())
}
