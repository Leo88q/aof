/**
 * [SECURITY_CHECKLIST #65] Session keys (SPL delegates on players' tool ATAs)
 * are never stored in plaintext: encryption at rest, fail-closed without a
 * key, legacy migration, tamper detection and path-traversal rejection.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Keypair } from "@solana/web3.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aof-keystore-"));
process.env.SESSION_KEYSTORE_DIR = dir;
delete process.env.SESSION_KEYSTORE_KEY;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ks = require("../src/lib/sessionKeys") as typeof import("../src/lib/sessionKeys");

const user = Keypair.generate().publicKey.toBase58();
const fileOf = (u: string) => path.join(dir, `${u}.json`);

// 1. No key configured: nothing is created, nothing is loaded.
assert.throws(() => ks.getOrCreateSessionKeypair(user), /SESSION_KEYSTORE_KEY is not configured/);
assert.equal(ks.loadSessionKeypair(user), null);
assert.equal(fs.existsSync(fileOf(user)), false);

// 2. With a key: the file holds ciphertext only, owner-readable only.
const key = randomBytes(32).toString("base64");
process.env.SESSION_KEYSTORE_KEY = key;
const kp = ks.getOrCreateSessionKeypair(user);
const stored = fs.readFileSync(fileOf(user), "utf8");
const entry = JSON.parse(stored);
assert.equal(entry.v, 2);
assert.equal(entry.secretKey, undefined, "no plaintext secretKey field");
assert.ok(!stored.includes(Buffer.from(kp.secretKey).toString("base64")), "secret bytes are not in the file");
assert.ok(!stored.includes(JSON.stringify(Array.from(kp.secretKey)).slice(1, 40)), "secret array is not in the file");
if (process.platform !== "win32") assert.equal(fs.statSync(fileOf(user)).mode & 0o777, 0o600);
assert.deepEqual(ks.loadSessionKeypair(user)?.secretKey, kp.secretKey, "round trip");
assert.equal(ks.getOrCreateSessionKeypair(user).publicKey.toBase58(), kp.publicKey.toBase58(), "stable key");

// 3. A legacy plaintext entry is migrated to ciphertext on first read.
const legacyUser = Keypair.generate().publicKey.toBase58();
const legacy = Keypair.generate();
fs.writeFileSync(fileOf(legacyUser), JSON.stringify({ user: legacyUser, secretKey: Array.from(legacy.secretKey) }));
assert.equal(ks.loadSessionKeypair(legacyUser)?.publicKey.toBase58(), legacy.publicKey.toBase58());
const migrated = JSON.parse(fs.readFileSync(fileOf(legacyUser), "utf8"));
assert.equal(migrated.v, 2);
assert.equal(migrated.secretKey, undefined, "legacy plaintext removed");

// 4. Tampering and a wrong key are detected (AES-GCM authentication).
const tampered = { ...entry, ct: Buffer.from(randomBytes(64)).toString("base64") };
fs.writeFileSync(fileOf(user), JSON.stringify(tampered));
assert.equal(ks.loadSessionKeypair(user), null, "tampered ciphertext rejected");
fs.writeFileSync(fileOf(user), stored);
process.env.SESSION_KEYSTORE_KEY = randomBytes(32).toString("hex");
assert.equal(ks.loadSessionKeypair(user), null, "wrong key rejected");
process.env.SESSION_KEYSTORE_KEY = key;

// 5. Only canonical pubkeys name a file: no path traversal.
assert.throws(() => ks.getOrCreateSessionKeypair("../../etc/passwd"));
assert.equal(ks.loadSessionKeypair("../" + user), null);
process.env.SESSION_KEYSTORE_KEY = "short";
assert.throws(() => ks.keystoreKey(), /exactly 32 bytes/);

fs.rmSync(dir, { recursive: true, force: true });
console.log("session keystore self-test: encryption at rest, fail-closed, legacy migration, tamper/wrong-key and traversal rejection passed");
