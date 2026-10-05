#!/usr/bin/env node
/*
 * Привести authority backend'а в соответствие с ключом оператора.
 *
 * Зачем. `Config` в aof_core привязывается к upgrade authority программы, а
 * подписывающие маршруты backend'а (Config, минты, капы, тумблер добычи,
 * рынок) идут ключом из AUTHORITY_SECRET_KEY. Если это разные ключи, деплой
 * проходит, а первый же подписывающий шаг отказывает — уже после трат.
 * Ровно так и происходит после `dev-local.sh up` на чистом клоне: он генерирует
 * throwaway-ключ в .env, а программы в девнете принадлежат операторскому
 * `solana/keys/aof-authority-devnet.json`.
 *
 * Что делает:
 *   node scripts/set-backend-authority.mjs                     # --check: показать и сравнить
 *   node scripts/set-backend-authority.mjs --apply             # записать ключ оператора в .env
 *   node scripts/set-backend-authority.mjs --apply --keypair /путь/к/keypair.json
 *
 * Файл .env задаётся флагом --backend-env, а не --env-file: последний Node 22
 * перехватывает себе.
 *
 * Секрет не печатается никогда: только pubkey и путь. Проверка в --check
 * выходит с кодом 1 при расхождении, чтобы её можно было вызывать из скриптов.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const require = createRequire(path.join(ROOT, "aof_backend", "package.json"));
const bs58 = require("bs58");
const { Keypair } = require("@solana/web3.js");

function parseArgs(argv) {
  const opts = {
    apply: false,
    keypair: process.env.AUTHORITY_KEYPAIR || path.join("solana", "keys", "aof-authority-devnet.json"),
    envFile: path.join("aof_backend", ".env"),
    quiet: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--check") opts.apply = false;
    else if (arg === "--quiet") opts.quiet = true;
    else if (arg === "--keypair") opts.keypair = argv[++i];
    // Не `--env-file`: Node 22 перехватывает эту опцию себе даже после пути
    // к скрипту и падает с «node: <путь>: not found» вместо нашего ответа.
    else if (arg === "--backend-env") opts.envFile = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      console.log("usage: set-backend-authority.mjs [--check|--apply] [--keypair <файл>] [--backend-env <файл>] [--quiet]");
      process.exit(0);
    } else {
      console.error(`неизвестный аргумент: ${arg}`);
      process.exit(2);
    }
  }
  return opts;
}

function readKeypair(file) {
  if (!fs.existsSync(file)) {
    console.error(`ОТКАЗ: нет файла ключа ${file} — его создают на машине владельца (в git его нет).`);
    process.exit(2);
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`ОТКАЗ: ${file} не читается как JSON-массив ключа: ${e.message}`);
    process.exit(2);
  }
  if (!Array.isArray(raw) || raw.length !== 64) {
    console.error(`ОТКАЗ: ${file} не похож на keypair (ожидался массив из 64 байт).`);
    process.exit(2);
  }
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function envValue(text, key) {
  const match = new RegExp(`^${key}=(.*)$`, "m").exec(text);
  if (!match) return { present: false, value: "" };
  return { present: true, value: match[1].trim().replace(/^["']|["']$/g, "") };
}

function setEnvValue(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) return { text: text.replace(re, line), replaced: true };
  return { text: `${text.replace(/\s*$/, "")}\n${line}\n`, replaced: false };
}

function pubkeyFromEnvSecret(text) {
  const { present, value } = envValue(text, "AUTHORITY_SECRET_KEY");
  if (!present || !value) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(value)).publicKey.toBase58();
  } catch {
    return "<AUTHORITY_SECRET_KEY не читается как base58-секрет>";
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const keypairPath = path.resolve(ROOT, opts.keypair);
  const envPath = path.resolve(ROOT, opts.envFile);
  const operator = readKeypair(keypairPath);

  if (!fs.existsSync(envPath)) {
    console.error(`ОТКАЗ: нет ${opts.envFile} — сначала поднимите backend (bash scripts/dev-local.sh up).`);
    process.exit(2);
  }
  const text = fs.readFileSync(envPath, "utf8");
  const backendPubkey = pubkeyFromEnvSecret(text);
  const shown = (p) => (p === null ? "<не задан>" : p);

  if (!opts.apply) {
    if (!opts.quiet) {
      console.log(`ключ оператора   (${opts.keypair}): ${operator.publicKey.toBase58()}`);
      console.log(`authority backend'а (${opts.envFile}): ${shown(backendPubkey)}`);
      if (backendPubkey === operator.publicKey.toBase58()) {
        console.log("совпадают — подписывать может этот backend");
        return 0;
      }
      console.log("РАСХОЖДЕНИЕ: Config привязывается к upgrade authority, поэтому подписывающие шаги откажут.");
      console.log("Привести в соответствие: node scripts/set-backend-authority.mjs --apply");
    }
    return backendPubkey === operator.publicKey.toBase58() ? 0 : 1;
  }

  let updated = text;
  const results = [];
  for (const [key, value] of [
    ["AUTHORITY_SECRET_KEY", bs58.encode(operator.secretKey)],
    ["AUTHORITY_PUBKEY", operator.publicKey.toBase58()],
    ["AUTHORITY_MODE", "hot"],
  ]) {
    const res = setEnvValue(updated, key, value);
    updated = res.text;
    results.push(`${key} (${res.replaced ? "заменён" : "добавлен"})`);
  }
  fs.writeFileSync(envPath, updated, "utf8");
  console.log(`authority backend'а теперь = ключ оператора ${operator.publicKey.toBase58()}`);
  console.log(`обновлено в ${opts.envFile}: ${results.join(", ")}; секрет не печатался`);
  console.log("перезапустите backend, чтобы он прочитал ключ (Ctrl+C, затем: bash scripts/dev-local.sh up)");
  return 0;
}

process.exit(main());
