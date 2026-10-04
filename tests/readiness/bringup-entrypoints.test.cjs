const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

// Точки входа, которые документация и ответы на инциденты зовут ПРЯМО:
// `scripts/deploy-devnet.sh`, `scripts/devnet-bringup.sh`, ... Если у файла нет
// executable-бита, у владельца команда падает с `Permission denied`, а CI этого
// не видит: он везде вызывает `bash <файл>` и `python3 <файл>`. Ровно так
// `scripts/deploy-devnet.sh` уехал в main как 100644 при живом runbook.
const ENTRYPOINTS = [
  'scripts/deploy-devnet.sh',
  'scripts/devnet-bringup.sh',
  'scripts/enable-mining-devnet.sh',
  'scripts/build-local.sh',
  'scripts/verify-programs.sh',
  'scripts/devnet-program-probe.py',
  'scripts/devnet-deploy-estimator.py',
  'scripts/check-idl-drift.py',
  'scripts/verify-address-registry.cjs',
];

test('документированные точки входа исполняемые', () => {
  for (const rel of ENTRYPOINTS) {
    const file = path.join(root, rel);
    assert.ok(fs.existsSync(file), `нет файла ${rel}`);
    const mode = fs.statSync(file).mode;
    assert.ok(mode & 0o111, `${rel} не исполняемый (mode ${(mode & 0o777).toString(8)}) — runbook зовёт его напрямую`);
  }
});

test('bringup — сухой прогон по умолчанию и не включает mainnet', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/devnet-bringup.sh'), 'utf8');
  assert.match(source, /APPLY=0/);
  assert.match(source, /--apply\) APPLY=1/);
  assert.match(source, /AOF_DEPLOY_TARGET.*=.*"devnet"/);
  // Все шаги пути §0 должны быть в одном скрипте: иначе «одна команда» врёт.
  for (const step of [
    'scripts/deploy-devnet.sh',
    'scripts/initConfig.ts',
    'scripts/initMintsV2.ts',
    'caps:init',
    'preflight:mining-devnet',
    'scripts/enable-mining-devnet.sh',
    '/admin/config/collector-mint',
    // Рынок инструментов включается тем же прогоном: без конфига и пулов
    // hot_market_buy/sell остались бы механикой на бумаге.
    '/hot-market/config/init',
    '/hot-market/pool/init',
    // Крафт инструментов читает CraftEconomy и RarityCounter: без них
    // /tools/craft-quote и /tools/craft честно отдают 503, и «включено» врёт.
    '/admin/craft-economy/init',
    '/admin/rarity-counter/init',
    // Конфиги паков, реролла, лотереи и сезона: без аккаунта механика не
    // работает вовсе (покупка пака читает PackConfig, билет — LotteryRound).
    '/packs/config/init',
    '/reroll/config/init',
    '/lottery/round/init',
    '/season/init',
  ]) {
    assert.ok(source.includes(step), `bringup не выполняет шаг ${step}`);
  }
});

test('bringup: SKIP=backend — деплой без backend, и он покрывает все backend-шаги', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/devnet-bringup.sh'), 'utf8');
  // Сокращение обязано существовать и включать каждый шаг, который ходит в backend:
  // иначе «только деплой» упадёт на середине (после деплоя) из-за маршрута,
  // который читает .env backend'а.
  const steps = /BACKEND_STEPS="([^"]+)"/.exec(source);
  assert.ok(steps, 'в bringup нет списка backend-шагов');
  for (const name of ['config', 'mints', 'caps', 'craft', 'mechanics', 'market', 'mining', 'collectors']) {
    assert.ok(steps[1].split(/\s+/).includes(name), `BACKEND_STEPS не содержит ${name}`);
  }
  assert.match(source, /\*,backend,\*\) case " \$BACKEND_STEPS "/, 'SKIP=backend не обрабатывается в skipped()');
  // Гард на требование токена обязан считать по тому же списку, а не по своему
  assert.match(source, /for s in \$BACKEND_STEPS; do skipped "\$s" \|\| NEED_BACKEND=1; done/);
  assert.match(source, /SKIP\$?\{?\}?=|SKIP=backend/);
  assert.ok(source.includes('SKIP=backend'), 'в отказе нет рабочего совета');
  assert.ok(fs.readFileSync(path.join(root, 'scripts/test-devnet-bringup.py'), 'utf8')
    .includes('test_skip_backend_deploys_without_a_backend_and_without_posting'));
});

test('bringup-тест существует и пинит отказы', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/test-devnet-bringup.py'), 'utf8');
  for (const caseName of [
    'test_wrong_target_refuses_before_any_command',
    'test_backend_steps_need_admin_token',
    'test_dry_run_changes_nothing',
    'test_preflight_blocked_never_turns_mining_on',
    'test_market_step_is_idempotent_and_needs_real_mints',
    'test_market_refuses_without_currency_addresses',
    'test_craft_step_creates_economy_and_rarity_counters',
    'test_craft_step_is_idempotent',
    'test_craft_failure_refuses',
    'test_craft_rarity_out_of_range_refuses',
    'test_skip_craft_leaves_craft_closed',
    'test_mechanics_step_configures_packs_lottery_season_reroll',
    'test_mechanics_step_is_idempotent',
    'test_mechanics_failure_refuses',
    'test_skip_mechanics_leaves_configs_unset',
    'test_the_refusal_names_a_skip_list_that_actually_works',
    'test_skip_backend_deploys_without_a_backend_and_without_posting',
  ]) {
    assert.ok(source.includes(caseName), `нет теста ${caseName}`);
  }
});

test('dev-local.sh поднимает фоновые сервисы и совместим с bash 3.2 (macOS)', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/dev-local.sh'), 'utf8');
  const scripts = JSON.parse(
    fs.readFileSync(path.join(root, 'aof_backend/package.json'), 'utf8'),
  ).scripts;

  // 1) Каждый сервис из списка по умолчанию обязан существовать как npm-скрипт:
  //    переименование скрипта иначе превратит `WITH_SERVICES=1 ... up` в тихо
  //    не запустившийся процесс, и витрины останутся «неизвестно» без причины.
  const services = source.match(/^SERVICES="\$\{SERVICES:-([^}]+)\}"/m);
  assert.ok(services, 'в dev-local.sh нет списка SERVICES по умолчанию');
  const names = services[1].split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(names.length >= 4, `SERVICES по умолчанию слишком короткий: ${names.join(',')}`);
  for (const name of names) {
    const mapped = source.match(new RegExp(`${name.replace(/-/g, '\\-')}\\)\\s+echo ([a-z-]+) ;;`));
    assert.ok(mapped, `в service_script нет соответствия для ${name}`);
    assert.ok(
      scripts[mapped[1]],
      `сервис ${name} маппится на npm-скрипт ${mapped[1]}, которого нет в aof_backend/package.json`,
    );
  }

  // 2) Скрипт — часть runbook владельца на macOS, где /bin/bash 3.2:
  //    `local -n` (nameref) там не существует и роняет запуск целиком.
  //    Проверяем только код: комментарии про эти же ограничения — можно.
  const code = source.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');
  assert.doesNotMatch(code, /local -n /, 'nameref (`local -n`) не работает в bash 3.2 на macOS');
  assert.doesNotMatch(code, /declare -A/, 'ассоциативные массивы не работают в bash 3.2 на macOS');
  assert.doesNotMatch(code, /[^\w-]wait -n/, '`wait -n` не работает в bash 3.2 на macOS');

  // 3) Без WITH_SERVICES скрипт обязан сказать, как их включить, — иначе
  //    владелец не узнает, что «неизвестно» в игре лечится пятью сервисами.
  assert.match(source, /WITH_SERVICES/, 'нет переменной WITH_SERVICES');
  assert.match(source, /WITH_SERVICES=1 bash scripts\/dev-local\.sh up/, 'нет подсказки, как включить сервисы');

  // 4) Сервисы, у которых есть порт, обязаны иметь и проверку живости: «поднято»
  //    без проверки — это то же предположение, которое мы убираем.
  assert.match(source, /service_port\(\)/, 'нет функции service_port');
  assert.match(source, /kill -0 "\$pid"/, 'живость сервиса не проверяется');
});
