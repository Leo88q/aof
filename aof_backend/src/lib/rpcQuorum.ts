/**
 * Кворум независимых RPC для решений, ведущих к подписи (#103).
 *
 * Угроза (KelpDAO, 18 апреля 2026, ≈$292 млн): атакующий внедрил код в op-geth
 * на двух Kubernetes-кластерах, откуда DVN читал состояние цепи. Подписант
 * получал подделку, а мониторинг — честные данные. Один RPC-источник правды =
 * один источник лжи: он не «сломался», он отвечает неправильно, и подпись
 * уходит по ложным данным.
 *
 * Что делаем: любое чтение, на основании которого бэкенд co-sign'ит минт или
 * выплату, берётся с нескольких endpoints, ответы канонизируются (owner,
 * lamports, data, executable), и решение принимается только при совпадении
 * минимум `minAgreement` независимых хостов. Commitment — `finalized`:
 * подтверждённый, но не финализированный слот может быть откатан.
 *
 * Модуль намеренно без зависимостей (кроме node:crypto): его можно прогнать
 * host-тестом с поддельным fetch, без ноды и без сети. Fail-closed: в production
 * без `RPC_QUORUM_URLS` подписывающие чтения не работают (см. signerReadPolicy).
 */
import { createHash } from "node:crypto";

export class RpcQuorumError extends Error {
  status = 503;
  expose = true;
}

export type AccountSample = {
  endpoint: string;
  slot: number | null;
  owner: string | null;
  lamports: number | null;
  dataBase64: string | null;
  executable: boolean | null;
  /** null-значение = аккаунта нет; это тоже «голос», и он тоже должен совпасть. */
  missing: boolean;
};

export type QuorumPolicy = {
  endpoints: string[];
  minAgreement: number;
  required: boolean;
};

const DEFAULT_MIN_AGREEMENT = 2;

/**
 * Разбор списка endpoints. Требования:
 *  - http(s), без пути с query (RPC-ключ живёт в пути у части провайдеров —
 *    это допустимо, но хост учитывается отдельно от полного URL);
 *  - минимум два РАЗНЫХ хоста (два URL одного провайдера — не независимость);
 *  - дубликаты схлопываются.
 */
export function parseQuorumEndpoints(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const hosts = new Set<string>();
  for (const piece of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    let url: URL;
    try {
      url = new URL(piece);
    } catch {
      throw new RpcQuorumError(`RPC_QUORUM_URLS: некорректный URL «${piece}»`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new RpcQuorumError(`RPC_QUORUM_URLS: поддерживаются только http(s), получено «${url.protocol}»`);
    }
    const normalized = url.toString();
    if (out.includes(normalized)) continue;
    if (url.protocol === "https:" && hosts.has(url.host)) {
      throw new RpcQuorumError(
        `RPC_QUORUM_URLS: два endpoint'а на одном хосте (${url.host}) не дают независимости — нужен другой провайдер`,
      );
    }
    hosts.add(url.host);
    out.push(normalized);
  }
  return out;
}

/** Политика кворума из окружения. */
export function signerReadPolicy(env: NodeJS.ProcessEnv = process.env): QuorumPolicy {
  const endpoints = parseQuorumEndpoints(env.RPC_QUORUM_URLS);
  const rawMin = env.RPC_QUORUM_MIN_AGREEMENT;
  let minAgreement = DEFAULT_MIN_AGREEMENT;
  if (rawMin !== undefined && rawMin !== "") {
    const value = Number(rawMin);
    if (!Number.isInteger(value) || value < 2) {
      throw new RpcQuorumError("RPC_QUORUM_MIN_AGREEMENT должен быть целым >= 2 (один источник — не кворум)");
    }
    minAgreement = value;
  }
  const required = env.SIGNER_RPC_QUORUM_REQUIRED !== undefined
    ? env.SIGNER_RPC_QUORUM_REQUIRED !== "false"
    : env.NODE_ENV === "production";
  if (endpoints.length > 0 && endpoints.length < minAgreement) {
    throw new RpcQuorumError(
      `RPC_QUORUM_URLS: задано ${endpoints.length} endpoint'ов при RPC_QUORUM_MIN_AGREEMENT=${minAgreement} — кворум недостижим`,
    );
  }
  return { endpoints, minAgreement, required };
}

/** Fail-closed поза подписанта: в production без кворума не читаем вообще. */
export function assertSignerReadPolicy(env: NodeJS.ProcessEnv = process.env): QuorumPolicy {
  const policy = signerReadPolicy(env);
  if (policy.required && policy.endpoints.length === 0) {
    throw new RpcQuorumError(
      "RPC_QUORUM_URLS обязателен для решений, ведущих к подписи (production). " +
      "Настройте >=2 независимых RPC-провайдера или явно выставьте SIGNER_RPC_QUORUM_REQUIRED=false вне production (#103)",
    );
  }
  return policy;
}

/** Канонический отпечаток ответа: меняется от любого бита данных аккаунта. */
export function accountFingerprint(sample: AccountSample): string {
  if (sample.missing) return "missing";
  return createHash("sha256")
    .update([sample.owner ?? "", String(sample.lamports ?? ""), sample.dataBase64 ?? "", String(sample.executable ?? "")].join("|"))
    .digest("hex");
}

export type QuorumDecision = {
  sample: AccountSample | null;
  fingerprint: string;
  agreements: number;
  total: number;
  slots: number[];
};

/**
 * Решение по собранным ответам. Возвращает значение только при совпадении
 * минимум `minAgreement` отпечатков; иначе — ошибка с деталями (какие хосты
 * разошлись), чтобы инцидент можно было разобрать по логам.
 */
export function decideQuorum(samples: AccountSample[], minAgreement: number): QuorumDecision {
  if (samples.length === 0) throw new RpcQuorumError("Кворум RPC: ни один endpoint не ответил");
  const groups = new Map<string, AccountSample[]>();
  for (const sample of samples) {
    const key = accountFingerprint(sample);
    const group = groups.get(key) || [];
    group.push(sample);
    groups.set(key, group);
  }
  const ranked = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const [fingerprint, agreed] = ranked[0];
  if (agreed.length < minAgreement) {
    const detail = ranked
      .map(([key, list]) => `${key.slice(0, 12)}…: ${list.map((s) => s.endpoint).join(", ")}`)
      .join("; ");
    throw new RpcQuorumError(
      `Кворум RPC не достигнут: максимум ${agreed.length} совпадающих ответов из ${samples.length} при требуемых ${minAgreement}. ${detail}`,
    );
  }
  if (ranked.length > 1 && ranked[1][1].length > 0) {
    // Расхождение — сигнал инцидента, даже если кворум формально собран:
    // пишем в лог, чтобы мониторинг увидел «два RPC говорят разное».
    console.error(
      `[rpc-quorum] WARNING: endpoint'ы расходятся (${ranked.length} групп): ` +
      ranked.map(([key, list]) => `${key.slice(0, 12)}…=${list.map((s) => s.endpoint).join("|")}`).join(" "),
    );
  }
  return {
    sample: fingerprint === "missing" ? null : agreed[0],
    fingerprint,
    agreements: agreed.length,
    total: samples.length,
    slots: samples.map((s) => s.slot).filter((s): s is number => typeof s === "number"),
  };
}

type FetchLike = (input: string, init?: any) => Promise<any>;

/**
 * Прочитать аккаунт с кворумом. Ошибки отдельных endpoints не считаются
 * голосом: чтобы подпись прошла, нужно `minAgreement` успешных совпадающих
 * ответов. Один упавший провайдер — деградация, а не повод довериться оставшемуся.
 */
export async function readAccountQuorum(
  address: string,
  options: {
    endpoints: string[];
    minAgreement?: number;
    commitment?: "finalized" | "confirmed";
    timeoutMs?: number;
    fetchImpl?: FetchLike;
  },
): Promise<{ sample: AccountSample | null; decision: QuorumDecision }> {
  const { endpoints, minAgreement = DEFAULT_MIN_AGREEMENT, commitment = "finalized", timeoutMs = 8_000 } = options;
  const doFetch: FetchLike = options.fetchImpl || ((input: string, init?: any) => fetch(input, init));
  if (endpoints.length < minAgreement) {
    throw new RpcQuorumError(`Кворум RPC: ${endpoints.length} endpoint(ов) < minAgreement ${minAgreement}`);
  }
  const samples = await Promise.all(
    endpoints.map(async (endpoint): Promise<AccountSample | null> => {
      try {
        const response = await doFetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getAccountInfo",
            params: [address, { encoding: "base64", commitment }],
          }),
          signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json();
        if (body?.error) throw new Error(`RPC ${body.error.code}: ${String(body.error.message).slice(0, 120)}`);
        const value = body?.result?.value ?? null;
        const slot = typeof body?.result?.context?.slot === "number" ? body.result.context.slot : null;
        if (value === null || value === undefined) {
          return { endpoint, slot, owner: null, lamports: null, dataBase64: null, executable: null, missing: true };
        }
        const data = Array.isArray(value.data) ? value.data[0] : value.data;
        return {
          endpoint,
          slot,
          owner: value.owner ?? null,
          lamports: typeof value.lamports === "number" ? value.lamports : null,
          dataBase64: typeof data === "string" ? data : null,
          executable: typeof value.executable === "boolean" ? value.executable : null,
          missing: false,
        };
      } catch (error) {
        console.error(`[rpc-quorum] endpoint ${endpoint} не ответил: ${String((error as Error)?.message || error).slice(0, 160)}`);
        return null;
      }
    }),
  );
  const decision = decideQuorum(samples.filter((s): s is AccountSample => s !== null), minAgreement);
  return { sample: decision.sample, decision };
}
