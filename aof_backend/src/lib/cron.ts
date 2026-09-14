import { takeEconomySnapshot } from "./economyMonitor";

/**
 * Cron jobs для фоновых задач OpenClaw
 */

let economyInterval: NodeJS.Timeout | null = null;

export function startCronJobs() {
  // Economy snapshot каждые 5 минут
  if (!economyInterval) {
    economyInterval = setInterval(async () => {
      try {
        console.log("🕐 [Cron] Taking economy snapshot...");
        const metrics = await takeEconomySnapshot();
        console.log(`📊 [Cron] Snapshot saved: supply=${metrics.potatoSupply}, inflation=${metrics.inflation24h.toFixed(2)}%`);
      } catch (e) {
        console.error("❌ [Cron] Economy snapshot failed:", e);
      }
    }, 5 * 60 * 1000); // 5 минут
    
    console.log("✅ [Cron] Economy monitor started (every 5 min)");
  }
  // NPC merchant is intentionally not started: the current contracts have
  // no canonical NPC inventory, settlement or counterparty escrow. A random
  // off-chain cycle would fabricate economic activity and audit records.

}

export function stopCronJobs() {
  if (economyInterval) {
    clearInterval(economyInterval);
    economyInterval = null;
    console.log("⏹️ [Cron] Economy monitor stopped");
  }
}
