import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useWalletStr } from "../../lib/useWalletStr";
import { Card } from "../../components/ui/Card";
import { Key, Note, Row, Rows } from "../../ui/forge/kit";

type Summary = {
  privileges: { tent: boolean; villagers: number; historian: boolean; medallion: boolean } | null;
  engagement: { lastDailyDay: number; streak: number; bestStreak: number; guildDeposited: string } | null;
  season: { seasonId: number; xp: number; premium: boolean; level: number } | null;
};

export function EngagementPage() {
  const wallet = useWalletStr();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [neighbor, setNeighbor] = useState("");
  const [amount, setAmount] = useState("1000000000");
  const [questId, setQuestId] = useState("1");
  const [note, setNote] = useState("");

  async function reload() {
    if (!wallet) return;
    const data = await api.engagement.summary(wallet);
    setSummary(data);
  }

  useEffect(() => { reload().catch((e) => setNote(String(e.message || e))); }, [wallet]);

  async function send(run: () => Promise<{ tx: string }>) {
    setNote("");
    try {
      const out = await run();
      setNote(out.tx ? "Transaction ready to sign." : "Sent.");
      await reload();
    } catch (e: any) {
      setNote(e.message || String(e));
    }
  }

  const privileges = summary?.privileges;
  const row = summary?.engagement;
  return (
    <Card className="p-4">
      <h2 className="text-lg text-parchment mb-2">Daily, streak, guild</h2>
      <Rows>
        <Row k="Streak" v={row ? `${row.streak} (best ${row.bestStreak})` : "—"} />
        <Row k="Last daily day" v={row ? String(row.lastDailyDay) : "—"} />
        <Row k="Guild deposited" v={row ? row.guildDeposited : "—"} />
        <Row k="Tent" v={privileges ? (privileges.tent ? "yes" : "no") : "—"} />
        <Row k="Villagers" v={privileges ? String(privileges.villagers) : "—"} />
        <Row k="Historian" v={privileges?.historian ? "yes" : "no"} />
        <Row k="Medallion" v={privileges?.medallion ? "yes" : "no"} />
        <Row k="Season" v={summary?.season ? `L${summary.season.level} ${summary.season.premium ? "premium" : "free"}` : "—"} />
      </Rows>
      <div className="flex flex-wrap gap-2 mt-3">
        <Key onClick={() => send(() => api.engagement.daily({ user: wallet }))}>Daily reward</Key>
        <Key onClick={() => send(() => api.engagement.comeback({ user: wallet }))}>Comeback</Key>
      </div>
      <label className="block mt-3 text-xs text-straw">Neighbor wallet
        <input className="w-full mt-1 bg-transparent border border-straw/40 p-2" value={neighbor} onChange={(e) => setNeighbor(e.target.value)} />
      </label>
      <Key onClick={() => send(() => api.engagement.neighbor({ user: wallet, neighbor }))}>Visit neighbor</Key>
      <label className="block mt-3 text-xs text-straw">Guild deposit (atomic mascot)
        <input className="w-full mt-1 bg-transparent border border-straw/40 p-2" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <Key onClick={() => send(() => api.engagement.guild({ user: wallet, amount }))}>Deposit to guild treasury</Key>
      <label className="block mt-3 text-xs text-straw">Quest progress id (1 tent, 2 villager, 3 historian, 4 medallion, 5 exploration tier, 6 season XP)
        <input className="w-full mt-1 bg-transparent border border-straw/40 p-2" value={questId} onChange={(e) => setQuestId(e.target.value)} />
      </label>
      <Key onClick={() => send(() => api.engagement.questProgress({ user: wallet, questId: Number(questId), seasonId: summary?.season?.seasonId }))}>Prove quest progress</Key>
      {note ? <Note>{note}</Note> : null}
    </Card>
  );
}
