# Devnet: первая оплаченная капсула и первый инструмент

Дата наблюдения: 2026-10-08. Это запись фактов с Devnet, не разрешение включать добычу и не проверка байткода.

Игровой кошелёк: `HPMr5r9sS5ApWsPNJytZRLbm2jz1veFxTn1wepjAhtho`.

Оплата прошла. Подпись `66ocE9hc3U1tpyinxSyEn5Wa6JqkRH7Wjev8LMkokJF1hM9jFRCWy7W7VnF6tAccGf1Sw5zQEDUL9CAuQ7jao7fG`, слот `508722677`, `err None`, комиссия `10000` лампортов. Инструкция `PackOpenCommit` программы `okiLaCvFyHqFRFf359emmunPKD77uUmLQ2iJWskZdnx`, затем Switchboard `RandomnessCommit`. Списание с кошелька `119413080` лампортов: `119403080` за цену малой капсулы и аренду плюс комиссия сети. Баланс до списания `9934280012` лампортов.

Раскрытие подтверждено отдельно. `GET /packs/status/59zLmWX1QehaL3MNnVyxfqFp2KKaXoEt9iDT4PQJZWHF` вернул `state=settled`. Минт `GqKbP8F9HMW3E6EkY9wSLGuUKxZsMfmamE1jmgLdygXJ`. Инструмент: `plasma_cutter`, редкость `common`, прочность `20`.

До запуска `vrf-settler` тот же коммит был в `GET /vrf/pending` с фазой `revealable`. После запуска процесса список ожидания стал пустым, а статус капсулы — `settled`. Кнопка самораскрытия в странице блокировалась стражем на программе `metaqbxx`; раскрытие сделал сетлер, не эта кнопка.

Отправка оплаты идёт через подпись Phantom и `sendRawTransaction` игры, коммит `69c9b3d`. Это не smoke добычи и не `verify-programs.sh --require-bytecode`.


## Проверка байткода перед добычей

2026-10-08, `scripts/verify-programs.sh --require-bytecode`, код выхода `0`. Хост RPC в выводе: `devnet.helius-rpc.com`. Ключ не печатался. Authority всех шести программ: `C8MS1G3g7aR39pAGYnFjcz4uj693dYw3icWTMCV7cYRN`. Это сравнение локальных `.so` с байткодом в Devnet, не включение добычи и не smoke сбора.

| Программа | Префикс sha256 |
|---|---|
| aof_session_keys | `ca443823a8c5` |
| aof_liquidity | `f956dae17a79` |
| aof_rebirth | `48c2862bd4dd` |
| aof_quests | `4fce12cd3ad4` |
| aof_market | `8494b03ad7bd` |
| aof_core | `568260dd5df1` |
