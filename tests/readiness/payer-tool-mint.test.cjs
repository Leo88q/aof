'use strict';
/*
 * Коммит 4 payer-remеdiation: player-owned аккаунты платит игрок.
 *
 * Что закрывал долг: `MintTool.tool_data` создавался `init_if_needed, payer = authority`
 * (rent инструмента платил проект), а `MintResource.player` создавал профиль игрока за счёт
 * кошелька оператора. Здесь проверяется весь вертикальный срез: Anchor-контекст и handler,
 * сборщики транзакций бэкенда, IDL, таблица инструкций фронтенда и интент кошелька.
 *
 * Это source-level тесты: Rust/Anchor не компилировались и validator не запускался
 * (см. статус «source-aligned manually; generated validation pending» в docs/PAYER_REMEDIATION.md).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** Тело контекста `pub struct <Name>` (до закрывающей скобки на нулевом отступе). */
function contextBody(source, name) {
  const start = source.indexOf(`pub struct ${name}<'info> {`);
  assert.notEqual(start, -1, `${name}: контекст не найден`);
  const end = source.indexOf('\n}', start);
  assert.notEqual(end, -1, `${name}: не найден конец контекста`);
  return source.slice(start, end);
}

/** Тело роута: от `r.post("<route>"` до следующего `r.post(`/`r.get(`. */
function routeBody(source, route) {
  const start = source.indexOf(`r.post("${route}"`);
  assert.notEqual(start, -1, `${route}: роут не найден`);
  const rest = source.slice(start + 10);
  const next = rest.search(/\nr\.(post|get|put)\(/);
  return next < 0 ? rest : rest.slice(0, next);
}

test('MintTool: authority отделён от payer/recipient; payer может быть игроком или отдельным плательщиком', () => {
  const lib = read('aof-core/src/lib.rs');
  const body = contextBody(lib, 'MintTool');
  const payer = body.slice(body.indexOf('/// [PAYER] Плательщик'), body.indexOf('pub tool_data:'));
  assert.match(payer, /pub payer: Signer<'info>/, 'payer обязан быть подписантом');
  assert.match(payer, /payer\.key\(\) != authority\.key\(\) @ AofError::Unauthorized/,
    'authority не может платить за ToolData');
  assert.doesNotMatch(payer, /constraint = payer\.key\(\) == recipient\.key\(\)/,
    'operator/prepaid mint допускает отдельного payer; player-mint сам выбирает payer = recipient');
  const recipientAttr = body.slice(body.lastIndexOf('#[account(', body.indexOf('pub recipient:')),
    body.indexOf('pub recipient:'));
  assert.match(recipientAttr, /recipient\.key\(\) != authority\.key\(\) @ AofError::Unauthorized/,
    'authority не может быть получателем инструмента');
  const toolData = body.slice(body.indexOf('pub tool_data:'), body.indexOf('pub token_program:'));
  assert.match(toolData, /^pub tool_data/, 'поле ToolData на месте');
  const toolDataAttr = body.slice(body.lastIndexOf('#[account(', body.indexOf('pub tool_data:')));
  assert.match(toolDataAttr, /init_if_needed,\s*payer = payer,/, 'ToolData оплачивает payer');
  assert.doesNotMatch(payer, /payer = authority/, 'authority не платит за аккаунт получателя');
  assert.doesNotMatch(toolDataAttr, /payer = authority/, 'authority не платит за аккаунт получателя');
  // Порядок аккаунтов — часть IDL: payer идёт сразу после recipient, tool_data после payer.
  const names = [...body.matchAll(/pub (\w+):/g)].map((m) => m[1]);
  assert.deepEqual(names.indexOf('payer'), names.indexOf('recipient') + 1);
  assert.deepEqual(names.indexOf('tool_data'), names.indexOf('payer') + 1);
});

test('MintResource: профиль игрока больше не создаётся и не оплачивается выдачей', () => {
  const lib = read('aof-core/src/lib.rs');
  const body = contextBody(lib, 'MintResource');
  const tokenConstraint = body.slice(body.lastIndexOf('#[account(', body.indexOf('pub token_account:')),
    body.indexOf('pub token_account:'));
  assert.match(tokenConstraint, /token_account\.owner != authority\.key\(\) @ AofError::Unauthorized/,
    'authority cannot receive a resource mint');
  const playerField = body.slice(body.indexOf('pub player:'), body.indexOf('pub issuance_cap:'));
  const playerAttr = body.slice(body.lastIndexOf('#[account(', body.indexOf('pub player:')),
    body.indexOf('pub player:'));
  assert.doesNotMatch(playerAttr, /init_if_needed|payer\s*=/, 'выдача не создаёт и не оплачивает Player');
  assert.match(playerField, /UncheckedAccount<'info>/, 'MintResource принимает PDA только для чтения, без init');
  assert.match(playerAttr, /seeds = \[PLAYER_SEED, token_account\.owner\.as_ref\(\)\]/,
    'Player PDA привязан к владельцу recipient ATA');
  const handler = read('aof-core/src/instructions/mint_resource.rs');
  assert.match(handler, /pub fn read_existing_player/, 'handler требует существующий профиль');
  assert.match(handler, /PlayerNotInitialized/, 'отсутствующий Player отклоняется');
  assert.match(handler, /player\.owner, \*expected_owner/, 'профиль сверяется с владельцем ATA');
  assert.doesNotMatch(handler, /init_optional_player|read_optional_player|Option<&Player>/,
    'operator MintResource не разрешает обходить профиль через Option');
  assert.doesNotMatch(handler, /player\.owner = |player\.villagers = /, 'инициализация профиля ушла из mint handler');
  const resourceRoute = read('aof_backend/src/routes/resources.ts');
  assert.match(resourceRoute, /await requireExistingPlayer\(owner\)/, 'backend не обещает mint без профиля');
  assert.match(resourceRoute, /const \[player\] = playerPda\(owner\)/, 'backend derives the PDA for the same owner');
  assert.match(resourceRoute, /\.accounts\(\{[\s\S]*?\bplayer,/, 'backend passes that existing player PDA to MintResource');
  const initPlayer = contextBody(lib, 'InitPlayer');
  assert.match(initPlayer, /player: Signer<'info>/);
  assert.match(initPlayer, /init, payer = player/,
    'профиль создаётся отдельной player-signed/player-paid инструкцией');
});

test('payer validator fixtures use initialized tool mints and configured resource/treasury accounts', () => {
  const funding = read('tests/aof_payer_funding.ts');
  assert.doesNotMatch(funding, /const mint = Keypair\.generate\(\)/,
    'random keypairs are not valid SPL mint accounts');
  assert.match(funding, /createMint\(connection, user, authPda, null, 0\)/,
    'Tool mint fixtures are initialized, zero-decimal, and owned by the auth PDA');
  assert.match(funding, /createMint\(connection, authority, authority\.publicKey, null, 9\)/,
    'ATA fixture uses an initialized mint');
  assert.match(funding, /config\.dataMint as PublicKey/,
    'reward-claim tests use a configured ResourceKind mint');
  assert.match(funding, /config\.treasury as PublicKey/,
    'reward-claim tests use the configured treasury ATA owner');
  assert.match(funding, /tx\.feePayer = payer\.publicKey/,
    'payer acceptance transactions must charge network fees to the explicit player payer');
  assert.match(funding, /sendWithoutPlayerSignature/,
    'payer signature absence is exercised without silently falling back to authority as fee payer');
  assert.doesNotMatch(funding, /treasuryToken: userToken/,
    'the player ATA is not incorrectly reused as the configured treasury destination');
  assert.match(funding, /MintResource fails closed without it and never creates it/,
    'the physical profile payer test uses the direct init_player then existing-profile mint flow');
  assert.match(funding, /Player PDA receives exactly rent-exempt balance/,
    'the payer test checks live Player account lamport deltas');
  assert.match(funding, /player pays rent plus network fee/,
    'InitPlayer must charge rent and network fee to the player');
});

test('backend /tools/mint: player — payer, authority только подписывает авторизацию', () => {
  const tools = read('aof_backend/src/routes/tools.ts');
  const body = routeBody(tools, '/mint');
  assert.match(body, /payer: owner,/, 'self-mint явно выбирает payer = recipient = player');
  assert.match(body, /owner\.equals\(AUTHORITY_PUBKEY\)/, 'authority запрещено быть payer/recipient');
  assert.match(body, /createAssociatedTokenAccountIdempotentInstruction\(\s*owner, tokenAccount, owner, mint,?\s*\)/,
    'ATA получателя создаётся в его транзакции');
  assert.match(body, /coSignQuoted\(\[createOwnerAta, ix\], owner, \[/,
    'fee payer — игрок, authority добавляет подпись, route возвращает transaction-bound payer quote');
  assert.match(body, /name: "recipient_ata", address: tokenAccount, size: TOKEN_ACCOUNT_SIZE, strategy: "idempotent"/);
  assert.match(body, /name: "tool_data", address: toolData, size: TOOL_DATA_ACCOUNT_SIZE, strategy: "init_if_needed"/);
  assert.match(body, /name: "metaplex_metadata", address: tokenMetadataPda\(mint\)\[0\], size: METAPLEX_METADATA_MAX_ACCOUNT_SIZE, strategy: "init"/);
  assert.match(body, /name: "metaplex_master_edition", address: masterEditionPda\(mint\)\[0\], size: METAPLEX_MASTER_EDITION_MAX_ACCOUNT_SIZE, strategy: "init"/);
  assert.match(body, /res\.json\(prepared\)/, 'клиент получает tx и quote');
  assert.doesNotMatch(body, /authorityOnly/, 'authorityOnly отправил бы транзакцию без подписи получателя');
  assert.doesNotMatch(body, /createAssociatedTokenAccountIdempotentInstruction\(\s*AUTHORITY_PUBKEY/,
    'rent чужого ATA не платит ни один кошелёк проекта');
});

test('Anchor helpers cover a separate payer as well as the self-mint path', () => {
  for (const file of ['tests/aof_core.ts', 'tests/aof_extended.ts', 'tests/aof_market.ts', 'tests/aof_tool_ownership.ts']) {
    const source = read(file);
    assert.match(source, /payer:\s*setupPayer\.publicKey/,
      `${file}: operator-authorized mint to another recipient must carry a distinct non-authority payer`);
    assert.match(source, /sendWithPayer\(/,
      `${file}: distinct payer must submit the mint transaction`);
    assert.ok(/tx\.feePayer = payer\.publicKey/.test(source) || /submitWithPayer\(/.test(source),
      `${file}: distinct payer must also pay network fees`);
  }
  const sharedAnchorPayer = read('tests/payer-transaction.ts');
  assert.match(sharedAnchorPayer, /transaction\.feePayer = payer\.publicKey/,
    'shared signer helper assigns the explicit payer as fee payer');
  assert.match(sharedAnchorPayer, /const signers = required\.map\(/,
    'shared signer helper signs only transaction-required local signers');
  assert.match(sharedAnchorPayer, /minContextSlot:\s*Math\.max\(context\.slot, minContextSlot \?\? 0\)/,
    'explicit payer submission waits for both the latest blockhash and any required account snapshot');
  const vrf = read('tests/aof_vrf_localnet.ts');
  assert.match(vrf, /recipient: owner\.publicKey,[\s\S]*?payer: owner\.publicKey/,
    'VRF self-mint explicitly uses the player as payer and recipient');
  assert.match(vrf, /submitWithPayer\(connection, tx, payer, \[\.\.\.extraSigners, providerSigner\]\)/,
    'VRF tool mint delegates fee-payer signing to the shared explicit-payer helper');
  const playerPath = read('tests/aof_payer_funding.ts');
  assert.match(playerPath, /recipient: user\.publicKey, payer: user\.publicKey/,
    'self-service player mint explicitly uses payer = recipient');
});

test('backend /test-grant-tools: минт, ATA и ToolData оплачивает получатель', () => {
  const admin = read('aof_backend/src/routes/admin.ts');
  const body = routeBody(admin, '/test-grant-tools');
  assert.doesNotMatch(body, /createMint\(connection, AUTHORITY/, 'mint-аккаунт больше не оплачивается authority');
  assert.match(body, /fromPubkey: recipient/, 'mint-аккаунт создаётся со счёта получателя');
  assert.match(body, /recipient\.equals\(AUTHORITY_PUBKEY\)/, 'authority запрещено быть получателем');
  assert.match(body, /count !== 1/, 'mint route limits packet to one tool because Metadata/Edition make multi-mint messages oversized');
  assert.match(body, /payer: recipient/, 'dev grant выбирает recipient как player payer');
  assert.match(body, /name: `metaplex_metadata_\$\{index\}`, address: tokenMetadataPda\(mint\)\[0\], size: METAPLEX_METADATA_MAX_ACCOUNT_SIZE, strategy: "init"/);
  assert.match(body, /name: `metaplex_master_edition_\$\{index\}`, address: masterEditionPda\(mint\)\[0\], size: METAPLEX_MASTER_EDITION_MAX_ACCOUNT_SIZE, strategy: "init"/);
  assert.match(body, /coSignQuoted\(instructions, recipient, rentAccounts, mintKeypairs\)/,
    'payer=recipient платит сам, authority добавляет только partial signature и quote');
  assert.doesNotMatch(body, /authorityOnly/, 'authority не имеет права завершить транзакцию сам');
});

test('Metaplex rent quote sizes stay aligned across Rust, backend, and wallet validation', () => {
  const rust = read('aof-core/src/constants.rs');
  const backend = read('aof_backend/src/lib/accountSizes.ts');
  const wallet = read('frontend/src/lib/transactionIntent.ts');
  assert.match(rust, /TOOL_METADATA_ACCOUNT_MAX_SPACE: usize = 679/);
  assert.match(rust, /TOOL_MASTER_EDITION_ACCOUNT_MAX_SPACE: usize = 282/);
  assert.match(backend, /METAPLEX_METADATA_MAX_ACCOUNT_SIZE = 679/);
  assert.match(backend, /METAPLEX_MASTER_EDITION_MAX_ACCOUNT_SIZE = 282/);
  assert.match(wallet, /METAPLEX_METADATA_MAX_ACCOUNT_SIZE = 679/);
  assert.match(wallet, /METAPLEX_MASTER_EDITION_MAX_ACCOUNT_SIZE = 282/);
});

test('craft и fuse возвращают quote с rent новых ToolData/Metadata/Master Edition аккаунтов', () => {
  const tools = read('aof_backend/src/routes/tools.ts');
  const craft = routeBody(tools, '/craft');
  assert.match(craft, /toolMetadataRegistry: toolMetadataRegistryPda\(\)\[0\]/);
  assert.match(craft, /metadata: tokenMetadataPda\(newMint\)\[0\]/);
  assert.match(craft, /masterEdition: masterEditionPda\(newMint\)\[0\]/);
  assert.match(craft, /coSignWithVrfLookupTableQuoted\(\[ix\], user, \[/);
  assert.match(craft, /name: "metaplex_metadata", address: tokenMetadataPda\(newMint\)\[0\], size: METAPLEX_METADATA_MAX_ACCOUNT_SIZE, strategy: "init"/);
  assert.match(craft, /name: "metaplex_master_edition", address: masterEditionPda\(newMint\)\[0\], size: METAPLEX_MASTER_EDITION_MAX_ACCOUNT_SIZE, strategy: "init"/);
  assert.match(craft, /res\.json\(prepared\)/);

  const reroll = routeBody(read('aof_backend/src/routes/reroll.ts'), '/fuse');
  assert.match(reroll, /toolMetadataRegistry: toolMetadataRegistryPda\(\)\[0\]/);
  assert.match(reroll, /metadata: tokenMetadataPda\(newMint\)\[0\]/);
  assert.match(reroll, /masterEdition: masterEditionPda\(newMint\)\[0\]/);
  assert.match(reroll, /coSignWithVrfLookupTableQuoted\(\[ix\], user, \[/);
  assert.match(reroll, /name: "metaplex_metadata", address: tokenMetadataPda\(newMint\)\[0\], size: METAPLEX_METADATA_MAX_ACCOUNT_SIZE, strategy: "init"/);
  assert.match(reroll, /name: "metaplex_master_edition", address: masterEditionPda\(newMint\)\[0\], size: METAPLEX_MASTER_EDITION_MAX_ACCOUNT_SIZE, strategy: "init"/);
  assert.match(reroll, /res\.json\(prepared\)/);
});

test('IDL и таблица фронтенда: у mint_tool появился payer, и он не authority-only', () => {
  const idl = JSON.parse(read('aof_backend/src/idl/aof_core.json'));
  const ix = idl.instructions.find((i) => i.name === 'mint_tool');
  assert.deepEqual(ix.accounts.map((a) => a.name),
    ['config', 'authority', 'auth', 'mint', 'token_account', 'recipient', 'payer', 'tool_data', 'token_program', 'system_program', 'tool_metadata_registry', 'metadata', 'master_edition', 'token_metadata_program']);
  assert.deepEqual([ix.accounts[6].writable, ix.accounts[6].signer], [true, true]);
  const table = read('frontend/src/lib/coreInstructions.ts');
  const spec = table.slice(table.indexOf('name: "mint_tool"'), table.indexOf('name: "mint_tool"') + 700);
  assert.match(spec, /authorityOnly: false/, 'игрок подписывает минт в свой кошелёк за свой счёт');
  assert.match(spec, /accounts: \["config", "authority", "auth", "mint", "token_account", "recipient", "payer", "tool_data", "token_program", "system_program", "tool_metadata_registry", "metadata", "master_edition", "token_metadata_program"\]/);
  // Таблица и IDL не разъехались с Rust.
  execFileSync('python3', ['scripts/check-idl-drift.py'], { cwd: root, stdio: 'pipe' });
  execFileSync('python3', ['scripts/gen-core-instruction-table.py', '--check'], { cwd: root, stdio: 'pipe' });
});

test('кошелёк игрока подписывает минт инструмента только по локальному интенту', () => {
  const src = read('frontend/src/lib/transactionIntent.ts');
  assert.match(src, /export interface ToolMintIntent/, 'интент описан рядом с остальными');
  assert.match(src, /intent\.kind === "toolMint"\) return validateToolMintIntent/, 'интент подключён к валидации');
  const signerPolicy = src.slice(src.indexOf('export function expectedSigners'), src.indexOf('type Instruction'));
  assert.match(signerPolicy, /intent\?\.kind === "toolMint"[\s\S]*?intent\?\.kind === "rewardClaim"[\s\S]*?\? 2 : 1/,
    'co-signed intents допускают подписи игрока и authority');
  assert.doesNotMatch(signerPolicy, /seasonPassInit/, 'season-pass init остаётся player-only');
  const body = src.slice(src.indexOf('function validateToolMintIntent'), src.indexOf('function validateOrderbookV2Intent'));
  assert.match(body, /authority\.equals\(user\)/, 'authority не может быть payer/recipient player-mint');
  assert.match(src, /hasToolMint[\s\S]*intent\?\.kind !== "toolMint"[\s\S]*local user intent/,
    'MintTool cannot reach a player wallet without explicit self-mint intent');
  assert.match(body, /keysEqual\(ix\.keys, expected\)/, 'аккаунты сверяются позиционно');
  assert.match(body, /pda\("tool_metadata_registry"\),\s*metaplexMetadataPda\(mint\),\s*metaplexMasterEditionPda\(mint\), TOKEN_METADATA_PROGRAM/,
    'wallet intent binds the registry, Metadata PDA, Master Edition PDA, and canonical Metaplex program');
  assert.match(src, /name: "metaplex_metadata", address: metaplexMetadataPda\(mint\), size: METAPLEX_METADATA_MAX_ACCOUNT_SIZE, strategy: "init"/);
  assert.match(src, /name: "metaplex_master_edition", address: metaplexMasterEditionPda\(mint\), size: METAPLEX_MASTER_EDITION_MAX_ACCOUNT_SIZE, strategy: "init"/);
  assert.match(body, /ix\.data\[12 \+ toolType\.length\] !== RARITY\[intent\.rarity\]/, 'редкость из payload сверяется с интентом');
  assert.match(body, /ix\.data\[0\] !== 1/, 'принимается только идемпотентное создание ATA');
});
