'use strict';
/**
 * Конфиги механик: числа в bringup обязаны совпадать с программой.
 *
 * Паки, реролл, лотерея и сезон включаются не «тумблером», а аккаунтами-конфигами:
 * покупка пака читает `PackConfig`, фьюз редкости — `RerollConfig`, продажа билета —
 * `LotteryRound`, сезонный пропуск и XP — `Season`. Значит, скрипт включения обязан
 * создать их все, и числа в скрипте обязаны быть теми же, что в программе: цена и
 * шансы пака, шансы реролла, цена билета, длина сезона. Разъехавшиеся числа — это
 * либо пак по чужой цене, либо отказ программы на `validate_odds`.
 *
 * Поэтому гейт читает `aof-core/src/constants.rs` и сверяет значения с
 * `scripts/devnet-bringup.sh`, а не доверяет комментарию: любое расхождение —
 * красный тест, а не «владелец заметит на девнете».
 *
 * Отдельно проверяется честность подсказок: зонд `scripts/devnet-program-probe.py`
 * печатает «как включить» для выключенных механик. Подсказка с выдуманным
 * `/admin/...` путём хуже её отсутствия — владелец ищет роут и не находит.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const constants = read('aof-core/src/constants.rs');
const bringup = read('scripts/devnet-bringup.sh');
const packs = read('aof_backend/src/routes/packs.ts');
const reroll = read('aof_backend/src/routes/reroll.ts');
const lottery = read('aof_backend/src/routes/lottery.ts');
const season = read('aof_backend/src/routes/season.ts');
const probe = read('scripts/devnet-program-probe.py');

const u64 = (name) => {
  const match = constants.match(new RegExp(`pub const ${name}: u64 = ([0-9_]+);`));
  assert.ok(match, `в aof-core/src/constants.rs нет ${name}`);
  return Number(match[1].replace(/_/g, ''));
};
const odds = (name) => {
  const match = constants.match(new RegExp(`pub const ${name}: \\[u16; 5\\] = \\[([^\\]]+)\\];`));
  assert.ok(match, `в aof-core/src/constants.rs нет ${name}`);
  return match[1].split(',').map((value) => Number(value.trim().replace(/_/g, '')));
};
const oddsText = (values) => `[${values.join(',')}]`;

test('паки: цена и шансы в bringup — канонические из программы', () => {
  assert.match(packs, /const PACK_TYPES = \["small", "medium", "big"\] as const;/,
    'индексы паков обязаны совпадать с aof_backend/src/routes/packs.ts');
  const canonical = [
    ['small', u64('PACK_SMALL_PRICE_LAMPORTS'), odds('PACK_SMALL_ODDS_BPS')],
    ['medium', u64('PACK_MEDIUM_PRICE_LAMPORTS'), odds('PACK_MEDIUM_ODDS_BPS')],
    ['big', u64('PACK_BIG_PRICE_LAMPORTS'), odds('PACK_BIG_ODDS_BPS')],
  ];
  for (const [name, price, weights] of canonical) {
    assert.ok(bringup.includes(`PACK_PRICE=${price}`),
      `bringup не называет цену пака ${name} (${price}) из constants.rs`);
    assert.ok(bringup.includes(`PACK_ODDS="${oddsText(weights)}"`),
      `bringup не называет шансы пака ${name} (${oddsText(weights)}) из constants.rs`);
  }
});

test('шансы паков и реролла проходят проверку программы: сумма 10000 и [4] = 0', () => {
  // validate_odds в aof-core/src/instructions/pack_config.rs: AofError::InvalidOddsWeights
  for (const name of ['PACK_SMALL_ODDS_BPS', 'PACK_MEDIUM_ODDS_BPS', 'PACK_BIG_ODDS_BPS', 'REROLL_ODDS_BPS_DEFAULT']) {
    const weights = odds(name);
    assert.equal(weights.length, 5, `${name}: должно быть пять тиров`);
    assert.equal(weights.reduce((sum, value) => sum + value, 0), 10_000,
      `${name}: сумма шансов обязана быть 10000, иначе init упадёт на чейне`);
    assert.equal(weights[4], 0, `${name}: легендарные не выпадают, пятый тир обязан быть нулём`);
  }
});

test('реролл: шансы в bringup — REROLL_ODDS_BPS_DEFAULT', () => {
  const weights = oddsText(odds('REROLL_ODDS_BPS_DEFAULT'));
  assert.ok(bringup.includes(`"oddsBps":${weights}`),
    `bringup не называет шансы реролла ${weights} из constants.rs`);
  assert.match(reroll, /r\.post\("\/config\/init", requireAdmin/,
    'роут реролла обязан требовать админ-авторизацию');
});

test('лотерея: цена билета в бэкенде равна константе программы', () => {
  const price = u64('LOTTERY_TICKET_PRICE_LAMPORTS');
  const match = lottery.match(/const LOTTERY_TICKET_PRICE_LAMPORTS = new BN\(([0-9_]+)\);/);
  assert.ok(match, 'в aof_backend/src/routes/lottery.ts нет LOTTERY_TICKET_PRICE_LAMPORTS');
  assert.equal(Number(match[1].replace(/_/g, '')), price,
    'цена билета в бэкенде разошлась с LOTTERY_TICKET_PRICE_LAMPORTS в constants.rs');
  assert.match(lottery, /r\.post\("\/round\/init", requireAdmin/,
    'роут создания раунда обязан требовать админ-авторизацию');
});

test('bringup создаёт конфиги механик и называет настоящие роуты', () => {
  for (const route of ['/packs/config/init', '/reroll/config/init', '/lottery/round/init', '/season/init']) {
    assert.ok(bringup.includes(`POST ${route}`) || bringup.includes(`api POST ${route}`),
      `bringup не вызывает ${route}`);
  }
  assert.match(packs, /r\.post\("\/config\/init", requireAdmin/);
  assert.match(season, /r\.post\("\/init", requireAdmin/);
  assert.ok(bringup.includes('SKIP=mechanics'), 'шаг конфигов обязан отключаться явно');
  assert.ok(bringup.includes('SEASON_ID="${SEASON_ID:-1}"'), 'первый сезон по умолчанию — 1');
  assert.ok(bringup.includes('LOTTERY_ROUND_ID="${LOTTERY_ROUND_ID:-1}"'), 'первый раунд лотереи по умолчанию — 1');
});

test('сезон: чтение честно требует ACTIVE_SEASON_ID и EXPECTED_GENESIS_HASH', () => {
  // currentSeason() в aof_backend/src/routes/vipStatus.ts возвращает 503 без
  // обоих значений: создание Season само по себе не делает /season/current живым.
  const vip = read('aof_backend/src/routes/vipStatus.ts');
  assert.match(vip, /process\.env\.EXPECTED_GENESIS_HASH/,
    'vipStatus обязан требовать пин кластера, иначе мок-аккаунт выдаст VIP');
  assert.ok(bringup.includes('ACTIVE_SEASON_ID=') && bringup.includes('EXPECTED_GENESIS_HASH'),
    'bringup обязан сказать, чего не хватает для /season/current, а не молчать');
  assert.ok(bringup.includes('продажа пропуска'),
    'bringup обязан отделить создание сезона от платного трека (§3.6)');
});

test('подсказки зонда ведут на существующие роуты', () => {
  for (const route of ['/packs/config/init', '/reroll/config/init', '/lottery/round/init',
    '/season/init', '/admin/craft-economy/init', '/admin/rarity-counter/init']) {
    assert.ok(probe.includes(route), `зонд не подсказывает ${route}`);
  }
  for (const invented of ['/admin/config/init-pack-config', '/admin/config/init-reroll-config',
    '/admin/season/init', '/admin/lottery/round/init']) {
    assert.ok(!probe.includes(invented),
      `зонд подсказывает несуществующий ${invented}: владелец ищет роут и не находит`);
  }
  assert.ok(probe.includes('Счётчики редкости'),
    'без счётчиков редкости крафт остаётся с 503, а зонд об этом молчит');
});
