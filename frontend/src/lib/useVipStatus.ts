import { useEffect } from "react";
import { api } from "./api";
import { useStore } from "../store/useStore";
import { useWalletStr } from "./useWalletStr";

/**
 * Загружает VIP-статус пользователя и все привилегии.
 * Вызывается глобально при подключении кошелька.
 * Сохраняет isVip + vipPrivileges в useStore.
 */
export function useVipStatus(seasonId: number = 1) {
  const user = useWalletStr();
  const { isVip, vipPrivileges, setVip } = useStore();

  useEffect(() => {
    if (!user) {
      setVip(false);
      return;
    }
    api.season
      .vipStatus(user)
      .then((data: any) => {
        setVip(Boolean(data?.isVip), data?.privileges || null);
      })
      .catch(() => setVip(false));
  }, [user, seasonId, setVip]);

  return { isVip, vipPrivileges };
}
