/**
 * Self-test: GET /admin/config/bootstrap-preflight.
 *
 * Зачем. До деплоя `GET /admin/config/mining` отвечает 400 «Account does not
 * exist» (Config ещё нет), а scripts/devnet-bringup.sh требовал строго 200 —
 * замкнутый круг: деплой нельзя было начать, не имея Config, а Config — не
 * задеплоив. Маршрут bootstrap-preflight не требует ни программ, ни Config, но
 * остаётся закрытым: ops-токен, никаких секретов в ответе, ничего не подписывает.
 *
 * Покрыто:
 *   1. логика (поддельное соединение): ничего нет / программы без Config / Config есть /
 *      аномалии (чужой владелец, не исполняемая, не Config) / genesis / режим read-only;
 *   2. настоящий роутер admin-config по HTTP: 401 без токена и с чужим, 403 для read-токена,
 *      200 для ops; тот же момент, в котором GET /mining даёт 400; ответ без секретов;
 *      RPC-сбой -> 502 без текста ошибки RPC;
 *   3. тот же роутер в режиме AUTHORITY_MODE=read-only (отдельный процесс): mode=read-only,
 *      canSign=false.
 *
 * Run: npm run test:bootstrap-preflight
 */
import { strict as assert } from "assert";
import { spawnSync } from "child_process";
import express from "express";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import {
  BOOTSTRAP_PROGRAM_NAMES, BPF_LOADER_UPGRADEABLE, anchorAccountDiscriminator, buildBootstrapPreflight, sanitizeRpcError,
  type BootstrapPreflightDeps, type BootstrapProgramName, type PreflightConnection,
} from "../src/lib/bootstrapPreflight";
import coreIdl from "../src/idl/aof_core.json";

const OPS = "o".repeat(40);
const READ = "r".repeat(40);
const CHILD = process.env.AOF_SELFTEST_CHILD; // "read-only": тот же файл в отдельном процессе

const loader = new PublicKey(BPF_LOADER_UPGRADEABLE);
const rnd = () => Keypair.generate().publicKey;

type Info = { owner: PublicKey; executable: boolean; data: Buffer; lamports: number } | null;
const program = (executable = true, owner: PublicKey = loader): Info => ({ owner, executable, data: Buffer.alloc(36), lamports: 1 });
const configAccount = (owner: PublicKey, discriminator = anchorAccountDiscriminator("Config")): Info =>
  ({ owner, executable: false, data: Buffer.concat([discriminator, Buffer.alloc(64)]), lamports: 1 });

// ---------------------------------------------------------------- 1. логика
async function logicChecks(): Promise<void> {
  const programs = {} as Record<BootstrapProgramName, PublicKey>;
  for (const name of BOOTSTRAP_PROGRAM_NAMES) programs[name] = rnd();
  const configPda = rnd();
  const authority = rnd();
  const calls: string[] = [];

  const make = (chain: Partial<Record<BootstrapProgramName | "config", Info>>, genesis = "GenesisX", extra: Partial<BootstrapPreflightDeps> = {}) => {
    const connection: PreflightConnection = {
      async getGenesisHash() { calls.push("getGenesisHash"); return genesis; },
      async getMultipleAccountsInfo(keys: PublicKey[]) {
        calls.push("getMultipleAccountsInfo");
        return keys.map((key) => {
          if (key.equals(configPda)) return chain.config ?? null;
          const name = BOOTSTRAP_PROGRAM_NAMES.find((n) => programs[n].equals(key))!;
          return chain[name] ?? null;
        });
      },
    };
    return { connection, authorityMode: "hot" as const, canSign: true, authorityPubkey: authority, programs,
      coreProgramId: programs.aof_core, configPda, ...extra };
  };

  // 7. программ и Config нет — ровно то состояние, в котором старая проверка падала
  let r = await buildBootstrapPreflight(make({}));
  assert.equal(r.kind, "aof.bootstrap-preflight");
  assert.equal(r.schemaVersion, 1);
  assert.equal(r.service, "aof-backend");
  assert.equal(r.authority.pubkey, authority.toBase58());
  assert.deepEqual(r.authority, { pubkey: authority.toBase58(), mode: "hot", canSign: true });
  assert.equal(r.rpc.genesisHash, "GenesisX");
  assert.equal(r.config.exists, false);
  assert.equal(r.config.pda, configPda.toBase58());
  for (const name of BOOTSTRAP_PROGRAM_NAMES) {
    assert.equal(r.programs[name].deployed, false, name);
    assert.equal(r.programs[name].anomaly, null, name);
    assert.equal(r.programs[name].programId, programs[name].toBase58());
  }
  assert.deepEqual(calls.sort(), ["getGenesisHash", "getMultipleAccountsInfo"], "только два чтения, ничего больше");

  // 8. программы есть, Config нет
  const allPrograms = Object.fromEntries(BOOTSTRAP_PROGRAM_NAMES.map((n) => [n, program()])) as any;
  r = await buildBootstrapPreflight(make(allPrograms));
  assert.ok(BOOTSTRAP_PROGRAM_NAMES.every((n) => r.programs[n].deployed));
  assert.equal(r.config.exists, false);
  assert.equal(r.config.anomaly, null);

  // 9. Config инициализирован
  r = await buildBootstrapPreflight(make({ ...allPrograms, config: configAccount(programs.aof_core) }));
  assert.equal(r.config.exists, true);
  assert.equal(r.config.anomaly, null);

  // аномалии: ни одна не должна выглядеть как «Config существует» или «программа развёрнута»
  r = await buildBootstrapPreflight(make({ ...allPrograms, config: configAccount(rnd()) }));
  assert.equal(r.config.exists, false);
  assert.match(r.config.anomaly!, /not-owned-by-aof-core/);
  r = await buildBootstrapPreflight(make({ ...allPrograms, config: configAccount(programs.aof_core, Buffer.alloc(8)) }));
  assert.equal(r.config.exists, false);
  assert.match(r.config.anomaly!, /not-a-Config/);
  r = await buildBootstrapPreflight(make({ config: configAccount(programs.aof_core) }));
  assert.equal(r.config.exists, false);
  assert.match(r.config.anomaly!, /aof-core-is-not-deployed/);
  r = await buildBootstrapPreflight(make({ ...allPrograms, aof_market: program(true, rnd()) }));
  assert.equal(r.programs.aof_market.deployed, false);
  assert.match(r.programs.aof_market.anomaly!, /not-owned-by-upgradeable-loader/);
  r = await buildBootstrapPreflight(make({ ...allPrograms, aof_quests: program(false) }));
  assert.equal(r.programs.aof_quests.deployed, false);
  assert.match(r.programs.aof_quests.anomaly!, /not-executable/);

  // режим read-only виден; genesis сверяется с ожидаемым, если он задан
  r = await buildBootstrapPreflight(make({}, "GenesisX", { authorityMode: "read-only", canSign: false }));
  assert.deepEqual([r.authority.mode, r.authority.canSign], ["read-only", false]);
  assert.deepEqual([r.rpc.expectedGenesisHash, r.rpc.genesisMatchesExpected], [null, null]);
  r = await buildBootstrapPreflight(make({}, "GenesisX", { expectedGenesisHash: "GenesisX" }));
  assert.equal(r.rpc.genesisMatchesExpected, true);
  r = await buildBootstrapPreflight(make({}, "GenesisX", { expectedGenesisHash: "Other" }));
  assert.equal(r.rpc.genesisMatchesExpected, false);
  assert.equal(r.rpc.expectedGenesisHash, "Other");

  // сбой сети — исключение (обработчик превратит его в 502), а не «успешный» пустой ответ
  const broken = make({});
  broken.connection.getGenesisHash = async () => { throw new Error("connect ECONNREFUSED https://rpc.example/?api-key=LEAK"); };
  await assert.rejects(buildBootstrapPreflight(broken));

  // в лог уходит описание сбоя без URL: в тексте ошибки RPC-клиента бывает адрес узла с API-ключом
  const described = sanitizeRpcError(new Error("connect ECONNREFUSED https://rpc.example.com/v1/?api-key=LEAK and wss://x.y/z?k=LEAK2 failed"));
  assert.ok(!JSON.stringify(described).includes("LEAK"), JSON.stringify(described));
  assert.match(described.message, /\[url\]/);
  assert.equal(sanitizeRpcError("plain string").name, "string");

  // маршрут не содержит путей подписи
  // смотрим на код, а не на комментарии, где эти слова названы намеренно
  const source = require("fs").readFileSync(require.resolve("../src/lib/bootstrapPreflight.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const word of ["authorityOnly", "sendSignedBy", "coSign", "partialSign", "AUTHORITY_SECRET_KEY", "ADMIN_TOKEN", "sendTransaction"]) {
    assert.ok(!source.includes(word), `bootstrapPreflight.ts не должен упоминать ${word}`);
  }
}

// ---------------------------------------------------------------- 2/3. настоящий роутер
async function request(port: number, path: string, token?: string) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, json };
}

async function realRouterChecks(mode: "hot" | "read-only"): Promise<void> {
  const authorityKeypair = Keypair.generate();
  const secret = bs58.encode(authorityKeypair.secretKey);
  const rpcSecret = "SECRET-RPC-KEY-123";
  process.env.PROGRAM_ID = coreIdl.address;
  process.env.TREASURY_PUBKEY = rnd().toBase58();
  process.env.ADMIN_TOKEN = OPS;
  process.env.ADMIN_READ_TOKEN = READ;
  process.env.RPC_URL = `http://127.0.0.1:1/?api-key=${rpcSecret}`;
  delete process.env.NODE_ENV;
  delete process.env.EXPECTED_GENESIS_HASH;
  if (mode === "hot") {
    process.env.AUTHORITY_SECRET_KEY = secret;
    delete process.env.AUTHORITY_MODE;
  } else {
    process.env.AUTHORITY_MODE = "read-only";
    process.env.AUTHORITY_PUBKEY = authorityKeypair.publicKey.toBase58();
    delete process.env.AUTHORITY_SECRET_KEY;
  }

  const { connection } = await import("../src/provider");
  const adminConfig = (await import("../src/routes/admin-config")).default;
  const { configPda } = await import("../src/lib/pda");

  let chain: Record<string, Info> = {};
  let genesis = "DevnetGenesisForTest";
  let rpcDown = false;
  (connection as any).getGenesisHash = async () => {
    if (rpcDown) throw new Error(`fetch failed: http://127.0.0.1:1/?api-key=${rpcSecret}`);
    return genesis;
  };
  (connection as any).getMultipleAccountsInfo = async (keys: PublicKey[]) => keys.map((k) => chain[k.toBase58()] ?? null);
  (connection as any).getAccountInfo = async (key: PublicKey) => chain[key.toBase58()] ?? null;
  // Anchor 0.30 читает аккаунты через getAccountInfoAndContext (GET /mining -> program.account.config.fetch)
  (connection as any).getAccountInfoAndContext = async (key: PublicKey) => ({ context: { slot: 1 }, value: chain[key.toBase58()] ?? null });

  const app = express();
  app.use(express.json());
  app.use("/admin/config", adminConfig);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as any).port;
  try {
    const PATH = "/admin/config/bootstrap-preflight";

    // 2. авторизация: без токена, с чужим и с read-токеном — отказ; ops — доступ
    assert.equal((await request(port, PATH)).status, 401, "без токена");
    assert.equal((await request(port, PATH, "x".repeat(40))).status, 401, "чужой токен");
    assert.equal((await request(port, PATH, OPS.slice(0, 39))).status, 401, "префикс токена");
    assert.equal((await request(port, PATH, READ)).status, 403, "read-токен раскрывать authority не должен");

    // 7. ничего не развёрнуто, Config нет: именно тут старая проверка получала 400
    const old = await request(port, "/admin/config/mining", OPS);
    assert.equal(old.status, 400, "GET /mining до Config отвечает 400 — это и был замкнутый круг");
    assert.match(String(old.json?.error), /does not exist/i);
    let r = await request(port, PATH, OPS);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.kind, "aof.bootstrap-preflight");
    assert.equal(r.json.config.exists, false);
    assert.equal(r.json.programs.aof_core.programId, coreIdl.address);
    assert.equal(r.json.programs.aof_core.deployed, false);
    assert.equal(r.json.rpc.genesisHash, genesis);
    assert.equal(r.json.authority.pubkey, authorityKeypair.publicKey.toBase58());
    assert.equal(r.json.authority.mode, mode);
    assert.equal(r.json.authority.canSign, mode === "hot");
    assert.equal(r.json.service, "aof-backend");

    // ответ не содержит секретов, токенов и адреса RPC
    for (const leak of [secret, OPS, READ, rpcSecret, "127.0.0.1:1", "secretKey"]) {
      assert.ok(!r.text.includes(leak), `в ответе утекло: ${leak.slice(0, 6)}…`);
    }
    assert.equal(r.json.authority.secretKey, undefined);

    // 8/9. программы развёрнуты, Config появился
    for (const name of BOOTSTRAP_PROGRAM_NAMES) {
      const id = (r.json.programs[name].programId as string);
      chain[id] = program();
    }
    r = await request(port, PATH, OPS);
    assert.ok(BOOTSTRAP_PROGRAM_NAMES.every((n) => r.json.programs[n].deployed));
    assert.equal(r.json.config.exists, false);
    chain[configPda()[0].toBase58()] = configAccount(new PublicKey(coreIdl.address));
    r = await request(port, PATH, OPS);
    assert.equal(r.json.config.exists, true);

    // повторный запрос ничего не меняет (идемпотентность чтения)
    const again = await request(port, PATH, OPS);
    assert.deepEqual(again.json, r.json);

    // сбой RPC -> 502 с кодом, без текста ошибки (в нём мог быть URL с ключом)
    rpcDown = true;
    r = await request(port, PATH, OPS);
    assert.equal(r.status, 502);
    assert.deepEqual(r.json, { error: "BOOTSTRAP_PREFLIGHT_RPC_UNAVAILABLE" });
    assert.ok(!r.text.includes(rpcSecret));
    rpcDown = false;

    // только GET: изменяющие методы на этот путь не отвечают успехом
    const post = await fetch(`http://127.0.0.1:${port}${PATH}`, { method: "POST", headers: { Authorization: `Bearer ${OPS}` } });
    assert.notEqual(post.status, 200);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function main(): Promise<void> {
  if (CHILD === "read-only") {
    await realRouterChecks("read-only");
    console.log("child:read-only ok");
    process.exit(0);
  }
  await logicChecks();
  await realRouterChecks("hot");
  // тот же роутер в режиме read-only — отдельным процессом: config.ts читает окружение один раз при загрузке
  const child = spawnSync(process.execPath,
    [require.resolve("ts-node/dist/bin.js"), "--project", "tsconfig.json", "--transpile-only", __filename],
    { env: { ...process.env, AOF_SELFTEST_CHILD: "read-only" }, encoding: "utf8" });
  assert.equal(child.status, 0, `read-only процесс упал:\n${child.stdout}\n${child.stderr}`);
  assert.match(child.stdout, /child:read-only ok/);
  console.log("Bootstrap preflight: no Config needed, ops token only, no secrets, fail-closed on RPC error, read-only reported");
  process.exit(0);
}

main().catch((error) => { console.error(error); process.exit(1); });
