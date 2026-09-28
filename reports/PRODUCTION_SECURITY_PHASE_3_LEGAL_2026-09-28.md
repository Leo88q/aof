# Защита сайта и правовые страницы — второй этап

Дата: 2026-09-28. Продолжение отчёта `PRODUCTION_SECURITY_PHASE_1_2_2026-09-28.md`.

**Production по-прежнему не одобрен.** Выполнена часть раздела 3 и реализация клиентской части разделов 4–7. Это не завершённый OWASP/GDPR-аудит. По решению владельца приватизация GitHub отложена до завершения сборки; агент видимость и историю не менял. Уже опубликованное нужно считать раскрытым и после приватизации.

## Сводка

7 сгруппированных находок этого этапа: **Critical — 0 подтверждено, High — 2, Medium — 5**. Предыдущие незакрытые находки не обнуляются.

Пять приоритетов перед релизом:
1. Заполнить реальные реквизиты, privacy/security контакты, юрисдикции и утвердить тексты; не подменять это переключением `approved`.
2. Утвердить карту данных, цели/основания, retention и процессоров; реализовать и проверить серверные DSAR и договорный акцепт, если он необходим.
3. Завершить CSP с конкретным allowlist соединений, проверить реальные кошельки, RPC/API и фактические headers на staging.
4. Продолжить исходный secret audit и полный анализ backend/auth/экономики; нынешний этап не закрывает эти проверки.
5. Установить на хостинге `npm run build:release`, ограничить staging и проверить файлы/контакты реально развёрнутого релиза. Обычный `build` юридический gate обходит.

## Находки

| ID чек-листа | Приоритет | Доказательство | Описание / исправление | Статус |
|---|---|---|---|---|
| 4.6 / L01 | Medium | `frontend/index.html`, `src/ui/fonts.ts` | В HTML были Google Fonts stylesheet/preconnect. Удалены; существующие Inter/JetBrains Mono/Playfair Display поставляются локально | Исправлено; browser smoke не обнаружил Google Fonts requests |
| 4.1–4.4 / L02 | Medium | `src/legal/consent.ts`, `ExtraSections.tsx`, `FarmDashboard.tsx`, `manorFx.ts` | Журнал посещений и настройки писались без выбора. Все четыре known optional storage keys переведены на consent wrapper, default deny, отзыв и GPC | Исправлена проверенная клиентская часть; production CDN/SDK остаются на инвентаризацию |
| 5.2, 5.4, 7.1–7.2 / L03 | High | `src/legal/operator.json`, `documents.ts`, `scripts/legal-release.mjs` | Не было полного комплекта документов и подтверждённых реквизитов. Добавлены семь страниц, draft-маркировка, контакты-шаблон, архив и release gate | Частично исправлено; юридическое утверждение/фактические реквизиты и DSAR-backend обязательны |
| 3.2.1 / L04 | High | `frontend/public/_headers` | Enforcement CSP не ограничивал scripts, framing был разрешён same-origin. Добавлены script-src self и frame-ancestors none, X-Frame-Options DENY | Частично исправлено: connect/style/default CSP ещё report-only; runtime wallets и headers проверить отдельно |
| 7.6 / L05 | Medium | `frontend/index.html` | Viewport запрещал zoom. Убраны maximum-scale=1 и user-scalable=no | Исправлено; это не полная WCAG AA проверка |
| 7.4 / L06 | Medium | `frontend/public/licenses/*.txt`, ссылки в LegalCenter | Для локальных шрифтов добавлены исходные OFL notices | Частично исправлено: код/изображения/музыка/ассеты и лицензия проекта требуют полного реестра |
| 3.8.1 / L07 | Medium | `npm audit --omit=dev --json` в frontend | Runtime dependency audit: 12 Moderate, 0 High, 0 Critical | Открыто; автоматические major/force updates не применялись; dev/backend dependencies не включены в этот результат |

## Реализовано на сайте и в приложении

Текущая редакция **2026-09-28.2**, явно **проект**:
- `/legal/privacy`: цели, категории данных, предлагаемые основания, получатели/передачи, хранение, права, блокчейн и дети;
- `/legal/terms`: стороны, проект возрастных/территориальных правил, кошелёк, честная игра, активы/расходы, IP, споры и обязательные права;
- `/legal/cookies`: таблица хранения, срок, категории, GPC/отзыв;
- `/legal/risks`: рыночные, технические, правовые риски, необратимость и случайность;
- `/legal/data-requests`: DSAR-канал, проверка личности, сроки, ограничения;
- `/legal/disclosure`: безопасное раскрытие, границы разрешённого тестирования; bounty не обещан;
- `/legal/contacts`: реквизиты и контакты, отсутствующие значения отмечены;
- `/legal/archive/2026-09-28.1/:slug`: неизменяемый JSON-снимок первоначальной draft-редакции.

Общий футер со всеми документами и постоянной кнопкой настроек доступен на сайте и в приложении; в app-shell есть дополнительная короткая навигация. Перед подключением через WalletButton — предупреждение о seed/private key, публичности адреса, рисках подписания, ссылки и **пустой checkbox**. Это не серверная запись принятия договора и не возрастная верификация. WalletProvider autoConnect отключён.

Удалено безусловное утверждение в правилах, что игровые токены «не инвестиционные инструменты»: юридическая квалификация не устанавливается названием в UI.

## Проверенные статусы по затронутым пунктам

| Пункт | Статус | Граница доказательства |
|---|---|---|
| 3.2.1 | FAIL | Partial enforcement усилен; остальные директивы report-only, конкретный connect allowlist не завершён |
| 3.2.2 | НУЖЕН ЧЕЛОВЕК | _headers содержит nosniff/referrer/permissions; доставка этих headers production не проверена |
| 3.3.1 | НУЖЕН ЧЕЛОВЕК | Поиск опасных HTML/eval sinks в frontend/src не дал совпадений; это не анализ всех зависимостей/динамических URL/backend |
| 3.8.1 | НУЖЕН ЧЕЛОВЕК | Только frontend runtime: 0 High/Critical, 12 Moderate; не полный dependency audit |
| 3.9.1 | PASS | UI предупреждает о seed/private key; страницы и WalletSafetyNotice |
| 3.9.2 | НУЖЕН ЧЕЛОВЕК | Предупреждение добавлено, существующие guard tests зелёные; реальное информированное подтверждение всех transaction flows ещё не проверено |
| 4.1–4.2 | НУЖЕН ЧЕЛОВЕК | Таблица known app keys есть; реальные хостинг/CDN/кошельки/SDK требуют browser inventory на production |
| 4.3 | PASS | В проверенной реализации default deny, равные кнопки accept/reject, функциональная категория unchecked, отзыв, без cookie wall |
| 4.4 | НУЖЕН ЧЕЛОВЕК | Локальная квитанция version/time/categories/random ID, 180 дней; это не централизованный юридический consent log |
| 4.5 | НУЖЕН ЧЕЛОВЕК | Cookie Policy и таблица добавлены, production extras неизвестны |
| 4.6 | PASS | Внешние Google Fonts запросы убраны; browser smoke подтверждает для посещённых страниц |
| 4.7 | НУЖЕН ЧЕЛОВЕК | Все сторонние embeds/будущие SDK ещё требуют полной инвентаризации |
| 4.8 | PASS | GPC блокирует optional storage, unit + browser тесты; Google Consent Mode не подключался (Google analytics/ads в этом модуле отсутствуют) |
| 4.9 | НУЖЕН ЧЕЛОВЕК | Собственный минимальный механизм, без маркетинга/аналитики; не сертифицированная CMP |
| 5.1.1–5.1.5 | НУЖЕН ЧЕЛОВЕК | Начальная data map в ops-документе, wallet/IP/fingerprint не названы анонимными; правовые основания/сроки/минимизация требуют утверждения и jobs |
| 5.2.1–5.2.4 | НУЖЕН ЧЕЛОВЕК | Страницы/даты/версии/архив/ссылки добавлены; финальные тексты, оператор и юрисдикции ещё неизвестны |
| 5.3.1–5.3.4 | НУЖЕН ЧЕЛОВЕК | Нет ложного акцепта чернового договора. Требуется утверждённый flow регистрации/акцепта и серверный audit trail; age gate и double opt-in не реализованы этим этапом |
| 5.4.1–5.4.4 | НУЖЕН ЧЕЛОВЕК | Процедура описана, контакт отсутствует; DSAR export/delete/auth endpoints не добавлены, применимость CCPA/CPRA не определена |
| 5.5.1–5.5.5 | НУЖЕН ЧЕЛОВЕК | DPA/SCC/retention/DPIA/DPO, crypto at rest, логи/процессоры и 72-hour process требуют ответственного и фактической проверки |
| 6.1–6.5 | НУЖЕН ЧЕЛОВЕК | В проекте tokens/NFT, market/rewards, drum/lottery pages; юридическую квалификацию, географию, KYC/AML и налоги агент не устанавливает |
| 7.1 | НУЖЕН ЧЕЛОВЕК | Ссылки и страницы доступны, реквизиты пока draft |
| 7.2 | НУЖЕН ЧЕЛОВЕК | Generator security.txt с expiry/canonical/policy есть; файл не выпускается с вымышленным контактом, ждёт реальных данных |
| 7.3 | PASS | robots не раскрывает приватные пути; убран localhost Sitemap directive, release generator задаёт canonical origin |
| 7.4 | НУЖЕН ЧЕЛОВЕК | Три font notices добавлены, полный IP/asset/software license audit ещё не сделан |
| 7.5 | НУЖЕН ЧЕЛОВЕК | Порядок copyright complaint в Terms, реальный общий контакт нужно назначить; необходимость отдельного режима зависит от UGC и юрисдикции |
| 7.6 | НУЖЕН ЧЕЛОВЕК | Zoom разрешён, labels/landmarks/focus/таблица с прокруткой, mobile width smoke PASS; скринридер/контраст всех экранов/WCAG/EAA не утверждены |

Все остальные подпункты раздела 3, инфраструктура и полный раздел 8–10 остаются следующей фазе; данная таблица не присваивает им PASS.

## Проверки

- `npm run build --prefix frontend`: **PASS** (tsc + Vite); остаётся предупреждение chunk >500 KB, основной JS ~1.23 MB без gzip.
- `npm run test:privacy --prefix frontend`: **8/8 PASS**.
- `npm run test:security --prefix frontend`: **25/25 PASS**.
- `node --test tests/readiness/*.test.cjs`: **101/101 PASS**. Старый CSP-test ожидавший frame-ancestors self обновлён на более строгие none + script-src self.
- `python3 scripts/security/test-public-output.py`: **5/5 PASS**; gate на текущем dist **PASS**.
- `frontend/tests/privacy-browser.mjs`: **PASS**, Chromium, 390×844, семь legal routes, архив, no horizontal overflow, deny/accept/revoke, GPC, no Google Fonts и no JS page errors на этих маршрутах. Скрипт сохранён для повторного запуска. Browser/tooling binaries не добавлены в Git.
- `npm run release:check --prefix frontend`: **ожидаемый FAIL**, отсутствуют утверждение/реквизиты. Это полезный production blocker, а не ошибка обычной сборки.
- `git diff --check`: **PASS**.
- Browser smoke работал с Vite dev preview; **production CSP, backend, транзакции, другие кошельки и реальный домен этим тестом не проверены**. `_headers` применяется хостингом, не dev-сервером.

## Что предоставить владельцу и юристу

1. Название оператора, страна, адрес, регистрационные сведения.
2. Official domain и три контактных email: общий / персональные данные / безопасность (могут совпадать при реально назначенных ответственных).
3. Страны аудитории, возрастная политика, модель токенов/NFT/платной случайности, утверждённый порядок споров.
4. Hosting/CDN/RPC/email/push/analytics/antibot processors и страны, договоры, сроки хранения/бэкапов, DPO/представитель.

Подробные процедуры релиза, data map, DSAR, versioning, проверки согласия и лицензий: `docs/LEGAL_AND_PRIVACY_OPERATIONS.md`.

Новых подтверждённых секретов и выполненных ротаций в этом этапе нет. Старые ограничения secret audit сохраняются. После каждого релиза — automated gates и browser smoke на фактическом домене; полный аудит ежеквартально и при изменениях auth/custody/economy/processors. Перед реальными средствами остаются необходимыми независимый аудит программ, пентест и юридическое заключение.
