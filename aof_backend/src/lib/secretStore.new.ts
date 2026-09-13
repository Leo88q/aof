import { randomBytes, createHash } from "crypto";
import { prisma } from "../db";

export async function newCommit(key: string, ttlSeconds: number = 300): Promise<{ secret: Buffer; hash: number[] }> {
  const secret = randomBytes(32);
  const hash = createHash("sha256").update(secret).digest();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  
  await prisma.commitSecret.create({
    data: {
      key,
      secret: secret.toString("hex"),
      expiresAt,
    },
  });
  
  return { secret, hash: Array.from(hash) };
}

export async function popSecret(key: string): Promise<number[]> {
  const record = await prisma.commitSecret.findUnique({ where: { key } });
  if (!record) throw new Error("secret not found for key " + key);
  if (record.used) throw new Error("secret already used for key " + key);
  if (record.expiresAt < new Date()) throw new Error("secret expired for key " + key);
  
  await prisma.commitSecret.update({
    where: { key },
    data: { used: true },
  });
  
  return Array.from(Buffer.from(record.secret, "hex"));
}

// Фоновый воркер для авто-reveal протухших коммитов
export async function revealExpiredCommits() {
  const expired = await prisma.commitSecret.findMany({
    where: {
      used: false,
      expiresAt: { lt: new Date() },
    },
    take: 100,
  });
  
  for (const record of expired) {
    try {
      console.log(`Revealing expired commit: ${record.key}`);
      await prisma.commitSecret.update({
        where: { id: record.id },
        data: { used: true },
      });
    } catch (e) {
      console.error(`Failed to reveal ${record.key}:`, e);
    }
  }
}
