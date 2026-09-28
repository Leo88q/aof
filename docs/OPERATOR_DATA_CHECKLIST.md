# Реквизиты оператора: что должен прислать владелец

Версия: 2026-09-28. Это чек-лист данных, не юридическое заключение.

`frontend/src/legal/operator.json` — **публичные** реквизиты оператора. Пока в нём нет настоящих
значений, релизный гейт (`npm run build:release`) намеренно красный, а `security.txt`, `robots.txt`
и `sitemap.xml` с проверенным origin не выпускаются.

**Вымышленные, «примерные» и скопированные у других проектов значения не подставляются.** Реквизиты
оператора — заявление о себе от лица владельца; агент и разработчик не могут его сделать за него.

## Если реквизиты нужно получить у юриста

Готовое письмо-бриф со всеми фактами проекта и вопросами (токены, платная случайность, KYC/AML,
возраст, возвраты, DSAR, налоги) — `docs/LAWYER_BRIEF_2026-09-28.md`. Его можно переслать целиком:
юрист отвечает списком значений для `operator.json` и правками текстов.

## Как увидеть пробел

```bash
cd frontend
npm run legal:report      # список недостающих пунктов: что нужно и где значение появится
```

Отчёт берётся из того же валидатора `scripts/legal-release.mjs`, который держит релиз, поэтому
«в отчёте пусто» и «гейт пройден» — одно и то же состояние, а не два разных мнения.

## Пункты

| Поле | Что прислать | Где станет видно |
|---|---|---|
| `approved` | Подтверждение владельца: тексты проверены, факты совпадают с проектом | гейт `build:release` |
| `operatorName` | Юрлицо или ФИО оператора — полностью, как в реестре | `/legal/contacts`, `/legal/terms` |
| `operatorAddress` | Почтовый адрес для обращений и претензий | `/legal/contacts` |
| `operatorCountry` | Страна регистрации оператора | `/legal/contacts`, `/legal/terms` |
| `registrationDetails` | Регистрационный номер/ИНН либо правомерное обоснование неприменимости | `/legal/terms` |
| `contactEmail` | Рабочий адрес поддержки и претензий; проверить доставку и ответственного | футер, `/legal/contacts` |
| `privacyEmail` | Рабочий адрес для запросов о персональных данных (DSAR) | `/legal/privacy`, `/legal/data-requests` |
| `securityEmail` | Рабочий адрес для сообщений об уязвимостях | `security.txt`, `/legal/disclosure`, `INCIDENT_KIT` |
| `canonicalOrigin` | Официальный HTTPS origin без завершающего `/` и без пути | `sitemap`, `robots`, `security.txt`, canonical-ссылки |
| `governingLaw` | Применимое право и порядок разрешения споров | `/legal/terms` |
| `audienceCountries` | Страны аудитории, под которые проверены тексты | `/legal/terms`, `/legal/risks` |
| `processors` | Фактические процессоры: юрлицо, цель, страна (по строке на каждого) | таблица в `/legal/privacy` |
| `retentionPolicy` | Конкретные сроки хранения по каждой цели, включая резервные копии | `/legal/privacy`, `/legal/cookies` |
| `transferSafeguards` | Механизмы международной передачи данных | `/legal/privacy` |
| `privacyRepresentative` | DPO/представитель либо обоснование неприменимости | `/legal/privacy` |

## После заполнения

1. `npm run legal:report` — пустой список; `npm run test:privacy` и `npm run test:security` зелёные.
2. Юрист правит тексты `src/legal/documents.ts` под факты проекта (возраст, токены/NFT, платная
   случайность, MiCA/KYC/AML/санкции, потребительские права, возвраты, интеллектуальные права);
   предыдущая редакция сохраняется в `src/legal/archive/`, поднимается `operator.version` и дата.
3. При изменении необязательной обработки — поднять `CONSENT_VERSION`.
4. `npm run build:release`, затем проверить реальные HTTP-заголовки, доставку письма на
   security-контакт и корректность origin на домене.

## Другие действия владельца (вне `operator.json`)

| Тема | Где инструкция |
|---|---|
| Squads-мультисиг, роли ключей, KMS/HSM, задержка выводов | `docs/SECURITY_RUNBOOK.md` §1–3 |
| Мониторинг казны, `DeactivateStake`, адреса | `SECURITY_CHECKLIST_ATTACKS_2026-09-28.md` §«Следующие шаги» |
| DNS-регистратор, registrar lock, DNSSEC | `docs/INCIDENT_KIT.md` |
| GitHub: secret scanning + push protection, `pre-commit install` | `SECURITY_CHECKLIST_ATTACKS_2026-09-28.md` #100 |
| `decimals` при листинге минтов | `SECURITY_CHECKLIST_ATTACKS_2026-09-28.md` #96 |
| Пакетирование и задержки выводов | `SECURITY_CHECKLIST_ATTACKS_2026-09-28.md` #127 |
