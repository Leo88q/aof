import { useWalletStore } from "../store/walletStore";
import { useEffect } from "react";

/**
 * Возвращает адрес подключённого кошелька как строку.
 * Пустая строка если кошелёк не подключён.
 */
export function useWalletStr(): string {
  const { address, connected } = useWalletStore();
  
  // DEBUG: логируем состояние кошелька
  useEffect(() => {
    console.log("🔑 [useWalletStr] address:", address, "connected:", connected);
  }, [address, connected]);
  
  return address || "";
}
