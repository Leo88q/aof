'use strict';
/*
 * Гейты вокруг ёмкости программ (max_len) и стоимости деплоя на devnet.
 *
 * Поведение самих скриптов проверяют `scripts/test-deploy-devnet.py` и
 * `scripts/test-devnet-deploy-estimator.py` (настоящий bash + поддельный RPC).
 * Здесь — то, что должно оставаться верным НЕЗАВИСИМО от них: чтобы будущая
 * правка не вернула молчаливый запас, не разошлись константы кластера и не
 * сломался запуск на macOS (bash 3.2), где CI не бывает.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const DEPLOY = 'scripts/deploy-devnet.sh';
const BRINGUP = 'scripts/devnet-bringup.sh';
const ESTIMATOR = 'scripts/devnet-deploy-estimator.py';

// Единственный источник правды о devnet — уже используемый в репозитории genesis.
const CANONICAL_GENESIS = /const GENESIS_DEVNET = '([1-9A-HJ-NP-Za-km-z]+)'/.exec(read('aof_backend/scripts/miningDevnetPreflight.ts'))[1];

test('genesis devnet один и тот же в каждом месте, где он зашит', () => {
  assert.match(CANONICAL_GENESIS, /^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
  assert.match(read('scripts/verify-address-registry.cjs'), new RegExp(`'${CANONICAL_GENESIS}'`));
  assert.match(read(DEPLOY), new RegExp(`DEVNET_GENESIS_HASH="${CANONICAL_GENESIS}"`));
  assert.match(read(ESTIMATOR), new RegExp(`DEVNET_GENESIS = "${CANONICAL_GENESIS}"`));
  assert.match(read('scripts/devnet_mock_rpc.py'), new RegExp(`DEVNET_GENESIS = "${CANONICAL_GENESIS}"`));
});

test('деплой не зовёт solana program deploy без явного --max-len', () => {
  const source = read(DEPLOY);
  const deployCalls = source.split('\n').filter((line) => /^\s*solana program deploy\b/.test(line) && !/^\s*echo\b/.test(line));
  assert.ok(deployCalls.length >= 1, 'в скрипте нет вызова solana program deploy');
  for (const line of deployCalls) {
    assert.match(line, /--max-len "\$MAXLEN"/, `деплой без явного --max-len: ${line.trim()}`);
  }
  // и сухой прогон показывает ту же команду, что выполнится
  assert.match(source, /echo "   solana program deploy .* --max-len \$MAXLEN /);
});

test('политика ёмкости проверяется раньше любой сети и не имеет молчаливого значения', () => {
  const source = read(DEPLOY);
  const policy = source.indexOf('check-policy');
  const cluster = source.indexOf('estimator cluster');
  const plan = source.indexOf('estimator plan');
  const firstDeploy = source.search(/^\s*solana program deploy\b/m);
  assert.ok(policy > 0 && policy < cluster && cluster < plan && plan < firstDeploy,
    'порядок: политика → кластер → агрегатный расчёт → первая транзакция');
  // ни одно из имён переменных политики не получает значение по умолчанию
  assert.doesNotMatch(source, /PROGRAM_MAX_LEN_POLICY="\$\{PROGRAM_MAX_LEN_POLICY:-/);
  assert.doesNotMatch(source, /PROGRAM_MAX_LEN_HEADROOM_PERCENT="\$\{PROGRAM_MAX_LEN_HEADROOM_PERCENT:-/);
  const estimator = read(ESTIMATOR);
  assert.match(estimator, /def resolve_policy\(name: Optional\[str\], headroom_percent: Optional\[str\]\) -> Policy:/);
  assert.doesNotMatch(estimator, /environ\.get\("PROGRAM_MAX_LEN_POLICY",/, 'у PROGRAM_MAX_LEN_POLICY не должно быть значения по умолчанию');
});

test('баланс считается по всем программам до первой транзакции, а MIN_SOL — не проверка достаточности', () => {
  const source = read(DEPLOY);
  assert.match(source, /OPERATOR_RESERVE_SOL="\$\{OPERATOR_RESERVE_SOL:-\$MIN_SOL\}"/);
  assert.match(source, /DEPLOY_FEE_RESERVE_SOL="\$\{DEPLOY_FEE_RESERVE_SOL:-0\.1\}"/);
  assert.doesNotMatch(source, /\[ *"\$BALANCE" *-(ge|gt|lt|le) *"\$MIN_SOL" *\]/, 'MIN_SOL не должен снова стать единственной проверкой');
  assert.match(source, /--payer "\$AUTHORITY_PUBKEY"/);
  assert.match(source, /ни одной транзакции не отправлено/);
});

test('скрипты деплоя и bringup совместимы с bash 3.2 (macOS): без declare -A, nameref, wait -n, mapfile', () => {
  for (const rel of [DEPLOY, BRINGUP]) {
    const code = read(rel);
    assert.doesNotMatch(code, /declare -A/, `${rel}: ассоциативные массивы не работают в bash 3.2`);
    assert.doesNotMatch(code, /local -n /, `${rel}: nameref не работает в bash 3.2`);
    assert.doesNotMatch(code, /[^\w-]wait -n/, `${rel}: wait -n не работает в bash 3.2`);
    assert.doesNotMatch(code, /\b(mapfile|readarray)\b/, `${rel}: mapfile/readarray нет в bash 3.2`);
    assert.doesNotMatch(code, /\$\{[A-Za-z_]+(,,|\^\^)\}/, `${rel}: преобразование регистра в ${'${var,,}'} нет в bash 3.2`);
    assert.doesNotMatch(code, /&>>|\|&/, `${rel}: &>> и |& нет в bash 3.2`);
    // `${arr[@]}` у пустого массива при `set -u` в bash 3.2 — «unbound variable»
    // (исправлено только в 4.4), а после появления UPGRADE запуск без единой
    // отсутствующей программы — обычное дело.
    for (const name of ['MISSING', 'UPGRADES']) {
      const loop = `for entry in "\${${name}[@]}"`;
      if (code.includes(loop)) {
        assert.ok(code.includes(`if [ "\${#${name}[@]}" -gt 0 ]; then`),
          `${rel}: ${loop} без guard по длине ломает macOS bash 3.2 при set -u`);
      }
    }
  }
});

test('оценщик — исполняемая точка входа, подключён в CI и описан в документации', () => {
  assert.ok(fs.statSync(path.join(root, ESTIMATOR)).mode & 0o111, 'оценщик не исполняемый');
  assert.match(read('.github/workflows/ci.yml'), /python3 scripts\/test-devnet-deploy-estimator\.py/);
  const doc = read('docs/DEVNET_DEPLOY_COSTS.md');
  for (const needle of ['exact', 'headroom', 'legacy-2x', 'getMinimumBalanceForRentExemption', 'solana program extend',
    'buffer', '36', '45', '37', 'cli/src/program.rs:1414']) {
    assert.ok(doc.includes(needle), `docs/DEVNET_DEPLOY_COSTS.md не упоминает «${needle}»`);
  }
});

test('оценщик читает сеть и не отправляет: нет ключей, транзакций, закрытия и airdrop', () => {
  const source = read(ESTIMATOR);
  for (const forbidden of ['sendTransaction', 'requestAirdrop', 'simulateTransaction', 'subprocess', 'os.system']) {
    assert.ok(!source.includes(forbidden), `оценщик содержит ${forbidden}`);
  }
  // секреты и ключи не читаются: ни путей к keypair-файлам, ни переменных секретов
  for (const secret of ['AUTHORITY_SECRET_KEY', 'ADMIN_TOKEN', 'keypair.json', 'seed phrase']) {
    assert.ok(!source.replace(/seed phrase[^\n]*/g, '').includes(secret), `оценщик упоминает секрет ${secret}`);
  }
});

test('оценщик не хранит ставку за байт: цифры rent приходят только из RPC', () => {
  const source = read(ESTIMATOR);
  for (const rate of ['6960', '6333', '5080', '3480', '2575', '1322']) {
    assert.ok(!new RegExp(`(?<![0-9A-Za-z])${rate}(?![0-9A-Za-z])`).test(source), `зашита ставка ${rate}`);
  }
  assert.match(source, /getMinimumBalanceForRentExemption/);
  assert.match(source, /getFeeForMessage/);
});

test('эксперимент жизненного цикла — только на локальном валидаторе: защита в коде и процедура в документе', () => {
  const estimator = read(ESTIMATOR);
  // публичные кластеры, на которых analyze-history обязан отказывать, включают канонический devnet
  assert.match(estimator, /PUBLIC_GENESIS = \{\s+"devnet": DEVNET_GENESIS,/);
  assert.match(estimator, /"mainnet-beta": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"/);
  assert.match(estimator, /LOCAL_HOSTS = \("127\.0\.0\.1", "localhost", "::1"\)/);
  assert.match(estimator, /def require_local_validator\(/);
  // проверка идёт ДО чтения истории
  const handler = estimator.slice(estimator.indexOf('def cmd_analyze_history('));
  assert.ok(handler.indexOf('require_local_validator(') < handler.indexOf('fetch_history('), 'история читается раньше проверки локальности');
  const doc = read('docs/DEVNET_DEPLOY_COSTS.md');
  for (const needle of ['analyze-history', 'solana-test-validator', 'Только локальный валидатор', 'set-upgrade-authority', 'is not upgradeable',
    'solana program close', 'не используются']) {
    assert.ok(doc.includes(needle), `в описании эксперимента нет «${needle}»`);
  }
  // процедура не трогает репозиторные ключи
  const procedure = doc.slice(doc.indexOf('## 8. Эксперимент'));
  assert.doesNotMatch(procedure, /solana\/keys\/|target\/deploy\/[a-z_]+-keypair/, 'эксперимент не должен использовать ключи репозитория');
});

test('обновление уже развёрнутой программы возможно, но только явно и по расхождению байткода', () => {
  const source = read(DEPLOY);
  const estimator = read(ESTIMATOR);
  // 1) без UPGRADE поведение прежнее: существующий аккаунт — «готово», новый код сам не уезжает
  assert.match(source, /UPGRADE="\$\{UPGRADE:-\}"/, 'UPGRADE должен быть явным входом, без значения по умолчанию');
  assert.match(source, /Все выбранные программы уже в сети — деплоить нечего/);
  // 2) решение об upgrade принимает read-only сверка байткода, а не сам факт запуска
  assert.match(source, /estimator upgrade-state --rpc/, 'шаг 3 обязан сверять байткод в сети с локальным .so');
  assert.match(estimator, /def upgrade_state\(rpc: Any, spec: ProgramSpec, commitment: str\) -> Tuple\[str, int, str\]:/);
  assert.match(estimator, /add_parser\("upgrade-state"/);
  assert.match(estimator, /state = "same" if hashlib\.sha256\(on_chain\)\.hexdigest\(\) == hashlib\.sha256\(local\)\.hexdigest\(\) else "different"/);
  // 3) совпадение не трогается, опечатка отказывает
  assert.match(source, /upgrade не нужен/);
  assert.match(source, /нет в реестре/, 'неизвестное имя в UPGRADE обязано отказывать');
  // 4) ключ программы для upgrade не обязателен, но чужой ключ по-прежнему запрещён
  assert.match(source, /ключ программы не нужен/, 'для upgrade достаточно upgrade authority');
  assert.match(source, /обновление в чужой адрес запрещено/);
  // 5) пост-проверка upgrade — по фактической ёмкости (уменьшить её нельзя, авто-расширение ≥ 10 KiB)
  assert.match(source, /--max-len "\$capacity"/, 'upgrade нельзя проверять по policy-значению max-len');
  assert.match(source, /upgrade authority в сети/);
  // 6) ключ провайдера не печатается: ни в отчёте зонда, ни в отчёте оценщика
  const probe = read('scripts/devnet-program-probe.py');
  assert.match(estimator, /def redact_url\(url: str\) -> str:/);
  assert.match(probe, /def redact_url\(url: str\) -> str:/);
  assert.match(probe, /report: dict = \{"rpc": redact_url\(rpc\)/);
  assert.match(probe, /say\(f"RPC: \{redact_url\(rpc\)\}"\)/);
  // 7) upgrade не может начаться с чужой authority: CLI сначала фиксирует SOL
  //    в буфере и только потом получает Incorrect upgrade authority
  assert.match(source, /UPGRADE=\$name: upgrade authority/, 'нет отказа при чужой authority');
  const pricing = read('docs/DEVNET_DEPLOY_COSTS.md');
  for (const needle of ['Incorrect upgrade authority', 'faucet.solana.com', 'OPERATOR_RESERVE_SOL']) {
    assert.ok(pricing.includes(needle), `в описании стоимости нет «${needle}»`);
  }
  // 8) документация называет ту же команду
  const docs = read('docs/DEVNET_DEPLOY_COSTS.md');
  assert.ok(docs.includes('UPGRADE=aof_core'), 'в описании стоимости нет команды обновления');
  assert.match(read('docs/CONTRACT_WORK_QUEUE.md'), /UPGRADE=aof_core/);
});
