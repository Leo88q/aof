/**
 * [ФИКС Группы 3] Кейстор сессионных ключей Farm-Trader.
 * Сессионный ключ — эфемерная пара, которой пользователь делегирует право
 * исполнять определённые инструкции (session_create в aof-market).
 * Хранение: JSON-файлы в data/session-keys/ (вне git, права 0600).
 */
import { Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";

const KEYSTORE_DIR =
  process.env.SESSION_KEYSTORE_DIR ||
  path.join(process.cwd(), "data", "session-keys");

function ensureDir(): void {
  if (!fs.existsSync(KEYSTORE_DIR)) {
    fs.mkdirSync(KEYSTORE_DIR, { recursive: true });
  }
}

function fileFor(user: string): string {
  // Адрес кошелька — base58, безопасен для имени файла
  return path.join(KEYSTORE_DIR, `${user}.json`);
}

/** Получить или создать сессионный ключ пользователя */
export function getOrCreateSessionKeypair(user: string): Keypair {
  ensureDir();
  const file = fileFor(user);
  if (fs.existsSync(file)) {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw.secretKey));
  }
  const kp = Keypair.generate();
  fs.writeFileSync(
    file,
    JSON.stringify({
      user,
      publicKey: kp.publicKey.toBase58(),
      secretKey: Array.from(kp.secretKey),
      createdAt: new Date().toISOString(),
    }),
    { mode: 0o600 }
  );
  return kp;
}

/** Загрузить существующий ключ (null если нет) */
export function loadSessionKeypair(user: string): Keypair | null {
  const file = fileFor(user);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw.secretKey));
  } catch {
    return null;
  }
}
