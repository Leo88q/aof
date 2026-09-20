import type { Connection } from "@solana/web3.js";

/** A wallet returning a signature means submission, not successful execution.
 * A timeout is pending/unknown, never an invitation to create a new payment. */
export async function confirmSignature(
  rpc: Pick<Connection, "getSignatureStatuses">,
  signature: string,
  wait: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 1000)),
  attempts = 60,
): Promise<void> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) throw new Error("Invalid transaction signature");
  for (let i = 0; i < attempts; i++) {
    const status = (await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new Error(`Транзакция не исполнена: ${signature}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await wait();
  }
  throw new Error(`Статус неизвестен. Не повторяйте оплату до проверки транзакции: ${signature}`);
}
