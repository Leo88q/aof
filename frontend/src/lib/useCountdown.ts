import { useEffect, useState } from "react";

/**
 * Обратный отсчёт до целевого unix-времени.
 * Возвращает оставшиеся секунды, флаг завершения и строку ЧЧ:ММ:СС.
 */
export function useCountdown(targetUnix: number | null) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  if (!targetUnix) return { remaining: 0, done: true, label: "00:00:00" };

  const remaining = Math.max(0, targetUnix - now);
  const h = String(Math.floor(remaining / 3600)).padStart(2, "0");
  const m = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
  const s = String(remaining % 60).padStart(2, "0");

  return { remaining, done: remaining <= 0, label: `${h}:${m}:${s}` };
}
