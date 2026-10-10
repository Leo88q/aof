# VPS + Cloudflare вместо отдельного хостинга

Это раскладка ящиков и счетов, не разрешение на mainnet и не команда деплоя.
Программы, церемонии и холодные ключи остаются на отдельной машине. Четыре
закрытые механики SKR этим файлом не открываются: в `.env` ящика не задавать
`AOF_SKR_CRAFT=live` и не задавать `AOF_RANDOMNESS`.

Связка из другой игры подходит как место и счёт. Процессы этой игры другие:
их нельзя подменить именами из той схемы.

## Что переносится как есть

```
игрок → Cloudflare (HTTPS, оранжевое облако)
           │
           ├─ app.…  →  VPS mainnet    /srv/aof
           └─ dev.…  →  VPS devnet     /srv/aof, другой .env и другие горячие ключи
```

Один счёт Cloudflare, один счёт VPS-провайдера, один счёт R2 или Backblaze.
Так же для остальных игр: те же три счёта, каталог `/srv/<игра>`, тот же cron
бэкапа. Платить и смотреть проще, чем когда у каждой игры свой хостинг.

Mac (или другая офлайн-машина) делает только программы, церемонии Squads и
холодные ключи. Кран там не крутится.

## Что здесь устроено иначе

| В другой игре | Здесь | Почему не копировать |
|---|---|---|
| кран внутри процесса API | `vrf-settler` — отдельный контейнер в том же compose и на том же ящике | Раскрытия permissionless. Воркеру нельзя отдавать ключ operator. Тест `tests/readiness/compose.test.cjs` это фиксирует. |
| `ops/deploy/secrets/crank_keypair.json` | `secrets/vrf_settler_secret_key` | Путь зашит в `docker-compose.vps.yml`. `docker-compose.secrets.yml` монтирует ключ operator в API и для этого ящика не используется. |
| nginx слушает 8080 | API слушает 8080 только на `127.0.0.1`; nginx слушает 80 | Иначе два процесса дерутся за один порт, а API оказывается в интернете мимо прокси. |
| Redis обязателен | Redis не нужен | Один процесс API, лимитер в памяти. Redis понадобится только перед второй репликой API. |
| Postgres нет, и это правильно | baseline тоже SQLite | `docker-compose.postgres.yml` — отдельная миграция, не этот запуск. |
| GHCR + `images.env` + `ops:up` | сборка на ящике из зафиксированного коммита | Реестра образов в этом репозитории нет. Выдуманный `images.env` ничего не переключает. |
| Turnstile на игроке | виджета и проверки токена нет | Тот же аккаунт Cloudflare можно использовать для других игр. Включение виджета в панели эту игру не защищает. |

Горячий ключ на VPS — это кошелёк `vrf-settler`: операционный SOL на комиссии и
аванс rent, который раскрытие возвращает. Он не выбирает исход. Это не казна,
не upgrade и не ключ operator. Ключ operator на mainnet-ящик не класть:
production-поза — `AUTHORITY_MODE=read-only` и `AUTHORITY_PUBKEY` в `.env`.
`price-cranker` не включать: он как раз подписывает ключом operator и сидит
за профилем `market`.

## Три игры на одних счетах

Отдельная VM на игру, даже если счёт провайдера один. Общий демон Docker — это
один root: отдельные пользователи Linux контейнеры друг от друга не отделяют.
Потеря ящика забирает горячий кошелёк settler и SQLite этой игры, но не должна
забирать две другие.

```
/srv/aof/                      # checkout, compose project name: aof
  aof_backend/.env             # не в git; на devnet и mainnet разный
  secrets/vrf_settler_secret_key   # chmod 600, каталог 700; не ключ operator
  frontend/dist                # статика, которую отдаёт nginx
  backups/                     # локальная копия до отправки в R2
```

Devnet и mainnet — разные VM, разные `secrets/`, разные RPC, разные
`ADMIN_TOKEN`. Каталог с mainnet-ключами на devnet-ящик не копировать.

Индексатор (`--profile indexer`) пишет в тот же SQLite. На этом запуске его
не поднимать: второй писатель держит единственную блокировку файла. Его место
на ящике остаётся, включать его отдельно, когда это сознательное решение.

## Что сделать руками

1. Две VM, Docker. На каждой: checkout в `/srv/aof`, `docker compose -f docker-compose.prod.yml build`.
2. `aof_backend/.env` (`AOF_CLUSTER=mainnet` или `devnet`, HTTPS `CORS_ORIGIN`, `WALLET_PROOF_DOMAIN`, `RPC_URL`, `AUTHORITY_PUBKEY`, `PROGRAM_ID`, `EXPECTED_GENESIS_HASH`) и `secrets/vrf_settler_secret_key` (`solana-keygen new`, `chmod 600`, на кошельке ≥ 1 SOL). На mainnet — `AUTHORITY_MODE=read-only`, без файла ключа operator. `ops/up.sh` всё равно принудительно ставит read-only.
3. DNS в Cloudflare, оранжевое облако. TLS у них. На ящике: `ops/nginx/refresh-cloudflare-ips.sh`, затем `AOF_LOCK_ORIGIN=yes ops/nginx/lock-origin.sh --apply` (если SSH не на 22, задай `AOF_SSH_PORT`), затем `AOF_SERVER_NAME=app.example.com ops/nginx/install.sh --apply`. Если порт 80 уже закрыт файрволом хостера, вместо lock-origin поставь `AOF_ORIGIN_FIREWALL=external`. Режим SSL Full, не Flexible. Origin открыт только диапазонам Cloudflare, иначе IP ящика обходит облако.
4. `BACKUP_S3_URI` на R2 или Backblaze и cron на `scripts/backup-db.sh`. Без этого бэкап остаётся на диске ящика.
5. На машине сборки: `ops/build-static.sh mainnet` или `devnet`. На ящике: `ops/up.sh --check`, затем `ops/up.sh --apply` только когда `ops/deploy/release.sha` совпадает с HEAD. Скрипт поднимает `backend` и `vrf-settler` через `docker-compose.vps.yml` и отказывается от `docker-compose.secrets.yml`. Откат = предыдущий коммит в `release.sha` и тот же `--apply`. Это не деплой программ и не `keys --apply`.

Статика и API этой игры не смешиваются в одном origin случайно. Клиент по
умолчанию ходит в `/api`; nginx снимает этот префикс один раз. Подпись
кошелька подписывает путь уже без `/api` (`/tools/craft`). Второй `rewrite`
или лишний слэш ломает проверку. Если вместо этого собирать клиент с
`VITE_API_URL=https://api.…` без суффикса `/api`, nginx префикс не снимает, а
`CORS_ORIGIN` равен origin страницы. Один из двух способов, не оба сразу.

`TRUST_PROXY_HOPS=1`. Nginx подставляет адрес из `CF-Connecting-IP` и не
дописывает цепочку `X-Forwarded-For`. Больше одного доверенного прыжка — клиент
подделывает IP и обходит лимит. Ноль — все игроки делят лимит адреса Cloudflare.

Кэш Cloudflare на `/api/` выключен. Порт 8081 (цены) и 8790 (watchtower) наружу
не публиковать: эти сервисы за профилями и в эту раскладку не входят.

Страницы Cloudflare (`docs/CLOUDFLARE_DEPLOYMENT.md`) остаются другим
проверенным способом отдать статику. Не держать одновременно Pages и nginx на
один и тот же hostname.
