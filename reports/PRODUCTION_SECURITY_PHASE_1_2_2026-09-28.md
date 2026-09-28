# Подготовка к production — фаза 1–2

Дата: **2026-09-28**. База: `6918544a0ade600de30c164ee9774826ad51bab2`; рабочая ветка `arena/01a0e5da-aof`.

**Вердикт: НЕ ГОТОВО к запуску с реальными деньгами.** Это отчёт одной фазы, не полный пентест, аудит контрактов или юридическое заключение. Разделы 3–10 ещё не пройдены. PASS ниже относится исключительно к указанному объёму проверки.

## Сводка

8 сгруппированных находок: **Critical — 0 подтверждено, High — 3, Medium — 5**. Подтверждённых живых секретов в выполненной выборке — 0; отсутствие секретов **не доказано**. Непроверенные области не считаются чистыми.

Самые срочные пять действий:
1. Решить вопрос публичного серверного кода: репозиторий публичный. Приватизация не отменяет уже состоявшееся раскрытие.
2. Запустить настоящие gitleaks/trufflehog на дереве, всех refs, публичном output, PR и закрыто сохранённых логах/артефактах. Не заменять их вспомогательным regex-скриптом.
3. Проверить настройки хостинга: root `frontend`, output `dist`; предоставить официальный production/staging URL для внешних проверок. Проверить фактические VITE-переменные, RPC-прокси/лимиты и секрет-хранилище.
4. Проверить branch protection, обязательное ревью, Secret Scanning, Push Protection, MFA и права участников. API проверки protection вернул 403.
5. Проверить custody/authority и подтвердить план ротаций; при обнаружении утечки сначала отзыв/ротация, затем согласованная очистка истории.

## Находки и исправления

| ID чек-листа / находка | Приоритет | Доказательство | Описание и исправление | Статус |
|---|---|---|---|---|
| 1.2.3, 2.8 / F01 | High | `gh api repos/Leo88q/aof`: `private=false`; [репозиторий](https://github.com/Leo88q/aof) | Сервер/игра/контракты в публичном репозитории. Согласовать приватный game-server/infra, публикацию только frontend output. Секреты не хранить даже в приватном Git. | Открыто; видимость не менялась |
| 1.1.1, 1.3.6 / F02 | High | исходная `.gitleaks.toml:9–33`; новая `.gitleaks.toml:1–14` | Allowlist исключал целиком env-шаблоны, lock/IDL и 43–44-символьные base58, что могло скрыть секрет. Убраны широкие исключения; добавлены Solana-array и контекстный base58 detector. | Код исправлен; требуется запуск gitleaks и triage возможных ложных срабатываний |
| 1.3.4, 1.3.9 / F03 | High | `docs/CLOUDFLARE_DEPLOYMENT.md:19`; `frontend/src/lib/wallet.ts:10`, `frontend/src/wallet/WalletProvider.tsx:7` | Инструкция предлагала положить Helius api-key в VITE_RPC_URL. Инструкция исправлена на публичный endpoint без секрета либо ограниченный собственный прокси. | Документация исправлена; реальные hosting values и прокси не проверены |
| 1.3.1 / F04 | Medium | `.gitignore`; `git ls-files -ci --exclude-standard` | Не были покрыты id.json, wallet/keypair prefixes, keystore, DB exports. Добавлены правила; SQL schema/migrations/tests явно оставлены как исходники. | Исправлено; tracked ignored list пуст |
| 2.7 / F05 | Medium | `.dockerignore:1`, `aof_backend/.dockerignore:1`; `docker-compose.prod.yml:5`; `watchtower/Dockerfile:1` | Оба используемых Docker context не имели .dockerignore. Добавлены исключения секретов, .git, локальных сборок, тестов и документации. SQL migrations сохранены. | Контексты исправлены; image build/history/Trivy ещё не проверены |
| 1.3.6 / F06 | Medium | `.pre-commit-config.yaml:1`; `.github/workflows/ci.yml:1490–1511` | Не было pre-commit конфигурации. Добавлен hook на commit gitleaks v8.30.0; существующий gitleaks action закреплён по SHA. | Конфигурация готова; hook нужно установить в клонах, настройки GitHub подтвердить |
| 1.3.5, 2.1 / F07 | Medium | `scripts/security/check-public-output.py:1`; `.github/workflows/ci.yml:1550–1554` | Не было gate на исходники/секретные filenames/maps в output. Добавлена проверка, тесты и запуск после CI build. Gate проверяет также отдельные credential patterns, но не заменяет secret scanners. | Локальный gate PASS; CI run и hosting deployment protection не проверены |
| 2.11 / F08 | Medium | `git ls-files '*LICENSE*' '*COPYING*'` — пусто | Нет явного выбора лицензии проекта и полного реестра прав на ассеты. Не назначать MIT или менять права автоматически. | Нужен владелец/юрист |

Дополнительно: `sourcemap: false` явно закреплён в `frontend/vite.config.ts:9` (Vite и ранее по умолчанию не генерировал maps); backend/frontend `.env.example` переведены в список имён с пустыми значениями; вывод ANCHOR_PROVIDER_URL в `scripts/ensure-env.mjs` заменён на сообщение без URL; добавлен `docs/INCIDENT_RESPONSE_15_MIN.md`.

## Объём и методика

- Исходный clone был shallow. Выполнены `git fetch --unshallow origin` и fetch `refs/heads/*` в `refs/remotes/origin/*` с tags. `git rev-list --all --count` = **239**, `git rev-list --objects --all` = **4918 объектов**; 24 remote refs, включая origin/HEAD; tags = 0, local stash пуст. Ветки не переключались, история не переписывалась, push не выполнялся.
- Вспомогательный `scripts/security/secret-inventory.py`: всё текущее дерево без .git/node_modules/cache и каждый reachable blob истории. Игнорируемые Git файлы не исключаются автоматически. Выводит только detector/path/lines/blob, не значения. Binary/OCR/BIP39 dictionary validation не реализованы; история удалённых refs, чужие stash и недоступные PR head refs не доказаны полными.
- Рабочее дерево до правок: 3 файла с base58 87–88, 7 с DB URL patterns, 4 с provider URL patterns, 216 с ключевыми словами. История: 8 blob-версий с base58, 36 с DB patterns, 12 с provider patterns, 861 с ключевыми словами. Это **совпадения на файл/blob, не число секретов**.
- Base58-кандидаты локализованы в `watchtower/events/fixtures/{chain-events.input,chain-txs.input,watchtower-events.expected}.json`: публичные тестовые transaction signatures, не подтверждённые private keys. URL выборка дерева содержит placeholders, локальные тестовые БД, env interpolation, URL без ключей. Полный ручной разбор всех keyword-совпадений и всех исторических URL остаётся незавершённым.
- `gitleaks detect --no-git` и `trufflehog filesystem .` завершились **127 (не установлены)**. Попытки получить gitleaks v8.30.0 и trufflehog v3.97.9 с официальных releases заблокированы сетью (`release-assets.githubusercontent.com`, SSL/EOF), в том числе через gh API. Поэтому реальные detect --all / trufflehog git и scanner-проверка бандла **не выполнены**. TOML разобран Python tomllib, но это не валидация regex движком gitleaks.
- GitHub: прочитаны тела **24 issues/PR**, **48 issue comments**, **0 inline PR comments**, применены те же regex-detectors; только keyword candidates. Actions API показывает **686 artifacts**, их содержимое и полный набор logs не скачивались. Releases = 0; wiki отключена; forks_count = 0. Gists, приватные копии, скриншоты/вложения и удалённые объекты не проверены. Эти числа не доказывают отсутствие внешних копий.
- Сырые загруженные материалы и временные логи оставлены вне Git в исключённом cache; потенциально чувствительные данные не добавлены в репозиторий.

## Статус каждого пункта фазы

`НУЖЕН ЧЕЛОВЕК` означает также недоступный инструмент/внешнюю среду/незавершённую проверку, а не подтверждение безопасности. N/A — только там, где неприменимость доказана.

| Пункт | Статус после правок | Доказательство / оставшаяся работа |
|---|---|---|
| 1.1.1 | НУЖЕН ЧЕЛОВЕК | Оба scanner commands exit 127; supplementary regex выполнен, полного ручного анализа нет |
| 1.1.2 | PASS | `find` по заданным именам: 2 .env.example и 12 SQL schema/migration/test файлов; живых key/dump files по именам не найдено. SQL исходники не удалены |
| 1.1.3 | НУЖЕН ЧЕЛОВЕК | `secret-inventory.py` tree/history; BIP39 12/24 слова и все generic keyword hits требуют полноценного анализа |
| 1.1.4 | НУЖЕН ЧЕЛОВЕК | Текстовые docs/scripts/CI/fixtures входят в scan; изображения, вложения, OCR и полный ручной просмотр не завершены |
| 1.2.1 | НУЖЕН ЧЕЛОВЕК | 239 commits, all reachable blobs проверены regex; gitleaks/trufflehog всей истории не запускались, скрытые/удалённые refs не покрыты |
| 1.2.2 | НУЖЕН ЧЕЛОВЕК | GitHub выборка выше; 686 artifacts + logs + gists/attachments остаются |
| 1.2.3 | PASS | GitHub API и `gh repo view --json isPrivate,url` подтверждают public; всё опубликованное считать раскрытым. Это PASS проверки видимости, не приватности |
| 1.2.4 | НУЖЕН ЧЕЛОВЕК | Подтверждённых credentials пока нет; если найдены — ротация, затем согласованная очистка. Процедура в INCIDENT_RESPONSE_15_MIN |
| 1.2.5 | НУЖЕН ЧЕЛОВЕК | Private wallet key не подтверждён; actual balances/authorities не проверены; действий on-chain не было |
| 1.3.1 | PASS | `.gitignore`, `git ls-files -ci --exclude-standard` пуст; исключения только для обозреваемых шаблонов/SQL исходников |
| 1.3.2 | PASS | backend/frontend `.env.example`: имена без значений, инструкции не копировать как готовую конфигурацию. Legacy `watchtower/config.example.env` содержит документированные не секретные defaults |
| 1.3.3 | НУЖЕН ЧЕЛОВЕК | Хостинг/CI secret manager и runtime не доступны; policy в docs не доказывает исполнение |
| 1.3.4 | НУЖЕН ЧЕЛОВЕК | VITE_* использование осмотрено, бандл проверен regex, deploy values неизвестны; F03 |
| 1.3.5 | НУЖЕН ЧЕЛОВЕК | Build + output gate + regex PASS/triage, но gitleaks на dist не выполнен |
| 1.3.6 | НУЖЕН ЧЕЛОВЕК | pre-commit config добавлен, history CI был и усилен; local hook installation и GitHub scanning/protection не подтверждены |
| 1.3.7 | НУЖЕН ЧЕЛОВЕК | Нужен реестр credential→environment→role→scope и подтверждение со стороны владельца |
| 1.3.8 | НУЖЕН ЧЕЛОВЕК | `aof_backend/src/security/authorityGate.ts:47–76`, docs/SECURITY_RUNBOOK.md описывают режимы; фактическая custody и баланс hot wallet не проверены |
| 1.3.9 | НУЖЕН ЧЕЛОВЕК | F03: исправлена инструкция, действующий RPC proxy/domain quotas не доказаны |
| 1.3.10 | PASS | `docs/INCIDENT_RESPONSE_15_MIN.md`, `docs/SECURITY_RUNBOOK.md`; нужны назначенные ответственные и учения |
| 2.1 | НУЖЕН ЧЕЛОВЕК | `docs/CLOUDFLARE_DEPLOYMENT.md:14–16`: frontend/dist; локально gate PASS; dashboard настроек хостинга не проверен |
| 2.2 | НУЖЕН ЧЕЛОВЕК | Официальный URL не задан; HTTP probing не выполнялся. Проверять тело/Content-Type, SPA fallback 200 не считать утечкой автоматически |
| 2.3 | PASS | `frontend/vite.config.ts:9`; собранный frontend/dist прошёл gate на *.map и sourceMappingURL; только локальный build |
| 2.4 | НУЖЕН ЧЕЛОВЕК | Есть programs/, aof_backend/, frontend/. Проверка server-authoritative economy/RNG/claims — отдельная фаза, существующие отчёты не считаются доказательством |
| 2.5 | НУЖЕН ЧЕЛОВЕК | public: изображения, manifests, headers/routes/robots/sitemap; gate приватных расширений PASS. Непубличность/права на сами ассеты и game balance требуют ручного решения |
| 2.6 | НУЖЕН ЧЕЛОВЕК | Live web server / CDN configuration не доступны, отсутствие листинга не проверено |
| 2.7 | НУЖЕН ЧЕЛОВЕК | Оба .dockerignore добавлены; Dockerfiles используют USER node и выборочный COPY. docker history/Trivy/image build остаются |
| 2.8 | FAIL | F01: сервер в public repo. Разделение/приватизация только с согласованием; ключам не место ни в одном repo |
| 2.9 | PASS | Защита не строится на обфускации; gate и docs требуют считать клиент публичным, серверные проверки отдельно |
| 2.10 | НУЖЕН ЧЕЛОВЕК | branch protection API: 403 Resource not accessible by integration; CODEOWNERS отсутствует. Владелец должен назначить reviewer, подтвердить 2FA, force-push ban и minimum rights |
| 2.11 | НУЖЕН ЧЕЛОВЕК | F08: нет явной LICENSE; осознанный выбор и права на ассеты должен подтвердить владелец/юрист |

## Проверки изменений

- `npm ci --ignore-scripts --no-audit --no-fund` в frontend — успешно (lifecycle scripts намеренно не запускались).
- `npm run build` в frontend — **PASS**, tsc + Vite; предупреждение о JS chunk >500 KB (главный JS около 1.18 MB без gzip). Это не полный Lighthouse.
- `python3 scripts/security/test-public-output.py` — **5/5 PASS**. Проверяет чистую сборку, private names, content patterns без утечки значений, symlink, отсутствие build. Законный wallet-banner.png разрешён.
- `python3 scripts/security/check-public-output.py frontend/dist` — **PASS**.
- Bundle regex: 16 hex-совпадений, 11 уникальных значений; все 11 найдены в установленном исходнике `@noble` как криптографические константы. Не объявлены private keys. Keyword matches требуют обычного triage, не автоматического удаления библиотек.
- `npm run test:security --prefix frontend` — **25/25 PASS**.
- `node --test tests/readiness/*.test.cjs` — **101/101 PASS**.
- `git diff --check` — **PASS**. Полный CI, npm audit, backend/on-chain build, container tests, e2e с кошельком и production smoke — **не выполнены в этой фазе**.

## Проверить вручную / согласовать

- GitHub: public/private решение, конкретные CODEOWNERS, required checks/review, ban force-push, 2FA всех участников, доступы интеграций; Secret Scanning + Push Protection. 403 здесь означает недостаток разрешения проверки, а не проблему аутентификации.
- Хостинг: Cloudflare root/output, deploy только после успешного security gate; `.git/.env/src/server` probes; caching и source maps фактического релиза, CDN/server headers, отсутствие autoindex. CI gate сам по себе не блокирует независимый auto-deploy хостинга.
- DNS/регистратор: TLS, HTTPS redirect, HSTS includeSubDomains после проверки субдоменов, DNSSEC, CAA, registrar lock, MFA, dangling subdomains. В текущем `_headers` CSP частично report-only — полноценный CSP остаётся фазе 3, не ужесточён вслепую с поломкой кошельков/встраивания.
- Кошельки: hardware/multisig, authorities всех программ и токенов, минимальный hot balance, отдельные ключи окружений и pause drill.
- Операции: проверка Actions logs/artifacts и PR attachments, политика публикации failure logs, retention и доступы; не выкладывать raw secret scan reports.

## Для юриста — следующие фазы 5–7

Страны аудитории, юрисдикция оператора, юридическое лицо и контакты **не предоставлены**. Применимость GDPR/UK GDPR/CCPA/152-ФЗ нельзя подтвердить одним наличием сайта. Нужны факты об аудитории, обработке и деятельности оператора.

В кодовой базе есть Solana programs, wallet-клиент, market/rewards/quests/referrals и custody/runbook; это не юридическая квалификация. Проверить: токены/NFT и их стоимость, обещания дохода, платную случайность, санкционные ограничения, KYC/AML, правила несовершеннолетних, налоги, IP/лицензии и атрибуцию.

Privacy/Terms/Cookie Policy/Risk Disclosure, consent logs/GPC, data map/retention/DSAR, processor DPA/SCC, cookies/SDK, доступность и security.txt — **не аудированы в этой фазе**. Не подставлялись вымышленные реквизиты, контакты или правовые основания. Разделы 3–10 продолжить отдельными фазами с доказательством каждого подпункта.

## Список ротаций (без значений)

**Подтверждённых обязательных ротаций пока нет; это не освобождение от проверки.** После полного сканирования и инвентаризации deployment проверить категории: Solana operator/guardian/admin/upgrade/mint/freeze, RPC providers, ADMIN_TOKEN, SESSION_KEYSTORE_KEY, Watchtower exporter token/player hash salt, DB credentials, CI/hosting/Telegram/SMTP tokens (если используются).

Любой действительный секрет, попавший в Git/логи/публичный bundle, считать скомпрометированным, даже если commit удалён. Не ждать очистки истории для ротации. Авторизованную сетевую проверку обнаруженных credentials без разрешения не выполняли.

## Повторный аудит

Каждый PR/release: pre-commit, scanner на tree/history/output, output gate, dependency audit, build/types/lint/tests, проверка фактически развёрнутого release и rollback. До mainnet: независимый аудит контрактов + пентест сайта + юридическое заключение по применимым юрисдикциям. Полный аудит раз в квартал и после изменения custody/auth/rewards/deploy/процессоров. Ни этот отчёт, ни чек-лист не дают 100% защиты.
