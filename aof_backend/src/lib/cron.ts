import { takeEconomySnapshot } from "./economyMonitor";
import { runMerchantCycle } from "./npcMerchant";

/**
 * Cron jobs для фоновых задач OpenClaw
 */

let economyInterval: NodeJS.Timeout | null = null;
let merchantInterval: NodeJS.Timeout | null = null;

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

  // NPC Merchant каждые 10 минут
  if (!merchantInterval) {
    merchantInterval = setInterval(async () => {
      try {
        console.log("🕐 [Cron] Running NPC merchant cycle...");
        const actions = await runMerchantCycle();
        console.log(`📊 [Cron] NPC completed: ${actions.length} trades`);
      } catch (e) {
        console.error("❌ [Cron] NPC merchant failed:", e);
      }
    }, 10 * 60 * 1000); // 10 минут
    
    console.log("✅ [Cron] NPC Merchant started (every 10 min)");
  }

}

export function stopCronJobs() {
  if (economyInterval) {
    clearInterval(economyInterval);
    economyInterval = null;
    console.log("⏹️ [Cron] Economy monitor stopped");
  }
}
