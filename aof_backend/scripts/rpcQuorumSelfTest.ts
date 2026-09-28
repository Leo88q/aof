/**
 * Host-самопроверка кворума RPC (#103). Без сети и без ноды: транспорт
 * подделывается, проверяется сама логика решений.
 *
 *   npm run test:rpc-quorum        # ts-node (CI, Node 20)
 *   node scripts/rpcQuorumSelfTest.ts   # Node >= 22.18 (встроенный type stripping)
 */
import assert from "node:assert/strict";
import {
  RpcQuorumError,
  accountFingerprint,
  assertSignerReadPolicy,
  decideQuorum,
  parseQuorumEndpoints,
  readAccountQuorum,
  signerReadPolicy,
  type AccountSample,
} from "../src/lib/rpcQuorum";

let passed = 0;
const check = (name: string, fn: () => void | Promise<void>) => {
  const result = fn();
  return Promise.resolve(result).then(() => {
    passed += 1;
    console.log(`  ✓ ${name}`);
  });
};

const sample = (endpoint: string, data: string, slot = 100): AccountSample => ({
  endpoint,
  slot,
  owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  lamports: 2_039_280,
  dataBase64: data,
  executable: false,
  missing: false,
});

const rpc = (data: string, slot = 100) => async (_url: string, init: any) => {
  const body = JSON.parse(init.body);
  assert.equal(body.params[1].commitment, "finalized", "подписывающее чтение обязано быть finalized");
  return {
    ok: true,
    status: 200,
    json: async () => ({ result: { context: { slot }, value: { owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", lamports: 2_039_280, data: [data, "base64"], executable: false } } }),
  };
};

async function main() {
  console.log("rpc-quorum self-test");

  await check("два независимых хоста дают одно значение — кворум собран", async () => {
    const { sample: value, decision } = await readAccountQuorum("addr", {
      endpoints: ["https://rpc-a.example.com", "https://rpc-b.example.com"],
      fetchImpl: rpc("AAAA"),
    });
    assert.ok(value);
    assert.equal(decision.agreements, 2);
    assert.equal(decision.total, 2);
  });

  await check("расхождение данных — ошибка, а не выбор «первого ответившего»", async () => {
    let call = 0;
    const flaky = async (url: string, init: any) => {
      call += 1;
      return rpc(call === 1 ? "AAAA" : "BBBB")(url, init);
    };
    await assert.rejects(
      () => readAccountQuorum("addr", { endpoints: ["https://rpc-a.example.com", "https://rpc-b.example.com"], fetchImpl: flaky }),
      (error: unknown) => error instanceof RpcQuorumError && /не достигнут/.test((error as Error).message),
    );
  });

  await check("третий endpoint компенсирует упавший, но не подменяет собой кворум", async () => {
    let call = 0;
    const mixed = async (url: string, init: any) => {
      call += 1;
      if (call === 2) throw new Error("ECONNRESET");
      return rpc("AAAA")(url, init);
    };
    const { decision } = await readAccountQuorum("addr", {
      endpoints: ["https://a.example.com", "https://b.example.com", "https://c.example.com"],
      fetchImpl: mixed,
    });
    assert.equal(decision.agreements, 2);
    assert.equal(decision.total, 2, "упавший endpoint не считается голосом");
  });

  await check("отсутствие аккаунта — тоже согласованное значение", async () => {
    const empty = async () => ({ ok: true, status: 200, json: async () => ({ result: { context: { slot: 5 }, value: null } }) });
    const { sample: value, decision } = await readAccountQuorum("addr", {
      endpoints: ["https://a.example.com", "https://b.example.com"],
      fetchImpl: empty,
    });
    assert.equal(value, null);
    assert.equal(decision.fingerprint, "missing");
  });

  await check("данные со слегка разными слотами, но одинаковыми байтами — согласие", () => {
    const decision = decideQuorum([sample("a", "AAAA", 10), sample("b", "AAAA", 12)], 2);
    assert.equal(decision.agreements, 2);
    assert.deepEqual(decision.slots, [10, 12]);
  });

  await check("отпечаток чувствителен к owner/lamports/data", () => {
    const base = sample("a", "AAAA");
    assert.notEqual(accountFingerprint(base), accountFingerprint({ ...base, lamports: 1 }));
    assert.notEqual(accountFingerprint(base), accountFingerprint({ ...base, owner: "other" }));
    assert.notEqual(accountFingerprint(base), accountFingerprint({ ...base, dataBase64: "BBBB" }));
  });

  await check("два URL одного хоста — ошибка конфигурации (не независимость)", () => {
    assert.throws(
      () => parseQuorumEndpoints("https://rpc.example.com/a,https://rpc.example.com/b"),
      (error: unknown) => error instanceof RpcQuorumError && /одном хосте/.test((error as Error).message),
    );
  });

  await check("дубликаты схлопываются, minAgreement >= 2 обязателен", () => {
    assert.equal(parseQuorumEndpoints("https://a.example.com,https://a.example.com").length, 1);
    assert.throws(() => signerReadPolicy({ RPC_QUORUM_URLS: "https://a.example.com,https://b.example.com", RPC_QUORUM_MIN_AGREEMENT: "1" } as NodeJS.ProcessEnv));
  });

  await check("production без RPC_QUORUM_URLS — fail-closed для подписи", () => {
    assert.throws(
      () => assertSignerReadPolicy({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
      (error: unknown) => error instanceof RpcQuorumError && /RPC_QUORUM_URLS обязателен/.test((error as Error).message),
    );
    assert.doesNotThrow(() =>
      assertSignerReadPolicy({ NODE_ENV: "production", SIGNER_RPC_QUORUM_REQUIRED: "false" } as NodeJS.ProcessEnv),
    );
    assert.doesNotThrow(() => assertSignerReadPolicy({ NODE_ENV: "development" } as NodeJS.ProcessEnv));
  });

  await check("в development без кворума политика пустая, но не падает", () => {
    const policy = signerReadPolicy({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
    assert.deepEqual(policy.endpoints, []);
    assert.equal(policy.required, false);
  });

  console.log(`rpc-quorum self-test: ${passed} проверок пройдено`);
}

main().catch((error) => {
  console.error("rpc-quorum self-test провален:", error);
  process.exit(1);
});
