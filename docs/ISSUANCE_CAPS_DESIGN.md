# On-chain issuance caps для `mint_resource` / `mint_resource_once` — дизайн

> **⚠️ Корректировка от 2026-09-21 (полный аудит `AUDIT_FULL_2026-09-21.md`).**
> Этот документ описывает **только один из трёх** тормозов эмиссии, и два его
> утверждения больше не соответствуют коду:
>
> 1. **Cap покрывает 2 из 9 минтящих путей.** `IssuanceCap` проверяется только в
>    `mint_resource` и `mint_resource_once`. `collect_mining`, `collect_flour`,
>    `collect_bread`, `collect_well_water`, `craft_recipe`, `craft`,
>    `claim_season_reward` и `explore_reveal` эмитировали без всякого лимита
>    (F-03). Глобальный потолок теперь живёт в `MaterialMints.max_supply` и
>    проверяется функцией `check_supply_cap()` на **всех** путях; `IssuanceCap`
>    остаётся вторым, более детальным ограничителем уровнем ниже.
> 2. **«Ротация authority через Squads» была невозможна** — ни в одной из шести
>    программ не было инструкции смены authority (F-02). После аудита добавлена
>    двухшаговая ротация `set_pending_authority` → `accept_authority`
>    (+ `cancel_pending_authority`) в **пяти** программах (aof-core, market,
>    quests, rebirth, liquidity). Squads- vault теперь может быть authority:
>    он подписывает `accept_authority` как `new_authority`. `aof-session-keys`
>    остаётся без ротации — там нет Config.
>
> Третий тормоз — `VaultGuard` (F-01): лимит на вывод из vault на один mint
> (`max_per_tx`), на эпоху (`cap_per_epoch`) и «получатель обязан быть
> существующим Player». Подробности и статус — в `REMEDIATION_STATUS.md`.

_Статус: **реализовано в коде** (`aof-core` + backend + validator-тест `tests/aof_core.ts`), Rust собирается только в CI (`programs`/`anchor-test` — в песочнице SBPF-тулчейна нет). **Не деплоено.** Cap обязателен сразу (fail-closed), без промежуточного `Option`-релиза._

## Зачем

Сегодня authority backend'а может выпустить **любое** количество любого ресурса
(`aof-core/src/instructions/mint_resource.rs::execute_mint`). `RewardReceipt` (AOF-05)
защищает от повтора одного reward ID, но не от выпуска новых ID. Кража
`AUTHORITY_SECRET_KEY` = неограниченная эмиссия. Cap переводит это в
«ограниченная эмиссия за эпоху», что даёт время на `set_paused` и ротацию.

## Принципы

1. **Не менять layout `Config`** — он уже задеплоен и на него завязаны 87 инструкций.
   Cap живёт в отдельном PDA (как `RarityCounter`, `MaterialMints`).
2. **Fail-closed**: если PDA cap не инициализирован — mint отклоняется.
   Иначе «забыли инициализировать» = «нет лимита».
3. **Изменение лимитов — только authority, и только через multisig** (Squads).
   Hot-key backend'а cap менять не может: инструкция `set_issuance_cap` требует
   `config.authority`, который после миграции = Squads vault, а backend подписывает
   отдельным `mint_authority`-делегатом (см. §5).
4. **Эпоха фиксированной длины в слотах**, не по `unix_timestamp` (валидаторское
   время манипулируемо в пределах ~допуска, слоты — нет).

## Layout

```rust
// seeds = [b"issuance_cap", &(kind as u8).to_le_bytes()]
#[account]
#[derive(InitSpace)]
pub struct IssuanceCap {
    pub kind: u8,               // ResourceKind as u8
    pub epoch_slots: u64,       // длина эпохи, напр. 216_000 (~24h при 400ms)
    pub cap_per_epoch: u64,     // gross amount (до fee split), в base units
    pub epoch_start_slot: u64,  // начало текущей эпохи
    pub minted_in_epoch: u64,   // выпущено с начала эпохи
    pub lifetime_minted: u128,  // монотонный счётчик для аудита/индексера
    pub bump: u8,
}
// 8 + 1 + 8 + 8 + 8 + 8 + 16 + 1 = 58 bytes
```

Один PDA на `ResourceKind` (27 видов) — независимые лимиты; POTATO и gems с
малым cap, food/wood/stone — с большим.

## Логика в `execute_mint`

```rust
pub fn charge_cap(cap: &mut IssuanceCap, kind: &ResourceKind, amount: u64, slot: u64) -> Result<()> {
    require!(cap.kind == *kind as u8, AofError::InvalidResourceKind);
    require!(cap.cap_per_epoch > 0, AofError::IssuanceCapNotConfigured);
    // Перекат эпохи: сколько бы эпох ни прошло, начинаем новую от текущего слота,
    // выровненного по сетке (иначе можно «донабрать» пропущенные эпохи).
    if slot >= cap.epoch_start_slot.saturating_add(cap.epoch_slots) {
        let elapsed = slot - cap.epoch_start_slot;
        let full = elapsed / cap.epoch_slots;
        cap.epoch_start_slot = cap.epoch_start_slot.saturating_add(full.saturating_mul(cap.epoch_slots));
        cap.minted_in_epoch = 0;
    }
    let next = cap.minted_in_epoch.checked_add(amount).ok_or(AofError::MathOverflow)?;
    require!(next <= cap.cap_per_epoch, AofError::IssuanceCapExceeded);
    cap.minted_in_epoch = next;
    cap.lifetime_minted = cap.lifetime_minted.checked_add(amount as u128).ok_or(AofError::MathOverflow)?;
    Ok(())
}
```

Вызывается **до** обоих `mint_to` — атомарность гарантирует, что отклонённый
mint не двигает счётчик. Учитывается `amount` (gross), а не `user_cut`: fee-часть
в treasury — тоже эмиссия.

## Новые инструкции

| Инструкция | Кто | Что |
|---|---|---|
| `init_issuance_cap(kind, epoch_slots, cap_per_epoch)` | `config.authority` | `init` (не `init_if_needed`), `epoch_start_slot = clock.slot`. |
| `set_issuance_cap(kind, epoch_slots, cap_per_epoch)` | `config.authority` | Меняет лимиты; **не** сбрасывает `minted_in_epoch` (иначе смена cap = обход cap). Emit `IssuanceCapChanged`. |

Изменение аккаунтов: `MintResource` и `MintResourceOnce` получают
`#[account(mut, seeds=[ISSUANCE_CAP_SEED, &kind_byte], bump = issuance_cap.bump)] pub issuance_cap: Account<'info, IssuanceCap>`.
Ошибки: `IssuanceCapNotConfigured`, `IssuanceCapExceeded`.

## Event для индексера

```rust
#[event] pub struct ResourceIssued { pub kind: u8, pub mint: Pubkey, pub recipient: Pubkey,
    pub gross: u64, pub fee: u64, pub minted_in_epoch: u64, pub cap_per_epoch: u64, pub slot: u64 }
```

Закрывает одновременно «`potatoMinted24h` unavailable» в economy monitor: индексер
читает `ResourceIssued`, а не парсит SPL `MintTo`.

## 5. Разделение authority (вместе с Squads)

Сейчас `config.authority` = один ключ и для конфигурации, и для mint. Целевое:

- `config.authority` → Squads vault (конфиг, fees, pause, caps, resource mints).
- Новое поле **не в Config**, а в `IssuanceCap`? Нет — в отдельном `MintDelegate` PDA:
  `{ delegate: Pubkey, bump }`; `MintResource*` проверяет `authority.key() == mint_delegate.delegate`.
  Делегата назначает/отзывает Squads. Backend hot-key = делегат. Кража hot-key →
  эмиссия ограничена cap, ротация = одна multisig-транзакция `set_mint_delegate`.

## Значения по умолчанию (для обсуждения, калибровать по devnet-данным)

| kind | epoch | cap_per_epoch | обоснование |
|---|---|---|---|
| Potato | 24h | 2× среднедневной reward payout последних 30 дней | запас на ивенты |
| Gem*, Flask*, LoveHeart | 24h | 3× дневного среднего | редкие, малый объём |
| Food/Wood/Stone | 24h | 5× дневного среднего | базовые, всплески при онбординге |
| остальные | 24h | 3× | |

При превышении backend получает `IssuanceCapExceeded`, inbox-claim уходит в
`quarantined` (существующая ветка AOF-05), не в retry-loop; алерт P0 в Telegram.

## Тесты (обязательны до деплоя)

1. Rust unit: перекат эпохи через 1 / 2 / 1000 эпох, отсутствие «накопления»
   неиспользованного лимита; overflow на `u64::MAX`.
2. Validator: mint ровно до cap проходит, +1 — `IssuanceCapExceeded`, счётчик не
   изменился; `set_issuance_cap` не обнуляет `minted_in_epoch`; mint без
   инициализированного cap — отклонён.
3. Backend: `rewardReceiptSelfTest` дополняется кейсом `IssuanceCapExceeded` → quarantine.

## Что реализовано

- `aof-core`: `IssuanceCap` PDA (`["issuance_cap", kind as u8]`), `init_issuance_cap`, `set_issuance_cap`
  (roll эпохи → set; счётчик не сбрасывается; `cap_per_epoch = 0` — стоп-кран), `charge()` в `execute_mint`
  перед CPI для `mint_resource` и `mint_resource_once`. Ошибки 6097 `IssuanceCapNotConfigured`,
  6098 `IssuanceCapExceeded`, 6099 `InvalidIssuanceCapParams`. Событие `IssuanceCapChanged`; в `ResourceIssued`
  есть `minted_in_epoch`/`cap_per_epoch` для индексера.
- IDL (`aof_backend/src/idl/aof_core.{json,ts}`) обновлён вручную; `scripts/check-idl-drift.py` — без дрейфа.
  После реального `anchor build` в CI заменить на сгенерированный.
- Backend: `issuanceCapPda()` / `RESOURCE_KIND_ORDER` в `src/lib/pda.ts` (порядок проверяется тестом
  `test:admin-auth` против enum в `lib.rs`); аккаунт передаётся во всех mint-путях (`resources.ts`, `inbox.ts`,
  `admin.ts`); в inbox `IssuanceCapExceeded/NotConfigured` → item возвращается в `unclaimed`, ответ 503
  `ISSUANCE_CAP_EXCEEDED` (retryable), `logger.error`. Админка: `GET /admin/issuance-caps`,
  `POST /admin/issuance-caps/init|set` (ops-токен). Скрипт массовой инициализации `npm run caps:init`.
- Тесты: Rust unit в `state.rs`; validator-тест «cap блокирует, ровно до cap проходит, `set` не сбрасывает,
  `mint_resource_once` без receipt при отказе, cap=0 → NotConfigured, чужой authority → Unauthorized».

## Миграция (fail-closed, один релиз)

1. `anchor build` в CI → сверить IDL с ручной копией → `anchor upgrade` программы.
2. **Сразу после upgrade** (до перезапуска backend на новой IDL): `CAP_PER_EPOCH=… npm run caps:init`
   (все 27 kinds; per-kind `CAP_<KIND>`; `DRY_RUN=1` для проверки). До этого шага любой mint падает
   с `AccountNotInitialized` — это ожидаемо и безопасно (inbox-item остаётся `unclaimed`, повтор позже).
3. Перезапустить backend; `GET /admin/issuance-caps` — все `configured: true`.
4. Дальнейшая калибровка — `POST /admin/issuance-caps/set`; экстренная остановка kind'а — `capPerEpoch: 0`.
