# Devnet: первая оплаченная капсула и первый инструмент

Дата наблюдения: 2026-10-08. Это запись фактов с Devnet, не разрешение включать добычу и не проверка байткода.

Игровой кошелёк: `HPMr5r9sS5ApWsPNJytZRLbm2jz1veFxTn1wepjAhtho`.

Оплата прошла. Подпись `66ocE9hc3U1tpyinxSyEn5Wa6JqkRH7Wjev8LMkokJF1hM9jFRCWy7W7VnF6tAccGf1Sw5zQEDUL9CAuQ7jao7fG`, слот `508722677`, `err None`, комиссия `10000` лампортов. Инструкция `PackOpenCommit` программы `okiLaCvFyHqFRFf359emmunPKD77uUmLQ2iJWskZdnx`, затем Switchboard `RandomnessCommit`. Списание с кошелька `119413080` лампортов: `119403080` за цену малой капсулы и аренду плюс комиссия сети. Баланс до списания `9934280012` лампортов.

Раскрытие подтверждено отдельно. `GET /packs/status/59zLmWX1QehaL3MNnVyxfqFp2KKaXoEt9iDT4PQJZWHF` вернул `state=settled`. Минт `GqKbP8F9HMW3E6EkY9wSLGuUKxZsMfmamE1jmgLdygXJ`. Инструмент: `plasma_cutter`, редкость `common`, прочность `20`.

До запуска `vrf-settler` тот же коммит был в `GET /vrf/pending` с фазой `revealable`. После запуска процесса список ожидания стал пустым, а статус капсулы — `settled`. Кнопка самораскрытия в странице блокировалась стражем на программе `metaqbxx`; раскрытие сделал сетлер, не эта кнопка.

Отправка оплаты идёт через подпись Phantom и `sendRawTransaction` игры, коммит `69c9b3d`. Это не smoke добычи и не `verify-programs.sh --require-bytecode`.
