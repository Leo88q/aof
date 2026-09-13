import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/Card";
import { useWalletStr } from "../../lib/useWalletStr";
import { useNav } from "../../nav/NavContext";
import { FriendFarmPage } from "./FriendFarmPage";

interface Neighbor {
  user: string;
  displayName?: string;
  avatar?: string;
}

export function FriendsList() {
  const user = useWalletStr();
  const { push } = useNav();
  const [visitsLeft, setVisitsLeft] = useState<number>(5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api.neighbors
      .list(user)
      .then((data: any) => {
        setVisitsLeft(data?.visitsLeftToday ?? 5);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="text-parchment">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Лимит визитов */}
      <Card className="p-4 bg-gradient-to-br from-soil-800 to-soil-900 border border-straw/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-parchment font-semibold mb-1">
              Визиты сегодня
            </h3>
            <p className="text-straw text-xs">
              Помогайте друзьям — получайте trust points
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gold">{visitsLeft}</div>
            <div className="text-xs text-straw">осталось</div>
          </div>
        </div>
      </Card>

      {/* Поиск по нику */}
      <Card className="p-4 bg-soil-800 border border-straw/10">
        <h3 className="text-parchment font-semibold text-sm mb-3">
          🔍 Найти игрока
        </h3>
        <p className="text-straw text-xs mb-3">
          Введите ник или адрес кошелька
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ник или адрес (например: Farmer123)"
            className="flex-1 px-3 py-2 rounded-xl bg-soil-700 border border-straw/20 text-parchment text-sm placeholder:text-straw/50"
            id="friend-search"
          />
          <button
            onClick={async () => {
              const query = (document.getElementById("friend-search") as HTMLInputElement)?.value?.trim();
              if (!query) return;
              
              try {
                const resp = await fetch(`/api/neighbors/search/${encodeURIComponent(query)}`);
                const data = await resp.json();
                
                if (data.found && data.user) {
                  // Найден один игрок
                  push("profile", "friend", <FriendFarmPage address={data.user} />);
                } else if (data.found && data.results?.length > 0) {
                  // Несколько результатов — показываем первый
                  push("profile", "friend", <FriendFarmPage address={data.results[0].user} />);
                } else {
                  alert("Игрок не найден");
                }
              } catch (e: any) {
                alert(`Ошибка: ${e.message}`);
              }
            }}
            className="px-4 py-2 rounded-xl bg-wheat-600 text-white font-semibold text-sm whitespace-nowrap"
          >
            Найти
          </button>
        </div>
      </Card>

      {/* Пустой список (пока нет рефералов) */}
      <Card className="p-8 text-center bg-soil-800 border border-straw/10">
        <div className="text-5xl mb-3">👥</div>
        <h3 className="text-parchment font-semibold mb-2">
          Пока нет друзей
        </h3>
        <p className="text-straw text-sm">
          Приглашайте друзей через реферальную систему — они появятся здесь
        </p>
      </Card>
    </div>
  );
}
