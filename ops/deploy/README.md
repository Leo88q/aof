# Слот деплоя

Общая раскладка: `docs/VPS_CLOUDFLARE_LAYOUT.md`.

Проверка репозитория, без ящика: `ops/preflight.sh`.

На VM, когда файлы заполнены: `ops/up.sh --check`, затем `ops/up.sh --apply`.
Скрипт не деплоит программы и не открывает закрытые механики.

Ключ другой игры в `ops/deploy/secrets/crank_keypair.json` здесь не создавать.
Горячий кошелёк — `secrets/vrf_settler_secret_key` (`chmod 600`). Ключ operator
на этот ящик не класть. `docker-compose.secrets.yml` для этого пути не используется.
