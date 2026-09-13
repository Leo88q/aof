import { Router } from "express";
import crypto from "crypto";
import { db } from "../lib/db";

const r = Router();

// Упрощённое меркле-дерево для снапшотов
function buildMerkleTree(leaves: string[]): { root: string; proofs: string[][] } {
  if (leaves.length === 0) return { root: "", proofs: [] };

  const hash = (data: string) => crypto.createHash("sha256").update(data).digest("hex");
  let level = leaves.map(hash);
  const proofs: string[][] = leaves.map(() => []);

  while (level.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      nextLevel.push(hash(left + right));

      // Записываем пруфы
      if (i < proofs.length) proofs[i].push(right);
      if (i + 1 < proofs.length) proofs[i + 1].push(left);
    }
    level = nextLevel;
  }

  return { root: level[0], proofs };
}

// Создать снапшот лидерборда (вызывается воркером раз в неделю)
r.post("/snapshot", async (req, res) => {
  try {
    const { period, periodId } = req.body;
    const weekNumber = Number(periodId);

    // Собираем топ-100 по вкладам в челленджи
    const contributions = await db.challengeScore.findMany({
      where: { weekNumber },
      orderBy: { medals: "desc" },
      take: 100,
    });

    if (contributions.length === 0) {
      return res.status(404).json({ error: "No contributions for this period" });
    }

    // Строим меркле-дерево из листьев "user:score"
    const leaves = contributions.map((c) => `${c.user}:${c.medals}`);
    const { root, proofs } = buildMerkleTree(leaves);

    // Сохраняем снапшот
    const snapshot = await db.leaderboardSnapshot.upsert({
      where: { period_periodId: { period, periodId: weekNumber } },
      update: { merkleRoot: root, totalEntries: contributions.length },
      create: { period, periodId: weekNumber, merkleRoot: root, totalEntries: contributions.length },
    });

    // Сохраняем записи с пруфами
    for (let i = 0; i < contributions.length; i++) {
      await db.leaderboardEntry.upsert({
        where: { snapshotId_user: { snapshotId: snapshot.id, user: contributions[i].user } },
        update: { rank: i + 1, score: contributions[i].medals, proof: JSON.stringify(proofs[i]) },
        create: {
          snapshotId: snapshot.id,
          user: contributions[i].user,
          rank: i + 1,
          score: contributions[i].medals,
          proof: JSON.stringify(proofs[i]),
        },
      });
    }

    res.json({ snapshot, entries: contributions.length });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Получить снапшот + пруф для конкретного пользователя (для верификации)
r.get("/:period/:periodId/:user", async (req, res) => {
  try {
    const { period, periodId, user } = req.params;
    const snapshot = await db.leaderboardSnapshot.findUnique({
      where: { period_periodId: { period, periodId: Number(periodId) } },
    });
    if (!snapshot) return res.status(404).json({ error: "Snapshot not found" });

    const entry = await db.leaderboardEntry.findUnique({
      where: { snapshotId_user: { snapshotId: snapshot.id, user } },
    });

    res.json({
      merkleRoot: snapshot.merkleRoot,
      entry: entry ? { rank: entry.rank, score: entry.score, proof: JSON.parse(entry.proof) } : null,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
