#!/usr/bin/env python3
"""Real SQLite SQL smoke; deliberately NOT a Prisma engine/route test."""
import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / "aof_backend/prisma/migrations").glob("*/migration.sql"))

class RewardMigrations(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript(MIGRATIONS[0].read_text())
        for key, claimed in [("legacy-unclaimed", 0), ("legacy-claimed", 1)]:
            self.db.execute('INSERT INTO InboxItem (id,user,sender,subject,body,claimed) VALUES (?,"wallet","event","reward","body",?)', (key, claimed))
        for migration in MIGRATIONS[1:]:
            self.db.executescript(migration.read_text())
    def tearDown(self):
        self.db.close()
    def test_quarantine_legacy_and_default_new_rewards(self):
        rows = self.db.execute("SELECT id,rewardVersion,claimState,claimMint FROM InboxItem ORDER BY id").fetchall()
        self.assertEqual(rows, [("legacy-claimed", 0, "legacy_claimed", None), ("legacy-unclaimed", 0, "unclaimed", None)])
        self.db.execute('INSERT INTO InboxItem (id,user,sender,subject,body) VALUES ("new","wallet","event","reward","body")')
        self.assertEqual(self.db.execute('SELECT rewardVersion,claimed,claimState FROM InboxItem WHERE id="new"').fetchone(), (1, 0, "unclaimed"))
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(), [])
    def test_durable_cursor_and_index(self):
        for last_id in ["099", "999", None]:
            self.db.execute('INSERT INTO ReconciliationCursor (name,lastId,updatedAt) VALUES ("inbox",?,CURRENT_TIMESTAMP) ON CONFLICT(name) DO UPDATE SET lastId=excluded.lastId,updatedAt=excluded.updatedAt', (last_id,))
            self.assertEqual(self.db.execute('SELECT lastId FROM ReconciliationCursor WHERE name="inbox"').fetchone(), (last_id,))
        plan = self.db.execute('EXPLAIN QUERY PLAN SELECT * FROM InboxItem WHERE claimState="submitted" AND claimed=true AND id>"099" ORDER BY id LIMIT 100').fetchall()
        self.assertIn("InboxItem_claimState_id_idx", str(plan))
    def test_claim_reservation_compare_and_swap(self):
        self.db.execute('INSERT INTO InboxItem (id,user,sender,subject,body) VALUES ("new","wallet","event","reward","body")')
        sql = 'UPDATE InboxItem SET claimed=true,claimState="reserved" WHERE id="new" AND claimed=false AND rewardVersion=1'
        self.assertEqual(self.db.execute(sql).rowcount, 1)
        self.assertEqual(self.db.execute(sql).rowcount, 0)
        self.db.execute('UPDATE InboxItem SET claimState="quarantined" WHERE id="new"')
        self.assertEqual(self.db.execute(sql).rowcount, 0)

if __name__ == "__main__": unittest.main()
