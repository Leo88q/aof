import { takeEconomySnapshot } from "./economyMonitor";
import { scanFraudSignals } from "./fraudSignals";
import {AUTHORITY_PUBKEY} from "../config";

/**
 * Cron jobs для фоновых задач OpenClaw
 */

let economyInterval: NodeJS.Timeout | null = null;
let fraudInterval: NodeJS.Timeout | null = null;

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
  // Fraud signal scan: opens/refreshes review cases from the indexer ledger.
  // Never enforces anything (see src/lib/fraudSignals.ts). Off by default in
  // tests; FRAUD_SCAN_INTERVAL_MIN=0 disables it.
  const fraudEveryMin = Number(process.env.FRAUD_SCAN_INTERVAL_MIN ?? 15);
  if (!fraudInterval && fraudEveryMin > 0) {
    fraudInterval = setInterval(async () => {
      try {
        await scanFraudSignals({ authorityPayers: [AUTHORITY_PUBKEY.toBase58()] });
      } catch (e) {
        console.error("❌ [Cron] Fraud signal scan failed:", e);
      }
    }, fraudEveryMin * 60 * 1000);
    console.log(`✅ [Cron] Fraud signal scan started (every ${fraudEveryMin} min)`);
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
  if (fraudInterval) {
    clearInterval(fraudInterval);
    fraudInterval = null;
  }
}
