# Починка сборки: `proc-macro2` / `Building IDL failed`

Если при `anchor build` / `anchor test` видите:

```
erde_json v1.0.151
error[E0425]: cannot find type `SourceFile` in crate `proc_macro`
   --> proc-macro2-1.0.94/src/wrapper.rs:366:26
    |
366 |     Compiler(proc_macro::SourceFile),
    |                          ^^^^^^^^^^ not found in `proc_macro`
...
error[E0599]: no method named `source_file` found for reference `&proc_macro::Span`
...
error: could not compile `proc-macro2` (lib) due to 3 previous errors
Error: Building IDL failed
```

## Почему

- `anchor-lang = 0.30.1` → `anchor-syn` использует `proc_macro2::Span::source_file()` (semver-exempt API).
- Этот метод есть только до `proc-macro2 1.0.94` включительно. В 1.0.95+ его удалили.
- Но `proc-macro2 1.0.94` сам требует `proc_macro::SourceFile`, который удалили из Rust nightly и Rust >=1.90.
- Итог: ни одна версия Rust не может собрать IDL-часть на этом стеке. CI помечает этот шаг как `continue-on-error`.

Документированный рабочий тулчейн (см. CLAUDE.md и `.github/workflows/ci.yml`):
- **Rust 1.89.0**
- **Agave / Solana CLI 4.2.1**
- **Anchor 0.30.1**
- **platform-tools v1.56**
- **proc-macro2 1.0.94** (запинено в Cargo.lock)

## Быстрый фикс на macOS (ваш случай `zlata@MacBook-Pro-Zlata`)

```bash
# 1. Поставить правильный Rust
rustup toolchain install 1.89.0 --profile minimal --component rustfmt,clippy
rustup default 1.89.0
rustc --version  # должно быть 1.89.0

# 2. Проверить Solana CLI (Agave)
solana --version  # ожидаем 4.2.1 (Agave)
# если нет или версия другая:
sh -c "$(curl -sSfL https://release.anza.xyz/v4.2.1/install)"
# для Apple Silicon может понадобиться tarball:
# https://github.com/anza-xyz/agave/releases/tag/v4.2.1

# 3. Проверить Anchor
anchor --version  # ожидаем 0.30.1
# если нет:
cargo install --git https://github.com/coral-xyz/anchor --tag "v0.30.1" anchor-cli --locked --force

# 4. Запинить proc-macro2
cd /path/to/aof
cargo update -p proc-macro2 --precise 1.0.94
# проверьте:
grep -A1 'name = "proc-macro2"' Cargo.lock | head

# 5. Собрать БЕЗ IDL
anchor build --no-idl --skip-lint
# или используйте готовый скрипт:
bash scripts/build-local.sh

# 6. Подсеять IDL из коммитов (т.к. IDL-билдер сломан upstream)
node scripts/ensure-idl.mjs
ls target/idl/  # должно быть 6 файлов

# 7. Прогон тестов без пересборки
anchor test --skip-build
# или
npx tsx node_modules/mocha/bin/mocha.js -t 1000000 tests/aof_core.ts
```

## Что добавлено в репо для фикса

- `rust-toolchain.toml` → автоматически ставит 1.89.0 через rustup
- `Cargo.lock` уже запинен на 1.0.94
- `scripts/ensure-idl.mjs` + `scripts/ensure-idl.js` (CJS fallback) → копирует `aof_backend/src/idl/*.json` в `target/idl/`
- `scripts/ensure-env.mjs` + `scripts/ensure-env.js` → делает IDL + создаёт `solana/keys/aof-authority-devnet.json` если его нет (throwaway кошелёк, т.к. папка `solana/` в `.gitignore`)
- `scripts/build-local.sh` → делает всё выше одной командой
- `Anchor.toml` [scripts] test теперь сам вызывает `ensure-env` с fallback цепочкой, чтобы не падать с `MODULE_NOT_FOUND`
- `Makefile` → `make build`, `make test`

## Вторая ошибка после первого фикса: `Cannot find module ... ensure-idl.mjs` / `Unable to read keypair file` / `ANCHOR_PROVIDER_URL is not defined`

Если видите:

```
Error: Cannot find module '/.../scripts/ensure-idl.mjs'
Error: Unable to read keypair file (solana/keys/aof-authority-devnet.json)
Error: ANCHOR_PROVIDER_URL is not defined
```

Причины:
1. **ensure-idl.mjs не найден** — вы на старой ветке `main`, где файла ещё нет. Сделайте `git pull` или `git checkout arena/01a0d496-aof` или создайте файл вручную из репо (см. `scripts/ensure-idl.js` — CJS версия).
2. **Кошелёк не найден** — `solana/keys/` в `.gitignore`, поэтому его нет после клона. CI создаёт throwaway кошелёк. Локально нужно:
   ```bash
   mkdir -p solana/keys
   solana-keygen new --no-bip39-passphrase -o solana/keys/aof-authority-devnet.json
   # или
   node scripts/ensure-env.mjs
   ```
3. **ANCHOR_PROVIDER_URL is not defined** — вы запускаете `npx tsx ... tests/aof_core.ts` напрямую, без `anchor test`. `AnchorProvider.env()` читает env vars которые ставит `anchor test`.
   Решения:
   - Всегда запускайте через `anchor test --skip-build` (он сам стартует локальный валидатор и ставит env)
   - Или запустите валидатор вручную в отдельном терминале и экспортируйте env:
     ```bash
     solana-test-validator --reset
     # в другом терминале:
     export ANCHOR_PROVIDER_URL=http://127.0.0.1:8899
     export ANCHOR_WALLET=$(pwd)/solana/keys/aof-authority-devnet.json
     npx tsx node_modules/mocha/bin/mocha.js -t 1000000 tests/aof_core.ts
     ```

### Полный чеклист для прогона на macOS после фикса

```bash
git checkout arena/01a0d496-aof
git pull
rustup default 1.89.0
cargo update -p proc-macro2 --precise 1.0.94

# создаст IDL + кошелёк
node scripts/ensure-env.mjs

# сборка
anchor build --no-idl

# прогон (сам поднимет валидатор, если не запущен)
anchor test --skip-build
```

## Порт 8080 занят чужим сервисом: `{"detail":"Not Found"}` вместо ответа backend

Симптом: backend поднялся (`aof-backend started`, `/health` в логе отвечает), а снаружи

```
curl -sS -i http://localhost:8080/__who_are_you__
HTTP/1.1 404 Not Found
server: uvicorn
{"detail":"Not Found"}
```

`server: uvicorn` и JSON с полем `detail` — это **не наш backend**: Express отдаёт `Cannot GET …`
или `{"error": …}`. Причина видна в `lsof`:

```
lsof -nP -iTCP:8080 -sTCP:LISTEN
com.docke 18466 zlata … TCP 127.0.0.1:8080 (LISTEN)   # проброс Docker (чужой сервис)
node      61749 zlata … TCP *:8080 (LISTEN)           # наш backend
```

На macOS `localhost` — это 127.0.0.1, и запрос уходит в более конкретный bind (контейнер), хотя наш
backend слушает `*:8080` и жив. Тот же эффект даёт любой чужой процесс, занявший 8080 раньше.

Лечится двумя способами:

```bash
# 1) не трогая чужой сервис — отдать нашему backend другой порт;
#    фронт (vite) сам проксирует /api на 127.0.0.1:$BACKEND_PORT
BACKEND_PORT=8081 bash scripts/dev-local.sh up
BACKEND_URL=http://127.0.0.1:8081 bash scripts/devnet-bringup.sh --apply

# 2) освободить 8080, если контейнер не нужен:
docker ps --format '{{.Names}}\t{{.Ports}}' | grep 8080
docker stop <имя>
```

Проверка, что перед вами именно наш backend (до любых скриптов):

```bash
curl -sS -o /dev/null -w 'health=%{http_code}\n' "$BACKEND_URL/health"     # 200
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BACKEND_URL/admin/config/bootstrap-preflight" | head -c 200            # {"kind":"aof.bootstrap-preflight",…}
```

`devnet-bringup.sh` ловит эту ситуацию сам и называет её: «по адресу … нет
/admin/config/bootstrap-preflight (HTTP 404): это посторонний сервис на порту или старая сборка
backend». «Любой 404 — ок» он не принимает намеренно: иначе чужой сервис был бы неотличим от
нашего, и `initConfig`/минты подписывались бы неизвестно чем.

## Authority backend'а не совпадает с ключом оператора

Симптом (шаг 1/10 включения девнета):

```
ОТКАЗ: authority backend'а GE6jwnX8… не совпадает с ключом оператора C8MS1G3g7… (AUTHORITY_KEYPAIR)
```

Это правильный отказ: `Config` в aof_core привязывается к upgrade authority программы, а подписывающие
маршруты backend'а идут ключом `AUTHORITY_SECRET_KEY`. На чистом клоне `dev-local.sh up` создаёт
`aof_backend/.env` с throwaway-ключом — он не имеет отношения к программам, которые в девнете
принадлежат операторскому `solana/keys/aof-authority-devnet.json`.

```bash
# что сейчас (секрет не печатается, только pubkey)
node scripts/set-backend-authority.mjs

# выровнять: в .env запишется base58-секрет ключа оператора (AUTHORITY_SECRET_KEY,
# AUTHORITY_PUBKEY, AUTHORITY_MODE=hot); остальные строки не меняются
node scripts/set-backend-authority.mjs --apply

# перезапустить backend, чтобы он прочитал ключ
bash scripts/dev-local.sh up
```

Коды выхода: `0` — совпадают, `1` — расходятся (годится для проверки в скриптах), `2` — негодный вход.
`dev-local.sh up` сам предупреждает о расхождении, если ключ оператора лежит на месте.

## Если всё равно падает

1. Убедитесь что `rustup show` показывает `active toolchain: 1.89.0`
2. Удалите кэш: `cargo clean` НЕ делайте `anchor clean` (долго). Достаточно `rm -rf target`
3. Проверьте что `~/.cargo/config.toml` не форсит другой rustflags
4. На Apple Silicon иногда нужно: `rustup target add sbf`? Нет, Agave ставит `cargo-build-sbf` отдельно
5. Если `anchor build` всё ещё пытается строить IDL — вы забыли `--no-idl`

## Долгосрочное решение

Мигрировать на Anchor 0.31+ / Solana 2.x где `source_file` больше не нужен.
Пока это не сделано — сборка только через `--no-idl` + committed IDL.

См. также:
- `.github/workflows/ci.yml` строки про `Pin proc-macro2` и `Anchor build --no-idl`
- `CLAUDE.md` секция "Фикс ошибки proc-macro2"
