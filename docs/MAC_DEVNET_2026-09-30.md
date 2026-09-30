# Mac: обновить папку, убраться, прогнать тесты, задеплоить и запустить игру

Всё, что ниже, выполняется в одном каталоге: `/Users/zlata/LeoGamesStudio/aof`.
Каждый блок — копировать целиком. Ничего секретного в чат/в git не попадает:
ключи программ и `.env` остаются только на этой машине (`.gitignore`).

Ветка этой работы: `arena/01a0efab-aof` (PR #28).

---

## 0. Один раз: инструменты

```bash
brew install node@22 python@3 jq
# Rust + Solana CLI (Agave 4.2.1) + Anchor 0.30.1 — как в CI:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.89.0
sh -c "$(curl -sSfL https://release.anza.xyz/v4.2.1/install)"
cargo install --git https://github.com/coral-xyz/anchor avm --force && avm install 0.30.1 && avm use 0.30.1
# Проверка:
node -v && solana --version && anchor --version && python3 -V
```

Кошелёк оператора (он же платит аренду программ и получает комиссии) лежит
**вне git**: `solana/keys/aof-authority-devnet.json`. Если его нет:

```bash
mkdir -p solana/keys && solana-keygen new --no-bip39-passphrase -o solana/keys/aof-authority-devnet.json
solana address -k solana/keys/aof-authority-devnet.json     # этот адрес просить под airdrop
solana airdrop 2 --url https://api.devnet.solana.com
```

---

## 1. Обновить папку на маке из GitHub

Папка уже есть:

```bash
cd /Users/zlata/LeoGamesStudio/aof
git fetch origin --prune
git checkout arena/01a0efab-aof
git pull --ff-only
```

Папки ещё нет (свежий клон):

```bash
cd /Users/zlata/LeoGamesStudio
git clone https://github.com/Leo88q/aof.git
cd aof && git checkout arena/01a0efab-aof
```

То же самое одной командой (и дальше она же делает уборку/тесты/сборку):

```bash
bash scripts/dev-local.sh sync
```

### 1.1 Что уже проверено в этой ветке (CI, 2026-09-30)

* `Anchor build (on-chain programs)` — **зелёный**: все шесть программ
  собираются. До этого шаг падал на «lifetime may not live long enough» в
  `reset_for_rebirth`; исправлено явными проверками вместо
  `Account::try_from` из `remaining_accounts` и явным `'info` в сигнатуре
  (подробности — `docs/UNBLOCK_PLAN_2026-09-30.md`, §0.1-бис).
* `Anchor test (local validator)` — набор впервые прогнан на локальном
  валидаторе: 47 passing, 1 failing, и единственный провал был в тесте
  перерождения (порядок кодов отказа: `NonCanonicalTokenAccount`/`ZeroAmount`
  вместо `Unauthorized`/`InvalidResourceKind`/`NonCanonicalTokenAccount`).
  Порядок отказов исправлен; ожидаемый результат — 48 passing.
* Локально без сети зелёные: 151 readiness-тест, python-гейты
  (`test-p0-security`, `check-idl-drift`, генератор таблицы инструкций),
  security-скрипты (`check-hidden-unicode`, `program-registry`,
  `agent-config-lock`, `agent-skills`, `upstream-watch`, `audit-gate`).

Поэтому шаги «сборка/тесты» ниже — проверка вашей машины, а не способ узнать,
компилируется ли код: он компилируется.

---

## 2. Ключи программ: почему адреса придётся сменить и как это делается

Создать программу по адресу можно **только ключом этого адреса** — аккаунт
программы подписывает свой деплой. Ключей для `aof_core`, `aof_market` и
`aof_session_keys` нет ни в репозитории (они в `.gitignore`), ни у владельца — а
читающий зонд показывает, что и самих программ на девнете нет:

```bash
python3 scripts/devnet-program-probe.py https://api.devnet.solana.com
```

Поэтому адрес объявлен, но недостижим. Честный выход — объявить **новые**
адреса и переписать их одновременно во всех местах. Это одна команда:

```bash
# Показать состояние: адрес, есть ли ключ, что изменится (ничего не меняет)
bash scripts/dev-local.sh keys

# Сменить адреса: создать ключи отсутствующим программам и переписать
# declare_id!, Anchor.toml, реестр, IDL, watchtower, клиентов, тесты и документы
PROGRAMS=aof_core,aof_market,aof_session_keys bash scripts/dev-local.sh keys --apply
```

Что важно знать перед запуском:

* **меняются только перечисленные программы.** `aof_quests`, `aof_rebirth` и
  `aof_liquidity` уже живут на девнете по своим адресам — их адрес трогать
  нельзя, иначе старые аккаунты осиротеют;
* ключи кладутся в `solana/keys/programs/<имя>.json` (права 600) и зеркалятся в
  `target/deploy/<имя>-keypair.json`, который ждёт `anchor build`. Оба пути в
  `.gitignore`: **сделайте бэкап** — с потерей ключа теряется возможность
  обновлять программу по этому адресу;
* скрипт сам не даст сделать полумеру: `--generate` без списка отказывает, а
  гейт `node scripts/rotate-program-ids.mjs --check` падает, если где-то
  остался старый адрес (прошлые адреса он помнит в
  `security/program-registry.json → previousAddresses`).

После смены адресов коммит (ключи не попадут — они игнорируются):

```bash
git add -A && git commit -m "chore(programs): новые адреса aof_core/aof_market/aof_session_keys"
git push origin arena/01a0efab-aof     # CI проверит согласованность адресов
```

---

## 3. Уборка, тесты, сборка

```bash
bash scripts/dev-local.sh clean     # target/, dist/, .anchor, кэши сборки (ключи и .env не трогает)
bash scripts/dev-local.sh install   # npm ci в frontend/ и aof_backend/
bash scripts/dev-local.sh test      # фронт + readiness + os + backend self-tests
WITH_ANCHOR=1 bash scripts/dev-local.sh test    # ещё и cargo test + anchor test на локальном валидаторе
bash scripts/dev-local.sh build     # frontend/dist + aof_backend/dist
WITH_ANCHOR=1 bash scripts/dev-local.sh build   # ещё и .so программ в target/deploy
```

Полная уборка «с нуля» (долго: переставит зависимости заново):

```bash
CLEAN_DEEP=1 bash scripts/dev-local.sh clean
```

---

## 4. Деплой на девнет и включение механик

Сначала — сухой прогон: он ничего не меняет в сети, но проверяет ключ, баланс,
сборку и порядок шагов.

```bash
cd /Users/zlata/LeoGamesStudio/aof
AOF_DEPLOY_TARGET=devnet bash scripts/devnet-bringup.sh
```

Затем деплой и включение (нужен запущенный backend в hot-режиме — им
подписываются минты, потолки и тумблер добычи):

```bash
# терминал 1
cd /Users/zlata/LeoGamesStudio/aof && bash scripts/dev-local.sh up     # поднимет backend :8080 и сайт :3000
# возьмите ADMIN_TOKEN из aof_backend/.env

# терминал 2
cd /Users/zlata/LeoGamesStudio/aof
ADMIN_TOKEN=<из aof_backend/.env> AOF_DEPLOY_TARGET=devnet bash scripts/devnet-bringup.sh --apply
```

Одной командой весь путь (включая ключи, тесты, сборку, деплой и итоговый
отчёт зонда) — сначала сухой прогон, потом с `--apply`:

```bash
PROGRAMS=aof_core,aof_market,aof_session_keys bash scripts/dev-local.sh devnet
PROGRAMS=aof_core,aof_market,aof_session_keys ADMIN_TOKEN=<токен> bash scripts/dev-local.sh devnet --apply
```

Что включается этим прогоном: добыча инструментов, ресурсы и крафт, паки,
ремонт, газ-бак, коллекционеры, минты и потолки выпуска, а также всё, что
читает `Config`/`MaterialMints`. Что **осталось работой по контракту** (не
переключатель) — `docs/UNBLOCK_PLAN_2026-09-30.md` §3; скрипт печатает этот
список в конце, чтобы «включено» не читалось шире, чем есть.

Тем же деплоем включаются три механики, которые раньше были закрыты кодом и
дожидаются только новой сборки `aof_core`: **ордербук v2** (цена за целый
ресурс), **потолок цены в лотерее** и **полный сброс при перерождении**. После
деплоя их ничего дополнительно включать не нужно — новые инструкции уже в
байткоде; скрипт печатает их отдельным списком.

### 4.1 Проверка «что реально включено» (в любой момент)

Зонд ничего не подписывает и не отправляет — только читает аккаунты:

```bash
cd /Users/zlata/LeoGamesStudio/aof
python3 scripts/devnet-program-probe.py https://api.devnet.solana.com
```

Он печатает две вещи: задеплоены ли шесть программ и таблицу механик
`[ВКЛ ] / [выкл] / [??  ]` с доказательством для каждой строки — например
`Config есть: paused=false, mining_enabled=true` или `аккаунтов MaterialMints: 1`.
У каждой выключенной строки рядом напечатана причина и команда, которая её
снимает. Механики, закрытые в коде (пул горячего рынка, сессионные ключи),
остаются «выключено» даже при заполненных конфигах — и это тоже видно.

Если прогон с `--apply` закончился, а какая-то строка всё ещё «выкл» —
это и есть точный ответ, чего не хватает, без догадок.

### 4.2 Фоновые сервисы (без них половина витрин «неизвестно»)

История, квесты, сделки, графики цен и траст читаются из базы, которую
наполняют сервисы backend. Одной командой — вместе с игрой и сайтом:

```bash
cd /Users/zlata/LeoGamesStudio/aof
WITH_SERVICES=1 bash scripts/dev-local.sh up
```

Поднимается пять процессов и каждый проверяется на живость (живость — не
обещание: скрипт печатает `✓` только тому, кто реально ответил или работает):

| Сервис | Зачем | Порт / лог |
| --- | --- | --- |
| `chain-indexer` | история, квесты, сделки на рынке попадают в БД | health `:8082` |
| `indexer` | тики и свечи цен хот-маркета для графиков | WS `:8081` |
| `trust-worker` | траст-скор и правила трейдеров | лог `data/logs/trust-worker.log` |
| `farm-trader` | исполнение правил автоторговли игроков | лог `data/logs/farm-trader.log` |
| `price-cranker` | пересчёт цены пула (VRGDA) — без него цена застревает на пике | лог `data/logs/price-cranker.log` |

`Ctrl+C` гасит всё вместе с игрой. Нужен свой набор — `SERVICES=chain-indexer,indexer`:

```bash
SERVICES=chain-indexer,indexer WITH_SERVICES=1 bash scripts/dev-local.sh up
```

Если какой-то сервис не поднялся, причина печатается тут же (последние строки
его лога) — а не обнаруживается позже по пустым экранам. Без
`WITH_SERVICES=1` игра и сайт работают как раньше, но витрины истории и
графиков будут пустыми.

---

## 5. Тестовый запуск игры (без деплоя)

```bash
cd /Users/zlata/LeoGamesStudio/aof
bash scripts/dev-local.sh up
#   сайт  : http://localhost:3000/site
#   игра  : http://localhost:3000/
#   API   : http://localhost:8080/health   (/ready — БД + RPC)
```

`Ctrl+C` гасит и backend, и сайт. Если нужен только фронт (нет доступа к
`binaries.prisma.sh`): `SKIP_BACKEND=1 bash scripts/dev-local.sh up`.

Проверка, что после смены адресов ничего не разъехалось, — тот же гейт, что и в
CI:

```bash
node scripts/rotate-program-ids.mjs --check     # адреса во всех местах
node --test tests/readiness/program-ids.test.cjs
```

---

## 6. Если что-то пошло не так

| Симптом | Причина и что делать |
| --- | --- |
| `нет ключа программы target/deploy/<имя>-keypair.json` | ключ потерян или не создан: `PROGRAMS=<имя> bash scripts/dev-local.sh keys --apply` (адрес изменится) |
| `ключ ... принадлежит адресу X, а объявлен Y` | ключ от другого адреса: либо положить правильный ключ, либо сменить адрес командой `keys --apply` |
| `в собранной программе ... нет объявленного адреса` | собран `.so` из CI (там адрес переписан ключами раннера): соберите локально `WITH_ANCHOR=1 bash scripts/dev-local.sh build` |
| `DeclaredProgramIdMismatch` при первом вызове | то же: бинарник и `declare_id!` разошлись — пересобрать после смены адресов |
| backend отвечает 503 по всем механикам | программы ещё не в сети: деплой + `initConfig` + `initMintsV2` + `caps:init` (шаг 4) |
| `git pull` не проходит | на маке есть локальные правки: `git stash` → `git pull --ff-only` → `git stash pop` |
