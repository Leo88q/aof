import { useWalletStore } from "../store/walletStore";

/**
 * Возвращает адрес подключённого кошелька как строку.
 * Пустая строка если кошелёк не подключён.
 */
export function useWalletStr(): string {
  const { address } = useWalletStore();
  return address || "";
}
